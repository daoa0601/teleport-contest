import test from 'node:test';
import assert from 'node:assert/strict';
import { GOLD_PIECE } from '../js/object_data.js';
import { scatterFloorObjects } from '../js/scatter.js';
import { floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { floorObjects } from './support/level-state.js';

void test('a large scattered stack splits into pieces within the native integer limit', async () => {
    const level = freshObjectRoom();
    const quantity = 32770;
    const gold = await floorObject(GOLD_PIECE, 14, 10, { quan: quantity });
    const directions = [0, 4, 6];
    let direction = 0;

    const moved = await scatterFloorObjects(14, 10, 1, {
        onlyObject: gold, mayDestroy: false, mayHitHero: false, mayHitMonsters: false,
        random: () => directions[direction++] ?? 0,
        rollOne: maximum => maximum,
    });

    const pieces = floorObjects(level).filter(object => object.otyp === GOLD_PIECE);
    assert.equal(moved, quantity);
    assert.equal(pieces.length, 3);
    assert.ok(pieces.every(piece => piece.quan <= 32767));
});
