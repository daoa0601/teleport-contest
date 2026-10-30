import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../js/jsmain.js';
import { GameDisplay } from '../js/game_display.js';
import { memoryStorage } from './support/memory-storage.js';
import { capturedScreen, screenText } from './support/screen.js';

void test('key help displays the tty-compressed explanation', async () => {
    const engine = new Engine({ seed: 13, datetime: '20000110090000',
        nethackrc: 'OPTIONS=name:Nomad,role:wizard,race:human,gender:male,align:neutral\n'
            + 'OPTIONS=!legacy,!tutorial,!news,pettype:none\n',
        display: new GameDisplay(null), storage: memoryStorage() });
    await engine.runUntilInputNeeded();
    engine.inputGate.feed('&');
    await engine.runUntilInputNeeded();
    if (screenText(capturedScreen(engine)).includes('--More--')) {
        engine.inputGate.feed(' ');
        await engine.runUntilInputNeeded();
    }
    assert.match(screenText(capturedScreen(engine)), /What command\?/);
    engine.inputGate.feed('?');
    await engine.runUntilInputNeeded();
    const screen = screenText(capturedScreen(engine));
    assert.match(screen, /Depending upon hardware/);
    assert.match(screen, /output\. When that is the case/);
});
