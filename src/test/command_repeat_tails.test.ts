import assert from 'node:assert/strict';
import test from 'node:test';

import { flush_screen } from '../js/display.js';
import { DAGGER } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { readCommandInput } from '../js/command_input.js';
import { readchar } from '../js/input.js';
import { rhack } from '../js/cmd.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { freshTurnRoom } from './support/playable-room.js';

void test('repeating an empty-hands wield reads a new choice without showing a prompt', async () => {
    const input = freshTurnRoom();
    input.feed('w-');
    await rhack(0);
    input.feed('\x01');
    const repeat = rhack(0);
    await input.waitUntilBlocked();
    const display = requireGameDisplay();
    const message = display.grid[0]?.map(cell => cell.ch).join('').trimEnd();
    const cursor = [display.cursorCol, display.cursorRow];
    input.feed('\x1b');
    await repeat;

    assert.equal(message, '');
    assert.deepEqual(cursor, [0, 0]);
    assert.equal(game.context.move, 0);
});

for (const verb of ['invoke', 'tip']) {
    void test(`cancelling ${verb} leaves no command available to repeat`, async () => {
        const input = freshTurnRoom();
        input.feed(`#${verb}\n\x1b`);
        await rhack(0);
        input.feed('\x01\x1b');

        await rhack(0);
        await flush_screen(1);

        const top = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('').trimEnd();
        assert.equal(top, 'There is no command available to repeat.');
    });
}

void test('adjust repeats a declined destination without asking for another letter', async () => {
    const input = freshTurnRoom();
    const dagger = await addInventoryObject(DAGGER);
    input.feed(`#adjust\n${dagger.invlet}\x1b`);
    await rhack(0);
    input.feed('\x01q');

    await rhack(0);
    await flush_screen(1);

    const top = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('').trimEnd();
    assert.equal(top, 'Never mind.');
});

void test('reading a command with no message leaves the cursor on the hero for a silent read', async () => {
    const input = freshTurnRoom();
    input.feed('w');
    await readCommandInput();
    const nextChoice = readchar();
    await input.waitUntilBlocked();
    const display = requireGameDisplay();
    const cursor = [display.cursorCol, display.cursorRow];
    input.feed('-');
    await nextChoice;

    assert.deepEqual(cursor, [game.u.ux - 1, game.u.uy + 1]);
});
