import assert from 'node:assert/strict';
import test from 'node:test';
import { removeHeroArmor, wearHeroArmor } from '../js/armor.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { moveloop_core } from '../js/allmain.js';
import { continueCountedCommand, rhack } from '../js/cmd.js';
import { MENU_FULL, MENU_PARTIAL, MENU_TRADITIONAL, NO_MINVENT, POOL, TT_BEARTRAP } from '../js/const.js';
import { glyphAt, newsym } from '../js/display.js';
import { game } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { AMULET_OF_RESTFUL_SLEEP, AMULET_OF_STRANGULATION, CORPSE, DAGGER, GAUNTLETS_OF_POWER, GOLD_PIECE, LEATHER_CLOAK, OBJECT_NAMES, RIN_PROTECTION, RING_MAIL, SMALL_SHIELD, TWO_HANDED_SWORD, } from '../js/object_data.js';
import { stopHeroOccupation } from '../js/occupation.js';
import { grantIntrinsicProperty, propertyIsActive, revokeIntrinsicProperty, setPropertyTimeout } from '../js/properties.js';
import { inventoryItemDescription } from '../js/invent.js';
import { objectTypeKnown } from '../js/shk.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { restoreGame, saveGame } from '../js/save.js';
import { setPrimaryWeapon, setQuiverObject, setSecondaryWeapon } from '../js/weapon_slots.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshTurnRoom } from './support/playable-room.js';
import { createMonsterAt } from './support/monsters.js';
import { createPoisonGasCloud } from '../js/regions.js';
const LOW_BOOTS = OBJECT_NAMES.indexOf('low boots');
const T_SHIRT = OBJECT_NAMES.indexOf('T-shirt');
const AMULET_OF_ESP = OBJECT_NAMES.indexOf('amulet of ESP');
const AMULET_OF_FLYING = OBJECT_NAMES.indexOf('amulet of flying');
const AMULET_OF_MAGICAL_BREATHING = OBJECT_NAMES.indexOf('amulet of magical breathing');
async function takeOff(answers) {
    pushKeys(answers);
    await rhack('A'.charCodeAt(0));
}
async function work(turns) {
    pushKeys(' '.repeat(30));
    for (let turn = 0; turn < turns; turn++)
        await continueCountedCommand();
}
void test('takeoffall reports an unequipped hero without spending a turn', async () => {
    freshObjectRoom();
    await runExtendedCommand('takeoffall');
    assert.equal(game._pending_message, 'You are not wearing anything.');
    assert.equal(game.context.move, 0);
});
void test('bulk removal starts without a turn and removes a zero-delay shield on its first working turn', async () => {
    freshObjectRoom({ flags: { menu_style: MENU_PARTIAL } });
    const shield = await addInventoryObject(SMALL_SHIELD);
    wearHeroArmor(shield);
    await takeOff(`${shield.invlet}\n`);
    assert.equal(game.uarms, shield);
    assert.equal(game.context.move, 0);
    await work(1);
    assert.equal(game.uarms, null);
    assert.equal(shield.worn, false);
    assert.ok(game.inventory.includes(shield));
    assert.match(game._pending_message, /You finish disrobing\./);
});
void test('bulk removal follows the outer-layer order even when inventory letters put the suit first', async () => {
    freshObjectRoom({ flags: { menu_style: MENU_PARTIAL, verbose: false } });
    const suit = await addInventoryObject(RING_MAIL);
    const cloak = await addInventoryObject(LEATHER_CLOAK);
    wearHeroArmor(suit);
    wearHeroArmor(cloak);
    await takeOff(`${suit.invlet}${cloak.invlet}\n`);
    await work(1);
    assert.equal(game.uarmc, null);
    assert.equal(game.uarm, suit);
    await work(4);
    assert.equal(game.uarm, suit, 'ring mail remains worn during its five-turn delay');
    await work(1);
    assert.equal(game.uarm, null);
});
void test('removing only a shirt accounts for replacing the suit and cloak while leaving them worn', async () => {
    freshObjectRoom({ flags: { menu_style: MENU_PARTIAL, verbose: false } });
    const shirt = await addInventoryObject(T_SHIRT);
    const suit = await addInventoryObject(RING_MAIL);
    const cloak = await addInventoryObject(LEATHER_CLOAK);
    wearHeroArmor(shirt);
    wearHeroArmor(suit);
    wearHeroArmor(cloak);
    await takeOff(`${shirt.invlet}\n`);
    await work(10);
    assert.equal(game.uarmu, shirt);
    await work(1);
    assert.equal(game.uarmu, null);
    assert.equal(game.uarm, suit);
    assert.equal(game.uarmc, cloak);
});
void test('a cursed outer cloak blocks selecting the suit and reveals its curse', async () => {
    freshObjectRoom({ flags: { menu_style: MENU_PARTIAL } });
    const suit = await addInventoryObject(RING_MAIL);
    const cloak = await addInventoryObject(LEATHER_CLOAK, { cursed: true, bknown: false });
    wearHeroArmor(suit);
    wearHeroArmor(cloak);
    await takeOff(`${suit.invlet}\n`);
    assert.match(game._pending_message, /cannot remove your cloak to take off/);
    assert.equal(cloak.bknown, true);
    assert.equal(game.uarm, suit);
    assert.equal(game._occupation ?? null, null);
});
void test('a welded two-handed weapon blocks suit removal and reveals its curse', async () => {
    freshObjectRoom({ flags: { menu_style: MENU_PARTIAL } });
    const suit = await addInventoryObject(RING_MAIL);
    const sword = await addInventoryObject(TWO_HANDED_SWORD, { cursed: true, bknown: false });
    wearHeroArmor(suit);
    await setPrimaryWeapon(sword);
    await takeOff(`${suit.invlet}\n`);
    assert.match(game._pending_message, /cannot release your sword to take off/);
    assert.equal(sword.bknown, true);
    assert.equal(game._occupation ?? null, null);
});
void test('a bear trap blocks taking off boots without spending a turn', async () => {
    freshObjectRoom({ flags: { menu_style: MENU_PARTIAL }, hero: { utrap: 5, utraptype: TT_BEARTRAP } });
    const boots = await addInventoryObject(LOW_BOOTS);
    wearHeroArmor(boots);
    await takeOff(`${boots.invlet}\n`);
    assert.equal(game._pending_message, 'The bear trap prevents you from pulling your foot out.');
    assert.equal(game.uarmf, boots);
    assert.equal(game.context.move, 0);
});
void test('cursed gloves block removing a ring and reveal the glove curse', async () => {
    freshObjectRoom({ flags: { menu_style: MENU_PARTIAL } });
    const gloves = await addInventoryObject(GAUNTLETS_OF_POWER, { cursed: true, bknown: false });
    const ring = await addInventoryObject(RIN_PROTECTION);
    wearHeroArmor(gloves);
    await wearHeroAccessory(ring, 'uleft');
    await takeOff(`${ring.invlet}\n`);
    assert.match(game._pending_message, /cannot take off your gauntlets to remove the ring/);
    assert.equal(gloves.bknown, true);
    assert.equal(game.uleft, ring);
});
void test('bulk disarming clears cursed alternate and quiver slots without dropping their objects', async () => {
    freshObjectRoom({ flags: { menu_style: MENU_PARTIAL } });
    const alternate = await addInventoryObject(DAGGER, { cursed: true });
    const ammunition = await addInventoryObject(DAGGER, { cursed: true, spe: 1 });
    await setSecondaryWeapon(alternate);
    await setQuiverObject(ammunition);
    await takeOff(`${alternate.invlet}${ammunition.invlet}\n`);
    await work(1);
    assert.equal(game.uswapwep, null);
    assert.equal(game.uquiver, ammunition);
    await work(1);
    assert.equal(game.uquiver, null);
    assert.ok(game.inventory.includes(alternate));
    assert.ok(game.inventory.includes(ammunition));
    assert.match(game._pending_message, /You finish disarming\./);
});
void test('interrupted disrobing resumes the remaining delay without selecting items again', async () => {
    freshObjectRoom({ flags: { menu_style: MENU_PARTIAL } });
    const suit = await addInventoryObject(RING_MAIL);
    wearHeroArmor(suit);
    await takeOff(`${suit.invlet}\n`);
    await work(2);
    await stopHeroOccupation(game, async () => { });
    await takeOff('');
    assert.equal(game._pending_message, 'You continue disrobing.');
    assert.equal(game.context.move, 0);
    await work(2);
    assert.equal(game.uarm, suit);
    await work(1);
    assert.equal(game.uarm, null);
});
void test('full-menu class and curse filters intersect rather than selecting either category', async () => {
    freshObjectRoom({ flags: { menu_style: 2 } });
    const cloak = await addInventoryObject(LEATHER_CLOAK, { blessed: true });
    const shield = await addInventoryObject(SMALL_SHIELD);
    const ring = await addInventoryObject(RIN_PROTECTION, { blessed: true });
    wearHeroArmor(cloak);
    wearHeroArmor(shield);
    await wearHeroAccessory(ring, 'uleft');
    // Categories: a=all, b=armor, c=rings; B=known blessed.
    await takeOff(`bB\n${cloak.invlet}\n`);
    await work(1);
    assert.equal(game.uarmc, null);
    assert.equal(game.uarms, shield);
    assert.equal(game.uleft, ring);
});
void test('the armor class symbol selects only armor in the full takeoff category menu', async () => {
    freshObjectRoom({ flags: { menu_style: MENU_FULL } });
    const shield = await addInventoryObject(SMALL_SHIELD);
    const ring = await addInventoryObject(RIN_PROTECTION);
    wearHeroArmor(shield);
    await wearHeroAccessory(ring, 'uleft');
    await takeOff(`[\n${shield.invlet}\n`);
    await work(1);
    assert.equal(game.uarms, null);
    assert.equal(game.uleft, ring);
});
for (const style of [MENU_FULL, MENU_TRADITIONAL]) {
    void test(`a priest learns carried BUC states before cancelling takeoff with menu style ${style}`, async () => {
        freshObjectRoom({ role: 'priest', flags: { menu_style: style } });
        const shield = await addInventoryObject(SMALL_SHIELD);
        const dagger = await addInventoryObject(DAGGER, { cursed: true });
        const gold = await addInventoryObject(GOLD_PIECE);
        wearHeroArmor(shield);
        shield.bknown = false;
        dagger.bknown = false;
        gold.bknown = true;
        await takeOff('\x1b');
        assert.equal(dagger.bknown, true, 'BUC counting includes unworn carried items');
        assert.equal(gold.bknown, false, 'coins have no known BUC state');
        assert.equal(game.uarms, shield);
        assert.equal(game.context.move, 0);
    });
}
void test('armor cursed during bulk removal remains described as being doffed in its off message', async () => {
    freshObjectRoom({ flags: { menu_style: MENU_PARTIAL } });
    const suit = await addInventoryObject(RING_MAIL);
    wearHeroArmor(suit);
    await takeOff(`${suit.invlet}\n`);
    suit.cursed = true;
    await work(4);
    const messages = [];
    resetInputState().display = {
        async readKey() {
            messages.push(game._pending_message);
            return 32;
        },
    };
    await continueCountedCommand();
    assert.ok(messages.some(message => /You were wearing .*ring mail \(being doffed\)\./.test(message)), `Expected the doffing annotation in the removal message: ${messages.join('; ')}`);
    assert.equal(game.uarm, suit);
    assert.doesNotMatch(inventoryItemDescription(suit), /being doffed/);
});
void test('traditional takeoff can select a class and accept all its worn items', async () => {
    freshObjectRoom({ flags: { menu_style: 0 } });
    const shield = await addInventoryObject(SMALL_SHIELD);
    wearHeroArmor(shield);
    await takeOff('[\na');
    await work(1);
    assert.equal(game.uarms, null);
});
void test('combination takeoff selects classes by prompt then objects by menu', async () => {
    freshObjectRoom({ flags: { menu_style: 1 } });
    const shield = await addInventoryObject(SMALL_SHIELD);
    const ring = await addInventoryObject(RIN_PROTECTION);
    wearHeroArmor(shield);
    await wearHeroAccessory(ring, 'uleft');
    await takeOff(`[\n${shield.invlet}\n`);
    await work(1);
    assert.equal(game.uarms, null);
    assert.equal(game.uleft, ring);
});
void test('changing location discards interrupted bulk removal', async () => {
    freshObjectRoom({ flags: { menu_style: MENU_PARTIAL } });
    const suit = await addInventoryObject(RING_MAIL);
    wearHeroArmor(suit);
    await takeOff(`${suit.invlet}\n`);
    await work(1);
    assert.match(inventoryItemDescription(suit), /\(being doffed\)$/);
    await stopHeroOccupation(game, async () => { });
    await rhack('l'.charCodeAt(0));
    assert.doesNotMatch(inventoryItemDescription(suit), /being doffed/);
    assert.equal(game.uarm, suit);
});
void test('losing the current armor cancels its delay while remaining selected equipment still comes off', async () => {
    freshObjectRoom({ flags: { menu_style: MENU_PARTIAL, verbose: false } });
    const suit = await addInventoryObject(RING_MAIL);
    const boots = await addInventoryObject(LOW_BOOTS);
    wearHeroArmor(suit);
    wearHeroArmor(boots);
    await takeOff(`${suit.invlet}${boots.invlet}\n`);
    await work(1);
    await removeHeroArmor(suit);
    await work(2);
    assert.equal(game.uarmf, boots);
    await work(1);
    assert.equal(game.uarmf, null);
});
void test('interrupted armor is described as being doffed until its removal finishes', async () => {
    freshObjectRoom({ flags: { menu_style: MENU_PARTIAL } });
    const suit = await addInventoryObject(RING_MAIL);
    wearHeroArmor(suit);
    await takeOff(`${suit.invlet}\n`);
    await stopHeroOccupation(game, async () => { });
    assert.match(inventoryItemDescription(suit), /\(being doffed\)$/);
});
void test('saved bulk removal resumes after restore without losing its remaining work', async () => {
    freshObjectRoom({ flags: { menu_style: MENU_PARTIAL } });
    game.plname = 'Disrobing';
    const storage = memoryStorage();
    const suit = await addInventoryObject(RING_MAIL);
    wearHeroArmor(suit);
    await takeOff(`${suit.invlet}\n`);
    await work(2);
    await stopHeroOccupation(game, async () => { });
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame('Disrobing', storage), true);
    await takeOff('');
    assert.equal(game._pending_message, 'You continue disrobing.');
    await work(2);
    assert.ok(game.uarm);
    await work(1);
    assert.equal(game.uarm, null);
});
void test('removing gloves asks for confirmation even with stoning resistance when a petrifying corpse is carried', async () => {
    freshObjectRoom({ flags: { menu_style: MENU_PARTIAL } });
    const gloves = await addInventoryObject(GAUNTLETS_OF_POWER);
    await addInventoryObject(CORPSE, { corpsenm: MONSTER_NAME.indexOf('cockatrice') });
    grantIntrinsicProperty('stoneResistance', 'outside');
    wearHeroArmor(gloves);
    await takeOff(`${gloves.invlet}\nno\n`);
    assert.equal(game.uarmg, gloves);
    assert.equal(game._occupation ?? null, null);
    assert.match(game._last_message, /despite carrying a dead cockatrice/);
});
void test('bulk amulet removal ends strangulation and keeps the amulet in inventory', async () => {
    freshObjectRoom({ flags: { menu_style: MENU_PARTIAL } });
    const amulet = await addInventoryObject(AMULET_OF_STRANGULATION);
    pushKeys('  ');
    await wearHeroAccessory(amulet, 'uamul');
    resetInputState();
    game._pending_message = '';
    await takeOff(`${amulet.invlet}\n`);
    await work(1);
    assert.equal(game.uamul, null);
    assert.equal(game.u.strangledTurns, 0);
    assert.ok(game.inventory.includes(amulet));
    assert.ok(game._knownObjectTypes?.has(AMULET_OF_STRANGULATION));
});
void test('bulk ESP amulet removal redraws a stationary monster that telepathy had revealed', async () => {
    freshObjectRoom({ flags: { menu_style: MENU_PARTIAL, verbose: false } });
    const monster = await createMonsterAt('jackal', 12, 10, NO_MINVENT);
    monster.minvis = 1;
    const amulet = await addInventoryObject(AMULET_OF_ESP);
    await wearHeroAccessory(amulet, 'uamul');
    newsym(monster.mx, monster.my);
    assert.equal(glyphAt(monster.mx, monster.my)?.kind, 'monster');
    await takeOff(`${amulet.invlet}\n`);
    await work(1);
    assert.notEqual(glyphAt(monster.mx, monster.my)?.kind, 'monster');
    assert.equal(game.uamul, null);
});
void test('bulk flying amulet removal announces landing and identifies the amulet', async () => {
    freshObjectRoom({ flags: { menu_style: MENU_PARTIAL, verbose: false } });
    grantIntrinsicProperty('flying', 'outside');
    const amulet = await addInventoryObject(AMULET_OF_FLYING, { typeKnown: false });
    await wearHeroAccessory(amulet, 'uamul');
    revokeIntrinsicProperty('flying', 'outside');
    game._pending_message = '';
    assert.equal(propertyIsActive('flying'), true);
    assert.equal(objectTypeKnown(amulet), false);
    await takeOff(`${amulet.invlet}\n`);
    await work(1);
    assert.match(game._pending_message, /You land\./);
    assert.equal(propertyIsActive('flying'), false);
    assert.equal(objectTypeKnown(amulet), true);
});
void test('bulk magical-breathing amulet removal warns about poison gas and identifies the amulet', async () => {
    freshObjectRoom({ flags: { menu_style: MENU_PARTIAL, verbose: false } });
    const amulet = await addInventoryObject(AMULET_OF_MAGICAL_BREATHING, { typeKnown: false });
    await wearHeroAccessory(amulet, 'uamul');
    await createPoisonGasCloud(game, game.u.ux, game.u.uy, 1, 8);
    game._pending_message = '';
    assert.equal(objectTypeKnown(amulet), false);
    await takeOff(`${amulet.invlet}\n`);
    await work(1);
    assert.match(game._pending_message, /You are breathing poison gas!/);
    assert.equal(propertyIsActive('magicalBreathing'), false);
    assert.equal(objectTypeKnown(amulet), true);
});
void test('bulk magical-breathing amulet removal forces an underwater hero to escape drowning', async () => {
    const level = freshObjectRoom({ flags: { menu_style: MENU_PARTIAL, verbose: false } });
    const amulet = await addInventoryObject(AMULET_OF_MAGICAL_BREATHING, { typeKnown: false });
    await wearHeroAccessory(amulet, 'uamul');
    const { ux, uy } = game.u;
    level.requireAt(ux, uy).typ = POOL;
    game.u.uinwater = 1;
    game.underwater = true;
    game._pending_message = '';
    assert.equal(objectTypeKnown(amulet), false);
    await takeOff(`${amulet.invlet}\n`);
    await work(1);
    assert.ok(game.u.ux !== ux || game.u.uy !== uy, 'the hero crawls to adjacent dry ground');
    assert.equal(!!game.program_state.gameover, false);
    assert.equal(objectTypeKnown(amulet), true);
});
void test('removing a restful-sleep amulet clears its timeout but retains permanent sleepiness', async () => {
    for (const permanent of [false, true]) {
        freshObjectRoom({ flags: { menu_style: MENU_PARTIAL, verbose: false } });
        const amulet = await addInventoryObject(AMULET_OF_RESTFUL_SLEEP);
        await wearHeroAccessory(amulet, 'uamul');
        setPropertyTimeout('sleepy', 15);
        if (permanent)
            grantIntrinsicProperty('sleepy', 'outside');
        await takeOff(`${amulet.invlet}\n`);
        await work(1);
        assert.equal(game.uamul, null);
        assert.equal(game.u.sleepyTurns, permanent ? 15 : 0);
        assert.equal(propertyIsActive('sleepy'), permanent);
    }
});
void test('the turn scheduler spends exactly the suit removal delay after the free initiating command', async () => {
    const input = freshTurnRoom({ flags: { menu_style: MENU_PARTIAL, verbose: false } });
    const suit = await addInventoryObject(RING_MAIL);
    wearHeroArmor(suit);
    const started = game.moves;
    input.feed(`A${suit.invlet}\n.`);
    await moveloop_core();
    assert.equal(game.moves, started);
    assert.equal(game.context.move, 0);
    for (let turn = 0; turn < 5; turn++)
        await moveloop_core();
    assert.equal(game.uarm, null);
    await moveloop_core();
    assert.equal(game.moves - started, 5);
});
//# sourceMappingURL=bulk_takeoff.test.js.map