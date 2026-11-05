import assert from 'node:assert/strict';
import test from 'node:test';

import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { resetInputState } from '../js/input.js';
import { CLOAK_OF_MAGIC_RESISTANCE, ORCISH_DAGGER, SCR_IDENTIFY } from '../js/object_data.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';

// C win/tty/wintty.c:tty_display_nhwindow(WIN_MESSAGE) only erases the row
// for TOPLINE_NEED_MORE; a seen (TOPLINE_NON_EMPTY) line becomes
// TOPLINE_EMPTY while staying visible, and tty_clear_nhwindow(WIN_MESSAGE)
// then no-ops on it.  invent.c:look_here()'s pile window relies on both, so
// the last autodescribe line survives the window and the next command's
// parse()-time clear_nhwindow(WIN_MESSAGE).
function topline(): string {
    return requireScreenRow(0).map(cell => cell.ch).join('').trimEnd();
}

async function readyJumper() {
    await freshObjectRoom({ flags: { tips: false, pickup: false } });
    grantIntrinsicProperty('jumping', 'form');
    return resetInputState();
}

void test('a seen autodescribe line survives look_here\'s pile window and the next command', async () => {
    const input = await readyJumper();
    await floorObject(SCR_IDENTIFY, 12, 11);
    await floorObject(ORCISH_DAGGER, 12, 11);

    input.feed('jump\n');
    const command = rhack('#'.charCodeAt(0));
    await input.waitUntilBlocked();
    assert.match(topline(), /Where do you want to jump/);
    input.feed('l');
    await input.waitUntilBlocked();
    input.feed('n');
    await input.waitUntilBlocked();
    const described = topline();
    assert.match(described, /scroll of identify|orcish dagger/);
    input.feed('.');
    await input.waitUntilBlocked();
    assert.match(topline(), /Things that are here:/);
    input.feed(' ');
    await command;
    assert.equal(game.u.ux, 12);
    assert.equal(game.u.uy, 11);
    assert.equal(topline(), described);
    input.feed('.');
    await rhack(0);
    assert.equal(topline(), described);
});

void test('a dismissed overlay menu clips the seen line at its left edge', async () => {
    const input = await readyJumper();
    const cloak = await addInventoryObject(CLOAK_OF_MAGIC_RESISTANCE, {});
    input.feed(cloak.invlet);
    await rhack('W'.charCodeAt(0));
    assert.equal(game.uarmc, cloak);

    await floorObject(ORCISH_DAGGER, 12, 11);
    await floorObject(SCR_IDENTIFY, 12, 11);
    input.feed('jump\n');
    const command = rhack('#'.charCodeAt(0));
    await input.waitUntilBlocked();
    input.feed('l');
    await input.waitUntilBlocked();
    input.feed('n');
    await input.waitUntilBlocked();
    const described = topline();
    assert.match(described, /scroll of identify/);
    input.feed('.');
    await input.waitUntilBlocked();
    input.feed(' ');
    await command;
    assert.equal(topline(), described);

    // 'A' takes off all armor: the overlay menu lists the long-named cloak.
    // C dismisses it with docorner (wintty.c:3741-3744), cl_end()ing row 0
    // from the window's left edge, so the seen line survives only before
    // that edge and stays clipped through later silent commands.
    input.feed('A');
    input.feed('\x1b');
    await rhack(0);
    const clipped = topline();
    assert.ok(clipped.startsWith('an uncursed scroll'),
        `unexpected topline ${JSON.stringify(clipped)}`);
    assert.ok(clipped.length < described.length,
        `topline was not clipped: ${JSON.stringify(clipped)}`);
    input.feed('.');
    await rhack(0);
    assert.equal(topline(), clipped);
});

void test('without a pile the seen autodescribe line is cleared at the next command', async () => {
    const input = await readyJumper();

    input.feed('jump\n');
    const command = rhack('#'.charCodeAt(0));
    await input.waitUntilBlocked();
    input.feed('l');
    await input.waitUntilBlocked();
    input.feed('n');
    await input.waitUntilBlocked();
    assert.match(topline(), /floor of a room/);
    input.feed('.');
    await command;
    assert.equal(game.u.ux, 12);
    assert.equal(game.u.uy, 11);
    assert.match(topline(), /floor of a room/);
    input.feed('.');
    await rhack(0);
    assert.equal(topline(), '');
});
