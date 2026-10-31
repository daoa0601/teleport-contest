import { selectContextMenu } from './context_menu.js';
import { CLICK_1, CLICK_2, xdir, ydir } from './const.js';
import { queueCommandResponses } from './input.js';
import { setHeroGrip } from './hero_grip.js';
import { useMagicMarker } from './write.js';
import { formatFeltMessage, formatSeenMessage, publishHeardMessage } from './hero_speech.js';
import { autokey, autoUnlockFlags, continuePicking, pickLock } from './lock_pick.js';
import { resetOccupations } from './occupation_reset.js';
import { AUTOUNLOCK_APPLY_KEY, AUTOUNLOCK_FORCE, AUTOUNLOCK_KICK, AUTOUNLOCK_UNTRAP, ECMD_CANCEL, ECMD_FAIL, ECMD_OK, ECMD_TIME, PARANOID_QUIT } from './const.js';
import { findDrawbridgeAt } from './dbridge.js';
import { doorObstructed } from './door_magic.js';
import { DBWALL, DRAWBRIDGE_DOWN, STAIRS, THRONE } from './const.js';
import { curseObject, uncurseObjectState } from './object_state.js';
import { adjustObjectLightAfterBlessing, objectLightRadius } from './light.js';
import { dip, dipInto } from './potion_dip.js';
import { CRYSTAL_BALL } from './object_data.js';
import { useCrystalBall } from './crystal_ball.js';
import { visibleRegionAt } from './regions.js';
import { wizIntrinsic } from './wizard_intrinsics.js';
import { wizTimeoutQueue } from './timeout_queue.js';
import { wizFuzzer, wizPanic } from './wizard_debug_commands.js';
import { wizDetect, wizGenesis, wizIdentify, wizKill, wizLevelChange, wizLevelTeleport, wizMap, wizPolyself, wizShowNhuuid, wizTelekinesis, wizWhere, wizWish, } from './wizcmds.js';
import { wizSmell } from './wizard_smell.js';
import { showSeenVectors, showVisionFlags, showWallModes } from './wizard_map_inspection.js';
import { wizRumorCheck } from './wizard_rumor_check.js';
import { wizCustom } from './wizard_custom.js';
import { wizBury } from './wizard_bury.js';
import { wizMigrateMonsters } from './wizard_migration.js';
import { wizFlipLevel } from './wizard_flip_level.js';
import { wizMakeMap } from './wizard_makemap.js';
import { wizardTeleportCommand } from './wizard_teleport.js';
import { deityName } from './alignment.js';
import { continueSpellbookStudy } from './spellbook_study.js';
import { releaseDjinni } from './potion_occupants.js';
import { quaff } from './quaff.js';
import { jumpHero } from './jumping.js';
import { clearMessageWindow } from './tty_topline.js';
import { feel_location } from './display.js';
// cmd.js — Command parsing and dispatch.
// C ref: cmd.c:rhack(); movement execution belongs to hack.ts.
import { game, requireGameLevel, requirePlayingGame } from './gstate.js';
import { requireInitializedHero } from './hero_types.js';
import { encyclopediaEntries, encyclopediaMatches, encyclopediaSupplementalName } from './encyclopedia.js';
import { ESCAPED, MENU_ITEMFLAGS_SKIPMENUCOLORS, NHW_MENU, PICK_NONE, PICK_ONE } from './const.js';
import { finishMonsterKilled, finishMonsterLiquidDeath } from './monster_death.js';
import { VIBRATING_SQUARE } from './const.js';
import { map_engraving, map_trap } from './display.js';
import { teleportHeroAtWill } from './teleport.js';
import { tty_add_menu, tty_create_nhwindow, tty_destroy_nhwindow, tty_end_menu, tty_select_menu, tty_start_menu, } from './tty_menu.js';
import { LOOK_ONCE, LOOK_QUICK, LOOK_VERBOSE } from './const.js';
import { surfaceName } from './terrain_name.js';
import { doFarlook, dohelp, dowhatis } from './pager.js';
import { lookatDescription } from './pager_description.js';
import { lookAtMonster, monsterSeenDescription, offerMonsterSupplement, selfLookDetails, selfTrapDescription } from './pager_monsters.js';
import { identifyTrap } from './pager_traps.js';
import { lookGlyphAt, mapFeatureDescription } from './pager_features.js';
import { isGrayStone } from './object_properties.js';
import { applySuggestion } from './apply_selection.js';
import { flipThroughBook } from './book_flip.js';
import { flipCoin } from './coin_flip.js';
import { useGrayStone } from './gray_stone.js';
import { useMirror } from './mirror.js';
import { useCamera } from './camera.js';
import { useTowel } from './towel.js';
import { useBell } from './apply_bell.js';
import { breakWand } from './wand_break.js';
import { speakArtifact } from './artifact_speech.js';
import { lightCocktail, useCandelabrum, useCandle, useLamp } from './apply_light.js';
import { useWhistle } from './whistle.js';
import { retouchHeroObject } from './hero_retouch.js';
import { GETOBJ_DOWNPLAY, GETOBJ_EXCLUDE, GETOBJ_SUGGEST } from './const.js';
import { placeHeroOnLevel } from './hero_location.js';
import { distantMonsterName, monsterName, } from './monster_name.js';
import { attackHostileMonster } from './hero_melee.js';
import { prepareAppliedWeaponAttack } from './hero_attack_preflight.js';
import { stumbleOnDoorMimic } from './mimic.js';
import { monsterAtPosition } from './monster_location.js';
import { SHOP_TYPES } from './shop_data.js';
import { observeBucForNaming } from './object_knowledge.js';
import { definiteName, objectCombatName, observeDistantObjectForNaming, observeObjectForNaming, ownedObjectName, } from './objnam.js';
import { descendFromLevitation } from './levitation_commands.js';
import { beginCommandResult, clearCannedCommands, commandResultCancelled, commandResultFailed, commandResultSpentTime, endVoluntaryMultiTurn, resetCommandVariables, nomul, setMulti } from './command_state.js';
import { propertyIsActive } from './properties.js';
import { pickupAtHero } from './pickup.js';
import { inventorySortMode, objectClassHeading, sortObjects } from './object_sort.js';
import { gotoLevel } from './level_change.js';
import { dopay } from './shop_pay_command.js';
import { inventoryReport } from './inventory_reports.js';
import { quoteShopGoods } from './shop_price_quote.js';
import { isContainer, useContainer } from './container.js';
import { tipCommand } from './container_tip.js';
import { lootCommand } from './container_loot.js';
import { dolookaround } from './lookaround.js';
import { doOptions, toggleBooleanOptionPrefix } from './options.js';
import { blocksDiagonalDoor, blocksMove, TRAVEL_DIRECTIONS, heroMayDisplaceMonster, runSafepetDisplacement, heroTestMove, applyHeroLiquidEffects, domove, } from './hack.js';
import { commandExecutionKey, controlRushDirection, visibleCommandKey } from './command_keys.js';
import { NATIVE_COMMAND_FLAGS, NATIVE_COMMANDS } from './command_data.js';
import { stopHeroOccupation } from './occupation.js';
import { continueBulkTakeoff, takeOffAll } from './bulk_takeoff.js';
import { resetBulkTakeoff } from './takeoff_state.js';
import { currentLuaLifecycle } from './lua/lifecycle.js';
import { clearCommandKeys, nhgetch, queueCommandKeys, readchar, takeCommandKey, takeCommandResponse } from './input.js';
import { readCommandInput } from './command_input.js';
import { clearRepeatCommand, rememberCommand, takeRepeatCommand } from './command_repeat.js';
import { terrainCommand } from './terrain_view.js';
import { autoDescribePosition, selectTravelMenuPosition } from './getpos.js';
import { whatDoesCommand } from './command_help.js';
import { availableExtendedCommands, completeExtendedCommand, extendedCommandMenu, showExtendedCommandList } from './extended_commands.js';
import { chooseInventoryObject, compactInventoryLetters, inventoryLetterOrder, getobj, reassignInventoryLetters, } from './inventory_prompt.js';
import { promptDirection, promptKey, readDirectionKey, restoreCommandMap, ynSingleKey, } from './tty_prompts.js';
import { getLine, paranoidQuery, promptYesNo, promptYesNoQuit, yn_function, } from './query.js';
export { getLine, promptYesNo, promptYesNoQuit } from './query.js';
import { callObjectType, objectTypeIsCallable, } from './object_call.js';
import { nameIndividualObject } from './individual_naming.js';
import { nameChosenMonster } from './monster_naming_command.js';
import { nameFloorObject } from './floor_naming.js';
import { chooseNamingCategory } from './naming_categories.js';
import { newsym, feel_newsym, flush_screen, docrt, canSeeMonster, canSpotMonster, monsterHasWarningProjection, swallowed, randomDisplayMonsterName, randomDisplayMonsterSubject, see_monsters, see_objects, see_traps, map_invisible, } from './display.js';
import { flushPendingTopline, moreUntilDismissed, putMessageHistory, rememberToplines, } from './tty_topline.js';
import { pline, plineWithContinuation, setTopline } from './pline.js';
import { vision_note_blocker_change, vision_recalc } from './vision.js';
import { doprevMessage, keyText, messageWindowMode } from './prevmsg.js';
import { transformMagicLampToOilLamp } from './light.js';
import { dozap, } from './zap.js';
import { bucAdjectiveForName, checkInventoryGold, consumeInventoryItem, ddoinv, dolook, inventoryItemDescription, inventoryPrimaryHandDetail, selectUsedInventoryLetter, } from './invent.js';
import { mergable, mergeObjectStacks } from './object_merge.js';
import { unlinkObject } from './object_location.js';
import { castSpell, docast, dovspell, dowizcast, } from './spell.js';
import { heroBreathAttack } from './hero_breath.js';
import { useHeroBreath } from './hero_breath_command.js';
import { monsterBreathAttack } from './dogmove.js';
import { heroSpitAttack, useHeroSpit } from './hero_spit.js';
import { heroGazeAttack, useHeroGaze } from './hero_gaze.js';
import { heroCanSplitLikeGremlin, useHeroGremlinSplit, } from './hero_gremlin.js';
import { heroCanShriek, useHeroShriek } from './hero_shriek.js';
import { heroCanSummonWerePack, useHeroWereSummon, } from './were.js';
import { heroHasHidingAbility, useHeroHide } from './hero_hide.js';
import { chooseSpiderAbility, heroCanSpinWeb, useHeroWeb, } from './hero_web.js';
import { heroCanMindBlast, useHeroMindBlast, } from './hero_mind_blast.js';
import { heroCanRemovePunishment, useHeroNymphAbility, } from './hero_nymph_ability.js';
import { heroCanUseUnicornHorn, useUnicornHorn, } from './unicorn_horn.js';
import { useHeroVampireShift } from './vampire_shift.js';
import { turnUndeadByCallingOnDeity } from './turn_undead.js';
import { doread } from './read.js';
import { continueFoodMeal, doeat } from './eat.js';
import { continueTinOpening, useTinOpener } from './tin.js';
import { PLAYABLE_INSTRUMENTS, playInstrument } from './music.js';
import { doclassdisco, dodiscovered, renameDiscoveredType } from './o_init.js';
import { doattributes, doconduct } from './insight.js';
import { displayHelpFile } from './pager_help.js';
import { doextversion, NATIVE_VERSION } from './extversion.js';
import { dosearch } from './detect.js';
import { abusePetAfterHeroHit } from './dog.js';
import { continueWipingFace, donull, dowipe, threateningMonsterNearby, } from './do.js';
import { ATR_NONE, addMenuHeading, showTextWindow, restoreMenuUnderlay, snapshotMenuUnderlay, } from './windows.js';
import { d, rn2, rn2Display, rnl, } from './rng.js';
import { landObjectOnAltar } from './altar_object.js';
import { landFloorObject } from './floor_effects.js';
import { shipObject } from './object_migration.js';
import { mkgold, mksobj } from './mkobj.js';
import { recordMappedOverviewState, specialPrototypeAt, specialLevelAt, dungeonBuildsUp, sameDungeonLevel, } from './dungeon.js';
import { questLeaderName } from './quest_pager.js';
import { addInventoryItem, assignInventoryLetter, inventoryLetterRank } from './u_init.js';
import { objectQuantity, rejoinObjectStack, splitObjectStack } from './object_stack.js';
import { dropHeroObject } from './hero_drop.js';
import { dropMultipleObjects } from './drop_menu.js';
import { SELL_DELIBERATE, SELL_NORMAL, setSellDisposition } from './shop_sell.js';
import { addObjectToMonsterInventory } from './monster_inventory.js';
import { setSecondaryWeapon } from './weapon_slots.js';
import { captureThrownObjectFlight, } from './thrown_object.js';
import { objectName, singularObjectName, unseenObjectNoun, } from './objnam.js';
import { artifactById, } from './artifacts.js';
import { invokeArtifactPower, } from './artifact_invoke.js';
import { BULLWHIP, GRAPPLING_HOOK, CREAM_PIE, EGG, LUMP_OF_ROYAL_JELLY, LOCK_PICK, CREDIT_CARD, STETHOSCOPE, GOLD_PIECE, BOULDER, TOUCHSTONE, LARGE_BOX, CHEST, ICE_BOX, SACK, OILSKIN_SACK, BAG_OF_HOLDING, BAG_OF_TRICKS, BRASS_LANTERN, OIL_LAMP, MAGIC_LAMP, STATUE, RIN_PROTECTION, BANANA, MIRROR, TIN_WHISTLE, MAGIC_WHISTLE, EUCALYPTUS_LEAF, BELL, BELL_OF_OPENING, EXPENSIVE_CAMERA, TIN_OPENER, FIGURINE, LEASH, CAN_OF_GREASE, SADDLE, HORN_OF_PLENTY, TINNING_KIT, LAND_MINE, BEARTRAP, TALLOW_CANDLE, WAX_CANDLE, CANDELABRUM_OF_INVOCATION, POT_OIL, RIN_CONFLICT, LENSES, BLINDFOLD, TOWEL, MAGIC_MARKER, UNICORN_HORN, SHIELD_OF_REFLECTION, AMULET_OF_STRANGULATION, FAKE_AMULET_OF_YENDOR, SPE_NOVEL, OBJECT_UNIQUE, OBJECT_DESCRIPTIONS, OBJECT_MATERIAL, OBJECT_WEIGHT, } from './object_data.js';
import { CLR_WHITE, NO_COLOR, } from './terminal.js';
import { MONSTER_COLOR, MONSTER_FLAGS1, MONSTER_LEVEL, MONSTER_MOVE, MONSTER_NAME, MONSTER_SIZE, MONSTER_SOUND, MONSTER_ALIGNMENT, monsterTypeName, monsterClassSymbol, monsterDigests, monsterSpeciesHidesOnCeiling, } from './monster_data.js';
import { addExperience, checkExperienceLevel, gainExperienceLevel, loseHeroExperience, } from './exper.js';
import { heroFormSticks, heroPassesWalls, heroSpecies } from './hero_species.js';
import { autopickupAtHero } from './pickup.js';
import { isLavaAt, isPoolAt } from './terrain_properties.js';
import { dosave } from './save.js';
import { arriveTravel, captureRunmodeDelay, startRun, startWalkRepeat, stopRun } from './runmode.js';
import { findMonsterArmorClass, } from './monworn.js';
import { finishHeroMonsterKill, finishHeroMonsterKillOutcome, finishHurtleMonsterDeath } from './hero_monster_death.js';
import { wakeMonstersNearWithMessages } from './monster_wake.js';
import { aggravateMonsters, angerAttackedMonster } from './monster_anger.js';
import { publishMonsterNoise } from './monster_sound.js';
import { doride, stuckSteed } from './steed.js';
import { currentAttribute, currentStrength, exerciseAttribute } from './attrib.js';
import { reportHeroEncumbrance } from './encumbrance.js';
import { spendHeroNutrition, updateHeroHunger } from './hunger.js';
import { continueForceLock, doforce, isForceableWeapon } from './lock.js';
import { doUntrap } from './untrap.js';
import { dosit } from './sit.js';
import { continueEngraving, doengrave } from './engrave_command.js';
import { climbOutOfPit, triggerHeroTrapAt, triggerLevelTeleportTrap } from './hero_traps.js';
import { applyDippedCoinFate, applyFountainDemonActor, applyFountainGemDiscovery, applyFountainNymphActor, applyFountainSnakeActors, resolveDippedSensationFate, } from './fountain_effects.js';
import { dipFountain } from './fountain.js';
import { withIndefiniteArticle, makePlural } from './object_grammar.js';
import { distmin, dungeonDepth, ledgerNo, endgameLevelName } from './hacklib.js';
import { triggerBoobyTrap } from './booby_trap.js';
import { addShopDamage, payForShopDamage } from './shop_damage.js';
import { roomsAt } from './room.js';
import { learnObjectType, recordObjectCall, } from './object_knowledge.js';
import { exceedsActionCapacity, nearCapacity, SLT_ENCUMBER } from './weight.js';
import { dopray } from './pray.js';
import { dosacrifice } from './sacrifice.js';
import { finishDestinationSpotEffects, finishTeleportArrival } from './location_effects.js';
import { detachHeroGold, heroGoldAmount, heroGoldObject, setHeroGoldAmount } from './hero_gold.js';
import { heroIsBlind, heroIsDeaf, heroIsHallucinating } from './senses.js';
import { beginBallAndChainMove, finishBallAndChainMove } from './ball.js';
import { doborn, doquit, finishHeroDeath, listGenocided, listVanquished, } from './end.js';
import { heroHasNoHands, heroIsPolymorphed, heroIsVerySmall, heroCanChangeVampireShape, } from './polyself.js';
import { applyEyewear } from './eyewear.js';
import { useCreamPie } from './cream_pie.js';
import { useFigurine } from './figurine_apply.js';
import { checkHeroLeashes, useLeash } from './leash_apply.js';
import { useGrease } from './grease_apply.js';
import { useStethoscope } from './stethoscope.js';
import { useBagOfTricks } from './bag_of_tricks.js';
import { useHornOfPlenty } from './horn_of_plenty.js';
import { useTinningKit } from './tinning_kit.js';
import { continueTrapSetting, useSettableTrap } from './trap_setting.js';
import { useSaddle } from './steed.js';
import { isRoyalJelly, useRoyalJelly, } from './royal_jelly.js';
import { useBullwhip } from './bullwhip.js';
import { useGrapplingHook } from './grappling_hook.js';
import { usePolearm } from './polearm.js';
import { isAxe, isPick, isPolearm } from './weapon_type.js';
import { applyPickAxeDirection, usePickAxe } from './pick_axe.js';
import { continueHeroDigging } from './hero_digging.js';
import { wieldTool } from './wield_tool.js';
import { dowear, doputon, removeWornItem } from './do_wear.js';
import { doready, doswapweapon, dotwoweapon, dowield } from './wield.js';
import { dofire, dothrow } from './dothrow.js';
import { doenhance, } from './skills.js';
import { chargeUnpaidUsage, checkSpecialRoom, objectTypeKnown, shopkeeperForHero, } from './shk.js';
import { gameLogEvents, isSpoilerGameLogEvent } from './gamelog.js';
import { killerObjectName } from './objnam.js';
import { wipeHeroEngraving } from './engrave.js';
import { removeHeroEquipment } from './hero_equipment.js';
import { shouldShowGetposTip, showGetposTip, showGetposInstructions, selectMapPosition, } from './getpos.js';
import { onQuestStart, okToQuest } from './quest.js';
import { performPetRangedAttack } from './dogmove.js';
import { hurtleHero } from './hero_hurtle.js';
import { abuseKickedPet, levitatingKickMisses, prepareKick, prepareKickDamage, rollKickDamage, tryKickEvasion, tryKickReel, } from './monster_kick.js';
import { admitHeroKick, kickCanReachTarget } from './kick_admission.js';
import { dokick } from './dokick.js';
import { bringLeashedFollowers, randomMonsterRelocation, } from './teleport.js';
import { goodPosition, monsterTeleportRestricted } from './teleport_rules.js';
import { RLOC_MSG, A_CON, A_DEX, A_STR, A_WIS, BOLT_LIM, COLNO, ROWNO, SCORR, SDOOR, DOOR, POOL, CLOUD, FOUNTAIN, SINK, WATER, MOAT, D_NODOOR, D_BROKEN, D_ISOPEN, D_CLOSED, D_LOCKED, D_TRAPPED, SHOP_DOOR_COST, IS_WALL, IS_ROOM, ZAP_POS, SQKY_BOARD, BEAR_TRAP, LANDMINE, FIRE_TRAP, PIT, SPIKED_PIT, TT_PIT, HOLE, TRAPDOOR, DART_TRAP, MAGIC_TRAP, TELEP_TRAP, LEVEL_TELEP, STATUE_TRAP, WEB, ANTI_MAGIC, ER_NOTHING, ER_DAMAGED, M_AP_FURNITURE, M_AP_OBJECT, M_AP_TYPE, STRAT_WAITMASK, MM_NOEXCLAM, SHOPBASE, In_endgame, Is_airlevel, Is_waterlevel, Is_valley, W_ARMOR, W_ACCESSORY, P_BOW, P_SLING, PARANOID_HIT, isok, DRAWBRIDGE_UP, } from './const.js';
const DIR_DX = { h: -1, l: 1, j: 0, k: 0, y: -1, u: 1, b: -1, n: 1 };
const DIR_DY = { h: 0, l: 0, j: 1, k: -1, y: -1, u: -1, b: 1, n: 1 };
// object.h enum value; object_data currently exposes the two other tools.
const SKELETON_KEY = 221;
const M1_HUMANOID = 0x00020000;
function isMovementKey(ch) {
    return ch.length === 1 && 'hjklyubn'.includes(ch);
}
function configuredCommand(key) {
    key &= 255;
    if (key === 27)
        return { key, command: null, parameter: null };
    const binding = game.commandBindings.lookup(key);
    const executionKey = commandExecutionKey(binding?.command?.name);
    return {
        key: executionKey?.charCodeAt(0) ?? null,
        command: binding?.command ?? null,
        parameter: binding?.parameter ?? null,
    };
}
// C cmd.c:xytodir(): returns -1 (DIR_ERR) when the offsets
// match no direction, e.g. a zero offset; set_msg_dir then keeps the
// previous message location, matching dirtocoord().
export function xyToDirection(dx, dy) {
    const direction = xdir.findIndex((x, index) => x === dx && ydir[index] === dy);
    return direction < 8 ? direction : -1;
}
// C cmd.c:dotravel_target() initializes travel before calling domove().
function startTravel(targetX, targetY, g = game) {
    g._runState = {
        mode: 8,
        targetX,
        targetY,
    };
    g.lastStrTurn = 0;
    g._travelTarget = { x: targetX, y: targetY };
    if (!g.multi)
        g.multi = Math.max(COLNO, ROWNO);
    g.context.run = 8;
    g.context.mv = true;
    g.context.travel = true;
    g.context.travel1 = true;
    g.context.nopick = true;
    return g._runState;
}
// C refs: cmd.c set_occupation()/timed_occupation() and
// allmain.c:moveloop_core().  A count-prefixed search executes once in
// rhack(), then repeats without reading another input key; each repetition is
// separated by the complete monster/global turn scheduler.
export async function continueCountedCommand(g = game) {
    if (!g._occupation)
        return false;
    g.context.move = 1;
    await continueOccupation(g);
    if (g.program_state.gameover)
        return false;
    g.context.move = 1;
    if (threateningMonsterNearby())
        await stopHeroOccupation(g);
    return !g.program_state.gameover;
}
async function continueOccupation(g) {
    const occupation = g._occupation;
    if (!occupation) {
        g._occupation = null;
        return false;
    }
    if (occupation.key === 'command') {
        g.context.move = 1;
        await runCommandHandler(occupation.binding);
        if (g.program_state.gameover)
            return false;
        g.context.move = 1;
        if (g.multi > 0)
            --g.multi;
        if (!(g.multi > 0))
            g._occupation = null;
        return true;
    }
    if (occupation.key === 'dig') {
        const continuing = await continueHeroDigging(g);
        if (g.program_state.gameover)
            return false;
        if (!continuing)
            g._occupation = null;
        g.context.move = 1;
        return true;
    }
    if (occupation.key === 'study-book') {
        const continuing = await continueSpellbookStudy({ state: g });
        if (g.program_state.gameover)
            return false;
        if (!continuing)
            g._occupation = null;
        return true;
    }
    if (occupation.key === 'force-lock') {
        return continueForceLock(occupation, g);
    }
    if (occupation.key === 'takeoff') {
        const continuing = await continueBulkTakeoff(g);
        if (!continuing)
            g._occupation = null;
        return continuing;
    }
    if (occupation.key === 'set-trap') {
        const continuing = await continueTrapSetting(g);
        if (!continuing)
            g._occupation = null;
        g.context.move = 1;
        return true;
    }
    if ('remaining' in occupation && occupation.remaining <= 0) {
        g._occupation = null;
        return false;
    }
    if (occupation.key === 'pick-lock')
        return continuePicking(occupation, g);
    if (occupation.key === 'eat-food') {
        return continueFoodMeal(occupation, g);
    }
    if (occupation.key === 'open-tin') {
        return continueTinOpening(occupation, g);
    }
    if (occupation.key === 'wipe-face') {
        return continueWipingFace(occupation, g);
    }
    if (occupation.key === 'engrave') {
        const continuing = await continueEngraving(g);
        if (g.program_state.gameover)
            return false;
        if (!continuing)
            g._occupation = null;
        g.context.move = 1;
        return true;
    }
    g._occupation = null;
    return false;
}
function prepareTimedCommand(binding) {
    const text = binding.command?.occupation;
    if (text && !game._occupation && game.multi) {
        game._occupation = { key: 'command', text, binding };
    }
}
async function redrawCommand() {
    await docrt();
    game.context.move = 0;
}
async function performWaitCommand(force = game.iflags.menu_requested) {
    if (!await donull(force, !!game.multi))
        return;
    game.context.move = 1;
}
// C cmd.c:can_do_extcmd(). Admission precedes prefixes and handler setup.
async function commandAllowed(command) {
    if (!command)
        return true;
    if (!await currentLuaLifecycle().runCallbacks(game, 'cmd_before', command.name))
        return false;
    if (!game.flags.debug && (command.flags & NATIVE_COMMAND_FLAGS.WIZMODECMD)) {
        await pline(`Unavailable command '${command.name}'.`);
        return false;
    }
    if (game.u.uburied && !(command.flags & NATIVE_COMMAND_FLAGS.IFBURIED)) {
        await pline("You can't do that while you are buried!");
        return false;
    }
    return !(game.iflags.debug_fuzzer
        && (command.flags & NATIVE_COMMAND_FLAGS.NOFUZZERCMD));
}
// C cmd.c:rhack(). Prefixes are commands; each consumes another parse in
// the same dispatch, so counts and configured keys work at every position.
export async function rhack(key) {
    requirePlayingGame(game);
    game.context.nopick = false;
    game.iflags.menu_requested = false;
    if (key !== 0)
        delete game._cursorOverride;
    game._heroMeleeThisCommand = false;
    game._silentPrefixRetainedTopline = false;
    const previousMessage = game._pending_message;
    const movement = game._movementAttempt ?? { walk: false, rush: false };
    game._movementAttempt = movement;
    let prefix = null;
    let menuPrefix = false;
    for (;;) {
        const repeated = takeRepeatCommand();
        // C rhack() consumes unused answers as command keys before parse().
        // A non-key response at this boundary cancels the remaining queue.
        const response = game._inDoAgain ? undefined : takeCommandResponse();
        let cannedCommand = game._inDoAgain || response !== undefined
            ? null : game._cannedCommands?.shift() ?? null;
        if (response !== undefined)
            key = typeof response === 'number' ? response : 0;
        if (key === 0 && !cannedCommand && !repeated && response === undefined) {
            key = (await readCommandInput()).key;
            delete game._cursorOverride;
            // C parse() returns NUL after a click queues its mouse command.
            if (key === 0)
                cannedCommand = game._cannedCommands?.shift() ?? null;
        }
        delete game._statusGoldOverride;
        if (!cannedCommand && !repeated && [0, -1, 255, 27].includes(key)) {
            resetCommandVariables(true);
            return;
        }
        if (repeated && repeated.kind !== 'command') {
            resetCommandVariables(true);
            return;
        }
        // C rhack() drops any pending travel destination for every command
        // dispatched here (cmd.c:3674); the empty/ESC branches above clear
        // it through reset_cmd_vars() instead.
        game.context.travel = game.context.travel1 = false;
        const configured = repeated?.binding ?? configuredCommand(key);
        if (!cannedCommand && response === undefined) {
            game._pending_message = '';
            game._retained_message = '';
        }
        const command = cannedCommand ? cannedCommandDefinition(cannedCommand) : configured.command;
        if (!command) {
            // C parse()/rhack() report an unknown key with
            // custompline(SUPPRESS_HISTORY): the previous line is
            // remembered, the complaint itself is not.
            await setTopline(`Unknown command '${visibleCommandKey(key)}'.`);
            // Unlike a rejected known command, C's unknown-key tail keeps
            // pending movement flags until the next command resolves them.
            clearCannedCommands();
            clearRepeatCommand();
            game.context.move = 0;
            setMulti(0);
            return;
        }
        if (!await commandAllowed(command)) {
            resetCommandVariables(true);
            return;
        }
        if (prefix && !(command.flags & NATIVE_COMMAND_FLAGS.PREFIXCMD)
            && !(command.flags & (menuPrefix ? NATIVE_COMMAND_FLAGS.CMD_M_PREFIX
                : NATIVE_COMMAND_FLAGS.CMD_gGF_PREFIX))) {
            const prefixKey = game.commandBindings.keyForCommand(prefix.name ?? '');
            const which = prefixKey ? visibleCommandKey(prefixKey)
                : prefix.handler === 'do_reqmenu'
                    ? 'move-no-pickup or request-menu' : prefix.name;
            if (menuPrefix) {
                // C rhack() reports the M-prefix refusal with
                // custompline(SUPPRESS_HISTORY), unlike the g/G/F variant.
                await setTopline(`The ${command.name} command does not accept '${which}' prefix.`);
            }
            else {
                const vertical = command.handler === 'doup' || command.handler === 'dodown';
                await pline(`The '${which}' prefix should be followed by a movement command${vertical ? ' other than up or down' : ''}.`);
            }
            resetCommandVariables(true);
            return;
        }
        let binding = { ...configured, command,
            key: cannedCommand
                ? commandExecutionKey(command.name)?.charCodeAt(0) ?? null : configured.key,
        };
        prepareTimedCommand(binding);
        if (command.handler === 'doextcmd') {
            clearRepeatCommand();
            const { selected, lastExecuted } = await readExtendedCommand();
            if (!selected || !await commandAllowed(selected)) {
                // doextcmd() leaves ext_tlist pointing at the last list it
                // executed when the following editor quits or is rejected.
                if (lastExecuted)
                    rememberCommand({
                        key: commandExecutionKey(lastExecuted.name)?.charCodeAt(0) ?? null,
                        command: lastExecuted, parameter: null,
                    }, false);
                // doextcmd() reports ECMD_OK for a quit, so rhack() resets
                // the queues only under an involuntary delay.
                resetCommandVariables(game.multi < 0);
                return;
            }
            if (game.iflags.menu_requested && !(selected.flags & NATIVE_COMMAND_FLAGS.CMD_M_PREFIX)) {
                const prefixKey = visibleCommandKey(game.commandBindings.keyForCommand('reqmenu'));
                await plineWithContinuation(`'${prefixKey}' prefix has no effect for the ${selected.name} command.`);
                game.iflags.menu_requested = false;
            }
            binding = {
                key: commandExecutionKey(selected.name)?.charCodeAt(0) ?? null,
                command: selected, parameter: null,
            };
        }
        const selected = binding.command;
        if (!selected)
            throw new Error('Command dispatch lost its selected command');
        if (selected.handler === 'do_repeat') {
            await repeatLastCommand();
            // The outer rhack() dispatches do_repeat, not dokick.
            if (game.context.move)
                game._kickedLoc = null;
            return;
        }
        rememberCommand(binding, !!prefix && command.handler !== 'doextcmd');
        if (selected.flags & NATIVE_COMMAND_FLAGS.PREFIXCMD) {
            if (!await applyMovementPrefix(selected, movement)) {
                resetCommandVariables(true);
                return;
            }
            prefix = selected;
            if (selected.handler === 'do_reqmenu') {
                // rhack() tests the outer function, which remains doextcmd
                // when #reqmenu supplies the selected prefix.
                if (command.handler === 'do_reqmenu')
                    menuPrefix = true;
                game._silentPrefixRetainedTopline = !!previousMessage;
            }
            key = 0;
            continue;
        }
        if (selected.flags & NATIVE_COMMAND_FLAGS.MOVEMENTCMD) {
            await dispatchMovement(binding, movement);
            return;
        }
        await executeCommandAction(binding, { cannedCommand });
        return;
    }
}
function cannedCommandDefinition(queued) {
    let name;
    switch (queued.kind) {
        case 'inventory-action': return inventoryActionCommand(queued.action);
        case 'context-menu':
            name = contextMenuCommand(queued.selection);
            break;
        case 'command':
            name = queued.name;
            break;
        case 'swap-weapon':
            name = 'swap';
            break;
        case 'rub':
        case 'apply':
        case 'wield':
        case 'kick':
        case 'reqmenu':
        case 'fire':
            name = queued.kind;
            break;
    }
    return NATIVE_COMMANDS.find(command => command.name === name) ?? null;
}
// C cmd.c:do_repeat(). Preserve the saved queue even when its execution
// cancels, so another repeat makes the same attempt in the new context.
async function repeatLastCommand() {
    if (game._inDoAgain)
        return;
    const saved = [...(game._repeatCommands ?? [])];
    if (!saved.length) {
        await plineWithContinuation('There is no command available to repeat.', { noRepeat: true });
        resetCommandVariables(true);
        return;
    }
    game._inDoAgain = true;
    try {
        await rhack(0);
    }
    finally {
        game._inDoAgain = false;
        game._repeatCommands = saved;
        game.iflags.menu_requested = false;
    }
}
async function applyMovementPrefix(command, movement) {
    if (command.handler === 'do_reqmenu') {
        if (game.iflags.menu_requested) {
            const key = visibleCommandKey(game.commandBindings.keyForCommand('reqmenu'));
            await pline(`Double ${key} prefix, canceled.`);
            return false;
        }
        game.iflags.menu_requested = true;
        return true;
    }
    if (command.handler === 'do_fight') {
        if (game.context.forcefight) {
            await pline('Double fight prefix, canceled.');
            return false;
        }
        game.context.forcefight = true;
        movement.walk = true;
        return true;
    }
    if (command.handler === 'do_rush' || command.handler === 'do_run') {
        if (movement.rush) {
            await pline(`Double ${command.handler === 'do_rush' ? 'rush' : 'run'} prefix, canceled.`);
            return false;
        }
        game.context.run = command.handler === 'do_rush' ? 2 : 3;
        movement.rush = true;
        return true;
    }
    throw new Error(`Unimplemented movement prefix: ${command.name}`);
}
async function dispatchMovement(binding, prefixes) {
    const key = binding.key ?? 0;
    const ch = String.fromCharCode(key);
    const direction = controlRushDirection(key) || ch.toLowerCase();
    if (!isMovementKey(direction))
        throw new Error('Movement command has no direction');
    const hero = game.u;
    hero.dx = DIR_DX[direction];
    hero.dy = DIR_DY[direction];
    hero.dz = 0;
    if (MONSTER_NAME[hero.umonnum ?? -1] === 'grid bug' && hero.dx && hero.dy) {
        hero.dx = hero.dy = 0;
        await pline("You can't get there from here...");
        resetCommandVariables(true);
        return;
    }
    // C rhack() dispatches on gd.domove_attempting, which a run prefix
    // followed by an unbound key leaves set with DOMOVE_RUSH.  That
    // branch starts a run (multi = max(COLNO, ROWNO), context.mv) with
    // whatever context.run now holds -- even 0 after nomul() -- so the
    // step repeats until a move fails.  A pending DOMOVE_WALK bit takes
    // precedence over RUSH in the dispatch order.
    const rushDispatch = prefixes.rush && !prefixes.walk;
    const mode = prefixes.walk || prefixes.rush
        ? game.context.run === 2 ? 2 : game.context.run === 3 ? 3 : 0
        : controlRushDirection(key) ? 3 : ch !== ch.toLowerCase() ? 1 : 0;
    // C cmd.c:set_move_cmd() replaces context.run only when no movement
    // prefix is pending (domove_attempting); an 'F' or rush-prefixed
    // direction keeps the run value an earlier rush or travel left set.
    if (!(prefixes.walk || prefixes.rush))
        game.context.run = mode;
    if (game.iflags.menu_requested)
        game.context.nopick = true;
    if (rushDispatch || (mode && !prefixes.walk))
        startRun(hero.dx, hero.dy, game, mode);
    else if (game.multi > 0)
        // A counted walk-style direction marks the repeat active without
        // replacing context.run or granting a rush's movement ration.
        startWalkRepeat(hero.dx, hero.dy, game);
    const outcome = await domove(hero.dx, hero.dy);
    const moved = outcome === 'time';
    if (game.program_state.gameover)
        return;
    // C domove_core() also delays counted walks after arrival effects.
    if (moved && game._domoveReachedTail)
        await captureRunmodeDelay(game, !!game.context.run || game.multi > 0);
    game.context.move = moved ? 1 : 0;
    if (!moved && outcome !== 'opened-door')
        stopRun();
    if (!mode || prefixes.walk)
        game.context.forcefight = false;
    game.iflags.menu_requested = false;
}
// C cmd.c:rhack() clears kickedloc after an elapsed non-kick action.
// doextcmd's selected action, not the outer # editor, owns that result.
async function executeCommandAction(binding, options = {}) {
    beginCommandResult();
    await runCommandHandler(binding, options);
    if (game.program_state.gameover)
        return;
    // C cmd.c:rhack() result seam (3810-3826): ECMD_CANCEL and ECMD_FAIL
    // reset both command queues, a time-taking result keeps them, and an
    // ECMD_OK result resets them only under an involuntary delay. C's
    // moveloop presets context.move before rhack(); JS handlers set it, so
    // the TIME precedence over a cancellation reads the recorded result
    // bits, not the possibly stale context.move.
    const result = game._commandResult ?? ECMD_OK;
    if (result & (ECMD_CANCEL | ECMD_FAIL)) {
        resetCommandVariables(true);
        if (result & ECMD_TIME)
            game.context.move = 1;
    }
    else if (!game.context.move) {
        resetCommandVariables(game.multi < 0);
    }
    if (game.context.move
        && binding.command?.handler !== 'dokick'
        && binding.command?.handler !== 'doextcmd') {
        game._kickedLoc = null;
    }
}
// C invent.c:doperminv(). The recorder's tty port is built without
// TTY_PERM_INVENT (config.h leaves it commented out and windconf.h is
// WIN32-only), so it does not advertise WC_PERM_INVENT and the command
// always reports the unsupported window port.
async function doPermanentInventory() {
    game.context.move = 0;
    await pline("Persistent inventory display is not supported by 'tty'.");
}
// C cmd.c:dotoggleoption(): without a binding parameter the command only
// points the player at the options menu; with one it is
// toggle_bool_option(param).
async function doToggleOption(parameter) {
    game.context.move = 0;
    if (parameter === null) {
        await pline('Use #optionsfull to set any option instead.');
        return;
    }
    if (!await toggleBooleanOptionPrefix(parameter))
        commandResultFailed();
}
// Admission belongs to the caller. Keep the selected binding, including its
// parameter, rather than looking up a possibly rebound key inside the action.
async function runCommandHandler(binding, { cannedCommand = null, } = {}) {
    const { key, command } = binding;
    const ch = key === null ? '' : String.fromCharCode(key);
    if (!cannedCommand && key === null && command) {
        // cmd.c:dotoggleoption() reads gc.cmd_bind->param; a parameter only
        // arrives through a key binding like BIND=x:toggle(silent).
        if (command.name === 'toggle') {
            await doToggleOption(binding.parameter);
            return;
        }
        const handler = command.name === null ? undefined : EXTENDED_COMMAND_HANDLERS.get(command.name);
        if (handler) {
            await handler();
            return;
        }
        await pline(`#${command.name}: unknown extended command.`);
        game.context.move = 0;
        return;
    }
    if (cannedCommand?.kind === 'context-menu') {
        const selection = cannedCommand.selection;
        contextMenuResponses(selection);
        await runCommandHandler(binding);
        return;
    }
    if (cannedCommand?.kind === 'command') {
        await runCommandHandler(binding);
        return;
    }
    // C cmd.c:rhack() pops CQ_CANNED before parse() asks tty for another
    // byte.  Tool commands use this to resume the original operation after
    // wield_tool() has spent one action installing the selected object.
    if (cannedCommand?.kind === 'rub') {
        await dorub(cannedCommand.invlet);
        return;
    }
    if (cannedCommand?.kind === 'apply') {
        await doapply(cannedCommand.invlet);
        return;
    }
    if (cannedCommand?.kind === 'swap-weapon') {
        await doswapweapon();
        return;
    }
    if (cannedCommand?.kind === 'wield') {
        queueCommandKeys(cannedCommand.invlet);
        try {
            await dowield();
        }
        finally {
            clearCommandKeys();
        }
        return;
    }
    if (cannedCommand?.kind === 'kick') {
        queueCommandResponses([{ dx: cannedCommand.dx, dy: cannedCommand.dy, dz: 0 }]);
        try {
            await dokick();
        }
        finally {
            clearCommandKeys();
        }
        return;
    }
    if (cannedCommand?.kind === 'fire') {
        await dofire(cannedCommand.shotLimit ?? 0);
        return;
    }
    if (cannedCommand?.kind === 'inventory-action') {
        await executeInventoryAction(cannedCommand.action);
        return;
    }
    if (key === 22 && game.flags?.debug) { // Ctrl-V: wiz_level_tele()
        await wizLevelTeleport({ menuRequested: game.iflags.menu_requested });
        return;
    }
    if (key === 23 && game.flags?.debug) { // Ctrl-W: wiz_wish()
        await wizWish();
        return;
    }
    if (key === 7 && game.flags?.debug) { // Ctrl-G: wiz_genesis()
        await wizGenesis();
        return;
    }
    if (key === 20) { // Ctrl-T: dotelecmd()
        if (game.flags.debug)
            await wizardTeleportCommand(teleportAtWillCommand);
        else
            await teleportAtWillCommand(false);
        return;
    }
    if (key === 6 && game.flags?.debug) { // Ctrl-F: wiz_map()
        await wizMap();
        return;
    }
    if (binding.command?.handler === 'doprev_message') {
        // Ctrl-P: doprev_message(), a GENERALCMD redisplay that follows the
        // binding rather than one raw key.
        await doprevMessage();
        game.context.move = 0;
        return;
    }
    if (ch === 'i') {
        enqueueInventoryAction(await ddoinv());
    }
    else if (ch === 'I') {
        enqueueInventoryAction(await inventoryReport('type'));
    }
    else if (ch === '(') {
        enqueueInventoryAction(await inventoryReport('tools'));
    }
    else if (ch === '*') {
        enqueueInventoryAction(await inventoryReport('inuse'));
    }
    else if (ch === 'O') {
        await doOptions(game.iflags.menu_requested);
    }
    else if (ch === 'Z') {
        await docast();
    }
    else if (ch === '+') {
        await dovspell();
    }
    else if (ch === '\\') {
        await dodiscovered();
    }
    else if (ch === '`') {
        await doclassdisco();
    }
    else if (key === 24) { // Ctrl-X
        await doattributes();
    }
    else if (ch === 's') {
        await dosearch(game.iflags.menu_requested);
    }
    else if (key === 4) { // Ctrl-D
        await dokick();
    }
    else if (ch === 'f') {
        await dofire();
    }
    else if (ch === '.') {
        await performWaitCommand();
    }
    else if (ch === 'e') {
        await doeat();
    }
    else if (ch === 'q') {
        await doquaff();
    }
    else if (ch === 'p') {
        await dopay();
    }
    else if (ch === 'd') {
        await dodrop();
    }
    else if (ch === 'D') {
        const result = await dropMultipleObjects();
        // doddrop() returns the drop transaction's result bits (or the
        // traditional-mode dropped count) to rhack() unchanged.
        game._commandResult = result;
        game.context.move = Number((result & ECMD_TIME) !== 0);
        if (result) {
            resetOccupations();
            if (game._occupation?.key === 'pick-lock')
                game._occupation = null;
        }
    }
    else if (ch === 'c') {
        await doclose();
    }
    else if (ch === 'o') {
        await doopen();
    }
    else if (ch === '@') {
        // C options.c:dotogglepickup().  This is an immediate option command,
        // not a turn, and its class list is the live pickup_types setting.
        game.flags.pickup = !game.flags.pickup;
        const classes = game.flags.pickup_types || '';
        await pline(game.flags.pickup
            ? `Autopickup: ON, for ${classes || 'all'} objects.`
            : 'Autopickup: OFF.');
        game.context.move = 0;
    }
    else if (ch === ',') {
        await pickupAtHero();
    }
    else if (ch === '>') {
        await travelStairs(false);
    }
    else if (ch === '<') {
        await travelStairs(true);
    }
    else if (ch === 'z') {
        await dozap();
    }
    else if (ch === 'r') {
        await readCommand();
    }
    else if (ch === 'T' || ch === 'R') {
        await removeWornItem(ch === 'R' ? 'remove' : 'take off');
    }
    else if (ch === 'A') {
        await takeOffAll();
    }
    else if (ch === 'P') {
        await doputon();
    }
    else if (ch === 'W') {
        await dowear();
    }
    else if (ch === 'w') {
        await dowield();
    }
    else if (ch === 'x') {
        await doswapweapon();
    }
    else if (ch === 'a') {
        await doapply();
    }
    else if (ch === ':') {
        await dolook();
    }
    else if (ch === 'V') {
        await doversion();
    }
    else if (ch === '&') {
        await whatDoesCommand();
    }
    else if (ch === '?') {
        await dohelp();
    }
    else if (ch === '#') {
        await rhack(game.commandBindings.keyForCommand('#'));
    }
    else if (ch === 'Q') {
        await doready();
    }
    else if (ch === 't') {
        await dothrow();
    }
    else if (ch === '_') {
        await dotravel();
    }
    else if (ch === ';') {
        await doFarlook();
    }
    else if (ch === 'S') {
        await dosave();
    }
    else if (ch === '$') {
        enqueueInventoryAction(await inventoryReport('gold'));
    }
    else if (ch === ')') {
        enqueueInventoryAction(await inventoryReport('weapon'));
    }
    else if (ch === '[') {
        enqueueInventoryAction(await inventoryReport('armor'));
    }
    else if (ch === '=') {
        enqueueInventoryAction(await inventoryReport('rings'));
    }
    else if (ch === '"') {
        enqueueInventoryAction(await inventoryReport('amulet'));
    }
    else if (ch === '|') {
        await doPermanentInventory();
    }
    else if (key === 127) { // Delete: overview of known terrain.
        await doTerrainOverview();
    }
    else if (key === 27) { // Escape cancels without producing a message.
        game.context.move = 0;
    }
    else {
        // Unknown command
        await setTopline(`Unknown command '${ch}'.`);
        game.context.move = 0;
    }
}
function enqueueInventoryAction(action) {
    if (!action || ['\x1b', ' ', '\n', '\r'].includes(action.key))
        return;
    game._cannedCommands ??= [];
    // itemactions_pushkeys() queues the normal prefix so command admission
    // and repeat include it before the inventory command runs.
    if (action.key === 'e' || action.key === 'q'
        || action.key === 'T' && !((action.item.owornmask ?? 0) & W_ARMOR))
        game._cannedCommands.push({ kind: 'reqmenu' });
    game._cannedCommands.push({ kind: 'inventory-action', action });
}
async function doquaff() {
    const result = await quaff();
    if (result.cancelled)
        commandResultCancelled(); // potion.c:dodrink() ECMD_CANCEL.
    game.context.move = result.spentTime && !result.heroDied ? 1 : 0;
}
async function readCommand() {
    const result = await doread();
    if (result.cancelled)
        commandResultCancelled(); // read.c:doread() ECMD_CANCEL.
}
// C do.c:u_stuck_cannot_go(). A sticky hero releases its captive, while
// being held or swallowed prevents even an attempt to use the floor below.
async function monsterPreventsStairTravel(up) {
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
export async function travelStairs(up) {
    const level = requireGameLevel();
    requireInitializedHero(game.u);
    // C do.c doup()/dodown() start with set_move_cmd(): the menu prefix's
    // no-pickup request and the cleared travel state outlive a refusal.
    game.u.dx = game.u.dy = 0;
    game.u.dz = up ? -1 : 1;
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
    if (up && game.u.utrap && game.u.utraptype === TT_PIT) {
        await climbOutOfPit();
        game.context.move = 1;
        return true;
    }
    if (!up && await stuckSteed(true, game)) {
        game.context.move = 0;
        return false;
    }
    if (!up) {
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
                        await triggerHeroTrapAt(game.u.ux, game.u.uy, {
                            finishTeleport: finishTeleportArrival, gotoLevel, tookPlunge: true,
                        });
                }
            }
            game.context.move = 1;
            return true;
        }
        if (await monsterPreventsStairTravel(false))
            return false;
    }
    let stairs = game.stairs;
    while (stairs && (stairs.sx !== game.u.ux || stairs.sy !== game.u.uy))
        stairs = stairs.next;
    if (!stairs || stairs.up !== up) {
        const pit = !up && level.traps.find(trap => trap.tx === game.u.ux && trap.ty === game.u.uy
            && (trap.ttyp === PIT || trap.ttyp === SPIKED_PIT) && trap.tseen
            && !(game.u.utrap && game.u.utraptype === TT_PIT));
        if (pit) {
            await triggerHeroTrapAt(game.u.ux, game.u.uy, { gotoLevel, tookPlunge: true });
            game.context.move = 1;
            return true;
        }
        const hole = !up && level.traps.find(trap => trap.tx === game.u.ux && trap.ty === game.u.uy
            && (trap.ttyp === HOLE || trap.ttyp === TRAPDOOR) && trap.tseen);
        if (hole) {
            const result = await triggerHeroTrapAt(game.u.ux, game.u.uy, { gotoLevel, tookPlunge: true });
            if (result.died)
                return false;
            game.context.move = 1;
            return true;
        }
        const pick = game.uwep || game.u.uwep;
        if (!up && game.flags.autodig && !game.context.nopick && pick && isPick(pick)) {
            const result = await applyPickAxeDirection(pick, {
                state: game,
                attackMonster: (target) => attackHostileMonster(target, target.mx, target.my),
                payShopkeeper: dopay,
            });
            game.context.move = result.spentTime ? 1 : 0;
            return result.spentTime;
        }
        const vibratingSquare = !up && level.traps.some(trap => trap.tx === game.u.ux && trap.ty === game.u.uy && trap.ttyp === VIBRATING_SQUARE);
        await plineWithContinuation(`You can't go ${up ? 'up' : 'down'} here${vibratingSquare ? ' yet' : ''}.`);
        game.context.move = 0;
        return false;
    }
    if (!up && Is_valley(game.u.uz) && !game.u.uevent?.gehennom_entered) {
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
    if (up && await stuckSteed(true, game)) {
        game.context.move = 0;
        return false;
    }
    if (up && await monsterPreventsStairTravel(true))
        return false;
    if (up && nearCapacity(game) > SLT_ENCUMBER) {
        await plineWithContinuation(`Your load is too heavy to climb the ${level.requireAt(game.u.ux, game.u.uy).typ === STAIRS ? 'stairs' : 'ladder'}.`);
        game.context.move = 1;
        return false;
    }
    if (up && ledgerNo(game.u.uz) === 1
        && await promptYesNo('Beware, there will be no return!  Still climb?') !== 'y') {
        game.context.move = 0;
        return false;
    }
    if (!await bringLeashedFollowers()) {
        await plineWithContinuation('You are held back by your pet!');
        game.context.move = 0;
        return false;
    }
    stairs.u_traversed = true;
    // C dungeon.c:prev_level(): an up branch stair from dungeon 0 level 1
    // ends the game as an escape unless the hero carries the Amulet, and
    // only then lets goto_level() enter the endgame.
    if (up && stairs.tolev.dnum !== game.u.uz.dnum
        && game.u.uz.dnum === 0 && game.u.uz.dlevel === 1
        && !game.u.uhave?.amulet) {
        await finishHeroDeath({ killer: '', deathType: ESCAPED });
        game.context.move = 1;
        return true;
    }
    const changed = await gotoLevel(stairs.tolev, {
        arrival: up ? 'downstairs' : 'stairs',
        ladder: !!stairs.isladder,
    });
    if (changed !== false)
        game.context.move = 1;
    return changed !== false;
}
async function doTerrainOverview() {
    await terrainCommand();
}
function putCommandLine(col, row, message, attr = 0) {
    const display = game.nhDisplay;
    if (!display)
        throw new Error('This command requires an initialized display.');
    for (let index = 0; index < message.length && col + index < display.cols; index++)
        display.setCell(col + index, row, message.charAt(index), NO_COLOR, attr);
}
function setLevelAnnotation(level, value) {
    // dungeon.c:query_annotation(): empty input and Escape preserve the
    // existing value; space-only input removes it after mungspaces().
    if (value === null || value === '')
        return;
    const annotation = value.replace(/\t/g, ' ').replace(/ +/g, ' ').replace(/^ | $/g, '');
    const key = `${level.dnum}:${level.dlevel}`;
    if (!game._levelAnnotations)
        game._levelAnnotations = new Map();
    if (annotation)
        game._levelAnnotations.set(key, annotation);
    else
        game._levelAnnotations.delete(key);
}
function annotationLevelDescription(level) {
    if (sameDungeonLevel(level, game.u.uz))
        return 'this dungeon level';
    const otherBranch = level.dnum !== game.u.uz?.dnum;
    const dungeon = game.dungeons[level.dnum];
    if (!dungeon)
        throw new Error(`Annotation has no dungeon ${level.dnum}`);
    if (sameDungeonLevel(level, game.knox_level))
        return dungeon.dname;
    if (In_endgame(level)) {
        const name = endgameLevelName(level);
        return otherBranch ? name : name.replace('Plane of ', '');
    }
    const tutorial = game.specialLevels?.get('tut-1')?.dnum;
    const description = level.dnum === game.quest_dnum ? `Home ${level.dlevel}`
        : level.dnum === tutorial && !otherBranch ? `Tutorial:${dungeonDepth(level.dnum, level.dlevel)}`
            : `level ${dungeonDepth(level.dnum, level.dlevel)}`;
    return otherBranch ? `${description}, ${dungeon.dname.replace('The ', 'the ')}` : description;
}
async function queryLevelAnnotation(level = null, inMenu = false) {
    requirePlayingGame(game);
    const location = level ?? game.u.uz;
    const prior = game._levelAnnotations?.get(`${location.dnum}:${location.dlevel}`);
    const prompt = prior ? `Replace annotation "${prior.slice(0, 30)}${prior.length > 30 ? '...' : ''}" with?`
        : `What do you want to call ${annotationLevelDescription(location)}?`;
    const value = await getLine(prompt, () => true, { inMenu });
    setLevelAnnotation(location, value);
}
async function doannotate() {
    if (game.iflags.menu_requested) {
        await doDungeonOverview();
        return;
    }
    await queryLevelAnnotation();
    game.context.move = 0;
}
async function doherecmdmenu() {
    enqueueContextMenu(await selectContextMenu(game.u.ux, game.u.uy, CLICK_1));
}
async function dotherecmdmenu() {
    game.iflags.getdir_click = CLICK_1 | CLICK_2;
    const target = game._clicklookTarget;
    if (target && isok(target.x, target.y)) {
        enqueueContextMenu(await selectContextMenu(target.x, target.y, target.x === game.u.ux && target.y === game.u.uy ? CLICK_1 : game.iflags.getdir_click));
        game._clicklookTarget = null;
        game.iflags.getdir_click = 0;
        return;
    }
    const direction = await promptDirection();
    const click = game.iflags.getdir_click;
    game.iflags.getdir_click = 0;
    if (!direction || !isok(game.u.ux + direction.dx, game.u.uy + direction.dy)) {
        commandResultCancelled(); // cmd.c:there_cmdmenu() returns ECMD_CANCEL.
        return;
    }
    enqueueContextMenu(await selectContextMenu(game.u.ux + direction.dx, game.u.uy + direction.dy, direction.dx || direction.dy ? click : CLICK_1));
}
function enqueueContextMenu(selection) {
    game.context.move = 0;
    if (!selection)
        return;
    // act_on_act() sets this before dotherecmdmenu() clears a mouse target.
    if (selection.action === 'look-at')
        game._clicklookTarget = { x: selection.x, y: selection.y };
    game._cannedCommands ??= [];
    if (selection.action === 'remove-saddle')
        game._cannedCommands.push({ kind: 'reqmenu' });
    game._cannedCommands.push({ kind: 'context-menu', selection });
}
// C cmd.c:doclicklook() retains the clicked location for later commands.
async function doclicklook() {
    game.context.move = 0;
    const target = game._clicklookTarget;
    if (target && isok(target.x, target.y))
        await autoDescribePosition(target.x, target.y);
}
async function domouseaction() {
    game.context.move = 0;
    const target = game._clicklookTarget;
    if (target && isok(target.x, target.y))
        mouseAction(target);
}
// C cmd.c:domouseaction(), the optional mouse binding which chooses an action.
function mouseAction(click) {
    requirePlayingGame(game);
    let dx = click.x - game.u.ux, dy = click.y - game.u.uy;
    const queue = (name) => {
        game._cannedCommands ??= [];
        game._cannedCommands.push({ kind: 'command', name });
    };
    if (game.flags.travel !== false) {
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
            game._travelTarget = { x: click.x, y: click.y };
            queue('retravel');
            return;
        }
        const location = game.level?.at(click.x, click.y);
        if (!dx && !dy) {
            if (location?.typ === FOUNTAIN || location?.typ === SINK)
                queue('quaff');
            else if (location?.typ === THRONE)
                queue('sit');
            else {
                let stair = game.stairs;
                while (stair && (stair.sx !== click.x || stair.sy !== click.y))
                    stair = stair.next;
                const object = game.level?.objects[click.x]?.[click.y]?.[0];
                if (stair)
                    queue(stair.up ? 'up' : 'down');
                else
                    queue(object ? isContainer(object) ? 'loot' : 'pickup' : 'wait');
            }
            return;
        }
        if (!monsterAtPosition(game.level, click.x, click.y) && !heroTestMove(click.x, click.y)) {
            if (location?.typ === DOOR && location.doormask & (D_CLOSED | D_LOCKED))
                queue(location.doormask & D_LOCKED ? 'kick' : 'open');
            else if (location && location.typ <= SCORR)
                queue('search');
            else
                queue(contextMenuCommand({ action: 'move', x: click.x, y: click.y }));
            return;
        }
    }
    else {
        if (Math.abs(dx) > 2 * Math.abs(dy))
            dy = 0;
        else if (Math.abs(dy) > 2 * Math.abs(dx))
            dx = 0;
        dx = Math.sign(dx);
        dy = Math.sign(dy);
        if (!dx && !dy) {
            queue('wait');
            return;
        }
    }
    queue(contextMenuCommand({ action: 'move', x: game.u.ux + Math.sign(dx), y: game.u.uy + Math.sign(dy) }));
}
function contextMenuCommand(selection) {
    switch (selection.action) {
        case 'move':
        case 'attack': {
            const dx = Math.sign(selection.x - game.u.ux), dy = Math.sign(selection.y - game.u.uy);
            const direction = TRAVEL_DIRECTIONS.findIndex(([x, y]) => x === dx && y === dy);
            const name = ['west', 'north', 'east', 'south', 'northwest', 'northeast', 'southeast', 'southwest'][direction];
            if (!name)
                throw new Error('A contextual move needs an adjacent target');
            return `move${name}`;
        }
        case 'lock':
        case 'saddle': return 'apply';
        case 'untrap-door':
        case 'untrap-here': return 'untrap';
        case 'remove-saddle': return 'loot';
        case 'dismount': return 'ride';
        case 'look-at': return 'clicklook';
        case 'travel': return 'retravel';
        case 'open':
        case 'kick':
        case 'close':
        case 'search':
        case 'showtrap':
        case 'untrap':
        case 'ride':
        case 'chat':
        case 'name':
        case 'quaff':
        case 'dip':
        case 'sit':
        case 'up':
        case 'down':
        case 'pickup':
        case 'loot':
        case 'tip':
        case 'eat':
        case 'drop':
        case 'wait':
        case 'look':
        case 'offer':
        case 'inventory':
        case 'cast':
        case 'throw': return selection.action;
    }
}
function contextMenuResponses(selection) {
    const dx = Math.sign(selection.x - game.u.ux), dy = Math.sign(selection.y - game.u.uy);
    const direction = { dx, dy, dz: 0 };
    const yes = 'y'.charCodeAt(0);
    switch (selection.action) {
        case 'open':
        case 'untrap-door':
        case 'kick':
        case 'close':
        case 'showtrap':
        case 'untrap':
        case 'ride':
        case 'chat':
            queueCommandResponses([direction]);
            return;
        case 'lock': {
            const tool = [SKELETON_KEY, LOCK_PICK, CREDIT_CARD]
                .map(type => game.inventory.find(object => object.otyp === type)).find(object => object);
            if (tool?.invlet)
                queueCommandResponses([tool.invlet.charCodeAt(0), direction, yes]);
            return;
        }
        case 'remove-saddle':
            queueCommandResponses([direction, yes]);
            return;
        case 'saddle': {
            const saddle = game.inventory.find(object => object.otyp === SADDLE);
            if (saddle?.invlet)
                queueCommandResponses([saddle.invlet.charCodeAt(0), direction]);
            return;
        }
        case 'name':
            queueCommandResponses(['m'.charCodeAt(0), direction]);
            return;
        case 'quaff':
        case 'tip':
        case 'eat':
            queueCommandResponses([yes]);
            return;
        case 'dip':
            queueCommandResponses(['user-input', yes]);
            return;
        case 'throw':
            // act_on_act() retains the raw offset for throwing.
            queueCommandResponses(['user-input', {
                    dx: selection.x - game.u.ux, dy: selection.y - game.u.uy, dz: 0,
                }]);
            return;
        case 'offer':
            queueCommandResponses(['user-input']);
            return;
        case 'untrap-here':
            queueCommandResponses([{ dx: 0, dy: 0, dz: 1 }]);
            return;
        case 'travel':
            game._travelTarget = { x: selection.x, y: selection.y };
            return;
        case 'attack':
        case 'cast':
        case 'dismount':
        case 'down':
        case 'drop':
        case 'inventory':
        case 'look':
        case 'look-at':
        case 'loot':
        case 'move':
        case 'pickup':
        case 'search':
        case 'sit':
        case 'up':
        case 'wait': return;
    }
}
// windows.c:getlin() frees only the popped command entry, so any key or
// direction C queued behind it stays queued for the next pop. Several
// canned kinds bundle that tail inside one JS entry (dothrow.c:575-576,
// dig.c:1104-1105, apply.c:1808-1809, 2966-2967, 3442-3443, 3745-3746 and
// the cmd.c act_on_act() chains): restore it onto the response queue. The
// drain only drops a canned entry after the response queue emptied, so
// appending preserves the C order — tail first, then the remaining
// canned commands.
export function restoreCannedCommandTail(canned) {
    if (canned.kind === 'rub' || canned.kind === 'apply' || canned.kind === 'wield') {
        queueCommandResponses([canned.invlet.charCodeAt(0)]);
    }
    else if (canned.kind === 'kick') {
        queueCommandResponses([{ dx: canned.dx, dy: canned.dy, dz: 0 }]);
    }
    else if (canned.kind === 'context-menu') {
        contextMenuResponses(canned.selection);
    }
}
// C do_name.c:docallcmd().
// C do_name.c:name_ok().
// C do_name.c:call_ok().
async function doname() {
    // do_name.c:docallcmd() uses a queued key as the naming category.
    // Any other queued entry selects nothing and clears the canned queue.
    let queuedChoice;
    if (game._inDoAgain) {
        const queued = takeRepeatCommand();
        if (queued && queued.kind === 'key')
            queuedChoice = queued.key;
        else if (queued) {
            queuedChoice = 0;
            clearCannedCommands();
        }
    }
    else {
        queuedChoice = takeCommandKey();
    }
    const choice = queuedChoice === undefined ? await chooseNamingCategory()
        : String.fromCharCode(queuedChoice);
    // C docallcmd() erases the category menu via its own dismissal
    // (erase_menu_or_text() -> docorner for a corner menu, docrt() for a
    // full-width one); no extra full redraw runs afterwards.
    // C refs: do_name.c:docallcmd()/do_oname() and
    // dungeon.c:donamelevel()/query_annotation().  The menu owns only the
    // category choice; level annotations live with mapseen, while an
    // individual object's name must stay on that same object identity.
    if (choice === 'm') {
        await nameChosenMonster();
    }
    else if (choice === 'f') {
        await nameFloorObject();
    }
    else if (choice === 'd') {
        await renameDiscoveredType();
    }
    else if (choice === 'a') {
        // donamelevel() is a getlin() prompt on the message row; it redraws
        // nothing, so no full-screen refresh follows it either.
        await queryLevelAnnotation();
        game._pending_message = '';
    }
    else if (choice === 'i') {
        // C do_name.c:name_ok() marks unseen, artifact and novel objects as
        // GETOBJ_DOWNPLAY.  getobj() omits those letters from the suggested
        // prompt while still accepting a directly typed inventory letter.
        const object = await chooseInventoryObject('name', candidate => candidate.oclass === 12 ? GETOBJ_EXCLUDE
            : candidate.dknown === false || candidate.oartifact || candidate.otyp === SPE_NOVEL
                ? GETOBJ_DOWNPLAY : GETOBJ_SUGGEST, { forcePrompt: true });
        if (object) {
            await nameIndividualObject(object);
            await flush_screen(1);
        }
    }
    else if (choice === 'o') {
        const object = await chooseInventoryObject('call', candidate => !objectTypeIsCallable(candidate) ? GETOBJ_EXCLUDE
            : !candidate.dknown || objectTypeKnown(candidate) && !game._objectCallNames?.[candidate.otyp]
                ? GETOBJ_DOWNPLAY : GETOBJ_SUGGEST);
        if (object) {
            observeObjectForNaming(object);
            if (!object.dknown) {
                await pline('You would never recognize another one.');
            }
            else {
                await callObjectType(object);
            }
            await flush_screen(1);
        }
    }
    game.context.move = 0;
}
async function getAdjacentLocation(prompt, errorMessage, x, y) {
    // C cmd.c:get_adjacent_loc() delegates input and command assistance to
    // getdir(), then turns its relative result into a checked map location.
    const direction = await promptDirection((_message, retry) => readDirectionKey(`${prompt} `, retry));
    if (!direction) {
        await pline('Never mind.');
        game.context.move = 0;
        return null;
    }
    const { dx, dy, dz } = direction;
    const target = { x: x + dx, y: y + dy, dx, dy, dz };
    if (target.x < 1 || target.x >= COLNO
        || target.y < 0 || target.y >= ROWNO) {
        if (errorMessage)
            await pline(errorMessage);
        game.context.move = 0;
        return null;
    }
    return target;
}
// C iactions.c:itemactions_pushkeys(). The menu closes before the queued
// command runs; its object letter answers the later inventory prompt.
function inventoryActionCommand({ key, item }) {
    const handlers = {
        '-': item === game.uwep ? 'dowield'
            : item === game.uswapwep ? 'remarm_swapwep'
                : item === game.uquiver ? 'dowieldquiver' : 'donull',
        'a': item.oclass === 8 && !(item.otyp === POT_OIL && objectTypeKnown(item)) ? 'dip_into' : 'doapply',
        'c': 'docallcmd', 'C': 'docallcmd', 'd': 'dodrop', 'e': 'doeat', 'E': 'doengrave', 'f': 'dofire',
        'i': 'doorganize', 'I': 'adjust_split', 'O': 'dosacrifice', 'p': 'dopay', 'P': 'dowear', 'q': 'dodrink',
        'Q': 'dowieldquiver', 'r': 'doread',
        'R': item.owornmask && item.owornmask & W_ACCESSORY ? 'ia_dotakeoff' : 'dorub',
        't': 'dothrow', 'T': item.oclass === 3 ? 'ia_dotakeoff' : 'dotip', 'V': 'doinvoke',
        'w': 'dowield', 'W': 'dowear', 'x': 'doswapweapon', 'X': 'dotwoweapon', 'z': 'dozap',
        '/': 'dowhatis', '\x1b': null, ' ': null, '\n': null, '\r': null,
    };
    return NATIVE_COMMANDS.find(command => command.handler === handlers[key]) ?? null;
}
async function executeInventoryAction({ key, item }) {
    const letter = item.invlet;
    if (!letter || !game.inventory.includes(item)) {
        game.context.move = 0;
        return;
    }
    switch (key) {
        case '-':
            if (item === game.uwep) {
                queueCommandKeys('-');
                await dowield();
            }
            else if (item === game.uswapwep) {
                resetBulkTakeoff();
                const twoweap = game.u.twoweap;
                await setSecondaryWeapon(null, game);
                await plineWithContinuation(twoweap ? 'You are no longer wielding two weapons at once.'
                    : 'You no longer have a second weapon readied.');
                game.context.move = 1;
            }
            else if (item === game.uquiver) {
                queueCommandKeys('-');
                await doready();
            }
            return;
        case 'a':
            queueCommandKeys(letter);
            if (item.oclass === 8 && !(item.otyp === POT_OIL && objectTypeKnown(item)))
                await dipInto();
            else
                await doapply();
            return;
        case 'c':
            queueCommandKeys(`i${letter}`);
            await doname();
            return;
        case 'C':
            queueCommandKeys(`o${letter}`);
            await doname();
            return;
        case 'd':
            queueCommandKeys(letter);
            await dodrop();
            return;
        case 'e':
            queueCommandKeys(letter);
            await doeat();
            return;
        case 'E':
            queueCommandKeys(letter);
            await doengrave();
            return;
        case 'f':
            await dofire();
            return;
        case 'i':
            queueCommandKeys(letter);
            await doadjust();
            return;
        case 'I':
            queueCommandKeys(letter);
            await adjustSplit();
            return;
        case 'O':
            queueCommandKeys(letter);
            await dosacrifice();
            return;
        case 'p':
            queueCommandKeys(letter);
            await dopay();
            return;
        case 'P':
        case 'W':
            queueCommandKeys(letter);
            await dowear();
            return;
        case 'q':
            queueCommandKeys(letter);
            await doquaff();
            return;
        case 'Q':
            queueCommandKeys(letter);
            await doready();
            return;
        case 'r':
            queueCommandKeys(letter);
            await readCommand();
            return;
        case 'R':
            queueCommandKeys(letter);
            if ((item.owornmask ?? 0) & W_ACCESSORY)
                await removeWornItem('take off', true);
            else
                await dorub();
            return;
        case 'T':
            queueCommandKeys(letter);
            if ((item.owornmask ?? 0) & W_ARMOR)
                await removeWornItem('take off', true);
            else
                await tipCommand();
            return;
        case 't':
            queueCommandKeys(letter);
            await dothrow();
            return;
        case 'w':
            queueCommandKeys(letter);
            await dowield();
            return;
        case 'V':
            queueCommandKeys(letter);
            await doinvoke();
            return;
        case 'x':
            await doswapweapon();
            return;
        case 'X':
            await dotwoweapon();
            return;
        case 'z':
            queueCommandKeys(letter);
            await dozap();
            return;
        case '/':
            queueCommandKeys(`i${letter}`);
            await dowhatis();
            return;
        case '\x1b':
        case ' ':
        case '\n':
        case '\r':
            game.context.move = 0;
            return;
    }
}
async function dochat() {
    const species = heroSpecies(game);
    let refusal = null;
    if (MONSTER_SOUND[species] === 0)
        refusal = `As ${withIndefiniteArticle(monsterTypeName(species, !!game.flags.female))}, you cannot speak.`;
    else if (propertyIsActive('strangled', game))
        refusal = "You can't speak.  You're choking!";
    else if (game.u.uswallow)
        refusal = "They won't hear you out there.";
    else if (game.u.uinwater)
        refusal = 'Your speech is unintelligible underwater.';
    if (refusal) {
        await plineWithContinuation(refusal);
        game.context.move = 0;
        return;
    }
    if (await quoteShopGoods()) {
        game.context.move = 1;
        return;
    }
    const direction = await promptDirection((_message, retry) => readDirectionKey('Talk to whom? (in what direction) ', retry));
    if (!direction) {
        commandResultCancelled(); // sounds.c:dochat() returns ECMD_CANCEL.
        return;
    }
    const steed = game.u.usteed;
    if (steed && direction.dz > 0) {
        if (steed.msleeping || !steed.mcanmove) {
            await plineWithContinuation(`${monsterName(steed, { capitalized: true })} seems not to notice you.`);
            game.context.move = 1;
        }
        else {
            game.context.move = Number(await publishMonsterNoise(steed, game));
        }
        return;
    }
    game.context.move = 0;
    if (direction.dz) {
        await plineWithContinuation(`They won't hear you ${direction.dz < 0 ? 'up' : 'down'} there.`);
        return;
    }
    if (!direction.dx && !direction.dy) {
        await plineWithContinuation('Talking to yourself is a bad habit for a dungeoneer.');
        return;
    }
    const x = game.u.ux + direction.dx;
    const y = game.u.uy + direction.dy;
    if (!isok(x, y))
        return;
    const monster = game.level ? monsterAtPosition(game.level, x, y) : null;
    if (!monster || monster.mundetected) {
        const topObject = game.level?.objects[x]?.[y]?.[0];
        const loc = game.level?.at(x, y);
        if (topObject?.otyp === STATUE) {
            if (!heroIsBlind(game))
                await plineWithContinuation(`The ${heroIsHallucinating(game) ? randomDisplayMonsterName() : 'statue'} seems not to notice you.`);
        }
        else if (!heroIsDeaf(game) && loc && (IS_WALL(loc.typ) || loc.typ === SDOOR)
            && (!heroIsBlind(game) || IS_WALL(loc.lastseentyp))) {
            if (!heroIsHallucinating(game)) {
                await plineWithContinuation("It's like talking to a wall.");
            }
            else {
                const wallTalk = [
                    'gripes about its job.', 'tells you a funny joke!',
                    'insults your heritage!', 'chuckles.', 'guffaws merrily!',
                    'deprecates your exploration efforts.', 'suggests a stint of rehab...',
                    "doesn't seem to be interested.",
                ];
                await plineWithContinuation(`The wall ${wallTalk[Math.min(rn2(10), wallTalk.length - 1)]}`);
            }
        }
        return;
    }
    if (M_AP_TYPE(monster) === M_AP_FURNITURE || M_AP_TYPE(monster) === M_AP_OBJECT)
        return;
    if (!monster.ispriest && (monster.msleeping || !monster.mcanmove)) {
        if (canSpotMonster(monster))
            await plineWithContinuation(`${monsterName(monster, { capitalized: true })} seems not to notice you.`);
        return;
    }
    monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_WAITMASK;
    if (!heroIsDeaf(game) && monster.mtame && monster.meating) {
        if (!canSpotMonster(monster))
            await map_invisible(monster.mx, monster.my);
        await plineWithContinuation(`${monsterName(monster, { capitalized: true })} is eating noisily.`);
        return;
    }
    if (heroIsDeaf(game)) {
        const response = (MONSTER_FLAGS1[species] ?? 0) & M1_HUMANOID
            ? 'falls on deaf ears' : 'is inaudible';
        // Native calls canspotmon() for each fragment but names the target once.
        await plineWithContinuation(`Any response${canSpotMonster(monster) ? ` from ${monsterName(monster)}` : ''} ${response}.`);
        return;
    }
    game.context.move = Number(await publishMonsterNoise(monster, game));
}
async function doloot() {
    await lootCommand({ unlockContainer: lootLockedContainer, chooseDirection: getAdjacentLocation });
}
// C pickup.c:do_loot_cont(): untrapping or applying a key takes precedence
// over queuing #force, even when the player declines those earlier offers.
async function lootLockedContainer(container, containerCount) {
    if (!container.olocked)
        return;
    const name = definiteName(objectCombatName(container, { includeCorpseSpecies: false }));
    await pline(container.lknown ? `${name.charAt(0).toUpperCase()}${name.slice(1)} is locked.` : `Hmmm, ${name} turns out to be locked.`);
    container.lknown = true;
    const flags = autoUnlockFlags(game);
    game.context.move = 0;
    if (!flags)
        return;
    game.u.dz = 0;
    const tool = flags & AUTOUNLOCK_APPLY_KEY ? autokey(true) : null;
    if (tool || flags & AUTOUNLOCK_UNTRAP) {
        game.context.move = Number(await pickLock(tool, { target: { x: game.u.ux, y: game.u.uy }, container }));
        return;
    }
    if (flags & AUTOUNLOCK_FORCE && containerCount === 1 && isForceableWeapon(game.uwep)) {
        // The queued command owns its confirmation and any time spent.
        game._cannedCommands ??= [];
        game._cannedCommands.push({ kind: 'command', name: 'force' });
    }
}
// C cmd.c:enter_explore_mode(). The pinned build's sysconf ships
// EXPLORERS=*, so authorize_explore_mode() always grants access; the
// "cannot access explore mode" and "Note: normally..." refusals stay
// unreachable for this environment.
async function enterExploreMode() {
    if (game.flags.explore) {
        await pline('You are already in explore mode.');
    }
    else {
        const oldMode = game.flags.debug ? 'debug mode' : 'normal game';
        await pline(`Beware!  From explore mode there will be no return to ${oldMode},`);
        if (await paranoidQuery(!!((game.flags.paranoia_bits ?? 0) & PARANOID_QUIT), 'Do you want to enter explore mode?')) {
            game.flags.explore = true;
            game.flags.debug = false;
            clearMessageWindow();
            await pline('You are now in non-scoring explore mode.');
        }
        else {
            clearMessageWindow();
            await pline(`Continuing with ${oldMode}.`);
        }
    }
    game.context.move = 0;
}
const EXTENDED_COMMAND_HANDLERS = new Map([
    ['?', showExtendedCommandList],
    ['whatdoes', whatDoesCommand],
    ['whatis', dowhatis],
    ['help', dohelp],
    ['glance', doFarlook],
    ['history', () => displayHelpFile('history')],
    ['showtrap', identifyTrap],
    ['versionshort', doversion],
    ['takeoffall', takeOffAll],
    ['conduct', doconduct],
    ['chronicle', doChronicle],
    ['perminv', doPermanentInventory],
    ['vanquished', doVanquished],
    ['genocided', doGenocided],
    ['terrain', doTerrainOverview],
    ['retravel', dotravelTarget],
    ['redraw', redrawCommand],
    ['optionsfull', () => doOptions(!game.iflags.menu_requested)],
    ['version', doextversion],
    ['quit', doquit],
    ['twoweapon', dotwoweapon],
    ['enhance', doenhance],
    ['chat', dochat],
    ['sit', () => dosit({
            finishTeleport: finishTeleportArrival,
            gotoLevel,
            chooseTeleportDestination: askTeleportDestination,
        })],
    ['pray', dopray],
    ['name', doname],
    ['invoke', doinvoke],
    ['ride', doride],
    ['rub', dorub],
    ['lookaround', dolookaround],
    ['loot', doloot],
    ['tip', tipCommand],
    ['force', doforce],
    ['exploremode', enterExploreMode],
    ['jump', dojump],
    ['overview', doDungeonOverview],
    ['offer', dosacrifice],
    ['dip', dodip],
    ['altdip', dipInto],
    ['turn', doturn],
    ['engrave', doengrave],
    // C extcmdlist[] maps both "call" and "name" to docallcmd().
    ['call', doname],
    ['untrap', () => doUntrap({ enterTrap: moveIntoFailedUntrap })],
    ['wipe', dowipe],
    ['monster', domonability],
    ['polyself', wizPolyself],
    ['panic', wizPanic],
    ['debugfuzzer', wizFuzzer],
    ['annotate', doannotate],
    ['herecmdmenu', doherecmdmenu],
    ['therecmdmenu', dotherecmdmenu],
    ['clicklook', doclicklook],
    ['mouseaction', domouseaction],
    ['adjust', doadjust],
    ['altadjust', adjustSplit],
    // cmd.c:2064 internal entry; #repeat reaches it after the item-actions
    // 'T' remembers ia_dotakeoff.
    ['alttakeoff', () => removeWornItem('take off', true)],
    ['levelchange', wizLevelChange],
    ['wizwhere', wizWhere],
    ['wizwish', wizWish],
    ['wizcast', dowizcast],
    ['wizgenesis', wizGenesis],
    ['wizdetect', wizDetect],
    ['wizsmell', () => wizSmell()],
    ['wizseenv', showSeenVectors],
    ['vision', showVisionFlags],
    ['wmode', showWallModes],
    ['wizrumorcheck', wizRumorCheck],
    ['wizcustom', wizCustom],
    ['wizbury', wizBury],
    ['wiztelekinesis', wizTelekinesis],
    ['migratemons', wizMigrateMonsters],
    ['wizkill', wizKill],
    ['wizidentify', wizIdentify],
    ['wizintrinsic', wizIntrinsic],
    ['wizmap', wizMap],
    ['wizmakemap', wizMakeMap],
    ['wizfliplevel', wizFlipLevel],
    ['wizborn', doborn],
    ['timeout', wizTimeoutQueue],
    ['wizshownhuuid', wizShowNhuuid],
]);
// C refs: artifact.c:doinvoke(), invoke_ok(), arti_invoke().  getobj()
// suggests artifacts and other unique objects; an artifact with inv_prop 0
// still consumes a turn after retouching, but its only effect is the ordinary
// "Nothing happens." line.
async function doinvoke() {
    const object = await chooseInventoryObject('invoke', candidate => candidate.oartifact || OBJECT_UNIQUE[candidate.otyp] || candidate.otyp === CRYSTAL_BALL
        || candidate.otyp === FAKE_AMULET_OF_YENDOR && !candidate.known
        ? GETOBJ_SUGGEST : GETOBJ_EXCLUDE, { forcePrompt: true });
    if (!object) {
        commandResultCancelled(); // artifact.c:doinvoke() returns ECMD_CANCEL.
        return;
    }
    game._pending_message = '';
    const touch = await retouchHeroObject(object);
    if (touch.rejected || touch.died) {
        game.context.move = 1;
        return;
    }
    const artifact = object.oartifact
        ? artifactById(object.oartifact) : null;
    if (!artifact || artifact.invokePower === null) {
        if (object.otyp === CRYSTAL_BALL)
            await useCrystalBall(object);
        else
            await pline('Nothing happens.');
        game.context.move = 1;
        return;
    }
    const invocation = await invokeArtifactPower(object, artifact, {
        enterTrap: moveIntoFailedUntrap,
    });
    if ('heroDied' in invocation && invocation.heroDied)
        return;
    if (invocation.used) {
        game.context.move = 'spentTime' in invocation && invocation.spentTime === false ? 0 : 1;
        return;
    }
    await pline('Nothing happens.');
    game.context.move = 1;
}
// C apply.c:rub_ok().
function rubEligibleObject(object) {
    return object?.otyp === OIL_LAMP || object?.otyp === MAGIC_LAMP
        || object?.otyp === BRASS_LANTERN || isGrayStone(object) || isRoyalJelly(object);
}
// C apply.c:jelly_ok().
async function rubRoyalJelly(jelly) {
    const used = await useRoyalJelly(jelly, async () => {
        const egg = await chooseInventoryObject('rub the royal jelly on', object => object.otyp === EGG ? GETOBJ_SUGGEST : GETOBJ_EXCLUDE, { forcePrompt: true });
        if (egg)
            game._pending_message = '';
        // apply.c:use_royal_jelly() returns ECMD_CANCEL when getobj() for
        // the egg target is declined.
        else
            commandResultCancelled();
        return egg;
    });
    game.context.move = used ? 1 : 0;
    return used;
}
// C refs: apply.c:dorub(), invent.c:getobj(), wield.c:wield_tool(), and
// cmd.c:CQ_CANNED.  Selecting an unwielded lamp does not rub it immediately:
// wield_tool() installs it, consumes one action, and queues dorub plus the
// inventory letter for the next hero command boundary.
async function dorub(cannedInvlet = null) {
    if (heroHasNoHands(game)) {
        await pline("You aren't able to rub anything without hands.");
        game.context.move = 0;
        return;
    }
    const object = cannedInvlet === null
        ? await chooseInventoryObject('rub', candidate => rubEligibleObject(candidate) ? GETOBJ_SUGGEST : GETOBJ_EXCLUDE)
        : game.inventory.find(candidate => candidate.invlet === cannedInvlet
            && rubEligibleObject(candidate));
    if (!object) {
        // apply.c:dorub() returns ECMD_CANCEL without an object; the
        // rhack seam clears the queues so ^A cannot replay the rub.
        commandResultCancelled();
        return;
    }
    // Interactive entry owns a getobj prompt which selection replaces.
    // Canned re-entry happens before the next physical key and inherits the
    // wield/scheduler topline, so its result must append to that message.
    if (cannedInvlet === null)
        game._pending_message = '';
    if (isGrayStone(object)) {
        const result = await useGrayStone(object);
        game.context.move = result.spentTime ? 1 : 0;
        return;
    }
    if (isRoyalJelly(object)) {
        await rubRoyalJelly(object);
        return;
    }
    const wielded = await wieldTool(object, 'rub', { swapWeapons: doswapweapon }, game);
    if (!wielded.ready) {
        game.context.move = 0;
        return;
    }
    if (wielded.newlyWielded) {
        if (!object.invlet)
            throw new Error('A wielded inventory object must have an inventory letter.');
        game._cannedCommands ||= [];
        game._cannedCommands.push({ kind: 'rub', invlet: object.invlet });
        game.context.move = 1;
        return;
    }
    if (object.otyp === MAGIC_LAMP) {
        if ((object.spe || 0) > 0 && rn2(3) === 0) {
            await chargeUnpaidUsage(object, { alternate: true });
            // C performs the bones-safe lamp transformation before the
            // released monster can grant a fatal artifact wish.
            transformMagicLampToOilLamp(object, 1000 + rn2(500), game, game.moves ?? 0);
            requirePlayingGame(game);
            await releaseDjinni(object, game);
            learnObjectType(MAGIC_LAMP);
            game.context.move = 1;
            return;
        }
        if (rn2(2))
            await plineWithContinuation(heroIsBlind(game)
                ? 'You smell smoke.' : 'You see a puff of smoke.');
        else
            await plineWithContinuation('Nothing happens.');
    }
    else if (object.otyp === BRASS_LANTERN) {
        await plineWithContinuation('Rubbing the electric lamp is not particularly rewarding.');
        await plineWithContinuation('Anyway, nothing exciting happens.');
    }
    else {
        await plineWithContinuation('Nothing happens.');
    }
    game.context.move = 1;
}
async function moveIntoFailedUntrap(trap) {
    const u = game.u;
    const newx = trap.tx;
    const newy = trap.ty;
    const dx = newx - u.ux;
    const dy = newy - u.uy;
    const loc = game.level?.at?.(newx, newy);
    if (!loc || blocksMove(newx, newy)
        || (dx && dy && blocksDiagonalDoor(game.level?.at?.(u.ux, u.uy), loc)))
        return { entered: false, died: false };
    const ballChainMove = await beginBallAndChainMove(newx, newy);
    if (ballChainMove?.blocked)
        return { entered: false, died: !!game.program_state.gameover };
    const oldx = u.ux;
    const oldy = u.uy;
    u.ux0 = oldx;
    u.uy0 = oldy;
    await placeHeroOnLevel(newx, newy);
    u.umoved = true;
    await newsym(oldx, oldy);
    await vision_recalc(1);
    await checkHeroLeashes(oldx, oldy);
    if (game.program_state.gameover)
        return { entered: true, died: true };
    await finishBallAndChainMove(ballChainMove);
    // C move_into_trap() has its own arrival order and does not run the
    // footstep, concealment, or dragging-delay tail of domove_core().
    trap.tseen = false;
    await finishDestinationSpotEffects({
        oldx, oldy, newx: u.ux, newy: u.uy,
        trapOptions: { failedUntrap: true },
    });
    if (game.program_state.gameover)
        return { entered: true, died: true };
    const remainingTrap = game.level?.traps?.find(candidate => candidate.tx === u.ux && candidate.ty === u.uy);
    if (remainingTrap)
        remainingTrap.tseen = true;
    await exerciseAttribute(A_WIS, false);
    return { entered: true, died: false };
}
// C ref: cmd.c:domonability().
async function useSteedBreathAbility(steed) {
    requirePlayingGame(game);
    const result = await performPetRangedAttack(steed, game, { forced: true });
    if (result.heroDied || game.program_state.gameover)
        return;
    game.context.move = 1;
}
async function domonability() {
    const canHide = heroHasHidingAbility(game);
    const canSpinWeb = heroCanSpinWeb(game);
    const spiderChoice = canHide && canSpinWeb
        ? await chooseSpiderAbility() : null;
    if (canHide && canSpinWeb && !spiderChoice) {
        game.context.move = 0;
        return;
    }
    const breath = heroBreathAttack(game);
    if (breath) {
        const result = await useHeroBreath({
            state: game,
            attack: breath,
            finishMonsterKill: finishHeroMonsterKill,
        });
        if ('heroDied' in result && result.heroDied)
            return;
        // polyself.c:dobreathe() returns ECMD_CANCEL for a refused direction.
        if (!result.spentTime && result.reason === 'cancelled')
            commandResultCancelled();
        game.context.move = result.spentTime ? 1 : 0;
        return;
    }
    const spit = heroSpitAttack(game);
    if (spit) {
        const result = await useHeroSpit({ state: game, attack: spit });
        if ('heroDied' in result && result.heroDied)
            return;
        // polyself.c:dospit() returns ECMD_CANCEL for a refused direction.
        if (result.used === false && result.reason === 'cancelled')
            commandResultCancelled();
        game.context.move = result.spentTime ? 1 : 0;
        return;
    }
    if (heroCanRemovePunishment(game)) {
        const result = await useHeroNymphAbility({ state: game });
        game.context.move = result.spentTime ? 1 : 0;
        return;
    }
    const gaze = heroGazeAttack(game);
    if (gaze) {
        const result = await useHeroGaze({ state: game, attack: gaze });
        game.context.move = result.spentTime ? 1 : 0;
        return;
    }
    if (heroCanSummonWerePack(game)) {
        const result = await useHeroWereSummon({ state: game });
        game.context.move = result.spentTime ? 1 : 0;
        return;
    }
    if (spiderChoice === 'hide' || (!spiderChoice && canHide)) {
        const result = await useHeroHide({ state: game });
        game.context.move = result.spentTime ? 1 : 0;
        return;
    }
    if (spiderChoice === 'spin' || (!spiderChoice && canSpinWeb)) {
        const result = await useHeroWeb({ state: game });
        game.context.move = result.spentTime ? 1 : 0;
        return;
    }
    if (heroCanMindBlast(game)) {
        const result = await useHeroMindBlast({ state: game });
        game.context.move = result.spentTime ? 1 : 0;
        return;
    }
    if (heroCanSplitLikeGremlin(game)) {
        const result = await useHeroGremlinSplit({ state: game });
        game.context.move = result.spentTime ? 1 : 0;
        return;
    }
    if (heroCanUseUnicornHorn(game)) {
        const result = await useUnicornHorn({ state: game });
        game.context.move = result.spentTime ? 1 : 0;
        return;
    }
    if (heroCanShriek(game)) {
        const result = await useHeroShriek({ state: game });
        game.context.move = result.spentTime ? 1 : 0;
        return;
    }
    if (heroCanChangeVampireShape(game)) {
        const result = await useHeroVampireShift();
        game.context.move = result.spentTime ? 1 : 0;
        return;
    }
    const steed = game.u?.usteed;
    if (steed && monsterBreathAttack(steed)) {
        await useSteedBreathAbility(steed);
        return;
    }
    await pline(heroIsPolymorphed(game)
        ? 'Any special ability you may have is purely reflexive.'
        : "You don't have a special ability in your normal form!");
    game.context.move = 0;
}
// C ref: invent.c:adjust_split(). The split remains linked beside its
// original until the destination is chosen; cancelling merges it back.
async function adjustSplit() {
    game.context.move = 0;
    const object = await chooseInventoryObject('split', candidate => candidate.oclass === 12 ? GETOBJ_EXCLUDE : GETOBJ_SUGGEST);
    if (!object || object.quan < 2 || object.oclass === 12) {
        commandResultFailed(); // invent.c:adjust_split() ECMD_FAIL.
        return;
    }
    const amount = object.quan === 2 ? 1 : await readInventorySplitCount();
    if (amount === null) {
        await pline('Never mind.');
        commandResultCancelled(); // adjust_split() quit answer ECMD_CANCEL.
        return;
    }
    if (amount < 1 || amount >= object.quan) {
        await pline(`Amount to split from current stack must be ${amount < 1
            ? 'at least 1' : `less than ${object.quan}`}.`);
        commandResultCancelled(); // adjust_split() bad amount ECMD_CANCEL.
        return;
    }
    const split = splitObjectStack(object, amount, game);
    if (!split)
        throw new Error('An admitted inventory stack could not be split');
    await doadjust(split, object);
}
// C cmd.c:get_count(GC_ECHOFIRST | GC_CONDHIST) behind doorganize's split:
// the yn answer names the first digit, each "Count: N" echo is
// custompline(SUPPRESS_HISTORY), and only a final count differing from the
// first digit is filed for recall, with Escape leaving a count of zero.
async function readInventorySplitCount() {
    await flushPendingTopline();
    let key = await ynSingleKey('Split off how many? ');
    if (key < 48 || key > 57)
        return null;
    const firstDigit = key - 48;
    let count = BigInt(key - 48);
    let showCount = true;
    for (;;) {
        const text = `Count: ${showCount ? count : ''}`;
        clearMessageWindow();
        await setTopline(text);
        await flush_screen(0);
        game.nhDisplay?.setCursor(text.length, 0);
        key = await readchar();
        if (key >= 48 && key <= 57) {
            const nextCount = count * 10n + BigInt(key - 48);
            // AppendLongDigit() reports native long overflow; get_count()
            // clears that count so subsequent digits can start another.
            count = nextCount > 9223372036854775807n ? 0n : nextCount;
            showCount = true;
        }
        else if (key === 8 || key === 127) {
            count /= 10n;
            showCount = count > 0n;
        }
        else {
            clearMessageWindow();
            // GC_CONDHIST: "Count: N <key>" joins the recall history only
            // when the final count differs from its first digit; Escape
            // breaks with a count of zero.
            const finalCount = key === 27 ? 0n : count;
            if (finalCount !== BigInt(firstDigit))
                putMessageHistory(`Count: ${finalCount} ${keyText(key)}`);
            return key === 32 || key === 10 || key === 13 ? Number(count) : null;
        }
    }
}
// C ref: invent.c:doorganize()/doorganize_core().
async function doadjust(selected = null, splitting = null) {
    const inventory = (game.inventory || [])
        .filter((object) => typeof object.invlet === 'string' && object.invlet.length > 0)
        .sort((a, b) => inventoryLetterRank(a) - inventoryLetterRank(b));
    if (!inventory.length) {
        await pline("You aren't carrying anything to adjust.");
        game.context.move = 0;
        return;
    }
    if (inventory.length === 1 && inventory[0]?.oclass === 12 && inventory[0].invlet === '$') {
        await pline("You aren't carrying anything adjustable.");
        game.context.move = 0;
        return;
    }
    if (!selected && game.flags.fixinv === false)
        reassignInventoryLetters();
    const repairGold = !selected && await checkInventoryGold('adjust');
    let object = selected || await chooseInventoryObject('adjust', candidate => candidate.oclass === 12 && !repairGold ? GETOBJ_EXCLUDE : GETOBJ_SUGGEST, { forcePrompt: true, allowCount: true });
    if (!object) {
        // invent.c:doorganize_core() returns ECMD_CANCEL when getobj() is
        // dismissed; the rhack seam clears both command queues.
        game.context.move = 0;
        commandResultCancelled();
        return;
    }
    if (!splitting) {
        const previous = game.inventory[game.inventory.indexOf(object) - 1];
        if (previous && previous.invlet === object.invlet)
            splitting = previous;
    }
    const source = object.invlet;
    if (!source)
        throw new Error('Adjusting inventory requires a lettered object.');
    // C doorganize_core() chooses '$' itself when repairing gold. A purse
    // already in '$' collects other stacks; one elsewhere merges into '$'.
    if (object.oclass === 12) {
        const collect = object.invlet === '$';
        let purse = object;
        let action = collect ? 'Collecting' : 'Moving';
        for (const candidate of inventory) {
            if (candidate === purse || candidate === object)
                continue;
            if (!collect && candidate.invlet !== '$')
                continue;
            const candidateName = candidate.oextra?.oname ?? candidate.oname;
            const purseName = purse.oextra?.oname ?? purse.oname;
            const merged = (!candidateName || candidateName === purseName)
                ? await mergeObjectStacks(candidate, purse) : null;
            if (merged) {
                purse = merged;
                if (collect)
                    continue;
                action = 'Merging';
            }
            else if (!collect) {
                candidate.invlet = source;
                action = 'Swapping';
            }
            if (!collect)
                break;
        }
        purse.invlet = '$';
        game.inventory.sort((a, b) => inventoryLetterRank(a) - inventoryLetterRank(b));
        if (game.flags.fixinv === false)
            reassignInventoryLetters();
        observeObjectForNaming(purse);
        await pline(`${action}: $ - ${await inventoryItemDescription(purse)}.`);
        game.context.move = 0;
        return;
    }
    const adjusting = object;
    const occupied = new Set(inventory.filter(candidate => candidate !== adjusting && !mergable(candidate, adjusting))
        .map(candidate => candidate.invlet));
    const slots = game.flags.fixinv === false
        ? game.inventory.filter(item => item.oclass !== 12).length + (splitting ? 0 : 1) : 52;
    const recommended = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.slice(0, slots)
        .split('')
        .filter(letter => letter === adjusting.invlet || !occupied.has(letter))
        .join('') + (occupied.has('#') ? '#' : '');
    const destinationPrompt = `${splitting ? `Split ${object.quan}` : 'Adjust letter'} to what [${compactInventoryLetters(recommended)}] (? see used letters)?`;
    // The source item's queued letter bypasses getobj's prompt, but the
    // destination uses tty_yn_function(), which acknowledges unread prose.
    await flushPendingTopline();
    let destination = '';
    for (let attempt = 1;; attempt++) {
        let key = (await yn_function(destinationPrompt, null, '', true)).answer.charCodeAt(0);
        if (key === 63 || key === 42) {
            key = await selectUsedInventoryLetter(splitting ? source : null);
            if (!key)
                continue;
        }
        destination = String.fromCharCode(key);
        // C strchr(quitchars, let) also matches a literal fuzzer NUL.
        if ([0, 27, 32, 10, 13].includes(key) || splitting && destination === source) {
            if (splitting)
                await rejoinObjectStack(splitting, object, game);
            clearMessageWindow();
            await pline('Never mind.');
            game.context.move = 0;
            return;
        }
        if (destination === '$') {
            if (splitting)
                await rejoinObjectStack(splitting, object, game);
            clearMessageWindow();
            await pline("Only gold coins may be moved into the '$' slot.");
            game.context.move = 0;
            return;
        }
        if (/^[a-zA-Z]$/.test(destination) || destination === '#' && occupied.has('#'))
            break;
        if (attempt === 5) {
            if (splitting)
                await rejoinObjectStack(splitting, object, game);
            clearMessageWindow();
            await pline('Never mind.');
            game.context.move = 0;
            return;
        }
        await plineWithContinuation('Select an inventory slot letter.');
        await flushPendingTopline();
    }
    let action = splitting ? 'Splitting:' : destination === source ? 'Collecting:' : 'Moving:';
    let bumped = null;
    // C extracts the selected stack before collecting. A merge can free
    // that object, so it must never reappear among the remaining candidates.
    unlinkObject(object, game);
    for (const candidate of game.inventory.slice()) {
        const name = object.oextra?.oname ?? object.oname;
        const candidateName = candidate.oextra?.oname ?? candidate.oname;
        const permitsName = !candidateName || !!name && name === candidateName;
        if (destination === source) {
            if (permitsName) {
                const merged = await mergeObjectStacks(candidate, object);
                if (merged) {
                    object = merged;
                    unlinkObject(object, game);
                }
            }
            continue;
        }
        if (candidate.invlet !== destination)
            continue;
        const merged = permitsName ? await mergeObjectStacks(candidate, object) : null;
        if (merged) {
            object = merged;
            unlinkObject(object, game);
            action = 'Merging:';
        }
        else if (!splitting) {
            candidate.invlet = source;
            action = 'Swapping:';
        }
        else {
            // A split takes the destination's name when otherwise compatible.
            if (name && !object.oartifact) {
                if (object.oextra)
                    delete object.oextra.oname;
                delete object.oname;
            }
            const splitMerge = await mergeObjectStacks(candidate, object);
            if (splitMerge) {
                object = splitMerge;
                unlinkObject(object, game);
                action = 'Splitting and merging:';
            }
            else {
                if (name) {
                    if (object.oextra)
                        object.oextra.oname = name;
                    object.oname = name;
                }
                if (game.inventory.filter(item => item !== object && item.oclass !== 12).length >= 52) {
                    object.where = 'inventory';
                    game.inventory.unshift(object);
                    await rejoinObjectStack(splitting, object, game);
                    clearMessageWindow();
                    await pline('Your pack is too full.');
                    game.context.move = 0;
                    return;
                }
                unlinkObject(candidate, game);
                bumped = candidate;
            }
        }
        break;
    }
    object.invlet = destination;
    object.where = 'inventory';
    game.inventory.unshift(object);
    if (bumped) {
        assignInventoryLetter(bumped);
        bumped.where = 'inventory';
        game.inventory.unshift(bumped);
    }
    game.inventory.sort((a, b) => inventoryLetterRank(a) - inventoryLetterRank(b));
    if (game.flags.fixinv === false)
        reassignInventoryLetters();
    game._pending_message = '';
    observeObjectForNaming(object);
    await pline(`${action} ${object.invlet} - ${await inventoryItemDescription(object, {
        primaryHandDetail: inventoryPrimaryHandDetail(object),
    })}.`);
    if (bumped)
        await plineWithContinuation(`Moving: ${bumped.invlet} - ${await inventoryItemDescription(bumped)}.`);
    game.context.move = 0;
}
// C ref: pray.c:doturn().
async function doturn() {
    const role = game.urole?.key;
    if (role !== 'priest' && role !== 'knight') {
        const spell = (game.spells || []).find(known => known.name === 'turn undead');
        if (!spell) {
            await pline("You don't know how to turn undead!");
            game.context.move = 0;
            return;
        }
        await castSpell(spell.otyp);
        return;
    }
    await turnUndeadByCallingOnDeity(game);
}
async function dodip() {
    if (await dip({ fountain: dipFountain }) === 'cancelled')
        commandResultCancelled();
}
function visitedDungeonLevels() {
    const byDungeon = new Map();
    const remember = (dnum, dlevel) => {
        if (dnum === undefined || dlevel === undefined
            || !Number.isInteger(dnum) || !Number.isInteger(dlevel))
            return;
        const levels = byDungeon.get(dnum) ?? new Set();
        levels.add(dlevel);
        byDungeon.set(dnum, levels);
    };
    remember(game.u?.uz?.dnum ?? 0, game.u?.uz?.dlevel ?? 1);
    for (const key of game._overviewRecords?.keys() || []) {
        const [dnum, dlevel] = String(key).split(':').map(Number);
        remember(dnum, dlevel);
    }
    return byDungeon;
}
function overviewDepth(dnum, dlevel) {
    return dnum === game.quest_dnum || dnum === game.knox_level?.dnum
        ? dlevel : dungeonDepth(dnum, dlevel);
}
function dungeonOverviewHeading(dnum) {
    const dungeon = game.dungeons?.[dnum];
    if (!dungeon)
        throw new Error(`Overview has no dungeon ${dnum}`);
    const reached = dungeon.dunlev_ureached;
    if (reached === dungeon.entry_lev || In_endgame({ dnum, dlevel: 1 }))
        return `${dungeon?.dname || 'Dungeon'}:`;
    const range = dungeonBuildsUp({ dnum, dlevel: 1 })
        ? `levels ${overviewDepth(dnum, dungeon.entry_lev)} up to ${overviewDepth(dnum, reached)}`
        : `levels ${overviewDepth(dnum, 1)} to ${overviewDepth(dnum, reached)}`;
    return `${dungeon?.dname || 'Dungeon'}: ${range}`;
}
function overviewLevelIsInteresting(dnum, dlevel) {
    const location = { dnum, dlevel };
    if (sameDungeonLevel(location, game.u.uz))
        return true;
    const annotation = game._levelAnnotations?.get?.(`${dnum}:${dlevel}`);
    const record = game._overviewRecords?.get?.(`${dnum}:${dlevel}`);
    const flags = record?.flags;
    if (flags?.notreachable || flags?.forgot)
        return false;
    const tutorial = game.specialLevels?.get('tut-1')?.dnum;
    if (tutorial !== undefined && game.u.uz?.dnum === tutorial)
        return dnum === tutorial;
    if (tutorial !== undefined && dnum === tutorial)
        return false;
    if (flags && (flags.oracle || flags.bigroom || flags.roguelevel || flags.castle
        || flags.valley || flags.msanctum || flags.vibrating_square
        || flags.quest_summons || flags.questing))
        return true;
    if (dnum === game.sokoban_dnum
        && (game.u.uz?.dnum === game.sokoban_dnum || !flags?.sokosolved))
        return true;
    if (In_endgame(game.u.uz))
        return In_endgame(location);
    return !!annotation || !!record?.branch || !!overviewFeatureLine(record?.features)
        || !!record?.finalRestingPlaces?.some(entry => entry.bonesknown || game.flags.debug)
        || dlevel === game.dungeons[dnum]?.dunlev_ureached;
}
// C dungeon.c:print_mapseen(): the current hero precedes ancestors, and only
// the last entry ends in a period. Final disclosure reveals every ancestor.
function overviewRestingPlaceLines(record, final, currentDeath = null) {
    const entries = (record?.finalRestingPlaces ?? [])
        .filter(entry => final || game.flags.debug || entry.bonesknown)
        .map(entry => `${entry.who}, ${entry.how}`);
    if (currentDeath !== null)
        entries.unshift(`you, ${overviewYouCause(currentDeath)}`);
    if (!entries.length)
        return [];
    return ['      Final resting place for', ...entries.map((entry, index) => `         ${entry}${index === entries.length - 1 ? '.' : ','}`)];
}
function overviewCountPhrase(count, noun) {
    if (count === 1)
        return `${/^[aeiou]/i.test(noun) ? 'an' : 'a'} ${noun}`;
    if (count === 2)
        return `some ${noun}s`;
    return `many ${noun}s`;
}
function overviewFeatureLine(features) {
    const phrases = [];
    if (features?.nshop) {
        if (features.nshop === 1) {
            const shop = SHOP_TYPES[(features.shoptype ?? SHOPBASE) - SHOPBASE];
            const type = features.shoptype < SHOPBASE ? 'untended shop'
                : shop?.annotation || shop?.name || 'shop?';
            phrases.push(withIndefiniteArticle(type));
        }
        else {
            phrases.push(overviewCountPhrase(features.nshop, 'shop'));
        }
    }
    const temples = features?.ntemple ?? 0;
    const altars = features?.naltar ?? 0;
    if (temples || altars) {
        let phrase = [temples ? overviewCountPhrase(temples, 'temple') : '',
            altars ? overviewCountPhrase(altars, 'altar') : ''].filter(Boolean).join(' and ');
        const alignment = game.u.ualign?.type;
        if (alignment !== undefined && features?.altarAlignment === alignment)
            phrase += ` to ${deityName(alignment)}`;
        phrases.push(phrase);
    }
    for (const [countKey, noun] of [
        ['nthrone', 'throne'],
        ['nfount', 'fountain'], ['nsink', 'sink'],
        ['ngrave', 'grave'], ['ntree', 'tree'],
    ]) {
        const count = features?.[countKey] ?? 0;
        if (count)
            phrases.push(overviewCountPhrase(count, noun));
    }
    if (!phrases.length)
        return null;
    const text = phrases.join(', ');
    return `      ${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}
function overviewAutomaticNote(dnum, dlevel, record) {
    const flags = record?.flags;
    const here = { dnum, dlevel };
    if (flags?.oracle)
        return 'Oracle of Delphi.';
    if (dnum === game.sokoban_dnum)
        return flags?.sokosolved ? 'Solved.' : 'Unsolved.';
    if (flags?.bigroom)
        return 'A very big room.';
    if (flags?.roguelevel)
        return 'A primitive area.';
    if (sameDungeonLevel(here, game.specialLevels?.get('x-strt'))) {
        if (game.u.uevent?.qcompleted)
            return `Completed quest for ${questLeaderName()}.`;
        if (flags?.questing)
            return `Given quest by ${questLeaderName()}.`;
        return `Home${flags?.notreachable ? ' (no way back...)' : ''}.`;
    }
    if (flags?.ludios)
        return 'Fort Ludios.';
    if (flags?.castle) {
        const knowledge = game.u.uevent?.uheard_tune;
        const tune = knowledge === 2 ? `notes "${game.castleTune || ''}"` : '5-note tune';
        return `The castle${flags.castletune && knowledge
            ? ` (play ${tune} to open or close drawbridge)` : ''}.`;
    }
    if (flags?.valley)
        return 'Valley of the Dead.';
    if (flags?.vibrating_square)
        return "Gateway to Moloch's Sanctum.";
    if (flags?.msanctum)
        return "Moloch's Sanctum.";
    return null;
}
// C dungeon.c print_mapseen() branch note (br_string2 plus the upward
// destination depth): shared by the live #overview and the final disclosure.
function overviewBranchLine(branch) {
    if (!branch)
        return null;
    const target = game.dungeons?.[branch.dnum]?.dname || 'another dungeon';
    const direction = branch.up ? 'up' : 'down';
    const description = branch.type === 'portal'
        ? branch.dnum === game.quest_dnum && game.u.uevent?.qexpelled ? 'Sealed portal' : 'Portal'
        : branch.type === 'no_end1' ? 'Connection'
            : branch.type === 'no_end2' ? `One way stairs ${direction}` : `Stairs ${direction}`;
    const targetLevel = branch.up && !In_endgame(branch)
        ? `, level ${dungeonDepth(branch.dnum, branch.dlevel)}` : '';
    return `      ${description} to ${target}${targetLevel}.`;
}
// C dungeon.c print_mapseen() rephrases the hero's own death reason so the
// "Final resting place for you, ..." line reads in the second person.  Each
// strsubst() swaps only the first match (hacklib.c), not every occurrence.
function overviewYouCause(cause) {
    return cause.replace(' himself', ' yourself')
        .replace(' herself', ' yourself')
        .replace(' his ', ' your ')
        .replace(' her ', ' your ');
}
// C dungeon.c show_overview() with why > 0: the end-of-game disclosure
// bypasses the interesting-level filter and prints every visited level in
// every dungeon with its full mapseen projection.  Endgame levels print
// first when the game ends in the Planes.
export function dungeonOverviewDisclosure(ending, cause) {
    // show_overview() lazily recalculates the current level before building
    // the window.
    recordMappedOverviewState();
    const hereVerb = ending === 'ascended' ? 'are'
        : ending === 'escaped' ? 'left from' : 'were';
    const visited = [...visitedDungeonLevels().entries()]
        .sort(([left], [right]) => left - right);
    const endgame = ([dnum]) => In_endgame({ dnum, dlevel: 1 });
    const ordered = In_endgame(game.u.uz)
        ? [...visited.filter(endgame), ...visited.filter(entry => !endgame(entry))]
        : visited.filter(entry => !endgame(entry));
    const lines = [];
    for (const [dnum, levelSet] of ordered) {
        if (!game.dungeons?.[dnum])
            continue;
        lines.push({ text: dungeonOverviewHeading(dnum),
            itemflags: MENU_ITEMFLAGS_SKIPMENUCOLORS });
        for (const dlevel of [...levelSet].sort((left, right) => left - right)) {
            lines.push(...overviewDisclosureLevel(dnum, dlevel, ending, hereVerb, cause));
        }
    }
    return lines;
}
function overviewDisclosureLevel(dnum, dlevel, ending, hereVerb, cause) {
    const record = game._overviewRecords?.get?.(`${dnum}:${dlevel}`);
    const annotation = game._levelAnnotations?.get?.(`${dnum}:${dlevel}`);
    const current = (game.u?.uz?.dnum ?? 0) === dnum
        && (game.u?.uz?.dlevel ?? 1) === dlevel;
    const prototype = game.flags?.debug && specialLevelAt({ dnum, dlevel })
        ? specialPrototypeAt(dnum, dlevel) : null;
    const title = In_endgame({ dnum, dlevel })
        ? endgameLevelName({ dnum, dlevel })
        : `Level ${overviewDepth(dnum, dlevel)}`;
    const lines = [`   ${title}:${prototype ? ` [${prototype}]` : ''}${annotation ? ` "${annotation}"` : ''}${current ? ` <- You ${hereVerb} here.` : ''}`];
    if (record?.flags.forgot)
        return lines;
    const featureLine = overviewFeatureLine(record?.features);
    if (featureLine)
        lines.push(featureLine);
    const automaticNote = overviewAutomaticNote(dnum, dlevel, record);
    if (automaticNote)
        lines.push(`      ${automaticNote}`);
    if (record?.flags.quest_summons)
        lines.push(`      Summoned by ${questLeaderName()}.`);
    const branchLine = overviewBranchLine(record?.branch ?? null);
    if (branchLine)
        lines.push(branchLine);
    // died_here: the current hero's own resting place is disclosed before
    // bones are created, so it never reveals whether bones are produced.
    lines.push(...overviewRestingPlaceLines(record, true, !ending && current ? cause : null));
    return lines;
}
// C ref: dungeon.c dooverview()/show_overview().  This is dungeon-history
// projection over mapseen/cache state; it is distinct from Delete's
// known-terrain browser, which enters a getpos-style cursor transaction.
async function doDungeonOverview() {
    // The C command lazily calls recalc_mapseen() before rendering.  Refresh
    // the current level from remembered/underfoot terrain at that same
    // boundary; do not infer features from unseen live squares.
    recordMappedOverviewState();
    const annotate = game.iflags.menu_requested;
    game.iflags.menu_requested = false;
    const window = tty_create_nhwindow(NHW_MENU);
    const addLine = (text, location = null) => tty_add_menu(window, { text, identifier: location });
    try {
        await tty_start_menu(window);
        const visited = [...visitedDungeonLevels().entries()]
            .sort(([left], [right]) => left - right);
        for (const [dnum, levelSet] of visited) {
            if (In_endgame(game.u.uz) && !In_endgame({ dnum, dlevel: 1 }))
                continue;
            const levels = [...levelSet].sort((a, b) => a - b)
                .filter(dlevel => annotate || overviewLevelIsInteresting(dnum, dlevel));
            if (!levels.length || !game.dungeons?.[dnum])
                continue;
            addMenuHeading(window, dungeonOverviewHeading(dnum));
            for (const dlevel of levels) {
                const annotation = game._levelAnnotations?.get?.(`${dnum}:${dlevel}`);
                const record = game._overviewRecords?.get?.(`${dnum}:${dlevel}`);
                const current = (game.u?.uz?.dnum ?? 0) === dnum
                    && (game.u?.uz?.dlevel ?? 1) === dlevel;
                const prototype = game.flags?.debug && specialLevelAt({ dnum, dlevel })
                    ? specialPrototypeAt(dnum, dlevel) : null;
                const special = prototype ? ` [${prototype}]` : '';
                const suffix = annotation ? ` "${annotation}"` : '';
                const title = In_endgame({ dnum, dlevel }) ? endgameLevelName({ dnum, dlevel })
                    : `Level ${overviewDepth(dnum, dlevel)}`;
                addLine(`${annotate ? '' : '   '}${title}:${special}${suffix}${current ? ' <- You are here.' : ''}`, annotate ? { dnum, dlevel } : null);
                if (record?.flags.forgot)
                    continue;
                const featureLine = overviewFeatureLine(record?.features);
                if (featureLine)
                    addLine(featureLine);
                const automaticNote = overviewAutomaticNote(dnum, dlevel, record);
                if (automaticNote)
                    addLine(`      ${automaticNote}`);
                if (record?.flags.quest_summons)
                    addLine(`      Summoned by ${questLeaderName()}.`);
                const branchLine = overviewBranchLine(record?.branch ?? null);
                if (branchLine)
                    addLine(branchLine);
                for (const line of overviewRestingPlaceLines(record, false))
                    addLine(line);
            }
        }
        tty_end_menu(window);
        const selection = await tty_select_menu(window, annotate ? PICK_ONE : PICK_NONE);
        const target = selection.selections[0]?.identifier;
        if (target)
            await queryLevelAnnotation(target, true);
    }
    finally {
        await tty_destroy_nhwindow(window);
    }
    game._pending_message = '';
    game.context.move = 0;
}
// C ref: insight.c:do_gamelog()/show_gamelog(ENL_GAMEINPROGRESS).  Chronicle
// is a projection of events recorded by their owning mechanics; it does not
// infer history from the command transcript or current aggregate counters.
// Spoiler-flagged lines (insight.c:spoilerevent) stay hidden outside wizard
// mode; if every entry is one, the window still shows " none".
async function doChronicle() {
    const events = gameLogEvents(game);
    if (!events.length) {
        await pline('No chronicled events.');
        game.context.move = 0;
        return;
    }
    const visible = game.flags.debug
        ? events : events.filter(event => !isSpoilerGameLogEvent(event));
    const lines = ['Logged events:'];
    if (visible.length) {
        lines.push(' Turn');
        lines.push(...visible.map(event => `${String(event.turn).padStart(5)}: ${event.text}`));
    }
    else {
        lines.push(' none');
    }
    // show_gamelog() putstr()s one formatted line at a time, so the tty
    // text window's compress_str() and wrap apply per event line.
    // show_gamelog() destroys a full-screen NHW_TEXT window, whose tty
    // dismissal (erase_menu_or_text()) already redraws map and status.
    await showTextWindow(lines);
    game._pending_message = '';
    game.context.move = 0;
}
async function doVanquished() {
    await listVanquished(game.iflags.menu_requested ? 'A' : 'y');
    game.context.move = 0;
}
async function doGenocided() {
    await listGenocided(game.iflags.menu_requested ? 'a' : 'y');
    game.context.move = 0;
}
export function inventoryCommandLetter(item) {
    if (item.invlet === null || item.invlet === undefined)
        throw new TypeError(`Carried object ${item.o_id} has no inventory letter`);
    return item.invlet;
}
// C cmd.c:doextcmd() runs the list inside its editor loop and retains the
// last executed command separately from the next editor selection.
async function readExtendedCommand() {
    let lastExecuted = null;
    for (;;) {
        // tty_get_ext_cmd() calls its line editor directly, bypassing core
        // getlin()'s status suppression. Its prompt restores status after #?.
        const selected = game.flags.extmenu ? await extendedCommandMenu() : await editExtendedCommand();
        if (selected?.handler !== 'doextlist')
            return { selected, lastExecuted };
        if (!await commandAllowed(selected))
            return { selected: null, lastExecuted };
        await showExtendedCommandList();
        lastExecuted = selected;
    }
}
// TTY's extended-command line editor redraws the prompt at every input
// boundary. Completion expands visually while typed input advances the cursor.
async function editExtendedCommand() {
    let command = '';
    let completion = null;
    const initiator = visibleCommandKey(game.commandBindings.keyForCommand('#'));
    // custompline(SUPPRESS_HISTORY) files the line before the prompt, then
    // the loop head makes the "# " line the current topline. show_topl()'s
    // addtopl() ends TOPLINE_SPECIAL_PROMPT as soon as it draws the prompt.
    await setTopline(`${initiator} `);
    game._toplines = `${initiator} `;
    game._pending_message = initiator;
    await flush_screen(1);
    game.nhDisplay?.setCursor(initiator.length + 1, 0);
    const redrawCommand = async () => {
        const displayedCommand = completion || command;
        game._toplines = command ? `${initiator} ${displayedCommand}` : `${initiator} `;
        game._pending_message = command
            ? `${initiator} ${displayedCommand}` : initiator;
        await flush_screen(1);
        const display = game.nhDisplay;
        const columns = display?.cols ?? COLNO;
        // A message-window getlin can physically wrap past the right edge.
        // tty's continuation begins at column 1; once wrapping starts it
        // clears that message row rather than exposing the map below it.
        if (display?.grid && game._pending_message.length >= columns) {
            display.clearRow(1);
            const continuation = game._pending_message.slice(columns);
            for (let index = 0; index < continuation.length; index++)
                display.setCell(1 + index, 1, continuation.charAt(index), NO_COLOR, 0);
        }
        // NEWAUTOCOMP leaves the insertion pointer immediately after the
        // physically typed prefix, not after its displayed suffix.
        const insertion = command.length + initiator.length + 1;
        if (insertion > columns - 1)
            display?.setCursor(insertion - (columns - 1), 1);
        else
            display?.setCursor(insertion, 0);
    };
    let doprev = false;
    for (;;) {
        const key = await nhgetch();
        if (key === 16) {
            // C win/tty/getline.c hooked_tty_getlin(): the "#" editor
            // browses history with ^P like any getlin, with inread clear
            // so full/combination modes page their windows. A wrapped
            // editor line pages on its first recall too.
            const mode = messageWindowMode();
            if (mode === 's' || (mode === 'c' && !doprev)) {
                if (!doprev)
                    await doprevMessage(false);
                await doprevMessage(false);
                doprev = true;
            }
            else {
                await doprevMessage(false);
                doprev = false;
                game._messageHistoryCursor = null;
                // `*bufp = 0` drops the auto-completed suffix before repainting.
                completion = null;
                await redrawCommand();
            }
            continue;
        }
        if (doprev) {
            // The first ordinary key after single-mode browsing only
            // repaints the prompt; the key itself is still processed.
            game._messageHistoryCursor = null;
            doprev = false;
            completion = null;
            await redrawCommand();
        }
        if (key === 27) {
            // tty_getlin(): Escape first clears non-empty input; only Escape
            // at an already empty prompt cancels the extended command.
            if (command) {
                command = '';
                completion = null;
                await redrawCommand();
                continue;
            }
            game._pending_message = '';
            game._retained_message = '';
            game._toplines = '';
            // getline.c:213 leaves TOPLINE_NON_EMPTY behind its prompt.
            game._promptOwnsTopline = false;
            game.nhDisplay?.clearRow(0);
            game.context.move = 0;
            return null;
        }
        if (key === 10 || key === 13)
            break;
        if (key === 8 || key === 127) {
            if (command) {
                command = command.slice(0, -1);
                completion = null;
                await redrawCommand();
            }
            continue;
        }
        if (key === 21) {
            // The tty kill character clears both typed text and completion.
            if (command) {
                command = '';
                completion = null;
                await redrawCommand();
            }
            continue;
        }
        const ch = String.fromCharCode(key);
        if (key < 32 || key === 127 || command.length >= COLNO)
            continue;
        command += ch;
        completion = completeExtendedCommand(command);
        await redrawCommand();
    }
    // tty_getlin() clears its message window on return. The completed
    // editor is not an unread message for a later cls() to acknowledge.
    game._pending_message = '';
    game._retained_message = '';
    game._toplines = '';
    game._promptOwnsTopline = false;
    game.nhDisplay?.clearRow(0);
    const normalizedCommand = (completion || command)
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();
    if (!normalizedCommand) {
        game._pending_message = '';
        game.nhDisplay?.clearRow(0);
        game.nhDisplay?.setCursor(game.u.ux - 1, game.u.uy + 1);
        game.context.move = 0;
        return null;
    }
    const selected = availableExtendedCommands().find(entry => entry.name === normalizedCommand);
    if (!selected)
        await pline(`${initiator}${normalizedCommand.slice(0, 60)}: unknown extended command.`);
    return selected ?? null;
}
// C teleport.c:control_mon_tele() and the shared getpos() input prelude.
export async function askMonsterTeleportDestination(monster, start) {
    await plineWithContinuation(`Teleport ${monsterName(monster, {
        article: 'your', suppressIt: true,
    })} @ <${monster.mx},${monster.my}> where?`);
    const goal = `where to teleport ${monsterName(monster, {
        article: 'your', suppressIt: true,
    })}`;
    const firstUse = shouldShowGetposTip();
    if (firstUse)
        await showGetposTip();
    if (game.flags.verbose)
        await plineWithContinuation("(For instructions type a '?')");
    if (firstUse)
        await plineWithContinuation(`Move cursor to ${goal}:`);
    const destination = await selectMapPosition({
        start, prompt: game._pending_message, goal, force: false,
    });
    return destination;
}
export async function askTeleportDestination({ onPrompt = null } = {}) {
    const subject = game.u.usteed
        ? `you and ${monsterName(game.u.usteed)}` : 'you';
    await plineWithContinuation(`Where do ${subject} want to be teleported?`);
    await onPrompt?.();
    const firstUse = shouldShowGetposTip();
    if (firstUse)
        await showGetposTip();
    if (game.flags.verbose)
        await plineWithContinuation("(For instructions type a '?')");
    if (firstUse)
        await plineWithContinuation('Move cursor to the desired position:');
    const target = game._travelTarget;
    const destination = await selectMapPosition({
        start: target && isok(target.x, target.y)
            ? { ...target } : { x: game.u.ux, y: game.u.uy },
        prompt: game._pending_message,
        goal: 'the desired position',
    });
    game._pending_message = '';
    return destination;
}
// C refs: cmd.c dotelecmd(), teleport.c dotele()/teleds(), getpos.c getpos(),
// and priest.c intemple(). A successful position teleport returns
// ECMD_TIME.  Its first getpos use still owns the shared Lua tutorial, while
// the destination room separately owns entry effects after relocation.
async function teleportAtWillCommand(ignoreRestrictions) {
    const result = await teleportHeroAtWill({
        ignoreRestrictions, chooseDestination: askTeleportDestination,
    });
    game.context.move = Number(result.spentTime);
}
// C apply.c:dojump(): the physical command shares the spell's jump owner.
async function dojump() {
    const result = await jumpHero(0);
    game.context.move = result.spentTime ? 1 : 0;
}
// C refs: cmd.c dotravel(), getpos.c getpos(), hack.c handle_tip(), and
// dat/nhcore.lua show_getpos_tip().  The tty message window and the Lua text
// window own distinct input boundaries; after the tutorial, getpos retains
// its cursor and accepts terrain-symbol cycling before one of the pick keys.
async function dotravel() {
    game.iflags.getloc_travelmode = true;
    // C cmd.c dotravel(): the travel pline precedes getpos() and joins the
    // instructions pline in the tty topline transaction; only the menu path
    // skips both.
    if (!game.iflags.menu_requested)
        await pline('Where do you want to travel to?');
    // getpos_menu() omits auto_describe()'s travel-path warning.
    const cursor = game.iflags.menu_requested
        ? await selectTravelMenuPosition(lookatDescription)
        : await selectMapPosition({
            start: game._travelTarget
                ? { ...game._travelTarget } : { x: game.u.ux, y: game.u.uy },
            prompt: async () => {
                // getpos() consumes a queued direction before handle_tip() and
                // the instructions line; only keyboard selection needs these.
                const firstUse = await showGetposTip();
                await showGetposInstructions();
                if (firstUse)
                    await pline('Move cursor to the desired destination:');
                return game._pending_message;
            },
            goal: 'the desired destination',
        });
    if (!cursor) {
        game.iflags.getloc_travelmode = false;
        // dotravel() returns ECMD_OK for menu dismissal, ECMD_CANCEL for ESC
        // in getpos(). Only the latter discards both command queues.
        if (game.iflags.menu_requested)
            game.context.move = 0;
        else
            commandResultCancelled();
        return;
    }
    // getpos() leaves its painted location description on the physical tty
    // after the pick key, but removes it from the logical topline transaction.
    // Silent travel can retain that row; a new attack must replace rather than
    // append to "staircase down".
    game._pending_message = '';
    game._travelTarget = { x: cursor.x, y: cursor.y };
    await dotravelTarget();
}
// C cmd.c:dotravel_target(). Keyboard travel and retravel share the first
// movement transaction, including the time spent on an unreachable target.
async function dotravelTarget() {
    const target = game._travelTarget;
    if (!target || !isok(target.x, target.y)) {
        await pline('No travel destination set.');
        game.context.move = 0;
        return;
    }
    if (target.x === game.u.ux && target.y === game.u.uy) {
        game._travelTarget = null;
        await pline('You are already here.');
        game.context.move = 0;
        return;
    }
    game.iflags.getloc_travelmode = false;
    const state = startTravel(target.x, target.y);
    const outcome = await domove(game.u.dx ?? 0, game.u.dy ?? 0);
    const moved = outcome === 'time';
    if (game.program_state.gameover)
        return;
    // C domove_core() skips runmode_delay_output() on early returns,
    // including attacks, blocked steps and the final travel pet bump.
    // A refused pet swap reaches the tail after restoring the hero.
    const reachedTail = !!game._domoveReachedTail;
    if (moved && reachedTail)
        await captureRunmodeDelay(game, !!game.context.run || game.multi > 0);
    // The target-selection command itself is time-consuming.  A blocked
    // first step stops travel but still reaches the monster/global turn.
    game.context.move = 1;
    const arrived = game.u.ux === state.targetX && game.u.uy === state.targetY;
    if (arrived)
        game._travelTarget = null;
    if (!moved && outcome !== 'opened-door')
        stopRun();
    // Only findtravelpath()'s own nomul(0)-then-run=8 paths (the adjacent
    // shortcut and the backward-search arrival) keep C's lingering run at
    // 8.  A step that entered the target without one of those ends at C's
    // found: label instead: nomul(0) leaves run 0 with the repaint pending.
    else if (arrived && !game._runState)
        arriveTravel(game);
    else if (arrived)
        stopRun();
    // Pathfinding can end travel without entering the target. Keep
    // C's restored run value and let screen flushes own time updates.
    else if (!game._runState && game.context.run === 8)
        arriveTravel(game);
}
async function doversion() {
    if (game.iflags.menu_requested)
        await doextversion();
    else
        await pline(NATIVE_VERSION);
    game.context.move = 0;
}
function droppedObjectDescription(object) {
    const quantity = objectQuantity(object);
    // C do.c:drop() delegates to objnam.c:doname(), which keeps beatitude
    // and enchantment knowledge independent.  Merely carrying (or wishing
    // for) an object does not authorize either adjective.  xname_flags()
    // also applies implicit_uncursed after any Priest BUC observation.
    observeBucForNaming(object);
    const buc = bucAdjectiveForName(object) || '';
    const enchantment = object.known && [2, 3].includes(object.oclass)
        ? (typeof object.enchantment === 'number' && Number.isInteger(object.enchantment)
            ? object.enchantment
            : Number.isInteger(object.spe) ? object.spe : null)
        : null;
    const bonus = enchantment === null ? ''
        : `${enchantment >= 0 ? '+' : ''}${enchantment}`;
    const name = quantity > 1 ? object.plural || `${object.name}s` : object.name;
    const core = [buc, bonus, name].filter(Boolean).join(' ');
    return quantity > 1 ? `${quantity} ${core}`
        : withIndefiniteArticle(core);
}
async function dodrop() {
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
// C refs: lock.c doclose(); cmd.c getdir()/help_dir().  Invalid direction
// help is a modal text window: bytes typed before a real More dismissal must
// not leak back into the top-level command dispatcher.
async function doclose() {
    if (heroHasNoHands(game)) {
        await pline("You can't close anything -- you have no hands!");
        game.context.move = 0;
        return;
    }
    if (game.u.utrap && game.u.utraptype === TT_PIT) {
        await pline("You can't reach over the edge of the pit.");
        game.context.move = 0;
        return;
    }
    const direction = await promptDirection();
    if (!direction) {
        commandResultCancelled(); // lock.c:doclose() returns ECMD_CANCEL.
        game.context.move = 0;
        return;
    }
    const x = game.u.ux + direction.dx;
    const y = game.u.uy + direction.dy;
    if (x === game.u.ux && y === game.u.uy && !heroPassesWalls(game)) {
        await pline('You are in the way!');
        game.context.move = 1;
        return;
    }
    if (!isok(x, y)) {
        await pline(`You ${heroIsBlind(game) ? 'feel' : 'see'} no door there.`);
        game.context.move = 0;
        return;
    }
    const loc = game.level?.at(x, y);
    if (await stumbleOnDoorMimic(x, y)) {
        game.context.move = 1;
        return;
    }
    game.context.move = game.u.confused || game.u.confusionTurns
        || game.u.stunned || game.u.stunnedTurns ? 1 : 0;
    if (loc && heroIsBlind(game)) {
        const previousGlyph = loc.remembered_glyph?.glyph;
        recordMappedOverviewState();
        const previousTerrain = loc.lastseentyp;
        await feel_location(x, y);
        if (loc.remembered_glyph?.glyph !== previousGlyph || loc.lastseentyp !== previousTerrain)
            game.context.move = 1;
    }
    const portcullis = loc && (loc.typ === DOOR || loc.typ === DBWALL)
        && findDrawbridgeAt(x, y) !== null;
    if (portcullis || loc?.typ !== DOOR) {
        if (loc?.typ === DBWALL || loc?.typ === DRAWBRIDGE_UP)
            await pline('The drawbridge is already closed.');
        else if (portcullis || loc?.typ === DRAWBRIDGE_DOWN)
            await pline('There is no obvious way to close the drawbridge.');
        else
            await pline(`You ${heroIsBlind(game) ? 'feel' : 'see'} no door there.`);
        return;
    }
    if (loc.doormask === D_NODOOR) {
        await pline('This doorway has no door.');
        return;
    }
    requirePlayingGame(game);
    if (await doorObstructed(x, y, false, game))
        return;
    if (loc.doormask === D_BROKEN) {
        await pline('This door is broken.');
        return;
    }
    if (loc.doormask & (D_CLOSED | D_LOCKED)) {
        await pline('This door is already closed.');
        return;
    }
    if (loc.doormask === D_ISOPEN) {
        if (heroIsVerySmall(game) && !game.u.usteed) {
            await pline("You're too small to push the door closed.");
            return;
        }
        const effort = Math.trunc((currentStrength()
            + currentAttribute(A_DEX) + currentAttribute(A_CON)) / 3);
        if (game.u.usteed || rn2(25) < effort) {
            await pline('The door closes.');
            loc.doormask = D_CLOSED;
            await feel_newsym(x, y);
            vision_note_blocker_change(x, y);
        }
        else {
            await exerciseAttribute(A_STR, true);
            await pline('The door resists!');
        }
    }
    game.context.move = 1;
}
// C refs: lock.c doopen(); cmd.c get_adjacent_loc()/getdir().  Direction
// validation is owned by the same modal assistance transaction as close;
// the door mutation happens only after that transaction returns a direction.
export async function doopen(x = 0, y = 0) {
    if (heroHasNoHands(game)) {
        await pline("You can't open anything -- you have no hands!");
        game.context.move = 0;
        return;
    }
    if (!(x > 0 && y >= 0)) {
        const boxes = game.level?.objects[game.u.ux]?.[game.u.uy] ?? [];
        const inPitWithContainer = game.u.utrap && game.u.utraptype === TT_PIT
            && boxes.some(object => isContainer(object));
        const direction = await promptDirection(inPitWithContainer
            ? (_message, retry) => readDirectionKey('Open where? [.>] ', retry) : readDirectionKey);
        if (!direction) {
            await pline('Never mind.');
            game.context.move = 0;
            return;
        }
        x = game.u.ux + direction.dx;
        y = game.u.uy + direction.dy;
    }
    if (!isok(x, y)) {
        game.context.move = 0;
        return;
    }
    const loc = game.level?.at(x, y);
    if (x === game.u.ux && y === game.u.uy
        && ((game.u.dz ?? 0) > 0 || loc?.typ !== DOOR || !(loc.doormask & (D_CLOSED | D_LOCKED)))) {
        await doloot();
        return;
    }
    if (game.u.utrap && game.u.utraptype === TT_PIT) {
        await pline("You can't reach over the edge of the pit.");
        game.context.move = 0;
        return;
    }
    if (await stumbleOnDoorMimic(x, y)) {
        game.context.move = 1;
        return;
    }
    let spentTime = !!(game.u.confused || game.u.confusionTurns
        || game.u.stunned || game.u.stunnedTurns);
    if (loc) {
        const previousGlyph = loc.remembered_glyph?.glyph;
        recordMappedOverviewState();
        const previousTerrain = loc.lastseentyp;
        await newsym(x, y);
        // doopen_indir() uses a turn when looking at the target teaches
        // the hero something, even if the target has no door to open.
        if (loc.remembered_glyph?.glyph !== previousGlyph || loc.lastseentyp !== previousTerrain)
            spentTime = true;
    }
    game.context.move = Number(spentTime);
    const portcullis = loc && (loc.typ === DOOR || loc.typ === DBWALL)
        && findDrawbridgeAt(x, y) !== null;
    if (portcullis || loc?.typ !== DOOR) {
        if (loc?.typ === DBWALL || loc?.typ === DRAWBRIDGE_UP) {
            await pline('There is no obvious way to open the drawbridge.');
            return;
        }
        if (portcullis || loc?.typ === DRAWBRIDGE_DOWN) {
            await pline('The drawbridge is already open.');
            return;
        }
        const floorPile = game.level?.objects[x]?.[y] ?? [];
        // Native Is_container includes a bag of tricks for this hint.
        const hasContainer = floorPile.some(object => object.otyp >= LARGE_BOX && object.otyp <= BAG_OF_TRICKS);
        const blind = heroIsBlind(game);
        await pline(hasContainer
            ? `${blind ? 'Feels' : 'Seems'} like something lootable over there.`
            : `You ${blind ? 'feel' : 'see'} no door there.`);
        return;
    }
    if (loc.doormask === D_BROKEN) {
        await pline('This door is broken.');
        return;
    }
    if (loc.doormask === D_NODOOR) {
        await pline('This doorway has no door.');
        return;
    }
    if (loc.doormask === D_ISOPEN) {
        await pline('This door is already open.');
        return;
    }
    if (loc.doormask & D_LOCKED) {
        game.context.move = Number(await openLockedDoor(x, y));
        return;
    }
    if (heroIsVerySmall(game)) {
        await pline("You're too small to pull the door open.");
        return;
    }
    if (rnl(20) < Math.trunc((currentStrength()
        + currentAttribute(A_DEX)
        + currentAttribute(A_CON)) / 3)) {
        await openClosedDoor(loc, x, y);
    }
    else {
        await exerciseAttribute(A_STR, true);
        await pline('The door resists!');
    }
    if (game.program_state.gameover)
        return;
    game.context.move = 1;
}
// lock.c:doopen_indir() announces opening before the explosion. The door
// remains closed across that message pause and any fatal explosion.
async function openClosedDoor(door, x, y) {
    await plineWithContinuation('The door opens.');
    if (door.doormask & D_TRAPPED) {
        if (await triggerBoobyTrap('door', { bodypart: true }))
            return;
        door.doormask = D_NODOOR;
        const level = requireGameLevel();
        if (roomsAt(level, x, y, SHOPBASE).length)
            addShopDamage(x, y, SHOP_DOOR_COST);
    }
    else
        door.doormask = D_ISOPEN;
    await feel_newsym(x, y);
    vision_note_blocker_change(x, y);
}
async function pickAxeDirection(prompt) {
    return promptDirection((_message, retry) => readDirectionKey(`${prompt} `, retry));
}
async function applyPickAxe(item) {
    const result = await usePickAxe(item, {
        state: game,
        ensureWielded: () => wieldTool(item, 'swing', { swapWeapons: doswapweapon }, game),
        readDirection: pickAxeDirection,
        payShopkeeper: dopay,
        attackMonster: (monster) => attackHostileMonster(monster, monster.mx, monster.my),
    });
    if ('died' in result && result.died)
        return;
    if (result.cancelled)
        commandResultCancelled(); // dig.c:use_pick_axe() res|ECMD_CANCEL.
    if ('resume' in result && result.resume) {
        game._cannedCommands ||= [];
        game._cannedCommands.push({ kind: 'apply', invlet: inventoryCommandLetter(item) });
    }
    game.context.move = 'spentTime' in result && result.spentTime ? 1 : 0;
}
export async function applyPolearm(item, autohit = false) {
    const result = await usePolearm(item, {
        state: game,
        autohit,
        ensureWielded: () => wieldTool(item, 'swing', { swapWeapons: doswapweapon }, game),
    });
    if ('heroDied' in result && result.heroDied)
        return;
    if ('resume' in result && result.resume) {
        game._cannedCommands ||= [];
        game._cannedCommands.push({ kind: 'apply', invlet: inventoryCommandLetter(item) });
    }
    // use_pole() returns ECMD_CANCEL for a refused target prompt and
    // ECMD_FAIL for an out-of-range or unseen one (apply.c:3474-3505).
    if ('cancelled' in result && result.cancelled)
        commandResultCancelled();
    if ('failure' in result && result.failure)
        commandResultFailed();
    game.context.move = 'spentTime' in result && result.spentTime ? 1 : 0;
}
async function doapply(cannedInvlet = null) {
    // apply.c:doapply() rejects the current body and excessive load before
    // choosing an object through getobj().
    if (heroHasNoHands(game)) {
        await pline("You aren't able to use or apply tools in your current form.");
        game.context.move = 0;
        return;
    }
    if (exceedsActionCapacity(game)) {
        await pline("You can't do that while carrying so much stuff.");
        game.context.move = 0;
        return;
    }
    const underlay = snapshotMenuUnderlay();
    const item = cannedInvlet === null
        ? await chooseInventoryObject('use or apply', applySuggestion)
        : game.inventory.find(object => object.invlet === cannedInvlet
            && [GETOBJ_SUGGEST, GETOBJ_DOWNPLAY].includes(applySuggestion(object)));
    if (!item) {
        commandResultCancelled(); // doapply() returns ECMD_CANCEL without an object.
        return;
    }
    const touch = await retouchHeroObject(item);
    if (touch.rejected || touch.died) {
        game.context.move = 1;
        return;
    }
    if (item.oclass === 11) {
        const result = await breakWand(item);
        game.context.move = result.spentTime ? 1 : 0;
        return;
    }
    if (item.oclass === 10 || item.oclass === 12) {
        const result = item.oclass === 10
            ? await flipThroughBook(item) : await flipCoin(item);
        game.context.move = result.spentTime ? 1 : 0;
        return;
    }
    game.context.move = 0;
    const appliedObject = await applyTool(item, underlay);
    if (!game.program_state.gameover && appliedObject
        && await speakArtifact(appliedObject)) {
        // doapply() ORs arti_speak()'s ECMD_TIME into the tool result, so
        // a cancelled tool use still spends its turn when it speaks.
        commandResultSpentTime();
        game.context.move = 1;
    }
}
// Return the surviving object for the native talking-artifact tail. Applied
// stacks can split or disappear, so each destructive owner returns its object.
export async function applyTool(item, underlay) {
    if (item.otyp === CRYSTAL_BALL) {
        const object = await useCrystalBall(item);
        game.context.move = 1;
        return object;
    }
    if (item.otyp === LAND_MINE || item.otyp === BEARTRAP) {
        const object = await useSettableTrap(item);
        game.context.move = 1;
        return object;
    }
    if (item.otyp === TINNING_KIT) {
        await useTinningKit(item);
        game.context.move = 1;
        return item;
    }
    if (item.otyp === HORN_OF_PLENTY) {
        await useHornOfPlenty(item);
        game.context.move = 1;
        return item;
    }
    if (item.otyp === BAG_OF_TRICKS) {
        await useBagOfTricks(item);
        game.context.move = 1;
        return item;
    }
    if (item.otyp === SADDLE) {
        game.context.move = await useSaddle(item) ? 1 : 0;
        return item;
    }
    if (item.otyp === CAN_OF_GREASE) {
        game.context.move = await useGrease(item) ? 1 : 0;
        return item;
    }
    if (item.otyp === LEASH) {
        game.context.move = await useLeash(item) ? 1 : 0;
        return item;
    }
    if (item.otyp === FIGURINE) {
        const result = await useFigurine(item);
        game.context.move = result.spentTime ? 1 : 0;
        return result.object;
    }
    if (item.otyp === EXPENSIVE_CAMERA || item.otyp === TOWEL
        || item.otyp === BELL || item.otyp === BELL_OF_OPENING) {
        const result = item.otyp === EXPENSIVE_CAMERA ? await useCamera(item)
            : item.otyp === TOWEL ? await useTowel(item) : await useBell(item);
        game.context.move = result.spentTime ? 1 : 0;
        return result.object;
    }
    if (item.otyp === MIRROR) {
        const result = await useMirror(item);
        game.context.move = result.spentTime ? 1 : 0;
        return result.object;
    }
    if ([TIN_WHISTLE, MAGIC_WHISTLE, EUCALYPTUS_LEAF].includes(item.otyp)) {
        const result = await useWhistle(item);
        game.context.move = result.spentTime ? 1 : 0;
        return item;
    }
    if ([TALLOW_CANDLE, WAX_CANDLE, CANDELABRUM_OF_INVOCATION, POT_OIL,
        OIL_LAMP, BRASS_LANTERN, MAGIC_LAMP].includes(item.otyp)) {
        let result;
        if (item.otyp === CANDELABRUM_OF_INVOCATION)
            result = await useCandelabrum(item);
        else if (item.otyp === POT_OIL)
            result = await lightCocktail(item);
        else if ([TALLOW_CANDLE, WAX_CANDLE].includes(item.otyp))
            result = await useCandle(item);
        else
            result = await useLamp(item);
        game.context.move = result.spentTime ? 1 : 0;
        return result.object;
    }
    if (isGrayStone(item)) {
        const result = await useGrayStone(item);
        game.context.move = result.spentTime ? 1 : 0;
        return item;
    }
    if (item.otyp === BULLWHIP) {
        const wielded = await wieldTool(item, 'lash', { swapWeapons: doswapweapon }, game);
        if (!wielded.ready) {
            game.context.move = 0;
            return item;
        }
        if (wielded.newlyWielded) {
            game._cannedCommands ||= [];
            game._cannedCommands.push({
                kind: 'apply', invlet: inventoryCommandLetter(item),
            });
            game.context.move = 1;
            return item;
        }
        const direction = await promptDirection();
        if (!direction) {
            // use_whip() reports ECMD_CANCEL when getdir() is refused;
            // the rhack seam clears both command queues for that.
            commandResultCancelled();
            game.context.move = 0;
            return item;
        }
        game._pending_message = '';
        const result = await useBullwhip(item, direction, {
            state: game,
            // C apply.c:use_whip() reaches do_attack() through
            // uhitm.c:force_attack(): anything that is not a pet is
            // struck with forcefight forced on, while a pet keeps
            // do_attack()'s safepet displacement block.
            attackMonster: async (monster, x, y) => {
                if (monster.mtame && !game.context.forcefight
                    && heroMayDisplaceMonster(monster)
                    && artifactById(game.uwep?.oartifact, game)?.name
                        !== 'Stormbringer') {
                    return await runSafepetDisplacement(monster) !== 'evaded';
                }
                const savedForcefight = game.context.forcefight ?? false;
                if (!monster.mtame)
                    game.context.forcefight = true;
                try {
                    const verdict = await prepareAppliedWeaponAttack(monster, game.uwep ?? null, { state: game, struckAt: { x, y } });
                    if (!verdict.proceed)
                        return verdict.spentTime;
                    return await attackHostileMonster(monster, x, y, {
                        confirmationOverridden: verdict.confirmationOverridden ?? false,
                    });
                }
                finally {
                    game.context.forcefight = savedForcefight;
                }
            },
        });
        game.context.move = result.spentTime ? 1 : 0;
        return item;
    }
    if (isPick(item) || isAxe(item)) {
        await applyPickAxe(item);
        return item;
    }
    if (isPolearm(item)) {
        await applyPolearm(item);
        return item;
    }
    if (item.otyp === GRAPPLING_HOOK) {
        const result = await useGrapplingHook(item, {
            state: game,
            ensureWielded: () => wieldTool(item, 'cast', { swapWeapons: doswapweapon }, game),
            hurtle: (dx, dy) => hurtleHero(dx, dy, 1, {
                finishTeleport: finishTeleportArrival,
                gotoLevel,
                chooseTeleportDestination: askTeleportDestination,
                finishMonsterDeath: finishHurtleMonsterDeath,
            }),
        });
        if (result.resume) {
            game._cannedCommands ||= [];
            game._cannedCommands.push({
                kind: 'apply', invlet: inventoryCommandLetter(item),
            });
        }
        game.context.move = result.spentTime ? 1 : 0;
        return item;
    }
    if ([BLINDFOLD, LENSES].includes(item.otyp)) {
        game._pending_message = '';
        await applyEyewear(item);
        if (game.program_state.gameover)
            return item;
        game.context.move = 1;
        return item;
    }
    if (isContainer(item)) {
        const result = await useContainer(item, {
            held: true,
            underlay,
        });
        if (result.heroDied)
            return item;
        game.context.move = result.spentTime ? 1 : 0;
        return result.container;
    }
    if (item.otyp === STETHOSCOPE) {
        game.context.move = await useStethoscope(item) ? 1 : 0;
        return item;
    }
    if (item.otyp === TIN_OPENER) {
        const result = await useTinOpener(item, { state: game, swapWeapons: doswapweapon });
        if (!result.heroDied)
            game.context.move = Number(result.usedTime);
        return item;
    }
    if (item.otyp === MAGIC_MARKER) {
        game.context.move = Number(await useMagicMarker(item));
        return item;
    }
    if (item.otyp === UNICORN_HORN) {
        const result = await useUnicornHorn({
            object: item,
            state: game,
        });
        game.context.move = result.spentTime ? 1 : 0;
        return item;
    }
    if (PLAYABLE_INSTRUMENTS.has(item.otyp)) {
        game._pending_message = '';
        game._retained_message = '';
        await playInstrument(item, {
            finishMonsterKill: finishHeroMonsterKill,
        });
        return item;
    }
    if (item.otyp === CREAM_PIE) {
        game._pending_message = '';
        await useCreamPie(item);
        game.context.move = 0;
        return null;
    }
    if (isRoyalJelly(item)) {
        const used = await rubRoyalJelly(item);
        return used ? null : item;
    }
    if ([SKELETON_KEY, LOCK_PICK, CREDIT_CARD].includes(item.otyp)) {
        game.context.move = Number(await pickLock(item));
        return item;
    }
    if (item.otyp === BANANA && heroIsHallucinating(game)) {
        await pline("It rings! ... But no-one answers.");
        game.context.move = 1;
        return item;
    }
    await pline("Sorry, I don't know how to use that.");
    // apply.c's default case returns ECMD_FAIL; the rhack seam clears the
    // queues so a later ^A reports nothing to repeat.
    commandResultFailed();
    return null;
}
async function openLockedDoor(x, y) {
    await pline('This door is locked.');
    const flags = autoUnlockFlags(game);
    if (!flags)
        return Boolean(game.context.move);
    game.u.dz = 0;
    if (flags & AUTOUNLOCK_APPLY_KEY) {
        const tool = autokey(true);
        if (tool)
            return pickLock(tool, { target: { x, y } });
    }
    if (flags & AUTOUNLOCK_KICK && !game.u.usteed
        && await promptYesNoQuit('Kick it?') === 'y') {
        // lock.c queues dokick with the door direction; the open command
        // itself spends no turn, the kick that follows owns the action.
        game._cannedCommands ||= [];
        game._cannedCommands.push({
            kind: 'kick',
            dx: Math.sign(x - game.u.ux), dy: Math.sign(y - game.u.uy),
        });
        return false;
    }
    return Boolean(game.context.move);
}
//# sourceMappingURL=cmd.js.map