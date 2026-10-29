import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../js/jsmain.js';
import { GameDisplay } from '../js/game_display.js';
import { CORR, DRAWBRIDGE_DOWN } from '../js/const.js';
import { DIAMOND, FLINT, LUCKSTONE, RUBY } from '../js/object_data.js';
import { makeRecipe, validateRecipeRecording } from '../scripts/holdout/recipes.mjs';
import { createSessionDriver } from '../scripts/lib/session-driver.mjs';
import { memoryStorage } from './support/memory-storage.js';
import { capturedScreen, screenText } from './support/screen.js';

const cases: readonly [string, RegExp, ((engine: Engine) => boolean)?, number?][] = [
    ['vault-owner-name', /Sorry to have disturbed you/],
    ['vault-gold-refusal', /You've been warned, knave!/,
        engine => engine.state.level?.monsters.some(monster => !!monster.isgd && !monster.mpeaceful) ?? false, 2031],
    ['vault-gold-escort', /You drop [^.\n]*gold pieces/,
        engine => engine.state.u.uinvault === 0 && engine.state.level?.at(engine.state.u.ux, engine.state.u.uy)?.typ === CORR
            && (engine.state.level.monsters.some(monster => monster._egd?.fakecorr.some(square =>
                square.x === engine.state.u.ux && square.y === engine.state.u.uy)) ?? false), 4049],
    ['castle-bridge-cycle', /drawbridge (?:coming|going) up!/,
        engine => !!engine.state.u.uevent?.uopened_dbridge],
    ['castle-bridge-destruction', /(?:collapses|falls) into the moat!/,
        engine => engine.state.u.uevent?.uheard_tune === 3],
    ['castle-bridge-occupants', /ogre is crushed by the falling portcullis!/,
        engine => {
            const level = engine.state.level;
            if (!level) return false;
            for (let x = 1; x < 80; x++) {
                if (level.at(x, 11)?.typ !== DRAWBRIDGE_DOWN) continue;
                if (level.objects[x]?.[11]?.some(object => [DIAMOND, FLINT, LUCKSTONE, RUBY].includes(object.otyp)))
                    return true;
            }
            return false;
        }],
    ['successful-pit-rescue', /You pull the ogre out of the pit\./],
    ['quest-guardian-chat', /"(?:The spells|Would you|Ah, the spell|Hurry!|I, too, will venture)/],
    ['mind-flayer-grip', /cannot hold onto/],
    ['silver-ring-contact', /Your silver ring sears/],
    ['displaced-shopkeeper-anger', /gets angry!|is furious!/,
        engine => engine.state.level?.monsters.some(monster => !!monster.isshk && !monster.mpeaceful
            && !!monster.eshk?.following) ?? false],
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
        const screens: string[] = [];
        let observedState = false;
        for (let input = 0; input < 12000; input++) {
            const screen = screenText(capturedScreen(engine));
            screens.push(screen);
            observedState ||= inspect?.(engine) ?? false;
            const key = driver.nextKey(screen.split('\n'));
            if (key === null) break;
            engine.inputGate.feed(key);
            await engine.runUntilInputNeeded();
        }
        assert.equal(driver.exhausted, true, `${name} must finish within 12000 inputs`);
        const messages = screens.map(screen => screen.split('\n').slice(0, 3).join('\n')).join('\n');
        const recent = [...new Set(messages.split('\n').filter(Boolean))].slice(-8).join('\n');
        assert.equal(effect.test(messages), true, `${name}: expected ${effect}; last messages:\n${recent}`);
        if (inspect) assert.equal(observedState, true, `${name} must change the live game state`);
        const evidence = validateRecipeRecording(name, { version: 5,
            segments: [{ steps: screens.map(screen => ({ screen })) }] });
        assert.equal(evidence.ok, true,
            `${name}: ${evidence.checks.filter(check => !check.ok).map(check => check.check).join(', ')}`);
    });
}
