import test from 'node:test';
import assert from 'node:assert/strict';

import { A_DEX, A_STR } from '../js/const.js';
import { game } from '../js/gstate.js';
import { CLUB } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { throwInventoryObject } from './support/commands.js';
import { knownInventoryWeapon } from './support/game-objects.js';
import { floorObjects } from './support/level-state.js';
import { addMonster } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

function carriedClub() {
    return knownInventoryWeapon(CLUB, { invlet: 'a', spe: 0 });
}

test('throwing a club carries it across its strength-based range', async () => {
    const level = freshObjectRoom({ right: 20, gameplaySeed: 4101n });
    game.u.acurr.a[A_STR] = 10;
    const club = carriedClub();

    await throwInventoryObject(club, 'l');

    assert.equal(game.inventory.includes(club), false);
    assert.equal(floorObjects(level).includes(club), true);
    assert.deepEqual([club.ox, club.oy], [15, 10]);
});

test('a thrown club can hit a monster and land on its square', async () => {
    const level = freshObjectRoom({ right: 20, gameplaySeed: 4102n });
    game.u.ulevel = 20;
    game.u.acurr.a[A_DEX] = 18;
    const club = carriedClub();
    const jackal = addMonster({
        species: 'jackal',
        x: 13,
        y: 10,
        hitPoints: 20,
        mac: 10,
        mcanmove: 0,
    });

    await throwInventoryObject(club, 'l', Array(4).fill(' '));

    assert.ok(jackal.mhp < 20);
    assert.equal(floorObjects(level).includes(club), true);
    assert.deepEqual([club.ox, club.oy], [13, 10]);
});

test('grease can make a thrown club slip away from its chosen path', async () => {
    freshObjectRoom({ right: 20, gameplaySeed: 4103n });
    game.u.acurr.a[A_STR] = 10;
    const club = carriedClub();
    club.greased = true;
    initRng(2333n);

    await throwInventoryObject(club, 'l');

    assert.notDeepEqual([club.ox, club.oy], [15, 10]);
    assert.match(game._pending_message, /slips as you throw it/);
});
