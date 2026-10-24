import assert from 'node:assert/strict';
import test from 'node:test';
import { selectMapPosition } from '../js/getpos.js';
import { resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenCell, requireScreenRow } from './support/screen.js';
for (const autodescribe of [false, true]) {
    void test(`a dismissed wrapped targeting goal restores the map with autodescribe ${autodescribe ? 'on' : 'off'}`, async () => {
        freshObjectRoom({ top: 0, bottom: 5, heroY: 2, iflags: { autodescribe } });
        const goal = 'the staircase beyond the fountain and the altar at the far end of the unexplored room';
        const input = resetInputState();
        input.feed('$');
        const selection = selectMapPosition({
            start: { x: 10, y: 2 }, prompt: 'Pick a location.', goal,
        });
        try {
            await input.waitUntilBlocked();
            assert.match(requireScreenRow(0).map(cell => cell.ch).join(''), /Move cursor to the staircase/);
            assert.match(requireScreenRow(1).map(cell => cell.ch).join(''), /--More--/);
            input.feed(' ');
            await input.waitUntilBlocked();
            assert.equal(requireScreenRow(0).map(cell => cell.ch).join('').trim(), '', 'The acknowledged goal stays cleared while getpos waits for a direction');
            assert.equal(requireScreenCell(9, 1).ch, '.', 'The goal no longer covers the map');
            input.feed('l');
            await input.waitUntilBlocked();
            const message = requireScreenRow(0).map(cell => cell.ch).join('').trim();
            if (autodescribe)
                assert.match(message, /floor of a room/);
            else
                assert.equal(message, '', 'Cursor movement does not replay the acknowledged goal');
        }
        finally {
            input.feed('.');
            await selection;
        }
        const selected = await selection;
        assert.equal(selected?.x, 11);
        assert.equal(selected?.y, 2);
    });
}
//# sourceMappingURL=getpos_messages.test.js.map