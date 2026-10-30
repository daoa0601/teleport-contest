import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../js/jsmain.js';
import { GameDisplay } from '../js/game_display.js';
import { NO_COLOR } from '../js/terminal.js';
import { LEGAL_CHARACTERS, makeRecipe, validateRecipeRecording } from '../scripts/holdout/recipes.mjs';
import { ROUND27_RECIPES } from '../scripts/holdout/round27-recipes.mjs';
import { createSessionDriver } from '../scripts/lib/session-driver.mjs';
import { memoryStorage } from './support/memory-storage.js';
import { capturedScreen, screenText } from './support/screen.js';
for (const [name, recipe] of Object.entries(ROUND27_RECIPES)) {
    void test(`${name} reaches its native effect through live commands`, async () => {
        const character = LEGAL_CHARACTERS.find(candidate => candidate.role === (recipe.roles?.[0] ?? 'wizard')
            && candidate.race === 'human' && candidate.gender === (recipe.genders?.[0] ?? 'male'));
        assert.ok(character);
        const seed = name === 'r27-shop-price-and-throw' ? 59
            : name === 'r27-swallowed-fire-and-throw' || name === 'r27-trapped-chest-colors' ? 103 : 13;
        const plan = makeRecipe(name, { seed, datetime: '20000110090000', character });
        const storage = memoryStorage();
        const recorded = [];
        for (const segment of plan.segments) {
            const engine = new Engine({ ...segment, display: new GameDisplay(null), storage });
            try {
                await engine.runUntilInputNeeded();
                const driver = createSessionDriver(segment.driver);
                const screens = [];
                for (let input = 0; input < 24000; input++) {
                    const screen = screenText(capturedScreen(engine));
                    screens.push(screen);
                    if (name === 'r27-shop-price-and-throw' && screen.includes('Many shops, a temple and an altar'))
                        assert.match(screen, /an altar to Thoth/, 'the mapped coaligned altar must name the hero’s god');
                    if (name === 'r27-interactive-key-binding' && screen.startsWith('Bind which key?')) {
                        const cursor = engine.getCursors().at(-1);
                        assert.equal(cursor?.[1], 0, 'key input must keep the cursor on its prompt');
                        assert.equal(cursor?.[0], 'Bind which key? '.length);
                    }
                    if (name === 'r27-wish-assistance' && screen.startsWith('Wish details:'))
                        assert.match(screen.split('\n')[23] ?? '', /--More--/, 'wish help must offer the tty text pager');
                    if (name === 'r27-status-title-and-timeout' && screen.startsWith('You turn into a red dragon!')) {
                        const column = screen.split('\n')[23]?.indexOf('HP:') ?? -1;
                        assert.ok(column >= 0, 'the polymorphed HP must already be displayed');
                        assert.equal(engine.display?.grid[23]?.[column]?.color, NO_COLOR, 'changing form must reassess HP without a loss highlight');
                    }
                    let key;
                    try {
                        key = driver.nextKey(screen.split('\n'));
                    }
                    catch (cause) {
                        throw new Error(`${name}: driver failed at input ${input}\n${screen}`, { cause });
                    }
                    if (key === null)
                        break;
                    engine.inputGate.feed(key);
                    await engine.runUntilInputNeeded();
                }
                assert.equal(driver.exhausted, true, `${name} must finish within 24000 inputs`);
                recorded.push({ steps: screens.map(screen => ({ screen })) });
            }
            finally {
                await engine.lua.destroy();
            }
        }
        const evidence = validateRecipeRecording(name, { version: 5, segments: recorded });
        const screens = recorded.flatMap(segment => segment.steps.map(step => step.screen));
        const recent = [...new Set(screens.flatMap(screen => screen.split('\n').slice(0, 3)))]
            .filter(Boolean).slice(-15).join('\n');
        assert.equal(evidence.ok, true, `${name}: ${evidence.checks.filter(check => !check.ok).map(check => check.check).join(', ')}\n${recent}`);
    });
}
//# sourceMappingURL=holdout-round27-recipes.test.js.map