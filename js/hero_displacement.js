// Native do_wear.c:toggle_displacement() for eating and timeout expiry.
import { formatFeltMessage } from './hero_speech.js';
import { heroIsDisplaced } from './armor.js';
import { TIMEOUT } from './const.js';
import { plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { heroIsInvisible } from './hero_invisibility.js';
import { hasWornProperty, propertyIsActive, refreshProperty } from './properties.js';
import { heroIsBlind } from './senses.js';
import { d } from './rng.js';
export async function gainCorpseDisplacement({ state = game } = {}) {
    if (!heroIsDisplaced(state))
        await announceDisplacementChange(true, state);
    state.u.displacedTurns = Math.min(TIMEOUT, (state.u.displacedTurns || 0) + d(6, 6));
    refreshProperty('displaced', state);
}
export async function advanceDisplacementTimeout(state = game) {
    const turns = state.u.displacedTurns;
    if (turns === undefined || turns <= 0)
        return;
    state.u.displacedTurns = turns - 1;
    if (state.u.displacedTurns)
        return;
    refreshProperty('displaced', state);
    if (!heroIsDisplaced(state))
        await announceDisplacementChange(false, state);
}
async function announceDisplacementChange(on, state) {
    const hero = state.u;
    const blind = heroIsBlind(state);
    const unseen = heroIsInvisible(state) && !propertyIsActive('seeInvisible', state);
    const seesSelf = !blind && !hero.uswallow && !unseen;
    const sensesMonsters = hasWornProperty('telepathy', state)
        || (hero.unblind_telepat_range ?? -1) >= 0
        || blind && propertyIsActive('telepathy', state)
        || (hero.monsterDetectionTurns ?? 0) > 0;
    if (hero.displacementBlocked || hero.displacedBlocked || !(seesSelf || sensesMonsters))
        return;
    await plineWithContinuation(formatFeltMessage(`that monsters${on ? '' : ' no longer'} have difficulty pinpointing your location.`, state));
}
//# sourceMappingURL=hero_displacement.js.map