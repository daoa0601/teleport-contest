// Object light and burn timers.
// C refs: timeout.c begin_burn()/burn_object()/end_burn(), light.c.
import { formatSeenMessage } from './hero_speech.js';
import { monsterHasMapPosition } from './steed.js';
import { wakeMonstersNearWithMessages, finishMonsterKilled, maybeUnhideAt } from './mon.js';
import { AD_BLND } from './monster_attack_types.js';
import { finishHeroMonsterKillOutcome } from './hero_monster_death.js';
import { heroSpecies } from './polyself.js';
import { beginBallAndChainRedraw, finishBallAndChainMove } from './ball.js';
import { definiteObjectAction, minimalObjectName, makePlural, withIndefiniteArticle, objectName, objectNameIsPlural, ownedObjectName, observeObjectForNaming } from './objnam.js';
import { game, requireGameLevel } from './gstate.js';
import { requireInitializedHero } from './hero_types.js';
import { plineWithContinuation } from './pline.js';
import { beginObjectBurn, endObjectBurn, lightObjectIsGlobal, objectsInTimerGraph, } from './timeout.js';
import { monsterName } from './do_name.js';
import { possessiveName } from './hacklib.js';
import { artifactById, artifactEmitsLight } from './artifacts.js';
import { CORR, G_GONE, Is_rogue_level, Is_waterlevel, MM_EDOG, MM_NOMSG, NO_MINVENT, PLNMSG_OBJ_GLOWS, OBJECT_TIMER_KIND } from './const.js';
import { canSeeMonster, canSpotMonster, map_invisible, newsym } from './display.js';
import { initializePet } from './dog.js';
import { makemonNear } from './mklev.js';
import { unblessObjectState, uncurseObjectState, objectWeight } from './mkobj.js';
import { monsterDigests, monsterIsWhirly } from './monster_data.js';
import { BRASS_LANTERN, CANDELABRUM_OF_INVOCATION, GOLD_DRAGON_SCALE_MAIL, GOLD_DRAGON_SCALES, MAGIC_LAMP, OIL_LAMP, POT_OIL, POT_WATER, TALLOW_CANDLE, WAX_CANDLE } from './object_data.js';
import { rn2, rnd } from './rng.js';
import { learnObjectType } from './o_init.js';
import { impactArtifactLight } from './potion.js';
import { cansee, clearAreaCells, vision_recalc } from './vision.js';
import { heroIsBlind, heroIsDeaf, heroIsHallucinating } from './senses.js';
import { billDummyObject, carriedObjectOwner, chargeUnpaidUsage, costlySpot, objectOwnershipPrefix, deleteObject } from './shk.js';
import { useUpInventoryStack } from './hero_inventory.js';
import { getObjectLocation } from './zap.js';
import { loseHeroHp, roomForRoomno } from './hack.js';
export const CANDLE_TYPES = new Set([
    CANDELABRUM_OF_INVOCATION, TALLOW_CANDLE, WAX_CANDLE,
]);
export const TIMED_LIGHT_TYPES = new Set([
    BRASS_LANTERN, OIL_LAMP, POT_OIL, ...CANDLE_TYPES,
]);
export const LIGHT_TYPES = new Set([...TIMED_LIGHT_TYPES, MAGIC_LAMP]);
const SCROLL_CLASS = 9;
const SPBOOK_CLASS = 10;
const PM_GREMLIN = 40;
const PM_YELLOW_LIGHT = 118;
const PM_BLACK_LIGHT = 119;
export function objectShedsLight(object) {
    return !!object?.lamplit
        && (LIGHT_TYPES.has(object.otyp) || artifactEmitsLight(object));
}
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
// C mkobj.c:maybe_adjust_light(). The active radius follows the blessing state.
export async function adjustObjectLightAfterBlessing(object, oldRadius, state = game) {
    const delta = objectLightRadius(object, state) - oldRadius;
    if (!delta)
        return;
    state.vision_full_recalc = 1;
    if (heroIsBlind(state))
        return;
    const location = getObjectLocation(object, state);
    if (!location)
        return;
    const justGlowed = state._lastPlineKind === PLNMSG_OBJ_GLOWS;
    if (!justGlowed && object.where !== 'inventory' && !cansee(location.x, location.y))
        return;
    const subject = justGlowed ? (object.quan === 1 ? 'It' : 'They') : ownedObjectName(object, state);
    const verb = objectNameIsPlural(object, state) ? 'shine' : 'shines';
    await plineWithContinuation(`${subject} ${verb} ${Math.abs(delta) > 1 ? 'much ' : ''}${delta > 0 ? 'brighter' : 'less brightly'}.`);
}
export function equipmentLightDescription(object, state = game) {
    return ['strangely', 'dimly', 'brightly', 'brilliantly', 'radiantly'][objectLightRadius(object, state)] || 'strangely';
}
export function equipmentLightMessage(object, shining, state = game) {
    return shining
        ? `${definiteObjectAction(object, 'begin', state)} to shine ${equipmentLightDescription(object, state)}!`
        : `${definiteObjectAction(object, 'stop', state)} shining.`;
}
export async function lightWieldedArtifact(object, state = game, publish = plineWithContinuation) {
    if (!artifactEmitsLight(object) || object.lamplit)
        return;
    beginObjectBurn(object, state);
    if (!heroIsBlind(state))
        await publish(equipmentLightMessage(object, true, state));
}
function swallowedLightMessage() {
    const swallower = game.u?.ustuck;
    if (!swallower)
        return null;
    const subject = monsterName(swallower, { capitalized: true });
    if (monsterDigests(swallower))
        return `${possessiveName(subject)} stomach is lit.`;
    return monsterIsWhirly(swallower)
        ? `${subject} shines briefly.`
        : `${subject} glistens.`;
}
async function roomEffectCells(radius, lit) {
    if (!Is_rogue_level(game.u?.uz)) {
        // Sunsword illuminates the hero's spot directly; do_clear_area
        // rejects radius zero in both the native source and the port.
        if (radius === 0)
            return [{ x: game.u.ux, y: game.u.uy }];
        return await clearAreaCells(game.u.ux, game.u.uy, radius);
    }
    const roomno = game.level?.at?.(game.u.ux, game.u.uy)?.roomno;
    const room = roomForRoomno(game.level, roomno ?? 0);
    if (!room)
        return [];
    const cells = [];
    for (let x = room.lx - 1; x <= room.hx + 1; x++) {
        for (let y = room.ly - 1; y <= room.hy + 1; y++)
            cells.push({ x, y });
    }
    room.rlit = lit ? 1 : 0;
    return cells;
}
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
async function affectCarriedLights(worsen) {
    let stillLit = 0;
    for (const object of [...game.inventory]) {
        if (!object.lamplit)
            continue;
        if (artifactEmitsLight(object))
            await impactArtifactLight(object, worsen);
        else if (worsen)
            await snuffLitObject(object);
        if (object.lamplit)
            stillLit++;
    }
    return stillLit;
}
// C apply.c:snuff_lit()/snuff_candle(). Callers keep the object in its
// native ownership phase: in_container() has already removed it from inventory.
export async function snuffLitObject(object, state = game, publish = plineWithContinuation) {
    if (!object.lamplit || !LIGHT_TYPES.has(object.otyp))
        return false;
    const location = getObjectLocation(object, state);
    const visible = object.where === 'minvent'
        ? !!location && cansee(location.x, location.y) : !heroIsBlind(state);
    if (visible) {
        if (CANDLE_TYPES.has(object.otyp)) {
            const candelabrum = object.otyp === CANDELABRUM_OF_INVOCATION;
            const many = candelabrum ? object.spe > 1 : object.quan > 1;
            await publish(`${carriedObjectOwner(object, state)} ${candelabrum ? "candelabrum's " : ''}candle${many ? "s' flames are" : "'s flame is"} extinguished.`);
        }
        else {
            await publish(`${ownedObjectName(object, state)} ${objectNameIsPlural(object, state) ? 'go' : 'goes'} out!`);
        }
    }
    endObjectBurn(object, state);
    return true;
}
// C apply.c:snuff_lit(), for the inventory enclosed by an engulfing actor.
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
export async function lightRoom(lit, { radius = 5, source, finishMonsterKill } = {}) {
    const blind = heroIsBlind();
    const swallowed = !!game.u?.uswallow;
    const noEffect = swallowed || game.underwater || game.u?.uinwater
        || Is_waterlevel(game.u?.uz);
    if (!lit) {
        const stillLit = await affectCarriedLights(true);
        if (!blind) {
            const message = stillLit
                ? 'The ambient light seems dimmer.'
                : swallowed
                    ? 'It seems even darker in here than before.'
                    : 'You are surrounded by darkness!';
            await plineWithContinuation(message);
        }
    }
    else {
        if (source?.oclass === SCROLL_CLASS && source.blessed)
            await affectCarriedLights(false);
        if (swallowed) {
            const message = swallowedLightMessage();
            if (!blind && message)
                await plineWithContinuation(message);
        }
        else if (!blind && (!Is_rogue_level(game.u?.uz)
            || game.level?.at?.(game.u.ux, game.u.uy)?.typ !== CORR)) {
            await plineWithContinuation(`A lit field ${noEffect ? 'briefly ' : ''}surrounds you!`);
        }
    }
    if (noEffect)
        return false;
    const ballAndChain = !lit && !blind ? await beginBallAndChainRedraw() : null;
    const gremlins = [];
    for (const { x, y } of await roomEffectCells(radius, lit)) {
        const location = game.level?.at?.(x, y);
        if (!location)
            continue;
        location.lit = !!lit;
        if (!lit) {
            snuffLightSource(x, y);
            continue;
        }
        const monster = game.level?.monsters?.find(candidate => monsterHasMapPosition(candidate, game) &&
            candidate.mx === x && candidate.my === y
            && candidate.mnum === PM_GREMLIN
            && !candidate.dead && (candidate.mhp ?? 1) > 0);
        if (monster)
            gremlins.push(monster);
    }
    if (!blind) {
        await vision_recalc(2);
        await finishBallAndChainMove(ballAndChain);
    }
    game.vision_full_recalc = 1;
    if (lit && gremlins.length) {
        await vision_recalc(0);
        for (const gremlin of gremlins.reverse()) {
            if (!finishMonsterKill)
                throw new TypeError('lightRoom needs a monster death handler');
            await lightHitsGremlin(gremlin, rnd(5), finishMonsterKill);
        }
    }
    return true;
}
// C zap.c:lightdamage(). Return pseudo-damage before physical protection.
export async function lightDamage(source, ordinary, amount, { state = game } = {}) {
    if (!amount || heroSpecies(state) !== PM_GREMLIN)
        return amount;
    requireInitializedHero(state.u);
    let damage = rnd(amount);
    if (damage > 10)
        damage = 10 + rnd(damage - 10);
    damage = Math.min(damage, 20);
    await plineWithContinuation(`Ow, that light hurts${damage > 2 || state.u.mh <= 5 ? '!' : '.'}`);
    if (source.oclass === SCROLL_CLASS || source.oclass === SPBOOK_CLASS)
        ordinary = false;
    const artifact = artifactById(source.oartifact, state);
    const name = source.oclass === SPBOOK_CLASS ? 'spell of light'
        : artifact ? artifact.name : withIndefiniteArticle(minimalObjectName(source, state));
    const reason = `${ordinary ? 'zapped' : 'blasted'} ${state.flags.female ? 'herself' : 'himself'} with ${name}`;
    const physical = state.u.halfPhysicalDamage
        ? Math.trunc((damage + 1) / 2) : damage;
    await loseHeroHp(physical, reason, { state, deathCause: reason });
    return damage;
}
async function createConfusedLightPets(scroll) {
    const mnum = scroll.cursed ? PM_BLACK_LIGHT : PM_YELLOW_LIGHT;
    if ((game.mvitals?.[mnum]?.mvflags ?? 0) & G_GONE) {
        await plineWithContinuation('Tiny lights sparkle in the air momentarily.');
        return false;
    }
    const count = rn2(2) + 3 + (scroll.blessed ? 2 : 0);
    let sawLight = false;
    for (let index = 0; index < count; index++) {
        const monster = await makemonNear(mnum, game.u.ux, game.u.uy, NO_MINVENT | MM_EDOG | MM_NOMSG);
        if (!monster)
            continue;
        initializePet(monster);
        monster.msleeping = 0;
        monster.mcan = 1;
        if (canSpotMonster(monster))
            sawLight = true;
        await newsym(monster.mx, monster.my);
    }
    if (sawLight)
        await plineWithContinuation('Lights appear all around you!');
    return sawLight;
}
// C read.c:seffect_light(). The read owner handles Wisdom, discovery,
// source disposal, and the turn; this owner changes light and creatures.
export async function applyLightScrollEffect(scroll, { finishMonsterKill } = {}) {
    let known = false;
    if ((game.u.confusionTurns ?? 0) > 0) {
        known = await createConfusedLightPets(scroll);
    }
    else {
        known = !heroIsBlind();
        const lit = !scroll.cursed;
        await lightRoom(lit, {
            radius: scroll.blessed ? 9 : 5,
            source: scroll,
            finishMonsterKill: finishMonsterKill || finishHeroMonsterKillOutcome,
        });
        if (game.program_state.gameover)
            return { known, consumed: false, heroDied: true };
        if (lit && await lightDamage(scroll, true, 5))
            known = true;
    }
    return { known, consumed: false, heroDied: !!game.program_state.gameover };
}
// C light.c:new_light_source() prepends to light_base, so each lighting
// gives the object the newest slot in the list order that snuff searches.
export function registerObjectLightSource(object, state) {
    state._lightSerial = (state._lightSerial ?? 0) + 1;
    object._litSeq = state._lightSerial;
}
// apply.c:dorub() performs this type change before the released djinni can
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