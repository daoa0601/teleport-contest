import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../js/jsmain.js';
import { NO_COLOR } from '../js/terminal.js';
import { GameDisplay } from '../js/game_display.js';
import { LEGAL_CHARACTERS, makeRecipe, validateRecipeRecording } from '../scripts/holdout/recipes.mjs';
import { ROUND24_RECIPES } from '../scripts/holdout/round24-recipes.mjs';
import { createSessionDriver } from '../scripts/lib/session-driver.mjs';
import { memoryStorage } from './support/memory-storage.js';
import { capturedScreen, screenText } from './support/screen.js';

const names = Object.keys(ROUND24_RECIPES);

for (const name of names) {
    void test(`${name} reaches its native effect through live commands`, async () => {
        const recipe = ROUND24_RECIPES[name];
        assert.ok(recipe);
        const character = LEGAL_CHARACTERS.find(candidate => candidate.role === recipe.roles?.[0]
            && candidate.race === 'human' && candidate.gender === (recipe.genders?.[0] ?? 'male'));
        assert.ok(character);
        const segment = makeRecipe(name, { seed: 13, datetime: '20000110090000', character }).segments[0];
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
                throw new Error(`${name}: driver failed at input ${input}\n${screen}`, { cause });
            }
            if (key === null) break;
            engine.inputGate.feed(key);
            await engine.runUntilInputNeeded();
        }
        assert.equal(driver.exhausted, true, `${name} must finish within 16000 inputs`);
        const evidence = validateRecipeRecording(name, { version: 5,
            segments: [{ steps: screens.map(screen => ({ screen })) }] });
        const recent = [...new Set(screens.flatMap(screen => screen.split('\n').slice(0, 3)))]
            .filter(Boolean).slice(-15).join('\n');
        assert.equal(evidence.ok, true,
            `${name}: ${evidence.checks.filter(check => !check.ok).map(check => check.check).join(', ')}\n${recent}`);
        if (name === 'hilite-rule-editor') {
            const row = engine.state.nhDisplay?.grid[23];
            assert.ok(row, 'the HP status row must be visible after editing');
            const column = row.map(cell => cell.ch).join('').indexOf('HP:');
            assert.ok(column >= 0, 'the status row must show HP');
            assert.equal(row[column]?.color, NO_COLOR, 'a deleted numeric rule must not color unchanged HP');
        }
    });
}
