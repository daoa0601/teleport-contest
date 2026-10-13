import assert from 'node:assert/strict';
import test from 'node:test';
import { requireGameDisplay } from '../js/gstate.js';
import { ddoinv } from '../js/invent.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { TIN_OPENER, TOWEL } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

for (const { label, type, wet, kitten, expected } of [
    { label: 'a tin opener', type: TIN_OPENER, wet: 0, kitten: false,
        expected: 'w - Wield the tin opener to easily open tins' },
    { label: 'a wet towel', type: TOWEL, wet: 3, kitten: false,
        expected: 'w - Wield this item as your weapon' },
    { label: 'a kitten holding a tin opener', type: TIN_OPENER, wet: 0, kitten: true,
        expected: null },
]) {
    void test(`the item menu gives native wielding advice for ${label}`, async () => {
        freshObjectRoom({ hero: kitten
            ? { umonnum: MONSTER_NAME.indexOf('kitten'), mh: 10, mhmax: 10 } : {} });
        const item = await addInventoryObject(type, { spe: wet });
        const input = resetInputState();
        const menu = ddoinv();
        try {
            await input.waitUntilBlocked();
            input.feed(item.invlet);
            await input.waitUntilBlocked();
            const entries = requireGameDisplay().grid
                .map(row => row.map(cell => cell.ch).join('')).filter(row => /w -/.test(row));

            if (expected) assert.ok(entries.some(row => row.includes(expected)), entries.join('\n'));
            else assert.equal(entries.length, 0);
        } finally {
            input.feed('\x1b');
            await menu;
        }
    });
}
