// Magic portals under the hero.
// C ref: teleport.c domagicportal().
import { formatFeltMessage } from './hero_speech.js';
import { In_endgame } from './const.js';
import { plineWithContinuation } from './display.js';
import { game, requirePlayingGame } from './gstate.js';
import { makeStunned } from './hero_mental_status.js';
import { scheduleLevelChange } from './level_change.js';
import { bringLeashedFollowers } from './teleport.js';
function dungeonName(level) {
    return level ? game.dungeons[level.dnum]?.dname ?? '' : '';
}
function isTutorialLevel(level) {
    return dungeonName(level) === 'The Tutorial';
}
async function addPortalStun() {
    const hero = game.u;
    const alreadyStunned = !!(hero.stunned
        || (hero.stunnedTurns ?? 0) > 0);
    await makeStunned((hero.stunnedTurns ?? 0) + 3, { talk: false });
    return alreadyStunned ? 'You feel dizzier.' : 'You feel slightly dizzy.';
}
export async function activateMagicPortal(trap, gotoLevel) {
    requirePlayingGame(game);
    if (!await bringLeashedFollowers()) {
        await plineWithContinuation('You shudder for a moment.');
        return;
    }
    const { uz, uz0 } = game.u;
    if (uz0 && (uz.dnum !== uz0.dnum || uz.dlevel !== uz0.dlevel))
        return;
    await plineWithContinuation('You activated a magic portal!');
    if (In_endgame(game.u?.uz) && !game.u?.uhave?.amulet) {
        await plineWithContinuation(formatFeltMessage('dizzy for a moment, but nothing happens...'));
        return;
    }
    if (typeof gotoLevel !== 'function')
        throw new Error('magic portal needs the level-change function');
    if (!trap.dst)
        throw new Error('Magic portal has no destination.');
    const leavingTutorial = isTutorialLevel(game.u?.uz)
        && !isTutorialLevel(trap.dst);
    // domove() still needs the departure level to wear its engravings.
    // deferred_goto() prints dizziness after that movement tail finishes.
    const preMessage = leavingTutorial ? 'Resuming regular play.' : await addPortalStun();
    scheduleLevelChange([trap.dst, {
            arrival: leavingTutorial ? 'stairs' : 'portal',
        }], gotoLevel, preMessage);
    game.context.move = 1;
}
//# sourceMappingURL=magic_portal.js.map