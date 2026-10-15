import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { PIT, TT_PIT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { BOULDER, DRUM_OF_EARTHQUAKE } from '../js/object_data.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
import { freshTurnRoom } from './support/playable-room.js';

void test('a boulder filling an earthquake chasm releases the hero trapped there', async () => {
    const input = freshTurnRoom({ heroLevel: 30, hero: {
        uhp: 1000, uhpmax: 1000, utrap: 50, utraptype: TT_PIT,
    } });
    assert.ok(game.level);
    addTrap(game.level, PIT, 10, 10);
    const boulder = await floorObject(BOULDER, 10, 10);
    const drum = await addInventoryObject(DRUM_OF_EARTHQUAKE, { spe: 10 });
    const expected = /playing|thunderous|shaking|chasm|boulder/;
    installPagerInput(input, { expected, limit: 150 });
    for (let attempt = 0; attempt < 10 && boulder.where !== 'gone'; attempt++) {
        pushKeys(`a${drum.invlet}`);

        await moveloop_core();
        await finishAtCommandInput(input, moveloop_core, expected);
    }

    assert.equal(boulder.where, 'gone', 'The boulder must fall into the new chasm');
    assert.equal(game.u.utrap, 0);
    assert.equal(game.level.traps.some(trap => trap.tx === 10 && trap.ty === 10), false);
});
