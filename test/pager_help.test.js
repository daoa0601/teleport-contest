import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { flush_screen } from '../js/display.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';
import { ATR_BOLD, ATR_INVERSE, CLR_RED, NO_COLOR } from '../js/terminal.js';
function assertMenuHeading(text, attr, color) {
    const row = requireGameDisplay().grid.find(cells => cells.map(cell => cell.ch).join('').includes(text));
    assert.ok(row, `The menu displays the heading "${text}"`);
    const column = row.map(cell => cell.ch).join('').indexOf(text);
    for (const cell of row.slice(column, column + text.length)) {
        assert.equal(cell.attr, attr, `Heading "${text}" uses the configured attribute`);
        assert.equal(cell.color, color, `Heading "${text}" uses the configured color`);
    }
}
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
        { prompt: /Ask about '&' or '\?' to get more info\.[\s\S]*--More--/, keys: ' ' },
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
void test('help names the actual key bound to the full options command', async () => {
    freshObjectRoom();
    game.commandBindings.bindKey('v'.charCodeAt(0), 'optionsfull');
    const input = resetInputState();
    await answerPrompts(rhack('?'.charCodeAt(0)), input, [
        { prompt: /Using the 'v' command to set options\./, keys: '\x1b' },
    ]);
});
void test('the extended-command help list supports wildcard searches', async () => {
    freshObjectRoom();
    const input = resetInputState();
    input.feed('k:');
    await answerPrompts(rhack('?'.charCodeAt(0)), input, [
        { prompt: /Extended command list search phrase\?/, keys: '*wand*\r' },
        { prompt: /zap\s+\[.*\]\s+zap a wand|zap\s+zap a wand/, keys: '\x1b' },
    ]);
});
void test('closing #? returns to a fresh extended-command prompt', async () => {
    freshObjectRoom();
    const input = resetInputState();
    input.feed('?\r');
    await answerPrompts(rhack('#'.charCodeAt(0)), input, [
        { prompt: /Extended Commands List/, keys: '\x1b' },
        { prompt: /^#\s+\n/, keys: '?\r' },
        { prompt: /Extended Commands List/, keys: '\x1b' },
        { prompt: /^#\s+\n/, keys: 'versionshort\r' },
    ]);
    await flush_screen(1);
    const text = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('') ?? '';
    assert.match(text, /MacOS NetHack Version 5\.0\.0/);
    assert.equal(game.context.move, 0);
});
void test('closing a counted #? preserves the count for the selected wait command', async () => {
    freshObjectRoom();
    const input = resetInputState();
    input.feed('3#?\r');
    const operation = rhack(0);
    await input.waitUntilBlocked();
    try {
        assert.match(requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n'), /Extended Commands List/);
        input.feed('\x1b');
        await input.waitUntilBlocked();
        assert.equal(game.multi, 2, 'The resumed editor retains the two remaining waits');
    }
    finally {
        input.feed('wait\r');
        await operation;
    }
    assert.equal(game.context.move, 1);
    assert.equal(game.multi, 2);
});
for (const configured of [false, true]) {
    void test(`extended-command headings use ${configured ? 'configured' : 'default'} highlighting`, async () => {
        freshObjectRoom({ flags: { debug: false } });
        if (configured)
            game.iflags.menu_headings = { attr: ATR_BOLD, color: CLR_RED };
        const input = resetInputState();
        input.feed('k');
        const operation = rhack('?'.charCodeAt(0));
        await input.waitUntilBlocked();
        try {
            assertMenuHeading('Extended commands', configured ? ATR_BOLD : ATR_INVERSE, configured ? CLR_RED : NO_COLOR);
            assertMenuHeading('Extended Commands List', 0, NO_COLOR);
            assertMenuHeading('Search extended commands', 0, NO_COLOR);
        }
        finally {
            input.feed('\x1b');
            await operation;
        }
    });
}
void test('a debugging command search highlights its section heading', async () => {
    freshObjectRoom({ flags: { debug: true } });
    game.iflags.menu_headings = { attr: ATR_BOLD, color: CLR_RED };
    const input = resetInputState();
    input.feed('k:');
    const operation = rhack('?'.charCodeAt(0));
    await input.waitUntilBlocked();
    input.feed('wiz*\r');
    await input.waitUntilBlocked();
    try {
        assertMenuHeading('Debugging Extended Commands', ATR_BOLD, CLR_RED);
    }
    finally {
        input.feed('\x1b');
        await operation;
    }
});
//# sourceMappingURL=pager_help.test.js.map