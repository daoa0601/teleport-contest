import { monsterHiddenConditions } from './monster_status.js';
import { visibleRegionAt } from './regions.js';
import type { ChoiceMenuItem } from './windows.js';
import { wizIntrinsic } from './wizard_intrinsics.js';
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
import type {
    CannedCommand, CommandBinding, NativeCommand, RunState, TravelRunState,
} from './command_types.js';
import { bookCursed, continueSpellbookStudy } from './spellbook_study.js';
import { grantMonsterWish } from './potion_occupants.js';
import { quaff } from './quaff.js';
import { tameMonster } from './monster_taming.js';
import { setMonsterMalign } from './monster_alignment.js';
import { jumpHero } from './jumping.js';
import { feel_location } from './display.js';
// cmd.js — Command dispatch and movement.
// C ref: cmd.c rhack(), hack.c domove().

import { game, requireGameLevel, requirePlayingGame, requireInitializedGame } from './gstate.js';
import { requireInitializedHero } from './hero_types.js';

import { fruitName } from './fruit.js';
import { encyclopediaEntries } from './encyclopedia.js';
import { waterbodyName } from './terrain_name.js';
import { iceDescriptionAt } from './dungeon_feature.js';
import { CmapSymbol, cmapToGlyph } from './glyph_numbers.js';
import { isGrayStone, isWeaponTool } from './object_properties.js';
import { applySuggestion } from './apply_selection.js';
import { flipThroughBook } from './book_flip.js';
import { flipCoin } from './coin_flip.js';
import { useGrayStone } from './gray_stone.js';
import { useMirror } from './mirror.js';
import { useCamera } from './camera.js';
import { useTowel } from './towel.js';
import { useBell } from './apply_bell.js';
import { breakWand } from './wand_break.js';
import { heroStatusLine } from './hero_status.js';
import { speakArtifact } from './artifact_speech.js';
import { lightCocktail, useCandelabrum, useCandle, useLamp } from './apply_light.js';
import { useWhistle } from './whistle.js';
import { retouchHeroObject } from './hero_retouch.js';
import { GETOBJ_DOWNPLAY, GETOBJ_EXCLUDE, GETOBJ_EXCLUDE_INACCESS, GETOBJ_SUGGEST } from './const.js';
import { senseBuriedObjects } from './buried_object.js';
import { monsterInstanceDisplayName, monsterName, shopkeeperName } from './monster_name.js';
import { attackHostileMonster } from './hero_melee.js';
import { prepareAppliedWeaponAttack } from './hero_attack_preflight.js';
import { beastChoosesHeroDisplacement, settleBeastHeroDisplacement } from './hero_beast_displacement.js';
import { stumbleOntoMimic } from './mimic.js';
import { monsterHasMapPosition, monsterAtPosition } from './monster_location.js';
import { SHOP_TYPES } from './shop_data.js';
import { observeBucForNaming } from './object_knowledge.js';
import {
    minimalObjectName, objectNameIsPlural, observeDistantObjectForNaming,
    observeObjectForNaming, ownedObjectName, simpleObjectNameWithArticle,
} from './objnam.js';
import { woundHeroLegs } from './hero_legs.js';
import { makeMonsterFlee } from './monster_flee.js';
import { descendFromLevitation } from './levitation_commands.js';
import { endVoluntaryMultiTurn, resetCommandVariables } from './command_state.js';
import { propertyIsActive } from './properties.js';
import {
    addPickedInventoryObject, pickupAtHero, pickupObjectClass, pickupClassOrder,
} from './pickup.js';
import { gotoLevel } from './level_change.js';
import { levelTeleport } from './level_teleport.js';
import { confirmHeroStep } from './hero_step_confirmation.js';
import { monsterPassesBars } from './monster_movement_traits.js';
import { heroCanEnterIronBars } from './iron_bars_meal.js';
import { wormCrossesBetween } from './monster_worm.js';
import {
    floorObjectDescription,
} from './floor_object_display.js';
import { loseHeroHp } from './hero_damage.js';
import { poisonHeroStrengthAndHp } from './poison.js';
import { isContainer, useContainer } from './container.js';
import { adjustHeroAlignment } from './alignment.js';
import { doOptions } from './options.js';
import {
    blocksDiagonalDoor, blocksMove, escapeFromStickyMonster, heroBadRock, heroCanPassWallAt, heroLiquidEffects,
    heroShouldAvoidLiquid,
    heroTightDiagonalReason,
} from './hack.js';
import { commandExecutionKey, controlRushDirection, promptedDirectionKey, visibleCommandKey } from './command_keys.js';
import { NATIVE_COMMAND_FLAGS, NATIVE_COMMANDS } from './command_data.js';
import { stopHeroOccupation } from './occupation.js';
import { canSelectOff, continueBulkTakeoff, takeOffAll } from './bulk_takeoff.js';
import { resetBulkTakeoff, TAKEOFF_ORDER, takeoffSlotObject } from './takeoff_state.js';
import { currentLuaLifecycle } from './lua/lifecycle.js';
import { nextObjectId } from './ident.js';
import { clearCommandKeys, nhgetch, queueCommandKeys, takeCommandKey } from './input.js';
import { readCommandInput } from './command_input.js';
import {
    chooseInventoryObject, compactInventoryLetters, promptInventoryObject,
} from './inventory_prompt.js';
import { AT_EXPL, AT_KICK } from './monster_attack_types.js';
import {
    directionAssistPage, promptKey, readDirectionKey,
    restoreCommandMap,
} from './tty_prompts.js';
import {
    getLine, paranoidQuery, promptYesNo, promptYesNoQuit,
} from './query.js';
export { getLine, promptYesNo, promptYesNoQuit } from './query.js';
import {
    objectTypeCallNoun,
} from './object_call.js';
import { displayLiquidName, displayMessageWindow,
    newsym, feel_newsym, flushPendingTopline, flush_screen, pline, plineWithContinuation, moreUntilDismissed, docrt,
    bot, terrain_glyph, glyphAt, canSeeMonster, canSpotMonster, canSenseMonster,
    monsterHasWarningProjection, see_nearby_objects, show_glyph_cell, swallowed,
    randomDisplayMonsterName, randomDisplayMonsterSubject, see_monsters, see_objects,
    see_traps, transientObjectGlyph, map_invisible, unmap_invisible, map_object, unmapObject,
} from './display.js';
import { cansee, couldsee, vision_note_blocker_change, vision_recalc, vision_reset } from './vision.js';
import {
    lightWieldedArtifact,
    transformMagicLampToOilLamp,
} from './light.js';
import {
    dozap,
} from './zap.js';
import {
    bucAdjectiveForName, consumeInventoryItem, ddoinv, dolook, fullyIdentifyObject,
    inventoryItemDescription, inventoryPrimaryHandDetail, selectInventoryObject,
} from './invent.js';
import type { InventoryAction } from './invent.js';
import {
    castSpell, docast, dovspell,
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
import { dodiscovered } from './o_init.js';
import { doattributes, doconduct } from './insight.js';
import { doextversion } from './extversion.js';
import { dosearch, mapLevel } from './detect.js';
import { detectMonsters } from './magic_detection.js';
import { abusePetAfterHeroHit } from './dog.js';
import {
    continueWipingFace, donull, dowipe, threateningMonsterNearby,
} from './do.js';
import {
    ATR_INVERSE, ATR_NONE, showChoiceWindow, showMultiSelectWindow,
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
import {
    moveObject, placeCreatedObject,
} from './floor_object.js';
import { makemonNear, mkgold, mksobj, rndClass } from './mklev.js';
import {
    level_difficulty, recordMappedOverviewState, specialDisplayName, specialPrototypeAt,
} from './dungeon.js';
import { addInventoryItem, assignInventoryLetter } from './u_init.js';
import { objectQuantity, rejoinObjectStack, splitObjectStack } from './object_stack.js';
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
import { hitMonsterWithThrownObject } from './hero_ranged_attack.js';
import { chooseHeroVolleyCount } from './hero_multishot.js';
import {
    captureThrownObjectFlight, detachThrownUnit, finishHeroThrownObjectLanding,
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
import { touchArtifactByHero } from './artifact_touch.js';
import {
    SLING, BULLWHIP, GRAPPLING_HOOK, CREAM_PIE, EGG, LUMP_OF_ROYAL_JELLY, LOCK_PICK,
    CREDIT_CARD, STETHOSCOPE, LOADSTONE, GOLD_PIECE, BOULDER, ROCK, DILITHIUM_CRYSTAL,
    LUCKSTONE, TOUCHSTONE, LARGE_BOX, CHEST, ICE_BOX, SACK, OILSKIN_SACK,
    BAG_OF_HOLDING, BRASS_LANTERN, OIL_LAMP, MAGIC_LAMP, STATUE, RIN_PROTECTION,
    BANANA, MIRROR, TIN_WHISTLE, MAGIC_WHISTLE, EUCALYPTUS_LEAF,
    BELL, BELL_OF_OPENING, EXPENSIVE_CAMERA, TIN_OPENER,
    TALLOW_CANDLE, WAX_CANDLE, CANDELABRUM_OF_INVOCATION, POT_OIL,
    RIN_CONFLICT, MEAT_RING,
    LENSES, BLINDFOLD, TOWEL, FUMBLE_BOOTS, KICKING_BOOTS, MAGIC_MARKER, UNICORN_HORN,
    SHIELD_OF_REFLECTION, AMULET_OF_YENDOR,
    AMULET_OF_STRANGULATION, FAKE_AMULET_OF_YENDOR, SPE_NOVEL, OBJECT_DELAY,
    OBJECT_DESCRIPTIONS, OBJECT_MATERIAL, OBJECT_NAMES, OBJECT_WEIGHT, OBJECT_SUBTYPE,
} from './object_data.js';
import {
    CLR_WHITE, NO_COLOR,
} from './terminal.js';
import {
    MONSTER_COLOR, MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_LEVEL, MONSTER_MOVE, MONSTER_NAME,
    MONSTER_SIZE, MONSTER_SYMBOL, MONSTER_ALIGNMENT, MONSTER_ATTACKS, requireMonsterData,
} from './monster_data.js';
import { monsterStatusLine } from './monster_status.js';
import { nameToMonster } from './mondata.js';
import {
    addExperience, checkExperienceLevel, gainExperienceLevel, loseHeroExperience,
} from './exper.js';
import {
    removeHeroAccessory, wearHeroAccessory,
} from './accessory.js';
import { heroIsStrangled } from './hero_strangulation.js';
import { heroIsBreathless, heroPassesWalls, heroSpecies } from './hero_species.js';
import { disturbBuriedZombies } from './object_impact.js';
import { checkSlipperyIce } from './fumbling.js';
import { MONSTER_BODY_META } from './monster_data.js';
import { heroCanOoze } from './monster_perception.js';
import { isPoolAt } from './terrain_properties.js';
import { drawbridgeUnderlyingType } from './drawbridge_terrain.js';
import { dosave } from './save.js';
import { captureRunmodeDelay, startRun, stopRun } from './runmode.js';
import {
    announceDisplacementLoss, applyArmorOnEffects, armorOnIdentifiesType, armorSlotFor,
    armorSimpleName, armorOffMessage,
    findArmorClass, heroIsDisplaced,
    objectErosionKind, objectErosionMessage, removeHeroArmor, wearHeroArmor,
} from './armor.js';
import {
    findMonsterArmorClass,
    nameMonsterForCreationArmorChecks,
} from './monworn.js';
import { finishHeroMonsterKill, finishHeroMonsterKillOutcome } from './hero_monster_death.js';

import { wakeMonstersNear } from './monster_wake.js';
import {
    aggravateMonsters, angerAttackedMonster,
    wakeAttackedMonster,
} from './monster_anger.js';
import { publishMonsterNoise } from './monster_sound.js';
import { doride, moveSteedWithHero, ridingPreventsMovement, stuckSteed } from './steed.js';
import { currentAttribute, currentStrength, exerciseAttribute, exerciseWisdom } from './attrib.js';
import { spendHeroNutrition, updateHeroHunger } from './hunger.js';

import { continueForceLock, doforce } from './lock.js';
import { doUntrap } from './untrap.js';
import { dosit } from './sit.js';
import { continueEngraving, doengrave } from './engrave_command.js';

import { heroCanMoveFromTrap, triggerHeroTrapAt } from './hero_traps.js';
import { activateStatueTrapAt } from './statue_trap.js';
import {
    applyDippedCoinFate, applyFountainDemonActor,
    applyFountainGemDiscovery, applyFountainNymphActor,
    applyFountainSnakeActors,
    resolveDippedBucFate, resolveDippedSensationFate,
} from './fountain_effects.js';
import { dryFountainAt, gushForthFromFountain } from './fountain.js';
import { heroArmName, heroHandName, heroNeckName } from './body_parts.js';
import { armorUsesPairGrammar, withIndefiniteArticle, makePlural } from './object_grammar.js';
import { objectWearMessage } from './object_wear_message.js';
import { isWetTowel, willWeld } from './weapon_type.js';
import { announceWeaponWeld, explainTwoWeaponEnd, refuseWeldedPrimary } from './weapon_feedback.js';
import { dropCursedSecondaryWeapon, toggleTwoWeaponCombat } from './two_weapon.js';
import { dist2, distmin, dungeonDepth } from './hacklib.js';
import { triggerBoobyTrap } from './booby_trap.js';
import { addShopDamage, payForShopDamage } from './shop_damage.js';
import { convertSecretDoor } from './detect.js';
import { roomForRoomno, roomsAt } from './room.js';
import {
    learnObjectType, objectClassForType, recordObjectCall, recordObjectEncounter,
    recordObjectKnowledge,
} from './object_knowledge.js';
import {
    encumbranceLabel, encumbranceMessage, exceedsActionCapacity, nearCapacity,
    invWeight, OVERLOADED, SLT_ENCUMBER,
} from './weight.js';
import { hiddenGold } from './gold.js';
import { makeWish } from './wish.js';
import { dopray } from './pray.js';
import { finishDestinationSpotEffects, finishTeleportArrival } from './location_effects.js';
import { dosacrifice } from './sacrifice.js';
import { detachHeroGold, heroGoldAmount, heroGoldObject, setHeroGoldAmount } from './hero_gold.js';
import {
    resolveDirectGoldThrow, resolveQuiveredGoldThrow,
} from './gold_throw.js';
import {
    heroIsBlind, heroIsHallucinating,
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
    objectOwnershipPrefix, chargeUnpaidUsage, checkSpecialRoom, carriedShopBill, minimumShopPurchase, objectTypeKnown,
    payShopDebt, settleCarriedShopBillItem, shopkeeperForHero, shopThankYouMessage,
    tendedShop,
} from './shk.js';
import {
    visiblePriestName,
} from './priest.js';
import { gameLogEvents } from './gamelog.js';
import { killerObjectName } from './objnam.js';
import { GRAVE } from './const.js';
import { disturbGrave } from './grave.js';
import { deleteEngravingAt, maybeSmudgeEngravings, wipeHeroEngraving } from './engrave.js';
import { canLetGo, finishInventoryRemoval } from './hero_inventory.js';
import { removeHeroEquipment } from './hero_equipment.js';
import {
    shouldShowGetposTip, showGetposTip, moveGetposCursor, selectMapPosition,
} from './getpos.js';
import { chatWithQuestLeader, onQuestStart, okToQuest } from './quest.js';
import {
    performPetRangedAttack, resumeDeferredMonsterTrap, triggerImmediateMonsterTrap,
} from './monmove.js';
import { hurtleHero, kickRecoilRange } from './hero_hurtle.js';

import type { HeroMonsterKillOptions } from './hero_monster_death.js';

import { announceInvocationSquare } from './invocation.js';
import {
    abuseKickedPet, kickConductViolation, levitatingKickMisses,
    prepareKick, prepareKickDamage, rollKickDamage, tryKickEvasion,
    tryKickReel,
} from './monster_kick.js';
import { kickFloorObject } from './object_kick.js';
import { kickWithMonsterForm } from './hero_form_kick.js';
import {
    bringLeashedFollowers, heroTeleportDestinationOk, moveHeroByTeleport,
    randomMonsterRelocation, safeTeleportDestination,
} from './teleport.js';
import { monsterTeleportRestricted } from './teleport_rules.js';
import { removeWishGrantingMonster } from './monster_departure.js';
import {
    RLOC_MSG, A_CON, A_DEX, A_STR, A_WIS, BOLT_LIM, COLNO, ROWNO, STONE, SCORR, SDOOR, DOOR, CORR, ROOM,
    ICE, POOL, CLOUD, IRONBARS, FOUNTAIN, SINK, ALTAR, WATER, MOAT, LAVAWALL, TREE, D_NODOOR,
    D_BROKEN, D_ISOPEN, D_CLOSED, D_LOCKED, D_TRAPPED, SHOP_DOOR_COST, IS_WALL, IS_STWALL, IS_OBSTRUCTED, IS_FURNITURE,
    IS_AIR, IS_POOL, IS_LAVA, IS_ROOM, ZAP_POS, SQKY_BOARD, BEAR_TRAP, LANDMINE, FIRE_TRAP, PIT,
    SPIKED_PIT, TT_PIT, HOLE, TRAPDOOR, DART_TRAP, MAGIC_TRAP, TELEP_TRAP, LEVEL_TELEP, STATUE_TRAP, WEB,
    ANTI_MAGIC, G_GONE, ER_NOTHING, ER_DAMAGED, M_AP_MONSTER, M_AP_FURNITURE, M_AP_OBJECT, M_AP_TYPE,
    STRAT_WAITMASK, MM_NOEXCLAM, MM_NOMSG, SHOPBASE, ROOMOFFSET, F_LOOTED, In_endgame,
    Is_airlevel, Is_waterlevel, W_ARMOR, W_ACCESSORY, W_SADDLE, LOST_THROWN, WT_SPLASH_THRESHOLD,
    WT_SQUEEZABLE_INV, P_BOW, P_SLING, PARANOID_HIT, POLY_CONTROLLED, STR19, isok,
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
const M2_ROCKTHROW = 0x08000000;
const M1_HUMANOID = 0x00020000;
const MAT_GEMSTONE = 20;
const MAT_MINERAL = 21;

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

// C ref: hack.c:could_move_onto_boulder().  Travel planning is allowed to
// route through an ordinary boulder, then actual run-mode movement consults
// this capability before deciding whether to stop or enter/push the square.
export function heroCouldMoveOntoBoulder(sx: number, sy: number, g: GameState = game): boolean {
    const mnum = g.u.umonnum;
    if (heroPassesWalls(g)) return true;
    if (g.u?.usteed) return false;

    const flags2 = mnum === undefined ? 0 : MONSTER_FLAGS2[mnum] ?? 0;
    if (flags2 & M2_ROCKTHROW) {
        return !g.u?.dx || !g.u?.dy
            || !(IS_OBSTRUCTED(requireGameLevel(g).at(g.u.ux, sy)?.typ ?? STONE)
                && IS_OBSTRUCTED(requireGameLevel(g).at(sx, g.u.uy)?.typ ?? STONE));
    }
    if (heroIsVerySmall(g)) return true;
    return invWeight(g) <= -WT_SQUEEZABLE_INV;
}

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
    const entryDoor = heroOozesUnderDoor(destination) ? null : destination;
    if (!dx || !dy || heroPassesWalls(game)
        || !blocksDiagonalDoor(game.level?.at(game.u.ux, game.u.uy), entryDoor)) return false;
    const entering = blocksDiagonalDoor(null, entryDoor);
    if (game.flags.mention_walls || entering && (game.u.uinwater || game.underwater)) {
        await plineWithContinuation(`You can't move diagonally ${entering ? 'into' : 'out of'} an intact doorway.`);
    }
    game.context.move = 0;
    return true;
}

// C test_move(TEST_MOVE): confirmation tests obstacles without performing
// auto-open, boulder pushing, or the hero's eventual movement.
function heroCanConfirmStep(x: number, y: number): boolean {
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
    if (IS_POOL(typ) || IS_LAVA(typ)) return false;
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
        Math.abs(monster.mx - g.u.ux) <= 1
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

// Source-order subset of lookaround() for run mode 1.  It ignores rooms and
// rock, follows an unambiguous corridor bend, and lets domove() encounter an
// obstacle when the path does not turn.  Front monsters stop the run before
// an automatic attack, matching the C in-front check for every run mode.
export function lookaroundRun(state: RunState | null | undefined = game._runState, g: GameState = game): boolean {
    if (!state || state.mode === 8 || !g.u || !g.level) return false;
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

            const infront = x === targetX && y === targetY;
            const monster = g.level.monsters?.find(mon => monsterHasMapPosition(mon, g) &&
                mon.mx === x && mon.my === y);
            // hack.c:lookaround() considers an actor interesting only inside
            // its mon_visible() branch.  An invisible monster directly in
            // front must reach domove()/attack_checks(), which remembers the
            // unseen occupant instead of silently ending the run.
            const visibleMonster = monster
                && canSeeRunMonster(monster, monster.mx, monster.my, g);
            const visibleHostile = visibleMonster && !monster.pet
                && !monster.mpeaceful;
            if (visibleMonster && (infront
                || (state.mode !== 1 && visibleHostile))) return false;

            const loc = g.level.at(x, y);
            if (!loc) continue;
            const typ = loc.typ;
            if (typ === STONE) continue;
            if (x === u.ux - state.dx && y === u.uy - state.dy) continue;

            if (IS_OBSTRUCTED(typ) || typ === ROOM || IS_AIR(typ)
                || typ === ICE) continue;

            let corridorLike = false;
            if (typ === DOOR) {
                const closed = !!(loc.doormask & (D_CLOSED | D_LOCKED));
                if (closed) {
                    if (x !== u.ux && y !== u.uy) continue;
                    if (state.mode !== 1) return false;
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
            } else if (IS_POOL(typ) || IS_LAVA(typ)) {
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
            corrct++;
        }
    }

    if (!noturn && !m0 && i0
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
    if (!state || !lookaroundRun(state, g)) {
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
    if ('remaining' in occupation && occupation.remaining <= 0) {
        g._occupation = null;
        return false;
    }
    if (occupation.key === 'pick-lock') {
        occupation.usedtime = (occupation.usedtime ?? 0) + 1;
        if (occupation.usedtime > 50) {
            await pline('You give up your attempt at picking the lock.');
            await exerciseAttribute(A_DEX, true);
            g._occupation = null;
        } else if (rn2(100) < occupation.chance) {
            await pline('You succeed in picking the lock.');
            if (occupation.container) {
                occupation.container.olocked = !occupation.container.olocked;
                occupation.container.lknown = true;
            } else if (occupation.door && (occupation.door.doormask & D_TRAPPED)) {
                if (await triggerBoobyTrap('door', { bodypart: true, state: g })) return false;
                occupation.door.doormask = D_NODOOR;
                vision_note_blocker_change(occupation.x, occupation.y);
                if (roomsAt(g.level, occupation.x, occupation.y, SHOPBASE).length)
                    addShopDamage(occupation.x, occupation.y, SHOP_DOOR_COST, g);
            } else if (occupation.door && (occupation.door.doormask & D_LOCKED)) {
                occupation.door.doormask &= ~D_LOCKED;
                occupation.door.doormask |= D_CLOSED;
            } else if (occupation.door) {
                occupation.door.doormask &= ~D_CLOSED;
                occupation.door.doormask |= D_LOCKED;
            }
            await exerciseAttribute(A_DEX, true);
            newsym(occupation.x, occupation.y);
            g._occupation = null;
        }
        g.context.move = 1;
        return true;
    }
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

async function performWaitCommand(force = game.iflags.menu_requested) {
    if (!await donull(force, !!game.multi)) return;
    game._pending_message = '';
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

// C ref: cmd.c rhack — main command dispatcher
export async function rhack(key: number): Promise<void> {
    requirePlayingGame(game);
    // C cmd.c:rhack() resets the request-menu/movement-prefix bit for each
    // top-level command.  An `m` prefix below sets it only while dispatching
    // the following movement key.
    game.context.nopick = false;
    game.iflags.menu_requested = false;
    if (key !== 0) delete game._cursorOverride;
    game._heroMeleeThisCommand = false;
    // A prior silent-prefix marker belongs to the monster phase following
    // that command.  Reaching a new top-level dispatch acknowledges it.
    game._silentPrefixRetainedTopline = false;
    const cannedCommand = game._cannedCommands?.shift() ?? null;
    const previousMessage = game._pending_message;
    if (key === 0 && !cannedCommand) {
        const input = await readCommandInput();
        key = input.key;
        delete game._cursorOverride;
    }
    // Status rows beneath a tty pager remain physically unchanged even when
    // the suspended command has already mutated the wallet.  The next real
    // top-level command read makes that state eligible for a fresh botl.
    delete game._statusGoldOverride;
    if (!cannedCommand && (key === 0 || key === -1 || key === 255 || key === 27)) {
        resetCommandVariables(true);
        return;
    }
    const inputKey = key;
    const configured = configuredCommand(key);

    // A player command acknowledges the previous topline. A canned command
    // bypasses parse(), so unread prose and cmd_before output remain pending.
    if (!cannedCommand) {
        game._pending_message = '';
        game._retained_message = '';
    }

    if (!cannedCommand && !configured.command) {
        game.multi = 0;
        game._cannedCommands = [];
        game.context.move = 0;
        await pline(`Unknown command '${visibleCommandKey(inputKey)}'.`);
        return;
    }

    const cannedName = cannedCommand?.kind === 'swap-weapon'
        ? 'swap' : cannedCommand?.kind;
    const command = cannedCommand?.kind === 'inventory-action'
        ? inventoryActionCommand(cannedCommand.action)
        : cannedCommand
            ? NATIVE_COMMANDS.find(entry => entry.name === cannedName) ?? null
            : configured.command;
    if (!await commandAllowed(command)) {
        resetCommandVariables(true);
        return;
    }
    const binding = { ...configured, command };
    prepareTimedCommand(binding);
    await executeCommandAction(binding, { cannedCommand, previousMessage });
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
    previousMessage?: string;
}

// Admission belongs to the caller. Keep the selected binding, including its
// parameter, rather than looking up a possibly rebound key inside the action.
async function runCommandHandler(binding: CommandBinding, {
    cannedCommand = null, previousMessage = game._pending_message,
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
        await wizLevelTeleport();
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
    if (key === 20 && game.flags?.debug) { // Ctrl-T: wiztele()
        await wizTeleportPosition();
        return;
    }
    if (key === 6 && game.flags?.debug) { // Ctrl-F: wiz_map()
        await wizMap();
        return;
    }

    if (ch === 'F') {
        await doforcefight();
    } else if (isMovementKey(ch) || (/[HJKLYUBN]/.test(ch))
        || controlRushDirection(key ?? 0)) {
        const rushDirection = controlRushDirection(key ?? 0);
        const direction = rushDirection || ch.toLowerCase();
        if (!isMovementKey(direction)) return;
        const running = /[HJKLYUBN]/.test(ch) || !!rushDirection;
        if (running || game.multi > 0) startRun(
            DIR_DX[direction], DIR_DY[direction], game,
            running ? (rushDirection ? 3 : 1) : 0,
        );
        const moved = await domove(DIR_DX[direction], DIR_DY[direction]);
        if (game.program_state.gameover) return;
        if (running && moved)
            await captureRunmodeDelay(game, !!game._runState);
        game.context.move = moved ? 1 : 0;
        if (!moved) stopRun();
    } else if (ch === 'm') {
        game.iflags.menu_requested = true;
        // `m` is both request-menu and move-without-pickup.  Movement is the
        // live owner here: parse the next key inside the same command, so tty
        // exposes the unchanged map at the intermediate input boundary.
        // tty has accepted `m` as an incomplete command, not acknowledged
        // the previous topline as a completed command.  If the prefixed
        // action later dies during its monster phase, the first fatal pager
        // can therefore project the status row from before contact.
        game._silentPrefixRetainedTopline = !!previousMessage;
        const input = await readCommandInput();
        const nextCommand = configuredCommand(input.key);
        const nextKey = nextCommand.key;
        const direction = nextKey === null ? '' : String.fromCharCode(nextKey).toLowerCase();
        game._pending_message = '';
        if (!await commandAllowed(nextCommand.command)) {
            resetCommandVariables(true);
            return;
        }
        if (isMovementKey(direction)) {
            game.context.nopick = true;
            if (game.multi > 0)
                startRun(DIR_DX[direction], DIR_DY[direction], game, 0);
            const moved = await domove(
                DIR_DX[direction], DIR_DY[direction], true,
            );
            if (game.program_state.gameover) return;
            game.context.move = moved ? 1 : 0;
            if (!moved) stopRun();
        } else if (nextKey === 79) {
            await doOptions(true);
        } else if (nextKey === 22 && game.flags?.debug) {
            // cmd.c marks wiz_level_tele CMD_M_PREFIX. do_reqmenu() sets
            // iflags.menu_requested, so level_tele() skips its numeric
            // get-line editor and opens print_dungeon(TRUE) immediately.
            await wizLevelTeleport({ menuRequested: true });
        } else if (direction === 's') {
            // cmd.c marks search CMD_M_PREFIX: request-menu/move-no-pickup
            // does not alter its behavior, but the prefixed command still
            // consumes a normal search turn.
            prepareTimedCommand(nextCommand);
            await dosearch(true);
        } else if (direction === '.') {
            // do_reqmenu() is the source-level override advertised by
            // cmd_safety_prevention(); `m.` deliberately spends the turn.
            prepareTimedCommand(nextCommand);
            await performWaitCommand(true);
        } else {
            await pline("The 'm' prefix should be followed by a movement command.");
            game.context.move = 0;
        }
    } else if (ch === 'i') {
        const action = await ddoinv();
        if (action && !['\x1b', ' ', '\n', '\r'].includes(action.key)) {
            game._cannedCommands ??= [];
            game._cannedCommands.push({ kind: 'inventory-action', action });
        }
    } else if (ch === 'O') {
        await doOptions();
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
        await doread({ gotoLevel });
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
    } else if (ch === '?') {
        await dohelp();
    } else if (ch === '#') {
        await doextcmd();
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
        await doWalletQuery();
    } else if (ch === ')') {
        await doWeaponQuery();
    } else if (ch === '[') {
        await doArmorQuery();
    } else if (ch === '=') {
        await doRingQuery();
    } else if (ch === '"') {
        await doAmuletQuery();
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

async function doquaff() {
    const result = await quaff();
    game.context.move = result.spentTime && !result.heroDied ? 1 : 0;
}

type MapDisplaySnapshot = Array<[
    location: MapLocation, character: string, color: number,
    decGraphics: boolean, attributes: number,
]>;
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
        blind: !!game.blind,
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
    const name = heroIsHallucinating()
        ? randomDisplayMonsterName() : monsterInstanceDisplayName(monster);
    return withIndefiniteArticle(name);
}

function fountainActorVisibleSubject(monster: Monster) {
    return heroIsHallucinating()
        ? randomDisplayMonsterSubject()
        : `The ${monsterInstanceDisplayName(monster)}`;
}

// Fountain-spawned monsters can enter webs immediately. Other trap types
// still wait for their normal turn because their messages are not handled
// here yet.
function supportedImmediateFountainTrap(monster: Monster) {
    return game.level?.traps?.some(trap =>
        trap.tx === monster.mx && trap.ty === monster.my
        && trap.ttyp === WEB) ?? false;
}

async function triggerSupportedImmediateFountainTrap(monster: Monster) {
    const state = requireInitializedGame();
    const action = await triggerImmediateMonsterTrap(monster, state);
    await resumeDeferredMonsterTrap(action, state, {
        describeMonster: fountainActorVisibleSubject,
        publish: plineWithContinuation,
    });
    return action;
}

async function summonFountainNymph() {
    return applyFountainNymphActor({
        gone: fountainActorGone(PM_WATER_NYMPH),
        blind: !!game.blind,
        createMonster: async () => {
            const nymph = await makemonNear(
                PM_WATER_NYMPH, game.u.ux, game.u.uy, MM_NOMSG,
            );
            if (nymph) newsym(nymph.mx, nymph.my);
            return nymph;
        },
        announce: plineWithContinuation,
        nymphDescription: fountainActorIndefiniteName,
        trapAt: supportedImmediateFountainTrap,
        triggerTrap: triggerSupportedImmediateFountainTrap,
    });
}

async function summonFountainDemon() {
    return applyFountainDemonActor({
        gone: fountainActorGone(PM_WATER_DEMON),
        blind: !!game.blind,
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
        grantWish: (demon: Monster) => grantMonsterWish(demon),
        trapAt: supportedImmediateFountainTrap,
        triggerTrap: triggerSupportedImmediateFountainTrap,
    });
}

async function summonFountainSnakes() {
    return applyFountainSnakeActors({
        gone: fountainActorGone(PM_WATER_MOCCASIN),
        blind: !!game.blind,
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
        trapAt: supportedImmediateFountainTrap,
        triggerTrap: triggerSupportedImmediateFountainTrap,
    });
}

export async function drinkFountain(loc: MapLocation) {
    let fountainMessage = '';
    const fate = rnd(30);
    if (fate < 10) {
        // fountain.c:drinkfountain() handles the ordinary low-fate draught
        // before its numbered switch.  Nutrition is credited before dryup()
        // and the elapsed-turn scheduler applies its normal hunger cost.
        await plineWithContinuation('The cool draught refreshes you.');
        game.u.uhunger = (game.u.uhunger ?? 900) + rnd(10);
        await updateHeroHunger(false);
        if (game.program_state.gameover) return true;
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
    } else if (fate === 26) {
        await detectMonsters(null);
        await exerciseAttribute(A_WIS, true);
    } else if (fate === 27 && !((loc.looted ?? 0) & 1)) {
        await discoverFountainGem(loc);
    } else if (fate === 27 || fate === 28) {
        await summonFountainNymph();
    } else if (fate === 30) {
        fountainMessage = (await gushForthFromFountain({ drinking: true })).join('  ');
    } else if (fate >= 10) {
        fountainMessage =
            `This tepid ${displayLiquidName('water')} is tasteless.`;
    }
    if (fountainMessage) await plineWithContinuation(fountainMessage);

    await dryFountainAt(game.u.ux, game.u.uy);
    return false;
}

function farlookDelta(key: number) {
    const movement = game.commandBindings.movementForKey(key);
    if (!movement || movement.dz) return null;
    const distance = movement.mode === 0 ? 1 : 8;
    return { dx: movement.dx * distance, dy: movement.dy * distance };
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
    if (await stuckSteed(true, game)) {
        game.context.move = 0;
        return false;
    }
    if (!up) {
        const descent = await descendFromLevitation(game);
        if (descent.handled) {
            game.context.move = descent.spentTurn ? 1 : 0;
            return descent.spentTurn;
        }
    }
    let stairs = game.stairs;
    while (stairs && (stairs.sx !== game.u.ux || stairs.sy !== game.u.uy
        || !!stairs.up !== up)) stairs = stairs.next;
    if (!stairs) {
        const hole = !up && level.traps.find(trap =>
            trap.tx === game.u.ux && trap.ty === game.u.uy
            && (trap.ttyp === HOLE || trap.ttyp === TRAPDOOR) && trap.tseen);
        if (hole) {
            const result = await triggerHeroTrapAt(game.u.ux, game.u.uy, { gotoLevel, tookPlunge: true });
            if (result.died) return false;
            game.context.move = 1;
            return true;
        }
        await pline(`You can't go ${up ? 'up' : 'down'} here.`);
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

async function doWalletQuery() {
    const purse = heroGoldAmount(game);
    const stashed = hiddenGold(game, false);
    if (game.flags?.verbose !== false) {
        let message = purse
            ? `Your wallet contains ${purse} zorkmid${purse === 1 ? '' : 's'}`
            : 'Your wallet is empty';
        if (stashed) {
            message += `, ${purse ? 'and' : 'but'} you have ${stashed} ${
                purse ? 'more' : `zorkmid${stashed === 1 ? '' : 's'}`
            } stashed away in your pack`;
        }
        await pline(`${message}.`);
    } else {
        const total = purse + stashed;
        await pline(total
            ? `You are carrying a total of ${total} zorkmid${
                total === 1 ? '' : 's'}.`
            : 'You have no money.');
    }
    game.context.move = 0;
}

async function doWeaponQuery() {
    await pline(game.uwep
        ? `${game.uwep.invlet} - ${game.uwep.name}.`
        : 'You are bare handed.');
    game.context.move = 0;
}

async function doArmorQuery() {
    const armor = game.uarm;
    if (!armor) {
        await pline('You are not wearing any armor.');
    } else {
        const parts = [];
        if (armor.buc) parts.push(armor.buc);
        if (armor.enchantment !== undefined && Number.isInteger(armor.enchantment))
            parts.push(`${armor.enchantment >= 0 ? '+' : ''}${armor.enchantment}`);
        parts.push(armor.name);
        const description = parts.join(' ');
        const article = /^[aeiou]/i.test(description) ? 'an' : 'a';
        await pline(`${armor.invlet} - ${article} ${description} (being worn).`);
    }
    game.context.move = 0;
}

async function doRingQuery() {
    await pline(game.uleft || game.uright
        ? 'You are wearing a ring.'
        : 'You are not wearing any rings.');
    game.context.move = 0;
}

async function doAmuletQuery() {
    await pline(game.uamul
        ? 'You are wearing an amulet.'
        : 'You are not wearing an amulet.');
    game.context.move = 0;
}

function captureMapDisplay(): MapDisplaySnapshot {
    const snapshot: MapDisplaySnapshot = [];
    for (let y = 0; y < ROWNO; y++) {
        for (let x = 1; x < COLNO; x++) {
            const loc = game.level?.at(x, y);
            if (!loc) continue;
            snapshot.push([loc, loc.disp_ch, loc.disp_color,
                loc.disp_decgfx, loc.disp_attr]);
        }
    }
    return snapshot;
}

function restoreMapDisplay(snapshot: MapDisplaySnapshot) {
    for (const [loc, ch, color, decgfx, attr] of snapshot) {
        loc.disp_ch = ch;
        loc.disp_color = color;
        loc.disp_decgfx = decgfx;
        loc.disp_attr = attr;
    }
}

function showKnownTerrain() {
    for (let y = 0; y < ROWNO; y++) {
        for (let x = 1; x < COLNO; x++) {
            const loc = game.level?.at(x, y);
            if (!loc || (!loc.remembered_glyph
                && (!loc.disp_ch || loc.disp_ch === ' '))) continue;
            const glyph = terrain_glyph(loc, x, y);
            loc.disp_ch = glyph.ch;
            loc.disp_color = glyph.color;
            loc.disp_decgfx = glyph.dec;
            loc.disp_attr = 0;
        }
    }
}

async function doTerrainOverview() {
    const display = game.nhDisplay;
    if (!display) throw new Error('This command requires an initialized display.');
    game._pending_message = '';
    const left = 28;
    // Short tty menus overlay only their right-side rectangle.  The message
    // row is cleared globally, but lower rows retain map cells west of the
    // one-column separator at left - 1.
    display.clearRow(0);
    for (let row = 1; row <= 5; row++) {
        for (let col = left - 1; col < display.cols; col++)
            display.setCell(col, row, ' ', NO_COLOR, 0);
    }
    putCommandLine(left, 0, 'View which?', ATR_INVERSE);
    putCommandLine(left, 2, 'a * known map without monsters, objects, and traps');
    putCommandLine(left, 3, 'b - known map without monsters and objects');
    putCommandLine(left, 4, 'c - known map without monsters');
    putCommandLine(left, 5, '(end)');
    display.setCursor(34, 5);
    const selection = await nhgetch();
    if (selection === 27) {
        game.context.move = 0;
        return;
    }

    const displaySnapshot = captureMapDisplay();
    showKnownTerrain();
    const firstUse = shouldShowGetposTip();
    if (firstUse) {
        await pline('Showing known terrain only...');
        await showGetposTip();
    }
    const cursor = { x: game.u.ux, y: game.u.uy };
    let browseMessage = firstUse
        ? "(For instructions type a '?')  Move cursor to anything of interest:"
        : "Showing known terrain only...  (For instructions type a '?')";
    for (;;) {
        game._pending_message = browseMessage;
        await flush_screen(1);
        display.setCursor(cursor.x - 1, cursor.y + 1);
        const browseKey = await nhgetch();
        if (browseKey === 27) break;
        const delta = farlookDelta(browseKey);
        if (delta) {
            moveGetposCursor(cursor, delta.dx, delta.dy);
            browseMessage = await farlookLocationDescription(cursor.x, cursor.y);
            continue;
        }
        await plineWithContinuation('Done.');
        break;
    }

    // C map_redisplay() reaches cls(), which displays WIN_MESSAGE before
    // redrawing the map. Bare more() would leave an acknowledged Done line.
    await displayMessageWindow();
    restoreMapDisplay(displaySnapshot);
    await flush_screen(1);
    game.context.move = 0;
}

async function kickOuch(x: number, y: number, objectName = '') {
    await plineWithContinuation('Ouch!  That hurts!');
    await exerciseAttribute(A_DEX, false);
    await exerciseAttribute(A_STR, false);
    wakeMonstersNear(x, y, 25);
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
    const location = game.level?.at?.(x, y);
    if (!location) return 'kicking nothing';
    if (location.typ === DOOR) return 'kicking a door';
    if (IS_STWALL(location.typ)) return 'kicking a wall';
    if (location.typ === TREE) return 'kicking a tree';
    if (location.typ === GRAVE) return 'kicking a headstone';
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

function kickPromptTargetName(monster: Monster) {
    if (monster.name) return monster.name;
    const article = (monster.mtame ?? 0) > 0 ? 'your' : 'the';
    return `${article} ${monsterInstanceDisplayName(monster)}`;
}

async function confirmKickTarget(monster: Monster) {
    const hero = game.u;
    const impaired = hero?.confused || (hero?.confusionTurns ?? 0) > 0
        || heroIsHallucinating(game)
        || hero?.stunned || (hero?.stunnedTurns ?? 0) > 0;
    if (game.flags?.confirm === false || !monster.mpeaceful || impaired
        || game.context?.forcefight || !canSpotMonster(monster)) return true;

    const paranoid = !!((game.flags?.paranoia_bits ?? 0) & PARANOID_HIT);
    return paranoidQuery(
        paranoid, `Really attack ${kickPromptTargetName(monster)}?`,
    );
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
    const helplessBeforeKick = !!(monster.msleeping
        || monster.mcanmove === 0 || (monster.mfrozen ?? 0) > 0);
    const fleeingFromBehind = !!(monster.mflee && !monster.mavenge);
    monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_WAITMASK;
    if (!await confirmKickTarget(monster)) {
        game.context.move = 0;
        return;
    }
    if (await checkHeroAttackOverexertion()) {
        game.context.move = 1;
        return;
    }

    wakeMonstersNear(
        game.u.ux, game.u.uy, (game.u?.ulevel ?? 1) * 20,
    );
    wipeHeroEngraving(2);
    await angerAttackedMonster(monster);

    if (await levitatingKickMisses(monster)) {
        await pline('Floating in the air, you miss wildly!');
        await applyKickPassive(monster, false);
        game.context.move = 1;
        return;
    }

    if (monster.mundetected
        || (M_AP_TYPE(monster) && M_AP_TYPE(monster) !== M_AP_MONSTER)) {
        monster.mundetected = 0;
        monster.m_ap_type = 0;
        monster.mappearance = 0;
        if (canSpotMonster(monster)) {
            newsym(x, y);
            const name = monsterInstanceDisplayName(monster);
            await plineWithContinuation(
                `There is ${withIndefiniteArticle(name)} here.`,
            );
        } else {
            map_invisible(x, y);
            await plineWithContinuation('There is something hidden here.');
        }
    }

    if (await kickWithMonsterForm(monster, x, y)) {
        game.context.move = 1;
        return;
    }

    const target = monsterName(monster);
    const martial = game.urole?.key === 'monk' || game.urole?.key === 'samurai'
        || game.uarmf?.otyp === KICKING_BOOTS;
    const kick = await prepareKick({
        martial,
        announce: pline,
    });
    if (kick.stopped) {
        await applyKickPassive(monster, false);
        game.context.move = 1;
        return;
    }

    await plineWithContinuation(`You kick ${target}.`);
    const evaded = await tryKickEvasion(monster, {
        clumsy: kick.clumsy,
        martial,
        announce: plineWithContinuation,
        nameMonster: (actor: Monster) => canSpotMonster(actor)
            ? `The ${monsterInstanceDisplayName(actor)}` : 'It',
    });
    if (evaded) {
        await applyKickPassive(monster, false);
        if (monster.mx === x && monster.my === y
            && !canSpotMonster(monster)) map_invisible(x, y);
        game.context.move = 1;
        return;
    }

    const preparedDamage = prepareKickDamage(monster, {
        clumsy: kick.clumsy,
    });
    if (preparedDamage.passesThroughShade) {
        await plineWithContinuation(
            'The kick passes harmlessly through the shade.',
        );
        game.context.move = 1;
        return;
    }
    const conductMessage = kickConductViolation(monster, {
        helpless: helplessBeforeKick,
        fleeingFromBehind,
    });
    if (conductMessage) {
        await plineWithContinuation(conductMessage);
        adjustHeroAlignment(-1);
    }
    const petReaction = await abuseKickedPet(monster, preparedDamage.potentialDamage);
    if (petReaction.heroDied) return;
    const damage = await rollKickDamage(preparedDamage, { martial });
    if (damage.damage > 0)
        monster.mhp = Math.max(0, (monster.mhp ?? 1) - damage.damage);

    const reel = await tryKickReel(
        monster,
        x - (game.u?.ux ?? x),
        y - (game.u?.uy ?? y),
        {
            martial,
            announce: plineWithContinuation,
            nameMonster: (actor: Monster) => canSpotMonster(actor) ? `The ${monsterInstanceDisplayName(actor)}` : 'It',
        },
    );

    if (reel?.heroDied) return;
    const passive = await applyKickPassive(monster, true);
    if (passive.heroDied) {
        game.context.move = 1;
        return;
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
}

async function dokick() {
    if ((game.u?._woundedLegTurns ?? 0) > 0) {
        const side = game.u._woundedLegSide;
        const leg = side === 'both' ? 'legs are' : `${side || 'right'} leg is`;
        await moreUntilDismissed(
            `Your ${leg} in no shape for kicking.`,
        );
        game._pending_message = '';
        game._retained_message = '';
        game.context.move = 0;
        return;
    }
    const key = await readDirectionKey();
    const direction = promptedDirectionKey(key, game.commandBindings);
    if (!isMovementKey(direction)) {
        game.context.move = 0;
        return;
    }
    game.u.dx = DIR_DX[direction];
    game.u.dy = DIR_DY[direction];
    const x = game.u.ux + game.u.dx;
    const y = game.u.uy + game.u.dy;
    // C dokick() records gk.kickedloc for every valid directed kick before
    // dispatching the target.  Peaceful monsters and pets consult it during
    // this same elapsed turn so they do not step into the square just kicked.
    game._kickedLoc = { x, y };
    const average = game.uarmf?.otyp === KICKING_BOOTS ? 99
        : Math.trunc((currentStrength()
            + currentAttribute(A_DEX) + currentAttribute(A_CON)) / 3);
    const monster = monsterAtPosition(requireGameLevel(), x, y);
    if (monster) {
        const recoilRange = kickRecoilRange(monster.mnum);
        await kickLiveMonster(monster, x, y);
        if (kickCausesRecoil() && game.context.move)
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
    const kickedObject = game.level?.objects?.[x]?.[y]?.[0];
    const ball = game.uball || game.u?.uball;
    const chain = game.uchain || game.u?.uchain;
    if (kickedObject && kickedObject.otyp !== BOULDER
        && kickedObject !== ball && kickedObject !== chain) {
        const trap = game.level?.traps?.find(candidate =>
            candidate.tx === x && candidate.ty === y);
        if (trap?.ttyp === STATUE_TRAP) {
            await activateStatueTrapAt(x, y);
            game.context.move = 1;
            return;
        }
        const kicked = await kickFloorObject(x, y, {
            state: game,
            dx: game.u.dx,
            dy: game.u.dy,
            publish: plineWithContinuation,
            captureFlight: captureThrownObjectFlight,
        });
        if (game.program_state.gameover) return;
        if (!kicked) await kickOuch(x, y, killerObjectName(kickedObject));
        game.context.move = 1;
        return;
    }
    if (!location || IS_STWALL(location.typ)) {
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
    if (location?.typ === DOOR
        && (location.doormask & (D_CLOSED | D_LOCKED))) {
        if (game.u?.levitating) {
            await kickOuch(x, y);
            game.context.move = 1;
            return;
        }
        await exerciseAttribute(A_DEX, true);
        const strength = currentStrength();
        if (rnl(35) < average) {
            const shopDoor = roomsAt(game.level, x, y, SHOPBASE).length > 0;
            if (location.doormask & D_TRAPPED) {
                if (game.flags.verbose) await pline('You kick the door.');
                await exerciseAttribute(A_STR, false);
                location.doormask = D_NODOOR;
                if (await triggerBoobyTrap('door', { bodypart: true })) return;
            } else {
                const shatters = strength > 18 && rn2(5) === 0 && !shopDoor;
                location.doormask = shatters ? D_NODOOR : D_BROKEN;
                await pline(shatters
                    ? 'As you kick the door, it shatters to pieces!'
                    : 'As you kick the door, it crashes open!');
                await exerciseAttribute(A_STR, true);
            }
            feel_newsym(x, y);
            // kick_door() defers sight refresh so billing sees the keeper's
            // visibility before the door broke, as rloc_to_core() requires.
            vision_note_blocker_change(x, y);
            if (shopDoor) {
                addShopDamage(x, y, SHOP_DOOR_COST);
                await payForShopDamage('break');
            }
        } else {
            await exerciseAttribute(A_STR, true);
            await pline(rn2(3) === 0 ? 'Thwack!!' : 'Whammm!!');
        }
        game.context.move = 1;
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
    await kickDumb(x, y);
    game.context.move = 1;
}

async function kickDumb(x: number, y: number): Promise<void> {
    // dokick.c:kick_dumb() always abuses Dexterity before deciding whether
    // an unremarkable floor kick is merely empty or strains a muscle.
    await exerciseAttribute(A_DEX, false);
    const martial = game.urole?.key === 'monk' || game.urole?.key === 'samurai'
        || game.uarmf?.otyp === KICKING_BOOTS;
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

function setCurrentLevelAnnotation(value: string | null) {
    // dungeon.c:query_annotation(): empty input and Escape preserve the
    // existing value; space-only input removes it after mungspaces().
    if (value === null || value === '') return;
    const annotation = value.trim().replace(/\s+/g, ' ');
    const key = `${game.u?.uz?.dnum ?? 0}:${game.u?.uz?.dlevel ?? 1}`;
    if (!game._levelAnnotations) game._levelAnnotations = new Map();
    if (annotation) game._levelAnnotations.set(key, annotation);
    else game._levelAnnotations.delete(key);
}

async function queryCurrentLevelAnnotation() {
    const value = await getLine(
        'What do you want to call this dungeon level?',
        (_ch, key) => key >= 32 && key < 127,
    );
    setCurrentLevelAnnotation(value);
}

async function doannotate() {
    await queryCurrentLevelAnnotation();
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
    const validKeys = [
        27,
        ...entries.map((_, index) => 97 + index),
    ];
    const key = await showChoiceWindow({
        title: 'What do you want to do?',
        entries,
        validKeys,
    });
    restoreMenuUnderlay(underlay);
    game.nhDisplay?.setCursor((game.u?.ux ?? 1) - 1,
        (game.u?.uy ?? 0) + 1);
    // cmd.c:here_cmd_menu() queues selected actions for a later dispatch.
    // This accepted boundary dismisses with Escape before that action graph.
    game.context.move = key === 27 ? 0 : 1;
}

async function doname() {
    // docallcmd() consumes a canned category before creating its menu.
    // Unread callback prose then belongs to the later naming prompt.
    const queuedChoice = takeCommandKey();
    const key = queuedChoice ?? await showChoiceWindow({
        title: 'What do you want to name?',
        entries: [
            { key: 'm', text: 'a monster' },
            ...(game.inventory.length ? [
                { key: 'i', text: 'a particular object in inventory' },
                { key: 'o', text: 'the type of an object in inventory' },
            ] : []),
            { key: 'f', text: 'the type of an object upon the floor' },
            { key: 'd', text: 'the type of an object on discoveries list' },
            { key: 'a', text: 'record an annotation for the current level' },
        ],
        validKeys: [27, 32, 10, 13, ...'miofda'.split('').map(char => char.charCodeAt(0))],
    });
    const choice = String.fromCharCode(key).toLowerCase();
    if (queuedChoice === undefined) await restoreCommandMap();

    // C refs: do_name.c:docallcmd()/do_oname() and
    // dungeon.c:donamelevel()/query_annotation().  The menu owns only the
    // category choice; level annotations live with mapseen, while an
    // individual object's name must stay on that same object identity.
    if (choice === 'a') {
        await queryCurrentLevelAnnotation();
        game._pending_message = '';
        await restoreCommandMap();
    } else if (choice === 'i') {
        const inventory = (game.inventory || [])
            .filter((object: GameObject): object is GameObject & { invlet: string } =>
                typeof object.invlet === 'string' && object.invlet.length > 0)
            .sort((a, b) => a.invlet.localeCompare(b.invlet));
        // C do_name.c:name_ok() marks unseen, artifact and novel objects as
        // GETOBJ_DOWNPLAY.  getobj() omits those letters from the suggested
        // prompt while still accepting a directly typed inventory letter.
        const suggested = inventory.filter(object =>
            object.dknown !== false
                && !object.oartifact
                && object.otyp !== SPE_NOVEL);
        const letters = compactInventoryLetters(
            suggested.map(object => object.invlet).join(''),
        );
        const selection = await promptInventoryObject(
            `What do you want to name? [${letters} or ?*] `,
            inventory,
            { allowMenu: true },
        );
        if (!selection.cancelled && selection.object) {
            const object = selection.object;
            const value = await getLine(
                `What do you want to name this ${object.name}?`,
                (_ch, key) => key >= 32 && key < 127,
            );
            if (value !== null) {
                const name = value.trim().replace(/\s+/g, ' ');
                if (name) {
                    object.oextra = {
                        ...(object.oextra || {}),
                        oname: name,
                    };
                } else if (object.oextra?.oname) {
                    delete object.oextra.oname;
                }
            }
            game._pending_message = '';
            await restoreCommandMap();
        }
    } else if (choice === 'o') {
        const inventory = (game.inventory || [])
            .filter((object: GameObject): object is GameObject & { invlet: string } =>
                typeof object.invlet === 'string' && object.invlet.length > 0)
            .sort((a, b) => a.invlet.localeCompare(b.invlet));
        const callableClasses = new Set([3, 4, 5, 6, 8, 9, 10, 11, 13, 17]);
        const eligible = inventory.filter(object => {
            if (game._objectCallNames?.[object.otyp]) return true;
            if (object.otyp === AMULET_OF_YENDOR
                || object.otyp === FAKE_AMULET_OF_YENDOR) return false;
            return callableClasses.has(object.oclass)
                && !!OBJECT_DESCRIPTIONS[object.otyp];
        });
        const suggested = eligible.filter(object =>
            object.dknown !== false
                && (!objectTypeKnown(object)
                    || !!game._objectCallNames?.[object.otyp]));
        const letters = compactInventoryLetters(
            suggested.map(object => object.invlet).join(''),
        );
        const selection = await promptInventoryObject(
            `What do you want to call? [${letters} or ?*] `,
            eligible,
            { allowMenu: true },
        );
        if (!selection.cancelled && selection.object) {
            const object = selection.object;
            if (object.dknown === false) {
                await pline('You would never recognize another one.');
            } else {
                const perceivedName = objectTypeKnown(object)
                    ? OBJECT_NAMES[object.otyp] || object.name || 'thing'
                    : objectTypeCallNoun(object);
                const value = await getLine(
                    `Call ${withIndefiniteArticle(perceivedName)}:`,
                    (_ch, key) => key >= 32 && key < 127,
                );
                if (value !== null) {
                    const name = value.trim().replace(/\s+/g, ' ');
                    if (name) recordObjectCall(object.otyp, name);
                    else if (game._objectCallNames?.[object.otyp])
                        delete game._objectCallNames[object.otyp];
                    recordObjectEncounter(object.otyp);
                }
            }
            game._pending_message = '';
            await restoreCommandMap();
        }
    }
    game.context.move = 0;
}

function monsterBeside(x: number, y: number) {
    // C pickup.c:mon_beside() deliberately includes the hero's own square so
    // a steed can make directional looting available too.
    return (game.level?.monsters || []).some(monster =>
        (monster.mhp ?? 1) > 0
        && Math.abs(monster.mx - x) <= 1
        && Math.abs(monster.my - y) <= 1);
}

async function getAdjacentLocation(prompt: string, errorMessage: string | null, x: number, y: number) {
    // C cmd.c:get_adjacent_loc() delegates input and command assistance to
    // getdir(), then turns its relative result into a checked map location.
    const key = await readDirectionKey(`${prompt} `);
    const ch = promptedDirectionKey(key, game.commandBindings);
    let dx = 0, dy = 0, dz = 0;
    let validDirection = true;
    if (isMovementKey(ch)) {
        dx = DIR_DX[ch];
        dy = DIR_DY[ch];
    } else if (ch === '.' || ch === 's') {
        // Direct at the hero's square.
    } else if (ch === '<') {
        dz = -1;
    } else if (ch === '>') {
        dz = 1;
    } else {
        validDirection = false;
    }

    if (!validDirection) {
        // Space, Return, and Escape are getdir() quitchars.  Other invalid
        // keys open cmdassist by default; the tty text window accepts only a
        // real More dismissal before get_adjacent_loc() reports cancellation.
        const quitDirection = [27, 32, 10, 13].includes(key);
        if (!quitDirection && game.flags?.cmdassist !== false) {
            await showTextPages([directionAssistPage()], {
                validKeys: [27, 32, 10, 13],
            });
            game._pending_message = '';
            await restoreCommandMap();
        } else if (!quitDirection) {
            await pline('What a strange direction!');
        }
        await pline('Never mind.');
        game.context.move = 0;
        return null;
    }

    game.u.dx = dx;
    game.u.dy = dy;
    game.u.dz = dz;
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
        'c': 'docallcmd', 'd': 'dodrop', 'E': 'doengrave', 'f': 'dofire',
        'i': 'doorganize', 'P': 'dowear', 'Q': 'dowieldquiver', 'r': 'doread',
        'R': 'ia_dotakeoff', 't': 'dothrow', 'T': 'ia_dotakeoff',
        'w': 'dowield', 'x': 'doswapweapon', 'X': 'dotwoweapon',
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
    case 'c': queueCommandKeys(`i${letter}`); await doname(); return;
    case 'd': queueCommandKeys(letter); await dodrop(); return;
    case 'E': queueCommandKeys(letter); await doengrave(); return;
    case 'f': await dofire(); return;
    case 'i': queueCommandKeys(letter); await doadjust(); return;
    case 'P': queueCommandKeys(letter); await dowear(); return;
    case 'Q': queueCommandKeys(letter); await doready(); return;
    case 'r': queueCommandKeys(letter); await doread({ gotoLevel }); return;
    case 'R': case 'T':
        queueCommandKeys(letter);
        await removeWornItem('take off', true);
        return;
    case 't': await dothrow(item); return;
    case 'w': queueCommandKeys(letter); await dowield(); return;
    case 'x': await doswapweapon(); return;
    case 'X': await dotwoweapon(); return;
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
    if (!oldSecondary) {
        if (!oldPrimary) {
            await pline('You are already bare handed.');
            game.context.move = 0;
            return;
        }
        await plineWithContinuation('You are bare handed.');
        await setPrimaryWeapon(null, game);
        await setSecondaryWeapon(oldPrimary, game);
        observeObjectForNaming(oldPrimary);
        await plineWithContinuation(
            `${oldPrimary.invlet} - ${
                inventoryItemDescription(oldPrimary)}.`,
        );
        game.context.move = 1;
        return;
    }

    await setSecondaryWeapon(null, game);
    observeObjectForNaming(oldSecondary);
    if (willWeld(oldSecondary)) {
        await announceWeaponWeld(oldSecondary);
    } else {
        await plineWithContinuation(
            `${oldSecondary.invlet} - ${
                inventoryItemDescription(oldSecondary, { projectPrimaryHand: true })}.`,
        );
    }
    await setPrimaryWeapon(oldSecondary, game);
    await lightWieldedArtifact(oldSecondary);

    if (oldPrimary) {
        await setSecondaryWeapon(oldPrimary, game);
        observeObjectForNaming(oldPrimary);
        await plineWithContinuation(
            `${oldPrimary.invlet} - ${
                inventoryItemDescription(oldPrimary)}.`,
        );
    } else {
        await plineWithContinuation('You have no secondary weapon readied.');
    }
    game.context.move = 1;
}

async function dochat() {
    const key = await readDirectionKey('Talk to whom? (in what direction) ');
    const direction = promptedDirectionKey(key, game.commandBindings);
    if (direction === '.') {
        await pline('Talking to yourself is a bad habit for a dungeoneer.');
        game.context.move = 0;
        return;
    }
    if (isMovementKey(direction)) {
        const x = game.u.ux + DIR_DX[direction];
        const y = game.u.uy + DIR_DY[direction];
        const monster = game.level?.monsters?.find(mon => monsterHasMapPosition(mon, game) && mon.mx === x && mon.my === y);
        // sounds.c:dochat() prods any responsive target into action before
        // domonnoise()/quest_chat().  This clears both CLOSE and WAITFORU, so
        // the quest leader can take its ordinary scheduler turn immediately
        // after assigning the quest.
        if (monster) monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_WAITMASK;
        if (monster && await chatWithQuestLeader(monster, {
            exerciseWisdom,
        })) {
            game.context.move = 1;
            return;
        }
        if (monster?.mnum === PM_WATER_NYMPH) {
            // sounds.c:domonnoise(MS_SEDUCE) returns ECMD_TIME, so ordinary
            // monster movement follows this line.
            await pline('The water nymph cajoles you.');
            game.context.move = 1;
            return;
        }
        if (monster?.pet && monster.meating) {
            await pline(`${monster.name
                ? monster.name.charAt(0).toUpperCase() + monster.name.slice(1)
                : `The ${monsterInstanceDisplayName(monster)}`
            } is eating noisily.`);
        } else if (monster && await publishMonsterNoise(monster, game)) {
            game.context.move = 1;
            return;
        } else if (monster?.name) await pline(`${monster.name} does not seem to notice you.`);
        else if (!monster) {
            const statue = (game.level?.objects?.[x]?.[y] || [])
                .find(object => object.otyp === STATUE);
            const loc = game.level?.at(x, y);
            const deaf = !!(game.deaf || game.u?.deaf);
            const hallucinating = heroIsHallucinating();
            if (statue && !game.blind) {
                await pline('The statue seems not to notice you.');
            } else if (!deaf && loc && (IS_WALL(loc.typ) || loc.typ === SDOOR)
                && (!game.blind || !!loc?.seenv)) {
                if (!hallucinating) {
                    await pline("It's like talking to a wall.");
                } else {
                    const wallTalk = [
                        'gripes about its job.',
                        'tells you a funny joke!',
                        'insults your heritage!',
                        'chuckles.',
                        'guffaws merrily!',
                        'deprecates your exploration efforts.',
                        'suggests a stint of rehab...',
                        "doesn't seem to be interested.",
                    ];
                    await pline(`The wall ${wallTalk[
                        Math.min(rn2(10), wallTalk.length - 1)
                    ]}`);
                }
            } else {
                game._pending_message = '';
            }
        } else game._pending_message = '';
    }
    game.context.move = 0;
}

async function wizWish() {
    return makeWish({ allowWizardTerrain: true });
}

// C refs: cmd.c Ctrl-G/wizgenesis, wizcmds.c wiz_genesis(), and read.c
// create_particular().  The debug command remains zero-time.
const WIZGENESIS_SUBSTITUTIONS = new Map([
    [123, 'human zombie'], // Angel
    [271, 'human zombie'], // shopkeeper
    [272, 'human zombie'], // guard
    [275, 'human zombie'], // aligned cleric
    [276, 'human zombie'], // high cleric
    [285, 'doppelganger'], // Wizard of Yendor
]);

// C wiz_polyself(): allow a chosen form without consuming a game turn.
async function wizPolyself() {
    await polymorphHero(POLY_CONTROLLED);
    game.context.move = 0;
}

async function wizGenesis() {
    const value = await getLine(
        'Create what kind of monster?',
        (_ch, key) => key >= 32 && key < 127,
    );
    if (value === null) {
        game.context.move = 0;
        return;
    }

    const description = value.trim().replace(/ +/g, ' ');
    const explicitQuantity = /^(\d+) */u.exec(description);
    let quantity = explicitQuantity
        ? Number.parseInt(explicitQuantity[1] ?? '', 10)
        : (game.multi > 0 ? 1 + game.multi : 1);
    const quantityLimit = ROWNO * (COLNO - 1);
    if (quantity < 1 || quantity > quantityLimit) {
        const census = requireGameLevel().monsters.filter(monster =>
            monster.mhp > 0 && !(monster.isgd && monster.mx === 0)).length;
        quantity = quantityLimit - census;
    }
    const requestedName = explicitQuantity
        ? description.slice(explicitQuantity[0].length) : description;

    // read.c:create_particular_parse() removes state modifiers before lookup.
    const sleepingPattern = /(^|\s)sleeping\s+/iu;
    const sleeping = sleepingPattern.test(requestedName);
    const stateStrippedName = sleeping
        ? requestedName.replace(sleepingPattern, '$1')
        : requestedName;
    const tamePattern = /^\s*tame\s+/iu;
    const tame = tamePattern.test(stateStrippedName);
    const dispositionStrippedName = tame
        ? stateStrippedName.replace(tamePattern, '')
        : stateStrippedName;
    const peacefulPattern = /^\s*peaceful\s+/iu;
    const peaceful = peacefulPattern.test(dispositionStrippedName);
    const peacefulStrippedName = peaceful
        ? dispositionStrippedName.replace(peacefulPattern, '')
        : dispositionStrippedName;
    const hostilePattern = /^\s*hostile\s+/iu;
    const hostile = hostilePattern.test(peacefulStrippedName);
    const monsterName = hostile
        ? peacefulStrippedName.replace(hostilePattern, '')
        : peacefulStrippedName;
    let mnum = nameToMonster(monsterName);
    if (mnum < 0) {
        await pline("I've never heard of such monsters.");
        game.context.move = 0;
        return;
    }

    // read.c:cant_revive() substitutes special-location actors which cannot
    // be created in an ordinary square.  Wizard create_particular() retains
    // both types across a modal prompt and only starts makemon() after the
    // answer.  The affirmative branch forces the requested actor; default/no
    // constructs the disoriented human-zombie substitute.
    const substituteName = WIZGENESIS_SUBSTITUTIONS.get(mnum);
    if (substituteName !== undefined) {
        const requestedName = MONSTER_NAME[mnum];
        const force = await promptYesNo(
            `Creating ${substituteName} instead; force ${requestedName}?`,
        );
        if (force !== 'y') mnum = nameToMonster(substituteName);
    }

    for (let created = 0; created < quantity; created++) {
        const monster = await makemonNear(
            mnum, game.u.ux, game.u.uy, MM_NOEXCLAM,
        );
        if (!monster) break;
        // Native creation records kill alignment again after forcing attitude.
        if (tame) {
            await tameMonster(monster);
        } else if (peaceful || hostile) {
            monster.mtame = 0;
            monster.pet = false;
            monster.mpeaceful = peaceful ? 1 : 0;
            setMonsterMalign(monster);
        }
        // create_particular_creation() applies requested sleep after makemon
        // announces the actor.
        if (sleeping) monster.msleeping = 1;
        newsym(monster.mx, monster.my);
        const hallucinating = heroIsHallucinating();
        if (hallucinating) {
            nameMonsterForCreationArmorChecks(
                monster, () => randomDisplayMonsterName(),
            );
        }
        newsym(monster.mx, monster.my);
        if (canSpotMonster(monster)) {
            const clericInstance = monster.ispriest || monster.isminion
                ? visiblePriestName(monster) : null;
            const name = MONSTER_NAME[mnum];
            if (name === undefined) throw new RangeError(`Unknown created monster species ${mnum}`);
            const subject = clericInstance
                || (mnum === 285
                    ? (hallucinating
                        ? randomDisplayMonsterSubject(true) : `The ${name}`)
                    : null)
                || withIndefiniteArticle(name);
            await pline(
                `${subject.charAt(0).toUpperCase()}${subject.slice(1)} appears next to you.`,
            );
        }
    }
    game.context.move = 0;
}

async function wizKill() {
    if (!game.flags?.debug) {
        await pline('#wizkill: unknown extended command.');
        game.context.move = 0;
        return;
    }

    const firstUse = shouldShowGetposTip();
    if (firstUse) {
        await pline('Pick first monster to slay:');
        await showGetposTip();
    }

    const cursor = await selectMapPosition({
        start: { x: game.u.ux, y: game.u.uy },
        prompt: firstUse ? 'Move cursor to a monster:'
            : 'Pick first monster to slay.',
        goal: 'a monster',
        describe: farlookLocationDescription,
    });
    if (!cursor) {
        game.context.move = 0;
        return;
    }

    game._pending_message = '';
    game._retained_message = '';
    const monster = requireGameLevel().monsters.find(candidate => monsterHasMapPosition(candidate, game) &&
        candidate.mx === cursor.x && candidate.my === cursor.y
        && !candidate.dead && (candidate.mhp ?? 1) > 0);
    if (!monster) {
        await pline('There is no monster there.');
        game.context.move = 0;
        return;
    }

    monster.mhp = 0;
    const killed = await finishHeroMonsterKill(
        monster, monster.mx, monster.my,
    );
    if (!killed)
        game._cursorOverride = [monster.mx - 1, monster.my + 1];
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
    const prefix = {
        portal: 'Portal',
        no_end1: 'Connection',
        no_end2: 'One way stair',
        stair: 'Stair',
    }[branchKind(branch)] || 'Stair';
    return `${prefix} to ${child.dname}: ${dungeonDepth(
        branch.end1.dnum, branch.end1.dlevel,
    )}`;
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
        || (a.kind === 'branch' ? -1 : 1));
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
    const rows: TextMenuEntry[] = [
        { text: 'Level teleport to where:', attr: ATR_INVERSE },
        '',
    ];
    const choices = new Map<string, WizardLevelDestination>();
    let choiceIndex = 0;

    for (let dnum = 0; dnum < (game.dungeons?.length || 0); dnum++) {
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

function wizardWherePages() {
    const lines = [];
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
            if (label) lines.push(`  ${label}`);
        }
    }

    const pages: TextPage[] = [];
    for (let offset = 0; offset < lines.length; offset += 23) {
        const pageLines = lines.slice(offset, offset + 23);
        pageLines.push(' --More--');
        pages.push({
            lines: pageLines,
            cursor: [9, pageLines.length - 1],
        });
    }
    return pages;
}

// C refs: wizcmds.c:wiz_where() and dungeon.c:print_dungeon(FALSE).
// This is the complete live graph, unlike #overview's visited-level history
// and unlike #levelteleport's selectable menu projection.
async function wizWhere() {
    game._pending_message = '';
    game._retained_message = '';
    await showTextPages(wizardWherePages(), {
        validKeys: [27, 32, 10, 13],
    });
    await docrt();
    game.context.move = 0;
}

// C dungeon.c:print_dungeon(TRUE), with the endgame entry prerequisite.
export async function chooseWizardLevelDestination() {
    const { rows, choices } = wizardLevelMenu();
    const destination = await showPagedPickOneMenu({ rows, choices });
    if (!destination) return null;
    await endgamePrerequisite(destination);
    return { destination };
}

async function wizLevelTeleport({ menuRequested = false } = {}) {
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
    // pickup.c:doloot_core() rejects body forms without hands before it
    // inspects the floor, containers, or adjacent monsters.
    if (heroHasNoHands(game)) {
        await pline('You have no hands!');
        game.context.move = 0;
        return;
    }
    const x = game.u?.ux, y = game.u?.uy;
    const pile = game.level?.objects?.[x]?.[y] || [];
    const container = pile.find(isContainer);
    if (!container && monsterBeside(x, y)) {
        const target = await getAdjacentLocation(
            'Loot in what direction?', 'Invalid loot location', x, y,
        );
        if (!target) return;

        const targetPile = game.level?.objects?.[target.x]?.[target.y] || [];
        const targetContainer = targetPile.some(isContainer);
        const targetMonster = game.level?.monsters?.find(monster => monsterHasMapPosition(monster, game) &&
            (monster.mhp ?? 1) > 0
            && monster.mx === target.x && monster.my === target.y);
        if (target.dz < 0) {
            await pline("You don't find anything to loot on the ceiling.");
            game.context.move = 1;
        } else if (targetContainer && (target.x !== x || target.y !== y)) {
            await pline(targetMonster
                ? "You can't loot anything there with a monster in the way."
                : 'You have to be at a container to loot it.');
            game.context.move = 0;
        } else {
            await pline(`You don't find anything ${target.x === x
                && target.y === y ? 'here' : 'there'} to loot.`);
            game.context.move = 0;
        }
        return;
    }
    if (!container) {
        await pline("You don't find anything here to loot.");
        game.context.move = 0;
        return;
    }

    const containerName = container.otyp === SACK
        || container.otyp === OILSKIN_SACK
        || container.otyp === BAG_OF_HOLDING
        ? 'bag' : OBJECT_NAMES[container.otyp] || 'container';
    if (container.olocked) {
        const lockedMessage = container.lknown
            ? `The ${containerName} is locked.`
            : `Hmmm, the ${containerName} turns out to be locked.`;
        container.lknown = true;
        const tool = autoUnlockTool(game);
        if (!tool) {
            await pline(lockedMessage);
            game.context.move = 0;
            return;
        }

        // do_loot_cont() emits the lock discovery before pick_lock() asks
        // its ynq question. tty update_topl() pages the former message before
        // it can install the prompt.
        await promptKey(`${lockedMessage}--More--`);
        const answer = await promptYesNoQuit(`Unlock it with ${lockToolName(tool)}?`);
        if (answer === 'y') {
            game._occupation = {
                key: 'pick-lock',
                text: tool.otyp === LOCK_PICK || tool.otyp === CREDIT_CARD
                    ? 'picking the lock'
                    : `unlocking the ${container.otyp === CHEST ? 'chest' : 'box'}`,
                remaining: 51,
                usedtime: 0,
                container,
                x,
                y,
                tool,
                chance: lockPickChance(tool, game, container),
            };
            // Initiating container autounlock makes enclosing #loot timed
            // before the first occupation callback.
            game.context.move = 1;
        } else game.context.move = 0;
        return;
    }

    game._pending_message = '';
    await flush_screen(1);
    const result = await useContainer(container, {
        underlay: snapshotMenuUnderlay(),
    });
    if (result.heroDied) return;
    game.context.move = result.spentTime ? 1 : 0;
}

// C refs: pickup.c:dotip(), safe_qbuf(), and ynq().  Floor containers are
// considered before carried objects.  Keep this prompt transaction separate
// from tipcontainer(), whose spill mechanics own the timed yes branch.
async function dotip() {
    const x = game.u?.ux, y = game.u?.uy;
    const pile = game.level?.objects?.[x]?.[y] || [];
    const containers = pile.filter(isContainer);

    const container = containers[0];
    if (containers.length === 1 && container && !heroHasNoLimbs(game)
        && !exceedsActionCapacity(game)) {
        observeObjectForNaming(container);
        const prompt = `There is ${floorObjectDescription(container)} here, `
            + 'tip it?';
        const answer = await promptYesNoQuit(prompt);
        if (answer === 'q') {
            // tty leaves the resolved query physically painted until the
            // following command read, but it is no longer continuation-owned.
            game.context.move = 0;
            return;
        }
        // TODO: implement spilling and choosing another container.
        game.context.move = answer === 'y' ? 1 : 0;
        return;
    }

    await pline('Nothing happens.');
    game.context.move = 0;
}

// C cmd.c:extcmds_match(): availability applies to both full names and
// completion; AUTOCOMPLETE only limits the latter.
function availableExtendedCommands() {
    return NATIVE_COMMANDS.filter(command =>
        !(command.flags & (NATIVE_COMMAND_FLAGS.CMD_NOT_AVAILABLE
            | NATIVE_COMMAND_FLAGS.INTERNALCMD))
        && (game.flags.debug || !(command.flags & NATIVE_COMMAND_FLAGS.WIZMODECMD)));
}

function completeExtendedCommand(prefix: string): string | null {
    const matches = availableExtendedCommands().filter(command =>
        !!(command.flags & NATIVE_COMMAND_FLAGS.AUTOCOMPLETE)
        && command.name !== null
        && command.name.startsWith(prefix));
    return matches.length === 1 ? matches[0]?.name ?? null : null;
}

const EXTENDED_COMMAND_HANDLERS = new Map<string, () => Promise<unknown>>([
    ['whatis', dowhatis],
    ['takeoffall', takeOffAll],
    ['conduct', doconduct],
    ['chronicle', doChronicle],
    ['vanquished', doVanquished],
    ['genocided', doGenocided],
    ['terrain', doTerrainOverview],
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
    ['tip', dotip],
    ['force', doforce],
    ['jump', dojump],
    ['overview', doDungeonOverview],
    ['offer', dosacrifice],
    ['dip', dodip],
    ['turn', doturn],
    ['engrave', doengrave],
    // C extcmdlist[] maps both "call" and "name" to docallcmd().
    ['call', doname],
    ['untrap', () => doUntrap({ enterTrap: moveIntoFailedUntrap })],
    ['wipe', dowipe],
    ['monster', domonability],
    ['polyself', wizPolyself],
    ['annotate', doannotate],
    ['herecmdmenu', doherecmdmenu],
    ['adjust', doadjust],
    ['levelchange', wizLevelChange],
    ['wizwhere', wizWhere],
    ['wizwish', wizWish],
    ['wizgenesis', wizGenesis],
    ['wizkill', wizKill],
    ['wizidentify', wizIdentify],
    ['wizintrinsic', wizIntrinsic],
    ['wizmap', wizMap],
]);

async function runExtendedCommand(name: string) {
    const command = availableExtendedCommands().find(entry => entry.name === name);
    if (!command) {
        await pline(`#${name}: unknown extended command.`);
        game.context.move = 0;
        return;
    }
    if (!await commandAllowed(command)) {
        // doextcmd() returns ECMD_OK; rhack clears queues only for a delay.
        resetCommandVariables(game.multi < 0);
        return;
    }
    const key = commandExecutionKey(command.name)?.charCodeAt(0) ?? null;
    return executeCommandAction({ key, command, parameter: null });
}

// C refs: artifact.c:doinvoke(), invoke_ok(), arti_invoke().  getobj()
// suggests artifacts and other unique objects; an artifact with inv_prop 0
// still consumes a turn after retouching, but its only effect is the ordinary
// "Nothing happens." line.
async function doinvoke() {
    const eligible = (game.inventory || []).filter(object =>
        !!(object.oartifact || object.artifact));
    if (!eligible.length) {
        await pline("You don't have anything special to invoke.");
        game.context.move = 0;
        return;
    }
    const letters = eligible.map(object => object.invlet).join('');
    const selection = await promptInventoryObject(
        `What do you want to invoke? [${
            compactInventoryLetters(letters)} or ?*] `,
        eligible, { allowMenu: true },
    );
    if (selection.cancelled || !selection.object) {
        game.context.move = 0;
        return;
    }

    game._pending_message = '';
    const object = selection.object;
    const artifact = object.oartifact
        ? artifactById(object.oartifact) : null;
    if (artifact) {
        const touch = await touchArtifactByHero(object, artifact);
        if (!touch.allowed || touch.died) {
            game.context.move = 1;
            return;
        }
    }
    if (!artifact || artifact.invokePower === null) {
        await pline('Nothing happens.');
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
            { allowMenu: true },
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
        await grantMonsterWish(djinni, { announce: true });
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
    if (game.u) {
        game.u.confusionTurns = 0;
        game.u.hallucinationTurns = 0;
    }

    mapLevel({ confused: false, revealAllTraps: true });
    if (game.u) {
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

// C ref: invent.c:doorganize()/doorganize_core().
// TODO: add splitting, collecting, merging, swapping, gold repair, and the
// used-letter menu.
async function doadjust() {
    const inventory = (game.inventory || [])
        .filter((object: GameObject): object is GameObject & { invlet: string } =>
                typeof object.invlet === 'string' && object.invlet.length > 0)
        .sort((a, b) => a.invlet.localeCompare(b.invlet));
    if (!inventory.length) {
        await pline("You aren't carrying anything to adjust.");
        game.context.move = 0;
        return;
    }

    const sourceLetters = compactInventoryLetters(
        inventory.map(object => object.invlet).join(''),
    );
    const selection = await promptInventoryObject(
        `What do you want to adjust? [${sourceLetters} or ?*] `,
        inventory,
        { allowMenu: true },
    );
    if (selection.cancelled || !selection.object) {
        game.context.move = 0;
        return;
    }

    const object = selection.object;
    const occupied = new Set(
        inventory.filter(candidate => candidate !== object)
            .map(candidate => candidate.invlet),
    );
    const recommended = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
        .split('')
        .filter(letter => letter === object.invlet || !occupied.has(letter))
        .join('');
    const destinationPrompt = `Adjust letter to what [${
        compactInventoryLetters(recommended)}] (? see used letters)?`;
    // The source item's queued letter bypasses getobj's prompt, but the
    // destination uses tty_yn_function(), which acknowledges unread prose.
    await flushPendingTopline();
    const key = await promptKey(destinationPrompt, 1);
    const destination = String.fromCharCode(key);
    if (key === 27 || key === 32 || key === 10 || key === 13) {
        game._pending_message = '';
        await pline('Never mind.');
        game.context.move = 0;
        return;
    }

    if (!/^[a-zA-Z]$/.test(destination)) {
        // The source retries invalid destinations up to five times.  Keep
        // this unclaimed branch zero-time without mutating the object.
        game._pending_message = '';
        await pline('Select an inventory slot letter.');
        game.context.move = 0;
        return;
    }

    const displaced = inventory.find(candidate =>
        candidate !== object && candidate.invlet === destination);
    const source = object.invlet;
    if (!source) throw new Error('Adjusting inventory requires a lettered object.');
    if (displaced) displaced.invlet = source;
    object.invlet = destination;
    game.inventory.sort((a, b) =>
        String(a.invlet).localeCompare(String(b.invlet)));
    game._pending_message = '';
    observeObjectForNaming(object);
    await pline(
        `${displaced ? 'Swapping:' : destination === source
            ? 'Collecting:' : 'Moving:'} ${destination} - ${
            inventoryItemDescription(object, {
                primaryHandDetail: inventoryPrimaryHandDetail(object),
            })}.`,
    );
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

// C refs: trap.c water_damage()/erode_obj().  Fountain dipping forces the
// water check, so the ordinary luck-based shield is bypassed; the erosion
// result then controls dipfountain()'s separate one-in-two early-return gate.
async function waterDamageCarriedObject(object: GameObject) {
    const kind = objectErosionKind(object);
    if (!kind || kind.action !== 'rust') return ER_NOTHING;

    const proof = !!object.oerodeproof;
    if (proof) {
        object.rknown = true;
        return ER_NOTHING;
    }
    if (object.blessed && rnl(4) === 0) return ER_NOTHING;
    if ((object.oeroded || 0) >= 3) return ER_NOTHING;

    const message = objectErosionMessage(object, kind);
    await pline(message);
    object.oeroded = (object.oeroded || 0) + 1;
    if (object.worn) findArmorClass(game);
    return ER_DAMAGED;
}

async function dipFountain(object: GameObject, loc: MapLocation) {
    const result = await waterDamageCarriedObject(object);
    if (result !== ER_NOTHING && rn2(2) === 0) {
        return;
    }

    const fate = rnd(30);
    let eventMessage = '';
    const wasCursed = object.cursed;
    const bucEffect = resolveDippedBucFate({
        fate,
        object,
        blind: !!game.blind,
        liquidName: () => displayLiquidName('water'),
    });
    if (!wasCursed && object.cursed) {
        await dropCursedSecondaryWeapon(object);
        if (game.program_state.gameover) return;
        await bookCursed(object);
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
        blind: !!game.blind,
        random: rnd,
        createGold: async (quantity: number) => {
            await mkgold(quantity, game.u.ux, game.u.uy);
        },
        liquidName: () => displayLiquidName('water'),
        exerciseWisdom,
        repaint: () => newsym(game.u.ux, game.u.uy),
    });
    if (bucEffect.handled) {
        eventMessage = bucEffect.message;
    } else if (sensationEffect.handled) {
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
            eventMessage = (await gushForthFromFountain()).join('  ');
        else
            await discoverFountainGem(loc);
    } else if (fate === 25) {
        eventMessage = (await gushForthFromFountain()).join('  ');
    } else if (fate === 28) {
        await moreUntilDismissed(
            'An urge to take a bath overwhelms you.',
        );
        game._pending_message = '';

        const wallet = heroGoldAmount(game);
        if (wallet > 10) {
            const loss = Math.trunc(someGold(wallet) / 10);
            game._statusGoldOverride = wallet;
            setHeroGoldAmount(game, wallet - loss);
            await pline('You lost some of your gold in the fountain!');
            loc.looted = (loc.looted ?? 0) & ~F_LOOTED;
            await exerciseAttribute(A_WIS, false);
        }

        await dryFountainAt(game.u.ux, game.u.uy);
        return;
    } else if ((fate < 16 || fate === 30) && result === ER_NOTHING) {
        eventMessage = 'Nothing seems to happen.';
    }
    if (eventMessage) await plineWithContinuation(eventMessage);
    await dryFountainAt(game.u.ux, game.u.uy);
}

function dipTargetDescription(object: GameObject) {
    observeObjectForNaming(object);
    const full = inventoryItemDescription(object);
    if (full.length <= 49) return full;

    // objnam.c:short_oname() strips these lengthening properties on a
    // temporary copy before falling back to its minimal formatter.
    const shortened = {
        ...object,
        bknown: false,
        rknown: false,
        greased: false,
        oeroded: 0,
        oeroded2: 0,
    };
    delete shortened.buc;
    return inventoryItemDescription(shortened);
}

// C ref: potion.c dodip()/invent.c getobj().  Object selection, terrain
// confirmation, and the committed dip are one nested command transaction.
async function dodip() {
    const items = (game.inventory || []).filter((item: GameObject): item is GameObject & { invlet: string } =>
            typeof item.invlet === 'string' && item.invlet.length > 0)
        .sort((a, b) => a.invlet.localeCompare(b.invlet));
    const letters = compactInventoryLetters(
        items.map(item => item.invlet).join(''),
    );
    const selection = await promptInventoryObject(
        `What do you want to dip? [${letters} or ?*] `,
        items,
        { allowMenu: true, retainPromptOnCancel: true },
    );
    if (selection.cancelled || !selection.object) {
        game.context.move = 0;
        return;
    }

    const object = selection.object;
    const loc = game.level?.at(game.u?.ux, game.u?.uy);
    if (loc?.typ === FOUNTAIN) {
        const description = dipTargetDescription(object);
        const prompt = `Dip ${description} into the fountain?`;
        const answer = await promptYesNo(
            prompt, 'n',
        );
        if (answer === 'y') {
            await dipFountain(object, loc);
            game.context.move = 1;
            return;
        }
    }

    // Potion, sink, pool, and declined-fountain second selectors remain
    // distinct source transactions.
    game.context.move = 0;
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
    for (const key of game._levelCache?.keys?.() || []) {
        const [dnum, dlevel] = String(key).split(':').map(Number);
        remember(dnum, dlevel);
    }
    return byDungeon;
}

function dungeonOverviewHeading(dnum: number, levels: readonly number[]) {
    const dungeon = game.dungeons?.[dnum];
    const reached = dungeon?.entry_lev === dungeon?.num_dunlevs
        ? Math.min(...levels) : Math.max(...levels);
    if (reached === (dungeon?.entry_lev ?? 1))
        return `${dungeon?.dname || 'Dungeon'}:`;
    const depths = levels.map(dlevel => dungeonDepth(dnum, dlevel))
        .sort((a, b) => a - b);
    const range = dungeon?.entry_lev === dungeon?.num_dunlevs
        ? `levels ${depths.at(-1)} up to ${depths[0]}`
        : `levels ${depths[0]} to ${depths.at(-1)}`;
    return `${dungeon?.dname || 'Dungeon'}: ${range}`;
}

function overviewLevelIsInteresting(dnum: number, dlevel: number, deepest: number | undefined) {
    if (dlevel === deepest) return true;
    if ((game.u?.uz?.dnum ?? 0) === dnum
        && (game.u?.uz?.dlevel ?? 1) === dlevel) return true;
    const annotation = game._levelAnnotations?.get?.(`${dnum}:${dlevel}`);
    const record = game._overviewRecords?.get?.(`${dnum}:${dlevel}`);
    const features = record?.features || {};
    return !!annotation || !!record?.branch || Object.values(features)
        .some(value => typeof value === 'number' && Number.isInteger(value) && value > 0);
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
            const type = SHOP_TYPES[
                (features.shoptype ?? SHOPBASE) - SHOPBASE
            ]?.name || 'shop';
            phrases.push(`a ${type}`);
        } else {
            phrases.push(overviewCountPhrase(features.nshop, 'shop'));
        }
    }
    for (const [countKey, noun] of [
        ['naltar', 'altar'], ['nthrone', 'throne'],
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

// C ref: dungeon.c dooverview()/show_overview().  This is dungeon-history
// projection over mapseen/cache state; it is distinct from Delete's
// known-terrain browser, which enters a getpos-style cursor transaction.
async function doDungeonOverview() {
    // The C command lazily calls recalc_mapseen() before rendering.  Refresh
    // the current level from remembered/underfoot terrain at that same
    // boundary; do not infer features from unseen live squares.
    recordMappedOverviewState();
    const lines: TextMenuEntry[] = [];
    const visited = [...visitedDungeonLevels().entries()]
        .sort(([left], [right]) => left - right);
    for (const [dnum, levelSet] of visited) {
        const levels = [...levelSet].sort((a, b) => a - b);
        if (!levels.length || !game.dungeons?.[dnum]) continue;
        lines.push({
            text: dungeonOverviewHeading(dnum, levels),
            attr: ATR_INVERSE,
        });
        const deepest = levels.at(-1);
        for (const dlevel of levels) {
            if (!overviewLevelIsInteresting(dnum, dlevel, deepest)) continue;
            const depth = dungeonDepth(dnum, dlevel);
            const annotation = game._levelAnnotations?.get?.(`${dnum}:${dlevel}`);
            const record = game._overviewRecords?.get?.(`${dnum}:${dlevel}`);
            const current = (game.u?.uz?.dnum ?? 0) === dnum
                && (game.u?.uz?.dlevel ?? 1) === dlevel;
            const prototype = game.flags?.debug
                ? specialPrototypeAt(dnum, dlevel) : null;
            const special = prototype ? ` [${prototype}]` : '';
            const suffix = annotation ? ` "${annotation}"` : '';
            lines.push(`   Level ${depth}:${special}${suffix}${
                current ? ' <- You are here.' : ''
            }`);
            const featureLine = overviewFeatureLine(record?.features);
            if (featureLine) lines.push(featureLine);
            if (record?.branch) {
                const target = game.dungeons?.[record.branch.dnum]?.dname
                    || 'another dungeon';
                lines.push(
                    `      Stairs ${record.branch.up ? 'up' : 'down'} to ${
                        target}.`,
                );
            }
        }
    }
    await showTextMenuOverlay(lines);
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

function permanentlyIdentified(item: GameObject | null | undefined): boolean {
    return !!(item?.typeKnown && item?.known && item?.dknown
        && item?.bknown && item?.rknown);
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
    const unidentified = (game.inventory || []).filter(item =>
        !permanentlyIdentified(item));
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
    game._pending_message = '';
    game.nhDisplay?.clearRow(0);
    const selected = await showMultiSelectWindow({
        title: `Debug Identify -- unidentified or partially identified item${
            unidentified.length === 1 ? '' : 's'
        }`,
        introLines: [
            `_ - select ${unidentified.length === 1
                ? 'it' : 'any or all of them'} to permanently identify${
                unidentified.length === 1 ? '' : ' (^I for all)'}`,
        ],
        sections,
        blankAfterTitle: false,
        titleAttr: ATR_NONE,
    });
    game._pending_message = '';
    for (const item of selected) {
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

// TTY's extended-command line editor redraws the prompt at every input
// boundary.  #enhance has AUTOCOMPLETE, so its unique initial "e" expands
// visually while subsequent characters advance through that completed word.
async function doextcmd(): Promise<void> {
    let command = '';
    game._pending_message = '#';
    await flush_screen(1);
    game.nhDisplay?.setCursor(2, 0);

    const redrawCommand = async () => {
        const completion = completeExtendedCommand(command.toLowerCase());
        const displayedCommand = completion || command;
        game._pending_message = command
            ? `# ${displayedCommand}` : '#';
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
        const insertion = command.length + 2;
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
                await redrawCommand();
                continue;
            }
            game._pending_message = '';
            game.context.move = 0;
            return;
        }
        if (key === 10 || key === 13) break;
        if (key === 8) {
            if (command) {
                command = command.slice(0, -1);
                await redrawCommand();
            }
            continue;
        }
        if (key === 127) {
            // DEL is tty's kill character in the recorder sessions.  It
            // removes both the typed prefix and the visible completion.
            if (command) {
                command = '';
                await redrawCommand();
            }
            continue;
        }
        const ch = String.fromCharCode(key);
        if (key < 32 || key === 127 || command.length >= COLNO) continue;
        command += ch;
        await redrawCommand();
    }

    // tty_getlin() clears its message window on return. The completed
    // editor is not an unread message for a later cls() to acknowledge.
    game._pending_message = '';
    game._retained_message = '';
    game.nhDisplay?.clearRow(0);
    const normalizedCommand = command
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();
    if (!normalizedCommand) {
        game._pending_message = '';
        game.nhDisplay?.clearRow(0);
        game.nhDisplay?.setCursor(game.u.ux - 1, game.u.uy + 1);
        game.context.move = 0;
        return;
    }
    await runExtendedCommand(
        completeExtendedCommand(normalizedCommand) || normalizedCommand,
    );
}

async function wizardPositionDescription(x: number, y: number): Promise<string> {
    if (x === game.u?.ux && y === game.u?.uy) {
        const species = game.u.umonnum;
        const polymorphName = heroIsPolymorphed(game) && species !== undefined
            ? MONSTER_NAME[species] : '';
        const race = game.urace?.noun || game.urace?.name || 'human';
        const role = game.urole?.name;
        const roleName = typeof role === 'string' ? role
            : game.flags?.female ? role?.f : role?.m;
        const form = polymorphName
            || `${race} ${(roleName || 'adventurer').toLowerCase()}`;
        const punishment = heroIsPunished()
            ? ', chained to a heavy iron ball' : '';
        return `${form} called ${game.plname || 'player'}${punishment}`;
    }
    const loc = game.level?.at(x, y);
    if (!loc) return 'unexplored area';
    if (loc.typ === TREE && loc.remembered_glyph) return 'tree';
    if (!loc.remembered_glyph && !cansee(x, y)) return 'unexplored area';
    // C pager.c:do_screen_description() describes the displayed glyph, not
    // the terrain below it.  A visible (or still remembered) pile therefore
    // owns farlook before the room/corridor fallback.
    const object = game.level?.objects?.[x]?.[y]?.[0];
    if (object && (cansee(x, y)
        || loc.remembered_glyph?.kind === 'object')) {
        observeDistantObjectForNaming(object);
        return floorObjectDescription(object);
    }
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
    game._retained_message = game._pending_message;
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
    game._retained_message = game._pending_message;
    game._pending_message = '';
    return destination;
}

// C refs: cmd.c dotelecmd(), teleport.c dotele()/teleds(), getpos.c getpos(),
// and priest.c intemple().  A successful Wizard position teleport returns
// ECMD_TIME.  Its first getpos use still owns the shared Lua tutorial, while
// the destination room separately owns entry effects after relocation.
async function wizTeleportPosition(): Promise<void> {
    let destination = await askTeleportDestination();
    if (!destination) {
        // dotele(TRUE) still reaches morehungry(100) and returns a timed
        // command when scrolltele()'s controlled getpos was cancelled.
        await spendHeroNutrition(100);
        if (game.program_state.gameover) return;
        game.context.move = 1;
        return;
    }

    const acceptedChoice = heroTeleportDestinationOk(destination.x, destination.y);
    if (!acceptedChoice) {
        // teleport.c:scrolltele() rejects the controlled location before
        // entering safe_teleds().  Keep "Sorry..." pending while the random
        // selector and teleds() update the map; a destination floor pager can
        // then suspend this line at the same tty boundary as C.
        await pline('Sorry...');
        destination = safeTeleportDestination();
        if (!destination) {
            await spendHeroNutrition(100);
            if (game.program_state.gameover) return;
            game.context.move = 1;
            return;
        }
    }

    const movement = await moveHeroByTeleport(destination.x, destination.y);
    await finishTeleportArrival(movement);
    if (game.program_state.gameover) return;
    if (acceptedChoice && game.u.ux === game._travelTarget?.x
        && game.u.uy === game._travelTarget?.y) game._travelTarget = null;
    // C dotele() spends nutrition only after teleds() finishes its effects.
    await spendHeroNutrition(100);
    if (game.program_state.gameover) return;
    game.context.move = 1;
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

export async function farlookLocationDescription(x: number, y: number): Promise<string> {
    const monster = game.level ? monsterAtPosition(game.level, x, y) : null;
    if (monster && glyphAt(x, y)?.kind === 'monster') {
        const hallucinating = heroIsHallucinating(game);
        const prefix = hallucinating ? ''
            : monster.mtame ? 'tame '
                : monster.mpeaceful ? 'peaceful ' : '';
        const name = hallucinating
            ? randomDisplayMonsterName() : monsterInstanceDisplayName(monster);
        let condition = '';
        if (!hallucinating) {
            if ((monster.mfrozen ?? 0) > 0)
                condition = ", can't move (paralyzed or sleeping or busy)";
            else if (monster.msleeping)
                condition = ', asleep';
            else if ((monster.mstrategy ?? 0) & STRAT_WAITMASK)
                condition = ', meditating';
        }
        const tail = monster.mx !== x || monster.my !== y;
        // look_at_monster() gates hidden details on the selected square,
        // which can be a worm tail outside the head's cloud.
        const hidden = monster.mundetected || M_AP_TYPE(monster) || visibleRegionAt(game, x, y)
            ? await monsterHiddenConditions(monster, game, { showAlternateMonster: false })
            : [];
        const hiddenText = hidden.length ? `, ${hidden.join(', ')}` : '';
        return `${tail ? 'tail of a ' : ''}${prefix}${name}${condition}${hiddenText}`;
    }

    const trap = game.level?.traps?.find(candidate =>
        candidate.tx === x && candidate.ty === y && candidate.tseen);
    if (trap?.ttyp === DART_TRAP) return 'dart trap';
    if (trap?.ttyp === BEAR_TRAP) return 'bear trap';
    const loc = game.level?.at(x, y);
    if (!loc) return '';
    const glyph = glyphAt(x, y);
    // pager.c:lookat() recognizes liquid cmap glyphs, including memory,
    // then waterbody_name() describes the current surface at that square.
    if (glyph?.kind === 'terrain' && [
        CmapSymbol.pool, CmapSymbol.water, CmapSymbol.lava,
        CmapSymbol.lavawall, CmapSymbol.ice,
    ].some(symbol => glyph.glyph === cmapToGlyph(symbol))) {
        const description = waterbodyName(x, y);
        // do_screen_description() adds strength only to plain "ice";
        // hallucinated frozen liquids retain their waterbody_name().
        return description === 'ice' ? iceDescriptionAt(x, y) : description;
    }
    // do_screen_description() applies the Quest gate to the glyph's stair
    // description, whether the stair is visible now or remembered.
    if (glyph?.kind === 'terrain' && glyph.terrainName === 'staircase down'
        && onQuestStart(game) && !okToQuest(game))
        return 'blocked staircase down';
    if (loc.disp_glyph?.kind === 'nothing') return 'dark part of a room';
    // pager.c:do_screen_description() recognizes the concrete S_cloud glyph
    // before the generic '#' ambiguity list.  Moving elemental bubbles can
    // therefore be "fog/vapor cloud" even though their tty character is the
    // same as a remembered corridor.
    if (loc.typ === CLOUD)
        return Is_airlevel(game.u?.uz) ? 'cloudy area' : 'fog/vapor cloud';
    // display.c:reglyph_darkroom() keeps an explored but never-lit room as
    // GLYPH_NOTHING once it leaves sight.  The physical tty cell can still
    // contain the DECgraphics floor character from an earlier getpos paint,
    // but pager.c describes glyph_at(), hence "dark part of a room".
    if (!cansee(x, y) && loc.typ === ROOM && loc.seenv && !loc.waslit)
        return 'dark part of a room';
    // pager.c describes the projected screen glyph.  A blind hero can retain
    // a stone/blank memory over real corridor terrain, so consulting `typ`
    // first leaks topology and produces the wrong automatic getpos label.
    if (!cansee(x, y) && loc.remembered_glyph?.kind === 'terrain') {
        const remembered = loc.remembered_glyph.ch;
        if (remembered === ' ') return 'stone';
        if (remembered === '#') return 'corridor';
        if (remembered === '.') return 'floor of a room';
        if (remembered === '<') return 'staircase up';
        if (remembered === '>')
            return travelLocationDescription(x, y) || 'staircase down';
        if (remembered === '{') return 'fountain';
        if (remembered === '+') {
            return loc.typ === DOOR && loc.doormask === D_ISOPEN
                ? 'open door' : 'closed door';
        }
        return loc.remembered_glyph.terrainName;
    }
    if (loc.typ === FOUNTAIN) return 'fountain';
    if (loc.typ === SINK) return 'sink';
    if (loc.typ === STONE) return 'stone';
    if (IS_WALL(loc.typ)) return 'wall';
    if (loc.typ === DOOR)
        return loc.doormask === D_ISOPEN ? 'open door' : 'closed door';
    if (loc.typ === ROOM) return 'floor of a room';
    if (loc.typ === CORR) return 'corridor';
    return glyph?.kind === 'terrain' ? glyph.terrainName : travelLocationDescription(x, y);
}

// C apply.c:dojump(): the physical command shares the spell's jump owner.
async function dojump(): Promise<void> {
    const result = await jumpHero(0);
    game.context.move = result.spentTime ? 1 : 0;
}

async function verboseFarlookDescription(x: number, y: number): Promise<string> {
    const loc = game.level?.at(x, y);
    if (loc?.typ === CORR)
        return `#\x1b[8Ccan be many things (corridor)`;
    if (loc?.typ === STONE)
        return `\x1b[9Ccan be many things (stone)`;
    if (loc && IS_WALL(loc.typ)) {
        const glyph = terrain_glyph(loc, x, y);
        const symbol = glyph.dec ? `\x0e${glyph.ch}\x0f` : glyph.ch;
        return `${symbol}\x1b[8Cthe interior of a monster or a wall (wall)`;
    }
    if (loc?.typ === ROOM) {
        const glyph = terrain_glyph(loc, x, y);
        if (glyph.dec && glyph.ch === '~') {
            return '\x0e~\x0f\x1b[8Ca doorway or the floor of a room'
                + ' or the dark part of a room or ice (floor of a room)';
        }
    }
    return farlookLocationDescription(x, y);
}

// C refs: cmd.c dotravel(), getpos.c getpos(), hack.c handle_tip(), and
// dat/nhcore.lua show_getpos_tip().  The tty message window and the Lua text
// window own distinct input boundaries; after the tutorial, getpos retains
// its cursor and accepts terrain-symbol cycling before one of the pick keys.
async function dotravel(): Promise<void> {
    const firstUse = shouldShowGetposTip();
    if (firstUse) {
        await pline('Where do you want to travel to?');
        await showGetposTip();
    }

    const cursor = await selectMapPosition({
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
        game.context.move = 0;
        return;
    }

    // getpos() leaves its painted location description on the physical tty
    // after the pick key, but removes it from the logical topline transaction.
    // Silent travel can retain that row; a new attack must replace rather than
    // append to "staircase down".
    game._pending_message = '';
    if (cursor.x === game.u.ux && cursor.y === game.u.uy) {
        game._travelTarget = null;
        await pline('You are already here.');
        game.context.move = 0;
        return;
    }
    const state = startTravel(cursor.x, cursor.y);
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
// Quick far-look is a zero-time modal command.  It shares getpos's cached
// cursor with travel, paints a short automatic description after movement,
// then restores the gameplay cursor while showing the verbose selection.
async function doFarlook(quick = true): Promise<void> {
    const verbose = !!game.flags.verbose && !quick;
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
        start: game._travelTarget
            ? { ...game._travelTarget } : { x: game.u.ux, y: game.u.uy },
        prompt: game._pending_message || game._retained_message,
        goal: 'a monster, object or location',
        describe: farlookLocationDescription,
    });
    if (!cursor) {
        game.context.move = 0;
        return;
    }
    // getpos has already handed its short automatic label back to the
    // message window.  pager.c then uses putmixed(WIN_MESSAGE), whose long
    // description wraps and calls tty more() before do_look() can return.
    game._pending_message = '';
    game._retained_message = '';
    await plineWithContinuation(await verboseFarlookDescription(cursor.x, cursor.y));
    game.context.move = 0;
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
    const entries = [
        { key: '/', text: 'something on the map' },
        { key: 'i', text: "something you're carrying" },
        { key: '?', text: 'something else (by symbol or name)' },
        '',
        { key: 'm', text: 'nearby monsters' },
        { key: 'M', text: 'all monsters shown on map' },
        { key: 'o', text: 'nearby objects' },
        { key: 'O', text: 'all objects shown on map' },
        { key: 't', text: 'nearby traps' },
        { key: 'T', text: 'all seen or remembered traps' },
        { key: 'e', text: 'nearby engravings' },
        { key: 'E', text: 'all seen or remembered engravings' },
    ];
    const validKeys = [
        27, 32, 10, 13,
        ...'/i?mMoOtTeE'.split('').map(char => char.charCodeAt(0)),
    ];
    const queuedKey = takeCommandKey();
    const key = queuedKey ?? await showChoiceWindow({
        title: 'What do you want to look at:',
        entries,
        validKeys,
    });
    if (queuedKey === undefined) await restoreHelpMap();
    const choice = String.fromCharCode(key);
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
        { key: 'i', text: "Using the '#optionsfull' or 'm O' command to set options." },
        { key: 'j', text: 'Full list of keyboard commands.' },
        { key: 'k', text: 'List of extended commands.' },
        { key: 'l', text: 'List menu control keys.' },
        { key: 'm', text: "Description of NetHack's command line." },
        { key: 'n', text: 'The NetHack license.' },
        { key: 'o', text: 'Support information.' },
        { key: 'p', text: 'List of wizard-mode commands.' },
    ];
    const validKeys = [
        27, 32, 10, 13,
        ...'abcdefghijklmnop'.split('').map(char => char.charCodeAt(0)),
    ];
    const key = await showChoiceWindow({
        title: 'Select one item:',
        entries,
        validKeys,
    });
    await restoreHelpMap();
    if (String.fromCharCode(key) === 'e') {
        await dowhatis();
        return;
    }
    game.context.move = 0;
}

async function doputon(): Promise<void> {
    const accessories = (game.inventory || []).filter(object =>
        (object.class === 'Rings' || object.oclass === 4
            || object.class === 'Amulets' || object.oclass === 5
            || object.otyp === RIN_CONFLICT
            || object.otyp === LENSES
            || object.otyp === BLINDFOLD || object.otyp === TOWEL)
        && object !== game.uright && object !== game.uleft
        && object !== game.uamul);
    if (!accessories.length) {
        await pline("You don't have anything appropriate to put on.");
        game.context.move = 0;
        return;
    }

    const letters = accessories.map(object => object.invlet).join('');
    const selection = String.fromCharCode(await promptKey(
        `What do you want to put on? [${letters} or ?*] `,
    ));
    game._pending_message = '';
    const inventoryObject = (game.inventory || []).find(candidate =>
        candidate.invlet === selection);
    const object = accessories.find(candidate => candidate === inventoryObject);
    // do_wear.c:equip_ok() returns GETOBJ_DOWNPLAY for armor selected by P:
    // it is omitted from the suggested-letter prompt but a direct inventory
    // letter is accepted and enters the same armor-on transaction as W.
    if (!object && inventoryObject
        && (inventoryObject.class === 'Armor'
            || inventoryObject.oclass === 3)) {
        await putOnArmorObject(inventoryObject);
        return;
    }
    if (!object) {
        game.context.move = 0;
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
        await wearHeroAccessory(object, 'uamul', game);
        game.context.move = 1;
        return;
    }

    if ((object.oclass === 4 || object.class === 'Rings')
        && heroHasNoLimbs(game)) {
        await pline('You cannot make the ring stick to your body.');
        game.context.move = 0;
        return;
    }

    let hand: 'left' | 'right';
    if (!game.uleft && !game.uright) {
        const finger = String.fromCharCode(await promptKey(
            'Which ring-finger, Right or Left? [rl] ',
        )).toLowerCase();
        if (finger !== 'r' && finger !== 'l') {
            game.context.move = 0;
            return;
        }
        hand = finger === 'r' ? 'right' : 'left';
    } else {
        hand = game.uright ? 'left' : 'right';
    }

    const ringSlot = hand === 'right' ? 'uright' : 'uleft';
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
    await removeHeroArmor(object, game);
    await announceDisplacementLoss(object, game);
    if (silent || game.flags?.verbose === false) return '';
    return armorOffMessage(object, game);
}

// C do_wear.c:dotakeoff()/doremring() share armor_or_accessory_off().
// T suggests armor and R suggests accessories; either accepts the other kind.
async function removeWornItem(action: 'remove' | 'take off', itemAction = false): Promise<void> {
    const worn = (game.inventory || []).filter(object => object.worn);
    if (!worn.length) {
        await pline(action === 'remove'
            ? 'Not wearing any accessories or armor.'
            : 'Not wearing any armor or accessories.');
        game.context.move = 0;
        return;
    }

    let object: GameObject | null | undefined;
    let inventoryPrompt: string | null = null;
    const preferred = worn.filter(candidate => action === 'remove'
        ? candidate.oclass === 4 || candidate.oclass === 5 || isEyewear(candidate)
        : candidate.class === 'Armor' || candidate.oclass === 3);
    // C ia_dotakeoff() forces getobj() to consume the queued item letter,
    // even if another accessible piece is the only normal suggestion.
    if (preferred.length === 1 && !itemAction) {
        [object] = preferred;
    } else {
        const letters = preferred.map(candidate => candidate.invlet).join('');
        const prompt = `What do you want to ${action}? [${letters} or ?*] `;
        inventoryPrompt = prompt;
        const selection = await promptInventoryObject(prompt, worn);
        if (selection.cancelled) {
            game.context.move = 0;
            return;
        }
        object = selection.object;
    }
    if (!object) {
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
        const wasStrangled = object.otyp === AMULET_OF_STRANGULATION
            && heroIsStrangled(game);
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
        findArmorClass(game);
        if (!ring && game.flags?.verbose !== false) {
            await plineWithContinuation(armorOffMessage(object, game));
        }
        if (wasStrangled) {
            await plineWithContinuation(heroIsBreathless(game)
                ? `Your ${heroNeckName(game)} is no longer constricted!`
                : 'You can breathe more easily!');
            learnObjectType(AMULET_OF_STRANGULATION, game);
        }
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

    const previousArmorClass = game.u?.uac ?? 10;
    // do_wear.c:off_msg() is conditional on flags.verbose.  When disabled,
    // immediate zero-delay armor removal leaves getobj's selector as the
    // physical topline even though the timed state change has committed.
    game._pending_message = '';
    if (game.flags?.verbose === false && inventoryPrompt)
        game._retained_message = inventoryPrompt.trimEnd();
    const removalMessage = await finishArmorRemoval(object);
    if (removalMessage && game.u?.uac !== previousArmorClass)
        game._statusAcOverride = previousArmorClass;
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
        if (onMessage) {
            if (effectMessages.length) await plineWithContinuation(onMessage);
            else await pline(onMessage);
        }
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
        object.class === 'Weapons' || object.oclass === 2
        || (object.oclass === 6 && OBJECT_SUBTYPE[object.otyp] !== 0))
        .sort((left, right) =>
            String(left.invlet || '').localeCompare(
                String(right.invlet || ''),
            ));
    const letters = weapons.map(object => object.invlet).join('');
    const choices = ['-', compactInventoryLetters(letters)].filter(Boolean).join(' ');
    const prompt = `What do you want to wield? [${choices} or ?*] `;
    const selection = await promptInventoryObject(
        prompt, game.inventory || [], {
            verb: 'wield',
            classify: object => object.oclass === 12 ? GETOBJ_EXCLUDE
                : object.oclass === 2 || isWeaponTool(object) ? GETOBJ_SUGGEST : GETOBJ_DOWNPLAY,
            allowNone: true, allowMenu: true,
            menuItems: weapons.length ? weapons : game.inventory.filter(item => item.oclass !== 12),
            noneDescription: `your ${game.uarmg ? 'gloved' : 'bare'} ${
                makePlural(heroHandName(game))}${game.uwep ? '' : ' (wielded)'}`,
        },
    );
    if (selection.cancelled) {
        game.context.move = 0;
        return;
    }

    const object = selection.object;
    if (!selection.none && !object) {
        game.context.move = 0;
        return;
    }
    if (object && object === game.uwep) {
        await pline('You are already wielding that!');
        if (isWeaponTool(object) || isWetTowel(object)) game._unweapon = false;
        game.context.move = 0;
        return;
    }
    if (await refuseWeldedPrimary()) {
        resetBulkTakeoff();
        game.context.move = 0;
        return;
    }
    if (selection.none) {
        if (!game.uwep) {
            await pline('You are already bare handed.');
            game.context.move = 0;
            return;
        }
        await plineWithContinuation('You are bare handed.');
        await setPrimaryWeapon(null, game);
        game.context.move = 1;
        return;
    }

    if (!object) {
        game.context.move = 0;
        return;
    }

    // C dowield() hands an alternate-weapon selection to doswapweapon()
    // rather than treating it as an unrelated primary.  That continuation
    // prints the new primary before committing the old primary as secondary;
    // tty can page between those two prinv() calls, before monster time.
    if (object === (game.uswapwep || game.u?.uswapwep)) {
        await doswapweapon();
        return;
    }
    if (object.worn && object.class !== 'Weapons' && object.oclass !== 2) {
        await pline('You cannot wield that!');
        game.context.move = 0;
        return;
    }
    if (object.oartifact) {
        const artifact = artifactById(object.oartifact);
        const touch = await touchArtifactByHero(object, artifact);
        if (!touch.allowed || touch.died) {
            game.context.move = 1;
            return;
        }
    }

    observeObjectForNaming(object);
    const oldPrimary = game.uwep || game.u?.uwep || null;
    const wasTwoWeapon = game.u.twoweap;
    if (willWeld(object)) {
        await announceWeaponWeld(object);
    } else {
        const description = inventoryItemDescription(object, { projectPrimaryHand: true });
        await plineWithContinuation(`${object.invlet} - ${description}.`);
    }
    await setPrimaryWeapon(object, game);
    await explainTwoWeaponEnd(wasTwoWeapon);
    await lightWieldedArtifact(object);
    // C dowield() applies pushweapon only after ready_weapon() has installed
    // the new primary.  The displaced primary becomes the authoritative
    // secondary object; preserving that identity is what makes a later
    // selection of it enter doswapweapon() and its two-prinv continuation.
    if (game.flags?.pushweapon && oldPrimary && oldPrimary !== object) {
        await setSecondaryWeapon(oldPrimary, game);
    }
    game.context.move = 1;
}

// C refs: do_wear.c dowear(), accessory_or_armor_on(), and the negative
// `multi`/afternmv completion in allmain.c.  Armor is installed in its worn
// slot immediately, but its known state and completion message are delayed
// until the required elapsed-turn scheduler round has finished.
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
    const object = await chooseInventoryObject('wear', candidate => {
        if ((candidate.owornmask ?? 0) & (W_ARMOR | W_ACCESSORY))
            return GETOBJ_EXCLUDE_INACCESS;
        if (candidate.oclass === 3) return GETOBJ_SUGGEST;
        if (candidate.oclass === 4 || candidate.oclass === 5
            || isEyewear(candidate) || candidate.otyp === MEAT_RING)
            return GETOBJ_DOWNPLAY;
        return GETOBJ_EXCLUDE;
    });
    if (!object) {
        game.context.move = 0;
        return;
    }
    if (object.oclass === 3) await putOnArmorObject(object);
    else await putOnAccessoryObject(object);
}

// C refs: shk.c:dopay(), rouse_shk(), menu_pick_pay_items(), pay(), and update_bill().
// An empty bill takes a turn when the keeper can respond. A payment menu
// takes no time until a debt or billed item is paid.
async function dopay(): Promise<void> {
    game.multi = 0;
    const shopkeepers = (game.level?.monsters || [])
        .filter(monster => monster?.isshk && (monster.mhp ?? 1) > 0);
    const adjacent = shopkeepers.filter(monster =>
        distmin(monster.mx, monster.my, game.u?.ux, game.u?.uy) <= 1);
    const resident = adjacent.length === 1
        ? adjacent[0] : shopkeeperForHero();
    const blind = !!game.blind || (game.u?.blindTurns ?? 0) > 0;
    const blindTelepathy = !!(game.u?.blindTelepathy || game.u?.telepathy);
    if (!resident) {
        // shk.c:dopay() cannot conclude that there is no shopkeeper while a
        // non-telepathic hero is blind.  An adjacent shopkeeper was selected
        // above; otherwise the visibility failure precedes the no-resident
        // message even when this level actually has no shopkeeper at all.
        if (blind && !blindTelepathy) {
            await pline("You can't see...");
            game.context.move = 0;
            return;
        }
        await pline('There appears to be no shopkeeper here to receive your payment.');
        game.context.move = 0;
        return;
    }

    if (resident.msleeping || !resident.mcanmove) {
        // Outstanding charges rouse the keeper before payment can proceed.
        if (resident.eshk?.robbed || resident.eshk?.billct || resident.eshk?.debit) {
            if (canSpotMonster(resident)) {
                const recovery = resident.msleeping ? 'wakes up' : 'can move again';
                await plineWithContinuation(`${shopkeeperName(resident, { capitalized: true })} ${recovery}.`);
            }
            resident.msleeping = 0;
            resident.mfrozen = 0;
            resident.mcanmove = 1;
        } else {
            const name = shopkeeperName(resident, { capitalized: true });
            const response = rn2(2) ? 'seems to be napping' : "doesn't respond";
            await plineWithContinuation(`${name} ${response}.`);
            game.context.move = 0;
            return;
        }
    }

    let paid = false;
    const debt = Math.max(0, resident.eshk?.debit ?? 0);
    if (debt) {
        await pline(
            `You owe ${shopkeeperName(resident)} ${debt} zorkmid${
                debt === 1 ? '' : 's'
            } for the use of merchandise.`,
        );
        const payment = payShopDebt(resident, game);
        if (!payment.paid) {
            await pline("But you don't have enough gold or credit.");
            game.context.move = 1;
            return;
        }
        if (payment.creditUsed === payment.debt) {
            await pline('Your debt is covered by your credit.');
        } else if (payment.creditUsed) {
            await pline('That debt is partially offset by your credit.');
            await pline('You pay the remainder.');
        } else {
            await pline('You pay that debt.');
        }
        paid = true;
    }

    // pay_billed_items() checks the whole bill, including contained goods,
    // before offering item selection. Stashed gold cannot fund this payment.
    if (resident === shopkeeperForHero() && (resident.eshk?.billct ?? 0) > 0
        && !heroGoldAmount(game) && !(resident.eshk?.credit ?? 0)) {
        await plineWithContinuation(`You ${hiddenGold(game, true) ? 'seem to ' : ''}have no gold or credit${paid ? ' left' : ''}.`);
        if (paid && resident.mpeaceful)
            await plineWithContinuation(shopThankYouMessage(resident));
        game.context.move = paid ? 1 : 0;
        return;
    }

    if (resident === shopkeeperForHero()) {
        const purchase = minimumShopPurchase(resident);
        if (purchase && heroGoldAmount(game) + (resident.eshk?.credit ?? 0) < purchase.price) {
            const items = purchase.multipleItems ? ' any of the items' : ' the item';
            const bill = (resident.eshk?.billct ?? 0) > 1 ? "you've picked" : 'on your bill';
            await plineWithContinuation(`You don't have enough gold to buy${items} ${bill}.`);
            if (hiddenGold(game, true))
                await plineWithContinuation('Maybe you have some gold stashed away?');
            if (paid && resident.mpeaceful)
                await plineWithContinuation(shopThankYouMessage(resident));
            game.context.move = paid ? 1 : 0;
            return;
        }
    }

    const billed = carriedShopBill(resident);
    if (!billed.length) {
        if (!paid) {
            await plineWithContinuation(`You do not owe ${resident.eshk?.shknam || 'the shopkeeper'} anything.`);
            if (resident === shopkeeperForHero() && resident.mpeaceful && !heroGoldAmount(game))
                await plineWithContinuation(`Moreover, you${hiddenGold(game, true) ? ' seem to' : ''} have no gold.`);
            game.context.move = 1;
            return;
        }
        await plineWithContinuation(shopThankYouMessage(resident));
        game.context.move = 1;
        return;
    }

    for (const item of billed) observeObjectForNaming(item.object);
    const sections = [{
        heading: '',
        items: billed.map((item, index) => ({
            key: String.fromCharCode(97 + index),
            text: `${item.price} Zm, ${floorObjectDescription(item.object)}`,
            value: item,
        })),
    }];
    game._pending_message = '';
    await flush_screen(1);
    const selected = await showMultiSelectWindow({
        title: 'Pay for which items?', sections,
        omitHeadings: true,
    });
    if (!selected.length) {
        game.context.move = paid ? 1 : 0;
        return;
    }

    let paidForItem = false;
    for (const item of selected) {
        if (!settleCarriedShopBillItem(resident, item)) continue;
        paidForItem = true;
        observeObjectForNaming(item.object);
        await pline(`You bought ${floorObjectDescription(item.object)} for ${item.price} gold piece${item.price === 1 ? '' : 's'}.`);
    }
    if (!paid && !paidForItem) {
        game.context.move = 0;
        return;
    }
    await plineWithContinuation(shopThankYouMessage(resident));
    game.context.move = 1;
}

// C ref: cmd.c do_fight()/rhack().  F is a movement prefix whose next
// direction key is collected without painting a separate tty prompt.  The
// direction still enters domove(); context.forcefight changes how that shared
// movement transaction treats actors and empty destinations.
async function doforcefight(): Promise<void> {
    game._pending_message = '';
    // The direction read is its own tty input boundary.  C clears the old
    // message window before collecting that key, so make the cleared row
    // visible before nhgetch() captures the nested prompt screen.
    const input = await readCommandInput();
    const nextCommand = configuredCommand(input.key);
    if (!await commandAllowed(nextCommand.command)) {
        resetCommandVariables(true);
        return;
    }
    const direction = nextCommand.key === null ? ''
        : String.fromCharCode(nextCommand.key).toLowerCase();
    if (!isMovementKey(direction)) {
        await pline(
            "The 'F' prefix should be followed by a movement command.",
        );
        game.context.move = 0;
        return;
    }
    game.context.forcefight = true;
    if (game.multi > 0)
        startRun(DIR_DX[direction], DIR_DY[direction], game, 0);
    try {
        const moved = await domove(
            DIR_DX[direction], DIR_DY[direction], true,
        );
        if (game.program_state.gameover) return;
        game.context.move = moved ? 1 : 0;
    } finally {
        if (!game.program_state.gameover) game.context.forcefight = false;
    }
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
            game.context.move = 0;
            return;
        }
        const letters = inventory.filter(object => object !== gold)
            .map(object => object.invlet).join('');
        const prompt = `What do you want to drop? [${gold ? '$' : ''}${compactInventoryLetters(letters)} or ?*] `;
        const selection = await promptInventoryObject(prompt, inventory, {
            allowGold: true, allowMenu: true, allowCount: true,
        });
        if (selection.cancelled) {
            game.context.move = 0;
            return;
        }
        let object = selection.gold ? gold : selection.object;
        if (!object) {
            game.context.move = 0;
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
        game.context.move = spentTime ? 1 : 0;
        if (spentTime) resetBulkTakeoff();
        // Lock-picking's resumable record lives in the occupation itself.
        if (spentTime && game._occupation?.key === 'pick-lock')
            game._occupation = null;
    } finally {
        if (inShop) setSellDisposition(SELL_NORMAL);
    }
}

async function useStethoscope(item: GameObject): Promise<void> {
    const direction = promptedDirectionKey(
        await readDirectionKey(), game.commandBindings,
    );
    if (!isMovementKey(direction) && direction !== '.') {
        game.context.move = 0;
        return;
    }

    const heroActionSeq = game._heroActionSeq ?? 0;
    const usedTime = game._stethoscopeSeq === heroActionSeq;
    game._stethoscopeSeq = heroActionSeq;

    if (direction === '.') {
        await plineWithContinuation(heroStatusLine(game));
        game.context.move = usedTime ? 1 : 0;
        return;
    }

    const x = game.u.ux + DIR_DX[direction];
    const y = game.u.uy + DIR_DY[direction];
    const monster = game.level?.monsters?.find(candidate => monsterHasMapPosition(candidate, game) &&
        (candidate.mhp ?? 1) > 0 && candidate.mx === x && candidate.my === y);
    if (monster?.mappearance) {
        const appearance = M_AP_TYPE(monster) === M_AP_OBJECT
            ? (OBJECT_NAMES[monster.mappearance] || 'thing') : 'thing';
        const monsterName = MONSTER_NAME[monster.mnum] || 'monster';
        monster.m_ap_type = 0;
        monster.mappearance = 0;
        newsym(x, y);
        await pline(`That ${appearance} is really ${withIndefiniteArticle(monsterName)}.`);
        await plineWithContinuation(await monsterStatusLine(monster));
    } else if (!monster) {
        await pline('You hear nothing special.');
    } else {
        await plineWithContinuation(await monsterStatusLine(monster));
    }

    game.context.move = usedTime ? 1 : 0;
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
    const key = await readDirectionKey();
    const direction = promptedDirectionKey(key, game.commandBindings);
    if (!isMovementKey(direction)) {
        const quitDirection = [27, 32, 10, 13].includes(key);
        if (!quitDirection && game.flags?.cmdassist !== false) {
            await showTextPages([directionAssistPage()], {
                validKeys: [27, 32, 10, 13],
            });
            game._pending_message = '';
            await restoreCommandMap();
        } else if (!quitDirection) {
            await pline('What a strange direction!');
        }
        game.context.move = 0;
        return;
    }

    const x = game.u.ux + DIR_DX[direction];
    const y = game.u.uy + DIR_DY[direction];
    const loc = game.level?.at(x, y);
    if (loc?.typ !== DOOR) await pline('You see no door there.');
    else if (loc.doormask === D_NODOOR)
        await pline('This doorway has no door.');
    else if (loc.doormask === D_BROKEN)
        await pline('This door is broken.');
    else if (loc.doormask & (D_CLOSED | D_LOCKED))
        await pline('This door is already closed.');
    else {
        loc.doormask = D_CLOSED;
        newsym(x, y);
        await pline('The door closes.');
        game.context.move = 1;
        return;
    }
    game.context.move = 0;
}

// C refs: lock.c doopen(); cmd.c get_adjacent_loc()/getdir().  Direction
// validation is owned by the same modal assistance transaction as close;
// the door mutation happens only after that transaction returns a direction.
async function doopen(): Promise<void> {
    if (heroHasNoHands(game)) {
        await pline("You can't open anything -- you have no hands!");
        game.context.move = 0;
        return;
    }
    const key = await readDirectionKey();
    const direction = promptedDirectionKey(key, game.commandBindings);
    if (!isMovementKey(direction)) {
        const quitDirection = [27, 32, 10, 13].includes(key);
        if (!quitDirection && game.flags?.cmdassist !== false) {
            await showTextPages([directionAssistPage()], {
                validKeys: [27, 32, 10, 13],
            });
            game._pending_message = '';
            await restoreCommandMap();
        } else if (!quitDirection) {
            await pline('What a strange direction!');
        }
        // lock.c:doopen_indir() uses cmd.c:get_adjacent_loc(), whose caller
        // projection always follows a failed getdir() with Never_mind.
        await pline('Never mind.');
        game.context.move = 0;
        return;
    }

    if (game.u.utrap && game.u.utraptype === TT_PIT) {
        await pline("You can't reach over the edge of the pit.");
        game.context.move = 0;
        return;
    }

    const x = game.u.ux + DIR_DX[direction];
    const y = game.u.uy + DIR_DY[direction];
    const loc = game.level?.at(x, y);
    if (loc?.typ !== DOOR) {
        await pline('You see no door there.');
        game.context.move = 0;
        return;
    }
    if (loc.doormask === D_BROKEN) {
        await pline('This door is broken.');
        game.context.move = 0;
        return;
    }
    if (loc.doormask === D_NODOOR) {
        await pline('This doorway has no door.');
        game.context.move = 0;
        return;
    }
    if (loc.doormask === D_ISOPEN) {
        await pline('This door is already open.');
        game.context.move = 0;
        return;
    }
    if (loc.doormask & D_LOCKED) {
        game.context.move = Number(await openLockedDoor(loc, x, y));
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
    if (heroIsBlind(game)) feel_location(x, y);
    else newsym(x, y);
    vision_reset();
    vision_recalc(0);
}

// C refs: write.c dowrite()/write_ok(); invent.c getobj().  The object picker
// retains ownership after an absent inventory letter and reopens the same
// prompt once its More boundary is dismissed.
async function useMagicMarker(): Promise<void> {
    const prompt = 'What do you want to write on? [*] ';
    let key = await promptKey(prompt);
    for (;;) {
        if ([27, 10, 13].includes(key)) {
            game.context.move = 0;
            return;
        }
        const letter = String.fromCharCode(key);
        const paper = game.inventory?.find(item => item.invlet === letter);
        if (paper) {
            if (paper.oclass !== 9 && paper.oclass !== 10) {
                await pline('That is a silly thing to write on.');
                game.context.move = 0;
                return;
            }
            await pline(`That ${paper.oclass === 10 ? 'spellbook' : 'scroll'} is not blank!`);
            game.context.move = 1;
            return;
        }

        const invalid = "You don't have that object.--More--";
        await pline(invalid);
        await flush_screen(1);
        game.nhDisplay?.setCursor(invalid.length, 0);
        do key = await nhgetch();
        while (![27, 32, 10, 13].includes(key));
        if (key === 27) {
            game.context.move = 0;
            return;
        }
        await pline(prompt);
        await flush_screen(1);
        game.nhDisplay?.setCursor(prompt.length, 0);
        key = await nhgetch();
    }
}

async function pickAxeDirection(prompt: string): Promise<{ dx: number; dy: number; dz: number } | null> {
    for (;;) {
        const rawKey = await readDirectionKey(`${prompt} `);
        const key = rawKey;
        const ch = promptedDirectionKey(key, game.commandBindings);
        if (isMovementKey(ch))
            return { dx: DIR_DX[ch], dy: DIR_DY[ch], dz: 0 };
        if (ch === '.' || ch === 's') return { dx: 0, dy: 0, dz: 0 };
        if (ch === '<' || ch === '>')
            return { dx: 0, dy: 0, dz: ch === '<' ? -1 : 1 };
        if ([27, 32, 10, 13].includes(key)) return null;
        if (key === 18) {
            await restoreCommandMap();
            continue;
        }
        if (key === game.commandBindings.specialKey('getdir.help') || game.flags?.cmdassist !== false) {
            await showTextPages([directionAssistPage()], {
                validKeys: [27, 32, 10, 13],
            });
            await restoreCommandMap();
        } else await pline('What a strange direction!');
        if (key !== game.commandBindings.specialKey('getdir.help')) return null;
    }
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
        game.context.move = 0;
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
        const direction = await getAdjacentLocation(
            'In what direction?', null, game.u.ux, game.u.uy,
        );
        if (!direction) return item;
        game._pending_message = '';
        const result = await useBullwhip(item, direction, {
            state: game,
            attackMonster: (monster: Monster) => attackHostileMonster(
                monster, monster.mx, monster.my,
            ),
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
        await useStethoscope(item);
        return item;
    }
    if (item.otyp === TIN_OPENER) {
        const result = await useTinOpener(item, { state: game, swapWeapons: doswapweapon });
        if (!result.heroDied) game.context.move = Number(result.usedTime);
        return item;
    }
    if (item.otyp === MAGIC_MARKER) {
        await useMagicMarker();
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
        const direction = await readDirectionKey();
        const directionKey = promptedDirectionKey(direction, game.commandBindings);
        if (isMovementKey(directionKey)) {
            const x = game.u.ux + DIR_DX[directionKey];
            const y = game.u.uy + DIR_DY[directionKey];
            const loc = game.level?.at(x, y);
            await pline(loc?.typ === DOOR
                && !(loc.doormask & (D_CLOSED | D_LOCKED))
                ? 'You cannot lock an open door.'
                : 'You see no door there.');
        }
        game.context.move = 1;
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

function splitStackForQuiver(item: GameObject, count: number): GameObject {
    const child = splitCarriedStack(item, count);
    child.invlet = null;
    assignInventoryLetter(child);
    if (!child.invlet) child.invlet = '#';
    return child;
}

async function reportWeldedPrimary(item: GameObject): Promise<boolean> {
    const newlyKnown = !item.bknown;
    item.bknown = true;
    observeObjectForNaming(item);
    const hand = item.bimanual ? 'hands' : 'hand';
    await pline(
        `${inventoryItemDescription(item)} is welded to your ${hand}!`,
    );
    return newlyKnown;
}

function splittableForQuiver(item: GameObject): boolean {
    return !(item?.otyp === LOADSTONE && item.cursed)
        && !isWeldedPrimary(item);
}

function hasFreeBasicInventoryLetter(): boolean {
    const basicLetters = new Set((game.inventory || [])
        .map(item => item.invlet)
        .filter(letter => /^[a-zA-Z]$/.test(letter || '')));
    return basicLetters.size < 52;
}

async function doquiverCore(verb: 'ready' | 'fire'): Promise<QuiverCommandResult> {
    game.multi = 0;
    if (!(game.inventory || []).length) {
        await pline('You have nothing to ready for firing.');
        game.context.move = 0;
        return { item: null, spentTime: false, cancelled: false };
    }
    const suggestions = game.inventory.filter(item => readySuggestion(item, game));
    const letters = suggestions.map(item => item.invlet).join('');
    const noneSuggested = !!game.uquiver;
    const choices = `${noneSuggested ? '- ' : ''}${compactInventoryLetters(letters)}`.trim();
    const prompt = `What do you want to ${verb}? [${choices ? `${choices} or ?*` : '*'}] `;
    const selection = await promptInventoryObject(
        prompt, game.inventory || [], {
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
        const spentTime = await reportWeldedPrimary(item);
        game.context.move = spentTime ? 1 : 0;
        return {
            item: null, spentTime, cancelled: false,
        };
    }

    const requestedCount = selection.count;
    const initialQuantity = item.quantity ?? item.quan ?? 1;
    const partialCount = requestedCount !== null
        && requestedCount < initialQuantity;
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
        item = splitStackForQuiver(item, requestedCount);
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
                item = splitStackForQuiver(item, quantity - 1);
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
        const fireassist = game.flags?.fireassist !== false;
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
        await dothrow(fireObject, true, shotLimit);
        if (quiverSelectionSpentTime && !game.context.move)
            game.context.move = 1;
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

async function dothrow(
    selectedItem: GameObject | null = null, capabilityChecked = false, suppliedShotLimit: number | null = null,
) {
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
    const throwables = (game.inventory || []).filter(item =>
        (item.oclass || objectClassForType(item.otyp))
            === (wieldingSling ? 13 : 2)
        && !(item === game.uwep && (item.quantity ?? item.quan ?? 1) === 1));
    const inventoryLetters = throwables.map(item => item.invlet).join('');
    const letters = `${heroGoldAmount(game) > 0 ? '$' : ''}${inventoryLetters}`;
    const prompt = letters
        ? `What do you want to throw? [${letters} or ?*] `
        : 'What do you want to throw? [*] ';
    if (!selectedItem) {
        let key = await promptKey(prompt);
        for (;;) {
            if ([27, 32, 10, 13].includes(key)) {
                await pline('Never mind.');
                game.context.move = 0;
                return;
            }
            if (key === 63) {
                ({ key } = await selectInventoryObject({
                    // invent.c:getobj(): `?` normally lists suggestions.  If
                    // lets is empty but altlets forced the prompt, it lists
                    // those downplayed objects instead.
                    items: throwables.length
                        ? throwables : (game.inventory || []),
                    includeGold: true,
                }));
                if (!key) key = await promptKey(prompt);
                continue;
            }
            if (key === 42) {
                ({ key } = await selectInventoryObject());
                if (!key) key = await promptKey(prompt);
                continue;
            }
            selectedItem = game.inventory?.find(candidate =>
                candidate.invlet === String.fromCharCode(key)) ?? null;
            if (selectedItem) break;

            // invent.c:getobj() retains the picker after an absent letter.
            // Reissuing its prompt forces tty to acknowledge the intervening
            // error line, so the recorded boundary exposes --More-- first.
            await moreUntilDismissed("You don't have that object.");
            game._pending_message = '';
            key = await promptKey(prompt);
        }
    }
    const item = selectedItem;
    if (!item) {
        game.context.move = 0;
        game._pending_message = '';
        return;
    }
    const selectedObjectClass = item.oclass || objectClassForType(item.otyp);
    const selectedIsGold = selectedObjectClass === 12;
    const directGoldThrow = selectedIsGold && item !== game.uquiver;
    const directionKey = await readDirectionKey();
    const direction = promptedDirectionKey(directionKey, game.commandBindings);
    const selfThrow = direction === '.';
    const verticalThrow = direction === '<' || direction === '>';
    if (!isMovementKey(direction) && !verticalThrow && !selfThrow) {
        const quitDirection = [27, 32, 10, 13].includes(directionKey);
        if (!quitDirection && game.flags?.cmdassist !== false) {
            await showTextPages([directionAssistPage()], {
                validKeys: [27, 32, 10, 13],
            });
            await restoreCommandMap();
        } else if (!quitDirection) {
            await pline('What a strange direction!');
        }
        game.context.move = 0;
        game._pending_message = '';
        return;
    }
    // getdir() commits the source direction before throw_obj() detaches an
    // identity.  throwit() may later rewrite it for slip or low stamina.
    const dx = isMovementKey(direction) ? DIR_DX[direction] : 0;
    const dy = isMovementKey(direction) ? DIR_DY[direction] : 0;
    const dz = direction === '<' ? -1 : direction === '>' ? 1 : 0;
    game.u.dx = dx;
    game.u.dy = dy;
    game.u.dz = dz;

    if (directGoldThrow) {
        if (selfThrow) {
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
            adjustAlignment: adjustHeroAlignment,
        });
        game.context.move = 1;
        return;
    }

    if (!await canLetGo(item, 'throw')) {
        game.context.move = 0;
        return;
    }
    const mjollnir = artifactById(item.oartifact, game)?.name === 'Mjollnir';
    if (mjollnir && item !== game.uwep) {
        await pline(`The ${objectName(item)} must be wielded before it can be thrown.`);
        game.context.move = 0;
        return;
    }
    if (mjollnir && currentAttribute(A_STR) < STR19(25)
        || item.otyp === BOULDER
            && !((MONSTER_FLAGS2[game.u.umonnum] ?? 0) & M2_ROCKTHROW)) {
        await pline("It's too heavy.");
        game.context.move = 1;
        return;
    }
    if (selfThrow) {
        await pline('You cannot throw an object at yourself.');
        game.context.move = 0;
        return;
    }
    wipeHeroEngraving(2);

    if (selectedIsGold && item === game.uquiver) {
        const previousCapacity = game._encumbranceLevel
            ?? nearCapacity(game);
        await resolveQuiveredGoldThrow({
            state: game,
            gold: item,
            dx, dy, dz,
            captureFlight: captureThrownObjectFlight,
            wakeMonster: wakeAttackedMonster,
        });
        if (game.program_state.gameover) return;
        const currentCapacity = nearCapacity(game);
        const capacityMessage = encumbranceMessage(
            previousCapacity, currentCapacity,
        );
        if (capacityMessage) await plineWithContinuation(capacityMessage);
        game._encumbranceLevel = currentCapacity;
        game.u._encumbrance = encumbranceLabel(currentCapacity);
        game.context.move = 1;
        return;
    }

    const selectedQuantity = item.quantity ?? item.quan ?? 1;
    const thrownObjectClass = selectedObjectClass;
    // obj.h:is_ammo()+matching_launcher(): the arrow flight owner is selected
    // by the signed P_BOW subtype, not the ordinary ARROW/BOW identities.
    // This includes elven, orcish, silver and ya ammunition with any matching
    // bow while keeping crossbow and sling ammunition in their own owners.
    const bowAmmo = OBJECT_SUBTYPE[item.otyp] === -P_BOW;
    const handThrownArrow = bowAmmo
        && (!game.uwep || OBJECT_SUBTYPE[game.uwep.otyp] !== P_BOW);
    const matchingSlingGem = !game.u?.uswallow
        && wieldingSling && thrownObjectClass === 13
        && OBJECT_SUBTYPE[item.otyp] === -P_SLING;
    const volleyCount = game.u?.uswallow ? 1 : chooseHeroVolleyCount(item, {
        state: game,
        shotLimit,
    });
    if (volleyCount > 1 || shotLimit > 0) {
        const name = OBJECT_NAMES[item.otyp] || item.name || 'object';
        const noun = volleyCount === 1
            ? name : item.plural || makePlural(name);
        await plineWithContinuation(
            `You ${launcherMatchesAmmo(item, game.uwep) ? 'shoot' : 'throw'} ${
                volleyCount} ${noun}.`,
        );
    }
    let splitObjectId = null;
    if (!game.u?.uswallow && thrownObjectClass === 13
        && !matchingSlingGem
        && selectedQuantity > 1) {
        // The dispatchers below share the same copied type/knowledge fields.
        // Allocate at C's split point; detachThrownUnit owns the actual split.
        splitObjectId = nextObjectId(item, item, game);
    }
    const adjacentMonster = game.level?.monsters?.find(candidate => monsterHasMapPosition(candidate, game) &&
        !candidate.dead && (candidate.mhp ?? 1) > 0
        && candidate.mx === game.u.ux + dx
        && candidate.my === game.u.uy + dy);
    if (await resolveSwallowedEggPieOrVenomThrow({
        state: game,
        item,
        selectedQuantity,
        splitObjectId,
        finishKill: (monster: Monster) => finishOrdinarySwallowedConsumedKill(
            monster, item.otyp === EGG ? 'swallowed-egg' : 'swallowed-venom',
        ),
    })) return;
    if (await resolveSwallowedWeaponThrow({
        state: game,
        item,
        objectClass: thrownObjectClass,
        selectedQuantity,
        splitObjectId,
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
        splitObjectId,
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
        splitObjectId,
        wakeMonster: wakeAttackedMonster,
    })) return;

    if (await resolveGenericSwallowedThrow({
        state: game,
        item,
        objectClass: thrownObjectClass,
        selectedQuantity,
        splitObjectId,
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
        splitObjectId,
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

    // C refs: dothrow.c:throwit(), zap.c:bhit()/skiprange(), and
    // dothrow.c:drop_throw().  This bounded slice owns GEM_CLASS flight for a
    // mineral ROCK/TOUCHSTONE, the established unicorn gift matrix, and a gem
    // launched by a matching sling.  Only ROCK initializes skiprange; magic
    // TOUCHSTONE bypasses should_mulch_missile().  A wielded sling excludes a
    // non-MINERAL gem from gift handling before ordinary accuracy.
    const mineralProjectile = item.otyp === ROCK || item.otyp === TOUCHSTONE;
    const adjacentUnicornNonMineralGem = thrownObjectClass === 13
        && OBJECT_MATERIAL[item.otyp] !== MAT_MINERAL
        && adjacentMonster
        && ['white unicorn', 'gray unicorn', 'black unicorn'].includes(
            MONSTER_NAME[adjacentMonster.mnum] ?? '',
        );
    const adjacentGiftEligibleGem = adjacentUnicornNonMineralGem
        && !wieldingSling;
    const adjacentHelplessRealGemMiss = adjacentGiftEligibleGem
        && (adjacentMonster.mcanmove === 0
            || adjacentMonster.msleeping);
    const adjacentTameRealGemCatch = adjacentGiftEligibleGem
        && !adjacentHelplessRealGemMiss
        && (adjacentMonster.mtame ?? 0) > 0;
    const adjacentRealGemGift = adjacentGiftEligibleGem
        && !adjacentHelplessRealGemMiss
        && !adjacentMonster.mtame;
    const supportedGemProjectile = mineralProjectile || matchingSlingGem
        || adjacentRealGemGift || adjacentTameRealGemCatch
        || adjacentHelplessRealGemMiss;
    const mineralFirstTyp = game.level
        ?.at?.(game.u.ux + dx, game.u.uy + dy)?.typ;
    if (supportedGemProjectile
        && (mineralFirstTyp === POOL || mineralFirstTyp === ROOM
            || mineralFirstTyp === CORR || mineralFirstTyp === DOOR
            || mineralFirstTyp === ALTAR || mineralFirstTyp === IRONBARS
            || (mineralFirstTyp !== undefined && IS_WALL(mineralFirstTyp)))) {
        const resolveGemShot = async (shotNumber: number) => {
        const thrownMineral = await detachThrownUnit(
            game, item, objectQuantity(item),
            matchingSlingGem ? null : splitObjectId, plineWithContinuation,
        );
        try {
            if (game.program_state?.gameover) return { heroDied: true };
            const unitWeight = OBJECT_WEIGHT[item.otyp] ?? item.owt ?? 1;
            let range = Math.max(
                1,
                Math.trunc(currentAttribute(A_STR) / 2)
                    - Math.trunc(unitWeight / 40),
            );
            if (matchingSlingGem) range++;
            let skipRangeStart = 0;
            let skipRangeEnd = 0;
            let allowSkip = false;
            if (item.otyp === ROCK) {
                const rangeQuarter = Math.trunc(range / 4);
                skipRangeStart = range
                    - (rangeQuarter > 0 ? rnd(rangeQuarter) : 0);
                skipRangeEnd = skipRangeStart
                    - Math.trunc(skipRangeStart / 4) * rnd(3);
                if (skipRangeEnd >= skipRangeStart)
                    skipRangeEnd = skipRangeStart - 1;
                allowSkip = rn2(3) === 0;
            }

            const landThrownMineral = (landingX: number, landingY: number) =>
                finishHeroThrownObjectLanding({
                    state: game,
                    object: thrownMineral,
                    x: landingX,
                    y: landingY,
                    contactedMonster: contact,
                    publish: plineWithContinuation,
                });

            const thrownGemDisplayName = () => {
                const callName = game._objectCallNames?.[thrownMineral.otyp];
                const perceivedName = callName
                    && !objectTypeKnown(thrownMineral)
                    && thrownMineral.oclass === 13
                    ? `gem called ${callName}`
                    : thrownMineral.dknown === false
                    ? unseenObjectNoun(thrownMineral)
                    : objectTypeKnown(thrownMineral)
                        ? OBJECT_NAMES[thrownMineral.otyp] || 'gem'
                        : thrownMineral.name
                        || OBJECT_NAMES[thrownMineral.otyp] || 'gem';
                const individualName = thrownMineral.oextra?.oname
                    || thrownMineral.oname;
                return individualName
                    ? `${perceivedName} named ${individualName}`
                    : perceivedName;
            };

            // C zap.c:bhit() initializes tmp_at() from obj_to_glyph() once
            // before traversing the path.  Hallucination makes that temporary
            // glyph consume one display-stream draw even when animation is not
            // exposed by this terminal adapter.
            transientObjectGlyph(thrownMineral);

            let x = game.u.ux;
            let y = game.u.uy;
            let remaining = range;
            let skipping = false;
            let contact: Monster | null = null;
            while (remaining-- > 0) {
                x += dx;
                y += dy;
                const loc = game.level?.at?.(x, y);
                const monster = game.level ? monsterAtPosition(game.level, x, y) : null;

                if (loc?.typ === WATER || loc?.typ === LAVAWALL) break;
                const pointBlankPassingBars = loc?.typ === IRONBARS
                    && remaining === range - 1;
                let passingBars = pointBlankPassingBars;
                if (loc?.typ === IRONBARS && !pointBlankPassingBars) {
                    const forcedBarsHit = rn2(5) === 0;
                    if (forcedBarsHit) {
                        rn2(100); // hit_bars()->hero_breaks()->breaktest()
                        await plineWithContinuation('Clonk!');
                        wakeMonstersNear(x, y, 16);
                        x -= dx;
                        y -= dy;
                        break;
                    }
                    passingBars = true;
                }

                if (remaining === skipRangeStart && allowSkip) {
                    if (loc?.typ === POOL && !monster) {
                        skipping = true;
                        await plineWithContinuation('The rock skips.');
                    } else if (skipRangeStart > skipRangeEnd + 1) {
                        skipRangeStart--;
                    }
                }
                if (skipping && remaining <= skipRangeEnd) skipping = false;

                if (((!loc || !ZAP_POS(loc.typ)) || blocksMove(x, y))
                    && !passingBars) {
                    x -= dx;
                    y -= dy;
                    break;
                }
                if (monster) {
                    contact = monster;
                    break;
                }
            }

            if (contact) {
                if (adjacentHelplessRealGemMiss
                    && contact === adjacentMonster) {
                    const monsterBaseName = MONSTER_NAME[contact.mnum]
                        || 'unicorn';
                    const targetName = contact.name
                        ? contact.name : `the ${monsterBaseName}`;
                    const gemName = thrownGemDisplayName();

                    // C dothrow.c:thitmonst()->tmiss(obj, mon, FALSE).  Sleeping
                    // or immobile unicorns receive an ordinary visible miss but
                    // no wake probe; returning zero leaves landing to throwit().
                    await plineWithContinuation(
                        `The ${gemName} misses ${targetName}.`,
                    );
                    await landThrownMineral(x, y);
                    game.context.move = 1;
                    return;
                }

                if (adjacentTameRealGemCatch && contact === adjacentMonster) {
                    const monsterBaseName = MONSTER_NAME[contact.mnum]
                        || 'unicorn';
                    const subject = contact.name
                        ? contact.name : `The ${monsterBaseName}`;
                    const gemName = thrownGemDisplayName();

                    // C dothrow.c:thitmonst().  A mobile tame unicorn catches a
                    // real gem but declines gem_accept(): no Luck, inventory
                    // transfer, or relocation.  Returning zero lets throwit()
                    // continue through ordinary breaktest and floor settlement.
                    await plineWithContinuation(
                        `${subject} catches and drops the ${gemName}.`,
                    );
                    await landThrownMineral(x, y);
                    game.context.move = 1;
                    return;
                }

                if (adjacentRealGemGift && contact === adjacentMonster) {
                    const monsterBaseName = MONSTER_NAME[contact.mnum]
                        || 'unicorn';
                    const subject = contact.name
                        ? contact.name : `The ${monsterBaseName}`;
                    const gemName = thrownGemDisplayName();

                    // C dothrow.c:thitmonst()->gem_accept().  The first pline is
                    // still pending while value/alignment policy commits, so the
                    // second pline is what exposes the catch pager.
                    await plineWithContinuation(
                        `${subject} catches the ${gemName}.`,
                    );
                    contact.mpeaceful = 1;
                    contact.mavenge = 0;
                    const isBuddy = Math.sign(
                        MONSTER_ALIGNMENT[contact.mnum] ?? 0,
                    ) === Math.sign(game.u?.ualign?.type ?? 0);
                    const isGemstone = OBJECT_MATERIAL[thrownMineral.otyp]
                        === MAT_GEMSTONE;
                    const properlyIdentified = thrownMineral.dknown !== false
                        && objectTypeKnown(thrownMineral);
                    const guessedValue = !!(thrownMineral.oextra?.oname
                        || thrownMineral.oname
                        || game._objectCallNames?.[thrownMineral.otyp]);
                    let accepted = true;
                    let policy = '';
                    let luckDelta = null;
                    if (properlyIdentified) {
                        if (isGemstone) {
                            policy = isBuddy ? ' gratefully' : ' hesitatingly';
                            luckDelta = isBuddy ? 5 : rn2(7) - 3;
                        } else {
                            accepted = false;
                            policy = ' is not interested in your junk.';
                        }
                    } else if (guessedValue) {
                        if (isGemstone) {
                            policy = isBuddy ? ' gratefully' : ' hesitatingly';
                            luckDelta = isBuddy ? 2 : rn2(3) - 1;
                        } else {
                            accepted = false;
                            policy = ' is not interested in your junk.';
                        }
                    } else if (isGemstone) {
                        policy = isBuddy ? ' gratefully' : ' hesitatingly';
                        luckDelta = isBuddy ? 1 : rn2(3) - 1;
                    } else {
                        policy = ' graciously';
                    }
                    if (luckDelta !== null) {
                        game.u.uluck = Math.max(
                            -13,
                            Math.min(13, (game.u.uluck || 0) + luckDelta),
                        );
                    }
                    if (accepted) {
                        // dothrow.c:gem_accept()->mpickobj() gives the gem to the
                        // unicorn before printing the result and relocating it.
                        await addObjectToMonsterInventory(
                            contact, thrownMineral, game,
                        );
                    }
                    await plineWithContinuation(accepted
                        ? `${subject}${policy} accepts your gift.`
                        : `${subject}${policy}`);

                    // teleport.c:rloc() runs after the acceptance message. A
                    // later vanish message waits for that first message.
                    const teleportRestricted = monsterTeleportRestricted(
                        contact, game,
                    );
                    if (teleportRestricted && canSeeMonster(
                        contact,
                    )) {
                        const restrictedName = contact.name
                            ? contact.name : `the ${monsterBaseName}`;
                        await plineWithContinuation(
                            `A mysterious force prevents ${restrictedName} from teleporting!`,
                        );
                    }
                    if (!teleportRestricted) {
                        const relocation = await randomMonsterRelocation(contact, { flags: RLOC_MSG });
                        if (relocation && 'died' in relocation && relocation.died) return;
                    }
                    if (!accepted) {
                        await landThrownMineral(x, y);
                    }
                    game.context.move = 1;
                    return;
                }

                const hit = await hitMonsterWithThrownObject(contact, thrownMineral, {
                    state: game, target: { x, y },
                    volley: { count: volleyCount, index: shotNumber, objectType: item.otyp },
                });
                if (hit.heroDied) return hit;
                if (hit.consumed) {
                    game.context.move = 1;
                    return;
                }
                await landThrownMineral(x, y);
                game.context.move = 1;
                return;
            }

            const endpoint = game.level?.at?.(x, y);
            if (endpoint?.typ === POOL) {
                await plineWithContinuation(
                    unitWeight > WT_SPLASH_THRESHOLD ? 'Splash!' : 'Plop!',
                );
            }
            await landThrownMineral(x, y);
            game.context.move = 1;
            return;
        } finally {
            if (game._thrownObject === thrownMineral) game._thrownObject = null;
        }
        };

        for (let shot = 0; shot < volleyCount; shot++) {
            const previousCapacity = game._encumbranceLevel
                ?? nearCapacity(game);
            const shotResult = await resolveGemShot(shot + 1);
            if (shotResult?.heroDied) return;
            const currentCapacity = nearCapacity(game);
            const capacityMessage = encumbranceMessage(
                previousCapacity, currentCapacity,
            );
            if (capacityMessage)
                await plineWithContinuation(capacityMessage);
            game._encumbranceLevel = currentCapacity;
            game.u._encumbrance = encumbranceLabel(currentCapacity);
            if (game.program_state?.gameover) break;
        }
        game.context.move = 1;
        return;
    }

    for (let shot = 0; shot < volleyCount; shot++) {
        const previousCapacity = game._encumbranceLevel ?? nearCapacity(game);
        const shotResult = await throwOrdinaryObject({
            state: game,
            item,
            quantity: item.quantity ?? item.quan ?? 1,
            splitObjectId,
            dx,
            dy,
            volley: { count: volleyCount, index: shot + 1, objectType: item.otyp },
        });
        if ('heroDied' in shotResult && shotResult.heroDied) return;
        const currentCapacity = nearCapacity(game);
        const capacityMessage = encumbranceMessage(
            previousCapacity, currentCapacity,
        );
        if (capacityMessage) await plineWithContinuation(capacityMessage);
        game._encumbranceLevel = currentCapacity;
        game.u._encumbrance = encumbranceLabel(currentCapacity);
        if (game.program_state?.gameover) break;
    }
    game.context.move = 1;
}

// C refs: lock.c autokey(TRUE), pick_lock().  Default autounlock includes
// apply-key; an explicit false/none setting is the only state that disables
// this branch in the currently ported option model.
function autoUnlockTool(g: GameState = game): GameObject | null {
    const setting = g.flags?.autounlock;
    if (setting === false || setting === 0 || setting === 'none') return null;
    const inventory = g.inventory || [];
    for (const otyp of [SKELETON_KEY, LOCK_PICK, CREDIT_CARD]) {
        const tool = inventory.find(object => object.otyp === otyp);
        if (tool) return tool;
    }
    return null;
}

async function openLockedDoor(door: MapLocation, x: number, y: number): Promise<boolean> {
    await pline('This door is locked.');
    const tool = autoUnlockTool(game);
    if (!tool) return false;
    game.u.dz = 0;
    const monster = monsterAtPosition(requireGameLevel(), x, y);
    if (monster && canSeeMonster(monster)
        && M_AP_TYPE(monster) !== M_AP_FURNITURE
        && M_AP_TYPE(monster) !== M_AP_OBJECT) {
        if (tool.otyp === CREDIT_CARD
            && (monster.isshk || MONSTER_NAME[monster.mnum] === 'Oracle'))
            await plineWithContinuation('"No checks, no credit, no problem."');
        else
            await plineWithContinuation(`I don't think ${monsterName(monster)} would appreciate that.`);
        return true;
    }
    await flushPendingTopline();
    const answer = await promptYesNoQuit(`Unlock it with ${lockToolName(tool)}?`);
    if (answer !== 'y') return false;
    const touch = await touchArtifactByHero(tool);
    if (!touch.allowed || touch.died) return true;
    game._occupation = {
        key: 'pick-lock',
        text: tool.otyp === LOCK_PICK || tool.otyp === CREDIT_CARD
            ? 'picking the lock' : 'unlocking the door',
        remaining: 51, usedtime: 0, door, x, y, tool,
        chance: lockPickChance(tool, game),
    };
    return true;
}

function lockToolName(tool: GameObject): string {
    observeObjectForNaming(tool);
    return ownedObjectName(tool, game, { capitalized: false });
}

function lockPickChance(tool: GameObject, g: GameState = game, container: GameObject | null = null): number {
    const dexterity = currentAttribute(A_DEX, g);
    const rogueBonus = g.urole?.key === 'rogue';
    let chance;
    if (container) {
        if (tool.otyp === CREDIT_CARD)
            chance = dexterity + (rogueBonus ? 20 : 0);
        else if (tool.otyp === LOCK_PICK)
            chance = 4 * dexterity + (rogueBonus ? 25 : 0);
        else chance = 75 + dexterity;
        if (container.cursed) chance = Math.trunc(chance / 2);
    } else if (tool.otyp === CREDIT_CARD) {
        chance = 2 * dexterity + (rogueBonus ? 20 : 0);
    } else if (tool.otyp === LOCK_PICK) {
        chance = 3 * dexterity + (rogueBonus ? 30 : 0);
    } else chance = 70 + dexterity;
    return chance;
}

// C ref: hack.c:dopush().  Move a floor boulder before committing the hero
// into its old square; the first push owns Strength exercise and its message.
async function pushBoulder(boulder: GameObject, x: number, y: number, dx: number, dy: number): Promise<boolean> {
    const glyph = glyphAt(x, y);
    if (heroIsBlind(game) && !(glyph?.kind === 'object' && glyph.otyp === BOULDER)) {
        await pline('That feels like a boulder.');
        map_object(boulder, true);
        endVoluntaryMultiTurn(game);
        return false;
    }
    const targetX = x + dx;
    const targetY = y + dy;
    const targetObjects = game.level?.objects?.[targetX]?.[targetY] || [];
    const targetMonster = game.level?.monsters?.find(monster => monsterHasMapPosition(monster, game) &&
        monster.mx === targetX && monster.my === targetY
        && (monster.mhp ?? 1) > 0);
    const physicalMonster = targetMonster
        && MONSTER_SYMBOL[targetMonster.mnum] !== 54;
    if (physicalMonster) {
        if (canSpotMonster(targetMonster)) {
            const name = MONSTER_NAME[targetMonster.mnum] || 'monster';
            await plineWithContinuation(
                `There's ${withIndefiniteArticle(name)} on the other side.`,
            );
        } else {
            await plineWithContinuation(
                'You hear a monster behind the boulder.',
            );
            map_invisible(targetX, targetY);
        }
        if (game.flags?.verbose !== false) {
            await plineWithContinuation(
                "Perhaps that's why you cannot move it.",
            );
        }
        return false;
    }
    if (blocksMove(targetX, targetY)
        || targetObjects.some(object => object.otyp === BOULDER)) {
        await pline('You try to move the boulder, but in vain.');
        return false;
    }

    const sourceMove = game.moves ?? 0;
    const lastPushMove = game._lastBoulderPushMove;
    const giveMessage = game._lastPushedBoulder !== boulder
        || lastPushMove === undefined || !Number.isInteger(lastPushMove)
        || sourceMove > lastPushMove + 2
        || sourceMove < lastPushMove;
    game._lastPushedBoulder = boulder;
    game._lastBoulderPushMove = sourceMove;
    if (giveMessage) await pline('With great effort you move the boulder.');

    await exerciseAttribute(A_STR, true);
    // C dopush() invalidates an invisible-monster memory glyph at the
    // destination before movobj().  Otherwise newsym() must continue to
    // honor `I` and cannot reveal the boulder which now occupies the square.
    unmap_invisible(targetX, targetY, false);
    await moveObject(boulder, targetX, targetY, game);
    if (heroIsBlind(game)) {
        feel_location(targetX, targetY);
        feel_location(x, y);
    } else {
        newsym(x, y);
    }
    return true;
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
    const moved = await domoveCore(dx, dy, explicitAttempt);
    if (!game.program_state.gameover) game._kickedLoc = null;
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
    checkSlipperyIce();
    // C hack.c:impaired_movement() always checks Confusion before deriving
    // the destination.  A nonzero rn2(5) keeps the requested direction; on
    // impairment, confdir(TRUE) chooses cardinals first and retries only an
    // out-of-bounds or solid-rock result.
    const confused = (u?.confusionTurns || 0) > 0;
    const stunned = !!(u?.stunned || (u?.stunnedTurns || 0) > 0);
    if (stunned || (confused && rn2(5) === 0)) {
        const impairedDirections: readonly (readonly [number, number])[] = [
            [-1, 0], [0, -1], [1, 0], [0, 1],
            [-1, -1], [1, -1], [1, 1], [-1, 1],
        ];
        for (let tries = 0; tries <= 50; tries++) {
            const candidateDirection = impairedDirections[rn2(impairedDirections.length)];
            if (!candidateDirection) throw new Error('Movement RNG produced an invalid direction.');
            const [candidateDx, candidateDy] = candidateDirection;
            const candidateX = u.ux + candidateDx;
            const candidateY = u.uy + candidateDy;
            const candidate = game.level?.at(candidateX, candidateY);
            if (candidateX < 1 || candidateX >= COLNO
                || candidateY < 0 || candidateY >= ROWNO
                || !candidate || IS_OBSTRUCTED(candidate.typ)) continue;
            dx = candidateDx;
            dy = candidateDy;
            break;
        }
    }
    // confdir() updates the same persistent vector selected by set_move_cmd().
    u.dx = dx;
    u.dy = dy;
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
    if (await escapeFromStickyMonster(newx, newy)) return true;
    const loc = game.level?.at(newx, newy);

    // C domove_core() resolves a destination monster before test_move()
    // applies terrain restrictions.  In particular, the hero can attack
    // diagonally across an intact doorway even though moving through that
    // same doorway would be rejected.
    const monster = game.level ? monsterAtPosition(game.level, newx, newy) : null;
    if (monster) {
        // C display.h:_is_safemon() deliberately stops treating even a
        // peaceful/tame monster as safe while the hero is confused,
        // hallucinating, or stunned.  domove_core() checks that predicate
        // after impaired_movement() has changed u.dx/u.dy; a Shift-run which
        // is redirected into the pet therefore stops before do_attack() and
        // its one-in-seven displacement refusal roll.
        const safeMonster = (game.flags.safe_dog ?? true) && !!monster.mpeaceful
            && canSpotMonster(monster)
            && !game.context?.forcefight
            && !confused
            && !heroIsHallucinating(game)
            && !stunned;
        // hack.c stops a run only for a visible or sensed actor.  Seeing the
        // destination terrain is insufficient when minvis hides its occupant;
        // that case must reach attack_checks() and install the invisible
        // marker instead.
        if (game._runState && !safeMonster
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
        if (beastChoosesHeroDisplacement(monster, game, newx, newy)) {
            const ballChainMove = await beginBallAndChainMove(newx, newy);
            if (ballChainMove?.blocked) {
                if (ballChainMove.blockedMessage) await pline(ballChainMove.blockedMessage);
                game.context.move = Number(ballChainMove.consumedTurn);
                return ballChainMove.consumedTurn;
            }
            const oldx = u.ux, oldy = u.uy;
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
            const tameName = monster.name || (monster.mnum === 16
                ? 'your little dog' : monster.mnum === 32 ? 'your kitten'
                    : monster.mnum === 100 ? 'your saddled pony' : 'your pet');
            const speciesName = monsterInstanceDisplayName(monster);
            const subject = tame ? tameName
                : monster.name ? speciesName : `the ${speciesName}`;
            if (blocked || inShop) {
                const displayName = subject.charAt(0).toUpperCase()
                    + subject.slice(1);
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
            // C domove_core() confirms a yielded step before either actor
            // changes position or the hero tries to escape a current trap.
            if (heroCanConfirmStep(newx, newy) && !await confirmHeroStep(newx, newy)) return false;
            if (u.utrap
                && !await heroCanMoveFromTrap(newx, newy)) return true;
            if (!await heroCanEnterIronBars(newx, newy, game)) return false;
            if (heroOozesUnderDoor(loc)) await pline('You ooze under the door.');
            if (await rejectHeroDiagonalDoorway(dx, dy, loc)) return false;
            const ballChainMove = await beginBallAndChainMove(newx, newy);
            if (ballChainMove?.blocked) {
                if (ballChainMove.blockedMessage) await pline(ballChainMove.blockedMessage);
                game.context.move = Number(ballChainMove.consumedTurn);
                return ballChainMove.consumedTurn;
            }
            // C trains riding during the tentative move, even if the pet
            // later refuses to swap and both rider and steed move back.
            const oldx = u.ux, oldy = u.uy;
            u.ux0 = oldx; u.uy0 = oldy;
            u.ux = newx; u.uy = newy;
            await moveSteedWithHero();
            // C drag_ball() can pull the hero back before the swap check.
            // A refused swap still completes ball placement and its delay.
            if (monster.mpeaceful && game.level.traps.some(trap =>
                trap.tx === oldx && trap.ty === oldy)) {
                const subjectName = monsterName(monster, { state: game, article: 'your', capitalized: true });
                await plineWithContinuation(`You stop.  ${subjectName} doesn't want to swap places.`);
                u.ux = oldx; u.uy = oldy;
                if (u.usteed) {
                    u.usteed.mx = oldx;
                    u.usteed.my = oldy;
                }
                // C domove_core() resets occupations after restoring the
                // hero's position, even when a peaceful refuses the swap.
                resetBulkTakeoff();
                await finishBallAndChainMove(ballChainMove);
                if (ballChainMove?.causeDelay) await delayAfterDraggingBall();
                return true;
            }
            monster.mx = oldx; monster.my = oldy;
            // C domove_swap_with_pet() redraws both actors before the swap
            // announcement can flush the map or pause for acknowledgment.
            newsym(newx, newy);
            newsym(oldx, oldy);
            const swapName = tame ? tameName
                : monster.name ? `peaceful ${speciesName}`
                    : `the peaceful ${speciesName}`;
            await plineWithContinuation(`You swap places with ${swapName}.`);
            return finishMovedHero({
                oldx, oldy, newx, newy, loc, explicitAttempt,
                ballChainMove,
            });
        }
        // attack() runs the whole attack_checks() reveal sequence: the
        // unseen-monster marker, the disguised-mimic stumble, and the
        // hidden-under reveal, each able to consume the move on its own.
        // C gb.bhitpos is the struck square, even for a worm tail.
        const verdict = await prepareAppliedWeaponAttack(
            monster, game.uwep ?? null,
            { state: game, struckAt: { x: newx, y: newy } });
        if (!verdict.proceed)
            return verdict.spentTime;
        if (await attackHostileMonster(monster, newx, newy)) return true;
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

    if (heroCanConfirmStep(newx, newy) && !await confirmHeroStep(newx, newy)) return false;

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
        // lock.c:doopen_indir() classifies a locked door before the ordinary
        // closed-door strength roll.  test_move() reaches autoopen before its
        // later diagonal-door restriction, so a diagonal attempt still owns
        // this zero-time message.
        if (loc.doormask & D_LOCKED) {
            await openLockedDoor(loc, newx, newy);
            game.context.move = 0;
            return false;
        }
        const openRoll = rnl(20);
        const openThreshold = Math.trunc(
            (currentStrength() + currentAttribute(A_DEX)
                + currentAttribute(A_CON)) / 3,
        );
        if (openRoll >= openThreshold) {
            await exerciseAttribute(A_STR, true);
            await pline('The door resists!');
            return false;
        }
        await openClosedDoor(loc, newx, newy);
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
    if (boulder && !await pushBoulder(boulder, newx, newy, dx, dy)) {
        game.context.move = 0;
        return false;
    }
    if (boulder && game._runState) {
        // hack.c:dopush() cancels multi after the successful push.  The hero
        // still enters the boulder's vacated square, but Shift-direction
        // running must not auto-push the same boulder down the whole corridor.
        stopRun(game);
    }

    // C hack.c:swim_move_danger().  Known walking equipment and the swim
    // confirmation option decide whether a visible liquid edge stops us.
    // The request-menu (`m`) prefix deliberately accepts that step.
    if (heroShouldAvoidLiquid(newx, newy)) {
        const liquid = waterbodyName(newx, newy);
        const warning = `You avoid stepping into the ${liquid}.`;
        if (game.flags?.tips !== false && !game._tipSwimShown) {
            await promptKey(`${warning}--More--`);
            game._tipSwimShown = true;
            await pline("(Tip: use 'm' prefix to step in if you really want to.)");
        } else {
            await pline(warning);
        }
        game.context.move = 0;
        return false;
    }

    // Move the hero
    const ballChainMove = await beginBallAndChainMove(newx, newy);
    if (ballChainMove?.blocked) {
        if (ballChainMove.blockedMessage) await pline(ballChainMove.blockedMessage);
        game.context.move = Number(ballChainMove.consumedTurn);
        return ballChainMove.consumedTurn;
    }
    const oldx = u.ux, oldy = u.uy;
    u.ux0 = oldx;
    u.uy0 = oldy;
    u.ux = newx;
    u.uy = newy;
    await moveSteedWithHero();
    return finishMovedHero({
        oldx, oldy, newx, newy, loc, explicitAttempt, ballChainMove,
    });
}
