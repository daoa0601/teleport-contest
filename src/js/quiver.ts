// Automatic quiver candidate classification and slot ownership.
// C refs: dothrow.c:autoquiver()/throwing_weapon(), obj.h ammo predicates,
// wield.c:ready_ok()/setuqwep().  Command prompts remain in cmd.js.

import { WEAPON_CLASS, COIN_CLASS, GEM_CLASS } from './objclass.js';
import {
    objectClassForType, objectSkill, AKLYS, FLINT, ROCK,
} from './object_data.js';
import { objectMaterial } from './o_init.js';
import {
    P_BOW, P_CROSSBOW, P_DAGGER, P_SLING,
} from './const.js';

import { objectTypeKnown } from './shk.js';
import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import {
    isLauncherAmmunition, isMissileObject, isThrowingWeapon,
    launcherMatchesAmmo,
} from './object_properties.js';

function quiverObjectClass(item: GameObject): number {
    return item.oclass || objectClassForType(item.otyp);
}

// The four buckets deliberately have different overwrite policies and final
// precedence.  This is not a first-match or generic-throwability search.
export function autoquiverCandidate(state: GameState): GameObject | null {
    if (state.uquiver) return state.uquiver;
    let currentAmmo: GameObject | null = null;
    let missile: GameObject | null = null;
    let alternateAmmo: GameObject | null = null;
    let miscellaneous: GameObject | null = null;
    const currentSling = !!state.uwep && objectSkill(state.uwep.otyp) === P_SLING;

    for (const item of state.inventory || []) {
        if (item.owornmask || item.worn || item.wielded
            || item.alternate || item.ready
            || item === state.uwep || item === state.uswapwep
            || item.oartifact || item.artifact || !item.dknown) {
            continue;
        }
        const objectClass = quiverObjectClass(item);
        const knownType = objectTypeKnown(item, state);
        const ordinarySlingStone = item.otyp === ROCK
            || (item.otyp === FLINT && knownType)
            || (objectClass === GEM_CLASS
                && objectMaterial(item.otyp) === 19 && knownType);
        if (ordinarySlingStone) {
            if (currentSling) currentAmmo = item;
            else if (launcherMatchesAmmo(item, state.uswapwep))
                alternateAmmo = item;
            else if (!miscellaneous) miscellaneous = item;
        } else if (objectClass === GEM_CLASS) {
            continue;
        } else if (isLauncherAmmunition(item)) {
            if (launcherMatchesAmmo(item, state.uwep)) currentAmmo = item;
            else if (launcherMatchesAmmo(item, state.uswapwep))
                alternateAmmo = item;
            else miscellaneous = item;
        } else if (isMissileObject(item)) {
            missile = item;
        } else if (objectClass === WEAPON_CLASS && isThrowingWeapon(item)) {
            if (objectSkill(item.otyp) === P_DAGGER && !missile)
                missile = item;
            else if (item.otyp !== AKLYS) miscellaneous = item;
        }
    }
    return currentAmmo || missile || alternateAmmo || miscellaneous;
}

export function readySuggestion(item: GameObject, state: GameState): boolean {
    const quantity = item.quantity ?? item.quan ?? 1;
    if (item === state.uwep
        || (item === state.uswapwep && state.u?.twoweap)) {
        return quantity > 1;
    }
    if (isLauncherAmmunition(item)) {
        return launcherMatchesAmmo(item, state.uwep)
            || launcherMatchesAmmo(item, state.uswapwep);
    }
    const skill = objectSkill(item.otyp);
    if (quiverObjectClass(item) === WEAPON_CLASS
        && skill >= P_BOW && skill <= P_CROSSBOW) return false;
    return [WEAPON_CLASS, COIN_CLASS].includes(quiverObjectClass(item));
}
