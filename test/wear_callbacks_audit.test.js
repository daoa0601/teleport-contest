import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { currentAttribute } from '../js/attrib.js';
import { rhack } from '../js/cmd.js';
import { A_DEX, A_INT, A_WIS } from '../js/const.js';
import { findArmorClass } from '../js/armor.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { OBJECT_NAMES } from '../js/object_data.js';
import { grantIntrinsicProperty, propertyTimeout } from '../js/properties.js';
import { recordObjectKnowledge } from '../js/object_knowledge.js';
import { makeHallucinated } from '../js/hero_mental_status.js';
import { objectTypeKnown } from '../js/shk.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
const ELVEN_BOOTS = OBJECT_NAMES.indexOf('elven boots');
const SPEED_BOOTS = OBJECT_NAMES.indexOf('speed boots');
const HELM_OF_BRILLIANCE = OBJECT_NAMES.indexOf('helm of brilliance');
const GAUNTLETS_OF_DEXTERITY = OBJECT_NAMES.indexOf('gauntlets of dexterity');
const GAUNTLETS_OF_FUMBLING = OBJECT_NAMES.indexOf('gauntlets of fumbling');
const DUNCE_CAP = OBJECT_NAMES.indexOf('dunce cap');
const AMULET_OF_GUARDING = OBJECT_NAMES.indexOf('amulet of guarding');
const AMULET_OF_CHANGE = OBJECT_NAMES.indexOf('amulet of change');
const RIN_INCREASE_ACCURACY = OBJECT_NAMES.indexOf('increase accuracy');
const RIN_INCREASE_DAMAGE = OBJECT_NAMES.indexOf('increase damage');
void test('elven boots announce quiet walking and their noisy loss', async () => {
    freshObjectRoom();
    const boots = await addInventoryObject(ELVEN_BOOTS, { typeKnown: false, known: false });
    const worn = await dress('W', boots);
    assert.match(worn, /You walk very quietly\./);
    assert.equal(objectTypeKnown(boots), true);
    const removed = await dress('T', boots);
    assert.match(removed, /You sure are noisy\./);
    assert.equal(boots.worn, false);
});
void test('levitating elven boots float imperceptibly instead of walking quietly', async () => {
    freshObjectRoom();
    grantIntrinsicProperty('levitation', 'outside');
    const boots = await addInventoryObject(ELVEN_BOOTS, { typeKnown: false, known: false });
    const worn = await dress('W', boots);
    assert.match(worn, /You float imperceptibly\./);
    assert.equal(objectTypeKnown(boots), true);
});
void test('speed boots over intrinsic speed speed the hero up a bit more', async () => {
    freshObjectRoom();
    grantIntrinsicProperty('fast', 'outside');
    const boots = await addInventoryObject(SPEED_BOOTS, { typeKnown: false, known: false });
    const worn = await dress('W', boots);
    assert.match(worn, /You feel yourself speed up a bit more\./);
    assert.equal(objectTypeKnown(boots), true);
});
void test('a helm of brilliance adds its enchantment to intelligence and wisdom', async () => {
    freshObjectRoom();
    const helm = await addInventoryObject(HELM_OF_BRILLIANCE, {
        typeKnown: false, spe: 2, known: false,
    });
    const intelligence = currentAttribute(A_INT);
    const wisdom = currentAttribute(A_WIS);
    await dress('W', helm);
    assert.equal(currentAttribute(A_INT), intelligence + 2);
    assert.equal(currentAttribute(A_WIS), wisdom + 2);
    assert.equal(objectTypeKnown(helm), true);
    await dress('T', helm);
    assert.equal(currentAttribute(A_INT), intelligence);
    assert.equal(currentAttribute(A_WIS), wisdom);
});
void test('a zero-enchantment helm of brilliance stays undiscovered while worn', async () => {
    freshObjectRoom();
    const helm = await addInventoryObject(HELM_OF_BRILLIANCE, {
        typeKnown: false, spe: 0, known: false,
    });
    await dress('W', helm);
    assert.equal(objectTypeKnown(helm), false);
});
void test('gauntlets of dexterity raise dexterity by their enchantment', async () => {
    freshObjectRoom();
    const gauntlets = await addInventoryObject(GAUNTLETS_OF_DEXTERITY, {
        typeKnown: false, spe: 3, known: false,
    });
    const dexterity = currentAttribute(A_DEX);
    await dress('W', gauntlets);
    assert.equal(currentAttribute(A_DEX), dexterity + 3);
    assert.equal(objectTypeKnown(gauntlets), true);
    await dress('T', gauntlets);
    assert.equal(currentAttribute(A_DEX), dexterity);
});
void test('gauntlets of fumbling start a fumbling timeout and lose it on removal', async () => {
    freshObjectRoom();
    const gauntlets = await addInventoryObject(GAUNTLETS_OF_FUMBLING, { typeKnown: true, known: false });
    await dress('W', gauntlets);
    assert.ok(propertyTimeout('fumbling', game) > 0);
    await dress('T', gauntlets);
    assert.equal(propertyTimeout('fumbling', game), 0);
});
void test('a hallucinating hero wearing a dunce cap feels their brain hurt', async () => {
    freshObjectRoom();
    await makeHallucinated(50, { talk: false });
    const hat = await addInventoryObject(DUNCE_CAP, { cursed: false, known: false });
    const worn = await dress('W', hat);
    assert.match(worn, /My brain hurts!/);
    assert.doesNotMatch(worn, /corner|giddy/);
});
void test('an amulet of guarding is discovered and lowers armor class while worn', async () => {
    freshObjectRoom();
    const amulet = await addInventoryObject(AMULET_OF_GUARDING, { typeKnown: false });
    findArmorClass(game);
    const bareArmorClass = game.u.uac ?? 10;
    await dress('P', amulet);
    assert.equal(objectTypeKnown(amulet), true);
    assert.equal(game.u.uac, bareArmorClass - 2);
    await dress('R', amulet);
    await moveloop_core();
    assert.equal(game.u.uac, bareArmorClass);
});
void test('an amulet of change flips gender and disintegrates', async () => {
    freshObjectRoom();
    const amulet = await addInventoryObject(AMULET_OF_CHANGE, { typeKnown: false });
    const wasFemale = !!game.flags.female;
    await dress('P', amulet);
    assert.equal(!!game.flags.female, !wasFemale);
    assert.match(game._pending_message ?? '', /The amulet disintegrates!/);
    assert.equal(game.uamul, null);
    assert.equal(game.inventory.includes(amulet), false);
    assert.equal(objectTypeKnown(amulet), true);
});
void test('a blind hero still observes a known-type ring through its effect', async () => {
    freshObjectRoom({ hero: { blindTurns: 40 } });
    // The type is known from an earlier ring; this copy has never been seen.
    recordObjectKnowledge(OBJECT_NAMES.indexOf('stealth'), game);
    const unseen = await addInventoryObject(OBJECT_NAMES.indexOf('stealth'), {
        typeKnown: false, dknown: false, observed: false,
    });
    assert.equal(unseen.dknown, false);
    resetInputState().feed(`${unseen.invlet}r `);
    await rhack('P'.charCodeAt(0));
    // C learnring() -> observe_object(): observing the effect marks the
    // ring's appearance known even without sight; hallucination, not
    // blindness, is what suppresses it.
    assert.equal(unseen.dknown, true);
    assert.equal(unseen.worn, true);
});
void test('rings of accuracy and damage adjust the combat bonuses of their hand', async () => {
    freshObjectRoom();
    const accuracy = await addInventoryObject(RIN_INCREASE_ACCURACY, { spe: 2, known: true });
    const damage = await addInventoryObject(RIN_INCREASE_DAMAGE, { spe: 1, known: true });
    resetInputState().feed(`${accuracy.invlet}r `);
    await rhack('P'.charCodeAt(0));
    resetInputState().feed(`${damage.invlet} `);
    await rhack('P'.charCodeAt(0));
    assert.equal(game.u.uhitinc, 2);
    assert.equal(game.u.udaminc, 1);
    resetInputState().feed(`${accuracy.invlet} `);
    await rhack('R'.charCodeAt(0));
    resetInputState().feed(`${damage.invlet} `);
    await rhack('R'.charCodeAt(0));
    assert.equal(game.u.uhitinc, 0);
    assert.equal(game.u.udaminc, 0);
});
async function dress(command, object) {
    assert.ok(object.invlet);
    game._moveloopStarted = true;
    game.u.umovement = 12;
    const input = resetInputState();
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    // Single worn items auto-answer T and R; only W and P query the letter.
    const keys = command === 'W' || command === 'P' ? object.invlet : '';
    input.feed(`${keys}                      \x1b\x1b`);
    await rhack(command.charCodeAt(0));
    // Native setworn() installs worn armor immediately; its *_on() callback
    // (and the knowledge it grants) only runs when the delay expires.
    const finished = command === 'W' ? () => object.known === true
        : command === 'T' ? () => object.worn === false
            : () => true;
    for (let turn = 0; turn < 40 && !finished(); turn++) {
        await moveloop_core();
    }
    return [...messages, game._pending_message].join(' ');
}
//# sourceMappingURL=wear_callbacks_audit.test.js.map