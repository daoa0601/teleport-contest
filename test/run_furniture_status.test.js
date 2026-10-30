import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { FOUNTAIN } from '../js/const.js';
import { flush_screen } from '../js/display.js';
import { LARGE_BOX } from '../js/object_data.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';
void test('a run ending on furniture refreshes capacity before describing the pickup', async () => {
    const level = await freshObjectRoom({ flags: { pickup: true, pickup_types: '' } });
    await addInventoryObject(LARGE_BOX);
    await floorObject(LARGE_BOX, 11, 10);
    level.requireAt(11, 10).typ = FOUNTAIN;
    await flush_screen(1);
    await rhack('L'.charCodeAt(0));
    await flush_screen(1);
    assert.match(requireScreenRow(0).map(cell => cell.ch).join(''), /little trouble lifting/);
    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /Burdened/);
});
//# sourceMappingURL=run_furniture_status.test.js.map