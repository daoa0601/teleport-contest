import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRecipe, validateRecipeRecording } from '../scripts/holdout/recipes.mjs';
import type { RecipeRecording } from '../scripts/holdout/recipes.mjs';
import { createSessionDriver } from '../scripts/lib/session-driver.mjs';
import { Engine } from '../js/jsmain.js';
import { GameDisplay } from '../js/game_display.js';
import { memoryStorage } from './support/memory-storage.js';
import { capturedScreen, screenText } from './support/screen.js';

function recording(messages: readonly string[]): RecipeRecording {
    return { version: 5, segments: [{ steps: ['', ...messages, ''].map((message, index) => ({
        screen: `${message}\nDlvl:1 HP:120(120) Pw:80(80) AC:3 Xp:20 T:${index + 1}`,
    })) }] };
}

const completed = [
    { name: 'leprechaun-purse', effects: ['Your purse feels lighter.'] },
    { name: 'leprechaun-floor-gold', effects: ['The leprechaun quickly snatches some gold from between your feet!'] },
    { name: 'monkey-theft', effects: ['The monkey steals a dagger!'] },
    { name: 'demon-seduction', effects: ['The succubus murmurs in your ear, while helping you undress.',
        'You seem to have enjoyed it more than the succubus...'] },
    { name: 'shade-slowing', effects: ['You slow down.'] },
    { name: 'disease-sting', effects: ['You feel deathly sick.', 'You feel completely healed.'] },
    { name: 'demon-bribery', effects: ['The horned devil vanishes, laughing about cowardly mortals.'] },
    { name: 'displaced-priest', effects: ['"Talk?  Here is what I have to say!"'] },
    { name: 'temple-donation', effects: ['The priest asks you for a contribution for the temple.',
        'You give the priest 20000 zorkmids.', '"Thou hast been rewarded for thy devotion."'] },
    { name: 'lycanthropy-cure', effects: ['You turn into a werewolf!', 'You feel purified.'] },
    { name: 'shapechanger-protection', effects: ['i - a ring of protection from shape changers (on left hand).',
        'You were wearing a ring of protection from shape changers.'] },
    { name: 'golem-elements', effects: ['It is mildly chilly.'] },
    { name: 'golem-petrification', effects: ["Now it's a stone golem."] },
    { name: 'demon-summoning', effects: ['A skeleton appears in a cloud of smoke!'] },
    { name: 'shrieker-response', effects: ['The shrieker shrieks.'] },
    { name: 'cube-container-meal', effects: ['The gelatinous cube engulfs a sack.'] },
    { name: 'worm-corpse-meal', effects: ['The purple worm eats a newt corpse!'] },
    { name: 'food-taming', effects: ['The dog devours a tripe ration.'] },
    { name: 'pet-mimic-meal', effects: ['The dog eats a small mimic corpse!', 'You see a tripe ration appear where your dog was!'] },
    { name: 'wizard-harassment', effects: ['The Wizard of Yendor casts a spell!'] },
];

for (const { name, effects } of completed) {
    void test(`${name} requires its completed effects`, () => {
        const result = validateRecipeRecording(name, recording(effects));
        assert.equal(result.ok, true, JSON.stringify(result));
        for (const missing of effects.keys()) {
            const incomplete = validateRecipeRecording(name, recording(effects.filter((_, index) => index !== missing)));
            assert.equal(incomplete.ok, false, `accepted without ${effects[missing]}`);
        }
    });
    void test(`${name} rejects creation, inventory and unanswered prompts`, () => {
        const result = validateRecipeRecording(name, recording([
            'Create what kind of monster?', 'The leprechaun appears.', 'The Wizard of Yendor appears.',
            'What do you want to use or apply?', 'In what direction?', 'How much will you offer?',
            'a - a ring of protection from shape changers', 'b - a small mimic corpse', 'Never mind.',
        ]));
        assert.equal(result.ok, false, JSON.stringify(result));
    });
}

void test('a mimic meal can disguise a pet as another creature', () => {
    assert.equal(validateRecipeRecording('pet-mimic-meal', recording([
        'Your dog eats an uncursed small mimic corpse.',
        'You see a housecat appear where your dog was!',
    ])).ok, true);
});

void test('the shapechanger recipe equips and removes its protection ring through commands', async () => {
    const plan = makeRecipe('shapechanger-protection', { seed: 13, datetime: '20000110090000',
        character: { role: 'wizard', race: 'human', gender: 'male', align: 'neutral' } });
    const segment = plan.segments[0];
    assert.ok(segment);
    const engine = new Engine({ ...segment, display: new GameDisplay(null), storage: memoryStorage() });
    await engine.runUntilInputNeeded();
    const driver = createSessionDriver(segment.driver);
    let woreRing = false;
    for (let inputs = 0; inputs < 700; inputs++) {
        const key = driver.nextKey(screenText(capturedScreen(engine)).split('\n'));
        if (key === null) break;
        engine.inputGate.feed(key);
        await engine.runUntilInputNeeded();
        woreRing ||= engine.state.uleft != null || engine.state.uright != null;
    }
    assert.equal(driver.exhausted, true, 'ring recipe must finish within 700 inputs');
    assert.equal(woreRing, true, 'the protection ring must be equipped before removal');
    assert.equal(engine.state.uleft ?? null, null);
    assert.equal(engine.state.uright ?? null, null);
});
