import test from 'node:test';
import assert from 'node:assert/strict';
import { MM_NOMSG } from '../js/const.js';
import { makemonAt } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { ARROW, AXE, BOW, CHAIN_MAIL, CLOAK_OF_MAGIC_RESISTANCE, CLUB, CREAM_PIE, DAGGER, DART, LEATHER_ARMOR, LEATHER_JACKET, LONG_SWORD, MACE, OBJECT_NAMES, ROBE, SHORT_SWORD, } from '../js/object_data.js';
import { freshObjectRoom } from './support/object-room.js';
const KNIFE = 40;
const SHURIKEN = 25;
const RUBBER_HOSE = 78;
const WEAPON_CLASS = 2;
const ARMOR_CLASS = 3;
void test('abbots are born without weapons or armor but can carry magic items', async () => {
    let carriedItems = 0;
    for (let seed = 1; seed <= 32; seed++) {
        freshObjectRoom({ role: 'monk', gameplaySeed: seed });
        const abbot = await makemonAt(MONSTER_NAME.indexOf('abbot'), 12, 10, MM_NOMSG);
        assert.ok(abbot);
        for (const item of abbot.minvent) {
            assert.ok(item.oclass !== WEAPON_CLASS && item.oclass !== ARMOR_CLASS, `abbot received ${OBJECT_NAMES[item.otyp]} at birth (seed ${seed})`);
        }
        carriedItems += abbot.minvent.length;
    }
    assert.ok(carriedItems > 0, 'abbots remain eligible for ordinary magic items');
});
for (const name of ['page', 'roshi', 'warrior']) {
    void test(`${name} receives a sword and body armor at birth`, async () => {
        freshObjectRoom({ gameplaySeed: 1n });
        const guardian = await makemonAt(MONSTER_NAME.indexOf(name), 12, 10, MM_NOMSG);
        assert.ok(guardian);
        assert.ok(guardian.minvent.some(item => [LONG_SWORD, SHORT_SWORD].includes(item.otyp)), `${name} needs a sword`);
        assert.ok(guardian.minvent.some(item => [CHAIN_MAIL, LEATHER_ARMOR].includes(item.otyp)), `${name} needs body armor`);
    });
}
void test('a hunter receives a bow and a usable stack of arrows', async () => {
    freshObjectRoom({ gameplaySeed: 1n });
    const hunter = await makemonAt(MONSTER_NAME.indexOf('hunter'), 12, 10, MM_NOMSG);
    assert.ok(hunter);
    assert.ok(hunter.minvent.some(item => item.otyp === BOW));
    const arrows = hunter.minvent.find(item => item.otyp === ARROW);
    assert.ok(arrows);
    assert.ok(arrows.quan >= 3 && arrows.quan <= 14);
});
void test('a thug receives a club, a small blade, and body armor', async () => {
    freshObjectRoom({ gameplaySeed: 1n });
    const thug = await makemonAt(MONSTER_NAME.indexOf('thug'), 12, 10, MM_NOMSG);
    assert.ok(thug);
    assert.ok(thug.minvent.some(item => item.otyp === CLUB));
    assert.ok(thug.minvent.some(item => [DAGGER, KNIFE].includes(item.otyp)));
    assert.ok(thug.minvent.some(item => [LEATHER_ARMOR, LEATHER_JACKET].includes(item.otyp)));
});
void test('a neanderthal receives a club and leather armor', async () => {
    freshObjectRoom({ gameplaySeed: 1n });
    const guardian = await makemonAt(MONSTER_NAME.indexOf('neanderthal'), 12, 10, MM_NOMSG);
    assert.ok(guardian);
    assert.ok(guardian.minvent.some(item => item.otyp === CLUB));
    assert.ok(guardian.minvent.some(item => item.otyp === LEATHER_ARMOR));
});
void test('a ninja receives throwing weapons and a melee weapon', async () => {
    freshObjectRoom({ gameplaySeed: 1n });
    const ninja = await makemonAt(MONSTER_NAME.indexOf('ninja'), 12, 10, MM_NOMSG);
    assert.ok(ninja);
    assert.ok(ninja.minvent.some(item => [SHURIKEN, DART].includes(item.otyp)));
    assert.ok(ninja.minvent.some(item => [SHORT_SWORD, AXE].includes(item.otyp)));
});
void test('Kops can receive cream pies and police weapons', async () => {
    let pies = 0;
    let weapons = 0;
    for (let seed = 1; seed <= 32; seed++) {
        freshObjectRoom({ gameplaySeed: seed });
        const kop = await makemonAt(MONSTER_NAME.indexOf('Keystone Kop'), 12, 10, MM_NOMSG);
        assert.ok(kop);
        const stack = kop.minvent.find(item => item.otyp === CREAM_PIE);
        if (stack) {
            pies++;
            assert.ok(stack.quan >= 3 && stack.quan <= 4);
        }
        if (kop.minvent.some(item => [CLUB, RUBBER_HOSE].includes(item.otyp)))
            weapons++;
    }
    assert.ok(pies > 0, 'Kops sometimes carry throwing pies');
    assert.ok(weapons > 0, 'Kops sometimes carry clubs or rubber hoses');
});
void test('Monk quest leaders receive their role clothing', async () => {
    freshObjectRoom({ role: 'monk', gameplaySeed: 1n });
    const leader = await makemonAt(MONSTER_NAME.indexOf('Grand Master'), 12, 10, MM_NOMSG);
    assert.ok(leader);
    assert.ok(leader.minvent.some(item => [ROBE, CLOAK_OF_MAGIC_RESISTANCE].includes(item.otyp)));
});
void test('an Arch Priest outside the Cleric quest does not receive Cleric equipment', async () => {
    freshObjectRoom({ role: 'wizard', gameplaySeed: 1n });
    const leader = await makemonAt(MONSTER_NAME.indexOf('Arch Priest'), 12, 10, MM_NOMSG);
    assert.ok(leader);
    assert.equal(leader.minvent.some(item => item.otyp === MACE || item.otyp === ROBE), false);
});
//# sourceMappingURL=monster_birth_loadouts.test.js.map