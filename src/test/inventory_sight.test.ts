import { requireFixtureGame } from './support/game-state.js';
import type { InputGate } from '../js/input.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { requireGameDisplay, game } from '../js/gstate.js';
import { gameLogEvents } from '../js/gamelog.js';
import { pline } from '../js/display.js';
import { resetInputState } from '../js/input.js';
import { SCR_TELEPORTATION, SCR_IDENTIFY, SCR_BLANK_PAPER } from '../js/object_data.js';
import { objectTypeKnown } from '../js/shk.js';
import { objectName } from '../js/objnam.js';
import { pickupAtHero } from '../js/pickup.js';
import { heroIsBlind, setHeroBlindnessTurns } from '../js/senses.js';
import { changeTutorialState } from '../js/tutorial_state.js';
import { addInventoryObject, floorObject, knownObject } from './support/game-objects.js';
import { learnUnseenInventory } from '../js/hero_inventory.js';
import { addCreatedObjectToContainer } from '../js/object_container.js';
import { CLUB, SACK } from '../js/object_data.js';
import { removeCurseEffect } from '../js/scroll_effects.js';
import { makeWish } from '../js/wish.js';
import { restoreGame, saveGame } from '../js/save.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
import { completeHeroStartup } from './support/startup.js';
import { addInventoryItem, makedog } from '../js/u_init.js';
import { mksobj } from '../js/mklev.js';
import { GameDisplay } from '../js/game_display.js';

async function unseenScroll(otyp = SCR_IDENTIFY, quantity = 1) {
    return await floorObject(otyp, game.u.ux, game.u.uy, {
        known: false, typeKnown: false, dknown: false, bknown: false,
        quan: quantity,
    });
}

function acknowledgeMessages(input: InputGate, messages: string[]) {
    input.beforeRead = () => {
        messages.push(game._pending_message || '');
        input.feed(' ');
    };
}

void test('an Archeologist deciphers a carried scroll stack without reading or consuming it', async () => {
    freshObjectRoom({ role: 'archeologist' });
    requireFixtureGame(game);
    const input = resetInputState();
    const messages: string[] = [];
    acknowledgeMessages(input, messages);
    const scroll = await unseenScroll(SCR_IDENTIFY, 3);

    await pickupAtHero();
    messages.push(game._pending_message || '');

    assert.ok(scroll);
    assert.equal(objectTypeKnown(scroll), true);
    assert.equal(scroll.quan, 3);
    assert.ok(game.inventory.includes(scroll));
    assert.match(messages.join('\n'), /You decipher the label on your scrolls labeled .+\./u);
    assert.equal(game.u.uconduct.literate, 1);
    assert.equal(gameLogEvents().filter(event => event.text ===
        'became literate by deciphering a scroll label').length, 1);
});

void test('deciphering waits for the label message before learning the type or breaking conduct', async () => {
    freshObjectRoom({ role: 'archeologist' });
    requireFixtureGame(game);
    const input = resetInputState();
    const scroll = await unseenScroll();
    await pline('The corridor stretches away into the cold and silent darkness.');
    const pickingUp = pickupAtHero();
    await input.waitUntilBlocked();
    try {
        assert.equal(objectTypeKnown(scroll), false);
        assert.equal(game.u.uconduct.literate || 0, 0);
        assert.equal(scroll.dknown, true);
        assert.ok(game.inventory.includes(scroll));
    } finally {
        acknowledgeMessages(input, []);
        input.feed(' ');
        await pickingUp;
    }
    assert.ok(scroll);
    assert.equal(objectTypeKnown(scroll), true);
    assert.equal(objectName(scroll), 'scroll of identify');
    assert.equal(game.u.uconduct.literate, 1);
});

void test('each newly deciphered type counts once and only the first breaks illiteracy', async () => {
    freshObjectRoom({ role: 'archeologist' });
    requireFixtureGame(game);
    const input = resetInputState();
    acknowledgeMessages(input, []);
    await unseenScroll();
    await pickupAtHero();
    await unseenScroll();
    await pickupAtHero();
    await unseenScroll(SCR_TELEPORTATION);
    await pickupAtHero();

    assert.equal(game.u.uconduct.literate, 2);
    assert.equal(gameLogEvents().filter(event => event.text ===
        'became literate by deciphering a scroll label').length, 1);
});

for (const [role, blind, otyp] of [
    ['archeologist', true, SCR_IDENTIFY],
    ['caveman', false, SCR_IDENTIFY],
    ['archeologist', false, SCR_BLANK_PAPER],
] as const) {
    void test(`${role} ${blind ? 'without sight' : 'with sight'} does not decipher ${otyp === SCR_BLANK_PAPER ? 'blank paper' : 'an ineligible scroll'}`, async () => {
        freshObjectRoom({ role });
        requireFixtureGame(game);
        const input = resetInputState();
        acknowledgeMessages(input, []);
        if (blind) setHeroBlindnessTurns(20);
        const scroll = await unseenScroll(otyp);

        await pickupAtHero();

        assert.equal(game.u.uconduct.literate || 0, 0);
        assert.equal(objectTypeKnown(scroll), false);
    });
}

