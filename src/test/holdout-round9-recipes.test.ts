import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRecipe, validateRecipeRecording } from '../scripts/holdout/recipes.mjs';
import { createSessionDriver } from '../scripts/lib/session-driver.mjs';
import { Engine } from '../js/jsmain.js';
import { GameDisplay } from '../js/game_display.js';
import { memoryStorage } from './support/memory-storage.js';
import { capturedScreen, screenText } from './support/screen.js';
import type { RecipeRecording } from '../scripts/holdout/recipes.mjs';

function recording(messages: readonly string[]): RecipeRecording {
    return { version: 5, segments: [{ steps: ['', ...messages, ''].map((message, index) => ({
        screen: `${message}\nDlvl:1 HP:120(120) Pw:80(80) AC:3 Xp:20 T:${index + 1}`,
    })) }] };
}

const completed = [
    { name: 'jousting-lances', effects: ['You are now more skilled in lance.', 'You joust the lichen!'] },
    { name: 'spell-backfiring', effects: ['You fail to cast the spell correctly.',
        'Your knowledge of this spell is twisted.',
        'It invokes nightmarish images in your mind...'] },
    { name: 'shopkeeper-pacifying', effects: [
        'You stole 26 zorkmids worth of merchandise.  An alarm sounds!',
        'you compensate Yelpur for her losses.  Yelpur returns to her shop.'] },
    { name: 'pit-rescues', effects: ['The ogre falls into a pit!',
        'You try to reach out your arms, but the ogre backs away skeptically.'] },
    { name: 'sink-smashing', effects: ['The pipes break!  Water spurts out!'] },
    { name: 'bottled-ghosts', effects: ['As you open the bottle, an enormous ghost emerges!',
        'You are frightened to death, and unable to move.'] },
    { name: 'potion-dipping', effects: ['What do you want to dip into the potion of water?',
        'Your dagger rusts!'] },
    { name: 'quest-counsel', effects: [
        '"Ah, wizard.  We see thou hast received Our summons.',
        '"Ah, wizard.  Thou art truly ready, as no Gallant before thee hath been.'] },
    { name: 'gremlin-flashes', effects: ['The gremlin is blinded by the flash!',
        'The gremlin cries out in pain!'] },
    { name: 'seductive-thefts', effects: ['You hit the dwarf!  You steal:  i - a dagger.'] },
    { name: 'potion-sparring', effects: ['The flask crashes on the lichen and breaks into shards.'] },
    { name: 'pet-drainers', effects: ["The mind flayer's tentacles suck the ogre.  The ogre's brain is eaten!"] },
];

for (const { name, effects } of completed) {
    void test(`${name} accepts completed effects and requires each effect`, () => {
        const result = validateRecipeRecording(name, recording(effects));
        assert.equal(result.ok, true, JSON.stringify(result));
        for (const missing of effects.keys()) {
            const incomplete = validateRecipeRecording(name, recording(effects.filter((_, index) => index !== missing)));
            assert.equal(incomplete.ok, false, `accepted without ${effects[missing]}`);
        }
    });
    void test(`${name} rejects unanswered commands and inventory alone`, () => {
        const result = validateRecipeRecording(name, recording([
            'What do you want to use or apply?', 'What do you want to drink?', 'In what direction?',
            'Talk to whom? (in what direction)', 'Create what kind of monster?', 'Never mind.',
            'a - a unicorn horn\nb - a wand of cancellation\nc - a potion of speed',
        ]));
        assert.equal(result.ok, false, JSON.stringify(result));
    });
}

void test('the potion sparring recipe shatters a wielded potion on a lichen', async () => {
    const plan = makeRecipe('potion-sparring', { seed: 17, datetime: '20000110090000',
        character: { role: 'knight', race: 'human', gender: 'male', align: 'lawful' } });
    const segment = plan.segments[0];
    assert.ok(segment);
    const engine = new Engine({ ...segment, display: new GameDisplay(null), storage: memoryStorage() });
    await engine.runUntilInputNeeded();
    const driver = createSessionDriver(segment.driver);
    let sawShatter = false;
    for (let inputs = 0; inputs < 700; inputs++) {
        const key = driver.nextKey(screenText(capturedScreen(engine)).split('\n'));
        if (key === null) break;
        engine.inputGate.feed(key);
        await engine.runUntilInputNeeded();
        if (/flask crashes|breaks into shards/.test(screenText(capturedScreen(engine)))) sawShatter = true;
    }
    assert.equal(driver.exhausted, true, 'potion sparring recipe must finish within 700 inputs');
    assert.equal(sawShatter, true, 'a wielded potion must shatter on a struck monster');
});

void test('the pet drainers recipe weakens or brains an ogre through pet attacks', async () => {
    const plan = makeRecipe('pet-drainers', { seed: 11, datetime: '20000110090000',
        character: { role: 'knight', race: 'human', gender: 'male', align: 'lawful' } });
    const segment = plan.segments[0];
    assert.ok(segment);
    const engine = new Engine({ ...segment, display: new GameDisplay(null), storage: memoryStorage() });
    await engine.runUntilInputNeeded();
    const driver = createSessionDriver(segment.driver);
    let sawDrain = false;
    for (let inputs = 0; inputs < 700; inputs++) {
        const key = driver.nextKey(screenText(capturedScreen(engine)).split('\n'));
        if (key === null) break;
        engine.inputGate.feed(key);
        await engine.runUntilInputNeeded();
        if (/becomes weaker|brain is eaten/.test(screenText(capturedScreen(engine)))) sawDrain = true;
    }
    assert.equal(driver.exhausted, true, 'pet drainers recipe must finish within 700 inputs');
    assert.equal(sawDrain, true, 'a tame drainer must feed on a hostile ogre');
});
