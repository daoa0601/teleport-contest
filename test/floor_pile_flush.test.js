import assert from 'node:assert/strict';
import test from 'node:test';
import { flush_screen, newsym } from '../js/display.js';
import { deleteEngraving, makeEngravingAt } from '../js/engrave.js';
import { lookHere } from '../js/invent.js';
import { resetInputState } from '../js/input.js';
import { APPLE, FOOD_RATION } from '../js/object_data.js';
import { autopickupAtHero } from '../js/pickup.js';
import { floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenCell } from './support/screen.js';
for (const arrival of [false, true]) {
    void test(`${arrival ? 'arriving at' : 'inspecting'} a floor pile ${arrival ? 'prints' : 'preserves'} pending map changes`, async () => {
        await freshObjectRoom({ flags: { pickup: false } });
        await floorObject(APPLE, 10, 10);
        await floorObject(FOOD_RATION, 10, 10);
        const engraving = makeEngravingAt(12, 10, 'old writing');
        assert.ok(engraving);
        await newsym(12, 10);
        await flush_screen(1);
        assert.equal(requireScreenCell(11, 11).ch, '`');
        deleteEngraving(engraving);
        await newsym(12, 10);
        const input = resetInputState();
        // C pickup.c:check_here(): "flush_screen(1);" precedes
        // "(void) look_here(ct, lhflags);". Explicit look_here() instead
        // opens with "display_nhwindow(WIN_MESSAGE, FALSE);" (invent.c).
        const looking = arrival ? autopickupAtHero() : lookHere();
        await input.waitUntilBlocked();
        const besidePile = requireScreenCell(11, 11).ch;
        input.feed(' ');
        await looking;
        assert.equal(besidePile, arrival ? '.' : '`', 'only arrival prints the queued floor glyph before the pile window');
        await flush_screen(1);
        assert.equal(requireScreenCell(11, 11).ch, '.', 'the next map flush prints the erased engraving');
    });
}
//# sourceMappingURL=floor_pile_flush.test.js.map