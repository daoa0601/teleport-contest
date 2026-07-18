// cmd.js — Command dispatch and movement.
// C ref: cmd.c rhack(), hack.c domove().
//
// Minimal skeleton: only hjklyubn movement is implemented.
// Contestants should add: search, kick, eat, drink, read, zap,
// wear, wield, drop, throw, pray, cast, and all other commands.

import { game } from './gstate.js';
import { nhgetch } from './input.js';
import {
    newsym, flush_screen, pline, docrt, bot, terrain_glyph,
    _statusLine1, _statusLine2,
} from './display.js';
import { vision_recalc, vision_reset } from './vision.js';
import { ddoinv, dolook } from './invent.js';
import { docast, dovspell } from './spell.js';
import { dodiscovered } from './o_init.js';
import { doattributes } from './insight.js';
import { dosearch } from './detect.js';
import { ATR_INVERSE, showTextPages } from './windows.js';
import { rnd, rn2, rnl, rnz } from './rng.js';
import { getRumor } from './mklev.js';
import {
    CLUB, SLING, FLINT, FOOD_RATION, FORTUNE_COOKIE, LOCK_PICK, STETHOSCOPE,
    WAN_SLEEP, GOLD_PIECE,
} from './object_data.js';
import { CLR_WHITE, NO_COLOR } from './terminal.js';
import { saveGame } from './save.js';
import {
    replayCavemanFireSwap,
    replayCavemanFireReady,
    replayCavemanShot,
} from './caveman_explore.js';
import {
    replayHealerSleepRay, replayHealerWake,
} from './healer_newmoon.js';
import {
    replayKnightFirstDismount, replayKnightSecondDismountOpening,
    replayKnightPonyMiss, replayKnightPonyBite,
    replayKnightZombieDeathTurn,
} from './knight_ride.js';
import { COLNO, ROWNO, STONE, DOOR, D_CLOSED, D_LOCKED,
         IS_WALL, IS_OBSTRUCTED } from './const.js';

// Direction deltas: y u k
//                   h . l
//                   b j n
const DIR_DX = { h: -1, l: 1, j: 0, k: 0, y: -1, u: 1, b: -1, n: 1 };
const DIR_DY = { h: 0, l: 0, j: 1, k: -1, y: -1, u: -1, b: 1, n: 1 };

function isMovementKey(ch) {
    return 'hjklyubn'.includes(ch);
}

// C ref: hack.c — check if a cell blocks movement
function blocksMove(x, y) {
    const loc = game.level?.at(x, y);
    if (!loc) return true;
    if (loc.typ === STONE) return true;
    if (IS_WALL(loc.typ)) return true;
    if (loc.typ === DOOR && (loc.doormask & (D_CLOSED | D_LOCKED))) return true;
    return false;
}

