// Hero weapon and quiver slot changes.
// C refs: wield.c setuwep(), setuswapwep(), setuqwep(), uwepgone().
import { W_QUIVER, W_SWAPWEP, W_WEAPONS, W_WEP, } from './const.js';
import { game } from './gstate.js';
import { artifactById, artifactEmitsLight } from './artifacts.js';
import { setWornArtifactProperties } from './artifact_properties.js';
import { makeHallucinated } from './hero_mental_status.js';
import { setArtifactWarningWielded } from './artifact_warning.js';
import { endObjectBurn, equipmentLightMessage } from './light.js';
import { plineWithContinuation } from './display.js';
import { heroIsBlind } from './senses.js';
import { weaponNeedsBashingMessage, willWeld } from './weapon_type.js';
import { cancelSlotTakeoff } from './takeoff_state.js';
const WEAPON_SLOTS = [
    ['uwep', W_WEP, 'wielded'],
    ['uswapwep', W_SWAPWEP, 'alternate'],
    ['uquiver', W_QUIVER, 'ready'],
];
export function isWeldedPrimary(object, state = game) {
    return !!object && object === (state.uwep || state.u?.uwep) && willWeld(object);
}
export function setTwoWeaponCombat(enabled, state = game) {
    state.u.twoweap = enabled;
}
function slotObject(slot, state) {
    return state[slot] || state.u?.[slot] || null;
}
function clearSlot(slot, mask, flag, state) {
    const object = slotObject(slot, state);
    if (object)
        cancelSlotTakeoff(slot, state);
    state[slot] = null;
    if (state.u)
        state.u[slot] = null;
    if (!object)
        return null;
    if (slot === 'uwep' && artifactEmitsLight(object) && object.lamplit)
        endObjectBurn(object, state);
    object[flag] = false;
    object.owornmask = (object.owornmask ?? 0) & ~mask;
    return object;
}
function installSlot(object, slot, mask, flag, state) {
    state[slot] = object;
    if (state.u)
        state.u[slot] = object;
    object.wielded = flag === 'wielded';
    object.alternate = flag === 'alternate';
    object.ready = flag === 'ready';
    object.owornmask = (object.owornmask ?? 0) | mask;
}
async function replaceSlot(object, slot, mask, flag, state) {
    const oldObject = slotObject(slot, state);
    if (oldObject !== object || !object)
        clearSlot(slot, mask, flag, state);
    if (!object)
        return oldObject;
    if (oldObject !== object)
        await releaseWeaponSlots(object, state);
    installSlot(object, slot, mask, flag, state);
    return oldObject;
}
export async function setWieldedArtifactProperties(object, active, state) {
    const artifact = artifactById(object.oartifact, state);
    setWornArtifactProperties(object, 'uwep', active, state);
    if (artifact?.flags.includes('SPFX_HALRES')) {
        await makeHallucinated(Number(!active), {
            state, talk: !state.program_state?.restoring,
            resistanceSource: { object, slot: 'uwep' },
        });
    }
    await setArtifactWarningWielded(object, active, state);
}
export async function setPrimaryWeapon(object, state = game) {
    const previous = slotObject('uwep', state);
    if (previous === object)
        return previous;
    if (previous)
        cancelSlotTakeoff('uwep', state);
    // Semantic unwielding retains the old pointer while its warning stops.
    if (previous) {
        setTwoWeaponCombat(false, state);
        previous.wielded = false;
        previous.owornmask = (previous.owornmask ?? 0) & ~W_WEP;
        await setWieldedArtifactProperties(previous, false, state);
    }
    if (object)
        await releaseWeaponSlots(object, state);
    state.uwep = object;
    if (state.u)
        state.u.uwep = object;
    if (object) {
        installSlot(object, 'uwep', W_WEP, 'wielded', state);
        await setWieldedArtifactProperties(object, true, state);
    }
    if (artifactById(previous?.oartifact, state)?.name === 'Ogresmasher'
        || artifactById(object?.oartifact, state)?.name === 'Ogresmasher')
        state.context.botl = true;
    // setuwep ends the displaced light after setworn's new warning census.
    if (previous?.lamplit && artifactEmitsLight(previous)) {
        endObjectBurn(previous, state);
        if (!heroIsBlind(state))
            await plineWithContinuation(equipmentLightMessage(previous, false, state));
    }
    state._unweapon = weaponNeedsBashingMessage(object, state);
    return previous;
}
export async function setSecondaryWeapon(object, state = game) {
    if (slotObject('uswapwep', state))
        setTwoWeaponCombat(false, state);
    return await replaceSlot(object, 'uswapwep', W_SWAPWEP, 'alternate', state);
}
export async function setQuiverObject(object, state = game) {
    return await replaceSlot(object, 'uquiver', W_QUIVER, 'ready', state);
}
// C uwepgone(): light ends before setworn removes the warning source.
export async function losePrimaryWeapon(state = game) {
    const object = slotObject('uwep', state);
    if (!object)
        return;
    cancelSlotTakeoff('uwep', state);
    if (object.lamplit && artifactEmitsLight(object)) {
        endObjectBurn(object, state);
        if (!heroIsBlind(state))
            await plineWithContinuation(equipmentLightMessage(object, false, state));
    }
    setTwoWeaponCombat(false, state);
    object.wielded = false;
    object.owornmask = (object.owornmask ?? 0) & ~W_WEP;
    await setWieldedArtifactProperties(object, false, state);
    state.uwep = null;
    if (state.u)
        state.u.uwep = null;
    state._unweapon = true;
}
export async function releaseWeaponSlots(object, state = game) {
    if (!object)
        return;
    const primary = state.uwep === object || state.u?.uwep === object;
    const secondary = state.uswapwep === object
        || state.u?.uswapwep === object;
    const quivered = state.uquiver === object || state.u?.uquiver === object;
    if (primary)
        cancelSlotTakeoff('uwep', state);
    if (secondary)
        cancelSlotTakeoff('uswapwep', state);
    if (quivered)
        cancelSlotTakeoff('uquiver', state);
    if (primary || secondary)
        setTwoWeaponCombat(false, state);
    if (primary && artifactEmitsLight(object) && object.lamplit)
        endObjectBurn(object, state);
    if (state.uwep === object)
        state.uwep = null;
    if (state.u?.uwep === object)
        state.u.uwep = null;
    if (state.uswapwep === object)
        state.uswapwep = null;
    if (state.u?.uswapwep === object)
        state.u.uswapwep = null;
    if (state.uquiver === object)
        state.uquiver = null;
    if (state.u?.uquiver === object)
        state.u.uquiver = null;
    if (primary)
        state._unweapon = true;
    object.wielded = false;
    object.alternate = false;
    object.ready = false;
    object.owornmask = (object.owornmask ?? 0) & ~W_WEAPONS;
    // Direct setnotworn clears the pointer before warning feedback.
    if (primary)
        await setWieldedArtifactProperties(object, false, state);
}
// C merged() uses raw setworn/setnotworn, not wield commands or uwepgone.
export function mergeHeroWeaponSlots(survivor, incoming, state = game) {
    if (!incoming.owornmask || survivor.where !== 'inventory')
        return;
    const combined = (survivor.owornmask || 0) | incoming.owornmask;
    const target = combined & W_WEP ? ['uwep', W_WEP, 'wielded']
        : combined & W_SWAPWEP ? ['uswapwep', W_SWAPWEP, 'alternate']
            : combined & W_QUIVER ? ['uquiver', W_QUIVER, 'ready'] : null;
    if (!target)
        throw new Error('merging objects in non-weapon slots');
    if (target[1] !== W_QUIVER)
        setTwoWeaponCombat(false, state);
    for (const [slot, mask, flag] of WEAPON_SLOTS) {
        const object = slotObject(slot, state);
        if (object === survivor || object === incoming)
            clearSlot(slot, mask, flag, state);
    }
    installSlot(survivor, ...target, state);
}
//# sourceMappingURL=weapon_slots.js.map