void test('tutorial return deciphers saved unseen scrolls using the current sight before restoring the hero', async () => {
    freshObjectRoom({ role: 'archeologist' });
    requireFixtureGame(game);
    const input = resetInputState();
    const messages: string[] = [];
    acknowledgeMessages(input, messages);
    setHeroBlindnessTurns(20);
    const scroll = await unseenScroll();
    await pickupAtHero();
    await changeTutorialState(game);
    setHeroBlindnessTurns(0);

    await changeTutorialState(game, true);
    messages.push(game._pending_message || '');

    assert.ok(game.inventory.includes(scroll));
    assert.ok(scroll);
    assert.equal(objectTypeKnown(scroll), true);
    assert.equal(heroIsBlind(), true);
    assert.equal(game.u.uconduct.literate || 0, 0);
    assert.match(messages.join('\n'), /You decipher the label/u);
});


void test('seeing carried inventory learns its scrolls but does not inspect bag contents', async () => {
    freshObjectRoom({ role: 'archeologist' });
    requireFixtureGame(game);
    const input = resetInputState();
    acknowledgeMessages(input, []);
    setHeroBlindnessTurns(20);
    const scroll = await unseenScroll();
    await pickupAtHero();
    const bag = await addInventoryObject(SACK);
    const hidden = await knownObject(SCR_TELEPORTATION, {
        known: false, typeKnown: false, dknown: false, bknown: false,
    });
    await addCreatedObjectToContainer(bag, hidden);
    await learnUnseenInventory();
    assert.equal(scroll.dknown, false);
    assert.equal(game.u.uconduct.literate || 0, 0);
    setHeroBlindnessTurns(0);

    await learnUnseenInventory();
    await learnUnseenInventory();

    assert.ok(scroll);
    assert.equal(objectTypeKnown(scroll), true);
    assert.equal(scroll.dknown, true);
    assert.equal(hidden.dknown, false);
    assert.equal(objectTypeKnown(hidden), false);
    assert.equal(game.u.uconduct.literate, 1);
});

for (const role of ['priest', 'caveman'] as const) {
    void test(`${role} ${role === 'priest' ? 'recognizes' : 'cannot recognize'} changed beatitude on an already seen item`, async () => {
        freshObjectRoom({ role });
        const club = await addInventoryObject(CLUB);
        await removeCurseEffect({ blessed: true, confused: true, announce: false });
        assert.equal(club.dknown, true);
        assert.equal(club.bknown, false);

        await learnUnseenInventory();

        assert.equal(club.bknown, role === 'priest');
    });
}

void test('a hallucinating Archeologist still deciphers a wished-for scroll', async () => {
    freshObjectRoom({ role: 'archeologist', hero: { hallucinationTurns: 20 } });
    requireFixtureGame(game);
    const input = resetInputState();
    const keys = [...'scroll of identify\n'];
    input.beforeRead = () => {
        const row = requireGameDisplay(game).grid[0];
        assert.ok(row);
        const top = row.map(cell => cell.ch).join('');
        input.feed(top.includes('--More--') ? ' ' : keys.shift() ?? ' ');
    };

    await makeWish();

    const scroll = game.inventory.find(object => object.otyp === SCR_IDENTIFY);
    assert.ok(scroll);
    assert.equal(scroll.dknown, false);
    assert.ok(scroll);
    assert.equal(objectTypeKnown(scroll), true);
    assert.equal(game.u.uconduct.literate, 1);
});

void test('saving and restoring learned labels preserves knowledge and literacy', async () => {
    freshObjectRoom({ role: 'archeologist' });
    requireFixtureGame(game);
    const input = resetInputState();
    acknowledgeMessages(input, []);
    await unseenScroll();
    await pickupAtHero();
    const storage = memoryStorage();
    game.plname = 'Labels';
    game.storage = storage;
    assert.equal(await saveGame(storage), true);

    assert.equal(restoreGame('Labels', storage), true);
    await learnUnseenInventory();

    const scroll = game.inventory.find(object => object.otyp === SCR_IDENTIFY);
    assert.ok(scroll);
    assert.equal(objectTypeKnown(scroll), true);
    assert.equal(game.u.uconduct.literate, 1);
    assert.equal(gameLogEvents().filter(event => event.text ===
        'became literate by deciphering a scroll label').length, 1);
});


void test('a petless new Archeologist can break illiteracy by acquiring a scroll', async () => {
    await completeHeroStartup({ role: 'archeologist', alignment: 'neutral' });
    game.preferred_pet = 'n';
    assert.equal(await makedog(), null);
    game.nhDisplay = new GameDisplay(null);
    const input = resetInputState();
    acknowledgeMessages(input, []);
    const scroll = await mksobj(SCR_IDENTIFY, true, false);

    await addInventoryItem(scroll);

    assert.ok(scroll);
    assert.equal(objectTypeKnown(scroll), true);
    assert.ok(game.u.uconduct !== null && game.u.uconduct !== undefined);
    assert.equal(game.u.uconduct.literate, 1);
    assert.equal(gameLogEvents().filter(event => event.text ===
        'became literate by deciphering a scroll label').length, 1);
});
