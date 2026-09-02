import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { IRONBARS, ROOM, W_ARMH, W_ARMS, W_WEP } from '../js/const.js';
import { game } from '../js/gstate.js';
import { heroBreathAttack } from '../js/hero_breath.js';
import { useHeroBreath } from '../js/hero_breath_command.js';
import { pushKeys } from '../js/input.js';
import {
    BLACK_DRAGON_SCALES, HELMET, LONG_SWORD, SMALL_SHIELD,
} from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { knownObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { floorObjectsAt } from './support/level-state.js';
import { addMonster } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

function installBreathingHero(formName) {
    const level = freshObjectRoom({
        left: 2,
        right: 30,
        top: 4,
        bottom: 16,
        heroX: 10,
        heroY: 10,
    });
    installPolymorphedHero(formName, {
        uen: 30,
        uenmax: 30,
    });
    game.context.move = 0;
    return level;
}

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
    const level = installBreathingHero('winter wolf');
    const jackal = addMonster({
        species: 'jackal',
        m_id: 81,
        x: 11,
        y: 10,
        hitPoints: 1,
        level: 1,
        mac: 99,
        peaceful: false,
    });
    initRng(7n);
    pushKeys(`monster\nl${' '.repeat(12)}`);

    await rhack('#'.charCodeAt(0));

    assert.equal(game.u.uen, 15);
    assert.equal(game.context.move, 1);
    assert.equal(level.monsters.includes(jackal), false);
});

test('cancelling breath direction spends energy but does not spend a turn',
    async () => {
        installBreathingHero('red dragon');

        const result = await breathe(27);

        assert.equal(result.reason, 'cancelled');
        assert.equal(result.spentTime, false);
        assert.equal(game.u.uen, 15);
    });

test('disintegration breath destroys a shield before hurting its wearer',
    async () => {
        installBreathingHero('black dragon');
        const shield = knownObject(SMALL_SHIELD, {
            where: 'minvent', worn: true, owornmask: W_ARMS,
        });
        const jackal = addMonster({
            species: 'jackal',
            x: 11,
            y: 10,
            hitPoints: 20,
            mac: 99,
            inventory: [shield],
        });

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
        installBreathingHero('black dragon');
        const sword = knownObject(LONG_SWORD, { where: 'minvent' });
        const scales = knownObject(BLACK_DRAGON_SCALES, {
            where: 'minvent',
        });
        const jackal = addMonster({
            species: 'jackal',
            x: 11,
            y: 10,
            hitPoints: 1,
            mac: 99,
            inventory: [sword, scales],
        });

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
    installBreathingHero('yellow dragon');
    const sword = knownObject(LONG_SWORD, {
        where: 'minvent', worn: true, owornmask: W_WEP,
    });
    const helmet = knownObject(HELMET, {
        where: 'minvent', worn: true, owornmask: W_ARMH,
    });
    addMonster({
        species: 'jackal',
        x: 11,
        y: 10,
        hitPoints: 20,
        mac: 99,
        weapon: sword,
        inventory: [sword, helmet],
    });

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
    const level = installBreathingHero('blue dragon');
    level.at(11, 10).typ = IRONBARS;

    await breathe('l', {
        publish: async () => undefined,
        random: () => 0,
    });

    assert.equal(level.at(11, 10).typ, ROOM);
});

test('breath fired while swallowed hits the engulfer directly', async () => {
    installBreathingHero('winter wolf');
    const worm = addMonster({
        species: 'purple worm',
        x: game.u.ux,
        y: game.u.uy,
        hitPoints: 1,
        mac: -99,
    });
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
