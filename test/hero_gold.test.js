import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { W_QUIVER } from '../js/const.js';
import { game } from '../js/gstate.js';
import { GameDisplay } from '../js/game_display.js';
import {
    addHeroGoldObject, heroGoldAmount, heroGoldObject,
} from '../js/hero_gold.js';
import { pushKey } from '../js/input.js';
import { mkgold, mksobj } from '../js/mklev.js';
import { GOLD_PIECE, SACK } from '../js/object_data.js';
import { settleCarriedShopBillItem } from '../js/shk.js';
import { freshWeaponArena } from './support/weapon-arena.js';

process.env.TELEPORT_BRIDGE_FREE = '1';
process.env.TELEPORT_DISABLE_FIXTURES = '1';

function carriedGold(amount, id = null) {
    const gold = mksobj(GOLD_PIECE, false, false);
    gold.quan = gold.quantity = amount;
    if (id !== null) gold.o_id = id;
    addHeroGoldObject(game, gold);
    return gold;
}

function completeFloorObjects(level) {
    return (level.objects || []).flatMap(column =>
        (column || []).flatMap(pile => pile || []));
}

test('picking up floor gold moves that identity into the dollar inventory slot',
    async () => {
        freshWeaponArena();
        const floorGold = mkgold(37, game.u.ux, game.u.uy);

        await rhack(','.charCodeAt(0));

        assert.equal(heroGoldObject(game), floorGold);
        assert.equal(heroGoldAmount(game), 37);
        assert.equal(floorGold.invlet, '$');
        assert.equal(floorGold.where, 'inventory');
        assert.equal(game._goldCount, 37);
    });

test('picking up more gold merges to one live purse identity', async () => {
    freshWeaponArena();
    const purse = carriedGold(11, 28300);
    const floorGold = mkgold(7, game.u.ux, game.u.uy);

    await rhack(','.charCodeAt(0));

    assert.equal(heroGoldObject(game), purse);
    assert.equal(heroGoldAmount(game), 18);
    assert.equal(game.inventory.filter(object =>
        object.otyp === GOLD_PIECE).length, 1);
    assert.equal(floorGold.where, 'gone');
    assert.equal(floorGold.quantity, 0);
    assert.equal(game._goldCount, 18);
    assert.equal(game.context.move, 1);
});

test('dropping the purse moves the same identity to the floor', async () => {
    const level = freshWeaponArena();
    const purse = carriedGold(19, 28301);

    pushKey('$');
    await rhack('d'.charCodeAt(0));

    assert.equal(heroGoldObject(game), null);
    assert.equal(heroGoldAmount(game), 0);
    assert.equal(game._goldCount, 0);
    assert.ok(completeFloorObjects(level).includes(purse));
    assert.equal(purse.where, 'floor');
    assert.equal(purse.quantity, 19);
    assert.equal(game.context.move, 1);
});

test('a counted quiver request cannot split the purse', async () => {
    freshWeaponArena();
    const purse = carriedGold(5, 28302);

    pushKey('2');
    pushKey('$');
    await rhack('Q'.charCodeAt(0));

    assert.equal(heroGoldObject(game), purse);
    assert.equal(heroGoldAmount(game), 5);
    assert.equal(game.uquiver, null);
    assert.equal(purse.quantity, 5);
    assert.equal(game.inventory.length, 1);
    assert.equal(game.context.move, 0);
});

test('quivered gold detaches one coin while preserving the purse identity',
    async () => {
        const level = freshWeaponArena();
        const purse = carriedGold(5, 28303);

        pushKey('$');
        await rhack('Q'.charCodeAt(0));
        assert.equal(game.uquiver, purse);
        assert.equal((purse.owornmask & W_QUIVER) !== 0, true);

        pushKey('l');
        await rhack('f'.charCodeAt(0));

        const landed = completeFloorObjects(level).filter(object =>
            object.otyp === GOLD_PIECE);
        assert.equal(heroGoldObject(game), purse);
        assert.equal(heroGoldAmount(game), 4);
        assert.equal(game._goldCount, 4);
        assert.equal(game.uquiver, purse);
        assert.equal(purse.quantity, 4);
        assert.equal(landed.length, 1);
        assert.notEqual(landed[0], purse);
        assert.notEqual(landed[0].o_id, purse.o_id);
        assert.equal(landed[0].quantity, 1);
        assert.equal(game.context.move, 1);
    });

test('putting gold into a bag and taking it out moves the same identity',
    async () => {
        freshWeaponArena();
        game.nhDisplay = new GameDisplay(null);
        const purse = carriedGold(23, 28304);
        const bag = {
            otyp: SACK, oclass: 6, invlet: 'a',
            name: 'bag', plural: 'bags', where: 'inventory',
            quan: 1, quantity: 1, contents: [], cknown: false,
            worn: false, wielded: false, alternate: false, ready: false,
            owornmask: 0, objectTimers: [], timed: 0,
        };
        game.inventory.push(bag);

        pushKey('a');
        pushKey('i');
        pushKey('b');
        pushKey(13);
        pushKey('$');
        pushKey(13);
        await rhack('a'.charCodeAt(0));

        assert.equal(heroGoldObject(game), null);
        assert.equal(heroGoldAmount(game), 0);
        assert.equal(bag.contents.includes(purse), true);
        assert.equal(purse.where, 'contained');
        assert.equal(purse.container, bag);

        pushKey('a');
        pushKey('o');
        pushKey('$');
        pushKey(13);
        await rhack('a'.charCodeAt(0));

        assert.equal(heroGoldObject(game), purse);
        assert.equal(heroGoldAmount(game), 23);
        assert.equal(bag.contents.includes(purse), false);
        assert.equal(purse.where, 'inventory');
        assert.equal(purse.container, null);
    });

test('partial shop payment preserves the purse identity and exact remainder',
    () => {
        freshWeaponArena();
        const purse = carriedGold(20, 28305);
        const merchandise = {
            o_id: 28306, otyp: SACK, quan: 1, quantity: 1, unpaid: true,
        };
        game.inventory.push(merchandise);
        const entry = { bo_id: merchandise.o_id, price: 7, bquan: 1 };
        const resident = {
            gold: 0,
            eshk: { bill: [entry], billct: 1 },
        };

        assert.equal(settleCarriedShopBillItem(resident, {
            entry, object: merchandise, price: 7,
        }, game), true);

        assert.equal(heroGoldObject(game), purse);
        assert.equal(heroGoldAmount(game), 13);
        assert.equal(purse.quantity, 13);
        assert.equal(game._goldCount, 13);
        assert.equal(resident.gold, 7);
        assert.equal(merchandise.unpaid, false);
        assert.equal(resident.eshk.bill.length, 0);
    });
