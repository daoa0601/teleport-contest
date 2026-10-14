import test from 'node:test';
import assert from 'node:assert/strict';

import { LAVAPOOL, POOL, W_AMUL } from '../js/const.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { flush_screen } from '../js/display.js';
import { resetInputState } from '../js/input.js';
import { resolveMonsterLiquid } from '../js/mon.js';
import { finishMonsterLiquidDeath } from '../js/monster_death.js';
import { AMULET_OF_LIFE_SAVING, POT_HEALING } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt, createSaddledSteed, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a drowning monster drops its potion into water only once', async () => {
    const level = freshObjectRoom({ hero: { uluck: -5 } });
    requirePlayingGame(game);
    level.requireAt(12, 10).typ = POOL;
    const giant = await createMonsterAt('giant', 12, 10);
    const potion = await equipMonsterObject(giant, await knownObject(POT_HEALING), 0);

    await resolveMonsterLiquid(giant, game, {
        finishDeath: finishMonsterLiquidDeath,
    });

    assert.equal(giant.dead, true);
    assert.equal(potion.where, 'floor');
    assert.equal(potion.otyp, POT_HEALING);
    assert.equal(potion.odiluted, true);
});

for (const lava of [false, true]) {
    void test(`a ${lava ? 'lava survivor' : 'life-saved drowning monster'} with nowhere safe to stand waits in limbo`, async () => {
        const level = freshObjectRoom();
        requirePlayingGame(game);
        const monster = await createMonsterAt(lava ? 'fire ant' : 'giant', 12, 10);
        if (!lava) await equipMonsterObject(monster, await knownObject(AMULET_OF_LIFE_SAVING), W_AMUL);
        for (let x = 7; x <= 16; x++)
            for (let y = 6; y <= 14; y++)
                level.requireAt(x, y).typ = lava ? LAVAPOOL : POOL;
        resetInputState().feed(' '.repeat(20));

        await resolveMonsterLiquid(monster, game, {
            finishDeath: finishMonsterLiquidDeath,
        });

        assert.ok(monster.mhp > 0);
        assert.equal(level.monsters.includes(monster), false);
        assert.equal(game._migratingMonsters?.includes(monster), true);
        assert.deepEqual(monster.migrationDestination, game.u.uz);
    });
}

for (const property of ['flying', 'levitating'] as const) {
    void test(`a ${property} rider keeps the steed and its equipment above lava`, async () => {
        const level = freshObjectRoom();
        requirePlayingGame(game);
        const steed = await createSaddledSteed();
        game.u.usteed = steed;
        game.u[property] = true;
        level.requireAt(steed.mx, steed.my).typ = LAVAPOOL;
        const health = steed.mhp;
        const saddle = steed.saddle;

        await resolveMonsterLiquid(steed, game, {
            finishDeath: finishMonsterLiquidDeath,
        });

        assert.equal(steed.mhp, health);
        assert.equal(game.u.usteed, steed);
        assert.equal(level.monsters.includes(steed), true);
        assert.ok(saddle && steed.minvent.includes(saddle));
    });
}

void test('an iron golem can rust in a pool despite being breathless', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    level.requireAt(12, 10).typ = POOL;
    const golem = await createMonsterAt('iron golem', 12, 10);
    golem.mhp = golem.mhpmax = 30;
    const messages: string[] = [];

    await resolveMonsterLiquid(golem, game, {
        finishDeath: finishMonsterLiquidDeath,
        announce: async message => messages.push(message),
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
    const messages: string[] = [];

    const result = await resolveMonsterLiquid(ant, game, {
        finishDeath: finishMonsterLiquidDeath,
        announce: async message => messages.push(message),
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
    const messages: string[] = [];
    resetInputState().feed(' '.repeat(10));

    const result = await resolveMonsterLiquid(orc, game, {
        finishDeath: finishMonsterLiquidDeath,
        announce: async message => messages.push(message),
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
