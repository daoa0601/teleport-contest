import test from 'node:test';
import assert from 'node:assert/strict';
import { COLNO, ROWNO } from '../js/const.js';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { initRng } from '../js/rng.js';
import { vision_recalc } from '../js/vision.js';
import { freshObjectRoom } from './support/object-room.js';
// C hack.c:1481-1489: when the guessed-goal search offers nothing better
// than the hero's own square, findtravelpath(TRAVP_GUESS) writes
// sgn(target - hero) into u.dx/u.dy before its TEST_MOVE probe, so a
// passing probe leaves the general-direction step installed for domove().
void test('a guessed travel fallback steps in the general direction of an unknown target', async () => {
    const level = await freshObjectRoom({ flags: { tips: false } });
    // The target sits beyond the room walls, so the backward TRAVP_TRAVEL
    // search cannot reach the hero.  A blind hero whose remembered map is
    // blank knows no squares (travelCellKnown() is seenv, or couldsee while
    // sighted), so the TRAVP_GUESS matrix stays empty, the pick is the
    // hero's own square, and only the sgn() fallback remains.
    game.u.blindTurns = 100;
    await vision_recalc(0);
    for (let x = 1; x < COLNO; x++)
        for (let y = 0; y < ROWNO; y++)
            level.requireAt(x, y).seenv = 0;
    game._travelTarget = { x: 4, y: 10 };
    initRng(1n);
    await rhack(31);
    assert.deepEqual([game.u.ux, game.u.uy], [9, 10], 'the fallback step moves one square toward the target');
    assert.equal(game.u.dx, -1);
    assert.equal(game.u.dy, 0);
    assert.equal(game.context.run, 8, 'the travel run continues after the step');
});
//# sourceMappingURL=travel_general_direction.test.js.map