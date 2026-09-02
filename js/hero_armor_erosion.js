// Damage to armor worn by the hero.
// C refs: uhitm.c erode_armor() and trap.c erode_obj().

import { OBJECT_MATERIAL, OBJECT_NAMES } from './object_data.js';
import { hasWornProperty } from './properties.js';
import { rnl, rn2 } from './rng.js';

export function resumeDeferredHeroRustArmor(
    action, state, random = rn2,
) {
    return resumeDeferredHeroArmorErosion(action, state, 'rust', random);
}

export function resumeDeferredHeroCorrosionArmor(
    action, state, random = rn2,
) {
    return resumeDeferredHeroArmorErosion(
        action, state, 'corrosion', random,
    );
}

export function resumeDeferredHeroDecayArmor(
    action, state, random = rn2,
) {
    return resumeDeferredHeroArmorErosion(action, state, 'rot', random);
}

export function finishDeferredHeroRustArmor(
    action, state, random = rn2,
) {
    return finishDeferredHeroArmorErosion(action, state, random);
}

export function finishDeferredHeroCorrosionArmor(
    action, state, random = rn2,
) {
    return finishDeferredHeroArmorErosion(action, state, random);
}

export function finishDeferredHeroDecayArmor(
    action, state, random = rn2,
) {
    return finishDeferredHeroArmorErosion(action, state, random);
}

// Head, shield, gloves, and boots retry until erosion affects something.
// Body armor always ends the selection, even when it cannot erode.
function resumeDeferredHeroArmorErosion(
    action, state, erosionKind, random,
) {
    const attack = action?.movement?.attack;
    const deferredField = erosionKind === 'corrosion'
        ? 'deferredCorrosionArmor'
        : erosionKind === 'rot' ? 'deferredDecayArmor'
            : 'deferredRustArmor';
    if (!attack?.[deferredField]) return null;

    let erosion;
    let bodySlot;
    for (;;) {
        const slot = recordRandom(random, action.calls, 5);
        const selection = selectArmor(state, slot);
        bodySlot = selection.bodySlot;
        erosion = selection.object
            ? heroArmorErosionResult(
                selection.object,
                selection.verbose,
                erosionKind,
                state,
                random,
                action.calls,
            )
            : { result: 'nothing', message: null };

        if (erosion.message || bodySlot || erosion.result !== 'nothing')
            break;
    }

    const continueArmor = !bodySlot && erosion.result === 'nothing';
    attack[deferredField] = false;
    attack.deferredArmorErosionFinalize = {
        ...(erosion.finalize || { kind: 'none' }),
        continueArmor,
        deferredField,
    };
    return { message: erosion.message };
}

// Apply state changes after the preceding erosion message has been shown.
function finishDeferredHeroArmorErosion(action, state, random) {
    const attack = action?.movement?.attack;
    const pending = attack?.deferredArmorErosionFinalize;
    if (!pending) return null;

    let message = null;
    if (pending.kind === 'grease') {
        if (recordRandom(random, action.calls, 2) === 0) {
            pending.object.greased = false;
            message = 'The grease dissolves.';
        }
    } else if (pending.kind === 'proof') {
        pending.object.rknown = true;
    } else if (pending.kind === 'damage') {
        pending.object[pending.field] = pending.oldErosion + 1;
        state._armorClassDirty = true;
    }

    delete attack.deferredArmorErosionFinalize;
    if (pending.continueArmor) attack[pending.deferredField] = true;
    else attack.deferredPostHit = true;
    return { message };
}

function selectArmor(state, slot) {
    if (slot === 0) return wornArmor(state, 'uarmh');
    if (slot === 1) {
        return {
            object: wornArmor(state, 'uarmc').object
                || wornArmor(state, 'uarm').object
                || wornArmor(state, 'uarmu').object,
            bodySlot: true,
            verbose: true,
        };
    }
    if (slot === 2) return wornArmor(state, 'uarms');
    if (slot === 3) return wornArmor(state, 'uarmg');
    return wornArmor(state, 'uarmf');
}

function wornArmor(state, slot) {
    return {
        object: state?.[slot] || state?.u?.[slot] || null,
        bodySlot: false,
        verbose: false,
    };
}

function heroArmorErosionResult(
    object, verbose, erosionKind, state, random, calls,
) {
    const corrosion = erosionKind === 'corrosion';
    const rot = erosionKind === 'rot';
    const objectName = object.name || object.description
        || OBJECT_NAMES[object.otyp] || 'armor';

    // Only worn acid resistance protects the hero's possessions. An
    // intrinsic resistance protects the hero, not the inventory.
    if (corrosion && hasWornProperty('acidResistance', state)
        && recordRandom(random, calls, 100) < 99) {
        return { result: 'nothing', message: null };
    }
    if (!rot && object.greased) {
        return {
            result: 'greased',
            message: `Your ${objectName} is protected by the layer of grease!`,
            finalize: { kind: 'grease', object },
        };
    }

    const material = OBJECT_MATERIAL[object.otyp] ?? 0;
    const vulnerable = rot
        ? (material <= 8 && material !== 1) || material === 10
        : corrosion ? material === 11 || material === 13
            : material === 11;
    const proof = !!(object.oerodeproof
        || (rot ? object.rotproof
            : corrosion ? object.corrodeproof : object.rustproof));
    const cause = rot ? 'decay' : corrosion ? 'corrosion' : 'oxidation';
    if (!vulnerable || proof && object.rknown) {
        return {
            result: 'nothing',
            message: verbose
                ? `Your ${objectName} is not affected by ${cause}.` : null,
        };
    }
    if (proof || object.blessed && rnl(4) === 0) {
        return {
            result: 'nothing',
            message: proof
                ? `Somehow, your ${objectName} is not affected by the ${cause}.`
                : null,
            finalize: proof ? { kind: 'proof', object } : null,
        };
    }

    const field = corrosion || rot ? 'oeroded2' : 'oeroded';
    const oldErosion = object[field] ?? 0;
    if (oldErosion >= 3) {
        return {
            result: 'nothing',
            message: verbose
                ? `Your ${objectName} looks completely ${
                    rot ? 'rotten' : corrosion ? 'corroded' : 'rusted'
                }.` : null,
        };
    }
    const adverb = oldErosion + 1 === 3
        ? ' completely' : oldErosion ? ' further' : '';
    return {
        result: 'damaged',
        message: `Your ${objectName} ${
            rot ? 'rots' : corrosion ? 'corrodes' : 'rusts'
        }${adverb}!`,
        finalize: { kind: 'damage', object, field, oldErosion },
    };
}

function recordRandom(random, calls, range) {
    const value = random(range);
    calls.push(`rn2(${range})`);
    return value;
}
