import assert from 'node:assert/strict';
import test from 'node:test';
import { wearHeroAccessory } from '../js/accessory.js';
import { moveloop_core } from '../js/allmain.js';
import { findArmorClass } from '../js/armor.js';
import { bot, flush_screen } from '../js/display.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { cancelObjectMagic } from '../js/object_cancellation.js';
import { OBJECT_NAMES } from '../js/object_data.js';
import { drainObjectEnchantment } from '../js/object_state.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';

void test('cancelling a worn strength ring displays the lost bonus', async () => {
    freshObjectRoom();
    const ring = await addInventoryObject(OBJECT_NAMES.indexOf('gain strength'), { spe: 2 });
    await wearHeroAccessory(ring, 'uleft');
    await bot();

    await cancelObjectMagic(ring);
    await flush_screen(1);

    assert.match(requireScreenRow(22).map(cell => cell.ch).join(''), /St:12\b/);
});

void test('draining a worn strength ring immediately displays one lost point', async () => {
    freshObjectRoom();
    const ring = await addInventoryObject(OBJECT_NAMES.indexOf('gain strength'), { spe: 2 });
    await wearHeroAccessory(ring, 'uleft');
    await bot();

    assert.equal(await drainObjectEnchantment(ring, { random: () => 99 }), true);

    assert.match(requireScreenRow(22).map(cell => cell.ch).join(''), /St:13\b/);
});

for (const hand of ['uleft', 'uright'] as const) {
    void test(`draining a protection ring on the ${hand === 'uleft' ? 'left' : 'right'} hand updates AC before the next command`, async () => {
        freshObjectRoom();
        game._moveloopStarted = true;
        game.u.umovement = 12;
        const ring = await addInventoryObject(OBJECT_NAMES.indexOf('protection'), { spe: 3 });
        await wearHeroAccessory(ring, hand);
        findArmorClass();
        await bot();
        resetInputState().feed('\x1b');

        assert.equal(await drainObjectEnchantment(ring, { random: () => 99 }), true);
        assert.equal(ring.spe, 2);
        assert.equal(game.u.uac, 7);
        assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /AC:7\b/);
        await moveloop_core();
        await flush_screen(1);

        assert.equal(game.u.uac, 8);
        assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /AC:8\b/);
    });
}
