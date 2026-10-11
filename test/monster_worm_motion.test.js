import { assertWormBody } from './support/worms.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { MM_ANGRY, MM_NOTAIL, NO_MINVENT, STONE } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { rhack } from '../js/cmd.js';
import { initializePet } from '../js/dog.js';
import { adjustMonsterSpeed } from '../js/monster_speed.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { moveHeroByTeleport } from '../js/teleport.js';
import { monsterAtPosition } from '../js/monster_location.js';
import { runMonsterAction } from '../js/monmove.js';
import { initRng } from '../js/rng.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
async function headOnlyWorm() {
    freshObjectRoom({ left: 8, right: 20, top: 10, bottom: 10,
        heroX: 8, heroY: 10 });
    requirePlayingGame(game);
    const worm = await createMonsterAt('long worm', 14, 10, MM_ANGRY | MM_NOTAIL | NO_MINVENT);
    pushKeys(' '.repeat(100));
    assertWormBody(worm);
    initRng(1n);
    return worm;
}
void test('a new worm grows from its old head on its first ordinary move', async () => {
    const worm = await headOnlyWorm();
    requirePlayingGame(game);
    const health = worm.mhp;
    await runMonsterAction(worm, game);
    assert.deepEqual([worm.mx, worm.my], [13, 10]);
    assert.equal(monsterAtPosition(game.level, 14, 10), worm);
    assert.ok(worm.mhp >= health + 2 && worm.mhp <= health + 4);
    assert.equal(worm.mhpmax, worm.mhp);
    assert.ok(worm.wormGrowTime > game.moves && worm.wormGrowTime <= game.moves + 5);
});
void test('a worm translates its tail without growing before its deadline', async () => {
    const worm = await headOnlyWorm();
    requirePlayingGame(game);
    await runMonsterAction(worm, game);
    const health = worm.mhp;
    const deadline = worm.wormGrowTime;
    await runMonsterAction(worm, game);
    assert.deepEqual([worm.mx, worm.my], [12, 10]);
    assert.equal(monsterAtPosition(game.level, 13, 10), worm);
    assert.equal(monsterAtPosition(game.level, 14, 10), null);
    assert.equal(worm.mhp, health);
    assert.equal(worm.wormGrowTime, deadline);
});
void test('a worm does not shrink when no movement square is legal', async () => {
    const worm = await headOnlyWorm();
    requirePlayingGame(game);
    await runMonsterAction(worm, game);
    game.level.requireAt(12, 10).typ = STONE;
    const health = worm.mhp;
    const deadline = worm.wormGrowTime;
    await runMonsterAction(worm, game);
    assert.deepEqual([worm.mx, worm.my], [13, 10]);
    assert.equal(monsterAtPosition(game.level, 14, 10), worm);
    assert.equal(worm.mhp, health);
    assert.equal(worm.wormGrowTime, deadline);
});
void test('a tame worm with a body uses ordinary movement and grows', async () => {
    const worm = await headOnlyWorm();
    requirePlayingGame(game);
    initializePet(worm, { state: game });
    const health = worm.mhp;
    await runMonsterAction(worm, game);
    assert.notEqual(worm.mx, 14);
    assert.equal(monsterAtPosition(game.level, 14, 10), worm);
    assert.ok(worm.mhp > health);
});
for (const [level, health, maximum] of [[0, 10, 10], [8, 180, 200]]) {
    void test(`worm growth preserves the previous HP peak at level ${level}`, async () => {
        const worm = await headOnlyWorm();
        requirePlayingGame(game);
        worm.m_lev = level;
        worm.mhp = health;
        worm.mhpmax = maximum;
        await runMonsterAction(worm, game);
        assert.equal(monsterAtPosition(game.level, 14, 10), worm);
        assert.equal(worm.mhp, health);
        assert.equal(worm.mhpmax, maximum);
    });
}
void test('a peaceful worm shrinks when its only legal square was just kicked', async () => {
    const worm = await headOnlyWorm();
    requirePlayingGame(game);
    await runMonsterAction(worm, game);
    initializePet(worm, { state: game });
    await moveHeroByTeleport(11, 10);
    resetInputState();
    pushKeys('l' + ' '.repeat(100));
    await rhack(4);
    const health = worm.mhp;
    const maximum = worm.mhpmax;
    const deadline = worm.wormGrowTime;
    await runMonsterAction(worm, game);
    assert.deepEqual([worm.mx, worm.my], [13, 10]);
    assert.equal(monsterAtPosition(game.level, 14, 10), null);
    assert.ok(worm.mhp >= health - 4 && worm.mhp <= health - 2);
    assert.equal(worm.mhpmax, maximum);
    assert.equal(worm.wormGrowTime, deadline);
});
void test('a head-only worm survives shrinking and still grows on its first later move', async () => {
    const worm = await headOnlyWorm();
    requirePlayingGame(game);
    initializePet(worm, { state: game });
    worm.mhp = 1;
    game.level.requireAt(15, 10).typ = STONE;
    await moveHeroByTeleport(12, 10);
    resetInputState();
    pushKeys('l' + ' '.repeat(100));
    await rhack(4);
    await runMonsterAction(worm, game);
    assert.deepEqual([worm.mx, worm.my], [14, 10]);
    assert.equal(worm.mhp, 1);
    assert.equal(worm.wormGrowTime, 0);
    await rhack('h'.charCodeAt(0));
    await runMonsterAction(worm, game);
    assert.deepEqual([worm.mx, worm.my], [13, 10]);
    assert.equal(monsterAtPosition(game.level, 14, 10), worm);
    assert.ok(worm.mhp > 1);
    assert.ok(worm.wormGrowTime > game.moves);
});
for (const [amount, minimum, maximum] of [[-1, 12, 66], [0, 8, 44], [1, 6, 33]]) {
    void test(`later worm growth uses its unrounded speed after adjustment ${amount}`, async () => {
        const worm = await headOnlyWorm();
        requirePlayingGame(game);
        await runMonsterAction(worm, game);
        game.moves = worm.wormGrowTime;
        adjustMonsterSpeed(worm, amount);
        await runMonsterAction(worm, game);
        assert.equal(worm.wormSegments?.length, 2);
        assert.ok(worm.wormGrowTime >= game.moves + minimum);
        assert.ok(worm.wormGrowTime <= game.moves + maximum);
    });
}
//# sourceMappingURL=monster_worm_motion.test.js.map