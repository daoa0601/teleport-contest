import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { flush_screen } from '../js/display.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';
void test('the V command shows the native short version and spends no turn', async () => {
    freshObjectRoom();
    await rhack('V'.charCodeAt(0));
    await flush_screen(1);
    const text = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('');
    assert.match(text ?? '', /MacOS NetHack Version 5\.0\.0/);
    assert.equal(game.context.move, 0);
});
void test('whatdoes describes the current binding of a key', async () => {
    freshObjectRoom();
    game.commandBindings.bindKey('x'.charCodeAt(0), 'search');
    const input = resetInputState();
    await answerPrompts(rhack('&'.charCodeAt(0)), input, [
        { prompt: /What command\?/, keys: 'x' },
    ]);
    await flush_screen(1);
    const text = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('');
    assert.match(text ?? '', /x\s+search for traps and secret doors \(#search\)\./);
});
for (const [key, text] of [['d', /NetHack.*--More--/s], ['o', /NetHack development team.*--More--/s],
    ['l', /Menu control keys:.*--More--/s], ['j', /Full Current Key Bindings List.*--More--/s],
    ['k', /Extended Commands List.*\(1 of /s]]) {
    void test(`help choice ${key} opens its text window`, async () => {
        freshObjectRoom();
        const input = resetInputState();
        input.feed(key);
        await answerPrompts(rhack('?'.charCodeAt(0)), input, [
            { prompt: text, keys: '\x1b' },
        ]);
        assert.equal(game.context.move, 0);
    });
}
void test('help hides wizard-only commands during ordinary play', async () => {
    freshObjectRoom({ flags: { debug: false } });
    const input = resetInputState();
    const operation = rhack('?'.charCodeAt(0));
    await input.waitUntilBlocked();
    const text = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
    assert.doesNotMatch(text, /List of wizard-mode commands/);
    input.feed('\x1b');
    await operation;
});
//# sourceMappingURL=pager_help.test.js.map