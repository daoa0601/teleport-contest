import assert from 'node:assert/strict';
import test from 'node:test';

import { game, requireGameDisplay } from '../js/gstate.js';
import type { InputGate } from '../js/input.js';
import { flush_screen } from '../js/display.js';
import { ARROW, BOW, CHEST, RIN_PROTECTION } from '../js/object_data.js';
import { moveloop_core } from '../js/allmain.js';
import { setQuiverObject, setSecondaryWeapon } from '../js/weapon_slots.js';
import { yn_function } from '../js/query.js';
import { resetInputState } from '../js/input.js';
import { ynSingleKey } from '../js/tty_prompts.js';
import { freshObjectRoom } from './support/object-room.js';
import { freshTurnRoom } from './support/playable-room.js';
import { finish, screen, startMenuGame, type } from './support/context-menu-game.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';

void test('an invalid queued tipping answer reports the problem and leaves the container alone', async () => {
    const engine = await startMenuGame();
    try {
        await floorObject(CHEST, 10, 10, { initialize: false });
        const moves = game.moves;
        await type(engine, '#tip');
        engine.inputGate.queueCommandKeys('x');

        await type(engine, '\n');

        assert.match(screen(), /Please report these messages to devteam@nethack\.org\./);
        assert.doesNotMatch(screen(), /--More--/);
        assert.equal(game.moves, moves);
        await type(engine, 'i');
        assert.match(screen(), /Weapons|Armor/);
    } finally { await finish(engine); }
});

for (const defaultAnswer of ['y', '']) {
    void test(`an invalid queued answer uses ${defaultAnswer ? 'the default' : 'Escape when there is no default'}`, async () => {
        const engine = await startMenuGame();
        try {
            engine.inputGate.queueCommandKeys('x');

            const result = await yn_function('Continue?', 'yn', defaultAnswer);

            assert.equal(result.answer, defaultAnswer || '\x1b');
            await flush_screen(1);
            assert.match(screen(), /Please report these messages to devteam@nethack\.org\./);
            assert.doesNotMatch(screen(), /--More--/);
        } finally { await finish(engine); }
    });
}

for (const responses of [null, '']) {
    void test(`a queued answer is unrestricted when responses are ${responses === null ? 'null' : 'empty'}`, async () => {
        const engine = await startMenuGame();
        try {
            engine.inputGate.queueCommandKeys('x');

            const result = await yn_function('Choose a character:', responses);

            assert.equal(result.answer, 'x');
            assert.doesNotMatch(screen(), /Program in disorder|Please report/);
        } finally { await finish(engine); }
    });
}

void test('a queued NUL is returned without an invalid-answer report', async () => {
    const engine = await startMenuGame();
    try {
        engine.inputGate.queueCommandKeys('\0');

        const result = await yn_function('Continue?', 'yn', 'n');

        assert.equal(result.answer, '\0');
        assert.doesNotMatch(screen(), /Program in disorder|Please report/);
    } finally { await finish(engine); }
});

// C cmd.c:yn_function() sets addcmdq FALSE for an answer from the queue,
// so a canned tipping yes is used for this command only: the do-again
// replay of #tip has no saved answer and asks the question again.
void test('a canned tipping answer is not recorded for do-again', async () => {
    const engine = await startMenuGame();
    try {
        await floorObject(CHEST, 10, 10, { initialize: false });
        await type(engine, '#tip');
        engine.inputGate.queueCommandKeys('y');
        await type(engine, '\n ');

        // The replay asks live: cmdq_pop() reads only CQ_REPEAT while the
        // do-again owns the input, and nothing was recorded for it.
        await type(engine, '\x01');
        assert.match(screen(), /tip it\? \[ynq\]/);
    } finally { await finish(engine); }
});

// C windows.c:getlin() leaves "\033" in the buffer when a queued Escape
// answers a line question. The annotate naming takes it as the typed
// path's cancellation, so no annotation is recorded.
void test('a canned Escape at the annotate question leaves the level unnamed', async () => {
    const engine = await startMenuGame();
    try {
        await type(engine, '#annotate');
        engine.inputGate.queueCommandKeys('\x1b');
        await type(engine, '\r');

        // A following annotate offers the fresh question rather than a
        // replacement, because the cancelled naming stored nothing.
        await type(engine, '#annotate\r');
        assert.match(screen(), /What do you want to call this dungeon level\?/);
        assert.doesNotMatch(screen(), /Replace annotation/);
    } finally { await finish(engine); }
});

// do_wear.c asks the ring-finger question through
// yn_function(qbuf, rightleftchars, '\0', TRUE): a canned key outside
// "rl" is reported and replaced with the NUL default, cancelling the
// put-on, and it is not recorded for a later do-again.
void test('a canned finger answer outside rl is reported and refuses the put-on', async () => {
    const engine = await startMenuGame();
    try {
        const ring = await addInventoryObject(RIN_PROTECTION, { invlet: 'Z' });
        await type(engine, 'P');
        engine.inputGate.queueCommandKeys('R');
        await type(engine, 'Z');

        assert.match(screen(), /Please report these messages to devteam@nethack\.org\./);
        assert.ok(!game.uright && !game.uleft, 'the put-on must be cancelled');
        assert.equal(game.context.move, 0);

        // Nothing was recorded: the do-again replay asks the finger
        // question live again after the saved object letter.
        await type(engine, '\x01');
        assert.match(screen(), /Which ring-finger, Right or Left\? \[rl\]/);
        assert.equal(game.inventory.includes(ring), true);
    } finally { await finish(engine); }
});

