import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionDriver } from '../scripts/lib/session-driver.mjs';
import { makeRecipe } from '../scripts/holdout/recipes.mjs';
import { Engine } from '../js/jsmain.js';
import { GameDisplay } from '../js/game_display.js';
import { BOULDER } from '../js/object_data.js';
import { memoryStorage } from './support/memory-storage.js';
import { capturedScreen, screenText } from './support/screen.js';
function planFor(recipe, character, seed) {
    return makeRecipe(recipe, { seed, datetime: '20000110090000', character, name: 'Holdout' });
}
async function drive(engine, driver, inputs) {
    const seen = [];
    for (let index = 0; index < inputs; index++) {
        const key = driver.nextKey(screenText(capturedScreen(engine)).split('\n'));
        if (key === null)
            break;
        engine.inputGate.feed(key);
        await engine.runUntilInputNeeded();
        seen.push(screenText(capturedScreen(engine)));
    }
    return seen;
}
void test('dipping a potion of polymorph can turn the sink into an opulent throne', async () => {
    const plan = planFor('sink-drain-dipping', { role: 'knight', race: 'human', gender: 'male', align: 'lawful' }, 61000102);
    const segment = plan.segments[0];
    assert.ok(segment);
    const engine = new Engine({ ...segment, display: new GameDisplay(null), storage: memoryStorage() });
    await engine.runUntilInputNeeded();
    const driver = createSessionDriver(segment.driver);
    const screens = await drive(engine, driver, 400);
    const text = screens.join('\n');
    assert.equal(driver.exhausted, true, 'dipping must finish within 400 inputs');
    assert.match(text, /The sink transforms into /);
    assert.doesNotMatch(text, /The sink transforms into a throne!/, 'the throne keeps its opulent description');
});
void test('a wished rolling boulder trap reveals its boulder on the map', async () => {
    const plan = planFor('boulder-trap', { role: 'knight', race: 'human', gender: 'male', align: 'lawful' }, 61000037);
    const segment = plan.segments[0];
    assert.ok(segment);
    const engine = new Engine({ ...segment, display: new GameDisplay(null), storage: memoryStorage() });
    await engine.runUntilInputNeeded();
    const driver = createSessionDriver(segment.driver);
    const screens = await drive(engine, driver, 300);
    assert.equal(driver.exhausted, true, 'the boulder recipe must finish within 300 inputs');
    const wishScreen = screens.find(screen => screen.includes('A rolling boulder trap.'));
    assert.ok(wishScreen, 'the wish must announce the trap');
    assert.ok(wishScreen.split('\n').slice(1).some(line => line.includes('`')), 'the map must display the launch boulder immediately');
});
void test('sacrificing your race prints the default recovery line after the terror', async () => {
    const plan = planFor('altar-offerings', { role: 'rogue', race: 'human', gender: 'male', align: 'chaotic' }, 61000001);
    const segment = plan.segments[0];
    assert.ok(segment);
    const engine = new Engine({ ...segment, display: new GameDisplay(null), storage: memoryStorage() });
    await engine.runUntilInputNeeded();
    const driver = createSessionDriver(segment.driver);
    const screens = await drive(engine, driver, 400);
    const text = screens.join('\n');
    assert.equal(driver.exhausted, true, 'the offering recipe must finish within 400 inputs');
    assert.match(text, /The blood covers the altar!/);
    assert.match(text, /You are terrified, and unable to move\./);
    assert.match(text, /You can move again\./, 'the terror ends with the default nomovemsg line');
});
//# sourceMappingURL=round8_divergences.test.js.map