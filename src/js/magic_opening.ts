import type { GameState } from './game_state.js';
import { requirePlayingGame } from './gstate.js';
// C detect.c:openit()/openone(). Each opened feature keeps its normal owner.
import { monsterHasMapPosition } from './monster_location.js';
import { game, requireLiveGame } from './gstate.js';
import {
    BOLT_LIM, DOOR, SDOOR, SCORR, D_CLOSED, D_LOCKED, D_TRAPPED,
    D_NODOOR, D_ISOPEN, STATUE_TRAP, Is_airlevel, Is_waterlevel,
} from './const.js';
import { CHEST, LARGE_BOX } from './object_data.js';
import { monsterDigests } from './monster_data.js';
import { clearAreaCells, cansee, vision_note_blocker_change } from './vision.js';
import { newsym, plineWithContinuation } from './display.js';
import { heroIsBlind, heroIsDeaf } from './senses.js';
import { monsterName } from './monster_name.js';
import { expelHero } from './hero_expulsion.js';
import { revealSecretDoor, revealSecretCorridor } from './detect.js';
import { triggerBoobyTrap } from './booby_trap.js';
import { wakeMonstersNearWithMessages } from './monster_wake.js';
import { openHoldingTrap, openFallingTrap } from './trap_magic.js';
import { findDrawbridgeAt, openDrawbridge } from './dbridge.js';

export async function openit(state: GameState = game) {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (state.u.uswallow) {
        const engulfer = state.u.ustuck;
        if (!engulfer) throw new Error('Opening a swallowing monster requires its actor.');
        if (monsterDigests(engulfer)) await plineWithContinuation(
            heroIsBlind(state) ? 'Its mouth opens!'
                : `${monsterName(engulfer, { capitalized: true, state })} opens its mouth!`,
        );
        await expelHero(engulfer, { state });
        return -1;
    }
    let opened = 0;
    const cells = clearAreaCells(state.u.ux, state.u.uy, BOLT_LIM, {
        ignoreBlockers: Is_airlevel(state.u.uz) || Is_waterlevel(state.u.uz),
    });
    for (const { x, y } of cells) {
        for (const object of state.level.objects?.[x]?.[y] || []) {
            if ([CHEST, LARGE_BOX].includes(object.otyp) && object.olocked) {
                object.olocked = false;
                opened++;
            }
        }
        const location = state.level.requireAt(x, y);
        if (location.typ === SDOOR || (location.typ === DOOR
            && (location.doormask & (D_CLOSED | D_LOCKED)))) {
            revealSecretDoor(x, y);
            if (location.doormask & D_TRAPPED) {
                const dx = x - state.u.ux, dy = y - state.u.uy;
                if (dx * dx + dy * dy < 3) {
                    if (await triggerBoobyTrap('door', { state })) return opened;
                }
                else await plineWithContinuation(`You ${cansee(x, y) ? 'see'
                    : heroIsDeaf(state) ? 'feel the shock of' : 'hear'} an explosion!`, { noRepeat: true });
                await wakeMonstersNearWithMessages(x, y, 121, state);
                location.doormask = D_NODOOR;
            } else location.doormask = D_ISOPEN;
            vision_note_blocker_change(x, y);
            newsym(x, y);
            opened++;
        } else if (location.typ === SCORR) {
            revealSecretCorridor(x, y);
            newsym(x, y);
            opened++;
        } else {
            const trap = state.level.traps.find(t => t.tx === x && t.ty === y);
            if (trap) {
                if (!trap.tseen && trap.ttyp !== STATUE_TRAP) {
                    trap.tseen = true;
                    newsym(x, y);
                    opened++;
                }
                const target = x === state.u.ux && y === state.u.uy ? state.u
                    : state.level.monsters.find(m => monsterHasMapPosition(m, state) && m.mx === x && m.my === y && m.mhp > 0);
                const holding = await openHoldingTrap(target, { state });
                if (holding.changed || (await openFallingTrap(target, {
                    state, trapdoorOnly: true,
                })).changed) opened++;
            } else {
                const bridge = findDrawbridgeAt(x, y, state);
                if (bridge) {
                    await openDrawbridge(bridge.x, bridge.y, state);
                    opened++;
                }
            }
        }
        if (state.program_state.gameover) break;
    }
    return opened;
}
