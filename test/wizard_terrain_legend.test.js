import test from 'node:test';
import assert from 'node:assert/strict';
import { requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { runExtendedCommand } from './support/commands.js';
import { freshPlayableRoom } from './support/playable-room.js';
void test('the wizard terrain legend fills the screen and puts its pager on the last row', async () => {
    freshPlayableRoom({ flags: { debug: true } });
    const display = requireGameDisplay();
    display.setCell(0, 22, '@', 0, 0);
    const input = resetInputState();
    const action = runExtendedCommand('terrain');
    try {
        await input.waitUntilBlocked();
        input.feed('f');
        await input.waitUntilBlocked();
        const row = (index) => display.grid[index]?.map(cell => cell.ch).join('').trimEnd();
        assert.equal(row(0), '#terrain encodings:');
        assert.equal(row(22), '', 'The legend clears the old map and status rows');
        assert.equal(row(display.rows - 1), '--More--');
    }
    finally {
        input.feed(' ');
        await action;
    }
});
//# sourceMappingURL=wizard_terrain_legend.test.js.map