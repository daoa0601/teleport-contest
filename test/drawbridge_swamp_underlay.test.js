import test from 'node:test';
import assert from 'node:assert/strict';
import { DB_MOAT, DB_NORTH, DOOR, DRAWBRIDGE_DOWN } from '../js/const.js';
import { closeDrawbridge } from '../js/dbridge.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { createSpecialLevel } from './support/topology.js';
import { freshObjectRoom } from './support/object-room.js';
void test("a successful jump off Juiblex's rising bridge lands safely on its exposed swamp bed", async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    game.juiblex_level = createSpecialLevel({ ...game.u.uz });
    const square = level.requireAt(10, 10);
    square.typ = DRAWBRIDGE_DOWN;
    square.drawbridgemask = DB_NORTH | DB_MOAT;
    level.requireAt(10, 9).typ = DOOR;
    initRng(2n);
    pushKeys(' '.repeat(100));
    await closeDrawbridge(10, 10);
    assert.equal(game.u.ux, 10);
    assert.equal(game.u.uy, 10);
    assert.ok(!game.u.uinwater);
    assert.ok(!game.program_state.gameover);
});
//# sourceMappingURL=drawbridge_swamp_underlay.test.js.map