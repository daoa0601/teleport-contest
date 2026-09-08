// armor.js — Hero armor-class projection.
// C refs: do_wear.c find_ac() and hack.h ARM_BONUS().

import { game } from './gstate.js';
import { magicNegation } from './magic_negation.js';
import { artifactEmitsLight } from './artifacts.js';
import { beginObjectBurn, endObjectBurn, equipmentLightDescription } from './light.js';
import {
    AMULET_OF_GUARDING, CLOAK_OF_DISPLACEMENT, GAUNTLETS_OF_POWER,
    FUMBLE_BOOTS, RIN_FREE_ACTION, RIN_PROTECTION,
    GRAY_DRAGON_SCALE_MAIL, GRAY_DRAGON_SCALES,
    YELLOW_DRAGON_SCALE_MAIL, YELLOW_DRAGON_SCALES,
    SHIELD_OF_DRAIN_RESISTANCE,
    OBJECT_MATERIAL, OBJECT_NAMES, OBJECT_PROPERTY,
    WATER_WALKING_BOOTS,
} from './object_data.js';
import { rnd } from './rng.js';
import { MONSTER_NAME } from './monster_data.js';
import {
    grantWornProperty, removeWornProperty,
} from './properties.js';
import {
    W_ARM, W_ARMC, W_ARMF, W_ARMG, W_ARMH, W_ARMS, W_ARMU,
} from './const.js';

// objects[].a_ac is `10 - ac` for every ARMOR()/HELM()/CLOAK()/SHIELD()/
// GLOVES()/BOOTS() entry in the pinned objects.h. Armor occupies IDs 89..172.
// Keeping the complete table here makes equipment transactions consume object
// identity rather than role-specific or command-specific AC guesses.
export const OBJECT_ARMOR_BONUS = Object.freeze([
    // 89..100: helmets
    1, 1, 2, 0, 0, 0, 1, 1, 1, 1, 1, 1,
    // 101..110: dragon scale mail; 111..120: dragon scales
    9, 9, 9, 9, 9, 9, 9, 9, 9, 9,
    3, 3, 3, 3, 3, 3, 3, 3, 3, 3,
    // 121..135: ordinary suits
    7, 7, 6, 6, 6, 6, 5, 5, 4, 4, 3, 3, 2, 2, 1,
    // 136..137: shirts
    0, 0,
    // 138..149: cloaks
    0, 1, 0, 0, 1, 2, 1, 1, 3, 1, 1, 1,
    // 150..158: shields
    1, 1, 1, 2, 1, 1, 2, 2, 2,
    // 159..162: gloves
    1, 1, 1, 1,
    // 163..172: boots
    1, 2, 2, 1, 1, 1, 1, 1, 1, 1,
]);

const ARMOR_FIRST = 89;
const ARMOR_LAST = 172;
const IRON = 11;
const MITHRIL = 17;
const GLASS = 19;
const ARMOR_SLOTS = Object.freeze([
    'uarm', 'uarmc', 'uarmh', 'uarmf', 'uarms', 'uarmg', 'uarmu',
]);
const ARMOR_MASKS = Object.freeze({
    uarm: W_ARM,
    uarmc: W_ARMC,
    uarmh: W_ARMH,
    uarms: W_ARMS,
    uarmg: W_ARMG,
    uarmf: W_ARMF,
    uarmu: W_ARMU,
});
const AC_MAX = 99;
const SPEED_BOOTS = 166;

// C armor_to_dragon(): scales and scale mail use the same color order.
export function dragonFormForArmor(object) {
    const type = object?.otyp;
    const firstDragon = MONSTER_NAME.indexOf('gray dragon');
    if (type >= GRAY_DRAGON_SCALE_MAIL && type <= YELLOW_DRAGON_SCALE_MAIL)
        return firstDragon + type - GRAY_DRAGON_SCALE_MAIL;
    if (type >= GRAY_DRAGON_SCALES && type <= YELLOW_DRAGON_SCALES)
        return firstDragon + type - GRAY_DRAGON_SCALES;
    return null;
}

