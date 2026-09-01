import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { W_WEP } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { GRAPPLING_HOOK, ROCK } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { floorObject, inventoryObject } from './support/game-objects.js';
import { floorObjectsAt } from './support/level-state.js';
import { addMonster } from './support/monsters.js';
import { freshPlayableRoom } from './support/playable-room.js';

function installHook({ wielded = true, enchantment = 0 } = {}) {
    const hook = inventoryObject(GRAPPLING_HOOK, 'a', {
        spe: enchantment,
        wielded,
        owornmask: wielded ? W_WEP : 0,
    });
    game.inventory = [hook];
    if (wielded) game.uwep = game.u.uwep = hook;
    game.u.weaponSkills = [];
    game.u.weaponSkills[13] = {
        skill: 2,
        maxSkill: 4,
        advance: 0,
    };
    return hook;
}

test('applying an unwielded grappling hook wields it before targeting',
    async () => {
        freshPlayableRoom();
        const hook = installHook({ wielded: false });
        pushKeys('a');

        await rhack('a'.charCodeAt(0));

        assert.equal(game.uwep, hook);
        assert.equal(game.context.move, 1);
    });

test('a grappling hook snags one object from a visible floor square',
    async () => {
        freshPlayableRoom();
        installHook();
        const rock = floorObject(ROCK, 12, 10);
        game._travelTipShown = true;
        initRng(3n);
        pushKeys('all.');

        await rhack('a'.charCodeAt(0));

        assert.equal(game.inventory.includes(rock), true);
        assert.equal(floorObjectsAt(game.level, 12, 10).includes(rock), false);
        assert.equal(game.context.move, 1);
    });

test('a grappling hook can yank the hero one square toward solid terrain',
    async () => {
        freshPlayableRoom();
        installHook();
        game._travelTipShown = true;
        initRng(2n);
        pushKeys('all.');

        await rhack('a'.charCodeAt(0));

        assert.deepEqual([game.u.ux, game.u.uy], [11, 10]);
        assert.equal(game.context.move, 1);
    });

test('a grappling hook strikes at range without charging melee hunger',
    async () => {
        freshPlayableRoom();
        installHook({ enchantment: 20 });
        const monster = addMonster({
            mnum: 12,
            x: 12,
            y: 10,
            hitPoints: 100,
        });
        const hungerBefore = game.u.uhunger;
        game._travelTipShown = true;
        initRng(14n);
        pushKeys('all.');

        await rhack('a'.charCodeAt(0));

        assert.ok(monster.mhp < 100);
        assert.equal(game.u.uhunger, hungerBefore);
        assert.equal(game.context.move, 1);
    });

test('a grappling hook can pull a tiny monster next to the hero', async () => {
    freshPlayableRoom({ hero: { uhp: 100, uhpmax: 100 } });
    installHook();
    const monster = addMonster({
        mnum: 0,
        x: 12,
        y: 10,
        hitPoints: 100,
    });
    game._travelTipShown = true;
    initRng(113n);
    pushKeys('all.');

    await rhack('a'.charCodeAt(0));

    assert.notDeepEqual([monster.mx, monster.my], [12, 10]);
    assert.equal(Math.max(
        Math.abs(monster.mx - game.u.ux),
        Math.abs(monster.my - game.u.uy),
    ), 1);
    assert.equal(monster.mhp, 100);
    assert.equal(game.context.move, 1);
});
