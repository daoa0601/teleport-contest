import assert from 'node:assert/strict';
import test from 'node:test';
import { LUCKSTONE, OBJECT_CHARGED, OBJECT_SPELL_CATEGORY, OBJECT_SPELL_LEVEL, POT_POLYMORPH, RIN_POLYMORPH, RIN_POLYMORPH_CONTROL, RIN_POISON_RESISTANCE, SPE_CONFUSE_MONSTER, SPE_FORCE_BOLT, SPE_POLYMORPH, WAN_NOTHING, WAN_POLYMORPH, } from '../js/object_data.js';
import { heroGoldObject } from '../js/hero_gold.js';
import { mksobj } from '../js/mklev.js';
import { addCreatedInventoryItem, uInitInventoryAttrs } from '../js/u_init.js';
import { completeHeroStartup, prepareHeroStartup } from './support/startup.js';
void test('neutral starting arrows are unpoisoned while chaotic heroes retain their poison', async () => {
    const chaotic = await completeHeroStartup({ role: 'ranger', alignment: 'chaotic', seed: 94n });
    const poisoned = chaotic.inventory.find(item => item.opoisoned);
    assert.ok(poisoned);
    const neutral = await completeHeroStartup({ role: 'ranger', alignment: 'neutral', seed: 94n });
    assert.ok(neutral.inventory.some(item => item.otyp === poisoned.otyp));
    assert.equal(neutral.inventory.some(item => item.opoisoned), false);
});
void test('a Wizard may start with the level-one enchantment book confuse monster', async () => {
    const state = await completeHeroStartup({ role: 'wizard', seed: 25n });
    assert.ok(state.inventory.some(item => item.otyp === SPE_CONFUSE_MONSTER));
    assert.ok(state.spells.some(spell => spell.otyp === SPE_CONFUSE_MONSTER));
});
void test('random Wizard gear excludes unusable items and controlled polymorph combinations', async () => {
    for (let seed = 1n; seed <= 96n; seed++) {
        const state = prepareHeroStartup({ role: 'wizard', race: 'orc', seed });
        await uInitInventoryAttrs();
        const types = new Set(state.inventory.map(item => item.otyp));
        const context = `Orc Wizard seed ${seed}`;
        assert.equal(types.has(WAN_NOTHING), false, context);
        assert.equal(types.has(RIN_POISON_RESISTANCE), false, context);
        if (types.has(RIN_POLYMORPH_CONTROL)) {
            for (const type of [WAN_POLYMORPH, RIN_POLYMORPH, POT_POLYMORPH, SPE_POLYMORPH])
                assert.equal(types.has(type), false, `${context}: controlled polymorph ${type}`);
        }
        const rings = state.inventory.filter(item => item.oclass === 4);
        assert.equal(rings.length, 2, context);
        assert.notEqual(rings[0]?.otyp, rings[1]?.otyp, context);
        for (const ring of rings) {
            if (OBJECT_CHARGED[ring.otyp])
                assert.ok((ring.spe ?? 0) > 0, context);
        }
        const books = state.inventory.filter(item => item.oclass === 10);
        assert.equal(books.length, 2, context);
        assert.equal(books.filter(book => book.otyp === SPE_FORCE_BOLT).length, 1, context);
        for (const book of books) {
            const level = OBJECT_SPELL_LEVEL[book.otyp];
            assert.ok(level !== undefined && level >= 1 && level <= 3, context);
        }
    }
});
void test('a Priest first receives a level-one book and a different book in an allowed school', async () => {
    for (let seed = 1n; seed <= 48n; seed++) {
        const state = prepareHeroStartup({ role: 'priest', seed });
        await uInitInventoryAttrs();
        const books = state.inventory.filter(item => item.oclass === 10);
        const first = books[0], second = books[1];
        assert.ok(first && second, `Priest seed ${seed} needs both books`);
        assert.equal(OBJECT_SPELL_LEVEL[first.otyp], 1, `Priest seed ${seed}`);
        assert.notEqual(first.otyp, second.otyp, `Priest seed ${seed}`);
        for (const book of books) {
            const level = OBJECT_SPELL_LEVEL[book.otyp];
            const school = OBJECT_SPELL_CATEGORY[book.otyp];
            assert.ok(level !== undefined && level <= 3, `Priest seed ${seed}`);
            assert.ok(school === 'healing' || school === 'divination' || school === 'clerical', `Priest seed ${seed}: unexpected ${school} school`);
        }
    }
});
void test('starting coins retain ordinary coin knowledge and the role allowance', async () => {
    const state = await completeHeroStartup({ role: 'healer' });
    const gold = heroGoldObject(state);
    assert.ok(gold);
    assert.ok(gold.quan >= 1001 && gold.quan <= 2000);
    assert.equal(gold.bknown ?? false, false);
    assert.equal(gold.rknown ?? false, false);
    assert.equal(gold.blessed, false);
    assert.equal(gold.cursed, false);
    assert.equal(gold.invlet, '$');
});
void test('rerolling releases the previous inventory identities before replacing them', async () => {
    const state = prepareHeroStartup({ role: 'wizard' });
    await uInitInventoryAttrs();
    const previousInventory = [...state.inventory];
    await uInitInventoryAttrs();
    assert.ok(state.inventory.length > 0);
    for (const previous of previousInventory) {
        assert.equal(previous.where, 'gone');
        assert.equal(state.inventory.includes(previous), false);
    }
});
void test('replacing a candidate inventory removes its carried luck bonus', async () => {
    const state = prepareHeroStartup({ role: 'wizard' });
    await uInitInventoryAttrs();
    const stone = await mksobj(LUCKSTONE, false, false);
    await addCreatedInventoryItem(stone);
    assert.equal(state.u.moreluck, 3);
    await uInitInventoryAttrs();
    assert.equal(stone.where, 'gone');
    assert.equal(state.u.moreluck, 0);
});
//# sourceMappingURL=starting_inventory.test.js.map