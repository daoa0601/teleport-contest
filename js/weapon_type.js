// Shared weapon predicates.
// C refs: obj.h is_blade(), is_ammo(), ammo_and_launcher(); wield.c will_weld().

import { P_BOW, P_CROSSBOW, P_DAGGER, P_SABER } from './const.js';
import { HEAVY_IRON_BALL, IRON_CHAIN, OBJECT_SUBTYPE, TIN_OPENER } from './object_data.js';

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
