import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { W_ARMC } from '../js/const.js';
import { game } from '../js/gstate.js';
import { MUMMY_WRAPPING } from '../js/object_data.js';
import { setPropertyTimeout } from '../js/properties.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshTurnRoom } from './support/playable-room.js';

void test('blocked invisibility expires without announcing a visible change', async () => {
    const input = freshTurnRoom();
    const cloak = await addInventoryObject(MUMMY_WRAPPING, { initialize: false });
    cloak.owornmask = W_ARMC;
    game.uarmc = game.u.uarmc = cloak;
    setPropertyTimeout('invisible', 1);
    const messages: string[] = [];
    input.beforeRead = () => { messages.push(game._pending_message || game._retained_message); };
    input.feed('ll');

    await moveloop_core();
    await moveloop_core();

    assert.equal(game.u.invisibleTurns, 0);
    assert.doesNotMatch(messages.join('\n'), /no longer invisible|see through yourself/);
});
