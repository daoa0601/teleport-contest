// Hero movement, travel, and terrain effects.
// C refs: hack.c:test_move(), findtravelpath(), lookaround(), domove(), pooleffects().
import { WEAPON_CLASS, TOOL_CLASS, FOOD_CLASS, COIN_CLASS } from './objclass.js';
import { objectBaseWeight, objectSkill, AMULET_OF_LIFE_SAVING, BOULDER, LOADSTONE, PICK_AXE, DWARVISH_MATTOCK, WAN_DIGGING, STATUE, CORPSE, LEVITATION_BOOTS, OBJECT_NAMES, HEAVY_IRON_BALL, CANDELABRUM_OF_INVOCATION, OBJECT_NUTRITION, OBJECT_DESCRIPTIONS, TALLOW_CANDLE, } from './object_data.js';
import { setHeroGrip } from './mon.js';
import { finishHeroHelplessness } from './allmain.js';
import { formatFeltMessage, formatHeardMessage, publishHeardMessage } from './hero_speech.js';
import { heroIsBlind, heroIsDeaf, heroIsHallucinating } from './senses.js';
import { BURNING, CMDQ_EXTCMD, CQ_CANNED, D_BROKEN, D_CLOSED, D_ISOPEN, D_LOCKED, D_NODOOR, D_TRAPPED, DISMOUNT_FELL, DISMOUNT_GENERIC, DISSOLVED, DROWNING, DOOR, IS_AIR, IS_OBSTRUCTED, IS_STWALL, IS_WALL, IS_WATERWALL, IS_TREE, Is_earthlevel, Is_juiblex_level, Is_waterlevel, Is_rogue_level, LAVAPOOL, LAVAWALL, Luck, MAX_TYPE, MOAT, PARANOID_SWIM, POOL, ROOM, STONE, FAINTED, M_SEEN_FIRE, TREE, TT_BEARTRAP, TT_BURIEDBALL, TT_INFLOOR, TT_LAVA, TT_PIT, TT_WEB, Upolyd, WATER, W_NONDIGGABLE, W_NONPASSWALL, W_ARTI, I_SPECIAL, TIMEOUT, NO_KILLER_PREFIX, WT_TOOMUCH_DIAGONAL, TIP_SWIM, PLNMSG_BACK_ON_GROUND, DBWALL, DB_UNDER, DB_ICE, LEVEL_TIMER_KIND, def_warnsyms, A_CON, A_DEX, A_STR, COLNO, ROWNO, SCORR, SDOOR, CORR, ICE, IRONBARS, IS_FURNITURE, M_AP_NOTHING, M_AP_FURNITURE, M_AP_OBJECT, M_AP_TYPE, MGIVENNAME, SHOPBASE, Is_airlevel, In_sokoban, In_mines, ACCESSIBLE, AIR, DIGTYP_UNDIGGABLE, DRAWBRIDGE_UP, OBJECT_TIMER_KIND, HOLE, LANDMINE, LEVEL_TELEP, MIGR_RANDOM, P_BASIC, P_RIDING, P_TWO_WEAPON_COMBAT, P_ISRESTRICTED, P_UNSKILLED, ROLLING_BOULDER_TRAP, TELEP_TRAP, TRAPDOOR, WT_SQUEEZABLE_INV, IN_SIGHT, SHOP_DOOR_COST, PARANOID_CONFIRM, PARANOID_TRAP, TRAP_EXPLANATIONS, TRAPNUM, W_QUIVER, W_SWAPWEP, SQKY_BOARD, SLP_GAS_TRAP, RUST_TRAP, BEAR_TRAP, PIT, SPIKED_PIT, MAGIC_PORTAL, VIBRATING_SQUARE, WEB, HEADSTONE, In_endgame, is_hole, is_pit, NO_ROOM, ROOMOFFSET, SHARED, SHARED_PLUS, MAXNROFROOMS, Invocation_lev, OROOM, DELPHI, TEMPLE, COURT, MORGUE, ZOO, BARRACKS, BEEHIVE, LEPREHALL, COCKNEST, ANTHOLE, THRONE, ACH_TOWN, RLOC_NOMSG, IS_SINK, KILLED_BY_AN, LL_CONDUCT, SWAMP, GP_ALLOW_U } from './const.js';
import { isok } from './cmd.js';
import { heroIsPunished, placeBallAndChain, unplaceBallAndChain, beginBallAndChainMove, finishBallAndChainMove } from './ball.js';
import { docrt, feel_newsym, newsym, under_water, updateLastSeenTerrain, feel_location, terrain_glyph, glyphAt, canSpotMonster, canSenseMonster, canSeeMonster, monsterVisible, unmap_invisible, map_object, unmapObject, map_invisible, flush_screen } from './display.js';
import { impossible } from './diagnostics.js';
import { bot } from './botl.js';
import { pline, plineWithContinuation, pline_dir, set_msg_xy } from './pline.js';
import { heroPassesWalls, heroFormSticks, heroSpecies, heroLikesLava, heroFormClings, heroHidesOnCeiling, heroIsFlying, heroHasProtectionFromShapeChangers, heroIsPolymorphed, returnHeroToHumanForm, heroIsVerySmall, heroIsAmphibious, heroMonsterForm } from './polyself.js';
import { heroHasConflict } from './hero_conflict.js';
import { cmdq_clear, cmdq_peek, currentMulti, setMulti, xyToDirection } from './cmd.js';
import { displayLiquidName, monsterName } from './do_name.js';
import { shopkeeperName } from './shknam.js';
import { beginHeroLifeSaving, completeHeroLifeSaving, finishHeroDeath, identifyLifeSavingAmulet, recordHeroKillConduct } from './end.js';
import { heroCanReachFloor } from './engrave.js';
import { heroIsUnaware } from './senses.js';
import { putHeroToSleep } from './timeout.js';
import { reset_faint, gethungry, morehungry } from './eat.js';
import { removeWornHeroItem } from './hero_equipment.js';
import { dropInventoryObjectAtHero, dropBoulderIntoLiquid } from './do.js';
import { destroyFireInventory } from './zap.js';
import { releaseAllMonsterLeashes, checkHeroLeashes } from './apply.js';
import { splitHeroMonsterForm } from './potion.js';
import { MONSTER_ATTACKS, MONSTER_BODY_META, MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_MOVE, MONSTER_NAME, MONSTER_SIZE, MONSTER_SYMBOL, requireMonsterData } from './monster_data.js';
import { ownedObjectAction, simpleObjectNameWithArticle, observeObjectForNaming, makePlural, withIndefiniteArticle, objectCombatName, objectNameIsPlural, definiteObjectAction } from './objnam.js';
import { d, rn1, rn2, rnd } from './rng.js';
import { destroyLavaInventory, markLavaInventoryForDestruction, waterDamageChain, deleteTrap, feelTrap, seeTrap, trapName, mintrap, emergencyDisrobe, announceTerrainRescue, resetUtrap, floatHeroUp, floatHeroDown, setHeroTrap, climbOutOfPit, reduceHeroTrapDuration, dotrapAt, igniteItems, captureLevitationState, backOnGroundMessage, sokobanGuilt, fillPitWithBoulderAt } from './trap.js';
import { dismountHero, steedIsGrounded, moveSteedWithHero, ridingPreventsMovement, monsterAtPosition, monsterHasMapPosition, monsterOccupiesPosition } from './steed.js';
import { isRoom } from './map_types.js';
import { gotoLevel } from './level_change.js';
import { game, requireGameLevel, requireLiveGame, requirePlayingGame } from './gstate.js';
import { armorOffMessage, destroyWornArmor, heroHasWaterWalking, heroKnowsLavaWalking, heroKnowsWaterWalking, removeHeroArmor, stopDonning, pendingArmorAction, removeHeroAccessory, objectIsHardHelmet } from './do_wear.js';
import { waterbodyName, surfaceName, ceilingName } from './terrain_name.js';
import { do_attack, prepareAppliedWeaponAttack } from './uhitm.js';
import { heroCanTeleport, heroControlsTeleport, moveHeroByTeleport, safeTeleportDestination, teleportHeroAtWill, relocateObjectRandomly, relocateMonsterTo, askTeleportDestination } from './teleport.js';
import { moveMonsterNextToHero } from './mon.js';
import { goodPosition, heroTeleportRestricted, findNearbyMonsterPosition } from './teleport_rules.js';
import { wormCrossesBetween } from './worm.js';
import { vision_recalc, vision_reset, couldsee, cansee, vision_note_blocker_change } from './vision.js';
import { levelAtDepth, recordDiscoveredRoom, levelHasCeiling, levelIsWaterLevel as heroIsOnWaterLevel } from './dungeon.js';
import { clearHeroSliming, heroIsSliming } from './potion.js';
import { isLavaAt, isPoolAt, isPoolOrLavaAt, isIceAt, drawbridgeUnderlyingType } from './dbridge.js';
import { clearLevitationMasks, hasIntrinsicProperty, hasInvokedProperty, hasWornProperty, propertyIsActive, refreshMovementProperties, refreshProperty, restoreLevitationSources, setPropertyTimeout, stashLevitationSources, propertyIsBlocked, setPropertyTerrainBlocked, levitationIsPurelyTimed, propertySourceIsActive, levitationSourceIsActive, existingPropertyRecord, hasPermanentIntrinsicProperty } from './properties.js';
import { iceDescriptionAt } from './pager.js';
import { ingSuffix, upstart, depth } from './hacklib.js';
import { objectTimers, stopObjectTimer, scheduleObjectTimer, stopLevelTimer, levelTimers } from './timeout.js';
import { resetOccupations } from './cmd.js';
import { maybeAdjustHeroBubble } from './elemental.js';
import { leaveMovementCloud, updateHeroRegions, visibleRegionAt } from './regions.js';
import { requireShopGame } from './shop_types.js';
import { finishTeleportArrival } from './location_effects.js';
import { CmapSymbol, GlyphOffset, cmapToGlyph } from './glyph_numbers.js';
import { TemporaryMapEffect } from './temporary_map_effect.js';
import { placeHeroOnLevel } from './hero_location.js';
import { hideHeroUnder, wakeMonstersNearWithMessages, maybeUnhideAt, revealMonsterAppearance, currentMonsterLoad, monsterDeathCount, resolveMonsterLiquid, finishEnvironmentalMonsterDeath, publishMonsterWake } from './mon.js';
import { hasDoorAppearance, stumbleOntoMimic } from './uhitm.js';
import { makeMonsterFlee, heroCanOoze, monsterIsScaredAt } from './monmove.js';
import { monsterPassesBars, monstersObserveHeroResistance, monsterLocomotion, monsterIsHelpless, monsterCorrodesBars, monsterHasColdResistance, cant_drown, metallivorous, monsterIsAmphibious, monsterIsBreathless, monsterIsClinger, monsterIsFlyer, monsterIsSlithy, monsterIsSwimmer, monsterPassesWalls, needspick, strongmonst, tunnels as speciesTunnels, monsterHasProperName, monsterHidesUnder, monsterIsAmorphous, monsterIsBig, monsterIsEel, monsterIsHider, monsterIsNoncorporeal, monsterIsUnsolid, monsterIsVerySmall, monsterIsWhirly, monsterThrowsRocks } from './mondata.js';
import { AT_EXPL, AT_BOOM } from './monster_attack_types.js';
import { confusePromptDirection } from './cmd.js';
import { resolveHeroCombatExplosion } from './uhitm.js';
import { artifactById, heroHasArtifactDefense, heroHasCarriedArtifactFlag } from './artifacts.js';
import { isPick, isFlimsyObject, isBlade, objectIsOrganic, objectIsRustprone } from './object_properties.js';
import { applyPickAxeDirection } from './dig.js';
import { diggingTarget, watchDigging, ensureDiggingContext, clearDiggingContext, buryFloorObjectsAt, buriedBallNear, buriedBallToPunishment } from './dig.js';
import { objectTypeKnown, tendedShop, shopkeeperBlockingDoor, shopkeeperBlockingEntry, dopay, enterShop, leaveHeroShop, shopGreeting, addShopDamage, payForShopDamage, addShopObjectToBill, billForObject, removeObjectAndContentsFromBill, shopResident, findObjectOwner, stolenValue, costlySpot } from './shk.js';
import { doopen } from './lock.js';
import { engravingAt, wipeEngravingAt } from './engrave.js';
import { heroGoldObject, heroGoldQuantity } from './hero_gold.js';
import { objectWeight, quantity, splitObjectStack, placeObject, stack_object, updateIceObjectTimersAt, remove_object } from './mkobj.js';
import { floorObjectDescription } from './invent.js';
import { selfTouchPetrifyingWeapons } from './stoning.js';
import { heroFootName } from './body_parts.js';
import { insideRoom, searchSpecial } from './mkroom.js';
import { triggerBoobyTrap } from './booby_trap.js';
import { useUpFloorObject } from './floor_consumption.js';
import { applyFloorEffects } from './floor_effects.js';
import { explodeLandMine } from './landmine_explosion.js';
import { randomTeleportDepth } from './level_teleport.js';
import { launchRollingBoulder } from './trap.js';
import { autopickupAllows, autopickupAtHero } from './pickup.js';
import { reviveCorpseImmediately } from './corpse_revival.js';
import { isRider } from './corpse_species.js';
import { intemple } from './priest.js';
import { recordAchievement } from './insight.js';
import { currentLuaLifecycle } from './lua/lifecycle.js';
import { paranoidQuery } from './cmd.js';
import { recorderLocalHour } from './calendar.js';
import { finishHeroLiquidMonsterDeath } from './hero_monster_death.js';
import { awardMonsterExperience, checkExperienceLevel } from './exper.js';
import { findMonsterArmorClass } from './monworn.js';
import { abusePet } from './dog.js';
import { applyWaterFriction } from './mkmaze.js';
import { adjustHeroAlignment } from './alignment.js';
import { damageHeroFromMonster } from './mhitu.js';
import { currentStrength, currentAttribute, exerciseAttribute } from './attrib.js';
import { freeInventoryObject } from './invent.js';
import { delobj } from './invent.js';
import { objectBreaksOnImpact } from './dothrow.js';
import { setPrimaryWeapon } from './wield.js';
import { hitIronBars, dissolveBars } from './projectile_bars.js';
import { ensureHeroSkills, useHeroSkill, weaponSkillType } from './skills.js';
import { weaponDescription } from './weapon.js';
import { recordGameLogEvent } from './gamelog.js';
// C hack.c:revive_nasty().
export async function reviveNastyAt(x, y, message = null, state = game) {
    requirePlayingGame(state);
    let revived = false;
    for (const corpse of [...state.level.objects[x]?.[y] ?? []]) {
        if (corpse.otyp !== CORPSE
            || !(isRider(corpse.corpsenm)
                || MONSTER_NAME[corpse.corpsenm ?? -1] === 'Wizard of Yendor'))
            continue;
        const occupant = monsterAtPosition(state.level, x, y);
        if (occupant)
            await moveRevivalOccupant(occupant, x, y, state);
        if (message)
            await plineWithContinuation(message, { noRepeat: true });
        const revival = await reviveCorpseImmediately(corpse, state);
        if (revival)
            for (const line of revival.messages)
                await plineWithContinuation(line);
        revived = revival?.kind === 'revived';
    }
    const monster = revived ? monsterAtPosition(state.level, x, y) : null;
    if (monster && !goodPosition(x, y, { kind: 'monster', monster }, { state }))
        await moveRevivalOccupant(monster, x, y, state);
    return revived;
}
async function moveRevivalOccupant(monster, x, y, state) {
    const position = findNearbyMonsterPosition(monster.mnum, x, y, { state });
    if (position)
        await relocateMonsterTo(monster, position.x, position.y, { state });
}
// C hack.c:moverock().  The push attempt over the destination pile, then
// moverock_done()'s cleanup: every boulder left on the starting square
// resumes normal naming once the push attempt ends.
export async function pushBouldersAt(sx, sy, dx, dy) {
    requirePlayingGame(game);
    const ret = await pushBoulders(sx, sy, dx, dy);
    moverockDone(sx, sy);
    return ret;
}
// C hack.c:moverock_done(). next_boulder aliases corpsenm in C and only
// changes push prose; resume normal xname() for every boulder left there.
function moverockDone(sx, sy) {
    for (const object of game.level?.objects[sx]?.[sy] ?? [])
        if (object.otyp === BOULDER)
            object.corpsenm = 0;
}
// C hack.c:moverock_core(): the push loop over the pile — blind checks,
// sokoban rules, monsters, doors, traps, liquid, and shop billing.
// sobj_at() is boulderAt(); doorless_door() is the rogue/broken doorway
// test in the diagonal-door rejection below.
async function pushBoulders(sx, sy, dx, dy) {
    requirePlayingGame(game);
    const level = game.level;
    const rx = sx + dx, ry = sy + dy;
    let first = true;
    for (let boulder = boulderAt(sx, sy); boulder; boulder = boulderAt(sx, sy)) {
        const glyph = glyphAt(sx, sy);
        if (heroIsBlind(game) && !(glyph?.kind === 'object' && glyph.otyp === BOULDER)) {
            await plineWithContinuation('That feels like a boulder.');
            await map_object(boulder, true);
            endVoluntaryMultiTurn(game);
            return false;
        }
        boulder.corpsenm = first ? 0 : 1;
        first = false;
        if (level.objects[sx]?.[sy]?.[0] !== boulder)
            await moveObject(boulder, sx, sy);
        endVoluntaryMultiTurn(game);
        if (game.context.nopick)
            return stepOntoBoulder(sx, sy);
        if (game.u.levitating || Is_airlevel(game.u.uz)) {
            if (heroIsBlind(game))
                await feel_location(sx, sy);
            await plineWithContinuation(`You don't have enough leverage to push the ${objectCombatName(boulder)}.`);
            return false;
        }
        if (heroIsVerySmall(game) && !game.u.usteed) {
            if (heroIsBlind(game))
                await feel_location(sx, sy);
            await plineWithContinuation(`You're too small to push that ${objectCombatName(boulder)}.`);
            return cannotPush(boulder, sx, sy);
        }
        const target = level.at(rx, ry);
        const diagonalDoor = dx && dy && target?.typ === DOOR
            && (Is_rogue_level(game.u.uz) || !!(target.doormask & ~(D_NODOOR | D_BROKEN)));
        if (!isok(rx, ry) || !target || IS_OBSTRUCTED(target.typ)
            || target.typ === IRONBARS || diagonalDoor || boulderAt(rx, ry)) {
            await cannotPushMessage(boulder, sx, sy);
            return cannotPush(boulder, sx, sy);
        }
        const trap = level.traps.find(candidate => candidate.tx === rx && candidate.ty === ry);
        const monster = monsterAtPosition(level, rx, ry);
        const costly = !!costlySpot(sx, sy)
            && !!shopResident(roomsAt(level, sx, sy, SHOPBASE)[0]);
        if (level.flags.sokoban_rules && dx && dy) {
            if (heroIsBlind(game))
                await feel_location(sx, sy);
            await plineWithContinuation(`The ${objectCombatName(boulder)} won't roll diagonally on this ${surfaceName(sx, sy)}.`);
            return cannotPush(boulder, sx, sy);
        }
        if (await reviveNastyAt(rx, ry, 'You sense movement on the other side.'))
            return false;
        if (monster && !monsterIsNoncorporeal(monster)
            && (!monster.mtrapped || !trap || !is_pit(trap.ttyp))) {
            await monsterBlocksBoulder(boulder, monster, sx, sy, rx, ry);
            return cannotPush(boulder, sx, sy);
        }
        if (target.typ === DOOR && target.doormask & (D_CLOSED | D_LOCKED)) {
            await cannotPushMessage(boulder, sx, sy);
            return cannotPush(boulder, sx, sy);
        }
        disturbBuriedZombies(sx, sy);
        const trapEffect = trap
            ? await pushIntoTrap(boulder, trap, sx, sy, rx, ry, dx, dy, costly) : 'ignored';
        if (game.program_state.gameover)
            return false;
        if (trapEffect === 'handled')
            return !boulderAt(sx, sy);
        if (trapEffect === 'push') {
            await moveBoulder(boulder, sx, sy, rx, ry, costly);
            continue;
        }
        const sank = await dropBoulderIntoLiquid(boulder, rx, ry, game, { pushing: true });
        if (game.program_state.gameover)
            return false;
        if (sank)
            continue;
        // Native relinks to the head of fobj before dopush().
        if (level.objects.some(column => column?.some(pile => pile?.some(object => (object._fobjOrder ?? 0) > (boulder._fobjOrder ?? 0))))) {
            remove_object(boulder);
            await placeObject(boulder, sx, sy);
        }
        await moveBoulder(boulder, sx, sy, rx, ry, costly);
    }
    return true;
}
// C hack.c:could_move_onto_boulder().
export function heroCouldMoveOntoBoulder(sx, sy, state = game) {
    if (heroPassesWalls(state))
        return true;
    if (state.u.usteed)
        return false;
    if (heroThrowsRocks(state)) {
        return !state.u.dx || !state.u.dy
            || !(IS_OBSTRUCTED(state.level?.at(state.u.ux, sy)?.typ ?? STONE)
                && IS_OBSTRUCTED(state.level?.at(sx, state.u.uy)?.typ ?? STONE));
    }
    return heroIsVerySmall(state) || !state.inventory.length || invWeight(state) <= -WT_SQUEEZABLE_INV;
}
function boulderAt(x, y) {
    return game.level?.objects[x]?.[y]?.find(object => object.otyp === BOULDER);
}
function heroThrowsRocks(state = game) {
    return monsterThrowsRocks(heroSpecies(state));
}
async function stepOntoBoulder(x, y) {
    const old = glyphAt(x, y);
    await feel_location(x, y);
    if (heroThrowsRocks()) {
        await plineWithContinuation(`You ${heroLocomotion('step')} over a boulder here.`);
    }
    else if (heroCouldMoveOntoBoulder(x, y)) {
        await plineWithContinuation(`You squeeze yourself ${game.u.flying ? 'over' : 'against'} the boulder.`);
    }
    else {
        await plineWithContinuation('There is a boulder in your way.');
        if (glyphAt(x, y)?.glyph !== old?.glyph)
            game.context.move = 1;
        return false;
    }
    sokobanGuilt(game);
    return true;
}
// C hack.c:cannot_push_msg(): "You try to move it, but in vain", with the
// steed variant and a blind feel of the square.
async function cannotPushMessage(boulder, x, y) {
    const what = `the ${objectCombatName(boulder)}`;
    const steed = game.u.usteed;
    await plineWithContinuation(steed
        ? `${monsterName(steed, { article: 'your', capitalized: true })} tries to move ${what}, but cannot.`
        : `You try to move ${what}, but in vain.`);
    if (heroIsBlind(game))
        await feel_location(x, y);
}
// C hack.c:cannot_push(): rock throwers pick the boulder up or step over
// it; others may squeeze onto the square.  C hack.c:inv_cnt(): the count
// of non-gold inventory; the 52-letter comparison is cannot_push()'s own.
async function cannotPush(boulder, x, y) {
    if (heroThrowsRocks()) {
        const canPickup = !game.level?.flags.sokoban_rules
            && (game.inventory.filter(object => object.oclass !== COIN_CLASS).length < 52
                || !game.inventory.some(object => object.otyp === BOULDER));
        const willPickup = canPickup && game.flags.pickup && !game.context.nopick && await autopickupAllows(boulder);
        const steed = game.u.usteed;
        if (steed && (game.u.weaponSkills?.[P_RIDING]?.skill ?? 0) < P_BASIC) {
            await plineWithContinuation(`You aren't skilled enough to ${willPickup ? 'pick up' : 'push aside'} the ${objectCombatName(boulder)} from ${monsterName(steed, { article: 'your' })}.`);
        }
        else {
            await plineWithContinuation(`However, you ${willPickup ? 'easily pick it up' : 'maneuver over it'}${canPickup && !willPickup ? ' and could pick it up' : ''}.`);
            sokobanGuilt(game);
        }
        return true;
    }
    if (!heroCouldMoveOntoBoulder(x, y))
        return false;
    await plineWithContinuation('However, you can squeeze yourself into a small opening.');
    sokobanGuilt(game);
    return true;
}
async function monsterBlocksBoulder(boulder, monster, sx, sy, rx, ry) {
    if (heroIsBlind(game))
        await feel_location(sx, sy);
    let heardOrSeen = false;
    if (canSpotMonster(monster)) {
        await plineWithContinuation(`There's ${monsterName(monster, { article: 'a' })} on the other side.`);
        heardOrSeen = true;
    }
    else {
        await publishHeardMessage(`a monster behind the ${objectCombatName(boulder)}.`, plineWithContinuation);
        heardOrSeen = !heroIsDeaf(game);
        await map_invisible(rx, ry);
    }
    if (game.flags.verbose !== false) {
        const who = game.u.usteed ? monsterName(game.u.usteed, { article: 'your' }) : 'you';
        const subject = heardOrSeen ? `Perhaps that's why ${who}` : who.charAt(0).toUpperCase() + who.slice(1);
        await plineWithContinuation(`${subject} cannot move ${heardOrSeen ? 'it' : `the ${objectCombatName(boulder)}`}.`);
    }
}
// The trap branches of C hack.c:moverock_core(): a pushed boulder can
// trigger a land mine, plug or fill a pit, fall through a hole, teleport
// away, or launch a rolling-boulder trap.
// C hack.c:rock_disappear_msg(): the "suddenly it disappears!" farewell
// when a boulder leaves by teleport trap.
async function pushIntoTrap(boulder, trap, sx, sy, rx, ry, dx, dy, costly) {
    requirePlayingGame(game);
    if (trap.ttyp === LANDMINE && rn2(10)) {
        remove_object(boulder);
        await placeObject(boulder, rx, ry);
        await newsym(sx, sy);
        const bang = !heroIsDeaf(game) || !heroIsBlind(game) ? 'KAABLAMM!!' : 'Gadzooks';
        await plineWithContinuation(`${bang}!  The ${objectCombatName(boulder)} ${objectNameIsPlural(boulder) ? 'trigger' : 'triggers'} ${trap.madeby_u ? 'your' : 'a'} land mine.`);
        await explodeLandMine(trap, game, { seeSquare: cansee(rx, ry), heroCaused: true });
        if (game.program_state.gameover)
            return 'handled';
        await fillPitWithBoulderAt(game.u.ux, game.u.uy);
        if (cansee(rx, ry))
            await newsym(rx, ry);
        return 'handled';
    }
    if (is_pit(trap.ttyp)) {
        remove_object(boulder);
        // C hack.c:moverock_core() case PIT sets the IN_SIGHT kludge while
        // the full recalc queued by remove_object() (recalc_block_point for
        // the boulder) is still pending. The first pline() inside
        // flooreffects() flushes that recalc, which recomputes the vision
        // buffers and can clear this bit again before the later messages.
        const row = game.viz_array?.[ry];
        if (!heroIsBlind(game) && row)
            row[rx] = (row[rx] ?? 0) | IN_SIGHT;
        const result = await applyFloorEffects(boulder, rx, ry, { verb: 'fall' });
        if (game.program_state.gameover)
            return 'handled';
        if (!result.finished)
            await placeObject(boulder, rx, ry);
        if (monsterAtPosition(game.level, rx, ry) && !heroIsBlind(game))
            await newsym(rx, ry);
        return 'handled';
    }
    if (trap.ttyp === HOLE || trap.ttyp === TRAPDOOR) {
        const what = objectCombatName(boulder);
        const plural = objectNameIsPlural(boulder);
        const trapDoor = trap.ttyp === TRAPDOOR;
        const action = trapDoor ? 'trigger' : 'fall';
        const verb = plural ? action : `${action}s`;
        const motion = trapDoor ? verb : `${verb} into`;
        await plineWithContinuation(heroIsBlind(game)
            ? `Kerplunk!  You no longer feel the ${what}.`
            : `The ${what} ${motion} and ${plural ? 'plug' : 'plugs'} a ${trapDoor ? 'trap door' : 'hole'} in the ${surfaceName(rx, ry)}!`);
        deleteTrap(trap);
        await useUpFloorObject(boulder, 1);
        await buryFloorObjectsAt(rx, ry);
        const location = game.level.requireAt(rx, ry);
        location.wall_info &= ~W_NONDIGGABLE;
        location.candig = 1;
        if (cansee(rx, ry))
            await newsym(rx, ry);
        return 'handled';
    }
    if (trap.ttyp === TELEP_TRAP || trap.ttyp === LEVEL_TELEP) {
        const newDepth = trap.ttyp === LEVEL_TELEP ? randomTeleportDepth(game) : null;
        if (newDepth === depth(game.u.uz, game.dungeons))
            return 'push';
        const who = game.u.usteed
            ? monsterName(game.u.usteed, { article: 'your', capitalized: true }) : 'You';
        await plineWithContinuation(`${who} ${game.u.usteed ? 'pushes' : 'push'} the ${objectCombatName(boulder)} and suddenly it disappears!`);
        boulder.corpsenm = 0;
        if (newDepth === null)
            await relocateObjectRandomly(boulder);
        else {
            if (costly)
                await stolenValue(boulder, rx, ry, !trap.tseen, { silent: false });
            remove_object(boulder);
            const destination = levelAtDepth(newDepth);
            boulder.no_charge = false;
            boulder.where = 'migrating';
            boulder.ox = destination.dnum;
            boulder.oy = destination.dlevel;
            boulder.owornmask = MIGR_RANDOM;
            boulder.migration = { source: { ...game.u.uz }, destination, arrival: MIGR_RANDOM };
            (game.migratingObjects ??= []).unshift(boulder);
        }
        if (game.program_state.gameover)
            return 'handled';
        await seeTrap(trap);
        return 'handled';
    }
    if (trap.ttyp === ROLLING_BOULDER_TRAP) {
        let x = rx, y = ry;
        while (isok(x + dx, y + dy)) {
            x += dx;
            y += dy;
            if (x === trap.launch.x && y === trap.launch.y
                || x === trap.launch2?.x && y === trap.launch2.y)
                break;
        }
        await plineWithContinuation(`The ${objectCombatName(boulder)} suddenly ${objectNameIsPlural(boulder) ? 'roll' : 'rolls'} away from you!`);
        await feelTrap(trap);
        await launchRollingBoulder({ x: sx, y: sy }, { x, y }, { known: true, state: game });
        return 'handled';
    }
    return 'ignored';
}
// C hack.c:dopush(): the push feedback and relocation — message first,
// then movobj(), blind feels, and the bill adjustments when the boulder
// crosses shop boundaries.
async function moveBoulder(boulder, sx, sy, rx, ry, costly) {
    requirePlayingGame(game);
    const moves = game.moves;
    const previous = game._lastPushedBoulder === boulder ? game._lastBoulderPushMove : moves + 1;
    const giveMessage = previous === undefined || moves > previous + 2 || moves < previous;
    if (game.u.usteed) {
        if (giveMessage)
            await plineWithContinuation(`${monsterName(game.u.usteed, { article: 'your', capitalized: true })} moves the ${objectCombatName(boulder)}.`);
    }
    else {
        const easy = heroThrowsRocks();
        if (giveMessage)
            await plineWithContinuation(`With ${easy ? 'little' : 'great'} effort you move the ${objectCombatName(boulder)}.`);
        if (!easy)
            await exerciseAttribute(A_STR, true);
    }
    game._lastPushedBoulder = boulder;
    game._lastBoulderPushMove = moves;
    await unmap_invisible(rx, ry, false);
    boulder.corpsenm = 0;
    await moveObject(boulder, rx, ry);
    if (heroIsBlind(game)) {
        await feel_location(rx, ry);
        await feel_location(sx, sy);
    }
    else
        await newsym(sx, sy);
    if (costly && !costlySpot(rx, ry)) {
        await addShopObjectToBill(boulder, game, { ininv: false });
        return;
    }
    if (!costly && costlySpot(rx, ry) && boulder.unpaid) {
        const keeper = shopResident(roomsAt(game.level, rx, ry, SHOPBASE)[0]);
        if (keeper && billForObject(boulder, game, keeper)) {
            removeObjectAndContentsFromBill(boulder, game, { resident: keeper });
            return;
        }
    }
    if (boulder.unpaid) {
        const owner = findObjectOwner(boulder, sx, sy, game);
        if (owner && !roomsAt(game.level, rx, ry, SHOPBASE).includes(owner.eshk.shoproom))
            await stolenValue(boulder, sx, sy, true, { silent: false });
    }
}
export async function chewIronBars({ state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const { ux: x, uy: y } = state.u;
    const chewing = await continueChewingTerrain(x, y, state);
    if (chewing && state.level.at(x, y)?.typ === IRONBARS)
        await pline('You pause to swallow.');
}
// C hack.c:still_chewing().  Nominal-grid chewing progress for tunnelers,
// amorphous bodies, metallivores and giants: teeth-hurt and too-full
// refusals, per-square effort, then the breakthrough that consumes the
// boulder, tree, rock, bars or door.
export async function continueChewingTerrain(x, y, state) {
    const location = state.level.at(x, y);
    if (!location)
        throw new Error('Chewing requires a map cell.');
    const boulder = state.level.objects[x]?.[y]?.find(object => object.otyp === BOULDER);
    const digging = ensureDiggingContext(state);
    if (digging.down)
        clearDiggingContext(state);
    const tree = IS_TREE(location.typ);
    const rock = IS_OBSTRUCTED(location.typ);
    const bars = location.typ === IRONBARS;
    if (!boulder && ((rock && !mayDig(x, y, state))
        || bars && (location.wall_info & W_NONDIGGABLE))) {
        await pline(`You hurt your teeth on the ${bars ? 'bars' : tree ? 'tree' : 'hard stone'}.`);
        endVoluntaryMultiTurn(state);
        return true;
    }
    const eatsMetal = metallivorous(heroSpecies(state));
    if (bars && eatsMetal && state.u.uhunger > 1500) {
        await pline('You are too full to eat the bars.');
        endVoluntaryMultiTurn(state);
        return true;
    }
    const samePlace = digging.chew && digging.pos.x === x && digging.pos.y === y
        && digging.level.dnum === state.u.uz.dnum && digging.level.dlevel === state.u.uz.dlevel;
    if (!samePlace) {
        digging.down = false;
        digging.chew = true;
        digging.warned = false;
        digging.pos = { x, y };
        digging.level = { ...state.u.uz };
        digging.effort = (rock && !tree ? 30 : 60) + (state.u.udaminc || 0);
        const target = boulder ? 'boulder' : tree ? 'tree' : rock ? 'rock' : bars ? 'bar' : 'door';
        await pline(`You start chewing ${boulder || tree || bars ? 'on a' : 'a hole in the'} ${target}.`);
        await watchDigging(x, y, { state, magic: false });
        return true;
    }
    digging.effort += 30 + (state.u.udaminc || 0);
    if (digging.effort <= 100) {
        const target = boulder ? 'boulder' : tree ? 'tree' : rock ? 'rock' : bars ? 'bars' : 'door';
        if (state.flags.verbose)
            await pline(`You continue chewing on the ${target}.`);
        await watchDigging(x, y, { state, magic: false });
        return true;
    }
    const conduct = state.u.uconduct;
    const food = boulder ? 'a boulder' : tree ? 'a tree' : rock ? 'rock' : bars ? 'iron bars' : 'a door';
    if (!conduct.food)
        recordGameLogEvent(`ate for the first time, by chewing through ${food}`, { state, flags: LL_CONDUCT });
    conduct.food = (conduct.food || 0) + 1;
    state.u.uhunger += rnd(20);
    if (boulder) {
        await delobj(boulder, state);
        await pline('You eat the boulder.');
        const anotherBoulder = state.level.objects[x]?.[y]?.some(object => object.otyp === BOULDER);
        vision_note_blocker_change(x, y);
        await newsym(x, y);
        clearDiggingContext(state);
        return rock || location.typ === DOOR && !!(location.doormask & (D_CLOSED | D_LOCKED)) || !!anotherBoulder;
    }
    let message = null;
    let damage = null;
    if (IS_WALL(location.typ)) {
        if (roomsAt(state.level, x, y, SHOPBASE).length) {
            addShopDamage(x, y, 10 * currentStrength(state), state);
            damage = 'damage';
        }
        message = 'You chew a hole in the wall.';
        if (state.level.flags.is_maze_lev)
            location.typ = ROOM;
        else if (state.level.flags.is_cavernous_lev && !inTown(state.level, x, y))
            location.typ = CORR;
        else {
            location.typ = DOOR;
            location.doormask = D_NODOOR;
        }
    }
    else if (tree) {
        message = 'You chew through the tree.';
        location.typ = ROOM;
    }
    else if (bars) {
        if (eatsMetal)
            await morehungry(-objectBaseWeight(HEAVY_IRON_BALL), { state });
        await dissolveBars(x, y, state);
        message = state.u.ux === x && state.u.uy === y
            ? 'You devour the iron bars.' : 'You eat through the bars.';
    }
    else if (location.typ === SDOOR || location.typ === DOOR) {
        const secret = location.typ === SDOOR;
        if (!secret && roomsAt(state.level, x, y, SHOPBASE).length) {
            addShopDamage(x, y, SHOP_DOOR_COST, state);
            damage = 'break';
        }
        if (location.doormask & D_TRAPPED) {
            location.doormask = D_NODOOR;
            if (await triggerBoobyTrap(secret ? 'secret door' : 'door', { state }))
                return true;
        }
        else {
            message = `You chew through the ${secret ? 'secret ' : ''}door.`;
            location.doormask = D_BROKEN;
        }
        location.typ = DOOR;
    }
    else {
        message = 'You chew a passage through the rock.';
        location.typ = CORR;
    }
    vision_note_blocker_change(x, y);
    await newsym(x, y);
    if (message)
        await pline(message);
    if (damage)
        await payForShopDamage(damage, { state });
    clearDiggingContext(state);
    return false;
}
// C hack.c:movobj().  Unlink a floor pile object and relink it elsewhere.
// C hack.c:825-833 movobj().  Unlink the object from its floor pile,
// re-evaluate hiding at the vacated square, and relink at the destination.
// remove_object() leaves ox/oy intact, exactly like C, so the old square is
// still readable after the unlink.
export async function moveObject(object, x, y, state = game) {
    requireLiveGame(state);
    if (!object || !state.level)
        return object;
    const oldX = object.ox;
    const oldY = object.oy;
    remove_object(object, state);
    await maybeUnhideAt(oldX, oldY, state);
    await newsym(oldX, oldY);
    await placeObject(object, x, y, state);
    await newsym(x, y);
    return object;
}
// C hack.c:u_locomotion().  Active flight and levitation take precedence
// over the movement word for the hero's current body.
export function heroLocomotion(fallback, state = game) {
    const verb = propertyIsActive('levitation', state) ? 'float'
        : propertyIsActive('flying', state) ? 'fly' : null;
    if (verb === null)
        return monsterLocomotion(heroSpecies(state), fallback);
    return fallback.charAt(0) === fallback.charAt(0).toUpperCase()
        ? verb.charAt(0).toUpperCase() + verb.slice(1) : verb;
}
export function shouldShowGetposTip(state = game) {
    return state.flags?.tips !== false && !state._travelTipShown;
}
// C hack.c:handle_tip(). Dismissing the tip does not cancel map selection.
export async function showGetposTip(state = game) {
    if (!shouldShowGetposTip(state))
        return false;
    state._travelTipShown = true;
    await currentLuaLifecycle().callCore(state, 'getpos_tip');
    return true;
}
// C hack.c:escape_from_sticky_mon(). True means this attempt was spent
// struggling; release clears the grip directly, without unstuck's cooldown.
export async function escapeFromStickyMonster(x, y) {
    const state = game;
    const holder = state.u.ustuck;
    if (!holder || x === holder.mx && y === holder.my)
        return false;
    if (Math.abs(holder.mx - state.u.ux) > 1 || Math.abs(holder.my - state.u.uy) > 1) {
        setHeroGrip(null, state);
        return false;
    }
    const name = () => monsterName(holder, { state, article: 'your' });
    if (heroFormSticks(state)) {
        setHeroGrip(null, state);
        await plineWithContinuation(`You release ${name()}.`);
        return false;
    }
    const frozen = !holder.mcanmove;
    const escape = rn2(frozen ? 8 : 40);
    if (escape === 3 && frozen) {
        holder.mfrozen = 1;
        holder.msleeping = 0;
    }
    if (escape > 2 && (heroHasConflict(state) || holder.mconf || !holder.mtame)) {
        await plineWithContinuation(`You cannot escape from ${name()}!`);
        endVoluntaryMultiTurn(state);
        return true;
    }
    setHeroGrip(null, state);
    await plineWithContinuation(`You pull free from ${name()}.`);
    return false;
}
const CRAWL_DX = [-1, -1, 0, 1, 1, 1, 0, -1];
const CRAWL_DY = [0, -1, -1, -1, 0, 1, 1, 1];
const S_EYE = 5;
const S_VORTEX = 22;
const S_LIGHT = 25;
const PM_GREMLIN = 40;
const PM_GRID_BUG = MONSTER_NAME.indexOf('grid bug');
const PM_WATER_ELEMENTAL = MONSTER_NAME.indexOf('water elemental');
const PM_STEAM_VORTEX = MONSTER_NAME.indexOf('steam vortex');
const PM_FOG_CLOUD = MONSTER_NAME.indexOf('fog cloud');
const PM_AIR_ELEMENTAL = 154;
const PM_IRON_GOLEM = 259;
function heroIsInAir(state) {
    const hero = state.u;
    if (hero.levitating || hero.levitation)
        return true;
    const symbol = (hero.mtimedone ?? 0) > 0 && hero.umonnum !== undefined
        ? MONSTER_SYMBOL[hero.umonnum] : null;
    return heroIsFlying(state)
        || symbol === S_EYE
        || symbol === S_LIGHT
        || (heroFormClings(state) && levelHasCeiling(state));
}
// C hack.c:u_simple_floortyp(): the floor classification under the hero —
// water walls and lava walls, then pool or lava only when not in air.
function heroFloorType(state, x, y) {
    const terrain = state.level?.at?.(x, y)?.typ;
    if (terrain !== undefined && IS_WATERWALL(terrain))
        return WATER;
    if (terrain === LAVAWALL)
        return LAVAWALL;
    if (!heroIsInAir(state)) {
        if (isPoolAt(x, y, state))
            return POOL;
        if (isLavaAt(x, y, state))
            return LAVAPOOL;
    }
    return ROOM;
}
export function heroShouldAvoidLiquid(x, y, state = game) {
    const hero = state.u;
    const destination = state.level?.at?.(x, y);
    if (!hero || !destination)
        return false;
    const newFloor = heroFloorType(state, x, y);
    const liquidWall = IS_WATERWALL(newFloor) || newFloor === LAVAWALL;
    if (hero.uinwater && (isPoolAt(x, y, state)
        || IS_WATERWALL(newFloor)))
        return false;
    if (newFloor === heroFloorType(state, hero.ux, hero.uy)
        || hero.stunned || (hero.stunnedTurns ?? 0) > 0
        || hero.confused || (hero.confusionTurns ?? 0) > 0
        || !destination.seenv
        || (!isPoolAt(x, y, state) && !isLavaAt(x, y, state)
            && !liquidWall))
        return false;
    const dangerousPool = isPoolAt(x, y, state)
        && !heroKnowsWaterWalking(state);
    const dangerousLava = isLavaAt(x, y, state)
        && !heroKnowsLavaWalking(state)
        && !isLavaAt(hero.ux, hero.uy, state);
    if (!dangerousPool && !dangerousLava && !liquidWall)
        return false;
    if (state.context?.nopick) {
        state.context.tips = (state.context.tips ?? 0) | (1 << TIP_SWIM);
        return false;
    }
    return liquidWall
        || !!((state.flags?.paranoia_bits ?? 0) & PARANOID_SWIM);
}
// C hack.c:may_passwall(): stone walls flagged W_NONPASSWALL block
// wall-passing.
export function heroCanPassWallAt(state, x, y) {
    const location = requireGameLevel(state).at(x, y);
    return !!location && heroPassesWalls(state)
        && !(IS_STWALL(location.typ) && (location.wall_info & W_NONPASSWALL));
}
export function doorlessDoor(location) {
    return location?.typ === DOOR
        // Rogue doorways have no doors but retain diagonal restrictions.
        && !game.level?.flags.is_rogue_level
        && !((location.doormask || 0) & ~D_BROKEN);
}
export function blocksDiagonalDoor(current, destination) {
    return (destination?.typ === DOOR && !doorlessDoor(destination))
        || (current?.typ === DOOR && !doorlessDoor(current));
}
export function heroBadRock(state, x, y) {
    const location = state.level?.at?.(x, y);
    if (!location)
        return true;
    const pile = state.level?.objects?.[x]?.[y] || [];
    if (state.level?.flags?.sokoban_rules
        && pile.some(object => object.otyp === BOULDER))
        return true;
    if (!IS_OBSTRUCTED(location.typ))
        return false;
    // C bad_rock() tests the species, even when the hero has temporary
    // wall passing. test_move() applies that property after direction selection.
    const mayDig = !((IS_STWALL(location.typ) || location.typ === TREE)
        && ((location.wall_info ?? 0) & W_NONDIGGABLE));
    const cannotTunnel = !speciesTunnels(heroSpecies(state))
        || needspick(heroSpecies(state)) || !mayDig;
    const canPass = monsterPassesWalls(heroSpecies(state))
        && !(IS_STWALL(location.typ) && (location.wall_info & W_NONPASSWALL));
    return cannotTunnel && !canPass;
}
// C hack.c:bad_rock() for a monster actor. The orthogonal cells around a
// diagonal move use the species' intrinsic tunnelling/passwall abilities,
// not the allow flags which were computed for the destination itself.
export function badRockForMonster(monster, state, x, y) {
    const loc = state?.level?.at?.(x, y);
    if (!loc)
        return true;
    const pile = state?.level?.objects?.[x]?.[y] || [];
    if (state?.level?.flags?.sokoban_rules && pile.some((object) => object.otyp === BOULDER))
        return true;
    if (!IS_OBSTRUCTED(loc.typ))
        return false;
    const mayTunnel = speciesTunnels(monster?.mnum) && !needspick(monster?.mnum) && mayDig(x, y, state);
    const mayPassWall = monsterPassesWalls(monster?.mnum) && !(IS_STWALL(loc.typ) && (loc.wall_info ?? 0) & W_NONPASSWALL);
    return !mayTunnel && !mayPassWall;
}
export function heroTightDiagonalReason(state = game) {
    const u = state.u;
    if (heroPassesWalls(state))
        return 0;
    const mnum = (u.mtimedone ?? 0) > 0 ? u.umonnum ?? null : null;
    const flexible = (monsterIsAmorphous({ mnum: heroMonsterForm(state) ?? -1 }) || monsterIsSlithy(heroMonsterForm(state) ?? -1) || monsterIsUnsolid({ mnum: heroMonsterForm(state) ?? -1 }))
        || (mnum !== null && MONSTER_SYMBOL[mnum] === S_VORTEX)
        || mnum === PM_AIR_ELEMENTAL;
    if (mnum !== null && monsterIsBig(mnum) && !flexible)
        return 1;
    if (inventoryWeight(state) > WT_TOOMUCH_DIAGONAL)
        return 2;
    if (state.level?.flags?.sokoban_rules)
        return 3;
    return 0;
}
// C hack.c:crawl_destination(): goodpos() first, then diagonal limits.
export async function crawlDestinationAllowed(state, x, y, random, publish) {
    const u = state.u;
    if (!goodPosition(x, y, { kind: 'hero' }, { state, random }))
        return false;
    if (x === u.ux || y === u.uy)
        return true;
    if (u.umonnum === PM_GRID_BUG)
        return false;
    if (heroPassesWalls(state))
        return true;
    const location = state.level.at(x, y);
    if (location?.typ === DOOR) {
        if (!doorlessDoor(location))
            return false;
        const keeper = shopkeeperBlockingDoor(x, y, state);
        if (keeper) {
            await publish(`${shopkeeperName(keeper, { state, capitalized: true })}${propertyIsActive('invisible', state) ? ' senses your motion and' : ''} blocks your way!`);
            return false;
        }
    }
    return !(heroBadRock(state, u.ux, y)
        && heroBadRock(state, x, u.uy)
        && heroTightDiagonalReason(state));
}
async function crawlDestination(state, x, y, random, publish) {
    const directions = [0, 1, 2, 3, 4, 5, 6, 7];
    for (let remaining = directions.length; remaining > 0; remaining--) {
        const index = random(remaining);
        const selected = directions[index];
        const last = directions[remaining - 1];
        if (selected === undefined || last === undefined)
            throw new RangeError('Crawl direction shuffle received an invalid index.');
        directions[index] = last;
        directions[remaining - 1] = selected;
    }
    for (const direction of directions) {
        const dx = CRAWL_DX[direction];
        const dy = CRAWL_DY[direction];
        if (dx === undefined || dy === undefined)
            throw new RangeError('Unknown crawl direction.');
        const candidate = { x: x + dx, y: y + dy };
        if (await crawlDestinationAllowed(state, candidate.x, candidate.y, random, publish))
            return candidate;
    }
    return null;
}
function heroStaysAboveWater(state, location) {
    const u = state.u;
    if (u.levitating || u.levitation || u.flying)
        return true;
    return heroHasWaterWalking(state) && location?.typ !== WATER;
}
function heroCanLiveUnderwater(state) {
    const u = state.u;
    return !!(u.amphibious || u.swimming || u.breathless || u.magicalBreathing
        || cant_drown(heroMonsterForm(state) ?? -1));
}
export function heroResistsFire(state) {
    const hero = state.u;
    return !!(hero.fireResistance);
}
async function burnLavaBoots(state, publish, protectedObject) {
    const boots = state.uarmf || state.u?.uarmf;
    if (!boots || !(boots.in_use || (!boots.oerodeproof && objectIsOrganic(boots, state))))
        return false;
    await publish(`${ownedObjectAction(boots, 'burst', state)} into flame!`);
    // destroyWornArmor() runs the full Boots_off-before-consume sequence; the
    // in_lava_effects counter raised around this whole entry suppresses the
    // nested float_down()/spoteffects() recursion (C trap.c:6863-6867).
    if (boots === protectedObject) {
        await removeWornHeroItem(boots, state);
        return true;
    }
    await destroyWornArmor(boots, state);
    boots.worn = false;
    boots.wornSlot = null;
    boots.owornmask = 0;
    boots.where = 'gone';
    return true;
}
export async function burnAwayHeroSlime(state, publish) {
    if (!clearHeroSliming(state))
        return false;
    await publish('The slime that covers you is burned away!');
    return true;
}
export async function reviveHeroFromLiquid(state, publish, random) {
    if (state !== game)
        return false;
    // C done() forces status with the raw HP before it records the death.
    await bot();
    const lifeSaving = beginHeroLifeSaving();
    if (!lifeSaving)
        return false;
    await publish('But wait...');
    identifyLifeSavingAmulet(random);
    await publish(`Your medallion ${heroIsBlind(state) ? 'feels warm' : 'begins to glow'}!`);
    await publish(formatFeltMessage('much better!', state));
    await publish('The medallion crumbles to dust!');
    await completeHeroLifeSaving(lifeSaving);
    return true;
}
export async function finishLiquidDeath(options) {
    // The liquid effect has usually announced the death already. done() still
    // owns life saving and the wizard/explore recovery question.
    return await finishHeroDeath({ ...options, deathLineShown: options.deathLineShown ?? true });
}
export async function teleportHeroOutOfLiquid({ state, random, rollOne, publish, repaint, resetVision, recalculateVision, applyLandingEffects, }) {
    const destination = safeTeleportDestination(state, random, rollOne);
    if (!destination)
        return null;
    // C trap.c:6936/7021 call safe_teleds(TELEDS_ALLOW_DRAG | TELEDS_TELEPORT):
    // a light hero may drag an adjacent ball, and the verbose materialize
    // line precedes the landing effects (teleport.c:545-547).
    const { arrival } = await moveHeroByTeleport(destination.x, destination.y, state, {
        allowDrag: true,
        finishArrival: async (movement) => {
            if (state.flags?.verbose !== false) {
                await publish(`You materialize in ${movement.oldx === movement.x && movement.oldy === movement.y
                    ? 'the same' : 'a different'} location!`);
            }
            return finishLiquidTeleport(movement, {
                state, repaint, resetVision, recalculateVision, applyLandingEffects,
            });
        },
    });
    return arrival;
}
async function finishLavaLifeSaving({ state, publish, random, rollOne, repaint, resetVision, recalculateVision, applyLandingEffects, die, }) {
    for (let attempt = 0; attempt < 2; attempt++) {
        state.u.uhp = -1;
        // C trap.c:6922-6934: water elementals, steam vortices, and fog
        // clouds boil away instead of burning to a crisp.
        const boilsAway = [PM_WATER_ELEMENTAL, PM_STEAM_VORTEX, PM_FOG_CLOUD]
            .includes(heroSpecies(state));
        await publish(`You ${boilsAway ? 'boil away' : 'burn to a crisp'}...`, { urgent: true });
        if (!await reviveHeroFromLiquid(state, publish, random)) {
            await die({
                killer: 'molten lava',
                possessionAnswer: 'n',
                deathVerb: 'burned',
                deathType: BURNING,
            });
            if (state.program_state.gameover)
                return { entered: true, moved: false, died: true };
        }
        if (state.program_state?.gameover)
            return { entered: true, moved: false, died: true };
        const escape = await teleportHeroOutOfLiquid({
            state, random, rollOne, publish, repaint, resetVision,
            recalculateVision, applyLandingEffects,
        });
        if (escape)
            return escape;
        await publish("You're still burning.");
    }
    // C lava_effects(): two recoveries without a landing give the hero
    // five turns to find another way out before the lava becomes fatal again.
    if (!heroResistsFire(state))
        setPropertyTimeout('fireResistance', 5, state);
    if (!heroHasWaterWalking(state))
        setPropertyTimeout('waterWalking', 5, state);
    return { entered: true, moved: false, died: false };
}
// C lava_effects() brackets its boots- and inventory-burning stages with
// iflags.in_lava_effects so nested Boots_off()/float_down()/spoteffects()
// calls cannot re-enter it (do_wear.c:LEVITATION_BOOTS skips float_down()
// while the flag is raised).  The JS owner raises the same counter around
// the whole entry.
async function heroLavaEffects(options) {
    const state = options.state || game;
    const from = { x: state.u.ux, y: state.u.uy };
    state.iflags ||= {};
    state.iflags.in_lava_effects = (state.iflags.in_lava_effects || 0) + 1;
    let result = null;
    try {
        result = await finishLavaEffects(options);
    }
    finally {
        state.iflags.in_lava_effects
            = Math.max(0, state.iflags.in_lava_effects - 1);
    }
    // C trap.c:6942-6961: the life-saving rescue's safe_teleds() runs while
    // the counter still suppresses its spoteffects; after the counter drops,
    // a rescue that relocated the hero gets the explicit spoteffects(FALSE)
    // landing -- full destination effects, but auto-pickup suppressed.
    if (result?.moved && !result?.died && options.applyLandingEffects) {
        // C trap.c:6957: rescued_from_terrain(BURNING) precedes the
        // suppressed-pickup landing effects.
        await announceTerrainRescue(BURNING, state, options.publish);
        const landing = await options.applyLandingEffects({
            from: result.from ?? from,
            to: { x: state.u.ux, y: state.u.uy },
            pick: false,
        });
        if (landing?.died)
            return { ...result, died: true };
    }
    return result;
}
async function finishLavaEffects({ state, location, publish, random, rollDice, rollOne, repaint, resetVision, recalculateVision, applyLandingEffects, die, }) {
    // Ordinary death returns no value; damage handling needs the final state.
    // These deaths come through losehp(), which prints "You die..." itself.
    const finishDamageDeath = async (options) => {
        await die({ ...options, deathLineShown: false });
        return !!state.program_state.gameover;
    };
    const hero = state.u;
    const damage = rollDice(6, 6);
    // C lava_effects() maps the liquid by touch before its first message.
    if (state === game)
        await feel_newsym(hero.ux, hero.uy);
    await burnAwayHeroSlime(state, publish);
    if (heroLikesLava(state))
        return { entered: true, moved: false, died: false };
    const fireResistant = heroResistsFire(state);
    const waterWalkingBeforeBootsBurn = heroHasWaterWalking(state);
    const survives = fireResistant
        || (waterWalkingBeforeBootsBurn && damage < (hero.uhp ?? 0));
    const protectedObject = survives ? null : await markLavaInventoryForDestruction(state, random);
    const bootsBurned = await burnLavaBoots(state, publish, protectedObject);
    const waterWalking = heroHasWaterWalking(state);
    if (!fireResistant) {
        if (waterWalking) {
            await publish(`The ${displayLiquidName('lava', state)} here burns you!`);
            if (survives) {
                if (await loseHeroHp(damage, 'molten lava', {
                    state, publish, die: finishDamageDeath, deathCause: 'killed by molten lava',
                }))
                    return { entered: true, moved: false, died: true };
                const items = await destroyFireInventory(damage, {
                    state, publish, random, rollOne, die: finishDamageDeath,
                });
                if (items.heroDied)
                    return { entered: true, moved: false, died: true };
                await igniteItems(state.inventory, { state, publish, random });
                return { entered: true, moved: false, died: false };
            }
        }
        else {
            await publish(`You fall into the ${waterbodyName(hero.ux, hero.uy, state)}!`);
        }
        const lifeSaver = state.uamul || hero.uamul;
        const willSurvive = lifeSaver?.otyp === AMULET_OF_LIFE_SAVING
            || state.flags?.debug || state.flags?.explore;
        await destroyLavaInventory({
            state,
            publish,
            protectedObject,
            showMessages: !!willSurvive,
            previouslyAnnounced: bootsBurned ? 1 : 0,
        });
        if (state.program_state?.gameover)
            return { entered: true, moved: false, died: true };
        const rescue = await finishLavaLifeSaving({
            state, publish, random, rollOne, repaint, resetVision,
            recalculateVision, applyLandingEffects, die,
        });
        if (rescue.died || rescue.moved)
            return rescue;
        const items = await destroyFireInventory(damage, {
            state, publish, random, rollOne, die: finishDamageDeath,
        });
        if (items.heroDied)
            return { ...rescue, died: true };
        await igniteItems(state.inventory, { state, publish, random });
        return rescue;
    }
    let sank = false;
    if (!waterWalking
        && (!hero.utrap || hero.utraptype !== TT_LAVA)) {
        setHeroTrap(random(4) + 4 + ((random(4) + 12) << 8), TT_LAVA, state);
        await publish(`You sink into the ${waterbodyName(hero.ux, hero.uy, state)}, but it only burns slightly!`);
        monstersObserveHeroResistance(M_SEEN_FIRE, state);
        if (hero.uhp > 1 && await loseHeroHp(1, 'molten lava', {
            state, publish, die: finishDamageDeath, deathCause: 'killed by molten lava',
        }))
            return { entered: true, moved: false, died: true, sank: true };
        sank = true;
    }
    const items = await destroyFireInventory(damage, {
        state, publish, random, rollOne, die: finishDamageDeath,
    });
    if (items.heroDied)
        return { entered: true, moved: false, died: true, sank };
    await igniteItems(state.inventory, { state, publish, random });
    return { entered: true, moved: false, died: false, sank };
}
function heroDoesNotNeedAir(state) {
    const u = state.u;
    return !!(u.amphibious || u.breathless || u.magicalBreathing
        || (monsterIsAmphibious(heroMonsterForm(state) ?? -1) || monsterIsBreathless(heroMonsterForm(state) ?? -1)));
}
export function heroCanSwim(state) {
    return !!(state.u?.swimming || monsterIsSwimmer(heroMonsterForm(state) ?? -1));
}
function equippedObject(state, slot) {
    return state[slot] || state.u?.[slot] || null;
}
function canDropWhileDrowning(object, state) {
    if (!object || object.in_use)
        return false;
    if (object.otyp === LOADSTONE && object.cursed)
        return false;
    for (const slot of [
        'uamul', 'uleft', 'uright', 'ublindf',
        'uarm', 'uarmc', 'uarmg', 'uarmf', 'uarmu',
    ]) {
        if (equippedObject(state, slot) === object)
            return false;
    }
    if (object.cursed && [
        equippedObject(state, 'uarmh'), equippedObject(state, 'uarms'),
    ].includes(object))
        return false;
    const weapon = equippedObject(state, 'uwep');
    if (weapon === object && object.cursed)
        return false;
    return true;
}
export function pickEmergencyDrop(state, random) {
    const inventory = state.inventory || [];
    if (!inventory.length)
        return null;
    let remaining = random(inventory.length);
    let candidate = null;
    for (const object of inventory) {
        if (canDropWhileDrowning(object, state))
            candidate = object;
        remaining--;
        if (remaining < 0 && candidate)
            break;
    }
    return candidate;
}
export async function dropEmergencyObject(object, state) {
    await removeWornHeroItem(object, state);
    if (state.program_state?.gameover)
        return false;
    await dropInventoryObjectAtHero(object, { state });
    return !state.program_state?.gameover;
}
async function wakeHeroForCrawl(state, publish) {
    if (state.u.usleep)
        await finishHeroHelplessness('Suddenly you wake up!', state, publish);
    if (state.u.uhs === FAINTED)
        await reset_faint({ state });
}
async function applyHeroFormWaterEffect(state, publish, random, rollDice) {
    const u = state.u;
    if (!((u.mtimedone ?? 0) > 0))
        return null;
    if (u.umonnum === PM_GREMLIN && random(3) !== 0) {
        const clone = await splitHeroMonsterForm(state);
        if (clone)
            await publish('You multiply!');
        return clone ? { kind: 'split', clone } : null;
    }
    if (u.umonnum !== PM_IRON_GOLEM)
        return null;
    await publish('You rust!');
    let damage = rollDice(2, 6);
    if (u.halfPhysicalDamage)
        damage = Math.trunc((damage + 1) / 2);
    if ((u.mhmax ?? 0) > damage)
        u.mhmax -= damage;
    const died = await loseHeroHp(damage, 'rusting away', {
        state, publish, deathCause: 'killed by rusting away',
    });
    return { kind: 'rust', damage, died };
}
async function finishLiquidTeleport(movement, { state, repaint, resetVision, recalculateVision, applyLandingEffects, }) {
    // spoteffects() announces surfacing before it clears the submerged view.
    const from = { x: movement.oldx, y: movement.oldy };
    const to = { x: movement.x, y: movement.y };
    await repaint(movement.oldx, movement.oldy);
    resetVision();
    await recalculateVision(0);
    const landing = await applyLandingEffects({ from, to });
    return { entered: true, moved: true, died: !!landing?.died, from, to };
}
async function leaveWater({ state, location, publish, }) {
    const u = state.u;
    if (!u.uinwater)
        return false;
    let message = null;
    let stillInWater = false;
    if (!isPoolAt(u.ux, u.uy, state)) {
        if (heroIsOnWaterLevel(state)) {
            message = 'You pop into an air bubble.';
        }
        else if (isLavaAt(u.ux, u.uy, state)) {
            message = `You leave the ${displayLiquidName('water', state)}...`;
        }
        else {
            message = backOnGroundMessage(false, state);
        }
    }
    else if (heroIsOnWaterLevel(state)) {
        stillInWater = true;
    }
    else if (u.levitating || u.levitation) {
        message = `You pop out of the ${displayLiquidName('water', state)} like a cork!`;
    }
    else if (u.flying) {
        message = `You fly out of the ${displayLiquidName('water', state)}.`;
    }
    else if (heroHasWaterWalking(state)) {
        message = 'You slowly rise above the surface.';
    }
    else {
        stillInWater = true;
    }
    if (stillInWater)
        return false;
    if (message)
        await publish(message);
    // C Underwater is u.uinwater, still set until set_uinwater(0) below.
    const wasUnderwater = !!(u.uinwater || state.underwater) && !heroIsOnWaterLevel(state);
    await setHeroInWater(false, state);
    state.underwater = false;
    // C restores the surface view by redrawing the screen and deferring the
    // vision recalculation to the next flush.
    if (wasUnderwater) {
        await docrt();
        state.vision_full_recalc = 1;
    }
    return true;
}
// entry 'spot-effects' (C hack.c:spoteffects() -> pooleffects()) is the
// default.  entry 'float-down' (float_down() -> drown()/
// lava_effects()) skips the spoteffects-only stages: leaving water, the
// mounted-steed dismount, and the ceiling-hider check, none of which the
// direct drown()/lava_effects() calls perform. Entries 'drown' and 'lava'
// also skip their terrain-entry guards, including being held by a monster.
// Entry 'turn' is moveloop_core()'s pooleffects(FALSE) for a hero who did
// not move: it leaves a submerged swimmer or breather out of drown().
export async function heroLiquidEffects(options = {}) {
    const { state = game, publish = plineWithContinuation, random = rn2, recalculateVision = vision_recalc, resetVision = vision_reset, repaint = newsym, rollDice = d, rollOne = rnd, chooseTeleportDestination = null, applyLandingEffects = async () => { }, die = finishLiquidDeath, entry = 'spot-effects', } = options;
    const fromFloatDown = entry === 'float-down';
    if (!state.level)
        return null;
    requirePlayingGame(state);
    const u = state.u;
    let x = u?.ux;
    let y = u?.uy;
    let location = state.level?.at?.(x, y);
    if (!u || !location)
        return null;
    if (entry === 'lava')
        return heroLavaEffects({
            state, location, publish, random, rollDice, rollOne,
            repaint, resetVision, recalculateVision, applyLandingEffects, die,
        });
    if (entry !== 'drown') {
        const leftWater = fromFloatDown ? false : await leaveWater({ state, location, publish });
        const airborne = u.levitating || u.levitation
            || u.flying;
        if ((!isPoolAt(x, y, state) && !isLavaAt(x, y, state))
            || u.ustuck || airborne)
            return leftWater ? { left: true } : null;
        if (!fromFloatDown && u.usteed && !steedIsGrounded(u.usteed, state))
            return null;
        if (!fromFloatDown && heroHidesOnCeiling(state))
            return leftWater ? { left: true } : null;
        if (!fromFloatDown && u.usteed) {
            const from = { x, y };
            // Native pooleffects() lets dismount_steed() apply destination
            // effects and float_down(); this caller only reports the result.
            const dismount = await dismountHero(u.uinwater ? DISMOUNT_FELL : DISMOUNT_GENERIC, {
                state,
                random,
                announce: publish,
            });
            return {
                entered: true, dismounted: dismount.dismounted,
                moved: u.ux !== from.x || u.uy !== from.y
                    || (dismount.dismounted && (!!dismount.movement || !!dismount.location?.moved)),
                died: !!dismount.died || !!state.program_state?.gameover,
                from, to: { x: u.ux, y: u.uy },
            };
        }
        if (isLavaAt(x, y, state)) {
            return heroLavaEffects({
                state, location, publish, random, rollDice, rollOne,
                repaint, resetVision, recalculateVision, applyLandingEffects,
                die,
            });
        }
        if (heroStaysAboveWater(state, location))
            return leftWater ? { left: true } : null;
        if (entry === 'turn' && u.uinwater && heroCanLiveUnderwater(state))
            return null;
    }
    // drown() maps the water by touch before any entry message can page.
    if (state === game)
        await feel_newsym(x, y);
    const waterWall = location.typ === WATER;
    let canLiveUnderwater = heroCanLiveUnderwater(state);
    let stayingInPool = false;
    // drown() uses the retained direction, including zero, after relocation.
    if (u.uinwater && isPoolAt(x - (u.dx ?? 0), y - (u.dy ?? 0), state)
        && canLiveUnderwater) {
        if (random(5) !== 0)
            return { entered: true, moved: false, died: false };
        stayingInPool = true;
    }
    if (!u.uinwater) {
        await publish(`You ${waterWall ? 'plunge' : 'fall'} into the ${waterbodyName(x, y, state)}${canLiveUnderwater ? '.' : '!'}`);
        if (!heroCanSwim(state) && !waterWall)
            await publish(heroIsHallucinating(state)
                ? 'You sink like the Titanic.' : 'You sink like a rock.');
    }
    await waterDamageChain(state.inventory, [], state, { publish });
    const formEffect = await applyHeroFormWaterEffect(state, publish, random, rollDice);
    if (formEffect?.died)
        return { entered: true, moved: false, died: true };
    canLiveUnderwater = heroCanLiveUnderwater(state);
    if (stayingInPool) {
        return {
            entered: true, moved: false, died: false, formEffect,
        };
    }
    const leashCount = releaseAllMonsterLeashes(state);
    if (leashCount) {
        await publish(leashCount === 1
            ? 'The leash slips loose.' : 'The leashes slip loose.');
    }
    if (canLiveUnderwater) {
        if (heroDoesNotNeedAir(state)) {
            if (state.flags.verbose)
                await publish("But you aren't drowning.");
            if (!heroIsOnWaterLevel(state))
                await publish(heroIsHallucinating(state) ? 'Your keel hits the bottom.' : 'You touch bottom.');
        }
        // C trap.c:5117-5120: the settling ball and chain are re-placed
        // for the underwater position.
        if (heroIsPunished(state)) {
            await unplaceBallAndChain(state);
            await placeBallAndChain(state);
        }
        await recalculateVision(2);
        await setHeroInWater(true, state);
        // drown() clears the whole map on every dive, even after surfacing
        // has restored land outside the previous underwater viewport.
        if (state === game)
            await under_water(1);
        state.vision_full_recalc = 1;
        return { entered: true, moved: false, died: false };
    }
    // C trap.c:5128 reads Luck, which includes a carried luckstone's bonus.
    const luck = Luck(u);
    if (heroCanTeleport(state) && !heroIsUnaware(state)
        && (heroControlsTeleport(state) || random(3) < luck + 2)) {
        await publish('You attempt a teleport spell.');
        if (heroTeleportRestricted(state)) {
            await publish('The attempted teleport spell fails.');
        }
        else {
            const teleport = await teleportHeroAtWill({
                state, random, rollOne,
                chooseDestination: chooseTeleportDestination,
                publish,
                finishArrival: async (movement) => {
                    if (state.flags.verbose !== false)
                        await publish(`You materialize in ${movement.oldx === movement.x && movement.oldy === movement.y
                            ? 'the same' : 'a different'} location!`);
                    return finishLiquidTeleport(movement, {
                        state, repaint, resetVision, recalculateVision, applyLandingEffects,
                    });
                },
            });
            if (teleport.died)
                return { entered: true, moved: teleport.moved, died: true };
            if (!isPoolAt(u.ux, u.uy, state))
                return teleport.arrival ?? { entered: true, moved: teleport.moved, died: false };
        }
    }
    // C drown(): a mounted hero dismounts before crawling; landing on dry
    // ground ends the drowning.
    if (u.usteed) {
        const from = { x: u.ux, y: u.uy };
        const dismount = await dismountHero(DISMOUNT_GENERIC, { state, random, announce: publish });
        if (dismount.died || state.program_state?.gameover)
            return { entered: true, dismounted: dismount.dismounted, moved: u.ux !== from.x || u.uy !== from.y, died: true };
        if (!isPoolAt(u.ux, u.uy, state))
            return {
                entered: true, dismounted: dismount.dismounted,
                moved: u.ux !== from.x || u.uy !== from.y, died: false,
                from, to: { x: u.ux, y: u.uy },
            };
    }
    await wakeHeroForCrawl(state, publish);
    // C drown() reads u.ux/u.uy after any teleport or dismount.
    x = u.ux;
    y = u.uy;
    const canMove = !((state._helplessTurns ?? 0) > 0)
        && (!((u.mtimedone ?? 0) > 0) || (MONSTER_MOVE[u.umonnum] ?? 0) > 0);
    const destination = canMove
        ? await crawlDestination(state, x, y, random, publish) : null;
    if (destination) {
        const escape = heroIsOnWaterLevel(state)
            ? { escaped: true, dropped: false }
            : await emergencyDisrobe(state, random);
        if (escape.died)
            return { entered: true, moved: false, died: true };
        await publish(`You try to crawl out of the ${displayLiquidName('water', state)}.`);
        if (escape.dropped)
            await publish('You dump some of your gear to lose weight...');
        if (escape.escaped) {
            await publish('Pheew!  That was close.');
            // C trap.c:5164 relocates through teleds(TELEDS_ALLOW_DRAG),
            // which resets the trap/hold state and drags the ball and chain
            // along, then runs the full destination effects below.
            const { arrival: landing } = await moveHeroByTeleport(destination.x, destination.y, state, {
                allowDrag: true,
                finishArrival: () => applyLandingEffects({
                    from: { x, y },
                    to: { x: u.ux, y: u.uy },
                }),
            });
            return {
                entered: true, moved: true, died: !!landing?.died,
                from: { x, y }, to: { x: u.ux, y: u.uy },
            };
        }
        await publish('But in vain.');
    }
    await setHeroInWater(true, state);
    await publish('You drown.');
    for (let attempt = 0; attempt < 2; attempt++) {
        const liquid = waterbodyName(u.ux, u.uy, state);
        const killer = liquid === 'water' ? 'deep water' : liquid;
        const description = liquid === 'water' || liquid === 'limitless water'
            ? killer : withIndefiniteArticle(killer);
        if (!await reviveHeroFromLiquid(state, publish, random)) {
            await die({
                killer,
                deathCause: `drowned in ${description}`,
                deathType: DROWNING,
                possessionAnswer: 'n',
                deathVerb: 'drowned',
            });
        }
        if (state.program_state.gameover)
            return { entered: true, moved: false, died: true };
        const destination = safeTeleportDestination(state, random, rollOne);
        if (destination) {
            // C trap.c:5189 -> safe_teleds(TELEDS_ALLOW_DRAG | TELEDS_TELEPORT)
            // -> teleds(): a light hero may drag an adjacent ball, and the
            // rescue relocation still prints the verbose materialize line
            // (teleport.c:545-547).
            const { arrival: escape } = await moveHeroByTeleport(destination.x, destination.y, state, {
                allowDrag: true,
                finishArrival: async (movement) => {
                    if (state.flags?.verbose !== false) {
                        await publish(`You materialize in ${movement.oldx === movement.x && movement.oldy === movement.y
                            ? 'the same' : 'a different'} location!`);
                    }
                    return finishLiquidTeleport(movement, {
                        state, repaint, resetVision, recalculateVision, applyLandingEffects,
                    });
                },
            });
            if (!escape.died) {
                await setHeroInWater(false, state);
                state.underwater = false;
                await announceTerrainRescue(DROWNING, state, publish);
            }
            return escape;
        }
        await publish("You're still drowning.");
    }
    await setHeroInWater(false, state);
    state.underwater = false;
    await announceTerrainRescue(DROWNING, state, publish);
    // C drown() returns TRUE after rescue even when no safe landing exists.
    return { entered: true, moved: true, died: false };
}
// Terrain that blocks ordinary movement. C hack.c.
export function blocksMove(x, y) {
    const loc = game.level?.at(x, y);
    if (!loc)
        return true;
    if (loc.typ === STONE)
        return true;
    if (IS_WALL(loc.typ) || IS_OBSTRUCTED(loc.typ))
        return true;
    if (loc.typ === DOOR && (loc.doormask & (D_CLOSED | D_LOCKED)))
        return true;
    return false;
}
// test_move()'s ooze test (C hack.c:1075-1082): a closed door that this
// body, unable to pass walls, can ooze under.
function heroOozesUnderDoor(destination, g = game) {
    return destination?.typ === DOOR
        && !!(destination.doormask & (D_CLOSED | D_LOCKED))
        && !heroPassesWalls(g) && heroCanOoze(g);
}
// C test_move(TEST_MOVE): tests obstacles without performing auto-open,
// boulder pushing, or the hero's eventual movement.
export function heroTestMove(x, y, g = game) {
    return testHeroMove(g.u.ux, g.u.uy, x, y, 'test', g).passes;
}
// C test_move(TEST_MOVE) from an arbitrary origin square. zap.c bhit()
// checks the chain's next step from a thrown iron ball's previous square.
export function heroMoveBlockedBetween(fromX, fromY, x, y, g = game) {
    return !testHeroMove(fromX, fromY, x, y, 'test', g).passes;
}
// Shop doorway checks print even during a path search (C block_door()/
// block_entry() pline from inside test_move()), so publish them at this
// awaited boundary while the shared movement decision stays pure.
async function testTravelMove(fromX, fromY, x, y, mode, g) {
    const result = testHeroMove(fromX, fromY, x, y, mode, g);
    if (result.blockedBy) {
        const name = shopkeeperName(result.blockedBy, { state: g, capitalized: true });
        const senses = propertyIsActive('invisible', g) ? ' senses your motion and' : '';
        await plineWithContinuation(`${name}${senses} blocks your way!`);
    }
    return result.passes;
}
// C hack.c:test_move().  The physical checks shared by DO_MOVE, TEST_MOVE,
// TEST_TRAV and TEST_TRAP: travel admits closed doors and checks consecutive
// boulders, and the trap mode reports hazards after checking entry, before
// checking exit.  C's DO_MOVE messages, auto-open, chewing and boulder
// pushing cannot live in this synchronous decision (click menus call
// TEST_MOVE without awaiting), so domoveCore() performs the DO_MOVE branches
// inline at C's test_move() call site (hack.c:2843).
function testHeroMove(fromX, fromY, x, y, mode, g) {
    if (!isok(x, y))
        return { passes: false };
    const hero = g.u;
    const location = g.level?.at(x, y);
    if (!location)
        return { passes: false };
    const passesWalls = heroPassesWalls(g);
    const tunnels = speciesTunnels(heroSpecies(g)) && !needspick(heroSpecies(g));
    const underwater = !!(hero.uinwater || g.underwater);
    let checkDoorEntry = location.typ === DOOR;
    if (IS_OBSTRUCTED(location.typ) || location.typ === IRONBARS) {
        if (!heroCanPassWallAt(g, x, y)) {
            if (underwater)
                return { passes: false };
            if (location.typ === IRONBARS) {
                if (!passesWalls && !monsterPassesBars({ mnum: heroSpecies(g) }))
                    return { passes: false };
            }
            else if (!tunnels)
                return { passes: false };
        }
    }
    else if (closedTravelDoor(x, y, g)) {
        if (passesWalls || heroCanOoze(g))
            checkDoorEntry = false;
        else {
            if (underwater)
                return { passes: false };
            if (tunnels)
                checkDoorEntry = false;
            else if (mode === 'test')
                return { passes: false };
        }
    }
    const dx = x - fromX, dy = y - fromY;
    if (dx && dy) {
        if (!passesWalls && checkDoorEntry) {
            if (blocksDiagonalDoor(null, location))
                return { passes: false };
            const blockedBy = shopkeeperBlockingDoor(x, y, g);
            if (blockedBy)
                return { passes: false, blockedBy };
        }
        if (heroBadRock(g, fromX, y) && heroBadRock(g, x, fromY)) {
            if (heroTightDiagonalReason(g))
                return { passes: false };
        }
        else if (wormCrossesBetween(fromX, fromY, x, y, g))
            return { passes: false };
    }
    // Reverse searches must be able to return to the hero's square.
    if (g.context.run === 8 && (x !== hero.ux || y !== hero.uy)) {
        if (knownRunTrap(x, y, g))
            return { passes: mode === 'trap' };
        if (location.seenv && isPoolOrLavaAt(x, y, g)) {
            const liquidWall = IS_WATERWALL(location.typ) || location.typ === LAVAWALL;
            const inAir = propertyIsActive('levitation', g) || propertyIsActive('flying', g);
            const canWalk = isPoolAt(x, y, g) ? heroKnowsWaterWalking(g)
                : heroKnowsLavaWalking(g) && isLavaAt(hero.ux, hero.uy, g);
            if (liquidWall || !(inAir || canWalk))
                return { passes: mode === 'trap' };
        }
    }
    if (mode === 'trap')
        return { passes: false };
    const origin = g.level?.at(fromX, fromY);
    if (dx && dy && !passesWalls && origin?.typ === DOOR) {
        if (blocksDiagonalDoor(origin, null))
            return { passes: false };
        const blockedBy = shopkeeperBlockingEntry(x, y, g);
        if (blockedBy)
            return { passes: false, blockedBy };
    }
    if (travelBoulderAt(x, y, g) && (!passesWalls || g.level?.flags.sokoban_rules)) {
        if (mode === 'test') {
            if ((g.context.run ?? 0) >= 2 && !heroIsBlind(g)
                && !heroIsHallucinating(g) && !heroCouldMoveOntoBoulder(x, y, g))
                return { passes: false };
        }
        else {
            if (g.level?.flags.sokoban_rules)
                return { passes: false };
            if (travelBoulderAt(fromX, fromY, g) && !passesWalls
                && !heroCouldMoveOntoBoulder(fromX, fromY, g) && !tunnels
                && !g.inventory.some(object => object.otyp === PICK_AXE
                    || object.otyp === DWARVISH_MATTOCK
                    || object.otyp === WAN_DIGGING && !objectTypeKnown(object, g)))
                return { passes: false };
        }
    }
    return { passes: true };
}
function runDist2(x1, y1, x2, y2) {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return dx * dx + dy * dy;
}
// C refs: hack.c findtravelpath(TRAVP_TRAVEL), test_move(TEST_TRAV).
// NetHack searches backwards from the destination, cardinal directions
// first, and uses the predecessor of the hero as the next travel step.  A
// fresh search is intentional: doors, boulders, traps, and monsters can make
// yesterday's route invalid between automatic turns.
export const TRAVEL_DIRECTIONS = [
    [-1, 0], [0, -1], [1, 0], [0, 1],
    [-1, -1], [1, -1], [1, 1], [-1, 1],
];
function closedTravelDoor(x, y, g) {
    const location = g.level?.at(x, y);
    return location?.typ === DOOR && !!(location.doormask & (D_CLOSED | D_LOCKED));
}
function travelBoulderAt(x, y, g) {
    return !!g.level?.objects[x]?.[y]?.some(object => object.otyp === BOULDER);
}
function travelCellKnown(x, y, g) {
    const location = g.level?.at(x, y);
    return !!location && (!!location.seenv || !heroIsBlind(g) && couldsee(x, y));
}
// hack.c:findtravelpath() uses DISP_ALL so search markers include unseen
// squares. Crawl mode holds frontiers for three delays and guessed goals
// for five; ending the effect restores the map before movement continues.
async function showTravelSearch(positions, warningLevel, g) {
    if (!g.iflags.trav_debug)
        return;
    const symbol = def_warnsyms[warningLevel];
    if (!symbol)
        throw new Error(`Missing travel warning glyph ${warningLevel}`);
    const effect = new TemporaryMapEffect('all', {
        ch: symbol.ch, color: symbol.color, decgfx: false,
        kind: 'warning', glyph: GlyphOffset.warning + warningLevel,
    });
    await effect.start();
    try {
        for (const [x, y] of positions)
            await effect.show(x, y);
        const pauses = g.flags.runmode === 'crawl' ? (warningLevel === 1 ? 3 : 5) : 1;
        for (let pause = 0; pause < pauses; pause++)
            await g.animationFrame?.();
    }
    finally {
        await effect.end();
    }
}
// C findtravelpath(): each radius preserves cardinal-first frontier order.
// Door, boulder and trap delays apply to each edge before TEST_TRAV, in all
// three search modes. The origin starts unmarked, as in C's zeroed matrix.
async function searchTravelPath(startX, startY, goalX, goalY, mode, g) {
    let frontier = [[startX, startY]];
    const distance = new Map();
    const directions = MONSTER_NAME[heroSpecies(g)] === 'grid bug'
        ? TRAVEL_DIRECTIONS.slice(0, 4) : TRAVEL_DIRECTIONS;
    for (let radius = 1; frontier.length; radius++) {
        const next = [];
        for (const [x, y] of frontier) {
            let repeated = false;
            for (const [dx, dy] of directions) {
                const nx = x + dx, ny = y + dy;
                if (!isok(nx, ny) || mode === 'guess' && !couldsee(nx, ny))
                    continue;
                const delayed = !heroPassesWalls(g) && !heroCanOoze(g) && closedTravelDoor(x, y, g)
                    || travelBoulderAt(x, y, g) && !heroCouldMoveOntoBoulder(x, y, g)
                    || await testTravelMove(x, y, nx, ny, 'trap', g);
                if (delayed && (distance.get(y * COLNO + x) ?? 0) > radius - 3) {
                    if (!repeated)
                        next.push([x, y]);
                    repeated = true;
                    continue;
                }
                if (!await testTravelMove(x, y, nx, ny, 'travel', g)
                    || !travelCellKnown(nx, ny, g))
                    continue;
                if (nx === goalX && ny === goalY) {
                    if (mode !== 'guess')
                        return { distance, direction: { dx: x - goalX, dy: y - goalY } };
                }
                else if (!distance.has(ny * COLNO + nx)) {
                    distance.set(ny * COLNO + nx, radius);
                    next.push([nx, ny]);
                }
            }
        }
        await showTravelSearch(next, 1, g);
        frontier = next;
    }
    return { distance, direction: null };
}
// C hack.c:is_valid_travelpt().  Saves and restores the travel target
// around findtravelpath(TRAVP_VALID), like C's u.tx/u.ty swap.
export async function isValidTravelTarget(targetX, targetY, g = game) {
    if (g.u.ux === targetX && g.u.uy === targetY)
        return true;
    if (glyphAt(targetX, targetY, g)?.glyph === cmapToGlyph(CmapSymbol.stone)
        && !g.level?.at(targetX, targetY)?.seenv)
        return false;
    return await findtravelpath('valid', targetX, targetY, g);
}
// findtravelpath()'s selection_setpoint(u.ux, u.uy, gt.travelmap, 1) (C
// hack.c:1416, 1486).  selvar.c:186-187: a freed (NULL) selection ignores
// the write, and the map only comes back at the next findtravelpath() entry.
function markTravelStep(x, y, g) {
    if (!g._travelMap)
        return;
    g._travelMap.add(y * COLNO + x);
}
function travelDistance(x1, y1, x2, y2) {
    return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
}
function travelDistanceSquared(x1, y1, x2, y2) {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return dx * dx + dy * dy;
}
// C hack.c:findtravelpath().  TRAVP_TRAVEL searches backward from the
// target so the predecessor of the hero is the next step; TRAVP_GUESS
// limits the forward search to couldsee() squares, then re-enters the
// backward search from the guessed goal; TRAVP_VALID searches forward to a
// candidate.  Like C, the direction travels in u.dx/u.dy and the travel
// map in gt.travelmap (g._travelMap); domove_core()'s travel block below
// and is_valid_travelpt() above are the callers.  searchTravelPath() is
// the shared `noguess' loop of hack.c:1315-1449.
async function findtravelpath(mode, targetX, targetY, g) {
    g._travelMap ??= new Set();
    /* if travel to adjacent, reachable location, use normal movement rules */
    if (mode !== 'guess' && g.context.travel1
        && travelDistance(g.u.ux, g.u.uy, targetX, targetY) === 1) {
        requirePlayingGame(g);
        if (await crawlDestinationAllowed(g, targetX, targetY, rn2, plineWithContinuation)) {
            stopRun(g, false);
            if (await testTravelMove(g.u.ux, g.u.uy, targetX, targetY, 'test', g)) {
                if (mode === 'travel') {
                    g.u.dx = targetX - g.u.ux;
                    g.u.dy = targetY - g.u.uy;
                    nomul(0, g);
                    g._travelTarget = null;
                }
                return true;
            }
            if (mode === 'travel')
                g.context.run = 8;
        }
    }
    if (targetX !== g.u.ux || targetY !== g.u.uy) {
        let searchMode = mode;
        let searchTargetX = targetX, searchTargetY = targetY;
        for (;;) { /* noguess: */
            const search = searchMode === 'travel'
                ? await searchTravelPath(searchTargetX, searchTargetY, g.u.ux, g.u.uy, 'travel', g)
                : await searchTravelPath(g.u.ux, g.u.uy, searchTargetX, searchTargetY, searchMode, g);
            if (searchMode !== 'guess') {
                const direction = search.direction;
                if (direction) {
                    /* reached the search goal (C hack.c:1398-1418) */
                    const nextX = g.u.ux + direction.dx, nextY = g.u.uy + direction.dy;
                    const visited = (g._travelMap ?? new Set())
                        .has(nextY * COLNO + nextX);
                    g.u.dx = direction.dx;
                    g.u.dy = direction.dy;
                    if (searchMode === 'travel'
                        && (nextX === targetX && nextY === targetY || visited)) {
                        nomul(0, g);
                        /* reset run so domove run checks work */
                        g.context.run = 8;
                        if (visited)
                            await plineWithContinuation('You stop, unsure which way to go.');
                        else
                            g._travelTarget = null;
                    }
                    markTravelStep(g.u.ux, g.u.uy, g);
                    return true;
                }
                return false;
            }
            /* if guessing, find best location in travel matrix and go there */
            const { distance } = search;
            let pickX = g.u.ux, pickY = g.u.uy;
            let bestDistance = travelDistance(targetX, targetY, g.u.ux, g.u.uy);
            let bestSquared = travelDistanceSquared(targetX, targetY, g.u.ux, g.u.uy);
            let bestPath = COLNO * ROWNO;
            for (let x = 1; x < COLNO; x++) {
                for (let y = 0; y < ROWNO; y++) {
                    const path = distance.get(y * COLNO + x);
                    if (!path || !couldsee(x, y))
                        continue;
                    const candidateDistance = travelDistance(targetX, targetY, x, y);
                    const candidateSquared = travelDistanceSquared(targetX, targetY, x, y);
                    if (candidateDistance < bestDistance
                        || candidateDistance === bestDistance && path < bestPath && candidateSquared < bestSquared) {
                        pickX = x;
                        pickY = y;
                        bestDistance = candidateDistance;
                        bestSquared = candidateSquared;
                        bestPath = path;
                    }
                }
            }
            if (pickX === g.u.ux && pickY === g.u.uy) {
                /* no guesses, just go in the general direction */
                g.u.dx = Math.sign(targetX - g.u.ux);
                g.u.dy = Math.sign(targetY - g.u.uy);
                if (await testTravelMove(g.u.ux, g.u.uy, g.u.ux + g.u.dx, g.u.uy + g.u.dy, 'test', g)) {
                    markTravelStep(g.u.ux, g.u.uy, g);
                    return true;
                }
                break; /* goto found */
            }
            await showTravelSearch([[pickX, pickY]], 2, g);
            searchMode = 'travel';
            searchTargetX = pickX;
            searchTargetY = pickY;
        }
    }
    return false;
}
// domove_core()'s travel block (C hack.c:2724-2728): one TRAVP_TRAVEL
// attempt, then TRAVP_GUESS, then travel1 = 0.  A failed guess leaves the
// zero direction of C's `found:' tail (hack.c:1518-1522) before the rest
// of domove_core() runs.
async function selectTravelStep(state) {
    requirePlayingGame(game);
    if (!await findtravelpath('travel', state.targetX, state.targetY, game)
        && !await findtravelpath('guess', state.targetX, state.targetY, game)) {
        game.u.dx = 0;
        game.u.dy = 0;
        nomul(0, game);
    }
    game.context.travel1 = false;
    return { dx: game.u.dx ?? 0, dy: game.u.dy ?? 0 };
}
// lookaround()'s travel window (C hack.c:3905-3940, 4005-4008, read with
// context.run == 8): moveloop runs it before every automatic travel step.
// Travel stops for a grid-bug diagonal, a visible monster that is not
// peaceful-safe, a known trap directly ahead of the previous step's
// direction, or liquid ahead that the hero cannot safely cross.  Doors,
// objects, stairs, and the corridor turning of run modes do not stop
// travel, so only the front square needs terrain checks.  lookaroundRun()
// below is the full C-order port for run modes; travel reads u.dx/u.dy
// rather than the run state's persistent direction.
async function travelLookaroundStops(g = game) {
    const u = g.u;
    const noDiagonal = MONSTER_NAME[u.umonnum ?? -1] === 'grid bug';
    if (noDiagonal && u.dx && u.dy) {
        await plineWithContinuation('You cannot move diagonally.');
        return true;
    }
    const level = g.level;
    if (heroIsBlind(g) || !g.context.run || !level)
        return false;
    const confused = (u.confusionTurns ?? 0) > 0;
    const stunned = !!(u.stunned || (u.stunnedTurns ?? 0) > 0);
    const hallucinating = heroIsHallucinating(g);
    const frontX = u.ux + (u.dx ?? 0), frontY = u.uy + (u.dy ?? 0);
    // lookaround() checks each square's monster and terrain before moving
    // to the next square, with columns outside rows.
    for (let x = u.ux - 1; x <= u.ux + 1; x++) {
        for (let y = u.uy - 1; y <= u.uy + 1; y++) {
            if (!isok(x, y) || (x === u.ux && y === u.uy))
                continue;
            if (noDiagonal && x !== u.ux && y !== u.uy)
                continue;
            const monster = monsterAtPosition(level, x, y, g);
            // display.h:_is_safemon(): safe_dog protects a peaceful monster
            // the hero can spot, only while unconfused, unstunned, and sane.
            const safeMonster = monster && (g.flags.safe_dog ?? true)
                && monster.mpeaceful && canSpotMonster(monster)
                && !confused && !hallucinating && !stunned;
            if (monster && M_AP_TYPE(monster) !== M_AP_FURNITURE
                && M_AP_TYPE(monster) !== M_AP_OBJECT
                && monsterVisible(monster, g) && !safeMonster) {
                if (g.flags.mention_walls) {
                    // C lookaround() reports the blocking monster via pline_xy().
                    set_msg_xy(x, y);
                    await plineWithContinuation(`${monsterName(monster, { state: g, article: 'a', capitalized: true })} blocks your path.`);
                }
                return true;
            }
            const location = level.at(x, y);
            if (!location || location.typ === STONE)
                continue;
            if (x === u.ux - (u.dx ?? 0) && y === u.uy - (u.dy ?? 0))
                continue;
            if (x !== frontX || y !== frontY)
                continue;
            const trap = knownRunTrap(x, y, g);
            if (trap) {
                await announceRunTrap(trap, g);
                return true;
            }
            if (runLiquidIsDangerous(x, y, g)) {
                await announceRunLiquid(x, y, g);
                return true;
            }
        }
    }
    return false;
}
// C hack.c:lookaround(). Count nearby corridor choices before deciding
// whether to turn, and stop for visible actors, known traps, or liquid edges.
export async function lookaroundRun(state = game._runState, g = game) {
    if (!state || state.mode === 8 || !g.u || !g.level)
        return false;
    const noDiagonal = MONSTER_NAME[g.u.umonnum ?? -1] === 'grid bug';
    if (noDiagonal && state.dx && state.dy) {
        await plineWithContinuation('You cannot move diagonally.');
        return false;
    }
    if (heroIsBlind(g))
        return true;
    // C lookaround() reads svc.context.run live at every repeated step;
    // a counted walk keeps whatever value an earlier rush or travel left
    // behind, so the checks cannot key off this repeat's own mode.
    const run = g.context.run ?? 0;
    if (run === 0)
        return true;
    const u = g.u;
    let corrct = 0;
    let noturn = false;
    let x0 = 0, y0 = 0, m0 = 1, i0 = 9;
    const targetX = u.ux + state.dx;
    const targetY = u.uy + state.dy;
    const currentTyp = g.level.at(u.ux, u.uy)?.typ;
    for (let x = u.ux - 1; x <= u.ux + 1; x++) {
        for (let y = u.uy - 1; y <= u.uy + 1; y++) {
            if (x < 1 || x >= COLNO || y < 0 || y >= ROWNO
                || (x === u.ux && y === u.uy))
                continue;
            if (noDiagonal && x !== u.ux && y !== u.uy)
                continue;
            const infront = x === targetX && y === targetY;
            const monster = monsterAtPosition(g.level, x, y, g);
            // hack.c:lookaround() considers an actor interesting only inside
            // its mon_visible() branch.  An invisible monster directly in
            // front must reach domove()/attack_checks(), which remembers the
            // unseen occupant instead of silently ending the run.
            const visibleMonster = monster && M_AP_TYPE(monster) !== M_AP_FURNITURE
                && M_AP_TYPE(monster) !== M_AP_OBJECT
                && monsterVisible(monster, g);
            const safeMonster = monster && (g.flags.safe_dog ?? true)
                && monster.mpeaceful && canSpotMonster(monster) && !g.context.forcefight
                && !(u.confusionTurns ?? 0) && !u.stunned && !(u.stunnedTurns ?? 0)
                && !heroIsHallucinating(g);
            const visibleHostile = visibleMonster && !safeMonster;
            if (visibleMonster && (infront
                || (run !== 1 && visibleHostile))) {
                if (g.flags.mention_walls) {
                    // C lookaround() reports the blocking monster via pline_xy().
                    set_msg_xy(x, y);
                    await plineWithContinuation(`${monsterName(monster, { state: g, article: 'a', capitalized: true })} blocks your path.`);
                }
                return false;
            }
            const loc = g.level.at(x, y);
            if (!loc)
                continue;
            const typ = loc.typ;
            if (typ === STONE)
                continue;
            if (x === u.ux - state.dx && y === u.uy - state.dy)
                continue;
            let corridorLike = false;
            const trap = knownRunTrap(x, y, g);
            if (trap && run !== 1 && infront) {
                await announceRunTrap(trap, g);
                return false;
            }
            if (trap && run === 1) {
                corridorLike = true;
            }
            else if (IS_OBSTRUCTED(typ) || typ === ROOM || IS_AIR(typ)
                || typ === ICE) {
                continue;
            }
            else if (typ === DOOR || hasDoorAppearance(monster)) {
                const closed = hasDoorAppearance(monster) || !!(loc.doormask & (D_CLOSED | D_LOCKED));
                if (closed) {
                    if (x !== u.ux && y !== u.uy)
                        continue;
                    if (run !== 1) {
                        if (g.flags.mention_walls) {
                            // C lookaround() marks the door square via set_msg_xy().
                            set_msg_xy(x, y);
                            await plineWithContinuation('You stop in front of the door.');
                        }
                        return false;
                    }
                    corridorLike = true;
                }
                else if (run === 1) {
                    corridorLike = true;
                }
                else if (run === 8) {
                    continue;
                }
                else if (monster) {
                    continue;
                }
                else if ((x === u.ux - state.dx
                    && y !== u.uy + state.dy)
                    || (y === u.uy - state.dy
                        && x !== u.ux + state.dx)) {
                    continue;
                }
                else {
                    // hack.c:lookaround() treats an open/doorless doorway as
                    // interesting to run/rush modes 2 and 3.  Mode 1 alone
                    // folds it into corridor turning.
                    return false;
                }
            }
            else if (typ === CORR) {
                corridorLike = true;
            }
            else if (isPoolOrLavaAt(x, y, g)) {
                if (infront && runLiquidIsDangerous(x, y, g)) {
                    await announceRunLiquid(x, y, g);
                    return false;
                }
                continue;
            }
            else {
                if (run === 1) {
                    // For run mode 1, stairs, furniture, and other non-room
                    // locations participate in corridor routing (the C
                    // bcorr branch) instead of being interesting stop points.
                    corridorLike = true;
                }
                else if (run === 8) {
                    // hack.c:4012: a leftover travel value rides a counted
                    // walk without travel set, so objects and stairs ahead
                    // are not stop points for it.
                    continue;
                }
                else if (monster) {
                    continue;
                }
                else if ((x === u.ux - state.dx
                    && y !== u.uy + state.dy)
                    || (y === u.uy - state.dy
                        && x !== u.ux + state.dx)) {
                    continue;
                }
                else {
                    return false;
                }
            }
            if (!corridorLike || currentTyp === ROOM)
                continue;
            if (run === 1 || run === 3 || run === 8) {
                const distance = runDist2(x, y, targetX, targetY);
                if (distance > 2)
                    continue;
                if (corrct === 1 && runDist2(x, y, x0, y0) !== 1)
                    noturn = true;
                if (distance < i0) {
                    i0 = distance;
                    x0 = x;
                    y0 = y;
                    m0 = monster ? 1 : 0;
                }
            }
            corrct++;
        }
    }
    if (corrct > 1 && run === 2) {
        if (g.flags.mention_walls)
            await plineWithContinuation('The corridor widens here.');
        return false;
    }
    if ((run === 1 || run === 3 || run === 8) && !noturn && !m0 && i0
        && (corrct === 1 || (corrct === 2 && i0 === 1))) {
        let turn;
        if (i0 === 2) {
            turn = state.dx === y0 - u.uy && state.dy === u.ux - x0
                ? 2 : -2;
        }
        else if (state.dx && state.dy) {
            turn = ((state.dx === state.dy && y0 === u.uy)
                || (state.dx !== state.dy && y0 !== u.uy)) ? -1 : 1;
        }
        else {
            turn = ((x0 - u.ux === y0 - u.uy && !state.dy)
                || (x0 - u.ux !== y0 - u.uy && state.dy)) ? 1 : -1;
        }
        turn += g.lastStrTurn ?? 0;
        if (turn >= -2 && turn <= 2) {
            g.lastStrTurn = turn;
            state.dx = x0 - u.ux;
            state.dy = y0 - u.uy;
            u.dx = state.dx;
            u.dy = state.dy;
        }
    }
    return true;
}
// C allmain.c:moveloop_core() repeats hack.c:lookaround() and domove().
export async function continueRun(g = game) {
    const state = g._runState;
    if (state?.mode === 8) {
        // C hack.c:lookaround() stops travel through its `stop:` label
        // (grid-bug diagonals stop directly), and every stop runs nomul(0),
        // whose `disp.botl |= (multi >= 0)` (hack.c:4165) marks the whole
        // status line dirty -- not just end_running()'s time_botl.
        if (await travelLookaroundStops(g)) {
            endVoluntaryMultiTurn(g);
            g.context.move = 0;
            return { attemptedMove: false, tookTime: false };
        }
        await captureRunmodeDelay(g, !!g.context.run || g.multi > 0);
        if (g.multi < COLNO && --g.multi === 0)
            stopRun(g);
        const outcome = await domove(g.u.dx ?? 0, g.u.dy ?? 0, false);
        const moved = outcome === 'time';
        if (g.program_state.gameover)
            return { attemptedMove: true, tookTime: false };
        // C domove_core() skips runmode_delay_output() on early returns,
        // including attacks, blocked steps and the final travel pet bump.
        // A refused pet swap reaches the tail after restoring the hero.
        const reachedTail = !!g._domoveReachedTail;
        if (moved && reachedTail)
            await captureRunmodeDelay(g, !!g.context.run || g.multi > 0);
        g.context.move = moved ? 1 : 0;
        const arrived = g.u.ux === state.targetX && g.u.uy === state.targetY;
        if (arrived)
            g._travelTarget = null;
        if (!moved && outcome !== 'opened-door')
            stopRun(g);
        // Only findtravelpath()'s own nomul(0)-then-run=8 paths (the
        // adjacent shortcut and the backward-search arrival) keep C's
        // lingering run at 8.  A step that entered the target without
        // one of those -- the general-direction fallback, whose C twin
        // (hack.c:1481-1488) skips nomul(0) -- ends on the next pass at
        // found: (hack.c:1518-1522), where nomul(0) leaves run 0 with
        // the time repaint pending.
        else if (arrived && !g._runState)
            arriveTravel(g);
        else if (arrived)
            stopRun(g);
        // Pathfinding can end travel without entering the target. Keep
        // C's restored run value and let screen flushes own time updates.
        else if (!g._runState && g.context.run === 8)
            arriveTravel(g);
        return { attemptedMove: true, tookTime: moved };
    }
    if (!state) {
        stopRun(g);
        g.context.move = 0;
        return { attemptedMove: false, tookTime: false };
    }
    // C hack.c:lookaround() funnels every rush stop (visible monster, trap,
    // closed door, dangerous liquid, interesting terrain, the widening
    // corridor of a `g' rush, grid-bug diagonals) through `stop: nomul(0);`.
    // nomul(0) marks the status line dirty (`disp.botl |= (multi >= 0)',
    // hack.c:4165), so the next bot() repaints fields changed since the
    // last full render -- e.g. the silent chain-lightning Pw decrement of
    // spell.c:1087, which itself never sets disp.botl.
    if (!await lookaroundRun(state, g)) {
        endVoluntaryMultiTurn(g);
        g.context.move = 0;
        return { attemptedMove: false, tookTime: false };
    }
    await captureRunmodeDelay(g, !!g.context.run || g.multi > 0);
    if (g.multi < COLNO && --g.multi === 0)
        stopRun(g);
    const outcome = await domove(state.dx, state.dy, false);
    const moved = outcome === 'time';
    if (g.program_state.gameover)
        return { attemptedMove: true, tookTime: false };
    if (moved && g._domoveReachedTail)
        await captureRunmodeDelay(g, !!g.context.run || g.multi > 0);
    g.context.move = moved ? 1 : 0;
    if (!moved && outcome !== 'opened-door')
        stopRun(g);
    return { attemptedMove: true, tookTime: moved };
}
// C hack.c:domove_fight_ironbars(). Decide breakage before removing the
// wielded object, so only one item breaks and the remaining stack stays held.
export async function strikeIronBarsWithWeapon(weapon, x, y, state = game) {
    const breaksOnImpact = objectBreaksOnImpact(weapon);
    let object = weapon;
    if (breaksOnImpact) {
        if (weapon.quan > 1) {
            const split = splitObjectStack(weapon, 1, state);
            if (!split)
                throw new Error('A wielded stack hitting bars could not be split.');
            object = split;
        }
        else {
            await setPrimaryWeapon(null, state);
        }
        await freeInventoryObject(object, state);
    }
    await hitIronBars(object, { kind: 'wielded', breaksOnImpact }, {
        x: state.u.ux, y: state.u.uy, barsX: x, barsY: y, state,
    });
}
// C hack.c:domove_fight_web().  Force-fighting a seen web: Sting or a
// flaming artifact cuts or burns through, unsuitable weapons refuse with
// their description, and a successful swing against the adjusted roll
// dissolves the trap.
export async function fightSeenWebWithForce(x, y, state = game) {
    if (!state.context.forcefight)
        return false;
    const trap = state.level?.traps.find(candidate => candidate.tx === x && candidate.ty === y);
    if (!trap || trap.ttyp !== WEB || !trap.tseen)
        return false;
    requirePlayingGame(state);
    const weapon = state.uwep ?? state.u.uwep ?? null;
    const swap = state.uswapwep ?? state.u.uswapwep ?? null;
    const dualWielding = !!state.u.twoweap;
    const weaponType = dualWielding ? P_TWO_WEAPON_COMBAT : weaponSkillType(weapon);
    // minus_2: restricted or unskilled: -1, basic: 0, skilled: 1, expert: 2
    const skillMinus2 = Math.max(ensureHeroSkills(state)?.[weaponType]?.skill ?? P_ISRESTRICTED, P_UNSKILLED) - 2;
    // For the weaponless case the chance to succeed is adjusted instead of
    // possibly granting two tries.
    const roll = rn2(weapon ? 20 : 45 - 5 * skillMinus2);
    const artifact = weapon ? artifactById(weapon.oartifact, state) : null;
    const wieldsSting = artifact?.name === 'Sting';
    const burnsWebs = artifact?.attack?.damageType === 'fire';
    if (weapon && (wieldsSting || burnsWebs)) {
        // Guaranteed success; Sting and flaming artifacts skip the practice.
        await pline(`${artifact?.name ?? ''} ${wieldsSting ? 'cuts' : 'burns'} through the web!`);
    }
    else if (weapon && !isBlade(weapon)
        && (!dualWielding || !isBlade(swap))) {
        const primaryDescription = weaponDescription(weapon);
        const secondaryDescription = dualWielding && swap
            ? weaponDescription(swap) : '';
        // A dual-wielded secondary is only mentioned for a different type
        // description from the primary.
        const onewep = !secondaryDescription
            || primaryDescription === secondaryDescription;
        let primaryPhrase;
        if (['armor', 'food', 'venom'].includes(primaryDescription.toLowerCase())) {
            primaryPhrase = primaryDescription;
        }
        else if (weapon.quan === 1 && !(dualWielding && onewep)) {
            primaryPhrase = withIndefiniteArticle(primaryDescription);
        }
        else {
            primaryPhrase = makePlural(primaryDescription);
        }
        let secondaryPhrase = '';
        if (!onewep && swap) {
            secondaryPhrase = swap.quan === 1
                ? withIndefiniteArticle(secondaryDescription)
                : makePlural(secondaryDescription);
        }
        await pline(`You can't cut a web with ${primaryPhrase}`
            + `${!onewep ? ' or ' : ''}${secondaryPhrase}!`);
        return true;
    }
    else if (roll > currentStrength(state) - 2
        + (weapon ? (weapon.spe ?? 0) + skillMinus2 : 0)) {
        await pline(`You ${weapon ? 'hack' : 'thrash'} ineffectually at some of the strands.`);
        return true;
    }
    else {
        await pline(`You ${weapon ? 'cut' : 'punch'} through the web.`);
        // Cutting a web this way does not break the "never hit with a
        // wielded weapon" conduct but does practice the weapon skill.
        await useHeroSkill(weaponType, 1, { state });
    }
    deleteTrap(trap, state);
    await newsym(x, y);
    return true;
}
// C hack.c:domove_fight_empty(). Forced attacks at the map edge and
// ordinary moves into remembered invisible-monster knowledge converge here.
// Both spend the action without entering terrain movement; only the
// remembered-invisible path is excluded by nopick.
async function fightEmptyDestination(x, y) {
    requirePlayingGame(game);
    const offEdge = !isok(x, y);
    const loc = offEdge ? null : game.level.requireAt(x, y);
    const glyph = offEdge ? null : glyphAt(x, y);
    const forcefight = !!game.context.forcefight;
    const rememberedInvisible = glyph?.kind === 'invisible';
    if (!forcefight
        && (!rememberedInvisible || monsterAtPosition(game.level, x, y)
            || game.context.nopick))
        return false;
    // domove_fight_empty() is still the hero's attack attempt even when no
    // live monster occupies the destination.  The following monster phase
    // observes that command ownership at fatal tty/status boundaries.
    game._heroMeleeThisCommand = true;
    const explosion = heroIsPolymorphed(game)
        ? requireMonsterData(MONSTER_ATTACKS, heroSpecies(game)).find(([type]) => type === AT_EXPL)
        : undefined;
    const surface = loc?.typ === DRAWBRIDGE_UP
        ? drawbridgeUnderlyingType(loc.drawbridgemask ?? 0) : loc?.typ;
    const closedDoor = loc?.typ === DOOR && !!(loc.doormask & (D_CLOSED | D_LOCKED));
    const solid = !loc || surface === undefined || !ACCESSIBLE(surface)
        || closedDoor || IS_FURNITURE(loc.typ);
    const underwater = !!(game.underwater || game.u.uinwater);
    let obstacle;
    let target = 'an unknown obstacle';
    if (loc) {
        if (!underwater) {
            const objects = game.level.objects[x]?.[y] ?? [];
            obstacle = objects.find(object => object.otyp === BOULDER);
            if ((glyph?.kind === 'object' && glyph.statueGlyph)
                || (heroIsHallucinating(game) && glyph?.kind === 'monster'))
                obstacle = objects.find(object => object.otyp === STATUE);
            const weapon = game.uwep || game.u.uwep;
            if (forcefight && weapon && diggingTarget(weapon, x, y, game) !== DIGTYP_UNDIGGABLE
                && !rememberedInvisible && glyph?.kind !== 'monster') {
                game.u.dz = 0;
                await applyPickAxeDirection(weapon, {
                    state: game,
                    attackMonster: (monster, struckAt, permission) => do_attack(monster, struckAt.x, struckAt.y, { permission }),
                    payShopkeeper: dopay,
                });
                return true;
            }
        }
        await unmapObject(x, y);
        if (obstacle)
            await map_object(obstacle, true);
        await newsym(x, y);
        if (obstacle) {
            target = simpleObjectNameWithArticle(obstacle, game);
        }
        else if (underwater && !isPoolAt(x, y, game)) {
            target = Is_waterlevel(game.u.uz) && loc.typ === AIR ? 'an air bubble' : 'nothing';
        }
        else if (solid) {
            if (loc.seenv || IS_STWALL(loc.typ) || loc.typ === SDOOR || loc.typ === SCORR)
                target = `the ${terrain_glyph(loc, x, y).terrainName}`;
        }
        else {
            target = 'thin air';
        }
    }
    const manner = obstacle || solid ? explosion ? 'futilely ' : 'harmlessly ' : '';
    await pline(`You ${manner}${explosion ? 'explode at' : 'attack'} ${target}.`);
    endVoluntaryMultiTurn(game);
    if (explosion) {
        await wakeMonstersNearWithMessages(game.u.ux, game.u.uy, 49, game);
        if ((await resolveHeroCombatExplosion(null, explosion, { state: game })).heroDied)
            return true;
        game.u.mh = -1;
        await returnHeroToHumanForm(game);
    }
    return true;
}
// C hack.c:pooleffects() and trap.c:drown() use the shared destination input
// and spoteffects() entry after an escape from liquid.
export function applyHeroLiquidEffects(publish = plineWithContinuation, { entry = 'spot-effects' } = {}) {
    return heroLiquidEffects({
        publish, entry,
        chooseTeleportDestination: askTeleportDestination,
        applyLandingEffects: ({ from, to, pick = true }) => finishDestinationSpotEffects({
            oldx: from.x, oldy: from.y,
            newx: to.x, newy: to.y,
            publish, pick,
        }),
    });
}
// rm.h xFLOOR..xWATERWALL: the extra terrain pseudo-types classify_terrain()
// assigns (rm.h:100-107), indexing botl.c terrain_descr[] from MAX_TYPE on.
const FLOOR = 39, GROUND = 40, OPEN_DOOR = 41, SHUT_DOOR = 42, TERRAIN_SWAMP = 43, SUBMERGED = 44, SEA = 45, WATER_WALL = 46;
// C hack.c:classify_terrain().
export function classifyStatusTerrain(state) {
    const typ = terrainType(state);
    if (typ === state.iflags.terrain_typ)
        return;
    state.iflags.terrain_typ = typ;
    if (state.flags.terrainstatus && !state.context.run)
        state.context.botl = true;
}
function terrainType(state) {
    const hero = state.u;
    const location = state.level?.at(hero.ux, hero.uy);
    if (!location)
        return MAX_TYPE;
    if (hero.uinwater)
        return SUBMERGED;
    // Native uses lastseentyp so blindness and disguised furniture cannot
    // reveal the real terrain through this optional field.
    const typ = location.lastseentyp ?? STONE;
    switch (typ) {
        case STONE: return state.level?.flags.arboreal ? TREE : STONE;
        case CORR:
        case ROOM: return Is_earthlevel(hero.uz) ? GROUND : FLOOR;
        case DOOR:
            if (location.doormask & D_ISOPEN)
                return OPEN_DOOR;
            return location.doormask & (D_CLOSED | D_LOCKED | D_TRAPPED) ? SHUT_DOOR : DOOR;
        case DRAWBRIDGE_UP: {
            const under = drawbridgeUnderlyingType(location.drawbridgemask ?? 0);
            return under === STONE ? GROUND : under;
        }
        case MOAT:
            if (state.medusa_level && hero.uz?.dnum === state.medusa_level.dnum
                && hero.uz.dlevel === state.medusa_level.dlevel)
                return SEA;
            return Is_juiblex_level(hero.uz) ? TERRAIN_SWAMP : MOAT;
        case WATER: return Is_waterlevel(hero.uz) ? WATER : WATER_WALL;
        default: return typ;
    }
}
// hack.c:set_uinwater(). Entering or leaving water also changes terrain
// properties and the optional terrain status, even on the same square.
export async function setHeroInWater(inWater, state = game) {
    if (!!state.u.uinwater === inWater)
        return;
    state.u.uinwater = inWater ? 1 : 0;
    await switchHeroTerrain(state);
}
// C hack.c:switch_terrain().
export async function switchHeroTerrain(state = game) {
    const wasLevitating = propertyIsActive('levitation', state);
    const wasFlying = propertyIsActive('flying', state);
    const hero = state.u;
    const location = requireGameLevel(state).requireAt(hero.ux, hero.uy);
    const blocked = IS_OBSTRUCTED(location.typ)
        || (location.typ === DOOR && !!(location.doormask & (D_CLOSED | D_LOCKED)))
        || IS_WATERWALL(location.typ) || location.typ === LAVAWALL;
    if (blocked) {
        if (propertyIsActive('levitation', state))
            await plineWithContinuation("You can't levitate in here.");
        setPropertyTerrainBlocked('levitation', true, state);
    }
    else if (propertyIsBlocked('levitation', state)) {
        setPropertyTerrainBlocked('levitation', false, state);
        if (propertyIsActive('levitation', state) || propertyIsBlocked('levitation', state))
            await floatHeroUp(state);
    }
    if (blocked) {
        if (propertyIsActive('flying', state))
            await plineWithContinuation("You can't fly in here.");
        setPropertyTerrainBlocked('flying', true, state);
    }
    else if (propertyIsBlocked('flying', state)) {
        setPropertyTerrainBlocked('flying', false, state);
        refreshMovementProperties(state);
        state.context.botl = true;
        if (propertyIsActive('flying', state))
            await plineWithContinuation('You start flying.');
    }
    if (wasLevitating !== propertyIsActive('levitation', state)
        || wasFlying !== propertyIsActive('flying', state))
        state.context.botl = true;
    if (state.flags.terrainstatus)
        classifyStatusTerrain(state);
}
// C spoteffects() suppresses same-location recursion, but permits a changed
// square, terrain, or trap to start another transaction.
let spotDepth = 0;
let activeSpot = null;
// C spoteffects() static spottraptyp: while a trap is being triggered, a
// nested spoteffects() skips any trap of the same type, such as a fire
// trap reached by crawling out of the water its own flames melted.
let triggeringTrapType = null;
export async function finishDestinationSpotEffects({ oldx, oldy, newx, newy, trapOptions = {}, publish = plineWithContinuation, pick = true, }) {
    // C spoteffects() defers lava-rescue landing until lava_effects ends.
    if (game.iflags?.in_lava_effects)
        return { moved: false, died: false };
    requirePlayingGame(game);
    const location = game.level.at(newx, newy);
    if (!location)
        throw new RangeError(`No landing square at ${newx},${newy}.`);
    const typ = location.typ;
    let trap = game.level.traps.find(candidate => candidate.tx === newx && candidate.ty === newy);
    if (spotDepth && activeSpot && activeSpot.x === newx && activeSpot.y === newy
        && activeSpot.typ === typ
        && (!activeSpot.trap || !trap || activeSpot.trapType === trap.ttyp))
        return { moved: false, died: false };
    spotDepth++;
    activeSpot = { x: newx, y: newy, typ, trap, trapType: trap?.ttyp };
    try {
        game.iflags ||= {};
        if (game.iflags.terrain_typ == null)
            game.iflags.terrain_typ = MAX_TYPE;
        // Only classify_terrain() for the terrainstatus option updates
        // terrain_typ; otherwise it stays MAX_TYPE and every call switches.
        if (typ !== game.level.at(oldx, oldy)?.typ
            || game.iflags.terrain_typ === MAX_TYPE) {
            await switchHeroTerrain(game);
        }
        const liquid = await applyHeroLiquidEffects(publish);
        if (liquid?.entered && (liquid.moved || liquid.died || liquid.dismounted))
            return liquid;
        await checkSpecialRoom();
        if (IS_SINK(game.level.at(game.u.ux, game.u.uy)?.typ ?? -1)
            && propertyIsActive('levitation', game)) {
            await fallIntoSink(game);
            if (game.program_state.gameover)
                return { died: true };
        }
        if (!game._steedDismounting) {
            if (trap && game.u.levitationTurns === 1
                && levitationIsPurelyTimed(game)) {
                if (rn2(2)) {
                    game.u.levitationTurns++;
                }
                else if (await floatHeroDown(I_SPECIAL | TIMEOUT, 0, game)) {
                    trap = null;
                    pick = false;
                }
                if (game.program_state.gameover)
                    return { died: true };
            }
            const pit = trap && is_pit(trap.ttyp);
            if (pick && !pit)
                await autopickupAtHero();
            if (game.program_state.gameover)
                return { died: true };
            if (trap && triggeringTrapType !== trap.ttyp) {
                triggeringTrapType = trap.ttyp;
                let result;
                try {
                    result = await dotrapAt(newx, newy, {
                        finishTeleport: finishTeleportArrival, gotoLevel, ...trapOptions,
                    });
                }
                finally {
                    triggeringTrapType = null;
                }
                if (result?.died)
                    return { died: true };
                if (result?.shortCircuited)
                    return { shortCircuited: true, moved: false, died: false };
            }
            if (pick && pit)
                await autopickupAtHero();
            if (game.program_state.gameover)
                return { died: true };
        }
        await warnAboutMeltingIce(publish);
        if (await finishCeilingMonsterArrival(game, publish))
            return { died: true };
        return { moved: false, died: !!game.program_state.gameover };
    }
    finally {
        if (--spotDepth === 0)
            activeSpot = null;
    }
}
// The Warning intrinsic alerts the hero to melting ice underfoot.
// C timeout.c:spot_time_left(): the remaining melt time read off the
// level timer's deadline; C timeout.c:spot_time_expires(): its expiry
// lookup is the levelTimers find.
async function warnAboutMeltingIce(publish) {
    const { ux: x, uy: y } = game.u;
    if (!propertyIsActive('warning', game) || !isIceAt(x, y, game))
        return;
    const timer = levelTimers(game).find(candidate => candidate.kind === LEVEL_TIMER_KIND.MELT_ICE_AWAY && candidate.x === x && candidate.y === y);
    const remaining = timer ? timer.deadline - game.moves : 0;
    if (!remaining || remaining >= 15)
        return;
    await publish(remaining < 5 ? 'The ice, is gonna BREAK!'
        : remaining < 10 ? 'You feel the ice shift beneath you!'
            : 'The ice seems very soft and slushy.');
}
const S_PIERCER = 16;
export async function finishCeilingMonsterArrival(state, publish) {
    const hero = state.u;
    const monster = monsterAtPosition(state.level, hero.ux, hero.uy);
    if (!monster || hero.uswallow)
        return false;
    monster.mundetected = 0;
    monster.msleeping = 0;
    if (MONSTER_SYMBOL[monster.mnum] === S_PIERCER) {
        const subject = monsterName(monster, { state, article: 'a', capitalized: true });
        await publish(`${subject} suddenly drops from the ${ceilingName(hero.ux, hero.uy, state)}!`);
        const helmet = state.uarmh ?? hero.uarmh;
        if (monster.mtame) {
            // Tame piercers drop to greet the hero and do no damage.
        }
        else if (objectIsHardHelmet(helmet)) {
            await publish('Its blow glances off your helm.');
        }
        else {
            const missed = hero.uac + 3 <= rnd(20);
            const falling = monsterName(monster, {
                state, article: 'a', adjective: 'falling', called: true, suppressSaddle: false,
            });
            if (missed) {
                await publish(`You are almost hit by ${falling}!`);
            }
            else {
                await publish(`You are hit by ${falling}!`);
                let damage = d(4, 6);
                if (hero.halfPhysicalDamage || heroHasCarriedArtifactFlag('SPFX_HPHDAM', state))
                    damage = Math.trunc((damage + 1) / 2);
                if (await damageHeroFromMonster(monster, damage, { state, publish }))
                    return true;
            }
        }
    }
    else if (monster.mtame) {
        const subject = monsterName(monster, { state, article: 'a', capitalized: true });
        await publish(`${subject} jumps near you from the ${ceilingName(hero.ux, hero.uy, state)}.`);
    }
    else if (monster.mpeaceful) {
        const surprised = heroIsBlind(state) && !canSenseMonster(monster) ? 'something'
            : monsterName(monster, { state, article: 'a' });
        await publish(`You surprise ${surprised}!`);
        monster.mpeaceful = 0;
    }
    else {
        const subject = monsterName(monster, { state, article: 'a', capitalized: true });
        await publish(`${subject} attacks you by surprise!`);
    }
    await moveMonsterNextToHero(monster, state, { flags: RLOC_NOMSG });
    return !!state.program_state.gameover;
}
export function roomForIndex(level, index) {
    if (!Number.isInteger(index) || index < 0 || index === MAXNROFROOMS)
        return null;
    if (index < MAXNROFROOMS) {
        const room = level?.rooms[index];
        return isRoom(room) ? room : null;
    }
    return level?.subrooms?.[index - MAXNROFROOMS - 1] || null;
}
export function roomForRoomno(level, roomno) {
    if (!Number.isInteger(roomno) || roomno < ROOMOFFSET)
        return null;
    return roomForIndex(level, roomno - ROOMOFFSET);
}
function roomHasType(level, roomno, wantedType) {
    if (!wantedType)
        return true;
    const roomType = roomForRoomno(level, roomno)?.rtype;
    return roomType === wantedType
        || wantedType === SHOPBASE && roomType !== undefined && roomType > SHOPBASE;
}
// C hack.c:in_rooms(). A boundary square can belong to the rooms beside it.
export function roomsAt(level, x, y, wantedType = 0) {
    const roomno = level?.at?.(x, y)?.roomno ?? NO_ROOM;
    if (roomno === NO_ROOM)
        return [];
    if (roomno !== SHARED && roomno !== SHARED_PLUS) {
        return roomHasType(level, roomno, wantedType) ? [roomno] : [];
    }
    const step = roomno === SHARED ? 2 : 1;
    const rooms = [];
    for (let nx = x - 1; nx <= x + 1; nx += step) {
        for (let ny = y - 1; ny <= y + 1; ny += step) {
            const neighborRoom = level?.at?.(nx, ny)?.roomno ?? NO_ROOM;
            if (neighborRoom < ROOMOFFSET || rooms.includes(neighborRoom)
                || !roomHasType(level, neighborRoom, wantedType))
                continue;
            rooms.unshift(neighborRoom);
        }
    }
    return rooms;
}
// C hack.c:in_town().  A level with town metadata and no room-form subrooms
// treats the whole level as town.  Otherwise, the top-level room which owns
// subrooms is the town envelope, including its ordinary room boundary.
export function inTown(level, x, y) {
    if (!level?.flags?.has_town)
        return false;
    let hasSubrooms = false;
    for (const room of level.rooms || []) {
        // Native rooms are terminated by the first hx <= 0 sentinel.
        if (!isRoom(room) || !(room.hx > 0))
            break;
        if ((room.nsubrooms ?? 0) <= 0)
            continue;
        hasSubrooms = true;
        if (insideRoom(level, room, x, y))
            return true;
    }
    return !hasSubrooms;
}
export function updateHeroRoomMembership(state, leavingLevel = false) {
    const u = state.u;
    if (!u.urooms || !u.ushops)
        throw new Error('Hero room membership is not initialized');
    const previousRooms = [...u.urooms];
    const previousShops = [...u.ushops];
    u.urooms0 = previousRooms;
    u.ushops0 = previousShops;
    if (leavingLevel) {
        u.urooms = [];
        u.uentered = [];
        u.ushops = [];
        u.ushops_entered = [];
        u.ushops_left = [...previousShops];
        return;
    }
    u.urooms = roomsAt(state.level, u.ux, u.uy);
    u.uentered = u.urooms.filter(roomno => !previousRooms.includes(roomno));
    const shops = u.urooms.filter(roomno => {
        const room = roomForRoomno(state.level, roomno);
        return room !== null && room.rtype >= SHOPBASE;
    });
    u.ushops = shops;
    u.ushops_entered = shops.filter(roomno => !previousShops.includes(roomno));
    u.ushops_left = previousShops.filter(roomno => !shops.includes(roomno));
}
// C hack.c:check_special_room(). newLevel is the old-level exit, not arrival.
export async function checkSpecialRoom({ newLevel = false } = {}) {
    updateHeroRoomMembership(game, newLevel);
    requireShopGame(game);
    if (game.u.ushops0.length)
        await leaveHeroShop(game.u.ushops_left, { newLevel });
    if (game.level.flags.has_town && In_mines(game.u.uz)
        && inTown(game.level, game.u.ux, game.u.uy))
        recordAchievement(game, ACH_TOWN);
    if (!game.u.uentered.length && !game.u.ushops_entered.length)
        return null;
    let result = null;
    if (game.u.ushops_entered.length) {
        const roomno = game.u.ushops_entered[0];
        if (roomno === undefined)
            throw new Error('Entered shop has no room number');
        const room = roomForRoomno(game.level, roomno);
        if (!room)
            throw new Error(`Entered shop ${roomno} has no room`);
        result = await enterShop({ room, roomno });
    }
    for (const roomno of game.u.uentered) {
        const room = roomForRoomno(game.level, roomno);
        if (!room)
            throw new Error(`Entered room ${roomno} does not exist`);
        const type = room.rtype;
        const message = specialRoomEntryMessage(room, roomno);
        if (message) {
            await plineWithContinuation(message);
            recordDiscoveredRoom(roomno - ROOMOFFSET);
            room.rtype = OROOM;
            result = room;
        }
        else if (type === DELPHI) {
            const oracle = [...game.level.monsters].reverse().find(monster => !monster.dead && monster.mhp > 0
                && monster.mnum === MONSTER_NAME.indexOf('Oracle')
                && roomsAt(game.level, monster.mx, monster.my).includes(roomno));
            if (oracle) {
                const name = game.plname;
                await plineWithContinuation(oracle.mpeaceful
                    ? `"${shopGreeting(oracle)}, ${name}, welcome to Delphi!"`
                    : `"You're in Delphi, ${name}."`);
                recordDiscoveredRoom(roomno - ROOMOFFSET);
            }
            room.rtype = OROOM;
            result = room;
        }
        else if (type === TEMPLE) {
            result = await intemple(roomno);
            recordDiscoveredRoom(roomno - ROOMOFFSET);
        }
        else if (type >= SHOPBASE) {
            recordDiscoveredRoom(roomno - ROOMOFFSET);
        }
        if (room.rtype !== OROOM || type === OROOM)
            continue;
        if (!searchSpecial(type)) {
            switch (type) {
                case COURT:
                    game.level.flags.has_court = false;
                    break;
                case SWAMP:
                    game.level.flags.has_swamp = false;
                    break;
                case MORGUE:
                    game.level.flags.has_morgue = false;
                    break;
                case ZOO:
                    game.level.flags.has_zoo = false;
                    break;
                case BARRACKS:
                    game.level.flags.has_barracks = false;
                    break;
                case BEEHIVE:
                    game.level.flags.has_beehive = false;
                    break;
            }
        }
        if ([COURT, SWAMP, MORGUE, ZOO].includes(type)) {
            for (const monster of [...game.level.monsters].reverse()) {
                // Native compares the stored room number to its room index here.
                if (monster.dead || monster.mhp <= 0
                    || game.level.at(monster.mx, monster.my)?.roomno !== roomno - ROOMOFFSET)
                    continue;
                if (!propertyIsActive('stealth', game) && !rn2(3)) {
                    await publishMonsterWake(monster);
                    monster.msleeping = 0;
                }
            }
        }
    }
    return result;
}
function specialRoomEntryMessage(room, roomno) {
    switch (room.rtype) {
        case ZOO: return "Welcome to David's treasure zoo!";
        case SWAMP: return heroIsBlind(game) ? 'It feels rather humid down here.' : 'It looks rather muddy down here.';
        case COURT: {
            const throne = furniturePresent(room, THRONE);
            return `You enter an opulent${throne ? ' throne' : ''} room!`;
        }
        case LEPREHALL: return 'You enter a leprechaun hall!';
        case MORGUE: {
            if (recorderLocalHour(game.datetime) === 0) {
                const verb = heroLocomotion('Run');
                return `${verb} away!  ${verb} away!`;
            }
            return 'You have an uncanny feeling...';
        }
        case BEEHIVE: return 'You enter a giant beehive!';
        case COCKNEST: return 'You enter a disgusting nest!';
        case ANTHOLE: return 'You enter an anthole!';
        case BARRACKS: {
            // C hack.c:monstinroom(): is any soldier, sergeant, lieutenant, or
            // captain of this platoon still inside the barracks room?
            const soldiers = ['soldier', 'sergeant', 'lieutenant', 'captain'].map(name => MONSTER_NAME.indexOf(name));
            const occupied = game.level?.monsters.some(monster => !monster.dead && monster.mhp > 0
                && soldiers.includes(monster.mnum)
                && roomsAt(game.level, monster.mx, monster.my).includes(roomno));
            return occupied ? 'You enter a military barracks!' : 'You enter an abandoned barracks.';
        }
        default: return null;
    }
}
// C hack.c:furniture_present() scans the interior bounds, then checks the
// actual shape. Rectangular courts include furniture in their subrooms.
function furniturePresent(room, furniture) {
    const level = game.level;
    if (!level)
        return false;
    for (let y = room.ly; y <= room.hy; y++) {
        for (let x = room.lx; x <= room.hx; x++) {
            if (level.at(x, y)?.typ === furniture && insideRoom(level, room, x, y))
                return true;
        }
    }
    return false;
}
// C hack.c:spoteffects(TRUE) also applies when expulsion or a body change leaves
// the hero on the same square. It does not count as a movement attempt.
export async function applyHeroLocationEffects(publish = plineWithContinuation, { pick = true } = {}) {
    const { ux: x, uy: y } = game.u;
    return finishDestinationSpotEffects({
        oldx: x, oldy: y, newx: x, newy: y,
        publish, pick,
    });
}
// domove_core()'s common tail (C hack.c:2934-2990), including a refused pet
// swap.  Repositioning and concealment finish before vision and arrival
// effects; domoveCore() owns the function itself, above.
async function finishHeroMovement({ oldx, oldy, loc, ballChainMove = null, }) {
    const u = game.u;
    // This tail is domove_core()'s epilogue; reaching it (rather than one
    // of the early returns) keeps runmode_delay_output() and the pending
    // time repaint, even when a refused pet swap restored the hero.
    game._domoveReachedTail = true;
    await placeHeroOnLevel(u.ux, u.uy);
    resetOccupations();
    // hack.c:domove_core() ends only a real run upon entering a doorway,
    // obstruction, or furniture square, and never a travel run
    // (context.run == 8).  findtravelpath() restores run to 8 for the
    // arrival step after nomul(0) cleared _runState, so the lingering
    // value — not _runState — is what the native check reads.
    // Applies even when actor displacement, rather than the plain terrain
    // branch, performed the coordinate move.
    const runMode = game.context.run ?? 0;
    if (runMode > 0 && runMode < 8
        && (loc?.typ === DOOR || IS_OBSTRUCTED(loc?.typ ?? STONE)
            || IS_FURNITURE(loc?.typ ?? STONE)))
        nomul(0);
    if (!propertyIsActive('levitation', game) && !propertyIsActive('flying', game)
        && !propertyIsActive('stealth', game)
        && (MONSTER_BODY_META[heroSpecies(game)]?.[0] ?? 0) >= 400)
        disturbBuriedZombies(u.ux, u.uy);
    const species = heroSpecies(game);
    if ((monsterHidesUnder(species))
        || monsterIsEel(species) || u.dx || u.dy)
        await hideHeroUnder();
    if ((u.dx || u.dy) && (u.m_ap_type === M_AP_OBJECT || u.m_ap_type === M_AP_FURNITURE))
        u.m_ap_type = M_AP_NOTHING;
    await checkHeroLeashes(oldx, oldy);
    if (game.program_state.gameover)
        return true;
    game._domoveSucceeded = oldx !== u.ux || oldy !== u.uy;
    u.umoved = game._domoveSucceeded;
    if (u.umoved) {
        await newsym(oldx, oldy);
        await vision_recalc(1);
        await announceInvocationSquare();
    }
    if (ballChainMove)
        await finishBallAndChainMove(ballChainMove);
    if (u.umoved) {
        const finished = await finishDestinationSpotEffects({
            oldx, oldy, newx: u.ux, newy: u.uy,
        });
        if (finished.died)
            return true;
    }
    // C domove_core(): landing and pickup finish before nomul(-2).
    // A longer trap-induced delay survives, but its completion prose changes.
    if (ballChainMove?.causeDelay)
        await delayAfterDraggingBall();
    return true;
}
// C domove_core() applies the dragging delay even when a pet refuses the swap.
async function delayAfterDraggingBall() {
    nomul(-2);
    game._helplessReason = 'dragging an iron ball';
    game._helplessDoneMessage = '';
    await captureRunmodeDelay(game, true, game.moves || 0, { preservePhysicalTopline: true });
}
function heroWieldsSting() {
    const weapon = game.uwep || game.u?.uwep;
    return artifactById(weapon?.oartifact)?.name === 'Sting';
}
async function struggleInWeb(steedName) {
    requirePlayingGame(game);
    const hero = game.u;
    if (heroWieldsSting()) {
        // C hack.c:trapmove() zeroes u.utrap with a bare field write and
        // lets its caller's reset_utrap() finish the release (see
        // heroCanMoveFromTrap), so flight is still blocked while the
        // message prints; trap.c:reset_utrap() then reports "You can fly."
        // from its own was-flying snapshot.
        hero.utrap = 0;
        await pline('Sting cuts through the web!');
        return;
    }
    if (reduceHeroTrapDuration() <= 0) {
        await pline(steedName
            ? `${upstart(steedName)} breaks out of the web.`
            : 'You disentangle yourself.');
    }
    else if (game.flags?.verbose !== false) {
        await plineWithContinuation(steedName
            ? `${upstart(steedName)} is stuck to the web.`
            : 'You are stuck to the web.', { noRepeat: true });
    }
}
async function struggleInFloor(targetX, targetY, anchored, steedName) {
    requirePlayingGame(game);
    const hero = game.u;
    const ball = anchored ? buriedBallNear(hero.ux, hero.uy, game) : null;
    if (ball) {
        const dx = targetX - ball.ox;
        const dy = targetY - ball.oy;
        if (dx * dx + dy * dy <= 2) {
            if (game.flags?.verbose !== false)
                await plineWithContinuation("You move within the chain's reach.", { noRepeat: true });
            return true;
        }
    }
    if (reduceHeroTrapDuration() > 0) {
        if (game.flags?.verbose !== false) {
            const message = anchored
                ? (steedName
                    ? `You and ${steedName} are chained to the buried ball.`
                    : 'You are chained to the buried ball.')
                : (steedName
                    ? `${upstart(steedName)} is stuck in the ${surfaceName(hero.ux, hero.uy)}.`
                    : `You are stuck in the ${surfaceName(hero.ux, hero.uy)}.`);
            await plineWithContinuation(message, { noRepeat: true });
        }
        return false;
    }
    if (steedName) {
        await pline(`${upstart(steedName)} finally ${anchored ? 'wrenches the ball' : 'lurches'} free.`);
    }
    else {
        await pline(anchored
            ? 'You finally wrench the ball free.'
            : 'You finally wriggle free.');
    }
    // wriggle_free: only the buried-ball case resets here (silently);
    // otherwise trapmove() leaves the bare u.utrap zeroed and the release
    // in heroCanMoveFromTrap() follows, possibly reporting flight.
    if (anchored)
        await buriedBallToPunishment();
    return false;
}
// C hack.c:trapmove().  One trapped-move attempt against the target square.
async function heroTrapmove(targetX, targetY) {
    const hero = game.u;
    if (!hero?.utrap)
        return true;
    requirePlayingGame(game);
    // C hack.c:trapmove() formats y_monnam(u.usteed) once at entry, and
    // every mounted message in the call reuses that one string.  Compute the
    // name before the switch so a hallucinating rider draws one random
    // identity per attempt even on paths that print no message.
    const steedName = hero.usteed
        ? monsterName(hero.usteed, { state: game, article: 'your', suppressSaddle: true })
        : null;
    switch (hero.utraptype) {
        case TT_BEARTRAP: {
            const subject = steedName ? upstart(steedName) : 'You';
            if (game.flags?.verbose !== false) {
                await plineWithContinuation(`${subject} ${steedName ? 'is' : 'are'} caught in a bear trap.`, { noRepeat: true });
            }
            if ((hero.dx && hero.dy) || rn2(5) === 0)
                hero.utrap--;
            if (hero.utrap <= 0) {
                await plineWithContinuation(`${subject} finally ${steedName ? 'lurches' : 'wriggle'} free.`);
                // trapmove() leaves the bare u.utrap zeroed here; the release
                // in heroCanMoveFromTrap() follows and may report flight.
            }
            return false;
        }
        case TT_PIT:
            // C domove_core() calls trapmove(x, y, NULL), so the destination
            // pit lookup in trap.c is dead here: every attempted step from a
            // pit goes through climb_pit() and then aborts the move.
            await climbOutOfPit();
            return false;
        case TT_WEB:
            await struggleInWeb(steedName);
            return false;
        case TT_LAVA: {
            if (game.flags?.verbose !== false)
                await plineWithContinuation(steedName
                    ? `${upstart(steedName)} is stuck in the lava.`
                    : 'You are stuck in the lava.', { noRepeat: true });
            if (!isLavaAt(targetX, targetY)) {
                hero.utrap--;
                if ((hero.utrap & 0xff) === 0) {
                    // The release in heroCanMoveFromTrap() runs after this
                    // message returns. Its pager must keep the preceding
                    // InLava status visible.
                    hero.utrap = 0;
                    await pline(steedName
                        ? `You lead ${steedName} to the edge of the ${displayLiquidName('lava', game)}.`
                        : `You pull yourself to the edge of the ${displayLiquidName('lava', game)}.`);
                }
            }
            hero.umoved = true;
            return false;
        }
        case TT_INFLOOR:
            return struggleInFloor(targetX, targetY, false, steedName);
        case TT_BURIEDBALL:
            return struggleInFloor(targetX, targetY, true, steedName);
        case undefined:
            return false;
        default:
            return false;
    }
}
// domove_core()'s trapped-move block (C hack.c:2830-2841): trapmove(), then
// the reset_utrap(TRUE) release the moment the bare u.utrap zeroing appears,
// so the was-levitating/was-flying snapshots see float_vs_flight()'s blocked
// masks and the recompute restores flight blocked by the trap.
export async function heroCanMoveFromTrap(targetX, targetY) {
    const hero = game.u;
    if (!hero?.utrap)
        return true;
    const moved = await heroTrapmove(targetX, targetY);
    if (!hero.utrap)
        await resetUtrap(true);
    return moved;
}
// C hack.c:air_turbulence().
export async function airTurbulenceStopsHero() {
    requirePlayingGame(game);
    const hero = game.u;
    if (!Is_airlevel(hero.uz) || !rn2(4) || hero.levitating || hero.flying)
        return false;
    switch (rn2(3)) {
        case 0:
            await plineWithContinuation('You tumble in place.');
            await exerciseAttribute(A_DEX, false);
            break;
        case 1:
            await plineWithContinuation("You can't control your movements very well.");
            break;
        case 2:
            await plineWithContinuation("It's hard to walk in thin air.");
            await exerciseAttribute(A_DEX, true);
            break;
    }
    return true;
}
// C hack.c:water_turbulence(). Water can foil the intended move; the
// native water friction guard is folded into the call below.
export async function waterTurbulenceStopsHero() {
    requirePlayingGame(game);
    const hero = game.u;
    if (!hero.uinwater)
        return false;
    const swimming = heroCanSwim(game);
    if (!swimming || !rn2(4))
        await applyWaterFriction();
    if (!hero.dx && !hero.dy) {
        endVoluntaryMultiTurn(game);
        return true;
    }
    const x = hero.ux + (hero.dx ?? 0), y = hero.uy + (hero.dy ?? 0);
    if (isok(x, y) && !isPoolAt(x, y, game) && !Is_waterlevel(hero.uz)
        && nearCapacity(game) > (swimming ? MOD_ENCUMBER : SLT_ENCUMBER)) {
        await plineWithContinuation('You are carrying too much to climb out of the water.');
        endVoluntaryMultiTurn(game);
        return true;
    }
    return false;
}
// C hack.c:slippery_ice_fumbling(): on ice, unless shod in snow boots,
// cold-resistant, flying, floating, clinging, or whirly, one chance in
// rn2(cold ? 3 : 2) fumbles the next move.
export function checkSlipperyIce() {
    const hero = game.u;
    let onIce = !propertyIsActive('levitation', game) && isIceAt(hero.ux, hero.uy);
    if (onIce) {
        const skater = hero.usteed ?? { mnum: heroSpecies(game) };
        const boots = game.uarmf ?? hero.uarmf;
        const appearance = boots && (game.objectDescriptions?.[boots.otyp] ?? OBJECT_DESCRIPTIONS[boots.otyp]);
        const symbol = MONSTER_SYMBOL[skater.mnum];
        const coldSkater = hero.usteed ? monsterHasColdResistance(hero.usteed)
            : propertyIsActive('coldResistance', game) || heroHasArtifactDefense('cold', game);
        if (appearance === 'snow boots' || coldSkater
            || propertyIsActive('flying', game) || symbol === 5 || symbol === 25
            || monsterIsClinger(skater.mnum) || monsterIsWhirly(skater)) {
            onIce = false;
        }
        else if (!rn2(propertyIsActive('coldResistance', game) ? 3 : 2)) {
            hero.fumblingFromIce = true;
            hero.fumblingTurns = 1;
            hero.fumbling = true;
        }
    }
    if (!onIce)
        hero.fumblingFromIce = false;
}
// C hack.c:avoid_moving_on_trap(): a seen trap other than the vibrating
// square stops a run; announceRunTrap() below adds its mention_walls line.
// t_at() and trapname() run inside the find; set_msg_xy() marks the trap
// square from announceRunTrap() below.
export function knownRunTrap(x, y, state) {
    return state.level?.traps.find(trap => trap.tx === x && trap.ty === y
        && trap.tseen && trap.ttyp !== VIBRATING_SQUARE);
}
// C hack.c:avoid_moving_on_liquid(): an unsafe liquid transition stops a
// blind or shift-dir run; known water/lava walking keeps going.
// is_pool_or_lava() is the isPoolAt||isLavaAt pair; hliquid() and
// set_msg_xy() run in announceRunLiquid() below.
export function runLiquidIsDangerous(x, y, state) {
    const location = state.level?.at(x, y);
    if (!location)
        return false;
    const inAir = state.u.levitating || state.u.flying;
    const lava = isLavaAt(x, y, state), pool = isPoolAt(x, y, state);
    const liquidWall = IS_WATERWALL(location.typ) || location.typ === LAVAWALL;
    if ((location.typ === state.level?.at(state.u.ux, state.u.uy)?.typ
        || ((state.context.run ?? 0) < 2 && (!lava || inAir)) || state.context.travel)
        && (inAir || heroKnowsLavaWalking(state) || (pool && heroKnowsWaterWalking(state)))
        && !liquidWall)
        return false;
    return !!((pool || lava) && location.seenv);
}
export async function announceRunTrap(trap, state) {
    if (state.flags.mention_walls) {
        // C avoid_moving_on_trap() marks the trap square before the message.
        set_msg_xy(trap.tx, trap.ty);
        await plineWithContinuation(`You stop in front of ${withIndefiniteArticle(trapName(trap.ttyp, { state }))}.`);
    }
}
export async function announceRunLiquid(x, y, state) {
    if (state.flags.mention_walls) {
        // C avoid_moving_on_liquid() marks the liquid square before the message.
        set_msg_xy(x, y);
        await plineWithContinuation(`You stop at the edge of the ${displayLiquidName(isPoolAt(x, y, state) ? 'water' : 'lava', state)}.`);
    }
}
// The caller first checks test_move(TEST_MOVE), without opening doors,
// pushing boulders, or escaping the hero's current trap. C trap.c:
// into_vs_onto(): the "into" list below, drawn fresh for a hallucinated
// trap type.
export async function confirmHeroStep(x, y, state = game) {
    requirePlayingGame(state);
    const bits = state.flags.paranoia_bits ?? 0;
    const stunned = state.u.stunned || (state.u.stunnedTurns ?? 0) > 0;
    const confused = (state.u.confusionTurns ?? 0) > 0;
    if (!(bits & PARANOID_TRAP) || stunned || confused
        || (state.context.nopick && !state.context.run))
        return true;
    const hallucinating = heroIsHallucinating(state);
    const locomotion = heroLocomotion('step', state);
    const confirm = !!(bits & PARANOID_CONFIRM);
    if (!heroIsBlind(state) && !hallucinating) {
        const entered = visibleRegionAt(state, x, y);
        const exited = visibleRegionAt(state, state.u.ux, state.u.uy);
        if (entered && (!exited || (entered.damage > 0 && exited.damage === 0))) {
            const verb = locomotion.charAt(0).toUpperCase() + locomotion.slice(1);
            if (!await paranoidQuery(confirm, `${verb} into that ${entered.damage > 0 ? 'poison gas' : 'vapor'} cloud?`, bits)) {
                cancelStep(state);
                return false;
            }
        }
    }
    const trap = state.level.traps.find(candidate => candidate.tx === x && candidate.ty === y);
    if (!trap?.tseen || (!hallucinating && trapIsClearlyHarmless(trap.ttyp, state)))
        return true;
    const type = hallucinating ? rnd(TRAPNUM - 1) : trap.ttyp;
    const into = [BEAR_TRAP, PIT, SPIKED_PIT, HOLE, TELEP_TRAP, LEVEL_TELEP, MAGIC_PORTAL, WEB].includes(type);
    const name = TRAP_EXPLANATIONS[type];
    if (!name)
        throw new Error(`Cannot name trap type ${type} for movement confirmation`);
    if (await paranoidQuery(confirm, `Really ${locomotion} ${into ? 'into' : 'onto'} that ${name}?`, bits))
        return true;
    cancelStep(state);
    return false;
}
function cancelStep(state) {
    stopRun(state);
    endVoluntaryMultiTurn(state);
    state.context.move = 0;
}
// Hidden resistance still deserves a warning. Only native CLEARLY_IMMUNE
// results suppress confirmation; this decision never reveals equipment.
// C trap.c:immune_to_trap(), hero branch (its only C caller is the
// paranoid trap confirmation at hack.c:2561): TRUE is TRAP_CLEARLY_IMMUNE
// — a native body or inventory trait, never a revealed one.
function trapIsClearlyHarmless(type, state) {
    const species = heroSpecies(state);
    const body = { mnum: species };
    switch (type) {
        case BEAR_TRAP:
            if ((MONSTER_SIZE[species] ?? 2) <= 1 || monsterIsAmorphous(body)
                || monsterIsWhirly(body) || monsterIsUnsolid(body))
                return true;
            return avoidsGroundTraps(type, state);
        case SQKY_BOARD:
        case LANDMINE:
        case ROLLING_BOULDER_TRAP:
        case HOLE:
        case TRAPDOOR:
        case PIT:
        case SPIKED_PIT:
            return avoidsGroundTraps(type, state);
        case SLP_GAS_TRAP:
            return monsterIsBreathless(species); // breathless body
        case LEVEL_TELEP:
        case TELEP_TRAP:
            // Native mon_has_amulet(&youmonst) checks its empty monster
            // inventory, not the hero's carried Amulet.
            return In_endgame(state.u.uz);
        case WEB:
            return monsterIsAmorphous(body) || monsterIsWhirly(body) || monsterIsUnsolid(body)
                || ['cave spider', 'giant spider', 'gelatinous cube', 'fire vortex',
                    'flaming sphere', 'fire elemental', 'salamander'].includes(MONSTER_NAME[species] ?? '');
        case RUST_TRAP:
            if (MONSTER_NAME[species] === 'iron golem')
                return false;
            return !state.inventory.some(object => objectIsRustprone(object)
                && !!object.owornmask && !(object.owornmask & W_QUIVER)
                && (!(object.owornmask & W_SWAPWEP) || state.u.twoweap));
        case VIBRATING_SQUARE:
            return true;
        default:
            return false;
    }
}
function avoidsGroundTraps(type, state) {
    if (state.level?.flags.sokoban_rules && (is_pit(type) || is_hole(type)))
        return false;
    if (In_sokoban(state.u.uz) && type === ROLLING_BOULDER_TRAP)
        return true;
    const species = heroSpecies(state);
    const symbol = MONSTER_SYMBOL[species];
    const ceiling = !In_endgame(state.u.uz) || Is_earthlevel(state.u.uz);
    return !!(state.u.levitating || state.u.flying || monsterIsFlyer(species)
        || symbol === 5 || symbol === 25 || (monsterIsClinger(species) && ceiling));
}
// C hack.c:domove().  Evaluates a successful step after all destination
// effects: domove_succeeded survives for the caller's assessments, the
// origin is snapshotted for maybe_smudge_engr(), and the kicked location
// clears.
export async function domove(dx, dy, explicitAttempt = true) {
    const oldx = game.u.ux, oldy = game.u.uy;
    game._domoveSucceeded = false;
    game._domoveReachedTail = false;
    const moved = await domoveCore(dx, dy);
    if (!game.program_state.gameover) {
        if (explicitAttempt && game._domoveSucceeded) {
            maybeSmudgeEngravings(oldx, oldy, game.u.ux, game.u.uy);
            maybeAdjustHeroBubble();
        }
        game._kickedLoc = null;
        game._movementAttempt = null;
    }
    return moved === 'opened-door' ? moved : moved ? 'time' : 'stopped';
}
// C hack.c:move_out_of_bounds(). A failed step takes no time; a forced
// attack still spends the action against an unknown obstacle.
async function moveOutOfBounds(x, y) {
    if (game.context.forcefight)
        return fightEmptyDestination(x, y);
    if (game.flags.mention_walls) {
        let { dx = 0, dy = 0 } = game.u;
        if (dx && dy) {
            // Keep both directions only when both coordinates hit a limit.
            if (isok(x, game.u.uy))
                dx = 0;
            else if (isok(game.u.ux, y))
                dy = 0;
        }
        const horizontal = dx < 0 ? 'west' : dx > 0 ? 'east' : '';
        const vertical = dy < 0 ? 'north' : dy > 0 ? 'south' : '';
        await pline(`You have already gone as far ${vertical}${horizontal} as possible.`);
    }
    stopRun(game);
    game.context.move = 0;
    return false;
}
// C hack.c:domove_bump_mon(). The m-prefix spends the step before the
// destination monster can choose displacement or receive an attack.
async function bumpIntoMonster(monster, x, y) {
    if (!game.context.nopick || game.context.travel)
        return false;
    const glyph = glyphAt(x, y);
    if (!canSpotMonster(monster)
        && glyph?.kind !== 'invisible' && glyph?.kind !== 'warning')
        return false;
    if (M_AP_TYPE(monster)
        && !(game.u.protectionFromShapeChangers || game.protectionFromShapeChangers)
        && !canSenseMonster(monster)) {
        await stumbleOntoMimic(monster);
    }
    else if (monster.mpeaceful && !heroIsHallucinating(game)) {
        await plineWithContinuation(`Pardon me, ${monsterName(monster, { article: 'none', exact: true })}.`);
    }
    else {
        await plineWithContinuation(`You move right into ${monsterName(monster)}.`);
    }
    return true;
}
// C hack.c:u_rooted(). An immobile form may attack but cannot take a step.
async function rootedHeroCannotMove() {
    if (MONSTER_MOVE[heroSpecies(game)] !== 0)
        return false;
    const inPlace = game.u.levitating || Is_airlevel(game.u.uz) || Is_waterlevel(game.u.uz);
    await plineWithContinuation(`You are rooted ${inPlace ? 'in place' : 'to the ground'}.`);
    endVoluntaryMultiTurn(game);
    return true;
}
// C display.h:_is_safemon(). Recheck after movement effects, which can
// change the monster or the hero's ability to recognize it.
export function heroMayDisplaceMonster(monster) {
    const u = game.u;
    return (game.flags.safe_dog ?? true) && !!monster.mpeaceful
        && canSpotMonster(monster) && !(u.confusionTurns ?? 0)
        && !heroIsHallucinating(game) && !u.stunned && !(u.stunnedTurns ?? 0);
}
// C domove_core(): a failed test_move() or swim_move_danger() cancels the
// move and calls nomul(0), which also requests a full status update.
function rejectHeroMove() {
    game.context.move = 0;
    nomul(0, game);
    return false;
}
const DISPLACER_BEAST = MONSTER_NAME.indexOf('displacer beast');
const GRID_BUG = MONSTER_NAME.indexOf('grid bug');
// C hack.c:domove_attackmon_at(): the displacer-beast swap roll — a hidden
// target, rn2(2), the believed position, helplessness, diagonal rock, and
// goodpos() all gate the offer before do_attack().
export function beastChoosesHeroDisplacement(beast, state, x, y) {
    if (beast.mnum !== DISPLACER_BEAST)
        return false;
    if (beast.mundetected && !state.context.forcefight && !canSenseMonster(beast))
        return false;
    if (rn2(2))
        return false;
    const u = state.u;
    if (beast.mux !== u.ux0 || beast.muy !== u.uy0
        || monsterIsHelpless(beast) || beast.meating || beast.mtrapped
        || u.utrap || u.ustuck || u.usteed)
        return false;
    if (u.dx && u.dy && (u.umonnum === GRID_BUG
        || (beastBadRock(state, x, u.uy0) && beastBadRock(state, u.ux0, y))
        || (heroBadRock(state, u.ux0, y) && heroBadRock(state, x, u.uy0))))
        return false;
    return goodPosition(u.ux0, u.uy0, { kind: 'monster', monster: beast }, { state, gpflags: GP_ALLOW_U });
}
// Displacer beasts neither tunnel nor pass walls. Sokoban boulders still
// count as rock even when the square beneath them is open floor.
function beastBadRock(state, x, y) {
    return IS_OBSTRUCTED(state.level.at(x, y)?.typ ?? STONE)
        || !!(state.level.flags.sokoban_rules
            && state.level.objects[x]?.[y]?.some(object => object.otyp === BOULDER));
}
export async function settleBeastHeroDisplacement(beast, state) {
    const u = state.u;
    const remembered = glyphAt(beast.mx, beast.my, state);
    const noticed = canSpotMonster(beast)
        || remembered?.kind === 'invisible' || remembered?.kind === 'warning';
    beast.mx = u.ux0;
    beast.my = u.uy0;
    await newsym(u.ux, u.uy);
    await newsym(u.ux0, u.uy0);
    beast.mux = u.ux;
    beast.muy = u.uy;
    const subject = noticed ? monsterName(beast, { state, article: 'your', capitalized: true }) : 'Something';
    await plineWithContinuation(`${subject} swaps places with you...`);
    if (!canSpotMonster(beast))
        await map_invisible(u.ux0, u.uy0);
    const moving = state.context.mon_moving;
    state.context.mon_moving = true;
    try {
        await resolveMonsterLiquid(beast, state, {
            announce: plineWithContinuation,
            finishDeath: (monster, options) => finishEnvironmentalMonsterDeath(monster, state, {
                noCorpse: !options.leaveCorpse, random: options.random,
                sadFeeling: options.sadFeeling, publish: options.publish,
            }),
        });
        if (!state.level.monsters.includes(beast) || beast.dead || beast.mhp <= 0
            || state.program_state.gameover)
            return;
        await mintrap(beast, state);
    }
    finally {
        if (moving === undefined)
            delete state.context.mon_moving;
        else
            state.context.mon_moving = moving;
    }
}
const TIP_UNTRAP_MON = 1 << 2;
// C hack.c:domove_swap_with_pet().  The refusal checks — a boulder-pinned
// pit, grid-bug diagonals, a boulder at the hero's square, tight diagonals,
// a trap under a peaceful pet, and undisplaceable targets — then the swap
// itself: trade places, run the landing liquid, the trap, and the kill or
// abuse consequences.  True when the places were traded (C's !didnt_move);
// the hero starts at the monster's square.  sobj_at() is the boulder scan
// at the hero's square; handle_tip()'s TIP_UNTRAP_MON hint prints inline.
export async function settlePetHeroDisplacement(monster, state) {
    const hero = state.u;
    const x = hero.ux, y = hero.uy;
    // Reveal the pet while the hero is still drawn at the departure square.
    hero.ux = hero.ux0;
    hero.uy = hero.uy0;
    monster.mundetected = 0;
    await revealMonsterAppearance(monster);
    hero.ux = x;
    hero.uy = y;
    const trap = monster.mtrapped ? state.level.traps.find(candidate => candidate.tx === monster.mx && candidate.ty === monster.my) : undefined;
    if (!trap)
        monster.mtrapped = 0;
    const boulder = state.level.objects[x]?.[y]?.some(object => object.otyp === BOULDER);
    /* can't swap places with pet pinned in a pit by a boulder */
    if (trap && is_pit(trap.ttyp) && boulder)
        return false;
    const diagonal = hero.ux0 !== x && hero.uy0 !== y;
    let reason = null;
    if (diagonal && MONSTER_NAME[monster.mnum] === 'grid bug') {
        /* can't swap places when pet can't move to your spot */
        reason = "can't move diagonally";
    }
    else if (boulder && !(monsterIsVerySmall(monster.mnum) && currentMonsterLoad(monster) <= 600)) {
        /* can't swap places when pet won't fit there with the boulder */
        reason = "won't fit into the same spot that you're at";
    }
    else if (diagonal && petBadRock(monster, state, x, hero.uy0)
        && petBadRock(monster, state, hero.ux0, y)
        && (monsterIsBig(monster.mnum) || currentMonsterLoad(monster) > 600)) {
        /* can't swap places when pet won't fit thru the opening */
        reason = "won't fit through";
    }
    else if (monster.mpeaceful && trap) {
        const name = trapName(trap.ttyp, { state });
        const which = trap.tseen ? `that ${name}` : withIndefiniteArticle(name);
        if (!trap.tseen) {
            await feelTrap(trap, state);
        }
        await plineWithContinuation(`You stop.  ${monsterName(monster, { state, article: 'your', capitalized: true })} can't move out of ${which}.`);
        if (state.flags.tips !== false && !((state.context.tips ?? 0) & TIP_UNTRAP_MON)) {
            state.context.tips = (state.context.tips ?? 0) | TIP_UNTRAP_MON;
            await plineWithContinuation('(Tip: perhaps #untrap would help?)');
        }
        return false;
    }
    else if (monster.mpeaceful && (!goodPosition(hero.ux0, hero.uy0, { kind: 'monster', monster }, { state })
        || state.level.traps.some(candidate => candidate.tx === hero.ux0 && candidate.ty === hero.uy0)
        || monster.ispriest || monster.isshk || monster.isgd
        || MONSTER_NAME[monster.mnum] === 'Oracle'
        || monster.m_id === state.quest_status?.leader_m_id)) {
        /* displacing peaceful into unsafe or trapped space, or trying to
           displace quest leader, Oracle, shk, priest, or vault guard */
        reason = "doesn't want to swap places";
    }
    if (reason) {
        await plineWithContinuation(`You stop.  ${monsterName(monster, { state, article: 'your', capitalized: true })} ${reason}.`);
        return false;
    }
    monster.mtrapped = 0;
    monster.mx = hero.ux0;
    monster.my = hero.uy0;
    await newsym(hero.ux, hero.uy);
    await newsym(hero.ux0, hero.uy0);
    const givenName = !!MGIVENNAME(monster);
    const name = monsterName(monster, {
        state,
        article: monster.mtame ? 'your'
            : !givenName && !(monsterHasProperName(monster.mnum))
                ? 'the' : 'none',
        adjective: monster.mpeaceful && !monster.mtame ? 'peaceful' : '',
        suppressSaddle: givenName,
    });
    await plineWithContinuation(`You ${monster.mpeaceful ? 'swap places with' : 'frighten'} ${name}.`);
    await resolveMonsterLiquid(monster, state, {
        monsterMoving: false,
        announce: plineWithContinuation,
        finishDeath: finishHeroLiquidMonsterDeath,
    });
    if (state.program_state.gameover)
        return true;
    let trapMovedMonster = false;
    if (!monster.dead && monster.mhp > 0) {
        const action = await mintrap(monster, state);
        if (state.program_state.gameover)
            return true;
        // trapeffect_telep_trap() returns Trap_Moved_Mon even when blocked.
        trapMovedMonster = !!action.movement.actorLeftLevel || action.event?.kind === 'teleport-trap';
    }
    if (monster.dead || monster.mhp <= 0) {
        // Native awards displacement credit before announcing the loss,
        // even when minliquid's xkilled() already credited the drowning.
        recordHeroKillConduct();
        awardMonsterExperience(monster, {
            state, killCount: monsterDeathCount(monster.mnum, state),
            amphibious: heroIsAmphibious(state), armorClass: findMonsterArmorClass(monster),
        });
        await checkExperienceLevel();
        if (rn2(4)) {
            await plineWithContinuation(formatFeltMessage('guilty about losing your pet like this.', state));
            hero.ugangr = (hero.ugangr ?? 0) + 1;
            adjustHeroAlignment(-15, state);
        }
    }
    else if (monster.mtrapped || trapMovedMonster) {
        await abusePet(monster, state);
        adjustHeroAlignment(-3, state);
    }
    return true;
}
function petBadRock(monster, state, x, y) {
    const location = state.level.at(x, y);
    if (!location)
        return true;
    if (state.level.flags.sokoban_rules
        && state.level.objects[x]?.[y]?.some(object => object.otyp === BOULDER))
        return true;
    if (!IS_OBSTRUCTED(location.typ))
        return false;
    const mayDig = !((IS_STWALL(location.typ) || IS_TREE(location.typ))
        && (location.wall_info & W_NONDIGGABLE));
    const tunnels = speciesTunnels(monster.mnum) && !needspick(monster.mnum) && mayDig;
    const passesWalls = monsterPassesWalls(monster.mnum)
        && !(IS_STWALL(location.typ) && (location.wall_info & W_NONPASSWALL));
    return !tunnels && !passesWalls;
}
// C hack.c:domove_core() owns the movement transaction.
// C hack.c:carrying_too_much(): an overloaded or exhausted hero collapses
// before any destination handling.
// C hack.c:u_maybe_impaired(): stunned, or confused with a one-in-five
// chance, scrambles the direction.
// C hack.c:impaired_movement(): confdir() retries until an in-bounds,
// traversable square or 50 attempts cancel the move.
// C hack.c:avoid_running_into_trap_or_liquid(): a seen trap, or a
// dangerous liquid while blind, stops or cancels the run before the step.
// domove_attackmon_at(): the target-monster branch for the swallower and an
// ordinary destination — displacement offer or attack (beastChoosesHeroDisplacement()
// owns its displacer-beast roll below).
async function domoveCore(dx, dy) {
    requirePlayingGame(game);
    const u = game.u;
    // C cmd.c:set_move_cmd() persists the requested command vector before
    // domove_core() can return early.  Death cleanup and several combat paths
    // deliberately reuse this global direction after the movement attempt.
    u.dx = dx;
    u.dy = dy;
    const travel = game._runState;
    if (game.context.travel && travel?.mode === 8) {
        const direction = await selectTravelStep(travel);
        dx = u.dx = direction.dx;
        dy = u.dy = direction.dy;
        game.context.travel1 = false;
    }
    // C hack.c:domove_core() calls carrying_too_much() before swallowed,
    // turbulence, impairment, destination, actor, or display handling.
    const capacity = nearCapacity(game);
    const polymorphed = heroIsPolymorphed(game);
    const activeHp = polymorphed ? (u?.mh ?? 0) : (u?.uhp ?? 0);
    const activeHpMax = polymorphed ? (u?.mhmax ?? 0) : (u?.uhpmax ?? 0);
    const lacksStamina = capacity > SLT_ENCUMBER
        && activeHp < (polymorphed ? 5 : 10)
        && activeHp !== activeHpMax;
    if (!Is_airlevel(u?.uz)
        && (capacity >= OVERLOADED || lacksStamina)) {
        if (capacity >= OVERLOADED) {
            await pline('You collapse under your load.');
        }
        else {
            await pline("You don't have enough stamina to move.");
            // exercise() suppresses physical attributes while polymorphed.
            if (!polymorphed)
                await exerciseAttribute(A_CON, false);
        }
        // nomul(0) requests a full status update even without an active run.
        endVoluntaryMultiTurn(game);
        // carrying_too_much() returns from domove_core() without clearing
        // context.move, so the failed step still spends the hero action.
        return true;
    }
    // C domove_core(): every direction attacks u.ustuck while swallowed.  It
    // zeroes the requested vector and follows the normal hero-melee owner at
    // the swallower's shared square; terrain and impaired movement are not
    // consulted.
    let swallowerYielded = false;
    if (u?.uswallow && u.ustuck && !u.ustuck.dead) {
        const monster = u.ustuck;
        // C domove_core() zeroes the vector before attacking the swallower.
        u.dx = u.dy = 0;
        dx = dy = 0;
        u.ux0 = u.ux;
        u.uy0 = u.uy;
        u.ux = monster.mx;
        u.uy = monster.my;
        // hack.c:domove_core() runs its shared target-monster block for the
        // swallower as well: a target that is not safe to displace cancels
        // running and count-prefixed repeats with nomul(0) before the
        // m-prefix bump or do_attack(), so a swallowed attack never becomes
        // an automatic multi-step sequence.
        if (game.context.forcefight || !heroMayDisplaceMonster(monster))
            nomul(0, game);
        if (await bumpIntoMonster(monster, monster.mx, monster.my))
            return true;
        const safeMonster = !game.context.forcefight && heroMayDisplaceMonster(monster);
        if (safeMonster && artifactById(game.uwep?.oartifact, game)?.name !== 'Stormbringer') {
            if (await do_attack(monster, monster.mx, monster.my, { safeMonster }))
                return true;
            swallowerYielded = true;
        }
        else {
            const permission = await prepareAppliedWeaponAttack(monster, game.uwep ?? null, { state: game, struckAt: { x: monster.mx, y: monster.my } });
            if (!permission.proceed)
                return permission.spentTime;
            await do_attack(monster, monster.mx, monster.my, { permission });
            return true;
        }
    }
    const confused = (u?.confusionTurns || 0) > 0;
    const stunned = !!(u?.stunned || (u?.stunnedTurns || 0) > 0);
    let newx;
    let newy;
    if (swallowerYielded) {
        // C's swallowed branch owns its own prologue (hack.c:2733-2760):
        // air_turbulence(), slippery_ice_fumbling(), impaired_movement(),
        // water_turbulence(), the bounds/trap checks and
        // escape_from_sticky_mon() all live in the non-swallowed else
        // branch, so the yielded hero goes straight to the shared
        // fight/test_move tail on the swallower's square.
        newx = u.ux;
        newy = u.uy;
    }
    else {
        if (await airTurbulenceStopsHero())
            return true;
        checkSlipperyIce();
        // C hack.c:impaired_movement() always checks Confusion before deriving
        // the destination.  A nonzero rn2(5) keeps the requested direction; on
        // impairment, confdir(TRUE) chooses cardinals first and retries only an
        // out-of-bounds square or rock this body cannot traverse.
        if (stunned || (confused && rn2(5) === 0)) {
            let found = false;
            for (let tries = 0; tries <= 50; tries++) {
                confusePromptDirection(u, true);
                dx = u.dx ?? 0;
                dy = u.dy ?? 0;
                const x = u.ux + dx, y = u.uy + dy;
                if (!isok(x, y) || heroBadRock(game, x, y))
                    continue;
                found = true;
                break;
            }
            if (!found) {
                endVoluntaryMultiTurn(game);
                // Native nomul(0) ends repetition without clearing context.move.
                return true;
            }
        }
        // confdir() updates the same persistent vector selected by set_move_cmd().
        u.dx = dx;
        u.dy = dy;
        if (await waterTurbulenceStopsHero())
            return true;
        dx = u.dx;
        dy = u.dy;
        // C stores direction in u.dx/u.dy, so confdir() permanently changes the
        // pending Shift-direction run as well as this one destination.  The next
        // automatic step must retain that impaired direction; it may immediately
        // terminate against terrain which the originally requested line avoided.
        if (game._runState && game._runState.mode !== 8) {
            game._runState.dx = dx;
            game._runState.dy = dy;
        }
        newx = u.ux + dx;
        newy = u.uy + dy;
        if (!isok(newx, newy))
            return moveOutOfBounds(newx, newy);
        if (game.context.run) {
            const trap = knownRunTrap(newx, newy, game);
            const liquid = heroIsBlind(game) && runLiquidIsDangerous(newx, newy, game);
            if (trap || liquid) {
                const stopBeforeStep = game.context.run >= 2;
                if (stopBeforeStep) {
                    if (trap)
                        await announceRunTrap(trap, game);
                    else
                        await announceRunLiquid(newx, newy, game);
                }
                endVoluntaryMultiTurn(game);
                if (stopBeforeStep)
                    return false;
            }
        }
        if (await escapeFromStickyMonster(newx, newy))
            return true;
    }
    const loc = game.level?.at(newx, newy);
    // C domove_core() resolves a destination monster before test_move()
    // applies terrain restrictions.  In particular, the hero can attack
    // diagonally across an intact doorway even though moving through that
    // same doorway would be rejected.
    // The yielded swallower already passed through do_attack()'s safepet
    // block above; C's fall-through only reaches the second m_at() lookup
    // for the pet swap, never the attack again.
    const monster = swallowerYielded ? null
        : game.level ? monsterAtPosition(game.level, newx, newy) : null;
    const hiddenCeilingMonster = monster?.mundetected && !game.context.forcefight
        && !canSenseMonster(monster)
        && !(monsterHidesUnder(monster.mnum))
        && MONSTER_SYMBOL[monster.mnum] !== 57;
    // C display.h:_is_safemon() requires a spotted peaceful monster and
    // an unimpaired hero. Concealed ceiling monsters still cancel running
    // here, before domove_attackmon_at() leaves their reveal to arrival.
    const safeMonster = !!monster && !game.context.forcefight
        && heroMayDisplaceMonster(monster);
    if (monster) {
        // hack.c checks context.run even when F makes this a single step.
        // It stops only for a visible or sensed actor. Seeing the
        // destination terrain is insufficient when minvis hides its occupant;
        // that case must reach attack_checks() and install the invisible
        // marker instead.
        // hack.c:2764 gates this on !_is_safemon() alone; forcefight is not
        // part of that macro.  An 'F' prefix that survives an intervening
        // unbound key past a later 'G' run prefix therefore bypasses the
        // guard for a visible peaceful pet, and the run step becomes a real
        // attack in do_attack().
        if (game.context.run && !heroMayDisplaceMonster(monster)
            && ((!heroIsBlind(game) && monsterVisible(monster, game)
                && ((M_AP_TYPE(monster) !== M_AP_FURNITURE
                    && M_AP_TYPE(monster) !== M_AP_OBJECT)
                    || heroHasProtectionFromShapeChangers(game)))
                || canSenseMonster(monster))) {
            stopRun(game);
            return false;
        }
        // C assigns u.ux0/u.uy0 after the run-visible-hostile guard but
        // before resolving displacement or attack.  A blocked/attacking
        // attempt therefore still refreshes the retreat reference point.
        u.ux0 = u.ux;
        u.uy0 = u.uy;
        // hack.c:domove_core() calls nomul(0) for every non-safe destination
        // monster after the visible-run guard and origin snapshot, but before
        // do_attack().  An unseen hostile therefore spends this attempted
        // step in attack_checks() while preventing another automatic run
        // step after the intervening monster phase; nomul(0) also requests
        // a full status update.
        if (!safeMonster)
            nomul(0, game);
        if (await bumpIntoMonster(monster, newx, newy))
            return true;
    }
    if (monster && !hiddenCeilingMonster) {
        if (beastChoosesHeroDisplacement(monster, game, newx, newy)) {
            const ballChainMove = await beginBallAndChainMove(newx, newy);
            if (ballChainMove?.blocked) {
                game.context.move = Number(ballChainMove.consumedTurn);
                return ballChainMove.consumedTurn;
            }
            const oldx = u.ux, oldy = u.uy;
            updateHeroRegions(game, newx, newy);
            u.ux = newx;
            u.uy = newy;
            await leaveMovementCloud(game, heroSpecies(game), !!u.mcan, oldx, oldy);
            await settleBeastHeroDisplacement(monster, game);
            if (game.program_state.gameover)
                return true;
            return finishHeroMovement({ oldx, oldy, loc, ballChainMove });
        }
        // C hack.c:domove_attackmon_at(): do_attack() returns FALSE only
        // when the target yields, and the step then continues through the
        // ordinary move checks below.  Every stopped attack spends the
        // action — dopay() bumps, displacement refusals, deaths and life
        // saving alike — except attack_checks()'s free "Really attack?"
        // refusal, which arrives as 'declined'.  The turn cost is read from
        // that outcome, not from context.move: savelife() zeroes it
        // mid-attack (C end.c) and the cmd seam overwrites it afterwards.
        const attacked = await do_attack(monster, newx, newy, { safeMonster });
        if (attacked === 'declined')
            return false;
        if (attacked)
            return true;
    }
    // domove_core() snapshots the origin before test_move().  This includes
    // the terminal blocked step of a Shift-run, which is why later monster
    // missile logic can observe the hero as stationary rather than retreating.
    u.ux0 = u.ux;
    u.uy0 = u.uy;
    const weapon = game.uwep || game.u.uwep;
    if (game.context.forcefight && loc?.typ === IRONBARS && weapon) {
        game.bhitpos.x = newx;
        game.bhitpos.y = newy;
        await strikeIronBarsWithWeapon(weapon, newx, newy, game);
        return true;
    }
    if (await fightSeenWebWithForce(newx, newy, game))
        return true;
    if (await fightEmptyDestination(newx, newy))
        return true;
    // hack.c:domove() clears a remembered unseen monster at the destination
    // before trying to move; a displacer-beast swap returned above and skips
    // this, matching the native !displaceu guard.
    await unmap_invisible(newx, newy);
    if ((dx || dy) && await ridingPreventsMovement()) {
        stopRun(game);
        return true;
    }
    if (await rootedHeroCannotMove())
        return true;
    if (testHeroMove(u.ux, u.uy, newx, newy, 'test', game).passes
        && !await confirmHeroStep(newx, newy))
        return false;
    if (u.utrap) {
        // domove()'s trapmove() + reset_utrap(TRUE) release live in the
        // trapmove port, including the flight/levitation restore.
        const canMove = await heroCanMoveFromTrap(newx, newy);
        if (!canMove)
            return true;
    }
    // C test_move(DO_MOVE) learns obstructed terrain by touch before trying
    // to pass through it, open a door, or reject a diagonal doorway entry.
    if (loc && heroIsBlind(game) && (IS_OBSTRUCTED(loc.typ)
        || loc.typ === DOOR && (!!(loc.doormask & (D_CLOSED | D_LOCKED))
            || !!(dx && dy) && !heroPassesWalls(game)
                && blocksDiagonalDoor(null, loc)))) {
        await feel_location(newx, newy);
    }
    // C test_move()'s iron-bars branch (hack.c:1011, 1024-1036): a blind
    // hero feels the bars; an underwater body reports the obstacle; a
    // rusting, corrosive or metallivorous body chews; anything that neither
    // passes walls nor fits between the bars is stopped.
    if (loc?.typ === IRONBARS) {
        if (game.blind)
            await feel_location(newx, newy);
        if (!heroPassesWalls(game)) {
            if (game.u.uinwater) {
                await pline('There is an obstacle there.');
                return rejectHeroMove();
            }
            const body = { mnum: heroSpecies(game) };
            const eatsMetal = metallivorous(body.mnum);
            if ((eatsMetal || monsterCorrodesBars(body)) && await continueChewingTerrain(newx, newy, game))
                return rejectHeroMove();
            if (!monsterPassesBars(body)) {
                if (game.flags.mention_walls)
                    await pline('You cannot pass through the bars.');
                return rejectHeroMove();
            }
        }
    }
    const tunnels = speciesTunnels(heroSpecies(game)) && !needspick(heroSpecies(game));
    if (loc && (IS_OBSTRUCTED(loc.typ)
        || loc.typ === DOOR && !!(loc.doormask & (D_CLOSED | D_LOCKED)))
        && !heroCanPassWallAt(game, newx, newy) && !heroOozesUnderDoor(loc)) {
        if (u.uinwater || game.underwater) {
            await pline('There is an obstacle there.');
            return rejectHeroMove();
        }
        if (tunnels && await continueChewingTerrain(newx, newy, game))
            return rejectHeroMove();
    }
    const oozingUnderDoor = heroOozesUnderDoor(loc);
    if (oozingUnderDoor)
        await pline('You ooze under the door.');
    if (loc?.typ === DOOR && (loc.doormask & (D_CLOSED | D_LOCKED))
        && !heroCanPassWallAt(game, newx, newy) && !oozingUnderDoor) {
        const fumbling = !!(u?.fumbling || (u?.fumblingTurns || 0) > 0);
        const blind = !!(u?.blind || (u?.blindTurns || 0) > 0);
        const dexterity = currentAttribute(A_DEX);
        const autoopenEligible = (game.flags?.autoopen ?? true)
            && !game.context.run
            && !confused
            && !stunned
            && !fumbling;
        // C test_move(DO_MOVE) suppresses auto-open while running, Confused,
        // Stunned, or Fumbling, and also when the option is disabled.  The
        // resulting orthogonal fallback is independently classified: Blind,
        // Stunned, low Dexterity, or Fumbling spends the turn on an "Ouch!"
        // bump, while Confusion by itself only reports a closed door.
        // C test_move() reports the failed ooze for any amorphous form whose
        // inventory cannot fit under the door, before the open-or-bump
        // decision, and for diagonal attempts as well.
        if (monsterIsAmorphous({ mnum: heroSpecies(game) })) {
            await pline("You try to ooze under the door,"
                + " but can't squeeze your possessions through.");
        }
        if (!autoopenEligible) {
            // test_move(DO_MOVE) only reports the closed-door message for an
            // orthogonal attempt.  A diagonal attempt which reaches this
            // fallback is rejected silently before the intact-door check.
            if (!dx || !dy) {
                if (blind || stunned || dexterity < 10 || fumbling) {
                    if (u.usteed) {
                        // C substitutes a riding failure for the bump, with
                        // the same move consumption but no Dexterity exercise.
                        await pline(`You can't lead ${monsterName(u.usteed, { state: game, article: 'your' })} through that closed door.`);
                    }
                    else {
                        await pline('Ouch!  You bump into a door.');
                        await exerciseAttribute(A_DEX, false);
                    }
                    // C sets context.move despite returning false from
                    // test_move(), then nomul(0).  `true` is this port's
                    // scheduler-facing "time elapsed" result; the hero's
                    // coordinates remain unchanged.
                    nomul(0, game);
                    game.context.move = 1;
                    return true;
                }
                await pline('That door is closed.');
            }
            return rejectHeroMove();
        }
        await doopen(newx, newy);
        // C hack.c:1098-1111: an autounlock kick queued behind the open
        // fakes door_opened so the walk continues into the canned kick;
        // otherwise the door must actually have opened, or domove_core()
        // stops the hero with context.move = 0 and nomul(0)
        // (hack.c:2841-2847).
        const kick = cmdq_peek(CQ_CANNED);
        const queuedKick = game.context.move === 0
            && kick?.typ === CMDQ_EXTCMD && kick.ecEntry.handler === 'dokick';
        const opened = !(loc.doormask & (D_CLOSED | D_LOCKED));
        if (!opened && !queuedKick)
            return rejectHeroMove();
        game.context.move = 0;
        return 'opened-door';
    }
    // C test_move() rejects an obstructed destination before it evaluates
    // tight-diagonal shoulders.  A boulder on ordinary floor is not terrain
    // obstruction, so that case still reaches cant_squeeze_thru() below
    // before moverock().
    if (blocksMove(newx, newy) && !heroCanPassWallAt(game, newx, newy)
        && !oozingUnderDoor) {
        const weapon = game.uwep || game.u.uwep;
        if (loc && IS_OBSTRUCTED(loc.typ) && game.flags?.autodig
            && !game.context.run && !game.context.nopick && weapon && isPick(weapon)
            && !(game.underwater || u.uinwater)) {
            u.dz = 0;
            const result = await applyPickAxeDirection(weapon, {
                state: game,
                attackMonster: (target, struckAt, permission) => do_attack(target, struckAt.x, struckAt.y, { permission }),
                payShopkeeper: dopay,
            });
            if (result.died)
                return false;
            return rejectHeroMove();
        }
        if (loc?.typ === DBWALL) {
            // C test_move(): the raised drawbridge reports itself before the
            // generic mention_walls fallback and without that option.
            await pline('That drawbridge is up!');
        }
        else if (heroPassesWalls(game) && In_sokoban(game.u.uz)) {
            // C test_move() keys this off In_sokoban(), so the soko
            // restriction stays even after the puzzle is solved and
            // level.flags.sokoban_rules has been cleared.
            await pline('The Sokoban walls resist your ability.');
        }
        else if (game.flags?.mention_walls) {
            // C test_move() names the obstruction from back_to_glyph(), so
            // an undetected secret door reads as a wall, a secret corridor
            // and an unseen square as solid stone, and arboreal stone as a
            // tree; pline_dir() marks the message's direction.
            let obstruction = '';
            if (loc) {
                const name = terrain_glyph(loc, newx, newy).terrainName;
                obstruction = name === 'stone' ? 'solid stone' : withIndefiniteArticle(name);
            }
            if (obstruction)
                await pline_dir(xyToDirection(dx, dy), `It's ${obstruction}.`);
        }
        return rejectHeroMove();
    }
    // C test_move()'s diagonal doorway-entry reject (hack.c:1140-1150): the
    // destination doorway must be doorless or unblocked, and an ooze under a
    // closed door left as passable above does not count as a doorway.
    if (dx && dy && !heroPassesWalls(game)) {
        const entryDoor = heroOozesUnderDoor(loc) ? null : loc;
        const intactEntry = blocksDiagonalDoor(null, entryDoor);
        const doorKeeper = !intactEntry && entryDoor?.typ === DOOR ? shopkeeperBlockingDoor(newx, newy) : null;
        if (intactEntry || doorKeeper) {
            if (doorKeeper) {
                const invisible = propertyIsActive('invisible', game);
                await plineWithContinuation(`${shopkeeperName(doorKeeper, { capitalized: true })}${invisible ? ' senses your motion and' : ''} blocks your way!`);
            }
            if (game.flags.mention_walls || game.u.uinwater || game.underwater) {
                await plineWithContinuation("You can't move diagonally into an intact doorway.");
            }
            game.context.move = 0;
            return rejectHeroMove();
        }
    }
    // C test_move()'s tight-diagonal reject (hack.c:1153-1171): both
    // orthogonal shoulders blocked by rock asks cant_squeeze_thru().
    if (dx && dy && heroBadRock(game, u.ux, newy) && heroBadRock(game, newx, u.uy)) {
        const reason = heroTightDiagonalReason(game);
        if (reason) {
            if (reason === 1)
                await pline('Your body is too large to fit through.');
            else if (reason === 2)
                await pline('You are carrying too much to get through.');
            else
                await pline('You cannot pass that way.');
            game.context.move = 0;
            return rejectHeroMove();
        }
    }
    if (!(dx && dy && heroBadRock(game, u.ux, newy) && heroBadRock(game, newx, u.uy))
        && wormCrossesBetween(u.ux, u.uy, newx, newy, game)) {
        const worm = monsterAtPosition(game.level, u.ux, newy);
        if (!worm)
            throw new Error('A crossing worm must occupy the adjacent square.');
        await pline(`${monsterName(worm, { state: game, article: 'your', capitalized: true })} is in your way.`);
        return rejectHeroMove();
    }
    // C test_move()'s diagonal doorway-exit reject (hack.c:1208-1214): the
    // origin doorway must be doorless, or its shopkeeper unblocked.
    if (dx && dy && !heroPassesWalls(game)) {
        const origin = game.level?.at(u.ux, u.uy);
        const intact = origin?.typ === DOOR ? blocksDiagonalDoor(origin, null) : false;
        const keeper = !intact && origin?.typ === DOOR ? shopkeeperBlockingEntry(newx, newy) : null;
        if (!intact && keeper) {
            const invisible = propertyIsActive('invisible', game);
            await plineWithContinuation(`${shopkeeperName(keeper, { capitalized: true })}${invisible ? ' senses your motion and' : ''} blocks your way!`);
        }
        if (intact || keeper) {
            if (game.flags.mention_walls)
                await plineWithContinuation("You can't move diagonally out of an intact doorway.");
            game.context.move = 0;
            return rejectHeroMove();
        }
    }
    const boulder = heroPassesWalls(game) && !game.level.flags.sokoban_rules ? null
        : (game.level.objects[newx]?.[newy] || []).find(object => object.otyp === BOULDER);
    const hallucinating = heroIsHallucinating(game);
    if (boulder && (game.context.run ?? 0) >= 2
        && !game.blind && !hallucinating
        && !heroCouldMoveOntoBoulder(newx, newy)) {
        if (game.flags?.mention_walls)
            // C test_move() reports the boulder through pline_dir().
            await pline_dir(xyToDirection(dx, dy), 'A boulder blocks your path.');
        return rejectHeroMove();
    }
    if (boulder) {
        if (tunnels && !game.level.flags.sokoban_rules) {
            if (await continueChewingTerrain(newx, newy, game))
                return rejectHeroMove();
        }
        else {
            game.context.move = 0;
            const pushed = await pushBouldersAt(newx, newy, dx, dy);
            if (game.program_state.gameover)
                return true;
            if (!pushed) {
                // moverock() spends the move only when the hero learned
                // something; that path sets context.door_opened in C.
                return game.context.move ? true : rejectHeroMove();
            }
        }
    }
    // C hack.c:swim_move_danger().  Known walking equipment and the swim
    // confirmation option decide whether a visible liquid edge stops us.
    // The request-menu (`m`) prefix deliberately accepts that step.
    if (heroShouldAvoidLiquid(newx, newy)) {
        const liquid = waterbodyName(newx, newy);
        const warning = `You avoid ${ingSuffix(heroLocomotion('step'))} into the ${liquid}.`;
        await plineWithContinuation(warning);
        // C handle_tip(TIP_SWIM) is an ordinary pline after the warning.
        const tip = 1 << TIP_SWIM;
        if (game.flags?.tips !== false && !((game.context.tips ?? 0) & tip)) {
            game.context.tips = (game.context.tips ?? 0) | tip;
            await plineWithContinuation("(Tip: use 'm' prefix to step in if you really want to.)");
        }
        return rejectHeroMove();
    }
    // C domove_core(): drag the ball before tentatively moving and swapping.
    const ballChainMove = await beginBallAndChainMove(newx, newy);
    if (ballChainMove?.blocked) {
        game.context.move = Number(ballChainMove.consumedTurn);
        return ballChainMove.consumedTurn;
    }
    const oldx = u.ux, oldy = u.uy;
    u.ux0 = oldx;
    u.uy0 = oldy;
    updateHeroRegions(game, newx, newy);
    const destinationMonster = monsterAtPosition(game.level, newx, newy);
    u.ux = newx;
    u.uy = newy;
    // C hack.c:domove_core() m_postmove_effect(&youmonst) at u.ux0/u.uy0.
    await leaveMovementCloud(game, heroSpecies(game), !!u.mcan, oldx, oldy);
    await moveSteedWithHero();
    if (destinationMonster && heroMayDisplaceMonster(destinationMonster)
        && !hiddenCeilingMonster) {
        const monster = destinationMonster;
        // C drag_ball() can pull the hero back before the swap check.
        // A refused swap still completes ball placement and its delay.
        if (!await settlePetHeroDisplacement(monster, game)) {
            u.ux = oldx;
            u.uy = oldy;
            if (u.usteed) {
                u.usteed.mx = oldx;
                u.usteed.my = oldy;
            }
        }
        else if (game.program_state.gameover)
            return true;
    }
    return finishHeroMovement({
        oldx, oldy, loc, ballChainMove,
    });
}
// ---------------------------------------------------------------------------
// The accessibility notices behind the spot_monsters option (C
// a11y.mon_notices), ported in noticeMonster() (hack.c:notice_mon()) and
// noticeAllMonsters() (hack.c:notice_all_mons()) below. C latches each
// monster's mspotted and prints "You see <mon>." once per sighting; a
// monster that can no longer be spotted drops its latch silently.
// vision_recalc() owns the catch-up, including recalculations triggered by
// message output. Startup, level arrival, mapping, and teleport landings
// block both monster and glyph notices until their own messages finish.
// ---------------------------------------------------------------------------
// C include/monflag.h: M1_HIDE (is_hider) and M2_PNAME (type_is_pname).
// C flag.h:notice_mon_off()/notice_mon_on(). A nested landing must leave
// its caller's notices blocked until that caller has finished its messages.
export function blockMonsterNotices(state) {
    state._monsterNoticesBlocked = (state._monsterNoticesBlocked ?? 0) + 1;
}
export async function unblockMonsterNotices(state) {
    state._monsterNoticesBlocked = (state._monsterNoticesBlocked ?? 0) - 1;
    if (state._monsterNoticesBlocked < 0) {
        await impossible('mon_notices_blocked<0', { state });
        state._monsterNoticesBlocked = 0;
    }
}
export async function withMonsterNoticesBlocked(state, action) {
    blockMonsterNotices(state);
    try {
        return await action();
    }
    finally {
        await unblockMonsterNotices(state);
    }
}
function monsterIsSpottable(monster) {
    if (!canSpotMonster(monster))
        return false;
    // C: a hider that is still concealing itself never counts as spotted,
    // whether mundetected or mimicking furniture or an object.
    if (monsterIsHider(monster.mnum)
        && (monster.mundetected
            || M_AP_TYPE(monster) === M_AP_FURNITURE
            || M_AP_TYPE(monster) === M_AP_OBJECT)) {
        return false;
    }
    return true;
}
// C hack.c:notice_mon(). The announcement names the monster with its own
// article rules: pets are yours, unnamed common monsters take "a", and
// named or proper-name monsters take no article at all. A peaceful monster
// that is not a pet is described as peaceful.
export async function noticeMonster(monster, state = game, publish = plineWithContinuation) {
    if (!state.flags.spot_monsters || state._monsterNoticesBlocked)
        return;
    const spottable = monsterIsSpottable(monster);
    if (spottable && !monster.mspotted && !monster.dead && monster.mhp > 0) {
        monster.mspotted = 1;
        const named = MGIVENNAME(monster) !== '';
        const article = monster.mtame ? 'your'
            : !named && !(monsterHasProperName(monster.mnum)) ? 'a'
                : 'none';
        // C hack.c:1727 suppresses the saddle only for a named monster, so
        // an unnamed steed is announced as "your saddled pony".
        const name = monsterName(monster, {
            state,
            article,
            suppressSaddle: named,
            ...(monster.mpeaceful && !monster.mtame ? { adjective: 'peaceful' } : {}),
        });
        await publish(`You ${canSeeMonster(monster) ? 'see' : 'notice'} ${name}.`, {
            position: { x: monster.mx, y: monster.my },
        });
    }
    else if (!spottable) {
        monster.mspotted = 0;
    }
}
// C hack.c:notice_all_mons(). Monsters that can no longer be spotted drop
// their latch (the native reset flag is always TRUE at every call site),
// and the spottable ones are announced nearest first, like the native
// distance sort of notice_mons_cmp().
export async function noticeAllMonsters(state = game, publish = plineWithContinuation) {
    if (!state.flags.spot_monsters || state._monsterNoticesBlocked)
        return;
    const spottable = [];
    for (const monster of state.level?.monsters ?? []) {
        if (monster.dead || monster.mhp <= 0)
            continue;
        if (canSpotMonster(monster))
            spottable.push(monster);
        else
            monster.mspotted = 0;
    }
    const { ux, uy } = state.u;
    spottable.sort((one, two) => (one.mx - ux) ** 2 + (one.my - uy) ** 2 - ((two.mx - ux) ** 2 + (two.my - uy) ** 2));
    for (const monster of spottable) {
        await noticeMonster(monster, state, publish);
    }
}
// Runtime command counts and involuntary delays.
// C refs: cmd.c:reset_cmd_vars(), rhack(), hack.c:nomul().
// C hack.c:nomul(). Caller-owned reasons and recovery messages follow this
// call even when a longer existing delay makes it return early.
export function nomul(value, state = game) {
    const previous = currentMulti(state);
    if (previous < value)
        return;
    if (previous >= 0)
        state.context.botl = true;
    const hero = state.u;
    hero.invulnerable = false; // u.uinvulnerable, not the timed property
    hero.usleep = 0;
    setMulti(value, state);
    if (value === 0)
        state._helplessReason = null;
    stopRun(state);
    cmdq_clear(CQ_CANNED, state);
}
// Keep the full command count and any occupation. A timed occupation may
// still need its final callback after the remaining multi becomes zero.
export function endVoluntaryMultiTurn(state = game) {
    nomul(0, state);
}
function monsterHasActiveAttack(monster) {
    return (MONSTER_ATTACKS[monster?.mnum] || [])
        .some(([attackType]) => attackType && attackType !== AT_BOOM);
}
// C hack.c:monster_nearby().  This is the shared threat predicate used by
// both safe waiting and safe searching; it is intentionally stricter than
// mere adjacency.
export function threateningMonsterNearby(state = game) {
    const u = state.u;
    if (!u)
        return false;
    const hallucinating = heroIsHallucinating(state);
    for (let x = u.ux - 1; x <= u.ux + 1; x++) {
        for (let y = u.uy - 1; y <= u.uy + 1; y++) {
            if (!isok(x, y) || x === u.ux && y === u.uy)
                continue;
            const monster = state.level?.monsters.find(candidate => monsterHasMapPosition(candidate, state)
                && monsterOccupiesPosition(candidate, x, y));
            if (!monster || monster.dead || monster.mhp <= 0)
                continue;
            const appearance = M_AP_TYPE(monster);
            if (appearance === M_AP_FURNITURE || appearance === M_AP_OBJECT)
                continue;
            if (!hallucinating && (monster.mpeaceful || !monsterHasActiveAttack(monster)))
                continue;
            const hider = monsterIsHider(monster.mnum);
            if ((hider && monster.mundetected) || monsterIsHelpless(monster)
                || monsterIsScaredAt(monster, state, u.ux, u.uy)
                || !canSpotMonster(monster))
                continue;
            return true;
        }
    }
    return false;
}
// C hack.c:end_running(). An adjacent travel target first ends running
// without cancelling travel, then tests the step using ordinary move rules.
export function stopRun(g = game, andTravel = true) {
    const running = !!g.context.run;
    if (g.context.run && g.flags.time)
        g.context.time_botl = true;
    g.context.run = 0;
    // end_running() frees gt.travelmap whatever and_travel says.
    g._travelMap = undefined;
    if (running && g.flags.terrainstatus) {
        g.iflags.terrain_typ = MAX_TYPE;
        classifyStatusTerrain(g);
    }
    if (andTravel) {
        g._runState = null;
        g.context.mv = false;
        g.context.travel = false;
        g.context.travel1 = false;
    }
    if (g.multi > 0)
        g.multi = 0;
}
// The travel-arrival cleanup of C end_running() (hack.c:4149-4157): clear
// the travel flags, free gt.travelmap (findtravelpath()'s selection) and
// cancel a pending repeat.  findtravelpath() restores run to 8 after its
// nomul(0) on arrival; keep that value: allmain.c suppresses new time
// updates until a command resets run. Only a screen flush consumes an
// already pending update; suppressed movement messages do not flush the
// screen (pline.c:vpline()).
export function arriveTravel(g = game) {
    g._travelMap = undefined;
    g._runState = null;
    g.context.mv = false;
    g.context.travel = false;
    g.context.travel1 = false;
    if (g.multi > 0)
        g.multi = 0;
}
// C flag.h RUN_TPORT: runmode:teleport skips every per-step display
// update until the multi-step action stops. Options normalize the value.
export function isTeleportRunmode(g = game) {
    const runmode = String(g.flags?.runmode || 'run').toLowerCase();
    return runmode === 'teleport' || runmode === 'tport';
}
export function runmodeDelayFrameCount(g = game, enabled = false, sourceTurn = g.moves || 0) {
    const runmode = String(g.flags?.runmode || 'run').toLowerCase();
    return !enabled
        || isTeleportRunmode(g)
        || ((runmode === 'run' || runmode === 'leap')
            && sourceTurn % 7 !== 0)
        ? 0 : runmode === 'crawl' ? 5 : 1;
}
export async function captureRunmodeDelay(g = game, enabled = false, sourceTurn = g.moves || 0, { preservePhysicalTopline = false, retainedTopline: suppliedRetainedTopline = null, } = {}) {
    const runmodeDelayFrames = runmodeDelayFrameCount(g, enabled, sourceTurn);
    if (!runmodeDelayFrames)
        return;
    g.context.time_botl = !!g.flags.time;
    const restoreTopline = (topline) => {
        if (!topline)
            return;
        for (const [col, cell] of topline.entries()) {
            g.nhDisplay?.setCell(col, 0, cell.ch, cell.color, cell.attr);
        }
    };
    const retainedTopline = preservePhysicalTopline && !g._pending_message
        ? (suppliedRetainedTopline
            || g.nhDisplay?.grid?.[0])?.map(cell => ({ ...cell }))
        : null;
    await flush_screen(1);
    const logicalTopline = retainedTopline
        ? g.nhDisplay?.grid?.[0]?.map(cell => ({ ...cell }))
        : null;
    restoreTopline(retainedTopline);
    g.nhDisplay?.setCursor((g.u?.ux ?? 1) - 1, (g.u?.uy ?? 0) + 1);
    try {
        for (let frame = 0; frame < runmodeDelayFrames; frame++)
            await g.animationFrame?.();
    }
    finally {
        // A retained physical prompt belongs only to the animation snapshot.
        // Leave the live tty grid in the logical post-flush state so a later
        // input boundary cannot inherit stale prompt text.
        restoreTopline(logicalTopline);
    }
}
// C's function-call argument is evaluated before wipeEngravingAt() discovers
// nowipeout.  Lua tutorial engravings therefore still own rnd(5) when an
// explicit movement leaves or enters one, despite degrade=false.
// C hack.c:maybe_smudge_engr().
export function maybeSmudgeEngravings(x1, y1, x2, y2) {
    if (!heroCanReachFloor(game, { checkPit: true }))
        return;
    const departure = engravingAt(x1, y1);
    if (departure && departure.engr_type !== HEADSTONE)
        wipeEngravingAt(x1, y1, rnd(5), false);
    const arrival = engravingAt(x2, y2);
    if ((x2 !== x1 || y2 !== y1) && arrival && arrival.engr_type !== HEADSTONE) {
        wipeEngravingAt(x2, y2, rnd(5), false);
    }
}
function heroIsHelpless(state) {
    return (state.multi ?? 0) < 0
        || (state._helplessTurns ?? 0) > 0;
}
function activeHitPointField(hero) {
    return Upolyd(hero) ? 'mh' : 'uhp';
}
// C hack.c:overexertion().
export async function checkHeroAttackOverexertion(state = game) {
    requirePlayingGame(state);
    await gethungry();
    if (state.program_state.gameover)
        return true;
    if ((state.moves ?? 0) % 3 !== 0
        && nearCapacity(state) >= HVY_ENCUMBER)
        await overexertHeroHp(state);
    return heroIsHelpless(state);
}
// C hack.c:overexert_hp(): heavy work costs a hit point, or the last one
// makes the hero pass out.
export async function overexertHeroHp(state = game) {
    requirePlayingGame(state);
    const field = activeHitPointField(state.u);
    const hitPoints = state.u?.[field] ?? 0;
    if (hitPoints > 1) {
        state.u[field] = hitPoints - 1;
        state.context.botl = true;
    }
    else {
        await pline('You pass out from exertion!');
        await exerciseAttribute(A_CON, false, state);
        await putHeroToSleep(10, {
            state,
            doneMessage: 'You can move again.',
        });
    }
}
// C hack.c:invocation_message().  The vibrating square's felt announcement.
function heroPositionDescription() {
    const steed = game.u?.usteed;
    if (steed) {
        const name = monsterName(steed, { article: 'your' });
        return `beneath ${name}`;
    }
    if (game.u.levitating || game.u.flying)
        return 'beneath you';
    return `under your ${makePlural(heroFootName())}`;
}
function carriedCandelabrum() {
    return (game.inventory || []).find(object => object.otyp === CANDELABRUM_OF_INVOCATION);
}
export async function announceInvocationSquare() {
    if (!isInvocationPosition(game.u?.ux, game.u?.uy)
        || heroIsOnStairs())
        return false;
    stopRun();
    await plineWithContinuation(formatFeltMessage(`a strange vibration ${heroPositionDescription()}.`));
    if (!game.u.uevent)
        game.u.uevent = {};
    game.u.uevent.uvibrated = 1;
    const candelabrum = carriedCandelabrum();
    if (candelabrum?.spe === 7 && candelabrum.lamplit) {
        await plineWithContinuation(`${definiteObjectAction(candelabrum, null)} ${game.blind ? 'throbs palpably'
            : 'glows with a strange light'}!`);
    }
    return true;
}
// C hack.c:invocation_pos().
export function isInvocationPosition(x, y, state = game) {
    return Invocation_lev(state.u?.uz, state)
        && !!state.level?.traps?.some(trap => trap.ttyp === VIBRATING_SQUARE && trap.tx === x && trap.ty === y);
}
export function heroIsOnStairs(state = game) {
    const x = state.u?.ux, y = state.u?.uy;
    if (state.level?.upstair?.x === x && state.level.upstair.y === y)
        return true;
    if (state.level?.dnstair?.x === x && state.level.dnstair.y === y)
        return true;
    for (let stair = state.stairs; stair; stair = stair.next) {
        if (stair.sx === x && stair.sy === y)
            return true;
    }
    return false;
}
// C hack.c:1785-1794.  `violent` marks a kick or throw; a plain drop needs
// ten times the weight to be noticeable.  The coordinates are the impact
// object's post-placement position.
export function impactDisturbsZombies(object, violent, state = game) {
    // if object won't make a noticeable impact, let buried zombies rest
    if (!object || object.owt < (violent ? 10 : 100) || isFlimsyObject(object, game))
        return;
    disturbBuriedZombies(object.ox, object.oy, state);
}
// C hack.c:1796-1813.  Pure timer arithmetic: no RNG, messages, or display,
// so this stays state-aware rather than live-game locked.
export function disturbBuriedZombies(x, y, state = game) {
    const moves = state.moves ?? 0;
    for (const corpse of state.level?.buriedObjects || []) {
        if (corpse.otyp !== CORPSE)
            continue;
        if (Math.abs(corpse.ox - x) > 1 || Math.abs(corpse.oy - y) > 1)
            continue;
        const timer = objectTimers(corpse).find(candidate => candidate.kind === OBJECT_TIMER_KIND.ZOMBIFY_MON);
        // C peek_timer() returns the absolute deadline; only a deadline of
        // zero (no timer) leaves the corpse alone.  Due and overdue timers
        // still qualify and land on the one-turn floor below.
        if (!timer || timer.deadline <= 0)
            continue;
        // C stop_timer() returns the remaining time, possibly negative.
        const remaining = timer.deadline - moves;
        stopObjectTimer(corpse, OBJECT_TIMER_KIND.ZOMBIFY_MON);
        scheduleObjectTimer(corpse, OBJECT_TIMER_KIND.ZOMBIFY_MON, moves + Math.max(1, Math.floor((remaining * 2) / 3)), state);
    }
}
// C hack.c:may_dig().  Only ROCKs and TREEs carry W_NONDIGGABLE.
export function mayDig(x, y, state = game) {
    const location = state.level?.at(x, y);
    if (!location)
        return false;
    return !((IS_STWALL(location.typ) || IS_TREE(location.typ))
        && ((location.wall_info ?? 0) & W_NONDIGGABLE));
}
// C hack.c:spot_checks().  Stale ice timers and ice-held object state must go
// when terrain stopped being ice.
export function spotChecks(x, y, oldTyp, state = game) {
    const location = state.level?.at?.(x, y);
    if (!location)
        return;
    const newTyp = location.typ;
    const dbIceBefore = oldTyp === DRAWBRIDGE_UP
        && ((location.drawbridgemask ?? 0) & DB_UNDER) === DB_ICE;
    const changed = newTyp !== oldTyp
        || (oldTyp === DRAWBRIDGE_UP && !dbIceBefore);
    if (!((oldTyp === ICE) || dbIceBefore) || !changed)
        return;
    stopLevelTimer(x, y, LEVEL_TIMER_KIND.MELT_ICE_AWAY, state);
    updateIceObjectTimersAt(x, y, state);
}
const RIN_LEVITATION = OBJECT_NAMES.indexOf('levitation');
const FELL_ON_SINK = 'fell onto a sink';
function wornAt(slot, state) {
    return state[slot] || state.u?.[slot] || null;
}
// C HFlying || EFlying: the hero's own flight sources before the Flying
// macro applies the blocked mask or a flying steed.  A steed therefore does
// not prevent the fall, and neither does flight overridden by levitation.
function heroHasOwnFlight(state) {
    return hasIntrinsicProperty('flying', null, state)
        || hasWornProperty('flying', state)
        || hasInvokedProperty('flying', state)
        || (state.u.flyingTurns ?? 0) > 0;
}
// C Maybe_Half_Phys().
function maybeHalfPhysicalDamage(amount, state) {
    const hero = state.u;
    return hero.halfPhysicalDamage
        ? Math.trunc((amount + 1) / 2) : amount;
}
function isWeaponOrWeaponTool(object) {
    return object.oclass === WEAPON_CLASS
        || (object.oclass === TOOL_CLASS && objectSkill(object.otyp) !== 0);
}
export async function fallIntoSink(state = game, { publish = plineWithContinuation, die = finishHeroDeath } = {}) {
    // World side effects are singleton-only: every production caller uses
    // the live game, so a stale fixture must fail before any source stash.
    requireLiveGame(state);
    const hero = state.u;
    let levBoots = wornAt('uarmf', state)?.otyp === LEVITATION_BOOTS;
    // innate_lev: HLevitation & (FROMOUTSIDE | FROMFORM).  Timeout and the
    // blessed-potion at-will flag do not count.
    const innateLev = hasIntrinsicProperty('levitation', 'outside', state)
        || hasIntrinsicProperty('levitation', 'form', state);
    // blockd_lev: BLevitation == I_SPECIAL, a floor-trap hold on live
    // levitation sources (buried iron ball), not solid terrain.
    const levitation = captureLevitationState(state);
    const blockdLev = levitation.blockedByTrap
        && !levitation.blockedByTerrain;
    const ufall = !innateLev && !blockdLev && !heroHasOwnFlight(state);
    if (!ufall) {
        await publish(innateLev || blockdLev
            ? 'You wobble unsteadily for a moment.'
            : 'You gain control of your flight.');
    }
    else {
        // Fake removal of levitation in advance so that final disclosure
        // will be right if the crash is fatal; the worn items really stay
        // equipped until the forced removal below (C save/zero/restore).
        const stash = stashLevitationSources(state, { clear: true });
        await publish('You crash to the floor!');
        const damage = rn1(8, 25 - currentAttribute(A_CON, state));
        if (await loseHeroHp(maybeHalfPhysicalDamage(damage, state), FELL_ON_SINK, { state, publish, die, killerFormat: NO_KILLER_PREFIX }))
            return { fell: true, died: true };
        await exerciseAttribute(A_DEX, false, state);
        const touch = await selfTouchPetrifyingWeapons({
            messageStart: 'Falling, you', state, publish, die,
        });
        if (touch.died)
            return { fell: true, died: true };
        const pile = state.level?.objects?.[hero.ux]?.[hero.uy] || [];
        for (const object of pile) {
            if (!isWeaponOrWeaponTool(object))
                continue;
            observeObjectForNaming(object, { state });
            await publish(`You fell on ${await floorObjectDescription(object)}.`);
            if (await loseHeroHp(maybeHalfPhysicalDamage(rnd(3), state), FELL_ON_SINK, { state, publish, die, killerFormat: NO_KILLER_PREFIX })) {
                return { fell: true, died: true };
            }
            await exerciseAttribute(A_CON, false, state);
        }
        restoreLevitationSources(stash, state);
    }
    // Interrupt multi-turn donning/doffing when the hero fell, or when the
    // removal below will take levitation boots off an still-floating hero.
    if (ufall || levBoots) {
        await stopDonning(levBoots ? wornAt('uarmf', state) : null, state);
        // stopDonning() may have unworn partially-donned boots.
        levBoots = wornAt('uarmf', state)?.otyp === LEVITATION_BOOTS;
    }
    // Remove worn levitation items: invoked artifact, at-will origin and
    // timeout first, then a one-turn timeout keeps Levitation true so the
    // forced Ring_off()/Boots_off() transitions skip float_down().
    clearLevitationMasks(I_SPECIAL | TIMEOUT, W_ARTI, state);
    hero.levitationTurns = 1; // C HLevitation++
    refreshProperty('levitation', state);
    const left = wornAt('uleft', state);
    if (left?.otyp === RIN_LEVITATION) {
        await removeHeroAccessory(left, state);
        const message = await armorOffMessage(left, state);
        if (message)
            await publish(message);
    }
    const right = wornAt('uright', state);
    if (right?.otyp === RIN_LEVITATION) {
        await removeHeroAccessory(right, state);
        const message = await armorOffMessage(right, state);
        if (message)
            await publish(message);
    }
    if (levBoots) {
        const boots = wornAt('uarmf', state);
        if (!boots)
            throw new Error('The levitation boots disappeared before forced removal');
        await removeHeroArmor(boots, state);
        const message = await armorOffMessage(boots, state);
        if (message)
            await publish(message);
    }
    hero.levitationTurns = 0; // C HLevitation--
    refreshProperty('levitation', state);
    refreshMovementProperties(state); // C float_vs_flight()
    state.context.botl = true;
    return { fell: ufall, died: false };
}
// C hack.c:losehp(). Damage belongs to the body the hero currently occupies.
export async function loseHeroHp(amount, killer, { state = game, publish = plineWithContinuation, die = finishHeroDeath, deathCause = null, killerFormat = KILLED_BY_AN, } = {}) {
    requirePlayingGame(state);
    const hero = state.u;
    const polymorphed = Upolyd(hero);
    const current = polymorphed ? 'mh' : 'uhp';
    const maximum = polymorphed ? 'mhmax' : 'uhpmax';
    state.context.botl = true;
    stopRun(state);
    const hpBefore = hero[current];
    hero[current] -= amount;
    if (state.flags?.showdamage && amount)
        await publish(`[HP ${-amount}, ${hero[current]} left]`);
    hero[maximum] = Math.max(hero[maximum], hero[current]);
    if (hero[current] > 0) {
        if (amount > 0 && hero[current] * 10 < hero[maximum]
            && (!polymorphed || hero.unchanging || state.unchanging
                || propertyIsActive('unchanging', state)))
            await maybeWail(state, publish);
        return false;
    }
    if (polymorphed) {
        const result = await returnHeroToHumanForm(state, { publish, die });
        return result.died;
    }
    return die({ killer, killerFormat, deathCause,
        damage: { hpKey: current, hpBefore, damage: amount } });
}
// C hack.c:maybe_wail(): the cooldown advances even when sound is suppressed.
async function maybeWail(state, publish) {
    if (state.moves <= (state._wailMessageMove ?? 0) + 50)
        return;
    state._wailMessageMove = state.moves;
    const role = state.urole;
    const namedRole = role?.key === 'wizard' || role?.key === 'valkyrie';
    if (namedRole || state.urace?.name === 'elf') {
        const who = namedRole ? role.name.m : 'Elf';
        if (state.u.uhp === 1) {
            await publish(`${who} is about to die.`);
            return;
        }
        const powers = [
            'teleportation', 'seeInvisible', 'poisonResistance', 'coldResistance',
            'shockResistance', 'fireResistance', 'sleepResistance', 'disintegrationResistance',
            'teleportControl', 'stealth', 'fast', 'invisible',
        ];
        const count = powers.filter(power => hasPermanentIntrinsicProperty(power, state)).length;
        await publish(count >= 4 ? `${who}, all your powers will be lost...`
            : `${who}, your life force is running out.`);
        return;
    }
    const warning = formatHeardMessage(state.u.uhp === 1
        ? 'the wailing of the Banshee...' : 'the howling of the CwnAnnwn...', state);
    if (warning)
        await publish(warning);
}
export const UNENCUMBERED = 0;
export const SLT_ENCUMBER = 1;
export const MOD_ENCUMBER = 2;
export const HVY_ENCUMBER = 3;
export const EXT_ENCUMBER = 4;
export const OVERLOADED = 5;
const S_NYMPH = 14;
const MZ_HUMAN = 2;
const WT_HUMAN = 1450;
// C hack.c:weight_cap() ignores the trap block on levitation, and defers
// the carrying benefit of boots whose Boots_on callback has not run yet.
export function levitationSupportsLoad(ignoreBoots, state = game) {
    return !existingPropertyRecord('levitation', state)?.blockedByTerrain
        && levitationSourceIsActive(ignoreBoots, state);
}
// Removing pending boots' levitation for weight_cap() also restores flight
// through float_vs_flight(). Query that temporary state without changing the
// abilities projected onto the hero while the boots are actually worn.
export function flyingSupportsLoad(ignoreBoots, state = game) {
    if (!ignoreBoots)
        return propertyIsActive('flying', state);
    if (existingPropertyRecord('flying', state)?.blockedByTerrain
        || levitationSourceIsActive(true, state))
        return false;
    const flying = propertySourceIsActive('flying', state);
    const hero = state.u;
    const trapped = (hero.utrap ?? 0) > 0 && hero.utraptype !== TT_PIT;
    if (flying && trapped)
        return false;
    const steedFlies = hero.usteed
        && monsterIsFlyer(hero.usteed.mnum);
    return flying || !!steedFlies;
}
export function inventoryWeight(state) {
    const inventory = state.inventory || [];
    const species = state.u.umonnum;
    const throwsRocks = species !== undefined && Number.isInteger(species)
        && monsterThrowsRocks(species);
    const objectWeightTotal = inventory.reduce((total, object) => {
        // NetHack's only coin denomination weighs one unit per 100 coins,
        // rounded after combining the entire inventory stack.
        if (object.oclass === COIN_CLASS)
            return total + Math.trunc((quantity(object) + 50) / 100);
        if (object.otyp === BOULDER && throwsRocks)
            return total;
        // C inv_weight() reads owt.  A partly eaten meal's owt is refreshed
        // only at eat.c:recalc_wt() checkpoints, not after every bite.
        if (object.oclass === FOOD_CLASS && (object.oeaten ?? 0) > 0 && object.owt !== undefined)
            return total + object.owt;
        return total + objectWeight(object);
    }, 0);
    return objectWeightTotal;
}
export function weightCapacity(state) {
    const strength = currentStrength(state);
    const constitution = currentAttribute(A_CON, state);
    let capacity = 25 * (strength + constitution) + 50;
    const mnum = state.u.umonnum;
    if ((state.u?.mtimedone ?? 0) > 0
        && mnum !== undefined && Number.isInteger(mnum)) {
        const bodyWeight = MONSTER_BODY_META[mnum]?.[0] ?? 0;
        const size = MONSTER_SIZE[mnum] ?? MZ_HUMAN;
        const strong = strongmonst(mnum);
        if (MONSTER_SYMBOL[mnum] === S_NYMPH) {
            capacity = 1000;
        }
        else if (!bodyWeight) {
            capacity = Math.trunc(capacity * size / MZ_HUMAN);
        }
        else if (!strong || bodyWeight > WT_HUMAN) {
            capacity = Math.trunc(capacity * bodyWeight / WT_HUMAN);
        }
    }
    const steedMnum = state.u?.usteed?.mnum;
    const strongSteed = steedMnum !== undefined && Number.isInteger(steedMnum)
        && strongmonst(steedMnum);
    const dressing = pendingArmorAction(state);
    const bootsPending = dressing?.kind === 'wear'
        && dressing.object === (state.uarmf ?? state.u.uarmf);
    const levitating = levitationSupportsLoad(bootsPending, state)
        || !bootsPending && !!(state.u.levitating || state.u.levitation || state.levitating);
    if (levitating || Is_airlevel(state.u?.uz) || strongSteed) {
        capacity = 1000;
    }
    else {
        capacity = Math.min(1000, capacity);
        const flying = flyingSupportsLoad(bootsPending, state)
            || !bootsPending && !!(state.u.flying || state.flying);
        if (!flying) {
            if (state.u?._woundedLegSide === 'both')
                capacity -= 200;
            else if (state.u?._woundedLegSide)
                capacity -= 100;
        }
    }
    // C hack.c:weight_cap() clears the pending Boots_on levitation bit
    // (4303-4306) and the floor-trap hold on BLevitation -- float_vs_flight()'s
    // I_SPECIAL for a hero with levitation sources caught in a non-pit trap
    // (polyself.c:133, 144-145) -- for the capacity math, and restores
    // whichever bit was actually cleared with float_vs_flight()
    // (4339-4343).  float_vs_flight() always ends with disp.botl = TRUE
    // (polyself.c:153), so every capacity recomputation in that state --
    // encumber_msg() opens each world turn and gethungry() runs inside it
    // -- requests a status repaint.  allmain.c:262 suppresses time_botl
    // while context.run is set, so during travel that botl request is what
    // repaints the turn counter at the next flush (allmain.c:473-479,
    // display.c:2236-2239).  BLevitation's FROMOUTSIDE bit (terrain that
    // blocks levitation, hack.c:3190) is never cleared by weight_cap(), so
    // it alone must not request the repaint.
    const floorTrapHold = (state.u.utrap ?? 0) > 0 && state.u.utraptype !== TT_PIT;
    if (floorTrapHold && propertySourceIsActive('levitation', state)
        || bootsPending
            && !!(existingPropertyRecord('levitation', state)?.worn.some(source => source.slot === 'uarmf')))
        state.context.botl = true;
    return Math.max(1, Math.min(1000, capacity));
}
export function invWeight(state) {
    return inventoryWeight(state) - weightCapacity(state);
}
export function calcCapacity(state, extraWeight = 0) {
    const capacity = weightCapacity(state);
    const excess = invWeight(state) + extraWeight;
    if (excess <= 0)
        return UNENCUMBERED;
    if (capacity <= 1)
        return OVERLOADED;
    return Math.min(Math.trunc(excess * 2 / capacity) + 1, OVERLOADED);
}
export function nearCapacity(state) {
    return calcCapacity(state, 0);
}
// C hack.c:check_capacity().  Keep the shared threshold separate from the
// caller-owned message so commands can reject before opening their UI.
export function exceedsActionCapacity(state) {
    return nearCapacity(state) >= EXT_ENCUMBER;
}
// C hack.c:money_cnt() over the hero's inventory: zero gold pieces
// rather than a missing stack.
export function heroGoldAmount(state) {
    const object = heroGoldObject(state);
    return object ? heroGoldQuantity(object) : 0;
}
// money_cnt() over a monster's minvent (the same C function as
// heroGoldAmount() above); C callers shk.c:4046, shk.c:5586, priest.c:614.
export function monsterGoldAmount(monster) {
    return monster.minvent?.find(object => object.oclass === COIN_CLASS)?.quan ?? 0;
}
export function roundDiv(numerator, denominator) {
    const magnitude = Math.trunc((Math.abs(numerator) + Math.trunc(denominator / 2)) / denominator);
    return Math.sign(numerator) * magnitude;
}
//# sourceMappingURL=hack.js.map