import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { A_CON, A_WIS } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKey, pushKeys } from '../js/input.js';
import {
    APPLE, POT_GAIN_ENERGY, SCR_LIGHT, WAN_POLYMORPH,
} from '../js/object_data.js';
import { vision_recalc, vision_reset_new_level } from '../js/vision.js';
import { freshWeaponArena } from './support/weapon-arena.js';

const PM_YELLOW_LIGHT = 118;

test('debug wishing creates a live charged polymorph wand', async () => {
    // wiz_wish() adds the requested object without using a turn.
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

test('a cursed scroll of light darkens the visible area', async () => {
    const level = freshWeaponArena();
    vision_reset_new_level();
    vision_recalc(0);
    const scroll = {
        otyp: SCR_LIGHT,
        invlet: 'a',
        name: 'light',
        oclass: 9,
        quan: 1,
        quantity: 1,
        cursed: true,
        dknown: true,
    };
    game.inventory = [scroll];
    pushKey('a');
    pushKey(' ');

    await rhack('r'.charCodeAt(0));

    assert.equal(level.at(11, 10).lit, false);
});

test('reading a magical scroll exercises Wisdom', async () => {
    freshWeaponArena();
    game.u.acurr.a[A_WIS] = 3;
    game.u.acurr.a[A_CON] = 3;
    game.inventory = [{
        otyp: SCR_LIGHT,
        invlet: 'a',
        name: 'light',
        oclass: 9,
        quan: 1,
        quantity: 1,
        dknown: true,
    }];
    pushKey('a');
    pushKey(' ');

    await rhack('r'.charCodeAt(0));

    assert.deepEqual({
        wisdom: game.u._exercise[A_WIS],
        constitution: game.u._exercise[A_CON],
    }, { wisdom: 2, constitution: 0 });
});

test('a confused scroll of light creates harmless tame lights', async () => {
    const level = freshWeaponArena();
    game.u.confusionTurns = 5;
    const scroll = {
        otyp: SCR_LIGHT,
        invlet: 'a',
        name: 'light',
        oclass: 9,
        quan: 1,
        quantity: 1,
        dknown: true,
    };
    game.inventory = [scroll];
    pushKey('a');
    pushKey(' ');

    await rhack('r'.charCodeAt(0));

    assert.ok(level.monsters.length >= 3
        && level.monsters.every(monster =>
            monster.mnum === PM_YELLOW_LIGHT
            && monster.mtame > 0 && monster.mcan));
});

test('quaffing applies the potion, consumes it, and uses a turn',
    async () => {
        // potion.c applies the effect before removing the potion.
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
