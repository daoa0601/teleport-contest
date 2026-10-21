import test from 'node:test';
import assert from 'node:assert/strict';
import { moveloop_core } from '../js/allmain.js';
import { flush_screen } from '../js/display.js';
import { placeObject } from '../js/floor_object.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { mksobj } from '../js/mklev.js';
import { POT_WATER } from '../js/object_data.js';
import { freshTurnRoom } from './support/playable-room.js';
function cellAt(x, y) {
    return requireGameDisplay().grid[y + 1]?.[x - 1]?.ch ?? '';
}
void test('a close look does not draw an object the hero does not remember', async () => {
    const input = freshTurnRoom({ right: 16 });
    requirePlayingGame(game);
    await flush_screen(1);
    const x = game.u.ux + 3, y = game.u.uy;
    const floor = cellAt(x, y);
    // Like a pet's drop under its own glyph, the floor memory is not updated.
    const potion = await mksobj(POT_WATER, true, false);
    await placeObject(potion, x, y);
    input.feed('l');
    await moveloop_core();
    await flush_screen(1);
    assert.equal(game.u.ux, x - 2, 'the hero steps within close-look range');
    assert.equal(potion.dknown, true, 'the nearby potion is still seen up close');
    assert.equal(cellAt(x, y), floor, 'see_nearby_objects() repaints only remembered generic objects');
});
//# sourceMappingURL=nearby_object_memory.test.js.map