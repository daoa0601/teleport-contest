import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRecipe, validateRecipeRecording } from '../scripts/holdout/recipes.mjs';
import type { RecipePlanSegment } from '../scripts/holdout/recipes.mjs';
import { createSessionDriver } from '../scripts/lib/session-driver.mjs';
import { Engine } from '../js/jsmain.js';
import { GameDisplay } from '../js/game_display.js';
import { IRONBARS, POOL, W_NONDIGGABLE } from '../js/const.js';
import { specialPrototypeAt } from '../js/dungeon.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { EGG, GOLD_PIECE, LAND_MINE } from '../js/object_data.js';
import { ROUND12_RECIPES } from '../scripts/holdout/round12-recipes.mjs';
import { memoryStorage } from './support/memory-storage.js';
import { capturedScreen, screenText } from './support/screen.js';

// Round-12 recipes drive special-level features, wished traps, throne
// effects, and the end-of-game paths. Each case runs the live Engine over
// the recipe driver and observes the game effect, not synthetic screens.
// Final-state predicates assert what only the recipe's effect can produce,
// so the wishes and moves in the setup prefix cannot satisfy them alone.

interface FinalState { (engine: Engine, initial: { umonnum: number | undefined }): boolean }

function goldCarried(engine: Engine): number {
    return engine.state.inventory.filter(object => object.otyp === GOLD_PIECE)
        .reduce((total, object) => total + object.quan, 0);
}

function floorObjectCount(engine: Engine, otyp: number): number {
    let count = 0;
    for (const column of engine.state.level?.objects ?? []) {
        for (const cell of column ?? []) {
            for (const object of cell ?? []) {
                if (object.otyp === otyp) count++;
            }
        }
    }
    return count;
}

