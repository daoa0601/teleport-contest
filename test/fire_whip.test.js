import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { BULLWHIP } from '../js/object_data.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { addInventoryObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';
void test('fire applies a wielded bullwhip when autoquiver is disabled', async () => {
    freshObjectRoom({ flags: { autoquiver: false } });
    const whip = await addInventoryObject(BULLWHIP);
    await setPrimaryWeapon(whip);
    const input = resetInputState();
    await answerPrompts(rhack('f'.charCodeAt(0)), input, [
        { prompt: /In what direction\?/, keys: 'l' },
    ]);
    assert.match(game._pending_message, /Snap!/);
    assert.equal(game.uwep, whip);
    assert.equal(game.uquiver, null);
    assert.equal(game.context.move, 1);
});
void test('cancelling fire with a wielded bullwhip after a timed command takes no time', async () => {
    freshObjectRoom({ flags: { autoquiver: false } });
    const whip = await addInventoryObject(BULLWHIP);
    await setPrimaryWeapon(whip);
    await rhack('.'.charCodeAt(0));
    assert.equal(game.context.move, 1);
    const input = resetInputState();
    await answerPrompts(rhack('f'.charCodeAt(0)), input, [
        { prompt: /In what direction\?/, keys: '\x1b' },
    ]);
    assert.equal(game.context.move, 0);
    assert.equal(game.uwep, whip);
});
//# sourceMappingURL=fire_whip.test.js.map