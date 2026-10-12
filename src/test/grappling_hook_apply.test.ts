import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { DUST, P_BASIC, P_FLAIL, W_WEP } from '../js/const.js';
import { engravingAt, makeEngravingAt } from '../js/engrave.js';
import { placeCreatedObject } from '../js/floor_object.js';
import { game } from '../js/gstate.js';
import { DART, GRAPPLING_HOOK, ROCK } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { applyInventoryObject } from './support/commands.js';
import {
    addInventoryObject, knownObject,
} from './support/game-objects.js';
import { installHeroWeaponSkills } from './support/hero-state.js';
import { floorObjectsAt } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';

async function installHook({ wielded = true, enchantment = 0 } = {}) {
    const hook = await addInventoryObject(GRAPPLING_HOOK, {
        spe: enchantment,
        wielded,
        owornmask: wielded ? W_WEP : 0,
    });
    if (wielded) game.uwep = game.u.uwep = hook;
    installHeroWeaponSkills({ [P_FLAIL]: P_BASIC });
    return hook;
}

void test('applying an unwielded grappling hook wields it before targeting',
    async () => {
        freshObjectRoom();
        requireFixtureGame(game);
        const hook = await installHook({ wielded: false });
        await applyInventoryObject(hook);

        assert.equal(game.uwep, hook);
        assert.equal(game.context.move, 1);
    });

void test('a grappling hook snags one object from a visible floor square',
    async () => {
        freshObjectRoom();
        requireFixtureGame(game);
        const hook = await installHook();
        const rock = placeCreatedObject(await knownObject(ROCK), 12, 10);
        game._travelTipShown = true;
        initRng(3n);
        await applyInventoryObject(hook, 'll.');

        assert.equal(game.inventory.includes(rock), true);
        assert.equal(floorObjectsAt(game.level, 12, 10).includes(rock), false);
        assert.equal(game.context.move, 1);
    });

void test('a hooked shop item is described after credit settles its bill', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const hook = await installHook();
    const { shopkeeper } = await createStaffedShop({ left: 12, keeperX: 14 });
    shopkeeper.eshk.credit = 1000;
    const darts = placeCreatedObject(await knownObject(DART, { quantity: 3 }), 12, 10);
    game._travelTipShown = true;
    initRng(3n);

    await applyInventoryObject(hook, 'll.          ');

    const carried = game.inventory.find(object => object.otyp === DART);
    assert.ok(carried, 'The hook must bring a dart into inventory');
    assert.equal(carried.quan, 1);
    assert.equal(darts.quan, 2);
    assert.equal(carried.unpaid, false);
    assert.equal(shopkeeper.eshk.billct, 0);
    assert.equal(shopkeeper.eshk.credit, 0);
    assert.match(game._pending_message, / - .*dart.*\.$/);
    assert.doesNotMatch(game._pending_message, /unpaid|zorkmids/);
});

void test('a grappling hook can yank the hero one square toward solid terrain',
    async () => {
        freshObjectRoom();
        requireFixtureGame(game);
        const hook = await installHook();
        game._travelTipShown = true;
        initRng(2n);
        await applyInventoryObject(hook, 'll.');

        assert.deepEqual([game.u.ux, game.u.uy], [11, 10]);
        assert.equal(game.context.move, 1);
    });

void test('a grappling hook strikes at range without charging melee hunger',
    async () => {
        freshObjectRoom();
        requireFixtureGame(game);
        const hook = await installHook({ enchantment: 20 });
        const monster = await createMonsterAt('jackal', 12, 10);
        monster.mhp = monster.mhpmax = 100;
        const hungerBefore = game.u.uhunger;
        game._travelTipShown = true;
        initRng(14n);
        await applyInventoryObject(hook, 'll.');

        assert.ok(monster.mhp < 100);
        assert.equal(game.u.uhunger, hungerBefore);
        assert.equal(game.context.move, 1);
    });

void test('a grappling hook can pull a tiny monster next to the hero', async () => {
    freshObjectRoom({ hero: { uhp: 100, uhpmax: 100 } });
    requireFixtureGame(game);
    const hook = await installHook();
    const monster = await createMonsterAt('giant ant', 12, 10);
    monster.mhp = monster.mhpmax = 100;
    game._travelTipShown = true;
    initRng(113n);
    await applyInventoryObject(hook, 'll.');

    assert.notDeepEqual([monster.mx, monster.my], [12, 10]);
    assert.equal(Math.max(
        Math.abs(monster.mx - game.u.ux),
        Math.abs(monster.my - game.u.uy),
    ), 1);
    assert.equal(monster.mhp, 100);
    assert.equal(game.context.move, 1);
});

void test('applying a grappling hook scuffs the dust engraving under the hero',
    async () => {
        freshObjectRoom();
        requireFixtureGame(game);
        const hook = await installHook();
        makeEngravingAt(game.u.ux, game.u.uy, '?', null, 0, DUST);
        makeEngravingAt(12, 10, '?', null, 0, DUST);
        game._travelTipShown = true;
        initRng(3n);
        await applyInventoryObject(hook, 'll.');

        // C apply.c:3810 scuffs the hero's own square only; the engraving
        // at the hooked square is unaffected.  A one-character dust
        // engraving is fully erased when the wear fires.
        assert.equal(engravingAt(game.u.ux, game.u.uy), null);
        assert.equal(engravingAt(12, 10)?.text, '?');
        assert.equal(game.context.move, 1);
    });

void test('a levitating hero scuffs no engraving while hooking', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const hook = await installHook();
    const underHero = makeEngravingAt(
        game.u.ux, game.u.uy, '?', null, 0, DUST);
    makeEngravingAt(12, 10, '?', null, 0, DUST);
    game.u.levitating = true;
    game._travelTipShown = true;
    initRng(3n);
    await applyInventoryObject(hook, 'll.');

    // C engrave.c:u_wipe_engr() gates the wear on can_reach_floor(); the
    // same RNG stream that scuffs the text on the ground leaves a
    // levitating hero's engraving untouched.
    assert.equal(engravingAt(game.u.ux, game.u.uy), underHero);
    assert.ok(underHero !== null && underHero !== undefined);
    assert.equal(underHero.text, '?');
    assert.equal(engravingAt(12, 10)?.text, '?');
    assert.equal(game.context.move, 1);
});

void test('a hook leaves an unliftable stack together on the floor', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const hook = await installHook();
    for (const invlet of 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ') {
        if (invlet === hook.invlet) continue;
        await addInventoryObject(DART, { invlet, nomerge: true });
    }
    const rocks = placeCreatedObject(await knownObject(ROCK, { quantity: 4 }), 12, 10);
    game._travelTipShown = true;
    initRng(3n);

    await applyInventoryObject(hook, 'll.    ');

    assert.equal(rocks.quan, 4);
    assert.equal(floorObjectsAt(game.level, 12, 10).length, 1);
    assert.equal(floorObjectsAt(game.level, 12, 10)[0], rocks);
    assert.match(game._pending_message, /knapsack cannot accommodate/);
});
