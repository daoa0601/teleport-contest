// C ref: do_wear.c armor_or_accessory_off().  A ring's off_msg() runs
// before Ring_off() removes it, so the report names the hand it occupied;
// the amulet's Amulet_off() clears the slot first, so its report carries
// no "(being worn)" suffix.

import test from 'node:test';
import assert from 'node:assert/strict';

import { wearHeroAccessory } from '../js/accessory.js';
import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import {
    AMULET_OF_LIFE_SAVING, OBJECT_NAMES, RIN_LEVITATION, RIN_PROTECTION,
} from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

const RIN_WARNING = OBJECT_NAMES.indexOf('warning');

void test('removing a ring reports the hand it occupied while still worn', async () => {
    for (const [slot, hand, type] of [
        ['uright', 'right', RIN_PROTECTION],
        ['uleft', 'left', RIN_WARNING],
    ] as const) {
        freshObjectRoom();
        requirePlayingGame(game);
        const ring = await addInventoryObject(type, {
            invlet: 'b', dknown: true, bknown: true,
        });
        await wearHeroAccessory(ring, slot);
        const input = resetInputState();
        input.feed(' ');

        await rhack('R'.charCodeAt(0));

        assert.equal(game[slot], null, `${slot} must be vacated by the removal`);
        assert.match(String(game._lastPlineMessage ?? ''), new RegExp(`\\(on ${hand} hand\\)\\.$`));
    }
});

void test('removing an amulet reports it without a wearing suffix', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const amulet = await addInventoryObject(AMULET_OF_LIFE_SAVING, {
        invlet: 'b', dknown: true, bknown: true,
    });
    await wearHeroAccessory(amulet, 'uamul');
    const input = resetInputState();
    input.feed(' ');

    await rhack('R'.charCodeAt(0));

    assert.equal(game.uamul, null);
    assert.match(String(game._lastPlineMessage ?? ''), /You were wearing an uncursed amulet of life saving\.$/);
    assert.doesNotMatch(String(game._lastPlineMessage ?? ''), /being worn/);
});

void test('a ring of levitation reports its hand before the landing', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const ring = await addInventoryObject(RIN_LEVITATION, {
        invlet: 'b', dknown: true, bknown: true,
    });
    await wearHeroAccessory(ring, 'uright');
    assert.equal(game.u.levitating, true);
    const input = resetInputState();
    input.feed(' ');

    await rhack('R'.charCodeAt(0));

    assert.equal(game.uright, null);
    // The report is printed while the ring is still worn, so Ring_off()'s
    // landing prose replaces it on the topline instead of the reverse.
    assert.doesNotMatch(String(game._lastPlineMessage ?? ''), /were wearing/);
    assert.match(String(game._lastPlineMessage ?? ''), /^You float gently to the \w+\.$/);
});
