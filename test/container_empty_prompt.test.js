import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { MENU_COMBINATION, MENU_FULL, MENU_PARTIAL, MENU_TRADITIONAL } from '../js/const.js';
import { CHEST } from '../js/object_data.js';
import { resetInputState } from '../js/input.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { answerPrompts } from './support/input-boundaries.js';
for (const [style, mode] of [[MENU_TRADITIONAL, 'traditional'], [MENU_COMBINATION, 'combination']]) {
    void test(`${mode} mode asks before acting on a known empty container`, async () => {
        freshPlayableRoom({ flags: { menu_style: style, cmdassist: false } });
        const chest = await addInventoryObject(CHEST, {
            invlet: 'a', initialize: false, olocked: false, cknown: true,
        });
        const input = resetInputState();
        await answerPrompts(applyInventoryObject(chest), input, [
            { prompt: /is empty\.  Do what with it\? \[: q\] \(q\)/, keys: 'q' },
        ]);
        assert.equal(game.context.move, 0);
        assert.equal(chest.contents?.length, 0);
    });
}
for (const [style, mode] of [[MENU_PARTIAL, 'partial'], [MENU_FULL, 'full']]) {
    void test(`${mode} mode reports an empty container without asking when nothing can be put in`, async () => {
        freshPlayableRoom({ flags: { menu_style: style } });
        const chest = await addInventoryObject(CHEST, {
            invlet: 'a', initialize: false, olocked: false, cknown: true,
        });
        await applyInventoryObject(chest);
        assert.match(game._pending_message, /don't have anything else to put in/);
        assert.equal(game.context.move, 0);
    });
}
//# sourceMappingURL=container_empty_prompt.test.js.map