import assert from 'node:assert/strict';
import test from 'node:test';
import { SDOOR, STONE, VWALL } from '../js/const.js';
import { selectMapPosition } from '../js/getpos.js';
import { resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';
void test('area filtering follows remembered walls through a secret door', async () => {
    const level = freshObjectRoom({ hero: { blindTurns: 5 }, iflags: { getloc_filter: 2 } });
    for (const [offset, typ] of [STONE, SDOOR, STONE, VWALL].entries()) {
        const location = level.requireAt(10 + offset, 10);
        location.typ = typ;
        location.seenv = 255;
    }
    resetInputState().feed('z.');
    const selected = await selectMapPosition({
        start: { x: 10, y: 10 }, prompt: 'Pick a location.', goal: 'a location',
        isValidLocation: (x, y) => x === 13 && y === 10,
    });
    assert.equal(selected?.x, 13);
});
void test('area filtering starts at the hero even when that square has not been seen', async () => {
    const level = freshObjectRoom({ hero: { blindTurns: 5 }, iflags: { getloc_filter: 2 } });
    level.requireAt(10, 10).seenv = 0;
    resetInputState().feed('z.');
    const selected = await selectMapPosition({
        start: { x: 10, y: 10 }, prompt: 'Pick a location.', goal: 'a location',
        isValidLocation: (x, y) => x === 12 && y === 10,
    });
    assert.equal(selected?.x, 12);
});
//# sourceMappingURL=getpos_area.test.js.map