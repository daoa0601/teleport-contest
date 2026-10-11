import test from 'node:test';
import assert from 'node:assert/strict';
import { moveloop_core } from '../js/allmain.js';
import { NO_MINVENT } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { ELVEN_DAGGER } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { floorObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshTurnRoom } from './support/playable-room.js';
// dogmove.c dog_invent(): the pet's "picks up" line is printed while the
// object is still on the floor; obj_extract_self() and mpickobj() follow.
// When that line forces --More-- on the hero's swap message, the object
// must still lie on the square at the pager.
void test('a pet picking up an object leaves it on the floor until its message is shown', async () => {
    const input = freshTurnRoom({ left: 10, right: 11, top: 10, bottom: 10 });
    requirePlayingGame(game);
    game.flags.pickup = false;
    const level = game.level;
    const dog = await createMonsterAt('little dog', 11, 10, NO_MINVENT);
    initializePet(dog);
    const edog = dog.edog;
    assert.ok(edog, 'the dog is a pet');
    edog.apport = 1;
    const dagger = await floorObject(ELVEN_DAGGER, 10, 10);
    const onFloor = () => (level.objects[10]?.[10] ?? []).includes(dagger);
    let swapPager = null;
    let pickupTurnPager = null;
    let pickupSeen = false;
    let reads = 0;
    // Acknowledge pagers; otherwise step toward the dog so every move swaps.
    input.display = {
        async readKey() {
            assert.ok(++reads < 400, 'the dog should pick up the dagger within a few dozen swaps');
            const topline = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('') ?? '';
            if (/--More--/.test(topline)) {
                if (/You swap places with your little dog\./.test(topline))
                    swapPager = { onFloor: onFloor(), carried: dog.minvent.includes(dagger) };
                return ' '.charCodeAt(0);
            }
            return (game.u.ux === 10 ? 'l' : 'h').charCodeAt(0);
        },
    };
    input.beforeRead = () => {
        const topline = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('') ?? '';
        if (!pickupSeen && /The little dog picks up/.test(topline)) {
            pickupSeen = true;
            pickupTurnPager = swapPager;
        }
        if (!/--More--/.test(topline))
            swapPager = null;
    };
    initRng(3n);
    for (let turn = 0; turn < 100 && !pickupSeen; turn++)
        await moveloop_core();
    assert.equal(pickupSeen, true, 'the dog eventually picks up the dagger');
    assert.deepEqual(pickupTurnPager, { onFloor: true, carried: false }, 'at the swap pager before the pickup line, the dagger is still on the floor');
});
//# sourceMappingURL=pet_pickup_order.test.js.map