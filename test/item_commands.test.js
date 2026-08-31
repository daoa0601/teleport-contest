import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { pushKey, pushKeys } from '../js/input.js';
import { APPLE, POT_GAIN_ENERGY, WAN_POLYMORPH } from '../js/object_data.js';
import { freshWeaponArena } from './support/weapon-arena.js';

test('debug wishing creates a live charged polymorph wand', async () => {
    // Pinned wizcmds.c:wiz_wish() delegates to makewish().  The committed
    // line must create and carry a real object while leaving command time at
    // zero; a screen painter cannot satisfy the inventory transaction.
    freshWeaponArena();
    game.urole = { key: 'wizard' };
    game.flags.debug = true;
    pushKeys('wand of polymorph (0:30)\n');

    await rhack(23); // Ctrl-W

    const wand = game.inventory.find(object => object.otyp === WAN_POLYMORPH);
    assert.ok(wand);
    assert.equal(wand.charges.current, 30);
    assert.equal(wand.spe, 30);
    assert.equal(game.u.uconduct.wishes, 1);
    assert.equal(game.context.move, 0);
});

test('an invalid wish can be replaced by a valid wish', async () => {
    freshWeaponArena();
    game.flags.debug = true;
    pushKeys('not a NetHack object\napple\n');

    await rhack(23);

    assert.ok(game.inventory.some(object => object.otyp === APPLE));
});

test('quaffing commits a potion effect, consumption, and elapsed action',
    async () => {
        // Pinned potion.c:dodrink()/dopotion() select one carried identity,
        // apply its state transition, use it up, and return ECMD_TIME.
        freshWeaponArena();
        game.urole = { key: 'wizard' };
        game.u.uen = game.u.uenmax = game.u.uenpeak = 1;
        const potion = {
            otyp: POT_GAIN_ENERGY,
            invlet: 'a',
            name: 'potion of gain energy',
            plural: 'potions of gain energy',
            class: 'Potions',
            oclass: 8,
            quan: 1,
            quantity: 1,
            where: 'inventory',
            cursed: false,
            blessed: false,
            bknown: true,
            dknown: true,
        };
        game.inventory = [potion];
        pushKey('a');

        await rhack('q'.charCodeAt(0));

        assert.equal(game.inventory.includes(potion), false);
        assert.ok(game.u.uenmax > 1);
        assert.ok(game.u.uen > 1);
        assert.equal(game.context.move, 1);
    });
