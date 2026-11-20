import assert from 'node:assert/strict';
import test from 'node:test';

import type { Engine } from '../js/jsmain.js';
import { runSegment } from '../js/jsmain.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { decodeSavedGraph, encodeSavedGraph, isSavedRecord } from '../js/saved_graph.js';
import { flushPendingTopline, rememberToplines, ttyDoprevMessage } from '../js/topl.js';
import { pline } from '../js/pline.js';
import { rhack } from '../js/cmd.js';
import { flush_screen, newsym } from '../js/display.js';
import { resetInputState } from '../js/input.js';
import { HWALL } from '../js/const.js';
import { saveGame } from '../js/save.js';
import { freshObjectRoom } from './support/object-room.js';
import { memoryStorage } from './support/memory-storage.js';

function screenRows(engine: Engine): string[] {
    assert.ok(engine.display);
    return engine.display.grid.map(row => row.map(cell => cell.ch).join(''));
}

// C allmain.c:newgame() shows com_pager("legacy")'s text window and then
// questpgr.c stores the entry's one-line synopsis in the recall history
// (questpgr.c: putmsghistory(out_line, FALSE) after deliver_by_window()).
// The synopsis is wider than every other line at startup, so it also owns
// the recall window's corner offset: wintty.c:tty_display_nhwindow()
// (H2344_BROKEN) opens the putstr-built NHW_MENU at
// offx = min(min(82, cols/2), cols - maxcol - 1) with
// maxcol = strlen(synopsis) + 1, and process_text_window() starts the
// text one column past offx.
void test('the legacy introduction leaves its synopsis in the recall window at C’s offset', async () => {
    const engine = await runSegment({
        seed: 123,
        datetime: '20020207090000',
        nethackrc: 'OPTIONS=name:Holdout,role:monk,race:human,gender:female,'
            + 'align:lawful,legacy,!tutorial,pettype:none,msg_window:reversed',
        moves: '',
        storage: memoryStorage(),
    });
    engine.inputGate.feed(' ');
    await engine.runUntilInputNeeded();
    engine.inputGate.feed('\x10');
    await engine.runUntilInputNeeded();

    const rows = screenRows(engine);
    const synopsis = rows.findIndex(row => row.includes(
        '[Shan Lai Ching has chosen you to recover the Amulet of Yendor for Him.]'));
    assert.ok(synopsis >= 0, `recall lists the legacy synopsis, saw: ${rows.slice(0, 12).join(' | ')}`);
    const heading = rows[0]?.indexOf('Message History') ?? -1;
    assert.equal(heading, 7,
        `the 72-column synopsis puts the window text in column 7, got ${JSON.stringify(rows[0])}`);
    const welcome = rows.findIndex(row => row.includes('Hello Holdout, welcome to NetHack!'));
    assert.ok(welcome >= 0 && welcome < synopsis,
        'the reversed recall lists the pending welcome above the older synopsis');
    engine.inputGate.feed(' ');
    await engine.runUntilInputNeeded();
});

// C wintty.c:process_text_window() replays a mixed farlook line through
// putchar()/g_putch(); the recorder's shadow buffer never receives the
// glyph byte (nomux_putch rejects control and high-bit chars, and the
// g_putch mirror lands one column right where the description's padding
// spaces overwrite it), so the captured recall row shows only blanks
// before the description while the glyph still consumes its column.
void test('recall renders a mixed farlook line without its glyph', async () => {
    const level = await freshObjectRoom({ iflags: { prevmsg_window: 'r' }, flags: { tips: false } });
    requirePlayingGame(game);
    game.symset = 'DECgraphics';
    level.requireAt(11, 10).typ = HWALL;
    await newsym(11, 10);
    await flush_screen(1);
    const input = resetInputState();
    input.feed('l.');
    input.display = { async readKey() { return ' '.charCodeAt(0); } };
    await rhack(';'.charCodeAt(0));
    await flushPendingTopline();
    input.display = null;
    assert.match((requireGameDisplay().grid[0] ?? []).map(cell => cell.ch).join(''),
        /wall/, 'the farlook line reached the topline');

    await pline('The echo fades.');
    const recall = ttyDoprevMessage();
    let rows: string[] = [];
    for (let round = 0; round < 5; round++) {
        await input.waitUntilBlocked();
        rows = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join(''));
        if ((rows[0] ?? '').includes('Message History')) break;
        input.feed(' ');
    }
    const wallRow = rows.find(row => row.includes('wall'));
    assert.ok(wallRow, `recall lists the farlook line, saw: ${rows.slice(0, 12).join(' | ')}`);
    assert.match(wallRow.trimStart(), /^[a-z]/,
        `only blanks precede the description in the recall row, got ${JSON.stringify(wallRow.trimEnd())}`);
    input.feed(' ');
    await recall;
});

