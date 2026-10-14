import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { CHEST, CLUB, DART } from '../js/object_data.js';
import { rhack } from '../js/cmd.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { answerPrompts } from './support/input-boundaries.js';
import { addInventoryObject, floorObject, knownObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';
void test('the both action still offers putting in after a full pack stops taking out', async () => {
    freshPlayableRoom();
    const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (const letter of letters)
        await addInventoryObject(DART, { invlet: letter, nomerge: true });
    const dart = game.inventory[0];
    assert.ok(dart);
    const chest = await floorObject(CHEST, 10, 10, { initialize: false, olocked: false, cknown: true });
    const club = await knownObject(CLUB, { where: 'contained', container: chest });
    chest.contents = [club];
    const input = resetInputState();
    pushKeys('loot\n');
    await answerPrompts(rhack('#'.charCodeAt(0)), input, [
        { prompt: /Do what with/, keys: 'b' },
        { prompt: /Take out what\?/, keys: 'a\n' },
        { prompt: /knapsack cannot accommodate[\s\S]*--More--/, keys: ' ' },
        { prompt: /Put in what\?/, keys: 'a\n' },
    ]);
    assert.equal(chest.contents.includes(dart), true);
    assert.equal(chest.contents.includes(club), true);
    assert.equal(game.inventory.includes(dart), false);
    assert.equal(game.context.move, 1);
});
//# sourceMappingURL=container_both_refusal.test.js.map