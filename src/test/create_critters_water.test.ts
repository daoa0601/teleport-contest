import test from 'node:test';
import assert from 'node:assert/strict';

import { G_GENOD, POOL } from '../js/const.js';
import { game } from '../js/gstate.js';
import { createCritters } from '../js/mklev.js';
import { MONSTER_NAME, SPECIAL_PM } from '../js/monster_data.js';
import { freshObjectRoom } from './support/object-room.js';

void test('creation in water places the monster at a wet square without revealing the hero to it', async () => {
    const level = freshObjectRoom({ gameplaySeed: 1n, hero: { uinwater: true } });
    for (let x = 9; x <= 11; x++) {
        for (let y = 9; y <= 11; y++) level.requireAt(x, y).typ = POOL;
    }
    const nymph = MONSTER_NAME.indexOf('water nymph');
    game.mvitals = Array.from({ length: SPECIAL_PM }, (_, species) => ({
        born: 0, died: 0, mvflags: species === nymph ? 0 : G_GENOD,
    }));

    await createCritters(1);

    assert.equal(level.monsters.length, 1);
    const monster = level.monsters[0];
    assert.ok(monster);
    assert.equal(level.requireAt(monster.mx, monster.my).typ, POOL);
    assert.equal(monster.mux, 0, 'an explicitly selected wet square does not run the by-hero targeting step');
    assert.equal(monster.muy, 0);
});
