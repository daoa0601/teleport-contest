// Predicates derived from NetHack's object table.
// C refs: include/obj.h and dothrow.c throwing_weapon().

import { WEAPON_CLASS, ARMOR_CLASS, TOOL_CLASS, WAND_CLASS, GEM_CLASS, ARM_SHIELD, ARM_HELM, ARM_BOOTS, ARM_GLOVES, ARM_CLOAK, ARM_SHIRT, ARM_SUIT } from './objclass.js';
import {
    objectBaseDirection, objectSkill, oc_armcat, objectBimanual, objectCharged, AKLYS,
    FLINT, LOADSTONE, LUCKSTONE, TOUCHSTONE, WAR_HAMMER, HEAVY_IRON_BALL, IRON_CHAIN,
    TIN_OPENER, TOWEL,
    ELVEN_LEATHER_HELM, ELVEN_MITHRIL_COAT, ELVEN_CLOAK, ELVEN_SHIELD, ELVEN_BOOTS,
    ELVEN_ARROW, ELVEN_SPEAR, ELVEN_DAGGER, ELVEN_SHORT_SWORD, ELVEN_BROADSWORD, ELVEN_BOW, LENSES, RUBBER_HOSE,
} from './object_data.js';
import { artifactById } from './artifact.js';
import { objectIsFlammable, objectIsRottable } from './mkobj.js';
import {
    P_BOOMERANG, P_BOW, P_CROSSBOW, P_DAGGER, P_DART, P_SHORT_SWORD,
    P_SHURIKEN, P_SPEAR,
} from './const.js';

import { objectMaterial } from './o_init.js';
import type { GameObject } from './object_types.js';
import type { GameState } from './game_state.js';
import { AKLYS_LIM, P_AXE, P_LANCE, P_PICK_AXE, P_POLEARMS, P_SABER, P_WHIP } from './const.js';
import { rn2 } from './rng.js';

type ObjectKind = Pick<GameObject, 'otyp'> & Partial<Pick<GameObject, 'oclass' | 'oartifact'>>;
type ObjectCandidate = ObjectKind | null | undefined;

const LEATHER = 7;
const WOOD = 8;
const IRON = 11;
const COPPER = 13;
const MITHRIL = 17;
const GLASS = 19;
const WHACK = 4;

function objectClass(object: ObjectCandidate): number {
    return object?.oclass ?? 0;
}

// C obj.h:is_graystone().
export function isGrayStone(object: ObjectCandidate): boolean {
    if (!object) return false;
    return [LUCKSTONE, LOADSTONE, FLINT, TOUCHSTONE].includes(object.otyp);
}

// C obj.h:greatest_erosion() macro: worst of fire and rot damage.
export function greatestErosion(object: Pick<GameObject, 'oeroded' | 'oeroded2'>): number {
    return Math.max(object.oeroded ?? 0, object.oeroded2 ?? 0);
}

// C obj.h:is_weptool().
export function isWeaponTool(object: ObjectCandidate): boolean {
    if (!object) return false;
    return objectClass(object) === TOOL_CLASS && objectSkill(object.otyp) !== 0;
}

// C obj.h:bimanual(). The oc_bimanual field aliases oc_big, which
// heavy armor also sets, so the weapon-or-tool class guard is what keeps
// wielded armor from counting as a two-handed weapon.
export function isBimanualObject(object: ObjectCandidate): boolean {
    if (!object) return false;
    const kind = objectClass(object);
    return (kind === WEAPON_CLASS || kind === TOOL_CLASS)
        && !!objectBimanual(object.otyp);
}

// C objnam.c:doname() displays charges for wands and charged non-weapon tools.
export function objectUsesCharges(object: ObjectCandidate): boolean {
    if (!object) return false;
    return objectClass(object) === WAND_CLASS
        || (objectClass(object) === TOOL_CLASS && !isWeaponTool(object)
            && !!objectCharged(object.otyp));
}

// C obj.h:is_missile().
export function isMissileObject(object: ObjectCandidate): boolean {
    if (!object) return false;
    const kind = objectClass(object);
    const skill = objectSkill(object.otyp);
    return (kind === WEAPON_CLASS || kind === TOOL_CLASS)
        && skill >= -P_BOOMERANG && skill <= -P_DART;
}

// C obj.h:is_ammo().
export function isLauncherAmmunition(object: ObjectCandidate): boolean {
    if (!object) return false;
    const kind = objectClass(object);
    const skill = objectSkill(object.otyp);
    return (kind === WEAPON_CLASS || kind === GEM_CLASS)
        && skill >= -P_CROSSBOW && skill <= -P_BOW;
}