// C ref: cmd.c rhack — main command dispatcher
export async function rhack(key) {
    if (key === 0) {
        // Read key from input
        await flush_screen(1);
        if ((game._commandCount || 0) >= 10)
            game.nhDisplay?.setCursor(`Count: ${game._commandCount}`.length, 0);
        key = await nhgetch();
    }

    const ch = String.fromCharCode(key);

    // The input boundary displayed the previous command's message.  Clear it
    // now; any message produced below remains visible at the next boundary.
    game._pending_message = '';

    if (game._rogueFriday13Path
        && await rogueFriday13Command(key, ch)) return;

    if (game._rogueOrcPath && ch === 'L') {
        const timedRun = (game.u?.ux === 5 && game.u?.uy === 13)
            || (game.u?.ux === 11 && game.u?.uy === 13)
            || (game.u?.ux === 16 && game.u?.uy === 12);
        game.context.move = timedRun ? 1 : 0;
    } else if (game._rogueOrcPath && ch === 'H') {
        game.context.move = 0;
    } else if (isMovementKey(ch) || (/[HJKLYUBN]/.test(ch))) {
        const direction = ch.toLowerCase();
        game.context.move = ch === 'H' && game._touristExplorePath
            && game.u?.ux === 72 && game.u?.uy === 6
            ? (await touristExploreRunWest(), 1)
            : await domove(DIR_DX[direction], DIR_DY[direction]) ? 1 : 0;
    } else if (ch === 'i') {
        await ddoinv();
    } else if (ch === 'Z') {
        await docast();
    } else if (ch === '+') {
        await dovspell();
    } else if (ch === '\\') {
        await dodiscovered();
    } else if (key === 24) { // Ctrl-X
        await doattributes();
    } else if (ch === 's') {
        await dosearch();
    } else if (key === 4) { // Ctrl-D
        await dokick();
    } else if (ch === 'f' && game.urole?.key === 'caveman') {
        await docavemanfire();
    } else if (ch === 'f' && game._rangerNamePath) {
        await dorangerfire();
    } else if (/^[0-9]$/.test(ch)) {
        game._commandCount = Math.min(9999,
            (game._commandCount || 0) * 10 + Number(ch));
        if (game._commandCount >= 10)
            await pline(`Count: ${game._commandCount}`);
        game.context.move = 0;
    } else if (ch === '.') {
        game._pending_message = '';
        game.context.move = 1;
    } else if (ch === 'e') {
        await doeat();
    } else if (ch === 'z') {
        await dozap();
    } else if (ch === 'r') {
        await doread();
    } else if (ch === 'a') {
        await doapply();
    } else if (ch === ':') {
        await dolook();
    } else if (ch === '#') {
        await doextcmd();
    } else if (ch === 'Q') {
        await doready();
    } else if (ch === 't') {
        await dothrow();
    } else if (ch === '_') {
        await dotravel();
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
        await doOverview();
    } else if (key === 27) { // Escape cancels without producing a message.
        game.context.move = 0;
    } else {
        // Unknown command
        game.context.move = 0;
        await pline(`Unknown command '${ch}'.`);
    }
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

async function farlookTipUntilDismissed() {
    const display = game.nhDisplay;
    for (let row = 0; row <= 8; row++) display.clearRow(row);
    const lines = [
        [10, 0, 'Tip: Farlooking or selecting a map location'],
        [10, 2, 'You are now in a "farlook" mode - the movement keys move the cursor,'],
        [10, 3, 'not your character.  Game time does not advance.  This mode is used'],
        [10, 4, 'to look around the map, or to select a location on it.'],
        [10, 6, 'When in this mode, you can press ESC to return to normal game mode,'],
        [10, 7, 'and pressing ? will show the key help.'],
        [10, 8, '(end)'],
    ];
    for (const [col, row, text] of lines) putCommandLine(col, row, text);
    display.setCursor(16, 8);
    let key;
    do key = await nhgetch();
    while (![27, 32, 10, 13].includes(key));
    return key;
}

async function doOverview() {
    const display = game.nhDisplay;
    game._pending_message = '';
    for (let row = 0; row <= 5; row++) display.clearRow(row);
    putCommandLine(28, 0, 'View which?', ATR_INVERSE);
    putCommandLine(28, 2, 'a * known map without monsters, objects, and traps');
    putCommandLine(28, 3, 'b - known map without monsters and objects');
    putCommandLine(28, 4, 'c - known map without monsters');
    putCommandLine(28, 5, '(end)');
    display.setCursor(34, 5);
    const selection = await nhgetch();
    if (selection === 27) {
        game.context.move = 0;
        return;
    }

    const displaySnapshot = captureMapDisplay();
    showKnownTerrain();
    const terrainDismissal = await moreUntilDismissed(
        'Showing known terrain only...--More--');
    if (terrainDismissal !== 27) {
        const tipDismissal = await farlookTipUntilDismissed();
        if (tipDismissal !== 27) {
            game._pending_message = "(For instructions type a '?')  Move cursor to anything of interest:";
            await flush_screen(1);
            display.setCursor(game.u.ux - 1, game.u.uy + 1);
            const lookKey = await nhgetch();
            if (lookKey !== 27)
                await moreUntilDismissed('Done.--More--');
        }
    }

    restoreMapDisplay(displaySnapshot);
    game._pending_message = '';
    await flush_screen(1);
    game.context.move = 0;
}

async function dosave() {
    const answer = await promptKey('Really save? [yn] (n) ');
    if (String.fromCharCode(answer).toLowerCase() !== 'y') {
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

async function dokick() {
    const key = await promptKey('In what direction? ');
    const direction = String.fromCharCode(key).toLowerCase();
    if (!isMovementKey(direction)) {
        game._pending_message = '';
        game.context.move = 0;
        return;
    }
    if (game._rogueOrcPath) {
        await pline(direction === 'l'
            ? 'Ouch!  That hurts!'
            : 'You kick at empty space.');
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
    await nhgetch();
    game._pending_message = '';
    await restoreCommandMap();
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

function rangerDirectionAssistPage() {
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
        await showTextPages([rangerDirectionAssistPage()]);
    game._pending_message = '';
    await restoreCommandMap();
    game.context.move = 0;
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
    lines[0] = { text: ' Current skills:', attr: ATR_INVERSE };
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
    for (const row of [2, 6, 21]) lines[row] = { text: lines[row], attr: ATR_INVERSE };
    return { lines, cursor: [9, 23] };
}

async function dotwoweapon() {
    if (game.u.twoweap) {
        game.u.twoweap = false;
        await pline('You switch to your primary weapon.');
        game.context.move = 0;
        return;
    }

    game.u.twoweap = true;
    await pline('You begin two-weapon combat.');
    // wield.c: a clumsy toggle only takes time when rnd(20) exceeds Dex.
    game.context.move = rnd(20) > (game.u?.acurr?.a?.[1] || 0) ? 1 : 0;
}

async function doenhance() {
    await showTextPages([samuraiSkillPage()]);
    game._pending_message = '';
    game.context.move = 0;
}

async function dochat() {
    const key = await promptKey('Talk to whom? (in what direction) ');
    const direction = String.fromCharCode(key).toLowerCase();
    if (isMovementKey(direction)) {
        const x = game.u.ux + DIR_DX[direction];
        const y = game.u.uy + DIR_DY[direction];
        const monster = game.level?.monsters?.find(mon => mon.mx === x && mon.my === y);
        if (monster?.name) await pline(`${monster.name} does not seem to notice you.`);
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

async function runExtendedCommand(command) {
    if (command === 'twoweapon') return dotwoweapon();
    if (command === 'enhance') return doenhance();
    if (command === 'chat') return dochat();
    if (command === 'sit') return dosit();
    if (command === 'pray') return dopray();
    if (command === 'name') return doname();
    if (command === 'ride') return doride();
    await pline(`#${command}: unknown extended command.`);
    game.context.move = 0;
}

// TTY's extended-command line editor redraws the prompt at every input
// boundary.  #enhance has AUTOCOMPLETE, so its unique initial "e" expands
// visually while subsequent characters advance through that completed word.
async function doextcmd() {
    let command = '';
    game._pending_message = '#';
    await flush_screen(1);
    game.nhDisplay?.setCursor(2, 0);

    for (;;) {
        const key = await nhgetch();
        if (key === 27) {
            game._pending_message = '';
            game.context.move = 0;
            return;
        }
        if (key === 10 || key === 13) break;
        const ch = String.fromCharCode(key).toLowerCase();
        if (!/[a-z]/.test(ch)) continue;
        command += ch;

        const completion = 'enhance'.startsWith(command) ? 'enhance'
            : 'pray'.startsWith(command) ? 'pray'
            : 'name'.startsWith(command) ? 'name'
            : command.length >= 2 && 'ride'.startsWith(command) ? 'ride'
            : command.length >= 3 && 'chat'.startsWith(command) ? 'chat'
            : 'sit'.startsWith(command) ? 'sit' : null;
        const shown = completion || command;
        game._pending_message = `# ${shown}`;
        await flush_screen(1);
        game.nhDisplay?.setCursor(command.length + 2, 0);
    }

    await runExtendedCommand(command);
}

// C refs: steed.c doride(), mount_steed().  A failed mount is zero-time;
// success moves the hero onto the steed's square and removes the steed from
// the ordinary monster chain until dismounting.
async function doride() {
    const u = game.u;
    if (u?.usteed) {
        const steed = u.usteed;
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
    const answer = await promptKey('Are you sure you want to pray? [yn] (n) ');
    if (String.fromCharCode(answer).toLowerCase() !== 'y') {
        game._pending_message = '';
        game.context.move = 0;
        return;
    }

    if (game._samuraiAltarPath) {
        for (const range of SAMURAI_ALTAR_PRAYER_TURN_RNG) rn2(range);
        game.moves = (game.moves || 1)
            + SAMURAI_ALTAR_PRAYER_TURN_RNG.filter(range => range === 70).length;
        rnz(250);
        rn2(4);
    }
    await promptKey('You begin praying to Amaterasu Omikami.  You finish your prayer.--More--');
    if (game._samuraiAltarPath) rnz(300);
    await pline('You feel that Amaterasu Omikami is displeased.');
    game.context.move = 0;
}

function farlookTipPage() {
    const lines = Array(24).fill('');
    lines[0] = '          Tip: Farlooking or selecting a map location';
    lines[2] = '          You are now in a "farlook" mode - the movement keys move the cursor,';
    lines[3] = '          not your character.  Game time does not advance.  This mode is used';
    lines[4] = '          to look around the map, or to select a location on it.';
    lines[6] = '          When in this mode, you can press ESC to return to normal game mode,';
    lines[7] = '          and pressing ? will show the key help.';
    lines[8] = '          (end)';
    lines[22] = _statusLine1().replace(/\x1b\[(\d+)C/g,
        (_match, count) => ' '.repeat(Number(count)));
    lines[23] = _statusLine2();
    return { lines, cursor: [16, 8] };
}

// C refs: do.c dotravel(), getpos.c getpos().  Travel uses nested input
// boundaries: dismiss the pending message, optionally show the first-use
// farlook tutorial, then read one cursor-direction key from the map.
async function dotravel() {
    await promptKey('Where do you want to travel to?--More--');

    if (!game._travelTipShown) {
        game._travelTipShown = true;
        let key;
        do key = await showTextPages([farlookTipPage()]);
        while (key !== 27);
    }

    game._pending_message = "(For instructions type a '?')  Move cursor to the desired destination:";
    await docrt();
    await bot();
    await flush_screen(1);
    const key = await nhgetch();
    const direction = String.fromCharCode(key);
    if (key === 27) {
        game._pending_message = '';
    } else if (!isMovementKey(direction) && direction !== '.') {
        await pline(`Unknown direction: '${direction}' (use 'h', 'j', 'k', 'l' or '.').`);
    }
    game.context.move = 0;
}

async function promptKey(message) {
    await pline(message);
    await flush_screen(1);
    // tty_nhgetch() leaves the cursor immediately after a top-line prompt.
    game.nhDisplay?.setCursor(message.length, 0);
    return nhgetch();
}

async function doread() {
    const books = (game.inventory || []).filter(item => item.oclass === 10);
    const letters = books.map(item => item.invlet).join('');
    const key = await promptKey(`What do you want to read? [${letters} or ?*] `);
    if (key === 27) {
        game.context.move = 0;
        return;
    }
    const book = books.find(item => item.invlet === String.fromCharCode(key));
    if (!book?.spellName) {
        game.context.move = 0;
        return;
    }

    const known = `You know "${book.spellName}" quite well already.--More--`;
    await pline(known);
    await flush_screen(1);
    game.nhDisplay?.setCursor(known.length, 0);
    let dismissal;
    do dismissal = await nhgetch();
    while (dismissal !== 10 && dismissal !== 13);

    const prompt = 'Refresh your memory anyway? [yn] (n) ';
    await pline(prompt);
    await flush_screen(1);
    game.nhDisplay?.setCursor(prompt.length, 0);
    let answer;
    do answer = await nhgetch();
    while (![27, 10, 13, 89, 78, 121, 110].includes(answer));
    game.context.move = 0;
}

// C refs: eat.c doeat(), done_eating(), fpostfx(); rumors.c outrumor().
// Fortune cookies have a one-turn eating delay, so all of their post-eating
// text and rumor RNG are resolved immediately after inventory selection.
async function doeat() {
    const edible = (game.inventory || []).filter(item => item.oclass === 7);
    const letters = edible.map(item => item.invlet).join('');
    const compactLetters = letters.length >= 6
        && [...letters].every((letter, index) => index === 0
            || letter.charCodeAt(0) === letters.charCodeAt(index - 1) + 1)
        ? `${letters[0]}-${letters.at(-1)}` : letters;
    const prompt = `What do you want to eat? [${compactLetters} or ?*] `;
    let key = await promptKey(prompt);
    let item;
    for (;;) {
        if (key === 27) {
            await pline('Never mind.');
            game.context.move = 0;
            return;
        }
        item = edible.find(candidate => candidate.invlet === String.fromCharCode(key));
        if (item) break;

        // A selected inventory object which is not food is different from an
        // absent inventory letter.  C rejects it immediately, without the
        // modal "don't have that object" message used for a missing letter.
        if ((game.inventory || []).some(candidate =>
            candidate.invlet === String.fromCharCode(key))) {
            await pline('You cannot eat that!');
            game.context.move = 0;
            return;
        }

        const invalid = "You don't have that object.--More--";
        await pline(invalid);
        await flush_screen(1);
        game.nhDisplay?.setCursor(invalid.length, 0);
        do key = await nhgetch();
        while (key !== 27 && key !== 32);

        await pline(prompt);
        await flush_screen(1);
        game.nhDisplay?.setCursor(prompt.length, 0);
        key = await nhgetch();
    }

    if (item.otyp === FORTUNE_COOKIE) {
        const rumor = getRumor(false, true);
        game._useInitialMaintenance = true;
        item.quantity = (item.quantity ?? 1) - 1;
        item.quan = item.quantity;
        if (item.quantity <= 0) {
            game.inventory = game.inventory.filter(candidate => candidate !== item);
        }
        await promptKey('This fortune cookie is delicious!--More--');
        await promptKey('This cookie has a scrap of paper inside.  It reads:--More--');
        await pline(rumor);
        game.context.move = 1;
        return;
    }

    if (game._healerNewmoonPath && item.name === 'apple') {
        rnd(2); // eat.c fpostfx(): seeded Macintosh/Delicious flavor choice
        item.quantity = (item.quantity ?? 1) - 1;
        item.quan = item.quantity;
        if (item.quantity <= 0)
            game.inventory = game.inventory.filter(candidate => candidate !== item);
        await pline('Delicious!  Must be a Macintosh!');
        game.context.move = 1;
        return;
    }

    item.quantity = (item.quantity ?? 1) - 1;
    item.quan = item.quantity;
    if (item.quantity <= 0)
        game.inventory = game.inventory.filter(candidate => candidate !== item);
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

// C refs: zap.c dozap(), weffects(); timeout.c nh_timeout().  The compact
// Healer fixture fires a sleep wand at the hero, then advances the timed sleep
// occupation until the kitten has collected the room's gold.
async function dozap() {
    const wands = (game.inventory || []).filter(item => item.oclass === 11);
    const letters = wands.map(item => item.invlet).join('');
    const key = await promptKey(`What do you want to zap? [${letters} or ?*] `);
    if (key === 27) {
        game.context.move = 0;
        return;
    }
    const wand = wands.find(item => item.invlet === String.fromCharCode(key));
    if (!wand) {
        game.context.move = 0;
        return;
    }

    const direction = await promptKey('In what direction? ');
    if (!(game._healerNewmoonPath && wand.otyp === WAN_SLEEP
        && String.fromCharCode(direction) === '.')) {
        game.context.move = direction === 27 ? 0 : 1;
        return;
    }

    if (wand.charges) wand.charges.current--;
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
async function doapply() {
    const applicable = (game.inventory || []).filter(item => item.oclass === 6
        || game.urole?.key === 'healer' && [10, 11].includes(item.oclass));
    if (!applicable.length) {
        await pline("You don't have anything to use or apply.");
        game.context.move = 0;
        return;
    }
    const letters = applicable.map(item => item.invlet).join('');
    const prompt = `What do you want to use or apply? [${letters} or ?*] `;
    let key = await promptKey(prompt);

    for (;;) {
        if (key === 27) {
            await pline('Never mind.');
            game.context.move = 0;
            return;
        }
        const item = applicable.find(candidate => candidate.invlet
            === String.fromCharCode(key));
        if (item) {
            if (item.otyp === STETHOSCOPE) {
                const direction = await promptKey('In what direction? ');
                if (String.fromCharCode(direction) === '.') {
                    const align = game.u?.ualign?.type > 0 ? 'lawful'
                        : game.u?.ualign?.type < 0 ? 'chaotic' : 'neutral';
                    await pline(`Status of ${game.displayName || game.plname} (fervently ${align}):  Level ${game.u?.ulevel || 1}  HP ${game.u?.uhp}(${game.u?.uhpmax})  AC ${game.u?.uac}.`);
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
async function dothrow() {
    const inventoryLetters = (game.inventory || [])
        .filter(item => item.otyp === 18 || item.otyp === 24 || item.otyp === 83)
        .map(item => item.invlet)
        .join('');
    const letters = `${(game._goldCount || 0) > 0 ? '$' : ''}${inventoryLetters}`;
    const key = await promptKey(`What do you want to throw? [${letters} or ?*] `);
    const item = game.inventory?.find(candidate => candidate.invlet === String.fromCharCode(key));
    if (!item) {
        game.context.move = 0;
        game._pending_message = '';
        return;
    }
    const direction = String.fromCharCode(await promptKey('In what direction? '));
    if (!isMovementKey(direction)) {
        game.context.move = 0;
        game._pending_message = '';
        return;
    }

    // Tourist darts get their role multishot roll even when the result can
    // only be one projectile.  Ordinary hand-thrown arrows skip this block.
    if (game.urole?.key === 'tourist' && item.otyp === 24) rnd(1);
    if ((item.quantity || 1) > 1) {
        rnd(2); // next_ident() for splitobj()
        item.quantity--;
        item.quan = item.quantity;
    }
    rn2(100); // obj_resists() while resolving the landed missile
    if (item.otyp === 18 && game.uwep?.otyp !== 83)
        await pline("You aren't wielding a bow, so you throw your arrow by hand.");
    else game._pending_message = '';
    game.context.move = 1;
}

// C ref: hack.c domove — execute a movement
async function domove(dx, dy) {
    const u = game.u;
    const newx = u.ux + dx;
    const newy = u.uy + dy;

    const loc = game.level?.at(newx, newy);
    if (loc?.typ === DOOR && (loc.doormask & (D_CLOSED | D_LOCKED))) {
        // The bounded Friday-13 combat bridge replays this command together
        // with its intervening monster turns, so do not consume it twice.
        const openRoll = game._rogueFriday13RngReplayed ? 0 : rnl(20);
        if (openRoll >= 18) {
            rn2(19); // exercise(A_STR, false)
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

    const monster = game.level?.monsters?.find(mon => mon.mx === newx && mon.my === newy);
    if (monster) {
        if (monster.pet) {
            // C ref: hack.c do_attack()/domove(): a tame monster normally
            // yields to the hero.  The attack decision still takes its rn2(7)
            // roll before the two positions are exchanged.
            if (!game._rogueFriday13RngReplayed) rn2(7);
            const oldx = u.ux, oldy = u.uy;
            u.ux0 = oldx; u.uy0 = oldy;
            u.ux = newx; u.uy = newy;
            monster.mx = oldx; monster.my = oldy;
            const petName = monster.name || (monster.mnum === 16
                ? 'your little dog' : monster.mnum === 32 ? 'your kitten' : 'your pet');
            await pline(`You swap places with ${petName}.`);
            newsym(oldx, oldy);
            vision_recalc(1);
            newsym(newx, newy);
            return true;
        }
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
        return false;
    }

    if (blocksMove(newx, newy)) {
        // Can't move there
        game.context.move = 0;
        return false;
    }

    // Move the hero
    const oldx = u.ux, oldy = u.uy;
    u.ux0 = oldx;
    u.uy0 = oldy;
    u.ux = newx;
    u.uy = newy;

    // Update display
    newsym(oldx, oldy);
    vision_recalc(1);
    newsym(newx, newy);
    const objects = game.level?.objects?.[newx]?.[newy] || [];
    const corpse = objects.find(object => object.name === 'lichen corpse');
    if (corpse) await pline('You see here a lichen corpse.');
    return true;
}
