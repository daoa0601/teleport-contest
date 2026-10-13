import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DAGGER, GOLD_PIECE } from '../js/object_data.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { addInventoryObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';

void test('inventory-menu wield refuses coins without replacing the weapon or taking time', async () => {
    freshObjectRoom();
    const dagger = await addInventoryObject(DAGGER);
    await setPrimaryWeapon(dagger);
    const coins = await addInventoryObject(GOLD_PIECE, { quan: 50 });
    const input = resetInputState();
    await answerPrompts(rhack('i'.charCodeAt(0)), input, [
        { prompt: /Coins/, keys: coins.invlet },
        { prompt: /Do what with the gold pieces\?/, keys: 'w' },
    ]);

    await answerPrompts(rhack(0), input, []);

    assert.equal(game.uwep, dagger);
    assert.equal(game.context.move, 0);
    assert.equal(coins.quan, 50);
});

void test('typing gold at the wield prompt explains the refusal and takes no time', async () => {
    freshObjectRoom();
    await addInventoryObject(GOLD_PIECE, { quan: 50 });
    const input = resetInputState();

    await answerPrompts(rhack('w'.charCodeAt(0)), input, [
        { prompt: /What do you want to wield\?/, keys: '$' },
    ]);

    assert.equal(game._pending_message, 'You cannot wield gold.');
    assert.equal(game.uwep, null);
    assert.equal(game.context.move, 0);
});
