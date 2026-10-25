import assert from 'node:assert/strict';
import test from 'node:test';
import { restoregamePreamble } from '../js/allmain.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { restoreGame, saveGame } from '../js/save.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
for (const mode of ['wizard', 'explore']) {
    for (const answer of ['y', 'n']) {
        void test(`${mode} recovery ${answer === 'y' ? 'keeps' : 'discards'} its save only after the keep-file answer`, async () => {
            freshObjectRoom({ flags: { debug: mode === 'wizard', explore: mode === 'explore' } });
            game.plname = 'Keeper';
            const storage = memoryStorage();
            assert.equal(await saveGame(storage), true);
            assert.equal(restoreGame(game.plname, storage), true);
            const key = 'teleport-save:keeper';
            assert.notEqual(storage.getItem(key), null, 'Special-mode saves remain until the player answers');
            const input = resetInputState();
            let questions = 0;
            let reads = 0;
            input.beforeRead = () => {
                assert.ok(++reads < 8, `Unexpected restore prompt: ${game._pending_message}`);
                if (game._pending_message.includes('Do you want to keep the save file?')) {
                    assert.notEqual(storage.getItem(key), null, 'The snapshot still exists at the question');
                    questions++;
                    input.feed(answer);
                }
                else {
                    assert.ok(game.nhDisplay?.grid.some(row => row.map(cell => cell.ch).join('').includes('--More--')), `Expected a restore message: ${game._pending_message}`);
                    input.feed(' ');
                }
            };
            await restoregamePreamble();
            assert.equal(questions, 1);
            assert.equal(storage.getItem(key) !== null, answer === 'y');
            assert.equal(game.moves, 40);
        });
    }
}
//# sourceMappingURL=restore_save_retention.test.js.map