// Objects which fall through downward passages and arrive on another level.
// C refs: dokick.c down_gate(), impact_drop(), ship_object(), obj_delivery(),
// and teleport.c rloco().
import { IS_SOFT, MIGR_LADDER_UP, SHOPBASE, MIGR_NOBREAK, MIGR_NOSCATTER, MIGR_RANDOM, MIGR_SSTAIRS, MIGR_STAIRS_UP, MIGR_TO_SPECIES, MIGR_WITH_HERO, TRAPDOOR, is_hole, } from './const.js';
import { newsym } from './display.js';
import { placeObject, remove_object, stack_object, } from './floor_object.js';
import { game } from './gstate.js';
import { requireInitializedGame } from './gstate.js';
import { removeWornHeroItem } from './hero_equipment.js';
import { costlySpot, objectIsUnpaid } from './shk.js';
import { pickedContainer, stolenValue } from './shop_loss.js';
import { roomsAt } from './room.js';
import { deleteObject, delobj } from './object_delete.js';
import { relocateObjectRandomly } from './object_teleport.js';
import { BOULDER, EGG, EXPENSIVE_CAMERA, MIRROR, OBJECT_MATERIAL, OBJECT_NAMES, ROCK, } from './object_data.js';
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
        if (stair.sx === x && stair.sy === y)
            return stair;
    }
    return null;
}
function trapAt(state, x, y) {
    return state.level?.traps?.find(trap => trap.tx === x && trap.ty === y) || null;
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
    if (onStronghold(state))
        return state.valley_level || null;
    if (inEndgame(state) || onBottomLevel(state))
        return null;
    return nextLevel(state);
}
function downwardGate(state, x, y) {
    if (onQuestStart(state) && !okToQuest(state))
        return null;
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
    if (!trap || !trap.tseen || !is_hole(trap.ttyp))
        return null;
    const destination = trapDestination(state);
    if (!destination)
        return null;
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
    if (heroIsBlind(state))
        return false;
    if (state === game)
        return cansee(x, y);
    return !state.viz_array || !!((state.viz_array[y]?.[x] ?? 0) & 0x2);
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
        }
        else if (candidate !== object) {
            count += quantity(candidate);
        }
    }
    return { count, chainThere };
}
function addToMigration(object, gate, state) {
    object.no_charge = false;
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
async function publishTransitMessage(object, gate, stays, impact, publish) {
    if (!impact.count && !impact.chainThere) {
        if (!stays)
            await publish(`${transitSubject(object)} falls ${gate.text}.`);
        return;
    }
    const plural = quantity(object) !== 1;
    const verb = impact.count ? (plural ? 'hit' : 'hits')
        : (plural ? 'rattle' : 'rattles');
    const target = impact.count
        ? `${impact.count === 1 ? 'another' : 'other'} object${impact.count === 1 ? '' : 's'}`
        : 'your chain';
    const fall = stays ? '.'
        : ` and ${plural ? 'fall' : 'falls'} ${gate.text}.`;
    await publish(`${transitSubject(object)} ${verb} ${target}${fall}`);
}
async function breaksInTransit(object, state, publish, random) {
    const { objectBreaksOnImpact } = await import('./object_breakage.js');
    if (!objectBreaksOnImpact(object, random))
        return false;
    if (object.otyp === MIRROR)
        state.u.uluck = Math.max(-13, (state.u?.uluck ?? 0) - 2);
    if (object.otyp === EGG && object.spe
        && object.corpsenm !== undefined && Number.isInteger(object.corpsenm) && object.corpsenm >= 0) {
        state.u.uluck = Math.max(-13, (state.u?.uluck ?? 0) - Math.min(quantity(object), 5));
    }
    if (!heroIsDeaf(state)) {
        const crash = OBJECT_MATERIAL[object.otyp] === GLASS
            || object.otyp === EXPENSIVE_CAMERA;
        await publish(`You hear a muffled ${crash ? 'crash' : 'splat'}.`);
    }
    await deleteObject(object, state);
    return true;
}
export async function impactDrop(missile, x, y, { state = requireInitializedGame(), publish = async () => { }, random = rn2, destinationLevel = 0, } = {}) {
    const gate = downwardGate(state, x, y);
    if (!gate)
        return 0;
    if (destinationLevel) {
        gate.arrival = MIGR_WITH_HERO;
        gate.destination = { ...gate.destination, dlevel: destinationLevel };
    }
    const pile = [...pileAt(state, x, y)];
    const total = pile.reduce((count, object) => count + (object === missile ? 0 : quantity(object)), 0);
    let fallen = 0;
    for (const object of pile) {
        if (object === missile
            || object === state.uball || object === state.u?.uball
            || object === state.uchain || object === state.u?.uchain)
            continue;
        if (missile?.otyp === ROCK && object.otyp === BOULDER)
            continue;
        if (random(object.otyp === BOULDER ? 30 : 3) !== 0)
            continue;
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
        }
        else {
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
export async function shipObject(object, x, y, { state = requireInitializedGame(), publish = async () => { }, random = rn2, shopFloorObject = false, } = {}) {
    if (!object)
        return false;
    const gate = downwardGate(state, x, y);
    if (!gate)
        return false;
    const attached = object === state.uball || object === state.u?.uball
        || object === state.uchain || object === state.u?.uchain;
    const stays = attached
        || (gate.arrival !== MIGR_LADDER_UP && random(3) !== 0);
    const unpaid = objectIsUnpaid(object);
    const container = !!object.contents?.length;
    const impact = pileImpact(state, object, x, y);
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
    if (unpaid || shopFloorObject) {
        if (unpaid) {
            await stolenValue(object, state.u.ux, state.u.uy, true, {
                state, publish, silent: false,
            });
        }
        else {
            const { ox, oy } = object;
            const room = roomsAt(state.level, ox, oy, SHOPBASE)[0];
            const sameShop = !!costlySpot(state.u.ux, state.u.uy, state)
                && room !== undefined && state.u.urooms.includes(room);
            await stolenValue(object, ox, oy, sameShop, {
                state, publish, silent: false,
            });
        }
        if (container)
            pickedContainer(object);
        if (object.oclass !== COIN_CLASS)
            object.no_charge = false;
    }
    if (object.owornmask) {
        await removeWornHeroItem(object, state);
        if (state.program_state.gameover)
            return true;
    }
    if (await breaksInTransit(object, state, publish, random))
        return true;
    addToMigration(object, gate, state);
    if (object.otyp === BOULDER)
        object.otrapped = false;
    if (impact.count) {
        await impactDrop(object, x, y, { state, publish, random });
        newsym(x, y);
    }
    return true;
}
function arrivalStairway(state, migration, ladder) {
    for (let stair = state.stairs; stair; stair = stair.next) {
        if (sameLevel(stair.tolev, migration.source)
            && !!stair.isladder === ladder)
            return stair;
    }
    return null;
}
function removeFromMigration(object, state) {
    const index = state.migratingObjects?.indexOf(object) ?? -1;
    if (index >= 0)
        state.migratingObjects?.splice(index, 1);
    object.where = 'free';
}
async function breaksOnArrival(object, state, x, y, random, noBreak) {
    const location = state.level.at(x, y);
    if (noBreak || (location !== null && IS_SOFT(location.typ)))
        return false;
    const { objectBreaksOnImpact } = await import('./object_breakage.js');
    if (!objectBreaksOnImpact(object, random))
        return false;
    remove_object(object, state);
    await deleteObject(object, state);
    newsym(x, y);
    return true;
}
async function deliverAtRandomPosition(object, state, random, publish, noBreak) {
    object.ox = object.oy = 0;
    if (!await relocateObjectRandomly(object, { state, random, publish })
        || noBreak)
        return;
    const { objectBreaksOnImpact } = await import('./object_breakage.js');
    if (objectBreaksOnImpact(object, random))
        await delobj(object, state);
}
async function deliverAtPassage(object, migration, state, position, publish, random, rollOne, noBreak) {
    await placeObject(object, position.x, position.y, state);
    if (await breaksOnArrival(object, state, position.x, position.y, random, noBreak))
        return;
    const landed = await stack_object(object, state);
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
export async function deliverMigratingObjects(state = requireInitializedGame(), { nearHero = false, publish = async () => { }, random = rn2, rollOne = rnd, } = {}) {
    let delivered = 0;
    for (const object of [...(state.migratingObjects || [])]) {
        const migration = object.migration;
        if (!migration || !sameLevel(migration.destination, state.u?.uz))
            continue;
        if (migration.arrival & MIGR_TO_SPECIES)
            continue;
        const arrival = migration.arrival
            & ~(MIGR_NOBREAK | MIGR_NOSCATTER);
        if (nearHero !== (arrival === MIGR_WITH_HERO))
            continue;
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
            await deliverAtPassage(object, migration, state, 'sx' in passage ? { x: passage.sx, y: passage.sy } : passage, publish, random, rollOne, noBreak);
        }
        else {
            await deliverAtRandomPosition(object, state, random, publish, noBreak);
        }
        delivered++;
    }
    return delivered;
}
//# sourceMappingURL=object_migration.js.map