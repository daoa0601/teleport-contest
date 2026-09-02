import test from 'node:test';
import assert from 'node:assert/strict';

import { W_TOOL } from '../js/const.js';
import { game } from '../js/gstate.js';
import { BLINDFOLD, CREAM_PIE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { syncBlindness } from '../js/senses.js';
import { applyInventoryObject } from './support/commands.js';
import { inventoryObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';

test('applying one pie from a stack blinds the hero without taking a turn',
    async () => {
        freshPlayableRoom();
        const pies = inventoryObject(CREAM_PIE, 'a', {
            quan: 2,
            quantity: 2,
            owt: 20,
        });
        game.inventory = [pies];
        initRng(4301n);
        await applyInventoryObject(pies, ' ');

        assert.equal(pies.quan, 1);
        assert.equal(pies.quantity, 1);
        assert.equal(pies.where, 'inventory');
        assert.ok(game.u.blindTurns > 0);
        assert.equal(game.u.ucreamed, game.u.blindTurns);
        assert.equal(game.blind, true);
        assert.equal(game.context.move, 0);
        assert.match(game._pending_message, /sticky goop/);
    });

test("a blindfold keeps an applied cream pie out of the hero's eyes",
    async () => {
        freshPlayableRoom();
        const blindfold = inventoryObject(BLINDFOLD, 'b', {
            worn: true,
            wornSlot: 'ublindf',
            owornmask: W_TOOL,
        });
        const pie = inventoryObject(CREAM_PIE, 'a');
        game.inventory = [pie, blindfold];
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

test('another cream pie adds more goop while the hero is already blind',
    async () => {
        freshPlayableRoom();
        const pie = inventoryObject(CREAM_PIE, 'a');
        game.inventory = [pie];
        game.u.blindTurns = 5;
        game.u.ucreamed = 2;
        syncBlindness(game);
        initRng(4303n);
        await applyInventoryObject(pie, ' ');

        assert.ok(game.u.blindTurns > 5);
        assert.ok(game.u.ucreamed > 2);
        assert.match(game._pending_message, /more sticky goop/);
        assert.equal(game.context.move, 0);
    });
