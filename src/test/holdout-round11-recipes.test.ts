import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRecipe, validateRecipeRecording } from '../scripts/holdout/recipes.mjs';
import { createSessionDriver } from '../scripts/lib/session-driver.mjs';
import { Engine } from '../js/jsmain.js';
import { GameDisplay } from '../js/game_display.js';
import { G_GENOD } from '../js/const.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { ARROW, DAGGER, DART, LARGE_BOX, RED_DRAGON_SCALES, WAN_LIGHT } from '../js/object_data.js';
import { memoryStorage } from './support/memory-storage.js';
import { capturedScreen, screenText } from './support/screen.js';

const effects: readonly [string, RegExp, ((engine: Engine) => boolean)?][] = [
    ['species-genocide', /Wiped out all jackals\./, engine =>
        !!((engine.state.mvitals?.[MONSTER_NAME.indexOf('jackal')]?.mvflags ?? 0) & G_GENOD)],
    ['reverse-genocide', /Sent in (?:some acid blobs|an acid blob)\./, engine =>
        (engine.state.level?.monsters.filter(monster => monster.mnum === MONSTER_NAME.indexOf('acid blob')).length ?? 0) >= 4],
    ['scroll-recharging', /Your wand of light glows/, engine => engine.state.inventory.some(object =>
        object.otyp === WAN_LIGHT && object.recharged === 1 && object.spe > 0)],
    ['confused-charging', /You feel charged up!/],
    ['confused-creation', /acid blob/, engine =>
        (engine.state.level?.monsters.filter(monster => monster.mnum === MONSTER_NAME.indexOf('acid blob')).length ?? 0) === 13],
    ['confused-fire', /scroll catches fire and you burn your hands/],
    ['confused-mapping', /A map coalesces in your mind!/],
    ['cloud-placement', /You cough|coughing/, engine => (engine.state.level?.regions.length ?? 0) > 0],
    ['room-illumination', /lit field|lit up|light|darkness/],
    ['floor-polymorph', /Things that are here:|objects meld/, engine => engine.state.level?.objects[engine.state.u.ux]?.[engine.state.u.uy]?.some(object =>
        object.otyp !== DART && object.otyp !== ARROW) ?? false],
    ['self-cancellation', /Some writing vanishes from your head!/, engine => engine.state.inventory.some(object =>
        object.otyp === DAGGER && object.spe === 0 && !object.blessed)],
    ['grave-excavation', /unearth a corpse|grave's owner|disturbed a tomb|grave is unoccupied/],
    ['cobra-spitting', /A splash of venom hits the ceiling/],
    ['mimic-hiding', /now mimicking/, engine => !!engine.state.u.m_ap_type],
    ['psychic-blast', /A wave of psychic energy pours out/],
    ['werewolf-summoning', /call upon your brethren for help/, engine =>
        engine.state.level?.monsters.some(monster => !!monster.mtame
            && /^(?:wolf|warg|winter wolf)$/.test(MONSTER_NAME[monster.mnum] ?? '')) ?? false],
    ['dragon-armor-merging', /skin returns to its original form/, engine =>
        engine.state.uskin?.otyp === RED_DRAGON_SCALES],
    ['magical-box-locks', /Klick!/, engine =>
        engine.state.level?.objects[engine.state.u.ux]?.[engine.state.u.uy]?.some(object => object.otyp === LARGE_BOX && !!object.olocked) ?? false],
    ['lizard-stoning-cure', /You feel limber!/],
    ['acidic-stoning-cure', /You feel limber!/],
];

for (const [name, effect, inspect] of effects) {
    void test(`${name} produces its native effect through live commands`, async () => {
        const plan = makeRecipe(name, { seed: 13, datetime: '20000110090000',
            character: { role: 'wizard', race: 'human', gender: 'male', align: 'neutral' } });
        const segment = plan.segments[0];
        assert.ok(segment);
        const engine = new Engine({ ...segment, display: new GameDisplay(null), storage: memoryStorage() });
        await engine.runUntilInputNeeded();
        const driver = createSessionDriver(segment.driver);
        const screens: string[] = [];
        let observedState = false;
        for (let inputs = 0; inputs < 1200; inputs++) {
            const screen = screenText(capturedScreen(engine));
            screens.push(screen);
            observedState ||= inspect?.(engine) ?? false;
            const key = driver.nextKey(screen.split('\n'));
            if (key === null) break;
            engine.inputGate.feed(key);
            await engine.runUntilInputNeeded();
        }
        assert.equal(driver.exhausted, true, `${name} must finish within 1200 inputs`);
        const messages = screens.map(screen => screen.split('\n').slice(0, 3).join('\n')).join('\n');
        const recent = [...new Set(messages.split('\n').filter(Boolean))].slice(-8).join('\n');
        assert.match(messages, effect, `${name}: expected ${effect}; last messages:\n${recent}`);
        if (inspect) assert.equal(observedState, true, `${name} must change the live game state`);
        const evidence = validateRecipeRecording(name, { version: 5,
            segments: [{ steps: screens.map(screen => ({ screen })) }] });
        assert.equal(evidence.ok, true, `${name}: ${evidence.checks.filter(check => !check.ok).map(check => check.check).join(', ')}`);
    });
}