// C obj.h:ammo_and_launcher().
export function launcherMatchesAmmo(ammunition: ObjectCandidate, launcher: ObjectCandidate): boolean {
    if (!ammunition) return false;
    return isLauncherAmmunition(ammunition)
        && matching_launcher(ammunition, launcher);
}

// C obj.h:matching_launcher().
export function matching_launcher(ammunition: ObjectKind, launcher: ObjectCandidate): boolean {
    if (!launcher) return false;
    return objectSkill(ammunition.otyp)
        === -objectSkill(launcher.otyp);
}

// C dothrow.c:throwing_weapon(). It stays beside the object-table predicates:
// the throwing_weapon equivalence proof (state_specs.py throwing_weapon:tables)
// runs this module in the prover's curated JS set, which dothrow.js's import
// closure cannot join.
export function isThrowingWeapon(object: ObjectCandidate): boolean {
    if (!object) return false;
    const kind = objectClass(object);
    const skill = objectSkill(object.otyp);
    const piercingDaggerOrKnife = kind === WEAPON_CLASS
        && skill >= P_DAGGER && skill < P_SHORT_SWORD
        && (objectBaseDirection(object.otyp) & 1) !== 0;
    return isMissileObject(object)
        || (kind === WEAPON_CLASS && skill === P_SPEAR)
        || piercingDaggerOrKnife
        || object.otyp === WAR_HAMMER
        || object.otyp === AKLYS;
}


// C obj.h:is_multigen().
export function isMultiGeneratedWeapon(object: ObjectCandidate): boolean {
    if (!object) return false;
    const skill = objectSkill(object.otyp);
    return object.oclass === WEAPON_CLASS
        && skill >= -P_SHURIKEN && skill <= -P_BOW;
}

// C obj.h:is_poisonable().
export function isPoisonableObject(object: ObjectCandidate): boolean {
    if (!object) return false;
    return isMultiGeneratedWeapon(object)
        || artifactById(object.oartifact)?.invokePower === 'fling-poison';
}

// C obj.h:is_blunt_weapon().
export function isBluntWeapon(object: ObjectCandidate): boolean {
    if (!object) return false;
    const kind = objectClass(object);
    const weaponOrTool = kind === WEAPON_CLASS
        || (kind === TOOL_CLASS && objectSkill(object.otyp) !== 0);
    return weaponOrTool && !!(objectBaseDirection(object.otyp) & WHACK);
}

// C obj.h:is_flimsy().
export function isFlimsyObject(
    object: ObjectCandidate, state?: Pick<GameState, 'objectMaterials'>,
): boolean {
    return objectMaterial(object, state) <= LEATHER
        || !!object && object.otyp === RUBBER_HOSE;
}

// C objclass.h:is_organic().
export function objectIsOrganic(
    object: ObjectCandidate, state?: Pick<GameState, 'objectMaterials'>,
): boolean {
    return objectMaterial(object, state) <= WOOD;
}

// C objclass.h:is_metallic().
export function objectIsMetallic(
    object: ObjectCandidate, state?: Pick<GameState, 'objectMaterials'>,
): boolean {
    const material = objectMaterial(object, state);
    return material >= IRON && material <= MITHRIL;
}

// C objclass.h:is_rustprone().
export function objectIsRustprone(
    object: ObjectCandidate, state?: Pick<GameState, 'objectMaterials'>,
): boolean {
    return objectMaterial(object, state) === IRON;
}

// C objclass.h:is_corrodeable().
export function objectIsCorrodeable(
    object: ObjectCandidate, state?: Pick<GameState, 'objectMaterials'>,
): boolean {
    const material = objectMaterial(object, state);
    return material === COPPER || material === IRON;
}

// C objclass.h:is_crackable(). Only worn glass takes crack damage
// (the erosion_matters() note in objclass.h).
export function objectIsCrackable(
    object: Pick<GameObject, 'otyp' | 'oclass'>,
    state?: Pick<GameState, 'objectMaterials'>,
): boolean {
    return objectMaterial(object, state) === GLASS
        && object.oclass === ARMOR_CLASS;
}

export type WeaponView = Pick<GameObject, 'otyp'>
    & Partial<Pick<GameObject, 'oclass' | 'spe' | 'cursed' | 'oartifact'>>;
export type WeaponCandidate = WeaponView | null | undefined;


// C obj.h:is_pick().
export function isPick(object: WeaponCandidate): boolean {
    return (object?.oclass === WEAPON_CLASS || object?.oclass === TOOL_CLASS)
        && objectSkill(object.otyp) === P_PICK_AXE;
}

// C obj.h:is_axe().
export function isAxe(object: WeaponCandidate): boolean {
    return (object?.oclass === WEAPON_CLASS || object?.oclass === TOOL_CLASS)
        && objectSkill(object.otyp) === P_AXE;
}

