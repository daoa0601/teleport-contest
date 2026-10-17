import assert from 'node:assert/strict';
import test from 'node:test';
import { game } from '../js/gstate.js';
import { ddoinv } from '../js/invent.js';
import { resetInputState } from '../js/input.js';
import { KATANA } from '../js/object_data.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';

void test('Return closes an inventory action menu without choosing an action', async () => {
    freshPlayableRoom();
    const katana = await addInventoryObject(KATANA, { invlet: 'a' });
    resetInputState().feed('a\n');

    const action = await ddoinv();

    assert.equal(action, null);
    assert.equal(game.inventory.includes(katana), true);
    assert.equal(game.context.move, 0);
});

void test('Return closes the here-command menu without spending a turn', async () => {
    freshPlayableRoom();
    resetInputState();

    await runExtendedCommand('herecmdmenu', '\n');

    assert.equal(game.context.move, 0);
});
