import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { W_ARMOR, W_QUIVER, W_WEP } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKey } from '../js/input.js';
import { CLUB, DART, LOADSTONE } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshGameplayRoom } from './support/playable-room.js';


test('explicit empty selection clears the live quiver without spending time',
    async () => {
        freshGameplayRoom();
        const darts = addInventoryObject(DART, {
            invlet: 'a',
            quan: 3, quantity: 3, ready: true, owornmask: W_QUIVER,
        });
        game.uquiver = darts;

        pushKey('-');
        await rhack('Q'.charCodeAt(0));

        assert.equal(game.uquiver, null);
        assert.equal(darts.ready, false);
        assert.equal(game.context.move, 0);
    });

test('quiver selection rejects an armor-mask identity before slot mutation',
    async () => {
        freshGameplayRoom();
        const wornClub = addInventoryObject(CLUB, {
            invlet: 'a',
            worn: false, owornmask: W_ARMOR,
        });

        pushKey('a');
        await rhack('Q'.charCodeAt(0));

        assert.equal(game.uquiver, null);
        assert.equal(wornClub.owornmask, W_ARMOR);
        assert.equal(game.context.move, 0);
    });

test('discovering that the primary is welded preserves its slot and spends time',
    async () => {
        freshGameplayRoom();
        const club = addInventoryObject(CLUB, {
            invlet: 'a',
            cursed: true, bknown: false, wielded: true, owornmask: W_WEP,
        });
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
        freshGameplayRoom();
        const club = addInventoryObject(CLUB, {
            invlet: 'a',
            cursed: true, bknown: true, wielded: true, owornmask: W_WEP,
        });
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
        freshGameplayRoom();
        const darts = addInventoryObject(DART, {
            invlet: 'a',
            o_id: 28200,
            quan: 4, quantity: 4, wielded: true, owornmask: W_WEP,
        });
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
        freshGameplayRoom();
        const darts = addInventoryObject(DART, {
            invlet: 'a',
            o_id: 28202,
            quan: 4, quantity: 4, wielded: true, owornmask: W_WEP,
        });
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
        freshGameplayRoom();
        const loadstones = addInventoryObject(LOADSTONE, {
            invlet: 'a',
            o_id: 28203,
            quan: 3, quantity: 3, cursed: true,
            wielded: true, owornmask: W_WEP,
        });
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
        freshGameplayRoom();
        const club = addInventoryObject(CLUB, {
            invlet: 'a',
            wielded: true, owornmask: W_WEP,
        });
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
        freshGameplayRoom();
        const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const darts = addInventoryObject(DART, {
            invlet: letters[0],
            o_id: 28201,
            quan: 3, quantity: 3, wielded: true, owornmask: W_WEP,
        });
        for (const letter of letters.slice(1))
            addInventoryObject(CLUB, { invlet: letter });
        game.uwep = darts;

        pushKey('a');
        pushKey('y');
        await rhack('Q'.charCodeAt(0));

        assert.equal(game.inventory.length, 52);
        assert.equal(game.uwep, null);
        assert.equal(game.uquiver, darts);
        assert.equal(darts.quantity, 3);
        assert.equal(game.context.move, 1);
    });
