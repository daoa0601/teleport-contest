import assert from 'node:assert/strict';
import test from 'node:test';
import { game, requireGameDisplay } from '../js/gstate.js';
import { GameDisplay } from '../js/game_display.js';
import { nhgetch, resetInputState } from '../js/input.js';
import { promptChoice, tty_yn_function } from '../js/query.js';
import { Terminal } from '../js/terminal.js';
import { freshPlayableRoom } from './support/playable-room.js';

void test('choices after Escape remain accepted but are omitted from the prompt', async () => {
    freshPlayableRoom();
    const input = resetInputState();
    const answer = promptChoice('Continue?', ['y', 'n', '\x1b', 'A'], 'n');
    try {
        await input.waitUntilBlocked();
        assert.equal(requireGameDisplay().grid[0]?.map(cell => cell.ch).join('').trimEnd(), 'Continue? [yn] (n)');
    } finally {
        input.feed('A');
        assert.equal(await answer, 'A', 'hidden uppercase choices still preserve input case');
    }
});

void test('a choice prompt without a default omits the default suffix', async () => {
    freshPlayableRoom();
    const input = resetInputState();
    const answer = promptChoice('Continue?', ['y', 'n', ''], '');
    try {
        await input.waitUntilBlocked();
        assert.equal(requireGameDisplay().grid[0]?.map(cell => cell.ch).join('').trimEnd(), 'Continue? [yn]');
    } finally {
        input.feed(' ');
        assert.equal(await answer, '');
    }
});

void test('a number choice consumes and edits its digits before committing', async () => {
    freshPlayableRoom();
    const input = resetInputState();
    input.feed('#12\x7f3\nX');

    const answer = await promptChoice('How many?', ['y', 'n', '#'], 'n');

    assert.equal(answer, '#');
    assert.equal(game.nhDisplay?.toplines, 'How many? [yn#] (n) #13');
    assert.equal(await nhgetch(), 'X'.charCodeAt(0), 'the next command follows the committed number');
});

for (const { name, keys, answer, count } of [
    { name: 'a digit starts number entry without #', keys: '23y', answer: '#', count: 23n },
    { name: 'zero means no', keys: '0\n', answer: 'n', count: 0n },
    { name: 'an empty number means no', keys: '#\n', answer: 'n', count: 0n },
    { name: 'Escape aborts the number and reprompts', keys: '12\x1by', answer: 'y', count: 0n },
    { name: 'an invalid number character reprompts', keys: '12!n', answer: 'n', count: 0n },
    { name: 'erasing the number sign reprompts', keys: '#\bn', answer: 'n', count: 0n },
    { name: 'long overflow reprompts', keys: '9223372036854775808n', answer: 'n', count: 0n },
    { name: 'the largest native long stays exact', keys: '9223372036854775807\n', answer: '#', count: 9223372036854775807n },
]) {
    void test(`a number prompt: ${name}`, async () => {
        freshPlayableRoom();
        resetInputState().feed(keys + 'X');

        const result = await tty_yn_function('How many?', 'yn#', 'n');

        assert.equal(result.answer, answer);
        assert.equal(result.count, count);
        assert.equal(await nhgetch(), 'X'.charCodeAt(0), 'only the prompt answer is consumed');
    });
}

void test('an unrestricted tty prompt accepts one character without a choice suffix', async () => {
    freshPlayableRoom();
    const input = resetInputState();
    const answer = tty_yn_function('Which symbol?', null);
    try {
        await input.waitUntilBlocked();
        assert.equal(requireGameDisplay().grid[0]?.map(cell => cell.ch).join('').trimEnd(), 'Which symbol?');
    } finally {
        input.feed('Z');
        assert.equal((await answer).answer, 'Z');
    }
});

void test('aborting a wrapped number clears the rows its prompt covered', async () => {
    freshPlayableRoom();
    game.nhDisplay = new GameDisplay(new Terminal(null, { cols: 24, rows: 24 }));
    const input = resetInputState();
    input.feed('#123456');
    const answer = tty_yn_function('How many?', 'yn#', 'n');
    await input.waitUntilBlocked();
    assert.equal(requireGameDisplay().cursorRow, 1, 'number entry must reach the second row');
    input.feed('\x1bn');

    assert.equal((await answer).answer, 'n');
    assert.equal(requireGameDisplay().grid[1]?.map(cell => cell.ch).join('').trim(), '',
        'the aborted number must not leave digits on the map');
});