export function heroIsDisplaced(state = game) {
    const cloak = state?.uarmc || state?.u?.uarmc;
    return cloak?.otyp === CLOAK_OF_DISPLACEMENT
        || !!state?.displaced
        || !!state?.u?.displaced
        || (state?.u?.displacedTurns ?? 0) > 0;
}

// C youprop.h:Drain_resistance includes both intrinsic sources and the shield
// currently installed by setworn().
export function heroHasDrainResistance(state = game) {
    const hero = state?.u || {};
    const shield = state?.uarms || hero.uarms;
    return !!(hero.drainResistance || hero.drain_resistance
        || (Number.isInteger(hero.ulycn) && hero.ulycn >= 0)
        || shield?.otyp === SHIELD_OF_DRAIN_RESISTANCE);
}

// C youprop.h:Free_action includes the oc_oprop installed by either worn ring.
// Derive ring ownership from the live slots for the same lifecycle reason as
// shield-based drain resistance: taking the accessory off must remove the
// effect without an independently maintained boolean.
export function heroHasFreeAction(state = game) {
    const hero = state?.u || {};
    const left = state?.uleft || hero.uleft;
    const right = state?.uright || hero.uright;
    return !!(hero.freeAction || hero.free_action
        || left?.otyp === RIN_FREE_ACTION
        || right?.otyp === RIN_FREE_ACTION);
}

export function heroHasWaterWalking(state = game) {
    const hero = state?.u || {};
    const boots = state?.uarmf || hero.uarmf;
    return !!(hero.waterWalking || hero.water_walking
        || boots?.otyp === WATER_WALKING_BOOTS);
}

export function heroKnowsWaterWalking(state = game) {
    const hero = state?.u || {};
    const boots = state?.uarmf || hero.uarmf;
    const typeKnown = boots?.typeKnown
        || state?._knownObjectTypes?.has(WATER_WALKING_BOOTS);
    return !hero.usteed && boots?.otyp === WATER_WALKING_BOOTS && typeKnown;
}

export function heroKnowsLavaWalking(state = game) {
    if (!heroKnowsWaterWalking(state)) return false;
    const hero = state?.u || {};
    const boots = state?.uarmf || hero.uarmf;
    const fireResistant = hero.fireResistance || hero.fire_resistance;
    return !!fireResistant && !!boots.oerodeproof && !!boots.rknown;
}

// do_wear.c's *_on() callbacks distinguish the physical worn property from
// the observable feedback which identifies the shuffled object type.
export function armorOnIdentifiesType(object, effectMessages = []) {
    if (object?.otyp === GAUNTLETS_OF_POWER) return true;
    if (object?.otyp === CLOAK_OF_DISPLACEMENT)
        return effectMessages.length > 0;
    if (object?.otyp === SPEED_BOOTS)
        return effectMessages.length > 0;
    return false;
}

// C objects.h armor macros encode the worn slot by contiguous object ranges.
// Keep that classification beside the AC table so startup, wear commands,
// and recalculation do not maintain independent type lists.
export function armorSlotFor(otyp) {
    if (otyp >= 89 && otyp <= 100) return 'uarmh';
    if (otyp >= 101 && otyp <= 135) return 'uarm';
    if (otyp >= 136 && otyp <= 137) return 'uarmu';
    if (otyp >= 138 && otyp <= 149) return 'uarmc';
    if (otyp >= 150 && otyp <= 158) return 'uarms';
    if (otyp >= 159 && otyp <= 162) return 'uarmg';
    if (otyp >= 163 && otyp <= 172) return 'uarmf';
    return null;
}

export function applyWornArmorProperty(object, state = game) {
    const slot = armorSlotFor(object?.otyp);
    const property = OBJECT_PROPERTY[object?.otyp];
    if (!slot || !property) return null;
    grantWornProperty(property, object, slot, state);
    return property;
}

export function wearHeroArmor(object, state = game) {
    const slot = armorSlotFor(object?.otyp);
    if (!slot) return null;
    state[slot] = object;
    if (state.u) state.u[slot] = object;
    object.worn = true;
    object.wornSlot = slot;
    object.owornmask = (object.owornmask ?? 0) | ARMOR_MASKS[slot];
    applyWornArmorProperty(object, state);
    return slot;
}

