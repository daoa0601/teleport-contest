import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { W_TOOL } from '../js/const.js';
import { game } from '../js/gstate.js';
import { BLINDFOLD, LENSES } from '../js/object_data.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';

void test('applying a blindfold wears it and applying it again removes it',
    async () => {
        freshPlayableRoom();
        requireFixtureGame(game);
        const blindfold = await addInventoryObject(BLINDFOLD, { invlet: 'a' });

        await applyInventoryObject('a');

        assert.equal(game.ublindf, blindfold);
        assert.equal(game.u.ublindf, blindfold);
        assert.equal(game.blind, true);
        assert.equal(blindfold.worn, true);
        assert.ok((blindfold.owornmask ?? 0) & W_TOOL);
        assert.equal(game.context.move, 1);

        await applyInventoryObject('a');

        assert.equal(game.ublindf, null);
        assert.equal(game.u.ublindf, null);
        assert.equal(game.blind, false);
        assert.equal(blindfold.worn, false);
        assert.equal((blindfold.owornmask ?? 0) & W_TOOL, 0);
        assert.equal(game.context.move, 1);
    });

void test('applying a cursed worn blindfold cannot remove it', async () => {
    freshPlayableRoom();
    requireFixtureGame(game);
    const blindfold = await addInventoryObject(BLINDFOLD, {
        invlet: 'a', cursed: true,
    });
    await applyInventoryObject('a');

    await applyInventoryObject('a');

    assert.equal(game.ublindf, blindfold);
    assert.equal(game.blind, true);
    assert.equal(game.context.move, 1);
});

void test('lenses occupy the eyewear slot without blinding the hero', async () => {
    freshPlayableRoom();
    requireFixtureGame(game);
    const lenses = await addInventoryObject(LENSES, { invlet: 'a' });
    const blindfold = await addInventoryObject(BLINDFOLD, { invlet: 'b' });

    await applyInventoryObject('a');
    await applyInventoryObject('b');

    assert.equal(game.ublindf, lenses);
    assert.equal(game.blind, false);
    assert.match(game._pending_message, /already wearing lenses/);
    assert.equal(game.context.move, 1);
});
