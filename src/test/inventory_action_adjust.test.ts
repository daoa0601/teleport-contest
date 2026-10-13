import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DAGGER } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('the inventory item action opens adjustment directly for that item', async () => {
    freshObjectRoom();
    const dagger = await addInventoryObject(DAGGER);
    const input = resetInputState();
    input.feed(`${dagger.invlet}i`);
    const adjusting = rhack('i'.charCodeAt(0));
    const boundary = await Promise.race([
        input.waitUntilBlocked().then(() => true), adjusting.then(() => false),
    ]);
    try {
        assert.equal(boundary, true, 'selecting the item action waits for its destination letter');
        const topline = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('') ?? '';
        assert.match(topline, /Adjust letter to what/);
        input.feed('z');
        await adjusting;
        assert.equal(dagger.invlet, 'z');
        assert.equal(game.context.move, 0);
    } finally {
        input.feed('\x1b');
        await adjusting;
    }
});
