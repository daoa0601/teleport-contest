// Magic portals under the hero.
// C ref: teleport.c domagicportal().
import { In_endgame } from './const.js';
import { plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { bringLeashedFollowers } from './teleport.js';
function dungeonName(level) {
    return level ? game.dungeons[level.dnum]?.dname ?? '' : '';
}
function isTutorialLevel(level) {
    return dungeonName(level) === 'The Tutorial';
}
function addPortalStun() {
    const hero = game.u;
    const alreadyStunned = !!(hero.stunned
        || (hero.stunnedTurns ?? 0) > 0);
    hero.stunnedTurns = (hero.stunnedTurns ?? 0) + 3;
    hero.stunned = true;
    return alreadyStunned ? 'You feel dizzier.' : 'You feel slightly dizzy.';
}
export async function activateMagicPortal(trap, gotoLevel) {
    if (!await bringLeashedFollowers()) {
        await plineWithContinuation('You shudder for a moment.');
        return true;
    }
    await plineWithContinuation('You activated a magic portal!');
    if (In_endgame(game.u?.uz) && !game.u?.uhave?.amulet) {
        await plineWithContinuation('You feel dizzy for a moment, but nothing happens...');
        return true;
    }
    if (typeof gotoLevel !== 'function')
        throw new Error('magic portal needs the level-change function');
    if (!trap.dst)
        throw new Error('Magic portal has no destination.');
    const leavingTutorial = isTutorialLevel(game.u?.uz)
        && !isTutorialLevel(trap.dst);
    await gotoLevel(trap.dst, {
        arrival: leavingTutorial ? 'stairs' : 'portal',
        postMessage: leavingTutorial
            ? 'Resuming regular play.' : addPortalStun(),
    });
    game.context.move = 1;
    return true;
}
//# sourceMappingURL=magic_portal.js.map