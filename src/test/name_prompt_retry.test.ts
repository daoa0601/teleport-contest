import test from 'node:test';
import assert from 'node:assert/strict';

import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { Engine, runSegment } from '../js/jsmain.js';
import { resetInputState } from '../js/input.js';
import { GameDisplay } from '../js/game_display.js';
import { memoryStorage } from './support/memory-storage.js';

// C wintty.c:tty_askname(): an empty or escaped answer re-asks. The hint is
// written one row above the prompt, the prompt row is cleared with cl_end()
// and redrawn in place, and ten failures abandon the game. The rc fully
// fixes the character facets, so the name is the only query.
const START_OPTIONS = 'OPTIONS=role:Wizard,race:human,gender:female,align:neutral,'
    + '!legacy,!tutorial,pettype:none';

function screenRows(screen: string): string[] {
    return screen.split('\n');
}

void test('an empty then escaped name answer re-asks in place with the tty hint', async () => {
    const engine = await runSegment({
        seed: 31,
        datetime: '20260831120000',
        nethackrc: START_OPTIONS,
        moves: '\n\x1bMira\n',
        storage: memoryStorage(),
    });

    const screens = engine.getScreens();
    assert.ok(screens.some(screen => screen.includes('Enter a name for your character...')),
        'a rejected name answer prints the retry hint');
    assert.ok(screens.some(screen => screen.includes('Who are you? M')),
        'the typed retry answer echoes on the new prompt row');
    const retried = screens.filter(screen => screen.includes('Enter a name'));
    for (const screen of retried) {
        const rows = screenRows(screen);
        assert.match(rows[11] ?? '', /Enter a name for your character\.\.\./,
            'the hint sits one row above the prompt');
        assert.match(rows[12] ?? '', /Who are you\?/,
            'the prompt is redrawn on its own row');
        assert.doesNotMatch(rows[13] ?? '', /Who are you\?/,
            'the retry does not push the prompt down a row');
    }
    requirePlayingGame(game);
    assert.equal(game.plname, 'Mira');
    assert.equal(game.moves, 1, 'the named character still starts the game');
});

void test('a long partial answer is erased when Escape re-asks', async () => {
    const engine = await runSegment({
        seed: 31,
        datetime: '20260831120000',
        nethackrc: START_OPTIONS,
        moves: 'abcdefghijklmnopqrstuvwxyz0123\x1bAda\n',
        storage: memoryStorage(),
    });

    const screens = engine.getScreens().filter(screen => screen.includes('Enter a name'));
    assert.ok(screens.length > 0, 'the escaped answer re-asks with the hint');
    for (const screen of screens) {
        const rows = screenRows(screen);
        // cl_end() cleared the prompt row before the redraw, so the tail of
        // the discarded 30-character answer cannot survive beside the
        // 34-character hint or after the redrawn prompt.
        assert.doesNotMatch(rows[11] ?? '', /wxyz0123/,
            `the hint row carries no discarded answer tail, saw: ${JSON.stringify(rows.slice(11, 13))}`);
        assert.ok(!(rows[12] ?? '').includes('wxyz0123'),
            `the discarded answer tail is erased, saw: ${JSON.stringify(rows.slice(11, 13))}`);
    }
    requirePlayingGame(game);
    assert.equal(game.plname, 'Ada');
});

void test('ten empty name answers clear the startup screen before giving up', async () => {
    const engine = await runSegment({
        seed: 31,
        datetime: '20260831120000',
        nethackrc: START_OPTIONS,
        moves: '\n'.repeat(10),
        storage: memoryStorage(),
    });

    const display = requireGameDisplay();
    const rows = display.grid
        .map(cells => cells.map(cell => cell.ch).join('').trimEnd());
    assert.equal(rows[0], 'Giving up after 10 tries.',
        'the exit message starts at the top-left after clearing the screen');
    for (let row = 1; row < rows.length; row++) {
        assert.equal(rows[row], '', `startup text is cleared from row ${row}`);
    }
    assert.equal(display.cursorCol, 0);
    assert.equal(display.cursorRow, 2,
        'the message newline and raw-print newline leave a blank line before the cursor');
    assert.equal(engine.lastRunResult?.kind, 'stopped');
    assert.equal(game.urole, null, 'no character is created after the bail');
});

void test('an accepted name leaves the cursor one row below the prompt', async () => {
    const display = new GameDisplay(null);
    game.nhDisplay = display;
    const engine = new Engine({
        seed: 1,
        datetime: '20260831120000',
        nethackrc: '',
        display,
        storage: memoryStorage(),
    });
    try {
        resetInputState().feed('\x1bZed\n');
        const parsed = await engine._readPlayerName();

        assert.equal(parsed?.name, 'Zed');
        const rows = display.grid
            .map(cells => cells.map(cell => cell.ch).join('').trimEnd());
        assert.match(rows[11] ?? '', /Enter a name for your character\.\.\./);
        assert.match(rows[12] ?? '', /Who are you\? Zed/);
        assert.equal(rows[13] ?? '', '', 'the prompt never reaches a third row');
        // tty_curs(BASE_WINDOW, 1, cury + 1) with cury on the prompt row.
        assert.equal(display.cursorCol, 0);
        assert.equal(display.cursorRow, 13);
    } finally {
        game.nhDisplay = null;
    }
});
