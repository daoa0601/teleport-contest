import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { LENSES } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
void test('removing named lenses reports their blessing and name without a worn suffix', async () => {
    freshObjectRoom();
    const lenses = await addInventoryObject(LENSES, { blessed: true, oname: 'Sentinel' });
    const input = resetInputState();
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    input.feed(`${lenses.invlet}                `);
    await rhack('P'.charCodeAt(0));
    await rhack('R'.charCodeAt(0));
    const feedback = [...messages, game._pending_message].join(' ');
    assert.match(feedback, /You were wearing .*blessed (?:pair of )?lenses named Sentinel\./);
    assert.doesNotMatch(game._pending_message, /being worn/);
    assert.equal(game.ublindf, null);
});
//# sourceMappingURL=eyewear_removal_feedback.test.js.map