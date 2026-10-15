import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { LEATHER_DRUM } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
import { freshTurnRoom } from './support/playable-room.js';
void test('a permanently deaf drummer feels the performance without gaining temporary deafness', async () => {
    const input = freshTurnRoom();
    assert.ok(game.u.uroleplay);
    game.u.uroleplay.deaf = true;
    const drum = await addInventoryObject(LEATHER_DRUM);
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    installPagerInput(input, { expected: /playing|pound|deafening/, limit: 5 });
    pushKeys(`a${drum.invlet}`);
    await moveloop_core();
    await finishAtCommandInput(input, moveloop_core, /playing|pound|deafening|^$/);
    messages.push(game._pending_message);
    assert.equal(game.u.deafTurns ?? 0, 0);
    assert.match(messages.join('\n'), /You pound on the drum\./);
});
//# sourceMappingURL=music_deafness.test.js.map