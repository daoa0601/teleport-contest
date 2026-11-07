// allmain.js — Main game loop.
// C ref: allmain.c — newgame, moveloop, moveloop_core, stop_occupation().
import { ceilingName, dungeonBuildsUp, dungeonDepth, initOverviewRecord, printLevelAnnotation, u_on_rndspot, In_hell } from './dungeon.js';
import { noticeAllMonsters, withMonsterNoticesBlocked, applyHeroLiquidEffects, continueRun, endVoluntaryMultiTurn, nomul, overexertHeroHp, finishDestinationSpotEffects, stopRun, captureRunmodeDelay, isTeleportRunmode, nearCapacity, checkSpecialRoom, finishHeroHelplessness } from './hack.js';
import { recorderLocalEpochSeconds, fixedCalendar, sessionIsNight } from './calendar.js';
import { pline, plineWithContinuation, publishHeardMessage, recordGameLogEvent } from './pline.js';
import { cmdq_clear, currentMulti, heroHasInvoluntaryDelay, setMulti, continueCountedCommand, promptYesNo, rhack, dolookaround } from './cmd.js';
import { getLine } from './windows.js';
import { doStorms } from './timeout.js';
import { rewindEngravingsForSave, engravingAt, wipeEngravingAt, readEngravingAt, wipeHeroEngraving } from './engrave.js';
import { angerMonster, finishEnvironmentalMonsterDeath, finishMonsterHideUnder, finishMonsterKilled, finishMonsterLiquidDeath, mcalcmove, purgeDeadMonsters, restoreMonsterShape, seeNearbyMonsters, monsterDistressEvents, monstersInFmonOrder, moveMonsters, resolveMonsterLiquid, monsterCanCarryObject, monsterFliesOrFloats, wakeMonstersNearWithMessages, finishHeroLiquidMonsterDeath, finishHeroMonsterKill, runMonsterAction, } from './mon.js';
import { heroIsHallucinating, heroIsBlind, heroIsDeaf, syncBlindness } from './senses.js';
import { learnWand, applyRayFloorFeatures, destroyColdInventory, destroyElectricInventory, destroyFireInventory, heroHasHalfSpellDamage } from './zap.js';
import { flashBurn } from './zap.js';
import { gethungry, eatfood } from './eat.js';
import { makeBlinded, makeStunned, setPropertyTimeout } from './potion.js';
import { game, requireGameLevel, requireInitializedGame, requireGameDisplay, requireLiveGame } from './gstate.js';
import { isRoom } from './map_types.js';
import { recordRandom } from './monster_action_types.js';
import { clearBypasses } from './worn.js';
import { clearSplitObjects, unlinkObject } from './mkobj.js';
import { tryCallObjectType } from './do.js';
import { observeBucForNaming, verbForSubject, observeDistantObjectForNaming, observeObjectForNaming, ownedObjectName } from './objnam.js';
import { observeObject, recordObjectEncounter, learnObjectType } from './o_init.js';
import { A_CURRENT, A_ORIGINAL, CQ_CANNED, CQ_REPEAT, ESCAPED, G_NOCORPSE, In_endgame, MON_FLOOR, PLNMSG_MON_TAKES_OFF_ITEM, RLOC_NOMSG, WATER, RLOC_MSG, LOST_STOLEN, MMOVE_DIED, NORMAL_SPEED, A_CHA, A_CON, A_DEX, A_INT, A_STR, A_WIS, COLNO, ROWNO, DOOR, D_CLOSED, D_LOCKED, HOLE, M_SEEN_ELEC, M_SEEN_FIRE, M_SEEN_MAGR, M_SEEN_REFL, STONE, ZAP_POS, M_ATTK_AGR_DIED, M_ATTK_AGR_DONE, W_ARMG, UNENCUMBERED, MOD_ENCUMBER, HVY_ENCUMBER, EXT_ENCUMBER, W_ACCESSORY, W_ARMOR, W_WEAPONS, ismnum, Upolyd, Is_airlevel, Is_waterlevel, TT_BURIEDBALL, TT_LAVA, KILLED_BY_AN, LL_ACHIEVE, } from './const.js';
import { pendingArmorAction, heroHasFreeAction, heroIsDisplaced, stopDonning, applyStartingArmorEffects, findArmorClass, erodeWornArmor, isBeingTakenOff, heroHasSlipperyHands, slipFromSlipperyHands } from './do_wear.js';
import { dosounds } from './sounds.js';
import { warnWithMasterKey, applyArtifactHit, findArtifact } from './artifact.js';
import { isPoolAt } from './dbridge.js';
import { consumeMonsterItem } from './mthrowu.js';
import { heroCanTeleport, randomMonsterRelocation, teleportHero, askTeleportDestination } from './teleport.js';
import { moveMonsterNextToHero } from './mon.js';
import { runDueTimers } from './timeout.js';
import { askKeepRestoredSave } from './save.js';
import { finishScheduledLevelChange } from './do.js';
import { monsterName, randomDisplayMonsterName } from './do_name.js';
import { possessiveName, dist2 } from './hacklib.js';
import { monsterSubjectPronoun, monstersForgetHeroResistance, monstersObserveHeroResistance, seenResistanceForDamage, monsterLocomotion, monsterIsAnimal, monsterIsNonliving, heroHasOlfaction, monsterIsEel } from './mondata.js';
import { MONSTER_GENO, MONSTER_ATTACKS, MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_LEVEL, MONSTER_MOVE, MONSTER_NAME, MONSTER_SOUND, MONSTER_SYMBOL } from './monster_data.js';
import { monsterAtPosition } from './steed.js';
import { finishHeroDeathAfterMonsterMessage, finishMonsterAttackDeath, waitForCurrentMonsterMore, finishHeroDeath, } from './end.js';
import { restoreMonsterCover, finishInUseInventory } from './restore.js';
import { releaseObjectLeash, checkHeroLeashes, heroNextToLeashedFollowers } from './apply.js';
import { ACID_VENOM, BOULDER, CORPSE, LEASH, GOLD_PIECE, } from './object_data.js';
import { heroIsUnaware } from './senses.js';
import { heroSpecies, setHeroSpecies, feelingAfterSelfGenocide, heroHasBeenGenocided, heroIsUnchanging, polymorphHero, returnHeroToHumanForm, heroIsBreathless } from './polyself.js';
import { heroHasConflict } from './hero_conflict.js';
import { openHoldingTrap, igniteItems, petrifyMonsterImmediately, burnHeroArmorByFire, sinkHeroIntoLava, activateStatueTrapAt, } from './trap.js';
import { AD_COLD, AD_DGST, AD_DRST, AD_FIRE, AD_MAGM, AD_SEDU, AD_SITM, AD_SSEX, AD_STCK } from './monster_attack_types.js';
import { loseHeroExperience } from './exper.js';
import { makeMonsterFlee, interruptOccupationForMonster, monsterSightingBeforeAction, completeMonsterOffensiveAction, heroEveryturnEffect, runMonsterEveryturnEffects, beginMonsterMove, beginMonsterDochug } from './monmove.js';
import { isWeldedPrimary } from './wield.js';
import { finishInventoryRemoval } from './invent.js';
import { currentLuaLifecycle } from './lua/lifecycle.js';
import { d, rn2, rnd } from './rng.js';
import { mklev, l_nhcore_init } from './mklev.js';
import { u_on_upstairs } from './stairs.js';
import { makemonAt, finishMonsterGrowth } from './makemon.js';
import { performQuestExpulsion, ensureQuestStatus, talkQuestCharacter } from './quest.js';
import { amuletTurn, intervene, publishMonsterCuss } from './wizard.js';
import { grantAmuletWish } from './wish.js';
import { changeHeroLuck, checkAttributeExercise, currentAttribute, exerciseAttribute, exerciseWisdom, loseHeroStrength, periodicTurnExercise } from './attrib.js';
import { encumber_msg } from './pickup.js';
import { rndcurse } from './throne.js';
import { resolveMonsterGaze, completeHeroAttackSlot, mattacku, missmu, resolveMonsterSelfExplosion } from './mhitu.js';
import { bot, statusEvalNextUnhilite, updateStatusLines } from './botl.js';
import { canSpotMonster, docrt, redrawMap, flush_screen, newsym, map_invisible, see_monsters, see_objects, see_traps, show_glyph_cell, swallowed, under_ground, under_water, canSeeMonster, monsterVisible, shieldeff, curs_on_u } from './display.js';
import { clearMessageWindow, displayMessageWindow, flushPendingTopline, rememberToplines, appendSuppressedTopline, resetToplineClip } from './topl.js';
import { cansee, couldsee, vision_note_blocker_change, vision_recalc, vision_reset_new_level } from './vision.js';
import { hasLightSources } from './light.js';
import { nhgetch } from './input.js';
import { NO_COLOR, CLR_BRIGHT_BLUE } from './terminal.js';
import { uInitMisc, makedog, uInitInventoryAttrs, finishStartingDiscoveries } from './u_init.js';
import { heroIsInvisible } from './hero_invisibility.js';
import { addObjectToMonsterInventory, finishDelayedArmorTheft, removeWornHeroItem } from './steal.js';
import { aligns, nativeRoleAt } from './role.js';
import { initializeSourceStartup } from './startup.js';
import { fumaroles } from './mkmaze.js';
import { commitPetPickup } from './dogmove.js';
import { monsterWieldedWeapon } from './weapon.js';
import { askTutorial } from './message_types.js';
import { applyHeroWereChange, presentWereChange } from './were.js';
import { reportMonsterTeleportRestriction } from './teleport.js';
import { clearHeroSliming } from './potion.js';
import { initTrack, setTrack } from './track.js';
import { autopickupAtHero } from './pickup.js';
import { clearJustPicked } from './pickup.js';
import { runLevelRegions } from './region.js';
import { invault, moveVaultGuard } from './vault.js';
import { automaticSearch, mapVicinity, revealWarnedMonsters } from './detect.js';
import { finishPrayerOccupation } from './pray.js';
import { monsterAlignmentType } from './priest.js';
import { movebubbles } from './mkmaze.js';
import { removeObjectAndContentsFromBill, currentShopResident, fixShopDamage } from './shk.js';
import { inventoryItemDescription, rerollMenu } from './invent.js';
import { hasCarriedProperty, hasIntrinsicProperty, hasInvokedProperty, hasPermanentIntrinsicProperty, hasWornProperty, propertyIsActive, propertyTimeout, propertyIsBlocked, refreshProperty } from './properties.js';
import { nhTimeout } from './timeout.js';
// Port only: raw map-display cell writer for the legacy screen (C draws the
// intro through window putstr calls).
function putLine(col, row, text, attr = 0) {
    const game = requireInitializedGame();
    const display = requireGameDisplay(game);
    for (let i = 0; i < text.length && col + i < display.cols; i++)
        display.setCell(col + i, row, text.charAt(i), NO_COLOR, attr);
}
// Part of C allmain.c:newgame(): the flags.legacy introduction screen C shows
// through the common pager, drawn directly on the map display.
// C ref: com_pager("legacy") and dat/quest.lua.  The role-independent
// creation story is laid out by the tty pager; role, rank, and god are live.
async function showLegacy() {
    const game = requireInitializedGame();
    // com_pager() creates a fresh Lua state, which loads nhlib.lua before
    // quest.lua and consumes the alignment shuffle from CORE.
    const questState = currentLuaLifecycle().createSpecialState(game);
    await questState.destroy();
    const d = requireGameDisplay(game);
    const alignment = game.initAlignment?.name;
    const god = (alignment ? game.urole.gods?.[alignment] : null) || 'your god';
    const rank = game.urole?.rank?.m || game.urole?.title?.[0]?.m || 'adventurer';
    const deityNoun = (alignment && game.urole.goddessAlignments?.includes(alignment))
        || god === 'The Lady'
        ? 'goddess' : 'god';
    const pauper = !!game.u?.uroleplay?.pauper;
    const closingLines = pauper ? [
        `You, an untrained ${rank}, have been unable to adequately`,
        `prepare to be the instrument of ${god}.  Nevertheless, you`,
        'are destined to recover the Amulet for your deity, or die',
        'in the attempt.  Your hour of destiny has come.  For the',
        `sake of us all:  Go bravely with ${god}!`,
    ] : [
        `You, a newly trained ${rank}, have been heralded`,
        `from birth as the instrument of ${god}.  You are destined`,
        'to recover the Amulet for your deity, or die in the',
        'attempt.  Your hour of destiny has come.  For the sake',
        `of us all:  Go bravely with ${god}!`,
    ];
    const outerLines = [
        `It is written in the Book of ${god}:`,
        `Your ${deityNoun} ${god} seeks to possess the Amulet, and with it`,
        'to gain deserved ascendance over the other gods.',
        ...closingLines,
        '--More--',
    ];
    const innerLines = [
        'After the Creation, the cruel god Moloch rebelled',
        'against the authority of Marduk the Creator.',
        'Moloch stole from Marduk the most powerful of all',
        'the artifacts of the gods, the Amulet of Yendor,',
        'and he hid it in the dark cavities of Gehennom, the',
        'Under World, where he now lurks, and bides his time.',
    ];
    const width = Math.max(...outerLines.map(line => line.length), ...innerLines.map(line => line.length + 4));
    const left = Math.max(0, 79 - width);
    const windowLeft = Math.max(0, left - 1);
    for (let row = 0; row <= 17; row++)
        putLine(windowLeft, row, ' '.repeat(80 - windowLeft));
    putLine(left, 0, outerLines[0]);
    innerLines.forEach((line, index) => putLine(left + 4, index + 2, line));
    putLine(left, 9, outerLines[1]);
    putLine(left, 10, outerLines[2]);
    putLine(left, 12, outerLines[3]);
    putLine(left, 13, outerLines[4]);
    putLine(left, 14, outerLines[5]);
    putLine(left, 15, outerLines[6]);
    putLine(left, 16, outerLines[7]);
    putLine(left, 17, outerLines[8]);
    d.setCursor(left + 8, 17);
    await nhgetch();
}
// C allmain.c:welcome(). Greeting, chronicle entry, and restore reminders
// share the hero's innate identity even while another body is active; the
// restore reminder is dungeon.c:print_level_annotation().
export async function welcome(newGame) {
    const g = requireInitializedGame();
    await currentLuaLifecycle().callCore(g, newGame ? 'start_new_game' : 'restore_old_game');
    if (!newGame && Upolyd(g.u) && heroHasBeenGenocided(g)) {
        await plineWithContinuation(`You're back, but you still feel ${feelingAfterSelfGenocide(g)} inside.`);
        return;
    }
    if (heroIsHallucinating(g))
        await plineWithContinuation('NetHack is filmed in front of an undead studio audience.');
    const female = !!(Upolyd(g.u) ? g.u.mfemale : g.flags.female);
    const currentAlignment = g.u.ualignbase[A_CURRENT];
    const adrift = g.u.ualign.type !== currentAlignment;
    const identity = [];
    if (newGame || currentAlignment !== g.u.ualignbase[A_ORIGINAL] || adrift) {
        const alignment = adrift ? g.u.ualign.type : currentAlignment;
        if (adrift)
            identity.push('adrift');
        identity.push(aligns.find(entry => entry.value === alignment)?.name ?? 'unaligned');
    }
    const genderedRole = g.urole.name.f !== g.urole.name.m;
    const describeGender = newGame ? g.urole.key !== 'valkyrie'
        : Number(female) !== (g.flags.initgend ?? 0);
    if (!genderedRole && describeGender)
        identity.push(female ? 'female' : 'male');
    identity.push(g.urace.adj, female ? g.urole.name.f : g.urole.name.m);
    const description = identity.join(' ');
    const name = g.plname;
    await plineWithContinuation(newGame
        ? `${g.urole.greeting} ${name}, welcome to NetHack!  You are a ${description}.`
        : `${g.urole.greeting} ${name}, the ${description}, welcome back to NetHack!`);
    if (newGame) {
        recordGameLogEvent(`${name} the ${description} entered the dungeon`, { state: g, flags: LL_ACHIEVE });
        return;
    }
    const temperature = g.level.flags.temperature ?? 0;
    if (temperature)
        await plineWithContinuation(`It is ${temperature > 0 ? 'hot' : 'cold'} here.`);
    if (In_hell(g.u.uz) && temperature > 0)
        await plineWithContinuation(`You ${heroHasOlfaction(g) ? 'smell' : 'sense'} smoke...`);
    await printLevelAnnotation(g);
}
// Port only: message adapter — print a line, then drain the pending topline
// before the redraw that follows.
async function showInlineMore(message) {
    await plineWithContinuation(message);
    await flushPendingTopline();
}
// Part of C allmain.c:moveloop_preamble(): the real-world calendar
// side-effects — moon phase and Friday-the-13th luck.
async function applyCalendarMessages() {
    const game = requireInitializedGame();
    const calendar = fixedCalendar(game.datetime);
    game.flags.moonphase = calendar.moonphase;
    game.flags.friday13 = calendar.friday13;
    // Native luck changes follow the message, including any input it needs.
    if (calendar.moonphase === 4) {
        await plineWithContinuation('You are lucky!  Full moon tonight.');
        changeHeroLuck(1);
    }
    else if (calendar.moonphase === 0) {
        await plineWithContinuation('Be careful!  New moon tonight.');
    }
    if (calendar.friday13) {
        await plineWithContinuation('Watch out!  Bad things can happen on Friday the 13th.');
        changeHeroLuck(-1);
    }
}
// Part of C restore.c:dorecover(): restore/startup adapter that also runs allmain.c:moveloop_preamble().
// C refs: restore.c dorecover(), allmain.c moveloop_preamble(resuming=TRUE).
// Restoring skips new-game RNG setup but reinitializes the Lua alignment
// shuffle, presents the saved map, and applies real-world calendar effects.
export async function restoregamePreamble() {
    const game = requireInitializedGame();
    // restgamestate() defers sensed monster overlays until moveloop starts.
    game._deferSeeMonsters = true;
    delete game._pendingHeroShapeChange;
    // C restgamestate() runs role_init() before anything else the preamble
    // does; restoreGame() has already spent its quest gender rolls and then
    // installed the saved quest_status over the rolled values.
    await l_nhcore_init();
    game._moveloopStarted = false;
    // pickup.c's oldcap is process-local (decl.c), not restored save state.
    game._encumbranceLevel = 0;
    // C getlev() closes dorecover() with a fixup pass over every monster on
    // the restored current level. Ownership links survive the saved graph,
    // but hiding cover must be rechecked before restoring each shape.
    // Births append in the port, whereas C's fmon chain keeps the newest
    // monster first. The pass runs where C runs it, before vision_reset()
    // (restore.c:926) and with program_state.restoring still set, so plain
    // sight sees nothing yet and the map stays unpainted behind any
    // sensed-change message; only sensing can spot a revert here. getlev()
    // holds in_getlev across the pass (restore.c:1064-1305), so a revert that
    // asks for a vision recalculation cannot rebuild sight mid-pass.
    game.program_state.restoring = true;
    game.program_state.in_getlev = true;
    game.vision_full_recalc = 0;
    try {
        for (const monster of [...(game.level?.monsters ?? [])].reverse()) {
            await restoreMonsterCover(monster, game);
            await restoreMonsterShape(monster, game);
            if (game.program_state.gameover)
                return;
        }
        game.program_state.in_getlev = false;
        await finishInUseInventory(false);
        // C dorecover() rebuilds vision, then expires timers while map and
        // status output are still suppressed by program_state.restoring.
        vision_reset_new_level();
        game.vision_full_recalc = 1;
        await runDueTimers();
        if (game.program_state.gameover)
            return;
    }
    finally {
        game.program_state.in_getlev = false;
        game.program_state.restoring = false;
    }
    // C clears program_state.restoring before docrt(), which pages any
    // pending line at cls()'s message flush.
    await docrt();
    // The first flush paints the display state restored with the level.
    await bot();
    // C dorecover() runs clear_nhwindow(WIN_MESSAGE) between docrt() and
    // welcome(), erasing any shape-fixup line above without spending a key.
    clearMessageWindow();
    await welcome(false);
    await checkSpecialRoom();
    if (game.flags?.explore)
        await plineWithContinuation('You are in non-scoring explore/discovery mode.');
    await askKeepRestoredSave();
    await applyCalendarMessages();
    await readEngravingAt(game.u.ux, game.u.uy, plineWithContinuation);
    await fixShopDamage(game);
    await finishMoveloopPreamble();
}
// C allmain.c:maybe_do_tutorial()
// ask_do_tutorial() (options.c) contributes the config gate and the Yes/No
// menu below; schedule_goto()+deferred_goto() run through do.c:goto_level()
// arrival, modeled here as a hand-rolled level transition combining Lua
// state transfer and that arrival.  Destination construction and arrival
// precede the entry pager, but that pager still projects the source graph.
// Tutorial inventory is deliberately sequestered until a later portal
// restores the saved game state.
async function maybeDoTutorial() {
    const game = requireInitializedGame();
    const target = game.specialLevels?.get('tut-1');
    if (!target)
        return;
    // ask_do_tutorial() obeys a tutorial option set in the configuration
    // file without asking; unlike C, this port then skips entry entirely.
    if (game.tutorial_set_in_config)
        return;
    // Menu creation flushes only a message still awaiting dismissal.
    // A wrapped welcome has already completed its own pager.
    await flushPendingTopline();
    await flush_screen(1);
    const doTutorial = await askTutorial();
    game._tutorialDeclined = !doTutorial;
    game._pending_message = '';
    if (!doTutorial) {
        await redrawMap();
        await flush_screen(1);
        return;
    }
    const oldLevel = game.level;
    const oldStairs = game.stairs;
    const oldDepth = { ...(game.u?.uz || {}) };
    const oldPosition = {
        x: game.u.ux, y: game.u.uy,
        x0: game.u.ux0, y0: game.u.uy0,
    };
    if (!game._levelCache)
        game._levelCache = new Map();
    game._levelCache.set(`${oldDepth.dnum ?? 0}:${oldDepth.dlevel ?? 1}`, {
        level: oldLevel, stairs: oldStairs, savedAt: game.moves,
        billObjects: game.billObjects ?? [],
    });
    game.u.ucamefrom = { ...oldDepth };
    await currentLuaLifecycle().changeTutorialMode(game, true);
    game.u.uz = { ...target };
    // C's tutorial entry runs through goto_level(), which records the
    // reached level for the destination dungeon (do.c:1678-1685) before
    // mklev(); the hand-rolled transition must match that bookkeeping or
    // the tutorial heading prints an empty level range.
    const targetDungeon = game.dungeons[target.dnum];
    if (targetDungeon) {
        const reached = targetDungeon.dunlev_ureached || 0;
        targetDungeon.dunlev_ureached = dungeonBuildsUp(target, game) && reached
            ? Math.min(reached, target.dlevel)
            : Math.max(reached, target.dlevel);
    }
    game._specialLevelPrototype = 'tut-1';
    // C's tutorial entry runs through goto_level(), so mklev() creates the
    // tutorial level's overview record; this hand-rolled transition must
    // match that mapseen creation.
    initOverviewRecord(game.u.uz, game);
    game.billObjects = [];
    await mklev();
    // C goto_level() neutralizes the transition's vision state right after
    // mklev(): the vision_reset() there is followed by
    // gv.vision_full_recalc = 0, "don't let that reenable vision yet"
    // (do.c:1718-1719), so no message flush during the arrival can run a
    // vision recalc before docrt() rebuilds sight on the destination.  The
    // hand-rolled transition needs the same hold: the entry pager below
    // reprojects the source level, and a pending recalc would repaint it
    // through the tutorial level's freshly reset blocker table, exposing
    // source cells the hero cannot see.
    game.vision_full_recalc = 0;
    // goto_level() arrives through u_on_rndspot(), even when Lua restricts
    // the region to a single square.
    await u_on_rndspot(game.level.downTeleportRegion);
    const tutorialLevel = game.level;
    const tutorialStairs = game.stairs;
    const tutorialPosition = {
        x: game.u.ux, y: game.u.uy,
        x0: game.u.ux0, y0: game.u.uy0,
    };
    game.level = oldLevel;
    game.stairs = oldStairs;
    game.u.uz = oldDepth;
    const oldHero = game.u;
    oldHero.ux = oldPosition.x;
    oldHero.uy = oldPosition.y;
    oldHero.ux0 = oldPosition.x0;
    oldHero.uy0 = oldPosition.y0;
    await showInlineMore('Entering the tutorial.');
    await checkSpecialRoom({ newLevel: true });
    game.level = tutorialLevel;
    game.stairs = tutorialStairs;
    game.u.uz = { ...target };
    game.u.uz0 = { ...target };
    const tutorialHero = game.u;
    tutorialHero.ux = tutorialPosition.x;
    tutorialHero.uy = tutorialPosition.y;
    tutorialHero.ux0 = tutorialPosition.x0;
    tutorialHero.uy0 = tutorialPosition.y0;
    game._tutorialActive = true;
    game._pending_message = '';
    vision_reset_new_level();
    await docrt();
    await checkSpecialRoom();
    await readEngravingAt(game.u.ux, game.u.uy, plineWithContinuation);
    // maybe_do_tutorial() redraws after deferred_goto(), acknowledging the
    // arrival engraving before the normal command loop starts.
    await vision_recalc(0);
    await docrt();
    findArmorClass(game);
    await redrawMap();
    await flush_screen(1);
}
// C allmain.c:moveloop_preamble()
async function moveloopPreamble() {
    const game = requireInitializedGame();
    if (game._moveloopStarted)
        return;
    await applyCalendarMessages();
    game.program_state.beyond_savefile_load = 1;
    game.rndencode = rnd(9000);
    await applyStartingArmorEffects();
    if (game.program_state.gameover)
        return;
    clearJustPicked(game);
    await autopickupAtHero();
    if (game.program_state.gameover)
        return;
    game.seer_turn = rnd(30);
    game.u.umovement = NORMAL_SPEED;
    initTrack();
    game._nextAttribCheck = 600;
    await finishMoveloopPreamble();
    // moveloop() runs maybe_do_tutorial() right after the preamble.
    await maybeDoTutorial();
}
// Part of C allmain.c:moveloop_preamble(): the shared new/restore tail.
// Equipment and pickup messages may suspend before this boundary makes
// command input live.
async function finishMoveloopPreamble() {
    const game = requireInitializedGame();
    // moveloop_preamble() sets botlx after assigning the gold encoding.
    game.context.botl = true;
    await encumber_msg();
    if (game._deferSeeMonsters) {
        game._deferSeeMonsters = false;
        await see_monsters();
    }
    game.u.uz0 ||= { ...game.u.uz };
    game.u.uz0.dlevel = game.u.uz.dlevel;
    game.context.move = 0;
    game._moveloopStarted = true;
}
// C allmain.c:interrupt_multi()
// Count-prefixed ordinary commands use
// positive `multi`; full HP or power recovery cancels that voluntary repeat,
// but must not stop independent occupations such as eating, lock-picking, or
// spellbook study.  This port represents both kinds in `_occupation`, so keep
// the distinction at the interruption boundary.
async function interruptCountedActivity(message) {
    const game = requireInitializedGame();
    if (!(game.multi > 0) || game.context.travel || game.context.run)
        return;
    endVoluntaryMultiTurn(game);
    if (game.flags?.verbose !== false && game._lastPlineMessage !== message) {
        await plineWithContinuation(message);
    }
}
// C allmain.c:regen_pw()
// Power recovery: once per level-dependent interval when unencumbered, or
// whenever the energy regeneration property is active; a magical breathing
// form draws a deeper reserve.  Reaching full power cancels a counted
// voluntary repeat (allmain.c:interrupt_multi()).
async function regen_pw(wtcap, sourceTurn, state) {
    if ((state.u?.uen ?? 0) >= (state.u?.uenmax ?? 0))
        return;
    const level = state.u?.ulevel ?? 1;
    const roleFactor = state.urole?.key === 'wizard' ? 3 : 4;
    const interval = Math.max(1, Math.trunc(((30 + 8 - level) * roleFactor) / 6));
    const energyRegeneration = propertyIsActive('energyRegeneration', state);
    if ((wtcap < MOD_ENCUMBER
        && sourceTurn % interval === 0)
        || energyRegeneration) {
        let upper = Math.trunc((currentAttribute(A_WIS, state) + currentAttribute(A_INT, state)) / 15) + 1;
        if (hasWornProperty('magicalBreathing', state)
            || hasCarriedProperty('magicalBreathing', null, state)
            || hasInvokedProperty('magicalBreathing', state))
            upper += 2;
        state.u.uen = Math.min(state.u.uenmax, state.u.uen + 1 + rn2(upper));
        state.context.botl = true;
        if (state.u.uen === state.u.uenmax)
            await interruptCountedActivity('You feel full of energy.');
    }
}
// C allmain.c:regen_hp(). Once-per-world-turn HP recovery.
// The caller owns interrupt_multi() when this recovery reaches full health.
export async function regenerateHeroHp(capacity, turn) {
    const state = requireInitializedGame();
    const hero = state.u;
    if (hero.invulnerable)
        return false;
    const encumbranceAllowsRecovery = capacity < MOD_ENCUMBER || !hero.umoved;
    const regeneration = propertyIsActive('regeneration', state);
    const sleepingRecovery = propertyIsActive('sleepy', state) && !!hero.usleep;
    const canRegenerate = regeneration || sleepingRecovery;
    if (Upolyd(hero)) {
        if (hero.mh < 1) {
            await returnHeroToHumanForm(state);
            return false;
        }
        let healing = 0;
        if (monsterIsEel(heroSpecies(state))
            && !isPoolAt(hero.ux, hero.uy, state) && !Is_waterlevel(hero.uz)
            && !heroIsBreathless(state)) {
            if (hero.mh > 1 && !regeneration && rn2(hero.mh) > rn2(8)
                && (!propertyIsActive('halfPhysicalDamage', state) || turn % 2 === 0))
                healing = -1;
        }
        else if (hero.mh < hero.mhmax
            && (canRegenerate || encumbranceAllowsRecovery && turn % 20 === 0)) {
            healing = 1;
        }
        if (!healing)
            return false;
        state.context.botl = true;
        hero.mh += healing;
        return hero.mh === hero.mhmax;
    }
    if (hero.uhp >= hero.uhpmax || !encumbranceAllowsRecovery && !canRegenerate)
        return false;
    let healing = Number(hero.ulevel + currentAttribute(A_CON, state) > rn2(100));
    if (canRegenerate)
        healing++;
    if (sleepingRecovery)
        healing++;
    if (!healing)
        return false;
    state.context.botl = true;
    hero.uhp = Math.min(hero.uhpmax, hero.uhp + healing);
    return hero.uhp === hero.uhpmax;
}
// Part of C allmain.c:moveloop_core(): the per-turn run_regions() step,
// wiring the wake/anger/death callbacks C routes through region.c's
// callback table.
async function runLevelRegionTurn() {
    const game = requireInitializedGame();
    return runLevelRegions(game, {
        wake: wakeMonstersNearWithMessages,
        onAnger: (monster) => angerMonster(monster, { attacked: true }),
        onMonsterDeath: async (monster, event) => {
            if (event.heroFault) {
                const killed = await finishHeroMonsterKill(monster, monster.mx, monster.my);
                return { monster, survived: !killed };
            }
            return finishMonsterKilled(monster, game, {
                cause: 'gas cloud', damageType: AD_DRST,
            });
        },
    });
}
// Part of C allmain.c:moveloop_core(): the new-turn loop that reallocates
// every monster's movement ration with mcalcmove() after mcalcdistress(),
// before any of them acts. C iterates fmon in creation order; JS stores
// monsters newest-first, so this traverses the reverse of creation order
// like the rest of the scheduler.
export function allocateMonsterMovement(monsters = [], random = rn2, state = requireInitializedGame()) {
    for (const monster of monstersInFmonOrder(monsters)) {
        const amount = mcalcmove(monster, true, random, state);
        monster.movement = (monster.movement ?? 0) + amount;
    }
}
// C allmain.c:maybe_generate_rnd_mon().  Monster pressure increases below
// the Castle and again after demigodhood; the denominator is topology
// state, not a fixed scheduler constant.
async function maybe_generate_rnd_mon(state) {
    const currentDepth = dungeonDepth(state.u?.uz?.dnum ?? 0, state.u?.uz?.dlevel ?? 1);
    const strongholdDepth = dungeonDepth(state.stronghold_level?.dnum ?? 0, state.stronghold_level?.dlevel ?? Number.MAX_SAFE_INTEGER);
    const generationRate = state.u?.uevent?.udemigod ? 25
        : currentDepth > strongholdDepth ? 50 : 70;
    if (rn2(generationRate) === 0)
        await makemonAt(null, 0, 0);
}
// C allmain.c:u_calc_moveamt()
// The hero's movement ration for the coming round: the current form's
// natural speed and Fast/Very_fast bonus (or the steed's own speed when
// mounted and moving), then the cached carrying capacity applied to the
// total.  OVERLOADED is deliberately the default case: a zero-speed mold
// receives no movement until intrinsic Fast grants a complete 12-point
// action.  Clamps a negative movement balance after every global
// allocation: without this, a slow polymorph can carry the action debit
// across zero-speed turns and require an extra monster/global round.
function u_calc_moveamt(wtcap, state) {
    let moveAmount;
    const polymorphed = (state.u.mtimedone !== undefined && state.u.mtimedone > 0)
        && Number.isInteger(state.u?.umonnum);
    if (state.u.usteed && state.u.umoved) {
        moveAmount = mcalcmove(state.u.usteed, true, rn2, state);
    }
    else {
        moveAmount = polymorphed
            ? (MONSTER_MOVE[state.u.umonnum] ?? 0) : 12;
        if (state.u.veryFast) {
            if (rn2(3) !== 0)
                moveAmount += 12;
        }
        else if (state.u.fast && rn2(3) === 0) {
            moveAmount += 12;
        }
    }
    if (wtcap === 1) {
        moveAmount -= Math.trunc(moveAmount / 4);
    }
    else if (wtcap === 2) {
        moveAmount -= Math.trunc(moveAmount / 2);
    }
    else if (wtcap === 3) {
        moveAmount -= Math.trunc(moveAmount * 3 / 4);
    }
    else if (wtcap === 4) {
        moveAmount -= Math.trunc(moveAmount * 7 / 8);
    }
    state.u.umovement = Math.max(0, (state.u.umovement ?? 0) + moveAmount);
}
// C allmain.c:stop_occupation().
// Also C eat.c:maybe_finished_meal(): inlined as the eat-food branch that
// finishes a completed meal before printing any stop message.
export async function stopHeroOccupation(state = game, publish = plineWithContinuation, { finishMeal = true } = {}) {
    const occupation = state._occupation;
    if (occupation) {
        if (finishMeal && occupation.key === 'eat-food'
            && (state.context.victual?.usedtime ?? 0) >= (state.context.victual?.reqtime ?? 0)) {
            state._occupation = null;
            await eatfood(occupation, state);
        }
        else {
            await publish(`You stop ${occupation.text}.`);
        }
        state._occupation = null;
        state.context.botl = true;
    }
    if (occupation || (state.multi ?? 0) >= 0)
        endVoluntaryMultiTurn(state);
    cmdq_clear(CQ_CANNED, state);
}
// Part of C allmain.c:newgame(): entry adapter around initializeNewGame() and startup monster notices.
// C ref: allmain.c newgame()
export async function newgame() {
    await withMonsterNoticesBlocked(game, () => initializeNewGame());
    // C allmain.c:844-848 enables notices only after welcome().
    if (game.flags.mention_map)
        await dolookaround();
    else
        await noticeAllMonsters(game);
    if (game.flags?.explore)
        await plineWithContinuation('You are in non-scoring explore/discovery mode.');
}
// Part of C allmain.c:newgame(): the fresh-game setup body, init_dungeons()
// through welcome(TRUE).
async function initializeNewGame() {
    delete game._pendingHeroShapeChange;
    const g = game;
    const handednessRoll = await initializeSourceStartup();
    if (g.urole?.key === 'priest' && Number.isInteger(g._priestPantheonIndex)) {
        const pantheon = nativeRoleAt(g._priestPantheonIndex ?? -1);
        if (pantheon?.gods) {
            g.urole = {
                ...g.urole,
                gods: { ...pantheon.gods },
                goddessAlignments: [
                    ...(pantheon.goddessAlignments || []),
                ],
            };
        }
    }
    // role_init() records the patron's gender after a Priest borrows gods.
    // Quest pronouns retain this original patron after alignment conversion.
    const patronAlignment = g.initAlignment?.name ?? 'neutral';
    ensureQuestStatus(g).godgend = g.urole?.goddessAlignments?.includes(patronAlignment) ? 1 : 0;
    uInitMisc(handednessRoll);
    // C ref: u_init.c:1009-1012 — the recorder build routes ubirthday
    // through getnow() so a fixed session datetime controls it; upstream
    // uses plain time().  Captured once per new game, before mklev.
    g.ubirthday = /^\d{14}$/.test(g.datetime || '')
        ? recorderLocalEpochSeconds(g.datetime)
        : Math.floor(Date.now() / 1000);
    // C allmain.c:newgame() loads the core Lua state after hero setup.
    await l_nhcore_init();
    // Real mklev generates the level with correct room positions
    // Structural phase consumes RNG for rooms/corridors/doors/stairs
    await mklev();
    if (g.program_state.gameover)
        return;
    // C mklev() begins with init_mapseen(): the starting level joins the
    // overview history (dungeon.c:1582) before the hero takes a turn.
    initOverviewRecord(g.u.uz ?? { dnum: 0, dlevel: 1 }, g);
    // C does this before makedog() so that the starting pet is placed next
    // to the hero rather than next to the level-generation origin.
    await u_on_upstairs();
    vision_reset_new_level();
    await checkSpecialRoom();
    const occupant = monsterAtPosition(requireGameLevel(g), g.u.ux, g.u.uy);
    if (occupant)
        await moveMonsterNextToHero(occupant, g, { flags: RLOC_NOMSG });
    await makedog();
    await uInitInventoryAttrs();
    // Initial display
    await docrt();
    await flush_screen(1);
    await bot();
    while (g.u?.uroleplay?.reroll && await rerollMenu()) {
        await uInitInventoryAttrs();
        await bot();
    }
    // C applies equipment, spells, discoveries, skills, spell-power minimum,
    // and AC only after the final candidate has been accepted.  It does not
    // redraw bot() here, so the legacy overlay still retains the pre-skill
    // status row underneath it.
    await finishStartingDiscoveries();
    if (g.flags?.legacy)
        await showLegacy();
    g.program_state.something_worth_saving
        = Number(g.program_state.something_worth_saving || 0) + 1;
    // A new game begins with one complete hero movement ration.  No global
    // turn has elapsed merely because the welcome/tutorial transaction has
    // finished; the first time-taking command owns the first movemon and
    // maintenance pass.  Compatibility paths historically hid this by
    // skipping the generic maintenance block altogether.
    if (g.flags.checkpoint ?? true)
        rewindEngravingsForSave(g.level);
    // welcome() can wrap and wait before moveloop_preamble(). unixmain's
    // discovery-mode notice follows it, also before calendar effects.
    await welcome(true);
}
let playStep = null;
// Port only: contest play-page hook binding the per-keystroke moveloop_core
// driver.
export function bindPlayStep(step) {
    playStep = step;
}
// C allmain.c:moveloop_core(): the whole turn driver in C statement order.
// The monster-movement/time-advance loop with its once-per-turn maintenance,
// the once-per-hero-action tail, and the once-per-player-input part (vision,
// botl, the occupation/multi/run handling and rhack()) all live in this one
// function, as in C. The pieces C itself names stay named here too:
// u_calc_moveamt(), maybe_generate_rnd_mon(), regen_pw(), regen_hp() and
// interrupt_multi() (as interruptCountedActivity()); see_nearby_monsters()
// in mon.ts. hack.ts
// continueRun() is the port's separate run/multi resumption step, and the
// immobile-hero delay tail ends through hack.c:unmul() (finishHeroHelplessness).
// The port keeps one entry split from this body: moveloop_core() below adds
// the play-page keystroke shim, and Engine.runGame() (jsmain.ts) drives this
// body directly, parking on its input gate between commands instead of
// reading display keys.
export async function runMoveloopCore() {
    const g = requireInitializedGame();
    g.program_state.in_moveloop = true;
    if (g.program_state?.gameover) {
        await nhgetch();
        return;
    }
    await moveloopPreamble();
    if (g.program_state.gameover)
        return;
    if (g.context.bypasses)
        clearBypasses(g);
    const movementRationActionPending = !!g._heroTimePending;
    if (g._heroTimePending) {
        // C checks burden before monsters move after every timed action.
        // Hunger can lower Strength without changing inventory.
        await encumber_msg(g);
        for (;;) {
            const somebodyCanMove = await moveMonsters();
            if (g.program_state?.gameover)
                return;
            if (!somebodyCanMove && g.u.umovement < NORMAL_SPEED) {
                // C allmain.c:222: both hero and monsters are out of steam
                // this round, so set up a new turn.
                oncePerTurn: {
                    // allmain.c caches mvl_wtcap = near_capacity() after
                    // monster movement. Timeouts can change the load, but
                    // movement and recovery for this turn keep the earlier
                    // capacity.
                    const capacity = nearCapacity(g);
                    // allmain.c runs mcalcdistress() before allocating the
                    // next movement ration. Regeneration, were-change checks,
                    // and temporary maladies count down once per global turn,
                    // independent of the monster's own speed.
                    g.were_changes = 0;
                    for await (const event of monsterDistressEvents(g.level?.monsters || [], g, rn2, g.moves, plineWithContinuation)) {
                        if (event.kind === 'stationary-liquid') {
                            if (g.vision_full_recalc) {
                                await vision_recalc(0);
                            }
                            await resolveMonsterLiquid(event.monster, g, {
                                announce: plineWithContinuation,
                                monsterMoving: false,
                                finishDeath: finishHeroLiquidMonsterDeath,
                            });
                            continue;
                        }
                        if (event.kind === 'shape-change') {
                            if (event.change.heroDied)
                                break oncePerTurn;
                            continue;
                        }
                        await presentWereChange(event.change, {
                            publish: plineWithContinuation,
                            wakeNearby: (x, y, distance) => wakeMonstersNearWithMessages(x, y, distance, g),
                        });
                    }
                    allocateMonsterMovement(g.level?.monsters || [], rn2, g);
                    await maybe_generate_rnd_mon(g);
                    u_calc_moveamt(capacity, g);
                    // C records the hero's current square after monster
                    // movement/allocation and before the new global turn's
                    // callbacks.  Pets which lose sight of the hero consult
                    // this ring on their next action.
                    setTrack(g);
                    g.moves = (g.moves || 1) + 1;
                    if (g.moves >= 1000000000) {
                        await flushPendingTopline();
                        await plineWithContinuation('The dungeon capitulates.', { urgent: true });
                        await finishHeroDeath({ killer: '', deathType: ESCAPED });
                        break oncePerTurn;
                    }
                    if (g.flags.time && !g.context.run)
                        g.context.time_botl = true;
                    g._heroActionSeq = g.moves * 8;
                    await currentLuaLifecycle().callCore(g, 'moveloop_turn');
                    if (heroHasSlipperyHands(g))
                        await slipFromSlipperyHands(g);
                    // nh_timeout() precedes regeneration and exerchk() in the C loop.
                    // C allmain.c:273 calls it between glibr() and run_regions(); the
                    // countdown and its expiry messages live in timeout.ts.
                    await nhTimeout();
                    if (g.program_state?.gameover)
                        break oncePerTurn;
                    const sourceTurn = g.moves;
                    await runLevelRegionTurn();
                    if (g.program_state?.gameover)
                        break oncePerTurn;
                    if (g.u.ublesscnt > 0)
                        g.u.ublesscnt--;
                    // allmain.c:regen_hp() runs after nh_timeout().  If a timeout
                    // pline suspended at tty, no regeneration or later maintenance
                    // may run until that exact source stack resumes.
                    const recoveryCapacity = g.u.invulnerable ? UNENCUMBERED : capacity;
                    if (await regenerateHeroHp(recoveryCapacity, sourceTurn))
                        await interruptCountedActivity('You are in full health.');
                    if (g.program_state.gameover)
                        break oncePerTurn;
                    // C moveloop_core(): moving around while Strained or worse is hard work.
                    if (recoveryCapacity > MOD_ENCUMBER && g.u.umoved
                        && sourceTurn % (recoveryCapacity < EXT_ENCUMBER ? 30 : 10) === 0)
                        await overexertHeroHp(g);
                    await regen_pw(recoveryCapacity, sourceTurn, g);
                    // C allmain.c:moveloop_core(): Teleportation, including a
                    // teleporting form, moves the hero once in 85 turns. A move
                    // away from a leashed follower checks the leash and cancels
                    // queued and repeated commands.
                    if (!g.u.invulnerable && heroCanTeleport(g) && !rn2(85)) {
                        const from = { x: g.u.ux, y: g.u.uy };
                        await teleportHero({ chooseDestination: askTeleportDestination });
                        if (!(g.program_state.gameover
                            || (g.u.ux === from.x && g.u.uy === from.y))) {
                            if (!heroNextToLeashedFollowers())
                                await checkHeroLeashes(from.x, from.y);
                            cmdq_clear(CQ_CANNED);
                            cmdq_clear(CQ_REPEAT);
                        }
                    }
                    if (g.program_state.gameover)
                        break oncePerTurn;
                    // C allmain.c:moveloop_core(). A selected change waits
                    // through involuntary delays and Unchanging; losing the
                    // source of the change cancels it.
                    if (!g.u.invulnerable) {
                        const polymorph = propertyIsActive('polymorph', g);
                        const infection = g.u.ulycn;
                        const infected = infection !== undefined && infection >= 0
                            && infection < MONSTER_NAME.length;
                        if ((g._pendingHeroShapeChange === 'polymorph' && !polymorph)
                            || (g._pendingHeroShapeChange === 'were' && !infected))
                            delete g._pendingHeroShapeChange;
                        if (polymorph && rn2(100) === 0)
                            g._pendingHeroShapeChange = 'polymorph';
                        else if (infected && !Upolyd(g.u)
                            && rn2(80 - (sessionIsNight(g.datetime) ? 20 : 0)) === 0)
                            g._pendingHeroShapeChange = 'were';
                        if (g._pendingHeroShapeChange && !heroIsUnchanging(g)
                            && !heroHasInvoluntaryDelay(g)) {
                            await stopHeroOccupation(g);
                            if (g._pendingHeroShapeChange === 'polymorph')
                                await polymorphHero();
                            else
                                await applyHeroWereChange();
                            delete g._pendingHeroShapeChange;
                        }
                    }
                    if (g.program_state.gameover)
                        break oncePerTurn;
                    if (g.u?.searching && !g.level?.flags?.noautosearch
                        && !heroHasInvoluntaryDelay(g)) {
                        const search = await automaticSearch();
                        if (typeof search === 'object' && search.statueTrap) {
                            const { x, y } = search.statueTrap;
                            const monster = await activateStatueTrapAt(x, y);
                            if (monster)
                                await exerciseAttribute(A_WIS, true);
                        }
                    }
                    if (g.u.warning)
                        await revealWarnedMonsters();
                    if (g.were_changes)
                        setHeroSpecies(heroSpecies(g), g);
                    await warnWithMasterKey(g);
                    // Each sound keeps its native message wait before later feature rolls.
                    await dosounds();
                    await doStorms(g);
                    if (g.program_state.gameover)
                        break oncePerTurn;
                    await gethungry({ invulnerable: g.u.invulnerable });
                    if (g.program_state.gameover)
                        break oncePerTurn;
                    // JS has already advanced `game.moves` for the hero action which caused
                    // this maintenance pass.  C increments svm.moves inside this pass, so
                    // the resulting C turn number is the existing JS value, not value + 1.
                    await periodicTurnExercise(sourceTurn);
                    await checkAttributeExercise(sourceTurn);
                    // C allmain.c:357 — invault() runs here in the once-per-turn block,
                    // after exerchk() and before the Amulet check.  Its interrogation
                    // completes before the turn decrements negative multi, so a busy
                    // hero's armor removal can finish below, paging the guard's
                    // departure before the recovery message.
                    await invault(g);
                    if (g.u.uhave.amulet)
                        await amuletTurn(g);
                    if (!rn2(40 + currentAttribute(A_DEX) * 3))
                        wipeHeroEngraving(rnd(3));
                    // allmain.c's demigod intervention clock advances after engraving wear
                    // and before environmental level motion. Complete any paged intervention
                    // before restarting the countdown, as the synchronous C call does.
                    if (g.u?.uevent?.udemigod && !g.u?.invulnerable) {
                        if (g.u.udg_cnt !== undefined && g.u.udg_cnt > 0)
                            g.u.udg_cnt--;
                        if ((g.u.udg_cnt ?? 0) === 0) {
                            await intervene();
                            g.u.udg_cnt = 50 + rn2(200);
                        }
                    }
                    // allmain.c's environmental owner runs after engraving wear.  Air and
                    // Water share the moving bubble list created by fixup_special(); Fire
                    // reuses the same fumarole sampler as initial arrival.
                    if (Is_airlevel(g.u?.uz) || Is_waterlevel(g.u?.uz))
                        await movebubbles();
                    else if (g.level?.flags?.fumaroles)
                        await fumaroles(g);
                    // C allmain.c:379-388, still inside the once-per-turn block: an
                    // immobile hero's delay output runs before the counter moves, so the
                    // animation frames still see the helpless condition in the status
                    // line.  Reaching zero calls unmul() and, when that scheduled
                    // travel, deferred_goto().
                    if (currentMulti(g) < 0) {
                        // Dressing retains its physical topline through each negative-multi
                        // frame; its armor effects still wait for unmul's recovery message.
                        const delayedAction = pendingArmorAction(g);
                        if (delayedAction) {
                            if (g._pending_message) {
                                delete delayedAction._runmodeRetainedTopline;
                            }
                            else if (!delayedAction._runmodeRetainedTopline) {
                                delayedAction._runmodeRetainedTopline
                                    = g.nhDisplay?.grid?.[0]?.map(cell => ({ ...cell }));
                            }
                        }
                        await captureRunmodeDelay(g, true, sourceTurn, {
                            preservePhysicalTopline: true,
                            retainedTopline: delayedAction?._runmodeRetainedTopline ?? null,
                        });
                        setMulti(currentMulti(g) + 1, g);
                        if (currentMulti(g) === 0) {
                            await finishHeroHelplessness();
                            // if unmul() caused a level change, take it now
                            await finishScheduledLevelChange();
                        }
                    }
                }
                if (g.program_state?.gameover)
                    return;
                // Native encumber_msg() starts each further world round.
                // Timers can remove weight while the hero is still too slow
                // to act; acknowledge that relief before monsters act again.
                if (g.u.umovement < NORMAL_SPEED)
                    await encumber_msg(g);
            }
            // C allmain.c's do/while exits as soon as the hero can act;
            // no monster attack may spend the hero's movement ration.
            if (g.u.umovement >= NORMAL_SPEED)
                break;
        }
        g._heroTimePending = false;
        g._heroActionSeq = (g._heroActionSeq ?? 0) + 1;
        // C moveloop_core() checks again after nh_timeout() can remove weight.
        await encumber_msg(g);
        if (!g.program_state?.gameover) {
            // C allmain.c's `once-per-hero-took-time` tail, after the
            // movement-ration loop has allocated as many global turns as the
            // hero needs.  Burden can make one action span two allocations;
            // seer_turn is checked only after the last one, against the
            // final `moves` value.
            const tookTimeTurn = g.moves || 1;
            statusEvalNextUnhilite();
            if (tookTimeTurn >= (g.seer_turn ?? Infinity)) {
                if ((g.u.uhave.amulet || propertyIsActive('clairvoyant', g))
                    && !In_endgame(g.u.uz) && !propertyIsBlocked('clairvoyant', g))
                    await mapVicinity(null, { state: g });
                // we maintain this counter even when clairvoyance isn't
                // taking place; on average, go again 30 turns from now
                g.seer_turn = tookTimeTurn + 15 + rn2(31);
            }
        }
    }
    if (movementRationActionPending && !g.program_state?.gameover) {
        // C allmain.c:422-436: a hero stuck in lava keeps sinking, an
        // unmoved hero runs pooleffects(), and buried/underwater vision
        // updates before see_nearby_monsters().
        const finishLanding = ({ from, to }) => finishDestinationSpotEffects({
            oldx: from.x, oldy: from.y, newx: to.x, newy: to.y,
        });
        if (g.u?.utrap && g.u.utraptype === TT_LAVA) {
            await sinkHeroIntoLava({
                state: g,
                publish: plineWithContinuation,
                applyLandingEffects: finishLanding,
            });
        }
        else if (!g.u?.umoved) {
            await applyHeroLiquidEffects(plineWithContinuation, { entry: 'turn' });
        }
        if (g.program_state?.gameover)
            return;
        if (g.u.uinwater || g.underwater)
            await under_water(0);
        else if (g.u.uburied)
            await under_ground(0);
        await seeNearbyMonsters(g);
    }
    clearSplitObjects(g);
    // allmain.c's once-per-player-input Amulet check follows all elapsed
    // monster/global work and precedes find_ac()/vision/input.  A level
    // teleport can finish several arrival pagers before returning here; the
    // wish then begins without consuming a new hero action.
    await grantAmuletWish();
    // C allmain.c:find_ac() is a once-per-player-input operation after all
    // monster/global time caused by the command.  The vault-guard
    // arrival (C invault(), inside the once-per-turn block) still precedes
    // it, so its arrival message pages while a just-removed armor piece is
    // still counted.  Armor is already present in the worn slot.  A spare
    // movement ration reaches this boundary even before a world turn elapses,
    // so the next dressing action uses the new AC.
    if (g._armorClassDirty && !g._heroTimePending) {
        findArmorClass(g);
        g._armorClassDirty = false;
    }
    // Vision + display
    // C allmain.c refreshes the stationary input overlays before committing
    // a delayed vision transaction.  Hero movement can both move actors
    // across warning boundaries and leave vision_full_recalc set, so this
    // source order is display-RNG-visible under Hallucination.
    const hallucinatingNow = heroIsHallucinating(g);
    if (!g.context.mv || heroIsBlind(g)) {
        // The see_* calls remain in place while swallowed (newsym suppresses
        // them), then swallowed(0) refreshes the eight-cell stomach projection
        // from the same display RNG stream.
        if (hallucinatingNow) {
            await see_monsters();
            await see_objects();
            await see_traps();
            if (g.u?.uswallow)
                await swallowed(false);
        }
        else if (g.u?.warning || g.u.warnOfMonster
            || (g.u?.unblind_telepat_range ?? -1) >= 0
            || g.level?.regions?.some(region => region.visible
                && region.ttl !== -2)) {
            await see_monsters();
        }
        if (g.vision_full_recalc) {
            await vision_recalc(0);
            g.vision_full_recalc = 0;
        }
    }
    // C runs bot() or timebot() here and then curs_on_u(), whose
    // flush_screen() draws the buffered map, only when the status changed.
    // parse() flushes before physical command input. Queued commands bypass
    // parse, so their message pagers retain the map until an explicit flush.
    if (g.context.botl || g.context.time_botl)
        await curs_on_u();
    else
        updateStatusLines();
    await heroEveryturnEffect(g);
    // A negative C `multi` suppresses rhack() but still leaves context.move
    // set, so the next moveloop invocation spends another hero action.  Once
    // the once-per-turn owner above reaches zero, execution falls through and
    // the recovery message is visible at the next real input boundary.
    if ((g._helplessTurns || 0) > 0) {
        g.u.umoved = false;
        g.context.move = 1;
        g.u.umovement = (g.u.umovement ?? 12) - 12;
        g._heroTimePending = true;
        await currentLuaLifecycle().runCallbacks(g, 'end_turn');
        return;
    }
    // Count-prefixed occupations resume after the elapsed turn has settled
    // and before tty asks for another key.  Search is the first live owner:
    // `9s` is one explicit search plus eight scheduler-separated repeats.
    if ((g.multi ?? 0) >= 0 && g._occupation) {
        g.u.umoved = false;
        const acted = await continueCountedCommand(g);
        if (g.program_state.gameover)
            return;
        if (acted && g.context?.move) {
            g.u.umovement = (g.u.umovement ?? 12) - 12;
            g._heroTimePending = true;
        }
        await captureRunmodeDelay(g, !!g.context.run || g.multi > 0);
        return;
    }
    // C resumes a Shift-direction run here, after the elapsed action's
    // monster/global maintenance and before asking for another key.  A
    // successful automatic square is another timed hero action; an obstacle
    // cancels the run and the following core invocation returns to input.
    if (g.multi > 0 && g._runState) {
        g.u.umoved = false;
        const continuation = await continueRun(g);
        if (g.program_state.gameover)
            return;
        // C returns here when lookaround() clears multi, before vision and
        // end-turn callbacks. Pending sight waits for the next see_* phase.
        if (!continuation.attemptedMove)
            return;
        await finishScheduledLevelChange();
        if (g.program_state.gameover)
            return;
        if (g.vision_full_recalc)
            await vision_recalc(0);
        // C allmain.c:moveloop_core() end-of-command display cadence: while
        // a multi-step action is pending with no run or with teleport
        // runmode, every 7th step marks the status line dirty (travel
        // strides on moves, plain runs and count repeats on the remaining
        // multi) so the next flush repaints the turn counter mid-run.
        // Non-tport runs refresh through runmode_delay_output() instead, and
        // display_nhwindow(WIN_MAP, FALSE) is a tty fflush with no screen
        // effect.  C has one such site after rhack(); the port's separate
        // run resumption repeats it here.
        if ((!g.context.run || isTeleportRunmode(g)) && g.multi
            && (g.context.travel ? (g.moves || 0) % 7 === 0 : g.multi % 7 === 0)
            && g.flags.time && g.context.run) {
            g.context.botl = true;
        }
        if (continuation.tookTime) {
            g.u.umovement = (g.u.umovement ?? 12) - 12;
            g._heroTimePending = true;
        }
        if (continuation.tookTime)
            await currentLuaLifecycle().runCallbacks(g, 'end_turn');
        return;
    }
    // Read and execute one command
    g.u.umoved = false;
    if (g.multi > 0) {
        --g.multi;
        await rhack(g._commandKey ?? 0);
    }
    else {
        await rhack(0);
    }
    if (g.program_state.gameover)
        return;
    await finishScheduledLevelChange();
    if (g._questExpulsionPending)
        await performQuestExpulsion(g);
    if (g.program_state.gameover)
        return;
    // C refreshes command-induced sight changes before monsters act again.
    // Falling into a pit narrows sight after domove()'s earlier refresh.
    if (g.vision_full_recalc)
        await vision_recalc(0);
    // The same end-of-command display cadence as the run resumption above;
    // this is the site C allmain.c:549-556 itself has, after rhack().
    if ((!g.context.run || isTeleportRunmode(g)) && g.multi
        && (g.context.travel ? (g.moves || 0) % 7 === 0 : g.multi % 7 === 0)
        && g.flags.time && g.context.run) {
        g.context.botl = true;
    }
    // Advance turn
    if (g.context?.move) {
        g.u.umovement = (g.u.umovement ?? 12) - 12;
        g._heroTimePending = true;
    }
    await currentLuaLifecycle().runCallbacks(g, 'end_turn');
}
// Part of C allmain.c:moveloop_core(): the contest play page calls this once
// per keystroke. While a NethackGame drives the live game, the call hands
// its engine one display key and waits for the next input boundary;
// otherwise it runs the C-shaped body in runMoveloopCore() directly.
export async function moveloop_core() {
    if (playStep && playStep.state === game)
        return playStep.step();
    return runMoveloopCore();
}
// C allmain.c:moveloop()
export async function moveloop(resuming) {
    const game = requireInitializedGame();
    await docrt();
    await flush_screen(1);
    for (;;) {
        await moveloop_core();
        if (game.program_state?.gameover)
            break;
    }
}
// C allmain.c:newgame(): start a fresh species history before object and
// monster creation. Restore keeps its saved history and never calls this.
export function initializeMonsterVitals(state = game) {
    state.mvitals = MONSTER_GENO.map(generation => ({
        mvflags: generation & G_NOCORPSE, born: 0, died: 0,
    }));
}
//# sourceMappingURL=allmain.js.map