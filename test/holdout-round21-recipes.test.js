import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../js/jsmain.js';
import { GameDisplay } from '../js/game_display.js';
import { ROUND21_RECIPES } from '../scripts/holdout/round21-recipes.mjs';
import { makeRecipe, validateRecipeRecording } from '../scripts/holdout/recipes.mjs';
import { createSessionDriver } from '../scripts/lib/session-driver.mjs';
import { memoryStorage } from './support/memory-storage.js';
import { capturedScreen, screenText } from './support/screen.js';
const ALIGN_BY_ROLE = {
    barbarian: 'neutral', caveman: 'lawful', healer: 'neutral', knight: 'lawful',
    monk: 'lawful', priest: 'lawful', ranger: 'neutral', rogue: 'chaotic',
    samurai: 'lawful', tourist: 'neutral', wizard: 'neutral',
};
const cases = Object.keys(ROUND21_RECIPES).map(name => {
    const recipe = ROUND21_RECIPES[name];
    if (!recipe)
        throw new Error(`missing recipe ${name}`);
    const role = recipe.roles?.[0] ?? 'wizard';
    const gender = recipe.genders?.[0] ?? 'male';
    const align = ALIGN_BY_ROLE[role] ?? 'neutral';
    return { name, role, gender, align };
});
for (const { name, role, gender, align } of cases) {
    void test(`${name} reaches its native level through live commands`, { timeout: 120000 }, async () => {
        const segment = makeRecipe(name, { seed: 13, datetime: '20000110090000',
            character: { role, race: 'human', gender, align } }).segments[0];
        assert.ok(segment);
        const engine = new Engine({ ...segment, display: new GameDisplay(null), storage: memoryStorage() });
        await engine.runUntilInputNeeded();
        const driver = createSessionDriver(segment.driver);
        const screens = [];
        const keys = [];
        for (let input = 0; input < 30000; input++) {
            const screen = screenText(capturedScreen(engine));
            screens.push(screen);
            let key;
            try {
                key = driver.nextKey(screen.split('\n'));
            }
            catch (cause) {
                throw new Error(`${name}: driver failed at input ${input}\n${screen}`, { cause });
            }
            if (key === null)
                break;
            keys.push(key);
            engine.inputGate.feed(key);
            await engine.runUntilInputNeeded();
        }
        assert.equal(driver.exhausted, true, `${name} must finish within 30000 inputs`);
        const evidence = validateRecipeRecording(name, { version: 5,
            segments: [{ steps: screens.map(screen => ({ screen })), moves: keys.join('') }] });
        const recent = [...new Set(screens.flatMap(screen => screen.split('\n').slice(0, 3)))]
            .filter(Boolean).slice(-15).join('\n');
        assert.equal(evidence.ok, true, `${name}: ${evidence.checks.filter(check => !check.ok).map(check => check.check).join(', ')}\n${recent}`);
        if (name === 'fort-ludios-entry')
            assert.equal(engine.state.u.uz?.dnum, engine.state.knox_level?.dnum, 'the hero must stand inside Fort Ludios');
        if (name === 'elemental-plane-tour') {
            const depth = engine.state.u.uz?.dlevel;
            assert.equal(engine.state.u.uz?.dnum, engine.state.astral_level?.dnum, 'the tour must finish on the Astral plane');
            assert.equal(depth, 1, 'Astral is the first endgame plane');
        }
        if (name === 'stronghold-trapdoor-drop')
            assert.equal(engine.state.u.uz?.dnum, engine.state.valley_level?.dnum, 'falling from the Stronghold must reach the Valley');
    });
}
//# sourceMappingURL=holdout-round21-recipes.test.js.map