import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { flush_screen } from '../js/display.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { promptInventoryObject } from '../js/inventory_prompt.js';
import { APPLE, EGG } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshGameplayRoom } from './support/playable-room.js';

void test('a silent drop leaves its answered object query visible', async () => {
    const level = freshGameplayRoom({ flags: { verbose: false } });
    const apple = await addInventoryObject(APPLE, { invlet: 'a' });
    pushKeys('a');

    await rhack('d'.charCodeAt(0));
    await flush_screen(1);

    const topline = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('').trimEnd();
    assert.match(topline ?? '', /^What do you want to drop\? \[a or \?\*\]$/);
    assert.equal(game.inventory.includes(apple), false);
    assert.equal(level.objects[10]?.[10]?.includes(apple), true);
    assert.equal(game._pending_message, '', 'an answered query needs no acknowledgment');
});

void test('answering a wrapped object query clears the message window', async () => {
    freshGameplayRoom();
    const letters = 'bdfhjlnprtvxzBDFHJLNPRTVXZcegikmoqsu';
    for (const [species, invlet] of [...letters].entries()) {
        await addInventoryObject(EGG, { invlet, corpsenm: species + 1 });
    }
    const egg = game.inventory.find(object => object.invlet === 'b');
    assert.ok(egg);
    pushKeys('b');

    const selection = await promptInventoryObject(
        `What do you want to rub the royal jelly on? [${letters} or ?*] `,
        game.inventory,
        { verb: 'rub the royal jelly on' },
    );
    await flush_screen(1);

    assert.equal(selection.object, egg);
    const topline = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('').trimEnd();
    assert.equal(topline, '', 'an answered multiline query must not remain on screen');
});

