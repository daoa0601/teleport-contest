import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { flush_screen } from '../js/display.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';
void test('editing the fruit option keeps the dungeon map visible beneath the prompt', async () => {
    freshObjectRoom();
    await flush_screen(1);
    const input = resetInputState();
    input.feed('a');
    const operation = rhack('O'.charCodeAt(0));
    await input.waitUntilBlocked();
    try {
        assert.match(game._pending_message, /^Set fruit to what\?/);
        assert.equal(requireGameDisplay().grid[11]?.[9]?.ch, '@');
        assert.equal(requireGameDisplay().grid[10]?.[9]?.ch, '.');
    }
    finally {
        input.feed('Mango\n\x1b');
        await operation;
    }
});
//# sourceMappingURL=fruit_prompt_map.test.js.map