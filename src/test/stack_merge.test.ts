import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { addInventoryItem } from '../js/u_init.js';
import { mergeObjectStacks } from '../js/object_merge.js';
import { ARROW, DAGGER, GLOB_OF_GRAY_OOZE } from '../js/object_data.js';
import { setPrimaryWeapon, setSecondaryWeapon, setQuiverObject } from '../js/weapon_slots.js';
import { claimNextDueObjectTimer } from '../js/object_timers.js';
import { runClaimedGlobTimer, startGlobTimeout } from '../js/glob.js';
import { pushKeys } from '../js/input.js';
import { knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('inventory glob comparison shares beatitude knowledge before absorption', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const first = await addInventoryItem(await knownObject(GLOB_OF_GRAY_OOZE, { bknown: false }));
    const incoming = await knownObject(GLOB_OF_GRAY_OOZE, { bknown: true, oname: 'Lunch' });
    pushKeys('                                                                                ');

    const merged = await addInventoryItem(incoming);

    assert.equal(merged, first);
    assert.equal(merged.bknown, true);
    assert.equal(merged.oname || merged.oextra?.oname, 'Lunch');
    assert.equal(incoming.where, 'gone');
});

void test('inventory glob merging stops the incoming timer before averaging shrink delays', async () => {
    freshObjectRoom({ moves: 100 });
    requirePlayingGame(game);
    const first = await addInventoryItem(await knownObject(GLOB_OF_GRAY_OOZE, { age: 0 }));
    const incoming = await knownObject(GLOB_OF_GRAY_OOZE, { age: 0 });
    startGlobTimeout(first, game, game.moves, 40);
    startGlobTimeout(incoming, game, game.moves, 81);
    pushKeys('                                                                                ');
    await addInventoryItem(incoming);
    const weight = first.owt;
    game.moves = 132;
    assert.equal(claimNextDueObjectTimer(game, game.moves), null);

    game.moves = 133;
    const timer = claimNextDueObjectTimer(game, game.moves);
    assert.ok(timer);
    runClaimedGlobTimer(timer, game, game.moves);

    assert.equal(first.owt, weight - 1);
});

for (const [survivorSlot, incomingSlot, expectedSlot] of [
    ['primary', 'quiver', 'uwep'],
    ['quiver', 'primary', 'uwep'],
    ['secondary', 'quiver', 'uswapwep'],
    ['quiver', 'secondary', 'uswapwep'],
] as const) {
    void test(`merging ${survivorSlot} and ${incomingSlot} stacks keeps the ${expectedSlot} slot`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const first = await addInventoryItem(await knownObject(ARROW, { quan: 2, nomerge: true }));
        const incoming = await addInventoryItem(await knownObject(ARROW, { quan: 3, nomerge: true }));
        first.nomerge = incoming.nomerge = false;
        const otherHand = await addInventoryItem(await knownObject(DAGGER));
        const otherSlot = expectedSlot === 'uwep' ? 'uswapwep' : 'uwep';
        if (otherSlot === 'uwep') await setPrimaryWeapon(otherHand);
        else await setSecondaryWeapon(otherHand);
        const install = {
            primary: setPrimaryWeapon,
            secondary: setSecondaryWeapon,
            quiver: setQuiverObject,
        };
        await install[survivorSlot](first);
        await install[incomingSlot](incoming);
        game.u.twoweap = true;
        pushKeys('                                                                                ');

        await mergeObjectStacks(first, incoming);

        assert.equal(game[expectedSlot], first);
        assert.equal(game[otherSlot], otherHand);
        assert.equal(game.uquiver, null);
        assert.equal(game.u.twoweap, false);
        assert.equal(first.quan, 5);
        assert.equal(incoming.where, 'gone');
    });
}