const finalStates: Record<string, FinalState> = {
    // Only moverock's HOLE branch clears W_NONDIGGABLE and sets candig.
    'boulder-plug-hole': engine => {
        let candig = 0;
        for (const column of engine.state.level?.locations ?? []) {
            for (const location of column ?? []) {
                if (location?.candig) candig++;
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
    'vampire-shapeshift': (engine, initial: { umonnum: number | undefined }) => {
        const form = engine.state.u.umonnum;
        return form !== initial.umonnum && form !== MONSTER_NAME.indexOf('vampire');
    },
    // cnv_trap_obj() turns the disarmed trap into a pickable object.
    'land-mine-untrap': engine => floorObjectCount(engine, LAND_MINE) > 0,
    // done() counts the survived death in umortality.
    'death-lifesaving': engine => (engine.state.u.umortality ?? 0) > 0,
    'death-polymorphed': engine => engine.state.program_state.gameover === true
        && engine.state.u.umonnum === MONSTER_NAME.indexOf('silver dragon')
        && (engine.state.u.umortality ?? 0) > 0
        && engine.state.u.uhp === 0 && engine.state.u.mh === 0,
    // The created shapechanger has left its doppelganger form.
    'doppelganger-players': engine => {
        const doppelganger = MONSTER_NAME.indexOf('doppelganger');
        return engine.state.level?.monsters.some(monster =>
            (monster.cham ?? -1) >= 0 && monster.mnum !== doppelganger) ?? false;
    },
};

function assertRegeneratedLair(engine: Engine): void {
    const { level, u } = engine.state;
    assert.ok(level && u.uz);
    assert.equal(specialPrototypeAt(u.uz.dnum, u.uz.dlevel), 'baalz', 'the tour must finish in Baalzebub\'s lair');
    assert.equal(engine.state._levelAnnotations?.has(`${u.uz.dnum}:${u.uz.dlevel}`) ?? false,
        false, 'the replacement lair must discard the old annotation');
    let eyes = 0;
    for (const [x, column] of level.locations.entries()) {
        for (const [y, location] of (column ?? []).entries()) {
            // baalz_fixup() turns the fake pools into walls and opens
            // diggable approaches beside the two iron-bar eyes.
            assert.notEqual(location?.typ, POOL, `fake pool remains at (${x},${y})`);
            if (location?.typ !== IRONBARS) continue;
            const diggable = [-1, 1].some(direction => {
                const near = level.at(x + direction, y);
                const far = level.at(x + 2 * direction, y);
                return near && far && !(near.wall_info & W_NONDIGGABLE)
                    && !(far.wall_info & W_NONDIGGABLE);
            });
            assert.equal(diggable, true, `the eye at (${x},${y}) must have a diggable approach`);
            eyes++;
        }
    }
    assert.equal(eyes, 2, 'the lair must retain both iron-bar eyes');
}

// trap.c:untrap_prob() fails one disarm roll in three and the recording
// validator requires the repair; for the live-engine case both outcomes
// prove the grease was picked from the menu and try_disarm() ran.
const screenEffects: Record<string, RegExp> = {
    'squeaky-board-untrap': /Whoops|squeaks|You repair the squeaky board/,
};

const characters: Record<string, { role: string; race: string; gender: string; align: string }> = {
    wizard: { role: 'wizard', race: 'human', gender: 'male', align: 'neutral' },
    valkyrie: { role: 'valkyrie', race: 'human', gender: 'female', align: 'lawful' },
};
const recipeCharacter: Record<string, string> = {
    'egg-laying': 'valkyrie',
    'doppelganger-players': 'wizard',
};

function recipeSegment(name: string): RecipePlanSegment {
    const characterKey = recipeCharacter[name] ?? 'wizard';
    const plan = makeRecipe(name, { seed: 13, datetime: '20000110090000',
        character: characters[characterKey] });
    const segment = plan.segments[0];
    assert.ok(segment);
    return segment;
}

async function playSegment(segment: RecipePlanSegment) {
    const engine = new Engine({ ...segment, display: new GameDisplay(null), storage: memoryStorage() });
    await engine.runUntilInputNeeded();
    const initial = { umonnum: engine.state.u.umonnum };
    const driver = createSessionDriver(segment.driver);
    const screens: string[] = [];
    for (let inputs = 0; inputs < 1500; inputs++) {
        const screen = screenText(capturedScreen(engine));
        screens.push(screen);
        const key = driver.nextKey(screen.split('\n'));
        if (key === null) break;
        engine.inputGate.feed(key);
        await engine.runUntilInputNeeded();
    }
    assert.equal(driver.exhausted, true, 'recipe must finish within 1500 inputs');
    return { engine, initial, screens };
}

for (const name of Object.keys(ROUND12_RECIPES)) {
    void test(`${name} produces its native effect through live commands`, async () => {
        const { engine, initial, screens } = await playSegment(recipeSegment(name));
        const messages = screens.map(screen => screen.split('\n').slice(0, 4).join('\n')).join('\n');
        const recent = [...new Set(messages.split('\n').filter(Boolean))].slice(-8).join('\n');
        const custom = screenEffects[name];
        if (custom) {
            assert.match(messages, custom, `${name}: last messages:\n${recent}`);
        } else {
            const evidence = validateRecipeRecording(name, { version: 5,
                segments: [{ steps: screens.map(screen => ({ screen })) }] });
            assert.equal(evidence.ok, true,
                `${name}: ${evidence.checks.filter(check => !check.ok).map(check => check.check).join(', ')}; last messages:\n${recent}`);
        }
        const finalState = finalStates[name];
        if (finalState) {
            assert.equal(finalState(engine, initial), true,
                `${name} must end with its effect in the live game state`);
        }
        if (name === 'gehennom-tour') assertRegeneratedLair(engine);
    });
}

for (const { name, command } of [
    { name: 'death-polymorphed', command: '#wizkill\r.' },
    { name: 'gehennom-tour', command: '#wizmakemap\r' },
]) {
    void test(`${name} rejects live setup without its final effect`, async () => {
        const segment = recipeSegment(name);
        const end = segment.driver.findIndex(action => action.type === 'keys' && action.value === command);
        assert.ok(end > 0, `${name} must include ${command.trim()}`);

        const { screens } = await playSegment({ ...segment, driver: segment.driver.slice(0, end) });

        const evidence = validateRecipeRecording(name, { version: 5,
            segments: [{ steps: screens.map(screen => ({ screen })) }] });
        assert.equal(evidence.ok, false, `${name} must reject setup before ${command.trim()}`);
    });
}

void test('egg-laying refuses to build a plan for a male character', () => {
    assert.throws(() => makeRecipe('egg-laying', { seed: 13, datetime: '20000110090000',
        character: characters.wizard }), /female/);
});
