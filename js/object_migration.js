// Objects which fall through downward passages and arrive on another level.
// C refs: dokick.c down_gate(), impact_drop(), ship_object(), obj_delivery(),
// and teleport.c rloco().

import {
    ACCESSIBLE, COLNO, IS_LAVA, IS_POOL, IS_SOFT, MIGR_LADDER_UP,
    MIGR_NOBREAK, MIGR_NOSCATTER, MIGR_RANDOM, MIGR_SSTAIRS,
    MIGR_STAIRS_UP, MIGR_TO_SPECIES, MIGR_WITH_HERO, ROWNO, TRAPDOOR,
    is_hole,
} from './const.js';
import { newsym } from './display.js';
import {
    place_object, remove_object, stack_object,
} from './floor_object.js';
import { game } from './gstate.js';
import { deleteObject } from './object_delete.js';
import {
    BOULDER, EGG, EXPENSIVE_CAMERA, MIRROR, OBJECT_MATERIAL,
    OBJECT_NAMES, ROCK,
} from './object_data.js';
import { makePlural } from './object_grammar.js';
import { onQuestStart, okToQuest } from './quest.js';
import { rn2, rnd } from './rng.js';
import { heroIsBlind, heroIsDeaf } from './senses.js';
import { cansee } from './vision.js';

const COIN_CLASS = 12;
const GLASS = 19;

function sameLevel(first, second) {
    return !!first && !!second
        && first.dnum === second.dnum
        && first.dlevel === second.dlevel;
}

function stairwayAt(state, x, y) {
    for (let stair = state.stairs; stair; stair = stair.next) {
        if (stair.sx === x && stair.sy === y) return stair;
    }
    return null;
}

function trapAt(state, x, y) {
    return state.level?.traps?.find(trap =>
        trap.tx === x && trap.ty === y) || null;
}

function nextLevel(state) {
    const current = state.u?.uz || { dnum: 0, dlevel: 1 };
    return { ...current, dlevel: (current.dlevel ?? 1) + 1 };
}

function onBottomLevel(state) {
    const current = state.u?.uz;
    const dungeon = state.dungeons?.[current?.dnum];
    return !!current && !!dungeon
        && current.dlevel === dungeon.num_dunlevs;
}

function inEndgame(state) {
    const current = state.u?.uz;
    return !!current && !!state.astral_level
        && current.dnum === state.astral_level.dnum;
}

function onStronghold(state) {
    return sameLevel(state.u?.uz, state.stronghold_level);
}

function trapDestination(state) {
    if (onStronghold(state)) return state.valley_level || null;
    if (inEndgame(state) || onBottomLevel(state)) return null;
    return nextLevel(state);
}

function downwardGate(state, x, y) {
    if (onQuestStart(state) && !okToQuest(state)) return null;

    const stair = stairwayAt(state, x, y);
    if (stair && !stair.up) {
        const destination = stair.tolev || nextLevel(state);
        if (stair.isladder) {
            return {
                arrival: MIGR_LADDER_UP,
                destination,
                text: 'down the ladder',
            };
        }
        return {
            arrival: destination.dnum === state.u?.uz?.dnum
                ? MIGR_STAIRS_UP : MIGR_SSTAIRS,
            destination,
            text: 'down the stairs',
        };
    }

    const trap = trapAt(state, x, y);
    if (!trap || !(trap.tseen ?? trap.seen) || !is_hole(trap.ttyp))
        return null;
    const destination = trapDestination(state);
    if (!destination) return null;
    return {
        arrival: MIGR_RANDOM,
        destination,
        text: trap.ttyp === TRAPDOOR
            ? 'through the trap door' : 'through the hole',
    };
}

function quantity(object) {
    return object.quan ?? object.quantity ?? 1;
}

function objectNoun(object) {
    return object.oextra?.oname || object.oname
        || object.name || OBJECT_NAMES[object.otyp] || 'object';
}

function transitSubject(object) {
    const count = quantity(object);
    const noun = objectNoun(object);
    return count === 1 ? `The ${noun}` : `The ${count} ${makePlural(noun)}`;
}

function squareIsVisible(state, x, y) {
    if (heroIsBlind(state)) return false;
    if (state === game) return cansee(x, y);
    return !state.viz_array || !!(state.viz_array?.[y]?.[x] & 0x2);
}

function pileAt(state, x, y) {
    return state.level?.objects?.[x]?.[y] || [];
}

function pileImpact(state, object, x, y) {
    let count = 0;
    let chainThere = false;
    for (const candidate of pileAt(state, x, y)) {
        if (candidate === state.uchain || candidate === state.u?.uchain) {
            chainThere = true;
        } else if (candidate !== object) {
            count += quantity(candidate);
        }
    }
    return { count, chainThere };
}

