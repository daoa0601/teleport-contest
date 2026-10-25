// C options.c: handler_autopickup_exception(), handler_menu_colors(),
// handler_menu_headings(), optfn_statushilites() — the "other settings"
// editors and the compound options they own, driven through the O command.
import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';
import { applyNethackrc, doOptions, parseNethackrc } from '../js/options.js';
import { ATR_BOLD, ATR_INVERSE, CLR_GREEN, CLR_RED, NO_COLOR } from '../js/terminal.js';
import { GameDisplay } from '../js/game_display.js';
import { Terminal } from '../js/terminal.js';
import { PosixRegex } from '../js/posix_regex.js';
function screen() {
    return game.nhDisplay?.grid.map(row => row.map(cell => cell.ch).join('')).join('\n') ?? '';
}
// Select the named rows of the full options menu, accept the selection, then
// feed each scripted answer to the sub-menus that follow.
async function fullOptions(names, script) {
    const input = resetInputState();
    const remaining = new Set(names);
    const views = [];
    let selecting = true;
    let answer = '';
    let step = 0;
    const command = rhack('m'.charCodeAt(0));
    await input.waitUntilBlocked();
    input.beforeRead = () => {
        const grid = game.nhDisplay?.grid ?? [];
        const view = screen();
        if (++step > 1200)
            throw new Error(`Options did not finish; remaining: ${[...remaining].join(', ')}`);
        if (!selecting) {
            if (!answer) {
                views.push({
                    text: view,
                    rows: grid.map(row => row.map(cell => ({ ch: cell.ch, attr: cell.attr, color: cell.color }))),
                });
                const expected = script[views.length - 1];
                assert.ok(expected, `Unexpected options sub-view:\n${view}`);
                assert.ok(view.includes(expected.match), `Expected "${expected.match}" in options sub-view:\n${view}`);
                answer = expected.keys;
            }
            input.feed(answer.charAt(0));
            answer = answer.slice(1);
            return;
        }
        const optionText = (line) => line.replace(/^\s*[a-zA-Z?] [-+*#] /, '');
        const row = view.split('\n').find(line => [...remaining].some(name => optionText(line).startsWith(`${name} `)));
        const name = [...remaining].find(name => row && optionText(row).startsWith(`${name} `));
        const key = row?.match(/^\s*([a-zA-Z?]) [-+] /)?.[1];
        if (name && key) {
            remaining.delete(name);
            input.feed(key);
        }
        else if (!remaining.size) {
            selecting = false;
            input.feed('\n');
        }
        else
            input.feed(' ');
    };
    input.feed('O');
    try {
        await command;
        assert.equal(remaining.size, 0, 'Every requested option was offered');
        return views;
    }
    finally {
        input.beforeRead = null;
    }
}
async function optionRow(name) {
    const input = resetInputState();
    const command = rhack('m'.charCodeAt(0));
    await input.waitUntilBlocked();
    input.feed('O');
    for (let page = 0; page < 14; page++) {
        await input.waitUntilBlocked();
        const row = screen().split('\n').find(line => line.replace(/^\s*[a-zA-Z?] [-+*#] /, '').trimStart().startsWith(`${name} `));
        if (row) {
            input.feed('\x1b');
            await command;
            return row;
        }
        input.feed(' ');
    }
    input.feed('\x1b');
    await command;
    assert.fail(`The full options menu did not display ${name}`);
}
void test('autopickup exceptions list and remove from the options menu', async () => {
    freshObjectRoom();
    applyNethackrc('AUTOPICKUP_EXCEPTION=">worthless glass"\nAUTOPICKUP_EXCEPTION="<arrow');
    assert.match(await optionRow('autopickup exceptions'), /\[\(2 currently set\)\]/);
    const views = await fullOptions(['autopickup exceptions'], [
        { match: 'Do what?', keys: 'l' },
        { match: 'List of autopickup exceptions', keys: '\n' },
        { match: 'Do what?', keys: 'r' },
        { match: 'Remove which autopickup exceptions', keys: 'a\n' },
        { match: 'Do what?', keys: 'a' },
        { match: 'What new autopickup exception pattern?', keys: '<gem of seeing\n' },
        { match: 'Do what?', keys: '\n' },
    ]);
    const listing = views.find(view => view.text.includes('List of autopickup exceptions'))?.text ?? '';
    assert.ok(listing.includes("Always pickup '<'; never pickup '>'"), `The listing explains its markers:\n${listing}`);
    assert.ok(listing.includes('"<arrow'), `Newest exception listed first:\n${listing}`);
    assert.ok(listing.includes('">worthless glass'), `Older exception listed second:\n${listing}`);
    // The removal dropped the grab exception; the added pattern keeps its
    // marker prefix and lands newest first.
    assert.equal(game.iflags.autopickupExceptions?.[0]?.pattern, 'gem of seeing');
    assert.equal(game.iflags.autopickupExceptions?.[0]?.grab, true);
    assert.equal(game.iflags.autopickupExceptions?.[1]?.pattern, 'worthless glass');
    assert.equal(game.iflags.autopickupExceptions?.[1]?.grab, false);
    assert.equal(game.iflags.autopickupExceptions?.length, 2);
    assert.match(await optionRow('autopickup exceptions'), /\[\(2 currently set\)\]/);
});
void test('the options menu lists configured menu colors newest first', async () => {
    freshObjectRoom();
    applyNethackrc('MENUCOLOR="blessed.*" = yellow\nMENUCOLOR="cursed item" = light blue&bold');
    assert.match(await optionRow('menu colors'), /\[\(2 currently set\)\]/);
    const views = await fullOptions(['menu colors'], [
        { match: 'Do what?', keys: 'l' },
        { match: 'List of menu colors', keys: '\n' },
        { match: 'Do what?', keys: 'r' },
        { match: 'Remove which menu colors', keys: 'a\n' },
        { match: 'Do what?', keys: '\n' },
    ]);
    const listing = views.find(view => view.text.includes('List of menu colors'))?.text ?? '';
    assert.ok(listing.includes('a - "cursed item"=light-blue&bold'), `Newest color listed first, with its selector letter:\n${listing}`);
    assert.ok(listing.includes('b - "blessed.*"=yellow'), `Older color listed second, with its selector letter:\n${listing}`);
    assert.equal(game.iflags.menuColorings?.length, 1);
    assert.equal(game.iflags.menuColorings?.[0]?.origstr, 'blessed.*');
    assert.equal(game.iflags.menuColorings?.[0]?.color, 11);
    assert.equal(game.iflags.menuColorings?.[0]?.attr, 0);
    assert.match(await optionRow('menu colors'), /\[\(1 currently set\)\]/);
});
void test('menu headings offer the native color and attribute pickers', async () => {
    freshObjectRoom();
    assert.match(await optionRow('menu_headings'), /\[no-color&inverse\]/);
    const views = await fullOptions(['menu_headings'], [
        { match: 'How to highlight menu headings:', keys: 'k' },
        { match: 'How to highlight menu headings:', keys: 'b' },
    ]);
    const colors = views[0]?.text ?? '';
    const attributes = views[1]?.text ?? '';
    assert.ok(colors.includes('light green'), `The color picker offers named colors:\n${colors}`);
    assert.match(colors, /p \* no color/, 'The current color is preselected');
    assert.ok(attributes.includes('underline'), `The attribute picker offers attributes:\n${attributes}`);
    assert.match(attributes, /g \* inverse/, 'The current attribute is preselected');
    // coloratt.c:query_color() colors each name by way of basic_menu_colors(),
    // except black, white, and "no color"; query_attr() draws each attribute
    // row in its own attribute.
    const nameCells = (rows, name) => {
        const row = rows?.find(cells => cells.map(cell => cell.ch).join('').includes(`- ${name}`));
        const start = row?.map(cell => cell.ch).join('').indexOf(name) ?? -1;
        return row && start >= 0 ? row.slice(start, start + name.length) : [];
    };
    for (const cell of nameCells(views[0]?.rows, 'red'))
        assert.equal(cell.color, CLR_RED, 'the "red" name is red');
    for (const cell of nameCells(views[0]?.rows, 'black'))
        assert.equal(cell.color, NO_COLOR, 'black stays uncolored');
    for (const cell of nameCells(views[1]?.rows, 'bold'))
        assert.equal(cell.attr, ATR_BOLD, 'the "bold" name is bold');
    for (const cell of nameCells(views[1]?.rows, 'inverse'))
        assert.equal(cell.attr, ATR_INVERSE, 'the "inverse" name is inverted');
    assert.deepEqual(game.iflags.menu_headings, { attr: 1, color: 11 });
    assert.match(await optionRow('menu_headings'), /\[yellow&bold\]/);
});
void test('the color picker replaces active menucolor rules while it is open', async () => {
    freshObjectRoom();
    // A catch-all rule would recolor every picker row if it stayed active;
    // coloratt.c:basic_menu_colors() swaps the player's rules out for the
    // duration and restores them afterwards.
    applyNethackrc('OPTIONS=menucolors\nMENUCOLOR="."=green');
    const views = await fullOptions(['menu_headings'], [
        { match: 'How to highlight menu headings:', keys: '\x1b' },
    ]);
    const rows = views[0]?.rows;
    const nameCells = (name) => {
        const row = rows?.find(cells => cells.map(cell => cell.ch).join('').includes(`- ${name}`));
        const start = row?.map(cell => cell.ch).join('').indexOf(name) ?? -1;
        return row && start >= 0 ? row.slice(start, start + name.length) : [];
    };
    for (const cell of nameCells('red'))
        assert.equal(cell.color, CLR_RED, 'the "red" name keeps its own color');
    for (const cell of nameCells('black'))
        assert.equal(cell.color, NO_COLOR, 'black stays uncolored');
    assert.equal(game.iflags.menuColorings?.length, 1, 'the player rule is restored');
    assert.equal(game.flags.menucolors, true, 'the menucolors toggle is restored');
});
void test('boolean toggles from the options menu refresh the status fields', async () => {
    freshObjectRoom();
    await fullOptions(['showexp', 'time'], []);
    const status = screen().split('\n').slice(21).join('\n');
    assert.match(status, /Xp:\d+\/\d+/, 'the experience points join the level');
    assert.match(status, /T:\d+/, 'the turn counter joins the status');
    assert.equal(game.context.move, 0, 'changing options takes no turn');
});
void test('a configured menu heading style keeps its parsed value', async () => {
    freshObjectRoom();
    applyNethackrc('OPTIONS=menu_headings:green');
    assert.deepEqual(game.iflags.menu_headings, { attr: 0, color: 2 });
    assert.match(await optionRow('menu_headings'), /\[green&none\]/);
});
void test('menu heading values report unknown colors and attributes', () => {
    const fileErrors = (rc) => parseNethackrc(rc).configErrors[0]?.errors.map(error => error.message) ?? [];
    assert.deepEqual(fileErrors('OPTIONS=menu_headings:green&bogus'), ["Unknown text attribute 'bogus'"]);
    assert.deepEqual(fileErrors('OPTIONS=menu_headings:bogus'), ["Unknown color 'bogus'"]);
    // A negated value draws the generic duplicate complaint first (the
    // option repeats within the file) and bad_negation()'s prose from the
    // option function second, changing nothing.
    const config = parseNethackrc('OPTIONS=menu_headings:green\nOPTIONS=!menu_headings:bold');
    assert.deepEqual(config.configErrors[0]?.errors.map(error => error.message), ['compound option specified multiple times: menu_headings',
        'The menu_headings option may not both have a value and be negated.']);
    assert.deepEqual(config.iflags.menu_headings, { attr: 0, color: 2 });
});
void test('statushilites reports and changes its highlight duration', async () => {
    freshObjectRoom();
    applyNethackrc('OPTIONS=statushilites:5');
    assert.equal(game.iflags.hiliteDelta, 5);
    assert.match(await optionRow('statushilites'), /\[5 \(on: highlight status for 5 turns\)\]/);
    const views = await fullOptions(['statushilites'], [
        { match: 'Set statushilites to what?', keys: '0\n' },
    ]);
    assert.ok(views[0]?.text.includes('Set statushilites to what?'));
    assert.equal(game.iflags.hiliteDelta, 0);
    assert.match(await optionRow('statushilites'), /\[0 \(off: don't highlight status fields\)\]/);
});
void test('sortloot offers the native sorting choices with the current one marked', async () => {
    freshObjectRoom();
    assert.match(await optionRow('sortloot'), /\[loot\]/);
    const views = await fullOptions(['sortloot'], [
        { match: 'Select loot sorting type:', keys: 'f' },
    ]);
    const menu = views[0]?.text ?? '';
    assert.ok(menu.includes('none') && menu.includes('full'), `The choices are listed:\n${menu}`);
    assert.match(menu, /l \* loot/, 'The current sorting type is preselected');
    assert.equal(game.flags.sortloot, 'f');
});
void test('sortdiscoveries picks its discovery ordering from the O command', async () => {
    freshObjectRoom();
    assert.match(await optionRow('sortdiscoveries'), /\[by order of discovery within each class\]/);
    const views = await fullOptions(['sortdiscoveries'], [
        { match: 'Ordering of discoveries', keys: 'c' },
    ]);
    const menu = views[0]?.text ?? '';
    assert.ok(menu.includes('sortloot order (by class with some sub-class groupings)'), `The ordering choices are listed:\n${menu}`);
    assert.ok(menu.includes('alphabetical across all classes'), `All four orderings are offered:\n${menu}`);
    assert.equal(game.flags.discosort, 'c');
    assert.match(await optionRow('sortdiscoveries'), /\[alphabetical within each class\]/);
});
void test('an over-long menu color pattern is elided at the native byte limit', async () => {
    freshObjectRoom();
    // The 255-byte listing row needs a terminal wide enough to show it.
    game.nhDisplay = new GameDisplay(new Terminal(null, { cols: 300, rows: 24 }));
    // Neither the tty line editor (COLNO characters) nor the 255-byte
    // MENUCOLOR statement can carry a pattern long enough to reach the
    // listing row's budget, so seed the two boundary lengths and list them
    // through the O command: beside the `"=no-color` suffix, 244 bytes
    // remain and the elision keeps 241 of them.
    game.iflags.menuColorings = [
        { origstr: 'z'.repeat(245), color: 8, attr: 0, regex: new PosixRegex('z') },
        { origstr: 'y'.repeat(244), color: 8, attr: 0, regex: new PosixRegex('y') },
    ];
    const views = await fullOptions(['menu colors'], [
        { match: 'Do what?', keys: 'l' },
        { match: 'List of menu colors', keys: '\n' },
        { match: 'Do what?', keys: '\n' },
    ]);
    const listing = (views.find(view => view.text.includes('List of menu colors'))?.text ?? '')
        .split('\n').map(row => row.trim());
    const yRow = listing.find(row => row.startsWith('b - "yyy'));
    const zRow = listing.find(row => row.startsWith('a - "zzz'));
    assert.ok(yRow && zRow, `Both patterns are listed:\n${listing.join('\n')}`);
    assert.ok(!yRow.includes('...'), `A pattern at the row budget is kept whole:\n${yRow}`);
    assert.ok(zRow.endsWith('..."=no-color'), `One byte past the budget is elided:\n${zRow}`);
    assert.equal(zRow.length, 259, 'The elided row is 4 columns of letter prefix plus the 255-byte row');
});
void test('options menu section headings keep their style under menucolor rules', async () => {
    freshObjectRoom();
    applyNethackrc('OPTIONS=menucolors\nMENUCOLOR="."=red');
    // options.c:8831 adds the full menu's section titles via add_menu_heading(),
    // whose MENU_ITEMFLAGS_SKIPMENUCOLORS keeps them out of rule matching,
    // while doset_add_menu() rows take the rule.
    const full = resetInputState();
    const fullCommand = rhack('m'.charCodeAt(0));
    await full.waitUntilBlocked();
    full.feed('O');
    await full.waitUntilBlocked();
    let grid = game.nhDisplay?.grid ?? [];
    let rows = grid.map(row => row.map(cell => cell.ch).join(''));
    const heading = grid[rows.findIndex(row => row.includes('Booleans (selecting will toggle value):'))];
    assert.ok(heading, 'the full options menu shows its Booleans heading');
    for (const cell of heading)
        if (cell.ch !== ' ')
            assert.equal(cell.color, NO_COLOR);
    const choiceRow = grid[rows.findIndex(row => / [-+] view help for options menu/.test(row))];
    assert.ok(choiceRow, 'the full options menu offers its help entry');
    const choiceText = rows[grid.indexOf(choiceRow)] ?? '';
    const helpColumn = choiceText.indexOf('view help');
    for (const cell of choiceRow.slice(helpColumn, helpColumn + 'view help'.length))
        assert.equal(cell.color, CLR_RED, 'an option row takes the rule');
    full.feed('\x1b');
    await fullCommand;
    // options.c:8585 builds the simple menu's section headings the same way.
    const simple = resetInputState();
    const simpleCommand = doOptions();
    await simple.waitUntilBlocked();
    grid = game.nhDisplay?.grid ?? [];
    rows = grid.map(row => row.map(cell => cell.ch).join(''));
    const simpleHeading = grid[rows.findIndex(row => row.includes('General'))];
    assert.ok(simpleHeading, 'the simple options menu shows its General heading');
    for (const cell of simpleHeading)
        if (cell.ch !== ' ')
            assert.equal(cell.color, NO_COLOR);
    const fruitRow = grid[rows.findIndex(row => / [-+] fruit /.test(row))];
    assert.ok(fruitRow, 'the simple options menu lists fruit');
    const fruitText = rows[grid.indexOf(fruitRow)] ?? '';
    for (const cell of fruitRow.slice(fruitText.indexOf('fruit'), fruitText.indexOf('fruit') + 'fruit'.length))
        assert.equal(cell.color, CLR_RED);
    simple.feed('\x1b');
    await simpleCommand;
});
void test('the status-conditions heading keeps its style under menucolor rules', async () => {
    freshObjectRoom();
    applyNethackrc('OPTIONS=menucolors\nMENUCOLOR="."=red');
    // botl.c:1411 emits the "sorted ..." row via add_menu_heading(); the
    // cond_ rows around it are plain add_menu() rows.
    const views = await fullOptions(['status condition fields'], [
        { match: 'Choose status conditions to toggle', keys: '\x1b' },
    ]);
    const rows = views[0]?.rows ?? [];
    const rowText = (cells) => cells.map(cell => cell.ch).join('');
    const sorted = rows.find(cells => rowText(cells).includes('sorted alphabetically'));
    assert.ok(sorted, `The condition editor lists its sort order:\n${views[0]?.text ?? ''}`);
    const sortedText = rowText(sorted);
    for (const cell of sorted.slice(sortedText.indexOf('sorted'), sortedText.indexOf('sorted') + 'sorted'.length))
        assert.equal(cell.color, NO_COLOR);
    const condition = rows.find(cells => / [-+] cond_/.test(rowText(cells)));
    assert.ok(condition, 'The condition editor lists cond_ rows');
    const conditionText = rowText(condition);
    for (const cell of condition.slice(conditionText.indexOf('cond_'), conditionText.indexOf('cond_') + 5))
        assert.equal(cell.color, CLR_RED);
});
//# sourceMappingURL=options_other_settings.test.js.map