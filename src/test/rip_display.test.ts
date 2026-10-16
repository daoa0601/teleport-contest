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

async function endingGame() {
    return runSegment({
        seed: 7163, datetime: '19990830190000', moves: ' ', storage: memoryStorage(),
        nethackrc: [
            'OPTIONS=name:AlexandertheGreatest,role:Caveman,race:human,gender:male,align:neutral',
            'OPTIONS=!legacy,!tutorial,!autopickup,pettype:none,!bones,tombstone,!toptenwin',
            'OPTIONS=disclose:none',
        ].join('\n'),
    });
}

async function finishPages(engine: Awaited<ReturnType<typeof endingGame>>) {
    for (let page = 0; page < 8; page++) {
        if (game.program_state.windows_exited) return;
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
        if (screen.includes('REST')) tombstone = screen;
        assert.match(screen, /--More--/, 'The fatal illness should reach only ending pagers');
        engine.inputGate.feed(' ');
        await engine.runUntilInputNeeded();
    }

    assert.equal(game.program_state.windows_exited, true);
    assert.match(tombstone, /\|\s+abcdefghijklmnop\s+\|/);
    assert.match(tombstone, /\|\s+x abcdefghijklmn\s+\|/);
    assert.match(tombstone, /\|\s+opqrstuv\s+\|/);
});
