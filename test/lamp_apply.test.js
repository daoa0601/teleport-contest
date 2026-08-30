import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { ROOM, ROOMOFFSET, SHOPBASE } from '../js/const.js';
import { GameMap } from '../js/game.js';
import { game, resetGame } from '../js/gstate.js';
import { pushKey, resetInputState } from '../js/input.js';
import { transformMagicLampToOilLamp } from '../js/light.js';
import {
    BRASS_LANTERN, MAGIC_LAMP, OIL_LAMP,
} from '../js/object_data.js';
import { OBJECT_TIMER_KIND, objectTimers } from '../js/object_timers.js';
import {
    enableRngLog, getRngLog, initRng,
} from '../js/rng.js';
import {
    cansee, vision_recalc, vision_reset_new_level,
} from '../js/vision.js';

process.env.TELEPORT_BRIDGE_FREE = '1';
process.env.TELEPORT_DISABLE_FIXTURES = '1';

function lampObject(otyp, overrides = {}) {
    const names = new Map([
        [BRASS_LANTERN, ['brass lantern', 'brass lanterns', 9102]],
        [OIL_LAMP, ['oil lamp', 'oil lamps', 9101]],
        [MAGIC_LAMP, ['magic lamp', 'magic lamps', 9103]],
    ]);
    const [name, plural, id] = names.get(otyp);
    return {
        otyp,
        o_id: id,
        oclass: 6,
        invlet: 'a',
        name,
        plural,
        quantity: 1,
        quan: 1,
        where: 'inventory',
        contents: [],
        age: 200,
        spe: 1,
        lamplit: false,
        timed: 0,
        objectTimers: [],
        typeKnown: true,
        dknown: true,
        ...overrides,
    };
}

function freshLampState(object, seed = 1n) {
    resetGame();
    game.u = {
        ux: 10, uy: 10,
        uz: { dnum: 0, dlevel: 1 },
        ulevel: 1,
        uhp: 20, uhpmax: 20,
        acurr: { a: Array(6).fill(15) },
        amax: { a: Array(6).fill(15) },
        uhave: {},
        blindTurns: 0,
        deafTurns: 0,
    };
    game.context = { move: 0, nopick: false };
    game.flags = {};
    game.moves = 40;
    game.level = new GameMap();
    game.inventory = [object];
    vision_reset_new_level();
    initRng(seed);
    enableRngLog();
    resetInputState();
    return object;
}

async function applyInventoryA() {
    pushKey('a');
    await rhack('a'.charCodeAt(0));
}


function installLightingShop(lamp) {
    const room = {
        lx: 8, hx: 14, ly: 8, hy: 12,
        rtype: SHOPBASE + 11,
    };
    const shopkeeper = {
        isshk: true,
        dead: false,
        mhp: 20,
        mx: 11, my: 10,
        mpeaceful: 1,
        mute: false,
        eshk: {
            shoproom: ROOMOFFSET,
            shoptype: SHOPBASE + 11,
            shoplevel: { dnum: 0, dlevel: 1 },
            shk: { x: 11, y: 10 },
            shd: { x: 8, y: 10 },
            debit: 0,
            bill: [{
                bo_id: lamp.o_id, bquan: 1, useup: false, price: 10,
            }],
        },
    };
    room.resident = shopkeeper;
    game.level.rooms = [room];
    game.level.nroom = 1;
    game.level.monsters = [shopkeeper];
    for (const [x, y] of [[10, 10], [11, 10]]) {
        const location = game.level.at(x, y);
        location.typ = ROOM;
        location.roomno = ROOMOFFSET;
        location.edge = 0;
    }
    return shopkeeper;
}

test('applying a timed lamp starts it and manual off restores unspent fuel',
    async () => {
        const lamp = freshLampState(lampObject(OIL_LAMP));

        await applyInventoryA();
        assert.equal(game._pending_message, 'Your lamp is now on.');
        assert.equal(game.context.move, 1);
        assert.equal(lamp.lamplit, true);
        assert.equal(lamp.age, 150);
        assert.deepEqual(objectTimers(lamp).map(timer => [
            timer.kind, timer.deadline,
        ]), [[OBJECT_TIMER_KIND.BURN_OBJECT, 90]]);

        game.moves = 60;
        await applyInventoryA();
        assert.equal(game._pending_message, 'Your lamp is now off.');
        assert.equal(lamp.lamplit, false);
        assert.equal(lamp.age, 180);
        assert.deepEqual(objectTimers(lamp), []);
    });

