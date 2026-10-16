import test from 'node:test';
import assert from 'node:assert/strict';
import { A_DEX, STONE } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { BOOMERANG } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { setPrimaryWeapon, setQuiverObject } from '../js/weapon_slots.js';
import { rhack } from '../js/cmd.js';
import { pushKey } from '../js/input.js';
import { throwInventoryObject } from './support/commands.js';
import { addInventoryWeapon } from './support/game-objects.js';
import { floorObjectsAt } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { createMonsterAt } from './support/monsters.js';

void test('a skilled thrower catches and rewields a boomerang after its curved flight', async () => {
    freshObjectRoom({ left: 4, right: 20, top: 3, bottom: 17 });
    requirePlayingGame(game);
    game.u.acurr.a[A_DEX] = 25;
    const boom = await addInventoryWeapon(BOOMERANG);
    await setPrimaryWeapon(boom, game);

    await throwInventoryObject(boom, 'l');

    assert.equal(boom.where, 'inventory');
    assert.equal(game.uwep, boom);
    assert.match(game._pending_message, /You skillfully catch the boomerang\./);
    assert.equal(game.context.move, 1);
});

for (const rightHanded of [true, false]) {
    void test(`a ${rightHanded ? 'right' : 'left'} handed boomerang bends before a wall`, async () => {
        const level = freshObjectRoom({ left: 4, right: 20, top: 3, bottom: 17 });
        requirePlayingGame(game);
        game.u.rightHanded = rightHanded;
        const bendY = rightHanded ? 9 : 11;
        level.requireAt(13, bendY).typ = STONE;
        const boom = await addInventoryWeapon(BOOMERANG);

        await throwInventoryObject(boom, 'l');

        assert.ok(floorObjectsAt(level, 12, 10).includes(boom));
    });
}

void test('a fired boomerang rejoins its quivered stack after a catch', async () => {
    freshObjectRoom({ left: 4, right: 20, top: 3, bottom: 17 });
    requirePlayingGame(game);
    game.u.acurr.a[A_DEX] = 25;
    const boom = await addInventoryWeapon(BOOMERANG, { quan: 3 });
    await setQuiverObject(boom, game);
    pushKey('l');

    await rhack('f'.charCodeAt(0));

    assert.equal(boom.quan, 3);
    assert.equal(game.uquiver, boom);
    assert.equal(game.inventory.length, 1);
});

void test('a boomerang can strike monsters on both sides of its curved flight', async () => {
    freshObjectRoom({ left: 4, right: 20, top: 3, bottom: 17 });
    requirePlayingGame(game);
    game.u.rightHanded = true;
    game.u.acurr.a[A_DEX] = 25;
    const outward = await createMonsterAt('lichen', 11, 10);
    const returning = await createMonsterAt('lichen', 9, 9);
    outward.mhp = outward.mhpmax = returning.mhp = returning.mhpmax = 100;
    const boom = await addInventoryWeapon(BOOMERANG, { spe: 5 });
    initRng(77n);

    await throwInventoryObject(boom, 'l', ' '.repeat(15));

    assert.ok(outward.mhp < 100);
    assert.ok(returning.mhp < 100);
    assert.equal(boom.where, 'inventory');
});

void test('a fumbling thrower can be hit by the returning boomerang', async () => {
    const level = freshObjectRoom({ left: 4, right: 20, top: 3, bottom: 17 });
    requirePlayingGame(game);
    game.u.fumbling = true;
    game.u.uac = 20;
    const boom = await addInventoryWeapon(BOOMERANG);

    await throwInventoryObject(boom, 'l', ' '.repeat(10));

    assert.ok(game.u.uhp < 40);
    assert.ok(floorObjectsAt(level, 10, 10).includes(boom));
    assert.match(game._pending_message, /You are hit by a boomerang/);
});