export function removeHeroArmor(object, state = game) {
    const slot = armorSlotFor(object?.otyp);
    if (!slot) return false;
    const wasShining = object.lamplit && artifactEmitsLight(object);
    if (state[slot] === object) state[slot] = null;
    if (state.u?.[slot] === object) state.u[slot] = null;
    object.worn = false;
    object.wornSlot = null;
    object.owornmask = (object.owornmask ?? 0) & ~ARMOR_MASKS[slot];
    if (wasShining && !artifactEmitsLight(object)) endObjectBurn(object, state);
    removeArmorProperties(object, state);

    const hero = state.u || (state.u = {});
    if (object.otyp === SPEED_BOOTS) {
        object._grantsVeryFastFromArmor = false;
        hero.veryFastFromArmor = (state.inventory || []).some(candidate =>
            candidate !== object && candidate.worn
            && candidate._grantsVeryFastFromArmor);
        hero.veryFast = hero.veryFastFromArmor
            || (hero.veryFastTurns ?? 0) > 0;
    }
    if (object.otyp === FUMBLE_BOOTS) {
        hero.fumblingFromArmor = false;
        if (!object._fumbleBootsHadOtherSource) hero.fumblingTurns = 0;
        hero.fumbling = !!hero.fumblingIntrinsic
            || (hero.fumblingTurns ?? 0) > 0;
    }
    findArmorClass(state);
    return true;
}

export function objectIsHardHelmet(object) {
    if (armorSlotFor(object?.otyp) !== 'uarmh') return false;
    const material = OBJECT_MATERIAL[object.otyp] ?? 0;
    return material >= IRON && material <= MITHRIL || material === GLASS;
}

export function wornArmorInDestroyOrder(state = game) {
    return ['uarm', 'uarmc', 'uarmh', 'uarms', 'uarmg', 'uarmf', 'uarmu']
        .map(slot => state[slot] || state.u?.[slot])
        .filter(Boolean);
}

export function objectErosionKind(object) {
    const material = OBJECT_MATERIAL[object.otyp];
    if ((material <= 8 && material !== 1) || material === 18)
        return { field: 'oeroded', action: 'smoulder' };
    if (material === 11)
        return { field: 'oeroded', action: 'rust' };
    if (material === 19 && object.oclass === 3)
        return { field: 'oeroded', action: 'crack' };
    if (material === 10)
        return { field: 'oeroded2', action: 'rot' };
    if (material === 13)
        return { field: 'oeroded2', action: 'corrode' };
    return null;
}

export function objectErosionMessage(object, kind) {
    const erosion = object[kind.field] || 0;
    const name = object.name || OBJECT_NAMES[object.otyp] || 'object';
    const verb = kind.action === 'smoulder' ? 'smoulders'
        : kind.action === 'rust' ? 'rusts'
        : kind.action === 'crack' ? 'cracks'
        : kind.action === 'rot' ? 'rots' : 'corrodes';
    if (erosion >= 3) return `Your ${name} ${verb} away!`;
    const adverb = erosion === 2 ? ' completely'
        : erosion ? ' further' : '';
    return `Your ${name} ${verb}${adverb}!`;
}

export function destroyWornArmor(armor, state = game) {
    removeHeroArmor(armor, state);
    state.inventory = (state.inventory || []).filter(item => item !== armor);
}

export function armorBaseBonus(otyp) {
    if (!Number.isInteger(otyp) || otyp < ARMOR_FIRST || otyp > ARMOR_LAST)
        return 0;
    return OBJECT_ARMOR_BONUS[otyp - ARMOR_FIRST] || 0;
}

function objectEnchantment(object) {
    if (Number.isInteger(object?.spe)) return object.spe;
    if (Number.isInteger(object?.enchantment)) return object.enchantment;
    return 0;
}

function greatestErosion(object) {
    return Math.max(0,
        object?.oeroded || 0,
        object?.oeroded2 || 0,
        object?.erosion || 0,
        object?.erosion2 || 0,
        object?.rust || 0,
        object?.corrosion || 0);
}

