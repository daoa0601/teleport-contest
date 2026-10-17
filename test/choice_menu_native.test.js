import assert from 'node:assert/strict';
import test from 'node:test';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { showChoiceWindow, showDisclosureOverlay } from '../js/windows.js';
import { freshPlayableRoom } from './support/playable-room.js';
void test('Escape cancels a choice-menu count before it can cancel the choice', async () => {
    freshPlayableRoom();
    const input = resetInputState();
    input.feed('2\x1ba');
    const result = await showChoiceWindow({ title: 'Choose a route', entries: [{ key: 'a', text: 'north' }] });
    assert.equal(result, 'a'.charCodeAt(0));
});
void test('a choice menu ignores keys that are neither selectors nor menu controls', async () => {
    freshPlayableRoom();
    resetInputState().feed('?ra');
    const result = await showChoiceWindow({ title: 'Choose a route', entries: [{ key: 'a', text: 'north' }] });
    assert.equal(result, 'a'.charCodeAt(0));
});
void test('a choice menu searches descriptions through the native menu owner', async () => {
    freshPlayableRoom();
    resetInputState().feed(':portal\nb');
    const result = await showChoiceWindow({ title: 'Choose a route', entries: [
            { key: 'a', text: 'the portal' }, { key: 'b', text: 'the stairs' },
        ] });
    assert.equal(result, 'a'.charCodeAt(0));
});
void test('a menu-style disclosure honors rebound paging keys', async () => {
    freshPlayableRoom();
    assert.equal(game.commandBindings.bindMenuKey(';'.charCodeAt(0), 'menu_next_page'), true);
    const input = resetInputState();
    const disclosure = showDisclosureOverlay(Array.from({ length: 28 }, (_, index) => `Level ${index + 1}`), {
        pagerStyle: 'menu',
    });
    try {
        await input.waitUntilBlocked();
        input.feed(';');
        await input.waitUntilBlocked();
        assert.match(requireGameDisplay().grid[0]?.map(cell => cell.ch).join('') ?? '', /Level 24/);
    }
    finally {
        input.feed('\x1b');
        await disclosure;
    }
});
//# sourceMappingURL=choice_menu_native.test.js.map