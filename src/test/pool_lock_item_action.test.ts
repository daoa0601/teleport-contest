import assert from 'node:assert/strict';
import test from 'node:test';
import { requireGameDisplay } from '../js/gstate.js';
import { ddoinv } from '../js/invent.js';
import { resetInputState } from '../js/input.js';
import { CREDIT_CARD, LOCK_PICK, SKELETON_KEY } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

for (const type of [LOCK_PICK, CREDIT_CARD, SKELETON_KEY]) {
    void test(`the item menu offers lock picking for ${type === LOCK_PICK ? 'a lock pick' : type === CREDIT_CARD ? 'a credit card' : 'a key'}`, async () => {
        freshObjectRoom();
        const item = await addInventoryObject(type);
        const input = resetInputState();
        const menu = ddoinv();
        try {
            await input.waitUntilBlocked();
            input.feed(item.invlet);
            await input.waitUntilBlocked();

            const text = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            assert.match(text, /a - Use this tool to pick a lock/);
        } finally {
            input.feed('\x1b');
            await menu;
        }
    });
}

