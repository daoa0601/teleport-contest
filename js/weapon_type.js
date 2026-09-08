// Shared weapon predicates.
// C refs: obj.h is_blade(), is_ammo(), ammo_and_launcher(); wield.c will_weld().

import { P_BOW, P_CROSSBOW, P_DAGGER, P_LANCE, P_POLEARMS, P_SABER, P_WHIP } from './const.js';
import { artifactById } from './artifacts.js';
import { HEAVY_IRON_BALL, IRON_CHAIN, OBJECT_DIR, OBJECT_SUBTYPE, TIN_OPENER, TOWEL } from './object_data.js';
import { rn2 } from './rng.js';

const WEAPON_CLASS = 2;

export function isBlade(object) {
    const skill = OBJECT_SUBTYPE[object?.otyp] || 0;
    return object?.oclass === WEAPON_CLASS
        && skill >= P_DAGGER && skill <= P_SABER;
}

export function isAmmunition(object) {
    const skill = OBJECT_SUBTYPE[object?.otyp] ?? 0;
    return (object?.oclass === WEAPON_CLASS || object?.oclass === 13)
        && skill >= -P_CROSSBOW && skill <= -P_BOW;
}

export function ammunitionMatchesLauncher(ammunition, launcher) {
    return !!launcher && isAmmunition(ammunition)
        && OBJECT_SUBTYPE[ammunition.otyp] === -OBJECT_SUBTYPE[launcher.otyp];
}

export function willWeld(object) {
    if (!object?.cursed) return false;
    const weaponTool = object.oclass === 6 && OBJECT_SUBTYPE[object.otyp] !== 0;
    return object.oclass === WEAPON_CLASS || weaponTool
        || [HEAVY_IRON_BALL, IRON_CHAIN, TIN_OPENER].includes(object.otyp);
}

// Snickersnee has the same reach as a polearm despite being a katana.
export function isPolearm(object) {
    if (object?.oclass !== WEAPON_CLASS && object?.oclass !== 6) return false;
    const skill = OBJECT_SUBTYPE[object.otyp];
    return skill === P_POLEARMS || skill === P_LANCE
        || artifactById(object.oartifact)?.name === 'Snickersnee';
}

// C mhitu.c:mswings_verb(). The mixed-strike roll occurs even when bashing.
export function monsterWeaponSwingVerb(object, bash = false, random = rn2) {
    const direction = OBJECT_DIR[object.otyp];
    const thrust = (direction & 1) && (!(direction & ~1) || random(2) === 0);
    const lash = OBJECT_SUBTYPE[object.otyp] === P_WHIP
        || (object.otyp === TOWEL && object.spe > 0);
    return bash ? 'bashes with' : lash ? 'lashes' : thrust ? 'thrusts' : 'swings';
}
