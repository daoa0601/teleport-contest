import test from 'node:test';
import assert from 'node:assert/strict';
import { W_TOOL } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { BLINDFOLD, CREAM_PIE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { syncBlindness } from '../js/senses.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';
void test('applying one pie from a stack blinds the hero without taking a turn', async () => {
    freshPlayableRoom();
    requirePlayingGame(game);
    const pies = await addInventoryObject(CREAM_PIE, {
        invlet: 'a',
        quan: 2,
        quantity: 2,
        owt: 20,
    });
    initRng(4301n);
    await applyInventoryObject(pies, ' ');
    assert.equal(pies.quan, 1);
    assert.equal(pies.quantity, 1);
    assert.equal(pies.where, 'inventory');
    assert.ok((game.u.blindTurns ?? 0) > 0);
    assert.equal(game.u.ucreamed, game.u.blindTurns);
    assert.equal(game.blind, true);
    assert.equal(game.context.move, 0);
    assert.match(game._pending_message, /sticky goop/);
});
void test("a blindfold keeps an applied cream pie out of the hero's eyes", async () => {
    freshPlayableRoom();
    requirePlayingGame(game);
    const blindfold = await addInventoryObject(BLINDFOLD, {
        invlet: 'b',
        worn: true,
        wornSlot: 'ublindf',
        owornmask: W_TOOL,
    });
    const pie = await addInventoryObject(CREAM_PIE, { invlet: 'a' });
    game.ublindf = game.u.ublindf = blindfold;
    syncBlindness(game);
    initRng(4302n);
    await applyInventoryObject(pie);
    assert.equal(pie.where, 'gone');
    assert.equal(game.inventory.includes(pie), false);
    assert.equal(game.u.blindTurns ?? 0, 0);
    assert.equal(game.u.ucreamed ?? 0, 0);
    assert.equal(game.context.move, 0);
});
void test('another cream pie adds more goop while the hero is already blind', async () => {
    freshPlayableRoom();
    requirePlayingGame(game);
    const pie = await addInventoryObject(CREAM_PIE, { invlet: 'a' });
    game.u.blindTurns = 5;
    game.u.ucreamed = 2;
    syncBlindness(game);
    initRng(4303n);
    await applyInventoryObject(pie, ' ');
    assert.ok((game.u.blindTurns ?? 0) > 5);
    assert.ok(game.u.ucreamed > 2);
    assert.match(game._pending_message, /more sticky goop/);
    assert.equal(game.context.move, 0);
});
//# sourceMappingURL=cream_pie_apply.test.js.map