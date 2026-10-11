import { createSpecialLevel } from './support/topology.js';
import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    ACH_TUNE, DBWALL, DB_MOAT, DB_NORTH, DOOR, DRAWBRIDGE_DOWN,
    DRAWBRIDGE_UP, D_NODOOR, MOAT, PIT, W_AMUL,
} from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { finishHeroMonsterKill } from '../js/hero_monster_death.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { playInstrument } from '../js/music.js';
import { destroyDrawbridge } from '../js/dbridge.js';
import {
    AMULET_OF_LIFE_SAVING, BOULDER, ROCK, WOODEN_HARP,
} from '../js/object_data.js';
import { placeCreatedObject } from '../js/floor_object.js';
import { mksobj } from '../js/mklev.js';
import { knownObject } from './support/game-objects.js';
import { floorObjectsAt, addTrap } from './support/level-state.js';
import {
    createMonsterAt, equipMonsterObject,
} from './support/monsters.js';
import { freshGameplayRoom } from './support/playable-room.js';

const PM_WATER_ELEMENTAL = 157;
const PM_GHOST = 287;

function installStrongholdDrawbridge() {
    const level = freshGameplayRoom();
    requireFixtureGame(game);
    game.u.ux = 11;
    game.u.uy = 10;
    game.u.uz = { dnum: 1, dlevel: 5 };
    game.stronghold_level = createSpecialLevel({ dnum: 1, dlevel: 5 });
    game.castleTune = 'ABCDE';
    const bridge = level.requireAt(12, 10);
    bridge.typ = DRAWBRIDGE_UP;
    bridge.drawbridgemask = DB_NORTH | DB_MOAT;
    const wall = level.requireAt(12, 9);
    wall.typ = DBWALL;
    return { level, bridge, wall };
}

async function harp() {
    return knownObject(WOODEN_HARP, { spe: 0 });
}

void test('the Stronghold passtune opens and closes its drawbridge', async () => {
    const { bridge, wall } = installStrongholdDrawbridge();
    requireFixtureGame(game);
    pushKeys(`nABCDE\n${' '.repeat(20)}`);

    await playInstrument(await harp());

    assert.equal(bridge.typ, DRAWBRIDGE_DOWN);
    assert.equal(wall.typ, DOOR);
    assert.equal(wall.doormask, D_NODOOR);
    assert.equal(game.u.uevent?.uheard_tune, 2);
    assert.ok(game.u.uachieved?.includes(ACH_TUNE));

    resetInputState();
    // Acknowledge the opening message before the next instrument question.
    pushKeys(` ny${' '.repeat(20)}`);
    await playInstrument(await harp());

    assert.equal(bridge.typ, DRAWBRIDGE_UP);
    assert.equal(wall.typ, DBWALL);
});

void test('opening a drawbridge destroys objects and traps on the span',
    async () => {
        const { level, bridge } = installStrongholdDrawbridge();
        const rock = placeCreatedObject(await knownObject(ROCK), 12, 10);
        addTrap(level, PIT, 12, 10);
        pushKeys(`nABCDE\n${' '.repeat(20)}`);

        await playInstrument(await harp());

        assert.equal(bridge.typ, DRAWBRIDGE_DOWN);
        assert.equal(rock.where, 'gone');
        assert.equal(level.traps.some(trap =>
            trap.tx === 12 && trap.ty === 10), false);
    });

void test('a lowering drawbridge crushes a grounded monster on the span',
    async () => {
        const { level, bridge } = installStrongholdDrawbridge();
        const monster = await createMonsterAt('giant ant', 12, 10);
        requirePlayingGame(game);
        const kills = game.u.uconduct.killer ?? 0;
        const experience = game.u.uexp;
        pushKeys(`nABCDE\n${' '.repeat(30)}`);

        await playInstrument(await harp());

        assert.equal(bridge.typ, DRAWBRIDGE_DOWN);
        assert.equal(level.monsters.includes(monster), false);
        assert.equal(game.u.uconduct.killer, kills + 1);
        assert.ok(game.u.uexp > experience, 'a hero-operated bridge credits its kill to the hero');
    });

