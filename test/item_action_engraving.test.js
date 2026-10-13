import assert from 'node:assert/strict';
import test from 'node:test';
import { ddoinv } from '../js/invent.js';
import { requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MAGIC_MARKER, TIN_OPENER, TOWEL } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
for (const { type, text } of [
    { type: TIN_OPENER, text: null },
    { type: TOWEL, text: 'Wipe the floor with this towel' },
    { type: MAGIC_MARKER, text: 'Scribble graffiti on the floor' },
]) {
    void test(`the item menu ${text ? 'offers' : 'omits'} engraving for ${type === TIN_OPENER ? 'a tin opener' : type === TOWEL ? 'a towel' : 'a magic marker'}`, async () => {
        freshObjectRoom();
        const item = await addInventoryObject(type);
        const input = resetInputState();
        const menu = ddoinv();
        try {
            await input.waitUntilBlocked();
            input.feed(item.invlet);
            await input.waitUntilBlocked();
            const visible = requireGameDisplay().grid
                .map(row => row.map(cell => cell.ch).join('')).join('\n');
            if (text)
                assert.ok(visible.includes(`E - ${text}`), visible);
            else
                assert.doesNotMatch(visible, /E -/);
        }
        finally {
            input.feed('\x1b');
            await menu;
        }
    });
}
//# sourceMappingURL=item_action_engraving.test.js.map