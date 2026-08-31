import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { ALTAR, Align2amask } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import {
    CLUB, CREAM_PIE, WHITE_DRAGON_SCALE_MAIL,
} from '../js/object_data.js';
import { attrcurse, rndcurse } from '../js/sit.js';
import { applyArmorOnEffects } from '../js/armor.js';
import {
    grantIntrinsicProperty, hasIntrinsicProperty,
} from '../js/properties.js';
import { initRng } from '../js/rng.js';
import {
    freshWeaponArena, inventoryObject,
} from './support/weapon-arena.js';

test('sitting on cream pies crushes the whole floor stack', async () => {
    const level = freshWeaponArena();
    const pies = {
        otyp: CREAM_PIE,
        oclass: 7,
        name: 'cream pie',
        plural: 'cream pies',
        quan: 2,
        quantity: 2,
        ox: 10,
        oy: 10,
        where: 'floor',
    };
    level.objects[10] = [];
    level.objects[10][10] = [pies];
    pushKeys('sit\n');

    await rhack('#'.charCodeAt(0));

    assert.equal(level.objects[10][10].includes(pies), false);
    assert.match(game._pending_message, /Squelch!/);
});

test('sitting on your own altar costs Wisdom and alignment', async () => {
    const level = freshWeaponArena();
    level.at(10, 10).typ = ALTAR;
    level.at(10, 10).flags = Align2amask(game.u.ualign.type);
    game.u.amax = { a: [...game.u.acurr.a] };
    pushKeys('sit\n ');

    await rhack('#'.charCodeAt(0));

    assert.equal(game.u.acurr.a[2], 9);
    assert.equal(game.u.ualign.record, 9);
});

test('a malignant aura curses an ordinary inventory item', async () => {
    freshWeaponArena();
    const club = inventoryObject(CLUB, 'a');
    game.inventory = [club];

    await rndcurse();

    assert.equal(club.cursed, true);
    assert.equal(club.buc, 'cursed');
});

test('an attribute curse removes intrinsic but not worn resistance', async () => {
    freshWeaponArena();
    const armor = {
        otyp: WHITE_DRAGON_SCALE_MAIL,
        o_id: 42,
        worn: true,
    };
    game.inventory = [armor];
    game.uarm = armor;
    grantIntrinsicProperty('coldResistance', 'race', game);
    applyArmorOnEffects(armor, game);
    initRng(15n);

    await attrcurse();

    assert.equal(hasIntrinsicProperty('coldResistance', null, game), false);
    assert.equal(game.u.coldResistance, true);
});