// C obj.h:is_blade().
export function isBlade(object: WeaponCandidate): boolean {
    if (!object) return false;
    const skill = objectSkill(object.otyp);
    return object?.oclass === WEAPON_CLASS
        && skill >= P_DAGGER && skill <= P_SABER;
}

// C obj.h:is_wet_towel().
export function isWetTowel(object: WeaponCandidate): boolean {
    return object?.otyp === TOWEL && (object.spe ?? 0) > 0;
}
// C obj.h:is_pole().
// Snickersnee has the same reach as a polearm despite being a katana.
export function isPolearm(object: WeaponCandidate): boolean {
    if (object?.oclass !== WEAPON_CLASS && object?.oclass !== TOOL_CLASS) return false;
    const skill = objectSkill(object.otyp);
    return skill === P_POLEARMS || skill === P_LANCE
        || artifactById(object.oartifact)?.name === 'Snickersnee';
}
// C obj.h:is_sword().
export function isSword(object: GameObject): boolean {
    const skill = objectSkill(object.otyp);
    return object.oclass === WEAPON_CLASS && skill >= P_SHORT_SWORD && skill <= P_SABER;
}

// C obj.h:is_launcher().
export function is_launcher(object: WeaponCandidate): boolean {
    if (!object) return false;
    const skill = objectSkill(object.otyp);
    return object.oclass === WEAPON_CLASS
        && skill >= P_BOW && skill <= P_CROSSBOW;
}

// C obj.h:is_spear().
export function is_spear(object: WeaponCandidate): boolean {
    if (!object) return false;
    return object.oclass === WEAPON_CLASS
        && objectSkill(object.otyp) === P_SPEAR;
}

// C obj.h:is_shield(). Armor rows carry their category in oc_armcat, the
// oc_subtyp alias.
export function is_shield(object: WeaponCandidate): boolean {
    if (!object) return false;
    return object.oclass === ARMOR_CLASS
        && oc_armcat(object.otyp) === ARM_SHIELD;
}

// C obj.h:is_helmet().
export function is_helmet(object: WeaponCandidate): boolean {
    if (!object) return false;
    return object.oclass === ARMOR_CLASS
        && oc_armcat(object.otyp) === ARM_HELM;
}

// C obj.h:is_boots().
export function is_boots(object: WeaponCandidate): boolean {
    if (!object) return false;
    return object.oclass === ARMOR_CLASS
        && oc_armcat(object.otyp) === ARM_BOOTS;
}

// C obj.h:is_gloves().
export function is_gloves(object: WeaponCandidate): boolean {
    if (!object) return false;
    return object.oclass === ARMOR_CLASS
        && oc_armcat(object.otyp) === ARM_GLOVES;
}

// C obj.h:is_cloak().
export function is_cloak(object: WeaponCandidate): boolean {
    if (!object) return false;
    return object.oclass === ARMOR_CLASS
        && oc_armcat(object.otyp) === ARM_CLOAK;
}

// C obj.h:is_shirt().
export function is_shirt(object: WeaponCandidate): boolean {
    if (!object) return false;
    return object.oclass === ARMOR_CLASS
        && oc_armcat(object.otyp) === ARM_SHIRT;
}

// C obj.h:is_suit().
export function is_suit(object: WeaponCandidate): boolean {
    if (!object) return false;
    return object.oclass === ARMOR_CLASS
        && oc_armcat(object.otyp) === ARM_SUIT;
}

// C obj.h:is_elven_armor().
export function is_elven_armor(object: WeaponCandidate): boolean {
    if (!object) return false;
    return object.otyp === ELVEN_LEATHER_HELM
        || object.otyp === ELVEN_MITHRIL_COAT || object.otyp === ELVEN_CLOAK
        || object.otyp === ELVEN_SHIELD || object.otyp === ELVEN_BOOTS;
}

// C obj.h:is_elven_weapon().
export function is_elven_weapon(object: WeaponCandidate): boolean {
    if (!object) return false;
    return object.otyp === ELVEN_ARROW || object.otyp === ELVEN_SPEAR
        || object.otyp === ELVEN_DAGGER || object.otyp === ELVEN_SHORT_SWORD
        || object.otyp === ELVEN_BROADSWORD || object.otyp === ELVEN_BOW;
}

// C obj.h:pair_of().
export function pair_of(object: WeaponCandidate): boolean {
    if (!object) return false;
    return object.otyp === LENSES || is_gloves(object) || is_boots(object);
}

// C objclass.h:is_damageable().
export function is_damageable(object: Pick<GameObject, 'otyp' | 'oclass'>): boolean {
    return objectIsRustprone(object) || objectIsFlammable(object)
        || objectIsRottable(object) || objectIsCorrodeable(object)
        || objectIsCrackable(object);
}
