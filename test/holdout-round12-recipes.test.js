import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRecipe, validateRecipeRecording } from '../scripts/holdout/recipes.mjs';
import { createSessionDriver } from '../scripts/lib/session-driver.mjs';
import { Engine } from '../js/jsmain.js';
import { GameDisplay } from '../js/game_display.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { HOLE, SQKY_BOARD } from '../js/const.js';
import { AMULET_OF_LIFE_SAVING, BOULDER, EGG, GOLD_PIECE, LAND_MINE, } from '../js/object_data.js';
import { ROUND12_RECIPES } from '../scripts/holdout/round12-recipes.mjs';
import { memoryStorage } from './support/memory-storage.js';
import { capturedScreen, screenText } from './support/screen.js';
const inspections = {
    'boulder-plug-hole': engine => !(engine.state.level?.traps ?? []).some(trap => trap.ttyp === HOLE),
    'oracle-minor': engine => engine.state.inventory.some(object => object.otyp === GOLD_PIECE
        && object.quan < 1000),
    'oracle-major': engine => !!engine.state.u.uevent?.major_oracle,
    'throne-gold-sit': engine => !engine.state.inventory.some(object => object.otyp === GOLD_PIECE),
    'egg-laying': engine => (engine.state.level?.objects ?? []).some(column => (column ?? []).some(cell => (cell ?? []).some(object => object.otyp === EGG && object.spe === 1))),
    'vampire-shapeshift': engine => engine.state.u.umonnum !== MONSTER_NAME.indexOf('vampire'),
    'land-mine-untrap': engine => engine.state.inventory.some(object => object.otyp === LAND_MINE)
        || (engine.state.level?.objects ?? []).some(column => (column ?? []).some(cell => (cell ?? []).some(object => object.otyp === LAND_MINE))),
    'squeaky-board-untrap': engine => !(engine.state.level?.traps ?? []).some(trap => trap.ttyp === SQKY_BOARD),
    'death-lifesaving': engine => !engine.state.inventory.some(object => object.otyp === AMULET_OF_LIFE_SAVING),
    'quit-confirm': engine => (engine.state.u.uhp ?? 0) > 0,
    'boulder-push': engine => (engine.state.level?.objects ?? []).some(column => (column ?? []).some(cell => (cell ?? []).some(object => object.otyp === BOULDER))),
    'doppelganger-players': engine => {
        const first = MONSTER_NAME.indexOf('archeologist');
        const last = MONSTER_NAME.indexOf('wizard');
        return (engine.state.level?.monsters ?? []).some(monster => monster.cham !== undefined
            && monster.cham >= 0 && monster.mnum >= first && monster.mnum <= last);
    },
};
const characters = {
    wizard: { role: 'wizard', race: 'human', gender: 'male', align: 'neutral' },
    valkyrie: { role: 'valkyrie', race: 'human', gender: 'female', align: 'lawful' },
};
const recipeCharacter = {
    'egg-laying': 'valkyrie',
    'doppelganger-players': 'wizard',
};
const seeds = {
    'doppelganger-players': 777,
    'throne-vlad-special': 13,
    'boulder-plug-hole': 13,
};
for (const name of Object.keys(ROUND12_RECIPES)) {
    const characterKey = recipeCharacter[name] ?? 'wizard';
    void test(`${name} produces its native effect through live commands`, async () => {
        const plan = makeRecipe(name, { seed: seeds[name] ?? 13, datetime: '20000110090000',
            character: characters[characterKey] });
        const segment = plan.segments[0];
        assert.ok(segment);
        const engine = new Engine({ ...segment, display: new GameDisplay(null), storage: memoryStorage() });
        await engine.runUntilInputNeeded();
        const driver = createSessionDriver(segment.driver);
        const screens = [];
        let observedState = false;
        const inspect = inspections[name];
        for (let inputs = 0; inputs < 1500; inputs++) {
            const screen = screenText(capturedScreen(engine));
            screens.push(screen);
            observedState ||= inspect?.(engine) ?? false;
            const key = driver.nextKey(screen.split('\n'));
            if (key === null)
                break;
            engine.inputGate.feed(key);
            await engine.runUntilInputNeeded();
        }
        assert.equal(driver.exhausted, true, `${name} must finish within 1500 inputs`);
        const messages = screens.map(screen => screen.split('\n').slice(0, 4).join('\n')).join('\n');
        const recent = [...new Set(messages.split('\n').filter(Boolean))].slice(-8).join('\n');
        const evidence = validateRecipeRecording(name, { version: 5,
            segments: [{ steps: screens.map(screen => ({ screen })) }] });
        assert.equal(evidence.ok, true, `${name}: ${evidence.checks.filter(check => !check.ok).map(check => check.check).join(', ')}; last messages:\n${recent}`);
        assert.ok(observedState || !inspect, `${name} must change the live game state`);
    });
}
//# sourceMappingURL=holdout-round12-recipes.test.js.map