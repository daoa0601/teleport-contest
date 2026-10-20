import assert from 'node:assert/strict';
import test from 'node:test';
import { game } from '../js/gstate.js';
import { restoreGame, saveGame } from '../js/save.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
// 2002-01-12 07:00 EST, as a fixed-clock game started at 08:00 during
// daylight saving time records it.
const WINTER_BIRTHDAY = Date.UTC(2002, 0, 12, 12) / 1000;
async function restoredBirthdayAt(now) {
    freshObjectRoom();
    game.ubirthday = WINTER_BIRTHDAY;
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    test.mock.method(Date, 'now', () => now);
    try {
        assert.equal(restoreGame(game.plname, storage), true);
    }
    finally {
        test.mock.restoreAll();
    }
    return game.ubirthday;
}
void test('a winter birth time restored during daylight saving loses an hour', async () => {
    assert.equal(await restoredBirthdayAt(Date.UTC(2026, 9, 20, 12)), WINTER_BIRTHDAY - 3600);
});
void test('a winter birth time restored during standard time is unchanged', async () => {
    assert.equal(await restoredBirthdayAt(Date.UTC(2026, 11, 20, 12)), WINTER_BIRTHDAY);
});
//# sourceMappingURL=restored_birthday.test.js.map