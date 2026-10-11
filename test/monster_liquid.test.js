import test from 'node:test';
import assert from 'node:assert/strict';
import { LAVAPOOL, POOL, W_AMUL } from '../js/const.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { flush_screen } from '../js/display.js';
import { resetInputState } from '../js/input.js';
import { resolveMonsterLiquid } from '../js/mon.js';
import { finishMonsterLiquidDeath } from '../js/monster_death.js';
import { AMULET_OF_LIFE_SAVING } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('an iron golem can rust in a pool despite being breathless', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    level.requireAt(12, 10).typ = POOL;
    const golem = await createMonsterAt('iron golem', 12, 10);
    golem.mhp = golem.mhpmax = 30;
    const messages = [];
    await resolveMonsterLiquid(golem, game, {
        finishDeath: finishMonsterLiquidDeath,
        announce: async (message) => messages.push(message),
        random: () => 0,
        rollDice: () => 6,
    });
    assert.equal(golem.mhp, 24);
    assert.equal(golem.mhpmax, 24);
    assert.equal(level.monsters.includes(golem), true);
    assert.deepEqual(messages, ['The iron golem rusts.']);
});
void test('an iron golem remains in the pool when it does not rust', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    level.requireAt(12, 10).typ = POOL;
    const golem = await createMonsterAt('iron golem', 12, 10);
    golem.mhp = golem.mhpmax = 30;
    await resolveMonsterLiquid(golem, game, {
        finishDeath: finishMonsterLiquidDeath,
        random: range => range - 1,
    });
    assert.equal(golem.mhp, 30);
    assert.deepEqual([golem.mx, golem.my], [12, 10]);
    assert.equal(level.monsters.includes(golem), true);
});
void test('a fire-resistant lava survivor announces its escape', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    level.requireAt(12, 10).typ = LAVAPOOL;
    const ant = await createMonsterAt('fire ant', 12, 10);
    ant.mhp = ant.mhpmax = 20;
    const messages = [];
    const result = await resolveMonsterLiquid(ant, game, {
        finishDeath: finishMonsterLiquidDeath,
        announce: async (message) => messages.push(message),
        random: range => 10 % range,
        rollOne: range => Math.min(14, range),
    });
    assert.equal(ant.mhp, 19);
    assert.ok(result && 'relocation' in result && result.relocation);
    assert.equal(result.relocation.moved, true);
    assert.deepEqual([ant.mx, ant.my], [14, 10]);
    assert.deepEqual(messages, ['The fire ant burns slightly.']);
    await flush_screen(1);
    const row = requireGameDisplay().grid[0];
    assert.ok(row, 'The display must contain its message row');
    const topline = row.map(cell => cell.ch).join('');
    assert.match(topline, /fire ant vanishes and reappears/);
});
void test('a life-saved drowning monster escapes without a teleport announcement', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    level.requireAt(12, 10).typ = POOL;
    const orc = await createMonsterAt('orc', 12, 10);
    const amulet = await knownObject(AMULET_OF_LIFE_SAVING);
    await equipMonsterObject(orc, amulet, W_AMUL);
    const messages = [];
    resetInputState().feed(' '.repeat(10));
    const result = await resolveMonsterLiquid(orc, game, {
        finishDeath: finishMonsterLiquidDeath,
        announce: async (message) => messages.push(message),
        random: range => 10 % range,
        rollOne: range => Math.min(14, range),
    });
    assert.ok(orc.mhp > 0);
    assert.equal(orc.minvent.includes(amulet), false);
    assert.ok(result && 'relocation' in result && result.relocation);
    assert.equal(result.relocation.moved, true);
    assert.deepEqual([orc.mx, orc.my], [14, 10]);
    assert.ok(messages.some(message => message.includes('drowns')));
    await flush_screen(1);
    const row = requireGameDisplay().grid[0];
    assert.ok(row, 'The display must contain its message row');
    const topline = row.map(cell => cell.ch).join('');
    assert.match(topline, /medallion crumbles to dust/);
    assert.doesNotMatch(topline, /vanishes|reappears|appears/);
});
//# sourceMappingURL=monster_liquid.test.js.map