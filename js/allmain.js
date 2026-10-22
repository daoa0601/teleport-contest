import { formatFeltMessage, publishHeardMessage } from './hero_speech.js';
import { recorderLocalDate, recorderLocalEpochSeconds } from './calendar.js';
import { slipOrTrip } from './fumbling.js';
import { heroLegName } from './body_parts.js';
import { recoverTimedLuck } from './timeout_luck.js';
import { doStorms } from './storms.js';
import { advanceBodyTimeouts, advanceGallopingTimeout } from './timeout_body.js';
import { breathingDialogue, wallPassageDialogue, finishBreathingTimeout, finishWallPassageTimeout, } from './timeout_warnings.js';
import { invWeight } from './weight.js';
import { rewindEngravingsForSave } from './engrave.js';
import { finishMonsterHideUnder } from './monster_hiding.js';
// allmain.js — Main game loop.
// C ref: allmain.c — newgame, moveloop, moveloop_core.
import { heroIsHallucinating } from './senses.js';
import { mcalcmove } from './monster_speed.js';
import { learnWand } from './wand_charge.js';
import { flashBurn, makeBlinded } from './sight_change.js';
import { makeConfused, makeHallucinated, makeStunned } from './hero_mental_status.js';
import { heroHasHalfSpellDamage } from './spell_damage.js';
import { advanceSpellProtection } from './spell_misc_effects.js';
import { advanceDisplacementTimeout } from './hero_displacement.js';
import { finishMealMimicry } from './meal_mimic.js';
import { finishHeroDigestion } from './hero_combat_engulf.js';
import { advanceCorpseResistanceTimeouts } from './corpse_intrinsics.js';
import { game, requireGameLevel, requireInitializedGame, requireGameDisplay, requireLiveGame } from './gstate.js';
import { isRoom } from './map_types.js';
import { clearBypasses } from './object_bypass.js';
import { In_endgame, Is_astralevel, MON_FLOOR, PICK_ONE, PLNMSG_MON_TAKES_OFF_ITEM } from './const.js';
import { mapVicinity } from './magic_mapping.js';
import { showInventoryWindow } from './windows.js';
import { endVoluntaryMultiTurn, heroHasInvoluntaryDelay, nomul, currentMulti, pendingArmorAction, setMulti } from './command_state.js';
import { dosounds } from './ambient_sounds.js';
import { warnWithMasterKey } from './artifact_warning.js';
import { regenerateHeroHp } from './hero_regeneration.js';
import { overexertHeroHp } from './hero_overexertion.js';
import { ceilingName } from './terrain_name.js';
import { tryCallObjectType } from './object_call.js';
import { monsterGainLevelRiseDestination } from './monmove.js';
import { RLOC_NOMSG, WATER } from './const.js';
import { consumeMonsterItem, presentMonsterQuaff as publishMonsterQuaff, presentMonsterWandUse, revealAggravatingMonster } from './monster_item_use.js';
import { heroCanTeleport, moveMonsterNextToHero, randomMonsterRelocation, teleportHero } from './teleport.js';
import { monsterAtPosition } from './monster_location.js';
import { purgeDeadMonsters } from './monster_level_departure.js';
import { placeHeroAtRandomArrival } from './level_change.js';
import { monsterName, monsterSpellDeathReason, monsterSubjectPronoun, possessiveName } from './monster_name.js';
import { touchHeroWithDeath } from './monster_death_touch.js';
import { resolveMonsterWeaponContact } from './monster_weapon_contact.js';
import { applyArtifactHit } from './artifact_hit.js';
import { finishHeroDeathAfterMonsterMessage, finishMonsterAttackDeath, waitForCurrentMonsterMore } from './monster_attack_death.js';
import { monsterMissMessage } from './monster_miss.js';
import { monsterIsAnimal } from './monster_data.js';
import { monsterCanCarryObject } from './monster_carry.js';
import { releaseObjectLeash } from './monster_leash.js';
import { petrifyMonsterImmediately } from './monster_stoning.js';
import { touchPetrifies } from './stoning.js';
import { armorSimpleName, heroHasFreeAction, heroIsDisplaced, stopDonning } from './armor.js';
import { isBeingTakenOff } from './takeoff_state.js';
import { OBJECT_DELAY } from './object_data.js';
import { heroIsUnaware } from './hero_sleep.js';
import { heroSpecies } from './hero_species.js';
import { heroHasConflict } from './hero_conflict.js';
import { openHoldingTrap } from './trap_magic.js';
import { AD_COLD, AD_DGST, AD_DRST, AD_FIRE, AD_MAGM, AD_SEDU, AD_SITM, AD_SSEX, AD_STCK } from './monster_attack_types.js';
import { monstersForgetHeroResistance, monstersObserveHeroResistance, seenResistanceForDamage, } from './monster_perception.js';
import { engravingAt, wipeEngravingAt } from './engrave.js';
import { finishScheduledLevelChange } from './level_change.js';
import { findArtifact } from './artifacts.js';
import { observeBucForNaming } from './object_knowledge.js';
import { loseHeroExperience } from './exper.js';
import { makeMonsterFlee } from './monster_flee.js';
import { stopHeroOccupation } from './occupation.js';
import { interruptOccupationForMonster, monsterSightingBeforeAction } from './monster_threat.js';
import { fixShopDamage } from './shop_damage.js';
import { removeWornHeroItem } from './hero_equipment.js';
import { isWeldedPrimary } from './weapon_slots.js';
import { unlinkObject } from './object_location.js';
import { finishInventoryRemoval } from './hero_inventory.js';
import { RLOC_MSG, LOST_STOLEN } from './const.js';
import { advanceFlyingTimeout, advanceLevitationTimeout, levitationDialogue, } from './levitation_timeout.js';
import { MMOVE_DIED, NORMAL_SPEED } from './const.js';
import { runObjectTimer } from './timer_effects.js';
import { tryKnockback } from './knockback.js';
import { finishMonsterGrowth } from './monster_growth.js';
import { reassessMonsterArmor } from './monworn.js';
import { currentLuaLifecycle } from './lua/lifecycle.js';
import { readEngravingAt, wipeHeroEngraving } from './engrave.js';
import { d, rn2, rnd } from './rng.js';
import { mklev, l_nhcore_init, makemonAt, summonNastyMonsters, u_on_upstairs, } from './mklev.js';
import { summonMonsterInsects } from './monster_spell_insects.js';
import { applyHeroLiquidEffects, askTeleportDestination, continueCountedCommand, continueRun, finishArmorRemoval, getLine, promptYesNo, rhack, } from './cmd.js';
import { clearRepeatCommand } from './command_repeat.js';
import { checkHeroLeashes } from './leash_apply.js';
import { finishDestinationSpotEffects } from './location_effects.js';
import { performQuestExpulsion } from './quest.js';
import { amuletTurn, monsterCarriesAmulet, resurrectWizard } from './wizard.js';
import { finishHeroLiquidMonsterDeath, finishHeroMonsterKill, } from './hero_monster_death.js';
import { aggravateMonsters, angerMonster } from './monster_anger.js';
import { grantAmuletWish } from './wish.js';
import { checkAttributeExercise, currentAttribute, exerciseAttribute, exerciseWisdom, loseHeroStrength } from './attrib.js';
import { reportHeroEncumbrance } from './encumbrance.js';
import { rndcurse } from './throne.js';
import { stopRun } from './runmode.js';
import { resolveMonsterGaze } from './monster_gaze.js';
import { resolveMonsterMagicRay } from './monster_magic_ray.js';
import { resolveMonsterSelfExplosion } from './monster_self_explosion.js';
import { canSpotMonster, displayColorName, displayMessageWindow, docrt, redrawMap, bot, flush_screen, flushPendingTopline, updateStatusLines, pline, plineWithContinuation, newsym, map_invisible, randomDisplayMonsterName, see_monsters, see_objects, see_traps, show_glyph_cell, swallowed, canSeeMonster, monsterVisible, shieldeff, } from './display.js';
import { cansee, couldsee, vision_note_blocker_change, vision_recalc, vision_reset_new_level, hasLightSources, } from './vision.js';
import { nhgetch } from './input.js';
import { NO_COLOR, CLR_BRIGHT_BLUE } from './terminal.js';
import { ACID_VENOM, BOULDER, CORPSE, LEASH, GOLD_PIECE, OBJECT_BIMANUAL, OBJECT_NAMES, } from './object_data.js';
import { makePlural, verbForSubject, withIndefiniteArticle } from './object_grammar.js';
import { monsterLocomotion } from './monster_locomotion.js';
import { monsterFliesOrFloats } from './terrain_properties.js';
import { observeDistantObjectForNaming, observeObjectForNaming, ownedObjectName, } from './objnam.js';
import { A_CHA, A_CON, A_DEX, A_INT, A_STR, A_WIS, COLNO, ROWNO, DOOR, D_CLOSED, D_LOCKED, HOLE, M_SEEN_ELEC, M_SEEN_FIRE, M_SEEN_MAGR, M_SEEN_REFL, STONE, ZAP_POS, M_ATTK_AGR_DIED, M_ATTK_AGR_DONE, W_ARMG, UNENCUMBERED, MOD_ENCUMBER, HVY_ENCUMBER, EXT_ENCUMBER, W_ACCESSORY, W_WEAPONS, ismnum, Upolyd, Is_airlevel, Is_waterlevel, LUCKMIN, LUCKMAX, TT_BURIEDBALL, TT_LAVA, KILLED_BY_AN, } from './const.js';
import { uInitMisc, makedog, uInitInventoryAttrs, finishStartingDiscoveries, } from './u_init.js';
import { makeDeaf } from './hero_hearing.js';
import { heroIsBlind, heroIsDeaf, syncBlindness } from './senses.js';
import { heroIsInvisible, syncHeroInvisibility } from './hero_invisibility.js';
import { refreshHeroSeeing } from './hero_seeing.js';
import { igniteItems } from './light.js';
import { applyRayFloorFeatures, destroyColdInventory, destroyElectricInventory, destroyFireInventory, } from './zap.js';
import { discoverHeroReflectionSource, heroReflectionSource } from './ray.js';
import { addObjectToMonsterInventory, } from './monster_inventory.js';
import { claimNextDueObjectTimer, peekNextDueObjectTimer, } from './object_timers.js';
import { nativeRoleAt } from './roles.js';
import { initializeRoleQuestGenders, initializeSourceStartup } from './startup.js';
import { initialDungeonEntryText, recordGameLogEvent, } from './gamelog.js';
import { allocateMonsterMovement, applyHeroSpellDamage, beginDeferredHeroCloneWizard, completeHeroAttackSlot, selectHeroItemForTheft, resumeDeferredHeroColdSpecial, resumeDeferredHeroContact, resumeDeferredHeroFireSpecial, resumeDeferredHeroElectricSpecial, resumeDeferredHeroLifeDrain, resumeDeferredHeroStun, resumeDeferredHeroEnchantment, resumeDeferredHeroSticking, resumeDeferredHeroEngulf, resumeDeferredHeroBlindness, resumeDeferredHeroLegs, resumeDeferredHeroReveal, rollDeferredHeroSpellDamage, resumeDeferredHeroSpell, resolveDeferredHeroSummonMonsters, resolveDeferredHeroHasteSelf, resolveDeferredHeroAggravation, finishDeferredMonsterMiscItem, finishDeferredHeroCloneWizard, resumeDeferredCovetousRelocation, resumeDeferredRestrictedTenguTeleport, resumeDeferredMovementSpell, resumeDeferredSpecialAttack, resumeDeferredMonsterTrap, resumeDeferredMonsterHideUnder, completeMonsterOffensiveAction, resumeDeferredPetAttack, resumeDeferredPetEating, resumeDeferredPetMove, resumeDeferredPetReluctance, resolveDeferredMonsterBreath, fumaroles, heroEveryturnEffect, runMonsterEveryturnEffects, beginMonsterMove, beginMonsterHeroAttack, beginMonsterDochug, runMonsterAction, monstersInFmonOrder, monsterDistressEvents, commitPetPickup, } from './monmove.js';
import { finishEnvironmentalMonsterDeath, finishMonsterKilled, finishMonsterLiquidDeath, } from './monster_death.js';
import { erodeArmor, erodeAttackingWeapon } from './object_erosion.js';
import { monsterWieldedWeapon } from './monster_weapon.js';
import { resolveMonsterLiquid } from './mon.js';
import { wakeMonstersNearWithMessages } from './monster_wake.js';
import { applyHeroWereChange, presentWereChange } from './were.js';
import { sessionIsNight } from './monster_sound.js';
import { burnHeroArmorByFire } from './trap.js';
import { sinkHeroIntoLava } from './hack.js';
import { reportMonsterTeleportRestriction } from './teleport_rules.js';
import { heroIsUnchanging, polymonHero, polymorphHero, returnHeroToHumanForm } from './polyself.js';
import { healHeroLegs } from './hero_legs.js';
import { advanceHeroSickness, advanceHeroVomiting, heroIsSick, heroIsVomiting, sicknessDialogue, vomitingDialogue, } from './hero_illness.js';
import { advanceHeroSliming, clearHeroSliming, finishDeferredHeroSlime, heroIsSliming, resumeDeferredHeroSlime, slimeDialogue, } from './slime.js';
import { advanceHeroPetrification, heroIsPetrifying, petrificationDialogue, } from './stoning.js';
import { advanceHeroStrangulation, strangulationDialogue } from './hero_strangulation.js';
import { initTrack, setTrack } from './track.js';
import { autopickupAtHero } from './pickup.js';
import { clearJustPicked } from './just_picked.js';
import { applyArmorOnEffects, applyStartingArmorEffects, armorOnIdentifiesType, findArmorClass, erodeWornArmor, } from './armor.js';
import { nearCapacity, } from './weight.js';
import { dist2, dungeonDepth } from './hacklib.js';
import { MONSTER_ATTACKS, MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_LEVEL, MONSTER_MOVE, MONSTER_NAME, MONSTER_SOUND, MONSTER_SYMBOL, monsterIsNonliving, monsterTypeName, } from './monster_data.js';
import { finishHeroDeath, } from './end.js';
import { runLevelRegions } from './regions.js';
import { maintainVaultResidence, continueVaultGuardArrival, moveVaultGuard, } from './vault.js';
import { observeObject, recordObjectEncounter, recordObjectKnowledge, learnObjectType, } from './object_knowledge.js';
import { automaticSearch, revealWarnedMonsters } from './detect.js';
import { activateStatueTrapAt } from './statue_trap.js';
import { finishPrayerOccupation } from './pray.js';
import { getHungry, recoverHeroFromFainting, regainHearingAfterHelplessness, } from './hunger.js';
import { talkQuestCharacter } from './quest.js';
import { publishMonsterCuss } from './monster_cuss.js';
import { monsterAlignmentType } from './monster_alignment.js';
import { moveElementalBubbles } from './elemental.js';
import { removeObjectAndContentsFromBill, checkSpecialRoom, currentShopResident, } from './shk.js';
import { inventoryItemDescription, rerollMenu, } from './invent.js';
import { hasIntrinsicProperty, hasPermanentIntrinsicProperty, propertyIsActive, propertyTimeout, propertyIsBlocked, refreshProperty, setPropertyTimeout, } from './properties.js';
import { heroIsUnconscious, putHeroToSleep } from './hero_sleep.js';
import { resolveMonsterContactEffect } from './monster_contact_effects.js';
import { setSlipperyHands } from './towel.js';
import { heroHasSlipperyHands, slipFromSlipperyHands } from './slippery_hands.js';
import { restartMonsterShapechanging } from './monster_polymorph.js';
import { msummon } from './minion.js';
import { captureRunmodeDelay } from './runmode.js';
function observeMonsterUsedObject(object) {
    if (!object)
        return;
    observeBucForNaming(object);
    observeObject(object);
    findArtifact(object);
}
// C muse.c:mquaffmsg(). Sensing the drinker does not reveal the potion.
async function presentMonsterQuaff(monster, object) {
    return publishMonsterQuaff(monster, object, { state: requireInitializedGame() });
}
function putLine(col, row, text, attr = 0) {
    const game = requireInitializedGame();
    const display = requireGameDisplay(game);
    for (let i = 0; i < text.length && col + i < display.cols; i++)
        display.setCell(col + i, row, text.charAt(i), NO_COLOR, attr);
}
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
function welcomeText() {
    const g = requireInitializedGame();
    const align = g.initAlignment?.name || 'neutral';
    const gender = g.flags?.female ? 'female' : 'male';
    const race = g.urace?.adj || 'human';
    const role = g.flags?.female && g.urole?.name?.f
        ? g.urole.name.f : g.urole?.name?.m || 'Adventurer';
    const identity = ['caveman', 'priest', 'valkyrie'].includes(g.urole?.key)
        ? `${align} ${race} ${role}` : `${align} ${gender} ${race} ${role}`;
    return `${g.urole?.greeting || 'Hello'} ${g.plname}, welcome to NetHack!  You are a ${identity}.`;
}
async function showInlineMore(message) {
    await plineWithContinuation(message);
    await flushPendingTopline();
}
// C ref: calendar.c phase_of_the_moon(), friday_13th(), both from getlt().
export function fixedCalendar(datetime) {
    const date = recorderLocalDate(datetime);
    if (!date)
        return { moonphase: null, friday13: false };
    const { year, month, day, weekday } = date;
    const diy = Math.floor((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 1)) / 86400000);
    const goldn = ((year - 1900) % 19) + 1;
    let epact = (11 * goldn + 18) % 30;
    if ((epact === 25 && goldn > 11) || epact === 24)
        epact++;
    const moonphase = (Math.floor(((((diy + epact) * 6) + 11) % 177) / 22)) & 7;
    return { moonphase, friday13: weekday === 5 && day === 13 };
}
async function applyCalendarMessages() {
    const game = requireInitializedGame();
    const calendar = fixedCalendar(game.datetime);
    game.flags.moonphase = calendar.moonphase;
    game.flags.friday13 = calendar.friday13;
    // Native luck changes follow the message, including any input it needs.
    if (calendar.moonphase === 4) {
        await plineWithContinuation('You are lucky!  Full moon tonight.');
        game.u.uluck = Math.min(LUCKMAX, (game.u.uluck || 0) + 1);
    }
    else if (calendar.moonphase === 0) {
        await plineWithContinuation('Be careful!  New moon tonight.');
    }
    if (calendar.friday13) {
        await plineWithContinuation('Watch out!  Bad things can happen on Friday the 13th.');
        game.u.uluck = Math.max(LUCKMIN, (game.u.uluck || 0) - 1);
    }
}
// C refs: restore.c dorecover(), allmain.c moveloop_preamble(resuming=TRUE).
// Restoring skips new-game RNG setup but reinitializes the Lua alignment
// shuffle, presents the saved map, and applies real-world calendar effects.
export async function restoregamePreamble() {
    const game = requireInitializedGame();
    delete game._pendingHeroShapeChange;
    const quest = game.quest_status;
    const savedGenders = quest && { leader: quest.ldrgend, nemesis: quest.nemgend };
    initializeRoleQuestGenders();
    // C restgamestate() reloads q_score after role_init() rolls its genders.
    if (quest && savedGenders) {
        quest.ldrgend = savedGenders.leader;
        quest.nemgend = savedGenders.nemesis;
    }
    await l_nhcore_init();
    game._moveloopStarted = false;
    // pickup.c's oldcap is process-local (decl.c), not restored save state.
    game._encumbranceLevel = 0;
    // C dorecover() rebuilds the unsaved vision state before docrt() and
    // welcome(). Search and monster feedback use that same live sight.
    vision_reset_new_level();
    await docrt();
    const race = game.urace?.adj || game.urace?.noun || 'human';
    const role = game.flags?.female && game.urole?.name?.f
        ? game.urole.name.f : game.urole?.name?.m || 'Adventurer';
    const greeting = `${game.urole.greeting} ${game.displayName || game.plname}, the ${race} ${role}, welcome back to NetHack!`;
    // The first flush paints the display state restored with the level.
    await bot();
    await plineWithContinuation(greeting);
    await checkSpecialRoom();
    if (game.flags?.explore)
        await plineWithContinuation('You are in non-scoring explore/discovery mode.');
    await applyCalendarMessages();
    await readEngravingAt(game.u.ux, game.u.uy, plineWithContinuation);
    await fixShopDamage(game);
    await finishMoveloopPreamble();
}
// C options.c:ask_do_tutorial(). Empty acceptance rebuilds the menu with
// an explanation; a selected answer or Escape ends the question.
async function askTutorial() {
    let pass = 0;
    for (;;) {
        const items = [
            { key: 'y', text: 'Yes, do a tutorial' },
            { key: 'n', text: 'No, just start play' },
            { text: '' },
            { text: 'Put "OPTIONS=!tutorial" in .nethackrc to skip this query.' },
        ];
        if (pass++)
            items.push({ text: "(Please choose 'y' or 'n'.)" });
        const answer = await showInventoryWindow([{ items }], {
            title: 'Do you want a tutorial?', pickMode: PICK_ONE,
        });
        if (answer.key === 0)
            continue;
        return answer.key === 'y'.charCodeAt(0);
    }
}
// C/Lua refs: allmain.c maybe_do_tutorial(), do.c goto_level(),
// nhcore.lua tutorial_enter(), and nhlua.c nhl_gamestate().  Destination
// construction and arrival precede the entry pager, but that pager still
// projects the source graph.  Tutorial inventory is deliberately sequestered
// until a later portal restores the saved game state.
async function enterTutorial() {
    const game = requireInitializedGame();
    const target = game.specialLevels?.get('tut-1');
    if (!target)
        return false;
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
    });
    game.u.ucamefrom = { ...oldDepth };
    await currentLuaLifecycle().changeTutorialMode(game, true);
    game.u.uz = { ...target };
    game._specialLevelPrototype = 'tut-1';
    await mklev();
    // goto_level() arrives through u_on_rndspot(), even when Lua restricts
    // the region to a single square.
    await placeHeroAtRandomArrival(game.level.downTeleportRegion);
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
    vision_recalc(0);
    await docrt();
    findArmorClass(game);
    await redrawMap();
    await flush_screen(1);
    return true;
}
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
    if (!game.tutorial_set_in_config) {
        // Menu creation flushes only a message still awaiting dismissal.
        // A wrapped welcome has already completed its own pager.
        await flushPendingTopline();
        await flush_screen(1);
        const doTutorial = await askTutorial();
        game._tutorialDeclined = !doTutorial;
        game._pending_message = '';
        if (doTutorial)
            await enterTutorial();
        else {
            await redrawMap();
            await flush_screen(1);
        }
    }
}
// C allmain.c:moveloop_preamble(), shared new/restore tail. Equipment and
// pickup messages may suspend before this boundary makes command input live.
async function finishMoveloopPreamble() {
    const game = requireInitializedGame();
    await reportHeroEncumbrance();
    game.u.uz0 ||= { ...game.u.uz };
    game.u.uz0.dlevel = game.u.uz.dlevel;
    game.context.move = 0;
    game._moveloopStarted = true;
}
function appendTurnMessage(message) {
    const game = requireInitializedGame();
    if (game._suppressMessagesUntilInput)
        return;
    game._pending_message = game._pending_message
        ? `${game._pending_message}  ${message}` : message;
    game._last_message = game._pending_message;
    game._lastPlineMessage = message;
}
// C ref: allmain.c:interrupt_multi().  Count-prefixed ordinary commands use
// positive `multi`; full HP or power recovery cancels that voluntary repeat,
// but must not stop independent occupations such as eating, lock-picking, or
// spellbook study.  This port represents both kinds in `_occupation`, so keep
// the distinction at the interruption boundary.
function interruptCountedActivity(message) {
    const game = requireInitializedGame();
    if (!(game.multi > 0) || game.context.travel || game.context.run)
        return;
    endVoluntaryMultiTurn(game);
    if (game.flags?.verbose !== false && game._lastPlineMessage !== message) {
        appendTurnMessage(message);
    }
}
// C ref: allmain.c's `once-per-hero-took-time` tail, after the movement-ration
// loop has allocated as many global turns as the hero needs.  Burden can make
// one action span two allocations; seer_turn is checked only after the last
// one, against the final `moves` value.
async function finishHeroTookTime(sourceTurn) {
    const game = requireInitializedGame();
    if (sourceTurn >= (game.seer_turn ?? Infinity)) {
        if ((game.u.uhave.amulet || propertyIsActive('clairvoyant', game))
            && !In_endgame(game.u.uz) && !propertyIsBlocked('clairvoyant', game))
            await mapVicinity(null, { state: game });
        game.seer_turn = sourceTurn + 15 + rn2(31);
    }
}
async function finishOrDeferHeroTookTime(sourceTurn) {
    const game = requireInitializedGame();
    if (game._vaultMaintenanceContinuation) {
        game._vaultHeroTookTimePending = sourceTurn;
        return;
    }
    await finishHeroTookTime(sourceTurn);
}
async function finishInitialTurnMaintenanceAfterIntervention(sourceTurn) {
    const game = requireInitializedGame();
    // allmain.c's environmental owner runs after engraving wear. Air and
    // Water share the moving bubble list created by fixup_special(); Fire
    // reuses the same fumarole sampler as initial arrival.
    if (Is_airlevel(game.u?.uz) || Is_waterlevel(game.u?.uz))
        await moveElementalBubbles();
    else if (game.level?.flags?.fumaroles)
        await fumaroles(game);
    // C allmain.c increments negative `multi` only after the complete global
    // turn (monster allocation, timeouts, sounds, hunger, and engraving wear).
    // Keep the counter here rather than in the command which caused the
    // helplessness so fast heroes and multi-round movement rations retain the
    // same boundary.
    if (currentMulti(game) < 0) {
        game._helplessRunmodeDelayPending = sourceTurn;
        setMulti(currentMulti(game) + 1, game);
        if (game._helplessTurns === 0) {
            const doneMessage = game._helplessDoneMessage
                ?? 'You can move again.';
            // Live actor schedulers finish this synchronous phase inside an
            // async moveloop owner.  Queue recovery there so an occupied
            // topline can page before unmul's message replaces it, as tty
            // pline() does in C.
            game._queuedHelplessRecoveryMessage = doneMessage;
        }
    }
}
// State-derived subset of the once-per-turn maintenance in allmain.c.
// This covers the first quiet turn: monster movement allotments, random
// monster generation, ambient feature sounds, hunger, and engraving wear.
async function finishInitialTurnMaintenanceRng(sourceTurn) {
    const game = requireInitializedGame();
    if (game.u.uhave.amulet)
        await amuletTurn(game);
    if (!rn2(40 + currentAttribute(A_DEX) * 3))
        wipeHeroEngraving(rnd(3));
    // allmain.c's demigod intervention clock advances after engraving wear
    // and before environmental level motion.  Nervous outcomes 0/1 are
    // synchronous; outcome2's black-glow pline can suspend before rndcurse,
    // reset, environment, and once-per-action scheduling.
    if (game.u?.uevent?.udemigod && !game.u?.invulnerable) {
        if (game.u.udg_cnt !== undefined && game.u.udg_cnt > 0)
            game.u.udg_cnt--;
        if ((game.u.udg_cnt ?? 0) === 0) {
            const intervention = Is_astralevel(game.u.uz) ? rnd(4) : rn2(6);
            if (intervention <= 1) {
                appendTurnMessage(formatFeltMessage('vaguely nervous.'));
                delete game._unresolvedDemigodIntervention;
            }
            else if (intervention === 2) {
                if (!heroIsBlind(game))
                    appendTurnMessage(`You notice a ${displayColorName('black', game)} glow surrounding you.`);
                game._pendingDemigodIntervention = {
                    kind: intervention, sourceTurn,
                };
                return;
            }
            else if (intervention === 5) {
                game._pendingDemigodIntervention = {
                    kind: intervention, sourceTurn,
                };
                return;
            }
            else if (intervention === 4) {
                game._pendingDemigodIntervention = {
                    kind: intervention, sourceTurn,
                };
                return;
            }
            else if (intervention === 3) {
                const affected = aggravateMonsters(game, rn2);
                game._lastDemigodAggravation = affected.map(monster => monster.m_id);
                delete game._unresolvedDemigodIntervention;
            }
            else {
                game._unresolvedDemigodIntervention = intervention;
            }
            game.u.udg_cnt = 50 + rn2(200);
        }
    }
    await finishInitialTurnMaintenanceAfterIntervention(sourceTurn);
}
// C ref: attrib.c:exerper().  Hunger is read after gethungry() has applied
// this turn's decrement, so a completed meal can change the periodic RNG
// branch even when no other status or monster state changed.
async function periodicTurnExercise(sourceTurn) {
    const game = requireInitializedGame();
    if (!(sourceTurn % 10)) {
        const hunger = game.u?.uhunger ?? 900;
        if (hunger > 1000) {
            await exerciseAttribute(A_DEX, false); // Satiated: abuse Dexterity
            if (game.urole?.key === 'monk')
                await exerciseAttribute(A_WIS, false);
        }
        else if (hunger > 150) {
            await exerciseAttribute(A_CON, true); // Not Hungry: exercise Constitution
        }
        else if (hunger > 50) {
            // Hungry has no hunger-driven exercise.
        }
        else if (hunger > 0) {
            await exerciseAttribute(A_STR, false); // Weak: abuse Strength
            if (game.urole?.key === 'monk')
                await exerciseAttribute(A_WIS, true);
        }
        else {
            await exerciseAttribute(A_CON, false); // Fainting/Fainted
        }
        switch (nearCapacity(game)) {
            case MOD_ENCUMBER:
                await exerciseAttribute(A_STR, true);
                break;
            case HVY_ENCUMBER:
                await exerciseAttribute(A_STR, true);
                await exerciseAttribute(A_DEX, false);
                break;
            case EXT_ENCUMBER:
                await exerciseAttribute(A_DEX, false);
                await exerciseAttribute(A_CON, false);
                break;
            default:
                break;
        }
    }
    if (!(sourceTurn % 5)) {
        const u = game.u || {};
        // C attrib.c:exerper() checks status in this order.  These are
        // independent conditions: a confused hero with wounded legs abuses
        // both Wisdom and Dexterity, consuming one exercise draw for each.
        if (((u.clairvoyanceTurns ?? 0) > 0
            || hasPermanentIntrinsicProperty('clairvoyant', game))
            && !u.clairvoyanceBlocked)
            await exerciseAttribute(A_WIS, true);
        // attrib.c checks HRegeneration here, not the combined Regeneration
        // property.  A worn ring supplies ERegeneration: it heals and raises
        // metabolism, but it does not exercise Strength every fifth turn.
        if (u.regenerationIntrinsic || (u.regenerationTurns ?? 0) > 0
            || hasIntrinsicProperty('regeneration', null, game))
            await exerciseAttribute(A_STR, true);
        if (u.sick || (u.sickTurns ?? 0) > 0
            || u.vomiting || (u.vomitingTurns ?? 0) > 0)
            await exerciseAttribute(A_CON, false);
        if ((u.confusionTurns ?? 0) > 0
            || heroIsHallucinating(game))
            await exerciseAttribute(A_WIS, false);
        if (((u._woundedLegTurns ?? 0) > 0 && !u.usteed)
            || u.fumbling || propertyIsActive('fumbling', game)
            || u.stunned || (u.stunnedTurns ?? 0) > 0)
            await exerciseAttribute(A_DEX, false);
    }
}
async function finishInitialTurnMaintenanceAfterAmbient({ sourceTurn, moveAmount, }) {
    const game = requireInitializedGame();
    await getHungry({ invulnerable: game.u.invulnerable });
    if (game.program_state.gameover)
        return { kind: 'complete', moveAmount };
    // JS has already advanced `game.moves` for the hero action which caused
    // this maintenance pass.  C increments svm.moves inside this pass, so
    // the resulting C turn number is the existing JS value, not value + 1.
    await periodicTurnExercise(sourceTurn);
    await checkAttributeExercise(sourceTurn);
    if (maintainVaultResidence(game)) {
        // invault() owns an interactive getlin()/pager transaction.  Preserve
        // the remaining same-turn maintenance so it resumes only after that
        // transaction completes, just as the synchronous C stack does.
        game._vaultMaintenanceContinuation = { sourceTurn };
        return { kind: 'complete', moveAmount };
    }
    await finishInitialTurnMaintenanceRng(sourceTurn);
    return { kind: 'complete', moveAmount };
}
async function finishFumblingExpiryAfterMessage(fumbled, publish) {
    const game = requireInitializedGame();
    if (fumbled) {
        nomul(-2);
        game._helplessDoneMessage = '';
        game._helplessReason = 'fumbling';
        if (invWeight(game) > -500) {
            if (!heroIsDeaf(game))
                await publish('You make a lot of noise!');
            await wakeMonstersNearWithMessages(game.u.ux, game.u.uy, game.u.ulevel * 20, game, publish);
        }
    }
    game.u.fumblingFromIce = false;
    if (game.u?.fumblingFromArmor || game.u?.fumblingIntrinsic || propertyIsActive('fumbling', game))
        game.u.fumblingTurns = (game.u.fumblingTurns ?? 0) + rnd(20);
    game.u.fumbling = !!(game.u?.fumblingFromArmor
        || game.u?.fumblingIntrinsic
        || propertyIsActive('fumbling', game)
        || (game.u.fumblingTurns !== undefined && game.u.fumblingTurns > 0));
}
async function finishInitialTurnMaintenanceAfterAutomaticSearch({ sourceTurn, moveAmount, }) {
    if (game.u.warning)
        await revealWarnedMonsters();
    await warnWithMasterKey(game);
    // Each sound keeps its native message wait before later feature rolls.
    await dosounds();
    await doStorms(game);
    if (game.program_state.gameover)
        return { kind: 'complete', moveAmount };
    return finishInitialTurnMaintenanceAfterAmbient({ sourceTurn, moveAmount });
}
async function finishInitialTurnMaintenanceAfterRegions({ sourceTurn, moveAmount, capacity, deferAmbientMessage, polymorphed, }) {
    const game = requireInitializedGame();
    if (game.u.ublesscnt > 0)
        game.u.ublesscnt--;
    // allmain.c:regen_hp() runs after nh_timeout().  If a timeout pline
    // suspended at tty, no regeneration or later maintenance may run until
    // that exact source stack resumes.
    const recoveryCapacity = game.u.invulnerable ? UNENCUMBERED : capacity;
    if (await regenerateHeroHp(recoveryCapacity, sourceTurn))
        interruptCountedActivity('You are in full health.');
    if (game.program_state.gameover)
        return { kind: 'complete', moveAmount };
    // C moveloop_core(): moving around while Strained or worse is hard work.
    if (recoveryCapacity > MOD_ENCUMBER && game.u.umoved
        && sourceTurn % (recoveryCapacity < EXT_ENCUMBER ? 30 : 10) === 0)
        await overexertHeroHp(game);
    if ((game.u?.uen ?? 0) < (game.u?.uenmax ?? 0)) {
        const level = game.u?.ulevel ?? 1;
        const roleFactor = game.urole?.key === 'wizard' ? 3 : 4;
        const interval = Math.max(1, Math.trunc(((30 + 8 - level) * roleFactor) / 6));
        const energyRegeneration = !!(game.u?.energyRegeneration
            || game.u?.energyRegenerationIntrinsic
            || game.u?.energyRegenerationExtrinsic);
        if ((recoveryCapacity < MOD_ENCUMBER
            && sourceTurn % interval === 0)
            || energyRegeneration) {
            const attributes = game.u?.acurr?.a || [];
            let upper = Math.trunc(((attributes[A_WIS] ?? 0) + (attributes[A_INT] ?? 0)) / 15) + 1;
            if (game.u?.magicalBreathingExtrinsic)
                upper += 2;
            game.u.uen = Math.min(game.u.uenmax, game.u.uen + 1 + rn2(upper));
            game.context.botl = true;
            if (game.u.uen === game.u.uenmax)
                interruptCountedActivity('You feel full of energy.');
        }
    }
    await rollHeroTeleportitis();
    if (game.program_state.gameover)
        return { kind: 'complete', moveAmount };
    await advanceHeroShapeChange();
    if (game.program_state.gameover)
        return { kind: 'complete', moveAmount };
    if (game.u?.searching && !game.level?.flags?.noautosearch
        && !heroHasInvoluntaryDelay(game)) {
        const search = await automaticSearch();
        if (typeof search === 'object' && search.statueTrap) {
            const { x, y } = search.statueTrap;
            return {
                kind: 'statue-trap',
                x, y, sourceTurn, moveAmount,
                capacity, deferAmbientMessage, polymorphed,
            };
        }
    }
    return await finishInitialTurnMaintenanceAfterAutomaticSearch({
        sourceTurn, moveAmount,
    });
}
// C allmain.c:moveloop_core(): Teleportation, including a teleporting form,
// moves the hero once in 85 turns. A move away from a leashed follower checks
// the leash and cancels queued and repeated commands.
async function rollHeroTeleportitis() {
    if (game.u.invulnerable || !heroCanTeleport(game) || rn2(85))
        return;
    const from = { x: game.u.ux, y: game.u.uy };
    await teleportHero({ chooseDestination: askTeleportDestination });
    if (game.program_state.gameover || (game.u.ux === from.x && game.u.uy === from.y))
        return;
    if (!heroNextToLeashedFollowers())
        await checkHeroLeashes(from.x, from.y);
    game._cannedCommands = [];
    clearRepeatCommand();
}
// C apply.c:next_to_u().
function heroNextToLeashedFollowers() {
    const level = game.level;
    if (level?.monsters.some(monster => monster.mleashed
        && (monster.mx - game.u.ux) ** 2 + (monster.my - game.u.uy) ** 2 > 2))
        return false;
    const steed = game.u.usteed;
    return !(steed && monsterCarriesAmulet(steed));
}
// C allmain.c:moveloop_core(). A selected change waits through involuntary
// delays and Unchanging; losing the source of the change cancels it.
async function advanceHeroShapeChange() {
    if (game.u.invulnerable)
        return;
    const polymorph = propertyIsActive('polymorph', game);
    const infection = game.u.ulycn;
    const infected = infection !== undefined && infection >= 0 && infection < MONSTER_NAME.length;
    if ((game._pendingHeroShapeChange === 'polymorph' && !polymorph)
        || (game._pendingHeroShapeChange === 'were' && !infected))
        delete game._pendingHeroShapeChange;
    if (polymorph && rn2(100) === 0)
        game._pendingHeroShapeChange = 'polymorph';
    else if (infected && !Upolyd(game.u)
        && rn2(80 - (sessionIsNight(game.datetime) ? 20 : 0)) === 0)
        game._pendingHeroShapeChange = 'were';
    if (!game._pendingHeroShapeChange || heroIsUnchanging(game)
        || heroHasInvoluntaryDelay(game))
        return;
    await stopHeroOccupation(game);
    if (game._pendingHeroShapeChange === 'polymorph')
        await polymorphHero();
    else
        await applyHeroWereChange();
    delete game._pendingHeroShapeChange;
}
function finishInitialTurnMaintenanceAfterTimeout({ sourceTurn, moveAmount, capacity, deferAmbientMessage, polymorphed, }) {
    return {
        kind: 'regions',
        sourceTurn, moveAmount, capacity, deferAmbientMessage, polymorphed,
    };
}
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
async function beginInitialTurnMaintenance() {
    const game = requireInitializedGame();
    // allmain.c caches this after monster movement. Timeouts can change the
    // load, but movement and recovery for this turn keep the earlier capacity.
    const capacity = nearCapacity(game);
    // allmain.c runs mcalcdistress() before allocating the next movement
    // ration. Regeneration, were-change checks, and temporary maladies count
    // down once per global turn, independent of the monster's own speed.
    game.were_changes = 0;
    for await (const event of monsterDistressEvents(game.level?.monsters || [], game, rn2, game.moves, plineWithContinuation)) {
        if (event.kind === 'stationary-liquid') {
            if (game.vision_full_recalc)
                vision_recalc(0);
            await resolveMonsterLiquid(event.monster, game, {
                announce: plineWithContinuation,
                monsterMoving: false,
                finishDeath: finishHeroLiquidMonsterDeath,
            });
            continue;
        }
        if (event.kind === 'shape-change') {
            if (event.change.heroDied)
                return { kind: 'hero-died' };
            continue;
        }
        await presentWereChange(event.change, {
            publish: plineWithContinuation,
            wakeNearby: (x, y, distance) => wakeMonstersNearWithMessages(x, y, distance, game),
        });
    }
    return finishInitialTurnMaintenanceAfterMonsterDistress(capacity, true);
}
async function finishInitialTurnMaintenanceAfterMonsterDistress(capacity, deferAmbientMessage) {
    const game = requireInitializedGame();
    allocateMonsterMovement(game.level?.monsters || [], rn2, game);
    // allmain.c:maybe_generate_rnd_mon().  Monster pressure increases below
    // the Castle and again after demigodhood; the denominator is topology
    // state, not a fixed scheduler constant.
    const currentDepth = dungeonDepth(game.u?.uz?.dnum ?? 0, game.u?.uz?.dlevel ?? 1);
    const strongholdDepth = dungeonDepth(game.stronghold_level?.dnum ?? 0, game.stronghold_level?.dlevel ?? Number.MAX_SAFE_INTEGER);
    const generationRate = game.u?.uevent?.udemigod ? 25
        : currentDepth > strongholdDepth ? 50 : 70;
    if (rn2(generationRate) === 0)
        await makemonAt(null, 0, 0);
    const polymorphed = (game.u.mtimedone !== undefined && game.u.mtimedone > 0)
        && Number.isInteger(game.u?.umonnum);
    let moveAmount;
    if (game.u.usteed && game.u.umoved) {
        moveAmount = mcalcmove(game.u.usteed, true, rn2, game);
    }
    else {
        moveAmount = polymorphed
            ? (MONSTER_MOVE[game.u.umonnum] ?? 0) : 12;
        if (game.u.veryFast) {
            if (rn2(3) !== 0)
                moveAmount += 12;
        }
        else if (game.u.fast && rn2(3) === 0) {
            moveAmount += 12;
        }
    }
    // allmain.c:u_calc_moveamt() applies the cached carrying capacity after
    // the current form's natural speed and Fast/Very_fast bonus.  OVERLOADED is
    // deliberately the default case: a zero-speed mold receives no movement
    // until intrinsic Fast grants a complete 12-point action.
    if (capacity === 1) {
        moveAmount -= Math.trunc(moveAmount / 4);
    }
    else if (capacity === 2) {
        moveAmount -= Math.trunc(moveAmount / 2);
    }
    else if (capacity === 3) {
        moveAmount -= Math.trunc(moveAmount * 3 / 4);
    }
    else if (capacity === 4) {
        moveAmount -= Math.trunc(moveAmount * 7 / 8);
    }
    // C records the hero's current square after monster movement/allocation
    // and before the new global turn's callbacks.  Pets which lose sight of
    // the hero consult this ring on their next action.
    addHeroMovementRation(game, moveAmount);
    setTrack(game);
    game.moves = (game.moves || 1) + 1;
    if (game.flags.time && !game.context.run)
        game.context.time_botl = true;
    game._heroActionSeq = game.moves * 8;
    await currentLuaLifecycle().callCore(game, 'moveloop_turn');
    if (heroHasSlipperyHands(game))
        await slipFromSlipperyHands(game);
    // nh_timeout() precedes regeneration and exerchk() in the C loop.  Keep
    // the first timed impairment live rather than treating its setup rolls as
    // disposable: bear-trap leg damage lowers Dexterity until this countdown
    // expires.
    const sourceTurn = game.moves;
    return finishInitialTurnMaintenanceBeforeTimeouts({
        sourceTurn, moveAmount, capacity, deferAmbientMessage, polymorphed,
    });
}
async function finishInitialTurnMaintenanceBeforeTimeouts({ sourceTurn, moveAmount, capacity, deferAmbientMessage, polymorphed, }) {
    const game = requireInitializedGame();
    // C timeout.c:nh_timeout() expires temporary confusion before regen,
    // sounds, hunger, and exerchk().  The final tick is observable twice:
    // it queues the recovery message and prevents this same turn's periodic
    // Wisdom abuse from seeing Confusion as active.
    // Prayer's u.uinvulnerable is not the timed Invulnerable property.
    // timeout.c:nh_timeout() returns before decrementing any property while
    // that prayer-only flag is active.
    recoverTimedLuck(game);
    const prayerTimeoutFreeze = !!game.u?.invulnerable;
    if (!prayerTimeoutFreeze && heroIsPetrifying(game)) {
        await petrificationDialogue({
            state: game,
            publish: plineWithContinuation,
        });
        if (game.program_state?.gameover)
            return { kind: 'complete', moveAmount };
    }
    if (!prayerTimeoutFreeze && heroIsSliming(game)) {
        await slimeDialogue({
            state: game,
            publish: plineWithContinuation,
            repaint: newsym,
            randomMonsterName: randomDisplayMonsterName,
        });
        if (game.program_state?.gameover)
            return { kind: 'complete', moveAmount };
    }
    if (!prayerTimeoutFreeze && heroIsVomiting(game)) {
        await vomitingDialogue({
            state: game,
            publish: plineWithContinuation,
        });
    }
    if (!prayerTimeoutFreeze
        && game.u.strangledTurns !== undefined && game.u.strangledTurns > 0) {
        await strangulationDialogue({
            state: game,
            publish: plineWithContinuation,
        });
        if (game.program_state?.gameover)
            return { kind: 'complete', moveAmount };
    }
    if (!prayerTimeoutFreeze && heroIsSick(game)) {
        await sicknessDialogue({
            state: game,
            publish: plineWithContinuation,
        });
        if (game.program_state?.gameover)
            return { kind: 'complete', moveAmount };
    }
    if (!prayerTimeoutFreeze)
        await levitationDialogue(game);
    if (!prayerTimeoutFreeze) {
        await wallPassageDialogue(game);
        await breathingDialogue(game);
    }
    if (!prayerTimeoutFreeze) {
        if (propertyTimeout('sleepy', game) === 4)
            await plineWithContinuation('You yawn.');
        await advanceBodyTimeouts(game);
        if (game.program_state.gameover)
            return { kind: 'complete', moveAmount };
    }
    if (!prayerTimeoutFreeze)
        await advanceSpellProtection(game);
    if (!prayerTimeoutFreeze)
        await advanceGallopingTimeout(game);
    if (!prayerTimeoutFreeze) {
        if (advancePropertyTimeout('fireResistance', game)
            && !propertyIsActive('fireResistance', game))
            await plineWithContinuation('Your temporary ability to survive burning has ended.');
        advanceSimplePropertyTimeouts([
            'coldResistance', 'sleepResistance', 'disintegrationResistance',
        ], game);
    }
    if (!prayerTimeoutFreeze
        && game.u.shockResistanceTurns !== undefined && game.u.shockResistanceTurns > 0
        && --game.u.shockResistanceTurns === 0)
        refreshProperty('shockResistance', game);
    if (!prayerTimeoutFreeze) {
        advancePropertyTimeout('poisonResistance', game);
        await advanceCorpseResistanceTimeouts(game);
        if (game.program_state?.gameover)
            return { kind: 'complete', moveAmount };
        advanceSimplePropertyTimeouts(['drainResistance', 'sicknessResistance'], game);
    }
    if (!prayerTimeoutFreeze
        && game.u.invulnerableTurns !== undefined && game.u.invulnerableTurns > 0) {
        game.u.invulnerableTurns--;
    }
    if (!prayerTimeoutFreeze
        && game.u.magicResistanceTurns !== undefined && game.u.magicResistanceTurns > 0
        && --game.u.magicResistanceTurns === 0)
        refreshProperty('antimagic', game);
    if (!prayerTimeoutFreeze
        && game.u.stunnedTurns !== undefined && game.u.stunnedTurns > 0) {
        const remaining = game.u.stunnedTurns - 1;
        if (remaining === 0) {
            if (deferAmbientMessage) {
                return {
                    kind: 'timeout-message',
                    timeoutKind: 'stun',
                    sourceTurn, moveAmount, capacity, deferAmbientMessage, polymorphed,
                    prayerTimeoutFreeze,
                };
            }
            game.u.stunnedTurns = 0;
            game.context.botl = true;
            refreshProperty('stunned', game);
            if (!heroIsUnaware(game))
                appendTurnMessage(formatFeltMessage(heroIsHallucinating(game) ? 'less wobbly now.' : 'a bit steadier now.'));
        }
        else
            game.u.stunnedTurns = remaining;
    }
    return finishInitialTurnMaintenanceAfterStun({
        sourceTurn, moveAmount, capacity, deferAmbientMessage, polymorphed,
        prayerTimeoutFreeze,
    });
}
function finishInitialTurnMaintenanceAfterStun({ sourceTurn, moveAmount, capacity, deferAmbientMessage, polymorphed, prayerTimeoutFreeze, }) {
    const game = requireInitializedGame();
    if (!prayerTimeoutFreeze
        && game.u.confusionTurns !== undefined && game.u.confusionTurns > 0) {
        const remaining = game.u.confusionTurns - 1;
        if (remaining === 0) {
            if (deferAmbientMessage) {
                return {
                    kind: 'timeout-message',
                    timeoutKind: 'confusion',
                    sourceTurn, moveAmount, capacity, deferAmbientMessage, polymorphed,
                    prayerTimeoutFreeze,
                };
            }
            game.u.confusionTurns = 0;
            game.context.botl = true;
            refreshProperty('confusion', game);
            if (!heroIsUnaware(game))
                appendTurnMessage(formatFeltMessage(heroIsHallucinating(game) ? 'less trippy now.' : 'less confused now.'));
        }
        else
            game.u.confusionTurns = remaining;
    }
    return finishInitialTurnMaintenanceAfterConfusion({
        sourceTurn, moveAmount, capacity, deferAmbientMessage, polymorphed,
        prayerTimeoutFreeze,
    });
}
async function finishInitialTurnMaintenanceAfterConfusion({ sourceTurn, moveAmount, capacity, deferAmbientMessage, polymorphed, prayerTimeoutFreeze, }) {
    const game = requireInitializedGame();
    if (!prayerTimeoutFreeze
        && game.u.blindTurns !== undefined && game.u.blindTurns > 0) {
        game.u.blindTurns--;
        if (game.u.blindTurns === 0) {
            // C nh_timeout() samples Blind after decrementing, then restores
            // one tick for make_blinded()'s recovery message and redraws.
            const wasBlind = heroIsBlind(game);
            game.u.blindTurns = 1;
            await makeBlinded(0);
            if (wasBlind && !heroIsBlind(game))
                await stopHeroOccupation(game);
        }
    }
    if (!prayerTimeoutFreeze
        && game.u.deafTurns !== undefined && game.u.deafTurns > 0) {
        if (game.u.deafTurns === 1) {
            await makeDeaf(0);
            if (!heroIsDeaf(game))
                await stopHeroOccupation(game);
        }
        else
            game.u.deafTurns--;
    }
    if (!prayerTimeoutFreeze) {
        await advanceHeroSickness({ publish: plineWithContinuation });
        if (game.program_state.gameover)
            return { kind: 'complete', moveAmount };
        await advanceHeroPetrification();
        if (game.program_state.gameover)
            return { kind: 'complete', moveAmount };
        await advanceHeroStrangulation();
        if (game.program_state.gameover)
            return { kind: 'complete', moveAmount };
        await advanceHeroVomiting();
    }
    if (!prayerTimeoutFreeze && advancePropertyTimeout('glib', game))
        setSlipperyHands(0, game);
    if (!prayerTimeoutFreeze) {
        await advanceHeroSliming({ transform: polymonHero, die: finishHeroDeath });
        if (game.program_state.gameover)
            return { kind: 'complete', moveAmount };
    }
    if (!prayerTimeoutFreeze
        && game.u.hallucinationTurns !== undefined && game.u.hallucinationTurns > 0) {
        if (game.u.hallucinationTurns === 1) {
            await makeHallucinated(0);
            if (!heroIsHallucinating(game))
                await stopHeroOccupation(game);
        }
        else
            game.u.hallucinationTurns--;
    }
    if (!prayerTimeoutFreeze)
        advancePropertyTimeout('hallucinationResistance', game);
    if (!prayerTimeoutFreeze
        && game.u.fumblingTurns !== undefined && game.u.fumblingTurns > 0) {
        game.u.fumblingTurns--;
        if (game.u.fumblingTurns === 0) {
            const levitating = !!(game.u?.levitating
                || game.u?.levitation || game.levitating);
            const flying = !!(game.u?.flying || game.flying);
            if (game.u?.umoved && !levitating && !flying) {
                const publish = deferAmbientMessage
                    ? plineWithContinuation : async (message) => appendTurnMessage(message);
                await slipOrTrip(publish);
                if (game.program_state.gameover)
                    return { kind: 'complete', moveAmount };
                await finishFumblingExpiryAfterMessage(true, publish);
            }
            else {
                await finishFumblingExpiryAfterMessage(false, plineWithContinuation);
            }
        }
    }
    return finishInitialTurnMaintenanceAfterFumbling({
        sourceTurn, moveAmount, capacity, deferAmbientMessage, polymorphed,
        prayerTimeoutFreeze,
    });
}
async function finishInitialTurnMaintenanceAfterFumbling({ sourceTurn, moveAmount, capacity, deferAmbientMessage, polymorphed, prayerTimeoutFreeze, }) {
    const game = requireInitializedGame();
    if (!prayerTimeoutFreeze
        && game.u._woundedLegTurns !== undefined && game.u._woundedLegTurns > 0) {
        game.u._woundedLegTurns--;
        if (game.u._woundedLegTurns === 0) {
            await healHeroLegs(game);
            refreshProperty('woundedLegs', game);
            await stopHeroOccupation(game);
        }
    }
    if (!prayerTimeoutFreeze) {
        await advanceSleepinessTimeout(game);
        advancePropertyTimeout('hunger', game);
    }
    if (!prayerTimeoutFreeze
        && game.u.seeInvisibleTurns !== undefined && game.u.seeInvisibleTurns > 0) {
        game.u.seeInvisibleTurns--;
        if (game.u.seeInvisibleTurns === 0) {
            refreshProperty('seeInvisible', game);
            await refreshHeroSeeing();
            await stopHeroOccupation(game);
        }
    }
    if (!prayerTimeoutFreeze) {
        advanceSimplePropertyTimeouts(['telepathy', 'warning'], game);
        if (advancePropertyTimeout('warnOfMonster', game)
            && !propertyIsActive('warnOfMonster', game)) {
            const species = game.context.warntype?.speciesidx;
            if (game.context.warntype)
                game.context.warntype.speciesidx = -1;
            if (species !== undefined && species >= 0) {
                const name = MONSTER_NAME[species];
                if (name)
                    await plineWithContinuation(`You are no longer warned about ${makePlural(name)}.`);
            }
        }
        advanceSimplePropertyTimeouts([
            'warnUndead', 'searching', 'clairvoyant', 'infravision',
        ], game);
    }
    if (!prayerTimeoutFreeze
        && game.u.monsterDetectionTurns !== undefined && game.u.monsterDetectionTurns > 0) {
        game.u.monsterDetectionTurns--;
        if (!game.u.monsterDetectionTurns) {
            refreshProperty('detectMonsters', game);
            await see_monsters();
        }
    }
    if (!prayerTimeoutFreeze)
        advanceSimplePropertyTimeouts(['blindResistance', 'adorned'], game);
    if (!prayerTimeoutFreeze
        && game.u.invisibleTurns !== undefined && game.u.invisibleTurns > 0) {
        game.u.invisibleTurns--;
        if (game.u.invisibleTurns === 0) {
            const stillInvisible = syncHeroInvisibility(game);
            newsym(game.u.ux, game.u.uy);
            if (!stillInvisible && !propertyIsBlocked('invisible', game) && !heroIsBlind(game)) {
                await plineWithContinuation(game.u.seeInvisible
                    ? 'You can no longer see through yourself.'
                    : 'You are no longer invisible.');
                await stopHeroOccupation(game);
            }
        }
    }
    if (!prayerTimeoutFreeze)
        await advanceDisplacementTimeout(game);
    if (!prayerTimeoutFreeze) {
        advanceSimplePropertyTimeouts([
            'stealth', 'aggravateMonster', 'conflict', 'jumping',
            'teleportation', 'teleportControl',
        ], game);
        await advanceLevitationTimeout(game);
        if (game.program_state?.gameover)
            return { kind: 'complete', moveAmount };
        await advanceFlyingTimeout(game);
        if (game.program_state?.gameover)
            return { kind: 'complete', moveAmount };
    }
    if (!prayerTimeoutFreeze) {
        if (advancePropertyTimeout('waterWalking', game)
            && !propertyIsActive('waterWalking', game))
            await plineWithContinuation('Your temporary ability to walk on liquid has ended.');
        advancePropertyTimeout('swimming', game);
        if (advancePropertyTimeout('magicalBreathing', game))
            await finishBreathingTimeout(game);
        if (advancePropertyTimeout('passesWalls', game))
            await finishWallPassageTimeout(game);
        advancePropertyTimeout('slowDigestion', game);
    }
    if (!prayerTimeoutFreeze)
        advanceSimplePropertyTimeouts(['halfSpellDamage', 'halfPhysicalDamage'], game);
    if (!prayerTimeoutFreeze) {
        advanceSimplePropertyTimeouts([
            'regeneration', 'energyRegeneration', 'protection',
        ], game);
        if (advancePropertyTimeout('protectionFromShapeChangers', game)
            && !propertyIsActive('protectionFromShapeChangers', game))
            await restartMonsterShapechanging(game);
        advanceSimplePropertyTimeouts([
            'polymorph', 'polymorphControl', 'unchanging',
        ], game);
    }
    if (!prayerTimeoutFreeze
        && game.u.veryFastTurns !== undefined && game.u.veryFastTurns > 0) {
        setPropertyTimeout('fast', game.u.veryFastTurns - 1, game);
        if (game.u.veryFastTurns === 0) {
            if (!game.u.veryFast)
                await plineWithContinuation(formatFeltMessage(game.u.fast ? 'yourself slow down a bit.' : 'yourself slow down.'));
        }
    }
    if (!prayerTimeoutFreeze)
        advanceSimplePropertyTimeouts([
            'reflection', 'freeAction', 'sustainAbility', 'lifeSaving',
        ], game);
    return {
        kind: !prayerTimeoutFreeze && peekNextDueObjectTimer(game, sourceTurn)
            ? 'object-timers' : 'regions',
        sourceTurn, moveAmount, capacity, deferAmbientMessage, polymorphed,
    };
}
// C timeout.c decrements every intrinsic timeout in prop.h order. These
// properties have no dedicated recovery action; their source projection still
// needs refreshing when the timed source ends.
function advanceSimplePropertyTimeouts(properties, state) {
    for (const property of properties)
        advancePropertyTimeout(property, state);
}
function advancePropertyTimeout(property, state) {
    const remaining = propertyTimeout(property, state);
    if (remaining <= 0)
        return false;
    setPropertyTimeout(property, remaining - 1, state);
    return remaining === 1;
}
async function advanceSleepinessTimeout(state) {
    if (!advancePropertyTimeout('sleepy', state))
        return;
    if (heroIsUnconscious(state) || state.u.sleepResistance) {
        setPropertyTimeout('sleepy', rnd(100), state);
    }
    else if (propertyIsActive('sleepy', state)) {
        await plineWithContinuation('You fall asleep.');
        const duration = rnd(20);
        await putHeroToSleep(duration, { state });
        setPropertyTimeout('sleepy', duration + rnd(100), state);
    }
}
async function advanceWorldTurn() {
    const game = requireInitializedGame();
    const initialPhase = await beginInitialTurnMaintenance();
    if (initialPhase.kind === 'hero-died')
        return;
    let phase = initialPhase;
    const completedTurn = game.moves;
    while (phase.kind === 'timeout-message') {
        if (phase.timeoutKind === 'stun') {
            await makeStunned(0);
            if (!propertyIsActive('stunned', game))
                await stopHeroOccupation(game);
            phase = await finishInitialTurnMaintenanceAfterStun(phase);
        }
        else {
            await makeConfused(0);
            await stopHeroOccupation(game);
            phase = await finishInitialTurnMaintenanceAfterConfusion(phase);
        }
    }
    while (phase.kind === 'object-timers') {
        const claimed = claimNextDueObjectTimer(game, phase.sourceTurn);
        if (claimed)
            await runObjectTimer(claimed, phase.sourceTurn);
        if (game.program_state.gameover)
            return;
        if (peekNextDueObjectTimer(game, phase.sourceTurn))
            continue;
        phase = finishInitialTurnMaintenanceAfterTimeout(phase);
    }
    if (game.program_state?.gameover)
        return;
    while (phase.kind === 'regions') {
        await runLevelRegionTurn();
        if (game.program_state?.gameover)
            return;
        phase = await finishInitialTurnMaintenanceAfterRegions(phase);
    }
    while (phase.kind === 'statue-trap') {
        const monster = await activateStatueTrapAt(phase.x, phase.y);
        if (monster)
            await exerciseAttribute(A_WIS, true);
        phase = await finishInitialTurnMaintenanceAfterAutomaticSearch(phase);
    }
    if (game._pendingDemigodIntervention) {
        const intervention = game._pendingDemigodIntervention;
        game._pendingDemigodIntervention = null;
        if (intervention.kind === 2) {
            await waitForCurrentMonsterMore();
            const heroAttack = { deferredCurseItems: true };
            await resolveDeferredHeroCurseItems(heroAttack);
            delete game._unresolvedDemigodIntervention;
        }
        else if (intervention.kind === 5) {
            await resurrectWizard();
            delete game._unresolvedDemigodIntervention;
        }
        else if (intervention.kind === 4) {
            let effect = await summonNastyMonsters(null);
            if (effect.deferredDemonSummon)
                effect = await msummon();
            game._lastDemigodNasty = (effect.created || []).map(monster => monster.m_id);
            delete game._unresolvedDemigodIntervention;
        }
        game.u.udg_cnt = 50 + rn2(200);
        await finishInitialTurnMaintenanceAfterIntervention(intervention.sourceTurn);
    }
    const helplessDelayTurn = game._helplessRunmodeDelayPending;
    delete game._helplessRunmodeDelayPending;
    // Dressing retains its physical topline through each negative-multi
    // frame; its armor effects still wait for unmul's recovery message.
    const delayedAction = pendingArmorAction(game);
    if (delayedAction) {
        if (game._pending_message) {
            delete delayedAction._runmodeRetainedTopline;
        }
        else if (!delayedAction._runmodeRetainedTopline) {
            delayedAction._runmodeRetainedTopline
                = game.nhDisplay?.grid?.[0]?.map(cell => ({ ...cell }));
        }
    }
    await captureRunmodeDelay(game, Number.isInteger(helplessDelayTurn), helplessDelayTurn ?? completedTurn, {
        preservePhysicalTopline: true,
        retainedTopline: delayedAction?._runmodeRetainedTopline ?? null,
    });
    await drainQueuedHelplessRecoveryMessage();
}
// C allmain.c:moveloop_core() calls unmul() at the end of the world turn
// which finishes negative multi, even if burden still prevents hero movement.
async function finishDelayedArmorAction(delayed, g) {
    if (delayed.kind === 'wear') {
        // unmul() has printed nomovemsg before Armor_on() and find_ac().
        const effectMessages = await applyArmorOnEffects(delayed.object, g);
        delayed.object.known = true;
        const discoverArmorType = armorOnIdentifiesType(delayed.object, effectMessages)
            && !g._knownObjectTypes?.has(delayed.object.otyp);
        const deferDiscoveryUntilAfterMessage = delayed.object.otyp === 166;
        if (discoverArmorType && !deferDiscoveryUntilAfterMessage) {
            recordObjectKnowledge(delayed.object.otyp);
            await exerciseAttribute(A_WIS, true);
        }
        const completionMessage = effectMessages.filter(Boolean).join('  ');
        if (completionMessage)
            await plineWithContinuation(completionMessage);
        // If an actor line already owns tty, afternmv itself is resumed
        // only after that pager is dismissed.  Attribute the makeknown()
        // Wisdom credit to the resumed input boundary, not the capture
        // which displayed the actor pager.
        if (discoverArmorType && deferDiscoveryUntilAfterMessage) {
            recordObjectKnowledge(delayed.object.otyp);
            await exerciseAttribute(A_WIS, true);
        }
    }
    else if (delayed.kind === 'remove') {
        // unmul() has acknowledged nomovemsg while the armor was still worn.
        await finishArmorRemoval(delayed.object, { silent: true });
    }
    if (g.program_state.gameover)
        return;
    g._armorClassDirty = true;
}
async function settleHeroLiquidAfterAction() {
    const game = requireInitializedGame();
    const finishLanding = ({ from, to }) => finishDestinationSpotEffects({
        oldx: from.x,
        oldy: from.y,
        newx: to.x,
        newy: to.y,
    });
    if (game.u?.utrap && game.u.utraptype === TT_LAVA) {
        return sinkHeroIntoLava({
            state: game,
            publish: plineWithContinuation,
            applyLandingEffects: finishLanding,
        });
    }
    if (game.u?.umoved)
        return null;
    return applyHeroLiquidEffects(plineWithContinuation);
}
async function drainQueuedHelplessRecoveryMessage() {
    const game = requireInitializedGame();
    if (game._queuedHelplessRecoveryMessage == null)
        return;
    const message = game._queuedHelplessRecoveryMessage;
    await finishHeroHelplessness(message);
    // allmain.c takes travel caused by unmul() before find_ac() and the Seer update.
    await finishScheduledLevelChange();
}
// Native hack.c:unmul(). The after-handler is cleared before invocation so
// recovery can start another delay without inheriting the old completion.
export async function finishHeroHelplessness(messageOverride, state = game, publish = plineWithContinuation) {
    state.context.botl = true;
    setMulti(0, state);
    state._queuedHelplessRecoveryMessage = null;
    const message = messageOverride ?? state._helplessDoneMessage ?? 'You can move again.';
    if (message) {
        await publish(message);
        if (Upolyd(state.u) && message.toLowerCase().startsWith('you survived that '))
            await publish(`You are ${withIndefiniteArticle(monsterTypeName(heroSpecies(state), state.u.mfemale))}.`);
    }
    state.u.usleep = 0;
    state._helplessReason = null;
    state._helplessDoneMessage = null;
    const after = state._afterMove;
    state._afterMove = null;
    if (!after)
        return;
    switch (after.kind) {
        case 'wear':
        case 'remove':
            await finishDelayedArmorAction(after, state);
            break;
        case 'hear-again':
            await regainHearingAfterHelplessness({ state });
            break;
        case 'unfaint':
            await recoverHeroFromFainting({ state });
            break;
        case 'end-mimic-meal':
            finishMealMimicry(state);
            break;
        case 'finish-digestion':
            await finishHeroDigestion(state);
            break;
        case 'steal': {
            const theft = state._armorTheft;
            if (theft?.thief)
                await finishDelayedArmorTheft(theft.thief, theft.object, state);
            state._armorTheft = null;
            break;
        }
        case 'unstolen-armor': {
            const object = state._armorTheft?.object;
            state._armorTheft = null;
            if (object && state.inventory.includes(object))
                await plineWithContinuation(`You finish taking off your ${armorSimpleName(object, state)}.`);
            break;
        }
        case 'finish-prayer':
            await finishPrayerOccupation(state);
            break;
    }
}
// allmain.c:u_calc_moveamt() clamps a negative movement balance after every
// global allocation.  Without this, a slow polymorph can carry the action
// debit across zero-speed turns and require an extra monster/global round.
function addHeroMovementRation(state, amount) {
    state.u.umovement = Math.max(0, (state.u.umovement ?? 0) + amount);
}
function reluctantPetMessage(monster, movement) {
    const game = requireInitializedGame();
    const pile = game.level?.objects?.[movement.x]?.[movement.y] || [];
    const rememberedObject = game.level?.at(movement.x, movement.y)?.remembered_glyph?.kind === 'object';
    const top = !heroIsHallucinating(game) && game.level?.flags.hero_memory && rememberedObject
        ? pile[0] : undefined;
    const objectName = top ? distantMonsterObjectName(top) : 'something';
    const verb = verbForSubject(null, monsterLocomotion(monster.mnum, 'step'));
    const subject = monsterName(monster, { state: game, capitalized: true, article: 'your', suppressIt: true });
    const preposition = monsterFliesOrFloats(monster) ? 'over' : 'onto';
    return `${subject} ${verb} reluctantly ${preposition} ${objectName}.`;
}
async function monsterAttackMessage(monster, attack, previousAttack = null, random = rn2) {
    const game = requireInitializedGame();
    if (attack.specialMessage)
        return null;
    if (attack.effect === 'petrifying-corpse' || attack.effect === 'wrapping-natural')
        return null;
    if (attack.effect === 'physical-hug' || attack.effect === 'silent-physical-touch')
        return null;
    if (attack.effect === 'nurse-heal' || attack.effect === 'nurse-cooperate')
        return null;
    if (attack.effect === 'seduction-contact')
        return null;
    if (attack.effect === 'engulf' || attack.effect === 'engulf-tick'
        || attack.effect === 'engulf-refused')
        return null;
    if (attack.effect === 'item-theft' && !monsterIsAnimal(monster))
        return null;
    if (attack.effect === 'blind-natural' && !attack.blindMessage)
        return null;
    if (attack.effect === 'failed-grab') {
        const subject = monsterName(monster, { capitalized: true });
        const verb = attack.damageType === AD_DGST ? 'gulp'
            : attack.damageType === AD_STCK ? 'adhere' : 'grab';
        return `${possessiveName(subject).slice(0, 99)} ${verb} attempt passes right through you!`;
    }
    if (!attack.hit)
        return monsterMissMessage(monster, attack, game, random);
    const subject = monsterName(monster, { capitalized: true });
    if (attack.effect === 'pestilence-contact')
        return `${subject} reaches out, and you feel fever and chills.`;
    if (attack.effect === 'famine-contact')
        return `${subject} reaches out, and your body shrivels.`;
    if (attack.effect === 'death-contact')
        return `${subject} reaches out with its deadly touch.`;
    if (monster?.mnum === 116) {
        if (attack.effect === 'electric-natural')
            return `${subject} bites!`;
        return attack.effect === 'electric-avoided'
            ? `${subject} bites!  You avoid harm.`
            : `${subject} bites!  You get zapped!`;
    }
    if (attack.effect === 'blind-natural')
        return attack.blindMessage ? `${subject} blinds you!` : null;
    if (attack.effect === 'leg-natural') {
        const side = attack.legSide || 'left';
        const leg = heroLegName(game);
        const contact = attack.legContact === 'reach'
            ? `tries to reach your ${side} ${leg}`
            : attack.legContact === 'nuzzle'
                ? `nuzzles against your ${side} ${leg}`
                : attack.legContact === 'exposed-prick'
                    ? `pricks the exposed part of your ${side} ${leg}`
                    : attack.legContact === 'boot-prick'
                        ? `pricks through your ${side} boot`
                        : attack.legContact === 'boot-scratch'
                            ? `scratches your ${side} boot`
                            : `pricks your ${side} ${leg}`;
        return `${subject} ${contact}!`;
    }
    const verb = attack.attackType === 16 ? 'tentacles suck your brain'
        : attack.attackType === 2 ? 'bites'
            : attack.attackType === 3 ? 'kicks'
                : attack.attackType === 4 ? 'butts'
                    : attack.attackType === 5 ? 'touches you'
                        : attack.attackType === 6 ? 'stings' : 'hits';
    // C hitmsg() requires adjacent slots in the species' attack array.
    // getmattk() replacements use a separate buffer and cannot be adjacent.
    // Artifact prose skips hitmsg(), so it does not update that prior slot.
    const again = previousAttack?.hit
        && previousAttack.kind === 'hero-attack'
        && !previousAttack.specialMessage
        && previousAttack.effect !== 'physical-hug'
        && previousAttack.attackType === attack.attackType
        && previousAttack.attackIndex + 1 === attack.attackIndex
        && previousAttack.effectiveAttack === MONSTER_ATTACKS[monster.mnum]?.[previousAttack.attackIndex]
        && attack.effectiveAttack === MONSTER_ATTACKS[monster.mnum]?.[attack.attackIndex]
        ? ' again' : '';
    return `${attack.attackType === 16 ? possessiveName(subject) : subject} ${verb}${again}!`;
}
// C Some_Monnam(): unseen thieves are "Someone" or "Something".
function wornItemRemover(monster, state) {
    return monsterName(monster, { state, capitalized: true, augmentIt: true });
}
function wornTheftObjectDescription(object) {
    // C steal.c:worn_item_removal() starts from doname(), then massages only
    // the ownership and equipment-location suffix for its pre-removal line.
    let description = inventoryItemDescription(object)
        .replace(/^(?:the|an|a) /, object === game.uchain ? 'the ' : 'your ')
        .replace(' (being worn)', '')
        .replace(' (alternate weapon; not wielded)', '');
    description = description.replace(/ \(on (left|right) hand\)$/, ' (from $1 hand)');
    return description;
}
function heroEquipmentSlots() {
    return [
        'uwep', 'uswapwep', 'uquiver',
        'uarm', 'uarmc', 'uarmh', 'uarms', 'uarmg', 'uarmf', 'uarmu',
        'uleft', 'uright', 'uamul', 'ublindf',
    ];
}
// C refs: steal.c:steal()/worn_item_removal(), uhitm.c:mhitm_ad_sedu().
// Animal hit feedback precedes selection; garment removal can suspend it.
// Removal prose is split here because urgent_pline() can suspend before the
// no-teleport check, fleeing state, and the rest of movemon().
async function resolveDeferredHeroItemTheft(action, monster, attack, random) {
    const game = requireInitializedGame();
    if (!attack?.deferredItemTheft)
        return false;
    attack.deferredItemTheft = false;
    const animal = monsterIsAnimal(monster);
    const wasPunished = !!game.uball;
    const draw = (limit) => {
        action.calls.push(`rn2(${limit})`);
        return random(limit);
    };
    if (!animal && MONSTER_ATTACKS[heroSpecies(game)]?.some(attack => attack[1] === AD_SEDU || attack[1] === AD_SSEX)) {
        const subject = monsterName(monster, { state: game, capitalized: true });
        await plineWithContinuation(`${subject} ${heroIsDeaf(game)
            ? "says something but you can't hear it"
            : (monster.minvent || monster.inventory || []).length ? 'brags about the goods some dungeon explorer provided'
                : 'makes some remarks about how difficult theft is lately'}.`);
        if (!await reportMonsterTeleportRestriction(monster, { state: game }))
            await randomMonsterRelocation(monster, { calls: action.calls, flags: RLOC_MSG });
        attack.attackerDone = true;
        attack.contactDone = true;
        attack.nativeResult = M_ATTK_AGR_DONE;
        return true;
    }
    if (monster.mcan) {
        if (animal)
            return false;
        if (!heroIsBlind(game)) {
            const subject = monsterName(monster, { state: game,
                capitalized: true, adjective: 'plain' });
            await plineWithContinuation(`${subject} tries to ${game.flags.female
                ? 'charm' : 'seduce'} you, but you seem ${game.flags.female
                ? 'unaffected' : 'uninterested'}.`);
        }
        if (draw(3)) {
            if (!await reportMonsterTeleportRestriction(monster, { state: game }))
                await randomMonsterRelocation(monster, { calls: action.calls, flags: RLOC_MSG });
            attack.attackerDone = true;
            attack.contactDone = true;
            attack.nativeResult = M_ATTK_AGR_DONE;
        }
        return false;
    }
    if (dist2(monster.mx, monster.my, game.u.ux, game.u.uy) > 2)
        return false;
    const seenBeforeRemoval = canSpotMonster(monster);
    // C steal() keeps Some_Monnam() from before any removal; an unseen thief
    // named by a hallucinating hero takes a random someone/something.
    let subject = monsterName(monster, { state: game, capitalized: true, augmentIt: true });
    const meal = game.context.victual;
    if (game._occupation?.key === 'eat-food' && meal && meal.usedtime >= meal.reqtime) {
        await stopHeroOccupation(game);
        if (game.program_state.gameover)
            return true;
    }
    const adornment = !animal && !game.uarmg
        ? [game.uleft, game.uright].find(ring => ring?.otyp === OBJECT_NAMES.indexOf('adornment'))
        : null;
    let object = adornment ?? selectHeroItemForTheft(game, random, action.calls);
    const throwsRocks = !!((MONSTER_FLAGS2[monster.mnum] ?? 0) & 0x08000000);
    let retriedBoulder = false;
    while (object) {
        if (game._armorTheft?.object === object)
            return false;
        if (object.otyp !== BOULDER || throwsRocks || retriedBoulder)
            break;
        retriedBoulder = true;
        object = selectHeroItemForTheft(game, random, action.calls);
    }
    if (!object) {
        if (!animal && game.uchain && draw(4)) {
            await plineWithContinuation(`${wornItemRemover(monster, game)} takes off ${wornTheftObjectDescription(game.uchain)}.`);
            await removeWornHeroItem(game.uchain, game);
        }
        else if (!animal && game.u.utrap && game.u.utraptype === TT_BURIEDBALL && !draw(4)) {
            await plineWithContinuation(`${subject} takes off your unseen chain.`);
            await openHoldingTrap(game.u, { state: game });
        }
        else
            await plineWithContinuation(heroIsBlind(game)
                ? 'Somebody tries to rob you, but finds nothing to steal.'
                : game.inventory.some(item => item.oclass === 12)
                    ? `${subject} tries to rob you, but isn't interested in gold.`
                    : `${subject} tries to rob you, but there is nothing to steal!`);
        await retreatAfterItemTheft(action, monster, attack, animal);
        return true;
    }
    if (!game.inventory.includes(object))
        return false;
    const equipmentSlots = heroEquipmentSlots();
    const occupiedSlots = equipmentSlots.filter(slot => game[slot] === object);
    const weaponMask = object?.owornmask ?? 0;
    const wasWeapon = occupiedSlots.some(slot => ['uwep', 'uswapwep', 'uquiver'].includes(slot))
        || !!(weaponMask & W_WEAPONS)
        || object.wielded || object.alternate || object.ready;
    const wasAccessory = occupiedSlots.some(slot => ['uleft', 'uright', 'uamul', 'ublindf'].includes(slot))
        || !!(weaponMask & W_ACCESSORY);
    const wasWorn = occupiedSlots.length > 0
        || object.worn || weaponMask !== 0;
    const wornArmor = occupiedSlots.some(slot => slot.startsWith('uarm'));
    const refuse = async () => {
        const verbs = ['steal', 'snatch', 'grab', 'take'];
        const name = wornArmor ? `your ${armorSimpleName(object, game)}`
            : ownedObjectName(object, game, { capitalized: false });
        await plineWithContinuation(`${subject} tries to ${verbs[draw(4)]} ${name} but gives up.`);
        if (draw(Math.trunc(game.inventory.filter(item => item.oclass !== 12).length / 5) + 2) === 0) {
            await retreatAfterItemTheft(action, monster, attack, animal);
        }
        return false;
    };
    if (object.otyp === BOULDER && !throwsRocks)
        return refuse();
    if (animal) {
        let stuck = object === game.uball || (!!object.cursed && wasWorn
            && object !== game.uquiver && !(object === game.uswapwep && !game.u.twoweap));
        const weapon = game.uwep;
        const ring = object === game.uleft || object === game.uright;
        if (!stuck && ring && weapon && isWeldedPrimary(weapon, game)) {
            // C welded() reveals the curse even when the other hand is free.
            weapon.bknown = true;
            const primaryRing = game.u.rightHanded === false ? game.uleft : game.uright;
            stuck = object === primaryRing || !!OBJECT_BIMANUAL[weapon.otyp];
        }
        if (stuck || !monsterCanCarryObject(monster, object, game, draw))
            return refuse();
    }
    if (object.otyp === LEASH && object.leashmon) {
        if (animal && object.cursed)
            return refuse();
        releaseObjectLeash(object, game);
    }
    const previousDelay = pendingArmorAction(game);
    const wasDoffing = (previousDelay?.kind === 'remove' && previousDelay.object === object)
        || isBeingTakenOff(object, game);
    await stopDonning(object, game);
    await stopHeroOccupation(game);
    // stop_donning() makes interrupted dressing armor unworn before steal()
    // decides whether this item still needs armor-removal time or feedback.
    const stillWorn = equipmentSlots.some(slot => game[slot] === object)
        || object.worn || (object.owornmask ?? 0) !== 0;
    let removalMessage = null;
    let charmed = false;
    if (equipmentSlots.some(slot => slot.startsWith('uarm') && game[slot] === object)) {
        // Pinned stop_donning() clears multi before returning olddelay, so
        // interrupted removal keeps the full armor delay and refusal chance.
        const delay = OBJECT_DELAY[object.otyp] ?? 0;
        const helplessReason = game._helplessReason;
        const reason = typeof helplessReason === 'string' ? helplessReason : helplessReason?.text;
        const unresponsive = heroIsUnaware(game) || (heroHasInvoluntaryDelay(game)
            && !!reason && /^(?:frozen|paralyzed)/.test(reason));
        if (animal || unresponsive) {
            if (delay >= 1 && draw(10))
                return refuse();
        }
        else {
            charmed = true;
            const cursed = object.cursed;
            const slowly = delay >= 1 || heroHasInvoluntaryDelay(game);
            const name = armorSimpleName(object, game);
            const who = canSpotMonster(monster) ? subject : 'She';
            removalMessage = game.flags.female
                ? `${who} charms you.  You gladly ${cursed ? 'let her take'
                    : !slowly ? 'hand over' : wasDoffing ? 'continue removing' : 'start removing'} your ${name}.`
                : `${canSpotMonster(monster) ? monsterName(monster, { state: game,
                    capitalized: true, adjective: 'beautiful' }) : 'She'} seduces you and ${cursed
                    ? 'helps you to take' : !slowly ? 'you take' : wasDoffing
                    ? 'you continue taking' : 'you start taking'} off your ${name}.`;
            object.cursed = false;
            try {
                await plineWithContinuation(removalMessage, { urgent: true });
                // nomul() cannot shorten another involuntary delay. Set it
                // before removal, whose effects can sleep or life-save us.
                // Life saving may replace the counter during this same
                // monster turn.
                nomul(-delay);
                game._helplessReason = 'taking off clothes';
                game._helplessDoneMessage = null;
                await removeWornHeroItem(object, game);
            }
            finally {
                object.cursed = cursed;
            }
            if ((game._helplessTurns ?? 0) > 0) {
                game._armorTheft = { thief: monster, object };
                game._afterMove = { kind: 'steal' };
                return false;
            }
        }
    }
    const removalItem = object === game.uball && game.uchain ? game.uchain : object;
    if (!charmed && (wasWeapon || stillWorn)) {
        observeObjectForNaming(removalItem);
        const description = wornTheftObjectDescription(removalItem);
        const verb = removalItem === object && wasWeapon ? 'disarms'
            : wasAccessory ? 'removes' : 'takes off';
        // worn_item_removal() names the thief again with Some_Monnam().
        removalMessage = `${wornItemRemover(monster, game)} ${verb} ${description}.`;
    }
    if (removalMessage && !charmed) {
        await plineWithContinuation(removalMessage);
        game._lastPlineKind = PLNMSG_MON_TAKES_OFF_ITEM;
    }
    if (removalItem !== object)
        await removeWornHeroItem(removalItem, game);
    await removeWornHeroItem(object, game);
    if (game.program_state?.gameover || !game.inventory.includes(object)) {
        attack.theftResolved = true;
        return true;
    }
    // steal() refreshes its cached name when removing worn gear restores
    // sight. The later retreat message in mhitm_ad_sedu() names the thief too.
    if (!seenBeforeRemoval && (wornArmor || wasAccessory) && canSpotMonster(monster))
        subject = monsterName(monster, { state: game, capitalized: true });
    // C yname() observes and names ownership before the shop bill is cleared.
    observeObjectForNaming(object);
    const stolenName = ownedObjectName(object, game, { capitalized: false });
    if (!heroHasConflict(game) && !(wasPunished && !game.uball))
        monster.mavenge = 1;
    if (object.unpaid)
        removeObjectAndContentsFromBill(object, game, { resident: currentShopResident(game) });
    unlinkObject(object, game);
    await finishInventoryRemoval(object, game);
    if (game.program_state?.gameover) {
        attack.theftResolved = true;
        return true;
    }
    observeObjectForNaming(object);
    const stolenObjectDescription = inventoryItemDescription(object);
    const thief = charmed || (game._lastPlineKind === PLNMSG_MON_TAKES_OFF_ITEM
        && MONSTER_SYMBOL[monster.mnum] === 14) ? 'She' : subject;
    // urgent_pline() does not force a pager for its newly installed line.
    // It can first suspend while clearing the older worn-removal line; after
    // that acknowledgement, rloc() may append its own message to this one.
    await plineWithContinuation(`${thief} stole ${stolenObjectDescription}.`, { urgent: true });
    await reportHeroEncumbrance(game);
    const couldPetrify = object.otyp === CORPSE && touchPetrifies(object.corpsenm);
    object.how_lost = LOST_STOLEN;
    await addObjectToMonsterInventory(monster, object, game);
    if (couldPetrify && !((monster.misc_worn_check ?? 0) & W_ARMG)) {
        await petrifyMonsterImmediately(monster, {
            creditHero: true,
            finishDeath: (target, death = {}) => finishHeroMonsterKill(target, target.mx, target.my, { ...death, showKillMessage: false, recordConduct: false }),
        });
        attack.nativeResult = M_ATTK_AGR_DIED;
        attack.contactDone = true;
        return true;
    }
    // steal() returns zero while an involuntary delay is still active.
    // The thief can keep attacking and must stay for any pending armor.
    attack.theftResolved = true;
    if (heroHasInvoluntaryDelay(game))
        return true;
    await retreatAfterItemTheft(action, monster, attack, animal, stolenName);
    return true;
}
async function retreatAfterItemTheft(action, monster, attack, animal, stolenName) {
    const game = requireInitializedGame();
    if (animal) {
        if (stolenName && canSeeMonster(monster))
            await plineWithContinuation(`${monsterName(monster, { state: game,
                capitalized: true })} tries to run away with ${stolenName}.`);
    }
    else if (!await reportMonsterTeleportRestriction(monster, { state: game })) {
        const relocation = await randomMonsterRelocation(monster, {
            calls: action.calls, flags: RLOC_MSG,
        });
        if (relocation && 'died' in relocation && relocation.died)
            return;
    }
    const flight = await makeMonsterFlee(monster, { announce: false });
    if (flight.heroDied)
        return;
    attack.attackerDone = true;
    attack.contactDone = true;
    attack.nativeResult = M_ATTK_AGR_DONE;
}
// C steal.c:stealarm(). The armor is already unworn; transfer
// waits until the removal delay finishes and requires the same nearby thief.
async function finishDelayedArmorTheft(thief, object, state) {
    if (!state.inventory.includes(object))
        return;
    if (thief.dead || thief.mhp <= 0 || !state.level?.monsters.includes(thief)
        || dist2(thief.mx, thief.my, state.u.ux, state.u.uy) > 2
        || !MONSTER_ATTACKS[thief.mnum]?.some(attack => attack[1] === AD_SITM))
        return;
    if (object.unpaid)
        removeObjectAndContentsFromBill(object, state, { resident: currentShopResident(state) });
    unlinkObject(object, state);
    await finishInventoryRemoval(object, state);
    observeObjectForNaming(object, { state });
    await plineWithContinuation(`${monsterName(thief, { state, capitalized: true })} steals ${inventoryItemDescription(object)}!`);
    await addObjectToMonsterInventory(thief, object, state);
    await makeMonsterFlee(thief, { state, announce: false });
    if (!await reportMonsterTeleportRestriction(thief, { state }))
        await randomMonsterRelocation(thief, { state, flags: RLOC_MSG });
}
function visibleMonsterSubject(monster) {
    return monsterName(monster, { capitalized: true });
}
async function presentMonsterCuss(action) {
    await publishMonsterCuss(action.monster, requireInitializedGame(), sides => {
        action.calls.push(`rn2(${sides})`);
        return rn2(sides);
    });
}
function distantMonsterObjectName(object) {
    observeDistantObjectForNaming(object);
    return inventoryItemDescription(object);
}
async function presentMonsterGrowth(monster, growth) {
    const game = requireInitializedGame();
    if (!growth?.changedSpecies || growth.applied)
        return;
    if (canSpotMonster(monster))
        await plineWithContinuation(growth.message);
    finishMonsterGrowth(monster, growth);
    newsym(monster.mx, monster.my);
    if (growth.genocided)
        await finishEnvironmentalMonsterDeath(monster, game);
}
async function resolveErosionFormRehumanization(heroAttack, effectMessage) {
    const game = requireInitializedGame();
    let pagerOwned = false;
    const effectDismissal = await plineWithContinuation(effectMessage);
    if (effectDismissal !== null && effectDismissal !== undefined)
        pagerOwned = true;
    const restored = await returnHeroToHumanForm(game, {
        publish: async (message) => {
            const dismissal = await plineWithContinuation(message);
            if (dismissal !== null && dismissal !== undefined)
                pagerOwned = true;
        },
    });
    heroAttack.heroDied = restored.died;
    heroAttack.deferredPostHit = !restored.died;
    return pagerOwned;
}
// mcastu.c:castmu() elemental spells use spell protection and floor effects;
// they never enter hitmu()'s armor cancellation or contact/passive tail.
async function resolveDeferredHeroDirectSpell(action, attack, state, publish, random, rollDice) {
    const type = attack.damageType;
    if (type !== AD_FIRE && type !== AD_COLD && type !== AD_MAGM)
        throw new Error(`Unsupported direct monster spell damage type: ${type}`);
    attack.deferredSpellEffect = false;
    const resisted = type === AD_FIRE ? !!state.u.fireResistance
        : type === AD_COLD ? !!state.u.coldResistance : !!state.u.antimagic;
    let damage = resisted ? 0 : (attack.damage ?? 0);
    if (resisted) {
        await shieldeff(state.u.ux, state.u.uy, state);
        await publish(type === AD_MAGM ? 'The missiles bounce off!' : 'But you resist the effects.');
    }
    else if (type === AD_MAGM) {
        // Native replaces its already-halved pre-roll with fresh missile
        // damage. Half_spell_damage is not applied to this second roll.
        const count = Math.trunc(action.monster.m_lev / 2) + 1;
        damage = rollDice(count, 6);
        action.calls.push(`d(${count},6)`);
    }
    const resistance = seenResistanceForDamage(type);
    if (resisted)
        monstersObserveHeroResistance(resistance, state);
    else
        monstersForgetHeroResistance(resistance, state);
    if (type === AD_FIRE && clearHeroSliming(state))
        await publish('The slime that covers you is burned away!');
    if (type === AD_MAGM) {
        const engraving = engravingAt(state.u.ux, state.u.uy, state.level);
        if (engraving) {
            const wear = rollDice(6, 6);
            action.calls.push('d(6,6)');
            wipeEngravingAt(state.u.ux, state.u.uy, engraving.text.length + wear, true, state.level);
        }
    }
    await applyRayFloorFeatures(type === AD_FIRE ? 'fire' : type === AD_COLD ? 'cold' : 'magic', state.u.ux, state.u.uy, state, {
        rayNoun: 'spell', heroCaused: false, publish,
        random: limit => {
            action.calls.push(`rn2(${limit})`);
            return random(limit);
        },
    });
    attack.appliedDamage = 0;
    if (damage && !state.program_state.gameover)
        applyHeroSpellDamage(attack, damage, state);
}
async function prepareMonsterSpellResistance(attack, state) {
    if (!attack.spell || !['psi-bolt', 'open-wounds', 'stun-you', 'paralyze', 'confuse-you', 'weaken-you'].includes(attack.spell))
        return;
    const resisted = state.u.antimagic
        || (attack.spell === 'stun-you' || attack.spell === 'paralyze') && heroHasFreeAction(state);
    if (resisted) {
        await shieldeff(state.u.ux, state.u.uy, state);
        monstersObserveHeroResistance(M_SEEN_MAGR, state);
    }
    else if (attack.spell === 'psi-bolt' || attack.spell === 'open-wounds') {
        monstersForgetHeroResistance(M_SEEN_MAGR, state);
    }
}
async function resolveDeferredHeroFirePillar(action, heroAttack, publish) {
    const game = requireInitializedGame();
    if (!heroAttack?.deferredFirePillar)
        return;
    const originalDamage = d(8, 6);
    action.calls.push('d(8,6)');
    const fireResistant = !!(game.u.fireResistance);
    if (fireResistant) {
        await shieldeff(game.u.ux, game.u.uy, game);
        monstersObserveHeroResistance(M_SEEN_FIRE, game);
    }
    else
        monstersForgetHeroResistance(M_SEEN_FIRE, game);
    let appliedDamage = fireResistant ? 0 : originalDamage;
    if (heroHasHalfSpellDamage(game))
        appliedDamage = Math.trunc((appliedDamage + 1) / 2);
    if (clearHeroSliming(game)) {
        await publish('The slime that covers you is burned away!');
    }
    await burnHeroArmorByFire(game, publish, action.calls, rn2);
    const items = await destroyFireInventory(originalDamage, {
        state: game,
        publish,
        die: finishHeroDeathAfterMonsterMessage,
    });
    if (items.heroDied)
        return;
    await igniteItems(game.inventory, {
        state: game,
        publish,
    });
    await applyRayFloorFeatures('fire', game.u.ux, game.u.uy, game, {
        rayNoun: 'spell', heroCaused: false, publish,
    });
    if (game.program_state.gameover)
        return;
    applyHeroSpellDamage(heroAttack, appliedDamage, game);
    heroAttack.deferredFirePillar = false;
}
async function resolveDeferredHeroLightningSpell(action, heroAttack, publish) {
    const game = requireInitializedGame();
    if (!heroAttack?.deferredLightningSpell)
        return;
    const reflection = heroReflectionSource(game);
    if (reflection) {
        await publish(`It bounces off your ${reflection.noun}.`);
        discoverHeroReflectionSource(reflection, game);
    }
    const originalDamage = d(8, 6);
    action.calls.push('d(8,6)');
    const shockResistant = !!game.u.shockResistance;
    if (reflection || shockResistant)
        await shieldeff(game.u.ux, game.u.uy, game);
    if (reflection) {
        monstersObserveHeroResistance(M_SEEN_REFL, game);
        heroAttack.appliedDamage = 0;
        heroAttack.reflectedLightning = true;
        heroAttack.deferredLightningSpell = false;
        return;
    }
    if (shockResistant) {
        monstersForgetHeroResistance(M_SEEN_REFL, game);
        monstersObserveHeroResistance(M_SEEN_ELEC, game);
    }
    else
        monstersForgetHeroResistance(M_SEEN_ELEC | M_SEEN_REFL, game);
    let appliedDamage = shockResistant ? 0 : originalDamage;
    if (heroHasHalfSpellDamage(game))
        appliedDamage = Math.trunc((appliedDamage + 1) / 2);
    const items = await destroyElectricInventory(originalDamage, {
        state: game,
        publish,
        die: finishHeroDeathAfterMonsterMessage,
    });
    if (items.heroDied)
        return;
    await applyRayFloorFeatures('lightning', game.u.ux, game.u.uy, game, {
        rayNoun: 'spell', heroCaused: false, publish,
    });
    if (game.program_state.gameover)
        return;
    const flashDuration = rnd(100);
    action.calls.push('rnd(100)');
    await flashBurn(flashDuration, true, { state: game, publish });
    applyHeroSpellDamage(heroAttack, appliedDamage, game);
    heroAttack.deferredLightningSpell = false;
}
async function resolveDeferredHeroInsectSpell(action, heroAttack) {
    const game = requireInitializedGame();
    if (!heroAttack?.deferredInsectSpell)
        return;
    const result = await summonMonsterInsects(action.monster, game);
    if (result.message)
        await plineWithContinuation(result.message);
    heroAttack.summonedInsects = result.created;
    heroAttack.deferredInsectSpell = false;
}
async function resolveDeferredHeroDeathTouch(action, heroAttack, publish) {
    const game = requireInitializedGame();
    if (!heroAttack?.deferredDeathTouch)
        return;
    const u = game.u || {};
    const monsterLevel = action.monster?.m_lev
        ?? MONSTER_LEVEL[action.monster?.mnum] ?? 0;
    const polymorphed = Upolyd(u);
    const form = polymorphed ? u.umonnum : null;
    const nonliving = form !== null && Number.isInteger(form)
        && monsterIsNonliving(form);
    const demon = form !== null && Number.isInteger(form)
        && !!((MONSTER_FLAGS2[form] ?? 0) & 0x00000100);
    if (nonliving || demon) {
        await publish('You seem no deader than before.');
        heroAttack.deferredDeathTouch = false;
        return;
    }
    const antimagic = !!u.antimagic;
    let succeeds = false;
    if (!antimagic) {
        const sides = Math.max(1, monsterLevel);
        const successRoll = rn2(sides);
        action.calls.push('rn2(' + sides + ')');
        succeeds = successRoll > 12;
    }
    if (!succeeds) {
        if (antimagic) {
            await shieldeff(u.ux, u.uy, game);
            monstersObserveHeroResistance(M_SEEN_MAGR, game);
        }
        await publish("Lucky for you, it didn't work!");
        heroAttack.deferredDeathTouch = false;
        return;
    }
    if (heroIsHallucinating(game)) {
        await publish('You have an out of body experience.');
        monstersForgetHeroResistance(M_SEEN_MAGR, game);
        heroAttack.deferredDeathTouch = false;
        return;
    }
    heroAttack.heroDied = await touchHeroWithDeath(action.monster, game, publish, (count, sides) => {
        action.calls.push(`d(${count},${sides})`);
        return d(count, sides);
    });
    if (!heroAttack.heroDied)
        monstersForgetHeroResistance(M_SEEN_MAGR, game);
    heroAttack.deferredDeathTouch = false;
}
async function resolveDeferredHeroDestroyArmor(heroAttack) {
    const game = requireInitializedGame();
    if (!heroAttack?.deferredDestroyArmor)
        return;
    const antimagic = !!game.u?.antimagic;
    if (antimagic) {
        await shieldeff(game.u.ux, game.u.uy, game);
        monstersObserveHeroResistance(M_SEEN_MAGR, game);
        await plineWithContinuation('A field of force surrounds you!');
        heroAttack.deferredDestroyArmor = false;
        return;
    }
    if (!await erodeWornArmor(game))
        await plineWithContinuation('Your skin itches.');
    else
        monstersForgetHeroResistance(M_SEEN_MAGR, game);
    heroAttack.deferredDestroyArmor = false;
}
async function resolveDeferredHeroCurseItems(heroAttack) {
    if (!heroAttack?.deferredCurseItems)
        return;
    heroAttack.cursedInventory = await rndcurse({
        publish: plineWithContinuation,
    });
    heroAttack.deferredCurseItems = false;
}
// C mcastu.c:mcast_geyser() discards castmu()'s level-scaled spell pre-roll
// and rolls a fresh physical 8d6.  Half physical damage applies; half spell
// damage and elemental resistances do not.
function resolveDeferredHeroGeyser(action, heroAttack) {
    const game = requireInitializedGame();
    if (!heroAttack?.deferredGeyserSpell)
        return;
    const originalDamage = d(8, 6);
    action.calls.push('d(8,6)');
    const appliedDamage = game.u.halfPhysicalDamage
        ? Math.trunc((originalDamage + 1) / 2) : originalDamage;
    applyHeroSpellDamage(heroAttack, appliedDamage, game);
    heroAttack.deferredGeyserSpell = false;
}
async function resumeTrappedMonster(action) {
    const game = requireInitializedGame();
    if (!action.movement?.escapingTrap)
        return;
    game._deferVisibleMonsterContact = true;
    try {
        await resumeDeferredMonsterTrap(action, game, {
            publish: plineWithContinuation,
            describeMonster: visibleMonsterSubject,
        });
    }
    finally {
        game._deferVisibleMonsterContact = false;
    }
}
async function presentMonsterHiding(action) {
    const game = requireInitializedGame();
    const { monster, movement } = action;
    const concealment = movement.hideUnder;
    if (!concealment)
        return;
    await finishMonsterHideUnder(monster, concealment, game);
    await resumeDeferredMonsterHideUnder(action, game);
    delete movement.hideUnder;
}
async function presentMonsterAttackEffects(action, game, { random = rn2, rollDice = d, rollOne = rnd } = {}) {
    const monster = action.monster;
    let movement = action.movement;
    // A special mover can attack before postmov(), then dochug() can
    // admit a fresh attack. Movement and its feedback must not replay.
    do {
        await completeMonsterOffensiveAction(action, game, random, rollDice, rollOne);
        if (movement.heroDied || game.program_state.gameover)
            return { heroDied: true };
        if (movement?.heroAttackSequence?.current) {
            let heroDied = false;
            let heroAttack = movement.heroAttackSequence.current;
            let previousHeroAttack = null;
            const paging = movement.heroAttackSequence.paging;
            while (heroAttack) {
                const publishSlotMessage = async (message, options) => {
                    const dismissal = await plineWithContinuation(message, options);
                    if (dismissal != null)
                        paging.pagerOwned = true;
                    return dismissal;
                };
                if (heroAttack.kind === 'hero-magic-ray') {
                    const result = await resolveMonsterMagicRay(monster, heroAttack.effectiveAttack, {
                        state: game, publish: publishSlotMessage, calls: action.calls,
                        die: (options) => options.damage
                            ? finishMonsterAttackDeath(monster, {
                                attribution: {
                                    kind: 'death-inflicted-by', killer: options.killer,
                                    deathCause: options.deathCause
                                        || `killed by ${withIndefiniteArticle(options.killer)}`,
                                    announcesDeath: true,
                                },
                                pagerOwned: paging.pagerOwned,
                            }) : finishHeroDeath(options),
                    });
                    heroAttack.nativeResult = result.mask;
                    if (result.heroDied)
                        return { heroDied: true };
                    previousHeroAttack = heroAttack;
                    heroAttack = await completeHeroAttackSlot(action, game, random, rollDice, rollOne);
                    continue;
                }
                if (heroAttack.kind === 'hero-explosion') {
                    const result = await resolveMonsterSelfExplosion(monster, heroAttack.effectiveAttack, {
                        foundHero: heroAttack.foundHero, state: game, publish: publishSlotMessage,
                        die: (options) => options.damage ? finishMonsterAttackDeath(monster, {
                            deathType: options.deathType ?? null,
                            attribution: {
                                kind: 'death-inflicted-by', killer: options.killer,
                                ...(options.deathCause ? { deathCause: options.deathCause } : {}),
                                killerFormat: options.killerFormat ?? KILLED_BY_AN,
                                announcesDeath: !options.deathLineShown,
                            },
                            pagerOwned: paging.pagerOwned,
                        }) : finishHeroDeath(options),
                    });
                    heroAttack.nativeResult = result.mask;
                    if (result.heroDied)
                        return { heroDied: true };
                    previousHeroAttack = heroAttack;
                    heroAttack = await completeHeroAttackSlot(action, game, random, rollDice, rollOne);
                    continue;
                }
                if (heroAttack.kind === 'hero-gaze') {
                    const result = await resolveMonsterGaze(monster, heroAttack.effectiveAttack, {
                        state: game, publish: publishSlotMessage, calls: action.calls,
                        die: (actor, options = {}) => finishMonsterAttackDeath(actor, {
                            ...options, pagerOwned: paging.pagerOwned,
                        }),
                    });
                    heroAttack.nativeResult = result.mask;
                    if (result.heroDied)
                        return { heroDied: true };
                    previousHeroAttack = heroAttack;
                    heroAttack = await completeHeroAttackSlot(action, game, random, rollDice, rollOne);
                    continue;
                }
                if (heroAttack.kind === 'hero-projectile' || heroAttack.kind === 'hero-spit') {
                    const heroDied = heroAttack.kind === 'hero-projectile'
                        ? heroAttack.projectile.heroDied : heroAttack.spit.heroDied;
                    if (heroDied)
                        return { heroDied: true };
                    previousHeroAttack = heroAttack;
                    heroAttack = await completeHeroAttackSlot(action, game, random, rollDice, rollOne);
                    continue;
                }
                if (heroAttack.kind === 'hero-breath') {
                    const breath = heroAttack.breath;
                    if (breath.cough && !heroIsDeaf(game)) {
                        if (canSeeMonster(monster))
                            await publishSlotMessage(`${monsterName(monster, { capitalized: true })} coughs.`);
                        else
                            await publishHeardMessage('a cough.', publishSlotMessage);
                    }
                    if (breath.launched) {
                        await resolveDeferredMonsterBreath(action, breath, game, publishSlotMessage);
                        if (game.program_state?.gameover)
                            return { heroDied: true };
                        if (game._occupation)
                            game._interruptedMultiActionDebt = true;
                        game._occupation = null;
                        if (game._runState)
                            stopRun(game);
                    }
                    previousHeroAttack = heroAttack;
                    heroAttack = await completeHeroAttackSlot(action, game, random, rollDice, rollOne);
                    continue;
                }
                if (heroAttack.kind === 'hero-spell') {
                    const publishSpellMessage = async (message, options) => {
                        const dismissal = await plineWithContinuation(message, options);
                        if (dismissal != null)
                            paging.pagerOwned = true;
                        return dismissal;
                    };
                    if (!heroAttack.cast) {
                        let curseMessage = null;
                        if (heroAttack.misdirected) {
                            const water = game.level.at(monster.mux ?? 0, monster.muy ?? 0)?.typ === WATER;
                            const caster = canSeeMonster(monster) ? visibleMonsterSubject(monster) : 'Something';
                            curseMessage = `${caster} casts a spell at ${water ? 'empty water' : 'thin air'}!`;
                        }
                        else if (heroAttack.fumbled && !heroIsDeaf(game)
                            && canSeeMonster(monster)) {
                            curseMessage = `The air crackles around ${monsterName(monster)}.`;
                        }
                        else if (heroAttack.curseKind === 'audible') {
                            curseMessage = 'You hear a mumbled curse.';
                        }
                        else if (heroAttack.curseKind) {
                            const caster = visibleMonsterSubject(monster);
                            curseMessage = heroAttack.curseKind
                                === 'visible-undirected'
                                ? `${caster} points all around, then curses.`
                                : heroAttack.curseKind === 'visible-general'
                                    ? `${caster} points and curses in your general direction.`
                                    : heroAttack.curseKind === 'visible-displaced'
                                        ? `${caster} points and curses at your displaced image.`
                                        : `${caster} points at you, then curses.`;
                        }
                        if (curseMessage)
                            await publishSpellMessage(curseMessage, { noRepeat: heroAttack.curseKind === 'audible' });
                        previousHeroAttack = heroAttack;
                        heroAttack = await completeHeroAttackSlot(action, game);
                        continue;
                    }
                    const caster = canSpotMonster(monster) ? visibleMonsterSubject(monster) : 'Something';
                    const casterVisible = canSpotMonster(monster);
                    if (casterVisible || heroAttack.directed) {
                        const misplaced = monster.mux !== game.u.ux || monster.muy !== game.u.uy;
                        const target = !heroAttack.directed ? ''
                            : heroIsInvisible(game) && !((MONSTER_FLAGS1[monster.mnum] ?? 0) & 0x01000000) && misplaced
                                ? ' at a spot near you'
                                : heroIsDisplaced(game) && misplaced ? ' at your displaced image' : ' at you';
                        await publishSpellMessage(`${caster} casts a spell${target}!`);
                    }
                    if (heroAttack.deferredSpellDamage)
                        rollDeferredHeroSpellDamage(action, game, rollDice);
                    await prepareMonsterSpellResistance(heroAttack, game);
                    let effectMessage = heroAttack.spellEffectMessage;
                    if (heroAttack.spell === 'cure-self'
                        && canSeeMonster(monster)) {
                        effectMessage = `${visibleMonsterSubject(monster)} looks better.`;
                    }
                    if (heroAttack.spell === 'death-touch') {
                        const pronoun = monsterSubjectPronoun(monster, { state: game });
                        effectMessage = 'Oh no, ' + pronoun
                            + "'s using the touch of death!";
                    }
                    if (heroAttack.spell === 'disappear'
                        && canSeeMonster(monster)) {
                        const seesInvisible = !!(game.u?.seeInvisible
                            || (game.u.seeInvisibleTurns !== undefined && game.u.seeInvisibleTurns > 0));
                        effectMessage = `${visibleMonsterSubject(monster)} suddenly ${seesInvisible
                            ? 'becomes transparent' : 'disappears'}!`;
                    }
                    // mcast_confuse_you() commits make_confused() before
                    // its explicit feedback pline.  If that line forces
                    // the older cast line through tty, the pager already
                    // paints Conf; other selected spell effects retain
                    // their post-message state ordering.
                    if (heroAttack.spell === 'confuse-you')
                        resumeDeferredHeroSpell(action, game);
                    const effectDismissal = effectMessage
                        ? await publishSpellMessage(effectMessage)
                        : null;
                    if (heroAttack.spell === 'confuse-you' && !game.u.antimagic)
                        monstersForgetHeroResistance(M_SEEN_MAGR, game);
                    if (heroAttack.deferredSpellEffect) {
                        if (heroAttack.spell === 'blind-you') {
                            heroAttack.deferredSpellEffect = false;
                            heroAttack.appliedDamage = 0;
                            await makeBlinded(heroHasHalfSpellDamage(game) ? 100 : 200, { state: game, talk: false, publish: publishSpellMessage });
                            if (!heroIsBlind(game))
                                await publishSpellMessage('Your vision clears.');
                        }
                        else if (heroAttack.spell)
                            resumeDeferredHeroSpell(action, game);
                        else
                            await resolveDeferredHeroDirectSpell(action, heroAttack, game, publishSpellMessage, random, rollDice);
                    }
                    if (heroAttack.deferredStrengthLoss) {
                        const { amount, killer } = heroAttack.deferredStrengthLoss;
                        delete heroAttack.deferredStrengthLoss;
                        const died = await loseHeroStrength(amount, killer, {
                            state: game,
                            publish: publishSpellMessage,
                            deathCause: `killed by ${killer}`,
                            random: range => {
                                action.calls.push(`rn2(${range})`);
                                return rn2(range);
                            },
                            die: (options) => options.killer !== killer
                                ? finishHeroDeathAfterMonsterMessage(options)
                                : finishMonsterAttackDeath(monster, {
                                    attribution: {
                                        kind: 'death-inflicted-by', killer,
                                        announcesDeath: true,
                                    },
                                    pagerOwned: paging.pagerOwned,
                                }),
                        });
                        if (died) {
                            heroDied = true;
                            break;
                        }
                        monstersForgetHeroResistance(M_SEEN_MAGR, game);
                    }
                    if (heroAttack.deferredFirePillar)
                        await resolveDeferredHeroFirePillar(action, heroAttack, publishSpellMessage);
                    if (game.program_state.gameover)
                        return { heroDied: true };
                    if (heroAttack.deferredLightningSpell)
                        await resolveDeferredHeroLightningSpell(action, heroAttack, publishSpellMessage);
                    if (game.program_state.gameover)
                        return { heroDied: true };
                    if (heroAttack.deferredInsectSpell)
                        await resolveDeferredHeroInsectSpell(action, heroAttack);
                    if (heroAttack.deferredCurseItems)
                        await resolveDeferredHeroCurseItems(heroAttack);
                    if (heroAttack.deferredSummonMonsters) {
                        const summoned = await resolveDeferredHeroSummonMonsters(action, game);
                        if (summoned?.message)
                            await publishSpellMessage(summoned.message);
                    }
                    if (heroAttack.deferredCloneWizard) {
                        await publishSpellMessage('Double Trouble...');
                        await beginDeferredHeroCloneWizard(action, game);
                        await finishDeferredHeroCloneWizard(action, game);
                    }
                    if (heroAttack.deferredHasteSelf) {
                        const haste = resolveDeferredHeroHasteSelf(action, game);
                        if (haste?.message)
                            await publishSpellMessage(haste.message);
                    }
                    if (heroAttack.deferredAggravation)
                        resolveDeferredHeroAggravation(action, game);
                    if (heroAttack.deferredDeathTouch) {
                        await resolveDeferredHeroDeathTouch(action, heroAttack, publishSpellMessage);
                        if (heroAttack.heroDied)
                            return { heroDied: true };
                    }
                    if (heroAttack.deferredDestroyArmor)
                        await resolveDeferredHeroDestroyArmor(heroAttack);
                    if (heroAttack.deferredGeyserSpell)
                        resolveDeferredHeroGeyser(action, heroAttack);
                    if (heroAttack.paralyzed)
                        stopRun(game);
                    if (heroAttack.monsterDisappeared) {
                        newsym(monster.mx, monster.my);
                        if (cansee(monster.mx, monster.my)
                            && !canSpotMonster(monster)) {
                            map_invisible(monster.mx, monster.my);
                        }
                    }
                    if (heroAttack.rehumanize) {
                        // tty urgent_pline() replaces the effect line
                        // which forced a pager when that pager was
                        // escaped, but the spell's state effect proceeds.
                        if (effectDismissal === 27) {
                            game._pending_message = '';
                            game._retained_message = '';
                        }
                        const restored = await returnHeroToHumanForm(game);
                        if (restored.died)
                            return { heroDied: true };
                        heroAttack.rehumanize = false;
                    }
                    if (heroAttack.heroDied) {
                        if (await finishMonsterAttackDeath(monster, {
                            ...(heroAttack.fatalAttribution ? { attribution: heroAttack.fatalAttribution } : {}),
                            pagerOwned: paging.pagerOwned,
                        })) {
                            heroDied = true;
                            break;
                        }
                        heroAttack.heroDied = false;
                    }
                    delete heroAttack.fatalAttribution;
                    previousHeroAttack = heroAttack;
                    heroAttack = await completeHeroAttackSlot(action, game, random, rollDice, rollOne);
                    continue;
                }
                if (heroAttack.deferredRevealUnder) {
                    const revealDismissal = await plineWithContinuation(heroAttack.revealUnderMessage ?? '');
                    newsym(monster.mx, monster.my);
                    if (revealDismissal !== null
                        && revealDismissal !== undefined) {
                        paging.pagerOwned = true;
                    }
                    heroAttack = await resumeDeferredHeroReveal(action, game);
                    if (!heroAttack)
                        break;
                }
                // Hero-command and actor-prose history do not themselves
                // decide whether tty has repainted status.  The fatal path
                // below follows C bot()'s raw-HP sentinel and concrete pager
                // boundaries instead.
                // C hitmu()/missmu() records an unseen attacker's square
                // before projecting its contact line.  Persist that marker
                // in hero memory so a pager or later blind docrt() cannot
                // erase the source of the attack.  A hidden attacker was
                // already mapped before its reveal redrew the square.
                if (!heroAttack.deferredEngulf
                    && !heroAttack.attackerMapped
                    && heroAttack.effect !== 'wild-miss'
                    && heroAttack.effect !== 'engulf-unfound'
                    && heroAttack.effect !== 'engulf-refused'
                    && heroAttack.effect !== 'failed-grab'
                    && !canSpotMonster(monster))
                    map_invisible(monster.mx, monster.my);
                const publishEquipmentMessage = async (line, options) => {
                    const dismissal = await plineWithContinuation(line, options);
                    if (dismissal != null)
                        paging.pagerOwned = true;
                    return dismissal;
                };
                if (heroAttack.hit && heroAttack.effect === 'physical-weapon'
                    && heroAttack.deferredPostHit) {
                    const artifact = await applyArtifactHit(monsterWieldedWeapon(monster), 'hero', heroAttack.damage ?? 0, {
                        state: game, attacker: monster, dieRoll: heroAttack.roll ?? 0,
                        publish: publishEquipmentMessage, random, rollOne,
                    });
                    if (artifact.heroDied)
                        return { heroDied: true };
                    heroAttack.damage = artifact.damage;
                    heroAttack.specialMessage = artifact.specialMessage;
                    if (!artifact.damage)
                        heroAttack.poison = null;
                }
                const message = await monsterAttackMessage(monster, heroAttack, previousHeroAttack, random);
                const contactDismissal = message
                    ? await plineWithContinuation(message) : undefined;
                if (contactDismissal !== null
                    && contactDismissal !== undefined) {
                    paging.pagerOwned = true;
                }
                if (heroAttack.hit && heroAttack.effect === 'physical-weapon' && heroAttack.damage) {
                    const weapon = monsterWieldedWeapon(monster);
                    if (weapon)
                        heroAttack.damage = await resolveMonsterWeaponContact(monster, weapon, heroAttack.damage ?? 0, game, publishEquipmentMessage, rollOne);
                    await erodeAttackingWeapon(game.u, weapon, {
                        publish: publishEquipmentMessage,
                    });
                }
                if (heroAttack.deferredSpecialContact)
                    await resolveMonsterContactEffect(monster, heroAttack, {
                        state: game, publish: publishEquipmentMessage, random, rollOne, rollDice,
                    });
                if (game.program_state.gameover)
                    return { heroDied: true };
                if (heroAttack.deferredStickingAfterHit)
                    resumeDeferredHeroSticking(action, game);
                if (heroAttack.stickingMessage) {
                    const stickingDismissal = await plineWithContinuation(heroAttack.stickingMessage);
                    heroAttack.stickingMessage = null;
                    if (stickingDismissal !== null
                        && stickingDismissal !== undefined) {
                        paging.pagerOwned = true;
                    }
                }
                if (heroAttack.deferredItemTheft) {
                    const theftPager = await resolveDeferredHeroItemTheft(action, monster, heroAttack, random);
                    if (game.program_state.gameover)
                        return { heroDied: true };
                    paging.pagerOwned ||= theftPager;
                    // hitmu() reaches knockback after every steal() result,
                    // including refusal and armor removal still in progress.
                    await tryKnockback(monster, game.u, heroAttack, {
                        state: game, random, hit: heroAttack.hit,
                        weaponUsed: !!monsterWieldedWeapon(monster),
                        publish: publishEquipmentMessage,
                    });
                }
                if (heroAttack.deferredEngulf) {
                    const engulf = await resumeDeferredHeroEngulf(action, game, {
                        publish: publishEquipmentMessage,
                        die: (attacker, options = {}) => finishMonsterAttackDeath(attacker, {
                            ...options,
                            pagerOwned: paging.pagerOwned,
                        }),
                        flushMessages: async () => {
                            const dismissal = await displayMessageWindow();
                            if (dismissal != null)
                                paging.pagerOwned = true;
                        },
                    });
                    if (engulf?.died || game.program_state.gameover)
                        return { heroDied: true };
                }
                if (heroAttack.deferredSlimeEffect)
                    resumeDeferredHeroSlime(action, game);
                if (heroAttack.slimeEffectMessage) {
                    const slimeDismissal = await plineWithContinuation(heroAttack.slimeEffectMessage);
                    heroAttack.slimeEffectMessage = null;
                    if (slimeDismissal !== null
                        && slimeDismissal !== undefined) {
                        paging.pagerOwned = true;
                    }
                }
                if (heroAttack.slimeStartPending)
                    finishDeferredHeroSlime(action, game);
                if (heroAttack.deferredColdNegation)
                    resumeDeferredHeroColdSpecial(action, game);
                if (heroAttack.coldEffectMessage) {
                    const coldDismissal = await plineWithContinuation(heroAttack.coldEffectMessage);
                    heroAttack.coldEffectMessage = null;
                    if (coldDismissal !== null
                        && coldDismissal !== undefined) {
                        paging.pagerOwned = true;
                    }
                }
                if (heroAttack.coldResistanceMessage) {
                    const coldResistanceDismissal = await plineWithContinuation(heroAttack.coldResistanceMessage);
                    heroAttack.coldResistanceMessage = null;
                    if (coldResistanceDismissal !== null
                        && coldResistanceDismissal !== undefined) {
                        paging.pagerOwned = true;
                    }
                }
                if (heroAttack.deferredFireNegation)
                    resumeDeferredHeroFireSpecial(action, game);
                if (heroAttack.fireEffectMessage) {
                    const fireDismissal = await plineWithContinuation(heroAttack.fireEffectMessage);
                    heroAttack.fireEffectMessage = null;
                    if (fireDismissal !== null
                        && fireDismissal !== undefined) {
                        paging.pagerOwned = true;
                    }
                }
                if (heroAttack.deferredFireRehumanize) {
                    await publishSlotMessage('You go up in flames!');
                    monstersForgetHeroResistance(M_SEEN_FIRE, game);
                    const restored = await returnHeroToHumanForm(game, {
                        publish: publishSlotMessage,
                        die: finishHeroDeathAfterMonsterMessage,
                    });
                    if (restored.died)
                        return { heroDied: true };
                    heroAttack.deferredFireRehumanize = false;
                }
                if (heroAttack.fireResistanceMessage) {
                    const resistanceDismissal = await plineWithContinuation(heroAttack.fireResistanceMessage);
                    heroAttack.fireResistanceMessage = null;
                    if (resistanceDismissal !== null
                        && resistanceDismissal !== undefined) {
                        paging.pagerOwned = true;
                    }
                }
                // mhitm_ad_fire() updates witnesses after the fire messages,
                // before inventory damage. Cancelled contact teaches nothing.
                if (heroAttack.deferredFireInventory) {
                    if (game.u.fireResistance)
                        monstersObserveHeroResistance(M_SEEN_FIRE, game);
                    else
                        monstersForgetHeroResistance(M_SEEN_FIRE, game);
                }
                if (heroAttack.deferredElectricNegation)
                    resumeDeferredHeroElectricSpecial(action, game);
                if (heroAttack.electricEffectMessage) {
                    const electricDismissal = await plineWithContinuation(heroAttack.electricEffectMessage);
                    heroAttack.electricEffectMessage = null;
                    if (electricDismissal !== null
                        && electricDismissal !== undefined) {
                        paging.pagerOwned = true;
                    }
                }
                if (heroAttack.electricResistanceMessage) {
                    const electricResistanceDismissal = await plineWithContinuation(heroAttack.electricResistanceMessage);
                    heroAttack.electricResistanceMessage = null;
                    if (electricResistanceDismissal !== null
                        && electricResistanceDismissal !== undefined) {
                        paging.pagerOwned = true;
                    }
                }
                if (heroAttack.deferredLifeDrainGate)
                    await resumeDeferredHeroLifeDrain(action, game, random, publishSlotMessage);
                if (heroAttack.deferredLifeDrain) {
                    heroAttack.deferredLifeDrain = false;
                    const died = await loseHeroExperience('life drainage', {
                        die: finishHeroDeathAfterMonsterMessage,
                        publish: async (message) => {
                            const dismissal = await plineWithContinuation(message);
                            if (dismissal !== null && dismissal !== undefined)
                                paging.pagerOwned = true;
                        },
                    });
                    if (died)
                        return { heroDied: true };
                }
                if (heroAttack.deferredStunGate)
                    resumeDeferredHeroStun(action, random);
                if (heroAttack.stunIncrement != null) {
                    const increment = heroAttack.stunIncrement;
                    heroAttack.stunIncrement = null;
                    await makeStunned((game.u.stunnedTurns ?? 0) + increment, {
                        state: game,
                        publish: async (message) => {
                            const dismissal = await plineWithContinuation(message);
                            if (dismissal !== null && dismissal !== undefined)
                                paging.pagerOwned = true;
                        },
                    });
                }
                if (heroAttack.deferredRustRehumanize) {
                    const rustFormPagerOwned = await resolveErosionFormRehumanization(heroAttack, 'You rust!');
                    paging.pagerOwned ||= rustFormPagerOwned;
                    heroAttack.deferredRustRehumanize = false;
                }
                if (heroAttack.deferredDecayRehumanize) {
                    const decayPagerOwned = await resolveErosionFormRehumanization(heroAttack, 'You rot!');
                    paging.pagerOwned ||= decayPagerOwned;
                    heroAttack.deferredDecayRehumanize = false;
                }
                const armorErosion = heroAttack.deferredRustArmor ? 'rust'
                    : heroAttack.deferredCorrosionArmor ? 'corrosion'
                        : heroAttack.deferredDecayArmor ? 'rot' : null;
                if (armorErosion) {
                    await erodeArmor(game.u, armorErosion, { publish: publishEquipmentMessage });
                    heroAttack.deferredRustArmor = false;
                    heroAttack.deferredCorrosionArmor = false;
                    heroAttack.deferredDecayArmor = false;
                    heroAttack.deferredPostHit = true;
                }
                if (heroAttack.deferredEnchantment)
                    await resumeDeferredHeroEnchantment(action, game, random);
                if (heroAttack.drainMessage) {
                    const drainDismissal = await plineWithContinuation(heroAttack.drainMessage);
                    heroAttack.drainMessage = null;
                    if (drainDismissal !== null
                        && drainDismissal !== undefined) {
                        paging.pagerOwned = true;
                    }
                }
                if (heroAttack.deferredLegEffect)
                    await resumeDeferredHeroLegs(action, game, { publish: publishEquipmentMessage });
                if (heroAttack.deferredPostHit) {
                    const publishContactMessage = async (message, options) => {
                        const dismissal = await plineWithContinuation(message, options);
                        if (dismissal !== null && dismissal !== undefined)
                            paging.pagerOwned = true;
                        return dismissal;
                    };
                    const contactOptions = {
                        random, rollDice, rollOne,
                        publish: publishContactMessage,
                        die: finishHeroDeathAfterMonsterMessage,
                    };
                    await resumeDeferredHeroContact(action, game, contactOptions);
                    if (game.program_state?.gameover)
                        return { heroDied: true };
                    if (heroAttack.deferredElementalInventory) {
                        const inventoryDamage = heroAttack.deferredElementalInventory;
                        const destroyInventory = {
                            cold: destroyColdInventory,
                            fire: destroyFireInventory,
                            electric: destroyElectricInventory,
                        }[inventoryDamage.damageType];
                        const items = await destroyInventory(inventoryDamage.sourceDamage, { state: game, ...contactOptions });
                        if (items.heroDied)
                            return { heroDied: true };
                        if (inventoryDamage.damageType === 'fire') {
                            await igniteItems(game.inventory, {
                                state: game,
                                publish: publishContactMessage,
                            });
                        }
                        heroAttack.deferredElementalInventory = null;
                        delete heroAttack.coldOriginalDamage;
                        delete heroAttack.fireOriginalDamage;
                        delete heroAttack.electricOriginalDamage;
                        const hitPoints = Upolyd(game.u) ? 'mh' : 'uhp';
                        if ((game.u?.[hitPoints] ?? 1) > 0) {
                            await resumeDeferredHeroContact(action, game, contactOptions);
                        }
                        else {
                            heroAttack.heroDied = true;
                            heroAttack.deferredPostHit = false;
                        }
                    }
                    if (game.program_state?.gameover)
                        return { heroDied: true };
                }
                if (heroAttack.deferredBlindEffect) {
                    await resumeDeferredHeroBlindness(action, game);
                }
                if (heroAttack.effectMessage) {
                    const effectDismissal = await plineWithContinuation(heroAttack.effectMessage);
                    if (effectDismissal !== null
                        && effectDismissal !== undefined) {
                        paging.pagerOwned = true;
                    }
                }
                // C hitmu()/missmu() calls stop_occupation() after the whole
                // contact transaction, including passiveum().  In
                // particular, an overflowing cold-passive line must suspend
                // before its rn2(2), assess_dmg(), death line, and the
                // occupation-stop prose.  Keep this before later attack
                // slots, but after every deferred tail owned by this slot.
                // mdamageu() reaches done_in_by() first, so a hero killed by
                // the hit never stops the occupation unless life-saved.
                const engulfAttack = heroAttack.effect === 'engulf'
                    || heroAttack.effect === 'engulf-tick'
                    || heroAttack.effect === 'engulf-refused';
                const missedContact = heroAttack.effect === 'failed-grab'
                    || heroAttack.effect === 'engulf-unfound'
                    || heroAttack.effect === 'wild-miss';
                const stopsOccupation = !engulfAttack && !missedContact && !heroAttack.contactDone;
                if ((game.u?.[Upolyd(game.u) ? 'mh' : 'uhp'] ?? 1) > 0) {
                    if (stopsOccupation)
                        await stopHeroOccupation(game);
                    previousHeroAttack = heroAttack;
                    heroAttack = await completeHeroAttackSlot(action, game, random, rollDice, rollOne);
                    continue;
                }
                if (await finishMonsterAttackDeath(monster, {
                    pagerOwned: paging.pagerOwned,
                })) {
                    heroDied = true;
                    break;
                }
                if (stopsOccupation)
                    await stopHeroOccupation(game);
                heroAttack.heroDied = false;
                previousHeroAttack = heroAttack;
                heroAttack = await completeHeroAttackSlot(action, game, random, rollDice, rollOne);
            }
            if (heroDied)
                return { heroDied: true };
        }
        if (!movement?.deferredAfterSpecialAttack || game.program_state?.gameover)
            break;
        await resumeDeferredSpecialAttack(action, game, random, rollDice, rollOne);
        movement = action.movement;
        if (await presentMonsterPostMove(action, game))
            return { heroDied: true };
        await presentMonsterPickups(action, game);
        movement = action.movement;
    } while (!game.program_state?.gameover);
    if (game.program_state?.gameover)
        return { heroDied: true };
    if (movement.deferredWormTailAttacks) {
        delete movement.deferredWormTailAttacks;
        const offensive = movement.heroAttackSequence?.offensive;
        if (movement.heroAttackResult !== 1
            && !(offensive?.status === 'completed' && offensive.result.nativeResult === 1)
            && !monster.dead && monster.mhp > 0 && monster.wormno) {
            const result = await performWormTailAttacks(monster, game, {
                random, rollDice, rollOne, calls: action.calls,
            });
            movement.heroAttackResult = result.nativeResult;
            return { heroDied: result.heroDied };
        }
    }
    return { heroDied: false };
}
// Trap, door, tunneling, and hiding feedback belongs to postmov(), before
// returning to either dochug() or the hero's out-of-sequence movement caller.
async function presentMonsterPostMove(action, game) {
    let movement = action.movement;
    // C postmov() repaints the old square before mintrap(), but delays
    // the destination newsym() until the trap's message has returned.
    // A pager on the prior topline must still show the floor object.
    // dog_move() can return MMOVE_MOVED without a step; postmov() still
    // repaints the old square and runs mintrap() there.
    const deferredTrapDestination = !!((movement?.moved
        || movement?.postMoveOldSquarePainted) && movement?.trap);
    const deferredHideUnderDestination = !!(movement?.moved
        && movement?.hideUnder?.message);
    if (movement?.moved || movement?.postMoveOldSquarePainted) {
        if (!movement.postMoveOldSquarePainted)
            newsym(movement.oldx, movement.oldy);
        if (!movement.postMoveDestinationPainted
            && !deferredTrapDestination && !deferredHideUnderDestination)
            newsym(movement.x, movement.y);
    }
    if (movement.deferredAfterMonsterTrap) {
        const event = movement.trap;
        if (!event)
            throw new Error('Deferred monster trap requires its event.');
        await resumeDeferredMonsterTrap(action, game, {
            publish: plineWithContinuation,
            describeMonster: visibleMonsterSubject,
        });
        if ('heroDied' in event && event.heroDied)
            return true;
        movement = action.movement;
    }
    if (deferredTrapDestination && !movement.postMoveDestinationPainted)
        newsym(movement.x, movement.y);
    await presentMonsterHiding(action);
    return !!game.program_state.gameover || !!movement.heroDied;
}
async function presentMonsterPickups(action, game) {
    const monster = action.monster;
    let movement = action.movement;
    if (movement?.pickedUp
        && cansee(movement.oldx, movement.oldy)) {
        observeDistantObjectForNaming(movement.pickedUp);
        const name = inventoryItemDescription(movement.pickedUp);
        if (game.flags.verbose !== false) {
            await plineWithContinuation(`${visibleMonsterSubject(monster)} picks up ${name}.`);
        }
    }
    if (movement)
        await commitPetPickup(monster, movement, game);
}
async function presentPetMovementPrelude(action, game, actorWasOpticallySeen) {
    const monster = action.monster;
    let movement = action.movement;
    if (movement?.deferredPetMove) {
        if (movement.pickedUp && cansee(movement.oldx, movement.oldy)) {
            observeDistantObjectForNaming(movement.pickedUp);
            const name = inventoryItemDescription(movement.pickedUp);
            if (game.flags.verbose !== false) {
                await plineWithContinuation(`${visibleMonsterSubject(monster)} picks up ${name}.`);
            }
        }
        await commitPetPickup(monster, movement, game);
        // dog_invent() returns to the same dog_move() transaction after
        // its pickup/drop pline.  A following visible mattackm() must
        // remain deferred too: its hit line can fill tty's topline before
        // damage, death prose, and growth RNG are committed.
        game._deferVisibleMonsterContact = true;
        try {
            await resumeDeferredPetMove(action, game);
        }
        finally {
            game._deferVisibleMonsterContact = false;
        }
        movement = action.movement;
    }
    if (movement?.deferredPetEating) {
        await resumeDeferredPetEating(action, game);
        movement = action.movement;
    }
    if (movement.deferredPetReluctance) {
        if (actorWasOpticallySeen || canSeeMonster(monster))
            await plineWithContinuation(reluctantPetMessage(monster, movement));
        await resumeDeferredPetReluctance(action, game);
    }
}
async function presentMonsterMoveMessage(action, game) {
    const movement = action.movement;
    if (movement?.message)
        await plineWithContinuation(movement.message);
}
async function presentRestrictedMonsterTeleport(action, game, actorWasOpticallySeen) {
    const monster = action.monster;
    let movement = action.movement;
    // C monmove.c:m_move() calls tele_restrict() immediately after a
    // tengu's one-in-five innate teleport probe.  The rejected probe is
    // an ordinary pline producer; retaining it here lets a later actor's
    // prose force the same tty continuation boundary.
    if (movement?.deferredAfterRestrictedTenguTeleport) {
        if (actorWasOpticallySeen) {
            await plineWithContinuation(`A mysterious force prevents ${monsterName(monster)} from teleporting!`);
        }
        await resumeDeferredRestrictedTenguTeleport(action, game);
        movement = action.movement;
    }
}
// A direct mattacku call has no movement ration, dochug prelude, or postmov
// tail. Pets targeting the hero and forced abilities share this complete path.
export async function performMonsterHeroAttack(monster, state, { random = rn2, rollDice = d, rollOne = rnd, calls = [], } = {}) {
    requireLiveGame(state);
    const previousDeferral = state._deferVisibleMonsterContact;
    state._deferVisibleMonsterContact = true;
    let action;
    try {
        action = {
            monster, calls, movement: {
                oldx: monster.mx, oldy: monster.my, x: monster.mx, y: monster.my, moved: false,
                ...await beginMonsterHeroAttack(monster, state, random, rollOne, rollDice, calls),
            },
        };
    }
    finally {
        state._deferVisibleMonsterContact = previousDeferral;
    }
    const effects = await presentMonsterAttackEffects(action, state, { random, rollDice, rollOne });
    const offensive = action.movement.heroAttackSequence?.offensive;
    const returnedDeath = action.movement.heroAttackResult === 1
        || (offensive?.status === 'completed' && offensive.result.nativeResult === 1);
    return {
        nativeResult: returnedDeath || monster.dead || monster.mhp <= 0 ? 1 : 0,
        heroDied: effects.heroDied || !!state.program_state.gameover,
    };
}
// C worm.c:wormhitu(). Visible segments are stored head-outward; native
// wtails walks toward the head and excludes its hidden dummy segment.
async function performWormTailAttacks(worm, state, options) {
    const segments = worm.wormSegments;
    if (!segments)
        throw new Error(`Worm ${worm.m_id} has no tail list.`);
    for (let index = segments.length - 1; index >= 0; index--) {
        const segment = segments[index];
        if (!segment)
            throw new Error(`Worm ${worm.m_id} has no tail segment ${index}.`);
        if (dist2(segment.x, segment.y, state.u.ux, state.u.uy) >= 3)
            continue;
        // Keep the real head position: mattacku() still uses its range and
        // apparent hero position, including after knockback or a passive.
        const result = await performMonsterHeroAttack(worm, state, options);
        if (result.nativeResult === 1 || result.heroDied)
            return result;
    }
    return { nativeResult: 0, heroDied: false };
}
// C uhitm.c:do_attack() calls m_move(monster, 0) for a leprechaun dodge.
// Resolve that movement transaction before the hero tests its new position;
// no movement ration, dochug prelude, or dochug attack tail belongs here.
export async function moveMonsterForHeroAttack(monster, state = requireInitializedGame()) {
    requireLiveGame(state);
    const wasSeen = canSeeMonster(monster);
    const previousDeferral = state._deferVisibleMonsterContact;
    state._deferVisibleMonsterContact = true;
    let action;
    try {
        action = await beginMonsterMove(monster, state);
    }
    finally {
        state._deferVisibleMonsterContact = previousDeferral;
    }
    await resumeTrappedMonster(action);
    await presentRestrictedMonsterTeleport(action, state, wasSeen);
    await presentPetMovementPrelude(action, state, wasSeen);
    let heroDied = await presentMonsterPostMove(action, state);
    if (!heroDied)
        heroDied = (await presentMonsterAttackEffects(action, state)).heroDied;
    if (!heroDied && action.movement.deferredAfterPetAttack) {
        await resumeDeferredPetAttack(action, state);
        heroDied = await presentMonsterPostMove(action, state);
    }
    if (!heroDied) {
        await presentMonsterPickups(action, state);
        await presentMonsterMoveMessage(action, state);
    }
    const status = action.movement.postMoveStatus;
    if (status === undefined)
        throw new Error('Monster movement completed without its native movement result.');
    return { status, heroDied: heroDied || !!state.program_state.gameover };
}
// Complete the same action and message phases for scheduled turns and
// direct dochug() calls. The caller owns movement rations and dochugw().
async function presentMonsterAction(action, game, actorWasOpticallySeen) {
    if (game.program_state?.gameover)
        return 'stop';
    if (game._questExpulsionPending) {
        await performQuestExpulsion(game);
        return 'stop';
    }
    if (action.conflictFight)
        return 'next-monster';
    // C dochug() returns after gelcube_digests(), before attacks or cursing.
    if (action.movement.digestedInventory)
        return 'next-monster';
    // C dochug() returns immediately when item use spends the turn.
    if (action.movement?.usedDefense)
        return 'next-monster';
    if (action.movement?.usedMisc?.kind === 'item-result'
        && action.movement.usedMisc.nativeResult !== 0)
        return 'next-monster';
    await resumeTrappedMonster(action);
    let { monster, movement } = action;
    // A fleeing teleport spends this actor's turn, even if no destination was found.
    if (movement?.fleeingRelocation || movement?.fleeingTeleportFailed)
        return 'next-monster';
    await presentRestrictedMonsterTeleport(action, game, actorWasOpticallySeen);
    movement = action.movement;
    if (movement?.deferredCovetousRelocation) {
        // tactics() has completed relocation and its input pauses.
        // Resume range checks and attacks from the new position.
        game._deferVisibleMonsterContact = true;
        try {
            await resumeDeferredCovetousRelocation(action, game);
        }
        finally {
            game._deferVisibleMonsterContact = false;
        }
        await resumeTrappedMonster(action);
        movement = action.movement;
        if (movement?.usedDefense)
            return 'next-monster';
        if (movement?.usedMisc?.kind === 'item-result'
            && movement.usedMisc.nativeResult !== 0)
            return 'next-monster';
    }
    if (movement?.spellCast?.cast) {
        // dochug() chooses the movement spell after covetous tactics,
        // so a resumed relocation can still produce this casting phase.
        if (canSpotMonster(monster)) {
            await plineWithContinuation(`${visibleMonsterSubject(monster)} casts a spell!`);
        }
        await resumeDeferredMovementSpell(action, game);
        movement = action.movement;
    }
    await presentPetMovementPrelude(action, game, actorWasOpticallySeen);
    movement = action.movement;
    if (await presentMonsterPostMove(action, game))
        return 'stop';
    movement = action.movement;
    const attackEffects = await presentMonsterAttackEffects(action, game);
    if (attackEffects.heroDied)
        return 'stop';
    movement = action.movement;
    // monmove.c:dochug() performs the vile-monster emotional attack only
    // after the complete standard attack set. Item use returns earlier,
    // including items whose effects await their messages below.
    const offensive = movement.heroAttackSequence?.offensive;
    const attackReturnedDeath = movement.heroAttackResult === 1
        || (offensive?.status === 'completed' && offensive.result.nativeResult === 1);
    if (action.dochugContext?.reachesFinalActions && !movement.usedMisc
        && !attackReturnedDeath && !monster.dead && monster.mhp > 0
        && monster.mcanmove && !monster.msleeping
        && action.dochugContext.range?.nearby)
        await talkQuestCharacter(monster, game);
    if (game._questExpulsionPending) {
        await performQuestExpulsion(game);
        return 'stop';
    }
    if (action.dochugContext?.reachesFinalActions
        && !movement.usedMisc && !attackReturnedDeath && action.dochugContext.range?.inRange
        && !monster.dead && monster.mhp > 0 && monster.mx !== 0
        && MONSTER_SOUND[monster.mnum] === 34 && !monster.mpeaceful
        && couldsee(monster.mx, monster.my) && !monster.minvis) {
        const cussGate = rn2(5);
        action.calls.push('rn2(5)');
        if (cussGate === 0)
            movement.deferredCuss = true;
    }
    if (movement?.deferredCuss) {
        movement.deferredCuss = false;
        await presentMonsterCuss(action);
    }
    if (movement?.deferredAfterPetAttack) {
        if (game.program_state?.gameover)
            return 'stop';
        await resumeDeferredPetAttack(action, game);
        await presentMonsterHiding(action);
    }
    await presentMonsterPickups(action, game);
    movement = action.movement;
    if (movement?.usedMisc?.kind === 'polymorph-trap'
        || movement?.usedMisc?.kind === 'wand-polymorph' || movement?.usedMisc?.kind === 'potion-polymorph')
        await finishDeferredMonsterMiscItem(action, game);
    if (movement?.usedMisc?.kind === 'potion-gain-level') {
        const misc = movement.usedMisc;
        const sawDrinking = await presentMonsterQuaff(monster, misc.object);
        if (sawDrinking) {
            if (misc.object.cursed) {
                const destination = monsterGainLevelRiseDestination(monster, game);
                if (destination)
                    misc.riseDestination = destination;
                await plineWithContinuation(destination
                    ? `${visibleMonsterSubject(monster)} rises up, through the ${ceilingName(monster.mx, monster.my, game)}!`
                    : `${visibleMonsterSubject(monster)} looks uneasy.`);
                await tryCallObjectType(misc.object, game);
            }
            else {
                await plineWithContinuation(`${visibleMonsterSubject(monster)} seems more experienced.`);
                learnObjectType(misc.object.otyp);
            }
        }
        if (misc.object.cursed && !sawDrinking) {
            const destination = monsterGainLevelRiseDestination(monster, game);
            if (destination)
                misc.riseDestination = destination;
        }
        await finishDeferredMonsterMiscItem(action, game);
        await presentMonsterGrowth(monster, misc.growth);
        movement = action.movement;
    }
    if (movement?.usedMisc?.kind === 'potion-invisibility' || movement?.usedMisc?.kind === 'wand-invisibility') {
        const misc = movement.usedMisc;
        let sawDrinking;
        if (misc.kind === 'wand-invisibility') {
            sawDrinking = canSeeMonster(monster);
            await presentMonsterWandUse(monster, misc.object, { state: game, self: true });
        }
        else
            sawDrinking = await presentMonsterQuaff(monster, misc.object);
        const nameBeforeInvisibility = monsterName(monster, { state: game });
        await finishDeferredMonsterMiscItem(action, game);
        newsym(monster.mx, monster.my);
        const stillSeen = canSpotMonster(monster);
        if (sawDrinking && monster.minvis) {
            if (stillSeen) {
                await plineWithContinuation(`${possessiveName(nameBeforeInvisibility).replace(/^./, letter => letter.toUpperCase())} body takes on a ${heroIsHallucinating(game) ? 'normal' : 'strange'} transparency.`);
            }
            else {
                await plineWithContinuation(`Suddenly you cannot see ${nameBeforeInvisibility}.`);
                if (cansee(monster.mx, monster.my))
                    map_invisible(monster.mx, monster.my);
            }
            learnObjectType(misc.object.otyp);
        }
        else if (sawDrinking && !monster.minvis) {
            await plineWithContinuation(`${visibleMonsterSubject(monster)} briefly seems to be transparent.`);
        }
        if (misc.kind === 'potion-invisibility') {
            if (misc.object.cursed)
                await revealAggravatingMonster(monster, game);
            await consumeMonsterItem(monster, misc.object, game);
        }
    }
    if (movement?.usedMisc?.kind === 'bullwhip-disarm') {
        await finishDeferredMonsterMiscItem(action, game);
        if (game.program_state.gameover)
            return 'stop';
    }
    if (movement?.usedMisc?.kind === 'potion-speed' || movement?.usedMisc?.kind === 'wand-speed-monster') {
        const misc = movement.usedMisc;
        const seen = canSeeMonster(monster);
        if (misc.kind === 'wand-speed-monster')
            await presentMonsterWandUse(monster, misc.object, { state: game, self: true });
        else
            await presentMonsterQuaff(monster, misc.object);
        await finishDeferredMonsterMiscItem(action, game);
        if (seen && misc.speedChanged) {
            await plineWithContinuation(`${visibleMonsterSubject(monster)} is suddenly moving ${misc.speedMuch ? 'much ' : ''}faster.`);
            learnWand(misc.object, { state: game });
        }
        if (misc.kind === 'potion-speed')
            await consumeMonsterItem(monster, misc.object, game);
    }
    await presentMonsterMoveMessage(action, game);
    return 'check-occupation';
}
// C monmove.c:dochug(). Shop entry gives its keeper an immediate action,
// including resumed messages and attacks, without movemon()'s per-turn work.
export async function performMonsterTurn(monster, state = requireInitializedGame()) {
    const wasSeen = canSeeMonster(monster);
    const previousDeferral = state._deferVisibleMonsterContact;
    try {
        state._deferVisibleMonsterContact = true;
        const action = await beginMonsterDochug(monster, state);
        state._deferVisibleMonsterContact = false;
        await presentMonsterAction(action, state, wasSeen);
    }
    finally {
        state._deferVisibleMonsterContact = previousDeferral;
    }
}
async function executeMonsterTurns() {
    const game = requireInitializedGame();
    const level = game.level;
    let somebodyCanMove = false;
    // C iter_mons_safe() snapshots identities, not their remaining movement.
    for (const actor of monstersInFmonOrder(level.monsters)) {
        if (game.level !== level || game.program_state?.gameover)
            return false;
        if (game.u.utotype) {
            somebodyCanMove = false;
            break;
        }
        if (!level.monsters.includes(actor))
            continue;
        // C movemon_singlemon(): parked guards keep removing their corridor
        // once per world turn, even after death or completion of the escort.
        if (actor.isgd && !actor.mx && (actor.mstate ?? MON_FLOOR) === MON_FLOOR) {
            if (game.moves > (actor.mlstmv ?? 0)) {
                await moveVaultGuard(actor, game, rn2);
                actor.mlstmv = game.moves;
            }
            continue;
        }
        if ((actor.mhp ?? 1) <= 0 || actor.mx === 0
            || (actor.mstate ?? MON_FLOOR) !== MON_FLOOR)
            continue;
        await runMonsterEveryturnEffects([actor], game, rn2, { fmonOrdered: true });
        if (actor.movement === undefined)
            throw new Error(`Monster ${actor.m_id} entered a turn before movement initialization.`);
        if (actor.movement < NORMAL_SPEED)
            continue;
        actor.movement -= NORMAL_SPEED;
        if (actor.movement >= NORMAL_SPEED)
            somebodyCanMove = true;
        // C mon.c:movemon_singlemon() settles deferred visibility before the
        // actor's liquid checks, equipment changes, and movement decisions.
        if (game.vision_full_recalc)
            vision_recalc(0);
        if (game.context.bypasses)
            clearBypasses(game);
        const actorWasOpticallySeen = canSeeMonster(actor);
        const liquid = await resolveMonsterLiquid(actor, game, {
            announce: plineWithContinuation,
            finishDeath: finishMonsterLiquidDeath,
        });
        if (liquid?.dead)
            continue;
        const equipment = await reassessMonsterArmor(actor, game, { publish: plineWithContinuation });
        const sightingBefore = monsterSightingBeforeAction(actor, game);
        game._deferVisibleMonsterContact = true;
        let action;
        try {
            action = equipment?.consumed ? {
                monster: actor, calls: [],
                movement: {
                    oldx: actor.mx, oldy: actor.my, x: actor.mx, y: actor.my,
                    moved: false, equipment,
                },
            } : await runMonsterAction(actor, game);
        }
        finally {
            game._deferVisibleMonsterContact = false;
        }
        const presented = await presentMonsterAction(action, game, actorWasOpticallySeen);
        if (presented === 'stop')
            return false;
        if (presented === 'next-monster')
            continue;
        if (action.conflictFight)
            continue;
        const { monster, movement } = action;
        const offensive = movement.heroAttackSequence?.offensive;
        const attackReturnedDeath = movement.heroAttackResult === 1
            || (offensive?.status === 'completed' && offensive.result.nativeResult === 1);
        // C monmove.c:dochugw() checks the actor after dochug(), before the
        // adjacent monster_nearby() check at the occupation boundary.
        if (!attackReturnedDeath && (monster.mhp ?? 1) > 0)
            await interruptOccupationForMonster(monster, game, sightingBefore);
        if (!movement?.moved)
            continue;
    }
    return game.level === level && somebodyCanMove;
}
async function moveMonsters() {
    const game = requireInitializedGame();
    const level = game.level;
    const previousMonsterMoving = game.context.mon_moving;
    game.context.mon_moving = true;
    try {
        const somebodyCanMove = await executeMonsterTurns();
        // C mon.c:movemon() refreshes moving light sources after the pass.
        if (hasLightSources())
            game.vision_full_recalc = 1;
        if (game.context.bypasses)
            clearBypasses(game);
        purgeDeadMonsters(level);
        // A monster's action can schedule travel, including removal of
        // levitation gear above a trap. Finish it before world maintenance
        // or command input; the departure monsters are now dormant.
        if (game._scheduledLevelChange) {
            await finishScheduledLevelChange();
            return false;
        }
        return somebodyCanMove;
    }
    finally {
        game.context.mon_moving = previousMonsterMoving;
    }
}
// C ref: allmain.c newgame()
export async function newgame() {
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
    await plineWithContinuation(welcomeText());
    // welcome(TRUE) records entry after its greeting has finished.
    recordGameLogEvent(initialDungeonEntryText(g), { state: g, turn: 1 });
    if (g.flags?.explore)
        await plineWithContinuation('You are in non-scoring explore/discovery mode.');
}
// C ref: allmain.c moveloop_core()
export async function moveloop_core() {
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
        await reportHeroEncumbrance(g);
        for (;;) {
            const somebodyCanMove = await moveMonsters();
            if (g.program_state?.gameover)
                return;
            if (!somebodyCanMove && g.u.umovement < NORMAL_SPEED) {
                await advanceWorldTurn();
                if (g.program_state?.gameover)
                    return;
                // Native encumber_msg() starts each further world round.
                // Timers can remove weight while the hero is still too slow
                // to act; acknowledge that relief before monsters act again.
                if (g.u.umovement < NORMAL_SPEED)
                    await reportHeroEncumbrance(g);
            }
            if (g.u.umovement < NORMAL_SPEED)
                continue;
            if (!g._interruptedMultiActionDebt)
                break;
            g._interruptedMultiActionDebt = false;
            g.u.umovement -= NORMAL_SPEED;
        }
        g._heroTimePending = false;
        g._heroActionSeq = (g._heroActionSeq ?? 0) + 1;
        // C moveloop_core() checks again after nh_timeout() can remove weight.
        await reportHeroEncumbrance(g);
        if (!g.program_state?.gameover)
            await finishOrDeferHeroTookTime(g.moves || 1);
    }
    if (movementRationActionPending && !g.program_state?.gameover) {
        await settleHeroLiquidAfterAction();
        if (g.program_state?.gameover)
            return;
    }
    // allmain.c's once-per-player-input Amulet check follows all elapsed
    // monster/global work and precedes find_ac()/vision/input.  A level
    // teleport can finish several arrival pagers before returning here; the
    // wish then begins without consuming a new hero action.
    await grantAmuletWish();
    // C allmain.c:find_ac() is a once-per-player-input operation after all
    // monster/global time caused by the command.  Armor is already present
    // in the worn slot. A spare movement ration reaches this boundary even
    // before a world turn elapses, so the next dressing action uses the new AC.
    if (g._armorClassDirty && !g._heroTimePending) {
        findArmorClass(g);
        g._armorClassDirty = false;
    }
    if (currentMulti(g) < 0 && pendingArmorAction(g)) {
        // A delayed action spends movement without reading another command.
        g.u.umoved = false;
        g.context.move = 1;
        g.u.umovement = (g.u.umovement ?? 12) - 12;
        g._heroTimePending = true;
        return;
    }
    if (g._vaultGuardArrivalPending) {
        await continueVaultGuardArrival(g);
        const continuation = g._vaultMaintenanceContinuation;
        if (continuation) {
            await finishInitialTurnMaintenanceRng(continuation.sourceTurn);
            g._vaultMaintenanceContinuation = null;
            if (g._vaultHeroTookTimePending != null) {
                await finishHeroTookTime(g._vaultHeroTookTimePending);
                g._vaultHeroTookTimePending = null;
            }
        }
    }
    // Vision + display
    // C allmain.c refreshes the stationary input overlays before committing
    // a delayed vision transaction.  Hero movement can both move actors
    // across warning boundaries and leave vision_full_recalc set, so this
    // source order is display-RNG-visible under Hallucination.
    const hallucinatingNow = heroIsHallucinating(g);
    if (!g.context?.mv) {
        // The see_* calls remain in place while swallowed (newsym suppresses
        // them), then swallowed(0) refreshes the eight-cell stomach projection
        // from the same display RNG stream.
        if (hallucinatingNow) {
            await see_monsters();
            see_objects();
            see_traps();
            if (g.u?.uswallow)
                swallowed(false);
        }
        else if (g.u?.warning
            || (g.u?.unblind_telepat_range ?? -1) >= 0
            || g.level?.regions?.some(region => region.visible
                && region.ttl !== -2)) {
            await see_monsters();
        }
    }
    if (g.vision_full_recalc) {
        vision_recalc(0);
        g.vision_full_recalc = 0;
    }
    // C runs bot() or timebot() here and then curs_on_u(), whose
    // flush_screen() draws the buffered map, only when the status changed.
    // A helpless hero gets no rhack() input flush, so without a status
    // change a --More-- in the next monster phase still shows the older map.
    if (currentMulti(g) >= 0 || g.context.botl || g.context.time_botl)
        await flush_screen(1);
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
        const countedMultiActive = g.multi > 0;
        await captureRunmodeDelay(g, countedMultiActive);
        return;
    }
    // C resumes a Shift-direction run here, after the elapsed action's
    // monster/global maintenance and before asking for another key.  A
    // successful automatic square is another timed hero action; an obstacle
    // cancels the run and the following core invocation returns to input.
    if (g.multi > 0 && g._runState) {
        g.u.umoved = false;
        const moved = await continueRun(g);
        if (g.program_state.gameover)
            return;
        await finishScheduledLevelChange();
        if (g.program_state.gameover)
            return;
        if (g.vision_full_recalc)
            vision_recalc(0);
        if (moved) {
            g.u.umovement = (g.u.umovement ?? 12) - 12;
            g._heroTimePending = true;
        }
        if (moved)
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
        vision_recalc(0);
    // Advance turn
    if (g.context?.move) {
        g.u.umovement = (g.u.umovement ?? 12) - 12;
        g._heroTimePending = true;
    }
    await currentLuaLifecycle().runCallbacks(g, 'end_turn');
}
// C ref: allmain.c moveloop()
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
//# sourceMappingURL=allmain.js.map