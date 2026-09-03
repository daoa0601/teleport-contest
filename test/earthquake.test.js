import test from 'node:test';
import assert from 'node:assert/strict';

import {
    COLNO, DOOR, D_CLOSED, D_NODOOR, MOAT, PIT, ROOM, ROWNO, STONE,
    TT_PIT, W_AMUL,
} from '../js/const.js';
import { createEarthquake } from '../js/earthquake.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { playInstrument } from '../js/music.js';
import {
    AMULET_OF_LIFE_SAVING, BOULDER, DRUM_OF_EARTHQUAKE,
} from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { floorObject, knownObject } from './support/game-objects.js';
import {
    addMonster, equipMonsterObject,
} from './support/monsters.js';
import { freshWeaponArena } from './support/weapon-arena.js';

function targetMonster(x, y, overrides = {}) {
    return addMonster({
        species: 'giant ant', x, y, hitPoints: 100,
        mfrozen: 0,
        msleeping: 1,
        mstrategy: 0,
        ...overrides,
    });
}

function earthquakeDrum(charges) {
    return {
        otyp: DRUM_OF_EARTHQUAKE,
        name: 'drum of earthquake',
        spe: charges,
        charges: { current: charges, recharged: 0 },
    };
}

test('an earthquake opens chasms under the hero and nearby monsters',
    async () => {
        const level = freshWeaponArena();
        game.u.uhp = game.u.uhpmax = 1000;
        const monster = targetMonster(11, 10);
        pushKeys(' '.repeat(100));

        await createEarthquake(13);

        assert.ok(level.traps.some(trap =>
            trap.tx === 10 && trap.ty === 10 && trap.ttyp === PIT));
        assert.equal(game.u.utraptype, TT_PIT);
        assert.ok(game.u.uhp < 1000);
        assert.equal(monster.mtrapped, 1);
        assert.ok(monster.mhp < 100);
    });

test("a monster's life-saving amulet works after an earthquake fall",
    async () => {
        const level = freshWeaponArena();
        game.u.uhp = game.u.uhpmax = 1000;
        const monster = targetMonster(11, 10, {
            hitPoints: 1,
            maxHitPoints: 1,
        });
        const amulet = equipMonsterObject(
            monster,
            knownObject(AMULET_OF_LIFE_SAVING),
            W_AMUL,
        );
        pushKeys(' '.repeat(100));

        await createEarthquake(13);

        assert.equal(level.monsters.includes(monster), true);
        assert.ok(monster.mhp > 0);
        assert.equal(amulet.where, 'gone');
    });

test('an earthquake collapses doors and drops boulders into chasms',
    async () => {
        const level = freshWeaponArena();
        game.u.uhp = game.u.uhpmax = 1000;
        const door = level.at(11, 10);
        door.typ = DOOR;
        door.doormask = D_CLOSED;
        const boulder = floorObject(BOULDER, 12, 10);
        pushKeys(' '.repeat(100));

        await createEarthquake(13);

        assert.equal(door.typ, DOOR);
        assert.equal(door.doormask, D_NODOOR);
        assert.equal(boulder.where, 'gone');
        assert.equal(level.traps.some(trap =>
            trap.tx === 12 && trap.ty === 10), false);
    });

test('a nearby moat flows into a new chasm', async () => {
    const level = freshWeaponArena();
    for (let x = 1; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) level.at(x, y).typ = STONE;
    }
    const center = { x: 12, y: 10 };
    level.at(center.x, center.y).typ = ROOM;
    for (let x = center.x - 1; x <= center.x + 1; x++) {
        for (let y = center.y - 1; y <= center.y + 1; y++) {
            if (x !== center.x || y !== center.y)
                level.at(x, y).typ = MOAT;
        }
    }
    game.u.ux = 16;
    game.u.uy = 10;
    initRng(1n);

    await createEarthquake(13);

    assert.equal(level.at(center.x, center.y).typ, MOAT);
    assert.equal(level.traps.some(trap =>
        trap.tx === center.x && trap.ty === center.y), false);
});

test('a charged earthquake drum shakes the level and spends one charge',
    async () => {
        const level = freshWeaponArena();
        game.u.ulevel = 30;
        game.u.uhp = game.u.uhpmax = 1000;
        const drum = earthquakeDrum(2);
        pushKeys(' '.repeat(200));

        await playInstrument(drum);

        assert.equal(drum.spe, 1);
        assert.equal(drum.typeKnown, true);
        assert.ok(level.traps.length > 0);
    });

test('an empty earthquake drum acts like an ordinary drum', async () => {
    const level = freshWeaponArena();
    const monster = targetMonster(11, 10);
    const drum = earthquakeDrum(0);
    pushKeys(' '.repeat(20));

    await playInstrument(drum);

    assert.equal(level.traps.length, 0);
    assert.equal(monster.msleeping, 0);
    assert.equal(game.u.deafTurns ?? 0, 0);
});
