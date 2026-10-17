import { heroCouldMoveOntoBoulder, pushBouldersAt } from './boulder_push.js';
import { useMagicMarker } from './write.js';
import { formatFeltMessage, formatSeenMessage, publishHeardMessage } from './hero_speech.js';
import { ingSuffix } from './hacklib.js';
import { heroLocomotion } from './hero_locomotion.js';
import { autokey, autoUnlockFlags, continuePicking, pickLock } from './lock_pick.js';
import { resetPick } from './lock_context.js';
import { petRefusesHeroSwap } from './hero_pet_displacement.js';
import { airTurbulenceStopsHero, waterTurbulenceStopsHero } from './hero_movement_turbulence.js';
import { maybeAdjustHeroBubble } from './elemental.js';
import { announceRunLiquid, announceRunTrap, knownRunTrap, runLiquidIsDangerous } from './run_hazards.js';
import { AUTOUNLOCK_APPLY_KEY, AUTOUNLOCK_UNTRAP } from './const.js';
import { findDrawbridgeAt } from './dbridge.js';
import { doorObstructed } from './door_magic.js';
import { DBWALL, DRAWBRIDGE_DOWN, IS_DRAWBRIDGE, IS_TREE, LADDER, STAIRS, THRONE } from './const.js';
import type { DipTarget } from './dip_water.js';
import { dipFountainSword } from './fountain_sword.js';
import { washHands } from './dip_water.js';
import { curseObject, uncurseObjectState } from './object_state.js';
import { adjustObjectLightAfterBlessing, objectLightRadius } from './light.js';
import { waterDamageObject } from './trap.js';
import { dip, dipInto } from './potion_dip.js';
import { AKLYS, BOOMERANG, CRYSTAL_BALL } from './object_data.js';
import { useCrystalBall } from './crystal_ball.js';
import { updateHeroRegions, visibleRegionAt } from './regions.js';
import type { PageLocalMultiSelectItem } from './windows.js';
import type { ChoiceMenuItem } from './windows.js';
import { wizIntrinsic } from './wizard_intrinsics.js';
import { wizFuzzer, wizPanic } from './wizard_debug_commands.js';
import { wizSmell } from './wizard_smell.js';
import { wizBury } from './wizard_bury.js';
import { wizMigrateMonsters } from './wizard_migration.js';
import { wizardTeleportCommand } from './wizard_teleport.js';
import { hurtleMonster } from './monster_hurtle.js';
import type { GameState } from './game_state.js';
import type { Monster } from './monster_types.js';
import type { GameObject } from './object_types.js';
import type { MapLocation, Position, Room, Trap } from './map_types.js';
import { isRoom } from './map_types.js';
import type { Hero } from './hero_types.js';
import type { TextPage, TextMenuEntry } from './windows.js';
import type { MessagePublisher } from './display.js';
import type { LiquidEffectResult } from './hack.js';
import type { SpotEffectResult } from './location_effects.js';
import type { DungeonBranch, DungeonLocation, OverviewRecord, SpecialLevelDescriptor } from './dungeon_types.js';
import { deityName } from './alignment.js';
import type {
    CannedCommand, CommandBinding, DirectionalRunMode, MovementAttempt, NativeCommand, RunState, TravelRunState,
} from './command_types.js';
import { continueSpellbookStudy } from './spellbook_study.js';
import { grantMonsterWish } from './potion_occupants.js';
import { quaff } from './quaff.js';
import { tameMonster } from './monster_taming.js';
import { setMonsterMalign } from './monster_alignment.js';
import { jumpHero } from './jumping.js';
import { clearMessageWindow, feel_location } from './display.js';
// cmd.js — Command dispatch and movement.
// C ref: cmd.c rhack(), hack.c domove().

import { game, requireGameLevel, requirePlayingGame, requireInitializedGame } from './gstate.js';
import { requireInitializedHero } from './hero_types.js';
import { fruitName } from './fruit.js';
import { encyclopediaEntries, encyclopediaMatches, encyclopediaSupplementalName } from './encyclopedia.js';
import { objectAtMapDescription } from './map_object_description.js';
import { objectNeedsFullIdentification } from './invent.js';
import { identifyPack } from './invent.js';
import { DIED, KILLED_BY, MENU_ITEMFLAGS_SKIPINVERT, MGIVENNAME, NHW_MENU, PICK_ANY, PICK_NONE, PICK_ONE } from './const.js';
import { AD_PHYS } from './monster_attack_types.js';
import { finishMonsterKilled, finishMonsterLiquidDeath } from './monster_death.js';
import { monsterIsNonliving } from './monster_data.js';
import { Invocation_lev, Is_earthlevel, Is_firelevel, Is_knox_level, MAGIC_PORTAL, VIBRATING_SQUARE } from './const.js';
import { map_engraving, map_trap } from './display.js';
import { teleportHeroAtWill } from './teleport.js';
import { mapMagicLevel } from './magic_mapping.js';
import {
    tty_add_menu, tty_create_nhwindow, tty_destroy_nhwindow,
    tty_end_menu, tty_select_menu, tty_start_menu,
} from './tty_menu.js';
import { LOOK_ONCE, LOOK_QUICK, LOOK_VERBOSE } from './const.js';
import { surfaceName, waterbodyName } from './terrain_name.js';
import { def_warnsyms } from './const.js';
import { iceDescriptionAt } from './dungeon_feature.js';
import { CmapSymbol, GlyphOffset, cmapToGlyph } from './glyph_numbers.js';
import { lookAtMonster, monsterSeenDescription, offerMonsterSupplement, selfLookDetails, selfTrapDescription } from './pager_monsters.js';
import { identifyTrap } from './pager_traps.js';
import { showLookList } from './pager_lists.js';
import { screenDescription } from './pager_description.js';
import { lookGlyphAt, mapFeatureDescription } from './pager_features.js';
import { typedSymbolDescription } from './look_symbols.js';
import { isGrayStone, isWeaponTool } from './object_properties.js';
import { applySuggestion } from './apply_selection.js';
import { flipThroughBook } from './book_flip.js';
import { flipCoin } from './coin_flip.js';
import { useGrayStone } from './gray_stone.js';
import { useMirror } from './mirror.js';
import { useCamera } from './camera.js';
import { dryTowel, useTowel } from './towel.js';
import { useBell } from './apply_bell.js';
import { breakWand } from './wand_break.js';
import { speakArtifact } from './artifact_speech.js';
import { lightCocktail, useCandelabrum, useCandle, useLamp } from './apply_light.js';
import { useWhistle } from './whistle.js';
import { retouchHeroObject } from './hero_retouch.js';
import { GETOBJ_DOWNPLAY, GETOBJ_EXCLUDE, PARANOID_REMOVE, GETOBJ_SUGGEST } from './const.js';
import { TER_MON } from './const.js';
import { senseBuriedObjects } from './buried_object.js';
import { distantMonsterName, monsterName, monsterPossessive, monsterSubjectPronoun, shopkeeperName } from './monster_name.js';
import { attackHostileMonster } from './hero_melee.js';
import { prepareAppliedWeaponAttack } from './hero_attack_preflight.js';
import { applyCaitiffPenalty } from './hero_attack_conduct.js';
import { revealMonsterAppearance } from './monster_appearance.js';
import { beastChoosesHeroDisplacement, settleBeastHeroDisplacement } from './hero_beast_displacement.js';
import { hasDoorAppearance, stumbleOnDoorMimic, stumbleOntoMimic } from './mimic.js';
import { monsterHasMapPosition, monsterAtPosition } from './monster_location.js';
import { SHOP_TYPES } from './shop_data.js';
import { observeBucForNaming } from './object_knowledge.js';
import {
    definiteName, objectCombatName,
    minimalObjectName, objectNameIsPlural, observeDistantObjectForNaming,
    observeObjectForNaming, ownedObjectName, simpleObjectNameWithArticle,
} from './objnam.js';
import { woundHeroLegs } from './hero_legs.js';
import { makeMonsterFlee } from './monster_flee.js';
import { descendFromLevitation, floatingAbove } from './levitation_commands.js';
import { endVoluntaryMultiTurn, resetCommandVariables } from './command_state.js';
import { grantIntrinsicProperty, propertyIsActive } from './properties.js';
import {
    addPickedInventoryObject, pickupAtHero, pickupObjectClass, pickupClassOrder,
} from './pickup.js';
import { gotoLevel } from './level_change.js';
import { levelTeleport } from './level_teleport.js';
import { confirmHeroStep } from './hero_step_confirmation.js';
import { monsterPassesBars } from './monster_movement_traits.js';
import { continueChewingTerrain, heroCanEnterIronBars } from './iron_bars_meal.js';
import { wormCrossesBetween } from './monster_worm.js';
import {
    floorObjectDescription,
} from './floor_object_display.js';
import { loseHeroHp } from './hero_damage.js';
import { dopay } from './shop_pay_command.js';
import { inventoryReport } from './inventory_reports.js';
import { quoteShopGoods } from './shop_price_quote.js';
import { shopkeeperBlockingDoor, shopkeeperBlockingEntry } from './shop_blocking.js';
import { poisonHeroStrengthAndHp } from './poison.js';
import { isContainer, useContainer } from './container.js';
import { tipCommand } from './container_tip.js';
import { lootCommand } from './container_loot.js';
import { adjustHeroAlignment } from './alignment.js';
import { doOptions, option_help } from './options.js';
import {
    blocksDiagonalDoor, blocksMove, escapeFromStickyMonster, heroBadRock, heroCanPassWallAt, heroLiquidEffects,
    heroShouldAvoidLiquid,
    heroTightDiagonalReason,
} from './hack.js';
import { commandExecutionKey, controlRushDirection, visibleCommandKey } from './command_keys.js';
import { NATIVE_COMMAND_FLAGS, NATIVE_COMMANDS } from './command_data.js';
import { stopHeroOccupation } from './occupation.js';
import { canSelectOff, continueBulkTakeoff, takeOffAll } from './bulk_takeoff.js';
import { resetBulkTakeoff, TAKEOFF_ORDER, takeoffSlotObject } from './takeoff_state.js';
import { currentLuaLifecycle } from './lua/lifecycle.js';
import { clearCommandKeys, nhgetch, queueCommandKeys, takeCommandKey } from './input.js';
import { readCommandInput } from './command_input.js';
import { clearRepeatCommand, rememberCommand, takeRepeatCommand } from './command_repeat.js';
import { terrainCommand } from './terrain_view.js';
import { selectTravelMenuPosition } from './getpos.js';
import { showKeyBindings, whatDoesCommand } from './command_help.js';
import { availableExtendedCommands, completeExtendedCommand, extendedCommandMenu, showExtendedCommandList } from './extended_commands.js';
import {
    chooseInventoryObject, compactInventoryLetters, inventoryLetterOrder,
    promptInventoryObject, reassignInventoryLetters,
} from './inventory_prompt.js';
import { AT_EXPL, AT_KICK } from './monster_attack_types.js';
import {
    confusePromptDirection, promptDirection, promptKey, readDirectionKey,
    restoreCommandMap,
} from './tty_prompts.js';
import {
    getLine, paranoidQuery, promptYesNo, promptYesNoQuit,
} from './query.js';
export { getLine, promptYesNo, promptYesNoQuit } from './query.js';
import {
    callObjectType, objectTypeIsCallable,
} from './object_call.js';
import { nameIndividualObject } from './individual_naming.js';
import { nameChosenMonster } from './monster_naming_command.js';
import { nameFloorObject } from './floor_naming.js';
import { chooseNamingCategory } from './naming_categories.js';
import { displayLiquidName, displayMessageWindow,
    newsym, feel_newsym, flushPendingTopline, flush_screen, pline, plineWithContinuation, moreUntilDismissed, docrt,
    bot, terrain_glyph, glyphAt, canSeeMonster, canSpotMonster, canSenseMonster, canSpotHeroSelf,
    unblindTelepathyRange,
    monsterHasWarningProjection, see_nearby_objects, show_glyph_cell, swallowed,
    randomDisplayMonsterName, randomDisplayMonsterSubject, see_monsters, see_objects,
    see_traps, map_invisible, unmap_invisible, map_object, unmapObject,
} from './display.js';
import { cansee, couldsee, vision_note_blocker_change, vision_recalc, vision_reset } from './vision.js';
import { transformMagicLampToOilLamp } from './light.js';
import {
    dozap,
} from './zap.js';
import {
    bucAdjectiveForName, checkInventoryGold, consumeInventoryItem, ddoinv, dolook, fullyIdentifyObject,
    inventoryItemDescription, inventoryPrimaryHandDetail, selectInventoryObject, selectUsedInventoryLetter,
} from './invent.js';
import { mergable, mergeObjectStacks } from './object_merge.js';
import { unlinkObject } from './object_location.js';
import type { InventoryAction } from './invent.js';
import {
    castSpell, docast, dovspell, dowizcast,
} from './spell.js';
import {
    vomitHero,
} from './hero_illness.js';
import { heroBreathAttack } from './hero_breath.js';
import { resolveHeroCombatExplosion } from './hero_combat_explosion.js';
import { useHeroBreath } from './hero_breath_command.js';
import { monsterBreathAttack } from './dogmove.js';
import { heroSpitAttack, useHeroSpit } from './hero_spit.js';
import { heroGazeAttack, useHeroGaze } from './hero_gaze.js';
import {
    heroCanSplitLikeGremlin, useHeroGremlinSplit,
} from './hero_gremlin.js';
import { heroCanShriek, useHeroShriek } from './hero_shriek.js';
import {
    heroCanSummonWerePack, useHeroWereSummon,
} from './were.js';
import { heroHasHidingAbility, useHeroHide } from './hero_hide.js';
import {
    chooseSpiderAbility, heroCanSpinWeb, useHeroWeb,
} from './hero_web.js';
import {
    heroCanMindBlast, useHeroMindBlast,
} from './hero_mind_blast.js';
import {
    heroCanRemovePunishment, useHeroNymphAbility,
} from './hero_nymph_ability.js';
import {
    heroCanUseUnicornHorn, useUnicornHorn,
} from './unicorn_horn.js';
import { useHeroVampireShift } from './vampire_shift.js';
import { turnUndeadByCallingOnDeity } from './turn_undead.js';
import { doread } from './read.js';
import { continueFoodMeal, doeat } from './eat.js';
import { continueTinOpening, useTinOpener } from './tin.js';
import { PLAYABLE_INSTRUMENTS, playInstrument } from './music.js';
import { dodiscovered, renameDiscoveredType } from './o_init.js';
import { doattributes, doconduct, showEnlightenment } from './insight.js';
import { contactHelp, displayHelpFile, menuControlsHelp, setOptionsCommand } from './pager_help.js';
import { doextversion, NATIVE_VERSION } from './extversion.js';
import { dosearch, findit } from './detect.js';
import { detectMonsters } from './magic_detection.js';
import { abusePetAfterHeroHit } from './dog.js';
import {
    continueWipingFace, donull, dowipe, threateningMonsterNearby,
} from './do.js';
import {
    ATR_INVERSE, ATR_NONE, addMenuHeading, showChoiceWindow, showMultiSelectWindow,
    showDisclosureOverlay, showPagedPickOneMenu,
    showTextMenuOverlay, showTextPages,
    restoreMenuUnderlay, snapshotMenuUnderlay,
} from './windows.js';
import {
    d, rnd, rn2, rn2Display, rnl,
} from './rng.js';
import { landObjectOnAltar } from './altar_object.js';
import { landFloorObject } from './floor_effects.js';
import { shipObject } from './object_migration.js';
import { placeCreatedObject } from './floor_object.js';
import { makemonNear, mkgold, mksobj, rndClass } from './mklev.js';
import {
    level_difficulty, recordMappedOverviewState, specialDisplayName, specialPrototypeAt, specialLevelAt,
    dungeonBuildsUp, sameDungeonLevel,
} from './dungeon.js';
import { questLeaderName } from './quest_pager.js';
import { addInventoryItem, assignInventoryLetter, inventoryLetterRank } from './u_init.js';
import { clearSplitObjects, objectQuantity, rejoinObjectStack, splitObjectStack } from './object_stack.js';
import { freeInventoryObject } from './hero_inventory.js';
import { dropHeroObject } from './hero_drop.js';
import { SELL_DELIBERATE, SELL_NORMAL, setSellDisposition } from './shop_sell.js';
import { addObjectToMonsterInventory } from './monster_inventory.js';
import {
    resolveGenericSwallowedThrow, resolveSwallowedEggPieOrVenomThrow,
    resolveSwallowedFoodThrow, resolveSwallowedPotionThrow, resolveSwallowedWeaponThrow,
} from './swallowed_throw.js';
import {
    autoquiverCandidate, readySuggestion,
} from './quiver.js';
import {
    isWeldedPrimary, releaseWeaponSlots, setPrimaryWeapon, setQuiverObject,
    setSecondaryWeapon,
} from './weapon_slots.js';
import { launcherMatchesAmmo } from './object_properties.js';
import { resolveMapPotionThrow } from './potion_throw.js';
import { throwOrdinaryObject } from './ordinary_throw.js';
import { isAutoReturningThrow } from './returning_throw.js';
import { chooseHeroVolleyCount } from './hero_multishot.js';
import {
    captureThrownObjectFlight,
} from './thrown_object.js';
import {
    objectName, singularObjectName, unseenObjectNoun,
} from './objnam.js';
import {
    artifactById,
} from './artifacts.js';
import {
    invokeArtifactPower,
} from './artifact_invoke.js';
import {
    SLING, BULLWHIP, GRAPPLING_HOOK, CREAM_PIE, CORPSE, EGG, LUMP_OF_ROYAL_JELLY, LOCK_PICK,
    CREDIT_CARD, STETHOSCOPE, LOADSTONE, GOLD_PIECE, BOULDER, ROCK, DILITHIUM_CRYSTAL,
    LUCKSTONE, TOUCHSTONE, LARGE_BOX, CHEST, ICE_BOX, SACK, OILSKIN_SACK,
    BAG_OF_HOLDING, BAG_OF_TRICKS, BRASS_LANTERN, OIL_LAMP, MAGIC_LAMP, STATUE, RIN_PROTECTION,
    BANANA, MIRROR, TIN_WHISTLE, MAGIC_WHISTLE, EUCALYPTUS_LEAF,
    BELL, BELL_OF_OPENING, EXPENSIVE_CAMERA, TIN_OPENER, FIGURINE, LEASH, CAN_OF_GREASE, SADDLE, HORN_OF_PLENTY, TINNING_KIT, LAND_MINE, BEARTRAP,
    TALLOW_CANDLE, WAX_CANDLE, CANDELABRUM_OF_INVOCATION, POT_OIL,
    RIN_CONFLICT, MEAT_RING, OBJECT_BIMANUAL, HELM_OF_OPPOSITE_ALIGNMENT, GRAY_DRAGON_SCALES,
    LENSES, BLINDFOLD, TOWEL, FUMBLE_BOOTS, KICKING_BOOTS, MAGIC_MARKER, UNICORN_HORN,
    SHIELD_OF_REFLECTION, AMULET_OF_YENDOR,
    AMULET_OF_STRANGULATION, FAKE_AMULET_OF_YENDOR, SPE_NOVEL, OBJECT_DELAY, OBJECT_UNIQUE,
    OBJECT_DESCRIPTIONS, OBJECT_MATERIAL, OBJECT_NAMES, OBJECT_WEIGHT, OBJECT_SUBTYPE,
} from './object_data.js';
import {
    CLR_WHITE, NO_COLOR,
} from './terminal.js';
import {
    MONSTER_COLOR, MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_LEVEL, MONSTER_MOVE, MONSTER_NAME,
    MONSTER_SIZE, MONSTER_SYMBOL, MONSTER_SOUND, MONSTER_ALIGNMENT, MONSTER_ATTACKS,
    requireMonsterData, monsterTypeName, monsterClassSymbol, monsterIsHumanoid, monsterDigests,
    monsterSpeciesHidesOnCeiling,
} from './monster_data.js';
import { createParticularMonster } from './read_creation.js';
import {
    addExperience, checkExperienceLevel, gainExperienceLevel, loseHeroExperience,
} from './exper.js';
import {
    removeHeroAccessory, wearHeroAccessory,
} from './accessory.js';
import { heroFormSticks, heroHasNoHead, heroPassesWalls, heroSpecies } from './hero_species.js';
import { autopickupAtHero } from './pickup.js';
import { disturbBuriedZombies } from './object_impact.js';
import { checkSlipperyIce } from './fumbling.js';
import { MONSTER_BODY_META } from './monster_data.js';
import { accessibleEquipment, equipmentClassification, wearingFullEquipment } from './equipment_selection.js';
import { armorWearDecision } from './armor_wear.js';
import { heroCanOoze } from './monster_perception.js';
import { isLavaAt, isPoolAt, isPoolOrLavaAt } from './terrain_properties.js';
import { drawbridgeUnderlyingType } from './drawbridge_terrain.js';
import { dosave } from './save.js';
import { captureRunmodeDelay, startRun, stopRun } from './runmode.js';
import {
    applyArmorOnEffects, armorOnIdentifiesType, armorSlotFor,
    armorSimpleName, armorOffMessage,
    findArmorClass, heroIsDisplaced,
    removeHeroArmor, wearHeroArmor,
} from './armor.js';
import {
    findMonsterArmorClass,
} from './monworn.js';
import { finishHeroMonsterKill, finishHeroMonsterKillOutcome } from './hero_monster_death.js';
import { wakeMonstersNear } from './monster_wake.js';
import {
    aggravateMonsters, angerAttackedMonster,
    wakeAttackedMonster,
} from './monster_anger.js';
import { publishMonsterNoise } from './monster_sound.js';
import { doride, moveSteedWithHero, ridingPreventsMovement, stuckSteed } from './steed.js';
import { adjustAttribute, ATTRIBUTE_DISPLAY_ORDER, attributeChangeMessage, currentAttribute, currentStrength, exerciseAttribute, exerciseWisdom } from './attrib.js';
import { reportHeroEncumbrance } from './encumbrance.js';
import { spendHeroNutrition, updateHeroHunger } from './hunger.js';
import { continueForceLock, doforce } from './lock.js';
import { doUntrap } from './untrap.js';
import { dosit } from './sit.js';
import { continueEngraving, doengrave } from './engrave_command.js';
import { climbOutOfPit, heroCanMoveFromTrap, triggerHeroTrapAt, triggerLevelTeleportTrap } from './hero_traps.js';
import {
    applyDippedCoinFate, applyFountainDemonActor,
    applyFountainGemDiscovery, applyFountainNymphActor,
    applyFountainSnakeActors,
    resolveDippedSensationFate,
} from './fountain_effects.js';
import { dryFountainAt, gushForthFromFountain } from './fountain.js';
import { heroArmName, heroFingerName, heroHandName } from './body_parts.js';
import { armorUsesPairGrammar, withIndefiniteArticle, makePlural } from './object_grammar.js';
import { objectWearMessage } from './object_wear_message.js';
import { isWetTowel, willWeld } from './weapon_type.js';
import { refuseWeldedPrimary } from './weapon_feedback.js';
import { readyHeroWeapon } from './weapon_readiness.js';
import { dropCursedSecondaryWeapon, stopTwoWeaponCombat, toggleTwoWeaponCombat } from './two_weapon.js';
import { dist2, distmin, dungeonDepth, ledgerNo, endgameLevelName } from './hacklib.js';
import { triggerBoobyTrap } from './booby_trap.js';
import { addShopDamage, payForShopDamage } from './shop_damage.js';
import { convertSecretDoor } from './detect.js';
import { roomForRoomno, roomsAt } from './room.js';
import {
    learnObjectType, objectClassForType, recordObjectCall, recordObjectEncounter,
    recordObjectKnowledge, OBJECT_CLASS_SYMBOLS,
} from './object_knowledge.js';
import {
    exceedsActionCapacity, nearCapacity,
    OVERLOADED, SLT_ENCUMBER,
} from './weight.js';
import { makeWish } from './wish.js';
import { dopray } from './pray.js';
import { finishDestinationSpotEffects, finishTeleportArrival } from './location_effects.js';
import { dosacrifice } from './sacrifice.js';
import { detachHeroGold, heroGoldAmount, heroGoldObject, setHeroGoldAmount } from './hero_gold.js';
import {
    resolveDirectGoldThrow, resolveQuiveredGoldThrow,
} from './gold_throw.js';
import {
    heroDetectsMonsters, heroIsBlind, heroIsDeaf, heroIsHallucinating,
} from './senses.js';
import { beginBallAndChainMove, finishBallAndChainMove, heroIsPunished } from './ball.js';
import {
    doquit,
    finishHeroDeath,
    vanquishedLines, listGenocided,
} from './end.js';
import { hasRecordedMonsterDeaths } from './monster_vitals.js';
import {
    applyHeroContactPassive,
} from './monster_passive.js';
import {
    heroCannotTake, heroHasNoHands, heroHasNoLimbs, heroIsPolymorphed, heroIsVerySmall,
    heroCanChangeVampireShape, polymorphHero, returnHeroToHumanForm,
} from './polyself.js';
import {
    applyEyewear, isEyewear, removeEyewear, wearEyewear,
} from './eyewear.js';
import { useCreamPie } from './cream_pie.js';
import { useFigurine } from './figurine_apply.js';
import { checkHeroLeashes, useLeash } from './leash_apply.js';
import { useGrease } from './grease_apply.js';
import { useStethoscope } from './stethoscope.js';
import { useBagOfTricks } from './bag_of_tricks.js';
import { useHornOfPlenty } from './horn_of_plenty.js';
import { useTinningKit } from './tinning_kit.js';
import { continueTrapSetting, resetTrapSetting, useSettableTrap } from './trap_setting.js';
import { useSaddle } from './steed.js';
import {
    isRoyalJelly, useRoyalJelly,
} from './royal_jelly.js';
import { useBullwhip } from './bullwhip.js';
import { useGrapplingHook } from './grappling_hook.js';
import { couldPoleMonster, usePolearm } from './polearm.js';
import { isAmmunition, isAxe, isPick, isPolearm } from './weapon_type.js';
import { applyPickAxeDirection, usePickAxe } from './pick_axe.js';
import { continueHeroDigging, diggingTarget } from './hero_digging.js';
import { checkHeroAttackOverexertion } from './hero_overexertion.js';
import { wieldTool } from './wield_tool.js';
import {
    doenhance, useHeroSkill,
} from './skills.js';
import {
    objectOwnershipPrefix, chargeUnpaidUsage, checkSpecialRoom, objectTypeKnown,
    shopkeeperForHero,
    tendedShop,
} from './shk.js';
import { gameLogEvents } from './gamelog.js';
import { corpseName, killerObjectName } from './objnam.js';
import { heroResistsStoning, resolveImmediatePetrification, touchPetrifies } from './stoning.js';
import { GRAVE } from './const.js';
import { disturbGrave } from './grave.js';
import { deleteEngravingAt, maybeSmudgeEngravings, wipeHeroEngraving } from './engrave.js';
import { canLetGo, finishInventoryRemoval } from './hero_inventory.js';
import { removeHeroEquipment } from './hero_equipment.js';
import {
    shouldShowGetposTip, showGetposTip, selectMapPosition,
} from './getpos.js';
import { onQuestStart, okToQuest } from './quest.js';
import {
    performPetRangedAttack, resumeDeferredMonsterTrap, triggerImmediateMonsterTrap,
} from './monmove.js';
import { hurtleHero, kickRecoilRange } from './hero_hurtle.js';
import type { HeroMonsterKillOptions } from './hero_monster_death.js';
import { announceInvocationSquare } from './invocation.js';
import {
    abuseKickedPet, levitatingKickMisses,
    prepareKick, prepareKickDamage, rollKickDamage, tryKickEvasion,
    tryKickReel,
} from './monster_kick.js';
import { kickFloorObject } from './object_kick.js';
import { kickWithMonsterForm } from './hero_form_kick.js';
import { admitHeroKick, kickCanReachTarget } from './kick_admission.js';
import { kickNonDoorTerrain } from './kick_terrain.js';
import { kickDoor } from './kick_door.js';
import { heroHasMartialKick } from './kick_rules.js';
import {
    bringLeashedFollowers,
    randomMonsterRelocation,
} from './teleport.js';
import { goodPosition, monsterTeleportRestricted } from './teleport_rules.js';
import { removeWishGrantingMonster } from './monster_departure.js';
import {
    RLOC_MSG, A_CON, A_DEX, A_MAX, A_STR, A_WIS, BOLT_LIM, COLNO, ROWNO, STONE, SCORR, SDOOR, DOOR, CORR, ROOM,
    ICE, POOL, CLOUD, IRONBARS, FOUNTAIN, SINK, ALTAR, WATER, MOAT, LAVAWALL, TREE, D_NODOOR,
    D_BROKEN, D_ISOPEN, D_CLOSED, D_LOCKED, D_TRAPPED, SHOP_DOOR_COST, IS_WALL, IS_STWALL, IS_OBSTRUCTED, IS_FURNITURE,
    IS_AIR, IS_ROOM, ZAP_POS, SQKY_BOARD, BEAR_TRAP, LANDMINE, FIRE_TRAP, PIT,
    SPIKED_PIT, TT_PIT, HOLE, TRAPDOOR, DART_TRAP, MAGIC_TRAP, TELEP_TRAP, LEVEL_TELEP, STATUE_TRAP, WEB,
    ANTI_MAGIC, G_GONE, ER_NOTHING, ER_DAMAGED, M_AP_MONSTER, M_AP_FURNITURE, M_AP_OBJECT, M_AP_TYPE,
    STRAT_WAITMASK, MM_NOEXCLAM, MM_NOMSG, SHOPBASE, ROOMOFFSET, F_LOOTED, In_endgame,
    Is_airlevel, Is_waterlevel, Is_rogue_level, In_hell, W_ARMOR, W_ACCESSORY, W_SADDLE,
    P_BOW, P_SLING, PARANOID_HIT, POLY_CONTROLLED, STR19, isok,
    ACCESSIBLE, AIR, DIGTYP_UNDIGGABLE, DRAWBRIDGE_UP,
} from './const.js';

// Direction deltas: y u k
//                   h . l
//                   b j n
type DirectionKey = 'h' | 'l' | 'j' | 'k' | 'y' | 'u' | 'b' | 'n';
const DIR_DX = { h: -1, l: 1, j: 0, k: 0, y: -1, u: 1, b: -1, n: 1 };
const DIR_DY = { h: 0, l: 0, j: 1, k: -1, y: -1, u: -1, b: 1, n: 1 };

// object.h enum value; object_data currently exposes the two other tools.
const SKELETON_KEY = 221;
const PM_DJINNI = 315;

const PM_WATER_NYMPH = 68;
const PM_WATER_DEMON = 289;
const PM_WATER_MOCCASIN = 216;
const M2_PNAME = 0x00080000;
const M2_ROCKTHROW = 0x08000000;
const M1_HUMANOID = 0x00020000;
const M1_TUNNEL = 0x20;
const M1_NEEDPICK = 0x40;

function isMovementKey(ch: string): ch is DirectionKey {
    return ch.length === 1 && 'hjklyubn'.includes(ch);
}

function configuredCommand(key: number): CommandBinding {
    key &= 255;
    if (key === 27) return { key, command: null, parameter: null };
    const binding = game.commandBindings.lookup(key);
    const executionKey = commandExecutionKey(binding?.command?.name);
    return {
        key: executionKey?.charCodeAt(0) ?? null,
        command: binding?.command ?? null,
        parameter: binding?.parameter ?? null,
    };
}

export { heroCouldMoveOntoBoulder } from './boulder_push.js';

async function rejectTightHeroDiagonal(dx: number, dy: number): Promise<boolean> {
    if (!dx || !dy
        || !heroBadRock(game, game.u.ux, game.u.uy + dy)
        || !heroBadRock(game, game.u.ux + dx, game.u.uy)) return false;
    const reason = heroTightDiagonalReason(game);
    if (!reason) return false;
    if (reason === 1) await pline('Your body is too large to fit through.');
    else if (reason === 2)
        await pline('You are carrying too much to get through.');
    else await pline('You cannot pass that way.');
    game.context.move = 0;
    return true;
}

function heroOozesUnderDoor(destination: MapLocation | null): boolean {
    return destination?.typ === DOOR
        && !!(destination.doormask & (D_CLOSED | D_LOCKED))
        && !heroPassesWalls(game) && heroCanOoze(game);
}

