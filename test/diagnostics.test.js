import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { PANICLOG } from '../js/const.js';
import { impossible, panic } from '../js/diagnostics.js';
import { PanicTermination } from '../js/panic_termination.js';
import { flushPendingTopline, flush_screen, plineWithContinuation } from '../js/display.js';
import { GameDisplay } from '../js/game_display.js';
import { requireGameDisplay, game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { Engine } from '../js/jsmain.js';
import { hasErrorSave, restoreGame, saveGame } from '../js/save.js';
import { memoryStorage } from './support/memory-storage.js';
import { addInventoryObject } from './support/game-objects.js';
import { LEASH } from '../js/object_data.js';
import { freshPlayableRoom } from './support/playable-room.js';
function visibleText() {
    return requireGameDisplay(game).grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
}
function reports(storage = game.storage) {
    assert.ok(storage);
    return (storage.getItem(PANICLOG) || '').split('\n').filter(Boolean).map(line => {
        const record = JSON.parse(line);
        assert.ok(record && typeof record === 'object');
        assert.ok('type' in record && typeof record.type === 'string');
        assert.ok('reason' in record && typeof record.reason === 'string');
        return { type: record.type, reason: record.reason };
    });
}
function respondToInput(input, respond, label) {
    let reads = 0;
    const reader = {
        async readKey() {
            const screen = visibleText();
            assert.ok(++reads <= 64, `${label}: exceeded 64 input requests: ${screen}`);
            const key = respond(screen);
            if (key !== undefined) {
                if (key === ' ')
                    assert.match(screen, /--More--|Hit space to continue/, `${label}: expected paged prose`);
                return typeof key === 'number' ? key : key.charCodeAt(0);
            }
            // Unhandled command input remains a real blocked InputGate read.
            input.display = null;
            try {
                return await input.readKey();
            }
            finally {
                input.display = reader;
            }
        },
    };
    input.display = reader;
}
function recordPanicWarning(screen, seen) {
    for (const phrase of ['there is a panic one', 'demi-divine intervention',
        'Start a new game instead?']) {
        if (screen.includes(phrase))
            seen.add(phrase);
    }
}
function panicWarningReply(screen, answer) {
    if (/--More--|Hit space to continue/.test(screen))
        return ' ';
    return screen.includes('Start a new game instead?') ? answer : ' ';
}
function acknowledgeMessages() {
    const input = resetInputState();
    respondToInput(input, () => ' ', 'diagnostic acknowledgments');
    return input;
}
async function startCharacter(storage = memoryStorage()) {
    const engine = new Engine({
        seed: 1, storage, display: new GameDisplay(null),
        nethackrc: 'OPTIONS=name:Diagnostic,role:valkyrie,race:human,gender:female,align:lawful,!legacy,!tutorial,!tips',
    });
    respondToInput(engine.inputGate, () => ' ', 'fixed diagnostic character startup');
    try {
        await engine.start();
        return engine;
    }
    catch (error) {
        await engine.lua?.destroy();
        throw error;
    }
}
void test('each nonfatal report is logged and later reports can still run', async () => {
    freshPlayableRoom();
    requireFixtureGame(game);
    game.storage = memoryStorage();
    acknowledgeMessages();
    await impossible('First problem.');
    await impossible('Second problem.');
    assert.deepEqual(reports().map(({ type, reason }) => ({ type, reason })), [
        { type: 'impossible', reason: 'First problem.' },
        { type: 'impossible', reason: 'Second problem.' },
    ]);
    assert.equal(!!game.program_state.gameover, false);
});
void test('an impossible report escapes prior message suppression', async () => {
    freshPlayableRoom();
    requireFixtureGame(game);
    game.storage = memoryStorage();
    const input = resetInputState();
    await plineWithContinuation('A distant bell rings.');
    input.feed('\x1b');
    await flushPendingTopline();
    game.program_state.in_sanity_check = true;
    await impossible('The level needs repair.');
    await flush_screen(1);
    assert.match(visibleText(), /The level needs repair/);
    assert.doesNotMatch(visibleText(), /Program in disorder|Please report/);
});
void test('continue-mode fuzzing logs a sanity failure without panicking', async () => {
    freshPlayableRoom();
    requireFixtureGame(game);
    game.storage = memoryStorage();
    game.flags.debug_fuzzer = 2;
    game.program_state.in_sanity_check = true;
    await impossible('The level needs repair.');
    await flush_screen(1);
    assert.match(visibleText(), /The level needs repair/);
    assert.deepEqual(reports().map(record => record.type), ['impossible']);
});
void test('failed diagnostic storage does not turn a report into a fatal error', async () => {
    freshPlayableRoom();
    requireFixtureGame(game);
    const storage = memoryStorage();
    storage.getItem = () => { throw new Error('Storage is unavailable'); };
    game.storage = storage;
    acknowledgeMessages();
    await impossible('The level needs repair.');
    await flush_screen(1);
    assert.match(visibleText(), /Please report these messages/);
    assert.equal(!!game.program_state.gameover, false);
});
for (const mode of [true, 1]) {
    void test(`panic-mode fuzzing (${mode}) logs both records but never makes an error save`, async () => {
        const engine = await startCharacter();
        const storage = game.storage;
        const hp = game.u.uhp;
        try {
            game.flags.debug_fuzzer = Number(mode);
            acknowledgeMessages();
            await assert.rejects(impossible('The dungeon cannot continue.'), PanicTermination);
            assert.deepEqual(reports(storage).map(record => record.type), ['impossible', 'panic']);
            assert.equal(hasErrorSave('Diagnostic', storage), false);
            assert.equal(game.u.uhp, hp);
            assert.equal(!!game.program_state.gameover, false);
            assert.match(visibleText(), /Suddenly, the dungeon collapses/);
            assert.doesNotMatch(visibleText(), /Program in disorder/);
        }
        finally {
            await engine.lua.destroy();
        }
    });
}
void test('panic acknowledges Oops before writing its error save or panic log', async () => {
    const engine = await startCharacter();
    const storage = game.storage;
    const input = resetInputState();
    const operation = panic('The dungeon cannot continue.');
    const rejected = assert.rejects(operation, PanicTermination);
    try {
        await input.waitUntilBlocked();
        assert.match(visibleText(), /Oops/);
        assert.match(visibleText(), /Hit space to continue/);
        assert.doesNotMatch(visibleText(), /Suddenly, the dungeon collapses|--More--/);
        assert.equal(hasErrorSave('Diagnostic', storage), false);
        assert.deepEqual(reports(storage), []);
        input.feed(' ');
        await rejected;
        assert.equal(hasErrorSave('Diagnostic', storage), true);
        assert.deepEqual(reports(storage).map(record => record.type), ['panic']);
    }
    finally {
        input.feed(' ');
        await rejected;
        await engine.lua.destroy();
    }
});
void test('a panic snapshot cannot replace an existing ordinary save', async () => {
    const engine = await startCharacter();
    const storage = game.storage;
    try {
        game.u.uhp = 7;
        assert.equal(await saveGame(storage), true);
        assert.equal(restoreGame('Diagnostic', storage), true);
        assert.equal(await saveGame(storage), true);
        game.program_state.something_worth_saving = true;
        game.u.uhp = 3;
        acknowledgeMessages();
        await assert.rejects(panic('The dungeon cannot continue.'), PanicTermination);
        assert.equal(hasErrorSave('Diagnostic', storage), true);
        assert.equal(restoreGame('Diagnostic', storage), true);
        assert.equal(game.u.uhp, 7);
    }
    finally {
        await engine.lua.destroy();
    }
});
void test('a failed panic snapshot does not prevent the terminal diagnostic', async () => {
    const engine = await startCharacter();
    try {
        const storage = memoryStorage();
        storage.setItem = () => { throw new Error('Storage is full'); };
        game.storage = storage;
        acknowledgeMessages();
        await assert.rejects(panic('The dungeon cannot continue.'), PanicTermination);
        assert.match(visibleText(), /The dungeon cannot continue/);
        assert.equal(!!game.program_state.gameover, false);
    }
    finally {
        await engine.lua.destroy();
    }
});
for (const answer of ['n', 'y']) {
    void test(`a panic save warns before starting another character (${answer})`, async () => {
        const previous = await startCharacter();
        const storage = game.storage;
        acknowledgeMessages();
        await assert.rejects(panic('The dungeon cannot continue.'), PanicTermination);
        await previous.lua.destroy();
        const engine = new Engine({
            seed: 2, storage, display: new GameDisplay(null),
            nethackrc: 'OPTIONS=name:Diagnostic,role:valkyrie,race:human,gender:female,align:lawful,!legacy,!tutorial,!tips',
        });
        const seen = new Set();
        let pagedQuestion = false;
        respondToInput(engine.inputGate, screen => {
            recordPanicWarning(screen, seen);
            const topline = screen.split('\n')[0] ?? '';
            if (topline.includes('Start a new game instead?') && topline.includes('--More--'))
                pagedQuestion = true;
            return panicWarningReply(screen, answer);
        }, `panic-save warning (${answer})`);
        try {
            const started = await engine.start();
            assert.ok(seen.has('there is a panic one'));
            assert.ok(seen.has('demi-divine intervention'));
            assert.ok(seen.has('Start a new game instead?'));
            assert.equal(pagedQuestion, false, 'the confirmation is a question, not another paged announcement');
            assert.equal(started, answer === 'y');
            assert.equal(hasErrorSave('Diagnostic', storage), true);
            if (started) {
                requireFixtureGame(game);
                assert.ok(game.u.uhp > 0);
            }
            else
                assert.equal(game.moves, 0);
        }
        finally {
            await engine.lua.destroy();
        }
    });
}
void test('a panic from a Lua command hook stops the Engine before the command or script tail', async () => {
    const engine = new Engine({
        seed: 1, storage: memoryStorage(), display: new GameDisplay(null),
        nethackrc: 'OPTIONS=name:Diagnostic,role:valkyrie,race:human,gender:female,align:lawful,!legacy,!tutorial,!tips',
    });
    respondToInput(engine.inputGate, screen => {
        if (/--More--|Hit space to continue/.test(screen))
            return ' ';
        return undefined;
    }, 'Lua hook panic');
    await engine.runUntilInputNeeded();
    const core = engine.lua.core;
    assert.ok(core !== null && core !== undefined);
    core.execute(`
        function stop_command()
            nh.impossible("The dungeon cannot continue.")
            nh.pline("An unsafe command tail.")
        end
        nh.callback("cmd_before", "stop_command")
    `);
    const moves = game.moves;
    const hp = game.u.uhp;
    game.flags.debug_fuzzer = 1;
    engine.inputGate.feed('.');
    await assert.rejects(engine.runUntilInputNeeded(), PanicTermination);
    assert.equal(game.moves, moves);
    assert.equal(game.u.uhp, hp);
    assert.equal(!!game.program_state.gameover, false);
    assert.match(visibleText(), /The dungeon cannot continue/);
    assert.doesNotMatch(visibleText(), /An unsafe command tail/);
    assert.throws(() => core.execute('return 1'), /Lua state has been destroyed/);
    assert.ok(engine.lastRunResult !== null && engine.lastRunResult !== undefined);
    assert.equal(engine.lastRunResult.kind, 'panicked');
    assert.equal(engine.lastRunResult.reason, 'The dungeon cannot continue.');
});
for (const [initialName, finalName] of [['Other', 'Diagnostic'], ['Diagnostic', 'Other']]) {
    void test(`the panic-save warning uses the character picker's final name (${initialName} to ${finalName})`, async () => {
        const previous = await startCharacter();
        const storage = game.storage;
        acknowledgeMessages();
        await assert.rejects(panic('The dungeon cannot continue.'), PanicTermination);
        await previous.lua.destroy();
        const engine = new Engine({
            seed: 2, storage, display: new GameDisplay(null),
            nethackrc: `OPTIONS=name:${initialName},role:valkyrie,race:human,gender:female,!legacy,!tutorial,!tips`,
        });
        const seen = new Set();
        let renaming = false;
        respondToInput(engine.inputGate, screen => {
            recordPanicWarning(screen, seen);
            if (/--More--|Hit space to continue/.test(screen))
                return ' ';
            else if (screen.includes('Start a new game instead?'))
                return 'y';
            else if (screen.includes('Shall I pick '))
                return 'y';
            else if (screen.includes('Is this ok?')) {
                const key = renaming ? 'y' : 'a';
                renaming = true;
                return key;
            }
            else if (screen.includes('Who are you?')) {
                const prompt = screen.match(/Who are you\? ([^\n]*)/);
                assert.ok(prompt?.[1] !== undefined);
                const entered = prompt[1].trimEnd();
                return finalName[entered.length] || '\n';
            }
            else
                return ' ';
        }, `panic warning after rename (${initialName} to ${finalName})`);
        try {
            await engine.start();
            assert.equal(game.plname, finalName);
            assert.equal(seen.has('there is a panic one'), finalName === 'Diagnostic');
            assert.equal(hasErrorSave('Diagnostic', storage), true);
        }
        finally {
            await engine.lua.destroy();
        }
    });
}
void test('declining a panic-save warning stops the outer Engine without making a character', async () => {
    const previous = await startCharacter();
    const storage = game.storage;
    acknowledgeMessages();
    await assert.rejects(panic('The dungeon cannot continue.'), PanicTermination);
    await previous.lua.destroy();
    const engine = new Engine({
        seed: 2, storage, display: new GameDisplay(null),
        nethackrc: 'OPTIONS=name:Diagnostic,role:valkyrie,race:human,gender:female,align:lawful,!legacy,!tutorial,!tips',
    });
    respondToInput(engine.inputGate, screen => panicWarningReply(screen, 'n'), 'declined panic warning');
    assert.deepEqual(await engine.runUntilInputNeeded(), { kind: 'stopped' });
    assert.equal(game.moves, 0);
    assert.equal(game.level, null);
    assert.equal(hasErrorSave('Diagnostic', storage), true);
});
void test('a panic-mode report from an inventory name panics the Engine with that report', async () => {
    const storage = memoryStorage();
    const engine = new Engine({
        seed: 1, storage, display: new GameDisplay(null),
        nethackrc: 'OPTIONS=name:Diagnostic,role:valkyrie,race:human,gender:female,align:lawful,!legacy,!tutorial,!tips',
    });
    respondToInput(engine.inputGate, screen => {
        if (/--More--|Hit space to continue/.test(screen))
            return ' ';
        return undefined;
    }, 'formatter panic');
    try {
        await engine.runUntilInputNeeded();
        const leash = await addInventoryObject(LEASH, { leashmon: 4242 });
        game.flags.debug_fuzzer = 1;
        engine.inputGate.feed('i');
        await assert.rejects(engine.runUntilInputNeeded(), PanicTermination);
        assert.equal(leash.leashmon, 4242, 'native panics before the formatter detaches the leash');
        assert.ok(engine.lastRunResult !== null && engine.lastRunResult !== undefined);
        assert.equal(engine.lastRunResult.kind, 'panicked');
        assert.equal(engine.lastRunResult.reason, 'leashed monster #4242 not found');
        assert.match(visibleText(), /Suddenly, the dungeon collapses\./);
        assert.doesNotMatch(visibleText(), /an uncursed leash/);
        assert.deepEqual(reports(storage), [
            { type: 'impossible', reason: 'leashed monster #4242 not found' },
            { type: 'panic', reason: 'leashed monster #4242 not found' },
        ]);
    }
    finally {
        await engine.lua.destroy();
    }
});
//# sourceMappingURL=diagnostics.test.js.map