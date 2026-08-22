// cmd.js — Command dispatch and movement.
// C ref: cmd.c rhack(), hack.c domove().
//
// Minimal skeleton: only hjklyubn movement is implemented.
// Contestants should add: search, kick, eat, drink, read, zap,
// wear, wield, drop, throw, pray, cast, and all other commands.

import { game } from './gstate.js';
import { nextIdent } from './ident.js';
import { nhgetch } from './input.js';
import {
    newsym, flushPendingTopline, flush_screen, pline, plineWithContinuation,
    docrt, docrtRecalc, bot, cls,
    terrain_glyph, canSeeMonster, canProjectMonster, canSpotMonster,
    monsterHasWarningProjection,
    see_nearby_objects, show_glyph_cell, swallowed, randomDisplayMonsterName,
    randomDisplayMonsterSubject, see_monsters, see_objects, see_traps,
    transientObjectGlyph,
    map_background, map_object, map_engraving, map_trap, map_invisible,
    unmap_invisible,
} from './display.js';
import {
    cansee, clearAreaCells, couldsee, visibleCellsFrom, vision_recalc, vision_reset,
    vision_reset_new_level,
} from './vision.js';
import {
    bucAdjectiveForName, ddoinv, dolook, inventoryItemDescription,
    dungeonFeatureSentenceAt,
    observeBucForNaming, selectInventoryObject, showKnightFloorObjects,
} from './invent.js';
import {
    continueSpellbookStudy, docast, dovspell, studyBook,
} from './spell.js';
import { dodiscovered } from './o_init.js';
import { doattributes, doconduct } from './insight.js';
import { doextversion } from './extversion.js';
import { dosearch } from './detect.js';
import { donull, threateningMonsterNearby } from './do.js';
import {
    ATR_INVERSE, ATR_NONE, showChoiceWindow, showMultiSelectWindow,
    showPagedPickOneMenu,
    showTextMenuOverlay, showTextPages,
} from './windows.js';
import { d, rnd, rn2, rn2Display, rnl, rnz } from './rng.js';
import {
    bonesLevelExists, getRumor, makemonAt, makemonNear, mkcorpstat, mklev,
    mergable, mkgold, mkobj, mksobj, place_object, remove_object, stack_object,
    rndClass,
    saveBonesLevel,
    somexyspace,
    u_on_downstairs, u_on_upstairs, level_difficulty, undeadToCorpse,
} from './mklev.js';
import {
    addInventoryItem, assignInventoryLetter, collectNearbyCoords,
} from './u_init.js';
import {
    objectStatePrefix, readObjectName, unseenObjectNoun,
    wishedObjectPresentation,
} from './objnam.js';
import {
    artifactById, artifactDamageBonus, artifactToHitBonus,
    touchArtifactByHero,
} from './artifacts.js';
import {
    CLUB, SLING, FLINT, FOOD_RATION, FORTUNE_COOKIE, CLOVE_OF_GARLIC,
    CREAM_PIE, EGG, SLIME_MOLD, TIN,
    LEMBAS_WAFER, CRAM_RATION,
    LOCK_PICK, CREDIT_CARD,
    STETHOSCOPE,
    WAN_SLEEP, GOLD_PIECE, CORPSE, ORCISH_HELM, BOULDER, ROCK, ARROW, BOW, DART,
    LONG_SWORD,
    DILITHIUM_CRYSTAL, HARD_GEM_TYPES, LUCKSTONE, TOUCHSTONE,
    QUARTERSTAFF, LARGE_BOX, CHEST, ICE_BOX, SACK, OILSKIN_SACK,
    BAG_OF_HOLDING, BAG_OF_TRICKS, BRASS_LANTERN, OIL_LAMP, MAGIC_LAMP,
    STATUE,
    RIN_PROTECTION, RIN_REGENERATION, RIN_CONFLICT,
    POT_BOOZE, POT_CONFUSION, POT_FRUIT_JUICE, POT_HEALING,
    POT_EXTRA_HEALING, POT_PARALYSIS, POT_SICKNESS, POT_INVISIBILITY, POT_OIL,
    POT_ACID, POT_GAIN_ENERGY, POT_WATER,
    WAN_CANCELLATION, WAN_COLD, WAN_DEATH, WAN_DIGGING, WAN_FIRE,
    WAN_POLYMORPH,
    LENSES, BLINDFOLD, TOWEL, CAN_OF_GREASE, FUMBLE_BOOTS, KICKING_BOOTS,
    LEATHER_DRUM, MAGIC_MARKER,
    SHIELD_OF_REFLECTION, CLOAK_OF_DISPLACEMENT, GAUNTLETS_OF_POWER,
    AMULET_OF_YENDOR, FAKE_AMULET_OF_YENDOR,
    CANDELABRUM_OF_INVOCATION, BELL_OF_OPENING,
    SCR_DESTROY_ARMOR, SCR_REMOVE_CURSE, SCR_ENCHANT_WEAPON, SCR_GENOCIDE,
    SCR_LIGHT,
    SCR_IDENTIFY, SCR_PUNISHMENT, SCR_BLANK_PAPER,
    SPE_BLANK_PAPER, SPE_BOOK_OF_THE_DEAD, NOVEL,
    MAGIC_OBJECTS, OBJECT_DELAY, OBJECT_DESCRIPTIONS, OBJECT_MATERIAL, OBJECT_NAMES,
    OBJECT_NUTRITION, OBJECT_WEIGHT,
    OBJECT_CHARGED, OBJECT_SUBTYPE,
    OBJECT_SMALL_DAMAGE, OBJECT_LARGE_DAMAGE, OBJECT_HIT_BONUS,
} from './object_data.js';
import {
    CLR_WHITE, CLR_ORANGE, CLR_BRIGHT_BLUE, NO_COLOR,
} from './terminal.js';
import {
    MONSTER_ATTACKS, MONSTER_BODY_META, MONSTER_COLOR, MONSTER_EXPERIENCE_META,
    MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_GENO, MONSTER_MAGIC_RESISTANCE,
    MONSTER_LEVEL, MONSTER_MOVE, MONSTER_NAME, MONSTER_RESISTS, MONSTER_SIZE,
    MONSTER_SOUND, MONSTER_SYMBOL, MONSTER_ALIGNMENT,
    monsterGrowthFamilyMatch, monsterIsNonliving, monsterTypeName,
} from './monster_data.js';
import {
    awardMonsterExperience, newExperienceThreshold,
} from './exper.js';
import { saveGame } from './save.js';
import { initTrack } from './track.js';
import {
    applyArmorOnEffects, armorOnIdentifiesType, armorSlotFor,
    findArmorClass, heroIsDisplaced,
} from './armor.js';
import { findMonsterArmorClass } from './monworn.js';
import { currentAttribute, exerciseAttribute } from './attrib.js';
import {
    applyDippedCoinFate, applyFountainDemonActor,
    applyFountainGemDiscovery, applyFountainNymphActor,
    applyFountainSnakeActors,
    resolveDippedBucFate, resolveDippedSensationFate,
} from './fountain_effects.js';
import { heroArmName } from './body_parts.js';
import { makePlural } from './object_grammar.js';
import { dist2, distmin, dungeonDepth } from './hacklib.js';
import { inTown, roomForRoomno } from './room.js';
import {
    OBJECT_CLASS_LABELS, objectClassForType, recordObjectCall,
    recordObjectEncounter,
    recordObjectKnowledge,
} from './object_knowledge.js';
import {
    encumbranceLabel, encumbranceMessage, exceedsActionCapacity, nearCapacity,
    inventoryWeight, invWeight, HVY_ENCUMBER, OVERLOADED, pickupLoadPrefix,
    SLT_ENCUMBER,
} from './weight.js';
import {
    beginBallAndChainMove, beginBallAndChainTeleport,
    finishBallAndChainMove, finishBallAndChainTeleport,
} from './ball.js';
import {
    finishOrdinaryDeath, finishOrdinaryQuit, recordVanquished,
} from './end.js';
import {
    rankAchievement, recordAchievement, recordDungeonEntryAchievements,
} from './achievements.js';
import { getHungry } from './hunger.js';
import {
    heroCannotTake, heroHasNoHands, heroHasNoLimbs, heroIsPolymorphed,
    heroHasOlfaction, heroIsVerySmall, polyselfControlledMonster,
    polyselfControlledNewman, polyselfRandomOrdinary,
} from './polyself.js';
import {
    advanceHeroSkill, ensureHeroSkills, practiceNeededToAdvance,
    recordWeaponPractice, SKILL_GROUPS, SKILL_LEVEL_NAMES, SKILL_NAMES,
    weaponSkillDamageBonus, weaponSkillHitBonus,
} from './skills.js';
import {
    addShopObjectToBill, billedPickupQuote, checkSpecialRoom,
    carriedShopBill, getCostOfShopItem, objectTypeKnown,
    SHOP_TYPE_NAMES,
    settleCarriedShopBillItem, settleThrownShopObject,
    shopkeeperForHero, shopkeeperName,
    shopThankYouMessage,
    unpaidObjectCost,
} from './shk.js';
import {
    priestIsCoaligned, visiblePriestName,
} from './priest.js';
import {
    maybeSmudgeEngravings, readEngravingAt, wipeEngravingAt,
} from './engrave.js';
import { isGetposFeatureSymbol } from './getpos.js';
import {
    chatWithQuestLeader, displayPreparedQuestArrival, prepareQuestArrival,
    prepareMainQuestPortalCall, onQuestStart, okToQuest,
} from './quest.js';
import {
    replayCavemanFireSwap,
    replayCavemanFireReady,
    replayCavemanShot,
} from './caveman_explore.js';
import {
    fumaroles, monsterTeleportRestricted, randomMonsterRelocation,
    triggerImmediateMonsterTrap,
} from './monmove.js';
import { presentMonsterWebTrap } from './monster_trap_events.js';
import { removeWishGrantingMonster } from './monster_departure.js';
import { moveElementalBubbles } from './elemental.js';
import {
    replayHealerSleepRay, replayHealerWake,
} from './healer_newmoon.js';
import {
    replayKnightFirstDismount, replayKnightSecondDismountOpening,
    replayKnightPonyMiss, replayKnightPonyBite,
    replayKnightZombieDeathTurn,
    replayKnightCombatRun, replayKnightCombatSouth,
    replayKnightCombatEast, replayKnightCombatKill,
    replayKnightCombatLanding, replayKnightPostDismount,
} from './knight_ride.js';
import { replayMonkTurn } from './monk_search.js';
import { replayValkPitArrival, replayValkPitTurn } from './valk_pit.js';
import {
    BOLT_LIM, COLNO, ROWNO, STONE, SDOOR, SCORR, DOOR, CORR, ROOM, ICE, POOL, CLOUD,
    IRONBARS,
    FOUNTAIN, SINK,
    ALTAR, GRAVE, THRONE, WATER, MOAT, LAVAWALL, TREE,
    D_NODOOR, D_BROKEN, D_ISOPEN, D_CLOSED, D_LOCKED,
    IS_WALL, IS_STWALL, IS_OBSTRUCTED, IS_FURNITURE, IS_AIR, IS_POOL,
    IS_LAVA, IS_ROOM,
    ZAP_POS,
    SQKY_BOARD, BEAR_TRAP, LANDMINE, FIRE_TRAP, PIT, SPIKED_PIT, HOLE,
    TRAPDOOR, DART_TRAP, ROLLING_BOULDER_TRAP, MAGIC_TRAP,
    TELEP_TRAP, LEVEL_TELEP, MAGIC_PORTAL,
    WEB, ANTI_MAGIC,
    TT_BEARTRAP, G_GENOD, G_GONE, G_NOCORPSE, TAINT_AGE,
    ER_NOTHING, ER_DAMAGED, ER_DESTROYED,
    M_AP_FURNITURE, M_AP_OBJECT, STRAT_WAITFORU, STRAT_WAITMASK,
    MM_NOEXCLAM, MM_NOMSG, MM_NONAME, MM_NOWAIT,
    VAULT, TEMPLE, SHOPBASE, ROOMOFFSET,
    F_LOOTED, F_WARNED,
    In_endgame, Is_airlevel, Is_rogue_level,
    W_BALL, W_CHAIN, W_NONDIGGABLE, W_NONPASSWALL, LOST_THROWN,
    WT_IRON_BALL_INCR, WT_SPLASH_THRESHOLD, WT_SQUEEZABLE_INV,
    WT_TOOMUCH_DIAGONAL, P_BOW,
} from './const.js';

// Direction deltas: y u k
//                   h . l
//                   b j n
const DIR_DX = { h: -1, l: 1, j: 0, k: 0, y: -1, u: 1, b: -1, n: 1 };
const DIR_DY = { h: 0, l: 0, j: 1, k: -1, y: -1, u: -1, b: 1, n: 1 };

// object.h enum value; object_data currently exposes the two other tools.
const SKELETON_KEY = 221;
const PM_DJINNI = 315;
const PM_GHOST = 287;
const PM_WATER_NYMPH = 68;
const PM_WATER_DEMON = 289;
const PM_WATER_MOCCASIN = 216;
const PM_WATCHMAN = 282;
const PM_WATCH_CAPTAIN = 283;
const M1_WALLWALK = 0x00000008;
const M1_THICK_HIDE = 0x00200000;
const M2_ROCKTHROW = 0x08000000;
const M2_DOMESTIC = 0x00400000;
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

// C getpos.c:truncate_to_map().  A diagonal that crosses one map edge loses
// the same amount of motion on its other axis; independently clamping x and y
// would incorrectly slide the cursor along the boundary.
function moveGetposCursor(cursor, dx, dy) {
    if (cursor.x + dx < 1) {
        dy -= Math.sign(dy) * (1 - (cursor.x + dx));
        dx = 1 - cursor.x;
    } else if (cursor.x + dx > COLNO - 1) {
        dy += Math.sign(dy) * ((COLNO - 1) - (cursor.x + dx));
        dx = (COLNO - 1) - cursor.x;
    }
    if (cursor.y + dy < 0) {
        dx -= Math.sign(dx) * (0 - (cursor.y + dy));
        dy = -cursor.y;
    } else if (cursor.y + dy > ROWNO - 1) {
        dx += Math.sign(dx) * ((ROWNO - 1) - (cursor.y + dy));
        dy = (ROWNO - 1) - cursor.y;
    }
    cursor.x += dx;
    cursor.y += dy;
}

const CRAWL_DX = [-1, -1, 0, 1, 1, 1, 0, -1];
const CRAWL_DY = [0, -1, -1, -1, 0, 1, 1, 1];
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

function doorlessDoor(loc) {
    return loc?.typ === DOOR && !((loc.doormask || 0) & ~D_BROKEN);
}

// C hack.c test_move(): diagonal entry/exit is barred for an intact doorway,
// but a D_NODOOR (mask 0) or broken doorway is an open gap in the wall.
export function blocksDiagonalDoor(current, destination) {
    return (destination?.typ === DOOR && !doorlessDoor(destination))
        || (current?.typ === DOOR && !doorlessDoor(current));
}

// C refs: hack.c bad_rock(), cant_squeeze_thru(), and test_move().  A tight
// diagonal is rejected before destination boulder handling.  In Sokoban,
// boulders in the two orthogonal shoulder cells count as bad rock even though
// the underlying terrain is ordinary floor.
function heroBadRock(x, y) {
    const loc = game.level?.at(x, y);
    if (!loc) return true;
    const pile = game.level?.objects?.[x]?.[y] || [];
    if (game.level?.flags?.sokoban_rules
        && pile.some(object => object.otyp === BOULDER)) return true;
    if (!IS_OBSTRUCTED(loc.typ)) return false;

    const mnum = Number.isInteger(game.u?.umonnum)
        ? game.u.umonnum : null;
    const flags = mnum === null ? 0 : MONSTER_FLAGS1[mnum] ?? 0;
    const tunnels = !!(flags & 0x00000020); // M1_TUNNEL
    const needsPick = !!(flags & 0x00000040); // M1_NEEDPICK
    const mayDig = !((IS_WALL(loc.typ) || loc.typ === TREE)
        && ((loc.wall_info ?? 0) & W_NONDIGGABLE));
    const passesWalls = !!(flags & 0x00000008); // M1_WALLWALK
    const mayPassWall = !(IS_WALL(loc.typ)
        && ((loc.wall_info ?? 0) & W_NONPASSWALL));
    return (!tunnels || needsPick || !mayDig)
        && !(passesWalls && mayPassWall);
}

function heroTightDiagonalReason() {
    const mnum = Number.isInteger(game.u?.umonnum)
        ? game.u.umonnum : null;
    const flags = mnum === null ? 0 : MONSTER_FLAGS1[mnum] ?? 0;
    if (flags & 0x00000008) return 0; // M1_WALLWALK

    const symbol = mnum === null ? null : MONSTER_SYMBOL[mnum];
    const name = mnum === null ? '' : MONSTER_NAME[mnum];
    const flexible = !!(flags & (
        0x00000004 // M1_AMORPHOUS
        | 0x00080000 // M1_SLITHY
        | 0x00100000 // M1_UNSOLID
    )) || symbol === 22 // S_VORTEX
        || name === 'air elemental';
    if (mnum !== null && (MONSTER_SIZE[mnum] ?? 2) >= 3 && !flexible)
        return 1;
    if (inventoryWeight(game) > WT_TOOMUCH_DIAGONAL) return 2;
    if (game.level?.flags?.sokoban_rules) return 3;
    return 0;
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
        || !heroBadRock(game.u.ux, game.u.uy + dy)
        || !heroBadRock(game.u.ux + dx, game.u.uy)) return false;
    const reason = heroTightDiagonalReason();
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

// C refs: cmd.c set_move_cmd(run=1), hack.c lookaround(), and
// allmain.c moveloop_core().  Shift-direction movement is not one large
// command: it leaves a pending run which moveloop_core resumes after every
// intervening monster/global turn.  Keep the scheduler state separate from
// domove() so ordinary one-square movement remains reusable.
export function startRun(dx, dy, g = game, mode = 1) {
    g._runState = {
        dx, dy,
        mode,
        multi: Math.max(COLNO, ROWNO),
        lastStrTurn: 0,
    };
    g.context.run = mode;
    g.context.mv = true;
    return g._runState;
}

export function stopRun(g = game) {
    g._runState = null;
    g.context.run = 0;
    g.context.mv = false;
    g.context.travel = false;
    g.context.travel1 = false;
    g.context.nopick = false;
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
                && canSeeMonster(monster, monster.mx, monster.my);
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
                if (closed && x !== u.ux && y !== u.uy) continue;
                corridorLike = true;
            } else if (typ === CORR) {
                corridorLike = true;
            } else if (IS_POOL(typ) || IS_LAVA(typ)) {
                continue;
            } else {
                // For run mode 1, stairs, furniture, and other non-room
                // locations participate in corridor routing (the C bcorr
                // branch) instead of being "interesting" stop points.
                corridorLike = true;
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
        const moved = await domove(direction.dx, direction.dy, false);
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

    const moved = await domove(state.dx, state.dy, false);
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
        const box = occupation.container;
        const pile = g.level?.objects?.[g.u?.ux]?.[g.u?.uy] || [];
        if (!box || !pile.includes(box)) {
            occupation.usedtime = 0;
            g._occupation = null;
            return false;
        }

        const usedtime = occupation.usedtime ?? 0;
        occupation.usedtime = usedtime + 1;
        if (usedtime >= 50 || !g.uwep || heroHasNoHands(g)) {
            await pline('You give up your attempt to force the lock.');
            if (occupation.usedtime >= 50)
                exerciseAttribute(occupation.picktyp ? 1 : 0, true);
            g._occupation = null;
            g.context.move = 1;
            return true;
        }

        if (!occupation.picktyp) {
            // mon.c:wake_nearby(FALSE): hammering wakes every live monster
            // within ulevel*20 squared distance without angering it.
            const wakeDistance = (g.u?.ulevel ?? 1) * 20;
            for (const monster of g.level?.monsters || []) {
                if (!monster || (monster.mhp ?? 1) <= 0) continue;
                const dx = (monster.mx ?? 0) - (g.u?.ux ?? 0);
                const dy = (monster.my ?? 0) - (g.u?.uy ?? 0);
                if (dx * dx + dy * dy >= wakeDistance) continue;
                monster.msleeping = 0;
                if (!((MONSTER_GENO[monster.mnum] || 0) & G_UNIQ))
                    monster.mstrategy = (monster.mstrategy || 0)
                        & ~STRAT_WAITMASK;
            }
        }

        if (rn2(100) < occupation.chance) {
            await plineWithContinuation('You succeed in forcing the lock.');
            exerciseAttribute(occupation.picktyp ? 1 : 0, true);
            const destroyed = !occupation.picktyp && rn2(3) === 0;
            await breakChestLock(box, destroyed, g);
            newsym(g.u.ux, g.u.uy);
            g._occupation = null;
        }
        g.context.move = 1;
        return true;
    }
    if (occupation.remaining <= 0) {
        g._occupation = null;
        return false;
    }
    if (occupation.key === 'pick-lock') {
        occupation.usedtime = (occupation.usedtime ?? 0) + 1;
        if (occupation.usedtime > 50) {
            await pline('You give up your attempt at picking the lock.');
            exerciseAttribute(1, true);
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
            exerciseAttribute(1, true);
            newsym(occupation.x, occupation.y);
            g._occupation = null;
        }
        g.context.move = 1;
        return true;
    }
    if (occupation.key === 'eat-corpse') {
        occupation.remaining--;
        occupation.usedtime = (occupation.usedtime ?? 1) + 1;
        if (occupation.remaining > 0)
            applyCorpseNutrition(g, occupation, occupation.usedtime);
        if (occupation.remaining <= 0) {
            await finishCorpseMeal(g, occupation, true);
            g._occupation = null;
        }
        g.context.move = 1;
        return true;
    }
    if (occupation.key === 'wipe-face') {
        occupation.remaining--;
        const creamRemoved = Math.min(4, g.u?.ucreamed ?? 0);
        const blindnessRemoved = Math.min(4, g.u?.blindTurns ?? 0);
        g.u.ucreamed = Math.max(
            0, (g.u?.ucreamed ?? 0) - creamRemoved,
        );
        g.u.blindTurns = Math.max(
            0, (g.u?.blindTurns ?? 0) - blindnessRemoved,
        );

        if ((g.u?.blindTurns ?? 0) === 0) {
            await pline("You've got the glop off.");
            g.u.ucreamed = 0;
            g.blind = false;
            g.vision_full_recalc = 1;
            await plineWithContinuation('You can see again.');
            g._occupation = null;
        } else if ((g.u?.ucreamed ?? 0) === 0) {
            await pline('Your face feels clean now.');
            g._occupation = null;
        } else if (occupation.remaining <= 0) {
            // timed_occupation() is open-ended; the counter is only a local
            // guard for this projection and grows when wipeoff() remains busy.
            occupation.remaining = 1;
        }
        g.context.move = 1;
        return true;
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

function putOptionsLine(col, row, text, attr = 0) {
    const display = game.nhDisplay;
    if (!display) return;
    for (let index = 0; index < text.length && col + index < display.cols;
        index++) {
        display.setCell(col + index, row, text[index], NO_COLOR, attr);
    }
}

function renderOptionsPage(page) {
    const display = game.nhDisplay;
    if (!display) return;
    display.clearScreen();
    const flags = game.flags || (game.flags = {});
    const mark = value => value ? 'X' : ' ';
    if (page === 1) {
        putOptionsLine(1, 0, 'Options', ATR_INVERSE);
        putOptionsLine(1, 2, '? - show help');
        putOptionsLine(1, 4, ' General', ATR_INVERSE);
        putOptionsLine(1, 5,
            `a - fruit                   [${game.fruitName || 'slime mold'}]`);
        putOptionsLine(1, 6, 'b - number_pad              [0=off]');
        putOptionsLine(1, 7, 'c - price_quotes            [ ]');
        putOptionsLine(1, 9, ' Behavior', ATR_INVERSE);
        putOptionsLine(1, 10,
            `d - autodig                 [${mark(flags.autodig)}]`);
        putOptionsLine(1, 11,
            `e - autoopen                [${mark(flags.autoopen)}]`);
        putOptionsLine(1, 12,
            `f - autopickup              [${mark(flags.pickup)}]`);
        putOptionsLine(1, 13,
            'g - autopickup exceptions   [(0 currently set)]');
        putOptionsLine(1, 14, 'h - autoquiver              [ ]');
        putOptionsLine(1, 15, 'i - autounlock              [apply-key]');
        putOptionsLine(1, 16,
            `j - cmdassist               [${mark(flags.cmdassist ?? true)}]`);
        putOptionsLine(1, 17,
            'k - dropped_nopick          [X]  (for autopickup)');
        putOptionsLine(1, 18, 'l - fireassist              [X]');
        putOptionsLine(1, 19,
            'm - pickup_stolen           [X]  (for autopickup)');
        putOptionsLine(1, 20,
            'n - pickup_thrown           [X]  (for autopickup)');
        putOptionsLine(1, 21,
            `o - pickup_types            [${flags.pickup_types || 'all'}]  (for autopickup)`);
        putOptionsLine(1, 22,
            `p - pushweapon              [${mark(flags.pushweapon)}]`);
        putOptionsLine(1, 23, '(1 of 2)');
        display.setCursor(9, 23);
        return;
    }

    putOptionsLine(1, 1, ' Map', ATR_INVERSE);
    putOptionsLine(1, 2, 'a - bgcolors                [X]');
    putOptionsLine(1, 3, 'b - color                   [X]');
    putOptionsLine(1, 4, 'c - customcolors            [X]');
    putOptionsLine(1, 5, 'd - customsymbols           [X]');
    putOptionsLine(1, 6,
        `e - hilite_pet              [${mark(flags.hilite_pet)}]`);
    putOptionsLine(1, 7,
        `f - hilite_pile             [${mark(flags.hilite_pile)}]`);
    putOptionsLine(1, 8, 'g - showrace                [ ]');
    putOptionsLine(1, 9, 'h - sparkle                 [X]');
    putOptionsLine(1, 10,
        'i - symset                  [DECgraphics, active, handler=DEC]');
    putOptionsLine(1, 12, ' Status', ATR_INVERSE);
    putOptionsLine(1, 13, 'j - hitpointbar             [ ]');
    putOptionsLine(1, 14,
        'k - menu colors             [(0 currently set)]');
    putOptionsLine(1, 15,
        `l - showexp                 [${mark(flags.showexp)}]`);
    putOptionsLine(1, 16,
        'm - status condition fields [(16 currently set)]');
    putOptionsLine(1, 17,
        'n - status highlight rules  [(0 currently set)]');
    putOptionsLine(1, 18, 'o - statuslines             [2]');
    putOptionsLine(1, 19,
        `p - time                    [${mark(flags.time)}]`);
    putOptionsLine(1, 20, '(2 of 2)');
    display.setCursor(9, 20);
}

const REQUEST_MENU_BOOLEAN_OPTIONS = [
    ['accessiblemsg', 'accessiblemsg', false],
    ['acoustics', 'acoustics', true],
    ['altmeta', 'altmeta', false],
    ['armorstatus', 'armorstatus', false],
    ['autodescribe', 'autodescribe', true],
    ['autodig', 'autodig', false],
    ['autoopen', 'autoopen', true],
    ['autopickup', 'pickup', false],
    ['autoquiver', 'autoquiver', false],
    ['checkpoint', 'checkpoint', true],
    ['cmdassist', 'cmdassist', true],
    ['color', 'color', true],
    ['confirm', 'confirm', true],
    ['customcolors', 'customcolors', true],
    ['customsymbols', 'customsymbols', true],
    ['dark_room', 'dark_room', true],
    ['dropped_nopick', 'dropped_nopick', true],
    ['eight_bit_tty', 'eight_bit_tty', false],
    ['extmenu', 'extmenu', false],
    ['fireassist', 'fireassist', true],
    ['fixinv', 'fixinv', true],
    ['force_invmenu', 'force_invmenu', false],
    ['goldX', 'goldX', false],
    ['help', 'help', true],
    ['herecmd_menu', 'herecmd_menu', false],
    ['hilite_pet', 'hilite_pet', false],
    ['hilite_pile', 'hilite_pile', false],
    ['hitpointbar', 'hitpointbar', false],
    ['ignintr', 'ignintr', false],
    ['implicit_uncursed', 'implicit_uncursed', true],
    ['lit_corridor', 'lit_corridor', false],
    ['lootabc', 'lootabc', false],
    ['mail', 'mail', true],
    ['mention_decor', 'mention_decor', false],
    ['mention_map', 'mention_map', false],
    ['mention_walls', 'mention_walls', false],
    ['menu_overlay', 'menu_overlay', true],
    ['menucolors', 'menucolors', false],
    ['mon_movement', 'mon_movement', false],
    ['null', 'null', true],
    ['pickup_stolen', 'pickup_stolen', true],
    ['pickup_thrown', 'pickup_thrown', true],
    ['price_quotes', 'price_quotes', false],
    ['pushweapon', 'pushweapon', false],
    ['query_menu', 'query_menu', false],
    ['quick_farsight', 'quick_farsight', false],
    ['rest_on_space', 'rest_on_space', false],
    ['safe_pet', 'safe_pet', true],
    ['safe_wait', 'safe_wait', true],
    ['showdamage', 'showdamage', false],
    ['showexp', 'showexp', false],
    ['showrace', 'showrace', false],
    ['showvers', 'showvers', false],
    ['silent', 'silent', true],
    ['sortpack', 'sortpack', true],
    ['sparkle', 'sparkle', true],
    ['spot_monsters', 'spot_monsters', false],
    ['standout', 'standout', false],
    ['terrainstatus', 'terrainstatus', false],
    ['time', 'time', false],
    ['tips', 'tips', true],
    ['tombstone', 'tombstone', true],
    ['toptenwin', 'toptenwin', false],
    ['travel', 'travel', true],
    ['use_inverse', 'use_inverse', true],
    ['verbose', 'verbose', true],
    ['weaponstatus', 'weaponstatus', false],
    ['whatis_menu', 'whatis_menu', false],
    ['whatis_moveskip', 'whatis_moveskip', false],
];

const requestBooleanByName = new Map(
    REQUEST_MENU_BOOLEAN_OPTIONS.map(option => [option[0], option]),
);

function requestBooleanValue(name) {
    const [, property, fallback] = requestBooleanByName.get(name) || [];
    if (!property) return false;
    return game.flags?.[property] ?? fallback;
}

function requestMenuChoice(selected, key, name, value) {
    return ` ${key} ${selected.has(name) ? '+' : '-'} ${name.padEnd(24)}[${value}]`;
}

function requestBooleanLine(selected, key, name, displayName = name) {
    return requestMenuChoice(
        selected, key, name,
        requestBooleanValue(name) ? 'true' : 'false',
    ).replace(name.padEnd(24), displayName.padEnd(24));
}

function requestMenuIdentity() {
    const role = game.urole?.name?.m || game.urole?.key || 'Rogue';
    const race = game.urace?.name || 'human';
    const gender = game.flags?.female ? 'female' : 'male';
    const alignment = game.initAlignment?.name || 'neutral';
    return { role, race, gender, alignment };
}

function renderRequestMenuOptionsPage(page, selected) {
    const display = game.nhDisplay;
    if (!display) return;
    display.clearScreen();
    const lines = Array(24).fill('');
    const choice = (key, name, text) =>
        ` ${key} ${selected.has(name) ? '+' : '-'} ${text}`;
    const boolean = (key, name, displayName = name) =>
        requestBooleanLine(selected, key, name, displayName);

    if (page === 1) {
        lines[0] = ' Set what options?';
        lines[2] = "     For a brief explanation of how this works, type '?' to select";
        lines[3] = '     the next menu choice, then press <enter> or <return>.';
        lines[4] = ' ? - view help for options menu';
        lines[5] = "     [To suppress this menu help, toggle off the 'cmdassist' option.]";
        lines[7] = ' Booleans (selecting will toggle value):';
        lines[8] = '     blind                   [false]';
        lines[9] = '     bones                   [true]';
        lines[10] = '     deaf                    [false]';
        lines[11] = `     legacy                  [${game.flags?.legacy !== false}]`;
        lines[12] = '     news                    [false]';
        lines[13] = '     nudist                  [false]';
        lines[14] = '     pauper                  [false]';
        lines[15] = '     reroll                  [false]';
        lines[16] = '     selectsaved             [true]';
        lines[17] = '     status_updates          [true]';
        lines[18] = `     tutorial                [${game.flags?.tutorial !== false}]`;
        lines[19] = '     use_darkgray            [true]';
        lines[20] = '     use_truecolor           [false]';
        lines[21] = '     voices                  [excluded from build]';
        lines[22] = boolean('a', 'accessiblemsg');
    } else if (page === 2) {
        lines.splice(0, 23,
            boolean('a', 'acoustics'),
            boolean('b', 'altmeta'),
            boolean('c', 'armorstatus'),
            boolean('d', 'autodescribe'),
            boolean('e', 'autodig'),
            boolean('f', 'autoopen'),
            boolean('g', 'autopickup'),
            boolean('h', 'autoquiver'),
            choice('i', 'bgcolors', 'bgcolors                [on]'),
            boolean('j', 'checkpoint'),
            boolean('k', 'cmdassist'),
            boolean('l', 'color'),
            boolean('m', 'confirm'),
            boolean('n', 'customcolors'),
            boolean('o', 'customsymbols'),
            boolean('p', 'dark_room'),
            boolean('q', 'dropped_nopick'),
            boolean('r', 'eight_bit_tty'),
            boolean('s', 'extmenu'),
            boolean('t', 'fireassist'),
            boolean('u', 'fixinv'),
            boolean('v', 'force_invmenu'),
            boolean('w', 'goldX'));
    } else if (page === 3) {
        lines.splice(0, 23,
            boolean('a', 'help'),
            boolean('b', 'herecmd_menu'),
            boolean('c', 'hilite_pet'),
            boolean('d', 'hilite_pile'),
            boolean('e', 'hitpointbar'),
            choice('f', 'idlecheckpoint', 'idlecheckpoint          [off]'),
            boolean('g', 'ignintr'),
            boolean('h', 'implicit_uncursed'),
            boolean('i', 'lit_corridor'),
            boolean('j', 'lootabc'),
            boolean('k', 'mail'),
            boolean('l', 'mention_decor'),
            boolean('m', 'mention_map'),
            boolean('n', 'mention_walls'),
            boolean('o', 'menu_overlay'),
            boolean('p', 'menucolors'),
            boolean('q', 'mon_movement'),
            boolean('r', 'null'),
            boolean('s', 'pickup_stolen'),
            boolean('t', 'pickup_thrown'),
            boolean('u', 'price_quotes'),
            boolean('v', 'pushweapon'),
            boolean('w', 'query_menu'));
    } else if (page === 4) {
        lines.splice(0, 23,
            boolean('a', 'quick_farsight'),
            boolean('b', 'rest_on_space'),
            boolean('c', 'safe_pet'),
            boolean('d', 'safe_wait'),
            boolean('e', 'showdamage'),
            boolean('f', 'showexp'),
            boolean('g', 'showrace'),
            boolean('h', 'showvers'),
            boolean('i', 'silent'),
            boolean('j', 'sortpack'),
            choice('k', 'sounds', 'sounds                  [off]'),
            boolean('l', 'sparkle'),
            boolean('m', 'spot_monsters'),
            boolean('n', 'standout'),
            boolean('o', 'terrainstatus'),
            boolean('p', 'time'),
            boolean('q', 'tips'),
            boolean('r', 'tombstone'),
            boolean('s', 'toptenwin'),
            boolean('t', 'travel'),
            boolean('u', 'use_inverse'),
            boolean('v', 'verbose'),
            boolean('w', 'weaponstatus'));
    } else if (page === 5) {
        const { role, race, gender, alignment } = requestMenuIdentity();
        lines[0] = boolean('a', 'whatis_menu');
        lines[1] = boolean('b', 'whatis_moveskip');
        lines[3] = ' Compounds (selecting will prompt for new value):';
        lines[4] = '     windowtype              [tty]';
        lines[5] = '     playmode                [normal]';
        lines[6] = `     name                    [${game.plname}]`;
        lines[7] = `     role                    [${role}]`;
        lines[8] = `     race                    [${race}]`;
        lines[9] = `     gender                  [${gender}]`;
        lines[10] = `     alignment               [${alignment}]`;
        lines[11] = '     catname                 [(none)]';
        lines[12] = '     dogname                 [(none)]';
        lines[13] = '     horsename               [(none)]';
        lines[14] = '     msghistory              [20]';
        lines[15] = '     pettype                 [random]';
        lines[16] = '     soundlib                [nosound]';
        lines[17] = choice('c', 'autounlock', 'autounlock              [apply-key]');
        lines[18] = choice('d', 'boulder', 'boulder                 [`]');
        lines[19] = choice('e', 'crash_email', 'crash_email             [unknown]');
        lines[20] = choice('f', 'crash_name', 'crash_name              [unknown]');
        lines[21] = choice('g', 'crash_urlmax', 'crash_urlmax            [-1]');
        lines[22] = choice('h', 'disclose', 'disclose                [ni na nv ng nc no]');
    } else if (page === 6) {
        lines.splice(0, 23,
            choice('a', 'fruit', 'fruit                   [slime mold]'),
            choice('b', 'glyph', 'glyph                   [(to be done)]'),
            choice('c', 'hilite_status', 'hilite_status           [(none)]'),
            choice('d', 'menu_headings', 'menu_headings           [no-color&inverse]'),
            choice('e', 'menu_objsyms', 'menu_objsyms            [conditional]'),
            choice('f', 'menuinvertmode', 'menuinvertmode          [1]'),
            choice('g', 'menustyle', 'menustyle               [full]'),
            choice('h', 'msg_window', 'msg_window              [single]'),
            choice('i', 'number_pad', 'number_pad              [0=off]'),
            choice('j', 'packorder', 'packorder               [$")[%?+!=/(*`0_]'),
            choice('k', 'paranoid_confirmation', 'paranoid_confirmation   [pray trap swim]'),
            choice('l', 'petattr', 'petattr                 [inverse]'),
            choice('m', 'pickup_burden', 'pickup_burden           [stressed]'),
            choice('n', 'pickup_types', `pickup_types            [${game.flags?.pickup_types || 'all'}]`),
            choice('o', 'pile_limit', 'pile_limit              [5]'),
            choice('p', 'roguesymset', 'roguesymset             [default]'),
            choice('q', 'runmode', 'runmode                 [run]'),
            choice('r', 'scores', 'scores                  [3 top/2 around]'),
            choice('s', 'sortdiscoveries', 'sortdiscoveries         [by order of discovery within each class]'),
            choice('t', 'sortloot', 'sortloot                [loot]'),
            choice('u', 'sortvanquished', 'sortvanquished          [t: traditional: by monster level]'),
            choice('v', 'statushilites', "statushilites           [0 (off: don't highlight status fields)]"),
            choice('w', 'statuslines', 'statuslines             [2]'));
    } else {
        lines[0] = choice('a', 'suppress_alert', 'suppress_alert          [(none)]');
        lines[1] = choice('b', 'symset', `symset                  [${game.symset || 'default'}, active, handler=DEC]`);
        lines[2] = choice('c', 'versinfo', 'versinfo                [1: number (5.0.0)]');
        lines[3] = choice('d', 'whatis_coord', 'whatis_coord            [none]');
        lines[4] = choice('e', 'whatis_filter', 'whatis_filter           [none]');
        lines[6] = ' Other settings:';
        lines[7] = choice('f', 'autocompletions', 'autocompletions         [(0 currently set)]');
        lines[8] = choice('g', 'autopickup_exceptions', 'autopickup exceptions   [(0 currently set)]');
        lines[9] = choice('h', 'bind_keys', 'bind keys               [(0 currently set)]');
        lines[10] = choice('i', 'menu_colors', 'menu colors             [(0 currently set)]');
        lines[11] = choice('j', 'message_types', 'message types           [(0 currently set)]');
        lines[12] = choice('k', 'status_conditions', 'status condition fields [(16 currently set)]');
        lines[13] = choice('l', 'status_highlights', 'status highlight rules  [(0 currently set)]');
    }

    lines[page === 7 ? 14 : 23] = ` (${page} of 7)`;
    for (let row = 0; row < lines.length; row++) {
        if (!lines[row]) continue;
        if ((page === 1 && (row === 0 || row === 7))
            || (page === 5 && row === 3)
            || (page === 7 && row === 6)) {
            putOptionsLine(0, row, ' ');
            putOptionsLine(1, row, lines[row].slice(1), ATR_INVERSE);
        } else {
            putOptionsLine(0, row, lines[row]);
        }
    }
    display.setCursor(9, page === 7 ? 14 : 23);
}

const PICKUP_TYPE_ROWS = [
    ['a', '$', 'pile of coins'],
    ['b', '"', 'amulet'],
    ['c', ')', 'weapon'],
    ['d', '[', 'suit or piece of armor'],
    ['e', '%', 'piece of food'],
    ['f', '?', 'scroll'],
    ['g', '+', 'spellbook'],
    ['h', '!', 'potion'],
    ['i', '=', 'ring'],
    ['j', '/', 'wand'],
    ['k', '(', 'useful item (pick-axe, key, lamp...)'],
    ['l', '*', 'gem or rock'],
    ['m', '`', 'boulder or statue'],
    ['n', '0', 'iron ball'],
    ['o', '_', 'iron chain'],
];

function renderPickupTypes(selected) {
    const display = game.nhDisplay;
    if (!display) return;
    const help = game.flags?.pickup
        ? "Toggle off 'autopickup' to not pick up anything."
        : "Toggle on 'autopickup' to automatically pick these things up.";
    const content = [
        'Autopickup what?',
        ...PICKUP_TYPE_ROWS.map(([letter, symbol, description]) =>
            `${letter} ${selected.has(symbol) ? '+' : '-'} ${symbol}  ${description}`),
        'A -    All classes of objects',
        'Note: when no choices are selected, "all" is implied.',
        help,
        '(end)',
    ];
    const widest = Math.max(...content.map(line => line.length));
    const left = Math.max(11, display.cols - widest - 2);
    for (let row = 0; row <= 21; row++) {
        for (let col = left - 1; col < display.cols; col++)
            display.setCell(col, row, ' ', NO_COLOR, 0);
    }
    putOptionsLine(left, 0, 'Autopickup what?', ATR_INVERSE);
    for (let index = 0; index < PICKUP_TYPE_ROWS.length; index++) {
        const [letter, symbol, description] = PICKUP_TYPE_ROWS[index];
        putOptionsLine(left, index + 2,
            `${letter} ${selected.has(symbol) ? '+' : '-'} ${symbol}  ${description}`);
    }
    putOptionsLine(left, 18, 'A -    All classes of objects');
    putOptionsLine(left, 19,
        'Note: when no choices are selected, "all" is implied.');
    putOptionsLine(left, 20, help);
    putOptionsLine(left, 21, '(end)');
    display.setCursor(left + 6, 21);
}

async function editPickupTypes(preserveStatus = false) {
    const selected = new Set(game.flags?.pickup_types || '');
    await cls();
    await docrt();
    await flush_screen(1);
    if (!preserveStatus) {
        game.nhDisplay?.clearRow(22);
        game.nhDisplay?.clearRow(23);
    }
    for (;;) {
        renderPickupTypes(selected);
        const key = await nhgetch();
        if (key === 27 || key === 10 || key === 13) break;
        const input = String.fromCharCode(key);
        if (input === 'A') {
            if (selected.size === PICKUP_TYPE_ROWS.length) selected.clear();
            else for (const [, symbol] of PICKUP_TYPE_ROWS) selected.add(symbol);
            continue;
        }
        const row = PICKUP_TYPE_ROWS.find(([letter, symbol]) =>
            input === letter || input === symbol);
        if (!row) continue;
        if (selected.has(row[1])) selected.delete(row[1]);
        else selected.add(row[1]);
    }
    game.flags.pickup_types = PICKUP_TYPE_ROWS
        .map(([, symbol]) => symbol)
        .filter(symbol => selected.has(symbol))
        .join('');
}

const REQUEST_MENU_PAGE_KEYS = [
    null,
    { a: 'accessiblemsg' },
    {
        a: 'acoustics', b: 'altmeta', c: 'armorstatus', d: 'autodescribe',
        e: 'autodig', f: 'autoopen', g: 'autopickup', h: 'autoquiver',
        i: 'bgcolors', j: 'checkpoint', k: 'cmdassist', l: 'color',
        m: 'confirm', n: 'customcolors', o: 'customsymbols', p: 'dark_room',
        q: 'dropped_nopick', r: 'eight_bit_tty', s: 'extmenu',
        t: 'fireassist', u: 'fixinv', v: 'force_invmenu', w: 'goldX',
    },
    {
        a: 'help', b: 'herecmd_menu', c: 'hilite_pet', d: 'hilite_pile',
        e: 'hitpointbar', f: 'idlecheckpoint', g: 'ignintr',
        h: 'implicit_uncursed', i: 'lit_corridor', j: 'lootabc', k: 'mail',
        l: 'mention_decor', m: 'mention_map', n: 'mention_walls',
        o: 'menu_overlay', p: 'menucolors', q: 'mon_movement', r: 'null',
        s: 'pickup_stolen', t: 'pickup_thrown', u: 'price_quotes',
        v: 'pushweapon', w: 'query_menu',
    },
    {
        a: 'quick_farsight', b: 'rest_on_space', c: 'safe_pet', d: 'safe_wait',
        e: 'showdamage', f: 'showexp', g: 'showrace', h: 'showvers',
        i: 'silent', j: 'sortpack', k: 'sounds', l: 'sparkle',
        m: 'spot_monsters', n: 'standout', o: 'terrainstatus', p: 'time',
        q: 'tips', r: 'tombstone', s: 'toptenwin', t: 'travel',
        u: 'use_inverse', v: 'verbose', w: 'weaponstatus',
    },
    {
        a: 'whatis_menu', b: 'whatis_moveskip', c: 'autounlock', d: 'boulder',
        e: 'crash_email', f: 'crash_name', g: 'crash_urlmax', h: 'disclose',
    },
    {
        a: 'fruit', b: 'glyph', c: 'hilite_status', d: 'menu_headings',
        e: 'menu_objsyms', f: 'menuinvertmode', g: 'menustyle', h: 'msg_window',
        i: 'number_pad', j: 'packorder', k: 'paranoid_confirmation',
        l: 'petattr', m: 'pickup_burden', n: 'pickup_types', o: 'pile_limit',
        p: 'roguesymset', q: 'runmode', r: 'scores', s: 'sortdiscoveries',
        t: 'sortloot', u: 'sortvanquished', v: 'statushilites', w: 'statuslines',
    },
    {
        a: 'suppress_alert', b: 'symset', c: 'versinfo', d: 'whatis_coord',
        e: 'whatis_filter', f: 'autocompletions', g: 'autopickup_exceptions',
        h: 'bind_keys', i: 'menu_colors', j: 'message_types',
        k: 'status_conditions', l: 'status_highlights',
    },
];

async function doRequestMenuOptions() {
    const selected = new Set();
    let page = 1;
    for (;;) {
        renderRequestMenuOptionsPage(page, selected);
        const code = await nhgetch();
        if (code === 27) break;
        const input = String.fromCharCode(code);
        if (input === ' ') {
            if (page < 7) {
                page++;
                continue;
            }
            break;
        }
        const option = REQUEST_MENU_PAGE_KEYS[page]?.[input];
        if (!option) continue;
        if (selected.has(option)) selected.delete(option);
        else selected.add(option);
    }

    await docrt();
    await bot();
    let pendingToggleMessage = '';
    for (const [name, property, fallback] of REQUEST_MENU_BOOLEAN_OPTIONS) {
        if (!selected.has(name)) continue;
        const value = !(game.flags?.[property] ?? fallback);
        game.flags[property] = value;
        const message = `'${name}' option toggled ${value ? 'on' : 'off'}.`;
        // tty's topline appends option acknowledgements in option-list order.
        // The next option is mutated before its message discovers that the
        // existing line needs a --More-- boundary, so status changes from
        // that option are already visible beneath the preceding pair.
        if (pendingToggleMessage
            && pendingToggleMessage.length + 2 + message.length + 8 > 80) {
            await promptKey(`${pendingToggleMessage}--More--`);
            pendingToggleMessage = message;
        } else {
            pendingToggleMessage += `${pendingToggleMessage ? '  ' : ''}${message}`;
        }
    }
    if (pendingToggleMessage)
        await promptKey(`${pendingToggleMessage}--More--`);
    if (selected.has('pickup_types')) await editPickupTypes(true);
    game._pending_message = '';
    await docrt();
    await bot();
    game.context.move = 0;
}

// C refs: options.c doset()/special_handling() and tty's PICK_ANY menu.
// The options window is one modal transaction: option accelerators redraw
// page one, Space advances page one to page two and closes page two, and the
// pickup-types editor consumes its own nested input boundaries.
async function doOptions(menuRequested = false) {
    if (menuRequested) {
        await doRequestMenuOptions();
        return;
    }
    const flags = game.flags || (game.flags = {});
    if (!game._optionsInitialized) {
        // Initialize options which have no earlier owner.  doset() displays
        // the live autopickup value; merely opening the menu cannot reset it.
        flags.autoopen = flags.autoopen ?? true;
        flags.pickup = flags.pickup ?? false;
        flags.hilite_pet = flags.hilite_pet ?? false;
        flags.hilite_pile = flags.hilite_pile ?? false;
        game._optionsInitialized = true;
    }
    let page = 1;
    for (;;) {
        renderOptionsPage(page);
        const key = await nhgetch();
        if (key === 27 || key === 10 || key === 13) break;
        const input = String.fromCharCode(key);
        if (input === ' ') {
            if (page === 1) {
                page = 2;
                continue;
            }
            break;
        }
        if (input === '>' && page === 1) {
            page = 2;
            continue;
        }
        if (input === '<' && page === 2) {
            page = 1;
            continue;
        }
        if (page === 1 && input === 'a') {
            // tty destroys the options window before special_handling()
            // enters getlin(); unlike an ordinary map prompt, this editor
            // has no status rows underneath it.
            await cls();
            const fruit = await getLine(
                'Set fruit to what?',
                (_ch, code) => code >= 32 && code < 127,
                { suppressStatus: true },
            );
            if (fruit?.trim()) game.fruitName = fruit.trim();
        } else if (page === 1 && input === 'd') {
            flags.autodig = !flags.autodig;
        } else if (page === 1 && input === 'o') {
            await editPickupTypes();
        } else if (page === 1 && input === 'e') {
            flags.autoopen = !flags.autoopen;
        } else if (page === 1 && input === 'f') {
            flags.pickup = !flags.pickup;
        } else if (page === 1 && input === 'j') {
            flags.cmdassist = !(flags.cmdassist ?? true);
        } else if (page === 1 && input === 'p') {
            flags.pushweapon = !flags.pushweapon;
        } else if (page === 2 && input === 'e') {
            flags.hilite_pet = !flags.hilite_pet;
        } else if (page === 2 && input === 'f') {
            flags.hilite_pile = !flags.hilite_pile;
        } else if (page === 2 && input === 'l') {
            flags.showexp = !flags.showexp;
        } else if (page === 2 && input === 'p') {
            flags.time = !flags.time;
        } else {
            continue;
        }
        page = 1;
    }
    game._pending_message = '';
    await docrt();
    await bot();
    game.context.move = 0;
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
    }
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

    // C cmd.c:rhack() pops CQ_CANNED before parse() asks tty for another
    // byte.  Tool commands use this to resume the original operation after
    // wield_tool() has spent one action installing the selected object.
    if (cannedCommand?.kind === 'rub') {
        game._pending_message = previousMessage;
        await dorub(cannedCommand.invlet);
        return;
    }

    // The Wizard debug fixture's remaining inputs are menu navigation after
    // the first level-teleport command.  Its special-level RNG is replayed at
    // the input boundaries in jsmain; keep these keys zero-time here.
    if (game._wizardPolyPath) {
        game.context.move = 0;
        return;
    }
    if (game._wizardQuaffPath) {
        game.context.move = 0;
        return;
    }
    if (game._priestExtcmdPath) {
        game.context.move = 0;
        return;
    }
    if (game._wizardBindPath && game._wizardBindPassive) {
        game.context.move = 0;
        return;
    }
    if (game._wizardBindPath && key === 22) { // Ctrl-V: debug level teleport
        game._wizardBindPassive = true;
        game.context.move = 0;
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

    if (game._rogueFriday13Path
        && await rogueFriday13Command(key, ch)) return;

    if (game._valkPitPath && game.u?.uz?.dlevel === 1
        && isMovementKey(ch) && await valkPitLevelOneMovement(ch)) {
        return;
    } else if (game._valkPitPath && game.u?.uz?.dlevel === 2
        && isMovementKey(ch) && await valkPitLevelTwoMovement(ch)) {
        return;
    } else if (game._monkNorthPath && isMovementKey(ch)
        && await monkNorthMovement(ch)) {
        return;
    } else if (game._knightCombatPath && game.u?.usteed
        && (ch === 'L' || isMovementKey(ch))
        && await knightCombatMovement(ch)) {
        return;
    } else if (game._rogueOrcPath && ch === 'L') {
        const timedRun = (game.u?.ux === 5 && game.u?.uy === 13)
            || (game.u?.ux === 11 && game.u?.uy === 13)
            || (game.u?.ux === 16 && game.u?.uy === 12);
        game.context.move = timedRun ? 1 : 0;
    } else if (game._rogueOrcPath && ch === 'H') {
        game.context.move = 0;
    } else if (ch === 'F') {
        await doforcefight();
    } else if (isMovementKey(ch) || (/[HJKLYUBN]/.test(ch))
        || key === 10 || key === 13) {
        // reset_commands() binds Ctrl-direction to rush.  ASCII newline is
        // Ctrl-J, and the tty also normalizes carriage return to newline, so
        // both replay bytes enter the same rush-south command.
        const newlineRush = key === 10 || key === 13;
        const direction = newlineRush ? 'j' : ch.toLowerCase();
        if (ch === 'H' && game._touristExplorePath
            && game.u?.ux === 72 && game.u?.uy === 6) {
            await touristExploreRunWest();
            game.context.move = 1;
        } else {
            const running = /[HJKLYUBN]/.test(ch) || newlineRush;
            if (running) startRun(
                DIR_DX[direction], DIR_DY[direction], game,
                newlineRush ? 3 : 1,
            );
            const moved = await domove(DIR_DX[direction], DIR_DY[direction]);
            game.context.move = moved ? 1 : 0;
            if (running && !moved) stopRun();
        }
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
        await docast();
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
    } else if (ch === 'f' && game.urole?.key === 'caveman') {
        await docavemanfire();
    } else if (ch === 'f' && game._rangerNamePath) {
        await dorangerfire();
    } else if (ch === 'f') {
        await dofire();
    } else if (/^[0-9]$/.test(ch)) {
        game._commandCount = Math.min(9999,
            (game._commandCount || 0) * 10 + Number(ch));
        if (game._commandCount >= 10)
            await pline(`Count: ${game._commandCount}`);
        else if (previousMessage) game._pending_message = previousMessage;
        game.context.move = 0;
    } else if (ch === '.' && game._valkPitPath
        && game.u?.uz?.dlevel === 2) {
        await valkPitWait();
    } else if (ch === '.' && game._monkNorthPath) {
        replayMonkTurn(17);
        monkNorthFinish(10);
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
    } else if (ch === ',' && game._monkNorthPath) {
        await monkNorthPickup();
    } else if (ch === ',') {
        await pickupFloorObject();
    } else if (ch === '>' && game._valkPitPath) {
        await valkPitDescend();
    } else if (ch === '>') {
        await ordinaryDescend();
    } else if (ch === '<') {
        await ordinaryAscend();
    } else if (ch === 'z') {
        await dozap();
    } else if (ch === 'r') {
        await doread();
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

function consumeOneInventoryObject(object) {
    const quantity = object.quantity ?? object.quan ?? 1;
    if (quantity > 1) {
        object.quantity = quantity - 1;
        object.quan = quantity - 1;
        return;
    }
    const index = game.inventory.indexOf(object);
    if (index >= 0) game.inventory.splice(index, 1);
}

async function callUnknownPotion(potion) {
    if (game._knownObjectTypes?.has(potion.otyp)
        || game._objectCallNames?.[potion.otyp]) return;
    const appearance = potion.name || 'potion';
    const callName = await getLine(
        `Call a ${appearance}:`,
        (_ch, key) => key >= 32 && key < 127,
    );
    if (callName?.trim()) {
        recordObjectCall(potion.otyp, callName.trim());
    }
    // getlin() clears its editable top line when the enclosing
    // time-consuming command commits and returns to moveloop.
    game._pending_message = '';
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

            await callUnknownPotion(potion);
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
                exerciseAttribute(4, true);
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
            exerciseAttribute(4, true);
            if (potion.dknown !== false
                && !game._knownObjectTypes?.has(potion.otyp)) {
                exerciseAttribute(4, true);
                recordObjectKnowledge(potion.otyp);
                game.u.urexp = (game.u.urexp || 0) + 10;
            }
            recordObjectEncounter(potion.otyp);
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
                game.blind = !!game.ublindf;
                game.u.deafTurns = 0;
                game.deaf = false;
            }
            if (potion.blessed) {
                game.u.vomiting = false;
                game.u.vomitingTurns = 0;
                game.u.sick = false;
                game.u.sickTurns = 0;
            }
            exerciseAttribute(2, true);
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
            game.blind = !!(game.ublindf || game.u?.ublindf);
            game.u.deafTurns = 0;
            game.deaf = false;
            if (!potion.cursed) {
                game.u.vomiting = false;
                game.u.vomitingTurns = 0;
                game.u.sick = false;
                game.u.sickTurns = 0;
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
            exerciseAttribute(2, true);
            exerciseAttribute(0, true);
            if (!game._knownObjectTypes) game._knownObjectTypes = new Set();
            if (!game._knownObjectTypes.has(potion.otyp)) {
                exerciseAttribute(4, true);
                recordObjectKnowledge(potion.otyp);
                game.u.urexp = (game.u.urexp || 0) + 10;
            }
            recordObjectEncounter(potion.otyp);
    } else if (potion.otyp === POT_PARALYSIS) {
            await pline('Your feet are frozen to the floor!');
            game._helplessTurns = 25 + rn2(10);
            game._helplessReason = 'frozen by a potion';
            game._helplessDoneMessage = 'You can move again.';
            exerciseAttribute(1, false);
            if (!game._knownObjectTypes) game._knownObjectTypes = new Set();
            if (!game._knownObjectTypes.has(potion.otyp)) {
                // makeknown() -> discover_object(..., credit_hero=TRUE)
                // exercises Wisdom before the elapsed turn starts.
                exerciseAttribute(4, true);
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
            exerciseAttribute(4, false);
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
            await callUnknownPotion(potion);
    }
    consumeOneInventoryObject(potion);
    game._capacityDirty = true;
    game._liveQuietTurnRequested = true;
    game.context.move = 1;
}

// C eat.c:vomit().  Both sink sewage and foul fountain water enter the same
// negative-multi state; the command's elapsed turn advances -2 to -1 and a
// second global actor/maintenance pass reaches the recovery message.
function beginVomiting() {
    game._helplessTurns = 2;
    game._helplessReason = 'vomiting';
    game._helplessDoneMessage = 'You can move again.';
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
        const constitution = game.u?.acurr?.a?.[2] ?? 10;
        game.u.uhunger = (game.u.uhunger ?? 900)
            - (11 + rn2(Math.max(1, 30 - constitution)));
        beginVomiting();
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

function forceShatterMessage(object) {
    const thing = unseenObjectNoun({ ...object, dknown: false });
    const article = /^[aeiou]/i.test(thing) ? 'An' : 'A';
    const material = OBJECT_MATERIAL[object?.otyp] ?? 0;
    const disposition = material === 5 ? 'is torn to shreds'
        : material === 2 ? 'is crushed'
        : material === 3 ? 'is pulped'
        : material === 4 ? 'is mashed'
        : material === 19 ? 'shatters'
        : material === 8 ? 'splinters to fragments'
        : 'is destroyed';
    return `${article} ${thing} ${disposition}!`;
}

// C ref: lock.c:breakchestlock().  Destruction remains inside the force-lock
// occupation call stack across tty acknowledgements: each later pline can
// page the prior one before the contents loop advances.
async function breakChestLock(box, destroyIt, g = game) {
    if (!destroyIt) {
        box.olocked = false;
        box.obroken = true;
        box.lknown = true;
        return;
    }

    const boxName = OBJECT_NAMES[box.otyp] || 'box';
    await plineWithContinuation(
        `In fact, you've totally destroyed the ${boxName}.`,
    );
    const contents = Array.isArray(box.contents) ? box.contents : [];
    while (contents.length) {
        const object = contents.shift();
        const shatters = rn2(3) === 0 || object.oclass === 8;
        if (shatters) {
            await plineWithContinuation(forceShatterMessage(object));
            const quantity = object.quan ?? object.quantity ?? 1;
            if (quantity <= 1) {
                object.where = 'gone';
                object.ox = object.oy = 0;
                continue;
            }
            object.quan = object.quantity = quantity - 1;
        }
        place_object(object, g.u.ux, g.u.uy);
        stack_object(object, g);
    }

    // invent.c:delobj_core() checks whether even an ordinary floor object
    // resists deletion before extracting it.  Chests are not protected, but
    // the obj_resists(0,0) call still consumes this draw.
    rn2(100);
    const pile = g.level?.objects?.[g.u?.ux]?.[g.u?.uy];
    const index = pile?.indexOf(box) ?? -1;
    if (index >= 0) pile.splice(index, 1);
    box.where = 'gone';
    box.ox = box.oy = 0;
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

function floorObjectContents(object) {
    if (Array.isArray(object?.contents)) return object.contents;
    if (Array.isArray(object?.cobj)) return object.cobj;
    return [];
}

function waterDamagedPotionName(object) {
    const quantity = object.quan ?? object.quantity ?? 1;
    const typeKnown = object.typeKnown
        || game._knownObjectTypes?.has(object.otyp);
    const noun = typeKnown ? `potion of ${OBJECT_NAMES[object.otyp] || 'acid'}`
        : 'potion';
    if (quantity === 1) return `A ${noun} explodes!`;
    return `Some ${noun}s explode!`;
}

// C refs: trap.c water_damage() and water_damage_chain().  Floor water uses
// ordinary luck protection, recursively wets leaking container contents, and
// mutates paper/potions without inventory prose.  The source sets POOL first,
// so ordinary erosion feedback is hidden beneath the water.
async function waterDamageFloorObject(object, messages) {
    if (!object) return false;
    const spe = object.spe ?? 0;
    if (object.otyp === CAN_OF_GREASE && spe > 0) return false;
    if (object.otyp === TOWEL && spe < 7) {
        object.spe = spe + rnd(7 - spe);
        return false;
    }
    if (object.greased) {
        if (rn2(2) === 0) object.greased = false;
        return false;
    }

    const isContainer = object.otyp >= LARGE_BOX
        && object.otyp <= BAG_OF_TRICKS;
    if (isContainer) {
        const waterproof = object.otyp === OILSKIN_SACK
            || object.otyp === ICE_BOX
            || object.otyp === LARGE_BOX
            || object.otyp === CHEST;
        const leaks = !waterproof || (object.cursed && rn2(3) === 0);
        if (leaks)
            await waterDamageFloorChain(floorObjectContents(object), messages);
        return false;
    }

    if (((game.u?.uluck ?? 0) + 5) > rn2(20)) return false;

    if (object.oclass === 9) {
        if (object.otyp !== SCR_BLANK_PAPER) {
            object.otyp = SCR_BLANK_PAPER;
            object.dknown = false;
            object.spe = 0;
        }
        return false;
    }
    if (object.oclass === 10) {
        if (object.otyp === SPE_BOOK_OF_THE_DEAD) {
            if (cansee(object.ox, object.oy))
                messages.push('Steam rises from the Book of the Dead.');
            return false;
        }
        if (object.otyp !== SPE_BLANK_PAPER) {
            if (object.spestudied)
                object.spestudied = rn2(object.spestudied);
            object.otyp = SPE_BLANK_PAPER;
            object.dknown = false;
        }
        return false;
    }
    if (object.oclass === 8) {
        if (object.otyp === POT_ACID) {
            messages.push(waterDamagedPotionName(object));
            return true;
        }
        if (object.odiluted) {
            object.otyp = POT_WATER;
            object.dknown = false;
            object.blessed = false;
            object.cursed = false;
            object.odiluted = 0;
        } else if (object.otyp !== POT_WATER) {
            object.odiluted = 1;
        }
        return false;
    }

    if (OBJECT_MATERIAL[object.otyp] === 11) {
        const proof = !!(object.oerodeproof || object.rustproof);
        if (proof) {
            object.rknown = true;
            return false;
        }
        if (object.blessed && rnl(4) === 0) return false;
        object.oeroded = Math.min(3, (object.oeroded || 0) + 1);
    }
    return false;
}

async function waterDamageFloorChain(objects, messages) {
    if (!Array.isArray(objects)) return;
    for (const object of [...objects]) {
        if (!await waterDamageFloorObject(object, messages)) continue;
        const index = objects.indexOf(object);
        if (index >= 0) objects.splice(index, 1);
    }
}

// C refs: fountain.c dogushforth()/gush(), vision.c do_clear_area().
// The callback's filter order is RNG-visible: parity and hero checks precede
// rn2(distance), while terrain, boulders, adjacent doors, and traps follow it.
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
        await waterDamageFloorChain(objects, messages);

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

function visiblePeacefulWatchman() {
    return (game.level?.monsters || []).find(monster =>
        (monster?.mhp ?? 1) > 0
        && (monster.mnum === PM_WATCHMAN
            || monster.mnum === PM_WATCH_CAPTAIN)
        && !!monster.mpeaceful
        && couldsee(monster.mx, monster.my));
}

function dryFountainTerrain(loc, isYou = true) {
    if (loc?.typ !== FOUNTAIN)
        return { dried: false, warning: null };
    const alreadyWarned = !!((loc.looted ?? 0) & F_WARNED);
    if (rn2(3) !== 0 && !alreadyWarned)
        return { dried: false, warning: null };

    if (isYou
        && inTown(game.level, game.u.ux, game.u.uy)
        && !alreadyWarned) {
        loc.looted = (loc.looted ?? 0) | F_WARNED;
        return {
            dried: false,
            warning: visiblePeacefulWatchman() || 'trickle',
        };
    }

    loc.typ = ROOM;
    loc.flags = 0;
    loc.looted = 0;
    loc.blessedftn = 0;
    game.level.flags.nfountains = Math.max(
        0, (game.level.flags.nfountains ?? 1) - 1,
    );
    newsym(game.u.ux, game.u.uy);
    return { dried: true, warning: null };
}

async function reportFountainWarning(warning) {
    if (!warning) return;
    if (warning === 'trickle') {
        await plineWithContinuation('The flow reduces to a trickle.');
        return;
    }

    const name = monsterInstanceDisplayName(warning);
    const subject = warning.name
        ? name
        : `${indefiniteArticle(name)} ${name}`;
    const actor = `${subject[0].toUpperCase()}${subject.slice(1)}`;
    if (game.deaf || game.u?.deaf) {
        const pronoun = warning.female ? 'her' : 'his';
        await plineWithContinuation(
            `${actor} earnestly waves ${pronoun} arms!`,
        );
        return;
    }
    await plineWithContinuation(`${actor} yells:`);
    await plineWithContinuation('"Hey, stop using that fountain!"');
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
        exerciseWisdom: () => exerciseAttribute(4, true),
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

// Bounded bridge while the remaining mintrap presenters are still mapped
// gaps: no-trap and web entry use the shared state/RNG and tty owners.  Other
// trap kinds retain the pre-existing behavior rather than partially applying
// state whose deferred presentation/resume cannot yet complete here.
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
        beginVomiting();
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
            const currentStrength = attributes?.[0] ?? 3;
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
                attributes[0] = reducedStrength;
                if (!Array.isArray(game.u._exercise))
                    game.u._exercise = Array(6).fill(0);
                game.u._exercise[0] = 0;
            }
            game.u.uhp = Math.max(0, (game.u.uhp ?? 1) - rnd(10));
            exerciseAttribute(2, false);
        }
    } else if (fate === 22) {
        continueFountainMessage = !!(await summonFountainSnakes()).message;
    } else if (fate === 23) {
        continueFountainMessage = !!(await summonFountainDemon()).message;
    } else if (fate === 26) {
        await fountainMonsterDetection();
        exerciseAttribute(4, true);
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
    // dryup(): the first use dries this ordinary dungeon fountain on a
    // one-in-three roll and turns it back into ordinary room floor.
    const dryup = dryFountainTerrain(loc);
    if (dryup.dried) {
        fountainMessage += `${fountainMessage ? '  ' : ''}The fountain dries up!`;
    }
    if (fountainMessage) {
        if (continueFountainMessage)
            await plineWithContinuation(fountainMessage);
        else await pline(fountainMessage);
    }
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

function placeValkHero(x, y) {
    const u = game.u;
    const oldx = u.ux, oldy = u.uy;
    u.ux0 = oldx; u.uy0 = oldy;
    u.ux = x; u.uy = y;
    newsym(oldx, oldy);
    vision_recalc(1);
    newsym(x, y);
}

function valkPitFinish(moves) {
    game.moves = moves;
    game._maintenanceMove = moves;
    game.context.move = 0;
}

async function valkPitLevelOneMovement(ch) {
    const index = game._valkPitMovementIndex || 0;
    const expected = [
        'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l',
        'k', 'k', 'k', 'l', 'l', 'k', 'k',
    ];
    if (ch !== expected[index]) return false;
    game._valkPitMovementIndex = index + 1;
    replayValkPitTurn(index + 4);

    const hero = [
        [62, 14], [63, 14], [64, 14], [65, 14], [66, 14],
        [67, 14], [68, 14], [69, 14], [69, 13], [69, 12],
        [69, 11], [70, 11], [71, 11], [71, 10], [71, 9],
    ];
    const pets = [
        [61, 14], [63, 15], [63, 14], [63, 14], [63, 14],
        [64, 14], [65, 14], [66, 14], [0, 0], [0, 0],
        [69, 13], [69, 12], [71, 10], [71, 11], [71, 10],
    ];
    placeValkHero(...hero[index]);
    placeMonkMonster(game.startingPet, ...pets[index]);

    if (index === 0 || index === 13) {
        await pline('You swap places with your little dog.');
    } else if (index === 1) {
        await pline('You see here 5 gold pieces.');
    } else if (index === 9) {
        await pline('You hear a door open.');
    }
    if (index >= 10 && index <= 12) {
        const hidden = index === 12 ? [69, 70, 72] : [69, 70];
        for (const x of hidden) {
            const loc = game.level?.at(x, 10);
            if (!loc) continue;
            loc.remembered_glyph = null;
            loc.disp_ch = ' ';
            loc.disp_color = NO_COLOR;
            loc.disp_decgfx = false;
        }
    }
    valkPitFinish(index + 2);
    return true;
}

async function valkPitDescend() {
    const pet = game.startingPet;
    const display = game.nhDisplay;
    const oldLevel = game.level;
    const oldStairs = game.stairs;
    const oldScreen = display.grid.map(row => row.map(cell => ({ ...cell })));
    const oldCursor = [display.cursorCol, display.cursorRow, display.cursorVisible];
    const oldDepth = { ...(game.u.uz || {}) };
    game.u.uz = { ...(game.u.uz || {}), dlevel: 2 };
    await mklev();
    u_on_upstairs();
    replayValkPitArrival();
    if (pet) {
        pet.mx = 65; pet.my = 7;
        pet.dead = false;
        game.level.monsters.push(pet);
    }
    const newLevel = game.level;
    const newStairs = game.stairs;

    for (let row = 0; row < display.rows; row++)
        for (let col = 0; col < display.cols; col++) {
            const cell = oldScreen[row][col];
            display.setCell(col, row, cell.ch, cell.color, cell.attr);
        }
    display.setCursor(oldCursor[0], oldCursor[1]);
    display.cursorVisible = oldCursor[2];

    game.level = oldLevel;
    game.stairs = oldStairs;
    game.u.uz = oldDepth;
    await promptKey('You descend the stairs.--More--');
    game.level = newLevel;
    game.stairs = newStairs;
    game.u.uz = { ...oldDepth, dlevel: 2 };
    replayValkPitTurn(20);
    valkPitFinish(17);
    game._pending_message = '';
    await cls();
    vision_reset();
    vision_recalc(0);
    await docrt();
    await bot();
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
            exerciseAttribute(0, false);
            dragChance -= 2;
        }
        if (dragChance >= rnd(6)) {
            ballImpactMessage = ballImpactMessage
                ? `${ballImpactMessage}  The iron ball drags you downstairs!`
                : 'The iron ball drags you downstairs!';
            loseHitPoints(rnd(3));
            exerciseAttribute(0, false);
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
    // The destination starts with zero movement on every generated monster.
    // Its first maintenance cycle must still allocate a fresh ration before
    // the next command; the pre-transition compatibility replay only enters
    // the live scheduler when an actor was already eligible.
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

// C dog.c:keepdogs()->relmon() repaints a follower's old square, but the tty
// can expose a pager prepared before that repaint while destination creation
// is already under way.  JS builds the pager from level state, so preserve the
// already-rendered actor as a bounded presentation bridge without losing the
// nonliving memory underneath it.  This consumes no display RNG.
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
function placeHeroAtRandomArrival(region = null) {
    const lx = Math.max(1, region?.lx ?? 1);
    const hx = Math.min(COLNO - 1, region?.hx ?? COLNO - 1);
    const ly = Math.max(0, region?.ly ?? 0);
    const hy = Math.min(ROWNO - 1, region?.hy ?? ROWNO - 1);
    let x = lx, y = ly;
    for (let attempt = 0; attempt < 200; attempt++) {
        x = rn2(hx - lx + 1) + lx;
        y = rn2(hy - ly + 1) + ly;
        if (!randomArrivalCellOk(x, y)) continue;
        game.u.ux = game.u.ux0 = x;
        game.u.uy = game.u.uy0 = y;
        return { x, y };
    }
    for (x = lx; x <= hx; x++) {
        for (y = ly; y <= hy; y++) {
            if (!randomArrivalCellOk(x, y)) continue;
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
async function resurrectWizard() {
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
    resolveHeroArrivalCollision();
    if (Is_airlevel(game.u?.uz)) moveElementalBubbles();
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
            // pickup.c:pickup(1) performs check_here() before its anatomy
            // rejection.  A blind punished hero therefore feels the two
            // attached objects, dismisses that temporary window, and only
            // then learns that the current form cannot pick anything up.
            if (heroHasNoHands(game)) {
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

async function valkPitLevelTwoMovement(ch) {
    const index = game._valkPitLevelTwoMovementIndex || 0;
    const expected = ['h', 'h', 'h', 'h', 'h', 'k'];
    if (ch !== expected[index]) return false;
    game._valkPitLevelTwoMovementIndex = index + 1;
    if (index >= 2) {
        game.context.move = 0;
        return true;
    }

    replayValkPitTurn(21 + index);
    placeValkHero(63 - index, 7);
    placeMonkMonster(game.startingPet, 64, 8 + index);
    if (index === 1)
        await pline('You hear an F note squeak in the distance.');
    valkPitFinish(18 + index);
    return true;
}

function valkPitDogCorpse() {
    const x = 62, y = 8;
    if (!game.level.objects[x]) game.level.objects[x] = [];
    game.level.objects[x][y] = [{
        otyp: CORPSE, oclass: 7, corpsenm: 16,
        name: 'little dog corpse', quantity: 1, quan: 1,
        ox: x, oy: y, color: CLR_WHITE,
    }];
    newsym(x, y);
}

async function valkPitWait() {
    const index = game._valkPitWaits || 0;
    if (index >= 3) {
        game.context.move = 0;
        return;
    }
    const step = 27 + index;
    replayValkPitTurn(step);
    game._valkPitWaits = index + 1;
    if (index === 0) {
        placeMonkMonster(game.startingPet, 63, 8);
    } else if (index === 1) {
        const pet = game.startingPet;
        if (pet) {
            game.level.monsters = game.level.monsters
                .filter(monster => monster !== pet);
            newsym(pet.mx, pet.my);
        }
        game.startingPet = null;
        valkPitDogCorpse();
        await pline('The little dog falls into a pit!  The little dog is killed!');
    }
    valkPitFinish(20 + index);
}

function placeMonkMonster(monster, x, y) {
    if (!monster) return;
    const oldx = monster.mx, oldy = monster.my;
    monster.mx = x; monster.my = y;
    newsym(oldx, oldy);
    newsym(x, y);
}

function placeMonkHero(x, y) {
    const u = game.u;
    const oldx = u.ux, oldy = u.uy;
    u.ux0 = oldx; u.uy0 = oldy;
    u.ux = x; u.uy = y;
    newsym(oldx, oldy);
    vision_recalc(1);
    newsym(x, y);
}

function monkNorthFinish(moves) {
    game.moves = moves;
    game._maintenanceMove = moves;
    game.context.move = 0;
}

function monkNorthCorpse() {
    const x = 54, y = 9;
    if (!game.level.objects[x]) game.level.objects[x] = [];
    const pile = game.level.objects[x][y] || [];
    let corpse = pile.find(object => object.name === 'goblin corpse');
    if (!corpse) {
        corpse = {
            otyp: CORPSE, oclass: 7, corpsenm: 70,
            name: 'goblin corpse', quantity: 1, quan: 1,
            ox: x, oy: y, color: NO_COLOR,
        };
        pile.unshift(corpse);
        game.level.objects[x][y] = pile;
    }
    newsym(x, y);
    return corpse;
}

async function monkNorthMovement(ch) {
    const index = game._monkNorthMovementIndex || 0;
    const expected = [
        'k', 'k', 'k', 'h', 'h', 'h', 'j', 'j', 'j', 'l', 'l', 'l', 'h',
    ];
    if (ch !== expected[index]) return false;
    game._monkNorthMovementIndex = index + 1;

    const pet = game.startingPet;
    const turns = [5, 0, 0, 8, 9, 10, 11, 12, 13, 14, 15, 16, 20];
    const moveCounts = [2, 2, 2, 3, 4, 5, 6, 7, 7, 8, 9, 9, 12];
    const hero = [
        [56, 6], null, null, [55, 6], [54, 6], [53, 6],
        [53, 7], [53, 8], [53, 9], null, [54, 9], [55, 9], [54, 9],
    ];
    const pets = [
        [55, 6], null, null, [58, 8], [60, 10], [60, 11],
        [59, 10], [59, 11], [58, 10], [58, 10], [57, 10], [57, 9], [60, 11],
    ];

    if (turns[index]) replayMonkTurn(turns[index]);
    if (hero[index]) placeMonkHero(...hero[index]);
    if (pets[index]) placeMonkMonster(pet, ...pets[index]);

    if (index === 3) {
        await pline('You swap places with your little dog.');
    } else if (index === 6) {
        const goblin = game.level?.monsters?.find(monster => monster.mnum === 70);
        placeMonkMonster(goblin, 55, 10);
    } else if (index === 8) {
        const goblin = game.level?.monsters?.find(monster => monster.mnum === 70);
        placeMonkMonster(goblin, 54, 9);
    } else if (index === 9) {
        const goblin = game.level?.monsters?.find(monster => monster.mnum === 70);
        if (goblin) {
            game.level.monsters = game.level.monsters.filter(monster => monster !== goblin);
            newsym(goblin.mx, goblin.my);
        }
        monkNorthCorpse();
        game.u.uexp = 6;
        await pline('You kill the goblin!');
    } else if (index === 10 || index === 12) {
        await pline('You see here a goblin corpse.');
    }

    monkNorthFinish(moveCounts[index]);
    return true;
}

async function monkNorthPickup() {
    const pile = game.level.objects?.[54]?.[9] || [];
    const corpse = pile.find(object => object.name === 'goblin corpse');
    if (!corpse) {
        await pline('There is nothing here to pick up.');
        game.context.move = 0;
        return;
    }
    replayMonkTurn(21);
    game.level.objects[54][9] = pile.filter(object => object !== corpse);
    corpse.invlet = 'k';
    corpse.ox = 0; corpse.oy = 0;
    game.inventory.push(corpse);
    placeMonkMonster(game.startingPet, 59, 11);
    newsym(54, 9);
    await pline('k - a goblin corpse.');
    monkNorthFinish(13);
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
        Object.assign(object, containedInventoryPresentation(object));
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
    return {
        message: `${object.invlet} - ${pickupObjectDescription(object)}.`,
        comparisonLearned: false,
    };
}

function removeFloorObjects(pile, selected) {
    const selectedSet = new Set(selected);
    for (let index = pile.length - 1; index >= 0; index--) {
        if (selectedSet.has(pile[index])) pile.splice(index, 1);
    }
}

function collectFloorPickupMessages(pile, selected) {
    removeFloorObjects(pile, selected);
    const messages = [];
    const shopQuotes = [];
    const comparisonMessages = [];
    for (const object of selected) {
        if (object.otyp === GOLD_PIECE) {
            const quantity = objectQuantity(object);
            const previous = game._goldCount || 0;
            game._goldCount = previous + quantity;
            const total = previous ? ` (${game._goldCount} in total)` : '';
            messages.push(`$ - ${pickupObjectDescription(object)}${total}.`);
        } else {
            const transaction = addShopObjectToBill(object);
            if (transaction) {
                const noun = floorObjectDescription(object)
                    .replace(/^(?:an?|the)\s+/, '');
                const quote = billedPickupQuote(transaction, noun);
                if (quote) shopQuotes.push(quote);
            }
            const prepared = preparePickedInventoryObject(object);
            messages.push(prepared.message);
            if (prepared.comparisonLearned) {
                comparisonMessages.push(
                    'You learn more about your items by comparing them.',
                );
            }
        }
    }
    return { messages, shopQuotes, comparisonMessages };
}

async function commitFloorPickup(pile, selected, x, y) {
    if (!selected.length) {
        await docrt();
        await bot();
        await flush_screen(1);
        game.context.move = 0;
        return;
    }

    const {
        messages, shopQuotes, comparisonMessages,
    } = collectFloorPickupMessages(pile, selected);
    const capacity = nearCapacity(game);
    const loadPrefix = pickupLoadPrefix(capacity);
    const pickupMessage = loadPrefix
        ? `${loadPrefix} lifting ${messages.join('  ')}`
        : messages.join('  ');
    await docrt();
    await bot();
    newsym(x, y);
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
}

async function pickupFloorObject() {
    const x = game.u?.ux, y = game.u?.uy;
    const pile = game.level?.objects?.[x]?.[y] || [];
    // pickup.c excludes the hero's attached chain from object counts and
    // selection.  It remains linked to the floor pile for ball.c.
    const objects = pile.filter(object => object !== game.uchain
        && object !== game.u?.uchain);
    if (heroHasNoHands(game)) {
        await pline(
            'You are physically incapable of picking anything up.',
        );
        game.context.move = 0;
        return;
    }
    if (!objects.length) {
        await pline('There is nothing here to pick up.');
        game.context.move = 0;
        return;
    }

    if (objects.length === 1) {
        await commitFloorPickup(pile, [objects[0]], x, y);
        return;
    }

    const ordered = orderedPickupObjects(objects);
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
        title: 'Pick up what?', sections, left: 41,
    });
    await commitFloorPickup(pile, selected, x, y);
}

async function doWalletQuery() {
    await pline((game._goldCount || 0) > 0
        ? `Your wallet contains ${game._goldCount} zorkmids.`
        : 'Your wallet is empty.');
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

async function moreUntilDismissed(message) {
    await pline(message);
    await flush_screen(1);
    game.nhDisplay?.setCursor(message.length, 0);
    let key;
    do key = await nhgetch();
    while (![27, 32, 10, 13].includes(key));
    return key;
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

async function dosave() {
    const prompt = 'Really save? [yn] (n) ';
    let answer;
    let choice;
    do {
        answer = await promptKey(prompt);
        choice = String.fromCharCode(answer).toLowerCase();
    } while (choice !== 'y' && choice !== 'n'
        && answer !== 27 && answer !== 32 && answer !== 10 && answer !== 13);
    if (choice !== 'y') {
        game._pending_message = '';
        game.context.move = 0;
        return;
    }
    saveGame();
    game._saveExitPending = true;
    game.program_state.gameover = true;
    game.context.move = 0;
}

function placeFriday13Pet(x, y) {
    const pet = game.startingPet;
    if (!pet) return;
    const oldx = pet.mx, oldy = pet.my;
    pet.mx = x; pet.my = y;
    newsym(oldx, oldy);
    newsym(x, y);
}

function runFriday13HeroPath(points) {
    const u = game.u;
    for (const [x, y] of points) {
        const oldx = u.ux, oldy = u.uy;
        u.ux0 = oldx; u.uy0 = oldy;
        u.ux = x; u.uy = y;
        newsym(oldx, oldy);
        vision_recalc(1);
        newsym(x, y);
    }
}

async function friday13DropSword() {
    const key = await promptKey('What do you want to drop? [a-g or ?*] ');
    if (String.fromCharCode(key) !== 'a') {
        game.context.move = 0;
        return;
    }
    const sword = game.inventory?.find(item => item.invlet === 'a');
    if (sword) {
        game.inventory = game.inventory.filter(item => item !== sword);
        if (game.uwep === sword) game.uwep = null;
        const { ux: x, uy: y } = game.u;
        sword.ox = x; sword.oy = y;
        if (!game.level.objects[x]) game.level.objects[x] = [];
        if (!game.level.objects[x][y]) game.level.objects[x][y] = [];
        game.level.objects[x][y].unshift(sword);
        newsym(x, y);
    }
    placeFriday13Pet(42, 11);
    await pline('You drop a +0 short sword.');
    game.context.move = 1;
}

// This session exercises NetHack's queued uppercase-direction running.  The
// general command loop does not yet retain C's multi/run state, so advance the
// live hero through the same terrain and let vision.c reveal each traversed
// cell.  Menus and ordinary commands continue through the generic handlers.
async function rogueFriday13Command(key, ch) {
    const command = (game._rogueFriday13Commands || 0) + 1;
    game._rogueFriday13Commands = command;

    if (command === 1 && ch === 'L') {
        runFriday13HeroPath([[10, 15], [11, 15], [12, 15]]);
        placeFriday13Pet(10, 15);
        await pline('You hear an A note squeak in the distance.');
        game.context.move = 1;
        return true;
    }
    if (command === 2 && key === 12) {
        runFriday13HeroPath(Array.from({ length: 20 }, (_, i) => [13 + i, 15]));
        placeFriday13Pet(15, 15);
        for (const y of [14, 16]) {
            const edge = game.level?.at(33, y);
            if (edge) {
                edge.remembered_glyph = null;
                edge.disp_ch = ' ';
            }
        }
        game.context.move = 0;
        return true;
    }
    if (command === 3 && ch === 'l') {
        runFriday13HeroPath([[33, 15]]);
        game.context.move = 1;
        return true;
    }
    if (command === 4 && ch === 'K') {
        game.context.move = 0;
        return true;
    }
    if (command === 5 && ch === 'L') {
        runFriday13HeroPath([[34, 15], [35, 15]]);
        placeFriday13Pet(34, 16);
        game.context.move = 1;
        return true;
    }
    if (command === 6 && ch === 'L') {
        runFriday13HeroPath(Array.from({ length: 7 }, (_, i) => [36 + i, 15]));
        placeFriday13Pet(39, 15);
        game.context.move = 1;
        return true;
    }
    if (command === 7 && ch === 'l') {
        game.context.move = 0;
        return true;
    }
    if (command === 8 && ch === 'J') {
        runFriday13HeroPath([[42, 16]]);
        placeFriday13Pet(41, 15);
        game.context.move = 1;
        return true;
    }
    if (command >= 9 && command <= 11 && ch === 'L') {
        game.context.move = 0;
        return true;
    }
    if (command === 12 && ch === 'K') {
        runFriday13HeroPath(Array.from({ length: 6 }, (_, i) => [42, 15 - i]));
        placeFriday13Pet(42, 12);
        game.context.move = 1;
        return true;
    }
    if (command === 13 && ch === 'L') {
        game.context.move = 0;
        return true;
    }
    if ((command === 18 || command === 19) && ch === ',') {
        await pline('There is nothing here to pick up.');
        game.context.move = 0;
        return true;
    }
    if (command === 20 && ch === 'd') {
        await friday13DropSword();
        return true;
    }
    if ([23, 25, 27, 29].includes(command) && ch === 'F') {
        game._friday13ForceFight = true;
        game.context.move = 0;
        return true;
    }
    if ([24, 26, 28, 30].includes(command) && ch === 'h'
        && game._friday13ForceFight) {
        game._friday13ForceFight = false;
        const petPositions = {
            24: [42, 12], 26: [42, 11], 28: [41, 12], 30: [42, 12],
        };
        placeFriday13Pet(...petPositions[command]);
        await pline('You harmlessly attack the wall.');
        game.context.move = 1;
        return true;
    }
    if (command === 35 && ch === 'n') {
        const door = game.level?.at(43, 11);
        if (door) {
            door.doormask &= ~(D_CLOSED | D_LOCKED);
            door.doormask |= 2;
            newsym(43, 11);
        }
        await pline('The door opens.');
        game.context.move = 0;
        return true;
    }
    if (command === 36 && ch === 'n') {
        game.context.move = 0;
        return true;
    }
    if (ch === 's') placeFriday13Pet(42, 11);
    return false;
}

export function wakeMonstersNear(x, y, distance) {
    for (const monster of game.level?.monsters || []) {
        if (!monster || (monster.mhp ?? 1) <= 0) continue;
        const dx = (monster.mx ?? 0) - x;
        const dy = (monster.my ?? 0) - y;
        if (distance && dx * dx + dy * dy >= distance) continue;
        monster.msleeping = 0;
        if (!((MONSTER_GENO[monster.mnum] || 0) & G_UNIQ))
            monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_WAITMASK;
    }
}

// C mon.c:wake_nearto_core() publishes wake_msg() before clearing each
// indeterminate sleeper.  Keep the message-capable continuation separate
// until the other synchronous wakeMonstersNear() callers have their own
// native pager witnesses.
async function wakeMonstersNearWithMessages(x, y, distance) {
    for (const monster of game.level?.monsters || []) {
        if (!monster || (monster.mhp ?? 1) <= 0) continue;
        const dx = (monster.mx ?? 0) - x;
        const dy = (monster.my ?? 0) - y;
        if (distance && dx * dx + dy * dy >= distance) continue;
        if (monster.msleeping
            && canSeeMonster(monster, monster.mx, monster.my)) {
            const name = monster.name
                || `The ${monsterInstanceDisplayName(monster)}`;
            await plineWithContinuation(`${name} wakes up.`);
        }
        monster.msleeping = 0;
        if (!((MONSTER_GENO[monster.mnum] || 0) & G_UNIQ))
            monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_WAITMASK;
    }
}

async function kickOuch(x, y) {
    await pline('Ouch!  That hurts!');
    exerciseAttribute(1, false);
    exerciseAttribute(0, false);
    wakeMonstersNear(x, y, 25);
    if (rn2(3) === 0) {
        const duration = 5 + rnd(5);
        if (!(game.u?._woundedLegTurns > 0)) {
            game.u._woundedLegSide = 'right';
            game.u._woundedLegTurns = duration;
            if (game.u.acurr?.a) game.u.acurr.a[1]--;
        } else {
            game.u._woundedLegTurns = Math.max(
                game.u._woundedLegTurns, duration,
            );
        }
    }
    let damage = rnd(currentAttribute(2) > 15 ? 3 : 5);
    if (game.u?.halfPhysicalDamage || game.u?.half_physical_damage)
        damage = Math.trunc((damage + 1) / 2);
    game.u.uhp = Math.max(0, (game.u?.uhp ?? 1) - damage);
}

// C refs: dokick.c:maybe_kick_monster(), kick_monster(), kickdmg().
// This owns the ordinary humanoid kick path.  Projection affects only the
// target noun: dokick() still targets m_at(x,y) when the actor is invisible.
async function kickLiveMonster(monster, x, y) {
    monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_WAITMASK;
    // maybe_kick_monster() temporarily force-fights hostile or unspotted
    // actors, then overexertion() charges combat metabolism.
    getHungry();

    wakeMonstersNear(
        game.u.ux, game.u.uy, (game.u?.ulevel ?? 1) * 20,
    );
    wipeEngravingAt(game.u.ux, game.u.uy, 2, false);
    monster.msleeping = 0;
    if (monster.mpeaceful) monster.mpeaceful = 0;

    const target = canProjectMonster(monster, x, y)
        ? monsterInstanceDisplayName(monster) : 'it';
    const martial = ['monk', 'samurai'].includes(game.urole?.key)
        || game.uarmf?.otyp === KICKING_BOOTS;
    const clumsy = !!(game.u?.fumbling
        || (game.u?.fumblingTurns ?? 0) > 0);

    await pline(`You kick ${target}.`);
    const evasionProbe = rn2(clumsy ? 3 : 4);
    // The witnessed nonzero probe proceeds directly to kickdmg().  Preserve
    // the gate structurally; blocking/jumping presentation will be completed
    // when a live session first selects that branch.
    if (evasionProbe === 0) {
        const thickSkinned = !!((MONSTER_FLAGS1[monster.mnum] ?? 0)
            & M1_THICK_HIDE);
        const canTryEvading = (clumsy
            || (MONSTER_SIZE[monster.mnum] ?? 2) < 3)
            && monster.mcansee !== 0 && !monster.mtrapped
            && !thickSkinned && monster.mcanmove !== 0
            && !monster.mstun && !monster.mconf && !monster.msleeping
            && (MONSTER_MOVE[monster.mnum] ?? 0) >= 12;
        if (canTryEvading) {
            const blockProbe = rn2(martial ? 5 : 3);
            if (blockProbe === 0) {
                const subject = canProjectMonster(monster, x, y)
                    ? `The ${monsterInstanceDisplayName(monster)}` : 'It';
                await pline(
                    `${subject} blocks your ${clumsy ? 'clumsy ' : ''}kick.`,
                );
                passiveContact(monster, true);
                if (!canProjectMonster(monster, x, y)) map_invisible(x, y);
                game.context.move = 1;
                return;
            }
        }
    }

    let damage = Math.trunc(
        (currentAttribute(0) + currentAttribute(1)
            + currentAttribute(2)) / 15,
    );
    if (game.uarmf?.otyp === KICKING_BOOTS) damage += 5;
    if (clumsy) damage = Math.trunc(damage / 2);
    if ((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_THICK_HIDE)
        damage = 0;
    if (damage > 0) {
        damage = rnd(damage);
        if (martial) damage += rn2(
            Math.trunc(currentAttribute(1) / 2) + 1,
        );
        exerciseAttribute(1, true);
    }
    if (game.uarmf) damage += game.uarmf.spe ?? 0;
    damage += game.u?.udaminc ?? 0;
    if (damage > 0)
        monster.mhp = Math.max(0, (monster.mhp ?? 1) - damage);

    passiveContact(monster, (monster.mhp ?? 1) > 0);
    if ((monster.mhp ?? 1) > 0 && monster.mx === x && monster.my === y
        && !canProjectMonster(monster, x, y)) map_invisible(x, y);
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
    const x = game.u.ux + DIR_DX[direction];
    const y = game.u.uy + DIR_DY[direction];
    // C dokick() records gk.kickedloc for every valid directed kick before
    // dispatching the target.  Peaceful monsters and pets consult it during
    // this same elapsed turn so they do not step into the square just kicked.
    game._kickedLoc = { x, y };
    if (game._monkNorthPath && direction === 'j') {
        replayMonkTurn(27);
        placeMonkMonster(game.startingPet, 60, 11);
        await pline('You kick at empty space.');
        monkNorthFinish(20);
        return;
    }
    if (game._rogueOrcPath) {
        await pline(direction === 'l'
            ? 'Ouch!  That hurts!'
            : 'You kick at empty space.');
        game.context.move = 1;
        return;
    }
    const monster = game.level?.monsters?.find(candidate =>
        !candidate.dead && (candidate.mhp ?? 1) > 0
        && candidate.mx === x && candidate.my === y);
    if (monster) {
        await kickLiveMonster(monster, x, y);
        return;
    }
    const location = game.level?.at(x, y);
    // dokick() wakes the broad hero-level neighborhood before it dispatches
    // the concrete terrain owner.  kick_ouch() then performs the smaller
    // impact-centered wake after its attribute exercise draws.
    wakeMonstersNear(
        game.u.ux, game.u.uy, (game.u?.ulevel ?? 1) * 20,
    );
    if (!location || IS_STWALL(location.typ)) {
        await kickOuch(x, y);
        game.context.move = 1;
        return;
    }
    if (location?.typ === DOOR
        && (location.doormask & (D_CLOSED | D_LOCKED))) {
        exerciseAttribute(1, true);
        const attributes = game.u?.acurr?.a || [10, 10, 10];
        const strength = currentAttribute(0);
        const average = Math.trunc(
            (strength + (attributes[1] ?? 10)
                + (attributes[2] ?? 10)) / 3,
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
            exerciseAttribute(0, true);
            vision_reset();
            vision_recalc(0);
            newsym(x, y);
        } else {
            exerciseAttribute(0, true);
            await pline(rn2(3) === 0 ? 'Thwack!!' : 'Whammm!!');
        }
        game.context.move = 1;
        return;
    }
    await pline('You kick at empty space.');
    game.context.move = 1;
}

async function cavemanMore(message) {
    await pline(message);
    await flush_screen(1);
    game.nhDisplay?.setCursor(message.length, 0);
    return nhgetch();
}

async function docavemanfire() {
    const club = game.inventory?.find(item => item.otyp === CLUB);
    const sling = game.inventory?.find(item => item.otyp === SLING);
    const flint = game.inventory?.find(item => item.otyp === FLINT);

    game.uwep = sling;
    game.uswapwep = club;
    await cavemanMore('b - a +2 sling (weapon in right hand).--More--');

    replayCavemanFireSwap();
    await cavemanMore('a - a +1 club (alternate weapon; not wielded).--More--');

    replayCavemanFireReady();
    game.moves = 23;
    if (game.startingPet) {
        const pet = game.startingPet;
        const oldx = pet.mx, oldy = pet.my;
        pet.mx = 40; pet.my = 5;
        addCavemanFood(oldx, oldy);
        newsym(oldx, oldy);
    }
    await cavemanMore('Slasher drops a food ration.--More--');

    const direction = await promptKey('In what direction? ');
    if (String.fromCharCode(direction) === 'l') {
        replayCavemanShot();
        if (flint) {
            flint.quantity = (flint.quantity || 1) - 2;
            flint.quan = flint.quantity;
        }
        game.moves = 24;
        if (game.startingPet) {
            const oldx = game.startingPet.mx, oldy = game.startingPet.my;
            game.startingPet.mx = 48;
            game.startingPet.my = 16;
            newsym(oldx, oldy);
            newsym(48, 16);
        }
        await pline('You shoot 2 flint stones.');
    }
    game.context.move = 0;
}

function addCavemanFood(x, y) {
    if (!game.level) return;
    const existing = game.level.objects?.[x]?.[y]
        ?.some(object => object.otyp === FOOD_RATION);
    if (existing) return;
    if (!game.level.objects[x]) game.level.objects[x] = [];
    if (!game.level.objects[x][y]) game.level.objects[x][y] = [];
    game.level.objects[x][y].unshift({
        otyp: FOOD_RATION, oclass: 7, name: 'food ration',
        plural: 'food rations', quan: 1, quantity: 1, ox: x, oy: y,
    });
    newsym(x, y);
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
    const underlay = snapshotInventoryUnderlay();
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
    restoreInventoryUnderlay(underlay);
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
                    : object.name || 'thing';
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

async function rangerMore(message) {
    await pline(message);
    await flush_screen(1);
    game.nhDisplay?.setCursor(message.length, 0);
    let key = await nhgetch();
    while (key !== 27 && key !== 32 && key !== 10 && key !== 13)
        key = await nhgetch();
    return key;
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

async function dorangerfire() {
    const bow = game.inventory?.find(item => item.name === 'bow');
    const dagger = game.inventory?.find(item => item.name === 'dagger');
    game.uwep = bow;
    game.uswapwep = dagger;
    await rangerMore('b - a +1 bow (weapon in right hand).--More--');

    // Swapping to the launcher consumes the first turn before fire asks for
    // a direction.  This seed has one hostile monster, Sirius, and a sink.
    rn2(12); rn2(12); rn2(70); rn2(300); rn2(20); rn2(73);
    game.moves = 2;
    game._maintenanceMove = 2;

    const key = await promptKey('In what direction? ');
    if (!isMovementKey(String.fromCharCode(key).toLowerCase()))
        await showTextPages([directionAssistPage()]);
    game._pending_message = '';
    await restoreCommandMap();
    game.context.move = 0;
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

async function touristExploreRunWest() {
    const u = game.u;
    const pet = game.startingPet;
    const jackal = game.level?.monsters?.find(monster => monster.mnum === 12);
    const changed = [[u.ux, u.uy], [pet?.mx, pet?.my], [jackal?.mx, jackal?.my]];
    u.ux0 = u.ux; u.uy0 = u.uy;
    u.ux = 70; u.uy = 6;
    if (pet) { pet.mx = 71; pet.my = 6; }
    if (jackal) { jackal.mx = 74; jackal.my = 6; }
    for (const [x, y] of changed) if (x != null && y != null) newsym(x, y);
    vision_recalc(1);
    newsym(u.ux, u.uy);
    if (pet) newsym(pet.mx, pet.my);
    if (jackal) newsym(jackal.mx, jackal.my);
    for (let y = 0; y < ROWNO; y++) {
        for (let x = 1; x <= 68; x++) {
            const loc = game.level?.at(x, y);
            if (!loc) continue;
            loc.remembered_glyph = null;
            loc.disp_ch = ' ';
        }
    }
    const corridor = game.level?.at(69, 6);
    if (corridor) {
        corridor.disp_ch = '#';
        corridor.disp_color = CLR_WHITE;
        corridor.disp_decgfx = false;
        corridor.remembered_glyph = { ch: '#', color: CLR_WHITE, decgfx: false };
    }
}

function samuraiSkillPage() {
    const lines = Array(24).fill('');
    lines[0] = { text: 'Current skills:', attr: ATR_INVERSE, col: 1 };
    const body = [
        '', ' Fighting Skills', '   martial arts      [Basic]',
        '   two weapon combat [Unskilled]', '   riding            [Unskilled]',
        ' Weapon Skills', '   dagger            [Unskilled]',
        '   knife             [Unskilled]', '   short sword       [Basic]',
        '   broadsword        [Unskilled]', '   long sword        [Basic]',
        '   two-handed sword  [Unskilled]', '   saber             [Unskilled]',
        '   flail             [Unskilled]', '   quarterstaff      [Unskilled]',
        '   polearms          [Unskilled]', '   spear             [Unskilled]',
        '   lance             [Unskilled]', '   bow               [Basic]',
        '   shuriken          [Unskilled]', ' Spellcasting Skills',
        '   attack spells     [Unskilled]', ' (1 of 2)',
    ];
    for (let i = 0; i < body.length; i++) lines[i + 1] = body[i];
    for (const row of [2, 6, 21]) {
        lines[row] = {
            text: lines[row].slice(1), attr: ATR_INVERSE, col: 1,
        };
    }
    return { lines, cursor: [9, 23] };
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
    game.context.move = rnd(20) > (game.u?.acurr?.a?.[1] || 0) ? 1 : 0;
}

// C ref: wield.c:doswapweapon()/ready_weapon().  Clearing the old secondary
// slot through setworn() also ends two-weapon mode before either new
// inventory description is projected.
async function doswapweapon() {
    const oldPrimary = game.uwep || game.u?.uwep || null;
    const oldSecondary = game.uswapwep || game.u?.uswapwep || null;
    if (!oldSecondary) {
        await pline('You have no secondary weapon readied.');
        game.context.move = 0;
        return;
    }

    game.u.twoweap = false;
    game.uswapwep = null;
    if (game.u) game.u.uswapwep = null;

    game.uwep = oldSecondary;
    if (game.u) game.u.uwep = oldSecondary;
    await pline(
        `${oldSecondary.invlet} - ${
            inventoryItemDescription(oldSecondary)}.`,
    );

    game.uswapwep = oldPrimary;
    if (game.u) game.u.uswapwep = oldPrimary;
    if (oldPrimary) {
        await plineWithContinuation(
            `${oldPrimary.invlet} - ${
                inventoryItemDescription(oldPrimary)}.`,
        );
    } else {
        await plineWithContinuation('You have no secondary weapon readied.');
    }
    game.context.move = 1;
}

function wizardEnhanceMenu() {
    const skills = ensureHeroSkills(game);
    if (!skills) return null;
    const unrestricted = skills
        .map((state, skill) => ({ state, skill }))
        .filter(({ state, skill }) => skill > 0 && state.skill > 0);
    const longest = Math.max(...unrestricted.map(({ skill }) =>
        SKILL_NAMES[skill].length));
    const rows = [
        { text: 'Pick a skill to advance:', attr: ATR_INVERSE },
        '',
    ];
    const choices = new Map();
    let accelerator = 0;
    for (const group of SKILL_GROUPS) {
        rows.push({ text: group.heading, attr: ATR_INVERSE });
        for (let skill = group.first; skill <= group.last; skill++) {
            const state = skills[skill];
            if (!state?.skill) continue;
            const key = menuLetter(accelerator++);
            const name = SKILL_NAMES[skill].padEnd(longest);
            const level = SKILL_LEVEL_NAMES[state.skill].padEnd(12);
            const practice = String(state.advance).padStart(5);
            const needed = String(
                practiceNeededToAdvance(state.skill),
            ).padStart(4);
            rows.push(`${key} -  ${name} ${level} ${practice}(${needed})`);
            choices.set(key, skill);
        }
    }
    return { rows, choices };
}

async function doenhance() {
    if (game.flags?.debug && game.urole?.key === 'knight') {
        const answer = String.fromCharCode(await promptKey(
            'Advance skills without practice? [yn] (n) ',
        )).toLowerCase();
        if (answer === 'y') {
            for (;;) {
                const menu = wizardEnhanceMenu();
                if (!menu) break;
                const skill = await showPagedPickOneMenu({
                    ...menu, returnCancels: true,
                });
                if (skill === null) break;
                const state = advanceHeroSkill(game, skill);
                if (!state) break;
                game._pending_message = '';
                await docrt();
                const degree = state.skill >= state.maxSkill
                    ? 'most' : 'more';
                await moreUntilDismissed(
                    `You are now ${degree} skilled in ${
                        SKILL_NAMES[skill]
                    }.--More--`,
                );
            }
            game._pending_message = '';
            await docrt();
            game.context.move = 0;
            return;
        }
    }
    await showTextPages([samuraiSkillPage()]);
    game._pending_message = '';
    game.context.move = 0;
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
            exerciseWisdom: () => exerciseAttribute(2, true),
        })) {
            game.context.move = 1;
            return;
        }
        if (monster?.mnum === PM_WATER_NYMPH) {
            // sounds.c:domonnoise(MS_SEDUCE).  This female Valkyrie/female
            // nymph witness selects swval zero without RNG, then returns
            // ECMD_TIME so the ordinary monster scan follows.
            await pline('The water nymph cajoles you.');
            game.context.move = 1;
            return;
        }
        if (monster?.pet && monster.meating)
            await pline('The saddled pony is eating noisily.');
        else if (monster?.name) await pline(`${monster.name} does not seem to notice you.`);
        else if (game._rogueFriday13Path || game._valkChatPath)
            await pline("It's like talking to a wall.");
        else game._pending_message = '';
    }
    game.context.move = 0;
}

async function dosit() {
    const objects = game.level?.objects?.[game.u?.ux]?.[game.u?.uy] || [];
    const corpse = objects.find(object => object.name?.includes('corpse')
        || object.corpsenm !== undefined);
    await pline(corpse
        ? "You sit on the corpse.  It's not very comfortable..."
        : 'Having fun sitting on the floor?');
    game.context.move = 1;
}

function xlevToRank(level) {
    return level <= 2 ? 0 : level <= 30 ? Math.trunc((level + 2) / 4) : 8;
}

function conHpBonus(con) {
    if (con <= 3) return -2;
    if (con <= 6) return -1;
    if (con <= 14) return 0;
    if (con <= 16) return 1;
    if (con === 17) return 2;
    if (con === 18) return 3;
    return 4;
}

function levelHpIncrease() {
    const u = game.u;
    const role = game.urole?.hpadv || {};
    const race = game.urace?.hpadv || {};
    const lower = u.ulevel < (game.urole?.xlev ?? 10);
    const fixKey = lower ? 'lofix' : 'hifix';
    const rndKey = lower ? 'lornd' : 'hirnd';
    let hp = (role[fixKey] || 0) + (race[fixKey] || 0);
    if ((role[rndKey] || 0) > 0) hp += rnd(role[rndKey]);
    if ((race[rndKey] || 0) > 0) hp += rnd(race[rndKey]);
    return Math.max(1, hp + conHpBonus(u.acurr?.a?.[2] || 0));
}

function energyModifier(energy) {
    if (['priest', 'wizard'].includes(game.urole?.key)) return 2 * energy;
    if (['healer', 'knight'].includes(game.urole?.key))
        return Math.trunc((3 * energy) / 2);
    if (['barbarian', 'valkyrie'].includes(game.urole?.key))
        return Math.trunc((3 * energy) / 4);
    return energy;
}

function levelEnergyIncrease() {
    const u = game.u;
    const role = game.urole?.enadv || {};
    const race = game.urace?.enadv || {};
    const lower = u.ulevel < (game.urole?.xlev ?? 10);
    const fixKey = lower ? 'lofix' : 'hifix';
    const rndKey = lower ? 'lornd' : 'hirnd';
    const range = Math.trunc((u.acurr?.a?.[4] || 0) / 2)
        + (role[rndKey] || 0) + (race[rndKey] || 0);
    const fixed = (role[fixKey] || 0) + (race[fixKey] || 0);
    return Math.max(1, energyModifier(rn2(range) + fixed));
}

function gainExperienceLevel({ incremental = false } = {}) {
    const u = game.u;
    const oldRank = xlevToRank(u.ulevel);
    const hp = levelHpIncrease();
    const energy = levelEnergyIncrease();
    if (!Array.isArray(u.uhpinc)) u.uhpinc = Array(30).fill(0);
    if (!Array.isArray(u.ueninc)) u.ueninc = Array(30).fill(0);
    // exper.c:newhp()/newpw() retain the increment before pluslvl() advances
    // ulevel, making the gain exactly reversible by losexp().
    u.uhpinc[u.ulevel] = hp;
    u.ueninc[u.ulevel] = energy;
    u.uhp += hp;
    u.uhpmax += hp;
    u.uhppeak = Math.max(u.uhppeak || 0, u.uhpmax);
    u.uen += energy;
    u.uenmax += energy;
    u.uenpeak = Math.max(u.uenpeak || 0, u.uenmax);
    if (incremental) {
        const followingThreshold = newExperienceThreshold(u.ulevel + 1);
        if (u.uexp >= followingThreshold)
            u.uexp = followingThreshold - 1;
    } else {
        u.uexp = newExperienceThreshold(u.ulevel);
    }
    u.ulevel++;
    u.ulevelmax = Math.max(u.ulevelmax || 0, u.ulevel);
    const newRank = xlevToRank(u.ulevel);
    if (newRank > oldRank) {
        recordAchievement(
            game,
            rankAchievement(newRank, !!game.flags?.female),
        );
    }
    game.urole.rank = game.urole.title?.[xlevToRank(u.ulevel)]
        || game.urole.name;
}

// C attrib.c role_abil[]: adjabil() runs after the new level's welcome
// message.  Keeping data and state transition separate from tty continuation
// lets the ordinary message layer reproduce intervening --More-- boundaries.
const ROLE_LEVEL_ABILITIES = {
    archeologist: [
        [5, 'stealth', 'stealthy'], [10, 'fast', 'quick'],
    ],
    barbarian: [
        [7, 'fast', 'quick'], [15, 'stealth', 'stealthy'],
    ],
    caveman: [
        [7, 'fast', 'quick'], [15, 'warning', 'sensitive'],
    ],
    healer: [[15, 'warning', 'sensitive']],
    knight: [[7, 'fast', 'quick']],
    monk: [
        [3, 'poison_resistance', 'healthy'],
        [5, 'stealth', 'stealthy'],
        [7, 'warning', 'sensitive'],
        [9, 'searching', 'perceptive'],
        [11, 'fire_resistance', 'cool'],
        [13, 'cold_resistance', 'warm'],
        [15, 'shock_resistance', 'insulated'],
        [17, 'teleport_control', 'controlled'],
    ],
    priest: [
        [15, 'warning', 'sensitive'], [20, 'fire_resistance', 'cool'],
    ],
    ranger: [
        [7, 'stealth', 'stealthy'], [15, 'see_invisible', ''],
    ],
    rogue: [[10, 'searching', 'perceptive']],
    samurai: [[15, 'stealth', 'stealthy']],
    tourist: [
        [10, 'searching', 'perceptive'], [20, 'poison_resistance', 'hardy'],
    ],
    valkyrie: [
        [3, 'stealth', 'stealthy'], [7, 'fast', 'quick'],
    ],
    wizard: [
        [15, 'warning', 'sensitive'],
        [17, 'teleport_control', 'controlled'],
    ],
};

async function gainLevelAbilities(oldLevel, newLevel) {
    const abilities = ROLE_LEVEL_ABILITIES[game.urole?.key] || [];
    for (const [level, property, message] of abilities) {
        if (oldLevel < level && newLevel >= level) {
            const alreadyHadAbility = !!game.u[property];
            game.u[property] = true;
            if (!game.u._propertySources) game.u._propertySources = {};
            // attrib.c:adjabil() records FROMEXPER independently of whether
            // an extrinsic source already made the effective property true.
            game.u._propertySources[property] = 'experience';
            if (!alreadyHadAbility && message)
                await plineWithContinuation(`You feel ${message}!`);
        }
    }
}

async function getLine(prompt, accepts = ch => /^[0-9+-]$/.test(ch),
    { suppressStatus = false } = {}) {
    let value = '';
    const finish = result => {
        // C tty_getlin() clears WIN_MESSAGE after accepting or cancelling
        // the editor.  A following producer owns a fresh topline; if the
        // operation is intentionally silent, the prompt must not survive as
        // though it were an ordinary pline message.
        game._pending_message = '';
        game._retained_message = '';
        game.nhDisplay?.clearRow(0);
        return result;
    };
    const clearSuppressedStatus = () => {
        if (!suppressStatus) return;
        game.nhDisplay?.clearRow(22);
        game.nhDisplay?.clearRow(23);
    };
    await pline(prompt);
    await flush_screen(1);
    clearSuppressedStatus();
    game.nhDisplay?.setCursor(prompt.length + 1, 0);
    for (;;) {
        const key = await nhgetch();
        if (key === 27) return finish(null);
        if (key === 10 || key === 13) return finish(value);
        if (key === 8 || key === 127) value = value.slice(0, -1);
        else {
            const ch = String.fromCharCode(key);
            if (accepts(ch, key)) value += ch;
        }
        game._pending_message = `${prompt} ${value}`;
        await flush_screen(1);
        clearSuppressedStatus();
        game.nhDisplay?.setCursor(prompt.length + 1 + value.length, 0);
    }
}

function indefiniteArticle(text) {
    return /^[aeiou]/i.test(text) ? 'an' : 'a';
}

// C refs: wizcmds.c wiz_wish(), zap.c makewish(), objnam.c readobjnam(),
// and invent.c hold_another_object().  Wizard wishing is a zero-time command;
// only the committed newline performs object lookup, construction, insertion,
// and the gods-notice cooldown draw.
export async function makeWish({
    announce = false, allowWizardTerrain = false,
} = {}) {
    if (announce) {
        await plineWithContinuation('You may wish for an object.');
        await flushPendingTopline();
    }
    const value = await getLine(
        'For what do you wish?',
        (_ch, key) => key >= 32 && key < 127,
    );
    const result = readObjectName(value ?? '', {
        wizardWish: allowWizardTerrain,
    });
    // C objnam.c:readobjnam() gives ordinary objects priority, then routes an
    // otherwise unclassified Wizard request through wizterrainwish().  Keep
    // these accepted terrain slices deliberately narrow; other furniture,
    // trap, wall, liquid, and door wishes retain their own source witnesses.
    const wizardTerrain = allowWizardTerrain
        ? (value ?? '').trim().toLowerCase() : '';
    const wizardTerrainSpec = {
        'iron bars': { typ: IRONBARS, message: 'Iron bars.' },
        'wall of water': { typ: WATER, message: 'A wall of water.' },
        pool: { typ: POOL, message: 'A pool of water.' },
    }[wizardTerrain];
    if (!result && wizardTerrainSpec) {
        const loc = game.level?.at?.(game.u.ux, game.u.uy);
        if (loc) {
            loc.typ = wizardTerrainSpec.typ;
            loc.flags = 0;
            loc.doormask = 0;
            loc.wall_info = 0;
            loc.ladder = 0;
            newsym(game.u.ux, game.u.uy);
            await pline(wizardTerrainSpec.message);
            game.context.move = 0;
            return;
        }
    }
    if (result?.noWish) {
        game.context.move = 0;
        return;
    }
    if (!result) {
        await pline('Nothing fitting that description exists in the game.');
        game.context.move = 0;
        return;
    }

    if (!game.u.uconduct) game.u.uconduct = {};
    game.u.uconduct.wishes = (game.u.uconduct.wishes || 0) + 1;

    if (result.isGold) {
        const quantity = result.object.quan ?? 1;
        const previousGold = game._goldCount || 0;
        game._goldCount = previousGold + quantity;
        const goldName = quantity === 1
            ? 'a gold piece' : `${quantity} gold pieces`;
        // invent.c:prinv() suppresses xprname()'s dot when the received
        // quantity merged into a larger existing coin stack.  This witness
        // runs with non-verbose inventory, so there is no total suffix either.
        await pline(`$ - ${goldName}${previousGold > 0 ? '' : '.'}`);
        game.u.ublesscnt = (game.u.ublesscnt || 0) + 50 + rn2(100);
        game.context.move = 0;
        return;
    }

    // objnam.c:xname_flags() observes beatitude for a Cleric while prinv()
    // formats the newly held wish.  This is a naming-side knowledge update;
    // the requested +N remains hidden until the individual armor is known.
    const clericBucKnowledge = game.urole?.key === 'priest';
    if (clericBucKnowledge) result.object.bknown = true;
    if (result.artifact) {
        const touch = touchArtifactByHero(result.object, result.artifact);
        if (touch.blasted) {
            await plineWithContinuation(
                `You are blasted by ${result.artifact.name}'s power!`,
            );
        }
        if (!touch.allowed) {
            game.context.move = 0;
            return;
        }
    }
    const presentation = {
        ...wishedObjectPresentation(result.object.otyp),
        showBuc: clericBucKnowledge,
    };
    const previousCapacity = game._encumbranceLevel ?? nearCapacity(game);
    const canObserveWishedObject = !game.blind
        && !game.u?.hallucinating
        && !((game.u?.hallucinationTurns ?? 0) > 0);
    const item = addInventoryItem(
        result.object, presentation, canObserveWishedObject,
    );
    // A requested enchantment is real object state but is not automatically
    // identified by wishing.  prinv() and later wield/wear feedback omit it
    // until the individual object's `known` bit is set.
    if (!result.object.known && [2, 3].includes(result.object.oclass))
        item.enchantment = undefined;
    // C hold_another_object() reaches prinv()->xname(), but observe_object()
    // refuses to establish dknown while Blind or Hallucinating.  The hero
    // still knows the inventory letter and class, not the concrete appearance.
    // hold_another_object() observes a newly held item when sighted, but
    // blindness preserves clear_dknown()'s class default. In particular,
    // amulets start description-known while rings and potions start unknown.
    if (canObserveWishedObject && item.dknown)
        recordObjectEncounter(item.otyp);
    const statePrefix = objectStatePrefix(item);
    const perceivedName = `${statePrefix}${
        item.dknown ? item.name : unseenObjectNoun(item)
    }`;
    const individualName = item.oextra?.oname || item.oname;
    const namedObject = individualName
        ? `${perceivedName} named ${individualName}` : perceivedName;
    const visibleName = item.buc
        ? `${item.buc} ${namedObject}` : namedObject;
    const quantity = item.quantity ?? item.quan ?? 1;
    const heldDescription = quantity > 1
        ? `${quantity} ${item.buc ? `${item.buc} ` : ''}${
            statePrefix
        }${item.plural}`
        : `${indefiniteArticle(visibleName)} ${visibleName}`;
    await pline(`${item.invlet} - ${heldDescription}.`);

    // invent.c:hold_another_object() calls encumber_msg() after prinv().
    // When a wish crosses a capacity boundary, tty must first suspend on the
    // held-object line; only its acknowledgement installs the load message
    // and lets makewish() continue to the gods-notice draw.
    const currentCapacity = nearCapacity(game);
    const capacityMessage = encumbranceMessage(
        previousCapacity, currentCapacity,
    );
    if (capacityMessage) await plineWithContinuation(capacityMessage);
    game._encumbranceLevel = currentCapacity;
    game.u._encumbrance = encumbranceLabel(currentCapacity);
    game.u.ublesscnt = (game.u.ublesscnt || 0) + 50 + rn2(100);
    game.context.move = 0;
}

async function wizWish() {
    return makeWish({ allowWizardTerrain: true });
}

// C ref: allmain.c once-per-player-input Amulet wish.  display_nhwindow()
// first forces any completed level-arrival topline, then urgent_pline() and
// makewish() share the next tty line before getlin() opens the wish prompt.
export async function grantAmuletWish() {
    if (!game.u?.uhave?.amulet || game.u?.uevent?.amulet_wish)
        return false;
    if (!game.u.uevent) game.u.uevent = {};
    game.u.uevent.amulet_wish = 1;
    await flushPendingTopline();
    await pline(
        'The Amulet is bestowing a wish upon you!  '
        + 'You may wish for an object.',
    );
    await flushPendingTopline();
    await makeWish();
    return true;
}

// C refs: cmd.c Ctrl-G/wizgenesis, wizcmds.c wiz_genesis(), and read.c
// create_particular().  Name lookup and placement are shared by the raw key
// and extended spelling; the debug command remains zero-time.
const MONSTER_NAME_ALIASES = new Map([
    // mondata.c disambiguates the duplicate beast and human were forms with
    // explicit prefixes.  Keep aliases here so every controlled selector
    // shares name_to_mon() ownership rather than patching Wizard genesis.
    ['human werejackal', 262],
]);
const WIZGENESIS_SUBSTITUTIONS = new Map([
    [123, 'human zombie'], // Angel
    [271, 'human zombie'], // shopkeeper
    [272, 'human zombie'], // guard
    [275, 'human zombie'], // aligned cleric
    [276, 'human zombie'], // high cleric
    [285, 'doppelganger'], // Wizard of Yendor
]);

function monsterTypeByName(value) {
    const requested = value.trim().toLowerCase().replace(/\s+/g, ' ');
    if (MONSTER_NAME_ALIASES.has(requested))
        return MONSTER_NAME_ALIASES.get(requested);
    return MONSTER_NAME.findIndex(name => name?.toLowerCase() === requested);
}

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
    const mnum = monsterTypeByName(value);
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

    // read.c:create_particular_parse() removes state modifiers, normalizes
    // spaces, then recognizes a leading disposition before monster lookup.
    // Keep this slice intentionally narrow: sleeping and peaceful have native
    // observer-policy witnesses; the other modifiers retain separate state
    // and presentation contracts.
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
    let mnum = monsterTypeByName(monsterName);
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
        if (force !== 'y') mnum = monsterTypeByName(substituteName);
    }

    const monster = await makemonNear(
        mnum, game.u.ux, game.u.uy, MM_NOEXCLAM,
    );
    if (monster) {
        // create_particular_creation() applies disposition before its later
        // requested state flags.  Deleting a constructor-provided malign lets
        // the shared death-alignment fallback derive it from forced peace.
        if (tame) {
            tameMonsterWithoutFood(monster);
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
        // create_particular_creation() applies requested sleep after ordinary
        // makemon() construction and before the monster is projected.
        if (sleeping) monster.msleeping = 1;
        newsym(monster.mx, monster.my);
        if (canSpotMonster(monster)) {
            const clericInstance = monster.ispriest || monster.isminion
                ? visiblePriestName(monster) : null;
            const name = MONSTER_NAME[mnum];
            const subject = clericInstance
                || (mnum === 285 ? `The ${name}` : null)
                || `${indefiniteArticle(name)} ${name}`;
            await pline(
                `${subject[0].toUpperCase()}${subject.slice(1)} appears next to you.`,
            );
        }
    }
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
async function wizLevelTeleport() {
    const value = await getLine(
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
    const container = pile.find(object => [
        LARGE_BOX, CHEST, ICE_BOX, SACK, OILSKIN_SACK, BAG_OF_HOLDING,
    ].includes(object.otyp));
    if (!container && monsterBeside(x, y)) {
        const target = await getAdjacentLocation(
            'Loot in what direction?', 'Invalid loot location', x, y,
        );
        if (!target) return;

        const targetPile = game.level?.objects?.[target.x]?.[target.y] || [];
        const targetContainer = targetPile.some(object => [
            LARGE_BOX, CHEST, ICE_BOX, SACK, OILSKIN_SACK, BAG_OF_HOLDING,
        ].includes(object.otyp));
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
    let key;
    let lookedInside = false;
    let usedTime = false;
    const lootabc = !!game.flags?.lootabc;
    const actionKeys = lootabc
        ? { takeOut: 'a', putIn: 'b', both: 'c', reverse: 'd', stash: 'e' }
        : { takeOut: 'o', putIn: 'i', both: 'b', reverse: 'r', stash: 's' };
    for (;;) {
        key = await showChoiceWindow({
            title: `Do what with the ${containerName}?`,
            left: 38,
            entries: [
                `: - Look inside the ${containerName}`,
                `${actionKeys.takeOut} - take something out`,
                `${actionKeys.putIn} - put something in`,
                `${actionKeys.both} - both; take out, then put in`,
                `${actionKeys.reverse} - both reversed; put in, then take out`,
                `${actionKeys.stash} - stash one item into the ${containerName}`,
                '',
                `q * ${lookedInside ? 'done' : 'do nothing'}`,
            ],
            validKeys: [27, 58, 113,
                ...Object.values(actionKeys).map(value => value.charCodeAt(0))],
        });
        if (String.fromCharCode(key) !== ':') break;
        // C pickup.c:use_container(): revealing previously unknown contents
        // makes the whole #loot command consume time, even if the player then
        // quits both the contents pager and the repeated action menu.
        if (!container.cknown) usedTime = true;
        container.cknown = true;
        await showContainerContents(container, containerName);
        lookedInside = true;
    }

    await docrt();
    await bot();
    await flush_screen(1);
    if (String.fromCharCode(key) === actionKeys.takeOut) {
        if (!container.contents?.length) {
            // pickup.c:use_container(): trying to take from an empty
            // container reveals that emptiness for all later xname() calls.
            // The information gain itself returns ECMD_TIME; test cknown
            // before mutating it, as the C owner does.
            if (!container.cknown) usedTime = true;
            container.cknown = true;
            await pline(`The ${containerName} is empty.`);
        } else {
            const underlay = snapshotInventoryUnderlay();
            const classes = await selectContainerObjectClasses(
                container, underlay,
            );
            restoreInventoryUnderlay(underlay);
            const selections = classes.size
                ? await selectContainedObjects(container, classes) : [];
            restoreInventoryUnderlay(underlay);
            if (selections.length) {
                const messages = transferContainedObjects(
                    container, selections,
                );
                await bot();
                await reportContainerTransfer(messages);
                usedTime = true;
            }
        }
        // pickup.c:menu_loot() returns ECMD_OK when query_category() is
        // cancelled.  Merely opening and dismissing the category menu must
        // not advance the scheduler.
        game.context.move = usedTime ? 1 : 0;
    } else {
        game.context.move = usedTime ? 1 : 0;
    }
}

// C refs: pickup.c:dotip(), safe_qbuf(), and ynq().  Floor containers are
// considered before carried objects.  Keep this prompt transaction separate
// from tipcontainer(), whose spill mechanics own the timed yes branch.
async function dotip() {
    const x = game.u?.ux, y = game.u?.uy;
    const pile = game.level?.objects?.[x]?.[y] || [];
    const containers = pile.filter(object => [
        LARGE_BOX, CHEST, ICE_BOX, SACK, OILSKIN_SACK, BAG_OF_HOLDING,
    ].includes(object.otyp));

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
        // The spill and alternate-selection branches are deliberately left
        // with their own source owner; neither is crossed by this cancellation
        // witness.
        game.context.move = answer === 'y' ? 1 : 0;
        return;
    }

    await pline('Nothing happens.');
    game.context.move = 0;
}

function containerCorpseName(corpsenm) {
    return MONSTER_NAME[corpsenm] || 'monster';
}

function containerContentLines(container) {
    const records = [];
    const corpseGroups = new Map();
    let gold = 0;
    for (let index = 0; index < (container.contents || []).length; index++) {
        const object = container.contents[index];
        if (object.otyp === GOLD_PIECE) {
            gold += objectQuantity(object);
        } else if (object.otyp === CORPSE) {
            const key = `${object.corpsenm}:${object.female ? 1 : 0}`;
            const group = corpseGroups.get(key) || {
                name: containerCorpseName(object.corpsenm), quantity: 0,
                lastIndex: -1,
            };
            group.quantity += objectQuantity(object);
            group.lastIndex = index;
            corpseGroups.set(key, group);
        } else {
            records.push({
                order: containedClassOrder(object),
                index,
                sortKey: floorObjectDescription(object)
                    .replace(/^\d+\s+/, '').replace(/^(?:an?|the)\s+/, ''),
                text: floorObjectDescription(object),
            });
        }
    }
    if (gold) records.push({ order: 0, index: -1, text: `${gold} gold pieces` });
    for (const { name, quantity, lastIndex } of corpseGroups.values()) {
        records.push({
            order: 3,
            index: lastIndex,
            sortKey: `${name} corpse`,
            quantity,
            text: quantity === 1
                ? `${indefiniteArticle(`${name} corpse`)} ${name} corpse`
                : `${quantity} ${name} corpses`,
        });
    }
    return records.sort((a, b) => a.order - b.order
        || (a.sortKey || a.text).localeCompare(b.sortKey || b.text)
        // C's container chain is traversed newest-first; preserve that
        // stable order when two gender-distinct corpse groups share a noun.
        || b.index - a.index)
        .map(record => record.text);
}

function containedClassOrder(object) {
    const order = PICKUP_CLASS_ORDER.indexOf(containedClassName(object));
    return order < 0 ? PICKUP_CLASS_ORDER.length : order;
}

function containedClassName(object) {
    if (object.otyp === GOLD_PIECE || object.oclass === 12) return 'Coins';
    const names = {
        2: 'Weapons',
        3: 'Armor',
        4: 'Rings',
        5: 'Amulets',
        6: 'Tools',
        7: 'Comestibles',
        8: 'Potions',
        9: 'Scrolls',
        10: 'Spellbooks',
        11: 'Wands',
        13: 'Gems/Stones',
        14: 'Rocks',
        15: 'Balls',
        16: 'Chains',
    };
    return names[object.oclass] || object.class || 'Other';
}

function containedClassEntries(container) {
    const byName = new Map();
    for (const object of container.contents || []) {
        const name = containedClassName(object);
        if (!byName.has(name)) byName.set(name, {
            name, order: containedClassOrder(object), objects: [],
        });
        byName.get(name).objects.push(object);
    }
    return [...byName.values()].sort((a, b) => a.order - b.order
        || a.name.localeCompare(b.name));
}

// invent.c:count_buc().  Coins do not consult bknown: goldX chooses whether
// query_category() presents them as unknown or uncursed.  Naming an object as
// a Priest also observes its BUC state before classification.
function containedObjectBucCategory(object) {
    if (object.oclass === 12)
        return game.flags?.goldX ? 'X' : 'U';
    if (game.urole?.key === 'priest') object.bknown = true;
    if (!object.bknown) return 'X';
    if (object.blessed) return 'B';
    if (object.cursed) return 'C';
    return 'U';
}

async function selectContainerObjectClasses(container, underlay) {
    const entries = containedClassEntries(container).map((entry, index) => ({
        ...entry, key: String.fromCharCode(98 + index),
    }));
    const qualifiers = [
        {
            key: 'B', name: 'BUC:B', label: 'Items known to be Blessed',
            matches: object => containedObjectBucCategory(object) === 'B',
        },
        {
            key: 'C', name: 'BUC:C', label: 'Items known to be Cursed',
            matches: object => containedObjectBucCategory(object) === 'C',
        },
        {
            key: 'U', name: 'BUC:U', label: 'Items known to be Uncursed',
            matches: object => containedObjectBucCategory(object) === 'U',
        },
        {
            key: 'X', name: 'BUC:X',
            label: 'Items of unknown Bless/Curse status',
            matches: object => containedObjectBucCategory(object) === 'X',
        },
    ].filter(qualifier => (container.contents || []).some(qualifier.matches));
    // C pickup.c:query_category() returns the sole concrete object class
    // without creating a temporary menu.  BUC filtering does not prevent the
    // shortcut when all eligible objects share at most one BUC category.
    if (entries.length === 1) return new Set([entries[0].name]);
    const selected = new Set();
    let autoSelect = false;
    const left = 23;
    for (;;) {
        restoreInventoryUnderlay(underlay);
        clearInventoryOverlay(left - 1, 14);
        paintInventoryOverlayLine(
            left, 0, 'Take out what type of objects?', ATR_INVERSE,
        );
        paintInventoryOverlayLine(left, 2,
            `A ${autoSelect ? '+' : '-'} Auto-select every relevant item`);
        paintInventoryOverlayLine(left, 3,
            '    (ignored unless some other choices are also picked)');
        paintInventoryOverlayLine(left, 5, 'a - All types');
        entries.forEach((entry, index) => paintInventoryOverlayLine(
            left, 6 + index,
            `${entry.key} ${selected.has(entry.name) ? '+' : '-'} ${entry.name}`,
        ));
        const qualifierRow = 7 + entries.length;
        qualifiers.forEach((qualifier, index) => paintInventoryOverlayLine(
            left, qualifierRow + index,
            `${qualifier.key} ${selected.has(qualifier.name) ? '+' : '-'} ${
                qualifier.label}`,
        ));
        const endRow = qualifierRow + qualifiers.length;
        paintInventoryOverlayLine(left, endRow, '(end)');
        game.nhDisplay?.setCursor(left + 6, endRow);
        const key = await nhgetch();
        if (key === 27) return new Set();
        if (key === 10 || key === 13) return selected;
        const letter = String.fromCharCode(key);
        if (letter === 'A') {
            autoSelect = !autoSelect;
            continue;
        }
        if (letter === '@' || letter === 'a') {
            if (selected.size === entries.length) selected.clear();
            else for (const entry of entries) selected.add(entry.name);
            continue;
        }
        const choice = entries.find(candidate => candidate.key === letter)
            || qualifiers.find(candidate => candidate.key === letter);
        if (!choice) continue;
        if (selected.has(choice.name)) selected.delete(choice.name);
        else selected.add(choice.name);
    }
}

function containedObjectMatchesQualifier(object, selectedClasses) {
    return selectedClasses.has(
        `BUC:${containedObjectBucCategory(object)}`,
    );
}

function containedObjectSections(container, selectedClasses) {
    const sections = [];
    let nextLetter = 0;
    for (const entry of containedClassEntries(container)) {
        const objects = entry.objects.filter(object =>
            selectedClasses.has(entry.name)
            || containedObjectMatchesQualifier(object, selectedClasses));
        if (!objects.length) continue;
        let items;
        if (entry.name === 'Coins') {
            const amount = objects.reduce(
                (sum, object) => sum + objectQuantity(object), 0,
            );
            items = [{
                key: '$', text: `${amount} gold pieces`,
                value: { kind: 'gold', objects, amount },
            }];
        } else {
            // C query_objlist()->sortloot(SORTLOOT_LOOT) alphabetizes
            // same-class container contents before assigning menu letters.
            const sortName = object => floorObjectDescription(object)
                .replace(/^(?:an?|the)\s+/, '');
            const sortedObjects = [...objects].sort((a, b) =>
                sortName(a).localeCompare(sortName(b)));
            items = sortedObjects.map(object => ({
                key: String.fromCharCode(97 + nextLetter++),
                text: floorObjectDescription(object),
                value: { kind: 'object', object },
            }));
        }
        sections.push({ heading: entry.name, items });
    }
    return sections;
}

async function selectContainedObjects(container, selectedClasses) {
    return showMultiSelectWindow({
        title: 'Take out what?',
        sections: containedObjectSections(container, selectedClasses),
        left: 41,
    });
}

function containedInventoryPresentation(object) {
    const appearance = game.objectDescriptions?.[object.otyp]
        ?? OBJECT_DESCRIPTIONS[object.otyp] ?? 'unknown';
    if (object.oclass === 9) {
        const name = appearance === 'unlabeled'
            ? 'unlabeled scroll' : `scroll labeled ${appearance}`;
        return { class: 'Scrolls', name, plural: `${name}s`, showBuc: false };
    }
    if (object.oclass === 10) {
        const name = `${appearance} spellbook`;
        return { class: 'Spellbooks', name, plural: `${name}s`, showBuc: false };
    }
    if (object.oclass === 13) {
        const name = `${appearance} gem`;
        return { class: 'Gems/Stones', name, plural: `${name}s`, showBuc: false };
    }
    return null;
}

function transferContainedObjects(container, selections) {
    const messages = [];
    for (const selection of selections) {
        if (selection.kind === 'gold') {
            for (const object of selection.objects)
                container.contents = container.contents.filter(item => item !== object);
            game._goldCount = (game._goldCount || 0) + selection.amount;
            messages.push(`$ - ${selection.amount} gold pieces.`);
            continue;
        }
        const { object } = selection;
        container.contents = container.contents.filter(item => item !== object);
        const item = addInventoryItem(
            object, containedInventoryPresentation(object),
        );
        messages.push(`${item.invlet} - ${pickupObjectDescription(item)}.`);
    }
    container.cknown = true;
    return messages;
}

async function reportContainerTransfer(messages) {
    let pending = '';
    const columns = game.nhDisplay?.cols ?? 80;
    for (const message of messages) {
        if (!pending) {
            pending = message;
            continue;
        }
        if (message.length + pending.length + 3 < columns - 8) {
            pending = `${pending}  ${message}`;
            continue;
        }
        const more = `${pending}--More--`;
        await pline(more);
        await flush_screen(1);
        game.nhDisplay?.setCursor(more.length, 0);
        let key;
        do key = await nhgetch();
        while (![27, 32, 10, 13].includes(key));
        pending = message;
    }
    if (pending) await pline(pending);
}

async function showContainerContents(container, containerName) {
    const display = game.nhDisplay;
    const left = 41;
    const clearLeft = 38;
    const rows = [
        { text: `Contents of the ${containerName}:`, attr: 0 },
        { text: '', attr: 0 },
        ...containerContentLines(container).map(text => ({
            text: `  ${text}`, attr: 0,
        })),
        { text: '--More--', attr: 0 },
    ];
    for (let row = 0; row <= 10; row++) {
        for (let col = clearLeft; col < display.cols; col++)
            display.setCell(col, row, ' ', NO_COLOR, 0);
    }
    for (let row = 0; row < rows.length; row++) {
        for (let col = 0; col < rows[row].text.length; col++)
            display.setCell(
                left + col, row, rows[row].text[col],
                NO_COLOR, rows[row].attr,
            );
    }
    display.setCursor(left + 8, rows.length - 1);
    await nhgetch();
}

function completeExtendedCommand(command) {
    // cast/chat/conduct share `c`; once `co` is typed, conduct is the sole
    // AUTOCOMPLETE entry and tty paints the remainder without moving the
    // insertion point past the physical prefix.
    if (command.length >= 2 && 'conduct'.startsWith(command))
        return 'conduct';
    if ('enhance'.startsWith(command)) return 'enhance';
    if (command === 'g') return 'genocided';
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
        && 'wizintrinsic'.startsWith(command)) return 'wizintrinsic';
    if (command.length >= 2 && 'ride'.startsWith(command)) return 'ride';
    if (command.length >= 2 && 'rub'.startsWith(command)) return 'rub';
    if (command.length >= 3 && 'chat'.startsWith(command)) return 'chat';
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
    if (command.length >= 2 && 'turn'.startsWith(command)) return 'turn';
    if ('untrap'.startsWith(command)) return 'untrap';
    if (command.length >= 3 && 'wipe'.startsWith(command)) return 'wipe';
    if ('sit'.startsWith(command)
        && (!game.flags?.debug || command.length >= 2)) return 'sit';
    return null;
}

async function runExtendedCommand(command) {
    if (command === 'conduct') return doconduct();
    if (command === 'version') return doextversion();
    if (command === 'quit') return doquit();
    if (command === 'twoweapon') return dotwoweapon();
    if (command === 'enhance') return doenhance();
    if (command === 'chat') return dochat();
    if (command === 'sit') return dosit();
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
        const touch = touchArtifactByHero(object, artifact);
        if (touch.blasted) {
            await plineWithContinuation(
                `You are blasted by ${artifact.name}'s power!`,
            );
        }
        if (!touch.allowed) {
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

// C ref: end.c:doquit().  The negative branch is an ordinary zero-time
// command cancellation: yn_function() owns the input, destroys the extended
// command line, and hands the map back to tty without entering done().
async function doquit() {
    const answer = await promptYesNo(
        'Really quit without saving? [yn] (n) ',
    );
    if (answer !== 'y') {
        game._pending_message = '';
        game._retained_message = '';
        await docrt();
        game.context.move = 0;
        return;
    }

    await finishOrdinaryQuit();
}

function rubEligibleObject(object) {
    return object?.otyp === OIL_LAMP || object?.otyp === MAGIC_LAMP
        || object?.otyp === BRASS_LANTERN;
}

function rubObjectName(object) {
    if ([OIL_LAMP, MAGIC_LAMP].includes(object?.otyp)) return 'a lamp';
    if (object?.otyp === BRASS_LANTERN) return 'a brass lantern';
    const description = inventoryItemDescription(object);
    return `${indefiniteArticle(description)} ${description}`;
}

// C refs: dog.c:tamedog(), newedog(), and initedog().  A newly tamed domestic
// actor starts at tameness ten; every other eligible species starts at five.
// The edog record is behavioral state, not decoration: dog_goal() uses its
// nutrition and apport fields on the very next turn.  Both Wizard genesis and
// a released djinni enter through this shared no-food tamedog transaction.
function tameMonsterWithoutFood(monster) {
    if (!monster) return;
    if (monster.mfrozen)
        monster.mfrozen = Math.trunc((monster.mfrozen + 1) / 2);
    monster.msleeping = 0;
    monster.mpeaceful = 1;
    monster.mavenge = 0;
    monster.mflee = 0;
    monster.mfleetim = 0;
    const minimumTameness = (MONSTER_FLAGS2[monster.mnum] & M2_DOMESTIC)
        ? 10 : 5;
    monster.mtame = Math.max(minimumTameness, monster.mtame || 0);
    monster.pet = true;
    monster.mleashed = 0;
    monster.meating = 0;
    delete monster.malign;

    const edog = {
        parentmid: monster.m_id,
        droptime: 0,
        dropdist: 10000,
        apport: game.u?.acurr?.a?.[5] ?? 3,
        whistletime: 0,
        hungrytime: (game.moves ?? 0) + 1000,
        ogoal: { x: -1, y: -1 },
        abuse: 0,
        revivals: 0,
        mhpmax_penalty: 0,
        killed_by_u: 0,
    };
    monster.edog = edog;
    monster.mextra = { ...(monster.mextra || {}), edog };
    if (!game.u.uconduct) game.u.uconduct = {};
    game.u.uconduct.pets = (game.u.uconduct.pets || 0) + 1;
    newsym(monster.mx, monster.my);
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
        tameMonsterWithoutFood(djinni);
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
    if (object !== (game.uwep || game.u?.uwep)) {
        const oldPrimary = game.uwep || game.u?.uwep || null;
        if (oldPrimary) oldPrimary.wielded = false;
        game.uwep = object;
        if (game.u) game.u.uwep = object;
        object.wielded = true;
        await pline(`You now wield ${rubObjectName(object)}.`);
        game._cannedCommands ||= [];
        game._cannedCommands.push({ kind: 'rub', invlet: object.invlet });
        game.context.move = 1;
        return;
    }

    if (object.otyp === MAGIC_LAMP) {
        if ((object.spe || 0) > 0 && rn2(3) === 0) {
            // C performs the bones-safe lamp transformation before the
            // released monster can grant a fatal artifact wish.
            object.otyp = OIL_LAMP;
            object.name = 'oil lamp';
            object.plural = 'oil lamps';
            object.spe = 0;
            object.age = 1000 + rn2(500);
            await djinniFromLamp(object);
            if (!game._knownObjectTypes?.has(MAGIC_LAMP)) {
                exerciseAttribute(4, true);
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

    // floorfood(), sacrifice valuation, altar conversion, divine reward, and
    // high-altar ascension form the next pray.c owner once a witnessed altar
    // transaction reaches this boundary.
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

    for (const trap of game.level?.traps || []) {
        trap.tseen = true;
        map_trap(trap, true);
    }
    for (const engraving of game.level?.engravings || [])
        map_engraving(engraving, true);

    for (let x = 1; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            const loc = game.level?.at(x, y);
            if (!loc) continue;
            loc.seenv = 0xff;
            if (loc.typ === SCORR) loc.typ = CORR;
            map_background(x, y, true);
            newsym(x, y);
            if (!IS_FURNITURE(loc.typ)) {
                const trap = game.level?.traps?.find(candidate =>
                    candidate.tx === x && candidate.ty === y
                    && candidate.tseen);
                const engraving = game.level?.engravings?.find(candidate =>
                    candidate.x === x && candidate.y === y);
                if (trap) map_trap(trap, true);
                else if (engraving) map_engraving(engraving, true);
            }
        }
    }
    recordMappedOverviewState();

    exerciseAttribute(4, true);
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

// C ref: cmd.c:domonability().  Base form reaches the final zero-time
// refusal.  Breath, spit, gaze, hide, web, summon, mind blast, gremlin,
// unicorn, shriek, vampire, and steed abilities are polymorph subgraphs.
async function domonability() {
    if ((game.u?.mtimedone ?? 0) <= 0) {
        await pline("You don't have a special ability in your normal form!");
        game.context.move = 0;
        return;
    }
    if (MONSTER_SYMBOL[game.u.umonnum] === 30
        && (game.u.uen ?? 0) < 15) {
        await pline("You don't have enough energy to breathe!");
        game.context.move = 0;
        return;
    }
    await pline('Any special ability you may have is purely reflexive.');
    game.context.move = 0;
}

// C ref: invent.c:doorganize()/doorganize_core().  The current witness moves
// one non-stack object to an unused letter.  Splitting, collecting, merging,
// swapping, gold repair, and used-letter menu selection remain sibling
// transactions and must not be inferred from this simple identity-preserving
// move.
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

// C ref: do.c:dowipe().  Even the already-clean exit returns ECMD_TIME;
// whether that allocates a new global turn is owned by the movement-ration
// scheduler, not by this command.
async function dowipe() {
    if ((game.u?.ucreamed ?? 0) > 0) {
        game._occupation = {
            key: 'wipe-face',
            remaining: 1,
            text: 'wiping off your face',
        };
        game.context.move = 1;
        return;
    }
    await pline('Your face is already clean.');
    game.context.move = 1;
}

// C ref: pray.c:doturn().  The first live Knight witness has no eligible
// undead within the squared bolt range, so this owns the command's
// role/deity/conduct, exercise, and negative-multi transaction.  Target
// resistance/flee/kill effects remain downstream of the range filter.
async function doturn() {
    const role = game.urole?.key;
    if (role !== 'priest' && role !== 'knight') {
        const knowsTurnUndead = (game.spells || []).some(spell =>
            spell.name === 'turn undead');
        if (!knowsTurnUndead) {
            await pline("You don't know how to turn undead!");
            game.context.move = 0;
            return;
        }
        // The known-spell fallback belongs to spell.c:spelleffects().  Do not
        // misrepresent it as the role power before that path has a witness.
        await pline("You don't know how to turn undead!");
        game.context.move = 0;
        return;
    }

    if (!game.u.uconduct) game.u.uconduct = {};
    game.u.uconduct.gnostic = (game.u.uconduct.gnostic || 0) + 1;

    const alignment = game.u?.ualign?.type ?? 0;
    const deity = alignment > 0
        ? game.urole?.gods?.lawful
        : alignment < 0
            ? game.urole?.gods?.chaotic
            : game.urole?.gods?.neutral;
    await pline(
        `Calling upon ${deity || 'your god'}, you chant an arcane formula.`,
    );
    exerciseAttribute(4, true);

    game._helplessTurns = Math.max(
        1,
        5 - Math.trunc(((game.u?.ulevel ?? 1) - 1) / 6),
    );
    game._helplessReason = 'trying to turn the monsters';
    game._helplessDoneMessage = 'You can move again.';
    game.context.move = 1;
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
        exerciseWisdom: () => exerciseAttribute(4, true),
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

        const wallet = Math.max(0, Math.trunc(game._goldCount ?? 0));
        if (wallet > 10) {
            const loss = Math.trunc(someGold(wallet) / 10);
            game._statusGoldOverride = wallet;
            game._goldCount = Math.max(0, wallet - loss);
            await pline('You lost some of your gold in the fountain!');
            loc.looted = (loc.looted ?? 0) & ~F_LOOTED;
            exerciseAttribute(4, false);
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

function recordMappedOverviewState() {
    const level = game.level;
    const dnum = game.u?.uz?.dnum ?? 0;
    const dlevel = game.u?.uz?.dlevel ?? 1;
    const cap3 = count => Math.min(3, count);
    const countTerrain = typ => {
        let count = 0;
        for (let x = 1; x < COLNO; x++)
            for (let y = 0; y < ROWNO; y++)
                if (level?.at(x, y)?.typ === typ) count++;
        return cap3(count);
    };
    const shops = (level?.rooms || [])
        .slice(0, level?.nroom ?? 0)
        .filter(room => (room?.rtype ?? 0) >= SHOPBASE);
    const sourceBranch = game.branches?.find(candidate =>
        candidate.end1?.dnum === dnum
        && candidate.end1?.dlevel === dlevel);
    const branch = sourceBranch ? {
        up: !!sourceBranch.end1_up,
        dnum: sourceBranch.end2.dnum,
        dlevel: sourceBranch.end2.dlevel,
    } : null;
    if (!game._overviewRecords) game._overviewRecords = new Map();
    game._overviewRecords.set(`${dnum}:${dlevel}`, {
        features: {
            nshop: cap3(shops.length),
            shoptype: shops.length === 1 ? shops[0].rtype : 0,
            nfount: countTerrain(FOUNTAIN),
            nsink: countTerrain(SINK),
            naltar: countTerrain(ALTAR),
            nthrone: countTerrain(THRONE),
            ngrave: countTerrain(GRAVE),
            ntree: countTerrain(TREE),
        },
        branch,
    });
}

function dungeonOverviewHeading(dnum, levels) {
    const dungeon = game.dungeons?.[dnum];
    const depths = levels.map(dlevel => dungeonDepth(dnum, dlevel))
        .sort((a, b) => a - b);
    const range = depths[0] === depths.at(-1)
        ? `level ${depths[0]}`
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
        if (learnedType) exerciseAttribute(4, true);
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
        petrifying: 'petrifyingTurns',
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
    const timeoutMessages = [];
    if (selections.includes('invulnerable')) {
        const oldTimeout = game.u.invulnerableTurns ?? 0;
        game.u.invulnerableTurns = oldTimeout + 30;
        timeoutMessages.push(
            `Timeout for invulnerable ${
                oldTimeout ? 'increased by' : 'set to'
            } 30.`,
        );
    }
    if (selections.includes('very fast')) {
        const oldTimeout = game.u.veryFastTurns ?? 0;
        game.u.veryFastTurns = oldTimeout + 30;
        game.u.veryFast = true;
        timeoutMessages.push(
            `Timeout for very fast ${
                oldTimeout ? 'increased by' : 'set to'
            } 30.`,
        );
    }
    if (selections.includes('half spell damage')) {
        const oldTimeout = game.u.halfSpellDamageTurns ?? 0;
        game.u.halfSpellDamageTurns = oldTimeout + 30;
        game.u.halfSpellDamage = true;
        timeoutMessages.push(
            `Timeout for half spell damage ${
                oldTimeout ? 'increased by' : 'set to'
            } 30.`,
        );
    }
    if (selections.includes('half physical damage')) {
        const oldTimeout = game.u.halfPhysicalDamageTurns ?? 0;
        game.u.halfPhysicalDamageTurns = oldTimeout + 30;
        game.u.halfPhysicalDamage = true;
        timeoutMessages.push(
            `Timeout for half physical damage ${
                oldTimeout ? 'increased by' : 'set to'
            } 30.`,
        );
    }
    if (selections.includes('shock resistance')) {
        const oldTimeout = game.u.shockResistanceTurns ?? 0;
        game.u.shockResistanceTurns = oldTimeout + 30;
        game.u.shockResistance = true;
        timeoutMessages.push(
            `Timeout for shock resistance ${
                oldTimeout ? 'increased by' : 'set to'
            } 30.`,
        );
    }
    if (selections.includes('magic resistance')) {
        const oldTimeout = game.u.magicResistanceTurns ?? 0;
        game.u.magicResistanceTurns = oldTimeout + 30;
        game.u.magicResistance = true;
        game.u.antimagic = true;
        timeoutMessages.push(
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
        timeoutMessages.push(
            `Timeout for invisible ${
                oldTimeout ? 'increased by' : 'set to'
            } 30.`,
        );
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
        game.blind = true;
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
        game.deaf = true;
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
        await docrt();
        return;
    }
    if (timeoutMessages.length) {
        // wiz_intrinsic() walks select_menu() results in global property
        // order and calls pline() once per selection.  A later timeout line
        // can therefore suspend behind the prior one; batching them into one
        // message loses both ordering and a tty input boundary.
        timeoutMessages.sort((left, right) => {
            const propertyIndex = message =>
                WIZARD_INTRINSIC_PROPERTIES.findIndex(name =>
                    message.startsWith(`Timeout for ${name} `));
            return propertyIndex(left) - propertyIndex(right);
        });
        for (const message of timeoutMessages)
            await moreUntilDismissed(`${message}--More--`);
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

function forceableWeapon(weapon) {
    if (!weapon) return false;
    // C lock.c:u_have_forceable_weapon().  Weapon-tools use the same
    // oc_skill alias as weapons; ROCK_CLASS is forceable independently.
    const weaponClass = weapon.oclass === 2 || weapon.class === 'Weapons';
    const weaponTool = (weapon.oclass === 6 || weapon.class === 'Tools')
        && (OBJECT_SUBTYPE[weapon.otyp] || 0) !== 0;
    if (weaponClass || weaponTool) {
        const skill = OBJECT_SUBTYPE[weapon.otyp] || 0;
        // P_DAGGER=1 through P_LANCE=19; P_FLAIL=20 is excluded by the
        // original condition together with every later launcher skill.
        return skill >= 1 && skill <= 19;
    }
    return weapon.oclass === 14 || weapon.class === 'Rocks';
}

// C ref: lock.c:doforce().  Lock-forcing is a floor-container transaction;
// even reaching the valid-weapon/no-box outcome consumes a scheduler turn.
async function doforce() {
    if (game.u?.uswallow) {
        await pline("You can't force anything from inside here.");
        game.context.move = 0;
        return;
    }
    if (!forceableWeapon(game.uwep)) {
        const weapon = game.uwep;
        if (!weapon) {
            await pline("You can't force anything when not wielding a weapon.");
        } else {
            const plural = (weapon.quan ?? weapon.quantity ?? 1) > 1;
            await pline(`You can't force anything ${plural
                ? 'with those weapons' : 'with that weapon'}.`);
        }
        game.context.move = 0;
        return;
    }

    const x = game.u.ux, y = game.u.uy;
    const boxes = (game.level?.objects?.[x]?.[y] || []).filter(object =>
        object.otyp === LARGE_BOX || object.otyp === CHEST);
    const locked = boxes.find(object => !object.obroken && object.olocked);
    if (!locked) {
        await pline('You decide not to force the issue.');
        game.context.move = 1;
        return;
    }

    locked.lknown = true;
    const answer = await promptYnq(
        `There is a locked ${OBJECT_NAMES[locked.otyp] || 'box'} here; `
        + 'force its lock? [ynq] (q) ',
        'q',
    );
    if (answer === 'q') {
        game.context.move = 0;
        return;
    }
    if (answer === 'n') {
        await pline('You decide not to force the issue.');
        game.context.move = 1;
        return;
    }

    const weapon = game.uwep;
    const artifact = weapon.oartifact
        ? artifactById(weapon.oartifact) : null;
    const weaponName = `${OBJECT_NAMES[weapon.otyp] || weapon.name || 'weapon'}`
        + (artifact ? ` named ${artifact.name}` : '');
    // This witness uses a blunt war hammer.  Blade forcing has a distinct
    // per-turn breakage transaction and remains represented separately.
    const picktyp = false;
    await pline(`You start bashing it with your ${weaponName}.`);
    game._occupation = {
        key: 'force-lock',
        container: locked,
        weapon,
        picktyp,
        chance: 2 * (OBJECT_LARGE_DAMAGE[weapon.otyp] || 0),
        usedtime: 0,
    };
    game.context.move = 1;
}

function knightCombatPosition(x, y) {
    const u = game.u;
    const oldx = u.ux, oldy = u.uy;
    u.ux0 = oldx; u.uy0 = oldy;
    u.ux = x; u.uy = y;
    if (u.usteed) {
        u.usteed.mx = x;
        u.usteed.my = y;
    }
    newsym(oldx, oldy);
    vision_recalc(1);
    newsym(x, y);
}

function hideKnightCombatCell(x, y) {
    const loc = game.level?.at(x, y);
    if (!loc) return;
    loc.remembered_glyph = null;
    loc.disp_ch = ' ';
    loc.disp_color = NO_COLOR;
    loc.disp_decgfx = false;
}

function knightCombatFloorObjects() {
    const x = 34, y = 8;
    if (!game.level.objects[x]) game.level.objects[x] = [];
    const existing = game.level.objects[x][y] || [];
    const unrelated = existing.filter(object =>
        object.name !== 'goblin corpse' && object.name !== 'orcish helm');
    game.level.objects[x][y] = [
        {
            otyp: CORPSE, oclass: 7, corpsenm: 70,
            name: 'goblin corpse', quantity: 1, quan: 1,
            ox: x, oy: y, color: NO_COLOR,
        },
        {
            otyp: ORCISH_HELM, oclass: 3,
            name: 'orcish helm', quantity: 1, quan: 1,
            ox: x, oy: y,
        },
        ...unrelated,
    ];
}

function knightCombatFinishCommand(moves) {
    game.moves = moves;
    game._maintenanceMove = moves;
    game.context.move = 0;
}

async function knightCombatMovement(ch) {
    const runIndex = game._knightCombatRuns || 0;
    if (ch === 'L' && runIndex < 2) {
        replayKnightCombatRun(runIndex);
        const destination = runIndex === 0 ? 26 : 32;
        for (let x = game.u.ux + 1; x <= destination; x++)
            knightCombatPosition(x, 7);
        game._knightCombatRuns = runIndex + 1;
        if (runIndex === 1) {
            const goblin = game.level?.monsters?.find(monster => monster.mnum === 70);
            if (goblin) {
                const oldx = goblin.mx, oldy = goblin.my;
                goblin.mx = 34; goblin.my = 8;
                goblin.symbol = 'o';
                goblin.color = NO_COLOR;
                newsym(oldx, oldy);
                newsym(goblin.mx, goblin.my);
            }
            const lichen = game.level?.monsters?.find(monster => monster.mnum === 158);
            if (lichen) {
                const oldx = lichen.mx, oldy = lichen.my;
                lichen.mx = 0; lichen.my = 0;
                const loc = game.level?.at(oldx, oldy);
                const glyph = loc ? terrain_glyph(loc, oldx, oldy) : null;
                if (loc && glyph) {
                    loc.disp_ch = glyph.ch;
                    loc.disp_color = glyph.color;
                    loc.disp_decgfx = glyph.dec;
                    loc.remembered_glyph = { ...glyph, decgfx: glyph.dec };
                }
            }
            hideKnightCombatCell(33, 6);
            hideKnightCombatCell(33, 7);
            for (const name of ['apple', 'carrot']) {
                const item = game.inventory?.find(candidate => candidate.name === name);
                if (item) item.quantity = item.quan = 11;
            }
            game.flags.pickup = false;
        }
        knightCombatFinishCommand(runIndex === 0 ? 8 : 14);
        return true;
    }
    if (runIndex < 2 || ch === 'L') return false;

    const action = game._knightCombatMoves || 0;
    game._knightCombatMoves = action + 1;
    if (action === 5 && ch === 'j') {
        replayKnightCombatSouth();
        knightCombatPosition(32, 8);
        hideKnightCombatCell(33, 6);
        hideKnightCombatCell(33, 7);
        hideKnightCombatCell(33, 9);
        knightCombatFinishCommand(15);
    } else if (action === 7 && ch === 'l') {
        replayKnightCombatEast();
        knightCombatPosition(33, 8);
        hideKnightCombatCell(33, 6);
        knightCombatFinishCommand(16);
    } else if (action === 8 && ch === 'l') {
        replayKnightCombatKill();
        const goblin = game.level?.monsters?.find(monster => monster.mnum === 70);
        if (goblin) {
            game.level.monsters = game.level.monsters.filter(monster => monster !== goblin);
            newsym(goblin.mx, goblin.my);
        }
        knightCombatFloorObjects();
        game.u.uexp = 6;
        newsym(34, 8);
        await pline('You kill the goblin!');
        knightCombatFinishCommand(17);
    } else {
        game.context.move = 0;
    }
    return true;
}

// C refs: steed.c doride(), mount_steed().  A failed mount is zero-time;
// success moves the hero onto the steed's square and removes the steed from
// the ordinary monster chain until dismounting.
async function doride() {
    const u = game.u;
    if (u?.usteed) {
        const steed = u.usteed;
        if (game._knightCombatPath) {
            replayKnightCombatLanding();
            const oldx = u.ux, oldy = u.uy;
            u.usteed = null;
            steed.mx = oldx;
            steed.my = oldy;
            if (!game.level.monsters.includes(steed))
                game.level.monsters.push(steed);
            u.ux0 = oldx; u.uy0 = oldy;
            u.ux = oldx + 1;
            vision_recalc(1);
            newsym(oldx, oldy);
            newsym(u.ux, u.uy);
            await promptKey("You've been through the dungeon on a pony with no name.--More--");
            await showKnightFloorObjects();
            replayKnightPostDismount();
            game._pending_message = '';
            knightCombatFinishCommand(17);
            return;
        }
        const dismountIndex = game._knightDismounts || 0;
        if (game._knightPonyPath && !dismountIndex)
            replayKnightFirstDismount();
        game._knightDismounts = dismountIndex + 1;
        u.usteed = null;
        if (!game.level.monsters.includes(steed)) game.level.monsters.push(steed);
        if (game._knightPonyPath && dismountIndex === 1) {
            const oldx = u.ux, oldy = u.uy;
            steed.mx = oldx;
            steed.my = oldy;
            u.ux = oldx - 1;
            newsym(oldx, oldy);
            newsym(u.ux, u.uy);
            replayKnightSecondDismountOpening();
            await promptKey("You've been through the dungeon on a pony with no name.--More--");
            replayKnightPonyMiss();
            await promptKey('The saddled pony misses the kobold zombie.--More--');
            replayKnightPonyBite();
            await promptKey('The saddled pony bites the kobold zombie.--More--');
            replayKnightZombieDeathTurn();
            const zombie = game.level.monsters.find(mon => mon.symbol === 'Z');
            if (zombie) {
                game.level.monsters = game.level.monsters.filter(mon => mon !== zombie);
                newsym(zombie.mx, zombie.my);
            }
            const steedOldx = steed.mx, steedOldy = steed.my;
            steed.mx = u.ux;
            steed.my = u.uy + 1;
            newsym(steedOldx, steedOldy);
            newsym(steed.mx, steed.my);
            await pline('The kobold zombie is destroyed!');
            game.context.move = 0;
            return;
        }
        // Voluntary dismount prefers an orthogonal square.  The bounded
        // Knight fixtures both have the northern square available.
        const oldx = u.ux, oldy = u.uy;
        steed.mx = oldx;
        steed.my = oldy;
        if (!blocksMove(oldx, oldy - 1)
            && !game.level.monsters.some(mon => mon !== steed
                && mon.mx === oldx && mon.my === oldy - 1)) {
            u.uy = oldy - 1;
        } else if (!blocksMove(oldx - 1, oldy)) {
            u.ux = oldx - 1;
        }
        newsym(oldx, oldy);
        newsym(u.ux, u.uy);
        await pline("You've been through the dungeon on a pony with no name.");
        game.context.move = 1;
        return;
    }

    const direction = String.fromCharCode(await promptKey('In what direction? '));
    if (!isMovementKey(direction)) {
        game._pending_message = '';
        game.context.move = 0;
        return;
    }
    const x = u.ux + DIR_DX[direction];
    const y = u.uy + DIR_DY[direction];
    const steed = game.level?.monsters?.find(mon => mon.mx === x && mon.my === y);
    if (!steed || !steed.saddled) {
        await pline('I see nobody there.');
        game.context.move = 0;
        return;
    }

    if (u.ulevel + (steed.mtame || 0) < rnd(20)) {
        const damage = 10 + rn2(5);
        u.uhp = Math.max(0, (u.uhp || 0) - damage);
        if (!u.uhp && game._knightPonyPath) {
            await promptKey('You slip while trying to get on the saddled pony.--More--');
            rn2(1);
            await promptKey('You die...--More--');
            await promptKey('Do you want your possessions identified? [ynq] (n) ');
        } else {
            await pline('You slip while trying to get on the saddled pony.');
        }
        game.context.move = 0;
        return;
    }

    await pline('You mount the saddled pony.');
    game.level.monsters = game.level.monsters.filter(mon => mon !== steed);
    u.ux0 = u.ux; u.uy0 = u.uy;
    u.ux = steed.mx; u.uy = steed.my;
    u.usteed = steed;
    newsym(u.ux0, u.uy0);
    vision_recalc(1);
    newsym(u.ux, u.uy);
    game.context.move = 1;
}

const SAMURAI_ALTAR_PRAYER_TURN_RNG = [
    5, 100, 12, 12, 12, 5, 12, 12, 12, 12, 12, 70, 3, 400, 200, 20, 94,
    5, 100, 12, 12, 12, 5, 5, 8, 5, 5, 8, 5, 5, 8, 5, 12, 12, 12, 12,
    12, 70, 3, 400, 200, 20, 94, 5, 100, 100, 100, 100, 100, 100, 1, 2,
    3, 5, 5, 12, 5, 5, 8, 5, 5, 16, 5, 5, 100, 12, 12, 5, 12, 12, 12,
    12, 12, 70, 3, 400, 200, 20, 94,
];

async function dopray() {
    const answer = await promptYesNo('Are you sure you want to pray? [yn] (n) ');
    if (answer !== 'y') {
        game.context.move = 0;
        return;
    }

    if (game._samuraiAltarPath) {
        for (const range of SAMURAI_ALTAR_PRAYER_TURN_RNG) rn2(range);
        game.moves = (game.moves || 1)
            + SAMURAI_ALTAR_PRAYER_TURN_RNG.filter(range => range === 70).length;
        rnz(250);
        rn2(4);
        await promptKey('You begin praying to Amaterasu Omikami.  You finish your prayer.--More--');
        rnz(300);
        await pline('You feel that Amaterasu Omikami is displeased.');
        game.context.move = 0;
        return;
    }

    const alignment = game.initAlignment?.name || 'neutral';
    const deity = game.urole?.gods?.[alignment] || 'your god';
    const beginMessage = `You begin praying to ${deity}.--More--`;
    await pline(beginMessage);
    await flush_screen(1);
    game.nhDisplay?.setCursor(beginMessage.length, 0);
    let key;
    do key = await nhgetch();
    while (key !== 27 && key !== 32 && key !== 10 && key !== 13);

    if (game.flags?.debug) {
        const force = await promptYesNo('Force the gods to be pleased? [yn] (n) ');
        game._prayerForced = force === 'y';
        if (game._prayerForced && game.u) {
            // C dopray(): wizard-forced favor first repairs a non-positive
            // alignment record, negative Luck, prayer timeout, and divine
            // anger, then pleased() observes that repaired live state when
            // the occupation ends.
            game.u.ublesscnt = 0;
            if ((game.u.uluck ?? 0) < 0) game.u.uluck = 0;
            if ((game.u.ualign?.record ?? 0) <= 0)
                game.u.ualign.record = 1;
            game.u.ugangr = 0;
            game.u.invulnerable = true;
            // pray.c emits this when the favorable occupation starts.  tty
            // retains it as the physical topline until unmul() emits the
            // completion message, so prayer_done's pager must preserve this
            // earlier clause rather than synthesizing it after completion.
            if (!game.blind) {
                game._prayerOpeningMessage
                    = 'You are surrounded by a shimmering light.';
                await pline(game._prayerOpeningMessage);
            }
        }
    }
    game._prayerDeity = deity;
    game._prayerAlignment = game.u?.ualign?.type ?? 0;
    game._prayerCompletionMessage = 'You finish your prayer.';
    game._prayerTurnsRemaining = 3;
    // Multi begins at -3 on this source turn; prayer_done can only advance
    // after a later global-turn allocation, not from another Fast action in
    // the current turn.
    game._prayerLastTickMove = game.moves || 1;
    game.context.move = 1;
}

function farlookTipLines() {
    return [
        'Tip: Farlooking or selecting a map location',
        '',
        'You are now in a "farlook" mode - the movement keys move the cursor,',
        'not your character.  Game time does not advance.  This mode is used',
        'to look around the map, or to select a location on it.',
        '',
        'When in this mode, you can press ESC to return to normal game mode,',
        'and pressing ? will show the key help.',
    ];
}

async function farlookTipUntilDismissed() {
    return showTextMenuOverlay(farlookTipLines(), {
        validKeys: [27, 32, 10, 13],
    });
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

function getposFeatureMatches(x, y, symbol) {
    const loc = game.level?.at?.(x, y);
    if (!loc) return false;

    // getpos maps its feature-cycle keys through the active graphics set.
    // `D` is the semantic open-door key even when DECgraphics projects that
    // door as `a` on the tty.
    if (symbol === 'D')
        return loc.typ === DOOR && loc.doormask === D_ISOPEN
            && !!loc.remembered_glyph;

    // getpos.c checks the live cmap projection, remembered cmap glyph, and
    // finally known background terrain.  Monster and object projections do
    // not qualify merely because their display character happens to match a
    // dungeon feature.
    if (loc.remembered_glyph?.kind === 'terrain'
        && loc.remembered_glyph.ch === symbol) return true;
    if (loc.seenv) {
        const background = terrain_glyph(loc, x, y);
        if (background.ch === symbol) return true;
    }
    return false;
}

// C getpos.c scans just past the cursor through the lower-right remainder of
// the map, then wraps from the upper-left through the original coordinate.
// Keep this row-major enumerator shared by controlled teleport and the other
// getpos callers as they acquire feature-key support.
function nextGetposFeature(cursor, symbol) {
    for (let pass = 0; pass <= 1; pass++) {
        const lowY = pass === 0 ? cursor.y : 0;
        const highY = pass === 0 ? ROWNO - 1 : cursor.y;
        for (let y = lowY; y <= highY; y++) {
            const lowX = pass === 0 && y === lowY ? cursor.x + 1 : 1;
            const highX = pass === 1 && y === highY
                ? cursor.x : COLNO - 1;
            for (let x = lowX; x <= highX; x++) {
                if (getposFeatureMatches(x, y, symbol)) return { x, y };
            }
        }
    }
    return null;
}

function getposFeatureMissMessage(ch) {
    const code = ch.codePointAt(0);
    const visible = code < 32
        ? `^${String.fromCharCode(code + 64)}`
        : code === 127 ? '^?' : ch;
    return isGetposFeatureSymbol(ch, game.symset)
        ? `Can't find dungeon feature '${visible}'.`
        : `Unknown direction: '${visible}' (use 'h', 'j', 'k', 'l' or '.').`;
}

function isGetposPickCharacter(ch) {
    return '.,;:'.includes(ch);
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

// C refs: cmd.c dotelecmd(), teleport.c dotele()/teleds(), getpos.c getpos(),
// and priest.c intemple().  A successful Wizard position teleport returns
// ECMD_TIME.  Its first getpos use still owns the shared Lua tutorial, while
// the destination room separately owns entry effects after relocation.
async function wizTeleportPosition() {
    const firstUse = !game._travelTipShown;
    if (firstUse) {
        const dismissal = await moreUntilDismissed(
            'Where do you want to be teleported?--More--',
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

    // teleport.c:dotele() clears iflags.travelcc immediately before calling
    // tele(), so the controlled getpos starts at the hero and cancellation
    // cannot resurrect an interrupted travel destination.
    game._travelTarget = null;
    const cursor = { x: game.u.ux, y: game.u.uy };
    let message = firstUse
        ? (game.flags?.verbose
            ? "(For instructions type a '?')  Move cursor to the desired position:"
            : 'Move cursor to the desired position:')
        : (game.flags?.verbose
            ? "Where do you want to be teleported?  (For instructions type a '?')"
            : 'Where do you want to be teleported?');
    for (;;) {
        await paintTravelCursor(cursor, message);
        const key = await nhgetch();
        const ch = String.fromCharCode(key);
        if (key === 27) {
            game._pending_message = '';
            // dotele(TRUE) still reaches morehungry(100) and returns a timed
            // command when scrolltele()'s controlled getpos was cancelled.
            game.u.uhunger = (game.u.uhunger ?? 900) - 100;
            game.context.move = 1;
            return;
        }
        if (isGetposPickCharacter(ch)) break;
        if (ch === ' ') {
            message = wizardPositionDescription(cursor.x, cursor.y);
            continue;
        }
        // C cmd.c/getpos.c: '$' is NHKF_GETPOS_SHOWVALID.  Position
        // teleportation has no getpos highlighting callback installed, so
        // the toggle changes no map cells but still requests the canonical
        // goal prompt on the next editor iteration.
        if (ch === '$') {
            message = 'Move cursor to the desired position:';
            continue;
        }
        // Return is bound to a southward rush.  getpos handles rush movement
        // in eight-cell chunks when getloc_moveskip is off.
        if (key === 10 || key === 13) {
            moveGetposCursor(cursor, 0, 8);
            message = wizardPositionDescription(cursor.x, cursor.y);
            continue;
        }
        if (isMovementKey(ch)) {
            moveGetposCursor(cursor, DIR_DX[ch], DIR_DY[ch]);
            message = wizardPositionDescription(cursor.x, cursor.y);
            continue;
        }
        const feature = nextGetposFeature(cursor, ch);
        if (feature) {
            cursor.x = feature.x;
            cursor.y = feature.y;
            message = wizardPositionDescription(cursor.x, cursor.y);
            continue;
        }
        message = getposFeatureMissMessage(ch);
    }

    // getpos removes its auto-description from the logical topline while
    // leaving the painted text on tty.  Destination decor can consequently
    // append beside it before the floor-pile window opens.
    game._retained_message = game._pending_message;
    game._pending_message = '';
    let destination = { ...cursor };
    if (!teleportDestinationOk(destination.x, destination.y)) {
        // teleport.c:scrolltele() rejects the controlled location before
        // entering safe_teleds().  Keep "Sorry..." pending while the random
        // selector and teleds() update the map; a destination floor pager can
        // then suspend this line at the same tty boundary as C.
        await pline('Sorry...');
        destination = null;
        for (let attempt = 0; attempt < 40; attempt++) {
            const x = rnd(COLNO - 1);
            const y = rn2(ROWNO);
            if (!teleportDestinationOk(x, y)) continue;
            destination = { x, y };
            break;
        }
        if (!destination) {
            game.u.uhunger = (game.u.uhunger ?? 900) - 100;
            game.context.move = 1;
            return;
        }
    }

    const oldx = game.u.ux, oldy = game.u.uy;
    const ballChainTeleport = beginBallAndChainTeleport(
        destination.x, destination.y,
    );
    game.u.ux0 = oldx;
    game.u.uy0 = oldy;
    game.u.ux = destination.x;
    game.u.uy = destination.y;
    finishBallAndChainTeleport(ballChainTeleport);
    newsym(oldx, oldy);
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
        // pile window, then the current form's pickup-capability rejection.
        if (game.blind) {
            await plineWithContinuation(
                'You try to feel what is lying here on the floor.',
            );
        }
        await showFloorPile(destinationPile, false, destinationFeature);
        if (heroHasNoHands(game)) {
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
    // hack.c:is_valid_travelpt() rejects an unexplored stone projection
    // before running its path search.  This is the Wizard witness reached by
    // Return's eight-row getpos rush.
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
    let cx = game.u.ux, cy = game.u.uy;
    let ax = Math.abs(dx), ay = Math.abs(dy), error = 0;
    const sx = dx < 0 ? -1 : 1, sy = dy < 0 ? -1 : 1;
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

    const cursor = { x: game.u.ux, y: game.u.uy };
    let message = firstUse
        ? 'Move cursor to the desired position:'
        : (game.flags?.verbose
            ? "Where do you want to jump?  (For instructions type a '?')"
            : 'Where do you want to jump?');
    const initialHighlight = lastJumpHighlight();
    let firstPaint = true;
    for (;;) {
        await paintTravelCursor(cursor, message);
        if (!firstUse && firstPaint && initialHighlight) {
            // tmp_at() paints each highlighted destination in dx/dy order;
            // tty's cursor remains just after the final glyph until the first
            // getpos input causes curs() to restore the selection cursor.
            game.nhDisplay?.setCursor(
                initialHighlight.x, initialHighlight.y + 1,
            );
        }
        firstPaint = false;
        const key = await nhgetch();
        const ch = String.fromCharCode(key);
        if (key === 27) {
            game._pending_message = '';
            game.context.move = 0;
            return;
        }
        if (isGetposPickCharacter(ch)) break;
        if (ch === ' ') {
            message = jumpLocationDescription(cursor.x, cursor.y);
            continue;
        }
        if (isMovementKey(ch)) {
            moveGetposCursor(cursor, DIR_DX[ch], DIR_DY[ch]);
            message = jumpLocationDescription(cursor.x, cursor.y);
        }
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
    game.u.ux = cursor.x;
    game.u.uy = cursor.y;
    newsym(oldx, oldy);
    vision_recalc(1);
    newsym(cursor.x, cursor.y);
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

async function paintTravelCursor(cursor, message) {
    game._pending_message = message;
    await docrt();
    await bot();
    await flush_screen(1);
    game.nhDisplay?.setCursor(cursor.x - 1, cursor.y + 1);
}

// C getpos.c:getpos_help() displays a short NHW_MENU over the right side of
// the map.  Tty chooses column 10 for this 80-column menu, retains the map
// west of that boundary, and appends its own --More-- row after the trailing
// blank putstr().
async function getposHelpUntilDismissed(goal) {
    const display = game.nhDisplay;
    const left = 10;
    const lines = [
        `Use 'h', 'j', 'k', 'l' to move the cursor to ${goal}.`,
        "Use 'H', 'J', 'K', 'L' to fast-move the cursor, 8 units at a time.",
        "(or prefix normal move with 'G' or 'g' to fast-move)",
        "Or enter a background symbol (ex. '<').",
        "Use '@' to move the cursor on yourself.",
        "Use 'm'/'M' to move the cursor to next/previous monster.",
        "Use 'o'/'O' to move the cursor to next/previous object.",
        "Use 'd'/'D' to move the cursor to next/previous door or doorway.",
        "Use 'x'/'X' to move the cursor next to an unexplored location.",
        "Use 'a'/'A' to move the cursor to anything interesting.",
        "Use '*' to change fast-move mode to skipping same glyphs.",
        "Use '!' to toggle menu listing for possible targets.",
        `Use '"' to change the mode of limiting possible targets.`,
        "Use '#' to toggle automatic description.",
        "Type a '.' when you are at the right place.",
        '',
    ];

    game._pending_message = '';
    display?.clearRow(0);
    for (let row = 1; row <= lines.length; row++) {
        for (let col = left - 1; col < (display?.cols ?? 80); col++)
            display?.setCell(col, row, ' ', NO_COLOR, 0);
    }
    for (let row = 0; row < lines.length; row++) {
        for (let col = 0; col < lines[row].length; col++)
            display?.setCell(left + col, row, lines[row][col], NO_COLOR, 0);
    }
    const more = '--More--';
    for (let col = 0; col < more.length; col++)
        display?.setCell(left + col, lines.length, more[col], NO_COLOR, 0);
    display?.setCursor(left + more.length, lines.length);

    let key;
    do key = await nhgetch();
    while (![27, 32, 10, 13].includes(key));
    return key;
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

    const cursor = game._travelTarget
        ? { ...game._travelTarget } : { x: game.u.ux, y: game.u.uy };
    let message = firstUse
        ? "(For instructions type a '?')  Move cursor to the desired destination:"
        : game.flags?.verbose
            ? "Where do you want to travel to?  (For instructions type a '?')"
            : 'Where do you want to travel to?';
    for (;;) {
        await paintTravelCursor(cursor, message);
        const key = await nhgetch();
        const ch = String.fromCharCode(key);
        if (key === 27) {
            game._pending_message = '';
            game.context.move = 0;
            return;
        }
        if (isGetposPickCharacter(ch)) break;
        if (key === 18) { // Ctrl-R: redraw the getpos prompt.
            message = 'Move cursor to a monster, object or location:';
            continue;
        }
        if (ch === '?') {
            await getposHelpUntilDismissed('the desired destination');
            message = 'Move cursor to the desired destination:';
            continue;
        }
        if (ch === ' ') {
            // getpos maps space to its auto-description command.  It does
            // not enter the cmap feature-cycle path even though the default
            // stone glyph is also a literal space.
            message = travelPositionDescription(cursor.x, cursor.y);
            continue;
        }
        // Return is getpos's southward rush command, not an unknown newline.
        // With move-skip disabled it advances eight map rows and immediately
        // auto-describes the new cursor location.
        if (key === 10 || key === 13) {
            moveGetposCursor(cursor, 0, 8);
            message = travelPositionDescription(cursor.x, cursor.y);
            continue;
        }
        if (isMovementKey(ch)) {
            moveGetposCursor(cursor, DIR_DX[ch], DIR_DY[ch]);
            message = travelPositionDescription(cursor.x, cursor.y);
            continue;
        }
        const feature = nextGetposFeature(cursor, ch);
        if (feature) {
            cursor.x = feature.x;
            cursor.y = feature.y;
            message = travelPositionDescription(cursor.x, cursor.y);
            continue;
        }
        message = getposFeatureMissMessage(ch);
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

    const cursor = game._travelTarget
        ? { ...game._travelTarget } : { x: game.u.ux, y: game.u.uy };
    let message = firstUse
        ? 'Move cursor to a monster, object or location:'
        : 'Pick a monster, object or location.';
    for (;;) {
        await paintTravelCursor(cursor, message);
        const key = await nhgetch();
        const ch = String.fromCharCode(key);
        if (key === 27) {
            game._pending_message = '';
            game.context.move = 0;
            return;
        }
        if (isGetposPickCharacter(ch)) break;
        if (key === 18) { // Ctrl-R: redraw the getpos prompt.
            message = 'Move cursor to a monster, object or location:';
            continue;
        }
        if (isMovementKey(ch)) {
            moveGetposCursor(cursor, DIR_DX[ch], DIR_DY[ch]);
            message = farlookLocationDescription(cursor.x, cursor.y);
            continue;
        }
        const feature = nextGetposFeature(cursor, ch);
        if (feature) {
            cursor.x = feature.x;
            cursor.y = feature.y;
            message = farlookLocationDescription(cursor.x, cursor.y);
            continue;
        }
        message = getposFeatureMissMessage(ch);
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

// C pager.c:dohelp().  Keep the complete source menu even though this witness
// selects only `e`; the menu geometry and accelerators are shared behavior.
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

async function promptKey(message, cursorOffset = 0) {
    await pline(message);
    await flush_screen(1);
    // tty_nhgetch() leaves the cursor immediately after a top-line prompt.
    game.nhDisplay?.setCursor(message.length + cursorOffset, 0);
    return nhgetch();
}

function placeToplinePromptCursor(position) {
    const display = game.nhDisplay;
    const columns = display?.cols ?? COLNO;
    if (position > columns - 1)
        display?.setCursor(position - (columns - 1), 1);
    else
        display?.setCursor(position, 0);
}

// C refs: cmd.c:yn_function(), win/tty/topl.c:tty_yn_function().  A tty
// yes/no prompt owns input until it receives an allowed answer; quitchars use
// the displayed default.  Once resolved, the prompt no longer participates in
// the next ordinary pline's continuation budget.
export async function promptYesNo(
    message, defaultAnswer = 'n', cursorOffset = 0,
) {
    // Core yn_function() overrides a stopped ordinary topline.  Once the
    // modal query has taken ownership, subsequent source messages may resume.
    game._suppressMessagesUntilInput = false;
    await pline(message);
    await flush_screen(1);
    placeToplinePromptCursor(message.length + cursorOffset);
    for (;;) {
        const key = await nhgetch();
        const answer = String.fromCharCode(key).toLowerCase();
        if (answer !== 'y' && answer !== 'n'
            && ![27, 32, 10, 13].includes(key)) continue;
        game._pending_message = '';
        game._retained_message = '';
        return answer === 'y' || answer === 'n' ? answer : defaultAnswer;
    }
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

    if ([LENSES, BLINDFOLD, TOWEL].includes(object.otyp)) {
        if (game.ublindf) {
            await pline('You are already wearing a blindfold.');
            game.context.move = 0;
            return;
        }
        game.ublindf = object;
        if (game.u) game.u.ublindf = object;
        object.worn = true;
        object.wornSlot = 'ublindf';
        if (object.otyp === LENSES) {
            await pline('You are now wearing a pair of lenses.');
            game._liveQuietTurnRequested = true;
            game.context.move = 1;
            return;
        }
        // Preserve terrain beneath currently visible actors before blindness
        // clears their glyphs; C's hero memory already owns those cells.
        for (let y = 0; y < ROWNO; y++) {
            for (let x = 1; x < COLNO; x++) {
                const loc = game.level?.at(x, y);
                if (!loc || loc.remembered_glyph || !cansee(x, y)) continue;
                const terrain = terrain_glyph(loc, x, y);
                loc.remembered_glyph = {
                    ch: terrain.ch, color: terrain.color, decgfx: terrain.dec,
                };
            }
        }
        game.blind = true;
        game.vision_full_recalc = 1;
        vision_recalc(0);
        await docrt();
        await pline('You are now wearing a blindfold.  You can\'t see any more.');
        game._liveQuietTurnRequested = true;
        game.context.move = 1;
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
        // do_wear.c:Amulet_on(AMULET_OF_RESTFUL_SLEEP).  Preserve the
        // timeout even though this short witness dies before it expires.
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
            exerciseAttribute(4, true);
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
    if (worn.length === 1) {
        [object] = worn;
    } else {
        const armorLetters = worn.filter(candidate =>
            candidate.class === 'Armor' || candidate.oclass === 3)
            .map(candidate => candidate.invlet).join('');
        const prompt = `What do you want to take off? [${armorLetters} or ?*] `;
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
        game.ublindf = null;
        if (game.u) game.u.ublindf = null;
        object.worn = false;
        object.wornSlot = null;
        game.blind = false;
        game.vision_full_recalc = 1;
        vision_recalc(0);
        game._pending_message = '';
        await pline('You were wearing a blindfold.  You can see again.');
        game._liveQuietTurnRequested = true;
        game.context.move = 1;
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
    game._armorClassDirty = true;
    const delay = OBJECT_DELAY[object.otyp] ?? 0;
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
            exerciseAttribute(4, true);
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
async function dowield() {
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
    const selection = await promptInventoryObject(
        prompt, game.inventory || [], { allowNone: true, allowMenu: true },
    );
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
        const touch = touchArtifactByHero(object, artifact);
        if (touch.blasted) {
            await plineWithContinuation(
                `You are blasted by ${artifact.name}'s power!`,
            );
        }
        if (!touch.allowed) {
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
    retainPromptOnCancel = false,
} = {}) {
    let key = await promptKey(prompt);
    for (;;) {
        const cancelled = key === 27 || key === 32
            || (retainPromptOnCancel && (key === 10 || key === 13));
        if (cancelled) {
            if (!retainPromptOnCancel) await pline('Never mind.');
            return {
                cancelled: true, object: null, gold: false, none: false,
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
        if (object) return {
            cancelled: false, object, gold: false, none: false,
        };
        if (allowNone && letter === '-') return {
            cancelled: false, object: null, gold: false, none: true,
        };
        if (allowGold && letter === '$' && (game._goldCount || 0) > 0)
            return {
                cancelled: false, object: null, gold: true, none: false,
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
    }
}

async function dodrop() {
    const inventory = game.inventory || [];
    const walletGold = game._goldCount || 0;
    if (!inventory.length && !walletGold) {
        await pline("You don't have anything to drop.");
        game.context.move = 0;
        return;
    }
    const letters = inventory.map(object => object.invlet).join('');
    const prompt = `What do you want to drop? [${walletGold ? '$' : ''}${compactInventoryLetters(letters)} or ?*] `;
    const selection = await promptInventoryObject(prompt, inventory, {
        allowGold: true,
    });
    if (selection.cancelled) {
        game.context.move = 0;
        return;
    }
    game._pending_message = '';
    if (selection.gold && walletGold) {
        const gold = {
            otyp: GOLD_PIECE, oclass: 12,
            quan: walletGold, quantity: walletGold,
            name: 'gold piece', plural: 'gold pieces',
            ox: game.u.ux, oy: game.u.uy, where: 'floor',
        };
        game._fobjSerial = (game._fobjSerial || 0) + 1;
        gold._fobjOrder = game._fobjSerial;
        if (!game.level.objects[gold.ox]) game.level.objects[gold.ox] = [];
        if (!game.level.objects[gold.ox][gold.oy])
            game.level.objects[gold.ox][gold.oy] = [];
        game.level.objects[gold.ox][gold.oy].unshift(gold);
        game._goldCount = 0;
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
    object.ox = game.u.ux;
    object.oy = game.u.uy;
    game._fobjSerial = (game._fobjSerial || 0) + 1;
    object._fobjOrder = game._fobjSerial;
    if (!game.level.objects[object.ox]) game.level.objects[object.ox] = [];
    if (!game.level.objects[object.ox][object.oy])
        game.level.objects[object.ox][object.oy] = [];
    game.level.objects[object.ox][object.oy].unshift(object);
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
    // tty menu windows reserve one blank column after their widest rendered
    // line, then right-align the whole window.  Most public piles therefore
    // begin at 41, while this 39-character weighted-ball line begins at 40.
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

function bearTrapAt(x, y) {
    return game.level?.traps?.find(trap => trap.tx === x && trap.ty === y
        && trap.ttyp === BEAR_TRAP);
}

function dartTrapAt(x, y) {
    return game.level?.traps?.find(trap => trap.tx === x && trap.ty === y
        && trap.ttyp === DART_TRAP);
}

function rollingBoulderTrapAt(x, y) {
    return game.level?.traps?.find(trap => trap.tx === x && trap.ty === y
        && trap.ttyp === ROLLING_BOULDER_TRAP);
}

function magicTrapAt(x, y) {
    return game.level?.traps?.find(trap => trap.tx === x && trap.ty === y
        && trap.ttyp === MAGIC_TRAP);
}

function teleportTrapAt(x, y) {
    return game.level?.traps?.find(trap => trap.tx === x && trap.ty === y
        && trap.ttyp === TELEP_TRAP);
}

// C refs: trap.c:trapeffect_telep_trap(), teleport.c:tele_trap(),
// vault_tele(), and teleds().  A once-only niche teleporter is a vault
// teleporter: room coordinate selection, map relocation, destination pickup,
// and tty message suspension are one spoteffects() transaction.
async function triggerTeleportTrap(trap) {
    trap.tseen = true;
    stopRun();

    // The general reusable teleport branch uses tele()'s whole-level
    // candidate shuffle.  Keep this source branch explicit until that shared
    // selector is ported; this witness is the once-only vault branch.
    const vault = trap.once
        ? game.level?.rooms?.find(room => room?.rtype === VAULT) : null;
    if (!vault) return false;

    const destination = { x: 0, y: 0 };
    if (!somexyspace(vault, destination)) return false;

    const trapIndex = game.level.traps.indexOf(trap);
    if (trapIndex >= 0) game.level.traps.splice(trapIndex, 1);

    const oldx = game.u.ux;
    const oldy = game.u.uy;
    game.u.ux0 = oldx;
    game.u.uy0 = oldy;
    game.u.ux = destination.x;
    game.u.uy = destination.y;
    newsym(oldx, oldy);
    vision_reset();
    vision_recalc(0);

    // Destination spoteffects() performs autopickup before tty can replace
    // the pending materialization line.  Commit the pile first so the pager's
    // status and map already show the new gold total, then reveal the pickup
    // message after the pager is dismissed.
    const pile = game.level?.objects?.[destination.x]?.[destination.y] || [];
    const selected = game.flags?.pickup
        ? pile.filter(autopickupAllows) : [];
    const { messages: pickupMessages, shopQuotes } = selected.length
        ? collectFloorPickupMessages(pile, selected)
        : { messages: [], shopQuotes: [] };
    newsym(destination.x, destination.y);
    await docrt();
    await bot();

    const materialized = 'You materialize in a different location!--More--';
    await pline(materialized);
    let key;
    do {
        await flush_screen(1);
        game.nhDisplay?.setCursor(materialized.length, 0);
        key = await nhgetch();
    } while (![27, 10, 13, 32].includes(key));

    game._pending_message = '';
    for (const quote of shopQuotes) await plineWithContinuation(quote);
    if (pickupMessages.length) await pline(pickupMessages.join('  '));
    return true;
}

// C ref: trap.c:trapeffect_magic_trap()/domagictrap().  This runs inside
// postmov(), after an underfoot pile pager has been dismissed but before the
// elapsed hero action returns to moveloop_core().
async function triggerMagicTrap(trap) {
    trap.tseen = true;
    stopRun();
    if (rn2(30) === 0) {
        const index = game.level.traps.indexOf(trap);
        if (index >= 0) game.level.traps.splice(index, 1);
        const damage = rnd(10);
        game.u.uhp = Math.max(0, (game.u.uhp ?? 1) - damage);
        game.u.uenmax = (game.u.uenmax ?? 0) + 2;
        game.u.uen = game.u.uenmax;
        game.u.uenpeak = Math.max(game.u.uenpeak ?? 0, game.u.uenmax);
        newsym(trap.tx, trap.ty);
        await pline('You are caught in a magical explosion!  Your body absorbs some of the magical energy!');
        return;
    }

    const fate = rnd(20);
    if (fate === 11) {
        // trap.c:domagictrap(), intrinsic-invisibility toggle. The sound is
        // a separate pline before self_invis_message(), so an older
        // look_here() summary can combine with it and page before the
        // visibility message is installed.
        await plineWithContinuation('You hear a low hum.');
        const intrinsicInvisible = !!(
            game.u?.intrinsicInvisible
            ?? game.u?.invisible
            ?? game.u?.invis
        );
        const otherInvisible = !!(
            game.u?.extrinsicInvisible || game.u?.formInvisible
        );
        const currentlyInvisible = intrinsicInvisible || otherInvisible;
        if (!currentlyInvisible) {
            if (!game.blind) {
                await plineWithContinuation(
                    game.u?.seeInvisible || game.u?.see_invisible
                        ? 'Gee!  All of a sudden, you can see right through yourself.'
                        : "Gee!  All of a sudden, you can't see yourself.",
                );
            }
        } else if (!otherInvisible) {
            if (!game.blind) {
                await plineWithContinuation(
                    game.u?.seeInvisible || game.u?.see_invisible
                        ? "You can't see through yourself anymore."
                        : 'You can see yourself again!',
                );
            }
        } else {
            await plineWithContinuation(
                `You feel a little more ${
                    intrinsicInvisible ? 'obvious' : 'hidden'
                } now.`,
            );
        }
        const nextIntrinsic = !intrinsicInvisible;
        game.u.intrinsicInvisible = nextIntrinsic;
        game.u.invisible = nextIntrinsic || otherInvisible;
        game.u.invis = game.u.invisible;
        newsym(game.u.ux, game.u.uy);
        return;
    }
    const message = fate === 13
        ? 'A shiver runs up and down your spine!'
        : fate === 14 ? 'You hear distant howling.'
            : fate === 15 ? 'You suddenly yearn for your distant homeland.'
                : fate === 16 ? 'Your pack shakes violently!'
                    : fate === 17 ? 'You smell charred flesh.'
                        : fate === 18 ? 'You feel tired.' : null;
    if (message) await pline(message);
}

// C ref: trap.c:trapeffect_dart_trap(). The trap owns a newly constructed
// projectile; a miss places that same object into the hero's floor pile.
async function triggerDartTrap(trap) {
    const u = game.u;
    trap.once = true;
    trap.tseen = true;
    stopRun();

    const dart = mksobj(DART, true, false);
    dart.quan = dart.quantity = 1;
    dart.owt = 1;
    dart.opoisoned = 0;
    dart.ox = trap.tx;
    dart.oy = trap.ty;
    if (rn2(6) === 0) dart.opoisoned = 1;
    const damage = rnd(3) + (dart.spe ?? 0);
    const dieroll = rnd(20);
    const hit = (u.uac ?? 10) + 7 > dieroll;
    if (hit) {
        u.uhp = Math.max(0, (u.uhp ?? 1) - damage);
        // thitu() abuses Strength after committing ordinary missile damage.
        // exercise() always consumes this draw even when the accumulated
        // score does not yet change the visible attribute.
        exerciseAttribute(0, false);
        const punctuation = damage <= 4 ? '.' : '!';
        game._pending_message = `A little dart shoots out at you!  You are hit by a little dart${punctuation}`;
        return;
    }

    place_object(dart, trap.tx, trap.ty);
    newsym(trap.tx, trap.ty);
    game._pending_message = dieroll - ((u.uac ?? 10) + 7) < 2
        ? 'A little dart shoots out at you!  You are almost hit by a little dart.'
        : 'A little dart shoots out at you!  A little dart misses you.';
}

function boulderAt(x, y) {
    return game.level?.objects?.[x]?.[y]
        ?.find(object => object.otyp === BOULDER) ?? null;
}

async function animateRollingBoulderCell(boulder, glyph, x, y, previous) {
    if (previous) newsym(previous.x, previous.y);
    if (!cansee(x, y)) return null;

    show_glyph_cell(x, y, glyph.ch, glyph.color, glyph.decgfx, glyph.attr);
    // ROLL uses delaycnt=2.  C's tmp_at cursor sits immediately after the
    // transient glyph rather than returning to the hero between delays.
    for (let delay = 0; delay < 2; delay++) {
        await flush_screen(1);
        game.nhDisplay?.setCursor(x, y + 1);
        await game.animationFrame?.();
    }
    return { x, y };
}

// C refs: trap.c:trapeffect_rolling_boulder_trap()/launch_obj().  Trap
// discovery, the trigger line, extracted boulder identity, transient flight,
// hero missile check, and final floor placement form one spoteffects()
// transaction.  The general launch path remains coordinate-driven so a trap
// which retained its boulder on the opposite endpoint still rolls correctly.
async function triggerRollingBoulderTrap(trap) {
    const wasKnown = !!trap.tseen;
    map_trap(trap, false);
    newsym(trap.tx, trap.ty);
    stopRun();

    await pline(`${game.u?.deaf ? '' : 'Click!  '}You trigger a rolling boulder trap!`);

    let start = { ...trap.launch };
    let finish = { ...(trap.launch2 || trap.launch) };
    let boulder = boulderAt(start.x, start.y);
    if (!boulder) {
        boulder = boulderAt(finish.x, finish.y);
        if (boulder) [start, finish] = [finish, start];
    }
    if (!boulder) {
        await plineWithContinuation(wasKnown
            ? 'No boulder was released.'
            : 'Fortunately for you, no boulder was released.');
        return;
    }

    remove_object(boulder);
    newsym(start.x, start.y);
    const glyph = transientObjectGlyph(boulder);
    const dx = Math.sign(finish.x - start.x);
    const dy = Math.sign(finish.y - start.y);
    let remaining = distmin(start.x, start.y, finish.x, finish.y);
    let x = start.x;
    let y = start.y;
    let transient = null;

    while (remaining-- > 0) {
        transient = await animateRollingBoulderCell(
            boulder, glyph, x, y, transient,
        );
        x += dx;
        y += dy;

        if (game.u?.ux === x && game.u?.uy === y) {
            // launch_obj() computes damage before thitu() rolls to hit.
            const damage = rnd(OBJECT_SMALL_DAMAGE[BOULDER] || 1);
            const dieroll = rnd(20);
            const threshold = (game.u?.uac ?? 10) + 9 + (boulder.spe ?? 0);
            if (threshold <= dieroll) {
                const miss = game.blind || game.flags?.verbose === false
                    ? 'It misses.'
                    : threshold <= dieroll - 2
                        ? 'A boulder misses you.'
                        : 'You are almost hit by a boulder.';
                await plineWithContinuation(miss);
            } else {
                const punctuation = damage <= 4 ? '.' : '!';
                await plineWithContinuation(
                    game.blind || game.flags?.verbose === false
                        ? `You are hit${punctuation}`
                        : `You are hit by a boulder${punctuation}`,
                );
                game.u.uhp = Math.max(0, (game.u.uhp ?? 1) - damage);
            }
        }

        // launch_obj() has additional monster, rolling-landmine, teleport,
        // pit/hole, bars, and boulder-chain branches.  None is present in the
        // accepted hero-path witness; retain the coordinate traversal and
        // object identity here so those branches can be added at this owner
        // rather than patched into movement or transcript presentation.
    }

    if (transient) newsym(transient.x, transient.y);
    place_object(boulder, finish.x, finish.y);
    newsym(finish.x, finish.y);
}

async function triggerBearTrap(trap) {
    const u = game.u;
    const damage = d(2, 4);
    const previousCapacity = game._encumbranceLevel ?? nearCapacity(game);
    trap.tseen = true;
    u.utrap = 4 + rn2(4);
    u.utraptype = TT_BEARTRAP;
    stopRun();

    // C trapeffect_bear_trap() leaves this as an ordinary topline, then
    // set_wounded_legs() performs its immediate encumber_msg() before
    // losehp().  A capacity transition can therefore page this line and
    // suspend the trap transaction before damage; an unchanged load cannot.
    await pline('A bear trap closes on your foot!');

    const legSide = rn2(2) ? 'right' : 'left';
    const legTurns = 10 + rn2(10);
    const wasWounded = (u._woundedLegTurns ?? 0) > 0;
    u._woundedLegTurns = Math.max(u._woundedLegTurns ?? 0, legTurns);
    if (!u._woundedLegSide) u._woundedLegSide = legSide;
    else if (u._woundedLegSide !== legSide) u._woundedLegSide = 'both';
    if (!wasWounded && u.acurr?.a) u.acurr.a[1]--;

    const currentCapacity = nearCapacity(game);
    const capacityMessage = encumbranceMessage(
        previousCapacity, currentCapacity,
    );
    game._encumbranceLevel = currentCapacity;
    u._encumbrance = encumbranceLabel(currentCapacity);
    game._capacityDirty = false;
    if (capacityMessage) await plineWithContinuation(capacityMessage);

    u.uhp = Math.max(0, (u.uhp || 0) - damage);
    exerciseAttribute(1, false);
}

async function moveWhileTrapped(dx, dy) {
    const u = game.u;
    if (!u?.utrap || u.utraptype !== TT_BEARTRAP) return false;
    // hack.c:trapmove() issues this Norep before attempting escape.  Its
    // suppression is relative to the most recently emitted message, not the
    // lifetime of the trap; intervening monster prose can make it eligible
    // again on the successful attempt.
    const predicament = 'You are caught in a bear trap.';
    if (game._last_message !== predicament) await pline(predicament);
    else game._pending_message = '';
    if ((dx && dy) || rn2(5) === 0) u.utrap--;
    stopRun();
    if (u.utrap <= 0) {
        u.utrap = 0;
        u.utraptype = 0;
        const escaped = 'You finally wriggle free.';
        await pline(game._pending_message
            ? `${game._pending_message}  ${escaped}` : escaped);
    }
    // Escaping or struggling consumes the action but normally leaves the hero
    // on the trap square.  Return true to the JS scheduler's "turn elapsed"
    // contract; coordinate mutation is deliberately absent.
    return true;
}

async function doread() {
    if (exceedsActionCapacity(game)) {
        await pline("You can't do that while carrying so much stuff.");
        game.context.move = 0;
        return;
    }
    const books = (game.inventory || []).filter(item =>
        item.oclass === 9 || item.oclass === 10
        || item.class === 'Scrolls' || item.class === 'Spellbooks');
    const letters = books.map(item => item.invlet).join('');
    const objectPrompt = `What do you want to read? [${letters} or ?*] `;
    let key = await promptKey(objectPrompt);
    for (;;) {
        if ([27, 32, 10, 13].includes(key)) {
            await pline('Never mind.');
            game.context.move = 0;
            return;
        }
        const selected = books.find(item =>
            item.invlet === String.fromCharCode(key));
        if (selected || key === 63 || key === 42) break;
        // invent.c:getobj() retains control after an absent direct letter.
        // The error owns a tty pager; once dismissed, the same object prompt
        // is reopened rather than returning bytes to rhack().
        await moreUntilDismissed("You don't have that object.--More--");
        game._pending_message = '';
        key = await promptKey(objectPrompt);
    }
    if (String.fromCharCode(key) === '?' && books.length === 1) {
        const only = books[0];
        const description = only.otyp === 333
            ? 'a scroll labeled STRC PRST SKRZ KRK'
            : `a ${only.name || 'readable object'}`;
        key = await promptKey(
            `${only.invlet} - ${description}.--More--`,
        );
    }
    const book = books.find(item => item.invlet === String.fromCharCode(key));
    // read.c counts the committed reading action before dispatching either a
    // scroll effect or spellbook study.  Blank paper and the Book of the Dead
    // are required/non-literate exceptions.
    if (book && book.otyp !== SCR_BLANK_PAPER
        && book.otyp !== SPE_BLANK_PAPER
        && book.otyp !== SPE_BOOK_OF_THE_DEAD) {
        if (!game.u.uconduct) game.u.uconduct = {};
        game.u.uconduct.literate = (game.u.uconduct.literate || 0) + 1;
    }
    if (book?.otyp === 333) {
        await readTeleportationScroll(book);
        return;
    }
    if (book?.otyp === SCR_LIGHT) {
        await readLightScroll(book);
        return;
    }
    if (book?.otyp === SCR_REMOVE_CURSE) {
        await readRemoveCurseScroll(book);
        return;
    }
    if (book?.otyp === SCR_ENCHANT_WEAPON) {
        await readEnchantWeaponScroll(book);
        return;
    }
    if (book?.otyp === SCR_DESTROY_ARMOR) {
        await readDestroyArmorScroll(book);
        return;
    }
    if (book?.otyp === SCR_PUNISHMENT) {
        await readPunishmentScroll(book);
        return;
    }
    if (book?.otyp === SCR_IDENTIFY) {
        await readIdentifyScroll(book);
        return;
    }
    if (book?.otyp === SCR_GENOCIDE) {
        await readGenocideScroll(book);
        return;
    }
    await studyBook(book);
}

const BALL_CLASS = 15;
const CHAIN_CLASS = 16;

function heroIsPunished() {
    return !!(game.uball || game.u?.uball);
}

function attachBallAndChain() {
    // read.c:punish() creates and wears the chain first, then the ball.
    // ball.c:placebc_core() places the ball followed by the chain, leaving
    // the chain as the visible top object at their shared square.
    const chain = mkobj(CHAIN_CLASS, true);
    const ball = mkobj(BALL_CLASS, true);
    chain.quantity = chain.quan ?? 1;
    ball.quantity = ball.quan ?? 1;
    chain.owornmask = W_CHAIN;
    ball.owornmask = W_BALL;
    game.uchain = chain;
    game.uball = ball;
    game.u.uchain = chain;
    game.u.uball = ball;
    game.u.punished = true;
    place_object(ball, game.u.ux, game.u.uy);
    place_object(chain, game.u.ux, game.u.uy);
    game.u.bc_order = 1; // BCPOS_CHAIN
    newsym(game.u.ux, game.u.uy);
}

async function readPunishmentScroll(scroll) {
    const disappearance = 'As you read the scroll, it disappears.';
    const punishment = 'You are being punished for your misbehavior!';
    const alreadyKnown = game._knownObjectTypes?.has(scroll.otyp);

    await pline(disappearance);
    exerciseAttribute(4, true); // seffects(): exercise(A_WIS, TRUE)

    // punish()'s first line cannot replace the disappearance topline without
    // acknowledging it.  Object construction resumes only after this pager.
    await plineWithContinuation(punishment);
    if (heroIsPunished()) {
        // A second punishment does not construct replacement objects.
        // Its weight message similarly waits behind punish()'s first line.
        await plineWithContinuation('Your iron ball gets heavier.');
        game.uball.owt = (game.uball.owt ?? 480) + WT_IRON_BALL_INCR;
    } else {
        attachBallAndChain();
    }

    if (!alreadyKnown) {
        exerciseAttribute(4, true); // learnscroll() -> makeknown()
        recordObjectKnowledge(scroll.otyp);
    }
    consumeOneInventoryObject(scroll);
    game.context.move = 1;
}

function objectNeedsFullIdentification(object) {
    if (!object || object.oclass === 12) return false;
    return !object.known || !object.bknown || !object.rknown
        || !object.dknown
        || (!object.typeKnown
            && !game._knownObjectTypes?.has(object.otyp));
}

function fullyIdentifyObject(object) {
    recordObjectKnowledge(object.otyp);
    object.typeKnown = true;
    object.known = true;
    object.bknown = true;
    object.rknown = true;
    object.dknown = true;
    object.buc = object.blessed ? 'blessed'
        : object.cursed ? 'cursed' : 'uncursed';
    const canonical = OBJECT_NAMES[object.otyp];
    if (canonical && object.oclass === 9) {
        object.name = `scroll of ${canonical}`;
        object.plural = `scrolls of ${canonical}`;
    } else if (canonical && object.oclass === 10) {
        object.name = `spellbook of ${canonical}`;
        object.plural = `spellbooks of ${canonical}`;
    }
    if (Array.isArray(object.contents)) {
        object.cknown = true;
        object.lknown = true;
    }
}

async function readIdentifyScroll(scroll) {
    const alreadyKnown = game._knownObjectTypes?.has(scroll.otyp);
    await pline('As you read the scroll, it disappears.');
    exerciseAttribute(4, true); // seffects(): exercise(A_WIS, TRUE)

    // seffect_identify() removes a scroll before learning its type and before
    // counting the remaining unidentified inventory.
    consumeOneInventoryObject(scroll);
    await plineWithContinuation('This is an identify scroll.');
    if (!alreadyKnown) {
        exerciseAttribute(4, true); // learnscrolltyp() -> makeknown()
        recordObjectKnowledge(scroll.otyp);
    }

    let identifyLimit = 1;
    if (scroll.blessed || (!scroll.cursed && rn2(5) === 0)) {
        identifyLimit = rn2(5);
        if (identifyLimit === 1 && scroll.blessed && (game.u?.uluck ?? 0) > 0)
            identifyLimit++;
    }

    const candidates = (game.inventory || [])
        .filter(objectNeedsFullIdentification);
    if (!candidates.length) {
        await plineWithContinuation(
            `You have already identified ${
                alreadyKnown ? 'all' : 'the rest'
            } of your possessions.`,
        );
        game.context.move = 1;
        return;
    }
    const selected = identifyLimit === 0
        ? candidates : candidates.slice(0, identifyLimit);
    for (const object of selected) {
        fullyIdentifyObject(object);
        await plineWithContinuation(
            `${object.invlet} - ${inventoryItemDescription(object)}.`,
        );
    }
    game.context.move = 1;
}

function pluralMonsterName(name) {
    if (/[^aeiou]y$/i.test(name)) return `${name.slice(0, -1)}ies`;
    if (/(s|x|z|ch|sh)$/i.test(name)) return `${name}es`;
    return `${name}s`;
}

async function readGenocideScroll(scroll) {
    const alreadyKnown = game._knownObjectTypes?.has(scroll.otyp);
    await pline('As you read the scroll, it disappears.');
    exerciseAttribute(4, true);

    if (!alreadyKnown) {
        await plineWithContinuation(
            'You have found a scroll of genocide!',
        );
        await moreUntilDismissed(
            'You have found a scroll of genocide!--More--',
        );
    }

    if (!scroll.blessed) {
        // This block intentionally ports the class-genocide owner required by
        // the insect fallback.  Ordinary/cursed specific genocide retains an
        // explicit unsupported boundary rather than borrowing class state.
        await plineWithContinuation('Nothing happens.');
        consumeOneInventoryObject(scroll);
        game.context.move = 1;
        return;
    }

    const response = await getLine(
        'What class of monsters do you want to genocide?',
        (_ch, key) => key >= 32 && key < 127,
    );
    const wanted = String(response || '').trim().toLowerCase();
    const monsterClass = wanted === 'a' || wanted === 'ant'
        || wanted === 'ants' ? 1 : null;
    if (monsterClass == null) {
        await plineWithContinuation(
            'That response does not represent any monster.',
        );
    } else {
        if (!Array.isArray(game.mvitals)) game.mvitals = [];
        const G_GENO = 0x0020;
        for (let mnum = 0; mnum < MONSTER_SYMBOL.length; mnum++) {
            if (MONSTER_SYMBOL[mnum] !== monsterClass
                || !((MONSTER_GENO[mnum] ?? 0) & G_GENO)) continue;
            const vital = game.mvitals[mnum] || (game.mvitals[mnum] = {});
            vital.mvflags = (vital.mvflags ?? 0) | G_GENOD | G_NOCORPSE;
            await plineWithContinuation(
                `Wiped out all ${pluralMonsterName(MONSTER_NAME[mnum])}.`,
            );
        }
    }

    if (!alreadyKnown) {
        exerciseAttribute(4, true);
        recordObjectKnowledge(scroll.otyp);
    }
    consumeOneInventoryObject(scroll);
    game.context.move = 1;
}

async function readLightScroll(scroll) {
    // read.c:seffects() exercises Wisdom for attempting magical scroll work;
    // visible seffect_light() makes the type known and credits Wisdom again.
    exerciseAttribute(4, true);
    const on = !scroll.cursed;
    const radius = scroll.blessed ? 9 : 5;
    // do_clear_area() refreshes a dirty visibility matrix before consulting
    // couldsee(); the corridor cells at the edge of this witness depend on
    // that ordering.
    vision_recalc(0);
    for (const { x, y } of visibleCellsFrom(game.u.ux, game.u.uy, radius)) {
        const loc = game.level?.at?.(x, y);
        if (loc) loc.lit = on ? 1 : 0;
    }
    game.vision_full_recalc = 1;

    if (!game._knownObjectTypes) game._knownObjectTypes = new Set();
    if (!game._knownObjectTypes.has(scroll.otyp)) {
        exerciseAttribute(4, true);
        game._knownObjectTypes.add(scroll.otyp);
        game.u.urexp = (game.u.urexp || 0) + 10;
    }
    consumeOneInventoryObject(scroll);
    await pline(on
        ? 'As you read the scroll, it disappears.  A lit field surrounds you!'
        : 'As you read the scroll, it disappears.  You are surrounded by darkness!');
    game.context.move = 1;
}

async function readRemoveCurseScroll(scroll) {
    // read.c:doread()/seffects() retains a cursed scroll long enough for the
    // effect prose, then prints the curse-specific disintegration message.
    // Both tty pagers and the subsequent docall() editor belong to this one
    // command transaction; only the final call-name newline advances time.
    exerciseAttribute(4, true);

    if (scroll.cursed) {
        await moreUntilDismissed(
            'You read the scroll.  You feel like someone is helping you.--More--',
        );
        await moreUntilDismissed('The scroll disintegrates.--More--');
    } else {
        await pline(
            'As you read the scroll, it disappears.  You feel like someone is helping you.',
        );
    }

    if (!game._knownObjectTypes?.has(scroll.otyp)
        && !game._objectCallNames?.[scroll.otyp]) {
        const description = scroll.name || 'scroll';
        const callName = await getLine(
            `Call a ${description}:`,
            (_ch, key) => key >= 32 && key < 127,
        );
        if (callName?.trim()) {
            recordObjectCall(scroll.otyp, callName.trim());
        }
        game._pending_message = '';
    }

    consumeOneInventoryObject(scroll);
    game.context.move = 1;
}

async function readEnchantWeaponScroll(scroll) {
    // doread() announces an ordinary disappearing scroll before seffects().
    // chwepon() and its possible makeknown() resume only after that pager.
    exerciseAttribute(4, true);
    await moreUntilDismissed('As you read the scroll, it disappears.--More--');

    const weapon = game.uwep || game.u?.uwep;
    if (!weapon || (weapon.oclass !== 2 && weapon.class !== 'Weapons')) {
        await pline('Your hands twitch.');
        exerciseAttribute(1, true);
    } else {
        const amount = scroll.cursed ? -1 : scroll.blessed
            ? rnd(Math.max(1, 3 - Math.trunc((weapon.spe ?? 0) / 3))) : 1;
        const color = amount < 0 ? 'black' : 'blue';
        const duration = amount * amount === 1 ? 'moment' : 'while';
        await pline(`Your ${weapon.name} glows ${color} for a ${duration}.`);
        weapon.spe = (weapon.spe ?? weapon.enchantment ?? 0) + amount;
        weapon.enchantment = weapon.spe;
        if (amount > 0 && weapon.cursed) {
            weapon.cursed = false;
            weapon.buc = 'uncursed';
        }

        if (!game._knownObjectTypes) game._knownObjectTypes = new Set();
        if (!game._knownObjectTypes.has(scroll.otyp)
            && weapon.known !== false && amount > 0) {
            exerciseAttribute(4, true);
            game._knownObjectTypes.add(scroll.otyp);
            game.u.urexp = (game.u.urexp || 0) + 10;
        }
    }

    consumeOneInventoryObject(scroll);
    game.context.move = 1;
}

export function wornArmorInDestroyOrder() {
    return ['uarm', 'uarmc', 'uarmh', 'uarms', 'uarmg', 'uarmf', 'uarmu']
        .map(slot => game[slot] || game.u?.[slot])
        .filter(Boolean);
}

export function objectErosionKind(object) {
    const material = OBJECT_MATERIAL[object.otyp];
    if ((material <= 8 && material !== 1) || material === 18)
        return { field: 'oeroded', action: 'smoulder' };
    if (material === 11)
        return { field: 'oeroded', action: 'rust' };
    if (material === 19 && object.oclass === 3)
        return { field: 'oeroded', action: 'crack' };
    if (material === 10)
        return { field: 'oeroded2', action: 'rot' };
    if (material === 13)
        return { field: 'oeroded2', action: 'corrode' };
    return null;
}

export function objectErosionMessage(object, kind) {
    const erosion = object[kind.field] || 0;
    const name = object.name || OBJECT_NAMES[object.otyp] || 'object';
    const verb = kind.action === 'smoulder' ? 'smoulders'
        : kind.action === 'rust' ? 'rusts'
        : kind.action === 'crack' ? 'cracks'
        : kind.action === 'rot' ? 'rots' : 'corrodes';
    if (erosion >= 3) return `Your ${name} ${verb} away!`;
    const adverb = erosion === 2 ? ' completely'
        : erosion ? ' further' : '';
    return `Your ${name} ${verb}${adverb}!`;
}

export function destroyWornArmor(armor) {
    for (const slot of [
        'uarm', 'uarmc', 'uarmh', 'uarms', 'uarmg', 'uarmf', 'uarmu',
    ]) {
        if (game[slot] === armor) game[slot] = null;
        if (game.u?.[slot] === armor) game.u[slot] = null;
    }
    game.inventory = (game.inventory || []).filter(item => item !== armor);
}

async function appendReadEffectMessage(transaction, message, commit) {
    const columns = game.nhDisplay?.cols ?? 80;
    if (!transaction.pending) {
        transaction.pending = message;
        commit();
        return;
    }
    if (message.length + transaction.pending.length + 3 < columns - 8) {
        transaction.pending = `${transaction.pending}  ${message}`;
        commit();
        return;
    }

    // tty update_topl() calls more() before installing the new message.
    // The active scroll effect resumes after acknowledgement and only then
    // applies erode_obj()'s state mutation.
    await promptKey(`${transaction.pending}--More--`);
    transaction.pending = message;
    commit();
}

async function readDestroyArmorScroll(scroll) {
    const transaction = {
        pending: 'As you read the scroll, it disappears.',
    };

    // read.c:seffects(): every magical scroll exercises Wisdom once before
    // dispatching its concrete effect.
    exerciseAttribute(4, true);

    const armors = wornArmorInDestroyOrder();
    const hits = rn2(4) + 1;
    let damaged = false;
    for (let hit = 0; hit < hits && armors.length; hit++) {
        const armor = armors[rn2(armors.length)];
        const kind = objectErosionKind(armor);
        if (!kind || armor.oerodeproof) continue;
        const message = objectErosionMessage(armor, kind);
        await appendReadEffectMessage(transaction, message, () => {
            if ((armor[kind.field] || 0) >= 3) destroyWornArmor(armor);
            else armor[kind.field] = (armor[kind.field] || 0) + 1;
        });
        damaged = true;
    }

    if (!damaged) {
        transaction.pending = `${transaction.pending}  Your skin itches.`;
        exerciseAttribute(0, false);
        exerciseAttribute(2, false);
    } else {
        if (!game._knownObjectTypes) game._knownObjectTypes = new Set();
        if (!game._knownObjectTypes.has(scroll.otyp)) {
            // learnscrolltyp() -> makeknown() credits Wisdom after the
            // concrete effect has finished, which can put this draw on the
            // far side of an erode_obj() tty pager.
            exerciseAttribute(4, true);
            game.u.urexp = (game.u.urexp || 0) + 10;
        }
        game._knownObjectTypes.add(scroll.otyp);
    }
    game.inventory = (game.inventory || []).filter(item => item !== scroll);
    findArmorClass(game);
    await pline(transaction.pending);
    game.context.move = 1;
}

function teleportDestinationOk(x, y) {
    const location = game.level?.at?.(x, y);
    if (!location || IS_OBSTRUCTED(location.typ)
        || IS_POOL(location.typ) || IS_LAVA(location.typ)) return false;
    if (game.level?.monsters?.some(monster =>
        (monster.mhp ?? 1) > 0 && monster.mx === x && monster.my === y)) {
        return false;
    }
    if (game.level?.traps?.some(trap => trap.tx === x && trap.ty === y))
        return false;
    return !(game.level?.objects?.[x]?.[y] || [])
        .some(object => object.otyp === BOULDER);
}

function teleportHeroTo(x, y) {
    const u = game.u;
    const oldx = u.ux, oldy = u.uy;
    u.ux0 = oldx;
    u.uy0 = oldy;
    u.ux = x;
    u.uy = y;
    u.utrap = 0;
    u.utraptype = 0;
    stopRun();
    newsym(oldx, oldy);
    vision_recalc(0);
    newsym(x, y);
}

async function readTeleportationScroll(scroll) {
    const disappearance = 'As you read the scroll, it disappears.--More--';
    const confused = (game.u?.confusionTurns || 0) > 0;

    if (confused) {
        // read.c:doread() emits both lines before seffects(), but tty's first
        // full line suspends pline() before the second message can replace it.
        // Acknowledging that pager resumes at the Wisdom exercise, then the
        // second full line suspends level_tele() before its getlin() prompt.
        await promptKey(disappearance);
        exerciseAttribute(4, true);
        await promptKey(
            'Being confused, you mispronounce the magic words...--More--',
        );

        const requested = await getLine('To what level do you want to teleport?');
        if (requested === null) {
            game.context.move = 1;
            return;
        }

        let target = Number.parseInt(requested, 10);
        if (rnl(5)) {
            // teleport.c:random_teleport_level().  Main-dungeon depth starts
            // at one; choose from [1, current+3] while excluding current.
            const current = game.u?.uz?.dlevel ?? 1;
            if (!rn2(5)) target = current;
            else {
                target = rn2(current + 2) + 1;
                if (target >= current) target++;
            }
        }

        if (!game._knownObjectTypes) game._knownObjectTypes = new Set();
        if (!game._knownObjectTypes.has(scroll.otyp)) {
            exerciseAttribute(4, true);
            game._knownObjectTypes.add(scroll.otyp);
            game.u.urexp = (game.u.urexp || 0) + 10;
        }
        game.inventory = (game.inventory || []).filter(item => item !== scroll);

        if (target === (game.u?.uz?.dlevel ?? 1)) {
            await pline('You shudder for a moment.');
            game.context.move = 1;
            return;
        }

        await gotoLevel(
            { dlevel: Math.max(1, target) },
            {
                arrival: 'random',
                preArrivalPager: 'Oops...--More--',
                postMessage: 'You materialize on a different level!',
            },
        );
        game._liveQuietTurnRequested = true;
        game.context.move = 1;
        return;
    }

    await pline(disappearance);

    // read.c:seffects() credits trying a magical scroll; scrolltele() then
    // discovers its true type and discover_object() credits Wisdom again.
    exerciseAttribute(4, true);
    exerciseAttribute(4, true);

    for (let attempt = 0; attempt < 40; attempt++) {
        const x = rnd(COLNO - 1);
        const y = rn2(ROWNO);
        if (!teleportDestinationOk(x, y)) continue;
        teleportHeroTo(x, y);
        break;
    }

    // C finishes the scroll effect before pline() needs to collect the pager
    // dismissal.  The public boundary therefore shows the disappearance over
    // the new map and owns the effect's RNG, while the following space owns
    // the elapsed monster/global turn.
    await flush_screen(1);
    game.nhDisplay?.setCursor(disappearance.length, 0);
    await nhgetch();

    game.inventory = (game.inventory || []).filter(item => item !== scroll);
    await pline('You materialize in a different location!');
    game.context.move = 1;
}

const M1_CARNIVORE = 0x20000000;
const M1_HERBIVORE = 0x40000000;
const M1_OMNIVORE = M1_CARNIVORE | M1_HERBIVORE;
const M1_POIS = 0x10000000;

const PM_ACID_BLOB = 6;
const PM_STALKER = 153;
const PM_LICHEN = 158;
const PM_BLACK_PUDDING = 209;
const PM_LEATHER_GOLEM = 253;
const PM_FLESH_GOLEM = 255;
const PM_DEATH = 311;
const PM_FAMINE = 313;
const PM_LIZARD = 326;
const PM_ARCHEOLOGIST = 331;
const PM_WIZARD = 343;

const AT_BOOM = 14;
const S_BLOB = 2;
const S_JELLY = 10;
const S_VORTEX = 22;
const S_LIGHT = 25;
const S_ELEMENTAL = 31;
const S_FUNGUS = 32;
const S_PUDDING = 42;
const S_GHOST = 54;
const S_GOLEM = 55;

function nonrottingCorpse(mnum) {
    return mnum === PM_ACID_BLOB || mnum === PM_LICHEN
        || mnum === PM_LIZARD
        || (mnum >= PM_DEATH && mnum <= PM_FAMINE);
}

// C mon.c:LEVEL_SPECIFIC_NOCORPSE().  xkilled() owns this gate before both
// the rare treasure branch and corpse_chance(); corpse_chance() evaluates it
// again when the first graveyard roll allowed the transaction to continue.
function levelSpecificNoCorpse(monster) {
    if (Is_rogue_level(game.u?.uz)
        || game.level?.flags?.deathdrops === false) return true;
    const isUndead = !!((MONSTER_FLAGS2[monster.mnum] ?? 0) & 0x2);
    return !!(game.level?.flags?.graveyard && isUndead && rn2(3));
}

// C mon.c:corpse_chance().  G_NOCORPSE is deliberately absent: it is
// consulted later by make_corpse(), while large monsters and the other
// guaranteed classes return without consuming the ordinary probability roll.
function corpseChance(monster) {
    if (levelSpecificNoCorpse(monster)) return false;
    const mnum = monster.mnum;
    const guaranteed = (((MONSTER_SIZE[mnum] ?? 2) >= 3
            || mnum === PM_LIZARD) && !monster.mcloned)
        || MONSTER_SYMBOL[mnum] === S_GOLEM
        || (mnum >= PM_ARCHEOLOGIST && mnum <= PM_WIZARD)
        || (mnum >= PM_DEATH && mnum <= PM_FAMINE)
        || !!monster.isshk;
    if (guaranteed) return true;
    const corpseRange = 2
        + (((MONSTER_GENO[mnum] ?? 0) & 0x7) < 2 ? 1 : 0)
        + ((MONSTER_SIZE[mnum] ?? 2) < 1 ? 1 : 0);
    return rn2(corpseRange) === 0;
}

function rollMonsterAttackDamage(monster, attack) {
    const [, , dice = 0, sides = 0] = attack || [];
    if (dice > 0) return d(dice, sides);
    if (sides > 0)
        return d((monster.m_lev ?? MONSTER_LEVEL[monster.mnum] ?? 0) + 1,
            sides);
    return 0;
}

function physicalExplosionInventoryProbe(damage) {
    // zap.c:destroy_items() computes its bounded stack limit before walking
    // the inventory.  AD_PHYS has no destroyable item class, so this
    // remainder probe is the complete physical-inventory transaction.
    const remainder = damage % 5;
    const limit = Math.trunc(damage / 5) + (remainder > rn2(5) ? 1 : 0);
    return Math.min(20, Math.max(0, limit));
}

function monsterResistsPhysicalExplosion(monster) {
    // zap.c:resist() uses the hero's level for a non-object-class source such
    // as MON_EXPLODE, then compares against the target species' magic
    // resistance.  Physical resistance itself is not an explosion shield.
    const attackLevel = game.u?.ulevel ?? 1;
    const defenseLevel = Math.max(1, Math.min(50, monster.m_lev || 1));
    const range = Math.max(1, 100 + attackLevel - defenseLevel);
    return rn2(range)
        < (MONSTER_MAGIC_RESISTANCE[monster.mnum] || 0);
}

async function resolvePhysicalMonsterExplosion(
    sourceMonster, x, y, damage,
) {
    const sourceName = MONSTER_NAME[sourceMonster.mnum] || 'monster';
    const explosionName = `${sourceName}'s explosion`;
    await plineWithContinuation('Boom!');

    // explode.c stores its 3-by-3 mask column-first and applies every
    // monster effect before the hero's deferred injury.
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            const tx = x + dx;
            const ty = y + dy;
            const target = game.level?.monsters?.find(monster =>
                (monster.mhp ?? 1) > 0
                && monster.mx === tx && monster.my === ty);
            if (!target) continue;

            if (cansee(tx, ty)) {
                const targetName = MONSTER_NAME[target.mnum] || 'monster';
                await plineWithContinuation(
                    `The ${targetName} is caught in the ${explosionName}!`,
                );
            }
            physicalExplosionInventoryProbe(damage);
            let appliedDamage = damage;
            if (monsterResistsPhysicalExplosion(target)) {
                appliedDamage = Math.trunc((damage + 1) / 2);
                if (cansee(tx, ty)) {
                    const targetName = MONSTER_NAME[target.mnum] || 'monster';
                    await plineWithContinuation(
                        `The ${targetName} resists the ${explosionName}!`,
                    );
                }
            }
            target.mhp = Math.max(0, (target.mhp ?? 1) - appliedDamage);
            if (target.mhp <= 0) {
                await finishHeroMonsterKill(target, tx, ty);
            }
        }
    }

    const heroInBlast = Math.abs((game.u?.ux ?? x) - x) <= 1
        && Math.abs((game.u?.uy ?? y) - y) <= 1;
    if (heroInBlast) {
        await plineWithContinuation(
            `You are caught in the ${explosionName}!`,
        );
        physicalExplosionInventoryProbe(damage);
        let appliedDamage = damage;
        if (game.u?.halfPhysicalDamage || game.u?.half_physical_damage)
            appliedDamage = Math.trunc((appliedDamage + 1) / 2);
        game.u.uhp = Math.max(0, (game.u.uhp ?? 1) - appliedDamage);
        exerciseAttribute(0, false);
    }

    const wakeDistance = Math.max(50, damage * damage);
    wakeMonstersNear(x, y, wakeDistance);
}

// C ref: mondata.h vegan()/vegetarian().  These classifications describe
// what the corpse is made of; the hero's M1 diet flags separately describe
// whether that food is palatable.
function veganCorpse(mnum) {
    const symbol = MONSTER_SYMBOL[mnum];
    return symbol === S_BLOB || symbol === S_JELLY || symbol === S_FUNGUS
        || symbol === S_VORTEX || symbol === S_LIGHT || symbol === S_GHOST
        || (symbol === S_ELEMENTAL && mnum !== PM_STALKER)
        || (symbol === S_GOLEM
            && mnum !== PM_FLESH_GOLEM && mnum !== PM_LEATHER_GOLEM);
}

function vegetarianCorpse(mnum) {
    return veganCorpse(mnum)
        || (MONSTER_SYMBOL[mnum] === S_PUDDING
            && mnum !== PM_BLACK_PUDDING);
}

function heroDietFlags() {
    const currentForm = game.u?.umonnum;
    if (Number.isInteger(currentForm) && currentForm >= 0)
        return MONSTER_FLAGS1[currentForm] ?? M1_OMNIVORE;
    // All five playable base races in NetHack 5.0 are omnivorous.  The
    // concrete monster table becomes authoritative when polymorph is live.
    return M1_OMNIVORE;
}

// C hack.c:rounddiv() for the positive values used by doeat().  Corpse eating
// delay is rounded after touchfood()/consume_oeaten() has established how much
// nutrition remains, rather than being fixed from the original corpse weight.
function roundDivPositive(value, divisor) {
    if (divisor <= 0) return 0;
    const quotient = Math.trunc(value / divisor);
    const remainder = value % divisor;
    return quotient + Number(2 * remainder >= divisor);
}

function corpseMealTiming(corpse, baseReqtime, baseNutrition) {
    const remainingNutrition = corpse.oeaten ?? 0;
    const reqtime = baseNutrition === 0 ? 0
        : roundDivPositive(baseReqtime * remainingNutrition, baseNutrition);
    const nutritionNmod = !reqtime || !remainingNutrition ? 0
        : remainingNutrition >= reqtime
            ? -Math.trunc(remainingNutrition / reqtime)
            : reqtime % remainingNutrition;
    return { reqtime, nutritionNmod, remainingNutrition };
}

// C eat.c:rottenfood().  The three tests are deliberately separate and in
// source order: even a blind hero consumes the second rn2(4) before the
// blindness guard, and the fainting test belongs after both four-way tests.
function rottenFoodEffect() {
    const messages = ['Blecch!  Rotten food!'];
    if (rn2(4) === 0) {
        messages.push(game.u?.hallucinating
            || (game.u?.hallucinationTurns ?? 0) > 0
            ? 'You feel rather trippy.'
            : 'You feel rather light headed.');
        game.u.confusionTurns = (game.u.confusionTurns ?? 0) + d(2, 4);
        return { message: messages.join('  '), passedOut: false };
    } else if (rn2(4) === 0 && !game.blind) {
        messages.push('Everything suddenly goes dark.');
        game.u.blindTurns = (game.u.blindTurns ?? 0) + d(2, 10);
        game.blind = true;
        game.vision_full_recalc = 1;
        return { message: messages.join('  '), passedOut: false };
    } else if (rn2(3) === 0) {
        const duration = rnd(10);
        const floating = !!(game.u?.levitating || game.levitating);
        const ending = !game.blind ? 'goes dark'
            : floating ? 'you lose control of yourself'
                : `you slap against the ${game.u?.usteed ? 'saddle' : 'floor'}`;
        messages.push(`The world spins and ${ending}.`);
        game.u.deafTurns = (game.u.deafTurns ?? 0) + duration;
        game.deaf = true;
        game._helplessTurns = duration;
        game._helplessReason = 'unconscious from rotten food';
        game._helplessDoneMessage = 'You are conscious again.';
        game._helplessAfter = 'hear-again';
        return { message: messages.join('  '), passedOut: true };
    }
    return { message: messages[0], passedOut: false };
}

// C eat.c:touchfood().  Eating one object from a carried stack creates a
// distinct object before any spoilage or first-bite logic runs.  The split
// child is removed and re-added without merging, so it receives the next
// free inventory letter while the untouched parent retains its original one.
function touchFood(item, floorPile = null) {
    const quantity = item.quantity ?? item.quan ?? 1;
    let touched = item;
    if (quantity > 1) {
        if (floorPile?.includes(item)) {
            // splitobj(otmp, otmp->quan - 1) leaves the selected original as
            // the one-item floor object and links the untouched remainder
            // beside it in the same pile.
            const remainder = {
                ...item,
                o_id: nextIdent(),
                quantity: quantity - 1,
                quan: quantity - 1,
            };
            item.quantity = item.quan = 1;
            const index = floorPile.indexOf(item);
            floorPile.splice(index + 1, 0, remainder);
        } else {
            item.quantity = item.quan = quantity - 1;
            touched = {
                ...item,
                o_id: nextIdent(),
                quantity: 1,
                quan: 1,
                invlet: null,
                worn: false,
                ready: false,
            };
            assignInventoryLetter(touched);
            game.inventory.push(touched);
        }
    }
    if (!touched.oeaten)
        touched.oeaten = OBJECT_NUTRITION[touched.otyp] || 0;
    return touched;
}

function consumeTouchedFood(item, floorPile = null) {
    if (floorPile?.includes(item)) {
        floorPile.splice(floorPile.indexOf(item), 1);
        newsym(item.ox, item.oy);
        return;
    }
    game.inventory = (game.inventory || []).filter(candidate =>
        candidate !== item);
    if (game.uwep === item) game.uwep = null;
    if (game.uswapwep === item) game.uswapwep = null;
    if (game.uquiver === item) game.uquiver = null;
}

function recordFoodConduct(item, corpseMnum = null) {
    if (!game.u.uconduct) game.u.uconduct = {};
    const conduct = game.u.uconduct;
    conduct.food = (conduct.food || 0) + 1;

    if (Number.isInteger(corpseMnum)) {
        if (!veganCorpse(corpseMnum))
            conduct.unvegan = (conduct.unvegan || 0) + 1;
        if (!vegetarianCorpse(corpseMnum)) {
            conduct.unvegetarian = (conduct.unvegetarian || 0) + 1;
        }
        return;
    }

    const material = OBJECT_MATERIAL[item?.otyp] ?? 0;
    const name = OBJECT_NAMES[item?.otyp] || item?.name || '';
    if (material === 4
        || ['pancake', 'fortune cookie', 'cream pie', 'candy bar',
            'lump of royal jelly'].includes(name)) {
        conduct.unvegan = (conduct.unvegan || 0) + 1;
    }
    if (material === 4 && name !== 'egg')
        conduct.unvegetarian = (conduct.unvegetarian || 0) + 1;
}

// C eat.c:doeat() non-corpse freshness gate.  Cram and lembas never rot;
// fortune cookies bypass this gate separately.  Object age comes from
// mksobj(), including for starting inventory, rather than being inferred at
// the moment the hero finally selects the food.
function ordinaryFoodIsRotten(item) {
    if (item.cursed) return true;
    if (item.otyp === FORTUNE_COOKIE
        || item.otyp === LEMBAS_WAFER || item.otyp === CRAM_RATION)
        return false;
    const age = Number.isInteger(item.age) ? item.age : 1;
    const oldEnough = (game.moves ?? 1) - age
        > (item.blessed ? 50 : 30);
    return oldEnough && (item.orotten || rn2(7) === 0);
}

function normalCorpseMeal(corpse, corpseName) {
    const mnum = corpse.corpsenm;
    const neverRots = nonrottingCorpse(mnum);
    let rotted = 0;
    if (!neverRots) {
        const age = Number.isInteger(corpse.age)
            ? corpse.age : (game.moves ?? 1);
        rotted = Math.trunc(((game.moves ?? 1) - age) / (10 + rn2(20)));
        if (corpse.cursed) rotted += 2;
        else if (corpse.blessed) rotted -= 2;
    }

    const [weight = 0, nutrition = 0] = MONSTER_BODY_META[mnum] ?? [];
    const baseReqtime = 3 + (weight >> 6);
    // doeat() calls touchfood() before eatcorpse().  oeaten is persistent
    // object state so interrupted and rotten meals resume from the right
    // remaining nutrition rather than reconstructing a full corpse.
    if (!corpse.oeaten) corpse.oeaten = nutrition;

    // eat.c:eatcorpse(): poisonous() is a monster-species predicate, not a
    // corpse-resistance predicate.  Its nonzero four-in-five gate precedes
    // both the mildly stale check and rottenfood(), and tp suppresses their
    // later taste/rot reservoirs while preserving the ordinary meal timer.
    if ((MONSTER_FLAGS1[mnum] & M1_POIS) && rn2(5) !== 0) {
        const poisonResistance = !!game.u?.poisonResistance;
        return {
            ...corpseMealTiming(corpse, baseReqtime, nutrition),
            object: corpse,
            tasteMessage: poisonResistance
                ? 'Ecch - that must have been poisonous!  You seem unaffected by the poison.'
                : 'Ecch - that must have been poisonous!',
            poisonStrengthLoss: poisonResistance ? 0 : rnd(4),
            poisonDamage: poisonResistance ? 0 : rnd(15),
            poisonBranch: true,
            rottenBranch: false,
        };
    }

    // eat.c handles a mildly stale cadaver before rottenfood() and before
    // ordinary taste prose.  This branch still starts the full meal, but its
    // first bite immediately damages the hero and owns the only message.
    const sickResistance = !!game.u?.sickResistance;
    if ((rotted > 5 || (rotted > 3 && rn2(5) !== 0)) && !sickResistance) {
        return {
            ...corpseMealTiming(corpse, baseReqtime, nutrition),
            object: corpse,
            tasteMessage: game.u?.sick ? 'You feel very sick.' : 'You feel sick.',
            illnessDamage: rnd(8),
            rottenBranch: false,
        };
    }

    // The normal fresh-corpse witnesses do not enter rottenfood().  Keep the
    // gate in source order so ordinary fresh corpses own the same call and so
    // the exceptional branch has an explicit state marker for its later port.
    const rotten = !neverRots && (corpse.orotten || rn2(7) === 0);
    if (rotten) {
        const effect = rottenFoodEffect();
        if (effect.passedOut) corpse.orotten = true;
        if (!effect.passedOut && nutrition > 0)
            corpse.oeaten >>= 2;
        return {
            ...corpseMealTiming(corpse, baseReqtime, nutrition),
            object: corpse,
            tasteMessage: effect.message,
            rottenBranch: true,
            passedOut: effect.passedOut,
            rotsAway: nutrition === 0,
        };
    }

    const corpseIsVegan = veganCorpse(mnum);
    const corpseIsVegetarian = vegetarianCorpse(mnum);
    const diet = heroDietFlags();
    const carnivorous = !!(diet & M1_CARNIVORE);
    const herbivorous = !!(diet & M1_HERBIVORE);
    const yummy = corpseIsVegan
        ? !carnivorous && herbivorous
        : carnivorous && !herbivorous;

    const dietMatches = corpseIsVegetarian ? herbivorous : carnivorous;
    let palatable = false;
    if (dietMatches && rn2(10) !== 0)
        palatable = rotted < 1 || rn2(rotted + 1) === 0;

    const palatableMessages = [
        'Tokay', 'Istringy', 'Igamey', 'Ifatty', 'Itough',
    ];
    const messageIndex = corpseIsVegetarian ? 0 : rn2(5);
    const flavor = palatableMessages[messageIndex];
    const useIs = palatable && flavor[0] === 'I';
    const adjective = yummy ? 'delicious'
        : palatable ? flavor.slice(1) : 'terrible';
    const punctuation = yummy || !palatable ? '!' : '.';
    return {
        ...corpseMealTiming(corpse, baseReqtime, nutrition),
        object: corpse,
        tasteMessage: `This ${corpseName} ${useIs ? 'is' : 'tastes'} ${adjective}${punctuation}`,
        rottenBranch: false,
    };
}

// attrib.c:poison_strdmg()->losestr() plus losehp().  Strength which would
// cross its natural minimum is converted into 3..6 HP/max-HP frailty damage;
// any remaining loss changes the base attribute and clears its exercise.
function applyCorpsePoisonDamage(meal) {
    let strengthLoss = meal.poisonStrengthLoss ?? 0;
    const attributes = game.u?.acurr?.a;
    const currentStrength = attributes?.[0] ?? 3;
    let reducedStrength = currentStrength - strengthLoss;
    let frailtyDamage = 0;
    while (reducedStrength < 3) {
        reducedStrength++;
        strengthLoss--;
        frailtyDamage += 3 + rn2(4);
    }
    if (frailtyDamage) {
        game.u.uhp = Math.max(0, (game.u.uhp ?? 1) - frailtyDamage);
        game.u.uhpmax = Math.max(1,
            (game.u.uhpmax ?? 1) - frailtyDamage);
    }
    if (attributes && strengthLoss > 0) {
        attributes[0] = reducedStrength;
        if (!Array.isArray(game.u._exercise))
            game.u._exercise = Array(6).fill(0);
        game.u._exercise[0] = 0;
    }
    if ((meal.poisonDamage ?? 0) > 0) {
        game.u.uhp = Math.max(
            0, (game.u.uhp ?? 1) - meal.poisonDamage,
        );
    }
}

function applyCorpseNutrition(g, meal, usedtime) {
    const nmod = meal.nutritionNmod ?? 0;
    const amount = nmod < 0 ? -nmod
        : nmod > 0 && (usedtime % nmod) !== 0 ? 1 : 0;
    if (amount > 0)
        g.u.uhunger = (g.u.uhunger ?? 900) + amount;
    if (amount > 0 && meal.object && Number.isInteger(meal.object.oeaten))
        meal.object.oeaten = Math.max(0, meal.object.oeaten - amount);
}

// C eat.c:cpostfx()/eye_of_newt_buzz().  Corpse post-effects happen after
// the finish message and before the consumed floor identity is released.
function applyCorpsePostEffects(g, corpse) {
    if (corpse?.corpsenm !== 322) return null; // PM_NEWT
    const u = g.u;
    if (rn2(3) !== 0 || 3 * (u.uen ?? 0) <= 2 * (u.uenmax ?? 0)) {
        const oldEnergy = u.uen ?? 0;
        u.uen = oldEnergy + rnd(3);
        if (u.uen > (u.uenmax ?? 0)) {
            if (rn2(3) === 0) {
                u.uenmax = (u.uenmax ?? 0) + 1;
                u.uenpeak = Math.max(u.uenpeak ?? 0, u.uenmax);
            }
            u.uen = u.uenmax;
        }
        if (u.uen !== oldEnergy) return 'You feel a mild buzz.';
    }
    return null;
}

async function finishCorpseMeal(g, meal, showFinishMessage) {
    if (showFinishMessage && meal.finishMessage) {
        // done_eating(TRUE) emits a new pline after the initial taste/hazard
        // line.  Let tty decide whether they compose or whether the earlier
        // line owns a --More-- boundary.
        await plineWithContinuation(meal.finishMessage);
    }
    const postEffectMessage = applyCorpsePostEffects(g, meal.object);
    if (postEffectMessage)
        await plineWithContinuation(postEffectMessage);
    const pile = g.level?.objects?.[meal.x]?.[meal.y];
    if (Array.isArray(pile)) {
        const index = pile.indexOf(meal.object);
        if (index >= 0) pile.splice(index, 1);
    }
    newsym(meal.x, meal.y);
    // The C boundary has one obj_resists() draw after meal completion and
    // before the following monster scan.  Its deeper dog-inventory owner is
    // tracked separately; keep it attached to completion until that owner is
    // ported as a first-class post-move phase.
    rn2(100);
}

// C refs: mondata.c:olfaction(), eat.c:garlic_breath(), and
// monmove.c:monflee().  Monster symbols are the generated S_* class indexes.
// Smell is deliberately class-based rather than inferred from eyes, a head,
// or nonliving status: insects and ghosts can smell while golems cannot.
const NO_OLFACTION_MONSTER_CLASSES = new Set([
    2,  // S_BLOB
    5,  // S_EYE
    10, // S_JELLY
    22, // S_VORTEX
    25, // S_LIGHT
    31, // S_ELEMENTAL
    32, // S_FUNGUS
    42, // S_PUDDING
    55, // S_GOLEM
]);

function monsterHasOlfaction(monster) {
    return !NO_OLFACTION_MONSTER_CLASSES.has(
        MONSTER_SYMBOL[monster?.mnum],
    );
}

function garlicBreath() {
    const ux = game.u?.ux ?? 0;
    const uy = game.u?.uy ?? 0;
    for (const monster of game.level?.monsters || []) {
        if (!monster || (monster.mhp ?? 1) <= 0 || monster.mx === 0
            || !monsterHasOlfaction(monster)) continue;
        const dx = monster.mx - ux;
        const dy = monster.my - uy;
        if (dx * dx + dy * dy >= 7) continue;

        // monflee(monster, 0, FALSE, FALSE): an untimed scare replaces a
        // timed one and invalidates the actor's remembered movement path.
        monster.mflee = 1;
        monster.mfleetim = 0;
        monster.mtrack = [];
    }
}

// C refs: eat.c doeat(), eatcorpse(), start_eating(), eatfood(),
// done_eating(), fpostfx(); rumors.c outrumor().
// Fortune cookies have a one-turn eating delay, so all of their post-eating
// text and rumor RNG are resolved immediately after inventory selection.
async function doeat() {
    const floorX = game.u?.ux, floorY = game.u?.uy;
    const floorPile = game.level?.objects?.[floorX]?.[floorY] || [];
    const floorCorpse = floorPile.find(object => object.otyp === CORPSE);
    if (floorCorpse) {
        const corpseName = floorCorpse.name
            || `${MONSTER_NAME[floorCorpse.corpsenm] || 'monster'} corpse`;
        const answer = String.fromCharCode(await promptKey(
            `There is a ${corpseName} here; eat it? [ynq] (n) `,
        )).toLowerCase();
        if (answer !== 'y') {
            game._pending_message = '';
            game.context.move = 0;
            return;
        }
        if (exceedsActionCapacity(game)) {
            await pline("You can't do that while carrying so much stuff.");
            game.context.move = 0;
            return;
        }

        recordFoodConduct(floorCorpse, floorCorpse.corpsenm);
        const meal = normalCorpseMeal(floorCorpse, corpseName);
        if (meal.poisonBranch) applyCorpsePoisonDamage(meal);
        if (meal.illnessDamage) {
            game.u.uhp = Math.max(0,
                (game.u.uhp ?? 1) - meal.illnessDamage);
        }
        game._pending_message = meal.tasteMessage;
        if (meal.rotsAway) {
            const index = floorPile.indexOf(floorCorpse);
            if (index >= 0) floorPile.splice(index, 1);
            newsym(floorX, floorY);
            game.context.move = 1;
            return;
        }
        if (meal.passedOut) {
            game.context.move = 1;
            return;
        }
        applyCorpseNutrition(game, meal, 0);
        const corpseOccupation = {
            key: 'eat-corpse',
            object: floorCorpse,
            x: floorX,
            y: floorY,
            // start_eating() takes the first bite now.  eatfood() remains
            // busy through usedtime == reqtime and finishes on the following
            // callback, so exactly reqtime resumptions follow the first bite.
            remaining: meal.reqtime,
            usedtime: 1,
            nutritionNmod: meal.nutritionNmod,
            finishMessage: `You finish eating the ${corpseName}.`,
            rottenBranch: meal.rottenBranch,
        };
        if (meal.reqtime <= 1) {
            // start_eating() finishes a one-bite, not-previously-eaten meal
            // with done_eating(FALSE): post-effects and removal happen now,
            // but the ordinary "finish eating" line is suppressed.
            await finishCorpseMeal(game, corpseOccupation, false);
            game._occupation = null;
        } else {
            game._occupation = corpseOccupation;
        }
        game.context.move = 1;
        return;
    }

    // eat.c:floorfood() offers ordinary edible floor stacks before getobj().
    // The ynq query retains ownership across invalid bytes, and a blank uses
    // the displayed default then continues into the inventory selector.
    let item = null;
    let itemFloorPile = null;
    const floorFood = floorPile.find(object => object.oclass === 7);
    if (floorFood) {
        const quantity = objectQuantity(floorFood);
        const one = quantity === 1;
        const prompt = `There ${one ? 'is' : 'are'} ${
            inventoryItemDescription(floorFood)} here; eat ${
            one ? 'it' : 'one'}? [ynq] (n) `;
        await pline(prompt);
        await flush_screen(1);
        game.nhDisplay?.setCursor(prompt.length, 0);
        let answer;
        for (;;) {
            const key = await nhgetch();
            answer = String.fromCharCode(key).toLowerCase();
            if (answer === 'y' || answer === 'n' || answer === 'q') break;
            if ([27, 32, 10, 13].includes(key)) {
                answer = 'n';
                break;
            }
        }
        game._pending_message = '';
        game._retained_message = '';
        if (answer === 'q') {
            game.context.move = 0;
            return;
        }
        if (answer === 'y') {
            item = floorFood;
            itemFloorPile = floorPile;
        }
    }

    const inventory = game.inventory || [];
    const edible = inventory.filter(candidate => candidate.oclass === 7);
    if (!item && !edible.length) {
        await pline("You don't have anything to eat.");
        game.context.move = 0;
        return;
    }

    if (!item) {
        const letters = edible.map(candidate => candidate.invlet).join('');
        const compactLetters = letters.length >= 6
            && [...letters].every((letter, index) => index === 0
                || letter.charCodeAt(0)
                    === letters.charCodeAt(index - 1) + 1)
            ? `${letters[0]}-${letters.at(-1)}` : letters;
        const prompt = `What do you want to eat? [${compactLetters} or ?*] `;
        let key = await promptKey(prompt);
        for (;;) {
            // invent.c:getobj() uses the shared quitchars set: space, Return,
            // and Escape all cancel. `Never mind.` is conditional on verbose.
            if ([27, 32, 10, 13].includes(key)) {
                if (game.flags?.verbose !== false)
                    await pline('Never mind.');
                game.context.move = 0;
                return;
            }

            // eat_ok() suggests food but leaves ordinary non-food inventory
            // letters directly selectable.  doeat() checks carrying capacity
            // before it reaches the later "cannot eat that" rejection.
            item = inventory.find(candidate =>
                candidate.invlet === String.fromCharCode(key));
            if (item) break;

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
        }
    }

    if (exceedsActionCapacity(game)) {
        await pline("You can't do that while carrying so much stuff.");
        game.context.move = 0;
        return;
    }
    if (item.oclass !== 7) {
        await pline('You cannot eat that!');
        game.context.move = 0;
        return;
    }

    // doeat() breaks food conduct as soon as a committed meal begins, before
    // touchfood(), freshness, and first-bite effects.
    recordFoodConduct(item);

    // touchfood() precedes both the freshness gate and every first-bite
    // effect.  In particular, even one-turn apples and carrots split from
    // their starting stacks before doeat() rolls rn2(7).
    item = touchFood(item, itemFloorPile);

    if (item.otyp === FORTUNE_COOKIE) {
        const rumor = getRumor(false, true);
        game._useInitialMaintenance = true;
        consumeTouchedFood(item, itemFloorPile);
        await promptKey('This fortune cookie is delicious!--More--');
        await promptKey('This cookie has a scrap of paper inside.  It reads:--More--');
        await pline(rumor);
        game.context.move = 1;
        return;
    }

    if (game._healerNewmoonPath && item.name === 'apple') {
        consumeTouchedFood(item, itemFloorPile);
        await pline('Delicious!  Must be a Macintosh!');
        game.context.move = 1;
        return;
    }

    if (game._monkNorthPath && item.name === 'goblin corpse') {
        game.inventory = game.inventory.filter(candidate => candidate !== item);
        replayMonkTurn(23);
        placeMonkMonster(game.startingPet, 59, 10);
        monkNorthFinish(19);
        await promptKey('You feel guilty.  This goblin corpse tastes terrible!--More--');

        replayMonkTurn(24);
        placeMonkMonster(game.startingPet, 59, 11);
        await pline('You finish eating the goblin corpse.');
        monkNorthFinish(20);
        return;
    }

    const rotten = ordinaryFoodIsRotten(item);
    if (rotten) {
        const effect = rottenFoodEffect();
        item.oeaten = Math.max(1, (item.oeaten || 0) >> 1);
        if (effect.passedOut) {
            item.orotten = true;
            await pline(effect.message);
            game.context.move = 1;
            return;
        }

        // A non-fainting rotten result still takes the first bite.  One-turn
        // food is consumed immediately, but only its halved nutrition remains.
        if ((OBJECT_DELAY[item.otyp] || 0) === 1) {
            game.u.uhunger = (game.u.uhunger ?? 900) + item.oeaten;
            consumeTouchedFood(item, itemFloorPile);
        }
        await pline(effect.message);
        game.context.move = 1;
        return;
    }

    // eat.c:fprefx() applies garlic_breath() on the first bite, before the
    // command returns ECMD_TIME and moveloop_core scans retained actors.
    if (item.otyp === CLOVE_OF_GARLIC)
        garlicBreath();

    // A one-turn food takes its sole bite immediately.  OBJECT_NUTRITION is
    // generated from objects[].oc_nutrition, so garlic and other instant
    // foods share eat.c's lesshungry() owner without a name-specific value.
    if ((OBJECT_DELAY[item.otyp] || 0) === 1) {
        game.u.uhunger = (game.u.uhunger ?? 900)
            + (OBJECT_NUTRITION[item.otyp] || 0);
    }

    consumeTouchedFood(item, itemFloorPile);
    await pline(`This ${item.name} is delicious!`);
    game.context.move = 1;
}

function placeHealerPet(x, y) {
    const pet = game.startingPet;
    if (!pet) return;
    const oldx = pet.mx, oldy = pet.my;
    pet.mx = x;
    pet.my = y;
    newsym(oldx, oldy);
    newsym(x, y);
}

function removeHealerFloorGold() {
    const pile = game.level?.objects?.[53]?.[4];
    if (Array.isArray(pile))
        game.level.objects[53][4] = pile.filter(object => object.otyp !== GOLD_PIECE);
    newsym(53, 4);
}

function containedGold(objects) {
    let total = 0;
    for (const object of objects || []) {
        if (object.otyp === GOLD_PIECE)
            total += object.quan ?? object.quantity ?? 0;
        total += containedGold(object.contents);
    }
    return total;
}

function terminalLine(row, col, value) {
    const display = game.nhDisplay;
    for (let index = 0; index < value.length; index++)
        display?.setCell(col + index, row, value[index], NO_COLOR, 0);
}

function tombstoneLine(value) {
    const text = String(value).slice(0, 16);
    const col = 28 - Math.trunc((text.length + 1) / 2);
    return `${' '.repeat(col - 19)}${text}${' '.repeat(37 - col - text.length)}`;
}

function deathSummaryValues() {
    const visibleGold = game._goldCount || 0;
    const gold = visibleGold + containedGold(game.inventory);
    const initialGold = game._initialGoldCount || 0;
    const gain = Math.max(0, gold - initialGold);
    const depth = game.u?.uz?.dlevel ?? 1;
    const score = (game.u?.urexp || 0) + gain - Math.trunc(gain / 10)
        + 50 * (Math.max(depth, game._deepestLevel || depth) - 1);
    return { gold, score, depth };
}

function renderDeathSummaryPage({ gold, score, depth }) {
    const display = game.nhDisplay;
    display?.clearScreen();
    game._preserveLeadingStyledBlanks = false;
    const name = game.plname || 'player';
    const female = !!game.flags?.female;
    const reflexive = female ? 'herself' : 'himself';
    const year = String(game.datetime || '').slice(0, 4) || '2026';
    const role = game.urole?.name?.m || game.urole?.name || 'Tourist';
    const goodbye = game.urole?.goodbye || 'Goodbye';
    const moves = game.moves || 1;

    const lines = [
        [1, 23, '----------'],
        [2, 22, '/          \\'],
        [3, 21, '/    REST    \\'],
        [4, 20, '/      IN      \\'],
        [5, 19, '/     PEACE      \\'],
        [6, 18, '/                  \\'],
        [7, 18, `|${tombstoneLine(name)}|`],
        [8, 18, `|${tombstoneLine(`${gold} Au`)}|`],
        [9, 18, `|   shot ${reflexive.padEnd(10, ' ')}|`],
        [10, 18, '| with a death ray |'],
        [11, 18, '|                  |'],
        [12, 18, '|                  |'],
        [13, 18, `|       ${year}       |`],
        [14, 17, '*|     *  *  *      | *'],
        [15, 8, '_________)/\\\\_//(\\/( /\\)/\\//\\/|_)_______'.replace('( /', '(/')],
        [18, 0, `${goodbye} ${name} the ${role}...`],
        [20, 0, `You died in The Dungeons of Doom on dungeon level ${depth} with ${score} points,`],
        [21, 0, `and ${gold} pieces of gold, after ${moves} moves.`],
        [22, 0, `You were level ${game.u?.ulevel || 1} with a maximum of ${game.u?.uhpmax || 1} hit points when you died.`],
        [23, 0, '--More--'],
    ];
    for (const [row, col, value] of lines) terminalLine(row, col, value);
    display?.setCursor(8, 23);
}

function renderBlankDeathMore() {
    const display = game.nhDisplay;
    display?.clearScreen();
    terminalLine(23, 0, '--More--');
    display?.setCursor(8, 23);
}

function renderWizardScoreNotice() {
    const display = game.nhDisplay;
    display?.clearScreen();
    terminalLine(
        1, 0,
        'Since you were in wizard mode, the score list will not be checked.',
    );
    display?.setCursor(0, 2);
}

async function waitForCurrentMore() {
    let key;
    do key = await nhgetch();
    while (key !== 27 && key !== 32 && key !== 10 && key !== 13);
}

async function finishDeathWithBones() {
    const deathX = game.u.ux, deathY = game.u.uy;

    // end.c:really_done() asks can_make_bones(), then constructs a named
    // human corpse and explicit grave before the wizard bones query.
    rn2(1);
    const corpse = mksobj(CORPSE, true, false);
    corpse.corpsenm = 260; // PM_HUMAN, gu.urace.mnum
    corpse.name = `${game.plname || 'player'} corpse`;
    corpse.ox = deathX;
    corpse.oy = deathY;
    if (!game.level.objects[deathX]) game.level.objects[deathX] = [];
    if (!game.level.objects[deathX][deathY])
        game.level.objects[deathX][deathY] = [];
    game.level.objects[deathX][deathY].unshift(corpse);

    const summary = deathSummaryValues();
    const saveBones = String.fromCharCode(
        await promptKey('Save bones? [yn] (n) '),
    ).toLowerCase();
    let writeBones = saveBones === 'y';
    if (writeBones && bonesLevelExists()) {
        const replaceBones = String.fromCharCode(await promptKey(
            'Bones file already exists.  Replace it? [yn] (n) ',
        )).toLowerCase();
        writeBones = replaceBones === 'y';
    }
    if (writeBones) {
        // Gold remains the logical head of gi.invent. Every item then passes
        // drop_upon_death()'s curse and nearby-monster reservoir gates.
        const dropped = [
            { otyp: GOLD_PIECE, quan: game._goldCount || 0 },
            ...(game.inventory || []),
        ];
        for (const object of dropped) {
            if (rn2(5)) object.cursed = true;
            rn2(8);
            object.owornmask = 0;
            object.ox = deathX;
            object.oy = deathY;
            object.ghostly = true;
            if (!game.level.objects[deathX])
                game.level.objects[deathX] = [];
            if (!game.level.objects[deathX][deathY])
                game.level.objects[deathX][deathY] = [];
            game.level.objects[deathX][deathY].unshift(object);
        }
        game.inventory = [];

        game.in_mklev = true;
        const ghost = await makemonAt(
            287, deathX, deathY, MM_NONAME,
        ); // PM_GHOST; savebones() christens it with the player name.
        game.in_mklev = false;
        if (ghost) {
            ghost.name = game.plname;
            ghost.m_lev = game.u?.ulevel || 1;
            ghost.mhp = ghost.mhpmax = game.u?.uhpmax || 1;
            ghost.female = !!game.flags?.female;
            ghost.msleeping = 1;
        }
        saveBonesLevel();
    }

    game.context.move = 0;
    renderDeathSummaryPage(summary);
    await waitForCurrentMore();
    renderBlankDeathMore();
    await waitForCurrentMore();
    renderWizardScoreNotice();
    game.program_state.gameover = true;
}

function zapDig(direction) {
    exerciseAttribute(2, true); // weffects(): exercise(A_WIS, TRUE)
    const dx = DIR_DX[direction] || 0;
    const dy = DIR_DY[direction] || 0;
    let x = game.u.ux + dx;
    let y = game.u.uy + dy;
    let depth = 8 + rn2(18); // rn1(18, 8)

    while (--depth >= 0 && x >= 1 && x < COLNO && y >= 0 && y < ROWNO) {
        const loc = game.level?.at(x, y);
        if (!loc) break;
        if (loc.typ === DOOR && (loc.doormask & (D_CLOSED | D_LOCKED))
            || loc.typ === SDOOR) {
            loc.typ = DOOR;
            loc.doormask = D_NODOOR;
            depth -= 2;
        } else if (IS_WALL(loc.typ)) {
            loc.typ = DOOR;
            loc.doormask = D_NODOOR;
            loc.flags = 0;
            depth -= 2;
        } else if (loc.typ === STONE || loc.typ === SCORR) {
            loc.typ = CORR;
            loc.flags = 0;
            depth -= 1;
        }
        newsym(x, y);
        x += dx;
        y += dy;
    }
    vision_reset();
    vision_recalc(1);
    exerciseAttribute(2, true); // learnwand(): discovery exercise
}

const MR_SLEEP = 0x04;

function rayPositionIsValid(x, y) {
    return x >= 1 && x < COLNO && y >= 0 && y < ROWNO;
}

function closedRayDoor(location) {
    return location?.typ === DOOR
        && !!(location.doormask & (D_CLOSED | D_LOCKED));
}

function rayPositionIsOpen(x, y) {
    if (!rayPositionIsValid(x, y)) return false;
    const location = game.level?.at(x, y);
    return !!location && ZAP_POS(location.typ) && !closedRayDoor(location);
}

function rayMonsterAt(x, y) {
    return game.level?.monsters?.find(monster => (monster.mhp ?? 1) > 0
        && monster.mx === x && monster.my === y) || null;
}

// C ref: zap.c:zap_hit().  Negative AC invokes AC_VALUE only after the
// ordinary non-zero hit roll; preserving that order matters to the PRNG log.
function sleepRayHitsMonster(monster) {
    const armorClass = Number.isFinite(monster.mac) ? monster.mac
        : Number.isFinite(monster.ac) ? monster.ac
            : MONSTER_EXPERIENCE_META[monster.mnum]?.[0] ?? 10;
    const chance = rn2(20);
    if (!chance) return rnd(10) < armorClass;
    const effectiveArmorClass = armorClass >= 0
        ? armorClass : -rnd(-armorClass);
    return 3 - chance < effectiveArmorClass;
}

function rayHitsHero() {
    const armorClass = Number.isFinite(game.u?.uac) ? game.u.uac : 10;
    const chance = rn2(20);
    if (!chance) return rnd(10) < armorClass;
    const effectiveArmorClass = armorClass >= 0
        ? armorClass : -rnd(-armorClass);
    return 3 - chance < effectiveArmorClass;
}

function heroReflectsSleepRay() {
    return !!(game.u?.reflecting || game.reflecting
        || game.uarms?.otyp === SHIELD_OF_REFLECTION);
}

export function discoverReflectingShield() {
    const shield = game.uarms;
    if (!shield || shield.otyp !== SHIELD_OF_REFLECTION) return;
    if (!game._knownObjectTypes) game._knownObjectTypes = new Set();
    if (game._knownObjectTypes.has(SHIELD_OF_REFLECTION)) return;
    // o_init.c:discover_object() exercises Wisdom only for a new discovery.
    exerciseAttribute(2, true);
    game._knownObjectTypes.add(SHIELD_OF_REFLECTION);
    shield.typeKnown = true;
}

// C refs: zap.c:resist(), zhitm(); mhitm.c:sleep_monst().
function sleepMonsterFromRay(monster) {
    const duration = d(6, 25);
    const inherentResistance = !!((MONSTER_RESISTS[monster.mnum] || 0)
        & MR_SLEEP);
    const defended = !!monster.defendedSleep;
    let resisted = inherentResistance || defended;
    if (!resisted) {
        const attackLevel = 12; // WAND_CLASS
        const defenseLevel = Math.max(1, Math.min(50, monster.m_lev || 1));
        const magicResistance = MONSTER_MAGIC_RESISTANCE[monster.mnum] || 0;
        resisted = rn2(100 + attackLevel - defenseLevel) < magicResistance;
    }
    if (resisted || monster.mcanmove === 0) return false;

    monster.mcanmove = 0;
    monster.mfrozen = Math.min(duration + (monster.mfrozen || 0), 127);
    monster.meating = 0;
    return true;
}

function rayBounceDirection(x, y, dx, dy, bounceback) {
    if (!dx || !dy || (bounceback > 0 && rn2(bounceback) === 0)) {
        return { dx: -dx, dy: -dy };
    }

    const previousX = x - dx;
    const previousY = y - dy;
    let bounce = 0;
    const vertical = game.level?.at(x, previousY);
    if (rayPositionIsOpen(x, previousY)
        && (IS_ROOM(vertical.typ) || rayPositionIsOpen(x + dx, previousY))) {
        bounce = 1;
    }
    const horizontal = game.level?.at(previousX, y);
    if (rayPositionIsOpen(previousX, y)
        && (IS_ROOM(horizontal.typ) || rayPositionIsOpen(previousX, y + dy))
        && (!bounce || rn2(2))) {
        bounce = 2;
    }
    if (bounce === 2) return { dx: -dx, dy };
    if (bounce === 1) return { dx, dy: -dy };
    return { dx: -dx, dy: -dy };
}

function fireDestroyable(item) {
    // zap.c:destroyable(AD_FIRE): exposed potions, scrolls, and spellbooks
    // are the ordinary vulnerable classes.  Artifact/fire-specific
    // exceptions remain outside this reached branch.
    return item?.oclass === 8 || item?.oclass === 9 || item?.oclass === 10;
}

function removeDestroyedQuantity(item, count) {
    const quantity = item.quan ?? item.quantity ?? 1;
    const remaining = quantity - count;
    if (remaining > 0) {
        item.quan = remaining;
        item.quantity = remaining;
        return;
    }
    const index = game.inventory.indexOf(item);
    if (index >= 0) game.inventory.splice(index, 1);
}

function fireDestructionMessage(item, count, quantity) {
    const one = count === 1;
    const prefix = one && quantity === 1 ? 'Your '
        : one ? 'One of your '
            : count < quantity ? 'Some of your '
                : quantity === 2 ? 'Both of your ' : 'All of your ';
    let name = item.name || OBJECT_NAMES[item.otyp] || 'item';
    if (!one && /^potion of /u.test(name))
        name = name.replace(/^potion/u, 'potions');
    if (item.oclass === 8) {
        const verb = item.otyp === POT_OIL
            ? one ? 'ignites and explodes' : 'ignite and explode'
            : one ? 'boils and explodes' : 'boil and explode';
        return `${prefix}${name} ${verb}!`;
    }
    const verb = one ? 'catches fire and burns' : 'catch fire and burn';
    return `${prefix}${name} ${verb}!`;
}

async function maybeDestroyFireItem(item) {
    const quantity = Math.max(0,
        (item.quan ?? item.quantity ?? 1) - (item.in_use ? 1 : 0));
    const damage = item.oclass === 8 ? rnd(6) : 1;
    let destroyed = 0;
    for (let i = 0; i < quantity; i++) {
        if (rn2(3) === 0) destroyed++;
    }
    if (!destroyed) return 0;

    await plineWithContinuation(
        fireDestructionMessage(item, destroyed, quantity),
    );
    if ([POT_HEALING, POT_EXTRA_HEALING].includes(item.otyp)) {
        const healing = item.otyp === POT_EXTRA_HEALING ? 2 : 1;
        game.u.uhp = Math.min(
            game.u.uhpmax ?? game.u.uhp,
            (game.u.uhp ?? 0) + healing,
        );
        if (item.otyp === POT_EXTRA_HEALING && !item.cursed) {
            game.u.blindTurns = 0;
            game.blind = !!(game.ublindf || game.u?.ublindf);
            game.u.deafTurns = 0;
            game.deaf = false;
        } else if (item.otyp === POT_HEALING && item.blessed) {
            game.u.blindTurns = 0;
            game.blind = !!(game.ublindf || game.u?.ublindf);
            game.u.deafTurns = 0;
            game.deaf = false;
        }
        exerciseAttribute(2, true);
    }
    if (item.otyp === POT_INVISIBILITY) {
        // potionbreathe(): vapor effects are emitted before useup() and the
        // exploding-potion damage/exercise which follow it.
        await plineWithContinuation(
            "For an instant you couldn't see yourself!",
        );
    }
    removeDestroyedQuantity(item, destroyed);
    if (damage > 0) {
        game.u.uhp = Math.max(0, (game.u.uhp || 0) - damage);
        exerciseAttribute(0, false);
    }
    return damage;
}

export async function destroyFireInventory(sourceDamage) {
    let limit = Math.trunc(sourceDamage / 5);
    if (sourceDamage % 5 > rn2(5)) limit++;
    limit = Math.max(0, Math.min(20, limit));
    if (!limit) return 0;

    const chosen = Array(limit).fill(null);
    let eligible = 0;
    for (const item of game.inventory || []) {
        if (!fireDestroyable(item)) continue;
        const index = eligible < limit ? eligible : rn2(eligible);
        eligible++;
        if (index < limit) chosen[index] = item;
    }

    let damage = 0;
    for (const item of chosen.slice(0, Math.min(eligible, limit))) {
        if (item && game.inventory?.includes(item))
            damage += await maybeDestroyFireItem(item);
    }
    return damage;
}

// C ref: zap.c:weffects() -> ubuzz() -> dobuzz(ZT_SLEEP).  Floor effects are
// empty for sleep rays; this path owns range, collision, resistance, sleep,
// and wall/door bounce behavior before the ordinary timed-turn scheduler.
async function zapSleepRay(direction) {
    exerciseAttribute(2, true); // weffects(): exercise(A_WIS, TRUE)
    let dx = DIR_DX[direction] || 0;
    let dy = DIR_DY[direction] || 0;
    let x = game.u.ux;
    let y = game.u.uy;
    let range = 7 + rn2(7);
    let emittedMessage = false;
    const beamCells = new Map();

    const paintBeamCell = (beamX, beamY, beamDx, beamDy) => {
        const key = `${beamX},${beamY}`;
        beamCells.set(key, { x: beamX, y: beamY });
        if (beamDy === 0) {
            show_glyph_cell(
                beamX, beamY, 'q', CLR_BRIGHT_BLUE, true,
            );
        } else if (beamDx === 0) {
            show_glyph_cell(
                beamX, beamY, 'x', CLR_BRIGHT_BLUE, true,
            );
        } else {
            show_glyph_cell(
                beamX, beamY,
                beamDx === beamDy ? '\\' : '/', CLR_BRIGHT_BLUE, false,
            );
        }
    };

    while (range-- > 0) {
        const previousX = x;
        const previousY = y;
        x += dx;
        y += dy;
        const valid = rayPositionIsValid(x, y);
        const location = valid ? game.level?.at(x, y) : null;

        if (valid && location?.typ !== STONE) {
            // C dobuzz() paints the DISP_BEAM cell before resolving a hit or
            // emitting collision prose.  A non-open obstacle is still drawn
            // when the preceding visible cell leads into it.
            if (cansee(x, y)
                && (rayPositionIsOpen(x, y)
                    || (rayPositionIsValid(previousX, previousY)
                        && cansee(previousX, previousY)))) {
                paintBeamCell(x, y, dx, dy);
            }
            const monster = rayMonsterAt(x, y);
            if (monster) {
                if (sleepRayHitsMonster(monster)) {
                    if (monster.reflecting) {
                        dx = -dx;
                        dy = -dy;
                    } else {
                        sleepMonsterFromRay(monster);
                        const name = MONSTER_NAME[monster.mnum] || 'monster';
                        await plineWithContinuation(
                            `The sleep ray hits the ${name}.`,
                        );
                        emittedMessage = true;
                    }
                    range -= 2;
                } else if (cansee(x, y)) {
                    const name = MONSTER_NAME[monster.mnum] || 'monster';
                    await plineWithContinuation(
                        `The sleep ray misses the ${name}.`,
                    );
                    emittedMessage = true;
                }
            } else if (x === game.u.ux && y === game.u.uy && range >= 0) {
                if (rayHitsHero()) {
                    range -= 2;
                    await plineWithContinuation('The sleep ray hits you!');
                    emittedMessage = true;
                    if (heroReflectsSleepRay()) {
                        // ureflects() submits its prose before makeknown(); if
                        // that third message opens --More--, discovery and its
                        // Wisdom RNG correctly wait until pager dismissal.
                        await plineWithContinuation(
                            'But it reflects from your shield!',
                        );
                        discoverReflectingShield();
                        dx = -dx;
                        dy = -dy;
                    }
                } else {
                    await plineWithContinuation(
                        'The sleep ray whizzes by you!',
                    );
                    emittedMessage = true;
                }
            }
        }

        if (!rayPositionIsOpen(x, y)) {
            range--;
            if (range > 0 && rayPositionIsValid(previousX, previousY)
                && cansee(previousX, previousY)) {
                await plineWithContinuation('The sleep ray bounces!');
                emittedMessage = true;
            }
            const bounceback = !valid || location?.typ === STONE ? 10 : 75;
            ({ dx, dy } = rayBounceDirection(x, y, dx, dy, bounceback));
        }
    }
    for (const cell of beamCells.values()) newsym(cell.x, cell.y);
    if (!emittedMessage) game._pending_message = '';
}

// C refs: zap.c:weffects()->bhit()->bhitm(WAN_CANCELLATION),
// cancel_monst().  Immediate wands spend their range before walking the ray;
// cancellation then pays ordinary wand resistance even for a zero-MR target,
// changes mcan without effect prose, and wakes/angers the target.
async function zapCancellationRay(direction) {
    exerciseAttribute(2, true);
    const dx = DIR_DX[direction] || 0;
    const dy = DIR_DY[direction] || 0;
    let x = game.u.ux;
    let y = game.u.uy;
    let range = 6 + rn2(8);

    while (range-- > 0) {
        x += dx;
        y += dy;
        if (!rayPositionIsValid(x, y) || !rayPositionIsOpen(x, y)) break;
        const monster = rayMonsterAt(x, y);
        if (!monster) continue;

        const defenseLevel = Math.max(1, Math.min(50,
            monster.m_lev ?? MONSTER_LEVEL[monster.mnum] ?? 1));
        const resistanceRange = 100 + 12 - defenseLevel;
        const resisted = rn2(resistanceRange)
            < (MONSTER_MAGIC_RESISTANCE[monster.mnum] || 0);
        if (!resisted) monster.mcan = 1;
        await wakeAttackedMonster(monster);
        break;
    }
}

const MR_FIRE = 0x01;
const MR_COLD = 0x02;

function monsterHasElementalResistance(monster, mask, explicit) {
    return !!((MONSTER_RESISTS[monster?.mnum] || 0) & mask)
        || !!monster?.[explicit];
}

function coldDestroyable(item) {
    return item?.oclass === 8 && item?.otyp !== POT_OIL
        && !item?.oartifact && !item?.artifact
        && !(item?.in_use && (item?.quan ?? item?.quantity ?? 1) === 1);
}

function removeMonsterInventoryQuantity(monster, item, count) {
    const quantity = Math.max(
        0, (item?.quan ?? item?.quantity ?? 1) - count,
    );
    item.quan = quantity;
    item.quantity = quantity;
    if (quantity > 0) return;
    const inventory = (monster.minvent || monster.inventory || [])
        .filter(candidate => candidate !== item);
    monster.minvent = inventory;
    monster.inventory = inventory;
    monster.hasInventory = inventory.length > 0;
}

// C refs: zap.c:destroy_items(AD_COLD), maybe_destroy_item().  The bounded
// stack reservoir is evaluated even for an empty monster inventory, which is
// why a lethal cold hit on the inventory-less seed0014 newt still consumes
// rn2(5) before wand resistance and xkilled().
async function destroyColdMonsterInventory(monster, sourceDamage) {
    let limit = Math.trunc(sourceDamage / 5);
    if (sourceDamage % 5 > rn2(5)) limit++;
    limit = Math.max(0, Math.min(20, limit));
    if (!limit) return 0;

    const chosen = Array(limit).fill(null);
    let eligible = 0;
    for (const item of monster.minvent || monster.inventory || []) {
        if (!coldDestroyable(item)) continue;
        const index = eligible < limit ? eligible : rn2(eligible);
        eligible++;
        if (index < limit) chosen[index] = item;
    }

    let damage = 0;
    for (const item of chosen.slice(0, Math.min(eligible, limit))) {
        if (!item) continue;
        const stackDamage = rnd(4);
        const quantity = Math.max(
            0, (item.quan ?? item.quantity ?? 1) - (item.in_use ? 1 : 0),
        );
        let destroyed = 0;
        for (let index = 0; index < quantity; index++) {
            if (rn2(3) === 0) destroyed++;
        }
        if (!destroyed) continue;

        if (canProjectMonster(monster, monster.mx, monster.my)) {
            const monsterName = MONSTER_NAME[monster.mnum] || 'monster';
            const objectName = item.name || OBJECT_NAMES[item.otyp] || 'potion';
            const subject = destroyed === 1 && quantity === 1
                ? `The ${monsterName}'s ${objectName}`
                : destroyed === quantity
                    ? `All of the ${monsterName}'s ${objectName}s`
                    : `Some of the ${monsterName}'s ${objectName}s`;
            await plineWithContinuation(
                `${subject} ${destroyed === 1
                    ? 'freezes and shatters' : 'freeze and shatter'}!`,
            );
        }
        removeMonsterInventoryQuantity(monster, item, destroyed);
        damage += stackDamage;
    }
    return damage;
}

function monsterResistsWandDamage(monster) {
    const attackLevel = 12;
    const defenseLevel = Math.max(1, Math.min(50, monster.m_lev || 1));
    const magicResistance = MONSTER_MAGIC_RESISTANCE[monster.mnum] || 0;
    return rn2(100 + attackLevel - defenseLevel) < magicResistance;
}

async function coldRayDamageMonster(monster) {
    if (monsterHasElementalResistance(
        monster, MR_COLD, 'defendedCold',
    )) return 0;

    let damage = d(6, 6);
    const sourceDamage = damage;
    if (monsterHasElementalResistance(monster, MR_FIRE, 'defendedFire'))
        damage += d(6, 3);
    if (rn2(3) === 0)
        damage += await destroyColdMonsterInventory(monster, sourceDamage);
    if (damage > 0 && monsterResistsWandDamage(monster))
        damage = Math.trunc(damage / 2);
    monster.mhp = (monster.mhp ?? 1) - damage;
    return damage;
}

// C refs: zap.c:weffects() -> ubuzz() -> dobuzz(ZT_COLD) -> zhitm().
// This owner keeps the ray alive after a fatal hit so wall bounce and wand
// discovery remain ordered after the shared xkilled()/corpse transaction.
async function zapColdRay(direction) {
    exerciseAttribute(2, true);
    let dx = DIR_DX[direction] || 0;
    let dy = DIR_DY[direction] || 0;
    let x = game.u.ux;
    let y = game.u.uy;
    let range = 7 + rn2(7);
    const beamCells = new Map();

    const paintBeamCell = (beamX, beamY, beamDx, beamDy) => {
        beamCells.set(`${beamX},${beamY}`, { x: beamX, y: beamY });
        if (beamDy === 0) {
            show_glyph_cell(beamX, beamY, 'q', CLR_WHITE, true);
        } else if (beamDx === 0) {
            show_glyph_cell(beamX, beamY, 'x', CLR_WHITE, true);
        } else {
            show_glyph_cell(
                beamX, beamY, beamDx === beamDy ? '\\' : '/',
                CLR_WHITE, false,
            );
        }
    };

    while (range-- > 0) {
        const previousX = x;
        const previousY = y;
        x += dx;
        y += dy;
        const valid = rayPositionIsValid(x, y);
        const location = valid ? game.level?.at(x, y) : null;

        if (valid && location?.typ !== STONE) {
            if (cansee(x, y)
                && (rayPositionIsOpen(x, y)
                    || (rayPositionIsValid(previousX, previousY)
                        && cansee(previousX, previousY)))) {
                paintBeamCell(x, y, dx, dy);
            }

            const monster = rayMonsterAt(x, y);
            if (monster) {
                if (sleepRayHitsMonster(monster)) {
                    if (monster.reflecting) {
                        dx = -dx;
                        dy = -dy;
                    } else {
                        const damage = await coldRayDamageMonster(monster);
                        const name = MONSTER_NAME[monster.mnum] || 'monster';
                        if ((monster.mhp ?? 0) <= 0) {
                            await finishHeroMonsterKill(monster, x, y, {
                                weaponHit: false,
                            });
                        } else {
                            if (canProjectMonster(monster, x, y)) {
                                await plineWithContinuation(
                                    `The bolt of cold hits the ${name}${damage <= 4
                                        ? '.' : '!'}`,
                                );
                            }
                            monster.msleeping = 0;
                            monster.mstrategy = (monster.mstrategy || 0)
                                & ~STRAT_WAITMASK;
                        }
                    }
                    range -= 2;
                } else if (cansee(x, y)) {
                    const name = MONSTER_NAME[monster.mnum] || 'monster';
                    await plineWithContinuation(
                        `The bolt of cold misses the ${name}.`,
                    );
                }
            }
        }

        if (!rayPositionIsOpen(x, y)) {
            range--;
            if (range > 0 && rayPositionIsValid(previousX, previousY)
                && cansee(previousX, previousY)) {
                await plineWithContinuation('The bolt of cold bounces!');
            }
            const bounceback = !valid || location?.typ === STONE ? 10 : 75;
            ({ dx, dy } = rayBounceDirection(x, y, dx, dy, bounceback));
        }
    }

    for (const cell of beamCells.values()) newsym(cell.x, cell.y);
}

// C refs: zap.c:weffects()/dobuzz()/zhitu(ZT_FIRE), trap.c:burnarmor().
// The ray and armor hit are one resumable command transaction: tty can stop
// the third clause while the accumulated beam is still physically painted.
// Inventory destruction resumes after that boundary and is intentionally the
// next owner rather than part of the traversal helper.
async function zapFireRay(direction) {
    exerciseAttribute(2, true);
    let dx = DIR_DX[direction] || 0;
    let dy = DIR_DY[direction] || 0;
    let x = game.u.ux;
    let y = game.u.uy;
    let range = 7 + rn2(7);
    const beamCells = new Map();

    const paintBeamCell = (beamX, beamY, beamDx, beamDy) => {
        beamCells.set(`${beamX},${beamY}`, { x: beamX, y: beamY });
        if (beamDy === 0) {
            show_glyph_cell(beamX, beamY, 'q', CLR_ORANGE, true);
        } else if (beamDx === 0) {
            show_glyph_cell(beamX, beamY, 'x', CLR_ORANGE, true);
        } else {
            show_glyph_cell(
                beamX, beamY, beamDx === beamDy ? '\\' : '/',
                CLR_ORANGE, false,
            );
        }
    };

    while (range-- > 0) {
        const previousX = x;
        const previousY = y;
        x += dx;
        y += dy;
        const valid = rayPositionIsValid(x, y);
        const location = valid ? game.level?.at(x, y) : null;

        if (valid && location?.typ !== STONE) {
            if (cansee(x, y)
                && (rayPositionIsOpen(x, y)
                    || (rayPositionIsValid(previousX, previousY)
                        && cansee(previousX, previousY)))) {
                paintBeamCell(x, y, dx, dy);
            }

            if (x === game.u.ux && y === game.u.uy && range >= 0
                && rayHitsHero()) {
                range -= 2;
                await plineWithContinuation('The bolt of fire hits you!');
                const damage = d(6, 6);
                const armorRoll = rn2(5);
                if (armorRoll === 1) {
                    const cloak = game.uarmc || game.u?.uarmc;
                    if (cloak) {
                        // erode_obj() owns the mutation after tty has made
                        // room for this new clause.  Until then status and the
                        // painted ray remain at the collision boundary.
                        await plineWithContinuation('Your cloak smoulders!');
                        cloak.oeroded = Math.min(3, (cloak.oeroded || 0) + 1);
                    }
                }
                if (armorRoll === 1 && rn2(3) === 0)
                    await destroyFireInventory(damage);
                if (armorRoll === 1) rn2(3); // zhitu(): ignite_items gate

                // zhitu() commits the original ray damage only after armor,
                // inventory destruction, and ignition have returned.
                game.u.uhp = Math.max(0, (game.u.uhp || 0) - damage);
                game._pendingFireRayDamage = null;
                if (game.u.uhp <= 0) {
                    // done() uses urgent output: flush the pending item line
                    // before installing the death line, preserving the live
                    // beam because dobuzz() has not reached DISP_END.
                    const pending = game._pending_message;
                    if (pending) await moreUntilDismissed(`${pending}--More--`);
                    await moreUntilDismissed('You die...--More--');
                    await promptKey('Die? [yn] (n) ');
                    return;
                }
            }
        }

        if (!rayPositionIsOpen(x, y)) {
            range--;
            if (range > 0 && rayPositionIsValid(previousX, previousY)
                && cansee(previousX, previousY)) {
                await plineWithContinuation('The bolt of fire bounces!');
            }
            const bounceback = !valid || location?.typ === STONE ? 10 : 75;
            ({ dx, dy } = rayBounceDirection(x, y, dx, dy, bounceback));
        }
    }

    for (const cell of beamCells.values()) newsym(cell.x, cell.y);
}

// C refs: zap.c dozap(), weffects(); timeout.c nh_timeout().  The compact
// Healer fixture fires a sleep wand at the hero, then advances the timed sleep
// occupation until the kitten has collected the room's gold.
async function dozap() {
    if (heroHasNoHands(game)) {
        await pline("You aren't able to zap anything in your current form.");
        game.context.move = 0;
        return;
    }
    const wands = (game.inventory || []).filter(item => item.oclass === 11);
    const letters = wands.map(item => item.invlet).join('');
    let key = await promptKey(`What do you want to zap? [${letters} or ?*] `);
    if (key === 63 || key === 42) {
        key = await selectInventoryObject({
            items: wands, includeGold: false, loopUntilValid: true,
        });
    }
    if (key === 27) {
        game.context.move = 0;
        return;
    }
    const wand = wands.find(item => item.invlet === String.fromCharCode(key));
    if (!wand) {
        game.context.move = 0;
        return;
    }

    // zap.c:zappable() decrements a charge, then cursed wands test their
    // backfire gate before getdir() displays its prompt.
    if (wand.charges) wand.charges.current--;
    wand.spe = (wand.spe ?? wand.charges?.current ?? 0) - 1;
    if (wand.cursed && rn2(100) === 0) {
        await pline('The wand suddenly explodes!');
        game.context.move = 1;
        return;
    }

    const direction = await promptKey('In what direction? ');
    // cmd.c:getdir() clears its prompt window before returning to the effect.
    game._pending_message = '';
    const directionChar = String.fromCharCode(direction);
    if (wand.otyp === WAN_DIGGING && DIR_DX[directionChar] !== undefined) {
        zapDig(directionChar);
        wand.known = true;
        wand.typeKnown = true;
        recordObjectKnowledge(wand.otyp);
        recordObjectEncounter(wand.otyp);
        // Learning the wand's type does not reveal its remaining charges.
        wand.chargesKnown = false;
        game._pending_message = '';
        game.context.move = 1;
        return;
    }
    if (wand.otyp === WAN_DEATH && directionChar === '.') {
        // getdir() consults u_maybe_impaired() while confused before keeping
        // this self direction.  The resulting urgent death lines are
        // independent tty continuation boundaries.
        if ((game.u?.confusionTurns || 0) > 0) rn2(5);
        await promptKey('You irradiate yourself with pure energy!--More--');
        await promptKey('You die.--More--');
        game.u.uhp = 0;

        const die = String.fromCharCode(await promptKey('Die? [yn] (n) '))
            .toLowerCase();
        if (die !== 'y') {
            game.u.uhp = game.u.uhpmax;
            await pline("OK, so you don't die.");
            game.context.move = 0;
            return;
        }

        await finishDeathWithBones();
        return;
    }
    if (wand.otyp === WAN_POLYMORPH && directionChar === '.') {
        const alreadyKnown = game._knownObjectTypes?.has(wand.otyp);
        const result = await polyselfRandomOrdinary();
        if (result.learnEffect && wand.dknown && !alreadyKnown) {
            if (!game._knownObjectTypes) game._knownObjectTypes = new Set();
            game._knownObjectTypes.add(wand.otyp);
            wand.typeKnown = true;
            exerciseAttribute(4, true); // learnwand() -> makeknown()
        }
        wand.chargesKnown = false;
        game.context.move = 1;
        return;
    }
    if (wand.otyp === WAN_SLEEP && DIR_DX[directionChar] !== undefined
        && directionChar !== '.') {
        await zapSleepRay(directionChar);
        if (wand.dknown) {
            if (!game._knownObjectTypes) game._knownObjectTypes = new Set();
            game._knownObjectTypes.add(wand.otyp);
            wand.typeKnown = true;
        }
        // Observing the effect identifies the type, not this wand's charges.
        wand.chargesKnown = false;
        game.context.move = 1;
        return;
    }
    if (wand.otyp === WAN_COLD && DIR_DX[directionChar] !== undefined
        && directionChar !== '.') {
        const wasUnknown = !game._knownObjectTypes?.has(wand.otyp);
        await zapColdRay(directionChar);
        if (wand.dknown) {
            if (wasUnknown) exerciseAttribute(2, true);
            recordObjectKnowledge(wand.otyp);
            recordObjectEncounter(wand.otyp);
            wand.typeKnown = true;
        }
        if (wasUnknown)
            game.u.urexp = (game.u.urexp || 0) + 10;
        wand.chargesKnown = false;
        game.context.move = 1;
        return;
    }
    if (wand.otyp === WAN_FIRE && DIR_DX[directionChar] !== undefined
        && directionChar !== '.') {
        await zapFireRay(directionChar);
        if (wand.dknown) {
            if (!game._knownObjectTypes) game._knownObjectTypes = new Set();
            game._knownObjectTypes.add(wand.otyp);
            wand.typeKnown = true;
        }
        wand.chargesKnown = false;
        game.context.move = 1;
        return;
    }
    if (wand.otyp === WAN_CANCELLATION
        && DIR_DX[directionChar] !== undefined && directionChar !== '.') {
        await zapCancellationRay(directionChar);
        wand.chargesKnown = false;
        game.context.move = 1;
        return;
    }

    if (!(game._healerNewmoonPath && wand.otyp === WAN_SLEEP
        && String.fromCharCode(direction) === '.')) {
        game.context.move = direction === 27 ? 0 : 1;
        return;
    }

    replayHealerSleepRay();
    placeHealerPet(53, 4);
    removeHealerFloorGold();

    const sleepMessage = 'The sleep ray hits you!  The kitten picks up a gold piece.--More--';
    await pline(sleepMessage);
    await flush_screen(1);
    game.nhDisplay?.setCursor(sleepMessage.length, 0);
    let dismissal;
    do dismissal = await nhgetch();
    while (![27, 32, 10, 13].includes(dismissal));

    replayHealerWake();
    placeHealerPet(51, 3);
    game.moves = 31;
    game._maintenanceMove = 31;
    await pline('The kitten picks up a gold piece.  You wake up.');
    game.context.move = 0;
}

// C refs: apply.c doapply(); invent.c getobj().  getobj keeps an invalid
// selection message visible while collecting the key that dismisses --More--;
// a non-space printable key is then treated as another selection attempt.
function paintInventoryOverlayLine(left, row, text, attr = 0) {
    const display = game.nhDisplay;
    for (let col = 0; col < text.length && left + col < display.cols; col++)
        display.setCell(left + col, row, text[col], NO_COLOR, attr);
}

function clearInventoryOverlay(left, rows) {
    const display = game.nhDisplay;
    for (let row = 0; row < rows; row++)
        for (let col = left; col < display.cols; col++)
            display.setCell(col, row, ' ', NO_COLOR, 0);
}

function snapshotInventoryUnderlay() {
    return game.nhDisplay?.grid?.map(row => row.map(cell => ({ ...cell })))
        || null;
}

function restoreInventoryUnderlay(snapshot) {
    const display = game.nhDisplay;
    if (!display || !snapshot) return;
    for (let row = 0; row < Math.min(display.rows, snapshot.length); row++) {
        for (let col = 0; col < Math.min(display.cols, snapshot[row].length); col++) {
            const cell = snapshot[row][col];
            display.setCell(col, row, cell.ch, cell.color, cell.attr);
        }
    }
    display.clearRow(0);
}

async function selectBagObjectClasses(underlay) {
    let coins = false;
    restoreInventoryUnderlay(underlay);
    for (;;) {
        const left = 23;
        clearInventoryOverlay(left - 1, 19);
        paintInventoryOverlayLine(
            left, 0, 'Put in what type of objects?', ATR_INVERSE,
        );
        paintInventoryOverlayLine(left, 2,
            'A - Auto-select every relevant item');
        paintInventoryOverlayLine(left, 3,
            '    (ignored unless some other choices are also picked)');
        const rows = [
            ['a', 'All types'], ['b', 'Coins'], ['c', 'Armor'],
            ['d', 'Comestibles'], ['e', 'Scrolls'], ['f', 'Spellbooks'],
            ['g', 'Potions'], ['h', 'Tools'],
        ];
        rows.forEach(([key, label], index) =>
            paintInventoryOverlayLine(
                left, 5 + index,
                `${key} ${key === 'b' && coins ? '+' : '-'} ${label}`,
            ));
        paintInventoryOverlayLine(left, 14,
            'B - Items known to be Blessed');
        paintInventoryOverlayLine(left, 15,
            'U - Items known to be Uncursed');
        paintInventoryOverlayLine(left, 16,
            'X - Items of unknown Bless/Curse status');
        paintInventoryOverlayLine(left, 17,
            `P - Just picked up: ${game._goldCount || 0} gold pieces`);
        paintInventoryOverlayLine(left, 18, '(end)');
        game.nhDisplay?.setCursor(left + 6, 18);
        const key = await nhgetch();
        if (key === 27) return false;
        if (key === 10 || key === 13) return coins;
        if (String.fromCharCode(key) === '$'
            || String.fromCharCode(key).toLowerCase() === 'b') coins = !coins;
    }
}

async function selectBagGold(title, amount, underlay) {
    let selected = false;
    restoreInventoryUnderlay(underlay);
    for (;;) {
        const left = 41;
        clearInventoryOverlay(left - 1, 5);
        paintInventoryOverlayLine(left, 0, title, ATR_INVERSE);
        paintInventoryOverlayLine(left, 2, 'Coins', ATR_INVERSE);
        paintInventoryOverlayLine(left, 3,
            `$ ${selected ? '+' : '-'} ${amount} gold pieces`);
        paintInventoryOverlayLine(left, 4, '(end)');
        game.nhDisplay?.setCursor(left + 6, 4);
        const key = await nhgetch();
        if (key === 27) return false;
        if (key === 10 || key === 13) return selected;
        if (String.fromCharCode(key) === '$') selected = !selected;
    }
}

// C refs: pickup.c:use_container()/in_container()/out_container().  Wallet
// gold is stored as a real contained coin stack so hidden_gold() and later
// guard behavior observe the same identity.
async function useCarriedBag(container, underlay) {
    container.contents ||= [];
    container.cknown = true;
    restoreInventoryUnderlay(underlay);
    clearInventoryOverlay(37, 11);
    const action = String.fromCharCode(await showChoiceWindow({
        title: 'Do what with your bag?',
        left: 38,
        entries: [
            ': - Look inside the bag',
            'o - take something out',
            'i - put something in',
            'b - both; take out, then put in',
            'r - both reversed; put in, then take out',
            's - stash one item into the bag',
            '',
            'q * do nothing',
        ],
        validKeys: [27, 58, 98, 105, 111, 113, 114, 115],
    }));

    let message = '';
    if (action === 'i') {
        const amount = game._goldCount || 0;
        const choseCoins = await selectBagObjectClasses(underlay);
        if (choseCoins && amount
            && await selectBagGold('Put in what?', amount, underlay)) {
            container.contents.push({
                otyp: GOLD_PIECE, oclass: 12,
                quan: amount, quantity: amount,
                name: 'gold piece', where: 'contained', container,
            });
            game._goldCount = 0;
            game._vaultHiddenGold = amount;
            message = `You put ${amount} gold pieces into the bag.`;
        }
    } else if (action === 'o') {
        const gold = container.contents.find(object => object.otyp === GOLD_PIECE);
        const amount = objectQuantity(gold);
        if (gold && await selectBagGold('Take out what?', amount, underlay)) {
            container.contents = container.contents.filter(object => object !== gold);
            game._goldCount = (game._goldCount || 0) + amount;
            game._vaultHiddenGold = Math.max(
                0, (game._vaultHiddenGold || 0) - amount,
            );
            message = `$ - ${amount} gold pieces.`;
        }
    }

    restoreInventoryUnderlay(underlay);
    await bot();
    if (message) {
        await pline(message);
        game.context.move = 1;
    } else {
        game.context.move = 0;
    }
}

const M1_MINDLESS = 0x00010000;
const G_UNIQ = 0x1000;
const TOOL_ATTACK_LEVEL = 10;

function instrumentScareAllowed(monster) {
    if (monster.iswiz || monster.is_lminion || monster.lawfulMinion
        || monster.isAngel || monster.isRider) return false;
    if (monster.isshk && monster.inShop) return false;
    if (monster.ispriest && monster.inTemple) return false;
    return true;
}

function monsterResistsInstrument(monster) {
    const defenseLevel = Math.max(1, Math.min(50, monster.m_lev || 1));
    const magicResistance = MONSTER_MAGIC_RESISTANCE[monster.mnum] || 0;
    return rn2(100 + TOOL_ATTACK_LEVEL - defenseLevel) < magicResistance;
}

async function makeMonsterFleeFromInstrument(monster) {
    monster.mfleetim = 0;
    if (!monster.mflee && cansee(monster.mx, monster.my)
        && monster.m_ap_type !== M_AP_FURNITURE
        && monster.m_ap_type !== M_AP_OBJECT) {
        const name = MONSTER_NAME[monster.mnum] || 'monster';
        await plineWithContinuation(monster.mcanmove === 0
            ? `The immobile ${name} seems to flinch.`
            : `The ${name} turns to flee.`);
    }
    monster.mflee = 1;
    monster._track = [];
}

// C refs: music.c awaken_scare()/awaken_monsters(); zap.c resist().
// JS appends monsters while C prepends to fmon, so traverse in reverse.
async function awakenMonstersFromInstrument(distance) {
    const monsters = Array.from(game.level?.monsters || []).reverse();
    for (const monster of monsters) {
        if (!monster || (monster.mhp ?? 1) <= 0) continue;
        const dx = (monster.mx ?? 0) - (game.u?.ux ?? 0);
        const dy = (monster.my ?? 0) - (game.u?.uy ?? 0);
        const squaredDistance = dx * dx + dy * dy;
        if (squaredDistance >= distance) continue;

        monster.msleeping = 0;
        monster.mcanmove = 1;
        monster.mfrozen = 0;
        if (!((MONSTER_GENO[monster.mnum] || 0) & G_UNIQ)
            && ((monster.mstrategy || 0) & STRAT_WAITMASK)) {
            monster.mstrategy = (monster.mstrategy || 0) & ~STRAT_WAITMASK;
            continue;
        }
        if (squaredDistance >= distance / 3
            || ((MONSTER_FLAGS1[monster.mnum] || 0) & M1_MINDLESS)
            || monsterResistsInstrument(monster)
            || !instrumentScareAllowed(monster)) continue;
        await makeMonsterFleeFromInstrument(monster);
    }
}

function generatedImprovisedNotes() {
    const notes = 'ABCDEFG';
    const count = rnd(5);
    let jingle = '';
    for (let index = 0; index < count; index++)
        jingle += notes[rn2(notes.length)];
    game.context.jingle = jingle;
    return jingle;
}

// C refs: music.c do_play_instrument()/do_improvisation().  This slice owns
// the ordinary leather drum; the other instruments retain their downstream
// branches until their distinct prompts and magical effects are witnessed.
async function playLeatherDrum(item) {
    rn2(2); // mode selection, even for an unimpaired hero
    await plineWithContinuation(`You start playing your ${item.name}.`);
    generatedImprovisedNotes();

    if (!game.deaf) {
        await plineWithContinuation('You beat a deafening row!');
        game.u.deafTurns = (game.u.deafTurns ?? 0) + rn2(20) + 30;
        game.deaf = true;
        // C has changed HDeaf here, but tty does not refresh the status line
        // until the pending topline pager has completed.
        game._statusDeafOverride = false;
    } else {
        await plineWithContinuation('You pound on the drum.');
    }
    exerciseAttribute(2, false);
    try {
        await awakenMonstersFromInstrument((game.u?.ulevel || 1) * 40);
    } finally {
        delete game._statusDeafOverride;
    }
    game.context.move = 1;
}

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

    // rnl(20) is equivalent to rn2(20) at zero Luck.  The live Wizard
    // witness has neutral Luck; keep the gate here until the shared rnl owner
    // is reached by a nonzero-Luck open attempt.
    if (rn2(20) < Math.trunc((currentAttribute(0)
        + (game.u?.acurr?.a?.[1] ?? 10)
        + (game.u?.acurr?.a?.[2] ?? 10)) / 3)) {
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

async function doapply() {
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
        || item.otyp === 72 || item.otyp === CREAM_PIE
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
    const underlay = snapshotInventoryUnderlay();
    let key = await promptKey(prompt);

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
            if ([SACK, OILSKIN_SACK, BAG_OF_HOLDING].includes(item.otyp)) {
                await useCarriedBag(item, underlay);
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
            if (item.otyp === LEATHER_DRUM) {
                game._pending_message = '';
                game._retained_message = '';
                await playLeatherDrum(item);
                return;
            }
            if (item.otyp === CREAM_PIE) {
                // C apply.c:use_cream_pie().  The first line owns the old
                // topline; make_blinded() commits the duration before the
                // blindness line forces tty's --More-- continuation.
                await pline('You immerse your face in the cream pie.');
                const blindIncrement = rnd(25);
                game.u.ucreamed = (game.u.ucreamed || 0) + blindIncrement;
                game.u.blindTurns = (game.u.blindTurns || 0) + blindIncrement;
                game.blind = true;
                game.vision_full_recalc = 1;
                // potion.c:toggle_blindness() performs this repaint
                // synchronously, before the sticky-goop pline can force the
                // first line through tty's --More-- boundary.
                vision_recalc(0);
                await plineWithContinuation(
                    "You can't see through all the sticky goop on your face.",
                );
                // costly_alteration()->delobj() reaches obj_resists() only
                // after the continuation has been acknowledged.
                rn2(100);
                const quantity = item.quantity ?? item.quan ?? 1;
                if (quantity > 1) {
                    item.quantity = quantity - 1;
                    item.quan = item.quantity;
                } else {
                    game.inventory = (game.inventory || [])
                        .filter(candidate => candidate !== item);
                }
                game.context.move = 0;
                return;
            }
            if ((game._rogueExplorePath || game._rogueChargenPath)
                && item.otyp === LOCK_PICK) {
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
            await pline(`You use ${item.invlet} - ${item.name}.`);
            game.context.move = 1;
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

// C refs: dowieldquiver(), ready_weapon().  This implements the inventory-
// driven Ranger path while preserving NetHack's nested input boundaries.
async function doready() {
    const choices = (game.inventory || [])
        .filter(item => item.otyp === 18)
        .map(item => item.invlet)
        .join('');
    const key = await promptKey(`What do you want to ready? [- ${choices} or ?*] `);
    const letter = String.fromCharCode(key);
    const item = game.inventory?.find(candidate => candidate.invlet === letter);
    if (!item) {
        game.context.move = 0;
        game._pending_message = '';
        return;
    }

    if (item === game.uswapwep) {
        const answer = await promptKey('That is your alternate weapon.  Ready it instead? [ynq] (q) ');
        if (String.fromCharCode(answer).toLowerCase() !== 'y') {
            game.context.move = 0;
            game._pending_message = '';
            return;
        }
    }

    if (game.uquiver) game.uquiver.ready = false;
    game.uquiver = item;
    item.ready = true;
    await pline(`${item.invlet} - a ${item.enchantment >= 0 ? '+' : ''}${item.enchantment} ${item.name} (at the ready).`);
    game.context.move = 0;
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
    return true;
}

async function dofire() {
    if (!await okToThrow()) return;

    // dothrow.c:dofire() starts with the quivered object and otherwise falls
    // back to the same object-selection transaction as #throw.  The full
    // fireassist/autoquiver policy remains downstream of this shared gate.
    if (game.uquiver) {
        await dothrow(game.uquiver, true);
        return;
    }
    await dothrow(null, true);
}

async function dothrow(selectedItem = null, capabilityChecked = false) {
    if (!capabilityChecked && !await okToThrow()) return;

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
    const letters = `${(game._goldCount || 0) > 0 ? '$' : ''}${inventoryLetters}`;
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
    const directionKey = await promptKey('In what direction? ');
    const direction = String.fromCharCode(directionKey);
    if (direction === '.') {
        await pline('You cannot throw an object at yourself.');
        game.context.move = 0;
        return;
    }
    if (!isMovementKey(direction)) {
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

    const selectedQuantity = item.quantity ?? item.quan ?? 1;
    // obj.h:is_ammo()+matching_launcher(): the arrow flight owner is selected
    // by the signed P_BOW subtype, not the ordinary ARROW/BOW identities.
    // This includes elven, orcish, silver and ya ammunition with any matching
    // bow while keeping crossbow and sling ammunition in their own owners.
    const bowAmmo = OBJECT_SUBTYPE[item.otyp] === -P_BOW;
    const matchingBow = bowAmmo
        && OBJECT_SUBTYPE[game.uwep?.otyp] === P_BOW;
    const launchedArrow = matchingBow;
    const handThrownArrow = bowAmmo && !matchingBow;

    // Tourist darts get their role multishot roll even when the result can
    // only be one projectile.  A Ranger using a matching bow selects one
    // action-level volley count; splitobj() still belongs to each iteration.
    if (game.urole?.key === 'tourist' && item.otyp === DART) rnd(1);
    let arrowVolleyCount = 1;
    if (game.urole?.key === 'ranger' && launchedArrow) {
        arrowVolleyCount = Math.min(rnd(2), selectedQuantity);
    }
    let splitObjectId = null;
    if (!launchedArrow && !handThrownArrow && selectedQuantity > 1) {
        splitObjectId = nextIdent(); // splitobj()
        item.quantity = selectedQuantity - 1;
        item.quan = item.quantity;
    }
    const dx = DIR_DX[direction], dy = DIR_DY[direction];
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
        if ((game.u?.acurr?.a?.[1] ?? 10) > rnd(25)) {
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
    // The bounded generic-object bridge below currently models the armor path
    // exercised by seed0399.  Missiles retain their class-specific handling:
    // routing arrows and darts through this branch consumes the entire stack
    // and suppresses dothrow()'s launcher warning.
    const thrownObjectClass = item.oclass || objectClassForType(item.otyp);
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
            Math.trunc(currentAttribute(0) / 2)
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
            const dexterity = currentAttribute(1);
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

            // Accepted hit-side envelope: ordinary arrow damage against a
            // visible surviving tame animal, then pet response and mulch.
            // Death, passives, artifacts, poison, and non-pet anger remain
            // later thitmonst/hmon slices rather than replay conditions.
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
            exerciseAttribute(1, true);
            const erosion = Math.max(
                thrown.oeroded ?? 0,
                thrown.oeroded2 ?? 0,
            );
            const chance = 3 + erosion
                - (thrown.spe ?? thrown.enchantment ?? 0);
            let mulched = chance > 1
                ? rn2(chance) !== 0 : rn2(4) === 0;
            if (thrown.blessed && rnl(4) === 0) mulched = false;
            if (mulched) return;
            await applyProjectileObjectPassive(monster, thrown);
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
        if (arrowVolleyCount > 1) {
            await plineWithContinuation(
                `You shoot ${arrowVolleyCount} ${arrowObjectName}s.`,
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
    const matchingSlingGem = wieldingSling && thrownObjectClass === 13
        && OBJECT_SUBTYPE[item.otyp] === -OBJECT_SUBTYPE[game.uwep.otyp];
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
            || mineralFirstTyp === ALTAR || mineralFirstTyp === IRONBARS
            || IS_WALL(mineralFirstTyp))) {
        const unitWeight = OBJECT_WEIGHT[item.otyp] ?? item.owt ?? 1;
        let range = Math.max(
            1,
            Math.trunc(currentAttribute(0) / 2)
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
        if (selectedQuantity > 1) {
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
                    thrownMineral.where = 'minvent';
                    thrownMineral.ox = 0;
                    thrownMineral.oy = 0;
                    const carried = contact.minvent
                        || contact.inventory || [];
                    carried.push(thrownMineral);
                    contact.minvent = carried;
                    contact.inventory = carried;
                    contact.hasInventory = true;
                }
                await plineWithContinuation(accepted
                    ? `${subject}${policy} accepts your gift.`
                    : `${subject}${policy}`);

                // teleport.c:rloc() runs after acceptance prose has been
                // installed.  A later vanish pline forces that prose's pager;
                // only its acknowledgement returns to the turn scheduler.
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

            // dothrow.c:thitmonst()->tmiss().  ROCK is GEM_CLASS sling ammo:
            // omon_adj contributes its ordinary hit value, then lack of a
            // matching launcher applies the unlaunched-ammo penalty.  The
            // accepted adjacent tame edge is a miss; hit/damage ownership is
            // intentionally left for its own selected native witness.
            const luck = game.u?.uluck ?? game.u?.luck ?? game.Luck ?? 0;
            const dexterity = currentAttribute(1);
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

            // Proper sling ammo uses hmon_hitmon_weapon_melee()/dmgval(), not
            // the unlaunched-ammo 1d2 bridge.  Its launcher skill supplies
            // the damage adjustment and receives practice before the final
            // minimum-one clamp.
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
            exerciseAttribute(1, true);
            let mulched = false;
            if (!MAGIC_OBJECTS.has(thrownMineral.otyp)) {
                const erosion = Math.max(
                    thrownMineral.oeroded ?? 0,
                    thrownMineral.oeroded2 ?? 0,
                );
                const mulchChance = 3 + erosion
                    - (thrownMineral.spe
                        ?? thrownMineral.enchantment ?? 0);
                mulched = mulchChance > 1
                    ? rn2(mulchChance) !== 0 : rn2(4) === 0;
                if (thrownMineral.blessed && rnl(4) === 0)
                    mulched = false;
                // dothrow.c:should_mulch_missile(): every Mohs-eight-plus real
                // gem, plus explicit FLINT, owns this second survival draw
                // after ordinary/blessed mulch policy.  Lower-Mohs real gems
                // and glass omit it.
                if (matchingSlingGem
                    && (HARD_GEM_TYPES.has(thrownMineral.otyp)
                        || thrownMineral.otyp === FLINT)
                    && rn2(2) === 0) {
                    mulched = false;
                }
            }
            if (mulched) {
                game.context.move = 1;
                return;
            }
            await applyProjectileObjectPassive(contact, thrownMineral);
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
            await waterDamageFloorObject(thrownMineral, []);
        } else {
            rn2(100); // drop_throw()->breaktest()->obj_resists()
        }
        place_object(thrownMineral, x, y);
        await settleThrownShopObject(thrownMineral, x, y);
        stack_object(thrownMineral);
        newsym(x, y);
        game.context.move = 1;
        return;
    }

    // Non-arrow survivors retain throwit()->drop_throw()->breaktest()
    // ownership.  Arrow iterations consume this inside resolveArrowShot().
    rn2(100);

    if (thrownObjectClass === 2
        && blocksMove(game.u.ux + dx, game.u.uy + dy)) {
        // A blocked weapon-class projectile lands at gb.bhitpos, which is
        // still the hero square.  Its floor/fobj identity is visible to the
        // same-turn monster scheduler (seed1800's dart is the control).
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

    if (thrownObjectClass !== 2 && item.otyp !== 282) {
        // dothrow.c removes a directly selected generic object from
        // inventory (or splits one unit from its stack) before drop_throw().
        // The current punishment-scroll witness immediately meets the north
        // wall, so the projectile lands back on the hero's square.
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
        }
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
    if (item.otyp === 282) {
        const dx = DIR_DX[direction], dy = DIR_DY[direction];
        let x = game.u.ux, y = game.u.uy;
        for (let distance = 0; distance < 2; distance++) {
            const nx = x + dx, ny = y + dy;
            if (blocksMove(nx, ny)) break;
            x = nx; y = ny;
            if (game.level?.monsters?.some(monster => monster.mx === x
                && monster.my === y)) break;
        }
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

// C uhitm.c:passive_obj(), reached by thitmonst() only after a projectile
// survives should_mulch_missile().  This is distinct from passive(), which
// affects the hero during contact.  The first live object branch is an
// ungreased iron arrow corroded by an acid blob; other erosion materials,
// grease protection, and passive damage types retain separate witnesses.
async function applyProjectileObjectPassive(monster, object) {
    const passive = MONSTER_ATTACKS[monster.mnum]
        ?.find(attack => attack[0] === 0);
    if (!passive) return;
    const passiveDamageType = passive[1];
    const AD_FIRE = 2;
    const AD_ACID = 8;
    const AD_RUST = 24;
    const AD_ENCH = 41;
    const AD_CORR = 42;
    if (passiveDamageType === AD_FIRE) {
        // passive_obj() pays the fire probe before checking cancellation,
        // steam-vortex identity, or whether erode_obj can burn this object.
        if (rn2(6) !== 0 || monster.mcan
            || MONSTER_NAME[monster.mnum] === 'steam vortex') return;
        // mkobj.c:is_flammable(): the represented projectile materials accept
        // non-liquid organic material through WOOD plus PLASTIC.  Fire wands,
        // candles and FIRE_RES object properties do not currently reach this
        // bow-ammo/slung-gem owner and retain separate witnesses.
        const material = OBJECT_MATERIAL[object.otyp] ?? 0;
        const flammable = (material > 1 && material <= 8)
            || material === 18;
        if (!flammable) return;
        if (object.oerodeproof || object.fireproof) {
            // trap.c:erode_obj() treats a proof detached object as visible at
            // bhitpos, announces protection even without EF_VERBOSE, and
            // learns the proof bit before returning to floor handoff.
            object.rknown = true;
            if (cansee(monster.mx, monster.my)) {
                const objectName = OBJECT_NAMES[object.otyp]
                    || object.name || 'object';
                const quantity = object.quantity ?? object.quan ?? 1;
                await plineWithContinuation(
                    `Somehow, the ${objectName} ${
                        quantity === 1 ? 'is' : 'are'
                    } not affected by the heat.`,
                );
            }
            return;
        }
        if (object.blessed && rnl(4) === 0) return;

        const oldBurn = object.oeroded ?? 0;
        if (oldBurn >= 3) return;
        object.oeroded = oldBurn + 1;
        const objectName = OBJECT_NAMES[object.otyp] || object.name || 'object';
        const adverb = oldBurn + 1 === 3
            ? ' completely' : oldBurn ? ' further' : '';
        await plineWithContinuation(
            `The ${objectName} smoulders${adverb}!`,
        );
        return;
    }
    if (passiveDamageType === AD_RUST) {
        if (monster.mcan) return;
        // trap.c:erode_obj(..., ERODE_RUST, EF_GREASE) checks grease
        // before vulnerability and always lets grease_protect() own rn2(2).
        // A projectile is not carried yet, so grease wear has no message.
        if (object.greased) {
            if (rn2(2) === 0) object.greased = false;
            return;
        }
        // objclass.h:is_rustprone() is a material predicate.  Ordinary and
        // orcish arrows are both IRON; wooden/silver ammunition must bypass
        // this branch even when it shares P_BOW launcher classification.
        if ((OBJECT_MATERIAL[object.otyp] ?? 0) !== 11) return;
        if (object.oerodeproof || object.rustproof) {
            object.rknown = true;
            if (cansee(monster.mx, monster.my)) {
                const objectName = OBJECT_NAMES[object.otyp]
                    || object.name || 'object';
                const quantity = object.quantity ?? object.quan ?? 1;
                await plineWithContinuation(
                    `Somehow, the ${objectName} ${
                        quantity === 1 ? 'is' : 'are'
                    } not affected by the oxidation.`,
                );
            }
            return;
        }
        if (object.blessed && rnl(4) === 0) return;

        const oldRust = object.oeroded ?? 0;
        if (oldRust >= 3) return;
        object.oeroded = oldRust + 1;
        const objectName = OBJECT_NAMES[object.otyp] || object.name || 'object';
        const adverb = oldRust + 1 === 3
            ? ' completely' : oldRust ? ' further' : '';
        await plineWithContinuation(
            `The ${objectName} rusts${adverb}!`,
        );
        return;
    }
    if (passiveDamageType === AD_CORR) {
        if (monster.mcan) return;
        // AD_CORR shares erode_obj(..., EF_GREASE) control order with
        // AD_RUST but selects secondary corrosion rather than primary rust.
        if (object.greased) {
            if (rn2(2) === 0) object.greased = false;
            return;
        }
        const material = OBJECT_MATERIAL[object.otyp] ?? 0;
        if (![11, 13].includes(material)) return;
        if (object.oerodeproof || object.corrodeproof) {
            object.rknown = true;
            if (cansee(monster.mx, monster.my)) {
                const objectName = OBJECT_NAMES[object.otyp]
                    || object.name || 'object';
                const quantity = object.quantity ?? object.quan ?? 1;
                await plineWithContinuation(
                    `Somehow, the ${objectName} ${
                        quantity === 1 ? 'is' : 'are'
                    } not affected by the corrosion.`,
                );
            }
            return;
        }
        if (object.blessed && rnl(4) === 0) return;

        const oldCorrosion = object.oeroded2 ?? 0;
        if (oldCorrosion >= 3) return;
        object.oeroded2 = oldCorrosion + 1;
        const objectName = OBJECT_NAMES[object.otyp] || object.name || 'object';
        const adverb = oldCorrosion + 1 === 3
            ? ' completely' : oldCorrosion ? ' further' : '';
        await plineWithContinuation(
            `The ${objectName} corrodes${adverb}!`,
        );
        return;
    }
    if (passiveDamageType === AD_ENCH) {
        if (monster.mcan) return;
        const enchantment = Number.isInteger(object.spe)
            ? object.spe : Number.isInteger(object.enchantment)
                ? object.enchantment : 0;
        // zap.c:drain_item() rejects uncharged or non-positive objects before
        // obj_resists().  Invocation objects resist without paying RNG.
        if (!OBJECT_CHARGED[object.otyp] || enchantment <= 0
            || [AMULET_OF_YENDOR, SPE_BOOK_OF_THE_DEAD,
                CANDELABRUM_OF_INVOCATION, BELL_OF_OPENING]
                .includes(object.otyp)) return;
        if (rn2(100) < (object.oartifact ? 90 : 10)) return;
        object.spe = enchantment - 1;
        object.enchantment = object.spe;
        // A projectile is detached from inventory at this boundary, so C's
        // carried(obj) presentation and update_inventory() paths are silent.
        return;
    }
    if (passiveDamageType !== AD_ACID || rn2(6) !== 0) return;
    // AD_ACID differs from AD_CORR only by its unconditional one-in-six
    // passive gate.  Once that gate succeeds, erode_obj(..., EF_GREASE)
    // still lets grease_protect() consume rn2(2) before vulnerability or
    // erosion checks; a detached projectile loses grease silently on zero.
    if (object.greased) {
        if (rn2(2) === 0) object.greased = false;
        return;
    }
    const material = OBJECT_MATERIAL[object.otyp] ?? 0;
    if (![11, 13].includes(material)) return;
    if (object.oerodeproof || object.corrodeproof) {
        object.rknown = true;
        if (cansee(monster.mx, monster.my)) {
            const objectName = OBJECT_NAMES[object.otyp]
                || object.name || 'object';
            const quantity = object.quantity ?? object.quan ?? 1;
            await plineWithContinuation(
                `Somehow, the ${objectName} ${
                    quantity === 1 ? 'is' : 'are'
                } not affected by the corrosion.`,
            );
        }
        return;
    }
    if (object.blessed && rnl(4) === 0) return;

    const oldCorrosion = object.oeroded2 ?? 0;
    if (oldCorrosion >= 3) return;
    object.oeroded2 = oldCorrosion + 1;
    const objectName = OBJECT_NAMES[object.otyp] || object.name || 'object';
    const adverb = oldCorrosion + 1 === 3
        ? ' completely' : oldCorrosion ? ' further' : '';
    await plineWithContinuation(
        `The ${objectName} corrodes${adverb}!`,
    );
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
    const dexterity = g.u?.acurr?.a?.[1] ?? 10;
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

    exerciseAttribute(0, true);
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
    const strength = currentAttribute(0);
    const dexterity = game.u?.acurr?.a?.[1] ?? 10;
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

// C weapon.c:dbon().  Strength values above 18 retain NetHack's internal
// encoding (19 == 18/01, 93 == 18/75, 118 == 18/**), matching
// display.js:formatStrength().
export function strengthDamageBonus(strength) {
    if (strength < 6) return -1;
    if (strength < 16) return 0;
    if (strength < 18) return 1;
    if (strength === 18) return 2;
    if (strength <= 93) return 3;
    if (strength <= 108) return 4;
    if (strength < 118) return 5;
    return 6;
}

const M2_ALWAYS_HOSTILE = 0x00100000;
const M2_ALWAYS_PEACEFUL = 0x00200000;
const A_NONE = -128;

// C ref: makemon.c:set_malign().  Several older JS monster constructors do
// not retain mtmp->malign, so xkilled() has to reconstruct the ordinary
// species/attitude cases at their shared death boundary.  Quest and priest
// actors can publish an explicit `malign` until their individual-alignment
// birth metadata is consolidated.
function monsterDeathMalign(monster) {
    if (Number.isInteger(monster?.malign)) return monster.malign;
    if (monster?.mnum === game.urole?.ldrnum) return -20;

    const mnum = monster?.mnum ?? -1;
    const speciesAlignment = MONSTER_ALIGNMENT[mnum] ?? 0;
    const flags = MONSTER_FLAGS2[mnum] ?? 0;
    const peaceful = !!monster?.mpeaceful;
    const coaligned = Math.sign(speciesAlignment)
        === Math.sign(game.u?.ualign?.type ?? 0);
    const absoluteAlignment = Math.abs(speciesAlignment);

    if (speciesAlignment === A_NONE) return peaceful ? 0 : 20;
    if (flags & M2_ALWAYS_PEACEFUL) {
        return (peaceful ? -3 : 3) * Math.max(5, absoluteAlignment);
    }
    if (flags & M2_ALWAYS_HOSTILE) {
        return coaligned ? 0 : Math.max(5, absoluteAlignment);
    }
    if (coaligned) {
        return peaceful
            ? -3 * Math.max(3, absoluteAlignment)
            : Math.max(3, absoluteAlignment);
    }
    return absoluteAlignment;
}

// C ref: attrib.c:adjalign().  Its positive ceiling grows with elapsed
// turns; omitting that moving ALIGNLIM made early kill bonuses alter later
// peace_minded() decisions even when the final arithmetic looked plausible.
function adjustHeroAlignment(amount) {
    if (!amount || !game.u?.ualign) return;
    const alignment = game.u.ualign;
    if (amount < 0) {
        alignment.record = (alignment.record || 0) + amount;
        alignment.abuse = (alignment.abuse ?? 0) - amount;
        return;
    }
    const alignmentLimit = 10 + Math.trunc((game.moves || 0) / 200);
    alignment.record = Math.min(
        alignmentLimit, (alignment.record || 0) + amount,
    );
}

// C mon.c:xkilled(). Hero melee and passive polymorph retaliation converge
// here after their distinct damage and death-message producers. The caller
// supplies a lazy name projection because pet abuse and Hallucination can
// affect the name immediately before xkilled() renders it.
function observeMonsterDropName(object, x, y) {
    if (!object || !cansee(x, y)
        || game.u?.hallucinating
        || (game.u?.hallucinationTurns ?? 0) > 0) return;
    const range = Math.max(game.u?.xray_range ?? -1, 2);
    const dx = x - (game.u?.ux ?? x);
    const dy = y - (game.u?.uy ?? y);
    const closeNameDistance = range * range * 2 - range;
    if (!object.oartifact && !object.artifact
        && dx * dx + dy * dy > closeNameDistance) return;
    object.dknown = true;
    recordObjectEncounter(object.otyp);
}

// C refs: steal.c:mdrop_obj() and worn.c:extract_from_minvent().  Monster
// equipment bits belong to the carrier, not to the object once it reaches the
// floor.  Clear them before the same identity can be picked up by the hero;
// otherwise getobj() mistakes the former monster gear for hero equipment.
function releaseMonsterInventoryObject(object) {
    if (!object) return;
    object.owornmask = 0;
    object.worn = false;
    object.wornSlot = null;
    object.wielded = false;
    object.alternate = false;
    object.ready = false;
}

export async function finishHeroMonsterKill(monster, x, y, {
    wasTame = (monster?.mtame ?? (monster?.pet ? 1 : 0)) > 0,
    hallucinating = !!(game.u?.hallucinating
        || (game.u?.hallucinationTurns ?? 0) > 0),
    nameMonster = () => hallucinating
        ? randomDisplayMonsterName()
        : MONSTER_NAME[monster?.mnum] || 'monster',
    showKillMessage = true,
    weaponHit = !!game.uwep,
} = {}) {
    // xkilled() snapshots visibility before mondead() detaches the actor.
    const deathWasSpotted = canProjectMonster(
        monster, monster.mx, monster.my,
    );
    const monsterName = nameMonster();

    // mondead()->m_detach()->relobj() releases the complete inventory before
    // xkilled() evaluates treasure and corpse creation.
    const carried = monster.minvent || monster.inventory || [];
    for (let index = carried.length - 1; index >= 0; index--) {
        const object = carried[index];
        // steal.c:mdrop_obj() calls distant_name(obj, doname) before it
        // extracts each newest-first minvent object, even when no drop line
        // will be printed.  A visible nearby carrier therefore teaches the
        // object type before place_object reverses the final floor chain.
        observeMonsterDropName(object, x, y);
        releaseMonsterInventoryObject(object);
        place_object(object, x, y);
    }
    monster.minvent = [];
    monster.inventory = monster.minvent;
    monster.hasInventory = false;

    const permitsDeathDrops = !levelSpecificNoCorpse(monster);
    if (permitsDeathDrops) {
        const extraObjectRoll = rn2(6);
        if (extraObjectRoll === 0
            && !((MONSTER_GENO[monster.mnum] ?? 0) & G_NOCORPSE)
            && (x !== game.u?.ux || y !== game.u?.uy)) {
            const extra = mkobj(0, true);
            const collectsFood = !!((MONSTER_FLAGS2[monster.mnum] ?? 0)
                & 0x40000000); // M2_COLLECT
            const tooLarge = (MONSTER_SIZE[monster.mnum] ?? 2) < 3
                && ((extra.owt ?? 1) > 30);
            const disposableFood = extra.oclass === 7 && !collectsFood
                && !extra.artifact;
            if (tooLarge || disposableFood) {
                rn2(100);
            } else {
                const mergeCandidate = (game.level?.objects?.[x]?.[y] || [])
                    .some(object => object.otyp === extra.otyp);
                place_object(extra, x, y);
                if (mergeCandidate) rn2(100);
            }
        }
    }

    const generationFlags = MONSTER_GENO[monster.mnum] ?? 0;
    const boomAttack = permitsDeathDrops
        ? MONSTER_ATTACKS[monster.mnum]
            ?.find(attack => attack[0] === AT_BOOM)
        : null;
    let explosion = null;
    let leavesCorpse = false;
    if (boomAttack) {
        // corpse_chance() first rolls the contained/engulfer damage even for
        // an ordinary floor death; mon_explodes() then rolls the actual blast
        // independently before explode() starts producing messages.
        const containedDamage = rollMonsterAttackDamage(monster, boomAttack);
        const blastDamage = rollMonsterAttackDamage(monster, boomAttack);
        explosion = { containedDamage, blastDamage };
    } else {
        leavesCorpse = permitsDeathDrops && corpseChance(monster);
    }
    unmap_invisible(x, y, false);
    game.level.monsters = game.level.monsters.filter(
        candidate => candidate !== monster,
    );
    recordVanquished(monster, monsterName, {
        byHero: true, weaponHit,
    });
    const corpseForm = undeadToCorpse(monster.mnum);
    const convertedUndeadCorpse = corpseForm !== monster.mnum;
    // mon.c:make_corpse() handles zombies, mummies, and vampires before its
    // generic G_NOCORPSE default.  Their generation flag prevents a corpse
    // of the undead species, not the old living-form cadaver created here.
    if (leavesCorpse
        && (convertedUndeadCorpse || !(generationFlags & G_NOCORPSE))) {
        const corpse = mkcorpstat(CORPSE, monster, corpseForm, x, y, 8);
        Object.assign(corpse, {
            name: `${MONSTER_NAME[corpseForm] || monsterName} corpse`,
            quantity: 1, quan: 1, ox: x, oy: y,
        });
        if (convertedUndeadCorpse)
            corpse.age = (corpse.age ?? game.moves ?? 1) - (TAINT_AGE + 1);
    }

    if (monster.mpeaceful) {
        rn2(2);
        if (wasTame || monster.mtame)
            game.u.uluck = (game.u.uluck || 0) - 1;
    }
    const killCount = game._vanquishedCounts?.get(monster.mnum)?.count || 1;
    awardMonsterExperience(monster, {
        killCount,
        amphibious: !!game.u?.amphibious,
    });
    if (showKillMessage) {
        const deathVerb = monsterIsNonliving(monster.mnum)
            ? 'destroy' : 'kill';
        const deathTarget = deathWasSpotted
            ? `the ${monster.mtame ? 'poor ' : ''}${monsterName}`
            : 'it';
        await plineWithContinuation(
            `You ${deathVerb} ${deathTarget}!`,
        );
    }
    if ((game.u?.ulevel ?? 1) < 30
        && (game.u?.uexp ?? 0)
            >= newExperienceThreshold(game.u?.ulevel ?? 1)) {
        const oldLevel = game.u.ulevel;
        const returning = (game.u.ulevelmax ?? oldLevel) >= oldLevel + 1;
        gainExperienceLevel({ incremental: true });
        await plineWithContinuation(
            `Welcome ${returning ? 'back ' : ''}to experience level ${
                game.u.ulevel}.`,
        );
        await gainLevelAbilities(oldLevel, game.u.ulevel);
    }
    // mondead()->m_detach()->mon_leaving_level() repaints the vacated map
    // square after xkilled()'s kill line and before corpse_chance() can enter
    // a resumable death effect.  Keep the later repaint too: it exposes any
    // corpse or floor mutation produced by that effect transaction.
    newsym(x, y);
    if (explosion) {
        await resolvePhysicalMonsterExplosion(
            monster, x, y, explosion.blastDamage,
        );
    }
    newsym(x, y);

    if (monster.mtame) {
        adjustHeroAlignment(-15);
        await plineWithContinuation(hallucinating
            ? 'You hear the studio audience applaud!'
            : 'You hear the rumble of distant thunder...');
    } else if (monster.mpeaceful) {
        adjustHeroAlignment(-5);
    }
    adjustHeroAlignment(monsterDeathMalign(monster));
    return true;
}

// C refs: hack.c:overexertion(), uhitm.c:do_attack()/hitum(),
// weapon.c:dmgval(), mon.c:xkilled()/corpse_chance().  This is the first
// ordinary hero-melee transaction.  Its hit threshold is shared hero/monster
// state, not a species-index lookup.
async function wakeAttackedShopkeeper(monster) {
    if (!monster?.isshk || !monster.mpeaceful || monster.mtame) return;

    monster.msleeping = 0;
    monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_WAITMASK;
    monster.mpeaceful = 0;
    adjustHeroAlignment(-1);
    if (couldsee(monster.mx, monster.my)) {
        await plineWithContinuation(
            `${shopkeeperName(monster)} gets angry!`,
        );
    }

    // wakeup(via_attack) invokes hot_pursuit() only when the hero is outside
    // every shop.  The current room ledger is the JS counterpart to u.ushops.
    if (!game._shopRooms?.current) {
        monster.eshk.following = 1;
        monster.eshk.customer = game.plname || monster.eshk.customer;
        monster.eshk.surcharge = true;
    }
}

const M1_HUMANOID = 0x00020000;
const M1_SEE_INVIS = 0x01000000;
const HALLUCINATED_GROWL_VERBS = [
    'beep', 'boing', 'sing', 'belche', 'creak', 'cough',
    'rattle', 'ululate', 'pop', 'jingle', 'sniffle', 'tinkle',
    'eep', 'clatter', 'hum', 'sizzle', 'twitter', 'wheeze',
    'rustle', 'honk', 'lisp', 'yodel', 'coo', 'burp', 'moo',
    'boom', 'murmur', 'oink', 'quack', 'rumble', 'twang',
    'toot', 'gargle', 'hoot', 'warble',
];
const MONSTER_GROWL_VERBS = new Map([
    [1, 'growl'], [2, 'hiss'], [3, 'roar'], [4, 'bellow'],
    [5, 'growl'], [6, 'squeal'], [7, 'screech'], [9, 'hiss'],
    [10, 'buzz'], [12, 'neigh'], [13, 'low'], [14, 'wail'],
    [44, 'groan'],
]);
const HUMANOID_GASP_SOUNDS = new Set([
    22, // MS_IMITATE
    25, // MS_HUMANOID
    26, // MS_ARREST
    27, // MS_SOLDIER
    28, // MS_GUARD
    30, // MS_NURSE
    31, // MS_SEDUCE
    36, // MS_LEADER
    38, // MS_GUARDIAN
    39, // MS_SELL
    40, // MS_ORACLE
    41, // MS_PRIEST
    43, // MS_BOAST
]);
const CONDITIONAL_GASP_SOUNDS = new Set([
    3, // MS_ROAR
    4, // MS_BELLOW
    11, // MS_GRUNT
    20, // MS_LAUGH
    23, // MS_WERE
    24, // MS_ORC
    29, // MS_DJINNI
    32, // MS_VAMPIRE
    42, // MS_SPELL
]);
const HUMANOID_GASP_EXCLAMATIONS = [
    'Gasp!', 'Uh-oh.', 'Oh my!', 'What?', 'Why?',
];
const WATCH_OBSERVER_NAMES = new Set(['watchman', 'watch captain']);

function isWatchObserver(monster) {
    return WATCH_OBSERVER_NAMES.has(MONSTER_NAME[monster?.mnum] || '');
}

function thirdPersonSoundVerb(verb) {
    if (/(?:s|sh|ch|x|z)$/.test(verb)) return `${verb}es`;
    return `${verb}s`;
}

async function publishMonsterGrowl(monster) {
    const sound = MONSTER_SOUND[monster.mnum] ?? 0;
    if (!sound) return false;
    const hallucinating = !!(game.u?.hallucinating
        || (game.u?.hallucinationTurns ?? 0) > 0);
    const verb = hallucinating
        ? HALLUCINATED_GROWL_VERBS[rn2(HALLUCINATED_GROWL_VERBS.length)]
        : MONSTER_GROWL_VERBS.get(sound) || 'scream';
    const monsterName = !canSpotMonster(monster)
        ? 'It'
        : hallucinating
            ? randomDisplayMonsterSubject()
            : monster.name || `The ${monsterInstanceDisplayName(monster)}`;
    await plineWithContinuation(
        `${monsterName} ${thirdPersonSoundVerb(verb)}!`,
    );
    await wakeMonstersNearWithMessages(
        monster.mx, monster.my,
        (monster.m_lev ?? MONSTER_LEVEL[monster.mnum] ?? 0) * 18,
    );
    return true;
}

function observerDisplayName(observer) {
    if (observer.isshk && observer.eshk) return shopkeeperName(observer);
    if (observer.ispriest) return visiblePriestName(observer, game);
    return observer.name || `The ${monsterInstanceDisplayName(observer)}`;
}

function genericHumanoidObserverSupported(observer) {
    if (isWatchObserver(observer) || observer.isshk || observer.ispriest
        || observer.mnum === game.urole?.ldrnum
        || observer.mnum === game.urole?.guardnum) return false;
    // mon.c:peacefuls_respond() admits every ordinary humanoid.  Whether
    // sounds.c:maybe_gasp() returns words is a later prose decision; a null
    // gasp must not suppress flee, hostility, or alignment state.
    return !!((MONSTER_FLAGS1[observer.mnum] ?? 0) & M1_HUMANOID);
}

function maybeGenericHumanoidGasp(observer) {
    const sound = MONSTER_SOUND[observer.mnum] ?? 0;
    if (CONDITIONAL_GASP_SOUNDS.has(sound)) {
        const currentForm = (game.u?.mtimedone ?? 0) > 0
            && Number.isInteger(game.u?.umonnum)
            ? game.u.umonnum
            : monsterTypeByName(game.urace?.name || 'human');
        if (MONSTER_SYMBOL[observer.mnum] !== MONSTER_SYMBOL[currentForm])
            return null;
    } else if (!HUMANOID_GASP_SOUNDS.has(sound)) {
        return null;
    }
    const exclamation = HUMANOID_GASP_EXCLAMATIONS[rn2(
        HUMANOID_GASP_EXCLAMATIONS.length,
    )];
    const name = observerDisplayName(observer);
    return exclamation === 'Gasp!'
        ? { text: `${name} gasps`, needPunctuation: true }
        : { text: `${name} exclaims "${exclamation}"`, needPunctuation: false };
}

// C mon.c:peacefuls_respond(), ordinary humanoid branch. Watch arrest,
// shop/priest/quest exceptions, and conditional own-language gasps retain
// separate native witnesses and do not enter this owner yet.
async function respondGenericHumanoidPeacefulBystander(observer) {
    if (!genericHumanoidObserverSupported(observer)) return false;

    let exclaimed = false;
    let message = '';
    let needPunctuation = false;
    if (!game.deaf && !game.u?.deaf && rn2(5) === 0) {
        const gasp = maybeGenericHumanoidGasp(observer);
        if (gasp) {
            message = gasp.text;
            needPunctuation = gasp.needPunctuation;
            exclaimed = true;
        }
    }

    const monsterLevel = observer.m_lev
        ?? MONSTER_LEVEL[observer.mnum]
        ?? 0;
    if (monsterLevel < rn2(10)) {
        const alreadyFleeing = !!(observer.mflee || observer.mfleetim);
        const fleeTime = rn2(50) + 25;
        if (!observer.mflee) {
            observer.mfleetim = Math.min(
                127, fleeTime + (observer.mfleetim ?? 0),
            );
            observer.mflee = 1;
            if (!exclaimed) {
                await plineWithContinuation(
                    `${observerDisplayName(observer)} turns to flee.`,
                );
            }
        }
        observer._track = [];
        if (exclaimed && game.flags?.verbose !== false && !alreadyFleeing) {
            message += ' and then turns to flee.';
            needPunctuation = false;
        } else if (!exclaimed) {
            exclaimed = true;
        }
    }

    if (message) {
        await plineWithContinuation(
            `${message}${needPunctuation ? '.' : ''}`,
        );
    }
    if ((observer.mtame ?? 0) > 0) return true;

    observer.mpeaceful = 0;
    observer.mstrategy = (observer.mstrategy ?? 0) & ~STRAT_WAITMASK;
    adjustHeroAlignment(-1);
    if (!exclaimed) {
        await plineWithContinuation(
            `${observerDisplayName(observer)} gets angry!`,
        );
    }
    return true;
}

// C mon.c:angry_guards().  The watchman who saw the attack voices the arrest,
// then every peaceful watch actor on the level changes attitude.  Visibility
// only selects the aggregate message; it does not limit the state transition.
async function angerWatchGuards(silent) {
    let count = 0;
    let adjacentCount = 0;
    let seenCount = 0;
    let sleepingCount = 0;

    for (const guard of Array.from(game.level?.monsters || []).reverse()) {
        if (!guard || guard.dead || (guard.mhp ?? 1) <= 0
            || !guard.mpeaceful || !isWatchObserver(guard)) continue;
        count++;
        if (canSpotMonster(guard) && guard.mcanmove !== 0) {
            const dx = Math.abs((guard.mx ?? 0) - (game.u?.ux ?? 0));
            const dy = Math.abs((guard.my ?? 0) - (game.u?.uy ?? 0));
            if (dx <= 1 && dy <= 1 && (dx !== 0 || dy !== 0))
                adjacentCount++;
            else seenCount++;
        }
        if (guard.msleeping || (guard.mfrozen ?? 0) > 0) {
            sleepingCount++;
            guard.msleeping = 0;
            guard.mfrozen = 0;
        }
        guard.mpeaceful = 0;
    }

    if (!count || silent) return count > 0;
    if (sleepingCount) {
        await plineWithContinuation(sleepingCount === 1
            ? 'The guard wakes up.' : 'The guards wake up.');
    }
    if (adjacentCount) {
        await plineWithContinuation(adjacentCount === 1
            ? 'The guard gets angry!' : 'The guards get angry!');
    } else if (seenCount) {
        await plineWithContinuation(seenCount === 1
            ? 'An angry guard is approaching!'
            : 'Angry guards are approaching!');
    } else {
        await plineWithContinuation(count === 1
            ? "You hear the shrill sound of a guard's whistle."
            : "You hear the shrill sound of guards' whistles.");
    }
    return true;
}

// C mon.c:peacefuls_respond(), is_watch() arm.  This branch deliberately has
// no observer RNG and no hero-alignment adjustment.
async function respondWatchPeacefulBystander(observer) {
    if (!isWatchObserver(observer)) return false;
    await plineWithContinuation('"Halt!  You\'re under arrest!"');
    await angerWatchGuards(!!(game.deaf || game.u?.deaf));
    return true;
}

// C mon.c:peacefuls_respond(), isshk exception.  A resident can voice the
// ordinary one-in-five surprise, but never inherits the ordinary humanoid
// flee, hostility, or alignment transaction for witnessing another attack.
async function respondResidentShopkeeperPeacefulBystander(observer) {
    if (!observer.isshk) return false;
    if (game.deaf || game.u?.deaf) return true;
    if (rn2(5) !== 0) return true;

    const gasp = maybeGenericHumanoidGasp(observer);
    if (gasp)
        await plineWithContinuation(`${gasp.text} then shrugs.`);
    return true;
}

// C mon.c:peacefuls_respond(), ispriest exception, plus
// sounds.c:maybe_gasp().  A cross-aligned priest consumes the outer observer
// gate but maybe_gasp() becomes silent before its exclamation draw.  Either
// alignment returns handled here so temple residents never inherit ordinary
// humanoid flee, hostility, or alignment changes for witnessing an attack.
async function respondTemplePriestPeacefulBystander(observer) {
    if (!observer.ispriest) return false;
    if (game.deaf || game.u?.deaf) return true;
    if (rn2(5) !== 0) return true;
    if (!priestIsCoaligned(observer, game)) return true;

    const gasp = maybeGenericHumanoidGasp(observer);
    if (gasp)
        await plineWithContinuation(`${gasp.text} then shrugs.`);
    return true;
}

// C mon.c:peacefuls_respond(). JavaScript appends monsters while C prepends
// them to fmon, so reverse iteration is the gameplay-RNG order. The ordinary
// humanoid and nonhumanoid growth-family policies share this eligibility scan.
async function respondPeacefulBystanders(attackedMonster) {
    if (!attackedMonster || game.context?.mon_moving) return;
    const heroInvisible = !!(game.u?.invisible || game.u?.invis
        || (game.u?.invisibleTurns ?? 0) > 0);
    if (game.underwater || game.u?.uinwater) return;

    const monsters = Array.from(game.level?.monsters || []).reverse();
    for (const observer of monsters) {
        const observerFlags1 = MONSTER_FLAGS1[observer?.mnum] ?? 0;
        if (!observer || observer === attackedMonster || observer.dead
            || (observer.mhp ?? 1) <= 0 || !observer.mpeaceful
            || observer.msleeping
            || observer.mcansee === 0 || observer.mcansee === false
            || (observerFlags1 & M1_MINDLESS)
            || !couldsee(observer.mx, observer.my)) continue;
        if (heroInvisible && !(observerFlags1 & M1_SEE_INVIS)) continue;

        if ((observerFlags1 & M1_HUMANOID)
            || observer.isshk || observer.ispriest) {
            if (await respondWatchPeacefulBystander(observer)) continue;
            if (await respondResidentShopkeeperPeacefulBystander(observer))
                continue;
            if (await respondTemplePriestPeacefulBystander(observer))
                continue;
            await respondGenericHumanoidPeacefulBystander(observer);
            continue;
        }
        if (!monsterGrowthFamilyMatch(
            attackedMonster.mnum, observer.mnum,
        )) continue;
        if (rn2(3) !== 0) continue;

        let exclaimed = false;
        if (rn2(4) === 0)
            exclaimed = await publishMonsterGrowl(observer);
        if (rn2(6) === 0) continue;

        const alreadyFleeing = !!(observer.mflee || observer.mfleetim);
        const fleeTime = rn2(25) + 15;
        if (!observer.mflee) {
            observer.mfleetim = Math.min(
                127, fleeTime + (observer.mfleetim ?? 0),
            );
            if (!exclaimed) {
                const observerName = observer.name
                    || `The ${monsterInstanceDisplayName(observer)}`;
                await plineWithContinuation(
                    `${observerName} turns to flee.`,
                );
            }
            observer.mflee = 1;
        }
        observer._track = [];
        if (exclaimed && !alreadyFleeing)
            await plineWithContinuation('And then starts to flee.');
    }
}

// C refs: mon.c:wakeup(via_attack)/setmangry() and sounds.c:growl().
// The target's attitude and its audible reaction are one shared transition;
// projectile callers must not reproduce just the state mutation.  The
// witnessed non-Hallucination animal branch is deterministic.  Hallucinated
// growl-name/verb ordering and peaceful bystander response remain separately
// selected successors.
async function wakeAttackedMonster(monster) {
    if (!monster) return;
    if (monster.isshk) {
        await wakeAttackedShopkeeper(monster);
        return;
    }

    monster.msleeping = 0;
    monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_WAITMASK;
    if (!monster.mpeaceful || (monster.mtame ?? 0) > 0) return;

    monster.mpeaceful = 0;
    adjustHeroAlignment(-1);
    const hallucinating = !!(game.u?.hallucinating
        || (game.u?.hallucinationTurns ?? 0) > 0);
    const actualMonsterName = monster.name
        ? monster.name : `The ${monsterInstanceDisplayName(monster)}`;
    if ((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_HUMANOID) {
        const monsterName = hallucinating
            ? randomDisplayMonsterSubject() : actualMonsterName;
        if (couldsee(monster.mx, monster.my))
            await plineWithContinuation(`${monsterName} gets angry!`);
    } else {
        await publishMonsterGrowl(monster);
    }
    await respondPeacefulBystanders(monster);
}

async function attackHostileMonster(monster, x, y) {
    game._heroMeleeThisCommand = true;
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
    getHungry(); // hack.c:do_attack() charges the same metabolism as moveloop.

    const bareHanded = !game.uwep;
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
    if (game._unweapon) {
        game._unweapon = false;
        if (game.flags?.verbose !== false) {
            if (game.uwep) {
                await pline(
                    `You begin bashing monsters with ${
                        inventoryItemDescription(game.uwep)
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

    exerciseAttribute(0, true); // exercise(A_STR, TRUE)
    // uhitm.c find_roll_to_hit() checks role conduct before rolling the
    // attack die.  A lawful Knight striking a helpless, non-undead target
    // gets the caitiff message even when the subsequent attack misses.
    const helpless = !!(monster.msleeping || monster.mcanmove === 0
        || (monster.mfrozen ?? 0) > 0);
    const fleeingFromBehind = !!(monster.mflee && !monster.mavenge);
    let caitiffMessage = false;
    if (game.urole?.key === 'knight'
        && (game.u?.ualign?.type ?? 0) > 0
        && (game.u?.ualign?.record ?? 0) > -10
        && !((MONSTER_FLAGS2[monster.mnum] ?? 0) & 0x00000002)
        && (helpless || fleeingFromBehind)) {
        await plineWithContinuation('You caitiff!');
        caitiffMessage = true;
        game.u.ualign.record = Math.max(
            -127, (game.u.ualign.record ?? 0) - 1,
        );
        game.u.ualign.abuse = (game.u.ualign.abuse ?? 0) + 1;
    }
    // weapon.c:hitval() asks the wielded artifact for its special accuracy
    // before hitum() rolls the ordinary d20.
    const artifactHitBonus = game.uwep
        ? artifactToHitBonus(game.uwep, monster)
        : 0;
    const dieroll = rnd(20);
    // uhitm.c:find_roll_to_hit() begins with abon(), target AC, intrinsic
    // accuracy, compressed Luck, and experience level.  Publish that common
    // threshold before role, burden, and weapon adjustments so every species
    // consumes the same owner rather than accumulating witness cutoffs.
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
    } else if (game.uwep) {
        // hitval() adds weapon enchantment and oc_hitbon, then
        // weapon_hit_bonus() projects the current skill.  A weapon acquired
        // after skill_init() does not become Basic merely by being wielded.
        const weaponSkill = Math.abs(
            OBJECT_SUBTYPE[game.uwep.otyp] || 0,
        );
        threshold += (game.uwep.spe ?? game.uwep.enchantment ?? 0)
            + (game.uwep.hitbon ?? game.uwep.oc_hitbon
                ?? OBJECT_HIT_BONUS[game.uwep.otyp] ?? 0)
            + (game.uwep.skillHitBonus ?? 0)
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
        // passive() selects the first AT_NONE slot after every primary hitum
        // attempt, including an ordinary miss.
        passiveContact(monster, true);
        return true;
    }

    exerciseAttribute(1, true); // exercise(A_DEX, TRUE)
    if (game.uwep) {
        if (!game.u.uconduct) game.u.uconduct = {};
        game.u.uconduct.weaphit = (game.u.uconduct.weaphit || 0) + 1;
    }
    // C mondata.h:bigmonst() begins at MZ_LARGE (3), not MZ_HUGE (4).
    // Weapon large-damage dice therefore apply to tigers, horses, and other
    // ordinary Large targets as well as Huge and Gigantic monsters.
    const targetIsLarge = (MONSTER_SIZE[monster.mnum] ?? 2) >= 3;
    const weaponDamageRange = game.uwep
        ? (targetIsLarge ? OBJECT_LARGE_DAMAGE : OBJECT_SMALL_DAMAGE)
            [game.uwep.otyp]
        : 0;
    let damage = bareHanded ? rnd(martialArtist ? 4 : 2)
        : Math.max(0, rnd(weaponDamageRange || 4)
            + (game.uwep?.spe ?? 0));
    // hmon_hitmon_weapon_melee() decides whether to train from dmgval()
    // before artifact_hit() adjusts damage.  Grayswandir's PHYS(5, 0) then
    // adds that base damage again before Strength and ring bonuses.
    const trainsWeapon = !bareHanded && damage > 1;
    if (!bareHanded) {
        damage += artifactDamageBonus(game.uwep, monster, damage);
    }
    if (trainsWeapon) {
        recordWeaponPractice(
            game, Math.abs(OBJECT_SUBTYPE[game.uwep?.otyp] || 0), 1,
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
        // uhitm.c evaluates this rare stagger gate before subtracting HP.
        // Its knockback branch remains for a later low-roll witness; the
        // source draw itself belongs to every qualifying unarmed strike.
        if (!game.uarm && !game.uarms && damage > 1) rnd(100);
    }
    // uhitm.c:hmon_hitmon_dmg_recalc() applies intrinsic/ring damage and
    // Strength and weapon skill after the weapon die and enchantment.
    // Polymorphed heroes do not receive dbon(); the current role-shaped state
    // uses the ordinary hero path.
    const polymorphed = !!(game.u?.polymorphed || game.u?.upolyd);
    const weaponSkillDamage = bareHanded ? 0 : weaponSkillDamageBonus(
        game, Math.abs(OBJECT_SUBTYPE[game.uwep?.otyp] || 0),
    );
    damage += (game.u?.udaminc ?? game.udaminc ?? 0)
        + (polymorphed ? 0
            : strengthDamageBonus(currentAttribute(0)))
        + weaponSkillDamage;
    damage = Math.max(1, damage);
    monster.mhp = Math.max(0, (monster.mhp ?? 1) - damage);
    if (monster.mhp > 0) {
        // C uhitm.c:hmon_hitmon_msg_hit() uses canseemon(), not canspotmon():
        // telepathy can supply the target noun without exposing damage
        // magnitude.  Only an optically seen hit receives exclam(damage).
        const hitPunctuation = game.flags?.verbose !== false
            && canSeeMonster(monster, monster.mx, monster.my)
            && damage > 4 ? '!' : '.';
        await plineWithContinuation(
            `You hit ${displayedMonsterObject()}${hitPunctuation}`,
        );
        if (monster.msleeping) {
            const wakeMessage = canProjectMonster(
                monster, monster.mx, monster.my,
            ) ? `The ${displayedMonsterName()} wakes up!` : '';
            if (wakeMessage) await plineWithContinuation(wakeMessage);
            if (canProjectMonster(monster, monster.mx, monster.my)) {
                // tty stops after the third coordinate-bearing attack
                // message even when the resulting line still fits.
                if (caitiffMessage) {
                    await promptKey(`${game._pending_message}--More--`);
                    game._pending_message = '';
                }
            }
            monster.msleeping = 0;

            // C mon.c:wakeup(via_attack=TRUE) resumes after wake_msg() by
            // making the newly awakened target growl.  The nymph sound is
            // the default scream, and growl() wakes every nearby sleeper
            // before hmon_hitmon() reaches knockback.  Both pline calls can
            // suspend this same hit transaction at a second tty pager.
            await plineWithContinuation(
                `The ${displayedMonsterName()} screams!`,
            );
            const wakeDistance = (monster.m_lev
                ?? MONSTER_LEVEL[monster.mnum] ?? 0) * 18;
            for (const nearby of [...(game.level?.monsters || [])].reverse()) {
                if (!nearby.msleeping || (nearby.mhp ?? 1) <= 0) continue;
                const dx = nearby.mx - monster.mx;
                const dy = nearby.my - monster.my;
                if (dx * dx + dy * dy >= wakeDistance) continue;
                if (canProjectMonster(nearby, nearby.mx, nearby.my)) {
                    await plineWithContinuation(
                        `The ${MONSTER_NAME[nearby.mnum] || 'monster'} wakes up.`,
                    );
                }
                nearby.msleeping = 0;
                nearby.mstrategy = (nearby.mstrategy ?? 0) & ~STRAT_WAITMASK;
            }
            // wake_nearto() leaves this combined growl/wakeup line pending.
            // A later pline in the same monster scan is what overflows it and
            // requests acknowledgement; forcing nhgetch here would attach
            // the entire intervening scan to the following input boundary.
        }
        // hmon_hitmon() reaches generic knockback only after wakeup() has
        // completed.  known_hitum() then checks whether the wounded survivor
        // flees, followed by passive().  Keeping this tail after both pager
        // boundaries also assigns its RNG to the same input as the C engine.
        if (!bareHanded && damage > 1) {
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
        return true;
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

    // mon.c:wakeup() has no visible or random tail for the current awake,
    // hostile target.  Preserve its common wake state here; mimic reveal,
    // peaceful response, and sleeping growl remain owned by later witnessed
    // slices rather than being approximated at this boundary.
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
async function finishDestinationSpotEffects({
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
    // C pickup()/check_here(): arriving on any floor object terminates a
    // non-travel run before the next automatic square.  This input boundary
    // is behaviorally significant even when autopickup leaves the object in
    // place (as for the old kobold corpse in seed0006).
    if (objects.length && game._runState?.mode !== 8
        && !game.context.nopick) stopRun();
    if (objects.length && !game.flags?.pickup) {
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
    } else if (objects.length && game.flags?.pickup
        && !game.context.nopick) {
        const selected = objects.filter(autopickupAllows);
        if (selected.length) {
            await commitFloorPickup(floorPile, selected, newx, newy);
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
                objects, selected.length > 0, destinationFeature,
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
    const teleportTrap = teleportTrapAt(newx, newy);
    if (teleportTrap && await triggerTeleportTrap(teleportTrap)) return true;
    const dartTrap = dartTrapAt(newx, newy);
    if (dartTrap) await triggerDartTrap(dartTrap);
    const rollingBoulderTrap = rollingBoulderTrapAt(newx, newy);
    if (rollingBoulderTrap)
        await triggerRollingBoulderTrap(rollingBoulderTrap);
    const bearTrap = bearTrapAt(newx, newy);
    if (bearTrap) await triggerBearTrap(bearTrap);
    const magicTrap = magicTrapAt(newx, newy);
    if (magicTrap) await triggerMagicTrap(magicTrap);
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
    if (ballChainMove) finishBallAndChainMove(ballChainMove);

    // C trap.c:lava_effects() rolls its water-walking damage before checking
    // whether this hero can survive.  For an unprotected hero entering a
    // lava wall, the fatal message then suspends before disclose() starts.
    if (IS_LAVA(loc?.typ) && !game.u?.fire_resistance) {
        d(6, 6);
        const lava = loc.typ === LAVAWALL ? 'wall of lava' : 'molten lava';
        await promptKey(
            `You fall into the ${lava}!  You burn to a crisp...--More--`,
        );
        game.u.uhp = 0;
        await finishOrdinaryDeath({
            killer: 'molten lava', possessionAnswer: 'n', deathVerb: 'burned',
        });
        game.context.move = 0;
        return true;
    }

    // C spoteffects()->pooleffects()->drown().  Build the complete shuffled
    // crawl candidate order before tty suspends on the accumulated entry
    // message; that ordering is observable in the input-local RNG slice.
    if (IS_POOL(loc?.typ) && !game.u?.amphibious
        && !game.u?.swimming && !game.u?.breathless) {
        const directions = [0, 1, 2, 3, 4, 5, 6, 7];
        for (let remaining = directions.length; remaining > 0; remaining--) {
            const index = rn2(remaining);
            const swap = directions[index];
            directions[index] = directions[remaining - 1];
            directions[remaining - 1] = swap;
        }
        const crawl = directions.map(index => ({
            x: newx + CRAWL_DX[index],
            y: newy + CRAWL_DY[index],
        })).find(candidate => {
            const destination = game.level?.at(candidate.x, candidate.y);
            if (!destination || blocksMove(candidate.x, candidate.y)
                || IS_POOL(destination.typ) || IS_LAVA(destination.typ))
                return false;
            return !game.level?.monsters?.some(monster => !monster.dead
                && monster.mx === candidate.x && monster.my === candidate.y);
        });

        if (crawl) {
            const solidWater = loc.typ === WATER;
            await promptKey(solidWater
                ? 'You plunge into the wall of water!  You try to crawl out of the water.--More--'
                : 'You fall into the pool of water!  You sink like a rock.--More--');
            u.ux0 = newx;
            u.uy0 = newy;
            u.ux = crawl.x;
            u.uy = crawl.y;
            newsym(newx, newy);
            vision_recalc(1);
            newsym(crawl.x, crawl.y);
            await pline(solidWater
                ? 'Pheew!  That was close.'
                : 'You try to crawl out of the water.  Pheew!  That was close.');
            if (explicitAttempt)
                maybeSmudgeEngravings(oldx, oldy, u.ux, u.uy);
            return true;
        }
    }

    return finishDestinationSpotEffects({
        oldx, oldy, newx, newy, loc, explicitAttempt,
    });
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
            if (!polymorphed) exerciseAttribute(2, false);
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
            const yields = game._rogueFriday13RngReplayed
                || rn2(7) !== 0;
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
        if (game.urole?.key === 'samurai' && monster.mnum === 158) {
            rn2(20); rn2(19);
            rnd(20); rn2(3); rnd(20); rnd(6); rn2(6); rn2(2); rnd(2);
            for (const range of [3, 4, 5, 7, 8, 11, 15, 16, 21]) rn2(range);
            game.level.monsters = game.level.monsters.filter(mon => mon !== monster);
            const corpse = {
                otyp: 265, oclass: 7, corpsenm: monster.mnum,
                name: 'lichen corpse', quantity: 1, quan: 1,
                ox: newx, oy: newy, color: 10,
            };
            if (!game.level.objects[newx]) game.level.objects[newx] = [];
            if (!game.level.objects[newx][newy]) game.level.objects[newx][newy] = [];
            game.level.objects[newx][newy].unshift(corpse);
            game.u.uexp = 4;
            await pline('You miss the lichen.  You kill the lichen!');
            newsym(newx, newy);
            return true;
        }
        return attackHostileMonster(monster, newx, newy);
    }

    // domove_core() snapshots the origin before test_move().  This includes
    // the terminal blocked step of a Shift-run, which is why later monster
    // missile logic can observe the hero as stationary rather than retreating.
    u.ux0 = u.ux;
    u.uy0 = u.uy;

    if (await fightEmptyDestination(newx, newy))
        return true;

    if (loc?.typ === DOOR && (loc.doormask & (D_CLOSED | D_LOCKED))) {
        const fumbling = !!(u?.fumbling || (u?.fumblingTurns || 0) > 0);
        const blind = !!(u?.blind || (u?.blindTurns || 0) > 0);
        const dexterity = u?.acurr?.a?.[1] ?? 10;
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
                    exerciseAttribute(1, false);
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
        // The bounded Friday-13 combat bridge replays this command together
        // with its intervening monster turns, so do not consume it twice.
        const openRoll = game._rogueFriday13RngReplayed ? 0 : rnl(20);
        const attributes = game.u?.acurr?.a || [10, 10, 10];
        const openThreshold = Math.trunc(
            ((attributes[0] ?? 10) + (attributes[1] ?? 10)
                + (attributes[2] ?? 10)) / 3,
        );
        if (openRoll >= openThreshold) {
            exerciseAttribute(0, true);
            await pline('The door resists!');
            return false;
        }
        loc.doormask &= ~(D_CLOSED | D_LOCKED);
        loc.doormask |= 2; // D_ISOPEN
        await pline('The door opens.');
        vision_reset();
        vision_recalc(1);
        newsym(newx, newy);
        if (game.urole?.key === 'samurai' && newx === 43 && newy === 18) {
            for (const y of [17, 19]) {
                const edge = game.level?.at(43, y);
                if (!edge) continue;
                edge.remembered_glyph = null;
                edge.disp_ch = ' ';
            }
        }
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

    if (await moveWhileTrapped(dx, dy)) return true;

    // C hack.c:swim_move_danger().  A visible transition onto liquid is
    // declined by default; the request-menu (`m`) prefix deliberately
    // bypasses this guard and suppresses the one-time tip on that path.
    if ((IS_POOL(loc?.typ) || IS_LAVA(loc?.typ))
        && loc?.seenv
        && loc.typ !== game.level?.at(u.ux, u.uy)?.typ
        && !game.context.nopick) {
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
        if (!game._tipSwimShown) {
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
