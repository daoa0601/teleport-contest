import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../js/jsmain.js';
import { GameDisplay } from '../js/game_display.js';
import { GOLD_PIECE } from '../js/object_data.js';
import { LEGAL_CHARACTERS, makeRecipe, validateRecipeRecording } from '../scripts/holdout/recipes.mjs';
import { ROUND22_RECIPES } from '../scripts/holdout/round22-recipes.mjs';
import { createSessionDriver } from '../scripts/lib/session-driver.mjs';
import { memoryStorage } from './support/memory-storage.js';
import { capturedScreen, screenText } from './support/screen.js';
const names = Object.keys(ROUND22_RECIPES);
for (const name of names) {
    void test(`${name} reaches its native effect through live commands`, async () => {
        const recipe = ROUND22_RECIPES[name];
        assert.ok(recipe);
        const character = LEGAL_CHARACTERS.find(candidate => candidate.role === recipe.roles?.[0]
            && candidate.race === 'human' && candidate.gender === (recipe.genders?.[0] ?? 'male'));
        assert.ok(character);
        const segment = makeRecipe(name, { seed: 13, datetime: '20000110090000', character }).segments[0];
        assert.ok(segment);
        const engine = new Engine({ ...segment, display: new GameDisplay(null), storage: memoryStorage() });
        await engine.runUntilInputNeeded();
        const driver = createSessionDriver(segment.driver);
        const screens = [];
        for (let input = 0; input < 16000; input++) {
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
            engine.inputGate.feed(key);
            await engine.runUntilInputNeeded();
        }
        assert.equal(driver.exhausted, true, `${name} must finish within 16000 inputs`);
        const evidence = validateRecipeRecording(name, { version: 5,
            segments: [{ steps: screens.map(screen => ({ screen })) }] });
        const recent = [...new Set(screens.flatMap(screen => screen.split('\n').slice(0, 3)))]
            .filter(Boolean).slice(-15).join('\n');
        assert.equal(evidence.ok, true, `${name}: ${evidence.checks.filter(check => !check.ok).map(check => check.check).join(', ')}\n${recent}`);
        if (name.startsWith('quest-fillers-')) {
            assert.equal(engine.state.quest_status?.got_quest, true, 'the leader must grant the quest');
            assert.ok((engine.state.u.uz?.dlevel ?? 0) >= 5, 'the hero must descend through the quest fillers');
        }
        if (name === 'shop-theft-restitution') {
            const keeper = engine.state.level?.monsters.find(monster => monster.isshk
                && monster.eshk?.customer === 'wizard');
            assert.ok(keeper, 'the paid keeper must remain on the level');
            assert.equal(keeper.mpeaceful, 1);
            assert.equal(keeper.eshk?.robbed, 0);
        }
        if (name === 'shop-gold-withdrawal') {
            assert.equal(engine.state.inventory.find(object => object.otyp === GOLD_PIECE)?.quan, 1000);
            assert.ok(engine.state.level?.monsters.some(monster => monster.isshk && monster.eshk?.credit === 0));
        }
        if (name === 'shop-unpaid-inheritance') {
            assert.equal(engine.state.program_state.gameover, true);
            assert.equal(engine.state.inventory.length, 0, 'the keeper must take the disclosed inventory');
        }
        if (name === 'sokoban-pit-replacement')
            assert.equal(engine.state.level?.flags.sokoban_rules, false, 'clearing the pits must remove Sokoban restrictions');
    });
}
//# sourceMappingURL=holdout-round22-recipes.test.js.map