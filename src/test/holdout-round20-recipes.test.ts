import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../js/jsmain.js';
import { GameDisplay } from '../js/game_display.js';
import { makeRecipe, validateRecipeRecording } from '../scripts/holdout/recipes.mjs';
import { ROUND20_RECIPES } from '../scripts/holdout/round20-recipes.mjs';
import { createSessionDriver } from '../scripts/lib/session-driver.mjs';
import { memoryStorage } from './support/memory-storage.js';
import { capturedScreen, screenText } from './support/screen.js';

const names = Object.keys(ROUND20_RECIPES);

for (const name of names) {
    const todo = name === 'wizard-mobile-lights' ? '#lightsources is not implemented'
        : name === 'wizard-memory-statistics' ? '#stats is not implemented' : false;
    void test(`${name} reaches its native effect through live commands`, { todo }, async () => {
        const segment = makeRecipe(name, { seed: 13, datetime: '20000110090000',
            character: { role: 'wizard', race: 'human', gender: 'male', align: 'neutral' } }).segments[0];
        assert.ok(segment);
        const engine = new Engine({ ...segment, display: new GameDisplay(null), storage: memoryStorage() });
        try {
            await engine.runUntilInputNeeded();
            const hero = { x: engine.state.u.ux, y: engine.state.u.uy };
            const monsters = (engine.state.level?.monsters ?? []).map(monster => ({
                id: monster.m_id, dx: monster.mx - hero.x, dy: monster.my - hero.y,
            }));
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
            if (name.startsWith('wizard-flip-')) {
                for (const before of monsters) {
                    const after = engine.state.level?.monsters.find(monster => monster.m_id === before.id);
                    assert.ok(after, 'flipping must preserve each monster');
                    const dx = after.mx - engine.state.u.ux;
                    const dy = after.my - engine.state.u.uy;
                    if (name === 'wizard-flip-random') {
                        assert.equal(Math.abs(dx), Math.abs(before.dx));
                        assert.equal(Math.abs(dy), Math.abs(before.dy));
                    } else {
                        if (name === 'wizard-flip-vertical') assert.equal(dx, before.dx);
                        else assert.equal(dx + before.dx, 0);
                        if (name === 'wizard-flip-horizontal') assert.equal(dy, before.dy);
                        else assert.equal(dy + before.dy, 0);
                    }
                }
            }
        } finally {
            await engine.lua.destroy();
        }
    });
}
