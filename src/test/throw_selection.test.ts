import assert from 'node:assert/strict';
import test from 'node:test';

import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DAGGER, GOLD_PIECE } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('the throw suggestions menu includes carried coins alongside weapons', async () => {
    freshObjectRoom();
    await addInventoryObject(DAGGER);
    await addInventoryObject(GOLD_PIECE, { quan: 80 });
    const input = resetInputState();
    input.feed('?');
    const throwing = rhack('t'.charCodeAt(0));
    await input.waitUntilBlocked();
    assert.ok(game.nhDisplay);
    const menu = game.nhDisplay.grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
    input.feed('\x1b\x1b');
    await throwing;

    assert.match(menu, /Coins/);
    assert.match(menu, /80 gold pieces/);
    assert.match(menu, /dagger/);
    assert.equal(game.context.move, 0);
});
