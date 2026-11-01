// Predicates derived from NetHack's object table.
// C refs: include/obj.h and dothrow.c throwing_weapon().
import { artifactById } from './artifacts.js';
import { P_BOOMERANG, P_BOW, P_CROSSBOW, P_DAGGER, P_DART, P_SHORT_SWORD, P_SHURIKEN, P_SPEAR, } from './const.js';
import { AKLYS, FLINT, LOADSTONE, LUCKSTONE, OBJECT_BIMANUAL, OBJECT_CHARGED, OBJECT_DIR, OBJECT_NAMES, OBJECT_SUBTYPE, TOUCHSTONE, WAR_HAMMER, } from './object_data.js';
import { objectClassForType } from './object_knowledge.js';
import { objectMaterial } from './object_material.js';
import { AKLYS_LIM, P_AXE, P_LANCE, P_PICK_AXE, P_POLEARMS, P_SABER, P_WHIP } from './const.js';
import { HEAVY_IRON_BALL, IRON_CHAIN, TIN_OPENER, TOWEL } from './object_data.js';
import { rn2 } from './rng.js';
const WEAPON_CLASS = 2;
const TOOL_CLASS = 6;
const WAND_CLASS = 11;
const GEM_CLASS = 13;
const LEATHER = 7;
const WHACK = 4;
function objectClass(object) {
    return object?.oclass || objectClassForType(object?.otyp);
}
export function isGrayStone(object) {
    if (!object)
        return false;
    return [LUCKSTONE, LOADSTONE, FLINT, TOUCHSTONE].includes(object.otyp);
}
export function isWeaponTool(object) {
    if (!object)
        return false;
    return objectClass(object) === TOOL_CLASS && OBJECT_SUBTYPE[object.otyp] !== 0;
}
// C include/obj.h:bimanual(). The oc_bimanual field aliases oc_big, which
// heavy armor also sets, so the weapon-or-tool class guard is what keeps
// wielded armor from counting as a two-handed weapon.
export function isBimanualObject(object) {
    if (!object)
        return false;
    const kind = objectClass(object);
    return (kind === WEAPON_CLASS || kind === TOOL_CLASS)
        && !!OBJECT_BIMANUAL[object.otyp];
}
// C objnam.c:doname() displays charges for wands and charged non-weapon tools.
export function objectUsesCharges(object) {
    if (!object)
        return false;
    return objectClass(object) === WAND_CLASS
        || (objectClass(object) === TOOL_CLASS && !isWeaponTool(object)
            && !!OBJECT_CHARGED[object.otyp]);
}
export function isMissileObject(object) {
    if (!object)
        return false;
    const kind = objectClass(object);
    const skill = OBJECT_SUBTYPE[object.otyp] ?? 0;
    return (kind === WEAPON_CLASS || kind === TOOL_CLASS)
        && skill >= -P_BOOMERANG && skill <= -P_DART;
}
export function isLauncherAmmunition(object) {
    if (!object)
        return false;
    const kind = objectClass(object);
    const skill = OBJECT_SUBTYPE[object.otyp] ?? 0;
    return (kind === WEAPON_CLASS || kind === GEM_CLASS)
        && skill >= -P_CROSSBOW && skill <= -P_BOW;
}
export function launcherMatchesAmmo(ammunition, launcher) {
    if (!ammunition || !launcher)
        return false;
    return isLauncherAmmunition(ammunition)
        && OBJECT_SUBTYPE[ammunition.otyp]
            === -(OBJECT_SUBTYPE[launcher.otyp] ?? 0);
}
export function isThrowingWeapon(object) {
    if (!object)
        return false;
    const kind = objectClass(object);
    const skill = OBJECT_SUBTYPE[object.otyp] ?? 0;
    const piercingDaggerOrKnife = kind === WEAPON_CLASS
        && skill >= P_DAGGER && skill < P_SHORT_SWORD
        && ((OBJECT_DIR[object.otyp] ?? 0) & 1) !== 0;
    return isMissileObject(object)
        || (kind === WEAPON_CLASS && skill === P_SPEAR)
        || piercingDaggerOrKnife
        || object.otyp === WAR_HAMMER
        || object.otyp === AKLYS;
}
export function isMultiGeneratedWeapon(object) {
    if (!object)
        return false;
    const skill = OBJECT_SUBTYPE[object.otyp] ?? 0;
    return object.oclass === WEAPON_CLASS
        && skill >= -P_SHURIKEN && skill <= -P_BOW;
}
export function isPoisonableObject(object) {
    if (!object)
        return false;
    return isMultiGeneratedWeapon(object)
        || artifactById(object.oartifact)?.invokePower === 'fling-poison';
}
export function isPermanentlyPoisonedObject(object) {
    if (!object)
        return false;
    return artifactById(object.oartifact)?.invokePower === 'fling-poison';
}
export function isBluntWeapon(object) {
    if (!object)
        return false;
    const kind = objectClass(object);
    const weaponOrTool = kind === WEAPON_CLASS
        || (kind === TOOL_CLASS && (OBJECT_SUBTYPE[object.otyp] ?? 0) !== 0);
    return weaponOrTool && !!((OBJECT_DIR[object.otyp] ?? 0) & WHACK);
}
export function isFlimsyObject(object, state) {
    return objectMaterial(object, state) <= LEATHER
        || !!object && OBJECT_NAMES[object.otyp] === 'rubber hose';
}
export function isPick(object) {
    return (object?.oclass === WEAPON_CLASS || object?.oclass === 6)
        && OBJECT_SUBTYPE[object.otyp] === P_PICK_AXE;
}
export function isAxe(object) {
    return (object?.oclass === WEAPON_CLASS || object?.oclass === 6)
        && OBJECT_SUBTYPE[object.otyp] === P_AXE;
}
export function isBlade(object) {
    if (!object)
        return false;
    const skill = OBJECT_SUBTYPE[object.otyp] || 0;
    return object?.oclass === WEAPON_CLASS
        && skill >= P_DAGGER && skill <= P_SABER;
}
export function isAmmunition(object) {
    if (!object)
        return false;
    const skill = OBJECT_SUBTYPE[object.otyp] ?? 0;
    return (object?.oclass === WEAPON_CLASS || object?.oclass === 13)
        && skill >= -P_CROSSBOW && skill <= -P_BOW;
}
export function ammunitionMatchesLauncher(ammunition, launcher) {
    if (!ammunition || !launcher || !isAmmunition(ammunition))
        return false;
    const launcherSkill = OBJECT_SUBTYPE[launcher.otyp];
    return launcherSkill !== undefined
        && OBJECT_SUBTYPE[ammunition.otyp] === -launcherSkill;
}
export function isWetTowel(object) {
    return object?.otyp === TOWEL && (object.spe ?? 0) > 0;
}
// Snickersnee has the same reach as a polearm despite being a katana.
export function isPolearm(object) {
    if (object?.oclass !== WEAPON_CLASS && object?.oclass !== 6)
        return false;
    const skill = OBJECT_SUBTYPE[object.otyp];
    return skill === P_POLEARMS || skill === P_LANCE
        || artifactById(object.oartifact)?.name === 'Snickersnee';
}
// C objclass.h is_sword().
export function isSword(object) {
    const skill = OBJECT_SUBTYPE[object.otyp] ?? 0;
    return object.oclass === 2 && skill >= P_SHORT_SWORD && skill <= P_SABER;
}
//# sourceMappingURL=object_properties.js.map