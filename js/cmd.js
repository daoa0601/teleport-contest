// cmd.js — Command dispatch and movement.
// C ref: cmd.c rhack(), hack.c domove().

import { game } from './gstate.js';
import { isContainer, useContainer } from './container.js';
import { adjustHeroAlignment } from './alignment.js';
import { doOptions } from './options.js';
import {
    blocksDiagonalDoor, heroBadRock, heroLiquidEffects,
    heroShouldAvoidLiquid,
    heroTightDiagonalReason,
} from './hack.js';
import { defaultCommandKey } from './command_keys.js';
import { nextIdent } from './ident.js';
import { nhgetch } from './input.js';
import { moreUntilDismissed, promptKey } from './tty_prompts.js';
import {
    getLine, paranoidQuery, promptYesNo, promptYesNoQuit,
} from './query.js';
export { getLine, promptYesNo, promptYesNoQuit } from './query.js';
import {
    objectTypeCallNoun, tryCallObjectType,
} from './object_call.js';
import {
    newsym, flushPendingTopline, flush_screen, pline, plineWithContinuation,
    docrt, docrtRecalc, bot, cls,
    terrain_glyph, canSeeMonster, canProjectMonster, canSpotMonster,
    monsterHasWarningProjection,
    see_nearby_objects, show_glyph_cell, swallowed, randomDisplayMonsterName,
    randomDisplayMonsterSubject, see_monsters, see_objects, see_traps,
    transientObjectGlyph, lastDirtyMapCursor,
    map_object, map_invisible,
    unmap_invisible,
} from './display.js';
import {
    cansee, clearAreaCells, couldsee, vision_recalc, vision_reset,
    vision_reset_new_level,
} from './vision.js';
import {
    beginObjectBurn, endObjectBurn, igniteItems,
    transformMagicLampToOilLamp,
} from './light.js';
import {
    destroyFireInventory, dozap,
} from './zap.js';
import {
    bucAdjectiveForName, consumeInventoryItem, ddoinv, dolook,
    inventoryItemDescription,
    dungeonFeatureSentenceAt,
    observeBucForNaming, selectInventoryObject,
} from './invent.js';
import {
    castKnownSpell, continueSpellbookStudy, docast, dovspell,
} from './spell.js';
import { applyPotionLikeInvisibility } from './hero_invisibility.js';
import {
    cureHeroIllness, startHeroSickness, startHeroVomiting, vomitHero,
} from './hero_illness.js';
import { heroBreathAttack } from './hero_breath.js';
import { useHeroBreath } from './hero_breath_command.js';
import {
    heroCanMindBlast, useHeroMindBlast,
} from './hero_mind_blast.js';
import { turnUndeadByCallingOnDeity } from './turn_undead.js';
import { doread } from './read.js';
import { continueFoodMeal, doeat } from './eat.js';
import { PLAYABLE_INSTRUMENTS, playInstrument } from './music.js';
import { dodiscovered } from './o_init.js';
import { doattributes, doconduct } from './insight.js';
import { doextversion } from './extversion.js';
import { dosearch, mapLevel } from './detect.js';
import { tameMonster } from './dog.js';
import {
    continueWipingFace, donull, dowipe, threateningMonsterNearby,
} from './do.js';
import {
    ATR_INVERSE, ATR_NONE, showChoiceWindow, showMultiSelectWindow,
    showDisclosureOverlay, showPagedPickOneMenu,
    showTextMenuOverlay, showTextPages,
    restoreMenuUnderlay, snapshotMenuUnderlay,
} from './windows.js';
import { d, rnd, rn2, rn2Display, rnl, rnz } from './rng.js';
import {
    makemonNear, mklev,
    mergable, mkgold, mkobj, mksobj, place_object, remove_object,
    stack_object,
    rndClass,
    u_on_downstairs, u_on_upstairs,
} from './mklev.js';
import {
    level_difficulty, recordMappedOverviewState,
} from './dungeon.js';
import {
    addInventoryItem, assignInventoryLetter, collectNearbyCoords,
    inventoryItem,
} from './u_init.js';
import {
    carryableObjectCount, liftObject,
} from './lift_object.js';
import { splitObjectStack } from './object_stack.js';
import { deleteObject } from './object_delete.js';
import { attachCursedFigurineTimer } from './figurine_timer.js';
import { heroCanReachFloor } from './floor_reach.js';
import { pickupLocationProblem } from './pickup_location.js';
import { finishGhostlyPickup } from './bones_object.js';
import { clearJustPicked, markJustPicked } from './just_picked.js';
import {
    addObjectToMonsterInventory, clearMonsterCarriedObjectState,
    removeObjectFromMonsterInventory,
} from './monster_inventory.js';
import {
    resolveGenericSwallowedThrow, resolveSwallowedPotionThrow,
    resolveSwallowedProjectileThrow, resolveSwallowedWeaponThrow,
} from './swallowed_throw.js';
import {
    autoquiverCandidate, launcherMatchesAmmo, readySuggestion,
    setQuiverObject,
} from './quiver.js';
import { resolveMapPotionThrow } from './potion_throw.js';
import {
    applyProjectileObjectPassive as applySharedProjectileObjectPassive,
    destroyMulchedProjectile, shouldMulchMissile,
} from './projectile.js';
import {
    objectStatePrefix, unseenObjectNoun,
} from './objnam.js';
import {
    artifactById, artifactDamageBonus, artifactToHitBonus,
} from './artifacts.js';
import { touchArtifactByHero } from './artifact_touch.js';
import {
    SLING, CARROT, BULLWHIP, GRAPPLING_HOOK,
    CREAM_PIE, EGG, LUMP_OF_ROYAL_JELLY, SLIME_MOLD, TIN,
    LOCK_PICK, CREDIT_CARD,
    STETHOSCOPE, TIN_OPENER, LOADSTONE, HEAVY_IRON_BALL,
    GOLD_PIECE, CORPSE, BOULDER, ROCK,
    ARROW, BOW, DART,
    LONG_SWORD,
    DILITHIUM_CRYSTAL, LUCKSTONE, TOUCHSTONE,
    QUARTERSTAFF, LARGE_BOX, CHEST, ICE_BOX, SACK, OILSKIN_SACK,
    BAG_OF_HOLDING, BRASS_LANTERN, OIL_LAMP, MAGIC_LAMP,
    STATUE, IRON_CHAIN, SCR_SCARE_MONSTER,
    RIN_PROTECTION, RIN_REGENERATION, RIN_CONFLICT,
    POT_BOOZE, POT_CONFUSION, POT_FRUIT_JUICE, POT_HEALING,
    POT_EXTRA_HEALING, POT_PARALYSIS, POT_SICKNESS, POT_INVISIBILITY, POT_OIL,
    POT_GAIN_ENERGY,
    LENSES, BLINDFOLD, TOWEL, FUMBLE_BOOTS, KICKING_BOOTS,
    MAGIC_MARKER,
    SHIELD_OF_REFLECTION, CLOAK_OF_DISPLACEMENT, GAUNTLETS_OF_POWER,
    AMULET_OF_YENDOR, FAKE_AMULET_OF_YENDOR,
    CANDELABRUM_OF_INVOCATION, BELL_OF_OPENING,
    NOVEL,
    OBJECT_DELAY, OBJECT_DESCRIPTIONS, OBJECT_MATERIAL, OBJECT_NAMES,
    OBJECT_WEIGHT,
    OBJECT_SUBTYPE,
    OBJECT_SMALL_DAMAGE, OBJECT_LARGE_DAMAGE, OBJECT_HIT_BONUS,
} from './object_data.js';
import {
    CLR_WHITE, NO_COLOR,
} from './terminal.js';
import {
    MONSTER_ATTACKS, MONSTER_COLOR, MONSTER_EXPERIENCE_META,
    MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_GENO,
    MONSTER_LEVEL, MONSTER_MOVE, MONSTER_NAME, MONSTER_SIZE,
    MONSTER_SOUND, MONSTER_SYMBOL, MONSTER_ALIGNMENT,
    monsterIsNonliving, monsterTypeName,
} from './monster_data.js';
import { nameToMonster } from './mondata.js';
import {
    gainExperienceLevel, gainLevelAbilities,
} from './exper.js';
import { dosave } from './save.js';
import { initTrack } from './track.js';
import { captureRunmodeDelay, startRun, stopRun } from './runmode.js';
import {
    applyArmorOnEffects, armorOnIdentifiesType, armorSlotFor,
    findArmorClass, heroIsDisplaced,
    objectErosionKind, objectErosionMessage, removeArmorProperties,
} from './armor.js';
import {
    findMonsterArmorClass,
    snapshotMonsterCreationWearNames,
} from './monworn.js';
import { finishHeroMonsterKill } from './hero_monster_death.js';
import { applyCaitiffPenalty } from './hero_attack_conduct.js';
import { isRider, isZombieMaker } from './corpse_species.js';
import { reviveCorpseImmediately } from './corpse_revival.js';
import {
    killGenocidedMonsters, wakeMonstersNear,
} from './mon.js';
import {
    angerAttackedMonster, publishKickedPetYelp, publishMonsterGrowl,
    wakeAttackedMonster, wakeAttackedShopkeeper,
} from './monster_anger.js';
import { doride } from './steed.js';
import { currentAttribute, exerciseAttribute } from './attrib.js';
import { strengthDamageBonus } from './weapon_damage.js';
export { strengthDamageBonus } from './weapon_damage.js';
import { continueForceLock, doforce } from './lock.js';
import { dosit } from './sit.js';
import {
    heroCanMoveFromTrap, triggerHeroTrapAt,
} from './hero_traps.js';
import { activateStatueTrapAt } from './statue_trap.js';
import {
    applyDippedCoinFate, applyFountainDemonActor,
    applyFountainGemDiscovery, applyFountainNymphActor,
    applyFountainSnakeActors,
    resolveDippedBucFate, resolveDippedSensationFate,
} from './fountain_effects.js';
import {
    dryFountainTerrain, reportFountainWarning,
} from './fountain.js';
import { heroArmName } from './body_parts.js';
import { makePlural } from './object_grammar.js';
import { dist2, distmin, dungeonDepth } from './hacklib.js';
import { roomForRoomno } from './room.js';
import {
    OBJECT_CLASS_LABELS, objectClassForType, recordObjectCall,
    recordObjectEncounter,
    recordObjectKnowledge,
} from './object_knowledge.js';
import {
    encumbranceLabel, encumbranceMessage, exceedsActionCapacity, nearCapacity,
    invWeight, HVY_ENCUMBER, OVERLOADED, pickupLoadPrefix,
    SLT_ENCUMBER,
} from './weight.js';
import { hiddenGold } from './gold.js';
import { makeWish } from './wish.js';
import { dopray } from './pray.js';
import {
    addHeroGoldObject, detachHeroGold, ensureHeroGoldObject,
    heroGoldAmount, setHeroGoldAmount, syncHeroGoldCache,
} from './hero_gold.js';
import {
    resolveDirectGoldThrow, resolveQuiveredGoldThrow,
} from './gold_throw.js';
import {
    heroIsBlind, syncBlindness, syncDeafness,
} from './senses.js';
import { touchPetrifyingCorpse } from './stoning.js';
import {
    beginBallAndChainMove, finishBallAndChainMove, heroIsPunished,
} from './ball.js';
import {
    doquit,
    finishHeroDeath,
    vanquishedLines,
} from './end.js';
import {
    recordDungeonEntryAchievements,
} from './achievements.js';
import { getHungry } from './hunger.js';
import {
    heroCannotTake, heroHasNoHands, heroHasNoLimbs, heroIsPolymorphed,
    heroHasOlfaction, heroIsVerySmall, polyselfControlledMonster,
    polyselfControlledNewman, rehumanizeHero,
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
import { wieldTool } from './wield_tool.js';
import {
    doenhance, ensureHeroSkills, recordWeaponPractice,
    weaponSkillDamageBonus, weaponSkillHitBonus,
} from './skills.js';
import {
    addShopObjectToBill, billedPickupQuote, chargeUnpaidLampUse,
    checkSpecialRoom,
    carriedShopBill, getCostOfShopItem, objectTypeKnown,
    SHOP_TYPE_NAMES,
    settleCarriedShopBillItem, settleThrownShopObject,
    shopkeeperForHero, shopkeeperName,
    shopThankYouMessage,
    unpaidObjectCost,
} from './shk.js';
import {
    visiblePriestName,
} from './priest.js';
import { gameLogEvents, recordGameLogEvent } from './gamelog.js';
import {
    maybeSmudgeEngravings, readEngravingAt, wipeEngravingAt,
} from './engrave.js';
import {
    farlookTipUntilDismissed, moveGetposCursor, selectMapPosition,
} from './getpos.js';
import {
    chatWithQuestLeader, displayPreparedQuestArrival, prepareQuestArrival,
    prepareMainQuestPortalCall, onQuestStart, okToQuest,
} from './quest.js';
import {
    aggravateMonsters, fumaroles, sessionIsNight,
    triggerImmediateMonsterTrap,
} from './monmove.js';
import { hurtleHero, kickRecoilRange } from './hero_hurtle.js';
import { tryUnarmedStagger } from './monster_hurtle.js';
import { announceInvocationSquare } from './invocation.js';
import {
    abuseKickedPet, kickConductViolation, levitatingKickMisses,
    prepareKick, prepareKickDamage, rollKickDamage, tryKickEvasion,
    tryKickReel,
} from './monster_kick.js';
import { waterDamageChain, waterDamageObject } from './trap.js';
import {
    heroTeleportDestinationOk, moveHeroByTeleport,
    randomMonsterRelocation, safeTeleportDestination,
} from './teleport.js';
import { monsterTeleportRestricted } from './teleport_rules.js';
import { presentMonsterWebTrap } from './monster_trap_events.js';
import { removeWishGrantingMonster } from './monster_departure.js';
import { moveElementalBubbles } from './elemental.js';
import {
    A_CON, A_DEX, A_STR, A_WIS, SICK_NONVOMITABLE, SICK_VOMITABLE,
    BOLT_LIM, COLNO, ROWNO, STONE, SDOOR, DOOR, CORR, ROOM, ICE, POOL, CLOUD,
    IRONBARS,
    FOUNTAIN, SINK,
    ALTAR, GRAVE, THRONE, WATER, MOAT, LAVAWALL, TREE,
    D_NODOOR, D_BROKEN, D_ISOPEN, D_CLOSED, D_LOCKED,
    IS_WALL, IS_STWALL, IS_OBSTRUCTED, IS_FURNITURE, IS_AIR, IS_POOL,
    IS_LAVA, IS_ROOM,
    ZAP_POS,
    SQKY_BOARD, BEAR_TRAP, LANDMINE, FIRE_TRAP, PIT, SPIKED_PIT, HOLE,
    TRAPDOOR, DART_TRAP, MAGIC_TRAP,
    TELEP_TRAP, LEVEL_TELEP, MAGIC_PORTAL, STATUE_TRAP,
    WEB, ANTI_MAGIC,
    G_GONE,
    ER_NOTHING, ER_DAMAGED, ER_DESTROYED,
    M_AP_FURNITURE, M_AP_MONSTER, M_AP_OBJECT,
    STRAT_WAITFORU, STRAT_WAITMASK,
    MM_NOEXCLAM, MM_NOMSG, MM_NOWAIT,
    TEMPLE, SHOPBASE, ROOMOFFSET,
    F_LOOTED,
    In_endgame, Is_airlevel, Is_waterlevel, Is_rogue_level,
    W_ARMOR, W_ACCESSORY, W_SADDLE, W_WEP, W_SWAPWEP,
    W_BALL, W_CHAIN, LOST_THROWN,
    WT_SPLASH_THRESHOLD, WT_SQUEEZABLE_INV,
    P_BOW, P_SLING, P_SKILLED, P_EXPERT, PARANOID_HIT, is_pit, isok,
} from './const.js';

// Direction deltas: y u k
//                   h . l
//                   b j n
const DIR_DX = { h: -1, l: 1, j: 0, k: 0, y: -1, u: 1, b: -1, n: 1 };
const DIR_DY = { h: 0, l: 0, j: 1, k: -1, y: -1, u: -1, b: 1, n: 1 };

// object.h enum value; object_data currently exposes the two other tools.
const SKELETON_KEY = 221;
const BALL_CLASS = 15;
const CHAIN_CLASS = 16;
const PM_DJINNI = 315;
const PM_GHOST = 287;
const PM_WATER_NYMPH = 68;
const PM_WATER_DEMON = 289;
const PM_WATER_MOCCASIN = 216;
const M1_WALLWALK = 0x00000008;
const M2_ROCKTHROW = 0x08000000;
const AT_BOOM = 14;
const MAT_GEMSTONE = 20;
const MAT_MINERAL = 21;

function possessiveMonsterName(name) {
    return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}

// C do_name.c:x_monnam()/distant_monnam().  Species identity comes from
// mnum; `monster.name` is the optional C given-name extension.
function monsterInstanceDisplayName(monster) {
    if (monster?.name && monster.mnum === PM_GHOST)
        return `${possessiveMonsterName(monster.name)} ghost`;
    if (monster?.name) return monster.name;
    return monsterTypeName(monster?.mnum, !!monster?.female);
}

function isMovementKey(ch) {
    return 'hjklyubn'.includes(ch);
}

// C cmd.c:reset_commands() overlays each non-numpad Ctrl-direction binding
// onto its ordinary command (for example Ctrl-L replaces redraw with rush
// east).  Carriage return is normalized by tty to Ctrl-J/rush south.
const CONTROL_RUSH_DIRECTION = new Map([
    [2, 'b'], [8, 'h'], [10, 'j'], [11, 'k'],
    [12, 'l'], [14, 'n'], [21, 'u'], [25, 'y'],
]);

function controlRushDirection(key) {
    return CONTROL_RUSH_DIRECTION.get(key === 13 ? 10 : key) || null;
}

function remapConfiguredCommand(key) {
    const command = game.commandBindings?.[key];
    if (!command) return { key, disabled: false };
    if (command === 'nothing') return { key, disabled: true };
    const mapped = defaultCommandKey(command);
    return {
        key: mapped ? mapped.charCodeAt(0) : key,
        disabled: false,
    };
}

const HALLUCINATED_LIQUIDS = [
    'yoghurt', 'oobleck', 'clotted blood', 'diluted water',
    'purified water', 'instant coffee', 'tea', 'herbal infusion',
    'liquid rainbow', 'creamy foam', 'mulled wine', 'bouillon', 'nectar',
    'grog', 'flubber', 'ketchup', 'slow light', 'oil', 'vinaigrette',
    'liquid crystal', 'honey', 'caramel sauce', 'ink', 'aqueous humour',
    'milk substitute', 'fruit juice', 'glowing lava', 'gastric acid',
    'mineral water', 'cough syrup', 'quicksilver', 'sweet vitriol',
    'grey goo', 'pink slime', 'cosmic latte', 'bone oil', 'custard', 'lard',
    'vinegar', 'creosote',
];

function displayLiquidName(fallback) {
    if (!(game.u?.hallucinating
        || (game.u?.hallucinationTurns ?? 0) > 0)) return fallback;
    // do_name.c:hliquid() includes the real fallback as one additional slot.
    const index = rn2Display(HALLUCINATED_LIQUIDS.length + 1);
    return HALLUCINATED_LIQUIDS[index] ?? fallback;
}

// C ref: hack.c — check if a cell blocks movement
function blocksMove(x, y) {
    const loc = game.level?.at(x, y);
    if (!loc) return true;
    if (loc.typ === STONE) return true;
    if (IS_WALL(loc.typ) || IS_OBSTRUCTED(loc.typ)) return true;
    if (loc.typ === DOOR && (loc.doormask & (D_CLOSED | D_LOCKED))) return true;
    return false;
}

// C ref: hack.c:could_move_onto_boulder().  Travel planning is allowed to
// route through an ordinary boulder, then actual run-mode movement consults
// this capability before deciding whether to stop or enter/push the square.
function heroCouldMoveOntoBoulder(sx, sy, g = game) {
    const mnum = Number.isInteger(g.u?.umonnum)
        ? g.u.umonnum : null;
    const flags1 = mnum === null ? 0 : MONSTER_FLAGS1[mnum] ?? 0;
    if (flags1 & M1_WALLWALK) return true;
    if (g.u?.usteed) return false;

    const flags2 = mnum === null ? 0 : MONSTER_FLAGS2[mnum] ?? 0;
    if (flags2 & M2_ROCKTHROW) {
        return !g.u?.dx || !g.u?.dy
            || !(IS_OBSTRUCTED(g.level?.at(g.u.ux, sy)?.typ)
                && IS_OBSTRUCTED(g.level?.at(sx, g.u.uy)?.typ));
    }
    if (heroIsVerySmall(g)) return true;
    return invWeight(g) <= -WT_SQUEEZABLE_INV;
}

async function rejectTightHeroDiagonal(dx, dy) {
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
const TRAVEL_DIRECTIONS = [
    [-1, 0], [0, -1], [1, 0], [0, 1],
    [-1, -1], [1, -1], [1, 1], [-1, 1],
];

function travelCellKnown(x, y, g = game) {
    const loc = g.level?.at(x, y);
    return !!loc && (!!loc.seenv || !!loc.remembered_glyph || couldsee(x, y));
}

function travelStepAllowed(fromX, fromY, toX, toY, g = game) {
    if (toX < 1 || toX >= COLNO || toY < 0 || toY >= ROWNO) return false;
    if (!travelCellKnown(toX, toY, g) || blocksMove(toX, toY)) return false;

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
    if (IS_POOL(typ) || IS_LAVA(typ)) return false;
    return true;
}

function findDirectTravelDirection(targetX, targetY, g = game) {
    let frontier = [[targetX, targetY]];
    const discoveredRadius = new Map([[`${targetX},${targetY}`, 0]]);
    let radius = 1;
    while (frontier.length) {
        const next = [];
        for (const [x, y] of frontier) {
            const key = `${x},${y}`;
            const hasBoulder = (g.level?.objects?.[x]?.[y] || [])
                .some(object => object.otyp === BOULDER);
            // findtravelpath() leaves an ordinary boulder node on the
            // frontier for two extra radii.  The graph still contains it,
            // but an equally short clean route wins.
            if (hasBoulder && !heroCouldMoveOntoBoulder(x, y, g)
                && discoveredRadius.get(key) > radius - 3) {
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
function isValidTravelTarget(targetX, targetY, g = game) {
    if (g.u?.ux === targetX && g.u?.uy === targetY) return true;
    // TRAVP_VALID expands from the hero toward the requested destination.
    // The ordinary travel search expands backwards so it can recover the
    // hero's next step; reusing that orientation here would let the search
    // escape *from* a solid target without ever validating entry into it.
    const queue = [[g.u.ux, g.u.uy]];
    const visited = new Set([`${g.u.ux},${g.u.uy}`]);
    for (let head = 0; head < queue.length; head++) {
        const [x, y] = queue[head];
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

function travelDistance(x1, y1, x2, y2) {
    return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
}

function travelDistanceSquared(x1, y1, x2, y2) {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return dx * dx + dy * dy;
}

// C hack.c:findtravelpath(TRAVP_GUESS).  When the selected destination is
// not connected through remembered terrain, search the hero-visible region,
// choose its point closest to the real target using C's scan/tie order, and
// take one ordinary travel step toward that temporary target.  Repeating the
// calculation after each move lets newly revealed terrain extend the route.
function findGuessedTravelDirection(targetX, targetY, g = game) {
    const originX = g.u.ux;
    const originY = g.u.uy;
    const queue = [[originX, originY]];
    const distance = new Map([[`${originX},${originY}`, 0]]);
    for (let head = 0; head < queue.length; head++) {
        const [x, y] = queue[head];
        for (const [dx, dy] of TRAVEL_DIRECTIONS) {
            const nx = x + dx;
            const ny = y + dy;
            const key = `${nx},${ny}`;
            if (distance.has(key) || !couldsee(nx, ny)
                || !travelStepAllowed(x, y, nx, ny, g)) continue;
            distance.set(key, distance.get(`${x},${y}`) + 1);
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

export function findTravelDirection(state = game._runState, g = game) {
    if (!state || state.mode !== 8 || !g.u || !g.level) return null;
    const { targetX, targetY } = state;
    if (g.u.ux === targetX && g.u.uy === targetY) return null;
    return findDirectTravelDirection(targetX, targetY, g)
        || findGuessedTravelDirection(targetX, targetY, g);
}

function canSeeRunMonster(monster, x, y, g = game) {
    if (g === game) return canSeeMonster(monster, x, y);
    const visibleSquare = !g.viz_array
        || !!(g.viz_array?.[y]?.[x] & 0x2);
    return !g.blind && !(g.u?.blindTurns > 0) && visibleSquare
        && (!monster.minvis || g.u?.seeInvisible || g.u?.see_invisible)
        && !monster.mundetected;
}

function travelInterruptedByMonster(g = game) {
    return !!g.level?.monsters?.some(monster =>
        Math.abs(monster.mx - g.u.ux) <= 1
        && Math.abs(monster.my - g.u.uy) <= 1
        && (monster.mx !== g.u.ux || monster.my !== g.u.uy)
        && !monster.pet && !monster.mpeaceful && cansee(monster.mx, monster.my));
}

function startTravel(targetX, targetY, g = game) {
    g._runState = {
        mode: 8,
        targetX,
        targetY,
        multi: Math.max(COLNO, ROWNO),
        lastStrTurn: 0,
    };
    g._travelTarget = { x: targetX, y: targetY };
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
export function lookaroundRun(state = game._runState, g = game) {
    if (!state || !g.u || !g.level) return false;

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
            const monster = g.level.monsters?.find(mon =>
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
            const typ = loc?.typ ?? STONE;
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
                } else if (state.mode === 8 || monster) {
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
                } else if (state.mode === 8 || monster) {
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

export async function continueRun(g = game) {
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
        await captureRunmodeDelay(g, !!g._runState);
        const moved = await domove(direction.dx, direction.dy, false);
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

    await captureRunmodeDelay(g, !!g._runState);
    const moved = await domove(state.dx, state.dy, false);
    if (moved) await captureRunmodeDelay(g, !!g._runState);
    g.context.move = moved ? 1 : 0;
    if (!moved) stopRun(g);
    return moved;
}

// C refs: cmd.c set_occupation()/timed_occupation() and
// allmain.c:moveloop_core().  A count-prefixed search executes once in
// rhack(), then repeats without reading another input key; each repetition is
// separated by the complete monster/global turn scheduler.
export async function continueCountedCommand(g = game) {
    const occupation = g._occupation;
    if (!occupation) {
        g._occupation = null;
        return false;
    }
    if (occupation.key === 'study-book') {
        const continuing = await continueSpellbookStudy(occupation, g);
        if (!continuing) g._occupation = null;
        return true;
    }
    if (occupation.key === 'force-lock') {
        return continueForceLock(occupation, g);
    }
    if (occupation.remaining <= 0) {
        g._occupation = null;
        return false;
    }
    if (occupation.key === 'pick-lock') {
        occupation.usedtime = (occupation.usedtime ?? 0) + 1;
        if (occupation.usedtime > 50) {
            await pline('You give up your attempt at picking the lock.');
            exerciseAttribute(A_DEX, true);
            g._occupation = null;
        } else if (rn2(100) < occupation.chance) {
            await pline('You succeed in picking the lock.');
            if (occupation.container) {
                occupation.container.olocked = !occupation.container.olocked;
                occupation.container.lknown = true;
            } else if (occupation.door?.doormask & D_LOCKED) {
                occupation.door.doormask &= ~D_LOCKED;
                occupation.door.doormask |= D_CLOSED;
            } else if (occupation.door) {
                occupation.door.doormask &= ~D_CLOSED;
                occupation.door.doormask |= D_LOCKED;
            }
            exerciseAttribute(A_DEX, true);
            newsym(occupation.x, occupation.y);
            g._occupation = null;
        }
        g.context.move = 1;
        return true;
    }
    if (occupation.key === 'eat-food') {
        return continueFoodMeal(occupation, g);
    }
    if (occupation.key === 'wipe-face') {
        return continueWipingFace(occupation, g);
    }
    if (occupation.key === '.') {
        occupation.remaining--;
        if (occupation.remaining <= 0) g._occupation = null;
        g.context.move = 1;
        return true;
    }
    if (occupation.key !== 's') {
        g._occupation = null;
        return false;
    }

    const found = await dosearch();
    occupation.remaining--;
    if (found || occupation.remaining <= 0) {
        g._occupation = null;
    } else if (threateningMonsterNearby()) {
        g._occupation = null;
        await pline('You stop searching.');
    }
    return true;
}


async function performSearchCommand(force = false) {
    const count = Math.max(1, game._commandCount || 0);
    const found = await dosearch(force);
    if (!found && game.context.move && count > 1) {
        game._occupation = {
            key: 's', text: 'searching', remaining: count - 1,
        };
    }
    game._commandCount = 0;
}

async function performWaitCommand(force = false) {
    const count = Math.max(1, game._commandCount || 0);
    const consumesTime = await donull(force, count > 1 || !!game._occupation);
    if (!consumesTime) {
        game._commandCount = 0;
        return;
    }
    if (count > 1) {
        game._occupation = {
            key: '.', text: 'waiting', remaining: count - 1,
        };
    }
    game._commandCount = 0;
    game._pending_message = '';
    game.context.move = 1;
}

// C ref: cmd.c rhack — main command dispatcher
export async function rhack(key) {
    // C cmd.c:rhack() resets the request-menu/movement-prefix bit for each
    // top-level command.  An `m` prefix below sets it only while dispatching
    // the following movement key.
    game.context.nopick = false;
    if (key !== 0) delete game._cursorOverride;
    game._heroMeleeThisCommand = false;
    // A prior silent-prefix marker belongs to the monster phase following
    // that command.  Reaching a new top-level dispatch acknowledges it.
    game._silentPrefixRetainedTopline = false;
    const cannedCommand = key === 0
        ? game._cannedCommands?.shift() : null;
    if (key === 0 && !cannedCommand) {
        // Read key from input
        await flush_screen(1);
        if ((game._commandCount || 0) >= 10)
            game.nhDisplay?.setCursor(`Count: ${game._commandCount}`.length, 0);
        key = await nhgetch();
        delete game._cursorOverride;
    }
    const configured = remapConfiguredCommand(key);
    key = configured.key;
    // Status rows beneath a tty pager remain physically unchanged even when
    // the suspended command has already mutated the wallet.  The next real
    // top-level command read makes that state eligible for a fresh botl.
    delete game._statusGoldOverride;

    // C clears gk.kickedloc after domove() and before every elapsed non-kick
    // command.  A kick's direction byte is read by the suspended dokick()
    // call, not by a new rhack(), so a new top-level dispatch can safely
    // invalidate the prior turn's cooperative-monster avoidance state.
    game._kickedLoc = null;
    const ch = String.fromCharCode(key);
    const previousMessage = game._pending_message;

    // The input boundary displayed the previous command's message.  Clear it
    // now; any message produced below remains visible at the next boundary.
    game._pending_message = '';
    game._retained_message = '';

    if (configured.disabled) {
        game.context.move = 0;
        return;
    }

    // C cmd.c:rhack() pops CQ_CANNED before parse() asks tty for another
    // byte.  Tool commands use this to resume the original operation after
    // wield_tool() has spent one action installing the selected object.
    if (cannedCommand?.kind === 'rub') {
        game._pending_message = previousMessage;
        await dorub(cannedCommand.invlet);
        return;
    }
    if (cannedCommand?.kind === 'apply') {
        game._pending_message = previousMessage;
        await doapply(cannedCommand.invlet);
        return;
    }
    if (cannedCommand?.kind === 'swap-weapon') {
        game._pending_message = previousMessage;
        await doswapweapon();
        return;
    }
    if (cannedCommand?.kind === 'wield') {
        game._pending_message = previousMessage;
        await dowield(cannedCommand.invlet);
        return;
    }
    if (cannedCommand?.kind === 'fire') {
        game._pending_message = previousMessage;
        await dofire(cannedCommand.shotLimit ?? 0);
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
        || controlRushDirection(key)) {
        const rushDirection = controlRushDirection(key);
        const direction = rushDirection || ch.toLowerCase();
        const running = /[HJKLYUBN]/.test(ch) || !!rushDirection;
        if (running) startRun(
            DIR_DX[direction], DIR_DY[direction], game,
            rushDirection ? 3 : 1,
        );
        const moved = await domove(DIR_DX[direction], DIR_DY[direction]);
        if (running && moved)
            await captureRunmodeDelay(game, !!game._runState);
        game.context.move = moved ? 1 : 0;
        if (running && !moved) stopRun();
    } else if (ch === 'm') {
        // `m` is both request-menu and move-without-pickup.  Movement is the
        // live owner here: parse the next key inside the same command, so tty
        // exposes the unchanged map at the intermediate input boundary.
        // tty has accepted `m` as an incomplete command, not acknowledged
        // the previous topline as a completed command.  If the prefixed
        // action later dies during its monster phase, the first fatal pager
        // can therefore project the status row from before contact.
        game._silentPrefixRetainedTopline = !!previousMessage;
        await flush_screen(1);
        const nextKey = await nhgetch();
        const direction = String.fromCharCode(nextKey).toLowerCase();
        game._pending_message = '';
        if (isMovementKey(direction)) {
            game.context.nopick = true;
            const moved = await domove(
                DIR_DX[direction], DIR_DY[direction], true,
            );
            game.context.move = moved ? 1 : 0;
            game.context.nopick = false;
        } else if (String.fromCharCode(nextKey) === 'O') {
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
            await performSearchCommand(true);
        } else if (direction === '.') {
            // do_reqmenu() is the source-level override advertised by
            // cmd_safety_prevention(); `m.` deliberately spends the turn.
            await performWaitCommand(true);
        } else {
            await pline("The 'm' prefix should be followed by a movement command.");
            game.context.move = 0;
        }
    } else if (ch === 'i') {
        const action = await ddoinv();
        if (action?.key === 't') await dothrow(action.item);
    } else if (ch === 'O') {
        await doOptions();
    } else if (ch === 'Z') {
        await docast({ gotoLevel });
    } else if (ch === '+') {
        await dovspell();
    } else if (ch === '\\') {
        await dodiscovered();
    } else if (key === 24) { // Ctrl-X
        await doattributes();
    } else if (ch === 's') {
        await performSearchCommand();
    } else if (key === 4) { // Ctrl-D
        await dokick();
    } else if (ch === 'f') {
        await dofire();
    } else if (/^[0-9]$/.test(ch)) {
        game._commandCount = Math.min(9999,
            (game._commandCount || 0) * 10 + Number(ch));
        if (game._commandCount >= 10)
            await pline(`Count: ${game._commandCount}`);
        else if (previousMessage) game._pending_message = previousMessage;
        game.context.move = 0;
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
        await ordinaryDescend();
    } else if (ch === '<') {
        await ordinaryAscend();
    } else if (ch === 'z') {
        await dozap({
            finishMonsterKill: finishHeroMonsterKill,
            wakeMonster: wakeAttackedMonster,
            gotoLevel,
        });
    } else if (ch === 'r') {
        await doread({
            gotoLevel,
            finishHeroDeath,
            finishMonsterKill: finishHeroMonsterKill,
        });
    } else if (ch === 'T') {
        await dotakeoff();
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
        await dolook({
            showPile: showFloorPile,
            describeObject: pricedFloorObjectDescription,
        });
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

// C refs: potion.c dodrink()/dopotion() and fountain.c drinkfountain().
// Inventory and terrain sources converge only after their distinct selector
// and effect transactions have committed.
async function selectPotionToDrink(potions) {
    const letters = potions.map(object => object.invlet).join('');
    let key = await promptKey(
        `What do you want to drink? [${compactInventoryLetters(letters)} or ?*] `,
    );
    if (key === '?'.charCodeAt(0) || key === '*'.charCodeAt(0)) {
        key = await selectInventoryObject({
            items: potions,
            includeGold: false,
            loopUntilValid: true,
        });
    }
    // invent.c:getobj() treats every quitchar, including Return, as an
    // explicit cancellation with prose.  The prompt buffer itself is not the
    // resulting topline; "Never mind." replaces it before rhack resumes.
    if ([27, 32, 10, 13].includes(key)) {
        await pline('Never mind.');
        return null;
    }
    game._pending_message = '';
    return potions.find(object => object.invlet === String.fromCharCode(key));
}

async function doquaff() {
    const loc = game.level?.at(game.u?.ux, game.u?.uy);
    if (loc?.typ === FOUNTAIN) {
        const answer = await promptYesNo(
            'Drink from the fountain? [yn] (n)', 'n', 1,
        );
        if (answer === 'y') {
            await drinkFountain(loc);
            game.context.move = 1;
            return;
        }
    }
    if (loc?.typ === SINK) {
        const answer = await promptYesNo(
            'Drink from the sink? [yn] (n)', 'n', 1,
        );
        if (answer === 'y') {
            await drinkSink(loc);
            game.context.move = 1;
            return;
        }
    }

    const potions = (game.inventory || []).filter(object =>
        object.class === 'Potions' || object.oclass === 8);
    if (!potions.length) {
        await pline("You don't have anything to drink.");
        game.context.move = 0;
        return;
    }
    const potion = await selectPotionToDrink(potions);
    if (!potion) {
        game.context.move = 0;
        return;
    }

    if (potion.otyp === POT_FRUIT_JUICE) {
            const fruit = game.fruitName || 'slime mold';
            const prefix = potion.cursed ? 'Yecch!  This tastes rotten.'
                : `This tastes like ${potion.diluted || potion.odiluted
                    ? 'reconstituted ' : ''}${fruit} juice.`;
            await moreUntilDismissed(`${prefix}--More--`);
            const blessing = potion.blessed ? 1 : potion.cursed ? -1 : 0;
            game.u.uhunger = (game.u.uhunger ?? 900)
                + (potion.diluted || potion.odiluted ? 5 : 10)
                * (2 + blessing);

            await tryCallObjectType(potion);
    } else if (potion.otyp === POT_SICKNESS && potion.blessed) {
            // C potion.c:peffect_sickness().  The first pline fills tty's
            // topline and suspends before the blessed qualification.  The
            // dismissal resumes the same command, applies its fixed damage,
            // then dopotion() identifies and consumes the potion.
            await moreUntilDismissed(
                'Yecch!  This stuff tastes like poison.--More--',
            );
            await pline(
                `(But in fact it was mildly stale ${
                    game.fruitName || 'slime mold'
                } juice.)`,
            );
            if (game.urole?.key !== 'healer') {
                game.u.uhp = Math.max(0, (game.u.uhp ?? 1) - 1);
            }
            if (potion.dknown !== false
                && !game._knownObjectTypes?.has(potion.otyp)) {
                exerciseAttribute(A_WIS, true);
                recordObjectKnowledge(potion.otyp);
                game.u.urexp = (game.u.urexp || 0) + 10;
            }
    } else if (potion.otyp === POT_GAIN_ENERGY) {
            await pline('Magical energies course through your body.');
            let amount = d(potion.blessed ? 3 : potion.cursed ? 1 : 2, 6);
            if (potion.cursed) amount = -amount;
            game.u.uenmax = (game.u.uenmax ?? 0) + amount;
            if (game.u.uenmax > (game.u.uenpeak ?? 0))
                game.u.uenpeak = game.u.uenmax;
            else if (game.u.uenmax <= 0) game.u.uenmax = 0;
            game.u.uen = (game.u.uen ?? 0) + 3 * amount;
            if (game.u.uen > game.u.uenmax) game.u.uen = game.u.uenmax;
            else if (game.u.uen <= 0) game.u.uen = 0;
            exerciseAttribute(A_WIS, true);
            if (potion.dknown !== false
                && !game._knownObjectTypes?.has(potion.otyp)) {
                exerciseAttribute(A_WIS, true);
                recordObjectKnowledge(potion.otyp);
                game.u.urexp = (game.u.urexp || 0) + 10;
            }
            recordObjectEncounter(potion.otyp);
    } else if (potion.otyp === POT_INVISIBILITY) {
            const effect = await applyPotionLikeInvisibility({
                blessed: !!potion.blessed,
                cursed: !!potion.cursed,
            });
            if (effect.aggravates) aggravateMonsters(game);
            if (!effect.showedInvisibility) {
                const feeling = game.u?.hallucinating
                    || (game.u?.hallucinationTurns ?? 0) > 0
                    ? 'normal' : 'peculiar';
                await pline(
                    `You have a ${feeling} feeling for a moment, then it passes.`,
                );
                await tryCallObjectType(potion);
            } else if (potion.dknown !== false
                && !game._knownObjectTypes?.has(potion.otyp)) {
                exerciseAttribute(A_WIS, true);
                recordObjectKnowledge(potion.otyp);
                game.u.urexp = (game.u.urexp || 0) + 10;
            }
    } else if (potion.otyp === POT_HEALING) {
            await pline('You feel better.');
            const bucSign = potion.blessed ? 1 : potion.cursed ? -1 : 0;
            const healed = 8 + d(4 + 2 * bucSign, 4);
            game.u.uhp = (game.u.uhp ?? 0) + healed;
            if (game.u.uhp > (game.u.uhpmax ?? 0)) {
                if (!potion.cursed) game.u.uhpmax = (game.u.uhpmax ?? 0) + 1;
                game.u.uhp = game.u.uhpmax;
                game.u.uhppeak = Math.max(
                    game.u.uhppeak ?? 0, game.u.uhpmax ?? 0,
                );
            }
            if (!potion.cursed) {
                game.u.blindTurns = 0;
                syncBlindness(game);
                game.u.deafTurns = 0;
                syncDeafness(game);
            }
            if (potion.blessed) {
                cureHeroIllness(game);
            }
            exerciseAttribute(A_CON, true);
    } else if (potion.otyp === POT_EXTRA_HEALING) {
            await pline('You feel much better.');
            const bucSign = potion.blessed ? 1 : potion.cursed ? -1 : 0;
            const healed = 16 + d(4 + 2 * bucSign, 8);
            game.u.uhp = (game.u.uhp ?? 0) + healed;
            if (game.u.uhp > (game.u.uhpmax ?? 0)) {
                const extraMaximum = potion.blessed ? 5
                    : potion.cursed ? 0 : 2;
                game.u.uhpmax = (game.u.uhpmax ?? 0) + extraMaximum;
                game.u.uhp = game.u.uhpmax;
                game.u.uhppeak = Math.max(
                    game.u.uhppeak ?? 0, game.u.uhpmax ?? 0,
                );
            }
            const wasBlind = !!game.blind
                || (game.u.blindTurns ?? 0) > 0;
            game.u.blindTurns = 0;
            syncBlindness(game);
            game.u.deafTurns = 0;
            syncDeafness(game);
            if (!potion.cursed) {
                cureHeroIllness(game);
            }
            if (wasBlind && !game.blind) {
                game.vision_full_recalc = 1;
                await plineWithContinuation('You can see again.');
            }
            if (game.u.hallucinating
                || (game.u.hallucinationTurns ?? 0) > 0) {
                game.u.hallucinating = false;
                game.u.hallucinationTurns = 0;
                game.vision_full_recalc = 1;
            }
            exerciseAttribute(A_CON, true);
            exerciseAttribute(A_STR, true);
            if (!game._knownObjectTypes) game._knownObjectTypes = new Set();
            if (!game._knownObjectTypes.has(potion.otyp)) {
                exerciseAttribute(A_WIS, true);
                recordObjectKnowledge(potion.otyp);
                game.u.urexp = (game.u.urexp || 0) + 10;
            }
            recordObjectEncounter(potion.otyp);
    } else if (potion.otyp === POT_PARALYSIS) {
            await pline('Your feet are frozen to the floor!');
            game._helplessTurns = 25 + rn2(10);
            game._helplessReason = 'frozen by a potion';
            game._helplessDoneMessage = 'You can move again.';
            exerciseAttribute(A_DEX, false);
            if (!game._knownObjectTypes) game._knownObjectTypes = new Set();
            if (!game._knownObjectTypes.has(potion.otyp)) {
                // makeknown() -> discover_object(..., credit_hero=TRUE)
                // exercises Wisdom before the elapsed turn starts.
                exerciseAttribute(A_WIS, true);
                game._knownObjectTypes.add(potion.otyp);
                game.u.urexp = (game.u.urexp || 0) + 10;
            }
    } else if (potion.otyp === POT_CONFUSION) {
            const base = potion.cursed ? 24 : potion.blessed ? 8 : 16;
            game.u.confusionTurns = (game.u.confusionTurns || 0)
                + base + rn2(7);
            await pline('Huh, What?  Where am I?');
            if (!game._knownObjectTypes) game._knownObjectTypes = new Set();
            if (!game._knownObjectTypes.has(potion.otyp)) {
                rn2(19); // discover_object(..., credit_hero): exercise Wisdom
                game._knownObjectTypes.add(potion.otyp);
                game.u.urexp = (game.u.urexp || 0) + 10;
            }
    } else if (potion.otyp === POT_BOOZE) {
            const hungerState = (game.u?.uhunger ?? 900) > 1000 ? 0
                : (game.u?.uhunger ?? 900) > 150 ? 1
                    : (game.u?.uhunger ?? 900) > 50 ? 2
                        : (game.u?.uhunger ?? 900) > 0 ? 3 : 4;
            if (!potion.blessed) {
                game.u.confusionTurns = (game.u.confusionTurns || 0)
                    + d(2 + hungerState, 8);
            }
            if (!(potion.diluted || potion.odiluted))
                game.u.uhp = Math.min(game.u.uhpmax, (game.u.uhp || 0) + 1);
            game.u.uhunger = (game.u.uhunger ?? 900)
                + 10 * (2 + (potion.blessed ? 1 : potion.cursed ? -1 : 0));
            exerciseAttribute(A_WIS, false);
            if (potion.cursed) {
                game._helplessTurns = rnd(15);
                game._helplessReason = 'unconscious from drinking';
                game._helplessDoneMessage = 'You awake with a headache.';
            }
            // The effect finishes before docall() tries to replace its
            // topline.  That replacement is what creates the --More-- pause,
            // so all effect RNG belongs to the selection key's slice.
            await moreUntilDismissed(
                `Ooph!  This tastes like ${potion.diluted || potion.odiluted
                    ? 'watered down ' : ''}liquid fire!--More--`,
            );
            await tryCallObjectType(potion);
    }
    consumeInventoryItem(potion);
    game._capacityDirty = true;
    game._liveQuietTurnRequested = true;
    game.context.move = 1;
}

async function drinkSink(loc) {
    const result = rn2(20);
    if (result === 0) {
        await pline('You take a sip of very cold water.');
    } else if (result === 1) {
        await pline('You take a sip of very warm water.');
    } else if (result === 2) {
        await pline('You take a sip of scalding hot water.');
        if (game.u?.fireResistance) await pline('It seems quite tasty.');
        else game.u.uhp = Math.max(0, (game.u.uhp ?? 1) - rnd(6));
    } else if (result === 6) {
        await pline('The pipes break!  Water spurts out!');
        loc.typ = FOUNTAIN;
        loc.looted = 1;
        loc.blessedftn = 0;
        newsym(game.u.ux, game.u.uy);
    } else if (result === 8) {
        await pline('Yuk, this water tastes awful.');
        game.u.uexp = (game.u.uexp || 0) + 1;
    } else if (result === 9) {
        await pline('Gaggg... this tastes like sewage!  You vomit.');
        const constitution = game.u?.acurr?.a?.[A_CON] ?? 10;
        game.u.uhunger = (game.u.uhunger ?? 900)
            - (11 + rn2(Math.max(1, 30 - constitution)));
        await vomitHero({ state: game });
    } else if (result === 11) {
        await pline('You hear clanking from the pipes...');
    } else if (result === 12) {
        await pline('You hear snatches of song from among the sewers...');
    } else if (result === 13) {
        await pline('Ew, what a stench!');
    } else if (result >= 14 || result === 19) {
        const temperature = rn2(3) ? (rn2(2) ? 'cold' : 'warm') : 'hot';
        await pline(`You take a sip of ${temperature} water.`);
    } else {
        // Monster, generated-potion, ring, elemental, and polymorph sink
        // branches require their complete source constructors.  Preserve the
        // selected branch without stealing the later scheduler's RNG.
        await pline('The sink seems quite dirty.');
    }
}

const GUSH_REMOVABLE_TRAPS = new Set([
    SQKY_BOARD, BEAR_TRAP, LANDMINE, FIRE_TRAP, PIT, SPIKED_PIT,
    HOLE, TRAPDOOR, TELEP_TRAP, LEVEL_TELEP, WEB, MAGIC_TRAP,
    ANTI_MAGIC,
]);

function nextToDoor(x, y) {
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            const typ = game.level?.at?.(x + dx, y + dy)?.typ;
            if (typ === DOOR || typ === SDOOR) return true;
        }
    }
    return false;
}

// C ref: trap.c delfloortrap().  Gush rejects portal-like and special traps,
// but removes ordinary floor mechanisms before replacing their terrain.
function deleteGushFloorTrap(trap) {
    if (!trap || !GUSH_REMOVABLE_TRAPS.has(trap.ttyp)) return false;
    const index = game.level?.traps?.indexOf(trap) ?? -1;
    if (index >= 0) game.level.traps.splice(index, 1);
    const monster = game.level?.monsters?.find(candidate =>
        !candidate.dead && candidate.mx === trap.tx && candidate.my === trap.ty);
    if (monster) monster.mtrapped = false;
    return true;
}

// C refs: fountain.c dogushforth()/gush(), vision.c do_clear_area().
// The checkerboard and hero-position checks precede rn2(distance). Terrain,
// boulders, adjacent doors, and traps are checked after that draw.
async function dogushforth(drinking) {
    const messages = [];
    let madePool = 0;
    const ux = game.u.ux;
    const uy = game.u.uy;
    for (const { x, y } of clearAreaCells(ux, uy, 7)) {
        if ((x + y) % 2 || (x === ux && y === uy)) continue;
        if (rn2(1 + distmin(ux, uy, x, y))) continue;

        const loc = game.level?.at?.(x, y);
        const objects = game.level?.objects?.[x]?.[y] || [];
        if (loc?.typ !== ROOM
            || objects.some(object => object.otyp === BOULDER)
            || nextToDoor(x, y)) {
            continue;
        }

        const trap = game.level?.traps?.find(candidate =>
            candidate.tx === x && candidate.ty === y);
        if (trap && !deleteGushFloorTrap(trap)) continue;

        if (madePool++ === 0)
            messages.push('Water gushes forth from the overflowing fountain!');
        loc.typ = POOL;
        loc.flags = 0;
        if (game.level.engravings) {
            game.level.engravings = game.level.engravings.filter(engraving =>
                engraving.x !== x || engraving.y !== y);
        }
        await waterDamageChain(objects, messages, game);

        // minliquid() is a separate monster/liquid owner.  Repaint here so
        // airborne or water-compatible occupants expose the new background;
        // drowning and gremlin/golem branches remain in that owner.
        newsym(x, y);
    }
    if (!madePool) {
        messages.push(drinking
            ? 'Your thirst is quenched.'
            : 'Water sprays all over you.');
    }
    return messages;
}

function someGold(amount) {
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

async function discoverFountainGem(loc) {
    return applyFountainGemDiscovery({
        loc,
        blind: !!game.blind,
        announce: message => pline(message),
        chooseGem: () => rndClass(DILITHIUM_CRYSTAL, LUCKSTONE - 1),
        createGem: gemType => mksobj(gemType, false, false),
        placeGem: gem => place_object(gem, game.u.ux, game.u.uy),
        repaint: () => newsym(game.u.ux, game.u.uy),
        exerciseWisdom: () => exerciseAttribute(A_WIS, true),
    });
}

function fountainActorGone(mnum) {
    return !!((game.mvitals?.[mnum]?.mvflags ?? 0) & G_GONE);
}

function heroHallucinating() {
    return !!(game.u?.hallucinating
        || (game.u?.hallucinationTurns ?? 0) > 0);
}

function fountainActorIndefiniteName(monster) {
    const name = heroHallucinating()
        ? randomDisplayMonsterName() : monsterInstanceDisplayName(monster);
    return `${indefiniteArticle(name)} ${name}`;
}

function fountainActorVisibleSubject(monster) {
    return heroHallucinating()
        ? randomDisplayMonsterSubject()
        : `The ${monsterInstanceDisplayName(monster)}`;
}

// Fountain-spawned monsters can enter webs immediately. Other trap types
// still wait for their normal turn because their messages are not handled
// here yet.
function supportedImmediateFountainTrap(monster) {
    return game.level?.traps?.some(trap =>
        trap.tx === monster.mx && trap.ty === monster.my
        && trap.ttyp === WEB);
}

async function triggerSupportedImmediateFountainTrap(monster) {
    const action = triggerImmediateMonsterTrap(monster, game);
    await presentMonsterWebTrap({
        event: action.event,
        monster,
        visible: canProjectMonster(monster, monster.mx, monster.my),
        subject: fountainActorVisibleSubject,
        announce: plineWithContinuation,
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
        grantWish: async demon => {
            const { mx, my } = demon;
            const fountainMove = game.context.move;
            removeWishGrantingMonster(demon, { preserveGlyph: true });
            await makeWish();
            // makeWish() is also used by the zero-time wizard command and
            // clears context.move there.  Embedded in dowaterdemon(), the
            // enclosing fountain command still consumes its ordinary turn.
            game.context.move = fountainMove || 1;
            newsym(mx, my);
        },
        trapAt: supportedImmediateFountainTrap,
        triggerTrap: triggerSupportedImmediateFountainTrap,
    });
}

async function summonFountainSnakes() {
    return applyFountainSnakeActors({
        gone: fountainActorGone(PM_WATER_MOCCASIN),
        blind: !!game.blind,
        hallucinating: heroHallucinating(),
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

async function drinkFountain(loc) {
    let fountainMessage = '';
    let continueFountainMessage = false;
    let vomitAfterMessage = false;
    const fate = rnd(30);
    if (fate < 10) {
        // fountain.c:drinkfountain() handles the ordinary low-fate draught
        // before its numbered switch.  Nutrition is credited before dryup()
        // and the elapsed-turn scheduler applies its normal hunger cost.
        fountainMessage = 'The cool draught refreshes you.';
        game.u.uhunger = (game.u.uhunger ?? 900) + rnd(10);
    } else if (fate === 20) {
        fountainMessage = 'The water is foul!  You gag and vomit.';
        // C refs: fountain.c:drinkfountain(), eat.c:vomit(), and
        // allmain.c:moveloop_core().  Foul water first removes 11..30 points
        // of nutrition, then nomul(-2) makes the next two global turns happen
        // without accepting a hero command.
        game.u.uhunger = (game.u.uhunger ?? 900) - (11 + rn2(20));
        vomitAfterMessage = true;
    } else if (fate === 21) {
        fountainMessage = 'The water is contaminated!';
        if (game.u?.poisonResistance) {
            fountainMessage += `  Perhaps it is runoff from the nearby ${game.fruitName || 'slime mold'} farm.`;
            game.u.uhp = Math.max(0, (game.u.uhp ?? 1) - rnd(4));
        } else {
            // fountain.c case 21 delegates to
            // attrib.c:poison_strdmg(rn1(4,3), rnd(10), ...).  losestr()
            // spends any loss below the natural minimum as extra HP/max-HP
            // damage before committing the remaining attribute reduction.
            let strengthLoss = 3 + rn2(4);
            const attributes = game.u?.acurr?.a;
            const currentStrength = attributes?.[A_STR] ?? 3;
            let reducedStrength = currentStrength - strengthLoss;
            let frailtyDamage = 0;
            while (reducedStrength < 3) {
                reducedStrength++;
                strengthLoss--;
                frailtyDamage += 3 + rn2(4);
            }
            if (frailtyDamage) {
                game.u.uhp = Math.max(
                    0, (game.u.uhp ?? 1) - frailtyDamage,
                );
                game.u.uhpmax = Math.max(
                    1, (game.u.uhpmax ?? 1) - frailtyDamage,
                );
            }
            if (attributes && strengthLoss > 0) {
                attributes[A_STR] = reducedStrength;
                if (!Array.isArray(game.u._exercise))
                    game.u._exercise = Array(6).fill(0);
                game.u._exercise[A_STR] = 0;
            }
            game.u.uhp = Math.max(0, (game.u.uhp ?? 1) - rnd(10));
            exerciseAttribute(A_CON, false);
        }
    } else if (fate === 22) {
        continueFountainMessage = !!(await summonFountainSnakes()).message;
    } else if (fate === 23) {
        continueFountainMessage = !!(await summonFountainDemon()).message;
    } else if (fate === 26) {
        await fountainMonsterDetection();
        exerciseAttribute(A_WIS, true);
    } else if (fate === 27 && !((loc.looted ?? 0) & 1)) {
        continueFountainMessage = (await discoverFountainGem(loc)).discovered;
    } else if (fate === 27 || fate === 28) {
        continueFountainMessage = !!(await summonFountainNymph()).message;
    } else if (fate === 30) {
        fountainMessage = (await dogushforth(true)).join('  ');
    } else if (fate >= 10) {
        fountainMessage =
            `This tepid ${displayLiquidName('water')} is tasteless.`;
    }
    if (fountainMessage) {
        if (continueFountainMessage)
            await plineWithContinuation(fountainMessage);
        else await pline(fountainMessage);
    }
    if (vomitAfterMessage) await vomitHero({ state: game });

    // dryup(): the first use dries this ordinary dungeon fountain on a
    // one-in-three roll and turns it back into ordinary room floor.
    const dryup = dryFountainTerrain(loc);
    if (dryup.dried) await pline('The fountain dries up!');
    await reportFountainWarning(dryup.warning);
}

function clearDetectionMap() {
    for (let x = 1; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            const loc = game.level?.at(x, y);
            if (!loc) continue;
            loc.disp_ch = ' ';
            loc.disp_color = NO_COLOR;
            loc.disp_decgfx = false;
            loc.disp_attr = 0;
        }
    }
}

function showDetectedMonsters() {
    clearDetectionMap();
    for (const monster of game.level?.monsters || []) {
        if ((monster.mhp ?? 1) <= 0 || !monster.mx) continue;
        show_glyph_cell(
            monster.mx, monster.my, monster.symbol || '?',
            MONSTER_COLOR[monster.mnum] ?? monster.color ?? NO_COLOR,
            false, monster.pet && game.flags?.hilite_pet ? 1 : 0,
        );
    }
    show_glyph_cell(game.u.ux, game.u.uy, '@', CLR_WHITE, false);
}

function detectedMonsterDescription(x, y) {
    const monster = game.level?.monsters?.find(candidate =>
        (candidate.mhp ?? 1) > 0 && candidate.mx === x && candidate.my === y);
    if (!monster) return 'unexplored area';
    const name = MONSTER_NAME[monster.mnum] || 'monster';
    if (monster.m_ap_type) return `${name}, mimicking something`;
    if (monster.isshk) {
        const shopName = monster.eshk?.shknam || monster.name || name;
        return `${monster.mpeaceful ? 'peaceful ' : ''}${shopName}`;
    }
    return `${monster.mpeaceful ? 'peaceful ' : ''}${name}`;
}

function farlookDelta(key) {
    const lower = key.toLowerCase();
    if (!isMovementKey(lower)) return null;
    const distance = key === lower ? 1 : 8;
    return { dx: DIR_DX[lower] * distance, dy: DIR_DY[lower] * distance };
}

// C refs: detect.c:monster_detect() and getpos.c:browse_map().  Detection is
// modal: its two pagers and cursor loop consume input before control returns
// to drinkfountain(), so exercise() and dryup() belong to the final dismissal
// boundary rather than to the initial `y` response.
async function fountainMonsterDetection() {
    const displaySnapshot = captureMapDisplay();
    showDetectedMonsters();
    await moreUntilDismissed('You sense the presence of monsters.--More--');
    await farlookTipUntilDismissed();

    let cursorX = game.u.ux;
    let cursorY = game.u.uy;
    game._pending_message = "(For instructions type a '?')  Move cursor to monster of interest:";
    await flush_screen(1);
    game.nhDisplay?.setCursor(cursorX - 1, cursorY + 1);

    for (;;) {
        const keyCode = await nhgetch();
        if ([27, 32, 10, 13].includes(keyCode)) break;
        const key = String.fromCharCode(keyCode);
        const delta = farlookDelta(key);
        if (!delta) continue;
        cursorX = Math.max(1, Math.min(COLNO - 1, cursorX + delta.dx));
        cursorY = Math.max(0, Math.min(ROWNO - 1, cursorY + delta.dy));
        game._pending_message = detectedMonsterDescription(cursorX, cursorY);
        await flush_screen(1);
        game.nhDisplay?.setCursor(cursorX - 1, cursorY + 1);
    }

    await moreUntilDismissed('Done.--More--');
    restoreMapDisplay(displaySnapshot);
    game._pending_message = '';
    await flush_screen(1);
}

async function ordinaryDescend() {
    const stair = game.level?.dnstair;
    if (!stair || game.u?.ux !== stair.x || game.u?.uy !== stair.y) {
        await pline("You can't go down here.");
        game.context.move = 0;
        return false;
    }

    // do.c:goto_level() clears this before saving the departing floor.
    // ordinaryDescend() owns a separate pager-preserving transition and must
    // still discard the level-local destination selected on the old map.
    game._travelTarget = null;

    // C goto_level() creates/restores the destination before tty exposes the
    // verbose descent pager. Preserve the old map and its already-rendered
    // screen while mklev() owns getbones() and the full destination RNG.
    const oldLevel = game.level;
    const oldStairs = game.stairs;
    const oldDepth = { ...(game.u.uz || {}) };
    const oldKey = `${oldDepth.dnum ?? 0}:${oldDepth.dlevel ?? 1}`;
    if (!game._levelCache) game._levelCache = new Map();
    const migratingPunishment = heroIsPunished()
        ? {
            ball: game.uball || game.u?.uball,
            chain: game.uchain || game.u?.uchain,
            ballCarried: game.inventory?.includes(
                game.uball || game.u?.uball,
            ),
        }
        : null;
    if (migratingPunishment) {
        if (!migratingPunishment.ballCarried) {
            const ballX = migratingPunishment.ball.ox;
            const ballY = migratingPunishment.ball.oy;
            remove_object(migratingPunishment.ball);
            newsym(ballX, ballY);
        }
        const chainX = migratingPunishment.chain.ox;
        const chainY = migratingPunishment.chain.oy;
        remove_object(migratingPunishment.chain);
        newsym(chainX, chainY);
    }
    const followers = levelFollowers(oldLevel);
    if (followers.length) {
        for (const follower of followers)
            retainFollowerDepartureGlyph(oldLevel, follower);
        oldLevel.monsters = oldLevel.monsters.filter(monster =>
            !followers.includes(monster));
    }
    game._levelCache.set(oldKey, cachedLevelState(oldLevel, oldStairs));

    let stairway = null;
    for (let candidate = game.stairs; candidate; candidate = candidate.next) {
        if (!candidate.up && candidate.sx === game.u.ux
            && candidate.sy === game.u.uy) {
            stairway = candidate;
            break;
        }
    }
    if (stairway) stairway.u_traversed = true;
    const destinationDepth = stairway?.tolev
        ? { ...stairway.tolev }
        : {
            ...oldDepth,
            dlevel: (oldDepth.dlevel ?? 1) + 1,
        };
    const cached = game._levelCache.get(levelCacheKey(destinationDepth));
    game.u.uz = destinationDepth;
    if (cached) {
        game.level = cached.level;
        game.stairs = cached.stairs;
        restoreCachedLevelMetadata(cached);
        restoreCachedMonsterState(cached);
    } else {
        game._specialLevelPrototype = specialPrototypeAt(
            destinationDepth.dnum, destinationDepth.dlevel,
        );
        await mklev();
        creditTouristNewLevel();
    }
    u_on_upstairs();
    for (let candidate = game.stairs; candidate; candidate = candidate.next) {
        if (candidate.sx === game.u.ux && candidate.sy === game.u.uy
            && candidate.tolev?.dnum === oldDepth.dnum
            && candidate.tolev?.dlevel === oldDepth.dlevel) {
            candidate.u_traversed = true;
            break;
        }
    }
    if (migratingPunishment) {
        if (!migratingPunishment.ballCarried)
            place_object(migratingPunishment.ball, game.u.ux, game.u.uy);
        place_object(migratingPunishment.chain, game.u.ux, game.u.uy);
        game.u.bc_order = migratingPunishment.ballCarried ? 2 : 1;
    }
    let descentMessage = 'You descend the stairs.--More--';
    let lowHitPointWarning = '';
    const loseHitPoints = damage => {
        game.u.uhp = Math.max(0, (game.u.uhp ?? 1) - damage);
        if (damage <= 0 || game.u.uhp <= 0
            || game.u.uhp * 10 >= (game.u.uhpmax ?? game.u.uhp)
            || (game.moves ?? 0) <= (game._wailmsg ?? 0) + 50)
            return;
        game._wailmsg = game.moves ?? 0;
        const role = game.urole?.name?.m || '';
        const elf = game.urace?.name === 'elf'
            || game.urace?.noun === 'elf';
        if (role === 'Wizard' || role === 'Valkyrie' || elf) {
            const who = role === 'Wizard' || role === 'Valkyrie'
                ? role : 'Elf';
            lowHitPointWarning = game.u.uhp === 1
                ? `${who} is about to die.`
                : `${who}, your life force is running out.`;
        } else {
            lowHitPointWarning = game.u.uhp === 1
                ? 'You hear the wailing of the Banshee...'
                : 'You hear the howling of the CwnAnnwn...';
        }
    };
    const flying = !!(game.u?.flying || game.flying);
    const falls = !flying && (nearCapacity(game) > 0
        || !!migratingPunishment
        || game.u?.fumbling || (game.u?.fumblingTurns ?? 0) > 0);
    if (flying) {
        descentMessage = 'You fly down the stairs.--More--';
    } else if (falls) {
        descentMessage = 'You fall down the stairs.--More--';
    }
    // C goto_level() applies an ordinary stair-tumble's rnd(3) damage after
    // placing the hero but before losedogs() brings followers onto the new
    // level.  The old tty status remains on screen until the fall pager is
    // acknowledged, so take the source-ordered roll here and commit its HP
    // effect after that acknowledgement.  Keep punished descent on its
    // existing continuation path: drag_down() can add its own messages and
    // extra damage draws.
    const ordinaryFallBeforeFollowers = falls && !game.u?.usteed
        && !migratingPunishment;
    const ordinaryFallDamage = ordinaryFallBeforeFollowers ? rnd(3) : 0;
    for (const follower of followers) arriveWithHero(follower);
    resolveHeroArrivalCollision();
    const newLevel = game.level;
    const newStairs = game.stairs;
    const newPosition = { x: game.u.ux, y: game.u.uy };
    recordDungeonEntryAchievements(game, oldDepth, destinationDepth);

    game.level = oldLevel;
    game.stairs = oldStairs;
    game.u.uz = oldDepth;
    await promptKey(descentMessage);
    restoreFollowerDepartureGlyphs(oldLevel, followers);
    if (ordinaryFallDamage)
        loseHitPoints(ordinaryFallDamage);

    // C emits the fall line before drag_down() and ordinary tumble damage.
    // A punished collision clears the old map and owns a second pager after
    // all of its damage/exercise calls and the final fall draw.
    let ballImpactMessage = '';
    if (falls && !game.u?.usteed && migratingPunishment) {
        await cls();
        let dragChance = 3;
        if (rn2(2)) {
            ballImpactMessage = 'The iron ball smacks into you!';
            loseHitPoints(rnd(20));
            exerciseAttribute(A_STR, false);
            dragChance -= 2;
        }
        if (dragChance >= rnd(6)) {
            ballImpactMessage = ballImpactMessage
                ? `${ballImpactMessage}  The iron ball drags you downstairs!`
                : 'The iron ball drags you downstairs!';
            loseHitPoints(rnd(3));
            exerciseAttribute(A_STR, false);
        }
        loseHitPoints(rnd(3));
    }
    if (ballImpactMessage) {
        game._suppressMapStatusForFlush = true;
        try {
            await promptKey(`${ballImpactMessage}--More--`);
        } finally {
            game._suppressMapStatusForFlush = false;
        }
    }
    if (lowHitPointWarning) {
        await cls();
        game._suppressMapStatusForFlush = true;
        try {
            await promptKey(`${lowHitPointWarning}--More--`);
        } finally {
            game._suppressMapStatusForFlush = false;
        }
    }

    game.level = newLevel;
    game.stairs = newStairs;
    game.u.uz = destinationDepth;
    game.u.ux = newPosition.x;
    game.u.uy = newPosition.y;
    restoreCachedHeroTrack(cached);
    // Monsters on the destination start with no movement. The next cycle
    // must allocate their first movement ration before reading a command.
    game._ordinaryDescentLive = true;
    game._pending_message = '';
    game.context.move = 1;
    await cls();
    vision_reset();
    vision_recalc(0);
    await docrt();
    if (migratingPunishment && !migratingPunishment.ballCarried) {
        const destinationPile
            = game.level?.objects?.[game.u.ux]?.[game.u.uy] || [];
        if (destinationPile.includes(migratingPunishment.chain)
            && destinationPile.includes(migratingPunishment.ball)) {
            let feature = `There is a staircase up to level ${
                dungeonDepth(oldDepth.dnum, oldDepth.dlevel)
            } here.`;
            for (let candidate = game.stairs; candidate;
                candidate = candidate.next) {
                if (candidate.sx !== game.u.ux || candidate.sy !== game.u.uy
                    || candidate.tolev?.dnum === destinationDepth.dnum)
                    continue;
                const dungeon = game.dungeons?.[candidate.tolev?.dnum];
                const destinationName = (dungeon?.dname || 'another dungeon')
                    .replace(/^The\b/, 'the');
                feature = `There is a branch staircase ${candidate.up ? 'up' : 'down'} to ${destinationName} here.`;
                break;
            }
            await showFloorPile(
                destinationPile,
                false,
                feature,
            );
        }
    }
    await bot();
    return true;
}

function levelCacheKey(depth) {
    return `${depth?.dnum ?? 0}:${depth?.dlevel ?? 1}`;
}

// C ref: do.c:goto_level().  This belongs to the new-destination branch,
// after mklev()/getbones() has established u.uz.  Revisited cached levels do
// not receive exploration experience.
function creditTouristNewLevel() {
    if (game.urole?.key !== 'tourist') return;
    const difficulty = level_difficulty();
    game.u.uexp = (game.u.uexp || 0) + difficulty;
    game.u.urexp = (game.u.urexp || 0) + 4 * difficulty;
}

function cloneHeroTrack(track = game._heroTrack) {
    return (track || []).map(point => ({ x: point.x, y: point.y }));
}

function cachedLevelState(level, stairs) {
    return {
        level,
        stairs,
        heroTrack: cloneHeroTrack(),
        savedAt: game.moves ?? 0,
        // Is_special() is level data in C. JS keeps the parsed Lua identity
        // beside the map, so it must travel with the cached level rather than
        // remain whichever descriptor was generated most recently.
        activeSpecialLevel: game._activeSpecialLevel || null,
    };
}

function restoreCachedHeroTrack(cached) {
    game._heroTrack = cloneHeroTrack(cached?.heroTrack || []);
}

const M1_CONCEAL = 0x00000080;
const M1_HIDE = 0x00000100;

// C restore.c:getlev() catches every saved actor up to the elapsed move and
// then gives hiders one rnd(10) retry. Keep the observable per-actor probe in
// the level-cache owner; arrival and follower migration happen afterwards.
function restoreCachedMonsterState(cached) {
    const elapsed = Math.max(0, (game.moves ?? 0)
        - (cached?.savedAt ?? ((game.moves ?? 0) - 1)));
    if (!elapsed) return;

    // save.c writes fmon in linked-list order and restore.c rebuilds that
    // order.  mklev.js stores actors in construction order instead, which is
    // the reverse of C's head-inserted fmon chain.  Catch-up RNG is therefore
    // observable in reverse array order.
    const monsters = cached?.level?.monsters || [];
    for (let index = monsters.length - 1; index >= 0; index--) {
        const monster = monsters[index];
        const hideRoll = rnd(10);
        if (elapsed <= hideRoll || monster.mundetected || monster.m_ap_type)
            continue;
        const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
        const symbol = MONSTER_SYMBOL[monster.mnum] ?? 0;
        if (symbol === 57) { // S_EEL: hideunder() requires pool terrain.
            monster.mundetected = IS_POOL(
                cached.level?.at?.(monster.mx, monster.my)?.typ,
            );
        } else if (flags & M1_CONCEAL) {
            monster.mundetected = !!cached.level?.objects
                ?.[monster.mx]?.[monster.my]?.length;
        } else if ((flags & M1_HIDE) && !monster.mcan) {
            // mon.c:hide_monst()->restrap() owns a one-in-three probe even
            // when a ceiling hider ultimately cannot conceal itself.  Mimics
            // which already have an appearance were filtered above; an
            // undisguised mimic's set_mimic_sym() remains a separate
            // appearance-construction boundary.
            const restrapRoll = rn2(3);
            if (!restrapRoll && symbol !== 13
                && cached.level?.at?.(monster.mx, monster.my)?.typ === ROOM) {
                monster.mundetected = true;
            }
        }
    }
}

function restoreCachedLevelMetadata(cached) {
    game._activeSpecialLevel = cached?.activeSpecialLevel || null;
}

const M2_STALK = 0x01000000;

// C refs: mondata.c levl_follower() and dog.c keepdogs().  A level follower
// is broader than a pet: non-fleeing stalking species accompany the hero too.
// This notably includes peaceful watchmen, whose With_you arrival uses the
// rn2(5) branch rather than a tame companion's rn2(10) branch.
function levelFollowerEligible(monster) {
    if (!monster || monster.dead) return false;
    // C dog.c:keepdogs() filters levl_follower() through helpless() and the
    // script-level wait strategy.  A stalking monster is not entitled to
    // cross a level merely because it is adjacent: sleeping Morgue actors
    // and waiting special-level residents remain with their source level.
    if (monster.msleeping || monster.mcanmove === 0
        || ((monster.mstrategy || 0) & STRAT_WAITFORU)) return false;
    if (monster.pet || (monster.mtame ?? 0) > 0) return true;
    // mondata.c:levl_follower(): the Wizard is a dedicated follower class,
    // independent of M2_STALK.  keepdogs() additionally lets him pursue the
    // hero's Amulet from anywhere on the departing level.
    if (monster.iswiz) return true;
    const stalking = !!((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_STALK);
    return stalking && (!monster.mflee || game.u?.uhave?.amulet);
}

function levelFollowers(level) {
    return (level?.monsters || []).filter(monster =>
        levelFollowerEligible(monster)
        && ((Math.abs(monster.mx - game.u.ux) <= 1
                && Math.abs(monster.my - game.u.uy) <= 1)
            || (game.u?.uhave?.amulet && monster.iswiz)));
}

// Level departure can begin while an earlier message is still visible.
// Preserve the displayed follower until that message is dismissed, then
// restore the remembered terrain beneath it.
function retainFollowerDepartureGlyph(level, follower) {
    const loc = level?.at?.(follower.mx, follower.my);
    if (!loc?.disp_ch || loc.disp_ch === ' ') return;
    const terrain = terrain_glyph(loc, follower.mx, follower.my);
    loc._followerDepartureUnderlay = loc.remembered_glyph
        ? { ...loc.remembered_glyph }
        : {
            ch: terrain.ch,
            color: terrain.color,
            decgfx: !!terrain.dec,
            kind: 'terrain',
        };
    loc.remembered_glyph = {
        ch: loc.disp_ch,
        color: loc.disp_color,
        decgfx: !!loc.disp_decgfx,
        attr: loc.disp_attr || 0,
        kind: 'monster',
    };
}

function restoreFollowerDepartureGlyphs(level, followers) {
    for (const follower of followers) {
        const loc = level?.at?.(follower.mx, follower.my);
        if (!loc || !Object.hasOwn(loc, '_followerDepartureUnderlay'))
            continue;
        const underlay = loc._followerDepartureUnderlay;
        delete loc._followerDepartureUnderlay;
        if (underlay) {
            loc.remembered_glyph = underlay;
            loc.disp_ch = underlay.ch;
            loc.disp_color = underlay.color;
            loc.disp_decgfx = !!underlay.decgfx;
            loc.disp_attr = underlay.attr || 0;
        } else {
            delete loc.remembered_glyph;
            loc.disp_ch = ' ';
            loc.disp_color = NO_COLOR;
            loc.disp_decgfx = false;
            loc.disp_attr = 0;
        }
    }
}

function randomArrivalCellOk(x, y) {
    const level = game.level;
    const loc = level?.at?.(x, y);
    if (!loc) return false;
    const openTerrain = loc.typ === ROOM || IS_AIR(loc.typ)
        || (loc.typ === CORR && level.flags?.is_maze_lev);
    if (!openTerrain || IS_FURNITURE(loc.typ)
        || IS_POOL(loc.typ) || IS_LAVA(loc.typ)) return false;
    if (level.traps?.some(trap => trap.tx === x && trap.ty === y)) return false;
    return !level.monsters?.some(monster => !monster.dead
        && monster.mx === x && monster.my === y);
}

// C refs: dungeon.c u_on_rndspot(), mkmaze.c place_lregion().  Ordinary
// numeric level teleport uses the whole map; a special level can replace it
// with the direction-specific updest/dndest saved by fixup_special().
export function placeHeroAtRandomArrival(region = null) {
    const lx = Math.max(1, region?.lx ?? 1);
    const hx = Math.min(COLNO - 1, region?.hx ?? COLNO - 1);
    const ly = Math.max(0, region?.ly ?? 0);
    const hy = Math.min(ROWNO - 1, region?.hy ?? ROWNO - 1);
    const excluded = (x, y) => region?.exclude
        && x >= region.exclude.lx && x <= region.exclude.hx
        && y >= region.exclude.ly && y <= region.exclude.hy;
    let x = lx, y = ly;
    for (let attempt = 0; attempt < 200; attempt++) {
        x = rn2(hx - lx + 1) + lx;
        y = rn2(hy - ly + 1) + ly;
        if (excluded(x, y) || !randomArrivalCellOk(x, y)) continue;
        game.u.ux = game.u.ux0 = x;
        game.u.uy = game.u.uy0 = y;
        return { x, y };
    }
    for (x = lx; x <= hx; x++) {
        for (y = ly; y <= hy; y++) {
            if (excluded(x, y) || !randomArrivalCellOk(x, y)) continue;
            game.u.ux = game.u.ux0 = x;
            game.u.uy = game.u.uy0 = y;
            return { x, y };
        }
    }
    return null;
}

function shuffledArrivalCoords(cx, cy, maxRadius = 3) {
    const output = [];
    for (let radius = 1; radius <= maxRadius; radius++) {
        const ring = [];
        const lowX = cx - radius, highX = cx + radius;
        const lowY = cy - radius, highY = cy + radius;
        for (let y = Math.max(lowY, 0); y <= highY && y < ROWNO; y++) {
            for (let x = Math.max(lowX, 1); x <= highX && x < COLNO; x++) {
                if (x !== lowX && x !== highX && y !== lowY && y !== highY)
                    continue;
                ring.push({ x, y });
            }
        }
        for (let i = 0, remaining = ring.length; remaining > 1;
            i++, remaining--) {
            const offset = rn2(remaining);
            if (offset) [ring[i], ring[i + offset]] = [ring[i + offset], ring[i]];
        }
        output.push(...ring);
    }
    return output;
}

function followerArrivalCellOk(follower, x, y) {
    const loc = game.level?.at?.(x, y);
    if (!loc || blocksMove(x, y) || IS_POOL(loc.typ) || IS_LAVA(loc.typ))
        return false;
    return !game.level.monsters?.some(monster => monster !== follower
        && !monster.dead && monster.mx === x && monster.my === y);
}

function heroArrivalCellOk(x, y) {
    const loc = game.level?.at?.(x, y);
    if (!loc || blocksMove(x, y) || IS_POOL(loc.typ) || IS_LAVA(loc.typ))
        return false;
    return !game.level.monsters?.some(monster => !monster.dead
        && monster.mx === x && monster.my === y);
}

// C ref: do.c u_collide_m().  mon_arrive(With_you) can deliberately place a
// follower on the hero's intended stair.  goto_level() resolves that overlap
// only after all followers and delivered objects are live.  enexto() collects
// and shuffles all three rings before next2u() accepts an adjacent hero spot.
function resolveHeroArrivalCollision() {
    const collision = game.level?.monsters?.find(monster => !monster.dead
        && monster.mx === game.u?.ux && monster.my === game.u?.uy);
    if (!collision) return;

    if (!rn2(2)) {
        const destination = collectNearbyCoords(game.u.ux, game.u.uy, 3)
            .find(({ x, y }) => heroArrivalCellOk(x, y));
        if (destination
            && Math.abs(destination.x - game.u.ux) <= 1
            && Math.abs(destination.y - game.u.uy) <= 1) {
            game.u.ux0 = game.u.ux;
            game.u.uy0 = game.u.uy;
            game.u.ux = destination.x;
            game.u.uy = destination.y;
            return;
        }
    }

    const destination = shuffledArrivalCoords(game.u.ux, game.u.uy)
        .find(({ x, y }) => followerArrivalCellOk(collision, x, y));
    if (destination) {
        collision.mx = destination.x;
        collision.my = destination.y;
    }
}

// C refs: dog.c mon_arrive(With_you), mon.c mnexto(), and
// teleport.c enexto_core().  collect_coords() shuffles all three near rings
// before goodpos() selects the first viable result, so every shuffle belongs
// to the arrival transaction even when ring one already contains a good spot.
function arriveWithHero(follower) {
    if (!follower) return;
    follower.dead = false;
    if (!game.level.monsters.includes(follower))
        game.level.monsters.push(follower);

    if (!game.level.monsters.some(monster => monster !== follower
        && !monster.dead && monster.mx === game.u.ux && monster.my === game.u.uy)
        && !rn2(follower.pet ? 10 : follower.mpeaceful ? 5 : 2)) {
        follower.mx = game.u.ux;
        follower.my = game.u.uy;
        return;
    }

    const destination = shuffledArrivalCoords(game.u.ux, game.u.uy)
        .find(({ x, y }) => followerArrivalCellOk(follower, x, y));
    if (destination) {
        follower.mx = destination.x;
        follower.my = destination.y;
    }
}

// C ref: wizard.c:resurrect().  A first endgame crossing with the Amulet
// forces a fresh Wizard when no live one remains.  makemonNear() owns
// makemon(byyou)'s three shuffled rings; arrival prose remains an ordinary
// tty continuation so the prior materialization line is acknowledged first.
export async function resurrectWizard() {
    const existing = game.level?.monsters?.find(monster =>
        !monster.dead && monster.iswiz);
    if (existing) return existing;

    const wizard = await makemonNear(
        285, game.u.ux, game.u.uy, MM_NOWAIT,
    );
    if (!wizard) return null;
    wizard.mrevived = 1;
    wizard.mtame = 0;
    wizard.mpeaceful = 0;
    wizard.mstrategy = (wizard.mstrategy || 0) & ~STRAT_WAITMASK;
    newsym(wizard.mx, wizard.my);
    if (canSpotMonster(wizard)) {
        await plineWithContinuation(
            'The Wizard of Yendor suddenly appears next to you!',
        );
    }
    if (!game.deaf && !game.u?.deaf) {
        await plineWithContinuation(
            'A voice booms out...  "So thou thought thou couldst kill me, fool."',
        );
    }
    return wizard;
}

// Shared first-visit level transaction.  The arrival route is explicit so
// stair descent and wizard level teleport can share persistent construction
// without sharing their coordinate or tty semantics.
async function gotoLevel(targetDepth, {
    arrival = 'random',
    postMessage = '',
    preArrivalPager = '',
} = {}) {
    const oldDepth = { ...(game.u.uz || {}) };
    const destinationDepth = { ...oldDepth, ...targetDepth };
    // C do.c:goto_level() silently returns when a forced Wizard-menu
    // destination is the level already occupied.  The tty menu still closes
    // and exposes a fresh map, but no level cache, actor migration, arrival
    // coordinate, or materialization message is allowed to run.
    if (destinationDepth.dnum === oldDepth.dnum
        && destinationDepth.dlevel === oldDepth.dlevel) {
        game._pending_message = '';
        game._retained_message = '';
        game.context.move = 0;
        await cls();
        vision_recalc(0);
        await docrt();
        await bot();
        return;
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
        game.context.move = 0;
        await pline('A mysterious force prevents you from descending.');
        return;
    }

    // C goto_level() resets iflags.travelcc because map coordinates are
    // level-local.  A destination from the departing floor must never seed a
    // later getpos cursor on the destination floor.
    game._travelTarget = null;
    const oldLevel = game.level;
    const oldStairs = game.stairs;
    const previousTemperature = oldLevel?.flags?.temperature || 0;
    const oldPosition = {
        x: game.u.ux,
        y: game.u.uy,
        x0: game.u.ux0,
        y0: game.u.uy0,
    };
    // C do.c:goto_level() unplaces punishment before savelev(), retaining
    // object identity while removing both objects from the departing floor.
    // placebc() installs them on the destination after hero placement.
    const migratingPunishment = heroIsPunished()
        ? {
            ball: game.uball || game.u?.uball,
            chain: game.uchain || game.u?.uchain,
            ballCarried: game.inventory?.includes(
                game.uball || game.u?.uball,
            ),
        }
        : null;
    if (migratingPunishment) {
        if (!migratingPunishment.ballCarried) {
            const ballX = migratingPunishment.ball.ox;
            const ballY = migratingPunishment.ball.oy;
            remove_object(migratingPunishment.ball);
            newsym(ballX, ballY);
        }
        const chainX = migratingPunishment.chain.ox;
        const chainY = migratingPunishment.chain.oy;
        remove_object(migratingPunishment.chain);
        newsym(chainX, chainY);
    }
    const followers = levelFollowers(oldLevel);
    if (followers.length) {
        for (const follower of followers)
            retainFollowerDepartureGlyph(oldLevel, follower);
        oldLevel.monsters = oldLevel.monsters.filter(monster =>
            !followers.includes(monster));
    }

    // C goto_level() detaches followers, recalculates the departing map, and
    // then removes the entire old sight field before savelev().  Keep this on
    // the source graph: under Hallucination the loss repaint advances the
    // independent display stream before the destination is constructed.
    vision_recalc(2);

    if (!game._levelCache) game._levelCache = new Map();
    game._levelCache.set(
        levelCacheKey(oldDepth), cachedLevelState(oldLevel, oldStairs),
    );

    const cached = game._levelCache.get(levelCacheKey(destinationDepth));
    game.u.uz = destinationDepth;
    if (cached) {
        game.level = cached.level;
        game.stairs = cached.stairs;
        restoreCachedLevelMetadata(cached);
        restoreCachedMonsterState(cached);
    } else {
        await mklev();
        creditTouristNewLevel();
    }

    if (arrival === 'stairs') u_on_upstairs();
    else if (arrival === 'downstairs') u_on_downstairs();
    else if (arrival === 'portal') {
        const portal = game.level?.traps?.find(trap =>
            trap.ttyp === MAGIC_PORTAL);
        if (portal) {
            game.u.ux0 = game.u.ux;
            game.u.uy0 = game.u.uy;
            game.u.ux = portal.tx;
            game.u.uy = portal.ty;
            // deferred_goto(UTOTYPE_PORTAL) arrives through the trap, making
            // it known before the hero's next intrinsic-search maintenance.
            portal.tseen = true;
        } else {
            placeHeroAtRandomArrival(game.level?.upTeleportRegion);
        }
    }
    else {
        const goingDown = dungeonDepth(
            destinationDepth.dnum, destinationDepth.dlevel,
        ) > dungeonDepth(oldDepth.dnum, oldDepth.dlevel);
        placeHeroAtRandomArrival(goingDown
            ? game.level?.downTeleportRegion
            : game.level?.upTeleportRegion);
    }
    if (migratingPunishment) {
        if (!migratingPunishment.ballCarried) {
            place_object(
                migratingPunishment.ball, game.u.ux, game.u.uy,
            );
            game.u.bc_order = 1; // BCPOS_CHAIN
        } else {
            game.u.bc_order = 2; // BCPOS_DIFFER
        }
        place_object(
            migratingPunishment.chain, game.u.ux, game.u.uy,
        );
    }
    for (const follower of followers) arriveWithHero(follower);
    await killGenocidedMonsters();
    resolveHeroArrivalCollision();
    if (Is_airlevel(game.u?.uz) || Is_waterlevel(game.u?.uz))
        moveElementalBubbles();
    else if (game.level?.flags?.fumaroles) fumaroles(game);

    const newLevel = game.level;
    const newStairs = game.stairs;
    const newDepth = { ...(game.u.uz || destinationDepth) };
    const newPosition = {
        x: game.u.ux,
        y: game.u.uy,
        x0: game.u.ux0,
        y0: game.u.uy0,
    };

    // C schedule_goto()/deferred_goto() completes construction and follower
    // arrival before tty asks for acknowledgement of an already-pending
    // message.  Temporarily expose the cached source graph so that pager
    // still renders the old level while all destination RNG remains on the
    // source side of the input boundary.
    if (preArrivalPager) {
        game.level = oldLevel;
        game.stairs = oldStairs;
        game.u.uz = oldDepth;
        game.u.ux = oldPosition.x;
        game.u.uy = oldPosition.y;
        game.u.ux0 = oldPosition.x0;
        game.u.uy0 = oldPosition.y0;
        await promptKey(preArrivalPager);
        restoreFollowerDepartureGlyphs(oldLevel, followers);

        game.level = newLevel;
        game.stairs = newStairs;
        game.u.uz = newDepth;
        game.u.ux = newPosition.x;
        game.u.uy = newPosition.y;
        game.u.ux0 = newPosition.x0;
        game.u.uy0 = newPosition.y0;
    }
    if (!preArrivalPager)
        restoreFollowerDepartureGlyphs(oldLevel, followers);

    // savelev()/getlev() serializes the pursuit ring with each level.  A new
    // destination starts empty; a revisited one resumes its own older trail.
    // getlev() restores the pursuit ring serialized inside a bones level.
    // A newly generated destination starts empty, while a cached ordinary
    // level restores its own saved ring.  Do not erase the bones ring merely
    // because this destination was not present in the live level cache.
    if (!game._restoredBones) restoreCachedHeroTrack(cached);
    game._ordinaryDescentLive = true;
    game._pending_message = '';
    game.context.move = 0;
    await cls();
    vision_reset_new_level();
    vision_recalc(0);
    await docrt({ visibleAlreadyProjected: true });
    // onquest()->qt_pager() loads and substitutes quest.lua before the tty
    // text window collides with an older pending materialization pline.
    // Preparation therefore belongs before the acknowledgement input even
    // though the quest page itself is exposed only after that input.
    const questArrival = prepareQuestArrival({
        fromDepth: oldDepth,
        firstVisit: !cached,
    });
    const questPortalCall = arrival === 'portal' ? null
        : prepareMainQuestPortalCall({ firstVisit: !cached });
    const oldDungeon = game.dungeons?.[oldDepth.dnum ?? 0];
    const newDungeon = game.dungeons?.[newDepth.dnum ?? 0];
    recordDungeonEntryAchievements(game, oldDepth, newDepth);
    const enteredValley = !oldDungeon?.flags?.hellish
        && !!newDungeon?.flags?.hellish
        && game.valley_level
        && newDepth.dnum === game.valley_level.dnum
        && newDepth.dlevel === game.valley_level.dlevel;
    if (game._restoredBones) {
        // do.c marks a loaded bones level as familiar.  tty can suspend the
        // deferred level-teleport message before familiar_level_msg() is
        // delivered, leaving the latter pending at the hero cursor for the
        // next input boundary.
        const familiarMessages = [
            'You have a sense of deja vu.',
            "You feel like you've been here before.",
            'This place looks familiar...',
            '',
        ];
        const familiarMessage = familiarMessages[rn2(4)];
        // getlev() has made awake restored monsters ready for the first
        // new-hero movement cycle. The newly arriving companion retains its
        // own movement balance and joins after that initial actor scan.
        game._monsterMovementInitialized = true;
        if (postMessage) {
            await pline(postMessage);
            await flushPendingTopline();
        }
        if (familiarMessage) await pline(familiarMessage);
        game._restoredBones = false;
    } else if (questArrival?.page || questArrival?.line) {
        if (postMessage) {
            await pline(postMessage);
            await flushPendingTopline();
        }
        await displayPreparedQuestArrival(questArrival);
        if (questArrival.page) {
            // A quest text window replaces the tty topline transaction. Once
            // its final page is dismissed, the earlier teleport line is gone.
            game._pending_message = '';
            game._retained_message = '';
        }
    } else {
        if (questArrival) await displayPreparedQuestArrival(questArrival);
        if (postMessage) await pline(postMessage);
        // do.c:goto_level() announces a newly generated Rogue floor after
        // level-teleport feedback.  tty continuation therefore suspends on
        // the materialization line and exposes the classic Rogue map before
        // installing this second line.
        if (!cached && Is_rogue_level(newDepth)) {
            await plineWithContinuation(
                'You enter what seems to be an older, more primitive world.',
            );
        }
        const specialMessages = game._activeSpecialLevel?.specialMessages || [];
        if (specialMessages.length) {
            // do.c can expose level-teleport feedback during destination
            // docrt(), before deliver_splev_message() starts its newline
            // stream. Model that completed topline as separate from the
            // custom arrival text; the later temperature message owns the
            // pager which leaves both Air lines visible at input 110.
            game._pending_message = '';
            game._retained_message = '';
            for (const line of specialMessages)
                await plineWithContinuation(line);
        }
        if (enteredValley) {
            // do.c:goto_level() announces the first crossing into Gehennom
            // after the destination redraw.  Ordinary topline continuation
            // owns the two acknowledgement boundaries between these lines.
            await plineWithContinuation(
                'You arrive at the Valley of the Dead...',
            );
            await plineWithContinuation(
                'The odor of burnt flesh and decay pervades the air.',
            );
            await plineWithContinuation(
                'You hear groans and moans everywhere.',
            );
        }
        if (questPortalCall) {
            for (const line of questPortalCall)
                await plineWithContinuation(line);
        }
    }
    const enteredEndgame = oldDepth.dnum !== newDepth.dnum
        && In_endgame(newDepth);
    if (enteredEndgame && game.u?.uhave?.amulet)
        await resurrectWizard();
    // do.c:temperature_change_msg() belongs to the completed level-change
    // transaction.  Named levels such as the Valley can override Gehennom's
    // inherited heat, so compare saved level flags rather than dungeon names.
    const currentTemperature = game.level?.flags?.temperature || 0;
    if (currentTemperature !== previousTemperature) {
        if (currentTemperature) {
            await plineWithContinuation(
                `It is ${currentTemperature > 0 ? 'hot' : 'cold'} here.`,
            );
            if (newDungeon?.flags?.hellish && currentTemperature > 0)
                await plineWithContinuation(
                    `You ${heroHasOlfaction() ? 'smell' : 'sense'} smoke...`,
                );
        } else if (previousTemperature > 0) {
            await plineWithContinuation(
                `The heat${oldDungeon?.flags?.hellish
                    ? ' and smoke are' : ' is'} gone.`,
            );
        } else if (previousTemperature < 0) {
            await plineWithContinuation('You are out of the cold.');
        }
    }
    const levelAnnotation = game._levelAnnotations?.get?.(
        `${newDepth.dnum}:${newDepth.dlevel}`,
    );
    if (levelAnnotation) {
        await pline(`You remember this level as ${levelAnnotation}.`);
    }
    // C do.c:goto_level() calls check_special_room(FALSE) after quest and
    // other arrival-message producers.  Treat the source level's room set as
    // empty here so a destination temple or shop is an actual entry even
    // though random arrival initializes ux0 to the destination coordinates.
    await checkSpecialRoom({ newLevel: true });
    // C goto_level() converges through pickup(1), whose check_here() describes
    // an ordinary pile when it is not collected.  Keep the floor transaction
    // after Quest/special-room arrival messages so tty continuation owns any
    // resulting More boundary.  In particular, look_here() must acknowledge
    // a pending materialization line before opening its temporary pile window.
    const ordinaryArrivalPile =
        game.level?.objects?.[game.u.ux]?.[game.u.uy] || [];
    if (!migratingPunishment) {
        if (ordinaryArrivalPile.length > 1) {
            await showFloorPile(ordinaryArrivalPile);
        } else if (ordinaryArrivalPile.length === 1) {
            const sense = game.blind ? 'feel' : 'see';
            await plineWithContinuation(
                `You ${sense} here ${
                    floorObjectDescription(ordinaryArrivalPile[0])
                }.`,
            );
        }
    }
    // do.c:goto_level() converges at pickup(1).  Attached punishment objects
    // cannot be collected, so an otherwise empty arrival square is described
    // as a two-object floor pile after the destination redraw and messages.
    if (migratingPunishment && !migratingPunishment.ballCarried) {
        const arrivalPile = game.level?.objects?.[game.u.ux]?.[game.u.uy] || [];
        if (arrivalPile.includes(migratingPunishment.chain)
            && arrivalPile.includes(migratingPunishment.ball)) {
            let feature = '';
            for (let candidate = game.stairs; candidate;
                candidate = candidate.next) {
                if (candidate.sx !== game.u.ux
                    || candidate.sy !== game.u.uy) continue;
                if (candidate.tolev?.dnum !== newDepth.dnum) {
                    const destinationName = (
                        game.dungeons?.[candidate.tolev?.dnum]?.dname
                        || 'another dungeon'
                    ).replace(/^The\b/, 'the');
                    feature = `There is a branch staircase ${
                        candidate.up ? 'up' : 'down'
                    } to ${destinationName} here.`;
                } else if (candidate.tolev) {
                    feature = `There is a staircase ${
                        candidate.up ? 'up' : 'down'
                    } to level ${dungeonDepth(
                        candidate.tolev.dnum, candidate.tolev.dlevel,
                    )} here.`;
                }
                break;
            }
            // invent.c:look_here() announces a blind tactile inspection
            // before it opens the temporary pile window.  Each pline/menu
            // transition owns a separate tty acknowledgement.
            if (game.blind) {
                await plineWithContinuation(
                    'You try to feel what is lying here on the floor.',
                );
            }
            await showFloorPile(arrivalPile, false, feature);
            // pickup.c:pickup(1) performs check_here() before notake().
            // A blind hero in a form which cannot carry objects sees this
            // rejection only after dismissing the temporary pile window.
            if (heroCannotTake(game)) {
                await pline(
                    'You are physically incapable of picking anything up.',
                );
            }
        }
    }
    await bot();
}

// quest.c:expulsion(FALSE) schedules a portal arrival on the parent side of
// the Quest branch.  The deferred transition is executed by moveloop after
// the leader's modal dialogue returns, while the original hero action still
// owns the surrounding monster/global-turn transaction.
export async function performQuestExpulsion(g = game) {
    const current = g.u?.uz || {};
    const branch = g.branches?.find(candidate =>
        (candidate.end1?.dnum === current.dnum
            && candidate.end1?.dlevel === current.dlevel)
        || (candidate.end2?.dnum === current.dnum
            && candidate.end2?.dlevel === current.dlevel));
    if (!branch) return false;
    const destination = branch.end1?.dnum === current.dnum
        && branch.end1?.dlevel === current.dlevel
        ? branch.end2 : branch.end1;
    if (!destination) return false;
    await gotoLevel({ ...destination }, { arrival: 'portal' });
    g._questExpulsionPending = null;
    g.context.move = 1;
    return true;
}

async function ordinaryAscend() {
    const stair = game.level?.upstair;
    if (!stair || game.u?.ux !== stair.x || game.u?.uy !== stair.y) {
        await pline("You can't go up here.");
        game.context.move = 0;
        return false;
    }

    const oldDepth = { ...(game.u.uz || {}) };
    let sourceStair = null;
    for (let candidate = game.stairs; candidate; candidate = candidate.next) {
        if (candidate.up && candidate.sx === game.u.ux
            && candidate.sy === game.u.uy) {
            sourceStair = candidate;
            break;
        }
    }
    const destinationDepth = sourceStair?.tolev
        ? { ...sourceStair.tolev }
        : {
            ...oldDepth,
            dlevel: Math.max(1, (oldDepth.dlevel ?? 1) - 1),
        };
    if (sourceStair) sourceStair.u_traversed = true;
    const greatEffort = heroIsPunished()
        && !(game.u?.levitating || game.u?.flying);
    await gotoLevel(destinationDepth, {
        arrival: 'downstairs',
        preArrivalPager: greatEffort
            ? 'With great effort, you climb up the stairs.--More--'
            : 'You climb up the stairs.--More--',
    });
    // Stair travel consumes the source turn; after all transition pagers
    // close, the destination's first monster maintenance precedes the next
    // command.
    game.context.move = 1;
    return true;
}

function objectQuantity(object) {
    return object?.quan ?? object?.quantity ?? 1;
}

function basePickupObjectDescription(object) {
    const quantity = objectQuantity(object);
    if (object.otyp === GOLD_PIECE)
        return `${quantity} gold piece${quantity === 1 ? '' : 's'}`;
    if (object.otyp === DART) {
        if (quantity > 1) return `${quantity} darts`;
        return object.opoisoned ? 'a poisoned dart' : 'a dart';
    }
    if (object.otyp === SACK)
        return object.cknown && !object.contents?.length
            ? 'an empty bag' : 'a bag';
    if (object.otyp === 219) return 'a bag'; // unidentified bag of holding
    if (object.otyp === OIL_LAMP) return 'a lamp';
    if (object.oclass === 4 || object.class === 'Rings') {
        return floorObjectDescription(object);
    }
    if (object.oclass === 13 || (object.otyp >= 438 && object.otyp <= 474))
        return floorObjectDescription(object);
    return floorObjectDescription(object);
}

function pickupObjectDescription(object) {
    const description = basePickupObjectDescription(object);
    if (!object?.unpaid) return description;
    const price = unpaidObjectCost(object);
    return price > 0
        ? `${description} (unpaid, ${price} zorkmid${price === 1 ? '' : 's'})`
        : description;
}

function pickupObjectClass(object) {
    if (object.otyp === DART) return 'Weapons';
    if (object.otyp === SACK || object.otyp === OIL_LAMP) return 'Tools';
    if (object.otyp === CORPSE) return 'Comestibles';
    if (object.otyp === GOLD_PIECE) return 'Coins';
    if (object.oclass === 4 || object.otyp === RIN_CONFLICT) return 'Rings';
    if (object.oclass === 5) return 'Amulets';
    if (object.otyp >= 438 && object.otyp <= 474) return 'Gems/Stones';
    if (object.class === 'Gems') return 'Gems/Stones';
    if (object.class) return object.class;
    const oclass = object.oclass || objectClassForType(object.otyp);
    const label = OBJECT_CLASS_LABELS[oclass];
    if (label === 'Large rocks') return 'Rocks';
    if (label === 'Iron balls') return 'Balls';
    if (label === 'Venoms') return 'Other';
    return label || 'Other';
}

// C invent.c:loot_classify() FOOD_CLASS subclasses.  The default
// sortloot=loot option applies this after class/pack ordering and before
// stable ties, so an older ration precedes a newer corpse in pickup menus.
function pickupObjectSubclass(object) {
    const oclass = object.oclass || objectClassForType(object.otyp);
    if (oclass !== 7) return 1;
    if (object.otyp === SLIME_MOLD) return 1;
    if (object.otyp === TIN) return 3;
    if (object.otyp === EGG) return 4;
    if (object.otyp === CORPSE) return 5;
    return object.globby ? 6 : 2;
}

const OBJECT_CLASS_SYMBOL = [
    '', ')', '[', '', '=', '"', '(', '%', '!', '?', '+', '/', '$', '*',
    '`', '0', '_', '.',
];

function autopickupAllows(object) {
    const configured = game.flags?.pickup_types || '';
    if (!configured) return true;
    const symbol = OBJECT_CLASS_SYMBOL[object?.oclass] || '';
    return !!symbol && configured.includes(symbol);
}

const PICKUP_CLASS_ORDER = [
    // C options.c:def_inv_order.  query_objlist() assigns menu accelerators
    // while walking this configured class order, not the floor-chain order.
    'Coins', 'Amulets', 'Weapons', 'Armor', 'Comestibles', 'Scrolls',
    'Spellbooks', 'Potions', 'Rings', 'Wands', 'Tools', 'Gems/Stones', 'Rocks',
    'Balls', 'Chains', 'Other',
];

function orderedPickupObjects(pile) {
    return pile.map((object, index) => ({ object, index }))
        .sort((a, b) => {
            const classOrder = PICKUP_CLASS_ORDER.indexOf(pickupObjectClass(a.object))
                - PICKUP_CLASS_ORDER.indexOf(pickupObjectClass(b.object));
            if (classOrder) return classOrder;
            const subclassOrder = pickupObjectSubclass(a.object)
                - pickupObjectSubclass(b.object);
            if (subclassOrder) return subclassOrder;
            // NetHack's floor chain has the newly-created trap dart first,
            // but merged projectile stacks are presented before singletons.
            if (a.object.otyp === DART && b.object.otyp === DART)
                return objectQuantity(b.object) - objectQuantity(a.object);
            return a.index - b.index;
        })
        .map(entry => entry.object);
}

function preparePickedInventoryObject(object) {
    const pickedQuantity = objectQuantity(object);
    const previousHowLost = object.how_lost ?? 0;
    // C addinv_core0() clears how_lost before mergable() so a recovered
    // thrown or dropped object can rejoin its carried stack.  Retain the old
    // value only for merged()'s comparison-message suppression.
    object.how_lost = 0;
    object.no_charge = false;
    const existing = (game.inventory || []).find(candidate =>
        mergable(candidate, object, game));
    if (existing && !existing.globby && !object.globby) {
        const existingQuantity = objectQuantity(existing);
        const totalQuantity = existingQuantity + pickedQuantity;
        if (!object.lamplit) {
            existing.age = Math.trunc(
                (((existing.age ?? 0) * existingQuantity)
                    + ((object.age ?? 0) * pickedQuantity)) / totalQuantity,
            );
        }
        existing.quantity = existing.quan = totalQuantity;
        const unitWeight = OBJECT_WEIGHT[existing.otyp];
        existing.owt = Number.isFinite(unitWeight)
            ? unitWeight * totalQuantity
            : (existing.owt ?? 0) + (object.owt ?? 0);

        if (!existing.oextra?.oname && !existing.oname) {
            if (object.oextra?.oname) {
                existing.oextra = {
                    ...(existing.oextra || {}), oname: object.oextra.oname,
                };
            } else if (object.oname) existing.oname = object.oname;
        }

        let comparisonLearned = false;
        if (!!existing.known !== !!object.known) {
            existing.known = true;
            comparisonLearned = true;
        }
        if (!!existing.rknown !== !!object.rknown) {
            existing.rknown = true;
            if (existing.oerodeproof) comparisonLearned = true;
        }
        if (!!existing.bknown !== !!object.bknown) {
            existing.bknown = true;
            if (game.urole?.key !== 'priest') comparisonLearned = true;
        }
        if (object.bypass) existing.bypass = true;
        existing.pickup_prev = true;

        object.where = 'gone';
        object.ox = object.oy = 0;
        const pickedView = {
            ...existing,
            quantity: pickedQuantity,
            quan: pickedQuantity,
        };
        const total = game.flags?.verbose === false
            ? '.' : ` (${totalQuantity} in total).`;
        return {
            object: existing,
            message: `${existing.invlet} - ${
                pickupObjectDescription(pickedView)
            }${total}`,
            comparisonLearned: comparisonLearned
                && previousHowLost !== 4
                && (existing.how_lost ?? 0) !== 4,
        };
    }

    assignInventoryLetter(object);
    object.ox = object.oy = 0;
    object.quantity = objectQuantity(object);
    object.quan = object.quantity;
    if (object.otyp === 453) {
        object.name = 'yellow gem';
        object.class = 'Gems';
    } else if (object.otyp === 462) {
        object.name = 'blue gem';
        object.plural = 'blue gems';
        object.class = 'Gems';
    } else if (object.oclass === 13) {
        // Floor descriptions already include articles and stack counts.
        // Inventory owns a singular/plural presentation instead; retaining
        // "2 white gems" as the noun would later render "2 2 white gemss".
        const presentation = inventoryItem(object);
        Object.assign(object, {
            name: presentation.name,
            plural: presentation.plural,
            class: presentation.class,
        });
    } else if (object.otyp === DART) {
        object.name = 'dart';
        object.plural = 'darts';
        object.class = 'Weapons';
    } else if (object.otyp === SACK) {
        object.name = object.cknown && !object.contents?.length
            ? 'empty bag' : 'bag';
        object.class = 'Tools';
    } else if (object.otyp === OIL_LAMP) {
        object.name = 'lamp';
        object.class = 'Tools';
    } else if (object.oclass === 4 || object.class === 'Rings') {
        object.name = floorObjectDescription(object)
            .replace(/^(?:an?|the)\s+/, '');
        object.class = 'Rings';
    } else if (object.oclass === 5 || object.class === 'Amulets') {
        object.name = floorObjectDescription(object)
            .replace(/^(?:an?|the)\s+/, '');
        object.class = 'Amulets';
    } else if (!object.name) {
        object.name = basePickupObjectDescription(object)
            .replace(/^(?:an?|the)\s+/, '');
    }
    object.where = 'inventory';
    game.inventory.push(object);
    markJustPicked(object);
    attachCursedFigurineTimer(object, game);
    return {
        object,
        message: `${object.invlet} - ${pickupObjectDescription(object)}.`,
        comparisonLearned: false,
    };
}

function removePickupObjects(source, selected) {
    if (source.monster) {
        for (const object of selected) {
            removeObjectFromMonsterInventory(source.monster, object);
            clearMonsterCarriedObjectState(object);
        }
        return;
    }

    const selectedSet = new Set(selected);
    for (let index = source.objects.length - 1; index >= 0; index--) {
        if (selectedSet.has(source.objects[index]))
            source.objects.splice(index, 1);
    }
}

function collectPickupMessages(source, selected) {
    removePickupObjects(source, selected);
    const messages = [];
    const shopQuotes = [];
    const comparisonMessages = [];
    for (const object of selected) {
        if (object.otyp === GOLD_PIECE) {
            const quantity = objectQuantity(object);
            const pickedView = {
                ...object, quan: quantity, quantity,
            };
            const previous = heroGoldAmount(game);
            const carried = addHeroGoldObject(game, object).object;
            const total = previous ? ` (${heroGoldAmount(game)} in total)` : '';
            messages.push(`$ - ${pickupObjectDescription(pickedView)}${total}.`);
            const ghostlyMessage = finishGhostlyPickup(carried, game);
            if (ghostlyMessage) messages.push(ghostlyMessage);
        } else {
            const transaction = source.monster
                ? null : addShopObjectToBill(object);
            if (transaction) {
                const quote = billedPickupQuote(
                    transaction, pickupObjectNoun(object),
                );
                if (quote) shopQuotes.push(quote);
            }
            const prepared = preparePickedInventoryObject(object);
            messages.push(prepared.message);
            const ghostlyMessage = finishGhostlyPickup(prepared.object, game);
            if (ghostlyMessage) messages.push(ghostlyMessage);
            if (prepared.comparisonLearned) {
                comparisonMessages.push(
                    'You learn more about your items by comparing them.',
                );
            }
        }
    }
    return { messages, shopQuotes, comparisonMessages };
}

function observePickupObject(object) {
    const hallucinating = game.u?.hallucinating
        || (game.u?.hallucinationTurns ?? 0) > 0;
    if (heroIsBlind(game) || hallucinating) return;
    object.dknown = true;
    recordObjectEncounter(object.otyp);
}

function splitPickupStack(object, count, objects) {
    if (count >= objectQuantity(object)) return object;
    const split = splitObjectStack(object, count, game);
    if (!split) return object;
    const index = objects.indexOf(object);
    objects.splice(index < 0 ? objects.length : index + 1, 0, split);
    return split;
}

async function reviveTouchedRider(corpse) {
    if (!isRider(corpse.corpsenm)) return false;
    await pline('At your touch, the corpse suddenly moves...');
    const revival = await reviveCorpseImmediately(corpse, game);
    for (const message of revival?.messages || [])
        await plineWithContinuation(message);
    exerciseAttribute(A_WIS, false);
    return true;
}

async function prepareScareScrollPickup(object, requested, source) {
    const count = await carryableObjectCount({ object, count: requested });
    if (count < 1) return { decision: 'stop' };

    const scroll = splitPickupStack(object, count, source.objects);
    if (scroll.blessed) {
        scroll.blessed = false;
        return { decision: 'lift', object: scroll, count };
    }
    if (!(scroll.spe ?? 0) && !scroll.cursed) {
        scroll.spe = 1;
        return { decision: 'lift', object: scroll, count };
    }

    const quantity = objectQuantity(scroll);
    await pline(`The scroll${quantity === 1 ? '' : 's'} ${
        quantity === 1 ? 'turns' : 'turn'} to dust as you pick ${
        quantity === 1 ? 'it' : 'them'} up.`);
    await tryCallObjectType(scroll);
    deleteObject(scroll, game);
    return { decision: 'consumed' };
}

async function liftPickupSelections(source, selected) {
    const lifted = [];
    let consumed = 0;
    let attempted = false;
    for (const selection of selected) {
        let object = selection?.value || selection;
        if (!source.objects.includes(object)) continue;
        attempted = true;
        observePickupObject(object);

        if (object.oartifact) {
            const touch = await touchArtifactByHero(object);
            if (!touch.allowed || touch.died) {
                if (touch.died) break;
                continue;
            }
        }
        if (object.otyp === CORPSE) {
            if (await touchPetrifyingCorpse(object)) break;
            if (await reviveTouchedRider(object)) break;
        }

        let requested = selection?.value
            ? selection.count : objectQuantity(object);
        requested = requested > 0 ? requested : objectQuantity(object);
        if (object.otyp === SCR_SCARE_MONSTER) {
            const prepared = await prepareScareScrollPickup(
                object, requested, source,
            );
            if (prepared.decision === 'stop') break;
            if (prepared.decision === 'consumed') {
                consumed++;
                continue;
            }
            object = prepared.object;
            requested = prepared.count;
        }

        const result = await liftObject({
            object,
            count: requested,
        });
        if (result.decision === 'lift') {
            let liftedObject = object;
            if (result.count < objectQuantity(object)
                && object.otyp !== LOADSTONE) {
                liftedObject = splitObjectStack(object, result.count, game);
            }
            if (liftedObject) lifted.push(liftedObject);
        }
        if (result.decision === 'stop') break;
    }
    return { attempted, consumed, lifted };
}

function pickupObjectNoun(object) {
    return floorObjectDescription(object).replace(/^(?:an?|the)\s+/, '');
}

async function rejectWornPickupObjects(source, selected) {
    if (!source.monster) return selected;
    const allowed = [];
    for (const selection of selected) {
        const object = selection?.value || selection;
        if ((object.owornmask ?? 0) === 0) {
            allowed.push(selection);
            continue;
        }
        await plineWithContinuation(
            `You can't pick the ${pickupObjectNoun(object)} up.`,
        );
    }
    return allowed;
}

async function commitPickup(source, selected) {
    if (!selected.length) {
        await docrt();
        await bot();
        await flush_screen(1);
        game.context.move = 0;
        return 0;
    }

    selected = await rejectWornPickupObjects(source, selected);
    if (!selected.length) {
        game.context.move = 0;
        return 0;
    }

    clearJustPicked(game);
    const pickup = await liftPickupSelections(source, selected);
    if (!pickup.lifted.length) {
        if (pickup.consumed && !source.monster) {
            newsym(source.x, source.y);
            await bot();
        }
        game.context.move = pickup.attempted ? 1 : 0;
        return pickup.consumed;
    }
    const {
        messages, shopQuotes, comparisonMessages,
    } = collectPickupMessages(source, pickup.lifted);
    const capacity = nearCapacity(game);
    const loadPrefix = pickupLoadPrefix(capacity);
    const pickupMessage = loadPrefix
        ? `${loadPrefix} lifting ${messages.join('  ')}`
        : messages.join('  ');
    await docrt();
    await bot();
    if (!source.monster) newsym(source.x, source.y);
    for (const quote of shopQuotes) await plineWithContinuation(quote);
    for (const comparison of comparisonMessages)
        await moreUntilDismissed(`${comparison}--More--`);
    if (comparisonMessages.length) await pline(pickupMessage);
    else await plineWithContinuation(pickupMessage);
    // C pickup() returns ECMD_TIME with the object already linked into the
    // inventory.  moveloop's following encumber_msg() compares persistent
    // capacity state and can itself suspend while replacing this top line.
    game._capacityDirty = true;
    game.context.move = 1;
    return pickup.lifted.length + pickup.consumed;
}

function pickupSourceAtHero() {
    const x = game.u?.ux, y = game.u?.uy;
    const monster = game.u?.uswallow ? game.u?.ustuck : null;
    if (monster) {
        return {
            x, y, monster,
            objects: monster.minvent || monster.inventory || [],
        };
    }
    return {
        x, y, monster: null,
        objects: game.level?.objects?.[x]?.[y] || [],
    };
}

async function pickupAtHero() {
    const commandCount = Math.max(0, game._commandCount || 0);
    game._commandCount = 0;
    const source = pickupSourceAtHero();
    // pickup.c excludes the hero's attached chain from object counts and
    // selection.  It remains linked to the floor pile for ball.c.
    const objects = source.monster ? [...source.objects]
        : source.objects.filter(object => object !== game.uchain
            && object !== game.u?.uchain);
    const locationProblem = pickupLocationProblem({
        state: game, objects, monster: source.monster,
    });
    if (locationProblem) {
        for (const message of locationProblem.messages)
            await plineWithContinuation(message);
        game.context.move = locationProblem.spendsTurn ? 1 : 0;
        return;
    }
    if (!source.monster && heroCannotTake(game)) {
        await pline(
            'You are physically incapable of picking anything up.',
        );
        game.context.move = 0;
        return;
    }
    if (objects.length === 1) {
        if (commandCount > objectQuantity(objects[0])) {
            game.context.move = 0;
            return;
        }
        await commitPickup(source, [{
            value: objects[0],
            count: commandCount || objectQuantity(objects[0]),
        }]);
        return;
    }

    const eligible = commandCount
        ? objects.filter(object => objectQuantity(object) >= commandCount)
        : objects;
    if (!eligible.length) {
        game.context.move = 0;
        return;
    }
    if (commandCount && eligible.length === 1) {
        await commitPickup(source, [{
            value: eligible[0], count: commandCount,
        }]);
        return;
    }
    const ordered = orderedPickupObjects(eligible);
    const sections = [];
    let letterCode = 'a'.charCodeAt(0);
    let goldAcceleratorUsed = false;
    for (const heading of PICKUP_CLASS_ORDER) {
        const objects = ordered.filter(object => pickupObjectClass(object) === heading);
        if (!objects.length) continue;
        sections.push({
            heading,
            items: objects.map(object => {
                const isFirstGold = object.otyp === GOLD_PIECE
                    && !goldAcceleratorUsed;
                if (isFirstGold) goldAcceleratorUsed = true;
                return {
                    key: isFirstGold ? '$' : String.fromCharCode(letterCode++),
                    text: pickupObjectDescription(object),
                    value: object,
                };
            }),
        });
    }
    game._pending_message = '';
    await flush_screen(1);
    const selected = await showMultiSelectWindow({
        title: commandCount
            ? `Pick ${commandCount} of what?` : 'Pick up what?',
        sections,
        left: 41,
        returnCounts: !commandCount,
        pickOne: !!commandCount,
    });
    const counted = commandCount && selected.length
        ? [{ value: selected[0], count: commandCount }] : selected;
    await commitPickup(source, counted);
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
        if (Number.isInteger(armor.enchantment))
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

function captureMapDisplay() {
    const snapshot = [];
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

function restoreMapDisplay(snapshot) {
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
    const firstUse = !game._travelTipShown;
    if (firstUse) {
        const terrainDismissal = await moreUntilDismissed(
            'Showing known terrain only...--More--',
        );
        if (terrainDismissal === 27) {
            restoreMapDisplay(displaySnapshot);
            game._pending_message = '';
            await flush_screen(1);
            game.context.move = 0;
            return;
        }
        game._travelTipShown = true;
        const tipDismissal = await farlookTipUntilDismissed();
        if (tipDismissal === 27) {
            restoreMapDisplay(displaySnapshot);
            game._pending_message = '';
            await flush_screen(1);
            game.context.move = 0;
            return;
        }
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
        const browseChar = String.fromCharCode(browseKey);
        if (browseKey === 27) break;
        if (isMovementKey(browseChar)) {
            moveGetposCursor(
                cursor, DIR_DX[browseChar], DIR_DY[browseChar],
            );
            browseMessage = farlookLocationDescription(cursor.x, cursor.y);
            continue;
        }
        await moreUntilDismissed('Done.--More--');
        break;
    }

    restoreMapDisplay(displaySnapshot);
    game._pending_message = '';
    await flush_screen(1);
    game.context.move = 0;
}

async function kickOuch(x, y) {
    await pline('Ouch!  That hurts!');
    exerciseAttribute(A_DEX, false);
    exerciseAttribute(A_STR, false);
    wakeMonstersNear(x, y, 25);
    if (rn2(3) === 0) {
        const duration = 5 + rnd(5);
        if (!(game.u?._woundedLegTurns > 0)) {
            game.u._woundedLegSide = 'right';
            game.u._woundedLegTurns = duration;
            if (game.u.acurr?.a) game.u.acurr.a[A_DEX]--;
        } else {
            game.u._woundedLegTurns = Math.max(
                game.u._woundedLegTurns, duration,
            );
        }
    }
    let damage = rnd(currentAttribute(A_CON) > 15 ? 3 : 5);
    if (game.u?.halfPhysicalDamage || game.u?.half_physical_damage)
        damage = Math.trunc((damage + 1) / 2);
    const died = await damageHeroFromKick(damage, x, y);
    if (!died && kickCausesRecoil())
        await recoilFromKick(4 + rn2(2));
}

function kickCausesRecoil() {
    return Is_airlevel(game.u?.uz) || game.u?.levitating
        || game.u?.levitation || game.levitating;
}

function kickDeathReason(x, y) {
    const location = game.level?.at?.(x, y);
    if (!location) return 'kicking nothing';
    if (location.typ === DOOR) return 'kicking a door';
    if (IS_STWALL(location.typ)) return 'kicking a wall';
    if (location.typ === TREE) return 'kicking a tree';
    if (location.typ === IRONBARS) return 'kicking an iron bar';
    return 'kicking something weird';
}

async function damageHeroFromKick(amount, x, y) {
    if (heroIsPolymorphed(game)) {
        game.u.mh = (game.u.mh ?? 1) - amount;
        if (game.u.mh > 0) return false;
        if (!(game.u.unchanging || game.unchanging)) {
            const restored = rehumanizeHero(game);
            if (restored.changed) {
                await plineWithContinuation(
                    `You return to ${restored.race} form!`,
                );
            }
            return false;
        }
    } else {
        game.u.uhp = (game.u.uhp ?? 1) - amount;
        if (game.u.uhp > 0) return false;
    }
    return finishHeroDeath({ killer: kickDeathReason(x, y) });
}

async function recoilFromKick(range) {
    return hurtleHero(-game.u.dx, -game.u.dy, range, {
        verbose: true,
        finishTeleport: finishTeleportArrival,
        gotoLevel,
        chooseTeleportDestination: askTeleportDestination,
        finishPetrifiedMonster: monster => finishHeroMonsterKill(
            monster, monster.mx, monster.my, {
                showKillMessage: false,
                noCorpse: true,
                recordConduct: false,
            },
        ),
    });
}

function kickPromptTargetName(monster) {
    if (monster.name) return monster.name;
    const article = monster.mtame > 0 ? 'your' : 'the';
    return `${article} ${monsterInstanceDisplayName(monster)}`;
}

async function confirmKickTarget(monster) {
    const hero = game.u;
    const impaired = hero?.confused || (hero?.confusionTurns ?? 0) > 0
        || hero?.hallucinating || (hero?.hallucinationTurns ?? 0) > 0
        || hero?.stunned || (hero?.stunnedTurns ?? 0) > 0;
    if (game.flags?.confirm === false || !monster.mpeaceful || impaired
        || game.context?.forcefight || !canSpotMonster(monster)) return true;

    const paranoid = !!((game.flags?.paranoia_bits ?? 0) & PARANOID_HIT);
    return paranoidQuery(
        paranoid, `Really attack ${kickPromptTargetName(monster)}?`,
    );
}

// C refs: dokick.c:maybe_kick_monster(), kick_monster(), kickdmg().
// This owns the ordinary humanoid kick path.  Projection affects only the
// target noun: dokick() still targets m_at(x,y) when the actor is invisible.
async function kickLiveMonster(monster, x, y) {
    const helplessBeforeKick = !!(monster.msleeping
        || monster.mcanmove === 0 || (monster.mfrozen ?? 0) > 0);
    const fleeingFromBehind = !!(monster.mflee && !monster.mavenge);
    monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_WAITMASK;
    if (!await confirmKickTarget(monster)) {
        game.context.move = 0;
        return;
    }
    // maybe_kick_monster() temporarily force-fights hostile or unspotted
    // actors, then overexertion() charges combat metabolism.
    getHungry();

    wakeMonstersNear(
        game.u.ux, game.u.uy, (game.u?.ulevel ?? 1) * 20,
    );
    wipeEngravingAt(game.u.ux, game.u.uy, 2, false);
    await angerAttackedMonster(monster);

    if (levitatingKickMisses(monster)) {
        await pline('Floating in the air, you miss wildly!');
        passiveContact(monster, false);
        game.context.move = 1;
        return;
    }

    if (monster.mundetected
        || (monster.m_ap_type && monster.m_ap_type !== M_AP_MONSTER)) {
        monster.mundetected = 0;
        monster.m_ap_type = 0;
        monster.mappearance = 0;
        if (canSpotMonster(monster, x, y)) {
            newsym(x, y);
            const name = monsterInstanceDisplayName(monster);
            await plineWithContinuation(
                `There is ${indefiniteArticle(name)} ${name} here.`,
            );
        } else {
            map_invisible(x, y);
            await plineWithContinuation('There is something hidden here.');
        }
    }

    const target = canProjectMonster(monster, x, y)
        ? monsterInstanceDisplayName(monster) : 'it';
    const martial = ['monk', 'samurai'].includes(game.urole?.key)
        || game.uarmf?.otyp === KICKING_BOOTS;
    const kick = await prepareKick({
        martial,
        announce: pline,
    });
    if (kick.stopped) {
        passiveContact(monster, false);
        game.context.move = 1;
        return;
    }

    await plineWithContinuation(`You kick ${target}.`);
    const evaded = await tryKickEvasion(monster, {
        clumsy: kick.clumsy,
        martial,
        announce: plineWithContinuation,
        nameMonster: actor => canProjectMonster(actor, actor.mx, actor.my)
            ? `The ${monsterInstanceDisplayName(actor)}` : 'It',
    });
    if (evaded) {
        passiveContact(monster, true);
        if (monster.mx === x && monster.my === y
            && !canProjectMonster(monster, x, y)) map_invisible(x, y);
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
    await abuseKickedPet(monster, preparedDamage.potentialDamage, {
        yelp: publishKickedPetYelp,
        growl: publishMonsterGrowl,
    });
    const damage = rollKickDamage(preparedDamage, { martial });
    if (damage.damage > 0)
        monster.mhp = Math.max(0, (monster.mhp ?? 1) - damage.damage);

    const reel = await tryKickReel(
        monster,
        x - (game.u?.ux ?? x),
        y - (game.u?.uy ?? y),
        {
            martial,
            announce: plineWithContinuation,
            nameMonster: actor => canProjectMonster(
                actor, actor.mx, actor.my,
            ) ? `The ${monsterInstanceDisplayName(actor)}` : 'It',
        },
    );

    passiveContact(monster, (monster.mhp ?? 1) > 0);
    if ((monster.mhp ?? 1) <= 0) {
        await finishHeroMonsterKill(monster, monster.mx, monster.my, {
            showKillMessage: !reel?.dead,
            hallucinating: !!(game.u?.hallucinating
                || (game.u?.hallucinationTurns ?? 0) > 0),
            nameMonster: () => monsterInstanceDisplayName(monster),
            weaponHit: false,
        });
    } else if (monster.mx === x && monster.my === y
        && !canProjectMonster(monster, x, y)) {
        map_invisible(x, y);
    }
    if (damage.trainSkill) recordWeaponPractice(game, 35, 1);
    game.context.move = 1;
}

async function dokick() {
    if ((game.u?._woundedLegTurns ?? 0) > 0) {
        const side = game.u._woundedLegSide;
        const leg = side === 'both' ? 'legs are' : `${side || 'right'} leg is`;
        await moreUntilDismissed(
            `Your ${leg} in no shape for kicking.--More--`,
        );
        game._pending_message = '';
        game._retained_message = '';
        game.context.move = 0;
        return;
    }
    const key = await promptKey('In what direction? ');
    const direction = String.fromCharCode(key).toLowerCase();
    if (!isMovementKey(direction)) {
        game._pending_message = '';
        game.context.move = 0;
        return;
    }
    game._pending_message = '';
    game.u.dx = DIR_DX[direction];
    game.u.dy = DIR_DY[direction];
    const x = game.u.ux + game.u.dx;
    const y = game.u.uy + game.u.dy;
    // C dokick() records gk.kickedloc for every valid directed kick before
    // dispatching the target.  Peaceful monsters and pets consult it during
    // this same elapsed turn so they do not step into the square just kicked.
    game._kickedLoc = { x, y };
    const monster = game.level?.monsters?.find(candidate =>
        !candidate.dead && (candidate.mhp ?? 1) > 0
        && candidate.mx === x && candidate.my === y);
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
    }
    if (!location || IS_STWALL(location.typ)) {
        await kickOuch(x, y);
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
        exerciseAttribute(A_DEX, true);
        const attributes = game.u?.acurr?.a || [10, 10, 10];
        const strength = currentAttribute(A_STR);
        const average = Math.trunc(
            (strength + (attributes[A_DEX] ?? 10)
                + (attributes[A_CON] ?? 10)) / 3,
        );
        if (rnl(35) < average) {
            // in_rooms(..., SHOPBASE) includes a shop immediately across a
            // boundary door.  Such doors never take the high-strength
            // shatter branch, though the ordinary crash still succeeds.
            const touchesShop = [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]
                .some(([dx, dy]) => {
                    const roomno = game.level?.at(x + dx, y + dy)?.roomno ?? 0;
                    return roomno >= ROOMOFFSET
                        && (roomForRoomno(game.level, roomno)?.rtype
                            ?? 0) >= SHOPBASE;
                });
            const shatters = strength > 18 && rn2(5) === 0 && !touchesShop;
            location.doormask = shatters ? D_NODOOR : D_BROKEN;
            await pline(shatters
                ? 'As you kick the door, it shatters to pieces!'
                : 'As you kick the door, it crashes open!');
            exerciseAttribute(A_STR, true);
            vision_reset();
            vision_recalc(0);
            newsym(x, y);
        } else {
            exerciseAttribute(A_STR, true);
            await pline(rn2(3) === 0 ? 'Thwack!!' : 'Whammm!!');
        }
        game.context.move = 1;
        return;
    }
    // dokick.c:kick_dumb() always abuses Dexterity before deciding whether
    // an unremarkable floor kick is merely empty or strains a muscle.
    exerciseAttribute(A_DEX, false);
    const martial = ['monk', 'samurai'].includes(game.urole?.key)
        || game.uarmf?.otyp === KICKING_BOOTS;
    if (martial || currentAttribute(A_DEX) >= 16 || rn2(3) !== 0) {
        await pline('You kick at empty space.');
    } else {
        await pline('Dumb move!  You strain a muscle.');
        exerciseAttribute(A_STR, false);
        game.u._woundedLegSide = 'right';
        game.u._woundedLegTurns = Math.max(
            game.u._woundedLegTurns ?? 0, 5 + rnd(5),
        );
    }
    if (kickCausesRecoil() && rn2(2) !== 0)
        await recoilFromKick(1);
    game.context.move = 1;
}

function putCommandLine(col, row, message, attr = 0) {
    const display = game.nhDisplay;
    for (let index = 0; index < message.length && col + index < display.cols; index++)
        display.setCell(col + index, row, message[index], NO_COLOR, attr);
}

async function restoreCommandMap() {
    game.nhDisplay?.clearScreen();
    await docrt();
    await bot();
    await flush_screen(1);
}

function setCurrentLevelAnnotation(value) {
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
    const entries = [];
    let accelerator = 97;
    const add = text => {
        entries.push(`${String.fromCharCode(accelerator++)} - ${text}`);
    };

    if (floorObject) {
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
        left: 41,
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
    const display = game.nhDisplay;
    const left = 32;
    game._pending_message = '';
    display.clearRow(0);
    for (let row = 0; row <= 8; row++) {
        for (let col = left - 1; col < display.cols; col++)
            display.setCell(col, row, ' ', NO_COLOR, 0);
    }
    putCommandLine(left, 0, 'What do you want to name?', ATR_INVERSE);
    putCommandLine(left, 2, 'm - a monster');
    putCommandLine(left, 3, 'i - a particular object in inventory');
    putCommandLine(left, 4, 'o - the type of an object in inventory');
    putCommandLine(left, 5, 'f - the type of an object upon the floor');
    putCommandLine(left, 6, 'd - the type of an object on discoveries list');
    putCommandLine(left, 7, 'a - record an annotation for the current level');
    putCommandLine(left, 8, '(end)');
    display.setCursor(left + 6, 8);
    const choice = String.fromCharCode(await nhgetch()).toLowerCase();
    game._pending_message = '';
    await restoreCommandMap();

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
            .filter(object => object.invlet)
            .sort((a, b) => a.invlet.localeCompare(b.invlet));
        // C do_name.c:name_ok() marks unseen, artifact and novel objects as
        // GETOBJ_DOWNPLAY.  getobj() omits those letters from the suggested
        // prompt while still accepting a directly typed inventory letter.
        const suggested = inventory.filter(object =>
            object.dknown !== false
                && !object.oartifact
                && object.otyp !== NOVEL);
        const letters = compactInventoryLetters(
            suggested.map(object => object.invlet).join(''),
        );
        const selection = await promptInventoryObject(
            `What do you want to name? [${letters} or ?*] `,
            inventory,
            { allowMenu: true },
        );
        if (!selection.cancelled) {
            const object = selection.object;
            game._pending_message = '';
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
            .filter(object => object.invlet)
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
        if (!selection.cancelled) {
            const object = selection.object;
            game._pending_message = '';
            if (object.dknown === false) {
                await pline('You would never recognize another one.');
            } else {
                const perceivedName = objectTypeKnown(object)
                    ? OBJECT_NAMES[object.otyp] || object.name || 'thing'
                    : objectTypeCallNoun(object);
                const value = await getLine(
                    `Call ${indefiniteArticle(perceivedName)} ${perceivedName}:`,
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

// C refs: cmd.c:getdir(), help_dir(), and show_direction_keys().  Direction
// acquisition is shared by commands such as fire, loot, apply, and force;
// keep the tty help page independent from any one caller.
function directionAssistPage() {
    const lines = Array(24).fill('');
    lines[0] = 'cmdassist: Invalid direction key!';
    lines[2] = 'Valid direction keys are:';
    lines[3] = '          y  k  u';
    lines[4] = '           \\ | /';
    lines[5] = '          h- . -l';
    lines[6] = '           / | \\';
    lines[7] = '          b  j  n';
    lines[9] = '          <  up';
    lines[10] = '          >  down';
    lines[11] = '          .  direct at yourself';
    lines[13] = '(Suppress this message with !cmdassist in config file.)';
    lines[23] = '--More--';
    return { lines, cursor: [8, 23] };
}

function monsterBeside(x, y) {
    // C pickup.c:mon_beside() deliberately includes the hero's own square so
    // a steed can make directional looting available too.
    return (game.level?.monsters || []).some(monster =>
        (monster.mhp ?? 1) > 0
        && Math.abs(monster.mx - x) <= 1
        && Math.abs(monster.my - y) <= 1);
}

async function getAdjacentLocation(prompt, errorMessage, x, y) {
    // C cmd.c:get_adjacent_loc() delegates input and command assistance to
    // getdir(), then turns its relative result into a checked map location.
    const key = await promptKey(`${prompt} `);
    const ch = String.fromCharCode(key).toLowerCase();
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

    game._pending_message = '';
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
    if (game.u.twoweap) {
        game.u.twoweap = false;
        await pline('You switch to your primary weapon.');
        game.context.move = 0;
        return;
    }

    // wield.c:can_twoweapon() rejects armor conflicts before changing state
    // or making the Dexterity timing draw.
    if (game.uarms || game.u?.uarms) {
        await pline("You can't use two weapons while wearing a shield.");
        game.context.move = 0;
        return;
    }

    game.u.twoweap = true;
    await pline('You begin two-weapon combat.');
    // wield.c: a clumsy toggle only takes time when rnd(20) exceeds Dex.
    game.context.move = rnd(20) > (game.u?.acurr?.a?.[A_DEX] || 0) ? 1 : 0;
}

// C ref: wield.c:doswapweapon()/ready_weapon().  Clearing the old secondary
// slot through setworn() also ends two-weapon mode before either new
// inventory description is projected.
async function doswapweapon() {
    const oldPrimary = game.uwep || game.u?.uwep || null;
    const oldSecondary = game.uswapwep || game.u?.uswapwep || null;
    if (!oldSecondary) {
        game.u.twoweap = false;
        if (!oldPrimary) {
            await pline('You are already bare handed.');
            game.context.move = 0;
            return;
        }
        oldPrimary.wielded = false;
        oldPrimary.alternate = true;
        game.uwep = null;
        if (game.u) game.u.uwep = null;
        game.uswapwep = oldPrimary;
        if (game.u) game.u.uswapwep = oldPrimary;
        await pline('You are bare handed.');
        await plineWithContinuation(
            `${oldPrimary.invlet} - ${
                inventoryItemDescription(oldPrimary)}.`,
        );
        game.context.move = 1;
        return;
    }

    game.u.twoweap = false;
    game.uswapwep = null;
    if (game.u) game.u.uswapwep = null;

    oldSecondary.alternate = false;
    oldSecondary.wielded = true;
    game.uwep = oldSecondary;
    if (game.u) game.u.uwep = oldSecondary;
    await pline(
        `${oldSecondary.invlet} - ${
            inventoryItemDescription(oldSecondary)}.`,
    );

    game.uswapwep = oldPrimary;
    if (game.u) game.u.uswapwep = oldPrimary;
    if (oldPrimary) {
        oldPrimary.wielded = false;
        oldPrimary.alternate = true;
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
    const key = await promptKey('Talk to whom? (in what direction) ');
    // cmd.c:getdir() clears WIN_MESSAGE after accepting the direction.  The
    // physical prompt belongs to the captured input boundary but must not
    // force a pager when the selected monster immediately opens quest text.
    game._pending_message = '';
    game._retained_message = '';
    const direction = String.fromCharCode(key).toLowerCase();
    if (direction === '.') {
        await pline('Talking to yourself is a bad habit for a dungeoneer.');
        game.context.move = 0;
        return;
    }
    if (isMovementKey(direction)) {
        const x = game.u.ux + DIR_DX[direction];
        const y = game.u.uy + DIR_DY[direction];
        const monster = game.level?.monsters?.find(mon => mon.mx === x && mon.my === y);
        // sounds.c:dochat() prods any responsive target into action before
        // domonnoise()/quest_chat().  This clears both CLOSE and WAITFORU, so
        // the quest leader can take its ordinary scheduler turn immediately
        // after assigning the quest.
        if (monster) monster.mstrategy &= ~STRAT_WAITMASK;
        if (monster && await chatWithQuestLeader(monster, {
            exerciseWisdom: () => exerciseAttribute(A_WIS, true),
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
        } else if (monster && !(game.deaf || game.u?.deaf)
            && [1, 2, 12].includes(MONSTER_SOUND[monster.mnum] ?? 0)) {
            const sound = MONSTER_SOUND[monster.mnum];
            const hungryTime = monster.edog?.hungrytime ?? 0;
            const moves = game.moves ?? 1;
            let noise = null;
            if (sound === 1) { // MS_BARK
                if (game.flags?.moonphase === 4
                    && sessionIsNight(game.datetime)) noise = 'howls.';
                else if (!monster.mpeaceful) noise = 'growls.';
                else if (monster.mtame && (monster.mconf || monster.mflee
                    || monster.mtrapped || moves > hungryTime
                    || monster.mtame < 5)) noise = 'whines.';
                else if (monster.mtame && hungryTime > moves + 1000)
                    noise = 'yips.';
                else if (MONSTER_NAME[monster.mnum] !== 'dingo')
                    noise = 'barks.';
            } else if (sound === 2) { // MS_MEW
                if (monster.mtame && (monster.mconf || monster.mflee
                    || monster.mtrapped || monster.mtame < 5)) noise = 'yowls.';
                else if (monster.mtame && moves > hungryTime) noise = 'meows.';
                else if (monster.mtame && hungryTime > moves + 1000)
                    noise = 'purrs.';
                else noise = monster.mtame ? 'mews.'
                    : monster.mpeaceful ? 'snarls.' : 'growls!';
            } else if (sound === 12) { // MS_NEIGH
                noise = monster.mtame < 5 ? 'neighs.'
                    : moves > hungryTime ? 'whinnies.' : 'whickers.';
            }
            if (noise) {
                const subject = monster.name
                    ? monster.name.charAt(0).toUpperCase()
                        + monster.name.slice(1)
                    : `The ${monsterInstanceDisplayName(monster)}`;
                await pline(`${subject} ${noise}`);
            }
            game.context.move = 1;
            return;
        } else if (monster?.name) await pline(`${monster.name} does not seem to notice you.`);
        else if (!monster) {
            const statue = (game.level?.objects?.[x]?.[y] || [])
                .find(object => object.otyp === STATUE);
            const loc = game.level?.at(x, y);
            const deaf = !!(game.deaf || game.u?.deaf);
            const hallucinating = heroHallucinating();
            if (statue && !game.blind) {
                await pline('The statue seems not to notice you.');
            } else if (!deaf && (IS_WALL(loc?.typ) || loc?.typ === SDOOR)
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

function indefiniteArticle(text) {
    return /^[aeiou]/i.test(text) ? 'an' : 'a';
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

// C wizcmds.c:wiz_polyself() forces the controlled selector even without a
// polymorph-control property.  The wizard command is zero-time; getlin owns
// all physical name bytes and the form transaction owns any --More-- keys.
async function wizPolyself() {
    const value = await getLine(
        'Become what kind of monster? [type the name]',
        (_ch, key) => key >= 32 && key < 127,
    );
    if (value === null) {
        await pline('Never mind.');
        game.context.move = 0;
        return;
    }
    const mnum = nameToMonster(value);
    if (mnum < 0) {
        await pline("I've never heard of such monsters.");
        game.context.move = 0;
        return;
    }
    // PM_HUMAN is a placeholder and deliberately fails polyok().  The C
    // selector uses that failure to enter newman(), not polymon(PM_HUMAN).
    if (mnum === 260) await polyselfControlledNewman();
    else await polyselfControlledMonster(mnum);
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

    // read.c:create_particular_parse() removes state modifiers and normalizes
    // spaces before looking up the monster.
    const sleepingPattern = /(^|\s)sleeping\s+/iu;
    const sleeping = sleepingPattern.test(value);
    const stateStrippedName = sleeping
        ? value.replace(sleepingPattern, '$1')
        : value;
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
    if (WIZGENESIS_SUBSTITUTIONS.has(mnum)) {
        const requestedName = MONSTER_NAME[mnum];
        const substituteName = WIZGENESIS_SUBSTITUTIONS.get(mnum);
        const force = await promptYesNo(
            `Creating ${substituteName} instead; force ${requestedName}? [yn] (n) `,
        );
        if (force !== 'y') mnum = nameToMonster(substituteName);
    }

    const monster = await makemonNear(
        mnum, game.u.ux, game.u.uy, MM_NOEXCLAM,
    );
    if (monster) {
        // create_particular_creation() applies disposition before its later
        // requested state flags.  Deleting a constructor-provided malign lets
        // the shared death-alignment fallback derive it from forced peace.
        if (tame) {
            tameMonster(monster);
        } else if (peaceful) {
            monster.mtame = 0;
            monster.pet = false;
            monster.mpeaceful = 1;
            delete monster.malign;
        } else if (hostile) {
            monster.mtame = 0;
            monster.pet = false;
            monster.mpeaceful = 0;
            delete monster.malign;
        }
        // create_particular_creation() applies requested sleep after makemon
        // announces the actor.
        if (sleeping) monster.msleeping = 1;
        newsym(monster.mx, monster.my);
        const hallucinating = heroHallucinating();
        if (hallucinating) {
            snapshotMonsterCreationWearNames(
                monster, () => randomDisplayMonsterName(),
            );
        }
        newsym(monster.mx, monster.my);
        if (canSpotMonster(monster)) {
            const clericInstance = monster.ispriest || monster.isminion
                ? visiblePriestName(monster) : null;
            const name = MONSTER_NAME[mnum];
            const subject = clericInstance
                || (mnum === 285
                    ? (hallucinating
                        ? randomDisplayMonsterSubject(true) : `The ${name}`)
                    : null)
                || `${indefiniteArticle(name)} ${name}`;
            await pline(
                `${subject[0].toUpperCase()}${subject.slice(1)} appears next to you.`,
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

    const firstUse = !game._travelTipShown;
    if (firstUse) {
        await moreUntilDismissed('Pick first monster to slay:--More--');
        game._travelTipShown = true;
        await farlookTipUntilDismissed();
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
    const monster = game.level.monsters.find(candidate =>
        candidate.mx === cursor.x && candidate.my === cursor.y
        && !candidate.dead && (candidate.mhp ?? 1) > 0);
    if (!monster) {
        await pline('There is no monster there.');
        game.context.move = 0;
        return;
    }

    monster.mhp = 0;
    const killed = await finishHeroMonsterKill(
        monster, monster.mx, monster.my, {
            showKillMessage: true,
            weaponHit: false,
        },
    );
    if (!killed)
        game._cursorOverride = [monster.mx - 1, monster.my + 1];
    game.context.move = 0;
}

function menuLetter(index) {
    return index < 26
        ? String.fromCharCode('a'.charCodeAt(0) + index)
        : String.fromCharCode('A'.charCodeAt(0) + index - 26);
}

function specialDisplayName(name) {
    if (name.startsWith('x-')) {
        const code = game.urole?.filecode || 'Wiz';
        return `${code}-${name.slice(2)}`;
    }
    return name;
}

function specialPrototypeAt(dnum, dlevel) {
    for (const [name, level] of game.specialLevels || []) {
        if (level.dnum === dnum && level.dlevel === dlevel)
            return specialDisplayName(name);
    }

    // C mklev.c:makelevel() sends otherwise ordinary Quest depths through
    // the selected role's room-form filler.  The locate level is the split:
    // shallower homes use <role>-fila, deeper homes use <role>-filb.  Named
    // start/locate/goal levels won above and retain their own prototypes.
    if (game.dungeons?.[dnum]?.dname === 'The Quest') {
        const code = game.urole?.filecode;
        const locate = Array.from(game.specialLevels || [])
            .find(([name, level]) => level.dnum === dnum
                && specialDisplayName(name) === `${code}-loca`);
        if (code && locate)
            return `${code}-fil${dlevel < locate[1].dlevel ? 'a' : 'b'}`;
    }
    return null;
}

function numericLevelTeleportDestination(requested) {
    const current = game.u?.uz || { dnum: 0, dlevel: 1 };
    const dungeon = game.dungeons?.[current.dnum];
    // teleport.c:level_tele(): negative input while already in the endgame
    // addresses the six Elemental Plane slots relative to their bottom.
    // For example, -2 becomes 6 + -2 == Plane of Air.
    if (In_endgame(current) && requested < 0) {
        const levels = dungeon?.num_dunlevs ?? 1;
        if (requested <= -levels) return null;
        return { dnum: current.dnum, dlevel: levels + requested };
    }
    // teleport.c:level_tele() treats positive input inside Quest as the
    // `Home N` dialect shown on the status line, then get_level() clips it to
    // the current branch.  Other dungeon-depth translation remains a
    // separate general block; this branch prevents an impossible Home 13.
    if (dungeon?.dname === 'The Quest') {
        return {
            dnum: current.dnum,
            dlevel: Math.max(1, Math.min(dungeon.num_dunlevs, requested)),
        };
    }

    // teleport.c:level_tele() has one deliberate exception to get_level()'s
    // "downward travel stays in the current dungeon" rule.  A request below
    // the Dungeons of Doom crosses the Castle connection and lands at the
    // Valley, the Gehennom entrance.
    const bottomDepth = (dungeon?.depth_start ?? 1)
        + (dungeon?.num_dunlevs ?? 1) - 1;
    if (current.dnum === game.medusa_level?.dnum
        && requested > bottomDepth && game.valley_level) {
        return { ...game.valley_level };
    }

    // dungeon.c:get_level(): translate the player-facing absolute depth into
    // the current dungeon, or trace upward through parent branches when the
    // requested depth precedes this branch's depth_start.
    let dnum = current.dnum;
    let targetDungeon = dungeon;
    if (requested > bottomDepth) {
        return {
            dnum,
            dlevel: targetDungeon?.num_dunlevs ?? current.dlevel,
        };
    }
    while (targetDungeon && requested < (targetDungeon.depth_start ?? 1)) {
        const parent = game.branches?.find(branch =>
            branch.end2?.dnum === dnum);
        if (!parent) break;
        dnum = parent.end1.dnum;
        targetDungeon = game.dungeons?.[dnum];
    }
    return {
        dnum,
        dlevel: requested - (targetDungeon?.depth_start ?? 1) + 1,
    };
}

function dungeonHeading(dnum) {
    const dungeon = game.dungeons[dnum];
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

function branchKind(branch) {
    if (branch.type) return branch.type;
    if (branch.portal) return 'portal';
    const child = game.dungeons?.[branch.end2.dnum];
    if (child?.dname === 'Gehennom') return 'no_end1';
    if (child?.dname === 'The Elemental Planes') return 'no_end2';
    return 'stair';
}

function branchMenuLabel(branch) {
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

function dungeonLayoutEvents(dnum) {
    const events = [];
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
function specialLevelReachable(event) {
    if (event.name === 'dummy') return false;
    if (event.name !== 'knox') return true;
    const incoming = (game.branches || []).find(branch =>
        branch.end2?.dnum === event.dnum
        && branch.end2?.dlevel === event.dlevel);
    const sourceDnum = incoming?.end1?.dnum;
    return Number.isInteger(sourceDnum)
        && sourceDnum >= 0
        && sourceDnum < (game.dungeons?.length || 0);
}

// C ref: teleport.c level_tele().  Wizard-menu entry into the Elemental
// Planes grants the real Amulet before deferred_goto() starts.  Object
// construction and inventory identity therefore precede getbones()/mklev(),
// while tty does not expose prinv() until the destination transaction yields
// at its pre-arrival acknowledgement.
function endgamePrerequisite(destination) {
    if (!In_endgame(destination) || In_endgame(game.u?.uz)
        || game.u?.uhave?.amulet) return '';
    const amulet = addInventoryItem(
        mksobj(AMULET_OF_YENDOR, true, false),
    );
    // teleport.c prints the grant with prinv(); its doname()->xname() path
    // observes the visible object and appends it to the Amulet disco[] class
    // before the destination transaction begins.
    recordObjectEncounter(amulet.otyp);
    if (!game.u.uhave) game.u.uhave = {};
    game.u.uhave.amulet = 1;
    return `Endgame prerequisite: ${
        amulet.invlet
    } - the Amulet of Yendor.--More--`;
}

// C ref: dungeon.c print_dungeon(TRUE). Build one source-ordered menu stream;
// the tty layer alone owns pagination and nested input capture.
function wizardLevelMenu() {
    const rows = [
        { text: 'Level teleport to where:', attr: ATR_INVERSE },
        '',
    ];
    const choices = new Map();
    let choiceIndex = 0;

    for (let dnum = 0; dnum < (game.dungeons?.length || 0); dnum++) {
        rows.push({ text: dungeonHeading(dnum), attr: ATR_INVERSE });

        for (const event of dungeonLayoutEvents(dnum)) {
            const key = menuLetter(choiceIndex++);
            const current = game.u?.uz?.dnum === event.dnum
                && game.u?.uz?.dlevel === event.dlevel;
            let label;
            let destination;
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

    const pages = [];
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

// C refs: wizcmds.c wiz_level_tele(), teleport.c level_tele(), and
// do.c schedule_goto()/deferred_goto().  The C command schedules the level
// change for the end of the current command loop; completing it here after the
// line editor preserves the same no-input interval and the same next capture.
async function wizLevelTeleport({ menuRequested = false } = {}) {
    const value = menuRequested ? '?' : await getLine(
        'To what level do you want to teleport?',
        ch => /^[0-9+?-]$/.test(ch),
    );
    if (value === '?') {
        const { rows, choices } = wizardLevelMenu();
        const destination = await showPagedPickOneMenu({ rows, choices });
        if (!destination) {
            game.context.move = 0;
            return;
        }
        // Destroying tty's level-choice menu restores the source map through
        // docrt() before deferred_goto() changes levels.  Hallucinated glyphs
        // make that otherwise cosmetic old-level redraw RNG-observable.
        await docrtRecalc();
        const preArrivalPager = endgamePrerequisite(destination);
        game._specialLevelPrototype = destination.prototype || null;
        await gotoLevel(
            { dnum: destination.dnum, dlevel: destination.dlevel },
            {
                arrival: 'random',
                preArrivalPager,
                postMessage: game.flags?.verbose
                    ? 'You materialize on a different level!' : '',
            },
        );
        return;
    }
    if (value === null || !/^[+-]?\d+$/.test(value)
        || Number(value) === 0
        || (Number(value) < 0 && !In_endgame(game.u?.uz))) {
        await pline('Never mind.');
        game.context.move = 0;
        return;
    }

    const numeric = Number(value);
    const target = numeric < 0
        ? numeric : Math.max(1, Math.min(99, numeric));
    const destination = numericLevelTeleportDestination(target);
    if (!destination) {
        await pline("You can't get there from here.");
        game.context.move = 0;
        return;
    }
    const dnum = destination.dnum ?? game.u?.uz?.dnum ?? 0;
    game._specialLevelPrototype = specialPrototypeAt(
        dnum, destination.dlevel,
    );
    await gotoLevel(
        destination,
        {
            arrival: 'random',
            postMessage: game.flags?.verbose
                ? 'You materialize on a different level!' : '',
        },
    );
}

async function wizLevelChange() {
    const value = await getLine('To what experience level do you want to be set?');
    if (value === null || !/^[+-]?\d+$/.test(value)) {
        await pline('Never mind.');
        game.context.move = 0;
        return;
    }
    const target = Math.max(1, Math.min(30, Number(value)));
    // The committed getlin buffer is no longer a pending topline message.
    // pluslvl() begins a fresh message stream with You_feel().
    game._pending_message = '';
    game._retained_message = '';
    while (game.u.ulevel < target) {
        // exper.c pluslvl(FALSE): the experience message precedes HP/Pw RNG;
        // the welcome and adjabil message follow the level increment.  The
        // tty continuation owner decides when a third message needs More.
        await plineWithContinuation('You feel more experienced.');
        const oldLevel = game.u.ulevel;
        gainExperienceLevel();
        const level = game.u.ulevel;
        await plineWithContinuation(`Welcome to experience level ${level}.`);
        await gainLevelAbilities(oldLevel, level);
    }
    game.u.ulevelmax = game.u.ulevel;
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
        const targetMonster = game.level?.monsters?.find(monster =>
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
        const toolName = lockToolPresentation(tool);
        const answer = await promptKey(
            `Unlock it with your ${toolName}? [ynq] (q) `,
        );
        if (String.fromCharCode(answer).toLowerCase() === 'y') {
            game._occupation = {
                key: 'pick-lock',
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
    game.context.move = result.spentTime ? 1 : 0;
}

// C refs: pickup.c:dotip(), safe_qbuf(), and ynq().  Floor containers are
// considered before carried objects.  Keep this prompt transaction separate
// from tipcontainer(), whose spill mechanics own the timed yes branch.
async function dotip() {
    const x = game.u?.ux, y = game.u?.uy;
    const pile = game.level?.objects?.[x]?.[y] || [];
    const containers = pile.filter(isContainer);

    if (containers.length === 1 && !heroHasNoLimbs(game)
        && !exceedsActionCapacity(game)) {
        const container = containers[0];
        const prompt = `There is ${floorObjectDescription(container)} here, `
            + 'tip it? [ynq] (q) ';
        const answer = await promptYnq(prompt);
        if (answer === 'q') {
            // tty leaves the resolved query physically painted until the
            // following command read, but it is no longer continuation-owned.
            game._retained_message = prompt;
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


function completeExtendedCommand(command) {
    // cast/chat/conduct share `c`; once `co` is typed, conduct is the sole
    // AUTOCOMPLETE entry and tty paints the remainder without moving the
    // insertion point past the physical prefix.
    if (command.length >= 2 && 'conduct'.startsWith(command))
        return 'conduct';
    if ('enhance'.startsWith(command)) return 'enhance';
    if ('genocided'.startsWith(command)) return 'genocided';
    if (command.length >= 2 && 'vanquished'.startsWith(command))
        return 'vanquished';
    // In normal play, pray is the only AUTOCOMPLETE command beginning with
    // "p".  Wizard mode also exposes panic and polyself, so tty leaves a
    // single "p" literal and completes pray only once "pr" is unique.
    if ('pray'.startsWith(command)
        && (!game.flags?.debug || command.length >= 2)) return 'pray';
    if (game.flags?.debug && command.length >= 2
        && 'polyself'.startsWith(command)) return 'polyself';
    if ('name'.startsWith(command)) return 'name';
    if ('invoke'.startsWith(command)) return 'invoke';
    if ('force'.startsWith(command)) return 'force';
    if ('jump'.startsWith(command)) return 'jump';
    // quaff and quiver are ordinary commands, not AUTOCOMPLETE entries;
    // tty's filtered match set therefore makes #q uniquely identify quit.
    if ('quit'.startsWith(command)) return 'quit';
    // C cmd.c:extcmdlist[] filters completion through both AUTOCOMPLETE and
    // WIZMODECMD.  In ordinary play "l" uniquely selects loot.  Wizard mode
    // also admits levelchange and lightsources, so the same prefix must stay
    // literal until another byte makes the match unique.
    if (command === 'l' && !game.flags?.debug) return 'loot';
    if (command.length >= 2 && 'loot'.startsWith(command)) return 'loot';
    if (command.length >= 2 && 'levelchange'.startsWith(command))
        return 'levelchange';
    if (command.length >= 2 && 'herecmdmenu'.startsWith(command))
        return 'herecmdmenu';
    // wizwish is deliberately not AUTOCOMPLETE, while wizwhere is.  This is
    // why typing "wizw" temporarily displays wizwhere yet remains editable
    // into the distinct wizwish command.
    if (game.flags?.debug && command.length >= 4
        && 'wizwhere'.startsWith(command)) return 'wizwhere';
    // wizmakemap and wizmap are non-autocomplete entries.  Once "wizm" is
    // typed, wizmondiff is the sole matching AUTOCOMPLETE command; NEWAUTOCOMP
    // paints that suffix without committing it to the editable buffer.
    if (game.flags?.debug && command.length >= 4
        && 'wizmondiff'.startsWith(command)) return 'wizmondiff';
    if (game.flags?.debug && command.length >= 4
        && 'wizkill'.startsWith(command)) return 'wizkill';
    if (game.flags?.debug && command.length >= 4
        && 'wizintrinsic'.startsWith(command)) return 'wizintrinsic';
    if (command.length >= 2 && 'ride'.startsWith(command)) return 'ride';
    if (command.length >= 2 && 'rub'.startsWith(command)) return 'rub';
    if (command.length >= 3 && 'chat'.startsWith(command)) return 'chat';
    if (command.length >= 3 && 'chronicle'.startsWith(command))
        return 'chronicle';
    // In wizard mode, version and vision share `v`; the second physical byte
    // makes `ve` the unique AUTOCOMPLETE entry.
    if (command.length >= 2 && 'version'.startsWith(command))
        return 'version';
    if (command.length >= 2 && 'overview'.startsWith(command))
        return 'overview';
    // offer and overview share their first byte; "of" uniquely selects the
    // AUTOCOMPLETE #offer entry.
    if (command.length >= 2 && 'offer'.startsWith(command)) return 'offer';
    if ('dip'.startsWith(command)) return 'dip';
    if (command.length >= 2 && 'monster'.startsWith(command))
        return 'monster';
    // `a` is shared by the AUTOCOMPLETE commands adjust and annotate.
    if (command.length >= 2 && 'annotate'.startsWith(command))
        return 'annotate';
    if (command.length >= 2 && 'adjust'.startsWith(command))
        return 'adjust';
    // `t` still matches several AUTOCOMPLETE commands (terrain,
    // therecmdmenu, timeout, tip, turn); `tu` uniquely identifies turn.
    if (command.length >= 2 && 'terrain'.startsWith(command))
        return 'terrain';
    if (command.length >= 2 && 'turn'.startsWith(command)) return 'turn';
    if ('untrap'.startsWith(command)) return 'untrap';
    if (command.length >= 3 && 'wipe'.startsWith(command)) return 'wipe';
    if ('sit'.startsWith(command)
        && (!game.flags?.debug || command.length >= 2)) return 'sit';
    return null;
}

async function runExtendedCommand(command) {
    if (command === 'conduct') return doconduct();
    if (command === 'chronicle') return doChronicle();
    if (command === 'vanquished') return doVanquished();
    if (command === 'genocided') return doGenocided();
    if (command === 'terrain') return doTerrainOverview();
    if (command === 'version') return doextversion();
    if (command === 'quit') return doquit();
    if (command === 'twoweapon') return dotwoweapon();
    if (command === 'enhance') return doenhance();
    if (command === 'chat') return dochat();
    if (command === 'sit') return dosit({
        finishTeleport: finishTeleportArrival,
        gotoLevel,
        chooseTeleportDestination: askTeleportDestination,
    });
    if (command === 'pray') return dopray();
    if (command === 'name') return doname();
    if (command === 'invoke') return doinvoke();
    if (command === 'ride') return doride();
    if (command === 'rub') return dorub();
    if (command === 'loot') return doloot();
    if (command === 'tip') return dotip();
    if (command === 'force') return doforce();
    if (command === 'jump') return dojump();
    if (command === 'overview') return doDungeonOverview();
    if (command === 'offer') return dooffer();
    if (command === 'dip') return dodip();
    if (command === 'turn') return doturn();
    if (command === 'untrap') return dountrap();
    if (command === 'wipe') return dowipe();
    if (command === 'monster') return domonability();
    if (command === 'polyself') return wizPolyself();
    if (command === 'annotate') return doannotate();
    if (command === 'herecmdmenu') return doherecmdmenu();
    if (command === 'adjust') return doadjust();
    if (command === 'levelchange') return wizLevelChange();
    if (command === 'wizwhere') return wizWhere();
    if (command === 'wizwish') return wizWish();
    if (command === 'wizgenesis') return wizGenesis();
    if (command === 'wizkill') return wizKill();
    if (command === 'wizidentify') return wizIdentify();
    if (command === 'wizintrinsic') return wizIntrinsic();
    if (command === 'wizmap') return wizMap();
    await pline(`#${command}: unknown extended command.`);
    game.context.move = 0;
}

// C refs: artifact.c:doinvoke(), invoke_ok(), arti_invoke().  getobj()
// suggests artifacts and other unique objects; an artifact with inv_prop 0
// still consumes a turn after retouching, but its only effect is the ordinary
// "Nothing happens." line.
async function doinvoke() {
    const eligible = (game.inventory || []).filter(object =>
        !!(object.oartifact || object.artifact || object.unique));
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
    if (selection.cancelled) {
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

    // The property and special-power branches are explicit data now but need
    // their own source transactions before they can be accepted.
    await pline('Nothing happens.');
    game.context.move = 1;
}

function rubEligibleObject(object) {
    return object?.otyp === OIL_LAMP || object?.otyp === MAGIC_LAMP
        || object?.otyp === BRASS_LANTERN || isRoyalJelly(object);
}

async function rubRoyalJelly(jelly) {
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

async function djinniFromLamp(object) {
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
        const { mx, my } = djinni;
        removeWishGrantingMonster(djinni, { preserveGlyph: true });
        await makeWish({ announce: true });
        newsym(mx, my);
        break;
    }
    case 1:
        await plineWithContinuation('"Thank you for freeing me!"');
        tameMonster(djinni);
        break;
    case 2:
        await plineWithContinuation('"You freed me!"');
        djinni.mpeaceful = 1;
        break;
    case 3:
        await plineWithContinuation('"It is about time!"');
        if (canSpotMonster(djinni))
            await plineWithContinuation('The djinni vanishes.');
        removeWishGrantingMonster(djinni);
        break;
    default:
        await plineWithContinuation('"You disturbed me, fool!"');
        djinni.mpeaceful = 0;
        djinni.mtame = 0;
        djinni.pet = false;
        break;
    }
}

// C refs: apply.c:dorub(), invent.c:getobj(), wield.c:wield_tool(), and
// cmd.c:CQ_CANNED.  Selecting an unwielded lamp does not rub it immediately:
// wield_tool() installs it, consumes one action, and queues dorub plus the
// inventory letter for the next hero command boundary.
async function dorub(cannedInvlet = null) {
    const eligible = (game.inventory || []).filter(rubEligibleObject);
    let object;
    if (cannedInvlet !== null) {
        object = eligible.find(candidate => candidate.invlet === cannedInvlet);
        if (!object) {
            game.context.move = 0;
            return;
        }
    } else {
        const letters = eligible.map(candidate => candidate.invlet).join('');
        const selection = await promptInventoryObject(
            `What do you want to rub? [${
                compactInventoryLetters(letters)} or ?*] `,
            eligible, { allowMenu: true },
        );
        if (selection.cancelled) {
            game.context.move = 0;
            return;
        }
        object = selection.object;
    }

    // Interactive entry owns a getobj prompt which selection replaces.
    // Canned re-entry happens before the next physical key and inherits the
    // wield/scheduler topline, so its result must append to that message.
    if (cannedInvlet === null) game._pending_message = '';
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
        game._cannedCommands ||= [];
        game._cannedCommands.push({ kind: 'rub', invlet: object.invlet });
        game.context.move = 1;
        return;
    }

    if (object.otyp === MAGIC_LAMP) {
        if ((object.spe || 0) > 0 && rn2(3) === 0) {
            // C performs the bones-safe lamp transformation before the
            // released monster can grant a fatal artifact wish.
            transformMagicLampToOilLamp(
                object, 1000 + rn2(500), game, game.moves ?? 0,
            );
            await djinniFromLamp(object);
            if (!game._knownObjectTypes?.has(MAGIC_LAMP)) {
                exerciseAttribute(A_WIS, true);
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

// C ref: pray.c dosacrifice().  The command-table and altar-eligibility
// boundary are shared even when no sacrifice transaction begins.
async function dooffer() {
    const loc = game.level?.at?.(game.u.ux, game.u.uy);
    if (loc?.typ !== ALTAR || game.u?.uswallow) {
        const relation = (game.u?.levitating || game.u?.flying)
            ? 'over' : 'on';
        await pline(`You are not ${relation} an altar.`);
        game.context.move = 0;
        return;
    }
    if ((game.u?.confusionTurns ?? 0) > 0
        || (game.u?.stunnedTurns ?? 0) > 0) {
        await pline('You are too impaired to perform the rite.');
        game.context.move = 0;
        return;
    }

    // TODO: implement sacrifice valuation, altar conversion, rewards, and
    // high-altar ascension.
    await pline('Nothing happens.');
    game.context.move = 1;
}

// C ref: trap.c dountrap().  Direction acquisition is its own zero-time
// command boundary; Escape cancels before any adjacent trap/container policy.
async function dountrap() {
    // trap.c:could_untrap() rejects capability before opening getdir().
    if (nearCapacity(game) >= HVY_ENCUMBER) {
        await pline("You're too strained to do that.");
        game.context.move = 0;
        return;
    }
    const form = game.u?.umonnum;
    const webmaker = form === 94 || form === 96;
    if ((heroHasNoHands(game) && !webmaker)
        || (Number.isInteger(form) && (MONSTER_MOVE[form] ?? 0) === 0)) {
        await pline('And just how do you expect to do that?');
        game.context.move = 0;
        return;
    }
    const direction = await promptKey('In what direction? ');
    if (direction === 27) {
        game._pending_message = '';
        game.context.move = 0;
        return;
    }

    // Adjacent trap discovery, chest trap removal, and monster rescue branch
    // after a concrete direction is supplied.
    await pline('You find no traps there.');
    game.context.move = 1;
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
async function domonability() {
    if ((game.u?.mtimedone ?? 0) <= 0) {
        await pline("You don't have a special ability in your normal form!");
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
        game.context.move = result.spentTime ? 1 : 0;
        return;
    }
    if (heroCanMindBlast(game)) {
        const result = await useHeroMindBlast({ state: game });
        game.context.move = result.spentTime ? 1 : 0;
        return;
    }
    await pline('Any special ability you may have is purely reflexive.');
    game.context.move = 0;
}

// C ref: invent.c:doorganize()/doorganize_core().
// TODO: add splitting, collecting, merging, swapping, gold repair, and the
// used-letter menu.
async function doadjust() {
    const inventory = (game.inventory || [])
        .filter(object => object.invlet)
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
    if (selection.cancelled) {
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
    game._pending_message = '';
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
    if (displaced) displaced.invlet = source;
    object.invlet = destination;
    game.inventory.sort((a, b) =>
        String(a.invlet).localeCompare(String(b.invlet)));
    game._pending_message = '';
    await pline(
        `${displaced ? 'Swapping:' : destination === source
            ? 'Collecting:' : 'Moving:'} ${destination} - ${
            inventoryItemDescription(object)}.`,
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
        await castKnownSpell(spell);
        return;
    }

    await turnUndeadByCallingOnDeity(game);
}

// C refs: trap.c water_damage()/erode_obj().  Fountain dipping forces the
// water check, so the ordinary luck-based shield is bypassed; the erosion
// result then controls dipfountain()'s separate one-in-two early-return gate.
async function waterDamageCarriedObject(object) {
    const kind = objectErosionKind(object);
    if (!kind || kind.action !== 'rust') return ER_NOTHING;

    const proof = !!(object.oerodeproof || object.rustproof);
    if (proof) {
        object.rknown = true;
        return ER_NOTHING;
    }
    if (object.blessed && rnl(4) === 0) return ER_NOTHING;
    if ((object[kind.field] || 0) >= 3) return ER_NOTHING;

    const message = objectErosionMessage(object, kind);
    await pline(message);
    object[kind.field] = (object[kind.field] || 0) + 1;
    if (object.worn) findArmorClass(game);
    return ER_DAMAGED;
}

async function dipFountain(object, loc) {
    const result = await waterDamageCarriedObject(object);
    if (result === ER_DESTROYED
        || (result !== ER_NOTHING && rn2(2) === 0)) {
        return;
    }

    const fate = rnd(30);
    let eventMessage = '';
    let continueFountainMessage = false;
    const bucEffect = resolveDippedBucFate({
        fate,
        object,
        blind: !!game.blind,
        liquidName: () => displayLiquidName('water'),
    });
    const sensationEffect = resolveDippedSensationFate({
        fate,
        armName: () => heroArmName(game),
    });
    const currentDungeon = game.dungeons?.[game.u?.uz?.dnum ?? 0];
    const coinEffect = applyDippedCoinFate({
        fate,
        loc,
        dungeonLevels: currentDungeon?.num_dunlevs
            ?? game.u?.uz?.dlevel ?? 1,
        dungeonLevel: game.u?.uz?.dlevel ?? 1,
        blind: !!game.blind,
        random: rnd,
        createGold: quantity => {
            mkgold(quantity, game.u.ux, game.u.uy);
        },
        liquidName: () => displayLiquidName('water'),
        exerciseWisdom: () => exerciseAttribute(A_WIS, true),
        repaint: () => newsym(game.u.ux, game.u.uy),
    });
    if (bucEffect.handled) {
        eventMessage = bucEffect.message;
    } else if (sensationEffect.handled) {
        eventMessage = sensationEffect.message;
    } else if (coinEffect.handled) {
        eventMessage = coinEffect.message;
    } else if (fate === 21) {
        continueFountainMessage = !!(await summonFountainDemon()).message;
    } else if (fate === 22) {
        continueFountainMessage = !!(await summonFountainNymph()).message;
    } else if (fate === 23) {
        continueFountainMessage = !!(await summonFountainSnakes()).message;
    } else if (fate === 24) {
        if ((loc.looted ?? 0) & F_LOOTED)
            eventMessage = (await dogushforth(false)).join('  ');
        else
            continueFountainMessage = (await discoverFountainGem(loc)).discovered;
    } else if (fate === 25) {
        eventMessage = (await dogushforth(false)).join('  ');
    } else if (fate === 28) {
        await moreUntilDismissed(
            'An urge to take a bath overwhelms you.--More--',
        );
        game._pending_message = '';

        const wallet = heroGoldAmount(game);
        if (wallet > 10) {
            const loss = Math.trunc(someGold(wallet) / 10);
            game._statusGoldOverride = wallet;
            setHeroGoldAmount(game, wallet - loss);
            await pline('You lost some of your gold in the fountain!');
            loc.looted = (loc.looted ?? 0) & ~F_LOOTED;
            exerciseAttribute(A_WIS, false);
        }

        const dryup = dryFountainTerrain(loc);
        if (dryup.dried)
            await plineWithContinuation('The fountain dries up!');
        await reportFountainWarning(dryup.warning);
        return;
    } else if ((fate < 16 || fate === 30) && result === ER_NOTHING) {
        eventMessage = 'Nothing seems to happen.';
    }
    // The selected random effect precedes dryup() even when it is a no-op.
    // Numbered effect cases remain independent owners.
    const dryup = dryFountainTerrain(loc);
    if (dryup.dried) {
        eventMessage += `${
            eventMessage ? '  ' : ''
        }The fountain dries up!`;
    }
    if (eventMessage) {
        if (continueFountainMessage)
            await plineWithContinuation(eventMessage);
        else await pline(eventMessage);
    }
    await reportFountainWarning(dryup.warning);
}

function dipTargetDescription(object) {
    const full = inventoryItemDescription(object);
    if (full.length <= 49) return full;

    // objnam.c:short_oname() strips these lengthening properties on a
    // temporary copy before falling back to its minimal formatter.
    return inventoryItemDescription({
        ...object,
        bknown: false,
        rknown: false,
        buc: undefined,
        greased: false,
        oeroded: 0,
        oeroded2: 0,
    });
}

// C ref: potion.c dodip()/invent.c getobj().  Object selection, terrain
// confirmation, and the committed dip are one nested command transaction.
async function dodip() {
    const items = (game.inventory || []).filter(item => item.invlet)
        .sort((a, b) => a.invlet.localeCompare(b.invlet));
    const letters = compactInventoryLetters(
        items.map(item => item.invlet).join(''),
    );
    const selection = await promptInventoryObject(
        `What do you want to dip? [${letters} or ?*] `,
        items,
        { allowMenu: true, retainPromptOnCancel: true },
    );
    if (selection.cancelled) {
        game.context.move = 0;
        return;
    }

    const object = selection.object;
    const loc = game.level?.at(game.u?.ux, game.u?.uy);
    if (loc?.typ === FOUNTAIN) {
        const description = dipTargetDescription(object);
        const prompt = `Dip ${description} into the fountain? [yn] (n)`;
        const answer = await promptYesNo(
            prompt, 'n', 1,
        );
        if (answer === 'y') {
            await dipFountain(object, loc);
            // tty removes the answered query from continuation ownership but
            // leaves its physical row painted when dipfountain() produces no
            // replacement line (for example, cursing an already-cursed item).
            if (!game._pending_message && !game._retained_message)
                game._retained_message = prompt;
            game.context.move = 1;
            return;
        }
    }

    // Potion, sink, pool, and declined-fountain second selectors remain
    // distinct source transactions.
    game.context.move = 0;
}

function visitedDungeonLevels() {
    const byDungeon = new Map();
    const remember = (dnum, dlevel) => {
        if (!Number.isInteger(dnum) || !Number.isInteger(dlevel)) return;
        if (!byDungeon.has(dnum)) byDungeon.set(dnum, new Set());
        byDungeon.get(dnum).add(dlevel);
    };
    remember(game.u?.uz?.dnum ?? 0, game.u?.uz?.dlevel ?? 1);
    for (const key of game._levelCache?.keys?.() || []) {
        const [dnum, dlevel] = String(key).split(':').map(Number);
        remember(dnum, dlevel);
    }
    return byDungeon;
}

function dungeonOverviewHeading(dnum, levels) {
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

function overviewLevelIsInteresting(dnum, dlevel, deepest) {
    if (dlevel === deepest) return true;
    if ((game.u?.uz?.dnum ?? 0) === dnum
        && (game.u?.uz?.dlevel ?? 1) === dlevel) return true;
    const annotation = game._levelAnnotations?.get?.(`${dnum}:${dlevel}`);
    const record = game._overviewRecords?.get?.(`${dnum}:${dlevel}`);
    const features = record?.features || {};
    return !!annotation || !!record?.branch || Object.values(features)
        .some(value => Number.isInteger(value) && value > 0);
}

function overviewCountPhrase(count, noun) {
    if (count === 1)
        return `${/^[aeiou]/i.test(noun) ? 'an' : 'a'} ${noun}`;
    if (count === 2) return `some ${noun}s`;
    return `many ${noun}s`;
}

function overviewFeatureLine(features) {
    const phrases = [];
    if (features?.nshop) {
        if (features.nshop === 1) {
            const type = SHOP_TYPE_NAMES[
                (features.shoptype ?? SHOPBASE) - SHOPBASE
            ] || 'shop';
            phrases.push(`a ${type}`);
        } else {
            phrases.push(overviewCountPhrase(features.nshop, 'shop'));
        }
    }
    for (const [countKey, noun] of [
        ['naltar', 'altar'], ['nthrone', 'throne'],
        ['nfount', 'fountain'], ['nsink', 'sink'],
        ['ngrave', 'grave'], ['ntree', 'tree'],
    ]) {
        const count = features?.[countKey] ?? 0;
        if (count) phrases.push(overviewCountPhrase(count, noun));
    }
    if (!phrases.length) return null;
    const text = phrases.join(', ');
    return `      ${text[0].toUpperCase()}${text.slice(1)}.`;
}

// C ref: dungeon.c dooverview()/show_overview().  This is dungeon-history
// projection over mapseen/cache state; it is distinct from Delete's
// known-terrain browser, which enters a getpos-style cursor transaction.
async function doDungeonOverview() {
    // The C command lazily calls recalc_mapseen() before rendering.  Refresh
    // the current level from remembered/underfoot terrain at that same
    // boundary; do not infer features from unseen live squares.
    recordMappedOverviewState();
    const lines = [];
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
    const pages = [];
    for (let offset = 0; offset < stream.length; offset += pageSize) {
        const lines = Array(24).fill('');
        const chunk = stream.slice(offset, offset + pageSize);
        for (let row = 0; row < chunk.length; row++) lines[row] = chunk[row];
        lines[23] = '--More--';
        pages.push({ lines, cursor: [8, 23] });
    }
    await showTextPages(pages, { validKeys: [27, 32, 10, 13] });
    game._pending_message = '';
    game.context.move = 0;
}

async function doVanquished() {
    if (!game._vanquishedCounts?.size) {
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
    const genocided = [...(game._genocidedMonsters || [])];
    if (!genocided.length) {
        await pline('No creatures have been genocided.');
    } else {
        const lines = ['Genocided species:', '', ...genocided];
        await showDisclosureOverlay(lines, { restoreUnderlay: true });
    }
    game.context.move = 0;
}

function permanentlyIdentified(item) {
    return !!(item?.typeKnown && item?.known && item?.dknown
        && item?.bknown && item?.rknown);
}

function wizardIdentifyDescription(item) {
    const identified = {
        ...item,
        typeKnown: true,
        known: true,
        dknown: true,
        bknown: true,
        rknown: true,
        buc: item.blessed ? 'blessed'
            : item.cursed ? 'cursed' : 'uncursed',
    };
    const artifact = item.oartifact ? artifactById(item.oartifact) : null;
    if (!artifact) return inventoryItemDescription(identified);

    // objnam.c:doname() renders a known artifact as its unique identity,
    // rather than as a base object followed by an individual `named` suffix.
    let suffix = '';
    if (game.u?.twoweap && item === game.uwep)
        suffix = ' (wielded in right hand)';
    else if (game.u?.twoweap && item === game.uswapwep)
        suffix = ' (wielded in left hand)';
    else if (item === game.uwep) {
        const hand = game.u?.rightHanded === false ? 'left' : 'right';
        suffix = ` (weapon in ${hand} hand)`;
    } else if (item.worn) suffix = ' (being worn)';
    const enchantment = Number.isInteger(item.enchantment)
        ? item.enchantment : Number.isInteger(item.spe) ? item.spe : null;
    const bonus = Number.isInteger(enchantment)
        ? `${enchantment >= 0 ? '+' : ''}${enchantment}` : '';
    const artifactName = artifact.name.replace(/^The /, '');
    return ['the', identified.buc, bonus, artifactName]
        .filter(Boolean).join(' ') + suffix;
}

// C wizcmds.c:wiz_identify() delegates to display_inventory() with
// iflags.override_ID set.  Fully identified inventories still open a short
// PICK_NONE menu; the command does not collapse into a topline message.
async function wizIdentify() {
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

    const sections = PICKUP_CLASS_ORDER.map(heading => ({
        heading,
        items: unidentified
            .filter(item => pickupObjectClass(item) === heading)
            .sort((a, b) => a.invlet.localeCompare(b.invlet))
            .map(item => ({
                key: item.invlet,
                text: wizardIdentifyDescription(item),
                value: item,
            })),
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
        left: 12,
        blankAfterTitle: false,
        titleAttr: ATR_NONE,
    });
    game._pending_message = '';
    await docrt();
    for (const item of selected) {
        const learnedType = !objectTypeKnown(item);
        fullyIdentifyObject(item);
        if (learnedType) exerciseAttribute(A_WIS, true);
        await plineWithContinuation(
            `${item.invlet} - ${inventoryItemDescription(item)}.`,
        );
    }
    game.context.move = 0;
}

const WIZARD_INTRINSIC_PROPERTIES = [
    'invulnerable', 'petrifying', 'becoming slime', 'strangling',
    'fatally sick', 'stunned', 'confused', 'hallucinating', 'blinded',
    'deafness', 'vomiting', 'slippery fingers', 'wounded legs', 'sleepy',
    'teleporting', 'polymorphing', 'levitating', 'very fast',
    'clairvoyant', 'monster detection', 'see invisible', 'invisible',
    'acid resistance', 'stoning resistance', 'displaced',
    'pass thru walls', 'magical breathing', 'water walking',
    'fire resistance', 'cold resistance', 'sleep resistance',
    'disintegration resistance', 'shock resistance', 'poison resistance',
    'drain resistance', 'sickness resistance', 'magic resistance',
    // HALLUC_RES is intentionally absent, matching wiz_intrinsic().
    'light-induced blindness resistance', 'fumbling', 'voracious hunger',
    'telepathic', 'warning', 'warn: monster type or class', 'warn: undead',
    'searching', 'infravision', 'adorned (+/- Cha)', 'stealthy',
    'monster aggravation', 'conflict', 'jumping', 'teleport control',
    'flying', 'swimming', 'slow digestion', 'half spell damage',
    'half physical damage', 'HP regeneration', 'energy regeneration',
    'extra protection', 'protection from shape changers',
    'polymorph control', 'unchanging', 'reflecting', 'free action',
    'fixed abilities', 'life will be saved',
];

function wizardIntrinsicAccelerator(index) {
    if (index < 26) return String.fromCharCode(97 + index);
    if (index < 52) return String.fromCharCode(65 + index - 26);
    return String(index - 51);
}

function wizardIntrinsicTimeout(name) {
    const field = {
        invulnerable: 'invulnerableTurns',
        petrifying: 'stonedTurns',
        'becoming slime': 'slimedTurns',
        strangling: 'strangledTurns',
        'fatally sick': 'sickTurns',
        stunned: 'stunnedTurns',
        confused: 'confusionTurns',
        hallucinating: 'hallucinationTurns',
        blinded: 'blindTurns',
        deafness: 'deafTurns',
        vomiting: 'vomitingTurns',
        'slippery fingers': 'glibTurns',
        'wounded legs': '_woundedLegTurns',
        sleepy: 'sleepyTurns',
        teleporting: 'teleportingTurns',
        polymorphing: 'polymorphingTurns',
        levitating: 'levitationTurns',
        'very fast': 'veryFastTurns',
        clairvoyant: 'clairvoyanceTurns',
        'monster detection': 'monsterDetectionTurns',
        'see invisible': 'seeInvisibleTurns',
        invisible: 'invisibleTurns',
        'magic resistance': 'magicResistanceTurns',
        'shock resistance': 'shockResistanceTurns',
        fumbling: 'fumblingTurns',
        'half spell damage': 'halfSpellDamageTurns',
        'half physical damage': 'halfPhysicalDamageTurns',
    }[name];
    return field ? Math.max(0, game.u?.[field] ?? 0) : 0;
}

async function wizIntrinsic() {
    const items = WIZARD_INTRINSIC_PROPERTIES.map((name, index) => {
        const timeout = wizardIntrinsicTimeout(name);
        return {
            key: wizardIntrinsicAccelerator(index),
            // C uses "%-27s [timeout]" so every page shares one aligned
            // timeout column without changing the item's accelerator.
            text: timeout ? `${name.padEnd(27)} [${timeout}]` : name,
            value: name,
            separatorBefore: name === 'fire resistance',
        };
    });
    const selections = await showMultiSelectWindow({
        title: 'Which intrinsics?',
        introLines: game.flags?.cmdassist !== false ? [
            '[Precede any selection with a count to increment by other than 30.]',
        ] : [],
        sections: [{ heading: '', items }],
        omitHeadings: true,
        left: 1,
        // tty assigns automatic selectors afresh on each physical menu page;
        // page two consequently begins with a=see invisible, b=invisible.
        pageLocalKeys: true,
    });

    game.context.move = 0;
    if (!selections.length) {
        game._pending_message = '';
        game._retained_message = '';
        await docrt();
        return;
    }
    // select_menu() returns only after destroy_nhwindow() has removed both
    // the intrinsic window and its extended-command editor.  Timeout plines
    // therefore begin from an empty topline, not "# wizintrinsic".
    game._pending_message = '';
    game._retained_message = '';
    const propertyMessages = [];
    const queuePropertyMessage = (property, message) => {
        propertyMessages.push({ property, message });
    };
    if (selections.includes('invulnerable')) {
        const oldTimeout = game.u.invulnerableTurns ?? 0;
        game.u.invulnerableTurns = oldTimeout + 30;
        queuePropertyMessage('invulnerable',
            `Timeout for invulnerable ${
                oldTimeout ? 'increased by' : 'set to'
            } 30.`,
        );
    }
    if (selections.includes('very fast')) {
        const oldTimeout = game.u.veryFastTurns ?? 0;
        game.u.veryFastTurns = oldTimeout + 30;
        game.u.veryFast = true;
        queuePropertyMessage('very fast',
            `Timeout for very fast ${
                oldTimeout ? 'increased by' : 'set to'
            } 30.`,
        );
    }
    if (selections.includes('half spell damage')) {
        const oldTimeout = game.u.halfSpellDamageTurns ?? 0;
        game.u.halfSpellDamageTurns = oldTimeout + 30;
        game.u.halfSpellDamage = true;
        queuePropertyMessage('half spell damage',
            `Timeout for half spell damage ${
                oldTimeout ? 'increased by' : 'set to'
            } 30.`,
        );
    }
    if (selections.includes('half physical damage')) {
        const oldTimeout = game.u.halfPhysicalDamageTurns ?? 0;
        game.u.halfPhysicalDamageTurns = oldTimeout + 30;
        game.u.halfPhysicalDamage = true;
        queuePropertyMessage('half physical damage',
            `Timeout for half physical damage ${
                oldTimeout ? 'increased by' : 'set to'
            } 30.`,
        );
    }
    if (selections.includes('shock resistance')) {
        const oldTimeout = game.u.shockResistanceTurns ?? 0;
        game.u.shockResistanceTurns = oldTimeout + 30;
        game.u.shockResistance = true;
        queuePropertyMessage('shock resistance',
            `Timeout for shock resistance ${
                oldTimeout ? 'increased by' : 'set to'
            } 30.`,
        );
    }
    if (selections.includes('magic resistance')) {
        const oldTimeout = game.u.magicResistanceTurns ?? 0;
        game.u.magicResistanceTurns = oldTimeout + 30;
        game.u.antimagic = true;
        queuePropertyMessage('magic resistance',
            `Timeout for magic resistance ${
                oldTimeout ? 'increased by' : 'set to'
            } 30.`,
        );
    }
    if (selections.includes('invisible')) {
        const oldTimeout = game.u.invisibleTurns ?? 0;
        game.u.invisibleTurns = oldTimeout + 30;
        game.u.invisible = true;
        game.u.invis = true;
        queuePropertyMessage('invisible',
            `Timeout for invisible ${
                oldTimeout ? 'increased by' : 'set to'
            } 30.`,
        );
    }
    if (selections.includes('fatally sick')) {
        const oldTimeout = game.u.sickTurns ?? 0;
        const sickness = startHeroSickness({
            state: game,
            turns: oldTimeout || 30,
            cause: '#wizintrinsic',
            type: rn2(2) === 0 ? SICK_VOMITABLE : SICK_NONVOMITABLE,
        });
        if (sickness.message)
            queuePropertyMessage('fatally sick', sickness.message);
    }
    if (selections.includes('vomiting')) {
        const oldTimeout = game.u.vomitingTurns ?? 0;
        startHeroVomiting({ state: game, turns: oldTimeout + 30 });
        queuePropertyMessage('vomiting',
            `You are${oldTimeout ? ' still' : ''} vomiting.`);
    }
    if (selections.includes('blinded')) {
        const oldTimeout = game.u.blindTurns ?? 0;
        const couldSee = !game.blind;
        // wizcmds.c:wiz_intrinsic() dispatches BLINDED through
        // make_blinded(newtimeout, TRUE).  Extending an active timeout does
        // not print generic "Timeout for ..." feedback, but first sight loss
        // announces itself before blindness state and vision are committed.
        if (couldSee) {
            const hallucinating = !!(game.u?.hallucinating
                || (game.u?.hallucinationTurns ?? 0) > 0);
            await moreUntilDismissed(hallucinating
                ? 'Oh, bummer!  Everything is dark!  Help!--More--'
                : 'A cloud of darkness falls upon you.--More--');
        }
        game.u.blindTurns = oldTimeout + 30;
        syncBlindness(game);
        if (!oldTimeout) game.vision_full_recalc = 1;
    }
    if (selections.includes('deafness')) {
        const oldTimeout = game.u.deafTurns ?? 0;
        // wizcmds.c:wiz_intrinsic() dispatches DEAF through
        // potion.c:make_deaf(newtimeout, TRUE).  Unlike make_blinded(),
        // make_deaf() commits its timed property before publishing the first
        // transition line, so the suspended pager already renders `Deaf` in
        // the status row.  Extending an active timed timeout is silent.
        game.u.deafTurns = oldTimeout + 30;
        syncDeafness(game);
        if (!oldTimeout) {
            await moreUntilDismissed(
                'You are unable to hear anything.--More--',
            );
        }
    }
    if (selections.includes('hallucinating')) {
        game.u.hallucinationTurns = (game.u.hallucinationTurns || 0) + 30;
        game.u.hallucinating = true;
        game.vision_full_recalc = 1;
        vision_recalc(0);
        // potion.c:make_hallucinated() consumes the first presentation-RNG
        // projections before it publishes the state-change line.  Deferring
        // these until the pager acknowledgement shifts every later
        // Hallucinated glyph and name by a complete display pass.
        if (game.u?.uswallow) {
            swallowed(false);
        } else {
            see_monsters();
            see_objects();
            see_traps();
        }
        await moreUntilDismissed(
            'Oh wow!  Everything looks so cosmic!--More--',
        );
        game._pending_message = '';
        game._retained_message = '';
        await docrtRecalc();
        return;
    }
    if (propertyMessages.length) {
        // wiz_intrinsic() walks select_menu() results in global property
        // order and calls pline() once per selection.  Short lines compose on
        // tty's topline; an overflowing later line pages the earlier one.
        // The final docrt() then forces whichever line remains.
        propertyMessages.sort((left, right) =>
            WIZARD_INTRINSIC_PROPERTIES.indexOf(left.property)
            - WIZARD_INTRINSIC_PROPERTIES.indexOf(right.property));
        for (const { message } of propertyMessages)
            await plineWithContinuation(message);
        await flushPendingTopline();
    }
    // destroy_nhwindow() removes both the intrinsic menu and the extended
    // command editor which launched it.  Properties such as BLINDED dispatch
    // through make_blinded() without generic timeout prose when already
    // active, so they still need the same command-line teardown.
    game._pending_message = '';
    game._retained_message = '';
    await docrt();
}

// TTY's extended-command line editor redraws the prompt at every input
// boundary.  #enhance has AUTOCOMPLETE, so its unique initial "e" expands
// visually while subsequent characters advance through that completed word.
async function doextcmd() {
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
                display.setCell(1 + index, 1, continuation[index], NO_COLOR, 0);
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

function wizardPositionDescription(x, y) {
    if (x === game.u?.ux && y === game.u?.uy) {
        const polymorphName = heroIsPolymorphed(game)
            ? MONSTER_NAME[game.u?.umonnum] : '';
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
        || loc.remembered_glyph?.kind === 'object'))
        return floorObjectDescription(object);
    return farlookLocationDescription(x, y) || 'unexplored area';
}

function roomAtPosition(x, y) {
    const roomno = game.level?.at(x, y)?.roomno ?? 0;
    if (roomno >= ROOMOFFSET)
        return roomForRoomno(game.level, roomno);
    // Special-level flips move the room rectangle with its entities; older
    // map cells may not yet carry the derived roomno projection.
    return game.level?.rooms?.find(room => room
        && x >= room.lx && x <= room.hx
        && y >= room.ly && y <= room.hy) || null;
}

export async function askTeleportDestination() {
    const firstUse = !game._travelTipShown;
    if (firstUse) {
        const dismissal = await moreUntilDismissed(
            'Where do you want to be teleported?--More--',
        );
        if (dismissal === 27) {
            game._pending_message = '';
            return { destination: null, editorOpened: false };
        }
        game._travelTipShown = true;
        const tipDismissal = await farlookTipUntilDismissed();
        if (tipDismissal === 27) {
            game._pending_message = '';
            return { destination: null, editorOpened: false };
        }
    }

    game._travelTarget = null;
    const destination = await selectMapPosition({
        start: { x: game.u.ux, y: game.u.uy },
        prompt: firstUse
            ? (game.flags?.verbose
                ? "(For instructions type a '?')  Move cursor to the desired position:"
                : 'Move cursor to the desired position:')
            : (game.flags?.verbose
                ? "Where do you want to be teleported?  (For instructions type a '?')"
                : 'Where do you want to be teleported?'),
        goal: 'the desired position',
        describe: wizardPositionDescription,
    });
    return { destination, editorOpened: true };
}

// C refs: cmd.c dotelecmd(), teleport.c dotele()/teleds(), getpos.c getpos(),
// and priest.c intemple().  A successful Wizard position teleport returns
// ECMD_TIME.  Its first getpos use still owns the shared Lua tutorial, while
// the destination room separately owns entry effects after relocation.
async function wizTeleportPosition() {
    const choice = await askTeleportDestination();
    if (!choice.destination) {
        if (!choice.editorOpened) {
            game.context.move = 0;
            return;
        }
        // dotele(TRUE) still reaches morehungry(100) and returns a timed
        // command when scrolltele()'s controlled getpos was cancelled.
        game.u.uhunger = (game.u.uhunger ?? 900) - 100;
        game.context.move = 1;
        return;
    }

    // getpos removes its auto-description from the logical topline while
    // leaving the painted text on tty.  Destination decor can consequently
    // append beside it before the floor-pile window opens.
    game._retained_message = game._pending_message;
    game._pending_message = '';
    let destination = { ...choice.destination };
    if (!heroTeleportDestinationOk(destination.x, destination.y)) {
        // teleport.c:scrolltele() rejects the controlled location before
        // entering safe_teleds().  Keep "Sorry..." pending while the random
        // selector and teleds() update the map; a destination floor pager can
        // then suspend this line at the same tty boundary as C.
        await pline('Sorry...');
        destination = safeTeleportDestination();
        if (!destination) {
            game.u.uhunger = (game.u.uhunger ?? 900) - 100;
            game.context.move = 1;
            return;
        }
    }

    const movement = moveHeroByTeleport(destination.x, destination.y);
    newsym(movement.oldx, movement.oldy);
    vision_reset();
    vision_recalc(0);
    newsym(destination.x, destination.y);
    // teleport.c:dotele(): successful controlled position teleportation,
    // including Wizard ^T, costs 100 nutrition after relocation.
    game.u.uhunger = (game.u.uhunger ?? 900) - 100;
    await docrt();
    await bot();

    if (game.flags?.verbose) {
        // teleds() emits this before spoteffects()->check_special_room().
        // A room-entry message can therefore suspend on this pending line.
        await plineWithContinuation(
            'You materialize in a different location!',
        );
    }
    await checkSpecialRoom();
    let destinationFeature = '';
    if (destination.x === game.level?.upstair?.x
        && destination.y === game.level?.upstair?.y)
        destinationFeature = 'There is a staircase up here.';
    else if (destination.x === game.level?.dnstair?.x
        && destination.y === game.level?.dnstair?.y)
        destinationFeature = 'There is a staircase down here.';
    else if (game.level?.at?.(destination.x, destination.y)?.typ === FOUNTAIN)
        destinationFeature = 'There is a fountain here.';
    const destinationPile = game.level?.objects?.[destination.x]?.[
        destination.y
    ] || [];
    if (destinationPile.length) {
        // safe_teleds()->spoteffects()->pickup(1) shares the same blind
        // look_here transaction as level arrival: tactile topline, temporary
        // pile window, then notake() rejects forms which cannot carry objects.
        if (game.blind) {
            await plineWithContinuation(
                'You try to feel what is lying here on the floor.',
            );
        }
        await showFloorPile(destinationPile, false, destinationFeature);
        if (heroCannotTake(game)) {
            await pline(
                'You are physically incapable of picking anything up.',
            );
        }
    } else if (destinationFeature)
        await pline(destinationFeature);
    game.context.move = 1;
}

function travelLocationDescription(x, y) {
    if (x === game.level?.dnstair?.x && y === game.level?.dnstair?.y) {
        return onQuestStart(game) && !okToQuest(game)
            ? 'blocked staircase down' : 'staircase down';
    }
    if (x === game.level?.upstair?.x && y === game.level?.upstair?.y)
        return 'staircase up';
    return '';
}

function travelPositionDescription(x, y) {
    const description = wizardPositionDescription(x, y);
    if (x === game.u?.ux && y === game.u?.uy) return description;
    const loc = game.level?.at?.(x, y);
    // hack.c:is_valid_travelpt() rejects unexplored stone before searching.
    const unexploredProjection = description === 'unexplored area'
        && !loc?.seenv;
    const valid = !unexploredProjection && isValidTravelTarget(x, y);
    return valid ? description : `${description} (no travel path)`;
}

function farlookLocationDescription(x, y) {
    const monster = game.level?.monsters?.find(candidate =>
        candidate.mx === x && candidate.my === y
        && (candidate.mhp ?? 1) > 0);
    if (monster && canProjectMonster(monster, x, y)) {
        const hallucinating = !!(game.u?.hallucinating
            || (game.u?.hallucinationTurns ?? 0) > 0);
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
        return `${prefix}${name}${condition}`;
    }

    const trap = game.level?.traps?.find(candidate =>
        candidate.tx === x && candidate.ty === y && candidate.tseen);
    if (trap?.ttyp === DART_TRAP) return 'dart trap';
    if (trap?.ttyp === BEAR_TRAP) return 'bear trap';
    const loc = game.level?.at(x, y);
    if (!loc) return '';
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
    }
    if (loc.typ === FOUNTAIN) return 'fountain';
    if (loc.typ === SINK) return 'sink';
    if (loc.typ === MOAT) return 'moat';
    if (loc.typ === STONE) return 'stone';
    if (IS_WALL(loc.typ)) return 'wall';
    if (loc.typ === DOOR)
        return loc.doormask === D_ISOPEN ? 'open door' : 'closed door';
    if (loc.typ === ROOM) return 'floor of a room';
    if (loc.typ === CORR) return 'corridor';
    return travelLocationDescription(x, y);
}

function jumpPathCells(fromX, fromY, toX, toY) {
    const dx = toX - fromX;
    const dy = toY - fromY;
    let cx = fromX;
    let cy = fromY;
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    let error = 0;
    const sx = dx < 0 ? -1 : 1;
    const sy = dy < 0 ? -1 : 1;
    const cells = [];
    const steps = Math.max(ax, ay);
    for (let index = 0; index < steps; index++) {
        if (ax < ay) {
            cy += sy;
            error += ax << 1;
            if (error > ay) {
                cx += sx;
                error -= ay << 1;
            }
        } else {
            cx += sx;
            error += ay << 1;
            if (error > ax) {
                cy += sy;
                error -= ax << 1;
            }
        }
        cells.push({ x: cx, y: cy });
    }
    return cells;
}

function physicalJumpTargetValid(x, y) {
    const loc = game.level?.at(x, y);
    if (!loc || (!IS_ROOM(loc.typ) && loc.typ !== CORR)) return false;
    const dx = x - game.u.ux;
    const dy = y - game.u.uy;
    // C apply.c:is_valid_jump_pos().  The Knight's intrinsic jump follows
    // the chess-knight geometry unless an extrinsic source overrides it.
    if (game.urole?.key === 'knight'
        && !game.u?.extrinsicJumping && dx * dx + dy * dy !== 5) return false;
    if (dx * dx + dy * dy > 9 || !cansee(x, y)) return false;

    // dothrow.c:walk_path() uses this strict-inequality Bresenham walk for
    // every intermediate square.  apply.c:check_jump() rejects solid rock,
    // walls, closed doors, and ordinary boulders even when the landing cell
    // itself is an accessible floor square.
    for (const { x: cx, y: cy } of jumpPathCells(
        game.u.ux, game.u.uy, x, y,
    )) {
        const pathLoc = game.level?.at(cx, cy);
        if (!pathLoc || pathLoc.typ === STONE || IS_WALL(pathLoc.typ)
            || (pathLoc.typ === DOOR
                && (pathLoc.doormask & (D_CLOSED | D_LOCKED)))
            || (game.level?.objects?.[cx]?.[cy] || [])
                .some(object => object.otyp === BOULDER)) return false;
    }
    return true;
}

function lastJumpHighlight() {
    let last = null;
    // The tty's selection repaint is observed row-first at the input
    // boundary even though apply.c probes candidates in dx/dy order.  The
    // captured cursor is left just after the lowest-row valid glyph.
    for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
            const x = game.u.ux + dx, y = game.u.uy + dy;
            if ((dx || dy) && physicalJumpTargetValid(x, y)) last = { x, y };
        }
    }
    return last;
}

function jumpLocationDescription(x, y) {
    // The shared getpos auto-description must apply visibility/memory before
    // consulting raw terrain; otherwise it leaks an unseen wall and labels
    // the hero's own square as ordinary floor.
    const description = wizardPositionDescription(x, y);
    return physicalJumpTargetValid(x, y)
        ? description : `${description} (invalid target)`;
}

// C refs: apply.c:dojump()/jump(), getpos.c:getpos(), and
// dat/nhcore.lua:show_getpos_tip().  Jump shares getpos's one-time tutorial
// with travel and controlled teleport, but owns its own validity predicate.
async function dojump() {
    const firstUse = !game._travelTipShown;
    if (firstUse) {
        const dismissal = await moreUntilDismissed(
            'Where do you want to jump?--More--',
        );
        if (dismissal === 27) {
            game._pending_message = '';
            game.context.move = 0;
            return;
        }
        game._travelTipShown = true;
        const tipDismissal = await farlookTipUntilDismissed();
        if (tipDismissal === 27) {
            game._pending_message = '';
            game.context.move = 0;
            return;
        }
    }

    const initialHighlight = lastJumpHighlight();
    const cursor = await selectMapPosition({
        start: { x: game.u.ux, y: game.u.uy },
        prompt: firstUse
            ? 'Move cursor to the desired position:'
            : (game.flags?.verbose
                ? "Where do you want to jump?  (For instructions type a '?')"
                : 'Where do you want to jump?'),
        goal: 'the desired position',
        describe: jumpLocationDescription,
        afterPaint: (_cursor, firstPaint) => {
            if (firstUse || !firstPaint || !initialHighlight) return;
            // tmp_at() paints each highlighted destination in dx/dy order;
            // tty's cursor remains just after the final glyph until the first
            // getpos input causes curs() to restore the selection cursor.
            game.nhDisplay?.setCursor(
                initialHighlight.x, initialHighlight.y + 1,
            );
        },
    });
    if (!cursor) {
        game.context.move = 0;
        return;
    }

    if (!physicalJumpTargetValid(cursor.x, cursor.y)) {
        const dx = cursor.x - game.u.ux;
        const dy = cursor.y - game.u.uy;
        await pline(dx * dx + dy * dy === 5
            ? 'There is an obstacle preventing that jump.'
            : 'Illegal move!');
        game.context.move = 0;
        return;
    }

    const oldx = game.u.ux, oldy = game.u.uy;
    game.u.ux0 = oldx;
    game.u.uy0 = oldy;
    const jumpPath = jumpPathCells(oldx, oldy, cursor.x, cursor.y);
    let previousX = oldx;
    let previousY = oldy;
    for (let index = 0; index < jumpPath.length; index++) {
        const cell = jumpPath[index];
        game.u.ux = cell.x;
        game.u.uy = cell.y;
        newsym(previousX, previousY);
        vision_recalc(1);
        newsym(cell.x, cell.y);
        if (index < jumpPath.length - 1) {
            await flush_screen(1);
            await game.animationFrame?.();
        }
        previousX = cell.x;
        previousY = cell.y;
    }
    // apply.c:jump() installs nomul(-1) before paying the hunger cost.  If
    // this action also creates a new global turn, that turn advances multi to
    // zero immediately; if intrinsic speed leaves another hero ration, the
    // landing state consumes it before another command can be read.
    game._helplessTurns = 1;
    game._helplessReason = 'jumping around';
    game._helplessDoneMessage = '';
    game.u.uhunger = (game.u.uhunger ?? 900) - rnd(25);
    game.context.move = 1;
}

function verboseFarlookDescription(x, y) {
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
async function dotravel() {
    const morePrompt = 'Where do you want to travel to?--More--';
    const firstUse = !game._travelTipShown;
    if (firstUse) {
        // tty's message pager accepts only escape, space, newline, or return;
        // invalid keys redisplay the same boundary rather than advancing to
        // the Lua tutorial.
        await moreUntilDismissed(morePrompt);
        game._travelTipShown = true;
        await farlookTipUntilDismissed();
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
    game._retained_message = game._pending_message;
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
async function doFarlook() {
    const firstUse = !game._travelTipShown;
    if (firstUse) {
        // pager.c prints the caller's short prompt before getpos() invokes
        // the shared Lua TIP_GETPOS window.  Opening that text window first
        // suspends the pending tty line; after the tutorial, getpos's
        // show_goal_msg path replaces it with the positioning prompt.
        await moreUntilDismissed(
            'Pick a monster, object or location.--More--',
        );
        game._travelTipShown = true;
        await farlookTipUntilDismissed();
    }

    const cursor = await selectMapPosition({
        start: game._travelTarget
            ? { ...game._travelTarget } : { x: game.u.ux, y: game.u.uy },
        prompt: firstUse
            ? 'Move cursor to a monster, object or location:'
            : 'Pick a monster, object or location.',
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
    await plineWithContinuation(verboseFarlookDescription(cursor.x, cursor.y));
    game.context.move = 0;
}

async function restoreHelpMap() {
    game._pending_message = '';
    game._retained_message = '';
    game.nhDisplay?.clearScreen();
    await docrtRecalc();
    await bot();
    await flush_screen(1);
}

// C pager.c:do_look(0).  The initial menu is a true PICK_ONE overlay; choosing
// the map entry destroys it, restores the map, then hands input ownership to
// the shared getpos/farlook transaction above.
async function dowhatis() {
    const entries = [
        '/ - something on the map',
        "i - something you're carrying",
        '? - something else (by symbol or name)',
        '',
        'm - nearby monsters',
        'M - all monsters shown on map',
        'o - nearby objects',
        'O - all objects shown on map',
        't - nearby traps',
        'T - all seen or remembered traps',
        'e - nearby engravings',
        'E - all seen or remembered engravings',
    ];
    const validKeys = [
        27, 32, 10, 13,
        ...'/i?mMoOtTeE'.split('').map(char => char.charCodeAt(0)),
    ];
    const key = await showChoiceWindow({
        title: 'What do you want to look at:',
        entries,
        validKeys,
    });
    await restoreHelpMap();
    if (String.fromCharCode(key) === '/') {
        await doFarlook();
        return;
    }
    game.context.move = 0;
}

// C pager.c:dohelp().
async function dohelp() {
    const entries = [
        'a - About NetHack (version information).',
        'b - Long description of the game and commands.',
        'c - List of game commands.',
        'd - Concise history of NetHack.',
        'e - Info on a character in the game display.',
        'f - Info on what a given key does.',
        'g - List of game options.',
        'h - Longer explanation of game options.',
        "i - Using the '#optionsfull' or 'm O' command to set options.",
        'j - Full list of keyboard commands.',
        'k - List of extended commands.',
        'l - List menu control keys.',
        "m - Description of NetHack's command line.",
        'n - The NetHack license.',
        'o - Support information.',
        'p - List of wizard-mode commands.',
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

async function promptYnq(message, defaultAnswer = 'q') {
    game._suppressMessagesUntilInput = false;
    await pline(message);
    await flush_screen(1);
    game.nhDisplay?.setCursor(message.length, 0);
    for (;;) {
        const key = await nhgetch();
        const answer = String.fromCharCode(key).toLowerCase();
        if (!['y', 'n', 'q'].includes(answer)
            && ![27, 32, 10, 13].includes(key)) continue;
        game._pending_message = '';
        game._retained_message = '';
        return ['y', 'n', 'q'].includes(answer) ? answer : defaultAnswer;
    }
}

async function doputon() {
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
async function putOnAccessoryObject(object) {
    if (object.worn) {
        await pline('You are already wearing that!');
        game.context.move = 0;
        return;
    }

    if (isEyewear(object)) {
        const worn = await wearEyewear(object);
        if (worn) game._liveQuietTurnRequested = true;
        game.context.move = worn ? 1 : 0;
        return;
    }

    if (object.oclass === 5 || object.class === 'Amulets') {
        if (game.uamul) {
            await pline('You are already wearing an amulet.');
            game.context.move = 0;
            return;
        }
        game.uamul = object;
        if (game.u) game.u.uamul = object;
        object.worn = true;
        object.wornSlot = 'uamul';
        // do_wear.c:Amulet_on(AMULET_OF_RESTFUL_SLEEP).
        if (object.otyp === 204) {
            const timeout = rnd(98) + 2;
            const oldTimeout = game.u?._sleepyTimeout || 0;
            if (!oldTimeout || timeout < oldTimeout)
                game.u._sleepyTimeout = timeout;
        }
        // do_wear.c:Amulet_on() -> on_msg() -> prinv().  Let the shared
        // inventory formatter own BUC observation and the worn suffix.
        await pline(`${object.invlet} - ${inventoryItemDescription(object)}.`);
        game.context.move = 1;
        return;
    }

    if ((object.oclass === 4 || object.class === 'Rings')
        && heroHasNoLimbs(game)) {
        await pline('You cannot make the ring stick to your body.');
        game.context.move = 0;
        return;
    }

    let hand;
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
    game[ringSlot] = object;
    if (game.u) game.u[ringSlot] = object;
    object.worn = true;
    object.wornSlot = `${hand}-ring`;
    if (object.otyp === RIN_REGENERATION && game.u) {
        game.u.regeneration = true;
        game.u.regenerationExtrinsic = true;
    }
    if (object.otyp === RIN_PROTECTION) {
        const enchantment = object.spe ?? object.enchantment ?? 0;
        if (enchantment !== 0
            && !game._knownObjectTypes?.has(object.otyp)) {
            recordObjectKnowledge(object.otyp);
            exerciseAttribute(A_WIS, true);
        }
        object.known = true;
        findArmorClass(game);
    }
    // Ring_on() uses the same prinv path as amulets after setworn().
    await pline(`${object.invlet} - ${inventoryItemDescription(object)}.`);
    game.context.move = 1;
}

function armorRemovalDescription(object) {
    const buc = object.buc || (object.blessed ? 'blessed'
        : object.cursed ? 'cursed' : 'uncursed');
    const enchantment = Number.isInteger(object.enchantment)
        ? object.enchantment : Number.isInteger(object.spe) ? object.spe : null;
    const bonus = enchantment === null ? ''
        : `${enchantment >= 0 ? '+' : ''}${enchantment} `;
    // objnam.c xname_flags(): implicit_uncursed normally retains the word for
    // armor/rings, but Clerics intentionally omit it even when bknown.
    const bucPrefix = buc === 'uncursed' && game.urole?.key === 'priest'
        ? '' : `${buc} `;
    return `${bucPrefix}${bonus}${object.name}`;
}

// C ref: objnam.c armor_simple_name() and category helpers.  Delayed armor
// nomovemsg deliberately uses a short category noun, not xname()/doname().
function delayedArmorRemovalSimpleName(object) {
    const slot = armorSlotFor(object?.otyp);
    const actualName = OBJECT_NAMES[object?.otyp] || object?.name || 'armor';
    const description = OBJECT_DESCRIPTIONS[object?.otyp] || '';
    const dknown = object?.dknown !== false;
    const typeKnown = game._knownObjectTypes?.has(object?.otyp);

    if (slot === 'uarm') {
        if (/ dragon scale mail$/i.test(actualName)) return 'dragon mail';
        if (/ dragon scales$/i.test(actualName)) return 'dragon scales';
        if (/ mail$/i.test(actualName)) return 'mail';
        if (/ jacket$/i.test(actualName)) return 'jacket';
        return 'suit';
    }
    if (slot === 'uarmc') {
        if (actualName === 'robe') return 'robe';
        if (actualName === 'mummy wrapping') return 'wrapping';
        if (actualName === 'alchemy smock')
            return typeKnown && dknown ? 'smock' : 'apron';
        return 'cloak';
    }
    if (slot === 'uarmh') {
        const softHeadgear = new Set([
            'elven leather helm', 'fedora', 'cornuthaum', 'dunce cap',
        ]);
        return softHeadgear.has(actualName) ? 'hat' : 'helm';
    }
    if (slot === 'uarmg') {
        const perceivedName = typeKnown ? actualName : description;
        return dknown && /gauntlets/i.test(perceivedName)
            ? 'gauntlets' : 'gloves';
    }
    if (slot === 'uarmf') {
        return dknown
            && (/shoes/i.test(description)
                || (typeKnown && /shoes/i.test(actualName)))
            ? 'shoes' : 'boots';
    }
    if (slot === 'uarms') {
        if (object?.otyp === SHIELD_OF_REFLECTION)
            return dknown ? 'silver shield' : 'smooth shield';
        return 'shield';
    }
    if (slot === 'uarmu') return 'shirt';
    return actualName;
}

// C ref: do_wear.c Armor_off()/off_msg().  Delayed removal calls this from
// allmain only after negative multi has reached zero; zero-delay armor can use
// the same state owner immediately.
export function finishArmorRemoval(object, { silent = false } = {}) {
    object.worn = false;
    object.wornSlot = null;
    for (const slot of [
        'uarm', 'uarmu', 'uarmc', 'uarmh', 'uarmg', 'uarmf', 'uarms',
    ]) {
        if (game[slot] === object) game[slot] = null;
        if (game.u?.[slot] === object) game.u[slot] = null;
    }
    removeArmorProperties(object, game);
    if (object.otyp === 166) { // SPEED_BOOTS
        object._grantsVeryFastFromArmor = false;
        const otherArmorSpeed = (game.inventory || []).some(candidate =>
            candidate !== object && candidate.worn
            && candidate._grantsVeryFastFromArmor);
        game.u.veryFastFromArmor = otherArmorSpeed;
        game.u.veryFast = otherArmorSpeed
            || (game.u.veryFastTurns ?? 0) > 0;
    }
    if (object.otyp === FUMBLE_BOOTS) {
        game.u.fumblingFromArmor = false;
        if (!object._fumbleBootsHadOtherSource) game.u.fumblingTurns = 0;
        game.u.fumbling = !!game.u.fumblingIntrinsic
            || (game.u.fumblingTurns ?? 0) > 0;
    }
    findArmorClass(game);
    if (silent || game.flags?.verbose === false) return '';
    const description = armorRemovalDescription(object);
    return `You were wearing ${indefiniteArticle(description)} ${description}.`;
}

// C refs: do_wear.c dotakeoff(), armor_or_accessory_off(), and cursed().
// The tty prompt advertises worn armor; eyewear remains an accepted inventory
// selection and is removed through the accessory owner.
async function dotakeoff() {
    const worn = (game.inventory || []).filter(object => object.worn);
    if (!worn.length) {
        await pline('Not wearing any armor or accessories.');
        game.context.move = 0;
        return;
    }

    let object;
    let inventoryPrompt = null;
    if (worn.length === 1) {
        [object] = worn;
    } else {
        const armorLetters = worn.filter(candidate =>
            candidate.class === 'Armor' || candidate.oclass === 3)
            .map(candidate => candidate.invlet).join('');
        const prompt = `What do you want to take off? [${armorLetters} or ?*] `;
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

    if (object.cursed) {
        object.bknown = true;
        const plural = /gloves|boots|shoes|lenses/.test(object.name || '')
            || objectQuantity(object) > 1;
        game._pending_message = '';
        await pline(`You can't.  ${plural ? 'They are' : 'It is'} cursed.`);
        game.context.move = 0;
        return;
    }

    if (object === game.ublindf) {
        game._pending_message = '';
        const removed = await removeEyewear(object);
        if (removed) game._liveQuietTurnRequested = true;
        game.context.move = removed ? 1 : 0;
        return;
    }

    const delay = OBJECT_DELAY[object.otyp] ?? 0;
    const isArmor = object.class === 'Armor' || object.oclass === 3;
    if (isArmor && delay > 0) {
        game._delayedAction = {
            kind: 'remove',
            object,
            remainingGlobalTurns: delay,
            ready: false,
            // C do_wear.c installs this as nomovemsg.  allmain.c:unmul()
            // prints it before invoking Armor_off() through afternmv.
            finishMessage: `You finish taking off your ${
                delayedArmorRemovalSimpleName(object)
            }.`,
        };
        game.context.move = 1;
        return;
    }

    const previousArmorClass = game.u?.uac ?? 10;
    const hero = game.u || {};
    const otherDisplacementSource = (game.inventory || []).some(candidate =>
        candidate !== object && candidate.worn
        && candidate.otyp === CLOAK_OF_DISPLACEMENT)
        || (hero.displacedTurns ?? 0) > 0
        || !!hero.displacedIntrinsic
        || !!hero.intrinsicDisplacement;
    const canNoticeDisplacementChange = (!game.blind
            && !hero.uswallow
            && !(game.invisible || hero.invisible || hero.invis))
        || !!(hero.unblindTelepathy || hero.blindTelepathy
            || hero.telepathy || hero.detectMonsters
            || game.detectMonsters);
    const displacementOffMessage = object.otyp === CLOAK_OF_DISPLACEMENT
        && !otherDisplacementSource
        && !(hero.displacementBlocked || hero.displacedBlocked)
        && canNoticeDisplacementChange
        ? 'You feel that monsters no longer have difficulty pinpointing your location.'
        : null;
    const removalMessage = finishArmorRemoval(object);
    if (removalMessage && game.u?.uac !== previousArmorClass)
        game._statusAcOverride = previousArmorClass;
    // do_wear.c:off_msg() is conditional on flags.verbose.  When disabled,
    // immediate zero-delay armor removal leaves getobj's selector as the
    // physical topline even though the timed state change has committed.
    game._pending_message = '';
    if (!removalMessage && game.flags?.verbose === false && inventoryPrompt)
        game._retained_message = inventoryPrompt.trimEnd();
    if (displacementOffMessage)
        await plineWithContinuation(displacementOffMessage);
    if (removalMessage)
        await plineWithContinuation(removalMessage);
    game.context.move = 1;
}

async function putOnArmorObject(object) {
    if (object.worn) {
        await pline('You are already wearing that!');
        game.context.move = 0;
        return;
    }

    const displacementWasActive = heroIsDisplaced(game);
    const slot = armorSlotFor(object.otyp) || 'uarm';
    game[slot] = object;
    if (game.u) game.u[slot] = object;
    object.worn = true;
    object.wornSlot = slot;
    if (object.otyp === CLOAK_OF_DISPLACEMENT)
        object._displacementWasActive = displacementWasActive;
    if (object.otyp === 166) { // SPEED_BOOTS
        const hero = game.u || (game.u = {});
        object._speedBootsHadOtherExtrinsic = !!hero.veryFastFromArmor;
        object._speedBootsHadTimedVeryFast
            = (hero.veryFastTurns ?? 0) > 0;
        object._speedBootsHadIntrinsicFast = !!hero.fast;
        object._grantsVeryFastFromArmor = true;
        // setworn() installs the oc_oprop immediately.  Boots_on() later
        // identifies the boots and emits feedback; movement uses Very_fast
        // during the intervening negative-multi turns.
        hero.veryFastFromArmor = true;
        hero.veryFast = true;
    }
    if (object.otyp === FUMBLE_BOOTS) {
        const hero = game.u || (game.u = {});
        object._fumbleBootsHadOtherSource = !!hero.fumbling
            && (hero.fumblingTurns ?? 0) <= 0;
        // setworn() installs the boots' extrinsic property before the
        // delayed Boots_on() callback adds its initial timeout.
        hero.fumblingFromArmor = true;
        hero.fumbling = true;
    }
    // C do_wear.c installs the slot with setworn() now, but allmain.c does
    // not run find_ac() until the command's monster/global time has passed.
    // Mark that once-per-input boundary; identification and Armor_on()
    // extrinsics remain later afternmv effects.
    const delay = OBJECT_DELAY[object.otyp] ?? 0;
    game._armorClassDirty = true;
    if (delay > 0) game._armorClassDirtyAfterDelayedFrame = true;
    if (delay > 0) {
        game._delayedAction = {
            kind: 'wear', object,
            // objects[].oc_delay advances through negative multi during
            // global-turn allocations, not through input commands.
            remainingGlobalTurns: delay,
            ready: false,
            finishMessage: 'You finish your dressing maneuver.',
        };
    } else {
        const effectMessages = applyArmorOnEffects(object, game);
        const identifiesType = armorOnIdentifiesType(object, effectMessages)
            && !game._knownObjectTypes?.has(object.otyp);
        if (identifiesType) {
            recordObjectKnowledge(object.otyp);
            exerciseAttribute(A_WIS, true);
        }
        object.known = true;
        object._armorApplied = true;
        const onMessage = `You are now wearing ${
            basePickupObjectDescription(object)
        }.`;
        for (const message of effectMessages)
            await plineWithContinuation(message);
        if (effectMessages.length)
            await plineWithContinuation(onMessage);
        else await pline(onMessage);
    }
    game.context.move = 1;
}

// C refs: wield.c:dowield(), ready_weapon(), invent.c:getobj().  The prompt
// advertises weapons and weapon-tools but still permits the full inventory
// through ?/*; '-' represents the synthetic empty-hands object.
async function dowield(cannedInvlet = null) {
    const weapons = (game.inventory || []).filter(object =>
        object.class === 'Weapons' || object.oclass === 2
        || (object.oclass === 6 && OBJECT_SUBTYPE[object.otyp] !== 0))
        .sort((left, right) =>
            String(left.invlet || '').localeCompare(
                String(right.invlet || ''),
            ));
    const letters = weapons.map(object => object.invlet).join('');
    const prompt = `What do you want to wield? [- ${
        compactInventoryLetters(letters)} or ?*] `;
    const selection = cannedInvlet === null
        ? await promptInventoryObject(
            prompt, game.inventory || [], {
                allowNone: true, allowMenu: true,
            },
        )
        : {
            cancelled: false,
            none: false,
            object: (game.inventory || []).find(candidate =>
                candidate.invlet === cannedInvlet),
        };
    if (selection.cancelled) {
        game.context.move = 0;
        return;
    }

    game._pending_message = '';
    if (selection.none) {
        if (!game.uwep) {
            await pline('You are already bare handed.');
            game.context.move = 0;
            return;
        }
        game.uwep.wielded = false;
        game.uwep = null;
        if (game.u) game.u.uwep = null;
        await pline('You are bare handed.');
        game.context.move = 1;
        return;
    }

    const object = selection.object;
    if (!object) {
        game.context.move = 0;
        return;
    }
    if (object === game.uwep) {
        await pline('You are already wielding that!');
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

    const description = inventoryItemDescription(object);
    const oldPrimary = game.uwep || game.u?.uwep || null;
    if (oldPrimary) oldPrimary.wielded = false;
    game.uwep = object;
    if (game.u) game.u.uwep = object;
    object.wielded = true;
    const hand = game.u?.rightHanded ? 'right' : 'left';
    const suffix = object.class === 'Weapons' || object.oclass === 2
        ? object.name === 'quarterstaff'
            ? 'weapon in hands' : `weapon in ${hand} hand`
        : 'wielded';
    await pline(`${object.invlet} - ${description} (${suffix}).`);
    // C dowield() applies pushweapon only after ready_weapon() has installed
    // the new primary.  The displaced primary becomes the authoritative
    // secondary object; preserving that identity is what makes a later
    // selection of it enter doswapweapon() and its two-prinv continuation.
    if (game.flags?.pushweapon && oldPrimary && oldPrimary !== object) {
        const oldSecondary = game.uswapwep || game.u?.uswapwep || null;
        if (oldSecondary && oldSecondary !== oldPrimary)
            oldSecondary.alternate = false;
        game.uswapwep = oldPrimary;
        if (game.u) game.u.uswapwep = oldPrimary;
        oldPrimary.alternate = true;
    }
    game.context.move = 1;
}

// C refs: do_wear.c dowear(), accessory_or_armor_on(), and the negative
// `multi`/afternmv completion in allmain.c.  Armor is installed in its worn
// slot immediately, but its known state and completion message are delayed
// until the required elapsed-turn scheduler round has finished.
async function dowear() {
    // do_wear.c:dowear() owns this form-capability check before getobj().
    // W therefore rejects the whole transaction without exposing either
    // armor or cross-accepted accessory inventory letters.
    if (heroIsVerySmall(game) || heroHasNoHands(game)) {
        await pline("Don't even bother.");
        game.context.move = 0;
        return;
    }

    const armor = (game.inventory || []).filter(object =>
        object.class === 'Armor' || object.oclass === 3);
    if (!armor.length) {
        await pline("You don't have anything appropriate to wear.");
        game.context.move = 0;
        return;
    }

    const letters = armor.filter(object => !object.worn)
        .map(object => object.invlet).join('');
    const choices = letters ? `${letters} or ?*` : '*';
    const selection = String.fromCharCode(await promptKey(
        `What do you want to wear? [${choices}] `,
    ));
    game._pending_message = '';
    const inventoryObject = (game.inventory || []).find(candidate =>
        candidate.invlet === selection);
    const object = armor.find(candidate => candidate === inventoryObject);
    if (object) {
        await putOnArmorObject(object);
        return;
    }
    const accessory = inventoryObject
        && (inventoryObject.class === 'Rings' || inventoryObject.oclass === 4
            || inventoryObject.class === 'Amulets'
            || inventoryObject.oclass === 5
            || inventoryObject.otyp === RIN_CONFLICT
            || inventoryObject.otyp === BLINDFOLD
            || inventoryObject.otyp === TOWEL)
        ? inventoryObject : null;
    if (!accessory) {
        game.context.move = 0;
        return;
    }
    await putOnAccessoryObject(accessory);
}

// C refs: shk.c:dopay(), menu_pick_pay_items(), pay(), and update_bill().
// The menu is a zero-time nested input transaction until at least one billed
// object is actually purchased; payment then owns one elapsed hero action.
async function dopay() {
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

    const billed = carriedShopBill(resident);
    if (!billed.length) {
        await pline(`You do not owe ${resident.eshk?.shknam || 'the shopkeeper'} anything.`);
        game.context.move = 0;
        return;
    }

    const sections = [{
        heading: '',
        items: billed.map((item, index) => ({
            key: String.fromCharCode(97 + index),
            text: `${item.price} Zm, ${basePickupObjectDescription(item.object)}`,
            value: item,
        })),
    }];
    game._pending_message = '';
    await flush_screen(1);
    const selected = await showMultiSelectWindow({
        title: 'Pay for which items?', sections, left: 41,
        omitHeadings: true,
    });
    if (!selected.length) {
        game.context.move = 0;
        return;
    }

    let paid = false;
    for (const item of selected) {
        if (!settleCarriedShopBillItem(resident, item)) continue;
        paid = true;
        await pline(`You bought ${basePickupObjectDescription(item.object)} for ${item.price} gold piece${item.price === 1 ? '' : 's'}.`);
    }
    if (!paid) {
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
async function doforcefight() {
    game._pending_message = '';
    // The direction read is its own tty input boundary.  C clears the old
    // message window before collecting that key, so make the cleared row
    // visible before nhgetch() captures the nested prompt screen.
    await flush_screen(1);
    const direction = String.fromCharCode(await nhgetch()).toLowerCase();
    if (!isMovementKey(direction)) {
        await pline(
            "The 'F' prefix should be followed by a movement command.",
        );
        game.context.move = 0;
        return;
    }
    game.context.forcefight = true;
    try {
        const moved = await domove(
            DIR_DX[direction], DIR_DY[direction], true,
        );
        game.context.move = moved ? 1 : 0;
    } finally {
        game.context.forcefight = false;
    }
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
        ? (Number.isInteger(object.enchantment)
            ? object.enchantment
            : Number.isInteger(object.spe) ? object.spe : null)
        : null;
    const bonus = enchantment === null ? ''
        : `${enchantment >= 0 ? '+' : ''}${enchantment}`;
    const name = quantity > 1 ? object.plural || `${object.name}s` : object.name;
    const core = [buc, bonus, name].filter(Boolean).join(' ');
    return quantity > 1 ? `${quantity} ${core}`
        : `${indefiniteArticle(core)} ${core}`;
}

function compactInventoryLetters(letters) {
    // invent.c:getobj() compacts only prompts with more than five suggested
    // objects, then replaces every run of at least three inventory letters.
    if (letters.length <= 5) return letters;
    let compact = '';
    for (let start = 0; start < letters.length;) {
        let end = start;
        while (end + 1 < letters.length
            && letters.charCodeAt(end + 1) === letters.charCodeAt(end) + 1) {
            end++;
        }
        const length = end - start + 1;
        compact += length >= 3
            ? `${letters[start]}-${letters[end]}`
            : letters.slice(start, end + 1);
        start = end + 1;
    }
    return compact;
}

// C invent.c:getobj() result topology shared by inventory-line callers.
// Escape/blank cancel with prose; a byte which names no carried object owns a
// pager and retry without escaping to top-level command dispatch.
async function promptInventoryObject(prompt, eligible, {
    allowGold = false, allowNone = false, allowMenu = false,
    allowCount = false, retainPromptOnCancel = false,
} = {}) {
    let key = await promptKey(prompt);
    let count = null;
    for (;;) {
        if (allowCount && key >= 48 && key <= 57) {
            let digits = '';
            do {
                digits += String.fromCharCode(key);
                key = await nhgetch();
            } while (key >= 48 && key <= 57);
            const parsed = Number.parseInt(digits, 10);
            count = parsed > 0 ? parsed : null;
        }
        const cancelled = key === 27 || key === 32
            || (retainPromptOnCancel && (key === 10 || key === 13));
        if (cancelled) {
            if (!retainPromptOnCancel) await pline('Never mind.');
            return {
                cancelled: true, object: null, gold: false, none: false,
                count: null,
            };
        }
        if (allowMenu && (key === 63 || key === 42)) {
            key = await selectInventoryObject({
                items: eligible, includeGold: allowGold, loopUntilValid: true,
            });
            continue;
        }
        const letter = String.fromCharCode(key);
        const object = eligible.find(candidate => candidate.invlet === letter);
        if (object) {
            const quantity = object.quantity ?? object.quan ?? 1;
            if (count !== null && count > quantity) {
                await pline(
                    `You don't have that many!  You have only ${quantity}.`,
                );
                key = await promptKey(prompt);
                count = null;
                continue;
            }
            return {
                cancelled: false, object, gold: false, none: false, count,
            };
        }
        if (allowNone && letter === '-') return {
            cancelled: false, object: null, gold: false, none: true, count,
        };
        if (allowGold && letter === '$' && heroGoldAmount(game) > 0)
            return {
                cancelled: false, object: null, gold: true, none: false,
                count,
            };

        const invalid = "You don't have that object.--More--";
        await pline(invalid);
        await flush_screen(1);
        game.nhDisplay?.setCursor(invalid.length, 0);
        do key = await nhgetch();
        while (key !== 27 && key !== 32 && key !== 10 && key !== 13);

        await pline(prompt);
        await flush_screen(1);
        game.nhDisplay?.setCursor(prompt.length, 0);
        key = await nhgetch();
        count = null;
    }
}

async function dodrop() {
    const inventory = game.inventory || [];
    const walletGold = heroGoldAmount(game);
    if (!inventory.length && !walletGold) {
        await pline("You don't have anything to drop.");
        game.context.move = 0;
        return;
    }
    const letters = inventory
        .filter(object => object.otyp !== GOLD_PIECE && object.oclass !== 12)
        .map(object => object.invlet).join('');
    const prompt = `What do you want to drop? [${walletGold ? '$' : ''}${compactInventoryLetters(letters)} or ?*] `;
    const selection = await promptInventoryObject(prompt, inventory, {
        allowGold: true,
    });
    if (selection.cancelled) {
        game.context.move = 0;
        return;
    }
    game._pending_message = '';
    const selectedGold = selection.gold
        || selection.object?.otyp === GOLD_PIECE
        || selection.object?.oclass === 12;
    if (selectedGold && walletGold) {
        const gold = detachHeroGold(game);
        gold.ox = game.u.ux;
        gold.oy = game.u.uy;
        gold.where = 'floor';
        game._fobjSerial = (game._fobjSerial || 0) + 1;
        gold._fobjOrder = game._fobjSerial;
        if (!game.level.objects[gold.ox]) game.level.objects[gold.ox] = [];
        if (!game.level.objects[gold.ox][gold.oy])
            game.level.objects[gold.ox][gold.oy] = [];
        game.level.objects[gold.ox][gold.oy].unshift(gold);
        newsym(gold.ox, gold.oy);
        // C do.c:drop() suppresses the ordinary floor-drop line when
        // `!verbose`.  The inventory prompt has already been cleared, so
        // retaining synthetic prose here can incorrectly fill tty's topline
        // and suspend the following monster transaction at --More--.
        if (game.flags?.verbose !== false)
            await pline(`You drop ${walletGold} gold pieces.`);
        game.context.move = 1;
        return;
    }
    const { object } = selection;

    game.inventory = inventory.filter(candidate => candidate !== object);
    for (const slot of [
        'uwep', 'uswapwep', 'uquiver', 'uarm', 'uarmu', 'uarmc', 'uarmh',
        'uarmg', 'uarmf', 'uarms', 'uleft', 'uright', 'uamul', 'ublindf',
    ]) {
        if (game[slot] === object) game[slot] = null;
        if (game.u?.[slot] === object) game.u[slot] = null;
    }
    object.worn = false;
    object.wornSlot = null;
    // C dropx()->place_object() changes object ownership before map
    // projection.  Timed identities must no longer look carried after they
    // enter the floor chain; their existing timer remains attached.
    place_object(object, game.u.ux, game.u.uy);
    newsym(object.ox, object.oy);
    if (game.flags?.verbose !== false)
        await pline(`You drop ${droppedObjectDescription(object)}.`);
    game.context.move = 1;
}

function floorObjectDescription(object) {
    // C objnam.c:doname()/xname() use the startup-shuffled description until
    // the object's type has been identified. Looking at an object underfoot
    // makes its description known but does not identify its type.
    const appearance = game.objectDescriptions?.[object.otyp]
        ?? OBJECT_DESCRIPTIONS[object.otyp];
    // oc_name_known is global per object type.  A newly generated object
    // inherits knowledge from an identified starting copy or a pre-known
    // discovery; it is not an instance-local `known` bit.
    const typeKnown = objectTypeKnown(object);
    object.dknown = true;
    recordObjectEncounter(object.otyp);
    observeBucForNaming(object);
    if (object === game.uball || object === game.u?.uball
        || object.oclass === BALL_CLASS) {
        const baseWeight = OBJECT_WEIGHT[object.otyp] ?? 480;
        const noun = `${(object.owt ?? baseWeight) > baseWeight ? 'very ' : ''}`
            + 'heavy iron ball';
        const attachment = (object.owornmask & W_BALL)
            ? ' (chained to you)' : '';
        return `${indefiniteArticle(noun)} ${noun}${attachment}`;
    }
    if (object === game.uchain || object === game.u?.uchain
        || object.oclass === CHAIN_CLASS) {
        const attachment = (object.owornmask & W_CHAIN)
            ? ' (attached to you)' : '';
        return `an iron chain${attachment}`;
    }
    if (object.otyp === CORPSE) {
        const species = MONSTER_NAME[object.corpsenm];
        const corpseName = object.name || (species ? `${species} corpse` : 'corpse');
        return `${indefiniteArticle(corpseName)} ${corpseName}`;
    }
    if (object.otyp === LARGE_BOX || object.otyp === CHEST) {
        const noun = object.otyp === LARGE_BOX ? 'large box' : 'chest';
        const lockState = object.lknown
            ? (object.obroken ? 'broken ' : object.olocked ? 'locked ' : 'unlocked ')
            : '';
        const description = `${lockState}${noun}`;
        return `${indefiniteArticle(description)} ${description}`;
    }
    if (object.otyp === ICE_BOX) return 'an ice box';
    if (object.otyp === SACK) return 'a bag';
    if (object.otyp === OIL_LAMP) return 'a lamp';
    if (object.otyp === STATUE) {
        const monsterName = MONSTER_NAME[object.corpsenm] || 'monster';
        return `a statue of ${indefiniteArticle(monsterName)} ${monsterName}`;
    }
    if (object.otyp === BOULDER) return 'a boulder';
    if (object.oclass === 4 || object.class === 'Rings') {
        const noun = typeKnown && object.name
            ? object.name : `${appearance || 'unknown'} ring`;
        return `${indefiniteArticle(noun)} ${noun}`;
    }
    if (object.oclass === 5 || object.class === 'Amulets') {
        const noun = typeKnown && object.name
            ? object.name : `${appearance || 'unknown'} amulet`;
        return `${indefiniteArticle(noun)} ${noun}`;
    }
    if (object.oclass === 11) {
        const noun = typeKnown
            ? `wand of ${OBJECT_NAMES[object.otyp] || 'unknown'}`
            : `${appearance || 'unknown'} wand`;
        return `${indefiniteArticle(noun)} ${noun}`;
    }
    if (object.otyp === DART) {
        const quantity = objectQuantity(object);
        if (quantity > 1) return `${quantity} darts`;
        return object.opoisoned ? 'a poisoned dart' : 'a dart';
    }
    if (object.oclass === 2) {
        // objnam.c:xname_flags(), WEAPON_CLASS.  Observing this particular
        // copy sets dknown, but the canonical noun is still gated by the
        // type-wide oc_name_known bit.  Appearance-sharing weapons such as
        // an orcish dagger therefore remain "crude dagger" until identified.
        const noun = typeKnown
            ? (OBJECT_NAMES[object.otyp] || 'weapon')
            : (appearance || OBJECT_NAMES[object.otyp] || 'weapon');
        const quantity = objectQuantity(object);
        const enchantment = object.known && Number.isInteger(object.spe)
            ? `${object.spe >= 0 ? '+' : ''}${object.spe} ` : '';
        const described = `${enchantment}${noun}`;
        if (quantity > 1)
            return `${quantity} ${enchantment}${object.plural || `${noun}s`}`;
        return `${indefiniteArticle(described)} ${described}`;
    }
    if (object.oclass === 3) {
        // Armor without a shuffled description is known by its ordinary
        // object noun even when this individual instance has no presentation
        // fields yet.  Shuffled armor retains the appearance until its type
        // is globally discovered.
        const noun = typeKnown || !appearance
            ? (OBJECT_NAMES[object.otyp] || object.name || 'armor')
            : appearance;
        if (/gloves|boots|shoes/.test(noun)) return `a pair of ${noun}`;
        return `${indefiniteArticle(noun)} ${noun}`;
    }
    if (object.otyp === GOLD_PIECE) {
        const quantity = objectQuantity(object);
        return `${quantity} gold piece${quantity === 1 ? '' : 's'}`;
    }
    if (object.oclass === 8) {
        const noun = typeKnown
            ? `potion of ${OBJECT_NAMES[object.otyp] || 'unknown'}`
            : `${appearance || 'unknown'} potion`;
        return `${indefiniteArticle(noun)} ${noun}`;
    }
    if (object.oclass === 9) {
        const noun = typeKnown
            ? `scroll of ${OBJECT_NAMES[object.otyp] || 'unknown'}`
            : appearance === 'unlabeled' ? 'unlabeled scroll'
                : `scroll labeled ${appearance || 'unknown'}`;
        return `${indefiniteArticle(noun)} ${noun}`;
    }
    if (object.oclass === 10) {
        const noun = typeKnown
            ? `spellbook of ${OBJECT_NAMES[object.otyp] || 'unknown'}`
            : `${appearance || 'unknown'} spellbook`;
        return `${indefiniteArticle(noun)} ${noun}`;
    }
    if (object.oclass === 6 || object.class === 'Tools') {
        const noun = typeKnown
            ? (OBJECT_NAMES[object.otyp] || object.name || 'tool')
            : (appearance || object.name || 'tool');
        return `${indefiniteArticle(noun)} ${noun}`;
    }
    if (object.oclass === 7) {
        // Instance data on a generated tin may record its hidden contents
        // (for example "tin of lichen") before doname() may disclose them.
        const noun = OBJECT_NAMES[object.otyp] || object.name || 'food';
        const quantity = objectQuantity(object);
        const buc = bucAdjectiveForName(object);
        const described = [buc, noun].filter(Boolean).join(' ');
        return quantity > 1
            ? `${quantity} ${buc ? `${buc} ` : ''}${
                object.plural || `${noun}s`
            }`
            : `${indefiniteArticle(described)} ${described}`;
    }
    if (object.oclass === 13 || (object.otyp >= 438 && object.otyp <= 474)) {
        const noun = typeKnown && object.name
            ? object.name : `${appearance || 'unknown'} gem`;
        const quantity = objectQuantity(object);
        return quantity > 1 ? `${quantity} ${noun}s`
            : `${indefiniteArticle(noun)} ${noun}`;
    }
    if (object.name) return `${indefiniteArticle(object.name)} ${object.name}`;
    return 'an object';
}

function pricedFloorObjectDescription(object) {
    const description = floorObjectDescription(object);
    const { price, noCharge } = getCostOfShopItem(object);
    if (price > 0) {
        return `${description} (for sale, ${price} zorkmid${price === 1 ? '' : 's'})`;
    }
    return noCharge > 0 ? `${description} (no charge)` : description;
}

async function showFloorPile(
    objects, pickedSome = false, featureDescription = '',
) {
    if (objects.length < 2) return;
    // invent.c:look_here() receives the already-counted pile from
    // pickup.c:check_here(). At the configurable threshold (default five)
    // it leaves the command non-modal and emits only a topline count so
    // destination traps and engravings can continue in the same action.
    const configuredLimit = Number(game.flags?.pile_limit ?? 5);
    const pileLimit = Number.isFinite(configuredLimit) && configuredLimit >= 0
        ? Math.trunc(configuredLimit) : 5;
    if (pileLimit > 0 && objects.length >= pileLimit) {
        if (featureDescription)
            await plineWithContinuation(featureDescription);
        const quantity = objects.length === 2 ? 'two'
            : objects.length < 5 ? 'a few'
                : objects.length < 10 ? 'several' : 'many';
        await plineWithContinuation(
            `There are ${quantity}${pickedSome ? ' more' : ''} objects here.`,
        );
        return;
    }
    if (game._pending_message) {
        const more = `${game._pending_message}--More--`;
        await pline(more);
        await flush_screen(1);
        game.nhDisplay?.setCursor(Math.min(79, more.length), 0);
        let key;
        do key = await nhgetch();
        while (key !== 27 && key !== 32 && key !== 10 && key !== 13);
    }
    game._pending_message = '';
    await flush_screen(1);
    const display = game.nhDisplay;
    const pileLocation = game.blind ? 'you feel here' : 'are here';
    const lines = [
        ...(featureDescription ? [featureDescription, ''] : []),
        `${pickedSome ? 'Other things' : 'Things'} that ${pileLocation}:`,
        ...objects.map(pricedFloorObjectDescription),
        '--More--',
    ];
    // Tty menus leave one blank column after the widest line and align the
    // window to the right.
    const left = Math.max(0, Math.min(41,
        display.cols - Math.max(...lines.map(line => line.length)) - 1));
    for (let row = 0; row < lines.length; row++) {
        for (let col = Math.max(0, left - 1); col < display.cols; col++)
            display.setCell(col, row, ' ', NO_COLOR, 0);
        for (let col = 0; col < lines[row].length; col++)
            display.setCell(left + col, row, lines[row][col], NO_COLOR, 0);
    }
    display.setCursor(left + 8, lines.length - 1);
    // tty's temporary PICK_NONE pile window ignores ordinary command bytes;
    // only a menu-dismissal key destroys it and returns that input boundary
    // to the command loop.
    let key;
    do key = await nhgetch();
    while (![27, 32, 10, 13].includes(key));
}

async function finishTeleportArrival(movement) {
    newsym(movement.oldx, movement.oldy);
    vision_reset();
    vision_recalc(0);
    newsym(movement.x, movement.y);
    await docrt();
    await bot();
    if (game.flags?.verbose !== false) {
        const place = movement.oldx === movement.x
            && movement.oldy === movement.y ? 'the same' : 'a different';
        await plineWithContinuation(`You materialize in ${place} location!`);
    }
    await finishDestinationSpotEffects({
        ...movement,
        newx: movement.x,
        newy: movement.y,
        loc: game.level?.at?.(movement.x, movement.y),
        explicitAttempt: false,
    });
}


const G_UNIQ = 0x1000;
// C refs: apply.c use_stethoscope(); insight.c piousness().  hero_seq is
// distinct after every time-taking hero action, including actions which do
// not advance the global `moves` counter because the hero has movement left.
function stethoscopePiousness() {
    const record = game.u?.ualign?.record ?? 0;
    if (record >= 20) return 'piously';
    if (record > 13) return 'devoutly';
    if (record > 8) return 'fervently';
    if (record > 3) return 'stridently';
    if (record === 3) return '';
    if (record > 0) return 'haltingly';
    if (record === 0) return 'nominally';
    if (record >= -3) return 'strayed';
    if (record >= -8) return 'sinned';
    return 'transgressed';
}

function stethoscopeAlignment() {
    const alignment = game.u?.ualign?.type ?? 0;
    return alignment > 0 ? 'lawful' : alignment < 0 ? 'chaotic' : 'neutral';
}

function monsterStatusLine(monster) {
    const monsterName = MONSTER_NAME[monster.mnum] || 'monster';
    const alignment = MONSTER_ALIGNMENT[monster.mnum] ?? 0;
    const alignmentName = alignment === -128 ? 'unaligned'
        : alignment > 0 ? 'lawful' : alignment < 0 ? 'chaotic' : 'neutral';
    const sizeName = ({
        0: 'tiny', 1: 'small', 2: 'medium', 3: 'large',
        4: 'huge', 7: 'gigantic',
    })[MONSTER_SIZE[monster.mnum]] || 'unknown size';
    const article = monster.mtame ? 'your' : 'the';
    const conditions = [];
    if (monster.mtame) conditions.push('tame');
    else if (monster.mpeaceful) conditions.push('peaceful');
    if (monster.mcan) conditions.push('cancelled');
    if (monster.mconf) conditions.push('confused');
    if (monster.mblinded || monster.mcansee === 0) conditions.push('blind');
    if (monster.mstun) conditions.push('stunned');
    if (monster.msleeping) conditions.push('asleep');
    else if (monster.mcanmove === 0) conditions.push("can't move");
    if (monster.mflee) conditions.push('scared');
    if (monster.mtrapped) conditions.push('trapped');
    if (monster.minvis) conditions.push('invisible');
    const conditionText = conditions.length ? `, ${conditions.join(', ')}` : '';
    const armorClass = monster.ac
        ?? MONSTER_EXPERIENCE_META[monster.mnum]?.[0] ?? 10;
    return `Status of ${article} ${monsterName} (${alignmentName}, ${sizeName}):  Level ${monster.m_lev ?? 0}  HP ${monster.mhp}(${monster.mhpmax})  AC ${armorClass}${conditionText}.`;
}

async function useStethoscope(item) {
    const direction = String.fromCharCode(
        await promptKey('In what direction? '),
    ).toLowerCase();
    // getdir() clears its direction query before use_stethoscope() publishes
    // either an empty-square response or the potentially wrapping status.
    game._pending_message = '';
    if (!isMovementKey(direction) && direction !== '.') {
        game.context.move = 0;
        return;
    }

    const heroActionSeq = game._heroActionSeq ?? 0;
    const usedTime = game._stethoscopeSeq === heroActionSeq;
    game._stethoscopeSeq = heroActionSeq;

    if (direction === '.') {
        const piousness = stethoscopePiousness();
        const alignment = stethoscopeAlignment();
        const devotion = `${piousness}${piousness ? ' ' : ''}${alignment}`;
        await pline(`Status of ${game.plname || 'you'} (${devotion}):  Level ${game.u?.ulevel || 1}  HP ${game.u?.uhp}(${game.u?.uhpmax})  AC ${game.u?.uac}.`);
        game.context.move = usedTime ? 1 : 0;
        return;
    }

    const x = game.u.ux + DIR_DX[direction];
    const y = game.u.uy + DIR_DY[direction];
    const monster = game.level?.monsters?.find(candidate =>
        (candidate.mhp ?? 1) > 0 && candidate.mx === x && candidate.my === y);
    if (monster?.m_ap_type) {
        const appearance = monster.m_ap_type === M_AP_OBJECT
            ? (OBJECT_NAMES[monster.mappearance] || 'thing') : 'thing';
        const monsterName = MONSTER_NAME[monster.mnum] || 'monster';
        monster.m_ap_type = 0;
        monster.mappearance = 0;
        newsym(x, y);
        await pline(`That ${appearance} is really ${indefiniteArticle(monsterName)} ${monsterName}.`);
        await plineWithContinuation(monsterStatusLine(monster));
    } else if (!monster) {
        await pline('You hear nothing special.');
    } else {
        await plineWithContinuation(monsterStatusLine(monster));
    }

    game.context.move = usedTime ? 1 : 0;
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
    const key = await promptKey('In what direction? ');
    const direction = String.fromCharCode(key).toLowerCase();
    game._pending_message = '';
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
async function doopen() {
    if (heroHasNoHands(game)) {
        await pline("You can't open anything -- you have no hands!");
        game.context.move = 0;
        return;
    }
    const key = await promptKey('In what direction? ');
    const direction = String.fromCharCode(key).toLowerCase();
    game._pending_message = '';
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
        await pline('This door is locked.');
        game.context.move = 0;
        return;
    }

    if (rnl(20) < Math.trunc((currentAttribute(A_STR)
        + (game.u?.acurr?.a?.[A_DEX] ?? 10)
        + (game.u?.acurr?.a?.[A_CON] ?? 10)) / 3)) {
        loc.doormask = D_ISOPEN;
        newsym(x, y);
        vision_reset();
        vision_recalc(0);
        await pline('The door opens.');
    } else {
        await pline('The door resists!');
    }
    game.context.move = 1;
}

// C refs: write.c dowrite()/write_ok(); invent.c getobj().  The object picker
// retains ownership after an absent inventory letter and reopens the same
// prompt once its More boundary is dismissed.
async function useMagicMarker() {
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

function lampXname(object) {
    if (object?.otyp === BRASS_LANTERN) return 'brass lantern';
    const typeKnown = object?.typeKnown
        || game._knownObjectTypes?.has(object?.otyp);
    if (!typeKnown) return 'lamp';
    return object?.otyp === MAGIC_LAMP ? 'magic lamp' : 'oil lamp';
}

// C ref: apply.c:use_lamp().  Lamps share command presentation, but magic
// lamps keep permanent untimed light while their djinni charge remains.
// Candles and their non-equivalent quantity/flame lifecycle remain separate.
async function useLamp(object) {
    const lamp = object.otyp === BRASS_LANTERN ? 'lantern' : 'lamp';
    if (object.lamplit) {
        await pline(`Your ${lamp} is now off.`);
        endObjectBurn(object, game, game.moves ?? 0);
        game.context.move = 1;
        return;
    }

    if (game.underwater || game.u?.uinwater) {
        await pline('This is not a diving lamp.');
        game.context.move = 1;
        return;
    }

    if ((object.age ?? 0) === 0
        || (object.otyp === MAGIC_LAMP && (object.spe ?? 0) === 0)) {
        if (object.otyp === BRASS_LANTERN) {
            await pline(heroIsBlind(game)
                ? 'Nothing seems to happen.'
                : 'Your lantern is out of power.');
        } else {
            await pline(`This ${lampXname(object)} has no oil.`);
        }
        game.context.move = 1;
        return;
    }

    if (object.cursed && rn2(2) === 0) {
        if ([OIL_LAMP, MAGIC_LAMP].includes(object.otyp)
            && rn2(3) === 0) {
            const fingers = (game.uarmg || game.u?.uarmg)
                ? 'gloves' : 'fingers';
            await pline(
                `The lamp spills and covers your ${fingers} with oil.`,
            );
            game.u.glibTurns = (game.u.glibTurns ?? 0) + d(2, 10);
        } else if (!heroIsBlind(game)) {
            await pline(
                `The ${lampXname(object)} flickers for a moment, then dies.`,
            );
        } else {
            await pline('Nothing seems to happen.');
        }
        game.context.move = 1;
        return;
    }

    const usageFee = await chargeUnpaidLampUse(object, game);
    if (usageFee?.message)
        await plineWithContinuation(`Your ${lamp} is now on.`);
    else await pline(`Your ${lamp} is now on.`);
    beginObjectBurn(object, game, game.moves ?? 0);
    game.context.move = 1;
}

async function doapply(cannedInvlet = null) {
    // apply.c:doapply() rejects the current body and excessive load before
    // building the applicable-object set or exposing getobj().
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

    const applicable = (game.inventory || []).filter(item => item.oclass === 6
        || item.oclass === 10 || item.oclass === 11
        || item.otyp === 72 || item.otyp === BULLWHIP
        || [CREAM_PIE, LUMP_OF_ROYAL_JELLY].includes(item.otyp)
        || game.urole?.key === 'healer' && [10, 11].includes(item.oclass));
    if (!applicable.length) {
        await pline("You don't have anything to use or apply.");
        game.context.move = 0;
        return;
    }
    const letters = compactInventoryLetters(
        applicable.map(item => item.invlet).join(''),
    );
    const prompt = `What do you want to use or apply? [${letters} or ?*] `;
    const underlay = snapshotMenuUnderlay();
    let key = cannedInvlet === null
        ? await promptKey(prompt) : cannedInvlet.charCodeAt(0);

    for (;;) {
        if ([27, 32, 10, 13].includes(key)) {
            await pline('Never mind.');
            game.context.move = 0;
            return;
        }
        if (key === 63 || key === 42) {
            key = await selectInventoryObject({
                items: applicable, includeGold: false, loopUntilValid: true,
            });
            continue;
        }
        const item = applicable.find(candidate => candidate.invlet
            === String.fromCharCode(key));
        if (item) {
            if (item.otyp === BULLWHIP) {
                const wielded = await wieldTool(
                    item,
                    'lash',
                    { swapWeapons: doswapweapon },
                    game,
                );
                if (!wielded.ready) {
                    game.context.move = 0;
                    return;
                }
                if (wielded.newlyWielded) {
                    game._cannedCommands ||= [];
                    game._cannedCommands.push({
                        kind: 'apply', invlet: item.invlet,
                    });
                    game.context.move = 1;
                    return;
                }
                const direction = await getAdjacentLocation(
                    'In what direction?', null, game.u.ux, game.u.uy,
                );
                if (!direction) return;
                game._pending_message = '';
                const result = await useBullwhip(item, direction, {
                    state: game,
                    attackMonster: monster => attackHostileMonster(
                        monster, monster.mx, monster.my,
                    ),
                    holdObject: object => {
                        preparePickedInventoryObject(object);
                        game._capacityDirty = true;
                        return true;
                    },
                });
                game.context.move = result.spentTime ? 1 : 0;
                return;
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
                    holdObject: async object => {
                        const prepared = preparePickedInventoryObject(object);
                        game._capacityDirty = true;
                        await plineWithContinuation(prepared.message);
                        return true;
                    },
                    hurtle: (dx, dy) => hurtleHero(dx, dy, 1, {
                        finishTeleport: finishTeleportArrival,
                        gotoLevel,
                        chooseTeleportDestination: askTeleportDestination,
                        finishPetrifiedMonster: monster =>
                            finishHeroMonsterKill(
                                monster, monster.mx, monster.my, {
                                    showKillMessage: false,
                                    noCorpse: true,
                                    recordConduct: false,
                                },
                            ),
                    }),
                });
                if (result.resume) {
                    game._cannedCommands ||= [];
                    game._cannedCommands.push({
                        kind: 'apply', invlet: item.invlet,
                    });
                }
                game.context.move = result.spentTime ? 1 : 0;
                return;
            }
            if ([BLINDFOLD, LENSES].includes(item.otyp)) {
                game._pending_message = '';
                const changed = await applyEyewear(item);
                if (changed) game._liveQuietTurnRequested = true;
                game.context.move = 1;
                return;
            }
            if ([OIL_LAMP, BRASS_LANTERN, MAGIC_LAMP].includes(item.otyp)) {
                await useLamp(item);
                return;
            }
            if (isContainer(item)) {
                const result = await useContainer(item, {
                    held: true,
                    underlay,
                });
                game.context.move = result.spentTime ? 1 : 0;
                return;
            }
            if (item.otyp === STETHOSCOPE) {
                await useStethoscope(item);
                return;
            }
            if (item.otyp === MAGIC_MARKER) {
                await useMagicMarker();
                return;
            }
            if (PLAYABLE_INSTRUMENTS.has(item.otyp)) {
                game._pending_message = '';
                game._retained_message = '';
                await playInstrument(item, {
                    finishMonsterKill: finishHeroMonsterKill,
                });
                return;
            }
            if (item.otyp === CREAM_PIE) {
                game._pending_message = '';
                await useCreamPie(item);
                game.context.move = 0;
                return;
            }
            if (isRoyalJelly(item)) {
                await rubRoyalJelly(item);
                return;
            }
            if ([SKELETON_KEY, LOCK_PICK, CREDIT_CARD].includes(item.otyp)) {
                const direction = await promptKey('In what direction? ');
                const directionKey = String.fromCharCode(direction).toLowerCase();
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
                return;
            }
            await pline("Sorry, I don't know how to use that.");
            game.context.move = 0;
            return;
        }

        if (cannedInvlet !== null) {
            game.context.move = 0;
            return;
        }

        if ((game.inventory || []).some(candidate => candidate.invlet
            === String.fromCharCode(key))) {
            await pline("Sorry, I don't know how to use that.");
            game.context.move = 0;
            return;
        }

        const invalid = "You don't have that object.--More--";
        await pline(invalid);
        await flush_screen(1);
        game.nhDisplay?.setCursor(invalid.length, 0);
        do {
            key = await nhgetch();
        } while (key !== 27 && key !== 32);

        await pline(prompt);
        await flush_screen(1);
        game.nhDisplay?.setCursor(prompt.length, 0);
        key = await nhgetch();
    }
}

// C refs: dowieldquiver(), doquiver_core().  Q and empty-quiver fire share
// one live inventory transaction; neither role nor recorded input selects a
// different readiness implementation.
async function doready() {
    await doquiverCore('ready');
}

function splitStackForQuiver(item, count) {
    const quantity = item.quantity ?? item.quan ?? 1;
    const selected = Math.max(1, Math.min(count, quantity - 1));
    const unitWeight = OBJECT_WEIGHT[item.otyp]
        ?? Math.max(1, Math.trunc((item.owt ?? 1) / quantity));
    item.quantity = item.quan = quantity - selected;
    item.owt = unitWeight * item.quantity;
    const child = {
        ...item,
        o_id: nextIdent(),
        invlet: null,
        quantity: selected,
        quan: selected,
        owt: unitWeight * selected,
        owornmask: 0,
        worn: false,
        wielded: false,
        alternate: false,
        ready: false,
        where: 'inventory',
    };
    assignInventoryLetter(child);
    if (!child.invlet) child.invlet = '#';
    game.inventory.push(child);
    return child;
}

function isWeldedPrimary(item) {
    if (item !== game.uwep || !item?.cursed) return false;
    const objectClass = item.oclass || objectClassForType(item.otyp);
    const weaponTool = objectClass === 6
        && (OBJECT_SUBTYPE[item.otyp] ?? 0) !== 0;
    return objectClass === 2 || weaponTool
        || [HEAVY_IRON_BALL, IRON_CHAIN, TIN_OPENER].includes(item.otyp);
}

function splittableForQuiver(item) {
    return !(item?.otyp === LOADSTONE && item.cursed)
        && !isWeldedPrimary(item);
}

function hasFreeBasicInventoryLetter() {
    const basicLetters = new Set((game.inventory || [])
        .map(item => item.invlet)
        .filter(letter => /^[a-zA-Z]$/.test(letter || '')));
    return basicLetters.size < 52;
}

async function doquiverCore(verb) {
    // Legacy saves and older harnesses may still carry only the compatibility
    // amount.  A mutating inventory command materializes its source identity.
    ensureHeroGoldObject(game);
    if (!(game.inventory || []).length) {
        await pline('You have nothing to ready for firing.');
        game.context.move = 0;
        return { item: null, spentTime: false, cancelled: false };
    }
    const letters = (game.inventory || [])
        .filter(item => readySuggestion(item, game))
        .map(item => item.invlet)
        .join('');
    const prompt = `What do you want to ${verb}? [- ${
        compactInventoryLetters(letters)} or ?*] `;
    const selection = await promptInventoryObject(
        prompt, game.inventory || [], {
            allowNone: true, allowMenu: true, allowCount: true,
        },
    );
    if (selection.cancelled) {
        game.context.move = 0;
        return { item: null, spentTime: false, cancelled: true };
    }
    if (selection.none) {
        if (game.uquiver) {
            await pline('You now have no ammunition readied.');
            setQuiverObject(null, game);
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
        const wasKnown = !!item.bknown;
        item.bknown = true;
        const hand = item.bimanual ? 'hands' : 'hand';
        await pline(`${inventoryItemDescription(item)} is welded to your ${hand}!`);
        game.context.move = wasKnown ? 0 : 1;
        return {
            item: null, spentTime: !wasKnown, cancelled: false,
        };
    }

    const requestedCount = selection.count;
    const initialQuantity = item.quantity ?? item.quan ?? 1;
    const partialCount = requestedCount !== null
        && requestedCount < initialQuantity;
    if (item === game.uquiver) {
        // getobj() performs the requested split before doquiver_core notices
        // that its parent is already quivered; unsplitobj() restores the
        // stack, but the child identity draw remains observable.
        if (partialCount && splittableForQuiver(item)) nextIdent();
        await pline('That ammunition is already readied!');
        game.context.move = 0;
        return { item, spentTime: false, cancelled: false };
    }
    const selectedClass = item.oclass || objectClassForType(item.otyp);
    if (partialCount && selectedClass === 12) {
        // Gold is split by getobj(), then immediately unsplit because the
        // quiver may not hold only part of the purse.
        nextIdent();
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
        let readyAll = true;
        if (quantity > 1 && hasFreeBasicInventoryLetter()
            && splittableForQuiver(item)) {
            const plural = item.plural || makePlural(item.name || 'object');
            const slotDescription = primary
                ? `You are wielding ${quantity} ${plural}.`
                : `${wasTwoweap ? 'You are dual wielding'
                    : 'Your alternate weapon is'} ${quantity} ${plural}.`;
            const partial = await promptYesNoQuit(
                `${slotDescription}  Ready ${quantity - 1} of them? [ynq] (q) `,
            );
            if (partial === 'q') {
                game.context.move = 0;
                return { item: null, spentTime: false, cancelled: false };
            }
            if (partial === 'y') {
                item = splitStackForQuiver(item, quantity - 1);
                readyAll = false;
            }
        }
        if (readyAll) {
            const answer = await promptYesNoQuit(
                `Ready ${quantity > 1 ? 'all of them' : 'it'} instead? [ynq] (q) `,
            );
            if (answer !== 'y') {
                game.context.move = 0;
                return { item: null, spentTime: false, cancelled: false };
            }
            if (primary) {
                game.uwep = null;
                if (game.u) game.u.uwep = null;
                item.wielded = false;
                item.owornmask = (item.owornmask ?? 0) & ~W_WEP;
                spentTime = true;
            } else {
                game.uswapwep = null;
                if (game.u) game.u.uswapwep = null;
                item.alternate = false;
                item.owornmask = (item.owornmask ?? 0) & ~W_SWAPWEP;
                spentTime = wasTwoweap;
            }
            if (game.u) game.u.twoweap = false;
        }
    }
    const wasReady = item.ready;
    item.ready = false;
    const description = inventoryItemDescription(item);
    await pline(verb === 'fire'
        ? `You ready: ${item.invlet} - ${description}.`
        : `${item.invlet} - ${description} (at the ready).`);
    item.ready = wasReady;
    setQuiverObject(item, game);
    game.context.move = spentTime ? 1 : 0;
    return { item, spentTime, cancelled: false };
}

// C refs: dothrow(), throw_obj().  Splitting the selected arrow stack makes
// a new object id, then obj_resists() is consulted when it lands.
async function okToThrow() {
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

async function dofire(cannedShotLimit = null) {
    const shotLimit = cannedShotLimit === null
        ? Math.max(0, game._commandCount || 0)
        : Math.max(0, cannedShotLimit || 0);
    game._commandCount = 0;
    if (!await okToThrow()) return;

    let fireObject = game.uquiver;
    let quiverSelectionSpentTime = false;
    if (!fireObject) {
        if (game.flags?.autoquiver) {
            fireObject = autoquiverCandidate(game);
            if (fireObject) {
                const wasReady = fireObject.ready;
                fireObject.ready = false;
                await pline(
                    `You ready: ${fireObject.invlet} - ${
                        inventoryItemDescription(fireObject)}.`,
                );
                fireObject.ready = wasReady;
                setQuiverObject(fireObject, game);
            } else {
                await pline('You have nothing appropriate for your quiver.');
            }
        } else {
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
        const matchingLauncher = launcher =>
            launcherMatchesAmmo(fireObject, launcher);
        const alternate = game.uswapwep || game.u?.uswapwep || null;
        const fireassist = game.flags?.fireassist !== false;
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

async function captureThrownObjectFlight(object, flightPath) {
    const glyph = transientObjectGlyph(object);
    let transientCell = null;
    let transientCursor = null;
    try {
        for (const cell of flightPath) {
            if (cansee(cell.x, cell.y)) {
                if (transientCell)
                    newsym(transientCell.x, transientCell.y);
                show_glyph_cell(
                    cell.x, cell.y, glyph.ch, glyph.color,
                    glyph.decgfx, glyph.attr,
                );
                transientCell = cell;
                transientCursor = lastDirtyMapCursor()
                    ?? [cell.x, cell.y + 1];
            }
            const frameCursor = transientCursor ?? lastDirtyMapCursor();
            await flush_screen(1);
            if (frameCursor)
                game.nhDisplay?.setCursor(...frameCursor);
            await game.animationFrame?.();
        }
    } finally {
        if (transientCell)
            newsym(transientCell.x, transientCell.y);
    }
}

// C mon.c:xkilled() has a distinct wasinside continuation.  Admit only the
// ordinary room transaction here so a potentially fatal roll cannot detach an
// object and then discover that life-saving, special death, punishment, shop,
// or terrain ownership is still missing.
function canFinishOrdinaryThrownKill(monster, { swallowed = false } = {}) {
    if (!monster) return false;
    if (swallowed) {
        if (game.u?.ustuck !== monster || !game.u?.uswallow) return false;
    } else if (game.u?.uswallow || game.u?.ustuck) return false;
    const location = game.level?.at?.(monster.mx, monster.my);
    const leaderId = game.quest_status?.leader_m_id;
    const carried = monster.minvent || monster.inventory || [];
    const ordinaryPriorInventory = carried.every(object => {
        const objectClass = object.oclass || objectClassForType(object.otyp);
        return [2, 9].includes(objectClass)
            && !(object.owornmask ?? 0) && !object.worn && !object.wielded
            && !object.ready && !object.lamplit && !object.unpaid
            && !object.oartifact && !object.artifact
            && !(object.timed ?? 0) && !(object.objectTimers?.length ?? 0)
            && !(object.contents?.length ?? 0);
    });
    return location?.typ === ROOM
        && !game.level?.traps?.some(trap =>
            (trap.tx ?? trap.x) === monster.mx
                && (trap.ty ?? trap.y) === monster.my)
        && !game._shopRooms?.current
        && !game.uball && !game.u?.uball && !game.uchain && !game.u?.uchain
        && !game.u?.usteed
        && !monster.iswiz && !monster.isshk && !monster.ispriest
        && !monster.isminion && !monster.isgd && !monster.mleashed
        && !monster.mtrapped && !monster.m_ap_type
        && !(Number.isInteger(monster.cham) && monster.cham >= 0)
        && monster.m_id !== leaderId
        && !((MONSTER_GENO[monster.mnum] ?? 0) & G_UNIQ)
        && !MONSTER_ATTACKS[monster.mnum]?.some(attack =>
            attack[0] === AT_BOOM)
        // Weapon and scroll identities exercise ordinary minvent order and
        // stack absorption.  Worn, timed, lit, billed, contained, artifact,
        // and other class-specific release effects remain fail-loud.
        && ordinaryPriorInventory;
}

function canFinishOrdinarySwallowedThrowKill(monster) {
    return canFinishOrdinaryThrownKill(monster, { swallowed: true });
}

function canFinishOrdinaryMapPotionKill(monster) {
    return canFinishOrdinaryThrownKill(monster);
}

async function finishOrdinarySwallowedThrowKill(monster, projectile) {
    return finishHeroMonsterKill(monster, monster.mx, monster.my, {
        weaponHit: false,
        deathContext: {
            kind: 'swallowed-projectile',
            projectile,
            finishDestinationEffects: finishDestinationSpotEffects,
        },
    });
}

async function finishOrdinarySwallowedPotionKill(monster) {
    return finishHeroMonsterKill(monster, monster.mx, monster.my, {
        weaponHit: false,
        deathContext: {
            kind: 'swallowed-potion',
            finishDestinationEffects: finishDestinationSpotEffects,
        },
    });
}

async function finishOrdinaryMapPotionKill(monster) {
    return finishHeroMonsterKill(monster, monster.mx, monster.my, {
        weaponHit: false,
    });
}

// C dothrow.c:throw_obj() chooses one action-level volley count before the
// first splitobj().  This helper is complete for matching sling ammunition:
// skill and weak-multishot policy plus the only role bonuses which apply to a
// sling (Cave Dweller and Ranger). Bow/crossbow and stackable-weapon families
// retain their existing owners.
function matchingSlingVolleyCount(item, selectedQuantity, shotLimit = 0) {
    if (selectedQuantity <= 1
        || OBJECT_SUBTYPE[item.otyp] !== -P_SLING
        || OBJECT_SUBTYPE[game.uwep?.otyp] !== P_SLING
        || game.u?.confused
        || (game.u?.confusionTurns ?? 0) > 0
        || (game.u?.stunnedTurns ?? 0) > 0
        || game.u?.stunned) return 1;

    const role = game.urole?.key;
    const fumbling = !!(game.u?.fumbling
        || (game.u?.fumblingTurns ?? 0) > 0);
    const weakMultishot = ['wizard', 'priest', 'healer', 'tourist']
        .includes(role)
        || fumbling
        || (game.u?.acurr?.a?.[A_DEX] ?? 10) <= 6;
    const level = ensureHeroSkills(game)?.[P_SLING]?.skill ?? 0;
    let maximum = 1;
    if (level >= P_EXPERT) maximum++;
    if (level >= P_SKILLED && !weakMultishot) maximum++;
    if (role === 'caveman' || role === 'ranger') maximum++;

    const selected = Math.min(rnd(maximum), selectedQuantity);
    return shotLimit > 0 ? Math.min(selected, shotLimit) : selected;
}

async function dothrow(
    selectedItem = null, capabilityChecked = false, suppliedShotLimit = null,
) {
    const shotLimit = suppliedShotLimit === null
        ? Math.max(0, game._commandCount || 0)
        : Math.max(0, suppliedShotLimit || 0);
    game._commandCount = 0;
    if (!capabilityChecked && !await okToThrow()) return;
    ensureHeroGoldObject(game);

    // getobj("throw") changes its suggested class when the primary weapon is
    // a sling: ordinary weapons become downplayed and GEM_CLASS sling ammo is
    // suggested instead.  Every directly selected inventory letter remains
    // valid even when downplayed.
    const wieldingSling = !!game.uwep
        && OBJECT_SUBTYPE[game.uwep.otyp] === OBJECT_SUBTYPE[SLING];
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
                key = await selectInventoryObject({
                    // invent.c:getobj(): `?` normally lists suggestions.  If
                    // lets is empty but altlets forced the prompt, it lists
                    // those downplayed objects instead.
                    items: throwables.length
                        ? throwables : (game.inventory || []),
                    includeGold: true,
                    loopUntilValid: true,
                });
                if (key === 32) key = await promptKey(prompt);
                continue;
            }
            if (key === 42) {
                key = await selectInventoryObject();
                continue;
            }
            selectedItem = game.inventory?.find(candidate =>
                candidate.invlet === String.fromCharCode(key));
            if (selectedItem) break;

            // invent.c:getobj() retains the picker after an absent letter.
            // Reissuing its prompt forces tty to acknowledge the intervening
            // error line, so the recorded boundary exposes --More-- first.
            await moreUntilDismissed("You don't have that object.--More--");
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
    const directionKey = await promptKey('In what direction? ');
    const direction = String.fromCharCode(directionKey);
    if (direction === '.') {
        await pline(directGoldThrow
            ? 'You cannot throw gold at yourself.'
            : 'You cannot throw an object at yourself.');
        game.context.move = 0;
        return;
    }
    const verticalGoldThrow = selectedIsGold
        && (direction === '<' || direction === '>');
    if (!isMovementKey(direction) && !verticalGoldThrow) {
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
    // tty getdir() removes its editable prompt once a valid direction has
    // been accepted.  Hand-thrown ammo happened to overwrite this with its
    // launcher warning; launched projectiles need the boundary explicitly.
    game._pending_message = '';

    // getdir() commits the source direction before throw_obj() detaches an
    // identity.  throwit() may later rewrite it for slip or low stamina.
    const dx = DIR_DX[direction] ?? 0;
    const dy = DIR_DY[direction] ?? 0;
    const dz = direction === '<' ? -1 : direction === '>' ? 1 : 0;
    game.u.dx = dx;
    game.u.dy = dy;
    game.u.dz = dz;

    if (directGoldThrow) {
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
    const matchingBow = bowAmmo
        && OBJECT_SUBTYPE[game.uwep?.otyp] === P_BOW;
    const launchedArrow = matchingBow;
    const handThrownArrow = bowAmmo && !matchingBow;
    const matchingSlingGem = !game.u?.uswallow
        && wieldingSling && thrownObjectClass === 13
        && OBJECT_SUBTYPE[item.otyp] === -P_SLING;
    const slingVolleyCount = matchingSlingGem
        ? matchingSlingVolleyCount(item, selectedQuantity, shotLimit) : 1;

    // Tourist darts get their role multishot roll even when the result can
    // only be one projectile.  A Ranger using a matching bow selects one
    // action-level volley count; splitobj() still belongs to each iteration.
    if (!game.u?.uswallow
        && game.urole?.key === 'tourist' && item.otyp === DART) rnd(1);
    let arrowVolleyCount = 1;
    if (!game.u?.uswallow
        && game.urole?.key === 'ranger' && launchedArrow) {
        arrowVolleyCount = Math.min(rnd(2), selectedQuantity);
        if (shotLimit > 0)
            arrowVolleyCount = Math.min(arrowVolleyCount, shotLimit);
    }
    let splitObjectId = null;
    if (!game.u?.uswallow && thrownObjectClass !== 8
        && !launchedArrow && !handThrownArrow
        && !matchingSlingGem
        && selectedQuantity > 1) {
        splitObjectId = nextIdent(); // splitobj()
        item.quantity = selectedQuantity - 1;
        item.quan = item.quantity;
        if (thrownObjectClass === 12) syncHeroGoldCache(game);
    }
    const adjacentMonster = game.level?.monsters?.find(candidate =>
        !candidate.dead && (candidate.mhp ?? 1) > 0
        && candidate.mx === game.u.ux + dx
        && candidate.my === game.u.uy + dy);
    if (item.otyp === CREAM_PIE && adjacentMonster) {
        // dothrow.c:thitmonst() rolls its ordinary to-hit die before the
        // cream-pie class branch.  That branch uses Dexterity versus rnd(25)
        // to decide contact; hmon_hitmon_misc_obj() then consumes the pie,
        // blinds without damage, and never reaches drop_throw()/obj_resists().
        rnd(20);
        if ((game.u?.acurr?.a?.[A_DEX] ?? 10) > rnd(25)) {
            const monsterName = MONSTER_NAME[adjacentMonster.mnum]
                || 'monster';
            await pline(
                `The cream pie splashes over the ${monsterName}'s face!`,
            );
            // uhitm.c:hmon_hitmon_misc_obj() publishes the splash before
            // setmangry().  The target's growl therefore forces tty's
            // continuation while blindness and object consumption remain
            // suspended on the far side of the acknowledgement.
            await wakeAttackedMonster(adjacentMonster);
            adjacentMonster.mcansee = 0;
            adjacentMonster.mblinded = Math.min(
                127,
                (adjacentMonster.mblinded ?? 0) + 21 + rn2(25),
            );
            if (selectedQuantity === 1) {
                const index = game.inventory.indexOf(item);
                if (index >= 0) game.inventory.splice(index, 1);
            }
            game.context.move = 1;
            return;
        }
    }
    // Generic thrown objects and missiles follow different source paths.
    // Missiles retain their class-specific handling:
    // routing arrows and darts through this branch consumes the entire stack
    // and suppresses dothrow()'s launcher warning.
    if (await resolveSwallowedProjectileThrow({
        state: game,
        item,
        objectClass: thrownObjectClass,
        selectedQuantity,
        splitObjectId,
        wakeMonster: wakeAttackedMonster,
        canFinishKill: canFinishOrdinarySwallowedThrowKill,
        finishKill: finishOrdinarySwallowedThrowKill,
    })) return;
    if (await resolveSwallowedWeaponThrow({
        state: game,
        item,
        objectClass: thrownObjectClass,
        selectedQuantity,
        splitObjectId,
        wakeMonster: wakeAttackedMonster,
        canFinishKill: canFinishOrdinarySwallowedThrowKill,
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
        canFinishKill: canFinishOrdinarySwallowedThrowKill,
        finishKill: finishOrdinarySwallowedPotionKill,
    })) return;
    if (game.u?.uswallow && thrownObjectClass === 8)
        throw new Error('swallowed potion throwing is not implemented');

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
        blocksMove,
        captureFlight: captureThrownObjectFlight,
        wakeMonster: wakeAttackedMonster,
        wakeNearby: wakeMonstersNear,
        canFinishKill: canFinishOrdinaryMapPotionKill,
        finishKill: finishOrdinaryMapPotionKill,
    })) return;
    if (!game.u?.uswallow && thrownObjectClass === 8)
        throw new Error('map potion impact is not implemented');

    if (thrownObjectClass === 3) {
        const previousCapacity = game._encumbranceLevel ?? nearCapacity(game);
        const itemIndex = game.inventory.indexOf(item);
        if (itemIndex >= 0) game.inventory.splice(itemIndex, 1);
        if (game.uwep === item) game.uwep = null;
        if (game.uswapwep === item) game.uswapwep = null;
        if (game.uquiver === item) game.uquiver = null;

        const x = game.u.ux + dx, y = game.u.uy + dy;
        const monster = game.level?.monsters?.find(candidate =>
            candidate.mx === x && candidate.my === y
            && (candidate.mhp ?? 1) > 0);
        if (monster) {
            // dothrow.c:thitmonst() always rolls to-hit before class-specific
            // handling.  Armor reaches the generic miss branch, then tmiss()
            // owns its one-in-three wakeup check.
            rnd(20);
            const objectName = OBJECT_NAMES[item.otyp] || item.name || 'object';
            const monsterName = MONSTER_NAME[monster.mnum] || 'monster';
            await pline(`The ${objectName} misses the ${monsterName}.`);
            rn2(3);
        }

        // drop_throw()->breaktest()->obj_resists() precedes floor placement
        // even for non-breakable armor.
        rn2(100);
        if (!game.level.objects[x]) game.level.objects[x] = [];
        if (!game.level.objects[x][y]) game.level.objects[x][y] = [];
        item.ox = x;
        item.oy = y;
        game.level.objects[x][y].unshift(item);
        game._fobjSerial = (game._fobjSerial || 0) + 1;
        item._fobjOrder = game._fobjSerial;
        newsym(x, y);

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

    const detachArrowUnit = () => {
        const liveQuantity = item.quantity ?? item.quan ?? 1;
        if (liveQuantity > 1) {
            const detached = {
                ...item,
                o_id: nextIdent(),
                quantity: 1,
                quan: 1,
                owt: OBJECT_WEIGHT[item.otyp] ?? item.owt ?? 1,
                owornmask: 0,
                ready: false,
                lamplit: false,
                timed: false,
                where: 'free',
            };
            item.quantity = liveQuantity - 1;
            item.quan = item.quantity;
            detached.how_lost = LOST_THROWN;
            return detached;
        }

        {
            const index = game.inventory.indexOf(item);
            if (index >= 0) game.inventory.splice(index, 1);
            if (game.uwep === item) game.uwep = null;
            if (game.uswapwep === item) game.uswapwep = null;
            if (game.uquiver === item) game.uquiver = null;
            item.owornmask = 0;
            item.ready = false;
            item.where = 'free';
            item.how_lost = LOST_THROWN;
            return item;
        }
    };
    const landArrowUnit = (thrown, x, y) => {
        place_object(thrown, x, y);
        stack_object(thrown);
        newsym(x, y);
        return thrown;
    };
    const shotOrdinal = shot => {
        const mod100 = shot % 100;
        if (mod100 >= 11 && mod100 <= 13) return `${shot}th`;
        if (shot % 10 === 1) return `${shot}st`;
        if (shot % 10 === 2) return `${shot}nd`;
        if (shot % 10 === 3) return `${shot}rd`;
        return `${shot}th`;
    };
    const arrowObjectName = OBJECT_NAMES[item.otyp] || 'arrow';
    const shotArrowName = shot => arrowVolleyCount > 1
        ? `${shotOrdinal(shot)} ${arrowObjectName}` : arrowObjectName;

    // C refs: throwit()->bhit()->thitmonst().  Compute one source-shaped
    // arrow path per split identity before selecting its contact or floor
    // continuation.  Ordinary floor traps do not intercept bhit() missiles;
    // webs own their one-in-three stop probe.  Open doorways share the
    // ordinary traversal path after blocksMove() rejects closed/locked doors;
    // point-blank iron bars admit arrows because hits_bars(always_hit=0)
    // classifies bow ammunition as small enough to pass.  Distant bars pay
    // bhit's one-in-five forced-hit probe; the nonzero branch admits small
    // ammunition.  On the accepted zero branch, hit_bars() checks hero-caused
    // breakage, emits Clonk!, wakes the radius-16 neighborhood, and leaves
    // bhitpos on the preceding square for ordinary landing.  Destructive
    // object/bar variants remain separately bounded.  Water walls retain the
    // entered coordinate, then the accepted arrow slice applies soft-floor
    // water damage before publishing the submerged survivor.  Sinks admit the
    // object, run contact/web handling there, then stop.  Other ZAP_POS terrain
    // remains separately bounded.
    const resolveArrowShot = async (shot) => {
        const thrown = detachArrowUnit();
        let shotDx = dx;
        let shotDy = dy;
        // C dothrow.c:throwit() tests every cursed or greased directed
        // projectile after splitobj() but before range/path construction.
        // A nonzero probe is still observable because it shifts to-hit and
        // every later passive/floor draw.  Zero rerolls the flight direction;
        // the vertical 0,0 result falls back to the hero square.
        if ((thrown.cursed || thrown.greased) && (shotDx || shotDy)
            && rn2(7) === 0) {
            await plineWithContinuation(
                `The ${arrowObjectName} misfires!`,
            );
            shotDx = rn2(3) - 1;
            shotDy = rn2(3) - 1;
        }
        const unitWeight = OBJECT_WEIGHT[item.otyp] ?? item.owt ?? 1;
        let range = Math.max(
            1,
            Math.trunc(currentAttribute(A_STR) / 2)
                - Math.trunc(unitWeight / 40),
        );
        if (handThrownArrow) range = Math.max(1, Math.trunc(range / 2));
        else range += 1;
        let x = game.u.ux, y = game.u.uy;
        let ordinaryPath = true;
        let contact = null;
        let stoppedInWaterWall = false;
        for (let distance = 0; distance < range; distance++) {
            const nx = x + shotDx, ny = y + shotDy;
            const typ = game.level?.at?.(nx, ny)?.typ;
            if (typ === WATER) {
                // zap.c:bhit() stops thrown objects after advancing into a
                // wall of water.  Unlike bars, it does not back bhitpos.
                x = nx;
                y = ny;
                stoppedInWaterWall = true;
                break;
            }
            const pointBlankPassingBars = typ === IRONBARS && distance === 0;
            let distantPassingBars = false;
            if (typ === IRONBARS && distance > 0) {
                const forcedBarsHit = rn2(5) === 0;
                if (forcedBarsHit) {
                    rn2(100); // hit_bars()->hero_breaks()->breaktest()
                    await plineWithContinuation('Clonk!');
                    wakeMonstersNear(nx, ny, 16);
                    break;
                }
                distantPassingBars = true;
            }
            const passingBars = pointBlankPassingBars || distantPassingBars;
            if (!shotDx && !shotDy) break;
            if (blocksMove(nx, ny) && !passingBars) break;
            if (typ !== ROOM && typ !== CORR && typ !== DOOR
                && typ !== SINK && !passingBars) {
                ordinaryPath = false;
                break;
            }
            x = nx;
            y = ny;
            contact = game.level?.monsters?.find(candidate =>
                !candidate.dead && (candidate.mhp ?? 1) > 0
                && candidate.mx === x && candidate.my === y) || null;
            const trap = game.level?.traps?.find(candidate =>
                (candidate.tx ?? candidate.x) === x
                && (candidate.ty ?? candidate.y) === y);
            if (!contact && trap?.ttyp === WEB && rn2(3) === 0) {
                if (cansee(x, y)) {
                    await plineWithContinuation(
                        `The ${arrowObjectName} gets stuck in a web!`,
                    );
                    trap.tseen = true;
                    newsym(x, y);
                }
                break;
            }
            if (contact || typ === SINK) break;
        }
        const arrowFlight = {
            x, y, contact, ordinaryPath, stoppedInWaterWall,
        };

        if (arrowFlight.ordinaryPath && arrowFlight.contact) {
            const monster = arrowFlight.contact;
            const luck = game.u?.uluck ?? game.u?.luck ?? game.Luck ?? 0;
            const dexterity = currentAttribute(A_DEX);
            let threshold = -1 + luck + findMonsterArmorClass(monster)
                + (game.u?.uhitinc ?? 0) + (game.u?.ulevel ?? 1);
            if (dexterity < 4) threshold -= 3;
            else if (dexterity < 6) threshold -= 2;
            else if (dexterity < 8) threshold -= 1;
            else if (dexterity >= 14) threshold += dexterity - 14;
            const distance = Math.max(
                Math.abs(monster.mx - game.u.ux),
                Math.abs(monster.my - game.u.uy),
            );
            threshold += Math.max(-4, 3 - distance);
            threshold += (MONSTER_SIZE[monster.mnum] ?? 2) - 2;
            if (monster.msleeping) threshold += 2;
            if (!monster.mcanmove || !(monster.mmove
                ?? MONSTER_MOVE[monster.mnum] ?? 0)) threshold += 4;
            threshold += (thrown.spe ?? thrown.enchantment ?? 0)
                + (thrown.hitbon ?? thrown.oc_hitbon
                    ?? OBJECT_HIT_BONUS[thrown.otyp] ?? 0);
            if (launchedArrow) {
                const bowSkill = Math.abs(
                    OBJECT_SUBTYPE[game.uwep.otyp] || 0,
                );
                threshold += (game.uwep.spe ?? game.uwep.enchantment ?? 0)
                    - Math.max(
                        game.uwep.oeroded ?? 0,
                        game.uwep.oeroded2 ?? 0,
                    )
                    + weaponSkillHitBonus(game, bowSkill);
            } else {
                threshold -= 4;
            }

            const dieroll = rnd(20);
            const monsterBaseName = MONSTER_NAME[monster.mnum] || 'monster';
            const targetName = monster.isshk
                ? shopkeeperName(monster)
                : monster.name || `the ${monsterBaseName}`;
            if (threshold < dieroll) {
                await plineWithContinuation(
                    `The ${shotArrowName(shot)} misses ${targetName}.`,
                );
                if (rn2(3) === 0) await wakeAttackedMonster(monster);
                rn2(100); // breaktest()->obj_resists() at contact
                landArrowUnit(thrown, arrowFlight.x, arrowFlight.y);
                return;
            }

            // TODO: add death, passive attacks, artifacts, poison, and anger
            // for non-pets to this projectile hit path.
            const targetIsLarge = (MONSTER_SIZE[monster.mnum] ?? 2) >= 3;
            const damageRange = targetIsLarge
                ? (OBJECT_LARGE_DAMAGE[thrown.otyp] ?? 6)
                : (OBJECT_SMALL_DAMAGE[thrown.otyp] ?? 6);
            // uhitm.c:hmon_hitmon_weapon() routes ammo thrown without its
            // matching launcher through hmon_hitmon_weapon_ranged(): it does
            // 1d2 rather than using the arrow's launched object damage.
            let damage = rnd(launchedArrow
                ? Math.max(1, damageRange) : 2);
            if (launchedArrow) {
                const bowSkill = Math.abs(
                    OBJECT_SUBTYPE[game.uwep.otyp] || 0,
                );
                // weapon.c:dmgval() applies object enchantment and then
                // subtracts greatest_erosion(), clamping that base damage to
                // one before hmon_hitmon_dmg_recalc() adds launcher skill.
                // Erosion belongs to the detached projectile, not the bow.
                damage += thrown.spe ?? thrown.enchantment ?? 0;
                damage -= Math.max(
                    thrown.oeroded ?? 0,
                    thrown.oeroded2 ?? 0,
                );
                damage = Math.max(1, damage);
                damage += weaponSkillDamageBonus(game, bowSkill);
            }
            damage = Math.max(1, damage);
            monster.mhp = (monster.mhp ?? 1) - damage;
            if ((monster.mtame ?? 0) > 0 && damage > 0) {
                monster.mtame = Math.max(0, monster.mtame - 1);
                monster.pet = monster.mtame > 0;
                if (monster.mtame > 0) {
                    if (!monster.edog) monster.edog = {};
                    monster.edog.abuse = (monster.edog.abuse ?? 0) + 1;
                    const yelps = rn2(monster.mtame) !== 0;
                    await plineWithContinuation(
                        `${monster.name || `The ${monsterBaseName}`} ${
                            yelps ? 'yelps' : 'growls'
                        }!`,
                    );
                    if (monster.mhp > 0) {
                        const fleeTime = 10 * rnd(damage);
                        monster.mflee = 1;
                        monster.mfleetim = Math.min(
                            127,
                            (monster.mfleetim ?? 0) + fleeTime,
                        );
                    }
                }
            }
            await plineWithContinuation(
                `The ${shotArrowName(shot)} hits ${targetName}${
                    damage > 4 ? '!' : '.'
                }`,
            );
            // uhitm.c:hmon_hitmon() publishes the hit line before its final
            // wakeup(TRUE).  For a surviving peaceful resident, setmangry's
            // next pline forces that old line through tty; acknowledgement
            // then resumes thitmonst() at exercise/mulch and the next shot.
            if (monster.mhp > 0)
                await wakeAttackedMonster(monster);
            if (monster.mhp <= 0) {
                await finishHeroMonsterKill(
                    monster, arrowFlight.x, arrowFlight.y,
                    { weaponHit: true },
                );
            }
            exerciseAttribute(A_DEX, true);
            if (shouldMulchMissile(thrown)) {
                destroyMulchedProjectile(thrown);
                return;
            }
            await applySharedProjectileObjectPassive(monster, thrown);
            rn2(100);
            landArrowUnit(thrown, arrowFlight.x, arrowFlight.y);
            return;
        }

        if (arrowFlight.stoppedInWaterWall) {
            // dothrow.c:throwit()->flooreffects()->water_damage().  This
            // accepted branch is a light, rust-prone blessed arrow at Luck 0.
            await plineWithContinuation('Plop!');
            const luck = game.u?.uluck ?? game.u?.luck ?? game.Luck ?? 0;
            const luckProtected = luck + 5 > rn2(20);
            if (!luckProtected) {
                const blessingProtected = !!thrown.blessed && rnl(4) === 0;
                if (!blessingProtected) {
                    thrown.oeroded = Math.min(3, (thrown.oeroded ?? 0) + 1);
                }
            }
            landArrowUnit(thrown, arrowFlight.x, arrowFlight.y);
            return;
        }

        rn2(100); // breaktest()->obj_resists() for a floor survivor
        if (arrowFlight.x === game.u.ux && arrowFlight.y === game.u.uy
            && blocksMove(game.u.ux + shotDx, game.u.uy + shotDy)) {
            // bhit() leaves gb.bhitpos on the hero square when the first path
            // cell is blocked.
            landArrowUnit(thrown, game.u.ux, game.u.uy);
            return;
        }
        if (arrowFlight.ordinaryPath && !arrowFlight.contact
            && (arrowFlight.x !== game.u.ux
                || arrowFlight.y !== game.u.uy)) {
            landArrowUnit(thrown, arrowFlight.x, arrowFlight.y);
        }
    };

    if (handThrownArrow || launchedArrow) {
        if (arrowVolleyCount > 1 || shotLimit > 0) {
            const noun = arrowVolleyCount === 1
                ? arrowObjectName
                : item.plural || `${arrowObjectName}s`;
            await plineWithContinuation(
                `You ${launchedArrow ? 'shoot' : 'throw'} ${
                    arrowVolleyCount} ${noun}.`,
            );
        }
        for (let shot = 1; shot <= arrowVolleyCount; shot++) {
            await resolveArrowShot(shot);
        }
        game.context.move = 1;
        return;
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
            MONSTER_NAME[adjacentMonster.mnum],
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
            || IS_WALL(mineralFirstTyp))) {
        if (matchingSlingGem
            && (slingVolleyCount > 1 || shotLimit > 0)) {
            const baseName = item.name
                || OBJECT_NAMES[item.otyp] || 'stone';
            const noun = slingVolleyCount === 1
                ? baseName : item.plural || `${baseName}s`;
            await pline(`You shoot ${slingVolleyCount} ${noun}.`);
        }
        const resolveGemShot = async () => {
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

        let thrownMineral = item;
        if (matchingSlingGem) {
            const liveQuantity = item.quantity ?? item.quan ?? 1;
            if (liveQuantity > 1) {
                const objectId = nextIdent(); // splitobj() for this shot
                item.quantity = liveQuantity - 1;
                item.quan = item.quantity;
                item.owt = unitWeight * item.quantity;
                thrownMineral = {
                    ...item,
                    o_id: objectId,
                    quantity: 1,
                    quan: 1,
                    owt: unitWeight,
                    owornmask: 0,
                    ready: false,
                    timed: false,
                    lamplit: false,
                    where: 'free',
                    how_lost: LOST_THROWN,
                };
            } else {
                const itemIndex = game.inventory.indexOf(item);
                if (itemIndex >= 0) game.inventory.splice(itemIndex, 1);
                if (game.uwep === item) game.uwep = null;
                if (game.uswapwep === item) game.uswapwep = null;
                if (game.uquiver === item) game.uquiver = null;
                item.owornmask = 0;
                item.ready = false;
                item.where = 'free';
                item.how_lost = LOST_THROWN;
            }
        } else if (selectedQuantity > 1) {
            item.owt = unitWeight * (item.quantity ?? item.quan ?? 1);
            thrownMineral = {
                ...item,
                o_id: splitObjectId,
                quantity: 1,
                quan: 1,
                owt: unitWeight,
                owornmask: 0,
                ready: false,
                timed: false,
                lamplit: false,
                where: 'free',
                how_lost: LOST_THROWN,
            };
        } else {
            const itemIndex = game.inventory.indexOf(item);
            if (itemIndex >= 0) game.inventory.splice(itemIndex, 1);
            if (game.uwep === item) game.uwep = null;
            if (game.uswapwep === item) game.uswapwep = null;
            if (game.uquiver === item) game.uquiver = null;
            item.owornmask = 0;
            item.ready = false;
            item.where = 'free';
            item.how_lost = LOST_THROWN;
        }

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
        let contact = null;
        while (remaining-- > 0) {
            x += dx;
            y += dy;
            const loc = game.level?.at?.(x, y);
            const monster = game.level?.monsters?.find(candidate =>
                !candidate.dead && (candidate.mhp ?? 1) > 0
                && candidate.mx === x && candidate.my === y);

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

            if ((!ZAP_POS(loc?.typ) || blocksMove(x, y))
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
                rn2(100); // drop_throw()->breaktest()->obj_resists()
                place_object(thrownMineral, x, y);
                await settleThrownShopObject(thrownMineral, x, y);
                stack_object(thrownMineral);
                newsym(x, y);
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
                rn2(100); // drop_throw()->breaktest()->obj_resists()
                place_object(thrownMineral, x, y);
                await settleThrownShopObject(thrownMineral, x, y);
                stack_object(thrownMineral);
                newsym(x, y);
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
                    addObjectToMonsterInventory(
                        contact, thrownMineral, game,
                    );
                }
                await plineWithContinuation(accepted
                    ? `${subject}${policy} accepts your gift.`
                    : `${subject}${policy}`);

                // teleport.c:rloc() runs after the acceptance message. A
                // later vanish message waits for that first message.
                const actorWasSeen = canProjectMonster(
                    contact, contact.mx, contact.my,
                );
                const teleportRestricted = monsterTeleportRestricted(
                    contact, game,
                );
                if (teleportRestricted && canSeeMonster(
                    contact, contact.mx, contact.my,
                )) {
                    const restrictedName = contact.name
                        ? contact.name : `the ${monsterBaseName}`;
                    await plineWithContinuation(
                        `A mysterious force prevents ${restrictedName} from teleporting!`,
                    );
                }
                const relocation = teleportRestricted
                    ? null : randomMonsterRelocation(
                        contact, game, [], rn2, rnd,
                    );
                if (relocation) {
                    // teleport.c:rloc_to_core() refreshes both cells after
                    // placement and before its potentially suspending pline.
                    // A visible destination is therefore already projected
                    // beneath the prior gift-policy pager.
                    newsym(relocation.oldx, relocation.oldy);
                    newsym(relocation.x, relocation.y);
                    if (actorWasSeen) {
                        const actorNowSeen = canProjectMonster(
                            contact, contact.mx, contact.my,
                        );
                        if (actorNowSeen) {
                            const newDistance = dist2(
                                contact.mx, contact.my,
                                game.u.ux, game.u.uy,
                            );
                            const oldDistance = dist2(
                                relocation.oldx, relocation.oldy,
                                game.u.ux, game.u.uy,
                            );
                            const distanceSuffix = newDistance <= 2
                                ? ' next to you'
                                : newDistance <= BOLT_LIM * BOLT_LIM
                                    ? ' close by'
                                    : oldDistance === newDistance
                                        ? ''
                                        : newDistance < oldDistance
                                            ? ' closer to you'
                                            : ' farther away';
                            await plineWithContinuation(
                                `${subject} vanishes and reappears${
                                    distanceSuffix
                                }.`,
                            );
                        } else {
                            await plineWithContinuation(
                                `${subject} vanishes!`,
                            );
                        }
                    }
                }
                if (!accepted) {
                    rn2(100); // drop_throw()->breaktest()->obj_resists()
                    place_object(thrownMineral, x, y);
                    await settleThrownShopObject(thrownMineral, x, y);
                    stack_object(thrownMineral);
                    newsym(x, y);
                }
                game.context.move = 1;
                return;
            }

            // dothrow.c:thitmonst()->tmiss(). ROCK is sling ammunition, but
            // throwing it without a sling applies the unlaunched-ammo penalty.
            const luck = game.u?.uluck ?? game.u?.luck ?? game.Luck ?? 0;
            const dexterity = currentAttribute(A_DEX);
            let threshold = -1 + luck + findMonsterArmorClass(contact)
                + (game.u?.uhitinc ?? 0) + (game.u?.ulevel ?? 1);
            if (dexterity < 4) threshold -= 3;
            else if (dexterity < 6) threshold -= 2;
            else if (dexterity < 8) threshold -= 1;
            else if (dexterity >= 14) threshold += dexterity - 14;
            const distance = Math.max(
                Math.abs(contact.mx - game.u.ux),
                Math.abs(contact.my - game.u.uy),
            );
            threshold += Math.max(-4, 3 - distance);
            threshold += (MONSTER_SIZE[contact.mnum] ?? 2) - 2;
            if (contact.msleeping) threshold += 2;
            if (!contact.mcanmove || !(contact.mmove
                ?? MONSTER_MOVE[contact.mnum] ?? 0)) threshold += 4;
            threshold += thrownMineral.hitbon ?? thrownMineral.oc_hitbon
                ?? OBJECT_HIT_BONUS[thrownMineral.otyp] ?? 0;
            if (matchingSlingGem) {
                const slingSkill = Math.abs(
                    OBJECT_SUBTYPE[game.uwep.otyp] || 0,
                );
                threshold += (game.uwep.spe ?? game.uwep.enchantment ?? 0)
                    - Math.max(
                        game.uwep.oeroded ?? 0,
                        game.uwep.oeroded2 ?? 0,
                    )
                    + weaponSkillHitBonus(game, slingSkill);
            } else {
                threshold -= 4;
            }

            const dieroll = rnd(20);
            const monsterBaseName = MONSTER_NAME[contact.mnum] || 'monster';
            const hallucinating = !!(game.u?.hallucinating
                || (game.u?.hallucinationTurns ?? 0) > 0);
            const projectileName = matchingSlingGem
                ? thrownGemDisplayName()
                : thrownMineral.dknown === false
                ? unseenObjectNoun(thrownMineral)
                : OBJECT_NAMES[thrownMineral.otyp] || 'stone';
            const displayedTargetName = () => {
                if (hallucinating) {
                    const subject = randomDisplayMonsterSubject();
                    return subject.charAt(0).toLowerCase() + subject.slice(1);
                }
                return contact.isshk
                    ? shopkeeperName(contact)
                    : contact.name || `the ${monsterBaseName}`;
            };
            if (threshold < dieroll) {
                const targetSuffix = canSeeMonster(
                    contact, contact.mx, contact.my,
                ) ? ` ${displayedTargetName()}` : '';
                await plineWithContinuation(
                    `The ${projectileName} misses${targetSuffix}.`,
                );
                if (rn2(3) === 0) await wakeAttackedMonster(contact);
                rn2(100); // drop_throw()->breaktest()->obj_resists()
                place_object(thrownMineral, x, y);
                await settleThrownShopObject(thrownMineral, x, y);
                stack_object(thrownMineral);
                newsym(x, y);
                game.context.move = 1;
                return;
            }

            // Launched sling ammunition uses its object damage and launcher
            // skill. A stone thrown by hand uses the ordinary 1d2 damage.
            const slingSkill = matchingSlingGem
                ? Math.abs(OBJECT_SUBTYPE[game.uwep.otyp] || 0) : 0;
            const targetIsLarge = (MONSTER_SIZE[contact.mnum] ?? 2) >= 3;
            const launchedDamageRange = targetIsLarge
                ? OBJECT_LARGE_DAMAGE[thrownMineral.otyp]
                : OBJECT_SMALL_DAMAGE[thrownMineral.otyp];
            const rawDamage = rnd(matchingSlingGem
                ? Math.max(1, launchedDamageRange || 1) : 2);
            if (matchingSlingGem)
                recordWeaponPractice(game, slingSkill, 1);
            const damage = Math.max(1, rawDamage
                + (matchingSlingGem
                    ? weaponSkillDamageBonus(game, slingSkill) : 0));
            contact.mhp = (contact.mhp ?? 1) - damage;
            contact.msleeping = 0;
            if ((contact.mtame ?? 0) > 0 && damage > 0) {
                contact.mtame = Math.max(0, contact.mtame - 1);
                contact.pet = contact.mtame > 0;
                if (contact.mtame > 0) {
                    if (!contact.edog) contact.edog = {};
                    contact.edog.abuse = (contact.edog.abuse ?? 0) + 1;
                    const yelps = rn2(contact.mtame) !== 0;
                    await plineWithContinuation(
                        `${contact.name || `The ${monsterBaseName}`} ${
                            yelps ? 'yelps' : 'growls'
                        }!`,
                    );
                    if (contact.mhp > 0) {
                        const fleeTime = 10 * rnd(damage);
                        contact.mflee = 1;
                        contact.mfleetim = Math.min(
                            127,
                            (contact.mfleetim ?? 0) + fleeTime,
                        );
                    }
                }
            }
            if (contact.mhp <= 0) {
                await finishHeroMonsterKill(contact, x, y, {
                    weaponHit: true,
                });
            } else {
                await plineWithContinuation(
                    `The ${projectileName} hits ${
                        displayedTargetName()
                    }${damage > 4 ? '!' : '.'}`,
                );
                // uhitm.c:hmon_hitmon() wakes every surviving defender after
                // publishing its hit message.  For peaceful non-pets this is
                // also the setmangry()/growl transaction; keep it ahead of
                // thitmonst()'s Dexterity exercise and mulch probe.
                await wakeAttackedMonster(contact);
            }
            exerciseAttribute(A_DEX, true);
            const mulched = shouldMulchMissile(thrownMineral);
            if (mulched) {
                destroyMulchedProjectile(thrownMineral);
                game.context.move = 1;
                return;
            }
            await applySharedProjectileObjectPassive(
                contact, thrownMineral,
            );
            rn2(100); // drop_throw()->breaktest()->obj_resists()
            place_object(thrownMineral, x, y);
            await settleThrownShopObject(thrownMineral, x, y);
            stack_object(thrownMineral);
            newsym(x, y);
            game.context.move = 1;
            return;
        }

        const endpoint = game.level?.at?.(x, y);
        if (endpoint?.typ === POOL) {
            await plineWithContinuation(
                unitWeight > WT_SPLASH_THRESHOLD ? 'Splash!' : 'Plop!',
            );
            thrownMineral.ox = x;
            thrownMineral.oy = y;
            await waterDamageObject(thrownMineral, [], game);
        } else {
            rn2(100); // drop_throw()->breaktest()->obj_resists()
        }
        place_object(thrownMineral, x, y);
        await settleThrownShopObject(thrownMineral, x, y);
        stack_object(thrownMineral);
        newsym(x, y);
        game.context.move = 1;
        return;
        };

        const volleyCount = matchingSlingGem ? slingVolleyCount : 1;
        for (let shot = 0; shot < volleyCount; shot++) {
            const previousCapacity = game._encumbranceLevel
                ?? nearCapacity(game);
            await resolveGemShot();
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

    // Non-arrow survivors retain throwit()->drop_throw()->breaktest()
    // ownership.  Arrow iterations consume this inside resolveArrowShot().
    if (item.otyp !== CARROT) rn2(100);

    if (thrownObjectClass === 2
        && blocksMove(game.u.ux + dx, game.u.uy + dy)) {
        // A blocked weapon-class projectile lands at gb.bhitpos, which is
        // still the hero square. Its floor/fobj identity is visible to the
        // same-turn monster scheduler.
        let thrown = item;
        if (selectedQuantity > 1) {
            thrown = {
                ...item,
                o_id: splitObjectId,
                quantity: 1,
                quan: 1,
                owt: OBJECT_WEIGHT[item.otyp] ?? item.owt ?? 1,
                owornmask: 0,
                ready: false,
                where: 'free',
            };
        } else {
            const index = game.inventory.indexOf(item);
            if (index >= 0) game.inventory.splice(index, 1);
            if (game.uwep === item) game.uwep = null;
            if (game.uswapwep === item) game.uswapwep = null;
            if (game.uquiver === item) game.uquiver = null;
        }
        thrown.how_lost = LOST_THROWN;
        place_object(thrown, game.u.ux, game.u.uy);
        stack_object(thrown);
        newsym(game.u.ux, game.u.uy);
        game._pending_message = '';
        game.context.move = 1;
        return;
    }

    if (thrownObjectClass !== 2 && item.otyp !== CARROT) {
        // dothrow.c removes the object from inventory, or splits one unit from
        // its stack, before drop_throw().
        let thrown = item;
        if (selectedQuantity > 1) {
            thrown = {
                ...item,
                o_id: splitObjectId,
                quantity: 1,
                quan: 1,
            };
        } else {
            const index = game.inventory.indexOf(item);
            if (index >= 0) game.inventory.splice(index, 1);
            if (game.uquiver === item) setQuiverObject(null, game);
        }
        if (thrownObjectClass === 12) syncHeroGoldCache(game);
        let x = game.u.ux, y = game.u.uy;
        const nx = x + DIR_DX[direction], ny = y + DIR_DY[direction];
        if (!blocksMove(nx, ny)) {
            x = nx;
            y = ny;
        }
        thrown.ox = x;
        thrown.oy = y;
        thrown.where = 'floor';
        game._fobjSerial = (game._fobjSerial || 0) + 1;
        thrown._fobjOrder = game._fobjSerial;
        if (!game.level.objects[x]) game.level.objects[x] = [];
        if (!game.level.objects[x][y]) game.level.objects[x][y] = [];
        game.level.objects[x][y].unshift(thrown);
        newsym(x, y);
        game._pending_message = '';
        game.context.move = 1;
        return;
    }
    if (item.otyp === CARROT) {
        const dx = DIR_DX[direction], dy = DIR_DY[direction];
        let x = game.u.ux, y = game.u.uy;
        const flightPath = [];
        for (let distance = 0; distance < 2; distance++) {
            const nx = x + dx, ny = y + dy;
            if (blocksMove(nx, ny)) break;
            x = nx; y = ny;
            flightPath.push({ x, y });
            if (game.level?.monsters?.some(monster => monster.mx === x
                && monster.my === y)) break;
        }
        await captureThrownObjectFlight(item, flightPath);
        rn2(100); // drop_throw()->breaktest()->obj_resists()
        if (!game.level.objects[x]) game.level.objects[x] = [];
        if (!game.level.objects[x][y]) game.level.objects[x][y] = [];
        const existing = game.level.objects[x][y]
            .find(object => object.otyp === item.otyp
                && !!object.cursed === !!item.cursed
                && !!object.blessed === !!item.blessed);
        if (existing) {
            existing.quantity = (existing.quantity ?? existing.quan ?? 1) + 1;
            existing.quan = existing.quantity;
        } else {
            game.level.objects[x][y].unshift({
                ...item, quantity: 1, quan: 1, ox: x, oy: y,
            });
        }
        newsym(x, y);
    }
    if (!handThrownArrow) game._pending_message = '';
    game.context.move = 1;
}

function passiveContact(monster, malive) {
    const passive = MONSTER_ATTACKS[monster.mnum]
        ?.find(attack => attack[0] === 0);
    if (!passive) return;
    const [, , dice, sides] = passive;
    if (dice > 0) d(dice, sides);
    else if (sides > 0) d((monster.m_lev ?? 0) + 1, sides);
    if (malive && !monster.mcan) rn2(3);
}

// C refs: lock.c autokey(TRUE), pick_lock().  Default autounlock includes
// apply-key; an explicit false/none setting is the only state that disables
// this branch in the currently ported option model.
function autoUnlockTool(g = game) {
    const setting = g.flags?.autounlock;
    if (setting === false || setting === 0 || setting === 'none') return null;
    const inventory = g.inventory || [];
    for (const otyp of [SKELETON_KEY, LOCK_PICK, CREDIT_CARD]) {
        const tool = inventory.find(object => object.otyp === otyp);
        if (tool) return tool;
    }
    return null;
}

function lockToolPresentation(tool) {
    if (tool.otyp === SKELETON_KEY) return 'skeleton key';
    if (tool.otyp === CREDIT_CARD) return 'credit card';
    return 'lock pick';
}

function lockPickChance(tool, g = game, container = null) {
    const dexterity = g.u?.acurr?.a?.[A_DEX] ?? 10;
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
async function pushBoulder(boulder, x, y, dx, dy) {
    const targetX = x + dx;
    const targetY = y + dy;
    const targetObjects = game.level?.objects?.[targetX]?.[targetY] || [];
    const targetMonster = game.level?.monsters?.find(monster =>
        monster.mx === targetX && monster.my === targetY
        && (monster.mhp ?? 1) > 0);
    const physicalMonster = targetMonster
        && MONSTER_SYMBOL[targetMonster.mnum] !== 54;
    if (physicalMonster) {
        if (canSpotMonster(targetMonster)) {
            const name = MONSTER_NAME[targetMonster.mnum] || 'monster';
            await plineWithContinuation(
                `There's ${indefiniteArticle(name)} ${name} on the other side.`,
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
        || !Number.isInteger(lastPushMove)
        || sourceMove > lastPushMove + 2
        || sourceMove < lastPushMove;
    game._lastPushedBoulder = boulder;
    game._lastBoulderPushMove = sourceMove;
    if (giveMessage) await pline('With great effort you move the boulder.');

    exerciseAttribute(A_STR, true);
    // C dopush() invalidates an invisible-monster memory glyph at the
    // destination before movobj().  Otherwise newsym() must continue to
    // honor `I` and cannot reveal the boulder which now occupies the square.
    unmap_invisible(targetX, targetY, false);
    const source = game.level.objects[x][y];
    const index = source.indexOf(boulder);
    if (index >= 0) source.splice(index, 1);
    if (!game.level.objects[targetX]) game.level.objects[targetX] = [];
    if (!game.level.objects[targetX][targetY])
        game.level.objects[targetX][targetY] = [];
    game.level.objects[targetX][targetY].unshift(boulder);
    boulder.ox = targetX;
    boulder.oy = targetY;
    // movobj() removes and places the same object, which re-links it at the
    // head of C's global fobj chain.  Pet goal scans observe this independently
    // of the square-local pile order.
    game._fobjSerial = (game._fobjSerial || 0) + 1;
    boulder._fobjOrder = game._fobjSerial;
    // remove_object()/place_object() update C's vision block points on both
    // squares.  Rebuild the JS projection before the hero steps into the
    // vacated square so the new boulder, rather than its old location,
    // controls the following vision_recalc().
    vision_reset();
    newsym(x, y);
    newsym(targetX, targetY);
    return true;
}

function meleeAttributeBonus() {
    const strength = currentAttribute(A_STR);
    const dexterity = game.u?.acurr?.a?.[A_DEX] ?? 10;
    let bonus = strength < 6 ? -2
        : strength < 8 ? -1
            : strength < 17 ? 0
                : strength < 1850 ? 1
                    : strength < 1900 ? 2 : 3;
    if ((game.u?.ulevel ?? 1) < 3) bonus++;
    return bonus + (dexterity < 4 ? -3
        : dexterity < 6 ? -2
            : dexterity < 8 ? -1
                : dexterity < 14 ? 0 : dexterity - 14);
}

function meleeEncumbrancePenalty() {
    const level = new Map([
        ['Burdened', 1], ['Stressed', 2], ['Strained', 3],
        ['Overtaxed', 4], ['Overloaded', 5],
    ]).get(game.u?._encumbrance) || 0;
    return level ? level * 2 - 1 : 0;
}

// C refs: hack.c:overexertion(), uhitm.c:do_attack()/hitum(),
// weapon.c:dmgval(), mon.c:xkilled()/corpse_chance().  This is the first
// ordinary hero-melee transaction.  Its hit threshold is shared hero/monster
// state, not a species-index lookup.
async function attackHostileMonster(monster, x, y, {
    secondaryStrike = false,
} = {}) {
    game._heroMeleeThisCommand = true;
    const primaryStrike = !secondaryStrike;
    const attackWeapon = secondaryStrike
        ? (game.uswapwep || game.u?.uswapwep || null)
        : (game.uwep || game.u?.uwep || null);
    const twoWeaponActive = !!(game.u?.twoweap || game.twoweap)
        && !!(game.uwep || game.u?.uwep)
        && !!(game.uswapwep || game.u?.uswapwep);
    const mortalityBeforeStrike = game.u?.umortality ?? 0;
    const targetStillAvailableForOffhand = () => primaryStrike
        && twoWeaponActive
        && (game.multi ?? game._multi ?? 0) >= 0
        && (game.u?.umortality ?? 0) === mortalityBeforeStrike
        && (monster.mhp ?? 0) > 0
        && monster.mx === x && monster.my === y
        && (game.level?.monsters || []).includes(monster);
    const finishStrike = () => targetStillAvailableForOffhand()
        ? attackHostileMonster(monster, x, y, { secondaryStrike: true })
        : true;
    const hallucinating = !!(game.u?.hallucinating
        || (game.u?.hallucinationTurns ?? 0) > 0);
    const displayedMonsterName = () => hallucinating
        ? randomDisplayMonsterName()
        : monsterInstanceDisplayName(monster);
    // C uhitm.c:missum()/hmon_hitmon_msg_hit() suppress the target name
    // completely when verbose is disabled.  mon_nam() independently falls
    // back to "it" when the target cannot currently be spotted.  Keep those
    // gates ahead of Hallucination naming so a pronoun does not consume a
    // display-RNG monster name which tty never requested.
    const displayedMonsterObject = () => {
        if (game.flags?.verbose === false
            || !canProjectMonster(monster, monster.mx, monster.my)) return 'it';
        if (!hallucinating && monster.isshk)
            return shopkeeperName(monster);
        if (!hallucinating && monster.name) return displayedMonsterName();
        return `the ${displayedMonsterName()}`;
    };
    // hack.c:do_attack() charges metabolism once for the complete attack;
    // hitum() then owns both primary and off-hand attempts.
    if (primaryStrike) getHungry();

    const bareHanded = !attackWeapon;
    const martialArtist = bareHanded
        && ['monk', 'samurai'].includes(game.urole?.key);
    // weapon.c:skill_init() starts roles whose bare-handed maximum exceeds
    // Expert at Basic.  Preserve an explicit override for later #enhance.
    const bareHandedSkill = game.u?._bareHandedSkill
        ?? (['barbarian', 'caveman', 'monk', 'samurai']
            .includes(game.urole?.key) ? 2 : 1);

    // uhitm.c:do_attack() consumes gu.unweapon once, after overexertion and
    // before Strength exercise.  The message is an ordinary topline owner:
    // it composes with the hit/miss line and only a later message may force
    // that pair through --More--.
    if (primaryStrike && game._unweapon) {
        game._unweapon = false;
        if (game.flags?.verbose !== false) {
            if (attackWeapon) {
                await pline(
                    `You begin bashing monsters with ${
                        inventoryItemDescription(attackWeapon)
                    }.`,
                );
            } else {
                const action = game.urole?.key === 'monk'
                    ? 'striking' : 'bashing';
                await pline(
                    `You begin ${action} monsters with your ${
                        game.uarmg ? 'gloved' : 'bare'
                    } hands.`,
                );
            }
        }
    }

    if (primaryStrike) exerciseAttribute(A_STR, true);
    // uhitm.c find_roll_to_hit() checks role conduct before rolling the
    // attack die.  A lawful Knight striking a helpless, non-undead target
    // gets the caitiff message even when the subsequent attack misses.
    const helpless = !!(monster.msleeping || monster.mcanmove === 0
        || (monster.mfrozen ?? 0) > 0);
    const caitiffMessage = primaryStrike
        ? await applyCaitiffPenalty(monster, game) : false;
    // weapon.c:hitval() asks the wielded artifact for its special accuracy
    // before hitum() rolls the ordinary d20.
    const artifactHitBonus = attackWeapon
        ? artifactToHitBonus(attackWeapon, monster)
        : 0;
    const dieroll = rnd(20);
    // uhitm.c:find_roll_to_hit() begins with abon(), target AC, intrinsic
    // accuracy, compressed Luck, and experience level, then applies role,
    // burden, and weapon adjustments.
    const monsterAc = Number.isFinite(monster.mac) ? monster.mac
        : Number.isFinite(monster.ac) ? monster.ac
            : MONSTER_EXPERIENCE_META[monster.mnum]?.[0] ?? 10;
    const luck = game.u?.uluck ?? game.u?.luck ?? game.Luck ?? 0;
    const luckBonus = Math.sign(luck)
        * Math.trunc((Math.abs(luck) + 2) / 3);
    const level = game.u?.ulevel ?? 1;
    let threshold = 1 + meleeAttributeBonus() + monsterAc
        + (game.u?.uhitinc ?? 0) + luckBonus + level;
    if (monster.mstun) threshold += 2;
    if (monster.mflee) threshold += 2;
    if (monster.msleeping) threshold += 2;
    if (monster.mcanmove === 0) threshold += 4;
    if (bareHanded && game.urole?.key === 'monk') {
        const skillSteps = Math.max(bareHandedSkill, 1) - 1;
        const skillHitBonus = Math.trunc(((skillSteps + 2) * 2) / 2);
        const monkBonus = !game.uarm && !game.uarms
            ? Math.trunc(level / 3) + 2 : 0;
        threshold += monkBonus + skillHitBonus;
    } else if (bareHanded) {
        const skillSteps = Math.max(bareHandedSkill, 1) - 1;
        threshold += Math.trunc((skillSteps + 2) / 2);
    } else if (attackWeapon) {
        // hitval() adds weapon enchantment and oc_hitbon, then
        // weapon_hit_bonus() projects the current skill.  A weapon acquired
        // after skill_init() does not become Basic merely by being wielded.
        const weaponSkill = Math.abs(
            OBJECT_SUBTYPE[attackWeapon.otyp] || 0,
        );
        threshold += (attackWeapon.spe ?? attackWeapon.enchantment ?? 0)
            + (attackWeapon.hitbon ?? attackWeapon.oc_hitbon
                ?? OBJECT_HIT_BONUS[attackWeapon.otyp] ?? 0)
            + (attackWeapon.skillHitBonus ?? 0)
            + artifactHitBonus
            + weaponSkillHitBonus(game, weaponSkill);
    }
    threshold -= meleeEncumbrancePenalty();
    if (game.u?.utrap) threshold -= 3;
    if (threshold <= dieroll) {
        await plineWithContinuation(
            `You miss ${displayedMonsterObject()}.`,
        );
        // missum() wakes and angers an awake peaceful shopkeeper before
        // hitum() reaches passive().  Keeping the passive draw after the
        // messages also preserves tty suspension if either pline blocks.
        if (!helpless) await wakeAttackedShopkeeper(monster);
        // hitum() invokes passive() after every primary attempt, including a
        // miss.  The second attempt invokes it only when that strike hits.
        if (primaryStrike) passiveContact(monster, true);
        return finishStrike();
    }

    if (primaryStrike) exerciseAttribute(A_DEX, true);
    if (attackWeapon) {
        if (!game.u.uconduct) game.u.uconduct = {};
        const firstWeaponHit = !(game.u.uconduct.weaphit || 0);
        game.u.uconduct.weaphit = (game.u.uconduct.weaphit || 0) + 1;
        if (firstWeaponHit) {
            const weaponName = attackWeapon.name
                || OBJECT_NAMES[attackWeapon.otyp] || 'weapon';
            recordGameLogEvent(
                `hit with a wielded weapon (${weaponName}) for the first time`,
            );
        }
    }
    // C mondata.h:bigmonst() begins at MZ_LARGE (3), not MZ_HUGE (4).
    // Weapon large-damage dice therefore apply to tigers, horses, and other
    // ordinary Large targets as well as Huge and Gigantic monsters.
    const targetIsLarge = (MONSTER_SIZE[monster.mnum] ?? 2) >= 3;
    const weaponDamageRange = attackWeapon
        ? (targetIsLarge ? OBJECT_LARGE_DAMAGE : OBJECT_SMALL_DAMAGE)
            [attackWeapon.otyp]
        : 0;
    let damage = bareHanded ? rnd(martialArtist ? 4 : 2)
        : Math.max(0, rnd(weaponDamageRange || 4)
            + (attackWeapon?.spe ?? 0));
    // hmon_hitmon_weapon_melee() decides whether to train from dmgval()
    // before artifact_hit() adjusts damage.  Grayswandir's PHYS(5, 0) then
    // adds that base damage again before Strength and ring bonuses.
    const trainsWeapon = !bareHanded && damage > 1;
    if (!bareHanded) {
        damage += artifactDamageBonus(attackWeapon, monster, damage);
    }
    if (trainsWeapon) {
        recordWeaponPractice(
            game, twoWeaponActive ? 36
                : Math.abs(OBJECT_SUBTYPE[attackWeapon?.otyp] || 0), 1,
        );
    }
    if (bareHanded) {
        // weapon.c:weapon_dam_bonus(NULL): Basic martial arts contributes
        // +3.  Non-martial bare-handed combat uses the same skill projection
        // with the smaller multiplier.
        const trained = Math.max(bareHandedSkill, 1) - 1;
        damage += Math.trunc(
            ((trained + 1) * (martialArtist ? 3 : 1)) / 2,
        );
    }
    // uhitm.c:hmon_hitmon_dmg_recalc() applies intrinsic/ring damage and
    // Strength and weapon skill after the weapon die and enchantment.
    // Polymorphed heroes do not receive dbon(); the current role-shaped state
    // uses the ordinary hero path.
    const polymorphed = !!(game.u?.polymorphed || game.u?.upolyd);
    const weaponSkillDamage = bareHanded ? 0 : weaponSkillDamageBonus(
        game, Math.abs(OBJECT_SUBTYPE[attackWeapon?.otyp] || 0),
    );
    const ordinaryStrengthDamage = polymorphed ? 0
        : strengthDamageBonus(currentAttribute(A_STR));
    const strengthDamage = twoWeaponActive
        ? Math.sign(ordinaryStrengthDamage) * Math.trunc(
            (3 * Math.abs(ordinaryStrengthDamage) + 2) / 4,
        )
        : ordinaryStrengthDamage;
    damage += (game.u?.udaminc ?? game.udaminc ?? 0)
        + strengthDamage
        + weaponSkillDamage;
    damage = Math.max(1, damage);
    const wakeMonsterAfterHit = async () => {
        if (!monster.msleeping) return;
        const wakeMessage = canProjectMonster(
            monster, monster.mx, monster.my,
        ) ? `The ${displayedMonsterName()} wakes up!` : '';
        if (wakeMessage) await plineWithContinuation(wakeMessage);
        if (canProjectMonster(monster, monster.mx, monster.my)
            && caitiffMessage) {
            await promptKey(`${game._pending_message}--More--`);
            game._pending_message = '';
        }
        monster.msleeping = 0;

        await plineWithContinuation(
            `The ${displayedMonsterName()} screams!`,
        );
        const wakeDistance = (monster.m_lev
            ?? MONSTER_LEVEL[monster.mnum] ?? 0) * 18;
        for (const nearby of [...(game.level?.monsters || [])].reverse()) {
            if (!nearby.msleeping || (nearby.mhp ?? 1) <= 0) continue;
            const nearbyDx = nearby.mx - monster.mx;
            const nearbyDy = nearby.my - monster.my;
            if (nearbyDx * nearbyDx + nearbyDy * nearbyDy >= wakeDistance)
                continue;
            if (canProjectMonster(nearby, nearby.mx, nearby.my)) {
                await plineWithContinuation(
                    `The ${MONSTER_NAME[nearby.mnum] || 'monster'} wakes up.`,
                );
            }
            nearby.msleeping = 0;
            nearby.mstrategy = (nearby.mstrategy ?? 0) & ~STRAT_WAITMASK;
        }
    };
    let stagger = { staggered: false };
    if (bareHanded && !game.uarm && !game.uarms && damage > 1
        && !polymorphed) {
        stagger = await tryUnarmedStagger(monster, {
            skill: bareHandedSkill,
            damage,
            dx: x - (game.u?.ux ?? x),
            dy: y - (game.u?.uy ?? y),
            announce: plineWithContinuation,
            nameMonster: target => target === monster
                ? `The ${displayedMonsterName()}`
                : monsterInstanceDisplayName(target),
            wakeMonster: wakeMonsterAfterHit,
            finishLiquidDeath: async (victim, state, random, calls,
                leaveCorpse) => {
                await finishHeroMonsterKill(victim, victim.mx, victim.my, {
                    showKillMessage: false,
                    noCorpse: !leaveCorpse,
                    hallucinating,
                    nameMonster: displayedMonsterName,
                });
                return { dead: true, calls };
            },
        });
    }
    if (!stagger.dead)
        monster.mhp = Math.max(0, (monster.mhp ?? 1) - damage);
    if (stagger.dead) return true;
    if (monster.mhp > 0) {
        // C uhitm.c:hmon_hitmon_msg_hit() uses canseemon(), not canspotmon():
        // telepathy can supply the target noun without exposing damage
        // magnitude.  Only an optically seen hit receives exclam(damage).
        const hitPunctuation = game.flags?.verbose !== false
            && canSeeMonster(monster, monster.mx, monster.my)
            && damage > 4 ? '!' : '.';
        if (!stagger.staggered) {
            await plineWithContinuation(
                `You hit ${displayedMonsterObject()}${hitPunctuation}`,
            );
        }
        await wakeMonsterAfterHit();
        // hmon_hitmon() reaches generic knockback only after wakeup() has
        // completed.  known_hitum() then checks whether the wounded survivor
        // flees, followed by passive().  Keeping this tail after both pager
        // boundaries also assigns its RNG to the same input as the C engine.
        if (!bareHanded && damage > 1 && !twoWeaponActive) {
            rn2(3);
            rn2(6);
        }
        const fleeRoll = rn2(25);
        if (fleeRoll === 0
            && monster.mhp < Math.trunc((monster.mhpmax ?? monster.mhp) / 2)) {
            if (rn2(3) === 0) rnd(100);
            monster.mflee = 1;
        }
        passiveContact(monster, true);
        return finishStrike();
    }

    // C hmon_hitmon_pet()->abuse_dog() runs even when this blow kills the
    // pet.  Hallucination disables is_safemon(), so an ordinary direction can
    // reach this path: tameness drops first, then the surviving tame status
    // owns rn2(mtame) and yelp()/growl() owns a random Hallucinated verb.
    const wasTame = (monster.mtame ?? (monster.pet ? 1 : 0)) > 0;
    if (wasTame && damage > 0) {
        monster.mtame = Math.max(0,
            (monster.mtame ?? (monster.pet ? 1 : 0)) - 1);
        monster.pet = monster.mtame > 0;
        if (monster.mtame > 0) {
            const yelps = rn2(monster.mtame) !== 0;
            if (hallucinating) {
                const hallucinatedPetSounds = [
                    'beep', 'boing', 'sing', 'belche', 'creak', 'cough',
                    'rattle', 'ululate', 'pop', 'jingle', 'sniffle', 'tinkle',
                    'eep', 'clatter', 'hum', 'sizzle', 'twitter', 'wheeze',
                    'rustle', 'honk', 'lisp', 'yodel', 'coo', 'burp', 'moo',
                    'boom', 'murmur', 'oink', 'quack', 'rumble', 'twang',
                    'toot', 'gargle', 'hoot', 'warble',
                ];
                // Both yelp() and growl() use this table while Hallucinating;
                // retain the branch owner even though their visible result is
                // the same for this state.
                const sound = hallucinatedPetSounds[rn2(
                    hallucinatedPetSounds.length,
                )];
                void yelps;
                await plineWithContinuation(
                    `The ${randomDisplayMonsterName()} ${sound}s!`,
                );
            }
        }
    }

    return finishHeroMonsterKill(monster, x, y, {
        wasTame,
        hallucinating,
        zombifyCorpse: bareHanded && isZombieMaker(
            game.u?.umonnum, game.u?.mcan,
        ),
        // xkilled() renders the victim after abuse_dog(), so preserve this
        // lazy Hallucination-name boundary rather than precomputing it.
        nameMonster: displayedMonsterName,
    });
}

// C uhitm.c:attack_checks().  An ordinary direction into an actor which the
// hero cannot spot is not yet a melee attack unless warning or a remembered
// invisible-monster glyph has already identified the occupied square.
// Returning true means that this preflight consumed the turn.
async function markUnseenMonsterBeforeAttack(monster, x, y) {
    monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_WAITMASK;
    if (game.context?.forcefight
        || canProjectMonster(monster, x, y)
        || monsterHasWarningProjection(monster)
        || game.level?.at(x, y)?.remembered_glyph?.kind === 'invisible') {
        return false;
    }

    await plineWithContinuation(
        "Wait!  There's something there you can't see!",
    );
    map_invisible(x, y);

    // mon.c:wakeup() clears sleep here.
    // TODO: add mimic reveal, peaceful response, and the sleeping growl.
    monster.msleeping = 0;
    return true;
}

// C refs: uhitm.c attack_checks(), stumble_onto_mimic(),
// that_is_a_mimic().  A visible object-disguised mimic consumes the attempted
// move as a reveal, before hero melee and before the ordinary monster turn.
// object_from_map() constructs a temporary object to name the remembered
// glyph, so even this presentation-only branch owns next_ident()'s rnd(2).
async function stumbleOntoObjectMimic(monster, x, y) {
    if (monster?.m_ap_type !== M_AP_OBJECT
        || game.u?.protectionFromShapeChangers
        || monsterHasWarningProjection(monster)) return false;

    nextIdent();
    const appearance = OBJECT_NAMES[monster.mappearance] || 'strange object';
    const mimic = MONSTER_NAME[monster.mnum] || 'mimic';
    await pline(
        `That ${appearance} is ${indefiniteArticle(mimic)} ${mimic}!`,
    );

    monster.m_ap_type = 0;
    monster.mappearance = 0;
    monster.msleeping = 0;
    monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_WAITMASK;
    if (!game.u?.ustuck && !monster.mflee
        && [64, 65, 66].includes(monster.mnum)) {
        game.u.ustuck = monster;
    }
    newsym(x, y);
    return true;
}

// C ref: hack.c:domove_fight_empty().  A forced attack and an ordinary move
// into remembered invisible-monster knowledge converge here after actor
// lookup.  Both spend the action without entering terrain movement; only the
// remembered-invisible path is excluded by nopick.
async function fightEmptyDestination(x, y) {
    const loc = game.level?.at(x, y);
    const forcefight = !!game.context?.forcefight;
    const rememberedInvisible
        = loc?.remembered_glyph?.kind === 'invisible';
    if (!forcefight
        && (!rememberedInvisible || game.context?.nopick)) return false;

    // domove_fight_empty() is still the hero's attack attempt even when no
    // live monster occupies the destination.  The following monster phase
    // observes that command ownership at fatal tty/status boundaries.
    game._heroMeleeThisCommand = true;
    if (rememberedInvisible) unmap_invisible(x, y);
    stopRun(game);

    const boulder = (game.level?.objects?.[x]?.[y] || [])
        .find(object => object.otyp === BOULDER);
    const solid = !loc || blocksMove(x, y)
        || IS_FURNITURE(loc.typ);
    if (boulder) {
        await pline('You harmlessly attack a boulder.');
    } else if (solid) {
        const obstacle = !loc ? 'an unknown obstacle'
            : loc.typ === TREE ? 'the tree'
                : loc.typ === DOOR ? 'the door'
                    : loc.typ === STONE ? 'the solid rock'
                        : 'the wall';
        await pline(`You harmlessly attack ${obstacle}.`);
    } else {
        await pline('You attack thin air.');
    }
    return true;
}

// C ref: hack.c domove — execute a movement
// C hack.c:domove_core() converges ordinary movement and a successful
// domove_swap_with_pet() at spoteffects(TRUE).  Keep destination pickup,
// look_here(), engraving, and trap handling behind that shared boundary;
// returning directly from a special movement helper would silently skip the
// floor transaction even though the hero has changed squares.
export async function finishDestinationSpotEffects({
    oldx, oldy, newx, newy, loc, explicitAttempt,
}) {
    // C spoteffects() updates special-room/shop membership after liquid entry
    // effects and before destination pickup or traps.
    await checkSpecialRoom();
    // C pickup.c:check_here()->describe_decor().  Ordinary open/doorless
    // doorways are deliberately quiet, while a newly-entered broken doorway
    // is a feature when mention_decor is active.
    let skipDestinationFeature = false;
    if (game.flags?.mention_decor
        && loc?.typ === DOOR && loc.doormask === D_BROKEN
        && game._prevDecorType !== DOOR) {
        await pline('There is a broken door here.');
        // pickup.c:check_here() translates describe_decor()'s true return
        // into LOOKHERE_SKIP_DFEATURE, preventing look_here() from repeating
        // the feature before its object description.
        skipDestinationFeature = true;
    }
    game._prevDecorType = loc?.typ ?? STONE;
    const floorPile = game.level?.objects?.[newx]?.[newy] || [];
    // pickup.c:check_here() and every look_here() selection omit uchain.
    // The attached ball remains an ordinary visible floor object.
    let objects = floorPile.filter(object => object !== game.uchain
        && object !== game.u?.uchain);
    // invent.c:look_here() resolves dfeature_at() before selecting its
    // zero/one/many-object presentation branch.  The feature sentence is an
    // ordinary pline before a one-object description, so tty joins both onto
    // one topline when they fit.
    const destinationFeature = skipDestinationFeature
        ? '' : dungeonFeatureSentenceAt(newx, newy);
    const floorTrap = game.level?.traps?.find(candidate =>
        candidate.tx === newx && candidate.ty === newy);
    const autopickupRequested = objects.length && game.flags?.pickup
        && !game.context.nopick;
    const deepLiquid = (IS_POOL(loc?.typ)
        && !(game.u?.uinwater || game.underwater)) || IS_LAVA(loc?.typ);
    const floorOutOfReach = !heroCanReachFloor(game, {
        checkPit: is_pit(floorTrap?.ttyp),
    });
    const cannotCarry = heroCannotTake(game);
    const hideFloorObjects = autopickupRequested
        && (deepLiquid || floorOutOfReach);
    // C pickup()/check_here(): arriving on any floor object terminates a
    // non-travel run before the next automatic square. This input boundary
    // is behaviorally significant even when autopickup leaves the object in
    // place.
    if (objects.length && game._runState?.mode !== 8
        && !game.context.nopick) stopRun();
    if (objects.length && !hideFloorObjects
        && (!game.flags?.pickup
            || (autopickupRequested && cannotCarry))) {
        if (game.blind) {
            // invent.c:look_here() emits the tactile surface probe before it
            // describes any remaining object.  Its feel_location() call also
            // records the actual pile-top glyph underneath the hero; that
            // memory becomes visible when the hero leaves the square.
            map_object(floorPile[0], false, false);
            await plineWithContinuation(
                'You try to feel what is lying here on the floor.',
            );
        }
        if (objects.length > 1) {
            await showFloorPile(objects, false, destinationFeature);
        } else {
            if (destinationFeature)
                await plineWithContinuation(destinationFeature);
            await plineWithContinuation(
                `You ${game.blind ? 'feel' : 'see'} here ${
                    pricedFloorObjectDescription(objects[0])
                }.`,
            );
        }
        if (autopickupRequested && cannotCarry) {
            await pline(
                'You are physically incapable of picking anything up.',
            );
        }
    } else if (objects.length && !hideFloorObjects && game.flags?.pickup
        && !game.context.nopick) {
        const selected = objects.filter(autopickupAllows);
        let pickedCount = 0;
        if (selected.length) {
            pickedCount = await commitPickup({
                objects: floorPile, monster: null, x: newx, y: newy,
            }, selected);
            objects = floorPile.filter(object => object !== game.uchain
                && object !== game.u?.uchain);
        }
        // pickup.c:pickup() converges every autopickup attempt at
        // check_here(n_picked > 0).  pickup_types rejects transfer, not the
        // subsequent description of objects which remain underfoot.
        if (objects.length && game.blind) {
            map_object(floorPile[0], false, false);
            await plineWithContinuation(
                'You try to feel what is lying here on the floor.',
            );
        }
        if (objects.length > 1) {
            await showFloorPile(
                objects, pickedCount > 0, destinationFeature,
            );
        } else if (objects.length === 1) {
            if (destinationFeature)
                await plineWithContinuation(destinationFeature);
            await plineWithContinuation(
                `You ${game.blind ? 'feel' : 'see'} here ${
                    pricedFloorObjectDescription(objects[0])
                }.`,
            );
        }
    }
    if (!objects.length) {
        const read = await readEngravingAt(newx, newy, {
            showMore: async message => {
                await pline(message);
                return flushPendingTopline();
            },
            showLine: message => plineWithContinuation(message),
        });
        if (read && game._runState) stopRun();
    }
    if (await triggerHeroTrapAt(newx, newy, {
        finishTeleport: finishTeleportArrival,
        gotoLevel,
    })) return true;
    if (explicitAttempt)
        maybeSmudgeEngravings(oldx, oldy, newx, newy);
    return true;
}

// C hack.c:domove_core() common tail after the hero's coordinates have been
// committed.  Ordinary moves and pet displacement both pass through run
// termination, u_on_newpos/vision work, and spoteffects in this order.
async function finishMovedHero({
    oldx, oldy, newx, newy, loc, explicitAttempt, ballChainMove = null,
}) {
    const u = game.u;
    // C hack.c:domove_core() sets this only in the common tail after map
    // coordinates changed.  The turn loop retains it through every global
    // allocation needed to settle this action, then clears it before the next
    // hero action begins.
    u.umoved = true;
    see_nearby_objects();

    // An active non-travel run ends upon entering a doorway, obstruction, or
    // furniture square even when actor displacement, rather than the plain
    // terrain branch, performed the coordinate move.
    if (game._runState && game._runState.mode !== 8 && (loc?.typ === DOOR
        || IS_OBSTRUCTED(loc?.typ ?? STONE)
        || IS_FURNITURE(loc?.typ ?? STONE))) stopRun();

    newsym(oldx, oldy);
    vision_recalc(1);
    newsym(newx, newy);
    await announceInvocationSquare();
    if (ballChainMove) finishBallAndChainMove(ballChainMove);

    const liquid = await heroLiquidEffects({
        chooseTeleportDestination: async () => {
            const choice = await askTeleportDestination();
            return choice.destination;
        },
        applyLandingEffects: ({ from, to }) => finishDestinationSpotEffects({
            oldx: from.x,
            oldy: from.y,
            newx: to.x,
            newy: to.y,
            loc: game.level?.at?.(to.x, to.y),
            explicitAttempt: false,
        }),
        burnInventory: damage => destroyFireInventory(damage, {
            state: game,
            publish: plineWithContinuation,
        }),
        igniteInventory: () => igniteItems(game.inventory, {
            state: game,
            publish: plineWithContinuation,
        }),
    });
    if (liquid?.moved && explicitAttempt)
        maybeSmudgeEngravings(oldx, oldy, u.ux, u.uy);
    if (liquid?.moved || liquid?.died) return true;

    const finished = await finishDestinationSpotEffects({
        oldx, oldy, newx, newy, loc, explicitAttempt,
    });
    // Native domove() installs nomul(-2) for a costly ball drag after
    // spoteffects, then reaches its runmode-delay tail before any monster or
    // global maintenance advances that helpless counter.
    if (ballChainMove?.causeDelay) {
        await captureRunmodeDelay(
            game, true, game.moves || 0,
            { preservePhysicalTopline: true },
        );
    }
    return finished;
}

async function domove(dx, dy, explicitAttempt = true) {
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
            if (!polymorphed) exerciseAttribute(A_CON, false);
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
    // C hack.c:impaired_movement() always checks Confusion before deriving
    // the destination.  A nonzero rn2(5) keeps the requested direction; on
    // impairment, confdir(TRUE) chooses cardinals first and retries only an
    // out-of-bounds or solid-rock result.
    const confused = (u?.confusionTurns || 0) > 0;
    const stunned = !!(u?.stunned || (u?.stunnedTurns || 0) > 0);
    if (stunned || (confused && rn2(5) === 0)) {
        const impairedDirections = [
            [-1, 0], [0, -1], [1, 0], [0, 1],
            [-1, -1], [1, -1], [1, 1], [-1, 1],
        ];
        for (let tries = 0; tries <= 50; tries++) {
            const [candidateDx, candidateDy]
                = impairedDirections[rn2(impairedDirections.length)];
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

    const loc = game.level?.at(newx, newy);

    // C domove_core() resolves a destination monster before test_move()
    // applies terrain restrictions.  In particular, the hero can attack
    // diagonally across an intact doorway even though moving through that
    // same doorway would be rejected.
    const monster = game.level?.monsters?.find(mon =>
        !mon.dead && (mon.mhp ?? 1) > 0
        && mon.mx === newx && mon.my === newy);
    if (monster) {
        // C display.h:_is_safemon() deliberately stops treating even a
        // peaceful/tame monster as safe while the hero is confused,
        // hallucinating, or stunned.  domove_core() checks that predicate
        // after impaired_movement() has changed u.dx/u.dy; a Shift-run which
        // is redirected into the pet therefore stops before do_attack() and
        // its one-in-seven displacement refusal roll.
        const safeMonster = !!(monster.pet || monster.mtame
            || monster.mpeaceful)
            && !game.context?.forcefight
            && !confused
            && !u?.hallucinating && !(u?.hallucinationTurns > 0)
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
        if (safeMonster) {
            // C ref: hack.c do_attack()/domove(): a tame monster normally
            // yields to the hero, and ordinary peacefuls share the same
            // displacement path.  Only tame actors flee after refusal.
            const tame = !!(monster.pet || monster.mtame);
            const tameName = monster.name || (monster.mnum === 16
                ? 'your little dog' : monster.mnum === 32 ? 'your kitten'
                    : monster.mnum === 100 ? 'your saddled pony' : 'your pet');
            const speciesName = monsterInstanceDisplayName(monster);
            const subject = tame ? tameName
                : monster.name ? speciesName : `the ${speciesName}`;
            const yields = rn2(7) !== 0;
            if (!yields) {
                if (tame) {
                    let fleeTime = rnd(6);
                    // monflee() promotes a one-turn request to two so the
                    // monster remains visibly fleeing through at least one
                    // movement action; mcalcdistress() decrements it first.
                    if (fleeTime === 1) fleeTime++;
                    if (monster.mflee && (monster.mfleetim || 0) > 0)
                        fleeTime += monster.mfleetim;
                    monster.mflee = 1;
                    monster.mfleetim = Math.min(fleeTime, 127);
                    monster.mtrack = [];
                }
                const displayName = subject[0].toUpperCase()
                    + subject.slice(1);
                await pline(`You stop.  ${displayName} is in the way!`);
                return true;
            }
            if (u.utrap
                && !await heroCanMoveFromTrap(newx, newy)) return true;
            const ballChainMove = beginBallAndChainMove(newx, newy);
            if (ballChainMove?.blocked) {
                await pline(ballChainMove.blockedMessage);
                game.context.move = 0;
                return false;
            }
            const oldx = u.ux, oldy = u.uy;
            u.ux0 = oldx; u.uy0 = oldy;
            u.ux = newx; u.uy = newy;
            monster.mx = oldx; monster.my = oldy;
            const swapName = tame ? tameName
                : monster.name ? `peaceful ${speciesName}`
                    : `the peaceful ${speciesName}`;
            await pline(`You swap places with ${swapName}.`);
            return finishMovedHero({
                oldx, oldy, newx, newy, loc, explicitAttempt,
                ballChainMove,
            });
        }
        if (await stumbleOntoObjectMimic(monster, newx, newy))
            return true;
        if (await markUnseenMonsterBeforeAttack(monster, newx, newy))
            return true;
        return attackHostileMonster(monster, newx, newy);
    }

    // domove_core() snapshots the origin before test_move().  This includes
    // the terminal blocked step of a Shift-run, which is why later monster
    // missile logic can observe the hero as stationary rather than retreating.
    u.ux0 = u.ux;
    u.uy0 = u.uy;

    if (await fightEmptyDestination(newx, newy))
        return true;

    if (!await heroCanMoveFromTrap(newx, newy)) return true;

    if (loc?.typ === DOOR && (loc.doormask & (D_CLOSED | D_LOCKED))) {
        const fumbling = !!(u?.fumbling || (u?.fumblingTurns || 0) > 0);
        const blind = !!(u?.blind || (u?.blindTurns || 0) > 0);
        const dexterity = u?.acurr?.a?.[A_DEX] ?? 10;
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
                    exerciseAttribute(A_DEX, false);
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
            const tool = autoUnlockTool(game);
            if (!tool) {
                await pline('This door is locked.');
                return false;
            }
            await promptKey('This door is locked.--More--');
            const toolName = lockToolPresentation(tool);
            const answer = await promptKey(
                `Unlock it with your ${toolName}? [ynq] (q) `,
            );
            if (String.fromCharCode(answer).toLowerCase() === 'y') {
                game._occupation = {
                    key: 'pick-lock',
                    remaining: 51,
                    usedtime: 0,
                    door: loc,
                    x: newx,
                    y: newy,
                    tool,
                    chance: lockPickChance(tool, game),
                };
            }
            game.context.move = 0;
            return false;
        }
        const openRoll = rnl(20);
        const attributes = game.u?.acurr?.a || [10, 10, 10];
        const openThreshold = Math.trunc(
            ((attributes[A_STR] ?? 10) + (attributes[A_DEX] ?? 10)
                + (attributes[A_CON] ?? 10)) / 3,
        );
        if (openRoll >= openThreshold) {
            exerciseAttribute(A_STR, true);
            await pline('The door resists!');
            return false;
        }
        loc.doormask &= ~(D_CLOSED | D_LOCKED);
        loc.doormask |= 2; // D_ISOPEN
        await pline('The door opens.');
        vision_reset();
        vision_recalc(1);
        newsym(newx, newy);
        return false;
    }

    // C test_move() rejects an obstructed destination before it evaluates
    // tight-diagonal shoulders.  A boulder on ordinary floor is not terrain
    // obstruction, so that case still reaches cant_squeeze_thru() below
    // before moverock().
    if (blocksMove(newx, newy)) {
        if (game.flags?.mention_walls) {
            const obstruction = loc?.typ === STONE
                ? 'solid stone'
                : loc?.typ === TREE ? 'a tree'
                    : IS_WALL(loc?.typ) ? 'a wall' : '';
            const message = obstruction ? `It's ${obstruction}.` : '';
            if (message) await pline(message);
        }
        game.context.move = 0;
        return false;
    }

    // C ref: hack.c test_move().  Once the closed-door/autoopen path has had
    // its opportunity, intact open and doorless doorways only allow
    // orthogonal entry/exit.
    if (dx && dy && blocksDiagonalDoor(
        game.level?.at(u.ux, u.uy), loc,
    )) {
        game.context.move = 0;
        return false;
    }

    if (await rejectTightHeroDiagonal(dx, dy)) return false;

    const boulder = (game.level?.objects?.[newx]?.[newy] || [])
        .find(object => object.otyp === BOULDER);
    const hallucinating = !!(u?.hallucinating
        || (u?.hallucinationTurns ?? 0) > 0);
    if (boulder && game._runState?.mode >= 2
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
        const sameLevelAs = level => level
            && level.dnum === game.u?.uz?.dnum
            && level.dlevel === game.u?.uz?.dlevel;
        const liquid = loc.typ === WATER
            ? `wall of ${displayLiquidName('water')}`
            : loc.typ === LAVAWALL
                ? `wall of ${displayLiquidName('lava')}`
                : IS_LAVA(loc.typ)
                    ? `molten ${displayLiquidName('lava')}`
                    : loc.typ === MOAT && sameLevelAs(game.medusa_level)
                        ? 'shallow sea'
                        : loc.typ === MOAT && sameLevelAs(game.juiblex_level)
                            ? 'swamp'
                            : loc.typ === MOAT
                                ? 'moat'
                                : `pool of ${displayLiquidName('water')}`;
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
    const ballChainMove = beginBallAndChainMove(newx, newy);
    if (ballChainMove?.blocked) {
        await pline(ballChainMove.blockedMessage);
        game.context.move = 0;
        return false;
    }
    const oldx = u.ux, oldy = u.uy;
    u.ux0 = oldx;
    u.uy0 = oldy;
    u.ux = newx;
    u.uy = newy;
    return finishMovedHero({
        oldx, oldy, newx, newy, loc, explicitAttempt, ballChainMove,
    });
}
