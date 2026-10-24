import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { moveloop_core } from '../js/allmain.js';
import { W_ARM, W_ARMC, W_SWAPWEP, W_WEP } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKey } from '../js/input.js';
import { inventoryItemDescription } from '../js/invent.js';
import { DAGGER, LEATHER_CLOAK, LONG_SWORD, RING_MAIL, SMALL_SHIELD, OBJECT_NAMES } from '../js/object_data.js';
import { setPrimaryWeapon, setQuiverObject, setSecondaryWeapon } from '../js/weapon_slots.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { freshTurnRoom } from './support/playable-room.js';

void test('putting on named zero-delay armor uses its noun without inventory details', async () => {
    freshObjectRoom();
    const shield = await addInventoryObject(SMALL_SHIELD, { blessed: true, spe: 2, oname: 'Shelter' });
    pushKey(shield.invlet);

    await rhack('W'.charCodeAt(0));

    assert.equal(game._pending_message, 'You are now wearing a small shield named Shelter.');
    assert.equal(game.uarms, shield);
    assert.equal(await inventoryItemDescription(shield), 'a blessed +2 small shield named Shelter (being worn)');
});

void test('nonverbose zero-delay armor wear keeps its state change without the verbose message', async () => {
    freshObjectRoom({ flags: { verbose: false } });
    const shield = await addInventoryObject(SMALL_SHIELD);
    pushKey(shield.invlet);

    await rhack('W'.charCodeAt(0));

    assert.equal(game.uarms, shield);
    assert.doesNotMatch(game._pending_message, /now wearing/);
    assert.equal(game.context.move, 1);
});

void test('wearing cursed wielded armor frees the hand before its dressing delay', async () => {
    freshObjectRoom();
    const armor = await addInventoryObject(RING_MAIL, { cursed: true, known: false });
    await setPrimaryWeapon(armor);
    pushKey(armor.invlet);

    await rhack('W'.charCodeAt(0));

    assert.equal(game.uwep, null);
    assert.equal(game.u.uwep, null);
    assert.equal(game.uarm, armor);
    assert.equal(armor.owornmask, W_ARM);
    assert.equal(armor.wielded, false);
    assert.equal(armor.known, false);
    assert.match(await inventoryItemDescription(armor), /\(being donned\)$/);
    assert.equal(game.context.move, 1);
});

void test('wearing an alternate cloak removes its alternate slot and finishes immediately', async () => {
    freshObjectRoom();
    const cloak = await addInventoryObject(LEATHER_CLOAK, { known: false });
    await setSecondaryWeapon(cloak);
    pushKey(cloak.invlet);

    await rhack('W'.charCodeAt(0));

    assert.equal(game.uswapwep, null);
    assert.equal(game.u.uswapwep, null);
    assert.equal(game.uarmc, cloak);
    assert.equal(cloak.owornmask, W_ARMC);
    assert.equal(cloak.alternate, false);
    assert.equal(cloak.known, true);
    assert.match(await inventoryItemDescription(cloak), /\(being worn\)$/);
    assert.equal(game.context.move, 1);
});

void test('wearing readied armor clears only the quiver and keeps an unrelated welded weapon', async () => {
    freshObjectRoom();
    const sword = await addInventoryObject(LONG_SWORD, { cursed: true });
    const dagger = await addInventoryObject(DAGGER);
    const armor = await addInventoryObject(RING_MAIL);
    await setPrimaryWeapon(sword);
    await setSecondaryWeapon(dagger);
    await setQuiverObject(armor);
    pushKey(armor.invlet);

    await rhack('W'.charCodeAt(0));

    assert.equal(game.uquiver, null);
    assert.equal(game.u.uquiver, null);
    assert.equal(game.uarm, armor);
    assert.equal(armor.owornmask, W_ARM);
    assert.equal(armor.ready, false);
    assert.match(await inventoryItemDescription(armor), /\(being donned\)$/);
    assert.equal(game.uwep, sword);
    assert.equal(sword.owornmask, W_WEP);
    assert.equal(game.uswapwep, dagger);
    assert.equal(dagger.owornmask, W_SWAPWEP);
    assert.equal(game.context.move, 1);
});

void test('armor class updates before the next dressing action when movement remains in the current turn', async () => {
    const input = freshTurnRoom({ flags: { tips: false, verbose: false } });
    const boots = await addInventoryObject(OBJECT_NAMES.indexOf('jumping boots'), { known: false });
    game.u.umovement = 24;
    const turn = game.moves;
    input.feed(`W${boots.invlet}`);

    await moveloop_core();
    await moveloop_core();

    assert.equal(game.moves, turn, 'Spending the spare movement ration does not advance the world');
    assert.equal(game.u.uac, 9, 'The worn boots protect the hero before monsters receive their next action');
    assert.equal(boots.known, false, 'The dressing completion callback has not run yet');
});
