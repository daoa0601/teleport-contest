import test from 'node:test';
import assert from 'node:assert/strict';

import { P_BASIC, P_FLAIL, W_WEP } from '../js/const.js';
import { place_object } from '../js/floor_object.js';
import { game } from '../js/gstate.js';
import { GRAPPLING_HOOK, ROCK } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { applyInventoryObject } from './support/commands.js';
import {
    addInventoryObject, knownObject,
} from './support/game-objects.js';
import { installHeroWeaponSkills } from './support/hero-state.js';
import { floorObjectsAt } from './support/level-state.js';
import { addMonster } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

function installHook({ wielded = true, enchantment = 0 } = {}) {
    const hook = addInventoryObject(GRAPPLING_HOOK, {
        spe: enchantment,
        wielded,
        owornmask: wielded ? W_WEP : 0,
    });
    if (wielded) game.uwep = game.u.uwep = hook;
    installHeroWeaponSkills({ [P_FLAIL]: P_BASIC });
    return hook;
}

test('applying an unwielded grappling hook wields it before targeting',
    async () => {
        freshObjectRoom();
        const hook = installHook({ wielded: false });
        await applyInventoryObject(hook);

        assert.equal(game.uwep, hook);
        assert.equal(game.context.move, 1);
    });

test('a grappling hook snags one object from a visible floor square',
    async () => {
        freshObjectRoom();
        const hook = installHook();
        const rock = place_object(knownObject(ROCK), 12, 10);
        game._travelTipShown = true;
        initRng(3n);
        await applyInventoryObject(hook, 'll.');

        assert.equal(game.inventory.includes(rock), true);
        assert.equal(floorObjectsAt(game.level, 12, 10).includes(rock), false);
        assert.equal(game.context.move, 1);
    });

test('a grappling hook can yank the hero one square toward solid terrain',
    async () => {
        freshObjectRoom();
        const hook = installHook();
        game._travelTipShown = true;
        initRng(2n);
        await applyInventoryObject(hook, 'll.');

        assert.deepEqual([game.u.ux, game.u.uy], [11, 10]);
        assert.equal(game.context.move, 1);
    });

test('a grappling hook strikes at range without charging melee hunger',
    async () => {
        freshObjectRoom();
        const hook = installHook({ enchantment: 20 });
        const monster = addMonster({
            mnum: 12,
            x: 12,
            y: 10,
            hitPoints: 100,
        });
        const hungerBefore = game.u.uhunger;
        game._travelTipShown = true;
        initRng(14n);
        await applyInventoryObject(hook, 'll.');

        assert.ok(monster.mhp < 100);
        assert.equal(game.u.uhunger, hungerBefore);
        assert.equal(game.context.move, 1);
    });

test('a grappling hook can pull a tiny monster next to the hero', async () => {
    freshObjectRoom({ hero: { uhp: 100, uhpmax: 100 } });
    const hook = installHook();
    const monster = addMonster({
        mnum: 0,
        x: 12,
        y: 10,
        hitPoints: 100,
    });
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
