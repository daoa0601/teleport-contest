// Shared weapon predicates.
// C refs: obj.h is_blade(), is_ammo(), ammo_and_launcher(); wield.c will_weld().
import { AKLYS_LIM, P_AXE, P_BOW, P_CROSSBOW, P_DAGGER, P_LANCE, P_PICK_AXE, P_POLEARMS, P_SABER, P_SHORT_SWORD, P_WHIP } from './const.js';
import { artifactById } from './artifacts.js';
import { AKLYS, HEAVY_IRON_BALL, IRON_CHAIN, OBJECT_BIMANUAL, OBJECT_DIR, OBJECT_SUBTYPE, TIN_OPENER, TOWEL } from './object_data.js';
import { rn2 } from './rng.js';
import { isMissileObject, isWeaponTool } from './object_properties.js';
const WEAPON_CLASS = 2;
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
// C wield.c TWOWEAPOK; the two-handed check is separate.
export function isTwoWeaponObject(object) {
    if (object?.oclass !== WEAPON_CLASS)
        return isWeaponTool(object);
    const skill = OBJECT_SUBTYPE[object.otyp] ?? 0;
    return !(skill >= P_BOW && skill <= P_CROSSBOW)
        && !isAmmunition(object) && !isMissileObject(object);
}
export function isWetTowel(object) {
    return object?.otyp === TOWEL && (object.spe ?? 0) > 0;
}
// C setuwep(): an improvised weapon announces its first use in melee.
export function weaponNeedsBashingMessage(object, state) {
    if (!object)
        return true;
    if (object.oclass !== WEAPON_CLASS)
        return !isWeaponTool(object) && !isWetTowel(object);
    const skill = OBJECT_SUBTYPE[object.otyp] ?? 0;
    const launcher = skill >= P_BOW && skill <= P_CROSSBOW;
    const groundedPolearm = isPolearm(object) && !state.u.usteed
        && artifactById(object.oartifact)?.name !== 'Snickersnee';
    return launcher || isAmmunition(object) || isMissileObject(object)
        || groundedPolearm;
}
export function willWeld(object) {
    if (!object?.cursed)
        return false;
    const weaponTool = object.oclass === 6 && OBJECT_SUBTYPE[object.otyp] !== 0;
    return object.oclass === WEAPON_CLASS || weaponTool
        || [HEAVY_IRON_BALL, IRON_CHAIN, TIN_OPENER].includes(object.otyp);
}
// C engrave.c:freehand(). A removable item does not occupy the hand permanently.
export function heroHasFreeHand(state) {
    const weapon = state.uwep || state.u.uwep;
    if (!weapon || !willWeld(weapon))
        return true;
    // freehand() calls welded() before checking the other hand or shield.
    weapon.bknown = true;
    const shield = state.uarms || state.u.uarms;
    return !OBJECT_BIMANUAL[weapon.otyp] && !shield?.cursed;
}
// Snickersnee has the same reach as a polearm despite being a katana.
export function isPolearm(object) {
    if (object?.oclass !== WEAPON_CLASS && object?.oclass !== 6)
        return false;
    const skill = OBJECT_SUBTYPE[object.otyp];
    return skill === P_POLEARMS || skill === P_LANCE
        || artifactById(object.oartifact)?.name === 'Snickersnee';
}
// C weapon.c:autoreturn_weapon(). The pinned game only includes the aklys.
export function returningWeaponRangeSquared(object) {
    return object?.otyp === AKLYS ? AKLYS_LIM * AKLYS_LIM : null;
}
// C mhitu.c:mswings_verb(). The mixed-strike roll occurs even when bashing.
export function monsterWeaponSwingVerb(object, bash = false, random = rn2) {
    const direction = OBJECT_DIR[object.otyp] ?? 0;
    const thrust = (direction & 1) && (!(direction & ~1) || random(2) === 0);
    const lash = OBJECT_SUBTYPE[object.otyp] === P_WHIP
        || (object.otyp === TOWEL && (object.spe ?? 0) > 0);
    return bash ? 'bashes with' : lash ? 'lashes' : thrust ? 'thrusts' : 'swings';
}
// C objclass.h is_sword().
export function isSword(object) {
    const skill = OBJECT_SUBTYPE[object.otyp] ?? 0;
    return object.oclass === 2 && skill >= P_SHORT_SWORD && skill <= P_SABER;
}
//# sourceMappingURL=weapon_type.js.map