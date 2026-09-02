// Effects shared by hero- and monster-triggered land mines.
// C ref: trap.c:blow_up_landmine().

import {
    D_BROKEN, IS_DOOR, Is_airlevel, Is_waterlevel,
    LAVAPOOL, PIT, ROOM,
} from './const.js';
import { newsym } from './display.js';
import { game } from './gstate.js';
import { liquidForHole } from './hole.js';
import { fillPitWithBoulderAt } from './mklev.js';
import { wakeMonstersNear } from './mon.js';
import { rn2, rnd } from './rng.js';
import { scatterFloorObjects } from './scatter.js';
import { destroyLavaFloorObjects, waterDamageChain } from './trap.js';
import { vision_note_blocker_change } from './vision.js';

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

async function destroyDrawbridgeAt(x, y, state, options) {
    const { destroyDrawbridge, findDrawbridgeAt } = await import('./dbridge.js');
    const bridge = findDrawbridgeAt(x, y, state);
    if (!bridge) return false;
    const finishMonsterKill = options.finishMonsterKill
        || (options.finishMonsterDeath
            ? async (monster, _x, _y, death) => {
                const result = await options.finishMonsterDeath(monster, {
                    noCorpse: death.noCorpse,
                    visible: false,
                    spotted: false,
                    random: options.random,
                    publish: options.publish,
                });
                return !result.survived;
            }
            : null);
    return destroyDrawbridge(bridge.x, bridge.y, state,
        finishMonsterKill ? { finishMonsterKill } : {});
}

async function fillMineHoleWithLiquid(
    x, y, trap, liquid, state, options,
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
    await options.resolveLiquid?.(liquid);
    newsym(x, y);
}

export async function explodeLandMine(
    trap,
    state = game,
    {
        publish = async () => {},
        random = rn2,
        rollOne = rnd,
        seeSquare = false,
        heroCaused = false,
        finishMonsterDeath = null,
        finishMonsterKill = null,
        resolveLiquid = null,
    } = {},
) {
    const x = trap.tx;
    const y = trap.ty;
    const options = {
        publish,
        random,
        rollOne,
        seeSquare,
        heroCaused,
        finishMonsterDeath,
        finishMonsterKill,
        resolveLiquid,
    };
    await scatterFloorObjects(x, y, 4, {
        state,
        publish,
        random,
        rollOne,
        heroCaused,
        finishMonsterDeath,
        finishMonsterKill,
    });
    removeEngravingAt(state, x, y);
    wakeMonstersNear(x, y, 400, state);

    const location = state.level?.at?.(x, y);
    if (location && IS_DOOR(location.typ)) location.doormask = D_BROKEN;
    await destroyDrawbridgeAt(x, y, state, options);

    const survivingTrap = state.level?.traps?.find(candidate =>
        candidate.tx === x && candidate.ty === y) || null;
    if (!survivingTrap) return null;
    if (levelHasNoPits(state)) {
        removeTrap(state, survivingTrap);
        return null;
    }

    const liquid = liquidForHole(x, y, state, { random });
    if (liquid !== ROOM) {
        await fillMineHoleWithLiquid(
            x, y, survivingTrap, liquid, state, options,
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
