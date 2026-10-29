import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../js/jsmain.js';
import { GameDisplay } from '../js/game_display.js';
import { DART, FIGURINE, LEASH, OBJECT_NAMES, SCR_BLANK_PAPER, SPE_TELEPORT_AWAY } from '../js/object_data.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { makeRecipe, validateRecipeRecording } from '../scripts/holdout/recipes.mjs';
import { createSessionDriver } from '../scripts/lib/session-driver.mjs';
import { memoryStorage } from './support/memory-storage.js';
import { capturedScreen, screenText } from './support/screen.js';

const cases: readonly [string, string, string][] = [
    ['controlled-artifact-descent', 'barbarian', 'neutral'],
    ['scroll-discovery', 'wizard', 'neutral'],
    ['divine-spell-teaching', 'wizard', 'neutral'],
    ['natural-ice-thaw', 'wizard', 'neutral'],
    ['jump-from-pit', 'wizard', 'neutral'],
    ['opening-held-hero', 'wizard', 'neutral'],
    ['found-quest-artifact', 'wizard', 'neutral'],
    ['elemental-artifact-hit', 'wizard', 'neutral'],
    ['cursed-wand-backfire', 'wizard', 'neutral'],
    ['forgotten-spell-casting', 'wizard', 'neutral'],
    ['spell-teleportation', 'wizard', 'neutral'],
    ['boomerang-flight', 'wizard', 'neutral'],
    ['unicorn-gift', 'wizard', 'neutral'],
    ['automatic-quiver', 'wizard', 'neutral'],
    ['deadbook-pacification', 'wizard', 'neutral'],
    ['rapid-artifact-invocation', 'rogue', 'chaotic'],
    ['speaking-trap-key', 'rogue', 'chaotic'],
    ['ahriman-levitation', 'barbarian', 'neutral'],
    ['mundane-reading', 'wizard', 'neutral'],
    ['blank-scroll-reading', 'wizard', 'neutral'],
    ['cursed-armor-disintegration', 'wizard', 'neutral'],
    ['confused-armor-proofing', 'wizard', 'neutral'],
    ['cloud-target-highlighting', 'wizard', 'neutral'],
    ['statue-fracturing', 'wizard', 'neutral'],
    ['corpse-wand-revival', 'wizard', 'neutral'],
    ['spell-list-sorting', 'wizard', 'neutral'],
    ['magical-detection', 'wizard', 'neutral'],
    ['bell-opening', 'wizard', 'neutral'],
    ['charged-wand-explosion', 'wizard', 'neutral'],
    ['blind-engraving', 'wizard', 'neutral'],
    ['lamp-exhaustion', 'wizard', 'neutral'],
    ['strangulation-warning', 'wizard', 'neutral'],
    ['cursed-figurine', 'wizard', 'neutral'],
    ['leashed-pet-death', 'wizard', 'neutral'],
    ['leash-removal', 'wizard', 'neutral'],
    ['tool-target-highlighting', 'wizard', 'neutral'],
];

for (const [name, role, align] of cases) {
    void test(`${name} reaches its native effect through live commands`, async () => {
        const plan = makeRecipe(name, { seed: 13, datetime: '20000110090000',
            character: { role, race: 'human', gender: 'male', align } });
        const segment = plan.segments[0];
        assert.ok(segment);
        const engine = new Engine({ ...segment, display: new GameDisplay(null), storage: memoryStorage() });
        await engine.runUntilInputNeeded();
        const driver = createSessionDriver(segment.driver);
        const screens: string[] = [];
        for (let input = 0; input < 16000; input++) {
            const screen = screenText(capturedScreen(engine));
            screens.push(screen);
            let key: string | null;
            try {
                key = driver.nextKey(screen.split('\n'));
            } catch (cause) {
                throw new Error(`${name}: command driver failed at input ${input}\n${screen}`, { cause });
            }
            if (key === null) break;
            engine.inputGate.feed(key);
            await engine.runUntilInputNeeded();
        }
        assert.equal(driver.exhausted, true, `${name} must finish within 16000 inputs`);
        const evidence = validateRecipeRecording(name, { version: 5,
            segments: [{ steps: screens.map(screen => ({ screen })) }] });
        const recent = [...new Set(screens.flatMap(screen => screen.split('\n').slice(0, 3)))]
            .filter(Boolean).slice(-12).join('\n');
        assert.equal(evidence.ok, true,
            `${name}: ${evidence.checks.filter(check => !check.ok).map(check => check.check).join(', ')}\n${recent}`);
        if (name === 'blank-scroll-reading')
            assert.ok(engine.state.inventory.some(object => object.otyp === SCR_BLANK_PAPER), 'reading must preserve blank paper');
        if (name === 'cursed-armor-disintegration')
            assert.equal(engine.state.inventory.some(object => object.otyp === OBJECT_NAMES.indexOf('low boots')), false, 'disintegrated boots must leave inventory');
        if (name === 'corpse-wand-revival')
            assert.ok(engine.state.level?.monsters.some(monster => MONSTER_NAME[monster.mnum] === 'lizard'), 'the revived lizard must be alive');
        if (name === 'spell-teleportation')
            assert.equal(engine.state.spells?.some(spell => spell.otyp === SPE_TELEPORT_AWAY), false, 'the temporary teleport spell must be removed');
        if (name === 'automatic-quiver')
            assert.equal(engine.state.uquiver?.otyp, DART, 'firing must choose darts for the empty quiver');
        if (name === 'cursed-figurine')
            assert.equal(engine.state.inventory.some(object => object.otyp === FIGURINE), false, 'the transformed figurine must be consumed');
        if (name === 'leash-removal')
            assert.equal(engine.state.inventory.some(object => object.otyp === LEASH), false, 'eating must consume the leash');
        if (name === 'leashed-pet-death') {
            assert.ok(engine.state.inventory.some(object => object.otyp === LEASH), 'the leash must survive its pet');
            assert.ok(engine.state.inventory.filter(object => object.otyp === LEASH).every(object => !object.leashmon),
                'a dead pet must leave no inventory leash attached');
        }
        if (name === 'deadbook-pacification')
            assert.ok(engine.state.level?.monsters.some(monster => MONSTER_NAME[monster.mnum] === 'human zombie' && monster.mpeaceful),
                'the blessed book must pacify visible undead');
        if (name === 'divine-spell-teaching')
            assert.ok((engine.state.spells?.length ?? 0) > 2, 'divine teaching must add a spell without a book');
    });
}
