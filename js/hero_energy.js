// Hero energy loss.
// C ref: trap.c drain_en().
import { formatFeltMessage } from './hero_speech.js';
import { rnd } from './rng.js';
export function drainHeroEnergy(state, amount, { maximumAlreadyDrained = false, rollOne = rnd } = {}) {
    const hero = state.u;
    let punctuation = maximumAlreadyDrained ? '!' : '.';
    const maximum = hero.uenmax ?? 0;
    if (maximum < 1) {
        if (hero.uen || maximum) {
            hero.uen = 0;
            hero.uenmax = 0;
            state.context.botl = true;
        }
        return formatFeltMessage('momentarily lethargic.', state);
    }
    if (amount > ((hero.uen ?? 0) + maximum) / 3)
        amount = rollOne(amount);
    if (amount > (hero.uen ?? 0))
        punctuation = '!';
    hero.uen = (hero.uen ?? 0) - amount;
    if (hero.uen < 0) {
        hero.uenmax = Math.max(0, maximum - rollOne(-hero.uen));
        hero.uen = 0;
    }
    else if (hero.uen > maximum) {
        hero.uen = maximum;
    }
    state.context.botl = true;
    return formatFeltMessage(`your magical energy drain away${punctuation}`, state);
}
//# sourceMappingURL=hero_energy.js.map