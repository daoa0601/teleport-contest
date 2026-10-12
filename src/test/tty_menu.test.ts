import assert from 'node:assert/strict';
import test from 'node:test';
import { NHW_MENU, PICK_ONE, PICK_ANY, MENU_ITEMFLAGS_SELECTED, MENU_ITEMFLAGS_SKIPINVERT } from '../js/const.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { tty_create_nhwindow, tty_start_menu, tty_add_menu, tty_end_menu, tty_select_menu,
    tty_destroy_nhwindow } from '../js/tty_menu.js';
import { freshPlayableRoom } from './support/playable-room.js';

void test('a group accelerator toggles every matching item with the supplied count', async () => {
    freshPlayableRoom();
    const window = tty_create_nhwindow<string>(NHW_MENU);
    await tty_start_menu(window);
    tty_add_menu(window, { identifier: 'sword', text: 'a sword', selector: 'a', group: ')' });
    tty_add_menu(window, { identifier: 'daggers', text: 'daggers', selector: 'b', group: ')' });
    tty_add_menu(window, { identifier: 'robe', text: 'a robe', selector: 'c', group: '[' });
    tty_end_menu(window);
    resetInputState().feed('3)\n');
    const result = await tty_select_menu(window, PICK_ANY);
    assert.deepEqual(result.selections.map(item => [item.identifier, item.count]), [['sword', 3], ['daggers', 3]]);
    await tty_destroy_nhwindow(window);
});

void test('pick-one accepts a unique group and returns the preset alongside a new selection', async () => {
    freshPlayableRoom();
    const window = tty_create_nhwindow<string>(NHW_MENU);
    await tty_start_menu(window);
    tty_add_menu(window, { identifier: 'sword', text: 'a sword', selector: 'a', itemflags: MENU_ITEMFLAGS_SELECTED });
    tty_add_menu(window, { identifier: 'robe', text: 'a robe', selector: 'b', group: '[' });
    tty_end_menu(window);
    resetInputState().feed('[');
    const result = await tty_select_menu(window, PICK_ONE);
    assert.deepEqual(result.selections.map(item => item.identifier), ['sword', 'robe']);
    await tty_destroy_nhwindow(window);
});

void test('invalid keys keep a count and Escape first cancels only the pending count', async () => {
    freshPlayableRoom();
    const window = tty_create_nhwindow<string>(NHW_MENU);
    await tty_start_menu(window);
    tty_add_menu(window, { identifier: 'daggers', text: 'daggers', selector: 'a' });
    tty_end_menu(window);
    resetInputState().feed('2!a4\x1b\n');
    const result = await tty_select_menu(window, PICK_ANY);
    assert.equal(result.cancelled, false);
    assert.equal(result.selections[0]?.count, 2);
    await tty_destroy_nhwindow(window);
});

void test('selection updates use plus and a later page redraw uses asterisk', async () => {
    freshPlayableRoom();
    const window = tty_create_nhwindow<number>(NHW_MENU);
    await tty_start_menu(window);
    for (let index = 0; index < 24; index++) tty_add_menu(window, { identifier: index, text: `map ${index}` });
    tty_end_menu(window);
    const input = resetInputState();
    const selection = tty_select_menu(window, PICK_ANY);
    try {
        await input.waitUntilBlocked();
        input.feed('a');
        await input.waitUntilBlocked();
        assert.match(requireGameDisplay().grid[0]?.map(cell => cell.ch).join('') ?? '', /a \+ map 0/);
        input.feed('><');
        await input.waitUntilBlocked();
        assert.match(requireGameDisplay().grid[0]?.map(cell => cell.ch).join('') ?? '', /a \* map 0/);
    } finally {
        input.feed('\n');
        await selection;
        await tty_destroy_nhwindow(window);
    }
});

void test('bulk changes preserve counted selections and respect restricted entries', async () => {
    freshPlayableRoom();
    game.iflags.menuinvertmode = 1;
    const window = tty_create_nhwindow<string>(NHW_MENU);
    await tty_start_menu(window);
    tty_add_menu(window, { identifier: 'daggers', text: 'daggers', selector: 'a' });
    tty_add_menu(window, { identifier: 'special', text: 'a special map', selector: 'b', itemflags: MENU_ITEMFLAGS_SKIPINVERT });
    tty_end_menu(window);
    resetInputState().feed('2a.\n');
    const result = await tty_select_menu(window, PICK_ANY);
    assert.deepEqual(result.selections.map(item => [item.identifier, item.count]), [['daggers', 2]]);
    await tty_destroy_nhwindow(window);
});

void test('starting a new menu discards old rows and selections before reusing the window', async () => {
    freshPlayableRoom();
    const window = tty_create_nhwindow<string>(NHW_MENU);
    await tty_start_menu(window);
    tty_add_menu(window, { identifier: 'old', text: 'old map', selector: 'a' });
    tty_end_menu(window);
    resetInputState().feed('a');
    await tty_select_menu(window, PICK_ONE);
    await tty_start_menu(window);
    tty_add_menu(window, { identifier: 'new', text: 'new map', selector: 'b' });
    tty_end_menu(window);
    resetInputState().feed('ab');
    const result = await tty_select_menu(window, PICK_ONE);
    assert.equal(result.selections[0]?.identifier, 'new');
    await tty_destroy_nhwindow(window);
    assert.throws(() => tty_add_menu(window, { identifier: 'gone', text: 'gone map' }), /destroyed/);
});
