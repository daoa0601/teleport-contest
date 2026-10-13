import { requireScreenRow } from './support/screen.js';
import { requirePlayingGame, requireGameDisplay } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { W_QUIVER, W_SWAPWEP, W_WEP } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKey, resetInputState } from '../js/input.js';
import { CLUB, DART, FLINT, ROCK, SLING } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshGameplayRoom } from './support/playable-room.js';


// Native dofire() reports the empty quiver before getobj() asks for a stack.
async function fireFromEmptyQuiver(answers: string) {
    const input = resetInputState();
    const action = rhack('f'.charCodeAt(0));
    const blocked = () => Promise.race([
        action.then(() => false), input.waitUntilBlocked().then(() => true),
    ]);
    assert.equal(await blocked(), true, 'empty-quiver fire must pause before selection');
    assert.equal(game._pending_message, 'You have no ammunition readied.');
    const row = requireScreenRow(0);
    assert.ok(row);
    const topline = row.map(cell => cell.ch).join('');
    assert.match(topline, /--More--/);
    assert.equal(game.uquiver, null);

    input.feed(' ');
    assert.equal(await blocked(), true, 'acknowledgment must open the fire picker');
    assert.match(game._pending_message, /^What do you want to fire\?/);
    input.feed(answers);
    await action;
}

