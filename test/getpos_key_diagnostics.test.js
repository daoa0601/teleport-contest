import assert from 'node:assert/strict';
import test from 'node:test';
import { selectMapPosition } from '../js/getpos.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';
void test('unknown-direction guidance advertises the configured movement and pick keys', async () => {
    freshObjectRoom();
    assert.equal(game.commandBindings.bindKey(104, 'nothing').accepted, true);
    assert.equal(game.commandBindings.bindKey(115, 'movewest').accepted, true);
    assert.equal(game.commandBindings.bindSpecialKey(61, 'getpos.pick'), true);
    const input = resetInputState();
    input.feed('q');
    const selected = await answerPrompts(selectMapPosition({
        start: { x: 10, y: 10 }, prompt: 'Pick a location.', goal: 'a location',
    }), input, [{ prompt: /Unknown direction: 'q' \(use 's', 'j', 'k', 'l' or '='\)/, keys: '=' }]);
    assert.equal(selected?.x, 10);
});
void test('unknown meta keys use the native visible key notation', async () => {
    freshObjectRoom();
    const input = resetInputState();
    input.feed(0xe2);
    await answerPrompts(selectMapPosition({
        start: { x: 10, y: 10 }, prompt: 'Pick a location.', goal: 'a location',
    }), input, [{ prompt: /Unknown direction: 'M-b'/, keys: '.' }]);
});
//# sourceMappingURL=getpos_key_diagnostics.test.js.map