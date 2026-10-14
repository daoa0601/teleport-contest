// C mkobj.c:mksobj(): zeroobj, identity, age, and unknow_object().
// Identity allocation belongs to the caller; initializing these fields draws
// no random numbers and does not run class-specific creation effects.
import {
    ELVEN_SHIELD, ORCISH_SHIELD, SHIELD_OF_REFLECTION, getObjectDefinition,
    GLOB_OF_GRAY_OOZE, GLOB_OF_BLACK_PUDDING,
} from './object_data.js';
import type { GameObject } from './object_types.js';

const DESCRIPTION_UNKNOWN_CLASSES = new Set([
    2, // weapons
    4, // rings
    6, // tools
    8, // potions
    9, // scrolls
    10, // spellbooks
    11, // wands
    13, // gems
    17, // venom
]);

export function createObjectBase(
    otyp: number, objectId: number, currentTurn: number,
): GameObject {
    const definition = getObjectDefinition(otyp);
    const oclass = definition.oclass;
    const pudding = otyp >= GLOB_OF_GRAY_OOZE && otyp <= GLOB_OF_BLACK_PUDDING;
    const dknown = pudding || !DESCRIPTION_UNKNOWN_CLASSES.has(oclass)
        && !(otyp >= ELVEN_SHIELD && otyp <= ORCISH_SHIELD)
        && otyp !== SHIELD_OF_REFLECTION && !definition.merge;
    return {
        otyp,
        oclass,
        o_id: objectId,
        ox: 0,
        oy: 0,
        quan: 1,
        where: 'free',
        age: Math.max(currentTurn, 1),
        owt: definition.weight,
        dknown,
        known: !definition.usesKnown,
        cursed: false,
        blessed: false,
        olocked: false,
        spe: 0,
        recharged: 0,
        artifact: false,
    };
}
