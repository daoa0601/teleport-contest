// Object breakage and its immediate effects.
// C refs: dothrow.c breaktest(), hero_breaks(), and breakobj().

import {
    ACID_VENOM, BLINDING_VENOM, CREAM_PIE, EGG, EXPENSIVE_CAMERA,
    CRYSTAL_BALL, LENSES, MELON, MIRROR, OBJECT_MATERIAL, OBJECT_NAMES,
    POT_OIL, POT_WATER,
} from './object_data.js';
import {
    newsym, plineWithContinuation,
} from './display.js';
import { releaseCameraDemon } from './camera.js';
import {
    applyHeroEggLuckPenalty, explodePyroliskEggAt, isPyroliskEgg,
} from './egg_impact.js';
import { explodeLitOilPotion } from './fire_explosion.js';
import { remove_object } from './floor_object.js';
import { game } from './gstate.js';
import { makemonAt } from './mklev.js';
import { objectResistsDestruction } from './object_state.js';
import { stopAllObjectTimers } from './object_timers.js';
import {
    applySupportedPotionVapor, heroPotionVaporProfile,
    potionImpactObjectName,
} from './potion_hit.js';
import { d, rnl, rn2 } from './rng.js';
import { heroIsDeaf } from './senses.js';
import { cansee } from './vision.js';

const ARMOR_CLASS = 3;
const POTION_CLASS = 8;
const GEM_CLASS = 13;
const GLASS = 19;

const BREAKABLE_TYPES = new Set([
    EXPENSIVE_CAMERA,
    EGG,
    CREAM_PIE,
    MELON,
    ACID_VENOM,
    BLINDING_VENOM,
]);

export function objectBreaksOnImpact(object, random = rn2) {
    const glassArmor = object.oclass === ARMOR_CLASS
        && OBJECT_MATERIAL[object.otyp] === GLASS;
    const ordinaryResistance = glassArmor ? 90 : 1;
    if (objectResistsDestruction(
        object, ordinaryResistance, 99, random,
    )) return false;

    const glassObject = OBJECT_MATERIAL[object.otyp] === GLASS
        && !object.oartifact && !object.artifact
        && object.oclass !== GEM_CLASS;
    return glassObject || object.oclass === POTION_CLASS
        || BREAKABLE_TYPES.has(object.otyp);
}

function objectName(object) {
    if (object.oclass === POTION_CLASS)
        return potionImpactObjectName(object);
    return object.name || OBJECT_NAMES[object.otyp] || 'object';
}

async function publishBreakMessage(object, visible, audible, publish) {
    if ([EGG, MELON].includes(object.otyp)) {
        await publish('Splat!');
        return;
    }
    if (object.otyp === CREAM_PIE) {
        if (visible) await publish('What a mess!');
        return;
    }
    if ([ACID_VENOM, BLINDING_VENOM].includes(object.otyp)) {
        await publish('Splash!');
        return;
    }
    if (!visible) {
        if (audible) await publish('You hear something shatter!');
        return;
    }

    const quantity = object.quan ?? object.quantity ?? 1;
    const intoPieces = [LENSES, MIRROR, CRYSTAL_BALL, EXPENSIVE_CAMERA]
        .includes(object.otyp) ? ' into a thousand pieces' : '';
    await publish(`The ${objectName(object)} ${
        quantity === 1 ? 'shatters' : 'shatter'
    }${intoPieces}!`);
}

function deleteObject(object) {
    if (object.where === 'floor') remove_object(object);
    stopAllObjectTimers(object);
    object.where = 'gone';
    object.ox = object.oy = 0;
    object.ocarry = null;
    object.lamplit = false;
    object.in_use = false;
    delete object.carrierMid;
}

