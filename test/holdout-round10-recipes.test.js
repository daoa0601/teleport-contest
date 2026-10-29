import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRecipe, validateRecipeRecording } from '../scripts/holdout/recipes.mjs';
import { createSessionDriver } from '../scripts/lib/session-driver.mjs';
import { Engine } from '../js/jsmain.js';
import { GameDisplay } from '../js/game_display.js';
import { MSLOW } from '../js/const.js';
import { heroGoldAmount } from '../js/hero_gold.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { RUBY, SACK } from '../js/object_data.js';
import { hasIntrinsicProperty, propertyTimeout } from '../js/properties.js';
import { memoryStorage } from './support/memory-storage.js';
import { capturedScreen, screenText } from './support/screen.js';
async function playRecipe(name, { seed = 13, gender = 'male', observe, stopWhen } = {}) {
    const plan = makeRecipe(name, { seed, datetime: '20000110090000',
        character: { role: 'wizard', race: 'human', gender, align: 'neutral' } });
    const segment = plan.segments[0];
    assert.ok(segment);
    const engine = new Engine({ ...segment, display: new GameDisplay(null), storage: memoryStorage() });
    await engine.runUntilInputNeeded();
    const driver = createSessionDriver(segment.driver);
    const screens = [];
    for (let inputs = 0; inputs < 1800; inputs++) {
        const screen = screenText(capturedScreen(engine));
        screens.push(screen);
        observe?.(engine, screen);
        if (stopWhen?.(screen))
            break;
        const key = driver.nextKey(screen.split('\n'));
        if (key === null)
            break;
        engine.inputGate.feed(key);
        await engine.runUntilInputNeeded();
    }
    const messages = screens.map(screen => screen.split('\n').slice(0, 3).join('\n')).join('\n');
    if (!stopWhen)
        assert.equal(driver.exhausted, true, `${name} must finish within 1800 inputs`);
    const recording = { version: 5, segments: [{ steps: screens.map(screen => ({ screen })) }] };
    return { engine, messages, recording };
}
function said(messages, effect) {
    const recent = [...new Set(messages.split('\n').filter(Boolean))].slice(-8).join('\n');
    assert.ok(effect.test(messages), `Expected ${effect}; last messages:\n${recent}`);
}
void test('a leprechaun steals carried gold and leaves the hero poorer', async () => {
    const { engine, messages } = await playRecipe('leprechaun-purse');
    said(messages, /Your purse feels lighter\./);
    assert.ok(heroGoldAmount(engine.state) < 1000);
});
void test('a leprechaun takes floor gold while the hero keeps the remaining purse', async () => {
    const { engine, messages } = await playRecipe('leprechaun-floor-gold');
    said(messages, /snatches some gold from between your feet/);
    assert.equal(heroGoldAmount(engine.state), 500);
});
void test('a monkey transfers an item from the hero to its own inventory', async () => {
    const carried = new Set();
    let stolen = false;
    const { messages } = await playRecipe('monkey-theft', { seed: 1, observe(engine) {
            for (const object of engine.state.inventory)
                carried.add(object.o_id);
            stolen ||= engine.state.level?.monsters.some(monster => monster.mnum === MONSTER_NAME.indexOf('monkey')
                && monster.minvent?.some(object => carried.has(object.o_id))) ?? false;
        } });
    said(messages, /monkey (?:steals|stole)/i);
    assert.equal(stolen, true, 'the stolen object must reach the monkey');
});
const genders = ['male', 'female'];
for (const gender of genders) {
    void test(`a ${gender} hero completes seduction with an opposite-gender demon`, async () => {
        let demonGender;
        const { messages } = await playRecipe('demon-invitation', { gender, observe(engine) {
                const demon = engine.state.level?.monsters.find(monster => monster.mnum === MONSTER_NAME.indexOf('amorous demon'));
                if (demon)
                    demonGender = demon.female;
            } });
        assert.equal(demonGender, gender === 'male', 'the demon must have the opposite gender');
        said(messages, /Time stands still while you and/);
        said(messages, /enjoyed it more/);
    });
}
void test('a shade removes the speed gained before the encounter', async () => {
    let wasFast = false;
    const { engine, messages } = await playRecipe('shade-slowing', { observe(engine) {
            wasFast ||= hasIntrinsicProperty('fast', null, engine.state);
        } });
    assert.equal(wasFast, true);
    said(messages, /You slow down\./);
    assert.equal(hasIntrinsicProperty('fast', null, engine.state), false);
    assert.equal(propertyTimeout('fast', engine.state), 0);
});
void test('full healing cures the illness caused by a disease sting', async () => {
    let sick = false;
    let cured = false;
    await playRecipe('disease-sting', { observe(engine) {
            const remaining = propertyTimeout('sick', engine.state);
            cured ||= sick && remaining === 0;
            sick ||= remaining > 0;
        } });
    assert.equal(sick, true, 'the sting must cause illness before the cure');
    assert.equal(cured, true, 'full healing must cure the infection before another sting can reinfect');
});
void test('a demon bribe spends the offered gold and removes Geryon without command counts', async () => {
    const { engine, messages } = await playRecipe('demon-bribery');
    said(messages, /vanishes, laughing about cowardly mortals/);
    assert.equal(heroGoldAmount(engine.state), 0);
    assert.equal(engine.state.level?.monsters.some(monster => monster.mnum === MONSTER_NAME.indexOf('Geryon')), false);
    assert.doesNotMatch(messages, /Count:|Wait!  There's something there you can't see/);
});
void test('a priest outside a temple turns hostile when asked to chat', async () => {
    const { engine, messages } = await playRecipe('displaced-priest');
    said(messages, /Thou wouldst have words|Talk\?  Here is what|Pilgrim, I would speak no longer/);
    const priest = engine.state.level?.monsters.find(monster => monster.mnum === MONSTER_NAME.indexOf('aligned cleric'));
    assert.ok(priest);
    assert.equal(!!priest.mpeaceful, false);
});
void test('a temple contribution spends gold and lowers armor class through bought protection', async () => {
    let previousAC;
    const { engine, messages } = await playRecipe('temple-donation', { seed: 1, observe(engine, screen) {
            if (screen.includes('How much will you offer'))
                previousAC ??= engine.state.u.uac;
        } });
    said(messages, /Thou hast been rewarded for thy devotion/);
    assert.ok(heroGoldAmount(engine.state) <= 10000, 'the priest must receive the offered gold');
    assert.ok(previousAC !== undefined);
    assert.ok((engine.state.u.ublessed ?? 0) > 0);
    assert.equal(engine.state.u.uac, previousAC - (engine.state.u.ublessed ?? 0));
    assert.doesNotMatch(messages, /Count:/);
});
void test('werewolf meat permits beast form and holy water removes lycanthropy', async () => {
    let infected = false;
    let beast = false;
    const wolf = MONSTER_NAME.indexOf('werewolf');
    const { engine } = await playRecipe('lycanthropy-cure', { observe(engine) {
            infected ||= engine.state.u.ulycn === wolf;
            beast ||= engine.state.u.umonnum === wolf;
        } });
    assert.equal(infected, true);
    assert.equal(beast, true);
    assert.equal(engine.state.u.ulycn, -1);
});
void test('the shapechanger recipe equips and removes its protection ring through commands', async () => {
    let woreRing = false;
    const { engine } = await playRecipe('shapechanger-protection', { observe(engine) {
            woreRing ||= engine.state.uleft != null || engine.state.uright != null;
        } });
    assert.equal(woreRing, true);
    assert.equal(engine.state.uleft ?? null, null);
    assert.equal(engine.state.uright ?? null, null);
});
void test('passive jelly cold slows an attacking flesh golem', async () => {
    const { engine, messages } = await playRecipe('golem-elements');
    said(messages, /is mildly chilly/);
    const golem = engine.state.level?.monsters.find(monster => monster.mnum === MONSTER_NAME.indexOf('flesh golem'));
    assert.ok(golem);
    assert.equal(golem.mspeed, MSLOW);
});
void test('a flesh golem survives cockatrice contact as a stone golem', async () => {
    let fleshId;
    let becameStone = false;
    await playRecipe('golem-petrification', { observe(engine) {
            const golems = engine.state.level?.monsters ?? [];
            fleshId ??= golems.find(monster => monster.mnum === MONSTER_NAME.indexOf('flesh golem'))?.m_id;
            becameStone ||= golems.some(monster => monster.m_id === fleshId && monster.mnum === MONSTER_NAME.indexOf('stone golem'));
        } });
    assert.equal(becameStone, true, 'the same golem must survive with a stone body');
});
void test('a bone devil summons skeletons during combat', async () => {
    const { engine, messages } = await playRecipe('demon-summoning');
    said(messages, /skeleton appears in a/i);
    assert.ok(engine.state.level?.monsters.some(monster => monster.mnum === MONSTER_NAME.indexOf('skeleton')));
});
void test('awakened shriekers cry out beside the hero', async () => {
    const { messages } = await playRecipe('shrieker-response');
    said(messages, /shrieker shrieks\./i);
});
void test('a cube eats a sack and keeps its ruby contents', async () => {
    let filledSack = false;
    const { engine, messages } = await playRecipe('cube-container-meal', { observe(engine) {
            filledSack ||= engine.state.inventory.some(object => object.otyp === SACK
                && object.contents?.some(content => content.otyp === RUBY));
        } });
    assert.equal(filledSack, true);
    said(messages, /gelatinous cube (?:eats|devours|engulfs)/i);
    assert.ok(engine.state.level?.monsters.some(monster => monster.mnum === MONSTER_NAME.indexOf('gelatinous cube')
        && monster.minvent?.some(object => object.otyp === RUBY)));
});
void test('a purple worm eats the corpse left on the floor', async () => {
    const { messages } = await playRecipe('worm-corpse-meal', { seed: 1 });
    said(messages, /purple worm eats [^.\n]*newt corpse/i);
});
void test('feeding a wild dog makes it tame', async () => {
    let wild = false;
    const { engine, messages } = await playRecipe('food-taming', { observe(engine) {
            wild ||= engine.state.level?.monsters.some(monster => monster.mnum === MONSTER_NAME.indexOf('dog') && !monster.mtame) ?? false;
        } });
    assert.equal(wild, true);
    said(messages, /dog (?:eats|devours) [^.\n]*tripe/i);
    assert.ok(engine.state.level?.monsters.some(monster => monster.mnum === MONSTER_NAME.indexOf('dog') && monster.mtame));
});
void test('a pet adopts a disguise after eating a mimic corpse', async () => {
    let disguised = false;
    const { messages } = await playRecipe('pet-mimic-meal', { observe(engine) {
            disguised ||= engine.state.level?.monsters.some(monster => !!monster.mtame && (monster.m_ap_type ?? 0) !== 0) ?? false;
        } });
    said(messages, /dog (?:eats|devours) [^.\n]*mimic corpse/i);
    assert.equal(disguised, true);
});
void test('the Wizard casts combat spells and can clone himself', async () => {
    const { engine, messages } = await playRecipe('wizard-harassment');
    said(messages, /Wizard of Yendor casts a spell/);
    assert.equal(engine.state.context.no_of_wizards, 2);
});
void test('an unanswered real offer does not count as a completed bribe', async () => {
    const { engine, messages, recording } = await playRecipe('demon-bribery', {
        stopWhen: screen => screen.includes('How much will you offer?'),
    });
    said(messages, /How much will you offer\?/);
    assert.equal(heroGoldAmount(engine.state), 1000);
    assert.equal(validateRecipeRecording('demon-bribery', recording).ok, false);
});
//# sourceMappingURL=holdout-round10-recipes.test.js.map