// Effects shared by hero- and monster-triggered land mines.
// C ref: trap.c:blow_up_landmine().
import { deleteTrap } from './trap_lifecycle.js';
import { D_BROKEN, IS_DOOR, Is_airlevel, Is_waterlevel, LAVAPOOL, PIT, ROOM, } from './const.js';
import { newsym, plineWithContinuation } from './display.js';
import { game, requireGameLevel } from './gstate.js';
import { liquidForHole } from './hole.js';
import { fillPitWithBoulderAt } from './pit_fill.js';
import { wakeMonstersNear } from './monster_wake.js';
import { rn2, rnd } from './rng.js';
import { scatterFloorObjects } from './scatter.js';
import { destroyLavaFloorObjects, waterDamageChain } from './trap.js';
import { vision_note_blocker_change } from './vision.js';
function levelHasNoPits(state) {
    return Is_airlevel(state.u?.uz) || Is_waterlevel(state.u?.uz);
}
function removeEngravingAt(state, x, y) {
    const level = requireGameLevel(state);
    level.engravings = (level.engravings || []).filter(engraving => engraving.x !== x || engraving.y !== y);
}
async function destroyDrawbridgeAt(x, y, state, options) {
    const { destroyDrawbridge, findDrawbridgeAt } = await import('./dbridge.js');
    const bridge = findDrawbridgeAt(x, y, state);
    if (!bridge)
        return false;
    const finishMonsterKill = options.finishMonsterKill;
    return destroyDrawbridge(bridge.x, bridge.y, state, finishMonsterKill ? { finishMonsterKill } : {});
}
async function fillMineHoleWithLiquid(x, y, trap, liquid, state, options) {
    deleteTrap(trap, state);
    const location = requireGameLevel(state).at(x, y);
    if (!location)
        throw new Error(`Land mine has no terrain at (${x}, ${y})`);
    location.typ = liquid;
    location.flags = 0;
    const pile = state.level?.objects?.[x]?.[y] || [];
    if (liquid === LAVAPOOL) {
        await destroyLavaFloorObjects(pile, {
            publish: options.publish,
            random: options.random,
            visible: options.seeSquare,
        });
    }
    else {
        const messages = [];
        await waterDamageChain(pile, messages, state);
        if (options.seeSquare) {
            for (const message of messages)
                await options.publish(message);
        }
    }
    const effect = await options.resolveLiquid?.(liquid);
    if ((effect && 'died' in effect && effect.died) || state.program_state?.gameover)
        return;
    newsym(x, y);
}
export async function explodeLandMine(trap, state = game, { publish = plineWithContinuation, random = rn2, rollOne = rnd, seeSquare = false, heroCaused = false, finishMonsterDeath = null, finishMonsterKill = null, resolveLiquid = null, } = {}) {
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
    if (state.program_state.gameover)
        return null;
    removeEngravingAt(state, x, y);
    wakeMonstersNear(x, y, 400, state);
    const location = state.level?.at?.(x, y);
    if (location && IS_DOOR(location.typ))
        location.doormask = D_BROKEN;
    await destroyDrawbridgeAt(x, y, state, options);
    if (state.program_state?.gameover)
        return null;
    const survivingTrap = state.level?.traps?.find(candidate => candidate.tx === x && candidate.ty === y) || null;
    if (!survivingTrap)
        return null;
    if (levelHasNoPits(state)) {
        deleteTrap(survivingTrap, state);
        return null;
    }
    const liquid = liquidForHole(x, y, state, { random });
    if (liquid !== ROOM) {
        await fillMineHoleWithLiquid(x, y, survivingTrap, liquid, state, options);
        return null;
    }
    survivingTrap.ttyp = PIT;
    survivingTrap.madeby_u = false;
    survivingTrap.tseen = true;
    await fillPitWithBoulderAt(x, y, state, { publish });
    vision_note_blocker_change(x, y);
    newsym(x, y);
    return state.level?.traps?.includes(survivingTrap)
        ? survivingTrap : null;
}
//# sourceMappingURL=landmine_explosion.js.map