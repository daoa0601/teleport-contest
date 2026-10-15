import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { ARROW, DAGGER } from '../js/object_data.js';
import { setPrimaryWeapon, setQuiverObject, setSecondaryWeapon } from '../js/weapon_slots.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';

function stackRoom() {
    freshObjectRoom({ role: 'rogue', flags: { pushweapon: true } });
    const input = resetInputState();
    installPagerInput(input, { expected: /dagger|arrow|wield|readied|welded/, limit: 20 });
}

void test('wielding a counted stack leaves the unselected daggers in inventory', async () => {
    stackRoom();
    const daggers = await addInventoryObject(DAGGER, { quan: 5 });

    pushKeys(`2${daggers.invlet}`);
    await rhack('w'.charCodeAt(0));

    const weapon = game.uwep;
    assert.ok(weapon);
    assert.notEqual(weapon, daggers);
    assert.equal(weapon.quan, 2);
    assert.equal(daggers.quan, 3);
    assert.notEqual(weapon.invlet, daggers.invlet);
    assert.equal(game.context.move, 1);
});

void test('a counted selection of an already wielded stack keeps the whole stack wielded', async () => {
    stackRoom();
    const daggers = await addInventoryObject(DAGGER, { quan: 5 });
    await setPrimaryWeapon(daggers);

    pushKeys(`2${daggers.invlet}`);
    await rhack('w'.charCodeAt(0));

    assert.equal(game.uwep, daggers);
    assert.equal(daggers.quan, 5);
    assert.equal(game.inventory.length, 1);
    assert.equal(game._pending_message, 'You are already wielding that!');
    assert.equal(game.context.move, 0);
});

void test('a counted alternate selection wields just the selected portion', async () => {
    stackRoom();
    const primary = await addInventoryObject(DAGGER, { spe: 1 });
    const alternate = await addInventoryObject(DAGGER, { quan: 5, spe: 2 });
    await setPrimaryWeapon(primary);
    await setSecondaryWeapon(alternate);

    pushKeys(`2${alternate.invlet}`);
    await rhack('w'.charCodeAt(0));

    assert.equal(game.uwep?.quan, 2);
    assert.notEqual(game.uwep, alternate);
    assert.equal(alternate.quan, 3);
    assert.equal(game.uswapwep, primary);
});

void test('wielding one quivered arrow preserves the remaining quiver stack', async () => {
    stackRoom();
    const arrows = await addInventoryObject(ARROW, { quan: 5 });
    await setQuiverObject(arrows);

    pushKeys(`${arrows.invlet}y`);
    await rhack('w'.charCodeAt(0));

    assert.equal(game.uquiver, arrows);
    assert.equal(arrows.quan, 4);
    assert.equal(game.uwep?.quan, 1);
    assert.notEqual(game.uwep, arrows);
    assert.equal(game.context.move, 1);
});

void test('declining both quiver choices leaves the arrows readied', async () => {
    stackRoom();
    const arrows = await addInventoryObject(ARROW, { quan: 5 });
    await setQuiverObject(arrows);

    pushKeys(`${arrows.invlet}nn`);
    await rhack('w'.charCodeAt(0));

    assert.equal(game.uquiver, arrows);
    assert.equal(game.uwep, null);
    assert.equal(arrows.quan, 5);
    assert.equal(game.context.move, 0);
    assert.equal(game._pending_message, 'Your arrows remain readied.');
});

void test('confirming the whole quiver stack moves it into the wielded slot', async () => {
    stackRoom();
    const arrows = await addInventoryObject(ARROW, { quan: 5 });
    await setQuiverObject(arrows);

    pushKeys(`${arrows.invlet}ny`);
    await rhack('w'.charCodeAt(0));

    assert.equal(game.uquiver, null);
    assert.equal(game.uwep, arrows);
    assert.equal(arrows.quan, 5);
    assert.equal(game.context.move, 1);
});

void test('a welded primary refuses a counted selection without leaving a split stack', async () => {
    stackRoom();
    const welded = await addInventoryObject(DAGGER, { cursed: true });
    const arrows = await addInventoryObject(ARROW, { quan: 5 });
    await setPrimaryWeapon(welded);

    pushKeys(`2${arrows.invlet}`);
    await rhack('w'.charCodeAt(0));

    assert.equal(game.uwep, welded);
    assert.equal(arrows.quan, 5);
    assert.equal(game.inventory.length, 2);
    assert.equal(game.context.move, 0);
});
