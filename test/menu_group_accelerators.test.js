import assert from 'node:assert/strict';
import test from 'node:test';
import { GameDisplay } from '../js/game_display.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { Terminal } from '../js/terminal.js';
import { showMultiSelectWindow } from '../js/windows.js';
import { freshPlayableRoom } from './support/playable-room.js';
void test('a class accelerator toggles matching menu items across pages', async () => {
    freshPlayableRoom();
    game.nhDisplay = new GameDisplay(new Terminal(null, { rows: 6, cols: 80 }));
    pushKeys('[\n');
    const selected = await showMultiSelectWindow({
        title: 'Remove which equipment?', omitHeadings: true,
        sections: [{ items: [
                    { key: 'a', groupAccelerator: '[', text: 'a cloak', value: 'cloak' },
                    { text: 'Rings', selectable: false },
                    { key: 'b', groupAccelerator: '=', text: 'a ring', value: 'ring' },
                    { key: 'c', groupAccelerator: '[', text: 'a pair of boots', value: 'boots' },
                ] }],
    });
    assert.deepEqual(selected, ['cloak', 'boots']);
});
void test('a class accelerator inverts each item rather than selecting the whole group', async () => {
    freshPlayableRoom();
    pushKeys('a[\n');
    const selected = await showMultiSelectWindow({
        title: 'Remove which armor?', omitHeadings: true,
        sections: [{ items: [
                    { key: 'a', groupAccelerator: '[', text: 'a cloak', value: 'cloak' },
                    { key: 'b', groupAccelerator: '[', text: 'a pair of boots', value: 'boots' },
                ] }],
    });
    assert.deepEqual(selected, ['boots']);
});
void test('a numeric class accelerator selects a ball while a preceding count limits its quantity', async () => {
    for (const { keys, count } of [{ keys: '0\n', count: -1 }, { keys: '30a\n', count: 30 }]) {
        freshPlayableRoom();
        pushKeys(keys);
        const selected = await showMultiSelectWindow({
            title: 'Drop which items?', omitHeadings: true, returnCounts: true,
            sections: [{ items: [
                        { key: 'a', groupAccelerator: '0', text: 'iron balls', value: 'ball' },
                    ] }],
        });
        assert.deepEqual(selected, [{ value: 'ball', count }]);
    }
});
void test('a pick-one menu accepts a class accelerator only when it identifies one item', async () => {
    freshPlayableRoom();
    pushKeys('[=\x1b');
    const selected = await showMultiSelectWindow({
        title: 'Choose one item', omitHeadings: true, pickOne: true,
        sections: [{ items: [
                    { key: 'a', groupAccelerator: '[', text: 'a cloak', value: 'cloak' },
                    { key: 'b', groupAccelerator: '[', text: 'a pair of boots', value: 'boots' },
                    { key: 'c', groupAccelerator: '=', text: 'a ring', value: 'ring' },
                ] }],
    });
    assert.deepEqual(selected, ['ring']);
});
void test('bulk inversion flips each menu item independently', async () => {
    freshPlayableRoom();
    pushKeys('a@\n');
    const selected = await showMultiSelectWindow({
        title: 'Remove which armor?', omitHeadings: true,
        sections: [{ items: [
                    { key: 'a', text: 'a cloak', value: 'cloak' },
                    { key: 'b', text: 'a pair of boots', value: 'boots' },
                ] }],
    });
    assert.deepEqual(selected, ['boots']);
});
void test('select all includes menu items on later pages', async () => {
    freshPlayableRoom();
    game.nhDisplay = new GameDisplay(new Terminal(null, { rows: 5, cols: 80 }));
    pushKeys('.\n');
    const selected = await showMultiSelectWindow({
        title: 'Remove which armor?', omitHeadings: true,
        sections: [{ items: [
                    { key: 'a', text: 'a cloak', value: 'cloak' },
                    { key: 'b', text: 'a pair of boots', value: 'boots' },
                    { key: 'c', text: 'a helmet', value: 'helmet' },
                ] }],
    });
    assert.deepEqual(selected, ['cloak', 'boots', 'helmet']);
});
//# sourceMappingURL=menu_group_accelerators.test.js.map