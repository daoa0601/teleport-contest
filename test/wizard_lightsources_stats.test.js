import test from 'node:test';
import assert from 'node:assert/strict';
import { OIL_LAMP } from '../js/object_data.js';
import { beginObjectBurn } from '../js/timeout.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';
import { addInventoryObject } from './support/game-objects.js';
import { runExtendedCommand } from './support/commands.js';
// Each wizard window waits for a dismiss key; capture the screen at every
// wait so the test sees every page the native game would show.
function captureScreens() {
    const screens = [];
    resetInputState().beforeRead = () => {
        screens.push(requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')));
    };
    return screens;
}
// C wizcmds.c:1112-1114: the #stats row template "%-27s  %4ld  %6ld" and the
// fixed header and separator lines.
function statsRow(label, count, size) {
    return `${label.padEnd(27)}  ${String(count).padStart(4)}  ${String(size).padStart(6)}`;
}
const STATS_HDR = '                             count  bytes';
const STATS_SEP = '---------------------------  ----- -------';
async function freshLitLampRoom() {
    await freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    const lamp = await addInventoryObject(OIL_LAMP);
    // C timeout.c:1789-1793: begin_burn() lights the lamp and registers its
    // light source at the hero's square.
    assert.equal(beginObjectBurn(lamp, game), true);
    return lamp;
}
void test('#lightsources lists a carried lit lamp with C\'s column layout', async () => {
    const lamp = await freshLitLampRoom();
    const screens = captureScreens();
    await runExtendedCommand('lightsources', ' ');
    // The '#' editor reads the command name key by key; keep only the
    // rendered listing screens.
    const windowScreens = screens.filter(rows => rows.some(row => row.includes('Mobile light sources:')));
    assert.equal(windowScreens.length, 1, 'the listing waits for one dismiss key');
    const firstScreen = windowScreens[0];
    assert.ok(firstScreen, 'the listing must render a screen');
    const listing = firstScreen.join('\n');
    // C light.c:945: "Mobile light sources: hero @ (%2d,%2d)".
    assert.match(listing, /Mobile light sources: hero @ \(10,10\)/);
    // C light.c:950-951: the column header and its underline.
    assert.match(listing, /location range flags  type    id/);
    assert.match(listing, /-------- ----- ------ ----  -------/);
    // C light.c:953: "  %2d,%2d   %2d   0x%04x  %s  %s".  The lamp sits at
    // the hero, its range is the lamp value 3 (light.c:874), and its flags
    // show LSF_SHOW (light.c:41), set by the vision pass that followed the
    // lighting.  C's id column is fmt_ptr() of the object address; the port
    // shows the stable o_id in the same shape.
    assert.match(listing, new RegExp(`10,10 {4}3 {3}0x0001 {2}obj {2}0x${lamp.o_id.toString(16)}`));
    assert.equal(game.context.move, 0);
});
void test('#lightsources shows <none> without light sources', async () => {
    await freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    const screens = captureScreens();
    await runExtendedCommand('lightsources', ' ');
    // C light.c:968-969: the empty-listing branch.
    const windowScreens = screens.filter(rows => rows.some(row => row.includes('Mobile light sources:')));
    const firstScreen = windowScreens[0];
    assert.ok(firstScreen, 'the listing must render a screen');
    assert.match(firstScreen.join('\n'), /<none>/);
    assert.doesNotMatch(firstScreen.join('\n'), /location range flags/);
});
void test('#stats reports the reference build\'s memory table', async () => {
    await freshLitLampRoom();
    const screens = captureScreens();
    await runExtendedCommand('stats', ' \x1b');
    // The empty room with one lit lamp yields a two-page NHW_TEXT window.
    const expected = [
        'Current memory statistics:',
        STATS_HDR,
        '  Objects, base size 112',
        statsRow('invent', 1, 112),
        statsRow('fobj', 0, 0),
        STATS_SEP,
        statsRow('  Obj total', 1, 112),
        '',
        '  Monsters, base size 192',
        statsRow('fmon', 0, 0),
        STATS_SEP,
        statsRow('  Mon total', 0, 0),
        '',
        '  Overview',
        statsRow('general, size 384', 0, 0),
        STATS_SEP,
        statsRow('  Over total', 0, 0),
        '',
        '  Miscellaneous',
        statsRow('traps, size 32', 0, 0),
        statsRow('engravings, size 64+text', 0, 0),
        statsRow('light sources, size 32', 1, 32),
        statsRow('timers, size 48', 1, 48),
        STATS_SEP,
        statsRow('  Misc total', 2, 80),
        '',
        STATS_SEP,
        statsRow('  Grand total', 3, 192),
    ];
    // The '#' editor reads the command name key by key; the text window's
    // full pages are the screens whose last row is the pager marker.
    const windowScreens = screens.filter(rows => rows[23]?.trimEnd() === '--More--');
    assert.equal(windowScreens.length, 2, 'the window pages every 23 rows');
    const pageSize = 23;
    for (const [page, screen] of windowScreens.entries()) {
        const rows = expected.slice(page * pageSize, (page + 1) * pageSize);
        while (rows.length < pageSize)
            rows.push('');
        for (const [row, text] of rows.entries())
            assert.equal(screen[row]?.trimEnd(), text, `page ${page + 1} row ${row + 1}`);
        assert.equal(screen[pageSize]?.trimEnd(), '--More--', `page ${page + 1} pager row`);
    }
    assert.equal(game.context.move, 0);
});
//# sourceMappingURL=wizard_lightsources_stats.test.js.map