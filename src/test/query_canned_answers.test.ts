import assert from 'node:assert/strict';
import test from 'node:test';

import { game } from '../js/gstate.js';
import { flush_screen } from '../js/display.js';
import { CHEST, RIN_PROTECTION } from '../js/object_data.js';
import { yn_function } from '../js/query.js';
import { resetInputState } from '../js/input.js';
import { ynSingleKey } from '../js/tty_prompts.js';
import { freshObjectRoom } from './support/object-room.js';
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
