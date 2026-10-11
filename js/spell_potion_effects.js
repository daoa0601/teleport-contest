// C spell.c potion group: casting owns the pseudo-object and its disposal.
import { game } from './gstate.js';
import { applyPotionEffect } from './potion_effects.js';
export async function applyPotionSpell(source, { state = game } = {}) {
    const effect = await applyPotionEffect(source, { state });
    return { result: effect.result > 0 ? 1 : 0, heroDied: effect.heroDied };
}
//# sourceMappingURL=spell_potion_effects.js.map