void test('a life-saved shifted vampire survives a lowering drawbridge',
    async () => {
        const { level } = installStrongholdDrawbridge();
        const vampireLeader = MONSTER_NAME.indexOf('vampire leader');
        const monster = await createMonsterAt('wolf', 12, 10);
        monster.cham = vampireLeader;
        const amulet = await equipMonsterObject(
            monster,
            await knownObject(AMULET_OF_LIFE_SAVING),
            W_AMUL,
        );
        pushKeys(`nABCDE\n${' '.repeat(50)}`);

        await playInstrument(await harp(), {
            finishMonsterKill: finishHeroMonsterKill,
        });

        assert.equal(monster.mnum, vampireLeader);
        assert.ok(monster.mhp > 0);
        assert.equal(level.monsters.includes(monster), true);
        assert.equal(amulet.where, 'gone');
    });

void test('an opening portcullis releases its occupant onto the bridge',
    async () => {
        const { level } = installStrongholdDrawbridge();
        const monster = await createMonsterAt(PM_WATER_ELEMENTAL, 12, 9);
        monster.mcanmove = 0;
        monster.msleeping = 1;
        pushKeys(`nABCDE\n${' '.repeat(30)}`);

        await playInstrument(await harp());

        assert.equal(level.monsters.includes(monster), true);
        assert.equal(monster.mx, 12);
        assert.equal(monster.my, 10);
    });

void test('a closing portcullis crushes a helpless monster', async () => {
    const { level, bridge, wall } = installStrongholdDrawbridge();
    requireFixtureGame(game);
    bridge.typ = DRAWBRIDGE_DOWN;
    wall.typ = DOOR;
    wall.doormask = D_NODOOR;
    game.u.uevent = { uheard_tune: 2 };
    const monster = await createMonsterAt('giant ant', 12, 9);
    monster.mcanmove = 0;
    monster.msleeping = 1;
    pushKeys(`ny${' '.repeat(30)}`);

    await playInstrument(await harp());

    assert.equal(bridge.typ, DRAWBRIDGE_UP);
    assert.equal(level.monsters.includes(monster), false);
});

void test('a ghost passes through a lowering drawbridge', async () => {
    const { level, bridge } = installStrongholdDrawbridge();
    const ghost = await createMonsterAt(PM_GHOST, 12, 10);
    pushKeys(`nABCDE\n${' '.repeat(30)}`);

    await playInstrument(await harp());

    assert.equal(bridge.typ, DRAWBRIDGE_DOWN);
    assert.equal(level.monsters.includes(ghost), true);
    assert.equal(ghost.mx, 12);
    assert.equal(ghost.my, 10);
});

void test('destroying a drawbridge drops its span and portcullis into the moat',
    async () => {
        const { level, bridge, wall } = installStrongholdDrawbridge();
        requireFixtureGame(game);
        const monster = await createMonsterAt('giant ant', 12, 9);
        pushKeys(' '.repeat(20));

        await destroyDrawbridge(12, 10);

        assert.equal(bridge.typ, MOAT);
        assert.equal(wall.typ, DOOR);
        assert.equal(wall.doormask, D_NODOOR);
        assert.equal(level.monsters.includes(monster), false);
        assert.equal(game.u.uevent?.uheard_tune, 3);
    });

void test('a boulder on a collapsing drawbridge falls into the water', async () => {
    const { level } = installStrongholdDrawbridge();
    const boulder = placeCreatedObject(await mksobj(BOULDER, false, false), 12, 10);
    pushKeys(' '.repeat(20));

    await destroyDrawbridge(12, 10);

    assert.equal(boulder.where, 'gone');
    assert.equal(floorObjectsAt(level, 12, 10).includes(boulder), false);
});
