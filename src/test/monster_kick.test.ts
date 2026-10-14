import { initializePet } from '../js/dog.js';
import type { RoleKey } from '../js/roles.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    BEAR_TRAP, COULD_SEE, DOOR, D_ISOPEN, IN_SIGHT, STATUE_TRAP, STONE, W_AMUL, WEB,
} from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { hurtleHero } from '../js/hero_hurtle.js';
import { pushKey } from '../js/input.js';
import { createCorpstatAt } from '../js/mklev.js';
import {
    AMULET_OF_LIFE_SAVING, OBJECT_NAMES, STATUE,
} from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { vision_reset } from '../js/vision.js';
import { kickDirection } from './support/commands.js';
import { addInventoryObject, uninitializedObject } from './support/game-objects.js';
import { addTrap, floorObjectsAt } from './support/level-state.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { createHarmlessGasCloudSelection, runLevelRegions } from '../js/regions.js';

const PM_JACKAL = 12;

function freshKickArena(role: RoleKey = 'tourist') {
    const level = freshPlayableRoom({
        left: 6,
        right: 14,
        top: 6,
        bottom: 14,
        role,
    });
    requirePlayingGame(game);
    assert.ok(game.viz_array);
    for (const row of game.viz_array) row.fill(IN_SIGHT | COULD_SEE);
    return level;
}

async function installKickArena(mnum: number | string, role: RoleKey = 'tourist') {
    freshKickArena(role);
    requirePlayingGame(game);
    const monster = await createMonsterAt(mnum, 11, 10);
    monster.mhp = 20;
    monster.mhpmax = 20;
    monster.m_lev = 4;
    monster.minvis = 0;
    monster.mundetected = 0;
    monster.movement = 12;
    return monster;
}

void test('a quick snake can slide away from a kick', async () => {
    const snake = await installKickArena(215);
    requirePlayingGame(game);
    initRng(7n);
    await kickDirection('l');

    assert.notDeepEqual([snake.mx, snake.my], [11, 10]);
    assert.equal(snake.mhp, 20);
    assert.match(game._pending_message, /slides, nimbly evading your kick/);
});

for (const startsInside of [false, true]) {
    void test(`evading a kick ${startsInside ? 'out of' : 'into'} gas changes the monster's exposure`, async () => {
        const jackal = await installKickArena('jackal');
        jackal.mhp = jackal.mhpmax = 100;
        const cells = startsInside ? [{ x: 11, y: 10 }] : [
            { x: 9, y: 9 }, { x: 10, y: 9 }, { x: 11, y: 9 },
            { x: 9, y: 10 },
            { x: 9, y: 11 }, { x: 10, y: 11 }, { x: 11, y: 11 },
        ];
        const cloud = createHarmlessGasCloudSelection(game, cells, { ttl: 10 });
        assert.ok(cloud);
        cloud.damage = 8;
        initRng(7n);

        await kickDirection('l', ' '.repeat(20));

        assert.match(game._pending_message, /evading your kick/);
        assert.ok(jackal.mx !== 11 || jackal.my !== 10, 'The jackal left its original square');
        assert.equal(jackal.mhp, 100, 'Evasion avoids kick damage');
        await runLevelRegions(game, { publish: async () => {} });

        assert.equal(jackal.mhp < 100, !startsInside,
            `The jackal ${startsInside ? 'outside' : 'inside'} the cloud has ${jackal.mhp} HP`);
    });
}

void test('a heavy load can leave a clumsy kick harmless', async () => {
    const lichen = await installKickArena(158);
    requirePlayingGame(game);
    await addInventoryObject(OBJECT_NAMES.indexOf('plate mail'));
    await addInventoryObject(OBJECT_NAMES.indexOf('food ration'), { quan: 2 });
    initRng(2n);
    await kickDirection('l');

    assert.equal(lichen.mhp, 20);
    assert.equal(game._pending_message, 'Your clumsy kick does no damage.');
});

