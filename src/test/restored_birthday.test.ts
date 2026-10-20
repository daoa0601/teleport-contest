import assert from 'node:assert/strict';
import test from 'node:test';
import { game } from '../js/gstate.js';
import { restoreGame, saveGame } from '../js/save.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';

// 2002-01-12 07:00 EST, as a fixed-clock game started at 08:00 during
// daylight saving time records it.
const WINTER_BIRTHDAY = Date.UTC(2002, 0, 12, 12) / 1000;

async function restoredBirthdayAt(now: number): Promise<number | undefined> {
    freshObjectRoom();
    game.ubirthday = WINTER_BIRTHDAY;
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    test.mock.method(Date, 'now', () => now);
    try {
        assert.equal(restoreGame(game.plname, storage), true);
    } finally {
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

void test('a birth year before 1970 is restored in the 2000s like the saved two-digit year', async () => {
    freshObjectRoom();
    game.ubirthday = Date.UTC(1960, 0, 12, 12) / 1000;
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    test.mock.method(Date, 'now', () => Date.UTC(2026, 11, 20, 12));
    try {
        assert.equal(restoreGame(game.plname, storage), true);
    } finally {
        test.mock.restoreAll();
    }
    assert.equal(game.ubirthday, Date.UTC(2060, 0, 12, 12) / 1000);
});

void test('an unrepresentable saved birth time is rejected before the live game changes', async () => {
    freshObjectRoom();
    const level = game.level;
    game.ubirthday = Number.MAX_SAFE_INTEGER;
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    game.ubirthday = WINTER_BIRTHDAY;

    assert.equal(restoreGame(game.plname, storage), false);

    assert.equal(game.level, level);
    assert.equal(game.ubirthday, WINTER_BIRTHDAY);
});