void test('fireassist prefers a known-safe launcher over unknown and known-cursed matches',
    async () => {
        const level = freshGameplayRoom();
        requirePlayingGame(game);
        const club = await addInventoryObject(CLUB, {
            invlet: 'a',
            wielded: true, owornmask: W_WEP,
        });
        const unknown = await addInventoryObject(SLING, {
            invlet: 'b', bknown: false,
        });
        const knownCursed = await addInventoryObject(SLING, {
            invlet: 'c', cursed: true,
        });
        const knownSafe = await addInventoryObject(SLING, { invlet: 'd' });
        const flint = await addInventoryObject(FLINT, {
            invlet: 'e',
            ready: true, owornmask: W_QUIVER,
        });
        game.uwep = club;
        game.uquiver = flint;

        await rhack('f'.charCodeAt(0));
        await rhack(0);
        pushKey(' '); // Acknowledge the launcher change before choosing the shot direction.
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

void test('swapping a sole primary makes it the alternate and leaves bare hands',
    async () => {
        freshGameplayRoom();
        requirePlayingGame(game);
        const club = await addInventoryObject(CLUB, {
            invlet: 'a',
            wielded: true, owornmask: W_WEP,
        });
        game.uwep = club;

        pushKey(' ');
        await rhack('x'.charCodeAt(0));

        assert.equal(game.uwep, null);
        assert.equal(game.uswapwep, club);
        assert.equal(club.wielded, false);
        assert.equal(club.alternate, true);
        assert.equal(game.context.move, 1);
    });

void test('autoquiver prefers current-launcher ammo and fires it immediately',
    async () => {
        freshGameplayRoom();
        requirePlayingGame(game);
        game.flags.autoquiver = true;
        const sling = await addInventoryObject(SLING, {
            invlet: 'a',
            wielded: true, owornmask: W_WEP,
        });
        const darts = await addInventoryObject(DART, {
            invlet: 'b',
            quan: 3, quantity: 3,
        });
        const rocks = await addInventoryObject(ROCK, {
            invlet: 'c',
            quan: 3, quantity: 3,
        });
        const flint = await addInventoryObject(FLINT, {
            invlet: 'd',
            quan: 3, quantity: 3, typeKnown: true,
        });
        game.uwep = sling;
        game._knownObjectTypes = new Set([FLINT]);
        game._commandCount = 1;

        // Acknowledge autoquiver's readiness message before the direction.
        pushKey(' ');
        pushKey('l');
        await rhack('f'.charCodeAt(0));

        assert.equal(game.uquiver, flint);
        assert.equal(flint.quantity, 2);
        assert.equal(darts.quantity, 3);
        assert.equal(rocks.quantity, 3);
        assert.equal(game.uwep, sling);
    });

void test('manual empty-quiver fire keeps the surviving selected stack readied',
    async () => {
        freshGameplayRoom();
        requirePlayingGame(game);
        game.flags.autoquiver = false;
        game.flags.fireassist = false;
        const club = await addInventoryObject(CLUB, {
            invlet: 'a',
            wielded: true, owornmask: W_WEP,
        });
        const darts = await addInventoryObject(DART, {
            invlet: 'b',
            quan: 3, quantity: 3,
        });
        game.uwep = club;

        await fireFromEmptyQuiver('b l');

        assert.equal(game.uquiver, darts);
        assert.equal(darts.ready, true);
        assert.equal(darts.quantity, 2);
        assert.equal(game.uwep, club);
    });

void test('autoquiver excludes hidden and artifact objects and ranks missiles over alternate ammo',
    async () => {
        freshGameplayRoom();
        requirePlayingGame(game);
        game.flags.autoquiver = true;
        game.flags.fireassist = false;
        const club = await addInventoryObject(CLUB, {
            invlet: 'a',
            wielded: true, owornmask: W_WEP,
        });
        const sling = await addInventoryObject(SLING, {
            invlet: 'b',
            alternate: true, owornmask: W_SWAPWEP,
        });
        const flint = await addInventoryObject(FLINT, {
            invlet: 'c',
            quan: 3, quantity: 3, typeKnown: true,
        });
        const darts = await addInventoryObject(DART, {
            invlet: 'd',
            quan: 3, quantity: 3,
        });
        const hiddenDarts = await addInventoryObject(DART, {
            invlet: 'e', quan: 3, quantity: 3,
            dknown: false, observed: false,
        });
        const artifactDarts = await addInventoryObject(DART, {
            invlet: 'f',
            quan: 3, quantity: 3, oartifact: 1,
        });
        game.uwep = club;
        game.uswapwep = sling;
        game._knownObjectTypes = new Set([FLINT]);

        pushKey(' ');
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

void test('manual fire splits all but one wielded projectile into a new quiver identity',
    async () => {
        freshGameplayRoom();
        requirePlayingGame(game);
        game.flags.autoquiver = false;
        game.flags.fireassist = false;
        const darts = await addInventoryObject(DART, {
            invlet: 'a',
            o_id: 28110,
            quan: 3, quantity: 3,
            wielded: true, owornmask: W_WEP,
        });
        game.uwep = darts;

        await fireFromEmptyQuiver('ay l');

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

void test('moving the whole primary stack to the quiver spends time even when fire is cancelled',
    async () => {
        freshGameplayRoom();
        requirePlayingGame(game);
        game.flags.autoquiver = false;
        game.flags.fireassist = false;
        const darts = await addInventoryObject(DART, {
            invlet: 'a',
            o_id: 28111,
            quan: 3, quantity: 3,
            wielded: true, owornmask: W_WEP,
        });
        game.uwep = darts;

        await fireFromEmptyQuiver('any \u001b');

        assert.equal(game.uwep, null);
        assert.equal(game.uquiver, darts);
        assert.equal(darts.quantity, 3);
        assert.equal(darts.wielded, false);
        assert.equal(darts.ready, true);
        assert.equal(game.context.move, 1);
    });

void test('manual fire splits an alternate stack without replacing its parent slot',
    async () => {
        freshGameplayRoom();
        requirePlayingGame(game);
        game.flags.autoquiver = false;
        game.flags.fireassist = false;
        const club = await addInventoryObject(CLUB, {
            invlet: 'a',
            wielded: true, owornmask: W_WEP,
        });
        const darts = await addInventoryObject(DART, {
            invlet: 'b',
            o_id: 28112,
            quan: 3, quantity: 3,
            alternate: true, owornmask: W_SWAPWEP,
        });
        game.uwep = club;
        game.uswapwep = darts;

        await fireFromEmptyQuiver('by l');

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

void test('moving the whole offhand stack ends two-weapon mode and preserves cancellation time',
    async () => {
        freshGameplayRoom();
        requirePlayingGame(game);
        game.flags.autoquiver = false;
        game.flags.fireassist = false;
        const club = await addInventoryObject(CLUB, {
            invlet: 'a',
            wielded: true, owornmask: W_WEP,
        });
        const darts = await addInventoryObject(DART, {
            invlet: 'b',
            o_id: 28113,
            quan: 3, quantity: 3,
            alternate: true, owornmask: W_SWAPWEP,
        });
        game.uwep = club;
        game.uswapwep = darts;
        game.u.twoweap = true;

        // Readiness and leaving two-weapon mode each precede the direction.
        await fireFromEmptyQuiver('bny  \u001b');

        assert.equal(game.uwep, club);
        assert.equal(game.uswapwep, null);
        assert.equal(game.uquiver, darts);
        assert.equal(game.u.twoweap, false);
        assert.equal(darts.quantity, 3);
        assert.equal(darts.alternate, false);
        assert.equal(darts.ready, true);
        assert.equal(game.context.move, 1);
    });

void test('moving an unused alternate stack remains zero-time when the later fire is cancelled',
    async () => {
        freshGameplayRoom();
        requirePlayingGame(game);
        game.flags.autoquiver = false;
        game.flags.fireassist = false;
        const club = await addInventoryObject(CLUB, {
            invlet: 'a',
            wielded: true, owornmask: W_WEP,
        });
        const darts = await addInventoryObject(DART, {
            invlet: 'b',
            o_id: 28114,
            quan: 3, quantity: 3,
            alternate: true, owornmask: W_SWAPWEP,
        });
        game.uwep = club;
        game.uswapwep = darts;
        game.u.twoweap = false;

        await fireFromEmptyQuiver('bny \u001b');

        assert.equal(game.uwep, club);
        assert.equal(game.uswapwep, null);
        assert.equal(game.uquiver, darts);
        assert.equal(darts.quantity, 3);
        assert.equal(darts.ready, true);
        assert.equal(game.context.move, 0);
    });
