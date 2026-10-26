import assert from 'node:assert/strict';
import test from 'node:test';

import { game } from '../js/gstate.js';
import { flush_screen } from '../js/display.js';
import { CHEST } from '../js/object_data.js';
import { yn_function } from '../js/query.js';
import { finish, screen, startMenuGame, type } from './support/context-menu-game.js';
import { floorObject } from './support/game-objects.js';

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
