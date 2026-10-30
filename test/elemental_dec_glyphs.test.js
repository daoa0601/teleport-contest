import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../js/jsmain.js';
import { GameDisplay } from '../js/game_display.js';
import { makeRecipe } from '../scripts/holdout/recipes.mjs';
import { createSessionDriver } from '../scripts/lib/session-driver.mjs';
import { memoryStorage } from './support/memory-storage.js';
import { capturedScreen, screenText } from './support/screen.js';
// mkmaze.c setup_waterlevel() remembers the whole Plane of Water as
// cmap_to_glyph(S_water); with symset:DECgraphics the tty therefore renders
// the water as the alternate-font diamond ('`' with the DEC font flag), not
// the default-set '}'.  Regression test: the recipe's rc selects
// DECgraphics, so after arriving on the Plane of Water every water cell on
// the final screen is the DEC diamond.
void test('Plane of Water renders DECgraphics water cells', async () => {
    const plan = makeRecipe('plane-water', { seed: 13, datetime: '20000110090000',
        character: { role: 'wizard', race: 'human', gender: 'male', align: 'neutral' } });
    const segment = plan.segments[0];
    assert.ok(segment);
    const engine = new Engine({ ...segment, display: new GameDisplay(null), storage: memoryStorage() });
    await engine.runUntilInputNeeded();
    const driver = createSessionDriver(segment.driver);
    let final = '';
    for (let input = 0; input < 8000; input++) {
        const screen = screenText(capturedScreen(engine));
        final = screen;
        let key;
        try {
            key = driver.nextKey(screen.split('\n'));
        }
        catch (cause) {
            throw new Error(`driver failed at input ${input}\n${screen}`, { cause });
        }
        if (key === null)
            break;
        engine.inputGate.feed(key);
        await engine.runUntilInputNeeded();
    }
    assert.equal(driver.exhausted, true);
    assert.match(final, /^Water /m, 'the hero must end on the Plane of Water');
    const plain = final.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '');
    const mapRows = plain.split('\n').slice(2, 22).join('\n');
    assert.doesNotMatch(mapRows, /}/, 'water must not render with the default symbol');
    assert.match(mapRows, /``/, 'water must render as the DECgraphics diamond');
});
//# sourceMappingURL=elemental_dec_glyphs.test.js.map