export function armorBonus(object) {
    if (!object) return 0;
    const base = armorBaseBonus(object.otyp);
    return base + objectEnchantment(object)
        - Math.min(greatestErosion(object), base);
}

// objects[].oc_oprop supplies the primary dragon-armor resistance.  The
// later do_wear.c:dragon_armor_handling() transaction adds a second property
// for several colors; blue mail therefore owns both shock resistance and
// worn-equipment speed.
const DRAGON_ARMOR_EXTRA_PROPERTY = Object.freeze({
    black: 'drainResistance',
    blue: 'fast',
    green: 'sicknessResistance',
    red: 'infravision',
    gold: 'hallucinationResistance',
    orange: 'freeAction',
    yellow: 'stoneResistance',
    white: 'slowDigestion',
});

function dragonArmorColor(object) {
    const name = OBJECT_NAMES[object?.otyp] || '';
    return name.match(/^([a-z]+) dragon scale(?: mail|s)$/)?.[1] || null;
}

function grantArmorProperty(object, state, property) {
    const hero = state.u || (state.u = {});
    grantWornProperty(property, object, 'uarm', state);
    // C youprop.h distinguishes intrinsic Fast from Very_fast: any worn
    // extrinsic source (including blue dragon armor) owns the 2-in-3 speed
    // gate in u_calc_moveamt().  Keep that distinction in live hero state;
    // a single `fast` boolean cannot select the correct scheduler branch.
    if (property === 'fast') {
        object._grantsVeryFastFromArmor = true;
        hero.veryFastFromArmor = true;
        hero.veryFast = true;
    }
}

// C do_wear.c:Armor_on() -> dragon_armor_handling().  Dragon armor's AC is
// active as soon as setworn() installs the slot, but these extrinsics and
// their feedback are afternmv effects: they begin only when dressing reaches
// multi == 0.  Return messages so allmain can preserve nomovemsg ordering.
export function applyArmorOnEffects(object, state = game) {
    applyWornArmorProperty(object, state);
    if (object?.otyp === GAUNTLETS_OF_POWER) return [];

    if (object?.otyp === FUMBLE_BOOTS) {
        const hero = state.u || (state.u = {});
        if (!object._fumbleBootsHadOtherSource) {
            hero.fumblingTurns = (hero.fumblingTurns ?? 0) + rnd(20);
        }
        hero.fumblingFromArmor = true;
        hero.fumbling = true;
        return [];
    }

    if (object?.otyp === CLOAK_OF_DISPLACEMENT) {
        const heroCanObserve = (!state.blind
                && !state.u?.uswallow
                && !state.invisible
                && !state.u?.invisible)
            || !!state.u?.telepathy
            || !!state.u?.detectMonsters;
        if (!object._displacementWasActive && heroCanObserve) {
            return [
                'You feel that monsters have difficulty pinpointing your location.',
            ];
        }
        return [];
    }

    // SPEED_BOOTS' Fast extrinsic is active as soon as setworn() installs
    // W_ARMF.  Boots_on() runs only after the dressing delay and owns
    // identification plus feedback, so do not grant the property here.
    if (object?.otyp === SPEED_BOOTS) {
        if (!object._speedBootsHadOtherExtrinsic
            && !object._speedBootsHadTimedVeryFast) {
            return [
                `You feel yourself speed up${
                    object._speedBootsHadIntrinsicFast ? ' a bit more' : ''
                }.`,
            ];
        }
        return [];
    }

    const color = dragonArmorColor(object);
    const extraProperty = DRAGON_ARMOR_EXTRA_PROPERTY[color];
    if (!extraProperty) return [];

    const hero = state.u || (state.u = {});
    const messages = [];
    const hadProperty = !!hero[extraProperty];
    const wasVeryFast = !!hero.veryFast;
    grantArmorProperty(object, state, extraProperty);

    if (color === 'blue') {
        if (!wasVeryFast)
            messages.push(`You speed up${hadProperty ? ' a bit more' : ''}.`);
    } else if (color === 'gold') {
        const hallucinating = !!hero.hallucinating
            || (hero.hallucinationTurns ?? 0) > 0;
        if (hallucinating) {
            object._suppressedHallucinationTurns = hero.hallucinationTurns || 0;
            hero.hallucinating = false;
            hero.hallucinationTurns = 0;
            state.vision_full_recalc = 1;
            messages.push(`Everything ${state.blind ? 'feels' : 'looks'} SO boring now.`);
        }
    } else if (color === 'red') {
        state.vision_full_recalc = 1;
    }
    if (artifactEmitsLight(object) && !object.lamplit) {
        beginObjectBurn(object, state);
        if (!state.blind && !state.u.blindTurns) {
            const name = OBJECT_NAMES[object.otyp];
            const verb = name.endsWith('scales') ? 'begin' : 'begins';
            messages.push(`Your ${name} ${verb} to shine ${equipmentLightDescription(object, state)}!`);
        }
    }
    return messages;
}

