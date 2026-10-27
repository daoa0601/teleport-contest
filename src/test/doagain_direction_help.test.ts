import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { freshTurnRoom } from './support/playable-room.js';

// C cmd.c:getdir() takes its cmdq_pop() once per call (cmd.c:3962). The
// retry after help_dir() jumps back past that pop, so while gi.in_doagain
// is set the retried direction comes from readchar() — a physical key via
// pgetchar()/nhgetch(), not the next CQ_REPEAT entry (cmd.c:3985-3986,
// cmd.c:444-453). A do-again replay of a #chat whose direction question was
// answered with '?' therefore reopens the help window, and once that window
// is dismissed the replay waits for a fresh direction key instead of
// replaying the recorded answer.
void test('a repeated chat with recorded direction help asks for a fresh key after the help', async () => {
    const input = freshTurnRoom();

    // #chat; '?' opens the direction help, ' ' dismisses it, and the retry
    // answer 's' selects the self direction (NHKF_GETDIR_SELF2).
    input.feed('cha\r? s');
    await rhack('#'.charCodeAt(0));
    assert.match(game._pending_message ?? '',
        /Talking to yourself is a bad habit for a dungeoneer\./);

    // ^A replays the recorded [dotalk, '?', 's'] queue: the chat runs and
    // getdir() consumes '?', which reopens the direction help window.
    input.feed('\x01');
    const repeat = rhack(0);
    await input.waitUntilBlocked();
    assert.match(visibleText(), /Valid direction keys are:/);
    input.feed(' ');

    // The retried getdir() reads a physical key, so the replay blocks again
    // instead of finishing with the recorded 's'. Escape cancels: dochat()
    // returns ECMD_CANCEL without a second self-talk message.
    const boundary = await Promise.race([
        repeat.then(() => 'done'),
        input.waitUntilBlocked().then(() => 'input'),
    ]);
    assert.equal(boundary, 'input',
        'the replayed direction question waits for a fresh key after the help');
    input.feed('\x1b');
    await repeat;

    assert.doesNotMatch(visibleText(), /Talking to yourself/,
        'the cancelled replay prints no second self-talk message');
    assert.equal(game.context.move, 0);
});

function visibleText(): string {
    assert.ok(game.nhDisplay, 'Prompt assertions need the live display');
    return game.nhDisplay.grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
}
