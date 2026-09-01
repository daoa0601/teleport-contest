// Intelligence and experience adjust direct spell damage.
// C ref: zap.c spell_damage_bonus().

import { currentAttribute } from './attrib.js';
import { A_INT } from './const.js';
import { game } from './gstate.js';

export function adjustSpellDamage(damage, state = game) {
    const intelligence = currentAttribute(A_INT, state) ?? 10;
    const level = state.u?.ulevel ?? 1;
    if (intelligence <= 9)
        return damage > 1 ? Math.max(1, damage - 3) : damage;
    if (intelligence <= 13 || level < 5) return damage;
    if (intelligence <= 18) return damage + 1;
    if (intelligence <= 24 || level < 14) return damage + 2;
    return damage + 3;
}
