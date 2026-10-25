import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { LADDER, LA_UP } from '../js/const.js';
import { flush_screen, newsym } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';
function screen() {
    return game.nhDisplay?.grid.map(row => row.map(cell => cell.ch).join('')).join('\n') ?? '';
}
function menuRow(name) {
    const row = screen().split('\n').find(line => {
        const text = line.replace(/^\s*[a-zA-Z?] [-+*#] /, '');
        return text.startsWith(`${name} `);
    });
    const key = row?.match(/^\s*([a-zA-Z?]) [-+*#] /)?.[1];
    return row && key ? { key, text: row.replace(/^\s*[a-zA-Z?] [-+*#] /, '') } : null;
}
// Opens the simple options menu with 'O', selects `option`, and interacts
// with the follow-up window: whenever its rows contain `name`, that key is
// pressed; otherwise the menu pages forward.  Every screen the follow-up
// shows is captured.  The options menu itself is dismissed afterwards.
async function driveOptionWindow(option, name) {
    const input = resetInputState();
    const pickerScreens = [];
    let pickingOption = true;
    let pickingTarget = false;
    const selectRow = (wanted) => {
        const row = menuRow(wanted);
        if (!row)
            return false;
        input.feed(row.key);
        return true;
    };
    input.beforeRead = () => {
        if (pickingOption) {
            if (selectRow(option)) {
                pickingOption = false;
                pickingTarget = true;
            }
            else
                input.feed(' ');
            return;
        }
        if (pickingTarget) {
            pickerScreens.push(screen());
            if (selectRow(name))
                pickingTarget = false;
            else
                input.feed(' ');
            return;
        }
        input.feed('\x1b');
    };
    await rhack('O'.charCodeAt(0));
    input.beforeRead = null;
    return { pickerScreens };
}
function installLadderUp(x, y) {
    const location = game.level?.at(x, y);
    assert.ok(location, 'the room exposes the test cell');
    location.typ = LADDER;
    location.ladder = LA_UP;
    newsym(x, y);
    return { column: x - 1, row: y + 1 };
}
// symbols.c:do_symset(): picking DECgraphics from the "Select symbol set:"
// menu swaps the active set and redraws the map through the new symbols,
// exactly like switch_symbols() plus doredraw().
void test('the options-menu symset picker switches the live symbol set', async () => {
    freshObjectRoom({ flags: { verbose: false } });
    requirePlayingGame(game);
    const cell = installLadderUp(12, 8);
    await flush_screen(1);
    assert.equal(screen().split('\n')[cell.row]?.charAt(cell.column), '<');
    const { pickerScreens } = await driveOptionWindow('symset', 'DECgraphics');
    assert.ok(pickerScreens.some(view => /Select symbol set:/.test(view)));
    assert.ok(pickerScreens.some(view => view.includes("same as default symbols, except '+' for corner walls")));
    assert.ok(pickerScreens.some(view => view.includes('approximation of IBMgraphics using DECgraphics')));
    assert.ok(!pickerScreens.some(view => / [-+*#] RogueIBM /.test(view)), 'a rogue-restricted set stays out of the primary picker');
    assert.equal(game.symset, 'DECgraphics');
    assert.equal(screen().split('\n')[cell.row]?.charAt(cell.column), '\u2264');
});
void test('choosing Default Symbols from the picker reverts the map', async () => {
    freshObjectRoom({ flags: { verbose: false } });
    requirePlayingGame(game);
    game.symset = 'DECgraphics';
    const cell = installLadderUp(12, 8);
    await flush_screen(1);
    assert.equal(screen().split('\n')[cell.row]?.charAt(cell.column), '\u2264');
    await driveOptionWindow('symset', 'Default Symbols');
    assert.equal(game.symset, null);
    assert.equal(screen().split('\n')[cell.row]?.charAt(cell.column), '<');
});
// do_symset() sets nothing_to_do when the pick is dismissed.
void test('dismissing the symset picker keeps the current set', async () => {
    freshObjectRoom({ flags: { verbose: false } });
    requirePlayingGame(game);
    game.symset = 'DECgraphics';
    const input = resetInputState();
    let pickingOption = true;
    let escapeCount = 0;
    input.beforeRead = () => {
        if (pickingOption) {
            const row = menuRow('symset');
            if (row) {
                input.feed(row.key);
                pickingOption = false;
            }
            else
                input.feed(' ');
            return;
        }
        escapeCount++;
        input.feed('\x1b');
    };
    await rhack('O'.charCodeAt(0));
    input.beforeRead = null;
    assert.ok(escapeCount >= 2, 'the escape dismissed both the picker and the options menu');
    assert.equal(game.symset, 'DECgraphics');
});
// The rogue picker lists the Rogue*-restricted sets and drops the
void test('the roguesymset picker lists rogue-eligible sets', async () => {
    freshObjectRoom({ flags: { verbose: false } });
    requirePlayingGame(game);
    const input = resetInputState();
    const pickerScreens = [];
    let sentPrefix = false;
    let pickingOption = true;
    let pickingTarget = false;
    input.beforeRead = () => {
        if (!sentPrefix) {
            sentPrefix = true;
            input.feed('O');
            return;
        }
        if (pickingOption) {
            const row = menuRow('roguesymset');
            if (row) {
                input.feed(row.key);
                pickingOption = false;
                pickingTarget = true;
            }
            else
                input.feed(' ');
            return;
        }
        if (pickingTarget) {
            pickerScreens.push(screen());
            const row = menuRow('RogueWindows');
            if (row) {
                input.feed(row.key);
                pickingTarget = false;
            }
            else
                input.feed(' ');
            return;
        }
        input.feed('\x1b');
    };
    await rhack('m'.charCodeAt(0));
    input.beforeRead = null;
    assert.ok(pickerScreens.some(view => /Select rogue level symbol set:/.test(view)));
    assert.ok(pickerScreens.some(view => / [-+*#] RogueIBM /.test(view)));
    assert.ok(pickerScreens.some(view => view.includes('rogue level color symbol set like Epyx Rogue')));
    assert.ok(!pickerScreens.some(view => / [-+*#] DECgraphics /.test(view)), 'a primary-restricted set stays out of the rogue picker');
    assert.equal(game.rogueSymset, 'RogueWindows');
});
// options.c:doset_simple() swaps the simple menu's symset row for the
// rogue set's while the hero is on the Rogue level.
void test('the simple options menu offers roguesymset on the Rogue level', async () => {
    freshObjectRoom({ flags: { verbose: false } });
    requirePlayingGame(game);
    game.rogue_level = { ...game.u.uz };
    game.rogueSymset = 'RogueIBM';
    const input = resetInputState();
    const views = [];
    let pickingOption = true;
    let pickingTarget = false;
    input.beforeRead = () => {
        if (pickingOption) {
            views.push(screen());
            const rogueRow = menuRow('roguesymset');
            if (rogueRow) {
                input.feed(rogueRow.key);
                pickingOption = false;
                pickingTarget = true;
            }
            else
                input.feed(' ');
            return;
        }
        if (pickingTarget) {
            const row = menuRow('RogueEpyx');
            if (row) {
                input.feed(row.key);
                pickingTarget = false;
            }
            else
                input.feed(' ');
            return;
        }
        input.feed('\x1b');
    };
    await rhack('O'.charCodeAt(0));
    input.beforeRead = null;
    delete game.rogue_level;
    assert.ok(views.some(view => / [-+*#] roguesymset +\[RogueIBM, active\]/.test(view)), 'the symset row is replaced by the active rogue set');
    assert.ok(!views.some(view => / [-+*#] symset /.test(view)), 'the primary symset row is hidden on the Rogue level');
    assert.equal(game.rogueSymset, 'RogueEpyx');
});
//# sourceMappingURL=symset_picker.test.js.map