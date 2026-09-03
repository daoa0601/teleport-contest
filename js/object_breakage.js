// Object breakage and its immediate effects.
// C refs: dothrow.c breaktest(), hero_breaks(), and breakobj().

import {
    ACID_VENOM, BLINDING_VENOM, CREAM_PIE, EGG, EXPENSIVE_CAMERA,
    CRYSTAL_BALL, LENSES, MELON, MIRROR, OBJECT_MATERIAL, OBJECT_NAMES,
    POT_OIL, POT_WATER,
} from './object_data.js';
import {
    canProjectMonster, newsym, plineWithContinuation,
    randomDisplayMonsterName,
} from './display.js';
import { createFireExplosion } from './fire_explosion.js';
import { remove_object } from './floor_object.js';
import { game } from './gstate.js';
import { makemonAt } from './mklev.js';
import { setMonsterMalign } from './monster_alignment.js';
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
const PM_PYROLISK = 11;
const PM_HOMUNCULUS = 52;
const PM_IMP = 53;

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

async function releaseCameraDemon(
    object, x, y, state, publish, random, summonMonster,
) {
    if (random(3) !== 0) return null;
    const mnum = random(3) === 0 ? PM_IMP : PM_HOMUNCULUS;
    const monster = await summonMonster(mnum, x, y, 0);
    if (!monster) return null;
    if (canProjectMonster(monster, monster.mx, monster.my)) {
        const subject = state.u?.hallucinating
            ? `A ${randomDisplayMonsterName()}`
            : 'The picture-painting demon';
        await publish(`${subject} is released!`);
    }
    monster.mpeaceful = object.cursed ? 0 : 1;
    setMonsterMalign(monster, state);
    return monster;
}

export async function breakFloorObject(object, {
    state = game,
    heroCaused = true,
    publish = plineWithContinuation,
    random = rn2,
    luckRandom = rnl,
    rollDice = d,
    summonMonster = makemonAt,
    explodeFire = createFireExplosion,
    finishMonsterKill,
} = {}) {
    if (!objectBreaksOnImpact(object, random)) {
        return { destroyed: false, observed: false };
    }
    return breakObjectAtLocation(object, {
        state, heroCaused, publish, random, luckRandom, rollDice,
        summonMonster, explodeFire, finishMonsterKill,
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
    explodeFire = createFireExplosion,
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
        ? await releaseCameraDemon(
            object, x, y, state, publish, random, summonMonster,
        ) : null;
    if (object.oclass === POTION_CLASS)
        await applyPotionBreakEffect(object, x, y, state, publish);

    const oilExplosion = object.otyp === POT_OIL && object.lamplit;
    const eggExplosion = object.otyp === EGG
        && object.corpsenm === PM_PYROLISK;
    if (heroCaused && object.otyp === EGG && object.spe
        && Number.isInteger(object.corpsenm) && object.corpsenm >= 0) {
        const quantity = object.quan ?? object.quantity ?? 1;
        state.u.uluck = Math.max(
            -13, Math.min(13, (state.u.uluck ?? 0) - Math.min(quantity, 5)),
        );
    }

    const dilutedOil = !!object.odiluted;
    deleteObject(object);
    newsym(x, y);
    if (oilExplosion) {
        await explodeFire(x, y, rollDice(dilutedOil ? 3 : 4, 4), {
            state, name: 'burning oil', heroCaused, publish,
            random, finishMonsterKill,
        });
    } else if (eggExplosion) {
        await explodeFire(x, y, rollDice(3, 6), {
            state, name: 'fireball', heroCaused, publish,
            random, finishMonsterKill,
        });
    }
    return {
        destroyed: true,
        observed: visible || audible,
        cameraDemon,
    };
}
