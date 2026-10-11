import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requireGameDisplay } from '../js/gstate.js';
import { pushKey, resetInputState } from '../js/input.js';
import { dodiscovered } from '../js/o_init.js';
import { POT_HEALING, POT_WATER } from '../js/object_data.js';
import { recordObjectKnowledge, recordObjectPriceQuote } from '../js/object_knowledge.js';
import { restoreGame, saveGame } from '../js/save.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
async function discoveryText() {
    const input = resetInputState();
    const showing = dodiscovered();
    await input.waitUntilBlocked();
    const text = requireGameDisplay()
        .grid.map((row) => row.map((cell) => cell.ch).join(''))
        .join('\n');
    pushKey(' ');
    await showing;
    return text;
}
void test('save and restore retain only observed shop prices and keep extending their ranges', async () => {
    freshObjectRoom();
    game.plname = 'Price memory';
    recordObjectKnowledge(POT_HEALING);
    recordObjectKnowledge(POT_WATER);
    recordObjectPriceQuote(POT_HEALING, 36, 'buy');
    recordObjectPriceQuote(POT_HEALING, 24, 'buy');
    recordObjectPriceQuote(POT_WATER, 8, 'sell');
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    freshObjectRoom();
    assert.equal(restoreGame('Price memory', storage), true);
    const restored = await discoveryText();
    assert.match(restored, /potion of healing[^\n]*\{buy 24-36\}/);
    assert.match(restored, /potion of water[^\n]*\{sell 8\}/);
    recordObjectPriceQuote(POT_HEALING, 20, 'buy');
    recordObjectPriceQuote(POT_HEALING, 5, 'sell');
    recordObjectPriceQuote(POT_HEALING, 9, 'sell');
    const updated = await discoveryText();
    assert.match(updated, /potion of healing[^\n]*\{buy 20-36 sell 5-9\}/);
    assert.match(updated, /potion of water[^\n]*\{sell 8\}/);
});
//# sourceMappingURL=object_price_quote.test.js.map