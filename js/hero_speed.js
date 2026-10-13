// Native potion.c:speed_up() and mhitu.c:u_slow_down().
import { exerciseAttribute } from './attrib.js';
import { heroLegName } from './body_parts.js';
import { A_DEX } from './const.js';
import { plineWithContinuation } from './display.js';
import { game, requireLiveGame } from './gstate.js';
import { makePlural } from './object_grammar.js';
import { hasPermanentIntrinsicProperty, propertyTimeout, removeIntrinsicProperty, setPropertyTimeout, } from './properties.js';
export function heroHasRemovableSpeed(state = game) {
    return propertyTimeout('fast', state) > 0
        || hasPermanentIntrinsicProperty('fast', state);
}
export async function speedUpHero(duration, state = game) {
    requireLiveGame(state);
    const hero = state.u;
    if (!hero.veryFast) {
        const alreadyFast = hero.fast || hero.veryFastFromArmor;
        await plineWithContinuation(`You are suddenly moving ${alreadyFast ? '' : 'much '}faster.`);
    }
    else {
        await plineWithContinuation(`Your ${makePlural(heroLegName(state))} get new energy.`);
    }
    await exerciseAttribute(A_DEX, true, state);
    setPropertyTimeout('fast', propertyTimeout('fast', state) + duration, state);
}
export async function slowHero(state = game, publish = plineWithContinuation) {
    requireLiveGame(state);
    setPropertyTimeout('fast', 0, state);
    removeIntrinsicProperty('fast', state);
    await publish(state.u.fast || state.u.veryFast
        ? 'Your quickness feels less natural.' : 'You slow down.');
    await exerciseAttribute(A_DEX, false, state);
}
//# sourceMappingURL=hero_speed.js.map