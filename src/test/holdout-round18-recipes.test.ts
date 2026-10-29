import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../js/jsmain.js';
import { GameDisplay } from '../js/game_display.js';
import { objectLightRadius } from '../js/light.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { CANDELABRUM_OF_INVOCATION, CORPSE, WAX_CANDLE } from '../js/object_data.js';
import { makeRecipe, validateRecipeRecording } from '../scripts/holdout/recipes.mjs';
import { createSessionDriver } from '../scripts/lib/session-driver.mjs';
import { ROUND18_RECIPES } from '../scripts/holdout/round18-recipes.mjs';
import { memoryStorage } from './support/memory-storage.js';
import { capturedScreen, screenText } from './support/screen.js';

const MR_FIRE = 0x01;

for (const name of Object.keys(ROUND18_RECIPES)) {
    void test(`${name} reaches its native effect through live commands`, async () => {
        const plan = makeRecipe(name, { seed: 13, datetime: '20000110090000',
            character: { role: 'wizard', race: 'human', gender: 'male', align: 'neutral' } });
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
        if (name === 'lit-candle-stacks') {
            const candles = engine.state.inventory.filter(object => object.otyp === WAX_CANDLE);
            assert.equal(candles.length, 1, 'the recovered candles must merge with the carried stack');
            assert.equal(candles[0]?.quan, 4);
            assert.equal(candles[0]?.lamplit, true);
        }
        if (name === 'candelabrum-refill') {
            const candelabrum = engine.state.inventory.find(object => object.otyp === CANDELABRUM_OF_INVOCATION);
            assert.ok(candelabrum?.lamplit);
            assert.equal(candelabrum.spe, 7);
            assert.equal(objectLightRadius(candelabrum, engine.state), 4);
        }
        if (name === 'dangerous-food-warning') {
            assert.equal(engine.state.u.uedibility, 0, 'declining consumes the warning ability');
            assert.ok(engine.state.inventory.some(object => object.otyp === CORPSE
                && object.corpsenm === MONSTER_NAME.indexOf('cockatrice')), 'the declined corpse remains uneaten');
        }
        if (name === 'pet-corpse-resistance') {
            assert.ok(engine.state.level?.monsters.some(monster => monster.mtame
                && ((monster.mintrinsics ?? 0) & MR_FIRE)), 'the pet must gain intrinsic fire resistance');
        }
        if (name === 'quest-leader-death') assert.equal(engine.state.quest_status?.killed_leader, true);
        if (name === 'quest-nemesis-death') assert.equal(engine.state.quest_status?.killed_nemesis, true);
    });
}
