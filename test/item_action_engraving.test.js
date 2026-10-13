import assert from 'node:assert/strict';
import test from 'node:test';
import { ddoinv } from '../js/invent.js';
import { game, requireGameDisplay } from '../js/gstate.js';
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
for (const { appearance, verb } of [
    { appearance: 'wire', verb: 'Write' },
    { appearance: 'diamond', verb: 'Engrave' },
]) {
    void test(`the item menu offers ${verb === 'Write' ? 'writing' : 'engraving'} for a shuffled ${appearance} ring`, async () => {
        freshObjectRoom();
        const type = game.objectDescriptions?.findIndex(description => description === appearance);
        assert.ok(type !== undefined && type >= 0, `The initialized game needs a ${appearance} ring`);
        const ring = await addInventoryObject(type);
        const input = resetInputState();
        const menu = ddoinv();
        try {
            await input.waitUntilBlocked();
            input.feed(ring.invlet);
            await input.waitUntilBlocked();
            const visible = requireGameDisplay().grid
                .map(row => row.map(cell => cell.ch).join('')).join('\n');
            assert.match(visible, new RegExp(`E - ${verb} on the floor with this item`));
        }
        finally {
            input.feed('\x1b');
            await menu;
        }
    });
}
//# sourceMappingURL=item_action_engraving.test.js.map