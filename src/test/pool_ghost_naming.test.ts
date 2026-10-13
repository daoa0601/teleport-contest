import assert from 'node:assert/strict';
import test from 'node:test';

import { game, requireGameLevel } from '../js/gstate.js';
import { mklev } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { monsterName, possessiveName } from '../js/monster_name.js';
import { freshObjectRoom } from './support/object-room.js';

void test('the sleeping Rogue-level ghost is addressed by its assigned name', async () => {
    freshObjectRoom({ gameplaySeed: 17n });
    game.rogue_level = { dnum: 0, dlevel: 8 };

    await mklev();
    const level = requireGameLevel();
    const ghost = level.monsters.find(monster => monster.mnum === MONSTER_NAME.indexOf('ghost'));

    assert.ok(ghost);
    assert.ok(ghost.name);
    assert.equal(monsterName(ghost, { suppressIt: true }), `${possessiveName(ghost.name)} ghost`);
});
