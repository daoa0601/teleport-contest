import test from 'node:test';
import assert from 'node:assert/strict';

import {
    ACH_TUNE, DBWALL, DB_MOAT, DB_NORTH, DOOR, DRAWBRIDGE_DOWN,
    DRAWBRIDGE_UP, D_NODOOR, MOAT, PIT, W_AMUL,
} from '../js/const.js';
import { game } from '../js/gstate.js';
import { finishHeroMonsterKill } from '../js/hero_monster_death.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { playInstrument } from '../js/music.js';
import { destroyDrawbridge } from '../js/dbridge.js';
import {
    AMULET_OF_LIFE_SAVING, BOULDER, ROCK, WOODEN_HARP,
} from '../js/object_data.js';
import { place_object } from '../js/floor_object.js';
import { mksobj } from '../js/mklev.js';
import { knownObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import {
    addMonster, equipMonsterObject,
} from './support/monsters.js';
import { freshGameplayRoom } from './support/playable-room.js';

const PM_WATER_ELEMENTAL = 157;
const PM_GHOST = 287;

function installStrongholdDrawbridge() {
    const level = freshGameplayRoom();
    game.u.ux = 11;
    game.u.uy = 10;
    game.u.uz = { dnum: 1, dlevel: 5 };
    game.stronghold_level = { dnum: 1, dlevel: 5 };
    game.castleTune = 'ABCDE';
    const bridge = level.at(12, 10);
    bridge.typ = DRAWBRIDGE_UP;
    bridge.drawbridgemask = DB_NORTH | DB_MOAT;
    const wall = level.at(12, 9);
    wall.typ = DBWALL;
    return { level, bridge, wall };
}

function harp() {
    return {
        otyp: WOODEN_HARP,
        name: 'wooden harp',
        spe: 0,
        charges: { current: 0, recharged: 0 },
    };
}

test('the Stronghold passtune opens and closes its drawbridge', async () => {
    const { bridge, wall } = installStrongholdDrawbridge();
    pushKeys(`nABCDE\n${' '.repeat(20)}`);

    await playInstrument(harp());

    assert.equal(bridge.typ, DRAWBRIDGE_DOWN);
    assert.equal(wall.typ, DOOR);
    assert.equal(wall.doormask, D_NODOOR);
    assert.equal(game.u.uevent.uheard_tune, 2);
    assert.ok(game.u.uachieved.includes(ACH_TUNE));

    resetInputState();
    pushKeys(`ny${' '.repeat(20)}`);
    await playInstrument(harp());

    assert.equal(bridge.typ, DRAWBRIDGE_UP);
    assert.equal(wall.typ, DBWALL);
});

test('opening a drawbridge destroys objects and traps on the span',
    async () => {
        const { level, bridge } = installStrongholdDrawbridge();
        const rock = {
            otyp: ROCK,
            name: 'rock',
            quan: 1,
            quantity: 1,
            where: 'free',
        };
        place_object(rock, 12, 10);
        addTrap(level, PIT, 12, 10);
        pushKeys(`nABCDE\n${' '.repeat(20)}`);

        await playInstrument(harp());

        assert.equal(bridge.typ, DRAWBRIDGE_DOWN);
        assert.equal(rock.where, 'gone');
        assert.equal(level.traps.some(trap =>
            trap.tx === 12 && trap.ty === 10), false);
    });

test('a lowering drawbridge crushes a grounded monster on the span',
    async () => {
        const { level, bridge } = installStrongholdDrawbridge();
        const monster = addMonster({ mnum: 0, x: 12, y: 10 });
        pushKeys(`nABCDE\n${' '.repeat(30)}`);

        await playInstrument(harp());

        assert.equal(bridge.typ, DRAWBRIDGE_DOWN);
        assert.equal(level.monsters.includes(monster), false);
    });

test('a life-saved shifted vampire survives a lowering drawbridge',
    async () => {
        const { level } = installStrongholdDrawbridge();
        const vampireLeader = MONSTER_NAME.indexOf('vampire leader');
        const monster = addMonster({
            species: 'wolf', x: 12, y: 10, cham: vampireLeader,
        });
        const amulet = equipMonsterObject(
            monster,
            knownObject(AMULET_OF_LIFE_SAVING),
            W_AMUL,
        );
        pushKeys(`nABCDE\n${' '.repeat(50)}`);

        await playInstrument(harp(), {
            finishMonsterKill: finishHeroMonsterKill,
        });

        assert.equal(monster.mnum, vampireLeader);
        assert.ok(monster.mhp > 0);
        assert.equal(level.monsters.includes(monster), true);
        assert.equal(amulet.where, 'gone');
    });

test('an opening portcullis releases its occupant onto the bridge',
    async () => {
        const { level } = installStrongholdDrawbridge();
        const monster = addMonster({
            mnum: PM_WATER_ELEMENTAL, x: 12, y: 9,
            mcanmove: 0,
            msleeping: 1,
        });
        pushKeys(`nABCDE\n${' '.repeat(30)}`);

        await playInstrument(harp());

        assert.equal(level.monsters.includes(monster), true);
        assert.equal(monster.mx, 12);
        assert.equal(monster.my, 10);
    });

test('a closing portcullis crushes a helpless monster', async () => {
    const { level, bridge, wall } = installStrongholdDrawbridge();
    bridge.typ = DRAWBRIDGE_DOWN;
    wall.typ = DOOR;
    wall.doormask = D_NODOOR;
    game.u.uevent = { uheard_tune: 2 };
    const monster = addMonster({
        mnum: 0, x: 12, y: 9,
        mcanmove: 0,
        msleeping: 1,
    });
    pushKeys(`ny${' '.repeat(30)}`);

    await playInstrument(harp());

    assert.equal(bridge.typ, DRAWBRIDGE_UP);
    assert.equal(level.monsters.includes(monster), false);
});

test('a ghost passes through a lowering drawbridge', async () => {
    const { level, bridge } = installStrongholdDrawbridge();
    const ghost = addMonster({ mnum: PM_GHOST, x: 12, y: 10 });
    pushKeys(`nABCDE\n${' '.repeat(30)}`);

    await playInstrument(harp());

    assert.equal(bridge.typ, DRAWBRIDGE_DOWN);
    assert.equal(level.monsters.includes(ghost), true);
    assert.equal(ghost.mx, 12);
    assert.equal(ghost.my, 10);
});

test('destroying a drawbridge drops its span and portcullis into the moat',
    async () => {
        const { level, bridge, wall } = installStrongholdDrawbridge();
        const monster = addMonster({ mnum: 0, x: 12, y: 9 });
        pushKeys(' '.repeat(20));

        await destroyDrawbridge(12, 10);

        assert.equal(bridge.typ, MOAT);
        assert.equal(wall.typ, DOOR);
        assert.equal(wall.doormask, D_NODOOR);
        assert.equal(level.monsters.includes(monster), false);
        assert.equal(game.u.uevent.uheard_tune, 3);
    });

test('a boulder on a collapsing drawbridge falls into the water', async () => {
    const { level } = installStrongholdDrawbridge();
    const boulder = place_object(mksobj(BOULDER, false, false), 12, 10);
    pushKeys(' '.repeat(20));

    await destroyDrawbridge(12, 10);

    assert.equal(boulder.where, 'gone');
    assert.equal(level.objects[12][10].includes(boulder), false);
});
