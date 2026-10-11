import type { GameObject } from '../js/object_types.js';
import type { AttributeValues, Role, Race } from '../js/roles.js';
import { uninitializedObject } from './support/game-objects.js';
import { addCreatedObjectToContainer } from '../js/object_container.js';
import { requirePlayingGame } from '../js/gstate.js';
import { memoryStorage } from './support/memory-storage.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { carriedGold, containedGold, hiddenGold } from '../js/gold.js';
import { game } from '../js/gstate.js';
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
import { freshGame } from './support/game-state.js';
import { prepareHeroStartup } from './support/startup.js';
import { initRng } from '../js/rng.js';

test.beforeEach(() => {
    freshGame();
    initRng(1n);
});


async function coin(quantity: number) {
    return uninitializedObject(GOLD_PIECE, { quan: quantity });
}

async function container(type: number, contents: GameObject[], properties: Partial<GameObject> = {}) {
    const bag = await uninitializedObject(type, properties);
    for (const object of contents) await addCreatedObjectToContainer(bag, object);
    return bag;
}

void test('contained gold respects knowledge at every enclosing boundary', async () => {
    const unknownNested = await container(SACK, [await coin(60)], { cknown: false });
    const knownNested = await container(SACK, [await coin(70)], { cknown: true });
    const top = await container(SACK, [await coin(40), unknownNested, knownNested], { cknown: false });
    const state = freshGame({ inventory: [await coin(30), top] });

    assert.equal(containedGold(top, true), 170);
    assert.equal(hiddenGold(state, true), 170);
    assert.equal(hiddenGold(state, false), 0);
    top.cknown = true;
    assert.equal(hiddenGold(state, false), 110);
    assert.equal(carriedGold(state, true), 200);
    assert.equal(carriedGold(state, false), 140);
});

void test('gold insight hides unknown containers until final disclosure', async () => {
    const bag = await container(SACK, [await coin(60)], { cknown: false });
    requirePlayingGame(game);
    game.inventory = [bag];
    assert.deepEqual(goldInsightLines(false), [
        '  Your wallet is empty.',
    ]);
    assert.deepEqual(goldInsightLines(true), [
        '  Your wallet was empty, but',
        '  you had 60 zorkmids stashed away in your pack.',
    ]);
    assert.ok(game.inventory[0] != null);
    game.inventory[0].cknown = true;
    game.inventory.unshift(await coin(30));
    assert.deepEqual(goldInsightLines(false), [
        '  Your wallet contains 30 zorkmids, and',
        '  you have 60 more stashed away in your pack.',
    ]);
});

void test('container weight recursively owns coins and bag-of-holding status', async () => {
    const nested = await container(SACK, [await coin(100)]);
    const sack = await container(SACK, [await coin(1), nested]);
    assert.equal(objectWeight(nested), 16);
    assert.equal(objectWeight(sack), 32);
    game.inventory = [sack];
    assert.equal(inventoryWeight(game), 32);

    for (const [properties, weight] of [[{}, 220], [{ blessed: true }, 118], [{ cursed: true }, 835]] as const) {
        const bag = await container(BAG_OF_HOLDING, [await coin(1000), await uninitializedObject(SPLINT_MAIL)], properties);
        assert.equal(objectWeight(bag), weight);
    }
});

function carryState({ strength, constitution, strengthMax = 18,
    constitutionMax = 18, inventory }: { strength: number; constitution: number;
        strengthMax?: number; constitutionMax?: number; inventory: GameObject[] }) {
    const current: AttributeValues = [10, 10, 10, 10, 10, 10];
    current[A_STR] = strength;
    current[A_CON] = constitution;
    const limits: AttributeValues = [18, 18, 18, 18, 18, 18];
    limits[A_STR] = strengthMax;
    limits[A_CON] = constitutionMax;
    const human = races.find(race => race.name === 'human');
    assert.ok(human);
    const state = freshGame({ race: { ...human, attrmax: limits },
        hero: { acurr: { a: current }, amax: { a: [...current] } }, inventory });
    initRng(1n);
    return state;
}

void test('startup carry boost exhausts Strength before Constitution', async () => {
    const suit = await uninitializedObject(SPLINT_MAIL);
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
        inventory: [suit, await uninitializedObject(SPLINT_MAIL)],
    });
    assert.deepEqual(uInitCarryAttrBoost(constitutionState), {
        strength: 0, constitution: 9, excess: 0,
    });
    assert.equal(constitutionState.u.acurr.a[A_STR], 18);
    assert.equal(constitutionState.u.acurr.a[A_CON], 12);
});

void test('startup keeps each attribute under its C attribute name', async () => {
    const attributes: AttributeValues = [10, 11, 12, 13, 14, 15];
    const priest = roles.find(role => role.key === 'priest');
    const human = races.find(race => race.name === 'human');
    assert.ok(priest && human);
    const role: Role = {
        ...priest,
        attrbase: attributes,
        attrdist: [100, 0, 0, 0, 0, 0],
    };
    const race: Race = {
        ...human,
        attrmin: attributes,
        attrmax: attributes,
    };
    prepareHeroStartup({
        role, race, alignment: 'neutral', seed: 124n,
    });

    assert.equal(await uInitInventoryAttrs(), true);
    assert.ok(game.u.acurr != null, 'Expected game.u.acurr to be initialized');
    assert.equal(game.u.acurr.a[A_STR], 10);
    assert.equal(game.u.acurr.a[A_INT], 11);
    assert.equal(game.u.acurr.a[A_WIS], 12);
    assert.equal(game.u.acurr.a[A_DEX], 13);
    assert.equal(game.u.acurr.a[A_CON], 14);
    assert.equal(game.u.acurr.a[A_CHA], 15);
});

void test('startup carry boost stops honestly when both attributes are capped', async () => {
    const state = carryState({
        strength: 18, constitution: 18,
        inventory: await Promise.all(Array.from({ length: 3 }, () => uninitializedObject(SPLINT_MAIL))),
    });
    const before = invWeight(state);
    assert.ok(before > 0);
    assert.deepEqual(uInitCarryAttrBoost(state), {
        strength: 0, constitution: 0, excess: before,
    });
});

void test('all role startups leave source bookkeeping and capacity coherent', async () => {
    for (const role of roles) {
        prepareHeroStartup({ role, alignment: 'neutral' });
        assert.equal(await uInitInventoryAttrs(), true, role.key);
        assert.ok(invWeight(game) <= 0, role.key);
        assert.equal(game._initialGoldCount, carriedGold(game, true), role.key);
    }
});

void test('a fresh Tourist starts within carrying capacity', async () => {
    const result = await runSegment({
        seed: 8201,
        datetime: '20260829135000',
        nethackrc: [
            'OPTIONS=name:Carrier,role:Tourist,race:human,gender:male,align:neutral',
            'OPTIONS=!autopickup,!legacy,!tutorial,pettype:none',
        ].join('\n'),
        moves: '.',
        storage: memoryStorage(),
    });
    requirePlayingGame(game);

    assert.ok(result.getScreens().length > 0);
    assert.ok(invWeight(game) <= 0);
    assert.equal(game._initialGoldCount, carriedGold(game, true));
});