// C yn_function() pops the command queue once: a CMDQ_USER_INPUT entry
// means the answer comes from the terminal, so a response-free question
// never takes the canned entry behind it (cmd.c:5496-5539).
void test('a user-input canned entry leaves a single-key question live', async () => {
    freshObjectRoom();
    const input = resetInputState();
    input.queueCommandResponses(['user-input', 'k'.charCodeAt(0)]);

    const question = ynSingleKey('What do you look for? ');
    const outcome = await Promise.race([
        question.then(key => `answered:${key}`),
        input.waitUntilBlocked().then(() => 'blocked'),
    ]);

    assert.equal(outcome, 'blocked',
        'the question must wait for terminal input, not the next canned entry');
    input.feed('m');
    assert.equal(await question, 'm'.charCodeAt(0));
});

// A fire-assist 'f' with a bow as the secondary weapon and arrows in the
// quiver leaves the resuming fire queued behind the canned weapon swap.
async function fireAssistRoom() {
    const input = freshTurnRoom();
    const bow = await addInventoryObject(BOW, { invlet: 'b' });
    await setSecondaryWeapon(bow);
    await setQuiverObject(await addInventoryObject(ARROW, { invlet: 'c', quan: 3 }));
    input.feed('f');
    await moveloop_core();

    const swap = moveloop_core();
    await input.waitUntilBlocked();
    input.feed(' ');
    await swap;
    assert.equal(game.uwep, bow, 'the canned weapon swap ran');
    return input;
}

// Complete the swap's turn and run the queued fire: acknowledge every
// pager message with space, answer the fire's direction question with
// Escape, and record each top line the engine blocked on.
async function driveTurnUntilFireAsks(input: InputGate): Promise<string[]> {
    const seen: string[] = [];
    input.display = {
        async readKey(): Promise<number> {
            const display = requireGameDisplay(game);
            const top = (display.grid[0] ?? []).map(cell => cell.ch).join('');
            seen.push(top);
            return /In what direction\?/.test(top) ? 27 : ' '.charCodeAt(0);
        },
    };
    await moveloop_core(); // the swap's turn completes
    await moveloop_core(); // the queued fire asks its direction
    return seen;
}

// With no queued answers, the popped entry is the canned fire itself: not
// a key, so yn_function() keeps its ESC initializer (cmd.c:5504-5508),
// cmdq_clear(CQ_CANNED) drops every remaining entry, and the invalid ESC
// reports the yn impossible and falls back to the default answer.
void test('a canned command answers a yes/no question through the yn impossible', async () => {
    const input = await fireAssistRoom();
    const question = yn_function('Do you want to hold your fire?', 'ynq', 'y');
    const outcome = await Promise.race([
        question.then(answer => `answered:${answer.answer}`),
        input.waitUntilBlocked().then(() => 'blocked'),
    ]);
    assert.equal(outcome, 'answered:y',
        'the canned command must answer instead of a live question');
    assert.match(game._pending_message ?? '',
        /Please report these messages to devteam@nethack\.org\./,
        'the impossible feedback must be the pending message');

    const seen = await driveTurnUntilFireAsks(input);
    assert.ok(!seen.some(line => /In what direction\?/.test(line)),
        'the cleared fire must never ask for a direction');
    assert.equal(game.uquiver?.quan, 3, 'no arrow was fired');
});

// The same single pop answers a response-free yn_function() call: the
// canned command returns Escape without drawing the question, and the
// queue behind it is gone (cmd.c:5496-5509).
void test('a canned command answers a single-key question with Escape', async () => {
    const input = await fireAssistRoom();
    const question = ynSingleKey('What do you look for? ');
    const outcome = await Promise.race([
        question.then(key => `answered:${key}`),
        input.waitUntilBlocked().then(() => 'blocked'),
    ]);
    assert.equal(outcome, 'answered:27',
        'the canned command must answer Escape without asking');

    const seen = await driveTurnUntilFireAsks(input);
    assert.ok(!seen.some(line => /In what direction\?/.test(line)),
        'the cleared fire must never ask for a direction');
    assert.equal(game.uquiver?.quan, 3, 'no arrow was fired');
});

// A popped CMDQ_DIR entry is not a key either: the answer is Escape and
// cmdq_clear(CQ_CANNED) also drops the canned commands behind it, so the
// queued fire never runs (cmd.c:5508).
void test('a direction answer clears the canned command behind it', async () => {
    const input = await fireAssistRoom();
    input.queueCommandResponses([{ dx: 0, dy: 1, dz: 0 }]);
    const key = await ynSingleKey('What do you look for? ');
    assert.equal(key, 27, 'the direction entry answers Escape');

    const seen = await driveTurnUntilFireAsks(input);
    assert.ok(!seen.some(line => /In what direction\?/.test(line)),
        'the cleared fire must never ask for a direction');
    assert.equal(game.uquiver?.quan, 3, 'no arrow was fired');
});
