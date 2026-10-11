import type { ArrivalRegion } from '../js/map_types.js';
import { createDungeon } from './support/topology.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { COLNO, HOLE, ROOM, ROWNO, STONE } from '../js/const.js';
import { placeCreatedObject } from '../js/floor_object.js';
import { GameMap } from '../js/game.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import {
    deliverMigratingObjects, impactDrop, shipObject,
} from '../js/object_migration.js';
import {
    APPLE, ARROW, CARROT, CHAIN_MAIL, CLUB, MIRROR, ROCK,
} from '../js/object_data.js';
import { throwInventoryObject } from './support/commands.js';
import {
    addInventoryObject, knownObject,
} from './support/game-objects.js';
import { addTrap, floorObjects } from './support/level-state.js';
import { freshGameplayRoom } from './support/playable-room.js';

function sourceLevel({ ladder = false } = {}) {
    const level = freshGameplayRoom();
    requirePlayingGame(game);
    game.u.uz = { dnum: 0, dlevel: 1 };
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 2 })];
    game.stairs = {
        sx: 10, sy: 10, up: false, isladder: ladder,
        tolev: { dnum: 0, dlevel: 2 }, next: null, u_traversed: false,
    };
    return level;
}

function enterDestination({ ladder = false, region = null }: { ladder?: boolean | null; region?: ArrivalRegion | null } = {}) {
    const level = new GameMap();
    for (let x = 8; x <= 18; x++) {
        for (let y = 8; y <= 12; y++) {
            const terrainSquare = level.requireAt(x, y);
            terrainSquare.typ = ROOM;
            terrainSquare.lit = true;
            terrainSquare.waslit = true;
            terrainSquare.seenv = 255;
        }
    }
    level.downTeleportRegion = region;
    game.level = level;
    game.u.uz = { dnum: 0, dlevel: 2 };
    game.stairs = ladder === null ? null : {
        sx: 12, sy: 10, up: true, isladder: ladder,
        tolev: { dnum: 0, dlevel: 1 }, next: null, u_traversed: false,
    };
    return level;
}

void test('an object always falls down a ladder and arrives on the linked level',
    async () => {
        sourceLevel({ ladder: true });
        requirePlayingGame(game);
        const club = await knownObject(CLUB, { spe: 0 });

        const shipped = await shipObject(club, 10, 10, {
            state: game,
            random: () => 2,
        });
        const destination = enterDestination({ ladder: true });
        requirePlayingGame(game);
        await deliverMigratingObjects(game, {
            random: range => range === 100 ? 99 : 4,
            rollOne: () => 1,
        });

        assert.equal(shipped, true);
        assert.equal(floorObjects(destination).includes(club), true);
    });

void test('hero-thrown objects can fall down a ladder', async () => {
    const specimens = [
        { type: CHAIN_MAIL, name: 'chain mail' },
        { type: ARROW, name: 'arrow', answers: [' '] },
        { type: ROCK, name: 'rock' },
        { type: APPLE, name: 'apple' },
        { type: CARROT, name: 'carrot' },
    ];
    for (const specimen of specimens) {
        const source = sourceLevel({ ladder: true });
        requirePlayingGame(game);
        assert.ok(game.stairs);
        game.stairs.sx = 11;
        source.requireAt(12, 10).typ = STONE;
        const object = await addInventoryObject(specimen.type, {
            invlet: 'a',
            name: specimen.name,
        });

        await throwInventoryObject(object, 'l', specimen.answers);

        assert.equal(
            floorObjects(source).includes(object),
            false,
            `${specimen.name} remained on the source level`,
        );
        assert.equal(object.where, 'migrating');
        assert.ok(object.migration);
        assert.deepEqual(object.migration.destination, {
            dnum: 0,
            dlevel: 2,
        });
    }
});

void test('an object falling through a hole lands inside the lower arrival region',
    async () => {
        const source = sourceLevel();
        requirePlayingGame(game);
        game.stairs = null;
        addTrap(source, HOLE, 10, 10, { tseen: true });
        const club = await knownObject(CLUB, { spe: 0 });
        await shipObject(club, 10, 10, {
            state: game,
            random: range => range === 100 ? 99 : 0,
        });
        const destination = enterDestination({
            ladder: null,
            region: { lx: 14, ly: 9, hx: 14, hy: 9 },
        });

        await deliverMigratingObjects(game, {
            random: range => {
                if (range === COLNO - 3) return 12;
                if (range === ROWNO) return 9;
                return 99;
            },
        });

        assert.equal(floorObjects(destination).includes(club), true);
        assert.deepEqual([club.ox, club.oy], [14, 9]);
    });

void test('objects knocked down a shaft with the hero arrive beside the hero on the same level', async () => {
    const source = sourceLevel();
    requirePlayingGame(game);
    game.stairs = null;
    assert.ok(game.dungeons[0]);
    game.dungeons[0].num_dunlevs = 4;
    addTrap(source, HOLE, 10, 10, { tseen: true });
    const club = placeCreatedObject(await knownObject(CLUB), 10, 10);

    await impactDrop(null, 10, 10, { destinationLevel: 4, random: () => 0 });
    const destination = enterDestination({ ladder: null });
    requirePlayingGame(game);
    game.u.uz.dlevel = 4;
    game.u.ux = 15;
    game.u.uy = 11;
    await deliverMigratingObjects(game, { nearHero: true });

    assert.ok(floorObjects(destination).includes(club));
    assert.equal(club.ox, 15);
    assert.equal(club.oy, 11);
});

void test('a mirror can break while falling and carries its Luck penalty',
    async () => {
        sourceLevel();
        requirePlayingGame(game);
        game.u.uluck = 5;
        const mirror = await knownObject(MIRROR);
        const messages: string[] = [];

        const shipped = await shipObject(mirror, 10, 10, {
            state: game,
            publish: async message => messages.push(message),
            random: range => range === 3 ? 0 : 99,
        });

        assert.equal(shipped, true);
        assert.equal(mirror.where, 'gone');
        assert.equal(game.u.uluck, 3);
        assert.equal(messages.includes('You hear a muffled crash.'), true);
    });

void test('a falling object can knock another floor object down with it',
    async () => {
        const source = sourceLevel();
        requirePlayingGame(game);
        const rock = placeCreatedObject(await knownObject(ROCK), 10, 10);
        const club = await knownObject(CLUB, { spe: 0 });

        await shipObject(club, 10, 10, {
            state: game,
            random: range => range === 100 ? 99 : 0,
        });

        assert.equal(floorObjects(source).includes(rock), false);
        const destination = enterDestination();
        requirePlayingGame(game);
        await deliverMigratingObjects(game, {
            random: range => range === 100 ? 99 : 4,
            rollOne: () => 1,
        });
        assert.equal(floorObjects(destination).includes(club), true);
        assert.equal(floorObjects(destination).includes(rock), true);
    });
