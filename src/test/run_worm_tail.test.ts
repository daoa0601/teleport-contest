import assert from 'node:assert/strict';
import test from 'node:test';
import { continueRun, rhack } from '../js/cmd.js';
import { MM_ANGRY, MM_NOTAIL, NO_MINVENT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { vision_recalc } from '../js/vision.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const dark of [false, true]) {
    void test(`a run stops beside a hostile worm tail ${dark ? 'in darkness' : 'with the head farther away'}`, async () => {
        const level = freshObjectRoom({ flags: { mention_walls: true }, hero: { nv_range: 0 } });
        const worm = await createMonsterAt('long worm', 14, 12, MM_ANGRY | MM_NOTAIL | NO_MINVENT);
        worm.wormSegments = [{ x: 13, y: 12 }, { x: 12, y: 11 }];
        if (dark) {
            for (const point of [{ x: worm.mx, y: worm.my }, ...worm.wormSegments]) {
                const square = level.requireAt(point.x, point.y);
                square.lit = false;
                square.waslit = false;
            }
        }
        vision_recalc(0);
        resetInputState().feed('l');
        await rhack('G'.charCodeAt(0));
        assert.equal(game.u.ux, 11);

        const moved = await continueRun();

        assert.equal(moved, false);
        assert.equal(game.u.ux, 11);
        assert.equal(game.context.move, 0);
        assert.equal(game._pending_message, dark ? 'It blocks your path.' : 'A long worm blocks your path.');
    });
}
