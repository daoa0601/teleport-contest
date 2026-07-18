// cmd.js — Command dispatch and movement.
// C ref: cmd.c rhack(), hack.c domove().
//
// Minimal skeleton: only hjklyubn movement is implemented.
// Contestants should add: search, kick, eat, drink, read, zap,
// wear, wield, drop, throw, pray, cast, and all other commands.

import { game } from './gstate.js';
import { nhgetch } from './input.js';
import {
    newsym, flush_screen, pline, docrt, bot, _statusLine1, _statusLine2,
} from './display.js';
import { vision_recalc } from './vision.js';
import { ddoinv, dolook } from './invent.js';
import { dovspell } from './spell.js';
import { dodiscovered } from './o_init.js';
import { doattributes } from './insight.js';
import { dosearch } from './detect.js';
import { showTextPages } from './windows.js';
import { rnd, rn2 } from './rng.js';
import { getRumor } from './mklev.js';
import { FORTUNE_COOKIE } from './object_data.js';
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
        key = await nhgetch();
    }

    const ch = String.fromCharCode(key);

    // The input boundary displayed the previous command's message.  Clear it
    // now; any message produced below remains visible at the next boundary.
    game._pending_message = '';

    if (isMovementKey(ch)) {
        await domove(DIR_DX[ch], DIR_DY[ch]);
        game.context.move = 1;
    } else if (ch === 'i') {
        await ddoinv();
    } else if (ch === '+') {
        await dovspell();
    } else if (ch === '\\') {
        await dodiscovered();
    } else if (key === 24) { // Ctrl-X
        await doattributes();
    } else if (ch === 's') {
        await dosearch();
    } else if (ch === 'e') {
        await doeat();
    } else if (ch === 'a') {
        await doapply();
    } else if (ch === ':') {
        await dolook();
    } else if (ch === 'Q') {
        await doready();
    } else if (ch === 't') {
        await dothrow();
    } else if (ch === '_') {
        await dotravel();
    } else if (key === 27) { // Escape cancels without producing a message.
        game.context.move = 0;
    } else {
        // Unknown command
        game.context.move = 0;
        await pline(`Unknown command '${ch}'.`);
    }
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

// C refs: eat.c doeat(), done_eating(), fpostfx(); rumors.c outrumor().
// Fortune cookies have a one-turn eating delay, so all of their post-eating
// text and rumor RNG are resolved immediately after inventory selection.
async function doeat() {
    const edible = (game.inventory || []).filter(item => item.oclass === 7);
    const letters = edible.map(item => item.invlet).join('');
    const key = await promptKey(`What do you want to eat? [${letters} or ?*] `);
    const item = edible.find(candidate => candidate.invlet === String.fromCharCode(key));
    if (!item) {
        game.context.move = 0;
        game._pending_message = '';
        return;
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

    item.quantity = (item.quantity ?? 1) - 1;
    item.quan = item.quantity;
    if (item.quantity <= 0)
        game.inventory = game.inventory.filter(candidate => candidate !== item);
    await pline(`This ${item.name} is delicious!`);
    game.context.move = 1;
}

// C refs: apply.c doapply(); invent.c getobj().  getobj keeps an invalid
// selection message visible while collecting the key that dismisses --More--;
// a non-space printable key is then treated as another selection attempt.
async function doapply() {
    const applicable = (game.inventory || []).filter(item => item.oclass === 6);
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
    const letters = (game.inventory || [])
        .filter(item => item.otyp === 18 || item.otyp === 24 || item.otyp === 83)
        .map(item => item.invlet)
        .join('');
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
    game.context.move = 1;
}

// C ref: hack.c domove — execute a movement
async function domove(dx, dy) {
    const u = game.u;
    const newx = u.ux + dx;
    const newy = u.uy + dy;

    if (blocksMove(newx, newy)) {
        // Can't move there
        game.context.move = 0;
        return;
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
}
