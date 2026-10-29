import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRecipe, validateRecipeRecording } from '../scripts/holdout/recipes.mjs';
import type { RecipeRecording } from '../scripts/holdout/recipes.mjs';
import { createSessionDriver } from '../scripts/lib/session-driver.mjs';
import { Engine } from '../js/jsmain.js';
import { GameDisplay } from '../js/game_display.js';
import { CORPSE, ICE_BOX, UNICORN_HORN } from '../js/object_data.js';
import { memoryStorage } from './support/memory-storage.js';
import { capturedScreen, screenText } from './support/screen.js';

function recording(messages: readonly string[]): RecipeRecording {
    return { version: 5, segments: [{ steps: ['', ...messages, ''].map((message, index) => ({
        screen: `${message}\nDlvl:1 HP:120(120) Pw:80(80) AC:3 Xp:20 T:${index + 1}`,
    })) }] };
}

const completed = [
    { name: 'restorative-draughts', effects: ['You feel strong!', 'Welcome to experience level 21.',
        'Wow!  This makes you feel great!'] },
    { name: 'perceptive-draughts', effects: ['Ooph!  This tastes like liquid fire!',
        'The feeling subsides.', 'You can see again.'] },
    { name: 'speed-draught', effects: ['Your quickness feels very natural.'] },
    { name: 'horn-curing', effects: ['A cloud of darkness falls upon you.', 'You can see again.'] },
    { name: 'ordinary-whistle', effects: ['You produce a high whistling sound.'] },
    { name: 'blindfold-removal', effects: ["You can't see any more.", 'You can see again.'] },
    { name: 'attribute-equipment', effects: ['i - a +2 ring of gain constitution (on left hand).',
        'Your gauntlets of dexterity glow silver for a moment.'] },
    { name: 'floor-cancellation', effects: ['You see here an unlabeled scroll.'] },
    { name: 'rock-fracturing', effects: ['You see here 37 rocks.'] },
    { name: 'creature-probing', effects: ['Status of the floating eye (neutral): Level 2 HP 8(8) AC 9.',
        'You probe beneath the floor.'] },
    { name: 'wand-enlightenment', effects: ['You feel self-knowledgeable...', 'The feeling subsides.'] },
    { name: 'icebox-thawing', effects: ['You put an uncursed lizard corpse into the ice box.',
        'Take out what?', 'j - an uncursed lizard corpse.'] },
    { name: 'floor-container-tipping', effects: ['Tip which container?', 'An object spills out:  an uncursed ruby.'] },
    { name: 'trapped-box-opening', effects: ['You trigger a trap!'] },
    { name: 'sleeping-gas', effects: ['A cloud of gas puts you to sleep!'] },
    { name: 'shop-trading', effects: ['You sold a dagger for 2 gold pieces.',
        'You have established 100 zorkmids credit.'] },
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
            'Tip which container?', 'Do what with the ice box?', 'Take out what?', 'Never mind.',
            'a - a unicorn horn\nb - a wand of cancellation\nc - a potion of speed',
        ]));
        assert.equal(result.ok, false, JSON.stringify(result));
    });
}

void test('ice box takeout requires a transfer after the takeout prompt', () => {
    assert.equal(validateRecipeRecording('icebox-thawing', recording([
        'j - an uncursed lizard corpse.', 'You put an uncursed lizard corpse into the ice box.',
        'Take out what?',
    ])).ok, false);
});

void test('ice box takeout accepts an encumbered transfer', () => {
    assert.equal(validateRecipeRecording('icebox-thawing', recording([
        'You put an uncursed lizard corpse into the ice box.', 'Take out what?',
        'You have a little trouble removing q - an uncursed lizard corpse.',
    ])).ok, true);
});

void test('the ice box recipe puts a corpse in and returns that corpse to inventory', async () => {
    const plan = makeRecipe('icebox-thawing', { seed: 13, datetime: '20000110090000',
        character: { role: 'wizard', race: 'human', gender: 'male', align: 'neutral' } });
    const segment = plan.segments[0];
    assert.ok(segment);
    const engine = new Engine({ ...segment, display: new GameDisplay(null), storage: memoryStorage() });
    await engine.runUntilInputNeeded();
    const driver = createSessionDriver(segment.driver);
    let storedCorpse = engine.state.inventory.find(object => object.otyp === CORPSE);
    for (let inputs = 0; inputs < 700; inputs++) {
        const key = driver.nextKey(screenText(capturedScreen(engine)).split('\n'));
        if (key === null) break;
        engine.inputGate.feed(key);
        await engine.runUntilInputNeeded();
        const contents = engine.state.inventory.find(object => object.otyp === ICE_BOX)?.contents;
        storedCorpse = contents?.find(object => object.otyp === CORPSE) ?? storedCorpse;
    }
    assert.equal(driver.exhausted, true, 'ice box recipe must finish within 700 inputs');
    assert.ok(storedCorpse, 'the corpse must enter the ice box');
    assert.ok(engine.state.inventory.includes(storedCorpse), 'the same corpse must return to inventory');
    assert.equal(engine.state.inventory.find(object => object.otyp === ICE_BOX)?.contents?.length ?? 0, 0);
});

void test('the horn recipe cures potion blindness through ordinary apply commands', async () => {
    const plan = makeRecipe('horn-curing', { seed: 11, datetime: '20000110090000',
        character: { role: 'knight', race: 'human', gender: 'male', align: 'lawful' } });
    const segment = plan.segments[0];
    assert.ok(segment);
    const engine = new Engine({ ...segment, display: new GameDisplay(null), storage: memoryStorage() });
    await engine.runUntilInputNeeded();
    const driver = createSessionDriver(segment.driver);
    let sawBlindness = false;
    for (let inputs = 0; inputs < 700; inputs++) {
        const key = driver.nextKey(screenText(capturedScreen(engine)).split('\n'));
        if (key === null) break;
        engine.inputGate.feed(key);
        await engine.runUntilInputNeeded();
        if ((engine.state.u.blindTurns ?? 0) > 0) sawBlindness = true;
    }
    assert.equal(driver.exhausted, true, 'horn recipe must finish within 700 inputs');
    assert.equal(sawBlindness, true, 'the potion must blind the hero before the horn is used');
    assert.equal(engine.state.u.blindTurns ?? 0, 0);
    assert.ok(engine.state.inventory.some(object => object.otyp === UNICORN_HORN));
});
