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

void test('quick look uses concise getpos feedback and restores verbosity', async () => {
    freshObjectRoom({ flags: { tips: false, verbose: true } });
    const input = resetInputState();
    input.feed('#');
    await answerPrompts(rhack(';'.charCodeAt(0)), input, [
        { prompt: /Automatic description is off\./, keys: '\x1b' },
    ]);
    assert.equal(game.flags.verbose, true);
});
