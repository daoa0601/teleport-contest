import assert from 'node:assert/strict';
import test from 'node:test';
import { doquit, finishLivingGame } from '../js/end.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { AMULET_OF_YENDOR, FAKE_AMULET_OF_YENDOR } from '../js/object_data.js';
import { loadScoreRecords } from '../js/score_records.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { memoryStorage } from './support/memory-storage.js';
function endingRoom() {
    freshObjectRoom({ flags: { bones: false, disclose: 'none' }, hero: { urexp: 100 } });
    game.storage = memoryStorage();
    game.iflags.toptenwin = false;
    const input = resetInputState();
    let answers = 0;
    input.display = {
        async readKey() {
            const screen = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            assert.ok(++answers < 10, `Unexpected ending prompt: ${screen}`);
            return (screen.includes('Really quit without saving?') ? 'y' : ' ').charCodeAt(0);
        },
    };
}
void test('a quit score records the real Amulet and ongoing helplessness', async () => {
    endingRoom();
    await addInventoryObject(AMULET_OF_YENDOR);
    game._helplessReason = 'paralyzed by a floating eye';
    game._helplessTurns = 4;
    game.multi = -4;
    await doquit();
    assert.equal(loadScoreRecords()[0]?.death, 'quit (with the Amulet), while paralyzed by a floating eye');
});
void test('an escape score records carrying a fake Amulet', async () => {
    endingRoom();
    await addInventoryObject(FAKE_AMULET_OF_YENDOR);
    await finishLivingGame('escaped');
    assert.equal(loadScoreRecords()[0]?.death, 'escaped (with a fake Amulet)');
});
//# sourceMappingURL=end_score_circumstances.test.js.map