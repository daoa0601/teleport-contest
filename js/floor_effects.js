// What happens when a free object lands on a dungeon square.
// C ref: do.c flooreffects() object landing branches.
import { ALTAR, CORR, ROOM, TT_PIT, WT_SPLASH_THRESHOLD, is_hole, is_pit, } from './const.js';
import { landObjectOnAltar } from './altar_object.js';
import { dropBoulderIntoLiquid } from './boulder_pool.js';
import { placeObject, stack_object } from './floor_object.js';
import { game, requireGameLevel, requireInitializedGame, requireLiveGame } from './gstate.js';
import { map_background, newsym, plineWithContinuation } from './display.js';
import { meldLandingGlob } from './glob.js';
import { breakObjectAtLocation } from './object_breakage.js';
import { deleteObject } from './object_delete.js';
import { BOULDER, POT_OIL } from './object_data.js';
import { definiteName, definiteObjectAction, objectCombatName, objectNameIsPlural, } from './objnam.js';
import { shipObject } from './object_migration.js';
import { objectResistsDestruction } from './object_state.js';
import { applyBoulderPitEffects } from './pit_fill.js';
import { rnl, rn2 } from './rng.js';
import { publishHeardMessage } from './hero_speech.js';
import { heroIsBlind, heroIsDeaf } from './senses.js';
import { destroyLavaFloorObjects, waterDamageObject } from './trap.js';
import { cansee } from './vision.js';
import { objectWeight } from './weight.js';
import { isLavaAt, isPoolAt } from './terrain_properties.js';
const POTION_CLASS = 8;
function squareIsVisible(state, x, y) {
    if (state === game)
        return cansee(x, y);
    if (state.blind || (state.u?.blindTurns ?? 0) > 0)
        return false;
    return !state.viz_array || !!((state.viz_array[y]?.[x] ?? 0) & 0x2);
}
async function publishAll(messages, publish) {
    for (const message of messages)
        await publish(message);
}
async function breakPotionOnHotGround(object, x, y, state, publish, random, luckRoll) {
    const visible = squareIsVisible(state, x, y);
    const quantity = object.quan ?? object.quantity ?? 1;
    if (visible) {
        await publish(`${definiteObjectAction(object, 'heat', state)} up as ${objectNameIsPlural(object, state) ? 'they hit' : 'it hits'} the hot ground.`);
    }
    let survivalChance = object.blessed ? 70 : 50;
    if (object.invlet)
        survivalChance += (state.u?.uluck ?? 0) * 2;
    if (object.otyp === POT_OIL)
        survivalChance = 100;
    if (objectResistsDestruction(object, survivalChance, 100, random))
        return false;
    if (visible) {
        await publish(quantity === 1
            ? 'It shatters from the heat!'
            : 'They shatter from the heat!');
    }
    else if (!heroIsDeaf(state)) {
        await publishHeardMessage('a shattering noise.', publish, state);
    }
    await breakObjectAtLocation(object, {
        x, y, state,
        heroCaused: false,
        showBreakMessage: false,
        publish,
        random,
        luckRandom: luckRoll,
    });
    return true;
}
async function handleHeroShaftEdge(object, trap, x, y, state, publish, random) {
    if (!trap || state.u.ux !== x || state.u.uy !== y || !trap.tseen)
        return null;
    if (is_pit(trap.ttyp)
        && !(state.u?.utrap && state.u.utraptype === TT_PIT)) {
        if (heroIsBlind(state) && !heroIsDeaf(state)) {
            const name = definiteName(objectCombatName(object, {
                state, includeCorpseSpecies: false,
            }), state);
            await publish(`You hear ${name} tumble downwards.`);
        }
        else {
            await publish(`${definiteObjectAction(object, 'tumble', state)} into ${trap.madeby_u ? 'your' : 'the'} pit.`);
        }
        return { finished: false, object };
    }
    if (!is_hole(trap.ttyp))
        return null;
    const shipped = await shipObject(object, x, y, {
        state: requireInitializedGame(state), publish, random,
    });
    return shipped ? { finished: true, object: null } : { finished: false, object };
}
export async function applyFloorEffects(object, x, y, { state = game, publish = plineWithContinuation, random = rn2, luckRoll = rnl, verb = '', } = {}) {
    requireLiveGame(state);
    if (object.where !== 'free')
        throw new Error('floor effects require a free object');
    const level = requireGameLevel(state);
    const location = level.at(x, y);
    if (!location)
        throw new RangeError(`Floor effects require a map square at (${x}, ${y}).`);
    if (object.otyp === BOULDER
        && await dropBoulderIntoLiquid(object, x, y, state, { publish, random })) {
        return { finished: true, object: null };
    }
    const trap = state.level?.traps?.find(candidate => candidate.tx === x && candidate.ty === y);
    if (object.otyp === BOULDER && trap
        && (is_pit(trap.ttyp) || is_hole(trap.ttyp))) {
        return applyBoulderPitEffects(object, trap, x, y, { state, publish, verb });
    }
    if (isLavaAt(x, y, state)) {
        const landed = [object];
        await destroyLavaFloorObjects(landed, {
            state, x, y,
            publish,
            random,
            visible: squareIsVisible(state, x, y),
        });
        if (!landed.includes(object))
            return { finished: true, object: null };
        return { finished: false, object };
    }
    else if (isPoolAt(x, y, state)) {
        const airborne = state.u.levitating || state.u.flying;
        if ((heroIsBlind(state) || airborne) && !heroIsDeaf(state)
            && state.u.ux === x && state.u.uy === y) {
            if (!state.u.uinwater) {
                if (objectWeight(object) > WT_SPLASH_THRESHOLD)
                    await publish('Splash!');
                else if (airborne)
                    await publish('Plop!');
            }
            map_background(x, y, false);
            newsym(x, y);
        }
        const messages = [];
        const result = await waterDamageObject(object, messages, state, {
            random,
            luckRoll,
        });
        await publishAll(messages, publish);
        if (result === 'destroyed') {
            await deleteObject(object, state);
            return { finished: true, object: null };
        }
        return { finished: false, object };
    }
    const shaftLanding = await handleHeroShaftEdge(object, trap, x, y, state, publish, random);
    if (shaftLanding)
        return shaftLanding;
    if (object.globby) {
        const merged = await meldLandingGlob(object, x, y, {
            state, publish, random,
        });
        if (merged)
            return { finished: true, object: merged };
        return { finished: false, object };
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
        && await breakPotionOnHotGround(object, x, y, state, publish, random, luckRoll))
        return { finished: true, object: null };
    return { finished: false, object };
}
export async function landFloorObject(object, x, y, options = {}) {
    const state = options.state ?? game;
    const result = await applyFloorEffects(object, x, y, options);
    if (result.finished)
        return result.object;
    await placeObject(object, x, y, state);
    return await stack_object(object, state);
}
//# sourceMappingURL=floor_effects.js.map