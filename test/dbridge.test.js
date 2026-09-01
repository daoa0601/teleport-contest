import test from 'node:test';
import assert from 'node:assert/strict';

import {
    ACH_TUNE, DBWALL, DB_MOAT, DB_NORTH, DOOR, DRAWBRIDGE_DOWN,
    DRAWBRIDGE_UP, D_NODOOR, PIT,
} from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { playInstrument } from '../js/music.js';
import { ROCK, WOODEN_HARP } from '../js/object_data.js';
import { place_object } from '../js/mklev.js';
import { freshWeaponArena } from './support/weapon-arena.js';

function installStrongholdDrawbridge() {
    const level = freshWeaponArena();
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
        level.traps.push({ tx: 12, ty: 10, ttyp: PIT });
        pushKeys(`nABCDE\n${' '.repeat(20)}`);

        await playInstrument(harp());

        assert.equal(bridge.typ, DRAWBRIDGE_DOWN);
        assert.equal(rock.where, 'gone');
        assert.equal(level.traps.some(trap =>
            trap.tx === 12 && trap.ty === 10), false);
    });
