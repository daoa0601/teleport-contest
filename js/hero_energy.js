// Hero energy loss.
// C ref: trap.c drain_en().

import { rnd } from './rng.js';

export function drainHeroEnergy(
    state,
    amount,
    { maximumAlreadyDrained = false, rollOne = rnd } = {},
) {
    const hero = state.u;
    let punctuation = maximumAlreadyDrained ? '!' : '.';

    if ((hero.uenmax ?? 0) < 1) {
        hero.uen = 0;
        hero.uenmax = 0;
        return 'You feel momentarily lethargic.';
    }

    if (amount > ((hero.uen ?? 0) + hero.uenmax) / 3)
        amount = rollOne(amount);

    if (amount > (hero.uen ?? 0)) punctuation = '!';
    hero.uen = (hero.uen ?? 0) - amount;
    if (hero.uen < 0) {
        hero.uenmax = Math.max(0, hero.uenmax - rollOne(-hero.uen));
        hero.uen = 0;
    } else if (hero.uen > hero.uenmax) {
        hero.uen = hero.uenmax;
    }

    return `You feel your magical energy drain away${punctuation}`;
}
