import { monsterAtPosition } from '../js/monster_location.js';
import { requireFixtureGame } from './support/game-state.js';
import type { DirectionSelection } from '../js/tty_prompts.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { requireGameDisplay, game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { heroSpitAttack, useHeroSpit } from '../js/hero_spit.js';
import { A_DEX } from '../js/const.js';
import { initRng } from '../js/rng.js';
import { runMonsterAbilityCommand } from './support/commands.js';
import { freshMonsterAbilityRoom } from './support/hero-state.js';
import { floorObjects, floorObjectsAt } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { installPagerInput } from './support/pager-input.js';

function direction(key: string, dx = 0, dy = 0, dz = 0) {
    return { key, dx, dy, dz };
}

function spit(aim: DirectionSelection | null, options: Partial<Parameters<typeof useHeroSpit>[0]> = {}) {
    return useHeroSpit({
        state: game,
        attack: heroSpitAttack(game),
        readDirection: async () => aim,
        captureFlight: async () => undefined,
        ...options,
    });
}

void test('a cobra uses #monster to spit venom', async () => {
    const level = freshMonsterAbilityRoom('cobra');
    requireFixtureGame(game);
    await runMonsterAbilityCommand(`l${' '.repeat(8)}`);

    assert.equal(game.context.move, 1);
    assert.equal(floorObjects(level).length, 0);
});

void test('cancelling a spit direction creates no venom and spends no turn',
    async () => {
        const level = freshMonsterAbilityRoom('cobra');

        const result = await spit(null);

        assert.equal(result.spentTime, false);
        assert.equal(result.reason, 'cancelled');
        assert.equal(floorObjects(level).length, 0);
    });

void test('cobra venom blinds a monster without hurting it', async () => {
    freshMonsterAbilityRoom('cobra');
    requireFixtureGame(game);
    const jackal = await createMonsterAt('jackal', 11, 10);
    jackal.mhp = jackal.mhpmax = 100;
    game.u.acurr.a[A_DEX] = game.u.amax.a[A_DEX] = 25;
    game.u.udaminc = 20;
    installPagerInput(resetInputState(), { expected: /venom.*blinds.*jackal/, limit: 2 });
    initRng(97n);

    const result = await spit(direction('l', 1, 0));

    assert.ok('venom' in result);
    assert.equal(result.venom.where, 'gone');
    assert.equal(jackal.mhp, 100);
    assert.equal(jackal.mcansee, 0);
    assert.ok((jackal.mblinded ?? 0) >= 21 && (jackal.mblinded ?? 0) <= 45,
        `Blinding venom should last 21–45 turns, received ${jackal.mblinded}`);
});

void test('black naga venom burns for two dice without a hero damage bonus', async () => {
    freshMonsterAbilityRoom('black naga');
    requireFixtureGame(game);
    const jackal = await createMonsterAt('jackal', 11, 10);
    jackal.mhp = jackal.mhpmax = 100;
    game.u.acurr.a[A_DEX] = game.u.amax.a[A_DEX] = 25;
    game.u.udaminc = 20;
    installPagerInput(resetInputState(), { expected: /venom burns.*jackal/, limit: 2 });
    initRng(97n);

    const result = await spit(direction('l', 1, 0));

    assert.ok('venom' in result);
    assert.equal(result.venom.where, 'gone');
    const damage = 100 - jackal.mhp;
    assert.ok(damage >= 2 && damage <= 12,
        `Acid venom should deal 2d6 with no Strength/ring bonus, received ${damage}`);
});

void test('venom which reaches a wall splashes on the last open square',
    async () => {
        const level = freshMonsterAbilityRoom('cobra');
        level.requireAt(12, 10).typ = 0;

        const result = await spit(direction('l', 1, 0), {
            publish: async () => undefined,
            random: () => 1,
        });

        assert.ok('venom' in result);
    assert.equal(result.venom.where, 'gone');
        assert.equal(floorObjectsAt(level, 11, 10).length, 0);
    });

void test('spitting blinding venom upward can blind the hero', async () => {
    freshMonsterAbilityRoom('cobra');
    requireFixtureGame(game);

    const result = await spit(direction('<', 0, 0, -1), {
        publish: async () => undefined,
        random: range => range === 5 ? 0 : 1,
        rollOne: () => 5,
    });

    assert.ok('venom' in result);
    assert.equal(result.venom.where, 'gone');
    assert.equal(game.u.ucreamed, 5);
    assert.equal(game.u.blindTurns, 5);
    assert.equal(game.u.blind, true);
});

void test('blinding venom cannot reach an engulfer eyes from inside', async () => {
    freshMonsterAbilityRoom('cobra');
    requireFixtureGame(game);
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

    assert.ok('venom' in result);
    assert.equal(result.venom.where, 'gone');
    assert.equal(worm.mcansee, 1);
    assert.equal(worm.mblinded, undefined);
});

void test('acid venom which kills an engulfer releases the hero', async () => {
    freshMonsterAbilityRoom('black naga');
    requireFixtureGame(game);
    const jackal = await createMonsterAt(
        'jackal', game.u.ux + 1, game.u.uy,
    );
    jackal.mx = game.u.ux;
    jackal.my = game.u.uy;
    jackal.mhp = jackal.mhpmax = 1;
    game.u.uswallow = 1;
    game.u.ustuck = jackal;

    const input = resetInputState();
    const attack = spit(direction('l', 1, 0), {
        publish: async () => undefined,
        random: () => 1,
        rollOne: () => 1,
    });
    await input.waitUntilBlocked();
    const text = requireGameDisplay(game).grid
        .map(row => row.map(cell => cell.ch).join('')).join('\n');
    assert.match(text, /You kill the jackal!--More--/);
    input.feed(' ');
    await attack;

    assert.equal(game.u.uswallow, 0);
    assert.equal(game.u.ustuck, null);
    assert.notEqual(monsterAtPosition(game.level, jackal.mx, jackal.my), jackal);
});
