import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { identifyPack } from '../js/invent.js';
import { requireGameDisplay, game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { CLUB, POT_HEALING, SACK } from '../js/object_data.js';
import { applyNethackrc } from '../js/options.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshGameplayRoom } from './support/playable-room.js';

void test('identifying the whole pack reveals every part of an object', async () => {
    freshGameplayRoom();
    const club = await addInventoryObject(CLUB, {
        invlet: 'a',
        known: false,
        typeKnown: false,
        bknown: false,
        dknown: false,
        rknown: false,
    });

    await identifyPack(0);

    assert.equal(club.typeKnown, true);
    assert.equal(club.known, true);
    assert.equal(club.bknown, true);
    assert.equal(club.dknown, true);
    assert.equal(club.rknown, true);
});

for (const identify of [false, true] as const) {
    void test(`wizard identification ${identify ? 'identifies only the selected item' : 'can be cancelled without identifying items'}`, async () => {
        freshGameplayRoom();
        requireFixtureGame(game);
        applyNethackrc('OPTIONS=playmode:debug');
        const unknown = { known: false, typeKnown: false, bknown: false, rknown: false };
        const club = await addInventoryObject(CLUB, unknown);
        const potion = await addInventoryObject(POT_HEALING, unknown);
        const moves = game.moves;
        const input = resetInputState();
        let menu = '';
        input.beforeRead = () => {
            const screen = requireGameDisplay(game).grid
                .map(row => row.map(cell => cell.ch).join('')).join('\n');
            if (screen.includes('Debug Identify')) menu = screen;
        };

        await runExtendedCommand('wizidentify', identify ? potion.invlet + '\n' : '\x1b');

        assert.match(menu, /Weapons[\s\S]*Potions/);
        assert.match(menu, /potion of healing/);
        assert.equal(club.known, false);
        assert.equal(potion.known, identify);
        assert.equal(potion.bknown, identify);
        assert.equal(potion.rknown, identify);
        assert.equal(game.context.move, 0);
        assert.equal(game.moves, moves);
    });
}


void test('identification retries an empty choice and Escape ends it without identifying', async () => {
    freshGameplayRoom();
    requireFixtureGame(game);
    const club = await addInventoryObject(CLUB, { known: false, bknown: false });
    const potion = await addInventoryObject(POT_HEALING, { known: false, bknown: false });
    const input = resetInputState();
    const identification = identifyPack(1);
    await input.waitUntilBlocked();

    input.feed('\n');
    await input.waitUntilBlocked();
    assert.match(game._pending_message, /Choose an item; use ESC to decline/);
    input.feed(' ');
    await input.waitUntilBlocked();
    input.feed('\x1b');
    await identification;

    assert.equal(club.known, false);
    assert.equal(potion.known, false);
});

void test('identification announces a chosen item before asking for the next one', async () => {
    freshGameplayRoom();
    requireFixtureGame(game);
    const first = await addInventoryObject(CLUB, { known: false, bknown: false, spe: 1 });
    const second = await addInventoryObject(POT_HEALING, { known: false, bknown: false });
    const other = await addInventoryObject(CLUB, { known: false, bknown: false, spe: 2 });
    const input = resetInputState();
    const identification = identifyPack(2);
    await input.waitUntilBlocked();

    input.feed(`${first.invlet}\n`);
    await input.waitUntilBlocked();
    assert.equal(first.known, true);
    assert.equal(second.known, false);
    assert.match(game._pending_message, /club/);
    input.feed(' ');
    await input.waitUntilBlocked();
    input.feed(`${second.invlet}\n`);
    await identification;

    assert.equal(second.known, true);
    assert.equal(other.known, false);
});


function traditionalIdentificationRoom() {
    freshGameplayRoom();
    applyNethackrc('OPTIONS=menustyle:traditional');
    return resetInputState();
}

void test('traditional identify questions object classes in the requested order', async () => {
    const input = traditionalIdentificationRoom();
    requireFixtureGame(game);
    const potion = await addInventoryObject(POT_HEALING, { known: false, bknown: false });
    const club = await addInventoryObject(CLUB, { known: false, bknown: false });
    const other = await addInventoryObject(SACK, { known: false, bknown: false });
    const identification = identifyPack(2);
    await input.waitUntilBlocked();
    assert.match(game._pending_message, /What kinds of thing do you want to identify/);

    input.feed(')!\n');
    await input.waitUntilBlocked();
    assert.match(game._pending_message, /club.*\[ynaq\]/);
    input.feed('y');
    await input.waitUntilBlocked();
    assert.equal(club.known, true);
    assert.equal(potion.known, false);
    input.feed(' ');
    await input.waitUntilBlocked();
    assert.match(game._pending_message, /potion.*\[ynaq\]/);
    input.feed('y');
    await identification;

    assert.equal(potion.known, true);
    assert.equal(other.known, false);
});

void test('traditional identify combines a class with known blessing and preserves stacks', async () => {
    const input = traditionalIdentificationRoom();
    const blessed = await addInventoryObject(POT_HEALING, {
        known: false, blessed: true, bknown: true, quan: 5,
    });
    const uncursed = await addInventoryObject(POT_HEALING, {
        known: false, blessed: false, cursed: false, bknown: true,
    });
    const club = await addInventoryObject(CLUB, { known: false, blessed: true, bknown: true });
    input.feed('!Ba\n');

    await identifyPack(1);

    assert.equal(blessed.known, true);
    assert.equal(blessed.quan, 5);
    assert.equal(uncursed.known, false);
    assert.equal(club.known, false);
});

void test('traditional identify can switch to an item-selection menu', async () => {
    const input = traditionalIdentificationRoom();
    const club = await addInventoryObject(CLUB, { known: false, bknown: false });
    const potion = await addInventoryObject(POT_HEALING, { known: false, bknown: false });
    input.feed(`m\n${potion.invlet}\n`);

    await identifyPack(1);

    assert.equal(potion.known, true);
    assert.equal(club.known, false);
});

void test('traditional identify lets the player quit an item question', async () => {
    const input = traditionalIdentificationRoom();
    const club = await addInventoryObject(CLUB, { known: false, bknown: false });
    const potion = await addInventoryObject(POT_HEALING, { known: false, bknown: false });
    input.feed('A\nq');

    await identifyPack(1);

    assert.equal(potion.known, false);
    assert.equal(club.known, false);
});

void test('identify includes unknown container contents despite otherwise known properties', async () => {
    freshGameplayRoom();
    const sack = await addInventoryObject(SACK, {
        known: true, typeKnown: true, dknown: true, bknown: true, rknown: true, cknown: false,
    });

    await identifyPack(1);

    assert.equal(sack.cknown, true);
});

void test('identify does not spend an identification on irrelevant potion erosion knowledge', async () => {
    freshGameplayRoom();
    const potion = await addInventoryObject(POT_HEALING, {
        known: true, typeKnown: true, dknown: true, bknown: true, rknown: false,
    });
    const club = await addInventoryObject(CLUB, { known: false });

    await identifyPack(1);

    assert.equal(potion.rknown, false);
    assert.equal(club.known, true);
});
