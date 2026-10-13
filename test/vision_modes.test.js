import assert from 'node:assert/strict';
import test from 'node:test';
import { CORR, DB_FLOOR, DRAWBRIDGE_UP, POOL, ROOM, TT_PIT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { vision_recalc, cansee, couldsee } from '../js/vision.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a hero in a pit sees only adjoining squares', () => {
    const level = freshObjectRoom({ left: 6, right: 18, top: 6, bottom: 14 });
    requirePlayingGame(game);
    game.u.utrap = 4;
    game.u.utraptype = TT_PIT;
    vision_recalc(0);
    assert.equal(cansee(11, 10), true);
    assert.equal(couldsee(12, 10), false);
    assert.equal(cansee(12, 10), false);
    assert.equal(level.requireAt(12, 10).typ, ROOM);
});
void test('night vision reveals unlit floor within its range', () => {
    const level = freshObjectRoom({ left: 6, right: 18, recalculateVision: false });
    requirePlayingGame(game);
    for (let x = 6; x <= 18; x++)
        for (let y = 6; y <= 14; y++)
            level.requireAt(x, y).lit = false;
    game.u.nv_range = 3;
    vision_recalc(0);
    assert.equal(cansee(13, 10), true);
    assert.equal(cansee(14, 10), false);
});
void test('x-ray vision reveals a floor beyond solid rock', () => {
    const level = freshObjectRoom({ right: 10, recalculateVision: false });
    requirePlayingGame(game);
    level.requireAt(12, 10).typ = CORR;
    game.u.xray_range = 3;
    vision_recalc(0);
    assert.equal(couldsee(12, 10), false);
    assert.equal(cansee(12, 10), true);
    assert.equal(level.requireAt(12, 10).disp_ch, '#');
});
void test('underwater sight checks the surface below an adjacent raised drawbridge', () => {
    const level = freshObjectRoom({ recalculateVision: false });
    requirePlayingGame(game);
    level.requireAt(10, 10).typ = POOL;
    level.requireAt(10, 9).typ = POOL;
    const bridge = level.requireAt(11, 10);
    bridge.typ = DRAWBRIDGE_UP;
    bridge.drawbridgemask = DB_FLOOR;
    game.u.uinwater = 1;
    vision_recalc(0);
    assert.equal(cansee(10, 9), true);
    assert.equal(cansee(11, 10), false);
});
//# sourceMappingURL=vision_modes.test.js.map