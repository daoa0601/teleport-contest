import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { ALTAR, Align2amask, FOUNTAIN, THRONE } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import {
    CLUB, CREAM_PIE, WHITE_DRAGON_SCALE_MAIL,
} from '../js/object_data.js';
import { attrcurse, rndcurse } from '../js/throne.js';
import { applyArmorOnEffects } from '../js/armor.js';
import {
    grantIntrinsicProperty, hasIntrinsicProperty,
} from '../js/properties.js';
import { initRng } from '../js/rng.js';
import { heroGoldAmount, setHeroGoldAmount } from '../js/hero_gold.js';
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

test('a throne can take all carried gold', async () => {
    const level = freshWeaponArena();
    level.at(10, 10).typ = THRONE;
    setHeroGoldAmount(game, 250);
    initRng(125n);
    pushKeys('sit\n');

    await rhack('#'.charCodeAt(0));

    assert.equal(heroGoldAmount(game), 0);
});

test("Vlad's throne greases carried equipment", async () => {
    const level = freshWeaponArena();
    level.at(10, 10).typ = THRONE;
    game.u.uz = { dnum: 0, dlevel: 1 };
    game.dungeons = [{ dname: "Vlad's Tower" }];
    const club = inventoryObject(CLUB, 'a');
    game.inventory = [club];
    initRng(21n);
    pushKeys('sit\n');

    await rhack('#'.charCodeAt(0));

    assert.equal(club.greased, true);
    assert.ok(game.u.glibTurns >= 100 && game.u.glibTurns <= 200);
});

test('a gremlin sitting in water creates a tame clone', async () => {
    const level = freshWeaponArena();
    level.at(10, 10).typ = FOUNTAIN;
    game.plname = 'Splitter';
    game.mvitals = [];
    Object.assign(game.u, {
        umonster: 331,
        umonnum: 40,
        mtimedone: 300,
        mh: 17,
        mhmax: 17,
    });
    initRng(3510n);
    pushKeys('sit\n');

    await rhack('#'.charCodeAt(0));

    assert.ok(level.monsters.some(monster =>
        monster.mnum === 40 && monster.mtame > 0));
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
