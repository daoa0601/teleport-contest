import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { HOLE, PANICLOG, PIT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { finishScheduledLevelChange } from '../js/level_change.js';
import { unlinkObject } from '../js/object_location.js';
import { punishHero } from '../js/punishment.js';
import { initRng } from '../js/rng.js';
import { loadScoreRecords } from '../js/score_records.js';
import { addInventoryItem } from '../js/u_init.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { addTrap } from './support/level-state.js';
import { memoryStorage } from './support/memory-storage.js';
function fatalFallLevels() {
    const levels = freshConnectedLevels();
    requirePlayingGame(game);
    game.u.uhp = 1;
    game.u.uhpmax = 100;
    game.flags.bones = false;
    game.flags.disclose = '-i -a -v -c -o';
    game.flags.tombstone = false;
    game.iflags.toptenwin = false;
    game.storage = memoryStorage();
    pushKeys(' '.repeat(100));
    return levels;
}
void test('a fatal ball blow after walking into a hole uses its complete death description', async () => {
    const { source } = fatalFallLevels();
    await punishHero();
    addTrap(source, HOLE, 11, 10);
    initRng(1n);
    await rhack('l'.charCodeAt(0));
    await finishScheduledLevelChange();
    assert.equal(game.program_state.gameover, true);
    assert.equal(loadScoreRecords()[0]?.death, 'crunched in the head by an iron ball');
});
void test('a fatal downstairs pull uses its complete death description', async () => {
    fatalFallLevels();
    await punishHero();
    const ball = game.uball;
    assert.ok(ball);
    unlinkObject(ball);
    await addInventoryItem(ball);
    initRng(1n);
    await rhack('>'.charCodeAt(0));
    assert.equal(game.program_state.gameover, true);
    assert.equal(loadScoreRecords()[0]?.death, 'dragged downstairs by an iron ball');
});
void test('a fatal ball blow in a pit finishes the move without placing the cleaned-up pair again', async () => {
    const { source } = fatalFallLevels();
    requirePlayingGame(game);
    game.u.uhp = 10;
    const storage = memoryStorage();
    game.storage = storage;
    await punishHero();
    addTrap(source, PIT, 11, 10);
    initRng(2n);
    await rhack('l'.charCodeAt(0));
    assert.equal(game.program_state.gameover, true);
    assert.equal(storage.getItem(PANICLOG), null, 'a fatal pit landing must not report a placement error');
});
//# sourceMappingURL=ball_fall_death.test.js.map