function clearObjectEquipment(object, state) {
    for (const slot of [
        'uwep', 'uswapwep', 'uquiver',
        'uarm', 'uarmc', 'uarmh', 'uarms', 'uarmg', 'uarmf', 'uarmu',
        'uleft', 'uright', 'uamul', 'ublindf',
    ]) {
        if (state[slot] === object) state[slot] = null;
        if (state.u?.[slot] === object) state.u[slot] = null;
    }
    object.owornmask = 0;
    object.worn = false;
    object.wielded = false;
    object.alternate = false;
    object.ready = false;
}

function addToMigration(object, gate, state) {
    clearObjectEquipment(object, state);
    if (object.oclass !== COIN_CLASS) object.no_charge = false;
    object.where = 'migrating';
    object.migration = {
        destination: { ...gate.destination },
        source: { ...(state.u?.uz || { dnum: 0, dlevel: 1 }) },
        arrival: gate.arrival,
    };
    object.ox = gate.destination.dnum;
    object.oy = gate.destination.dlevel;
    state.migratingObjects ||= [];
    state.migratingObjects.unshift(object);
}

async function publishTransitMessage(
    object, gate, stays, impact, publish,
) {
    if (!impact.count && !impact.chainThere) {
        if (!stays)
            await publish(`${transitSubject(object)} falls ${gate.text}.`);
        return;
    }

    const plural = quantity(object) !== 1;
    const verb = impact.count ? (plural ? 'hit' : 'hits')
        : (plural ? 'rattle' : 'rattles');
    const target = impact.count
        ? `${impact.count === 1 ? 'another' : 'other'} object${
            impact.count === 1 ? '' : 's'}`
        : 'your chain';
    const fall = stays ? '.'
        : ` and ${plural ? 'fall' : 'falls'} ${gate.text}.`;
    await publish(`${transitSubject(object)} ${verb} ${target}${fall}`);
}

async function breaksInTransit(object, state, publish, random) {
    const { objectBreaksOnImpact } = await import('./object_breakage.js');
    if (!objectBreaksOnImpact(object, random)) return false;

    if (object.otyp === MIRROR)
        state.u.uluck = Math.max(-13, (state.u?.uluck ?? 0) - 2);
    if (object.otyp === EGG && object.spe
        && Number.isInteger(object.corpsenm) && object.corpsenm >= 0) {
        state.u.uluck = Math.max(
            -13,
            (state.u?.uluck ?? 0) - Math.min(quantity(object), 5),
        );
    }
    if (!heroIsDeaf(state)) {
        const crash = OBJECT_MATERIAL[object.otyp] === GLASS
            || object.otyp === EXPENSIVE_CAMERA;
        await publish(`You hear a muffled ${crash ? 'crash' : 'splat'}.`);
    }
    deleteObject(object, state);
    return true;
}

export async function impactDrop(
    missile,
    x,
    y,
    {
        state = game,
        publish = async () => {},
        random = rn2,
    } = {},
) {
    const gate = downwardGate(state, x, y);
    if (!gate) return 0;

    const pile = [...pileAt(state, x, y)];
    const total = pile.reduce((count, object) =>
        count + (object === missile ? 0 : quantity(object)), 0);
    let fallen = 0;
    for (const object of pile) {
        if (object === missile
            || object === state.uball || object === state.u?.uball
            || object === state.uchain || object === state.u?.uchain) continue;
        if (missile?.otyp === ROCK && object.otyp === BOULDER) continue;
        if (random(object.otyp === BOULDER ? 30 : 3) !== 0) continue;
        remove_object(object, state);
        addToMigration(object, gate, state);
        fallen += quantity(object);
    }

    if (fallen && squareIsVisible(state, x, y)) {
        const all = fallen === total;
        const what = fallen === 1 ? 'object falls' : 'objects fall';
        if (missile) {
            const article = all ? 'the '
                : fallen === 1 ? 'an ' : '';
            await publish(`From the impact, ${article}${what} ${gate.text}.`);
        } else {
            const subject = all
                ? (fallen === 1
                    ? 'The adjacent object' : 'All the adjacent objects')
                : (fallen === 1
                    ? 'One of the adjacent objects'
                    : 'Some of the adjacent objects');
            await publish(`${subject} ${fallen === 1
                ? 'falls' : 'fall'} ${gate.text}.`);
        }
    }
    return fallen;
}

export async function shipObject(
    object,
    x,
    y,
    {
        state = game,
        publish = async () => {},
        random = rn2,
    } = {},
) {
    if (!object) return false;
    const gate = downwardGate(state, x, y);
    if (!gate) return false;

    const impact = pileImpact(state, object, x, y);
    const attached = object === state.uball || object === state.u?.uball
        || object === state.uchain || object === state.u?.uchain;
    const stays = attached
        || (gate.arrival !== MIGR_LADDER_UP && random(3) !== 0);
    const hole = gate.arrival === MIGR_RANDOM;
    if (object.otyp === BOULDER && hole) {
        if (impact.count) {
            await impactDrop(object, x, y, { state, publish, random });
        }
        return false;
    }

    if (squareIsVisible(state, x, y)) {
        await publishTransitMessage(object, gate, stays, impact, publish);
    }
    if (stays) {
        if (impact.count) {
            await impactDrop(object, x, y, { state, publish, random });
        }
        return false;
    }

    if (await breaksInTransit(object, state, publish, random)) return true;
    addToMigration(object, gate, state);
    if (object.otyp === BOULDER) object.otrapped = false;
    if (impact.count) {
        await impactDrop(object, x, y, { state, publish, random });
        newsym(x, y);
    }
    return true;
}

