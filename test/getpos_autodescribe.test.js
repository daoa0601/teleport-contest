import assert from 'node:assert/strict';
import test from 'node:test';
import { flush_screen, newsym, pline, terrain_glyph } from '../js/display.js';
import { paintGetposCursor, selectMapPosition } from '../js/getpos.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';
void test('a missing feature appends its notice to the automatic description', async () => {
    freshObjectRoom();
    resetInputState();
    await paintGetposCursor({ x: 11, y: 10 }, 'floor of a room', null, { flushPending: true });
    await pline("Can't find dungeon feature '_'.");
    await flush_screen(1);
    assert.equal(requireScreenRow(0).map(cell => cell.ch).join('').trimEnd(), "floor of a room  Can't find dungeon feature '_'.");
});
void test('cursor movement describes the displayed location and configured coordinates', async () => {
    freshObjectRoom({ iflags: { getpos_coords: 'm' } });
    const input = resetInputState();
    input.feed('l');
    const selected = await answerPrompts(selectMapPosition({
        start: { x: 10, y: 10 }, prompt: 'Pick a location.', goal: 'a location',
    }), input, [{ prompt: /floor of a room <11,10>/, keys: '.' }]);
    assert.equal(selected?.x, 11);
});
void test('automatic descriptions warn about invalid locations without preventing selection', async () => {
    freshObjectRoom({ iflags: { getpos_coords: 's' } });
    const input = resetInputState();
    input.feed('l');
    const selected = await answerPrompts(selectMapPosition({
        start: { x: 10, y: 10 }, prompt: 'Pick a target.', goal: 'a target',
        isValidLocation: (x, y) => x === 12 && y === 10,
    }), input, [{ prompt: /floor of a room \[12,11\] \(invalid target\)/, keys: '.' }]);
    assert.equal(selected?.x, 11);
});
void test('automatic description resumes after the target-menu toggle notice is read', async () => {
    freshObjectRoom();
    const input = resetInputState();
    input.feed('!');
    await answerPrompts(selectMapPosition({
        start: { x: 11, y: 10 }, prompt: 'Pick a location.', goal: 'a location',
    }), input, [
        { prompt: /Using a menu to show possible targets/, keys: ' ' },
        { prompt: /floor of a room/, keys: '.' },
    ]);
    assert.equal(game.iflags.getloc_usemenu, true);
});
void test('travel descriptions reject unseen stone even when the hero passes through walls', async () => {
    const level = freshObjectRoom({ hero: { passesWalls: true }, iflags: { getloc_travelmode: true } });
    const stone = level.requireAt(17, 10);
    stone.seenv = 0;
    stone.remembered_glyph = terrain_glyph(stone, 17, 10);
    newsym(17, 10);
    const input = resetInputState();
    input.feed('l');
    await answerPrompts(selectMapPosition({
        start: { x: 16, y: 10 }, prompt: 'Pick a location.', goal: 'a location',
    }), input, [{ prompt: /\(no travel path\)/, keys: '.' }]);
});
//# sourceMappingURL=getpos_autodescribe.test.js.map