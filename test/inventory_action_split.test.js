import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { ddoinv } from '../js/invent.js';
import { CLUB, DAGGER } from '../js/object_data.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a carried stack offers splitting through its inventory action menu', async () => {
    freshObjectRoom();
    const dagger = await addInventoryObject(DAGGER, { quan: 4 });
    const input = resetInputState();
    input.feed(dagger.invlet);
    const menu = ddoinv();
    await input.waitUntilBlocked();
    try {
        const text = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
        assert.match(text, /I - Adjust inventory by splitting this stack/);
        assert.match(text, /\/ - Look up information about these/);
    }
    finally {
        input.feed('\x1b');
        await menu;
    }
});
for (const { count, amount, destination } of [
    { count: 2, amount: 1, destination: 'z' },
    { count: 7, amount: 3, destination: 'z' },
    { count: 7, amount: 3, destination: '\x1b' },
]) {
    void test(`splitting ${amount} of ${count} daggers ${destination === '\x1b' ? 'can be cancelled' : 'keeps the remaining stack in its original slot'}`, async () => {
        freshObjectRoom();
        const dagger = await addInventoryObject(DAGGER, { quan: count });
        const originalLetter = dagger.invlet;
        const input = resetInputState();
        await answerPrompts(rhack('i'.charCodeAt(0)), input, [
            { prompt: /Weapons/, keys: originalLetter },
            { prompt: /I - Adjust inventory by splitting this stack/, keys: 'I' },
        ]);
        await answerPrompts(rhack(0), input, [
            ...(count > 2 ? [
                { prompt: /Split off how many\?/, keys: String(amount) },
                { prompt: /Count:/, keys: ' ' },
            ] : []),
            { prompt: /Split \d+ to what/, keys: destination },
        ]);
        assert.equal(dagger.invlet, originalLetter);
        assert.equal(dagger.quan, destination === '\x1b' ? count : count - amount);
        const split = game.inventory.find(object => object.invlet === 'z');
        assert.equal(split?.quan, destination === '\x1b' ? undefined : amount);
        assert.equal(game.context.move, 0);
    });
}
void test('splitting into an occupied incompatible slot moves its old item to a free slot', async () => {
    freshObjectRoom();
    const dagger = await addInventoryObject(DAGGER, { quan: 2 });
    const club = await addInventoryObject(CLUB);
    const occupied = club.invlet;
    const input = resetInputState();
    await answerPrompts(rhack('i'.charCodeAt(0)), input, [
        { prompt: /Weapons/, keys: dagger.invlet },
        { prompt: /I - Adjust inventory by splitting this stack/, keys: 'I' },
    ]);
    await answerPrompts(rhack(0), input, [{ prompt: /Split 1 to what/, keys: occupied }]);
    assert.equal(dagger.quan, 1);
    assert.equal(game.inventory.find(object => object.invlet === occupied)?.otyp, DAGGER);
    assert.notEqual(club.invlet, occupied);
    assert.notEqual(club.invlet, dagger.invlet);
    assert.equal(game.inventory.includes(club), true);
});
void test('splitting into a compatible stack merges the selected quantity into that destination', async () => {
    freshObjectRoom();
    const dagger = await addInventoryObject(DAGGER, { quan: 2 });
    const destination = await knownObject(DAGGER, { quan: 4, where: 'inventory', invlet: 'z' });
    game.inventory.push(destination);
    const input = resetInputState();
    await answerPrompts(rhack('i'.charCodeAt(0)), input, [
        { prompt: /Weapons/, keys: dagger.invlet },
        { prompt: /I - Adjust inventory by splitting this stack/, keys: 'I' },
    ]);
    await answerPrompts(rhack(0), input, [{ prompt: /Split 1 to what/, keys: 'z' }]);
    assert.equal(dagger.quan, 1);
    assert.equal(destination.quan, 5);
    assert.equal(game.inventory.length, 2);
});
for (const eraseKey of ['\b', '\x7f']) {
    void test(`${eraseKey === '\b' ? 'Backspace' : 'Delete'} clears the split count display, while a typed zero remains visible`, async () => {
        freshObjectRoom();
        const dagger = await addInventoryObject(DAGGER, { quan: 7 });
        const input = resetInputState();
        await answerPrompts(rhack('i'.charCodeAt(0)), input, [
            { prompt: /Weapons/, keys: dagger.invlet },
            { prompt: /I - Adjust inventory by splitting this stack/, keys: 'I' },
        ]);
        const splitting = rhack(0);
        try {
            await answerPrompts(splitting, input, [
                { prompt: /Split off how many\?/, keys: '2' },
                { prompt: /Count: 2/, keys: eraseKey },
                { prompt: /Count: +\n/, keys: '0' },
                { prompt: /Count: 0/, keys: '3' },
                { prompt: /Count: 3/, keys: ' ' },
                { prompt: /Split 3 to what/, keys: 'z' },
            ]);
        }
        finally {
            input.feed('\x1b');
            await splitting;
        }
        assert.equal(dagger.quan, 4);
        assert.equal(game.inventory.find(object => object.invlet === 'z')?.quan, 3);
        assert.equal(game.context.move, 0);
    });
}
//# sourceMappingURL=inventory_action_split.test.js.map