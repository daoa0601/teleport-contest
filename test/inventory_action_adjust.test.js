import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { CLUB, DAGGER } from '../js/object_data.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';
void test('the queued inventory adjustment asks only for the selected item destination', async () => {
    freshObjectRoom();
    const dagger = await addInventoryObject(DAGGER);
    const input = resetInputState();
    input.feed(`${dagger.invlet}i`);
    const inventory = rhack('i'.charCodeAt(0));
    const menuComplete = await Promise.race([
        inventory.then(() => true), input.waitUntilBlocked().then(() => false),
    ]);
    try {
        assert.equal(menuComplete, true, 'the inventory menu closes before adjustment starts');
    }
    finally {
        if (!menuComplete)
            input.feed('\x1b');
        await inventory;
    }
    const adjusting = rhack(0);
    const boundary = await Promise.race([
        input.waitUntilBlocked().then(() => true), adjusting.then(() => false),
    ]);
    try {
        assert.equal(boundary, true, 'selecting the item action waits for its destination letter');
        const topline = requireGameDisplay().grid[0]?.map(cell => cell.ch).join('') ?? '';
        assert.match(topline, /Adjust letter to what/);
        input.feed('z');
        await adjusting;
        assert.equal(dagger.invlet, 'z');
        assert.equal(game.context.move, 0);
    }
    finally {
        input.feed('\x1b');
        await adjusting;
    }
});
void test('collecting a later inventory stack keeps all compatible items in the selected slot', async () => {
    freshObjectRoom();
    await addInventoryObject(DAGGER, { quan: 2, spe: 0 });
    const selected = await knownObject(DAGGER, { quan: 3, spe: 0, where: 'inventory', invlet: 'b' });
    const later = await knownObject(DAGGER, { quan: 4, spe: 0, where: 'inventory', invlet: 'c' });
    game.inventory.push(selected, later);
    const club = await addInventoryObject(CLUB);
    const input = resetInputState();
    await answerPrompts(rhack('i'.charCodeAt(0)), input, [
        { prompt: /Weapons/, keys: 'b' },
        { prompt: /Adjust inventory by assigning new letter/, keys: 'i' },
    ]);
    await answerPrompts(rhack(0), input, [{ prompt: /Adjust letter to what/, keys: 'b' }]);
    const collected = game.inventory.find(object => object.invlet === 'b');
    assert.equal(collected?.otyp, DAGGER);
    assert.equal(collected?.quan, 9);
    assert.equal(game.inventory.length, 2);
    assert.equal(game.inventory.includes(club), true);
    assert.equal(game.context.move, 0);
});
//# sourceMappingURL=inventory_action_adjust.test.js.map