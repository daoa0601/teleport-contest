import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../js/jsmain.js';
import { GameDisplay } from '../js/game_display.js';
import { HORN_OF_PLENTY } from '../js/object_data.js';
import { LEGAL_CHARACTERS, makeRecipe, validateRecipeRecording } from '../scripts/holdout/recipes.mjs';
import { ROUND23_RECIPES } from '../scripts/holdout/round23-recipes.mjs';
import { createSessionDriver } from '../scripts/lib/session-driver.mjs';
import { memoryStorage } from './support/memory-storage.js';
import { capturedScreen, screenText } from './support/screen.js';

const names = Object.keys(ROUND23_RECIPES);

for (const name of names) {
    void test(`${name} reaches its native effect through live commands`, async () => {
        const recipe = ROUND23_RECIPES[name];
        assert.ok(recipe);
        const character = LEGAL_CHARACTERS.find(candidate => candidate.role === recipe.roles?.[0]
            && candidate.race === 'human' && candidate.gender === (recipe.genders?.[0] ?? 'male'));
        assert.ok(character);
        const segment = makeRecipe(name, { seed: name === 'leashed-pet-distress' ? 59 : 13, datetime: '20000110090000', character }).segments[0];
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
        if (name === 'plenty-horn-meals') {
            assert.equal(engine.state.inventory.find(object => object.otyp === HORN_OF_PLENTY)?.spe, 0);
            assert.ok(engine.state.inventory.some(object => object.blessed && [7, 8].includes(object.oclass)));
        }
        if (name === 'buried-object-probing')
            assert.ok(engine.state.level?.buriedObjects?.some(object => object.oextra?.oname === 'buried cargo'));
    });
}
