import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { queueCommandKeys, resetInputState } from '../js/input.js';
import { POT_WATER, RIN_PROTECTION } from '../js/object_data.js';
import { recordObjectCall } from '../js/object_knowledge.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { planInput } from './support/planned-input.js';
void test('calling known holy water names its type without its blessing', async (t) => {
    freshObjectRoom();
    await addInventoryObject(POT_WATER, { invlet: 'a', blessed: true });
    const input = resetInputState();
    input.feed('name\r');
    queueCommandKeys('#oa');
    planInput(input, t, [{ prompt: /Call a potion of water:/, keys: '  Clear   Drink  \r' }]);
    await rhack('#'.charCodeAt(0));
    assert.equal(game._objectCallNames?.[POT_WATER], 'Clear Drink');
});
void test('an empty type-name answer keeps the existing call name', async () => {
    freshObjectRoom();
    await addInventoryObject(RIN_PROTECTION, { invlet: 'a', typeKnown: false });
    recordObjectCall(RIN_PROTECTION, 'Defense');
    const input = resetInputState();
    input.feed('name\r\r');
    queueCommandKeys('#oa');
    await rhack('#'.charCodeAt(0));
    assert.equal(game._objectCallNames?.[RIN_PROTECTION], 'Defense');
});
void test('type calling keeps printable high bytes and limits the normalized name', async () => {
    freshObjectRoom();
    await addInventoryObject(RIN_PROTECTION, { invlet: 'a', typeKnown: false });
    const input = resetInputState();
    input.feed(`name\r  \u00a0Café   ${'r'.repeat(68)}\r`);
    queueCommandKeys('#oa');
    await rhack('#'.charCodeAt(0));
    assert.equal(game._objectCallNames?.[RIN_PROTECTION], `\u00a0Café ${'r'.repeat(56)}`);
    assert.equal(game.context.move, 0);
});
void test('erasing a call name keeps the unidentified ring in encountered discoveries', async (t) => {
    freshObjectRoom();
    await addInventoryObject(RIN_PROTECTION, { invlet: 'a', typeKnown: false });
    recordObjectCall(RIN_PROTECTION, 'Defense');
    const input = resetInputState();
    input.feed('name\r');
    queueCommandKeys('#oa');
    planInput(input, t, [
        { prompt: /Call a ring called Defense:/, keys: '   \r' },
        { prompt: /\n  ring \([a-z ]+\) *\n[\s\S]*--More--/, keys: ' ' },
    ]);
    await rhack('#'.charCodeAt(0));
    assert.equal(game._objectCallNames?.[RIN_PROTECTION], undefined);
    await rhack('\\'.charCodeAt(0));
});
//# sourceMappingURL=object_call_command.test.js.map