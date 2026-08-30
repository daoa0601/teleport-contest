import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { W_QUIVER, W_SWAPWEP, W_WEP } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKey } from '../js/input.js';
import { CLUB, DART, FLINT, ROCK, SLING } from '../js/object_data.js';
import {
    freshWeaponArena, inventoryObject,
} from './support/weapon-arena.js';


test('fireassist prefers a known-safe launcher over unknown and known-cursed matches',
    async () => {
        const level = freshWeaponArena();
        const club = inventoryObject(CLUB, 'a', {
            wielded: true, owornmask: W_WEP,
        });
        const unknown = inventoryObject(SLING, 'b', { bknown: false });
        const knownCursed = inventoryObject(SLING, 'c', { cursed: true });
        const knownSafe = inventoryObject(SLING, 'd');
        const flint = inventoryObject(FLINT, 'e', {
            ready: true, owornmask: W_QUIVER,
        });
        game.inventory = [club, unknown, knownCursed, knownSafe, flint];
        game.uwep = club;
        game.uquiver = flint;

        await rhack('f'.charCodeAt(0));
        await rhack(0);
        pushKey('l');
        await rhack(0);

        assert.equal(game.uwep, knownSafe);
        assert.equal(game.uswapwep, club);
        assert.equal(game.inventory.includes(flint), false);
        assert.ok(
            (level.objects || []).some(column =>
                (column || []).some(pile =>
                    (pile || []).some(object => object === flint))),
            'the selected launcher must fire and settle the readied identity',
        );
    });

test('swapping a sole primary makes it the alternate and leaves bare hands',
    async () => {
        freshWeaponArena();
        const club = inventoryObject(CLUB, 'a', {
            wielded: true, owornmask: W_WEP,
        });
        game.inventory = [club];
        game.uwep = club;

        pushKey(' ');
        await rhack('x'.charCodeAt(0));

        assert.equal(game.uwep, null);
        assert.equal(game.uswapwep, club);
        assert.equal(club.wielded, false);
        assert.equal(club.alternate, true);
        assert.equal(game.context.move, 1);
    });

test('autoquiver prefers current-launcher ammo and fires it immediately',
    async () => {
        freshWeaponArena();
        game.flags.autoquiver = true;
        const sling = inventoryObject(SLING, 'a', {
            wielded: true, owornmask: W_WEP,
        });
        const darts = inventoryObject(DART, 'b', {
            quan: 3, quantity: 3,
        });
        const rocks = inventoryObject(ROCK, 'c', {
            quan: 3, quantity: 3,
        });
        const flint = inventoryObject(FLINT, 'd', {
            quan: 3, quantity: 3, typeKnown: true,
        });
        game.inventory = [sling, darts, rocks, flint];
        game.uwep = sling;
        game._knownObjectTypes = new Set([FLINT]);
        game._commandCount = 1;

        // The trailing keys let the pre-fix manual picker terminate.  The
        // source autoquiver path consumes only the direction and leaves them
        // irrelevant to this completed command.
        pushKey('l');
        pushKey(' ');
        pushKey(27);
        await rhack('f'.charCodeAt(0));

        assert.equal(game.uquiver, flint);
        assert.equal(flint.quantity, 2);
        assert.equal(darts.quantity, 3);
        assert.equal(rocks.quantity, 3);
        assert.equal(game.uwep, sling);
    });

test('manual empty-quiver fire keeps the surviving selected stack readied',
    async () => {
        freshWeaponArena();
        game.flags.autoquiver = false;
        game.flags.fireassist = false;
        const club = inventoryObject(CLUB, 'a', {
            wielded: true, owornmask: W_WEP,
        });
        const darts = inventoryObject(DART, 'b', {
            quan: 3, quantity: 3,
        });
        game.inventory = [club, darts];
        game.uwep = club;

        pushKey('b');
        pushKey('l');
        await rhack('f'.charCodeAt(0));

        assert.equal(game.uquiver, darts);
        assert.equal(darts.ready, true);
        assert.equal(darts.quantity, 2);
        assert.equal(game.uwep, club);
    });

test('autoquiver excludes hidden and artifact objects and ranks missiles over alternate ammo',
    async () => {
        freshWeaponArena();
        game.flags.autoquiver = true;
        game.flags.fireassist = false;
        const club = inventoryObject(CLUB, 'a', {
            wielded: true, owornmask: W_WEP,
        });
        const sling = inventoryObject(SLING, 'b', {
            alternate: true, owornmask: W_SWAPWEP,
        });
        const flint = inventoryObject(FLINT, 'c', {
            quan: 3, quantity: 3, typeKnown: true,
        });
        const darts = inventoryObject(DART, 'd', {
            quan: 3, quantity: 3,
        });
        const hiddenDarts = inventoryObject(DART, 'e', {
            quan: 3, quantity: 3, dknown: false,
        });
        const artifactDarts = inventoryObject(DART, 'f', {
            quan: 3, quantity: 3, oartifact: 1,
        });
        game.inventory = [
            club, sling, flint, darts, hiddenDarts, artifactDarts,
        ];
        game.uwep = club;
        game.uswapwep = sling;
        game._knownObjectTypes = new Set([FLINT]);

        pushKey('l');
        await rhack('f'.charCodeAt(0));

        assert.equal(game.uquiver, darts);
        assert.equal(darts.quantity, 2);
        assert.equal(flint.quantity, 3);
        assert.equal(hiddenDarts.quantity, 3);
        assert.equal(artifactDarts.quantity, 3);
        assert.equal(game.uwep, club);
        assert.equal(game.uswapwep, sling);
    });