test('lit lamps switch off before underwater rejection is considered',
    async () => {
        const lantern = freshLampState(lampObject(BRASS_LANTERN));
        await applyInventoryA();
        game.u.uinwater = 1;
        game.moves = 50;

        await applyInventoryA();
        assert.equal(game._pending_message, 'Your lantern is now off.');
        assert.equal(lantern.lamplit, false);
        assert.equal(lantern.age, 190);
        assert.deepEqual(objectTimers(lantern), []);
    });

test('magic lamp keeps untimed mobile light until explicitly switched off',
    async () => {
        const lamp = freshLampState(lampObject(
            MAGIC_LAMP, { age: 40 },
        ));
        for (let x = 8; x <= 13; x++) {
            const location = game.level.at(x, 10);
            location.typ = ROOM;
            location.lit = false;
        }
        vision_reset_new_level();
        vision_recalc(0);
        assert.equal(cansee(12, 10), false);

        await applyInventoryA();
        assert.equal(game._pending_message, 'Your lamp is now on.');
        assert.equal(lamp.lamplit, true);
        assert.equal(lamp.age, 40);
        assert.deepEqual(objectTimers(lamp), []);
        vision_recalc(0);
        assert.equal(cansee(12, 10), true);

        game.moves = 10000;
        game.u.uinwater = 1;
        await applyInventoryA();
        assert.equal(game._pending_message, 'Your lamp is now off.');
        assert.equal(lamp.lamplit, false);
        assert.equal(lamp.age, 40);
        assert.deepEqual(objectTimers(lamp), []);
        vision_recalc(0);
        assert.equal(cansee(12, 10), false);
    });

test('lit magic-lamp release changes type and acquires an oil burn timer',
    async () => {
        const lamp = freshLampState(lampObject(
            MAGIC_LAMP, { age: 40 },
        ));
        await applyInventoryA();
        assert.equal(lamp.lamplit, true);
        assert.deepEqual(objectTimers(lamp), []);

        assert.equal(transformMagicLampToOilLamp(
            lamp, 1200, game, game.moves,
        ), true);
        assert.equal(lamp.otyp, OIL_LAMP);
        assert.equal(lamp.name, 'oil lamp');
        assert.equal(lamp.spe, 0);
        assert.equal(lamp.lamplit, true);
        assert.equal(lamp.age, 150);
        assert.deepEqual(objectTimers(lamp).map(timer => [
            timer.kind, timer.deadline,
        ]), [[OBJECT_TIMER_KIND.BURN_OBJECT, 1090]]);
    });

test('unlit underwater and empty lamps refuse without creating timers',
    async () => {
        let lamp = freshLampState(lampObject(OIL_LAMP));
        game.u.uinwater = 1;
        await applyInventoryA();
        assert.equal(game._pending_message, 'This is not a diving lamp.');
        assert.equal(lamp.age, 200);
        assert.equal(lamp.lamplit, false);
        assert.deepEqual(objectTimers(lamp), []);

        lamp = freshLampState(lampObject(OIL_LAMP, { age: 0 }));
        await applyInventoryA();
        assert.equal(game._pending_message, 'This oil lamp has no oil.');
        assert.equal(lamp.lamplit, false);
        assert.deepEqual(objectTimers(lamp), []);

        const lantern = freshLampState(lampObject(
            BRASS_LANTERN, { age: 0 },
        ));
        game.u.permaBlind = true;
        await applyInventoryA();
        assert.equal(game._pending_message, 'Nothing seems to happen.');
        assert.equal(lantern.lamplit, false);
        assert.deepEqual(objectTimers(lantern), []);

        const magic = freshLampState(lampObject(
            MAGIC_LAMP, { age: 40, spe: 0 },
        ));
        await applyInventoryA();
        assert.equal(game._pending_message, 'This magic lamp has no oil.');
        assert.equal(magic.lamplit, false);
        assert.deepEqual(objectTimers(magic), []);
    });

