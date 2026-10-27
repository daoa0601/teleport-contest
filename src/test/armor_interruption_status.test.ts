import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { stopDonning } from '../js/armor.js';
import { flush_screen } from '../js/display.js';
import { game } from '../js/gstate.js';
import { RING_MAIL } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshTurnRoom } from './support/playable-room.js';
import { requireScreenRow } from './support/screen.js';

void test('interrupted dressing keeps the old AC during messages until the next hero action', async () => {
    const input = freshTurnRoom({ flags: { verbose: false } });
    const armor = await addInventoryObject(RING_MAIL, { known: false });
    input.feed(`W${armor.invlet}`);
    await moveloop_core();
    await moveloop_core();
    await flush_screen(1);
    assert.equal(game.u.uac, 7);
    assert.equal(armor.known, false, 'Dressing has not finished');

    await stopDonning();
    await flush_screen(1);

    assert.equal(armor.worn, false);
    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /AC:7\b/);

    input.feed('.');
    await moveloop_core();

    assert.equal(game.u.uac, 10);
    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /AC:10\b/);
});
