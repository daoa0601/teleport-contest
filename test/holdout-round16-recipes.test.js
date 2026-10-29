import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../js/jsmain.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { BAG_OF_TRICKS } from '../js/object_data.js';
import { GameDisplay } from '../js/game_display.js';
import { makeRecipe, validateRecipeRecording } from '../scripts/holdout/recipes.mjs';
import { createSessionDriver } from '../scripts/lib/session-driver.mjs';
import { memoryStorage } from './support/memory-storage.js';
import { capturedScreen, screenText } from './support/screen.js';
const cases = [
    ['earthquake-drumming', 'wizard', 'neutral'],
    ['snake-serenade', 'wizard', 'neutral'],
    ['nymph-serenade', 'wizard', 'neutral'],
    ['soldier-reveille', 'wizard', 'neutral'],
    ['harp-taming', 'wizard', 'neutral'],
    ['elemental-horns', 'wizard', 'neutral'],
    ['bag-release', 'wizard', 'neutral'],
    ['petrification-countdown', 'wizard', 'neutral'],
    ['slime-countdown', 'wizard', 'neutral'],
    ['sleepiness-countdown', 'wizard', 'neutral'],
    ['breathing-countdown', 'wizard', 'neutral'],
    ['weapon-enchantment', 'wizard', 'neutral'],
    ['scare-scroll-reading', 'wizard', 'neutral'],
    ['confused-level-scroll', 'wizard', 'neutral'],
    ['mail-reading', 'wizard', 'neutral'],
    ['towel-wetting-drying', 'wizard', 'neutral'],
    ['blocked-boulder', 'wizard', 'neutral'],
    ['sink-landing', 'wizard', 'neutral'],
    ['stone-flesh-statue', 'wizard', 'neutral'],
    ['magicbane-strikes', 'wizard', 'neutral'],
    ['sting-orcs', 'wizard', 'neutral'],
    ['quest-leader-chat', 'wizard', 'neutral'],
    ['quest-artifact-return', 'wizard', 'neutral'],
    ['nemesis-conversation', 'wizard', 'neutral'],
    ['angry-lawful-minions', 'knight', 'lawful'],
    ['demon-reinforcements', 'wizard', 'neutral'],
    ['astral-conflict', 'wizard', 'neutral'],
    ['astral-furies', 'wizard', 'neutral'],
    ['acid-weapon-corrosion', 'wizard', 'neutral'],
    ['lava-sinking', 'wizard', 'neutral'],
    ['adjacent-water-pit', 'wizard', 'neutral'],
    ['egg-unturning', 'wizard', 'neutral'],
    ['steed-probing', 'knight', 'lawful'],
    ['silver-shade-strikes', 'wizard', 'neutral'],
    ['skill-menu-practice', 'wizard', 'neutral'],
    ['quest-purity-refusal', 'wizard', 'neutral'],
    ['astral-guardian', 'knight', 'lawful'],
    ['terrain-chewing', 'wizard', 'neutral'],
    ['kicked-greedy-gold', 'wizard', 'neutral'],
    ['gecko-conversation', 'wizard', 'neutral'],
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
        const screens = [];
        for (let input = 0; input < 16000; input++) {
            const screen = screenText(capturedScreen(engine));
            screens.push(screen);
            let key;
            try {
                key = driver.nextKey(screen.split('\n'));
            }
            catch (cause) {
                throw new Error(`${name}: command driver failed at input ${input}\n${screen}`, { cause });
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
            .filter(Boolean).slice(-12).join('\n');
        assert.equal(evidence.ok, true, `${name}: ${evidence.checks.filter(check => !check.ok).map(check => check.check).join(', ')}\n${recent}`);
        if (name === 'snake-serenade' || name === 'nymph-serenade' || name === 'harp-taming') {
            const species = name === 'snake-serenade' ? 'snake' : name === 'nymph-serenade' ? 'wood nymph' : 'little dog';
            const monster = engine.state.level?.monsters.find(candidate => MONSTER_NAME[candidate.mnum] === species);
            assert.ok(monster?.mpeaceful, `${species} must become peaceful`);
            if (name === 'harp-taming')
                assert.ok(monster.mtame, 'the harp must tame the dog');
        }
        if (name === 'bag-release')
            assert.equal(engine.state.inventory.find(object => object.otyp === BAG_OF_TRICKS)?.spe, 7, 'releasing a monster spends one charge');
        if (name === 'quest-artifact-return')
            assert.equal(engine.state.u.uevent?.qcompleted, 1, 'the leader must recognize quest completion');
        if (name === 'quest-leader-chat' || name === 'quest-purity-refusal') {
            assert.equal(engine.state.quest_status?.met_leader, true, 'the native quest leader must have been met');
            assert.equal(engine.state.quest_status?.got_quest, false, 'an unready hero must not receive the quest');
            assert.equal(engine.state.u.uz?.dnum, 0, 'the leader must expel an unready hero to the main dungeon');
        }
        if (name === 'stone-flesh-statue')
            assert.ok(engine.state.level?.monsters.some(monster => MONSTER_NAME[monster.mnum] === 'lizard'), 'stone to flesh must create a living lizard');
    });
}
//# sourceMappingURL=holdout-round16-recipes.test.js.map