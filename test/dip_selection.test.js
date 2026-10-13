import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DAGGER, GOLD_PIECE } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';
void test('dip offers carried equipment and excludes coins', async () => {
    freshObjectRoom();
    const dagger = await addInventoryObject(DAGGER);
    await addInventoryObject(GOLD_PIECE, { quan: 80 });
    const input = resetInputState();
    input.feed('dip\n');
    const dipping = rhack('#'.charCodeAt(0));
    await input.waitUntilBlocked();
    const prompt = requireScreenRow(0).map(cell => cell.ch).join('').trimEnd();
    input.feed('\x1b');
    await dipping;
    assert.equal(prompt, `What do you want to dip? [${dagger.invlet} or ?*]`);
    assert.equal(game.context.move, 0);
});
for (const inventory of ['only coins', 'nothing']) {
    void test(`dip offers the full inventory when carrying ${inventory}`, async () => {
        freshObjectRoom();
        if (inventory === 'only coins')
            await addInventoryObject(GOLD_PIECE, { quan: 80 });
        const input = resetInputState();
        input.feed('dip\n');
        const dipping = rhack('#'.charCodeAt(0));
        await input.waitUntilBlocked();
        const prompt = requireScreenRow(0).map(cell => cell.ch).join('').trimEnd();
        input.feed('\x1b');
        await dipping;
        assert.equal(prompt, 'What do you want to dip? [*]');
        assert.equal(game.context.move, 0);
    });
}
for (const choice of ['typed coin', 'coin in full inventory', 'coin in another slot']) {
    void test(`dip rejects a ${choice} and cancels without taking a turn`, async () => {
        freshObjectRoom();
        await addInventoryObject(DAGGER);
        const coins = await addInventoryObject(GOLD_PIECE, { quan: 80 });
        if (choice === 'coin in another slot')
            coins.invlet = 'z';
        const input = resetInputState();
        input.feed('dip\n');
        const dipping = rhack('#'.charCodeAt(0));
        try {
            await answerPrompts(dipping, input, choice === 'coin in full inventory' ? [
                { prompt: /What do you want to dip\?/, keys: '*' },
                { prompt: /80 gold pieces/, keys: coins.invlet },
            ] : [
                { prompt: /What do you want to dip\?/, keys: coins.invlet },
            ]);
        }
        catch (error) {
            input.feed('\x1b\x1b');
            await dipping;
            throw error;
        }
        assert.equal(game._pending_message, 'You cannot dip gold.');
        assert.equal(game.context.move, 0);
        assert.equal(game.inventory.includes(coins), true);
        assert.equal(coins.quan, 80);
    });
}
//# sourceMappingURL=dip_selection.test.js.map