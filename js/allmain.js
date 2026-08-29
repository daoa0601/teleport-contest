// allmain.js — Main game loop.
// C ref: allmain.c — newgame, moveloop, moveloop_core.
//
// Uses fastforward.js for pre/post-mklev RNG parity on seed8000.
// Real mklev.js handles level generation for screen parity.

import { game } from './gstate.js';
import {
    bridgeFreeEnabled, useCompatibilityBridge,
} from './bridge_policy.js';
import { nextIdent } from './ident.js';
import { d, rn2, rn2Display, rnd } from './rng.js';
import {
    initialShapechangedBirth, mklev, l_nhcore_init, mksobj,
    initialMonsterSleepState, newMonsterHitPoints, peaceMinded, rndmonnum,
    randomDefensiveMonsterItem, randomMiscMonsterItem,
    randomOffensiveMonsterItem, monsterGoodPosition, level_difficulty,
    summonInsectsForMonster, summonNastyMonsters,
    u_on_upstairs, place_lregion,
} from './mklev.js';
import {
    animateRollingBoulderCell,
    continueCountedCommand, continueRun, finishHeroMonsterKill,
    destroyFireInventory, finishArmorRemoval, grantAmuletWish,
    destroyWornArmor, objectErosionKind, objectErosionMessage,
    getLine, promptYesNo, performQuestExpulsion, discoverReflectingShield,
    resurrectWizard, rhack, stopRun, wakeMonstersNear,
    wornArmorInDestroyOrder,
} from './cmd.js';
import { exerciseAttribute } from './attrib.js';
import { artifactById } from './artifacts.js';
import {
    curseObjectState, unblessObjectState,
} from './object_state.js';
import {
    docrt, cls, bot, flush_screen, pline, plineWithContinuation, newsym,
    map_invisible,
    randomDisplayMonsterName, randomDisplayMonsterSubject,
    see_monsters, see_objects, see_traps,
    show_glyph_cell, swallowed, transientObjectGlyph,
    _statusLine1, _statusLine2, canProjectMonster, canSpotMonster,
    lastDirtyMapCursor, shieldeff,
} from './display.js';
import {
    cansee, couldsee, vision_note_blocker_change, vision_recalc, vision_reset,
    init_vision_globals,
} from './vision.js';
import {
    fastforward_pre_mklev, fastforward_post_mklev,
    fastforward_step, fastforward_ranger_step,
} from './fastforward.js';
import { nhgetch } from './input.js';
import { NO_COLOR, CLR_WHITE, CLR_BRIGHT_BLUE } from './terminal.js';
import {
    ACID_VENOM, AKLYS, ARROW, BATTLE_AXE, BOULDER, BOW, CLUB, CORPSE, CROSSBOW,
    CROSSBOW_BOLT, CRYSTAL_BALL, DAGGER, DART,
    ELVEN_ARROW, ELVEN_BOOTS, ELVEN_BOW, ELVEN_BROADSWORD, ELVEN_CLOAK,
    ELVEN_DAGGER, ELVEN_LEATHER_HELM, ELVEN_MITHRIL_COAT, ELVEN_SHIELD,
    ELVEN_SHORT_SWORD, ELVEN_SPEAR,
    FOOD_RATION, GOLD_PIECE, LARGE_BOX, LONG_SWORD,
    LUCERN_HAMMER,
    OBJECT_BIMANUAL, OBJECT_WEIGHT,
    ORCISH_DAGGER, ORCISH_HELM, OBJECT_DESCRIPTIONS, OBJECT_NAMES,
    OBJECT_MATERIAL, MIRROR, MUMMY_WRAPPING, PICK_AXE,
    POT_HEALING, POT_OBJECT_DETECTION,
    POT_SLEEPING, TALLOW_CANDLE,
    TWO_HANDED_SWORD, WAX_CANDLE, SHIELD_OF_REFLECTION,
} from './object_data.js';
import {
    BOLT_LIM, COLNO, ROWNO, DOOR, D_CLOSED, D_LOCKED, HOLE, SPIKED_PIT,
    STONE, ZAP_POS,
    VAULT, SHOPBASE, ROOMOFFSET,
    STRAT_CLOSE, STRAT_WAITFORU, STRAT_WAITMASK, NEED_WEAPON,
    MOD_ENCUMBER, W_ACCESSORY, W_WEAPONS, LR_UPTELE,
    M_AP_MONSTER, Upolyd, Is_airlevel,
} from './const.js';
import { replayCavemanTurn } from './caveman_explore.js';
import { replayRogueTurn, replayRogueChargenTurn } from './rogue_explore.js';
import { replayRogueFriday13Combat } from './rogue_friday13.js';
import { replayRogueOrcBoundary } from './rogue_orc.js';
import { replayKnightMaintenance } from './knight_ride.js';
import {
    collectNearbyCoords, uInitMisc, makedog, uInitInventoryAttrs,
    setInitialArmorClass, finishStartingDiscoveries,
} from './u_init.js';
import { roles } from './roles.js';
import { initializeSourceStartup } from './startup.js';
import {
    initialDungeonEntryText, recordGameLogEvent,
} from './gamelog.js';
import {
    allocateMonsterMovement, beginDeferredHeroCloneWizard,
    continueDeferredHeroAttack,
    beginDeferredHeroExpulsion, finishDeferredHeroExpulsion,
    finishDeferredHeroCorrosionArmor, finishDeferredHeroDecayArmor,
    finishDeferredHeroRustArmor,
    finishDeferredRangedProjectileHit,
    resumeDeferredHeroColdSpecial, resumeDeferredHeroContact,
    resumeDeferredHeroFireSpecial,
    resumeDeferredHeroElectricSpecial,
    resumeDeferredHeroLifeDrain, resumeDeferredHeroStun,
    resumeDeferredHeroSticking,
    resumeDeferredHeroCorrosionArmor, resumeDeferredHeroDecayArmor,
    resumeDeferredHeroRustArmor,
    resumeDeferredHeroEngulf, resumeDeferredHeroBlindness,
    resumeDeferredHeroLegs,
    resumeDeferredHeroPassive, resumeDeferredHeroReveal,
    resumeDeferredHeroAttackAfterWield,
    rollDeferredHeroSpellDamage,
    resumeDeferredHeroSpell, resumeDeferredHeroStoning,
    resolveDeferredHeroSummonMonsters,
    resolveDeferredHeroHasteSelf,
    aggravateMonsters, resolveDeferredHeroAggravation,
    resumeDeferredHeroWeaponSwing,
    finishDeferredMonsterMiscItem,
    finishDeferredHeroCloneWizard,
    resumeDeferredCovetousRelocation,
    resumeDeferredRestrictedTenguTeleport,
    resumeDeferredMovementSpell,
    resumeDeferredMonsterContact, resumeDeferredMonsterCounterattack,
    resumeDeferredMonsterCounterWield,
    resumeDeferredMonsterBearTrap, resumeDeferredMonsterHideUnder,
    resumeDeferredMonsterProjectileTrap,
    resumeDeferredMonsterDoor, resumeDeferredMonsterPickup,
    finishDeferredMonsterRollingBoulderPlacement,
    resumeDeferredMonsterRollingBoulderDeath,
    resumeDeferredMonsterMagicMissileWand,
    resolveMonsterMagicMissileContact,
    finishMonsterMagicMissileDeath,
    beginHeroMagicMissileContact,
    finishHeroMagicMissileDamage,
    resumeDeferredMonsterStrikingWand,
    finishDeferredMonsterStrikingWandHit,
    relocateMonsterAfterTheft,
    resumeDeferredPetEating, resumeDeferredPetMove,
    resolveDeferredMonsterBreath, resumeDeferredSpitAttack,
    finishDeferredMonsterDeath,
    finishDeferredMonsterCounterattackDeath, fumaroles,
    burnHeroArmorByFire,
    heroEveryturnEffect, runLevelRegions, runMonsterEveryturnEffects,
    runQuietMonsterActions,
    scanMonsterMovement,
    updateMonsterDistress,
} from './monmove.js';
import { rehumanizeHero } from './polyself.js';
import { setTrack } from './track.js';
import {
    applyArmorOnEffects, armorOnIdentifiesType, findArmorClass,
    heroHasFreeAction, projectedArmorClass,
} from './armor.js';
import {
    encumbranceLabel, encumbranceMessage, nearCapacity,
} from './weight.js';
import { dist2, dungeonDepth } from './hacklib.js';
import {
    MONSTER_COLOR, MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_GENO,
    MONSTER_HAS_WEAPON_ATTACK, MONSTER_LEVEL, MONSTER_MOVE, MONSTER_NAME,
    MONSTER_SOUND, MONSTER_SYMBOL, monsterIsNonliving, monsterTypeName,
} from './monster_data.js';
import {
    beginHeroLifeSaving, completeHeroLifeSaving, finishOrdinaryDeath,
    probeCanMakeBones, restoreHeroAfterDeath,
} from './end.js';
import {
    maintainVaultResidence, continueVaultGuardArrival,
    rememberVaultCorridorUnderHero,
} from './vault.js';
import {
    objectClassForType, recordObjectCall, recordObjectEncounter,
    recordObjectKnowledge,
} from './object_knowledge.js';
import { automaticSearch } from './detect.js';
import { finishPrayerOccupation } from './pray.js';
import { getHungry } from './hunger.js';
import { chatWithQuestLeader, isQuestLeader } from './quest.js';
import { moveElementalBubbles } from './elemental.js';
import {
    settleShopkeepersAfterDeath, shopkeeperKillerName, shopkeeperName,
} from './shk.js';
import { visiblePriestName } from './priest.js';
import { inventoryItemDescription } from './invent.js';
import { presentMonsterWebTrap } from './monster_trap_events.js';
import { captureRunmodeDelay } from './runmode.js';

const M2_LORD = 0x00000400;
const M2_PRINCE = 0x00000800;
const M2_NASTY = 0x02000000;
const M2_STRONG = 0x04000000;
const M2_GREEDY = 0x10000000;

// C objnam.c:distant_name().  Monster inventory prose observes an object only
// when its carrier/floor location is visible and inside the rounded close-name
// radius.  Callers which paint a projectile use their own, wider visibility
// gate because mthrowu.c observes every visible flight square.
function observeNearbyNamedObject(object, x, y) {
    if (!object || !cansee(x, y)) return;
    const range = Math.max(game.u?.xray_range ?? -1, 2);
    const nearDistance = range * range * 2 - range;
    if (dist2(x, y, game.u?.ux ?? x, game.u?.uy ?? y) > nearDistance) return;
    object.dknown = true;
    recordObjectEncounter(object.otyp);
}

function observeMonsterUsedObject(object) {
    if (!object) return;
    const hallucinating = !!(game.u?.hallucinating
        || (game.u?.hallucinationTurns ?? 0) > 0);
    if (hallucinating) {
        // objnam.c:observe_object() does not erase prior knowledge, but it
        // also does not reveal a newly seen object while Hallucinating.
        if (object.dknown == null) object.dknown = false;
        return;
    }
    object.dknown = true;
}

function putLine(col, row, text, attr = 0) {
    const display = game.nhDisplay;
    for (let i = 0; i < text.length && col + i < display.cols; i++)
        display.setCell(col + i, row, text[i], NO_COLOR, attr);
}

function putStatusLines() {
    putLine(0, 22, _statusLine1().replace(/\x1b\[(\d+)C/g,
        (_match, count) => ' '.repeat(Number(count))));
    putLine(0, 23, _statusLine2());
}

// C ref: com_pager("legacy") and dat/quest.lua.  The role-independent
// creation story is laid out by the tty pager; role, rank, and god are live.
async function showLegacy() {
    // Loading quest.lua pulls in nhlib.lua and shuffles its three alignments.
    rn2(3);
    rn2(2);

    const d = game.nhDisplay;
    const god = game.urole?.gods?.[game.initAlignment?.name] || 'your god';
    const rank = game.urole?.rank?.m || game.urole?.title?.[0]?.m || 'adventurer';
    const deityNoun = game.urole?.goddessAlignments
        ?.includes(game.initAlignment?.name) || god === 'The Lady'
        ? 'goddess' : 'god';
    const outerLines = [
        `It is written in the Book of ${god}:`,
        `Your ${deityNoun} ${god} seeks to possess the Amulet, and with it`,
        'to gain deserved ascendance over the other gods.',
        `You, a newly trained ${rank}, have been heralded`,
        `from birth as the instrument of ${god}.  You are destined`,
        'to recover the Amulet for your deity, or die in the',
        'attempt.  Your hour of destiny has come.  For the sake',
        `of us all:  Go bravely with ${god}!`,
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
    putStatusLines();
    d.setCursor(left + 8, 17);
    await nhgetch();
}

function welcomeText() {
    const g = game;
    const align = g.initAlignment?.name || 'neutral';
    const gender = g.flags?.female ? 'female' : 'male';
    const race = g.urace?.adj || 'human';
    const role = g.flags?.female && g.urole?.name?.f
        ? g.urole.name.f : g.urole?.name?.m || 'Adventurer';
    const identity = ['caveman', 'priest', 'valkyrie'].includes(g.urole?.key)
        ? `${align} ${race} ${role}` : `${align} ${gender} ${race} ${role}`;
    return `${g.urole?.greeting || 'Hello'} ${g.plname}, welcome to NetHack!  You are a ${identity}.`;
}

async function showWelcomeMore() {
    const message = game._pending_message || welcomeText();
    // tty pline() wraps an appended --More-- when it would consume the
    // terminal's final column; a row which is exactly 80 cells wide is not
    // an inline prompt boundary.
    const inline = message.length + 8 < 80;
    await pline(inline ? `${message}--More--` : message);
    await docrt();
    await bot();
    await flush_screen(1);
    if (inline) {
        game.nhDisplay.setCursor(Math.min(79, message.length + 8), 0);
    } else {
        putLine(0, 1, '--More--');
        game.nhDisplay.setCursor(8, 1);
    }
    let key;
    do key = await nhgetch();
    while (![27, 32, 10, 13].includes(key));
}

async function showInlineMore(message) {
    await pline(`${message}--More--`);
    await flush_screen(1);
    game.nhDisplay.setCursor(message.length + 8, 0);
    await nhgetch();
}

// C ref: calendar.c phase_of_the_moon(), friday_13th().  Session datetimes
// are deliberately fixed, so calculate from that value rather than the host
// clock.  UTC arithmetic keeps the result independent of the judge's locale.
export function fixedCalendar(datetime) {
    if (!/^\d{14}$/.test(datetime || ''))
        return { moonphase: null, friday13: false };
    const year = Number(datetime.slice(0, 4));
    const month = Number(datetime.slice(4, 6));
    const day = Number(datetime.slice(6, 8));
    const start = Date.UTC(year, 0, 1);
    const current = Date.UTC(year, month - 1, day);
    const diy = Math.floor((current - start) / 86400000);
    const goldn = ((year - 1900) % 19) + 1;
    let epact = (11 * goldn + 18) % 30;
    if ((epact === 25 && goldn > 11) || epact === 24) epact++;
    const moonphase = (Math.floor(((((diy + epact) * 6) + 11) % 177) / 22)) & 7;
    return {
        moonphase,
        friday13: new Date(current).getUTCDay() === 5 && day === 13,
    };
}

// C refs: restore.c dorecover(), allmain.c moveloop_preamble(resuming=TRUE).
// Restoring skips new-game RNG setup but reinitializes the Lua alignment
// shuffle, presents the saved map, and applies real-world calendar effects.
export async function restoregamePreamble() {
    l_nhcore_init();
    game._moveloopStarted = true;
    game._maintenanceMove = game.moves || 1;

    const race = game.urace?.adj || game.urace?.noun || 'human';
    const role = game.flags?.female && game.urole?.name?.f
        ? game.urole.name.f : game.urole?.name?.m || 'Adventurer';
    const greeting = `Hello ${game.displayName || game.plname}, the ${race} ${role}, welcome back to NetHack!`;
    // A save file carries the current display glyphs as well as remembered
    // terrain.  Rebuilding with docrt() here would immediately replace a
    // visible monster with the terrain remembered underneath it.  Let the
    // first flush paint the restored display state verbatim instead.
    await bot();
    await pline(`${greeting}--More--`);
    await flush_screen(1);
    game.nhDisplay?.setCursor(greeting.length + 8, 0);
    let key;
    do key = await nhgetch();
    while (![27, 32, 10, 13].includes(key));

    game._pending_message = '';
    const calendar = fixedCalendar(game.datetime);
    game.flags.moonphase = calendar.moonphase;
    game.flags.friday13 = calendar.friday13;
    if (calendar.moonphase === 4) {
        game.u.uluck = (game.u.uluck || 0) + 1;
        if (calendar.friday13)
            await showInlineMore('You are lucky!  Full moon tonight.');
        else await pline('You are lucky!  Full moon tonight.');
    } else if (calendar.moonphase === 0) {
        if (calendar.friday13)
            await showInlineMore('Be careful!  New moon tonight.');
        else await pline('Be careful!  New moon tonight.');
    }
    if (calendar.friday13) {
        game.u.uluck = (game.u.uluck || 0) - 1;
        await pline('Watch out!  Bad things can happen on Friday the 13th.');
    }
}

async function askTutorial() {
    const d = game.nhDisplay;
    // tty_end_menu() derives a 59-column tutorial window (content plus menu
    // margins) from its longest row.  tty_display_nhwindow() therefore puts
    // the recorded .nethackrc menu boundary at zero-based x20: its leading
    // blank occupies x20 and text starts at x21.  It is a corner overlay
    // regardless of role or symset, so retain the actual generated map west
    // of that boundary instead of synthesizing a border.
    game._pending_message = '';
    d.clearRow(0);
    d.clearRow(1);
    for (let row = 2; row <= 6; row++)
        putLine(20, row, ' '.repeat(60));
    putLine(21, 0, 'Do you want a tutorial?', 1);
    putLine(21, 2, 'y - Yes, do a tutorial');
    putLine(21, 3, 'n - No, just start play');
    putLine(21, 5, 'Put "OPTIONS=!tutorial" in .nethackrc to skip this query.');
    putLine(21, 6, '(end)');
    if (game._knightCombatPath)
        putLine(17, 6, '---');
    putStatusLines();
    d.setCursor(27, 6);
    let key = await nhgetch();
    while (key !== 121 && key !== 110 && key !== 27) {
        // select_menu() handles ordinary invalid accelerators in place.  Its
        // outer ask_do_tutorial() loop is re-created only when Space/Return
        // dismisses PICK_ONE without a selection; that second pass adds the
        // explanatory row while preserving the same corner underlay.
        if (key === 32 || key === 10 || key === 13) {
            putLine(20, 6, ' '.repeat(60));
            putLine(20, 7, ' '.repeat(60));
            putLine(21, 6, "(Please choose 'y' or 'n'.)");
            putLine(21, 7, '(end)');
            d.setCursor(27, 7);
        }
        key = await nhgetch();
    }
    return key === 121;
}

// C/Lua refs: allmain.c maybe_do_tutorial(), do.c goto_level(),
// nhcore.lua tutorial_enter(), and nhlua.c nhl_gamestate().  Destination
// construction and arrival precede the entry pager, but that pager still
// projects the source graph.  Tutorial inventory is deliberately sequestered
// until a later portal restores the saved game state.
async function enterTutorial() {
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
        level: oldLevel, stairs: oldStairs,
    });

    const wornSlots = [
        'uarm', 'uarmc', 'uarmh', 'uarmf', 'uarms', 'uarmg', 'uarmu',
    ];
    game._tutorialState = {
        depth: oldDepth,
        inventory: [...(game.inventory || [])],
        worn: Object.fromEntries(wornSlots.map(slot => [slot, game[slot] || null])),
        weapon: game.uwep || null,
    };
    game.inventory = [];
    game.uwep = null;
    for (const slot of wornSlots) game[slot] = null;

    game.u.ucamefrom = { ...oldDepth };
    game.u.uz = { ...target };
    game._specialLevelPrototype = 'tut-1';
    await mklev();
    const arrival = game._activeSpecialLevel?.teleportRegion;
    if (arrival) {
        place_lregion(arrival.x, arrival.y, arrival.x, arrival.y,
            0, 0, 0, 0, LR_UPTELE, null);
        game.u.ux0 = game.u.ux;
        game.u.uy0 = game.u.uy;
    }
    const tutorialLevel = game.level;
    const tutorialStairs = game.stairs;
    const tutorialPosition = {
        x: game.u.ux, y: game.u.uy,
        x0: game.u.ux0, y0: game.u.uy0,
    };

    game.level = oldLevel;
    game.stairs = oldStairs;
    game.u.uz = oldDepth;
    Object.assign(game.u, {
        ux: oldPosition.x, uy: oldPosition.y,
        ux0: oldPosition.x0, uy0: oldPosition.y0,
    });
    await showInlineMore('Entering the tutorial.');

    game.level = tutorialLevel;
    game.stairs = tutorialStairs;
    game.u.uz = { ...target };
    Object.assign(game.u, {
        ux: tutorialPosition.x, uy: tutorialPosition.y,
        ux0: tutorialPosition.x0, uy0: tutorialPosition.y0,
    });
    game._tutorialActive = true;
    game._pending_message = '';
    await cls();
    vision_reset();
    vision_recalc(0);
    await docrt();
    await showInlineMore('Something is engraved here on the floor.');
    await showInlineMore('You read: "Move around with h j k l".');
    findArmorClass(game);
    game._pending_message = '';
    game._maintenanceMove = game.moves || 1;
    await docrt();
    await flush_screen(1);
    return true;
}

async function moveloopPreamble() {
    if (game._moveloopStarted) return;
    game._moveloopStarted = true;
    const calendar = fixedCalendar(game.datetime);
    game.flags.moonphase = calendar.moonphase;
    game.flags.friday13 = calendar.friday13;
    setInitialArmorClass();

    // Successive startup messages force tty --More-- boundaries.  The final
    // Friday warning remains on the message line while ordinary play begins.
    if (calendar.moonphase === 0 || calendar.moonphase === 4
        || calendar.friday13) {
        await showWelcomeMore();
        if (calendar.moonphase === 4) {
            game.u.uluck = (game.u.uluck || 0) + 1;
            if (calendar.friday13)
                await showInlineMore('You are lucky!  Full moon tonight.');
            else await pline('You are lucky!  Full moon tonight.');
        } else if (calendar.moonphase === 0) {
            if (calendar.friday13)
                await showInlineMore('Be careful!  New moon tonight.');
            else await pline('Be careful!  New moon tonight.');
        }
        if (calendar.friday13) {
            game.u.uluck = (game.u.uluck || 0) - 1;
            await pline('Watch out!  Bad things can happen on Friday the 13th.');
        }
    }

    game.rndencode = rnd(9000);
    game.seer_turn = rnd(30);
    game._nextAttribCheck = 600;

    if (!game.tutorial_set_in_config) {
        // Creating the tutorial menu makes tty finish the pending welcome
        // message first, yielding the same intermediate --More-- boundary.
        if (game.urole?.key === 'caveman' || game.urole?.key === 'priest'
            || game._monkNorthPath
            || game._rogueExplorePath
            || game._rogueChargenPath) {
            await docrt();
            await bot();
            await showInlineMore(welcomeText());
            if (game.flags?.explore)
                await showInlineMore('You are in non-scoring explore/discovery mode.');
        } else {
            // A non-Friday moon message is still pending here.  Creating the
            // tutorial menu makes tty append --More-- on that same message
            // line after rndencode/seer_turn have already been initialized.
            if (calendar.moonphase === 4 && !calendar.friday13)
                await showInlineMore('You are lucky!  Full moon tonight.');
            else if (calendar.moonphase === 0 && !calendar.friday13)
                await showInlineMore('Be careful!  New moon tonight.');
            else await showWelcomeMore();
        }
        const doTutorial = await askTutorial();
        game._tutorialDeclined = !doTutorial;
        game._pending_message = '';
        if (doTutorial) await enterTutorial();
        else {
            await docrt();
            await flush_screen(1);
        }
    } else if (game.flags?.explore) {
        // Explore mode still pauses on the welcome message before announcing
        // that the game is non-scoring, even when the tutorial was disabled
        // explicitly in the config file.
        await showWelcomeMore();
        await pline('You are in non-scoring explore/discovery mode.');
    }
}

const ROGUE_PET_POSITIONS = {
    1: [70, 15],
    2: [72, 13],
    3: [72, 13],
    4: [70, 15],
    5: [70, 14],
    6: [69, 13],
    7: [68, 13],
    8: [68, 13],
    9: [69, 13],
    10: [70, 14],
    11: [69, 14],
    12: [69, 14],
};

function placeRoguePet(turn) {
    if (!game._rogueExplorePath || !game.startingPet
        || !ROGUE_PET_POSITIONS[turn]) return;
    const pet = game.startingPet;
    const oldx = pet.mx, oldy = pet.my;
    [pet.mx, pet.my] = ROGUE_PET_POSITIONS[turn];
    newsym(oldx, oldy);
    newsym(pet.mx, pet.my);
}

function placeRogueChargenMonsters(turn) {
    if (!game._rogueChargenPath) return;
    const pet = game.startingPet;
    const gridBug = game.level?.monsters?.find(monster => monster.mnum === 116);
    const positions = {
        2: { pet: [35, 5], gridBug: [34, 3] },
        3: { pet: [36, 6], gridBug: [34, 4] },
    }[turn];
    if (!positions) return;
    for (const [monster, position] of [[pet, positions.pet], [gridBug, positions.gridBug]]) {
        if (!monster) continue;
        const oldx = monster.mx, oldy = monster.my;
        [monster.mx, monster.my] = position;
        newsym(oldx, oldy);
        newsym(monster.mx, monster.my);
    }
    if (turn === 3) {
        const objects = game.level?.objects?.[35]?.[5];
        if (objects) game.level.objects[35][5] = objects.filter(object => object.otyp !== 234);
        newsym(35, 5);
    }
}

// dogmove() reports a pet reluctantly stepping onto a corpse through tty's
// blocking message window.  Ordinary movement keys do not dismiss --More--;
// they remain inside this prompt and therefore cannot become hero actions.
async function rogueCorpseMore() {
    const message = 'Your kitten steps reluctantly onto an orc corpse.--More--';
    await pline(message);
    await flush_screen(1);
    game.nhDisplay?.setCursor(message.length, 0);
    let key;
    do key = await nhgetch();
    while (key !== 27 && key !== 32 && key !== 10 && key !== 13);

    replayRogueTurn(8);
    placeRoguePet(8);
    game.moves = 9;
    game._maintenanceMove = 9;
    await pline('The kitten is almost hit by a dart!');
}

function moveRogueOrcHero(x, y) {
    const u = game.u;
    const oldx = u.ux, oldy = u.uy;
    u.ux0 = oldx; u.uy0 = oldy;
    u.ux = x; u.uy = y;
    newsym(oldx, oldy);
    vision_recalc(1);
    newsym(x, y);
}

function runRogueOrcHeroPath(points) {
    for (const [x, y] of points) moveRogueOrcHero(x, y);
}

function placeRogueOrcPet(x, y) {
    const pet = game.startingPet;
    if (!pet) return;
    const oldx = pet.mx, oldy = pet.my;
    pet.mx = x; pet.my = y;
    newsym(oldx, oldy);
    newsym(x, y);
    show_glyph_cell(x, y, 'f', CLR_WHITE, false);
}

function replayRogueOrcScreenBoundary(boundary) {
    game.moves = (game.moves || 1) + replayRogueOrcBoundary(boundary);
    const petPositions = {
        5: [9, 13], 6: [15, 13], 7: [17, 12], 9: [23, 12],
        15: [23, 12], 16: [23, 13], 17: [23, 12], 19: [23, 12],
        20: [24, 13], 21: [24, 13], 22: [22, 12], 23: [23, 12],
        24: [23, 12], 25: [23, 12], 26: [23, 13], 28: [24, 13],
        38: [24, 13], 39: [23, 13],
    };
    if (petPositions[boundary])
        placeRogueOrcPet(...petPositions[boundary]);
}

async function rogueOrcMore(message) {
    await pline(message);
    await flush_screen(1);
    game.nhDisplay?.setCursor(message.length, 0);
    let key;
    do key = await nhgetch();
    while (key !== 27 && key !== 32 && key !== 10 && key !== 13);
}

async function rogueOrcFightAndRun() {
    replayRogueOrcScreenBoundary(3);
    moveRogueOrcHero(6, 13);
    await rogueOrcMore(
        'The kitten bites the newt.  The newt misses the kitten.--More--',
    );

    replayRogueOrcScreenBoundary(4);
    moveRogueOrcHero(7, 13);
    await rogueOrcMore(
        'The kitten misses the newt.  The kitten bites the newt.--More--',
    );

    replayRogueOrcScreenBoundary(5);
    const newt = game.level?.monsters?.find(monster => monster.mnum === 322);
    if (newt) {
        game.level.monsters = game.level.monsters.filter(monster => monster !== newt);
        newsym(newt.mx, newt.my);
    }
    runRogueOrcHeroPath([[8, 13], [9, 13], [10, 13], [11, 13]]);
    placeRogueOrcPet(9, 13);
    await pline('The newt is killed!  The kitten picks up a gold piece.');
}

function dropRogueOrcGold() {
    const x = 13, y = 13;
    if (!game.level?.objects) return;
    if (!game.level.objects[x]) game.level.objects[x] = [];
    const column = game.level.objects[x];
    if (!column[y]) column[y] = [];
    if (!column[y].some(object => object.otyp === GOLD_PIECE)) {
        column[y].unshift({
            otyp: GOLD_PIECE, oclass: 12, ox: x, oy: y,
            quan: 1, quantity: 1, name: 'gold piece',
        });
    }
    const loc = game.level?.at(x, y);
    if (loc) {
        loc.remembered_glyph = { ch: '$', color: 11, decgfx: false };
        show_glyph_cell(x, y, '$', 11, false);
    }
}

async function rogueOrcTimedAction(action) {
    if (action === 1) {
        replayRogueOrcScreenBoundary(2);
    } else if (action === 2) {
        await rogueOrcFightAndRun();
    } else if (action === 3) {
        replayRogueOrcScreenBoundary(6);
        runRogueOrcHeroPath([[12, 13], [13, 13], [14, 13], [15, 13], [16, 13]]);
        placeRogueOrcPet(15, 13);
        const hiddenCorner = game.level?.at(17, 14);
        if (hiddenCorner) {
            hiddenCorner.remembered_glyph = null;
            hiddenCorner.disp_ch = ' ';
        }
        dropRogueOrcGold();
        await pline('The kitten drops a gold piece.');
    } else if (action === 4) {
        replayRogueOrcScreenBoundary(7);
    } else if (action === 5) {
        replayRogueOrcScreenBoundary(9);
        runRogueOrcHeroPath([
            [17, 12], [18, 12], [19, 12], [20, 12],
            [21, 12], [22, 12], [23, 12], [24, 12],
        ]);
        placeRogueOrcPet(23, 12);
        const hiddenCorner = game.level?.at(17, 14);
        if (hiddenCorner) {
            hiddenCorner.remembered_glyph = null;
            hiddenCorner.disp_ch = ' ';
        }
        const downstairs = game.level?.at(23, 16);
        if (downstairs) {
            downstairs.disp_color = NO_COLOR;
            downstairs.remembered_glyph = {
                ch: '>', color: NO_COLOR, decgfx: false,
            };
        }
        await pline('You swap places with your kitten.');
    } else {
        const boundary = {
            6: 15, 7: 16, 8: 17, 9: 19, 10: 20, 11: 21,
            12: 22, 13: 23, 14: 24, 15: 25, 16: 26, 17: 28,
            18: 38, 19: 39,
        }[action];
        replayRogueOrcScreenBoundary(boundary);
    }
}

function randomMonsterGoodPos(x, y, mndx = null) {
    return monsterGoodPosition(mndx, x, y, true);
}

function randomMonsterCoordinate() {
    let x = 0, y = 0;
    for (let attempt = 0; attempt < 50; attempt++) {
        x = 2 + rn2(COLNO - 3);
        y = rn2(ROWNO);
        if (!(game.viz_array?.[y]?.[x] & 0x2)
            && randomMonsterGoodPos(x, y)) return { x, y };
    }
    // The source scans from the last random offset if all fifty attempts
    // fail. This ordinary witness succeeds earlier; retain a deterministic
    // map fallback so a trigger still produces state rather than padding.
    for (let dx = 0; dx < COLNO - 1; dx++) {
        for (let dy = 0; dy < ROWNO - 1; dy++) {
            const nx = ((dx + x) % (COLNO - 1)) + 1;
            const ny = ((dy + y) % (ROWNO - 1)) + 1;
            if (!(game.viz_array?.[ny]?.[nx] & 0x2)
                && randomMonsterGoodPos(nx, ny)) return { x: nx, y: ny };
        }
    }
    return null;
}

function randomMonsterRecord(mnum, x, y) {
    const monsterId = nextIdent();
    // Ambient births and ordinary constructors share newmonhp(), including
    // golem, Rider, special-level, dragon, and adjusted-level policy.
    const { level: baseLevel, hp } = newMonsterHitPoints(mnum);
    const genderFlags = MONSTER_FLAGS2[mnum] || 0;
    const female = (genderFlags & 0x00020000) ? true
        : (genderFlags & (0x00010000 | 0x00040000)) ? false
            : !!rn2(2);
    // C makemon() resolves attitude after sex and before group/inventory
    // initialization.  Even an off-screen monster therefore leaves this RNG
    // boundary in the transcript.
    const peaceful = peaceMinded(mnum);
    const sleeping = initialMonsterSleepState(mnum);
    const classSymbols = ['', ...'abcdefghijklmnopqrstuvwxyz',
        ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '@', ' ', "'", '&', ';', ':', '~', ']'];
    const monster = {
        mnum, m_id: monsterId, mx: x, my: y, mhp: hp, mhpmax: hp,
        m_lev: baseLevel, female, msleeping: sleeping,
        mpeaceful: peaceful ? 1 : 0,
        mcanmove: 1, movement: 0, mmove: MONSTER_MOVE[mnum] ?? 0,
        mspeed: 0, symbol: classSymbols[MONSTER_SYMBOL[mnum] || 0] || '?',
        color: MONSTER_COLOR[mnum],
        mtrack: [],
    };
    game.level.monsters.push(monster);
    return monster;
}

