import assert from 'node:assert/strict';
import test from 'node:test';
import { requireGameDisplay } from '../js/gstate.js';
import { selectMapPosition } from '../js/getpos.js';
import { resetInputState } from '../js/input.js';
import { freshGameplayRoom } from './support/playable-room.js';
void test('canceling a map selection erases its automatic location description', async () => {
    freshGameplayRoom();
    const input = resetInputState();
    input.feed('l');
    const selection = selectMapPosition({
        start: { x: 10, y: 10 }, prompt: 'Choose a location.', goal: 'a location',
        describe: () => 'floor of a room',
    });
    await input.waitUntilBlocked();
    input.feed('\x1b');
    assert.equal(await selection, null);
    const topline = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('').trimEnd();
    assert.equal(topline, '');
});
//# sourceMappingURL=getpos_cancel.test.js.map