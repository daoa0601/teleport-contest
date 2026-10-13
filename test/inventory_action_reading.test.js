import assert from 'node:assert/strict';
import test from 'node:test';
import { requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { ddoinv } from '../js/invent.js';
import { FORTUNE_COOKIE, OBJECT_NAMES, SPE_BLANK_PAPER } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
for (const { type, text } of [
    { type: FORTUNE_COOKIE, text: 'Read the message inside this cookie' },
    { type: OBJECT_NAMES.indexOf('T-shirt'), text: 'Read the slogan on the shirt' },
    { type: SPE_BLANK_PAPER, text: 'Read this spellbook' },
]) {
    void test(`an inventory item offers its native reading action: ${text}`, async () => {
        freshObjectRoom();
        const item = await addInventoryObject(type, { known: true, typeKnown: true });
        const input = resetInputState();
        input.feed(item.invlet);
        const menu = ddoinv();
        await input.waitUntilBlocked();
        try {
            const rows = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join(''));
            assert.ok(rows.some(row => row.includes(`r - ${text}`)), `Missing reading action: ${text}`);
        }
        finally {
            input.feed('\x1b');
            await menu;
        }
    });
}
//# sourceMappingURL=inventory_action_reading.test.js.map