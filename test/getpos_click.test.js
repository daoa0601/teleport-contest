import assert from 'node:assert/strict';
import test from 'node:test';
import { selectMapPosition } from '../js/getpos.js';
import { requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { freshGameplayRoom } from './support/playable-room.js';
for (const autodescribe of [true, false]) {
    for (const prefix of ['', 'g', 'G']) {
        void test(`a map click ${prefix ? `after ${prefix} ` : ''}${autodescribe ? 'retains' : 'clears'} the targeting prompt with autodescribe ${autodescribe ? 'on' : 'off'}`, async () => {
            freshGameplayRoom({ iflags: { autodescribe } });
            const input = resetInputState();
            input.feed(prefix);
            input.feedMapClick(11, 10, 1);
            const selected = await selectMapPosition({
                start: { x: 10, y: 10 }, prompt: 'Choose a location.', goal: 'a location',
            });
            const topline = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('').trimEnd();
            assert.equal(selected?.x, 11);
            assert.equal(topline, autodescribe ? 'Choose a location.' : '');
        });
    }
}
//# sourceMappingURL=getpos_click.test.js.map