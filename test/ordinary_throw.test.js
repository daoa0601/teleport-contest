import test from 'node:test';
import assert from 'node:assert/strict';

import {
    A_DEX, A_STR, P_BASIC, P_CROSSBOW, W_WEP,
} from '../js/const.js';
import { game } from '../js/gstate.js';
import { CLUB, CROSSBOW, CROSSBOW_BOLT } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { throwInventoryObject } from './support/commands.js';
import { knownInventoryWeapon } from './support/game-objects.js';
import { installHeroWeaponSkills } from './support/hero-state.js';
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

test('a crossbow sends its bolt eight squares regardless of Strength', async () => {
    const level = freshObjectRoom({ right: 22, gameplaySeed: 4104n });
    game.u.acurr.a[A_STR] = 3;
    const crossbow = knownInventoryWeapon(CROSSBOW, {
        invlet: 'a', owornmask: W_WEP, wielded: true,
    });
    const bolt = knownInventoryWeapon(CROSSBOW_BOLT, { invlet: 'b' });
    game.uwep = game.u.uwep = crossbow;

    await throwInventoryObject(bolt, 'l');

    assert.equal(floorObjects(level).includes(bolt), true);
    assert.deepEqual([bolt.ox, bolt.oy], [18, 10]);
});

test('a fired crossbow bolt gets ring damage but not Strength damage', async () => {
    freshObjectRoom({ right: 20, gameplaySeed: 4105n });
    game.u.ulevel = 20;
    game.u.acurr.a[A_DEX] = 18;
    game.u.acurr.a[A_STR] = 3;
    game.u.udaminc = 3;
    installHeroWeaponSkills({ [P_CROSSBOW]: P_BASIC });
    const crossbow = knownInventoryWeapon(CROSSBOW, {
        invlet: 'a', owornmask: W_WEP, wielded: true,
    });
    const bolt = knownInventoryWeapon(CROSSBOW_BOLT, { invlet: 'b' });
    game.uwep = game.u.uwep = crossbow;
    const jackal = addMonster({
        species: 'jackal', x: 11, y: 10,
        hitPoints: 20, mac: 10, mcanmove: 0,
    });

    await throwInventoryObject(bolt, 'l', Array(4).fill(' '));

    assert.equal(jackal.mhp, 15);
});
