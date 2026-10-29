import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../js/jsmain.js';
import { GameDisplay } from '../js/game_display.js';
import { makeRecipe, validateRecipeRecording } from '../scripts/holdout/recipes.mjs';
import { createSessionDriver } from '../scripts/lib/session-driver.mjs';
import { memoryStorage } from './support/memory-storage.js';
import { capturedScreen, screenText } from './support/screen.js';
// Each case asserts only behavior that is deterministic for the recipe's own
// key stream: setup messages and state changes the rules force on every seed.
// Stochastic outcomes (whether a wandering ogre stands in a probed direction,
// whether a spell lands) stay covered by the accepted native recordings and
// their replays, not by seed-pinned live assertions. metallivore-meals and
// shop-unpaid-ledger are omitted here: their drivers only complete on seeds
// where wandering monsters cooperate, which native recording showed too.
const cases = [
    ['punished-ball-orbit', /You are being punished for your misbehavior!/,
        engine => !!(engine.state.u.uball && engine.state.u.uchain)],
    ['long-worm-cleaving', /A long worm appears next to you\./,
        engine => (engine.state.level?.monsters ?? []).some(monster => (monster.wormno ?? 0) > 0)],
    // steed.c:doride() always asks the wizard-mode force question once the
    // direction is chosen, mounted or not.
    ['joust-mounted-lance', /Force the mount to succeed\?/],
    // potion.c:dodip() coats a poisonable stack dipped into sickness.
    ['wielded-special-strikes', /forms a coating on/,
        engine => (engine.state.inventory ?? []).some(object => !!object.opoisoned)],
    // read.c:create_particular_creation() always offers the aligned-cleric
    // substitution for an "aligned priest" request.
    ['cleric-spellstorm', /Creating human zombie instead; force aligned cleric\?/],
    ['bag-of-holding-boom', /blasted by a magical\s+explosion!/],
];
for (const [name, effect, inspect] of cases) {
    void test(`${name} reaches its native behavior through live commands`, async () => {
        const plan = makeRecipe(name, { seed: 13, datetime: '20000110090000',
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
    });
}
//# sourceMappingURL=holdout-round14-recipes.test.js.map