// C test_move(DO_MOVE): oozing bypasses only the doorway entry check.
async function rejectHeroDiagonalDoorway(dx: number, dy: number, destination: MapLocation | null): Promise<boolean> {
    if (!dx || !dy || heroPassesWalls(game)) return false;
    const entryDoor = heroOozesUnderDoor(destination) ? null : destination;
    const x = game.u.ux + dx, y = game.u.uy + dy;
    const intactEntry = blocksDiagonalDoor(null, entryDoor);
    const doorKeeper = !intactEntry && entryDoor?.typ === DOOR ? shopkeeperBlockingDoor(x, y) : null;
    const entering = intactEntry || !!doorKeeper;
    const intactExit = !entering && blocksDiagonalDoor(game.level?.at(game.u.ux, game.u.uy), null);
    const entryKeeper = !entering && !intactExit ? shopkeeperBlockingEntry(x, y) : null;
    if (!entering && !intactExit && !entryKeeper) return false;
    const keeper = doorKeeper ?? entryKeeper;
    if (keeper) {
        const invisible = propertyIsActive('invisible', game);
        await plineWithContinuation(`${shopkeeperName(keeper, { capitalized: true })}${invisible ? ' senses your motion and' : ''} blocks your way!`);
    }
    if (game.flags.mention_walls || entering && (game.u.uinwater || game.underwater)) {
        await plineWithContinuation(`You can't move diagonally ${entering ? 'into' : 'out of'} an intact doorway.`);
    }
    game.context.move = 0;
    return true;
}

// C test_move(TEST_MOVE): tests obstacles without performing auto-open,
// boulder pushing, or the hero's eventual movement.
export function heroTestMove(x: number, y: number): boolean {
    const hero = game.u;
    const location = game.level?.at(x, y);
    if (!location) return false;
    const oozing = heroOozesUnderDoor(location);
    if (blocksMove(x, y) && !heroCanPassWallAt(game, x, y) && !oozing) return false;
    const passesWalls = heroPassesWalls(game);
    if (location.typ === IRONBARS && !passesWalls
        && !monsterPassesBars({ mnum: heroSpecies(game) })) return false;
    const dx = x - hero.ux, dy = y - hero.uy;
    if (dx && dy) {
        if (!passesWalls && blocksDiagonalDoor(game.level?.at(hero.ux, hero.uy), oozing ? null : location)) return false;
        if (heroBadRock(game, hero.ux, y) && heroBadRock(game, x, hero.uy)) {
            if (heroTightDiagonalReason(game)) return false;
        } else if (wormCrossesBetween(hero.ux, hero.uy, x, y, game)) return false;
    }
    const boulder = game.level?.objects[x]?.[y]?.some(object => object.otyp === BOULDER);
    return !(boulder && (!passesWalls || game.level?.flags.sokoban_rules)
        && (game._runState?.mode ?? 0) >= 2 && !heroIsBlind(game)
        && !heroIsHallucinating(game) && !heroCouldMoveOntoBoulder(x, y));
}

function runDist2(x1: number, y1: number, x2: number, y2: number): number {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return dx * dx + dy * dy;
}

// C refs: hack.c findtravelpath(TRAVP_TRAVEL), test_move(TEST_TRAV).
// NetHack searches backwards from the destination, cardinal directions
// first, and uses the predecessor of the hero as the next travel step.  A
// fresh search is intentional: doors, boulders, traps, and monsters can make
// yesterday's route invalid between automatic turns.
const TRAVEL_DIRECTIONS: readonly (readonly [number, number])[] = [
    [-1, 0], [0, -1], [1, 0], [0, 1],
    [-1, -1], [1, -1], [1, 1], [-1, 1],
];

function travelCellKnown(x: number, y: number, g: GameState = game): boolean {
    const loc = g.level?.at(x, y);
    return !!loc && (!!loc.seenv || !!loc.remembered_glyph || couldsee(x, y));
}

function travelStepAllowed(fromX: number, fromY: number, toX: number, toY: number, g: GameState = game): boolean {
    if (toX < 1 || toX >= COLNO || toY < 0 || toY >= ROWNO) return false;
    if (!travelCellKnown(toX, toY, g)
        || blocksMove(toX, toY) && !heroCanPassWallAt(g, toX, toY)) return false;

    const dx = toX - fromX;
    const dy = toY - fromY;
    if (dx && dy && blocksDiagonalDoor(
        g.level?.at(fromX, fromY), g.level?.at(toX, toY),
    )) return false;

    if (g.level?.flags?.sokoban_rules
        && (g.level?.objects?.[toX]?.[toY] || [])
            .some(object => object.otyp === BOULDER)) return false;
    const trap = g.level?.traps?.find(candidate =>
        candidate.tx === toX && candidate.ty === toY && candidate.tseen);
    if (trap) return false;
    const typ = g.level?.at(toX, toY)?.typ;
    if (typ === undefined) return false;
    if (isPoolOrLavaAt(toX, toY, g)) return false;
    return true;
}

function findDirectTravelDirection(targetX: number, targetY: number, g: GameState = game): { dx: number; dy: number } | null {
    let frontier: [number, number][] = [[targetX, targetY]];
    const discoveredRadius = new Map([[`${targetX},${targetY}`, 0]]);
    let radius = 1;
    while (frontier.length) {
        const next: [number, number][] = [];
        for (const [x, y] of frontier) {
            const key = `${x},${y}`;
            const hasBoulder = (g.level?.objects?.[x]?.[y] || [])
                .some(object => object.otyp === BOULDER);
            // findtravelpath() leaves an ordinary boulder node on the
            // frontier for two extra radii.  The graph still contains it,
            // but an equally short clean route wins.
            const discoveredAt = discoveredRadius.get(key);
            if (discoveredAt === undefined)
                throw new Error(`Travel frontier has no radius for ${x},${y}`);
            if (hasBoulder && !heroCouldMoveOntoBoulder(x, y, g)
                && discoveredAt > radius - 3) {
                next.push([x, y]);
                continue;
            }
            for (const [dx, dy] of TRAVEL_DIRECTIONS) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx === g.u.ux && ny === g.u.uy) {
                    // hack.c:findtravelpath(TRAVP_TRAVEL) expands backward
                    // from the destination and tests this edge in that same
                    // direction.  If an unreachable stone target becomes
                    // adjacent, C returns the blocked final direction and
                    // lets domove() stop travel; reversing this check enters
                    // TRAVP_GUESS and can oscillate beside the target.
                    if (travelStepAllowed(x, y, nx, ny, g))
                        return { dx: x - nx, dy: y - ny };
                    continue;
                }
                const nextKey = `${nx},${ny}`;
                if (discoveredRadius.has(nextKey)
                    || !travelStepAllowed(x, y, nx, ny, g)) continue;
                discoveredRadius.set(nextKey, radius);
                next.push([nx, ny]);
            }
        }
        frontier = next;
        radius++;
    }
    return null;
}

// C hack.c:is_valid_travelpt() calls findtravelpath(TRAVP_VALID), which
// accepts only a complete known path to the selected square.  The separate
// TRAVP_GUESS fallback belongs to live travel after a valid destination has
// been chosen; using it for getpos descriptions falsely labels solid or
// unreachable targets as travelable.
function isValidTravelTarget(targetX: number, targetY: number, g: GameState = game): boolean {
    if (g.u?.ux === targetX && g.u?.uy === targetY) return true;
    // TRAVP_VALID expands from the hero toward the requested destination.
    // The ordinary travel search expands backwards so it can recover the
    // hero's next step; reusing that orientation here would let the search
    // escape *from* a solid target without ever validating entry into it.
    const queue: [number, number][] = [[g.u.ux, g.u.uy]];
    const visited = new Set([`${g.u.ux},${g.u.uy}`]);
    for (const [x, y] of queue) {
        for (const [dx, dy] of TRAVEL_DIRECTIONS) {
            const nx = x + dx;
            const ny = y + dy;
            const key = `${nx},${ny}`;
            if (visited.has(key)
                || !travelStepAllowed(x, y, nx, ny, g)) continue;
            if (nx === targetX && ny === targetY) return true;
            visited.add(key);
            queue.push([nx, ny]);
        }
    }
    return false;
}

function travelDistance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
}

function travelDistanceSquared(x1: number, y1: number, x2: number, y2: number): number {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return dx * dx + dy * dy;
}

// C hack.c:findtravelpath(TRAVP_GUESS).  When the selected destination is
// not connected through remembered terrain, search the hero-visible region,
// choose its point closest to the real target using C's scan/tie order, and
// take one ordinary travel step toward that temporary target.  Repeating the
// calculation after each move lets newly revealed terrain extend the route.
function findGuessedTravelDirection(targetX: number, targetY: number, g: GameState = game): { dx: number; dy: number } | null {
    const originX = g.u.ux;
    const originY = g.u.uy;
    const queue: [number, number][] = [[originX, originY]];
    const distance = new Map([[`${originX},${originY}`, 0]]);
    for (const [x, y] of queue) {
        for (const [dx, dy] of TRAVEL_DIRECTIONS) {
            const nx = x + dx;
            const ny = y + dy;
            const key = `${nx},${ny}`;
            if (distance.has(key) || !couldsee(nx, ny)
                || !travelStepAllowed(x, y, nx, ny, g)) continue;
            const previousDistance = distance.get(`${x},${y}`);
            if (previousDistance === undefined) throw new Error(`Missing travel distance for ${x},${y}`);
            distance.set(key, previousDistance + 1);
            queue.push([nx, ny]);
        }
    }

    let pickX = originX;
    let pickY = originY;
    let bestDistance = travelDistance(targetX, targetY, originX, originY);
    let bestSquared = travelDistanceSquared(
        targetX, targetY, originX, originY,
    );
    let bestPath = COLNO * ROWNO;
    // The C implementation scans the travel matrix x-major, then y-major.
    for (let x = 1; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            const path = distance.get(`${x},${y}`);
            if (!path || !couldsee(x, y)) continue;
            const candidateDistance = travelDistance(targetX, targetY, x, y);
            const candidateSquared = travelDistanceSquared(
                targetX, targetY, x, y,
            );
            if (candidateDistance < bestDistance
                || (candidateDistance === bestDistance
                    && path < bestPath && candidateSquared < bestSquared)) {
                pickX = x;
                pickY = y;
                bestDistance = candidateDistance;
                bestSquared = candidateSquared;
                bestPath = path;
            }
        }
    }

    if (pickX !== originX || pickY !== originY)
        return findDirectTravelDirection(pickX, pickY, g);

    const dx = Math.sign(targetX - originX);
    const dy = Math.sign(targetY - originY);
    return travelStepAllowed(originX, originY, originX + dx, originY + dy, g)
        ? { dx, dy } : null;
}

export function findTravelDirection(state: RunState | null | undefined = game._runState, g: GameState = game): { dx: number; dy: number } | null {
    if (!state || state.mode !== 8 || !g.u || !g.level) return null;
    const { targetX, targetY } = state;
    if (g.u.ux === targetX && g.u.uy === targetY) return null;
    return findDirectTravelDirection(targetX, targetY, g)
        || findGuessedTravelDirection(targetX, targetY, g);
}

function canSeeRunMonster(monster: Monster, x: number, y: number, g: GameState = game): boolean {
    if (g === game) return canSeeMonster(monster);
    const visibleSquare = !g.viz_array
        || !!((g.viz_array?.[y]?.[x] ?? 0) & 0x2);
    return !g.blind && !((g.u.blindTurns ?? 0) > 0) && visibleSquare
        && (!monster.minvis || !!g.u.seeInvisible)
        && !monster.mundetected;
}

function travelInterruptedByMonster(g: GameState = game): boolean {
    return !!g.level?.monsters?.some(monster =>
        monsterHasMapPosition(monster, g)
        && Math.abs(monster.mx - g.u.ux) <= 1
        && Math.abs(monster.my - g.u.uy) <= 1
        && (monster.mx !== g.u.ux || monster.my !== g.u.uy)
        && !monster.pet && !monster.mpeaceful && cansee(monster.mx, monster.my));
}

function startTravel(targetX: number, targetY: number, g: GameState = game): TravelRunState {
    g._runState = {
        mode: 8,
        targetX,
        targetY,
        lastStrTurn: 0,
    };
    g._travelTarget = { x: targetX, y: targetY };
    if (!g.multi) g.multi = Math.max(COLNO, ROWNO);
    g.context.run = 8;
    g.context.mv = true;
    g.context.travel = true;
    g.context.travel1 = true;
    g.context.nopick = true;
    return g._runState;
}

// C hack.c:lookaround(). Count nearby corridor choices before deciding
// whether to turn, and stop for visible actors, known traps, or liquid edges.
export async function lookaroundRun(state: RunState | null | undefined = game._runState, g: GameState = game): Promise<boolean> {
    if (!state || state.mode === 8 || !g.u || !g.level) return false;
    const noDiagonal = MONSTER_NAME[g.u.umonnum ?? -1] === 'grid bug';
    if (noDiagonal && state.dx && state.dy) {
        await plineWithContinuation('You cannot move diagonally.');
        return false;
    }
    if (heroIsBlind(g)) return true;
    if (state.mode === 0) return true;

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
                || (x === u.ux && y === u.uy)) continue;
            if (noDiagonal && x !== u.ux && y !== u.uy) continue;

            const infront = x === targetX && y === targetY;
            const monster = g.level.monsters?.find(mon => monsterHasMapPosition(mon, g) &&
                mon.mx === x && mon.my === y);
            // hack.c:lookaround() considers an actor interesting only inside
            // its mon_visible() branch.  An invisible monster directly in
            // front must reach domove()/attack_checks(), which remembers the
            // unseen occupant instead of silently ending the run.
            const visibleMonster = monster && M_AP_TYPE(monster) !== M_AP_FURNITURE
                && M_AP_TYPE(monster) !== M_AP_OBJECT
                && canSeeRunMonster(monster, monster.mx, monster.my, g);
            const safeMonster = monster && (g.flags.safe_dog ?? true)
                && monster.mpeaceful && !g.context.forcefight
                && !(u.confusionTurns ?? 0) && !u.stunned && !(u.stunnedTurns ?? 0)
                && !heroIsHallucinating(g);
            const visibleHostile = visibleMonster && !safeMonster;
            if (visibleMonster && (infront
                || (state.mode !== 1 && visibleHostile))) {
                if (g.flags.mention_walls)
                    await plineWithContinuation(`${monsterName(monster, { state: g, article: 'a', capitalized: true })} blocks your path.`);
                return false;
            }

            const loc = g.level.at(x, y);
            if (!loc) continue;
            const typ = loc.typ;
            if (typ === STONE) continue;
            if (x === u.ux - state.dx && y === u.uy - state.dy) continue;

            let corridorLike = false;
            const trap = knownRunTrap(x, y, g);
            if (trap && state.mode !== 1 && infront) {
                await announceRunTrap(trap, g);
                return false;
            }
            if (trap && state.mode === 1) {
                corridorLike = true;
            } else if (IS_OBSTRUCTED(typ) || typ === ROOM || IS_AIR(typ)
                || typ === ICE) {
                continue;
            } else if (typ === DOOR || hasDoorAppearance(monster)) {
                const closed = hasDoorAppearance(monster) || !!(loc.doormask & (D_CLOSED | D_LOCKED));
                if (closed) {
                    if (x !== u.ux && y !== u.uy) continue;
                    if (state.mode !== 1) {
                        if (g.flags.mention_walls)
                            await plineWithContinuation('You stop in front of the door.');
                        return false;
                    }
                    corridorLike = true;
                } else if (state.mode === 1) {
                    corridorLike = true;
                } else if (monster) {
                    continue;
                } else if ((x === u.ux - state.dx
                    && y !== u.uy + state.dy)
                    || (y === u.uy - state.dy
                        && x !== u.ux + state.dx)) {
                    continue;
                } else {
                    // hack.c:lookaround() treats an open/doorless doorway as
                    // interesting to run/rush modes 2 and 3.  Mode 1 alone
                    // folds it into corridor turning.
                    return false;
                }
            } else if (typ === CORR) {
                corridorLike = true;
            } else if (isPoolOrLavaAt(x, y, g)) {
                if (infront && runLiquidIsDangerous(x, y, g)) {
                    await announceRunLiquid(x, y, g);
                    return false;
                }
                continue;
            } else {
                if (state.mode === 1) {
                    // For run mode 1, stairs, furniture, and other non-room
                    // locations participate in corridor routing (the C
                    // bcorr branch) instead of being interesting stop points.
                    corridorLike = true;
                } else if (monster) {
                    continue;
                } else if ((x === u.ux - state.dx
                    && y !== u.uy + state.dy)
                    || (y === u.uy - state.dy
                        && x !== u.ux + state.dx)) {
                    continue;
                } else {
                    return false;
                }
            }

            if (!corridorLike || currentTyp === ROOM) continue;

            if (state.mode === 1 || state.mode === 3) {
                const distance = runDist2(x, y, targetX, targetY);
                if (distance > 2) continue;
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

    if (corrct > 1 && state.mode === 2) {
        if (g.flags.mention_walls)
            await plineWithContinuation('The corridor widens here.');
        return false;
    }
    if ((state.mode === 1 || state.mode === 3) && !noturn && !m0 && i0
        && (corrct === 1 || (corrct === 2 && i0 === 1))) {
        let turn;
        if (i0 === 2) {
            turn = state.dx === y0 - u.uy && state.dy === u.ux - x0
                ? 2 : -2;
        } else if (state.dx && state.dy) {
            turn = ((state.dx === state.dy && y0 === u.uy)
                || (state.dx !== state.dy && y0 !== u.uy)) ? -1 : 1;
        } else {
            turn = ((x0 - u.ux === y0 - u.uy && !state.dy)
                || (x0 - u.ux !== y0 - u.uy && state.dy)) ? 1 : -1;
        }
        turn += state.lastStrTurn;
        if (turn >= -2 && turn <= 2) {
            state.lastStrTurn = turn;
            state.dx = x0 - u.ux;
            state.dy = y0 - u.uy;
        }
    }
    return true;
}

export async function continueRun(g: GameState = game): Promise<boolean> {
    const state = g._runState;
    if (state?.mode === 8) {
        if (g.u.ux === state.targetX && g.u.uy === state.targetY) {
            // hack.c:findtravelpath() clears iflags.travelcc when the final
            // step reaches the cached destination.  A later '_' command then
            // starts getpos at the hero rather than the old map coordinate.
            g._travelTarget = null;
            stopRun(g);
            g.context.move = 0;
            return false;
        }
        if (travelInterruptedByMonster(g)) {
            stopRun(g);
            g.context.move = 0;
            return false;
        }
        const direction = findTravelDirection(state, g);
        if (!direction) {
            stopRun(g);
            g.context.move = 0;
            return false;
        }
        const finalStep = g.u.ux + direction.dx === state.targetX
            && g.u.uy + direction.dy === state.targetY;
        // hack.c:findtravelpath(TRAVP_TRAVEL) clears iflags.travelcc when it
        // chooses the destination as the next step, before domove() discovers
        // whether that final square is physically enterable.
        if (finalStep) g._travelTarget = null;
        await captureRunmodeDelay(g, !!g.context.run || g.multi > 0);
        if (g.multi < COLNO && --g.multi === 0) stopRun(g);
        const moved = await domove(direction.dx, direction.dy, false);
        if (g.program_state.gameover) return false;
        if (moved) await captureRunmodeDelay(g, !!g._runState);
        g.context.travel1 = false;
        g.context.move = moved ? 1 : 0;
        if (g.u.ux === state.targetX && g.u.uy === state.targetY)
            g._travelTarget = null;
        if (!moved || (g.u.ux === state.targetX && g.u.uy === state.targetY))
            stopRun(g);
        return moved;
    }
    if (!state || !await lookaroundRun(state, g)) {
        stopRun(g);
        g.context.move = 0;
        return false;
    }

    await captureRunmodeDelay(g, !!g.context.run || g.multi > 0);
    if (g.multi < COLNO && --g.multi === 0) stopRun(g);
    const moved = await domove(state.dx, state.dy, false);
    if (g.program_state.gameover) return false;
    if (moved) await captureRunmodeDelay(g, !!g._runState);
    g.context.move = moved ? 1 : 0;
    if (!moved) stopRun(g);
    return moved;
}

// C refs: cmd.c set_occupation()/timed_occupation() and
// allmain.c:moveloop_core().  A count-prefixed search executes once in
// rhack(), then repeats without reading another input key; each repetition is
// separated by the complete monster/global turn scheduler.
export async function continueCountedCommand(g: GameState = game): Promise<boolean> {
    if (!g._occupation) return false;
    g.context.move = 1;
    await continueOccupation(g);
    if (g.program_state.gameover) return false;
    g.context.move = 1;
    if (threateningMonsterNearby()) await stopHeroOccupation(g);
    return !g.program_state.gameover;
}

async function continueOccupation(g: GameState): Promise<boolean> {
    const occupation = g._occupation;
    if (!occupation) {
        g._occupation = null;
        return false;
    }
    if (occupation.key === 'command') {
        g.context.move = 1;
        await runCommandHandler(occupation.binding);
        if (g.program_state.gameover) return false;
        g.context.move = 1;
        if (g.multi > 0) --g.multi;
        if (!(g.multi > 0)) g._occupation = null;
        return true;
    }
    if (occupation.key === 'dig') {
        const continuing = await continueHeroDigging(g);
        if (g.program_state.gameover) return false;
        if (!continuing) g._occupation = null;
        g.context.move = 1;
        return true;
    }
    if (occupation.key === 'study-book') {
        const continuing = await continueSpellbookStudy({ state: g });
        if (g.program_state.gameover) return false;
        if (!continuing) g._occupation = null;
        return true;
    }
    if (occupation.key === 'force-lock') {
        return continueForceLock(occupation, g);
    }
    if (occupation.key === 'takeoff') {
        const continuing = await continueBulkTakeoff(g);
        if (!continuing) g._occupation = null;
        return continuing;
    }
    if (occupation.key === 'set-trap') {
        const continuing = await continueTrapSetting(g);
        if (!continuing) g._occupation = null;
        g.context.move = 1;
        return true;
    }
    if ('remaining' in occupation && occupation.remaining <= 0) {
        g._occupation = null;
        return false;
    }
    if (occupation.key === 'pick-lock') return continuePicking(occupation, g);
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
        if (g.program_state.gameover) return false;
        if (!continuing) g._occupation = null;
        g.context.move = 1;
        return true;
    }
    g._occupation = null;
    return false;
}

function prepareTimedCommand(binding: CommandBinding): void {
    const text = binding.command?.occupation;
    if (text && !game._occupation && game.multi) {
        game._occupation = { key: 'command', text, binding };
    }
}

async function redrawCommand(): Promise<void> {
    await restoreCommandMap();
    game.context.move = 0;
}

async function performWaitCommand(force = game.iflags.menu_requested) {
    if (!await donull(force, !!game.multi)) return;
    game.context.move = 1;
}

