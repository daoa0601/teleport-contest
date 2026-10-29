import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRecipe, validateRecipeRecording } from '../scripts/holdout/recipes.mjs';
import { createSessionDriver } from '../scripts/lib/session-driver.mjs';
import { Engine } from '../js/jsmain.js';
import { GameDisplay } from '../js/game_display.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { HOLE, SQKY_BOARD, THRONE } from '../js/const.js';
import {
    AMULET_OF_LIFE_SAVING, BOULDER, CAN_OF_GREASE, EGG, GOLD_PIECE, LAND_MINE,
} from '../js/object_data.js';
import { ROUND12_RECIPES } from '../scripts/holdout/round12-recipes.mjs';
import { memoryStorage } from './support/memory-storage.js';
import { capturedScreen, screenText } from './support/screen.js';

// Round-12 recipes drive special-level features, wished traps, throne
// effects, and the end-of-game paths. Each case runs the live Engine over
// the recipe driver and observes the game effect, not synthetic screens.
// Each inspection returns a comparable snapshot of the live game state;
// the test asserts the snapshot CHANGED between the first and the last
// screen, so a recipe whose effect never happened fails.
interface Inspection { (engine: Engine): string | number }

const inspections: Record<string, Inspection> = {
    'boulder-plug-hole': engine => {
        const level = engine.state.level;
        let candig = 0, boulders = 0;
        for (const column of level?.locations ?? []) {
            for (const location of column ?? []) if (location?.candig) candig++;
        }
        for (const column of level?.objects ?? []) {
            for (const cell of column ?? []) {
                for (const object of cell ?? []) if (object.otyp === BOULDER) boulders++;
            }
        }
        // Plugging a hole clears W_NONDIGGABLE and sets candig on that tile
        // (hack.c:moverock_core() HOLE branch), and any unwished leftover
        // boulder still proves the pile moved.
        return `candig:${candig},boulders:${boulders}`;
    },
    'oracle-minor': engine =>
        `gold:${engine.state.inventory.filter(object => object.otyp === GOLD_PIECE)
            .reduce((total, object) => total + object.quan, 0)}`,
    'oracle-major': engine =>
        `majorOracle:${engine.state.u.uevent?.major_oracle ? 1 : 0}`,
    'throne-gold-sit': engine =>
        `throne:${engine.state.level?.at(engine.state.u.ux, engine.state.u.uy)?.typ === THRONE ? 1 : 0}`
        + `,gold:${engine.state.inventory.filter(object => object.otyp === GOLD_PIECE)
            .reduce((total, object) => total + object.quan, 0)}`,
    'egg-laying': engine => {
        let laid = 0;
        for (const column of engine.state.level?.objects ?? []) {
            for (const cell of column ?? []) {
                for (const object of cell ?? []) {
                    if (object.otyp === EGG && object.spe === 1) laid++;
                }
            }
        }
        return `laidEggs:${laid}`;
    },
    'vampire-shapeshift': engine => `form:${engine.state.u.umonnum}`,
    'land-mine-untrap': engine => {
        let mines = 0;
        for (const column of engine.state.level?.objects ?? []) {
            for (const cell of column ?? []) {
                for (const object of cell ?? []) {
                    if (object.otyp === LAND_MINE) mines++;
                }
            }
        }
        return `mineObjects:${mines}`;
    },
    'squeaky-board-untrap': engine =>
        `boards:${(engine.state.level?.traps ?? []).filter(trap => trap.ttyp === SQKY_BOARD).length}`
        + `,grease:${engine.state.inventory.filter(object => object.otyp === CAN_OF_GREASE)
            .reduce((total, object) => total + (object.spe ?? 0), 0)}`,
    'death-lifesaving': engine => `mortality:${engine.state.u.umortality ?? 0}`,
    'boulder-push': engine => {
        let boulders = 0;
        for (const column of engine.state.level?.objects ?? []) {
            for (const cell of column ?? []) {
                for (const object of cell ?? []) {
                    if (object.otyp === BOULDER) boulders++;
                }
            }
        }
        return `boulders:${boulders}`;
    },
    'doppelganger-players': engine => {
        const first = MONSTER_NAME.indexOf('archeologist');
        const last = MONSTER_NAME.indexOf('wizard');
        const playerForms = (engine.state.level?.monsters ?? []).filter(monster =>
            monster.cham !== undefined && monster.cham >= 0
            && monster.mnum >= first && monster.mnum <= last).length;
        return `playerForms:${playerForms}`;
    },
};

const characters: Record<string, { role: string; race: string; gender: string; align: string }> = {
    wizard: { role: 'wizard', race: 'human', gender: 'male', align: 'neutral' },
    valkyrie: { role: 'valkyrie', race: 'human', gender: 'female', align: 'lawful' },
};
const recipeCharacter: Record<string, string> = {
    'egg-laying': 'valkyrie',
    'doppelganger-players': 'wizard',
};
const seeds: Record<string, number> = {
    'doppelganger-players': 777,
    'throne-vlad-special': 13,
    'boulder-plug-hole': 13,
    // trap.c:untrap_prob() fails one disarm roll in three; 47 repairs.
    'squeaky-board-untrap': 47,
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
        const screens: string[] = [];
        const inspect = inspections[name];
        const before = inspect?.(engine);
        let after: string | number | undefined;
        for (let inputs = 0; inputs < 1500; inputs++) {
            const screen = screenText(capturedScreen(engine));
            screens.push(screen);
            const key = driver.nextKey(screen.split('\n'));
            if (key === null) break;
            engine.inputGate.feed(key);
            await engine.runUntilInputNeeded();
            after = inspect?.(engine);
        }
        assert.equal(driver.exhausted, true, `${name} must finish within 1500 inputs`);
        const messages = screens.map(screen => screen.split('\n').slice(0, 4).join('\n')).join('\n');
        const recent = [...new Set(messages.split('\n').filter(Boolean))].slice(-8).join('\n');
        const evidence = validateRecipeRecording(name, { version: 5,
            segments: [{ steps: screens.map(screen => ({ screen })) }] });
        assert.equal(evidence.ok, true,
            `${name}: ${evidence.checks.filter(check => !check.ok).map(check => check.check).join(', ')}; last messages:\n${recent}`);
        if (inspect) {
            assert.notEqual(after, before,
                `${name} must change the live game state (${before} stayed ${after})`);
        }
    });
}

void test('egg-laying refuses to build a plan for a male character', () => {
    assert.throws(() => makeRecipe('egg-laying', { seed: 13, datetime: '20000110090000',
        character: characters.wizard }), /female/);
});
