import assert from 'node:assert/strict';
import test from 'node:test';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { showTerrainCodes } from '../js/wizcmds.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';
// C wizcmds.c:wiz_map_levltyp() prints the fountain and sink counts with
// defsyms[S_fountain].sym and defsyms[S_sink].sym; the pinned defsym.h gives
// both the '{' character, so a level with one fountain and two sinks reads
// "D:0,L:8 {:1 {:2" on the closing line of the typ-code dump.
void test('the terrain typ-code summary counts sinks with the sink symbol', async () => {
    await freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    const flags = game.level && 'nfountains' in game.level.flags ? game.level.flags : null;
    if (!flags)
        throw new Error('Terrain summary test requires level flags');
    flags.nfountains = 1;
    flags.nsinks = 2;
    const input = resetInputState();
    const window = showTerrainCodes();
    try {
        await input.waitUntilBlocked();
        const rows = Array.from({ length: 24 }, (_, index) => requireScreenRow(index).map(cell => cell.ch).join('').trimEnd());
        const summary = rows.find(row => row.startsWith('D:0,L:8'));
        assert.equal(summary, 'D:0,L:8 {:1 {:2 dungeon');
    }
    finally {
        input.feed(' ');
        await window;
    }
});
//# sourceMappingURL=terrain_code_summary.test.js.map