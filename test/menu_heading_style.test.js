import assert from 'node:assert/strict';
import test from 'node:test';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { ATR_BOLD, CLR_RED, NO_COLOR } from '../js/terminal.js';
import { C_ATR_BOLD } from '../js/color_attr.js';
import { showInventoryWindow, showMultiSelectWindow } from '../js/windows.js';
import { freshPlayableRoom } from './support/playable-room.js';
for (const kind of ['inventory', 'selection']) {
    for (const gameover of [false, true]) {
        void test(`${kind} class headings ${gameover ? 'suppress highlighting after game over' : 'use the configured attributes and color'}`, async () => {
            freshPlayableRoom();
            game.iflags.menu_headings = { attr: C_ATR_BOLD, color: CLR_RED };
            game.program_state.gameover = gameover;
            const input = resetInputState();
            const sections = [{ heading: 'Weapons', items: [{ key: 'a', text: 'a dagger', value: 'dagger' }] }];
            const operation = kind === 'inventory' ? showInventoryWindow(sections)
                : showMultiSelectWindow({ title: 'Take what?', sections });
            try {
                await input.waitUntilBlocked();
                const row = requireGameDisplay().grid.find(row => row.map(cell => cell.ch).join('').includes('Weapons'));
                assert.ok(row, 'the menu displays its Weapons heading');
                const heading = row.find(cell => cell.ch === 'W');
                assert.equal(heading?.attr, gameover ? 0 : ATR_BOLD, 'class heading attribute');
                assert.equal(heading?.color, gameover ? NO_COLOR : CLR_RED, 'class heading color');
            }
            finally {
                input.feed('\x1b');
                await operation;
            }
        });
    }
}
void test('a selection menu uses the configured prompt style above its class headings', async () => {
    freshPlayableRoom();
    game.iflags.menu_headings = { attr: C_ATR_BOLD, color: CLR_RED };
    const input = resetInputState();
    const operation = showMultiSelectWindow({ title: 'Take what?', sections: [
            { heading: 'Weapons', items: [{ key: 'a', text: 'a dagger', value: 'dagger' }] },
        ] });
    try {
        await input.waitUntilBlocked();
        const prompt = requireGameDisplay().grid[0]?.find(cell => cell.ch === 'T');
        assert.equal(prompt?.attr, ATR_BOLD, 'the prompt uses the configured attribute');
        assert.equal(prompt?.color, CLR_RED, 'the prompt uses the configured color');
        assert.match(requireGameDisplay().grid[2]?.map(cell => cell.ch).join('') ?? '', /Weapons/);
    }
    finally {
        input.feed('\x1b');
        await operation;
    }
});
//# sourceMappingURL=menu_heading_style.test.js.map