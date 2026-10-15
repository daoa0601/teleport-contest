import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { DRUM_OF_EARTHQUAKE } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
import { freshTurnRoom } from './support/playable-room.js';

void test('an earthquake angers peaceful monsters through the ordinary attack rules', async () => {
    const input = freshTurnRoom({ hero: { levitating: true, uhp: 1000, uhpmax: 1000 } });
    const goblin = await createMonsterAt('goblin', 11, 10);
    goblin.mpeaceful = 1;
    goblin.mhp = goblin.mhpmax = 100;
    assert.ok(game.u.ualign);
    const alignment = game.u.ualign.record;
    const drum = await addInventoryObject(DRUM_OF_EARTHQUAKE, { spe: 2 });
    installPagerInput(input, { expected: /playing|thunderous|shaking|chasm|wakes|angry|flee|misses|hits/, limit: 20 });
    pushKeys(`a${drum.invlet}`);

    await moveloop_core();
    await finishAtCommandInput(input, moveloop_core, /playing|thunderous|shaking|chasm|angry|flee|misses|hits|^$/);

    assert.equal(goblin.mpeaceful, 0);
    assert.equal(game.u.ualign.record, alignment - 1);
});
