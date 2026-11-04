// do.js — the do.c owner: drop commands and floor landings, sink rings,
// level-arrival strays, wait/wipe, and wounded legs.
// C refs: do.c dodrop(), boulder_hits_pool(), trycall(), polymorph_sink(),
//         teleport_sink(), dosinkring(), drop(), dropx(), dropz(),
//         engulfer_digests_food(), obj_no_longer_held(), doddrop(),
//         menu_drop(), u_stuck_cannot_go(), final_level(), u_collide_m(),
//         danger_uprops(), cmd_safety_prevention(), donull(), dowipe(),
//         wipeoff(), set_wounded_legs(), heal_legs().
import { ILLOBJ_CLASS, RING_CLASS, COIN_CLASS, VENOM_CLASS } from './objclass.js';
import { setHeroBlindnessTimeout, heroIsBlind, heroIsDeaf, heroIsHallucinating } from './senses.js';
import { game, requireLiveGame, requireGameLevel, requirePlayingGame } from './gstate.js';
import { pline, plineWithContinuation } from './pline.js';
import { MONSTER_ATTACKS, MONSTER_NAME } from './monster_data.js';
import { monsterHasMapPosition, monsterAtPosition } from './steed.js';
import { AD_POLY } from './monster_attack_types.js';
import { A_DEX, DB_FLOOR, DB_UNDER, DRAWBRIDGE_UP, ECMD_FAIL, ECMD_OK, ECMD_TIME, GETOBJ_SUGGEST, HOLE, IS_ALTAR, IS_SINK, LOST_DROPPED, MENU_COMBINATION, MENU_FULL, MENU_TRADITIONAL, PARANOID_AUTOALL, RLOC_NOMSG, ROOM, SORTLOOT_INVLET, TRAPDOOR, WATER, ALTAR, AM_NONE, COLNO, Align2amask, FOUNTAIN, Is_waterlevel, ROWNO, SINK, THRONE, W_ARMOR, W_ACCESSORY, W_SADDLE, } from './const.js';
import { paranoidQuery, commandResultCancelled, commandResultFailed, resetOccupations } from './cmd.js';
import { makeBlinded } from './potion.js';
import { gulpBlindnessCheck } from './engulf_blindness.js';
import { heroFaceName, heroHandName, heroLegName, monsterStomachName } from './body_parts.js';
import { BOULDER, CORPSE, CRYSKNIFE, EGG, ENORMOUS_MEATBALL, GLOB_OF_GREEN_SLIME, LEASH, LOADSTONE, MEATBALL, MEAT_RING, MEAT_STICK, OBJECT_NAMES, TIN, WORM_TOOTH } from './object_data.js';
import { makePlural, withIndefiniteArticle, ownedObjectName, verbForSubject, objectCombatName, objectDescription, objectQuestion, observeObjectForNaming, simpleObjectNameWithArticle, objectMonsterName, ownedObjectAction, definiteObjectAction } from './objnam.js';
import { billForObject, chargeAlteredUnpaidObject, objectTypeKnown, deleteObject, objectIsUnpaid, stolenValue, sellHeroDroppedObject, SELL_DELIBERATE, SELL_NORMAL, setSellDisposition } from './shk.js';
import { d, rn1, rn2, rnd } from './rng.js';
import { callObjectType, displayColorName, displayLiquidName, monsterName, randomDisplayMonsterName } from './do_name.js';
import { threateningMonsterNearby, loseHeroHp, impactDisturbsZombies, switchHeroTerrain, burnAwayHeroSlime } from './hack.js';
import { applyFloorEffects } from './floor_effects.js';
import { buryFloorObjectsAt, addBuriedObject } from './dig.js';
import { canSpotMonster, newsym, docrt, consumeHallucinatedMenuObjectGlyph, OBJECT_CLASS_SYMBOLS, map_object } from './display.js';
import { cansee, vision_note_blocker_change } from './vision.js';
import { finishEnvironmentalMonsterDeath, wakeMonstersNearWithMessages, monsterInAir, changeMonsterForm, healMonster, sendMonsterToLimbo, moveMonsterNextToHero, setHeroGrip, } from './mon.js';
import { formatHeardMessage } from './hero_speech.js';
import { heroSpecies, heroFormSticks } from './polyself.js';
import { hitMonsterWithSettlingBoulder } from './hero_ranged_attack.js';
import { rollPhysicalWeaponDamage } from './weapon.js';
import { useUpFloorObject } from './floor_consumption.js';
import { deleteFloorTrap, resetUtrap, petrifyMonsterImmediately } from './trap.js';
import { heroHasArtifactDefense, heroHasCarriedArtifactFlag } from './artifacts.js';
import { impossible } from './diagnostics.js';
import { waterbodyName } from './terrain_name.js';
import { isLavaAt, isPoolAt } from './dbridge.js';
import { chooseObjectCategories } from './pickup.js';
import { selectInventoryObject, inventoryClassOrder, lootSortMode, objectClassHeading, inventoryItemDescription, consumeInventoryItem, delobj, sortObjects, chooseInventoryObject, finishInventoryRemoval, floorObjectDescription, freeInventoryObject, } from './invent.js';
import { bypassObjectList, clearBypasses, nextUnbypassedObject } from './worn.js';
import { objectQuantity, rejoinObjectStack, splitObjectStack, placeObject, stack_object } from './mkobj.js';
import { getLine, tty_yn_function } from './query.js';
import { isWeldedPrimary, setPrimaryWeapon, setQuiverObject, setSecondaryWeapon } from './wield.js';
import { showMultiSelectWindow } from './windows.js';
import { isBimanualObject } from './object_properties.js';
import { touchPetrifies, heroResistsStoning } from './stoning.js';
import { holdingMonsterName } from './hero_expulsion.js';
import { possessiveName } from './hacklib.js';
import { heroCanReachFloor, engravingAt, make_grave } from './engrave.js';
import { beginLevitatingArtifactDrop, finishLevitatingArtifactDrop } from './levitation_drop.js';
import { hitFloorWithObject } from './dothrow.js';
import { shipObject, containerImpactDamage } from './dokick.js';
import { landObjectOnAltar } from './altar_object.js';
import { addObjectToMonsterInventory } from './steal.js';
import { finishHeroMonsterKill } from './hero_monster_death.js';
import { growMonster, setMonsterMalign } from './makemon.js';
import { encumber_msg } from './pickup.js';
import { propertyIsActive } from './properties.js';
import { dropBall } from './ball.js';
import { requireHeroAttributes } from './hero_types.js';
import { objectResistsDestruction } from './zap.js';
import { countLevelFeatures } from './mklev.js';
import { monsterAlignmentType } from './priest.js';
import { createPlayerMonsters } from './mplayer.js';
import { gainGuardianAngel } from './guardian_angel.js';
import { randomMonsterRelocation, enexto } from './teleport.js';
import { placeHeroOnLevel } from './hero_location.js';
import { is_shapeshifter, monsterDigests, monsterIsNonliving, monsterIsVampireShifter, monsterPassesWalls, monsterThrowsRocks } from './mondata.js';
export async function dodrop() {
    const inShop = !!game.u?.ushops?.[0];
    if (inShop)
        setSellDisposition(SELL_DELIBERATE);
    try {
        // C do.c:dodrop(): getobj("drop", any_obj_ok, PROMPT | ALLOWCNT).
        // A cursed loadstone keeps the requested count for canletgo().
        const object = await chooseInventoryObject('drop', () => GETOBJ_SUGGEST, { forcePrompt: true, allowCount: true });
        if (!object) {
            commandResultCancelled(); // do.c:dodrop() getobj ECMD_CANCEL.
            // dodrop() resets occupations for every nonzero result,
            // cancelled prompts included.
            resetOccupations();
            return;
        }
        const spentTime = await dropHeroObject(object, {
            state: game, publish: plineWithContinuation,
        });
        if (!spentTime) {
            // do.c:drop() returns ECMD_FAIL for every refusal.
            commandResultFailed();
            resetOccupations();
            return;
        }
        game.context.move = 1;
        resetOccupations();
        if (game._occupation?.key === 'pick-lock')
            game._occupation = null;
    }
    finally {
        if (inShop)
            setSellDisposition(SELL_NORMAL);
    }
}
export async function dropBoulderIntoLiquid(boulder, x, y, state = game, { publish = plineWithContinuation, random = rn2, pushing = false, } = {}) {
    requireLiveGame(state);
    if (!boulder || boulder.otyp !== BOULDER) {
        await impossible('Not a boulder?', { state });
        return false;
    }
    if (boulder.where !== (pushing ? 'floor' : 'free'))
        throw new Error('Boulder liquid effects require a floor object when pushing, otherwise a free object');
    if (!isPoolAt(x, y, state) && !isLavaAt(x, y, state))
        return false;
    const lava = isLavaAt(x, y, state);
    const liquid = waterbodyName(x, y, state);
    const level = requireGameLevel(state);
    const location = level.at(x, y);
    if (!location)
        throw new RangeError(`Boulder landing square ${x},${y} is outside the map`);
    const type = location.typ;
    const chance = random(10);
    const fills = !Is_waterlevel(state.u.uz)
        && (type === WATER ? chance < 5 : lava ? chance === 0 : chance !== 0);
    if (fills) {
        const trap = level.traps.find(candidate => candidate.tx === x && candidate.ty === y);
        if (type === DRAWBRIDGE_UP) {
            location.drawbridgemask = ((location.drawbridgemask ?? 0) & ~DB_UNDER) | DB_FLOOR;
        }
        else {
            location.typ = ROOM;
            location.flags = 0;
            location.icedpool = 0;
            vision_note_blocker_change(x, y);
        }
        const monster = monsterAtPosition(level, x, y);
        if (monster && monster.mhp > 0 && !monsterInAir(monster, state)) {
            await finishEnvironmentalMonsterDeath(monster, state, { publish, random });
            if (state.program_state.gameover)
                return true;
        }
        if (trap) {
            await deleteFloorTrap(trap, state);
            if (state.program_state.gameover)
                return true;
        }
        await buryFloorObjectsAt(x, y, state, { publish });
        await newsym(x, y);
        if (pushing) {
            const who = state.u.usteed
                ? monsterName(state.u.usteed, { state, article: 'your', capitalized: true }) : 'You';
            await publish(`${who} ${verbForSubject(who, 'push')} the ${objectCombatName(boulder, { state })} into the ${liquid}.`);
            if (state.flags.verbose !== false && !heroIsBlind(state))
                await publish('Now you can cross it!');
        }
    }
    if (!fills || !pushing) {
        if (!state.u.uinwater) {
            if (pushing ? !heroIsBlind(state) : cansee(x, y)) {
                await publish(`There is a large splash as the ${objectCombatName(boulder, { state })} ${fills ? 'fills' : 'falls into'} the ${liquid}.`);
            }
            else if (!heroIsDeaf(state)) {
                const message = formatHeardMessage(`a${lava ? ' sizzling' : ''} splash.`, state);
                if (message)
                    await publish(message);
            }
            await wakeMonstersNearWithMessages(x, y, 40, state, publish);
            if (state.program_state.gameover)
                return true;
        }
        if (fills && state.u.uinwater && state.u.ux === x && state.u.uy === y) {
            state.u.uinwater = 0;
            state.underwater = false;
            await switchHeroTerrain(state);
            if (state.program_state.gameover)
                return true;
            await docrt();
            state.vision_full_recalc = 1;
            await publish('You find yourself on dry land again!');
        }
        else if (lava && Math.abs(state.u.ux - x) <= 1 && Math.abs(state.u.uy - y) <= 1) {
            const fireResistant = state.u.fireResistance
                || heroHasArtifactDefense('fire', state);
            await publish(`You are hit by molten ${displayLiquidName('lava', state)}${fireResistant ? '.' : '!'}`);
            await burnAwayHeroSlime(state, publish);
            let damage = d(fireResistant ? 1 : 3, 6);
            if (state.u.halfPhysicalDamage
                || heroHasCarriedArtifactFlag('SPFX_HPHDAM', state))
                damage = Math.trunc((damage + 1) / 2);
            await loseHeroHp(damage, 'molten lava', { state, publish });
            if (state.program_state.gameover)
                return true;
        }
        else if (!fills && state.flags.verbose !== false
            && (pushing ? !heroIsBlind(state) : cansee(x, y))) {
            await publish('It sinks without a trace!');
        }
    }
    if (pushing)
        await useUpFloorObject(boulder, boulder.quan, { state, publish });
    else
        await deleteObject(boulder, state);
    return true;
}
// C do.c:trycall(). If obj is neither formally identified nor informally
// called, prompt for a call name before the object's identity is lost.
export async function tryCallObjectType(object, state = game) {
    if (!object ||
        object.dknown === false ||
        objectTypeKnown(object, state) ||
        state._objectCallNames?.[object.otyp]) {
        return { prompted: false, named: false, callName: null };
    }
    return callObjectType(object, state);
}
const FRUIT_DEFAULT = 'slime mold';
// C turn_undead/other precedent: Gehennom by dungeon name.
function inGehennom(state) {
    const dnum = state.u?.uz?.dnum ?? -1;
    return state.dungeons?.[dnum]?.dname === 'Gehennom';
}
function fruitNamePlural(state) {
    return makePlural(state.fruitName || FRUIT_DEFAULT);
}
// C do.c:403-455 polymorph_sink(), shared shape with the fountain owner.
export async function polymorphSink(state, publish) {
    const { ux, uy } = state.u;
    const level = requireGameLevel(state);
    const location = level.requireAt(ux, uy);
    if (location.typ !== SINK)
        return;
    // C zeroes the rm flags union, which shares storage with looted,
    // blessedftn, and the altar mask: every per-square state clears, then
    // the chosen outcome re-arms its own.
    const sinkLooted = !!location.looted;
    location.looted = 0;
    location.blessedftn = 0;
    location.flags = 0;
    let symbolName;
    switch (rn2(4)) {
        default:
        case 0:
            symbolName = 'fountain';
            location.typ = FOUNTAIN;
            location.blessedftn = 0;
            if (sinkLooted)
                location.looted = 1;
            break;
        case 1:
            symbolName = 'opulent throne';
            location.typ = THRONE;
            if (sinkLooted)
                location.looted = 1;
            break;
        case 2: {
            symbolName = 'altar';
            location.typ = ALTAR;
            const alignment = rn2(3) - 1; /* -1 Cha, 0 Neu, +1 Law */
            location.flags = (inGehennom(state) && rn2(3))
                ? AM_NONE
                : Align2amask(alignment);
            break;
        }
        case 3:
            symbolName = 'grave';
            location.typ = ROOM;
            make_grave(ux, uy, null);
            break;
    }
    // Each set_levltyp() away from SINK recounts fountains and sinks.
    countLevelFeatures(state);
    // give message even if blind; we know we're not levitating, so we can
    // feel the outcome even if we can't directly see it
    if (location.typ !== ROOM)
        await publish(`The sink transforms into ${withIndefiniteArticle(symbolName)}!`);
    else
        await publish('The sink vanishes.');
    await newsym(ux, uy);
}
// C do.c:459-494 teleport_sink(): move the sink to a far, unseen, plain
// room square.  Returns whether the sink moved.
async function teleportSink(state) {
    const { ux, uy } = state.u;
    const level = requireGameLevel(state);
    const sink = level.requireAt(ux, uy);
    for (let tries = 0; tries < 200; tries++) {
        const cx = 1 + rnd((COLNO - 1) - 2); /* 2..COLNO-2 */
        const cy = 1 + rn2(ROWNO - 2); /* 1..ROWNO-2 */
        const location = level.requireAt(cx, cy);
        if (location.typ !== ROOM
            || level.traps.some(trap => trap.tx === cx && trap.ty === cy)
            || engravingAt(cx, cy, level))
            continue;
        const dx = cx - ux;
        const dy = cy - uy;
        if (cansee(cx, cy) && dx * dx + dy * dy <= 3 * 3)
            continue;
        const alreadyLooted = !!sink.looted;
        sink.typ = ROOM;
        sink.looted = 0;
        await newsym(ux, uy);
        location.typ = SINK;
        location.looted = alreadyLooted ? 1 : 0;
        // C's two set_levltyp() calls recount fountains and sinks.
        countLevelFeatures(state);
        await newsym(cx, cy);
        return true;
    }
    return false;
}
export async function dropRingIntoSink(object, { state = game, publish = plineWithContinuation } = {}) {
    // Full world mutation: terrain, floor inventory, burial, shop bills.
    requireLiveGame(state);
    const level = requireGameLevel(state);
    const { ux, uy } = state.u;
    observeObjectForNaming(object, { state });
    await publish(`You drop ${await inventoryItemDescription(object)} down the drain.`);
    object.in_use = true; /* block free identification via interrupt */
    let ideed = true;
    let nosink = false;
    switch (object.otyp) { /* effects that can be noticed without eyes */
        case 180: /* RIN_SEARCHING */
            await publish(`You thought ${ownedObjectName(object, state, { capitalized: false })} got`
                + ' lost in the sink, but there it is!');
            object.in_use = false;
            await dropInventoryObjectAtHero(object, { state, publish });
            await tryCallObjectType(object, state);
            return;
        case 193: /* RIN_SLOW_DIGESTION */
            await publish('The ring is regurgitated!');
            object.in_use = false;
            await dropInventoryObjectAtHero(object, { state, publish });
            await tryCallObjectType(object, state);
            return;
        case 183: /* RIN_LEVITATION */
            await publish('The sink quivers upward for a moment.');
            break;
        case 188: /* RIN_POISON_RESISTANCE */
            await publish(`You smell rotten ${fruitNamePlural(state)}.`);
            break;
        case 185: { /* RIN_AGGRAVATE_MONSTER */
            const swarm = heroIsHallucinating(state)
                ? makePlural(randomDisplayMonsterName()) : 'flies';
            await publish(`Several ${swarm} buzz angrily around the sink.`);
            break;
        }
        case 191: /* RIN_SHOCK_RESISTANCE */
            await publish('Static electricity surrounds the sink.');
            break;
        case 186: /* RIN_CONFLICT */ {
            const heard = formatHeardMessage('loud noises coming from the drain.', state);
            if (heard !== null)
                await publish(heard);
            break;
        }
        case 182: /* RIN_SUSTAIN_ABILITY */
            await publish(`The ${displayLiquidName('water', state)} flow seems fixed.`);
            break;
        case 174: /* RIN_GAIN_STRENGTH */
            await publish(`The ${displayLiquidName('water', state)} flow seems ${object.spe < 0 ? 'weak' : 'strong'}er now.`);
            break;
        case 175: /* RIN_GAIN_CONSTITUTION */
            await publish(`The ${displayLiquidName('water', state)} flow seems ${object.spe < 0 ? 'less' : 'great'}er now.`);
            break;
        case 176: /* RIN_INCREASE_ACCURACY */
            await publish(`The ${displayLiquidName('water', state)} flow ${object.spe < 0 ? 'misses' : 'hits'} the drain.`);
            break;
        case 177: /* RIN_INCREASE_DAMAGE */
            await publish(`The water's force seems ${object.spe < 0 ? 'small' : 'great'}er now.`);
            break;
        case 184: /* RIN_HUNGER */
            ideed = false;
            for (const pileObject of [...(level.objects[ux]?.[uy] || [])]) {
                if (pileObject === state.uball || pileObject === state.uchain)
                    continue;
                if (objectResistsDestruction(pileObject, 1, 99))
                    continue;
                if (!heroIsBlind(state)) {
                    observeObjectForNaming(pileObject, { state });
                    const quantity = pileObject.quan ?? pileObject.quantity ?? 1;
                    await publish(`Suddenly, ${await floorObjectDescription(pileObject)} `
                        + `${quantity === 1 ? 'vanishes' : 'vanish'}`
                        + ' from the sink!');
                    ideed = true;
                }
                // C delobj: resistance gate, floor unlink with unhide/redraw,
                // and bill-preserving obfree.
                await delobj(pileObject, state);
            }
            break;
        case 270: /* MEAT_RING */
            await publish('Several flies buzz around the sink.');
            break;
        case 194: { /* RIN_TELEPORTATION */
            nosink = await teleportSink(state);
            await publish(`The sink ${nosink ? '' : 'momentarily '}vanishes.`);
            ideed = false;
            break;
        }
        case 196: { /* RIN_POLYMORPH */
            await polymorphSink(state, publish);
            nosink = true;
            ideed = level.requireAt(ux, uy).typ !== ROOM;
            break;
        }
        default:
            ideed = false;
            break;
    }
    if (!heroIsBlind(state) && !ideed) {
        ideed = true;
        switch (object.otyp) { /* effects that need eyes */
            case 173: /* RIN_ADORNMENT */
                await publish('The faucets flash brightly for a moment.');
                break;
            case 179: /* RIN_REGENERATION */
                await publish('The sink looks as good as new.');
                break;
            case 198: /* RIN_INVISIBILITY */
                await publish("You don't see anything happen to the sink.");
                break;
            case 192: /* RIN_FREE_ACTION */
                await publish('You see the ring slide right down the drain!');
                break;
            case 199: /* RIN_SEE_INVISIBLE */
                await publish(`You see some ${heroIsHallucinating(state) ? 'oxygen molecules' : 'air'} in the sink.`);
                break;
            case 181: /* RIN_STEALTH */
                await publish('The sink seems to blend into the floor'
                    + ' for a moment.');
                break;
            case 189: /* RIN_FIRE_RESISTANCE */
                await publish(`The hot ${displayLiquidName('water', state)} faucet flashes`
                    + ' brightly for a moment.');
                break;
            case 190: /* RIN_COLD_RESISTANCE */
                await publish(`The cold ${displayLiquidName('water', state)} faucet flashes`
                    + ' brightly for a moment.');
                break;
            case 200: /* RIN_PROTECTION_FROM_SHAPE_CHANGERS */
                await publish('The sink looks nothing like a fountain.');
                break;
            case 178: /* RIN_PROTECTION */
                await publish(`The sink glows ${displayColorName(object.spe < 0 ? 'black' : 'silver', state)} for a moment.`);
                break;
            case 187: /* RIN_WARNING */
                await publish(`The sink glows ${displayColorName('white', state)} for a moment.`);
                break;
            case 195: /* RIN_TELEPORT_CONTROL */
                await publish('The sink looks like it is being beamed'
                    + ' aboard somewhere.');
                break;
            case 197: /* RIN_POLYMORPH_CONTROL */
                await publish('The sink momentarily looks like a regularly'
                    + ' erupting geyser.');
                break;
            default:
                break;
        }
    }
    if (ideed) {
        await tryCallObjectType(object, state);
    }
    else if (!nosink) {
        const heard = formatHeardMessage('the ring bouncing down the drainpipe.', state);
        if (heard !== null)
            await publish(heard);
    }
    if (rn2(20) === 0 && !nosink) {
        observeObjectForNaming(object, { state });
        await publish(`The sink backs up, leaving ${await inventoryItemDescription(object)}.`);
        object.in_use = false;
        await dropInventoryObjectAtHero(object, { state, publish });
    }
    else if (rn2(5) === 0) {
        // C: freeinv (unlink from invent plus its hooks) then link into
        // the buried list (plain add_to_buried, not the floor-bury
        // mechanic).
        const index = state.inventory?.indexOf(object) ?? -1;
        if (index >= 0)
            state.inventory.splice(index, 1);
        await finishInventoryRemoval(object, state);
        object.in_use = false;
        addBuriedObject(object, ux, uy, state);
    }
    else {
        await consumeInventoryItem(object, state);
    }
}
// C do.c:canletgo(). A silent check still discovers curses.
export async function canLetGo(object, verb = '', state = game) {
    if ((object.owornmask ?? 0) & (W_ARMOR | W_ACCESSORY)) {
        if (verb)
            await plineWithContinuation(`You cannot ${verb} something you are wearing.`, { noRepeat: true });
        return false;
    }
    if (isWeldedPrimary(object, state)) {
        object.bknown = true;
        if (verb) {
            let hand = heroHandName(state);
            if (isBimanualObject(object))
                hand = makePlural(hand);
            await plineWithContinuation(`You cannot ${verb} something welded to your ${hand}.`, { noRepeat: true });
        }
        return false;
    }
    if (object.otyp === LOADSTONE && object.cursed) {
        const quantity = object.quantity ?? object.quan ?? 1;
        if (verb) {
            if (verb === 'throw' && quantity > 1)
                object.corpsenm = 1;
            await plineWithContinuation(`For some reason, you cannot ${verb}${object.corpsenm ? ' any of' : ''} the stone${quantity !== 1 ? 's' : ''}!`);
        }
        object.corpsenm = 0;
        object.bknown = true;
        return false;
    }
    if (object.otyp === LEASH && object.leashmon) {
        if (verb)
            await plineWithContinuation(`The leash is tied around your ${heroHandName(state)}.`);
        return false;
    }
    if ((object.owornmask ?? 0) & W_SADDLE) {
        if (verb)
            await plineWithContinuation(`You cannot ${verb} something you are sitting on.`);
        return false;
    }
    return true;
}
// C do.c:714-780 drop(): the hero drops one carried object.  Returns
// whether a time-taking action occurred (C ECMD_TIME vs ECMD_FAIL).
export async function dropHeroObject(object, { state = game, publish = plineWithContinuation } = {}) {
    requireLiveGame(state);
    const hero = state.u;
    if (!object)
        return false;
    requirePlayingGame(state);
    if (!await canLetGo(object, 'drop', state))
        return false;
    if (object.otyp === CORPSE
        && await betterNotTryToDropThat(object, state))
        return false;
    // drop() uses semantic setters before its prose, not direct setnotworn.
    if (object === (state.uwep || hero.uwep))
        await setPrimaryWeapon(null, state);
    if (object === (state.uquiver || hero.uquiver))
        await setQuiverObject(null, state);
    if (object === (state.uswapwep || hero.uswapwep))
        await setSecondaryWeapon(null, state);
    if (hero.uswallow) {
        if (!hero.ustuck)
            throw new Error('Swallowed hero has no swallowing monster');
        // barrier between you and the floor
        if (state.flags?.verbose !== false) {
            const swallowerName = holdingMonsterName(hero.ustuck, state);
            const into = monsterDigests(hero.ustuck)
                ? `${possessiveName(swallowerName)} ${monsterStomachName(hero.ustuck.mnum)}`
                : swallowerName;
            // C drop() uses yobjnam() for unpaid objects and doname() otherwise.
            observeObjectForNaming(object, { state });
            const description = objectIsUnpaid(object)
                ? ownedObjectAction(object, null, state, { capitalized: false })
                : await inventoryItemDescription(object);
            await publish(`You drop ${description} into ${into}.`);
        }
    }
    else {
        const location = state.level.at(hero.ux, hero.uy);
        if ((object.oclass === RING_CLASS || object.otyp === MEAT_RING)
            && location && IS_SINK(location.typ)) {
            await dropRingIntoSink(object, { state, publish });
            return true;
        }
        if (!heroCanReachFloor(state, { checkPit: true })) {
            // we might be levitating due to #invoke Heart of Ahriman; the
            // finesse keeps the hero aloft through freeinv()/hitfloor()
            // and lands her afterwards.
            const levhack = beginLevitatingArtifactDrop(object, state);
            if (state.flags?.verbose !== false) {
                observeObjectForNaming(object, { state });
                await publish(`You drop ${await inventoryItemDescription(object)}.`);
            }
            await freeInventoryObject(object, state);
            // the finesse exists precisely because freeinv can end badly;
            // a dead hero does not reach hitfloor
            if (state.program_state?.gameover)
                return true;
            await hitFloorWithObject(object, { state, publish });
            // a fatal hitfloor ends the command; a dead hero does not land
            if (!state.program_state?.gameover && levhack)
                await finishLevitatingArtifactDrop(state);
            return true;
        }
        const dropLocation = state.level.at(hero.ux, hero.uy);
        if (!(dropLocation && IS_ALTAR(dropLocation.typ))
            && state.flags?.verbose !== false) {
            observeObjectForNaming(object, { state });
            await publish(`You drop ${await inventoryItemDescription(object)}.`);
        }
    }
    object.how_lost = LOST_DROPPED;
    await dropInventoryObjectAtHero(object, { state, publish });
    // the drop took time even if a fatal floor effect ended the game
    return true;
}
// C do.c:786-796 dropx(): take a dropped carried item out of inventory and
// put it at the hero's destination.  Shared by the drop command, the ring
// sink's give-back, and other owners that need the real dropx sequence:
// freeinv, then (when not swallowed) ship_object() and the altar BUC
// revelation, then dropy/dropz through the shared floor owner.
export async function dropInventoryObjectAtHero(object, { state = game, publish = plineWithContinuation } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const hero = state.u;
    await freeInventoryObject(object, state);
    // freeinv can be fatal (an invoked artifact's levitation ending over
    // lava); a dead hero ships, prays, and drops nothing further
    if (state.program_state?.gameover)
        return;
    if (!hero.uswallow) {
        if (await shipObject(object, hero.ux, hero.uy, { state, publish }))
            return;
        const location = state.level.at(hero.ux, hero.uy);
        if (location && IS_ALTAR(location.typ)) {
            await landObjectOnAltar(object, { state, publish });
            // the altar's effects (BUC revelation side effects) gate the
            // floor placement on survival
            if (state.program_state?.gameover)
                return;
        }
    }
    await dropObjectAtHero(object, { state, publish });
}
export async function dropObjectAtHero(object, { impact = false, state = game, publish = plineWithContinuation } = {}) {
    requireLiveGame(state);
    const hero = state.u;
    if (object === (state.uwep || hero.uwep))
        await setPrimaryWeapon(null, state);
    if (object === (state.uquiver || hero.uquiver))
        await setQuiverObject(null, state);
    if (object === (state.uswapwep || hero.uswapwep))
        await setSecondaryWeapon(null, state);
    if (hero.uswallow) {
        // hero has dropped an item while inside an engulfer
        const ball = state.uball || hero.uball;
        if (object !== ball) { // mon doesn't pick up ball
            // moving shop item into engulfer's inventory treated as theft;
            // C passes (unpaid obj, x, y, peaceful=TRUE, silent=FALSE) —
            // unpaid is the shared recursive ownership test (contents too)
            if (objectIsUnpaid(object))
                await stolenValue(object, hero.ux, hero.uy, true, {
                    state, publish, silent: false,
                });
            // add to engulfer's inventory if not immediately eaten
            const digestion = await engulferDigestsFood(object, { state, publish });
            if (digestion.heroDied)
                return null;
            if (!digestion.digested) {
                if (!hero.ustuck)
                    throw new Error('A swallowed hero has no engulfer.');
                await addObjectToMonsterInventory(hero.ustuck, object, state);
            }
        }
    }
    else {
        const floor = await applyFloorEffects(object, hero.ux, hero.uy, {
            state, publish, verb: 'drop',
        });
        // Floor effects (lava destruction, water damage) can be fatal;
        // a dead hero gets no placement, selling, or encumbrance work.
        if (state.program_state?.gameover)
            return null;
        // C returns immediately when flooreffects succeeds; the tail
        // encumber_msg() is not reached on this path.
        if (floor.finished)
            return floor.object;
        await placeObject(object, hero.ux, hero.uy, state);
        if (impact)
            await containerImpactDamage(object, hero.ux, hero.uy, {
                state, publish, fromInventory: true,
            });
        impactDisturbsZombies(object, impact, state);
        const ball = state.uball || hero.uball;
        if (object === ball) {
            await dropBall(hero.ux, hero.uy, { state, publish });
        }
        else if (state.level?.flags?.has_shop) {
            await sellHeroDroppedObject(object, hero.ux, hero.uy, state, { publish });
        }
        const stacked = await stack_object(object, state);
        if (heroIsBlind(state) && propertyIsActive('levitation', state))
            await map_object(stacked ?? object, false);
        await newsym(hero.ux, hero.uy); // remap location under self
    }
    await encumber_msg(state, publish);
    return object;
}
// ---------------------------------------------------------------------------
// C do.c:845-888 engulfer_digests_food(): an animal swallower instantly
// digests corpses, globs, and meat items; the effect owners match the
// corpse's polymorph/petrify/growth/heal potential.
// ---------------------------------------------------------------------------
const PM_GREEN_SLIME = MONSTER_NAME.indexOf('green slime');
const PM_WRAITH = MONSTER_NAME.indexOf('wraith');
const PM_NURSE = MONSTER_NAME.indexOf('nurse');
// monflag.h M2_SHAPESHIFTER; pm_to_cham() (mon.c:533-546) is this test.
// C obj.h:318.  Sometimes eggs and tins carry special corpsenm values that
// must not index mons[].
function isFoodObject(object) {
    return object.otyp === CORPSE || object.otyp === EGG || object.otyp === TIN;
}
// C obj.h:321-324 polyfood(): ofood with a real corpsenm whose species is a
// shapeshifter or deals AD_POLY.
function isPolymorphFood(object) {
    return isFoodObject(object) && object.corpsenm !== undefined && object.corpsenm >= 0
        && (is_shapeshifter(object.corpsenm)
            || (MONSTER_ATTACKS[object.corpsenm] || []).some(([, damageType]) => damageType === AD_POLY));
}
async function engulferDigestsFood(object, { state, publish }) {
    const swallower = state.u.ustuck;
    if (!swallower || !monsterDigests(swallower)
        || !(object.otyp === CORPSE || object.globby
            || object.otyp === MEATBALL || object.otyp === ENORMOUS_MEATBALL
            || object.otyp === MEAT_RING || object.otyp === MEAT_STICK))
        return { digested: false, heroDied: false };
    let couldPetrify = false;
    let couldPoly = false;
    let couldSlime = false;
    let couldGrow = false;
    let couldHeal = false;
    if (object.otyp === CORPSE) {
        couldPetrify = object.corpsenm !== undefined && touchPetrifies(object.corpsenm);
        couldPoly = isPolymorphFood(object);
        couldGrow = object.corpsenm === PM_WRAITH;
        couldHeal = object.corpsenm === PM_NURSE;
    }
    else if (object.otyp === GLOB_OF_GREEN_SLIME) {
        couldSlime = true;
    }
    await publish(`${definiteObjectAction(object, 'are', state)} instantly digested!`);
    if (couldPoly || couldSlime) {
        const change = await changeMonsterForm(swallower, couldSlime ? PM_GREEN_SLIME : null, state, { publish, showMessage: couldSlime });
        if (change?.heroDied)
            return { digested: true, heroDied: true };
    }
    else if (couldPetrify) {
        const stone = await petrifyMonsterImmediately(swallower, {
            creditHero: true, publish,
            finishDeath: (monster, options) => finishHeroMonsterKill(monster, monster.mx, monster.my, {
                ...options, showKillMessage: false, recordConduct: false,
            }),
        });
        if (stone.heroDied)
            return { digested: true, heroDied: true };
    }
    else if (couldGrow) {
        growMonster(swallower, { state });
    }
    else if (couldHeal) {
        healMonster(swallower, swallower.mhpmax, 0);
        // C muse.c mcureblindness() with verbose FALSE: no message
        if (!swallower.mcansee) {
            swallower.mcansee = 1;
            swallower.mblinded = 0;
        }
    }
    await deleteObject(object, state); // always used up
    return { digested: true, heroDied: false };
}
// with st_all (pickup.c:273-281) checks gloves and stoning resistance
// before prompting; the caller has already established otyp == CORPSE.
async function betterNotTryToDropThat(object, state) {
    const gloves = state.uarmg || state.u?.uarmg;
    const safe = !!gloves
        || !touchPetrifies(object.corpsenm)
        || heroResistsStoning(state);
    if (safe)
        return false;
    const species = objectMonsterName(object);
    // C paranoid_ynq(TRUE, buf, FALSE) != 'y'; the source prompt is
    // "Drop the %s corpse without %s protection on?" with body_part(HAND)
    const confirmed = await paranoidQuery(true, `Drop the ${species} corpse without ${heroHandName(state)} protection on?`);
    return !confirmed;
}
// C do.c obj_no_longer_held(): leaving direct hero/monster possession.
// Extraction, placement, and container linkage remain with their own owners.
function* objectTree(object) {
    for (const content of object.contents || [])
        yield* objectTree(content);
    yield object;
}
// Each decision is lazy: any shop speech finishes before the next node's RNG.
function* crysknifeReversions(object) {
    for (const member of objectTree(object)) {
        if (member.otyp === CRYSKNIFE
            && (!member.oerodeproof || rn2(10) === 0))
            yield member;
    }
}
function revertCrysknife(object) {
    object.otyp = WORM_TOOTH;
    object.oerodeproof = false;
    const name = OBJECT_NAMES[WORM_TOOTH];
    if (typeof name !== 'string')
        throw new Error('Worm tooth has no canonical object name');
    if (object.name !== undefined)
        object.name = name;
    if (object.plural !== undefined)
        object.plural = makePlural(name);
}
export function assertCreatedObject(object, state = game) {
    if (object.where !== 'free')
        throw new Error(`created object must be free, got ${object.where}`);
    for (const member of objectTree(object)) {
        if (member.unpaid || billForObject(member, state))
            throw new Error('created object must be unbilled');
    }
}
// Valid only for immediate constructor graphs. An unbilled free root cannot
// be charged; contained descendants have no costly_alteration mutation case.
export function createdObjectNoLongerHeld(object, state = game) {
    assertCreatedObject(object, state);
    for (const member of crysknifeReversions(object))
        revertCrysknife(member);
}
export function objectNoLongerHeldSynchronously(object, state = game) {
    if (!object)
        return;
    if (!state.context?.mon_moving && !state.program_state?.gameover) {
        for (const member of objectTree(object)) {
            if (member.otyp === CRYSKNIFE)
                throw new Error('hero-controlled crysknife release must be awaited');
        }
    }
    for (const member of crysknifeReversions(object))
        revertCrysknife(member);
}
// C do.c:obj_no_longer_held().
export async function objectNoLongerHeld(object, state = game) {
    requireLiveGame(state);
    if (!object)
        return;
    for (const member of crysknifeReversions(object)) {
        if (!state.context?.mon_moving && !state.program_state?.gameover)
            await chargeAlteredUnpaidObject(member, 'degrade', state);
        revertCrysknife(member);
    }
}
// C do.c:doddrop(): the multiple-drop command. C do.c:menu_drop(): the
// menu-driven drop pass. C do.c:menudrop_split(): splitting a counted
// stack before dropping its share. C do.c:count_justpicked() and
// C do.c:find_justpicked(): the justPicked drop path.
export async function dropMultipleObjects() {
    if (!game.inventory.length) {
        await pline('You have nothing to drop.');
        return ECMD_OK;
    }
    const inShop = !!game.u.ushops?.[0];
    if (inShop)
        setSellDisposition(SELL_DELIBERATE);
    try {
        const style = game.flags.menu_style ?? MENU_FULL;
        let matches = (_object) => true;
        if (style === MENU_TRADITIONAL || style === MENU_COMBINATION) {
            // ggetobj() returns 0 for Escape. doddrop() stops there, but
            // menu_drop() continues to its item menu with no class filter.
            const selected = await traditionalDropCategories(style === MENU_COMBINATION)
                ?? (style === MENU_COMBINATION
                    ? { categories: [], all: false, menu: false, requireUnpaid: false } : null);
            if (!selected)
                return ECMD_OK;
            matches = object => matchesCategories(object, selected.categories);
            if (selected.menu) {
                if (selected.all || !selected.categories.length)
                    matches = () => true;
            }
            else if (style === MENU_TRADITIONAL || selected.all) {
                const result = await dropTraditionally(selected);
                // doddrop() returns askchain()'s sum directly in traditional
                // mode; menu_drop() converts that sum into a command flag.
                if (style === MENU_TRADITIONAL)
                    return result;
                return result ? ECMD_TIME : ECMD_OK;
            }
            else if (!selected.categories.length
                && !((game.flags.paranoia_bits ?? 0) & PARANOID_AUTOALL)) {
                // C allow_category() rejects an empty combination-menu filter.
                return ECMD_OK;
            }
        }
        else if (style === MENU_FULL) {
            const categories = await dropCategories();
            matches = object => categories.matchers.some(match => match(object));
            if (categories.autoSelect)
                return await dropAllMatching(matches) ? ECMD_TIME : ECMD_OK;
            const picked = game.inventory.filter(object => object.pickup_prev);
            const single = picked.length === 1 ? picked[0] : null;
            if (categories.justPickedCount !== undefined && single)
                return await dropCount(single, categories.justPickedCount) ? ECMD_TIME : ECMD_OK;
        }
        const selected = await chooseDroppedObjects(game.inventory.filter(matches));
        if (!selected.length)
            return ECMD_OK;
        let dropped = false;
        bypassObjectList(game.inventory, true);
        try {
            for (const selection of selected) {
                const object = selection.value;
                if (!game.inventory.includes(object) || !object.bypass)
                    continue;
                dropped = await dropCount(object, selection.count) || dropped;
                if (game.program_state.gameover)
                    break;
            }
        }
        finally {
            bypassObjectList(game.inventory, false);
        }
        return dropped ? ECMD_TIME : ECMD_OK;
    }
    finally {
        if (inShop)
            setSellDisposition(SELL_NORMAL);
    }
}
async function dropCategories() {
    // The multi-select window's own dismissal restores the screen: C's
    // select_menu() runs the whole windowport call with bot_disabled, so
    // docrt() leaves the status window blank until the next real bot().
    // Restoring a pre-menu snapshot here would paint the old status back.
    return await chooseObjectCategories('Drop what type of items?', game.inventory);
}
async function chooseDroppedObjects(objects) {
    if (!objects.length)
        return [];
    const sorted = sortObjects(objects, { mode: lootSortMode({ inventoryLetters: true }) });
    // menu_drop() passes INVORDER_SORT even when sortpack is disabled.
    const sections = [];
    for (const oclass of [...inventoryClassOrder(), VENOM_CLASS]) {
        const members = sorted.filter(object => object.oclass === oclass);
        if (!members.length)
            continue;
        const items = [];
        for (const object of members) {
            observeObjectForNaming(object);
            consumeHallucinatedMenuObjectGlyph(object);
            items.push({ key: object.invlet ?? '#', value: object,
                groupAccelerator: OBJECT_CLASS_SYMBOLS[oclass] ?? '',
                text: await objectDescription(object, { withPrice: true }) });
        }
        sections.push({ heading: objectClassHeading(oclass), items });
    }
    // As in dropCategories(), the window's dismissal owns the screen state;
    // a pre-menu snapshot would repaint rows C leaves cleared.
    return await showMultiSelectWindow({
        title: 'What would you like to drop?', sections, returnCounts: true,
    });
}
async function dropAllMatching(matches) {
    let dropped = false;
    bypassObjectList(game.inventory, false);
    try {
        let object;
        while ((object = nextUnbypassedObject(game.inventory))) {
            if (matches(object))
                dropped = await dropHeroObject(object) || dropped;
            if (game.program_state.gameover)
                break;
        }
    }
    finally {
        bypassObjectList(game.inventory, false);
    }
    return dropped;
}
async function dropCount(object, count) {
    if (count > 0 && count < objectQuantity(object) && !isWeldedPrimary(object)) {
        if (object.otyp === LOADSTONE && object.cursed)
            object.corpsenm = count;
        else {
            const split = splitObjectStack(object, count);
            if (!split)
                throw new Error('Cannot split the selected drop quantity');
            object = split;
        }
    }
    return await dropHeroObject(object);
}
function bucCategory(object) {
    if (object.oclass === COIN_CLASS)
        return game.flags.goldX ? 'X' : 'U';
    if (game.urole?.key === 'priest')
        object.bknown = true;
    return !object.bknown ? 'X' : object.blessed ? 'B' : object.cursed ? 'C' : 'U';
}
function hasUnpaid(object) {
    return !!object.unpaid || !!object.contents?.some(hasUnpaid);
}
function matchesCategories(object, categories) {
    const classes = categories.filter((category) => typeof category === 'number');
    if (object.oclass === COIN_CLASS && classes.length)
        return classes.includes(COIN_CLASS);
    const statuses = categories.filter((category) => category === 'B' || category === 'U' || category === 'C' || category === 'X');
    return (!classes.length || classes.includes(object.oclass))
        && (!statuses.length || statuses.includes(bucCategory(object)))
        && (!categories.includes('u') || hasUnpaid(object))
        && (!categories.includes('P') || !!object.pickup_prev);
}
async function traditionalDropCategories(combo) {
    const classes = [...new Set(game.inventory.map(object => object.oclass))];
    const statuses = new Set(game.inventory.map(bucCategory));
    const extras = `${game.inventory.some(hasUnpaid) ? 'u' : ''}`
        + ['B', 'U', 'C', 'X'].filter(status => statuses.has(status)).join('')
        + `${game.inventory.some(object => object.pickup_prev) ? 'P' : ''}ai${combo ? '' : 'm'}`;
    let response;
    for (;;) {
        response = await getLine(`What kinds of thing do you want to drop? [${classes.map(oclass => OBJECT_CLASS_SYMBOLS[oclass]).join('')} ${extras}]`, (_character, key) => key >= 32 && key < 127);
        if (response === null)
            return null;
        if (!response.includes('i'))
            break;
        if ((await selectInventoryObject()).key === 27)
            return null;
    }
    const categories = [];
    let requireUnpaid = false;
    for (const character of response) {
        if (' aiAm'.includes(character))
            continue;
        if (character === 'u' || character === 'B' || character === 'U'
            || character === 'C' || character === 'X' || character === 'P') {
            categories.push(character);
            requireUnpaid = character === 'u';
            continue;
        }
        const oclass = OBJECT_CLASS_SYMBOLS.indexOf(character);
        if (oclass < ILLOBJ_CLASS)
            await pline(`You don't have any ${character}'s.`);
        else if (!categories.includes(oclass))
            categories.push(oclass);
    }
    return { categories, all: response.includes('a'), menu: response.includes('m'), requireUnpaid };
}
async function dropTraditionally(selection) {
    const sorted = sortObjects(game.inventory, { mode: SORTLOOT_INVLET });
    const classes = selection.categories.filter((category) => typeof category === 'number');
    const passes = classes.length ? classes : [null];
    let acceptAll = selection.all, result = ECMD_OK, questioned = false;
    try {
        for (const oclass of passes) {
            bypassObjectList(game.inventory, false);
            let object;
            let letterCode = 'a'.charCodeAt(0) - 1;
            if (game.inventory[0]?.oclass === COIN_CLASS)
                letterCode--;
            while ((object = nextUnbypassedObject(game.inventory, game, sorted))) {
                if (letterCode === 'z'.charCodeAt(0))
                    letterCode = 'A'.charCodeAt(0);
                else if (letterCode === 'Z'.charCodeAt(0))
                    letterCode = '#'.charCodeAt(0);
                else
                    letterCode++;
                if ((oclass !== null && object.oclass !== oclass)
                    || (selection.requireUnpaid && !hasUnpaid(object))
                    || !matchesCategories(object, selection.categories))
                    continue;
                questioned = true;
                let answer = 'y', count = 0;
                if (!acceptAll) {
                    observeObjectForNaming(object);
                    const letter = game.flags.fixinv !== false ? object.invlet ?? '#'
                        : String.fromCharCode(letterCode);
                    const question = await objectQuestion(object, {
                        prefix: '', suffix: '?', fallback: 'item',
                        format: async (item, state) => `${letter} - ${await objectDescription(item, { state })}`,
                        shortFormat: (item, state) => `${letter} - ${simpleObjectNameWithArticle(item, state)}`,
                    });
                    const response = await tty_yn_function(question, objectQuantity(object) < 2 ? 'ynaq' : 'yn#aq', 'n');
                    answer = response.answer;
                    count = Number(response.count);
                }
                if (answer === 'q')
                    return result;
                if (answer === 'n' || answer === '#' && !count)
                    continue;
                if (answer === 'a')
                    acceptAll = true;
                const original = object;
                if (answer === '#' && count < objectQuantity(object)
                    && !(object.otyp === LOADSTONE && object.cursed) && !isWeldedPrimary(object)) {
                    const split = splitObjectStack(object, count);
                    if (!split)
                        throw new Error('Cannot split the traditional drop quantity');
                    object = split;
                }
                const success = await dropHeroObject(object);
                if (!success && object !== original)
                    await rejoinObjectStack(original, object);
                result += success ? ECMD_TIME : ECMD_FAIL;
                if (game.program_state.gameover)
                    return result;
            }
        }
        await pline(questioned ? 'That was all.' : 'No applicable objects.');
        return result;
    }
    finally {
        clearBypasses();
    }
}
// C do.c:u_stuck_cannot_go(). A sticky hero releases its captive, while
// being held or swallowed prevents even an attempt to use the floor below.
export async function monsterPreventsStairTravel(up) {
    const holder = game.u.ustuck;
    if (!holder)
        return false;
    if (game.u.uswallow || !heroFormSticks(game)) {
        const condition = !game.u.uswallow ? 'being held'
            : monsterDigests(holder) ? 'swallowed' : 'engulfed';
        await plineWithContinuation(`You are ${condition}, and cannot go ${up ? 'up' : 'down'}.`);
        game.context.move = 1;
        return true;
    }
    setHeroGrip(null);
    await plineWithContinuation(`You release ${monsterName(holder)}.`);
    return false;
}
// C do.c:final_level() and priest.c:reset_hostility().
export async function finishAstralArrival() {
    requirePlayingGame(game);
    for (const monster of game.level.monsters.slice().reverse()) {
        if (!monster.isminion || !['Angel', 'aligned cleric'].includes(MONSTER_NAME[monster.mnum] ?? ''))
            continue;
        if (monsterAlignmentType(monster) !== game.u.ualign.type) {
            monster.mpeaceful = monster.mtame = 0;
            setMonsterMalign(monster);
        }
        await newsym(monster.mx, monster.my);
    }
    await createPlayerMonsters(rn1(4, 3), true);
    await gainGuardianAngel(game);
}
// C do.c:u_collide_m(). A level arrival may overlap a resident or follower.
// Move the hero to an adjacent legal square, or let the monster's own
// placement rules choose its destination, including flight over liquids.
export async function resolveHeroArrivalCollision() {
    const level = requireGameLevel();
    const collision = level.monsters.find(monster => monsterHasMapPosition(monster, game) && !monster.dead
        && monster.mx === game.u.ux && monster.my === game.u.uy);
    if (!collision)
        return;
    let movedHero = false;
    if (!rn2(2)) {
        const destination = enexto(game.u.umonnum, game.u.ux, game.u.uy);
        if (destination && Math.abs(destination.x - game.u.ux) <= 1
            && Math.abs(destination.y - game.u.uy) <= 1) {
            await placeHeroOnLevel(destination.x, destination.y);
            movedHero = true;
        }
    }
    if (!movedHero)
        await moveMonsterNextToHero(collision, game, { flags: RLOC_NOMSG });
    const remaining = level.monsters.find(monster => monsterHasMapPosition(monster, game) && !monster.dead
        && monster.mx === game.u.ux && monster.my === game.u.uy);
    if (!remaining)
        return;
    if (game.flags.debug)
        await plineWithContinuation("(monster in hero's way)");
    const relocated = await randomMonsterRelocation(remaining, { flags: RLOC_NOMSG });
    const obstruction = level.monsters.find(monster => monsterHasMapPosition(monster, game)
        && monster.mx === game.u.ux && monster.my === game.u.uy);
    if (!relocated)
        await sendMonsterToLimbo(remaining);
    else if (obstruction)
        await sendMonsterToLimbo(obstruction);
}
// C do.c:danger_uprops(): petrifying, sliming, strangling, or sick —
// waiting or searching through one is refused.
function dangerousHeroProperties() {
    const u = game.u;
    return !!(u.stoned || (u.stonedTurns ?? 0) > 0
        || u.slimed || (u.slimedTurns ?? 0) > 0
        || u.strangled || (u.strangledTurns ?? 0) > 0
        || u.sick || (u.sickTurns ?? 0) > 0);
}
// C Norep() compares pline.c's previous individual message.
async function norep(message) {
    if (game._lastPlineMessage !== message)
        await pline(message);
}
// C do.c:cmd_safety_prevention().  The per-command counter is durable across
// rejected inputs: with cmdassist disabled the first warning includes the
// `m`-prefix hint and later warnings shorten.  A successful or forced command
// resets its own counter.
export async function commandSafetyPrevention({ force = false, multi = false, verb, description, action, counterKey, }) {
    if (game.flags?.safe_wait !== false && !force && !multi) {
        const count = game[counterKey] ?? 0;
        const cmdassist = game.flags?.cmdassist !== false;
        const suffix = cmdassist || count === 0
            ? `  Use 'm' prefix to force ${description}.`
            : '';
        if (!cmdassist)
            game[counterKey] = count + 1;
        if (threateningMonsterNearby()) {
            await norep(`${action}${suffix}`);
            game.context.move = 0;
            return true;
        }
        if (dangerousHeroProperties()) {
            await norep(`${verb} doesn't feel like a good idea right now.`);
            game.context.move = 0;
            return true;
        }
    }
    game[counterKey] = 0;
    return false;
}
// C do.c:donull().  Return true when the wait consumes time and false when
// safe-wait policy rejects it.
export async function donull(force = false, multi = false) {
    const prevented = await commandSafetyPrevention({
        force,
        multi,
        verb: 'Waiting',
        description: 'a no-op (to rest)',
        action: 'Are you waiting to get hit?',
        counterKey: '_didNothingFlag',
    });
    return !prevented;
}
// C do.c:dowipe().  Starting the command and cleaning one turn are separate
// because monsters and timed effects act between occupation turns.
export async function dowipe(state = game) {
    if ((state.u?.ucreamed ?? 0) > 0) {
        state._occupation = {
            key: 'wipe-face',
            remaining: 1,
            text: `wiping off your ${heroFaceName(state)}`,
        };
        state.context.move = 1;
        return;
    }
    await pline(`Your ${heroFaceName(state)} is already clean.`);
    state.context.move = 1;
}
export async function continueWipingFace(occupation, state = game) {
    occupation.remaining--;
    const creamRemoved = Math.min(4, state.u?.ucreamed ?? 0);
    const blindnessRemoved = Math.min(4, state.u?.blindTurns ?? 0);
    state.u.ucreamed = Math.max(0, (state.u?.ucreamed ?? 0) - creamRemoved);
    state.u.blindTurns = Math.max(0, (state.u?.blindTurns ?? 0) - blindnessRemoved);
    if ((state.u?.blindTurns ?? 0) === 0) {
        await pline("You've got the glop off.");
        state.u.ucreamed = 0;
        const gulp = await gulpBlindnessCheck({ state, publish: plineWithContinuation });
        if (!gulp.triggered && !gulp.died) {
            setHeroBlindnessTimeout(1, state);
            await makeBlinded(0, { state, publish: plineWithContinuation });
        }
        state._occupation = null;
    }
    else if ((state.u?.ucreamed ?? 0) === 0) {
        await pline(`Your ${heroFaceName(state)} feels clean now.`);
        state._occupation = null;
    }
    else if (occupation.remaining <= 0) {
        occupation.remaining = 1;
    }
    state.context.move = 1;
    return true;
}
export async function woundHeroLegs(side, turns, state = game, { publish = plineWithContinuation, } = {}) {
    const hero = state.u;
    state.context.botl = true;
    if (!((hero._woundedLegTurns ?? 0) > 0) && !hero._woundedLegSide)
        requireHeroAttributes(hero).atemp.a[A_DEX]--;
    hero._woundedLegTurns = Math.max(hero._woundedLegTurns || 0, turns);
    if (!hero._woundedLegSide)
        hero._woundedLegSide = side;
    else if (hero._woundedLegSide !== side)
        hero._woundedLegSide = 'both';
    await encumber_msg(state, publish);
}
export async function healHeroLegs(state = game, { cause = 'healing', publish = plineWithContinuation, } = {}) {
    const hero = state.u;
    if (!((hero._woundedLegTurns ?? 0) > 0) && !hero._woundedLegSide)
        return false;
    state.context.botl = true;
    const temporary = hero.atemp;
    if (temporary && temporary.a[A_DEX] < 0)
        temporary.a[A_DEX]++;
    if (!hero.usteed && cause !== 'petrification') {
        const both = hero._woundedLegSide === 'both';
        const leg = heroLegName(state);
        await publish(`Your ${both ? makePlural(leg) : leg} ${both ? 'feel' : 'feels'} better.`);
    }
    hero._woundedLegTurns = 0;
    hero._woundedLegSide = null;
    if (cause === 'healing')
        await encumber_msg(state, publish);
    return true;
}
// ── moved from src/js/trap.ts ──
export async function applyBoulderPitEffects(boulder, trap, x, y, { state = game, publish = plineWithContinuation, verb = '', } = {}) {
    requireLiveGame(state);
    const level = requireGameLevel(state);
    if (boulder.where !== 'free')
        throw new Error('boulder pit effects require a free object');
    const trapType = trap.ttyp;
    const seen = !!trap.tseen;
    const heroHere = state.u.ux === x && state.u.uy === y;
    const monster = monsterAtPosition(level, x, y);
    let squishedHero = false;
    if (monster?.mtrapped || state.u.utrap && heroHere) {
        if (verb && (cansee(x, y) || heroHere))
            await publish(`${heroIsBlind(state) ? 'A' : 'The'} boulder ${verb}s into the pit${monster ? '' : ' with you'}.`);
        if (monster) {
            if (!ignoresFallingBoulder(monster.mnum)) {
                if (state.context.mon_moving) {
                    monster.mhp -= rollPhysicalWeaponDamage(boulder, monster);
                    if (monster.mhp <= 0) {
                        const destroyed = monsterIsNonliving(monster.mnum) || monsterIsVampireShifter(monster);
                        const death = await finishEnvironmentalMonsterDeath(monster, state, {
                            publish, deathMessage: canSpotMonster(monster)
                                ? `${monsterName(monster, { state, capitalized: true })} is ${destroyed ? 'destroyed' : 'killed'}!` : null,
                        });
                        if (death.heroDied || state.program_state.gameover)
                            return { finished: true, object: boulder, heroDied: true };
                    }
                }
                else if ((await hitMonsterWithSettlingBoulder(monster, boulder, { state, publish })).heroDied) {
                    return { finished: true, object: boulder, heroDied: true };
                }
            }
            monster.mtrapped = 0;
        }
        else if (!state.u.passesWalls && !ignoresFallingBoulder(heroSpecies(state))) {
            const damage = rnd(15);
            const cause = 'squished under a boulder';
            if (await loseHeroHp(state.u.halfPhysicalDamage ? Math.trunc((damage + 1) / 2) : damage, cause, { state, publish, deathCause: cause }))
                return { finished: true, object: boulder, heroDied: true };
            squishedHero = true;
        }
        else
            await resetUtrap(true, state);
    }
    if (verb && !squishedHero) {
        if (heroIsBlind(state) && heroHere) {
            const message = formatHeardMessage('a CRASH! beneath you.', state);
            if (message)
                await publish(message);
        }
        else if (!heroIsBlind(state) && cansee(x, y)) {
            const effect = trapType === TRAPDOOR ? 'plugs a trap door'
                : trapType === HOLE ? 'plugs a hole' : 'fills a pit';
            await publish(`The boulder ${trapType === TRAPDOOR && !seen ? 'triggers and ' : ''}${effect}.`);
        }
        else {
            const message = formatHeardMessage(`a boulder ${verb}.`, state);
            if (message)
                await publish(message);
        }
    }
    const remainingTrap = level.traps.find(candidate => candidate.tx === x && candidate.ty === y);
    if (remainingTrap) {
        await deleteFloorTrap(remainingTrap, state);
        if (state.program_state.gameover)
            return { finished: true, object: boulder, heroDied: true };
        if (state.u.utrap && heroHere)
            await resetUtrap(false, state);
    }
    boulder.ox = x;
    boulder.oy = y;
    await useUpFloorObject(boulder, 1, { state, publish });
    const buriedFloorObjects = await buryFloorObjectsAt(x, y, state, { publish });
    await newsym(x, y);
    return { finished: true, object: null, buriedFloorObjects };
}
function ignoresFallingBoulder(mnum) {
    return monsterPassesWalls(mnum) || monsterThrowsRocks(mnum);
}
//# sourceMappingURL=do.js.map