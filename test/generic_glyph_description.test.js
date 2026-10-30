// C display.h:obj_to_glyph()/pager.c:look_at_object(): a not-yet-described
// spellbook is drawn with its generic class glyph, and describing that glyph
// builds a temporary generic object whose dknown stays clear, so a farlook
// inside a shop gives the vague name without a "for sale" price.
import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requirePlayingGame } from '../js/gstate.js';
import { newsym, flush_screen } from '../js/display.js';
import { SPE_MAGIC_MAPPING } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
import { farlookText } from './support/farlook.js';
void test('a generic spellbook glyph farlooks without a shop price', async () => {
    await freshObjectRoom({ flags: { tips: false, help: false } });
    requirePlayingGame(game);
    const { roomno } = await createStaffedShop({
        left: 9, right: 17, top: 6, bottom: 14, keeperX: 17, keeperY: 10,
    });
    game.u.ushops = [roomno];
    const book = await floorObject(SPE_MAGIC_MAPPING, 15, 6, { dknown: false });
    assert.equal(book.dknown, false);
    await newsym(15, 6);
    await flush_screen(1);
    const text = await farlookText('lllllkkkk.');
    assert.match(text, /a spellbook/);
    assert.doesNotMatch(text, /for sale/);
});
//# sourceMappingURL=generic_glyph_description.test.js.map