import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { nhgetch, resetInputState } from '../js/input.js';
import { readCommandInput } from '../js/command_input.js';
import { applyNethackrc } from '../js/options.js';
import { initRng } from '../js/rng.js';
import { PanicTermination } from '../js/panic_termination.js';
import { runExtendedCommand } from './support/commands.js';
import { freshGameplayRoom } from './support/playable-room.js';
import { installPagerInput } from './support/pager-input.js';
void test('accepting #panic terminates the command through the panic handler', async () => {
    freshGameplayRoom({ flags: { debug: true } });
    const input = resetInputState();
    installPagerInput(input, { expected: /Oops/, limit: 2 });
    await assert.rejects(runExtendedCommand('panic', 'yes\n'), new PanicTermination('Crash test (#panic).'));
    assert.equal(game.program_state.panicking, 1);
    assert.equal(game.program_state.windows_exited, true);
    const text = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
    assert.match(text, /Crash test \(#panic\)\./);
});
for (const [answer, mode] of [['n', 2], ['y', 1]]) {
    void test(`accepting #debugfuzzer asks about impossible() and selects mode ${mode}`, async () => {
        freshGameplayRoom({ flags: { debug: true, suppress_alert: '3.7.0' } });
        const questions = [];
        const input = resetInputState();
        input.beforeRead = () => { questions.push(game._pending_message); };
        await runExtendedCommand('debugfuzzer', `yes\n${answer}`);
        assert.ok(questions.some(question => question.includes('Do you want to call panic() after impossible()?')), 'The second confirmation must choose how impossible() is handled');
        assert.equal(game.flags.debug_fuzzer, mode);
        assert.equal(game.iflags.debug_fuzzer, true);
        assert.equal(game.context.move, 0);
        // Once enabled, fuzzing supplies keys without consuming user input.
        input.display = { readKey: () => { throw new Error('Fuzzing must not read the keyboard'); } };
        const key = await nhgetch();
        assert.ok(Number.isInteger(key) && key !== 0 && key >= -128 && key <= 127);
    });
}
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
void test('#debugfuzzer supplies a literal Escape command when altmeta is enabled', async () => {
    freshGameplayRoom({ flags: { debug: true, suppress_alert: '3.7.0' } });
    applyNethackrc('OPTIONS=altmeta');
    await runExtendedCommand('debugfuzzer', 'yes\nn');
    // This fresh random stream starts with an Escape choice.
    initRng(24);
    const command = await readCommandInput();
    assert.equal(command.key, 27, 'Generated Escape cancels instead of starting a Meta command');
    assert.equal(command.count, 0);
});
//# sourceMappingURL=wizard_safety_commands.test.js.map