import test from 'node:test';
import assert from 'node:assert/strict';
import { flush_screen, pline } from '../js/display.js';
import { showFloorPile } from '../js/floor_object_display.js';
import { game } from '../js/gstate.js';
import { nhgetch, resetInputState } from '../js/input.js';
import { waitForCurrentMonsterMore } from '../js/monster_attack_death.js';
import { APPLE, FOOD_RATION } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';
const toplText = () => requireScreenRow(0).map(cell => cell.ch).join('').trimEnd();
// C wintty.c: a corner window's docorner() clips the physical top row, but
// the next message write goes through update_topl()/redotoplin(), which
// repaints the whole row. The monster-death fallback line that losehp()
// installs while paging earlier prose is such a write, and it must display
// in full rather than cut at the dismissed window's old left edge.
void test('a message written after a dismissed pile corner shows in full', async () => {
    await freshObjectRoom();
    const apple = await floorObject(APPLE, 10, 10, {
        oname: 'a very long name that pushes the window edge left',
    });
    const ration = await floorObject(FOOD_RATION, 10, 10);
    const input = resetInputState();
    const message = 'The kitten drops a rock beside the quarterstaff.';
    await pline(message);
    await flush_screen(1);
    input.feed('x');
    await nhgetch();
    const listing = showFloorPile([apple, ration]);
    await input.waitUntilBlocked();
    const duringDisplay = toplText();
    const titleColumn = duringDisplay.indexOf('Things that are here:');
    input.feed(' ');
    await listing;
    await flush_screen(1);
    // The seen line survives on screen only to the window's left edge.
    const row = requireScreenRow(0).map(cell => cell.ch).join('');
    const edge = titleColumn - 2;
    assert.ok(titleColumn > 0 && edge < message.length, 'the corner window must clip inside the acknowledged message');
    assert.equal(row.slice(0, edge), message.slice(0, edge), 'the visible cells still carry the message');
    assert.ok(row.slice(edge).trim() === '', 'nothing past the window edge remains on screen');
    const paged = waitForCurrentMonsterMore('The kitten drops a rock.');
    await input.waitUntilBlocked();
    input.feed(' ');
    await paged;
    await flush_screen(1);
    assert.equal(toplText(), 'The kitten drops a rock.--More--', 'the new line repaints the row from its left edge');
});
//# sourceMappingURL=topline_clip_reset.test.js.map