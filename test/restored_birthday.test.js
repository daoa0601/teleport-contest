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
    await freshObjectRoom();
    game.ubirthday = WINTER_BIRTHDAY;
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    test.mock.method(Date, 'now', () => now);
    try {
        assert.equal(await restoreGame(game.plname, storage), true);
    }
    finally {
        test.mock.restoreAll();
    }
    return game.ubirthday;
}
for (const [season, now] of [['summer', Date.UTC(2026, 9, 20, 12)], ['winter', Date.UTC(2026, 11, 20, 12)]]) {
    void test(`a winter birth time restored in ${season} loses an hour to the recorder's daylight clock`, async () => {
        assert.equal(await restoredBirthdayAt(now), WINTER_BIRTHDAY - 3600);
    });
}
void test('a birth year before 1970 is restored in the 2000s like the saved two-digit year', async () => {
    await freshObjectRoom();
    game.ubirthday = Date.UTC(1960, 0, 12, 12) / 1000;
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    assert.equal(await restoreGame(game.plname, storage), true);
    // Saved as 07:00 EST text, read back with the recorder's daylight offset.
    assert.equal(game.ubirthday, Date.UTC(2060, 0, 12, 11) / 1000);
});
void test('an unrepresentable saved birth time is rejected before the live game changes', async () => {
    await freshObjectRoom();
    const level = game.level;
    game.ubirthday = Number.MAX_SAFE_INTEGER;
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    game.ubirthday = WINTER_BIRTHDAY;
    assert.equal(await restoreGame(game.plname, storage), false);
    assert.equal(game.level, level);
    assert.equal(game.ubirthday, WINTER_BIRTHDAY);
});
//# sourceMappingURL=restored_birthday.test.js.map