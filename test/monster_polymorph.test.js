import test from 'node:test';
import assert from 'node:assert/strict';

import { game } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { changeMonsterForm } from '../js/monster_polymorph.js';
import { LEASH } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { knownInventoryObject } from './support/game-objects.js';
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

    changeMonsterForm(monster, MONSTER_NAME.indexOf('little dog'));

    assert.equal(monster.wormno, 0);
    assert.deepEqual(monster.wormSegments, []);
});

test('a monster receives a worm body when it becomes a long worm', () => {
    freshObjectRoom();
    const monster = addMonster({ species: 'little dog', x: 11, y: 10 });
    initRng(1n);

    changeMonsterForm(monster, MONSTER_NAME.indexOf('long worm'));

    assert.ok(monster.wormno > 0);
    assert.ok(Array.isArray(monster.wormSegments));
});

test('a leashed monster pulls free when its new body cannot be leashed', () => {
    freshObjectRoom();
    const monster = addMonster({
        species: 'little dog', x: 11, y: 10, mleashed: 1,
    });
    const leash = knownInventoryObject(LEASH, { leashmon: monster.m_id });
    initRng(1n);

    changeMonsterForm(monster, MONSTER_NAME.indexOf('long worm'));

    assert.equal(monster.mleashed, 0);
    assert.equal(leash.leashmon, 0);
    assert.equal(game.inventory.includes(leash), true);
});
