// The #monster breath command for a polymorphed hero.
// C refs: cmd.c domonability() and polyself.c dobreathe().

import { plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { heroBreathAttack, hitHeroWithBreath } from './hero_breath.js';
import { breatheInDirection } from './hero_breath_ray.js';
import { d, rn2, rnd } from './rng.js';
import { promptKey } from './tty_prompts.js';

const VALID_DIRECTIONS = new Set('hjklyubn.<>');

export async function useHeroBreath({
    state = game,
    attack = heroBreathAttack(state),
    publish = plineWithContinuation,
    readKey = promptKey,
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
    const direction = await readBreathDirection(readKey);
    if (direction === null)
        return { used: false, spentTime: false, reason: 'cancelled' };

    const result = direction === '.'
        ? await hitHeroWithBreath({
            state, attack, publish, random, rollDice, rollOne,
        })
        : await breatheInDirection(direction, {
            state, attack, publish, finishMonsterKill,
            random, rollDice, rollOne,
        });
    return { ...result, spentTime: true };
}

async function readBreathDirection(readKey) {
    for (;;) {
        const key = await readKey('In what direction? ');
        if (key === 27) return null;
        const direction = typeof key === 'number'
            ? String.fromCharCode(key).toLowerCase()
            : String(key).toLowerCase();
        if (VALID_DIRECTIONS.has(direction)) return direction;
    }
}
