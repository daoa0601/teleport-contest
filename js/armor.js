// armor.js — Hero armor-class projection.
// C refs: do_wear.c find_ac() and hack.h ARM_BONUS().

import { game } from './gstate.js';
import {
    AMULET_OF_GUARDING, CLOAK_OF_DISPLACEMENT, GAUNTLETS_OF_POWER,
    FUMBLE_BOOTS, RIN_PROTECTION, OBJECT_NAMES, OBJECT_SPELL_LEVEL,
} from './object_data.js';
import { rnd } from './rng.js';

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
const ARMOR_SLOTS = Object.freeze([
    'uarm', 'uarmc', 'uarmh', 'uarmf', 'uarms', 'uarmg', 'uarmu',
]);
const AC_MAX = 99;
const SPEED_BOOTS = 166;

export function heroIsDisplaced(state = game) {
    const cloak = state?.uarmc || state?.u?.uarmc;
    return cloak?.otyp === CLOAK_OF_DISPLACEMENT
        || !!state?.displaced
        || !!state?.u?.displaced
        || (state?.u?.displacedTurns ?? 0) > 0;
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
const DRAGON_ARMOR_PRIMARY_PROPERTY = Object.freeze({
    gray: 'antimagic',
    silver: 'reflection',
    red: 'fireResistance',
    white: 'coldResistance',
    orange: 'sleepResistance',
    black: 'disintegrationResistance',
    blue: 'shockResistance',
    green: 'poisonResistance',
    yellow: 'acidResistance',
});

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

function grantArmorProperty(object, hero, property) {
    if (!object._dragonArmorPriorProperties)
        object._dragonArmorPriorProperties = {};
    if (!Object.prototype.hasOwnProperty.call(
        object._dragonArmorPriorProperties, property,
    )) object._dragonArmorPriorProperties[property] = !!hero[property];
    hero[`${property}FromArmor`] = true;
    hero[property] = true;
    if (!hero._propertySources) hero._propertySources = {};
    hero._propertySources[property] = {
        kind: 'worn', otyp: object.otyp, slot: 'uarm',
    };
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
    const primaryProperty = DRAGON_ARMOR_PRIMARY_PROPERTY[color];
    const extraProperty = DRAGON_ARMOR_EXTRA_PROPERTY[color];
    if (!primaryProperty && !extraProperty) return [];

    const hero = state.u || (state.u = {});
    const messages = [];
    if (primaryProperty) grantArmorProperty(object, hero, primaryProperty);
    if (!extraProperty) return messages;

    const hadProperty = !!hero[extraProperty];
    const wasVeryFast = !!hero.veryFast;
    grantArmorProperty(object, hero, extraProperty);

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
    return messages;
}

function equippedObject(state, slot) {
    if (Object.prototype.hasOwnProperty.call(state, slot)) return state[slot];
    return state.u?.[slot] || null;
}

// C ref: worn.c:magic_negation().  objects[].a_can is generated into the
// shared oc_oc2 field (OBJECT_SPELL_LEVEL in the current metadata module).
// The strongest worn armor contribution owns magical-cancellation checks;
// armor class by itself cannot stand in for it.
export function magicNegation(state = game) {
    let cancellation = Math.max(0, ...ARMOR_SLOTS.map(slot => {
        const armor = equippedObject(state, slot);
        return armor ? (OBJECT_SPELL_LEVEL[armor.otyp] || 0) : 0;
    }));
    const protectionRing = [
        equippedObject(state, 'uleft'), equippedObject(state, 'uright'),
    ].some(object => object?.otyp === RIN_PROTECTION);
    const guardingAmulet
        = equippedObject(state, 'uamul')?.otyp === AMULET_OF_GUARDING;
    if (guardingAmulet) cancellation += 2;
    else if (protectionRing) cancellation += 1;
    else if (cancellation < 1) {
        const hero = state.u || {};
        if (((hero.intrinsicProtection || hero.protectionIntrinsic)
                && (hero.ublessed ?? 0) > 0)
            || (hero.uspellprot ?? hero.spellProtection ?? 0) > 0) {
            cancellation = 1;
        }
    }
    return Math.min(3, cancellation);
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
    hero._magicNegation = magicNegation(state);
    hero.uac = projectedArmorClass(state);
    return hero.uac;
}
