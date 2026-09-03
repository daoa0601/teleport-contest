// Recheck equipment after the hero's body or alignment changes.
// C ref: artifact.c retouch_object(), untouchable(), retouch_equipment().

import { removeHeroAccessory } from './accessory.js';
import {
    armorSlotFor, findArmorClass, removeHeroArmor,
} from './armor.js';
import {
    artifactInvokeIsActive, deactivateArtifactProperty,
} from './artifact_invoke.js';
import { touchArtifactByHero } from './artifact_touch.js';
import { artifactById } from './artifacts.js';
import { exerciseAttribute } from './attrib.js';
import {
    A_CON, DISMOUNT_THROWN, W_BALL, W_QUIVER, W_SWAPWEP,
} from './const.js';
import {
    newsym, plineWithContinuation,
} from './display.js';
import { finishHeroDeath } from './end.js';
import { removeEyewear } from './eyewear.js';
import { landFloorObject } from './floor_effects.js';
import { game } from './gstate.js';
import { heroHatesSilver } from './hero_species.js';
import { LEASH, OBJECT_NAMES } from './object_data.js';
import { objectMaterial } from './object_material.js';
import { uncurseObjectState } from './object_state.js';
import { rnd } from './rng.js';
import { dismountHero, monsterSaddle } from './steed.js';
import { releaseWeaponSlots } from './weapon_slots.js';

const TOOL_CLASS = 6;
const SILVER = 14;

function liveSlot(slot) {
    return game[slot] || game.u?.[slot] || null;
}

function artifactCarriedEffect(artifact) {
    return !!artifact?.carriedDefense
        || (artifact?.carriedFlags?.length ?? 0) > 0;
}

function objectNeedsRetouch(object, artifact, equipped) {
    const excluded = W_QUIVER
        | (game.u?.twoweap ? 0 : W_SWAPWEP)
        | W_BALL;
    const worn = ((object.owornmask ?? 0) & ~excluded) !== 0;
    const activeTool = object.oclass === TOOL_CLASS
        && (object.lamplit
            || (object.otyp === LEASH && object.leashmon)
            || (Array.isArray(object.contents) && object.contents.length > 0));
    return equipped || worn || activeTool || artifactCarriedEffect(artifact)
        || artifactInvokeIsActive(artifact, game);
}

function objectName(object, artifact) {
    if (artifact?.name) return artifact.name.replace(/^The /, 'the ');
    return `your ${object.name || OBJECT_NAMES[object.otyp] || 'object'}`;
}

async function removeObjectFromUse(object) {
    if (object === liveSlot('uwep') || object === liveSlot('uswapwep')) {
        releaseWeaponSlots(object, game);
        return;
    }
    if (armorSlotFor(object.otyp)) {
        removeHeroArmor(object, game);
        return;
    }
    if (object === liveSlot('uleft') || object === liveSlot('uright')
        || object === liveSlot('uamul')) {
        removeHeroAccessory(object, game);
        findArmorClass(game);
        return;
    }
    if (object === liveSlot('ublindf')) {
        await removeEyewear(object);
        return;
    }
    object.worn = false;
    object.wornSlot = null;
    object.owornmask = 0;
}

async function applyHandlingDamage(object, artifact, touch) {
    if (touch.blasted) return false;
    const silver = objectMaterial(object, game) === SILVER
        && heroHatesSilver(game);
    let damage = 0;
    if (silver) {
        damage = rnd(10);
        if (game.u?.halfPhysicalDamage || game.u?.half_physical_damage)
            damage = Math.trunc((damage + 1) / 2);
    }
    if (touch.bane) damage += rnd(10);
    if (!damage) return false;

    game.u.uhp = Math.max(0, (game.u.uhp ?? 1) - damage);
    exerciseAttribute(A_CON, false);
    if (game.u.uhp > 0) return false;
    return finishHeroDeath({
        killer: `handling ${objectName(object, artifact)}`,
    });
}

