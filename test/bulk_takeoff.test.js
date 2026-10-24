import assert from 'node:assert/strict';
import test from 'node:test';
import { findArmorClass, removeHeroArmor, stopDonning, wearHeroArmor } from '../js/armor.js';
import { wearHeroAccessory } from '../js/accessory.js';
import { moveloop_core } from '../js/allmain.js';
import { continueCountedCommand, rhack } from '../js/cmd.js';
import { MENU_FULL, MENU_PARTIAL, MENU_TRADITIONAL, NO_MINVENT, PIT, POOL, ROOM, TT_BEARTRAP, TT_PIT } from '../js/const.js';
import { glyphAt, newsym, plineWithContinuation } from '../js/display.js';
import { game } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { AMULET_OF_GUARDING, AMULET_OF_RESTFUL_SLEEP, AMULET_OF_STRANGULATION, CLOAK_OF_DISPLACEMENT, CORPSE, DAGGER, GAUNTLETS_OF_POWER, GOLD_PIECE, LEATHER_CLOAK, OBJECT_NAMES, RIN_PROTECTION, RING_MAIL, SMALL_SHIELD, TOWEL, TWO_HANDED_SWORD, WATER_WALKING_BOOTS, } from '../js/object_data.js';
import { stopHeroOccupation } from '../js/occupation.js';
import { grantIntrinsicProperty, propertyIsActive, revokeIntrinsicProperty, setPropertyTimeout } from '../js/properties.js';
import { inventoryItemDescription } from '../js/invent.js';
import { objectTypeKnown } from '../js/shk.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { recordObjectKnowledge } from '../js/object_knowledge.js';
import { initRng } from '../js/rng.js';
import { restoreGame, saveGame } from '../js/save.js';
import { setPrimaryWeapon, setQuiverObject, setSecondaryWeapon } from '../js/weapon_slots.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshTurnRoom } from './support/playable-room.js';
import { createMonsterAt } from './support/monsters.js';
import { createStaffedShop } from './support/shop.js';
import { createPoisonGasCloud } from '../js/regions.js';
import { addTrap } from './support/level-state.js';
import { createDungeon } from './support/topology.js';
import { beginHeroEngulf } from '../js/hero_engulf.js';
import { AD_DGST, AT_ENGL } from '../js/monster_attack_types.js';
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
void test('bulk shield removal retains its armor class through the removal pager until the next input', async () => {
    freshObjectRoom({ flags: { menu_style: MENU_PARTIAL } });
    game._moveloopStarted = true;
    game.u.umovement = 12;
    const shield = await addInventoryObject(SMALL_SHIELD);
    wearHeroArmor(shield);
    findArmorClass();
    assert.equal(game.u.uac, 9);
    await takeOff(`${shield.invlet}\n`);
    await plineWithContinuation('You rest.');
    const removals = [];
    resetInputState().display = {
        async readKey() {
            if (/You were wearing .*shield/.test(game._pending_message))
                removals.push({ armorClass: game.u.uac, worn: !!game.uarms });
            return 32;
        },
    };
    await continueCountedCommand();
    assert.ok(removals.length > 0, 'shield removal must reach a message pager');
    for (const removal of removals) {
        assert.equal(removal.worn, false, 'the shield is removed before its message');
        assert.equal(removal.armorClass, 9, 'the pager retains AC from before removal');
    }
    resetInputState().feed('\x1b');
    await moveloop_core();
    assert.equal(game.u.uac, 10, 'the next input reflects the removed shield');
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
for (const armorType of [RING_MAIL, T_SHIRT]) {
    void test(`selecting ${OBJECT_NAMES[armorType]} reveals a welded one-handed weapon's curse without blocking removal`, async () => {
        freshObjectRoom({ flags: { menu_style: MENU_PARTIAL, verbose: false } });
        const armor = await addInventoryObject(armorType);
        const dagger = await addInventoryObject(DAGGER, { cursed: true, bknown: false });
        wearHeroArmor(armor);
        await setPrimaryWeapon(dagger);
        await takeOff(`${armor.invlet}\n`);
        assert.equal(dagger.bknown, true, 'checking the welded weapon reveals its curse during selection');
        await work(armorType === RING_MAIL ? 5 : 1);
        assert.equal(armor.worn, false, 'a one-handed weapon allows disrobing');
        assert.equal(game.uwep, dagger);
        assert.ok(game.inventory.includes(armor));
    });
}
for (const wearingGloves of [false, true]) {
    void test(`trying to unwield an unknown cursed weapon with slippery ${wearingGloves ? 'gloves' : 'fingers'} reveals its curse before the refusal`, async () => {
        freshObjectRoom({ flags: { menu_style: MENU_PARTIAL }, hero: { glibTurns: 5 } });
        if (wearingGloves) {
            const gloves = await addInventoryObject(GAUNTLETS_OF_POWER);
            wearHeroArmor(gloves);
        }
        const dagger = await addInventoryObject(DAGGER, { cursed: true, bknown: false });
        await setPrimaryWeapon(dagger);
        await takeOff(`${dagger.invlet}\n`);
        assert.equal(game._pending_message, `Despite your slippery ${wearingGloves ? 'gauntlets' : 'fingers'}, you can't.`);
        assert.equal(dagger.bknown, true);
        assert.equal(game.uwep, dagger);
        assert.equal(game._occupation ?? null, null);
        assert.equal(game.context.move, 0);
    });
}
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
for (const rightHanded of [true, false]) {
    void test(`removing an off-hand ring reveals a welded weapon's curse for a ${rightHanded ? 'right' : 'left'}-handed hero`, async () => {
        freshObjectRoom({ flags: { menu_style: MENU_PARTIAL, verbose: false }, hero: { rightHanded } });
        const dagger = await addInventoryObject(DAGGER, { cursed: true, bknown: false });
        const ring = await addInventoryObject(RIN_PROTECTION);
        const offHand = rightHanded ? 'uleft' : 'uright';
        await setPrimaryWeapon(dagger);
        await wearHeroAccessory(ring, offHand);
        assert.equal(dagger.bknown, false);
        await takeOff(`${ring.invlet}\n`);
        await work(1);
        assert.equal(dagger.bknown, true);
        assert.equal(game.uwep, dagger);
        assert.equal(game[offHand], null, 'the welded weapon does not block the other hand');
        assert.ok(game.inventory.includes(ring));
    });
}
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
for (const [slot, equip] of [
    ['uwep', setPrimaryWeapon],
    ['uswapwep', setSecondaryWeapon],
    ['uquiver', setQuiverObject],
]) {
    void test(`a dressing interruption does not delay disarming armor in ${slot}`, async () => {
        freshObjectRoom({ flags: { menu_style: MENU_PARTIAL, verbose: false } });
        const shield = await addInventoryObject(SMALL_SHIELD);
        await equip(shield);
        await takeOff(`${shield.invlet}\n`);
        await stopDonning();
        await work(1);
        assert.equal(game[slot], null, 'disarming still finishes on its first working turn');
        assert.ok(game.inventory.includes(shield));
        assert.doesNotMatch(game._pending_message, /You stop taking off/);
    });
    void test(`traditional takeoff accepts the weapon category before a ring in ${slot}`, async () => {
        freshObjectRoom({ flags: { menu_style: MENU_TRADITIONAL, verbose: false } });
        const ring = await addInventoryObject(RIN_PROTECTION);
        await equip(ring);
        await takeOff(')=\ny');
        await work(1);
        assert.equal(game[slot], null);
        assert.ok(game.inventory.includes(ring));
        assert.match(game._pending_message, /You finish disarming\./);
    });
}
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
void test('a welded-weapon wield refusal discards interrupted disrobing', async () => {
    freshObjectRoom({ flags: { menu_style: MENU_PARTIAL, verbose: false } });
    const suit = await addInventoryObject(RING_MAIL);
    const boots = await addInventoryObject(LOW_BOOTS);
    const dagger = await addInventoryObject(DAGGER, { cursed: true });
    wearHeroArmor(suit);
    wearHeroArmor(boots);
    await setPrimaryWeapon(dagger);
    await takeOff(`${suit.invlet}${boots.invlet}\n`);
    await work(1);
    await stopHeroOccupation(game, async () => { });
    resetInputState();
    pushKeys('-');
    await rhack('w'.charCodeAt(0));
    assert.match(game._pending_message, /welded to your hand/);
    await takeOff('\x1b');
    await work(8);
    assert.equal(game.uarm, suit, 'a new cancelled selection leaves the interrupted suit worn');
    assert.equal(game.uarmf, boots, 'a new cancelled selection leaves the pending boots worn');
    assert.doesNotMatch(await inventoryItemDescription(suit), /being doffed/);
    assert.equal(game.uwep, dagger);
});
void test('bulk displacement cloak removal announces the loss and identifies the cloak', async () => {
    freshObjectRoom({ flags: { menu_style: MENU_PARTIAL, verbose: false } });
    const cloak = await addInventoryObject(CLOAK_OF_DISPLACEMENT, { typeKnown: false });
    wearHeroArmor(cloak);
    await takeOff(`${cloak.invlet}\n`);
    const messages = [];
    resetInputState().display = {
        async readKey() {
            messages.push(game._pending_message);
            return 32;
        },
    };
    await continueCountedCommand();
    assert.ok(messages.includes('You feel that monsters no longer have difficulty pinpointing your location.'), `Expected displacement-loss feedback, received: ${messages.join('; ')}`);
    assert.equal(game.uarmc, null);
    assert.equal(propertyIsActive('displaced'), false);
    assert.equal(objectTypeKnown(cloak), true);
});
for (const remainingSource of ['timed', 'permanent']) {
    void test(`bulk cloak removal leaves ${remainingSource} displacement active without feedback`, async () => {
        freshObjectRoom({ flags: { menu_style: MENU_PARTIAL, verbose: false } });
        const cloak = await addInventoryObject(CLOAK_OF_DISPLACEMENT, { typeKnown: false });
        wearHeroArmor(cloak);
        if (remainingSource === 'timed')
            setPropertyTimeout('displaced', 10);
        else
            grantIntrinsicProperty('displaced', 'outside');
        await takeOff(`${cloak.invlet}\n`);
        await work(1);
        assert.equal(game.uarmc, null);
        assert.equal(propertyIsActive('displaced'), true);
        assert.doesNotMatch(game._pending_message, /pinpointing your location/);
        assert.equal(objectTypeKnown(cloak), false);
    });
}
void test('a blind hero senses displacement loss through intrinsic telepathy', async () => {
    freshObjectRoom({ flags: { menu_style: MENU_PARTIAL, verbose: false } });
    const cloak = await addInventoryObject(CLOAK_OF_DISPLACEMENT);
    wearHeroArmor(cloak);
    setPropertyTimeout('blinded', 10);
    grantIntrinsicProperty('telepathy', 'outside');
    await takeOff(`${cloak.invlet}\n`);
    const messages = [];
    resetInputState().display = {
        async readKey() {
            messages.push(game._pending_message);
            return 32;
        },
    };
    await continueCountedCommand();
    assert.ok(messages.some(message => /no longer have difficulty pinpointing/.test(message)), `Expected displacement-loss feedback through telepathy, received: ${messages.join('; ')}`);
    assert.equal(game.uarmc, null);
});
void test('a sighted invisible hero cannot notice displacement loss through intrinsic telepathy', async () => {
    freshObjectRoom({ flags: { menu_style: MENU_PARTIAL, verbose: false } });
    const cloak = await addInventoryObject(CLOAK_OF_DISPLACEMENT, { typeKnown: false });
    wearHeroArmor(cloak);
    grantIntrinsicProperty('invisible', 'outside');
    grantIntrinsicProperty('telepathy', 'outside');
    await takeOff(`${cloak.invlet}\n`);
    await work(1);
    assert.equal(game.uarmc, null);
    assert.doesNotMatch(game._pending_message, /pinpointing your location/);
    assert.equal(objectTypeKnown(cloak), false);
});
void test('an invisible hero who sees invisible notices bulk displacement cloak removal', async () => {
    freshObjectRoom({ flags: { menu_style: MENU_PARTIAL, verbose: false } });
    const cloak = await addInventoryObject(CLOAK_OF_DISPLACEMENT, { typeKnown: false });
    wearHeroArmor(cloak);
    grantIntrinsicProperty('invisible', 'outside');
    grantIntrinsicProperty('seeInvisible', 'outside');
    await takeOff(`${cloak.invlet}\n`);
    const messages = [];
    resetInputState().display = {
        async readKey() {
            messages.push(game._pending_message);
            return 32;
        },
    };
    await continueCountedCommand();
    assert.ok(messages.some(message => /no longer have difficulty pinpointing/.test(message)), `Expected visible displacement-loss feedback, received: ${messages.join('; ')}`);
    assert.equal(game.uarmc, null);
    assert.equal(objectTypeKnown(cloak), true);
});
void test('single displacement cloak removal uses the same feedback and discovery', async () => {
    freshObjectRoom({ flags: { verbose: false } });
    const cloak = await addInventoryObject(CLOAK_OF_DISPLACEMENT, { typeKnown: false });
    wearHeroArmor(cloak);
    await rhack('T'.charCodeAt(0));
    assert.equal(game._pending_message, 'You feel that monsters no longer have difficulty pinpointing your location.');
    assert.equal(game.uarmc, null);
    assert.equal(objectTypeKnown(cloak), true);
});
void test('single displacement cloak removal identifies the cloak before naming it in verbose feedback', async () => {
    freshObjectRoom();
    const cloak = await addInventoryObject(CLOAK_OF_DISPLACEMENT, { typeKnown: false });
    wearHeroArmor(cloak);
    pushKeys(' '.repeat(10));
    await rhack('T'.charCodeAt(0));
    assert.equal(game.uarmc, null);
    assert.equal(objectTypeKnown(cloak), true);
    assert.match(game._lastPlineMessage ?? '', /You were wearing .*cloak of displacement\./);
});
for (const armorType of [SMALL_SHIELD, GAUNTLETS_OF_POWER]) {
    void test(`wearing ${OBJECT_NAMES[armorType]} discards all interrupted bulk removal`, async () => {
        freshObjectRoom({ flags: { menu_style: MENU_PARTIAL, verbose: false } });
        const suit = await addInventoryObject(RING_MAIL);
        const boots = await addInventoryObject(LOW_BOOTS);
        const armor = await addInventoryObject(armorType);
        wearHeroArmor(suit);
        wearHeroArmor(boots);
        await takeOff(`${suit.invlet}${boots.invlet}\n`);
        await work(1);
        await stopHeroOccupation(game, async () => { });
        resetInputState();
        pushKeys(armor.invlet);
        await rhack('W'.charCodeAt(0));
        assert.equal(armor.worn, true);
        assert.doesNotMatch(await inventoryItemDescription(suit), /being doffed/);
        await takeOff('\x1b');
        await work(8);
        assert.equal(game.uarm, suit, 'cancelled new selection leaves the old current item worn');
        assert.equal(game.uarmf, boots, 'cancelled new selection leaves the old pending item worn');
    });
}
void test('trying to wear armor already worn preserves interrupted bulk removal', async () => {
    freshObjectRoom({ flags: { menu_style: MENU_PARTIAL, verbose: false } });
    const suit = await addInventoryObject(RING_MAIL);
    wearHeroArmor(suit);
    await takeOff(`${suit.invlet}\n`);
    await work(1);
    await stopHeroOccupation(game, async () => { });
    resetInputState();
    pushKeys(suit.invlet);
    await rhack('W'.charCodeAt(0));
    assert.equal(game.context.move, 0);
    await takeOff('');
    await work(4);
    assert.equal(game.uarm, null);
});
void test('wearing selected quiver contents preserves replacement ammunition during resumed removal', async () => {
    freshObjectRoom({ flags: { menu_style: MENU_PARTIAL, verbose: false } });
    const suit = await addInventoryObject(RING_MAIL);
    const ring = await addInventoryObject(RIN_PROTECTION);
    const ammunition = await addInventoryObject(DAGGER);
    wearHeroArmor(suit);
    await setQuiverObject(ring);
    await takeOff(`${suit.invlet}${ring.invlet}\n`);
    await work(1);
    await stopHeroOccupation(game, async () => { });
    await wearHeroAccessory(ring, 'uleft');
    await setQuiverObject(ammunition);
    await takeOff('');
    await work(5);
    assert.equal(game.uarm, null);
    assert.equal(game.uleft, ring);
    assert.equal(game.uquiver, ammunition, 'unselected replacement ammunition stays readied');
});
void test('successfully dropping another item discards interrupted bulk removal', async () => {
    freshObjectRoom({ flags: { menu_style: MENU_PARTIAL, verbose: false } });
    const suit = await addInventoryObject(RING_MAIL);
    const dagger = await addInventoryObject(DAGGER);
    wearHeroArmor(suit);
    await takeOff(`${suit.invlet}\n`);
    await work(1);
    await stopHeroOccupation(game, async () => { });
    resetInputState();
    pushKeys(`${dagger.invlet}`);
    await rhack('d'.charCodeAt(0));
    assert.equal(dagger.where, 'floor');
    assert.doesNotMatch(await inventoryItemDescription(suit), /being doffed/);
    await takeOff('\x1b');
    await work(5);
    assert.equal(game.uarm, suit, 'a new cancelled selection does not resume discarded removal');
});
void test('a refused drop preserves interrupted bulk removal', async () => {
    freshObjectRoom({ flags: { menu_style: MENU_PARTIAL, verbose: false } });
    const suit = await addInventoryObject(RING_MAIL);
    wearHeroArmor(suit);
    await takeOff(`${suit.invlet}\n`);
    await work(1);
    await stopHeroOccupation(game, async () => { });
    resetInputState();
    pushKeys(`${suit.invlet}`);
    await rhack('d'.charCodeAt(0));
    assert.equal(game.context.move, 0);
    await takeOff('');
    await work(4);
    assert.equal(game.uarm, null);
});
void test('the armor class symbol selects armor in the takeoff item menu', async () => {
    freshObjectRoom({ flags: { menu_style: MENU_PARTIAL, verbose: false } });
    const shield = await addInventoryObject(SMALL_SHIELD);
    const cloak = await addInventoryObject(LEATHER_CLOAK);
    const ring = await addInventoryObject(RIN_PROTECTION);
    wearHeroArmor(shield);
    wearHeroArmor(cloak);
    await wearHeroAccessory(ring, 'uleft');
    await takeOff('[\n');
    await work(2);
    assert.equal(game.uarms, null);
    assert.equal(game.uarmc, null);
    assert.equal(game.uleft, ring);
});
for (const selector of ['.', '@']) {
    void test(`bulk category selection with ${selector} preserves paid equipment and mixed BUC states`, async () => {
        freshObjectRoom({ flags: { menu_style: MENU_FULL, verbose: false } });
        const shield = await addInventoryObject(SMALL_SHIELD, { unpaid: true });
        await createStaffedShop({ bill: [
                { bo_id: shield.o_id, bquan: 1, price: 10, useup: false },
            ] });
        const cloak = await addInventoryObject(LEATHER_CLOAK, { blessed: true });
        const ring = await addInventoryObject(RIN_PROTECTION, { bknown: false });
        wearHeroArmor(shield);
        wearHeroArmor(cloak);
        await wearHeroAccessory(ring, 'uleft');
        await takeOff(`${selector}\n.\n`);
        await work(3);
        assert.equal(game.uarms, null);
        assert.equal(game.uarmc, null, 'bulk selection does not enable the unpaid filter');
        assert.equal(game.uleft, null, 'bulk selection does not enable BUC filters');
    });
}
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
    assert.doesNotMatch(await inventoryItemDescription(suit), /being doffed/);
});
void test('traditional takeoff can select a class and accept all its worn items', async () => {
    freshObjectRoom({ flags: { menu_style: 0 } });
    const shield = await addInventoryObject(SMALL_SHIELD);
    wearHeroArmor(shield);
    await takeOff('[\na');
    await work(1);
    assert.equal(game.uarms, null);
});
void test('traditional takeoff displays one choice suffix and defaults to keeping the item', async () => {
    freshObjectRoom({ flags: { menu_style: MENU_TRADITIONAL } });
    const shield = await addInventoryObject(SMALL_SHIELD);
    wearHeroArmor(shield);
    const input = resetInputState();
    const removal = takeOff('[\n');
    try {
        await input.waitUntilBlocked();
        const question = game.nhDisplay?.grid[0]?.map(cell => cell.ch).join('').trimEnd();
        assert.match(question ?? '', /^[a-zA-Z] - [^?]*\? \[ynaq\] \(n\)$/);
    }
    finally {
        input.feed('\n');
        await removal;
    }
    await work(1);
    assert.equal(game.uarms, shield, 'Return chooses no and keeps the shield worn');
});
for (const categories of ['$u', 'u$', '$uU', 'uU$']) {
    void test(`traditional takeoff ${categories} ${categories.includes('U') ? 'admits' : 'preserves'} paid quivered gold`, async () => {
        freshObjectRoom({ flags: { menu_style: MENU_TRADITIONAL, verbose: false } });
        const gold = await addInventoryObject(GOLD_PIECE, { quan: 20 });
        const shield = await addInventoryObject(SMALL_SHIELD, { unpaid: true });
        await createStaffedShop({ bill: [
                { bo_id: shield.o_id, bquan: 1, price: 10, useup: false },
            ] });
        await setQuiverObject(gold);
        await takeOff(`${categories}\ny`);
        await work(1);
        assert.equal(game.uquiver, categories.includes('U') ? null : gold, 'the last status category chooses the predicate applied before coin category admission');
        assert.ok(game.inventory.includes(gold));
        assert.equal(gold.quan, 20);
    });
}
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
for (const categories of ['maP', 'mP', 'maPU']) {
    void test(`traditional takeoff ${categories} ${categories === 'maP' ? 'offers all worn equipment' : 'filters recently picked equipment'}`, async () => {
        freshObjectRoom({ flags: { menu_style: MENU_TRADITIONAL, verbose: false } });
        const cloak = await addInventoryObject(LEATHER_CLOAK, { pickup_prev: true });
        const shield = await addInventoryObject(SMALL_SHIELD, { pickup_prev: false });
        wearHeroArmor(cloak);
        wearHeroArmor(shield);
        await takeOff(`${categories}\n.\n`);
        await work(2);
        assert.equal(game.uarmc, null, 'the recently picked cloak can be selected');
        assert.equal(game.uarms, categories === 'maP' ? null : shield, 'P alone does not narrow all-worn selection; a BUC filter does');
    });
}
void test('changing location discards interrupted bulk removal', async () => {
    freshObjectRoom({ flags: { menu_style: MENU_PARTIAL } });
    const suit = await addInventoryObject(RING_MAIL);
    wearHeroArmor(suit);
    await takeOff(`${suit.invlet}\n`);
    await work(1);
    assert.match(await inventoryItemDescription(suit), /\(being doffed\)$/);
    await stopHeroOccupation(game, async () => { });
    await rhack('l'.charCodeAt(0));
    assert.doesNotMatch(await inventoryItemDescription(suit), /being doffed/);
    assert.equal(game.uarm, suit);
});
void test('a peaceful monster refusing to swap onto a trap discards interrupted bulk removal', async () => {
    const level = freshObjectRoom({ flags: { menu_style: MENU_PARTIAL, verbose: false } });
    const suit = await addInventoryObject(RING_MAIL);
    wearHeroArmor(suit);
    const { ux, uy } = game.u;
    const monster = await createMonsterAt('jackal', ux + 1, uy, NO_MINVENT);
    monster.mpeaceful = true;
    addTrap(level, PIT, ux, uy);
    await takeOff(`${suit.invlet}\n`);
    await work(1);
    await stopHeroOccupation(game, async () => { });
    resetInputState();
    initRng(1n);
    pushKeys('  ');
    await rhack('l'.charCodeAt(0));
    assert.match(game._pending_message, /doesn't want to swap places/);
    assert.equal(game.u.ux, ux);
    assert.equal(game.u.uy, uy);
    assert.equal(monster.mx, ux + 1);
    assert.doesNotMatch(await inventoryItemDescription(suit), /being doffed/);
    resetInputState();
    await takeOff('\x1b');
    await work(6);
    assert.equal(game.uarm, suit, 'cancelling a fresh selection keeps the suit worn');
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
    assert.match(await inventoryItemDescription(suit), /\(being doffed\)$/);
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
void test('guarding amulet removal keeps its previous armor class through the removal message pagers', async () => {
    freshObjectRoom({ flags: { menu_style: MENU_PARTIAL } });
    game._moveloopStarted = true;
    game.u.umovement = 12;
    const amulet = await addInventoryObject(AMULET_OF_GUARDING);
    await wearHeroAccessory(amulet, 'uamul');
    assert.equal(game.u.uac, 8);
    await takeOff(`${amulet.invlet}\n`);
    const pagedRemovals = [];
    resetInputState().display = {
        async readKey() {
            if (/You were wearing .*amulet of guarding/.test(game._pending_message)) {
                pagedRemovals.push({ armorClass: game.u.uac, stillWorn: !!game.uamul });
            }
            return 32;
        },
    };
    await continueCountedCommand();
    assert.ok(pagedRemovals.length > 0, 'the removal message must reach a pager');
    for (const removal of pagedRemovals) {
        assert.equal(removal.stillWorn, false, 'the amulet is already removed at its message');
        assert.equal(removal.armorClass, 8, 'the message retains the AC calculated before removal');
    }
    assert.equal(game.uamul, null);
    assert.ok(game.inventory.includes(amulet));
    resetInputState().feed('\x1b');
    await moveloop_core();
    assert.equal(game.u.uac, 10, 'the next input uses the AC without the amulet');
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
void test('identifying a removed flying amulet does not change the landing pit injury or confinement', async () => {
    const landings = [];
    for (const known of [true, false]) {
        const level = freshObjectRoom({ flags: { menu_style: MENU_PARTIAL, verbose: false } });
        grantIntrinsicProperty('flying', 'outside');
        const amulet = await addInventoryObject(AMULET_OF_FLYING, { typeKnown: known });
        await wearHeroAccessory(amulet, 'uamul');
        revokeIntrinsicProperty('flying', 'outside');
        if (known)
            recordObjectKnowledge(AMULET_OF_FLYING);
        addTrap(level, PIT, game.u.ux, game.u.uy);
        game._pending_message = '';
        // Knowledge is the only difference between the two landings.
        initRng(5n);
        await takeOff(`${amulet.invlet}\n`);
        await work(1);
        assert.equal(game.uamul, null);
        assert.equal(game.u.utraptype, TT_PIT);
        assert.ok(game.u.uhp !== undefined && game.u.uhp < 40, 'the landing pit injures the hero');
        assert.ok(game.u.utrap !== undefined && game.u.utrap > 0, 'the landing pit confines the hero');
        assert.equal(objectTypeKnown(amulet), true);
        landings.push({ hitPoints: game.u.uhp, trappedTurns: game.u.utrap });
    }
    const [known, unknown] = landings;
    assert.ok(known && unknown);
    assert.equal(unknown.hitPoints, known.hitPoints, 'identification follows the landing damage');
    assert.equal(unknown.trappedTurns, known.trappedTurns, 'identification follows the pit confinement');
});
void test('fatal landing after flying amulet removal identifies the pack during game over', async () => {
    const level = freshObjectRoom({
        flags: { menu_style: MENU_PARTIAL, verbose: false, bones: false,
            disclose: '-i -a -v -c -o', tombstone: false },
        hero: { uhp: 1 },
    });
    game.storage = memoryStorage();
    game.iflags.toptenwin = false;
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 20 })];
    grantIntrinsicProperty('flying', 'outside');
    const amulet = await addInventoryObject(AMULET_OF_FLYING, { typeKnown: false });
    await wearHeroAccessory(amulet, 'uamul');
    revokeIntrinsicProperty('flying', 'outside');
    addTrap(level, PIT, game.u.ux, game.u.uy);
    game._pending_message = '';
    await takeOff(`${amulet.invlet}\n`);
    await work(1);
    assert.equal(game.program_state.gameover, true);
    assert.equal(objectTypeKnown(amulet), true, 'really_done identifies carried possessions even when disclosure is declined');
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
void test('bulk magical-breathing amulet removal checks the hero in-water state without the display flag', async () => {
    const level = freshObjectRoom({ flags: { menu_style: MENU_PARTIAL, verbose: false } });
    const amulet = await addInventoryObject(AMULET_OF_MAGICAL_BREATHING, { typeKnown: false });
    await wearHeroAccessory(amulet, 'uamul');
    const { ux, uy } = game.u;
    level.requireAt(ux, uy).typ = POOL;
    game.u.uinwater = 1;
    game.underwater = false;
    game._pending_message = '';
    assert.equal(objectTypeKnown(amulet), false);
    await takeOff(`${amulet.invlet}\n`);
    await work(1);
    assert.ok(game.u.ux !== ux || game.u.uy !== uy, 'the hero crawls to adjacent dry ground');
    assert.equal(!!game.program_state.gameover, false);
    assert.equal(objectTypeKnown(amulet), true);
});
void test('removing a submerged breathing amulet warns and wets inventory while timed breathing keeps the hero safe', async () => {
    const level = freshObjectRoom({ flags: { menu_style: MENU_PARTIAL, verbose: false } });
    const amulet = await addInventoryObject(AMULET_OF_MAGICAL_BREATHING, { typeKnown: false });
    const towel = await addInventoryObject(TOWEL, { spe: 0 });
    await wearHeroAccessory(amulet, 'uamul');
    setPropertyTimeout('magicalBreathing', 15);
    const { ux, uy } = game.u;
    level.requireAt(ux, uy).typ = POOL;
    game.u.uinwater = 1;
    game.u.ux0 = ux - 1;
    game.u.dx = 1;
    game._pending_message = '';
    await takeOff(`${amulet.invlet}\n`);
    const messages = [];
    resetInputState().display = {
        async readKey() {
            messages.push(game._pending_message);
            return 32;
        },
    };
    await continueCountedCommand();
    messages.push(game._pending_message);
    assert.match(messages.join(' '), /You suddenly inhale an unhealthy amount of water!/);
    assert.ok(towel.spe > 0, 'drown() wets carried objects even while magical breathing remains');
    assert.equal(game.u.ux, ux, 'remaining magical breathing avoids crawling out');
    assert.equal(game.u.uy, uy);
    assert.equal(game.u.uinwater, 1);
    assert.equal(game.u.magicalBreathingTurns, 15);
    assert.equal(!!game.program_state.gameover, false);
    assert.equal(objectTypeKnown(amulet), true);
});
for (const obstacle of ['water-walking boots', 'a holding monster']) {
    void test(`breathing loss forces a submerged hero to escape despite ${obstacle}`, async () => {
        const level = freshObjectRoom({ flags: { menu_style: MENU_PARTIAL, verbose: false } });
        const amulet = await addInventoryObject(AMULET_OF_MAGICAL_BREATHING, { typeKnown: false });
        await wearHeroAccessory(amulet, 'uamul');
        const { ux, uy } = game.u;
        level.requireAt(ux, uy).typ = POOL;
        if (obstacle === 'water-walking boots') {
            const boots = await addInventoryObject(WATER_WALKING_BOOTS);
            wearHeroArmor(boots);
        }
        else {
            game.u.ustuck = await createMonsterAt('owlbear', ux + 1, uy, NO_MINVENT);
        }
        game.u.uinwater = 1;
        game.underwater = true;
        game._pending_message = '';
        await takeOff(`${amulet.invlet}\n`);
        await work(1);
        assert.ok(game.u.ux !== ux || game.u.uy !== uy, 'the hero crawls to adjacent dry ground');
        assert.equal(game.u.uinwater, 0);
        assert.equal(game.u.ustuck ?? null, null);
        assert.equal(!!game.program_state.gameover, false);
        assert.equal(objectTypeKnown(amulet), true);
    });
}
void test('escaping drowning during bulk amulet removal leaves water and triggers the landing pit', async () => {
    const level = freshObjectRoom({ flags: { menu_style: MENU_PARTIAL, verbose: false } });
    const amulet = await addInventoryObject(AMULET_OF_MAGICAL_BREATHING);
    await wearHeroAccessory(amulet, 'uamul');
    const { ux, uy, uhp } = game.u;
    assert.ok(uhp !== undefined);
    for (let x = ux - 1; x <= ux + 1; x++)
        for (let y = uy - 1; y <= uy + 1; y++) {
            level.requireAt(x, y).typ = POOL;
        }
    const landing = level.requireAt(ux + 1, uy);
    landing.typ = ROOM;
    addTrap(level, PIT, ux + 1, uy);
    game.u.uinwater = 1;
    game.underwater = true;
    game._pending_message = '';
    await takeOff(`${amulet.invlet}\n`);
    await work(1);
    assert.equal(game.u.ux, ux + 1);
    assert.equal(game.u.uy, uy);
    assert.ok((game.u.utrap ?? 0) > 0, 'the landing pit traps the hero');
    assert.equal(game.u.utraptype, TT_PIT);
    assert.ok(game.u.uhp !== undefined && game.u.uhp < uhp, 'falling into the pit inflicts damage');
    assert.equal(game.u.uinwater, 0);
    assert.equal(game.underwater, false);
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
void test('a wrapped restful-sleep removal message waits with sleepiness already cleared', async () => {
    freshObjectRoom({ flags: { menu_style: MENU_PARTIAL } });
    const amulet = await addInventoryObject(AMULET_OF_RESTFUL_SLEEP, {
        oname: 'the treasured keepsake of a very long and particularly restful summer holiday',
    });
    pushKeys(' '.repeat(10));
    await wearHeroAccessory(amulet, 'uamul');
    resetInputState();
    setPropertyTimeout('sleepy', 15);
    await takeOff(`${amulet.invlet}\n`);
    const pagedRemovals = [];
    resetInputState().display = {
        async readKey() {
            if (/You were wearing .*amulet of restful sleep/.test(game._pending_message)) {
                pagedRemovals.push({ stillWorn: !!game.uamul,
                    sleepy: propertyIsActive('sleepy'), timeout: game.u.sleepyTurns });
            }
            return 32;
        },
    };
    await continueCountedCommand();
    assert.ok(pagedRemovals.length > 0, 'the long removal message must reach a pager');
    for (const removal of pagedRemovals) {
        assert.equal(removal.stillWorn, false, 'the amulet is already removed at its message');
        assert.equal(removal.sleepy, false, 'its sleepiness ends before the message waits');
        assert.equal(removal.timeout, 0, 'its timeout is cleared before the message waits');
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
void test('a hostile monster arriving next to the hero stops disrobing and A resumes the remaining work', async () => {
    const input = freshTurnRoom({ flags: { menu_style: MENU_PARTIAL, verbose: false } });
    const suit = await addInventoryObject(RING_MAIL);
    const boots = await addInventoryObject(LOW_BOOTS);
    wearHeroArmor(suit);
    wearHeroArmor(boots);
    input.feed(`A${boots.invlet}${suit.invlet}\n`);
    await moveloop_core();
    await moveloop_core();
    assert.equal(game._occupation?.key, 'takeoff');
    const { ux, uy } = game.u;
    const monster = await createMonsterAt('jackal', ux + 1, uy, NO_MINVENT);
    monster.mpeaceful = false;
    monster.msleeping = 1;
    newsym(ux + 1, uy);
    const messages = [];
    input.display = {
        async readKey() {
            messages.push(game._pending_message);
            return 27;
        },
    };
    await moveloop_core();
    assert.equal(game._occupation, null);
    assert.ok(messages.some(message => /You stop disrobing\./.test(message)), messages.join(' | '));
    assert.equal(game.uarm, suit);
    assert.equal(game.uarmf, boots);
    assert.match(await inventoryItemDescription(suit), /\(being doffed\)$/);
    assert.match(await inventoryItemDescription(boots), /\(being worn\)$/);
    monster.mpeaceful = true;
    resetInputState();
    await takeOff('');
    assert.equal(game._pending_message, 'You continue disrobing.');
    let turns = 0;
    while (game.uarm && turns < 10) {
        await work(1);
        turns++;
    }
    assert.equal(game.uarm, null, 'the suit comes off first despite being selected second');
    assert.equal(game.uarmf, boots);
    assert.match(await inventoryItemDescription(boots), /\(being doffed\)$/);
    while (game.uarmf && turns < 15) {
        await work(1);
        turns++;
    }
    assert.equal(game.uarmf, null);
    assert.equal(game.context.takeoff, undefined);
});
void test('being engulfed discards interrupted bulk removal', async () => {
    freshObjectRoom({ flags: { menu_style: MENU_PARTIAL, verbose: false } });
    const suit = await addInventoryObject(RING_MAIL);
    wearHeroArmor(suit);
    const { ux, uy } = game.u;
    const monster = await createMonsterAt('purple worm', ux - 1, uy, NO_MINVENT);
    await takeOff(`${suit.invlet}\n`);
    await work(1);
    await stopHeroOccupation(game, async () => { });
    assert.match(await inventoryItemDescription(suit), /\(being doffed\)$/);
    initRng(1n);
    pushKeys(' '.repeat(10));
    game.u.ustuck = monster;
    const capture = await beginHeroEngulf(monster, {
        kind: 'hero-attack', attackType: AT_ENGL, hit: true,
        damageType: AD_DGST, engulfOldX: ux - 1, engulfOldY: uy,
    });
    assert.equal(capture.captured, true);
    assert.doesNotMatch(await inventoryItemDescription(suit), /being doffed/);
    resetInputState();
    await takeOff('\x1b');
    assert.notEqual(game._pending_message, 'You continue disrobing.');
    await work(6);
    assert.equal(game.uarm, suit, 'cancelling a fresh selection keeps the suit worn');
});
//# sourceMappingURL=bulk_takeoff.test.js.map