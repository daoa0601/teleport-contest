// C weapon.c:weapon_descr(). Describe the kind of weapon without knowledge,
// enchantment, material, or a personal name.
import { P_BOW, P_CROSSBOW, P_FLAIL, P_PICK_AXE, P_SLING } from './const.js';
import {
    BOULDER, CORPSE, DWARVISH_MATTOCK, EGG, FLINT, GRAPPLING_HOOK,
    LOADSTONE, LUCKSTONE, OBJECT_NAMES, OBJECT_SUBTYPE, ROCK, STATUE,
    TIN, TIN_OPENER, TOUCHSTONE, TOWEL, requireObjectData,
} from './object_data.js';
import { makeSingular } from './object_grammar.js';
import type { GameObject } from './object_types.js';
import { SKILL_NAMES } from './skills.js';
import { isAmmunition } from './weapon_type.js';

const CLASS_NAMES = [
    'strange object', 'strange object', 'weapon', 'armor', 'ring', 'amulet',
    'tool', 'food', 'potion', 'scroll', 'spellbook', 'wand', 'coin', 'gem',
    'large rock', 'iron ball', 'chain', 'venom',
];

export function weaponDescription(object: GameObject): string {
    const skill = [2, 6, 13].includes(object.oclass)
        ? Math.abs(requireObjectData(OBJECT_SUBTYPE, object.otyp)) : 0;
    let description = SKILL_NAMES[skill];
    if (skill === 0) {
        if ([CORPSE, TIN, EGG, STATUE, BOULDER, TOWEL, TIN_OPENER].includes(object.otyp))
            description = requireObjectData(OBJECT_NAMES, object.otyp) ?? undefined;
        else description = object.globby ? 'glob' : CLASS_NAMES[object.oclass];
    } else if (skill === P_SLING && isAmmunition(object)) {
        description = [ROCK, LUCKSTONE, LOADSTONE, TOUCHSTONE, FLINT].includes(object.otyp)
            ? 'stone' : object.oclass === 13 ? 'gem' : CLASS_NAMES[object.oclass];
    } else if (skill === P_BOW && isAmmunition(object)) description = 'arrow';
    else if (skill === P_CROSSBOW && isAmmunition(object)) description = 'bolt';
    else if (skill === P_FLAIL && object.otyp === GRAPPLING_HOOK) description = 'hook';
    else if (skill === P_PICK_AXE && object.otyp === DWARVISH_MATTOCK) description = 'mattock';
    if (!description) throw new Error(`No weapon description for object type ${object.otyp}`);
    return makeSingular(description);
}
