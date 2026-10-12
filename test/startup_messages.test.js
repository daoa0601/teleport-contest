import test from 'node:test';
import assert from 'node:assert/strict';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { gameLogEvents } from '../js/gamelog.js';
import { saveGame } from '../js/save.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { memoryStorage } from './support/memory-storage.js';
function visibleRows(engine) {
    assert.ok(engine.display);
    return engine.display.grid.map(row => row.map(cell => cell.ch).join('').trimEnd());
}
async function startWithLongWelcome({ tutorial = false, explore = false, datetime = '20260801120000', } = {}) {
    return runSegment({
        seed: 29371,
        datetime,
        nethackrc: [
            'OPTIONS=name:Alexandria,role:Archeologist,race:dwarf,gender:female,align:lawful',
            `OPTIONS=!legacy,!autopickup,pettype:none${tutorial ? '' : ',!tutorial'}${explore ? ',playmode:explore' : ''}`,
        ].join('\n'),
        moves: '',
        storage: memoryStorage(),
    });
}
void test('a wrapped welcome waits for acknowledgment without spending a turn', async () => {
    const engine = await startWithLongWelcome();
    const rows = visibleRows(engine);
    assert.match(rows[0] ?? '', /^Hello Alexandria, welcome to NetHack!/);
    assert.match(rows[1] ?? '', /Archeologist\.--More--$/);
    assert.equal(gameLogEvents(engine.state).length, 0);
    engine.inputGate.feed(' ');
    await engine.runUntilInputNeeded();
    assert.equal(engine.state.moves, 1);
    assert.doesNotMatch(visibleRows(engine).join('\n'), /--More--/);
    assert.equal(gameLogEvents(engine.state).length, 1);
    // Force resting even if the generated start has a visible threat. An
    // Archeologist can spend an extra fast action in the same turn.
    engine.inputGate.feed('m.m.');
    await engine.runUntilInputNeeded();
    assert.ok(engine.state.moves > 1, 'rest commands should resume game time');
});
void test('acknowledging a wrapped welcome opens the tutorial choice without repeating it', async () => {
    const engine = await startWithLongWelcome({ tutorial: true });
    assert.match(visibleRows(engine)[1] ?? '', /Archeologist\.--More--$/);
    engine.inputGate.feed(' ');
    await engine.runUntilInputNeeded();
    const screen = visibleRows(engine).join('\n');
    assert.match(screen, /Do you want a tutorial\?/);
    assert.doesNotMatch(screen, /welcome to NetHack|--More--/);
    assert.equal(engine.state.moves, 1);
});
void test('declining the tutorial erases the acknowledged welcome before command input', async () => {
    const engine = await runSegment({
        seed: 381,
        datetime: '20260801120000',
        nethackrc: 'OPTIONS=name:Iris,role:Rogue,race:human,gender:female,align:chaotic,!legacy,!autopickup,pettype:none',
        moves: '', storage: memoryStorage(),
    });
    engine.inputGate.feed(' ');
    await engine.runUntilInputNeeded();
    assert.match(visibleRows(engine).join('\n'), /Do you want a tutorial\?/);
    engine.inputGate.feed('n');
    await engine.runUntilInputNeeded();
    assert.doesNotMatch(visibleRows(engine).join('\n'), /welcome to NetHack|--More--/);
    assert.equal(engine.state.moves, 1);
});
void test('explore startup announces its mode after the wrapped welcome', async () => {
    const engine = await startWithLongWelcome({ explore: true });
    assert.match(visibleRows(engine)[1] ?? '', /Archeologist\.--More--$/);
    engine.inputGate.feed(' ');
    await engine.runUntilInputNeeded();
    assert.match(visibleRows(engine).join('\n'), /You are in non-scoring explore\/discovery mode\./);
    assert.equal(engine.state.moves, 1);
});
void test('full-moon luck waits until the wrapped welcome has been acknowledged', async () => {
    const engine = await startWithLongWelcome({ datetime: '20260829193000' });
    assert.equal(engine.state.u.uluck ?? 0, 0);
    engine.inputGate.feed(' ');
    await engine.runUntilInputNeeded();
    // The Archeologist's starting fedora adds another point in set_wear().
    assert.equal(engine.state.u.uluck, 2);
    assert.match(visibleRows(engine)[0] ?? '', /Full moon tonight\./);
});
for (const [name, wrapped] of [['Saver', false], ['AlexandriatheDungeonExplorer', true]]) {
    void test(`a ${wrapped ? 'long' : 'short'} restored greeting ${wrapped ? 'waits for acknowledgment' : 'goes directly to command input'}`, async () => {
        freshPlayableRoom({ role: 'archeologist' });
        game.plname = name;
        game.displayName = name;
        game.flags.female = false;
        const storage = memoryStorage();
        assert.equal(await saveGame(storage), true);
        const moves = game.moves;
        const engine = await runSegment({
            seed: 11,
            datetime: '20260801120000',
            nethackrc: `OPTIONS=name:${name},!tutorial`,
            moves: '', storage,
        });
        const screen = visibleRows(engine).join('\n');
        assert.match(screen, /welcome back to\s+NetHack!/);
        assert.equal(screen.includes('--More--'), wrapped);
        assert.equal(engine.state.moves, moves);
    });
}
for (const [name, date, luck] of [
    ['full moon', '20260829193000', 10],
    ['Friday the thirteenth', '20261113120000', -10],
]) {
    void test(`restoring on ${name} cannot move Luck beyond its native limit`, async () => {
        freshPlayableRoom({ role: 'wizard' });
        game.plname = game.displayName = 'Saver';
        game.u.uluck = luck;
        const storage = memoryStorage();
        assert.equal(await saveGame(storage), true);
        const engine = await runSegment({
            seed: 11, datetime: date,
            nethackrc: 'OPTIONS=name:Saver,!tutorial',
            moves: ' ', storage,
        });
        assert.equal(engine.state.u.uluck, luck);
    });
}
//# sourceMappingURL=startup_messages.test.js.map