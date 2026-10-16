import assert from 'node:assert/strict';
import test from 'node:test';
import { SICK_NONVOMITABLE } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { startHeroSickness } from '../js/hero_illness.js';
import { runSegment } from '../js/jsmain.js';
import { GOLD_PIECE } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { memoryStorage } from './support/memory-storage.js';
import { capturedScreen, screenText } from './support/screen.js';
async function endingGame(datetime = '19990830190000') {
    return runSegment({
        seed: 7163, datetime, moves: ' ', storage: memoryStorage(),
        nethackrc: [
            'OPTIONS=name:AlexandertheGreatest,role:Caveman,race:human,gender:male,align:neutral',
            'OPTIONS=!legacy,!tutorial,!autopickup,pettype:none,!bones,tombstone,!toptenwin',
            'OPTIONS=disclose:none',
        ].join('\n'),
    });
}
async function finishPages(engine) {
    for (let page = 0; page < 8; page++) {
        if (game.program_state.windows_exited)
            return;
        assert.match(capturedScreen(engine), /--More--/, 'Only ending pagers should remain');
        engine.inputGate.feed(' ');
        await engine.runUntilInputNeeded();
    }
    assert.fail('The ending did not finish after eight acknowledgments');
}
void test('the tombstone caps its gold inscription while the death summary keeps the full purse', async () => {
    const engine = await endingGame();
    requirePlayingGame(game);
    await addInventoryObject(GOLD_PIECE, { quan: 1_234_567_890 });
    game.u.uhp = 0;
    engine.inputGate.feed('#quit\ny');
    await engine.runUntilInputNeeded();
    const summary = screenText(capturedScreen(engine));
    await finishPages(engine);
    assert.match(summary, /\|\s+999999999 Au\s+\|/);
    assert.match(summary, /and 1234567890 pieces of gold/);
    assert.match(summary, /\|\s+AlexandertheGrea\s+\|/);
    assert.match(summary, /\|\s+1999\s+\|/);
});
void test('the tombstone hard-splits a lone letter followed by an overlong word', async () => {
    const engine = await endingGame();
    await startHeroSickness({
        turns: 1, type: SICK_NONVOMITABLE,
        cause: 'abcdefghijklmnop x abcdefghijklmnopqrstuv',
    });
    engine.inputGate.feed('m.');
    await engine.runUntilInputNeeded();
    let tombstone = '';
    for (let page = 0; page < 8 && !game.program_state.windows_exited; page++) {
        const screen = screenText(capturedScreen(engine));
        if (screen.includes('REST'))
            tombstone = screen;
        assert.match(screen, /--More--/, 'The fatal illness should reach only ending pagers');
        engine.inputGate.feed(' ');
        await engine.runUntilInputNeeded();
    }
    assert.equal(game.program_state.windows_exited, true);
    assert.match(tombstone, /\|\s+abcdefghijklmnop\s+\|/);
    assert.match(tombstone, /\|\s+x abcdefghijklmn\s+\|/);
    assert.match(tombstone, /\|\s+opqrstuv\s+\|/);
});
for (const { name, datetime, year, now } of [
    { name: 'live clock', datetime: '', year: 2042, now: Date.UTC(2042, 6, 15, 18) },
    { name: 'live clock before local New Year', datetime: '', year: 2041, now: Date.UTC(2042, 0, 1, 2) },
    { name: 'fixed clock normalized across New Year', datetime: '20250101000000', year: 2024, now: Date.UTC(2042, 6, 15, 18) },
    { name: 'pre-1970 calendar date', datetime: '19690830190000', year: 2069, now: Date.UTC(2042, 6, 15, 18) },
]) {
    void test(`the tombstone uses the native year for a ${name}`, async (context) => {
        context.mock.timers.enable({ apis: ['Date'], now });
        const engine = await endingGame(datetime);
        requirePlayingGame(game);
        game.u.uhp = 0;
        engine.inputGate.feed('#quit\ny');
        await engine.runUntilInputNeeded();
        const summary = screenText(capturedScreen(engine));
        await finishPages(engine);
        assert.match(summary, new RegExp(`\\|\\s+${year}\\s+\\|`));
    });
}
void test('a slow disclosure answer cannot move the tombstone into the next year', async (context) => {
    context.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2042, 0, 1, 4, 59, 59) });
    const engine = await endingGame('');
    requirePlayingGame(game);
    game.u.uhp = 0;
    game.flags.disclose = '-i na -v -g -c -o';
    engine.inputGate.feed('#quit\ny');
    await engine.runUntilInputNeeded();
    assert.match(screenText(capturedScreen(engine)), /Do you want to see your attributes\?/);
    context.mock.timers.setTime(Date.UTC(2042, 0, 1, 5, 0, 1));
    engine.inputGate.feed('n');
    await engine.runUntilInputNeeded();
    const summary = screenText(capturedScreen(engine));
    await finishPages(engine);
    assert.match(summary, /\|\s+2041\s+\|/);
});
//# sourceMappingURL=rip_display.test.js.map