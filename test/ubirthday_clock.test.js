import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { runSegment } from '../js/jsmain.js';
import { memoryStorage } from './support/memory-storage.js';
import { saveGame, restoreGame } from '../js/save.js';
const FIXED_DATETIME = '20250101120000';
// Independent statement of the pinned recorder's C rule: the fixed winter
// calendar '2025-01-01 12:00:00' is interpreted as New York wall time
// using the offset INHERITED from the wall clock at conversion time, not
// the fixed date's own DST.  The stubbed summer instant below sits in EDT
// (UTC-4), so noon in New York becomes 16:00 UTC; an implementation that
// wrongly applied the winter date's EST would produce 17:00 and fail.
const EXPECTED_BIRTHDAY = Date.UTC(2025, 0, 1, 16, 0, 0) / 1000;
async function startNewGame({ datetime = '' } = {}) {
    await runSegment({
        seed: 1234,
        datetime,
        nethackrc: [
            'OPTIONS=name:Clockwatcher,role:Archeologist,race:human,gender:male,align:neutral',
            'OPTIONS=!legacy,!tutorial,!autopickup,pettype:none',
        ].join('\n'),
        moves: '',
        storage: memoryStorage(),
    });
    requirePlayingGame(game);
    assert.ok(game.ubirthday !== undefined);
    return game.ubirthday;
}
void test('a fixed session datetime sets the birthday by the known C rule', async (context) => {
    context.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2025, 6, 15, 18, 30) });
    const birthday = await startNewGame({ datetime: FIXED_DATETIME });
    assert.equal(birthday, EXPECTED_BIRTHDAY);
    assert.ok(Number.isInteger(birthday));
});
void test('a live session sets the birthday to the current epoch', async (context) => {
    const now = Date.UTC(2025, 6, 15, 18, 30);
    context.mock.timers.enable({ apis: ['Date'], now });
    const birthday = await startNewGame({ datetime: '' });
    assert.equal(birthday, now / 1000);
});
void test('restoring reads the birthday back from its saved local-time text', async (context) => {
    const now = Date.UTC(2025, 6, 15, 18, 30);
    context.mock.timers.enable({ apis: ['Date'], now });
    const birthday = await startNewGame({ datetime: FIXED_DATETIME });
    requirePlayingGame(game);
    game.plname = 'Clockwatcher';
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    // An hour passes before the player restores.
    context.mock.timers.setTime(now + 3600 * 1000);
    assert.equal(restoreGame('Clockwatcher', storage), true);
    // C saves 11:00 EST text for the winter birthday and reads it back
    // with the inherited summer EDT offset: an hour earlier.
    assert.equal(game.ubirthday, birthday - 3600);
});
//# sourceMappingURL=ubirthday_clock.test.js.map