import test from 'node:test';
import assert from 'node:assert/strict';
import { nhgetch, pushKeys, resetInputState } from '../js/input.js';
import { getLine, promptYesNo, promptYesNoAllQuit, promptYesNoQuit } from '../js/query.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { flush_screen, pline, plineWithContinuation } from '../js/display.js';
import { freshPlayableRoom } from './support/playable-room.js';
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
    const answer = promptYesNoQuit('Disarm it? [ynq] (q) ');
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
    assert.equal(await promptYesNo(prompt), 'n');
    await flush_screen(1);
    assert.equal(game.nhDisplay?.grid[0]?.map(cell => cell.ch).join('').trimEnd(), prompt.trimEnd());
    await plineWithContinuation('You close the book.');
    await flush_screen(1);
    assert.equal(game.nhDisplay?.grid[0]?.map(cell => cell.ch).join('').trimEnd(), 'You close the book.');
    assert.equal(await nhgetch(), 'X'.charCodeAt(0));
});
void test('an answered wrapped confirmation clears the covered message area', async () => {
    freshPlayableRoom();
    const prompt = 'Do you really want to leave this room before examining the strange inscription on the far wall? [yn] (n) ';
    pushKeys('n');
    assert.equal(await promptYesNo(prompt), 'n');
    await flush_screen(1);
    assert.equal(game.nhDisplay?.grid[0]?.map(cell => cell.ch).join('').trimEnd(), '');
});
void test('Escape rejects a yes/no question even when yes is the default', async () => {
    freshPlayableRoom();
    requirePlayingGame(game);
    pushKeys('\x1b');
    assert.equal(await promptYesNo('Continue? [yn] (y) ', 'y'), 'n');
});
void test('Escape quits a multi-item question rather than choosing its default', async () => {
    freshPlayableRoom();
    requirePlayingGame(game);
    pushKeys('\x1b\x1b');
    assert.equal(await promptYesNoQuit('Take it? [ynq] (n) ', 'n'), 'q');
    assert.equal(await promptYesNoAllQuit('Sell it? [ynaq] (y) '), 'q');
});
void test('space and either newline accept the displayed sale default', async () => {
    for (const key of [' ', '\n', '\r']) {
        freshPlayableRoom();
        requirePlayingGame(game);
        pushKeys(key);
        assert.equal(await promptYesNoAllQuit('Sell it? [ynaq] (y) '), 'y');
    }
    freshPlayableRoom();
    requirePlayingGame(game);
    pushKeys(' ');
    assert.equal(await promptYesNoAllQuit('Accept credit? [ynaq] (n) ', 'n'), 'n');
});
void test('a sale question ignores invalid keys and accepts all without consuming the next answer', async () => {
    freshPlayableRoom();
    requirePlayingGame(game);
    pushKeys('xAy');
    assert.equal(await promptYesNoAllQuit('Sell it? [ynaq] (y) '), 'a');
    assert.equal(await promptYesNo('Continue? [yn] (n) '), 'y');
});
//# sourceMappingURL=query.test.js.map