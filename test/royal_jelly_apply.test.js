import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import {
    EGG, LUMP_OF_ROYAL_JELLY,
} from '../js/object_data.js';
import {
    OBJECT_TIMER_KIND, objectTimers, scheduleObjectTimer,
} from '../js/object_timers.js';
import { initRng } from '../js/rng.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';

test('blessed royal jelly turns a killer bee egg into a queen bee egg',
    async () => {
        freshPlayableRoom();
        const jelly = addInventoryObject(LUMP_OF_ROYAL_JELLY, {
            invlet: 'a',
            blessed: true,
            quan: 2,
            quantity: 2,
        });
        const egg = addInventoryObject(EGG, {
            invlet: 'b',
            corpsenm: 1,
            spe: 0,
        });
        initRng(4401n);
        await applyInventoryObject(jelly, 'b ');

        assert.equal(jelly.quan, 1);
        assert.equal(egg.corpsenm, 5);
        assert.equal(egg.spe, 2);
        assert.equal(objectTimers(egg)[0]?.kind,
            OBJECT_TIMER_KIND.HATCH_EGG);
        assert.equal(game.context.move, 1);
    });

test('rubbing cursed royal jelly on an egg stops it from hatching',
    async () => {
        freshPlayableRoom();
        const jelly = addInventoryObject(LUMP_OF_ROYAL_JELLY, {
            invlet: 'a',
            cursed: true,
        });
        const egg = addInventoryObject(EGG, {
            invlet: 'b', corpsenm: 94,
        });
        scheduleObjectTimer(
            egg,
            OBJECT_TIMER_KIND.HATCH_EGG,
            200,
            game,
        );
        initRng(4402n);
        pushKeys('rub\nab ');

        await rhack('#'.charCodeAt(0));

        assert.equal(jelly.where, 'gone');
        assert.equal(game.inventory.includes(jelly), false);
        assert.equal(objectTimers(egg).length, 0);
        assert.match(game._pending_message, /quivers feebly/);
        assert.equal(game.context.move, 1);
    });

test('royal jelly returns to its stack when there is no egg', async () => {
    freshPlayableRoom();
    const jelly = addInventoryObject(LUMP_OF_ROYAL_JELLY, {
        invlet: 'a',
        quan: 2,
        quantity: 2,
    });
    initRng(4403n);
    await applyInventoryObject(jelly);

    assert.deepEqual(game.inventory, [jelly]);
    assert.equal(jelly.quan, 2);
    assert.equal(jelly.quantity, 2);
    assert.equal(game.context.move, 0);
    assert.match(game._pending_message, /don't have anything to rub/);
});
