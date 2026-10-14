import assert from 'node:assert/strict';
import test from 'node:test';
import { MOAT } from '../js/const.js';
import { bot, flush_screen, map_location } from '../js/display.js';
import { game } from '../js/gstate.js';
import { heroLiquidEffects } from '../js/hack.js';
import { pushKeys } from '../js/input.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';
void test('swimming below the surface refreshes optional terrain status to Submerged', async () => {
    const level = freshObjectRoom({ flags: { terrainstatus: true }, hero: { uhs: 1 } });
    grantIntrinsicProperty('swimming', 'outside');
    level.requireAt(10, 10).typ = MOAT;
    map_location(10, 10, true);
    await bot();
    pushKeys(' '.repeat(10));
    await heroLiquidEffects();
    await flush_screen(1);
    assert.equal(game.u.uinwater, 1);
    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /Submerged/);
});
//# sourceMappingURL=status_terrain_water.test.js.map