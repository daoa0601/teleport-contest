import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../js/jsmain.js';
import { GameDisplay } from '../js/game_display.js';
import { DIAMOND, EGG, SPE_BLANK_PAPER } from '../js/object_data.js';
import { LEGAL_CHARACTERS, makeRecipe, validateRecipeRecording } from '../scripts/holdout/recipes.mjs';
import { ROUND25_RECIPES } from '../scripts/holdout/round25-recipes.mjs';
import { createSessionDriver } from '../scripts/lib/session-driver.mjs';
import { memoryStorage } from './support/memory-storage.js';
import { capturedScreen, screenText } from './support/screen.js';

for (const [name, recipe] of Object.entries(ROUND25_RECIPES)) {
    void test(`${name} reaches its native effect through live commands`, async () => {
        const character = LEGAL_CHARACTERS.find(candidate => candidate.role === recipe.roles?.[0]
            && candidate.race === 'human' && candidate.gender === (recipe.genders?.[0] ?? 'male'));
        assert.ok(character);
        const seed = name === 'minetown-shop-conversation' ? 7 : name === 'polearm-fire-target' ? 47 : 13;
        const plan = makeRecipe(name, { seed, datetime: '20000110090000', character });
        const storage = memoryStorage();
        const recorded: { steps: { screen: string }[] }[] = [];
        for (const segment of plan.segments) {
            const engine = new Engine({ ...segment, display: new GameDisplay(null), storage });
            try {
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
                recorded.push({ steps: screens.map(screen => ({ screen })) });
                if (name === 'wish-history-selection') {
                    const diamonds = engine.state.inventory.filter(object => object.otyp === DIAMOND);
                    assert.equal(diamonds.reduce((count, object) => count + object.quan, 0), 2);
                }
                if (name === 'queen-bee-egg')
                    assert.ok(engine.state.level?.objects.flat(2).some(object => object && object.otyp === EGG && object.spe === 1));
                if (name === 'novel-cancellation')
                    assert.ok(engine.state.level?.objects.flat(2).some(object => object && object.otyp === SPE_BLANK_PAPER && !object.oname));
                if (name === 'nymph-chain-removal') {
                    assert.equal(engine.state.uball, null);
                    assert.equal(engine.state.uchain, null);
                }
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
