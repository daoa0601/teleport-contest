import test from 'node:test';
import assert from 'node:assert/strict';

import { carriedGold, containedGold, hiddenGold } from '../js/gold.js';
import { game, resetGame } from '../js/gstate.js';
import { goldInsightLines } from '../js/insight.js';
import { runSegment } from '../js/jsmain.js';
import { A_CHA, A_CON, A_DEX, A_INT, A_STR, A_WIS } from '../js/const.js';
import {
    BAG_OF_HOLDING, GOLD_PIECE, SACK, SPLINT_MAIL,
} from '../js/object_data.js';
import { races, roles } from '../js/roles.js';
import {
    uInitCarryAttrBoost, uInitInventoryAttrs,
} from '../js/u_init.js';
import {
    inventoryWeight, invWeight, objectWeight, weightCapacity,
} from '../js/weight.js';
import { prepareHeroStartup } from './support/startup.js';


function coin(quantity) {
    return { otyp: GOLD_PIECE, oclass: 12, quan: quantity };
}

test('contained gold respects knowledge at every enclosing boundary', () => {
    const unknownNested = {
        otyp: SACK, cknown: false, contents: [coin(60)],
    };
    const knownNested = {
        otyp: SACK, cknown: true, contents: [coin(70)],
    };
    const top = {
        otyp: SACK, cknown: false,
        contents: [coin(40), unknownNested, knownNested],
    };
    const state = { _goldCount: 30, inventory: [top] };

    assert.equal(containedGold(top, true), 170);
    assert.equal(hiddenGold(state, true), 170);
    assert.equal(hiddenGold(state, false), 0);
    top.cknown = true;
    assert.equal(hiddenGold(state, false), 110);
    assert.equal(carriedGold(state, true), 200);
    assert.equal(carriedGold(state, false), 140);
});

test('gold insight hides unknown containers until final disclosure', () => {
    resetGame();
    game._goldCount = 0;
    game.inventory = [{
        otyp: SACK, cknown: false, contents: [coin(60)],
    }];
    assert.deepEqual(goldInsightLines(false), [
        '  Your wallet is empty.',
    ]);
    assert.deepEqual(goldInsightLines(true), [
        '  Your wallet was empty, but',
        '  you had 60 zorkmids stashed away in your pack.',
    ]);
    game.inventory[0].cknown = true;
    game._goldCount = 30;
    assert.deepEqual(goldInsightLines(false), [
        '  Your wallet contains 30 zorkmids, and',
        '  you have 60 more stashed away in your pack.',
    ]);
});

test('container weight recursively owns coins and bag-of-holding status', () => {
    const nested = {
        otyp: SACK, oclass: 6, contents: [coin(100)],
    };
    const sack = {
        otyp: SACK, oclass: 6, contents: [coin(1), nested],
    };
    assert.equal(objectWeight(nested), 16);
    assert.equal(objectWeight(sack), 32);
    assert.equal(inventoryWeight({ inventory: [sack] }), 32);

    const contents = [coin(1000), {
        otyp: SPLINT_MAIL, oclass: 3, quan: 1,
    }];
    assert.equal(objectWeight({
        otyp: BAG_OF_HOLDING, oclass: 6, contents,
    }), 220);
    assert.equal(objectWeight({
        otyp: BAG_OF_HOLDING, oclass: 6, contents, blessed: true,
    }), 118);
    assert.equal(objectWeight({
        otyp: BAG_OF_HOLDING, oclass: 6, contents, cursed: true,
    }), 835);
});

function carryState({ strength, constitution, strengthMax = 18,
    constitutionMax = 18, inventory }) {
    const current = Array(6).fill(10);
    current[A_STR] = strength;
    current[A_CON] = constitution;
    const maximum = current.slice();
    const limits = Array(6).fill(18);
    limits[A_STR] = strengthMax;
    limits[A_CON] = constitutionMax;
    return {
        urace: { attrmax: limits },
        u: {
            acurr: { a: current },
            amax: { a: maximum },
        },
        inventory,
        _goldCount: 0,
    };
}

