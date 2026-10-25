// Magic portals under the hero.
// C ref: teleport.c domagicportal().

import { formatFeltMessage } from './hero_speech.js';
import { In_endgame, TT_BURIEDBALL } from './const.js';
import { plineWithContinuation } from './display.js';
import { game, requirePlayingGame } from './gstate.js';
import { makeStunned } from './hero_mental_status.js';
import { buriedBallToPunishment } from './buried_object.js';
import type { DungeonLocation } from './dungeon_types.js';
import type { Trap } from './map_types.js';
import type { gotoLevel as changeLevel } from './level_change.js';
import { scheduleLevelChange } from './level_change.js';
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
    trap: Trap, gotoLevel: typeof changeLevel | null | undefined,
): Promise<void> {
    requirePlayingGame(game);
    if (!await bringLeashedFollowers()) {
        await plineWithContinuation('You shudder for a moment.');
        return;
    }
    // C teleport.c:domagicportal(): a buried ball surfaces before the
    // leashed-follower check, even when the portal attempt then shudders.
    if (game.u.utrap && game.u.utraptype === TT_BURIEDBALL)
        await buriedBallToPunishment(game);

    const { uz, uz0 } = game.u;
    if (uz0 && (uz.dnum !== uz0.dnum || uz.dlevel !== uz0.dlevel)) return;

    await plineWithContinuation('You activated a magic portal!');
    if (In_endgame(game.u?.uz) && !game.u?.uhave?.amulet) {
        await plineWithContinuation(
            formatFeltMessage('dizzy for a moment, but nothing happens...'),
        );
        return;
    }
    if (!trap.dst) throw new Error('Magic portal has no destination.');
    const leavingTutorial = isTutorialLevel(game.u?.uz)
        && !isTutorialLevel(trap.dst);
    // C schedule_goto(): every entry, including a knockback hurtle, defers
    // the real level change. domove() still needs the departure level to
    // wear its engravings.
    // deferred_goto() prints dizziness after that movement tail finishes.
    const preMessage = leavingTutorial ? 'Resuming regular play.' : await addPortalStun();
    scheduleLevelChange([trap.dst, {
        arrival: leavingTutorial ? 'stairs' : 'portal',
    }], gotoLevel ?? undefined, preMessage);
    game.context.move = 1;
}
