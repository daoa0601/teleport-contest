// The #monster breath command for a polymorphed hero.
// C refs: cmd.c domonability() and polyself.c dobreathe().

import type { HeroRayResult } from './hero_breath.js';
import type { NativeRayResult } from './ray_attack.js';
import type { MonsterAttack } from './data_types.js';
import type { MessagePublisher } from './display.js';
import type { GameState } from './game_state.js';
import { finishHeroMonsterKill } from './hero_monster_death.js';
import { plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import { heroBreathAttack, hitHeroWithRay } from './hero_breath.js';
import { breatheInDirection } from './breath_ray.js';
import { d, rn2, rnd } from './rng.js';
import { promptDirection } from './tty_prompts.js';

export interface HeroBreathOptions {
    state?: GameState;
    attack?: MonsterAttack | null;
    publish?: MessagePublisher;
    readDirection?: () => { key: string } | null | Promise<{ key: string } | null>;
    finishMonsterKill?: typeof finishHeroMonsterKill;
    random?: typeof rn2;
    rollDice?: typeof d;
    rollOne?: typeof rnd;
}

export type HeroBreathResult =
    | { used: false; spentTime: false; reason: 'no-breath' | 'strangled' | 'energy' | 'cancelled' }
    | ((HeroRayResult | NativeRayResult) & { spentTime: true });

export async function useHeroBreath({
    state = game,
    attack = heroBreathAttack(state),
    publish = plineWithContinuation,
    readDirection = promptDirection,
    finishMonsterKill = finishHeroMonsterKill,
    random = rn2,
    rollDice = d,
    rollOne = rnd,
}: HeroBreathOptions = {}): Promise<HeroBreathResult> {
    if (!attack)
        return { used: false, spentTime: false, reason: 'no-breath' };

    const hero = state.u;
    if (hero.strangled || (hero.strangledTurns ?? 0) > 0) {
        await publish("You can't breathe.  Sorry.");
        return { used: false, spentTime: false, reason: 'strangled' };
    }
    const energy = hero.uen ?? 0;
    if (energy < 15) {
        await publish("You don't have enough energy to breathe!");
        return { used: false, spentTime: false, reason: 'energy' };
    }

    hero.uen = energy - 15;
    const direction = await readDirection();
    if (direction === null)
        return { used: false, spentTime: false, reason: 'cancelled' };

    const result = direction.key === '.'
        ? await hitHeroWithRay({
            state, attack, publish, random, rollDice, rollOne,
        })
        : await breatheInDirection(direction.key, {
            state, attack, publish, finishMonsterKill,
            random, rollDice, rollOne,
        });
    return { ...result, spentTime: true };
}