// C do_wear.c:Armor_off() removes both the ordinary dragon resistance and
// the color-specific extra property after the suit leaves W_ARM.
export function removeArmorProperties(object, state = game) {
    const color = dragonArmorColor(object);
    const extraProperty = DRAGON_ARMOR_EXTRA_PROPERTY[color];
    const ordinaryProperty = OBJECT_PROPERTY[object?.otyp];
    const slot = armorSlotFor(object?.otyp);
    if (ordinaryProperty && slot)
        removeWornProperty(ordinaryProperty, object, slot, state);
    if (!extraProperty) return;

    removeWornProperty(extraProperty, object, 'uarm', state);

    const hero = state.u || (state.u = {});
    if (color === 'blue') {
        object._grantsVeryFastFromArmor = false;
        hero.veryFastFromArmor = (state.inventory || []).some(candidate =>
            candidate !== object && candidate.worn
            && candidate._grantsVeryFastFromArmor);
        hero.veryFast = hero.veryFastFromArmor
            || (hero.veryFastTurns ?? 0) > 0;
    } else if (color === 'gold'
        && Object.prototype.hasOwnProperty.call(
            object, '_suppressedHallucinationTurns',
        )) {
        const turns = object._suppressedHallucinationTurns || 0;
        hero.hallucinationTurns = turns;
        hero.hallucinating = turns > 0;
        delete object._suppressedHallucinationTurns;
        state.vision_full_recalc = 1;
    } else if (color === 'red') {
        state.vision_full_recalc = 1;
    }
}

function equippedObject(state, slot) {
    if (Object.prototype.hasOwnProperty.call(state, slot)) return state[slot];
    return state.u?.[slot] || null;
}

function protectionItemBonus(object, expectedType) {
    return object?.otyp === expectedType ? objectEnchantment(object) : 0;
}

// Rebuild current AC from authoritative equipment state. The default base is
// human AC 10; polymorph can supply `formArmorClass` without changing callers.
export function projectedArmorClass(state = game) {
    const hero = state.u || (state.u = {});
    let armorClass = Number.isInteger(hero.formArmorClass)
        ? hero.formArmorClass
        : Number.isInteger(hero.baseArmorClass) ? hero.baseArmorClass : 10;

    for (const slot of ARMOR_SLOTS)
        armorClass -= armorBonus(equippedObject(state, slot));

    armorClass -= protectionItemBonus(
        equippedObject(state, 'uleft'), RIN_PROTECTION,
    );
    armorClass -= protectionItemBonus(
        equippedObject(state, 'uright'), RIN_PROTECTION,
    );
    if (equippedObject(state, 'uamul')?.otyp === AMULET_OF_GUARDING)
        armorClass -= 2;

    if (hero.intrinsicProtection || hero.protectionIntrinsic)
        armorClass -= hero.ublessed || 0;
    armorClass -= hero.uspellprot || hero.spellProtection || 0;

    return Math.max(-AC_MAX, Math.min(AC_MAX, armorClass));
}

export function findArmorClass(state = game) {
    const hero = state.u || (state.u = {});
    hero._magicNegation = magicNegation(hero, state);
    hero.uac = projectedArmorClass(state);
    return hero.uac;
}
