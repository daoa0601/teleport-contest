import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { wearHeroArmor } from '../js/armor.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { TT_BEARTRAP } from '../js/const.js';
import { GAUNTLETS_OF_POWER, LEATHER_CLOAK, MEAT_RING, OBJECT_NAMES, RIN_PROTECTION, RING_MAIL, SMALL_SHIELD, TWO_HANDED_SWORD, } from '../js/object_data.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
for (const command of ['W', 'P']) {
    void test(`${command} refuses a second cloak without replacing the worn cloak`, async () => {
        freshObjectRoom();
        const cloak = await addInventoryObject(LEATHER_CLOAK);
        const spare = await addInventoryObject(OBJECT_NAMES.indexOf('robe'));
        wearHeroArmor(cloak);
        pushKeys(`${spare.invlet} `);
        await rhack(command.charCodeAt(0));
        assert.equal(game._pending_message, 'You are already wearing a cloak.');
        assert.equal(game.uarmc, cloak);
        assert.equal(!!spare.worn, false);
        assert.equal(game.context.move, 0);
    });
}
void test('wear refuses a shield with a two-handed sword', async () => {
    freshObjectRoom();
    const sword = await addInventoryObject(TWO_HANDED_SWORD);
    const shield = await addInventoryObject(SMALL_SHIELD);
    await setPrimaryWeapon(sword);
    pushKeys(shield.invlet);
    await rhack('W'.charCodeAt(0));
    assert.equal(game._pending_message, 'You cannot wear a shield while wielding a two-handed sword.');
    assert.equal(game.uarms ?? null, null);
    assert.equal(game.context.move, 0);
});
void test('a bear trap prevents wearing boots', async () => {
    freshObjectRoom({ hero: { utrap: 4, utraptype: TT_BEARTRAP } });
    const boots = await addInventoryObject(OBJECT_NAMES.indexOf('low boots'));
    pushKeys(boots.invlet);
    await rhack('W'.charCodeAt(0));
    assert.equal(game._pending_message, 'Your foot is trapped!');
    assert.equal(game.uarmf ?? null, null);
    assert.equal(game.context.move, 0);
});
void test('a large polymorphed body cannot put on a suit of armor', async () => {
    freshObjectRoom({ hero: { mh: 30, mhmax: 30, umonnum: MONSTER_NAME.indexOf('giant') } });
    const suit = await addInventoryObject(RING_MAIL);
    pushKeys(suit.invlet);
    await rhack('W'.charCodeAt(0));
    assert.equal(game._pending_message, 'The suit will not fit on your body.');
    assert.equal(game.uarm ?? null, null);
    assert.equal(game.context.move, 0);
});
void test('puton refuses a ring behind cursed gloves and spends only the discovery turn', async () => {
    freshObjectRoom();
    const gloves = await addInventoryObject(GAUNTLETS_OF_POWER, { cursed: true, bknown: false });
    const ring = await addInventoryObject(RIN_PROTECTION);
    wearHeroArmor(gloves);
    pushKeys(`${ring.invlet}l`);
    await rhack('P'.charCodeAt(0));
    assert.equal(game._pending_message, 'You cannot remove your gloves to put on the ring.');
    assert.equal(gloves.bknown, true);
    assert.equal(game.uleft ?? null, null);
    assert.equal(game.context.move, 1);
    pushKeys(`${ring.invlet}l `);
    await rhack('P'.charCodeAt(0));
    assert.equal(game.context.move, 0);
    assert.equal(game.uleft ?? null, null);
});
void test('puton refuses a third ring without replacing either hand', async () => {
    freshObjectRoom();
    const left = await addInventoryObject(RIN_PROTECTION, { spe: 1 });
    const right = await addInventoryObject(RIN_PROTECTION, { spe: 2 });
    const third = await addInventoryObject(RIN_PROTECTION, { spe: 3 });
    await wearHeroAccessory(left, 'uleft');
    await wearHeroAccessory(right, 'uright');
    pushKeys(third.invlet);
    await rhack('P'.charCodeAt(0));
    assert.equal(game._pending_message, 'There are no more ring-fingers to fill.');
    assert.equal(game.uleft, left);
    assert.equal(game.uright, right);
    assert.equal(game.context.move, 0);
});
void test('a limbless hero cannot wear a meat ring', async () => {
    freshObjectRoom({ hero: { umonnum: MONSTER_NAME.indexOf('black pudding'), mh: 40, mhmax: 40 } });
    const ring = await addInventoryObject(MEAT_RING);
    pushKeys(`${ring.invlet}l`);
    await rhack('P'.charCodeAt(0));
    assert.equal(game._pending_message, 'You cannot make the ring stick to your body.');
    assert.equal(game.context.move, 0);
    assert.equal(!!game.uleft, false);
});
void test('puton keeps asking for a ring hand after an invalid answer', async () => {
    freshObjectRoom();
    const ring = await addInventoryObject(RIN_PROTECTION);
    pushKeys(`${ring.invlet}xl`);
    await rhack('P'.charCodeAt(0));
    assert.equal(game.uleft, ring);
    assert.equal(game.context.move, 1);
});
//# sourceMappingURL=armor_wear_refusals.test.js.map