import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { glyphAt, newsym } from '../js/display.js';
import { game } from '../js/gstate.js';
import { GOLD_PIECE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { startRun } from '../js/runmode.js';
import { floorObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('stopping a run leaves hallucinated floor appearances until the next input refresh', async () => {
    await freshObjectRoom({ hero: { hallucinationTurns: 20, invisible: true } });
    game._moveloopStarted = true;
    await floorObject(GOLD_PIECE, game.u.ux, game.u.uy);
    await createMonsterAt('kitten', 11, 10, MM_NOGRP | NO_MINVENT);
    initRng(17n);
    await newsym(game.u.ux, game.u.uy);
    const before = glyphAt(game.u.ux, game.u.uy);
    assert.ok(before?.kind === 'object');
    startRun(1, 0);
    // Moving light sources can leave sight pending while a run skips see_*.
    game.vision_full_recalc = 1;
    const turn = game.moves;
    await moveloop_core();
    assert.equal(game.context.run, 0);
    assert.equal(game.u.ux, 10);
    assert.equal(game.moves, turn);
    assert.equal(glyphAt(game.u.ux, game.u.uy)?.glyph, before.glyph, 'lookaround stopping the run must not redraw the floor beneath the hero');
});
//# sourceMappingURL=run_stop_display.test.js.map