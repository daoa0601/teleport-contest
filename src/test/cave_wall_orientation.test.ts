import assert from 'node:assert/strict';
import test from 'node:test';
import { HWALL } from '../js/const.js';
import { mkmap } from '../js/mkmap.js';
import { initRng } from '../js/rng.js';
import { freshGame } from './support/game-state.js';

void test('cave wallification preserves the orientation field when turning rock into a wall', async () => {
    const { level } = freshGame();
    initRng(1);

    await mkmap({ lit: false, joined: false, walled: true });

    const walls = level.locations.flat().filter(loc => loc.typ === HWALL);
    assert.ok(walls.length > 0, 'the cave must have horizontal boundary walls');
    assert.ok(walls.every(wall => !wall.horizontal),
        'wallify_map changes terrain without setting the door orientation field');
});
