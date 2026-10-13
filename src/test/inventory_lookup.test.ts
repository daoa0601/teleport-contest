import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { CORPSE, KATANA, UNICORN_HORN } from '../js/object_data.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';

void test('inventory lookup offers and shows the species entry for a stack of kobold corpses', async () => {
    freshObjectRoom();
    const corpses = await addInventoryObject(CORPSE, { corpsenm: MONSTER_NAME.indexOf('kobold'), quan: 2 });
    const input = resetInputState();
    await answerPrompts(rhack('i'.charCodeAt(0)), input, [
        { prompt: /Comestibles/, keys: corpses.invlet },
        { prompt: /Do what with [^\n]+\?[\s\S]*Look up information about/, keys: '/' },
    ]);

    await answerPrompts(rhack(0), input, [
        { prompt: /race of kobolds[\s\S]*--More--/i, keys: ' ' },
    ]);

    assert.equal(corpses.quan, 2);
    assert.equal(game.context.move, 0);
});

void test('inventory lookup shows the selected weapon information and consumes its letter', async () => {
    freshObjectRoom();
    const katana = await addInventoryObject(KATANA, { quan: 2 });
    const input = resetInputState();
    await answerPrompts(rhack('i'.charCodeAt(0)), input, [
        { prompt: /Weapons/, keys: katana.invlet },
        { prompt: /Do what with the katana\?/, keys: '/' },
    ]);

    await answerPrompts(rhack(0), input, [
        { prompt: /samurai[\s\S]*--More--/i, keys: ' ' },
    ]);
    assert.equal(game.context.move, 0);
    input.feed('s');
    await answerPrompts(rhack(0), input, []);
    assert.equal(game.context.move, 1);
});

void test('Return advances an encyclopedia prose page instead of closing its menu', async () => {
    freshObjectRoom();
    const horn = await addInventoryObject(UNICORN_HORN);
    const input = resetInputState();
    await answerPrompts(rhack('i'.charCodeAt(0)), input, [
        { prompt: /Tools/, keys: horn.invlet },
        { prompt: /Do what with the unicorn horn\?/, keys: '/' },
    ]);

    await answerPrompts(rhack(0), input, [
        { prompt: /elusive unicorn[\s\S]*--More--/, keys: '\n' },
        { prompt: /warm glow stage[\s\S]*--More--/, keys: ' ' },
    ]);

    assert.equal(game.context.move, 0);
});
