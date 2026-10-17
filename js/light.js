// Object light and burn timers.
// C refs: timeout.c begin_burn()/burn_object()/end_burn(), light.c.
import { formatSeenMessage } from './hero_speech.js';
import { monsterHasMapPosition } from './monster_location.js';
import { loseHeroHp } from './hero_damage.js';
import { finishMonsterKilled } from './monster_death.js';
import { AD_BLND } from './monster_attack_types.js';
import { finishHeroMonsterKillOutcome } from './hero_monster_death.js';
import { heroSpecies } from './hero_species.js';
import { beginBallAndChainRedraw, finishBallAndChainMove } from './ball.js';
import { definiteObjectAction, minimalObjectName } from './objnam.js';
import { game, requireGameLevel } from './gstate.js';
import { requireInitializedHero } from './hero_types.js';
import { monsterName, possessiveName } from './monster_name.js';
import { artifactById, artifactEmitsLight } from './artifacts.js';
import { CORR, G_GONE, Is_rogue_level, Is_waterlevel, MM_EDOG, MM_NOMSG, NO_MINVENT, PLNMSG_OBJ_GLOWS, } from './const.js';
import { canSeeMonster, canSpotMonster, map_invisible, newsym, plineWithContinuation, displayColorName, } from './display.js';
import { initializePet } from './dog.js';
import { makemonNear, mksobj } from './mklev.js';
import { wakeMonstersNearWithMessages } from './monster_wake.js';
import { monsterDigests, monsterIsWhirly, } from './monster_data.js';
import { BRASS_LANTERN, CANDELABRUM_OF_INVOCATION, GOLD_DRAGON_SCALE_MAIL, GOLD_DRAGON_SCALES, MAGIC_LAMP, OIL_LAMP, POT_OIL, POT_WATER, TALLOW_CANDLE, WAX_CANDLE, } from './object_data.js';
import { OBJECT_TIMER_KIND, scheduleObjectTimer, stopObjectTimer, } from './object_timers.js';
import { roomForRoomno } from './room.js';
import { rn2, rnd } from './rng.js';
import { makePlural } from './object_grammar.js';
import { recordObjectKnowledge } from './object_knowledge.js';
import { cansee, clearAreaCells, vision_recalc } from './vision.js';
import { objectWeight } from './weight.js';
import { heroIsBlind, heroIsDeaf, heroIsHallucinating } from './senses.js';
import { carriedObjectOwner } from './shk.js';
import { objectName, objectNameIsPlural, ownedObjectName, observeObjectForNaming } from './objnam.js';
import { withIndefiniteArticle } from './object_grammar.js';
import { getObjectLocation } from './object_location.js';
import { useUpInventoryStack } from './hero_inventory.js';
import { deallocateObject, deleteObject } from './object_delete.js';
import { blessObjectState, curseObjectState, objectResistsDestruction, unblessObjectState, uncurseObjectState } from './object_state.js';
import { ownedObjectAction } from './objnam.js';
import { maybeUnhideAt } from './monster_hiding.js';
const CANDLE_TYPES = new Set([
    CANDELABRUM_OF_INVOCATION, TALLOW_CANDLE, WAX_CANDLE,
]);
const TIMED_LIGHT_TYPES = new Set([
    BRASS_LANTERN, OIL_LAMP, POT_OIL, ...CANDLE_TYPES,
]);
const LIGHT_TYPES = new Set([...TIMED_LIGHT_TYPES, MAGIC_LAMP]);
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
    if (!state.blind && !state.u.blindTurns)
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
function roomEffectCells(radius, lit) {
    if (!Is_rogue_level(game.u?.uz)) {
        // Sunsword illuminates the hero's spot directly; do_clear_area
        // rejects radius zero in both the native source and the port.
        if (radius === 0)
            return [{ x: game.u.ux, y: game.u.uy }];
        return clearAreaCells(game.u.ux, game.u.uy, radius);
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
function snuffLightsAt(x, y) {
    for (const object of game.level?.objects?.[x]?.[y] || [])
        snuffOrdinaryLight(object);
    const carrier = game.level?.monsters?.find(monster => monster.mx === x && monster.my === y);
    if (!carrier)
        return;
    const inventories = new Set([carrier.minvent, carrier.inventory]);
    for (const inventory of inventories) {
        for (const object of inventory || [])
            snuffOrdinaryLight(object);
    }
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
// C potion.c:impact_arti_light()/H2Opotion_dip(). The temporary water
// object is part of the native effect, including its construction draws.
async function impactArtifactLight(object, worsen) {
    if ((worsen ? object.cursed : object.blessed)
        || objectResistsDestruction(object, 25, 75))
        return;
    const water = await mksobj(POT_WATER, true, false);
    if (worsen)
        curseObjectState(water);
    else
        blessObjectState(water);
    const oldRadius = objectLightRadius(object);
    const removeBlessing = worsen && object.blessed;
    const removeCurse = !worsen && object.cursed;
    const blind = heroIsBlind();
    if (!blind) {
        const phrase = ownedObjectAction(object, 'glow');
        const color = displayColorName(removeBlessing ? 'brown' : removeCurse ? 'amber'
            : worsen ? 'black' : 'light blue');
        await plineWithContinuation(`${phrase}${removeBlessing || removeCurse ? ` ${color}` : ` with ${withIndefiniteArticle(color)} aura`}.`);
        object.bknown = !heroIsHallucinating();
    }
    else if (!water.bknown || !water.dknown)
        object.bknown = false;
    if (removeBlessing)
        unblessObjectState(object);
    else if (removeCurse)
        uncurseObjectState(object);
    else if (worsen)
        curseObjectState(object);
    else
        blessObjectState(object);
    const delta = objectLightRadius(object) - oldRadius;
    if (delta) {
        game.vision_full_recalc = 1;
        if (!blind)
            await plineWithContinuation(`${object.quan === 1 ? 'It shines' : 'They shine'} `
                + `${Math.abs(delta) > 1 ? 'much ' : ''}${delta > 0 ? 'brighter' : 'less brightly'}.`);
    }
    deallocateObject(water);
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
        map_invisible(monster.mx, monster.my);
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
    for (const { x, y } of roomEffectCells(radius, lit)) {
        const location = game.level?.at?.(x, y);
        if (!location)
            continue;
        location.lit = !!lit;
        if (!lit) {
            snuffLightsAt(x, y);
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
        vision_recalc(2);
        await finishBallAndChainMove(ballAndChain);
    }
    game.vision_full_recalc = 1;
    if (lit && gremlins.length) {
        vision_recalc(0);
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
        newsym(monster.mx, monster.my);
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
function lampBurnTurns(age) {
    if (age > 150)
        return age - 150;
    if (age > 100)
        return age - 100;
    if (age > 50)
        return age - 50;
    if (age > 25)
        return age - 25;
    return age;
}
function candleBurnTurns(age) {
    if (age > 75)
        return age - 75;
    if (age > 15)
        return age - 15;
    return age;
}
function objectBurnTurns(object) {
    if (object.otyp === POT_OIL) {
        const age = object.age ?? 0;
        return object.odiluted ? Math.trunc((3 * age + 2) / 4) : age;
    }
    if (CANDLE_TYPES.has(object.otyp))
        return candleBurnTurns(object.age ?? 0);
    return lampBurnTurns(object.age ?? 0);
}
// begin_burn() stores only the fuel remaining after the next warning
// breakpoint; the timer owns the intervening turns.  Keeping both fields is
// what lets save/restore and an overdue callback reconstruct source state.
export function beginObjectBurn(object, state = game, currentTurn = state.moves ?? 0) {
    if (!object
        || (!LIGHT_TYPES.has(object.otyp) && !artifactEmitsLight(object))) {
        return false;
    }
    const alreadyLit = !!object.lamplit;
    if (artifactEmitsLight(object)) {
        object.lamplit = true;
        if (!alreadyLit)
            state.vision_full_recalc = 1;
        return true;
    }
    if (object.otyp === MAGIC_LAMP) {
        if ((object.spe ?? 0) <= 0)
            return false;
        object.lamplit = true;
        if (!alreadyLit)
            state.vision_full_recalc = 1;
        return true;
    }
    if (object.otyp === CANDELABRUM_OF_INVOCATION
        && (object.spe ?? 0) <= 0)
        return false;
    if ((object.age ?? 0) <= 0)
        return false;
    const turns = objectBurnTurns(object);
    const timer = scheduleObjectTimer(object, OBJECT_TIMER_KIND.BURN_OBJECT, currentTurn + turns, state);
    object.lamplit = !!timer;
    if (!timer)
        return false;
    object.age -= turns;
    if (!alreadyLit)
        state.vision_full_recalc = 1;
    return true;
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
// timeout.c:end_burn(..., TRUE) reaches cleanup_burn() through stop_timer().
// The object's stored age excludes the turns owned by its active timer, so a
// manual switch-off must restore the still-unspent portion before darkening
// the source.  Natural expiry has already claimed its timer and deliberately
// uses extinguishTimedLight() below instead.
export function endObjectBurn(object, state = game, currentTurn = state.moves ?? 0) {
    if (!object?.lamplit)
        return false;
    if (object.otyp === MAGIC_LAMP || artifactEmitsLight(object)
        || object.otyp === GOLD_DRAGON_SCALE_MAIL || object.otyp === GOLD_DRAGON_SCALES) {
        object.lamplit = false;
        state.vision_full_recalc = 1;
        return true;
    }
    const timer = stopObjectTimer(object, OBJECT_TIMER_KIND.BURN_OBJECT);
    if (!timer || !Number.isFinite(timer.deadline))
        return false;
    return cleanupObjectBurn(object, timer.deadline, state, currentTurn);
}
// C cleanup_burn(), also called when Lua stops a burning object's timer.
export function cleanupObjectBurn(object, deadline, state = game, currentTurn = state.moves ?? 0) {
    if (!object.lamplit)
        return false;
    object.age = (object.age ?? 0) + deadline - currentTurn;
    object.lamplit = false;
    state.vision_full_recalc = 1;
    return true;
}
function extinguishTimedLight(object, state) {
    object.lamplit = false;
    stopObjectTimer(object, OBJECT_TIMER_KIND.BURN_OBJECT);
    state.vision_full_recalc = 1;
}
function burnOwner(object, state) {
    if (object.where === 'inventory') {
        const owner = carriedObjectOwner(object, state);
        return owner.charAt(0).toUpperCase() + owner.slice(1);
    }
    const carrier = object.ocarry || requireGameLevel(state).monsters.find(monster => (monster.minvent || monster.inventory || []).includes(object));
    return carrier ? possessiveName(monsterName(carrier, { capitalized: true, state })) : 'The';
}
function burnName(object, state) {
    const count = object.quan ?? object.quantity ?? 1;
    const name = objectName(object, state);
    return `${burnOwner(object, state)} ${count > 1 ? makePlural(name) : name}`;
}
async function finishBurnedObject(object, state, { overdue = false } = {}) {
    extinguishTimedLight(object, state);
    if (object.otyp === CANDELABRUM_OF_INVOCATION) {
        object.spe = 0;
        object.owt = objectWeight(object);
        return false;
    }
    if (object.otyp !== POT_OIL && object.otyp !== TALLOW_CANDLE && object.otyp !== WAX_CANDLE)
        return false;
    const floor = object.where === 'floor' && { x: object.ox, y: object.oy };
    if (!overdue && object.where === 'inventory')
        await useUpInventoryStack(object, state);
    else {
        if (object.where === 'migrating')
            object.owornmask = 0;
        await deleteObject(object, state);
    }
    if (floor && (overdue || object.otyp !== POT_OIL))
        maybeUnhideAt(floor.x, floor.y, state);
    return true;
}
async function announceLampBurn(object, threshold, visible, byTouch, state, owner) {
    const floor = object.where === 'floor';
    const lantern = object.otyp === BRASS_LANTERN;
    if (threshold === 0) {
        if (visible || byTouch)
            await plineWithContinuation(lantern
                ? floor ? formatSeenMessage('a lantern run out of power.', state) : `${owner} lantern has run out of power.`
                : floor ? formatSeenMessage(`${withIndefiniteArticle(objectName(object, state))} go out.`, state) : `${burnName(object, state)} has gone out.`);
        return;
    }
    if (!visible || ![150, 100, 50, 25].includes(threshold))
        return;
    if (lantern) {
        await plineWithContinuation(floor ? formatSeenMessage('a lantern getting dim.', state)
            : object.where === 'inventory' ? 'Your lantern is getting dim.'
                : `${burnOwner(object, state)} lantern is getting dim.`);
        if (object.where === 'inventory' && heroIsHallucinating(state))
            await plineWithContinuation('Batteries have not been invented yet.');
    }
    else if (threshold === 25)
        await plineWithContinuation(floor
            ? formatSeenMessage(`${withIndefiniteArticle(objectName(object, state))} about to go out.`, state)
            : `${burnName(object, state)} seems about to go out.`);
    else
        await plineWithContinuation(floor
            ? formatSeenMessage(`${withIndefiniteArticle(objectName(object, state))} flicker${threshold === 50 ? ' considerably' : ''}.`, state)
            : `${burnName(object, state)} flickers${threshold === 50 ? ' considerably' : ''}.`);
}
async function announceCandleBurn(object, threshold, visible, byTouch, state, ownership) {
    const menorah = object.otyp === CANDELABRUM_OF_INVOCATION;
    const many = menorah ? object.spe > 1 : (object.quan ?? object.quantity ?? 1) > 1;
    const floor = object.where === 'floor';
    const candle = `${menorah ? "candelabrum's " : ''}candle`;
    const owner = floor ? formatSeenMessage(`${menorah ? 'a ' : many ? 'some ' : 'a '}`, state) : `${ownership} `;
    if (threshold === 75 && visible) {
        await plineWithContinuation(`${owner}${candle}${many ? 's' : ''}${floor ? '' : many ? ' are' : ' is'} getting short.`);
    }
    else if (threshold === 15 && visible) {
        await plineWithContinuation(`${owner}${candle}${many ? "s'" : "'s"} flame${many ? 's' : ''} flicker${floor || many ? '' : 's'} low!`);
    }
    else if (threshold === 0 && (visible || byTouch)) {
        if (menorah)
            await plineWithContinuation(floor
                ? formatSeenMessage(`a candelabrum's flame${many ? 's' : ''} die.`, state)
                : `${ownership} candelabrum's flame${many ? 's die' : ' dies'}.`);
        else {
            const name = objectName(object, state);
            await plineWithContinuation(floor
                ? formatSeenMessage(`${many ? `some ${makePlural(name)}` : withIndefiniteArticle(name)} consumed!`, state)
                : `${burnName(object, state)} ${many ? 'are' : 'is'} consumed!`);
            if (heroIsHallucinating(state))
                await plineWithContinuation(many ? 'They shriek!' : 'It shrieks!');
            else if (!heroIsBlind(state))
                await plineWithContinuation(many ? 'Their flames die.' : 'Its flame dies.');
        }
    }
}
// C timeout.c:burn_object(). The claimed timer is already removed. Messages
// may pause before expiry removes equipment or bills; a late level timer
// catches up silently without replaying warnings from the absent hero.
export async function runClaimedObjectBurnTimer(claimed, state = game, currentTurn = state.moves ?? 0) {
    const object = claimed?.object;
    const timeout = claimed?.timer?.deadline;
    if (!object || !TIMED_LIGHT_TYPES.has(object.otyp) || !object.lamplit
        || typeof timeout !== 'number' || !Number.isFinite(timeout))
        return null;
    if (timeout !== currentTurn) {
        const elapsed = currentTurn - timeout;
        if (elapsed >= (object.age ?? 0)) {
            object.age = 0;
            const destroyed = await finishBurnedObject(object, state, { overdue: true });
            return { object, threshold: 0, overdue: true, destroyed };
        }
        object.age -= elapsed;
        beginObjectBurn(object, state, currentTurn);
        return { object, threshold: object.age, overdue: true };
    }
    const threshold = object.age ?? 0;
    const location = getObjectLocation(object, state);
    const visible = !heroIsBlind(state) && !!location && cansee(location.x, location.y);
    const owner = location ? burnOwner(object, state) : '';
    const byTouch = object.where === 'inventory' && object.otyp !== BRASS_LANTERN;
    if (object.otyp === POT_OIL) {
        if (visible)
            await plineWithContinuation(object.where === 'floor'
                ? formatSeenMessage('a burning potion of oil go out.', state) : `${owner} potion of oil has burnt away.`);
    }
    else if (CANDLE_TYPES.has(object.otyp))
        await announceCandleBurn(object, threshold, visible, byTouch, state, owner);
    else
        await announceLampBurn(object, threshold, visible, byTouch, state, owner);
    const destroyed = threshold === 0 || object.otyp === POT_OIL
        ? await finishBurnedObject(object, state) : false;
    if (!destroyed && threshold > 0)
        beginObjectBurn(object, state, currentTurn);
    if (visible && location && threshold === 0
        && (object.otyp === POT_OIL || object.otyp === TALLOW_CANDLE || object.otyp === WAX_CANDLE))
        newsym(location.x, location.y);
    return { object, threshold, overdue: false, destroyed };
}
function catchesFire(object, random) {
    if (!object || object.lamplit || object.in_use
        || !LIGHT_TYPES.has(object.otyp)
        || object.otyp === BRASS_LANTERN)
        return false;
    if ((object.otyp === MAGIC_LAMP
        || object.otyp === CANDELABRUM_OF_INVOCATION)
        && (object.spe ?? 0) <= 0)
        return false;
    if (TIMED_LIGHT_TYPES.has(object.otyp) && (object.age ?? 0) <= 0)
        return false;
    if (object.otyp === CANDELABRUM_OF_INVOCATION && object.cursed)
        return false;
    return !([OIL_LAMP, MAGIC_LAMP].includes(object.otyp)
        && object.cursed && random(2) === 0);
}
function lightSourceName(object, state) {
    observeObjectForNaming(object, { state });
    const name = objectName(object, state);
    const quantity = object.quan ?? object.quantity ?? 1;
    return quantity > 1 ? makePlural(name) : name;
}
export async function igniteItems(objects, { carrier = null, state = game, publish = async () => { }, random = rn2, visible = true, } = {}) {
    const ignited = [];
    for (const object of objects || []) {
        // catch_lit() requires a current location, even during floor effects.
        if (!getObjectLocation(object, state))
            continue;
        if (!catchesFire(object, random))
            continue;
        const plural = (object.quan ?? object.quantity ?? 1) > 1;
        const blind = heroIsBlind(state);
        if (visible) {
            const name = lightSourceName(object, state);
            const prefix = object.where === 'floor' ? 'The'
                : carrier ? possessiveName(monsterName(carrier, { state, capitalized: true })) : 'Your';
            await publish(blind
                ? `${prefix} ${name} ${plural ? 'feel' : 'feels'} warm.`
                : `${prefix} ${name} ${plural ? 'catch' : 'catches'} light!`);
        }
        if (object.otyp === POT_OIL
            && !state._knownObjectTypes?.has(POT_OIL)) {
            recordObjectKnowledge(POT_OIL, state);
        }
        if (beginObjectBurn(object, state, state.moves ?? 0))
            ignited.push(object);
    }
    return ignited;
}
//# sourceMappingURL=light.js.map