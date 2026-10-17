import { requirePlayingGame } from './gstate.js';
// Native zap.c:zappable()/learnwand(), shared by zapping and breaking wands.
import { plineWithContinuation } from './display.js';
import { game, requireLiveGame } from './gstate.js';
import { loseHeroHp } from './hero_damage.js';
import { useUpInventoryStack } from './hero_inventory.js';
import { learnObjectType, observeObject } from './object_knowledge.js';
import { definiteObjectAction } from './objnam.js';
import { d, rn2 } from './rng.js';
import { heroIsBlind } from './senses.js';
import { objectTypeKnown } from './shk.js';
export async function zappable(wand, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (wand.spe < 0 || (wand.spe === 0 && rn2(121) !== 0))
        return false;
    if (wand.spe === 0)
        await plineWithContinuation('You wrest one last charge from the worn-out wand.');
    wand.spe--;
    return true;
}
// Native backfire differs from a failed recharge: every wand uses d6 here.
export async function backfireWand(wand, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    wand.in_use = true;
    await plineWithContinuation(`${definiteObjectAction(wand, null, state)} suddenly explodes!`);
    const damage = d(wand.spe + 2, 6);
    const injury = state.u.halfPhysicalDamage ? Math.ceil(damage / 2) : damage;
    if (await loseHeroHp(injury, 'exploding wand', {
        state, deathCause: 'killed by an exploding wand',
    }))
        return;
    await useUpInventoryStack(wand, state);
}
export function learnWand(object, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (object.oclass === 10)
        return; // Spell pseudo-objects do not rediscover books.
    if (objectTypeKnown(object, state))
        observeObject(object, state);
    else {
        if (!heroIsBlind(state))
            observeObject(object, state);
        if (object.dknown)
            learnObjectType(object.otyp, state);
    }
}
//# sourceMappingURL=wand_charge.js.map