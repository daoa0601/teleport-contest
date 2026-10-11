// enchant_weapon.js — Scroll of enchant weapon.
// C refs: read.c seffect_enchant_weapon(); wield.c chwepon().
import { exerciseAttribute } from './attrib.js';
import { artifactById, ARTIFACTS } from './artifacts.js';
import { heroHandName } from './body_parts.js';
import { A_DEX, SPE_LIM } from './const.js';
import { displayColorName, plineWithContinuation as pline, } from './display.js';
import { game } from './gstate.js';
import { useUpInventoryStack } from './hero_inventory.js';
import { makePlural } from './object_grammar.js';
import { CRYSKNIFE, ELVEN_ARROW, ELVEN_BOW, ELVEN_BROADSWORD, ELVEN_DAGGER, ELVEN_SHORT_SWORD, ELVEN_SPEAR, OBJECT_DESCRIPTIONS, OBJECT_NAMES, WORM_TOOTH, getObjectClassBounds, requireObjectData, } from './object_data.js';
import { erosionMatters } from './object_erosion.js';
import { learnObjectType, objectClassForType } from './object_knowledge.js';
import { ownedObjectAction } from './objnam.js';
import { isWeaponTool } from './object_properties.js';
import { uncurseObjectState } from './object_state.js';
import { rn2, rnd } from './rng.js';
import { strangeFeeling } from './scroll_strange_feeling.js';
import { heroIsBlind, heroIsHallucinating } from './senses.js';
import { chargeAlteredUnpaidObject, objectTypeKnown, updateUnpaidObjectPrice, } from './shk.js';
import { encumbranceLabel, encumbranceMessage, nearCapacity, objectWeight, } from './weight.js';
import { willWeld } from './weapon_type.js';
const WEAPON_CLASS = 2;
const ARMOR_CLASS = 3;
const SCROLL_CLASS = 9;
// C seffect_enchant_weapon(). The caller has already announced the read,
// delivered the confusion line, and exercised Wisdom for the magic scroll.
// Returns true when this module consumed the scroll itself (the chwepon()
// bare-hands strange_feeling() path); false when the scroll still exists
// and the caller finishes the normal read lifecycle.
export async function enchantWeapon(scroll, state = game) {
    const confused = !!(state.u?.confused
        || (state.u?.confusionTurns ?? 0) > 0);
    const uwep = state.uwep || state.u?.uwep || null;
    // A confused reading proofs or repairs the wielded erodeable weapon
    // instead of enchanting it; wielded armor never enters this branch.
    if (confused && uwep && erosionMatters(uwep)
        && uwep.oclass !== ARMOR_CLASS) {
        await proofConfusedReading(uwep, !!scroll.cursed, state);
        return false;
    }
    const enchantment = uwep ? objectEnchantment(uwep) : 0;
    const amount = scroll.cursed ? -1
        : !uwep ? 1 /* guard further tests against null pointer */
            : enchantment >= 9
                ? (rn2(enchantment) === 0 ? 1 : 0) /* usually 0, maybe 1 */
                : scroll.blessed ? rnd(3 - Math.trunc(enchantment / 3))
                    : 1; /* uncursed */
    const processed = await chwepon(scroll, amount, state);
    const weapon = state.uwep || state.u?.uwep || null;
    if (weapon)
        capEnchantment(weapon);
    return !processed;
}
// C seffect_enchant_weapon() confused branch: set, clear, or repair
// erosion proofing. The enchantment never changes here.
async function proofConfusedReading(uwep, scursed, state) {
    const oldErodeproof = !!uwep.oerodeproof;
    const newErodeproof = !scursed;
    uwep.oerodeproof = false; /* for messages */
    if (heroIsBlind(state)) {
        uwep.rknown = false;
        await pline('Your weapon feels warm for a moment.');
    }
    else {
        uwep.rknown = true;
        const glow = displayColorName(scursed ? 'purple' : 'golden', state);
        await pline(`${ownedObjectAction(uwep, 'are', state)} covered by a `
            + `${scursed ? 'mottled' : 'shimmering'} ${glow} `
            + `${scursed ? 'glow' : 'shield'}!`);
    }
    if (newErodeproof && (uwep.oeroded || uwep.oeroded2)) {
        uwep.oeroded = 0;
        uwep.oeroded2 = 0;
        await pline(`${ownedObjectAction(uwep, heroIsBlind(state) ? 'feel' : 'look', state)} as good as new!`);
    }
    if (oldErodeproof && !newErodeproof) {
        /* restore old proofing before shop charges for losing it */
        uwep.oerodeproof = true;
        await chargeAlteredUnpaidObject(uwep, 'degrade', state);
    }
    uwep.oerodeproof = newErodeproof;
}
// C wield.c:chwepon(). Returns true when the wielded weapon was processed,
// false after the bare-hands strange_feeling() path consumed the scroll.
async function chwepon(scroll, amount, state) {
    const color = displayColorName(amount < 0 ? 'black' : 'blue', state);
    const uwep = state.uwep || state.u?.uwep || null;
    const scrollType = scroll?.oclass === SCROLL_CLASS ? scroll.otyp : null;
    if (!uwep || (uwep.oclass !== WEAPON_CLASS && !isWeaponTool(uwep))) {
        await strangeFeelingOn(scroll, amount, state);
        return false;
    }
    if (uwep.otyp === WORM_TOOTH && amount >= 0) {
        await sharpenWormTeeth(uwep, scrollType, state);
        return true;
    }
    else if (uwep.otyp === CRYSKNIFE && amount < 0) {
        await dullCrysknife(uwep, scroll?.bknown, scrollType, state);
        return true;
    }
    const weaponName = uwep.oextra?.oname || uwep.oname || '';
    if (amount < 0 && uwep.oartifact
        && restrictName(uwep, weaponName, state)) {
        if (!heroIsBlind(state)) {
            await pline(`${ownedObjectAction(uwep, 'faintly glow', state)} ${color}.`);
        }
        return true;
    }
    /* there is a (soft) upper and lower limit to uwep->spe */
    const enchantment = objectEnchantment(uwep);
    if (((enchantment > 5 && amount >= 0)
        || (enchantment < -5 && amount < 0)) && rn2(3)) {
        if (!heroIsBlind(state)) {
            await pline(`${ownedObjectAction(uwep, 'violently glow', state)} ${color} `
                + `for a while and then ${objectQuantity(uwep) > 1 ? 'evaporate' : 'evaporates'}.`);
        }
        else {
            await pline(`${ownedObjectAction(uwep, 'evaporate', state)}.`);
        }
        await useUpInventoryStack(uwep, state);
        return true;
    }
    if (!heroIsBlind(state)) {
        const duration = amount * amount === 1 ? 'moment' : 'while';
        await pline(`${ownedObjectAction(uwep, amount === 0 ? 'violently glow' : 'glow', state)} ${color} for a ${duration}.`);
        if (scrollType !== null && uwep.known
            && (amount > 0 || (amount < 0 && scroll.bknown))) {
            learnObjectType(scrollType, state);
        }
    }
    if (amount < 0) {
        await chargeAlteredUnpaidObject(uwep, 'disenchant', state);
    }
    setWeaponEnchantment(uwep, objectEnchantment(uwep) + amount);
    if (amount > 0) {
        if (uwep.cursed)
            uncurseObjectState(uwep);
        /* update shop bill to reflect the new higher price */
        if (uwep.unpaid)
            updateUnpaidObjectPrice(uwep, state);
    }
    /* Enchantment has an adverse, spe dependent reaction on Magicbane;
       give an obscure clue here. */
    if (heroWieldsMagicbane(state) && objectEnchantment(uwep) >= 0) {
        const sting = amount > 1 && objectEnchantment(uwep) > 1
            ? 'flin' : 'it';
        await pline(`Your right ${heroHandName(state)} ${sting}ches!`);
    }
    /* Elven weapons vibrate warningly when enchanted beyond a limit. */
    if (objectEnchantment(uwep) > 5
        && (isElvenWeapon(uwep) || uwep.oartifact || rn2(7) === 0)) {
        await pline(`${ownedObjectAction(uwep, 'suddenly vibrate', state)} unexpectedly.`);
    }
    return true;
}
// C chwepon() worm tooth branch: fusion into one uncursed crysknife.
async function sharpenWormTeeth(uwep, scrollType, state) {
    const multiple = objectQuantity(uwep) > 1;
    const previousCapacity = state._encumbranceLevel ?? 0;
    /* order: message, transformation, shop handling */
    await pline(`Your ${simpleonames(uwep)} `
        + `${multiple ? 'fuse, and become' : 'is'} much sharper now.`);
    uwep.otyp = CRYSKNIFE;
    uwep.oerodeproof = false;
    renameTransformedWeapon(uwep, 'crysknife');
    if (multiple) {
        uwep.quan = 1;
        uwep.quantity = 1;
        uwep.owt = objectWeight(uwep);
    }
    if (uwep.cursed)
        uncurseObjectState(uwep);
    /* update shop bill to reflect the new higher value */
    if (uwep.unpaid)
        updateUnpaidObjectPrice(uwep, state);
    if (scrollType !== null)
        learnObjectType(scrollType, state);
    if (multiple)
        await noteEncumbranceChange(previousCapacity, state);
}
// C chwepon() crysknife branch: degradation back into one worm tooth.
async function dullCrysknife(uwep, scrollBknown, scrollType, state) {
    const multiple = objectQuantity(uwep) > 1;
    const previousCapacity = state._encumbranceLevel ?? 0;
    /* order matters: message, shop handling, transformation */
    await pline(`Your ${simpleonames(uwep)} `
        + `${multiple ? 'fuse, and become' : 'is'} much duller now.`);
    await chargeAlteredUnpaidObject(uwep, 'degrade', state);
    uwep.otyp = WORM_TOOTH;
    uwep.oerodeproof = false;
    renameTransformedWeapon(uwep, 'worm tooth');
    if (multiple) {
        uwep.quan = 1;
        uwep.quantity = 1;
        uwep.owt = objectWeight(uwep);
    }
    if (scrollType !== null && scrollBknown)
        learnObjectType(scrollType, state);
    if (multiple)
        await noteEncumbranceChange(previousCapacity, state);
}
// C chwepon() bare-hands branch, including the cursed welded tin opener.
async function strangeFeelingOn(scroll, amount, state) {
    const uwep = state.uwep || state.u?.uwep || null;
    let text;
    if (amount >= 0 && uwep && willWeld(uwep)) { /* cursed tin opener */
        if (!heroIsBlind(state)) {
            const aura = displayColorName('amber', state);
            const article = /^[aeiou]/iu.test(aura) ? 'an' : 'a';
            text = `${ownedObjectAction(uwep, 'glow', state)} with `
                + `${article} ${aura} aura.`;
            uwep.bknown = !heroIsHallucinating(state);
        }
        else {
            /* the cursed tin opener is wielded in the right hand */
            text = `Your right ${heroHandName(state)} tingles.`;
        }
        uncurseObjectState(uwep);
    }
    else {
        text = `Your ${makePlural(heroHandName(state))} `
            + `${amount >= 0 ? 'twitch' : 'itch'}.`;
    }
    await strangeFeeling(scroll, text, { state });
    await exerciseAttribute(A_DEX, amount >= 0, state);
}
function objectQuantity(object) {
    return object.quan ?? object.quantity ?? 1;
}
// The inventory description reads the object's stored name for weapons,
// so a type change must rewrite it, as other type-changing owners do.
function renameTransformedWeapon(uwep, name) {
    if (uwep.name !== undefined)
        uwep.name = name;
    if (uwep.plural !== undefined)
        uwep.plural = makePlural(name);
}
function objectEnchantment(object) {
    return object.spe ?? object.enchantment ?? 0;
}
// C read.c cap_spe(): max +99, min -99.
function capEnchantment(object) {
    const value = objectEnchantment(object);
    if (Math.abs(value) > SPE_LIM) {
        setWeaponEnchantment(object, Math.sign(value) * SPE_LIM);
    }
}
function setWeaponEnchantment(object, value) {
    object.spe = value;
    object.enchantment = value;
}
// C pickup.c:encumber_msg(), in the shape other JS effect owners use.
async function noteEncumbranceChange(previousCapacity, state) {
    const currentCapacity = nearCapacity(state);
    const message = encumbranceMessage(previousCapacity, currentCapacity);
    if (message)
        await pline(message);
    state._encumbranceLevel = currentCapacity;
    if (state.u)
        state.u._encumbrance = encumbranceLabel(currentCapacity);
}
// C wield.c u_wield_art(ART_MAGICBANE).
function heroWieldsMagicbane(state) {
    return artifactById((state.uwep || state.u?.uwep)?.oartifact)?.name === 'Magicbane';
}
// C include/obj.h is_elven_weapon().
function isElvenWeapon(object) {
    return [ELVEN_ARROW, ELVEN_SPEAR, ELVEN_DAGGER, ELVEN_SHORT_SWORD,
        ELVEN_BROADSWORD, ELVEN_BOW].includes(object.otyp);
}
// C artifact.c:restrict_name(). Artifacts.js owns the artilist flags; the
// same-type test covers undiscovered siblings sharing this description
// (weapons share no shuffled pool, so equal descriptions are the range).
function restrictName(object, name, state) {
    if (!name)
        return false;
    let wanted = name;
    if (/^the /iu.test(wanted))
        wanted = wanted.slice(4);
    const otyp = object.otyp;
    const sameTypes = new Set([otyp]);
    const description = state.objectDescriptions?.[otyp]
        ?? OBJECT_DESCRIPTIONS[otyp];
    if (!objectTypeKnown(object, state) && description) {
        const oclass = objectClassForType(otyp);
        const { first, last } = getObjectClassBounds(oclass);
        for (let candidate = first; candidate <= last; candidate++) {
            const other = state.objectDescriptions?.[candidate]
                ?? OBJECT_DESCRIPTIONS[candidate];
            if (candidate !== otyp && other === description
                && !state._knownObjectTypes?.has(candidate)) {
                sameTypes.add(candidate);
            }
        }
    }
    for (const artifact of ARTIFACTS) {
        if (!sameTypes.has(artifact.baseType))
            continue;
        let artifactName = artifact.name;
        if (/^the /iu.test(artifactName))
            artifactName = artifactName.slice(4);
        if (artifactName === wanted) {
            /* don't name multiple elven daggers "Sting" */
            return artifact.noGeneration || artifact.restricted
                || objectQuantity(object) > 1;
        }
    }
    return false;
}
// Only the tooth/crysknife transformations use simpleonames here. C omits
// individual names and call names from that transformation message.
function simpleonames(object) {
    const name = requireObjectData(OBJECT_NAMES, object.otyp);
    if (name === null)
        throw new Error(`Transformed weapon type ${object.otyp} has no name`);
    return objectQuantity(object) > 1 ? makePlural(name) : name;
}
//# sourceMappingURL=enchant_weapon.js.map