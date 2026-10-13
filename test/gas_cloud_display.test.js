import assert from 'node:assert/strict';
import test from 'node:test';
import { flush_screen } from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { createPoisonGasCloud, runLevelRegions } from '../js/regions.js';
import { pushKeys } from '../js/input.js';
import { CLR_BRIGHT_GREEN } from '../js/terminal.js';
import { cansee } from '../js/vision.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a newly created gas cloud redraws its visible floor before any later vision refresh', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    await flush_screen(1);
    await createPoisonGasCloud(game, 11, 10, 1, 8);
    await flush_screen(1);
    const cell = requireGameDisplay().grid[11]?.[10];
    assert.ok(cell);
    assert.equal(cell.ch, '#');
    assert.equal(cell.color, CLR_BRIGHT_GREEN);
    assert.equal(level.requireAt(11, 10).remembered_glyph?.kind, 'terrain');
});
void test('poison gas blindness updates sight before the next coughing message', async () => {
    freshObjectRoom({ hero: { poisonResistance: true } });
    pushKeys(' '.repeat(20));
    await createPoisonGasCloud(game, game.u.ux, game.u.uy, 1, 8);
    assert.equal(cansee(11, 10), true);
    await runLevelRegions(game);
    await flush_screen(1);
    assert.equal(game.u.blindTurns, 1);
    assert.equal(cansee(11, 10), false);
    assert.equal(requireGameDisplay().grid[game.u.uy + 1]?.[game.u.ux - 1]?.ch, '@');
});
//# sourceMappingURL=gas_cloud_display.test.js.map