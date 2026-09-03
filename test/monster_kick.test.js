import test from 'node:test';
import assert from 'node:assert/strict';

import {
    COULD_SEE, IN_SIGHT, STATUE_TRAP, STONE, W_AMUL,
} from '../js/const.js';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { hurtleHero } from '../js/hero_hurtle.js';
import { pushKey, pushKeys } from '../js/input.js';
import { mkcorpstat } from '../js/mklev.js';
import {
    AMULET_OF_LIFE_SAVING, OBJECT_NAMES, STATUE,
} from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { vision_reset } from '../js/vision.js';
import { carriedObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { addMonster, equipMonsterObject } from './support/monsters.js';
import { freshPlayableRoom } from './support/playable-room.js';

const PM_JACKAL = 12;

function freshKickArena() {
    const level = freshPlayableRoom({
        left: 6,
        right: 14,
        top: 6,
        bottom: 14,
        role: 'tourist',
    });
    for (const row of game.viz_array) row.fill(IN_SIGHT | COULD_SEE);
    return level;
}

function installKickArena(mnum) {
    freshKickArena();
    const monster = addMonster({
        mnum, m_id: 55, x: 11, y: 10,
        hitPoints: 20, level: 4, mac: 3,
        minvis: 0, mundetected: 0,
        movement: 12,
    });
    return monster;
}

test('a quick snake can slide away from a kick', async () => {
    const snake = installKickArena(215);
    initRng(7n);
    pushKey('l');

    await rhack(4);

    assert.notDeepEqual([snake.mx, snake.my], [11, 10]);
    assert.equal(snake.mhp, 20);
    assert.match(game._pending_message, /slides, nimbly evading your kick/);
});

test('a heavy load can leave a clumsy kick harmless', async () => {
    const lichen = installKickArena(158);
    game.inventory = [
        { otyp: OBJECT_NAMES.indexOf('plate mail'), quan: 1 },
        { otyp: OBJECT_NAMES.indexOf('food ration'), quan: 2 },
    ];
    initRng(2n);
    pushKey('l');

    await rhack(4);

    assert.equal(lichen.mhp, 20);
    assert.equal(game._pending_message, 'Your clumsy kick does no damage.');
});

test('a levitating hero can miss a tiny monster and recoil',
    async () => {
        const garterSnake = installKickArena(214);
        game.u.levitating = true;
        initRng(2n);
        pushKey('l');
        pushKey(' ');

        await rhack(4);

        assert.equal(garterSnake.mhp, 20);
        assert.deepEqual([garterSnake.mx, garterSnake.my], [11, 10]);
        assert.deepEqual([game.u.ux, game.u.uy], [9, 10]);
        assert.equal(
            game._pending_message,
            'You float in the opposite direction.',
        );
    });

test('kicking a pet costs a Samurai honor and frightens the pet', async () => {
    const dog = installKickArena(16);
    game.urole = { key: 'samurai' };
    dog.mpeaceful = 1;
    dog.mtame = 10;
    dog.pet = true;
    dog.edog = {};
    initRng(2n);
    pushKey('l');
    pushKey('y');
    pushKey(' ');
    pushKey(' ');

    await rhack(4);

    assert.equal(game.u.ualign.record, 9);
    assert.equal(dog.mtame, 9);
    assert.equal(dog.mflee, 1);
});

test('declining a pet kick leaves the pet alone and takes no turn', async () => {
    const dog = installKickArena(16);
    dog.mpeaceful = 1;
    dog.mtame = 10;
    dog.pet = true;
    dog.edog = {};
    initRng(2n);
    pushKey('l');
    pushKey('n');

    await rhack(4);

    assert.equal(dog.mhp, 20);
    assert.equal(dog.mtame, 10);
    assert.equal(game.context.move, 0);
});

test('kicking a wall while levitating throws the hero backward', async () => {
    installKickArena(16);
    game.level.monsters = [];
    game.level.at(11, 10).typ = STONE;
    vision_reset();
    game.u.levitating = true;
    game.u.uhp = game.u.uhpmax = 100;
    initRng(19n);
    pushKey('l');
    pushKey(' ');
    pushKey(' ');

    await rhack(4);

    assert.deepEqual([game.u.ux, game.u.uy], [6, 10]);
});

test('kicking a statue trap releases its monster', async () => {
    const level = freshKickArena();
    const x = 11;
    const y = 10;
    initRng(9403n);
    const statue = mkcorpstat(STATUE, null, PM_JACKAL, x, y, 0);
    addTrap(level, STATUE_TRAP, x, y, { tseen: false });
    initRng(17n);
    pushKey('l');

    await rhack(4);

    const jackal = level.monsters.find(monster =>
        monster.mnum === PM_JACKAL && monster.mx === x && monster.my === y,
    );
    assert.ok(jackal);
    assert.equal(jackal.mpeaceful, 0);
    assert.equal(statue.where, 'gone');
    assert.equal(level.traps.length, 0);
    assert.equal(game.context.move, 1);
});

test('hurtling into a peaceful monster wakes and angers it', async () => {
    const human = installKickArena(260);
    human.mx = 9;
    human.mpeaceful = 1;
    human.msleeping = 1;
    pushKey(' ');

    await hurtleHero(-1, 0, 1);

    assert.deepEqual([game.u.ux, game.u.uy], [10, 10]);
    assert.equal(human.msleeping, 0);
    assert.equal(human.mpeaceful, 0);
    assert.equal(game.u.ualign.record, 9);
});

test('a cockatrice hero recoiling into an unarmored monster leaves a statue',
    async () => {
        const human = installKickArena(260);
        human.mx = 9;
        const club = carriedObject(OBJECT_NAMES.indexOf('club'), {
            owornmask: 0,
            where: 'minvent',
            owt: 30,
        });
        equipMonsterObject(human, club, 0);
        game.level.at(11, 10).typ = STONE;
        game.u.levitating = true;
        game.u.mtimedone = 100;
        game.u.umonnum = 10;
        game.u.mh = game.u.mhmax = 20;
        game.u.uhp = game.u.uhpmax = 100;
        vision_reset();
        initRng(19n);
        pushKeys(`l${' '.repeat(20)}`);

        await rhack(4);

        assert.equal(game.level.monsters.includes(human), false);
        const statue = game.level.objects[9][10]
            .find(object => object.otyp === STATUE);
        assert.equal(statue.corpsenm, 260);
        assert.equal(statue.contents.includes(club), true);
        assert.equal(game.u.uconduct.killer, 1);
    });

test('a worn life-saving amulet saves a monster from petrifying recoil',
    async () => {
        const human = installKickArena(260);
        human.mx = 9;
        const amulet = carriedObject(AMULET_OF_LIFE_SAVING, {
            owornmask: W_AMUL,
            worn: true,
            where: 'minvent',
        });
        equipMonsterObject(human, amulet, W_AMUL);
        game.level.at(11, 10).typ = STONE;
        game.u.levitating = true;
        game.u.mtimedone = 100;
        game.u.umonnum = 10;
        game.u.mh = game.u.mhmax = 20;
        game.u.uhp = game.u.uhpmax = 100;
        vision_reset();
        initRng(19n);
        pushKeys(`l${' '.repeat(30)}`);

        await rhack(4);

        assert.equal(game.level.monsters.includes(human), true);
        assert.equal(human.mhp, human.mhpmax);
        assert.equal(human.minvent.includes(amulet), false);
        const statue = game.level.objects?.[9]?.[10]
            ?.find(object => object.otyp === STATUE);
        assert.equal(statue, undefined);
        assert.equal(game.u.uconduct.killer, 1);
    });
