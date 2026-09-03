import test from 'node:test';
import assert from 'node:assert/strict';

import { game } from '../js/gstate.js';
import { heroSpitAttack, useHeroSpit } from '../js/hero_spit.js';
import { runMonsterAbilityCommand } from './support/commands.js';
import { freshMonsterAbilityRoom } from './support/hero-state.js';
import { floorObjects, floorObjectsAt } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';

function direction(key, dx = 0, dy = 0, dz = 0) {
    return { key, dx, dy, dz };
}

function spit(aim, options = {}) {
    return useHeroSpit({
        state: game,
        attack: heroSpitAttack(game),
        readDirection: async () => aim,
        captureFlight: async () => undefined,
        ...options,
    });
}

test('a cobra uses #monster to spit venom', async () => {
    const level = freshMonsterAbilityRoom('cobra');
    await runMonsterAbilityCommand(`l${' '.repeat(8)}`);

    assert.equal(game.context.move, 1);
    assert.equal(floorObjects(level).length, 0);
});

test('cancelling a spit direction creates no venom and spends no turn',
    async () => {
        const level = freshMonsterAbilityRoom('cobra');

        const result = await spit(null);

        assert.equal(result.spentTime, false);
        assert.equal(result.reason, 'cancelled');
        assert.equal(floorObjects(level).length, 0);
    });

test('cobra venom blinds a monster without hurting it', async () => {
    freshMonsterAbilityRoom('cobra');
    const jackal = await createMonsterAt('jackal', 11, 10);
    jackal.mhp = jackal.mhpmax = 12;

    const result = await spit(direction('l', 1, 0), {
        publish: async () => undefined,
        random: () => 1,
        rollOne: () => 1,
    });

    assert.equal(jackal.mhp, 12);
    assert.equal(jackal.mcansee, 0);
    assert.equal(jackal.mblinded, 21);
});

test('black naga venom burns a monster', async () => {
    freshMonsterAbilityRoom('black naga');
    const jackal = await createMonsterAt('jackal', 11, 10);
    jackal.mhp = jackal.mhpmax = 12;

    const result = await spit(direction('l', 1, 0), {
        publish: async () => undefined,
        random: () => 1,
        rollOne: () => 1,
    });

    assert.equal(jackal.mhp, 10);
});

test('venom which reaches a wall splashes on the last open square',
    async () => {
        const level = freshMonsterAbilityRoom('cobra');
        level.at(12, 10).typ = 0;

        const result = await spit(direction('l', 1, 0), {
            publish: async () => undefined,
            random: () => 1,
        });

        assert.equal(result.venom.where, 'gone');
        assert.equal(floorObjectsAt(level, 11, 10).length, 0);
    });

test('spitting blinding venom upward can blind the hero', async () => {
    freshMonsterAbilityRoom('cobra');

    const result = await spit(direction('<', 0, 0, -1), {
        publish: async () => undefined,
        random: range => range === 5 ? 0 : 1,
        rollOne: () => 5,
    });

    assert.equal(result.venom.where, 'gone');
    assert.equal(game.u.ucreamed, 5);
    assert.equal(game.u.blindTurns, 5);
    assert.equal(game.u.blind, true);
});

test('blinding venom cannot reach an engulfer eyes from inside', async () => {
    freshMonsterAbilityRoom('cobra');
    const worm = await createMonsterAt(
        'purple worm', game.u.ux + 1, game.u.uy,
    );
    worm.mx = game.u.ux;
    worm.my = game.u.uy;
    worm.mhp = worm.mhpmax = 30;
    game.u.uswallow = 1;
    game.u.ustuck = worm;

    const result = await spit(direction('l', 1, 0), {
        publish: async () => undefined,
        random: () => 1,
        rollOne: () => 25,
    });

    assert.equal(result.venom.where, 'gone');
    assert.equal(worm.mcansee, 1);
    assert.equal(worm.mblinded, undefined);
});

test('acid venom which kills an engulfer releases the hero', async () => {
    freshMonsterAbilityRoom('black naga');
    const jackal = await createMonsterAt(
        'jackal', game.u.ux + 1, game.u.uy,
    );
    jackal.mx = game.u.ux;
    jackal.my = game.u.uy;
    jackal.mhp = jackal.mhpmax = 1;
    game.u.uswallow = 1;
    game.u.ustuck = jackal;

    await spit(direction('l', 1, 0), {
        publish: async () => undefined,
        random: () => 1,
        rollOne: () => 1,
    });

    assert.equal(game.u.uswallow, 0);
    assert.equal(game.u.ustuck, null);
    assert.equal(game.level.monsters.includes(jackal), false);
});
