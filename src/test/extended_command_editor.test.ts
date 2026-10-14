import assert from 'node:assert/strict';
import test from 'node:test';

import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { nhgetch, resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';

void test('cancelling an empty extended command clears its prompt from the tty', async () => {
    freshObjectRoom();
    const input = resetInputState();
    input.feed('q\x7f\x7f\x1b');

    await rhack('#'.charCodeAt(0));

    assert.equal(requireScreenRow(0).map(cell => cell.ch).join('').trim(), '');
    assert.equal(game._pending_message, '');
    assert.equal(game.context.move, 0);
});

for (const erase of ['\b', '\x7f']) {
    void test(`erasing a completed extended command removes its suggestion with ${JSON.stringify(erase)}`, async () => {
        freshObjectRoom();
        const input = resetInputState();
        input.feed(`en${erase}\n\x1b`);
        await rhack('#'.charCodeAt(0));
        assert.equal(game._pending_message, '#e: unknown extended command.');
        assert.equal(game.context.move, 0);
    });
}

void test('extended-command completion does not ignore leading spaces while typing', async () => {
    freshObjectRoom();
    const input = resetInputState();
    input.feed(' aut\n');
    await rhack('#'.charCodeAt(0));
    assert.equal(game._pending_message, '#aut: unknown extended command.');
    assert.equal(game.context.move, 0);
});

void test('unknown extended commands identify the configured initiator key', async () => {
    freshObjectRoom();
    const input = resetInputState();
    game.commandBindings.bindKey('!'.charCodeAt(0), '#');
    input.feed('!bogus\n');
    await rhack(0);
    assert.equal(game._pending_message, '!bogus: unknown extended command.');
});

void test('listing extended commands returns to the editor for the next command', async () => {
    freshObjectRoom();
    game.flags.pickup = false;
    const input = resetInputState();
    input.feed('#?\n\x1bautopickup\n');
    await rhack(0);
    assert.equal(game.flags.pickup, true);
    assert.equal(game.context.move, 0);
});

void test('cancelling the editor after listing extended commands preserves list recall', async () => {
    freshObjectRoom();
    const input = resetInputState();
    input.feed('#?\n\x1b\x1b');
    await rhack(0);

    input.feed('\x01');
    const action = rhack(0);
    try {
        const result = await Promise.race([
            action.then(() => 'completed'),
            input.waitUntilBlocked().then(() => 'prompted'),
        ]);
        assert.equal(result, 'prompted', 'repeat must reopen the executed command list');
        const text = game.nhDisplay?.grid.map(row => row.map(cell => cell.ch).join('')).join('\n') ?? '';
        assert.match(text, /Extended Commands List/);
        input.feed('\x1bh');
        await action;
        assert.equal(game.context.move, 0);
        assert.equal(await nhgetch(), 'h'.charCodeAt(0), 'repeating the list must not reopen the editor');
    } finally {
        input.feed('\x1b\x1b');
        await action;
    }
});

for (const answer of ['\n', '   \n', '\x1b', 'wait\x1b\x1b']) {
    void test(`an empty or cancelled command-list search returns to the editor (${JSON.stringify(answer)})`, async () => {
        freshObjectRoom();
        const input = resetInputState();
        input.feed('#?\n:');
        const action = rhack(0);
        try {
            await input.waitUntilBlocked();
            input.feed(answer);
            await input.waitUntilBlocked();
            assert.equal(game._pending_message, '#', 'only a nonempty search should reopen the command list');
        } finally {
            input.feed('\x1b\x1b');
            await action;
        }
        assert.equal(game.context.move, 0);
    });
}

void test('a nonempty command-list search redisplays matching command descriptions', async () => {
    freshObjectRoom();
    const input = resetInputState();
    input.feed('#?\n:');
    const action = rhack(0);
    try {
        await input.waitUntilBlocked();
        assert.equal(game._pending_message, 'Extended command list search phrase?');
        input.feed('wait\n');
        await input.waitUntilBlocked();
        const text = game.nhDisplay?.grid.map(row => row.map(cell => cell.ch).join('')).join('\n') ?? '';
        assert.match(text, /rest one move while doing nothing/);
        assert.doesNotMatch(text, /search for traps and secret doors/);
    } finally {
        input.feed('\x1b\x1b\x1b');
        await action;
    }
    assert.equal(game.context.move, 0);
});

void test('the extmenu option asks for command initials in a menu', async () => {
    freshObjectRoom();
    game.flags.extmenu = true;
    const input = resetInputState();
    input.feed('#');
    const action = rhack(0);
    try {
        await input.waitUntilBlocked();
        const text = game.nhDisplay?.grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
        assert.match(text ?? '', /Extended Command:/);
        input.feed('s');
        await action;
        assert.equal(game.context.move, 1);
    } finally {
        input.feed('\x1b\x1b');
        await action;
    }
});
