import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { LAVAPOOL, ROOM } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { DRUM_OF_EARTHQUAKE } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
import { freshTurnRoom } from './support/playable-room.js';

void test('lava flowing into an earthquake chasm lights its new square', async () => {
    const input = freshTurnRoom({ seed: 1n, heroLevel: 30 });
    grantIntrinsicProperty('levitation', 'outside');
    assert.ok(game.level);
    const center = game.level.requireAt(10, 10);
    for (let x = 9; x <= 11; x++) {
        for (let y = 9; y <= 11; y++) game.level.requireAt(x, y).typ = LAVAPOOL;
    }
    center.typ = ROOM;
    center.lit = false;
    const drum = await addInventoryObject(DRUM_OF_EARTHQUAKE, { spe: 10 });
    installPagerInput(input, { expected: /playing|thunderous|shaking|chasm|fall in/, limit: 80 });
    for (let attempt = 0; attempt < 10 && center.typ === ROOM; attempt++) {
        pushKeys(`a${drum.invlet}`);

        await moveloop_core();
        await finishAtCommandInput(input, moveloop_core, /playing|thunderous|shaking|chasm|fall in/);
    }

    assert.equal(center.typ, LAVAPOOL, 'Nearby lava must flow into the new chasm');
    assert.equal(center.lit, true);
    assert.equal(game.level.traps.some(trap => trap.tx === 10 && trap.ty === 10), false);
});
