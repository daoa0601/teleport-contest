import assert from 'node:assert/strict';
import test from 'node:test';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { setPropertyTimeout } from '../js/properties.js';
import { flush_screen } from '../js/display.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import {
    LEVEL_TIMER_KIND, OBJECT_TIMER_KIND,
    scheduleLevelTimer, scheduleObjectTimer, stopAllObjectTimers,
} from '../js/object_timers.js';
import { runExtendedCommand } from './support/commands.js';
import { corpseObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

// C timeout.c:wiz_timeout_queue() (#timeout): a putstr listing in an NHW_MENU
// window, so tty paints it over the live map at a corner offset (wintty.c
// tty_putstr for NHW_MENU) rather than as a full-screen text window. The
// listing covers the current time, the timer queue, every timed intrinsic,
// and the hero and level counters that share the timeout surface. Rows align
// property names to the longest timed name and order entries as in
// timeout.c:propertynames.

interface CapturedWindow {
    text: string;
    rows: string[][];
    before: string[][];
}

function gridRows(): string[][] {
    return requireGameDisplay().grid.map(row => row.map(cell => cell.ch));
}

async function captureTimeoutWindow(): Promise<CapturedWindow> {
    const input = resetInputState();
    const before = gridRows();
    const frames: string[][][] = [];
    input.display = {
        async readKey(): Promise<number> {
            frames.push(gridRows());
            return 32;
        },
    };
    const moves = game.moves;
    try {
        await runExtendedCommand('timeout');
    } finally {
        input.display = null;
    }
    assert.equal(game.moves, moves, '#timeout takes no time');
    assert.ok(frames.length > 0, 'the listing waits for a key');
    const rows = frames[0] ?? [];
    return { text: rows.map(row => row.join('')).join('\n'), rows, before };
}

void test('#timeout reports the time, an empty queue, and no timed properties', async () => {
    freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    const { text } = await captureTimeoutWindow();

    assert.ok(text.includes(`Current time = ${game.moves}.`));
    assert.ok(text.includes('Active timeout queue:'));
    assert.ok(text.includes(' <empty>'));
    assert.ok(text.includes('No timed properties.'));
    assert.ok(!text.includes('Swallow countdown'), 'no swallow line without an engulfer');
    assert.ok(!text.includes('Vault counter'), 'no vault line outside the vault');
    assert.equal(game.context.move, 0);
});

void test('#timeout overlays the map in a corner window and restores it', async () => {
    freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    await flush_screen(1);
    const { rows, before } = await captureTimeoutWindow();

    const timeRow = rows.find(row => row.join('').includes('Current time'));
    assert.ok(timeRow, 'the current-time row is displayed');
    const leading = timeRow.findIndex(ch => ch !== ' ');
    assert.ok(leading > 10,
        `the corner listing starts well right of the map edge (column ${leading})`);
    // The map stays visible left of the overlay and returns after dismissal.
    const mapRow = rows[2] ?? [];
    for (let column = 0; column < leading - 1; column++) {
        assert.equal(mapRow[column], (before[2] ?? [])[column],
            `map cell at row 2, column ${column} survives the corner overlay`);
    }
    assert.deepEqual(gridRows().slice(1), before.slice(1),
        'dismissing the corner window restores the map rows');
});

void test('#timeout aligns timed properties to the longest name in table order', async () => {
    freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    setPropertyTimeout('confusion', 7);
    setPropertyTimeout('levitation', 20);

    const { text } = await captureTimeoutWindow();

    assert.ok(text.includes('Timed properties:'));
    // Rows are ' %-*s %4ld' with longestlen from the timed names only; here
    // 'levitating' (10) sets the width.
    assert.match(text, / confused {6}7/);
    assert.match(text, / levitating {3}20/);
    assert.ok(text.indexOf('confused') < text.indexOf('levitating'),
        'confused precedes levitating as in propertynames[]');
});

void test('#timeout marks properties that need #wizintrinsic to time out', async () => {
    freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    setPropertyTimeout('confusion', 7);
    setPropertyTimeout('coldResistance', 9);

    const { text } = await captureTimeoutWindow();

    const marker = text.indexOf('-- settable via #wizintrinsic only --');
    assert.ok(marker >= 0, 'the marker line appears');
    assert.ok(text.indexOf('confused') < marker, 'ordinary properties come first');
    assert.ok(text.indexOf('cold resistance') > marker,
        'the marked property follows its marker');
    assert.match(text, / cold resistance {4}9/);
});

void test('#timeout lists object and spot timers in queue order', async () => {
    freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    const corpse = await corpseObject(MONSTER_NAME.indexOf('kobold'), { where: 'inventory' });
    game.inventory.push(corpse);
    stopAllObjectTimers(corpse);
    scheduleObjectTimer(corpse, OBJECT_TIMER_KIND.ROT_CORPSE, game.moves + 25);
    scheduleLevelTimer(game.u.ux, game.u.uy, LEVEL_TIMER_KIND.MELT_ICE_AWAY,
        game.moves + 25, game);

    const { text } = await captureTimeoutWindow();

    assert.ok(text.includes('timeout  id   kind   call'));
    const rows = text.split('\n')
        .filter(row => / (?:object|level) /.test(row) && /\(0x/.test(row));
    assert.equal(rows.length, 2, 'both queued timers are listed');
    const deadline = game.moves + 25;
    const rowPattern = (kind: string, name: string) =>
        new RegExp(`^ +${deadline} +\\d+ {2}${kind} +${name}\\(0x[0-9a-f]+\\)`);
    assert.match(rows[0] ?? '', rowPattern('level', 'melt_ice_away'),
        'the newer spot timer runs first for an equal deadline');
    assert.match(rows[1] ?? '', rowPattern('object', 'rot_corpse'));
});

void test('#timeout appends the swallow and vault counters', async () => {
    freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    game.u.uswldtim = 3;
    game.u.uinvault = 2;

    const { text } = await captureTimeoutWindow();

    assert.ok(text.includes('Swallow countdown is 3.'));
    assert.ok(text.includes('Vault counter is 2.'));
});
