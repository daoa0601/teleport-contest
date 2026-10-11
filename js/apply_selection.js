// Object suggestions for applying tools and other carried items.
// C ref: apply.c:apply_ok(). Selection itself still permits other inventory.
import { GETOBJ_DOWNPLAY, GETOBJ_EXCLUDE, GETOBJ_EXCLUDE_SELECTABLE, GETOBJ_SUGGEST, } from './const.js';
import { game } from './gstate.js';
import { BANANA, BULLWHIP, CREAM_PIE, EUCALYPTUS_LEAF, LUMP_OF_ROYAL_JELLY, POT_OIL, TOUCHSTONE, } from './object_data.js';
import { objectClassForType } from './object_knowledge.js';
import { isGrayStone } from './object_properties.js';
import { isAxe, isPick, isPolearm } from './weapon_type.js';
import { objectTypeKnown } from './shk.js';
import { heroIsHallucinating } from './senses.js';
const WEAPON_CLASS = 2, TOOL_CLASS = 6, POTION_CLASS = 8;
const SPBOOK_CLASS = 10, WAND_CLASS = 11, COIN_CLASS = 12, GEM_CLASS = 13;
export function applySuggestion(object, state = game) {
    if (!object)
        return GETOBJ_EXCLUDE;
    const kind = object.oclass || objectClassForType(object.otyp);
    if ([TOOL_CLASS, SPBOOK_CLASS, WAND_CLASS].includes(kind))
        return GETOBJ_SUGGEST;
    if (kind === COIN_CLASS)
        return GETOBJ_DOWNPLAY;
    if (kind === WEAPON_CLASS && (isPick(object) || isAxe(object)
        || isPolearm(object) || object.otyp === BULLWHIP))
        return GETOBJ_SUGGEST;
    if (kind === POTION_CLASS) {
        if (!object.dknown || !objectTypeKnown(object, state))
            return GETOBJ_DOWNPLAY;
        if (object.otyp === POT_OIL)
            return GETOBJ_SUGGEST;
    }
    if ([CREAM_PIE, EUCALYPTUS_LEAF, LUMP_OF_ROYAL_JELLY].includes(object.otyp))
        return GETOBJ_SUGGEST;
    if (object.otyp === BANANA && heroIsHallucinating(state))
        return GETOBJ_DOWNPLAY;
    if (isGrayStone(object)) {
        if (!object.dknown)
            return GETOBJ_SUGGEST;
        if (object.otyp !== TOUCHSTONE && (objectTypeKnown(object, state)
            || objectTypeKnown({ otyp: TOUCHSTONE, oclass: GEM_CLASS }, state)))
            return GETOBJ_EXCLUDE_SELECTABLE;
        return GETOBJ_SUGGEST;
    }
    return GETOBJ_EXCLUDE_SELECTABLE;
}
//# sourceMappingURL=apply_selection.js.map