import assert from 'node:assert/strict';
import test from 'node:test';
import { DUST } from '../js/const.js';
import { engravingAt, makeEngravingAt, wipeEngravingAt } from '../js/engrave.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { saveGame, restoreGame } from '../js/save.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
void test('saving rewinds the worn engraving pointer, and restoring skips its erased prefix', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const engraving = makeEngravingAt(12, 10, '   a warning!', null, 0, DUST);
    assert.ok(engraving);
    wipeEngravingAt(12, 10, 0);
    assert.equal(engraving.text, 'a warning!');
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    assert.equal(engraving.text, '   a warning!', 'native save_engravings resets the live pointer to the buffer start');
    assert.equal(restoreGame(game.plname, storage), true);
    assert.equal(engravingAt(12, 10)?.text, 'a warning!');
    assert.equal(engravingAt(12, 10)?.pristine, '   a warning!');
});
//# sourceMappingURL=engraving_save_pointer.test.js.map