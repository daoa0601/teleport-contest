import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { applyNethackrc } from '../js/options.js';
import { bindInputGate, InputGate, nhgetch, pushKeys } from '../js/input.js';
import { promptKey } from '../js/tty_prompts.js';
import { restoreGame, saveGame } from '../js/save.js';
import { memoryStorage } from './support/memory-storage.js';
import { continueCountedCommand, rhack } from '../js/cmd.js';
import { readCommandInput } from '../js/command_input.js';
import { freshGameplayRoom } from './support/playable-room.js';
async function waitActions() {
    assert.equal(game.context.move, 1, 'the command after the count must execute');
    let actions = 1;
    while (await continueCountedCommand()) {
        actions++;
        assert.ok(actions <= 20, 'counted waiting must finish');
    }
    return actions;
}
void test('a count and its command are read in one command transaction', async () => {
    freshGameplayRoom();
    pushKeys('3.');
    await rhack(0);
    assert.equal(await waitActions(), 3);
});
void test('backspace edits a count before the command executes', async () => {
    freshGameplayRoom();
    pushKeys('12\b3.');
    await rhack(0);
    assert.equal(await waitActions(), 13);
});
void test('deleting the whole count permits an ordinary uncounted command', async () => {
    freshGameplayRoom();
    pushKeys('2\x7f.');
    await rhack(0);
    assert.equal(await waitActions(), 1);
});
void test('number-pad counts use the configured count prefix', async () => {
    freshGameplayRoom();
    game.commandBindings.setNumberPad(1);
    game.commandBindings.bindSpecialKey('v'.charCodeAt(0), 'count');
    pushKeys('v3.');
    await rhack(0);
    assert.equal(await waitActions(), 3);
});
void test('digits remain count input even when bound to a command with the keypad off', async () => {
    freshGameplayRoom();
    game.commandBindings.bindKey('3'.charCodeAt(0), 'wait');
    pushKeys('3.');
    await rhack(0);
    assert.equal(await waitActions(), 3);
});
void test('a count before the request-menu prefix does not count its target', async () => {
    freshGameplayRoom();
    pushKeys('3m.');
    await rhack(0);
    assert.equal(await waitActions(), 1);
});
void test('a count after the request-menu prefix counts its target', async () => {
    freshGameplayRoom();
    pushKeys('m3.');
    await rhack(0);
    assert.equal(await waitActions(), 3);
});
void test('count editing displays the native limit and the empty count', async () => {
    freshGameplayRoom();
    const toplines = [];
    const display = game.nhDisplay;
    assert.ok(display);
    const gate = new InputGate({ beforeRead() {
            const topRow = display.grid[0];
            assert.ok(topRow);
            toplines.push(topRow.map(cell => cell.ch).join('').trimEnd());
        } });
    bindInputGate(gate);
    gate.feed('999999\b\b\b\b\b\x1b');
    await rhack(0);
    assert.ok(toplines.includes('Count: 32767'));
    assert.ok(toplines.includes('Count:'));
    assert.equal(game.context.move, 0);
});
void test('altmeta lets a counted command use an Escape-prefixed meta binding', async () => {
    freshGameplayRoom();
    applyNethackrc('OPTIONS=altmeta');
    game.commandBindings.bindKey(128 | 'x'.charCodeAt(0), 'wait');
    pushKeys('3\x1bx');
    await rhack(0);
    assert.equal(await waitActions(), 3);
});
void test('altmeta also applies after the keypad count prefix', async () => {
    freshGameplayRoom();
    applyNethackrc('OPTIONS=number_pad:1,altmeta');
    game.commandBindings.bindKey(128 | 'x'.charCodeAt(0), 'wait');
    pushKeys('n3\x1bx');
    await rhack(0);
    assert.equal(await waitActions(), 3);
});
void test('two Escapes cancel a count when altmeta is enabled', async () => {
    freshGameplayRoom();
    applyNethackrc('OPTIONS=altmeta');
    pushKeys('3\x1b\x1b.');
    await rhack(0);
    assert.equal(game.context.move, 0);
    await rhack(0);
    assert.equal(await waitActions(), 1);
});
void test('without altmeta Escape cancels and leaves the next command unread', async () => {
    freshGameplayRoom();
    pushKeys('3\x1b.');
    await rhack(0);
    assert.equal(game.context.move, 0);
    await rhack(0);
    assert.equal(await waitActions(), 1);
});
void test('the first digit keeps the old message, then count edits move the input cursor', async () => {
    freshGameplayRoom();
    game._pending_message = 'A familiar message.';
    const gate = new InputGate();
    bindInputGate(gate);
    const command = rhack(0);
    const display = game.nhDisplay;
    assert.ok(display);
    const topline = () => {
        const row = display.grid[0];
        assert.ok(row);
        return row.map(cell => cell.ch).join('').trimEnd();
    };
    await gate.waitUntilBlocked();
    assert.equal(topline(), 'A familiar message.');
    gate.feed('1');
    await gate.waitUntilBlocked();
    assert.equal(topline(), 'A familiar message.');
    gate.feed('2');
    await gate.waitUntilBlocked();
    assert.equal(topline(), 'Count: 12');
    assert.equal(display.cursorCol, 'Count: 12'.length);
    assert.equal(display.cursorRow, 0);
    gate.feed('\b');
    await gate.waitUntilBlocked();
    assert.equal(topline(), 'Count: 1');
    assert.equal(display.cursorCol, 'Count: 1'.length);
    gate.feed('3');
    await gate.waitUntilBlocked();
    assert.equal(topline(), 'Count: 13');
    assert.equal(display.cursorCol, 'Count: 13'.length);
    gate.feed('.');
    await command;
    assert.equal(topline(), '');
});
void test('ordinary prompts keep a literal Escape while altmeta is enabled', async () => {
    freshGameplayRoom();
    applyNethackrc('OPTIONS=altmeta');
    pushKeys('\x1bx');
    assert.equal(await promptKey('Continue?'), 27);
    assert.equal(await nhgetch(), 'x'.charCodeAt(0));
});
void test('TTY NUL input cancels instead of dispatching a command', async () => {
    freshGameplayRoom();
    pushKeys('3\0.');
    await rhack(0);
    assert.equal(game.context.move, 0);
    assert.equal(game._pending_message, '');
    await rhack(0);
    assert.equal(await waitActions(), 1);
});
void test('a literal byte 255 is discarded at the command boundary', async () => {
    freshGameplayRoom();
    pushKeys('\xff.');
    await rhack(0);
    assert.equal(game.context.move, 0);
    assert.equal(game._pending_message, '');
    await rhack(0);
    assert.equal(await waitActions(), 1);
});
void test('restore keeps the current altmeta input policy', async () => {
    freshGameplayRoom();
    game.plname = 'CountInput';
    applyNethackrc('OPTIONS=!altmeta');
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    applyNethackrc('OPTIONS=altmeta');
    game.commandBindings.bindKey(128 | 'x'.charCodeAt(0), 'wait');
    assert.equal(restoreGame('CountInput', storage), true);
    pushKeys('3\x1bx');
    await rhack(0);
    assert.equal(await waitActions(), 3);
});
void test('an unbound meta command is reported using its visible key notation', async () => {
    freshGameplayRoom();
    applyNethackrc('OPTIONS=altmeta');
    game.commandBindings.bindKey(128 | 'x'.charCodeAt(0), 'nothing');
    pushKeys('\x1bx');
    await rhack(0);
    assert.equal(game._pending_message, "Unknown command 'M-x'.");
});
for (const input of ['\x1bx', '\xf8']) {
    void test(`a meta-bound keypad count prefix accepts ${input.length === 1 ? 'a meta byte' : 'an Escape sequence'}`, async () => {
        freshGameplayRoom();
        applyNethackrc('OPTIONS=number_pad:1,altmeta\nBIND=M-x:count');
        pushKeys(input + '3.');
        await rhack(0);
        assert.equal(await waitActions(), 3);
    });
}
void test('altmeta byte 255 cancels the count as Escape, not as an ordinary invalid key', async () => {
    freshGameplayRoom();
    applyNethackrc('OPTIONS=altmeta');
    pushKeys('3\x1b\xff');
    const cancelled = await readCommandInput();
    assert.equal(cancelled.key, 27);
    assert.equal(cancelled.count, 0);
    pushKeys('3\xff');
    const invalid = await readCommandInput();
    assert.equal(invalid.key, -1);
    assert.equal(invalid.count, 3);
});
//# sourceMappingURL=command_input.test.js.map