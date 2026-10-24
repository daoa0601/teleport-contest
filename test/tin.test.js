import { floorObjectsAt } from './support/level-state.js';
import { requirePlayingGame } from '../js/gstate.js';
import test, {} from 'node:test';
import { planInput } from './support/planned-input.js';
import assert from 'node:assert/strict';
import { currentAttribute } from '../js/attrib.js';
import { continueCountedCommand, rhack } from '../js/cmd.js';
import { A_STR, HEALTHY_TIN, HOMEMADE_TIN, ROTTEN_TIN, SATIATED, SPINACH_TIN } from '../js/const.js';
import { flushPendingTopline } from '../js/display.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { inventoryItemDescription } from '../js/invent.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { AXE, DAGGER, LEATHER_GLOVES, TIN, TIN_OPENER } from '../js/object_data.js';
import { objectQuantity } from '../js/object_stack.js';
import { addShopObjectToBill } from '../js/shk.js';
import { restoreGame, saveGame } from '../js/save.js';
import { setSlipperyHands } from '../js/towel.js';
import { continueTinOpening, setTinVariety, startTin, tinDetails, tinVariety, useTinOpener } from '../js/tin.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
const species = (name) => MONSTER_NAME.indexOf(name);
void test('tin contents depend on individual knowledge instead of recognizing the tin type', async () => {
    freshObjectRoom();
    const hidden = await addInventoryObject(TIN, {
        initialize: false, corpsenm: species('lichen'),
        typeKnown: true, known: false, bknown: false,
    });
    assert.equal(await inventoryItemDescription(hidden), 'a tin');
    const identified = await addInventoryObject(TIN, {
        initialize: false, corpsenm: species('kobold'),
        typeKnown: false, known: true, bknown: false,
    });
    assert.equal(await inventoryItemDescription(identified), 'a tin of kobold meat');
});
function room(t, answers = [], options = {}) {
    freshObjectRoom({ gameplaySeed: 71n, role: 'wizard', ...options });
    requirePlayingGame(game);
    game.plname = 'Tin eater';
    const input = resetInputState();
    planInput(input, t, answers);
    return input;
}
async function tin(properties = {}) {
    return addInventoryObject(TIN, {
        initialize: false, spe: -7, corpsenm: species('lichen'),
        known: false, cknown: false, ...properties,
    });
}
async function wield(type, properties = {}) {
    const weapon = await addInventoryObject(type, properties);
    await setPrimaryWeapon(weapon, game);
    return weapon;
}
function openingTin() {
    const opening = game._occupation;
    assert.ok(opening?.key === 'open-tin', 'Expected a live tin-opening occupation');
    return opening;
}
async function finishOpening() {
    let turns = 0;
    while (game._occupation) {
        assert.ok(++turns <= 51, 'Opening occupation did not terminate');
        await continueTinOpening(openingTin());
    }
    await flushPendingTopline();
    return turns;
}
for (const [tool, turns] of [[DAGGER, 3], [AXE, 6]]) {
    void test(`opening a tin with ${tool === DAGGER ? 'a dagger' : 'an axe'} takes ${turns} occupation turns`, async (t) => {
        room(t, [
            { prompt: /Using your (?:dagger|axe|tin opener).*open the tin/, keys: ' ' },
            { prompt: /(?:succeed in opening|easily open) the tin.*smells like lichens/, keys: ' ' },
            { prompt: /Eat it\?/, keys: 'y' },
        ]);
        requirePlayingGame(game);
        await wield(tool);
        const food = await tin();
        const hunger = game.u.uhunger;
        const result = await startTin(food);
        assert.equal(result.started, true);
        assert.equal(result.completed, false);
        for (let turn = 1; turn < turns; turn++) {
            await continueTinOpening(openingTin());
            assert.ok(game.inventory.includes(food), `Tin consumed before turn ${turns}`);
            assert.equal(game.u.uhunger, hunger);
        }
        await continueTinOpening(openingTin());
        assert.equal(game._occupation, null);
        assert.equal(game.inventory.includes(food), false);
        assert.equal(game.u.uhunger, hunger + 50);
        assert.equal(game.u.uconduct.food, 1);
    });
}
void test('a blessed opener opens an unblessed tin immediately', async (t) => {
    room(t, [
        { prompt: /Using your (?:dagger|axe|tin opener).*open the tin/, keys: ' ' },
        { prompt: /(?:succeed in opening|easily open) the tin.*smells like lichens/, keys: ' ' },
        { prompt: /Eat it\?/, keys: 'y' },
    ]);
    requirePlayingGame(game);
    await wield(TIN_OPENER, { blessed: true });
    const food = await tin();
    const result = await startTin(food);
    assert.equal(result.completed, true);
    assert.equal(game._occupation, undefined);
    assert.equal(game.inventory.includes(food), false);
});
void test('hands are required even for a blessed tin', async (t) => {
    room(t);
    requirePlayingGame(game);
    installPolymorphedHero('kitten');
    const food = await tin({ blessed: true });
    const result = await startTin(food);
    assert.equal(result.started, false);
    assert.ok(game.inventory.includes(food));
    assert.match(game._last_message, /cannot handle the tin/);
});
void test('a metallivore bites a tin without hands or an eating prompt', async (t) => {
    room(t);
    requirePlayingGame(game);
    installPolymorphedHero('rock mole');
    const food = await tin();
    const hunger = game.u.uhunger;
    const result = await startTin(food);
    assert.equal(result.completed, true);
    assert.equal(game.inventory.includes(food), false);
    assert.equal(game.u.uhunger, hunger + 55);
    assert.equal(game.u.uconduct.food, 1);
});
void test('slippery bare hands drop one unopened tin from a carried stack', async (t) => {
    room(t);
    requirePlayingGame(game);
    const food = await tin({ quan: 3 });
    setSlipperyHands(10);
    const hunger = game.u.uhunger;
    const result = await startTin(food);
    assert.equal(result.started, false);
    assert.equal(objectQuantity(food), 2);
    const dropped = floorObjectsAt(game.level, game.u.ux, game.u.uy).find(object => object.otyp === TIN);
    assert.equal(objectQuantity(dropped), 1);
    assert.ok(dropped != null, 'Expected dropped to be initialized');
    assert.equal(dropped.known, false);
    assert.equal(game.u.uhunger, hunger);
});
void test('a dagger can still open tins while the hero has slippery hands', async (t) => {
    room(t, [
        { prompt: /Using your (?:dagger|axe|tin opener).*open the tin/, keys: ' ' },
        { prompt: /(?:succeed in opening|easily open) the tin.*smells like lichens/, keys: ' ' },
        { prompt: /Eat it\?/, keys: 'y' },
        { prompt: /consume smoked lichen/, keys: ' ' },
    ]);
    requirePlayingGame(game);
    await wield(DAGGER);
    setSlipperyHands(10);
    const food = await tin();
    await startTin(food);
    assert.equal(await finishOpening(), 3);
    assert.equal(game.inventory.includes(food), false);
});
void test('leaving a floor tin stops opening without consuming it', async (t) => {
    room(t);
    requirePlayingGame(game);
    await wield(DAGGER);
    const food = await floorObject(TIN, game.u.ux, game.u.uy, {
        initialize: false, spe: -7, corpsenm: species('lichen'),
    });
    await startTin(food);
    game.u.ux++;
    await continueTinOpening(openingTin());
    assert.equal(game._occupation, null);
    assert.equal(food.where, 'floor');
});
void test('losing floor reach stops opening a floor tin', async (t) => {
    room(t);
    requirePlayingGame(game);
    await wield(DAGGER);
    const food = await floorObject(TIN, game.u.ux, game.u.uy, {
        initialize: false, spe: -7, corpsenm: species('lichen'),
    });
    await startTin(food);
    game.u.levitating = true;
    await continueTinOpening(openingTin());
    assert.equal(game._occupation, null);
    assert.equal(food.where, 'floor');
});
void test('refusing the contents discards one tin and learns its contents', async (t) => {
    room(t, [
        { prompt: /Using your (?:dagger|axe|tin opener).*open the tin/, keys: ' ' },
        { prompt: /(?:succeed in opening|easily open) the tin.*smells like lichens/, keys: ' ' },
        { prompt: /Eat it\?/, keys: 'n' },
    ]);
    requirePlayingGame(game);
    await wield(TIN_OPENER, { blessed: true });
    const food = await tin({ quan: 2 });
    const hunger = game.u.uhunger;
    await startTin(food);
    assert.equal(objectQuantity(food), 1);
    assert.equal(food.known, true);
    assert.equal(game.u.uhunger, hunger);
    assert.equal(game.u.uconduct.food || 0, 0);
});
void test('empty tins are discarded without counting a meal', async (t) => {
    room(t, [
        { prompt: /Using your (?:dagger|axe|tin opener).*open the tin/, keys: ' ' },
    ]);
    requirePlayingGame(game);
    await wield(TIN_OPENER, { blessed: true });
    const food = await tin({ corpsenm: -1 });
    const hunger = game.u.uhunger;
    await startTin(food);
    assert.equal(game.inventory.includes(food), false);
    assert.equal(food.known, true);
    assert.equal(game.u.uhunger, hunger);
    assert.equal(game.u.uconduct.food || 0, 0);
});
void test('a metallivore obtains nutrition from an empty tin itself', async (t) => {
    room(t);
    requirePlayingGame(game);
    installPolymorphedHero('rock mole');
    const food = await tin({ corpsenm: -1 });
    const hunger = game.u.uhunger;
    await startTin(food);
    assert.equal(game.u.uhunger, hunger + 5);
    assert.equal(game.u.uconduct.food || 0, 0);
});
void test('blessed spinach increases Strength and grants 600 nutrition', async (t) => {
    room(t, [
        { prompt: /tin opens like magic.*contains spinach/, keys: ' ' },
        { prompt: /Eat it\?/, keys: 'y' },
        { prompt: /feel like Popeye/, keys: ' ' },
    ]);
    requirePlayingGame(game);
    await wield(TIN_OPENER, { blessed: true });
    const food = await tin({ spe: 1, corpsenm: -1, blessed: true });
    const strength = currentAttribute(A_STR);
    const hunger = game.u.uhunger;
    await startTin(food);
    assert.ok(currentAttribute(A_STR) > strength);
    assert.equal(game.u.uhunger, hunger + 600);
    assert.equal(game.u.uconduct.food, 1);
    assert.equal(game.u.uconduct.unvegan || 0, 0);
    assert.equal(game.inventory.includes(food), false);
});
void test('refusing cursed spinach leaves its contents unidentified', async (t) => {
    room(t, [
        { prompt: /Using your (?:dagger|axe|tin opener).*open the tin/, keys: ' ' },
        { prompt: /easily open the tin.*decaying green substance/, keys: ' ' },
        { prompt: /Eat it\?/, keys: 'n' },
    ]);
    requirePlayingGame(game);
    await wield(TIN_OPENER, { blessed: true });
    const food = await tin({ spe: 1, corpsenm: -1, cursed: true });
    await startTin(food);
    assert.equal(food.known, false);
    assert.equal(game.inventory.includes(food), false);
    assert.equal(game.u.uconduct.food || 0, 0);
});
void test('rotten contents start vomiting without adding nutrition', async (t) => {
    room(t, [
        { prompt: /Using your (?:dagger|axe|tin opener).*open the tin/, keys: ' ' },
        { prompt: /easily open the tin.*smells like newts/, keys: ' ' },
        { prompt: /Eat it\?/, keys: 'y' },
    ]);
    requirePlayingGame(game);
    await wield(TIN_OPENER, { blessed: true });
    const food = await tin({ spe: -1, corpsenm: species('newt') });
    const hunger = game.u.uhunger;
    await startTin(food);
    assert.equal(game.u.uhunger, hunger);
    assert.ok(game.u.vomitingTurns != null, 'Expected game.u.vomitingTurns to be initialized');
    assert.ok(game.u.vomitingTurns >= 10 && game.u.vomitingTurns <= 24);
    assert.equal(game.inventory.includes(food), false);
});
void test('homemade tins cannot grant more nutrition than their corpse', async (t) => {
    room(t, [
        { prompt: /tin opens like magic.*smells like newts/, keys: ' ' },
        { prompt: /Eat it\?/, keys: 'y' },
    ]);
    requirePlayingGame(game);
    await wield(TIN_OPENER, { blessed: true });
    const food = await tin({ spe: -2, corpsenm: species('newt'), blessed: true });
    const hunger = game.u.uhunger;
    await startTin(food);
    assert.equal(game.u.uhunger, hunger + 20);
});
void test('fried contents grease hands even when gloves are worn', async (t) => {
    room(t, [
        { prompt: /Using your (?:dagger|axe|tin opener).*open the tin/, keys: ' ' },
        { prompt: /(?:succeed in opening|easily open) the tin.*smells like lichens/, keys: ' ' },
        { prompt: /Eat it\?/, keys: 'y' },
        { prompt: /consume french fried lichen/, keys: ' ' },
    ]);
    requirePlayingGame(game);
    await wield(TIN_OPENER, { blessed: true });
    game.uarmg = await addInventoryObject(LEATHER_GLOVES);
    const food = await tin({ spe: -4 });
    await startTin(food);
    assert.ok(game.u.glibTurns != null, 'Expected game.u.glibTurns to be initialized');
    assert.ok(game.u.glibTurns >= 5 && game.u.glibTurns <= 15);
    assert.match(game._last_message, /gloves very slippery/);
});
void test('an explicitly trapped tin explodes before offering contents', async (t) => {
    room(t, [
        { prompt: /Using your (?:dagger|axe|tin opener).*open the tin/, keys: ' ' },
    ]);
    requirePlayingGame(game);
    await wield(TIN_OPENER, { blessed: true });
    const food = await tin({ otrapped: true });
    const hp = game.u.uhp;
    const hunger = game.u.uhunger;
    await startTin(food);
    assert.ok(game.u.uhp < hp);
    assert.ok(game.u.stunnedTurns != null, 'Expected game.u.stunnedTurns to be initialized');
    assert.ok(game.u.stunnedTurns > 0);
    assert.equal(game.u.uhunger, hunger);
    assert.equal(game.inventory.includes(food), false);
    assert.equal(game.u.uconduct.food || 0, 0);
});
void test('fatal petrifying contents consume the tin before death', async (t) => {
    room(t, [
        { prompt: /Using your (?:dagger|axe|tin opener).*open the tin/, keys: ' ' },
        { prompt: /easily open the tin.*smells like cockatrices/, keys: ' ' },
        { prompt: /Eat it\?/, keys: 'y' },
        { prompt: /You consume smoked cockatrice\.  You turn to stone\.--More--/, keys: ' ' },
        { prompt: /Goodbye Tin eater.*Wizard/, keys: ' ' },
        { prompt: /^\s*--More--\s*$/, keys: ' ' },
    ]);
    requirePlayingGame(game);
    game.flags.disclose = '-i -a -v -c -o';
    await wield(TIN_OPENER, { blessed: true });
    const food = await tin({ corpsenm: species('cockatrice') });
    await startTin(food);
    assert.equal(game.inventory.includes(food), false);
    assert.ok(game.context.tin != null, 'Expected game.context.tin to be initialized');
    assert.equal(game.context.tin.tin, null);
    assert.equal(game.program_state.gameover, true);
    assert.equal(game.context.move, 0);
});
void test('healthy tins replace meat with spinach and preserve suitable vegetarian contents', async (t) => {
    room(t);
    requirePlayingGame(game);
    const meat = await tin({ corpsenm: species('newt') });
    setTinVariety(meat, HEALTHY_TIN);
    assert.equal(tinDetails(meat), 'tin of spinach');
    const vegetable = await tin({ spe: -6 });
    setTinVariety(vegetable, HEALTHY_TIN);
    assert.equal(vegetable.corpsenm, species('lichen'));
    assert.equal(tinDetails(vegetable, vegetable.corpsenm, { state: game }), 'tin of lichen');
});
void test('identified preparation names reflect curse and nonrotting species', async (t) => {
    room(t);
    requirePlayingGame(game);
    const food = await tin({ spe: -4, known: true, cknown: true });
    assert.match(await inventoryItemDescription(food), /tin of french fried lichen/);
    food.cursed = true;
    assert.equal(tinVariety(food, true), HOMEMADE_TIN);
    assert.match(await inventoryItemDescription(food), /homemade tin of lichen/);
    food.corpsenm = species('newt');
    assert.equal(tinVariety(food, true), ROTTEN_TIN);
    assert.match(await inventoryItemDescription(food), /rotten tin of newt meat/);
    food.spe = 1;
    assert.equal(tinVariety(food, true), SPINACH_TIN);
});
void test('applying an opener with no carried tin takes no time', async (t) => {
    room(t);
    requirePlayingGame(game);
    const opener = await addInventoryObject(TIN_OPENER);
    const result = await useTinOpener(opener);
    assert.equal(result.usedTime, false);
    assert.equal(game.uwep, null);
});
void test('canceling tin selection keeps the time spent wielding an opener', async (t) => {
    const input = room(t);
    requirePlayingGame(game);
    const opener = await addInventoryObject(TIN_OPENER);
    await tin();
    planInput(input, t, [
        { prompt: /now wield.*tin opener/, keys: ' ' },
        { prompt: /What do you want to open\?/, keys: '\x1b' },
    ]);
    const result = await useTinOpener(opener);
    assert.equal(result.usedTime, true);
    assert.equal(result.cancelled, true);
    assert.equal(game.uwep, opener);
});
void test('saving during opening preserves tin identity and stops the occupation on restore', async (t) => {
    room(t, [
        { prompt: /Using your (?:dagger|axe|tin opener).*open the tin/, keys: ' ' },
        { prompt: /Using your (?:dagger|axe|tin opener).*open the tin/, keys: ' ' },
        { prompt: /(?:succeed in opening|easily open) the tin.*smells like lichens/, keys: ' ' },
        { prompt: /Eat it\?/, keys: 'y' },
        { prompt: /consume smoked lichen/, keys: ' ' },
    ]);
    requirePlayingGame(game);
    const storage = memoryStorage();
    await wield(DAGGER);
    const food = await tin();
    await startTin(food);
    await continueTinOpening(openingTin());
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame('Tin eater', storage), true);
    const restored = game.inventory.find(object => object.otyp === TIN);
    assert.ok(restored);
    assert.ok(game.context.tin != null, 'Expected game.context.tin to be initialized');
    assert.equal(game.context.tin.tin, restored);
    assert.equal(game._occupation, null);
    await startTin(restored);
    assert.equal(await finishOpening(), 3);
    assert.equal(game.inventory.includes(restored), false);
});
void test('the eat command opens a carried tin through the real occupation dispatcher', async (t) => {
    const input = room(t, [
        { prompt: /Using your (?:dagger|axe|tin opener).*open the tin/, keys: ' ' },
        { prompt: /(?:succeed in opening|easily open) the tin.*smells like lichens/, keys: ' ' },
        { prompt: /Eat it\?/, keys: 'y' },
    ]);
    requirePlayingGame(game);
    await wield(DAGGER);
    const food = await tin();
    assert.ok(food.invlet);
    input.feed(food.invlet);
    await rhack('e'.charCodeAt(0));
    assert.equal(game.inventory.includes(food), true);
    assert.equal(game._occupation?.key, 'open-tin');
    for (let turn = 0; turn < 3; turn++)
        await continueCountedCommand(game);
    assert.equal(game.inventory.includes(food), false);
    assert.equal(game.u.uconduct.food, 1);
    assert.equal(game.context.move, 1);
});
void test('opening one unpaid tin preserves the bill and identity of the unopened stack', async (t) => {
    room(t, [
        { prompt: /Using your (?:dagger|axe|tin opener).*open the tin/, keys: ' ' },
        { prompt: /(?:succeed in opening|easily open) the tin.*smells like lichens/, keys: ' ' },
        { prompt: /Eat it\?/, keys: 'n' },
    ]);
    requirePlayingGame(game);
    const { shopkeeper } = await createStaffedShop();
    await wield(TIN_OPENER, { blessed: true });
    const food = await tin({ quan: 3 });
    await addShopObjectToBill(food, game, { silent: true });
    assert.equal(food.unpaid, true);
    await startTin(food);
    assert.equal(objectQuantity(food), 2);
    assert.equal(food.unpaid, true);
    const remaining = shopkeeper.eshk.bill.find(entry => entry.bo_id === food.o_id);
    assert.ok(remaining != null, 'Expected remaining to be initialized');
    assert.equal(remaining.bquan, 2);
    assert.equal(remaining.useup, false);
    const consumed = shopkeeper.eshk.bill.filter(entry => entry.useup);
    assert.equal(consumed.length, 1);
    assert.ok(consumed[0] != null);
    assert.equal(consumed[0].bquan, 1);
    assert.ok(game.context.tin != null, 'Expected game.context.tin to be initialized');
    assert.equal(game.context.tin.tin, null);
});
void test('a fatal trap stops before charging or consuming its tin', async (t) => {
    room(t, [
        { prompt: /Using your (?:dagger|axe|tin opener).*open the tin/, keys: ' ' },
        { prompt: /KABOOM!!.*tin was booby-trapped/, keys: ' ' },
        { prompt: /You die\.\.\.--More--/, keys: ' ' },
        { prompt: /Goodbye Tin eater.*Wizard/, keys: ' ' },
        { prompt: /^\s*--More--\s*$/, keys: ' ' },
    ], { hero: { uhp: 1 } });
    requirePlayingGame(game);
    game.flags.disclose = '-i -a -v -c -o';
    await wield(TIN_OPENER, { blessed: true });
    const food = await tin({ otrapped: true });
    await startTin(food);
    assert.equal(game.program_state.gameover, true);
    assert.notEqual(food.where, 'gone');
    assert.ok(game.context.tin != null, 'Expected game.context.tin to be initialized');
    assert.equal(game.context.tin.tin, food);
    assert.equal(game.context.move, 0);
});
void test('a tin is consumed before its nutrition can cause fatal choking', async (t) => {
    room(t, [
        { prompt: /Using your (?:dagger|axe|tin opener).*open the tin/, keys: ' ' },
        { prompt: /(?:succeed in opening|easily open) the tin.*smells like lichens/, keys: ' ' },
        { prompt: /Eat it\?/, keys: 'y' },
        { prompt: /consume french fried lichen.*choke over your food/, keys: ' ' },
        { prompt: /You die\.\.\.--More--/, keys: ' ' },
        { prompt: /Goodbye Tin eater.*Wizard/, keys: ' ' },
        { prompt: /^\s*--More--\s*$/, keys: ' ' },
    ], { hero: { uhunger: 1999, uhs: SATIATED, strangledTurns: 6 } });
    requirePlayingGame(game);
    game.flags.disclose = '-i -a -v -c -o';
    await wield(DAGGER);
    const food = await tin({ spe: -4 });
    await startTin(food);
    await finishOpening();
    assert.equal(game.program_state.gameover, true);
    assert.equal(food.where, 'gone');
    assert.ok(game.context.tin != null, 'Expected game.context.tin to be initialized');
    assert.equal(game.context.tin.tin, null);
    assert.equal(game.u.glibTurns || 0, 0);
});
void test('applying a tin opener wields it and opens the selected tin', async (t) => {
    const input = room(t);
    requirePlayingGame(game);
    const opener = await addInventoryObject(TIN_OPENER, { blessed: true });
    const food = await tin();
    assert.ok(opener.invlet && food.invlet);
    planInput(input, t, [
        { prompt: /What do you want to use or apply\?/, keys: opener.invlet },
        { prompt: /now wield a blessed tin opener/, keys: ' ' },
        { prompt: /What do you want to open\?/, keys: food.invlet },
        { prompt: /Using your tin opener.*open the tin/, keys: ' ' },
        { prompt: /easily open the tin.*smells like lichens/, keys: ' ' },
        { prompt: /Eat it\?/, keys: 'y' },
    ]);
    await rhack('a'.charCodeAt(0));
    assert.equal(game.uwep, opener);
    assert.equal(game.inventory.includes(food), false);
    assert.equal(game.context.move, 1);
});
//# sourceMappingURL=tin.test.js.map