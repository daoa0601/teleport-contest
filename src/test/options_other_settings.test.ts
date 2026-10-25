// C options.c: handler_autopickup_exception(), handler_menu_colors(),
// handler_menu_headings(), optfn_statushilites() — the "other settings"
// editors and the compound options they own, driven through the O command.
import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';
import { applyNethackrc, parseNethackrc } from '../js/options.js';

function screen(): string {
    return game.nhDisplay?.grid.map(row => row.map(cell => cell.ch).join('')).join('\n') ?? '';
}

interface ScriptedAnswer {
    match: string;
    keys: string;
}

// Select the named rows of the full options menu, accept the selection, then
// feed each scripted answer to the sub-menus that follow.
async function fullOptions(
    names: readonly string[], script: readonly ScriptedAnswer[],
): Promise<string[]> {
    const input = resetInputState();
    const remaining = new Set(names);
    const views: string[] = [];
    let selecting = true;
    let answer = '';
    let step = 0;
    const command = rhack('m'.charCodeAt(0));
    await input.waitUntilBlocked();
    input.beforeRead = () => {
        const view = screen();
        if (++step > 400) throw new Error(`Options did not finish; remaining: ${[...remaining].join(', ')}`);
        if (!selecting) {
            if (!answer) {
                views.push(view);
                const expected = script[views.length - 1];
                assert.ok(expected, `Unexpected options sub-view:\n${view}`);
                assert.ok(view.includes(expected.match),
                    `Expected "${expected.match}" in options sub-view:\n${view}`);
                answer = expected.keys;
            }
            input.feed(answer.charAt(0));
            answer = answer.slice(1);
            return;
        }
        const optionText = (line: string) => line.replace(/^\s*[a-zA-Z?] [-+*#] /, '');
        const row = view.split('\n').find(line => [...remaining].some(name => optionText(line).startsWith(`${name} `)));
        const name = [...remaining].find(name => row && optionText(row).startsWith(`${name} `));
        const key = row?.match(/^\s*([a-zA-Z?]) [-+] /)?.[1];
        if (name && key) {
            remaining.delete(name);
            input.feed(key);
        } else if (!remaining.size) {
            selecting = false;
            input.feed('\n');
        } else input.feed(' ');
    };
    input.feed('O');
    try {
        await command;
        assert.equal(remaining.size, 0, 'Every requested option was offered');
        return views;
    } finally {
        input.beforeRead = null;
    }
}

async function optionRow(name: string): Promise<string> {
    const input = resetInputState();
    const command = rhack('m'.charCodeAt(0));
    await input.waitUntilBlocked();
    input.feed('O');
    for (let page = 0; page < 14; page++) {
        await input.waitUntilBlocked();
        const row = screen().split('\n').find(line =>
            line.replace(/^\s*[a-zA-Z?] [-+*#] /, '').trimStart().startsWith(`${name} `));
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

    const listing = views.find(view => view.includes('List of autopickup exceptions')) ?? '';
    assert.ok(listing.includes("Always pickup '<'; never pickup '>'"),
        `The listing explains its markers:\n${listing}`);
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

    const listing = views.find(view => view.includes('List of menu colors')) ?? '';
    assert.ok(listing.indexOf('"cursed item"=light-blue&bold') >= 0,
        `Newest color listed first:\n${listing}`);
    assert.ok(listing.indexOf('"blessed.*"=yellow') > listing.indexOf('"cursed item"'),
        `Older color listed second:\n${listing}`);
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

    const colors = views[0] ?? '';
    const attributes = views[1] ?? '';
    assert.ok(colors.includes('light green'), `The color picker offers named colors:\n${colors}`);
    assert.match(colors, /p \* no color/, 'The current color is preselected');
    assert.ok(attributes.includes('underline'), `The attribute picker offers attributes:\n${attributes}`);
    assert.match(attributes, /g \* inverse/, 'The current attribute is preselected');

    assert.deepEqual(game.iflags.menu_headings, { attr: 1, color: 11 });
    assert.match(await optionRow('menu_headings'), /\[yellow&bold\]/);
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
    const fileErrors = (rc: string) =>
        parseNethackrc(rc).configErrors[0]?.errors.map(error => error.message) ?? [];

    assert.deepEqual(fileErrors('OPTIONS=menu_headings:green&bogus'),
        ["Unknown text attribute 'bogus'"]);
    assert.deepEqual(fileErrors('OPTIONS=menu_headings:bogus'),
        ["Unknown color 'bogus'"]);
    // A negated value keeps bad_negation()'s prose and changes nothing.
    const config = parseNethackrc('OPTIONS=menu_headings:green\nOPTIONS=!menu_headings:bold');
    assert.deepEqual(config.configErrors[0]?.errors.map(error => error.message),
        ['The menu_headings option may not both have a value and be negated.']);
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

    assert.ok(views[0]?.includes('Set statushilites to what?'));
    assert.equal(game.iflags.hiliteDelta, 0);
    assert.match(await optionRow('statushilites'), /\[0 \(off: don't highlight status fields\)\]/);
});

void test('sortloot offers the native sorting choices with the current one marked', async () => {
    freshObjectRoom();

    assert.match(await optionRow('sortloot'), /\[loot\]/);

    const views = await fullOptions(['sortloot'], [
        { match: 'Select loot sorting type:', keys: 'f' },
    ]);

    const menu = views[0] ?? '';
    assert.ok(menu.includes('none') && menu.includes('full'), `The choices are listed:\n${menu}`);
    assert.match(menu, /l \* loot/, 'The current sorting type is preselected');
    assert.equal(game.flags.sortloot, 'f');
});
