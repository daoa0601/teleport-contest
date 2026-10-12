// armor.js — Hero armor-class projection.
// C refs: do_wear.c find_ac() and hack.h ARM_BONUS().
import { heroDetectsMonsters, heroIsBlind } from './senses.js';
import { makeHallucinated } from './hero_mental_status.js';
import { game, requireLiveGame } from './gstate.js';
import { corpseName, killerObjectName, observeObjectForNaming, simpleObjectNameWithArticle } from './objnam.js';
import { heroHandName } from './body_parts.js';
import { makePlural } from './object_grammar.js';
import { plineWithContinuation } from './display.js';
import { consumeInventoryItem, inventoryItemDescription } from './invent.js';
import { objectResistsDestruction } from './object_state.js';
import { erodeObject, erosionMatters, objectIsVulnerableToErosion } from './object_erosion.js';
import { stopHeroOccupation } from './occupation.js';
import { objectTypeKnown } from './shk.js';
import { heroResistsStoning, resolveImmediatePetrification, selfTouchPetrifyingWeapons, touchPetrifies, } from './stoning.js';
import { setSlipperyHands } from './towel.js';
import { releaseWeaponSlots } from './weapon_slots.js';
import { surfaceName } from './terrain_name.js';
import { magicNegation } from './magic_negation.js';
import { removeWornHeroItem } from './hero_equipment.js';
import { cancelSlotTakeoff, takeoffSlotObject } from './takeoff_state.js';
import { learnObjectType } from './object_knowledge.js';
import { floatHeroDown, floatHeroUp } from './terrain_movement.js';
import { applyHeroLocationEffects } from './cmd.js';
import { artifactEmitsLight, heroHasArtifactDefense } from './artifacts.js';
import { heroResistsLifeDrain } from './monster_resistance.js';
import { beginObjectBurn, endObjectBurn, equipmentLightDescription, equipmentLightMessage } from './light.js';
import { AMULET_OF_GUARDING, CLOAK_OF_DISPLACEMENT, CORPSE, GAUNTLETS_OF_POWER, FEDORA, FUMBLE_BOOTS, LEVITATION_BOOTS, RIN_FREE_ACTION, RIN_PROTECTION, GRAY_DRAGON_SCALE_MAIL, GRAY_DRAGON_SCALES, YELLOW_DRAGON_SCALE_MAIL, YELLOW_DRAGON_SCALES, SHIELD_OF_DRAIN_RESISTANCE, SHIELD_OF_REFLECTION, OBJECT_DESCRIPTIONS, OBJECT_MATERIAL, OBJECT_NAMES, OBJECT_PROPERTY, WATER_WALKING_BOOTS, } from './object_data.js';
import { rn2, rnd } from './rng.js';
import { MONSTER_NAME } from './monster_data.js';
import { captureLevitationState, grantWornProperty, hasIntrinsicProperty, hasWornProperty, propertyIsActive, refreshMovementProperties, removeWornProperty, } from './properties.js';
import { A_DEX, A_INT, A_WIS, LUCKMIN, LUCKMAX, W_ARM, W_ARMC, W_ARMF, W_ARMG, W_ARMH, W_ARMOR, W_ARMS, W_ARMU, } from './const.js';
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
const GAUNTLETS_OF_DEXTERITY = OBJECT_NAMES.indexOf('gauntlets of dexterity');
const HELM_OF_BRILLIANCE = OBJECT_NAMES.indexOf('helm of brilliance');
// C armor_to_dragon(): scales and scale mail use the same color order.
export function dragonFormForArmor(object) {
    const type = object?.otyp;
    if (type === undefined)
        return null;
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
    const hero = state.u;
    const shield = state?.uarms || hero.uarms;
    return !!(hero.drainResistance
        || shield?.otyp === SHIELD_OF_DRAIN_RESISTANCE
        || heroResistsLifeDrain(state)
        || heroHasArtifactDefense('life-drain', state));
}
// C youprop.h:Free_action includes the oc_oprop installed by either worn ring.
// Derive ring ownership from the live slots for the same lifecycle reason as
// shield-based drain resistance: taking the accessory off must remove the
// effect without an independently maintained boolean.
export function heroHasFreeAction(state = game) {
    const hero = state.u;
    const left = state?.uleft || hero.uleft;
    const right = state?.uright || hero.uright;
    return !!(hero.freeAction
        || left?.otyp === RIN_FREE_ACTION
        || right?.otyp === RIN_FREE_ACTION);
}
export function heroHasWaterWalking(state = game) {
    const hero = state.u;
    const boots = state?.uarmf || hero.uarmf;
    return !!(hero.waterWalking
        || boots?.otyp === WATER_WALKING_BOOTS);
}
export function heroKnowsWaterWalking(state = game) {
    const hero = state.u;
    const boots = state?.uarmf || hero.uarmf;
    const typeKnown = boots?.typeKnown
        || state?._knownObjectTypes?.has(WATER_WALKING_BOOTS);
    return !hero.usteed && boots?.otyp === WATER_WALKING_BOOTS && !!typeKnown;
}
export function heroKnowsLavaWalking(state = game) {
    if (!heroKnowsWaterWalking(state))
        return false;
    const hero = state.u;
    const boots = state?.uarmf || hero.uarmf;
    const fireResistant = hero.fireResistance;
    return !!fireResistant && !!boots?.oerodeproof && !!boots.rknown;
}
// do_wear.c's *_on() callbacks distinguish the physical worn property from
// the observable feedback which identifies the shuffled object type.
export function armorOnIdentifiesType(object, effectMessages = []) {
    if (object?.otyp === GAUNTLETS_OF_POWER)
        return true;
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
    if (otyp === undefined)
        return null;
    if (otyp >= 89 && otyp <= 100)
        return 'uarmh';
    if (otyp >= 101 && otyp <= 135)
        return 'uarm';
    if (otyp >= 136 && otyp <= 137)
        return 'uarmu';
    if (otyp >= 138 && otyp <= 149)
        return 'uarmc';
    if (otyp >= 150 && otyp <= 158)
        return 'uarms';
    if (otyp >= 159 && otyp <= 162)
        return 'uarmg';
    if (otyp >= 163 && otyp <= 172)
        return 'uarmf';
    return null;
}
export function applyWornArmorProperty(object, state = game) {
    const slot = armorSlotFor(object?.otyp);
    const property = OBJECT_PROPERTY[object?.otyp];
    if (!slot || !property)
        return null;
    grantWornProperty(property, object, slot, state);
    return property;
}
export function wearHeroArmor(object, state = game) {
    const slot = armorSlotFor(object?.otyp);
    if (!slot)
        return null;
    const hero = state.u;
    const previous = equippedObject(state, slot);
    if (previous && previous !== object)
        cancelSlotTakeoff(slot, state);
    // setworn() installs physical properties immediately. The later *_on()
    // callback needs the sources that existed before that installation.
    if (object.otyp === LEVITATION_BOOTS)
        object._levitationBeforeWear = captureLevitationState(state);
    if (object.otyp === CLOAK_OF_DISPLACEMENT)
        object._displacementWasActive = heroIsDisplaced(state);
    if (object.otyp === SPEED_BOOTS) {
        object._speedBootsHadOtherExtrinsic = !!hero.veryFastFromArmor;
        object._speedBootsHadTimedVeryFast = (hero.veryFastTurns ?? 0) > 0;
        object._speedBootsHadIntrinsicFast = !!hero.fast;
        object._grantsVeryFastFromArmor = true;
        hero.veryFastFromArmor = true;
        hero.veryFast = true;
    }
    if (object.otyp === FUMBLE_BOOTS) {
        object._fumbleBootsHadOtherSource = !!hero.fumbling
            && (hero.fumblingTurns ?? 0) <= 0;
        hero.fumblingFromArmor = true;
        hero.fumbling = true;
    }
    state[slot] = object;
    if (state.u)
        state.u[slot] = object;
    object.worn = true;
    object.wornSlot = slot;
    object.owornmask = (object.owornmask ?? 0) | ARMOR_MASKS[slot];
    applyWornArmorProperty(object, state);
    return slot;
}
export async function removeHeroArmor(object, state = game, options = {}) {
    if (object?.otyp === LEVITATION_BOOTS)
        requireLiveGame(state);
    const previousLevitation = captureLevitationState(state);
    const cancelledDon = options.cancelledDon
        ?? (state._delayedAction?.kind === 'wear'
            && state._delayedAction.object === object);
    const losingGloves = equippedObject(state, 'uarmg') === object;
    if (state._delayedAction?.object === object) {
        state._delayedAction = null;
        state.multi = 0;
    }
    if (object?.otyp === FEDORA && state.urole?.key === 'archeologist')
        state.u.uluck = Math.max(LUCKMIN, (state.u.uluck ?? 0) - 1);
    const removed = await clearHeroArmor(object, state, { ...options, cancelledDon });
    if (losingGloves) {
        setSlipperyHands(0, state);
        await loseGloveProtection(object, state);
        if (state.program_state?.gameover)
            return removed;
    }
    if (removed && object.otyp === LEVITATION_BOOTS) {
        const remaining = captureLevitationState(state);
        if (!remaining.hasSource && !previousLevitation.blockedByTerrain
            && !cancelledDon) {
            if (!state.iflags?.in_lava_effects)
                await floatHeroDown(0, 0, state, previousLevitation);
            learnObjectType(object.otyp, state);
        }
        else
            refreshMovementProperties(state);
        delete object._levitationBeforeWear;
    }
    return removed;
}
// C Cloak_off(): toggle_displacement() runs after the cloak's source is removed.
export async function announceDisplacementLoss(object, state = game) {
    if (object.otyp !== CLOAK_OF_DISPLACEMENT)
        return;
    const hero = state.u;
    if (propertyIsActive('displaced', state)
        || hero.displacedIntrinsic || hero.intrinsicDisplacement
        || hero.displacementBlocked || hero.displacedBlocked)
        return;
    const blind = heroIsBlind(state);
    const visibleSelf = !blind && !hero.uswallow
        && !(state.invisible || hero.invisible || hero.invis);
    const unblindTelepathy = hasWornProperty('telepathy', state)
        || hero.unblindTelepathy || (hero.unblind_telepat_range ?? -1) >= 0;
    const blindTelepathy = blind
        && (propertyIsActive('telepathy', state) || hero.blindTelepathy || hero.telepathy);
    if (!(visibleSelf || unblindTelepathy || blindTelepathy || heroDetectsMonsters(state)))
        return;
    learnObjectType(object.otyp, state);
    await plineWithContinuation('You feel that monsters no longer have difficulty pinpointing your location.');
}
// C Gloves_off(): wielding_corpse(). Glove loss resolves life saving or
// stone-golem transformation before the armor's destruction can continue.
async function loseGloveProtection(gloves, state) {
    const slots = state.u.twoweap
        ? ['uwep', 'uswapwep'] : ['uwep'];
    for (const slot of slots) {
        const weapon = equippedObject(state, slot);
        if (weapon?.otyp !== CORPSE || !touchPetrifies(weapon.corpsenm)
            || heroResistsStoning(state))
            continue;
        await plineWithContinuation(`You now wield ${corpseName(weapon, { includeArticle: true })} `
            + `in your bare ${makePlural(heroHandName(state))}.`);
        const voluntary = !state.context?.mon_moving && !gloves.in_use;
        const killer = `${voluntary ? 'removing' : 'losing'} ${simpleArmorName(gloves, 'uarmg', state)} `
            + `while wielding ${killerObjectName(weapon, state)}`;
        const result = await resolveImmediatePetrification({ killer, state });
        if (result.died)
            return;
        if (!heroResistsStoning(state))
            await releaseWeaponSlots(weapon, state);
    }
}
// Slot/source removal without the Boots_off() transition.
export async function clearHeroArmor(object, state = game, { cancelledDon = state._delayedAction?.kind === 'wear'
    && state._delayedAction.object === object, deferArmorClass = false, } = {}) {
    const slot = armorSlotFor(object?.otyp);
    if (!slot)
        return false;
    if (equippedObject(state, slot) === object)
        cancelSlotTakeoff(slot, state);
    if (equippedObject(state, slot) === object && !cancelledDon)
        adjustArmorAttributeBonus(object, -objectEnchantment(object), state);
    const wasShining = object.lamplit && artifactEmitsLight(object);
    if (state[slot] === object)
        state[slot] = null;
    if (state.u?.[slot] === object)
        state.u[slot] = null;
    object.worn = false;
    object.wornSlot = null;
    object.owornmask = (object.owornmask ?? 0) & ~ARMOR_MASKS[slot];
    if (wasShining && !artifactEmitsLight(object)) {
        endObjectBurn(object, state);
        if (!heroIsBlind(state))
            await plineWithContinuation(equipmentLightMessage(object, false, state));
    }
    await removeArmorProperties(object, state);
    const hero = state.u;
    object._armorApplied = false;
    if (object.otyp === SPEED_BOOTS) {
        object._grantsVeryFastFromArmor = false;
        hero.veryFastFromArmor = (state.inventory || []).some(candidate => candidate !== object && candidate.worn
            && candidate._grantsVeryFastFromArmor);
        hero.veryFast = hero.veryFastFromArmor
            || (hero.veryFastTurns ?? 0) > 0;
    }
    if (object.otyp === FUMBLE_BOOTS) {
        hero.fumblingFromArmor = false;
        if (!object._fumbleBootsHadOtherSource)
            hero.fumblingTurns = 0;
        hero.fumbling = !!hero.fumblingIntrinsic
            || (hero.fumblingTurns ?? 0) > 0;
    }
    if (deferArmorClass)
        state._armorClassDirty = true;
    else
        findArmorClass(state);
    return true;
}
export function objectIsHardHelmet(object) {
    if (!object || armorSlotFor(object.otyp) !== 'uarmh')
        return false;
    const material = OBJECT_MATERIAL[object.otyp] ?? 0;
    return material >= IRON && material <= MITHRIL || material === GLASS;
}
export function wornArmorInDestroyOrder(state = game) {
    return ['uarm', 'uarmc', 'uarmh', 'uarms', 'uarmg', 'uarmf', 'uarmu']
        .map(slot => state[slot] || state.u?.[slot])
        .filter((object) => object != null);
}
// C do_wear.c:some_armor(). Only the outer torso layer is exposed; each
// other occupied slot has its own chance to replace the current choice.
export function someHeroArmor(state = game) {
    let armor = equippedObject(state, 'uarmc')
        || equippedObject(state, 'uarm') || equippedObject(state, 'uarmu');
    for (const slot of ['uarmh', 'uarmg', 'uarmf', 'uarms']) {
        const candidate = equippedObject(state, slot);
        if (candidate && (!armor || rn2(4) === 0))
            armor = candidate;
    }
    return armor;
}
// C do_wear.c:adj_abon(). The slot must still own the object when called,
// including the subtraction immediately before its *_off() transition.
export function adjustArmorAttributeBonus(object, amount, state = game) {
    if (!object || !amount)
        return;
    const attributes = object === equippedObject(state, 'uarmg')
        && object.otyp === GAUNTLETS_OF_DEXTERITY ? [A_DEX]
        : object === equippedObject(state, 'uarmh')
            && object.otyp === HELM_OF_BRILLIANCE ? [A_INT, A_WIS] : [];
    if (!attributes.length)
        return;
    const hero = state.u;
    hero.abon ||= { a: [0, 0, 0, 0, 0, 0] };
    for (const attribute of attributes)
        hero.abon.a[attribute] += amount;
    learnObjectType(object.otyp, state);
}
// C do_wear.c:destroy_arm(). Scroll damage bypasses grease but retains
// blessed-item protection, inventory resistances, billing, and destruction.
export async function erodeWornArmor(state = game) {
    const hits = rn2(4) + 1;
    const armors = wornArmorInDestroyOrder(state);
    if (!armors.length)
        return false;
    let damaged = false;
    for (let hit = 0; hit < hits; hit++) {
        const armor = armors[rn2(armors.length)];
        if (!armor)
            throw new Error('Armor erosion selected an invalid worn item');
        if (!erosionMatters(armor) || armor.oerodeproof)
            continue;
        const kind = ['burn', 'rust', 'crack', 'rot', 'corrosion']
            .find(candidate => objectIsVulnerableToErosion(armor, candidate, state));
        if (!kind)
            continue;
        const result = await erodeObject(armor, kind, {
            state, grease: false, pay: true, destroy: true,
        });
        if (result !== 'nothing')
            damaged = true;
        if (result === 'destroyed' || state.program_state?.gameover)
            break;
    }
    if (state.program_state?.gameover)
        return damaged;
    if (damaged)
        await stopHeroOccupation(state, plineWithContinuation);
    findArmorClass(state);
    return damaged;
}
export function objectErosionKind(object) {
    const material = OBJECT_MATERIAL[object.otyp];
    if ((material !== undefined && material <= 8 && material !== 1) || material === 18)
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
    if (erosion >= 3)
        return `Your ${name} ${verb} away!`;
    const adverb = erosion === 2 ? ' completely'
        : erosion ? ' further' : '';
    return `Your ${name} ${verb}${adverb}!`;
}
export async function destroyWornArmor(armor, state = game) {
    await removeWornHeroItem(armor, state);
    if (state.program_state?.gameover || !state.inventory.includes(armor))
        return false;
    await consumeInventoryItem(armor, state);
    return true;
}
// C do_wear.c:disintegrate_arm(), with a specified worn piece.
export async function disintegrateWornArmor(armor, { state = game, publish = plineWithContinuation, } = {}) {
    const slot = armorSlotFor(armor.otyp);
    if (!slot || equippedObject(state, slot) !== armor
        || objectResistsDestruction(armor, 0, 90))
        return false;
    armor.in_use = true;
    const noun = simpleArmorName(armor, slot, state);
    let message;
    switch (slot) {
        case 'uarmc':
            message = `Your ${noun} crumbles and turns to dust!`;
            break;
        case 'uarm': {
            if (armor.lamplit)
                endObjectBurn(armor, state);
            const plural = noun === 'dragon scales';
            const surface = surfaceName(state.u.ux, state.u.uy, state);
            message = `Your ${noun} ${plural ? 'turn' : 'turns'} to dust and ${plural ? 'fall' : 'falls'} to the ${surface}!`;
            break;
        }
        case 'uarmu':
            message = `Your ${noun} crumbles into tiny threads and falls apart!`;
            break;
        case 'uarmh':
            message = `Your ${noun} turns to dust and is blown away!`;
            break;
        case 'uarmg':
            message = `Your ${noun} vanish!`;
            break;
        case 'uarmf':
            message = `Your ${noun} disintegrate!`;
            break;
        case 'uarms':
            message = `Your ${noun} crumbles away!`;
            break;
    }
    await publish(message);
    if (state._delayedAction?.object === armor) {
        state._delayedAction = null;
        state.multi = 0;
    }
    await destroyWornArmor(armor, state);
    if (state.program_state?.gameover)
        return true;
    state._armorClassDirty = true;
    if (slot === 'uarmg') {
        const result = await selfTouchPetrifyingWeapons({ messageStart: 'You', state, publish });
        if (result.died)
            return true;
    }
    await stopHeroOccupation(state, publish);
    return true;
}
function simpleArmorName(armor, slot, state) {
    const name = OBJECT_NAMES[armor.otyp];
    if (!name)
        throw new RangeError(`Missing name for armor type ${armor.otyp}`);
    const appearance = state.objectDescriptions?.[armor.otyp]
        || OBJECT_DESCRIPTIONS[armor.otyp] || name;
    const known = objectTypeKnown(armor, state);
    switch (slot) {
        case 'uarm':
            if (name.endsWith('dragon scale mail'))
                return 'dragon mail';
            if (name.endsWith('dragon scales'))
                return 'dragon scales';
            if (name.endsWith(' mail'))
                return 'mail';
            return name.endsWith(' jacket') ? 'jacket' : 'suit';
        case 'uarmc':
            if (name === 'robe')
                return 'robe';
            if (name === 'mummy wrapping')
                return 'wrapping';
            if (name === 'alchemy smock')
                return known && armor.dknown ? 'smock' : 'apron';
            return 'cloak';
        case 'uarmh': return objectIsHardHelmet(armor) ? 'helm' : 'hat';
        case 'uarmu': return 'shirt';
        case 'uarmg':
            return armor.dknown && (known ? name : appearance).includes('gauntlets')
                ? 'gauntlets' : 'gloves';
        case 'uarmf':
            return armor.dknown && (appearance.includes('shoes') || known && name.includes('shoes'))
                ? 'shoes' : 'boots';
        case 'uarms':
            if (armor.otyp === SHIELD_OF_REFLECTION)
                return armor.dknown ? 'silver shield' : 'smooth shield';
            return 'shield';
    }
}
export function armorBaseBonus(otyp) {
    if (!Number.isInteger(otyp) || otyp < ARMOR_FIRST || otyp > ARMOR_LAST)
        return 0;
    return OBJECT_ARMOR_BONUS[otyp - ARMOR_FIRST] || 0;
}
function objectEnchantment(object) {
    if (object && Number.isInteger(object.spe) && object.spe !== undefined)
        return object.spe;
    if (object && Number.isInteger(object.enchantment) && object.enchantment !== undefined)
        return object.enchantment;
    return 0;
}
function greatestErosion(object) {
    return Math.max(0, object?.oeroded || 0, object?.oeroded2 || 0);
}
export function armorBonus(object) {
    if (!object)
        return 0;
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
    const color = name.match(/^([a-z]+) dragon scale(?: mail|s)$/)?.[1];
    if (color === undefined)
        return null;
    switch (color) {
        case 'black':
        case 'blue':
        case 'green':
        case 'red':
        case 'gold':
        case 'orange':
        case 'yellow':
        case 'white':
            return color;
        default: return null;
    }
}
function grantArmorProperty(object, state, property) {
    const hero = state.u;
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
export async function applyArmorOnEffects(object, state = game, { initialDon = false } = {}) {
    if (object?.otyp === LEVITATION_BOOTS)
        requireLiveGame(state);
    const previousLevitation = object?._levitationBeforeWear
        ?? captureLevitationState(state);
    applyWornArmorProperty(object, state);
    adjustArmorAttributeBonus(object, objectEnchantment(object), state);
    if (object?.otyp === LEVITATION_BOOTS) {
        delete object._levitationBeforeWear;
        if (!previousLevitation.hasSource && !previousLevitation.blockedByTerrain) {
            object.known = true;
            learnObjectType(object.otyp, state);
            await floatHeroUp(state, previousLevitation);
            if (propertyIsActive('levitation', state))
                await applyHeroLocationEffects(undefined, { pick: false });
        }
        else
            refreshMovementProperties(state);
        return [];
    }
    if (object?.otyp === FEDORA && state.urole?.key === 'archeologist') {
        // Helmet_on()/Helmet_off() use change_luck(), including its bounds.
        state.u.uluck = Math.min(LUCKMAX, (state.u.uluck ?? 0) + 1);
        return [];
    }
    if (object?.otyp === GAUNTLETS_OF_POWER)
        return [];
    if (object?.otyp === FUMBLE_BOOTS) {
        const hero = state.u;
        if (!object._fumbleBootsHadOtherSource) {
            hero.fumblingTurns = (hero.fumblingTurns ?? 0) + rnd(20);
        }
        hero.fumblingFromArmor = true;
        hero.fumbling = true;
        return [];
    }
    if (object?.otyp === CLOAK_OF_DISPLACEMENT) {
        // toggle_displacement() suppresses only its initial-don feedback.
        if (initialDon)
            return [];
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
                `You feel yourself speed up${object._speedBootsHadIntrinsicFast ? ' a bit more' : ''}.`,
            ];
        }
        return [];
    }
    const color = dragonArmorColor(object);
    const extraProperty = color ? DRAGON_ARMOR_EXTRA_PROPERTY[color] : null;
    if (!extraProperty)
        return [];
    const hero = state.u;
    const messages = [];
    const hadProperty = !!hero[extraProperty];
    const wasVeryFast = !!hero.veryFast;
    if (color !== 'gold')
        grantArmorProperty(object, state, extraProperty);
    if (color === 'blue') {
        if (!wasVeryFast)
            messages.push(`You speed up${hadProperty ? ' a bit more' : ''}.`);
    }
    else if (color === 'gold') {
        await makeHallucinated(0, {
            state, talk: !state.program_state?.restoring,
            resistanceSource: { object, slot: 'uarm' },
        });
    }
    else if (color === 'red') {
        state.vision_full_recalc = 1;
    }
    if (artifactEmitsLight(object) && !object.lamplit) {
        beginObjectBurn(object, state);
        if (!state.blind && !state.u.blindTurns) {
            const name = OBJECT_NAMES[object.otyp];
            if (!name)
                throw new RangeError(`Missing name for luminous armor type ${object.otyp}`);
            const verb = name.endsWith('scales') ? 'begin' : 'begins';
            messages.push(`Your ${name} ${verb} to shine ${equipmentLightDescription(object, state)}!`);
        }
    }
    return messages;
}
// C do_wear.c:set_wear(NULL). ini_inv_use_obj() has already installed
// the slots, so apply their callbacks without installing equipment again.
// Native starting inventory equips armor, weapons, and quiver only.
export async function applyStartingArmorEffects(state = game) {
    for (const slot of ['uarmu', 'uarm', 'uarmc', 'uarmf', 'uarmg', 'uarmh', 'uarms']) {
        const object = state[slot] || state.u?.[slot];
        if (!object)
            continue;
        const messages = await applyArmorOnEffects(object, state, { initialDon: true });
        if (state.program_state?.gameover)
            return;
        object.known = true;
        object._armorApplied = true;
        if (armorOnIdentifiesType(object, messages))
            learnObjectType(object.otyp, state);
        for (const message of messages)
            await plineWithContinuation(message);
    }
}
// C do_wear.c:Armor_off() removes both the ordinary dragon resistance and
// the color-specific extra property after the suit leaves W_ARM.
export async function removeArmorProperties(object, state = game) {
    const color = dragonArmorColor(object);
    const extraProperty = color ? DRAGON_ARMOR_EXTRA_PROPERTY[color] : null;
    const ordinaryProperty = OBJECT_PROPERTY[object?.otyp];
    const slot = armorSlotFor(object?.otyp);
    if (ordinaryProperty && slot)
        removeWornProperty(ordinaryProperty, object, slot, state);
    if (!extraProperty)
        return;
    if (color !== 'gold')
        removeWornProperty(extraProperty, object, 'uarm', state);
    const hero = state.u;
    if (color === 'blue') {
        object._grantsVeryFastFromArmor = false;
        hero.veryFastFromArmor = (state.inventory || []).some(candidate => candidate !== object && candidate.worn
            && candidate._grantsVeryFastFromArmor);
        hero.veryFast = hero.veryFastFromArmor
            || (hero.veryFastTurns ?? 0) > 0;
    }
    else if (color === 'gold') {
        await makeHallucinated(1, {
            state, talk: !state.program_state?.restoring,
            resistanceSource: { object, slot: 'uarm' },
        });
    }
    else if (color === 'red') {
        state.vision_full_recalc = 1;
    }
}
function equippedObject(state, slot) {
    if (Object.prototype.hasOwnProperty.call(state, slot))
        return state[slot];
    return state.u?.[slot] || null;
}
function protectionItemBonus(object, expectedType) {
    return object?.otyp === expectedType ? objectEnchantment(object) : 0;
}
// Rebuild current AC from authoritative equipment state. The default base is
// human AC 10; polymorph can supply `formArmorClass` without changing callers.
export function projectedArmorClass(state = game) {
    const hero = state.u;
    let armorClass = typeof hero.formArmorClass === 'number' && Number.isInteger(hero.formArmorClass)
        ? hero.formArmorClass
        : typeof hero.baseArmorClass === 'number' && Number.isInteger(hero.baseArmorClass) ? hero.baseArmorClass : 10;
    for (const slot of ARMOR_SLOTS)
        armorClass -= armorBonus(equippedObject(state, slot));
    armorClass -= protectionItemBonus(equippedObject(state, 'uleft'), RIN_PROTECTION);
    armorClass -= protectionItemBonus(equippedObject(state, 'uright'), RIN_PROTECTION);
    if (equippedObject(state, 'uamul')?.otyp === AMULET_OF_GUARDING)
        armorClass -= 2;
    if (hasIntrinsicProperty('protection', null, state))
        armorClass -= hero.ublessed || 0;
    armorClass -= hero.uspellprot || 0;
    return Math.max(-AC_MAX, Math.min(AC_MAX, armorClass));
}
export function findArmorClass(state = game) {
    const hero = state.u;
    hero._magicNegation = magicNegation(hero, state);
    hero.uac = projectedArmorClass(state);
    return hero.uac;
}
export function armorSimpleName(object, state = game) {
    const slot = armorSlotFor(object?.otyp);
    const actualName = OBJECT_NAMES[object?.otyp] || object?.name || 'armor';
    const description = state.objectDescriptions?.[object?.otyp]
        ?? OBJECT_DESCRIPTIONS[object?.otyp] ?? '';
    const dknown = object?.dknown !== false;
    const typeKnown = objectTypeKnown(object, state);
    if (slot === 'uarm') {
        if (/ dragon scale mail$/i.test(actualName))
            return 'dragon mail';
        if (/ dragon scales$/i.test(actualName))
            return 'dragon scales';
        if (/ mail$/i.test(actualName))
            return 'mail';
        if (/ jacket$/i.test(actualName))
            return 'jacket';
        return 'suit';
    }
    if (slot === 'uarmc') {
        if (actualName === 'robe')
            return 'robe';
        if (actualName === 'mummy wrapping')
            return 'wrapping';
        if (actualName === 'alchemy smock')
            return typeKnown && dknown ? 'smock' : 'apron';
        return 'cloak';
    }
    if (slot === 'uarmh') {
        const softHeadgear = new Set([
            'elven leather helm', 'fedora', 'cornuthaum', 'dunce cap',
        ]);
        return softHeadgear.has(actualName) ? 'hat' : 'helm';
    }
    if (slot === 'uarmg') {
        const perceivedName = typeKnown ? actualName : description;
        return dknown && /gauntlets/i.test(perceivedName)
            ? 'gauntlets' : 'gloves';
    }
    if (slot === 'uarmf') {
        return dknown
            && (/shoes/i.test(description)
                || (typeKnown && /shoes/i.test(actualName)))
            ? 'shoes' : 'boots';
    }
    if (slot === 'uarms') {
        if (object?.otyp === SHIELD_OF_REFLECTION)
            return dknown ? 'silver shield' : 'smooth shield';
        return 'shield';
    }
    if (slot === 'uarmu')
        return 'shirt';
    return actualName;
}
export function armorOffMessage(object, state = game) {
    if (state.flags?.verbose === false)
        return '';
    observeObjectForNaming(object, { state });
    return `You were wearing ${inventoryItemDescription(object)}.`;
}
// C stop_donning(): a cancelled dressing action loses its incomplete armor;
// interrupted removal leaves the item worn.
export async function stopDonning(stolenObject = null, state = game) {
    const delayed = state._delayedAction;
    if (!delayed) {
        const progress = state.context.takeoff;
        const slot = progress?.current;
        const object = slot ? takeoffSlotObject(slot, state) : null;
        if (!progress || !object || !((object.owornmask ?? 0) & W_ARMOR))
            return false;
        progress.current = null;
        progress.delay = 0;
        state.multi = 0;
        if (object !== stolenObject) {
            const name = simpleObjectNameWithArticle(object, state).replace(/^(?:a|an) /, '');
            await plineWithContinuation(`You stop taking off the ${name}.`);
        }
        return false;
    }
    const puttingOn = delayed.kind === 'wear';
    state._delayedAction = null;
    state.multi = 0;
    if (puttingOn || delayed.object !== stolenObject) {
        await plineWithContinuation(`You stop ${puttingOn ? 'putting on' : 'taking off'} your ${armorSimpleName(delayed.object, state)}.`);
    }
    if (puttingOn)
        await removeHeroArmor(delayed.object, state, { cancelledDon: true });
    return true;
}
//# sourceMappingURL=armor.js.map