// armor.js — Hero armor-class projection.
// C refs: do_wear.c find_ac() and hack.h ARM_BONUS().

import { heroDetectsMonsters, heroIsBlind } from './senses.js';
import { makeHallucinated } from './hero_mental_status.js';
import { game, requireLiveGame } from './gstate.js';
import { corpseName, killerObjectName, observeObjectForNaming, simpleObjectNameWithArticle, objectName } from './objnam.js';
import { heroHandName } from './body_parts.js';
import { makePlural } from './object_grammar.js';
import { displayColorName, newsym, plineWithContinuation, see_monsters } from './display.js';
import { consumeInventoryItem, inventoryItemDescription } from './invent.js';
import { objectResistsDestruction } from './object_state.js';
import { erodeObject, erosionMatters, objectIsVulnerableToErosion } from './object_erosion.js';
import { stopHeroOccupation } from './occupation.js';
import { objectTypeKnown } from './shk.js';
import {
    heroResistsStoning, resolveImmediatePetrification,
    selfTouchPetrifyingWeapons, touchPetrifies,
} from './stoning.js';
import { setSlipperyHands } from './towel.js';
import { releaseWeaponSlots } from './weapon_slots.js';
import { surfaceName } from './terrain_name.js';
import { heroFormClings } from './polyself.js';
import { isLavaAt, isPoolAt, levelHasCeiling } from './terrain_properties.js';
import { removeWornHeroItem } from './hero_equipment.js';
import { cancelSlotTakeoff, takeoffSlotObject } from './takeoff_state.js';
import { learnObjectType } from './object_knowledge.js';
import { floatHeroDown, floatHeroUp } from './terrain_movement.js';
import { applyHeroLocationEffects } from './cmd.js';
import { artifactEmitsLight, heroHasArtifactDefense } from './artifacts.js';
import { heroResistsLifeDrain } from './monster_resistance.js';
import { beginObjectBurn, endObjectBurn, equipmentLightDescription, equipmentLightMessage } from './light.js';
import {
    AMULET_OF_GUARDING, ALCHEMY_SMOCK, CLOAK_OF_DISPLACEMENT, CLOAK_OF_PROTECTION, CORPSE, ELVEN_BOOTS, ELVEN_CLOAK, GAUNTLETS_OF_FUMBLING, GAUNTLETS_OF_POWER, CORNUTHAUM, DUNCE_CAP, MUMMY_WRAPPING,
    FEDORA, FUMBLE_BOOTS, LEVITATION_BOOTS, RIN_FREE_ACTION, RIN_PROTECTION,
    GRAY_DRAGON_SCALE_MAIL, GRAY_DRAGON_SCALES,
    YELLOW_DRAGON_SCALE_MAIL, YELLOW_DRAGON_SCALES,
    SHIELD_OF_DRAIN_RESISTANCE, SHIELD_OF_REFLECTION,
    OBJECT_DESCRIPTIONS, OBJECT_MATERIAL, OBJECT_NAMES, OBJECT_PROPERTY,
    WATER_WALKING_BOOTS,
} from './object_data.js';
import { rn2, rnd } from './rng.js';
import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { PropertyName, WornPropertySlot } from './property_types.js';
import type { MessagePublisher } from './display.js';
import { currentAttribute } from './attrib.js';
import { curseObjectState } from './object_state.js';
import { heroIsHallucinating } from './senses.js';
import type { AttributeIndex } from './attrib.js';

interface ArmorRemovalOptions { cancelledDon?: boolean; deferArmorClass?: boolean }
interface ArmorOnOptions { initialDon?: boolean }
interface ArmorDestructionOptions { state?: GameState; publish?: MessagePublisher }
export interface ArmorErosionDescription {
    field: 'oeroded' | 'oeroded2';
    action: 'smoulder' | 'rust' | 'crack' | 'rot' | 'corrode';
}

type ArmorBonusSource = Pick<GameObject, 'otyp'>
    & Partial<Pick<GameObject, 'spe' | 'enchantment' | 'oeroded' | 'oeroded2'>>;

import { monsterName } from './monster_name.js';
import { MONSTER_NAME } from './monster_data.js';
import {
    captureLevitationState, grantWornProperty, hasIntrinsicProperty, hasWornProperty,
    propertyIsActive, propertyIsBlocked, propertyTimeout, refreshMovementProperties, refreshProperty, removeWornProperty, setPropertyTimeout,
} from './properties.js';
import {
    A_CHA, A_DEX, A_INT, A_WIS, LUCKMIN, LUCKMAX,
    W_ARM, W_ARMC, W_ARMF, W_ARMG, W_ARMH, W_ARMOR, W_ARMS, W_ARMU,
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
] as const);
const ARMOR_MASKS = Object.freeze({
    uarm: W_ARM,
    uarmc: W_ARMC,
    uarmh: W_ARMH,
    uarms: W_ARMS,
    uarmg: W_ARMG,
    uarmf: W_ARMF,
    uarmu: W_ARMU,
});
export type ArmorSlot = keyof typeof ARMOR_MASKS;

