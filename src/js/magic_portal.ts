// Magic portals under the hero.
// C ref: teleport.c domagicportal().

import { In_endgame } from './const.js';
import { plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { makeStunned } from './hero_mental_status.js';
import type { DungeonLocation } from './dungeon_types.js';
import type { Trap } from './map_types.js';
import type { gotoLevel as changeLevel } from './level_change.js';
import { bringLeashedFollowers } from './teleport.js';

function dungeonName(level: DungeonLocation | undefined) {
    return level ? game.dungeons[level.dnum]?.dname ?? '' : '';
}

function isTutorialLevel(level: DungeonLocation | undefined) {
    return dungeonName(level) === 'The Tutorial';
}

async function addPortalStun() {
    const hero = game.u;
    const alreadyStunned = !!(hero.stunned
        || (hero.stunnedTurns ?? 0) > 0);
    await makeStunned((hero.stunnedTurns ?? 0) + 3, { talk: false });
    return alreadyStunned ? 'You feel dizzier.' : 'You feel slightly dizzy.';
}

export async function activateMagicPortal(
    trap: Trap, gotoLevel: ((...args: Parameters<typeof changeLevel>) => unknown) | null | undefined,
): Promise<boolean> {
    if (!await bringLeashedFollowers()) {
        await plineWithContinuation('You shudder for a moment.');
        return true;
    }

    await plineWithContinuation('You activated a magic portal!');
    if (In_endgame(game.u?.uz) && !game.u?.uhave?.amulet) {
        await plineWithContinuation(
            'You feel dizzy for a moment, but nothing happens...',
        );
        return true;
    }
    if (typeof gotoLevel !== 'function')
        throw new Error('magic portal needs the level-change function');

    if (!trap.dst) throw new Error('Magic portal has no destination.');
    const leavingTutorial = isTutorialLevel(game.u?.uz)
        && !isTutorialLevel(trap.dst);
    // domagicportal() schedules this as deferred_goto()'s pre-message. Its
    // pline flushes the activation before any destination generation.
    const preMessage = leavingTutorial ? 'Resuming regular play.' : await addPortalStun();
    await plineWithContinuation(preMessage);
    await gotoLevel(trap.dst, {
        arrival: leavingTutorial ? 'stairs' : 'portal',
    });
    game.context.move = 1;
    return true;
}