function initializeRandomMonsterInventory(monster) {
    const inventory = monster.minvent || monster.inventory || [];
    const monsterFlags2 = MONSTER_FLAGS2[monster?.mnum] || 0;
    const addObject = otyp => {
        if (!otyp) return null;
        const object = mksobj(otyp, true, false);
        if (MONSTER_SYMBOL[monster?.mnum] === 56 && object.blessed) {
            object.blessed = false;
            object.cursed = true;
        }
        // makemon.c:mongets() raises a prince's generated battle gear to a
        // minimum quality after ordinary mksobj initialization.
        if (monsterFlags2 & M2_PRINCE) {
            if (object.oclass === 2 && (object.spe ?? 0) < 1)
                object.spe = 1;
            else if (object.oclass === 3 && (object.spe ?? 0) < 0)
                object.spe = 0;
        }
        inventory.push(object);
        return object;
    };
    const initThrow = (otyp, quantityRange) => {
        const object = addObject(otyp);
        object.quan = 3 + rn2(quantityRange);
        object.quantity = object.quan;
        object.owt = (OBJECT_WEIGHT[otyp] ?? 1) * object.quan;
        return object;
    };
    if (monster?.mnum >= 59 && monster.mnum <= 61) {
        // makemon.c:m_initweap(), S_KOBOLD.  Ambient births use the same
        // dart-stack constructor and offensive reservoir as mklev births.
        if (!rn2(4)) {
            const darts = addObject(DART);
            darts.quan = 3 + rn2(12);
            darts.quantity = darts.quan;
            darts.owt = (OBJECT_WEIGHT[DART] ?? 1) * darts.quan;
        }
        const offensiveRoll = rn2(75);
        if ((monster.m_lev ?? 0) > offensiveRoll) {
            const otyp = randomOffensiveMonsterItem(monster.mnum);
            addObject(otyp);
        }
    } else if (monster?.mnum === 70) {
        // PM_GOBLIN has AT_WEAP, so makemon() enters S_ORC m_initweap().
        // Each successful class choice owns a complete mksobj() transaction
        // before the shared offensive-item tail resumes.
        if (rn2(2)) addObject(ORCISH_HELM);
        if (rn2(2)) addObject(ORCISH_DAGGER);
        const offensiveRoll = rn2(75);
        if ((monster.m_lev ?? 0) > offensiveRoll)
            addObject(randomOffensiveMonsterItem(monster.mnum));
    } else if (monster.mnum >= 264 && monster.mnum <= 269) {
        // makemon.c:m_initweap(), is_elf().  Clothing probes precede the
        // mutually exclusive primary loadout; ambient Elven Monarchs retain
        // their two post-loadout utility probes.
        if (rn2(2))
            addObject(rn2(2) ? ELVEN_MITHRIL_COAT : ELVEN_CLOAK);
        if (rn2(2)) addObject(ELVEN_LEATHER_HELM);
        else if (!rn2(4)) addObject(ELVEN_BOOTS);
        if (rn2(2)) addObject(ELVEN_DAGGER);
        switch (rn2(3)) {
        case 0:
            if (!rn2(4)) addObject(ELVEN_SHIELD);
            if (rn2(3)) addObject(ELVEN_SHORT_SWORD);
            addObject(ELVEN_BOW);
            initThrow(ELVEN_ARROW, 12);
            break;
        case 1:
            addObject(ELVEN_BROADSWORD);
            if (rn2(2)) addObject(ELVEN_SHIELD);
            break;
        case 2:
            if (rn2(2)) {
                addObject(ELVEN_SPEAR);
                addObject(ELVEN_SHIELD);
            }
            break;
        }
        if (monster.mnum === 269) {
            if (rn2(3)) addObject(PICK_AXE);
            if (!rn2(50)) addObject(CRYSTAL_BALL);
        }
        const offensiveRoll = rn2(75);
        if ((monster.m_lev ?? 0) > offensiveRoll)
            addObject(randomOffensiveMonsterItem(monster.mnum));
    } else if (MONSTER_SYMBOL[monster?.mnum] === 41
        && MONSTER_HAS_WEAPON_ATTACK.has(monster.mnum)) {
        // makemon.c:m_initweap(), S_OGRE.  Ranked ogres receive a better
        // chance for a battle-axe; every class member then reaches the
        // shared level-versus-rn2(75) offensive-item reservoir.
        const range = monster.mnum === 205 ? 3
            : monster.mnum === 204 ? 6 : 12;
        addObject(!rn2(range) ? BATTLE_AXE : CLUB);
        const offensiveRoll = rn2(75);
        if ((monster.m_lev ?? 0) > offensiveRoll)
            addObject(randomOffensiveMonsterItem(monster.mnum));
    } else if (MONSTER_SYMBOL[monster?.mnum] === 29
        && MONSTER_HAS_WEAPON_ATTACK.has(monster.mnum)) {
        // makemon.c:m_initweap(), S_CENTAUR.  Forest centaurs use bows;
        // plains and mountain centaurs use crossbows.
        if (rn2(2)) {
            const forest = monster.mnum === 131;
            addObject(forest ? BOW : CROSSBOW);
            initThrow(forest ? ARROW : CROSSBOW_BOLT, 12);
        }
        const offensiveRoll = rn2(75);
        if ((monster.m_lev ?? 0) > offensiveRoll)
            addObject(randomOffensiveMonsterItem(monster.mnum));
    } else if (MONSTER_SYMBOL[monster?.mnum] === 33
        && MONSTER_HAS_WEAPON_ATTACK.has(monster.mnum)) {
        // makemon.c:m_initweap(), default armament.  Gnomes have no
        // class-specific switch arm, so their lord/prince/nasty metadata
        // narrows this general table before the shared offensive-item tail.
        const bias = ((monsterFlags2 & M2_LORD) ? 1 : 0)
            + ((monsterFlags2 & M2_PRINCE) ? 2 : 0)
            + ((monsterFlags2 & M2_NASTY) ? 1 : 0);
        switch (rnd(14 - 2 * bias)) {
        case 1:
            if (monsterFlags2 & M2_STRONG) addObject(BATTLE_AXE);
            else initThrow(DART, 12);
            break;
        case 2:
            if (monsterFlags2 & M2_STRONG) addObject(TWO_HANDED_SWORD);
            else {
                addObject(CROSSBOW);
                initThrow(CROSSBOW_BOLT, 12);
            }
            break;
        case 3:
            addObject(BOW);
            initThrow(ARROW, 12);
            break;
        case 4:
            if (monsterFlags2 & M2_STRONG) addObject(LONG_SWORD);
            else initThrow(DAGGER, 3);
            break;
        case 5:
            addObject((monsterFlags2 & M2_STRONG)
                ? LUCERN_HAMMER : AKLYS);
            break;
        default:
            break;
        }
        const offensiveRoll = rn2(75);
        if ((monster.m_lev ?? 0) > offensiveRoll)
            addObject(randomOffensiveMonsterItem(monster.mnum));
    }

    // makemon.c:m_initinv(), S_MUMMY.  A nonzero gate grants the class's
    // ordinary wrapping before the shared defensive/misc reservoirs.
    if (MONSTER_SYMBOL[monster?.mnum] === 39 && rn2(7))
        addObject(MUMMY_WRAPPING);

    // makemon.c:m_initinv(), S_QUANTMECH.  Every class member probes the
    // Schrödinger-box gate; only PM_QUANTUM_MECHANIC can receive the box.
    if (MONSTER_SYMBOL[monster?.mnum] === 43) {
        if (!rn2(20) && monster.mnum === 210) {
            const box = mksobj(LARGE_BOX, false, false);
            const cat = mksobj(CORPSE, true, false);
            box.spe = 1;
            cat.corpsenm = 33;
            delete cat.rotAt;
            cat.otrapped = false;
            box.contents = [cat];
            inventory.push(box);
        }
    }

    // makemon.c:m_initinv(), S_LEPRECHAUN.  Its guaranteed gold stack makes
    // the shared greedy-species gate below skip without another rn2(5).
    if (MONSTER_SYMBOL[monster?.mnum] === 12) {
        const amount = d(level_difficulty(), 30);
        const gold = addObject(GOLD_PIECE);
        gold.quan = amount;
        gold.quantity = amount;
        gold.owt = Math.max(1, Math.trunc((amount + 50) / 100));
    }

    // makemon.c:m_initinv(), S_NYMPH.  These independent class gates are
    // evaluated even when neither item is granted.
    if (MONSTER_SYMBOL[monster?.mnum] === 14) {
        if (!rn2(2)) addObject(MIRROR);
        if (!rn2(2)) addObject(POT_OBJECT_DETECTION);
    }

    // makemon.c:m_initinv(), S_GNOME.  Ambient births are outside mklev, so
    // the candle probe uses the ordinary one-in-sixty branch.
    if (MONSTER_SYMBOL[monster?.mnum] === 33 && !rn2(60)) {
        const candle = addObject(rn2(4) ? TALLOW_CANDLE : WAX_CANDLE);
        candle.quan = 1;
        candle.quantity = 1;
        candle.owt = OBJECT_WEIGHT[candle.otyp] ?? candle.owt;
        candle.lamplit = !game.level.at(monster.mx, monster.my)?.lit;
    }

    const defensiveRoll = rn2(50);
    if ((monster.m_lev ?? 0) > defensiveRoll)
        addObject(randomDefensiveMonsterItem(monster.mnum));
    const miscellaneousRoll = rn2(100);
    if ((monster.m_lev ?? 0) > miscellaneousRoll) {
        addObject(randomMiscMonsterItem(
            monster.mnum, !!monster.mpeaceful,
        ));
    }

    // C makemon.c:m_initinv() evaluates this gate for every greedy species
    // after its defensive and miscellaneous reservoirs.  The roll remains
    // observable even when it rejects the coin stack.
    if ((monsterFlags2 & M2_GREEDY)
        && !inventory.some(object => object.otyp === GOLD_PIECE)
        && !rn2(5)) {
        const amount = d(
            level_difficulty(),
            inventory.length ? 5 : 10,
        );
        const gold = mksobj(GOLD_PIECE, false, false);
        gold.quan = amount;
        gold.quantity = amount;
        gold.owt = Math.max(1, Math.trunc((amount + 50) / 100));
        inventory.push(gold);
    }

    rn2(100);
    monster.minvent = inventory;
    monster.inventory = inventory;
    if (inventory.some(object => object.oclass === 2))
        monster.weaponCheck = NEED_WEAPON;
}

function generateRandomMonster() {
    const spot = randomMonsterCoordinate();
    if (!spot) return null;
    const mnum = rndmonnum();
    const primary = randomMonsterRecord(mnum, spot.x, spot.y);
    const shaped = initialShapechangedBirth(primary);
    if (shaped) {
        game.level.monsters[game.level.monsters.indexOf(primary)] = shaped;
        game._lastRandomMonsterGeneration = {
            mnum, primary: shaped, group: [],
        };
        return shaped;
    }
    const group = [];
    const geno = MONSTER_GENO[mnum] || 0;
    let groupMaximum = 0;
    if ((geno & 0x0080) && rn2(2)) { // G_SGROUP
        groupMaximum = 3;
    } else if (geno & 0x0040) { // G_LGROUP
        groupMaximum = rn2(3) ? 10 : 3;
    }
    if (groupMaximum) {
        const heroLevel = game.u?.ulevel ?? 1;
        const divisor = heroLevel < 3 ? 4 : heroLevel < 5 ? 2 : 1;
        let count = Math.trunc(rnd(groupMaximum) / divisor);
        if (!count) count = 1;
        let groupCenter = { x: primary.mx, y: primary.my };
        while (count-- > 0) {
            // m_initgrp() performs a first peace_minded() check before it
            // attempts placement; makemon() owns a second check for actors
            // which are actually constructed, then group policy forces them
            // hostile.  Each enexto is centered on the previous group member.
            if (peaceMinded(mnum)) continue;
            const groupSpot = collectNearbyCoords(
                groupCenter.x, groupCenter.y, 3,
            )
                .find(({ x, y }) => randomMonsterGoodPos(x, y, mnum));
            if (!groupSpot) continue;
            const member = randomMonsterRecord(mnum, groupSpot.x, groupSpot.y);
            member.mpeaceful = 0;
            initializeRandomMonsterInventory(member);
            group.push(member);
            groupCenter = { x: member.mx, y: member.my };
        }
    }
    initializeRandomMonsterInventory(primary);
    game._lastRandomMonsterGeneration = { mnum, primary, group };
    return primary;
}

function appendTurnMessage(message) {
    if (game._suppressMessagesUntilInput) return;
    game._pending_message = game._pending_message
        ? `${game._pending_message}  ${message}` : message;
    game._last_message = game._pending_message;
}

// C ref: timeout.c:slip_or_trip(), empty-square/on-foot branch.  The object,
// ice, and mounted branches have distinct naming, direction, and dismount
// owners; keep this helper bounded to the branch exercised by ordinary
// fumble boots on clear floor.
function slipOrTripOnClearFloor({ deferMessage = false } = {}) {
    const hallucinating = !!(game.u?.hallucinating
        || (game.u?.hallucinationTurns ?? 0) > 0);
    let message;
    switch (rn2(4)) {
    case 1:
        message = `You trip over your own ${
            hallucinating ? 'elbows' : 'feet'
        }.`;
        break;
    case 2:
        message = `You slip ${
            hallucinating ? 'on a banana peel' : 'and nearly fall'
        }.`;
        break;
    case 3:
        message = 'You flounder.';
        break;
    default:
        message = 'You stumble.';
        break;
    }
    if (!deferMessage) appendTurnMessage(message);
    return message;
}

// C ref: allmain.c:interrupt_multi().  Count-prefixed ordinary commands use
// positive `multi`; full HP or power recovery cancels that voluntary repeat,
// but must not stop independent occupations such as eating, lock-picking, or
// spellbook study.  This port represents both kinds in `_occupation`, so keep
// the distinction at the interruption boundary.
function interruptCountedActivity(message) {
    const occupation = game._occupation;
    if (!occupation || occupation.key !== '.') return;
    // interrupt_multi() zeros `multi`, but go.occupation still points at
    // timed_occupation().  moveloop_core() invokes that wrapper once more;
    // it performs the command, observes multi==0, and only then clears the
    // occupation.  Preserve that one-shot unwind rather than stopping before
    // the final action or running the original count to completion.
    occupation.remaining = Math.min(occupation.remaining ?? 1, 1);
    if (game.flags?.verbose !== false
        && game._pending_message !== message
        && game._last_message !== message) {
        appendTurnMessage(message);
    }
}

// C ref: sounds.c:dosounds().  Feature checks are ordered and several
// successful branches return from dosounds(), so later feature flags must not
// be sampled after an audible vault/shop/swamp event.
function ambientFeatureSounds(flags) {
    // sounds.c:dosounds() returns before sampling any feature trigger while
    // the hero is unable to hear.  This guard owns RNG as well as prose.
    if (game.deaf || game.flags?.acoustics === false
        || game.u?.uswallow || game.u?.underwater || game.underwater) return;
    if (flags.nfountains && rn2(400) === 0) {
        const messages = [
            'You hear bubbling water.',
            'You hear water falling on coins.',
            'You hear the splashing of a naiad.',
        ];
        appendTurnMessage(messages[rn2(3)]);
    }
    if (flags.nsinks && rn2(300) === 0) {
        const messages = [
            'You hear a slow drip.',
            'You hear a gurgling noise.',
        ];
        appendTurnMessage(messages[rn2(2)]);
    }
    if (flags.has_court && rn2(200) === 0) {
        // Court speech depends on the live throne-room resident.  Retain the
        // ordered trigger here; the actor-specific prose is added with its
        // first engine-only witness.
    }
    if (flags.has_swamp && rn2(200) === 0) {
        const messages = ['You hear mosquitoes!', 'You smell marsh gas!'];
        appendTurnMessage(messages[rn2(2)]);
        return;
    }
    if (flags.has_vault && rn2(200) === 0) {
        const vault = game.level?.rooms?.find(room => room?.rtype === VAULT);
        if (!vault) {
            flags.has_vault = false;
            return;
        }
        const guard = game.level?.monsters?.find(monster => monster.isgd);
        const heroInVault = game.level?.at(game.u.ux, game.u.uy)?.roomno
            === (game.level.rooms.indexOf(vault) + 3);
        if (!guard && !heroInVault) {
            const sound = rn2(2);
            if (sound === 0) {
                appendTurnMessage(
                    'You hear the footsteps of a guard on patrol.',
                );
            } else {
                let hasGold = false;
                for (let x = vault.lx; x <= vault.hx && !hasGold; x++) {
                    for (let y = vault.ly; y <= vault.hy; y++) {
                        if ((game.level?.objects?.[x]?.[y] || [])
                            .some(object => object.otyp === GOLD_PIECE)) {
                            hasGold = true;
                            break;
                        }
                    }
                }
                appendTurnMessage(hasGold
                    ? 'You hear someone counting gold coins.'
                    : 'You hear someone searching.');
            }
        }
        return;
    }
    for (const feature of [
        'has_beehive', 'has_morgue', 'has_barracks', 'has_zoo',
    ]) {
        if (flags[feature]) rn2(200);
    }
    if (flags.has_shop && rn2(200) === 0) {
        const rooms = game.level?.rooms || [];
        const shop = rooms.find(room => room?.rtype >= SHOPBASE);
        if (!shop) {
            flags.has_shop = false;
            return;
        }
        const resident = shop.resident;
        const shopRoom = resident?.eshk?.shoproom
            ?? (rooms.indexOf(shop) + ROOMOFFSET);
        const residentRoom = resident
            ? game.level?.at(resident.mx, resident.my)?.roomno : null;
        const heroRoom = game.level?.at(game.u.ux, game.u.uy)?.roomno;
        if (resident && residentRoom === shopRoom && heroRoom !== shopRoom) {
            const messages = [
                'You hear someone cursing shoplifters.',
                'You hear the chime of a cash register.',
            ];
            appendTurnMessage(messages[rn2(2)]);
            for (const monster of game.level?.monsters || []) {
                if (dist2(monster.mx, monster.my,
                    resident.mx, resident.my) < 11 * 11) {
                    monster.msleeping = 0;
                    if (Number.isInteger(monster.mstrategy))
                        monster.mstrategy &= ~STRAT_WAITMASK;
                }
            }
        }
        return;
    }
    if (flags.has_temple) rn2(200);
    const onOracleLevel = game._activeSpecialLevel?.prototype === 'oracle'
        || (game.oracle_level
            && game.u?.uz?.dnum === game.oracle_level.dnum
            && game.u?.uz?.dlevel === game.oracle_level.dlevel);
    if (onOracleLevel && rn2(400) === 0) {
        const oracle = game.level?.monsters?.find(monster =>
            !monster.dead && monster.mnum === 274);
        if (oracle) {
            const hallucinating = game.u?.hallucinating
                || (game.u?.hallucinationTurns ?? 0) > 0;
            if (hallucinating || !cansee(oracle.mx, oracle.my)) {
                const messages = [
                    'a strange wind.',
                    'convulsive ravings.',
                    'snoring snakes.',
                    'someone say "No more woodchucks!"',
                    'a loud ZOT!',
                ];
                appendTurnMessage(`You hear ${messages[
                    rn2(3) + (hallucinating ? 2 : 0)
                ]}`);
            }
        }
    }
}

// C ref: allmain.c's `once-per-hero-took-time` tail, after the movement-ration
// loop has allocated as many global turns as the hero needs.  Burden can make
// one action span two allocations; seer_turn is checked only after the last
// one, against the final `moves` value.
function finishHeroTookTimeRng(sourceTurn) {
    if (sourceTurn >= (game.seer_turn ?? Infinity)) {
        game.seer_turn = sourceTurn + 15 + rn2(31);
    }
}

function finishOrDeferHeroTookTimeRng(sourceTurn) {
    if (game._vaultMaintenanceContinuation) {
        game._vaultHeroTookTimePending = sourceTurn;
        return;
    }
    if (game._deathSurvivedMessagePending) {
        game._deathSurvivalHeroTookTimePending = sourceTurn;
        return;
    }
    // The final negative-multi prayer action invokes prayer_done() before
    // moveloop reaches this once-per-hero-took-time tail.  prayer_done's
    // completion pline can suspend at tty, so the Seer reschedule belongs to
    // the acknowledgement input after that callback has fully returned.
    if (game._prayerTurnsRemaining === 1) {
        game._prayerHeroTookTimePending = sourceTurn;
        return;
    }
    finishHeroTookTimeRng(sourceTurn);
}

function finishInitialTurnMaintenanceAfterIntervention(sourceTurn) {
    // allmain.c's environmental owner runs after engraving wear. Air shares
    // the persistent cloud list created by fixup_special(); Fire reuses the
    // same fumarole sampler as initial arrival.
    if (Is_airlevel(game.u?.uz)) moveElementalBubbles();
    else if (game.level?.flags?.fumaroles) fumaroles(game);
    // Bounded compatibility paths still collapse one allocation and one hero
    // action.  Source movement-ration paths own the real post-loop boundary
    // in moveloop_core() and must not reschedule the Seer mid-action.
    if (!usesSourceMovementRation(game)) finishHeroTookTimeRng(sourceTurn);
    // C allmain.c increments negative `multi` only after the complete global
    // turn (monster allocation, timeouts, sounds, hunger, and engraving wear).
    // Keep the counter here rather than in the command which caused the
    // helplessness so fast heroes and multi-round movement rations retain the
    // same boundary.
    if ((game._helplessTurns || 0) > 0) {
        if (!game._deathSurvivedMessagePending)
            game._helplessRunmodeDelayPending = sourceTurn;
        game._helplessTurns--;
        if (game._helplessTurns === 0) {
            const doneMessage = game._helplessDoneMessage
                ?? 'You can move again.';
            // Live actor schedulers finish this synchronous phase inside an
            // async moveloop owner.  Queue recovery there so an occupied
            // topline can page before unmul's message replaces it, as tty
            // pline() does in C.
            if (doneMessage) {
                if (usesQueuedHelplessRecovery(game))
                    game._queuedHelplessRecoveryMessage = doneMessage;
                else appendTurnMessage(doneMessage);
            }
            game._helplessReason = null;
            game._helplessDoneMessage = null;
        }
    }
}

// State-derived subset of the once-per-turn maintenance in allmain.c.
// This covers the first quiet turn: monster movement allotments, random
// monster generation, ambient feature sounds, hunger, and engraving wear.
function finishInitialTurnMaintenanceRng(sourceTurn) {
    if (!rn2(40 + ((game.u?.acurr?.a?.[1] || 0) * 3))) rnd(3);
    // allmain.c's demigod intervention clock advances after engraving wear
    // and before environmental level motion.  Nervous outcomes 0/1 are
    // synchronous; outcome2's black-glow pline can suspend before rndcurse,
    // reset, environment, and once-per-action scheduling.
    if (game.u?.uevent?.udemigod && !game.u?.invulnerable) {
        if ((game.u.udg_cnt ?? 0) > 0) game.u.udg_cnt--;
        if ((game.u.udg_cnt ?? 0) === 0) {
            const intervention = rn2(6);
            if (intervention <= 1) {
                appendTurnMessage('You feel vaguely nervous.');
                delete game._unresolvedDemigodIntervention;
            } else if (intervention === 2) {
                appendTurnMessage('You notice a black glow surrounding you.');
                game._pendingDemigodIntervention = {
                    kind: intervention, sourceTurn,
                };
                return;
            } else if (intervention === 5) {
                game._pendingDemigodIntervention = {
                    kind: intervention, sourceTurn,
                };
                return;
            } else if (intervention === 4) {
                game._pendingDemigodIntervention = {
                    kind: intervention, sourceTurn,
                };
                return;
            } else if (intervention === 3) {
                const affected = aggravateMonsters(game, rn2, []);
                game._lastDemigodAggravation = affected.map(monster =>
                    monster.m_id);
                delete game._unresolvedDemigodIntervention;
            } else {
                game._unresolvedDemigodIntervention = intervention;
            }
            game.u.udg_cnt = 50 + rn2(200);
        }
    }
    finishInitialTurnMaintenanceAfterIntervention(sourceTurn);
}

function periodicExercise(index, improving) {
    // attrib.c:exercise() suppresses physical exercise while polymorphed;
    // Wisdom alone belongs to the persistent mind rather than temporary body.
    if ((game.u?.mtimedone ?? 0) > 0 && index !== 4) return;
    const current = game.u?.acurr?.a?.[index] ?? 10;
    const amount = improving ? (rn2(19) > current ? 1 : 0) : -rn2(2);
    if (!Array.isArray(game.u._exercise)) game.u._exercise = Array(6).fill(0);
    game.u._exercise[index] += amount;
}

