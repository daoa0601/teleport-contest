import assert from 'node:assert/strict';
import test from 'node:test';
import type { Engine } from '../js/jsmain.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { runSegment } from '../js/jsmain.js';
import { memoryStorage } from './support/memory-storage.js';
import { capturedScreen, screenText } from './support/screen.js';

// C end.c:1169-1170 captures at_night/at_midnight in really_done(), before
// any disclosure prompt can wait; insight.c:647-649 reports that snapshot
// in the final attribute pages instead of re-reading the clock.
async function endingLiveClockGame(): Promise<Engine> {
    return runSegment({
        seed: 7163, datetime: '', moves: ' ', storage: memoryStorage(),
        nethackrc: [
            'OPTIONS=name:AlexandertheGreatest,role:Caveman,race:human,gender:male,align:neutral',
            'OPTIONS=!legacy,!tutorial,!autopickup,pettype:none,!bones,tombstone,!toptenwin',
            'OPTIONS=disclose:-i na -v -g -c -o',
        ].join('\n'),
    });
}

async function finishPages(engine: Engine) {
    for (let page = 0; page < 8; page++) {
        if (game.program_state.windows_exited) return;
        assert.match(capturedScreen(engine), /--More--/, 'Only ending pagers should remain');
        engine.inputGate.feed(' ');
        await engine.runUntilInputNeeded();
    }
    assert.fail('The ending did not finish after eight acknowledgments');
}

for (const [name, deathUtc, dawnUtc, expected] of [
    ['night', Date.UTC(2042, 0, 1, 4, 59, 59), Date.UTC(2042, 0, 1, 11, 0, 1), /It was nighttime\./],
    ['the midnight hour', Date.UTC(2042, 0, 1, 5, 30, 0), Date.UTC(2042, 0, 1, 18, 0, 1), /It was the midnight hour\./],
] as const) {
    void test(`the final attributes keep the ${name} the hero died in`, async context => {
        // Both death times land before New York dawn: 23:59:59 on 2041-12-31
        // and 00:30:00 on 2042-01-01 in the recorder's New York clock.
        context.mock.timers.enable({ apis: ['Date'], now: deathUtc });
        const engine = await endingLiveClockGame();
        requirePlayingGame(game);

        engine.inputGate.feed('#quit\ny');
        await engine.runUntilInputNeeded();
        assert.match(screenText(capturedScreen(engine)), /Do you want to see your attributes\?/);
        // Answer after dawn, and midday for the midnight-hour case.
        context.mock.timers.setTime(dawnUtc);
        engine.inputGate.feed('y');
        await engine.runUntilInputNeeded();
        const screen = screenText(capturedScreen(engine));
        await finishPages(engine);

        assert.match(screen, expected);
        assert.doesNotMatch(screen, name === 'night' ? /midnight hour/ : /nighttime\./);
    });
}
