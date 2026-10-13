import { loadScoreRecords } from '../js/score_records.js';
import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { doquit, finishLivingGame, finishOrdinaryQuit, SCORE_RECORD_STORAGE_KEY, } from '../js/end.js';
import { game } from '../js/gstate.js';
import { pushKey, resetInputState } from '../js/input.js';
import { answerPrompts } from './support/input-boundaries.js';
import { PanicTermination } from '../js/panic_termination.js';
import { initRng } from '../js/rng.js';
import { addInventoryItem } from '../js/u_init.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { unopenedCatBox } from './support/game-objects.js';
import { memoryStorage } from './support/memory-storage.js';
function gameReadyToEnd() {
    freshConnectedLevels();
    requireFixtureGame(game);
    game.storage = memoryStorage();
    game.flags.disclose = '-i -a -v -c -o';
    game.u.ulevel = 8;
    game.u.urexp = 100;
}
void test('wizard quit asks about a core dump before disclosures and q suppresses them', async () => {
    gameReadyToEnd();
    game.flags.debug = true;
    game.flags.disclose = '';
    const input = resetInputState();
    await answerPrompts(doquit(), input, [
        { prompt: /Really quit without saving\?/, keys: 'y' },
        { prompt: /Dump core\? \[ynq\] \(q\)/, keys: 'q' },
    ]);
    assert.equal(game.program_state.gameover, true);
    assert.equal(game.program_state.stopprint, 1);
    assert.equal(game.storage?.getItem(SCORE_RECORD_STORAGE_KEY), null);
});
void test('declining a wizard core dump continues to ordinary disclosures', async () => {
    gameReadyToEnd();
    game.flags.debug = true;
    game.flags.disclose = '';
    const input = resetInputState();
    await answerPrompts(doquit(), input, [
        { prompt: /Really quit without saving\?/, keys: 'y' },
        { prompt: /Dump core\?/, keys: 'n' },
        { prompt: /Do you want to see your attributes\?/, keys: 'q' },
    ]);
    assert.equal(game.program_state.gameover, true);
});
void test('requesting a wizard core dump terminates before ordinary scoring', async () => {
    gameReadyToEnd();
    game.flags.debug = true;
    const input = resetInputState();
    await assert.rejects(answerPrompts(doquit(), input, [
        { prompt: /Really quit without saving\?/, keys: 'y' },
        { prompt: /Dump core\?/, keys: 'y' },
    ]), PanicTermination);
    assert.equal(game.program_state.windows_exited, true);
    assert.equal(game.storage?.getItem(SCORE_RECORD_STORAGE_KEY), null);
});
void test('final disclosure resolves a dead cat before calculating escape points', async () => {
    gameReadyToEnd();
    requireFixtureGame(game);
    const box = await addInventoryItem(await unopenedCatBox());
    initRng(1n);
    pushKey(27);
    await finishLivingGame('escaped');
    assert.equal(box.spe, 0);
    assert.equal(game.u.uexp, 20);
    assert.ok(game.storage !== null && game.storage !== undefined);
    const records = loadScoreRecords();
    assert.ok(records[0]);
    assert.equal(records[0].points, 190);
    assert.equal(records[0].outcome, 'escaped');
});
void test('quitting disclosure early still records the completed game', async () => {
    gameReadyToEnd();
    requireFixtureGame(game);
    game.flags.disclose = '';
    pushKey('q');
    await finishOrdinaryQuit();
    assert.ok(game.storage !== null && game.storage !== undefined);
    const records = loadScoreRecords();
    assert.ok(records[0]);
    assert.equal(records[0].outcome, 'quit');
    assert.equal(records[0].points, 100);
});
void test('an explore-mode game does not enter the high scores', async () => {
    gameReadyToEnd();
    requireFixtureGame(game);
    game.flags.explore = true;
    pushKey(27);
    await finishOrdinaryQuit();
    assert.ok(game.storage !== null && game.storage !== undefined);
    assert.equal(game.storage.getItem(SCORE_RECORD_STORAGE_KEY), null);
});
//# sourceMappingURL=game_end.test.js.map