// C wintty.c:tty_putstr() runs compress_str() on the stored line with its
// high-bit glyph byte still a single ordinary character (wintty.c:2263);
// only process_text_window()'s putchar/g_putch replay loses the glyph cell
// (wintty.c:1850-1881). A long mixed line therefore compresses to
// "glyph, one space, description" and keeps one blank glyph column, instead
// of collapsing the glyph-and-padding run into stripped spaces.
void test('a long mixed farlook line keeps its glyph column through compression', async () => {
    await freshObjectRoom({ iflags: { prevmsg_window: 'r' }, flags: { tips: false } });
    requirePlayingGame(game);
    // A stored look line the way do_screen_description leaves it in the
    // recall ring: glyph, eight padding spaces, then a long description
    // that pushes the line past the terminal width.
    game._toplines = '\x0eq\x0f        a wall with a deliberately long '
        + 'inscription that pushes this look line past eighty columns';
    rememberToplines();
    const input = resetInputState();

    await pline('The echo fades.');
    const recall = ttyDoprevMessage();
    await input.waitUntilBlocked();
    let rows: string[] = [];
    for (let round = 0; round < 5; round++) {
        rows = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join(''));
        if ((rows[0] ?? '').includes('Message History')) break;
        input.feed(' ');
        await input.waitUntilBlocked();
    }
    const headingColumn = (rows[0] ?? '').indexOf('Message History');
    const recallRow = rows.find(row => row.includes('deliberately'));
    assert.ok(recallRow, `recall lists the long mixed line, saw: ${rows.slice(0, 12).join(' | ')}`);
    assert.ok(headingColumn >= 0, 'the recall window heading is visible');
    const description = recallRow.indexOf('a wall');
    assert.ok(description > headingColumn,
        `the description starts inside the window row, got ${JSON.stringify(recallRow.trimEnd())}`);
    assert.equal(recallRow.charAt(description - 1), ' ',
        'compress_str leaves exactly one space between the glyph column and the text');
    assert.equal(recallRow.slice(headingColumn, description - 1).trim(), '',
        'the glyph column and its padding stay blank before the compressed text');
    input.feed(' ');
    await recall;
});

// C files.c:1270 restore_saved_game() runs validate() (version.c) on the
// opened save before sys/unix/unixmain.c prints the restoring banner, so a
// save that fails validation never plines it; the game falls through to a
// fresh character whose messages page without dismissing any banner.
void test('an unreadable save starts a new game without the restoring banner', async () => {
    const storage = memoryStorage();
    const nethackrc = 'OPTIONS=name:Watcher,role:Archeologist,race:human,'
        + 'gender:female,align:lawful,!legacy,!tutorial,pettype:none,msg_window:reversed';
    await runSegment({
        seed: 456,
        datetime: '20010314110000',
        nethackrc,
        moves: '',
        storage,
    });
    assert.ok(await saveGame(storage), 'the first segment writes a save file');
    const key = 'teleport-save:watcher';
    const snapshot = decodeSavedGraph(storage.getItem(key) ?? '');
    assert.ok(isSavedRecord(snapshot), 'the written save decodes as a record');
    snapshot.version = 30;
    storage.setItem(key, encodeSavedGraph(snapshot));

    const second = await runSegment({
        seed: 456,
        datetime: '20010314110000',
        nethackrc,
        moves: '',
        storage,
    });
    const greeting = screenRows(second)[0] ?? '';
    assert.match(greeting, /welcome to NetHack!/,
        `the rejected save falls through to a new game, got ${JSON.stringify(greeting)}`);
    assert.doesNotMatch(greeting, /Restoring save file/,
        'no banner page waits for a key before the new game starts');

    second.inputGate.feed('\x10');
    await second.runUntilInputNeeded();
    const rows = screenRows(second);
    assert.ok(!rows.some(row => row.includes('Restoring save file')),
        `recall lists no banner for an unreadable save, saw: ${rows.slice(0, 10).join(' | ')}`);
    second.inputGate.feed(' ');
    await second.runUntilInputNeeded();
});


// C sys/unix/unixmain.c:261 plines "Restoring save file..." before
// dorecover(), and restore.c:restore_msghistory() (via
// topl.c:tty_putmsghistory()) pushes that session line back on top of the
// messages read from the save file, so recall lists it after the saved
// lines and before anything the restored session plines next.
void test('recall around a restore lists the restoring line above the saved history', async () => {
    const storage = memoryStorage();
    const nethackrc = 'OPTIONS=name:Watcher,role:Archeologist,race:human,'
        + 'gender:female,align:lawful,!legacy,!tutorial,pettype:none,msg_window:reversed';
    await runSegment({
        seed: 456,
        datetime: '20010314110000',
        nethackrc,
        moves: '',
        storage,
    });
    assert.ok(await saveGame(storage), 'the first segment writes a save file');

    const second = await runSegment({
        seed: 456,
        datetime: '20010314110000',
        nethackrc,
        moves: '',
        storage,
    });
    second.inputGate.feed('\x10');
    await second.runUntilInputNeeded();

    const rows = screenRows(second);
    const welcomeBack = rows.findIndex(row => row.includes('welcome back to NetHack!'));
    const restoring = rows.findIndex(row => row.includes('Restoring save file...'));
    const savedWelcome = rows.findIndex(row => row.includes('welcome to NetHack!'));
    assert.ok(restoring >= 0, `recall lists the restoring line, saw: ${rows.slice(0, 12).join(' | ')}`);
    assert.ok(welcomeBack >= 0 && restoring > welcomeBack,
        'the restoring line is newer than the restored welcome line');
    assert.ok(savedWelcome >= 0 && restoring < savedWelcome,
        'the restoring line is older than the line saved with the game');
    second.inputGate.feed(' ');
    await second.runUntilInputNeeded();
});
