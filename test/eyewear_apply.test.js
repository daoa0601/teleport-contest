import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { W_TOOL } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKey } from '../js/input.js';
import { BLINDFOLD, LENSES } from '../js/object_data.js';
import { inventoryObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';

async function applyInventoryObject(letter) {
    pushKey(letter);
    await rhack('a'.charCodeAt(0));
}

test('applying a blindfold wears it and applying it again removes it',
    async () => {
        freshPlayableRoom();
        const blindfold = inventoryObject(BLINDFOLD, 'a');
        game.inventory = [blindfold];

        await applyInventoryObject('a');

        assert.equal(game.ublindf, blindfold);
        assert.equal(game.u.ublindf, blindfold);
        assert.equal(game.blind, true);
        assert.equal(blindfold.worn, true);
        assert.ok(blindfold.owornmask & W_TOOL);
        assert.equal(game.context.move, 1);

        await applyInventoryObject('a');

        assert.equal(game.ublindf, null);
        assert.equal(game.u.ublindf, null);
        assert.equal(game.blind, false);
        assert.equal(blindfold.worn, false);
        assert.equal(blindfold.owornmask & W_TOOL, 0);
        assert.equal(game.context.move, 1);
    });

test('applying a cursed worn blindfold cannot remove it', async () => {
    freshPlayableRoom();
    const blindfold = inventoryObject(BLINDFOLD, 'a', { cursed: true });
    game.inventory = [blindfold];
    await applyInventoryObject('a');

    await applyInventoryObject('a');

    assert.equal(game.ublindf, blindfold);
    assert.equal(game.blind, true);
    assert.equal(game.context.move, 1);
});

test('lenses occupy the eyewear slot without blinding the hero', async () => {
    freshPlayableRoom();
    const lenses = inventoryObject(LENSES, 'a');
    const blindfold = inventoryObject(BLINDFOLD, 'b');
    game.inventory = [lenses, blindfold];

    await applyInventoryObject('a');
    await applyInventoryObject('b');

    assert.equal(game.ublindf, lenses);
    assert.equal(game.blind, false);
    assert.equal(blindfold.worn, false);
    assert.match(game._pending_message, /already wearing lenses/);
    assert.equal(game.context.move, 1);
});