void test('a levitating hero can miss a tiny monster and recoil',
    async () => {
        const garterSnake = await installKickArena(214);
        requirePlayingGame(game);
        game.u.levitating = true;
        // An open doorway provides a brace without blocking the recoil.
        game.level.requireAt(9, 10).typ = DOOR;
        game.level.requireAt(9, 10).doormask = D_ISOPEN;
        initRng(2n);
        await kickDirection('l', [' ']);

        assert.equal(garterSnake.mhp, 20);
        assert.deepEqual([garterSnake.mx, garterSnake.my], [11, 10]);
        assert.deepEqual([game.u.ux, game.u.uy], [9, 10]);
        assert.equal(
            game._pending_message,
            'You float in the opposite direction.',
        );
    });

void test('kicking a pet costs a Samurai honor and frightens the pet', async () => {
    const dog = await installKickArena(16, 'samurai');
    requirePlayingGame(game);
    initializePet(dog, { state: game });
    dog.mtame = 10;
    initRng(2n);
    await kickDirection('l', ['y', ' ', ' ']);

    assert.equal(game.u.ualign.record, 9);
    assert.equal(dog.mtame, 9);
    assert.equal(dog.mflee, 1);
});

void test('declining a pet kick leaves the pet alone and takes no turn', async () => {
    const dog = await installKickArena(16);
    requirePlayingGame(game);
    initializePet(dog, { state: game });
    dog.mtame = 10;
    initRng(2n);
    await kickDirection('l', ['n']);

    assert.equal(dog.mhp, 20);
    assert.equal(dog.mtame, 10);
    assert.equal(game.context.move, 0);
});

void test('kicking a wall while levitating throws the hero backward', async () => {
    await installKickArena(16);
    requirePlayingGame(game);
    game.level.monsters = [];
    game.level.requireAt(11, 10).typ = STONE;
    vision_reset();
    game.u.levitating = true;
        // An open doorway provides a brace without blocking the recoil.
        game.level.requireAt(9, 10).typ = DOOR;
        game.level.requireAt(9, 10).doormask = D_ISOPEN;
    game.u.uhp = game.u.uhpmax = 100;
    initRng(19n);
    await kickDirection('l', [' ', ' ']);

    assert.deepEqual([game.u.ux, game.u.uy], [6, 10]);
});

void test('kicking a statue trap releases its monster', async () => {
    const level = freshKickArena();
    requirePlayingGame(game);
    const x = 11;
    const y = 10;
    initRng(9403n);
    const statue = await createCorpstatAt(STATUE, null, PM_JACKAL, x, y, 0);
    addTrap(level, STATUE_TRAP, x, y, { tseen: false });
    initRng(17n);
    await kickDirection('l');

    const jackal = level.monsters.find(monster =>
        monster.mnum === PM_JACKAL && monster.mx === x && monster.my === y,
    );
    assert.ok(jackal);
    assert.equal(jackal.mpeaceful, 0);
    assert.equal(statue.where, 'gone');
    assert.equal(level.traps.length, 0);
    assert.equal(game.context.move, 1);
});

