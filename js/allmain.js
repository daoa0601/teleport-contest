// allmain.js — Main game loop.
// C ref: allmain.c — newgame, moveloop, moveloop_core.
//
// Uses fastforward.js for pre/post-mklev RNG parity on seed8000.
// Real mklev.js handles level generation for screen parity.

import { game } from './gstate.js';
import { rn2 } from './rng.js';
import { mklev, l_nhcore_init, u_on_upstairs } from './mklev.js';
import { rhack } from './cmd.js';
import { docrt, cls, bot, flush_screen, pline } from './display.js';
import { vision_recalc, vision_reset, init_vision_globals } from './vision.js';
import { fastforward_pre_mklev, fastforward_post_mklev, fastforward_step, fastforward_fill_mineralize } from './fastforward.js';

// C ref: allmain.c newgame()
export async function newgame() {
    const g = game;

    // Fast-forward through pre-mklev startup RNG calls.
    // Covers: o_init (shuffles), dungeon init, u_init_misc.
    fastforward_pre_mklev();

    // C ref: allmain.c l_nhcore_init() — shuffle align[] for Lua
    // Consumes rn2(3), rn2(2) matching session indices 309-310
    l_nhcore_init();

    // Set up game state needed by mklev
    g.dungeons = [{ dname: 'The Dungeons of Doom', depth_start: 1, num_dunlevs: 30 }];
    g.u = g.u || {};
    g.u.uz = { dnum: 0, dlevel: 1 };
    g.flags = g.flags || {};
    // Branch: Mines entrance on level 1 (for seed 8000)
    g.branches = [
        { end1: { dnum: 0, dlevel: 1 }, end2: { dnum: 2, dlevel: 1 }, end1_up: true },
    ];

    // Real mklev generates the level with correct room positions
    // Structural phase consumes RNG for rooms/corridors/doors/stairs
    await mklev();

    // Fill rooms + mineralize: replayed by fastforward
    // These create objects/monsters that don't affect terrain display
    fastforward_fill_mineralize();

    // Fast-forward through post-mklev startup RNG calls.
    // Covers: u_init_role, ini_inv, attributes, moveloop_preamble.
    fastforward_post_mklev();

    // Hardcoded player state for seed8000 Tourist.
    // Contestants: port u_init to compute these from game PRNG.
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
        name: { m: 'Tourist', f: 'Tourist' },
        rank: { m: 'Rambler', f: 'Rambler' },
        gods: { lawful: 'Blind Io', neutral: 'The Lady', chaotic: 'Offler' },
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

    // C ref: allmain.c newgame() → u_on_upstairs()
    // Places hero on upstair, or special stair, or random room position.
    u_on_upstairs();

    // Initial display
    init_vision_globals();
    vision_reset();
    vision_recalc(0);
    await cls();
    await docrt();
    await flush_screen(1);
    await bot();

    // Welcome message
    const alignName = 'neutral';
    const genderAdj = g.flags?.female ? 'female' : 'male';
    await pline(`Aloha ${g.plname}, welcome to NetHack!  You are a ${alignName} ${genderAdj} human ${g.urole.name.m}.`);
}

// C ref: allmain.c moveloop_core()
export async function moveloop_core() {
    const g = game;

    // C's turn maintenance runs once per elapsed turn.  Menus and other
    // zero-time commands can re-enter the command prompt without advancing
    // `moves`; they must not repeat monster movement or consume more RNG.
    if (g._maintenanceMove !== (g.moves || 1)) {
        const stepNum = (g.moves || 1) - 1;
        fastforward_step(stepNum);
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
    if (g.context?.move) {
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
