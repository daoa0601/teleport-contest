import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { flush_screen } from '../js/display.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';

void test('ordinary look ends after an unknown direction', async () => {
    freshObjectRoom({ flags: { tips: false, verbose: false } });
    const input = resetInputState();
    input.feed('/s');
    await answerPrompts(rhack('/'.charCodeAt(0)), input, []);
    await flush_screen(1);
    const text = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('') ?? '';
    assert.match(text, /aborted.*Done\./);
    assert.equal(game.context.move, 0);
});

void test('quick look restores its goal after disabling descriptions and restores verbosity', async () => {
    freshObjectRoom({ flags: { tips: false, verbose: true } });
    const input = resetInputState();
    input.feed('#');
    await answerPrompts(rhack(';'.charCodeAt(0)), input, [
        { prompt: /Move cursor to a monster, object or location:/, keys: '\x1b' },
    ]);
    assert.equal(game.flags.verbose, true);
});

void test('submerged quick look describes distant cursor positions as unreconnoitered', async () => {
    freshObjectRoom({ flags: { tips: false }, hero: { uinwater: true } });
    const input = resetInputState();
    input.feed('ll');
    await answerPrompts(rhack(';'.charCodeAt(0)), input, [
        { prompt: /unreconnoitered/, keys: '\x1b' },
    ]);
});
