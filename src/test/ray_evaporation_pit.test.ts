import assert from 'node:assert/strict';
import test from 'node:test';
import { PIT, POOL, ROOM } from '../js/const.js';
import { game } from '../js/gstate.js';
import { initRng } from '../js/rng.js';
import { applyRayFloorFeatures } from '../js/zap.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

// C zap.c:zap_over_floor() boils a pool into a pit and calls mintrap() on a
// monster there, which finishes the fall: message, damage and trap sighting.
void test('a swimmer under a pool boiled into a pit falls into the new pit', async () => {
    const level = freshObjectRoom();
    level.requireAt(11, 10).typ = POOL;
    const eel = await createMonsterAt('giant eel', 11, 10);
    eel.mundetected = 0;
    eel.mhp = eel.mhpmax = 60;
    const messages: string[] = [];
    initRng(5n);

    await applyRayFloorFeatures('fire', 11, 10, game, {
        publish: async message => { messages.push(message); },
    });

    assert.equal(level.requireAt(11, 10).typ, ROOM);
    const pit = level.traps.find(trap => trap.tx === 11 && trap.ty === 10);
    assert.equal(pit?.ttyp, PIT);
    assert.equal(eel.mtrapped, 1);
    assert.ok(messages.some(message => /giant eel falls into a pit!/i.test(message)), messages.join('\n'));
    assert.equal(pit?.tseen, true);
    assert.ok(eel.mhp < 60);
});
