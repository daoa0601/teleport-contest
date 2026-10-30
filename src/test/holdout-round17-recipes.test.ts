import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../js/jsmain.js';
import { GameDisplay } from '../js/game_display.js';
import { makeRecipe, validateRecipeRecording } from '../scripts/holdout/recipes.mjs';
import { createSessionDriver } from '../scripts/lib/session-driver.mjs';
import { memoryStorage } from './support/memory-storage.js';
import { capturedScreen, screenText } from './support/screen.js';

// Round 17: information commands, status highlights, discoveries and
// inventory menus, overview and annotation, naming, elemental planes, and
// the pager help files. Each case drives live commands and checks the
// displayed results required by the native rules.
const cases: readonly [string, string, string, number][] = [
    ['status-hilite-rules', 'wizard', 'neutral', 13],
    ['status-hilite-config', 'wizard', 'neutral', 13],
    ['discovery-sorts', 'wizard', 'neutral', 13],
    ['inventory-classes', 'wizard', 'neutral', 13],
    ['identify-and-probe', 'wizard', 'neutral', 13],
    ['loot-container', 'wizard', 'neutral', 13],
    ['overview-annotation', 'wizard', 'neutral', 13],
    ['orctown-raid', 'wizard', 'neutral', 209],
    ['plane-water', 'wizard', 'neutral', 13],
    ['plane-air-fire', 'wizard', 'neutral', 13],
    ['naming-calls', 'wizard', 'neutral', 13],
    ['help-tour', 'wizard', 'neutral', 13],
];

for (const [name, role, align, seed] of cases) {
    void test(`${name} reaches its native effect through live commands`, async () => {
        const plan = makeRecipe(name, { seed, datetime: '20000110090000',
            character: { role, race: 'human', gender: 'male', align } });
        const segment = plan.segments[0];
        assert.ok(segment);
        const engine = new Engine({ ...segment, display: new GameDisplay(null), storage: memoryStorage() });
        await engine.runUntilInputNeeded();
        const driver = createSessionDriver(segment.driver);
        const screens: string[] = [];
        for (let input = 0; input < 16000; input++) {
            const screen = screenText(capturedScreen(engine));
            screens.push(screen);
            let key: string | null;
            try {
                key = driver.nextKey(screen.split('\n'));
            } catch (cause) {
                throw new Error(`${name}: command driver failed at input ${input}\n${screen}`, { cause });
            }
            if (key === null) break;
            engine.inputGate.feed(key);
            await engine.runUntilInputNeeded();
        }
        assert.equal(driver.exhausted, true, `${name} must finish within 16000 inputs`);
        const evidence = validateRecipeRecording(name, { version: 5,
            segments: [{ steps: screens.map(screen => ({ screen })) }] });
        const recent = [...new Set(screens.flatMap(screen => screen.split('\n').slice(0, 3)))]
            .filter(Boolean).slice(-12).join('\n');
        assert.equal(evidence.ok, true,
            `${name}: ${evidence.checks.filter(check => !check.ok).map(check => check.check).join(', ')}\n${recent}`);
    });
}
