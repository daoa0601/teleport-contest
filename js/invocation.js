// The vibrating square at the invocation position.
// C refs: hack.c invocation_message() and trap.c
// trapeffect_vibrating_square().
import { formatFeltMessage } from './hero_speech.js';
import { heroFootName } from './body_parts.js';
import { plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { heroIsOnStairs, isInvocationPosition } from './invocation_position.js';
import { monsterTypeName } from './monster_data.js';
import { makePlural } from './object_grammar.js';
import { CANDELABRUM_OF_INVOCATION, OBJECT_NAMES, } from './object_data.js';
import { stopRun } from './runmode.js';
function heroPositionDescription() {
    const steed = game.u?.usteed;
    if (steed) {
        const name = steed.name
            || `your ${monsterTypeName(steed.mnum, !!steed.female)}`;
        return `beneath ${name}`;
    }
    if (game.u.levitating || game.u.flying)
        return 'beneath you';
    return `under your ${makePlural(heroFootName())}`;
}
function carriedCandelabrum() {
    return (game.inventory || []).find(object => object.otyp === CANDELABRUM_OF_INVOCATION);
}
export async function announceInvocationSquare() {
    if (!isInvocationPosition(game.u?.ux, game.u?.uy)
        || heroIsOnStairs())
        return false;
    stopRun();
    await plineWithContinuation(formatFeltMessage(`a strange vibration ${heroPositionDescription()}.`));
    if (!game.u.uevent)
        game.u.uevent = {};
    game.u.uevent.uvibrated = 1;
    const candelabrum = carriedCandelabrum();
    if (candelabrum?.spe === 7 && candelabrum.lamplit) {
        const name = OBJECT_NAMES[candelabrum.otyp]
            || 'Candelabrum of Invocation';
        await plineWithContinuation(`The ${name} ${game.blind ? 'throbs palpably'
            : 'glows with a strange light'}!`);
    }
    return true;
}
//# sourceMappingURL=invocation.js.map