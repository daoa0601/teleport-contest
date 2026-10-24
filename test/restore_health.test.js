import test from 'node:test';
import assert from 'node:assert/strict';
import { GameDisplay } from '../js/game_display.js';
import { game, resetGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { decodeSavedGame } from '../js/persistent_state_validation.js';
import { initRng, rn2 } from '../js/rng.js';
import { initializeRoleQuestGenders } from '../js/startup.js';
import { dismissUnhealthyRestore, restoreGame, restoreRefusedAsUnhealthy, saveGame, } from '../js/save.js';
import { encodeSavedGraph } from '../js/saved_graph.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { memoryStorage } from './support/memory-storage.js';
// C restore.c:restgamestate() refuses a save whose hero was not healthy
// enough to survive restoration. The refusal is a normal You() message, and
// dorecover() spends a dismissal key on display_nhwindow(WIN_MESSAGE, TRUE)
// before discarding the save file and starting a new game.
void test('a dead hero is refused at restore, one key dismisses the message, and the save is discarded', async () => {
    initRng(6103);
    freshObjectRoom({ role: 'wizard' });
    game.plname = game.displayName = 'Ill';
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    const key = 'teleport-save:ill';
    const snapshot = decodeSavedGame(storage.getItem(key) ?? '');
    snapshot.state.u.uhp = 0;
    storage.setItem(key, encodeSavedGraph(snapshot));
    resetGame();
    initRng(6103);
    game.nhDisplay = new GameDisplay(null);
    const input = resetInputState();
    installPagerInput(input, { expected: /not healthy enough/, limit: 2 });
    assert.equal(restoreGame('Ill', storage), false);
    assert.equal(restoreRefusedAsUnhealthy(), true, 'The refusal must be reported back to the async caller.');
    assert.notEqual(storage.getItem(key), null, 'C discards the save file only after the message is dismissed.');
    await dismissUnhealthyRestore('Ill', storage);
    assert.equal(storage.getItem(key), null, 'The refused save file is discarded.');
    assert.equal(restoreRefusedAsUnhealthy(), false);
});
// A polymorphed hero runs on its current body's hit points: the save is
// refused only when that body is dead too. Both halves of that boundary are
// C's `u.uhp <= 0 && (!Upolyd || u.mh <= 0)` test.
void test('a polymorphed hero restores only while its current body lives', async () => {
    initRng(6104);
    freshObjectRoom({ role: 'wizard' });
    game.plname = game.displayName = 'Poly';
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    const key = 'teleport-save:poly';
    const original = decodeSavedGame(storage.getItem(key) ?? '');
    const littleDog = MONSTER_NAME.indexOf('little dog');
    const livingBody = structuredClone(original);
    livingBody.state.u.uhp = 0;
    livingBody.state.u.umonnum = littleDog;
    livingBody.state.u.mh = 5;
    storage.setItem(key, encodeSavedGraph(livingBody));
    resetGame();
    initRng(6104);
    game.nhDisplay = new GameDisplay(null);
    assert.equal(restoreGame('Poly', storage), true);
    assert.equal(restoreRefusedAsUnhealthy(), false);
    // C dorecover() deletes the save file after a successful restore.
    assert.equal(storage.getItem(key), null, 'A successful restore consumes the save file.');
    const deadBody = structuredClone(original);
    deadBody.state.u.uhp = 0;
    deadBody.state.u.umonnum = littleDog;
    deadBody.state.u.mh = 0;
    storage.setItem(key, encodeSavedGraph(deadBody));
    resetGame();
    initRng(6104);
    game.nhDisplay = new GameDisplay(null);
    const input = resetInputState();
    installPagerInput(input, { expected: /not healthy enough/, limit: 2 });
    assert.equal(restoreGame('Poly', storage), false);
    assert.equal(restoreRefusedAsUnhealthy(), true);
    await dismissUnhealthyRestore('Poly', storage);
    assert.equal(storage.getItem(key), null);
});
// C restgamestate() reads the saved flags and runs role_init() before the
// health check, so the quest-figure gender rolls are spent even when the
// save is refused; every later random call in the new game follows them.
void test("a refused restore spends role_init's quest gender rolls first", async () => {
    initRng(6105);
    freshObjectRoom({
        role: 'wizard',
        hero: { ualignbase: [0, 0] },
        flags: { female: false, initgend: 0 },
    });
    game.plname = game.displayName = 'Refused';
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    const key = 'teleport-save:refused';
    const snapshot = decodeSavedGame(storage.getItem(key) ?? '');
    snapshot.state.u.uhp = 0;
    storage.setItem(key, encodeSavedGraph(snapshot));
    resetGame();
    game.nhDisplay = new GameDisplay(null);
    initRng(6105);
    assert.equal(restoreGame('Refused', storage), false);
    const afterRefusal = rn2(1000);
    initRng(6105);
    // A Wizard's nemesis has no fixed gender, so role_init() rolls it.
    game.urole = snapshot.state.urole;
    initializeRoleQuestGenders();
    assert.equal(afterRefusal, rn2(1000), "The refusal must leave the stream exactly past role_init()'s rolls.");
});
//# sourceMappingURL=restore_health.test.js.map