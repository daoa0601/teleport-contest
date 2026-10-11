import type { GameObject } from './object_types.js';
import type { GameState } from './game_state.js';
// C spell.c potion group: casting owns the pseudo-object and its disposal.
import { game } from './gstate.js';
import { applyPotionEffect } from './potion_effects.js';

export async function applyPotionSpell(source: GameObject, { state = game }: { state?: GameState } = {}): Promise<{ result: 0 | 1; heroDied: boolean }> {
    const effect = await applyPotionEffect(source, { state });
    return { result: effect.result > 0 ? 1 : 0, heroDied: effect.heroDied };
}
