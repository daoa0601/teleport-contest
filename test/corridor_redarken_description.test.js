import assert from 'node:assert/strict';
import test from 'node:test';
import { CORR } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { selectMapPosition } from '../js/getpos.js';
import { resetInputState } from '../js/input.js';
import { vision_recalc } from '../js/vision.js';
import { newsym } from '../js/display.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';
// C vision.c:796-805 clears waslit when the hero could see a remembered-lit
// corridor that is no longer lit, and display.c:1087-1089 rewrites the stored
// glyph to S_corr. pager.c:lookat() names the square from that glyph number
// (defsyms[S_corr].explanation), so the autodescribed corridor is "corridor",
// never the stale "lit corridor" name of the previous glyph.
void test('a re-darkened corridor is described as a plain corridor', async () => {
    const level = await freshObjectRoom({ flags: { tips: false, verbose: false } });
    requirePlayingGame(game);
    const corridor = level.requireAt(12, 10);
    corridor.typ = CORR;
    corridor.lit = true;
    await newsym(12, 10);
    await vision_recalc(0);
    assert.equal(game.level?.requireAt(12, 10).waslit, true, 'The lit corridor was remembered as lit while seen');
    corridor.lit = false;
    await vision_recalc(0);
    const input = resetInputState();
    input.feed('ll');
    const selection = selectMapPosition({
        start: { x: game.u.ux, y: game.u.uy }, prompt: 'Pick a spot.', goal: 'a spot',
    });
    try {
        await input.waitUntilBlocked();
        await input.waitUntilBlocked();
    }
    finally {
        input.feed('.');
        await selection;
    }
    const topline = requireScreenRow(0).map(cell => cell.ch).join('').trim();
    assert.equal(topline, 'corridor');
});
//# sourceMappingURL=corridor_redarken_description.test.js.map