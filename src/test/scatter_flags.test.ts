import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { POT_FRUIT_JUICE } from '../js/object_data.js';
import { scatterFloorObjects } from '../js/scatter.js';
import { floorObject } from './support/game-objects.js';
import { installSwallowedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a missile that ignores monsters also passes the swallowed hero at their shared square', async () => {
    freshObjectRoom();
    const swallower = await createMonsterAt('purple worm', 12, 10);
    await installSwallowedHero(swallower);
    await floorObject(POT_FRUIT_JUICE, 11, 10);
    const hp = game.u.uhp;

    await scatterFloorObjects(11, 10, 2, {
        mayDestroy: false, mayHitMonsters: false, mayHitHero: true,
        random: () => 0, rollOne: () => 1,
    });

    assert.equal(game.u.uhp, hp);
});
