import assert from 'node:assert/strict';
import test from 'node:test';

import { flush_screen } from '../js/display.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { placeHeroOnLevel } from '../js/hero_location.js';
import { LARGE_BOX } from '../js/object_data.js';
import { autopickupAtHero } from '../js/pickup.js';
import { vision_recalc } from '../js/vision.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

function statusRow(): string {
    return requireGameDisplay(game).grid[23]?.map(cell => cell.ch).join('') ?? '';
}

// C pickup.c pickup() never calls bot(), and lifting a non-gold object does
// not mark the status line dirty: the new load appears only once
// encumber_msg() later reports it.
void test('autopickup that burdens the hero leaves the old capacity on the status line', async () => {
    freshObjectRoom({ heroX: 10, heroY: 10, flags: { pickup: true, pickup_types: '' } });
    await addInventoryObject(LARGE_BOX);
    await floorObject(LARGE_BOX, 11, 10);
    await flush_screen(1);
    await placeHeroOnLevel(11, 10);
    vision_recalc(1);

    await autopickupAtHero();
    await flush_screen(1);

    assert.equal(game.inventory.length, 2);
    assert.match(game._pending_message ?? '', /little trouble lifting .*large box/);
    assert.doesNotMatch(statusRow(), /Burdened/);
});
