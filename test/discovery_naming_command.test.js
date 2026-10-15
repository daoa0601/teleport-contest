import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { queueCommandKeys, resetInputState } from '../js/input.js';
import { RIN_PROTECTION } from '../js/object_data.js';
import { recordObjectCall } from '../js/object_knowledge.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { planInput } from './support/planned-input.js';
void test('discovery naming can replace a previously assigned type name', async (t) => {
    freshObjectRoom();
    await addInventoryObject(RIN_PROTECTION, { typeKnown: false });
    recordObjectCall(RIN_PROTECTION, 'Defense');
    const input = resetInputState();
    input.feed('name\r');
    queueCommandKeys('d');
    planInput(input, t, [
        { prompt: /Pick an object type to name/, keys: 'a' },
        { prompt: /Call a ring called Defense:/, keys: 'Ward\r' },
    ]);
    await rhack('#'.charCodeAt(0));
    assert.equal(game._objectCallNames?.[RIN_PROTECTION], 'Ward');
});
//# sourceMappingURL=discovery_naming_command.test.js.map