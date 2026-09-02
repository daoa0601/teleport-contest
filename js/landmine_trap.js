// Land mines triggered by monsters.
// C ref: trap.c:trapeffect_landmine() and blow_up_landmine().

import {
    D_BROKEN, IS_DOOR, Is_airlevel, Is_waterlevel,
    LAVAPOOL, PIT, ROOM, W_ARMF, WT_ELF,
} from './const.js';
import { newsym, plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { liquidForHole } from './hole.js';
import {
    fillPitWithBoulderAt,
} from './mklev.js';
import {
    monsterInAir, resolveMonsterLiquid, wakeMonstersNear,
} from './mon.js';
import {
    MONSTER_BODY_META, MONSTER_FLAGS1, MONSTER_NAME,
} from './monster_data.js';
import { IRON_SHOES } from './object_data.js';
import { rn2, rnd } from './rng.js';
import { scatterFloorObjects } from './scatter.js';
import {
    destroyLavaFloorObjects, monsterTrapVisibility, waterDamageChain,
} from './trap.js';
import { vision_note_blocker_change } from './vision.js';

const M1_WALLWALK = 0x00000008;

function inventoryOf(monster) {
    return monster.minvent || monster.inventory || [];
}

function wearsIronShoes(monster) {
    return inventoryOf(monster).some(object =>
        object.otyp === IRON_SHOES
        && ((object.owornmask ?? 0) & W_ARMF));
}

function ordinaryMonsterName(monster) {
    return monster.name || MONSTER_NAME[monster.mnum] || 'monster';
}

function ordinaryMonsterSubject(monster) {
    return `The ${ordinaryMonsterName(monster)}`;
}

function levelHasNoPits(state) {
    return !!state.level?.flags?.is_airlevel
        || !!state.level?.flags?.is_waterlevel
        || Is_airlevel(state.u?.uz) || Is_waterlevel(state.u?.uz);
}

function removeTrap(state, trap) {
    const index = state.level?.traps?.indexOf(trap) ?? -1;
    if (index >= 0) state.level.traps.splice(index, 1);
}

function removeEngravingAt(state, x, y) {
    state.level.engravings = (state.level?.engravings || []).filter(
        engraving => (engraving.x ?? engraving.ex) !== x
            || (engraving.y ?? engraving.ey) !== y,
    );
}

async function destroyDrawbridgeAt(x, y, state, finishDeath) {
    const { destroyDrawbridge, findDrawbridgeAt } = await import('./dbridge.js');
    const bridge = findDrawbridgeAt(x, y, state);
    if (!bridge) return false;
    return destroyDrawbridge(bridge.x, bridge.y, state, {
        finishMonsterKill: async (monster, _x, _y, options) => {
            const death = await finishDeath(monster, {
                noCorpse: options.noCorpse,
                visible: false,
                spotted: false,
            });
            return !death.survived;
        },
    });
}

async function flowLiquidIntoMineHole(
    x, y, trap, liquid, monster, state, options,
) {
    removeTrap(state, trap);
    const location = state.level.at(x, y);
    location.typ = liquid;
    location.flags = 0;
    const pile = state.level?.objects?.[x]?.[y] || [];
    if (liquid === LAVAPOOL) {
        await destroyLavaFloorObjects(pile, {
            publish: options.publish,
            random: options.random,
            visible: options.seeSquare,
        });
    } else {
        const messages = [];
        await waterDamageChain(pile, messages, state);
        if (options.seeSquare) {
            for (const message of messages) await options.publish(message);
        }
    }
    await resolveMonsterLiquid(monster, state, {
        announce: options.publish,
        monsterMoving: true,
        random: options.random,
        finishDeath: async (
            victim, _state, random, _calls, leaveCorpse,
        ) => options.finishDeath(victim, {
            noCorpse: !leaveCorpse,
            visible: options.seeSquare,
            spotted: options.inSight,
            random,
            publish: options.publish,
        }),
    });
    newsym(x, y);
}

async function blowUpLandMine(monster, event, state, options) {
    const x = event.trap.tx;
    const y = event.trap.ty;
    await scatterFloorObjects(x, y, 4, {
        state,
        publish: options.publish,
        random: options.random,
        rollOne: options.rollOne,
        finishMonsterDeath: options.finishDeath,
    });
    removeEngravingAt(state, x, y);
    wakeMonstersNear(x, y, 400, state);

    const location = state.level?.at?.(x, y);
    if (location && IS_DOOR(location.typ)) location.doormask = D_BROKEN;
    await destroyDrawbridgeAt(x, y, state, options.finishDeath);

    const survivingTrap = state.level?.traps?.find(candidate =>
        candidate.tx === x && candidate.ty === y) || null;
    if (!survivingTrap) return null;
    if (levelHasNoPits(state)) {
        removeTrap(state, survivingTrap);
        return null;
    }

    const liquid = liquidForHole(x, y, state, { random: options.random });
    if (liquid !== ROOM) {
        await flowLiquidIntoMineHole(
            x, y, survivingTrap, liquid, monster, state, {
                ...options,
                seeSquare: event.seeSquare,
                inSight: event.inSight,
            },
        );
        return null;
    }

    survivingTrap.ttyp = PIT;
    survivingTrap.madeby_u = false;
    survivingTrap.tseen = true;
    fillPitWithBoulderAt(x, y, state);
    vision_note_blocker_change(x, y);
    newsym(x, y);
    return state.level?.traps?.includes(survivingTrap)
        ? survivingTrap : null;
}

async function finishMineDeath(monster, event, options) {
    const name = options.describeMonster(monster);
    const death = await options.finishDeath(monster, {
        deathMessage: event.seeSquare ? `${name} is killed!` : null,
        visible: event.seeSquare,
        spotted: event.inSight,
        random: options.random,
        publish: options.publish,
    });
    event.death = death;
    if (!death.survived) {
        event.killed = true;
        return true;
    }
    monster.dead = false;
    return false;
}

async function fallIntoMinePit(monster, trap, event, state, options) {
    if (!trap || monsterInAir(monster, state)) return;
    if (!((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_WALLWALK))
        monster.mtrapped = 1;
    if (event.inSight) {
        await options.publish(
            `${options.describeMonster(monster)} falls into a pit!`,
        );
    }
    const damage = options.rollOne(6);
    monster.mhp = Math.max(0, (monster.mhp ?? 1) - damage);
    if (monster.mhp <= 0)
        await finishMineDeath(monster, event, options);
}

export function beginMonsterLandMine(
    monster,
    trap,
    state = game,
    { random = rn2, rollOne = rnd } = {},
) {
    const visibility = monsterTrapVisibility(monster, state);
    const rawDamage = rollOne(16);
    const damage = wearsIronShoes(monster)
        ? Math.trunc((rawDamage + 3) / 4) : rawDamage;
    const bodyWeight = MONSTER_BODY_META[monster.mnum]?.[0] ?? 0;
    const triggerWeight = Math.trunc(WT_ELF / 2);
    const triggerRoll = random(Math.max(1, bodyWeight + 1));
    const event = {
        kind: 'land-mine',
        trap,
        damage,
        exploded: false,
        killed: false,
        finished: false,
        airborne: false,
        alreadySeen: !!trap.tseen,
        discoveredTrigger: false,
        ...visibility,
    };
    if (triggerRoll < triggerWeight) {
        event.finished = true;
        return event;
    }

    event.airborne = monsterInAir(monster, state);
    if (event.airborne) {
        event.discoveredTrigger = event.inSight && !trap.tseen;
        if (event.discoveredTrigger) trap.tseen = true;
        event.airCurrentRoll = random(3);
        if (event.airCurrentRoll !== 0) {
            if (!event.discoveredTrigger) event.finished = true;
            return event;
        }
    }
    event.exploded = true;
    return event;
}

export function landMineNeedsResume(event) {
    return event?.kind === 'land-mine'
        && (event.exploded || event.discoveredTrigger);
}

export async function finishMonsterLandMine(
    monster,
    event,
    state = game,
    {
        finishDeath,
        publish = plineWithContinuation,
        random = rn2,
        rollOne = rnd,
        monsterName = ordinaryMonsterName,
        describeMonster = ordinaryMonsterSubject,
    } = {},
) {
    if (event.finished) return event;
    if (typeof finishDeath !== 'function')
        throw new TypeError('land mine requires the monster death handler');
    const options = {
        finishDeath, publish, random, rollOne, monsterName, describeMonster,
    };

    if (event.discoveredTrigger) {
        await publish(
            `A trigger appears in a pile of soil below ${monsterName(monster)}.`,
        );
    }
    if (!event.exploded) {
        event.finished = true;
        return event;
    }
    if (event.airborne && event.inSight) {
        await publish(
            `The air currents set ${event.alreadySeen ? 'a land mine' : 'it'} off!`,
        );
    } else if (event.inSight) {
        const blast = state.u?.deaf || state.deaf ? '' : 'KAABLAMM!!!  ';
        await publish(
            `${blast}${describeMonster(monster)} triggers ${
                event.trap.madeby_u ? 'your' : 'a'
            } land mine!`,
        );
    } else if (!state.u?.deaf && !state.deaf) {
        await publish('Kaablamm!  You hear an explosion in the distance!');
    }

    const pit = await blowUpLandMine(monster, event, state, options);
    if (monster.dead || (monster.mhp ?? 0) <= 0
        || !state.level?.monsters?.includes(monster)) {
        event.killed = !!monster.dead || (monster.mhp ?? 0) <= 0;
        event.finished = true;
        return event;
    }
    if (monster.mx !== event.trap.tx || monster.my !== event.trap.ty) {
        event.finished = true;
        return event;
    }

    monster.mhp = Math.max(0, (monster.mhp ?? 1) - event.damage);
    if (monster.mhp <= 0) {
        const died = await finishMineDeath(monster, event, options);
        if (died) {
            fillPitWithBoulderAt(event.trap.tx, event.trap.ty, state);
            event.finished = true;
            return event;
        }
    }
    await fallIntoMinePit(monster, pit, event, state, options);
    fillPitWithBoulderAt(event.trap.tx, event.trap.ty, state);
    event.killed = !!monster.dead || (monster.mhp ?? 0) <= 0;
    event.finished = true;
    return event;
}
