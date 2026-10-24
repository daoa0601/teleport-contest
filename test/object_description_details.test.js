import test from 'node:test';
import assert from 'node:assert/strict';
import { CORPSTAT_FEMALE, CORPSTAT_MALE, CORPSTAT_NEUTER, CORPSTAT_RANDOM, MV_KNOWS_EGG, NON_PM, NO_MINVENT, } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { game } from '../js/gstate.js';
import { inventoryItemDescription } from '../js/invent.js';
import { beginObjectBurn, endObjectBurn } from '../js/light.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { BRASS_LANTERN, CANDELABRUM_OF_INVOCATION, EGG, FIGURINE, FOOD_RATION, LEASH, MAGIC_LAMP, MAGIC_MARKER, OBJECT_NUTRITION, OIL_LAMP, POT_OIL, TALLOW_CANDLE, UNICORN_HORN, WAN_FIRE, WAX_CANDLE, } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt, requireMonsterVital } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a leash names its attached pet even when that pet is invisible', async () => {
    freshObjectRoom();
    const pet = await createMonsterAt('little dog', 11, 10, NO_MINVENT);
    initializePet(pet, { state: game });
    pet.minvis = true;
    pet.mleashed = 1;
    const leash = await knownObject(LEASH, { bknown: false, leashmon: pet.m_id });
    assert.equal(inventoryItemDescription(leash), 'a leash (attached to your invisible little dog)');
    assert.equal(leash.leashmon, pet.m_id);
});
for (const { count, lit, suffix } of [
    { count: 0, lit: false, suffix: '(0 of 7 candles attached)' },
    { count: 1, lit: false, suffix: '(1 of 7 candle attached)' },
    { count: 7, lit: true, suffix: '(7 of 7 candles, lit)' },
]) {
    void test(`the candelabrum shows ${suffix}`, async () => {
        freshObjectRoom();
        const candelabrum = await knownObject(CANDELABRUM_OF_INVOCATION, {
            bknown: false, known: false, spe: count, age: 200,
        });
        if (lit)
            assert.equal(beginObjectBurn(candelabrum), true);
        const description = inventoryItemDescription(candelabrum);
        assert.ok(description.endsWith(` ${suffix}`), description);
        assert.doesNotMatch(description, /\(\d+:-?\d+\)/);
    });
}
for (const [type, name] of [[TALLOW_CANDLE, 'tallow'], [WAX_CANDLE, 'wax']]) {
    void test(`a fresh ${name} candle counts scheduled burn time before becoming partly used`, async () => {
        freshObjectRoom();
        const candle = await knownObject(type, { bknown: false });
        assert.equal(beginObjectBurn(candle), true);
        const fresh = inventoryItemDescription(candle);
        assert.match(fresh, /candle \(lit\)$/);
        assert.doesNotMatch(fresh, /partly used/);
        game.moves++;
        assert.match(inventoryItemDescription(candle), /partly used .*candle \(lit\)$/);
        assert.equal(endObjectBurn(candle), true);
        const extinguished = inventoryItemDescription(candle);
        assert.match(extinguished, /partly used .*candle$/);
        assert.doesNotMatch(extinguished, /\(lit\)/);
    });
}
for (const [type, name] of [
    [OIL_LAMP, 'oil lamp'], [MAGIC_LAMP, 'magic lamp'],
    [BRASS_LANTERN, 'brass lantern'], [POT_OIL, 'potion of oil'],
]) {
    void test(`a burning ${name} shows its light without a charge suffix`, async () => {
        freshObjectRoom();
        const light = await knownObject(type, { bknown: false, spe: 1, age: 400 });
        assert.equal(beginObjectBurn(light), true);
        const burning = inventoryItemDescription(light);
        assert.match(burning, / \(lit\)$/);
        assert.doesNotMatch(burning, /\(\d+:-?\d+\)/);
        assert.equal(endObjectBurn(light), true);
        assert.doesNotMatch(inventoryItemDescription(light), /\(lit\)/);
    });
}
for (const [type, name] of [[WAN_FIRE, 'wand'], [MAGIC_MARKER, 'marker']]) {
    void test(`a ${name} shows recharge count and charges only when identified`, async () => {
        freshObjectRoom();
        const object = await knownObject(type, {
            bknown: false, known: false, recharged: 2, spe: 9,
        });
        assert.doesNotMatch(inventoryItemDescription(object), /\(2:9\)/);
        game.iflags.override_ID = true;
        assert.match(inventoryItemDescription(object), / \(2:9\)$/);
        assert.equal(object.known, false, 'Identification override must not identify the actual object');
    });
}
void test('a weapon-tool displays enchantment instead of charges', async () => {
    freshObjectRoom();
    const horn = await knownObject(UNICORN_HORN, { bknown: false, recharged: 1, spe: 2 });
    const description = inventoryItemDescription(horn);
    assert.match(description, /\+2 unicorn horn/);
    assert.doesNotMatch(description, /\(1:2\)/);
});
void test('a started meal is partly eaten even before its first nutrition is consumed', async () => {
    freshObjectRoom();
    const nutrition = OBJECT_NUTRITION[FOOD_RATION];
    assert.ok(nutrition !== undefined && nutrition > 0);
    const ration = await knownObject(FOOD_RATION, { bknown: false, oeaten: nutrition });
    assert.equal(inventoryItemDescription(ration), 'a partly eaten food ration');
});
void test('an egg reveals its origin when its species becomes known', async () => {
    freshObjectRoom();
    const species = MONSTER_NAME.indexOf('cockatrice');
    const egg = await knownObject(EGG, {
        initialize: false, bknown: false, known: false, corpsenm: species, spe: 1,
    });
    assert.doesNotMatch(inventoryItemDescription(egg), /laid by you/);
    requireMonsterVital(species).mvflags |= MV_KNOWS_EGG;
    assert.match(inventoryItemDescription(egg), /cockatrice egg \(laid by you\)$/);
});
void test('egg origin requires a real species and the laid-by-you flag', async () => {
    freshObjectRoom();
    const ordinary = await knownObject(EGG, { bknown: false, corpsenm: NON_PM, spe: 1 });
    const found = await knownObject(EGG, {
        bknown: false, corpsenm: MONSTER_NAME.indexOf('cockatrice'), spe: 0,
    });
    assert.doesNotMatch(inventoryItemDescription(ordinary), /laid by you/);
    assert.doesNotMatch(inventoryItemDescription(found), /laid by you/);
});
for (const [gender, label] of [
    [CORPSTAT_RANDOM, 'unspecified gender'], [CORPSTAT_MALE, 'male'],
    [CORPSTAT_FEMALE, 'female'], [CORPSTAT_NEUTER, 'neuter'],
]) {
    void test(`wizard gender display reports ${label} only when requested`, async () => {
        freshObjectRoom();
        const figurine = await knownObject(FIGURINE, {
            bknown: false, corpsenm: MONSTER_NAME.indexOf('little dog'), spe: gender,
        });
        game.iflags.wizmgender = true;
        assert.equal(inventoryItemDescription(figurine).endsWith(` (${label})`), false);
        game.flags.debug = true;
        const description = inventoryItemDescription(figurine);
        assert.ok(description.endsWith(` (${label})`), description);
        game.iflags.wizmgender = false;
        assert.equal(inventoryItemDescription(figurine).endsWith(` (${label})`), false);
    });
}
//# sourceMappingURL=object_description_details.test.js.map