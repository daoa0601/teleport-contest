import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { A_CON, A_WIS, ALTAR } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKey, pushKeys } from '../js/input.js';
import {
    APPLE, POT_GAIN_ENERGY, SCR_LIGHT, WAN_POLYMORPH,
} from '../js/object_data.js';
import { vision_recalc, vision_reset_new_level } from '../js/vision.js';
import { dropInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { freshGameplayRoom } from './support/playable-room.js';

const PM_YELLOW_LIGHT = 118;

test('debug wishing creates a live charged polymorph wand', async () => {
    // wiz_wish() adds the requested object without using a turn.
    freshGameplayRoom();
    game.urole = { key: 'wizard' };
    game.flags.debug = true;
    pushKeys('wand of polymorph (0:30)\n');

    await rhack(23); // Ctrl-W

    const wand = game.inventory.find(object => object.otyp === WAN_POLYMORPH);
    assert.ok(wand);
    assert.equal(wand.spe, 30);
    assert.equal(game.u.uconduct.wishes, 1);
    assert.equal(game.context.move, 0);
});

test('an invalid wish can be replaced by a valid wish', async () => {
    freshGameplayRoom();
    game.flags.debug = true;
    pushKeys('not a NetHack object\napple\n');

    await rhack(23);

    assert.ok(game.inventory.some(object => object.otyp === APPLE));
});

test('a cursed scroll of light darkens the visible area', async () => {
    const level = freshGameplayRoom();
    vision_reset_new_level();
    vision_recalc(0);
    addInventoryObject(SCR_LIGHT, { invlet: 'a', cursed: true });
    pushKey('a');
    pushKey(' ');

    await rhack('r'.charCodeAt(0));

    assert.equal(level.at(11, 10).lit, false);
});

test('reading a magical scroll exercises Wisdom', async () => {
    freshGameplayRoom();
    game.u.acurr.a[A_WIS] = 3;
    game.u.acurr.a[A_CON] = 3;
    addInventoryObject(SCR_LIGHT, { invlet: 'a' });
    pushKey('a');
    pushKey(' ');

    await rhack('r'.charCodeAt(0));

    assert.deepEqual({
        wisdom: game.u._exercise[A_WIS],
        constitution: game.u._exercise[A_CON],
    }, { wisdom: 2, constitution: 0 });
});

test('a confused scroll of light creates harmless tame lights', async () => {
    const level = freshGameplayRoom();
    game.u.confusionTurns = 5;
    addInventoryObject(SCR_LIGHT, { invlet: 'a' });
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
        freshGameplayRoom();
        game.urole = { key: 'wizard' };
        game.u.uen = game.u.uenmax = game.u.uenpeak = 1;
        const potion = addInventoryObject(POT_GAIN_ENERGY, { invlet: 'a' });
        pushKey('a');

        await rhack('q'.charCodeAt(0));

        assert.equal(game.inventory.includes(potion), false);
        assert.ok(game.u.uenmax > 1);
        assert.ok(game.u.uen > 1);
        assert.equal(game.context.move, 1);
    });

test('dropping a cursed item on an altar reveals its curse', async () => {
    const level = freshObjectRoom();
    level.at(game.u.ux, game.u.uy).typ = ALTAR;
    const potion = addInventoryObject(POT_GAIN_ENERGY, {
        invlet: 'a',
        cursed: true,
        bknown: false,
        typeKnown: true,
    });

    await dropInventoryObject(potion);

    assert.equal(potion.bknown, true);
    assert.equal(game.u.uconduct.gnostic, 1);
});
