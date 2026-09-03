import test from 'node:test';
import assert from 'node:assert/strict';

import { IRONBARS, ROOM, W_ARMH, W_ARMS, W_WEP } from '../js/const.js';
import { game } from '../js/gstate.js';
import { heroBreathAttack } from '../js/hero_breath.js';
import { useHeroBreath } from '../js/hero_breath_command.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import {
    BLACK_DRAGON_SCALES, HELMET, LONG_SWORD, SMALL_SHIELD,
} from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { runMonsterAbilityCommand } from './support/commands.js';
import { knownObject } from './support/game-objects.js';
import { freshMonsterAbilityRoom } from './support/hero-state.js';
import { floorObjectsAt } from './support/level-state.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';

function breathe(direction, options = {}) {
    return useHeroBreath({
        state: game,
        attack: heroBreathAttack(game),
        readDirection: async () => direction === 27 ? null : ({
            key: direction,
            dx: 0,
            dy: 0,
            dz: 0,
        }),
        ...options,
    });
}

test('a winter wolf uses #monster to breathe frost at a target', async () => {
    const level = freshMonsterAbilityRoom('winter wolf', { energy: 30 });
    const jackal = await createMonsterAt('jackal', 11, 10);
    jackal.mhp = jackal.mhpmax = 1;
    jackal.m_lev = 1;
    jackal.mac = 99;
    initRng(7n);
    await runMonsterAbilityCommand(`l${' '.repeat(12)}`);

    assert.equal(game.u.uen, 15);
    assert.equal(game.context.move, 1);
    assert.equal(level.monsters.includes(jackal), false);
});

test('cancelling breath direction spends energy but does not spend a turn',
    async () => {
        freshMonsterAbilityRoom('red dragon', { energy: 30 });

        const result = await breathe(27);

        assert.equal(result.reason, 'cancelled');
        assert.equal(result.spentTime, false);
        assert.equal(game.u.uen, 15);
    });

test('disintegration breath destroys a shield before hurting its wearer',
    async () => {
        freshMonsterAbilityRoom('black dragon', { energy: 30 });
        const shield = knownObject(SMALL_SHIELD, {
            worn: true, owornmask: W_ARMS,
        });
        const jackal = await createMonsterAt('jackal', 11, 10);
        jackal.mhp = jackal.mhpmax = 20;
        jackal.mac = 99;
        equipMonsterObject(jackal, shield, W_ARMS);

        await breathe('l', {
            publish: async () => undefined,
            random: () => 0,
            rollOne: () => 1,
        });

        assert.equal(jackal.mhp, 20);
        assert.equal(jackal.minvent.includes(shield), false);
    });

test('fatal disintegration destroys ordinary gear but spares black scales',
    async () => {
        freshMonsterAbilityRoom('black dragon', { energy: 30 });
        const sword = knownObject(LONG_SWORD);
        const scales = knownObject(BLACK_DRAGON_SCALES);
        const jackal = await createMonsterAt('jackal', 11, 10);
        jackal.mhp = jackal.mhpmax = 1;
        jackal.mac = 99;
        addObjectToMonsterInventory(jackal, sword);
        addObjectToMonsterInventory(jackal, scales);

        await breathe('l', {
            publish: async () => undefined,
            random: range => range - 1,
            rollOne: () => 1,
        });

        assert.equal(game.level.monsters.includes(jackal), false);
        assert.equal(sword.where, 'gone');
        assert.ok(floorObjectsAt(game.level, 11, 10).includes(scales));
    });

test('acid breath corrodes a monster weapon and armor', async () => {
    freshMonsterAbilityRoom('yellow dragon', { energy: 30 });
    const sword = knownObject(LONG_SWORD, {
        where: 'minvent', worn: true, owornmask: W_WEP,
    });
    const helmet = knownObject(HELMET, {
        where: 'minvent', worn: true, owornmask: W_ARMH,
    });
    const jackal = await createMonsterAt('jackal', 11, 10);
    jackal.mhp = jackal.mhpmax = 20;
    jackal.mac = 99;
    equipMonsterObject(jackal, sword, W_WEP);
    equipMonsterObject(jackal, helmet, W_ARMH);

    await breathe('l', {
        publish: async () => undefined,
        random: () => 0,
        rollDice: () => 1,
        rollOne: () => 1,
    });

    assert.equal(sword.oeroded2, 1);
    assert.equal(helmet.oeroded2, 1);
});

test('lightning breath can melt iron bars', async () => {
    const level = freshMonsterAbilityRoom('blue dragon', { energy: 30 });
    level.at(11, 10).typ = IRONBARS;

    await breathe('l', {
        publish: async () => undefined,
        random: () => 0,
    });

    assert.equal(level.at(11, 10).typ, ROOM);
});

test('breath fired while swallowed hits the engulfer directly', async () => {
    freshMonsterAbilityRoom('winter wolf', { energy: 30 });
    const worm = await createMonsterAt(
        'purple worm', game.u.ux + 1, game.u.uy,
    );
    worm.mx = game.u.ux;
    worm.my = game.u.uy;
    worm.mhp = worm.mhpmax = 1;
    worm.mac = -99;
    game.u.uswallow = 1;
    game.u.ustuck = worm;

    await breathe('l', {
        publish: async () => undefined,
        random: () => 1,
        rollDice: () => 6,
        rollOne: () => 1,
    });

    assert.equal(game.u.uswallow, 0);
    assert.equal(game.u.ustuck, null);
    assert.equal(game.level.monsters.includes(worm), false);
});
