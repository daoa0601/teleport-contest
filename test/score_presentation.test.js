import { capturedScreen } from './support/screen.js';
import { requirePlayingGame, requireGameDisplay } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { finishOrdinaryDeath, finishOrdinaryQuit } from '../js/end.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { runSegment } from '../js/jsmain.js';
import { loadScoreRecords, SCORE_RECORD_STORAGE_KEY } from '../js/score_records.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { memoryStorage } from './support/memory-storage.js';
function readyToQuit(storage, { name = 'Ada', role = 'valkyrie', points = 100 } = {}) {
    freshConnectedLevels({ role });
    requirePlayingGame(game);
    game.storage = storage;
    game.plname = name;
    game.flags.disclose = '-i -a -v -c -o';
    game.u.urexp = points;
    return resetInputState();
}
function visibleText() {
    return requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
}
async function completedQuit(storage, options = {}) {
    const input = readyToQuit(storage, options);
    input.feed(' ');
    await finishOrdinaryQuit();
}
void test('a quit commits its score after summary acknowledgment and raw scores need no extra key', async () => {
    const storage = memoryStorage();
    const input = readyToQuit(storage);
    const ending = finishOrdinaryQuit();
    await input.waitUntilBlocked();
    assert.match(visibleText(), /You quit.*100 points/);
    assert.equal(storage.getItem(SCORE_RECORD_STORAGE_KEY), null);
    input.feed(' ');
    await ending;
    assert.match(visibleText(), /You made the top ten list!/);
    assert.match(visibleText(), /Ada-Val-Hum/);
    assert.equal(loadScoreRecords()[0]?.points, 100);
    assert.equal(requireGameDisplay().cursorCol, 0);
    assert.equal(input.isBlocked, false);
    assert.equal(game.program_state.windows_exited, true);
});
void test('Engine retains terminal completion before a new game starts with the same records', async () => {
    const storage = memoryStorage();
    const options = {
        seed: 241,
        datetime: '20260830190000',
        storage,
        nethackrc: [
            'OPTIONS=name:Ada,role:Valkyrie,race:human,gender:female,align:lawful',
            'OPTIONS=!legacy,!tutorial,!autopickup,pettype:none',
            'OPTIONS=disclose:-i -a -v -g -c -o',
        ].join('\n'),
    };
    const engine = await runSegment({ ...options, moves: ' ' });
    requirePlayingGame(game);
    engine.state.u.urexp = 100;
    engine.inputGate.feed('#quit\ny');
    await engine.runUntilInputNeeded();
    assert.match(visibleText(), /You quit/);
    assert.equal(storage.getItem(SCORE_RECORD_STORAGE_KEY), null);
    engine.inputGate.feed(' ');
    assert.equal((await engine.runUntilInputNeeded()).kind, 'stopped');
    assert.match(capturedScreen(engine, -1), /You made the top ten list!/);
    assert.match(capturedScreen(engine, -1), /Ada-Val-Hum/);
    const cursor = engine.getCursors().at(-1);
    assert.ok(cursor);
    assert.equal(cursor[0], 0);
    assert.equal(loadScoreRecords().length, 1);
    const next = await runSegment({
        ...options, seed: 242, moves: '',
        nethackrc: options.nethackrc.replace('name:Ada', 'name:Borin'),
    });
    requirePlayingGame(game);
    assert.match(capturedScreen(next, -1), /welcome to NetHack/);
    assert.doesNotMatch(capturedScreen(next, -1), /top ten list/);
    assert.match(capturedScreen(engine, -1), /Ada-Val-Hum/);
    assert.equal(loadScoreRecords().length, 1);
});
void test('toptenwin retains the score page until a valid acknowledgment and then closes the terminal', async () => {
    const storage = memoryStorage();
    const input = readyToQuit(storage);
    game.iflags.toptenwin = true;
    const ending = finishOrdinaryQuit();
    await input.waitUntilBlocked();
    input.feed(' ');
    await input.waitUntilBlocked();
    assert.match(visibleText(), /You made the top ten list!/);
    assert.match(visibleText(), /--More--/);
    assert.equal(loadScoreRecords()[0]?.name, 'Ada');
    input.feed('x');
    await input.waitUntilBlocked();
    assert.match(visibleText(), /--More--/);
    input.feed('\x1b');
    await ending;
    assert.equal(visibleText().trim(), '');
    assert.equal(game.program_state.windows_exited, true);
});
void test('configured score options reach the paged owner and can omit the score table', async () => {
    const storage = memoryStorage();
    const engine = await runSegment({
        seed: 244, datetime: '20260830190000', storage, moves: ' ',
        nethackrc: [
            'OPTIONS=name:Ada,role:Valkyrie,race:human,gender:female,align:lawful',
            'OPTIONS=!legacy,!tutorial,!autopickup,pettype:none',
            'OPTIONS=disclose:-i -a -v -g -c -o',
            'OPTIONS=toptenwin,scores:none',
        ].join('\n'),
    });
    requirePlayingGame(game);
    engine.state.u.urexp = 100;
    engine.inputGate.feed('#quit\ny');
    await engine.runUntilInputNeeded();
    engine.inputGate.feed(' ');
    assert.equal((await engine.runUntilInputNeeded()).kind, 'input-needed');
    assert.match(visibleText(), /You made the top ten list!/);
    assert.doesNotMatch(visibleText(), /No  Points/);
    assert.match(visibleText(), /--More--/);
    assert.equal(loadScoreRecords()[0]?.name, 'Ada');
    engine.inputGate.feed(' ');
    assert.equal((await engine.runUntilInputNeeded()).kind, 'stopped');
    assert.equal(capturedScreen(engine, -1), '');
});
for (const own of [false, true]) {
    void test(`configured scores ${own ? 'own replaces the prior top/around choice' : 'top and zero around limit the displayed games'}`, async () => {
        const storage = memoryStorage();
        const roles = ['valkyrie', 'wizard', 'tourist', 'barbarian'];
        for (const [index, role] of roles.entries())
            await completedQuit(storage, {
                name: `Hero${index}`, role, points: 400 - index,
            });
        const engine = await runSegment({
            seed: 245, datetime: '20260830190000', storage, moves: ' ',
            nethackrc: [
                'OPTIONS=name:Ada,role:Valkyrie,race:human,gender:female,align:lawful',
                'OPTIONS=!legacy,!tutorial,!autopickup,pettype:none',
                'OPTIONS=disclose:-i -a -v -g -c -o',
                'OPTIONS=scores:1top/0around',
                own ? 'OPTIONS=scores:own' : '',
            ].join('\n'),
        });
        requirePlayingGame(game);
        engine.state.u.urexp = 100;
        engine.inputGate.feed('#quit\ny');
        await engine.runUntilInputNeeded();
        engine.inputGate.feed(' ');
        assert.equal((await engine.runUntilInputNeeded()).kind, 'stopped');
        assert.match(visibleText(), /Hero0-Val/);
        assert.match(visibleText(), /Ada-Val/, 'zero around still includes the current rank when a table is shown');
        if (own)
            assert.match(visibleText(), /Hero1-Wiz/);
        else
            assert.doesNotMatch(visibleText(), /Hero1-Wiz/);
        assert.equal(loadScoreRecords().some(record => record.name === 'Ada'), true);
    });
}
void test('a long topten window pages through the actual saved games without skipping the final entry', async () => {
    const storage = memoryStorage();
    const roles = ['valkyrie', 'wizard', 'tourist', 'barbarian'];
    for (let index = 0; index < 12; index++) {
        const role = roles[index % roles.length];
        assert.ok(role);
        await completedQuit(storage, { name: `Hero${index}`, role, points: 400 - index });
    }
    const input = readyToQuit(storage, { name: 'Latest', role: 'knight', points: 100 });
    game.iflags.toptenwin = true;
    game.flags.end_top = game.flags.end_around = 0;
    game.flags.end_own = true;
    const ending = finishOrdinaryQuit();
    await input.waitUntilBlocked();
    input.feed(' ');
    await input.waitUntilBlocked();
    assert.match(visibleText(), /13th place/);
    assert.doesNotMatch(visibleText(), /Latest-Kni/);
    input.feed(' ');
    await input.waitUntilBlocked();
    assert.match(visibleText(), /Latest-Kni/);
    assert.match(visibleText(), /--More--/);
    input.feed('\n');
    await ending;
    assert.equal(loadScoreRecords().length, 13);
    assert.equal(visibleText().trim(), '');
});
void test('a fourth lower score reports the existing role cutoff and keeps the three better games', async () => {
    const storage = memoryStorage();
    for (const points of [400, 300, 200])
        await completedQuit(storage, { name: `Hero${points}`, points });
    await completedQuit(storage, { name: 'Latest', points: 100 });
    assert.match(visibleText(), /didn't beat your previous score of 200 points/);
    assert.match(visibleText(), /Latest-Val-Hum/);
    assert.doesNotMatch(visibleText(), /You made the top ten list!/);
    assert.equal(loadScoreRecords().length, 3);
    assert.equal(loadScoreRecords().some(record => record.name === 'Latest'), false);
});
void test('raw scores scroll a long own-score list while retaining the current game and requiring no pager', async () => {
    const storage = memoryStorage();
    const roles = ['valkyrie', 'wizard', 'tourist', 'barbarian'];
    for (let index = 0; index < 12; index++) {
        const role = roles[index % roles.length];
        assert.ok(role);
        await completedQuit(storage, { name: `Hero${index}`, role, points: 400 - index });
    }
    const input = readyToQuit(storage, { name: 'Latest', role: 'knight' });
    game.flags.end_own = true;
    input.feed(' ');
    await finishOrdinaryQuit();
    assert.match(visibleText(), /Latest-Kni/);
    assert.doesNotMatch(visibleText(), /--More--/);
    assert.equal(input.isBlocked, false);
    assert.equal(requireGameDisplay().cursorRow, 23);
    assert.equal(loadScoreRecords().length, 13);
});
void test('a starvation death commits after both death pages and shows its native score description', async () => {
    const storage = memoryStorage();
    const input = readyToQuit(storage);
    game.moves = 40;
    game.flags.bones = false;
    game.u.uhp = 0;
    const ending = finishOrdinaryDeath({ killer: 'starvation', deathCause: 'died of starvation' });
    await input.waitUntilBlocked();
    assert.equal(storage.getItem(SCORE_RECORD_STORAGE_KEY), null);
    input.feed(' ');
    await input.waitUntilBlocked();
    assert.equal(storage.getItem(SCORE_RECORD_STORAGE_KEY), null);
    input.feed(' ');
    await ending;
    assert.match(visibleText(), /starved to death/);
    assert.doesNotMatch(visibleText(), /Died of starvation/);
    assert.equal(loadScoreRecords()[0]?.death, 'died of starvation');
    assert.equal(loadScoreRecords()[0]?.hp, 0);
    assert.equal(input.isBlocked, false);
});
void test('skipping disclosure still saves the game without displaying its score entries', async () => {
    const storage = memoryStorage();
    const input = readyToQuit(storage);
    game.flags.disclose = '';
    input.feed('q');
    await finishOrdinaryQuit();
    assert.equal(loadScoreRecords()[0]?.name, 'Ada');
    assert.equal(visibleText().trim(), '');
    assert.equal(input.isBlocked, false);
});
void test('explore mode publishes its native notice without writing a score record', async () => {
    const storage = memoryStorage();
    const input = readyToQuit(storage);
    game.flags.explore = true;
    input.feed(' ');
    await finishOrdinaryQuit();
    assert.match(visibleText(), /Since you were in discover mode, the score list will not be checked/);
    assert.equal(storage.getItem(SCORE_RECORD_STORAGE_KEY), null);
});
//# sourceMappingURL=score_presentation.test.js.map