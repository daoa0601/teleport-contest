import assert from 'node:assert/strict';
import test from 'node:test';
import { flush_screen } from '../js/display.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { placeHeroOnLevel } from '../js/hero_location.js';
import { LARGE_BOX, ROCK } from '../js/object_data.js';
import { autopickupAtHero } from '../js/pickup.js';
import { startRun } from '../js/runmode.js';
import { vision_recalc } from '../js/vision.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
function topRow() {
    return requireGameDisplay(game).grid[0]?.map(cell => cell.ch).join('') ?? '';
}
function statusRow() {
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
// C pickup.c lift_object() calls clear_nhwindow(WIN_MESSAGE) after its ynq()
// burden question, so a declined lift leaves no question on the top line.
void test('declining a burdensome lift clears the question from the top line', async () => {
    freshObjectRoom({ heroX: 10, heroY: 10, flags: { pickup: true, pickup_types: '', pickup_burden: 'u' } });
    await addInventoryObject(ROCK, { quan: 40 });
    await floorObject(LARGE_BOX, 11, 10);
    await floorObject(LARGE_BOX, 11, 10);
    await flush_screen(1);
    await placeHeroOnLevel(11, 10);
    vision_recalc(1);
    const input = resetInputState();
    let rowBeneathPile = '';
    input.beforeRead = () => {
        if (/Things that are here/.test(topRow()))
            rowBeneathPile = topRow();
    };
    input.feed('q ');
    await autopickupAtHero();
    assert.equal(game.inventory.some(object => object.otyp === LARGE_BOX), false);
    assert.match(rowBeneathPile, /^\s+Things that are here:/);
});
void test('interrupting a run refreshes the new load while the lifting message is shown', async () => {
    freshObjectRoom({ flags: { pickup: true, pickup_types: '' } });
    await addInventoryObject(LARGE_BOX);
    await floorObject(LARGE_BOX, 10, 10);
    await flush_screen(1);
    startRun(1, 0);
    await autopickupAtHero();
    await flush_screen(1);
    assert.match(topRow(), /little trouble lifting .*large box/);
    assert.match(statusRow(), /Burdened/);
});
//# sourceMappingURL=pickup_status_timing.test.js.map