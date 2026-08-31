import test from 'node:test';
import assert from 'node:assert/strict';

import { continueCountedCommand, rhack } from '../js/cmd.js';
import { W_WEP } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { CHEST, DAGGER } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { freshWeaponArena } from './support/weapon-arena.js';

test('a blade can break while prying a chest lock', async () => {
    const level = freshWeaponArena();
    const dagger = {
        otyp: DAGGER,
        oclass: 2,
        name: 'dagger',
        invlet: 'a',
        quan: 1,
        quantity: 1,
        spe: 0,
        cursed: false,
        wielded: true,
        owornmask: W_WEP,
        where: 'inventory',
    };
    const chest = {
        otyp: CHEST,
        oclass: 6,
        name: 'chest',
        ox: 10,
        oy: 10,
        olocked: true,
        obroken: false,
        contents: [],
        where: 'floor',
    };
    level.objects[10] = [];
    level.objects[10][10] = [chest];
    game.inventory = [dagger];
    game.uwep = game.u.uwep = dagger;
    initRng(46n);
    pushKeys('force\ny');

    await rhack('#'.charCodeAt(0));
    await continueCountedCommand(game);

    assert.equal(game.inventory.includes(dagger), false);
    assert.equal(game.uwep, null);
    assert.match(game._pending_message, /Your dagger broke!.*give up/);
});
