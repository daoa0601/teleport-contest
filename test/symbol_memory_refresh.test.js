import assert from 'node:assert/strict';
import test from 'node:test';
import { POOL } from '../js/const.js';
import { cmapToGlyph, CmapSymbol } from '../js/glyph_numbers.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { docrt, flush_screen } from '../js/display.js';
import { applyNethackrc } from '../js/options.js';
import { restoreGame, saveGame } from '../js/save.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { freshObjectRoom } from './support/object-room.js';
import { memoryStorage } from './support/memory-storage.js';
import { requireScreenCell } from './support/screen.js';
import { installPagerInput } from './support/pager-input.js';
import { gotoLevel } from '../js/level_change.js';
import { NO_COLOR } from '../js/terminal.js';
// goto_level() repaints the destination from its glyph numbers against the
// live symbol tables, so a cached level re-skins under whatever symbols
// changed while the hero was on another level.
void test('a cached level redraws its memory when symbols changed elsewhere', async () => {
    freshConnectedLevels();
    requirePlayingGame(game);
    installPagerInput(resetInputState(), {
        expected: /You descend the stairs|You climb up the stairs/,
        limit: 2,
    });
    await gotoLevel({ dlevel: 2 });
    // A remembered pool outside every room stays out of sight on arrival.
    const pool = game.level?.requireAt(3, 2);
    assert.ok(pool, 'the destination exposes the test cell');
    pool.typ = POOL;
    pool.remembered_glyph = { ch: '}', color: NO_COLOR,
        decgfx: false, kind: 'terrain', terrainName: 'water',
        glyph: cmapToGlyph(CmapSymbol.pool) };
    await gotoLevel({ dlevel: 1 });
    applyNethackrc('OPTIONS=symset:DECgraphics');
    await gotoLevel({ dlevel: 2 });
    assert.equal(requireScreenCell(2, 3).ch, '◆');
});
// A restored game rebuilds its map from saved glyph memory; the dark-room
// character depends on the color and dark_room options, which the saved
// memory already encodes.
void test('restoring preserves the blank dark-room character without color', async () => {
    freshObjectRoom({ flags: { color: false } });
    requirePlayingGame(game);
    game.plname = 'Dark';
    const location = game.level?.at(3, 2);
    assert.ok(location, 'the map exposes the test cell');
    location.remembered_glyph = { ch: ' ', color: NO_COLOR, decgfx: false,
        kind: 'terrain', terrainName: 'dark part of a room',
        glyph: cmapToGlyph(CmapSymbol.darkroom) };
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame('Dark', storage), true);
    // dorecover() finishes with a full repaint of the restored memory.
    await docrt();
    await flush_screen(1);
    assert.equal(requireScreenCell(2, 3).ch, ' ');
});
//# sourceMappingURL=symbol_memory_refresh.test.js.map