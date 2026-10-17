import test from 'node:test';
import assert from 'node:assert/strict';
import { bot } from '../js/display.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { CORPSE } from '../js/object_data.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('status redraw measures the current load after a corpse loses weight', async () => {
    freshObjectRoom();
    game._encumbranceLevel = 1;
    await addInventoryObject(CORPSE, { corpsenm: MONSTER_NAME.indexOf('jackal'), oeaten: 31 });

    await bot();

    const status = requireGameDisplay(game).grid[23]?.map(cell => cell.ch).join('') ?? '';
    assert.doesNotMatch(status, /Burdened/);
});