test('startup carry boost exhausts Strength before Constitution', () => {
    const suit = { otyp: SPLINT_MAIL, oclass: 3, quan: 1 };
    const strengthState = carryState({
        strength: 3, constitution: 3, inventory: [suit],
    });
    assert.equal(inventoryWeight(strengthState), 400);
    assert.equal(weightCapacity(strengthState), 200);
    assert.deepEqual(uInitCarryAttrBoost(strengthState), {
        strength: 8, constitution: 0, excess: 0,
    });
    assert.equal(strengthState.u.acurr.a[A_STR], 11);
    assert.equal(strengthState.u.acurr.a[A_CON], 3);
    assert.equal(strengthState.u.amax.a[A_STR], 11);
    assert.equal(strengthState.u.amax.a[A_CON], 3);

    const constitutionState = carryState({
        strength: 18, constitution: 3,
        inventory: [suit, { ...suit }],
    });
    assert.deepEqual(uInitCarryAttrBoost(constitutionState), {
        strength: 0, constitution: 9, excess: 0,
    });
    assert.equal(constitutionState.u.acurr.a[A_STR], 18);
    assert.equal(constitutionState.u.acurr.a[A_CON], 12);
});

test('startup keeps each attribute under its C attribute name', () => {
    const attributes = [10, 11, 12, 13, 14, 15];
    const role = {
        ...roles.find(role => role.key === 'priest'),
        attrbase: attributes,
        attrdist: [100, 0, 0, 0, 0, 0],
    };
    const race = {
        ...races.find(race => race.name === 'human'),
        attrmin: attributes,
        attrmax: attributes,
    };
    prepareHeroStartup({
        role, race, alignment: 'neutral', seed: 124n,
    });

    assert.equal(uInitInventoryAttrs(), true);
    assert.equal(game.u.acurr.a[A_STR], 10);
    assert.equal(game.u.acurr.a[A_INT], 11);
    assert.equal(game.u.acurr.a[A_WIS], 12);
    assert.equal(game.u.acurr.a[A_DEX], 13);
    assert.equal(game.u.acurr.a[A_CON], 14);
    assert.equal(game.u.acurr.a[A_CHA], 15);
});

test('startup carry boost stops honestly when both attributes are capped', () => {
    const state = carryState({
        strength: 18, constitution: 18,
        inventory: Array.from({ length: 3 }, () => ({
            otyp: SPLINT_MAIL, oclass: 3, quan: 1,
        })),
    });
    const before = invWeight(state);
    assert.ok(before > 0);
    assert.deepEqual(uInitCarryAttrBoost(state), {
        strength: 0, constitution: 0, excess: before,
    });
});

test('all role startups leave source bookkeeping and capacity coherent', () => {
    for (const role of roles) {
        prepareHeroStartup({ role, alignment: 'neutral' });
        assert.equal(uInitInventoryAttrs(), true, role.key);
        assert.ok(invWeight(game) <= 0, role.key);
        assert.equal(
            game._initialGoldCount,
            (game._goldCount || 0) + hiddenGold(game, true),
            role.key,
        );
    }
});

test('fresh carry startup reaches a live turn with zero bridges', async () => {
    const result = await runSegment({
        seed: 8201,
        datetime: '20260829135000',
        nethackrc: [
            'OPTIONS=name:Carrier,role:Tourist,race:human,gender:male,align:neutral',
            'OPTIONS=!autopickup,!legacy,!tutorial,pettype:none',
        ].join('\n'),
        moves: '.',
        storage: new Map(),
    });

    assert.ok(result.getScreens().length > 0);
    assert.ok(invWeight(game) <= 0);
    assert.equal(
        game._initialGoldCount,
        (game._goldCount || 0) + hiddenGold(game, true),
    );
});
