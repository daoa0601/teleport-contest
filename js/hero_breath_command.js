// The #monster breath command for a polymorphed hero.
// C refs: cmd.c domonability() and polyself.c dobreathe().

import { plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { heroBreathAttack, hitHeroWithBreath } from './hero_breath.js';
import { breatheInDirection } from './breath_ray.js';
import { d, rn2, rnd } from './rng.js';
import { promptDirection } from './tty_prompts.js';

export async function useHeroBreath({
    state = game,
    attack = heroBreathAttack(state),
    publish = plineWithContinuation,
    readDirection = promptDirection,
    finishMonsterKill,
    random = rn2,
    rollDice = d,
    rollOne = rnd,
} = {}) {
    if (!attack)
        return { used: false, spentTime: false, reason: 'no-breath' };

    const hero = state.u || (state.u = {});
    if (hero.strangled || (hero.strangledTurns ?? 0) > 0) {
        await publish("You can't breathe.  Sorry.");
        return { used: false, spentTime: false, reason: 'strangled' };
    }
    if ((hero.uen ?? 0) < 15) {
        await publish("You don't have enough energy to breathe!");
        return { used: false, spentTime: false, reason: 'energy' };
    }

    hero.uen -= 15;
    const direction = await readDirection();
    if (direction === null)
        return { used: false, spentTime: false, reason: 'cancelled' };

    const result = direction.key === '.'
        ? await hitHeroWithBreath({
            state, attack, publish, random, rollDice, rollOne,
        })
        : await breatheInDirection(direction.key, {
            state, attack, publish, finishMonsterKill,
            random, rollDice, rollOne,
        });
    return { ...result, spentTime: true };
}
