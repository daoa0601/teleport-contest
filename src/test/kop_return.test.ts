import test from 'node:test';
import assert from 'node:assert/strict';

import { game, requireGameLevel } from '../js/gstate.js';
import { finishEnvironmentalMonsterDeath } from '../js/monster_death.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { requireFixtureGame } from './support/game-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

const KEYSTONE_KOP = MONSTER_NAME.indexOf('Keystone Kop');

async function killKop(roll: number) {
    freshObjectRoom({ right: 30 });
    requireFixtureGame(game);
    const kop = await createMonsterAt('Keystone Kop', 12, 10);
    await finishEnvironmentalMonsterDeath(kop, game, { noCorpse: true, rollOne: () => roll });
    return requireGameLevel().monsters
        .filter(monster => monster.mnum === KEYSTONE_KOP && (monster.mhp ?? 1) > 0).length;
}

void test('a dead Kop comes back on a return roll of 1 or 2', async () => {
    assert.ok(KEYSTONE_KOP >= 0);
    assert.equal(await killKop(2), 1);
});

void test('a dead Kop stays gone on a return roll of 3 to 5', async () => {
    assert.equal(await killKop(5), 0);
});
