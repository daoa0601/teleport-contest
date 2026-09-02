import test from 'node:test';
import assert from 'node:assert/strict';

import { MONSTER_NAME } from '../js/monster_data.js';
import { shapechangeMonster } from '../js/monster_polymorph.js';
import { initRng } from '../js/rng.js';
import { addMonster } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

test('a long worm loses its old body when it changes form', () => {
    freshObjectRoom();
    const monster = addMonster({
        species: 'long worm',
        x: 11,
        y: 10,
        wormno: 1,
        wormSegments: [{ x: 10, y: 10 }, { x: 9, y: 10 }],
    });
    initRng(1n);

    shapechangeMonster(monster, MONSTER_NAME.indexOf('little dog'));

    assert.equal(monster.wormno, 0);
    assert.deepEqual(monster.wormSegments, []);
});

test('a monster receives a worm body when it becomes a long worm', () => {
    freshObjectRoom();
    const monster = addMonster({ species: 'little dog', x: 11, y: 10 });
    initRng(1n);

    shapechangeMonster(monster, MONSTER_NAME.indexOf('long worm'));

    assert.ok(monster.wormno > 0);
    assert.ok(Array.isArray(monster.wormSegments));
});
