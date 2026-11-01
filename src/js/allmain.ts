import type { ArmorCompletion } from './command_types.js';
import { publishHeardMessage } from './hero_speech.js';
import { dungeonBuildsUp, initOverviewRecord } from './dungeon.js';
import {
    noticeAllMonsters, withMonsterNoticesBlocked, applyHeroLiquidEffects, continueRun, sinkHeroIntoLava,
} from './hack.js';
import { dolookaround } from './lookaround.js';
import { recorderLocalDate, recorderLocalEpochSeconds } from './calendar.js';
import type { MessagePublisher } from './pline.js';
import { heroLegName } from './body_parts.js';
import { doStorms } from './storms.js';
import {
    rewindEngravingsForSave, engravingAt, wipeEngravingAt, readEngravingAt, wipeHeroEngraving,
} from './engrave.js';
import {
    angerMonster, finishEnvironmentalMonsterDeath, finishMonsterHideUnder, finishMonsterKilled,
    finishMonsterLiquidDeath, mcalcmove, purgeDeadMonsters, restoreMonsterShape, seeNearbyMonsters,
    allocateMonsterMovement, monsterDistressEvents, monstersInFmonOrder, moveMonsters, resolveMonsterLiquid,
} from './mon.js';
// allmain.js — Main game loop.
// C ref: allmain.c — newgame, moveloop, moveloop_core.
import { heroIsHallucinating, heroIsBlind, heroIsDeaf, syncBlindness } from './senses.js';
import { learnWand } from './wand_charge.js';
import { flashBurn, makeBlinded } from './sight_change.js';
import { makeStunned } from './hero_mental_status.js';
import { heroHasHalfSpellDamage } from './spell_damage.js';
import { finishMealMimicry } from './meal_mimic.js';
import { finishHeroDigestion } from './hero_combat_engulf.js';
import { game, requireGameLevel, requireInitializedGame, requireGameDisplay, requireLiveGame } from './gstate.js';
import type { GameState, PlayingGameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { Monster, MonsterPopulationState } from './monster_types.js';
import { isRoom } from './map_types.js';
import type { Position, Trap } from './map_types.js';
import type {
    HeroAttack, HeroAttackSequence, HeroAttackSlot, HeroContactAttack, HeroSpellAttack, MonsterAction,
    MonsterMovement, MonsterMovementAction, MonsterCallLog, RandomBelow, RollDice, RollOne,
} from './monster_action_types.js';
import { clearBypasses } from './object_bypass.js';
import { clearSplitObjects } from './object_stack.js';
import {
    A_CURRENT, A_ORIGINAL, ESCAPED, G_NOCORPSE, In_endgame, In_hell, MON_FLOOR, PICK_ONE, PLNMSG_MON_TAKES_OFF_ITEM,
    RLOC_NOMSG, WATER, RLOC_MSG, LOST_STOLEN, MMOVE_DIED, NORMAL_SPEED, A_CHA, A_CON, A_DEX, A_INT, A_STR, A_WIS,
    COLNO, ROWNO, DOOR, D_CLOSED, D_LOCKED, HOLE, M_SEEN_ELEC, M_SEEN_FIRE, M_SEEN_MAGR, M_SEEN_REFL, STONE,
    ZAP_POS, M_ATTK_AGR_DIED, M_ATTK_AGR_DONE, W_ARMG, UNENCUMBERED, MOD_ENCUMBER, HVY_ENCUMBER, EXT_ENCUMBER,
    W_ACCESSORY, W_ARMOR, W_WEAPONS, ismnum, Upolyd, Is_airlevel, Is_waterlevel, LUCKMIN, LUCKMAX, TT_BURIEDBALL,
    TT_LAVA, KILLED_BY_AN,
} from './const.js';
import { mapVicinity } from './magic_mapping.js';
import { showInventoryWindow } from './windows.js';
import type { InventoryMenuItem } from './windows.js';
import {
    clearCannedCommands, endVoluntaryMultiTurn, heroHasInvoluntaryDelay, nomul, currentMulti, pendingArmorAction,
    setMulti,
} from './command_state.js';
import { dosounds, sessionIsNight } from './ambient_sounds.js';
import { warnWithMasterKey } from './artifact_warning.js';
import { regenerateHeroHp } from './hero_regeneration.js';
import { overexertHeroHp } from './hero_overexertion.js';
import { ceilingName } from './terrain_name.js';
import { tryCallObjectType } from './object_call.js';
import { consumeMonsterItem, resolveDeferredMonsterBreath } from './mthrowu.js';
import {
    heroCanTeleport, moveMonsterNextToHero, randomMonsterRelocation, teleportHero, askTeleportDestination,
} from './teleport.js';
import { runDueTimers } from './timer_effects.js';
import { finishInUseInventory } from './object_cleanup.js';
import { askKeepRestoredSave, restoreMonsterCover } from './save.js';
import { placeHeroAtRandomArrival, finishScheduledLevelChange } from './level_change.js';
import { monsterName } from './do_name.js';
import { possessiveName, dist2, dungeonDepth } from './hacklib.js';
import {
    monsterSubjectPronoun, monstersForgetHeroResistance, monstersObserveHeroResistance, seenResistanceForDamage,
    monsterLocomotion,
} from './mondata.js';
import { resolveMonsterWeaponContact, tryKnockback, resolveMonsterContactEffect } from './uhitm.js';
import { applyArtifactHit } from './artifact_hit.js';
import {
    MONSTER_GENO, monsterIsAnimal, MONSTER_ATTACKS, MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_LEVEL, MONSTER_MOVE,
    MONSTER_NAME, MONSTER_SOUND, MONSTER_SYMBOL, monsterIsNonliving, monsterTypeName,
} from './monster_data.js';
import { monsterAtPosition } from './steed.js';
import {
    finishHeroDeathAfterMonsterMessage, finishMonsterAttackDeath, waitForCurrentMonsterMore, finishHeroDeath,
} from './end.js';
import { monsterCanCarryObject } from './mon.js';
import { releaseObjectLeash, checkHeroLeashes } from './leash_apply.js';
import { touchPetrifies } from './stoning.js';
import {
    armorSimpleName, heroHasFreeAction, heroIsDisplaced, stopDonning, applyArmorOnEffects,
    applyStartingArmorEffects, armorOnIdentifiesType, findArmorClass, erodeWornArmor,
} from './armor.js';
import { isBeingTakenOff } from './takeoff_state.js';
import {
    OBJECT_DELAY, ACID_VENOM, BOULDER, CORPSE, LEASH, GOLD_PIECE, OBJECT_BIMANUAL, OBJECT_NAMES,
} from './object_data.js';
import { heroIsUnaware } from './hero_sleep.js';
import { heroSpecies, setHeroSpecies } from './hero_species.js';
import { heroHasConflict } from './hero_conflict.js';
import { openHoldingTrap } from './trap_magic.js';
import {
    AD_COLD, AD_DGST, AD_DRST, AD_FIRE, AD_MAGM, AD_SEDU, AD_SITM, AD_SSEX, AD_STCK,
} from './monster_attack_types.js';
import type { MonsterAttackDeathOptions, FinishHeroDeathOptions } from './end.js';
import { findArtifact } from './artifacts.js';
import {
    observeBucForNaming, observeObject, recordObjectEncounter, recordObjectKnowledge, learnObjectType,
} from './object_knowledge.js';
import { loseHeroExperience } from './exper.js';
import {
    makeMonsterFlee, interruptOccupationForMonster, monsterSightingBeforeAction,
    completeMonsterOffensiveAction, heroEveryturnEffect, runMonsterEveryturnEffects, beginMonsterMove,
    beginMonsterDochug, runMonsterAction,
} from './monmove.js';
import { stopHeroOccupation } from './occupation.js';
import { removeWornHeroItem } from './hero_equipment.js';
import { isWeldedPrimary } from './weapon_slots.js';
import { unlinkObject } from './object_location.js';
import { finishInventoryRemoval } from './hero_inventory.js';
import { reassessMonsterArmor } from './monworn.js';
import { currentLuaLifecycle } from './lua/lifecycle.js';
import { d, rn2, rnd } from './rng.js';
import { recordRandom } from './monster_action_types.js';
import { mklev, l_nhcore_init, u_on_upstairs } from './mklev.js';
import { makemonAt, finishMonsterGrowth } from './makemon.js';
import { continueCountedCommand, getLine, promptYesNo, rhack } from './cmd.js';
import { finishArmorRemoval } from './do_wear.js';
import { clearRepeatCommand } from './command_repeat.js';
import { finishDestinationSpotEffects } from './location_effects.js';
import { performQuestExpulsion, ensureQuestStatus, talkQuestCharacter } from './quest.js';
import { amuletTurn, intervene, monsterCarriesAmulet, publishMonsterCuss } from './wizard.js';
import { finishHeroLiquidMonsterDeath, finishHeroMonsterKill } from './hero_monster_death.js';
import { grantAmuletWish } from './wish.js';
import {
    checkAttributeExercise, currentAttribute, exerciseAttribute, exerciseWisdom, loseHeroStrength,
} from './attrib.js';
import { reportHeroEncumbrance } from './encumbrance.js';
import { rndcurse } from './throne.js';
import { stopRun, captureRunmodeDelay, isTeleportRunmode } from './runmode.js';
import { resolveMonsterGaze } from './mhitu.js';
import { bot, statusEvalNextUnhilite, updateStatusLines } from './botl.js';
import {
    canSpotMonster, docrt, redrawMap, flush_screen, newsym, map_invisible, randomDisplayMonsterName, see_monsters,
    see_objects, see_traps, show_glyph_cell, swallowed, under_ground, under_water, canSeeMonster, monsterVisible,
    shieldeff,
} from './display.js';
import {
    clearMessageWindow, displayMessageWindow, flushPendingTopline, rememberToplines, appendSuppressedTopline,
    resetToplineClip,
} from './tty_topline.js';
import { pline, plineWithContinuation } from './pline.js';
import {
    cansee, couldsee, vision_note_blocker_change, vision_recalc, vision_reset_new_level, hasLightSources,
} from './vision.js';
import { nhgetch } from './input.js';
import { NO_COLOR, CLR_BRIGHT_BLUE } from './terminal.js';
import { verbForSubject, withIndefiniteArticle } from './object_grammar.js';
import { monsterFliesOrFloats } from './terrain_properties.js';
import { observeDistantObjectForNaming, observeObjectForNaming, ownedObjectName } from './objnam.js';
import { uInitMisc, makedog, uInitInventoryAttrs, finishStartingDiscoveries } from './u_init.js';
import { heroIsInvisible } from './hero_invisibility.js';
import { igniteItems } from './light.js';
import { applyRayFloorFeatures, destroyColdInventory, destroyElectricInventory, destroyFireInventory } from './zap.js';
import { discoverHeroReflectionSource, heroReflectionSource } from './ray.js';
import { addObjectToMonsterInventory, finishDelayedArmorTheft } from './steal.js';
import { aligns, nativeRoleAt } from './roles.js';
import { initializeSourceStartup } from './startup.js';
import { LL_ACHIEVE, recordGameLogEvent } from './gamelog.js';
import { feelingAfterSelfGenocide, heroHasBeenGenocided } from './hero_genocide.js';
import {
    completeHeroAttackSlot, beginMonsterHeroAttack, monsterMissMessage, resolveMonsterSelfExplosion,
} from './mhitu.js';
import {
    finishDeferredMonsterMiscItem, monsterGainLevelRiseDestination, presentMonsterQuaff as publishMonsterQuaff,
    presentMonsterWandUse, revealAggravatingMonster,
} from './muse.js';
import { fumaroles } from './mkmaze.js';
import { petrifyMonsterImmediately, resumeDeferredMonsterTrap, burnHeroArmorByFire } from './trap.js';
import { commitPetPickup } from './dogmove.js';
import { erodeArmor, erodeAttackingWeapon } from './object_erosion.js';
import { monsterWieldedWeapon } from './weapon.js';
import { wakeMonstersNearWithMessages } from './mon.js';
import { applyHeroWereChange, presentWereChange } from './were.js';
import { reportMonsterTeleportRestriction } from './teleport_rules.js';
import { heroHasOlfaction, heroIsUnchanging, polymorphHero, returnHeroToHumanForm } from './polyself.js';
import { clearHeroSliming } from './slime.js';
import { initTrack, setTrack } from './track.js';
import { autopickupAtHero } from './pickup.js';
import { clearJustPicked } from './just_picked.js';
import { nearCapacity } from './weight.js';
import { runLevelRegions } from './regions.js';
import { invault, moveVaultGuard } from './vault.js';
import { automaticSearch, revealWarnedMonsters } from './detect.js';
import { activateStatueTrapAt } from './statue_trap.js';
import { finishPrayerOccupation } from './pray.js';
import { getHungry, recoverHeroFromFainting, regainHearingAfterHelplessness } from './hunger.js';
import { monsterAlignmentType } from './priest.js';
import { moveElementalBubbles } from './elemental.js';
import { removeObjectAndContentsFromBill, checkSpecialRoom, currentShopResident, fixShopDamage } from './shk.js';
import { inventoryItemDescription, rerollMenu } from './invent.js';
import {
    hasCarriedProperty, hasIntrinsicProperty, hasInvokedProperty, hasPermanentIntrinsicProperty, hasWornProperty,
    propertyIsActive, propertyTimeout, propertyIsBlocked, refreshProperty, setPropertyTimeout,
} from './properties.js';
import { heroHasSlipperyHands, slipFromSlipperyHands } from './slippery_hands.js';
import { nhTimeout } from './timeout.js';
import type { MonsterGrowth } from './makemon.js';

interface TurnMaintenance {
    sourceTurn: number;
    readonly capacity: number;
}

type CompletedMaintenance = { kind: 'complete' };
type MaintenancePhase =
    | CompletedMaintenance
    | (TurnMaintenance & { kind: 'regions' })
    | (TurnMaintenance & Position & { kind: 'statue-trap' });

function putLine(col: number, row: number, text: string, attr = 0): void {
    const game = requireInitializedGame();
    const display = requireGameDisplay(game);
    for (let i = 0; i < text.length && col + i < display.cols; i++)
        display.setCell(col + i, row, text.charAt(i), NO_COLOR, attr);
}

// C ref: com_pager("legacy") and dat/quest.lua.  The role-independent
// creation story is laid out by the tty pager; role, rank, and god are live.
async function showLegacy(): Promise<void> {
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
    const closingLines: readonly [string, string, string, string, string] = pauper ? [
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
    ] as const;
    const innerLines = [
        'After the Creation, the cruel god Moloch rebelled',
        'against the authority of Marduk the Creator.',
        'Moloch stole from Marduk the most powerful of all',
        'the artifacts of the gods, the Amulet of Yendor,',
        'and he hid it in the dark cavities of Gehennom, the',
        'Under World, where he now lurks, and bides his time.',
    ];
    const width = Math.max(...outerLines.map(line => line.length),
        ...innerLines.map(line => line.length + 4));
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
// share the hero's innate identity even while another body is active.
export async function welcome(newGame: boolean): Promise<void> {
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
    const identity: string[] = [];
    if (newGame || currentAlignment !== g.u.ualignbase[A_ORIGINAL] || adrift) {
        const alignment = adrift ? g.u.ualign.type : currentAlignment;
        if (adrift) identity.push('adrift');
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
    const annotation = g._levelAnnotations?.get(`${g.u.uz.dnum}:${g.u.uz.dlevel}`);
    if (annotation) await plineWithContinuation(`You remember this level as ${annotation}.`);
}

async function showInlineMore(message: string): Promise<void> {
    await plineWithContinuation(message);
    await flushPendingTopline();
}

// C ref: calendar.c phase_of_the_moon(), friday_13th(), both from getlt().
export function fixedCalendar(datetime?: string | null) {
    const date = recorderLocalDate(datetime);
    if (!date) return { moonphase: null, friday13: false };
    const { year, month, day, weekday } = date;
    const diy = Math.floor((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 1)) / 86400000);
    const goldn = ((year - 1900) % 19) + 1;
    let epact = (11 * goldn + 18) % 30;
    if ((epact === 25 && goldn > 11) || epact === 24) epact++;
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
    } else if (calendar.moonphase === 0) {
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
            if (game.program_state.gameover) return;
        }
        game.program_state.in_getlev = false;
        await finishInUseInventory(false);
        // C dorecover() rebuilds vision, then expires timers while map and
        // status output are still suppressed by program_state.restoring.
        vision_reset_new_level();
        game.vision_full_recalc = 1;
        await runDueTimers();
        if (game.program_state.gameover) return;
    } finally {
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

// C options.c:ask_do_tutorial(). Empty acceptance rebuilds the menu with
// an explanation; a selected answer or Escape ends the question.
async function askTutorial(): Promise<boolean> {
    let pass = 0;
    for (;;) {
        const items: InventoryMenuItem[] = [
            { key: 'y', text: 'Yes, do a tutorial' },
            { key: 'n', text: 'No, just start play' },
            { text: '' },
            { text: 'Put "OPTIONS=!tutorial" in .nethackrc to skip this query.' },
        ];
        if (pass++) items.push({ text: "(Please choose 'y' or 'n'.)" });
        const answer = await showInventoryWindow([{ items }], {
            title: 'Do you want a tutorial?', pickMode: PICK_ONE,
        });
        if (answer.key === 0) continue;
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
    if (!target) return false;

    const oldLevel = game.level;
    const oldStairs = game.stairs;
    const oldDepth = { ...(game.u?.uz || {}) };
    const oldPosition = {
        x: game.u.ux, y: game.u.uy,
        x0: game.u.ux0, y0: game.u.uy0,
    };
    if (!game._levelCache) game._levelCache = new Map();
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
    await vision_recalc(0);
    await docrt();
    findArmorClass(game);
    await redrawMap();
    await flush_screen(1);
    return true;
}

async function moveloopPreamble() {
    const game = requireInitializedGame();
    if (game._moveloopStarted) return;
    await applyCalendarMessages();

    game.program_state.beyond_savefile_load = 1;
    game.rndencode = rnd(9000);
    await applyStartingArmorEffects();
    if (game.program_state.gameover) return;
    clearJustPicked(game);
    await autopickupAtHero();
    if (game.program_state.gameover) return;
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
        if (doTutorial) await enterTutorial();
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
    // moveloop_preamble() sets botlx after assigning the gold encoding.
    game.context.botl = true;
    await reportHeroEncumbrance();
    if (game._deferSeeMonsters) {
        game._deferSeeMonsters = false;
        await see_monsters();
    }
    game.u.uz0 ||= { ...game.u.uz };
    game.u.uz0.dlevel = game.u.uz.dlevel;
    game.context.move = 0;
    game._moveloopStarted = true;
}

// C ref: allmain.c:interrupt_multi().  Count-prefixed ordinary commands use
// positive `multi`; full HP or power recovery cancels that voluntary repeat,
// but must not stop independent occupations such as eating, lock-picking, or
// spellbook study.  This port represents both kinds in `_occupation`, so keep
// the distinction at the interruption boundary.
async function interruptCountedActivity(message: string): Promise<void> {
    const game = requireInitializedGame();
    if (!(game.multi > 0) || game.context.travel || game.context.run) return;
    endVoluntaryMultiTurn(game);
    if (game.flags?.verbose !== false && game._lastPlineMessage !== message) {
        await plineWithContinuation(message);
    }
}

// C ref: allmain.c's `once-per-hero-took-time` tail, after the movement-ration
// loop has allocated as many global turns as the hero needs.  Burden can make
// one action span two allocations; seer_turn is checked only after the last
// one, against the final `moves` value.
async function finishHeroTookTime(sourceTurn: number): Promise<void> {
    const game = requireInitializedGame();
    statusEvalNextUnhilite();
    if (sourceTurn >= (game.seer_turn ?? Infinity)) {
        if ((game.u.uhave.amulet || propertyIsActive('clairvoyant', game))
            && !In_endgame(game.u.uz) && !propertyIsBlocked('clairvoyant', game))
            await mapVicinity(null, { state: game });
        game.seer_turn = sourceTurn + 15 + rn2(31);
    }
}

async function finishInitialTurnMaintenanceAfterIntervention(
    sourceTurn: number,
): Promise<void> {
    const game = requireInitializedGame();
    // allmain.c's environmental owner runs after engraving wear. Air and
    // Water share the moving bubble list created by fixup_special(); Fire
    // reuses the same fumarole sampler as initial arrival.
    if (Is_airlevel(game.u?.uz) || Is_waterlevel(game.u?.uz))
        await moveElementalBubbles();
    else if (game.level?.flags?.fumaroles) await fumaroles(game);
    // C allmain.c:379-388, still inside the once-per-turn block: an immobile
    // hero's delay output runs before the counter moves, so the animation
    // frames still see the helpless condition in the status line.  Reaching
    // zero calls unmul() and, when that scheduled travel, deferred_goto().
    if (currentMulti(game) < 0) {
        // Dressing retains its physical topline through each negative-multi
        // frame; its armor effects still wait for unmul's recovery message.
        const delayedAction = pendingArmorAction(game);
        if (delayedAction) {
            if (game._pending_message) {
                delete delayedAction._runmodeRetainedTopline;
            } else if (!delayedAction._runmodeRetainedTopline) {
                delayedAction._runmodeRetainedTopline
                    = game.nhDisplay?.grid?.[0]?.map(cell => ({ ...cell }));
            }
        }
        await captureRunmodeDelay(game, true, sourceTurn, {
            preservePhysicalTopline: true,
            retainedTopline: delayedAction?._runmodeRetainedTopline ?? null,
        });
        setMulti(currentMulti(game) + 1, game);
        if (currentMulti(game) === 0) {
            await finishHeroHelplessness();
            // if unmul() caused a level change, take it now
            await finishScheduledLevelChange();
        }
    }
}

// State-derived subset of the once-per-turn maintenance in allmain.c.
// This covers the first quiet turn: monster movement allotments, random
// monster generation, ambient feature sounds, hunger, and engraving wear.
async function finishInitialTurnMaintenanceRng(sourceTurn: number): Promise<void> {
    const game = requireInitializedGame();
    if (game.u.uhave.amulet) await amuletTurn(game);
    if (!rn2(40 + currentAttribute(A_DEX) * 3)) wipeHeroEngraving(rnd(3));
    // allmain.c's demigod intervention clock advances after engraving wear
    // and before environmental level motion. Complete any paged intervention
    // before restarting the countdown, as the synchronous C call does.
    if (game.u?.uevent?.udemigod && !game.u?.invulnerable) {
        if (game.u.udg_cnt !== undefined && game.u.udg_cnt > 0) game.u.udg_cnt--;
        if ((game.u.udg_cnt ?? 0) === 0) {
            await intervene();
            game.u.udg_cnt = 50 + rn2(200);
        }
    }
    await finishInitialTurnMaintenanceAfterIntervention(sourceTurn);
}

// C ref: attrib.c:exerper().  Hunger is read after gethungry() has applied
// this turn's decrement, so a completed meal can change the periodic RNG
// branch even when no other status or monster state changed.
async function periodicTurnExercise(sourceTurn: number): Promise<void> {
    const game = requireInitializedGame();
    if (!(sourceTurn % 10)) {
        const hunger = game.u?.uhunger ?? 900;
        if (hunger > 1000) {
            await exerciseAttribute(A_DEX, false); // Satiated: abuse Dexterity
            if (game.urole?.key === 'monk')
                await exerciseAttribute(A_WIS, false);
        } else if (hunger > 150) {
            await exerciseAttribute(A_CON, true); // Not Hungry: exercise Constitution
        } else if (hunger > 50) {
            // Hungry has no hunger-driven exercise.
        } else if (hunger > 0) {
            await exerciseAttribute(A_STR, false); // Weak: abuse Strength
            if (game.urole?.key === 'monk')
                await exerciseAttribute(A_WIS, true);
        } else {
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

async function finishInitialTurnMaintenanceAfterAmbient({
    sourceTurn,
}: Pick<TurnMaintenance, 'sourceTurn'>): Promise<CompletedMaintenance> {
    const game = requireInitializedGame();
    await getHungry({ invulnerable: game.u.invulnerable });
    if (game.program_state.gameover) return { kind: 'complete' };
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
    await invault(game);
    await finishInitialTurnMaintenanceRng(sourceTurn);
    return { kind: 'complete' };
}

async function finishInitialTurnMaintenanceAfterAutomaticSearch({
    sourceTurn,
}: Pick<TurnMaintenance, 'sourceTurn'>): Promise<MaintenancePhase> {
    if (game.u.warning) await revealWarnedMonsters();
    if (game.were_changes) setHeroSpecies(heroSpecies(game), game);
    await warnWithMasterKey(game);
    // Each sound keeps its native message wait before later feature rolls.
    await dosounds();
    await doStorms(game);
    if (game.program_state.gameover) return { kind: 'complete' };
    return finishInitialTurnMaintenanceAfterAmbient({ sourceTurn });
}

async function finishInitialTurnMaintenanceAfterRegions({
    sourceTurn, capacity,
}: TurnMaintenance): Promise<MaintenancePhase> {
    const game = requireInitializedGame();
    if (game.u.ublesscnt > 0) game.u.ublesscnt--;
    // allmain.c:regen_hp() runs after nh_timeout().  If a timeout pline
    // suspended at tty, no regeneration or later maintenance may run until
    // that exact source stack resumes.
    const recoveryCapacity = game.u.invulnerable ? UNENCUMBERED : capacity;
    if (await regenerateHeroHp(recoveryCapacity, sourceTurn))
        await interruptCountedActivity('You are in full health.');
    if (game.program_state.gameover) return { kind: 'complete' };

    // C moveloop_core(): moving around while Strained or worse is hard work.
    if (recoveryCapacity > MOD_ENCUMBER && game.u.umoved
        && sourceTurn % (recoveryCapacity < EXT_ENCUMBER ? 30 : 10) === 0)
        await overexertHeroHp(game);

    if ((game.u?.uen ?? 0) < (game.u?.uenmax ?? 0)) {
        const level = game.u?.ulevel ?? 1;
        const roleFactor = game.urole?.key === 'wizard' ? 3 : 4;
        const interval = Math.max(1, Math.trunc(
            ((30 + 8 - level) * roleFactor) / 6,
        ));
        const energyRegeneration = propertyIsActive('energyRegeneration', game);
        if ((recoveryCapacity < MOD_ENCUMBER
                && sourceTurn % interval === 0)
            || energyRegeneration) {
            let upper = Math.trunc(
                (currentAttribute(A_WIS, game) + currentAttribute(A_INT, game)) / 15,
            ) + 1;
            if (hasWornProperty('magicalBreathing', game)
                || hasCarriedProperty('magicalBreathing', null, game)
                || hasInvokedProperty('magicalBreathing', game)) upper += 2;
            game.u.uen = Math.min(
                game.u.uenmax,
                game.u.uen + 1 + rn2(upper),
            );
            game.context.botl = true;
            if (game.u.uen === game.u.uenmax)
                await interruptCountedActivity('You feel full of energy.');
        }
    }

    await rollHeroTeleportitis();
    if (game.program_state.gameover) return { kind: 'complete' };
    await advanceHeroShapeChange();
    if (game.program_state.gameover) return { kind: 'complete' };

    if (game.u?.searching && !game.level?.flags?.noautosearch
        && !heroHasInvoluntaryDelay(game)) {
        const search = await automaticSearch();
        if (typeof search === 'object' && search.statueTrap) {
            const { x, y } = search.statueTrap;
            return {
                kind: 'statue-trap',
                x, y, sourceTurn, capacity,
            };
        }
    }

    return await finishInitialTurnMaintenanceAfterAutomaticSearch({
        sourceTurn,
    });
}

// C allmain.c:moveloop_core(): Teleportation, including a teleporting form,
// moves the hero once in 85 turns. A move away from a leashed follower checks
// the leash and cancels queued and repeated commands.
async function rollHeroTeleportitis(): Promise<void> {
    if (game.u.invulnerable || !heroCanTeleport(game) || rn2(85)) return;
    const from = { x: game.u.ux, y: game.u.uy };
    await teleportHero({ chooseDestination: askTeleportDestination });
    if (game.program_state.gameover || (game.u.ux === from.x && game.u.uy === from.y)) return;
    if (!heroNextToLeashedFollowers()) await checkHeroLeashes(from.x, from.y);
    clearCannedCommands();
    clearRepeatCommand();
}

// C apply.c:next_to_u().
function heroNextToLeashedFollowers(): boolean {
    const level = game.level;
    if (level?.monsters.some(monster => monster.mleashed
        && (monster.mx - game.u.ux) ** 2 + (monster.my - game.u.uy) ** 2 > 2)) return false;
    const steed = game.u.usteed;
    return !(steed && monsterCarriesAmulet(steed));
}

// C allmain.c:moveloop_core(). A selected change waits through involuntary
// delays and Unchanging; losing the source of the change cancels it.
async function advanceHeroShapeChange(): Promise<void> {
    if (game.u.invulnerable) return;
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
        || heroHasInvoluntaryDelay(game)) return;
    await stopHeroOccupation(game);
    if (game._pendingHeroShapeChange === 'polymorph') await polymorphHero();
    else await applyHeroWereChange();
    delete game._pendingHeroShapeChange;
}

async function runLevelRegionTurn() {
    const game = requireInitializedGame();
    return runLevelRegions(game, {
        wake: wakeMonstersNearWithMessages,
        onAnger: (monster: Monster) => angerMonster(monster, { attacked: true }),
        onMonsterDeath: async (monster: Monster, event: { heroFault: boolean; visible: boolean }) => {
            if (event.heroFault) {
                const killed = await finishHeroMonsterKill(
                    monster, monster.mx, monster.my,
                );
                return { monster, survived: !killed };
            }
            return finishMonsterKilled(monster, game, {
                cause: 'gas cloud', damageType: AD_DRST,
            });
        },
    });
}

async function beginInitialTurnMaintenance(): Promise<MaintenancePhase | { kind: 'hero-died' }> {
    const game = requireInitializedGame();
    // allmain.c caches this after monster movement. Timeouts can change the
    // load, but movement and recovery for this turn keep the earlier capacity.
    const capacity = nearCapacity(game);
    // allmain.c runs mcalcdistress() before allocating the next movement
    // ration. Regeneration, were-change checks, and temporary maladies count
    // down once per global turn, independent of the monster's own speed.
    game.were_changes = 0;
    for await (const event of monsterDistressEvents(
        game.level?.monsters || [], game, rn2, game.moves, plineWithContinuation,
    )) {
        if (event.kind === 'stationary-liquid') {
            if (game.vision_full_recalc) {
                await vision_recalc(0);
            }
            await resolveMonsterLiquid(event.monster, game, {
                announce: plineWithContinuation,
                monsterMoving: false,
                finishDeath: finishHeroLiquidMonsterDeath,
            });
            continue;
        }
        if (event.kind === 'shape-change') {
            if (event.change.heroDied) return { kind: 'hero-died' };
            continue;
        }
        await presentWereChange(event.change, {
            publish: plineWithContinuation,
            wakeNearby: (x: number, y: number, distance: number) =>
                wakeMonstersNearWithMessages(x, y, distance, game),
        });
    }
    return finishInitialTurnMaintenanceAfterMonsterDistress(capacity);
}

// C allmain.c:maybe_generate_rnd_mon().
async function finishInitialTurnMaintenanceAfterMonsterDistress(
    capacity: number,
): Promise<MaintenancePhase> {
    const game = requireInitializedGame();
    allocateMonsterMovement(game.level?.monsters || [], rn2, game);
    // allmain.c:maybe_generate_rnd_mon().  Monster pressure increases below
    // the Castle and again after demigodhood; the denominator is topology
    // state, not a fixed scheduler constant.
    const currentDepth = dungeonDepth(
        game.u?.uz?.dnum ?? 0, game.u?.uz?.dlevel ?? 1,
    );
    const strongholdDepth = dungeonDepth(
        game.stronghold_level?.dnum ?? 0,
        game.stronghold_level?.dlevel ?? Number.MAX_SAFE_INTEGER,
    );
    const generationRate = game.u?.uevent?.udemigod ? 25
        : currentDepth > strongholdDepth ? 50 : 70;
    if (rn2(generationRate) === 0) await makemonAt(null, 0, 0);
    const polymorphed = (game.u.mtimedone !== undefined && game.u.mtimedone > 0)
        && Number.isInteger(game.u?.umonnum);
    let moveAmount;
    if (game.u.usteed && game.u.umoved) {
        moveAmount = mcalcmove(game.u.usteed, true, rn2, game);
    } else {
        moveAmount = polymorphed
            ? (MONSTER_MOVE[game.u.umonnum] ?? 0) : 12;
        if (game.u.veryFast) {
            if (rn2(3) !== 0) moveAmount += 12;
        } else if (game.u.fast && rn2(3) === 0) {
            moveAmount += 12;
        }
    }
    // allmain.c:u_calc_moveamt() applies the cached carrying capacity after
    // the current form's natural speed and Fast/Very_fast bonus.  OVERLOADED is
    // deliberately the default case: a zero-speed mold receives no movement
    // until intrinsic Fast grants a complete 12-point action.
    if (capacity === 1) {
        moveAmount -= Math.trunc(moveAmount / 4);
    } else if (capacity === 2) {
        moveAmount -= Math.trunc(moveAmount / 2);
    } else if (capacity === 3) {
        moveAmount -= Math.trunc(moveAmount * 3 / 4);
    } else if (capacity === 4) {
        moveAmount -= Math.trunc(moveAmount * 7 / 8);
    }
    // C records the hero's current square after monster movement/allocation
    // and before the new global turn's callbacks.  Pets which lose sight of
    // the hero consult this ring on their next action.
    addHeroMovementRation(game, moveAmount);
    setTrack(game);
    game.moves = (game.moves || 1) + 1;
    if (game.moves >= 1000000000) {
        await flushPendingTopline();
        await plineWithContinuation('The dungeon capitulates.', { urgent: true });
        await finishHeroDeath({ killer: '', deathType: ESCAPED });
        return { kind: 'complete' };
    }
    if (game.flags.time && !game.context.run) game.context.time_botl = true;
    game._heroActionSeq = game.moves * 8;
    await currentLuaLifecycle().callCore(game, 'moveloop_turn');
    if (heroHasSlipperyHands(game)) await slipFromSlipperyHands(game);

    // nh_timeout() precedes regeneration and exerchk() in the C loop.
    // C allmain.c:273 calls it between glibr() and run_regions(); the
    // countdown and its expiry messages live in timeout.ts.
    await nhTimeout();
    if (game.program_state?.gameover) return { kind: 'complete' };
    return { kind: 'regions', sourceTurn: game.moves, capacity };
}

async function advanceWorldTurn(): Promise<void> {
    const game = requireInitializedGame();
    const initialPhase = await beginInitialTurnMaintenance();
    if (initialPhase.kind === 'hero-died') return;
    let phase: MaintenancePhase = initialPhase;
    if (game.program_state?.gameover) return;
    while (phase.kind === 'regions') {
        await runLevelRegionTurn();
        if (game.program_state?.gameover) return;
        phase = await finishInitialTurnMaintenanceAfterRegions(phase);
    }
    while (phase.kind === 'statue-trap') {
        const monster = await activateStatueTrapAt(phase.x, phase.y);
        if (monster) await exerciseAttribute(A_WIS, true);
        phase = await finishInitialTurnMaintenanceAfterAutomaticSearch(phase);
    }
}

// C allmain.c:moveloop_core() calls unmul() at the end of the world turn
// which finishes negative multi, even if burden still prevents hero movement.
async function finishDelayedArmorAction(delayed: ArmorCompletion, g: GameState): Promise<void> {
    if (delayed.kind === 'wear') {
        // unmul() has printed nomovemsg before Armor_on() and find_ac().
        const effectMessages = await applyArmorOnEffects(delayed.object, g);
        delayed.object.known = true;
        const discoverArmorType = armorOnIdentifiesType(
            delayed.object, effectMessages,
        )
            && !g._knownObjectTypes?.has(delayed.object.otyp);
        const deferDiscoveryUntilAfterMessage
            = delayed.object.otyp === 166;
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
    } else if (delayed.kind === 'remove') {
        // unmul() has acknowledged nomovemsg while the armor was still worn.
        await finishArmorRemoval(delayed.object, { silent: true });
    }
    if (g.program_state.gameover) return;
    g._armorClassDirty = true;
}

async function settleHeroLiquidAfterAction() {
    const game = requireInitializedGame();
    const finishLanding = ({ from, to }: { from: Position; to: Position }) => finishDestinationSpotEffects({
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
    if (game.u?.umoved) return null;

    return applyHeroLiquidEffects(plineWithContinuation, { entry: 'turn' });
}

// Native hack.c:unmul(). The after-handler is cleared before invocation so
// recovery can start another delay without inheriting the old completion.
export async function finishHeroHelplessness(
    messageOverride?: string, state: GameState = game,
    publish: MessagePublisher = plineWithContinuation,
): Promise<void> {
    state.context.botl = true;
    setMulti(0, state);
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
    if (!after) return;
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
        await finishMealMimicry(state);
        break;
    case 'finish-digestion':
        await finishHeroDigestion(state);
        break;
    case 'steal': {
        const theft = state._armorTheft;
        if (theft?.thief) await finishDelayedArmorTheft(theft.thief, theft.object, state);
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
function addHeroMovementRation(state: GameState, amount: number): void {
    state.u.umovement = Math.max(
        0, (state.u.umovement ?? 0) + amount,
    );
}

// C ref: allmain.c newgame()
export async function newgame() {
    await withMonsterNoticesBlocked(game, () => initializeNewGame());
    // C allmain.c:844-848 enables notices only after welcome().
    if (game.flags.mention_map) await dolookaround();
    else await noticeAllMonsters(game);
    if (game.flags?.explore)
        await plineWithContinuation('You are in non-scoring explore/discovery mode.');
}

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
    if (g.program_state.gameover) return;
    // C mklev() begins with init_mapseen(): the starting level joins the
    // overview history (dungeon.c:1582) before the hero takes a turn.
    initOverviewRecord(g.u.uz ?? { dnum: 0, dlevel: 1 }, g);
    // C does this before makedog() so that the starting pet is placed next
    // to the hero rather than next to the level-generation origin.
    await u_on_upstairs();
    vision_reset_new_level();
    await checkSpecialRoom();

    const occupant = monsterAtPosition(requireGameLevel(g), g.u.ux, g.u.uy);
    if (occupant) await moveMonsterNextToHero(occupant, g, { flags: RLOC_NOMSG });
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

    if (g.flags?.legacy) await showLegacy();
    g.program_state.something_worth_saving
        = Number(g.program_state.something_worth_saving || 0) + 1;

    // A new game begins with one complete hero movement ration.  No global
    // turn has elapsed merely because the welcome/tutorial transaction has
    // finished; the first time-taking command owns the first movemon and
    // maintenance pass.  Compatibility paths historically hid this by
    // skipping the generic maintenance block altogether.

    if (g.flags.checkpoint ?? true) rewindEngravingsForSave(g.level);
    // welcome() can wrap and wait before moveloop_preamble(). unixmain's
    // discovery-mode notice follows it, also before calendar effects.
    await welcome(true);
}

// The contest play page calls moveloop_core() once per keystroke. While a
// NethackGame drives the live game, that call hands its engine one key.
export interface PlayStep {
    readonly state: GameState;
    step(): Promise<void>;
}

let playStep: PlayStep | null = null;

export function bindPlayStep(step: PlayStep | null): void {
    playStep = step;
}

export async function moveloop_core(): Promise<void> {
    if (playStep && playStep.state === game) return playStep.step();
    return runMoveloopCore();
}

// C allmain.c:moveloop_core() end-of-command display cadence: while a
// multi-step action is pending with no run or with teleport runmode,
// every 7th step marks the status line dirty (travel strides on moves,
// plain runs and count repeats on the remaining multi) so the next
// flush repaints the turn counter mid-run. Non-tport runs refresh
// through runmode_delay_output() instead, and display_nhwindow(WIN_MAP,
// FALSE) is a tty fflush with no screen effect.
function markMultiStepStatusDirty(g: GameState): void {
    if ((!g.context.run || isTeleportRunmode(g)) && g.multi
        && (g.context.travel ? (g.moves || 0) % 7 === 0 : g.multi % 7 === 0)
        && g.flags.time && g.context.run) {
        g.context.botl = true;
    }
}

// C ref: allmain.c moveloop_core()
export async function runMoveloopCore() {
    const g = requireInitializedGame();
    g.program_state.in_moveloop = true;

    if (g.program_state?.gameover) {
        await nhgetch();
        return;
    }

    await moveloopPreamble();
    if (g.program_state.gameover) return;
    if (g.context.bypasses) clearBypasses(g);
    const movementRationActionPending = !!g._heroTimePending;

    if (g._heroTimePending) {
        // C checks burden before monsters move after every timed action.
        // Hunger can lower Strength without changing inventory.
        await reportHeroEncumbrance(g);
        for (;;) {
            const somebodyCanMove = await moveMonsters();
            if (g.program_state?.gameover) return;
            if (!somebodyCanMove && g.u.umovement < NORMAL_SPEED) {
                await advanceWorldTurn();
                if (g.program_state?.gameover) return;
                // Native encumber_msg() starts each further world round.
                // Timers can remove weight while the hero is still too slow
                // to act; acknowledge that relief before monsters act again.
                if (g.u.umovement < NORMAL_SPEED) await reportHeroEncumbrance(g);
            }
            // C allmain.c's do/while exits as soon as the hero can act;
            // no monster attack may spend the hero's movement ration.
            if (g.u.umovement >= NORMAL_SPEED) break;
        }
        g._heroTimePending = false;
        g._heroActionSeq = (g._heroActionSeq ?? 0) + 1;
        // C moveloop_core() checks again after nh_timeout() can remove weight.
        await reportHeroEncumbrance(g);
        if (!g.program_state?.gameover)
            await finishHeroTookTime(g.moves || 1);
    }

    if (movementRationActionPending && !g.program_state?.gameover) {
        await settleHeroLiquidAfterAction();
        if (g.program_state?.gameover) return;
        if (g.u.uinwater || g.underwater) await under_water(0);
        else if (g.u.uburied) await under_ground(0);
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
            if (g.u?.uswallow) await swallowed(false);
        } else if (g.u?.warning || g.u.warnOfMonster
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
    if (g.context.botl || g.context.time_botl) await flush_screen(1);
    else updateStatusLines();
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
        if (g.program_state.gameover) return;
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
        if (g.program_state.gameover) return;
        // C returns here when lookaround() clears multi, before vision and
        // end-turn callbacks. Pending sight waits for the next see_* phase.
        if (!continuation.attemptedMove) return;
        await finishScheduledLevelChange();
        if (g.program_state.gameover) return;
        if (g.vision_full_recalc) await vision_recalc(0);
        markMultiStepStatusDirty(g);
        if (continuation.tookTime) {
            g.u.umovement = (g.u.umovement ?? 12) - 12;
            g._heroTimePending = true;
        }
        if (continuation.tookTime) await currentLuaLifecycle().runCallbacks(g, 'end_turn');
        return;
    }

    // Read and execute one command
    g.u.umoved = false;
    if (g.multi > 0) {
        --g.multi;
        await rhack(g._commandKey ?? 0);
    } else {
        await rhack(0);
    }
    if (g.program_state.gameover) return;

    await finishScheduledLevelChange();
    if (g._questExpulsionPending) await performQuestExpulsion(g);
    if (g.program_state.gameover) return;

    // C refreshes command-induced sight changes before monsters act again.
    // Falling into a pit narrows sight after domove()'s earlier refresh.
    if (g.vision_full_recalc) await vision_recalc(0);
    markMultiStepStatusDirty(g);

    // Advance turn
    if (g.context?.move) {
        g.u.umovement = (g.u.umovement ?? 12) - 12;
        g._heroTimePending = true;
    }
    await currentLuaLifecycle().runCallbacks(g, 'end_turn');
}

// C ref: allmain.c moveloop()
export async function moveloop(resuming?: boolean): Promise<void> {
    const game = requireInitializedGame();
    await docrt();
    await flush_screen(1);

    for (;;) {
        await runMoveloopCore();
        if (game.program_state?.gameover) break;
    }
}

// C allmain.c:newgame(): start a fresh species history before object and
// monster creation. Restore keeps its saved history and never calls this.
export function initializeMonsterVitals(state: MonsterPopulationState = game): void {
    state.mvitals = MONSTER_GENO.map(generation => ({
        mvflags: generation & G_NOCORPSE, born: 0, died: 0,
    }));
}