const AC_MAX = 99;
const SPEED_BOOTS = 166;
const CLOAK_OF_INVISIBILITY = OBJECT_NAMES.indexOf('cloak of invisibility');
const HELM_OF_CAUTION = OBJECT_NAMES.indexOf('helm of caution');
const HELM_OF_TELEPATHY = OBJECT_NAMES.indexOf('helm of telepathy');
const OILSKIN_CLOAK = OBJECT_NAMES.indexOf('oilskin cloak');
const GAUNTLETS_OF_DEXTERITY = OBJECT_NAMES.indexOf('gauntlets of dexterity');
const HELM_OF_BRILLIANCE = OBJECT_NAMES.indexOf('helm of brilliance');

// C armor_to_dragon(): scales and scale mail use the same color order.
export function dragonFormForArmor(object: Pick<GameObject, 'otyp'> | null | undefined) {
    const type = object?.otyp;
    if (type === undefined) return null;
    const firstDragon = MONSTER_NAME.indexOf('gray dragon');
    if (type >= GRAY_DRAGON_SCALE_MAIL && type <= YELLOW_DRAGON_SCALE_MAIL)
        return firstDragon + type - GRAY_DRAGON_SCALE_MAIL;
    if (type >= GRAY_DRAGON_SCALES && type <= YELLOW_DRAGON_SCALES)
        return firstDragon + type - GRAY_DRAGON_SCALES;
    return null;
}

export function heroIsDisplaced(state: GameState = game) {
    const cloak = state?.uarmc || state?.u?.uarmc;
    return cloak?.otyp === CLOAK_OF_DISPLACEMENT
        || !!state?.displaced
        || !!state?.u?.displaced
        || (state?.u?.displacedTurns ?? 0) > 0;
}