void test('hurtling into a peaceful monster wakes and angers it', async () => {
    const human = await installKickArena(260);
    requirePlayingGame(game);
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

void test('a cockatrice hero recoiling into an unarmored monster leaves a statue',
    async () => {
        const human = await installKickArena(260);
        requirePlayingGame(game);
        human.mx = 9;
        const club = await uninitializedObject(OBJECT_NAMES.indexOf('club'), {
            owt: 30,
        });
        await equipMonsterObject(human, club, 0);
        game.level.requireAt(11, 10).typ = STONE;
        game.u.levitating = true;
        // An open doorway provides a brace without blocking the recoil.
        game.level.requireAt(9, 10).typ = DOOR;
        game.level.requireAt(9, 10).doormask = D_ISOPEN;
        game.u.mtimedone = 100;
        game.u.umonnum = 10;
        game.u.mh = game.u.mhmax = 20;
        game.u.uhp = game.u.uhpmax = 100;
        vision_reset();
        initRng(19n);
        await kickDirection('l', ' '.repeat(20));

        assert.equal(game.level.monsters.includes(human), false);
        const statue = floorObjectsAt(game.level, 9, 10)
            .find(object => object.otyp === STATUE);
        assert.ok(statue);
        assert.equal(statue.corpsenm, 260);
        assert.ok(statue.contents?.includes(club));
        assert.equal(game.u.uconduct.killer, 1);
    });

void test('a worn life-saving amulet saves a monster from petrifying recoil',
    async () => {
        const human = await installKickArena(260);
        requirePlayingGame(game);
        human.mx = 9;
        const amulet = await uninitializedObject(AMULET_OF_LIFE_SAVING);
        await equipMonsterObject(human, amulet, W_AMUL);
        game.level.requireAt(11, 10).typ = STONE;
        game.u.levitating = true;
        // An open doorway provides a brace without blocking the recoil.
        game.level.requireAt(9, 10).typ = DOOR;
        game.level.requireAt(9, 10).doormask = D_ISOPEN;
        game.u.mtimedone = 100;
        game.u.umonnum = 10;
        game.u.mh = game.u.mhmax = 20;
        game.u.uhp = game.u.uhpmax = 100;
        vision_reset();
        initRng(19n);
        await kickDirection('l', ' '.repeat(30));

        assert.equal(game.level.monsters.includes(human), true);
        assert.equal(human.mhp, human.mhpmax);
        assert.equal(human.minvent.includes(amulet), false);
        const statue = game.level.objects?.[9]?.[10]
            ?.find(object => object.otyp === STATUE);
        assert.equal(statue, undefined);
        assert.equal(game.u.uconduct.killer, 1);
    });

void test('a martial kick can push a monster into a web', async () => {
    let reeled = false;
    for (let seed = 1; seed <= 30 && !reeled; seed++) {
        const monster = await installKickArena('goblin', 'monk');
        requirePlayingGame(game);
        const web = addTrap(game.level, WEB, 12, 10);
        initRng(BigInt(seed));

        await kickDirection('l', ' '.repeat(50));

        reeled = monster.mx === 12;
        if (reeled) {
            assert.equal(monster.mtrapped, 1);
            assert.equal(web.tseen, true);
        }
    }
    assert.ok(reeled, 'a kick pushed the goblin onto the web');
});

for (const startsInside of [false, true]) {
    void test(`a martial kick ${startsInside ? 'out of' : 'into'} gas changes the monster's exposure`, async () => {
        let reeled = false;
        for (let seed = 1; seed <= 30 && !reeled; seed++) {
            const monster = await installKickArena('goblin', 'monk');
            monster.mhp = 100;
            const cloud = createHarmlessGasCloudSelection(game,
                [{ x: startsInside ? 11 : 12, y: 10 }], { ttl: 10 });
            assert.ok(cloud);
            cloud.damage = 8;
            initRng(BigInt(seed));

            await kickDirection('l', ' '.repeat(20));

            reeled = monster.mx === 12;
            if (reeled) {
                const hpAfterKick = monster.mhp;
                await runLevelRegions(game, { publish: async () => {} });
                assert.equal(monster.mhp < hpAfterKick, !startsInside,
                    'Only a monster kicked into the cloud takes gas damage');
            }
        }
        assert.ok(reeled, 'A martial kick must push the goblin to the next square');
    });
}

for (const lifesaving of [false, true]) {
    void test(`a kicked monster resolves a fatal bear trap${lifesaving ? ' with life saving' : ''}`, async () => {
        let fatalTrap = false;
        for (let seed = 1; seed <= 60 && !fatalTrap; seed++) {
            const monster = await installKickArena('orc-captain', 'monk');
            requirePlayingGame(game);
                monster.mhp = 10;
            addTrap(game.level, BEAR_TRAP, 12, 10);
            const amulet = lifesaving ? await equipMonsterObject(monster,
                await uninitializedObject(AMULET_OF_LIFE_SAVING), W_AMUL) : null;
            initRng(BigInt(seed));

            await kickDirection('l', ' '.repeat(60));

            fatalTrap = monster.mx === 12 && (lifesaving
                ? !!amulet && !monster.minvent.includes(amulet) : !!monster.dead);
            if (fatalTrap) {
                assert.equal(game.level.monsters.includes(monster), lifesaving);
                assert.equal(game.u.uconduct.killer || 0, 0,
                    'the trap death is not counted again as a direct hero kill');
                if (lifesaving) assert.ok(monster.mhp > 0);
            }
        }
        assert.ok(fatalTrap, 'the kick and bear trap together caused a fatal wound');
    });
}
