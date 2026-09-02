// Acid, rust, rot, and corrosion damage to the hero's possessions.
// C refs: uhitm.c erode_armor() and trap.c erode_obj().

import { plineWithContinuation } from './display.js';
import { game } from './gstate.js';
import {
    OBJECT_MATERIAL, OBJECT_NAMES, SCR_BLANK_PAPER,
} from './object_data.js';
import { hasWornProperty } from './properties.js';
import { rnl, rn2 } from './rng.js';

const SCROLL_CLASS = 9;

// C trap.c:acid_damage(). Acid can dissolve grease, erase a scroll, or
// corrode a weapon. Worn acid resistance usually protects carried objects.
export async function damageHeroObjectWithAcid(
    object,
    {
        state = game,
        publish = plineWithContinuation,
        random = rn2,
    } = {},
) {
    if (!object) return { result: 'nothing' };
    if (inventoryProtectedFromAcid(state, random))
        return { result: 'nothing' };

    if (object.greased) {
        const name = heroObjectName(object);
        await publish(
            `Your ${name} ${
                objectIsPlural(object) ? 'are' : 'is'
            } protected by the layer of grease!`,
        );
        if (random(2) === 0) {
            object.greased = false;
            await publish('The grease dissolves.');
        }
        return { result: 'greased' };
    }

    if (object.oclass === SCROLL_CLASS
        && object.otyp !== SCR_BLANK_PAPER) {
        const name = heroObjectName(object);
        await publish(
            `Your ${name} ${objectIsPlural(object) ? 'fade' : 'fades'}.`,
        );
        object.otyp = SCR_BLANK_PAPER;
        object.spe = 0;
        object.dknown = false;
        if (object.name) object.name = 'scroll of blank paper';
        if (object.plural) object.plural = 'scrolls of blank paper';
        return { result: 'erased' };
    }

    const erosion = heroObjectErosionResult(
        object, true, 'corrosion', state, random, null, true,
    );
    await applyErosionWithMessages(erosion, state, publish, random);
    return erosion;
}

// C uhitm.c:erode_armor(). Select a real worn slot and keep trying until
// corrosion affects a non-body slot. Selecting the body always ends the try.
export async function corrodeRandomHeroArmor({
    state = game,
    publish = plineWithContinuation,
    random = rn2,
} = {}) {
    for (;;) {
        const selection = selectArmor(state, random(5));
        if (!selection.object) {
            if (selection.bodySlot) return { result: 'nothing' };
            continue;
        }

        const erosion = heroObjectErosionResult(
            selection.object,
            selection.verbose,
            'corrosion',
            state,
            random,
        );
        await applyErosionWithMessages(erosion, state, publish, random);
        if (selection.bodySlot || erosion.result !== 'nothing') return erosion;
    }
}

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
        const slot = rollRandom(random, 5, action.calls);
        const selection = selectArmor(state, slot);
        bodySlot = selection.bodySlot;
        erosion = selection.object
            ? heroObjectErosionResult(
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

    const message = applyErosionFinalization(
        pending, state, random, action.calls,
    );

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

function heroObjectErosionResult(
    object, verbose, erosionKind, state, random, calls = null,
    skipInventoryProtection = false,
) {
    const corrosion = erosionKind === 'corrosion';
    const rot = erosionKind === 'rot';
    const objectName = heroObjectName(object);
    const plural = objectIsPlural(object);

    // Only worn acid resistance protects the hero's possessions. An
    // intrinsic resistance protects the hero, not the inventory.
    if (corrosion && !skipInventoryProtection
        && inventoryProtectedFromAcid(state, random, calls)) {
        return { result: 'nothing', message: null };
    }
    if (!rot && object.greased) {
        return {
            result: 'greased',
            message: `Your ${objectName} ${
                plural ? 'are' : 'is'
            } protected by the layer of grease!`,
            finalize: { kind: 'grease', object },
        };
    }

    const material = OBJECT_MATERIAL[object.otyp] ?? 0;
    const vulnerable = objectCanErode(material, erosionKind);
    const proof = !!(object.oerodeproof
        || (rot ? object.rotproof
            : corrosion ? object.corrodeproof : object.rustproof));
    const cause = rot ? 'decay' : corrosion ? 'corrosion' : 'oxidation';
    if (!vulnerable || proof && object.rknown) {
        return {
            result: 'nothing',
            message: verbose
                ? `Your ${objectName} ${
                    plural ? 'are' : 'is'
                } not affected by ${cause}.` : null,
        };
    }
    if (proof || object.blessed && rnl(4) === 0) {
        return {
            result: 'nothing',
            message: proof
                ? `Somehow, your ${objectName} ${
                    plural ? 'are' : 'is'
                } not affected by the ${cause}.`
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
                ? `Your ${objectName} ${plural ? 'look' : 'looks'} completely ${
                    rot ? 'rotten' : corrosion ? 'corroded' : 'rusted'
                }.` : null,
        };
    }
    const adverb = oldErosion + 1 === 3
        ? ' completely' : oldErosion ? ' further' : '';
    return {
        result: 'damaged',
        message: `Your ${objectName} ${
            erosionVerb(erosionKind, plural)
        }${adverb}!`,
        finalize: { kind: 'damage', object, field, oldErosion },
    };
}

function objectCanErode(material, erosionKind) {
    if (erosionKind === 'rot')
        return (material <= 8 && material !== 1) || material === 10;
    if (erosionKind === 'corrosion')
        return material === 11 || material === 13;
    return material === 11;
}

function erosionVerb(erosionKind, plural) {
    if (erosionKind === 'rot') return plural ? 'rot' : 'rots';
    if (erosionKind === 'corrosion')
        return plural ? 'corrode' : 'corrodes';
    return plural ? 'rust' : 'rusts';
}

async function applyErosionWithMessages(
    erosion, state, publish, random,
) {
    if (erosion.message) await publish(erosion.message);
    const followup = applyErosionFinalization(
        erosion.finalize || { kind: 'none' }, state, random,
    );
    if (followup) await publish(followup);
}

function applyErosionFinalization(pending, state, random, calls = null) {
    if (pending.kind === 'grease') {
        if (rollRandom(random, 2, calls) === 0) {
            pending.object.greased = false;
            return 'The grease dissolves.';
        }
    } else if (pending.kind === 'proof') {
        pending.object.rknown = true;
    } else if (pending.kind === 'damage') {
        pending.object[pending.field] = pending.oldErosion + 1;
        state._armorClassDirty = true;
    }
    return null;
}

function inventoryProtectedFromAcid(state, random, calls = null) {
    return hasWornProperty('acidResistance', state)
        && rollRandom(random, 100, calls) < 99;
}

function heroObjectName(object) {
    if (object.name || object.description)
        return object.name || object.description;
    const baseName = OBJECT_NAMES[object.otyp] || 'object';
    return object.oclass === SCROLL_CLASS ? `scroll of ${baseName}` : baseName;
}

function objectIsPlural(object) {
    const name = heroObjectName(object);
    return (object.quan ?? object.quantity ?? 1) !== 1
        || /(?:boots|shoes|gloves|gauntlets|lenses|scales)$/u.test(name);
}

function rollRandom(random, range, calls = null) {
    const value = random(range);
    if (calls) calls.push(`rn2(${range})`);
    return value;
}
