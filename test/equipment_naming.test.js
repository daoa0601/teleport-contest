import assert from 'node:assert/strict';
import test from 'node:test';
import { wearHeroAccessory } from '../js/accessory.js';
import { wearHeroArmor } from '../js/armor.js';
import { rhack } from '../js/cmd.js';
import { wearEyewear } from '../js/eyewear.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKey, resetInputState } from '../js/input.js';
import { ddoinv, inventoryItemDescription } from '../js/invent.js';
import { beginObjectBurn } from '../js/light.js';
import { AKLYS, AMULET_OF_REFLECTION, ARROW, CROSSBOW_BOLT, DAGGER, DART, GOLD_DRAGON_SCALES, GRAY_DRAGON_SCALES, LEATHER_GLOVES, LENSES, LONG_SWORD, MEAT_RING, PICK_AXE, RIN_FIRE_RESISTANCE, RING_MAIL, ROCK, TOWEL, TWO_HANDED_SWORD, } from '../js/object_data.js';
import { polymorphHero } from '../js/polyself.js';
import { punishHero } from '../js/punishment.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { setSlipperyHands } from '../js/towel.js';
import { addInventoryItem } from '../js/u_init.js';
import { setPrimaryWeapon, setQuiverObject, setSecondaryWeapon, setTwoWeaponCombat, } from '../js/weapon_slots.js';
import { addInventoryObject, artifactObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { answerPrompts } from './support/input-boundaries.js';
import { createSaddledSteed } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
void test('a wielded pick-axe uses the primary weapon hand description', async () => {
    freshObjectRoom();
    const pick = await addInventoryObject(PICK_AXE);
    await setPrimaryWeapon(pick);
    assert.match(inventoryItemDescription(pick), /\(weapon in right hand\)$/);
});
void test('wielded ammunition, missiles, stacks, and ordinary tools use the abbreviated description', async () => {
    freshObjectRoom();
    const arrow = await addInventoryObject(ARROW, { quan: 1 });
    const dart = await addInventoryObject(DART, { quan: 1 });
    const daggers = await addInventoryObject(DAGGER, { quan: 3 });
    const towel = await addInventoryObject(TOWEL);
    for (const item of [arrow, dart, daggers, towel]) {
        await setPrimaryWeapon(item);
        assert.match(inventoryItemDescription(item), /\(wielded\)$/);
    }
});
void test('an aklys is tethered to the dominant hand', async () => {
    freshObjectRoom({ hero: { rightHanded: false } });
    const aklys = await addInventoryObject(AKLYS);
    await setPrimaryWeapon(aklys);
    assert.match(inventoryItemDescription(aklys), /\(tethered to left hand\)$/);
});
void test('two-weapon descriptions follow the dominant hand on both sides', async () => {
    freshObjectRoom({ role: 'barbarian', hero: { rightHanded: false } });
    const sword = await addInventoryObject(LONG_SWORD);
    const dagger = await addInventoryObject(DAGGER);
    await setPrimaryWeapon(sword);
    await setSecondaryWeapon(dagger);
    setTwoWeaponCombat(true);
    assert.match(inventoryItemDescription(sword), /\(wielded in left hand\)$/);
    assert.match(inventoryItemDescription(dagger), /\(wielded in right hand\)$/);
});
void test('a two-handed weapon describes the current form\'s hands', async () => {
    freshObjectRoom();
    installPolymorphedHero('troll');
    const sword = await addInventoryObject(TWO_HANDED_SWORD);
    await setPrimaryWeapon(sword);
    assert.match(inventoryItemDescription(sword), /\(weapon in claws\)$/);
});
void test('the alternate slot describes a stack as alternate weapons', async () => {
    freshObjectRoom();
    const daggers = await addInventoryObject(DAGGER, { quan: 3 });
    await setSecondaryWeapon(daggers);
    assert.match(inventoryItemDescription(daggers), /\(alternate weapons; not wielded\)$/);
});
void test('a rogue\'s quiver descriptions distinguish bow ammunition, bolts, and missiles', async () => {
    freshObjectRoom({ role: 'rogue' });
    const arrows = await addInventoryObject(ARROW, { quan: 4 });
    const bolts = await addInventoryObject(CROSSBOW_BOLT, { quan: 4 });
    const darts = await addInventoryObject(DART, { quan: 4 });
    await setQuiverObject(arrows);
    assert.match(inventoryItemDescription(arrows), /\(in quiver\)$/);
    await setQuiverObject(bolts);
    assert.match(inventoryItemDescription(bolts), /\(in quiver pouch\)$/);
    await setQuiverObject(darts);
    assert.match(inventoryItemDescription(darts), /\(at the ready\)$/);
});
void test('readied small objects use a quiver pouch while an ordinary tool stays at the ready', async () => {
    freshObjectRoom({ role: 'samurai' });
    const rock = await addInventoryObject(ROCK);
    const towel = await addInventoryObject(TOWEL);
    await setQuiverObject(rock);
    assert.match(inventoryItemDescription(rock), /\(in quiver pouch\)$/);
    await setQuiverObject(towel);
    assert.match(inventoryItemDescription(towel), /\(at the ready\)$/);
});
void test('wielding feedback projects the primary hand before the weapon enters that slot', async () => {
    freshObjectRoom({ hero: { rightHanded: false } });
    const pick = await addInventoryObject(PICK_AXE);
    pushKey(pick.invlet);
    await rhack('w'.charCodeAt(0));
    assert.equal(game.uwep, pick);
    assert.match(game._pending_message, /\(weapon in left hand\)\./);
});
void test('rings and meat rings describe their actual side and current hand anatomy', async () => {
    freshObjectRoom({ hero: { rightHanded: false } });
    installPolymorphedHero('troll');
    const ring = await addInventoryObject(RIN_FIRE_RESISTANCE);
    const meatRing = await addInventoryObject(MEAT_RING);
    await wearHeroAccessory(ring, 'uright');
    await wearHeroAccessory(meatRing, 'uleft');
    assert.match(inventoryItemDescription(ring), /\(on right claw\)$/);
    assert.match(inventoryItemDescription(meatRing), /\(on left claw\)$/);
});
void test('worn amulets, eyewear, and saddles carry the worn annotation', async () => {
    freshObjectRoom();
    const amulet = await addInventoryObject(AMULET_OF_REFLECTION);
    const lenses = await addInventoryObject(LENSES);
    const pony = await createSaddledSteed();
    installPagerInput(resetInputState(), { expected: /amulet|lenses/, limit: 2 });
    await wearHeroAccessory(amulet, 'uamul');
    await wearEyewear(lenses);
    assert.ok(pony.saddle);
    assert.match(inventoryItemDescription(amulet), /\(being worn\)$/);
    assert.match(inventoryItemDescription(lenses), /\(being worn\)$/);
    assert.match(inventoryItemDescription(pony.saddle), /\(being worn\)$/);
});
void test('slippery hands annotate worn gloves', async () => {
    freshObjectRoom();
    const gloves = await addInventoryObject(LEATHER_GLOVES);
    wearHeroArmor(gloves);
    setSlipperyHands(12);
    // Native strncat() appends past the parenthesis it meant to replace.
    assert.match(inventoryItemDescription(gloves), /\(being worn\); slippery\)$/);
});
void test('armor being put on is described as being donned', async () => {
    freshObjectRoom();
    const armor = await addInventoryObject(RING_MAIL);
    pushKey(armor.invlet);
    await rhack('W'.charCodeAt(0));
    assert.match(inventoryItemDescription(armor), /\(being donned\)$/);
});
void test('armor being taken off is described as being doffed', async () => {
    freshObjectRoom();
    const armor = await addInventoryObject(RING_MAIL);
    wearHeroArmor(armor);
    pushKey(armor.invlet);
    await rhack('T'.charCodeAt(0));
    assert.match(inventoryItemDescription(armor), /\(being doffed\)$/);
});
void test('dragon scales merged by polymorph are described as embedded in the hero\'s skin', async () => {
    freshObjectRoom();
    const scales = await addInventoryObject(GRAY_DRAGON_SCALES);
    wearHeroArmor(scales);
    const input = resetInputState();
    installPagerInput(input, { expected: /merge|turn into|feel/, limit: 5 });
    await polymorphHero();
    assert.equal(game.uskin, scales);
    assert.match(inventoryItemDescription(scales), /\(embedded in your skin\)$/);
});
void test('worn luminous armor shows its light only while the hero can see', async () => {
    freshObjectRoom();
    const scales = await addInventoryObject(GOLD_DRAGON_SCALES, { blessed: false, cursed: false });
    wearHeroArmor(scales);
    beginObjectBurn(scales);
    assert.match(inventoryItemDescription(scales), /\(being worn, brightly lit\)$/);
    setHeroBlindnessTurns(10);
    assert.match(inventoryItemDescription(scales), /\(being worn\)$/);
});
void test('punishment describes the ball as chained and the chain as attached', async () => {
    freshObjectRoom();
    await punishHero();
    assert.ok(game.uball);
    assert.ok(game.uchain);
    assert.match(inventoryItemDescription(game.uball), /\(chained to you\)$/);
    assert.match(inventoryItemDescription(game.uchain), /\(attached to you\)$/);
});
void test('the inventory menu adds visible artifact light inside the primary hand phrase', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const sword = await addInventoryItem(await artifactObject('Sunsword'));
    await setPrimaryWeapon(sword);
    beginObjectBurn(sword);
    const input = resetInputState();
    await answerPrompts(ddoinv(), input, [{
            prompt: /Sunsword.*\(weapon in right hand, brightly lit\)/,
            keys: ' ',
        }]);
});
//# sourceMappingURL=equipment_naming.test.js.map