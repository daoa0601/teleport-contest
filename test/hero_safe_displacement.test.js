import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { MM_ANGRY, NO_MINVENT } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { game, requirePlayingGame, resetGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { restoreGame, saveGame } from '../js/save.js';
import { makeBlinded } from '../js/sight_change.js';
import { vision_recalc } from '../js/vision.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { memoryStorage } from './support/memory-storage.js';
import { createStaffedShop } from './support/shop.js';
void test('a blind hero discovers an unseen pet without swapping places', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const pet = await createMonsterAt('little dog', 11, 10, NO_MINVENT);
    initializePet(pet, { state: game });
    await makeBlinded(20, { talk: false });
    pushKeys(' '.repeat(20));
    initRng(1n);
    await rhack('l'.charCodeAt(0));
    assert.equal(game.u.ux, 10);
    assert.equal(pet.mx, 11);
    assert.match(game._pending_message, /something there you can't see/);
});
void test('an immobile peaceful monster sometimes permits displacement but usually stays put', async () => {
    let refused = 0;
    let swapped = 0;
    for (let seed = 1; seed <= 24; seed++) {
        freshObjectRoom();
        requirePlayingGame(game);
        const jelly = await createMonsterAt('blue jelly', 11, 10, NO_MINVENT);
        jelly.mpeaceful = 1;
        pushKeys(' '.repeat(20));
        initRng(BigInt(seed));
        await rhack('l'.charCodeAt(0));
        if (/doesn't seem to move/.test(game._pending_message)) {
            assert.equal(game.u.ux, 10);
            assert.equal(jelly.mx, 11);
            refused++;
        }
        else if (game.u.ux === 11) {
            assert.equal(jelly.mx, 10);
            swapped++;
        }
    }
    assert.ok(refused > 0, 'an immobile species must refuse some otherwise eligible swaps');
    assert.ok(swapped > 0, 'native permits occasional displacement of an immobile species');
});
void test('a helpless pet refuses a swap after passing the ordinary refusal chance', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const pet = await createMonsterAt('little dog', 11, 10, MM_ANGRY | NO_MINVENT);
    initializePet(pet, { state: game });
    pet.msleeping = 1;
    pushKeys(' '.repeat(20));
    initRng(1n);
    await rhack('l'.charCodeAt(0));
    assert.equal(game.u.ux, 10);
    assert.equal(pet.mx, 11);
    assert.match(game._pending_message, /doesn't seem to move/);
});
for (const canMove of [false, 0]) {
    void test(`a restored pet with mcanmove=${canMove} refuses displacement`, async () => {
        freshObjectRoom();
        const pet = await createMonsterAt('little dog', 11, 10, NO_MINVENT);
        initializePet(pet, { state: game });
        pet.mcanmove = canMove;
        game.plname = 'HelplessPet';
        const storage = memoryStorage();
        assert.equal(await saveGame(storage), true);
        resetGame();
        assert.equal(restoreGame('HelplessPet', storage), true);
        requirePlayingGame(game);
        vision_recalc(0);
        const restoredPet = game.level.monsters.find(monster => monster.m_id === pet.m_id);
        assert.ok(restoredPet);
        pushKeys(' '.repeat(20));
        initRng(1n);
        await rhack('l'.charCodeAt(0));
        assert.equal(game.u.ux, 10);
        assert.equal(restoredPet.mx, 11);
        assert.match(game._pending_message, /doesn't seem to move/);
    });
}
void test('a pet in a tended shop blocks the hero even after passing its ordinary refusal chance', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    await createStaffedShop({ keeperX: 13, keeperY: 11 });
    const pet = await createMonsterAt('little dog', 11, 10, NO_MINVENT);
    initializePet(pet, { state: game });
    pushKeys(' '.repeat(20));
    initRng(1n);
    await rhack('l'.charCodeAt(0));
    assert.equal(game.u.ux, 10);
    assert.equal(pet.mx, 11);
    assert.equal(pet.mflee, 1);
    assert.match(game._pending_message, /is in the way/);
});
void test('a pet blocking a step in an angry keeper\'s shop does not increase the bill', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const entry = { bo_id: 123, price: 100, bquan: 1, useup: false };
    const { shopkeeper } = await createStaffedShop({ keeperX: 13, keeperY: 11, bill: [entry] });
    shopkeeper.mpeaceful = 0;
    const pet = await createMonsterAt('little dog', 11, 10, NO_MINVENT);
    initializePet(pet, { state: game });
    pushKeys(' '.repeat(20));
    initRng(1n);
    await rhack('l'.charCodeAt(0));
    assert.equal(game.u.ux, 10);
    assert.match(game._pending_message, /is in the way/);
    assert.equal(entry.price, 100);
    assert.equal(!!shopkeeper.eshk.surcharge, false);
});
//# sourceMappingURL=hero_safe_displacement.test.js.map