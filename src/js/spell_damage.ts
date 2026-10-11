import type { GameState } from './game_state.js';
// Spell damage bonuses and the hero's half-spell-damage protection.
// C refs: zap.c spell_damage_bonus() and youprop.h Half_spell_damage.

import { currentAttribute } from './attrib.js';
import { A_INT } from './const.js';
import { game } from './gstate.js';
import { heroHasCarriedArtifactFlag } from './artifacts.js';

// C youprop.h:Half_spell_damage, including carried artifact extrinsics.
export function heroHasHalfSpellDamage(state: GameState = game) {
    return !!(state.u?.halfSpellDamage
        || (state.u?.halfSpellDamageTurns ?? 0) > 0
        || heroHasCarriedArtifactFlag('SPFX_HSPDAM', state));
}

export function adjustSpellDamage(damage: number, state: GameState = game): number {
    const intelligence = currentAttribute(A_INT, state) ?? 10;
    const level = state.u?.ulevel ?? 1;
    if (intelligence <= 9)
        return damage > 1 ? Math.max(1, damage - 3) : damage;
    if (intelligence <= 13 || level < 5) return damage;
    if (intelligence <= 18) return damage + 1;
    if (intelligence <= 24 || level < 14) return damage + 2;
    return damage + 3;
}