async function crackGlassArmor(object, visible, publish, luckRandom) {
    const name = objectName(object);
    if (object.oerodeproof && object.rknown) return false;
    if (object.oerodeproof || (object.blessed && luckRandom(4) === 0)) {
        if (visible)
            await publish(`Somehow, the ${name} is not affected by the impact.`);
        if (object.oerodeproof) object.rknown = true;
        return false;
    }

    const erosion = object.oeroded ?? 0;
    if (erosion < 3) {
        object.oeroded = erosion + 1;
        if (visible) {
            const adverb = erosion + 1 === 3
                ? ' completely' : erosion ? ' further' : '';
            await publish(`The ${name} cracks${adverb}!`);
        }
        return false;
    }

    if (visible) await publish(`The ${name} shatters!`);
    deleteObject(object);
    return true;
}

async function applyPotionBreakEffect(object, x, y, state, publish) {
    if (object.otyp === POT_OIL && object.lamplit) return false;
    const nearby = Math.max(
        Math.abs(x - state.u.ux), Math.abs(y - state.u.uy),
    ) <= 1;
    if (!nearby) return false;

    const profile = heroPotionVaporProfile(state);
    if (object.otyp !== POT_WATER && !state.u?.halfGasDamage) {
        if (!profile.breathless) await publish('You smell a peculiar odor...');
        else if (profile.hasEyes) await publish('Your eyes water.');
    }
    await applySupportedPotionVapor({ state, potion: object, publish });
    return true;
}

export async function breakFloorObject(object, {
    state = game,
    heroCaused = true,
    publish = plineWithContinuation,
    random = rn2,
    luckRandom = rnl,
    rollDice = d,
    summonMonster = makemonAt,
    finishMonsterKill,
} = {}) {
    if (!objectBreaksOnImpact(object, random)) {
        return { destroyed: false, observed: false };
    }
    return breakObjectAtLocation(object, {
        state, heroCaused, publish, random, luckRandom, rollDice,
        summonMonster, finishMonsterKill,
    });
}

export async function breakObjectAtLocation(object, {
    state = game,
    heroCaused = true,
    showBreakMessage = true,
    publish = plineWithContinuation,
    random = rn2,
    luckRandom = rnl,
    rollDice = d,
    summonMonster = makemonAt,
    finishMonsterKill,
} = {}) {
    const x = object.ox, y = object.oy;
    const visible = cansee(x, y);
    const audible = !heroIsDeaf(state);

    const glassArmor = object.oclass === ARMOR_CLASS
        && OBJECT_MATERIAL[object.otyp] === GLASS;
    if (glassArmor) {
        const destroyed = await crackGlassArmor(
            object, visible, publish, luckRandom,
        );
        if (destroyed) newsym(x, y);
        return { destroyed, observed: destroyed && (visible || audible) };
    }

    if (showBreakMessage)
        await publishBreakMessage(object, visible, audible, publish);
    if (heroCaused && object.otyp === MIRROR) {
        state.u.uluck = Math.max(
            -13, Math.min(13, (state.u.uluck ?? 0) - 2),
        );
    }
    const cameraDemon = object.otyp === EXPENSIVE_CAMERA
        ? await releaseCameraDemon(object, x, y, {
            state, publish, random, summonMonster,
        }) : null;
    if (object.oclass === POTION_CLASS) {
        // The blast from burning oil must not ignite or destroy the same
        // potion again while breakage is still finishing.
        object.in_use = true;
        await applyPotionBreakEffect(object, x, y, state, publish);
    }

    const oilExplosion = object.otyp === POT_OIL && object.lamplit;
    const eggExplosion = isPyroliskEgg(object);
    if (heroCaused) applyHeroEggLuckPenalty(object, state);

    if (oilExplosion) {
        await explodeLitOilPotion(object, x, y, {
            state, heroCaused, publish, random, rollDice,
            finishMonsterKill,
        });
    }
    deleteObject(object);
    newsym(x, y);
    if (eggExplosion) {
        await explodePyroliskEggAt(x, y, {
            state, heroCaused, publish, random, rollDice,
            finishMonsterKill,
        });
    }
    return {
        destroyed: true,
        observed: visible || audible,
        cameraDemon,
    };
}
