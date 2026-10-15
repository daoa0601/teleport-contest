import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { queueCommandKeys, resetInputState } from '../js/input.js';
import { RIN_PROTECTION } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { planInput } from './support/planned-input.js';
void test('floor naming assigns a type name to the object under the hero', async (t) => {
    freshObjectRoom({ flags: { tips: false, verbose: true } });
    await floorObject(RIN_PROTECTION, 10, 10, { typeKnown: false });
    const input = resetInputState();
    input.feed('name\r');
    queueCommandKeys('f');
    planInput(input, t, [
        { prompt: /instructions/, keys: '.' },
        { prompt: /Call an? .*ring:/, keys: 'Defense\r' },
    ]);
    await rhack('#'.charCodeAt(0));
    assert.equal(game._objectCallNames?.[RIN_PROTECTION], 'Defense');
});
//# sourceMappingURL=floor_naming_command.test.js.map