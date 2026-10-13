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
for (const color of [true, false]) {
    for (const dark_room of [true, false]) {
        void test(`grounded blind touch shows an unlit Rogue floor with dark_room=${dark_room} and color=${color}`, () => {
            const level = freshObjectRoom({ flags: { color, dark_room } });
            requirePlayingGame(game);
            game.rogue_level = { ...game.u.uz };
            game.symset = 'DECgraphics';
            const destination = level.requireAt(11, 10);
            destination.lit = false;
            destination.waslit = false;
            setHeroBlindnessTurns(10);
            feel_location(11, 10);
            assert.equal(destination.disp_ch, dark_room ? '.' : ' ');
            assert.equal(destination.remembered_glyph?.ch, dark_room ? '.' : ' ');
            assert.equal(destination.remembered_glyph?.decgfx, false);
        });
    }
}
void test('levitating blind touch clears an unseen monster marker on an unlit Rogue floor', () => {
    const level = freshObjectRoom({
        hero: { levitating: true }, flags: { color: true, dark_room: true },
    });
    requirePlayingGame(game);
    game.rogue_level = { ...game.u.uz };
    const destination = level.requireAt(11, 10);
    destination.lit = false;
    destination.waslit = false;
    destination.remembered_glyph = { ch: 'I', color: 8, kind: 'invisible' };
    setHeroBlindnessTurns(10);
    feel_location(11, 10);
    assert.equal(destination.disp_ch, ' ');
    assert.equal(destination.remembered_glyph?.ch, ' ');
});
//# sourceMappingURL=rogue_floor_touch.test.js.map