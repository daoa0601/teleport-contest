import assert from 'node:assert/strict';
import test from 'node:test';
import { NHW_MENU, PICK_ONE, PICK_ANY, MENU_ITEMFLAGS_SELECTED, MENU_ITEMFLAGS_SKIPINVERT } from '../js/const.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { tty_create_nhwindow, tty_start_menu, tty_add_menu, tty_end_menu, tty_select_menu, tty_display_nhwindow, tty_clear_nhwindow, tty_dismiss_nhwindow, tty_destroy_nhwindow } from '../js/tty_menu.js';
import { docrt, flush_screen } from '../js/display.js';
import { freshPlayableRoom } from './support/playable-room.js';
void test('clearing an active full-screen menu leaves a blank screen until dismissal', async () => {
    freshPlayableRoom({ flags: { menu_overlay: false }, hero: { hallucinationTurns: 100 } });
    await docrt();
    await flush_screen(1);
    const d = requireGameDisplay();
    assert.equal(d.getChar(9, 11), '.');
    const window = tty_create_nhwindow(NHW_MENU);
    await tty_start_menu(window);
    tty_add_menu(window, { identifier: 'dagger', text: 'a dagger' });
    tty_end_menu(window);
    resetInputState().feed('\n');
    await tty_display_nhwindow(window, PICK_ANY);
    await tty_clear_nhwindow(window);
    assert.equal(d.getChar(9, 11), ' ', 'clearing a menu must not redraw the map');
    assert.equal(d.grid[23]?.map(cell => cell.ch).join('').trim(), '', 'the status stays erased too');
    await tty_destroy_nhwindow(window);
    assert.equal(d.getChar(9, 11), '.', 'destroying the still-active window restores the map');
});
void test('redisplaying an active corner menu restores the map after dismissal', async () => {
    freshPlayableRoom({ left: 40, right: 60, heroX: 50 });
    await docrt();
    await flush_screen(1);
    const d = requireGameDisplay();
    assert.equal(d.getChar(49, 11), '.');
    const window = tty_create_nhwindow(NHW_MENU);
    await tty_start_menu(window);
    for (let index = 0; index < 12; index++)
        tty_add_menu(window, { identifier: index, text: `map ${index}` });
    tty_end_menu(window);
    const input = resetInputState();
    input.feed('\n');
    await tty_display_nhwindow(window, PICK_ANY);
    input.feed('\n');
    await tty_display_nhwindow(window, PICK_ANY);
    await tty_dismiss_nhwindow(window);
    assert.equal(d.getChar(49, 11), '.', 'the menu must not become its own underlay');
    assert.doesNotMatch(d.grid[2]?.map(cell => cell.ch).join('') ?? '', /map 2/);
    await tty_destroy_nhwindow(window);
});
for (const overlay of [true, false]) {
    for (const { name, keys, selected } of [
        { name: 'no match', keys: 'nomatch\n', selected: false },
        { name: 'a match', keys: 'dagger\n', selected: true },
        { name: 'empty input', keys: '\n', selected: false },
        { name: 'cancellation', keys: '\x1b', selected: false },
        { name: 'wrapped input', keys: 'x'.repeat(72) + '\n', selected: false },
    ]) {
        void test(`${overlay ? 'corner' : 'full-screen'} menu remains visible after search with ${name}`, async () => {
            freshPlayableRoom({ flags: { menu_overlay: overlay } });
            const window = tty_create_nhwindow(NHW_MENU);
            await tty_start_menu(window);
            tty_add_menu(window, { identifier: 'dagger', selector: 'a', text: 'a dagger' });
            tty_end_menu(window, 'Choose a weapon');
            const input = resetInputState();
            const selection = tty_select_menu(window, PICK_ANY);
            try {
                await input.waitUntilBlocked();
                input.feed(':' + keys);
                await input.waitUntilBlocked();
                const d = requireGameDisplay();
                const entry = d.grid[2]?.map(cell => cell.ch).join('') ?? '';
                assert.match(entry, selected ? /a \+ a dagger/ : /a - a dagger/);
                assert.match(d.grid[3]?.map(cell => cell.ch).join('') ?? '', /\(end\)/);
                assert.equal(d.cursorRow, 3, 'search returns input to the menu pager');
            }
            finally {
                input.feed('\n');
                await selection;
                await tty_destroy_nhwindow(window);
            }
        });
    }
}
void test('menu search selects visible descriptions but ignores clipped suffixes', async () => {
    freshPlayableRoom();
    const window = tty_create_nhwindow(NHW_MENU);
    await tty_start_menu(window);
    const description = 'a club named ';
    const filler = 'x'.repeat(requireGameDisplay().cols - 2 - 4 - description.length);
    tty_add_menu(window, { identifier: 'club', selector: 'a', text: description + filler + 'HiddenName' });
    tty_add_menu(window, { identifier: 'dagger', selector: 'b', text: 'a dagger named VisibleName' });
    tty_end_menu(window);
    resetInputState().feed(':HiddenName\n:visible*\n\n');
    const result = await tty_select_menu(window, PICK_ANY);
    assert.deepEqual(result.selections.map(item => item.identifier), ['dagger'], 'search should match only text retained in the menu');
    await tty_destroy_nhwindow(window);
});
void test('a group accelerator toggles every matching item with the supplied count', async () => {
    freshPlayableRoom();
    const window = tty_create_nhwindow(NHW_MENU);
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
    const window = tty_create_nhwindow(NHW_MENU);
    await tty_start_menu(window);
    tty_add_menu(window, { identifier: 'sword', text: 'a sword', selector: 'a', itemflags: MENU_ITEMFLAGS_SELECTED });
    tty_add_menu(window, { identifier: 'robe', text: 'a robe', selector: 'b', group: '[' });
    tty_end_menu(window);
    resetInputState().feed('[');
    const result = await tty_select_menu(window, PICK_ONE);
    assert.deepEqual(result.selections.map(item => item.identifier), ['sword', 'robe']);
    await tty_destroy_nhwindow(window);
});
for (const pickOne of [true, false]) {
    void test(pickOne ? 'pick-one treats the ball group shortcut as a choice after a count'
        : 'pick-any keeps the ball group digit inside an active count', async () => {
        freshPlayableRoom();
        const window = tty_create_nhwindow(NHW_MENU);
        await tty_start_menu(window);
        tty_add_menu(window, { identifier: 'balls', text: 'iron balls', selector: 'a', group: '0' });
        tty_end_menu(window);
        resetInputState().feed(pickOne ? '20\n' : '20a\n');
        const result = await tty_select_menu(window, pickOne ? PICK_ONE : PICK_ANY);
        assert.deepEqual(result.selections.map(item => [item.identifier, item.count]), [['balls', pickOne ? 2 : 20]]);
        await tty_destroy_nhwindow(window);
    });
}
void test('invalid keys keep a count and Escape first cancels only the pending count', async () => {
    freshPlayableRoom();
    const window = tty_create_nhwindow(NHW_MENU);
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
    const window = tty_create_nhwindow(NHW_MENU);
    await tty_start_menu(window);
    for (let index = 0; index < 24; index++)
        tty_add_menu(window, { identifier: index, text: `map ${index}` });
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
    }
    finally {
        input.feed('\n');
        await selection;
        await tty_destroy_nhwindow(window);
    }
});
void test('bulk changes preserve counted selections and respect restricted entries', async () => {
    freshPlayableRoom();
    game.iflags.menuinvertmode = 1;
    const window = tty_create_nhwindow(NHW_MENU);
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
    const window = tty_create_nhwindow(NHW_MENU);
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
//# sourceMappingURL=tty_menu.test.js.map