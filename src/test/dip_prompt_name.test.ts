import assert from 'node:assert/strict';
import test from 'node:test';

import { rhack } from '../js/cmd.js';
import { W_ARMC, W_ARMG } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { CLOAK_OF_MAGIC_RESISTANCE, LEATHER_GLOVES, POT_OIL } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';

function screenRow(row: number): string {
    return requireScreenRow(row).map(cell => cell.ch).join('').trimEnd();
}

// C potion.c:dodip() formats the dip target once with
// short_oname(doname, thesimpleoname, 50): 128 minus the sizeof of the
// longest "What do you want to dip into? [...] " prompt. "an uncursed +0
// pair of leather gloves (being worn)" is exactly 50 characters, so the
// known-status adjective survives into the empty-inventory refusal.
void test('a full-length dip target keeps its uncursed adjective in the refusal', async () => {
    freshObjectRoom({ flags: { verbose: true } });
    const gloves = await addInventoryObject(LEATHER_GLOVES, {
        spe: 0, owornmask: W_ARMG,
    });
    game.uarmg = gloves;
    const input = resetInputState();
    input.feed('dip\n');
    const dipping = rhack('#'.charCodeAt(0));
    await input.waitUntilBlocked();
    assert.equal(screenRow(0), 'What do you want to dip? [a or ?*]');

    input.feed(gloves.invlet);
    await input.waitUntilBlocked();
    // The 91-character refusal wraps and waits behind --More--, exactly as
    // the tty topline renders it.
    assert.equal(screenRow(0),
        'You don\'t have anything to dip an uncursed +0 pair of leather gloves (being');
    assert.equal(screenRow(1), 'worn) into.--More--');

    input.feed(' ');
    await dipping;
    assert.equal(game.context.move, 0);
});

// A 52-character doname overflows the limit, so short_oname() strips the
// known-status attributes and re-donames the cloak without "uncursed".
void test('an over-long dip target loses its uncursed adjective first', async () => {
    freshObjectRoom({ flags: { verbose: true } });
    const cloak = await addInventoryObject(CLOAK_OF_MAGIC_RESISTANCE, {
        spe: 0, owornmask: W_ARMC,
    });
    game.uarmc = cloak;
    const input = resetInputState();
    input.feed('dip\n');
    const dipping = rhack('#'.charCodeAt(0));
    await input.waitUntilBlocked();
    input.feed(cloak.invlet);
    await input.waitUntilBlocked();
    assert.equal(screenRow(0),
        'You don\'t have anything to dip a +0 cloak of magic resistance (being worn)');
    assert.equal(screenRow(1), 'into.--More--');

    input.feed(' ');
    await dipping;
});

// With a potion carried, the same formatted name becomes the second getobj
// prompt asking what to dip the item into.
void test('the dip-into prompt spells out the worn target with its enchantment', async () => {
    freshObjectRoom({ flags: { verbose: true } });
    const gloves = await addInventoryObject(LEATHER_GLOVES, {
        spe: 2, owornmask: W_ARMG,
    });
    game.uarmg = gloves;
    const potion = await addInventoryObject(POT_OIL);
    const input = resetInputState();
    input.feed('dip\n');
    const dipping = rhack('#'.charCodeAt(0));
    await input.waitUntilBlocked();
    input.feed(gloves.invlet);
    await input.waitUntilBlocked();
    assert.equal(screenRow(0),
        'What do you want to dip an uncursed +2 pair of leather gloves (being worn) into');
    assert.equal(screenRow(1), `? [${potion.invlet} or ?*]`);

    input.feed('\x1b');
    await dipping;
    assert.equal(game.context.move, 0);
});