test('cursed lamp failures preserve spill, flicker, blind, and success RNG',
    async () => {
        let lamp = freshLampState(lampObject(
            OIL_LAMP, { cursed: true },
        ), 5n);
        await applyInventoryA();
        assert.equal(game._pending_message,
            'The lamp spills and covers your fingers with oil.');
        assert.equal(game.u.glibTurns, 10);
        assert.deepEqual(getRngLog(), [
            'rn2(2)=0', 'rn2(3)=0', 'd(2,10)=10',
        ]);
        assert.equal(lamp.lamplit, false);

        lamp = freshLampState(lampObject(
            OIL_LAMP, { cursed: true },
        ), 4n);
        await applyInventoryA();
        assert.equal(game._pending_message,
            'The oil lamp flickers for a moment, then dies.');
        assert.deepEqual(getRngLog(), ['rn2(2)=0', 'rn2(3)=1']);
        assert.equal(lamp.lamplit, false);

        const lantern = freshLampState(lampObject(
            BRASS_LANTERN, { cursed: true },
        ), 4n);
        game.u.permaBlind = true;
        await applyInventoryA();
        assert.equal(game._pending_message, 'Nothing seems to happen.');
        assert.deepEqual(getRngLog(), ['rn2(2)=0']);
        assert.equal(lantern.lamplit, false);

        let magic = freshLampState(lampObject(
            MAGIC_LAMP, { age: 40, cursed: true },
        ), 5n);
        await applyInventoryA();
        assert.equal(game._pending_message,
            'The lamp spills and covers your fingers with oil.');
        assert.equal(game.u.glibTurns, 10);
        assert.deepEqual(getRngLog(), [
            'rn2(2)=0', 'rn2(3)=0', 'd(2,10)=10',
        ]);
        assert.equal(magic.lamplit, false);

        magic = freshLampState(lampObject(
            MAGIC_LAMP, { age: 40, cursed: true },
        ), 4n);
        await applyInventoryA();
        assert.equal(game._pending_message,
            'The magic lamp flickers for a moment, then dies.');
        assert.deepEqual(getRngLog(), ['rn2(2)=0', 'rn2(3)=1']);
        assert.equal(magic.lamplit, false);

        lamp = freshLampState(lampObject(
            OIL_LAMP, { cursed: true },
        ), 1n);
        await applyInventoryA();
        assert.equal(game._pending_message, 'Your lamp is now on.');
        assert.deepEqual(getRngLog(), ['rn2(2)=1']);
        assert.equal(lamp.lamplit, true);
    });

test('unpaid timed and magic lamps charge source-order usage fees',
    async () => {
        const lamp = freshLampState(lampObject(
            OIL_LAMP, { unpaid: true },
        ), 1n);
        const shopkeeper = installLightingShop(lamp);

        await applyInventoryA();
        assert.match(game._pending_message, /Usage fee, 10 zorkmids\./);
        assert.match(game._pending_message, /Your lamp is now on\.$/);
        assert.equal(shopkeeper.eshk.debit, 10);
        assert.equal(lamp.lamplit, true);
        assert.deepEqual(getRngLog().map(call => call.replace(/=.*/, '')), [
            'rn2(3)', 'rn2(3)', 'rn2(19)',
        ]);

        const magic = freshLampState(lampObject(
            MAGIC_LAMP, { age: 40, unpaid: true },
        ), 1n);
        const magicShopkeeper = installLightingShop(magic);
        await applyInventoryA();
        assert.match(game._pending_message, /Usage fee, 10 zorkmids\./);
        assert.match(game._pending_message, /Your lamp is now on\.$/);
        assert.equal(magicShopkeeper.eshk.debit, 10);
        assert.equal(magic.lamplit, true);
        assert.deepEqual(objectTimers(magic), []);
        assert.deepEqual(getRngLog().map(call => call.replace(/=.*/, '')), [
            'rn2(3)', 'rn2(3)', 'rn2(19)',
        ]);

        const deafMagic = freshLampState(lampObject(
            MAGIC_LAMP, { age: 40, unpaid: true },
        ), 1n);
        game.u.deafTurns = 5;
        const deafShopkeeper = installLightingShop(deafMagic);
        await applyInventoryA();
        assert.equal(game._pending_message, 'Your lamp is now on.');
        assert.equal(deafShopkeeper.eshk.debit, 10);
        assert.equal(deafMagic.lamplit, true);
        assert.deepEqual(getRngLog().map(call => call.replace(/=.*/, '')), [
            'rn2(3)', 'rn2(3)',
        ]);
    });
