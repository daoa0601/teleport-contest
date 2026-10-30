import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../js/jsmain.js';
import { GameDisplay } from '../js/game_display.js';
import { memoryStorage } from './support/memory-storage.js';
import { capturedScreen, screenText } from './support/screen.js';
// options.c:initoptions_finish() changes the generic object name to "fruit".
// A wish for that name produces the preferred fruit; its old name remains a
// fruit-list entry when it was the player's preferred fruit at startup.
for (const [preferred, request] of [['kumquat', 'fruit'], ['slime mold', 'slime mold']]) {
    void test(`wishing for '${request}' delivers the preferred ${preferred}`, async () => {
        const engine = new Engine({ seed: 13, datetime: '20000110090000',
            nethackrc: 'OPTIONS=name:Nomad,role:wizard,race:human,gender:male,align:neutral\n'
                + `OPTIONS=!legacy,!tutorial,!news,playmode:debug,pettype:none,fruit:${preferred}\n`,
            display: new GameDisplay(null), storage: memoryStorage() });
        await engine.runUntilInputNeeded();
        engine.inputGate.feed('\x17');
        await engine.runUntilInputNeeded();
        assert.match(screenText(capturedScreen(engine)), /For what do you wish\?/);
        for (const key of `uncursed ${request}\r`) {
            engine.inputGate.feed(key);
            await engine.runUntilInputNeeded();
        }
        assert.match(screenText(capturedScreen(engine)), new RegExp(` - an? ${preferred}\\.`), 'the wish delivery must name the preferred fruit');
    });
}
//# sourceMappingURL=wish_fruit_name.test.js.map