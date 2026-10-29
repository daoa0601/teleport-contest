import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../js/jsmain.js';
import { GameDisplay } from '../js/game_display.js';
import { BLINDFOLD, LENSES, SACK } from '../js/object_data.js';
import { makeRecipe, validateRecipeRecording } from '../scripts/holdout/recipes.mjs';
import { ROUND19_RECIPES } from '../scripts/holdout/round19-recipes.mjs';
import { createSessionDriver } from '../scripts/lib/session-driver.mjs';
import { memoryStorage } from './support/memory-storage.js';
import { capturedScreen, screenText } from './support/screen.js';

const names = Object.keys(ROUND19_RECIPES);

for (const name of names) {
    void test(`${name} reaches its native effect through live commands`, async () => {
        const segment = makeRecipe(name, { seed: 13, datetime: '20000110090000',
            character: { role: 'wizard', race: 'human', gender: 'male', align: 'neutral' } }).segments[0];
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
        if (name === 'buried-punishment-release') {
            assert.equal(engine.state.u.utrap, 0, 'removing the buried chain must free the hero');
            assert.equal(engine.state.uball, null, 'the hero must no longer be punished');
        }
        if (name === 'buried-punishment-return') {
            assert.equal(engine.state.u.utrap, 0, 'teleporting must release the buried-ball trap');
            assert.ok(engine.state.uball, 'teleporting must restore ordinary punishment');
        }
        if (name === 'invocation-ritual') assert.equal(engine.state.u.uevent?.invoked, 1);
        if (name === 'oracle-consultations') {
            assert.equal(engine.state.u.uevent?.minor_oracle, true);
            assert.equal(engine.state.u.uevent?.major_oracle, true);
        }
        if (name === 'traditional-container-transfer' || name === 'combination-container-transfer') {
            assert.ok(engine.state.inventory.some(object => object.oextra?.oname === 'cargo'), 'the recovered potion must be carried');
            const sack = engine.state.inventory.find(object => object.otyp === SACK);
            assert.ok(sack);
            assert.equal(sack.contents?.some(object => object.oextra?.oname === 'cargo') ?? false, false);
        }
        if (name === 'eyewear-already-worn') {
            assert.equal(engine.state.ublindf?.otyp, BLINDFOLD);
            assert.ok(engine.state.inventory.some(object => object.otyp === LENSES && !object.owornmask));
        }
    });
}
