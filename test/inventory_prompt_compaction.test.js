import assert from 'node:assert/strict';
import test from 'node:test';
import { GETOBJ_SUGGEST } from '../js/const.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { getobj } from '../js/inventory_prompt.js';
import { DAGGER } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
for (const { letters, displayed } of [
    { letters: 'abc###', displayed: 'a-c#-#' },
    { letters: 'abc######', displayed: 'a-c#-#' },
    { letters: 'ab###', displayed: 'ab###' },
]) {
    void test(`an object prompt displays inventory letters ${letters} as ${displayed}`, async () => {
        await freshObjectRoom();
        for (const invlet of letters) {
            game.inventory.push(await knownObject(DAGGER, {
                where: 'inventory', invlet, nomerge: true,
            }));
        }
        const input = resetInputState();
        const selection = getobj('drop', () => GETOBJ_SUGGEST);
        await input.waitUntilBlocked();
        try {
            const prompt = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('').trimEnd();
            assert.equal(prompt, `What do you want to drop? [${displayed} or ?*]`);
        }
        finally {
            input.feed('\x1b');
            await selection;
        }
    });
}
//# sourceMappingURL=inventory_prompt_compaction.test.js.map