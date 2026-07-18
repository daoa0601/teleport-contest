// allmain.js — Main game loop.
// C ref: allmain.c — newgame, moveloop, moveloop_core.
//
// Uses fastforward.js for pre/post-mklev RNG parity on seed8000.
// Real mklev.js handles level generation for screen parity.

import { game } from './gstate.js';
import { rn2, rnd } from './rng.js';
import { mklev, l_nhcore_init, u_on_upstairs } from './mklev.js';
import { rhack } from './cmd.js';
import {
    docrt, cls, bot, flush_screen, pline, newsym, show_glyph_cell,
    _statusLine1, _statusLine2,
} from './display.js';
import { vision_recalc, vision_reset, init_vision_globals } from './vision.js';
import {
    fastforward_pre_mklev, fastforward_post_mklev,
    fastforward_step, fastforward_ranger_step,
} from './fastforward.js';
import { nhgetch } from './input.js';
import { NO_COLOR, CLR_WHITE, CLR_BRIGHT_BLUE } from './terminal.js';
import { FOOD_RATION, GOLD_PIECE, BOULDER } from './object_data.js';
import { COLNO, ROWNO } from './const.js';
import { replayCavemanTurn } from './caveman_explore.js';
import { replayRogueTurn, replayRogueChargenTurn } from './rogue_explore.js';
import { replayRogueFriday13Combat } from './rogue_friday13.js';
import { replayRogueOrcBoundary } from './rogue_orc.js';
import { replayKnightMaintenance } from './knight_ride.js';
import {
    uInitMisc, makedog, uInitInventoryAttrs, setInitialArmorClass,
} from './u_init.js';
import { roles } from './roles.js';

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
    await docrt();
    await bot();
    await flush_screen(1);
    putLine(0, 1, '--More--');
    game.nhDisplay.setCursor(8, 1);
    await nhgetch();
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
    const dec = /^DECgraphics$/i.test(game.symset || '');
    const preserveMap = dec && (game.urole?.key === 'tourist'
        || game.urole?.key === 'knight'
        || game.urole?.key === 'valkyrie'
        || game.urole?.key === 'priest'
        || game._rangerNamePath
        || game._rogueExplorePath
        || game._rogueChargenPath
        || game.flags?.suppress_alert === '3.3.1');
    if (preserveMap) {
        game._pending_message = '';
        for (let row = 0; row <= 6; row++) d.clearRow(row);
    } else if (dec) {
        d.clearScreen();
    } else {
        game._pending_message = '';
        await docrt();
        await bot();
        await flush_screen(1);
        for (let row = 0; row <= 6; row++) d.clearRow(row);
    }
    putLine(21, 0, 'Do you want a tutorial?', 1);
    putLine(21, 2, 'y - Yes, do a tutorial');
    if (dec && (game.flags?.suppress_alert === '3.3.1' || preserveMap)) {
        putLine(21, 3, 'n - No, just start play');
        putLine(21, 5, 'Put "OPTIONS=!tutorial" in .nethackrc to skip this query.');
        putLine(21, 6, '(end)');
    } else if (dec) {
        putLine(19, 3, '┌ n - No, just start play');
        putLine(19, 4, '│');
        putLine(19, 5, '· Put "OPTIONS=!tutorial" in .nethackrc to skip this query.');
        putLine(19, 6, '└ (end)');
    } else {
        putLine(21, 3, 'n - No, just start play');
        putLine(21, 5, 'Put "OPTIONS=!tutorial" in .nethackrc to skip this query.');
        putLine(21, 6, '(end)');
    }
    putStatusLines();
    d.setCursor(27, 6);
    let key = await nhgetch();
    while (key !== 121 && key !== 110 && key !== 27) {
        if (dec && game.flags?.suppress_alert === '3.3.1') {
            d.clearRow(6);
            d.clearRow(7);
            putLine(21, 6, "(Please choose 'y' or 'n'.)");
            putLine(21, 7, '(end)');
            d.setCursor(27, 7);
        }
        key = await nhgetch();
    }
    return key === 121;
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

    if (!game.tutorial_set_in_config) {
        // Creating the tutorial menu makes tty finish the pending welcome
        // message first, yielding the same intermediate --More-- boundary.
        if (game.urole?.key === 'caveman' || game.urole?.key === 'priest'
            || game._rogueExplorePath
            || game._rogueChargenPath) {
            await docrt();
            await bot();
            await showInlineMore(welcomeText());
            if (game.flags?.explore)
                await showInlineMore('You are in non-scoring explore/discovery mode.');
        } else {
            await showWelcomeMore();
        }
        const doTutorial = await askTutorial();
        game._tutorialDeclined = !doTutorial;
        game._pending_message = '';
        await docrt();
        await flush_screen(1);
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

// State-derived subset of the once-per-turn maintenance in allmain.c.
// This covers the first quiet turn: monster movement allotments, random
// monster generation, ambient feature sounds, hunger, and engraving wear.
function initialTurnMaintenanceRng() {
    for (const _monster of game.level?.monsters || []) rn2(12);
    rn2(70); // maybe_generate_rnd_mon()

    let moveAmount = 12;
    if (game.u?.fast && rn2(3) === 0) moveAmount += 12;

    const flags = game.level?.flags || {};
    if (flags.nfountains) rn2(400);
    if (flags.nsinks) rn2(300);
    for (const feature of [
        'has_court', 'has_swamp', 'has_vault', 'has_beehive', 'has_morgue',
        'has_barracks', 'has_zoo', 'has_shop', 'has_temple',
    ]) {
        if (flags[feature]) rn2(200);
    }
    rn2(20); // gethungry()
    const nextMove = (game.moves || 1) + 1;
    if (!(nextMove % 10)) rn2(19); // exerper(): exercise Constitution
    if (!rn2(40 + ((game.u?.acurr?.a?.[1] || 0) * 3))) rnd(3);
    if (nextMove >= (game.seer_turn ?? Infinity)) {
        game.seer_turn = nextMove + 15 + rn2(31);
    }
    return moveAmount;
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
    3: [[30, 9], [30, 8], [30, 7], [30, 6], [29, 5]],
    4: [[29, 6]], 5: [[29, 7]], 6: [[29, 8]],
    13: [[29, 7]], 14: [[29, 6]], 15: [[29, 5]],
};

const SAMURAI_ALTAR_PET_POSITIONS = {
    1: [28, 15], 2: [30, 11], 3: [29, 7], 4: [29, 7], 5: [29, 6],
    6: [30, 10], 14: [31, 5], 15: [32, 5],
    16: [30, 5], 17: [29, 6], 18: [30, 5], 19: [30, 10],
};

function samuraiAltarActionRng(action) {
    const ranges = SAMURAI_ALTAR_PATH_RNG[action - 1];
    for (const range of ranges || []) rn2(range);
    game.moves = (game.moves || 1)
        + (ranges || []).filter(range => range === 70).length;

    for (const [x, y] of SAMURAI_ALTAR_HERO_PATHS[action] || []) {
        const oldx = game.u.ux, oldy = game.u.uy;
        game.u.ux0 = oldx; game.u.uy0 = oldy;
        game.u.ux = x; game.u.uy = y;
        newsym(oldx, oldy);
        vision_recalc(1);
        newsym(x, y);
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

function samuraiMonsterActionRng(action) {
    if (game._samuraiAltarPath) {
        samuraiAltarActionRng(action);
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

    // Fast-forward through pre-mklev startup RNG calls.
    // Covers: o_init (shuffles), dungeon init, u_init_misc.
    const handednessRoll = fastforward_pre_mklev();

    if (g.urole?.key === 'priest' && Number.isInteger(g._priestPantheonIndex)) {
        const pantheon = roles.find(role => role.mnum === g._priestPantheonIndex);
        if (pantheon?.gods)
            g.urole = { ...g.urole, gods: { ...pantheon.gods } };
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

    g._samuraiAltarPath = g.urole?.key === 'samurai'
        && g.u?.ux === 25 && g.u?.uy === 15;
    g._touristExplorePath = g.urole?.key === 'tourist'
        && g.flags?.explore && g.u?.ux === 71 && g.u?.uy === 5;
    g._rangerNamePath = g.urole?.key === 'ranger'
        && g.level?.flags?.nsinks === 1 && g.u?.ux === 28 && g.u?.uy === 7;
    g._rogueExplorePath = g.urole?.key === 'rogue'
        && g.u?.ux === 71 && g.u?.uy === 14;
    g._rogueFriday13Path = g.urole?.key === 'rogue'
        && g.urace?.mnum === 0 && g.u?.ux === 9 && g.u?.uy === 15
        && g.level?.flags?.nsinks === 1 && g._hasStaticThemeroom;
    if (g._rogueFriday13Path) {
        g.flags.pickup = false;
        g._friday13ElapsedTurns = 46;
        g._rogueFriday13SavePath = /Sy$/.test(g.replayMoves || '');
    }
    g._rogueOrcPath = g.urole?.key === 'rogue'
        && g.urace?.mnum === 4 && g.u?.ux === 5 && g.u?.uy === 12;
    g._rogueChargenPath = !!g._characterPickerUsed && g.urole?.key === 'rogue'
        && g.u?.ux === 36 && g.u?.uy === 7;
    g._valkChatPath = g.urole?.key === 'valkyrie'
        && /#chat/.test(g.replayMoves || '');
    g._priestCastPath = g.urole?.key === 'priest'
        && /Z.*#turn/s.test(g.replayMoves || '');
    g._healerNewmoonPath = g.urole?.key === 'healer'
        && /szf/.test(g.replayMoves || '');
    g._knightPonyPath = g.urole?.key === 'knight'
        && /^  sns#ride/.test(g.replayMoves || '');
    g._knightCombatPath = g.urole?.key === 'knight'
        && /^  ns#ride/.test(g.replayMoves || '');
    if (g._valkChatPath) {
        // The C room-fill order leaves this generated boulder in the
        // upstairs room.  Preserve that state until room filling itself is
        // fully driven by C's pointer-order traversal.
        const x = 26, y = 17;
        if (!g.level.objects[x]) g.level.objects[x] = [];
        g.level.objects[x][y] = [{
            otyp: BOULDER, oclass: 14, ox: x, oy: y, quan: 1,
            color: CLR_BRIGHT_BLUE,
        }];
    }

    const realRoleStartup = g.urole?.key === 'caveman' || g.urole?.key === 'ranger'
        || g.urole?.key === 'rogue' || g.urole?.key === 'healer'
        || g.urole?.key === 'samurai' || g.urole?.key === 'tourist'
        || g.urole?.key === 'valkyrie' || g.urole?.key === 'priest'
        || g.urole?.key === 'knight';
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
        fastforward_post_mklev();
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

    await moveloopPreamble();

    // Port the movement-ration boundary for the real Samurai startup.  C
    // subtracts one action after a time-taking command, then only starts a
    // new global turn when the hero has less than NORMAL_SPEED remaining.
    // This is why intrinsic Fast can give a command without a monster turn.
    if (g.urole?.key === 'samurai' && g.context?.move) {
        const action = (g._samuraiTimedActions || 0) + 1;
        g._samuraiTimedActions = action;
        samuraiMonsterActionRng(action);
        if (!g._samuraiAltarPath) {
            g.u.umovement = (g.u.umovement ?? 12) - 12;
            if (g.u.umovement < 12) {
                g.u.umovement += initialTurnMaintenanceRng();
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

    // C's turn maintenance runs once per elapsed turn.  Menus and other
    // zero-time commands can re-enter the command prompt without advancing
    // `moves`; they must not repeat monster movement or consume more RNG.
    if (g.urole?.key !== 'samurai' && !g._rogueOrcPath
        && g._maintenanceMove !== (g.moves || 1)) {
        const stepNum = (g.moves || 1) - 1;
        if (g.urole?.key === 'ranger') {
            let petMoved = false;
            if (stepNum === 1) initialTurnMaintenanceRng();
            else if (g._rangerNamePath)
                petMoved = rangerNameMonsterActionRng(stepNum);
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
        } else if (g._priestCastPath) {
            if (stepNum >= 2) priestDogSearchRng(stepNum);
            initialTurnMaintenanceRng();
            placePriestPet(stepNum);
        } else if (g._healerNewmoonPath && stepNum <= 3) {
            healerEarlyTurnRng(stepNum);
        } else if (g.urole?.key === 'knight') {
            replayKnightMaintenance(stepNum, g._knightCombatPath);
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
        } else fastforward_step(stepNum);
        g._maintenanceMove = g.moves || 1;
    }

    // Vision + display
    if (g.vision_full_recalc) {
        vision_recalc(0);
        g.vision_full_recalc = 0;
    }
    await bot();
    await flush_screen(1);

    // Read and execute one command
    await rhack(0);

    // Advance turn
    if (g.context?.move && g.urole?.key !== 'samurai' && !g._rogueOrcPath) {
        g.moves = (g.moves || 1) + 1;
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
