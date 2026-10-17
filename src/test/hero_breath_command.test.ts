import { monsterAtPosition } from '../js/monster_location.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { IRONBARS, ROOM, ROOMOFFSET, W_ARMH, W_ARMS, W_WEP } from '../js/const.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { heroBreathAttack } from '../js/hero_breath.js';
import type { HeroBreathOptions } from '../js/hero_breath_command.js';
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
import { createRoom } from './support/topology.js';

function breathe(direction: string | 27, options: HeroBreathOptions = {}) {
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

void test('a winter wolf uses #monster to breathe frost at a target', async () => {
    const level = freshMonsterAbilityRoom('winter wolf', { energy: 30 });
    const jackal = await createMonsterAt('jackal', 11, 10);
    jackal.mhp = jackal.mhpmax = 1;
    jackal.m_lev = 1;
    initRng(7n);
    const input = resetInputState();
    const command = runMonsterAbilityCommand();
    await input.waitUntilBlocked();
    const prompt = requireGameDisplay().grid
        .map(row => row.map(cell => cell.ch).join('')).join('\n');
    assert.match(prompt, /In what direction\?/);
    input.feed('l');
    await command;

    assert.equal(game.u.uen, 15);
    assert.equal(game.context.move, 1);
    assert.notEqual(monsterAtPosition(level, jackal.mx, jackal.my), jackal);
});

void test('cancelling breath direction spends energy but does not spend a turn',
    async () => {
        freshMonsterAbilityRoom('red dragon', { energy: 30 });

        const result = await breathe(27);

        assert.ok(!result.spentTime, 'A cancelled direction must not spend a turn');
        assert.equal(result.reason, 'cancelled');
        assert.equal(game.u.uen, 15);
    });

void test('disintegration breath destroys a shield before hurting its wearer',
    async () => {
        freshMonsterAbilityRoom('black dragon', { energy: 30 });
        const shield = await knownObject(SMALL_SHIELD, {
            worn: true, owornmask: W_ARMS,
        });
        const jackal = await createMonsterAt('jackal', 11, 10);
        jackal.mhp = jackal.mhpmax = 20;
        await equipMonsterObject(jackal, shield, W_ARMS);

        await breathe('l', {
            publish: async () => undefined,
            random: () => 0,
            rollOne: () => 1,
        });

        assert.equal(jackal.mhp, 20);
        assert.equal(jackal.minvent.includes(shield), false);
    });

void test('fatal disintegration destroys ordinary gear but spares black scales',
    async () => {
        const level = freshMonsterAbilityRoom('black dragon', { energy: 30 });
        const sword = await knownObject(LONG_SWORD);
        const scales = await knownObject(BLACK_DRAGON_SCALES);
        const jackal = await createMonsterAt('jackal', 11, 10);
        jackal.mhp = jackal.mhpmax = 1;
        await addObjectToMonsterInventory(jackal, sword);
        await addObjectToMonsterInventory(jackal, scales);

        await breathe('l', {
            publish: async () => undefined,
            random: range => range - 1,
            rollOne: () => 1,
        });

        assert.notEqual(monsterAtPosition(level, jackal.mx, jackal.my), jackal);
        assert.equal(sword.where, 'gone');
        assert.ok(floorObjectsAt(level, 11, 10).includes(scales));
    });

void test('acid breath corrodes a monster weapon and armor', async () => {
    freshMonsterAbilityRoom('yellow dragon', { energy: 30 });
    const sword = await knownObject(LONG_SWORD);
    const helmet = await knownObject(HELMET);
    const jackal = await createMonsterAt('jackal', 11, 10);
    jackal.mhp = jackal.mhpmax = 20;
    await equipMonsterObject(jackal, sword, W_WEP);
    await equipMonsterObject(jackal, helmet, W_ARMH);

    await breathe('l', {
        publish: async () => undefined,
        random: () => 0,
        rollDice: () => 1,
        rollOne: () => 1,
    });

    assert.equal(sword.oeroded2, 1);
    assert.equal(helmet.oeroded2, 1);
});

void test('lightning breath can melt iron bars', async () => {
    const level = freshMonsterAbilityRoom('blue dragon', { energy: 30 });
    level.rooms.push(createRoom({ lx: 7, hx: 16, ly: 6, hy: 14 }));
    level.nroom = 1;
    for (let x = 7; x <= 16; x++) {
        for (let y = 6; y <= 14; y++) {
            const square = level.at(x, y);
            assert.ok(square, `Room square ${x},${y} must exist`);
            square.roomno = ROOMOFFSET;
        }
    }
    const bars = level.at(11, 10);
    assert.ok(bars);
    bars.typ = IRONBARS;

    await breathe('l', {
        publish: async () => undefined,
        random: () => 0,
    });

    assert.equal(bars.typ, ROOM);
});

void test('breath fired while swallowed hits the engulfer directly', async () => {
    const level = freshMonsterAbilityRoom('winter wolf', { energy: 30 });
    const worm = await createMonsterAt(
        'purple worm', game.u.ux + 1, game.u.uy,
    );
    worm.mx = game.u.ux;
    worm.my = game.u.uy;
    worm.mhp = worm.mhpmax = 1;
    game.u.uswallow = 1;
    game.u.ustuck = worm;

    const input = resetInputState();
    const attack = breathe('l', {
        publish: async () => undefined,
        random: () => 1,
        rollDice: () => 6,
        rollOne: () => 1,
    });
    await input.waitUntilBlocked();
    const text = requireGameDisplay().grid
        .map(row => row.map(cell => cell.ch).join('')).join('\n');
    assert.match(text, /You kill the purple worm!--More--/);
    input.feed(' ');
    await attack;

    assert.equal(game.u.uswallow, 0);
    assert.equal(game.u.ustuck, null);
    assert.notEqual(monsterAtPosition(level, worm.mx, worm.my), worm);
});
