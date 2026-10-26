import assert from 'node:assert/strict';
import test from 'node:test';
import { wearHeroArmor } from '../js/armor.js';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { ELVEN_CLOAK } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';

// C cmd.c:2064 registers ia_dotakeoff as the internal "alttakeoff"
// command.  The item-actions takeoff remembers that function in
// CQ_REPEAT, so a following ^A replays it: with nothing left worn it
// reports "Not wearing any armor or accessories." instead of an unknown
// extended command.
void test('repeating the item-actions takeoff reports nothing worn', async () => {
    freshObjectRoom();
    const cloak = await addInventoryObject(ELVEN_CLOAK);
    wearHeroArmor(cloak);
    const input = resetInputState();
    const menu = rhack('i'.charCodeAt(0));
    try {
        await answerPrompts(menu, input, [
            { prompt: /Armor/, keys: cloak.invlet ?? 'a' },
            { prompt: /T - Take off this armor/, keys: 'T' },
        ]);
    } finally {
        input.feed('\x1b');
        await menu;
    }
    await answerPrompts(rhack(0), input, []);
    assert.equal(game.uarmc, null);

    await answerPrompts(rhack('\x01'.charCodeAt(0)), input, []);

    assert.equal(game._pending_message, 'Not wearing any armor or accessories.');
    assert.equal(game.context.move, 0);
});
