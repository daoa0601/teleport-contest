import { game } from './gstate.js';
import { P_ATTACK_SPELL, P_CLERIC_SPELL, P_DIVINATION_SPELL, P_ENCHANTMENT_SPELL, P_ESCAPE_SPELL, P_HEALING_SPELL, P_MATTER_SPELL, } from './const.js';
import { OBJECT_SUBTYPE, SPE_LIGHT } from './object_data.js';
export function spellSkillType(otyp, state = game) {
    // Native changes the object table for the current game. Keep the
    // generated metadata intact so a later non-Priest gets divination.
    if (otyp === SPE_LIGHT && state.urole?.key === 'priest')
        return P_CLERIC_SPELL;
    const subtype = OBJECT_SUBTYPE[otyp];
    if (subtype === undefined)
        throw new RangeError(`Unknown spell object type ${otyp}`);
    return subtype;
}
const SPELL_CATEGORIES = {
    [P_ATTACK_SPELL]: 'attack',
    [P_HEALING_SPELL]: 'healing',
    [P_DIVINATION_SPELL]: 'divination',
    [P_ENCHANTMENT_SPELL]: 'enchantment',
    [P_CLERIC_SPELL]: 'clerical',
    [P_ESCAPE_SPELL]: 'escape',
    [P_MATTER_SPELL]: 'matter',
};
export function spellCategory(otyp, state = game) {
    return SPELL_CATEGORIES[spellSkillType(otyp, state)];
}
//# sourceMappingURL=spell_school.js.map