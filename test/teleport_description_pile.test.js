import assert from 'node:assert/strict';
import test from 'node:test';
import { askTeleportDestination } from '../js/cmd.js';
import { STAIRS } from '../js/const.js';
import { flush_screen } from '../js/display.js';
import { showFloorPile } from '../js/floor_object_display.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { APPLE, DAGGER } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';
void test('a chosen teleport description remains visible beside a corner floor-pile window', async () => {
    const level = freshObjectRoom({ flags: { tips: false, verbose: false } });
    const location = level.requireAt(11, 10);
    location.typ = STAIRS;
    level.upstair = { x: 11, y: 10 };
    const apple = await floorObject(APPLE, 10, 10);
    const dagger = await floorObject(DAGGER, 10, 10);
    const input = resetInputState();
    input.feed('l.');
    const destination = await askTeleportDestination();
    await flush_screen(1);
    assert.equal(destination?.x, 11);
    assert.match(requireScreenRow(0).map(cell => cell.ch).join(''), /^staircase up/);
    assert.equal(game._pending_message, '', 'The chosen description needs no further acknowledgment.');
    const pile = showFloorPile([dagger, apple], false, 'There is a staircase up here.');
    await input.waitUntilBlocked();
    try {
        const row = requireScreenRow(0).map(cell => cell.ch).join('');
        assert.match(row, /^staircase up\s+There is a staircase up here\./);
    }
    finally {
        input.feed(' ');
        await pile;
    }
});
//# sourceMappingURL=teleport_description_pile.test.js.map