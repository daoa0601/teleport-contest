// C shk.c:shkcatch(), reached from zap.c bhit() for flying pick-axes, with
// the "alert shk caught it" tails of dokick.c really_kick_object() and
// dothrow.c throwit_mon_hit().
import test from 'node:test';
import assert from 'node:assert/strict';

import { placeCreatedObject } from '../js/floor_object.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { PICK_AXE } from '../js/object_data.js';
import { vision_recalc, vision_reset_new_level } from '../js/vision.js';
import { kickDirection, throwInventoryObject } from './support/commands.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { freshGameplayRoom } from './support/playable-room.js';
import { createMonsterAt } from './support/monsters.js';
import { createStaffedShop } from './support/shop.js';
import { floorObjectsAt } from './support/level-state.js';

// The shop's interior column at x=13 lies on the hero's kick line from her
// position at (10,10); the keeper starts diagonally adjacent to (13,10) so
// shkcatch() can reach the flying pick before its range runs out.
async function shopNearKickLine(keeperX: number, keeperY: number) {
    const level = freshGameplayRoom({ role: 'tourist', hero: { uhp: 100, uhpmax: 100 } });
    const { shopkeeper } = await createStaffedShop({
        left: 13, right: 17, top: 8, bottom: 12,
        keeperX, keeperY, doorX: 13, doorY: 10,
    });
    shopkeeper.eshk.shknam = '+Ada';
    shopkeeper.mhp = shopkeeper.mhpmax = 40;
    vision_reset_new_level();
    vision_recalc(0);
    const messages: string[] = [];
    resetInputState().beforeRead = () => {
        if (game._pending_message) messages.push(game._pending_message);
    };
    return { level, shopkeeper, messages };
}

void test('a kicked pick-axe flying through a shop is caught by its keeper', async () => {
    const { level, shopkeeper, messages } = await shopNearKickLine(14, 9);
    const pick = placeCreatedObject(await knownObject(PICK_AXE), 11, 10);

    await kickDirection('l', ' '.repeat(4));

    const transcript = [...messages, game._pending_message ?? ''].join('\n');
    assert.match(transcript, /Ada nimbly catches the pick-axe\./);
    assert.equal(pick.where, 'minvent');
    assert.equal(pick.ocarry, shopkeeper);
    assert.deepEqual([shopkeeper.mx, shopkeeper.my], [13, 10]);
    assert.equal(floorObjectsAt(level, 13, 10).includes(pick), false);
    assert.equal(shopkeeper.mpeaceful, 1, 'Catching a pick-axe never angers the keeper');
    assert.equal(shopkeeper.mhp, 40, 'The catch replaces any attack on the keeper');
});

void test('a thrown pick-axe flying through a shop is caught by its keeper', async () => {
    const { level, shopkeeper, messages } = await shopNearKickLine(14, 9);
    const pick = await addInventoryObject(PICK_AXE);

    await throwInventoryObject(pick, 'l', ' '.repeat(4));

    const transcript = [...messages, game._pending_message ?? ''].join('\n');
    assert.match(transcript, /Ada nimbly catches the pick-axe\./);
    assert.equal(pick.where, 'minvent');
    assert.equal(pick.ocarry, shopkeeper);
    assert.deepEqual([shopkeeper.mx, shopkeeper.my], [13, 10]);
    assert.equal(floorObjectsAt(level, 13, 10).includes(pick), false);
    assert.equal(shopkeeper.mpeaceful, 1);
});

void test('a keeper clearing a customer away shouts while catching the pick-axe', async () => {
    const { level, shopkeeper, messages } = await shopNearKickLine(14, 9);
    const customer = await createMonsterAt('monkey', 13, 10);
    const pick = placeCreatedObject(await knownObject(PICK_AXE), 11, 10);

    await kickDirection('l', ' '.repeat(6));

    const transcript = [...messages, game._pending_message ?? ''].join('\n');
    assert.match(transcript, /"Out of my way, scum!"/);
    assert.match(transcript, /Ada nimbly catches the pick-axe\./);
    assert.deepEqual([shopkeeper.mx, shopkeeper.my], [13, 10]);
    assert.notDeepEqual([customer.mx, customer.my], [13, 10],
        'The displaced customer cannot share the catch square');
    assert.equal(pick.where, 'minvent');
    assert.equal(pick.ocarry, shopkeeper);
    assert.equal(floorObjectsAt(level, 13, 10).includes(pick), false);
});

void test('a keeper standing on the flight square is attacked instead of catching', async () => {
    const { shopkeeper, messages } = await shopNearKickLine(13, 10);
    const pick = placeCreatedObject(await knownObject(PICK_AXE), 11, 10);

    await kickDirection('l', ' '.repeat(4));

    // shkcatch() refuses the keeper's own square, so bhit() stops at him and
    // the ordinary kicked-object contact runs instead of the catch.
    const transcript = [...messages, game._pending_message ?? ''].join('\n');
    assert.doesNotMatch(transcript, /nimbly catches/);
    assert.notEqual(pick.ocarry ?? null, shopkeeper);
});