test('manual fire splits all but one wielded projectile into a new quiver identity',
    async () => {
        freshWeaponArena();
        game.flags.autoquiver = false;
        game.flags.fireassist = false;
        const darts = inventoryObject(DART, 'a', {
            o_id: 28110,
            quan: 3, quantity: 3,
            wielded: true, owornmask: W_WEP,
        });
        game.inventory = [darts];
        game.uwep = darts;

        pushKey('a');
        pushKey('y');
        pushKey('l');
        await rhack('f'.charCodeAt(0));

        const quivered = game.uquiver;
        assert.equal(game.uwep, darts);
        assert.equal(darts.quantity, 1);
        assert.ok(quivered);
        assert.notEqual(quivered, darts);
        assert.notEqual(quivered.o_id, darts.o_id);
        assert.equal(quivered.quantity, 1);
        assert.equal(quivered.ready, true);
        assert.equal(game.inventory.length, 2);
    });

test('moving the whole primary stack to the quiver spends time even when fire is cancelled',
    async () => {
        freshWeaponArena();
        game.flags.autoquiver = false;
        game.flags.fireassist = false;
        const darts = inventoryObject(DART, 'a', {
            o_id: 28111,
            quan: 3, quantity: 3,
            wielded: true, owornmask: W_WEP,
        });
        game.inventory = [darts];
        game.uwep = darts;

        pushKey('a');
        pushKey('n');
        pushKey('y');
        pushKey(27);
        await rhack('f'.charCodeAt(0));

        assert.equal(game.uwep, null);
        assert.equal(game.uquiver, darts);
        assert.equal(darts.quantity, 3);
        assert.equal(darts.wielded, false);
        assert.equal(darts.ready, true);
        assert.equal(game.context.move, 1);
    });

test('manual fire splits an alternate stack without replacing its parent slot',
    async () => {
        freshWeaponArena();
        game.flags.autoquiver = false;
        game.flags.fireassist = false;
        const club = inventoryObject(CLUB, 'a', {
            wielded: true, owornmask: W_WEP,
        });
        const darts = inventoryObject(DART, 'b', {
            o_id: 28112,
            quan: 3, quantity: 3,
            alternate: true, owornmask: W_SWAPWEP,
        });
        game.inventory = [club, darts];
        game.uwep = club;
        game.uswapwep = darts;

        pushKey('b');
        pushKey('y');
        pushKey('l');
        await rhack('f'.charCodeAt(0));

        const quivered = game.uquiver;
        assert.equal(game.uwep, club);
        assert.equal(game.uswapwep, darts);
        assert.equal(darts.quantity, 1);
        assert.ok(quivered);
        assert.notEqual(quivered, darts);
        assert.notEqual(quivered.o_id, darts.o_id);
        assert.equal(quivered.quantity, 1);
        assert.equal(quivered.ready, true);
        assert.equal(game.inventory.length, 3);
    });

test('moving the whole offhand stack ends two-weapon mode and preserves cancellation time',
    async () => {
        freshWeaponArena();
        game.flags.autoquiver = false;
        game.flags.fireassist = false;
        const club = inventoryObject(CLUB, 'a', {
            wielded: true, owornmask: W_WEP,
        });
        const darts = inventoryObject(DART, 'b', {
            o_id: 28113,
            quan: 3, quantity: 3,
            alternate: true, owornmask: W_SWAPWEP,
        });
        game.inventory = [club, darts];
        game.uwep = club;
        game.uswapwep = darts;
        game.u.twoweap = true;

        pushKey('b');
        pushKey('n');
        pushKey('y');
        pushKey(27);
        await rhack('f'.charCodeAt(0));

        assert.equal(game.uwep, club);
        assert.equal(game.uswapwep, null);
        assert.equal(game.uquiver, darts);
        assert.equal(game.u.twoweap, false);
        assert.equal(darts.quantity, 3);
        assert.equal(darts.alternate, false);
        assert.equal(darts.ready, true);
        assert.equal(game.context.move, 1);
    });

test('moving an unused alternate stack remains zero-time when the later fire is cancelled',
    async () => {
        freshWeaponArena();
        game.flags.autoquiver = false;
        game.flags.fireassist = false;
        const club = inventoryObject(CLUB, 'a', {
            wielded: true, owornmask: W_WEP,
        });
        const darts = inventoryObject(DART, 'b', {
            o_id: 28114,
            quan: 3, quantity: 3,
            alternate: true, owornmask: W_SWAPWEP,
        });
        game.inventory = [club, darts];
        game.uwep = club;
        game.uswapwep = darts;
        game.u.twoweap = false;

        pushKey('b');
        pushKey('n');
        pushKey('y');
        pushKey(27);
        await rhack('f'.charCodeAt(0));

        assert.equal(game.uwep, club);
        assert.equal(game.uswapwep, null);
        assert.equal(game.uquiver, darts);
        assert.equal(darts.quantity, 3);
        assert.equal(darts.ready, true);
        assert.equal(game.context.move, 0);
    });
