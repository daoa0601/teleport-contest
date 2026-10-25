import { requireScreenRow } from './support/screen.js';
import { requirePlayingGame, requireGameDisplay } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { flush_screen } from '../js/display.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { doquit } from '../js/end.js';
import { dosave, saveGame } from '../js/save.js';
import { decodeSavedGame } from '../js/persistent_state_validation.js';
import { freshObjectRoom } from './support/object-room.js';
import { memoryStorage } from './support/memory-storage.js';
function messageRow() {
    const row = requireScreenRow(0);
    assert.ok(row);
    return row.map(cell => cell.ch).join('').trim();
}
function freshConfirmation() {
    freshObjectRoom();
    requirePlayingGame(game);
    game.plname = 'Confirmation';
    game.storage = memoryStorage();
    return resetInputState();
}
for (const answer of ['n', 'y']) {
    void test(`${answer === 'y' ? 'accepting' : 'refusing'} overwrite keeps the requested save snapshot`, async () => {
        const input = freshConfirmation();
        assert.equal(await saveGame(), true);
        game.moves += 5;
        game.program_state.something_worth_saving = true;
        let reads = 0;
        input.beforeRead = () => {
            assert.ok(++reads < 7, `Unexpected save prompt: ${game._pending_message}`);
            if (messageRow().includes('--More--')) {
                assert.match(game._pending_message, /old save file|Overwrite/);
                input.feed(' ');
            }
            else if (game._pending_message.includes('Really save?')) {
                input.feed('y');
            }
            else {
                assert.match(game._pending_message, /Overwrite the old file\?/);
                input.feed(answer);
            }
        };
        await dosave();
        const encoded = game.storage?.getItem('teleport-save:confirmation');
        assert.ok(encoded);
        assert.equal(decodeSavedGame(encoded).state.moves, answer === 'y' ? 45 : 40);
        assert.equal(!!game.program_state.gameover, answer === 'y');
        assert.equal(game.context.move, 0);
        assert.equal(game.program_state.saving, 0, 'A refused overwrite must end save processing');
    });
}
for (const [name, answer] of [
    ['no', 'n'], ['Escape', '\x1b'], ['Space', ' '],
    ['Enter', '\n'], ['an invalid key followed by no', 'xN'],
]) {
    void test(`declining save with ${name} clears the question and keeps play running`, async () => {
        const input = freshConfirmation();
        requirePlayingGame(game);
        const saving = rhack('S'.charCodeAt(0));
        await input.waitUntilBlocked();
        try {
            assert.match(messageRow(), /Really save\?/);
        }
        finally {
            input.feed(answer);
            await saving;
        }
        await flush_screen(1);
        assert.equal(messageRow(), '', 'the answered save question must leave a blank message row');
        assert.ok(game.storage != null, 'Expected game.storage to be initialized');
        assert.equal(game.storage.getItem('teleport-save:confirmation'), null);
        assert.equal(!!game.program_state.gameover, false);
        assert.equal(game.context.move, 0);
        assert.equal(game.moves, 40);
    });
}
void test('confirming save writes the game and exits with the native goodbye', async () => {
    const input = freshConfirmation();
    requirePlayingGame(game);
    input.feed('y');
    await rhack('S'.charCodeAt(0));
    assert.ok(game.storage != null, 'Expected game.storage to be initialized');
    assert.ok(game.storage.getItem('teleport-save:confirmation'));
    assert.equal(game.program_state.gameover, true);
    assert.equal(game.u.uhp, -1);
    // C save.c:dosave() shows "Saving...", then exit_nhwindows("Be seeing
    // you...") clears the screen and raw-prints the goodbye line; the
    // newline of that puts() leaves the cursor on the following row.
    assert.equal(game.program_state.windows_exited, true);
    assert.equal(messageRow(), 'Be seeing you...');
    const display = requireGameDisplay();
    assert.equal(requireScreenRow(1).map(cell => cell.ch).join('').trimEnd(), '');
    assert.deepEqual([display.cursorCol, display.cursorRow], [0, 1]);
});
void test('declining a counted save stops voluntary repetition without spending a turn', async () => {
    const input = freshConfirmation();
    requirePlayingGame(game);
    game.multi = 4;
    input.feed('n');
    await dosave();
    assert.equal(game.multi, 0);
    assert.equal(game.moves, 40);
});
for (const multi of [0, 4, -4]) {
    void test(`declining quit clears its question and applies native cancellation for multi ${multi}`, async () => {
        const input = freshConfirmation();
        requirePlayingGame(game);
        game.multi = multi;
        game.u.invulnerable = true;
        game.u.usleep = 1;
        input.feed('n');
        await doquit();
        await flush_screen(1);
        assert.equal(messageRow(), '', 'the rejected quit question must leave a blank message row');
        assert.equal(game.multi, multi < 0 ? multi : 0);
        assert.equal(game.u.invulnerable, multi < 0);
        assert.equal(game.u.usleep, multi < 0 ? 1 : 0);
        assert.equal(!!game.program_state.gameover, false);
        assert.equal(game.moves, 40);
    });
}
//# sourceMappingURL=save_confirmation.test.js.map