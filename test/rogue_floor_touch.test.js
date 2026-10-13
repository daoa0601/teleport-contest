import assert from 'node:assert/strict';
import test from 'node:test';
import { feel_location } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { freshObjectRoom } from './support/object-room.js';
void test('levitating blind touch remembers a lit Rogue floor with its Rogue symbol', () => {
    const level = freshObjectRoom({ hero: { levitating: true } });
    requirePlayingGame(game);
    game.rogue_level = { ...game.u.uz };
    game.symset = 'DECgraphics';
    const destination = level.requireAt(11, 10);
    destination.remembered_glyph = { ch: 'I', color: 8, kind: 'invisible' };
    setHeroBlindnessTurns(10);
    feel_location(11, 10);
    assert.equal(destination.disp_ch, '.');
    assert.equal(destination.remembered_glyph?.ch, '.');
    assert.equal(destination.remembered_glyph?.decgfx, false);
});
//# sourceMappingURL=rogue_floor_touch.test.js.map