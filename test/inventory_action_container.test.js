import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { ddoinv } from '../js/invent.js';
import { BAG_OF_TRICKS, SACK } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';
for (const discovered of [false, true]) {
    void test(`${discovered ? 'a discovered' : 'an unidentified'} bag of tricks offers ${discovered ? 'reaching inside' : 'opening'} in its item actions`, async () => {
        freshObjectRoom();
        const bag = await addInventoryObject(BAG_OF_TRICKS, { typeKnown: discovered });
        const input = resetInputState();
        input.feed(bag.invlet);
        const menu = ddoinv();
        await input.waitUntilBlocked();
        try {
            const text = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            assert.match(text, discovered ? /a - Reach into this bag/ : /a - Open this container/);
        }
        finally {
            input.feed('\x1b');
            await menu;
        }
    });
}
void test('a carried sack offers opening through its inventory action menu', async () => {
    freshObjectRoom();
    const sack = await addInventoryObject(SACK, { cknown: true });
    const input = resetInputState();
    input.feed(sack.invlet);
    const menu = ddoinv();
    await input.waitUntilBlocked();
    try {
        const text = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
        assert.match(text, /a - Open this container/);
    }
    finally {
        input.feed('\x1b');
        await menu;
    }
});
void test('the inventory opening action applies the selected sack after its menu closes', async () => {
    freshObjectRoom();
    const sack = await addInventoryObject(SACK, { cknown: true });
    const input = resetInputState();
    await answerPrompts(rhack('i'.charCodeAt(0)), input, [
        { prompt: /Tools/, keys: sack.invlet },
        { prompt: /a - Open this container/, keys: 'a' },
    ]);
    await answerPrompts(rhack(0), input, [
        { prompt: /The bag is empty\.  Do what with it\?/, keys: 'q' },
    ]);
    assert.equal(sack.cknown, true);
    assert.equal(game.inventory.includes(sack), true);
});
//# sourceMappingURL=inventory_action_container.test.js.map