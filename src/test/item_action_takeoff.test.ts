import assert from 'node:assert/strict';
import test from 'node:test';
import { wearHeroArmor } from '../js/armor.js';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { ELVEN_CLOAK, LEATHER_ARMOR } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a worn armor item offers takeoff and removes the selected piece', async () => {
    freshObjectRoom();
    const cloak = await addInventoryObject(ELVEN_CLOAK);
    wearHeroArmor(cloak);
    const input = resetInputState();
    const menu = rhack('i'.charCodeAt(0));
    try {
        await answerPrompts(menu, input, [
            { prompt: /Armor/, keys: cloak.invlet },
            { prompt: /T - Take off this armor/, keys: 'T' },
        ]);
    } finally {
        input.feed('\x1b');
        await menu;
    }

    await answerPrompts(rhack(0), input, []);

    assert.equal(game.uarmc, null);
    assert.equal(cloak.worn, false);
    assert.equal(game.context.move, 1);
});

void test('an inventory takeoff action cannot remove a suit covered by a cloak', async () => {
    freshObjectRoom();
    const suit = await addInventoryObject(LEATHER_ARMOR);
    const cloak = await addInventoryObject(ELVEN_CLOAK);
    wearHeroArmor(suit);
    wearHeroArmor(cloak);
    const input = resetInputState();
    await answerPrompts(rhack('i'.charCodeAt(0)), input, [
        { prompt: /Armor/, keys: suit.invlet },
        { prompt: /T - Take off this armor/, keys: 'T' },
    ]);

    await answerPrompts(rhack(0), input, []);

    assert.equal(game.uarm, suit);
    assert.equal(game.uarmc, cloak);
    assert.equal(game._pending_message, "You can't take that off without taking off your cloak first.");
    assert.equal(game.context.move, 0);
});
