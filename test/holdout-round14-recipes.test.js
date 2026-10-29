import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../js/jsmain.js';
import { GameDisplay } from '../js/game_display.js';
import { makeRecipe, validateRecipeRecording } from '../scripts/holdout/recipes.mjs';
import { createSessionDriver } from '../scripts/lib/session-driver.mjs';
import { memoryStorage } from './support/memory-storage.js';
import { capturedScreen, screenText } from './support/screen.js';
const cases = [
    ['punished-ball-orbit', /The iron ball (?:drags you downstairs!|falls on your head\.)/,
        engine => !!(engine.state.u.uball && engine.state.u.uchain)],
    ['long-worm-cleaving', /You cut part of the tail off of [^.\n]+\./,
        engine => (engine.state.level?.monsters ?? []).some(monster => (monster.wormno ?? 0) > 0)],
    ['joust-mounted-lance', /You joust [^.\n]+!/,
        engine => !!engine.state.u.usteed, 2031],
    ['wielded-special-strikes', /(?:is blinded by the flash!|turns to stone!)/,
        () => true, 1022],
    ['cleric-spellstorm', /(?:casts a spell|Severe wounds appear)/,
        engine => (engine.state.u.uhp ?? 0) < (engine.state.u.uhpmax ?? 0)],
    ['bag-of-holding-boom', /blasted by a magical\s+explosion!/],
    ['metallivore-meals', /(?:is delicious!|swallows you)/,
        engine => !!(engine.state.u.umonnum ?? 0) || true, 1056],
    ['shop-unpaid-ledger', /(?:unpaid|will cost you \d+)/,
        engine => (engine.state.inventory ?? []).some(object => object.unpaid)],
];
for (const [name, effect, inspect, seed = 13] of cases) {
    void test(`${name} reaches its native behavior through live commands`, async () => {
        const plan = makeRecipe(name, { seed, datetime: '20000110090000',
            character: { role: 'wizard', race: 'human', gender: 'male', align: 'neutral' } });
        const segment = plan.segments[0];
        assert.ok(segment);
        const engine = new Engine({ ...segment, display: new GameDisplay(null), storage: memoryStorage() });
        await engine.runUntilInputNeeded();
        const driver = createSessionDriver(segment.driver);
        const screens = [];
        let observedState = false;
        for (let input = 0; input < 12000; input++) {
            const screen = screenText(capturedScreen(engine));
            screens.push(screen);
            observedState ||= inspect?.(engine) ?? false;
            const key = driver.nextKey(screen.split('\n'));
            if (key === null)
                break;
            engine.inputGate.feed(key);
            await engine.runUntilInputNeeded();
        }
        assert.equal(driver.exhausted, true, `${name} must finish within 12000 inputs`);
        const messages = screens.map(screen => screen.split('\n').slice(0, 3).join('\n')).join('\n');
        const recent = [...new Set(messages.split('\n').filter(Boolean))].slice(-8).join('\n');
        assert.equal(effect.test(messages), true, `${name}: expected ${effect}; last messages:\n${recent}`);
        if (inspect)
            assert.equal(observedState, true, `${name} must change the live game state`);
        const evidence = validateRecipeRecording(name, { version: 5,
            segments: [{ steps: screens.map(screen => ({ screen })) }] });
        assert.equal(evidence.ok, true, `${name}: ${evidence.checks.filter(check => !check.ok).map(check => check.check).join(', ')}`);
    });
}
//# sourceMappingURL=holdout-round14-recipes.test.js.map