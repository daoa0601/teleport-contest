import test from 'node:test';
import assert from 'node:assert/strict';

import { getBridgeUsageLedger } from '../js/bridge_policy.js';
import { rhack } from '../js/cmd.js';
import { W_ARMOR, W_QUIVER, W_WEP } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKey } from '../js/input.js';
import { CLUB, DART, LOADSTONE } from '../js/object_data.js';
import {
    freshWeaponArena, inventoryObject,
} from './support/weapon-arena.js';

process.env.TELEPORT_BRIDGE_FREE = '1';
process.env.TELEPORT_DISABLE_FIXTURES = '1';

test('explicit empty selection clears the live quiver without spending time',
    async () => {
        freshWeaponArena();
        const darts = inventoryObject(DART, 'a', {
            quan: 3, quantity: 3, ready: true, owornmask: W_QUIVER,
        });
        game.inventory = [darts];
        game.uquiver = darts;

        pushKey('-');
        await rhack('Q'.charCodeAt(0));

        assert.equal(game.uquiver, null);
        assert.equal(darts.ready, false);
        assert.equal(game.context.move, 0);
    });

test('quiver selection rejects an armor-mask identity before slot mutation',
    async () => {
        freshWeaponArena();
        const wornClub = inventoryObject(CLUB, 'a', {
            worn: false, owornmask: W_ARMOR,
        });
        game.inventory = [wornClub];

        pushKey('a');
        await rhack('Q'.charCodeAt(0));

        assert.equal(game.uquiver, null);
        assert.equal(wornClub.owornmask, W_ARMOR);
        assert.equal(game.context.move, 0);
    });

test('discovering that the primary is welded preserves its slot and spends time',
    async () => {
        freshWeaponArena();
        const club = inventoryObject(CLUB, 'a', {
            cursed: true, bknown: false, wielded: true, owornmask: W_WEP,
        });
        game.inventory = [club];
        game.uwep = club;

        pushKey('a');
        await rhack('Q'.charCodeAt(0));

        assert.equal(game.uwep, club);
        assert.equal(game.uquiver, null);
        assert.equal(club.bknown, true);
        assert.equal(game.context.move, 1);
    });

test('a known welded primary refuses the same transition without another turn',
    async () => {
        freshWeaponArena();
        const club = inventoryObject(CLUB, 'a', {
            cursed: true, bknown: true, wielded: true, owornmask: W_WEP,
        });
        game.inventory = [club];
        game.uwep = club;

        pushKey('a');
        await rhack('Q'.charCodeAt(0));

        assert.equal(game.uwep, club);
        assert.equal(game.uquiver, null);
        assert.equal(club.bknown, true);
        assert.equal(game.context.move, 0);
    });

test('a counted primary selection readies that many as a distinct identity',
    async () => {
        freshWeaponArena();
        const darts = inventoryObject(DART, 'a', {
            o_id: 28200,
            quan: 4, quantity: 4, wielded: true, owornmask: W_WEP,
        });
        game.inventory = [darts];
        game.uwep = darts;

        pushKey('2');
        pushKey('a');
        await rhack('Q'.charCodeAt(0));

        assert.equal(game.uwep, darts);
        assert.equal(darts.quantity, 2);
        assert.ok(game.uquiver);
        assert.notEqual(game.uquiver, darts);
        assert.notEqual(game.uquiver.o_id, darts.o_id);
        assert.equal(game.uquiver.quantity, 2);
        assert.equal(game.context.move, 0);
    });

test('an excessive count keeps the picker alive until a valid split is selected',
    async () => {
        freshWeaponArena();
        const darts = inventoryObject(DART, 'a', {
            o_id: 28202,
            quan: 4, quantity: 4, wielded: true, owornmask: W_WEP,
        });
        game.inventory = [darts];
        game.uwep = darts;

        pushKey('5');
        pushKey('a');
        pushKey('2');
        pushKey('a');
        await rhack('Q'.charCodeAt(0));

        assert.equal(game.uwep, darts);
        assert.equal(darts.quantity, 2);
        assert.ok(game.uquiver);
        assert.notEqual(game.uquiver, darts);
        assert.equal(game.uquiver.quantity, 2);
        assert.equal(game.context.move, 0);
    });

test('a cursed loadstone cannot split and moves only after ready-all confirmation',
    async () => {
        freshWeaponArena();
        const loadstones = inventoryObject(LOADSTONE, 'a', {
            o_id: 28203,
            quan: 3, quantity: 3, cursed: true,
            wielded: true, owornmask: W_WEP,
        });
        game.inventory = [loadstones];
        game.uwep = loadstones;

        pushKey('a');
        pushKey('y');
        await rhack('Q'.charCodeAt(0));

        assert.equal(game.inventory.length, 1);
        assert.equal(game.uwep, null);
        assert.equal(game.uquiver, loadstones);
        assert.equal(loadstones.quantity, 3);
        assert.equal(game.context.move, 1);
    });

test('declining a single primary transition preserves both weapon and empty quiver',
    async () => {
        freshWeaponArena();
        const club = inventoryObject(CLUB, 'a', {
            wielded: true, owornmask: W_WEP,
        });
        game.inventory = [club];
        game.uwep = club;

        pushKey('a');
        pushKey('n');
        await rhack('Q'.charCodeAt(0));

        assert.equal(game.uwep, club);
        assert.equal(game.uquiver, null);
        assert.equal(game.context.move, 0);
    });

test('a full alphabetic inventory suppresses implicit splitting and can ready all',
    async () => {
        freshWeaponArena();
        const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const darts = inventoryObject(DART, letters[0], {
            o_id: 28201,
            quan: 3, quantity: 3, wielded: true, owornmask: W_WEP,
        });
        const fillers = Array.from(letters.slice(1), letter =>
            inventoryObject(CLUB, letter));
        game.inventory = [darts, ...fillers];
        game.uwep = darts;

        pushKey('a');
        pushKey('y');
        await rhack('Q'.charCodeAt(0));

        assert.equal(game.inventory.length, 52);
        assert.equal(game.uwep, null);
        assert.equal(game.uquiver, darts);
        assert.equal(darts.quantity, 3);
        assert.equal(game.context.move, 1);
        assert.deepEqual(getBridgeUsageLedger(), {
            bridgeFree: true,
            totalHits: 0,
            forbiddenHits: 0,
            bridges: {},
        });
    });