async function dropRejectedObject(object, artifact) {
    const inventory = game.inventory || [];
    const index = inventory.indexOf(object);
    if (index >= 0) inventory.splice(index, 1);
    object.where = 'free';

    const quantity = object.quan ?? object.quantity ?? 1;
    const subject = objectName(object, artifact);
    const sentence = subject[0].toUpperCase() + subject.slice(1);
    await plineWithContinuation(
        `${sentence} ${quantity > 1 ? 'fall' : 'falls'} to the floor.`,
    );
    await landFloorObject(object, game.u.ux, game.u.uy, {
        state: game,
        publish: plineWithContinuation,
    });
    newsym(game.u.ux, game.u.uy);
}

async function retouchObject(
    object, { dropRejected, removeWorn = true, equipped = false },
) {
    const artifact = artifactById(object?.oartifact, game);
    if (!objectNeedsRetouch(object, artifact, equipped))
        return { rejected: false, dropped: false, died: false };

    const silver = objectMaterial(object, game) === SILVER
        && heroHatesSilver(game);
    const touch = await touchArtifactByHero(object, artifact);
    if (touch.died)
        return { rejected: true, dropped: false, died: true };

    const rejected = !touch.allowed || silver || touch.bane;
    if (!rejected)
        return { rejected: false, dropped: false, died: false };

    if (touch.allowed) {
        await plineWithContinuation(
            `You can't handle ${objectName(object, artifact)} anymore!`,
        );
    }
    const died = await applyHandlingDamage(object, artifact, touch);
    if (died) return { rejected: true, dropped: false, died: true };

    if (removeWorn) await removeObjectFromUse(object);
    if (artifactInvokeIsActive(artifact, game)) {
        await deactivateArtifactProperty(object, artifact, { state: game });
    }
    if (dropRejected) await dropRejectedObject(object, artifact);
    return { rejected: true, dropped: dropRejected, died: false };
}

export async function retouchEquipment(dropFlag = 0) {
    const processed = new Set();
    const rejected = [];
    const dropped = [];
    const hadGloves = !!liveSlot('uarmg');
    const oldRingCount = Number(!!liveSlot('uleft'))
        + Number(!!liveSlot('uright'));

    const process = async (object, options) => {
        if (!object || processed.has(object)) return false;
        processed.add(object);
        const result = await retouchObject(object, options);
        if (result.rejected) rejected.push(object);
        if (result.dropped) dropped.push(object);
        return result.died;
    };

    if (game.u?.twoweap
        && await process(liveSlot('uswapwep'), {
            dropRejected: dropFlag > 0,
            equipped: true,
        })) {
        return { died: true, rejected, dropped };
    }
    if (await process(liveSlot('uwep'), {
        dropRejected: dropFlag > 0,
        equipped: true,
    }))
        return { died: true, rejected, dropped };

    const steed = game.u?.usteed;
    const saddle = monsterSaddle(steed);
    if (saddle) {
        const wasRejected = rejected.length;
        if (await process(saddle, {
            dropRejected: false,
            removeWorn: false,
            equipped: true,
        }))
            return { died: true, rejected, dropped };
        if (rejected.length > wasRejected) {
            await dismountHero(DISMOUNT_THROWN, {
                state: game,
                announce: plineWithContinuation,
            });
        }
    }

    while (true) {
        const object = (game.inventory || []).find(item =>
            !processed.has(item));
        if (!object) break;
        if (await process(object, { dropRejected: dropFlag === 1 }))
            return { died: true, rejected, dropped };
    }

    const newRingCount = Number(!!liveSlot('uleft'))
        + Number(!!liveSlot('uright'));
    const gloves = liveSlot('uarmg');
    if (newRingCount !== oldRingCount && gloves?.cursed)
        uncurseObjectState(gloves);

    if (hadGloves && !gloves) {
        const { selfTouchPetrifyingWeapons } = await import('./stoning.js');
        const touch = await selfTouchPetrifyingWeapons({
            messageStart: 'After losing your gloves, you',
        });
        if (touch.died) return { died: true, rejected, dropped };
    }
    return { died: false, rejected, dropped };
}
