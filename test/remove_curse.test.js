import test from 'node:test';
import assert from 'node:assert/strict';

import { W_ARM, W_BALL, W_CHAIN, W_SADDLE } from '../js/const.js';
import { game } from '../js/gstate.js';
import { place_object } from '../js/mklev.js';
import {
    CLUB, HEAVY_IRON_BALL, IRON_CHAIN, LOADSTONE, SCR_REMOVE_CURSE,
} from '../js/object_data.js';
import { removeCurseEffect } from '../js/read.js';
import {
    freshWeaponArena, inventoryObject,
} from './support/weapon-arena.js';

function cursedObject(otyp, invlet, overrides = {}) {
    return inventoryObject(otyp, invlet, {
        cursed: true, blessed: false, buc: 'cursed', ...overrides,
    });
}

test('remove curse affects worn items and loadstones, not the whole pack', async () => {
    freshWeaponArena();
    const worn = cursedObject(CLUB, 'a', { owornmask: W_ARM });
    const loadstone = cursedObject(LOADSTONE, 'b');
    const carried = cursedObject(CLUB, 'c');
    game.inventory = [worn, loadstone, carried];

    await removeCurseEffect({
        source: { otyp: SCR_REMOVE_CURSE },
    });

    assert.equal(worn.cursed, false);
    assert.equal(loadstone.cursed, false);
    assert.equal(carried.cursed, true);
});

test('a blessed remove curse affects the whole pack and ends punishment', async () => {
    freshWeaponArena();
    const carried = cursedObject(CLUB, 'a');
    game.inventory = [carried];

    const ball = {
        otyp: HEAVY_IRON_BALL, oclass: 15, owornmask: W_BALL,
        ox: game.u.ux, oy: game.u.uy,
    };
    const chain = {
        otyp: IRON_CHAIN, oclass: 16, owornmask: W_CHAIN,
        ox: game.u.ux, oy: game.u.uy,
    };
    place_object(ball, game.u.ux, game.u.uy);
    place_object(chain, game.u.ux, game.u.uy);
    game.uball = game.u.uball = ball;
    game.uchain = game.u.uchain = chain;
    game.u.punished = true;

    await removeCurseEffect({
        source: { otyp: SCR_REMOVE_CURSE, blessed: true },
    });

    const pile = game.level.objects[game.u.ux][game.u.uy];
    assert.equal(carried.cursed, false);
    assert.equal(game.u.punished, false);
    assert.equal(pile.includes(ball), true);
    assert.equal(pile.includes(chain), false);
});

test('confused remove curse leaves existing curses and punishment in place', async () => {
    freshWeaponArena();
    const worn = cursedObject(CLUB, 'a', {
        owornmask: W_ARM, bknown: true,
    });
    game.inventory = [worn];
    game.u.punished = true;
    game.uball = game.u.uball = { owornmask: W_BALL };

    await removeCurseEffect({
        source: { otyp: SCR_REMOVE_CURSE }, confused: true,
    });

    assert.equal(worn.cursed, true);
    assert.equal(worn.bknown, false);
    assert.equal(game.u.punished, true);
});

test('remove curse also frees a steed from its cursed saddle', async () => {
    freshWeaponArena();
    const saddle = cursedObject(CLUB, 'a', {
        owornmask: W_SADDLE, bknown: true,
    });
    game.u.usteed = { minvent: [saddle] };
    const messages = [];

    await removeCurseEffect({
        source: { otyp: SCR_REMOVE_CURSE },
        publish: async message => messages.push(message),
    });

    assert.equal(saddle.cursed, false);
    assert.equal(saddle.bknown, true);
    assert.equal(messages.at(-1), 'The saddle glows amber.');
});
