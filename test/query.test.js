import test from 'node:test';
import assert from 'node:assert/strict';
import { nhgetch, pushKeys, resetInputState } from '../js/input.js';
import { getLine, promptChoice, promptYesNo, promptYesNoAllQuit, promptYesNoQuit } from '../js/query.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { bot, flushPendingTopline, flush_screen, pline, plineWithContinuation } from '../js/display.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { GameDisplay } from '../js/game_display.js';
import { Terminal } from '../js/terminal.js';
void test('a confirmation displays its choices and default before reading input', async () => {
    freshPlayableRoom();
    const input = resetInputState();
    const answer = promptYesNoQuit('Leave this level?');
    try {
        await input.waitUntilBlocked();
        assert.equal(game.nhDisplay?.grid[0]?.map(cell => cell.ch).join('').trimEnd(), 'Leave this level? [ynq] (q)');
        assert.equal(game.nhDisplay?.cursorCol, 28);
    }
    finally {
        input.feed(' ');
        assert.equal(await answer, 'q');
    }
});
// C getline.c checks the erase character before the kill character, and the
// recorder's NOMUX terminal synthesis sets erase to DEL and kill to ^U
// (unixtty.c gettty()): DEL backs over one byte, ^U removes the whole line.
void test('DEL erases one character and control-U clears the line', async () => {
    freshPlayableRoom();
    requirePlayingGame(game);
    pushKeys('abc\x7fd\n');
    assert.equal(await getLine('What do you want to write?', () => true), 'abd');
    freshPlayableRoom();
    requirePlayingGame(game);
    pushKeys('abc\x15d\n');
    assert.equal(await getLine('What do you want to write?', () => true), 'd');
});
void test('line input acknowledges unread prose before taking the answer', async () => {
    freshPlayableRoom();
    requirePlayingGame(game);
    await pline('You discover a faint inscription.');
    const input = resetInputState();
    const answer = getLine('What does it say?', () => true);
    await input.waitUntilBlocked();
    assert.equal(game._pending_message, 'You discover a faint inscription.');
    input.feed(' ');
    await input.waitUntilBlocked();
    assert.equal(game._pending_message, 'What does it say?');
    input.feed('welcome\n');
    assert.equal(await answer, 'welcome');
});
void test('an already read topline does not consume a line-answer key as another acknowledgment', async () => {
    freshPlayableRoom();
    requirePlayingGame(game);
    await pline('You discover a faint inscription.');
    pushKeys('x');
    await nhgetch();
    pushKeys('welcome\n');
    assert.equal(await getLine('What does it say?', () => true), 'welcome');
});
void test('confirmation acknowledges distinct unread prose and asks its question once', async () => {
    freshPlayableRoom();
    requirePlayingGame(game);
    await pline('You find a trap on the door!');
    const input = resetInputState();
    const answer = promptYesNoQuit('Disarm it?');
    await input.waitUntilBlocked();
    assert.equal(game._pending_message, 'You find a trap on the door!');
    input.feed(' ');
    await input.waitUntilBlocked();
    assert.equal(game._pending_message, 'Disarm it? [ynq] (q) ');
    input.feed('yX');
    assert.equal(await answer, 'y');
    assert.equal(await nhgetch(), 'X'.charCodeAt(0));
});
void test('an answered one-line confirmation remains visible without paging again', async () => {
    freshPlayableRoom();
    const prompt = 'Continue studying? [yn] (n) ';
    pushKeys('nX');
    assert.equal(await promptYesNo('Continue studying?'), 'n');
    await flush_screen(1);
    assert.equal(game.nhDisplay?.grid[0]?.map(cell => cell.ch).join('').trimEnd(), prompt.trimEnd());
    await plineWithContinuation('You close the book.');
    await flush_screen(1);
    assert.equal(game.nhDisplay?.grid[0]?.map(cell => cell.ch).join('').trimEnd(), 'You close the book.');
    assert.equal(await nhgetch(), 'X'.charCodeAt(0));
});
void test('an answered wrapped confirmation clears the covered message area', async () => {
    freshPlayableRoom();
    const prompt = 'Do you really want to leave this room before examining the strange inscription on the far wall?';
    pushKeys('n');
    assert.equal(await promptYesNo(prompt), 'n');
    await flush_screen(1);
    assert.equal(game.nhDisplay?.grid[0]?.map(cell => cell.ch).join('').trimEnd(), '');
});
void test('a wrapped line prompt leaves covered status rows blank until the next status update', async () => {
    freshPlayableRoom();
    game.plname = 'Lin';
    game.nhDisplay = new GameDisplay(new Terminal(null, { cols: 6, rows: 24 }));
    const input = resetInputState();
    const answer = getLine('Choose '.repeat(18), () => true);
    try {
        await input.waitUntilBlocked();
        assert.doesNotMatch(game.nhDisplay.grid[22]?.map(cell => cell.ch).join('') ?? '', /^Lin/, 'the question should cover the first status row');
    }
    finally {
        input.feed('\n');
        await answer;
    }
    for (const row of [22, 23]) {
        assert.equal(game.nhDisplay.grid[row]?.map(cell => cell.ch).join('').trim(), '', `status row ${row} should stay blank after line input cleanup`);
    }
    await bot();
    assert.match(game.nhDisplay.grid[22]?.map(cell => cell.ch).join('') ?? '', /^Lin/);
    assert.match(game.nhDisplay.grid[23]?.map(cell => cell.ch).join('') ?? '', /^Dl:1/);
});
void test('line input holds existing status until it returns', async () => {
    freshPlayableRoom();
    game.plname = 'Before';
    await bot();
    game.plname = 'After';
    const input = resetInputState();
    const answer = getLine('Name?', () => true);
    try {
        await input.waitUntilBlocked();
        await bot();
        assert.match(game.nhDisplay?.grid[22]?.map(cell => cell.ch).join('') ?? '', /^Before/);
    }
    finally {
        input.feed('\n');
        await answer;
    }
    await bot();
    assert.match(game.nhDisplay?.grid[22]?.map(cell => cell.ch).join('') ?? '', /^After/);
});
void test('a wrapped confirmation restores the status rows it covered', async () => {
    freshPlayableRoom();
    game.plname = 'Lin';
    game.nhDisplay = new GameDisplay(new Terminal(null, { cols: 6, rows: 24 }));
    const input = resetInputState();
    const prompt = 'Choose '.repeat(18);
    const answer = promptYesNo(prompt);
    try {
        await input.waitUntilBlocked();
        assert.doesNotMatch(game.nhDisplay.grid[22]?.map(cell => cell.ch).join('') ?? '', /^Lin/, 'the question should cover the first status row');
    }
    finally {
        input.feed('n');
        await answer;
    }
    assert.match(game.nhDisplay.grid[22]?.map(cell => cell.ch).join('') ?? '', /^Lin/);
    assert.match(game.nhDisplay.grid[23]?.map(cell => cell.ch).join('') ?? '', /^Dl:1/);
});
for (const length of [127, 128, 160]) {
    void test(`a ${length}-character confirmation ${length < 128 ? 'keeps the full question' : 'ends the shortened question with an ellipsis'}`, async () => {
        freshPlayableRoom();
        const query = 'Will you leave before checking '.padEnd(length - 1, 'x') + '?';
        const input = resetInputState();
        const answer = promptYesNo(query);
        try {
            await input.waitUntilBlocked();
            const display = game.nhDisplay;
            assert.ok(display);
            const text = [0, 1].map(row => display.grid[row]?.slice(0, display.cols - 1)
                .map(cell => cell.ch).join('') ?? '').join('').trimEnd();
            assert.equal(text.length, 136, 'the displayed question should have 127 characters before the choice suffix');
            assert.ok(text.endsWith(length < 128 ? '? [yn] (n)' : '... [yn] (n)'), `unexpected question ending: ${text.slice(-20)}`);
        }
        finally {
            input.feed('n');
            await answer;
        }
    });
}
void test('Escape rejects a yes/no question even when yes is the default', async () => {
    freshPlayableRoom();
    requirePlayingGame(game);
    pushKeys('\x1b');
    assert.equal(await promptYesNo('Continue?', 'y'), 'n');
});
void test('Escape quits a multi-item question rather than choosing its default', async () => {
    freshPlayableRoom();
    requirePlayingGame(game);
    pushKeys('\x1b\x1b');
    assert.equal(await promptYesNoQuit('Take it?', 'n'), 'q');
    assert.equal(await promptYesNoAllQuit('Sell it?'), 'q');
});
void test('space and either newline accept the displayed sale default', async () => {
    for (const key of [' ', '\n', '\r']) {
        freshPlayableRoom();
        requirePlayingGame(game);
        pushKeys(key);
        assert.equal(await promptYesNoAllQuit('Sell it?'), 'y');
    }
    freshPlayableRoom();
    requirePlayingGame(game);
    pushKeys(' ');
    assert.equal(await promptYesNoAllQuit('Accept credit?', 'n'), 'n');
});
void test('a sale question ignores invalid keys and accepts all without consuming the next answer', async () => {
    freshPlayableRoom();
    requirePlayingGame(game);
    pushKeys('xAy');
    assert.equal(await promptYesNoAllQuit('Sell it?'), 'a');
    assert.equal(await promptYesNo('Continue?'), 'y');
});
void test('line input wraps at the terminal margin and erases without crossing the new row early', async () => {
    freshPlayableRoom();
    game.nhDisplay = new GameDisplay(new Terminal(null, { cols: 40, rows: 24 }));
    const input = resetInputState();
    const answer = getLine('Write'.padEnd(37, '.'), () => true);
    try {
        await input.waitUntilBlocked();
        input.feed('ab');
        await input.waitUntilBlocked();
        assert.equal(game.nhDisplay.cursorCol, 1);
        assert.equal(game.nhDisplay.cursorRow, 1);
        input.feed('\b');
        await input.waitUntilBlocked();
        assert.equal(game.nhDisplay.cursorCol, 0);
        assert.equal(game.nhDisplay.cursorRow, 1);
    }
    finally {
        input.feed('\n');
        await answer;
    }
    assert.equal(await answer, 'a');
});
void test('uppercase hidden choices preserve case while only visible choices enter the suffix', async () => {
    freshPlayableRoom();
    const input = resetInputState();
    const answer = promptChoice('Continue?', ['y', 'Y', 'q'], 'q', { visibleChoices: 'yq' });
    await input.waitUntilBlocked();
    assert.equal(game.nhDisplay?.grid[0]?.map(cell => cell.ch).join('').trimEnd(), 'Continue? [yq] (q)');
    input.feed('Y');
    assert.equal(await answer, 'Y');
});
void test('a line question resumes ordinary messages after Escape stopped a More prompt', async () => {
    freshPlayableRoom();
    await plineWithContinuation('A distant bell rings.');
    resetInputState().feed('\x1b');
    await flushPendingTopline();
    pushKeys('hello\n');
    assert.equal(await getLine('Write what?', () => true), 'hello');
    await plineWithContinuation('The inscription is complete.');
    await flush_screen(1);
    assert.equal(game.nhDisplay?.grid[0]?.map(cell => cell.ch).join('').trimEnd(), 'The inscription is complete.');
});
//# sourceMappingURL=query.test.js.map