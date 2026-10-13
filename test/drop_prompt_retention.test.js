import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { flush_screen } from '../js/display.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { APPLE } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshGameplayRoom } from './support/playable-room.js';
void test('a silent drop leaves its answered object query visible', async () => {
    const level = freshGameplayRoom({ flags: { verbose: false } });
    const apple = await addInventoryObject(APPLE, { invlet: 'a' });
    pushKeys('a');
    await rhack('d'.charCodeAt(0));
    await flush_screen(1);
    const topline = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('').trimEnd();
    assert.match(topline ?? '', /^What do you want to drop\? \[a or \?\*\]$/);
    assert.equal(game.inventory.includes(apple), false);
    assert.equal(level.objects[10]?.[10]?.includes(apple), true);
    assert.equal(game._pending_message, '', 'an answered query needs no acknowledgment');
});
//# sourceMappingURL=drop_prompt_retention.test.js.map