// C youprop.h:Drain_resistance includes both intrinsic sources and the shield
// currently installed by setworn().
export function heroHasDrainResistance(state: GameState = game) {
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
export function heroHasFreeAction(state: GameState = game) {
    const hero = state.u;
    const left = state?.uleft || hero.uleft;
    const right = state?.uright || hero.uright;
    return !!(hero.freeAction
        || left?.otyp === RIN_FREE_ACTION
        || right?.otyp === RIN_FREE_ACTION);
}

export function heroHasWaterWalking(state: GameState = game) {
    const hero = state.u;
    const boots = state?.uarmf || hero.uarmf;
    return !!(hero.waterWalking
        || boots?.otyp === WATER_WALKING_BOOTS);
}

export function heroKnowsWaterWalking(state: GameState = game) {
    const hero = state.u;
    const boots = state?.uarmf || hero.uarmf;
    const typeKnown = boots?.typeKnown
        || state?._knownObjectTypes?.has(WATER_WALKING_BOOTS);
    return !hero.usteed && boots?.otyp === WATER_WALKING_BOOTS && !!typeKnown;
}

export function heroKnowsLavaWalking(state: GameState = game) {
    if (!heroKnowsWaterWalking(state)) return false;
    const hero = state.u;
    const boots = state?.uarmf || hero.uarmf;
    const fireResistant = hero.fireResistance;
    return !!fireResistant && !!boots?.oerodeproof && !!boots.rknown;
}

// do_wear.c's *_on() callbacks distinguish the physical worn property from
// the observable feedback which identifies the shuffled object type.
export function armorOnIdentifiesType(object: GameObject | null | undefined, effectMessages: readonly string[] = []) {
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
export function armorSlotFor(otyp: number | undefined): ArmorSlot | null {
    if (otyp === undefined) return null;
    if (otyp >= 89 && otyp <= 100) return 'uarmh';
    if (otyp >= 101 && otyp <= 135) return 'uarm';
    if (otyp >= 136 && otyp <= 137) return 'uarmu';
    if (otyp >= 138 && otyp <= 149) return 'uarmc';
    if (otyp >= 150 && otyp <= 158) return 'uarms';
    if (otyp >= 159 && otyp <= 162) return 'uarmg';
    if (otyp >= 163 && otyp <= 172) return 'uarmf';
    return null;
}

export function applyWornArmorProperty(object: GameObject, state: GameState = game) {
    const slot = armorSlotFor(object?.otyp);
    const property = OBJECT_PROPERTY[object?.otyp];
    if (!slot || !property) return null;
    grantWornProperty(property, object, slot, state);
    return property;
}

export function wearHeroArmor(object: GameObject, state: GameState = game): ArmorSlot | null {
    const slot = armorSlotFor(object?.otyp);
    if (!slot) return null;
    const hero = state.u;
    const previous = equippedObject(state, slot);
    if (previous && previous !== object) cancelSlotTakeoff(slot, state);
    // setworn() installs physical properties immediately. The later *_on()
    // callback needs the sources that existed before that installation.
    if (object.otyp === LEVITATION_BOOTS)
        object._levitationBeforeWear = captureLevitationState(state);
    if (object.otyp === WATER_WALKING_BOOTS)
        object._waterWalkingWasInWater = !!state.u.uinwater;
    if (object.otyp === CLOAK_OF_DISPLACEMENT)
        object._displacementWasActive = heroIsDisplaced(state);
    if (object.otyp === SPEED_BOOTS) {
        object._grantsVeryFastFromArmor = true;
        hero.veryFastFromArmor = true;
        hero.veryFast = true;
    }
    state[slot] = object;
    if (state.u) state.u[slot] = object;
    object.worn = true;
    object.wornSlot = slot;
    object.owornmask = (object.owornmask ?? 0) | ARMOR_MASKS[slot];
    applyWornArmorProperty(object, state);
    if (object.otyp === MUMMY_WRAPPING) refreshProperty('invisible', state);
    if (object.otyp === CORNUTHAUM) {
        state.u.clairvoyanceBlocked = state.urole?.key !== 'wizard';
        refreshProperty('clairvoyant', state);
    }
    return slot;
}

export async function removeHeroArmor(object: GameObject, state: GameState = game, options: ArmorRemovalOptions = {}) {
    if (object.otyp === LEVITATION_BOOTS || object.otyp === WATER_WALKING_BOOTS)
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
    if (object.otyp === CORNUTHAUM && !cancelledDon) {
        state.u.abon ??= { a: [0, 0, 0, 0, 0, 0] };
        state.u.abon.a[A_CHA] += state.urole?.key === 'wizard' ? -1 : 1;
        state.context.botl = true;
    }
    const removed = await clearHeroArmor(object, state, { ...options, cancelledDon });
    if (removed && (object.otyp === HELM_OF_TELEPATHY || object.otyp === HELM_OF_CAUTION))
        await see_monsters();
    if (removed) {
        if (!cancelledDon) await announceDisplacementLoss(object, state);
        await applyCloakOffEffects(object, state);
        if (object.otyp === SPEED_BOOTS && !state.u.veryFast && !cancelledDon) {
            learnObjectType(object.otyp, state);
            await plineWithContinuation(`You feel yourself slow down${state.u.fast ? ' a bit' : ''}.`);
        }
        if (dragonArmorColor(object) === 'blue' && !state.u.veryFast && !cancelledDon)
            await plineWithContinuation('You slow down.');
        if (!cancelledDon && (object.otyp === ELVEN_CLOAK || object.otyp === ELVEN_BOOTS))
            await toggleArmorStealth(object, false, state);
    }
    if (losingGloves) {
        setSlipperyHands(0, state);
        await loseGloveProtection(object, state);
        if (state.program_state?.gameover) return removed;
    }
    // C Boots_off(): identify before spoteffects(), which can kill the hero.
    if (removed && object.otyp === WATER_WALKING_BOOTS
        && (isPoolAt(state.u.ux, state.u.uy, state) || isLavaAt(state.u.ux, state.u.uy, state))
        && !propertyIsActive('levitation', state) && !propertyIsActive('flying', state)
        && !(heroFormClings(state) && levelHasCeiling(state))
        && !cancelledDon && !state.iflags.in_lava_effects) {
        learnObjectType(object.otyp, state);
        await applyHeroLocationEffects();
    }
    if (removed && object.otyp === LEVITATION_BOOTS) {
        const remaining = captureLevitationState(state);
        if (!remaining.hasSource && !previousLevitation.blockedByTerrain
            && !cancelledDon) {
            if (!state.iflags?.in_lava_effects)
                await floatHeroDown(0, 0, state, previousLevitation);
            learnObjectType(object.otyp, state);
        } else refreshMovementProperties(state);
        delete object._levitationBeforeWear;
    }
    return removed;
}

// C Cloak_off(): toggle_displacement() runs after the cloak's source is removed.
async function announceDisplacementLoss(object: GameObject, state: GameState = game): Promise<void> {
    if (object.otyp !== CLOAK_OF_DISPLACEMENT) return;
    const hero = state.u;
    if (propertyIsActive('displaced', state)
        || hero.displacedIntrinsic || hero.intrinsicDisplacement
        || hero.displacementBlocked || hero.displacedBlocked) return;
    if (!canObserveDisplacement(state)) return;
    learnObjectType(object.otyp, state);
    await plineWithContinuation('You feel that monsters no longer have difficulty pinpointing your location.');
}

// C Gloves_off(): wielding_corpse(). Glove loss resolves life saving or
// stone-golem transformation before the armor's destruction can continue.
async function loseGloveProtection(gloves: GameObject, state: GameState) {
    const slots: readonly ('uwep' | 'uswapwep')[] = state.u.twoweap
        ? ['uwep', 'uswapwep'] : ['uwep'];
    for (const slot of slots) {
        const weapon = equippedObject(state, slot);
        if (weapon?.otyp !== CORPSE || !touchPetrifies(weapon.corpsenm)
            || heroResistsStoning(state)) continue;
        await plineWithContinuation(`You now wield ${corpseName(weapon, { includeArticle: true })} `
            + `in your bare ${makePlural(heroHandName(state))}.`);
        const voluntary = !state.context?.mon_moving && !gloves.in_use;
        const killer = `${voluntary ? 'removing' : 'losing'} ${simpleArmorName(gloves, 'uarmg', state)} `
            + `while wielding ${killerObjectName(weapon, state)}`;
        const result = await resolveImmediatePetrification({ killer, state });
        if (result.died) return;
        if (!heroResistsStoning(state)) await releaseWeaponSlots(weapon, state);
    }
}

// Slot/source removal without the Boots_off() transition.
export async function clearHeroArmor(object: GameObject, state: GameState = game, {
    cancelledDon = state._delayedAction?.kind === 'wear'
        && state._delayedAction.object === object,
    deferArmorClass = false,
}: ArmorRemovalOptions = {}) {
    const slot = armorSlotFor(object?.otyp);
    if (!slot) return false;
    if (equippedObject(state, slot) === object) cancelSlotTakeoff(slot, state);
    if (equippedObject(state, slot) === object && !cancelledDon)
        adjustArmorAttributeBonus(object, -objectEnchantment(object), state);
    const wasShining = object.lamplit && artifactEmitsLight(object);
    if (state[slot] === object) state[slot] = null;
    if (state.u?.[slot] === object) state.u[slot] = null;
    object.worn = false;
    object.wornSlot = null;
    object.owornmask = (object.owornmask ?? 0) & ~ARMOR_MASKS[slot];
    if (wasShining && !artifactEmitsLight(object)) {
        endObjectBurn(object, state);
        if (!heroIsBlind(state))
            await plineWithContinuation(equipmentLightMessage(object, false, state));
    }
    await removeArmorProperties(object, state);
    if (object.otyp === CORNUTHAUM) {
        state.u.clairvoyanceBlocked = false;
        refreshProperty('clairvoyant', state);
    }
    if (object.otyp === DUNCE_CAP) state.context.botl = true;
    if (object.otyp === ALCHEMY_SMOCK) removeWornProperty('acidResistance', object, 'uarmc', state);
    if (object.otyp === MUMMY_WRAPPING) refreshProperty('invisible', state);

    const hero = state.u;
    object._armorApplied = false;
    delete object._waterWalkingWasInWater;
    if (object.otyp === GAUNTLETS_OF_POWER) state.context.botl = true;
    if (object.otyp === SPEED_BOOTS) object._grantsVeryFastFromArmor = false;
    if ((object.otyp === FUMBLE_BOOTS || object.otyp === GAUNTLETS_OF_FUMBLING)
        && !fumblingHasPermanentOrEquipmentSource(state))
        setPropertyTimeout('fumbling', 0, state);
    if (deferArmorClass) state._armorClassDirty = true;
    else findArmorClass(state);
    return true;
}

export function objectIsHardHelmet(object: Pick<GameObject, 'otyp'> | null | undefined) {
    if (!object || armorSlotFor(object.otyp) !== 'uarmh') return false;
    const material = OBJECT_MATERIAL[object.otyp] ?? 0;
    return material >= IRON && material <= MITHRIL || material === GLASS;
}

export function wornArmorInDestroyOrder(state: GameState = game) {
    return (['uarm', 'uarmc', 'uarmh', 'uarms', 'uarmg', 'uarmf', 'uarmu'] as const)
        .map(slot => state[slot] || state.u?.[slot])
        .filter((object): object is GameObject => object != null);
}

// C do_wear.c:some_armor(). Only the outer torso layer is exposed; each
// other occupied slot has its own chance to replace the current choice.
export function someHeroArmor(state: GameState = game) {
    let armor = equippedObject(state, 'uarmc')
        || equippedObject(state, 'uarm') || equippedObject(state, 'uarmu');
    for (const slot of ['uarmh', 'uarmg', 'uarmf', 'uarms'] as const) {
        const candidate = equippedObject(state, slot);
        if (candidate && (!armor || rn2(4) === 0)) armor = candidate;
    }
    return armor;
}

// C do_wear.c:adj_abon(). The slot must still own the object when called,
// including the subtraction immediately before its *_off() transition.
export function adjustArmorAttributeBonus(object: GameObject | null | undefined, amount: number, state: GameState = game) {
    if (!object) return;
    const attributes: AttributeIndex[] = object === equippedObject(state, 'uarmg')
        && object.otyp === GAUNTLETS_OF_DEXTERITY ? [A_DEX]
        : object === equippedObject(state, 'uarmh')
            && object.otyp === HELM_OF_BRILLIANCE ? [A_INT, A_WIS] : [];
    if (!attributes.length) return;
    state.context.botl = true;
    if (!amount) return;
    const hero = state.u;
    hero.abon ||= { a: [0, 0, 0, 0, 0, 0] };
    for (const attribute of attributes) hero.abon.a[attribute] += amount;
    learnObjectType(object.otyp, state);
}

// C do_wear.c:destroy_arm(). Scroll damage bypasses grease but retains
// blessed-item protection, inventory resistances, billing, and destruction.
export async function erodeWornArmor(state: GameState = game) {
    const hits = rn2(4) + 1;
    const armors = wornArmorInDestroyOrder(state);
    if (!armors.length) return false;
    let damaged = false;
    for (let hit = 0; hit < hits; hit++) {
        const armor = armors[rn2(armors.length)];
        if (!armor) throw new Error('Armor erosion selected an invalid worn item');
        if (!erosionMatters(armor) || armor.oerodeproof) continue;
        const kind = (['burn', 'rust', 'crack', 'rot', 'corrosion'] as const)
            .find(candidate => objectIsVulnerableToErosion(armor, candidate, state));
        if (!kind) continue;
        const result = await erodeObject(armor, kind, {
            state, grease: false, pay: true, destroy: true,
        });
        if (result !== 'nothing') damaged = true;
        if (result === 'destroyed' || state.program_state?.gameover) break;
    }
    if (state.program_state?.gameover) return damaged;
    if (damaged) await stopHeroOccupation(state, plineWithContinuation);
    if (state.context.mon_moving) state._armorClassDirty = true;
    else findArmorClass(state);
    return damaged;
}

export function objectErosionKind(object: Pick<GameObject, 'otyp' | 'oclass'>): ArmorErosionDescription | null {
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

export function objectErosionMessage(object: GameObject, kind: ArmorErosionDescription) {
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

export async function destroyWornArmor(armor: GameObject, state: GameState = game) {
    await removeWornHeroItem(armor, state);
    if (state.program_state?.gameover || !state.inventory.includes(armor)) return false;
    await consumeInventoryItem(armor, state);
    return true;
}

// C do_wear.c:disintegrate_arm(), with a specified worn piece.
export async function disintegrateWornArmor(armor: GameObject, {
    state = game, publish = plineWithContinuation,
}: ArmorDestructionOptions = {}) {
    const slot = armorSlotFor(armor.otyp);
    if (!slot || equippedObject(state, slot) !== armor
        || objectResistsDestruction(armor, 0, 90)) return false;
    armor.in_use = true;
    const noun = simpleArmorName(armor, slot, state);
    let message;
    switch (slot) {
    case 'uarmc': message = `Your ${noun} crumbles and turns to dust!`; break;
    case 'uarm': {
        if (armor.lamplit) endObjectBurn(armor, state);
        const plural = noun === 'dragon scales';
        const surface = surfaceName(state.u.ux, state.u.uy, state);
        message = `Your ${noun} ${plural ? 'turn' : 'turns'} to dust and ${plural ? 'fall' : 'falls'} to the ${surface}!`;
        break;
    }
    case 'uarmu': message = `Your ${noun} crumbles into tiny threads and falls apart!`; break;
    case 'uarmh': message = `Your ${noun} turns to dust and is blown away!`; break;
    case 'uarmg': message = `Your ${noun} vanish!`; break;
    case 'uarmf': message = `Your ${noun} disintegrate!`; break;
    case 'uarms': message = `Your ${noun} crumbles away!`; break;
    }
    await publish(message);
    if (state._delayedAction?.object === armor) {
        state._delayedAction = null;
        state.multi = 0;
    }
    await destroyWornArmor(armor, state);
    if (state.program_state?.gameover) return true;
    state._armorClassDirty = true;
    if (slot === 'uarmg') {
        const result = await selfTouchPetrifyingWeapons({ messageStart: 'You', state, publish });
        if (result.died) return true;
    }
    await stopHeroOccupation(state, publish);
    return true;
}

export function simpleArmorName(armor: GameObject, slot: ArmorSlot, state: GameState): string {
    const name = OBJECT_NAMES[armor.otyp];
    if (!name) throw new RangeError(`Missing name for armor type ${armor.otyp}`);
    const appearance = state.objectDescriptions?.[armor.otyp]
        || OBJECT_DESCRIPTIONS[armor.otyp] || name;
    const known = objectTypeKnown(armor, state);
    switch (slot) {
    case 'uarm':
        if (name.endsWith('dragon scale mail')) return 'dragon mail';
        if (name.endsWith('dragon scales')) return 'dragon scales';
        if (name.endsWith(' mail')) return 'mail';
        return name.endsWith(' jacket') ? 'jacket' : 'suit';
    case 'uarmc':
        if (name === 'robe') return 'robe';
        if (name === 'mummy wrapping') return 'wrapping';
        if (name === 'alchemy smock') return known && armor.dknown ? 'smock' : 'apron';
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

export function armorBaseBonus(otyp: number) {
    if (!Number.isInteger(otyp) || otyp < ARMOR_FIRST || otyp > ARMOR_LAST)
        return 0;
    return OBJECT_ARMOR_BONUS[otyp - ARMOR_FIRST] || 0;
}

function objectEnchantment(object: ArmorBonusSource | null | undefined): number {
    if (object && Number.isInteger(object.spe) && object.spe !== undefined) return object.spe;
    if (object && Number.isInteger(object.enchantment) && object.enchantment !== undefined) return object.enchantment;
    return 0;
}

function greatestErosion(object: ArmorBonusSource) {
    return Math.max(0,
        object?.oeroded || 0,
        object?.oeroded2 || 0);
}

export function armorBonus(object: ArmorBonusSource | null | undefined) {
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
} as const);

function dragonArmorColor(object: GameObject): keyof typeof DRAGON_ARMOR_EXTRA_PROPERTY | null {
    const name = OBJECT_NAMES[object?.otyp] || '';
    const color = name.match(/^([a-z]+) dragon scale(?: mail|s)$/)?.[1];
    if (color === undefined) return null;
    switch (color) {
    case 'black': case 'blue': case 'green': case 'red':
    case 'gold': case 'orange': case 'yellow': case 'white':
        return color;
    default: return null;
    }
}

function grantArmorProperty(object: GameObject, state: GameState, property: PropertyName) {
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

async function applyHelmetOnEffects(object: GameObject, state: GameState): Promise<void> {
    if (object.otyp === CORNUTHAUM) {
        state.u.abon ??= { a: [0, 0, 0, 0, 0, 0] };
        state.u.abon.a[A_CHA] += state.urole?.key === 'wizard' ? 1 : -1;
        state.context.botl = true;
        learnObjectType(object.otyp, state);
    } else if (object.otyp === DUNCE_CAP) {
        if (!object.cursed) {
            const blind = heroIsBlind(state);
            const action = blind ? 'vibrates' : `glows ${displayColorName('black', state)}`;
            await plineWithContinuation(`The ${objectName(object)} ${action} for a moment.`);
            curseObjectState(object, state);
            if (blind) object.bknown = false;
            else if (state.urole?.key === 'priest') object.bknown = true;
        }
        state.context.botl = true;
        const intelligence = (state.u.acurr?.a[A_INT] ?? 10)
            + (state.u.abon?.a[A_INT] ?? 0) + (state.u.atemp?.a[A_INT] ?? 0);
        await plineWithContinuation(heroIsHallucinating(state) ? 'My brain hurts!'
            : `You feel ${currentAttribute(A_INT, state) <= intelligence ? 'like sitting in a corner' : 'giddy'}.`);
    } else if (object.otyp === HELM_OF_CAUTION) await see_monsters();
}

function fumblingHasPermanentOrEquipmentSource(state: GameState): boolean {
    const sources = state.u._propertySources?.fumbling;
    return hasIntrinsicProperty('fumbling', null, state) || hasWornProperty('fumbling', state)
        || !!sources?.invoked || !!sources?.carried.length
        || !!state.u.fumblingIntrinsic || !!state.u.fumblingFromIce;
}

function armorHasOtherPropertySource(property: PropertyName, object: GameObject, state: GameState): boolean {
    const sources = state.u._propertySources?.[property];
    const slot = armorSlotFor(object.otyp);
    return hasIntrinsicProperty(property, null, state) || propertyTimeout(property, state) > 0
        || !!sources?.invoked || !!sources?.carried.length
        || !!sources?.worn.some(source => source.slot !== slot);
}

async function toggleArmorStealth(object: GameObject, on: boolean, state: GameState): Promise<void> {
    if (armorHasOtherPropertySource('stealth', object, state) || propertyIsBlocked('stealth', state)
        || state.u.usteed && !propertyIsActive('flying', state) && !propertyIsActive('levitation', state)) return;
    learnObjectType(object.otyp, state);
    if (on) {
        const message = object.otyp === ELVEN_BOOTS
            ? propertyIsActive('levitation', state) || propertyIsActive('flying', state)
                ? 'You float imperceptibly.' : 'You walk very quietly.'
            : 'You move very quietly.';
        await plineWithContinuation(message);
    } else {
        const steed = state.u.usteed;
        await plineWithContinuation(steed
            ? `You and ${monsterName(steed, { state, article: 'your', suppressSaddle: true, suppressHallucination: true })} are noisy.`
            : 'You sure are noisy.');
    }
}

function canObserveDisplacement(state: GameState): boolean {
    const blind = heroIsBlind(state);
    const invisible = propertyIsActive('invisible', state) && !propertyIsActive('seeInvisible', state);
    return !blind && !state.u.uswallow && !invisible
        || hasWornProperty('telepathy', state) || !!state.u.unblindTelepathy
        || (state.u.unblind_telepat_range ?? -1) >= 0
        || blind && (propertyIsActive('telepathy', state) || !!state.u.blindTelepathy)
        || heroDetectsMonsters(state);
}

async function applyCloakOnEffects(object: GameObject, state: GameState): Promise<void> {
    switch (object.otyp) {
    case CLOAK_OF_PROTECTION: learnObjectType(object.otyp, state); break;
    case MUMMY_WRAPPING:
        if (armorHasOtherPropertySource('invisible', object, state) && !heroIsBlind(state)) {
            newsym(state.u.ux, state.u.uy);
            await plineWithContinuation(`You can ${propertyIsActive('seeInvisible', state) ? 'no longer see through yourself' : 'see yourself'}!`);
        }
        break;
    case CLOAK_OF_INVISIBILITY:
        if (!armorHasOtherPropertySource('invisible', object, state) && !heroIsBlind(state)) {
            learnObjectType(object.otyp, state);
            newsym(state.u.ux, state.u.uy);
            await plineWithContinuation(`Suddenly you can${propertyIsActive('seeInvisible', state) ? ' see through' : 'not see'} yourself.`);
        }
        break;
    case OILSKIN_CLOAK:
        await plineWithContinuation(`The ${objectName(object)} fits very tightly.`);
        break;
    case ALCHEMY_SMOCK: grantWornProperty('acidResistance', object, 'uarmc', state); break;
    default: break;
    }
}

async function applyCloakOffEffects(object: GameObject, state: GameState): Promise<void> {
    if (heroIsBlind(state)) return;
    if (object.otyp === MUMMY_WRAPPING && propertyIsActive('invisible', state)) {
        newsym(state.u.ux, state.u.uy);
        await plineWithContinuation(`You can ${propertyIsActive('seeInvisible', state) ? 'see through yourself' : 'no longer see yourself'}.`);
    } else if (object.otyp === CLOAK_OF_INVISIBILITY && !armorHasOtherPropertySource('invisible', object, state)) {
        learnObjectType(object.otyp, state);
        newsym(state.u.ux, state.u.uy);
        await plineWithContinuation(`Suddenly you can ${propertyIsActive('seeInvisible', state) ? 'no longer see through yourself' : 'see yourself'}.`);
    }
}

// C do_wear.c:Armor_on() -> dragon_armor_handling().  Dragon armor's AC is
// active as soon as setworn() installs the slot, but these extrinsics and
// their feedback are afternmv effects: they begin only when dressing reaches
// multi == 0.  Return messages so allmain can preserve nomovemsg ordering.
export async function applyArmorOnEffects(object: GameObject, state: GameState = game, { initialDon = false }: ArmorOnOptions = {}): Promise<string[]> {
    if (object.otyp === LEVITATION_BOOTS || object.otyp === WATER_WALKING_BOOTS) requireLiveGame(state);
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
        } else refreshMovementProperties(state);
        return [];
    }
    if (object.otyp === WATER_WALKING_BOOTS) {
        if (state.u.uinwater) await applyHeroLocationEffects();
        if (object._waterWalkingWasInWater && !state.u.uinwater)
            learnObjectType(object.otyp, state);
        delete object._waterWalkingWasInWater;
        return [];
    }
    if (object?.otyp === FEDORA && state.urole?.key === 'archeologist') {
        // Helmet_on()/Helmet_off() use change_luck(), including its bounds.
        state.u.uluck = Math.min(LUCKMAX, (state.u.uluck ?? 0) + 1);
        return [];
    }
    if (armorSlotFor(object.otyp) === 'uarmh') {
        await applyHelmetOnEffects(object, state);
        return [];
    }
    if (object?.otyp === GAUNTLETS_OF_POWER) {
        state.context.botl = true;
        return [];
    }

    if (object.otyp === FUMBLE_BOOTS || object.otyp === GAUNTLETS_OF_FUMBLING) {
        const sources = state.u._propertySources?.fumbling;
        const slot = armorSlotFor(object.otyp);
        const otherEquipment = sources?.worn.some(source => source.slot !== slot);
        if (!otherEquipment && !hasIntrinsicProperty('fumbling', null, state)
            && !state.u.fumblingIntrinsic && !state.u.fumblingFromIce)
            setPropertyTimeout('fumbling', propertyTimeout('fumbling', state) + rnd(20), state);
        return [];
    }

    if (object.otyp === ELVEN_CLOAK || object.otyp === ELVEN_BOOTS) {
        if (!initialDon) await toggleArmorStealth(object, true, state);
        return [];
    }
    if (object.otyp === CLOAK_OF_DISPLACEMENT) {
        return !initialDon && !object._displacementWasActive && canObserveDisplacement(state)
            ? ['You feel that monsters have difficulty pinpointing your location.'] : [];
    }
    if (armorSlotFor(object.otyp) === 'uarmc') {
        await applyCloakOnEffects(object, state);
        return [];
    }

    if (object.otyp === SPEED_BOOTS) {
        const sources = state.u._propertySources?.fast;
        const otherEquipment = sources?.worn.some(source => source.slot !== 'uarmf')
            || !!sources?.invoked || !!sources?.carried.length;
        if (!otherEquipment && propertyTimeout('fast', state) === 0) {
            return [`You feel yourself speed up${hasIntrinsicProperty('fast', null, state) ? ' a bit more' : ''}.`];
        }
        return [];
    }

    const color = dragonArmorColor(object);
    const extraProperty = color ? DRAGON_ARMOR_EXTRA_PROPERTY[color] : null;
    if (!extraProperty) return [];

    const hero = state.u;
    const messages = [];
    const hadProperty = !!hero[extraProperty];
    const wasVeryFast = !!hero.veryFast;
    if (color !== 'gold') grantArmorProperty(object, state, extraProperty);

    if (color === 'blue') {
        if (!wasVeryFast)
            messages.push(`You speed up${hadProperty ? ' a bit more' : ''}.`);
    } else if (color === 'gold') {
        await makeHallucinated(0, {
            state, talk: !state.program_state?.restoring,
            resistanceSource: { object, slot: 'uarm' },
        });
    } else if (color === 'red') {
        state.vision_full_recalc = 1;
    }
    if (artifactEmitsLight(object) && !object.lamplit) {
        beginObjectBurn(object, state);
        if (!state.blind && !state.u.blindTurns) {
            const name = OBJECT_NAMES[object.otyp];
            if (!name) throw new RangeError(`Missing name for luminous armor type ${object.otyp}`);
            const verb = name.endsWith('scales') ? 'begin' : 'begins';
            messages.push(`Your ${name} ${verb} to shine ${equipmentLightDescription(object, state)}!`);
        }
    }
    return messages;
}

// C do_wear.c:set_wear(NULL). ini_inv_use_obj() has already installed
// the slots, so apply their callbacks without installing equipment again.
// Native starting inventory equips armor, weapons, and quiver only.
export async function applyStartingArmorEffects(state: GameState = game) {
    for (const slot of ['uarmu', 'uarm', 'uarmc', 'uarmf', 'uarmg', 'uarmh', 'uarms'] as const) {
        const object = state[slot] || state.u?.[slot];
        if (!object) continue;
        const messages = await applyArmorOnEffects(object, state, { initialDon: true });
        if (state.program_state?.gameover) return;
        object.known = true;
        object._armorApplied = true;
        if (armorOnIdentifiesType(object, messages)) learnObjectType(object.otyp, state);
        for (const message of messages) await plineWithContinuation(message);
    }
}

// C do_wear.c:Armor_off() removes both the ordinary dragon resistance and
// the color-specific extra property after the suit leaves W_ARM.
export async function removeArmorProperties(object: GameObject, state: GameState = game) {
    const color = dragonArmorColor(object);
    const extraProperty = color ? DRAGON_ARMOR_EXTRA_PROPERTY[color] : null;
    const ordinaryProperty = OBJECT_PROPERTY[object?.otyp];
    const slot = armorSlotFor(object?.otyp);
    if (ordinaryProperty && slot)
        removeWornProperty(ordinaryProperty, object, slot, state);
    if (!extraProperty) return;

    if (color !== 'gold') removeWornProperty(extraProperty, object, 'uarm', state);

    const hero = state.u;
    if (color === 'blue') {
        object._grantsVeryFastFromArmor = false;
    } else if (color === 'gold') {
        await makeHallucinated(1, {
            state, talk: !state.program_state?.restoring,
            resistanceSource: { object, slot: 'uarm' },
        });
    } else if (color === 'red') {
        state.vision_full_recalc = 1;
    }
}

function equippedObject(state: GameState, slot: WornPropertySlot): GameObject | null | undefined {
    if (Object.prototype.hasOwnProperty.call(state, slot)) return state[slot];
    return state.u?.[slot] || null;
}

function protectionItemBonus(object: GameObject | null | undefined, expectedType: number) {
    return object?.otyp === expectedType ? objectEnchantment(object) : 0;
}

// Rebuild current AC from authoritative equipment state. The default base is
// human AC 10; polymorph can supply `formArmorClass` without changing callers.
export function projectedArmorClass(state: GameState = game) {
    const hero = state.u;
    let armorClass = typeof hero.formArmorClass === 'number' && Number.isInteger(hero.formArmorClass)
        ? hero.formArmorClass
        : typeof hero.baseArmorClass === 'number' && Number.isInteger(hero.baseArmorClass) ? hero.baseArmorClass : 10;

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

    if (hasIntrinsicProperty('protection', null, state))
        armorClass -= hero.ublessed || 0;
    armorClass -= hero.uspellprot || 0;

    return Math.max(-AC_MAX, Math.min(AC_MAX, armorClass));
}

export function findArmorClass(state: GameState = game) {
    const hero = state.u;
    const armorClass = projectedArmorClass(state);
    if (hero.uac !== armorClass) {
        hero.uac = armorClass;
        state.context.botl = true;
    }
    return hero.uac;
}


export function armorSimpleName(
    object: Pick<GameObject, 'otyp'> & Partial<Pick<GameObject, 'oclass' | 'name' | 'dknown' | 'typeKnown'>>,
    state: GameState = game,
) {
    const slot = armorSlotFor(object?.otyp);
    const actualName = OBJECT_NAMES[object?.otyp] || object?.name || 'armor';
    const description = state.objectDescriptions?.[object?.otyp]
        ?? OBJECT_DESCRIPTIONS[object?.otyp] ?? '';
    const dknown = object?.dknown !== false;
    const typeKnown = objectTypeKnown(object, state);

    if (slot === 'uarm') {
        if (/ dragon scale mail$/i.test(actualName)) return 'dragon mail';
        if (/ dragon scales$/i.test(actualName)) return 'dragon scales';
        if (/ mail$/i.test(actualName)) return 'mail';
        if (/ jacket$/i.test(actualName)) return 'jacket';
        return 'suit';
    }
    if (slot === 'uarmc') {
        if (actualName === 'robe') return 'robe';
        if (actualName === 'mummy wrapping') return 'wrapping';
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
    if (slot === 'uarmu') return 'shirt';
    return actualName;
}

export function armorOffMessage(object: GameObject, state: GameState = game) {
    if (state.flags?.verbose === false) return '';
    observeObjectForNaming(object, { state });
    return `You were wearing ${inventoryItemDescription(object)}.`;
}

// C stop_donning(): a cancelled dressing action loses its incomplete armor;
// interrupted removal leaves the item worn.
export async function stopDonning(stolenObject: GameObject | null = null, state: GameState = game) {
    const delayed = state._delayedAction;
    if (delayed?.kind === 'steal') return false;
    if (!delayed) {
        const progress = state.context.takeoff;
        const slot = progress?.current;
        const object = slot ? takeoffSlotObject(slot, state) : null;
        if (!progress || !object || !((object.owornmask ?? 0) & W_ARMOR)) return false;
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
        await plineWithContinuation(
            `You stop ${puttingOn ? 'putting on' : 'taking off'} your ${armorSimpleName(delayed.object, state)}.`);
    }
    if (puttingOn)
        await removeHeroArmor(delayed.object, state, { cancelledDon: true });
    return true;
}