// C cmd.c:can_do_extcmd(). Admission precedes prefixes and handler setup.
async function commandAllowed(command: NativeCommand | null | undefined): Promise<boolean> {
    if (!command) return true;
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
export async function rhack(key: number): Promise<void> {
    requirePlayingGame(game);
    game.context.nopick = false;
    game.iflags.menu_requested = false;
    if (key !== 0) delete game._cursorOverride;
    game._heroMeleeThisCommand = false;
    game._silentPrefixRetainedTopline = false;
    const previousMessage = game._pending_message;
    const movement = game._movementAttempt ?? { walk: false, rush: false };
    game._movementAttempt = movement;
    let prefix: NativeCommand | null = null;
    let menuPrefix = false;

    for (;;) {
        const repeated = takeRepeatCommand();
        const cannedCommand = game._inDoAgain ? null : game._cannedCommands?.shift() ?? null;
        if (key === 0 && !cannedCommand && !repeated) {
            key = (await readCommandInput()).key;
            delete game._cursorOverride;
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
        const configured = repeated?.binding ?? configuredCommand(key);
        if (!cannedCommand) {
            game._pending_message = '';
            game._retained_message = '';
        }
        const cannedName = cannedCommand?.kind === 'swap-weapon'
            ? 'swap' : cannedCommand?.kind;
        const command = cannedCommand?.kind === 'inventory-action'
            ? inventoryActionCommand(cannedCommand.action)
            : cannedCommand
                ? NATIVE_COMMANDS.find(entry => entry.name === cannedName) ?? null
                : configured.command;
        if (!command) {
            await pline(`Unknown command '${visibleCommandKey(key)}'.`);
            // Unlike a rejected known command, C's unknown-key tail keeps
            // pending movement flags until the next command resolves them.
            game._cannedCommands = [];
            clearCommandKeys();
            clearRepeatCommand();
            game.context.move = 0;
            game.multi = 0;
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
            if (menuPrefix)
                await pline(`The ${command.name} command does not accept '${which}' prefix.`);
            else {
                const vertical = command.handler === 'doup' || command.handler === 'dodown';
                await pline(`The '${which}' prefix should be followed by a movement command${vertical ? ' other than up or down' : ''}.`);
            }
            resetCommandVariables(true);
            return;
        }
        let binding: CommandBinding = { ...configured, command };
        prepareTimedCommand(binding);
        if (command.handler === 'doextcmd') {
            clearRepeatCommand();
            const { selected, lastExecuted } = await readExtendedCommand();
            if (!selected || !await commandAllowed(selected)) {
                // doextcmd() leaves ext_tlist pointing at the last list it
                // executed when the following editor quits or is rejected.
                if (lastExecuted) rememberCommand({
                    key: commandExecutionKey(lastExecuted.name)?.charCodeAt(0) ?? null,
                    command: lastExecuted, parameter: null,
                }, false);
                resetCommandVariables(false);
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
        if (!selected) throw new Error('Command dispatch lost its selected command');
        if (selected.handler === 'do_repeat') {
            await repeatLastCommand();
            // The outer rhack() dispatches do_repeat, not dokick.
            if (game.context.move) game._kickedLoc = null;
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
                if (command.handler === 'do_reqmenu') menuPrefix = true;
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

// C cmd.c:do_repeat(). Preserve the saved queue even when its execution
// cancels, so another repeat makes the same attempt in the new context.
async function repeatLastCommand(): Promise<void> {
    if (game._inDoAgain) return;
    const saved = [...(game._repeatCommands ?? [])];
    if (!saved.length) {
        await pline('There is no command available to repeat.');
        resetCommandVariables(true);
        return;
    }
    game._inDoAgain = true;
    try {
        await rhack(0);
    } finally {
        game._inDoAgain = false;
        game._repeatCommands = saved;
        game.iflags.menu_requested = false;
    }
}

async function applyMovementPrefix(command: NativeCommand, movement: MovementAttempt): Promise<boolean> {
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

async function dispatchMovement(binding: CommandBinding, prefixes: MovementAttempt): Promise<void> {
    const key = binding.key ?? 0;
    const ch = String.fromCharCode(key);
    const direction = controlRushDirection(key) || ch.toLowerCase();
    if (!isMovementKey(direction)) throw new Error('Movement command has no direction');
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
    const mode: DirectionalRunMode = prefixes.walk || prefixes.rush
        ? game.context.run === 2 ? 2 : game.context.run === 3 ? 3 : 0
        : controlRushDirection(key) ? 3 : ch !== ch.toLowerCase() ? 1 : 0;
    game.context.run = mode;
    if (game.iflags.menu_requested) game.context.nopick = true;
    if (game.multi > 0 || (mode && !prefixes.walk))
        startRun(hero.dx, hero.dy, game, mode);
    const moved = await domove(hero.dx, hero.dy);
    if (game.program_state.gameover) return;
    if (mode && !prefixes.walk && moved)
        await captureRunmodeDelay(game, !!game._runState);
    game.context.move = moved ? 1 : 0;
    if (!moved) stopRun();
    if (!mode || prefixes.walk) game.context.forcefight = false;
    game.iflags.menu_requested = false;
}

// C cmd.c:rhack() clears kickedloc after an elapsed non-kick action.
// doextcmd's selected action, not the outer # editor, owns that result.
async function executeCommandAction(binding: CommandBinding, options: CommandActionOptions = {}): Promise<void> {
    await runCommandHandler(binding, options);
    if (game.program_state.gameover) return;
    if (!game.context.move) resetCommandVariables(game.multi < 0);
    if (game.context.move
        && binding.command?.handler !== 'dokick'
        && binding.command?.handler !== 'doextcmd') {
        game._kickedLoc = null;
    }
}

interface CommandActionOptions {
    cannedCommand?: CannedCommand | null;
}

// Admission belongs to the caller. Keep the selected binding, including its
// parameter, rather than looking up a possibly rebound key inside the action.
async function runCommandHandler(binding: CommandBinding, {
    cannedCommand = null,
}: CommandActionOptions = {}): Promise<void> {
    const { key, command } = binding;
    const ch = key === null ? '' : String.fromCharCode(key);
    if (!cannedCommand && key === null && command) {
        const handler = command.name === null ? undefined : EXTENDED_COMMAND_HANDLERS.get(command.name);
        if (handler) {
            await handler();
            return;
        }
        await pline(`#${command.name}: unknown extended command.`);
        game.context.move = 0;
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
        } finally {
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
        if (game.flags.debug) await wizardTeleportCommand(teleportAtWillCommand);
        else await teleportAtWillCommand(false);
        return;
    }
    if (key === 6 && game.flags?.debug) { // Ctrl-F: wiz_map()
        await wizMap();
        return;
    }

    if (ch === 'i') {
        enqueueInventoryAction(await ddoinv());
    } else if (ch === 'I') {
        enqueueInventoryAction(await inventoryReport('type'));
    } else if (ch === '(') {
        enqueueInventoryAction(await inventoryReport('tools'));
    } else if (ch === '*') {
        enqueueInventoryAction(await inventoryReport('inuse'));
    } else if (ch === 'O') {
        await doOptions(game.iflags.menu_requested);
    } else if (ch === 'Z') {
        await docast();
    } else if (ch === '+') {
        await dovspell();
    } else if (ch === '\\') {
        await dodiscovered();
    } else if (key === 24) { // Ctrl-X
        await doattributes();
    } else if (ch === 's') {
        await dosearch(game.iflags.menu_requested);
    } else if (key === 4) { // Ctrl-D
        await dokick();
    } else if (ch === 'f') {
        await dofire();

    } else if (ch === '.') {
        await performWaitCommand();
    } else if (ch === 'e') {
        await doeat();
    } else if (ch === 'q') {
        await doquaff();
    } else if (ch === 'p') {
        await dopay();
    } else if (ch === 'd') {
        await dodrop();
    } else if (ch === 'c') {
        await doclose();
    } else if (ch === 'o') {
        await doopen();
    } else if (ch === '@') {
        // C options.c:dotogglepickup().  This is an immediate option command,
        // not a turn, and its class list is the live pickup_types setting.
        game.flags.pickup = !game.flags.pickup;
        const classes = game.flags.pickup_types || '';
        await pline(game.flags.pickup
            ? `Autopickup: ON, for ${classes || 'all'} objects.`
            : 'Autopickup: OFF.');
        game.context.move = 0;
    } else if (ch === ',') {
        await pickupAtHero();
    } else if (ch === '>') {
        await travelStairs(false);
    } else if (ch === '<') {
        await travelStairs(true);
    } else if (ch === 'z') {
        await dozap();
    } else if (ch === 'r') {
        await readCommand();
    } else if (ch === 'T' || ch === 'R') {
        await removeWornItem(ch === 'R' ? 'remove' : 'take off');
    } else if (ch === 'A') {
        await takeOffAll();
    } else if (ch === 'P') {
        await doputon();
    } else if (ch === 'W') {
        await dowear();
    } else if (ch === 'w') {
        await dowield();
    } else if (ch === 'x') {
        await doswapweapon();
    } else if (ch === 'a') {
        await doapply();
    } else if (ch === ':') {
        await dolook();
    } else if (ch === 'V') {
        await doversion();
    } else if (ch === '&') {
        await whatDoesCommand();
    } else if (ch === '?') {
        await dohelp();
    } else if (ch === '#') {
        await rhack(game.commandBindings.keyForCommand('#'));
    } else if (ch === 'Q') {
        await doready();
    } else if (ch === 't') {
        await dothrow();
    } else if (ch === '_') {
        await dotravel();
    } else if (ch === ';') {
        await doFarlook();
    } else if (ch === 'S') {
        await dosave();
    } else if (ch === '$') {
        enqueueInventoryAction(await inventoryReport('gold'));
    } else if (ch === ')') {
        enqueueInventoryAction(await inventoryReport('weapon'));
    } else if (ch === '[') {
        enqueueInventoryAction(await inventoryReport('armor'));
    } else if (ch === '=') {
        enqueueInventoryAction(await inventoryReport('rings'));
    } else if (ch === '"') {
        enqueueInventoryAction(await inventoryReport('amulet'));
    } else if (key === 127) { // Delete: overview of known terrain.
        await doTerrainOverview();
    } else if (key === 27) { // Escape cancels without producing a message.
        game.context.move = 0;
    } else {
        // Unknown command
        game.context.move = 0;
        await pline(`Unknown command '${ch}'.`);
    }
}

function enqueueInventoryAction(action: InventoryAction | null): void {
    if (action && !['\x1b', ' ', '\n', '\r'].includes(action.key)) {
        game._cannedCommands ??= [];
        game._cannedCommands.push({ kind: 'inventory-action', action });
    }
}

async function doquaff() {
    const result = await quaff();
    if (result.cancelled) resetCommandVariables(true);
    game.context.move = result.spentTime && !result.heroDied ? 1 : 0;
}

async function readCommand(): Promise<void> {
    const result = await doread();
    if (result.cancelled) resetCommandVariables(true);
}

type SpecialLayoutEvent = SpecialLevelDescriptor & {
    kind: 'special'; name: string;
};
type DungeonLayoutEvent = SpecialLayoutEvent | {
    kind: 'branch'; dnum: number; dlevel: number; branch: DungeonBranch;
};
interface WizardLevelDestination extends DungeonLocation {
    prototype?: string;
}

function someGold(amount: number | null | undefined) {
    const gold = Math.min(
        0x7fffffff,
        Math.max(0, Math.trunc(amount ?? 0)),
    );
    if (gold < 50) return gold;
    const floor = gold < 100 ? 25
        : gold < 500 ? 50
            : gold < 1000 ? 100
                : gold < 5000 ? 500
                    : gold < 10000 ? 1000 : 5000;
    return floor + rn2(gold - floor + 1);
}

async function discoverFountainGem(loc: MapLocation) {
    return applyFountainGemDiscovery({
        loc,
        blind: heroIsBlind(),
        announce: (message: string) => pline(message),
        chooseGem: () => rndClass(DILITHIUM_CRYSTAL, LUCKSTONE - 1),
        createGem: (gemType: number) => mksobj(gemType, false, false),
        placeGem: (gem: GameObject) => placeCreatedObject(gem, game.u.ux, game.u.uy),
        repaint: () => newsym(game.u.ux, game.u.uy),
        exerciseWisdom,
    });
}

function fountainActorGone(mnum: number) {
    return !!((game.mvitals?.[mnum]?.mvflags ?? 0) & G_GONE);
}

function fountainActorIndefiniteName(monster: Monster) {
    return monsterName(monster, { article: 'a' });
}

function fountainActorVisibleSubject(monster: Monster) {
    return monsterName(monster, { capitalized: true });
}

function fountainTrapAt(monster: Monster) {
    return game.level?.traps?.some(trap =>
        trap.tx === monster.mx && trap.ty === monster.my) ?? false;
}

async function triggerFountainTrap(monster: Monster) {
    const state = requireInitializedGame();
    const action = await triggerImmediateMonsterTrap(monster, state);
    if (!state.program_state.gameover) {
        await resumeDeferredMonsterTrap(action, state, {
            describeMonster: fountainActorVisibleSubject,
            publish: plineWithContinuation,
        });
    }
    return { heroDied: !!state.program_state.gameover };
}

async function summonFountainNymph() {
    return applyFountainNymphActor({
        gone: fountainActorGone(PM_WATER_NYMPH),
        blind: heroIsBlind(),
        createMonster: async () => {
            const nymph = await makemonNear(
                PM_WATER_NYMPH, game.u.ux, game.u.uy, MM_NOMSG,
            );
            if (nymph) newsym(nymph.mx, nymph.my);
            return nymph;
        },
        announce: plineWithContinuation,
        nymphDescription: fountainActorIndefiniteName,
        trapAt: fountainTrapAt,
        triggerTrap: triggerFountainTrap,
    });
}

async function summonFountainDemon() {
    return applyFountainDemonActor({
        gone: fountainActorGone(PM_WATER_DEMON),
        blind: heroIsBlind(),
        difficulty: level_difficulty(),
        createMonster: async () => {
            const demon = await makemonNear(
                PM_WATER_DEMON, game.u.ux, game.u.uy, MM_NOMSG,
            );
            if (demon) newsym(demon.mx, demon.my);
            return demon;
        },
        announce: plineWithContinuation,
        demonIndefiniteName: fountainActorIndefiniteName,
        demonPronouns: monster => ({
            possessive: monsterPossessive(monster),
            pronoun: monsterSubjectPronoun(monster),
        }),
        grantWish: (demon: Monster) => grantMonsterWish(demon),
        trapAt: fountainTrapAt,
        triggerTrap: triggerFountainTrap,
    });
}

async function summonFountainSnakes() {
    return applyFountainSnakeActors({
        gone: fountainActorGone(PM_WATER_MOCCASIN),
        blind: heroIsBlind(),
        hallucinating: heroIsHallucinating(),
        random: rn2,
        hallucinatedPlural: () => makePlural(randomDisplayMonsterName()),
        // dowatersnakes() owns the first ordinary pline; only a later dryup
        // line enters the branch-scoped continuation path below.
        announce: pline,
        createMonster: async () => {
            const snake = await makemonNear(
                PM_WATER_MOCCASIN, game.u.ux, game.u.uy, MM_NOMSG,
            );
            if (snake) newsym(snake.mx, snake.my);
            return snake;
        },
        trapAt: fountainTrapAt,
        triggerTrap: triggerFountainTrap,
    });
}

export async function drinkFountain(loc: MapLocation) {
    let fountainMessage = '';
    const blessed = !!loc.blessedftn;
    const fate = rnd(30);
    if (propertyIsActive('levitation')) {
        await floatingAbove('fountain');
        return false;
    }
    if (blessed && (game.u.uluck ?? 0) >= 0 && fate >= 10) {
        await blessedFountainDraught(loc);
        return false;
    }
    if (fate < 10) {
        // fountain.c:drinkfountain() handles the ordinary low-fate draught
        // before its numbered switch.  Nutrition is credited before dryup()
        // and the elapsed-turn scheduler applies its normal hunger cost.
        await plineWithContinuation('The cool draught refreshes you.');
        game.u.uhunger = (game.u.uhunger ?? 900) + rnd(10);
        await updateHeroHunger(false);
        if (game.program_state.gameover) return true;
        if (blessed) return false;
    } else if (fate === 19) {
        await plineWithContinuation(formatFeltMessage('self-knowledgeable...'));
        await flushPendingTopline();
        await showEnlightenment({ basic: false, magic: true });
        await exerciseAttribute(A_WIS, true);
        await plineWithContinuation('The feeling subsides.');
    } else if (fate === 20) {
        await plineWithContinuation('The water is foul!  You gag and vomit.');
        // C refs: fountain.c:drinkfountain(), eat.c:vomit(), and
        // allmain.c:moveloop_core().  Foul water first removes 11..30 points
        // of nutrition, then nomul(-2) makes the next two global turns happen
        // without accepting a hero command.
        await spendHeroNutrition(11 + rn2(20));
        if (game.program_state.gameover) return true;
        await vomitHero({ state: game });
        if (game.program_state.gameover) return true;
    } else if (fate === 21) {
        await plineWithContinuation('The water is contaminated!');
        if (game.u.poisonResistance) {
            await plineWithContinuation(
                `Perhaps it is runoff from the nearby ${fruitName(false)} farm.`,
            );
            if (await loseHeroHp(rnd(4), 'unrefrigerated sip of juice')) return true;
        } else {
            if (await poisonHeroStrengthAndHp(
                3 + rn2(4), rnd(10), 'contaminated water',
                { deathCause: 'killed by contaminated water' },
            )) return true;
            await exerciseAttribute(A_CON, false);
        }
    } else if (fate === 22) {
        await summonFountainSnakes();
    } else if (fate === 23) {
        await summonFountainDemon();
    } else if (fate === 24) {
        await plineWithContinuation("This water's no good!");
        await spendHeroNutrition(11 + rn2(20));
        if (game.program_state.gameover) return true;
        await exerciseAttribute(A_CON, false);
        // A curse can drop the offhand weapon and change the inventory.
        for (const object of [...game.inventory]) {
            if (object.oclass !== 12 && !object.cursed && !rn2(5)) {
                await curseObject(object);
                if (game.program_state.gameover) return true;
            }
        }
    } else if (fate === 25) {
        if (heroIsBlind()) {
            if (propertyIsActive('invisible') && !propertyIsActive('seeInvisible')) {
                await plineWithContinuation('You feel transparent.');
            } else {
                await plineWithContinuation('You feel very self-conscious.');
                await plineWithContinuation('Then it passes.');
            }
        } else {
            await plineWithContinuation(formatSeenMessage('an image of someone stalking you.'));
            await plineWithContinuation('But it disappears.');
        }
        grantIntrinsicProperty('seeInvisible', 'outside');
        newsym(game.u.ux, game.u.uy);
        await exerciseAttribute(A_WIS, true);
    } else if (fate === 26) {
        if ((await detectMonsters(null)).result)
            await plineWithContinuation(`The ${displayLiquidName('water')} tastes like nothing.`);
        await exerciseAttribute(A_WIS, true);
    } else if (fate === 27 && !((loc.looted ?? 0) & 1)) {
        await discoverFountainGem(loc);
    } else if (fate === 27 || fate === 28) {
        await summonFountainNymph();
    } else if (fate === 29) {
        await plineWithContinuation(`This ${displayLiquidName('water')} gives you bad breath!`);
        for (const monster of [...requireGameLevel().monsters].reverse()) {
            if (monster.dead || monster.mhp <= 0) continue;
            if ((await makeMonsterFlee(monster, { announce: false })).heroDied)
                return true;
        }
    } else if (fate === 30) {
        await gushForthFromFountain({ drinking: true });
    } else if (fate >= 10) {
        fountainMessage =
            `This tepid ${displayLiquidName('water')} is tasteless.`;
    }
    if (game.program_state.gameover) return true;
    if (fountainMessage) await plineWithContinuation(fountainMessage);

    await dryFountainAt(game.u.ux, game.u.uy);
    return false;
}

async function blessedFountainDraught(loc: MapLocation): Promise<void> {
    requirePlayingGame(game);
    const state = game;
    const hero = state.u;
    await plineWithContinuation('Wow!  This makes you feel great!');
    for (const attribute of ATTRIBUTE_DISPLAY_ORDER) {
        if (hero.acurr.a[attribute] < hero.amax.a[attribute]) {
            hero.acurr.a[attribute] = hero.amax.a[attribute];
            state.context.botl = true;
        }
    }
    const littleLuck = (hero.uluck ?? 0) < 4;
    const start = rn2(A_MAX);
    for (let offset = 0; offset < A_MAX; offset++) {
        const attribute = (start + offset) % A_MAX;
        const change = adjustAttribute(attribute, 1, state);
        if (change.changed || !littleLuck
            && (change.blockedByDunceCap || state.flags.verbose !== false)) {
            const message = attributeChangeMessage(attribute, change, state);
            if (message) await plineWithContinuation(message);
        }
        if (change.changed && state._moveloopStarted
            && (attribute === A_STR || attribute === A_CON))
            await reportHeroEncumbrance(state);
        if (change.changed && littleLuck) break;
    }
    await displayMessageWindow();
    await plineWithContinuation('A wisp of vapor escapes the fountain...');
    await exerciseAttribute(A_WIS, true);
    loc.blessedftn = 0;
}

// C do.c:u_stuck_cannot_go(). A sticky hero releases its captive, while
// being held or swallowed prevents even an attempt to use the floor below.
async function monsterPreventsStairTravel(up: boolean): Promise<boolean> {
    const holder = game.u.ustuck;
    if (!holder) return false;
    if (game.u.uswallow || !heroFormSticks(game)) {
        const condition = !game.u.uswallow ? 'being held'
            : monsterDigests(holder) ? 'swallowed' : 'engulfed';
        await plineWithContinuation(`You are ${condition}, and cannot go ${up ? 'up' : 'down'}.`);
        game.context.move = 1;
        return true;
    }
    game.u.ustuck = null;
    game.u.uswallow = 0;
    game.u.uswldtim = 0;
    game.context.botl = true;
    await plineWithContinuation(`You release ${monsterName(holder)}.`);
    return false;
}

export async function travelStairs(up: boolean) {
    const level = requireGameLevel();
    requireInitializedHero(game.u);
    game.u.dx = game.u.dy = 0;
    game.u.dz = up ? -1 : 1;
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
            if (game.u.flying) await plineWithContinuation('You fly out of hiding.');
            else {
                await plineWithContinuation(`You drop to the ${surfaceName(game.u.ux, game.u.uy)}.`);
                if (isPoolAt(game.u.ux, game.u.uy) || isLavaAt(game.u.ux, game.u.uy)) {
                    await applyHeroLiquidEffects();
                } else {
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
        if (await monsterPreventsStairTravel(false)) return false;
    }
    let stairs = game.stairs;
    while (stairs && (stairs.sx !== game.u.ux || stairs.sy !== game.u.uy
        || !!stairs.up !== up)) stairs = stairs.next;
    if (!stairs) {
        const pit = !up && level.traps.find(trap =>
            trap.tx === game.u.ux && trap.ty === game.u.uy
            && (trap.ttyp === PIT || trap.ttyp === SPIKED_PIT) && trap.tseen
            && !(game.u.utrap && game.u.utraptype === TT_PIT));
        if (pit) {
            await triggerHeroTrapAt(game.u.ux, game.u.uy, { gotoLevel, tookPlunge: true });
            game.context.move = 1;
            return true;
        }
        const hole = !up && level.traps.find(trap =>
            trap.tx === game.u.ux && trap.ty === game.u.uy
            && (trap.ttyp === HOLE || trap.ttyp === TRAPDOOR) && trap.tseen);
        if (hole) {
            const result = await triggerHeroTrapAt(game.u.ux, game.u.uy, { gotoLevel, tookPlunge: true });
            if (result.died) return false;
            game.context.move = 1;
            return true;
        }
        const pick = game.uwep || game.u.uwep;
        if (!up && game.flags.autodig && !game.context.nopick && pick && isPick(pick)) {
            const result = await applyPickAxeDirection(pick, {
                state: game,
                attackMonster: (target: Monster) => attackHostileMonster(target, target.mx, target.my),
                payShopkeeper: dopay,
            });
            game.context.move = result.spentTime ? 1 : 0;
            return result.spentTime;
        }
        const vibratingSquare = !up && level.traps.some(trap =>
            trap.tx === game.u.ux && trap.ty === game.u.uy && trap.ttyp === VIBRATING_SQUARE);
        await plineWithContinuation(`You can't go ${up ? 'up' : 'down'} here${vibratingSquare ? ' yet' : ''}.`);
        game.context.move = 0;
        return false;
    }
    if (!up && game.valley_level?.dnum === game.u.uz.dnum
        && game.valley_level.dlevel === game.u.uz.dlevel
        && !game.u.uevent?.gehennom_entered) {
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
    if (up && await monsterPreventsStairTravel(true)) return false;
    if (up && nearCapacity(game) > SLT_ENCUMBER) {
        await plineWithContinuation(`Your load is too heavy to climb the ${
            level.requireAt(game.u.ux, game.u.uy).typ === STAIRS ? 'stairs' : 'ladder'}.`);
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
    const changed = await gotoLevel(stairs.tolev, {
        arrival: up ? 'downstairs' : 'stairs',
        ladder: !!stairs.isladder,
    });
    if (changed !== false) game.context.move = 1;
    return changed !== false;
}

async function doTerrainOverview(): Promise<void> {
    await terrainCommand(farlookLocationDescription);
}

async function kickOuch(x: number, y: number, objectName = '') {
    await plineWithContinuation('Ouch!  That hurts!');
    await exerciseAttribute(A_DEX, false);
    await exerciseAttribute(A_STR, false);
    if (isok(x, y)) {
        if (heroIsBlind(game)) feel_location(x, y);
        const location = game.level?.at(x, y);
        const bridge = location && (location.typ === DOOR || location.typ === DBWALL)
            ? findDrawbridgeAt(x, y) : null;
        if (bridge) {
            await plineWithContinuation('The drawbridge is unaffected.');
            x = bridge.x;
            y = bridge.y;
        }
        wakeMonstersNear(x, y, 25);
    }
    if (rn2(3) === 0) {
        await woundHeroLegs('right', 5 + rnd(5));
    }
    let damage = rnd(currentAttribute(A_CON) > 15 ? 3 : 5);
    if (game.u?.halfPhysicalDamage)
        damage = Math.trunc((damage + 1) / 2);
    const died = await damageHeroFromKick(damage, x, y, objectName);
    if (!died && kickCausesRecoil())
        await recoilFromKick(4 + rn2(2));
}

function kickCausesRecoil() {
    return Is_airlevel(game.u?.uz) || game.u?.levitating
        || game.u?.levitation || game.levitating;
}

function kickDeathReason(x: number, y: number) {
    if (!isok(x, y)) return 'kicking nothing';
    const location = game.level?.at?.(x, y);
    if (!location) return 'kicking nothing';
    if (location.typ === DOOR) return 'kicking a door';
    if (IS_TREE(location.typ)) return 'kicking a tree';
    if (IS_STWALL(location.typ)) return 'kicking a wall';
    if (IS_OBSTRUCTED(location.typ)) return 'kicking a rock';
    if (location.typ === THRONE) return 'kicking a throne';
    if (location.typ === FOUNTAIN) return 'kicking a fountain';
    if (location.typ === GRAVE) return 'kicking a headstone';
    if (location.typ === SINK) return 'kicking a sink';
    if (location.typ === ALTAR) return 'kicking an altar';
    if (IS_DRAWBRIDGE(location.typ)) return 'kicking a drawbridge';
    if (location.typ === STAIRS) return 'kicking the stairs';
    if (location.typ === LADDER) return 'kicking a ladder';
    if (location.typ === IRONBARS) return 'kicking an iron bar';
    return 'kicking something weird';
}

async function damageHeroFromKick(amount: number, x: number, y: number, objectName: string) {
    const killer = objectName ? `kicking ${objectName}` : kickDeathReason(x, y);
    return loseHeroHp(amount, killer, { deathCause: `killed by ${killer}` });
}

function finishHurtleMonsterDeath(monster: Monster, { noCorpse = true } = {}) {
    return finishHeroMonsterKill(
        monster, monster.mx, monster.my, {
            showKillMessage: false,
            noCorpse,
            recordConduct: false,
        },
    );
}

async function recoilFromKick(range: number) {
    const { dx, dy } = game.u;
    if (dx === undefined || dy === undefined)
        throw new Error('Kick recoil requires an attempted direction.');
    return hurtleHero(-dx, -dy, range, {
        verbose: true,
        finishTeleport: finishTeleportArrival,
        gotoLevel,
        chooseTeleportDestination: askTeleportDestination,
        finishMonsterDeath: finishHurtleMonsterDeath,
    });
}

function applyKickPassive(monster: Monster, hit: boolean) {
    return applyHeroContactPassive(monster, {
        hit,
        attackType: AT_KICK,
        weapon: game.uarmf || game.u?.uarmf || null,
    });
}

// C refs: dokick.c:maybe_kick_monster(), kick_monster(), kickdmg().
// Form-specific attacks share the command admission rules. Projection affects only the
// target noun: dokick() still targets m_at(x,y) when the actor is invisible.
async function kickLiveMonster(monster: Monster, x: number, y: number) {
    const forcefight = game.context.forcefight;
    try {
        if (!monster.mpeaceful || !canSpotMonster(monster)) game.context.forcefight = true;
        const permission = await prepareAppliedWeaponAttack(monster, null, { struckAt: { x, y } });
        if (!permission.proceed) {
            game.context.move = permission.spentTime ? 1 : 0;
            return false;
        }
        if (await checkHeroAttackOverexertion()) {
            game.context.move = 1;
            return false;
        }
    } finally {
        if (forcefight === undefined) delete game.context.forcefight;
        else game.context.forcefight = forcefight;
    }

    wakeMonstersNear(
        game.u.ux, game.u.uy, (game.u?.ulevel ?? 1) * 20,
    );
    wipeHeroEngraving(2);
    await angerAttackedMonster(monster);

    if (await levitatingKickMisses(monster)) {
        await pline('Floating in the air, you miss wildly!');
        await exerciseAttribute(A_DEX, false);
        await applyKickPassive(monster, false);
        game.context.move = 1;
        return true;
    }

    if (monster.mundetected
        || (M_AP_TYPE(monster) && M_AP_TYPE(monster) !== M_AP_MONSTER)) {
        monster.mundetected = 0;
        revealMonsterAppearance(monster);
        if (canSpotMonster(monster)) {
            newsym(x, y);
            const name = monsterName(monster, { article: 'a' });
            await plineWithContinuation(
                `There is ${name} here.`,
            );
        } else {
            map_invisible(x, y);
            await plineWithContinuation('There is something hidden here.');
        }
    }

    if (await kickWithMonsterForm(monster, x, y)) {
        game.context.move = 1;
        return true;
    }

    const target = monsterName(monster);
    const martial = heroHasMartialKick();
    const kick = await prepareKick({
        martial,
        announce: pline,
    });
    if (kick.stopped) {
        await applyKickPassive(monster, false);
        game.context.move = 1;
        return true;
    }

    await plineWithContinuation(`You kick ${target}.`);
    const evaded = await tryKickEvasion(monster, {
        clumsy: kick.clumsy,
        martial,
        announce: plineWithContinuation,
        nameMonster: actor => monsterName(actor, { capitalized: true }),
    });
    if (evaded) {
        await applyKickPassive(monster, false);
        if (monster.mx === x && monster.my === y
            && !canSpotMonster(monster)) map_invisible(x, y);
        game.context.move = 1;
        return true;
    }

    const preparedDamage = prepareKickDamage(monster, {
        clumsy: kick.clumsy,
    });
    if (preparedDamage.passesThroughShade) {
        await plineWithContinuation(
            'The kick passes harmlessly through.',
        );
        game.context.move = 1;
        return true;
    }
    revealMonsterAppearance(monster);
    await applyCaitiffPenalty(monster);
    const petReaction = await abuseKickedPet(monster, preparedDamage.potentialDamage);
    if (petReaction.heroDied) return true;
    const damage = await rollKickDamage(preparedDamage, { martial });
    if (damage.damage > 0)
        monster.mhp -= damage.damage;

    const reel = await tryKickReel(
        monster,
        x - (game.u?.ux ?? x),
        y - (game.u?.uy ?? y),
        {
            martial,
            announce: plineWithContinuation,
            nameMonster: actor => monsterName(actor, { capitalized: true }),
        },
    );

    if (reel?.heroDied) return true;
    const passive = await applyKickPassive(monster, true);
    if (passive.heroDied) {
        game.context.move = 1;
        return true;
    }
    if ((monster.mhp ?? 1) <= 0 && !reel?.dead) {
        await finishHeroMonsterKill(monster, monster.mx, monster.my, {
            hallucinating: heroIsHallucinating(game),
        });
    } else if (monster.mx === x && monster.my === y
        && !canSpotMonster(monster)) {
        map_invisible(x, y);
    }
    if (damage.trainSkill) await useHeroSkill(35);
    game.context.move = 1;
    return true;
}

async function dokick() {
    if (!await admitHeroKick()) return;
    const direction = await promptDirection();
    if (!direction || (!direction.dx && !direction.dy)) {
        resetCommandVariables(true); // dokick() returns ECMD_CANCEL.
        return;
    }
    game.u.dx = direction.dx;
    game.u.dy = direction.dy;
    const x = game.u.ux + game.u.dx;
    const y = game.u.uy + game.u.dy;
    // C dokick() records gk.kickedloc for every valid directed kick before
    // dispatching the target.  Peaceful monsters and pets consult it during
    // this same elapsed turn so they do not step into the square just kicked.
    game._kickedLoc = { x, y };
    if (!await kickCanReachTarget()) return;
    const average = game.uarmf?.otyp === KICKING_BOOTS ? 99
        : Math.trunc((currentStrength()
            + currentAttribute(A_DEX) + currentAttribute(A_CON)) / 3);
    const monster = monsterAtPosition(requireGameLevel(), x, y);
    if (monster) {
        const cell = game.level?.at(x, y);
        const oldGlyph = cell ? { ch: cell.disp_ch, color: cell.disp_color,
            decgfx: cell.disp_decgfx, attr: cell.disp_attr, metadata: glyphAt(x, y) } : null;
        const recoilRange = kickRecoilRange(monster.mnum);
        if (!await kickLiveMonster(monster, x, y)) return;
        const glyph = glyphAt(x, y);
        if (monster.dead || monster.mhp <= 0) {
            if (oldGlyph && glyph?.kind === 'invisible' && oldGlyph.metadata?.kind !== 'invisible')
                show_glyph_cell(x, y, oldGlyph.ch, oldGlyph.color, oldGlyph.decgfx, oldGlyph.attr, oldGlyph.metadata);
        } else if (!canSpotMonster(monster) && monster.mx === x && monster.my === y
            && glyph?.kind !== 'invisible' && !(game.u.uswallow && game.u.ustuck === monster))
            map_invisible(x, y);
        if (!game.program_state.gameover && kickCausesRecoil() && game.context.move)
            await recoilFromKick(recoilRange);
        return;
    }
    const location = game.level?.at(x, y);
    // dokick() wakes the broad hero-level neighborhood before it dispatches
    // the concrete terrain owner.  kick_ouch() then performs the smaller
    // impact-centered wake after its attribute exercise draws.
    wakeMonstersNear(
        game.u.ux, game.u.uy, (game.u?.ulevel ?? 1) * 20,
    );
    wipeHeroEngraving(2);
    if (!isok(x, y)) {
        await kickOuch(x, y);
        game.context.move = 1;
        return;
    }
    unmap_invisible(x, y);
    if ((isPoolAt(x, y) || location?.typ === LAVAWALL) !== !!game.u.uinwater) {
        await plineWithContinuation(`You splash some ${displayLiquidName(
            isPoolAt(x, y) ? 'water' : 'lava')} around.`);
        game.context.move = 1;
        return;
    }
    const kickedObject = game.level?.objects?.[x]?.[y]?.[0];
    const hasBoulder = game.level?.objects?.[x]?.[y]?.some(object => object.otyp === BOULDER);
    if (kickedObject && (!game.u.levitating || Is_airlevel(game.u.uz)
        || Is_waterlevel(game.u.uz) || hasBoulder)) {
        const kicked = await kickFloorObject(x, y, {
            state: game,
            dx: game.u.dx,
            dy: game.u.dy,
            publish: plineWithContinuation,
            captureFlight: captureThrownObjectFlight,
        });
        if (game.program_state.gameover) return;
        if (!kicked) await kickOuch(x, y, killerObjectName(kickedObject));
        else if (Is_airlevel(game.u.uz)) await recoilFromKick(1);
        game.context.move = 1;
        return;
    }
    if (!location || (IS_STWALL(location.typ) && !IS_TREE(location.typ))) {
        await kickOuch(x, y);
        game.context.move = 1;
        return;
    }
    if (location.typ === GRAVE) {
        if (game.u.levitating || game.u.levitation || game.levitating) {
            await kickDumb(x, y);
        } else if (rn2(4) !== 0) {
            await kickOuch(x, y);
        } else if (!location.disturbed && rn2(2) === 0) {
            await disturbGrave(x, y);
        } else {
            await exerciseAttribute(A_WIS, false);
            const alignment = game.u.ualign;
            if (!alignment) throw new Error('Breaking a grave requires hero alignment.');
            if (game.urole?.key === 'archeologist' || game.urole?.key === 'samurai'
                || (alignment.type === 1 && alignment.record > -10))
                adjustHeroAlignment(-Math.sign(alignment.type));
            location.typ = ROOM;
            location.emptygrave = 0;
            location.disturbed = 0;
            placeCreatedObject(await mksobj(ROCK, true, false), x, y);
            deleteEngravingAt(x, y);
            if (heroIsBlind(game)) await pline('Crack!  Something broke!');
            else {
                await pline('The headstone topples over and breaks!');
                newsym(x, y);
            }
        }
        game.context.move = 1;
        return;
    }
    if (location.typ === DOOR) {
        await kickDoor(x, y, average, { ouch: kickOuch, dumb: kickDumb });
        return;
    }
    if (location.typ === SDOOR) {
        if (!game.u.levitating && rn2(30) < average) {
            convertSecretDoor(location);
            const uncover = (location.doormask & (D_LOCKED | D_TRAPPED)) === D_LOCKED;
            await pline(`Crash!  ${uncover ? 'Your kick uncovers' : 'You kick open'} a secret door!`);
            await exerciseAttribute(A_DEX, true);
            if (location.doormask & D_TRAPPED) {
                location.doormask = D_NODOOR;
                if (await triggerBoobyTrap('door', { bodypart: true })) return;
            } else if (location.doormask !== D_NODOOR && !(location.doormask & D_LOCKED)) {
                location.doormask = D_ISOPEN;
            }
            feel_newsym(x, y);
            vision_reset();
            vision_recalc(0);
        } else {
            await kickOuch(x, y);
        }
        game.context.move = 1;
        return;
    }
    if (await kickNonDoorTerrain(x, y, average, { ouch: kickOuch, dumb: kickDumb })) return;
    await kickDumb(x, y);
    game.context.move = 1;
}

async function kickDumb(x: number, y: number): Promise<void> {
    // dokick.c:kick_dumb() always abuses Dexterity before deciding whether
    // an unremarkable floor kick is merely empty or strains a muscle.
    await exerciseAttribute(A_DEX, false);
    const martial = heroHasMartialKick();
    if (martial || currentAttribute(A_DEX) >= 16 || rn2(3) !== 0) {
        await pline('You kick at empty space.');
        if (heroIsBlind(game)) feel_location(x, y);
    } else {
        await pline('Dumb move!  You strain a muscle.');
        await exerciseAttribute(A_STR, false);
        await woundHeroLegs('right', 5 + rnd(5));
    }
    if (kickCausesRecoil() && rn2(2) !== 0)
        await recoilFromKick(1);
}

function putCommandLine(col: number, row: number, message: string, attr = 0) {
    const display = game.nhDisplay;
    if (!display) throw new Error('This command requires an initialized display.');
    for (let index = 0; index < message.length && col + index < display.cols; index++)
        display.setCell(col + index, row, message.charAt(index), NO_COLOR, attr);
}

function setLevelAnnotation(level: DungeonLocation, value: string | null) {
    // dungeon.c:query_annotation(): empty input and Escape preserve the
    // existing value; space-only input removes it after mungspaces().
    if (value === null || value === '') return;
    const annotation = value.replace(/\t/g, ' ').replace(/ +/g, ' ').replace(/^ | $/g, '');
    const key = `${level.dnum}:${level.dlevel}`;
    if (!game._levelAnnotations) game._levelAnnotations = new Map();
    if (annotation) game._levelAnnotations.set(key, annotation);
    else game._levelAnnotations.delete(key);
}

function annotationLevelDescription(level: DungeonLocation): string {
    if (sameDungeonLevel(level, game.u.uz)) return 'this dungeon level';
    const otherBranch = level.dnum !== game.u.uz?.dnum;
    const dungeon = game.dungeons[level.dnum];
    if (!dungeon) throw new Error(`Annotation has no dungeon ${level.dnum}`);
    if (sameDungeonLevel(level, game.knox_level)) return dungeon.dname;
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

async function queryLevelAnnotation(level: DungeonLocation | null = null, inMenu = false) {
    requirePlayingGame(game);
    const location = level ?? game.u.uz;
    const prior = game._levelAnnotations?.get(`${location.dnum}:${location.dlevel}`);
    const prompt = prior ? `Replace annotation "${prior.slice(0, 30)}${prior.length > 30 ? '...' : ''}" with?`
        : `What do you want to call ${annotationLevelDescription(location)}?`;
    const value = await getLine(
        prompt,
        () => true,
        { inMenu },
    );
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
    const x = game.u?.ux, y = game.u?.uy;
    const pile = game.level?.objects?.[x]?.[y] || [];
    const floorObject = pile[0];
    const entries: ChoiceMenuItem[] = [];
    let accelerator = 97;
    const add = (text: string) => {
        entries.push({ key: String.fromCharCode(accelerator++), text });
    };

    if (floorObject) {
        if (pile.length === 1 || isContainer(floorObject) || floorObject.oclass === 7)
            observeObjectForNaming(floorObject);
        const description = floorObjectDescription(floorObject);
        add(`Pick up ${pile.length > 1 ? 'items' : description}`);
        if ([
            LARGE_BOX, CHEST, ICE_BOX, SACK, OILSKIN_SACK, BAG_OF_HOLDING,
        ].includes(floorObject.otyp)) {
            add(`Loot ${description}`);
            add(`Tip ${description}`);
        }
        if (floorObject.oclass === 7) add(`Eat ${description}`);
    }
    if ((game.inventory || []).length) {
        add('Inventory');
        add('Drop items');
    }
    add('Rest one turn');
    add('Search around you');
    add('Look at what is here');
    if ((game.spells || []).length) add('Cast a spell');

    // create_nhwindow(NHW_MENU) retires the extended-command prompt before
    // tty paints the corner window.  Preserve that already-cleared row as
    // part of the underlay which Escape restores.
    game._pending_message = '';
    game._retained_message = '';
    game.nhDisplay?.clearRow(0);
    const underlay = snapshotMenuUnderlay();
    const key = await showChoiceWindow({
        title: 'What do you want to do?',
        entries,
    });
    restoreMenuUnderlay(underlay);
    game.nhDisplay?.setCursor((game.u?.ux ?? 1) - 1,
        (game.u?.uy ?? 0) + 1);
    // cmd.c:here_cmd_menu() queues selected actions for a later dispatch.
    // This accepted boundary dismisses with Escape before that action graph.
    game.context.move = key === 0 || key === 27 ? 0 : 1;
}

async function doname() {
    // docallcmd() consumes a canned category before creating its menu.
    // Unread callback prose then belongs to the later naming prompt.
    const queuedChoice = takeCommandKey();
    const choice = queuedChoice === undefined ? await chooseNamingCategory()
        : String.fromCharCode(queuedChoice);
    if (queuedChoice === undefined) await restoreCommandMap();

    // C refs: do_name.c:docallcmd()/do_oname() and
    // dungeon.c:donamelevel()/query_annotation().  The menu owns only the
    // category choice; level annotations live with mapseen, while an
    // individual object's name must stay on that same object identity.
    if (choice === 'm') {
        await nameChosenMonster();
    } else if (choice === 'f') {
        await nameFloorObject();
    } else if (choice === 'd') {
        await renameDiscoveredType();
    } else if (choice === 'a') {
        await queryLevelAnnotation();
        game._pending_message = '';
        await restoreCommandMap();
    } else if (choice === 'i') {
        // C do_name.c:name_ok() marks unseen, artifact and novel objects as
        // GETOBJ_DOWNPLAY.  getobj() omits those letters from the suggested
        // prompt while still accepting a directly typed inventory letter.
        const object = await chooseInventoryObject('name', candidate =>
            candidate.oclass === 12 ? GETOBJ_EXCLUDE
                : candidate.dknown === false || candidate.oartifact || candidate.otyp === SPE_NOVEL
                    ? GETOBJ_DOWNPLAY : GETOBJ_SUGGEST, { forcePrompt: true });
        if (object) {
            await nameIndividualObject(object);
            await flush_screen(1);
        }
    } else if (choice === 'o') {
        const object = await chooseInventoryObject('call', candidate =>
            !objectTypeIsCallable(candidate) ? GETOBJ_EXCLUDE
                : !candidate.dknown || objectTypeKnown(candidate) && !game._objectCallNames?.[candidate.otyp]
                    ? GETOBJ_DOWNPLAY : GETOBJ_SUGGEST);
        if (object) {
            observeObjectForNaming(object);
            if (!object.dknown) {
                await pline('You would never recognize another one.');
            } else {
                await callObjectType(object);
            }
            await flush_screen(1);
        }
    }
    game.context.move = 0;
}

async function getAdjacentLocation(prompt: string, errorMessage: string | null, x: number, y: number) {
    // C cmd.c:get_adjacent_loc() delegates input and command assistance to
    // getdir(), then turns its relative result into a checked map location.
    const direction = await promptDirection(() => readDirectionKey(`${prompt} `));
    if (!direction) {
        await pline('Never mind.');
        game.context.move = 0;
        return null;
    }
    const { dx, dy, dz } = direction;
    const target = { x: x + dx, y: y + dy, dx, dy, dz };
    if (target.x < 1 || target.x >= COLNO
        || target.y < 0 || target.y >= ROWNO) {
        if (errorMessage) await pline(errorMessage);
        game.context.move = 0;
        return null;
    }
    return target;
}

async function dotwoweapon() {
    const spentTime = await toggleTwoWeaponCombat();
    if (!game.program_state.gameover) game.context.move = spentTime ? 1 : 0;
}

// C iactions.c:itemactions_pushkeys(). The menu closes before the queued
// command runs; its object letter answers the later inventory prompt.
function inventoryActionCommand({ key, item }: InventoryAction): NativeCommand | null {
    const handlers: Record<InventoryAction['key'], string | null> = {
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

async function executeInventoryAction({ key, item }: InventoryAction): Promise<void> {
    try {
        await runInventoryAction({ key, item });
    } finally {
        // These keys belong to this item's prompts. Native rhack discards
        // them if the command fails before it asks for the selected item.
        clearCommandKeys();
    }
}

async function runInventoryAction({ key, item }: InventoryAction): Promise<void> {
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
        } else if (item === game.uswapwep) {
            resetBulkTakeoff();
            const twoweap = game.u.twoweap;
            await setSecondaryWeapon(null, game);
            await plineWithContinuation(twoweap ? 'You are no longer wielding two weapons at once.'
                : 'You no longer have a second weapon readied.');
            game.context.move = 1;
        } else if (item === game.uquiver) {
            queueCommandKeys('-');
            await doready();
        }
        return;
    case 'a':
        queueCommandKeys(letter);
        if (item.oclass === 8 && !(item.otyp === POT_OIL && objectTypeKnown(item))) await dipInto();
        else await doapply();
        return;
    case 'c': queueCommandKeys(`i${letter}`); await doname(); return;
    case 'C': queueCommandKeys(`o${letter}`); await doname(); return;
    case 'd': queueCommandKeys(letter); await dodrop(); return;
    case 'e':
        queueCommandKeys(letter);
        game.iflags.menu_requested = true;
        await doeat();
        return;
    case 'E': queueCommandKeys(letter); await doengrave(); return;
    case 'f': await dofire(); return;
    case 'i': queueCommandKeys(letter); await doadjust(); return;
    case 'I': queueCommandKeys(letter); await adjustSplit(); return;
    case 'O': queueCommandKeys(letter); await dosacrifice(); return;
    case 'p': queueCommandKeys(letter); await dopay(); return;
    case 'P': case 'W': queueCommandKeys(letter); await dowear(); return;
    case 'q':
        queueCommandKeys(letter);
        game.iflags.menu_requested = true;
        await doquaff();
        return;
    case 'Q': queueCommandKeys(letter); await doready(); return;
    case 'r': queueCommandKeys(letter); await readCommand(); return;
    case 'R':
        queueCommandKeys(letter);
        if ((item.owornmask ?? 0) & W_ACCESSORY) await removeWornItem('take off', true);
        else await dorub();
        return;
    case 'T':
        queueCommandKeys(letter);
        if ((item.owornmask ?? 0) & W_ARMOR) await removeWornItem('take off', true);
        else {
            game.iflags.menu_requested = true;
            await tipCommand();
        }
        return;
    case 't': await dothrow(item); return;
    case 'w': queueCommandKeys(letter); await dowield(); return;
    case 'V': queueCommandKeys(letter); await doinvoke(); return;
    case 'x': await doswapweapon(); return;
    case 'X': await dotwoweapon(); return;
    case 'z': queueCommandKeys(letter); await dozap(); return;
    case '/': queueCommandKeys(`i${letter}`); await dowhatis(); return;
    case '\x1b': case ' ': case '\n': case '\r':
        game.context.move = 0;
        return;
    }
}

// C ref: wield.c:doswapweapon()/ready_weapon().  Clearing the old secondary
// slot through setworn() also ends two-weapon mode before either new
// inventory description is projected.
async function doswapweapon() {
    game.multi = 0;
    if (heroHasNoHands(game) || heroIsVerySmall(game)) {
        await pline("Don't be ridiculous!");
        game.context.move = 0;
        return;
    }
    if (await refuseWeldedPrimary()) {
        game.context.move = 0;
        return;
    }
    const oldPrimary = game.uwep || game.u?.uwep || null;
    const oldSecondary = game.uswapwep || game.u?.uswapwep || null;
    await setSecondaryWeapon(null, game);
    const spentTime = await readyHeroWeapon(oldSecondary);
    if (game.uwep === oldPrimary) {
        await setSecondaryWeapon(oldSecondary, game);
    } else if (oldPrimary) {
        await setSecondaryWeapon(oldPrimary, game);
        observeObjectForNaming(oldPrimary);
        await plineWithContinuation(
            `${oldPrimary.invlet} - ${
                inventoryItemDescription(oldPrimary)}.`,
        );
    } else {
        await plineWithContinuation('You have no secondary weapon readied.');
    }
    game.context.move = spentTime ? 1 : 0;
}

async function dochat() {
    const species = heroSpecies(game);
    let refusal: string | null = null;
    if (MONSTER_SOUND[species] === 0)
        refusal = `As ${withIndefiniteArticle(monsterTypeName(species, !!game.flags.female))}, you cannot speak.`;
    else if (propertyIsActive('strangled', game)) refusal = "You can't speak.  You're choking!";
    else if (game.u.uswallow) refusal = "They won't hear you out there.";
    else if (game.u.uinwater) refusal = 'Your speech is unintelligible underwater.';
    if (refusal) {
        await plineWithContinuation(refusal);
        game.context.move = 0;
        return;
    }
    if (await quoteShopGoods()) {
        game.context.move = 1;
        return;
    }
    const direction = await promptDirection(() => readDirectionKey('Talk to whom? (in what direction) '));
    if (!direction) {
        resetCommandVariables(true); // sounds.c:dochat() returns ECMD_CANCEL.
        return;
    }
    const steed = game.u.usteed;
    if (steed && direction.dz > 0) {
        if (steed.msleeping || !steed.mcanmove) {
            await plineWithContinuation(`${monsterName(steed, { capitalized: true })} seems not to notice you.`);
            game.context.move = 1;
        } else {
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
    if (!isok(x, y)) return;
    const monster = game.level ? monsterAtPosition(game.level, x, y) : null;
    if (!monster || monster.mundetected) {
        const topObject = game.level?.objects[x]?.[y]?.[0];
        const loc = game.level?.at(x, y);
        if (topObject?.otyp === STATUE) {
            if (!heroIsBlind(game))
                await plineWithContinuation(`The ${heroIsHallucinating(game) ? randomDisplayMonsterName() : 'statue'} seems not to notice you.`);
        } else if (!heroIsDeaf(game) && loc && (IS_WALL(loc.typ) || loc.typ === SDOOR)
            && (!heroIsBlind(game) || IS_WALL(loc.lastseentyp))) {
            if (!heroIsHallucinating(game)) {
                await plineWithContinuation("It's like talking to a wall.");
            } else {
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
        if (!canSpotMonster(monster)) map_invisible(monster.mx, monster.my);
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

async function wizWish() {
    const verbose = game.flags.verbose;
    game.flags.verbose = false;
    try {
        await makeWish();
    } finally {
        if (verbose === undefined) delete game.flags.verbose;
        else game.flags.verbose = verbose;
    }
    await reportHeroEncumbrance();
}

// C refs: cmd.c Ctrl-G/wizgenesis, wizcmds.c wiz_genesis(), and read.c
// create_particular().  The debug command remains zero-time.
// C wiz_polyself(): allow a chosen form without consuming a game turn.
async function wizPolyself() {
    await polymorphHero(POLY_CONTROLLED);
    game.context.move = 0;
}

async function wizGenesis() {
    await createParticularMonster();
    game.context.move = 0;
}

async function wizDetect() {
    await findit();
    game.context.move = 0;
}

async function wizKill() {
    requirePlayingGame(game);
    const level = requireGameLevel();
    const here = { ...game.u.uz };
    let cursor: Position = { x: game.u.ux, y: game.u.uy };
    let prompt = 'Pick first monster to slay';
    for (;;) {
        await plineWithContinuation(`${prompt}:`);
        prompt = 'Next monster';
        const verbose = game.flags.verbose;
        const autodescribe = game.iflags.autodescribe;
        game.flags.verbose = false;
        game.iflags.autodescribe = true;
        let target;
        try {
            const tipShown = await showGetposTip();
            target = await selectMapPosition({
                start: cursor, prompt: tipShown ? 'Move cursor to a monster:' : game._pending_message,
                goal: 'a monster', describe: farlookLocationDescription,
            });
        } finally {
            if (verbose === undefined) delete game.flags.verbose;
            else game.flags.verbose = verbose;
            if (autodescribe === undefined) delete game.iflags.autodescribe;
            else game.iflags.autodescribe = autodescribe;
        }
        if (!target) break;
        cursor = target;
        const monster = await wizardKillTarget(cursor);
        if (monster === 'quit') break;
        unmap_invisible(cursor.x, cursor.y);
        if (!monster) {
            await pline('There is no monster there.');
            break;
        }
        const tame = !!monster.mtame;
        const seen = canSpotMonster(monster) || !!game.u.uswallow && monster === game.u.ustuck;
        const name = monsterName(monster, {
            article: tame ? 'your' : seen ? 'the' : 'a',
            ...(tame ? { adjective: seen ? 'poor' : 'poor, unseen' }
                : seen ? {} : { adjective: 'unseen' }),
            suppressIt: true, suppressHallucination: true,
            suppressSaddle: tame && !!MGIVENNAME(monster),
        });
        const destroyed = monsterIsNonliving(monster.mnum);
        if (game.iflags.menu_requested) {
            game.context.mon_moving = true;
            try {
                await plineWithContinuation(`${name.charAt(0).toUpperCase()}${name.slice(1)} is ${destroyed ? 'destroyed' : 'killed'}.`);
                await finishMonsterKilled(monster, game, { damageType: AD_PHYS, cause: null });
            } finally {
                game.context.mon_moving = false;
            }
        } else {
            await plineWithContinuation(`You ${destroyed ? 'destroy' : 'kill'} ${name}!`);
            await finishHeroMonsterKill(monster, monster.mx, monster.my, { showKillMessage: false });
        }
        if (game.program_state.gameover || game.u.utotype
            || game.u.uz.dnum !== here.dnum || game.u.uz.dlevel !== here.dlevel) break;
    }
    level.monsters = level.monsters.filter(monster => !monster.dead);
    game.context.move = 0;
}

async function wizardKillTarget(cursor: Position): Promise<Monster | 'quit' | null> {
    if (cursor.x === game.u.ux && cursor.y === game.u.uy) {
        const steed = game.u.usteed;
        if (steed) {
            const answer = await promptYesNoQuit(`Kill ${monsterName(steed)}?`);
            if (answer === 'q') return 'quit';
            if (answer === 'y') return steed;
        }
        const question = game.urole?.key === 'samurai' ? 'Perform seppuku?' : 'Commit suicide?';
        if (await paranoidQuery(true, question))
            await finishHeroDeath({
                killer: `${game.flags.female ? 'her' : 'his'} own player`,
                killerFormat: KILLED_BY, deathType: DIED, deathLineShown: true,
            });
        return 'quit';
    }
    if (game.u.uswallow)
        return Math.abs(cursor.x - game.u.ux) <= 1 && Math.abs(cursor.y - game.u.uy) <= 1
            ? game.u.ustuck ?? null : null;
    return requireGameLevel().monsters.find(monster => monsterHasMapPosition(monster, game)
        && (monster.mx === cursor.x && monster.my === cursor.y
            || monster.wormSegments?.some(segment => segment.x === cursor.x && segment.y === cursor.y))
        && !monster.dead && monster.mhp > 0) ?? null;
}

// C wizcmds.c:wiz_telekinesis(). The command keeps the cursor on a hurtled
// actor and takes no time. rhack's reset_cmd_vars() clears hurtle's delay.
async function wizTelekinesis(): Promise<void> {
    requirePlayingGame(game);
    let cursor: Position = { x: game.u.ux, y: game.u.uy };
    await plineWithContinuation('Pick a monster to hurtle.');
    do {
        const tipShown = await showGetposTip();
        if (game.flags.verbose) {
            const helpKey = game.commandBindings.specialKey('getpos.help') ?? 63;
            await plineWithContinuation(`(For instructions type a '${visibleCommandKey(helpKey)}')`);
        }
        if (tipShown) await plineWithContinuation('Move cursor to a monster:');
        const target = await selectMapPosition({
            start: cursor, goal: 'a monster', describe: farlookLocationDescription,
            prompt: game._pending_message,
        });
        if (!target) break;
        cursor = target;
        const monster = monsterAtPosition(game.level, cursor.x, cursor.y);
        const atHero = cursor.x === game.u.ux && cursor.y === game.u.uy;
        if (!(monster && canSpotMonster(monster)) && !atHero) continue;
        const direction = await promptDirection(() => readDirectionKey('which direction? '));
        if (!direction) break;
        if (monster) {
            await hurtleMonster(monster, direction.dx, direction.dy, 6, {
                finishMonsterDeath: finishHurtleMonsterDeath,
                // minliquid() credits drowning and lava burning to the hero;
                // rust and fatal damage to a fire-resistant monster use mondied().
                finishLiquidDeath: (target, death) =>
                    death.cause === 'drowning' || death.cause === 'lava-burning'
                        ? finishHeroMonsterKillOutcome(target, target.mx, target.my, { showKillMessage: false })
                        : finishMonsterLiquidDeath(target, death),
            });
            if (!monster.dead && monster.mhp > 0 && canSpotMonster(monster))
                cursor = { x: monster.mx, y: monster.my };
        } else {
            await hurtleHero(direction.dx, direction.dy, 6, {
                finishTeleport: finishTeleportArrival,
                gotoLevel, chooseTeleportDestination: askTeleportDestination,
                finishMonsterDeath: finishHurtleMonsterDeath,
            });
            cursor = { x: game.u.ux, y: game.u.uy };
        }
        if (game.program_state.gameover) break;
    } while (!game.u.utotype);
    if (game._helplessReason === 'moving through the air') game._helplessTurns = 0;
    game.context.move = 0;
}

function menuLetter(index: number) {
    return index < 26
        ? String.fromCharCode('a'.charCodeAt(0) + index)
        : String.fromCharCode('A'.charCodeAt(0) + index - 26);
}

function dungeonHeading(dnum: number) {
    const dungeon = game.dungeons[dnum];
    if (!dungeon) throw new RangeError(`Unknown dungeon ${dnum}`);
    const first = dungeonDepth(dnum, 1);
    const last = dungeonDepth(dnum, dungeon.num_dunlevs);
    const incoming = game.branches?.find(branch => branch.end2.dnum === dnum);
    const unplaced = !!incoming
        && (incoming.end1.dnum < 0
            || incoming.end1.dnum >= (game.dungeons?.length || 0));
    const descriptor = unplaced ? 'depth' : 'level';
    if (dungeon.num_dunlevs === 1)
        return `${dungeon.dname}: ${descriptor} ${first}`;
    let text = `${dungeon.dname}: ${descriptor}s ${first} to ${last}`;
    if (dungeon.entry_lev !== 1) {
        text += dungeon.entry_lev === dungeon.num_dunlevs
            ? ', entrance from below'
            : `, entrance on ${dungeonDepth(dnum, dungeon.entry_lev)}`;
    }
    return text;
}

function branchKind(branch: DungeonBranch) {
    if (branch.type) return branch.type;
    if (branch.portal) return 'portal';
    const child = game.dungeons?.[branch.end2.dnum];
    if (child?.dname === 'Gehennom') return 'no_end1';
    if (child?.dname === 'The Elemental Planes') return 'no_end2';
    return 'stair';
}

function branchMenuLabel(branch: DungeonBranch) {
    const child = game.dungeons?.[branch.end2.dnum];
    if (!child) return null;
    return `${branchTypeDescription(branch)} to ${child.dname}: ${dungeonDepth(
        branch.end1.dnum, branch.end1.dlevel,
    )}`;
}

function branchTypeDescription(branch: DungeonBranch) {
    return {
        portal: 'Portal',
        no_end1: 'Connection',
        no_end2: 'One way stair',
        stair: 'Stair',
    }[branchKind(branch)];
}

function dungeonLayoutEvents(dnum: number): DungeonLayoutEvent[] {
    const events: DungeonLayoutEvent[] = [];
    for (const [name, level] of game.specialLevels || []) {
        if (level.dnum !== dnum) continue;
        events.push({ kind: 'special', name, ...level });
    }
    for (const branch of game.branches || []) {
        if (branch.end1.dnum !== dnum) continue;
        events.push({
            kind: 'branch', dlevel: branch.end1.dlevel,
            dnum, branch,
        });
    }
    events.sort((a, b) => a.dlevel - b.dlevel
        || Number(a.kind === 'special') - Number(b.kind === 'special'));
    return events;
}

// C ref: dungeon.c unplaced_floater().  Fort Ludios is unavailable only
// while its incoming branch still uses the synthetic n_dgns source end.
// Once mk_knox_portal() resolves that end to a real main-dungeon level, the
// named `knox` special level is selectable like every other wizard target.
function specialLevelReachable(event: SpecialLayoutEvent) {
    if (event.name === 'dummy') return false;
    if (event.name !== 'knox') return true;
    const incoming = (game.branches || []).find(branch =>
        branch.end2?.dnum === event.dnum
        && branch.end2?.dlevel === event.dlevel);
    const sourceDnum = incoming?.end1?.dnum;
    return sourceDnum !== undefined && Number.isInteger(sourceDnum)
        && sourceDnum >= 0
        && sourceDnum < (game.dungeons?.length || 0);
}

// C ref: teleport.c level_tele().  Wizard-menu entry into the Elemental
// Planes grants the real Amulet before deferred_goto() starts.  Object
// construction, inventory identity, and prinv() precede getbones()/mklev().
// Destination placement finishes before tty asks for acknowledgement.
async function endgamePrerequisite(destination: DungeonLocation) {
    if (!In_endgame(destination) || In_endgame(game.u?.uz)
        || game.u?.uhave?.amulet) return;
    const amulet = await addInventoryItem(
        await mksobj(AMULET_OF_YENDOR, true, false),
    );
    // teleport.c prints the grant with prinv(); its doname()->xname() path
    // observes the visible object and appends it to the Amulet disco[] class
    // before the destination transaction begins.
    recordObjectEncounter(amulet.otyp);
    if (!game.u.uhave) game.u.uhave = {};
    game.u.uhave.amulet = 1;
    const message = `Endgame prerequisite: ${
        amulet.invlet
    } - the Amulet of Yendor.`;
    await pline(message);
}

// C ref: dungeon.c print_dungeon(TRUE). Build one source-ordered menu stream;
// the tty layer alone owns pagination and nested input capture.
function wizardLevelMenu() {
    const rows: TextMenuEntry[] = [];
    const choices = new Map<string, WizardLevelDestination>();
    let choiceIndex = 0;

    for (let dnum = 0; dnum < (game.dungeons?.length || 0); dnum++) {
        if (In_endgame(game.u.uz) && dnum !== game.astral_level?.dnum) continue;
        rows.push({ text: dungeonHeading(dnum), attr: ATR_INVERSE });

        for (const event of dungeonLayoutEvents(dnum)) {
            const key = menuLetter(choiceIndex++);
            const current = game.u?.uz?.dnum === event.dnum
                && game.u?.uz?.dlevel === event.dlevel;
            let label;
            let destination: WizardLevelDestination;
            let reachable = true;
            if (event.kind === 'branch') {
                label = branchMenuLabel(event.branch);
                destination = { dnum: event.dnum, dlevel: event.dlevel };
            } else {
                label = `${specialDisplayName(event.name)}: ${dungeonDepth(
                    event.dnum, event.dlevel,
                )}`;
                if (event.name === 'castle')
                    label += ` (tune ${game.castleTune || ''})`;
                destination = {
                    dnum: event.dnum, dlevel: event.dlevel,
                    // dungeon.c:fixup_level_locations() retains the canonical
                    // x-* placement identity but resolves the Lua prototype
                    // through the selected role's file code.
                    prototype: specialDisplayName(event.name),
                };
                reachable = specialLevelReachable(event);
            }
            if (reachable) {
                rows.push(`${key} - ${current ? '*' : ' '} ${label}`);
                choices.set(key, destination);
            } else {
                rows.push(`      ${label}`);
            }
        }
    }
    return { rows, choices };
}

function wizardWhereLines(): string[] {
    const lines: string[] = [];
    for (let dnum = 0; dnum < (game.dungeons?.length || 0); dnum++) {
        lines.push(dungeonHeading(dnum));
        for (const event of dungeonLayoutEvents(dnum)) {
            let label;
            if (event.kind === 'branch') {
                label = branchMenuLabel(event.branch);
            } else {
                label = `${specialDisplayName(event.name)}: ${dungeonDepth(
                    event.dnum, event.dlevel,
                )}`;
                if (event.name === 'castle')
                    label += ` (tune ${game.castleTune || ''})`;
            }
            const current = event.kind === 'special'
                && game.u.uz?.dnum === event.dnum && game.u.uz.dlevel === event.dlevel;
            if (label) lines.push(`${current ? '*' : ' '} ${label}`);
        }
    }
    const floating = game.branches.filter(branch => branch.end1.dnum === game.dungeons.length);
    if (floating.length) {
        lines.push('', 'Floating branches');
        for (const branch of floating) {
            const child = game.dungeons[branch.end2.dnum];
            if (!child) throw new Error(`Floating branch has no dungeon ${branch.end2.dnum}`);
            lines.push(`   ${branchTypeDescription(branch)} to ${child.dname}`);
        }
    }
    const hero = game.u;
    if (Invocation_lev(hero.uz)) {
        const position = game.level?.invocationPosition ?? { x: 0, y: 0 };
        lines.push('', `Invocation position @ (${position.x},${position.y}), hero @ (${hero.ux},${hero.uy})`);
    } else {
        const portal = game.level?.traps.find(trap => trap.ttyp === MAGIC_PORTAL);
        if (portal) lines.push('', `Portal @ (${portal.tx},${portal.ty}), hero @ (${hero.ux},${hero.uy})`);
        else if (wizardLevelExpectsPortal()) lines.push('', 'No portal found.');
    }
    return lines;
}

function wizardLevelExpectsPortal(): boolean {
    const here = game.u.uz;
    return Is_earthlevel(here) || Is_airlevel(here) || Is_firelevel(here)
        || Is_waterlevel(here) || Is_knox_level(here)
        || !!here && (here.dnum === game.quest_dnum && here.dlevel === 1
            || game.branches.some(branch => branch.end2.dnum === game.quest_dnum
                && branch.end1.dnum === here.dnum && branch.end1.dlevel === here.dlevel));
}

// C refs: wizcmds.c:wiz_where() and dungeon.c:print_dungeon(FALSE).
// This is the complete live graph, unlike #overview's visited-level history
// and unlike #levelteleport's selectable menu projection.
async function wizWhere() {
    game._pending_message = '';
    game._retained_message = '';
    await showDisclosureOverlay(wizardWhereLines(), { restoreUnderlay: true });
    await docrt();
    game.context.move = 0;
}

// C dungeon.c:print_dungeon(TRUE), with the endgame entry prerequisite.
export async function chooseWizardLevelDestination() {
    const { rows, choices } = wizardLevelMenu();
    const destination = await showPagedPickOneMenu({
        rows, choices, prompt: 'Level teleport to where:',
    });
    if (!destination) return null;
    await endgamePrerequisite(destination);
    return { destination };
}

async function wizLevelTeleport({ menuRequested = !!game.iflags.menu_requested } = {}) {
    game.context.move = 0;
    await levelTeleport({ menuRequested });
}

async function wizLevelChange() {
    const hero = game.u;
    requireInitializedHero(hero);
    const value = await getLine('To what experience level do you want to be set?');
    const input = value?.trim();
    if (!input || !/^[+-]?\d+$/.test(input)) {
        await pline('Never mind.');
        game.context.move = 0;
        return;
    }
    let target = Number(input);
    game._pending_message = '';
    game._retained_message = '';
    if (target === hero.ulevel) {
        await plineWithContinuation('You are already that experienced.');
    } else if (target < hero.ulevel) {
        if (hero.ulevel === 1) {
            await plineWithContinuation('You are already as inexperienced as you can get.');
            game.context.move = 0;
            return;
        }
        target = Math.max(1, target);
        while (hero.ulevel > target) {
            if (await loseHeroExperience('#levelchange')) return;
        }
    } else {
        if (hero.ulevel >= 30) {
            await plineWithContinuation('You are already as experienced as you can get.');
            game.context.move = 0;
            return;
        }
        target = Math.min(30, target);
        while (hero.ulevel < target) {
            await gainExperienceLevel();
        }
    }
    hero.ulevelmax = hero.ulevel;
    game.context.move = 0;
}

async function doloot() {
    await lootCommand({ unlockContainer: lootLockedContainer, chooseDirection: getAdjacentLocation });
}

async function lootLockedContainer(container: GameObject): Promise<void> {
    if (!container.olocked) return;
    const name = definiteName(objectCombatName(container, { includeCorpseSpecies: false }));
    await pline(container.lknown ? `${name.charAt(0).toUpperCase()}${name.slice(1)} is locked.` : `Hmmm, ${name} turns out to be locked.`);
    container.lknown = true;
    const flags = autoUnlockFlags(game);
    const tool = flags & AUTOUNLOCK_APPLY_KEY ? autokey(true) : null;
    if (tool || flags & AUTOUNLOCK_UNTRAP)
        game.context.move = Number(await pickLock(tool, { target: { x: game.u.ux, y: game.u.uy }, container }));
    else game.context.move = 0;
}

const EXTENDED_COMMAND_HANDLERS = new Map<string, () => Promise<unknown>>([
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
    ['loot', doloot],
    ['tip', tipCommand],
    ['force', doforce],
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
    ['adjust', doadjust],
    ['altadjust', adjustSplit],
    ['levelchange', wizLevelChange],
    ['wizwhere', wizWhere],
    ['wizwish', wizWish],
    ['wizcast', dowizcast],
    ['wizgenesis', wizGenesis],
    ['wizdetect', wizDetect],
    ['wizsmell', () => wizSmell(farlookLocationDescription)],
    ['wizbury', wizBury],
    ['wiztelekinesis', wizTelekinesis],
    ['migratemons', wizMigrateMonsters],
    ['wizkill', wizKill],
    ['wizidentify', wizIdentify],
    ['wizintrinsic', wizIntrinsic],
    ['wizmap', wizMap],
]);

// C refs: artifact.c:doinvoke(), invoke_ok(), arti_invoke().  getobj()
// suggests artifacts and other unique objects; an artifact with inv_prop 0
// still consumes a turn after retouching, but its only effect is the ordinary
// "Nothing happens." line.
async function doinvoke() {
    const object = await chooseInventoryObject('invoke', candidate =>
        candidate.oartifact || OBJECT_UNIQUE[candidate.otyp] || candidate.otyp === CRYSTAL_BALL
            || candidate.otyp === FAKE_AMULET_OF_YENDOR && !candidate.known
            ? GETOBJ_SUGGEST : GETOBJ_EXCLUDE, { forcePrompt: true });
    if (!object) {
        game.context.move = 0;
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
        if (object.otyp === CRYSTAL_BALL) await useCrystalBall(object);
        else await pline('Nothing happens.');
        game.context.move = 1;
        return;
    }

    const invocation = await invokeArtifactPower(object, artifact, {
        enterTrap: moveIntoFailedUntrap,
    });
    if ('heroDied' in invocation && invocation.heroDied) return;
    if (invocation.used) {
        game.context.move = 'spentTime' in invocation && invocation.spentTime === false ? 0 : 1;
        return;
    }
    await pline('Nothing happens.');
    game.context.move = 1;
}

function rubEligibleObject(object: GameObject | null | undefined) {
    return object?.otyp === OIL_LAMP || object?.otyp === MAGIC_LAMP
        || object?.otyp === BRASS_LANTERN || isGrayStone(object) || isRoyalJelly(object);
}

async function rubRoyalJelly(jelly: GameObject) {
    const eggs = (game.inventory || []).filter(object => object.otyp === EGG);
    const used = await useRoyalJelly(jelly, async () => {
        if (!eggs.length) {
            game._pending_message = '';
            await pline(
                "You don't have anything to rub the royal jelly on.",
            );
            return null;
        }
        const letters = compactInventoryLetters(
            eggs.map(egg => egg.invlet).join(''),
        );
        const selection = await promptInventoryObject(
            `What do you want to rub the royal jelly on? [${letters} or ?*] `,
            eggs,
            { verb: 'rub the royal jelly on', allowMenu: true },
        );
        if (!selection.cancelled) game._pending_message = '';
        return selection.object;
    });
    game.context.move = used ? 1 : 0;
}

async function djinniFromLamp(object: GameObject) {
    const djinni = await makemonNear(
        PM_DJINNI, game.u.ux, game.u.uy, MM_NOMSG,
    );
    if (!djinni) {
        await plineWithContinuation('It turns out to be empty.');
        return;
    }
    newsym(djinni.mx, djinni.my);

    if (!game.blind) {
        await plineWithContinuation(
            'In a cloud of smoke, a djinni emerges!',
        );
        await plineWithContinuation('The djinni speaks.');
    } else {
        await plineWithContinuation('You smell acrid fumes.');
        await plineWithContinuation('Something speaks.');
    }

    let chance = rn2(5);
    if (object.blessed)
        chance = chance === 4 ? rnd(4) : 0;
    else if (object.cursed)
        chance = chance === 0 ? rn2(4) : 4;

    switch (chance) {
    case 0: {
        await plineWithContinuation(
            '"I am in your debt.  I will grant one wish!"',
        );
        await grantMonsterWish(djinni);
        break;
    }
    case 1:
        await plineWithContinuation('"Thank you for freeing me!"');
        await tameMonster(djinni);
        break;
    case 2:
        await plineWithContinuation('"You freed me!"');
        djinni.mpeaceful = 1;
        setMonsterMalign(djinni);
        break;
    case 3:
        await plineWithContinuation('"It is about time!"');
        if (canSpotMonster(djinni))
            await plineWithContinuation('The djinni vanishes.');
        await removeWishGrantingMonster(djinni);
        break;
    default:
        await plineWithContinuation('"You disturbed me, fool!"');
        djinni.mpeaceful = 0;
        djinni.mtame = 0;
        djinni.pet = false;
        setMonsterMalign(djinni);
        break;
    }
}

// C refs: apply.c:dorub(), invent.c:getobj(), wield.c:wield_tool(), and
// cmd.c:CQ_CANNED.  Selecting an unwielded lamp does not rub it immediately:
// wield_tool() installs it, consumes one action, and queues dorub plus the
// inventory letter for the next hero command boundary.
async function dorub(cannedInvlet: string | null = null) {
    if (heroHasNoHands(game)) {
        await pline("You aren't able to rub anything without hands.");
        game.context.move = 0;
        return;
    }
    const object = cannedInvlet === null
        ? await chooseInventoryObject('rub', candidate =>
            rubEligibleObject(candidate) ? GETOBJ_SUGGEST : GETOBJ_EXCLUDE)
        : game.inventory.find(candidate => candidate.invlet === cannedInvlet
            && rubEligibleObject(candidate));
    if (!object) {
        game.context.move = 0;
        return;
    }
    // Interactive entry owns a getobj prompt which selection replaces.
    // Canned re-entry happens before the next physical key and inherits the
    // wield/scheduler topline, so its result must append to that message.
    if (cannedInvlet === null) game._pending_message = '';
    if (isGrayStone(object)) {
        const result = await useGrayStone(object);
        game.context.move = result.spentTime ? 1 : 0;
        return;
    }
    if (isRoyalJelly(object)) {
        await rubRoyalJelly(object);
        return;
    }
    const wielded = await wieldTool(
        object,
        'rub',
        { swapWeapons: doswapweapon },
        game,
    );
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
            transformMagicLampToOilLamp(
                object, 1000 + rn2(500), game, game.moves ?? 0,
            );
            await djinniFromLamp(object);
            if (!game._knownObjectTypes?.has(MAGIC_LAMP)) {
                await exerciseAttribute(A_WIS, true);
                recordObjectKnowledge(MAGIC_LAMP);
            }
            game.context.move = 1;
            return;
        }
        await plineWithContinuation(rn2(2)
            ? 'You see a puff of smoke.'
            : 'Nothing happens.');
    } else if (object.otyp === BRASS_LANTERN) {
        await plineWithContinuation(
            'Rubbing the electric lamp is not particularly rewarding.',
        );
        await plineWithContinuation('Anyway, nothing exciting happens.');
    } else {
        await plineWithContinuation('Nothing happens.');
    }
    game.context.move = 1;
}

async function moveIntoFailedUntrap(trap: Trap) {
    const u = game.u;
    const newx = trap.tx;
    const newy = trap.ty;
    const dx = newx - u.ux;
    const dy = newy - u.uy;
    const loc = game.level?.at?.(newx, newy);
    if (!loc || blocksMove(newx, newy)
        || (dx && dy && blocksDiagonalDoor(
            game.level?.at?.(u.ux, u.uy), loc,
        ))) return { entered: false, died: false };

    const ballChainMove = await beginBallAndChainMove(newx, newy);
    if (ballChainMove?.blocked)
        return { entered: false, died: !!game.program_state.gameover };

    const oldx = u.ux;
    const oldy = u.uy;
    u.ux0 = oldx;
    u.uy0 = oldy;
    u.ux = newx;
    u.uy = newy;
    if (u.usteed) {
        u.usteed.mx = newx;
        u.usteed.my = newy;
    }
    trap.tseen = false;
    await finishMovedHero({
        oldx,
        oldy,
        newx,
        newy,
        loc,
        explicitAttempt: true,
        ballChainMove,
        trapOptions: { failedUntrap: true },
    });
    if (game.program_state.gameover) return { entered: true, died: true };
    const remainingTrap = game.level?.traps?.find(candidate =>
        candidate.tx === u.ux && candidate.ty === u.uy);
    if (remainingTrap) remainingTrap.tseen = true;
    await exerciseAttribute(A_WIS, false);
    return { entered: true, died: false };
}

// C refs: wizcmds.c:wiz_map() and detect.c:do_mapping().  This is a
// zero-time debug reveal: it maps traps and engravings first, then maps every
// background square from all directions while preserving secret doors and
// revealing secret corridors.
async function wizMap() {
    if (!game.flags?.debug) {
        await pline('Unavailable command.');
        game.context.move = 0;
        return;
    }

    const savedConfusion = game.u?.confusionTurns ?? 0;
    const savedHallucination = game.u?.hallucinationTurns ?? 0;
    game.u.confusionTurns = 0;
    game.u.hallucinationTurns = 0;
    try {
        for (const trap of requireGameLevel().traps) {
            trap.tseen = true;
            map_trap(trap, true);
        }
        for (const engraving of requireGameLevel().engravings ?? [])
            map_engraving(engraving, true);
        await mapMagicLevel({ confused: false });
    } finally {
        game.u.confusionTurns = savedConfusion;
        game.u.hallucinationTurns = savedHallucination;
    }
    game._pending_message = '';
    game._retained_message = '';
    game.nhDisplay?.clearRow(0);
    game.nhDisplay?.setCursor(game.u.ux - 1, game.u.uy + 1);
    game.context.move = 0;
    await bot();
}

// C ref: cmd.c:domonability().
async function useSteedBreathAbility(steed: Monster) {
    requirePlayingGame(game);
    const result = await performPetRangedAttack(steed, game, { forced: true });
    if (result.heroDied || game.program_state.gameover) return;
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
        if ('heroDied' in result && result.heroDied) return;
        game.context.move = result.spentTime ? 1 : 0;
        return;
    }
    const spit = heroSpitAttack(game);
    if (spit) {
        const result = await useHeroSpit({ state: game, attack: spit });
        if ('heroDied' in result && result.heroDied) return;
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
async function adjustSplit(): Promise<void> {
    game.context.move = 0;
    const object = await chooseInventoryObject('split', candidate =>
        candidate.oclass === 12 ? GETOBJ_EXCLUDE : GETOBJ_SUGGEST);
    if (!object || object.quan < 2 || object.oclass === 12) return;
    const amount = object.quan === 2 ? 1 : await readInventorySplitCount();
    if (amount === null) {
        await pline('Never mind.');
        return;
    }
    if (amount < 1 || amount >= object.quan) {
        await pline(`Amount to split from current stack must be ${amount < 1
            ? 'at least 1' : `less than ${object.quan}`}.`);
        return;
    }
    const split = splitObjectStack(object, amount, game);
    if (!split) throw new Error('An admitted inventory stack could not be split');
    await doadjust(split, object);
}

// C cmd.c:get_count(GC_ECHOFIRST): digits extend the count and either erase
// key removes its last digit. A non-digit accepts only space or return.
async function readInventorySplitCount(): Promise<number | null> {
    await flushPendingTopline();
    let key = await promptKey('Split off how many?', 1);
    if (key < 48 || key > 57) return null;
    let count = key - 48;
    let showZero = key === 48;
    for (;;) {
        clearMessageWindow();
        key = await promptKey(`Count: ${count > 0 || showZero ? count : ''}`);
        if (key >= 48 && key <= 57) {
            count = Math.min(Number.MAX_SAFE_INTEGER, count * 10 + key - 48);
            showZero = key === 48;
        } else if (key === 8 || key === 127) {
            count = Math.trunc(count / 10);
            showZero = false;
        } else {
            clearMessageWindow();
            return key === 32 || key === 10 || key === 13 ? count : null;
        }
    }
}

// C ref: invent.c:doorganize()/doorganize_core().
async function doadjust(selected: GameObject | null = null, splitting: GameObject | null = null) {
    const inventory = (game.inventory || [])
        .filter((object: GameObject): object is GameObject & { invlet: string } =>
                typeof object.invlet === 'string' && object.invlet.length > 0)
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
    if (!selected && game.flags.fixinv === false) reassignInventoryLetters();
    const repairGold = !selected && await checkInventoryGold('adjust');
    let object = selected || await chooseInventoryObject('adjust', candidate =>
        candidate.oclass === 12 && !repairGold ? GETOBJ_EXCLUDE : GETOBJ_SUGGEST,
        { forcePrompt: true, allowCount: true });
    if (!object) {
        game.context.move = 0;
        return;
    }
    if (!splitting) {
        const previous = game.inventory[game.inventory.indexOf(object) - 1];
        if (previous && previous.invlet === object.invlet) splitting = previous;
    }
    const source = object.invlet;
    if (!source) throw new Error('Adjusting inventory requires a lettered object.');
    // C doorganize_core() chooses '$' itself when repairing gold. A purse
    // already in '$' collects other stacks; one elsewhere merges into '$'.
    if (object.oclass === 12) {
        const collect = object.invlet === '$';
        let purse = object;
        let action = collect ? 'Collecting' : 'Moving';
        for (const candidate of inventory) {
            if (candidate === purse || candidate === object) continue;
            if (!collect && candidate.invlet !== '$') continue;
            const candidateName = candidate.oextra?.oname ?? candidate.oname;
            const purseName = purse.oextra?.oname ?? purse.oname;
            const merged = (!candidateName || candidateName === purseName)
                ? await mergeObjectStacks(candidate, purse) : null;
            if (merged) {
                purse = merged;
                if (collect) continue;
                action = 'Merging';
            } else if (!collect) {
                candidate.invlet = source;
                action = 'Swapping';
            }
            if (!collect) break;
        }
        purse.invlet = '$';
        game.inventory.sort((a, b) => inventoryLetterRank(a) - inventoryLetterRank(b));
        if (game.flags.fixinv === false) reassignInventoryLetters();
        observeObjectForNaming(purse);
        await pline(`${action}: $ - ${inventoryItemDescription(purse)}.`);
        game.context.move = 0;
        return;
    }
    const adjusting = object;
    const occupied = new Set(
        inventory.filter(candidate => candidate !== adjusting && !mergable(candidate, adjusting))
            .map(candidate => candidate.invlet),
    );
    const slots = game.flags.fixinv === false
        ? game.inventory.filter(item => item.oclass !== 12).length + (splitting ? 0 : 1) : 52;
    const recommended = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.slice(0, slots)
        .split('')
        .filter(letter => letter === adjusting.invlet || !occupied.has(letter))
        .join('') + (occupied.has('#') ? '#' : '');
    const destinationPrompt = `${splitting ? `Split ${object.quan}` : 'Adjust letter'} to what [${
        compactInventoryLetters(recommended)}] (? see used letters)?`;
    // The source item's queued letter bypasses getobj's prompt, but the
    // destination uses tty_yn_function(), which acknowledges unread prose.
    await flushPendingTopline();
    let destination = '';
    for (let attempt = 1; ; attempt++) {
        let key = await promptKey(destinationPrompt, 1);
        if (key === 63 || key === 42) {
            key = await selectUsedInventoryLetter(splitting ? source : null);
            if (!key) continue;
        }
        destination = String.fromCharCode(key);
        if ([27, 32, 10, 13].includes(key) || splitting && destination === source) {
            if (splitting) await rejoinObjectStack(splitting, object, game);
            clearMessageWindow();
            await pline('Never mind.');
            game.context.move = 0;
            return;
        }
        if (destination === '$') {
            if (splitting) await rejoinObjectStack(splitting, object, game);
            clearMessageWindow();
            await pline("Only gold coins may be moved into the '$' slot.");
            game.context.move = 0;
            return;
        }
        if (/^[a-zA-Z]$/.test(destination) || destination === '#' && occupied.has('#')) break;
        if (attempt === 5) {
            if (splitting) await rejoinObjectStack(splitting, object, game);
            clearMessageWindow();
            await pline('Never mind.');
            game.context.move = 0;
            return;
        }
        await plineWithContinuation('Select an inventory slot letter.');
        await flushPendingTopline();
    }

    let action = splitting ? 'Splitting:' : destination === source ? 'Collecting:' : 'Moving:';
    let bumped: GameObject | null = null;
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
        if (candidate.invlet !== destination) continue;
        const merged = permitsName ? await mergeObjectStacks(candidate, object) : null;
        if (merged) {
            object = merged;
            unlinkObject(object, game);
            action = 'Merging:';
        } else if (!splitting) {
            candidate.invlet = source;
            action = 'Swapping:';
        } else {
            // A split takes the destination's name when otherwise compatible.
            if (name && !object.oartifact) {
                if (object.oextra) delete object.oextra.oname;
                delete object.oname;
            }
            const splitMerge = await mergeObjectStacks(candidate, object);
            if (splitMerge) {
                object = splitMerge;
                unlinkObject(object, game);
                action = 'Splitting and merging:';
            } else {
                if (name) {
                    if (object.oextra) object.oextra.oname = name;
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
    game.inventory.sort((a, b) =>
        inventoryLetterRank(a) - inventoryLetterRank(b));
    if (game.flags.fixinv === false) reassignInventoryLetters();
    game._pending_message = '';
    observeObjectForNaming(object);
    await pline(
        `${action} ${object.invlet} - ${
            inventoryItemDescription(object, {
                primaryHandDetail: inventoryPrimaryHandDetail(object),
            })}.`,
    );
    if (bumped) await plineWithContinuation(`Moving: ${bumped.invlet} - ${inventoryItemDescription(bumped)}.`);
    game.context.move = 0;
}

// C ref: pray.c:doturn().
async function doturn() {
    const role = game.urole?.key;
    if (role !== 'priest' && role !== 'knight') {
        const spell = (game.spells || []).find(known =>
            known.name === 'turn undead');
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

async function dipFountain(object: DipTarget, loc: MapLocation) {
    if (propertyIsActive('levitation')) {
        await floatingAbove('fountain');
        return;
    }
    if (object !== 'hands' && await dipFountainSword(object, loc)) return;
    const result = object === 'hands' || object === game.uarmg ? await washHands()
        : await waterDamageObject(object, [], game, { force: true, publish: plineWithContinuation });
    if (result === 'destroyed' || result !== 'nothing' && rn2(2) === 0) {
        return;
    }

    const fate = rnd(30);
    let eventMessage = '';
    if (fate >= 16 && fate <= 20) {
        if (fate === 16) {
            if (object !== 'hands' && object.oclass !== 12 && !object.cursed)
                await curseObject(object);
        } else if (object !== 'hands' && object.cursed) {
            if (!heroIsBlind())
                await plineWithContinuation(`The ${displayLiquidName('water')} glows for a moment.`);
            const oldRadius = objectLightRadius(object);
            uncurseObjectState(object);
            await adjustObjectLightAfterBlessing(object, oldRadius);
        } else {
            await plineWithContinuation('A feeling of loss comes over you.');
        }
        if (!game.program_state.gameover)
            await dryFountainAt(game.u.ux, game.u.uy);
        return;
    }
    const sensationEffect = resolveDippedSensationFate({
        fate,
        armName: () => heroArmName(game),
    });
    const currentDungeon = game.dungeons?.[game.u?.uz?.dnum ?? 0];
    const coinEffect = await applyDippedCoinFate({
        fate,
        loc,
        dungeonLevels: currentDungeon?.num_dunlevs
            ?? game.u?.uz?.dlevel ?? 1,
        dungeonLevel: game.u?.uz?.dlevel ?? 1,
        blind: heroIsBlind(),
        random: rnd,
        createGold: async (quantity: number) => {
            await mkgold(quantity, game.u.ux, game.u.uy);
        },
        liquidName: () => displayLiquidName('water'),
        exerciseWisdom,
        repaint: () => newsym(game.u.ux, game.u.uy),
    });
    if (sensationEffect.handled) {
        eventMessage = sensationEffect.message;
    } else if (coinEffect.handled) {
        eventMessage = coinEffect.message;
    } else if (fate === 21) {
        await summonFountainDemon();
    } else if (fate === 22) {
        await summonFountainNymph();
    } else if (fate === 23) {
        await summonFountainSnakes();
    } else if (fate === 24) {
        if ((loc.looted ?? 0) & F_LOOTED)
            await gushForthFromFountain();
        else
            await discoverFountainGem(loc);
    } else if (fate === 25) {
        await gushForthFromFountain();
    } else if (fate === 28) {
        await plineWithContinuation('An urge to take a bath overwhelms you.');

        const wallet = heroGoldAmount(game);
        if (wallet > 10) {
            const loss = Math.trunc(someGold(wallet) / 10);
            game._statusGoldOverride = wallet;
            setHeroGoldAmount(game, wallet - loss);
            await plineWithContinuation('You lost some of your gold in the fountain!');
            loc.looted = (loc.looted ?? 0) & ~F_LOOTED;
            await exerciseAttribute(A_WIS, false);
        }

        await dryFountainAt(game.u.ux, game.u.uy);
        return;
    } else if ((fate < 16 || fate === 30) && result === 'nothing') {
        eventMessage = 'Nothing seems to happen.';
    }
    if (game.program_state.gameover) return;
    if (eventMessage) await plineWithContinuation(eventMessage);
    await dryFountainAt(game.u.ux, game.u.uy);
}

async function dodip() {
    await dip({ fountain: dipFountain });
}

function visitedDungeonLevels() {
    const byDungeon = new Map<number, Set<number>>();
    const remember = (dnum: number | undefined, dlevel: number | undefined) => {
        if (dnum === undefined || dlevel === undefined
            || !Number.isInteger(dnum) || !Number.isInteger(dlevel)) return;
        const levels = byDungeon.get(dnum) ?? new Set<number>();
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

function overviewDepth(dnum: number, dlevel: number): number {
    return dnum === game.quest_dnum || dnum === game.knox_level?.dnum
        ? dlevel : dungeonDepth(dnum, dlevel);
}

function dungeonOverviewHeading(dnum: number) {
    const dungeon = game.dungeons?.[dnum];
    if (!dungeon) throw new Error(`Overview has no dungeon ${dnum}`);
    const reached = dungeon.dunlev_ureached;
    if (reached === dungeon.entry_lev || In_endgame({ dnum, dlevel: 1 }))
        return `${dungeon?.dname || 'Dungeon'}:`;
    const range = dungeonBuildsUp({ dnum, dlevel: 1 })
        ? `levels ${overviewDepth(dnum, dungeon.entry_lev)} up to ${overviewDepth(dnum, reached)}`
        : `levels ${overviewDepth(dnum, 1)} to ${overviewDepth(dnum, reached)}`;
    return `${dungeon?.dname || 'Dungeon'}: ${range}`;
}

function overviewLevelIsInteresting(dnum: number, dlevel: number) {
    const location = { dnum, dlevel };
    if (sameDungeonLevel(location, game.u.uz)) return true;
    const annotation = game._levelAnnotations?.get?.(`${dnum}:${dlevel}`);
    const record = game._overviewRecords?.get?.(`${dnum}:${dlevel}`);
    const flags = record?.flags;
    if (flags?.notreachable || flags?.forgot) return false;
    const tutorial = game.specialLevels?.get('tut-1')?.dnum;
    if (tutorial !== undefined && game.u.uz?.dnum === tutorial) return dnum === tutorial;
    if (tutorial !== undefined && dnum === tutorial) return false;
    if (flags && (flags.oracle || flags.bigroom || flags.roguelevel || flags.castle
        || flags.valley || flags.msanctum || flags.vibrating_square
        || flags.quest_summons || flags.questing)) return true;
    if (dnum === game.sokoban_dnum
        && (game.u.uz?.dnum === game.sokoban_dnum || !flags?.sokosolved)) return true;
    if (In_endgame(game.u.uz)) return In_endgame(location);
    return !!annotation || !!record?.branch || !!overviewFeatureLine(record?.features)
        || dlevel === game.dungeons[dnum]?.dunlev_ureached;
}

function overviewCountPhrase(count: number, noun: string) {
    if (count === 1)
        return `${/^[aeiou]/i.test(noun) ? 'an' : 'a'} ${noun}`;
    if (count === 2) return `some ${noun}s`;
    return `many ${noun}s`;
}

function overviewFeatureLine(features: OverviewRecord['features'] | undefined) {
    const phrases = [];
    if (features?.nshop) {
        if (features.nshop === 1) {
            const shop = SHOP_TYPES[
                (features.shoptype ?? SHOPBASE) - SHOPBASE
            ];
            const type = features.shoptype < SHOPBASE ? 'untended shop'
                : shop?.annotation || shop?.name || 'shop?';
            phrases.push(withIndefiniteArticle(type));
        } else {
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
    ] as const) {
        const count = features?.[countKey] ?? 0;
        if (count) phrases.push(overviewCountPhrase(count, noun));
    }
    if (!phrases.length) return null;
    const text = phrases.join(', ');
    return `      ${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}

function overviewAutomaticNote(dnum: number, dlevel: number, record: OverviewRecord | undefined): string | null {
    const flags = record?.flags;
    const here = { dnum, dlevel };
    if (flags?.oracle) return 'Oracle of Delphi.';
    if (dnum === game.sokoban_dnum) return flags?.sokosolved ? 'Solved.' : 'Unsolved.';
    if (flags?.bigroom) return 'A very big room.';
    if (flags?.roguelevel) return 'A primitive area.';
    if (sameDungeonLevel(here, game.specialLevels?.get('x-strt'))) {
        if (game.u.uevent?.qcompleted) return `Completed quest for ${questLeaderName()}.`;
        if (flags?.questing) return `Given quest by ${questLeaderName()}.`;
        return `Home${flags?.notreachable ? ' (no way back...)' : ''}.`;
    }
    if (flags?.ludios) return 'Fort Ludios.';
    if (flags?.castle) {
        const knowledge = game.u.uevent?.uheard_tune;
        const tune = knowledge === 2 ? `notes "${game.castleTune || ''}"` : '5-note tune';
        return `The castle${flags.castletune && knowledge
            ? ` (play ${tune} to open or close drawbridge)` : ''}.`;
    }
    if (flags?.valley) return 'Valley of the Dead.';
    if (flags?.vibrating_square) return "Gateway to Moloch's Sanctum.";
    if (flags?.msanctum) return "Moloch's Sanctum.";
    return null;
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
    const window = tty_create_nhwindow<DungeonLocation>(NHW_MENU);
    const addLine = (text: string, location: DungeonLocation | null = null) =>
        tty_add_menu(window, { text, identifier: location });
    try {
        await tty_start_menu(window);
        const visited = [...visitedDungeonLevels().entries()]
            .sort(([left], [right]) => left - right);
        for (const [dnum, levelSet] of visited) {
            if (In_endgame(game.u.uz) && !In_endgame({ dnum, dlevel: 1 })) continue;
            const levels = [...levelSet].sort((a, b) => a - b)
                .filter(dlevel => annotate || overviewLevelIsInteresting(dnum, dlevel));
            if (!levels.length || !game.dungeons?.[dnum]) continue;
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
                addLine(`${annotate ? '' : '   '}${title}:${special}${suffix}${
                    current ? ' <- You are here.' : ''
                }`, annotate ? { dnum, dlevel } : null);
                if (record?.flags.forgot) continue;
                const featureLine = overviewFeatureLine(record?.features);
                if (featureLine) addLine(featureLine);
                const automaticNote = overviewAutomaticNote(dnum, dlevel, record);
                if (automaticNote) addLine(`      ${automaticNote}`);
                if (record?.flags.quest_summons) addLine(`      Summoned by ${questLeaderName()}.`);
                if (record?.branch) {
                    const branch = record.branch;
                    const target = game.dungeons?.[record.branch.dnum]?.dname
                        || 'another dungeon';
                    const direction = branch.up ? 'up' : 'down';
                    const description = branch.type === 'portal'
                        ? branch.dnum === game.quest_dnum && game.u.uevent?.qexpelled ? 'Sealed portal' : 'Portal'
                        : branch.type === 'no_end1' ? 'Connection'
                        : branch.type === 'no_end2' ? `One way stairs ${direction}` : `Stairs ${direction}`;
                    const targetLevel = branch.up && !In_endgame(branch)
                        ? `, level ${dungeonDepth(branch.dnum, branch.dlevel)}` : '';
                    addLine(`      ${description} to ${target}${targetLevel}.`);
                }
            }
        }
        tty_end_menu(window);
        const selection = await tty_select_menu(window, annotate ? PICK_ONE : PICK_NONE);
        const target = selection.selections[0]?.identifier;
        if (target) await queryLevelAnnotation(target, true);
    } finally {
        await tty_destroy_nhwindow(window);
    }
    game._pending_message = '';
    game.context.move = 0;
}

// C ref: insight.c:do_gamelog()/show_gamelog(ENL_GAMEINPROGRESS).  Chronicle
// is a projection of events recorded by their owning mechanics; it does not
// infer history from the command transcript or current aggregate counters.
async function doChronicle() {
    const events = gameLogEvents(game);
    if (!events.length) {
        await pline('No chronicled events.');
        game.context.move = 0;
        return;
    }
    const stream = [
        'Logged events:',
        ' Turn',
        ...events.map(event => `${String(event.turn).padStart(5)}: ${event.text}`),
    ];
    const pageSize = 23;
    const pages: TextPage[] = [];
    for (let offset = 0; offset < stream.length; offset += pageSize) {
        const lines = Array<string>(24).fill('');
        const chunk = stream.slice(offset, offset + pageSize);
        for (const [row, line] of chunk.entries()) lines[row] = line;
        lines[23] = '--More--';
        pages.push({ lines, cursor: [8, 23] });
    }
    await showTextPages(pages, { validKeys: [27, 32, 10, 13] });
    game._pending_message = '';
    game.context.move = 0;
}

async function doVanquished() {
    if (!hasRecordedMonsterDeaths()) {
        await pline('No creatures have been vanquished.');
    } else {
        await showDisclosureOverlay(vanquishedLines(), {
            restoreUnderlay: true,
        });
    }
    game._pending_message = '';
    game.context.move = 0;
}

async function doGenocided() {
    await listGenocided(game.iflags.menu_requested ? 'a' : 'y');
    game.context.move = 0;
}

interface QuiverCommandResult {
    item: GameObject | null;
    spentTime: boolean;
    cancelled: boolean;
}

function inventoryCommandLetter(item: GameObject): string {
    if (item.invlet === null || item.invlet === undefined)
        throw new TypeError(`Carried object ${item.o_id} has no inventory letter`);
    return item.invlet;
}

function wizardIdentifyDescription(item: GameObject, primaryHandDetail: string | null): string {
    const override = game.iflags.override_ID;
    game.iflags.override_ID = true;
    try {
        return inventoryItemDescription(item, { primaryHandDetail });
    } finally {
        if (override === undefined) delete game.iflags.override_ID;
        else game.iflags.override_ID = override;
    }
}

// C wizcmds.c:wiz_identify() delegates to display_inventory() with
// iflags.override_ID set.  Fully identified inventories still open a short
// PICK_NONE menu; the command does not collapse into a topline message.
async function wizIdentify(): Promise<void> {
    if (!game.inventory.length) {
        await pline('Not carrying anything.');
        game.context.move = 0;
        return;
    }
    const unidentified = game.inventory.filter(objectNeedsFullIdentification);
    if (!unidentified.length) {
        await showTextMenuOverlay([
            'Debug Identify',
            '(all items are permanently identified already)',
        ]);
        game._pending_message = '';
        game.context.move = 0;
        return;
    }

    const sections = pickupClassOrder().map(heading => ({
        heading,
        items: unidentified
            .filter(item => pickupObjectClass(item) === heading)
            .sort((a, b) => inventoryCommandLetter(a).localeCompare(inventoryCommandLetter(b)))
            .map(item => {
                observeObjectForNaming(item);
                return {
                    key: inventoryCommandLetter(item),
                    text: wizardIdentifyDescription(item, inventoryPrimaryHandDetail(item)),
                    value: item,
                };
            }),
    })).filter(section => section.items.length);
    const allKey = game.commandBindings.keyForCommand('wizidentify') || 9;
    const window = tty_create_nhwindow<GameObject | 'all'>(NHW_MENU);
    let selected: (GameObject | 'all')[];
    try {
        await tty_start_menu(window);
        tty_add_menu(window, {
            identifier: null,
            text: `Debug Identify -- unidentified or partially identified item${
                unidentified.length === 1 ? '' : 's'}`,
        });
        tty_add_menu(window, {
            identifier: 'all', selector: '_', group: String.fromCharCode(allKey),
            itemflags: MENU_ITEMFLAGS_SKIPINVERT,
            text: `select ${unidentified.length === 1
                ? 'it' : 'any or all of them'} to permanently identify${
                unidentified.length === 1 ? '' : ` (${visibleCommandKey(allKey)} for all)`}`,
        });
        for (const section of sections) {
            addMenuHeading(window, section.heading);
            for (const item of section.items)
                tty_add_menu(window, {
                    identifier: item.value, selector: item.key,
                    group: OBJECT_CLASS_SYMBOLS[item.value.oclass] ?? '', text: item.text,
                });
        }
        tty_end_menu(window);
        const result = await tty_select_menu(window, PICK_ANY);
        selected = result.selections.map(selection => selection.identifier);
    } finally {
        await tty_destroy_nhwindow(window);
    }
    game._pending_message = '';
    if (selected.includes('all')) {
        await identifyPack(0);
        game.context.move = 0;
        return;
    }
    for (const item of selected) {
        if (item === 'all') continue;
        const learnedType = !objectTypeKnown(item);
        fullyIdentifyObject(item);
        if (learnedType) await exerciseAttribute(A_WIS, true);
        observeObjectForNaming(item);
        await plineWithContinuation(
            `${item.invlet} - ${inventoryItemDescription(item, {
                primaryHandDetail: inventoryPrimaryHandDetail(item),
            })}.`,
        );
    }
    game.context.move = 0;
}

interface ExtendedCommandInput {
    selected: NativeCommand | null;
    lastExecuted: NativeCommand | null;
}

// C cmd.c:doextcmd() runs the list inside its editor loop and retains the
// last executed command separately from the next editor selection.
async function readExtendedCommand(): Promise<ExtendedCommandInput> {
    let lastExecuted: NativeCommand | null = null;
    for (;;) {
        const statusDisabled = game._statusUpdatesDisabled;
        game._statusUpdatesDisabled = true;
        let selected: NativeCommand | null;
        try {
            selected = game.flags.extmenu ? await extendedCommandMenu() : await editExtendedCommand();
        } finally {
            if (statusDisabled === undefined) delete game._statusUpdatesDisabled;
            else game._statusUpdatesDisabled = statusDisabled;
        }
        if (selected?.handler !== 'doextlist') return { selected, lastExecuted };
        if (!await commandAllowed(selected)) return { selected: null, lastExecuted };
        await showExtendedCommandList();
        lastExecuted = selected;
    }
}

// TTY's extended-command line editor redraws the prompt at every input
// boundary. Completion expands visually while typed input advances the cursor.
async function editExtendedCommand(): Promise<NativeCommand | null> {
    let command = '';
    let completion: string | null = null;
    const initiator = visibleCommandKey(game.commandBindings.keyForCommand('#'));
    game._pending_message = initiator;
    await flush_screen(1);
    game.nhDisplay?.setCursor(initiator.length + 1, 0);

    const redrawCommand = async () => {
        const displayedCommand = completion || command;
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

    for (;;) {
        const key = await nhgetch();
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
            game.nhDisplay?.clearRow(0);
            game.context.move = 0;
            return null;
        }
        if (key === 10 || key === 13) break;
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
        if (key < 32 || key === 127 || command.length >= COLNO) continue;
        command += ch;
        completion = completeExtendedCommand(command);
        await redrawCommand();
    }

    // tty_getlin() clears its message window on return. The completed
    // editor is not an unread message for a later cls() to acknowledge.
    game._pending_message = '';
    game._retained_message = '';
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
    if (!selected) await pline(`${initiator}${normalizedCommand.slice(0, 60)}: unknown extended command.`);
    return selected ?? null;
}

async function wizardPositionDescription(x: number, y: number): Promise<string> {
    if (x === game.u?.ux && y === game.u?.uy) {
        const species = game.u.umonnum;
        const polymorphName = heroIsPolymorphed(game) && species !== undefined
            ? monsterTypeName(species, !!game.u.mfemale) : '';
        const race = game.urace?.adj || game.urace?.name || 'human';
        const role = game.urole?.name;
        const roleName = game.flags.female && role?.f ? role.f : role?.m;
        const form = polymorphName
            || `${race} ${(roleName || 'adventurer').toLowerCase()}`;
        const punishment = heroIsPunished()
            ? ', chained to a heavy iron ball' : '';
        const blind = heroIsBlind(game);
        const telepathy = unblindTelepathyRange() >= 0;
        const detection = heroDetectsMonsters(game);
        const invisible = propertyIsActive('invisible', game);
        // self_lookat() includes invisibility while blind only when sensed.
        const prefix = invisible && (!blind || telepathy || detection)
            ? 'invisible ' : '';
        const description = `${prefix}${form} called ${game.plname || 'player'}${await selfLookDetails()}${punishment}${selfTrapDescription()}`;
        const unseen = invisible && !game.u.seeInvisible
            && (game.u.seeInvisibleTurns ?? 0) === 0;
        // lookat() treats touch while blind or swallowed as normal vision.
        if (blind || game.u.uswallow || !(unseen || game.u.uundetected))
            return description;
        const senses = [
            game.u.infravision ? 'infravision' : '',
            telepathy ? 'telepathy' : '',
            detection ? 'monster detection' : '',
        ].filter(sense => sense.length > 0);
        return senses.length > 0
            ? `${description} [seen: ${senses.join(', ')}]` : description;
    }
    const loc = game.level?.at(x, y);
    if (!loc) return 'unexplored area';
    const glyph = glyphAt(x, y);
    if (glyph?.kind === 'warning' || glyph?.kind === 'nothing' || glyph?.kind === 'monster')
        return farlookLocationDescription(x, y);
    if (loc.typ === TREE && loc.remembered_glyph) return 'tree';
    if (!loc.remembered_glyph && !cansee(x, y)) return 'unexplored area';
    // C pager.c:do_screen_description() describes the displayed glyph, not
    // the terrain below it.  A visible (or still remembered) pile therefore
    // owns farlook before the room/corridor fallback.
    return await farlookLocationDescription(x, y) || 'unexplored area';
}

function roomAtPosition(x: number, y: number): Room | null {
    const roomno = game.level?.at(x, y)?.roomno ?? 0;
    if (roomno >= ROOMOFFSET)
        return roomForRoomno(game.level, roomno);
    // Special-level flips move the room rectangle with its entities; older
    // map cells may not yet carry the derived roomno projection.
    return game.level?.rooms?.find((room): room is Room => isRoom(room)
        && x >= room.lx && x <= room.hx
        && y >= room.ly && y <= room.hy) || null;
}

// C teleport.c:control_mon_tele() and the shared getpos() input prelude.
export async function askMonsterTeleportDestination(
    monster: Monster, start: Position,
): Promise<Position | null> {
    await plineWithContinuation(`Teleport ${monsterName(monster, {
        article: 'your', suppressIt: true,
    })} @ <${monster.mx},${monster.my}> where?`);
    const goal = `where to teleport ${monsterName(monster, {
        article: 'your', suppressIt: true,
    })}`;
    const firstUse = shouldShowGetposTip();
    if (firstUse) await showGetposTip();
    if (game.flags.verbose)
        await plineWithContinuation("(For instructions type a '?')");
    if (firstUse) await plineWithContinuation(`Move cursor to ${goal}:`);
    const destination = await selectMapPosition({
        start, prompt: game._pending_message, goal,
        describe: wizardPositionDescription,
    });
    game._pending_message = '';
    return destination;
}

export async function askTeleportDestination({ onPrompt = null }: {
    onPrompt?: (() => void | Promise<void>) | null;
} = {}): Promise<Position | null> {
    const subject = game.u.usteed
        ? `you and ${monsterName(game.u.usteed)}` : 'you';
    await plineWithContinuation(`Where do ${subject} want to be teleported?`);
    await onPrompt?.();
    const firstUse = shouldShowGetposTip();
    if (firstUse) await showGetposTip();
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
        describe: wizardPositionDescription,
    });
    game._pending_message = '';
    return destination;
}

// C refs: cmd.c dotelecmd(), teleport.c dotele()/teleds(), getpos.c getpos(),
// and priest.c intemple(). A successful position teleport returns
// ECMD_TIME.  Its first getpos use still owns the shared Lua tutorial, while
// the destination room separately owns entry effects after relocation.
async function teleportAtWillCommand(ignoreRestrictions: boolean): Promise<void> {
    const result = await teleportHeroAtWill({
        ignoreRestrictions, chooseDestination: askTeleportDestination,
    });
    game.context.move = Number(result.spentTime);
}

function travelLocationDescription(x: number, y: number): string {
    if (x === game.level?.dnstair?.x && y === game.level?.dnstair?.y) {
        return onQuestStart(game) && !okToQuest(game)
            ? 'blocked staircase down' : 'staircase down';
    }
    if (x === game.level?.upstair?.x && y === game.level?.upstair?.y)
        return 'staircase up';
    return '';
}

async function travelPositionDescription(x: number, y: number): Promise<string> {
    const description = await wizardPositionDescription(x, y);
    if (x === game.u?.ux && y === game.u?.uy) return description;
    const loc = game.level?.at?.(x, y);
    // hack.c:is_valid_travelpt() rejects unexplored stone before searching.
    const unexploredProjection = description === 'unexplored area'
        && !loc?.seenv;
    const valid = !unexploredProjection && isValidTravelTarget(x, y);
    return valid ? description : `${description} (no travel path)`;
}

// C pager.c:lookat() gives the sensed hero priority over the map glyph.
// Terrain-only inspection deliberately omits that self description.
function farlookDescribesHero(x: number, y: number): boolean {
    return x === game.u.ux && y === game.u.uy && canSpotHeroSelf()
        && (!game.iflags.terrainmode || !!(game.iflags.terrainmode & TER_MON));
}

export async function farlookLocationDescription(x: number, y: number): Promise<string> {
    if (farlookDescribesHero(x, y)) return wizardPositionDescription(x, y);
    if (game.u.uswallow && game.u.ustuck)
        return `interior of ${monsterName(game.u.ustuck)}`;
    const glyph = lookGlyphAt(x, y);
    if (!glyph || glyph.kind === 'unexplored') {
        if ((game.u.uinwater || game.underwater) && !Is_waterlevel(game.u.uz))
            return dist2(x, y, game.u.ux, game.u.uy) <= 2 ? 'land' : 'unknown';
        return 'unexplored area';
    }
    if (glyph?.kind === 'warning') {
        const index = glyph.glyph === undefined ? -1 : glyph.glyph - GlyphOffset.warning;
        const warning = def_warnsyms[index];
        if (!warning) throw new RangeError(`Unknown warning glyph ${glyph.glyph}`);
        return warning.desc;
    }
    if (glyph?.kind === 'nothing' || glyph?.kind === 'terrain'
        && glyph.terrainName === 'dark part of a room') return 'dark part of a room';
    const monster = game.level ? monsterAtPosition(game.level, x, y) : null;
    if (monster && glyph?.kind === 'monster') {
        return lookAtMonster(monster, x, y);
    }
    if (glyph.kind === 'object') return objectAtMapDescription(x, y, glyph);
    // Hallucinated statues project monster glyphs without a live monster.
    if (glyph?.kind === 'monster' && heroIsHallucinating(game))
        return randomDisplayMonsterName();

    const description = mapFeatureDescription(x, y, glyph);
    if (description === 'ice') return iceDescriptionAt(x, y);
    if (description === 'staircase down' && onQuestStart(game) && !okToQuest(game))
        return 'blocked staircase down';
    return description;
}

// C apply.c:dojump(): the physical command shares the spell's jump owner.
async function dojump(): Promise<void> {
    const result = await jumpHero(0);
    game.context.move = result.spentTime ? 1 : 0;
}

// C refs: cmd.c dotravel(), getpos.c getpos(), hack.c handle_tip(), and
// dat/nhcore.lua show_getpos_tip().  The tty message window and the Lua text
// window own distinct input boundaries; after the tutorial, getpos retains
// its cursor and accepts terrain-symbol cycling before one of the pick keys.
async function dotravel(): Promise<void> {
    game.iflags.getloc_travelmode = true;
    const firstUse = !game.iflags.menu_requested && shouldShowGetposTip();
    if (firstUse) {
        await pline('Where do you want to travel to?');
        await showGetposTip();
    }

    // getpos_menu() omits auto_describe()'s travel-path warning.
    const cursor = game.iflags.menu_requested
        ? await selectTravelMenuPosition(wizardPositionDescription)
        : await selectMapPosition({
        start: game._travelTarget
            ? { ...game._travelTarget } : { x: game.u.ux, y: game.u.uy },
        prompt: firstUse
            ? "(For instructions type a '?')  Move cursor to the desired destination:"
            : game.flags?.verbose
                ? "Where do you want to travel to?  (For instructions type a '?')"
                : 'Where do you want to travel to?',
        goal: 'the desired destination',
        describe: travelPositionDescription,
    });
    if (!cursor) {
        game.iflags.getloc_travelmode = false;
        // dotravel() returns ECMD_OK for menu dismissal, ECMD_CANCEL for ESC
        // in getpos(). Only the latter discards both command queues.
        if (game.iflags.menu_requested) game.context.move = 0;
        else resetCommandVariables(true);
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
async function dotravelTarget(): Promise<void> {
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
    const direction = findTravelDirection(state);
    if (!direction) {
        stopRun();
        // cmd.c:dotravel_target() returns ECMD_TIME after invoking domove(),
        // even when pathfinding cannot produce a step.
        game.context.move = 1;
        return;
    }
    const finalStep = game.u.ux + direction.dx === state.targetX
        && game.u.uy + direction.dy === state.targetY;
    if (finalStep) game._travelTarget = null;
    const moved = await domove(direction.dx, direction.dy);
    if (game.program_state.gameover) return;
    if (moved) await captureRunmodeDelay(game, !!game._runState);
    game.context.travel1 = false;
    // The target-selection command itself is time-consuming.  A blocked
    // first step stops travel but still reaches the monster/global turn.
    game.context.move = 1;
    if (game.u.ux === state.targetX && game.u.uy === state.targetY)
        game._travelTarget = null;
    if (!moved || (game.u.ux === state.targetX && game.u.uy === state.targetY))
        stopRun();
}

// C refs: pager.c:dowhatis(), getpos.c:getpos(), pager.c:do_screen_description().
// Farlook spends no game time. Ordinary look retains its cursor between
// selections; quick look returns after describing one selection.
async function doFarlook(quick = true): Promise<void> {
    const savedVerbose = game.flags.verbose;
    game.flags.verbose = !!savedVerbose && !quick;
    let verbose = !!game.flags.verbose;
    let position = { x: game.u.ux, y: game.u.uy };
    try {
        for (;;) {
            await plineWithContinuation(verbose
                ? 'Please move the cursor to a monster, object or location.'
                : 'Pick a monster, object or location.');
            const firstUse = shouldShowGetposTip();
            if (firstUse) await showGetposTip();
            if (verbose) {
                const helpKey = game.commandBindings.specialKey('getpos.help');
                if (helpKey === undefined) throw new Error('Map selection requires a getpos.help binding');
                await plineWithContinuation(`(For instructions type a '${visibleCommandKey(helpKey)}')`);
            }
            if (firstUse) await plineWithContinuation('Move cursor to a monster, object or location:');

            const cursor = await selectMapPosition({
                start: position, force: quick,
                prompt: game._pending_message || game._retained_message,
                goal: 'a monster, object or location',
                describe: async (x, y) => {
                    const screen = screenDescription(x, y, '');
                    return screen.needsDetail ? await farlookLocationDescription(x, y) || screen.firstMatch : screen.firstMatch;
                },
            });
            if (!cursor) break;
            position = { x: cursor.x, y: cursor.y };
            verbose = false;
            game.flags.verbose = false;
            // putmixed() returns the description to WIN_MESSAGE. A later
            // checkfile() question or the next picker acknowledges that prose.
            game._pending_message = '';
            game._retained_message = '';
            const basic = screenDescription(cursor.x, cursor.y, '');
            const description = basic.needsDetail ? await farlookLocationDescription(cursor.x, cursor.y) : '';
            const glyph = glyphAt(cursor.x, cursor.y);
            const monster = basic.needsDetail && glyph?.kind === 'monster' && game.level
                && !farlookDescribesHero(cursor.x, cursor.y)
                ? monsterAtPosition(game.level, cursor.x, cursor.y) : null;
            const seen = monster ? monsterSeenDescription(monster) : '';
            const screen = basic.needsDetail ? screenDescription(cursor.x, cursor.y, description) : basic;
            await plineWithContinuation(screen.count ? screen.text
                + (seen ? ` [seen: ${seen}]` : '') : "I've never heard of such things.");
            if (screen.count === 1 && cursor.pickType !== LOOK_QUICK && cursor.pickType !== LOOK_ONCE
                && (cursor.pickType === LOOK_VERBOSE || !quick && game.flags.help !== false)) {
                await offerFarlookInformation(screen.firstMatch, cursor.pickType === LOOK_VERBOSE);
                if (monster) await offerMonsterSupplement(monster,
                    encyclopediaSupplementalName(screen.firstMatch), cursor.pickType === LOOK_VERBOSE);
            }
            if (quick || cursor.pickType === LOOK_ONCE) break;
        }
    } finally {
        if (savedVerbose === undefined) delete game.flags.verbose;
        else game.flags.verbose = savedVerbose;
    }
    game.context.move = 0;
}

async function offerFarlookInformation(description: string, withoutAsking: boolean): Promise<void> {
    // do_look() passes firstmatch with a null monster type. The selected
    // description retains given names for checkfile()'s alternate lookup.
    for (const match of encyclopediaMatches(description)) {
        if (withoutAsking || await promptYesNo(`More info about "${match.name}"?`, 'n') === 'y')
            await showDisclosureOverlay(match.entry.lines, { restoreUnderlay: true });
    }
}

async function restoreHelpMap(): Promise<void> {
    game._pending_message = '';
    game._retained_message = '';
    game.nhDisplay?.clearScreen();
    await docrt();
    await bot();
    await flush_screen(1);
}

// C pager.c:do_look(0).  The initial menu is a true PICK_ONE overlay; choosing
// the map entry destroys it, restores the map, then hands input ownership to
// the shared getpos/farlook transaction above.
async function dowhatis(): Promise<void> {
    const choices = [
        { key: '/', alias: 'y', text: 'something on the map' },
        { key: 'i', alias: '', text: "something you're carrying" },
        { key: '?', alias: 'n', text: 'something else (by symbol or name)' },
    ];
    if (!game.u.uswallow && !heroIsHallucinating(game)) choices.push(
        { key: 'm', alias: '', text: 'nearby monsters' },
        { key: 'M', alias: '', text: 'all monsters shown on map' },
        { key: 'o', alias: '', text: 'nearby objects' },
        { key: 'O', alias: '', text: 'all objects shown on map' },
        { key: 't', alias: '^', text: 'nearby traps' },
        { key: 'T', alias: '"', text: 'all seen or remembered traps' },
        { key: 'e', alias: '`', text: 'nearby engravings' },
        { key: 'E', alias: '|', text: 'all seen or remembered engravings' },
    );
    const queuedKey = takeCommandKey();
    let choice = queuedKey === undefined ? '' : String.fromCharCode(queuedKey);
    if (queuedKey === undefined) {
        const lootabc = !!game.flags.lootabc;
        const items: PageLocalMultiSelectItem<string>[] = [];
        for (const [index, entry] of choices.entries()) {
            if (index === 3) items.push({ selectable: false, text: '' });
            items.push({ text: entry.text, value: entry.key,
                ...(lootabc ? {} : { key: entry.key }),
                groupAccelerator: lootabc ? ['i', 'e'].includes(entry.key) ? '' : entry.key : entry.alias });
        }
        const result = await showMultiSelectWindow({
            title: 'What do you want to look at:', omitHeadings: true,
            pickOne: true, pageLocalKeys: true,
            sections: [{ items }],
        });
        choice = result[0] ?? '';
        await restoreHelpMap();
    }
    if (choice === 'y') choice = '/';
    const listKind = 'mM'.includes(choice) && choice ? 'monsters'
        : 'oO'.includes(choice) && choice ? 'objects'
            : 'tT'.includes(choice) && choice ? 'traps'
                : 'eE'.includes(choice) && choice ? 'engravings' : null;
    if (listKind) {
        await showLookList(listKind, choice === choice.toLowerCase(),
            () => wizardPositionDescription(game.u.ux, game.u.uy));
        game.context.move = 0;
        return;
    }
    if (choice === '/') {
        await doFarlook(false);
        return;
    }
    if (choice === 'i') {
        const queuedLetter = takeCommandKey();
        const letter = queuedLetter ?? (await selectInventoryObject()).key;
        const item = game.inventory.find(item => item.invlet === String.fromCharCode(letter));
        if (item) await showEncyclopediaInformation(singularObjectName(item));
        else if (queuedLetter !== undefined) clearCommandKeys();
    } else if (choice === '?') {
        const typed = await getLine('Specify what? (type the word)', ch => ch >= ' ');
        const name = typed === ' ' ? typed : typed?.trim().replace(/\s+/g, ' ');
        if (name && name.length > 1) await showEncyclopediaInformation(name);
        else if (name) {
            const result = typedSymbolDescription(name, {
                includeHero: !game.flags.showrace && !heroIsPolymorphed(game)
                    && !!game.urace && game.urace.name !== 'human' && game.urace.name !== 'elf',
                waterLevel: Is_waterlevel(game.u.uz),
                inHell: In_hell(game.u.uz),
                blind: heroIsBlind(game),
            });
            await plineWithContinuation(result.count
                ? `${name}        ${result.text}` : "I've never heard of such things.");
            if (result.count === 1 && game.flags.help !== false)
                await offerFarlookInformation(result.firstMatch, false);
        }
    }
    game.context.move = 0;
}

async function showEncyclopediaInformation(name: string): Promise<void> {
    const entries = encyclopediaEntries(name);
    // checkfile() fills an NHW_MENU with putstr(), so tty treats its rows
    // as prose and accepts only the --More-- responses, even across pages.
    for (const entry of entries)
        await showDisclosureOverlay(entry.lines, { restoreUnderlay: true });
    if (!entries.length) await pline("You don't have any information on those things.");
}

async function doversion(): Promise<void> {
    if (game.iflags.menu_requested) await doextversion();
    else await pline(NATIVE_VERSION);
    game.context.move = 0;
}

// C pager.c:dohelp().
async function dohelp(): Promise<void> {
    const entries = [
        { key: 'a', text: 'About NetHack (version information).' },
        { key: 'b', text: 'Long description of the game and commands.' },
        { key: 'c', text: 'List of game commands.' },
        { key: 'd', text: 'Concise history of NetHack.' },
        { key: 'e', text: 'Info on a character in the game display.' },
        { key: 'f', text: 'Info on what a given key does.' },
        { key: 'g', text: 'List of game options.' },
        { key: 'h', text: 'Longer explanation of game options.' },
        { key: 'i', text: `Using the ${setOptionsCommand()} command to set options.` },
        { key: 'j', text: 'Full list of keyboard commands.' },
        { key: 'k', text: 'List of extended commands.' },
        { key: 'l', text: 'List menu control keys.' },
        { key: 'm', text: "Description of NetHack's command line." },
        { key: 'n', text: 'The NetHack license.' },
        { key: 'o', text: 'Support information.' },
        ...(game.flags.debug ? [{ key: 'p', text: 'List of wizard-mode commands.' }] : []),
    ];
    const key = await showChoiceWindow({
        title: 'Select one item:',
        entries,
    });
    await restoreHelpMap();
    const choice = String.fromCharCode(key);
    if (choice === 'a') await doextversion();
    else if (choice === 'e') await dowhatis();
    else if (choice === 'f') await whatDoesCommand();
    else if (choice === 'g') await option_help();
    else if (choice === 'j') await showKeyBindings();
    else if (choice === 'k') await showExtendedCommandList();
    else if (choice === 'l') await menuControlsHelp();
    else if (choice === 'o') await contactHelp();
    else {
        const file = new Map([['b', 'help'], ['c', 'hh'], ['d', 'history'],
            ['h', 'opthelp'], ['i', 'optmenu'], ['m', 'usagehlp'],
            ['n', 'license'], ['p', 'wizhelp']]).get(choice);
        if (file) await displayHelpFile(file);
    }
    game.context.move = 0;
}

async function doputon(): Promise<void> {
    if (wearingFullEquipment()) {
        const prefix = monsterIsHumanoid(heroSpecies(game)) ? 'ring-' : '';
        await pline(`Your ${prefix}${makePlural(heroFingerName(game))} are full, and you're already wearing an amulet and ${game.ublindf?.otyp === LENSES ? 'some lenses' : 'a blindfold'}.`);
        game.context.move = 0;
        return;
    }
    const object = await chooseInventoryObject('put on', candidate => equipmentClassification(candidate, 'put on'));
    if (!object) {
        game.context.move = 0;
        return;
    }
    if (object.oclass === 3) {
        await putOnArmorObject(object);
        return;
    }

    await putOnAccessoryObject(object);
}

// do_wear.c:accessory_or_armor_on() is shared by both W and P.  getobj()
// downplays the other command's class in its compact prompt but still accepts
// a directly typed inventory letter and routes it through this same owner.
async function putOnAccessoryObject(object: GameObject): Promise<void> {
    if (object.worn) {
        await pline('You are already wearing that!');
        game.context.move = 0;
        return;
    }

    if (isEyewear(object)) {
        if (!heroHasNoHead(game) && !game.ublindf && !game.u.ublindf) {
            const touch = await retouchHeroObject(object);
            if (touch.rejected || touch.died) {
                game.context.move = 1;
                return;
            }
        }
        const worn = await wearEyewear(object);
        game.context.move = worn ? 1 : 0;
        return;
    }

    if (object.oclass === 5 || object.class === 'Amulets') {
        if (game.uamul) {
            await pline('You are already wearing an amulet.');
            game.context.move = 0;
            return;
        }
        const touch = await retouchHeroObject(object);
        if (touch.rejected || touch.died) {
            game.context.move = 1;
            return;
        }
        await wearHeroAccessory(object, 'uamul', game);
        game.context.move = 1;
        return;
    }

    if ((object.oclass === 4 || object.class === 'Rings' || object.otyp === MEAT_RING)
        && heroHasNoLimbs(game)) {
        await pline('You cannot make the ring stick to your body.');
        game.context.move = 0;
        return;
    }

    if (game.uleft && game.uright) {
        const prefix = monsterIsHumanoid(heroSpecies(game)) ? 'ring-' : '';
        await pline(`There are no more ${prefix}${makePlural(heroFingerName(game))} to fill.`);
        game.context.move = 0;
        return;
    }

    let hand: 'left' | 'right';
    if (!game.uleft && !game.uright) {
        for (;;) {
            const finger = String.fromCharCode(await promptKey(
                `Which ${monsterIsHumanoid(heroSpecies(game)) ? 'ring-' : ''}${heroFingerName(game)}, Right or Left? [rl] `,
            )).toLowerCase();
            // tty_yn_function() returns the zero default for quit keys.
            if (['\x1b', '\0', ' ', '\r', '\n'].includes(finger)) {
                game.context.move = 0;
                return;
            }
            if (finger === 'r' || finger === 'l') {
                hand = finger === 'r' ? 'right' : 'left';
                break;
            }
        }
    } else {
        hand = game.uright ? 'left' : 'right';
    }

    const ringSlot = hand === 'right' ? 'uright' : 'uleft';
    const gloves = game.uarmg;
    if (gloves && (game.u.glib || (game.u.glibTurns ?? 0) > 0)) {
        await pline(`Your ${armorSimpleName(gloves)} are too slippery to remove, so you cannot put on the ring.`);
        game.context.move = 1;
        return;
    }
    if (gloves?.cursed) {
        const discovered = !gloves.bknown;
        gloves.bknown = true;
        await pline('You cannot remove your gloves to put on the ring.');
        game.context.move = discovered ? 1 : 0;
        return;
    }
    const weapon = game.uwep;
    const primary = game.u.rightHanded === false ? 'uleft' : 'uright';
    if (weapon && (ringSlot === primary || OBJECT_BIMANUAL[weapon.otyp])
        && isWeldedPrimary(weapon)) {
        const discovered = !weapon.bknown;
        weapon.bknown = true;
        const handName = OBJECT_BIMANUAL[weapon.otyp] ? makePlural(heroHandName(game)) : heroHandName(game);
        await pline(`You cannot free your weapon ${handName} to put on the ring.`);
        game.context.move = discovered ? 1 : 0;
        return;
    }
    const touch = await retouchHeroObject(object);
    if (touch.rejected || touch.died) {
        game.context.move = 1;
        return;
    }
    await wearHeroAccessory(object, ringSlot, game);
    // Sink effects can remove the ring inside Ring_on().
    if (game.uleft === object || game.uright === object) {
        observeObjectForNaming(object);
        await plineWithContinuation(`${object.invlet} - ${inventoryItemDescription(object)}.`);
    }
    game.context.move = 1;
}

// C ref: objnam.c armor_simple_name() and category helpers.  Delayed armor
// nomovemsg deliberately uses a short category noun, not xname()/doname().

// C ref: do_wear.c Armor_off()/off_msg().  Delayed removal calls this from
// allmain only after negative multi has reached zero; zero-delay armor can use
// the same state owner immediately.
export async function finishArmorRemoval(
    object: GameObject, { silent = false }: { silent?: boolean } = {},
): Promise<string> {
    await removeHeroArmor(object, game, { deferArmorClass: true });
    if (silent || game.flags?.verbose === false) return '';
    return armorOffMessage(object, game);
}

// C do_wear.c:dotakeoff()/doremring() share armor_or_accessory_off().
// T suggests armor and R suggests accessories; either accepts the other kind.
async function removeWornItem(action: 'remove' | 'take off', itemAction = false): Promise<void> {
    const worn = (game.inventory || []).filter(object => object.worn);
    if (!worn.length) {
        await pline(action === 'take off' && game.uskin
            ? `The dragon ${game.uskin.otyp >= GRAY_DRAGON_SCALES ? 'scales are' : 'scale mail is'} merged with your skin!`
            : action === 'remove' ? 'Not wearing any accessories or armor.'
                : 'Not wearing any armor or accessories.');
        game.context.move = 0;
        return;
    }

    let object: GameObject | null | undefined;
    let inventoryPrompt: string | null = null;
    const preferred = accessibleEquipment(action === 'remove');
    // C ia_dotakeoff() forces getobj() to consume the queued item letter,
    // even if another accessible piece is the only normal suggestion.
    if (preferred.length === 1 && !itemAction && !((game.flags.paranoia_bits ?? 0) & PARANOID_REMOVE)) {
        [object] = preferred;
    } else {
        const suggested = game.inventory.filter(candidate => equipmentClassification(candidate, action, itemAction) === GETOBJ_SUGGEST);
        const letters = compactInventoryLetters(suggested.map(candidate => candidate.invlet).join(''));
        inventoryPrompt = `What do you want to ${action}? [${letters ? `${letters} or ?*` : '*'}] `;
        object = await chooseInventoryObject(action, candidate => equipmentClassification(candidate, action, itemAction));
    }
    if (!object) {
        game.context.move = 0;
        return;
    }

    if (!((object.owornmask ?? 0) & (W_ARMOR | W_ACCESSORY))) {
        await pline('You are not wearing that.');
        game.context.move = 0;
        return;
    }

    const cloak = game.uarmc;
    const suit = game.uarm;
    if (object === game.uskin || object === suit && cloak
        || object === game.uarmu && (cloak || suit)) {
        const coverings = [cloak, object === game.uarmu ? suit : null]
            .filter(covering => covering != null).map(covering => armorSimpleName(covering));
        await pline(object === game.uskin ? "You can't take that off; it's embedded."
            : `You can't take that off without taking off your ${coverings.join(' and ')} first.`);
        game.context.move = 0;
        return;
    }

    resetBulkTakeoff();
    const slot = TAKEOFF_ORDER.find(candidate => takeoffSlotObject(candidate) === object);
    if (!slot || !await canSelectOff(object, slot)) {
        game.context.move = 0;
        return;
    }
    resetBulkTakeoff();

    if (object === game.ublindf) {
        game._pending_message = '';
        const removed = await removeEyewear(object);
        if (game.program_state.gameover) return;
        game.context.move = removed ? 1 : 0;
        return;
    }

    if (object === game.uamul || object === game.uleft
        || object === game.uright) {
        // C armor_or_accessory_off(): a ring's off_msg() runs while it is
        // still worn, so the report keeps the "(on {right|left} hand)"
        // suffix and precedes Ring_off()'s side effects such as a
        // levitation landing or the death it causes; Amulet_off() clears
        // the slot first and reports afterwards, without a suffix.
        const ring = object === game.uleft || object === game.uright;
        if (ring && game.flags?.verbose !== false) {
            await plineWithContinuation(armorOffMessage(object, game));
        }
        await removeHeroAccessory(object, game);
        game.context.move = 1;
        return;
    }

    const delay = OBJECT_DELAY[object.otyp] ?? 0;
    const isArmor = object.class === 'Armor' || object.oclass === 3;
    if (isArmor && delay > 0) {
        endVoluntaryMultiTurn(game);
        game._delayedAction = {
            kind: 'remove',
            object,
            remainingGlobalTurns: delay,
            ready: false,
            // C do_wear.c installs this as nomovemsg.  allmain.c:unmul()
            // prints it before invoking Armor_off() through afternmv.
            finishMessage: `You finish taking off your ${
                armorSimpleName(object)
            }.`,
        };
        game.context.move = 1;
        return;
    }

    // do_wear.c:off_msg() is conditional on flags.verbose.  When disabled,
    // immediate zero-delay armor removal leaves getobj's selector as the
    // physical topline even though the timed state change has committed.
    game._pending_message = '';
    if (game.flags?.verbose === false && inventoryPrompt)
        game._retained_message = inventoryPrompt.trimEnd();
    const removalMessage = await finishArmorRemoval(object);
    if (removalMessage)
        await plineWithContinuation(removalMessage);
    game.context.move = 1;
}

async function putOnArmorObject(object: GameObject): Promise<void> {
    if (object.worn) {
        await pline('You are already wearing that!');
        game.context.move = 0;
        return;
    }

    const decision = armorWearDecision(object);
    if (decision.checkedWeldedWeapon) decision.checkedWeldedWeapon.bknown = true;
    if (decision.refusal) {
        await pline(decision.refusal);
        game.context.move = 0;
        return;
    }
    if (object.otyp === HELM_OF_OPPOSITE_ALIGNMENT && game.u.uz?.dnum === game.quest_dnum) {
        await pline(game.u.ualignbase?.[0] === game.u.ualignbase?.[1]
            ? 'You narrowly avoid losing all chance at your goal.'
            : 'You are suddenly overcome with shame and change your mind.');
        game.u.ublessed = 0;
        learnObjectType(object.otyp, game);
        game.context.botl = true;
        game.context.move = 1;
        return;
    }
    const touch = await retouchHeroObject(object);
    if (touch.rejected || touch.died) {
        game.context.move = 1;
        return;
    }

    const hero = game.u;
    // C accessory_or_armor_on(): armor leaves any held slot before setworn.
    // Cursed armor does not weld to the hand.
    await releaseWeaponSlots(object, game);
    wearHeroArmor(object, game);
    // C do_wear.c installs the slot with setworn() now, but allmain.c does
    // not run find_ac() until the command's monster/global time has passed.
    // Mark that once-per-input boundary; identification and Armor_on()
    // extrinsics remain later afternmv effects.
    const delay = OBJECT_DELAY[object.otyp] ?? 0;
    game._armorClassDirty = true;
    if (delay > 0) game._armorClassDirtyAfterDelayedFrame = true;
    if (delay > 0) {
        endVoluntaryMultiTurn(game);
        game._delayedAction = {
            kind: 'wear', object,
            // objects[].oc_delay advances through negative multi during
            // global-turn allocations, not through input commands.
            remainingGlobalTurns: delay,
            ready: false,
            finishMessage: 'You finish your dressing maneuver.',
        };
    } else {
        game.multi = 0;
        hero.usleep = 0;
        const effectMessages = await applyArmorOnEffects(object, game);
        const identifiesType = armorOnIdentifiesType(object, effectMessages)
            && !game._knownObjectTypes?.has(object.otyp);
        if (identifiesType) {
            recordObjectKnowledge(object.otyp);
            await exerciseAttribute(A_WIS, true);
        }
        object.known = true;
        object._armorApplied = true;
        const onMessage = objectWearMessage(object);
        for (const message of effectMessages)
            await plineWithContinuation(message);
        if (onMessage) await plineWithContinuation(onMessage);
    }
    // C accessory_or_armor_on() discards interrupted 'A' after armor wear.
    resetBulkTakeoff();
    game.context.move = 1;
}

// C refs: wield.c:dowield(), ready_weapon(), invent.c:getobj().  The prompt
// advertises weapons and weapon-tools but still permits the full inventory
// through ?/*; '-' represents the synthetic empty-hands object.
async function dowield(): Promise<void> {
    game.multi = 0;
    if (heroHasNoHands(game) || heroIsVerySmall(game)) {
        await pline("Don't be ridiculous!");
        game.context.move = 0;
        return;
    }
    const weapons = (game.inventory || []).filter(object =>
        object.oclass === 2 || isWeaponTool(object))
        .sort((left, right) => inventoryLetterRank(left) - inventoryLetterRank(right));
    const letters = weapons.map(object => object.invlet).join('');
    const choices = ['-', compactInventoryLetters(letters)].filter(Boolean).join(' ');
    const prompt = `What do you want to wield? [${choices} or ?*] `;
    clearSplitObjects();
    const selection = await promptInventoryObject(
        prompt, game.inventory || [], {
            verb: 'wield',
            classify: object => object.oclass === 12 ? GETOBJ_EXCLUDE
                : object.oclass === 2 || isWeaponTool(object) ? GETOBJ_SUGGEST : GETOBJ_DOWNPLAY,
            allowNone: true, allowMenu: true, allowCount: true,
            menuItems: weapons.length ? weapons : game.inventory.filter(item => item.oclass !== 12),
            noneDescription: `your ${game.uarmg ? 'gloved' : 'bare'} ${
                makePlural(heroHandName(game))}${game.uwep ? '' : ' (wielded)'}`,
        },
    );
    if (selection.cancelled) {
        game.context.move = 0;
        return;
    }

    let object = selection.object;
    if (!selection.none && !object) {
        game.context.move = 0;
        return;
    }
    let splitParent: GameObject | null = null;
    if (object && selection.count !== null && selection.count < object.quan) {
        if (object.otyp === LOADSTONE && object.cursed) object.corpsenm = selection.count;
        else if (isWeldedPrimary(object)) object.bknown = true;
        else {
            splitParent = object;
            object = splitCarriedStack(object, selection.count);
        }
    }
    if (object && object === game.uwep) {
        await reportAlreadyWielded(object);
        return;
    }
    if (await refuseWeldedPrimary()) {
        resetBulkTakeoff();
        if (splitParent && object) await rejoinObjectStack(splitParent, object);
        game.context.move = 0;
        return;
    }
    if (splitParent && object) {
        if (splitParent === game.uwep) {
            await rejoinObjectStack(splitParent, object);
            await reportAlreadyWielded(splitParent);
        } else {
            await finishSplittingCarriedStack(object);
            await wieldSelectedWeapon(object);
        }
        return;
    }
    if (selection.none) {
        await wieldSelectedWeapon(null);
        return;
    }
    if (!object) return;

    // C dowield() hands an alternate-weapon selection to doswapweapon()
    // rather than treating it as an unrelated primary.  That continuation
    // prints the new primary before committing the old primary as secondary;
    // tty can page between those two prinv() calls, before monster time.
    if (object === (game.uswapwep || game.u?.uswapwep)) {
        await doswapweapon();
        return;
    }
    if (object === game.uquiver) {
        const quantity = object.quan;
        let confirmation: string;
        if (quantity > 1 && hasFreeBasicInventoryLetter() && splittableForQuiver(object)) {
            const names = makePlural(minimalObjectName(object, game));
            const answer = await promptYesNoQuit(`You have ${quantity} ${names} readied.  Wield one?`);
            if (answer === 'q') {
                game.context.move = 0;
                return;
            }
            if (answer === 'y') {
                await wieldSelectedWeapon(await splitStackForQuiver(object, 1));
                return;
            }
            confirmation = 'Wield all of them instead?';
        } else {
            const plural = objectNameIsPlural(object, game)
                || object.otyp === LENSES || armorUsesPairGrammar(OBJECT_NAMES[object.otyp]);
            confirmation = `You have ${plural ? 'those' : 'that'} readied.  Wield ${plural ? 'them' : 'it'} instead?`;
        }
        if (await promptYesNoQuit(confirmation) !== 'y') {
            const names = minimalObjectName(object, game);
            const plural = objectNameIsPlural(object, game);
            await plineWithContinuation(`${objectOwnershipPrefix(object, game)}${quantity > 1 ? makePlural(names) : names} ${plural ? 'remain' : 'remains'} readied.`);
            game.context.move = 0;
            return;
        }
        await setQuiverObject(null);
    } else if ((object.owornmask ?? 0) & (W_ARMOR | W_ACCESSORY | W_SADDLE)) {
        await pline('You cannot wield that!');
        game.context.move = 0;
        return;
    }
    await wieldSelectedWeapon(object);
}

async function reportAlreadyWielded(object: GameObject): Promise<void> {
    await pline('You are already wielding that!');
    if (isWeaponTool(object) || isWetTowel(object)) game._unweapon = false;
    game.context.move = 0;
}

async function wieldSelectedWeapon(object: GameObject | null): Promise<void> {
    const oldPrimary = game.uwep || game.u.uwep || null;
    const spentTime = await readyHeroWeapon(object);
    // C dowield() applies pushweapon only after ready_weapon() has installed
    // the new primary.  The displaced primary becomes the authoritative
    // secondary object; preserving that identity is what makes a later
    // selection of it enter doswapweapon() and its two-prinv continuation.
    if (game.flags?.pushweapon && oldPrimary && game.uwep !== oldPrimary) {
        await setSecondaryWeapon(oldPrimary, game);
    }
    await stopTwoWeaponCombat();
    game.context.move = spentTime ? 1 : 0;
}

// C refs: do_wear.c dowear(), accessory_or_armor_on(), and the negative
// `multi`/afternmv completion in allmain.c.  Armor is installed in its worn
// slot immediately, but its known state and completion message are delayed
// until the required elapsed-turn scheduler round has finished.
function classifyWearChoice(object: GameObject, action: 'wear' | 'put on') {
    const classification = equipmentClassification(object, action);
    // Native canwearobj() checks welded() even during getobj's silent fit
    // check. Keep that knowledge change at the command boundary.
    if (action === 'wear' && object.oclass === 3) {
        const decision = armorWearDecision(object);
        if (decision.checkedWeldedWeapon) decision.checkedWeldedWeapon.bknown = true;
    }
    return classification;
}

async function dowear(): Promise<void> {
    // do_wear.c:dowear() owns this form-capability check before getobj().
    // W therefore rejects the whole transaction without exposing either
    // armor or cross-accepted accessory inventory letters.
    if (heroIsVerySmall(game) || heroHasNoHands(game)) {
        await pline("Don't even bother.");
        game.context.move = 0;
        return;
    }

    // wear_ok() downplays accessories but accepts them through the same
    // getobj transaction, including a queued inventory action.
    if (wearingFullEquipment()) {
        await pline('You are already wearing a full complement of armor.');
        game.context.move = 0;
        return;
    }
    const object = await chooseInventoryObject('wear', candidate => classifyWearChoice(candidate, 'wear'));
    if (!object) {
        game.context.move = 0;
        return;
    }
    if (object.oclass === 3) await putOnArmorObject(object);
    else await putOnAccessoryObject(object);
}

function droppedObjectDescription(object: GameObject): string {
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

async function dodrop(): Promise<void> {
    const inShop = !!game.u?.ushops?.[0];
    if (inShop) setSellDisposition(SELL_DELIBERATE);
    try {
        const inventory = game.inventory || [];
        const gold = heroGoldObject(game);
        if (!inventory.length) {
            await pline("You don't have anything to drop.");
            resetCommandVariables(true);
            return;
        }
        const letters = inventory.filter(object => object !== gold)
            .map(object => object.invlet).join('');
        const prompt = `What do you want to drop? [${gold ? '$' : ''}${compactInventoryLetters(letters)} or ?*] `;
        const selection = await promptInventoryObject(prompt, inventory, {
            verb: 'drop',
            allowGold: true, allowMenu: true, allowCount: true,
        });
        if (selection.cancelled) {
            resetCommandVariables(true);
            return;
        }
        let object = selection.gold ? gold : selection.object;
        if (!object) {
            resetCommandVariables(true);
            return;
        }
        if (selection.count !== null
            && selection.count < objectQuantity(object)) {
            if (object.otyp === LOADSTONE && object.cursed) {
                // C getobj() preserves the requested count for canletgo's
                // "any of" refusal; this stack must not be split.
                object.corpsenm = selection.count;
            } else if (!isWeldedPrimary(object)) {
                object = splitCarriedStack(object, selection.count);
            }
        }
        const spentTime = await dropHeroObject(object, {
            state: game, publish: plineWithContinuation,
        });
        if (!spentTime) {
            // do.c:drop() returns ECMD_FAIL for every refusal.
            resetCommandVariables(true);
            return;
        }
        game.context.move = 1;
        resetBulkTakeoff();
        resetPick();
        resetTrapSetting();
        if (game._occupation?.key === 'pick-lock')
            game._occupation = null;
    } finally {
        if (inShop) setSellDisposition(SELL_NORMAL);
    }
}

// C refs: lock.c doclose(); cmd.c getdir()/help_dir().  Invalid direction
// help is a modal text window: bytes typed before a real More dismissal must
// not leak back into the top-level command dispatcher.
async function doclose(): Promise<void> {
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
        clearRepeatCommand(); // lock.c:doclose() returns ECMD_CANCEL.
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
        const previousGlyph = glyphAt(x, y)?.glyph;
        recordMappedOverviewState();
        const previousTerrain = loc.lastseentyp;
        feel_location(x, y);
        if (glyphAt(x, y)?.glyph !== previousGlyph || loc.lastseentyp !== previousTerrain)
            game.context.move = 1;
    }
    const portcullis = loc && (loc.typ === DOOR || loc.typ === DBWALL)
        && findDrawbridgeAt(x, y) !== null;
    if (portcullis || loc?.typ !== DOOR) {
        if (loc?.typ === DBWALL || loc?.typ === DRAWBRIDGE_UP)
            await pline('The drawbridge is already closed.');
        else if (portcullis || loc?.typ === DRAWBRIDGE_DOWN)
            await pline('There is no obvious way to close the drawbridge.');
        else await pline(`You ${heroIsBlind(game) ? 'feel' : 'see'} no door there.`);
        return;
    }
    if (loc.doormask === D_NODOOR) {
        await pline('This doorway has no door.');
        return;
    }
    requirePlayingGame(game);
    if (await doorObstructed(x, y, false, game)) return;
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
            feel_newsym(x, y);
            vision_note_blocker_change(x, y);
        } else {
            await exerciseAttribute(A_STR, true);
            await pline('The door resists!');
        }
    }
    game.context.move = 1;
}

// C refs: lock.c doopen(); cmd.c get_adjacent_loc()/getdir().  Direction
// validation is owned by the same modal assistance transaction as close;
// the door mutation happens only after that transaction returns a direction.
async function doopen(x = 0, y = 0): Promise<void> {
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
            ? () => readDirectionKey('Open where? [.>] ') : readDirectionKey);
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
        const previousGlyph = glyphAt(x, y)?.glyph;
        recordMappedOverviewState();
        const previousTerrain = loc.lastseentyp;
        newsym(x, y);
        // doopen_indir() uses a turn when looking at the target teaches
        // the hero something, even if the target has no door to open.
        if (glyphAt(x, y)?.glyph !== previousGlyph || loc.lastseentyp !== previousTerrain)
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
        const hasContainer = floorPile.some(object =>
            object.otyp >= LARGE_BOX && object.otyp <= BAG_OF_TRICKS);
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
    } else {
        await exerciseAttribute(A_STR, true);
        await pline('The door resists!');
    }
    if (game.program_state.gameover) return;
    game.context.move = 1;
}

// lock.c:doopen_indir() announces opening before the explosion. The door
// remains closed across that message pause and any fatal explosion.
async function openClosedDoor(door: MapLocation, x: number, y: number): Promise<void> {
    await plineWithContinuation('The door opens.');
    if (door.doormask & D_TRAPPED) {
        if (await triggerBoobyTrap('door', { bodypart: true })) return;
        door.doormask = D_NODOOR;
        const level = requireGameLevel();
        if (roomsAt(level, x, y, SHOPBASE).length)
            addShopDamage(x, y, SHOP_DOOR_COST);
    } else door.doormask = D_ISOPEN;
    feel_newsym(x, y);
    vision_note_blocker_change(x, y);
}

async function pickAxeDirection(prompt: string): Promise<{ dx: number; dy: number; dz: number } | null> {
    return promptDirection(() => readDirectionKey(`${prompt} `));
}

async function applyPickAxe(item: GameObject): Promise<void> {
    const result = await usePickAxe(item, {
        state: game,
        ensureWielded: () => wieldTool(
            item, 'swing', { swapWeapons: doswapweapon }, game,
        ),
        readDirection: pickAxeDirection,
        payShopkeeper: dopay,
        attackMonster: (monster: Monster) => attackHostileMonster(
            monster, monster.mx, monster.my,
        ),
    });
    if ('died' in result && result.died) return;
    if (result.cancelled) resetCommandVariables(true);
    if ('resume' in result && result.resume) {
        game._cannedCommands ||= [];
        game._cannedCommands.push({ kind: 'apply', invlet: inventoryCommandLetter(item) });
    }
    game.context.move = 'spentTime' in result && result.spentTime ? 1 : 0;
}

async function applyPolearm(item: GameObject, autohit = false): Promise<void> {
    const result = await usePolearm(item, {
        state: game,
        autohit,
        ensureWielded: () => wieldTool(
            item, 'swing', { swapWeapons: doswapweapon }, game,
        ),
        describeTarget: wizardPositionDescription,
    });
    if ('heroDied' in result && result.heroDied) return;
    if ('resume' in result && result.resume) {
        game._cannedCommands ||= [];
        game._cannedCommands.push({ kind: 'apply', invlet: inventoryCommandLetter(item) });
    }
    game.context.move = 'spentTime' in result && result.spentTime ? 1 : 0;
}

async function doapply(cannedInvlet: string | null = null): Promise<void> {
    // apply.c:doapply() rejects the current body and excessive load before
    // choosing an object through getobj().
    if (heroHasNoHands(game)) {
        await pline(
            "You aren't able to use or apply tools in your current form.",
        );
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
        resetCommandVariables(true); // doapply() returns ECMD_CANCEL without an object.
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
        && await speakArtifact(appliedObject)) game.context.move = 1;
}

// Return the surviving object for the native talking-artifact tail. Applied
// stacks can split or disappear, so each destructive owner returns its object.
async function applyTool(
    item: GameObject, underlay: ReturnType<typeof snapshotMenuUnderlay>,
): Promise<GameObject | null> {
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
        if (item.otyp === CANDELABRUM_OF_INVOCATION) result = await useCandelabrum(item);
        else if (item.otyp === POT_OIL) result = await lightCocktail(item);
        else if ([TALLOW_CANDLE, WAX_CANDLE].includes(item.otyp)) result = await useCandle(item);
        else result = await useLamp(item);
        game.context.move = result.spentTime ? 1 : 0;
        return result.object;
    }
    if (isGrayStone(item)) {
        const result = await useGrayStone(item);
        game.context.move = result.spentTime ? 1 : 0;
        return item;
    }
    if (item.otyp === BULLWHIP) {
        const wielded = await wieldTool(
            item,
            'lash',
            { swapWeapons: doswapweapon },
            game,
        );
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
            game.context.move = 0;
            return item;
        }
        game._pending_message = '';
        const result = await useBullwhip(item, direction, {
            state: game,
            attackMonster: (monster, x, y) => attackHostileMonster(monster, x, y),
            holdObject: async (object: GameObject) => {
                await addPickedInventoryObject(object);
                return true;
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
            ensureWielded: () => wieldTool(
                item,
                'cast',
                { swapWeapons: doswapweapon },
                game,
            ),
            describeTarget: wizardPositionDescription,
            hurtle: (dx: number, dy: number) => hurtleHero(dx, dy, 1, {
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
        if (game.program_state.gameover) return item;
        game.context.move = 1;
        return item;
    }
    if (isContainer(item)) {
        const result = await useContainer(item, {
            held: true,
            underlay,
        });
        if (result.heroDied) return item;
        game.context.move = result.spentTime ? 1 : 0;
        return result.container;
    }
    if (item.otyp === STETHOSCOPE) {
        game.context.move = await useStethoscope(item) ? 1 : 0;
        return item;
    }
    if (item.otyp === TIN_OPENER) {
        const result = await useTinOpener(item, { state: game, swapWeapons: doswapweapon });
        if (!result.heroDied) game.context.move = Number(result.usedTime);
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
        await rubRoyalJelly(item);
        return game.inventory.includes(item) ? item : null;
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
    game.context.move = 0;
    return null;
}

// C refs: dowieldquiver(), doquiver_core().  Q and empty-quiver fire share
// one live inventory transaction; neither role nor recorded input selects a
// different readiness implementation.
async function doready(): Promise<void> {
    await doquiverCore('ready');
}

function splitCarriedStack(item: GameObject, count: number): GameObject {
    const split = splitObjectStack(item, count, game);
    if (!split) throw new Error('cannot split selected inventory stack');
    return split;
}

async function splitStackForQuiver(item: GameObject, count: number): Promise<GameObject> {
    const child = splitCarriedStack(item, count);
    await finishSplittingCarriedStack(child);
    return child;
}

// C finish_splitting(): take the child out and add it without merging so
// its inherited inventory letter is replaced and carried effects refresh.
async function finishSplittingCarriedStack(object: GameObject): Promise<void> {
    await freeInventoryObject(object);
    const nomerge = !!object.nomerge;
    object.nomerge = true;
    await addInventoryItem(object, null, false);
    object.nomerge = nomerge;
}

function splittableForQuiver(item: GameObject): boolean {
    return !(item?.otyp === LOADSTONE && item.cursed)
        && !isWeldedPrimary(item);
}

function hasFreeBasicInventoryLetter(): boolean {
    return game.inventory.filter(item => item.oclass !== 12).length < 52;
}

async function doquiverCore(verb: 'ready' | 'fire'): Promise<QuiverCommandResult> {
    game.multi = 0;
    if (!(game.inventory || []).length) {
        await pline('You have nothing to ready for firing.');
        game.context.move = 0;
        return { item: null, spentTime: false, cancelled: false };
    }
    clearSplitObjects();
    const suggestions = game.inventory.filter(item => readySuggestion(item, game));
    const letters = suggestions.map(item => item.invlet).join('');
    const noneSuggested = !!game.uquiver;
    const choices = `${noneSuggested ? '- ' : ''}${compactInventoryLetters(letters)}`.trim();
    const prompt = `What do you want to ${verb}? [${choices ? `${choices} or ?*` : '*'}] `;
    const selection = await promptInventoryObject(
        prompt, game.inventory || [], {
            verb,
            allowNone: true, allowMenu: true, allowCount: true,
            menuItems: suggestions, noneSuggested,
            noneDescription: verb === 'ready'
                ? `empty quiver${game.uquiver ? '' : ' (nothing readied)'}`
                : `your ${makePlural(heroHandName(game))}`,
        },
    );
    if (selection.cancelled) {
        game.context.move = 0;
        return { item: null, spentTime: false, cancelled: true };
    }
    if (selection.none) {
        if (game.uquiver) {
            await pline('You now have no ammunition readied.');
            await setQuiverObject(null, game);
        } else {
            await pline('You already have no ammunition readied!');
        }
        game.context.move = 0;
        return { item: null, spentTime: false, cancelled: false };
    }
    let item = selection.object;
    if (!item) {
        game.context.move = 0;
        return { item: null, spentTime: false, cancelled: true };
    }

    if (isWeldedPrimary(item)) {
        // getobj() tests splittable() first for a partial count. That test
        // reveals the weld before doquiver_core() checks whether it is new.
        if (selection.count !== null && selection.count < item.quan) item.bknown = true;
        const spentTime = !item.bknown;
        await refuseWeldedPrimary();
        resetBulkTakeoff();
        game.context.move = spentTime ? 1 : 0;
        return {
            item: null, spentTime, cancelled: false,
        };
    }

    const requestedCount = selection.count;
    const initialQuantity = item.quantity ?? item.quan ?? 1;
    const partialCount = requestedCount !== null
        && requestedCount < initialQuantity;
    if (partialCount && item.otyp === LOADSTONE && item.cursed)
        item.corpsenm = requestedCount;
    if (item === game.uquiver) {
        // C getobj() splits before doquiver_core() notices the readied parent.
        if (partialCount && splittableForQuiver(item)) {
            const split = splitCarriedStack(item, requestedCount);
            await rejoinObjectStack(item, split, game);
        }
        await pline('That ammunition is already readied!');
        game.context.move = 0;
        return { item, spentTime: false, cancelled: false };
    }
    const selectedClass = item.oclass || objectClassForType(item.otyp);
    if (partialCount && selectedClass === 12) {
        // C getobj()/unsplitobj(): partial purses are not valid ammunition.
        const split = splitCarriedStack(item, requestedCount);
        await rejoinObjectStack(item, split, game);
        await pline("You can't ready only part of your gold.");
        game.context.move = 0;
        return { item: null, spentTime: false, cancelled: false };
    }
    if (requestedCount !== null && requestedCount < initialQuantity
        && splittableForQuiver(item)) {
        item = await splitStackForQuiver(item, requestedCount);
    }

    const incompatibleMask = W_ARMOR | W_ACCESSORY | W_SADDLE;
    if (((item.owornmask ?? 0) & incompatibleMask)
        || (item.worn && item !== game.uwep && item !== game.uswapwep)) {
        await pline(`You cannot ${verb} that!`);
        game.context.move = 0;
        return { item: null, spentTime: false, cancelled: false };
    }

    const primary = item === game.uwep;
    const alternate = item === game.uswapwep;
    const wasTwoweap = !!game.u?.twoweap;
    let spentTime = false;
    if (primary || alternate) {
        const quantity = item.quantity ?? item.quan ?? 1;
        const noun = minimalObjectName(item, game);
        const names = quantity === 1 ? noun : makePlural(noun);
        const usePlural = objectNameIsPlural(item, game)
            || item.otyp === LENSES || armorUsesPairGrammar(OBJECT_NAMES[item.otyp]);
        let confirmation = primary
            ? `You are wielding ${usePlural ? 'those' : 'that'}.  Ready ${usePlural ? 'them' : 'it'} instead?`
            : `${usePlural ? 'Those are' : 'That is'} your ${wasTwoweap ? 'second' : 'alternate'} weapon.  Ready ${usePlural ? 'them' : 'it'} instead?`;
        let readyAll = true;
        if (quantity > 1 && hasFreeBasicInventoryLetter()
            && splittableForQuiver(item)) {
            const slotDescription = primary
                ? `You are wielding ${quantity} ${names}.`
                : `${wasTwoweap ? 'You are dual wielding'
                    : 'Your alternate weapon is'} ${quantity} ${names}.`;
            const partial = await promptYesNoQuit(
                `${slotDescription}  Ready ${quantity - 1} of them?`,
            );
            if (partial === 'q') {
                game.context.move = 0;
                return { item: null, spentTime: false, cancelled: false };
            }
            if (partial === 'y') {
                item = await splitStackForQuiver(item, quantity - 1);
                readyAll = false;
            } else confirmation = 'Ready all of them instead?';
        }
        if (readyAll) {
            const answer = await promptYesNoQuit(confirmation);
            if (answer !== 'y') {
                const owner = objectOwnershipPrefix(item, game);
                const remains = objectNameIsPlural(item, game) ? 'remain' : 'remains';
                const slot = primary || wasTwoweap ? 'wielded' : 'as secondary weapon';
                await plineWithContinuation(`${owner}${names} ${remains} ${slot}.`);
                game.context.move = 0;
                return { item: null, spentTime: false, cancelled: false };
            }
            if (primary) {
                await setPrimaryWeapon(null, game);
                spentTime = true;
            } else {
                await setSecondaryWeapon(null, game);
                spentTime = wasTwoweap;
            }
        }
    }
    if (verb !== 'fire') await setQuiverObject(item, game);
    observeObjectForNaming(item);
    const description = inventoryItemDescription(item);
    await plineWithContinuation(verb === 'fire'
        ? `You ready: ${item.invlet} - ${description}.`
        : `${item.invlet} - ${description}.`);
    if (verb === 'fire') await setQuiverObject(item, game);
    if (spentTime) {
        if (primary) {
            const humanoid = !!((MONSTER_FLAGS1[heroSpecies(game)] ?? 0) & M1_HUMANOID);
            const hands = game.uarmg ? 'empty handed'
                : humanoid ? 'bare handed' : 'not wielding anything';
            await plineWithContinuation(`You are now ${hands}.`);
        } else await plineWithContinuation('You are no longer using two weapons at once.');
    }
    game.context.move = spentTime ? 1 : 0;
    return { item, spentTime, cancelled: false };
}

// C refs: dothrow(), throw_obj().  Splitting the selected arrow stack makes
// a new object id, then obj_resists() is consulted when it lands.
async function okToThrow(): Promise<boolean> {
    // dothrow.c:ok_to_throw() is shared by #throw and #fire.  It rejects
    // form capabilities before capacity and before either command chooses an
    // object. M1_NOTAKE deliberately precedes M1_NOHANDS because forms such
    // as brown molds satisfy both and own the stronger message.
    if (heroCannotTake(game)) {
        await pline(
            'You are physically incapable of throwing or shooting anything.',
        );
        game.context.move = 0;
        return false;
    }
    if (heroHasNoHands(game)) {
        await pline("You can't throw or shoot without hands.");
        game.context.move = 0;
        return false;
    }
    if (exceedsActionCapacity(game)) {
        await pline("You can't do that while carrying so much stuff.");
        game.context.move = 0;
        return false;
    }
    return true;
}

async function dofire(cannedShotLimit: number | null = null): Promise<void> {
    const shotLimit = cannedShotLimit === null
        ? Math.max(0, game._commandCount || 0)
        : Math.max(0, cannedShotLimit || 0);
    game.multi = 0;
    if (!await okToThrow()) return;

    let fireObject = game.uquiver;
    const weapon = game.uwep;
    const throwWielded = weapon && isAutoReturningThrow(weapon, weapon.owornmask ?? 0, game)
        && (artifactById(weapon.oartifact, game)?.name !== 'Mjollnir'
            || currentAttribute(A_STR) >= STR19(25))
        && (!fireObject || isAmmunition(fireObject));
    if (throwWielded) fireObject = weapon;
    let quiverSelectionSpentTime = false;
    if (!fireObject) {
        if (game.flags?.autoquiver) {
            fireObject = autoquiverCandidate(game);
            if (fireObject) {
                const wasReady = fireObject.ready;
                fireObject.ready = false;
                observeObjectForNaming(fireObject);
                await pline(
                    `You ready: ${fireObject.invlet} - ${
                        inventoryItemDescription(fireObject)}.`,
                );
                if (wasReady === undefined) delete fireObject.ready;
                else fireObject.ready = wasReady;
                await setQuiverObject(fireObject, game);
            } else {
                await pline('You have nothing appropriate for your quiver.');
            }
        } else {
            if (game.uwep && isPolearm(game.uwep)) return applyPolearm(game.uwep, true);
            if (game.uwep?.otyp === BULLWHIP) {
                await applyTool(game.uwep, snapshotMenuUnderlay());
                return;
            }
            const alternate = game.uswapwep || game.u?.uswapwep;
            if (game.flags?.fireassist !== false && alternate && isPolearm(alternate)
                && !(alternate.cursed && alternate.bknown)) {
                game._cannedCommands ||= [];
                game._cannedCommands.push({ kind: 'swap-weapon' });
                game._cannedCommands.push({ kind: 'fire', shotLimit });
                game.context.move = 0;
                return;
            }
            await pline('You have no ammunition readied.');
        }
        if (!fireObject) {
            const selection = await doquiverCore('fire');
            fireObject = selection?.item || null;
            quiverSelectionSpentTime = !!selection?.spentTime;
        }
        if (!fireObject) return;
    }

    // dothrow.c:dofire() routes launcher assistance through CQ_CANNED: a
    // matching alternate weapon is swapped in as one timed action, then fire
    // resumes after the complete monster/global turn without consuming a new
    // physical key.  This applies to every matching ammo/launcher pair; role
    // names and recorded command streams do not participate in selection.
    if (fireObject) {
        const matchingLauncher = (launcher: GameObject | null | undefined) =>
            launcherMatchesAmmo(fireObject, launcher);
        const alternate = game.uswapwep || game.u?.uswapwep || null;
        const fireassist = !throwWielded && game.flags?.fireassist !== false;
        if (fireassist && isAmmunition(fireObject) && game.uwep && isPolearm(game.uwep)
            && couldPoleMonster(game.uwep, { state: game })) {
            return applyPolearm(game.uwep, true);
        }
        if (fireassist && !matchingLauncher(game.uwep)
            && matchingLauncher(alternate)) {
            game._cannedCommands ||= [];
            game._cannedCommands.push({ kind: 'swap-weapon' });
            game._cannedCommands.push({ kind: 'fire', shotLimit });
            game.context.move = quiverSelectionSpentTime ? 1 : 0;
            return;
        }
        if (fireassist && !matchingLauncher(game.uwep)) {
            // dothrow.c:find_launcher() scans the live inventory chain.  A
            // known cursed launcher is ineligible; the first known blessed
            // or uncursed match wins immediately, while only the first
            // unknown-BUC match is retained as a fallback.
            let unknownLauncher = null;
            let inventoryLauncher = null;
            for (const candidate of game.inventory || []) {
                if (candidate.cursed && candidate.bknown) continue;
                if (!matchingLauncher(candidate)) continue;
                if (candidate.bknown) {
                    inventoryLauncher = candidate;
                    break;
                }
                if (!unknownLauncher) unknownLauncher = candidate;
            }
            inventoryLauncher ||= unknownLauncher;
            if (inventoryLauncher) {
                if (!inventoryLauncher.invlet)
                    throw new Error('Cannot queue a wield command for an object without an inventory letter.');
                game._cannedCommands ||= [];
                if (game.uwep && !game.flags?.pushweapon) {
                    game._cannedCommands.push({ kind: 'swap-weapon' });
                }
                game._cannedCommands.push({
                    kind: 'wield', invlet: inventoryLauncher.invlet,
                });
                game._cannedCommands.push({ kind: 'fire', shotLimit });
                game.context.move = quiverSelectionSpentTime ? 1 : 0;
                return;
            }
        }
        const throwResult = await throwCommand(fireObject, true, shotLimit);
        // dofire() returns the time spent unwielding even if throw_obj()
        // cancels. Only a cancellation without that elapsed turn clears recall.
        if (quiverSelectionSpentTime)
            game.context.move = 1;
        else if (throwResult === 'cancelled') resetCommandVariables(true);
        return;
    }
}

async function finishOrdinarySwallowedThrowKill(
    monster: Monster, projectile: GameObject, options: HeroMonsterKillOptions = {},
) {
    return finishHeroMonsterKillOutcome(monster, monster.mx, monster.my, {
        ...options,
        deathContext: {
            kind: 'swallowed-projectile',
            projectile,
        },
    });
}

async function finishOrdinarySwallowedConsumedKill(
    monster: Monster, kind: 'swallowed-egg' | 'swallowed-venom' | 'swallowed-potion', death: HeroMonsterKillOptions = {},
) {
    return finishHeroMonsterKillOutcome(monster, monster.mx, monster.my, {
        ...death,
        deathContext: {
            kind,
        },
    });
}

async function finishOrdinaryMapPotionKill(monster: Monster, death: HeroMonsterKillOptions = {}) {
    return finishHeroMonsterKillOutcome(monster, monster.mx, monster.my, death);
}

async function dothrow(selectedItem: GameObject | null = null): Promise<void> {
    if (await throwCommand(selectedItem) === 'cancelled') resetCommandVariables(true);
}

async function throwCommand(
    selectedItem: GameObject | null = null, capabilityChecked = false, suppliedShotLimit: number | null = null,
): Promise<'cancelled' | void> {
    const shotLimit = suppliedShotLimit === null
        ? Math.max(0, game._commandCount || 0)
        : Math.max(0, suppliedShotLimit || 0);
    requireInitializedHero(game.u);
    game.multi = 0;
    if (!capabilityChecked && !await okToThrow()) return;

    // getobj("throw") changes its suggested class when the primary weapon is
    // a sling: ordinary weapons become downplayed and GEM_CLASS sling ammo is
    // suggested instead.  Every directly selected inventory letter remains
    // valid even when downplayed.
    const launcher = game.uwep;
    const wieldingSling = !!launcher
        && OBJECT_SUBTYPE[launcher.otyp] === OBJECT_SUBTYPE[SLING];
    // C getobj() sorts its candidates independently of the carried chain.
    const throwClassification = (item: GameObject) => {
        const objectClass = item.oclass || objectClassForType(item.otyp);
        if (item.bknown && isWeldedPrimary(item)) return GETOBJ_DOWNPLAY;
        if (item.otyp === BOOMERANG || item === game.uwep && (item.otyp === AKLYS
            || artifactById(item.oartifact)?.name === 'Mjollnir'
                && game.urole?.key === 'valkyrie' && currentAttribute(A_STR) >= STR19(25)))
            return GETOBJ_SUGGEST;
        if (item.quan === 1 && (item === game.uwep || item === game.uswapwep && game.u.twoweap))
            return GETOBJ_DOWNPLAY;
        return objectClass === 12 || objectClass === (wieldingSling ? 13 : 2)
            || item.otyp === BOULDER && ((MONSTER_FLAGS2[game.u.umonnum ?? -1] ?? 0) & M2_ROCKTHROW)
            ? GETOBJ_SUGGEST : GETOBJ_DOWNPLAY;
    };
    if (!selectedItem) {
        selectedItem = await chooseInventoryObject('throw', throwClassification, { forcePrompt: true, allowCount: true });
    }
    const item = selectedItem;
    if (!item) {
        return 'cancelled';
    }
    const previous = game.inventory[game.inventory.indexOf(item) - 1];
    const splitParent = previous && previous.invlet === item.invlet ? previous : null;
    const selectedObjectClass = item.oclass || objectClassForType(item.otyp);
    const selectedIsGold = selectedObjectClass === 12;
    const directGoldThrow = selectedIsGold && item !== game.uquiver;
    const direction = await promptDirection();
    if (!direction) {
        if (splitParent) await rejoinObjectStack(splitParent, item, game);
        game._pending_message = '';
        return 'cancelled';
    }
    const { dx, dy, dz } = direction;
    const selfThrow = !dx && !dy && !dz;

    if (directGoldThrow) {
        if (selfThrow) {
            if (splitParent) await rejoinObjectStack(splitParent, item, game);
            await pline('You cannot throw gold at yourself.');
            game.context.move = 0;
            return;
        }
        await resolveDirectGoldThrow({
            state: game,
            gold: item,
            dx, dy, dz,
            captureFlight: captureThrownObjectFlight,
            wakeMonster: wakeAttackedMonster,
            angerMonster: angerAttackedMonster,
        });
        game.context.move = 1;
        return;
    }

    if (!await canLetGo(item, 'throw')) {
        if (splitParent) await rejoinObjectStack(splitParent, item, game);
        game.context.move = 0;
        return;
    }
    const mjollnir = artifactById(item.oartifact, game)?.name === 'Mjollnir';
    if (mjollnir && item !== game.uwep) {
        if (splitParent) await rejoinObjectStack(splitParent, item, game);
        await pline(`The ${objectName(item)} must be wielded before it can be thrown.`);
        game.context.move = 0;
        return;
    }
    if (mjollnir && currentAttribute(A_STR) < STR19(25)
        || item.otyp === BOULDER
            && !((MONSTER_FLAGS2[game.u.umonnum] ?? 0) & M2_ROCKTHROW)) {
        if (splitParent) await rejoinObjectStack(splitParent, item, game);
        await pline("It's too heavy.");
        game.context.move = 1;
        return;
    }
    if (selfThrow) {
        if (splitParent) await rejoinObjectStack(splitParent, item, game);
        await pline('You cannot throw an object at yourself.');
        game.context.move = 0;
        return;
    }
    wipeHeroEngraving(2);

    if (!(game.uarmg || game.u.uarmg) && item.otyp === CORPSE
        && touchPetrifies(item.corpsenm) && !heroResistsStoning(game)) {
        await plineWithContinuation(`You throw ${corpseName(item, { definite: true })} with your bare ${makePlural(heroHandName(game))}.`);
        const result = await resolveImmediatePetrification({
            state: game,
            killer: `throwing ${killerObjectName(item, game)} bare-handed`,
        });
        if (result.died || game.program_state.gameover) return;
    }

    if (isWetTowel(item)) await dryTowel(item, -1);

    if (selectedIsGold && item === game.uquiver) {
        await resolveQuiveredGoldThrow({
            state: game,
            gold: item,
            dx, dy, dz,
            captureFlight: captureThrownObjectFlight,
            wakeMonster: wakeAttackedMonster,
        });
        if (game.program_state.gameover) return;
        await reportHeroEncumbrance(game);
        game.context.move = 1;
        return;
    }

    const selectedQuantity = item.quantity ?? item.quan ?? 1;
    const thrownObjectClass = selectedObjectClass;
    // obj.h:is_ammo()+matching_launcher(): the arrow flight owner is selected
    // by the signed P_BOW subtype, not the ordinary ARROW/BOW identities.
    // This includes elven, orcish, silver and ya ammunition with any matching
    // bow while leaving crossbow and sling ammunition to the shared flight.
    const bowAmmo = OBJECT_SUBTYPE[item.otyp] === -P_BOW;
    const handThrownArrow = bowAmmo
        && (!game.uwep || OBJECT_SUBTYPE[game.uwep.otyp] !== P_BOW);
    const volleyCount = game.u?.uswallow ? 1 : chooseHeroVolleyCount(item, {
        state: game,
        shotLimit,
    });
    if (volleyCount > 1 || shotLimit > 0) {
        if (volleyCount === 1) observeObjectForNaming(item);
        const noun = volleyCount === 1
            ? singularObjectName(item) : objectCombatName(item, { includeCorpseSpecies: false });
        await plineWithContinuation(
            `You ${launcherMatchesAmmo(item, game.uwep) ? 'shoot' : 'throw'} ${
                volleyCount} ${noun}.`,
        );
    }
    if (await resolveSwallowedEggPieOrVenomThrow({
        state: game,
        item,
        selectedQuantity,
        finishKill: (monster: Monster) => finishOrdinarySwallowedConsumedKill(
            monster, item.otyp === EGG ? 'swallowed-egg' : 'swallowed-venom',
        ),
    })) return;
    if (await resolveSwallowedWeaponThrow({
        state: game,
        item,
        objectClass: thrownObjectClass,
        selectedQuantity,
        finishKill: finishOrdinarySwallowedThrowKill,
    })) return;
    if (game.u?.uswallow
        && (thrownObjectClass === 2
            || (thrownObjectClass === 6
                && (OBJECT_SUBTYPE[item.otyp] ?? 0) !== 0))) {
        // The ordinary floor/projectile continuation cannot model
        // thitmonst()->hmon() while engulfed, so do not pretend it can.
        throw new Error('swallowed weapon throwing is not implemented');
    }

    if (await resolveSwallowedPotionThrow({
        state: game,
        item,
        objectClass: thrownObjectClass,
        selectedQuantity,
        wakeMonster: wakeAttackedMonster,
        wakeNearby: wakeMonstersNear,
        finishKill: (monster: Monster, death?: HeroMonsterKillOptions) => finishOrdinarySwallowedConsumedKill(
            monster, 'swallowed-potion', death,
        ),
    })) return;
    if (game.u?.uswallow && thrownObjectClass === 8)
        throw new Error('swallowed potion throwing is not implemented');

    if (await resolveSwallowedFoodThrow({
        state: game,
        item,
        objectClass: thrownObjectClass,
        selectedQuantity,
        wakeMonster: wakeAttackedMonster,
    })) return;

    if (await resolveGenericSwallowedThrow({
        state: game,
        item,
        objectClass: thrownObjectClass,
        selectedQuantity,
        wakeMonster: wakeAttackedMonster,
    })) return;
    if (game.u?.uswallow && thrownObjectClass !== 8) {
        // An unresolved swallowed object cannot use the ordinary floor path;
        // that path targets map coordinates rather than the engulfing monster.
        throw new Error('swallowed special-object throwing is not implemented');
    }

    if (!game.u?.uswallow && await resolveMapPotionThrow({
        state: game,
        item,
        objectClass: thrownObjectClass,
        selectedQuantity,
        dx,
        dy,
        captureFlight: captureThrownObjectFlight,
        wakeMonster: wakeAttackedMonster,
        wakeNearby: wakeMonstersNear,
        finishKill: finishOrdinaryMapPotionKill,
    })) return;
    if (!game.u?.uswallow && thrownObjectClass === 8)
        throw new Error('map potion impact is not implemented');

    // is_ammo() halves hand-thrown arrow range and announces the missing
    // launcher before bhit() resolves the landing.  Keep the line alive
    // across contact and the terminal projectile transaction below.
    if (handThrownArrow) {
        await pline(
            `You aren't wielding a bow, so you throw your ${
                OBJECT_NAMES[item.otyp] || 'arrow'
            } by hand.`,
        );
    }

    for (let shot = 0; shot < volleyCount; shot++) {
        const shotResult = await throwOrdinaryObject({
            state: game,
            item,
            quantity: item.quantity ?? item.quan ?? 1,
            dx,
            dy,
            volley: { count: volleyCount, index: shot + 1, objectType: item.otyp },
        });
        if ('heroDied' in shotResult && shotResult.heroDied) return;
        await reportHeroEncumbrance(game);
        if (game.program_state?.gameover) break;
        if ('stopVolley' in shotResult && shotResult.stopVolley) break;
    }
    game.context.move = 1;
}

async function openLockedDoor(x: number, y: number): Promise<boolean> {
    await pline('This door is locked.');
    const flags = autoUnlockFlags(game);
    if (!flags) return Boolean(game.context.move);
    game.u.dz = 0;
    const tool = flags & AUTOUNLOCK_APPLY_KEY ? autokey(true) : null;
    if (tool) return pickLock(tool, { target: { x, y } });
    return Boolean(game.context.move);
}

// C ref: hack.c:domove_fight_empty(). Forced attacks at the map edge and
// ordinary moves into remembered invisible-monster knowledge converge here.
// Both spend the action without entering terrain movement; only the
// remembered-invisible path is excluded by nopick.
async function fightEmptyDestination(x: number, y: number): Promise<boolean> {
    requirePlayingGame(game);
    const offEdge = !isok(x, y);
    const loc = offEdge ? null : game.level.requireAt(x, y);
    const glyph = offEdge ? null : glyphAt(x, y);
    const forcefight = !!game.context.forcefight;
    const rememberedInvisible = glyph?.kind === 'invisible';
    if (!forcefight
        && (!rememberedInvisible || monsterAtPosition(game.level, x, y)
            || game.context.nopick)) return false;

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
    let obstacle: GameObject | undefined;
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
                    attackMonster: monster => attackHostileMonster(monster, monster.mx, monster.my),
                    payShopkeeper: dopay,
                });
                return true;
            }
        }
        unmapObject(x, y);
        if (obstacle) map_object(obstacle, true);
        newsym(x, y);

        if (obstacle) {
            target = simpleObjectNameWithArticle(obstacle, game);
        } else if (underwater && !isPoolAt(x, y, game)) {
            target = Is_waterlevel(game.u.uz) && loc.typ === AIR ? 'an air bubble' : 'nothing';
        } else if (solid) {
            if (loc.seenv || IS_STWALL(loc.typ) || loc.typ === SDOOR || loc.typ === SCORR)
                target = `the ${terrain_glyph(loc, x, y).terrainName}`;
        } else {
            target = 'thin air';
        }
    }
    const manner = obstacle || solid ? explosion ? 'futilely ' : 'harmlessly ' : '';
    await pline(`You ${manner}${explosion ? 'explode at' : 'attack'} ${target}.`);
    endVoluntaryMultiTurn(game);
    if (explosion) {
        wakeMonstersNear(game.u.ux, game.u.uy, 49, game);
        if ((await resolveHeroCombatExplosion(null, explosion, { state: game })).heroDied)
            return true;
        game.u.mh = -1;
        await returnHeroToHumanForm(game);
    }
    return true;
}

export function applyHeroLiquidEffects(
    publish: MessagePublisher = plineWithContinuation,
    { entry = 'spot-effects' }: { entry?: 'spot-effects' | 'float-down' | 'drown' } = {},
): Promise<LiquidEffectResult | null | undefined> {
    return heroLiquidEffects({
        publish, entry,
        chooseTeleportDestination: askTeleportDestination,
        applyLandingEffects: ({ from, to, pick = true }) => finishDestinationSpotEffects({
            oldx: from.x, oldy: from.y,
            newx: to.x, newy: to.y,
            explicitAttempt: false, publish, pick,
        }),
    });
}

// C spoteffects(TRUE) also applies when expulsion or a body change leaves
// the hero on the same square. It does not count as a movement attempt.
export async function applyHeroLocationEffects(
    publish: MessagePublisher = plineWithContinuation, { pick = true } = {},
): Promise<SpotEffectResult> {
    const { ux: x, uy: y } = game.u;
    return finishDestinationSpotEffects({
        oldx: x, oldy: y, newx: x, newy: y,
        explicitAttempt: false, publish, pick,
    });
}

// C hack.c:domove_core() common tail after the hero's coordinates have been
// committed.  Ordinary moves and pet displacement both pass through run
// termination, u_on_newpos/vision work, and spoteffects in this order.
async function finishMovedHero({
    oldx, oldy, newx, newy, loc, explicitAttempt, ballChainMove = null,
    trapOptions = {},
}: {
    oldx: number; oldy: number; newx: number; newy: number;
    loc: MapLocation | null | undefined;
    explicitAttempt: boolean;
    ballChainMove?: Awaited<ReturnType<typeof beginBallAndChainMove>>;
    trapOptions?: Parameters<typeof triggerHeroTrapAt>[2];
}): Promise<boolean> {
    const u = game.u;
    resetBulkTakeoff();
    resetPick();
    resetTrapSetting();
    // C hack.c:domove_core() sets this only in the common tail after map
    // coordinates changed.  The turn loop retains it through every global
    // allocation needed to settle this action, then clears it before the next
    // hero action begins.
    u.umoved = true;
    see_nearby_objects();
    await senseBuriedObjects();

    // An active non-travel run ends upon entering a doorway, obstruction, or
    // furniture square even when actor displacement, rather than the plain
    // terrain branch, performed the coordinate move.
    if (game._runState && game._runState.mode !== 8 && (loc?.typ === DOOR
        || IS_OBSTRUCTED(loc?.typ ?? STONE)
        || IS_FURNITURE(loc?.typ ?? STONE))) stopRun();

    // C trap.c:move_into_trap() skips domove_core()'s footstep disturbance.
    if (!trapOptions.failedUntrap
        && !propertyIsActive('levitation', game) && !propertyIsActive('flying', game)
        && !propertyIsActive('stealth', game)
        && (MONSTER_BODY_META[heroSpecies(game)]?.[0] ?? 0) >= 400)
        disturbBuriedZombies(u.ux, u.uy);

    await checkHeroLeashes(oldx, oldy);
    if (game.program_state.gameover) return true;
    game._domoveSucceeded = oldx !== newx || oldy !== newy;
    newsym(oldx, oldy);
    vision_recalc(1);
    await announceInvocationSquare();
    if (ballChainMove) await finishBallAndChainMove(ballChainMove);

    const finished = await finishDestinationSpotEffects({
        oldx, oldy, newx, newy, explicitAttempt, trapOptions,
    });
    if (finished.died) return true;
    if (finished.moved && explicitAttempt)
        maybeSmudgeEngravings(oldx, oldy, u.ux, u.uy);
    // C domove_core(): landing and pickup finish before nomul(-2).
    // A longer trap-induced delay survives, but its completion prose changes.
    if (ballChainMove?.causeDelay) await delayAfterDraggingBall();
    return true;
}

// C domove_core() applies the dragging delay even when a pet refuses the swap.
async function delayAfterDraggingBall(): Promise<void> {
    if ((game._helplessTurns ?? 0) <= 2) {
        game.u.invulnerable = false;
        game.u.usleep = 0;
        game.multi = 0;
        stopRun();
        game._cannedCommands = [];
        game._helplessTurns = 2;
    }
    game._helplessReason = 'dragging an iron ball';
    game._helplessDoneMessage = '';
    await captureRunmodeDelay(
        game, true, game.moves || 0,
        { preservePhysicalTopline: true },
    );
}

// C hack.c:domove() clears kickedloc after even an unsuccessful attempt.
async function domove(dx: number, dy: number, explicitAttempt = true): Promise<boolean> {
    game._domoveSucceeded = false;
    const moved = await domoveCore(dx, dy, explicitAttempt);
    if (!game.program_state.gameover) {
        if (game._domoveSucceeded) maybeAdjustHeroBubble();
        game._kickedLoc = null;
        game._movementAttempt = null;
    }
    return moved;
}

// C hack.c:move_out_of_bounds(). A failed step takes no time; a forced
// attack still spends the action against an unknown obstacle.
async function moveOutOfBounds(x: number, y: number): Promise<boolean> {
    if (game.context.forcefight) return fightEmptyDestination(x, y);
    if (game.flags.mention_walls) {
        let { dx = 0, dy = 0 } = game.u;
        if (dx && dy) {
            // Keep both directions only when both coordinates hit a limit.
            if (isok(x, game.u.uy)) dx = 0;
            else if (isok(game.u.ux, y)) dy = 0;
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
async function bumpIntoMonster(monster: Monster, x: number, y: number): Promise<boolean> {
    if (!game.context.nopick || game.context.travel) return false;
    const glyph = glyphAt(x, y);
    if (!canSpotMonster(monster)
        && glyph?.kind !== 'invisible' && glyph?.kind !== 'warning') return false;

    if (M_AP_TYPE(monster)
        && !(game.u.protectionFromShapeChangers || game.protectionFromShapeChangers)
        && !canSenseMonster(monster)) {
        await stumbleOntoMimic(monster);
    } else if (monster.mpeaceful && !heroIsHallucinating(game)) {
        await plineWithContinuation(`Pardon me, ${monsterName(monster, { article: 'none', exact: true })}.`);
    } else {
        await plineWithContinuation(`You move right into ${monsterName(monster)}.`);
    }
    return true;
}

// C hack.c:u_rooted(). An immobile form may attack but cannot take a step.
async function rootedHeroCannotMove(): Promise<boolean> {
    if (MONSTER_MOVE[heroSpecies(game)] !== 0) return false;
    const inPlace = game.u.levitating || Is_airlevel(game.u.uz) || Is_waterlevel(game.u.uz);
    await plineWithContinuation(`You are rooted ${inPlace ? 'in place' : 'to the ground'}.`);
    endVoluntaryMultiTurn(game);
    return true;
}

// C display.h:_is_safemon(). Recheck after movement effects, which can
// change the monster or the hero's ability to recognize it.
function heroMayDisplaceMonster(monster: Monster): boolean {
    const u = game.u;
    return (game.flags.safe_dog ?? true) && !!monster.mpeaceful
        && canSpotMonster(monster) && !(u.confusionTurns ?? 0)
        && !heroIsHallucinating(game) && !u.stunned && !(u.stunnedTurns ?? 0);
}

async function domoveCore(dx: number, dy: number, explicitAttempt: boolean): Promise<boolean> {
    requirePlayingGame(game);
    const u = game.u;
    // C cmd.c:set_move_cmd() persists the requested command vector before
    // domove_core() can return early.  Death cleanup and several combat paths
    // deliberately reuse this global direction after the movement attempt.
    u.dx = dx;
    u.dy = dy;
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
        } else {
            await pline("You don't have enough stamina to move.");
            // exercise() suppresses physical attributes while polymorphed.
            if (!polymorphed) await exerciseAttribute(A_CON, false);
        }
        stopRun(game);
        // carrying_too_much() returns from domove_core() without clearing
        // context.move, so the failed step still spends the hero action.
        return true;
    }
    // C domove_core(): every direction attacks u.ustuck while swallowed.  It
    // zeroes the requested vector and follows the normal hero-melee owner at
    // the swallower's shared square; terrain and impaired movement are not
    // consulted.
    if (u?.uswallow && u.ustuck && !u.ustuck.dead) {
        const monster = u.ustuck;
        // C domove_core() zeroes the vector before attacking the swallower.
        u.dx = u.dy = 0;
        u.ux0 = u.ux;
        u.uy0 = u.uy;
        u.ux = monster.mx;
        u.uy = monster.my;
        return attackHostileMonster(monster, monster.mx, monster.my);
    }
    if (await airTurbulenceStopsHero()) return true;
    checkSlipperyIce();
    // C hack.c:impaired_movement() always checks Confusion before deriving
    // the destination.  A nonzero rn2(5) keeps the requested direction; on
    // impairment, confdir(TRUE) chooses cardinals first and retries only an
    // out-of-bounds square or rock this body cannot traverse.
    const confused = (u?.confusionTurns || 0) > 0;
    const stunned = !!(u?.stunned || (u?.stunnedTurns || 0) > 0);
    if (stunned || (confused && rn2(5) === 0)) {
        let found = false;
        for (let tries = 0; tries <= 50; tries++) {
            confusePromptDirection(u, true);
            dx = u.dx ?? 0;
            dy = u.dy ?? 0;
            const x = u.ux + dx, y = u.uy + dy;
            if (!isok(x, y) || heroBadRock(game, x, y)) continue;
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
    if (await waterTurbulenceStopsHero()) return true;
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
    const newx = u.ux + dx;
    const newy = u.uy + dy;

    if (!isok(newx, newy)) return moveOutOfBounds(newx, newy);
    if (game.context.run) {
        const trap = knownRunTrap(newx, newy, game);
        const liquid = heroIsBlind(game) && runLiquidIsDangerous(newx, newy, game);
        if (trap || liquid) {
            const stopBeforeStep = game.context.run >= 2;
            if (stopBeforeStep) {
                if (trap) await announceRunTrap(trap, game);
                else await announceRunLiquid(newx, newy, game);
            }
            endVoluntaryMultiTurn(game);
            if (stopBeforeStep) return false;
        }
    }
    if (await escapeFromStickyMonster(newx, newy)) return true;
    const loc = game.level?.at(newx, newy);

    // C domove_core() resolves a destination monster before test_move()
    // applies terrain restrictions.  In particular, the hero can attack
    // diagonally across an intact doorway even though moving through that
    // same doorway would be rejected.
    const monster = game.level ? monsterAtPosition(game.level, newx, newy) : null;
    const hiddenCeilingMonster = monster?.mundetected && !game.context.forcefight
        && !canSenseMonster(monster)
        && !((MONSTER_FLAGS1[monster.mnum] ?? 0) & 0x80)
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
        if (game.context.run && !safeMonster
            && canSpotMonster(monster)) {
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
        // step after the intervening monster phase.
        if (!safeMonster && game._runState) stopRun(game);
        if (await bumpIntoMonster(monster, newx, newy)) return true;
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
            await settleBeastHeroDisplacement(monster, game);
            if (game.program_state.gameover) return true;
            return finishMovedHero({ oldx, oldy, newx, newy, loc, explicitAttempt, ballChainMove });
        }
        if (safeMonster && artifactById(game.uwep?.oartifact, game)?.name !== 'Stormbringer') {
            // C ref: hack.c do_attack()/domove(): a tame monster normally
            // yields to the hero, and ordinary peacefuls share the same
            // displacement path.  Only tame actors flee after refusal.
            const tame = !!(monster.pet || monster.mtame);
            const blocked = heroIsPunished() || rn2(7) === 0
                || (!!monster.wormno && ['baby long worm', 'long worm', 'long worm tail']
                    .includes(MONSTER_NAME[monster.mnum] ?? ''))
                || (IS_OBSTRUCTED(game.level.requireAt(u.ux, u.uy).typ)
                    && !((MONSTER_FLAGS1[monster.mnum] ?? 0) & 0x00000008));
            const inShop = !blocked && roomsAt(game.level, monster.mx, monster.my, SHOPBASE)
                .some(roomno => tendedShop(roomForRoomno(game.level, roomno), game));
            if ((blocked || inShop) && monster.isshk
                && !game.context.travel && !game.context.run) {
                await dopay();
                return true;
            }
            if ((blocked || inShop) && tame) {
                const flight = await makeMonsterFlee(monster, {
                    turns: rnd(6), announce: false,
                });
                if (flight.heroDied) return true;
            }
            if (blocked || inShop) {
                // C uhitm.c do_attack(): y_monnam(), capitalized.
                const displayName = monsterName(monster, {
                    state: game, article: 'your', capitalized: true,
                });
                await plineWithContinuation(`You stop.  ${displayName} is in the way!`);
                stopRun(game);
                return true;
            }
            if (monster.mfrozen || monster.msleeping || !monster.mcanmove
                || ((MONSTER_MOVE[monster.mnum] ?? 0) === 0 && rn2(6))) {
                await plineWithContinuation(`${monsterName(monster, { state: game, capitalized: true })} doesn't seem to move!`);
                stopRun(game);
                return true;
            }
            // C do_attack() returns FALSE here: a yielding monster takes
            // the same DO_MOVE checks as an unoccupied destination.
        } else {
            // attack() runs the whole attack_checks() reveal sequence: the
            // unseen-monster marker, the disguised-mimic stumble, and the
            // hidden-under reveal, each able to consume the move on its own.
            // C gb.bhitpos is the struck square, even for a worm tail.
            const verdict = await prepareAppliedWeaponAttack(
                monster, game.uwep ?? null,
                { state: game, struckAt: { x: newx, y: newy } });
            if (!verdict.proceed)
                return verdict.spentTime;
            if (await attackHostileMonster(monster, newx, newy, {
                confirmationOverridden: verdict.confirmationOverridden ?? false,
            })) return true;
        }
    }

    // domove_core() snapshots the origin before test_move().  This includes
    // the terminal blocked step of a Shift-run, which is why later monster
    // missile logic can observe the hero as stationary rather than retreating.
    u.ux0 = u.ux;
    u.uy0 = u.uy;

    if (await fightEmptyDestination(newx, newy))
        return true;

    if (await ridingPreventsMovement()) {
        stopRun(game);
        return true;
    }

    if (await rootedHeroCannotMove()) return true;

    if (heroTestMove(newx, newy) && !await confirmHeroStep(newx, newy)) return false;

    if (!await heroCanMoveFromTrap(newx, newy)) return true;

    // C test_move(DO_MOVE) learns obstructed terrain by touch before trying
    // to pass through it, open a door, or reject a diagonal doorway entry.
    if (loc && heroIsBlind(game) && (IS_OBSTRUCTED(loc.typ)
        || loc.typ === DOOR && (!!(loc.doormask & (D_CLOSED | D_LOCKED))
            || !!(dx && dy) && !heroPassesWalls(game)
                && blocksDiagonalDoor(null, loc)))) {
        feel_location(newx, newy);
    }

    if (!await heroCanEnterIronBars(newx, newy, game)) return false;

    const formFlags = MONSTER_FLAGS1[heroSpecies(game)] ?? 0;
    const tunnels = !!(formFlags & M1_TUNNEL) && !(formFlags & M1_NEEDPICK);
    if (loc && (IS_OBSTRUCTED(loc.typ)
        || loc.typ === DOOR && !!(loc.doormask & (D_CLOSED | D_LOCKED)))
        && !heroCanPassWallAt(game, newx, newy) && !heroOozesUnderDoor(loc)) {
        if (u.uinwater || game.underwater) {
            await pline('There is an obstacle there.');
            return false;
        }
        if (tunnels && await continueChewingTerrain(newx, newy, game)) return false;
    }

    const oozingUnderDoor = heroOozesUnderDoor(loc);
    if (oozingUnderDoor) await pline('You ooze under the door.');
    if (loc?.typ === DOOR && (loc.doormask & (D_CLOSED | D_LOCKED))
        && !heroCanPassWallAt(game, newx, newy) && !oozingUnderDoor) {
        const fumbling = !!(u?.fumbling || (u?.fumblingTurns || 0) > 0);
        const blind = !!(u?.blind || (u?.blindTurns || 0) > 0);
        const dexterity = currentAttribute(A_DEX);
        const autoopenEligible = (game.flags?.autoopen ?? true)
            && !game._runState
            && !confused
            && !stunned
            && !fumbling;
        // C test_move(DO_MOVE) suppresses auto-open while running, Confused,
        // Stunned, or Fumbling, and also when the option is disabled.  The
        // resulting orthogonal fallback is independently classified: Blind,
        // Stunned, low Dexterity, or Fumbling spends the turn on an "Ouch!"
        // bump, while Confusion by itself only reports a closed door.
        if (!autoopenEligible) {
            // test_move(DO_MOVE) only reports the closed-door message for an
            // orthogonal attempt.  A diagonal attempt which reaches this
            // fallback is rejected silently before the intact-door check.
            if (!dx || !dy) {
                if (blind || stunned || dexterity < 10 || fumbling) {
                    await pline('Ouch!  You bump into a door.');
                    await exerciseAttribute(A_DEX, false);
                    // C sets context.move despite returning false from
                    // test_move(), then nomul(0).  `true` is this port's
                    // scheduler-facing "time elapsed" result; the hero's
                    // coordinates remain unchanged.
                    stopRun(game);
                    game.context.move = 1;
                    return true;
                }
                await pline('That door is closed.');
            }
            return false;
        }
        await doopen(newx, newy);
        game.context.move = 0;
        return false;
    }

    // C test_move() rejects an obstructed destination before it evaluates
    // tight-diagonal shoulders.  A boulder on ordinary floor is not terrain
    // obstruction, so that case still reaches cant_squeeze_thru() below
    // before moverock().
    if (blocksMove(newx, newy) && !heroCanPassWallAt(game, newx, newy)
        && !oozingUnderDoor) {
        const weapon = game.uwep || game.u.uwep;
        if (loc && IS_OBSTRUCTED(loc.typ) && game.flags?.autodig
            && !game._runState && !game.context.nopick && weapon && isPick(weapon)
            && !(game.underwater || u.uinwater)) {
            u.dz = 0;
            const result = await applyPickAxeDirection(weapon, {
                state: game,
                attackMonster: (target: Monster) => attackHostileMonster(
                    target, target.mx, target.my,
                ),
                payShopkeeper: dopay,
            });
            if (result.died) return false;
            game.context.move = 0;
            return false;
        }
        if (game.flags?.mention_walls) {
            const obstruction = loc?.typ === STONE
                ? 'solid stone'
                : loc?.typ === TREE ? 'a tree'
                    : loc && IS_WALL(loc.typ) ? 'a wall' : '';
            const message = obstruction ? `It's ${obstruction}.` : '';
            if (message) await pline(message);
        }
        game.context.move = 0;
        return false;
    }

    // C ref: hack.c test_move().  Once the closed-door/autoopen path has had
    // its opportunity, intact open and doorless doorways only allow
    // orthogonal entry/exit.
    if (await rejectHeroDiagonalDoorway(dx, dy, loc)) return false;

    if (await rejectTightHeroDiagonal(dx, dy)) return false;

    if (!(dx && dy && heroBadRock(game, u.ux, newy) && heroBadRock(game, newx, u.uy))
        && wormCrossesBetween(u.ux, u.uy, newx, newy, game)) {
        const worm = monsterAtPosition(game.level, u.ux, newy);
        if (!worm) throw new Error('A crossing worm must occupy the adjacent square.');
        await pline(`${monsterName(worm, { state: game, article: 'your', capitalized: true })} is in your way.`);
        game.context.move = 0;
        return false;
    }

    const boulder = heroPassesWalls(game) && !game.level.flags.sokoban_rules ? null
        : (game.level.objects[newx]?.[newy] || []).find(object => object.otyp === BOULDER);
    const hallucinating = heroIsHallucinating(game);
    if (boulder && (game._runState?.mode ?? 0) >= 2
        && !game.blind && !hallucinating
        && !heroCouldMoveOntoBoulder(newx, newy)) {
        if (game.flags?.mention_walls)
            await pline('A boulder blocks your path.');
        stopRun(game);
        game.context.move = 0;
        return false;
    }
    if (boulder) {
        if (tunnels && !game.level.flags.sokoban_rules) {
            if (await continueChewingTerrain(newx, newy, game)) return false;
        } else {
            game.context.move = 0;
            const pushed = await pushBouldersAt(newx, newy, dx, dy);
            if (game.program_state.gameover) return true;
            if (!pushed) {
                return Boolean(game.context.move);
            }
        }
    }

    // C hack.c:swim_move_danger().  Known walking equipment and the swim
    // confirmation option decide whether a visible liquid edge stops us.
    // The request-menu (`m`) prefix deliberately accepts that step.
    if (heroShouldAvoidLiquid(newx, newy)) {
        const liquid = waterbodyName(newx, newy);
        const warning = `You avoid ${ingSuffix(heroLocomotion('step'))} into the ${liquid}.`;
        if (game.flags?.tips !== false && !game._tipSwimShown) {
            await promptKey(`${warning}--More--`);
            game._tipSwimShown = true;
            await pline("(Tip: use 'm' prefix to step in if you really want to.)");
        } else {
            await plineWithContinuation(warning);
        }
        game.context.move = 0;
        return false;
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
    await moveSteedWithHero();
    if (destinationMonster && heroMayDisplaceMonster(destinationMonster)
        && !hiddenCeilingMonster) {
        const monster = destinationMonster;
        // C drag_ball() can pull the hero back before the swap check.
        // A refused swap still completes ball placement and its delay.
        if (await petRefusesHeroSwap(monster, game)) {
            u.ux = oldx; u.uy = oldy;
            if (u.usteed) {
                u.usteed.mx = oldx;
                u.usteed.my = oldy;
            }
            // C domove_core() resets occupations after restoring the
            // hero's position, even when a peaceful refuses the swap.
            resetBulkTakeoff();
            resetPick();
            resetTrapSetting();
            await finishBallAndChainMove(ballChainMove);
            if (ballChainMove?.causeDelay) await delayAfterDraggingBall();
            return true;
        }
        monster.mx = oldx; monster.my = oldy;
        // C domove_swap_with_pet() redraws both actors before the swap
        // announcement can flush the map or pause for acknowledgment.
        newsym(newx, newy);
        newsym(oldx, oldy);
        // C hack.c domove_swap_with_pet(): x_monnam() with "your" for
        // pets, "the" for unnamed common species, and a "peaceful"
        // adjective for non-pets.
        const givenName = !!MGIVENNAME(monster);
        const swapName = monsterName(monster, {
            state: game,
            article: monster.mtame ? 'your'
                : !givenName && !((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_PNAME)
                    ? 'the' : 'none',
            adjective: monster.mpeaceful && !monster.mtame ? 'peaceful' : '',
            suppressSaddle: givenName,
        });
        await plineWithContinuation(`You ${
            monster.mpeaceful ? 'swap places with' : 'frighten'} ${swapName}.`);
    }
    return finishMovedHero({
        oldx, oldy, newx, newy, loc, explicitAttempt, ballChainMove,
    });
}
