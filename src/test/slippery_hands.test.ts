import test from 'node:test';
import assert from 'node:assert/strict';
import { wearHeroAccessory } from '../js/accessory.js';
import { moveloop_core } from '../js/allmain.js';
import { game, requireGameLevel } from '../js/gstate.js';
import type { InputGate } from '../js/input.js';
import { LONG_SWORD, RIN_PROTECTION } from '../js/object_data.js';
import { setSlipperyHands } from '../js/towel.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { addInventoryObject, addInventoryWeapon } from './support/game-objects.js';
import { floorObjectsAt } from './support/level-state.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
import { freshTurnRoom } from './support/playable-room.js';

// C allmain.c calls do_wear.c:glibr() at the start of every turn while the
// hero's fingers are slippery.
async function searchOneTurn(input: InputGate, expected: RegExp) {
    installPagerInput(input, { expected: /slip/, limit: 5 });
    input.feed('s');
    await moveloop_core();
    await finishAtCommandInput(input, moveloop_core, expected);
}

void test('slippery fingers drop a wielded sword and an uncursed ring at the next turn', async () => {
    const input = freshTurnRoom();
    const sword = await addInventoryWeapon(LONG_SWORD, { cursed: false });
    await setPrimaryWeapon(sword);
    const ring = await addInventoryObject(RIN_PROTECTION, { cursed: false });
    await wearHeroAccessory(ring, 'uleft');
    setSlipperyHands(10);

    await searchOneTurn(input, /^Your sword also slips from your hand\.$/);

    assert.equal(game.uwep, null);
    assert.equal(game.uleft, null);
    const floor = floorObjectsAt(requireGameLevel(), game.u.ux, game.u.uy);
    assert.ok(floor.includes(sword));
    assert.ok(floor.includes(ring));
});

void test('slippery fingers cannot shed a cursed ring or a welded weapon', async () => {
    const input = freshTurnRoom();
    const sword = await addInventoryWeapon(LONG_SWORD, { cursed: true });
    await setPrimaryWeapon(sword);
    const ring = await addInventoryObject(RIN_PROTECTION, { cursed: true });
    await wearHeroAccessory(ring, 'uright');
    setSlipperyHands(10);

    await searchOneTurn(input, /^[^?]*$/);

    assert.equal(game.uwep, sword);
    assert.equal(game.uright, ring);
});
