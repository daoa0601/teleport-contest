// quiver.js — Automatic quiver candidate classification and slot ownership.
// C refs: dothrow.c:autoquiver()/throwing_weapon(), obj.h ammo predicates,
// wield.c:ready_ok()/setuqwep().  Command prompts remain in cmd.js.

import {
    P_BOOMERANG, P_BOW, P_CROSSBOW, P_DAGGER, P_DART,
    P_SHORT_SWORD, P_SLING, P_SPEAR,
} from './const.js';
import {
    AKLYS, FLINT, OBJECT_DIR, OBJECT_MATERIAL, OBJECT_SUBTYPE, ROCK,
} from './object_data.js';
import { objectClassForType } from './object_knowledge.js';

const WAR_HAMMER = 76;

function quiverObjectClass(item) {
    return item?.oclass || objectClassForType(item?.otyp);
}

function isLauncherAmmo(item) {
    const objectClass = quiverObjectClass(item);
    const skill = OBJECT_SUBTYPE[item?.otyp] ?? 0;
    return [2, 13].includes(objectClass)
        && skill >= -P_CROSSBOW && skill <= -P_BOW;
}

export function launcherMatchesAmmo(ammo, launcher) {
    return isLauncherAmmo(ammo) && !!launcher
        && OBJECT_SUBTYPE[ammo.otyp]
            === -(OBJECT_SUBTYPE[launcher.otyp] ?? 0);
}

function isMissileObject(item) {
    const objectClass = quiverObjectClass(item);
    const skill = OBJECT_SUBTYPE[item?.otyp] ?? 0;
    return [2, 6].includes(objectClass)
        && skill >= -P_BOOMERANG && skill <= -P_DART;
}

function isThrowingWeapon(item) {
    const objectClass = quiverObjectClass(item);
    const skill = OBJECT_SUBTYPE[item?.otyp] ?? 0;
    const piercingDaggerOrKnife = objectClass === 2
        && skill >= P_DAGGER && skill < P_SHORT_SWORD
        && ((OBJECT_DIR[item.otyp] ?? 0) & 1) !== 0;
    return isMissileObject(item)
        || (objectClass === 2 && skill === P_SPEAR)
        || piercingDaggerOrKnife
        || item?.otyp === WAR_HAMMER || item?.otyp === AKLYS;
}

export function setQuiverObject(item, state) {
    if (state.uquiver && state.uquiver !== item)
        state.uquiver.ready = false;
    state.uquiver = item || null;
    if (item) item.ready = true;
}

// The four buckets deliberately have different overwrite policies and final
// precedence.  This is not a first-match or generic-throwability search.
export function autoquiverCandidate(state) {
    if (state.uquiver) return state.uquiver;
    let currentAmmo = null;
    let missile = null;
    let alternateAmmo = null;
    let miscellaneous = null;
    const currentSling = OBJECT_SUBTYPE[state.uwep?.otyp] === P_SLING;

    for (const item of state.inventory || []) {
        if (item.owornmask || item.worn || item.wielded
            || item.alternate || item.ready
            || item === state.uwep || item === state.uswapwep
            || item.oartifact || item.artifact || !item.dknown) {
            continue;
        }
        const objectClass = quiverObjectClass(item);
        const knownType = !!item.typeKnown
            || !!state._knownObjectTypes?.has(item.otyp)
            || !!state.inventory?.some(candidate =>
                candidate.otyp === item.otyp && candidate.typeKnown);
        const ordinarySlingStone = item.otyp === ROCK
            || (item.otyp === FLINT && knownType)
            || (objectClass === 13
                && OBJECT_MATERIAL[item.otyp] === 19 && knownType);
        if (ordinarySlingStone) {
            if (currentSling) currentAmmo = item;
            else if (launcherMatchesAmmo(item, state.uswapwep))
                alternateAmmo = item;
            else if (!miscellaneous) miscellaneous = item;
        } else if (objectClass === 13) {
            continue;
        } else if (isLauncherAmmo(item)) {
            if (launcherMatchesAmmo(item, state.uwep)) currentAmmo = item;
            else if (launcherMatchesAmmo(item, state.uswapwep))
                alternateAmmo = item;
            else miscellaneous = item;
        } else if (isMissileObject(item)) {
            missile = item;
        } else if (objectClass === 2 && isThrowingWeapon(item)) {
            if (OBJECT_SUBTYPE[item.otyp] === P_DAGGER && !missile)
                missile = item;
            else if (item.otyp !== AKLYS) miscellaneous = item;
        }
    }
    return currentAmmo || missile || alternateAmmo || miscellaneous;
}

export function readySuggestion(item, state) {
    const quantity = item.quantity ?? item.quan ?? 1;
    if (item === state.uwep
        || (item === state.uswapwep && state.u?.twoweap)) {
        return quantity > 1;
    }
    if (isLauncherAmmo(item)) {
        return launcherMatchesAmmo(item, state.uwep)
            || launcherMatchesAmmo(item, state.uswapwep);
    }
    const skill = OBJECT_SUBTYPE[item.otyp] ?? 0;
    if (quiverObjectClass(item) === 2
        && skill >= P_BOW && skill <= P_CROSSBOW) return false;
    return [2, 12].includes(quiverObjectClass(item));
}