function inside(region, x, y) {
    return !!region && x >= region.lx && x <= region.hx
        && y >= region.ly && y <= region.hy;
}

function randomLandingAllowed(state, x, y, region) {
    if (region && !inside(region, x, y)) return false;
    if (inside(region?.exclude, x, y)) return false;
    const terrain = state.level?.at?.(x, y)?.typ;
    if (!ACCESSIBLE(terrain) || IS_POOL(terrain) || IS_LAVA(terrain))
        return false;
    return !(state.level?.monsters || []).some(monster =>
        !monster.dead && monster.mx === x && monster.my === y);
}

function randomLandingPosition(state, random) {
    const region = state.level?.downTeleportRegion;
    let position = { x: 2, y: 0 };
    for (let attempt = 0; attempt < 4000; attempt++) {
        position = {
            x: random(COLNO - 3) + 2,
            y: random(ROWNO),
        };
        if (randomLandingAllowed(state, position.x, position.y, region))
            break;
    }
    return position;
}

function arrivalStairway(state, migration, ladder) {
    for (let stair = state.stairs; stair; stair = stair.next) {
        if (sameLevel(stair.tolev, migration.source)
            && !!stair.isladder === ladder) return stair;
    }
    return null;
}

function removeFromMigration(object, state) {
    const index = state.migratingObjects?.indexOf(object) ?? -1;
    if (index >= 0) state.migratingObjects.splice(index, 1);
    object.where = 'free';
}

async function breaksOnArrival(object, state, x, y, random, noBreak) {
    if (noBreak || IS_SOFT(state.level?.at?.(x, y)?.typ)) return false;
    const { objectBreaksOnImpact } = await import('./object_breakage.js');
    if (!objectBreaksOnImpact(object, random)) return false;
    remove_object(object, state);
    deleteObject(object, state);
    newsym(x, y);
    return true;
}

async function deliverAtRandomPosition(
    object, state, random, publish, noBreak,
) {
    const position = randomLandingPosition(state, random);
    const { landFloorObject } = await import('./floor_effects.js');
    const landed = await landFloorObject(object, position.x, position.y, {
        state,
        publish,
        random,
    });
    if (landed === object)
        await breaksOnArrival(
            object, state, position.x, position.y, random, noBreak,
        );
}

async function deliverAtPassage(
    object, migration, state, position, publish, random, rollOne, noBreak,
) {
    place_object(object, position.x, position.y, state);
    if (await breaksOnArrival(
        object, state, position.x, position.y, random, noBreak,
    )) return;
    const landed = stack_object(object, state);
    const arrival = migration.arrival
        & ~(MIGR_NOBREAK | MIGR_NOSCATTER);
    if ((migration.arrival & MIGR_NOSCATTER)
        || arrival === MIGR_WITH_HERO) {
        newsym(position.x, position.y);
        return;
    }
    const { scatterFloorObjects } = await import('./scatter.js');
    await scatterFloorObjects(position.x, position.y, rollOne(2), {
        state,
        onlyObject: landed,
        mayDestroy: false,
        mayFracture: false,
        mayHitHero: false,
        mayHitMonsters: false,
        publish,
        random,
        rollOne,
    });
}

export async function deliverMigratingObjects(
    state = game,
    {
        nearHero = false,
        publish = async () => {},
        random = rn2,
        rollOne = rnd,
    } = {},
) {
    let delivered = 0;
    for (const object of [...(state.migratingObjects || [])]) {
        const migration = object.migration;
        if (!migration || !sameLevel(migration.destination, state.u?.uz))
            continue;
        if (migration.arrival & MIGR_TO_SPECIES) continue;
        const arrival = migration.arrival
            & ~(MIGR_NOBREAK | MIGR_NOSCATTER);
        if (nearHero !== (arrival === MIGR_WITH_HERO)) continue;

        removeFromMigration(object, state);
        delete object.migration;
        let passage = null;
        if ([MIGR_STAIRS_UP, MIGR_SSTAIRS].includes(arrival))
            passage = arrivalStairway(state, migration, false);
        else if (arrival === MIGR_LADDER_UP)
            passage = arrivalStairway(state, migration, true);
        else if (arrival === MIGR_WITH_HERO) {
            passage = { x: state.u.ux, y: state.u.uy };
        }

        const noBreak = !!(migration.arrival & MIGR_NOBREAK);
        if (passage) {
            await deliverAtPassage(
                object, migration, state,
                { x: passage.sx ?? passage.x, y: passage.sy ?? passage.y },
                publish, random, rollOne, noBreak,
            );
        } else {
            await deliverAtRandomPosition(
                object, state, random, publish, noBreak,
            );
        }
        delivered++;
    }
    return delivered;
}
