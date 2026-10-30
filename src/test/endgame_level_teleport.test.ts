import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../js/jsmain.js';
import { GameDisplay } from '../js/game_display.js';
import { makeRecipe } from '../scripts/holdout/recipes.mjs';
import { createSessionDriver } from '../scripts/lib/session-driver.mjs';
import { memoryStorage } from './support/memory-storage.js';
import { capturedScreen, screenText } from './support/screen.js';

// teleport.c:level_tele(): the In_endgame() branch schedules the level
// change with no deferred "You materialize on a different level!" message,
// for both the typed-number and the wizard ^V menu paths.  Only the arrival
// from outside the endgame reports materializing.
void test('teleporting between the planes announces one materialization', async () => {
    const plan = makeRecipe('plane-air-fire', { seed: 13, datetime: '20000110090000',
        character: { role: 'wizard', race: 'human', gender: 'male', align: 'neutral' } });
    const segment = plan.segments[0];
    assert.ok(segment);
    const engine = new Engine({ ...segment, display: new GameDisplay(null), storage: memoryStorage() });
    await engine.runUntilInputNeeded();
    const driver = createSessionDriver(segment.driver);
    const materializations: number[] = [];
    for (let input = 0; input < 8000; input++) {
        const screen = screenText(capturedScreen(engine));
        const plain = screen.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '');
        if (plain.includes('materialize on a different level'))
            materializations.push(input);
        let key: string | null;
        try {
            key = driver.nextKey(screen.split('\n'));
        } catch (cause) {
            throw new Error(`driver failed at input ${input}\n${screen}`, { cause });
        }
        if (key === null) break;
        engine.inputGate.feed(key);
        await engine.runUntilInputNeeded();
    }
    assert.equal(driver.exhausted, true);
    assert.equal(materializations.length, 1,
        `exactly the first endgame arrival materializes, saw ${materializations.length}`);
});
