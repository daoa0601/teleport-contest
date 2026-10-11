// Native mthrowu.c:thrwmm(). A weapon change spends the slot without a hit.
import { M_ATTK_HIT, M_ATTK_MISS } from './const.js';
import { throwMonsterWeaponAtMonster } from './monster_throw.js';
import type { GameState } from './game_state.js';
import type { Monster } from './monster_types.js';
import type { MessagePublisher } from './display.js';
import type { rn2, rnd } from './rng.js';

export async function resolveMonsterCombatThrow(source: Monster, target: Monster, {
    state, random, rollOne, publish,
}: { state: GameState; random?: typeof rn2; rollOne?: typeof rnd; publish?: MessagePublisher }): Promise<{
    nativeResult: number; heroDied: boolean;
}> {
    const volley = await throwMonsterWeaponAtMonster(source, target, state, {
        ...(random ? { random } : {}), ...(rollOne ? { rollOne } : {}), ...(publish ? { publish } : {}),
    });
    return {
        nativeResult: volley?.madeAttack ? M_ATTK_HIT : M_ATTK_MISS,
        heroDied: volley?.heroDied ?? false,
    };
}