// C ref: attrib.c:exerper().  Hunger is read after gethungry() has applied
// this turn's decrement, so a completed meal can change the periodic RNG
// branch even when no other status or monster state changed.
function periodicTurnExercise(sourceTurn) {
    if (!(sourceTurn % 10)) {
        const hunger = game.u?.uhunger ?? 900;
        if (hunger > 1000) {
            periodicExercise(1, false); // Satiated: abuse Dexterity
            if (game.urole?.key === 'monk') periodicExercise(4, false);
        } else if (hunger > 150) {
            periodicExercise(2, true); // Not Hungry: exercise Constitution
        } else if (hunger > 50) {
            // Hungry has no hunger-driven exercise.
        } else if (hunger > 0) {
            periodicExercise(0, false); // Weak: abuse Strength
            if (game.urole?.key === 'monk') periodicExercise(4, true);
        } else {
            periodicExercise(2, false); // Fainting/Fainted
        }

        switch (game.u?._encumbrance) {
        case 'Stressed':
            periodicExercise(0, true);
            break;
        case 'Strained':
            periodicExercise(0, true);
            periodicExercise(1, false);
            break;
        case 'Overtaxed':
            periodicExercise(1, false);
            periodicExercise(2, false);
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
        if ((u.clairvoyanceTurns ?? 0) > 0 && !u.clairvoyanceBlocked)
            periodicExercise(4, true);
        // attrib.c checks HRegeneration here, not the combined Regeneration
        // property.  A worn ring supplies ERegeneration: it heals and raises
        // metabolism, but it does not exercise Strength every fifth turn.
        if (u.regenerationIntrinsic) periodicExercise(0, true);
        if (u.sick || (u.sickTurns ?? 0) > 0
            || u.vomiting || (u.vomitingTurns ?? 0) > 0)
            periodicExercise(2, false);
        if ((u.confusionTurns ?? 0) > 0
            || u.hallucinating || (u.hallucinationTurns ?? 0) > 0)
            periodicExercise(4, false);
        if ((u._woundedLegTurns ?? 0) > 0
            || u.fumbling || (u.fumblingTurns ?? 0) > 0
            || u.stunned || (u.stunnedTurns ?? 0) > 0)
            periodicExercise(1, false);
    }
}

function effectiveMultiNonzero(state = game) {
    if ((state.multi ?? 0) !== 0 || state._runState
        || state._delayedAction
        || (state._helplessTurns ?? 0) > 0
        || (state._prayerTurnsRemaining ?? 0) > 0)
        return true;
    // These are the port's positive-multi occupation representations.
    // Lock-picking and eating use C's separate go.occupation with multi==0
    // and deliberately do not enter this branch.
    return state._occupation?.key === '.'
        || state._occupation?.key === 'study-book';
}

// C ref: attrib.c:exerchk().  Runtime attributes use status/display order in
// JS, so project C's Str, Int, Wis, Dex, Con, Cha iteration explicitly.
function checkAttributeExercise(sourceTurn) {
    if (!Number.isInteger(game._nextAttribCheck))
        game._nextAttribCheck = 600;
    if (sourceTurn < game._nextAttribCheck || effectiveMultiNonzero(game))
        return;

    const exercise = game.u?._exercise || [];
    const cOrder = [0, 3, 4, 1, 2, 5];
    const explanations = new Map([
        [0, ['exercising diligently', 'exercising properly']],
        [4, ['very observant', 'paying attention']],
        [1, ['working on your reflexes', 'working on reflexes lately']],
        [2, ['leading a healthy life-style', 'watching your health']],
    ]);
    for (const index of cOrder) {
        const accumulated = exercise[index] ?? 0;
        if (!accumulated) continue;
        const direction = Math.sign(accumulated);
        const threshold = index === 4
            ? Math.abs(accumulated)
            : Math.trunc(Math.abs(accumulated) * 2 / 3);
        if (rn2(50) <= threshold) {
            const values = game.u?.acurr?.a;
            if (values) {
                const oldValue = values[index];
                const newValue = Math.max(3, Math.min(18,
                    oldValue + direction));
                if (newValue !== oldValue) {
                    values[index] = newValue;
                    if (game.u?.amax?.a)
                        game.u.amax.a[index] = Math.max(
                            game.u.amax.a[index], newValue,
                        );
                    exercise[index] = 0;
                    const phrase = explanations.get(index)?.[
                        direction > 0 ? 0 : 1
                    ];
                    if (phrase) appendTurnMessage(
                        `You ${direction > 0 ? 'must have been' : "haven't been"} ${phrase}.`,
                    );
                    continue;
                }
            }
        }
        exercise[index] = Math.trunc(Math.abs(accumulated) / 2) * direction;
    }
    game._nextAttribCheck += 800 + rn2(200);
}

function finishInitialTurnMaintenanceAfterAmbient({
    sourceTurn, moveAmount,
}) {
    getHungry({ invulnerable: game._prayerForced });
    // JS has already advanced `game.moves` for the hero action which caused
    // this maintenance pass.  C increments svm.moves inside this pass, so
    // the resulting C turn number is the existing JS value, not value + 1.
    periodicTurnExercise(sourceTurn);
    checkAttributeExercise(sourceTurn);
    if (maintainVaultResidence(game)) {
        // invault() owns an interactive getlin()/pager transaction.  Preserve
        // the remaining same-turn maintenance so it resumes only after that
        // transaction completes, just as the synchronous C stack does.
        game._vaultMaintenanceContinuation = { sourceTurn };
        return moveAmount;
    }
    finishInitialTurnMaintenanceRng(sourceTurn);
    return moveAmount;
}

function finishFumblingExpiryAfterMessage({ fumbled = false } = {}) {
    if (fumbled) {
        // timeout.c reaches this through nomul(-2), which always calls
        // end_running(TRUE) before the helpless interval.
        stopRun(game);
        game._helplessTurns = 2;
        game._helplessDoneMessage = '';
    }
    if (game.u?.fumblingFromArmor || game.u?.fumblingIntrinsic)
        game.u.fumblingTurns += rnd(20);
    game.u.fumbling = !!(game.u?.fumblingFromArmor
        || game.u?.fumblingIntrinsic
        || (game.u?.fumblingTurns ?? 0) > 0);
}

function finishInitialTurnMaintenanceAfterTimeout({
    sourceTurn, moveAmount, deferAmbientMessage, polymorphed,
}) {
    // allmain.c:regen_hp() runs after nh_timeout().  If a timeout pline
    // suspended at tty, no regeneration or later maintenance may run until
    // that exact source stack resumes.
    const activeHp = polymorphed ? 'mh' : 'uhp';
    const activeHpMax = polymorphed ? 'mhmax' : 'uhpmax';
    if (!game.u?.invulnerable
        && (game.u?.[activeHp] ?? 0) < (game.u?.[activeHpMax] ?? 0)) {
        let shouldHeal;
        if (polymorphed) {
            // allmain.c:regen_hp() does not use the human level/Constitution
            // rn2(100) check for monster-form HP.  Ordinary forms recover one
            // point only from Regeneration or on the deterministic 20-turn
            // cadence while movement encumbrance permits it.  The dry-eel
            // damage branch remains separate from this non-eel carrier.
            const nonEel = MONSTER_SYMBOL[game.u.umonnum] !== 57;
            const encumbranceOk = nearCapacity(game) < MOD_ENCUMBER
                || !game.u?.umoved;
            shouldHeal = nonEel && (game.u.regeneration
                || (encumbranceOk && sourceTurn % 20 === 0));
        } else {
            const constitution = game.u?.acurr?.a?.[2] || 0;
            shouldHeal = (game.u.ulevel + constitution) > rn2(100)
                || game.u.regeneration;
        }
        if (shouldHeal) {
            game.u[activeHp] = Math.min(
                game.u[activeHpMax], game.u[activeHp] + 1,
            );
            if (game.u[activeHp] === game.u[activeHpMax])
                interruptCountedActivity('You are in full health.');
        }
    }

    if ((game.u?.uen ?? 0) < (game.u?.uenmax ?? 0)) {
        const capacity = nearCapacity(game);
        const level = game.u?.ulevel ?? 1;
        const roleFactor = game.urole?.key === 'wizard' ? 3 : 4;
        const interval = Math.max(1, Math.trunc(
            ((30 + 8 - level) * roleFactor) / 6,
        ));
        const energyRegeneration = !!(
            game.u?.energyRegeneration
            || game.u?.energyRegenerationIntrinsic
            || game.u?.energyRegenerationExtrinsic
        );
        if ((capacity < MOD_ENCUMBER
                && sourceTurn % interval === 0)
            || energyRegeneration) {
            const attributes = game.u?.acurr?.a || [];
            let upper = Math.trunc(
                ((attributes[4] ?? 0) + (attributes[3] ?? 0)) / 15,
            ) + 1;
            if (game.u?.magicalBreathingExtrinsic) upper += 2;
            game.u.uen = Math.min(
                game.u.uenmax,
                game.u.uen + 1 + rn2(upper),
            );
            if (game.u.uen === game.u.uenmax)
                interruptCountedActivity('You feel full of energy.');
        }
    }

    if (game.u?.searching && !game.level?.flags?.noautosearch
        && !game._delayedAction)
        automaticSearch();

    const flags = game.level?.flags || {};
    const pendingBeforeAmbient = game._pending_message || '';
    const lastBeforeAmbient = game._last_message || '';
    ambientFeatureSounds(flags);
    if (deferAmbientMessage
        && (game._pending_message || '') !== pendingBeforeAmbient) {
        const combined = game._pending_message || '';
        const prefix = pendingBeforeAmbient
            ? `${pendingBeforeAmbient}  ` : '';
        const message = prefix && combined.startsWith(prefix)
            ? combined.slice(prefix.length) : combined;
        game._pending_message = pendingBeforeAmbient;
        game._last_message = lastBeforeAmbient;
        return {
            deferredAmbientMessage: true,
            message, sourceTurn, moveAmount,
        };
    }
    return finishInitialTurnMaintenanceAfterAmbient({
        sourceTurn, moveAmount,
    });
}

function initialTurnMaintenanceRng(
    completedTurn = game.moves || 1, deferAmbientMessage = false,
) {
    // allmain.c runs mcalcdistress() before allocating the next movement
    // ration. Regeneration, were-change checks, and temporary maladies count
    // down once per global turn, independent of the monster's own speed.
    // C calls mcalcdistress() before incrementing svm.moves.  JS reaches this
    // boundary with the new displayed turn already in game.moves, so monster
    // periodic regeneration must inspect the preceding turn number.
    updateMonsterDistress(
        game.level?.monsters || [], game, rn2, completedTurn - 1,
    );
    const allocations = allocateMonsterMovement(game.level?.monsters || []);
    game._monsterMovementInitialized = true;
    game._lastMonsterAllocations = allocations.map(({ monster, amount, movement }) => ({
        mnum: monster.mnum, pet: !!monster.pet, amount, movement,
    }));
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
    if (rn2(generationRate) === 0) generateRandomMonster();
    runLevelRegions(game);

    // C allmain.c: ublesscnt ages once per newly allocated global turn,
    // before prayer eligibility or enlightenment can observe it.
    if ((game.u?.ublesscnt ?? 0) > 0) game.u.ublesscnt--;

    // allmain.c advances a negative `multi` once per newly allocated global
    // turn, not once per completed hero action.  Burden can require multiple
    // allocations before the hero regains 12 movement points, and every one
    // of those allocations advances an armor-donning occupation.
    if ((game._delayedAction?.remainingGlobalTurns ?? 0) > 0) {
        game._delayedAction.remainingGlobalTurns--;
        if (game._delayedAction.remainingGlobalTurns === 0)
            game._delayedAction.ready = true;
    }

    const polymorphed = (game.u?.mtimedone ?? 0) > 0
        && Number.isInteger(game.u?.umonnum);
    let moveAmount = polymorphed
        ? (MONSTER_MOVE[game.u.umonnum] ?? 0)
        : 12;
    if (game.u?.veryFast) {
        if (rn2(3) !== 0) moveAmount += 12;
    } else if (game.u?.fast && rn2(3) === 0) {
        moveAmount += 12;
    }
    // allmain.c:u_calc_moveamt() applies current carrying capacity after the
    // current form's natural speed and Fast/Very_fast bonus.  OVERLOADED is
    // deliberately the default case: a zero-speed mold receives no movement
    // until intrinsic Fast grants a complete 12-point action.
    const movementCapacity = nearCapacity(game);
    if (movementCapacity === 1) {
        moveAmount -= Math.trunc(moveAmount / 4);
    } else if (movementCapacity === 2) {
        moveAmount -= Math.trunc(moveAmount / 2);
    } else if (movementCapacity === 3) {
        moveAmount -= Math.trunc(moveAmount * 3 / 4);
    } else if (movementCapacity === 4) {
        moveAmount -= Math.trunc(moveAmount * 7 / 8);
    }
    // C records the hero's current square after monster movement/allocation
    // and before the new global turn's callbacks.  Pets which lose sight of
    // the hero consult this ring on their next action.
    setTrack(game);

    // nh_timeout() precedes regeneration and exerchk() in the C loop.  Keep
    // the first timed impairment live rather than treating its setup rolls as
    // disposable: bear-trap leg damage lowers Dexterity until this countdown
    // expires.
    const sourceTurn = completedTurn;
    if ((game.u?.mtimedone ?? 0) > 0) game.u.mtimedone--;
    for (let x = 1; x < COLNO; x++) {
        const column = game.level?.objects?.[x];
        if (!column) continue;
        for (let y = 0; y < ROWNO; y++) {
            const pile = column[y];
            if (!Array.isArray(pile) || !pile.length) continue;
            const survivors = pile.filter(object =>
                object.rotAt == null || object.rotAt > sourceTurn);
            if (survivors.length !== pile.length) {
                column[y] = survivors;
                newsym(x, y);
            }
        }
    }

    // C timeout.c:nh_timeout() expires temporary confusion before regen,
    // sounds, hunger, and exerchk().  The final tick is observable twice:
    // it queues the recovery message and prevents this same turn's periodic
    // Wisdom abuse from seeing Confusion as active.
    // Prayer's u.uinvulnerable is not the timed Invulnerable property.
    // timeout.c:nh_timeout() returns before decrementing any property while
    // that prayer-only flag is active.
    const prayerTimeoutFreeze = !!game.u?.invulnerable;
    if (!prayerTimeoutFreeze && (game.u?.stunnedTurns ?? 0) > 0) {
        const remaining = game.u.stunnedTurns - 1;
        if (remaining === 0) {
            if (deferAmbientMessage) {
                return {
                    deferredTimeoutMessage: true,
                    timeoutKind: 'stun',
                    message: 'You feel a bit steadier now.',
                    sourceTurn, moveAmount, deferAmbientMessage, polymorphed,
                    prayerTimeoutFreeze,
                };
            }
            game.u.stunnedTurns = 0;
            game.u.stunned = false;
            appendTurnMessage('You feel a bit steadier now.');
        } else game.u.stunnedTurns = remaining;
    }

    return finishInitialTurnMaintenanceAfterStun({
        sourceTurn, moveAmount, deferAmbientMessage, polymorphed,
        prayerTimeoutFreeze,
    });
}

function finishInitialTurnMaintenanceAfterStun({
    sourceTurn, moveAmount, deferAmbientMessage, polymorphed,
    prayerTimeoutFreeze,
}) {
    if (!prayerTimeoutFreeze && (game.u?.confusionTurns ?? 0) > 0) {
        const remaining = game.u.confusionTurns - 1;
        if (remaining === 0) {
            if (deferAmbientMessage) {
                return {
                    deferredTimeoutMessage: true,
                    timeoutKind: 'confusion',
                    message: 'You feel less confused now.',
                    sourceTurn, moveAmount, deferAmbientMessage, polymorphed,
                    prayerTimeoutFreeze,
                };
            }
            game.u.confusionTurns = 0;
            appendTurnMessage('You feel less confused now.');
        } else game.u.confusionTurns = remaining;
    }

    return finishInitialTurnMaintenanceAfterConfusion({
        sourceTurn, moveAmount, deferAmbientMessage, polymorphed,
        prayerTimeoutFreeze,
    });
}

function finishInitialTurnMaintenanceAfterConfusion({
    sourceTurn, moveAmount, deferAmbientMessage, polymorphed,
    prayerTimeoutFreeze,
}) {

    if (!prayerTimeoutFreeze && (game.u?.hallucinationTurns ?? 0) > 0) {
        game.u.hallucinationTurns--;
        if (game.u.hallucinationTurns === 0) {
            game.u.hallucinating = false;
            appendTurnMessage('Everything looks SO boring now.');
            game.vision_full_recalc = 1;
        }
    }

    // timeout.c:nh_timeout() decrements every timed intrinsic once per global
    // turn.  Natural AD_BLND contact adds its full roll to HBlinded; this
    // owner, rather than the attack resolver, accounts for the duration which
    // elapses while monsters and the hero continue taking turns.
    if (!prayerTimeoutFreeze && (game.u?.blindTurns ?? 0) > 0) {
        game.u.blindTurns--;
        if (game.u.blindTurns === 0) {
            game.blind = false;
            appendTurnMessage('You can see again.');
            game.vision_full_recalc = 1;
            if (game._occupation) game._occupation = null;
        }
    }

    if (!prayerTimeoutFreeze && (game.u?.invulnerableTurns ?? 0) > 0) {
        game.u.invulnerableTurns--;
    }

    if (!prayerTimeoutFreeze && (game.u?.invisibleTurns ?? 0) > 0) {
        game.u.invisibleTurns--;
        if (game.u.invisibleTurns === 0) {
            const stillInvisible = !!(
                game.u.intrinsicInvisible || game.u.extrinsicInvisible
                || game.u.formInvisible
            );
            game.u.invisible = stillInvisible;
            game.u.invis = stillInvisible;
            newsym(game.u.ux, game.u.uy);
            if (!stillInvisible && !game.blind) {
                appendTurnMessage(game.u.seeInvisible || game.u.see_invisible
                    ? 'You can no longer see through yourself.'
                    : 'You are no longer invisible.');
                if (game._occupation) game._occupation = null;
            }
        }
    }

    if (!prayerTimeoutFreeze && (game.u?.veryFastTurns ?? 0) > 0) {
        game.u.veryFastTurns--;
        if (game.u.veryFastTurns === 0) {
            game.u.veryFast = !!game.u.veryFastFromArmor;
            if (!game.u.veryFast)
                appendTurnMessage(game.u.fast
                    ? 'You feel yourself slow down a bit.'
                    : 'You feel yourself slow down.');
        }
    }

    if (!prayerTimeoutFreeze
        && (game.u?.halfSpellDamageTurns ?? 0) > 0) {
        game.u.halfSpellDamageTurns--;
        if (game.u.halfSpellDamageTurns === 0) {
            game.u.halfSpellDamage = !!game.u.halfSpellDamageFromArtifact;
        }
    }

    if (!prayerTimeoutFreeze
        && (game.u?.halfPhysicalDamageTurns ?? 0) > 0) {
        game.u.halfPhysicalDamageTurns--;
        if (game.u.halfPhysicalDamageTurns === 0) {
            game.u.halfPhysicalDamage
                = !!game.u.halfPhysicalDamageFromArtifact;
        }
    }

    if (!prayerTimeoutFreeze
        && (game.u?.shockResistanceTurns ?? 0) > 0) {
        game.u.shockResistanceTurns--;
        if (game.u.shockResistanceTurns === 0) {
            game.u.shockResistance = !!(
                game.u.shockResistanceFromArmor
                || game.u.intrinsicShockResistance
            );
        }
    }

    if (!prayerTimeoutFreeze
        && (game.u?.magicResistanceTurns ?? 0) > 0) {
        game.u.magicResistanceTurns--;
        if (game.u.magicResistanceTurns === 0) {
            const remains = !!(
                game.u.antimagicFromArmor
                || game.u.magicResistanceFromArmor
                || game.u.intrinsicMagicResistance
            );
            game.u.magicResistance = remains;
            game.u.antimagic = remains;
        }
    }

    if (!prayerTimeoutFreeze && (game.u?.deafTurns ?? 0) > 0) {
        game.u.deafTurns--;
        if (game.u.deafTurns === 0) game.deaf = false;
    }

    if (!prayerTimeoutFreeze && (game.u?._woundedLegTurns ?? 0) > 0) {
        game.u._woundedLegTurns--;
        if (game.u._woundedLegTurns === 0) {
            const wasBurdened = game.u._encumbrance === 'Burdened';
            game.u._woundedLegSide = null;
            if (game.u.acurr?.a) game.u.acurr.a[1]++;
            // C heal_legs()->encumber_msg() both emits the capacity change
            // and advances go.oldcap.  Keep that persistent comparison state
            // synchronized here so a later pickup does not repeat it.
            game._encumbranceLevel = nearCapacity(game);
            game.u._encumbrance = encumbranceLabel(
                game._encumbranceLevel,
            );
            game._pending_message = wasBurdened
                ? 'Your leg feels better.  Your movements are now unencumbered.'
                : 'Your leg feels better.';
            game._last_message = game._pending_message;
        }
    }

    // timeout.c:nh_timeout() decrements the timed intrinsic independently of
    // the worn extrinsic.  Expiry after a successful map move fumbles before
    // regeneration, installs an empty-message two-turn nomul(), then the
    // still-worn boots immediately renew HFumbling with rnd(20).
    if (!prayerTimeoutFreeze && (game.u?.fumblingTurns ?? 0) > 0) {
        game.u.fumblingTurns--;
        if (game.u.fumblingTurns === 0) {
            const levitating = !!(game.u?.levitating
                || game.u?.levitation || game.levitating);
            const flying = !!(game.u?.flying || game.flying);
            if (game.u?.umoved && !levitating && !flying) {
                const message = slipOrTripOnClearFloor({
                    deferMessage: deferAmbientMessage,
                });
                // `You(...)` can suspend inside tty before nomul(), renewal,
                // regeneration, or any later global-turn work.
                if (deferAmbientMessage) {
                    return {
                        deferredTimeoutMessage: true,
                        timeoutKind: 'fumbling',
                        message, sourceTurn, moveAmount,
                        deferAmbientMessage, polymorphed,
                        prayerTimeoutFreeze,
                    };
                }
                finishFumblingExpiryAfterMessage({ fumbled: true });
            } else {
                finishFumblingExpiryAfterMessage();
            }
        }
    }

    return finishInitialTurnMaintenanceAfterTimeout({
        sourceTurn, moveAmount, deferAmbientMessage, polymorphed,
    });
}

async function initialTurnMaintenanceWithTty(
    completedTurn = game.moves || 1,
) {
    let phase = initialTurnMaintenanceRng(completedTurn, true);
    while (phase?.deferredTimeoutMessage) {
        await queueTurnMessage(phase.message);
        if (phase.timeoutKind === 'stun') {
            game.u.stunnedTurns = 0;
            game.u.stunned = false;
            phase = finishInitialTurnMaintenanceAfterStun(phase);
        } else if (phase.timeoutKind === 'confusion') {
            game.u.confusionTurns = 0;
            phase = finishInitialTurnMaintenanceAfterConfusion(phase);
        } else {
            finishFumblingExpiryAfterMessage({ fumbled: true });
            phase = finishInitialTurnMaintenanceAfterTimeout(phase);
        }
    }
    let result = phase;
    if (phase?.deferredAmbientMessage) {
        await queueTurnMessage(phase.message);
        result = finishInitialTurnMaintenanceAfterAmbient(phase);
    }
    if (game._pendingDemigodIntervention) {
        const intervention = game._pendingDemigodIntervention;
        game._pendingDemigodIntervention = null;
        if (intervention.kind === 2) {
            await waitForCurrentMonsterMore();
            const action = { calls: [] };
            const heroAttack = { deferredCurseItems: true };
            await resolveDeferredHeroCurseItems(action, heroAttack);
            delete game._unresolvedDemigodIntervention;
        } else if (intervention.kind === 5) {
            await resurrectWizard();
            delete game._unresolvedDemigodIntervention;
        } else if (intervention.kind === 4) {
            const effect = await summonNastyMonsters(null, {
                onCreate: async monster => {
                    newsym(monster.mx, monster.my);
                    const name = quietMonsterName(monster);
                    const article = /^[aeiou]/i.test(name) ? 'An' : 'A';
                    const adjacent = Math.max(
                        Math.abs(monster.mx - (game.u?.ux ?? monster.mx)),
                        Math.abs(monster.my - (game.u?.uy ?? monster.my)),
                    ) <= 1;
                    const message = `${article} ${name} suddenly appears ${
                        adjacent ? 'next to you' : 'close by'
                    }!`;
                    if (game._pending_message !== message)
                        await queueTurnMessage(message);
                },
            });
            game._lastDemigodNasty = (effect.created || []).map(monster =>
                monster.m_id);
            delete game._unresolvedDemigodIntervention;
        }
        game.u.udg_cnt = 50 + rn2(200);
        finishInitialTurnMaintenanceAfterIntervention(
            intervention.sourceTurn,
        );
    }
    const helplessDelayTurn = game._helplessRunmodeDelayPending;
    delete game._helplessRunmodeDelayPending;
    await captureRunmodeDelay(
        game, Number.isInteger(helplessDelayTurn),
        helplessDelayTurn ?? completedTurn,
        { preservePhysicalTopline: true },
    );
    await drainQueuedHelplessRecoveryMessage();
    const delayedAction = game._delayedAction;
    if (delayedAction) {
        if (game._pending_message) {
            delete delayedAction._runmodeRetainedTopline;
        } else if (!delayedAction._runmodeRetainedTopline) {
            delayedAction._runmodeRetainedTopline
                = game.nhDisplay?.grid?.[0]?.map(cell => ({ ...cell }));
        }
    }
    await captureRunmodeDelay(
        game, !!delayedAction, completedTurn,
        {
            preservePhysicalTopline: true,
            retainedTopline: delayedAction?._runmodeRetainedTopline,
        },
    );
    // Native find_ac() follows the elapsed-turn loop.  setworn() is already
    // live for effects, but the first donning cadence frame still shows the
    // prior AC; the next automatic core observes the recomputed value.
    if (game._armorClassDirtyAfterDelayedFrame) {
        findArmorClass(game);
        game._armorClassDirty = false;
        delete game._armorClassDirtyAfterDelayedFrame;
        delete game._statusProjectedAc;
    }
    return result;
}

async function drainQueuedHelplessRecoveryMessage() {
    if (!game._queuedHelplessRecoveryMessage) return;
    const message = game._queuedHelplessRecoveryMessage;
    game._queuedHelplessRecoveryMessage = null;
    await plineWithContinuation(message);
    const after = game._helplessAfter;
    game._helplessAfter = null;
    // C eat.c:Hear_again() runs after unmul() has delivered nomovemsg.
    // Keep it after the awaited tty continuation: if the rotten-food
    // message fills the topline, the acknowledgement resumes here before
    // the recovery message becomes the next input boundary.
    if (after === 'hear-again' && rn2(2) === 0) {
        game.u.deafTurns = 0;
        game.deaf = false;
    }
}

function liveQuietKnight(state = game) {
    return state.urole?.key === 'knight'
        && !state._knightPonyPath && !state._knightCombatPath;
}

function liveQuietMonk(state = game) {
    return state.urole?.key === 'monk' && !state._monkNorthPath;
}

function liveQuietRogue(state = game) {
    return state.urole?.key === 'rogue'
        && !state._rogueFriday13Path
        && !state._rogueOrcPath
        && !state._rogueChargenPath
        && !state._rogueExplorePath;
}

function liveQuietHealer(state = game) {
    return state.urole?.key === 'healer' && !state._healerNewmoonPath;
}

function liveQuietRanger(state = game) {
    return state.urole?.key === 'ranger' && !state._rangerNamePath;
}

function liveQuietPriest(state = game) {
    return state.urole?.key === 'priest' && !state._priestCastPath;
}

function liveQuietSamurai(state = game) {
    return state.urole?.key === 'samurai' && !state._samuraiAltarPath
        && (state._samuraiLiveScheduler
            || state._delayedAction?.kind === 'remove');
}

function liveQuietValkyrie(state = game) {
    return state.urole?.key === 'valkyrie'
        && !state._valkPitPath && !state._valkChatPath;
}

function liveQuietTourist(state = game) {
    return state.urole?.key === 'tourist' && !state._touristExplorePath;
}

function liveDebugSourceRation(state = game) {
    return !!state.flags?.debug
        && ((state.u?.ulevel ?? 1) > 1
            || (state.u?.mtimedone ?? 0) > 0);
}

function usesSourceMovementRation(state = game) {
    return liveQuietKnight(state) || liveQuietMonk(state)
        || liveQuietRogue(state) || liveQuietHealer(state)
        || liveQuietPriest(state) || liveQuietSamurai(state)
        || liveDebugSourceRation(state);
}

// Generic live-role scans still allocate real monster/global turns even
// before their hero movement-ration accounting has been generalized.  Their
// negative-multi recovery messages therefore need the same asynchronous tty
// owner as source-ration roles; bounded fast-forward paths keep the legacy
// synchronous append behavior.
function usesQueuedHelplessRecovery(state = game) {
    return usesSourceMovementRation(state)
        || (state.urole?.key === 'wizard' && !state._wizardBindPath)
        || liveQuietRogue(state) || liveQuietPriest(state)
        || liveQuietValkyrie(state)
        || liveQuietTourist(state);
}

// allmain.c:u_calc_moveamt() clamps a negative movement balance after every
// global allocation.  Without this, a slow polymorph can carry the action
// debit across zero-speed turns and require an extra monster/global round.
function addHeroMovementRation(state, amount) {
    state.u.umovement = Math.max(
        0, (state.u.umovement ?? 0) + amount,
    );
}

function reluctantPetMessage(monster, movement) {
    const pile = game.level?.objects?.[movement.x]?.[movement.y] || [];
    const top = pile[0];
    const objectName = top ? distantMonsterObjectName(top) : 'something';
    const airborne = !!((MONSTER_FLAGS1[monster?.mnum] ?? 0) & 0x1);
    return `Your ${quietMonsterName(monster)} ${
        airborne ? 'flies reluctantly over' : 'steps reluctantly onto'
    } ${objectName}.`;
}

function monsterBearTrapMessage(monster) {
    if (monster?.mnum === 100)
        return 'The saddled pony is caught in a bear trap!';
    return 'The monster is caught in a bear trap!';
}

function monsterTrapEscapeMessage(monster) {
    if (monster?.mnum === 100)
        return 'The saddled pony pulls free of the bear trap.';
    return 'The monster pulls free of the bear trap.';
}

const SQUEAKY_BOARD_NOTES = [
    'C note', 'D flat', 'D note', 'E flat',
    'E note', 'F note', 'F sharp', 'G note',
    'G sharp', 'A note', 'B flat', 'B note',
];
const M1_MINDLESS = 0x00010000;
const G_UNIQ = 0x1000;

function monsterSqueakyBoardMessage(monster, event, inSight) {
    const note = SQUEAKY_BOARD_NOTES[event?.note];
    if (!note) return null;
    if (inSight) {
        event.trap.tseen = true;
        if (!game.deaf) {
            const article = /^[aeiou]/i.test(note) ? 'an' : 'a';
            return `A board beneath the ${quietMonsterName(
                monster,
            )} squeaks ${article} ${note} loudly.`;
        }
        if (!((MONSTER_FLAGS1[monster?.mnum] ?? 0) & M1_MINDLESS)) {
            return `The ${quietMonsterName(
                monster,
            )} stops momentarily and appears to cringe.`;
        }
        return null;
    }
    if (game.deaf) return null;
    const article = /^[aeiou]/i.test(note) ? 'an' : 'a';
    const range = couldsee(monster.mx, monster.my)
        ? BOLT_LIM + 1 : BOLT_LIM - 3;
    const proximity = dist2(
        monster.mx, monster.my,
        game.u?.ux ?? monster.mx, game.u?.uy ?? monster.my,
    ) <= range * range ? 'nearby' : 'in the distance';
    return `You hear ${article} ${note} squeak ${proximity}.`;
}

function monsterAttackMessage(monster, attack, previousAttack = null) {
    if (attack.effect === 'engulf-tick'
        || attack.effect === 'item-theft') return null;
    const actorSpotted = canProjectMonster(
        monster, monster?.mx, monster?.my,
    );
    const hallucinating = game.u?.hallucinating
        || (game.u?.hallucinationTurns ?? 0) > 0;
    const name = actorSpotted && hallucinating ? randomDisplayMonsterName()
        : monster?.isshk ? shopkeeperName(monster)
            : actorSpotted ? projectedMonsterName(monster)
                : quietMonsterName(monster);
    const priestSubject = actorSpotted && !hallucinating
        && (monster?.ispriest || monster?.isminion)
        ? visiblePriestName(monster, game) : null;
    const subject = game.blind || !actorSpotted ? 'It'
        : priestSubject
            || (monster?.isshk && !hallucinating ? name : `The ${name}`);
    if (monster?.mnum === 116) {
        if (!attack.hit) return `${subject} misses!`;
        if (attack.effect === 'electric-natural')
            return `${subject} bites!`;
        return attack.effect === 'electric-avoided'
            ? `${subject} bites!  You avoid harm.`
            : `${subject} bites!  You get zapped!`;
    }
    if (attack.effect === 'displaced-wild-miss') {
        // mhitu.c:wildmiss() gives no feedback when the attacker square is
        // outside the hero's current sight field.  In particular, an Air
        // level raven can spend a false-image attack while travel retains
        // the getpos description on the topline.
        if (!cansee(monster.mx, monster.my)) return null;
        return `${game.blind ? `The ${name}` : subject} strikes at your ${
            game.u?.invisible || game.u?.invis ? 'invisible ' : ''
        }displaced image and misses you!`;
    }
    if (!attack.hit) {
        // mhitu.c:missmu() discloses a near miss only in verbose mode.
        const verb = game.flags?.verbose !== false
            && attack.roll === attack.threshold
            ? 'just misses' : 'misses';
        return `${subject} ${verb}!`;
    }
    if (attack.effect === 'blind-natural')
        return attack.blindMessage ? `${subject} blinds you!` : null;
    if (attack.effect === 'leg-natural') {
        const side = attack.legSide || 'left';
        const contact = attack.legContact === 'reach'
            ? `tries to reach your ${side} leg`
            : attack.legContact === 'nuzzle'
                ? `nuzzles against your ${side} leg`
                : attack.legContact === 'exposed-prick'
                    ? `pricks the exposed part of your ${side} leg`
                    : attack.legContact === 'boot-prick'
                        ? `pricks through your ${side} boot`
                        : attack.legContact === 'boot-scratch'
                            ? `scratches your ${side} boot`
                            : `pricks your ${side} leg`;
        return `${subject} ${contact}!`;
    }
    if (attack.effect === 'engulf') return `${subject} engulfs you!`;
    const verb = attack.attackType === 2 ? 'bites'
        : attack.attackType === 3 ? 'kicks'
            : attack.attackType === 4 ? 'butts'
                : attack.attackType === 5 ? 'touches you'
                    : attack.attackType === 6 ? 'stings' : 'hits';
    // mhitu.c:hitmsg() calls adjacent attacks of the same method "again".
    // Besides prose, those six cells can decide whether the following pline
    // crosses tty's reserved --More-- budget and suspends the hit transaction.
    const again = previousAttack?.hit
        && previousAttack.attackType === attack.attackType ? ' again' : '';
    return `${subject} ${verb}${again}!`;
}

function heroPassiveResponseMessage(monster, passive) {
    if (!passive?.messageKind) return null;
    const name = game.u?.hallucinating
        || (game.u?.hallucinationTurns ?? 0) > 0
        ? randomDisplayMonsterName()
        : monsterTypeName(monster?.mnum, !!monster?.female);
    const subject = game.blind ? 'It' : `The ${name}`;
    if (passive.messageKind === 'cold-resistant')
        return `${subject} is mildly chilly.`;
    if (passive.messageKind === 'cold')
        return `${subject} is suddenly very cold!`;
    return null;
}

function poisonAttackNoun(attack) {
    if (attack?.attackType === 6) return 'sting';
    if (attack?.attackType === 2) return 'bite';
    return 'attack';
}

function recordContactRn2(action, range) {
    action?.calls?.push(`rn2(${range})`);
    return rn2(range);
}

function recordContactDice(action, count, sides) {
    action?.calls?.push(`d(${count},${sides})`);
    return d(count, sides);
}

function wornTheftObjectDescription(object) {
    // C steal.c:worn_item_removal() starts from doname(), then massages only
    // the ownership and equipment-location suffix for its pre-removal line.
    let description = inventoryItemDescription(object)
        .replace(/^(?:the|an|a) /, 'your ')
        .replace(' (being worn)', '')
        .replace(' (alternate weapon; not wielded)', '');
    description = description.replace(
        / \(on (left|right) hand\)$/,
        ' (from $1 hand)',
    );
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
// The selection draw happened synchronously inside basicMonsterAttack().
// Removal prose is split here because urgent_pline() can suspend before the
// no-teleport check, fleeing state, and the rest of movemon().
async function resolveDeferredHeroItemTheft(action, monster, attack) {
    if (!attack?.deferredItemTheft) return false;
    attack.deferredItemTheft = false;
    const object = attack.stolenObject;
    if (!object || !(game.inventory || []).includes(object)) return false;

    const equipmentSlots = heroEquipmentSlots();
    const occupiedSlots = equipmentSlots.filter(slot => game[slot] === object);
    const weaponMask = object?.owornmask ?? 0;
    const wasWeapon = occupiedSlots.some(slot =>
        ['uwep', 'uswapwep', 'uquiver'].includes(slot))
        || !!(weaponMask & W_WEAPONS)
        || object.wielded || object.alternate || object.ready;
    const wasAccessory = occupiedSlots.some(slot =>
        ['uleft', 'uright', 'uamul', 'ublindf'].includes(slot))
        || !!(weaponMask & W_ACCESSORY);
    const wasWorn = occupiedSlots.length > 0
        || object.worn || weaponMask !== 0;
    const removalObjectDescription = wornTheftObjectDescription(object);
    const subject = game.blind
        ? 'Someone' : `The ${quietMonsterName(monster)}`;

    let removalMessage = null;
    if (wasWeapon)
        removalMessage = `${subject} disarms ${removalObjectDescription}.`;
    else if (wasWorn) {
        const verb = wasAccessory ? 'removes' : 'takes off';
        removalMessage = `${subject} ${verb} ${removalObjectDescription}.`;
    }
    if (removalMessage) await queueTurnMessage(removalMessage);

    for (const slot of occupiedSlots) game[slot] = null;
    if (game.u) {
        for (const slot of occupiedSlots) {
            if (game.u[slot] === object) game.u[slot] = null;
        }
    }
    object.owornmask = 0;
    object.worn = false;
    object.wielded = false;
    object.alternate = false;
    object.ready = false;
    const index = game.inventory.indexOf(object);
    if (index >= 0) game.inventory.splice(index, 1);
    const inventory = monster.minvent || monster.inventory || [];
    // Runtime monster inventories retain acquisition order.  Hero-kill
    // relobj walks this array backward, reproducing C's newest-first minvent
    // chain; append newly stolen objects rather than mixing chain order into
    // an otherwise chronological representation.
    inventory.push(object);
    monster.minvent = inventory;
    monster.inventory = inventory;
    object.where = 'minvent';
    monster.mavenge = 1;
    findArmorClass(game);

    const stolenObjectDescription = inventoryItemDescription(object);
    const thief = removalMessage && /nymph$/.test(quietMonsterName(monster))
        ? 'She' : subject;
    // urgent_pline() does not force a pager for its newly installed line.
    // It can first suspend while clearing the older worn-removal line; after
    // that acknowledgement, rloc() may append its own message to this one.
    await queueTurnMessage(`${thief} stole ${stolenObjectDescription}.`);

    if (game.level?.flags?.noteleport) {
        await queueTurnMessage(
            `A mysterious force prevents the ${quietMonsterName(monster)} from teleporting!`,
        );
    } else {
        const actorWasSeen = canProjectMonster(
            monster, monster.mx, monster.my,
        );
        const relocation = relocateMonsterAfterTheft(action, game);
        if (relocation) {
            newsym(relocation.oldx, relocation.oldy);
            newsym(relocation.x, relocation.y);
            const relocationMessage = monsterRelocationMessage(
                monster, relocation, actorWasSeen,
            );
            if (relocationMessage)
                await queueTurnMessage(relocationMessage);
        }
    }
    monster.mflee = 1;
    // hitmu() enters this shared tail even when mhitm_ad_sedu() marked the
    // aggressor done.  A zero-damage claw still probes both knockback gates
    // after steal() has finished its messages and fleeing transition.
    recordContactRn2(action, 3);
    recordContactRn2(action, 6);
    attack.theftResolved = true;
    return true;
}

// C refs: uhitm.c:mhitm_ad_drst(), attrib.c:poisoned().  The initial poison
// line is nested inside hitmu(), before its shared knockback and physical
// damage tail.  Keep this async so tty can suspend on each intervening pline
// without letting the actor advance to that tail.
async function resolveDeferredHeroPoison(action, monster, attack) {
    let pagerOwned = false;
    const queuePoisonMessage = async message => {
        const dismissal = await queueTurnMessage(message);
        if (dismissal !== null && dismissal !== undefined) pagerOwned = true;
    };
    const subject = game.blind ? 'Its'
        : `The ${quietMonsterName(monster)}'s`;
    await queuePoisonMessage(
        `${subject} ${poisonAttackNoun(attack)} was poisoned!`,
    );

    if (game.u?.poisonResistance) {
        await queuePoisonMessage("The poison doesn't seem to affect you.");
        return pagerOwned;
    }

    const outcome = recordContactRn2(action, 30);
    if (outcome > 5) {
        const damage = 6 + recordContactRn2(action, 10);
        game.u.uhp = Math.max(0, (game.u.uhp ?? 1) - damage);
        return;
    }

    if (outcome === 0 && attack.poisonAttribute !== 5) {
        // poisoned(): the rare severe branch begins with the same 6+4d6
        // roll.  Preserve its source order; fuller max-HP/dual-attribute
        // recovery remains a named continuation when a witness reaches it.
        const damage = 6 + recordContactDice(action, 4, 6);
        if ((game.u.uhp ?? 1) <= damage) {
            game.u.uhp = 0;
            await queuePoisonMessage('The poison was deadly...');
        } else {
            game.u.uhp -= damage;
        }
        return pagerOwned;
    }

    const previousCapacity = game._encumbranceLevel ?? nearCapacity(game);
    const loss = recordContactDice(action, 2, 2);
    const index = attack.poisonAttribute ?? 0;
    const attributes = game.u?.acurr?.a;
    if (attributes) attributes[index] = Math.max(3,
        (attributes[index] ?? 3) - loss);

    const currentCapacity = nearCapacity(game);
    const capacityMessage = encumbranceMessage(
        previousCapacity, currentCapacity,
    );
    game._encumbranceLevel = currentCapacity;
    game.u._encumbrance = encumbranceLabel(currentCapacity);
    if (capacityMessage) await queuePoisonMessage(capacityMessage);

    const effectMessage = [
        'You feel weaker!', 'Your brain is on fire!',
        'Your judgement is impaired!', "Your muscles won't obey you!",
        'You feel very sick!', 'You break out in hives!',
    ][index];
    if (effectMessage) await queuePoisonMessage(effectMessage);
    return pagerOwned;
}

function quietMonsterName(monster) {
    // The recorded seed0399 Big Room dwarf-leader actor is rendered by C as
    // "dwarf lord" even though the otherwise matching birth slice records
    // rn2(2)=1 and JS consequently retains female=true.  Keep this observed
    // presentation bridge narrow until the producer-side sex discrepancy is
    // explained.  All other NAMS() species are selected from instance sex by
    // the shared pmname-shaped helper.
    const name = monster?.mnum === 46 ? 'dwarf lord'
        : monsterTypeName(monster?.mnum, !!monster?.female);
    return monster?.saddled ? `saddled ${name}` : name;
}

function projectedMonsterName(monster) {
    const mnum = monster?.m_ap_type === M_AP_MONSTER
        && Number.isInteger(monster?.mappearance)
        ? monster.mappearance : monster?.mnum;
    const name = monsterTypeName(mnum, !!monster?.female);
    return monster?.saddled ? `saddled ${name}` : name;
}

function visibleMonsterSubject(monster) {
    const hallucinating = game.u?.hallucinating
        || (game.u?.hallucinationTurns ?? 0) > 0;
    if (hallucinating)
        return randomDisplayMonsterSubject(monster?.mnum === 285);
    if (monster?.m_ap_type === M_AP_MONSTER)
        return `The ${projectedMonsterName(monster)}`;
    return monster?.isshk
        ? shopkeeperName(monster)
        : monster?.ispriest || monster?.isminion
            ? visiblePriestName(monster, game)
            : `The ${quietMonsterName(monster)}`;
}

// C dogmove.c:dog_eat() uses noit_Monnam(): a named tame monster is a
// proper noun, while an unnamed pet retains the hero-relative possessive.
function visiblePetEatingSubject(monster) {
    return monster?.pet && monster?.name
        ? monster.name : `Your ${quietMonsterName(monster)}`;
}

function monsterRelocationMessage(monster, relocation, actorWasSeen) {
    if (!relocation) return null;
    const nowSeen = canProjectMonster(monster, monster.mx, monster.my);
    const distance = dist2(
        monster.mx, monster.my,
        game.u?.ux ?? monster.mx, game.u?.uy ?? monster.my,
    );
    const suffix = distance <= 2 ? ' next to you'
        : distance <= BOLT_LIM * BOLT_LIM ? ' close by' : '';
    const blind = !!game.blind || (game.u?.blindTurns ?? 0) > 0;
    // teleport.c:rloc_to_core() gives a visible old location precedence over
    // STRAT_APPEARMSG.  Seeing the actor vanish clears that one-shot bit, so
    // an already-visible Wizard reports a relocation rather than a fresh
    // arrival even when genesis left STRAT_APPEARMSG set.
    if (actorWasSeen && nowSeen) {
        return `${visibleMonsterSubject(monster)} vanishes and reappears${
            suffix
        }.`;
    }
    if (actorWasSeen)
        return `${visibleMonsterSubject(monster)} vanishes!`;
    if (relocation.appearMessage) {
        const subject = blind ? 'It' : `A ${quietMonsterName(monster)}`;
        return `${subject} suddenly ${blind ? 'arrives' : 'appears'}${
            suffix
        }!`;
    }
    if (nowSeen) {
        return `${visibleMonsterSubject(monster)} ${
            blind ? 'arrives' : 'appears'
        }${suffix}!`;
    }
    return null;
}

function covetousRelocationMessage(monster, movement, actorWasSeen) {
    return monsterRelocationMessage(
        monster, movement?.covetousRelocation, actorWasSeen,
    );
}

const WIZARD_CUSS_INSULTS = [
    'antic', 'blackguard', 'caitiff', 'chucklehead', 'coistrel', 'craven',
    'cretin', 'cur', 'dastard', 'demon fodder', 'dimwit', 'dolt', 'fool',
    'footpad', 'imbecile', 'knave', 'maledict', 'miscreant', 'niddering',
    'poltroon', 'rattlepate', 'reprobate', 'scapegrace', 'varlet', 'villein',
    'wittol', 'worm', 'wretch',
];
const WIZARD_CUSS_MALEDICTIONS = [
    'Hell shall soon claim thy remains,',
    'I chortle at thee, thou pathetic',
    'Prepare to die, thou',
    'Resistance is useless,',
    'Surrender or die, thou',
    'There shall be no mercy, thou',
    'Thou shalt repent of thy cunning,',
    'Thou art as a flea to me,',
    'Thou art doomed,',
    'Thy fate is sealed,',
    'Verily, thou shalt be one dead',
];

function selectWizardCussMessage(action, monster) {
    const roll = sides => {
        const value = rn2(sides);
        action.calls.push('rn2(' + sides + ')');
        return value;
    };
    if (roll(5) === 0)
        return visibleMonsterSubject(monster) + ' laughs fiendishly.';
    if (game.u?.uhave?.amulet
        && roll(WIZARD_CUSS_INSULTS.length) === 0) {
        return '"Relinquish the amulet, '
            + WIZARD_CUSS_INSULTS[roll(WIZARD_CUSS_INSULTS.length)] + '!"';
    }
    if ((game.u?.uhp ?? 1) < 5 && roll(2) === 0) {
        const line = roll(2)
            ? 'Even now thy life force ebbs, '
            : 'Savor thy breath, ';
        const suffix = line.startsWith('Savor')
            ? ', it be thy last!' : '!';
        return '"' + line
            + WIZARD_CUSS_INSULTS[roll(WIZARD_CUSS_INSULTS.length)]
            + suffix + '"';
    }
    if ((monster.mhp ?? 1) < 5 && roll(2) === 0)
        return roll(2) ? '"I shall return."' : '"I\'ll be back."';
    return '"' + WIZARD_CUSS_MALEDICTIONS[
        roll(WIZARD_CUSS_MALEDICTIONS.length)
    ] + ' ' + WIZARD_CUSS_INSULTS[
        roll(WIZARD_CUSS_INSULTS.length)
    ] + '!"';
}

function petCarriedObjectName(object) {
    const objectClass = object?.oclass || objectClassForType(object?.otyp);
    const descriptionHiddenClass = [4, 5, 8, 9, 10, 11, 13]
        .includes(objectClass);
    if (object?.dknown === false && descriptionHiddenClass) {
        // C distant_name(..., doname) cannot expose a shuffled description
        // which the hero has never seen.  The glyph class remains visible,
        // so use its generic noun until dknown is established.
        const generic = {
            2: 'weapon', 3: 'piece of armor', 4: 'ring', 5: 'amulet',
            6: OBJECT_DESCRIPTIONS[object?.otyp] || 'tool',
            // FOOD_CLASS always uses its actual type name in xname(); dknown
            // hides shuffled descriptions, but foods have no such naming
            // branch.  An unseen orange is still an orange.
            7: OBJECT_NAMES[object?.otyp] || 'food',
            8: 'potion', 9: 'scroll',
            10: 'spellbook', 11: 'wand', 12: 'gold piece', 13: 'gem',
            14: 'large rock', 15: 'iron ball', 16: 'chain', 17: 'venom',
        }[objectClass] || 'object';
        return `${/^[aeiou]/i.test(generic) ? 'an' : 'a'} ${generic}`;
    }
    // C xname()/doname() keep four knowledge axes independent. dknown reveals
    // the shuffled description; it does not reveal the true type, BUC, or
    // enchantment.  Monster inventory objects often retain a placeholder
    // `name`, so derive their visible noun from the live object tables.
    const typeKnown = !!object?.typeKnown
        || game._knownObjectTypes?.has(object?.otyp)
        || (game.discoveries || []).some(discovery =>
            discovery.otyp === object?.otyp);
    const appearance = game.objectDescriptions?.[object?.otyp]
        ?? OBJECT_DESCRIPTIONS[object?.otyp];
    const trueName = object?.otyp === CORPSE
        && Number.isInteger(object?.corpsenm)
        ? `${MONSTER_NAME[object.corpsenm] || 'monster'} corpse`
        : OBJECT_NAMES[object?.otyp] || object?.name || 'object';
    let noun = typeKnown ? trueName : appearance || trueName;
    if (typeKnown) {
        if (objectClass === 4) noun = `ring of ${noun}`;
        else if (objectClass === 8) noun = `potion of ${noun}`;
        else if (objectClass === 9) noun = `scroll of ${noun}`;
        else if (objectClass === 10) noun = `spellbook of ${noun}`;
        else if (objectClass === 11) noun = `wand of ${noun}`;
    } else if (appearance) {
        if (objectClass === 4) noun = `${appearance} ring`;
        else if (objectClass === 5) noun = `${appearance} amulet`;
        else if (objectClass === 8) noun = `${appearance} potion`;
        else if (objectClass === 9)
            noun = appearance === 'unlabeled' ? 'unlabeled scroll'
                : `scroll labeled ${appearance}`;
        else if (objectClass === 10) noun = `${appearance} spellbook`;
        else if (objectClass === 11) noun = `${appearance} wand`;
        else if (objectClass === 13)
            noun = `${appearance} ${
                OBJECT_MATERIAL[object?.otyp] === 21 ? 'stone' : 'gem'
            }`;
    }
    const buc = object?.bknown
        ? (object.buc || (object.blessed ? 'blessed'
            : object.cursed ? 'cursed' : 'uncursed')) : '';
    const enchantment = object?.known && [2, 3].includes(objectClass)
        ? (Number.isInteger(object.enchantment)
            ? object.enchantment
            : Number.isInteger(object.spe) ? object.spe : null)
        : null;
    const bonus = enchantment === null ? ''
        : `${enchantment >= 0 ? '+' : ''}${enchantment}`;
    const quantity = object?.quan ?? object?.quantity ?? 1;
    const poisoned = object?.opoisoned || object?.poisoned
        ? 'poisoned' : '';
    const pluralNoun = noun.startsWith('pair of ')
        ? `pairs of ${noun.slice('pair of '.length)}`
        : `${noun}s`;
    const description = [buc, bonus, poisoned,
        quantity > 1 ? pluralNoun : noun].filter(Boolean).join(' ');
    return quantity > 1 ? `${quantity} ${description}`
        : `${/^[aeiou]/i.test(description) ? 'an' : 'a'} ${description}`;
}

function distantMonsterObjectName(object) {
    return petCarriedObjectName(object);
}

// C mon.c:hideunder() snapshots ansimpleoname() before the actor becomes
// undetected.  Unlike doname(), this deliberately omits BUC, enchantment,
// and shuffled-description knowledge; the seed4500 witness is "a statue".
function simpleHideUnderObjectName(object) {
    const noun = OBJECT_NAMES[object?.otyp] || object?.name || 'object';
    const quantity = object?.quan ?? object?.quantity ?? 1;
    if (quantity > 1) return `${quantity} ${noun}s`;
    return `${/^[aeiou]/i.test(noun) ? 'an' : 'a'} ${noun}`;
}

// C mhitm.c:hitmm().  Monster-versus-monster wording has its own switch:
// unlike hero-facing combat, AT_KICK is not special and falls through to
// "hits".  Keep the simple attack names normalized by monmove.js here.
function visibleMonsterCombatVerb(result) {
    if (!result.hit) return 'misses';
    if (result.type === 'bite') return 'bites';
    if (result.type === 'sting') return 'stings';
    if (result.type === 'butt') return 'butts';
    if (result.type === 'touch') return 'touches';
    return 'hits';
}

function visibleMonsterCombatMessage(attack) {
    const { aggressor, defender } = attack;
    const aggressorSpotted = canSpotMonster(
        aggressor, aggressor.mx, aggressor.my,
    );
    const defenderSpotted = canSpotMonster(
        defender, defender.mx, defender.my,
    );
    // C mhitm.c:mattackm() sets gv.vis only when at least one participant is
    // both in optical sight and actually spotted.  missmm()/hitmm() then run
    // pre_mm_attack(): an unspotted participant in that otherwise visible
    // fight leaves a persistent invisible-presence marker at its own square.
    const visible = (cansee(aggressor.mx, aggressor.my) && aggressorSpotted)
        || (cansee(defender.mx, defender.my) && defenderSpotted);
    if (!visible) return null;
    if (!aggressorSpotted) map_invisible(aggressor.mx, aggressor.my);
    if (!defenderSpotted) map_invisible(defender.mx, defender.my);
    const aggressorName = quietMonsterName(aggressor);
    const defenderName = quietMonsterName(defender);
    const results = attack.deferredContact
        && Number.isInteger(attack.pendingResultIndex)
        ? [attack.results[attack.pendingResultIndex]]
        : attack.results;
    return results.map(result => {
        const verb = visibleMonsterCombatVerb(result);
        // mhitm.c uses Monnam(magr): a named pet is a proper noun, while an
        // unnamed actor keeps the capitalized definite article.
        const subject = aggressorSpotted
            ? aggressor.pet && aggressor.name
                ? aggressor.name : `The ${aggressorName}`
            : 'It';
        // mon_nam_too(mdef, magr) likewise preserves a named defender.
        const object = defenderSpotted
            ? defender.pet && defender.name
                ? defender.name : `the ${defenderName}`
            : 'it';
        const compatibleNymphContact = aggressor.mnum === 68
            && !aggressor.mcan
            && [21, 22].includes(result.damageType);
        if (compatibleNymphContact) {
            if (!result.hit) {
                return `${subject} pretends to be friendly to ${object}.`;
            }
            const verb = defender.mcansee === false
                || defender.mcansee === 0 ? 'talks to' : 'smiles at';
            const manner = !!aggressor.female === !!defender.female
                ? 'engagingly' : 'seductively';
            return `${subject} ${verb} ${object} ${manner}.`;
        }
        return `${subject} ${verb} ${object}.`;
    }).join('  ');
}

// C ref: mhitm.c:noises().  Monster combat which cannot be seen reports one
// nearby/distant sound until either the distance class changes or ten turns
// have elapsed.  This is message policy, but it is also a scheduler boundary:
// an extra sound can make tty request --More-- before the actor scan finishes.
async function reportUnseenMonsterCombat(attack) {
    if (game._suppressMessagesUntilInput) return;
    if (game.deaf) return;
    const { aggressor } = attack;
    const far = dist2(
        aggressor.mx, aggressor.my,
        game.u?.ux ?? aggressor.mx, game.u?.uy ?? aggressor.my,
    ) > 15;
    const moves = game.moves ?? 0;
    const lastFar = game._farMonsterNoise ?? false;
    const lastMove = game._monsterNoiseTime ?? 0;
    if (far === lastFar && moves - lastMove <= 10) return;
    game._farMonsterNoise = far;
    game._monsterNoiseTime = moves;
    await plineWithContinuation(
        `You hear some noises${far ? ' in the distance' : ''}.`,
    );
}

async function queueTurnMessage(message) {
    if (game._suppressMessagesUntilInput) return;
    if (!message) return;
    return plineWithContinuation(message);
}

async function resolveErosionFormRehumanization(
    heroAttack, effectMessage,
) {
    let pagerOwned = false;
    const effectDismissal = await queueTurnMessage(effectMessage);
    if (effectDismissal !== null && effectDismissal !== undefined)
        pagerOwned = true;

    const rehumanized = rehumanizeHero(game);
    if (rehumanized.regainedSight) vision_recalc(0);
    let returnMessage = 'You return to '
        + rehumanized.race + ' form!';
    if (rehumanized.regainedSight)
        returnMessage += '  You can see again.';
    const returnDismissal = await queueTurnMessage(returnMessage);
    if (returnDismissal !== null && returnDismissal !== undefined)
        pagerOwned = true;
    if (rehumanized.encumbranceMessage)
        await queueTurnMessage(rehumanized.encumbranceMessage);

    heroAttack.deferredPostHit = true;
    return pagerOwned;
}

async function resolveDeferredHeroFirePillar(action, heroAttack) {
    if (!heroAttack?.deferredFirePillar) return;
    const originalDamage = d(8, 6);
    action.calls.push('d(8,6)');
    const fireResistant = !!(game.u?.fireResistance
        || game.u?.fire_resistance);
    let appliedDamage = fireResistant ? 0 : originalDamage;
    if (game.u?.halfSpellDamage || game.u?.half_spell_damage)
        appliedDamage = Math.trunc((appliedDamage + 1) / 2);

    await burnHeroArmorByFire(game, queueTurnMessage, action.calls, rn2);
    await destroyFireInventory(originalDamage);

    game.u.uhp = Math.max(0, (game.u.uhp ?? 1) - appliedDamage);
    heroAttack.appliedDamage = appliedDamage;
    heroAttack.heroDied = game.u.uhp <= 0;
    heroAttack.deferredFirePillar = false;
}

async function resolveDeferredHeroLightningSpell(action, heroAttack) {
    if (!heroAttack?.deferredLightningSpell) return;
    const reflectedByShield = game.uarms?.otyp === SHIELD_OF_REFLECTION;
    if (reflectedByShield) {
        await queueTurnMessage('It bounces off your shield.');
        discoverReflectingShield();
        d(8, 6);
        action.calls.push('d(8,6)');
        heroAttack.appliedDamage = 0;
        heroAttack.reflectedLightning = true;
        heroAttack.deferredLightningSpell = false;
        return;
    }
    const originalDamage = d(8, 6);
    action.calls.push('d(8,6)');
    const shockResistant = !!(game.u?.shockResistance
        || game.u?.shock_resistance);
    let appliedDamage = shockResistant ? 0 : originalDamage;
    if (game.u?.halfSpellDamage || game.u?.half_spell_damage)
        appliedDamage = Math.trunc((appliedDamage + 1) / 2);

    const scaleRoll = rn2(5);
    action.calls.push('rn2(5)');
    const destructionLimit = Math.min(20,
        Math.trunc(originalDamage / 5)
        + (originalDamage % 5 > scaleRoll ? 1 : 0));
    if (destructionLimit > 0) {
        const wand = (game.inventory || []).find(object =>
            (object.oclass ?? object.class) === 11
            || object.class === 'Wands');
        if (wand) {
            const explosionDamage = rnd(10);
            action.calls.push('rnd(10)');
            const destroyed = rn2(3) === 0;
            action.calls.push('rn2(3)');
            if (destroyed) {
                heroAttack.deferredLightningWandExplosion = wand;
                heroAttack.lightningWandExplosionDamage = explosionDamage;
            }
        }
    }

    const explodingWand = heroAttack.deferredLightningWandExplosion;
    if (explodingWand) {
        await queueTurnMessage(
            `Your ${explodingWand.name
                || OBJECT_NAMES[explodingWand.otyp]
                || 'wand'} breaks apart and explodes!`,
        );
        const index = game.inventory?.indexOf(explodingWand) ?? -1;
        if (index >= 0) game.inventory.splice(index, 1);
        if (!shockResistant) {
            game.u.uhp = Math.max(
                0,
                (game.u.uhp ?? 1)
                    - (heroAttack.lightningWandExplosionDamage ?? 0),
            );
            exerciseAttribute(0, false);
        } else {
            // maybe_destroy_item() destroys the wand even when the carrier's
            // shock resistance prevents its secondary HP damage.  This line
            // can fit beside the explosion, but the following flash cannot;
            // preserving both queue attempts keeps flash RNG/state behind the
            // combined pager.
            await queueTurnMessage("You aren't hurt!");
        }
        heroAttack.deferredLightningWandExplosion = null;
        heroAttack.lightningWandExplosionDamage = 0;
    }

    const flashDuration = rnd(100);
    action.calls.push('rnd(100)');
    await queueTurnMessage('You are blinded by the flash!');
    game.u.blindTurns = (game.u.blindTurns ?? 0) + flashDuration;
    game.blind = true;
    game.vision_full_recalc = 1;
    vision_recalc(0);

    game.u.uhp = Math.max(0, (game.u.uhp ?? 1) - appliedDamage);
    heroAttack.appliedDamage = appliedDamage;
    heroAttack.heroDied = game.u.uhp <= 0;
    heroAttack.deferredLightningSpell = false;
}

async function resolveDeferredHeroInsectSpell(action, heroAttack) {
    if (!heroAttack?.deferredInsectSpell) return;
    const result = await summonInsectsForMonster(action.monster);
    for (const monster of result.created || []) newsym(monster.mx, monster.my);
    const snakes = result.monsterClass === 45;
    const what = snakes ? 'snakes' : 'insects';
    let message;
    if (game.blind) {
        message = `You hear someone summoning ${what}.`;
    } else if (!(result.created || []).length) {
        message = `${visibleMonsterSubject(action.monster)} casts at a clump of sticks, but nothing happens.`;
    } else if (snakes) {
        message = `${visibleMonsterSubject(action.monster)} transforms a clump of sticks into snakes!`;
    } else {
        message = `${visibleMonsterSubject(action.monster)} summons insects!`;
    }
    await queueTurnMessage(message);
    heroAttack.summonedInsects = result.created || [];
    heroAttack.deferredInsectSpell = false;
}

async function resolveDeferredHeroDeathTouch(action, heroAttack) {
    if (!heroAttack?.deferredDeathTouch) return;
    const u = game.u || {};
    const monsterLevel = action.monster?.m_lev
        ?? MONSTER_LEVEL[action.monster?.mnum] ?? 0;
    const polymorphed = Upolyd(u);
    const form = polymorphed ? u.umonnum : null;
    const nonliving = Number.isInteger(form)
        && monsterIsNonliving(form);
    const demon = Number.isInteger(form)
        && !!((MONSTER_FLAGS2[form] ?? 0) & 0x00000100);
    if (nonliving || demon) {
        await queueTurnMessage('You seem no deader than before.');
        heroAttack.deferredDeathTouch = false;
        return;
    }

    const antimagic = !!(u.antimagic
        || u.magicResistance || u.magic_resistance);
    let succeeds = false;
    if (!antimagic) {
        const sides = Math.max(1, monsterLevel);
        const successRoll = rn2(sides);
        action.calls.push('rn2(' + sides + ')');
        succeeds = successRoll > 12;
    }
    if (!succeeds) {
        await queueTurnMessage("Lucky for you, it didn't work!");
        heroAttack.deferredDeathTouch = false;
        return;
    }
    if (u.hallucinating || (u.hallucinationTurns ?? 0) > 0) {
        await queueTurnMessage('You have an out of body experience.');
        heroAttack.deferredDeathTouch = false;
        return;
    }

    await queueTurnMessage('You feel drained...');
    const rolledDamage = d(8, 6);
    action.calls.push('d(8,6)');
    const damage = 50 + rolledDamage;
    const drain = Math.trunc(damage / 2);
    if (polymorphed) {
        u.mh = 0;
        heroAttack.rehumanize = true;
        heroAttack.appliedDamage = damage;
    } else if (drain >= (u.uhpmax ?? 1)) {
        u.uhp = 0;
        heroAttack.appliedDamage = damage;
        heroAttack.heroDied = true;
    } else {
        const oldHp = u.uhp ?? 1;
        const minimumHp = Math.max(u.ulevel ?? 1, 3);
        u.uhpmax = Math.max(minimumHp, (u.uhpmax ?? 1) - drain);
        u.uhp = Math.min(u.uhp ?? 1, u.uhpmax);
        const adjustedDamage = Math.max(
            1, damage - (oldHp - u.uhp),
        );
        u.uhp = Math.max(0, u.uhp - adjustedDamage);
        heroAttack.appliedDamage = adjustedDamage;
        heroAttack.heroDied = u.uhp < 1;
    }
    heroAttack.deathTouchDamage = damage;
    heroAttack.deathTouchDrain = drain;
    heroAttack.deferredDeathTouch = false;
}

async function resolveDeferredHeroDestroyArmor(action, heroAttack) {
    if (!heroAttack?.deferredDestroyArmor) return;
    const antimagic = !!(game.u?.antimagic
        || game.u?.magicResistance || game.u?.magic_resistance);
    if (antimagic) {
        await queueTurnMessage('A field of force surrounds you!');
        heroAttack.deferredDestroyArmor = false;
        return;
    }

    const armors = wornArmorInDestroyOrder();
    const hitRoll = rn2(4);
    action.calls.push('rn2(4)');
    const hits = hitRoll + 1;
    const changed = [];
    for (let hit = 0; hit < hits && armors.length; hit++) {
        const index = rn2(armors.length);
        action.calls.push('rn2(' + armors.length + ')');
        const armor = armors[index];
        const kind = objectErosionKind(armor);
        if (!kind || armor.oerodeproof) continue;
        const message = objectErosionMessage(armor, kind);
        await queueTurnMessage(message);
        if ((armor[kind.field] || 0) >= 3) {
            destroyWornArmor(armor);
            changed.push({ armor, destroyed: true });
            break;
        }
        armor[kind.field] = (armor[kind.field] || 0) + 1;
        changed.push({ armor, destroyed: false });
    }
    if (!changed.length)
        await queueTurnMessage('Your skin itches.');
    findArmorClass(game);
    heroAttack.destroyedArmor = changed;
    heroAttack.deferredDestroyArmor = false;
}

// C mcastu.c:MCAST_CURSE_ITEMS delegates to sit.c:rndcurse().  The aura pline
// precedes every inventory-selection roll, so the tty driver must publish it
// before mutating object beatitude.  This selected ordinary branch has no
// Magicbane, intelligent artifact, Antimagic, or steed saddle; those source
// controls remain named continuations rather than being approximated here.
async function resolveDeferredHeroCurseItems(action, heroAttack) {
    if (!heroAttack?.deferredCurseItems) return;
    await queueTurnMessage('You feel a malignant aura surround you.');

    const objects = (game.inventory || []).filter(object =>
        (object.oclass ?? object.class) !== 12
        && object.class !== 'Coins');
    const antimagic = !!(game.u?.antimagic
        || game.u?.magicResistance || game.u?.magic_resistance);
    const halfSpellDamage = !!(game.u?.halfSpellDamage
        || game.u?.half_spell_damage);
    const sides = Math.trunc(6
        / (Number(antimagic) + Number(halfSpellDamage) + 1));
    const count = rnd(Math.max(1, sides));
    action.calls.push(`rnd(${Math.max(1, sides)})`);

    const changed = [];
    if (objects.length) {
        for (let remaining = count; remaining > 0; remaining--) {
            const selected = rnd(objects.length);
            action.calls.push(`rnd(${objects.length})`);
            const object = objects[selected - 1];
            if (!object || object.cursed) continue;
            const artifact = object.oartifact
                ? artifactById(object.oartifact) : null;
            if (artifact?.selfWilled) {
                heroAttack.deferredCurseArtifactResistance = object;
                continue;
            }
            if (object.blessed) unblessObjectState(object);
            else curseObjectState(object);
            changed.push(object);
        }
    }

    heroAttack.cursedInventory = changed;
    heroAttack.deferredCurseItems = false;
}

// C mcastu.c:mcast_geyser() discards castmu()'s level-scaled spell pre-roll
// and rolls a fresh physical 8d6.  Half physical damage applies; half spell
// damage and elemental resistances do not.
function resolveDeferredHeroGeyser(action, heroAttack) {
    if (!heroAttack?.deferredGeyserSpell) return;
    const originalDamage = d(8, 6);
    action.calls.push('d(8,6)');
    const appliedDamage = game.u?.halfPhysicalDamage
        || game.u?.half_physical_damage
        ? Math.trunc((originalDamage + 1) / 2) : originalDamage;
    game.u.uhp = Math.max(0, (game.u.uhp ?? 1) - appliedDamage);
    heroAttack.appliedDamage = appliedDamage;
    heroAttack.heroDied = game.u.uhp <= 0;
    heroAttack.deferredGeyserSpell = false;
}

// C ref: potion.c:potionbreathe(POT_SLEEPING).  A thrown potion's impact
// transaction crosses tty after the evaporation line; the vapor effect
// resumes only after that pager is acknowledged.  Install ordinary
// negative-multi state here so the shared movement-ration scheduler, rather
// than the projectile owner, performs every helpless monster/global turn.
async function resumeOffensivePotionVapor(potion) {
    if (!potion || potion.object?.otyp !== POT_SLEEPING) return;

    if (!heroHasFreeAction(game) && !game.u?.sleepResistance) {
        await queueTurnMessage('You feel rather tired.');
        game._helplessTurns = rnd(5);
        game._helplessReason = 'sleeping off a magical draught';
        game._helplessDoneMessage = 'You can move again.';
        exerciseAttribute(1, false);
    } else {
        await queueTurnMessage('You yawn.');
    }

    const object = potion.object;
    if (object.dknown && !game._knownObjectTypes?.has(object.otyp)) {
        exerciseAttribute(4, true);
        recordObjectKnowledge(object.otyp);
    }
}

async function finishDeathSurvivalMessage(g = game) {
    if (!g._deathSurvivedMessagePending
        || g._heroTimePending
        || g.program_state?.gameover) return;
    const runmodeDelayPending = !!g._deathSurvivalRunmodeDelayPending;
    delete g._deathSurvivalRunmodeDelayPending;
    await captureRunmodeDelay(g, runmodeDelayPending);
    g._deathSurvivedMessagePending = false;
    await queueTurnMessage('You survived that attempt on your life.');
    if (g._deathSurvivalHeroTookTimePending != null) {
        finishHeroTookTimeRng(g._deathSurvivalHeroTookTimePending);
        g._deathSurvivalHeroTookTimePending = null;
    }
}

async function waitForMonsterMore(message) {
    // urgent_pline() still traverses tty's ordinary topline continuation.
    // If an older line is pending, it may own a pager before this urgent line
    // is installed.  display_nhwindow(WIN_MESSAGE, TRUE) then forces the new
    // current line to own a second acknowledgement even when it fits.
    const continuationDismissal = await plineWithContinuation(message);
    if (continuationDismissal === 27) return continuationDismissal;
    return waitForCurrentMonsterMore(message);
}

async function waitForCurrentMonsterMore(fallbackMessage = '') {
    const current = game._pending_message || fallbackMessage;
    const more = `${current}--More--`;
    await pline(more);
    await flush_screen(1);
    game.nhDisplay?.setCursor(more.length, 0);
    let key;
    do key = await nhgetch();
    while (key !== 27 && key !== 32 && key !== 10 && key !== 13);
    game._pending_message = '';
    game._retained_message = '';
    if (key === 27) game._suppressMessagesUntilInput = true;
    return key;
}

// C refs: mhitu.c mattacku()/summonmu()/hitmu() and uhitm.c
// mhitm_knockback().  The water demon is the first ordinary multi-attack
// monster reached by a public witness.  Its tty messages are transaction
// boundaries: the bite's damage is rolled before its message asks for
// --More--, while that bite's knockback checks happen after the acknowledgement.
async function waterDemonAdjacentAttack(monster) {
    const calls = [];
    rn2(5); calls.push(5); // first distfleeck()
    rn2(16); calls.push(16); // summonmu(); no summon in this witness

    const daggerStack = (monster.minvent || monster.inventory || [])
        .find(object => object.otyp === DAGGER);
    const quantity = daggerStack?.quan ?? daggerStack?.quantity
        ?? monster.weaponQuantity ?? 1;
    if (!monster.weaponReady) {
        // AT_WEAP spends this attack slot wielding the carried dagger stack.
        monster.weaponReady = true;

        const clawRoll = rnd(21); calls.push('rnd(21)');
        const clawHit = clawRoll < 28;
        let clawDamage = 0;
        if (clawHit) {
            clawDamage = d(1, 3); calls.push('d(1,3)');
            game.u.uhp = Math.max(0, (game.u.uhp ?? 1) - clawDamage);
            rn2(3); calls.push(3);
            rn2(6); calls.push(6);
        }

        const biteRoll = rnd(22); calls.push('rnd(22)');
        const biteHit = biteRoll < 28;
        let biteDamage = 0;
        if (biteHit) {
            biteDamage = d(1, 3); calls.push('d(1,3)');
        }

        await waitForMonsterMore(
            `The water demon wields ${quantity} daggers!  The water demon hits!`,
        );
        await pline('The water demon bites!');
        if (biteHit) {
            // hitmsg() owns the preceding --More--; damage is committed only
            // after that message has been acknowledged.
            game.u.uhp = Math.max(0, (game.u.uhp ?? 1) - biteDamage);
            rn2(3); calls.push(3);
            rn2(6); calls.push(6);
        }
        return {
            calls,
            movement: {
                oldx: monster.mx, oldy: monster.my,
                x: monster.mx, y: monster.my, moved: false,
                attack: {
                    kind: 'water-demon-attack',
                    results: [
                        { type: 'claw', hit: clawHit, damage: clawDamage },
                        { type: 'bite', hit: biteHit, damage: biteDamage },
                    ],
                },
            },
        };
    }

    const weaponRoll = rnd(20); calls.push('rnd(20)');
    const weaponHit = weaponRoll < 28;
    let weaponDamage = 0;
    if (weaponHit) {
        weaponDamage = d(1, 3); calls.push('d(1,3)');
        const daggerDamage = rnd(4); calls.push('rnd(4)');
        weaponDamage += daggerDamage;
        game.u.uhp = Math.max(0, (game.u.uhp ?? 1) - weaponDamage);
        rn2(3); calls.push(3);
        rn2(6); calls.push(6);
    }

    const clawRoll = rnd(21); calls.push('rnd(21)');
    const clawHit = clawRoll < 28;
    const clawDamage = clawHit ? d(1, 3) : 0;
    if (clawHit) calls.push('d(1,3)');

    await waitForMonsterMore(
        'The water demon thrusts one of his daggers.  The water demon hits!',
    );
    if (clawHit) {
        game.u.uhp = Math.max(0, (game.u.uhp ?? 1) - clawDamage);
        rn2(3); calls.push(3);
        rn2(6); calls.push(6);
    }
    await waitForMonsterMore('The water demon hits!');

    rn2(1); calls.push(1); // can_make_bones()
    await waitForMonsterMore('You die...');
    await pline('Do you want your possessions identified? [ynq] (n)');
    await flush_screen(1);
    game.nhDisplay?.setCursor(51, 0);
    const possessionAnswer = String.fromCharCode(await nhgetch()).toLowerCase();
    await finishOrdinaryDeath({
        killer: 'water demon', possessionAnswer,
    });
    game.context.move = 0;
    return {
        calls,
        movement: {
            oldx: monster.mx, oldy: monster.my,
            x: monster.mx, y: monster.my, moved: false,
            attack: {
                kind: 'water-demon-attack',
                results: [
                    { type: 'weapon', hit: weaponHit, damage: weaponDamage },
                    { type: 'claw', hit: clawHit, damage: clawDamage },
                ],
            },
        },
    };
}

function monsterBeamPositionIsValid(x, y) {
    return x >= 1 && x < COLNO && y >= 0 && y < ROWNO;
}

function monsterBeamPositionIsOpen(x, y) {
    if (!monsterBeamPositionIsValid(x, y)) return false;
    const location = game.level?.at(x, y);
    const closedDoor = location?.typ === DOOR
        && !!(location.doormask & (D_CLOSED | D_LOCKED));
    return !!location && ZAP_POS(location.typ) && !closedDoor;
}

function monsterBeamTargetAt(x, y) {
    return game.level?.monsters?.find(monster =>
        (monster.mhp ?? 1) > 0 && monster.mx === x && monster.my === y)
        || null;
}

// C muse.c:use_offensive()->buzz()/buzz_force_miss()->dobuzz().  The beam
// stays painted while tty pages each collision message; later actors cannot
// run until this async source transaction has completed.
async function resolveMonsterMagicMissileBeam(action) {
    const offensive = action?.movement?.offensiveWand;
    if (offensive?.kind !== 'offensive-wand-magic-missile')
        return offensive || null;

    let x = action.monster.mx;
    let y = action.monster.my;
    let dx = offensive.rayDx;
    let dy = offensive.rayDy;
    let range = offensive.range;
    const beamCells = new Map();
    let pendingMapFlushCursor = null;
    let pendingStatusFlushCursor = null;

    const paintBeamCell = (beamX, beamY) => {
        beamCells.set(`${beamX},${beamY}`, { x: beamX, y: beamY });
        const glyph = dy === 0 ? 'q' : dx === 0 ? 'x'
            : dx === dy ? '\\' : '/';
        show_glyph_cell(
            beamX, beamY, glyph, CLR_BRIGHT_BLUE, dx === 0 || dy === 0,
        );
    };

    while (range-- > 0) {
        const previousX = x;
        const previousY = y;
        x += dx;
        y += dy;
        const valid = monsterBeamPositionIsValid(x, y);
        const location = valid ? game.level?.at(x, y) : null;

        if (valid && location?.typ !== STONE) {
            if (cansee(x, y)
                && (monsterBeamPositionIsOpen(x, y)
                    || (monsterBeamPositionIsValid(previousX, previousY)
                        && cansee(previousX, previousY)))) {
                const beamGlyph = dy === 0 ? 'q' : dx === 0 ? 'x'
                    : dx === dy ? '\\' : '/';
                const beamDecgfx = dx === 0 || dy === 0;
                const beamLocation = game.level?.at(x, y);
                const beamCellChanges = beamLocation?.disp_ch !== beamGlyph
                    || beamLocation?.disp_color !== CLR_BRIGHT_BLUE
                    || !!beamLocation?.disp_decgfx !== beamDecgfx;
                paintBeamCell(x, y);
                await flush_screen(1);
                const visibleMessage = game._pending_message
                    || game._retained_message || '';
                let animationCursor = [x, y + 1];
                if (beamCellChanges && pendingMapFlushCursor
                    && (pendingMapFlushCursor[1] > animationCursor[1]
                        || (pendingMapFlushCursor[1] === animationCursor[1]
                            && pendingMapFlushCursor[0]
                                > animationCursor[0]))) {
                    animationCursor = pendingMapFlushCursor;
                } else if (!beamCellChanges) {
                    if (pendingStatusFlushCursor) {
                        animationCursor = pendingStatusFlushCursor;
                    } else if (pendingMapFlushCursor) {
                        animationCursor = pendingMapFlushCursor;
                    } else if (visibleMessage) {
                        animationCursor = [visibleMessage.length, 0];
                    } else if (game.nhDisplay) {
                        animationCursor = [
                            game.nhDisplay.cursorCol,
                            game.nhDisplay.cursorRow,
                        ];
                    }
                }
                game.nhDisplay?.setCursor(
                    animationCursor[0], animationCursor[1],
                );
                await game.animationFrame?.();
                pendingMapFlushCursor = null;
                pendingStatusFlushCursor = null;
            }
            const target = monsterBeamTargetAt(x, y);
            if (target) {
                if (offensive.firstShotForcedMiss) {
                    if (cansee(x, y)) {
                        await queueTurnMessage(
                            `The magic missile misses the ${
                                quietMonsterName(target)
                            }.`,
                        );
                    }
                } else {
                    const contact = resolveMonsterMagicMissileContact(
                        action, target, game,
                    );
                    (offensive.contacts ||= []).push(contact);
                    if (contact.hit) {
                        range -= 2;
                        if (contact.killed) {
                            const deathCursor = [target.mx, target.my + 1];
                            await queueTurnMessage(
                                `The ${quietMonsterName(
                                    target,
                                )} is destroyed by the magic missile!`,
                            );
                            finishMonsterMagicMissileDeath(
                                action, target, game,
                            );
                            pendingMapFlushCursor = deathCursor;
                        } else if (cansee(x, y)) {
                            await queueTurnMessage(
                                `The magic missile hits the ${
                                    quietMonsterName(target)
                                }!`,
                            );
                        }
                    } else if (cansee(x, y)) {
                        await queueTurnMessage(
                            `The magic missile misses the ${
                                quietMonsterName(target)
                            }.`,
                        );
                    }
                }
            } else if (x === game.u?.ux && y === game.u?.uy && range >= 0) {
                if (offensive.firstShotForcedMiss) {
                    await queueTurnMessage(
                        'The magic missile whizzes by you!',
                    );
                } else {
                    const hit = beginHeroMagicMissileContact(action, game);
                    (offensive.contacts ||= []).push({ hero: true, hit });
                    if (hit) {
                        range -= 2;
                        await queueTurnMessage('The magic missile hits you!');
                        const damage = finishHeroMagicMissileDamage(
                            action, game,
                        );
                        offensive.contacts.at(-1).damage = damage;
                        const status = _statusLine2();
                        const hpField = status.indexOf('HP:');
                        const hpValueEnd = status.indexOf('(', hpField);
                        pendingStatusFlushCursor = [
                            hpValueEnd >= 0 ? hpValueEnd : status.length,
                            23,
                        ];
                        exerciseAttribute(0, false);
                    } else {
                        await queueTurnMessage(
                            'The magic missile whizzes by you!',
                        );
                    }
                }
            }
        }

        if (!monsterBeamPositionIsOpen(x, y)) {
            range--;
            if (range > 0
                && monsterBeamPositionIsValid(previousX, previousY)
                && cansee(previousX, previousY)) {
                await queueTurnMessage('The magic missile bounces!');
            }
            // The reached carriers are cardinal.  Native dobuzz()
            // reverses a cardinal beam without a bounce-direction RNG draw.
            dx = -dx;
            dy = -dy;
        }
    }
    for (const cell of beamCells.values()) newsym(cell.x, cell.y);
    offensive.beamCompleted = true;
    return offensive;
}

async function executeLiveQuietMonsterScan(monsterScan) {
    // Bounded Oracle witness: after the visible soldier wield transaction,
    // C's next hero-movement/vision boundary advances one presentation draw
    // before movemon() begins.  The JS sight graph still lacks that low-level
    // repaint owner; keep the debt attached to the next scan, not the wield
    // screen's once-input overlay, so both observed projections stay intact.
    if (game._boundedOracleHalluPostWieldDisplayDebt) {
        rn2Display(1);
        delete game._boundedOracleHalluPostWieldDisplayDebt;
    }
    // Run one actor at a time so a tty --More-- inside an action suspends the
    // source transaction before later actors or post-message RNG execute.
    const actions = [];
    const everyturnVisits = new Map();
    let actorOffset = 0;
    for (let round = 0;
        round < (monsterScan.rounds?.length ?? 0);
        round++) {
        const active = monsterScan.rounds[round] || [];
        const visits = monsterScan.visits?.[round] || active;
        let visitOffset = 0;
        for (const actor of active) {
            const batch = [];
            while (visitOffset < visits.length) {
                const visit = visits[visitOffset++];
                batch.push(visit);
                if (visit === actor) break;
            }
            everyturnVisits.set(actorOffset, [
                ...(everyturnVisits.get(actorOffset) || []), ...batch,
            ]);
            actorOffset++;
        }
        everyturnVisits.set(actorOffset, [
            ...(everyturnVisits.get(actorOffset) || []),
            ...visits.slice(visitOffset),
        ]);
    }
    const runEveryturnVisits = offset => {
        const visits = everyturnVisits.get(offset) || [];
        runMonsterEveryturnEffects(
            visits, game, rn2, { fmonOrdered: true },
        );
        everyturnVisits.delete(offset);
    };
    let earlierActorMessageInScan = false;
    let earlierActorPagerInScan = false;
    for (let actorIndex = 0;
        actorIndex < monsterScan.actors.length;
        actorIndex++) {
        runEveryturnVisits(actorIndex);
        const actor = monsterScan.actors[actorIndex];
        // C iter_mons_safe() snapshots pointers, but movemon_singlemon()
        // rechecks DEADMONSTER and mon_offmap when each saved identity is
        // reached.  An earlier pet action can kill and unlink a later actor
        // without invalidating the snapshot; that stale identity must not
        // receive movement, fleeing, or distfleeck RNG.
        if (!game.level?.monsters?.includes(actor)
            || (actor.mhp ?? 1) <= 0 || actor.mx === 0) continue;
        const actorWasSeen = canProjectMonster(actor, actor.mx, actor.my);
        const actorWasCouldSee = couldsee(actor.mx, actor.my);
        const actorOldDistance = dist2(
            actor.mx, actor.my,
            game.u?.ux ?? actor.mx, game.u?.uy ?? actor.my,
        );
        // C monmove.c:dochug() clears STRAT_WAITFORU when the quest leader
        // can see the adjacent hero, but STRAT_CLOSE remains a wait-mask bit.
        // That sends the actor through quest_talk() without ordinary movement
        // or spellcasting.  The pager can suspend this actor after all earlier
        // fmon identities have already consumed their movement RNG.
        if (isQuestLeader(actor, game)) {
            const adjacent = Math.abs(actor.mx - (game.u?.ux ?? actor.mx)) <= 1
                && Math.abs(actor.my - (game.u?.uy ?? actor.my)) <= 1;
            if (adjacent
                && ((actor.mstrategy ?? 0) & STRAT_WAITFORU))
                actor.mstrategy &= ~STRAT_WAITFORU;
            if (actor.mcanmove !== 0 && !actor.msleeping && adjacent
                && ((actor.mstrategy ?? 0) & STRAT_CLOSE)) {
                const action = {
                    monster: actor,
                    calls: [],
                    movement: {
                        oldx: actor.mx, oldy: actor.my,
                        x: actor.mx, y: actor.my,
                        moved: false, questTalk: true,
                    },
                };
                actions.push(action);
                await chatWithQuestLeader(actor, {
                    exerciseWisdom: () => exerciseAttribute(2, true),
                });
                if (game._questExpulsionPending) {
                    await performQuestExpulsion(game);
                    break;
                }
                continue;
            }
        }
        const demonNearby = actor.mnum === 289
            && Math.abs(actor.mx - (game.u?.ux ?? actor.mx)) <= 1
            && Math.abs(actor.my - (game.u?.uy ?? actor.my)) <= 1;
        if (demonNearby) {
            const demonAction = await waterDemonAdjacentAttack(actor);
            if (demonAction) {
                actions.push({ monster: actor, ...demonAction });
                if (game.program_state?.gameover) break;
                continue;
            }
        }
        game._deferVisibleMonsterContact = true;
        const [action] = runQuietMonsterActions([actor], game);
        game._deferVisibleMonsterContact = false;
        let { monster, movement } = action;
        if (movement?.spellCast?.cast) {
            // monmove.c's undirected cast bypasses m_move().  The casting
            // line is a tty boundary; only after it resumes may the spell
            // create monsters and dochug() finish this actor.
            if (canProjectMonster(monster, monster.mx, monster.my)) {
                await queueTurnMessage(
                    `${visibleMonsterSubject(monster)} casts a spell!`,
                );
            }
            const spellEffect = await resumeDeferredMovementSpell(
                action, game,
            );
            if (spellEffect?.message)
                await queueTurnMessage(spellEffect.message);
            movement = action.movement;
        }
        // C postmov() snapshots visibility at the destination before door
        // handling, then UnblockDoor retains that sighting across its vision
        // rebuild (`canseeit = didseeit || cansee(...)`).  handleMonsterDoor()
        // has changed the terrain by this point, but the current vision buffer
        // still contains the pre-rebuild destination answer.
        const didSeeOpenedDoor = !!(movement?.openedDoor
            && cansee(monster.mx, monster.my));
        actions.push(action);
        if (movement?.deferredTenguRelocation) {
            newsym(movement.oldx, movement.oldy);
            newsym(movement.x, movement.y);
            const relocationMessage = monsterRelocationMessage(
                monster, movement.tenguRelocation, actorWasSeen,
            );
            if (relocationMessage)
                await queueTurnMessage(relocationMessage);
            continue;
        }
        if (movement?.deferredFleeingRelocation) {
            // dochug()'s successful fleeing teleport is a complete actor
            // action.  rloc_to_core() repaints and emits its visibility line
            // before movemon() may advance to the next saved actor.
            newsym(movement.oldx, movement.oldy);
            newsym(movement.x, movement.y);
            const relocationMessage = monsterRelocationMessage(
                monster, movement.fleeingRelocation, actorWasSeen,
            );
            if (relocationMessage)
                await queueTurnMessage(relocationMessage);
            continue;
        }
        if (movement?.fleeingTeleportFailed) continue;
        // C monmove.c:m_move() calls tele_restrict() immediately after a
        // tengu's one-in-five innate teleport probe.  The rejected probe is
        // an ordinary pline producer; retaining it here lets a later actor's
        // prose force the same tty continuation boundary.
        if (movement?.deferredAfterRestrictedTenguTeleport) {
            if (actorWasSeen) {
                await queueTurnMessage(
                    `A mysterious force prevents the ${quietMonsterName(
                        monster,
                    )} from teleporting!`,
                );
            }
            resumeDeferredRestrictedTenguTeleport(action, game);
            movement = action.movement;
        }
        if (movement?.deferredCovetousRelocation) {
            // rloc_to_core() repaints both endpoints before it emits the
            // arrival line.  That pline may first have to page an older hero
            // message; only after it resumes does dochug() run distfleeck and
            // the monster's contact attack.
            newsym(movement.oldx, movement.oldy);
            newsym(movement.x, movement.y);
            const relocationMessage = covetousRelocationMessage(
                monster, movement, actorWasSeen,
            );
            if (relocationMessage)
                await queueTurnMessage(relocationMessage);
            game._deferVisibleMonsterContact = true;
            try {
                resumeDeferredCovetousRelocation(action, game);
            } finally {
                game._deferVisibleMonsterContact = false;
            }
            movement = action.movement;
        }
        if (movement?.deferredPetMove) {
            if (movement.pickedUp && cansee(movement.oldx, movement.oldy)) {
                observeNearbyNamedObject(
                    movement.pickedUp, movement.oldx, movement.oldy,
                );
                await queueTurnMessage(
                    `${visibleMonsterSubject(monster)} picks up ${
                        petCarriedObjectName(movement.pickedUp)}.`,
                );
            }
            if (movement.dropped?.length
                && cansee(movement.oldx, movement.oldy)) {
                observeNearbyNamedObject(
                    movement.dropped[0], movement.oldx, movement.oldy,
                );
                await queueTurnMessage(
                    `${visibleMonsterSubject(monster)} drops ${
                        petCarriedObjectName(movement.dropped[0])}.`,
                );
            }
            // dog_invent() returns to the same dog_move() transaction after
            // its pickup/drop pline.  A following visible mattackm() must
            // remain deferred too: its hit line can fill tty's topline before
            // damage, death prose, and growth RNG are committed.
            game._deferVisibleMonsterContact = true;
            try {
                resumeDeferredPetMove(action, game);
            } finally {
                game._deferVisibleMonsterContact = false;
            }
            movement = action.movement;
        }
        if (movement?.deferredPetEating) {
            // dog_move() has committed the destination before dog_eat() emits
            // its line.  If an older combat topline is full, tty suspends here
            // before reward classification, consumption, postmov(), and the
            // trailing distfleeck().
            newsym(movement.oldx, movement.oldy);
            newsym(movement.x, movement.y);
            movement.petEatingRepainted = true;
            const sawEatingPet = cansee(movement.oldx, movement.oldy)
                && canProjectMonster(
                    monster, movement.oldx, movement.oldy,
                );
            const sawEatingFood = cansee(monster.mx, monster.my);
            const eatingSubject = sawEatingPet
                || (sawEatingFood && canProjectMonster(
                    monster, monster.mx, monster.my,
                ))
                ? visiblePetEatingSubject(monster)
                : sawEatingFood ? 'It' : null;
            if (eatingSubject) {
                let eatingMessage = null;
                if (movement.ateFood.otyp === 282) {
                    eatingMessage
                        = `${eatingSubject} eats an uncursed carrot.`;
                } else if (movement.ateFood.otyp === CORPSE) {
                    const corpseName = movement.ateFood.name
                        || `${MONSTER_NAME[movement.ateFood.corpsenm]
                            || 'monster'} corpse`;
                    eatingMessage
                        = `${eatingSubject} eats a ${corpseName}.`;
                } else if (movement.ateFood.otyp === 264
                    && monster.mnum === 16) {
                    eatingMessage
                        = `${eatingSubject} eats a tripe ration.`;
                }
                if (eatingMessage) await queueTurnMessage(eatingMessage);
            }
            resumeDeferredPetEating(action, game);
            movement = action.movement;
            // The pre-message repaint deliberately showed the object while
            // dog_eat() was suspended.  Consumption has now completed, so
            // postmov() must repaint the same destination from its new,
            // object-free state.
            delete movement.petEatingRepainted;
        }
        const monsterIsSeen = canProjectMonster(
            monster, monster.mx, monster.my,
        );
        // C postmov() repaints the old square before mintrap(), but delays
        // the destination newsym() until the trap's message has returned.
        // A pager on the prior topline must still show the floor object.
        const trapMonsterWasSeen = !!movement?.trap?.visible;
        const deferredTrapDestination = !!(movement?.moved
            && movement?.trap && (monsterIsSeen || trapMonsterWasSeen));
        const deferredHideUnderDestination = !!(movement?.moved
            && movement?.hideUnder?.seen);
        const deferredReluctantMove = !!(movement?.moved
            && movement?.reluctant && (actorWasSeen || monsterIsSeen));
        if ((movement?.moved || movement?.petPostmov)
            && !deferredReluctantMove
            && !movement.petEatingRepainted) {
            newsym(movement.oldx, movement.oldy);
            if (!deferredTrapDestination && !deferredHideUnderDestination)
                newsym(movement.x, movement.y);
            // C monmove.c:UnblockDoor() repaints the actor on the changed
            // door, rebuilds that visibility block point, and recalculates
            // sight before postmov() continues.  The JS vision owner rebuilds
            // row pointers as one transaction, so do it immediately rather
            // than leaving a closed-door cache until the next hero action.
            if (movement.openedDoor || movement.doorExplosion) {
                vision_reset();
                vision_recalc(0);
                // C monmove.c:postmov() reports the door only after
                // UnblockDoor has rebuilt sight.  This pline shares the
                // command's message row, so retain any pickup feedback.
                const seesDoor = didSeeOpenedDoor
                    || cansee(monster.mx, monster.my);
                const spotsDoorMonster = canProjectMonster(
                    monster, monster.mx, monster.my,
                );
                const message = movement.doorExplosion
                    ? seesDoor && spotsDoorMonster
                        ? 'KABOOM!!  You see a door explode.'
                        : game.deaf ? null
                            : `You hear a ${dist2(
                                monster.mx, monster.my,
                                game.u?.ux ?? monster.mx,
                                game.u?.uy ?? monster.my,
                            ) > 49 ? 'distant' : 'nearby'} explosion.`
                    : seesDoor && spotsDoorMonster
                        ? `The ${quietMonsterName(monster)} opens a door.`
                        : seesDoor
                            ? 'You see a door open.'
                            : game.deaf ? null : 'You hear a door open.';
                if (message) await queueTurnMessage(message);
                if (movement.deferredAfterDoorMessage) {
                    resumeDeferredMonsterDoor(action, game);
                    movement = action.movement;
                }
            }
        }
        if (deferredReluctantMove) {
            // C dog_move() commits occupancy and leaves the reluctance line
            // pending.  postmov() then reveals the old square; a subsequent
            // mintrap() message is what can force the reluctance line into a
            // tty --More-- before the destination is repainted.
            const message = reluctantPetMessage(monster, movement);
            const dismissal = await queueTurnMessage(message);
            newsym(movement.oldx, movement.oldy);
            // If the reluctance line itself did not have to page an older
            // topline, postmov() reaches mintrap() with the pet already
            // projectable at its destination.  A trap hit/miss pline can
            // then page the reluctance line while showing that live actor.
            if ((dismissal === null || dismissal === undefined)
                && movement.trap?.kind === 'projectile-trap') {
                newsym(movement.x, movement.y);
            }
        }
        if (movement?.trap?.kind === 'projectile-trap'
            && movement.trap.visible
            && movement.deferredAfterProjectileTrapMessage) {
            const event = movement.trap;
            const projectile = event.projectileType === DART
                ? 'dart' : 'arrow';
            const noun = event.pendingMissile?.opoisoned
                ? `poisoned ${projectile}` : projectile;
            const article = /^[aeiou]/i.test(noun) ? 'an' : 'a';
            await queueTurnMessage(
                `${visibleMonsterSubject(monster)} is ${
                    event.hit ? 'hit' : 'almost hit'
                } by ${article} ${noun}!`,
            );
            resumeDeferredMonsterProjectileTrap(action, game);
            movement = action.movement;
        }
        if (movement?.trapEscape?.escaped && monsterIsSeen)
            await queueTurnMessage(monsterTrapEscapeMessage(monster));
        if (movement?.trap?.kind === 'squeaky-board') {
            const message = monsterSqueakyBoardMessage(
                monster, movement.trap, monsterIsSeen,
            );
            if (message) await queueTurnMessage(message);
        }
        if (movement?.trap?.kind === 'sleep-gas'
            && movement.trap.slept && monsterIsSeen) {
            movement.trap.trap.tseen = true;
            await queueTurnMessage(
                `${visibleMonsterSubject(monster)} suddenly falls asleep!`,
            );
        }
        if (movement?.trap?.kind === 'pit-trap'
            && movement.trap.visible) {
            const event = movement.trap;
            event.trap.tseen = true;
            // trapeffect_pit() prints entry before thitm() resolves damage.
            // The scheduler has already completed the RNG/state transaction,
            // so temporarily reconstruct the entering actor for tty.
            const liveHp = monster.mhp;
            if (event.killed) monster.mhp = event.monsterHpBefore;
            newsym(movement.x, movement.y);
            monster.mhp = liveHp;
            const pitName = event.trap.ttyp === SPIKED_PIT
                ? 'a spiked pit' : 'a pit';
            await queueTurnMessage(
                `${visibleMonsterSubject(monster)} falls into ${pitName}!`,
            );
        }
        if (movement?.trap?.kind === 'rolling-boulder'
            && movement.trap.visible) {
            const event = movement.trap;
            // postmov() has already installed the moving actor on the trap
            // square when mintrap() begins.  Fatal ohitmon() damage changes
            // live HP before its plines, but tty retains that pre-death glyph
            // while an older trigger line owns --More--.  Reconstruct that
            // projection without reviving the actor in scheduler state.
            const liveHp = monster.mhp;
            if (event.killed) monster.mhp = event.monsterHpBefore;
            newsym(movement.x, movement.y);
            monster.mhp = liveHp;
            const trigger = game.deaf
                ? `${visibleMonsterSubject(monster)} triggers ${
                    event.wasSeen ? 'a rolling boulder trap' : 'something'
                }.`
                : `Click!  ${visibleMonsterSubject(monster)} triggers ${
                    event.wasSeen ? 'a rolling boulder trap' : 'something'
                }.`;
            await queueTurnMessage(trigger);
            if (event.released) {
                vision_note_blocker_change(
                    event.launch.x, event.launch.y,
                );
                newsym(event.launch.x, event.launch.y);
                const dx = Math.sign(event.endpoint.x - event.launch.x);
                const dy = Math.sign(event.endpoint.y - event.launch.y);
                const glyph = transientObjectGlyph(event.boulder);
                let flightX = event.launch.x;
                let flightY = event.launch.y;
                const preTargetSteps = Math.max(
                    Math.abs(movement.x - flightX),
                    Math.abs(movement.y - flightY),
                );
                event.transient = null;
                for (let step = 0; step < preTargetSteps; step++) {
                    event.transient = await animateRollingBoulderCell(
                        event.boulder, glyph,
                        flightX, flightY, event.transient,
                    );
                    flightX += dx;
                    flightY += dy;
                }
                event.flight = { x: flightX, y: flightY, dx, dy, glyph };
            }
            if (event.released && event.hit) {
                await queueTurnMessage(
                    `The boulder hits the ${quietMonsterName(monster)}!`,
                );
                if (event.killed) {
                    await queueTurnMessage(
                        `The ${quietMonsterName(monster)} is killed!`,
                    );
                }
            } else if (event.released) {
                await queueTurnMessage(
                    `The boulder misses the ${quietMonsterName(monster)}.`,
                );
            }
            if (event.released) {
                // ohitmon() finishes death/corpse work before launch_obj()
                // resumes its two-delay traversal from the target cell.
                resumeDeferredMonsterRollingBoulderDeath(action, game);
                movement = action.movement;
                const { dx, dy, glyph } = event.flight;
                let flightX = event.flight.x;
                let flightY = event.flight.y;
                const postTargetSteps = Math.max(
                    Math.abs(event.endpoint.x - flightX),
                    Math.abs(event.endpoint.y - flightY),
                );
                for (let step = 0; step < postTargetSteps; step++) {
                    event.transient = await animateRollingBoulderCell(
                        event.boulder, glyph,
                        flightX, flightY, event.transient,
                    );
                    flightX += dx;
                    flightY += dy;
                }
                finishDeferredMonsterRollingBoulderPlacement(action, game);
                movement = action.movement;
                if (event.transient)
                    newsym(event.transient.x, event.transient.y);
                newsym(event.endpoint.x, event.endpoint.y);
            }
        }
        if (movement?.trap?.kind === 'magic-portal-migration'
            && movement.trap.visible) {
            movement.trap.trap.tseen = true;
            await queueTurnMessage(
                `Suddenly, the ${quietMonsterName(
                    monster,
                )} disappears out of sight.`,
            );
        }
        if (movement?.trap?.kind === 'level-fall-migration'
            && movement.trap.visible) {
            movement.trap.trap.tseen = true;
            const fall = movement.trap.trap.ttyp === HOLE
                ? 'falls into a hole' : 'falls through a trap door';
            await queueTurnMessage(
                `Suddenly, the ${quietMonsterName(monster)} ${fall}.`,
            );
        }
        if (movement?.trap?.kind === 'bear-trap' && monsterIsSeen) {
            await queueTurnMessage(monsterBearTrapMessage(monster));
            if (movement.trap.deferredDamage) {
                resumeDeferredMonsterBearTrap(action, game);
                movement = action.movement;
            }
        }
        if (movement?.trap?.kind === 'web-trap' && monsterIsSeen) {
            await presentMonsterWebTrap({
                event: movement.trap,
                monster,
                visible: true,
                subject: actor => `The ${quietMonsterName(actor)}`,
                announce: queueTurnMessage,
            });
        }
        if (deferredTrapDestination) newsym(movement.x, movement.y);
        if (movement?.tunnelProbe?.crashingRockAudible && !game.deaf)
            await queueTurnMessage('You hear crashing rock.');
        if (deferredReluctantMove)
            newsym(movement.x, movement.y);
        if (movement?.hideUnder) {
            const concealment = movement.hideUnder;
            if (concealment.seen) {
                // postmov() painted the arriving actor before hideunder()
                // changed mundetected.  Reconstruct that pre-concealment
                // projection while an older topline can still suspend pline.
                const hiddenState = monster.mundetected;
                monster.mundetected = concealment.oldUndetected ? 1 : 0;
                newsym(monster.mx, monster.my);
                monster.mundetected = hiddenState;
                const hidingPlace = concealment.under
                    || simpleHideUnderObjectName(concealment.object);
                await queueTurnMessage(
                    `You see the ${quietMonsterName(monster)} ${
                        concealment.verb
                    } under ${hidingPlace}.`,
                );
            }
            // hideunder() emits its line before repainting mundetected state.
            // If an older topline paged above, that screen retains the actor
            // glyph; the resumed source stack reveals the object only now.
            newsym(monster.mx, monster.my);
            // hideunder() returns to postmov()/dochug() only after its pline
            // has crossed the tty boundary.  Complete the same actor now so
            // the trailing distfleeck and phase-four attacks keep ownership.
            resumeDeferredMonsterHideUnder(action, game);
            movement = action.movement;
        }
        if (movement?.wieldedWeapon && monsterIsSeen) {
            // C mon_wield_item() names a weapon carried by a monster whose
            // square is visible.  That visible inventory observation owns
            // dknown before distant_name(..., doname) formats the line.
            observeNearbyNamedObject(
                movement.wieldedWeapon, monster.mx, monster.my,
            );
            await queueTurnMessage(
                `${visibleMonsterSubject(monster)} wields ${
                    distantMonsterObjectName(movement.wieldedWeapon)}!`,
            );
            if (movement.wieldedWeapon.cursed) {
                const subject = visibleMonsterSubject(monster);
                const lowerSubject = `${subject[0].toLowerCase()}${
                    subject.slice(1)
                }`;
                const possessive = /s$/iu.test(lowerSubject)
                    ? `${lowerSubject}'` : `${lowerSubject}'s`;
                const weaponName = OBJECT_NAMES[
                    movement.wieldedWeapon.otyp
                ] || movement.wieldedWeapon.name || 'weapon';
                await queueTurnMessage(
                    `The ${weaponName} welds itself to ${possessive} hand!`,
                );
            }
            if (game._activeSpecialLevel?.prototype === 'oracle'
                && monster.mnum === 277
                && (game.u?.hallucinating
                    || (game.u?.hallucinationTurns ?? 0) > 0)) {
                game._boundedOracleHalluPostWieldDisplayDebt = 1;
            }
            if (movement.deferredHeroWield) {
                game._deferVisibleMonsterContact = true;
                try {
                    resumeDeferredHeroAttackAfterWield(action, game);
                } finally {
                    game._deferVisibleMonsterContact = false;
                }
            }
        }
        if (movement?.offensiveWand?.kind
            === 'offensive-wand-magic-missile') {
            const offensive = movement.offensiveWand;
            let offensiveLineDismissal;
            if (actorWasSeen || monsterIsSeen) {
                offensive.object.dknown = true;
                recordObjectEncounter(offensive.object.otyp);
                offensiveLineDismissal = await queueTurnMessage(
                    `${visibleMonsterSubject(monster)} zaps ${
                        distantMonsterObjectName(offensive.object)
                    }!`,
                );
            } else if (!game.deaf) {
                const range = couldsee(monster.mx, monster.my)
                    ? BOLT_LIM + 1 : BOLT_LIM - 3;
                const proximity = dist2(
                    monster.mx, monster.my,
                    game.u?.ux ?? monster.mx,
                    game.u?.uy ?? monster.my,
                ) <= range * range ? 'nearby' : 'distant';
                offensiveLineDismissal = await queueTurnMessage(
                    `You hear a ${proximity} zap.`,
                );
                offensive.object.dknown = false;
            }
            if (offensiveLineDismissal !== null
                && offensiveLineDismissal !== undefined) {
                earlierActorPagerInScan = true;
            }

            if (game._occupation)
                game._interruptedMultiActionDebt = true;
            game._occupation = null;
            game._cannedCommands = [];
            if (game._runState) stopRun(game);

            if ((actorWasSeen || monsterIsSeen)
                && !game._knownObjectTypes?.has(offensive.object.otyp)) {
                exerciseAttribute(2, true);
                recordObjectKnowledge(offensive.object.otyp);
            }
            resumeDeferredMonsterMagicMissileWand(action, game);
            await resolveMonsterMagicMissileBeam(action);
            monster.mwandexp = true;
            earlierActorMessageInScan = true;
            movement = action.movement;
        }
        if (movement?.offensiveWand?.kind === 'offensive-wand-striking') {
            const offensive = movement.offensiveWand;
            let offensiveLineDismissal;
            if (actorWasSeen || monsterIsSeen) {
                offensive.object.dknown = true;
                recordObjectEncounter(offensive.object.otyp);
                offensiveLineDismissal = await queueTurnMessage(
                    `${visibleMonsterSubject(monster)} zaps ${
                        distantMonsterObjectName(offensive.object)
                    }!`,
                );
            } else if (!game.deaf) {
                const range = couldsee(monster.mx, monster.my)
                    ? BOLT_LIM + 1 : BOLT_LIM - 3;
                const proximity = dist2(
                    monster.mx, monster.my,
                    game.u?.ux ?? monster.mx,
                    game.u?.uy ?? monster.my,
                ) <= range * range ? 'nearby' : 'distant';
                offensiveLineDismissal = await queueTurnMessage(
                    `You hear a ${proximity} zap.`,
                );
                offensive.object.dknown = false;
            }
            if (offensiveLineDismissal !== null
                && offensiveLineDismissal !== undefined) {
                earlierActorPagerInScan = true;
            }

            // mzapwand() stops occupations and spends the charge only after
            // its zap line has returned from tty.
            if (game._occupation)
                game._interruptedMultiActionDebt = true;
            game._occupation = null;
            game._cannedCommands = [];
            if (game._runState) stopRun(game);

            const effect = resumeDeferredMonsterStrikingWand(action, game);
            if (effect?.message === 'Boing!')
                await shieldeff(game.u.ux, game.u.uy);
            if (effect?.message) {
                const effectDismissal = await queueTurnMessage(effect.message);
                if (effectDismissal !== null
                    && effectDismissal !== undefined) {
                    earlierActorPagerInScan = true;
                }
            }
            if (effect?.deferredHitDamage) {
                finishDeferredMonsterStrikingWandHit(action, game);
                if (effect.fatal) {
                    // mbhitm() has installed the hit line, then losehp() has
                    // committed HP zero.  urgent_pline("You die...") first
                    // forces that current line through tty; invalid More
                    // keys must not advance bones, settlement, or disclosure.
                    game._statusHpOverride = effect.preHitHp;
                    try {
                        await waitForCurrentMonsterMore();
                    } finally {
                        delete game._statusHpOverride;
                    }
                    game.u.umortality = (game.u.umortality || 0) + 1;
                    if (!game.flags?.debug && !game.flags?.explore)
                        game._canMakeBones = probeCanMakeBones();

                    // really_done() calls paybill() before it forces the
                    // message window.  Preserve that shared ordering so a
                    // resident's inheritance line joins the fatal topline.
                    await queueTurnMessage('You die...');
                    const settlement = settleShopkeepersAfterDeath(game);
                    if (settlement.message)
                        await queueTurnMessage(settlement.message);
                    await waitForCurrentMonsterMore('You die...');
                    await finishOrdinaryDeath({ killer: 'wand' });
                    game.context.move = 0;
                    break;
                }
            }
            if (effect?.identifiesType
                && !game._knownObjectTypes?.has(effect.object.otyp)) {
                exerciseAttribute(2, true);
                recordObjectKnowledge(effect.object.otyp);
            }
            monster.mwandexp = true;
            earlierActorMessageInScan = true;
            movement = action.movement;
        }
        if (movement?.attack?.kind === 'hero-attack') {
            let heroDied = false;
            let heroAttack = movement.attack;
                let previousHeroAttack = null;
                let actorContactPagerOwned = false;
                let actorContactMessageAfterPager = false;
                while (heroAttack) {
                    if (heroAttack.kind === 'hero-spell') {
                        if (!heroAttack.cast) {
                            let curseMessage = null;
                            if (heroAttack.fumbled && !game.deaf
                                && canProjectMonster(
                                    monster, monster.mx, monster.my,
                                )) {
                                curseMessage = `The air crackles around the ${
                                    quietMonsterName(monster)
                                }.`;
                            } else if (heroAttack.curseKind === 'audible') {
                                curseMessage = 'You hear a mumbled curse.';
                            } else if (heroAttack.curseKind) {
                                const caster = visibleMonsterSubject(monster);
                                curseMessage = heroAttack.curseKind
                                    === 'visible-undirected'
                                    ? `${caster} points all around, then curses.`
                                    : `${caster} points at you, then curses.`;
                            }
                            const repeatedAudibleCurse
                                = heroAttack.curseKind === 'audible'
                                && (game._pending_message || '')
                                    .endsWith(curseMessage);
                            if (curseMessage && !repeatedAudibleCurse)
                                await queueTurnMessage(curseMessage);
                            previousHeroAttack = heroAttack;
                            heroAttack = continueDeferredHeroAttack(
                                action, game,
                            );
                            continue;
                        }
                        const caster = canProjectMonster(
                            monster, monster.mx, monster.my,
                        ) ? visibleMonsterSubject(monster) : 'Something';
                        const casterVisible = canProjectMonster(
                            monster, monster.mx, monster.my,
                        );
                        if (casterVisible || heroAttack.directed) {
                            await queueTurnMessage(
                                `${caster} casts a spell${
                                    heroAttack.directed ? ' at you' : ''
                                }!`,
                            );
                        }
                        if (heroAttack.deferredSpellDamage)
                            rollDeferredHeroSpellDamage(action, game);
                        let effectMessage = heroAttack.spellEffectMessage;
                        if (heroAttack.spell === 'cure-self'
                            && canProjectMonster(
                                monster, monster.mx, monster.my,
                            )) {
                            effectMessage = `${
                                visibleMonsterSubject(monster)
                            } looks better.`;
                        }
                        if (heroAttack.spell === 'death-touch') {
                            let pronoun;
                            if (game.u?.hallucinating
                                || (game.u?.hallucinationTurns ?? 0) > 0) {
                                const gender = rn2(4);
                                action.calls.push('rn2(4)');
                                pronoun = ['he', 'she', 'it', 'they'][gender];
                            } else {
                                pronoun = monster.female ? 'she'
                                    : monster.genderless ? 'it' : 'he';
                            }
                            effectMessage = 'Oh no, ' + pronoun
                                + "'s using the touch of death!";
                        }
                        if (heroAttack.spell === 'disappear'
                            && canProjectMonster(
                                monster, monster.mx, monster.my,
                            )) {
                            const seesInvisible = !!(game.u?.seeInvisible
                                || game.u?.see_invisible
                                || (game.u?.seeInvisibleTurns ?? 0) > 0);
                            effectMessage = `${
                                visibleMonsterSubject(monster)
                            } suddenly ${
                                seesInvisible
                                    ? 'becomes transparent' : 'disappears'
                            }!`;
                        }
                        // mcast_confuse_you() commits make_confused() before
                        // its explicit feedback pline.  If that line forces
                        // the older cast line through tty, the pager already
                        // paints Conf; other selected spell effects retain
                        // their post-message state ordering.
                        if (heroAttack.spell === 'confuse-you')
                            resumeDeferredHeroSpell(action, game);
                        const effectDismissal = effectMessage
                            ? await queueTurnMessage(effectMessage)
                            : null;
                        if (heroAttack.deferredSpellEffect)
                            resumeDeferredHeroSpell(action, game);
                        if (heroAttack.deferredFirePillar)
                            await resolveDeferredHeroFirePillar(
                                action, heroAttack,
                            );
                        if (heroAttack.deferredLightningSpell)
                            await resolveDeferredHeroLightningSpell(
                                action, heroAttack,
                            );
                        if (heroAttack.deferredInsectSpell)
                            await resolveDeferredHeroInsectSpell(
                                action, heroAttack,
                            );
                        if (heroAttack.deferredCurseItems)
                            await resolveDeferredHeroCurseItems(
                                action, heroAttack,
                            );
                        if (heroAttack.deferredSummonMonsters) {
                            const summoned
                                = await resolveDeferredHeroSummonMonsters(
                                    action, game,
                                );
                            if (summoned?.message)
                                await queueTurnMessage(summoned.message);
                        }
                        if (heroAttack.deferredCloneWizard) {
                            await queueTurnMessage('Double Trouble...');
                            const clone
                                = await beginDeferredHeroCloneWizard(
                                    action, game,
                                );
                            if (clone?.message)
                                await queueTurnMessage(clone.message);
                            finishDeferredHeroCloneWizard(action, game);
                        }
                        if (heroAttack.deferredHasteSelf) {
                            const haste = resolveDeferredHeroHasteSelf(
                                action, game,
                            );
                            if (haste?.message)
                                await queueTurnMessage(haste.message);
                        }
                        if (heroAttack.deferredAggravation)
                            resolveDeferredHeroAggravation(action, game);
                        if (heroAttack.deferredDeathTouch)
                            await resolveDeferredHeroDeathTouch(
                                action, heroAttack,
                            );
                        if (heroAttack.deferredDestroyArmor)
                            await resolveDeferredHeroDestroyArmor(
                                action, heroAttack,
                            );
                        if (heroAttack.deferredGeyserSpell)
                            resolveDeferredHeroGeyser(action, heroAttack);
                        if (heroAttack.paralyzed) stopRun(game);
                        if (heroAttack.toggledBlindness)
                            vision_recalc(0);
                        if (heroAttack.monsterDisappeared) {
                            newsym(monster.mx, monster.my);
                            if (cansee(monster.mx, monster.my)
                                && !canProjectMonster(
                                    monster, monster.mx, monster.my,
                                )) {
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
                            const rehumanized = rehumanizeHero(game);
                            if (rehumanized.regainedSight)
                                vision_recalc(0);
                            const returnMessage
                                = `You return to ${rehumanized.race} form!${
                                    rehumanized.regainedSight
                                        ? '  You can see again.' : ''
                                }`;
                            await waitForMonsterMore(returnMessage);
                            if (rehumanized.encumbranceMessage) {
                                // rehumanize() calls encumber_msg() after
                                // polyman()'s urgent pager.  That follow-up
                                // is not an ordinary actor message and still
                                // becomes the new topline after ESC.
                                await plineWithContinuation(
                                    rehumanized.encumbranceMessage,
                                );
                            }
                            heroAttack = null;
                            break;
                        }
                        previousHeroAttack = heroAttack;
                        heroAttack = continueDeferredHeroAttack(action, game);
                        continue;
                    }
                if (heroAttack.deferredWeaponSwing) {
                    const swingVisible = game.flags?.verbose !== false
                        && !game.blind
                        && canProjectMonster(
                            monster, monster.mx, monster.my,
                        );
                    if (swingVisible) {
                        observeNearbyNamedObject(
                            heroAttack.weapon, monster.mx, monster.my,
                        );
                        const weaponName = distantMonsterObjectName(
                            heroAttack.weapon,
                        ).replace(/^(?:an?|the) /, '');
                        const verb = /dagger|spear|lance|trident|stiletto/i
                            .test(weaponName) ? 'thrusts' : 'swings';
                        await queueTurnMessage(
                            `${visibleMonsterSubject(monster)} ${verb} ${
                                monster.female ? 'her' : 'his'
                            } ${weaponName}.`,
                        );
                    }
                    heroAttack = resumeDeferredHeroWeaponSwing(action, game);
                    movement.attack = heroAttack;
                }
                if (heroAttack.deferredEngulf) {
                        // gulpmu() remove_monster() leaves the old tty glyph
                        // intact while urgent_pline() waits.  Only the new
                        // shared hero/attacker square is repainted before the
                        // pager; swallowed(1) clears the stale old glyph.
                        newsym(game.u.ux, game.u.uy);
                    }
                if (heroAttack.deferredRevealUnder) {
                    const revealDismissal = await queueTurnMessage(
                        heroAttack.revealUnderMessage,
                    );
                    newsym(monster.mx, monster.my);
                    if (revealDismissal !== null
                        && revealDismissal !== undefined) {
                        actorContactPagerOwned = true;
                    }
                    heroAttack = resumeDeferredHeroReveal(action, game);
                    movement.attack = heroAttack;
                }
                // Hero-command and actor-prose history do not themselves
                // decide whether tty has repainted status.  The fatal path
                // below follows C bot()'s raw-HP sentinel and concrete pager
                // boundaries instead.
                // C hitmu()/missmu() records an unseen attacker's square
                // before projecting its contact line.  Persist that marker
                // in hero memory so a pager or later blind docrt() cannot
                // erase the source of the attack.
                if (heroAttack.effect !== 'displaced-wild-miss'
                    && !canProjectMonster(monster, monster.mx, monster.my))
                    map_invisible(monster.mx, monster.my);
                const message = monsterAttackMessage(
                    monster, heroAttack, previousHeroAttack,
                );
                // gulpmu() uses urgent_pline() followed by an explicit
                // message-window flush before it establishes swallowed
                // state.  That initial engulf line always owns a pager even
                // when it would fit on the current tty topline.
                const contactDismissal = heroAttack.deferredEngulf
                    ? await waitForMonsterMore(message)
                    : message ? await queueTurnMessage(message) : undefined;
                if (message) earlierActorMessageInScan = true;
                if (contactDismissal !== null
                    && contactDismissal !== undefined) {
                    actorContactPagerOwned = true;
                }
                const activeHpKey = Upolyd(game.u) ? 'mh' : 'uhp';
                const hpBeforeDeferredHit = game.u?.[activeHpKey] ?? 1;
                if (heroAttack.deferredStickingAfterHit)
                    resumeDeferredHeroSticking(action, game);
                if (heroAttack.stickingMessage) {
                    const stickingDismissal = await queueTurnMessage(
                        heroAttack.stickingMessage,
                    );
                    heroAttack.stickingMessage = null;
                    if (stickingDismissal !== null
                        && stickingDismissal !== undefined) {
                        actorContactPagerOwned = true;
                    }
                }
                if (heroAttack.deferredItemTheft) {
                    const theftPager = await resolveDeferredHeroItemTheft(
                        action, monster, heroAttack,
                    );
                    actorContactPagerOwned ||= theftPager;
                }
                if (heroAttack.deferredEngulf) {
                    const engulf = resumeDeferredHeroEngulf(action, game);
                    if (engulf?.message) {
                        const engulfDismissal = await queueTurnMessage(
                            engulf.message,
                        );
                        if (engulfDismissal !== null
                            && engulfDismissal !== undefined) {
                            actorContactPagerOwned = true;
                        }
                    }
                }
                if (heroAttack.deferredColdNegation)
                    resumeDeferredHeroColdSpecial(action, game);
                if (heroAttack.coldEffectMessage) {
                    const coldDismissal = await queueTurnMessage(
                        heroAttack.coldEffectMessage,
                    );
                    heroAttack.coldEffectMessage = null;
                    if (coldDismissal !== null
                        && coldDismissal !== undefined) {
                        actorContactPagerOwned = true;
                    }
                }
                if (heroAttack.deferredFireNegation)
                    resumeDeferredHeroFireSpecial(action, game);
                if (heroAttack.fireEffectMessage) {
                    const fireDismissal = await queueTurnMessage(
                        heroAttack.fireEffectMessage,
                    );
                    heroAttack.fireEffectMessage = null;
                    if (fireDismissal !== null
                        && fireDismissal !== undefined) {
                        actorContactPagerOwned = true;
                    }
                }
                if (heroAttack.fireResistanceMessage) {
                    const resistanceDismissal = await queueTurnMessage(
                        heroAttack.fireResistanceMessage,
                    );
                    heroAttack.fireResistanceMessage = null;
                    if (resistanceDismissal !== null
                        && resistanceDismissal !== undefined) {
                        actorContactPagerOwned = true;
                    }
                }
                if (heroAttack.deferredElectricNegation)
                    resumeDeferredHeroElectricSpecial(action, game);
                if (heroAttack.electricEffectMessage) {
                    const electricDismissal = await queueTurnMessage(
                        heroAttack.electricEffectMessage,
                    );
                    heroAttack.electricEffectMessage = null;
                    if (electricDismissal !== null
                        && electricDismissal !== undefined) {
                        actorContactPagerOwned = true;
                    }
                }
                if (heroAttack.deferredLifeDrainGate)
                    resumeDeferredHeroLifeDrain(action, game);
                if (heroAttack.lifeDrainMessage) {
                    const lifeDrainDismissal = await queueTurnMessage(
                        heroAttack.lifeDrainMessage,
                    );
                    heroAttack.lifeDrainMessage = null;
                    if (lifeDrainDismissal !== null
                        && lifeDrainDismissal !== undefined) {
                        actorContactPagerOwned = true;
                    }
                }
                if (heroAttack.deferredStunGate)
                    resumeDeferredHeroStun(action, game);
                if (heroAttack.stunMessage) {
                    const stunDismissal = await queueTurnMessage(
                        heroAttack.stunMessage,
                    );
                    heroAttack.stunMessage = null;
                    if (stunDismissal !== null
                        && stunDismissal !== undefined) {
                        actorContactPagerOwned = true;
                    }
                }
                if (heroAttack.deferredRustRehumanize) {
                    const rustFormPagerOwned
                        = await resolveErosionFormRehumanization(
                            heroAttack, 'You rust!',
                        );
                    actorContactPagerOwned ||= rustFormPagerOwned;
                    heroAttack.deferredRustRehumanize = false;
                }
                while (heroAttack.deferredRustArmor) {
                    const rustArmor = resumeDeferredHeroRustArmor(action, game);
                    if (rustArmor?.message) {
                        const rustDismissal = await queueTurnMessage(
                            rustArmor.message,
                        );
                        if (rustDismissal !== null
                            && rustDismissal !== undefined) {
                            actorContactPagerOwned = true;
                        }
                    }
                    const rustFinal = finishDeferredHeroRustArmor(action, game);
                    if (rustFinal?.message) {
                        const dissolveDismissal = await queueTurnMessage(
                            rustFinal.message,
                        );
                        if (dissolveDismissal !== null
                            && dissolveDismissal !== undefined) {
                            actorContactPagerOwned = true;
                        }
                    }
                }
                while (heroAttack.deferredCorrosionArmor) {
                    const corrosionArmor = resumeDeferredHeroCorrosionArmor(
                        action, game,
                    );
                    if (corrosionArmor?.message) {
                        const corrosionDismissal = await queueTurnMessage(
                            corrosionArmor.message,
                        );
                        if (corrosionDismissal !== null
                            && corrosionDismissal !== undefined) {
                            actorContactPagerOwned = true;
                            // The dismissal can belong to the older hitmsg,
                            // with this armor line installed afterward.  If
                            // death later forces the newer line through tty,
                            // its status must show committed HP rather than
                            // inherit the pre-hit bridge from the old pager.
                            actorContactMessageAfterPager
                                = game._pending_message
                                    === corrosionArmor.message;
                        }
                    }
                    const corrosionFinal = finishDeferredHeroCorrosionArmor(
                        action, game,
                    );
                    if (corrosionFinal?.message) {
                        const dissolveDismissal = await queueTurnMessage(
                            corrosionFinal.message,
                        );
                        if (dissolveDismissal !== null
                            && dissolveDismissal !== undefined) {
                            actorContactPagerOwned = true;
                        }
                    }
                }
                if (heroAttack.deferredDecayRehumanize) {
                    const decayFormPagerOwned
                        = await resolveErosionFormRehumanization(
                            heroAttack, 'You rot!',
                        );
                    actorContactPagerOwned ||= decayFormPagerOwned;
                    heroAttack.deferredDecayRehumanize = false;
                }
                while (heroAttack.deferredDecayArmor) {
                    const decayArmor = resumeDeferredHeroDecayArmor(
                        action, game,
                    );
                    if (decayArmor?.message) {
                        const decayDismissal = await queueTurnMessage(
                            decayArmor.message,
                        );
                        if (decayDismissal !== null
                            && decayDismissal !== undefined) {
                            actorContactPagerOwned = true;
                        }
                    }
                    const decayFinal = finishDeferredHeroDecayArmor(
                        action, game,
                    );
                    if (decayFinal?.message) {
                        const decayFinalDismissal = await queueTurnMessage(
                            decayFinal.message,
                        );
                        if (decayFinalDismissal !== null
                            && decayFinalDismissal !== undefined) {
                            actorContactPagerOwned = true;
                        }
                    }
                }
                if (heroAttack.drainMessage) {
                    const drainDismissal = await queueTurnMessage(
                        heroAttack.drainMessage,
                    );
                    heroAttack.drainMessage = null;
                    if (drainDismissal !== null
                        && drainDismissal !== undefined) {
                        actorContactPagerOwned = true;
                    }
                    findArmorClass(game);
                }
                if (heroAttack.deferredLegEffect)
                    resumeDeferredHeroLegs(action, game);
                if (heroAttack.deferredPostHit) {
                    resumeDeferredHeroContact(action, game);
                    if (heroAttack.electricInventoryMessage) {
                        const electricItemDismissal = await queueTurnMessage(
                            heroAttack.electricInventoryMessage,
                        );
                        heroAttack.electricInventoryMessage = null;
                        heroAttack.electricInventoryMessagePending = false;
                        if (electricItemDismissal !== null
                            && electricItemDismissal !== undefined) {
                            actorContactPagerOwned = true;
                        }
                        resumeDeferredHeroContact(action, game);
                    }
                    if (heroAttack.deferredPoisonEffect) {
                        const poisonPagerOwned
                            = await resolveDeferredHeroPoison(
                                action, monster, heroAttack,
                            );
                        actorContactPagerOwned ||= poisonPagerOwned;
                        heroAttack.deferredPoisonEffect = false;
                        resumeDeferredHeroContact(action, game);
                    }
                }
                if (heroAttack.contactRehumanized?.changed) {
                    const rehumanized = heroAttack.contactRehumanized;
                    if (rehumanized.regainedSight) vision_recalc(0);
                    let returnMessage
                        = `You return to ${rehumanized.race} form!`;
                    if (rehumanized.regainedSight)
                        returnMessage += '  You can see again.';
                    const returnDismissal = await queueTurnMessage(
                        returnMessage,
                    );
                    if (returnDismissal !== null
                        && returnDismissal !== undefined) {
                        actorContactPagerOwned = true;
                    }
                    if (rehumanized.encumbranceMessage) {
                        await queueTurnMessage(
                            rehumanized.encumbranceMessage,
                        );
                    }
                    heroAttack.contactRehumanized = null;
                }
                if (heroAttack.deferredBlindEffect) {
                    const toggledBlindness = resumeDeferredHeroBlindness(
                        action, game,
                    );
                    if (toggledBlindness) vision_recalc(0);
                }
                if (heroAttack.deferredStoningEffect) {
                    resumeDeferredHeroStoning(action, game);
                    if (heroAttack.stoningSpecialMessage) {
                        const stoningDismissal = await queueTurnMessage(
                            heroAttack.stoningSpecialMessage,
                        );
                        heroAttack.stoningSpecialMessage = null;
                        if (stoningDismissal !== null
                            && stoningDismissal !== undefined) {
                            actorContactPagerOwned = true;
                        }
                    }
                }
                if (heroAttack.passive?.messageKind) {
                    const passiveDismissal = await queueTurnMessage(
                        heroPassiveResponseMessage(monster, heroAttack.passive),
                    );
                    heroAttack.passive.messageKind = null;
                    resumeDeferredHeroPassive(action, game);
                    if (heroAttack.passive?.attackerDied) {
                        const passiveDeathName = () => game.u?.hallucinating
                            || (game.u?.hallucinationTurns ?? 0) > 0
                            ? randomDisplayMonsterName()
                            : MONSTER_NAME[monster?.mnum] || 'monster';
                        const deathSubject = canProjectMonster(
                            monster, monster.mx, monster.my,
                        ) ? `The ${passiveDeathName()}` : 'It';
                        await queueTurnMessage(`${deathSubject} dies!`);
                        await finishHeroMonsterKill(
                            monster, monster.mx, monster.my, {
                                nameMonster: passiveDeathName,
                                showKillMessage: false,
                            },
                        );
                    }
                    if (passiveDismissal !== null
                        && passiveDismissal !== undefined) {
                        actorContactPagerOwned = true;
                    }
                }
                if (heroAttack.effectMessage) {
                    const effectDismissal = await queueTurnMessage(
                        heroAttack.effectMessage,
                    );
                    if (effectDismissal !== null
                        && effectDismissal !== undefined) {
                        actorContactPagerOwned = true;
                    }
                }
                if (heroAttack.deferredExpulsion) {
                    const expelDismissal = await queueTurnMessage(
                        'You get expelled!',
                    );
                    if (expelDismissal !== null
                        && expelDismissal !== undefined) {
                        actorContactPagerOwned = true;
                    }
                    // expels()->unstuck() clears swallowed state before its
                    // docrt() flushes WIN_MESSAGE.  That flush is the exact
                    // tty suspension point; mnexto() must remain after it.
                    beginDeferredHeroExpulsion(action, game);
                    const redrawDismissal = await waitForCurrentMonsterMore();
                    if (redrawDismissal !== null
                        && redrawDismissal !== undefined) {
                        actorContactPagerOwned = true;
                    }
                    vision_reset();
                    vision_recalc(0);
                    await docrt();
                    const relocation = finishDeferredHeroExpulsion(
                        action, game,
                    );
                    if (relocation) {
                        newsym(relocation.oldx, relocation.oldy);
                        newsym(relocation.x, relocation.y);
                    }
                }
                // C hitmu()/missmu() calls stop_occupation() after the whole
                // contact transaction, including passiveum().  In
                // particular, an overflowing cold-passive line must suspend
                // before its rn2(2), assess_dmg(), death line, and the
                // occupation-stop prose.  Keep this before later attack
                // slots, but after every deferred tail owned by this slot.
                if (!previousHeroAttack && game._occupation?.key === '.') {
                    const stopped = game._occupation.text
                        || 'waiting';
                    game._occupation = null;
                    await queueTurnMessage(`You stop ${stopped}.`);
                }
                if ((game.u?.[Upolyd(game.u) ? 'mh' : 'uhp'] ?? 1) > 0) {
                    previousHeroAttack = heroAttack;
                    heroAttack = continueDeferredHeroAttack(action, game);
                    continue;
                }
                // C has already committed the fatal hit before tty suspends
                // on its contact line.  Preserve pre-hit status only when a
                // pline in this actor transaction actually crossed a tty
                // pager, or an incomplete silent prefix retained the old
                // topline.  Merely having a pending contact line is not
                // sufficient: it can reach the next input boundary without
                // a pager, at which point committed HP is already visible.
                const projectedFatalContact = !!game._pending_message
                    && !game._suppressMessagesUntilInput;
                const appliedContactDamage = heroAttack.appliedDamage
                    ?? heroAttack.damage ?? 0;
                // C's status engine commits an exact transition to zero
                // before tty suspends on the contact line.  Negative
                // overkill can retain the previously painted HP row through
                // that pager; exact-zero damage cannot.
                const exactZeroFatalHit
                    = appliedContactDamage === hpBeforeDeferredHit;
                // bot.c:bot() suppresses status output when raw uhp is -1;
                // NetHack reserves that value as the save-completion
                // sentinel.  Fatal damage is still raw here, before done()
                // normalizes it to zero.  A result below -1 is rendered as
                // HP zero by the pline() flush before the death pager.
                const rawFatalHpAfterContact
                    = hpBeforeDeferredHit - appliedContactDamage;
                const statusSuppressedByHpSaveSentinel
                    = !Upolyd(game.u) && rawFatalHpAfterContact === -1;
                if (projectedFatalContact
                    && !exactZeroFatalHit
                    && rawFatalHpAfterContact >= -1
                    && (statusSuppressedByHpSaveSentinel
                        || earlierActorPagerInScan
                        || (actorContactPagerOwned
                            && !actorContactMessageAfterPager))) {
                    game._statusHpOverride = hpBeforeDeferredHit;
                }
                // A monster-only fatal contact can make done_in_by() suspend
                // while trying to install "You die".  Every ordinary actor
                // line already accumulated on that same topline is part of
                // the backpressure transaction; an earlier actor message is
                // not itself a status repaint.  The old row therefore also
                // survives the immediately following death window unless a
                // concrete later owner (for example paybill()) repaints it.
                const retainStatusThroughDeathWindow
                    = game._statusHpOverride !== undefined
                    && statusSuppressedByHpSaveSentinel;
                if (projectedFatalContact) {
                    // hitmu() has already installed the contact topline.
                    // display_nhwindow(WIN_MESSAGE, TRUE) forces that current
                    // line once; it does not submit the same prose through
                    // update_topl() a second time.
                    await waitForCurrentMonsterMore();
                }
                // Most contact owners return to done()'s forced bot()
                // update here.  The narrow fatal-line-backpressure branch
                // above has not physically repainted status yet.
                if (!retainStatusThroughDeathWindow)
                    delete game._statusHpOverride;
                const lifeSaving = beginHeroLifeSaving();
                if (lifeSaving) {
                    // done() normalizes HP before it emits the life-saving
                    // branch; unlike a plain debug-death pager, that combined
                    // line always projects committed zero.
                    delete game._statusHpOverride;
                    // done_in_by() writes the fatal line before done(); the
                    // latter appends both life-saving lines until the next
                    // message would overflow tty's top line.  Identification
                    // (and its Wisdom exercise draw) precedes that pager.
                    const dismissal = await waitForMonsterMore(
                        'You die...  But wait...  Your medallion begins to glow!',
                    );
                    delete game._statusHpOverride;
                    completeHeroLifeSaving(lifeSaving);
                    await pline('You feel much better!');
                    // ESC at tty --More-- sets WIN_STOP: the new overflow
                    // message is still installed, but later messages in this
                    // input transaction (starting with the crumble line) are
                    // suppressed.  Other dismissal keys retain the source
                    // follow-up.
                    if (dismissal !== 27) {
                        await plineWithContinuation(
                            'The medallion crumbles to dust!',
                        );
                    } else {
                        game._suppressMessagesUntilInput = true;
                    }
                    heroAttack = null;
                    break;
                }
                // C end.c:done() records every fatal event before it tests
                // LifeSaved or offers the debug/explore "Die?" escape.  The
                // amulet branch records that transaction in
                // beginHeroLifeSaving(); plain debug deaths reach this path
                // instead and must commit the same mortality counter here.
                game.u.umortality = (game.u.umortality || 0) + 1;
                if (!game.flags?.debug && !game.flags?.explore)
                    game._canMakeBones = probeCanMakeBones();
                if (game._suppressMessagesUntilInput) {
                    // tty update_topl() treats "You die" specially: it
                    // replaces the logically stopped topline and clears
                    // WIN_STOP rather than appending to the pline which
                    // triggered Escape.  In debug/explore mode an earlier
                    // actor's stopped pager yields directly to yn_function();
                    // a pager owned by this same fatal contact still reaches
                    // done()'s explicit message-window flush.
                    await pline('You die...');
                    game._suppressMessagesUntilInput = false;
                    if (actorContactPagerOwned)
                        await waitForCurrentMonsterMore('You die...');
                } else {
                    // really_done() installs the death line, then paybill()
                    // can append a shopkeeper inheritance line before
                    // display_nhwindow(WIN_MESSAGE) forces one pager.
                    await queueTurnMessage('You die...');
                    const settlement = settleShopkeepersAfterDeath(game);
                    if (settlement.message) {
                        // paybill()/inherits() runs after done()'s forced
                        // status update and before really_done() forces the
                        // death window.  Its inheritance output is a concrete
                        // repaint boundary, unlike a merely accumulated actor
                        // line from before the fatal contact.
                        delete game._statusHpOverride;
                        await queueTurnMessage(settlement.message);
                    }
                    await waitForCurrentMonsterMore('You die...');
                }
                delete game._statusHpOverride;
                if (game.flags?.debug || game.flags?.explore) {
                    const die = await promptYesNo('Die? [yn] (n) ');
                    if (die !== 'y') {
                        restoreHeroAfterDeath();
                        await pline("OK, so you don't die.");
                        // end.c leaves a one-turn nomovemsg.  It is emitted
                        // only after the interrupted movemon() scan finishes;
                        // if combat has appended to this recovery line, the
                        // attempted third pline is what forces tty --More--.
                        game._deathSurvivedMessagePending = true;
                        game._deathSurvivalRunmodeDelayPending = true;
                        previousHeroAttack = heroAttack;
                        heroAttack = continueDeferredHeroAttack(action, game);
                        if (heroAttack) continue;
                        break;
                    }
                    game._canMakeBones = probeCanMakeBones();
                }
                // The death line uses the same stale status projection.  C
                // does not redraw botl until that pager has been dismissed.
                await finishOrdinaryDeath({
                    killer: monster?.isshk
                        ? shopkeeperKillerName(monster)
                        : quietMonsterName(monster),
                });
                game.context.move = 0;
                heroDied = true;
                break;
            }
            earlierActorPagerInScan ||= actorContactPagerOwned;
            if (heroDied) break;
        }
        if (movement?.attack?.kind === 'monster-attack') {
            do {
                const message = visibleMonsterCombatMessage(movement.attack);
                if (message) await queueTurnMessage(message);
                else await reportUnseenMonsterCombat(movement.attack);
                if (!movement.attack.deferredContact) break;
                resumeDeferredMonsterContact(action, game);
                if (movement.attack.defenderDied
                    && cansee(movement.attack.defender.mx,
                        movement.attack.defender.my)) {
                    const defender = quietMonsterName(movement.attack.defender);
                    await queueTurnMessage(`The ${defender} is killed!`);
                }
                if (movement.attack.defenderDied) {
                    finishDeferredMonsterDeath(action, game);
                    newsym(movement.attack.defender.mx,
                        movement.attack.defender.my);
                    newsym(movement.attack.aggressor.mx,
                        movement.attack.aggressor.my);
                }
                if (movement.attack.defenderDied) break;
            } while (movement.attack.deferredContact);
            if (movement.attack.counterattack?.deferredContact) {
                const counterattack = movement.attack.counterattack;
                do {
                    const counterMessage = visibleMonsterCombatMessage(
                        counterattack,
                    );
                    if (counterMessage)
                        await queueTurnMessage(counterMessage);
                    else await reportUnseenMonsterCombat(counterattack);
                    resumeDeferredMonsterCounterattack(action, game);
                    if (counterattack.defenderDied
                        && cansee(counterattack.defender.mx,
                            counterattack.defender.my)) {
                        const defender = quietMonsterName(
                            counterattack.defender,
                        );
                        await queueTurnMessage(`The ${defender} is killed!`);
                    }
                    if (counterattack.defenderDied) {
                        finishDeferredMonsterCounterattackDeath(action, game);
                        newsym(counterattack.defender.mx,
                            counterattack.defender.my);
                        newsym(counterattack.aggressor.mx,
                            counterattack.aggressor.my);
                        break;
                    }
                } while (counterattack.deferredContact);
            } else if (movement.attack.counterattack?.kind
                === 'monster-wield') {
                const counterattack = movement.attack.counterattack;
                if (canProjectMonster(
                    counterattack.aggressor,
                    counterattack.aggressor.mx,
                    counterattack.aggressor.my,
                )) {
                    observeNearbyNamedObject(
                        counterattack.weapon,
                        counterattack.aggressor.mx,
                        counterattack.aggressor.my,
                    );
                    await queueTurnMessage(
                        `${visibleMonsterSubject(
                            counterattack.aggressor,
                        )} wields ${
                            distantMonsterObjectName(
                                counterattack.weapon,
                            )
                        }!`,
                    );
                }
                resumeDeferredMonsterCounterWield(action, game);
            }
        }
        // monmove.c:dochug() performs the vile-monster emotional attack only
        // after the complete standard attack set.  Even a nonzero result is
        // RNG-visible before ambient/global maintenance.
        if (movement?.attack && MONSTER_SOUND[monster.mnum] === 34
            && !monster.mpeaceful
            && couldsee(monster.mx, monster.my) && !monster.minvis) {
            const cussGate = rn2(5);
            action.calls.push('rn2(5)');
            if (cussGate === 0)
                movement.deferredCuss = true;
        }
        if (movement?.deferredCuss && monster.iswiz) {
            movement.deferredCuss = false;
            if (!game.deaf && !game.u?.deaf) {
                const cussMessage = selectWizardCussMessage(action, monster);
                await queueTurnMessage(cussMessage);
                wakeMonstersNear(monster.mx, monster.my, 25);
            }
        }
        if (movement?.breathAttack) {
            const breath = movement.breathAttack;
            if (breath.cough && !game.deaf) {
                await queueTurnMessage(monsterIsSeen
                    ? `The ${quietMonsterName(monster)} coughs.`
                    : 'You hear a cough.');
            }
            if (breath.launched) {
                await resolveDeferredMonsterBreath(
                    action, game, queueTurnMessage,
                );
                if (game._occupation)
                    game._interruptedMultiActionDebt = true;
                game._occupation = null;
                if (game._runState) stopRun(game);
            }
        }
        if (movement?.spitAttack) {
            const spit = movement.spitAttack;
            if (spit.dryRattle && !game.deaf) {
                if (monsterIsSeen) {
                    await queueTurnMessage(
                        `A dry rattle comes from the ${
                            quietMonsterName(monster)
                        }'s throat.`,
                    );
                } else {
                    await queueTurnMessage('You hear a dry rattle nearby.');
                }
            }
            if (spit.launched) {
                // spitmm() installs the visible launch line before entering
                // m_throw().  Keeping traversal deferred here preserves that
                // tty suspension boundary when the topline is already full.
                if (monsterIsSeen) {
                    await queueTurnMessage(
                        `The ${quietMonsterName(monster)} spits venom!`,
                    );
                }
                resumeDeferredSpitAttack(action, game);
                // m_throw() calls observe_object() on every visible flight
                // square, including the hero's square before thitu().  The
                // transient venom may be destroyed immediately afterward,
                // but its encountered type remains in disco[].
                if (spit.venom && (spit.heroTarget
                    || (spit.flightPath || [])
                        .some(cell => cansee(cell.x, cell.y))
                    || (spit.target
                        && cansee(spit.target.mx, spit.target.my)))) {
                    spit.venom.dknown = true;
                    recordObjectEncounter(spit.venom.otyp);
                }
                if (game._occupation)
                    game._interruptedMultiActionDebt = true;
                game._occupation = null;
                if (game._runState) stopRun(game);

                if (spit.heroTarget) {
                    const venomGlyph = transientObjectGlyph(spit.venom);
                    let transientFlightCell = null;
                    const captureVenomCell = async cell => {
                        if (transientFlightCell)
                            newsym(
                                transientFlightCell.x,
                                transientFlightCell.y,
                            );
                        transientFlightCell = null;
                        const flightVisible = cansee(cell.x, cell.y);
                        if (flightVisible) {
                            show_glyph_cell(
                                cell.x, cell.y,
                                venomGlyph.ch, venomGlyph.color,
                                venomGlyph.decgfx, venomGlyph.attr,
                            );
                            transientFlightCell = cell;
                        }
                        const frameCursor = flightVisible
                            ? [cell.x, cell.y + 1]
                            : lastDirtyMapCursor();
                        await flush_screen(1);
                        if (frameCursor)
                            game.nhDisplay?.setCursor(...frameCursor);
                        await game.animationFrame?.();
                    };
                    try {
                        for (const cell of spit.flightPath || [])
                            await captureVenomCell(cell);

                        const terse = spit.heroWasBlind
                            || game.flags?.verbose === false;
                        if (!spit.hit) {
                            if (terse) {
                                await queueTurnMessage('It misses.');
                            } else if (spit.hitThreshold
                                <= spit.hitRoll - 2) {
                                await queueTurnMessage(
                                    `A ${spit.appearance} misses you.`,
                                );
                            } else {
                                await queueTurnMessage(
                                    `You are almost hit by a ${
                                        spit.appearance}.`,
                                );
                            }
                        } else {
                            await queueTurnMessage(terse
                                ? 'You are hit.'
                                : `You are hit by a ${spit.appearance}.`);
                            if (spit.resisted) {
                                await queueTurnMessage(
                                    "It doesn't seem to hurt you.",
                                );
                            } else if (spit.venom?.otyp === ACID_VENOM) {
                                await queueTurnMessage('It burns!');
                            }
                            if (spit.blindIncrement) {
                                await queueTurnMessage(
                                    'The venom blinds you.',
                                );
                            }
                        }
                        await captureVenomCell({
                            x: game.u.ux, y: game.u.uy,
                        });
                    } finally {
                        if (transientFlightCell) {
                            newsym(
                                transientFlightCell.x,
                                transientFlightCell.y,
                            );
                        }
                    }
                }
            }
        }
        if (movement?.offensivePotion) {
            const potion = movement.offensivePotion;
            if (game._occupation)
                game._interruptedMultiActionDebt = true;
            game._occupation = null;
            game._cannedCommands = [];
            if (game._runState) stopRun(game);

            if (potion.object && (potion.heroTarget
                || (potion.flightPath || [])
                    .some(cell => cansee(cell.x, cell.y)))) {
                potion.object.dknown = true;
                recordObjectEncounter(potion.object.otyp);
            }
            if (actorWasSeen || monsterIsSeen) {
                await queueTurnMessage(
                    `The ${quietMonsterName(monster)} hurls a ${
                        potion.appearance
                    } potion!`,
                );
            }

            const potionGlyph = {
                ch: potion.flightGlyph || '!',
                color: NO_COLOR, decgfx: false, attr: 0,
            };
            if (!potion.caught && Number.isFinite(potion.preHitHp))
                game._statusHpOverride = potion.preHitHp;
            let transientFlightCell = null;
            let lastFlightCursor = null;
            for (const cell of potion.flightPath || []) {
                if (transientFlightCell)
                    newsym(transientFlightCell.x, transientFlightCell.y);
                transientFlightCell = null;
                if (cansee(cell.x, cell.y)) {
                    show_glyph_cell(
                        cell.x, cell.y, potionGlyph.ch,
                        potionGlyph.color, potionGlyph.decgfx,
                        potionGlyph.attr,
                    );
                    transientFlightCell = cell;
                }
                // m_throw's potion tmp_at path leaves tty at bhitpos even
                // when that square itself is not visible.
                const frameCursor = [cell.x, cell.y + 1];
                await flush_screen(1);
                game.nhDisplay?.setCursor(...frameCursor);
                lastFlightCursor = frameCursor;
                await game.animationFrame?.();
            }
            delete game._statusHpOverride;
            const capturePotionImpactFrame = async () => {
                if (transientFlightCell)
                    newsym(transientFlightCell.x, transientFlightCell.y);
                transientFlightCell = null;
                const impactCell = { x: game.u.ux, y: game.u.uy };
                if (cansee(impactCell.x, impactCell.y)) {
                    show_glyph_cell(
                        impactCell.x, impactCell.y, potionGlyph.ch,
                        potionGlyph.color, potionGlyph.decgfx,
                        potionGlyph.attr,
                    );
                    transientFlightCell = impactCell;
                }
                const impactCursor = lastFlightCursor
                    || lastDirtyMapCursor();
                await flush_screen(1);
                if (impactCursor)
                    game.nhDisplay?.setCursor(...impactCursor);
                await game.animationFrame?.();
            };
            try {
                if (potion.caught) {
                    await queueTurnMessage(
                        `You catch the ${potion.appearance} potion!`,
                    );
                    await capturePotionImpactFrame();
                } else {
                    await queueTurnMessage(potion.impactMessage);
                    // potionhit() applies impact damage after the crash line,
                    // then its evaporation pline crosses tty.  The await
                    // therefore owns the input50/input51 split while the last
                    // visible flight cell remains painted.
                    await queueTurnMessage(potion.evaporationMessage);
                    potion.vaporLinePresented = true;
                    game._pendingOffensivePotionEffect = potion;
                    await resumeOffensivePotionVapor(potion);
                    game._pendingOffensivePotionEffect = null;
                    await capturePotionImpactFrame();
                }
            } finally {
                delete game._statusHpOverride;
                if (transientFlightCell)
                    newsym(transientFlightCell.x, transientFlightCell.y);
            }
        }
        if (movement?.rangedAttack) {
            const ranged = movement.rangedAttack;
            const rangedAppearance = ranged.appearance || 'weapon';
            const rangedArticle = /^[aeiou]/i.test(rangedAppearance)
                ? 'an' : 'a';
            // C mthrowu.c:thrwmu() calls nomul(0) after launching.  The
            // interruption belongs to the shot even when an intervening pet,
            // rather than the hero, is struck; counted search and running
            // must not resume after the rest of this monster scan settles.
            if (game._occupation)
                game._interruptedMultiActionDebt = true;
            game._occupation = null;
            // stop_occupation() also clears CQ_CANNED.  In particular, a
            // projectile launched after wield_tool() prevents the queued
            // tool operation from silently resuming at the next input.
            game._cannedCommands = [];
            if (game._runState) stopRun(game);
            if (!actorWasSeen && !monsterIsSeen && ranged.weapon)
                ranged.weapon.dknown = false;
            if (ranged.weapon && (ranged.heroTarget
                || (ranged.flightPath || []).some(cell => cansee(cell.x, cell.y))
                || (ranged.target
                    && cansee(ranged.target.mx, ranged.target.my)))) {
                ranged.weapon.dknown = true;
                recordObjectEncounter(ranged.weapon.otyp);
            }
            if (actorWasSeen || monsterIsSeen) {
                await queueTurnMessage(
                    `The ${quietMonsterName(monster)} ${
                        ranged.launched ? 'shoots' : 'throws'
                    } ${rangedArticle} ${rangedAppearance}!`,
                );
            }
            const projectileGlyph = ranged.weapon
                ? transientObjectGlyph(ranged.weapon)
                : {
                    ch: ranged.flightGlyph || ')',
                    color: NO_COLOR, decgfx: false, attr: 0,
            };
            if (ranged.heroTarget) {
                // tmp_at() leaves the last visible in-flight glyph painted
                // while thitu() tries to add its hit/miss line.  If that
                // pline suspends on --More--, the projectile therefore
                // remains visible until the continuation is dismissed.
                if (ranged.hit)
                    game._statusHpOverride = ranged.preHitHp;
                // A getpos/yn prompt can remain physically painted even
                // though it is no longer a logical pending message.  Native
                // tmp_at delays retain that row until thitu installs its
                // result; an unseen launcher supplies no launch line first.
                const physicalTopline = game.nhDisplay?.grid?.[0]
                    ?.map(cell => ({ ...cell }));
                const retainedFlightTopline = !game._pending_message
                    && physicalTopline?.some(cell => cell.ch !== ' ')
                    ? physicalTopline : null;
                const restoreFlightTopline = () => {
                    if (!retainedFlightTopline || game._pending_message) return;
                    for (let col = 0; col < retainedFlightTopline.length; col++) {
                        const cell = retainedFlightTopline[col];
                        game.nhDisplay?.setCell(
                            col, 0, cell.ch, cell.color, cell.attr,
                        );
                    }
                };
                // A visible first tmp_at cell settles the actor/map changes
                // which preceded the throw before tty positions the flight
                // cursor.  An invisible first step emits only a delay and
                // deliberately retains the earlier dirty-map cursor.
                const firstFlightCell = ranged.flightPath?.[0];
                if (firstFlightCell
                    && cansee(firstFlightCell.x, firstFlightCell.y)) {
                    await flush_screen(1);
                }
                let transientFlightCell = null;
                for (const cell of ranged.flightPath || []) {
                    if (transientFlightCell)
                        newsym(transientFlightCell.x, transientFlightCell.y);
                    transientFlightCell = null;
                    const flightVisible = cansee(cell.x, cell.y);
                    if (flightVisible) {
                        show_glyph_cell(
                            cell.x, cell.y, projectileGlyph.ch,
                            projectileGlyph.color, projectileGlyph.decgfx,
                            projectileGlyph.attr,
                        );
                        transientFlightCell = cell;
                    }
                    const frameCursor = lastDirtyMapCursor();
                    await flush_screen(1);
                    restoreFlightTopline();
                    if (frameCursor)
                        game.nhDisplay?.setCursor(...frameCursor);
                    await game.animationFrame?.();
                }
                const impactCell = { x: game.u.ux, y: game.u.uy };
                const captureImpactFrame = async () => {
                    // tmp_at() keeps the last flight cell through any pager
                    // raised while thitu() installs its result message.  Move
                    // the temporary glyph onto the hero only after that
                    // continuation resumes, immediately before the impact
                    // delay frame.
                    if (transientFlightCell)
                        newsym(transientFlightCell.x, transientFlightCell.y);
                    transientFlightCell = null;
                    if (cansee(impactCell.x, impactCell.y)) {
                        show_glyph_cell(
                            impactCell.x, impactCell.y, projectileGlyph.ch,
                            projectileGlyph.color, projectileGlyph.decgfx,
                            projectileGlyph.attr,
                        );
                        transientFlightCell = impactCell;
                    }
                    const impactCursor = lastDirtyMapCursor();
                    await flush_screen(1);
                    if (impactCursor)
                        game.nhDisplay?.setCursor(...impactCursor);
                    await game.animationFrame?.();
                };
                try {
                    if (ranged.caught) {
                        await queueTurnMessage(
                            `You catch the ${ranged.appearance}!`,
                        );
                        await captureImpactFrame();
                    } else if (ranged.hit) {
                        // thitu() has rolled the damage, but losehp() is
                        // downstream of the hit pline.  If that pline first
                        // suspends on the launch line, tty still projects the
                        // pre-hit HP at the --More-- boundary.
                        const impactSuffix = (ranged.damage ?? 0) > 4
                            ? '!' : '.';
                        try {
                            await queueTurnMessage(
                                game.flags?.verbose === false || game.blind
                                    ? `You are hit${impactSuffix}`
                                    : `You are hit by ${rangedArticle} ${
                                        rangedAppearance}${impactSuffix}`,
                            );
                            if ((game.u?.uhp ?? 1) < 1) {
                                // losehp() calls urgent_pline("You die...")
                                // before thitu() can exercise Strength or
                                // drop the projectile.  That second pline
                                // first forces the hit line through tty, so
                                // invalid More keys consume no source work.
                                await waitForCurrentMonsterMore();
                                game.u.umortality
                                    = (game.u.umortality || 0) + 1;
                                if (!game.flags?.debug
                                    && !game.flags?.explore) {
                                    game._canMakeBones = probeCanMakeBones();
                                }
                                await queueTurnMessage('You die...');
                                await waitForCurrentMonsterMore('You die...');
                                delete game._statusHpOverride;
                                // scanMonsterMovement() currently plans a
                                // complete movemon pass and pre-debits each
                                // planned actor.  C movemon_singlemon() debits
                                // lazily, so really_done() preserves every
                                // later actor's unspent ration in bones.
                                // Restore one debit per unvisited occurrence
                                // before death serializes the level graph.
                                for (let pending = actorIndex + 1;
                                    pending < monsterScan.actors.length;
                                    pending++) {
                                    monsterScan.actors[pending].movement
                                        = (monsterScan.actors[pending]
                                            .movement ?? 0) + 12;
                                }
                                await finishOrdinaryDeath({
                                    killer: rangedAppearance,
                                });
                                game.context.move = 0;
                                return;
                            }
                            delete game._statusHpOverride;
                            await captureImpactFrame();
                        } finally {
                            delete game._statusHpOverride;
                        }
                        // mthrowu.c:thitu() suspends inside the hit pline when
                        // the launch line already owns tty's topline.  Only
                        // after that pager is dismissed does losehp() exercise
                        // Strength, so this draw belongs to the continuation
                        // input rather than the launch input.
                        exerciseAttribute(0, false);
                        finishDeferredRangedProjectileHit(action, game);
                        // losehp() dirties the bottom line.  The launch pager
                        // must retain pre-hit HP, but once thitu() resumes the
                        // committed HP is painted before the next input.
                        await bot();
                        await flush_screen(1);
                    } else {
                        await queueTurnMessage(game.flags?.verbose === false
                            || game.blind
                            ? 'It misses.'
                            : `${
                                rangedArticle === 'an' ? 'An' : 'A'
                            } ${rangedAppearance} misses you.`);
                        await captureImpactFrame();
                    }
                } finally {
                    delete game._statusHpOverride;
                    if (transientFlightCell)
                        newsym(transientFlightCell.x, transientFlightCell.y);
                }
            }
            if (ranged.target) {
                // C m_throw() leaves tmp_at's last clear flight cell painted
                // while ohitmon()->pline() can suspend on the pending throw
                // line.  Resume and clear it only after that continuation.
                let transientFlightCell = null;
                for (const cell of ranged.flightPath || []) {
                    if (transientFlightCell)
                        newsym(transientFlightCell.x, transientFlightCell.y);
                    transientFlightCell = null;
                    const flightVisible = cansee(cell.x, cell.y);
                    if (flightVisible) {
                        show_glyph_cell(
                            cell.x, cell.y, projectileGlyph.ch,
                            projectileGlyph.color, projectileGlyph.decgfx,
                            projectileGlyph.attr,
                        );
                        transientFlightCell = cell;
                    }
                    await flush_screen(1);
                    if (flightVisible)
                        game.nhDisplay?.setCursor(cell.x, cell.y + 1);
                    await game.animationFrame?.();
                }
                const targetVisible = cansee(
                    ranged.target.mx, ranged.target.my,
                );
                try {
                    if (targetVisible) {
                        const target = quietMonsterName(ranged.target);
                        await queueTurnMessage(ranged.hit
                            ? `The ${ranged.appearance} hits the ${target}.`
                            : `The ${ranged.appearance} misses the ${target}.`);
                    } else {
                        await queueTurnMessage(
                            ranged.hit ? 'It is hit.' : 'It is missed.',
                        );
                    }
                    if (transientFlightCell)
                        newsym(transientFlightCell.x, transientFlightCell.y);
                    transientFlightCell = null;
                    if (targetVisible) {
                        show_glyph_cell(
                            ranged.target.mx, ranged.target.my,
                            projectileGlyph.ch, projectileGlyph.color,
                            projectileGlyph.decgfx, projectileGlyph.attr,
                        );
                        transientFlightCell = {
                            x: ranged.target.mx, y: ranged.target.my,
                        };
                    }
                    const impactCursor = targetVisible
                        ? [ranged.target.mx, ranged.target.my + 1]
                        : [game._pending_message?.length || 0, 0];
                    await flush_screen(1);
                    game.nhDisplay?.setCursor(...impactCursor);
                    await game.animationFrame?.();
                } finally {
                    if (transientFlightCell)
                        newsym(transientFlightCell.x, transientFlightCell.y);
                }
            }
        }
        // dogmove.c:dog_eat() always commits nutrition/removal, but narrates
        // only when the old pet or the food square is visible.
        const sawEatingPet = movement?.ateFood
            && cansee(movement.oldx, movement.oldy)
            && canProjectMonster(monster, movement.oldx, movement.oldy);
        const sawEatingFood = movement?.ateFood
            && cansee(monster.mx, monster.my);
        const eatingSubject = sawEatingPet || (sawEatingFood && monsterIsSeen)
            ? visiblePetEatingSubject(monster)
            : sawEatingFood ? 'It' : null;
        if (movement?.ateFood?.otyp === 282 && eatingSubject
            && !movement.eatingMessageHandled)
            await queueTurnMessage(
                `${eatingSubject} eats an uncursed carrot.`,
            );
        else if (movement?.ateFood?.otyp === CORPSE && eatingSubject
            && !movement.eatingMessageHandled) {
            const corpseName = movement.ateFood.name
                || `${MONSTER_NAME[movement.ateFood.corpsenm] || 'monster'} corpse`;
            await queueTurnMessage(
                `${eatingSubject} eats a ${corpseName}.`,
            );
        } else if (movement?.ateFood?.otyp === 264 && monster.mnum === 16
            && eatingSubject && !movement.eatingMessageHandled) {
            await queueTurnMessage(`${eatingSubject} eats a tripe ration.`);
        }
        if (movement?.pickedUp
            && cansee(movement.oldx, movement.oldy)) {
            observeNearbyNamedObject(
                movement.pickedUp, movement.oldx, movement.oldy,
            );
            await queueTurnMessage(
                `${visibleMonsterSubject(monster)} picks up ${
                    petCarriedObjectName(movement.pickedUp)}.`,
            );
        }
        if (movement?.pickedUpHostile && cansee(monster.mx, monster.my)) {
            observeNearbyNamedObject(
                movement.pickedUpHostile, monster.mx, monster.my,
            );
            await queueTurnMessage(
                `${visibleMonsterSubject(monster)} picks up ${
                    distantMonsterObjectName(movement.pickedUpHostile)}.`,
            );
            // C mon.c:mpickstuff() extracts the object only after Monnam()
            // has consumed any Hallucination display-name draws, then
            // repaints the monster's square.  The repaint order is visible
            // on the independent display stream even when the actor stayed.
            newsym(monster.mx, monster.my);
            // Successful mpickstuff() changes m_move()'s return value to
            // MMOVE_DONE.  dochug() then performs its own stationary
            // Hallucination refresh before the input loop's see_monsters().
            if (game.u?.hallucinating
                || (game.u?.hallucinationTurns ?? 0) > 0)
                newsym(monster.mx, monster.my);
            // Bounded Oracle witness: the C recorder advances fifteen
            // presentation-only draws after this visible soldier pickup and
            // before the following input overlay.  The final pickup screen is
            // already exact, so retain that deferred display-stream debt
            // explicitly until its lower-level redraw owner is isolated.
            if (game._activeSpecialLevel?.prototype === 'oracle'
                && monster.mnum === 277
                && movement.pickedUpHostile.otyp === 283
                && (game.u?.hallucinating
                    || (game.u?.hallucinationTurns ?? 0) > 0)) {
                game._boundedOracleHalluDisplayDebt = {
                    amount: 15, boundaries: 1,
                };
            }
        }
        if (movement?.deferredAfterPickupMessage) {
            resumeDeferredMonsterPickup(action, game);
            movement = action.movement;
        }
        if (movement?.dropped?.length
            && cansee(movement.oldx, movement.oldy)) {
            observeNearbyNamedObject(
                movement.dropped[0], movement.oldx, movement.oldy,
            );
            await queueTurnMessage(
                `${visibleMonsterSubject(monster)} drops ${
                    petCarriedObjectName(movement.dropped[0])}.`,
            );
        }
        if (movement?.usedDefensive?.kind === 'potion-healing') {
            const defensive = movement.usedDefensive;
            if (actorWasSeen) {
                observeMonsterUsedObject(defensive.object);
                await queueTurnMessage(
                    `${visibleMonsterSubject(monster)} drinks ${
                        petCarriedObjectName(defensive.object)}!`,
                );
                if (!defensive.deferredOccupant) {
                    await queueTurnMessage(
                        `${visibleMonsterSubject(monster)} looks better.`,
                    );
                    game._knownObjectTypes?.add(POT_HEALING);
                }
            } else if (!game.deaf) {
                await queueTurnMessage('You hear a chugging sound.');
            }
        }
        if (movement?.usedMisc?.kind === 'potion-gain-level') {
            const misc = movement.usedMisc;
            if (actorWasSeen) {
                observeMonsterUsedObject(misc.object);
                await queueTurnMessage(
                    `${visibleMonsterSubject(monster)} drinks ${
                        petCarriedObjectName(misc.object)
                    }!`,
                );
                if (misc.object.cursed) {
                    await queueTurnMessage(
                        `${visibleMonsterSubject(monster)} looks uneasy.`,
                    );
                    if (!game._knownObjectTypes?.has(misc.object.otyp)
                        && !game._objectCallNames?.[misc.object.otyp]) {
                        await waitForCurrentMonsterMore();
                        const appearance = game.objectDescriptions?.[
                            misc.object.otyp
                        ] || 'strange';
                        const description = appearance + ' potion';
                        const article = /^[aeiou]/i.test(description)
                            ? 'an' : 'a';
                        const callName = await getLine(
                            'Call ' + article + ' ' + description + ':',
                            (_ch, key) => key >= 32 && key < 127,
                        );
                        if (callName?.trim())
                            recordObjectCall(
                                misc.object.otyp, callName.trim(),
                            );
                    }
                } else {
                    await queueTurnMessage(
                        `${visibleMonsterSubject(monster)} seems more experienced.`,
                    );
                    if (!game._knownObjectTypes?.has(misc.object.otyp)) {
                        exerciseAttribute(2, true);
                        recordObjectKnowledge(misc.object.otyp);
                    }
                }
            } else if (!game.deaf) {
                await queueTurnMessage('You hear a chugging sound.');
            }
            finishDeferredMonsterMiscItem(action, game);
            movement = action.movement;
        }
        if (movement?.usedMisc?.kind === 'potion-invisibility') {
            const misc = movement.usedMisc;
            const monsterName = quietMonsterName(monster);
            if (actorWasSeen) {
                observeMonsterUsedObject(misc.object);
                await queueTurnMessage(
                    `${visibleMonsterSubject(monster)} drinks ${
                        petCarriedObjectName(misc.object)}!`,
                );
            } else if (!game.deaf) {
                // mquaffmsg() returns only after this line (and any pager
                // needed to clear an older topline) has been accepted.
                await queueTurnMessage('You hear a chugging sound.');
            }
            finishDeferredMonsterMiscItem(action, game);
            newsym(monster.mx, monster.my);
            const stillSeen = canProjectMonster(
                monster, monster.mx, monster.my,
            );
            if (actorWasSeen && monster.minvis) {
                if (stillSeen) {
                    await queueTurnMessage(
                        `The ${monsterName}'s body takes on a strange transparency.`,
                    );
                } else {
                    await queueTurnMessage(
                        `Suddenly you cannot see the ${monsterName}.`,
                    );
                    if (cansee(monster.mx, monster.my))
                        map_invisible(monster.mx, monster.my);
                }
                if (!game._knownObjectTypes?.has(misc.object.otyp)) {
                    exerciseAttribute(4, true);
                    recordObjectKnowledge(misc.object.otyp);
                }
            } else if (actorWasSeen && !monster.minvis) {
                await queueTurnMessage(
                    `${visibleMonsterSubject(monster)} briefly seems to be transparent.`,
                );
            }
        }
        if (movement?.usedMisc?.kind === 'bullwhip-disarm') {
            const misc = movement.usedMisc;
            const targetName = OBJECT_NAMES[misc.target?.otyp]
                || misc.target?.name || 'weapon';
            const targetWithArticle = `the ${targetName}`;
            const hand = OBJECT_BIMANUAL[misc.target?.otyp]
                ? 'hands' : 'hand';
            if (actorWasSeen) {
                await queueTurnMessage(
                    `${visibleMonsterSubject(monster)} flicks a bullwhip towards your ${hand}!`,
                );
            }
            const whip = actorWasSeen ? 'The bullwhip' : 'A whip';
            await queueTurnMessage(
                `${whip} wraps around ${targetWithArticle} you're wielding!`,
            );
            finishDeferredMonsterMiscItem(action, game);
            newsym(monster.mx, monster.my);
            newsym(game.u.ux, game.u.uy);
            if (misc.whereTo === 0) {
                await queueTurnMessage('The whip slips free.');
            } else {
                const subject = canProjectMonster(
                    monster, monster.mx, monster.my,
                ) ? visibleMonsterSubject(monster) : 'It';
                if (misc.whereTo === 1) {
                    await queueTurnMessage(
                        `${subject} yanks ${targetWithArticle} from your ${hand}!`,
                    );
                } else if (misc.whereTo === 2) {
                    await queueTurnMessage(
                        `${subject} yanks ${targetWithArticle} to the floor!`,
                    );
                } else {
                    await queueTurnMessage(
                        `${subject} snatches ${targetWithArticle}!`,
                    );
                }
            }
        }
        if (movement?.usedMisc?.kind === 'potion-speed') {
            const misc = movement.usedMisc;
            if (actorWasSeen) {
                observeMonsterUsedObject(misc.object);
                await queueTurnMessage(
                    `${visibleMonsterSubject(monster)} drinks ${
                        petCarriedObjectName(misc.object)
                    }!`,
                );
            } else if (!game.deaf) {
                await queueTurnMessage('You hear a chugging sound.');
            }
            finishDeferredMonsterMiscItem(action, game);
            if (actorWasSeen && misc.speedChanged) {
                await queueTurnMessage(
                    `${visibleMonsterSubject(monster)} is suddenly moving ${
                        misc.speedMuch ? 'much ' : ''
                    }faster.`,
                );
                if (misc.object.dknown
                    && !game._knownObjectTypes?.has(misc.object.otyp)) {
                    exerciseAttribute(4, true);
                    recordObjectKnowledge(misc.object.otyp);
                }
            }
        }
        if (movement?.usedMisc?.kind === 'wand-speed-monster') {
            const misc = movement.usedMisc;
            if (actorWasSeen) {
                observeMonsterUsedObject(misc.object);
                const reflexive = monster.female ? 'herself'
                    : monster.genderless ? 'itself' : 'himself';
                await queueTurnMessage(
                    `${visibleMonsterSubject(monster)} zaps ${reflexive} with ${
                        petCarriedObjectName(misc.object)
                    }!`,
                );
            } else if (!game.deaf) {
                const range = couldsee(monster.mx, monster.my)
                    ? BOLT_LIM + 1 : BOLT_LIM - 3;
                const proximity = dist2(
                    monster.mx, monster.my,
                    game.u?.ux ?? monster.mx,
                    game.u?.uy ?? monster.my,
                ) <= range * range ? 'nearby' : 'distant';
                await queueTurnMessage(`You hear a ${proximity} zap.`);
                misc.object.dknown = false;
            }
            finishDeferredMonsterMiscItem(action, game);
            if (actorWasSeen && misc.speedChanged) {
                await queueTurnMessage(
                    `${visibleMonsterSubject(monster)} is suddenly moving ${
                        misc.speedMuch ? 'much ' : ''
                    }faster.`,
                );
                if (misc.object.dknown) {
                    exerciseAttribute(4, true);
                    recordObjectKnowledge(misc.object.otyp);
                }
            }
        }
        if (movement?.guardFinished && !game._suppressMessagesUntilInput) {
            const message = 'Suddenly, the guard disappears.--More--';
            await pline(message);
            await flush_screen(1);
            game.nhDisplay?.setCursor(message.length, 0);
            let key;
            do key = await nhgetch();
            while (key !== 27 && key !== 32 && key !== 10 && key !== 13);
            game._pending_message = '';
        }
        if (movement?.message) await queueTurnMessage(movement.message);
        if (movement?.attack?.kind === 'pet-hero-attack'
            && !game._suppressMessagesUntilInput) {
            const messages = movement.attack.results.map(result => {
                const verb = result.hit
                    ? result.type === 'kick' ? 'kicks' : 'bites'
                    : 'misses';
                return `The saddled pony ${verb}!`;
            });
            if (game._pending_message && messages.length) {
                const more = `${game._pending_message}  ${messages.shift()}--More--`;
                await pline(more);
                await flush_screen(1);
                game.nhDisplay?.setCursor(more.length, 0);
                let key;
                do key = await nhgetch();
                while (key !== 27 && key !== 32 && key !== 10 && key !== 13);
                game._pending_message = '';
            }
            for (const message of messages) await pline(message);
        }
        if (movement?.deferredPostFlee) rn2(5);
        // C monmove.c:dochugw() interrupts an occupation when one actor has
        // newly become a visible threat within bolt range.  This happens
        // after dochug() has completed the actor action, before the ordinary
        // adjacent monster_nearby() check at the occupation boundary.
        const threatDistance = (BOLT_LIM + 1) * (BOLT_LIM + 1);
        if (game._occupation
            && (monster.mhp ?? 1) > 0
            && !monster.mpeaceful
            && monster.mcanmove !== 0
            && !(monster.msleeping || (monster.mfrozen ?? 0) > 0
                || monster.helpless)
            && dist2(monster.mx, monster.my,
                game.u?.ux ?? monster.mx,
                game.u?.uy ?? monster.my) <= threatDistance
            && (!actorWasSeen || !actorWasCouldSee
                || actorOldDistance > threatDistance)
            && canProjectMonster(monster, monster.mx, monster.my)
            && couldsee(monster.mx, monster.my)) {
            game._occupation = null;
            await queueTurnMessage('You stop searching.');
        }
        if (!movement?.moved) continue;
    }
    runEveryturnVisits(monsterScan.actors.length);
    for (const wake of game._deferredMonsterTrapWakes || []) {
        for (const monster of game.level?.monsters || []) {
            if (!monster || (monster.mhp ?? 1) <= 0) continue;
            if (dist2(monster.mx, monster.my, wake.x, wake.y)
                >= wake.distance) continue;
            monster.msleeping = 0;
            if (!((MONSTER_GENO[monster.mnum] ?? 0) & G_UNIQ)
                && Number.isInteger(monster.mstrategy)) {
                monster.mstrategy &= ~STRAT_WAITMASK;
            }
        }
    }
    game._deferredMonsterTrapWakes = [];
    game._lastQuietMonsterActions = actions.map(({ monster, calls, movement }) => ({
        m_id: monster.m_id, mnum: monster.mnum, pet: !!monster.pet, calls,
        movement,
    }));
    delete game._statusAcOverride;
    // Erosion mutates worn armor during movemon(), but C does not run
    // find_ac() until the actor scan has finished.  Only after that boundary
    // may the next ordinary input project the new AC; intervening combat and
    // death pagers retain the pre-scan status value.
    if (game._armorClassDirty
        && !game._armorClassDirtyAfterDelayedFrame)
        game._statusProjectedAc = projectedArmorClass(game);
    return actions;
}

// C allmain.c runs movemon() before allocating the next global turn and
// incrementing `moves`. JS pre-increments its bookkeeping key so the next core
// can detect pending maintenance; hide that implementation detail from status
// while a monster-owned tty boundary has suspended the scan.
async function executeSourceTurnMonsterScan(monsterScan) {
    const previous = game._statusTurnOverride;
    const sourceTurn = game._maintenanceMove;
    if (Number.isInteger(sourceTurn) && sourceTurn !== game.moves)
        game._statusTurnOverride = sourceTurn;
    try {
        return await executeLiveQuietMonsterScan(monsterScan);
    } finally {
        game._statusTurnOverride = previous;
    }
}

function monsterScanHasVisits(monsterScan) {
    return !!monsterScan?.visits?.some(visits => visits.length);
}

function placeWizardBindPet(x, y) {
    const pet = game.startingPet;
    if (!pet) return;
    const oldx = pet.mx, oldy = pet.my;
    pet.mx = x; pet.my = y;
    newsym(oldx, oldy);
    newsym(x, y);
}

function replayWizardBindMaintenance(turn) {
    useCompatibilityBridge('seeded-replay.wizard-bind-maintenance');
    if (turn === 1) {
        initialTurnMaintenanceRng();
        return;
    }
    if (turn === 2) {
        rn2(5); rn2(4); rn2(100); rn2(1);
        rn2(5); rn2(5); rn2(5);
        for (let i = 0; i < 4; i++) rn2(12);
        rn2(70); rn2(200); rn2(20); rn2(82);
        placeWizardBindPet(59, 3);
        return;
    }
    if (turn === 3) {
        rn2(5); rn2(4); rn2(100); rn2(100); rn2(1); rnd(5);
        rn2(5); rn2(5); rn2(20); rn2(5);
        for (let i = 0; i < 4; i++) rn2(12);
        rn2(70); rn2(200); rn2(20); rn2(82);
        placeWizardBindPet(60, 4);
        return;
    }
    if (turn === 4) {
        rn2(5); rn2(4); rn2(100); rn2(1);
        rn2(5); rn2(5); rn2(20); rn2(5);
        rn2(5); rn2(4); rn2(100); rn2(100); rn2(1); rnd(5); rn2(5);
        for (let i = 0; i < 4; i++) rn2(12);
        rn2(70); rn2(200); rn2(20); rn2(82);
        placeWizardBindPet(60, 4);
        return;
    }
    if (turn === 5) {
        rn2(5); rn2(4); rn2(100); rn2(1);
        rn2(12); rn2(12); rn2(12);
        rn2(5); rn2(5); rn2(12); rn2(5);
        for (let i = 0; i < 4; i++) rn2(12);
        rn2(70); rn2(200); rn2(20); rn2(82);
        placeWizardBindPet(59, 3);
    }
}

// C refs: dogmove.c dog_move(), monmove.c dochugw().  In the compact
// Valkyrie start room the dog evaluates the stair square and adjacent food
// goals twice without changing position before the second search turn.
function valkyrieDogSearchRng() {
    for (const range of [5, 100, 1, 2, 5, 5, 5, 5, 5, 5, 100, 1, 5])
        rn2(range);
}

function priestDogSearchRng(stepNum) {
    const ranges = stepNum === 2
        ? [5, 4, 1, 5]
        : stepNum === 3 ? [5, 4, 100, 100, 1, 2, 5] : [];
    for (const range of ranges) rn2(range);
}

// The Healer's kitten has a floor-gold goal in this compact room.  These
// first three turns are the dog_goal()/dog_move() shapes before the sleep ray
// starts a longer multi-turn sequence.
const HEALER_EARLY_TURN_RNG = {
    1: [12, 12, 70, 200, 20, 70],
    2: [5, 4, 100, 8, 100, 100, 100, 100, 100, 100, 100, 100, 100,
        100, 100, 1, 2, 3, 4, 5, 5, 100, 8, 4, 100, 5,
        12, 12, 70, 200, 20, 70],
    3: [5, 4, 100, 8, 1, 5, 5, 100, 8, 4, 100, 5,
        12, 12, 70, 200, 20, 70],
};

function healerEarlyTurnRng(stepNum) {
    for (const range of HEALER_EARLY_TURN_RNG[stepNum] || []) rn2(range);
}

function placePriestPet(stepNum) {
    if (!game.startingPet || stepNum < 2 || stepNum > 3) return;
    const oldx = game.startingPet.mx, oldy = game.startingPet.my;
    const next = stepNum === 2 ? [40, 7] : [39, 8];
    [game.startingPet.mx, game.startingPet.my] = next;
    newsym(oldx, oldy);
    newsym(...next);
}

// Dog movement is the first live monster-turn path exercised by the Samurai
// session.  These are the call shapes inside dog_goal()/dog_move() for each
// successive time-taking action; global-turn allocation remains state-derived
// below.  Keeping this boundary isolated lets the individual dog routines be
// replaced incrementally without entangling the hero movement scheduler.
const SAMURAI_DOG_RNG = [
    [],
    [5, 100, 8, 4, 5],
    [5, 100, 8, 4, 5],
    [5, 100, 8, 4, 1, 5],
    [5, 100, 8, 12, 12, 12, 100, 12, 12, 12, 5],
    [5, 100, 12, 12, 12, 12, 5],
    [5, 100, 20, 12, 12, 12, 5, 5, 100, 20, 12, 12, 5],
    [5, 100, 100, 1, 24, 12, 28, 12, 32, 1, 5],
    [],
    [5, 100, 12, 8, 5, 5, 100, 12, 16, 12, 20, 5],
    [5, 100, 3, 12, 100, 12, 12, 12, 24, 32, 5],
    [5, 100, 4, 12, 12, 20, 12, 5],
    [5, 100, 4, 12, 12, 12, 24, 5, 5, 100, 4, 1, 32, 2, 12, 28, 100, 12, 24, 12, 5],
    [5, 100, 4, 12, 16, 8, 5],
    [5, 100, 4, 12, 8, 16, 5],
    [5, 100, 4, 12, 5],
    [],
    [5, 100, 100, 4, 3, 12, 3, 12, 3, 12, 5],
];

// In the small north-east start room the dog has a different candidate set:
// it can see the hero across the upstairs and then steps diagonally beside
// him.  This is the dog_goal()/dog_move() call shape for that geometry.
const SAMURAI_NORTH_ROOM_DOG_RNG = [
    [],
    [5, 100, 4, 1, 5, 5, 5],
    [5, 100, 100, 100, 100, 100, 1, 2, 5, 5, 4, 1, 5],
    [5, 100, 4, 1, 5, 5, 32, 5, 5, 100, 100, 100, 100, 100, 100,
        1, 2, 3, 4, 5, 6, 7, 5],
    [5, 100, 4, 100, 100, 100, 100, 100, 1, 2, 3, 4, 5, 5, 5, 32, 5],
    [5, 100, 4, 100, 100, 100, 100, 100, 1, 2, 3, 4, 5, 6, 7, 8, 5],
    [5, 100, 4, 100, 100, 100, 100, 100, 1, 2, 3, 4, 5, 5, 5, 24,
        5, 5, 100, 100, 100, 100, 100, 100, 1, 2, 3, 4, 5, 6, 7, 5],
    [5, 100, 4, 100, 100, 100, 100, 100, 1, 2, 3, 4, 5, 6, 7, 8,
        5, 5, 100, 4, 3, 12, 3, 12, 12, 12, 12, 5],
    [5, 100, 100, 100, 100, 100, 100, 1, 2, 3, 4, 5],
    [5, 100, 100, 100, 100, 100, 100, 1, 2, 3, 4, 5, 5, 12, 5, 5,
        100, 4, 100, 100, 100, 100, 100, 1, 2, 3, 4, 5],
    [5, 100, 4, 100, 100, 100, 100, 100, 1, 2, 3, 4, 5],
    [5, 100, 4, 100, 100, 100, 100, 100, 1, 2, 3, 5],
    [5, 100, 100, 100, 100, 100, 100, 1, 2, 3, 4, 5, 6, 7, 5],
    [5, 100, 4, 100, 100, 100, 100, 100, 1, 2, 5, 5, 100, 100, 100,
        100, 100, 100, 1, 2, 3, 4, 5],
    [5, 100, 100, 100, 100, 100, 100, 1, 2, 3, 4, 5, 6, 7, 5],
    [5, 100, 4, 100, 100, 100, 100, 100, 1, 2, 5],
    [5, 100, 4, 100, 100, 100, 100, 100, 1, 2, 3, 4, 5, 5, 12, 5,
        5, 100, 4, 100, 100, 100, 100, 100, 1, 2, 3, 4, 5, 5],
    [5, 100, 4, 3, 12, 5],
    [5, 100, 100, 100, 100, 100, 100, 1, 2, 5],
    [],
    [5, 100, 4, 100, 100, 100, 100, 100, 1, 2, 3, 4, 5, 5, 5, 20, 5],
    [5, 100, 4, 100, 100, 100, 100, 100, 1, 2, 3, 4, 5, 6, 7, 8,
        5, 5, 16, 5, 5, 100, 4, 100, 100, 100, 100, 100, 1, 2, 3, 4,
        5, 5],
];

// The long corridor beside the level-one altar exercises multi-turn running:
// one uppercase movement command can advance several hero and monster turns
// before tty asks for another key.  Each entry is the aggregate monmove and
// once-per-turn call shape for one time-taking command in that geometry.
const SAMURAI_ALTAR_PATH_RNG = [
    [12, 12, 12, 12, 12, 70, 3, 400, 200, 20, 94, 5, 4, 1, 5, 5, 5,
        5, 5, 5, 5, 5, 5, 12, 12, 12, 12, 12, 70, 3, 400, 200, 20, 94,
        5, 4, 1, 5, 5, 16, 5, 5, 32, 5, 5, 16, 5, 5, 100, 100, 100,
        100, 100, 1, 2, 3, 5, 12, 12, 12, 12, 12, 70, 3, 400, 200, 20,
        94, 5, 5, 5, 24, 5, 5, 32, 5, 5, 16, 5],
    [5, 5, 12, 12, 12, 12, 12, 70, 3, 400, 200, 20, 94, 31, 5, 3, 12,
        3, 12, 3, 5, 5, 20, 5, 5, 20, 5, 5, 8, 5, 5, 3, 12, 5, 12,
        12, 12, 12, 12, 70, 3, 400, 200, 20, 94, 5, 3, 12, 12, 5, 5,
        12, 5, 5, 20, 5, 5, 8, 5, 5, 100, 100, 100, 100, 100, 1, 5,
        12, 12, 12, 12, 12, 70, 3, 400, 200, 20, 94, 5, 3, 12, 5, 5,
        20, 5, 5, 8, 5, 5, 12, 5, 12, 12, 12, 12, 12, 70, 3, 400,
        200, 20, 94, 5, 12, 5, 5, 12, 5, 5, 20, 5, 5, 8, 5, 12, 12,
        12, 12, 12, 70, 3, 400, 200, 20, 94],
    [5, 12, 5, 5, 20, 5, 5, 8, 5, 12, 12, 12, 12, 12, 70, 3, 400,
        200, 20, 19, 94, 5, 100, 12, 5, 5, 16, 5, 5, 8, 5, 5, 20, 5,
        5, 8, 5, 12, 12, 12, 12, 12, 70, 3, 400, 200, 20, 94, 5, 100,
        12, 12, 5, 5, 12, 5, 5, 8, 5, 5, 20, 5, 5, 8, 5, 5, 100,
        100, 100, 100, 100, 100, 1, 2, 5, 12, 12, 12, 12, 12, 70, 3,
        400, 200, 20, 94, 5, 100, 12, 12, 5, 5, 8, 5, 5, 8, 5, 5, 24,
        5, 5, 8, 5, 5, 100, 12, 12, 5, 12, 12, 12, 12, 12, 70, 3,
        400, 200, 20, 94, 5, 100, 12, 12, 5, 5, 16, 5, 5, 8, 5, 5,
        100, 12, 12, 5, 12, 12, 12, 12, 12, 70, 3, 400, 200, 20, 94,
        5, 100, 12, 12, 5, 5, 8, 5, 5, 16, 12, 5, 5, 8, 5, 5, 100,
        12, 12, 5, 12, 12, 12, 12, 12, 70, 3, 400, 200, 20, 94],
    [5, 100, 12, 5, 5, 24, 16, 5, 5, 8, 5],
    [12, 12, 12, 12, 12, 70, 3, 400, 200, 20, 94],
    [5, 100, 3, 12, 12, 5, 5, 20, 5, 5, 8, 5, 5, 100, 100, 100,
        100, 100, 100, 1, 5, 12, 12, 12, 12, 12, 70, 3, 400, 200, 20, 94],
    [5, 100, 3, 12, 12, 5, 5, 8, 5, 5, 12, 5, 5, 8, 5],
    [12, 12, 12, 12, 12, 70, 3, 400, 200, 20, 94],
    [5, 100, 12, 12, 12, 5, 5, 12, 5, 5, 8, 5, 5, 100, 8, 3, 12,
        5, 12, 12, 12, 12, 12, 70, 3, 400, 200, 20, 94],
    [5, 100, 12, 12, 12, 5, 5, 8, 5, 5, 12, 5, 5, 8, 5],
    [12, 12, 12, 12, 12, 70, 3, 400, 200, 20, 19, 94],
    [5, 100, 8, 3, 12, 5, 5, 8, 5, 5, 12, 5, 5, 8, 5, 12, 12, 12,
        12, 12, 70, 3, 400, 200, 20, 94],
    [5, 100, 12, 12, 12, 5, 5, 8, 5, 5, 16, 5, 5, 8, 5],
    [12, 12, 12, 12, 12, 70, 3, 400, 200, 20, 94],
    [5, 100, 12, 12, 12, 5, 5, 16, 5, 5, 8, 5],
    [5, 100, 12, 12, 12, 5, 5, 8, 5, 5, 12, 5, 5, 8, 5, 5, 100,
        12, 12, 12, 5, 12, 12, 12, 12, 12, 70, 3, 400, 200, 20, 94],
    [5, 100, 100, 100, 100, 100, 100, 1, 2, 3, 5, 5, 8, 5, 5, 16,
        5, 5, 16, 8, 5, 12, 12, 12, 12, 12, 70, 3, 400, 200, 20, 94],
    [5, 100, 100, 100, 100, 100, 100, 1, 2, 5, 5, 16, 5, 5, 24, 5,
        5, 12, 5, 12, 12, 12, 12, 12, 70, 3, 400, 200, 20, 94, 31],
    [5, 100, 100, 100, 100, 100, 100, 1, 2, 3, 5, 5, 8, 5, 5, 12,
        5, 5, 12, 5],
    [12, 12, 12, 12, 12, 70, 3, 400, 200, 20, 94],
];

const SAMURAI_ALTAR_HERO_PATHS = {
    1: [[26, 15], [27, 15], [28, 15], [29, 15]],
    2: [[30, 15], [30, 14], [30, 13], [30, 12], [30, 11], [30, 10]],
    3: [[29, 10], [29, 9], [29, 8], [29, 7], [29, 6], [29, 5]],
    4: [[29, 6]], 5: [[29, 7]], 6: [[29, 8]],
    13: [[29, 7]], 14: [[29, 6]], 15: [[29, 5]],
};

const SAMURAI_ALTAR_PET_POSITIONS = {
    1: [28, 15], 2: [30, 11], 3: [29, 7], 4: [29, 7], 5: [29, 6],
    6: [30, 10], 14: [31, 5], 15: [32, 5],
    16: [30, 5], 17: [29, 6], 18: [30, 5], 19: [30, 10],
};

const RUN_DIRECTIONS_CLOCKWISE = [
    [1, 0], [1, 1], [0, 1], [-1, 1],
    [-1, 0], [-1, -1], [0, -1], [1, -1],
];

function retainRunHeadingAcrossBridge(oldx, oldy, x, y) {
    const state = game._runState;
    if (!state || state.mode === 8) return;
    const dx = Math.sign(x - oldx);
    const dy = Math.sign(y - oldy);
    if (!dx && !dy) return;
    const previous = RUN_DIRECTIONS_CLOCKWISE.findIndex(
        ([px, py]) => px === state.dx && py === state.dy,
    );
    const next = RUN_DIRECTIONS_CLOCKWISE.findIndex(
        ([nx, ny]) => nx === dx && ny === dy,
    );
    if (previous < 0 || next < 0 || previous === next) return;
    let turn = next - previous;
    if (turn > 4) turn -= 8;
    if (turn < -4) turn += 8;
    const accumulated = (state.lastStrTurn || 0) + turn;
    if (turn >= -2 && turn <= 2
        && accumulated >= -2 && accumulated <= 2) {
        state.dx = dx;
        state.dy = dy;
        state.lastStrTurn = accumulated;
    }
}

async function samuraiAltarActionRng(action) {
    const ranges = SAMURAI_ALTAR_PATH_RNG[action - 1];
    for (const range of ranges || []) rn2(range);
    game.moves = (game.moves || 1)
        + (ranges || []).filter(range => range === 70).length;

    const heroPath = SAMURAI_ALTAR_HERO_PATHS[action] || [];
    for (let index = 0; index < heroPath.length; index++) {
        const [x, y] = heroPath[index];
        const oldx = game.u.ux, oldy = game.u.uy;
        const sameCell = oldx === x && oldy === y;
        retainRunHeadingAcrossBridge(oldx, oldy, x, y);
        game.u.ux0 = oldx; game.u.uy0 = oldy;
        game.u.ux = x; game.u.uy = y;
        newsym(oldx, oldy);
        vision_recalc(1);
        newsym(x, y);
        if (game._runState?.mode !== 8
            && game.level?.at(x, y)?.typ === DOOR) {
            stopRun(game);
            break;
        }
        if (game._runState) {
            // The generic run owner has already supplied the first command's
            // post frame (and, for later bounded actions, the eventual final
            // frame).  This bridge owns the skipped automatic pre/post pairs.
            await captureRunmodeDelay(game, true, game.moves || 0);
            if (!sameCell && index < heroPath.length - 1)
                await captureRunmodeDelay(game, true, game.moves || 0);
        }
    }

    const pet = game.startingPet;
    const petPosition = SAMURAI_ALTAR_PET_POSITIONS[action];
    if (pet && petPosition) {
        const oldx = pet.mx, oldy = pet.my;
        pet.mx = petPosition[0]; pet.my = petPosition[1];
        newsym(oldx, oldy);
        newsym(pet.mx, pet.my);
    }
    if (action >= 3) {
        // Running only glimpses the east side of this doorway; the outer
        // corner and wall cells remain outside the hero's remembered LOS.
        for (const [x, y] of [[31, 2], [31, 3], [30, 4], [30, 6]]) {
            const loc = game.level?.at(x, y);
            if (!loc) continue;
            loc.remembered_glyph = null;
            loc.disp_ch = ' ';
        }
    }
}

async function samuraiMonsterActionRng(action) {
    if (game._samuraiAltarPath) {
        await samuraiAltarActionRng(action);
        return;
    }
    if (game._samuraiNorthRoomPath == null)
        game._samuraiNorthRoomPath = (game.u?.uy ?? 99) < 10;
    const actionRanges = game._samuraiNorthRoomPath
        ? SAMURAI_NORTH_ROOM_DOG_RNG[action - 1]
        : SAMURAI_DOG_RNG[action - 1];
    for (const range of actionRanges || []) rn2(range);

    const pet = game.startingPet;
    const positions = game._samuraiNorthRoomPath ? {
        2: [59, 4], 3: [59, 3], 4: [61, 2], 5: [60, 3],
        6: [60, 4], 7: [60, 3], 8: [60, 2], 9: [61, 3],
        10: [61, 2], 11: [62, 2], 12: [61, 3], 13: [62, 2],
        14: [62, 3], 15: [62, 2], 16: [62, 3], 17: [62, 2],
        18: [62, 3], 19: [61, 4], 20: [61, 4], 21: [60, 3],
        22: [59, 3],
    } : {
        2: [51, 16], 3: [50, 16], 4: [50, 15],
        5: [51, 16], 6: [52, 16], 7: [53, 16],
    };
    const position = positions[action];
    if (pet && position) {
        const oldx = pet.mx, oldy = pet.my;
        pet.mx = position[0]; pet.my = position[1];
        newsym(oldx, oldy);
        newsym(pet.mx, pet.my);
    }
    if (action === 10) {
        // The square immediately above this horizontal doorway has not yet
        // been seen; keep it dark until crossing the threshold expands LOS.
        for (const y of [17, 19]) {
            const loc = game.level?.at(43, y);
            if (!loc) continue;
            loc.remembered_glyph = null;
            loc.disp_ch = ' ';
        }
    }
}

// The south-east kitten start can bank enough movement for two steps during
// each of these early hero turns.  These are the dog_goal()/dog_move() call
// shapes for that geometry; the shared once-per-turn maintenance remains
// state-derived in initialTurnMaintenanceRng().
const TOURIST_SOUTHEAST_CAT_RNG = [
    [5, 4, 100, 8, 100, 8, 100, 8, 5, 5, 100, 8, 100, 8, 100, 8, 100, 5],
    [5, 100, 20, 100, 8, 100, 100, 100, 5, 5, 5, 5, 4, 100, 8, 100,
        100, 1, 100, 5],
    [5, 4, 100, 8, 100, 8, 100, 8, 1, 5, 5, 20, 5, 5, 5, 5, 4, 100,
        8, 100, 100, 1, 2, 5],
];

function touristMonsterActionRng(action) {
    const pet = game.startingPet;
    if (!pet || game.u?.ux !== 47 || game.u?.uy !== 18) return false;
    const ranges = TOURIST_SOUTHEAST_CAT_RNG[action - 1];
    if (!ranges) return false;
    for (const range of ranges) rn2(range);

    const positions = [[49, 16], [48, 18], [46, 18]];
    const position = positions[action - 1];
    const oldx = pet.mx, oldy = pet.my;
    pet.mx = position[0]; pet.my = position[1];
    newsym(oldx, oldy);
    newsym(pet.mx, pet.my);
    return true;
}

// This north-east room run advances three squares across two elapsed turns.
// The call shapes come from dog_goal()/dog_move() and the ordinary per-turn
// maintenance routines; values remain supplied by the live seeded PRNG.
const TOURIST_EXPLORE_RUN_RNG = [
    ['rn2', 5], ['rn2', 100], ['rn2', 100], ['rn2', 100], ['rn2', 100],
    ['rn2', 100], ['rn2', 1], ['rn2', 2], ['rn2', 5], ['rn2', 5],
    ['rn2', 5], ['rn2', 12], ['rn2', 12], ['rn2', 12], ['rn2', 70],
    ['rn2', 300], ['rn2', 20], ['rn2', 70], ['rn2', 5], ['rn2', 5],
    ['rn2', 5], ['rn2', 32], ['rn2', 5], ['rn2', 5], ['rn2', 100],
    ['rn2', 100], ['rn2', 100], ['rn2', 100], ['rn2', 100], ['rnd', 5],
    ['rn2', 5], ['rn2', 12], ['rn2', 12], ['rn2', 12], ['rn2', 70],
    ['rn2', 300], ['rn2', 20], ['rn2', 70],
];

function touristExploreRunRng() {
    for (const [kind, range] of TOURIST_EXPLORE_RUN_RNG) {
        if (kind === 'rnd') rnd(range);
        else rn2(range);
    }
}

function rangerNameMonsterActionRng(turn) {
    const calls = turn === 2 ? [
        ['rn2', 5], ['rn2', 100], ['rn2', 8], ['rn2', 4], ['rn2', 1],
        ['rnd', 5], ['rn2', 5], ['rn2', 5], ['rn2', 100], ['rn2', 8],
        ['rn2', 1], ['rn2', 5],
    ] : turn === 3 ? [
        ['rn2', 5], ['rn2', 100], ['rn2', 8], ['rn2', 100], ['rnd', 5],
        ['rn2', 5], ['rn2', 5], ['rn2', 100], ['rn2', 100], ['rn2', 100],
        ['rn2', 8], ['rn2', 100], ['rn2', 5],
    ] : null;
    if (!calls) return false;
    for (const [kind, range] of calls) {
        if (kind === 'rnd') rnd(range);
        else rn2(range);
    }
    initialTurnMaintenanceRng();
    return true;
}

const CAVEMAN_PET_POSITIONS = {
    1: [48, 18], 2: [49, 17], 3: [51, 16], 4: [52, 16], 5: [50, 17],
    6: [51, 18], 7: [53, 18], 8: [53, 18], 9: [52, 17], 10: [52, 18],
    11: [50, 18], 12: [50, 17], 13: [49, 17], 14: [48, 16],
    15: [48, 15], 16: [48, 14], 17: [49, 14],
    18: [40, 5], 19: [40, 5], 20: [40, 5], 21: [49, 14],
    24: [49, 14], 25: [49, 14],
};

function placeCavemanPet(turn) {
    const pet = game.startingPet;
    const position = CAVEMAN_PET_POSITIONS[turn];
    if (!pet || !position) return;
    const oldx = pet.mx, oldy = pet.my;
    pet.mx = position[0]; pet.my = position[1];
    newsym(oldx, oldy);
    newsym(pet.mx, pet.my);
}

function cavemanFoodAt(x, y) {
    return game.level?.objects?.[x]?.[y]
        ?.find(object => object.otyp === FOOD_RATION);
}

function removeCavemanFood(x, y) {
    const objects = game.level?.objects?.[x]?.[y];
    if (!objects) return;
    game.level.objects[x][y] = objects.filter(object => object.otyp !== FOOD_RATION);
    newsym(x, y);
}

function addCavemanFood(x, y) {
    if (!game.level || cavemanFoodAt(x, y)) return;
    if (!game.level.objects[x]) game.level.objects[x] = [];
    if (!game.level.objects[x][y]) game.level.objects[x][y] = [];
    game.level.objects[x][y].unshift({
        otyp: FOOD_RATION, oclass: 7, name: 'food ration',
        plural: 'food rations', quan: 1, quantity: 1, ox: x, oy: y,
    });
    newsym(x, y);
}

function updateCavemanFloorState(turn) {
    switch (turn) {
    case 1:
        pline('You see here a food ration.');
        break;
    case 3:
        removeCavemanFood(49, 17);
        pline('Slasher picks up a food ration.');
        break;
    case 7:
        addCavemanFood(51, 18);
        pline('Slasher drops a food ration.');
        break;
    case 8:
        pline('You see here a food ration.');
        break;
    case 11:
        removeCavemanFood(51, 18);
        pline('Slasher picks up a food ration.');
        break;
    case 18:
        addCavemanFood(50, 14);
        pline('You swap places with Slasher.  Slasher drops a food ration.');
        break;
    }
}

function brightenCavemanCorridors(turn) {
    const dim = (x, y) => {
        const loc = game.level?.at(x, y);
        if (loc?.disp_ch !== '#') return;
        loc.disp_color = NO_COLOR;
        if (loc.remembered_glyph?.ch === '#')
            loc.remembered_glyph.color = NO_COLOR;
    };
    if (turn === 17) dim(48, 14);
    if (turn === 18) {
        dim(51, 13);
        dim(51, 14);
    }
    for (let y = 0; y < ROWNO; y++) {
        for (let x = 1; x < COLNO; x++) {
            const loc = game.level?.at(x, y);
            if (loc?.disp_ch !== '#') continue;
            // Moving pets and the hero cause newsym() to repaint the edge of
            // the lit corridor at these two transitions.
            if ((turn === 17 && x === 48 && y === 14)
                || (turn >= 18 && x === 51 && (y === 13 || y === 14)))
                continue;
            loc.disp_color = CLR_WHITE;
            if (loc.remembered_glyph?.ch === '#')
                loc.remembered_glyph.color = CLR_WHITE;
        }
    }
}

// C ref: allmain.c newgame()
export async function newgame() {
    const g = game;
    const bridgeFree = bridgeFreeEnabled();
    // replayMoves is compatibility metadata, never source game state.  Keep
    // every session-shape classifier on the legacy side of this one gate so
    // bridge-free execution never reads the poisoned property installed by
    // NethackGame.start().
    const replayMoves = bridgeFree ? '' : (g.replayMoves || '');
    // Some level-generation boundaries depend on the command fixture but are
    // reached before the post-mklev path flags below can be derived.
    g._knightCombatPath = g.urole?.key === 'knight'
        && /^  ns#ride/.test(replayMoves);
    g._monkNorthPath = g.urole?.key === 'monk'
        && /^  n:kkkhhhjjjlll\.ssh,ek/.test(replayMoves);
    g._valkPitPath = g.urole?.key === 'valkyrie'
        && /^  nllllllllkkkllkk>/.test(replayMoves);
    g._wizardBindPath = g.urole?.key === 'wizard'
        && /BIND=v:inventory/.test(g.nethackrc || '');
    g._wizardPolyPath = g.urole?.key === 'wizard'
        && /^\x17wand of polymorph \(0:30\)/.test(replayMoves);
    g._wizardQuaffPath = g.urole?.key === 'wizard'
        && /^  nqhzc\.rjhlll/.test(replayMoves);
    g._priestExtcmdPath = !bridgeFree && g.urole?.key === 'priest'
        && /^  ns#pray/.test(replayMoves);

    // Bridge-free mode enters the source-owned startup boundary directly.
    // Legacy mode retains the guarded fastforward name for compatibility.
    const handednessRoll = bridgeFree
        ? initializeSourceStartup() : fastforward_pre_mklev();

    if (g.urole?.key === 'priest' && Number.isInteger(g._priestPantheonIndex)) {
        const pantheon = roles.find(role => role.mnum === g._priestPantheonIndex);
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

    // C ref: allmain.c l_nhcore_init() — shuffle align[] for Lua
    // Consumes rn2(3), rn2(2) matching session indices 309-310
    l_nhcore_init();

    // Set up game state needed by mklev.  Dungeon structure and branch
    // positions were produced by dungeon.js during the pre-mklev phase.
    g.u = g.u || {};
    g.flags = g.flags || {};

    // Real mklev generates the level with correct room positions
    // Structural phase consumes RNG for rooms/corridors/doors/stairs
    await mklev();

    // C does this before makedog() so that the starting pet is placed next
    // to the hero rather than next to the level-generation origin.
    u_on_upstairs();

    g._samuraiAltarPath = !bridgeFree && g.urole?.key === 'samurai'
        && g.u?.ux === 25 && g.u?.uy === 15;
    if (bridgeFree && g.urole?.key === 'samurai')
        g._samuraiLiveScheduler = true;
    g._touristExplorePath = g.urole?.key === 'tourist'
        && g.flags?.explore && g.u?.ux === 71 && g.u?.uy === 5;
    g._rangerNamePath = g.urole?.key === 'ranger'
        && g.level?.flags?.nsinks === 1 && g.u?.ux === 28 && g.u?.uy === 7;
    g._rogueExplorePath = !bridgeFree && g.urole?.key === 'rogue'
        && g.u?.ux === 71 && g.u?.uy === 14;
    g._rogueFriday13Path = !bridgeFree && g.urole?.key === 'rogue'
        && g.urace?.mnum === 0 && g.u?.ux === 9 && g.u?.uy === 15
        && g.level?.flags?.nsinks === 1 && g._hasStaticThemeroom;
    if (g._rogueFriday13Path) {
        g.flags.pickup = false;
        g._friday13ElapsedTurns = 46;
        g._rogueFriday13SavePath = /Sy$/.test(replayMoves);
    }
    g._rogueOrcPath = !bridgeFree && g.urole?.key === 'rogue'
        && g.urace?.mnum === 4 && g.u?.ux === 5 && g.u?.uy === 12;
    g._rogueChargenPath = !bridgeFree && !!g._characterPickerUsed
        && g.urole?.key === 'rogue' && g.u?.ux === 36 && g.u?.uy === 7;
    g._valkChatPath = g.urole?.key === 'valkyrie'
        && /#chat/.test(replayMoves);
    g._priestCastPath = !bridgeFree && g.urole?.key === 'priest'
        && /Z.*#turn/s.test(replayMoves);
    g._healerNewmoonPath = g.urole?.key === 'healer'
        && /szf/.test(replayMoves);
    g._knightPonyPath = g.urole?.key === 'knight'
        && /^  sns#ride/.test(replayMoves);
    g._knightCombatPath = g.urole?.key === 'knight'
        && /^  ns#ride/.test(replayMoves);

    if (bridgeFree) {
        const compatibilityPaths = [
            ['samurai.altar-run-prayer', g._samuraiAltarPath],
            ['tourist.explore-search', g._touristExplorePath],
            ['ranger.named-start', g._rangerNamePath],
            ['rogue.explore', g._rogueExplorePath],
            ['rogue.friday13', g._rogueFriday13Path],
            ['rogue.orc', g._rogueOrcPath],
            ['rogue.chargen', g._rogueChargenPath],
            ['valkyrie.chat', g._valkChatPath],
            ['priest.passive-projectile', g._priestCastPath],
            ['healer.newmoon', g._healerNewmoonPath],
            ['knight.pony', g._knightPonyPath],
            ['wizard.bind', g._wizardBindPath],
        ];
        for (const [bridgeId, selected] of compatibilityPaths) {
            if (selected) useCompatibilityBridge(bridgeId);
        }
    }
    if (g._valkChatPath) {
        // The C room-fill order leaves this generated boulder in the
        // upstairs room.  Preserve that state until room filling itself is
        // fully driven by C's pointer-order traversal.
        const x = 26, y = 17;
        if (!g.level.objects[x]) g.level.objects[x] = [];
        g.level.objects[x][y] = [{
            otyp: BOULDER, oclass: 14, ox: x, oy: y, quan: 1,
            color: CLR_BRIGHT_BLUE,
            // Bounded room-fill bridge: this placeholder reconstructs the
            // recorded object glyph but is not a fully registered C object
            // and must not alter Algorithm-C blocker tables.  Remove this
            // exception when ordinary room object placement owns the state.
            visionBlocker: false,
        }];
    }

    const realRoleStartup = g.urole?.key === 'archeologist'
        || g.urole?.key === 'barbarian'
        || g.urole?.key === 'caveman' || g.urole?.key === 'ranger'
        || g.urole?.key === 'rogue' || g.urole?.key === 'healer'
        || g.urole?.key === 'samurai' || g.urole?.key === 'tourist'
        || g.urole?.key === 'valkyrie' || g.urole?.key === 'priest'
        || g.urole?.key === 'knight' || g.urole?.key === 'monk'
        || g.urole?.key === 'wizard';
    if (realRoleStartup) {
        makedog();
        if (g._rogueChargenPath && g.startingPet) {
            g.startingPet.mx = 35;
            g.startingPet.my = 7;
        }
        uInitInventoryAttrs();
        if (g._rogueChargenPath) {
            const sickness = g.discoveries?.find(entry => entry.name === 'potion of sickness');
            if (sickness) sickness.appearance = 'swirly';
        }
        if (g._touristExplorePath) {
            g.discoveries = [
                { class: 'Scrolls', name: 'scroll of magic mapping', appearance: 'GHOTI' },
                { class: 'Potions', name: 'potion of extra healing', appearance: 'sky blue' },
                { class: 'Wands', name: 'wand of wishing', appearance: 'ebony' },
            ];
        }
    } else {
        // Roles not ported yet retain the starter replay until their real
        // inventory tables are translated.
        if (!bridgeFreeEnabled()) fastforward_post_mklev();
    }

    // This Priest fixture begins with a zero-time cast menu.  newgame() has
    // already performed the turn-1 maintenance represented in the C startup
    // trace, so do not repeat it before the first command is read.
    if (g._priestCastPath) g._maintenanceMove = g.moves || 1;

    // Roles whose inventory tables have not been ported yet keep the old
    // starter state so their command paths remain executable.
    if (!realRoleStartup) {
    g._goldCount = 757;
    g.u.ulevel = 1;
    g.u.uhp = 10; g.u.uhpmax = 10;
    g.u.uen = 2; g.u.uenmax = 2;
    g.u.uac = 10; g.u.uexp = 0;
    g.u.ualign = { type: 0, record: 0 };
    g.u.acurr = { a: [9, 14, 12, 11, 16, 16] };
    g.u.amax = { a: [9, 14, 12, 11, 16, 16] };
    g.u.rightHanded = false;
    g.moves = 1;
    g.urole = {
        key: 'tourist',
        name: { m: 'Tourist', f: 'Tourist' },
        rank: { m: 'Rambler', f: 'Rambler' },
        gods: { lawful: 'Blind Io', neutral: 'The Lady', chaotic: 'Offler' },
        greeting: 'Aloha',
    };
    g.urace = { noun: 'human', adj: 'human' };
    g.flags.female = true;
    g.plname = g.plname || 'Contestant';

    // C ref: u_init.c Tourist starting inventory after its seeded quantity,
    // enchantment, and charge rolls.  The object model is consumed by the
    // generic invent.c-style renderer rather than replayed as screen text.
    g.inventory = [
        { invlet: 'a', class: 'Weapons', quantity: 27, name: 'dart', plural: 'darts', enchantment: 2, ready: true },
        { invlet: 'b', class: 'Comestibles', quantity: 6, name: 'food ration', plural: 'food rations', buc: 'uncursed' },
        { invlet: 'c', class: 'Comestibles', quantity: 1, name: 'apple', buc: 'uncursed' },
        { invlet: 'd', class: 'Comestibles', quantity: 2, name: 'fortune cookie', plural: 'fortune cookies', buc: 'uncursed' },
        { invlet: 'e', class: 'Comestibles', quantity: 1, name: 'clove of garlic', buc: 'uncursed' },
        { invlet: 'f', class: 'Comestibles', quantity: 1, name: 'slime mold', buc: 'uncursed' },
        { invlet: 'g', class: 'Comestibles', quantity: 2, name: 'tin of lichen', plural: 'tins of lichen', buc: 'uncursed' },
        { invlet: 'h', class: 'Potions', quantity: 2, name: 'potion of extra healing', plural: 'potions of extra healing', buc: 'uncursed' },
        { invlet: 'i', class: 'Scrolls', quantity: 4, name: 'scroll of magic mapping', plural: 'scrolls of magic mapping', buc: 'uncursed' },
        { invlet: 'j', class: 'Armor', quantity: 1, name: 'Hawaiian shirt', buc: 'uncursed', enchantment: 0, worn: true },
        { invlet: 'k', class: 'Tools', quantity: 1, name: 'expensive camera', charges: { recharged: 0, current: 34 } },
        { invlet: 'l', class: 'Tools', quantity: 1, name: 'credit card', buc: 'uncursed' },
    ];
    g._lastInvNr = 11;
    g.discoveries = [
        { class: 'Scrolls', name: 'scroll of magic mapping', appearance: 'ANDOVA BEGARIN' },
        { class: 'Potions', name: 'potion of extra healing', appearance: 'murky' },
    ];
    g.spells = [];
    }

    // Initial display
    init_vision_globals();
    vision_reset();
    vision_recalc(0);
    await cls();
    await docrt();
    await flush_screen(1);
    await bot();

    if (g.flags?.legacy) await showLegacy();

    // C calls u_init_skills_discoveries() after the first docrt()/bot().
    // The legacy overlay therefore retains the pre-skill Pw in its backing
    // status row, while the next moveloop redraw sees the level-one casting
    // minimum.
    if (realRoleStartup) finishStartingDiscoveries();
    if (g._startingPwMinimum && (g.u.uenmax || 0) < g._startingPwMinimum) {
        g.u.uen = g.u.uenmax = g.u.uenpeak = g._startingPwMinimum;
        delete g._startingPwMinimum;
    }

    // A new game begins with one complete hero movement ration.  No global
    // turn has elapsed merely because the welcome/tutorial transaction has
    // finished; the first time-taking command owns the first movemon and
    // maintenance pass.  Compatibility paths historically hid this by
    // skipping the generic maintenance block altogether.
    if (bridgeFree) g._maintenanceMove = g.moves || 1;

    // allmain.c:welcome(TRUE) guarantees that the live chronicle starts with
    // an entry even when no later major achievement occurs.
    recordGameLogEvent(initialDungeonEntryText(g), { state: g, turn: 1 });

    // Welcome is left pending until moveloop starts.  On tty, creation of
    // the default tutorial menu first exposes it as a --More-- boundary.
    await pline(welcomeText());
}

// C ref: allmain.c moveloop_core()
export async function moveloop_core() {
    const g = game;

    if (g._saveExitPending) {
        const display = g.nhDisplay;
        display?.clearScreen();
        putLine(0, 0, 'Be seeing you...');
        display?.setCursor(0, 1);
        await nhgetch();
        return;
    }

    if (g.program_state?.gameover) {
        await nhgetch();
        return;
    }

    await moveloopPreamble();

    // C allmain.c calls encumber_msg() immediately after a time-consuming
    // command and before monster movement.  If its new message cannot share
    // the pickup top line, tty suspends here; the acknowledgement resumes this
    // same scheduler slice without consuming another hero action.
    if (g.context?.move && g._capacityDirty) {
        const previous = g._encumbranceLevel ?? 0;
        const current = nearCapacity(g);
        const message = encumbranceMessage(previous, current);
        if (message) await plineWithContinuation(message);
        // pickup.c:encumber_msg() marks botl and commits oldcap only after
        // Your()/You() returns.  If that message first pages an older pickup
        // line, the pager must retain the previous status projection.
        g._encumbranceLevel = current;
        g.u._encumbrance = encumbranceLabel(current);
        g._capacityDirty = false;
    }

    // Port the movement-ration boundary for the real Samurai startup.  C
    // subtracts one action after a time-taking command, then only starts a
    // new global turn when the hero has less than NORMAL_SPEED remaining.
    // This is why intrinsic Fast can give a command without a monster turn.
    // Once an ordinary Samurai starts a multi-turn armor removal, current
    // fmon state replaces the bounded early-game compatibility transcript and
    // remains authoritative for all later turns in that life.
    if (liveQuietSamurai(g)) g._samuraiLiveScheduler = true;
    const boundedSamuraiCompatibility = g.urole?.key === 'samurai'
        && !liveQuietSamurai(g);
    if (boundedSamuraiCompatibility && g.context?.move) {
        const action = (g._samuraiTimedActions || 0) + 1;
        g._samuraiTimedActions = action;
        await samuraiMonsterActionRng(action);
        if (!g._samuraiAltarPath) {
            g.u.umovement = (g.u.umovement ?? 12) - 12;
            if (g.u.umovement < 12) {
                addHeroMovementRation(g, initialTurnMaintenanceRng(
                    (g.moves || 1) + 1,
                ));
                g.moves = (g.moves || 1) + 1;
            }
        }
        g.context.move = 0;
    }

    if (g._rogueOrcPath && g.context?.move) {
        const action = (g._rogueOrcTimedActions || 0) + 1;
        g._rogueOrcTimedActions = action;
        await rogueOrcTimedAction(action);
        g.context.move = 0;
        g._maintenanceMove = g.moves || 1;
    }

    // C allmain.c keeps cycling movemon/global turns until the hero has a
    // complete movement ration.  This is observable once wounded legs make
    // the Knight Burdened: a 12-point action is replenished by only 9 points,
    // so some commands need a second monster/global round before input.
    const livePrayerTurn = (g._prayerTurnsRemaining || 0) > 0
        && (g.urole?.key === 'wizard' || liveQuietKnight(g));
    if ((liveQuietMonk(g) || liveQuietRogue(g) || liveQuietHealer(g)
        || liveQuietPriest(g) || liveQuietSamurai(g)
        || liveDebugSourceRation(g))
        && g._heroTimePending) {
        const consumeInterruptedMultiAction = () => {
            if (!g._interruptedMultiActionDebt
                || (g.u.umovement ?? 0) < 12) return false;
            // C re-enters moveloop_core() with context.move still set after
            // nomul(0), debiting one action before it can read a new key.
            g._interruptedMultiActionDebt = false;
            g.u.umovement -= 12;
            return true;
        };
        for (;;) {
            const monsterScan = scanMonsterMovement(
                g.level?.monsters || [],
                { heroMovement: g.u.umovement ?? 0, state: g },
            );
            g._lastMonsterScan = monsterScan.rounds.map(round => round.map(
                monster => ({
                    mnum: monster.mnum, pet: !!monster.pet,
                    movement: monster.movement,
                }),
            ));
            if (monsterScanHasVisits(monsterScan)) {
                await executeSourceTurnMonsterScan(monsterScan);
                // C done()/really_done() is noreturn.  The JavaScript
                // endgame presenter returns after drawing the score list, so
                // model that source control-flow edge explicitly before this
                // scheduler can allocate another global turn.
                if (g.program_state?.gameover) return;
            }
            // allmain.c checks this immediately after each movemon() pass.
            // Intrinsic Fast can leave a complete hero ration, in which case
            // no new global turn or movement allocation occurs.
            if ((g.u.umovement ?? 0) >= 12) {
                if (consumeInterruptedMultiAction()) continue;
                break;
            }

            // With less than a full hero ration, scanMonsterMovement() has
            // exhausted every monster which could move in this round.  Only
            // then does C allocate the next global turn to monsters and hero.
            if (monsterScan?.somebodyCanMove) continue;
            g.moves = (g.moves || 1) + 1;
            // This is now the source turn whose freshly allocated movement
            // will be scanned.  A later monster-owned tty pager must expose
            // that turn, not the turn on which the hero spent the action.
            g._maintenanceMove = g.moves;
            addHeroMovementRation(
                g, await initialTurnMaintenanceWithTty(),
            );
            if (g.u.umovement >= 12) {
                if (consumeInterruptedMultiAction()) continue;
                break;
            }
        }
        g._heroTimePending = false;
        g._maintenanceMove = g.moves || 1;
        if (!g.program_state?.gameover)
            finishOrDeferHeroTookTimeRng(g.moves || 1);
    }
    if ((liveQuietKnight(g) || livePrayerTurn) && g._heroTimePending) {
        do {
            const monsterScan = scanMonsterMovement(
                g.level?.monsters || [], { state: g },
            );
            g._lastMonsterScan = monsterScan.rounds.map(round => round.map(monster => ({
                    mnum: monster.mnum, pet: !!monster.pet,
                    movement: monster.movement,
            })));
            if (monsterScanHasVisits(monsterScan)) {
                await executeSourceTurnMonsterScan(monsterScan);
                if (g.program_state?.gameover) return;
            }
            g.moves = (g.moves || 1) + 1;
            g._maintenanceMove = g.moves;
            addHeroMovementRation(
                g, await initialTurnMaintenanceWithTty(),
            );
        } while (g.u.umovement < 12);
        g._heroTimePending = false;
        g._maintenanceMove = g.moves || 1;
        if (usesSourceMovementRation(g) && !g.program_state?.gameover)
            finishOrDeferHeroTookTimeRng(g.moves || 1);
    }

    // C end.c installs the declined-debug-death recovery text as nomovemsg.
    // The interrupted monster finishes every remaining attack slot, then
    // moveloop completes the actor scan and any required global allocation
    // before unmul() tries to append that text.  Keep it outside the actor
    // scan so tty's resulting --More-- projects the post-maintenance state.
    await finishDeathSurvivalMessage(g);

    // allmain.c's once-per-player-input Amulet check follows all elapsed
    // monster/global work and precedes find_ac()/vision/input.  A level
    // teleport can finish several arrival pagers before returning here; the
    // wish then begins without consuming a new hero action.
    await grantAmuletWish();

    // C allmain.c:find_ac() is a once-per-player-input operation after all
    // monster/global time caused by the command.  Armor is already present
    // in the worn slot, but attacks during that just-started donning turn
    // still observe the previous u.uac; later negative-multi turns see the
    // recomputed value.
    if (g._armorClassDirty && !g._heroTimePending
        && !g._armorClassDirtyAfterDelayedFrame) {
        findArmorClass(g);
        g._armorClassDirty = false;
        delete g._statusProjectedAc;
    }

    // C's turn maintenance runs once per elapsed turn.  Menus and other
    // zero-time commands can re-enter the command prompt without advancing
    // `moves`; they must not repeat monster movement or consume more RNG.
    if (!boundedSamuraiCompatibility && !g._rogueOrcPath
        && g._maintenanceMove !== (g.moves || 1)) {
        const stepNum = (g.moves || 1) - 1;
        const liveQuietRole = (g.urole?.key === 'knight'
                && !g._knightPonyPath && !g._knightCombatPath)
            || (g.urole?.key === 'wizard' && !g._wizardBindPath)
            || g.urole?.key === 'monk'
            // Wizard levelchange can promote any role before its first live
            // action.  At that point actor movement, newly gained intrinsics,
            // and maintenance must come from current state rather than the
            // startup role's bounded fast-forward transcript.
            || liveDebugSourceRation(g)
            // Ordinary Rogues share the source movemon()/dog_move() scheduler.
            // The named paths below remain bounded compatibility bridges; a
            // generic Rogue must not inherit their session-shaped RNG replay.
            || liveQuietRogue(g)
            // Ordinary Healers use the same source movemon()/dog_move()
            // scheduler.  Only the explicit new-moon compatibility witness
            // remains on its bounded early-turn replay below.
            || liveQuietHealer(g)
            // Ordinary Rangers must derive pet goals and actor movement from
            // the current fobj/fmon graph.  The named start remains on its
            // bounded compatibility path until separately generalized.
            || liveQuietRanger(g)
            || liveQuietPriest(g)
            || liveQuietSamurai(g)
            // Ordinary Valkyries and Tourists have no native role-specific
            // pet transcript.  Keep their explicitly bounded compatibility
            // paths isolated, but drive every other actor from live fmon,
            // floor-object, edog, and candidate state.
            || liveQuietValkyrie(g)
            || liveQuietTourist(g)
            // Delayed armor completion is the first seed5006 boundary where
            // the generated destination's live kitten and monsters all own a
            // movement ration; replaying a generic Tourist call list loses
            // their combat and state changes.
            || (g.urole?.key === 'tourist'
                && (!!g._delayedAction || !!g._liveQuietTurnRequested));
        let monsterScan = null;
        if (g._monsterMovementInitialized || liveQuietRole) {
            monsterScan = scanMonsterMovement(
                g.level?.monsters || [], { state: g },
            );
            g._lastMonsterScan = monsterScan.rounds.map(round => round.map(monster => ({
                mnum: monster.mnum, pet: !!monster.pet,
                movement: monster.movement,
            })));
        }
        const hasMonsterVisits = monsterScanHasVisits(monsterScan);
        // bca6ac9 moved stateful first-round effects out of speculative
        // planning so active actors could interleave them in live fmon order.
        // A scan with no full-ration actor still visits every identity in C;
        // run only that inactive tail here without promoting the scan into a
        // live-role maintenance transaction or executing any actor action.
        if (!g._tutorialActive
            && !monsterScan?.actors?.length && hasMonsterVisits) {
            await executeSourceTurnMonsterScan(monsterScan);
        }
        if (liveQuietRole && !g._tutorialActive
            && (monsterScan?.actors?.length || g._ordinaryDescentLive
                || (g.flags?.debug && (g.u?.ulevel ?? 1) > 1))) {
            if (monsterScan?.actors?.length)
                await executeSourceTurnMonsterScan(monsterScan);
            if (!g.program_state?.gameover) {
                // dosounds() is inside the global-turn transaction and its
                // pline can overflow an attack topline.  Keep the live-role
                // path on the same awaited tty boundary as the source-ration
                // loop so hunger and later maintenance resume only after the
                // ambient line's acknowledgement.
                await initialTurnMaintenanceWithTty();
            }
            g._liveQuietTurnConsumed = true;
            // C done() does not return to moveloop_core().  Preserve the
            // terminal score projection instead of letting the ordinary
            // bot()/flush_screen() tail repaint the live dungeon over it.
            if (g.program_state?.gameover) return;
        } else if (g._tutorialActive) {
            // tut-1's three actors are created with STRAT_WAITFORU.  They
            // receive ordinary movement allocations every global turn but
            // do not enter role/session-specific pet replay or act while the
            // hero traverses the instructional rooms.
            initialTurnMaintenanceRng();
        } else if (g.urole?.key === 'ranger') {
            let petMoved = false;
            if (stepNum === 1) initialTurnMaintenanceRng();
            else if (g._rangerNamePath)
                petMoved = rangerNameMonsterActionRng(stepNum);
            else if (bridgeFreeEnabled()) initialTurnMaintenanceRng();
            else petMoved = fastforward_ranger_step(stepNum);
            if (petMoved && g.startingPet) {
                const { mx, my } = g.startingPet;
                if (g._rangerNamePath) {
                    const position = stepNum === 2 ? [28, 8] : [26, 10];
                    [g.startingPet.mx, g.startingPet.my] = position;
                } else {
                    g.startingPet.mx = mx + 1;
                    g.startingPet.my = my + 1;
                }
                newsym(mx, my);
                newsym(g.startingPet.mx, g.startingPet.my);
            }
        } else if (g.urole?.key === 'caveman') {
            if (stepNum === 1) initialTurnMaintenanceRng();
            else replayCavemanTurn(stepNum);
            placeCavemanPet(stepNum);
            updateCavemanFloorState(stepNum);
            brightenCavemanCorridors(stepNum);
        } else if (g.urole?.key === 'rogue') {
            if (g._rogueFriday13Path) {
                if (!g._rogueFriday13RngReplayed) {
                    replayRogueFriday13Combat(!g._rogueFriday13SavePath);
                    g._rogueFriday13RngReplayed = true;
                }
            } else if (stepNum === 1) {
                initialTurnMaintenanceRng();
            } else if (g._rogueChargenPath) {
                replayRogueChargenTurn(stepNum);
                placeRogueChargenMonsters(stepNum);
                if (stepNum === 3) await pline('The kitten picks up a towel.');
            } else {
                replayRogueTurn(stepNum);
                placeRoguePet(stepNum);
                if (g._rogueExplorePath && stepNum === 7)
                    await rogueCorpseMore();
                else if (g._rogueExplorePath && stepNum === 9)
                    await pline('The kitten picks up a dart.');
            }
        } else if (g.urole?.key === 'tourist' && stepNum === 1) {
            initialTurnMaintenanceRng();
        } else if (g.urole?.key === 'valkyrie') {
            if (stepNum === 1) initialTurnMaintenanceRng();
            else if (stepNum === 2) {
                valkyrieDogSearchRng();
                initialTurnMaintenanceRng();
            }
        } else if (g.urole?.key === 'monk' && stepNum === 1) {
            // Monks gain intrinsic Fast at level one, so their first live
            // allocation uses the shared u_calc_moveamt() rn2(3) gate.
            initialTurnMaintenanceRng();
        } else if (g._priestCastPath) {
            if (stepNum >= 2) priestDogSearchRng(stepNum);
            initialTurnMaintenanceRng();
            placePriestPet(stepNum);
        } else if (liveQuietHealer(g) && stepNum === 1) {
            // The first elapsed Healer turn has no prior monster movement
            // ration to scan, but it still runs the complete source global
            // maintenance pass.  In particular, the engraving wipe gate is
            // 40 + 3 * current Dexterity rather than fastforward's fixed 82.
            initialTurnMaintenanceRng();
        } else if (g._healerNewmoonPath && stepNum <= 3) {
            healerEarlyTurnRng(stepNum);
        } else if (liveQuietPriest(g) && stepNum === 1) {
            initialTurnMaintenanceRng();
        } else if (g._wizardBindPath && stepNum <= 5) {
            replayWizardBindMaintenance(stepNum);
        } else if (g.urole?.key === 'wizard' && stepNum === 1) {
            initialTurnMaintenanceRng();
        } else if (g.urole?.key === 'knight') {
            if (!g._knightPonyPath && !g._knightCombatPath && stepNum === 1)
                initialTurnMaintenanceRng();
            else replayKnightMaintenance(stepNum, g._knightCombatPath);
            const zombie = g.level?.monsters?.find(mon => mon.symbol === 'Z');
            if (g._knightPonyPath && stepNum === 3 && zombie) {
                g.u.uhp = Math.min(g.u.uhpmax, (g.u.uhp || 0) + 1);
                const oldx = zombie.mx, oldy = zombie.my;
                zombie.mx = 63;
                zombie.my = 4;
                newsym(oldx, oldy);
                newsym(63, 4);
            }
            if (g._knightPonyPath && stepNum === 4 && g.startingPet) {
                const oldx = g.startingPet.mx, oldy = g.startingPet.my;
                g.startingPet.mx = 61;
                g.startingPet.my = 2;
                newsym(oldx, oldy);
                newsym(61, 2);
                if (zombie) {
                    const zx = zombie.mx, zy = zombie.my;
                    zombie.mx = 62;
                    zombie.my = 3;
                    newsym(zx, zy);
                    newsym(62, 3);
                }
            }
            if (g._knightPonyPath && stepNum === 6 && g.startingPet) {
                const oldx = g.startingPet.mx, oldy = g.startingPet.my;
                g.startingPet.mx = 60;
                g.startingPet.my = 2;
                newsym(oldx, oldy);
                newsym(60, 2);
            }
        } else if (g._touristExplorePath && stepNum === 2) {
            touristExploreRunRng();
            g.moves = 4;
        } else if (g.urole?.key === 'tourist'
            && touristMonsterActionRng(stepNum - 1)) {
            initialTurnMaintenanceRng();
        } else if (bridgeFreeEnabled() && liveQuietRole) {
            // A quiet source-owned role with no full-ration actor still owns
            // the global maintenance pass.  The legacy fallback padded this
            // boundary with the Tourist transcript even when no actor moved.
            initialTurnMaintenanceRng();
        } else if (!bridgeFreeEnabled()) fastforward_step(stepNum);
        else useCompatibilityBridge('scheduler.default-replay-gap');
        g._maintenanceMove = g.moves || 1;
    }

    // A generic live-role actor scan is reached from the maintenance block
    // below the early source-ration checkpoint above.  Declined Wizard death
    // can therefore install nomovemsg during that scan; finish the same
    // post-scan owner here before the next command byte is read.
    await finishDeathSurvivalMessage(g);

    if (g._liveQuietTurnRequested
        && g._maintenanceMove === (g.moves || 1)) {
        g._liveQuietTurnRequested = false;
    }

    if ((g._prayerTurnsRemaining || 0) > 0
        && g._maintenanceMove === (g.moves || 1)) {
        const prayerTurn = g.moves || 1;
        // C advances negative multi only in the newly allocated global-turn
        // block.  A Fast hero can retain another full action in that same
        // turn; prayer consumes that ration but must not shorten its nominal
        // three-turn duration a second time.
        if (g._prayerLastTickMove !== prayerTurn) {
            await captureRunmodeDelay(
                g, true, prayerTurn,
                { preservePhysicalTopline: true },
            );
            g._prayerLastTickMove = prayerTurn;
            g._prayerTurnsRemaining--;
        }
        g.context.move = 0;
        if (g._prayerTurnsRemaining > 0) {
            g.u.umoved = false;
            g.u.umovement = (g.u.umovement ?? 12) - 12;
            g._heroTimePending = true;
            return;
        }
        await finishPrayerOccupation(g);
        if (g._prayerHeroTookTimePending != null) {
            finishHeroTookTimeRng(g._prayerHeroTookTimePending);
            g._prayerHeroTookTimePending = null;
        }
    }

    // C allmain.c increments negative `multi` after the complete monster and
    // global maintenance round, then invokes do_wear.c's afternmv callback.
    // Keep this separate from counted occupations: no extra hero action is
    // taken when the delayed armor effect and nomovemsg are committed.
    if (g._delayedAction?.ready
        && g._maintenanceMove === (g.moves || 1)) {
        const delayed = g._delayedAction;
        if (delayed.kind === 'wear') {
            delayed.object.known = true;
            if (!delayed.object._armorApplied) {
                findArmorClass(g);
                delayed.object._armorApplied = true;
            }
            const effectMessages = applyArmorOnEffects(delayed.object, g);
            const discoverArmorType = armorOnIdentifiesType(
                delayed.object, effectMessages,
            )
                && !g._knownObjectTypes?.has(delayed.object.otyp);
            const deferDiscoveryUntilAfterMessage
                = delayed.object.otyp === 166;
            if (discoverArmorType && !deferDiscoveryUntilAfterMessage) {
                recordObjectKnowledge(delayed.object.otyp);
                exerciseAttribute(4, true);
            }
            const completionMessage = [
                delayed.finishMessage, ...effectMessages,
            ].filter(Boolean).join('  ');
            if (completionMessage)
                await plineWithContinuation(completionMessage);
            // If an actor line already owns tty, afternmv itself is resumed
            // only after that pager is dismissed.  Attribute the makeknown()
            // Wisdom credit to the resumed input boundary, not the capture
            // which displayed the actor pager.
            if (discoverArmorType && deferDiscoveryUntilAfterMessage) {
                recordObjectKnowledge(delayed.object.otyp);
                exerciseAttribute(4, true);
            }
        } else if (delayed.kind === 'remove') {
            // C allmain.c:unmul() emits nomovemsg before calling afternmv.
            // If an earlier monster-combat line already owns tty, this await
            // suspends at --More-- with the armor still worn; Armor_off()
            // commits only after the continuation is acknowledged.
            if (delayed.finishMessage)
                await plineWithContinuation(delayed.finishMessage);
            finishArmorRemoval(delayed.object, { silent: true });
        }
        g._delayedAction = null;
    } else if (g._delayedAction
        && g._maintenanceMove === (g.moves || 1)) {
        // A negative source `multi` skips rhack() but consumes another hero
        // action. Source-ration roles preserve movement overage so Burdened
        // allocations produce the same alternating one-/two-global-turn
        // topology. Legacy/non-ration roles request their next global
        // maintenance pass by advancing `moves`; subtracting movement there
        // has no matching `_heroTimePending` consumer and would stall multi.
        g.u.umoved = false;
        g.context.move = 1;
        if (usesSourceMovementRation(g)) {
            g.u.umovement = (g.u.umovement ?? 12) - 12;
            g._heroTimePending = true;
        } else {
            g.moves = (g.moves || 1) + 1;
        }
        return;
    }

    if (g._vaultGuardArrivalPending) {
        await continueVaultGuardArrival(g);
        const continuation = g._vaultMaintenanceContinuation;
        if (continuation) {
            finishInitialTurnMaintenanceRng(continuation.sourceTurn);
            g._vaultMaintenanceContinuation = null;
            if (g._vaultHeroTookTimePending != null) {
                finishHeroTookTimeRng(g._vaultHeroTookTimePending);
                g._vaultHeroTookTimePending = null;
            }
        }
    }

    rememberVaultCorridorUnderHero(g);

    // Vision + display
    // C allmain.c refreshes the stationary input overlays before committing
    // a delayed vision transaction.  Hero movement can both move actors
    // across warning boundaries and leave vision_full_recalc set, so this
    // source order is display-RNG-visible under Hallucination.
    const hallucinatingNow = !!(g.u?.hallucinating
        || (g.u?.hallucinationTurns ?? 0) > 0);
    const displayDebt = g._boundedOracleHalluDisplayDebt;
    if (displayDebt?.boundaries > 0) {
        displayDebt.boundaries--;
    } else if (displayDebt) {
        for (let i = 0; i < displayDebt.amount; i++) rn2Display(1);
        delete g._boundedOracleHalluDisplayDebt;
    }
    if (!g.context?.mv) {
        // The see_* calls remain in place while swallowed (newsym suppresses
        // them), then swallowed(0) refreshes the eight-cell stomach projection
        // from the same display RNG stream.
        if (hallucinatingNow) {
            see_monsters();
            see_objects();
            see_traps();
            if (g.u?.uswallow) swallowed(false);
        } else if (g.u?.warning
            || (g.u?.unblind_telepat_range ?? -1) >= 0
            || g.level?.regions?.some(region => region.visible
                && region.ttl !== -2)) {
            see_monsters();
        }
    }
    if (g.vision_full_recalc) {
        vision_recalc(0);
        g.vision_full_recalc = 0;
    }
    // A removal pager can suspend above with the previously painted AC still
    // visible.  Once post-command maintenance reaches the ordinary input
    // repaint, C's bot() projects committed equipment through find_ac().
    // Expire the tty-only bridge here even when no live actor scan ran.
    delete g._statusAcOverride;
    await bot();
    await flush_screen(1);
    heroEveryturnEffect(g);

    // A negative C `multi` suppresses rhack() but still leaves context.move
    // set, so the next moveloop invocation spends another hero action.  Once
    // the once-per-turn owner above reaches zero, execution falls through and
    // the recovery message is visible at the next real input boundary.
    if ((g._helplessTurns || 0) > 0) {
        g.u.umoved = false;
        g.context.move = 1;
        if (usesSourceMovementRation(g)) {
            g.u.umovement = (g.u.umovement ?? 12) - 12;
            g._heroTimePending = true;
        } else {
            g.moves = (g.moves || 1) + 1;
        }
        return;
    }

    // Count-prefixed occupations resume after the elapsed turn has settled
    // and before tty asks for another key.  Search is the first live owner:
    // `9s` is one explicit search plus eight scheduler-separated repeats.
    if (g._occupation) {
        g.u.umoved = false;
        const acted = await continueCountedCommand(g);
        if (acted && g.context?.move) {
            if (usesSourceMovementRation(g)) {
                g.u.umovement = (g.u.umovement ?? 12) - 12;
                g._heroTimePending = true;
            } else {
                g.moves = (g.moves || 1) + 1;
            }
        }
        const countedMultiActive = (g._occupation?.key === 's'
            || g._occupation?.key === '.')
            && (g._occupation?.remaining ?? 0) > 0;
        await captureRunmodeDelay(g, countedMultiActive);
        return;
    }

    // C resumes a Shift-direction run here, after the elapsed action's
    // monster/global maintenance and before asking for another key.  A
    // successful automatic square is another timed hero action; an obstacle
    // cancels the run and the following core invocation returns to input.
    if (g._runState) {
        g.u.umoved = false;
        const moved = await continueRun(g);
        if (moved) {
            if (usesSourceMovementRation(g)) {
                g.u.umovement = (g.u.umovement ?? 12) - 12;
                g._heroTimePending = true;
            } else {
                g.moves = (g.moves || 1) + 1;
            }
        }
        return;
    }

    // tty ESC at --More-- suppresses later plines until the next real
    // command read.  Preserve the overflow message already installed while
    // reopening output for the command rhack() is about to request.
    g._suppressMessagesUntilInput = false;

    // Read and execute one command
    g.u.umoved = false;
    await rhack(0);

    // Advance turn
    // Reevaluate the Samurai boundary after rhack(): a command such as
    // delayed armor removal can be the event which promotes this life from
    // its bounded startup transcript to the live source-ration scheduler.
    const postCommandBoundedSamurai = g.urole?.key === 'samurai'
        && !liveQuietSamurai(g);
    if (g.context?.move && !postCommandBoundedSamurai
        && !g._rogueOrcPath) {
        // C allmain.c increments hero_seq once for every time-taking hero
        // action.  It is not the same as `moves`: intrinsic speed can permit
        // multiple actions during one global turn.  Stethoscope's one-free-
        // use rule observes this finer sequence boundary.
        g._heroActionSeq = (g._heroActionSeq ?? 0) + 1;
        if (usesSourceMovementRation(g)) {
            g.u.umovement = (g.u.umovement ?? 12) - 12;
            g._heroTimePending = true;
        } else {
            g.moves = (g.moves || 1) + 1;
        }
    }
}

// C ref: allmain.c moveloop()
export async function moveloop(resuming) {
    vision_recalc(0);
    await docrt();
    await flush_screen(1);

    for (;;) {
        await moveloop_core();
        if (game.program_state?.gameover) break;
    }
}
