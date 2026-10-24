import assert from 'node:assert/strict';
import test from 'node:test';
import { game, requireGameDisplay } from '../js/gstate.js';
import { GameDisplay } from '../js/game_display.js';
import { bindInputGate, InputGate, nhgetch, resetInputState } from '../js/input.js';
import { flushPendingTopline, flush_screen, pline } from '../js/display.js';
import { promptChoice, tty_yn_function } from '../js/query.js';
import { Terminal } from '../js/terminal.js';
import { promptKey } from '../js/tty_prompts.js';
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

for (const defaultAnswer of ['y', '']) {
    void test(`fuzzer NUL accepts ${defaultAnswer ? 'the displayed' : 'an absent'} default without reading another key`, async () => {
        freshPlayableRoom();
        game.iflags.debug_fuzzer = true;
        bindInputGate(new QueuedFuzzerInput('\0nX'));

        const result = await tty_yn_function('Continue?', 'yn', defaultAnswer);

        assert.equal(result.answer, defaultAnswer);
        assert.equal(await nhgetch(), 'n'.charCodeAt(0), 'the next answer must remain unread');
    });
}

void test('fuzzer NUL commits a numeric answer without reading another key', async () => {
    freshPlayableRoom();
    game.iflags.debug_fuzzer = true;
    bindInputGate(new QueuedFuzzerInput('12\0nX'));

    const result = await tty_yn_function('How many?', 'yn#', 'n');

    assert.equal(result.answer, '#');
    assert.equal(result.count, 12n);
    assert.equal(game.nhDisplay?.toplines, 'How many? [yn#] (n) #12');
    assert.equal(await nhgetch(), 'n'.charCodeAt(0), 'the next answer must remain unread');
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

for (const fuzzer of [false, true]) {
    void test(`a key prompt restores messages after Escape with ${fuzzer ? 'fuzzer' : 'keyboard'} input`, async () => {
        freshPlayableRoom();
        resetInputState().feed('\x1b');
        await pline('An introductory message.');
        await flushPendingTopline();
        game.iflags.debug_fuzzer = fuzzer;
        if (fuzzer) bindInputGate(new QueuedFuzzerInput('^'));
        else resetInputState().feed('^');

        const answer = await promptKey('What do you look for? ');
        await pline('First result.');
        await pline('Second result.');
        await flush_screen(1);

        assert.equal(answer, '^'.charCodeAt(0));
        const topline = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('');
        assert.match(topline ?? '', /First result\.  Second result\./);
    });
}

for (const responses of ['yn\xe9', null]) {
    void test(`a ${responses === null ? 'free' : 'restricted'} tty prompt accepts an eight-bit response`, async () => {
        freshPlayableRoom();
        resetInputState().feed('\xe9nX');

        const result = await tty_yn_function('Which symbol?', responses, 'n');

        assert.equal(result.answer, '\xe9');
        assert.equal(await nhgetch(), 'n'.charCodeAt(0), 'the next key must remain unread');
    });
}

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

// Fuzzer bytes bypass tty_nhgetch()'s keyboard NUL-to-Escape conversion.
class QueuedFuzzerInput extends InputGate {
    private readonly bytes: number[];

    constructor(keys: string) {
        super();
        this.bytes = [...keys].map(character => character.charCodeAt(0));
    }

    override readKey(): Promise<number> {
        const byte = this.bytes.shift();
        if (byte === undefined) throw new Error('The prompt read past its queued fuzzer input');
        return Promise.resolve(byte);
    }
}
