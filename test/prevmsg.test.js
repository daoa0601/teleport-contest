// ^P previous-message recall, driven through rhack() and the shared prompt
// owners. C refs: cmd.c doprev_message(), win/tty/topl.c
// tty_doprev_message()/remember_topl()/update_topl(), win/tty/getline.c.
import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { flush_screen, pline } from '../js/display.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { nhgetch, resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';
import { memoryStorage } from './support/memory-storage.js';
import { restoreGame, saveGame } from '../js/save.js';
import { resetGame } from '../js/gstate.js';
import { GameDisplay } from '../js/game_display.js';
import { promptChoice } from '../js/query.js';
function rowText(row) {
    return requireGameDisplay().grid[row]?.map(cell => cell.ch).join('').trimEnd() ?? '';
}
// tty_nhgetch() marks the displayed topline as seen; feeding one key through
// it is the boundary between two commands.
async function markSeen(input) {
    input.feed(' ');
    await nhgetch();
}
void test('single-mode ^P recalls the joined line, wraps to the newest, and takes no time', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.iflags.prevmsg_window = 's';
    const input = resetInputState();
    await pline('The door creaks open.');
    await pline('A gust of wind follows.'); // update_topl() joins both lines
    await markSeen(input);
    await pline('You are in luck.'); // remember_topl() files the joined line
    const moves = game.moves;
    await rhack(16);
    assert.equal(rowText(0), 'You are in luck.');
    await rhack(16);
    assert.equal(rowText(0), 'The door creaks open.  A gust of wind follows.', 'one recall entry keeps the two-space join');
    await rhack(16);
    assert.equal(rowText(0), 'You are in luck.', 'the walk past the oldest entry wraps back to the pending line');
    assert.equal(game.moves, moves, '^P takes no game time');
});
void test('an unknown command replaces the line without being remembered', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.iflags.prevmsg_window = 's';
    const input = resetInputState();
    await pline('You remember this line.');
    await markSeen(input);
    await rhack('%'.charCodeAt(0));
    await flush_screen(1); // parse() reports it before any command repaint
    assert.equal(rowText(0), "Unknown command '%'.");
    await rhack(16);
    assert.equal(rowText(0), '', 'custompline(SUPPRESS_HISTORY) leaves the complaint out of gt.toplines');
    await rhack(16);
    assert.equal(rowText(0), 'You remember this line.', 'the line before the complaint is still the newest entry');
});
void test('msg_window:full lists the ring oldest-first with the pending line last', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.iflags.prevmsg_window = 'f';
    const input = resetInputState();
    await pline('Alpha line here.');
    await markSeen(input);
    await pline('Beta line now.');
    await markSeen(input);
    await pline('Gamma falls.');
    const recall = rhack(16);
    await input.waitUntilBlocked();
    assert.match(rowText(0), /Message History/);
    assert.match(rowText(2), /Alpha line here\./);
    assert.match(rowText(3), /Beta line now\./);
    assert.match(rowText(4), /Gamma falls\./);
    input.feed(' ');
    await recall;
    assert.doesNotMatch(rowText(0), /Message History/, 'destroy_nhwindow() erases the recall window');
});
void test('msg_window:reversed leads with the pending line and runs newest-first', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.iflags.prevmsg_window = 'r';
    const input = resetInputState();
    await pline('Alpha line here.');
    await markSeen(input);
    await pline('Beta line now.');
    await markSeen(input);
    await pline('Gamma falls.');
    const recall = rhack(16);
    await input.waitUntilBlocked();
    assert.equal(rowText(2).trim(), 'Gamma falls.');
    assert.equal(rowText(3).trim(), 'Beta line now.');
    assert.equal(rowText(4).trim(), 'Alpha line here.');
    input.feed(' ');
    await recall;
});
void test('msg_window:combination pages two single lines before the full window', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.iflags.prevmsg_window = 'c';
    const input = resetInputState();
    await pline('Alpha line here.');
    await markSeen(input);
    await pline('Beta line now.');
    await markSeen(input);
    await pline('Gamma falls.');
    await rhack(16);
    assert.equal(rowText(0), 'Gamma falls.');
    await rhack(16);
    assert.equal(rowText(0), 'Beta line now.');
    const recall = rhack(16);
    await input.waitUntilBlocked();
    assert.match(rowText(0), /Message History/);
    input.feed(' ');
    await recall;
});
void test('a wrapped recall pages with --More-- and ^P keeps the walk going', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.iflags.prevmsg_window = 's';
    const input = resetInputState();
    const long = 'You hear the distant tone of a bell being struck over and over without any pause.';
    input.feed(' ');
    await pline(long); // wraps, then the fed space dismisses its --More--
    await markSeen(input);
    await pline('Short now.');
    await rhack(16);
    assert.equal(rowText(0), 'Short now.');
    const recall = rhack(16);
    await input.waitUntilBlocked();
    assert.match(rowText(1), /--More--/, 'a wrapped recall entry needs a pager');
    input.feed(16);
    await recall;
    assert.equal(rowText(0), 'Short now.', 'the pager accepts ^P and continues the walk to the pending line');
});
void test('single-mode ^P in a question discards the first following key and records the answer', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.iflags.prevmsg_window = 's';
    const input = resetInputState();
    await pline('Before the question.');
    await markSeen(input);
    const question = promptChoice('Really try?', ['y', 'n'], 'n');
    await input.waitUntilBlocked();
    assert.equal(rowText(0).trimEnd(), 'Really try? [yn] (n)');
    input.feed(16);
    await input.waitUntilBlocked();
    assert.equal(rowText(0), 'Before the question.', 'the first ^P at a question steps past the empty prompt line');
    input.feed('y');
    await input.waitUntilBlocked();
    assert.equal(rowText(0).trimEnd(), 'Really try? [yn] (n)', 'the key after browsing only repaints the question');
    input.feed('y');
    assert.equal(await question, 'y');
    await pline('Afterwards.'); // remembers the answered question
    await rhack(16);
    await rhack(16);
    assert.equal(rowText(0), 'Really try? [yn] (n) y', 'clean_up files the prompt with its recorded answer');
});
void test('msghistory bounds the recall ring', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.iflags.msg_history = 200; // clamped to MAX_MSG_HISTORY at the ring
    const input = resetInputState();
    for (let index = 0; index < 130; index++) {
        await pline(`Message number ${index}.`);
        await markSeen(input);
    }
    assert.equal(game._messageHistory.length, 128, 'the ring keeps MAX_MSG_HISTORY entries');
    assert.equal(game._messageHistory[0], 'Message number 1.');
    assert.equal(game._messageHistory[127], 'Message number 128.');
});
void test('save and restore carry the recall ring', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const input = resetInputState();
    await pline('One forgotten turn.');
    await markSeen(input);
    await pline('Two remembered turns.');
    const storage = memoryStorage();
    game.plname = 'Prevmsg';
    assert.equal(await saveGame(storage), true, 'save_msghistory() flushes the pending line');
    resetGame();
    assert.equal(restoreGame('Prevmsg', storage), true);
    // jsmain attaches the terminal before dorecover(); reattach it here.
    game.nhDisplay = new GameDisplay(null);
    await pline('Three follows.'); // remembers the restored pending line
    await rhack(16);
    assert.deepEqual(game._messageHistory, ['One forgotten turn.', 'Two remembered turns.']);
    assert.equal(rowText(0), 'Three follows.');
    await rhack(16);
    assert.equal(rowText(0), 'Two remembered turns.', 'restored entries recall oldest-first');
    await rhack(16);
    assert.equal(rowText(0), 'One forgotten turn.');
});
//# sourceMappingURL=prevmsg.test.js.map