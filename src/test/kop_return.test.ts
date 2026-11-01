import test from 'node:test';
import assert from 'node:assert/strict';

import { game, requireGameLevel } from '../js/gstate.js';
import { finishEnvironmentalMonsterDeath } from '../js/mon.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { requireFixtureGame } from './support/game-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

const KEYSTONE_KOP = MONSTER_NAME.indexOf('Keystone Kop');

async function killKop(roll: number) {
    await freshObjectRoom({ right: 30 });
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

// C mon.c:mondead() case 1 calls makemon(kop, stairs, NO_MM_FLAGS), and
// makemon.c:makemon() refuses when MON_AT(x, y) finds any monster there —
// including the dying Kop itself, which keeps its square until m_detach().
// A Kop that dies on the downstairs therefore blocks its own replacement.
void test('a Kop dying on the downstairs is not replaced by a roll of 1', async () => {
    await freshObjectRoom({ right: 30 });
    requireFixtureGame(game);
    game.stairs = {
        sx: 12, sy: 10, up: false, isladder: false, u_traversed: false,
        tolev: { dnum: 0, dlevel: 7 }, next: null,
    };
    const kop = await createMonsterAt('Keystone Kop', 12, 10);
    await finishEnvironmentalMonsterDeath(kop, game, { noCorpse: true, rollOne: () => 1 });
    assert.equal(requireGameLevel().monsters
        .filter(monster => monster.mnum === KEYSTONE_KOP && (monster.mhp ?? 1) > 0).length, 0);
});

void test('a Kop dying away from the stairs returns to them on a roll of 1', async () => {
    await freshObjectRoom({ right: 30 });
    requireFixtureGame(game);
    game.stairs = {
        sx: 20, sy: 10, up: false, isladder: false, u_traversed: false,
        tolev: { dnum: 0, dlevel: 7 }, next: null,
    };
    const kop = await createMonsterAt('Keystone Kop', 12, 10);
    await finishEnvironmentalMonsterDeath(kop, game, { noCorpse: true, rollOne: () => 1 });
    const replacement = requireGameLevel().monsters
        .filter(monster => monster.mnum === KEYSTONE_KOP && (monster.mhp ?? 1) > 0);
    assert.equal(replacement.length, 1);
    assert.equal(replacement[0]?.mx, 20);
    assert.equal(replacement[0]?.my, 10);
});

void test('a dead Kop stays gone on a return roll of 3 to 5', async () => {
    assert.equal(await killKop(5), 0);
});
