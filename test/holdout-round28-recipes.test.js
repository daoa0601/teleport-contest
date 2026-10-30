import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../js/jsmain.js';
import { GameDisplay } from '../js/game_display.js';
import { LEGAL_CHARACTERS, makeRecipe, validateRecipeRecording } from '../scripts/holdout/recipes.mjs';
import { ROUND28_RECIPES } from '../scripts/holdout/round28-recipes.mjs';
import { createSessionDriver } from '../scripts/lib/session-driver.mjs';
import { memoryStorage } from './support/memory-storage.js';
import { capturedScreen, screenText } from './support/screen.js';
import { decodeScreen } from '../frozen/screen-decode.mjs';
for (const [name, recipe] of Object.entries(ROUND28_RECIPES)) {
    void test(`${name} reaches its native effect through live commands`, async () => {
        const character = LEGAL_CHARACTERS.find(candidate => candidate.role === (recipe.roles?.[0] ?? 'wizard')
            && candidate.race === 'human' && candidate.gender === (recipe.genders?.[0] ?? 'male'));
        assert.ok(character);
        const plan = makeRecipe(name, { seed: 13, datetime: '20000110090000', character });
        const storage = memoryStorage();
        const recorded = [];
        for (const segment of plan.segments) {
            const engine = new Engine({ ...segment, display: new GameDisplay(null), storage });
            try {
                await engine.runUntilInputNeeded();
                const driver = createSessionDriver(segment.driver);
                const steps = [];
                for (let input = 0; input < 12000; input++) {
                    const screen = screenText(capturedScreen(engine));
                    if (name === 'r28-character-fallbacks' && input === 0)
                        assert.match(screen, /welcome to NetHack/i, 'automatic character fallbacks must reach gameplay without an extra keypress');
                    if (name === 'r28-rogue-level') {
                        const captured = decodeScreen(capturedScreen(engine));
                        for (const [row, cells] of engine.display?.grid.entries() ?? []) {
                            const column = cells.findIndex(cell => cell.ch === '\u00cd');
                            if (column >= 0)
                                assert.equal(captured[row]?.[column]?.ch, 'M', 'the tty recorder strips the high bit of an IBM wall glyph');
                            if (column >= 0)
                                assert.match(screen.split('\n')[23] ?? '', / \$:/, 'a control-character coin symbol must use the visible dollar fallback');
                        }
                    }
                    steps.push({ screen });
                    let key;
                    try {
                        key = driver.nextKey(screen.split('\n'));
                    }
                    catch (cause) {
                        throw new Error(`${name}: input ${input}\n${screen}`, { cause });
                    }
                    if (key === null)
                        break;
                    engine.inputGate.feed(key);
                    await engine.runUntilInputNeeded();
                }
                assert.equal(driver.exhausted, true, `${name} must finish within 12000 inputs`);
                recorded.push({ steps });
            }
            finally {
                await engine.lua.destroy();
            }
        }
        const evidence = validateRecipeRecording(name, { version: 5, segments: recorded });
        const messages = [...new Set(recorded.flatMap(segment => segment.steps)
                .flatMap(step => step.screen.split('\n').slice(0, 3)))].filter(Boolean).slice(-15);
        assert.equal(evidence.ok, true, `${name}: ${evidence.checks.filter(check => !check.ok).map(check => check.check).join(', ')}\n${messages.join('\n')}`);
    });
}
//# sourceMappingURL=holdout-round28-recipes.test.js.map