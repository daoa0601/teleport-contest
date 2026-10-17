import assert from 'node:assert/strict';
import test from 'node:test';
import { NHW_MENU, PICK_ANY } from '../js/const.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { GameDisplay } from '../js/game_display.js';
import { CLR_RED, NO_COLOR, Terminal } from '../js/terminal.js';
import { tty_create_nhwindow, tty_start_menu, tty_add_menu, tty_end_menu,
    tty_select_menu, tty_destroy_nhwindow } from '../js/tty_menu.js';
import { freshPlayableRoom } from './support/playable-room.js';

void test('changing a menu selection paints its marker in the item color', async () => {
    freshPlayableRoom();
    const window = tty_create_nhwindow<string>(NHW_MENU);
    await tty_start_menu(window);
    tty_add_menu(window, { identifier: 'ruby', selector: 'a', text: 'a ruby', color: CLR_RED });
    tty_end_menu(window);
    const input = resetInputState();
    const selected = tty_select_menu(window, PICK_ANY);
    try {
        await input.waitUntilBlocked();
        input.feed('a');
        await input.waitUntilBlocked();
        const row = requireGameDisplay().grid[0];
        const marker = row?.find(cell => cell.ch === '+');
        assert.equal(marker?.color, CLR_RED, 'the changed marker uses the menu item color');
    } finally {
        input.feed('\n');
        await selected;
        await tty_destroy_nhwindow(window);
    }
});

void test('gold is not a group shortcut when every group equals its own selector', async () => {
    freshPlayableRoom();
    const window = tty_create_nhwindow<string>(NHW_MENU);
    await tty_start_menu(window);
    for (let index = 0; index < 23; index++) tty_add_menu(window, { identifier: null, text: 'Weapons' });
    tty_add_menu(window, { identifier: 'gold', selector: '$', group: '$', text: 'gold pieces' });
    tty_end_menu(window);
    resetInputState().feed('$\n');

    const result = await tty_select_menu(window, PICK_ANY);

    assert.equal(result.selections.length, 0, 'off-page gold needs an enabled group shortcut');
    await tty_destroy_nhwindow(window);
});

void test('jumping straight to the last corner page leaves the erased lower rows blank', async () => {
    freshPlayableRoom();
    game.nhDisplay = new GameDisplay(new Terminal(null, { cols: 80, rows: 60 }));
    game.nhDisplay.setCell(70, 20, '.', NO_COLOR);
    const window = tty_create_nhwindow<number>(NHW_MENU);
    await tty_start_menu(window);
    for (let index = 0; index < 53; index++) tty_add_menu(window, { identifier: index, text: `map ${index}` });
    tty_end_menu(window);
    const input = resetInputState();
    const selected = tty_select_menu(window, PICK_ANY);
    try {
        await input.waitUntilBlocked();
        input.feed('|');
        await input.waitUntilBlocked();
        assert.equal(requireGameDisplay().grid[20]?.[70]?.ch, ' ', 'only next-page movement enables docorner repair');
    } finally {
        input.feed('\n');
        await selected;
        await tty_destroy_nhwindow(window);
    }
});

