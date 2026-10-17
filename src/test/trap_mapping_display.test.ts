import assert from 'node:assert/strict';
import test from 'node:test';

import { PIT } from '../js/const.js';
import { flush_screen, map_trap, newsym } from '../js/display.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenCell } from './support/screen.js';

for (const known of [false, true]) {
    void test(`temporarily mapping a ${known ? 'known' : 'concealed'} trap preserves its discovery state`, async () => {
        const level = freshObjectRoom();
        const trap = addTrap(level, PIT, 11, 10, { tseen: known });

        map_trap(trap, true);
        await flush_screen(1);
        const temporary = requireScreenCell(10, 11).ch;
        newsym(11, 10);
        await flush_screen(1);

        assert.equal(temporary, '^');
        assert.equal(requireScreenCell(10, 11).ch, known ? '^' : '.');
    });
}
