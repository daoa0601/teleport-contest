import { monsterAtPosition } from '../js/monster_location.js';
import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { useHeroMindBlast } from '../js/hero_mind_blast.js';
import { initRng } from '../js/rng.js';
import { runMonsterAbilityCommand } from './support/commands.js';
import { freshMonsterAbilityRoom } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
void test('a mind flayer uses #monster to strike nearby hostile minds', async () => {
    freshMonsterAbilityRoom('mind flayer', { energy: 20, right: 24 });
    requireFixtureGame(game);
    const target = await createMonsterAt('floating eye', 11, 10);
    target.mhp = target.mhpmax = 1;
    target.mcansee = 0;
    target.mpeaceful = 0;
    const mindless = await createMonsterAt('straw golem', 12, 10);
    mindless.mhp = mindless.mhpmax = 20;
    const peaceful = await createMonsterAt('floating eye', 13, 10);
    peaceful.mhp = peaceful.mhpmax = 20;
    peaceful.mcansee = 0;
    peaceful.mpeaceful = 1;
    const distant = await createMonsterAt('floating eye', 19, 10);
    distant.mhp = distant.mhpmax = 20;
    distant.mcansee = 0;
    distant.mpeaceful = 0;
    initRng(7n);
    await runMonsterAbilityCommand(' '.repeat(20));
    assert.equal(game.u.uen, 10);
    assert.equal(game.context.move, 1);
    assert.notEqual(monsterAtPosition(game.level, target.mx, target.my), target);
    assert.equal(mindless.mhp, 20);
    assert.equal(peaceful.mhp, 20);
    assert.equal(distant.mhp, 20);
});
void test('blind and sighted telepaths are found by their source chances', async () => {
    freshMonsterAbilityRoom('mind flayer', { energy: 20, right: 24 });
    requireFixtureGame(game);
    const blindEye = await createMonsterAt('floating eye', 11, 10);
    blindEye.mhp = blindEye.mhpmax = 20;
    blindEye.mcansee = 0;
    blindEye.mpeaceful = 0;
    const sightedFlayer = await createMonsterAt('master mind flayer', 12, 10);
    sightedFlayer.mhp = sightedFlayer.mhpmax = 20;
    sightedFlayer.mpeaceful = 0;
    const jackal = await createMonsterAt('jackal', 13, 10);
    jackal.mhp = jackal.mhpmax = 20;
    await useHeroMindBlast({
        state: game,
        publish: async () => { },
        random: () => 1,
        rollDamage: () => 4,
    });
    assert.equal(blindEye.mhp, 16);
    assert.equal(sightedFlayer.mhp, 16);
    assert.equal(jackal.mhp, 20);
});
void test('trying to mind blast without enough energy takes no time', async () => {
    freshMonsterAbilityRoom('mind flayer', { energy: 9, right: 24 });
    requireFixtureGame(game);
    const messages = [];
    const result = await useHeroMindBlast({
        state: game,
        publish: async (message) => messages.push(message),
    });
    assert.equal(result.spentTime, false);
    assert.equal(game.u.uen, 9);
    assert.deepEqual(messages, [
        'You concentrate but lack the energy to maintain doing so.',
    ]);
});
void test('a mind blast reaches the newest monster first', async () => {
    freshMonsterAbilityRoom('mind flayer', { energy: 20, right: 24 });
    requireFixtureGame(game);
    const older = await createMonsterAt('jackal', 11, 10);
    older.mhp = older.mhpmax = 20;
    const newer = await createMonsterAt('jackal', 13, 10);
    newer.mhp = newer.mhpmax = 20;
    let chances = 0;
    await useHeroMindBlast({
        state: game,
        publish: async () => { },
        // Only the first mind examined is found.
        random: () => (chances++ === 0 ? 0 : 1),
        rollDamage: () => 4,
    });
    assert.equal(newer.mhp, 16);
    assert.equal(older.mhp, 20);
});
//# sourceMappingURL=hero_mind_blast.test.js.map