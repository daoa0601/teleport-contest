import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { runExtendedCommand } from './support/commands.js';
import { freshGameplayRoom } from './support/playable-room.js';
for (const [command, prompt] of [
    ['panic', 'Do you want to call panic() and end your game?'],
    ['debugfuzzer', 'Do you want to start fuzz testing?'],
]) {
    void test(`declining #${command} keeps the game active without taking time`, async () => {
        freshGameplayRoom({ flags: { debug: true, suppress_alert: '3.7.0' } });
        requirePlayingGame(game);
        const messages = [];
        resetInputState().beforeRead = () => { messages.push(game._pending_message); };
        await runExtendedCommand(command, 'no\n');
        assert.ok(messages.some(message => message.includes(prompt)), `Missing confirmation: ${prompt}`);
        assert.equal(!!game.program_state.gameover, false);
        assert.equal(game.iflags.debug_fuzzer ?? false, false);
        assert.equal(game.context.move, 0);
    });
}
//# sourceMappingURL=wizard_safety_commands.test.js.map