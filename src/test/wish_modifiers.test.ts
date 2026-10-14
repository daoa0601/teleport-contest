import assert from 'node:assert/strict';
import test from 'node:test';

import { game } from '../js/gstate.js';
import { inventoryItemDescription } from '../js/invent.js';
import { ARROW, CHEST, FOOD_RATION, POT_HEALING, TOWEL, WAX_CANDLE, WAN_NOTHING } from '../js/object_data.js';
import { observeObjectForNaming, readObjectName } from '../js/objnam.js';
import { freshObjectRoom } from './support/object-room.js';

async function wish(request: string) {
    const result = await readObjectName(request, { wizardWish: true });
    assert.ok(result && !result.noWish, `Wish was rejected: ${request}`);
    return result.object;
}

void test('a wished chest can be empty, locked, and trapped', async () => {
    freshObjectRoom();

    const chest = await wish('empty locked trapped chest');

    assert.equal(chest.otyp, CHEST);
    assert.equal(chest.contents?.length ?? 0, 0);
    assert.equal(chest.olocked, true);
    assert.equal(chest.otrapped, true);
});

void test('a broken lock removes a wished box trap', async () => {
    freshObjectRoom();

    const chest = await wish('trapped broken chest');

    assert.equal(chest.obroken, true);
    assert.equal(chest.olocked, false);
    assert.equal(chest.otrapped, false);
});

void test('a poison modifier applies to the requested arrows', async () => {
    freshObjectRoom();

    const arrows = await wish('20 poisoned arrows');

    assert.equal(arrows.otyp, ARROW);
    assert.equal(!!arrows.opoisoned, true);
});

void test('a partly eaten wish supplies half the food nutrition', async () => {
    freshObjectRoom();

    const ration = await wish('partly eaten food ration');

    assert.equal(ration.otyp, FOOD_RATION);
    assert.equal(ration.oeaten, 400);
    assert.match(inventoryItemDescription(ration), /partly eaten food ration/);
});

void test('a diluted wish changes the potion and its inventory name', async () => {
    freshObjectRoom();

    const potion = await wish('diluted potion of healing');

    assert.equal(potion.otyp, POT_HEALING);
    assert.equal(potion.odiluted, true);
    observeObjectForNaming(potion);
    assert.match(inventoryItemDescription(potion), /diluted/);
});

void test('a lit candle starts burning with a full supply of fuel', async () => {
    freshObjectRoom();

    const candle = await wish('wax candle (lit)');

    assert.equal(candle.otyp, WAX_CANDLE);
    assert.equal(candle.lamplit, true);
    assert.ok(candle.objectTimers?.some(timer => timer.kind === 'burn-object'));
    const description = inventoryItemDescription(candle);
    assert.match(description, /\(lit\)/);
    assert.doesNotMatch(description, /partly used/);
});

void test('a wet towel wish selects native wetness and shows it in inventory', async () => {
    freshObjectRoom();

    const towel = await wish('wet towel');

    assert.equal(towel.otyp, TOWEL);
    assert.ok(towel.spe >= 3 && towel.spe <= 5);
    assert.match(inventoryItemDescription(towel), /wet towel/);
});

void test('pair wording doubles a count of stackable objects', async () => {
    freshObjectRoom();

    assert.equal((await wish('3 pair of arrows')).quan, 6);
});

void test('only an unmodified nothing request declines a wish', async () => {
    freshObjectRoom();

    const wand = await wish('blessed nothing');

    assert.equal(wand.otyp, WAN_NOTHING);
    assert.equal(wand.blessed, true);
    assert.equal(game.inventory.length, 0);
});
