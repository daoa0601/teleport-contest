import { NON_PM, ismnum } from './const.js';
import { CORPSE, FIGURINE, LOADSTONE, OBJECT_NAMES, STATUE } from './object_data.js';
import { isSavedRecord } from './saved_graph.js';
import { validSavedSpeciesOrNone } from './species_validation.js';
import { arrayOf, boolean, closedFieldsMatch, integer, nullable, optional, string, validateSavedEntity, } from './saved_validation.js';
function oneOf(...values) {
    return (value) => values.some((candidate) => candidate === value);
}
const objectWhere = oneOf('free', 'inventory', 'floor', 'contained', 'minvent', 'buried', 'onbill', 'migrating', 'gone');
const timerKind = oneOf('rot-organic', 'rot-corpse', 'revive-mon', 'zombify-mon', 'burn-object', 'hatch-egg', 'shrink-glob', 'fig-transform');
const wornSlot = oneOf('uarm', 'uarmc', 'uarmf', 'uarmg', 'uarmh', 'uarms', 'uarmu', 'uskin', 'uamul', 'ublindf', 'left-ring', 'right-ring', 'helmet');
const lostReason = oneOf(0, 1, 2, 3, 4);
const objectBit = (value) => typeof value === 'boolean' || value === 0 || value === 1;
// Native object indices include STRANGE_OBJECT (0) and unnamed appearances.
const objectType = (value) => integer(value) && value >= 0 && value < OBJECT_NAMES.length;
function validTimer(value) {
    return closedFieldsMatch(value, {
        kind: timerKind,
        deadline: integer,
        id: integer,
    });
}
function validMigration(value) {
    const location = (entry) => closedFieldsMatch(entry, { dnum: integer, dlevel: integer });
    return closedFieldsMatch(value, {
        source: location,
        destination: location,
        arrival: integer,
    });
}
function validLevitationState(value) {
    return closedFieldsMatch(value, {
        hasSource: boolean,
        active: boolean,
        blockedByTerrain: boolean,
        blockedByTrap: boolean,
        flying: boolean,
        flyingBlocked: boolean,
    });
}
export function validSavedObject(value, context) {
    const checkedContents = context.acyclicObjectContents ??= new WeakSet();
    if (!contentsAreAcyclic(value, checkedContents, new WeakSet())) {
        context.failure ??= 'object contents contain a cycle';
        return false;
    }
    // Native getobj()/canletgo() reuse corpsenm for a loadstone stack's
    // selected quantity. Unlike a species, that count can exceed NUMMONS.
    const corpseSpecies = isSavedRecord(value) && value.otyp === LOADSTONE
        ? (entry) => entry === NON_PM || integer(entry) && entry >= 0
        : validSavedSpeciesOrNone;
    // mksobj() assigns bodies a real species even with initialization off.
    const needsBodySpecies = isSavedRecord(value)
        && (value.otyp === CORPSE || value.otyp === STATUE || value.otyp === FIGURINE);
    const extra = (entry) => closedFieldsMatch(entry, {
        oname: optional(nullable(string)),
        omid: optional(integer),
        omonst: optional(nullable(context.savedMonster)),
    });
    return validateSavedEntity(value, 'object', context, {
        otyp: objectType,
        oclass: integer,
        o_id: integer,
        ox: integer,
        oy: integer,
        quan: integer,
        where: objectWhere,
        age: integer,
        owt: integer,
        spe: integer,
        recharged: integer,
        dknown: boolean,
        known: boolean,
        blessed: boolean,
        cursed: boolean,
        olocked: boolean,
        artifact: boolean,
        contents: optional(arrayOf(context.object)),
        container: optional(nullable(context.object)),
        ocarry: optional(nullable(context.monster)),
        carrierMid: optional(nullable(integer)),
        buried: optional(boolean),
        migration: optional(validMigration),
        _fobjOrder: optional(integer),
        lua_ref_cnt: optional(integer),
        oextra: optional(nullable(extra)),
        oartifact: optional(integer),
        oname: optional(string),
        omid: optional(integer),
        corpsenm: needsBodySpecies ? ismnum : optional(corpseSpecies),
        novelidx: optional(integer),
        spestudied: optional(integer),
        leashmon: optional(integer),
        oeaten: optional(integer),
        globby: optional(boolean),
        norevive: optional(boolean),
        on_ice: optional(boolean),
        ageRelative: optional(boolean),
        objectTimers: optional(arrayOf(validTimer)),
        timed: optional(integer),
        lamplit: optional(objectBit),
        ghostly: optional(boolean),
        bknown: optional(boolean),
        rknown: optional(boolean),
        cknown: optional(boolean),
        lknown: optional(boolean),
        tknown: optional(boolean),
        unpaid: optional(boolean),
        no_charge: optional(boolean),
        otrapped: optional(objectBit),
        obroken: optional(boolean),
        oeroded: optional(integer),
        oeroded2: optional(integer),
        oerodeproof: optional(boolean),
        greased: optional(boolean),
        opoisoned: optional(objectBit),
        odiluted: optional(objectBit),
        orotten: optional(boolean),
        degraded_horn: optional(integer),
        nomerge: optional(boolean),
        bypass: optional(boolean),
        how_lost: optional(lostReason),
        pickup_prev: optional(boolean),
        in_use: optional(boolean),
        wishedfor: optional(boolean),
        fromsink: optional(boolean),
        achievement: optional(boolean),
        questArtifact: optional(boolean),
        destroyed: optional(boolean),
        owornmask: optional(integer),
        worn: optional(boolean),
        wornSlot: optional(nullable(wornSlot)),
        wielded: optional(boolean),
        alternate: optional(boolean),
        ready: optional(boolean),
        _armorApplied: optional(boolean),
        _levitationBeforeWear: optional(validLevitationState),
        _displacementWasActive: optional(boolean),
        _speedBootsHadOtherExtrinsic: optional(boolean),
        _speedBootsHadTimedVeryFast: optional(boolean),
        _speedBootsHadIntrinsicFast: optional(boolean),
        _grantsVeryFastFromArmor: optional(boolean),
        _fumbleBootsHadOtherSource: optional(boolean),
        quantity: optional(integer),
        enchantment: optional(integer),
        buc: optional(oneOf('blessed', 'uncursed', 'cursed', '')),
        invlet: optional(nullable(string)),
        name: optional(string),
        plural: optional(string),
        class: optional(string),
        description: optional(string),
        color: optional(integer),
        artifactName: optional(string),
        typeKnown: optional(boolean),
        overrideIdentified: optional(boolean),
        _startingInventory: optional(boolean),
        bimanual: optional(boolean),
        poisoned: optional(boolean),
        diluted: optional(boolean),
        enchanted: optional(boolean),
        omitUncursed: optional(boolean),
        showBuc: optional(boolean),
        spellName: optional(nullable(string)),
        spellLevel: optional(integer),
        spellCategory: optional(nullable(oneOf('attack', 'healing', 'divination', 'enchantment', 'clerical', 'escape', 'matter'))),
        appearance: optional(string),
        empty: optional(boolean),
    });
}
// Parent and carrier references legitimately point back to their contents.
// Only traversal through contents must be acyclic. Cache that check for
// this decoded graph; every object's fields still undergo full validation.
function contentsAreAcyclic(value, checked, ancestors) {
    if (!isSavedRecord(value) || checked.has(value))
        return true;
    if (ancestors.has(value))
        return false;
    ancestors.add(value);
    if (Array.isArray(value.contents)) {
        const contents = value.contents;
        for (const child of contents) {
            if (!contentsAreAcyclic(child, checked, ancestors))
                return false;
        }
    }
    ancestors.delete(value);
    checked.add(value);
    return true;
}
//# sourceMappingURL=object_validation.js.map