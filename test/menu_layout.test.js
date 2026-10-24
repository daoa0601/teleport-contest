import assert from 'node:assert/strict';
import test from 'node:test';
import { NHW_MENU, PICK_ONE } from '../js/const.js';
import { GameDisplay } from '../js/game_display.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { NO_COLOR, Terminal } from '../js/terminal.js';
import { tty_add_menu, tty_create_nhwindow, tty_destroy_nhwindow, tty_end_menu, tty_select_menu, tty_start_menu, } from '../js/tty_menu.js';
import { ATR_INVERSE, showChoiceWindow, showInventoryWindow, showMultiSelectWindow, showDisclosureOverlay, showPagedPickOneMenu, showTextMenuOverlay, } from '../js/windows.js';
import { freshPlayableRoom } from './support/playable-room.js';
function menuDisplay(columns = 80, rows = 24) {
    freshPlayableRoom();
    const display = new GameDisplay(new Terminal(null, { cols: columns, rows }));
    game.nhDisplay = display;
    display.setCell(5, 10, '@', NO_COLOR);
    return display;
}
function textRow(display, row) {
    return display.grid[row]?.map(cell => cell.ch).join('') ?? '';
}
for (const columns of [40, 120]) {
    void test(`a putstr-built menu on a ${columns}-column terminal uses the native corner origin`, async () => {
        const display = menuDisplay(columns);
        const input = resetInputState();
        const window = showDisclosureOverlay(['No creatures have died.']);
        try {
            await input.waitUntilBlocked();
            const left = Math.min(Math.floor(columns / 2), columns - 'No creatures have died.'.length - 2) + 1;
            assert.equal(textRow(display, 0).indexOf('No creatures'), left);
            assert.equal(display.cursorCol, left + '--More--'.length);
        }
        finally {
            input.feed(' ');
            await window;
        }
    });
}
for (const { columns, firstColumn } of [
    { columns: 40, firstColumn: 21 },
    { columns: 80, firstColumn: 41 },
    { columns: 120, firstColumn: 61 },
    { columns: 300, firstColumn: 83 },
]) {
    void test(`a narrow menu on a ${columns}-column terminal respects the native corner limit`, async () => {
        const display = menuDisplay(columns);
        const input = resetInputState();
        const menu = showInventoryWindow([{ items: [{ text: 'Maps' }] }]);
        try {
            await input.waitUntilBlocked();
            assert.equal(textRow(display, 0).indexOf('Maps'), firstColumn);
            assert.equal(display.cursorCol, firstColumn + 6);
            assert.equal(display.cursorRow, 1);
            assert.equal(display.grid[10]?.[5]?.ch, '@');
        }
        finally {
            input.feed('\x1b');
            await menu;
        }
    });
}
for (const { rows, firstColumn, mapVisible } of [
    { rows: 22, firstColumn: 41, mapVisible: true },
    { rows: 23, firstColumn: 1, mapVisible: false },
]) {
    void test(`${rows} content rows include the footer when deciding whether to clear the screen`, async () => {
        const display = menuDisplay();
        const input = resetInputState();
        const menu = showInventoryWindow([{ items: Array.from({ length: rows }, () => ({ text: 'Maps' })) }]);
        try {
            await input.waitUntilBlocked();
            assert.equal(textRow(display, 0).indexOf('Maps'), firstColumn);
            assert.equal(display.cursorRow, rows);
            assert.equal(display.grid[10]?.[5]?.ch, mapVisible ? '@' : ' ');
        }
        finally {
            input.feed('\x1b');
            await menu;
        }
    });
}
void test('disabling menu overlays clears even a short menu from the left edge', async () => {
    const display = menuDisplay();
    game.flags.menu_overlay = false;
    const input = resetInputState();
    const menu = showTextMenuOverlay(['Directions']);
    try {
        await input.waitUntilBlocked();
        assert.equal(textRow(display, 0).indexOf('Directions'), 1);
        assert.equal(display.grid[10]?.[5]?.ch, ' ');
        assert.equal(display.cursorCol, 7);
    }
    finally {
        input.feed('\x1b');
        await menu;
    }
});
for (const overlay of [true, false]) {
    void test(`a retained menu uses ${overlay ? 'corner' : 'full-screen'} placement after menu_overlay changes`, async () => {
        const display = menuDisplay();
        game.flags.menu_overlay = !overlay;
        const window = tty_create_nhwindow(NHW_MENU);
        await tty_start_menu(window);
        tty_add_menu(window, { identifier: 'dagger', selector: 'a', text: 'a dagger' });
        tty_end_menu(window);
        const input = resetInputState();
        input.feed('\n');
        await tty_select_menu(window, PICK_ONE);
        game.flags.menu_overlay = overlay;
        display.setCell(5, 10, '@', NO_COLOR);
        const selection = tty_select_menu(window, PICK_ONE);
        try {
            await input.waitUntilBlocked();
            const firstColumn = overlay ? 41 : 1;
            assert.equal(textRow(display, 0).indexOf('a - a dagger'), firstColumn, 'redisplay must use the current overlay setting');
            assert.equal(display.grid[10]?.[5]?.ch, overlay ? '@' : ' ', 'full-screen placement clears the map while a corner preserves it');
            assert.equal(display.cursorCol, firstColumn + '(end) '.length);
            assert.equal(display.cursorRow, 1);
        }
        finally {
            input.feed('a');
            const result = await selection;
            await tty_destroy_nhwindow(window);
            assert.equal(result.selections[0]?.identifier, 'dagger');
        }
    });
}
void test('an empty inventory menu still displays a dismissible footer', async () => {
    const display = menuDisplay();
    const input = resetInputState();
    const menu = showInventoryWindow([]);
    try {
        await input.waitUntilBlocked();
        assert.equal(textRow(display, 0).indexOf('(end)'), 41);
        assert.equal(display.cursorCol, 47);
        assert.equal(display.cursorRow, 0);
    }
    finally {
        input.feed('\x1b');
        assert.equal((await menu).key, 27);
    }
});
void test('a retained menu leaves the final column blank after the terminal narrows', async () => {
    menuDisplay();
    const window = tty_create_nhwindow(NHW_MENU);
    await tty_start_menu(window);
    const description = 'a robe embroidered with silver stars and golden moons';
    tty_add_menu(window, { identifier: 'robe', selector: 'a', text: description });
    tty_end_menu(window);
    const display = new GameDisplay(new Terminal(null, { cols: 40, rows: 24 }));
    game.nhDisplay = display;
    const input = resetInputState();
    const selection = tty_select_menu(window, PICK_ONE);
    try {
        await input.waitUntilBlocked();
        assert.match(textRow(display, 0), /^ a - a robe embroidered/);
        assert.equal(textRow(display, 0).charAt(39), ' ', 'menu text must leave the last column blank');
    }
    finally {
        input.feed('a');
        assert.equal((await selection).selections[0]?.identifier, 'robe');
    }
    const wider = new GameDisplay(new Terminal(null, { cols: 80, rows: 24 }));
    game.nhDisplay = wider;
    const redisplay = tty_select_menu(window, PICK_ONE);
    try {
        await input.waitUntilBlocked();
        assert.match(textRow(wider, 0), /silver stars and golden moons/, 'painting on a narrow terminal retains the stored description');
    }
    finally {
        input.feed('\n');
        await redisplay;
        await tty_destroy_nhwindow(window);
    }
});
void test('a retained menu keeps its truncated end marker after the terminal widens', async () => {
    menuDisplay(4);
    const window = tty_create_nhwindow(NHW_MENU);
    await tty_start_menu(window);
    tty_add_menu(window, { identifier: null, text: 'Map' });
    tty_end_menu(window);
    const display = new GameDisplay(new Terminal(null, { cols: 40, rows: 24 }));
    game.nhDisplay = display;
    const input = resetInputState();
    const selection = tty_select_menu(window, PICK_ONE);
    try {
        await input.waitUntilBlocked();
        assert.equal(textRow(display, 1).trim(), '(end', 'enlarging the terminal does not recreate the stored pager');
        assert.equal(display.cursorCol, 25, 'the cursor follows the retained pager text');
    }
    finally {
        input.feed('\n');
        await selection;
        await tty_destroy_nhwindow(window);
    }
});
for (const { kind, cursorCol } of [{ kind: 'menu', cursorCol: 12 }, { kind: 'prose', cursorCol: 15 }]) {
    void test(`a narrow ${kind} window leaves its cursor after the complete pager`, async () => {
        const display = menuDisplay(12);
        const input = resetInputState();
        const window = kind === 'menu' ? showTextMenuOverlay(['Map']) : showDisclosureOverlay(['Map']);
        try {
            await input.waitUntilBlocked();
            assert.equal(display.cursorCol, cursorCol, 'dmore counts the complete prompt even past the screen edge');
            input.feed('x');
            await input.waitUntilBlocked();
            assert.equal(display.cursorCol, cursorCol, 'an ignored key keeps the same pager cursor');
        }
        finally {
            input.feed(' ');
            await window;
        }
    });
}
void test('menu rows leave the right margin blank when descriptions exceed terminal width', async () => {
    const display = menuDisplay(40);
    const input = resetInputState();
    const menu = showInventoryWindow([{ items: [{ text: 'robe '.repeat(20), value: 'robe' }] }], { pickMode: PICK_ONE });
    try {
        await input.waitUntilBlocked();
        assert.match(textRow(display, 0), /^ a - robe /);
        assert.equal(textRow(display, 0).slice(38), 'e ');
        assert.equal(display.cursorCol, 7);
    }
    finally {
        input.feed('a');
        assert.equal((await menu).value, 'robe');
    }
});
void test('selectable descriptions are bounded before their selector and margins are added', async () => {
    const display = menuDisplay(300);
    const input = resetInputState();
    const menu = showInventoryWindow([{ items: [{ text: 'r'.repeat(280), value: 'robe' }] }], { pickMode: PICK_ONE });
    try {
        await input.waitUntilBlocked();
        assert.equal(textRow(display, 0).indexOf('a - '), 39);
        assert.equal(textRow(display, 0).lastIndexOf('r'), 297);
        assert.equal(textRow(display, 0).slice(298), '  ');
    }
    finally {
        input.feed('a');
        assert.equal((await menu).value, 'robe');
    }
});
void test('later long rows size every page and a tall terminal retains its corner menu', async () => {
    const display = menuDisplay(80, 60);
    display.setCell(70, 20, '.', NO_COLOR);
    const items = Array.from({ length: 53 }, (_, index) => ({
        text: index === 52 ? 'a map showing the distant northern mountains!!' : `map ${index}`,
        value: index,
    }));
    const input = resetInputState();
    const menu = showInventoryWindow([{ items }], { pickMode: PICK_ONE });
    try {
        await input.waitUntilBlocked();
        assert.equal(textRow(display, 0).indexOf('a - map 0'), 28);
        assert.equal(display.grid[10]?.[5]?.ch, '@');
        assert.equal(textRow(display, 52).indexOf('(1 of 2)'), 28);
        assert.equal(display.cursorCol, 36);
        input.feed('>');
        await input.waitUntilBlocked();
        assert.equal(textRow(display, 0).indexOf('a - a map showing'), 28);
        assert.equal(display.cursorRow, 1);
        assert.equal(display.cursorCol, 36);
        assert.equal(display.grid[20]?.[70]?.ch, '.', 'the shorter corner page exposes the underlying map');
    }
    finally {
        input.feed('a');
        assert.equal((await menu).value, 52);
    }
});
void test('automatic multi-select letters restart by page and ignore explicit selectors', async () => {
    const display = menuDisplay();
    const input = resetInputState();
    const menu = showMultiSelectWindow({
        title: 'Take which maps?', omitHeadings: true, pageLocalKeys: true, pickOne: true,
        sections: [{ items: [
                    { key: '$', text: 'gold pieces', value: -1 },
                    ...Array.from({ length: 22 }, (_, value) => ({ text: `map ${value}`, value })),
                ] }],
    });
    try {
        await input.waitUntilBlocked();
        assert.match(textRow(display, 2), /\$ - gold pieces/);
        assert.match(textRow(display, 3), /a - map 0/);
        input.feed(' ');
        await input.waitUntilBlocked();
        assert.match(textRow(display, 0), /a - map 20/);
        assert.match(textRow(display, 1), /b - map 21/);
    }
    finally {
        input.feed('a');
        assert.deepEqual(await menu, [20]);
    }
});
void test('choice menus paginate at the actual terminal height and reject off-page selectors', async () => {
    const display = menuDisplay(40, 8);
    const input = resetInputState();
    const menu = showChoiceWindow({
        title: 'Choose a route',
        entries: [
            { key: 'a', text: 'north' }, { key: 'b', text: 'east' },
            { key: 'c', text: 'south' }, { key: 'd', text: 'west' },
            { key: 'e', text: 'stairs' }, { key: 'f', text: 'portal' },
        ],
    });
    try {
        await input.waitUntilBlocked();
        assert.equal(textRow(display, 7).trim(), '(1 of 2)');
        input.feed('f');
        await input.waitUntilBlocked();
        assert.equal(textRow(display, 7).trim(), '(1 of 2)', 'an off-page selector keeps the current page open');
        input.feed(' ');
        await input.waitUntilBlocked();
        assert.equal(textRow(display, 0).trim(), 'f - portal');
        assert.equal(display.cursorRow, 1);
        assert.equal(display.cursorCol, 9);
    }
    finally {
        input.feed('f');
        assert.equal(await menu, 'f'.charCodeAt(0));
    }
});
void test('a single-page pick-one menu uses the shared corner and end marker', async () => {
    const display = menuDisplay();
    const input = resetInputState();
    const menu = showPagedPickOneMenu({ rows: ['Aim for what?', '', 'a - the floor'], choices: new Map([['a', 'floor']]) });
    try {
        await input.waitUntilBlocked();
        assert.equal(textRow(display, 0).indexOf('Aim'), 41);
        assert.equal(textRow(display, 3).trim(), '(end)');
        assert.equal(display.cursorCol, 47);
    }
    finally {
        input.feed('a');
        assert.equal(await menu, 'floor');
    }
});
void test('menu attributes start after the selector prefix', async () => {
    const display = menuDisplay();
    const input = resetInputState();
    const menu = showInventoryWindow([{ items: [{ text: 'robe', key: 'z', attr: ATR_INVERSE }] }], { pickMode: PICK_ONE });
    try {
        await input.waitUntilBlocked();
        assert.equal(display.grid[0]?.[41]?.attr, 0);
        assert.equal(display.grid[0]?.[45]?.attr, ATR_INVERSE);
    }
    finally {
        input.feed('z');
        assert.equal((await menu).key, 'z'.charCodeAt(0));
    }
});
void test('a visible choice selector takes precedence over a paging command', async () => {
    const display = menuDisplay();
    const input = resetInputState();
    const menu = showChoiceWindow({
        title: 'Choose a direction', entries: [{ key: '>', text: 'go downstairs' }],
    });
    await input.waitUntilBlocked();
    assert.match(textRow(display, 2), /> - go downstairs/);
    input.feed('>');
    assert.equal(await menu, '>'.charCodeAt(0));
});
void test('a choice menu ignores a leading zero count and then selects a visible item', async () => {
    menuDisplay();
    const input = resetInputState();
    input.feed('0a');
    const selected = await showChoiceWindow({
        title: 'Choose a mode', entries: [{ key: 'a', text: 'default' }],
    });
    assert.equal(selected, 'a'.charCodeAt(0));
});
void test('a nonselectable heading with native fake-entry syntax keeps its prefix plain', async () => {
    const display = menuDisplay();
    const input = resetInputState();
    const menu = showInventoryWindow([{ heading: 'A - Equipment', items: [{ text: 'robe' }] }]);
    try {
        await input.waitUntilBlocked();
        assert.equal(textRow(display, 0).indexOf('A - Equipment'), 41);
        assert.equal(display.grid[0]?.[41]?.attr, 0);
        assert.equal(display.grid[0]?.[45]?.attr, ATR_INVERSE);
    }
    finally {
        input.feed('\x1b');
        await menu;
    }
});
void test('preselected inventory entries retain description-only attributes after their marker changes', async () => {
    const display = menuDisplay();
    const input = resetInputState();
    const menu = showInventoryWindow([{ items: [{ key: 'a', text: 'robe', attr: ATR_INVERSE }] }], {
        pickMode: PICK_ONE, preselectedKey: 'a',
    });
    try {
        await input.waitUntilBlocked();
        assert.match(textRow(display, 0), /a \* robe/);
        assert.equal(display.grid[0]?.[43]?.attr, 0);
        assert.equal(display.grid[0]?.[45]?.attr, ATR_INVERSE);
    }
    finally {
        input.feed('\x1b');
        await menu;
    }
});
void test('multi-select paging stops at its ends and only selects visible item letters', async () => {
    const display = menuDisplay(80, 8);
    const input = resetInputState();
    const menu = showMultiSelectWindow({
        title: 'Take which maps?', omitHeadings: true,
        sections: [{ items: Array.from({ length: 10 }, (_, index) => ({
                    key: String.fromCharCode(97 + index), text: `map ${index}`, value: index,
                })) }],
    });
    try {
        await input.waitUntilBlocked();
        input.feed('<');
        await input.waitUntilBlocked();
        assert.match(textRow(display, 7), /\(1 of 2\)/);
        input.feed('j>');
        await input.waitUntilBlocked();
        assert.match(textRow(display, 0), /f - map 5/);
        input.feed('j^');
        await input.waitUntilBlocked();
        assert.match(textRow(display, 7), /\(1 of 2\)/);
        input.feed('|>');
        await input.waitUntilBlocked();
        assert.match(textRow(display, 4), /j \* map 9/);
        input.feed('\n');
        assert.deepEqual(await menu, [9]);
    }
    finally {
        input.feed('\x1b');
        await menu;
    }
});
void test('bulk select-all selects rather than inverts and page selection stays on its page', async () => {
    menuDisplay(80, 8);
    const input = resetInputState();
    input.feed('a,|b.\n');
    const values = await showMultiSelectWindow({
        title: 'Take which maps?', omitHeadings: true, pageLocalKeys: true,
        sections: [{ items: Array.from({ length: 10 }, (_, value) => ({ text: `map ${value}`, value })) }],
    });
    assert.deepEqual(values, Array.from({ length: 10 }, (_, value) => value));
});
//# sourceMappingURL=menu_layout.test.js.map