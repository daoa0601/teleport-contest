// Predicates derived from NetHack's object table.
// C refs: include/obj.h and dothrow.c throwing_weapon().

import { artifactById } from './artifacts.js';
import {
    P_BOOMERANG, P_BOW, P_CROSSBOW, P_DAGGER, P_DART, P_SHORT_SWORD,
    P_SHURIKEN, P_SPEAR,
} from './const.js';
import {
    AKLYS, OBJECT_DIR, OBJECT_MATERIAL, OBJECT_NAMES, OBJECT_SUBTYPE,
    WAR_HAMMER,
} from './object_data.js';
import { objectClassForType } from './object_knowledge.js';

const WEAPON_CLASS = 2;
const TOOL_CLASS = 6;
const GEM_CLASS = 13;
const LEATHER = 7;
const WHACK = 4;

function objectClass(object) {
    return object?.oclass || objectClassForType(object?.otyp);
}

export function isMissileObject(object) {
    const kind = objectClass(object);
    const skill = OBJECT_SUBTYPE[object?.otyp] ?? 0;
    return (kind === WEAPON_CLASS || kind === TOOL_CLASS)
        && skill >= -P_BOOMERANG && skill <= -P_DART;
}

export function isLauncherAmmunition(object) {
    const kind = objectClass(object);
    const skill = OBJECT_SUBTYPE[object?.otyp] ?? 0;
    return (kind === WEAPON_CLASS || kind === GEM_CLASS)
        && skill >= -P_CROSSBOW && skill <= -P_BOW;
}

export function launcherMatchesAmmo(ammunition, launcher) {
    return isLauncherAmmunition(ammunition) && !!launcher
        && OBJECT_SUBTYPE[ammunition.otyp]
            === -(OBJECT_SUBTYPE[launcher.otyp] ?? 0);
}

export function isThrowingWeapon(object) {
    const kind = objectClass(object);
    const skill = OBJECT_SUBTYPE[object?.otyp] ?? 0;
    const piercingDaggerOrKnife = kind === WEAPON_CLASS
        && skill >= P_DAGGER && skill < P_SHORT_SWORD
        && ((OBJECT_DIR[object.otyp] ?? 0) & 1) !== 0;
    return isMissileObject(object)
        || (kind === WEAPON_CLASS && skill === P_SPEAR)
        || piercingDaggerOrKnife
        || object?.otyp === WAR_HAMMER
        || object?.otyp === AKLYS;
}

export function isMultiGeneratedWeapon(object) {
    const skill = OBJECT_SUBTYPE[object?.otyp] ?? 0;
    return object?.oclass === WEAPON_CLASS
        && skill >= -P_SHURIKEN && skill <= -P_BOW;
}

export function isPoisonableObject(object) {
    return isMultiGeneratedWeapon(object)
        || artifactById(object?.oartifact)?.invokePower === 'fling-poison';
}

export function isPermanentlyPoisonedObject(object) {
    return artifactById(object?.oartifact)?.invokePower === 'fling-poison';
}

export function isBluntWeapon(object) {
    const kind = objectClass(object);
    const weaponOrTool = kind === WEAPON_CLASS
        || (kind === TOOL_CLASS && (OBJECT_SUBTYPE[object?.otyp] ?? 0) !== 0);
    return weaponOrTool && !!((OBJECT_DIR[object?.otyp] ?? 0) & WHACK);
}

export function isFlimsyObject(object) {
    return (OBJECT_MATERIAL[object?.otyp] ?? 0) <= LEATHER
        || OBJECT_NAMES[object?.otyp] === 'rubber hose';
}
