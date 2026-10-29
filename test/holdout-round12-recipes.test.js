import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRecipe, validateRecipeRecording } from '../scripts/holdout/recipes.mjs';
import { createSessionDriver } from '../scripts/lib/session-driver.mjs';
import { Engine } from '../js/jsmain.js';
import { GameDisplay } from '../js/game_display.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { EGG, GOLD_PIECE, LAND_MINE } from '../js/object_data.js';
import { ROUND12_RECIPES } from '../scripts/holdout/round12-recipes.mjs';
import { memoryStorage } from './support/memory-storage.js';
import { capturedScreen, screenText } from './support/screen.js';
function goldCarried(engine) {
    return engine.state.inventory.filter(object => object.otyp === GOLD_PIECE)
        .reduce((total, object) => total + object.quan, 0);
}
function floorObjectCount(engine, otyp) {
    let count = 0;
    for (const column of engine.state.level?.objects ?? []) {
        for (const cell of column ?? []) {
            for (const object of cell ?? []) {
                if (object.otyp === otyp)
                    count++;
            }
        }
    }
    return count;
}
const finalStates = {
    // Only moverock's HOLE branch clears W_NONDIGGABLE and sets candig.
    'boulder-plug-hole': engine => {
        let candig = 0;
        for (const column of engine.state.level?.locations ?? []) {
            for (const location of column ?? []) {
                if (location?.candig)
                    candig++;
            }
        }
        return candig > 0;
    },
    // The setup wishes 1000 zorkmids; the minor consultation pays 50.
    'oracle-minor': engine => goldCarried(engine) <= 950,
    'oracle-major': engine => !!engine.state.u.uevent?.major_oracle,
    // The setup wishes 3000 zorkmids; take_gold() removes all of it.
    'throne-gold-sit': engine => goldCarried(engine) === 0,
    'egg-laying': engine => floorObjectCount(engine, EGG) > 0,
    // #polyself makes the vampire; only dopoly() leaves that form. The
    // unpoly'd form is the role species, so compare against the initial
    // form rather than a name.
    'vampire-shapeshift': (engine, initial) => {
        const form = engine.state.u.umonnum;
        return form !== initial.umonnum && form !== MONSTER_NAME.indexOf('vampire');
    },
    // cnv_trap_obj() turns the disarmed trap into a pickable object.
    'land-mine-untrap': engine => floorObjectCount(engine, LAND_MINE) > 0,
    // done() counts the survived death in umortality.
    'death-lifesaving': engine => (engine.state.u.umortality ?? 0) > 0,
    // The created shapechanger has left its doppelganger form.
    'doppelganger-players': engine => {
        const doppelganger = MONSTER_NAME.indexOf('doppelganger');
        return engine.state.level?.monsters.some(monster => (monster.cham ?? -1) >= 0 && monster.mnum !== doppelganger) ?? false;
    },
};
// trap.c:untrap_prob() fails one disarm roll in three and the recording
// validator requires the repair; for the live-engine case both outcomes
// prove the grease was picked from the menu and try_disarm() ran.
const screenEffects = {
    'squeaky-board-untrap': /Whoops|squeaks|You repair the squeaky board/,
};
const characters = {
    wizard: { role: 'wizard', race: 'human', gender: 'male', align: 'neutral' },
    valkyrie: { role: 'valkyrie', race: 'human', gender: 'female', align: 'lawful' },
};
const recipeCharacter = {
    'egg-laying': 'valkyrie',
    'doppelganger-players': 'wizard',
};
for (const name of Object.keys(ROUND12_RECIPES)) {
    const characterKey = recipeCharacter[name] ?? 'wizard';
    void test(`${name} produces its native effect through live commands`, async () => {
        const plan = makeRecipe(name, { seed: 13, datetime: '20000110090000',
            character: characters[characterKey] });
        const segment = plan.segments[0];
        assert.ok(segment);
        const engine = new Engine({ ...segment, display: new GameDisplay(null), storage: memoryStorage() });
        await engine.runUntilInputNeeded();
        const initial = { umonnum: engine.state.u.umonnum };
        const driver = createSessionDriver(segment.driver);
        const screens = [];
        for (let inputs = 0; inputs < 1500; inputs++) {
            const screen = screenText(capturedScreen(engine));
            screens.push(screen);
            const key = driver.nextKey(screen.split('\n'));
            if (key === null)
                break;
            engine.inputGate.feed(key);
            await engine.runUntilInputNeeded();
        }
        assert.equal(driver.exhausted, true, `${name} must finish within 1500 inputs`);
        const messages = screens.map(screen => screen.split('\n').slice(0, 4).join('\n')).join('\n');
        const recent = [...new Set(messages.split('\n').filter(Boolean))].slice(-8).join('\n');
        const custom = screenEffects[name];
        if (custom) {
            assert.match(messages, custom, `${name}: last messages:\n${recent}`);
        }
        else {
            const evidence = validateRecipeRecording(name, { version: 5,
                segments: [{ steps: screens.map(screen => ({ screen })) }] });
            assert.equal(evidence.ok, true, `${name}: ${evidence.checks.filter(check => !check.ok).map(check => check.check).join(', ')}; last messages:\n${recent}`);
        }
        const finalState = finalStates[name];
        if (finalState) {
            assert.equal(finalState(engine, initial), true, `${name} must end with its effect in the live game state`);
        }
    });
}
void test('egg-laying refuses to build a plan for a male character', () => {
    assert.throws(() => makeRecipe('egg-laying', { seed: 13, datetime: '20000110090000',
        character: characters.wizard }), /female/);
});
//# sourceMappingURL=holdout-round12-recipes.test.js.map