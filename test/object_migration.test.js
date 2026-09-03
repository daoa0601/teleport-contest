import test from 'node:test';
import assert from 'node:assert/strict';

import { COLNO, HOLE, ROOM, ROWNO, STONE } from '../js/const.js';
import { place_object } from '../js/floor_object.js';
import { GameMap } from '../js/game.js';
import { game } from '../js/gstate.js';
import {
    deliverMigratingObjects, shipObject,
} from '../js/object_migration.js';
import {
    APPLE, ARROW, CARROT, CHAIN_MAIL, CLUB, MIRROR, ROCK,
} from '../js/object_data.js';
import { throwInventoryObject } from './support/commands.js';
import {
    knownInventoryObject, knownObject,
} from './support/game-objects.js';
import { addTrap, floorObjects } from './support/level-state.js';
import { freshGameplayRoom } from './support/playable-room.js';

function sourceLevel({ ladder = false } = {}) {
    const level = freshGameplayRoom();
    game.u.uz = { dnum: 0, dlevel: 1 };
    game.dungeons = [{ num_dunlevs: 2, flags: {} }];
    game.stairs = {
        sx: 10, sy: 10, up: false, isladder: ladder,
        tolev: { dnum: 0, dlevel: 2 }, next: null,
    };
    return level;
}

function enterDestination({ ladder = false, region = null } = {}) {
    const level = new GameMap();
    for (let x = 8; x <= 18; x++) {
        for (let y = 8; y <= 12; y++) {
            Object.assign(level.at(x, y), {
                typ: ROOM, lit: true, waslit: true, seenv: 255,
            });
        }
    }
    level.downTeleportRegion = region;
    game.level = level;
    game.u.uz = { dnum: 0, dlevel: 2 };
    game.stairs = ladder === null ? null : {
        sx: 12, sy: 10, up: true, isladder: ladder,
        tolev: { dnum: 0, dlevel: 1 }, next: null,
    };
    return level;
}

test('an object always falls down a ladder and arrives on the linked level',
    async () => {
        sourceLevel({ ladder: true });
        const club = knownObject(CLUB, { spe: 0 });

        const shipped = await shipObject(club, 10, 10, {
            state: game,
            random: () => 2,
        });
        const destination = enterDestination({ ladder: true });
        await deliverMigratingObjects(game, {
            random: range => range === 100 ? 99 : 4,
            rollOne: () => 1,
        });

        assert.equal(shipped, true);
        assert.equal(floorObjects(destination).includes(club), true);
    });

test('hero-thrown objects can fall down a ladder', async () => {
    const specimens = [
        { type: CHAIN_MAIL, name: 'chain mail' },
        { type: ARROW, name: 'arrow', answers: [' '] },
        { type: ROCK, name: 'rock' },
        { type: APPLE, name: 'apple' },
        { type: CARROT, name: 'carrot' },
    ];
    for (const specimen of specimens) {
        const source = sourceLevel({ ladder: true });
        game.stairs.sx = 11;
        source.at(12, 10).typ = STONE;
        const object = knownInventoryObject(specimen.type, {
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
        assert.deepEqual(object.migration.destination, {
            dnum: 0,
            dlevel: 2,
        });
    }
});

test('an object falling through a hole lands inside the lower arrival region',
    async () => {
        const source = sourceLevel();
        game.stairs = null;
        addTrap(source, HOLE, 10, 10, { tseen: true });
        const club = knownObject(CLUB, { spe: 0 });
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

test('a mirror can break while falling and carries its Luck penalty',
    async () => {
        sourceLevel();
        game.u.uluck = 5;
        const mirror = knownObject(MIRROR);
        const messages = [];

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

test('a falling object can knock another floor object down with it',
    async () => {
        const source = sourceLevel();
        const rock = place_object(knownObject(ROCK), 10, 10);
        const club = knownObject(CLUB, { spe: 0 });

        await shipObject(club, 10, 10, {
            state: game,
            random: range => range === 100 ? 99 : 0,
        });

        assert.equal(floorObjects(source).includes(rock), false);
        const destination = enterDestination();
        await deliverMigratingObjects(game, {
            random: range => range === 100 ? 99 : 4,
            rollOne: () => 1,
        });
        assert.equal(floorObjects(destination).includes(club), true);
        assert.equal(floorObjects(destination).includes(rock), true);
    });
