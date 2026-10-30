import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../js/jsmain.js';
import { GameDisplay } from '../js/game_display.js';
import { LEGAL_CHARACTERS, makeRecipe, validateRecipeRecording } from '../scripts/holdout/recipes.mjs';
import { ROUND26_RECIPES } from '../scripts/holdout/round26-recipes.mjs';
import { createSessionDriver } from '../scripts/lib/session-driver.mjs';
import { memoryStorage } from './support/memory-storage.js';
import { capturedScreen, screenText } from './support/screen.js';

for (const [name, recipe] of Object.entries(ROUND26_RECIPES)) {
    void test(`${name} reaches its native effect through live commands`, async () => {
        const character = LEGAL_CHARACTERS.find(candidate => candidate.role === recipe.roles?.[0]
            && candidate.race === 'human' && candidate.gender === (recipe.genders?.[0] ?? 'male'));
        assert.ok(character);
        const seed = name === 'shopkeeper-revival' ? 59
            : name === 'mounted-polymorph' || name.startsWith('shop-') ? 47 : 13;
        const plan = makeRecipe(name, { seed, datetime: '20000110090000', character });
        const storage = memoryStorage();
        const recorded: { steps: { screen: string }[] }[] = [];
        for (const segment of plan.segments) {
            const engine = new Engine({ ...segment, display: new GameDisplay(null), storage });
            try {
                await engine.runUntilInputNeeded();
                const driver = createSessionDriver(segment.driver);
                const screens: string[] = [];
                for (let input = 0; input < 24000; input++) {
                    const screen = screenText(capturedScreen(engine));
                    screens.push(screen);
                    let key: string | null;
                    try {
                        key = driver.nextKey(screen.split('\n'));
                    } catch (cause) {
                        throw new Error(`${name}: driver failed at input ${input}\n${screen}`, { cause });
                    }
                    if (key === null) break;
                    engine.inputGate.feed(key);
                    await engine.runUntilInputNeeded();
                }
                assert.equal(driver.exhausted, true, `${name} must finish within 24000 inputs`);
                recorded.push({ steps: screens.map(screen => ({ screen })) });
            } finally {
                await engine.lua.destroy();
            }
        }
        const evidence = validateRecipeRecording(name, { version: 5, segments: recorded });
        const screens = recorded.flatMap(segment => segment.steps.map(step => step.screen));
        const recent = [...new Set(screens.flatMap(screen => screen.split('\n').slice(0, 3)))]
            .filter(Boolean).slice(-15).join('\n');
        assert.equal(evidence.ok, true,
            `${name}: ${evidence.checks.filter(check => !check.ok).map(check => check.check).join(', ')}\n${recent}`);
    });
}
