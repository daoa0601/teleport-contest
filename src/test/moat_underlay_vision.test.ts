import test from 'node:test';
import assert from 'node:assert/strict';
import { DB_MOAT, DRAWBRIDGE_UP, MOAT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { visionCellBlocksLight } from '../js/vision.js';
import { freshObjectRoom } from './support/object-room.js';
import { createSpecialLevel } from './support/topology.js';

for (const bridge of [false, true]) {
    void test(`underwater light is blocked by ${bridge ? 'a moat below a raised bridge' : 'a moat'}`, () => {
        const level = freshObjectRoom();
        const square = level.requireAt(11, 10);
        square.typ = bridge ? DRAWBRIDGE_UP : MOAT;
        square.drawbridgemask = DB_MOAT;
        game.u.uinwater = 1;

        assert.equal(visionCellBlocksLight(level, 11, 10), true);
        requirePlayingGame(game);
        game.juiblex_level = createSpecialLevel({ ...game.u.uz });
        assert.equal(visionCellBlocksLight(level, 11, 10), false);
    });
}
