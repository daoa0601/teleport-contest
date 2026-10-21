import { requireFixtureGame } from './support/game-state.js';
import type { KeyInput } from '../js/input.js';
import type { InputGate } from '../js/input.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { GETOBJ_SUGGEST } from '../js/const.js';
import { bot, pline } from '../js/display.js';
import { requireGameDisplay, game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { selectInventoryObject, showIdentifiedInventory } from '../js/invent.js';
import { chooseInventoryObject } from '../js/inventory_prompt.js';
import { DAGGER } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

async function fullPack({ stack = false } = {}) {
    freshObjectRoom();
    const objects = [];
    for (let index = 0; index < 36; index++) {
        // Distinct enchantments keep these real inventory objects separate.
        objects.push(await addInventoryObject(DAGGER, {
            spe: index, quan: stack && index === 30 ? 8 : 1,
        }));
    }
    const first = objects[0];
    const later = objects[30];
    assert.ok(first?.invlet && later?.invlet);
    return { objects, first, later, firstLetter: first.invlet, laterLetter: later.invlet };
}

function menuText() {
    return requireGameDisplay(game).grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
}

async function answerMenu(input: InputGate, key: KeyInput) {
    input.feed(key);
    await input.waitUntilBlocked();
}

void test('an inventory menu acknowledges unread prose before taking a selection', async () => {
    const pack = await fullPack();
    await pline('You notice something nearby.');
    const input = resetInputState();
    const selection = selectInventoryObject();
    await input.waitUntilBlocked();
    assert.match(menuText(), /You notice something nearby\.--More--/);
    await answerMenu(input, pack.firstLetter);
    assert.match(menuText(), /--More--/);
    await answerMenu(input, ' ');
    assert.match(menuText(), /\(1 of 2\)/);
    input.feed(pack.firstLetter);

    assert.deepEqual(await selection, { key: pack.firstLetter.charCodeAt(0), count: null });
});

void test('full inventory pages reject unavailable selectors and support forward, backward, first, and last navigation', async () => {
    const pack = await fullPack();
    requireFixtureGame(game);
    const input = resetInputState();
    const selection = selectInventoryObject();
    await input.waitUntilBlocked();
    assert.match(menuText(), /\(1 of 2\)/);

    await answerMenu(input, pack.laterLetter);
    await answerMenu(input, '\x01');
    assert.match(menuText(), /\(1 of 2\)/);
    await answerMenu(input, '>');
    assert.match(menuText(), /\(2 of 2\)/);
    await answerMenu(input, '<');
    assert.match(menuText(), /\(1 of 2\)/);
    await answerMenu(input, '|');
    assert.match(menuText(), /\(2 of 2\)/);
    await answerMenu(input, '^');
    assert.match(menuText(), /\(1 of 2\)/);
    await answerMenu(input, ' ');
    assert.match(menuText(), /\(2 of 2\)/);
    input.feed(pack.laterLetter);

    assert.deepEqual(await selection, { key: pack.laterLetter.charCodeAt(0), count: null });
    assert.equal(game.inventory.length, 36);
    assert.equal(requireGameDisplay(game).grid[11]?.[9]?.ch, '@', 'the full window restores the live map');
    assert.equal(game._pending_message || game._retained_message || '', '');
});

void test('next-page at the last page stays open and Return commits no selection', async () => {
    await fullPack();
    const input = resetInputState();
    const selection = selectInventoryObject();
    await input.waitUntilBlocked();
    await answerMenu(input, '|');
    await answerMenu(input, '>');
    assert.match(menuText(), /\(2 of 2\)/);
    input.feed('\n');

    assert.deepEqual(await selection, { key: 0, count: null });
});

void test('Escape cancels a count first and a later Escape cancels the menu', async () => {
    await fullPack();
    requireFixtureGame(game);
    const input = resetInputState();
    const selection = selectInventoryObject();
    await input.waitUntilBlocked();
    await answerMenu(input, '3');
    await answerMenu(input, '\x1b');
    assert.match(menuText(), /\(1 of 2\)/);
    input.feed('\x1b');

    assert.deepEqual(await selection, { key: 27, count: null });
    assert.equal(requireGameDisplay(game).grid[11]?.[9]?.ch, '@');
});

void test('a menu count reaches the real quiver command and splits only that amount', async () => {
    const pack = await fullPack({ stack: true });
    requireFixtureGame(game);
    const stack = pack.later;
    const input = resetInputState();
    input.feed('*');
    const action = rhack('Q'.charCodeAt(0));
    await input.waitUntilBlocked();
    await answerMenu(input, '|');
    input.feed(`3${stack.invlet}`);
    await action;

    assert.ok(game.uquiver);
    assert.equal(game.uquiver.quan, 3);
    assert.equal(game.uquiver.otyp, DAGGER);
    assert.equal(stack.quan, 5);
    assert.equal(game.context.move, 0);
});

void test('a no-count getobj command accepts a menu count without splitting its selected stack', async () => {
    const pack = await fullPack({ stack: true });
    const input = resetInputState();
    input.feed('*');
    const choice = chooseInventoryObject('use or apply', () => GETOBJ_SUGGEST);
    await input.waitUntilBlocked();
    await answerMenu(input, '|');
    input.feed(`3${pack.laterLetter}`);

    assert.equal(await choice, pack.later);
    assert.equal(pack.later.quan, 8);
});

void test('search can select an inventory object on another page', async () => {
    const pack = await fullPack();
    pack.later.oextra = { oname: 'Voyager' };
    const input = resetInputState();
    const selection = selectInventoryObject();
    await input.waitUntilBlocked();
    await answerMenu(input, ':');
    assert.match(menuText(), /Search for:/);
    input.feed('voya*\n');

    assert.deepEqual(await selection, { key: pack.laterLetter.charCodeAt(0), count: null });
});

void test('an unselected inventory-menu dismissal returns to the getobj prompt', async () => {
    const pack = await fullPack();
    const input = resetInputState();
    input.feed('*');
    const choice = chooseInventoryObject('use or apply', () => GETOBJ_SUGGEST);
    await input.waitUntilBlocked();
    await answerMenu(input, '\n');
    assert.match(menuText(), /What do you want to use or apply\?/);
    input.feed(pack.firstLetter);

    assert.equal(await choice, pack.first);
});

void test('a read-only inventory window ignores selectors and bulk commands until a real dismissal', async () => {
    const pack = await fullPack();
    requireFixtureGame(game);
    const input = resetInputState();
    const inventory = showIdentifiedInventory();
    await input.waitUntilBlocked();
    await answerMenu(input, pack.firstLetter);
    await answerMenu(input, '@');
    assert.match(menuText(), /\(1 of 2\)/);
    await answerMenu(input, ' ');
    assert.match(menuText(), /\(2 of 2\)/);
    input.feed(' ');

    assert.deepEqual(await inventory, { key: 0, count: null });
    assert.equal(game.inventory.length, 36);
});

void test('selecting an item on a later inventory page restores the map before its action menu', async () => {
    const pack = await fullPack();
    requireFixtureGame(game);
    const input = resetInputState();
    const action = rhack('i'.charCodeAt(0));
    await input.waitUntilBlocked();
    await answerMenu(input, '|');
    await answerMenu(input, pack.laterLetter);
    assert.match(menuText(), /Do what with the/);
    assert.equal(requireGameDisplay(game).grid[11]?.[9]?.ch, '@');
    assert.equal(requireGameDisplay().grid[22]?.map(cell => cell.ch).join('').trim(), '');
    assert.equal(requireGameDisplay().grid[23]?.map(cell => cell.ch).join('').trim(), '');
    input.feed('\x1b');
    await action;

    assert.equal(game.context.move, 0);
    assert.equal(game.inventory.length, 36);
    assert.equal(requireGameDisplay(game).grid[11]?.[9]?.ch, '@');
});

void test('a short inventory retains the status lines when its item action menu opens', async () => {
    freshObjectRoom();
    const item = await addInventoryObject(DAGGER);
    await bot();
    const input = resetInputState();
    const action = rhack('i'.charCodeAt(0));
    await input.waitUntilBlocked();
    await answerMenu(input, item.invlet);

    assert.match(menuText(), /Do what with the/);
    assert.match(requireGameDisplay(game).grid[22]?.map(cell => cell.ch).join('') ?? '', /St:12/);
    assert.match(requireGameDisplay(game).grid[23]?.map(cell => cell.ch).join('') ?? '', /HP:40\(40\)/);
    input.feed('\x1b');
    await action;
});

// C ddoinv() destroys its corner menu after select_menu() has restored
// bot_disabled; docorner() then repaints the status it reached from the
// current hero, including energy raised without a status request.
void test('dismissing a map-height inventory repaints stale status values', async () => {
    freshObjectRoom();
    // A heading, twenty items, and "(end)" fill every map row.
    for (let index = 0; index < 20; index++) await addInventoryObject(DAGGER, { spe: index });
    await bot();
    game.u.uen = game.u.uenmax = 50;
    const input = resetInputState();
    const action = rhack('i'.charCodeAt(0));
    await input.waitUntilBlocked();
    assert.doesNotMatch(requireGameDisplay(game).grid[23]?.map(cell => cell.ch).join('') ?? '', /Pw:50\(50\)/);
    input.feed('\x1b');
    await action;

    assert.match(requireGameDisplay(game).grid[23]?.map(cell => cell.ch).join('') ?? '', /Pw:50\(50\)/);
});
