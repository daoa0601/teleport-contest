// Automatic quiver candidate classification and slot ownership.
// C refs: dothrow.c:autoquiver()/throwing_weapon(), obj.h ammo predicates,
// wield.c:ready_ok()/setuqwep().  Command prompts remain in cmd.js.
import { WEAPON_CLASS, COIN_CLASS, GEM_CLASS } from './objclass.js';
import { is_launcher } from './object_properties.js';
import { objectClassForType, objectSkill, AKLYS, FLINT, ROCK, } from './object_data.js';
import { objectMaterial, objectTypeKnown } from './o_init.js';
import { P_DAGGER, P_SLING, } from './const.js';
import { isLauncherAmmunition, isMissileObject, isThrowingWeapon, launcherMatchesAmmo, } from './object_properties.js';
function quiverObjectClass(item) {
    return item.oclass || objectClassForType(item.otyp);
}
// C dothrow.c:autoquiver().
// The four buckets deliberately have different overwrite policies and final
// precedence.  This is not a first-match or generic-throwability search.
export function autoquiverCandidate(state) {
    if (state.uquiver)
        return state.uquiver;
    let currentAmmo = null;
    let missile = null;
    let alternateAmmo = null;
    let miscellaneous = null;
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
            if (currentSling)
                currentAmmo = item;
            else if (launcherMatchesAmmo(item, state.uswapwep))
                alternateAmmo = item;
            else if (!miscellaneous)
                miscellaneous = item;
        }
        else if (objectClass === GEM_CLASS) {
            continue;
        }
        else if (isLauncherAmmunition(item)) {
            if (launcherMatchesAmmo(item, state.uwep))
                currentAmmo = item;
            else if (launcherMatchesAmmo(item, state.uswapwep))
                alternateAmmo = item;
            else
                miscellaneous = item;
        }
        else if (isMissileObject(item)) {
            missile = item;
        }
        else if (objectClass === WEAPON_CLASS && isThrowingWeapon(item)) {
            if (objectSkill(item.otyp) === P_DAGGER && !missile)
                missile = item;
            else if (item.otyp !== AKLYS)
                miscellaneous = item;
        }
    }
    return currentAmmo || missile || alternateAmmo || miscellaneous;
}
// C wield.c:ready_ok(). The empty-quiver choice stays in the caller.
export function readySuggestion(item, state) {
    const quantity = item.quantity ?? item.quan ?? 1;
    if (item === state.uwep
        || (item === state.uswapwep && state.u?.twoweap)) {
        return quantity > 1;
    }
    if (isLauncherAmmunition(item)) {
        return launcherMatchesAmmo(item, state.uwep)
            || launcherMatchesAmmo(item, state.uswapwep);
    }
    if (is_launcher(item))
        return false;
    return [WEAPON_CLASS, COIN_CLASS].includes(quiverObjectClass(item));
}
//# sourceMappingURL=quiver.js.map