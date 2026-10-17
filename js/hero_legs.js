// Wounded legs affect temporary Dexterity, carrying capacity, and recovery.
// C do.c:set_wounded_legs()/heal_legs(). Mounted wounds belong to the steed.
import { requireHeroAttributes } from './hero_types.js';
import { A_DEX } from './const.js';
import { heroLegName } from './body_parts.js';
import { plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { makePlural } from './object_grammar.js';
import { reportHeroEncumbrance } from './encumbrance.js';
export async function healHeroLegs(state = game, { cause = 'healing', publish = plineWithContinuation, } = {}) {
    const hero = state.u;
    if (!((hero._woundedLegTurns ?? 0) > 0) && !hero._woundedLegSide)
        return false;
    state.context.botl = true;
    const temporary = hero.atemp;
    if (temporary && temporary.a[A_DEX] < 0)
        temporary.a[A_DEX]++;
    if (!hero.usteed && cause !== 'petrification') {
        const both = hero._woundedLegSide === 'both';
        const leg = heroLegName(state);
        await publish(`Your ${both ? makePlural(leg) : leg} ${both ? 'feel' : 'feels'} better.`);
    }
    hero._woundedLegTurns = 0;
    hero._woundedLegSide = null;
    if (cause === 'healing')
        await reportHeroEncumbrance(state, publish);
    return true;
}
export async function woundHeroLegs(side, turns, state = game, { publish = plineWithContinuation, } = {}) {
    const hero = state.u;
    state.context.botl = true;
    if (!((hero._woundedLegTurns ?? 0) > 0) && !hero._woundedLegSide)
        requireHeroAttributes(hero).atemp.a[A_DEX]--;
    hero._woundedLegTurns = Math.max(hero._woundedLegTurns || 0, turns);
    if (!hero._woundedLegSide)
        hero._woundedLegSide = side;
    else if (hero._woundedLegSide !== side)
        hero._woundedLegSide = 'both';
    await reportHeroEncumbrance(state, publish);
}
//# sourceMappingURL=hero_legs.js.map