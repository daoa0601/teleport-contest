// Object breakage and its immediate effects.
// C refs: dothrow.c breaktest(), hero_breaks(), and breakobj().

import {
    ACID_VENOM, BLINDING_VENOM, BOULDER, CREAM_PIE, EGG, EXPENSIVE_CAMERA,
    CRYSTAL_BALL, LENSES, MELON, MIRROR, OBJECT_MATERIAL, OBJECT_NAMES,
    POT_OIL, POT_WATER, STATUE,
} from './object_data.js';
import {
    newsym, plineWithContinuation,
} from './display.js';
import { releaseCameraDemon } from './camera.js';
import {
    applyHeroEggLuckPenalty, explodePyroliskEggAt, isPyroliskEgg,
} from './egg_impact.js';
import { explodeLitOilPotion } from './fire_explosion.js';
import { game, requireLiveGame } from './gstate.js';
import { objectDescription } from './object_description.js';
import { deleteObject, delobj } from './object_delete.js';
import { observeObjectForNaming } from './objnam.js';
import { makemonAt } from './mklev.js';
import { objectResistsDestruction } from './object_state.js';
import {
    applySupportedPotionVapor, heroPotionVaporProfile,
    potionImpactObjectName,
} from './potion_hit.js';
import { d, rnl, rn2 } from './rng.js';
import { heroIsBlind, heroIsDeaf } from './senses.js';
import {
    costlySpot, insideShopRoomAt, settleThrownShopObject,
} from './shk.js';
import { stolenValue } from './shop_loss.js';
import { makeAngryShopkeeper } from './shop_damage.js';
import { cansee } from './vision.js';
import type { MessagePublisher } from './display.js';
import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { Monster } from './monster_types.js';

export interface ObjectBreakOptions {
    x?: number;
    y?: number;
    fromInventory?: boolean;
    inView?: boolean | null;
    state?: GameState;
    heroCaused?: boolean;
    showBreakMessage?: boolean;
    publish?: MessagePublisher;
    random?: typeof rn2;
    luckRandom?: typeof rnl;
    rollDice?: typeof d;
    summonMonster?: typeof makemonAt;
}

export interface ObjectBreakResult {
    destroyed: boolean;
    observed: boolean;
    heroDied?: boolean;
    cameraDemon?: Monster | null;
}


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

export function objectBreaksOnImpact(object: GameObject, random = rn2) {
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

function objectName(object: GameObject) {
    if (object.oclass === POTION_CLASS)
        return potionImpactObjectName(object);
    return object.name || OBJECT_NAMES[object.otyp] || 'object';
}

async function publishBreakMessage(object: GameObject, visible: boolean, audible: boolean, publish: MessagePublisher, state: GameState) {
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
    observeObjectForNaming(object, { state });
    const description = objectDescription(object, { state });
    const subject = description.charAt(0).toUpperCase() + description.slice(1);
    await publish(`${subject} ${
        quantity === 1 ? 'shatters' : 'shatter'
    }${intoPieces}!`);
}

async function deleteBrokenObject(object: GameObject, state: GameState) {
    await deleteObject(object, state);
}

async function crackGlassArmor(
    object: GameObject, visible: boolean, publish: MessagePublisher, luckRandom: typeof rnl,
    state: GameState,
) {
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
    await deleteBrokenObject(object, state);
    return true;
}

async function applyPotionBreakEffect(
    object: GameObject, x: number, y: number, state: GameState, publish: MessagePublisher,
) {
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

async function settleBrokenShopObject(
    object: GameObject, x: number, y: number, fromInventory: boolean, state: GameState,
    publish: MessagePublisher,
) {
    if (fromInventory || object.unpaid) {
        if ((state.u.ushops?.length ?? 0) || object.unpaid)
            await settleThrownShopObject(object, x, y, state, publish, { broken: true });
        return;
    }
    const spot = !object.no_charge && costlySpot(x, y, state);
    if (!spot) return;
    const { resident, roomno } = spot;
    const shop = resident.eshk;
    if (!shop) throw new Error('A costly shop square has no shopkeeper account.');
    const sequence = state._heroActionSeq ?? 0;
    if (sequence !== shop.break_seq) shop.seq_peaceful = resident.mpeaceful;
    const loss = await stolenValue(object, x, y, shop.seq_peaceful, {
        silent: false, state, publish,
    });
    if (loss > 0 && sequence !== shop.break_seq
        && (roomno !== state.u.ushops?.[0]
            || !insideShopRoomAt(state, state.u.ux, state.u.uy)))
        await makeAngryShopkeeper(resident, state);
    shop.break_seq = sequence;
}

export async function breakFloorObject(object: GameObject, {
    x = object.ox,
    y = object.oy,
    fromInventory = false,
    inView = null,
    state = game,
    heroCaused = true,
    publish = plineWithContinuation,
    random = rn2,
    luckRandom = rnl,
    rollDice = d,
    summonMonster = makemonAt,
}: ObjectBreakOptions = {}): Promise<ObjectBreakResult> {
    requireLiveGame(state);
    if (!objectBreaksOnImpact(object, random)) {
        return { destroyed: false, observed: false };
    }
    return breakObjectAtLocation(object, {
        x, y, fromInventory, inView, state, heroCaused, publish, random, luckRandom, rollDice,
        summonMonster,
    });
}

export async function breakObjectAtLocation(object: GameObject, {
    x = object.ox,
    y = object.oy,
    fromInventory = false,
    inView = null,
    state = game,
    heroCaused = true,
    showBreakMessage = true,
    publish = plineWithContinuation,
    random = rn2,
    luckRandom = rnl,
    rollDice = d,
    summonMonster = makemonAt,
}: ObjectBreakOptions = {}): Promise<ObjectBreakResult> {
    requireLiveGame(state);
    const visible = !heroIsBlind(state)
        && (inView ?? (fromInventory || cansee(x, y)));
    const audible = !heroIsDeaf(state);

    const glassArmor = object.oclass === ARMOR_CLASS
        && OBJECT_MATERIAL[object.otyp] === GLASS;
    if (glassArmor) {
        const destroyed = await crackGlassArmor(
            object, visible, publish, luckRandom, state,
        );
        if (destroyed) newsym(x, y);
        return { destroyed, observed: destroyed && (visible || audible) };
    }

    if (showBreakMessage)
        await publishBreakMessage(object, visible, audible, publish, state);
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
        if (state.program_state?.gameover)
            return { destroyed: false, observed: visible || audible };
    }

    const oilExplosion = object.otyp === POT_OIL && object.lamplit;
    const eggExplosion = isPyroliskEgg(object);
    if (heroCaused) applyHeroEggLuckPenalty(object, state);
    if (oilExplosion) {
        const explosion = await explodeLitOilPotion(object, x, y, {
            state, heroCaused, publish, random, rollDice,
        });
        if (explosion.heroDied)
            return { destroyed: false, observed: visible || audible, heroDied: true };
    }
    if (heroCaused)
        await settleBrokenShopObject(object, x, y, fromInventory, state, publish);
    // Fracture callers replace the stone object after breakobj settles its cost.
    if (object.otyp === BOULDER || object.otyp === STATUE)
        return { destroyed: false, observed: false };
    await delobj(object, state, random);
    newsym(x, y);
    if (eggExplosion) {
        await explodePyroliskEggAt(x, y, {
            state, heroCaused, publish, random, rollDice,
        });
    }
    return {
        destroyed: true,
        observed: visible || audible,
        cameraDemon,
    };
}
