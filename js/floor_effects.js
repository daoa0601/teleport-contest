// What happens when a free object lands on a dungeon square.
// C ref: do.c flooreffects() object landing branches.

import {
    ALTAR, CORR, IS_POOL, LAVAPOOL, MOAT, POOL, ROOM, WATER,
    TT_PIT, is_hole, is_pit,
} from './const.js';
import { landObjectOnAltar } from './altar_object.js';
import { place_object, stack_object } from './floor_object.js';
import { game } from './gstate.js';
import { meldNearbyFloorGlobs } from './glob.js';
import { breakObjectAtLocation } from './object_breakage.js';
import { deleteObject } from './object_delete.js';
import { BOULDER, OBJECT_NAMES, POT_OIL } from './object_data.js';
import { makePlural } from './object_grammar.js';
import { shipObject } from './object_migration.js';
import { objectResistsDestruction } from './object_state.js';
import { fillPitWithBoulderAt } from './pit_fill.js';
import { potionImpactObjectName } from './potion_hit.js';
import { rnl, rn2 } from './rng.js';
import { heroIsBlind, heroIsDeaf } from './senses.js';
import { destroyLavaFloorObjects, waterDamageObject } from './trap.js';
import { cansee } from './vision.js';

const POTION_CLASS = 8;

function squareIsVisible(state, x, y) {
    if (state === game) return cansee(x, y);
    if (state.blind || (state.u?.blindTurns ?? 0) > 0) return false;
    return !state.viz_array || !!(state.viz_array?.[y]?.[x] & 0x2);
}

async function publishAll(messages, publish) {
    for (const message of messages) await publish(message);
}

function potionLandingSubject(object, state) {
    const quantity = object.quan ?? object.quantity ?? 1;
    const name = potionImpactObjectName(object, state);
    return quantity === 1
        ? `The ${name}`
        : `The ${quantity} ${makePlural(name)}`;
}

async function breakPotionOnHotGround(
    object, x, y, state, publish, random, luckRoll,
) {
    const visible = squareIsVisible(state, x, y);
    const quantity = object.quan ?? object.quantity ?? 1;
    if (visible) {
        const singular = quantity === 1;
        await publish(`${potionLandingSubject(object, state)} ${
            singular ? 'heats' : 'heat'
        } up as ${singular ? 'it hits' : 'they hit'} the hot ground.`);
    }

    let survivalChance = object.blessed ? 70 : 50;
    if (object.invlet) survivalChance += (state.u?.uluck ?? 0) * 2;
    if (object.otyp === POT_OIL) survivalChance = 100;
    if (objectResistsDestruction(
        object, survivalChance, 100, random,
    )) return false;

    if (visible) {
        await publish(quantity === 1
            ? 'It shatters from the heat!'
            : 'They shatter from the heat!');
    } else if (!heroIsDeaf(state)) {
        await publish('You hear a shattering noise.');
    }
    await breakObjectAtLocation(object, {
        state,
        heroCaused: false,
        showBreakMessage: false,
        publish,
        random,
        luckRandom: luckRoll,
    });
    return true;
}

function fallenObjectSubject(object) {
    const quantity = object.quan ?? object.quantity ?? 1;
    const noun = object.oextra?.oname || object.oname
        || object.name || OBJECT_NAMES[object.otyp] || 'object';
    return quantity === 1 ? `The ${noun}`
        : `The ${quantity} ${makePlural(noun)}`;
}

async function handleHeroShaftEdge(
    object, trap, x, y, state, publish, random,
) {
    if (state.u?.ux !== x || state.u?.uy !== y
        || !(trap?.tseen ?? trap?.seen)) return false;
    if (is_pit(trap.ttyp)
        && !(state.u?.utrap && state.u.utraptype === TT_PIT)) {
        const noun = object.oextra?.oname || object.oname
            || object.name || OBJECT_NAMES[object.otyp] || 'object';
        if (heroIsBlind(state) && !heroIsDeaf(state))
            await publish(`You hear the ${noun} tumble downwards.`);
        else {
            const verb = (object.quan ?? object.quantity ?? 1) === 1
                ? 'tumbles' : 'tumble';
            await publish(`${fallenObjectSubject(object)} ${verb} into ${
                trap.madeby_u ? 'your' : 'the'} pit.`);
        }
        return false;
    }
    if (!is_hole(trap.ttyp)) return false;
    return shipObject(object, x, y, { state, publish, random });
}

export async function landFloorObject(
    object,
    x,
    y,
    {
        state = game,
        publish = async () => {},
        random = rn2,
        luckRoll = rnl,
    } = {},
) {
    const location = state.level?.at?.(x, y);
    object.ox = x;
    object.oy = y;

    if (object.otyp === BOULDER
        && [MOAT, POOL, WATER, LAVAPOOL].includes(location?.typ)) {
        place_object(object, x, y, state);
        const { dropBoulderIntoLiquid } = await import('./boulder_pool.js');
        await dropBoulderIntoLiquid(object, x, y, state);
        return null;
    }

    const trap = state.level?.traps?.find(candidate =>
        candidate.tx === x && candidate.ty === y);
    if (object.otyp === BOULDER && trap
        && (is_pit(trap.ttyp) || is_hole(trap.ttyp))) {
        place_object(object, x, y, state);
        if (fillPitWithBoulderAt(x, y, state).filled) return null;
        return stack_object(object, state);
    }

    if (location?.typ === LAVAPOOL) {
        const landed = [object];
        await destroyLavaFloorObjects(landed, {
            publish,
            random,
            visible: squareIsVisible(state, x, y),
        });
        if (!landed.includes(object)) return null;
    } else if (IS_POOL(location?.typ)) {
        const messages = [];
        const result = await waterDamageObject(object, messages, state, {
            random,
            luckRoll,
        });
        await publishAll(messages, publish);
        if (result === 'destroyed') {
            deleteObject(object, state);
            return null;
        }
    }

    if (await handleHeroShaftEdge(
        object, trap, x, y, state, publish, random,
    )) return null;

    if (object.globby) {
        place_object(object, x, y, state);
        return meldNearbyFloorGlobs(object, { state, publish, random });
    }
    if (state.context?.mon_moving
        && location?.typ === ALTAR
        && squareIsVisible(state, x, y)) {
        await landObjectOnAltar(object, {
            state, monsterMoving: true, publish,
        });
    }

    const hotGround = location?.typ === ROOM || location?.typ === CORR;
    if (object.oclass === POTION_CLASS
        && (state.level?.flags?.temperature ?? 0) > 0
        && hotGround
        && await breakPotionOnHotGround(
            object, x, y, state, publish, random, luckRoll,
        )) return null;

    place_object(object, x, y, state);
    return stack_object(object, state);
}
