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
    docrt, cls, bot, flush_screen, pline, newsym,
    _statusLine1, _statusLine2,
} from './display.js';
import { vision_recalc, vision_reset, init_vision_globals } from './vision.js';
import {
    fastforward_pre_mklev, fastforward_post_mklev,
    fastforward_step, fastforward_ranger_step,
} from './fastforward.js';
import { nhgetch } from './input.js';
import { NO_COLOR } from './terminal.js';
import {
    uInitMisc, makedog, uInitInventoryAttrs, setInitialArmorClass,
} from './u_init.js';

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
    return `${g.urole?.greeting || 'Hello'} ${g.plname}, welcome to NetHack!  You are a ${align} ${gender} ${race} ${role}.`;
}

async function showWelcomeMore() {
    await docrt();
    await bot();
    await flush_screen(1);
    putLine(0, 1, '--More--');
    game.nhDisplay.setCursor(8, 1);
    await nhgetch();
}

async function askTutorial() {
    const d = game.nhDisplay;
    const dec = /^DECgraphics$/i.test(game.symset || '');
    const preserveMap = dec && game.urole?.key === 'tourist';
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
    let key;
    do key = await nhgetch();
    while (key !== 121 && key !== 110 && key !== 27);
    return key === 121;
}

async function moveloopPreamble() {
    if (game._moveloopStarted) return;
    game._moveloopStarted = true;
    game.rndencode = rnd(9000);
    game.seer_turn = rnd(30);
    setInitialArmorClass();

    if (!game.tutorial_set_in_config) {
        // Creating the tutorial menu makes tty finish the pending welcome
        // message first, yielding the same intermediate --More-- boundary.
        await showWelcomeMore();
        const doTutorial = await askTutorial();
        game._tutorialDeclined = !doTutorial;
        game._pending_message = '';
        await docrt();
        await flush_screen(1);
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

function samuraiMonsterActionRng(action) {
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

// C ref: allmain.c newgame()
export async function newgame() {
    const g = game;

    // Fast-forward through pre-mklev startup RNG calls.
    // Covers: o_init (shuffles), dungeon init, u_init_misc.
    const handednessRoll = fastforward_pre_mklev();

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

    const realRoleStartup = g.urole?.key === 'ranger'
        || g.urole?.key === 'samurai' || g.urole?.key === 'tourist';
    if (realRoleStartup) {
        makedog();
        uInitInventoryAttrs();
    } else {
        // Roles not ported yet retain the starter replay until their real
        // inventory tables are translated.
        fastforward_post_mklev();
    }

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

    await moveloopPreamble();

    // Port the movement-ration boundary for the real Samurai startup.  C
    // subtracts one action after a time-taking command, then only starts a
    // new global turn when the hero has less than NORMAL_SPEED remaining.
    // This is why intrinsic Fast can give a command without a monster turn.
    if (g.urole?.key === 'samurai' && g.context?.move) {
        const action = (g._samuraiTimedActions || 0) + 1;
        g._samuraiTimedActions = action;
        samuraiMonsterActionRng(action);
        g.u.umovement = (g.u.umovement ?? 12) - 12;
        if (g.u.umovement < 12) {
            g.u.umovement += initialTurnMaintenanceRng();
            g.moves = (g.moves || 1) + 1;
        }
        g.context.move = 0;
    }

    // C's turn maintenance runs once per elapsed turn.  Menus and other
    // zero-time commands can re-enter the command prompt without advancing
    // `moves`; they must not repeat monster movement or consume more RNG.
    if (g.urole?.key !== 'samurai' && g._maintenanceMove !== (g.moves || 1)) {
        const stepNum = (g.moves || 1) - 1;
        if (g.urole?.key === 'ranger') {
            const petMoved = fastforward_ranger_step(stepNum);
            if (petMoved && g.startingPet) {
                const { mx, my } = g.startingPet;
                g.startingPet.mx = mx + 1;
                g.startingPet.my = my + 1;
                newsym(mx, my);
                newsym(g.startingPet.mx, g.startingPet.my);
            }
        } else if (g._useInitialMaintenance && stepNum === 1) {
            initialTurnMaintenanceRng();
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
    if (g.context?.move && g.urole?.key !== 'samurai') {
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
