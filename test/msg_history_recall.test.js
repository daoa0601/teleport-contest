import assert from 'node:assert/strict';
import test from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { flushPendingTopline, ttyDoprevMessage } from '../js/topl.js';
import { pline } from '../js/pline.js';
import { rhack } from '../js/cmd.js';
import { flush_screen, newsym } from '../js/display.js';
import { resetInputState } from '../js/input.js';
import { HWALL } from '../js/const.js';
import { saveGame } from '../js/save.js';
import { freshObjectRoom } from './support/object-room.js';
import { memoryStorage } from './support/memory-storage.js';
function screenRows(engine) {
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
    const synopsis = rows.findIndex(row => row.includes('[Shan Lai Ching has chosen you to recover the Amulet of Yendor for Him.]'));
    assert.ok(synopsis >= 0, `recall lists the legacy synopsis, saw: ${rows.slice(0, 12).join(' | ')}`);
    const heading = rows[0]?.indexOf('Message History') ?? -1;
    assert.equal(heading, 7, `the 72-column synopsis puts the window text in column 7, got ${JSON.stringify(rows[0])}`);
    const welcome = rows.findIndex(row => row.includes('Hello Holdout, welcome to NetHack!'));
    assert.ok(welcome >= 0 && welcome < synopsis, 'the reversed recall lists the pending welcome above the older synopsis');
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
    assert.match((requireGameDisplay().grid[0] ?? []).map(cell => cell.ch).join(''), /wall/, 'the farlook line reached the topline');
    await pline('The echo fades.');
    const recall = ttyDoprevMessage();
    let rows = [];
    for (let round = 0; round < 5; round++) {
        await input.waitUntilBlocked();
        rows = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join(''));
        if ((rows[0] ?? '').includes('Message History'))
            break;
        input.feed(' ');
    }
    const wallRow = rows.find(row => row.includes('wall'));
    assert.ok(wallRow, `recall lists the farlook line, saw: ${rows.slice(0, 12).join(' | ')}`);
    assert.match(wallRow.trimStart(), /^[a-z]/, `only blanks precede the description in the recall row, got ${JSON.stringify(wallRow.trimEnd())}`);
    input.feed(' ');
    await recall;
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
    assert.ok(welcomeBack >= 0 && restoring > welcomeBack, 'the restoring line is newer than the restored welcome line');
    assert.ok(savedWelcome >= 0 && restoring < savedWelcome, 'the restoring line is older than the line saved with the game');
    second.inputGate.feed(' ');
    await second.runUntilInputNeeded();
});
//# sourceMappingURL=msg_history_recall.test.js.map