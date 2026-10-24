import test from 'node:test';
import assert from 'node:assert/strict';

import { wearHeroAccessory } from '../js/accessory.js';
import { NO_MINVENT } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { runMonsterAction } from '../js/monmove.js';
import { RIN_CONFLICT, TRIPE_RATION } from '../js/object_data.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { floorObjectsAt } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a conflicted pet attacks its master instead of eating food beneath the hero', async () => {
    freshObjectRoom({ left: 10, right: 11, top: 10, bottom: 10, flags: { verbose: false } });
    requirePlayingGame(game);
    await wearHeroAccessory(await addInventoryObject(RIN_CONFLICT), 'uleft');
    const cat = await createMonsterAt('housecat', 11, 10, NO_MINVENT);
    initializePet(cat, { state: game });
    const tripe = await floorObject(TRIPE_RATION, 10, 10);
    const heroHealth = game.u.uhp;
    pushKeys(' '.repeat(40));

    await runMonsterAction(cat, game, range => Math.min(1, range - 1), count => count, () => 1);

    assert.ok(game.u.uhp < heroHealth);
    assert.deepEqual([cat.mx, cat.my], [11, 10]);
    assert.deepEqual(floorObjectsAt(game.level, 10, 10), [tripe]);
});
