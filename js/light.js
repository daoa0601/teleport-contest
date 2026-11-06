// Object light and burn timers.
import { SCROLL_CLASS } from './objclass.js';
import { monsterHasMapPosition } from './steed.js';
import { wakeMonstersNearWithMessages, finishMonsterKilled, finishHeroMonsterKillOutcome } from './mon.js';
import { AD_BLND } from './monster_attack_types.js';
import { beginBallAndChainRedraw, finishBallAndChainMove } from './ball.js';
import { definiteObjectAction, objectNameIsPlural, ownedObjectName } from './objnam.js';
import { game, requirePlayingGame } from './gstate.js';
import { plineWithContinuation } from './pline.js';
import { beginObjectBurn, endObjectBurn, lightObjectIsGlobal, objectsInTimerGraph } from './timeout.js';
import { monsterName } from './do_name.js';
import { possessiveName } from './hacklib.js';
import { artifactEmitsLight } from './artifact.js';
import { CORR, Is_rogue_level, Is_waterlevel, PLNMSG_OBJ_GLOWS } from './const.js';
import { canSeeMonster, canSpotMonster, flush_screen, map_invisible } from './display.js';
import { BRASS_LANTERN, CANDELABRUM_OF_INVOCATION, GOLD_DRAGON_SCALE_MAIL, GOLD_DRAGON_SCALES, MAGIC_LAMP, OIL_LAMP, POT_OIL, TALLOW_CANDLE, WAX_CANDLE, } from './object_data.js';
import { rnd } from './rng.js';
import { impactArtifactLight } from './potion.js';
import { cansee, clearAreaCells, vision_recalc } from './vision.js';
import { heroIsBlind, heroIsDeaf } from './senses.js';
import { carriedObjectOwner } from './shk.js';
import { getObjectLocation } from './zap.js';
import { placeObjectSynchronously, remove_object } from './mkobj.js';
import { roomForRoomno } from './hack.js';
import { snuffLitObject } from './apply.js';
import { monsterDigests, monsterIsWhirly } from './mondata.js';
export const CANDLE_TYPES = new Set([
    CANDELABRUM_OF_INVOCATION, TALLOW_CANDLE, WAX_CANDLE,
]);
export const TIMED_LIGHT_TYPES = new Set([
    BRASS_LANTERN, OIL_LAMP, POT_OIL, ...CANDLE_TYPES,
]);
export const LIGHT_TYPES = new Set([...TIMED_LIGHT_TYPES, MAGIC_LAMP]);
// C light.c:obj_sheds_light(): obj_is_burning() — lamplit and ignitable
// or an artifact light.
export function objectShedsLight(object) {
    return !!object?.lamplit
        && (LIGHT_TYPES.has(object.otyp) || artifactEmitsLight(object));
}
// C light.c:candle_light_range(), arti_light_radius(): one object's light
// radius, including the gold-dragon scales and candelabrum ranges.
export function objectLightRadius(object, state = game) {
    if (!object?.lamplit)
        return 0;
    // Clearing a worn slot precedes the message and the call that extinguishes it.
    const goldArmor = object.otyp === GOLD_DRAGON_SCALE_MAIL || object.otyp === GOLD_DRAGON_SCALES;
    if (goldArmor || artifactEmitsLight(object)) {
        if (object === state.uskin)
            return 1;
        const radius = object.blessed ? 3 : object.cursed ? 1 : 2;
        return radius + Number(object.otyp === GOLD_DRAGON_SCALE_MAIL);
    }
    if (object.otyp === POT_OIL)
        return 1;
    if (object.otyp === CANDELABRUM_OF_INVOCATION)
        return object.spe < 4 ? 2 : object.spe < 7 ? 3 : 4;
    if (object.otyp === TALLOW_CANDLE || object.otyp === WAX_CANDLE)
        return Math.min(15, Math.floor(Math.sqrt(object.quan ?? object.quantity ?? 1)) + 1);
    return LIGHT_TYPES.has(object.otyp) ? 3 : 0;
}
// C light.c:arti_light_description(): the adverb for the current radius.
export function equipmentLightDescription(object, state = game) {
    return ['strangely', 'dimly', 'brightly', 'brilliantly', 'radiantly'][objectLightRadius(object, state)] || 'strangely';
}
// Part of C wield.c:ready_weapon(), worn.c:m_dowear_type(): the shared
// "begins to shine %s" / "stops shining" phrasing.
export function equipmentLightMessage(object, shining, state = game) {
    return shining
        ? `${definiteObjectAction(object, 'begin', state)} to shine ${equipmentLightDescription(object, state)}!`
        : `${definiteObjectAction(object, 'stop', state)} shining.`;
}
// Part of C wield.c:ready_weapon(): begin_burn() plus the shine message
// for a wielded light artifact.
export async function lightWieldedArtifact(object, state = game, publish = plineWithContinuation) {
    if (!artifactEmitsLight(object) || object.lamplit)
        return;
    beginObjectBurn(object, state);
    if (!heroIsBlind(state))
        await publish(equipmentLightMessage(object, true, state));
}
// Part of C light.c:snuff_light_source(): the end_burn() half that skips
// artifact lights.
function snuffOrdinaryLight(object) {
    if (!object?.lamplit || !LIGHT_TYPES.has(object.otyp))
        return false;
    return endObjectBurn(object, game, game.moves ?? 0);
}
// C light.c:snuff_light_source().  The native light_base list is
// newest-first and the search returns once one source at the location has
// been extinguished, so a square holding several burning objects keeps
// every one of them lit except the one closest to the list head.  _litSeq
// tracks that list position: raising on each lighting, and reversed by
// restoreLightSourceBatch() below when C would reload a saved batch.
export function snuffLightSource(x, y, state = game) {
    const candidates = [...(state.level?.objects?.[x]?.[y] || [])];
    const carrier = state.level?.monsters?.find(monster => monster.mx === x && monster.my === y);
    const inventories = new Set([carrier?.minvent, carrier?.inventory]);
    for (const inventory of inventories)
        candidates.push(...(inventory || []));
    if (state.u?.ux === x && state.u?.uy === y)
        candidates.push(...(state.inventory || []));
    let target = null;
    let newest = -1;
    for (const object of candidates) {
        if (!objectShedsLight(object) || artifactEmitsLight(object))
            continue;
        const order = object._litSeq ?? 0;
        if (order > newest) {
            newest = order;
            target = object;
        }
    }
    if (target)
        snuffOrdinaryLight(target);
}
// C light.c:save_light_sources() writes a batch (the global lights, or one
// level's lights) newest-first, and restore_light_sources() pushes each
// entry back onto the front of light_base, so a restored batch returns
// reversed and ahead of the lights that never left the list.  Re-stamp the
// batch the same way: previously-oldest first, above every other light.
export function restoreLightSourceBatch(batch, state = game) {
    const lights = (batch ?? [])
        .filter(object => objectLightRadius(object, state) > 0)
        .sort((left, right) => (left._litSeq ?? 0) - (right._litSeq ?? 0));
    if (!lights.length)
        return;
    const base = state._lightSerial ?? 0;
    lights.forEach((object, index) => {
        object._litSeq = base + lights.length - index;
    });
    state._lightSerial = base + lights.length;
}
// Part of C restore.c:getlev(): the level-local light-source restoration.
// C getlev() restores the entered level's light sources after the level
// data (restore.c:1145); other levels keep waiting in their files.
export function restoreLevelLightSources(state = game) {
    restoreLightSourceBatch(objectsInTimerGraph(state).filter(object => !lightObjectIsGlobal(object)), state);
}
// C restore.c:655 reloads the global batch while reading the game state,
// then getlev() pushes the current level's batch in front of it.
export function restoreSavedLightSources(state = game) {
    restoreLightSourceBatch(objectsInTimerGraph(state).filter(lightObjectIsGlobal), state);
    restoreLevelLightSources(state);
}
// Part of C mhitm.c:gulpmm(): the engulfed inventory light pass, shared with uhitm.c:gulpum().
// The engulf loops at mhitm.c:868 and uhitm.c:4985 inline this pass: every
// light a swallowed actor carries is snuffed with apply.c:snuff_lit()
// semantics (apply.ts:snuffLitObject is its port), the carrier's square
// deciding visibility.
export async function snuffMonsterInventoryLights(defender, state, publish) {
    for (const object of defender.minvent || defender.inventory || []) {
        if (!object.lamplit)
            continue;
        const lamp = [OIL_LAMP, MAGIC_LAMP, BRASS_LANTERN, POT_OIL].includes(object.otyp);
        const candle = object.otyp === TALLOW_CANDLE || object.otyp === WAX_CANDLE;
        const candelabrum = object.otyp === CANDELABRUM_OF_INVOCATION;
        if (!lamp && !candle && !candelabrum)
            continue;
        if (cansee(defender.mx, defender.my)) {
            if (lamp)
                await publish(`${ownedObjectName(object, state)} ${objectNameIsPlural(object, state) ? 'go' : 'goes'} out!`);
            else {
                const many = candle ? object.quan > 1 : object.spe > 1;
                await publish(`${carriedObjectOwner(object, state)} ${candelabrum ? "candelabrum's " : ''}candle${many ? "s' flames are" : "'s flame is"} extinguished.`);
            }
        }
        endObjectBurn(object, state);
    }
}
export async function lightHitsGremlin(monster, damage, finishMonsterKill) {
    const dx = monster.mx - game.u.ux;
    const dy = monster.my - game.u.uy;
    if (!heroIsDeaf(game) && dx * dx + dy * dy <= 90) {
        const reaction = damage > monster.mhp / 2
            ? 'wails in agony' : 'cries out in pain';
        await plineWithContinuation(`${monsterName(monster, { capitalized: true })} ${reaction}!`);
    }
    else if (canSeeMonster(monster)) {
        await plineWithContinuation(`${monsterName(monster, { capitalized: true })} recoils from the light!`);
    }
    monster.mhp -= damage;
    await wakeMonstersNearWithMessages(monster.mx, monster.my, 30);
    if (monster.mhp <= 0) {
        if (finishMonsterKill)
            return finishMonsterKill(monster, monster.mx, monster.my);
        if (game.context.mon_moving)
            return finishMonsterKilled(monster, game, {
                cause: null, damageType: AD_BLND,
            });
        return finishHeroMonsterKillOutcome(monster, monster.mx, monster.my);
    }
    else if (cansee(monster.mx, monster.my)
        && !canSpotMonster(monster)) {
        await map_invisible(monster.mx, monster.my);
    }
}
// C light.c:show_transient_light(). A thrown or kicked lit object lights its
// flight; a null object is an camera flash lighting one square.
export async function showTransientLight(object, x, y, state = game) {
    requirePlayingGame(state);
    if (!object && state.level.requireAt(x, y).lit)
        return;
    const range = object ? objectLightRadius(object, state) : 0;
    if (object) {
        if (!range || object.where !== 'free')
            throw new Error(`Transient light requires a free, lit object: ${object.o_id}`);
        placeObjectSynchronously(object, x, y, state);
    }
    else {
        (state._transientLights ??= []).unshift({ x, y, range: 0 });
    }
    try {
        await vision_recalc(0);
        await flush_screen(0);
        for (const monster of state.level.monsters) {
            if (monster.dead || monster.mhp <= 0 || monster.isgd && !monster.mx)
                continue;
            const distance = (monster.mx - x) ** 2 + (monster.my - y) ** 2;
            if (distance <= range * range && canSeeMonster(monster))
                monster.mtemplit = 1;
        }
        if (object)
            await state.animationFrame?.();
    }
    finally {
        if (object)
            remove_object(object, state);
    }
}
// C light.c:transient_light_cleanup().
export async function cleanupTransientLight(state = game) {
    requirePlayingGame(state);
    discardFlashes(state);
    if (state.vision_full_recalc)
        await vision_recalc(0);
    let changed = false;
    for (const monster of state.level.monsters) {
        if (monster.dead || monster.mhp <= 0 || !monster.mtemplit)
            continue;
        monster.mtemplit = 0;
        changed = true;
        if (!canSpotMonster(monster))
            await map_invisible(monster.mx, monster.my);
    }
    if (changed)
        await flush_screen(0);
}
// C light.c:discard_flashes().
export function discardFlashes(state = game) {
    if (!state._transientLights?.length)
        return;
    delete state._transientLights;
    state.vision_full_recalc = 1;
}
// C light.c:new_light_source() prepends to light_base, so each lighting
// gives the object the newest slot in the list order that snuff searches.
// Also C light.c:new_light_core(): new_light_source() is only a thin
// wrapper around this core.
export function registerObjectLightSource(object, state) {
    state._lightSerial = (state._lightSerial ?? 0) + 1;
    object._litSeq = state._lightSerial;
}
// Part of C apply.c:dorub(): performs this type change before the released djinni can
// grant a fatal wish.  A lit magic lamp already has a light source but no
// timer; once it becomes an oil lamp, begin_burn(..., TRUE) attaches the
// ordinary fuel timer while preserving that light-source identity.
export function transformMagicLampToOilLamp(object, oilAge, state = game, currentTurn = state.moves ?? 0) {
    if (object?.otyp !== MAGIC_LAMP || !Number.isFinite(oilAge)
        || oilAge <= 0)
        return false;
    object.otyp = OIL_LAMP;
    object.name = 'oil lamp';
    object.plural = 'oil lamps';
    object.spe = 0;
    object.age = oilAge;
    if (object.lamplit)
        beginObjectBurn(object, state, currentTurn);
    return true;
}
//# sourceMappingURL=light.js.map