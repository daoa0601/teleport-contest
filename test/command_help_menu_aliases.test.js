import assert from 'node:assert/strict';
import test from 'node:test';
import { showKeyBindings } from '../js/command_help.js';
import { GameDisplay } from '../js/game_display.js';
import { game } from '../js/gstate.js';
import { applyNethackrc } from '../js/options.js';
import { HeadlessTerminal } from '../js/terminal.js';
import { freshTurnRoom } from './support/playable-room.js';
void test('the key bindings list displays configured menu controls', async () => {
    const input = freshTurnRoom();
    game.nhDisplay = new GameDisplay(new HeadlessTerminal({ rows: 50 }));
    applyNethackrc('BIND=~:menu_next_page,^A:menu_search');
    const action = showKeyBindings();
    try {
        await input.waitUntilBlocked();
        const rows = game.nhDisplay.grid.map(row => row.map(cell => cell.ch).join(''));
        assert.match(rows.find(row => row.includes('Go to next page')) ?? '', /^~ +Go to next page/);
        assert.match(rows.find(row => row.includes('Search and invert matching items')) ?? '', /^\^A +Search and invert matching items/);
    }
    finally {
        input.feed('\x1b');
        await action;
    }
});
//# sourceMappingURL=command_help_menu_aliases.test.js.map