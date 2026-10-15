import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { WOODEN_HARP } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
import { freshTurnRoom } from './support/playable-room.js';
import { createSpecialLevel } from './support/topology.js';

void test('playing the correct castle tune away from its drawbridge gives no tune knowledge', async () => {
    const input = freshTurnRoom();
    assert.ok(game.u.uz);
    game.stronghold_level = createSpecialLevel(game.u.uz);
    game.castleTune = 'ABCDE';
    const harp = await addInventoryObject(WOODEN_HARP);
    installPagerInput(input, { expected: /strange sound/, limit: 3 });
    pushKeys(`a${harp.invlet}nABCDE\n`);

    await moveloop_core();
    await finishAtCommandInput(input, moveloop_core, /strange sound|^$/);

    assert.equal(game.u.uevent?.uheard_tune ?? 0, 0);
});
