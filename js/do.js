// do.js — the do.c owner: drop commands and floor landings, sink rings,
// level-arrival strays, stair travel, goto_level and its deferred
// scheduling, wait/wipe, and wounded legs.
// C refs: do.c dodrop(), boulder_hits_pool(), trycall(), polymorph_sink(),
//         teleport_sink(), dosinkring(), canletgo(), drop(), dropx(),
//         dropz(), engulfer_digests_food(), obj_no_longer_held(),
//         doddrop(), menu_drop(), u_stuck_cannot_go(), dodown(), doup(),
//         save_currentstate(), u_collide_m(), familiar_level_msg(),
//         goto_level(), hellish_smoke_mesg(), temperature_change_msg(),
//         maybe_lvltport_feedback(), final_level(), schedule_goto(),
//         deferred_goto(), danger_uprops(), cmd_safety_prevention(),
//         donull(), wipeoff(), dowipe(), set_wounded_legs(), heal_legs().
import { maketrap } from './trap.js';
import { revive, requireCorpseSpecies, isContainerLocation } from './zap.js';
import { ILLOBJ_CLASS, RING_CLASS, COIN_CLASS, VENOM_CLASS } from './objclass.js';
import { OBJ_NAME } from './object_data.js';
import { setHeroBlindnessTimeout, heroIsBlind, heroIsDeaf, heroIsHallucinating } from './senses.js';
import { game, requireLiveGame, requireGameLevel, requirePlayingGame } from './gstate.js';
import { formatHeardMessage, pline, plineWithContinuation, publishHeardMessage, recordGameLogEvent, } from './pline.js';
import { MONSTER_ATTACKS, MONSTER_NAME, MONSTER_MOVE } from './monster_data.js';
import { monsterHasMapPosition, monsterAtPosition, dismountHero, stuckSteed } from './steed.js';
import { AD_POLY } from './monster_attack_types.js';
import { A_DEX, DB_FLOOR, DB_UNDER, DRAWBRIDGE_UP, ECMD_FAIL, ECMD_OK, ECMD_TIME, GETOBJ_SUGGEST, HOLE, IS_ALTAR, IS_SINK, LOST_DROPPED, MENU_COMBINATION, MENU_FULL, MENU_TRADITIONAL, PARANOID_AUTOALL, RLOC_NOMSG, ROOM, SORTLOOT_INVLET, TRAPDOOR, WATER, ALTAR, AM_NONE, COLNO, Align2amask, FOUNTAIN, Is_waterlevel, ROWNO, SINK, THRONE, W_ARMOR, W_ACCESSORY, W_SADDLE, DISMOUNT_FELL, MAGIC_PORTAL, In_endgame, In_quest, In_hell, Is_valley, Is_airlevel, Is_astralevel, ACH_ENDG, ACH_ASTR, Is_rogue_level, Is_knox_level, UTOTYPE_DEFERRED, UTOTYPE_ATSTAIRS, UTOTYPE_FALLING, UTOTYPE_PORTAL, UTOTYPE_RMPORTAL, TT_BURIEDBALL, PIT, SPIKED_PIT, TT_PIT, VIBRATING_SQUARE, STAIRS, HAND, FACE, LEG, STOMACH } from './const.js';
import { paranoidQuery, commandResultCancelled, commandResultFailed, resetOccupations } from './cmd.js';
import { makeBlinded } from './potion.js';
import { gulp_blnd_check, holdingMonsterName, } from './mhitu.js';
import { BOULDER, CORPSE, CRYSKNIFE, EGG, ENORMOUS_MEATBALL, GLOB_OF_GREEN_SLIME, LEASH, LOADSTONE, MEATBALL, MEAT_RING, MEAT_STICK, TIN, WORM_TOOTH } from './object_data.js';
import { makePlural, withIndefiniteArticle, ownedObjectName, verbForSubject, objectCombatName, objectDescription, objectQuestion, observeObjectForNaming, simpleObjectNameWithArticle, objectMonsterName, ownedObjectAction, definiteObjectAction } from './objnam.js';
import { objectTypeKnown, oinit } from './o_init.js';
import { billForObject, chargeAlteredUnpaidObject, deleteObject, objectIsUnpaid, stolenValue, sellHeroDroppedObject, SELL_DELIBERATE, SELL_NORMAL, setSellDisposition, setShopResidency, fixShopDamage, dopay } from './shk.js';
import { d, rn1, rn2, rnd } from './rng.js';
import { callObjectType, displayColorName, displayLiquidName, monsterName, randomDisplayMonsterName } from './do_name.js';
import { threateningMonsterNearby, loseHeroHp, impactDisturbsZombies, switchHeroTerrain, burnAwayHeroSlime, blockMonsterNotices, noticeAllMonsters, unblockMonsterNotices, heroLocomotion, nearCapacity, checkSpecialRoom, endVoluntaryMultiTurn, applyHeroLiquidEffects, SLT_ENCUMBER } from './hack.js';
import { applyFloorEffects } from './floor_effects.js';
import { buryFloorObjectsAt, addBuriedObject, buriedBallToPunishment, applyPickAxeDirection } from './dig.js';
import { canSpotMonster, newsym, docrt, consumeHallucinatedMenuObjectGlyph, OBJECT_CLASS_SYMBOLS, map_object, flush_screen, reglyphSymbolSet, } from './display.js';
import { cansee, vision_note_blocker_change, vision_recalc, vision_reset, vision_reset_new_level } from './vision.js';
import { finishEnvironmentalMonsterDeath, wakeMonstersNearWithMessages, monsterInAir, changeMonsterForm, healMonster, sendMonsterToLimbo, moveMonsterNextToHero, setHeroGrip, monsterDeathCount, killGenocidedMonsters, purgeDeadMonsters, restoreMonsterShape, finishHeroMonsterKill, isRider, zombieForm, } from './mon.js';
import { heroSpecies, heroFormSticks, heroIsPolymorphed, body_part, mbodypart } from './polyself.js';
import { rollPhysicalWeaponDamage } from './weapon.js';
import { useUpFloorObject, stack_object } from './invent.js';
import { deleteFloorTrap, resetUtrap, petrifyMonsterImmediately, seeTrap, deleteTrap, climbOutOfPit, dotrapAt, selfTouchPetrifyingWeapons, } from './trap.js';
import { heroHasArtifactDefense, heroHasCarriedArtifactFlag } from './artifact.js';
import { impossible } from './diagnostics.js';
import { waterbodyName } from './pager.js';
import { isLavaAt, isPoolAt } from './dbridge.js';
import { chooseObjectCategories, autopickupAtHero } from './pickup.js';
import { selectInventoryObject, inventoryClassOrder, lootSortMode, objectClassHeading, inventoryItemDescription, consumeInventoryItem, delobj, sortObjects, chooseInventoryObject, finishInventoryRemoval, floorObjectDescription, freeInventoryObject, } from './invent.js';
import { bypassObjectList, clearBypasses, nextUnbypassedObject } from './worn.js';
import { objectQuantity, rejoinObjectStack, splitObjectStack, placeObject } from './mkobj.js';
import { getLine, tty_yn_function, promptYesNo } from './query.js';
import { isWeldedPrimary, setPrimaryWeapon, setQuiverObject, setSecondaryWeapon } from './wield.js';
import { showMultiSelectWindow } from './windows.js';
import { isBimanualObject, isPick } from './object_properties.js';
import { possessiveName } from './hacklib.js';
import { heroCanReachFloor, engravingAt, make_grave, rewindEngravingsForSave, restoreEngravings } from './engrave.js';
import { beginLevitatingArtifactDrop, finishLevitatingArtifactDrop } from './artifact.js';
import { hitFloorWithObject } from './dothrow.js';
import { shipObject, containerImpactDamage, deliverMigratingObjects, impactDrop } from './dokick.js';
import { landObjectOnAltar } from './altar_object.js';
import { addObjectToMonsterInventory } from './steal.js';
import { growMonster, setMonsterMalign } from './makemon.js';
import { encumber_msg } from './pickup.js';
import { propertyIsActive } from './properties.js';
import { dropBall, dragBallDownStairs, fallWithIronBall, heroIsPunished, placeBallAndChain, unplaceBallAndChain } from './ball.js';
import { requireHeroAttributes, requireInitializedHero } from './hero_types.js';
import { objectResistsDestruction } from './zap.js';
import { countLevelFeatures, mklev } from './mklev.js';
import { stairway_find_from, stairwayAt, u_on_downstairs, u_on_sstairs, u_on_upstairs } from './stairs.js';
import { monsterAlignmentType, forgetTempleEntry } from './priest.js';
import { createPlayerMonsters } from './mplayer.js';
import { gainGuardianAngel } from './minion.js';
import { randomMonsterRelocation, enexto, safe_teleds, finishTeleportArrival } from './teleport.js';
import { placeHeroOnLevel, depth, dungeonBuildsUp, dungeonDepth, endgameLevelName, initOverviewRecord, level_difficulty, markOverviewUnreachable, recordMappedOverviewState, recordOverviewBranch, specialPrototypeAt, u_on_rndspot, insideWizardTower, levelIsWizardTower, wizardTowerLevelAt, ledgerNo, surfaceName, next_level, prev_level, } from './dungeon.js';
import { is_shapeshifter, monsterDigests, monsterIsNonliving, monsterIsVampireShifter, monsterPassesWalls, monsterThrowsRocks, touchPetrifies, heroResistsStoning, heroHasOlfaction, } from './mondata.js';
import { resetTrapSetting, bringLeashedFollowers } from './apply.js';
import { maybeResetPick } from './lock.js';
import { addExperience, checkExperienceLevel } from './exper.js';
import { runDueTimers, restoreLevelTimers, objectTimers, scheduleObjectTimer } from './timeout.js';
import { restoreLevelChains, restoreMonsterCover, hideMonsterOnRestore, restoreMonsterWormHeads } from './restore.js';
import { restoreLevelPetHistory, restoreObjectPetHistory } from './save.js';
import { restoreLevelLightSources } from './light.js';
import { finishLivingGame } from './end.js';
import { currentLuaLifecycle } from './lua/lifecycle.js';
import { bot, checkGoldSymbol } from './botl.js';
import { restoreLevelRegions, updateHeroRegions } from './region.js';
import { fumaroles, movebubbles, restore_waterlevel } from './mkmaze.js';
import { recordAchievement, recordDungeonEntryAchievements } from './insight.js';
import { displayPreparedQuestArrival, prepareQuestArrival, prepareMainQuestPortalCall, onQuestStart, okToQuest, } from './quest.js';
import { resurrectWizard } from './wizard.js';
import { deliverMigratingMonsters, discardMigrations, updateMonsterLastMove, catchUpMonster, collectLevelFollowers, } from './dog.js';
import { deliverSpecialLevelMessages } from './questpgr.js';
import { descendFromLevitation } from './levitation_commands.js';
import { do_attack, hitMonsterWithHeroObject } from './uhitm.js';
import { monsterSpeciesHidesOnCeiling, monsterIsDisplacer } from './mondata.js';
import { LL_ACHIEVE, LL_DEBUG, G_GENOD, OBJECT_TIMER_KIND } from './const.js';
import { rotCorpse } from './corpse_rot.js';
import { canSeeMonster } from './display.js';
import { riderRevivalTime, set_corpsenm } from './mkobj.js';
import { corpseName as corpseObjectName, capitalizedDefiniteName } from './objnam.js';
// C do.c:dodrop()
// Also C invent.c:any_obj_ok(): inlined as the drop chooser's
// GETOBJ_SUGGEST callback below.
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
            let hand = body_part(HAND, state);
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
            await plineWithContinuation(`The leash is tied around your ${body_part(HAND, state)}.`);
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
                ? `${possessiveName(swallowerName)} ${mbodypart(hero.ustuck.mnum, STOMACH)}`
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
// C do.c:better_not_try_to_drop_that()
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
    const confirmed = await paranoidQuery(true, `Drop the ${species} corpse without ${body_part(HAND, state)} protection on?`);
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
    const name = OBJ_NAME(WORM_TOOTH);
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
// Also C pickup.c:add_valid_menu_class(): inlined here as the chosen
// drop categories passed to the matcher.
// Also C pickup.c:allow_all(): inlined here as the constant-true matcher.
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
// Part of C invent.c:askchain(): the drop-specific sorted traversal, questions, and stack splitting.
// Also C invent.c:safeq_xprname(): inlined here as the full-name prompt
// callback, with the inventory letter and no final period.
// Also C invent.c:safeq_shortxprname(): inlined here as the short-name
// fallback passed to objectQuestion().
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
// C do.c:dodown(). The '>' command: set_move_cmd() first; C hack.c:u_rooted()
// supplies the "You are rooted" refusal; C trap.c:uteetering_at_seen_pit()
// and C trap.c:uescaped_shaft() let the seen pit and shaft underfoot take
// the plunge before the stairway is required; C dbridge.c:is_pool_or_lava():
// the ceiling hider's drop-to-liquid message. dungeon.ts's next_level()
// owns the destination itself; the C fall branch — goto_level() one level
// deeper without a stairway — belongs to the hole-trap owner that C's
// dodown() also routes there.
export async function dodown() {
    const level = requireGameLevel();
    requireInitializedHero(game.u);
    // C do.c doup()/dodown() start with set_move_cmd(): the menu prefix's
    // no-pickup request and the cleared travel state outlive a refusal.
    game.u.dx = game.u.dy = 0;
    game.u.dz = 1;
    if (game.iflags.menu_requested)
        game.context.nopick = true;
    game.context.travel = game.context.travel1 = false;
    if (MONSTER_MOVE[game.u.umonnum] === 0) {
        const where = propertyIsActive('levitation', game) || Is_airlevel(game.u.uz)
            || Is_waterlevel(game.u.uz) ? 'in place' : 'to the ground';
        await plineWithContinuation(`You are rooted ${where}.`);
        endVoluntaryMultiTurn(game);
        game.context.move = 1;
        return false;
    }
    if (await stuckSteed(true, game)) {
        game.context.move = 0;
        return false;
    }
    const descent = await descendFromLevitation(game);
    if (descent.handled) {
        game.context.move = descent.spentTurn ? 1 : 0;
        return descent.spentTurn;
    }
    if (heroIsPolymorphed(game) && game.u.uundetected
        && monsterSpeciesHidesOnCeiling(game.u.umonnum)) {
        game.u.uundetected = 0;
        if (game.u.flying)
            await plineWithContinuation('You fly out of hiding.');
        else {
            await plineWithContinuation(`You drop to the ${surfaceName(game.u.ux, game.u.uy)}.`);
            if (isPoolAt(game.u.ux, game.u.uy) || isLavaAt(game.u.ux, game.u.uy)) {
                await applyHeroLiquidEffects();
            }
            else {
                await autopickupAtHero();
                if (!game.program_state.gameover)
                    await dotrapAt(game.u.ux, game.u.uy, {
                        finishTeleport: finishTeleportArrival, gotoLevel, tookPlunge: true,
                    });
            }
        }
        game.context.move = 1;
        return true;
    }
    if (await monsterPreventsStairTravel(false))
        return false;
    const stairs = stairwayAt(game, game.u.ux, game.u.uy);
    if (!stairs || stairs.up !== false) {
        const pit = level.traps.find(trap => trap.tx === game.u.ux && trap.ty === game.u.uy
            && (trap.ttyp === PIT || trap.ttyp === SPIKED_PIT) && trap.tseen
            && !(game.u.utrap && game.u.utraptype === TT_PIT));
        if (pit) {
            await dotrapAt(game.u.ux, game.u.uy, { gotoLevel, tookPlunge: true });
            game.context.move = 1;
            return true;
        }
        const hole = level.traps.find(trap => trap.tx === game.u.ux && trap.ty === game.u.uy
            && (trap.ttyp === HOLE || trap.ttyp === TRAPDOOR) && trap.tseen);
        if (hole) {
            const result = await dotrapAt(game.u.ux, game.u.uy, { gotoLevel, tookPlunge: true });
            if (result.died)
                return false;
            game.context.move = 1;
            return true;
        }
        const pick = game.uwep || game.u.uwep;
        if (game.flags.autodig && !game.context.nopick && pick && isPick(pick)) {
            const result = await applyPickAxeDirection(pick, {
                state: game,
                attackMonster: (target, struckAt, permission) => do_attack(target, struckAt.x, struckAt.y, { permission }),
                payShopkeeper: dopay,
            });
            game.context.move = result.spentTime ? 1 : 0;
            return result.spentTime;
        }
        const vibratingSquare = level.traps.some(trap => trap.tx === game.u.ux && trap.ty === game.u.uy && trap.ttyp === VIBRATING_SQUARE);
        await plineWithContinuation(`You can't go down here${vibratingSquare ? ' yet' : ''}.`);
        game.context.move = 0;
        return false;
    }
    if (Is_valley(game.u.uz) && !game.u.uevent?.gehennom_entered) {
        await plineWithContinuation('You are standing at the gate to Gehennom.');
        await plineWithContinuation('Unspeakable cruelty and harm lurk down there.');
        if (await promptYesNo('Are you sure you want to enter?') !== 'y') {
            game.context.move = 0;
            return false;
        }
        await plineWithContinuation('So be it.');
        const events = game.u.uevent ?? (game.u.uevent = {});
        events.gehennom_entered = 1;
    }
    if (!await bringLeashedFollowers()) {
        await plineWithContinuation('You are held back by your pet!');
        game.context.move = 0;
        return false;
    }
    const changed = await next_level(stairs, gotoLevel);
    if (changed !== false)
        game.context.move = 1;
    return changed !== false;
}
// C do.c:doup(). The '<' command: set_move_cmd() first, then the pit climb,
// the missing-stairway refusal, and the climb admission checks in C's
// order. dungeon.ts's prev_level() owns the destination, including its
// escape ending from dungeon 0 level 1.
export async function doup() {
    const level = requireGameLevel();
    requireInitializedHero(game.u);
    game.u.dx = game.u.dy = 0;
    game.u.dz = -1;
    if (game.iflags.menu_requested)
        game.context.nopick = true;
    game.context.travel = game.context.travel1 = false;
    // C hack.c:u_rooted(): the "You are rooted" refusal, inlined as in dodown().
    if (MONSTER_MOVE[game.u.umonnum] === 0) {
        const where = propertyIsActive('levitation', game) || Is_airlevel(game.u.uz)
            || Is_waterlevel(game.u.uz) ? 'in place' : 'to the ground';
        await plineWithContinuation(`You are rooted ${where}.`);
        endVoluntaryMultiTurn(game);
        game.context.move = 1;
        return false;
    }
    // "up" to get out of a pit.
    if (game.u.utrap && game.u.utraptype === TT_PIT) {
        await climbOutOfPit();
        game.context.move = 1;
        return true;
    }
    const stairs = stairwayAt(game, game.u.ux, game.u.uy);
    if (!stairs || stairs.up !== true) {
        await plineWithContinuation("You can't go up here.");
        game.context.move = 0;
        return false;
    }
    if (await stuckSteed(true, game)) {
        game.context.move = 0;
        return false;
    }
    if (await monsterPreventsStairTravel(true))
        return false;
    if (nearCapacity(game) > SLT_ENCUMBER) {
        await plineWithContinuation(`Your load is too heavy to climb the ${level.requireAt(game.u.ux, game.u.uy).typ === STAIRS ? 'stairs' : 'ladder'}.`);
        game.context.move = 1;
        return false;
    }
    if (ledgerNo(game.u.uz) === 1
        && await promptYesNo('Beware, there will be no return!  Still climb?') !== 'y') {
        game.context.move = 0;
        return false;
    }
    if (!await bringLeashedFollowers()) {
        await plineWithContinuation('You are held back by your pet!');
        game.context.move = 0;
        return false;
    }
    const changed = await prev_level(stairs, gotoLevel);
    if (changed === 'escaped') {
        game.context.move = 1;
        return true;
    }
    if (changed !== false)
        game.context.move = 1;
    return changed !== false;
}
// C do.c:save_currentstate(): the INSURANCE checkpoint after arrival.
// The port has no level files: the flags.checkpoint path re-checkpoints
// the level's engravings (savelev's checkpointed half), and the non-level
// state that savestateinlock() writes goes through the normal save path.
export async function saveCurrentState() {
    if (game.flags.checkpoint ?? true)
        rewindEngravingsForSave(game.level);
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
// C do.c:familiar_level_msg(): the bones deja-vu choice, the arrival's
// first random call.  bones_include_name() matches through the hero
// name's trailing hyphen.
async function familiarLevelMsg() {
    if (!requireGameLevel().bonesInfo?.some(entry => entry.who.startsWith(`${game.plname}-`)))
        return;
    const perception = heroIsBlind(game) ? 'seems' : 'looks';
    const messages = heroIsHallucinating(game) ? [
        `Whoa!  Everything ${perception} different.`,
        'You are surrounded by twisty little passages, all alike.',
        `Gee, this ${perception} like uncle Conan's place...`,
        '',
    ] : [
        'You have a sense of deja vu.',
        "You feel like you've been here before.",
        `This place ${perception} familiar...`,
        '',
    ];
    const message = messages[rn2(4)] ?? '';
    if (message)
        await pline(message);
}
// C do.c:goto_level(): departure, destination creation or restoration, and
// arrival.  C's arrival placement and its transit messages (do.c:1715-1841)
// are inline below in C's order, as is the getlev/savelev modeling around
// the level cache; the four arrival-message helpers around the body are
// separate C functions further down.
export async function gotoLevel(targetDepth, { arrival = 'random', ladder = false, postMessage = '', } = {}) {
    requirePlayingGame(game);
    // C do.c:schedule_goto()/deferred_goto() carry the post-arrival line in
    // gd.dfr_post_msg; the port keeps it beside this call until
    // maybe_lvltport_feedback() or the tail below delivers it.
    const deferredPostMessage = { text: postMessage };
    const oldDepth = { ...game.u.uz };
    const wasInsideWizardTower = insideWizardTower(game.u.ux, game.u.uy);
    const destinationDepth = { ...oldDepth, ...targetDepth };
    // C do.c:1489: 'up' compares the requested destination before the
    // Amulet's mysterious force can redirect it deeper.
    const climbingUp = dungeonDepth(destinationDepth.dnum, destinationDepth.dlevel)
        < dungeonDepth(oldDepth.dnum, oldDepth.dlevel);
    const tutorialDnum = game.specialLevels?.get('tut-1')?.dnum;
    const leavingTutorial = tutorialDnum !== undefined && Number.isInteger(tutorialDnum)
        && oldDepth.dnum === tutorialDnum && destinationDepth.dnum !== tutorialDnum;
    if (oldDepth.dnum !== destinationDepth.dnum) {
        if (leavingTutorial)
            await currentLuaLifecycle().changeTutorialMode(game, false);
        else if (destinationDepth.dnum === tutorialDnum)
            await currentLuaLifecycle().changeTutorialMode(game, true);
    }
    // C goto_level() escapes before saving the old level or changing u.uz.
    if (destinationDepth.dnum === 0 && destinationDepth.dlevel <= 0) {
        await finishLivingGame('escaped');
        return true;
    }
    // C do.c:goto_level() silently returns when a forced Wizard-menu
    // destination is the level already occupied.  The tty menu still closes
    // and exposes a fresh map, but no level cache, actor migration, arrival
    // coordinate, or materialization message is allowed to run.
    if (destinationDepth.dnum === oldDepth.dnum
        && destinationDepth.dlevel === oldDepth.dlevel) {
        game._pending_message = '';
        game._retained_message = '';
        await docrt();
        await bot();
        return false;
    }
    // C do.c:1541-1573: with the Amulet, a Gehennom ascent can be pushed
    // back down by a mysterious force.  The chance drops as it kicks in
    // (context.mysteryforce), and the bias runs from chaotic (mildest) to
    // lawful (harshest).  A hero inside the Wizard's tower stays inside it.
    // The redirected arrival is a random spot, not stairs, and keeps the
    // original up-arrival flag for u_on_rndspot().
    const departingDungeon = game.dungeons[oldDepth.dnum];
    if (departingDungeon?.flags?.hellish
        && climbingUp && game.u.uhave?.amulet
        && destinationDepth.dnum === oldDepth.dnum
        && arrival !== 'portal'
        && oldDepth.dlevel < departingDungeon.num_dunlevs - 3
        && rn2(4 + (game.context.mysteryforce ?? 0)) === 0) {
        const odds = 3 + game.u.ualign.type; /* 2..4 */
        let diff = odds <= 1 ? 0 : rn2(odds);
        if (diff !== 0) {
            // C assign_rnd_level(): one level below plus rnd(diff), clamped
            // to the dungeon's bounds.
            destinationDepth.dlevel = Math.max(1, Math.min(departingDungeon.num_dunlevs, oldDepth.dlevel + rnd(diff)));
            diff = destinationDepth.dlevel - oldDepth.dlevel;
            if (wasInsideWizardTower
                && !wizardTowerLevelAt(destinationDepth.dnum, destinationDepth.dlevel))
                diff = 0;
        }
        if (diff === 0)
            destinationDepth.dlevel = oldDepth.dlevel;
        await pline('A mysterious force momentarily surrounds you...');
        game.context.mysteryforce = (game.context.mysteryforce ?? 0) + rn2(diff + 2);
        if (destinationDepth.dlevel === oldDepth.dlevel) {
            await safe_teleds();
            await bringLeashedFollowers(game);
            return true;
        }
        arrival = 'random';
        ladder = false;
    }
    // C do.c:goto_level() applies the quest-start admission gate after the
    // destination has been resolved but before savelev()/mklev().  Wizard
    // menu force_dest bypasses level_tele() validation, not this transition
    // guard.  A same-level menu choice has already returned above; an actual
    // same-dungeon transition without permission is rejected without
    // destination-generation RNG.
    if (onQuestStart(game)
        && destinationDepth.dnum === oldDepth.dnum
        && !okToQuest(game)) {
        await pline('A mysterious force prevents you from descending.');
        return false;
    }
    await currentLuaLifecycle().runCallbacks(game, 'level_leave');
    // C do.c:1594: a buried-ball tether converts back to ordinary
    // punishment before the departing level is saved and left behind.
    if (game.u.utrap && game.u.utraptype === TT_BURIEDBALL)
        await buriedBallToPunishment(game);
    resetTrapSetting();
    maybeResetPick(null);
    if (arrival === 'falling')
        await impactDrop(null, game.u.ux, game.u.uy, {
            destinationLevel: destinationDepth.dlevel, publish: plineWithContinuation,
        });
    await checkSpecialRoom({ newLevel: true });
    // Travel coordinates belong to the level being left.
    game._travelTarget = null;
    const oldLevel = game.level;
    const oldStairs = game.stairs;
    const previousTemperature = oldLevel?.flags?.temperature || 0;
    // C do.c:goto_level() unplaces punishment before savelev(), retaining
    // object identity while removing both objects from the departing floor.
    // placebc() installs them on the destination after hero placement.
    if (heroIsPunished())
        await unplaceBallAndChain(game);
    await resetUtrap(false, game);
    setHeroGrip(null);
    game.u.uinwater = 0;
    game.u.uundetected = false;
    const followers = game.iflags.nofollowers ? [] : await collectLevelFollowers(game);
    if (game.program_state.gameover)
        return true;
    recordMappedOverviewState();
    // Losing sight of this level can use display randomness while the hero
    // hallucinates. Do it before generating the destination.
    await vision_recalc(2);
    if (leavingTutorial || (oldDepth.dnum !== destinationDepth.dnum
        && In_endgame(destinationDepth)))
        discardMigrations(game);
    else
        updateMonsterLastMove(game);
    if (!game._levelCache)
        game._levelCache = new Map();
    rewindEngravingsForSave(oldLevel);
    for (const monster of oldLevel.monsters)
        if (monster.ispriest)
            forgetTempleEntry(monster);
    // C savelev() (do.c:1650) keeps the departing level's monsters,
    // stairways, used-up bill chain, hero track, and special identity.
    purgeDeadMonsters(oldLevel);
    game._levelCache.set(levelCacheKey(oldDepth), {
        level: oldLevel,
        stairs: oldStairs,
        // C savelev()/getlev() keep the used-up bill chain with its floor.
        billObjects: game.billObjects ?? [],
        heroTrack: cloneHeroTrack(),
        savedAt: game.moves ?? 0,
        // Is_special() is level data in C. JS keeps the parsed Lua identity
        // beside the map, so it must travel with the cached level rather than
        // remain whichever descriptor was generated most recently.
        activeSpecialLevel: game._activeSpecialLevel || null,
    });
    if (leavingTutorial) {
        for (const key of game._levelCache.keys()) {
            if (Number(key.split(':')[0]) === tutorialDnum)
                game._levelCache.delete(key);
        }
        const lifecycle = currentLuaLifecycle();
        const tutorialState = lifecycle.themed.get(tutorialDnum)?.state;
        lifecycle.themed.delete(tutorialDnum);
        await tutorialState?.destroy();
    }
    if (leavingTutorial)
        markOverviewUnreachable(oldDepth.dnum);
    else if (oldDepth.dnum !== destinationDepth.dnum && In_endgame(destinationDepth)) {
        for (let dnum = 0; dnum < game.dungeons.length; dnum++)
            markOverviewUnreachable(dnum);
    }
    if (arrival === 'stairs' || arrival === 'downstairs' || arrival === 'portal' || arrival === 'falling')
        recordOverviewBranch(oldDepth, destinationDepth);
    const cached = game._levelCache.get(levelCacheKey(destinationDepth));
    // goto_level() assigns the destination symbols whenever either end
    // of the transition is Rogue, discarding do_symset()'s displayed copy.
    const reassignSymbols = Is_rogue_level(oldDepth) || Is_rogue_level(destinationDepth);
    if (reassignSymbols)
        delete game.shownSymbols;
    game.u.uz0 = oldDepth;
    game.u.uz = destinationDepth;
    game.u.utolev = { ...destinationDepth };
    game.u.utotype = 0;
    const dungeon = game.dungeons[destinationDepth.dnum];
    if (!dungeon)
        throw new Error(`Destination dungeon ${destinationDepth.dnum} is not in the dungeon graph`);
    const reached = dungeon.dunlev_ureached || 0;
    dungeon.dunlev_ureached = dungeonBuildsUp(destinationDepth) && reached
        ? Math.min(reached, destinationDepth.dlevel)
        : Math.max(reached, destinationDepth.dlevel);
    if (cached) {
        game.program_state.in_getlev = true;
        try {
            game.level = cached.level;
            game.billObjects = cached.billObjects ?? [];
            restoreEngravings(cached.level);
            cached.stairs = restoreLevelChains(cached.level, cached.stairs);
            game.stairs = cached.stairs;
            game._activeSpecialLevel = cached.activeSpecialLevel || null;
            // save_adjust_levelflags()/rest_adjust_levelflags() preserve the
            // remaining stasis duration while its level is stored off-map.
            if (cached.level.flags.stasis_until !== undefined)
                cached.level.flags.stasis_until += game.moves - cached.savedAt;
            restoreLevelTimers(game);
            // C getlev() (do.c:1711) restores each resident before
            // separately arriving monsters.  Births append in the port,
            // whereas C prepends to fmon.
            const elapsed = game.moves - cached.savedAt;
            restoreLevelPetHistory(cached.level, elapsed);
            restoreObjectPetHistory(cached.billObjects ?? [], elapsed);
            restoreMonsterWormHeads(cached.level);
            for (const monster of cached.level.monsters.slice().reverse()) {
                setShopResidency(monster, false, game);
                await restoreMonsterCover(monster, game);
                if (elapsed > 0)
                    await catchUpMonster(monster, elapsed, game);
                await restoreMonsterShape(monster, game);
                if (game.program_state.gameover)
                    break;
                if (elapsed > 0 && elapsed > rnd(10))
                    await hideMonsterOnRestore(monster, game);
            }
            await restoreLevelRegions(game, game.moves - cached.savedAt);
            // getlev() redraws saved bubbles before goto_level() moves them.
            restore_waterlevel();
            // C getlev() reloads the level's saved light sources onto the
            // front of light_base (restore.c:1145), reversed from the
            // newest-first save order and ahead of the hero's carried
            // lights that never left the list.
            restoreLevelLightSources(game);
        }
        finally {
            game.program_state.in_getlev = false;
        }
        if (game.program_state.gameover)
            return true;
        oinit();
    }
    else {
        game.billObjects = [];
        // C mklev() starts with init_mapseen(): a freshly generated level
        // (bones included) joins the overview history before arrival.
        initOverviewRecord(destinationDepth, game);
        game._specialLevelPrototype = specialPrototypeAt(destinationDepth.dnum, destinationDepth.dlevel);
        await mklev();
        if (game.program_state.gameover)
            return true;
    }
    // Every arrival repaints from glyph numbers against the live symbols
    // (goto_level() → docrt()), so a cached destination re-skins under
    // whatever symbol or boulder override changed while the hero was
    // elsewhere.  Freshly generated levels carry no stale memory, and the
    // pass is idempotent there.
    reglyphSymbolSet();
    // A newly generated Rogue level has now installed its symbol identity.
    // Check the coin label before any arrival message can show the status.
    checkGoldSymbol();
    // C do.c:1715-1720 (inline in goto_level()): clear the old level's
    // line-of-sight before placement, with vision held off until docrt().
    requirePlayingGame(game);
    const atStairs = arrival === 'stairs' || arrival === 'downstairs';
    const up = dungeonDepth(game.u.uz.dnum, game.u.uz.dlevel)
        < dungeonDepth(oldDepth.dnum, oldDepth.dlevel);
    vision_reset();
    game.vision_full_recalc = 0;
    await flush_screen(-1);
    // C docrt() -> see_monsters() -> Sting_effects() can deliver the
    // materialization line mid-redraw (do.c:1849-1853).
    const beforeGlow = () => maybeLvltportFeedback(deferredPostMessage);
    try {
        if (atStairs && !In_endgame(game.u.uz)) {
            const stairs = stairway_find_from(game, oldDepth, ladder);
            if (stairs) {
                await placeHeroOnLevel(stairs.sx, stairs.sy);
                stairs.u_traversed = true;
            }
            else {
                // C do.c:goto_level(): without the return stairway, a
                // branch arrival goes straight to the special staircase
                // instead of any regular stairway in the travel direction.
                const newdungeon = game.u.uz.dnum !== oldDepth.dnum;
                if (up) {
                    if (newdungeon)
                        await u_on_sstairs(1);
                    else
                        await u_on_downstairs();
                }
                else {
                    if (newdungeon)
                        await u_on_sstairs(0);
                    else
                        await u_on_upstairs();
                }
            }
            // C do.c:1746-1811 (inline in goto_level()): the transit
            // messages for stair and ladder arrivals.
            requirePlayingGame(game);
            const flying = game.u.flying || game.flying;
            const noun = ladder ? 'ladder' : 'stairs';
            const verbose = game.flags.verbose !== false;
            if (up) {
                const greatEffort = heroIsPunished() && !(game.u.levitating || game.levitating);
                if (verbose || greatEffort)
                    await plineWithContinuation(`${greatEffort ? 'With great effort, you' : 'You'} `
                        + `${heroLocomotion('climb')} up${flying && ladder ? ' along' : ''} the ${noun}.`);
            }
            else if (game.u.dz) {
                if (flying) {
                    if (verbose)
                        await plineWithContinuation(`You fly down ${ladder ? 'along the ladder' : 'the stairs'}.`);
                }
                else if (nearCapacity(game) > 0 || heroIsPunished()
                    || game.u.fumbling || (game.u.fumblingTurns ?? 0) > 0) {
                    await plineWithContinuation(`You fall down the ${noun}.`);
                    if (heroIsPunished() && await dragBallDownStairs())
                        return true;
                    if (game.u.usteed) {
                        if ((await dismountHero(DISMOUNT_FELL)).died)
                            return true;
                    }
                    else {
                        let damage = rnd(3);
                        if (game.u.halfPhysicalDamage)
                            damage = Math.trunc((damage + 1) / 2);
                        const killer = ladder
                            ? 'falling off a ladder' : 'tumbling down a flight of stairs';
                        if (await loseHeroHp(damage, killer, { deathCause: `killed by ${killer}` }))
                            return true;
                    }
                    const touch = await selfTouchPetrifyingWeapons({
                        messageStart: 'Falling, you', publish: plineWithContinuation,
                    });
                    if (touch.died)
                        return true;
                }
                else if (verbose) {
                    await plineWithContinuation(ladder
                        ? 'You climb down the ladder.' : 'You descend the stairs.');
                }
            }
        }
        else if (arrival === 'portal' && !In_endgame(game.u.uz)) {
            const portal = game.level.traps.find(trap => trap.ttyp === MAGIC_PORTAL);
            if (portal) {
                await seeTrap(portal);
                await placeHeroOnLevel(portal.tx, portal.ty);
            }
            else
                await u_on_rndspot(game.level.downTeleportRegion);
        }
        else {
            if (wasInsideWizardTower && levelIsWizardTower())
                await u_on_rndspot(game._activeSpecialLevel?.downTeleportExclude);
            else {
                // C goto_level() computes 'up' from the requested
                // destination before the Amulet's mysterious force can
                // redirect the hero deeper; u_on_rndspot() still sees the
                // stale upward flag.
                await u_on_rndspot(climbingUp
                    ? game.level.upTeleportRegion : game.level.downTeleportRegion, climbingUp);
            }
            if (arrival === 'falling') {
                if (heroIsPunished() && await fallWithIronBall())
                    return true;
                const contact = await selfTouchPetrifyingWeapons({
                    messageStart: 'Falling, you', publish: plineWithContinuation,
                });
                if (contact.died)
                    return true;
            }
        }
        if (heroIsPunished())
            await placeBallAndChain();
        // C's early obj_delivery(FALSE) lands trap-door objects that fell
        // with the hero before followers and migrating monsters arrive.
        await deliverMigratingObjects(game, { nearHero: true, publish: plineWithContinuation });
        await deliverMigratingMonsters(game, followers);
        if (game.program_state.gameover)
            return true;
        const removal = await killGenocidedMonsters();
        if (removal.heroDied)
            return true;
        await runDueTimers();
        if (game.program_state?.gameover)
            return true;
        await resolveHeroArrivalCollision();
        if (Is_airlevel(game.u.uz) || Is_waterlevel(game.u.uz))
            await movebubbles();
        else if (game.level.flags.fumaroles)
            await fumaroles(game);
        vision_reset_new_level();
        // C do.c:1839 keeps notices blocked from this redraw until
        // gotoLevel() has delivered all the level's arrival messages.
        blockMonsterNotices(game);
        await docrt({ beforeGlow });
    }
    finally {
        if (game.program_state?.gameover)
            game._mapFlushPaused = false;
        else
            await flush_screen(-1);
    }
    const newDepth = { ...game.u.uz };
    // Each level saves the hero's trail. Bones loading already restores it;
    // otherwise use the cached trail or start an empty one.
    if (!game._restoredBones)
        game._heroTrack = cloneHeroTrack(cached?.heroTrack || []);
    game._tutorialActive = Number.isInteger(tutorialDnum)
        && destinationDepth.dnum === tutorialDnum;
    const oldDungeon = game.dungeons?.[oldDepth.dnum ?? 0];
    const newDungeon = game.dungeons?.[newDepth.dnum ?? 0];
    recordDungeonEntryAchievements(game, oldDepth, newDepth, { newLevel: !cached });
    const enteredValley = !oldDungeon?.flags?.hellish
        && !!newDungeon?.flags?.hellish
        && game.valley_level
        && newDepth.dnum === game.valley_level.dnum
        && newDepth.dlevel === game.valley_level.dlevel;
    // A bones level runs the same arrival block as any other level, in
    // do.c order: maybe_lvltport_feedback() (do.c:1854), the special-level
    // message (deliver_splev_message(), do.c:1858), the Valley lines
    // (do.c:1861-1872), familiar_level_msg() (do.c:1878), and only then
    // the location branch chain ending in onquest() (do.c:1892).  The
    // special-level message never applies to a bones load: gl.lev_message
    // is transient, and the bones restore generates no level script.
    const bonesArrival = game._restoredBones;
    await maybeLvltportFeedback(deferredPostMessage);
    // deliver_splev_message() (do.c:1858): a special level announces
    // itself before the Valley and quest lines, and the pending message is
    // freed, so a later return to the level cannot repeat it.
    await deliverSpecialLevelMessages(bonesArrival ? null : game._activeSpecialLevel);
    if (enteredValley) {
        // do.c:goto_level() announces the first crossing into Gehennom
        // after the destination redraw.  Ordinary topline continuation
        // owns the acknowledgement boundaries between these lines.
        await plineWithContinuation('You arrive at the Valley of the Dead...');
        await plineWithContinuation('The odor of burnt flesh and decay pervades the air.');
        await publishHeardMessage('groans and moans everywhere.', plineWithContinuation, game);
    }
    // do.c:1874-1876: reaching Gehennom by any route that bypassed the
    // Valley's stairway down counts as entering it.  Landing on the Valley
    // itself leaves the event unset, so its gate can still ask.
    if (In_hell(newDepth) && !Is_valley(newDepth)) {
        const events = game.u.uevent ?? (game.u.uevent = {});
        events.gehennom_entered = 1;
    }
    if (bonesArrival) {
        await familiarLevelMsg();
        game._restoredBones = false;
    }
    // do.c:goto_level() runs the location branch chain (do.c:1881-1933)
    // after every line above.  Quest text preparation loads quest.lua,
    // exactly behind the arrival lines in C, so keep it behind them here
    // too; the wizard forced-destination teleport suppresses the summons
    // when the previous level was inside the Quest (In_quest(&u.uz0)).
    const questArrival = await prepareQuestArrival({
        fromDepth: oldDepth,
    });
    const questPortalCall = await prepareMainQuestPortalCall({
        fromDepth: oldDepth,
    });
    if (questArrival) {
        await displayPreparedQuestArrival(questArrival);
        if (questArrival.page) {
            // A quest page replaces the earlier teleport message.
            game._pending_message = '';
            game._retained_message = '';
        }
    }
    // do.c:1893-1904: the Knox alarm (the chain branch after In_quest()).
    // The alarm stops working once Croesus has died.
    if (Is_knox_level(newDepth)
        && (!cached || !monsterDeathCount(MONSTER_NAME.indexOf('Croesus')))) {
        await plineWithContinuation('You have penetrated a high security area!');
        await plineWithContinuation('An alarm sounds!');
        for (const monster of game.level.monsters)
            if (!monster.dead && monster.mhp > 0)
                monster.msleeping = 0;
    }
    // do.c:1912-1913: the chain's else branch announces a newly generated
    // Rogue floor after level-teleport feedback.  tty continuation
    // therefore suspends on the materialization line and exposes the
    // classic Rogue map before installing this second line.
    if (!cached && Is_rogue_level(newDepth)) {
        await plineWithContinuation('You enter what seems to be an older, more primitive world.');
    }
    // do.c:1918-1931: the quest leader's summons at the Quest entrance.
    if (questPortalCall) {
        for (const line of questPortalCall)
            await plineWithContinuation(line);
    }
    const enteredEndgame = oldDepth.dnum !== newDepth.dnum
        && In_endgame(newDepth);
    if (enteredEndgame)
        recordAchievement(game, ACH_ENDG);
    if (!cached && Is_astralevel(newDepth)) {
        await finishAstralArrival();
        recordAchievement(game, ACH_ASTR);
    }
    else if (enteredEndgame && game.u?.uhave?.amulet)
        await resurrectWizard();
    await temperatureChangeMsg(previousTemperature);
    if (!cached) {
        // do.c:goto_level() logs the livelog "entered <level>" line after
        // any temperature message and before the Tourist level bonus.
        // describe_level(dloc, 2): "level N, the <branch>", Knox and the
        // endgame planes keep their own full names.
        let location;
        let withBranch = true;
        if (Is_knox_level(newDepth)) {
            location = newDungeon?.dname ?? '';
            withBranch = false;
        }
        else if (In_quest(newDepth)) {
            location = `Home ${newDepth.dlevel}`;
        }
        else if (In_endgame(newDepth)) {
            location = endgameLevelName(newDepth);
            withBranch = false;
        }
        else {
            location = `level ${depth(newDepth)}`;
        }
        if (withBranch && newDungeon)
            location += `, ${newDungeon.dname.replace(/^The /, 'the ')}`;
        recordGameLogEvent(`entered ${location}`, {
            flags: (In_endgame(newDepth) && !Is_astralevel(newDepth)) || In_quest(newDepth)
                ? LL_ACHIEVE : LL_DEBUG,
        });
    }
    // do.c:1961-1964 (inline in goto_level()): the Tourist experience
    // bonus for a newly entered level.
    if (!cached && game.urole?.key === 'tourist') {
        addExperience(level_difficulty(), 0);
        await checkExperienceLevel();
    }
    // do.c:1967: goto_level() resets u.uz0 to the arrival level before the
    // annotation, room entry, object delivery, fall damage, and pickup, so
    // a death during those steps still ends on the level the hero arrived
    // on (stair-tumble deaths earlier in the arrival keep the old level,
    // exactly as in C where they precede this reset).
    game.u.uz0 = { ...game.u.uz };
    await saveCurrentState();
    // C do.c:1971-1972: goto_level() has closed its notice window by here,
    // after every arrival message and the Tourist experience bonus, and
    // announces the new level's monsters just before the annotation.
    await unblockMonsterNotices(game);
    await noticeAllMonsters(game);
    const levelAnnotation = game._levelAnnotations?.get?.(`${newDepth.dnum}:${newDepth.dlevel}`);
    if (levelAnnotation) {
        await pline(`You remember this level as ${levelAnnotation}.`);
    }
    // The old-level exit cleared room membership before the map switch.
    await checkSpecialRoom();
    // C's late obj_delivery(TRUE) handles every object not traveling with
    // the hero (its !near_hero ^ MIGR_WITH_HERO test is inverted).
    await deliverMigratingObjects(game);
    updateHeroRegions(game);
    if (cached)
        await fixShopDamage(game);
    if (arrival === 'falling') {
        const distance = dungeonDepth(newDepth.dnum, newDepth.dlevel)
            - dungeonDepth(oldDepth.dnum, oldDepth.dlevel);
        let damage = d(Math.max(distance, 1), 6);
        if (game.u.halfPhysicalDamage)
            damage = Math.trunc((damage + 1) / 2);
        if (await loseHeroHp(damage, 'falling down a mine shaft', {
            deathCause: 'killed by falling down a mine shaft',
        }))
            return true;
    }
    await autopickupAtHero();
    if (game.program_state?.gameover)
        return true;
    // deferred_goto() prints a deferred message that is not the
    // materialization line only after goto_level() has finished
    // (do.c:2096), so it lands after the arrival, temperature, and
    // annotation messages above.  C never reaches that print when the
    // arrival pickup killed the hero: done() does not return, so the
    // game-over check above comes first.
    if (deferredPostMessage.text) {
        await plineWithContinuation(deferredPostMessage.text);
        deferredPostMessage.text = '';
    }
    return true;
}
// C do.c:hellish_smoke_mesg(): the hot-or-cold and smoke lines a Gehennom
// level other than the Valley prints on arrival (and on restore).
async function hellishSmokeMesg() {
    const temperature = game.level?.flags?.temperature || 0;
    if (temperature)
        await plineWithContinuation(`It is ${temperature > 0 ? 'hot' : 'cold'} here.`);
    if (In_hell(game.u.uz) && temperature > 0)
        await plineWithContinuation(`You ${heroHasOlfaction() ? 'smell' : 'sense'} smoke...`);
}
// C do.c:temperature_change_msg().  prev_temperature is the departed
// level's; In_hell(&u.uz0) still names the departed dungeon here because
// goto_level() resets u.uz0 only after this message (do.c:1967).
async function temperatureChangeMsg(prevTemperature) {
    const temperature = game.level?.flags?.temperature || 0;
    if (temperature === prevTemperature)
        return;
    if (temperature) {
        await hellishSmokeMesg();
        return;
    }
    if (prevTemperature > 0) {
        await plineWithContinuation(`The heat${In_hell(game.u.uz0) ? ' and smoke are' : ' is'} gone.`);
        return;
    }
    if (prevTemperature < 0)
        await plineWithContinuation('You are out of the cold.');
}
// C do.c:maybe_lvltport_feedback(): the deferred "You materialize" line,
// delivered ahead of every arrival message unless Sting's glow warning
// already published it during the destination redraw.  Any other deferred
// message waits for deferred_goto() after goto_level() returns.
async function maybeLvltportFeedback(deferred) {
    if (deferred.text.slice(0, 15).toLowerCase() !== 'you materialize')
        return;
    const message = deferred.text;
    deferred.text = '';
    await plineWithContinuation(message);
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
// C do.c:schedule_goto(). The current command or monster finishes using
// the departure level; utotype stops the next monster from moving.
export function scheduleLevelChange(args, changeLevel = gotoLevel, preMessage = '') {
    requirePlayingGame(game);
    game._scheduledLevelChange = { args, changeLevel, preMessage };
    game.u.utolev = { ...game.u.uz, ...args[0] };
    const arrival = args[1]?.arrival;
    game.u.utotype = UTOTYPE_DEFERRED
        | (arrival === 'stairs' || arrival === 'downstairs' ? UTOTYPE_ATSTAIRS : 0)
        | (arrival === 'falling' ? UTOTYPE_FALLING : 0)
        | (arrival === 'portal' ? UTOTYPE_PORTAL : 0);
}
// C saves u.utolev/utotype, but neither callback pointers nor deferred
// messages. Rebuild the pending arrival so the normal turn loop completes it.
export function restoreScheduledLevelChange() {
    delete game._scheduledLevelChange;
    const destination = game.u.utolev;
    const type = game.u.utotype ?? 0;
    if (!(type & UTOTYPE_DEFERRED) || !destination)
        return;
    game._scheduledLevelChange = {
        args: [{ ...destination }, { arrival: restoredLevelArrival(type) }],
        changeLevel: gotoLevel,
        preMessage: '',
    };
}
// C do.c:deferred_goto(). The topline is preserved when travel stays here.
export async function finishScheduledLevelChange() {
    const travel = game._scheduledLevelChange;
    if (!travel)
        return;
    requirePlayingGame(game);
    const destination = game.u.utolev;
    if (!destination)
        throw new Error('Scheduled level travel has no destination');
    const removePortal = !!((game.u.utotype ?? 0) & UTOTYPE_RMPORTAL);
    delete game._scheduledLevelChange;
    if (game.u.uz.dnum !== destination.dnum
        || game.u.uz.dlevel !== destination.dlevel) {
        if (travel.preMessage)
            await plineWithContinuation(travel.preMessage);
        await travel.changeLevel(...travel.args);
        if (removePortal) {
            const portal = game.level.traps.find(trap => trap.tx === game.u.ux && trap.ty === game.u.uy);
            if (portal) {
                deleteTrap(portal, game);
                await newsym(game.u.ux, game.u.uy);
            }
        }
    }
    game.u.utotype = 0;
}
function restoredLevelArrival(type) {
    if (type & UTOTYPE_PORTAL)
        return 'portal';
    if (type & UTOTYPE_FALLING)
        return 'falling';
    return type & UTOTYPE_ATSTAIRS ? 'stairs' : 'random';
}
// The port's level files: savelev()/getlev() keyed by ledger number.
function levelCacheKey(depth) {
    return `${depth?.dnum ?? 0}:${depth?.dlevel ?? 1}`;
}
function cloneHeroTrack(track = game._heroTrack) {
    return (track || []).map(point => ({ x: point.x, y: point.y }));
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
// Part of C pline.c:Norep(): the repeated-message check for a preformatted string.
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
// C do.c:wipeoff(): one occupation turn of wiping; the first turn can
// clear the blinding cream, and a following turn handles the remaining
// blindness through make_blinded().
export async function continueWipingFace(occupation, state = game) {
    occupation.remaining--;
    const creamRemoved = Math.min(4, state.u?.ucreamed ?? 0);
    const blindnessRemoved = Math.min(4, state.u?.blindTurns ?? 0);
    state.u.ucreamed = Math.max(0, (state.u?.ucreamed ?? 0) - creamRemoved);
    state.u.blindTurns = Math.max(0, (state.u?.blindTurns ?? 0) - blindnessRemoved);
    if ((state.u?.blindTurns ?? 0) === 0) {
        await pline("You've got the glop off.");
        state.u.ucreamed = 0;
        const gulp = await gulp_blnd_check({ state, publish: plineWithContinuation });
        if (!gulp.triggered && !gulp.died) {
            setHeroBlindnessTimeout(1, state);
            await makeBlinded(0, { state, publish: plineWithContinuation });
        }
        state._occupation = null;
    }
    else if ((state.u?.ucreamed ?? 0) === 0) {
        await pline(`Your ${body_part(FACE, state)} feels clean now.`);
        state._occupation = null;
    }
    else if (occupation.remaining <= 0) {
        occupation.remaining = 1;
    }
    state.context.move = 1;
    return true;
}
// C do.c:dowipe().  Starting the command and cleaning one turn are separate
// because monsters and timed effects act between occupation turns.
export async function dowipe(state = game) {
    if ((state.u?.ucreamed ?? 0) > 0) {
        state._occupation = {
            key: 'wipe-face',
            remaining: 1,
            text: `wiping off your ${body_part(FACE, state)}`,
        };
        state.context.move = 1;
        return;
    }
    await pline(`Your ${body_part(FACE, state)} is already clean.`);
    state.context.move = 1;
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
        const leg = body_part(LEG, state);
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
// C do.c:flooreffects() calls hmon(HMON_THROWN, 1) on a boulder settling
// into a pit, without thitmonst()'s accuracy, Dexterity exercise, missile
// mulch, or thrown-object passive work.
export async function hitMonsterWithSettlingBoulder(monster, boulder, { state = game, publish = plineWithContinuation, } = {}) {
    const hit = await hitMonsterWithHeroObject(monster, boulder, {
        state, publish, mode: 'thrown', dieRoll: 1,
    });
    return { heroDied: hit.heroDied };
}
function ignoresFallingBoulder(mnum) {
    return monsterPassesWalls(mnum) || monsterThrowsRocks(mnum);
}
// C do.c:revive_corpse().
export async function reviveCorpseImmediately(corpse, state = game, { announce = true } = {}) {
    if (!corpse)
        return null;
    const wasWielded = state.uwep === corpse;
    const event = await revive(corpse, state);
    if (event.kind === 'revived' && announce) {
        requireCorpseSpecies(event.corpse);
        const corpse = event.corpse, monster = event.monster, location = event.location;
        let message = null;
        switch (event.originalWhere) {
            case 'inventory':
                message = wasWielded
                    ? `The ${corpseObjectName(corpse, { singular: true,
                        adjective: corpse.oeaten ? 'bite-covered' : '' })} writhes out of your grasp!`
                    : 'You feel squirming in your backpack!';
                break;
            case 'floor': {
                if (!cansee(location.x, location.y) && !canSeeMonster(monster))
                    break;
                if (!canSeeMonster(monster)) {
                    message = `${capitalizedDefiniteName(corpseObjectName(corpse, { singular: true,
                        adjective: corpse.oeaten ? 'bite-covered' : '' }), state)} disappears!`;
                    break;
                }
                const effects = new Map([
                    [311, ' in a whirl of spectral skulls'],
                    [312, ' in a churning pillar of flies'],
                    [313, ' in a ring of withered crops'],
                ]);
                const subject = monsterName(monster, { state, capitalized: true,
                    adjective: corpse.oeaten ? 'bite-covered' : '' });
                message = `${subject} rises from the dead${effects.get(monster.mnum) || ''}!`;
                break;
            }
            case 'minvent': {
                if (!cansee(monster.mx, monster.my))
                    break;
                const carrier = location.monsterCarrier;
                if (carrier && canSeeMonster(carrier)) {
                    const result = canSpotMonster(monster) ? 'revives' : 'disappears';
                    message = `Startled, ${monsterName(carrier, { state })} drops ${withIndefiniteArticle(corpseObjectName(corpse, { singular: true,
                        adjective: corpse.oeaten ? 'bite-covered' : '' }))} as it ${result}!`;
                }
                else if (canSpotMonster(monster)) {
                    message = `${monsterName(monster, { state, capitalized: true,
                        adjective: corpse.oeaten ? 'bite-covered' : '' })} suddenly appears!`;
                }
                break;
            }
            case 'contained': {
                if (!isContainerLocation(location))
                    break;
                const container = location.directContainer, outer = location.outer;
                const revived = canSpotMonster(monster)
                    ? monsterName(monster, { state, article: 'a', capitalized: true }) : 'Something';
                if (location.monsterCarrier && canSeeMonster(location.monsterCarrier)) {
                    message = `${revived} writhes out of ${ownedObjectName(container, state, { capitalized: false })}!`;
                }
                else if (outer.where === 'inventory') {
                    const description = withIndefiniteArticle(objectCombatName(container, { state, includeCorpseSpecies: false }));
                    message = `${revived} writhes out of ${description} in your pack!`;
                }
                else if (outer.where === 'floor' && cansee(location.x, location.y)) {
                    const description = withIndefiniteArticle(objectCombatName(container, { state, includeCorpseSpecies: false }));
                    message = `${revived} escapes from ${description}!`;
                }
                break;
            }
            case 'buried':
            case 'free':
            case 'gone':
            case 'migrating':
            case 'onbill':
                break;
        }
        if (message)
            event.messages.push(message);
    }
    await finishBuriedRevival(event, state);
    return event;
}
// Claimed timers have already been removed from the object timer chain.
export async function runClaimedCorpseRevivalTimer(claimed, state = game, currentTurn = state.moves ?? 0) {
    const corpse = claimed?.object;
    const timerKind = claimed?.timer?.kind;
    if (!corpse || (timerKind !== OBJECT_TIMER_KIND.REVIVE_MON
        && timerKind !== OBJECT_TIMER_KIND.ZOMBIFY_MON))
        return null;
    requireCorpseSpecies(corpse);
    return timerKind === OBJECT_TIMER_KIND.ZOMBIFY_MON
        ? zombifyMon(corpse, state, currentTurn) : reviveMon(corpse, state, currentTurn);
}
// C do.c:revive_mon().
async function reviveMon(corpse, state, currentTurn) {
    if (monsterIsDisplacer(corpse.corpsenm) && corpse.where === 'floor') {
        const level = requireGameLevel(state);
        if ((level.flags.stasis_until ?? 0) < currentTurn) {
            const occupant = monsterAtPosition(level, corpse.ox, corpse.oy);
            if (occupant) {
                const wasVisible = canSeeMonster(occupant);
                const name = monsterName(occupant, { capitalized: true, state });
                if (await randomMonsterRelocation(occupant, { state, flags: RLOC_NOMSG })) {
                    const nowVisible = canSeeMonster(occupant);
                    if (wasVisible && !nowVisible) {
                        await plineWithContinuation(`${name} vanishes.`);
                    }
                    else if (!wasVisible && nowVisible) {
                        const currentName = monsterName(occupant, { capitalized: true, state });
                        await plineWithContinuation(`${currentName} appears.`);
                    }
                    else if (wasVisible) {
                        const dx = occupant.mx - corpse.ox;
                        const dy = occupant.my - corpse.oy;
                        if (dx * dx + dy * dy > 2)
                            await plineWithContinuation(`${name} teleports.`);
                    }
                }
            }
        }
    }
    const event = await reviveCorpseImmediately(corpse, state);
    if (!event)
        throw new Error('A claimed revival timer requires a corpse.');
    if (event.kind === 'revived')
        return event;
    for (const message of event.messages)
        await plineWithContinuation(message);
    let kind;
    let delay;
    if (isRider(corpse.corpsenm) && rn2(99)) {
        kind = OBJECT_TIMER_KIND.REVIVE_MON;
        delay = riderRevivalTime(corpse, true);
    }
    else {
        kind = OBJECT_TIMER_KIND.ROT_CORPSE;
        if (!objectTimers(corpse).some(timer => timer.kind === kind)) {
            await plineWithContinuation(`You feel ${isRider(corpse.corpsenm) ? 'much ' : ''}less hassled.`);
        }
        delay = Math.max(1, d(5, 50) - (currentTurn - (corpse.age ?? currentTurn)));
    }
    if (!objectTimers(corpse).some(timer => timer.kind === kind)) {
        scheduleObjectTimer(corpse, kind, currentTurn + delay, state);
    }
    const retry = { kind, delay };
    return { kind: 'failed', corpse, ...event, messages: [], retry };
}
// C do.c:zombify_mon().
async function zombifyMon(corpse, state, currentTurn) {
    const target = zombieForm(corpse.corpsenm);
    if (target == null || ((state.mvitals?.[target]?.mvflags ?? 0) & G_GENOD)) {
        await rotCorpse(corpse, state);
        return { kind: 'rotted', corpse, monster: null, messages: [] };
    }
    if (corpse.oextra) {
        delete corpse.oextra.omid;
        delete corpse.oextra.omonst;
    }
    set_corpsenm(corpse, target);
    return reviveMon(corpse, state, currentTurn);
}
export async function finishBuriedRevival(event, state) {
    if (event.kind === 'revived' && event.buried)
        event.trap = await maketrap(event.monster.mx, event.monster.my, PIT);
}
//# sourceMappingURL=do.js.map