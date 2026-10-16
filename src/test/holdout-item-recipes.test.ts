import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRecipe, validateRecipeRecording } from '../scripts/holdout/recipes.mjs';
import type { RecipeRecording } from '../scripts/holdout/recipes.mjs';
import { createSessionDriver } from '../scripts/lib/session-driver.mjs';
import { Engine } from '../js/jsmain.js';
import { GameDisplay } from '../js/game_display.js';
import { memoryStorage } from './support/memory-storage.js';
import { createRoomLevel } from './support/playable-room.js';
import { capturedScreen, screenText } from './support/screen.js';

function recording(messages: string[]): RecipeRecording {
    return { version: 5, segments: [{ steps: messages.map((message, index) => ({
        screen: `${message}\nDlvl:1 HP:120(120) Pw:10(10) AC:3 Xp:20 T:${index + 1}`,
    })) }] };
}

void test('scroll recipe accepts consumed scrolls and rejects unanswered read prompts', () => {
    const result = validateRecipeRecording('scroll-reading', recording([
        'What do you want to read?',
        'As you read the scroll, it disappears.',
        'What do you want to read?',
        'As you read the scroll, it disappears.',
        'What do you want to read?',
        'You read the scroll.',
    ]));
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(validateRecipeRecording('scroll-reading', recording([
        'What do you want to read?', 'What do you want to read?',
    ])).ok, false);
});

void test('container recipe requires putting an item in and taking it back out', () => {
    const result = validateRecipeRecording('container-looting', recording([
        'What do you want to use or apply?',
        'You put a ruby into the sack.',
        'Take out what?',
        'j - a ruby.',
    ]));
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(validateRecipeRecording('container-looting', recording([
        'Do what with your sack?', 'Take out what?',
    ])).ok, false);
});

void test('potion recipe requires drinking, dipping, and breaking a thrown potion', () => {
    const messages = [
        'What do you want to drink?', 'You feel better.',
        'What do you want to drink?', 'You feel more experienced.',
        'Your dagger softly glows with a light blue aura.',
        'The potion crashes on the floor and breaks into shards.',
    ];
    assert.equal(validateRecipeRecording('potion-quaffing', recording(messages)).ok, true);
    assert.equal(validateRecipeRecording('potion-quaffing', recording(messages.slice(0, -1))).ok, false);
});

void test('hallucination counts as a completed drink with either sight or touch feedback', () => {
    for (const verb of ['looks', 'feels']) {
        const result = validateRecipeRecording('potion-quaffing', recording([
            'Your dagger softly glows with a light blue aura.',
            'The potion crashes on the floor and breaks into shards.',
            'What do you want to drink?', 'You feel better.',
            'What do you want to drink?', `Oh wow!  Everything ${verb} so cosmic!`,
        ]));
        assert.equal(result.ok, true, JSON.stringify(result));
    }
});

void test('seeded scroll recipes explore many scroll types', () => {
    const wishes = (seed: number) => {
        const plan = makeRecipe('scroll-reading', { seed, datetime: '20000110090000',
            character: { role: 'knight', race: 'human', gender: 'male', align: 'lawful' } });
        return plan.segments.flatMap(segment => segment.driver.flatMap(action =>
            action.type === 'keys' ? [...action.value.matchAll(/scroll of ([^\r]+)/g)].map(match => match[1]) : []));
    };
    const items = new Set<string | undefined>();
    for (let seed = 1; seed <= 400; seed++) {
        const first = wishes(seed);
        for (const name of first) items.add(name);
    }
    assert.ok(items.size >= 20, `400 seeds exercised only ${items.size} scroll types`);
});

void test('food recipe accepts a meal interrupted after a bite, and requires consuming the tin', () => {
    const messages = [
        'This lizard corpse is fatty.  You stop eating the lizard corpse.',
        'The tin opens like magic!', 'Eat it? [yn] (n)',
        'You consume sauteed newt.',
        'You begin eating an uncursed partly eaten food ration.',
        'The newt just misses! You stop eating the food ration.',
    ];
    assert.equal(validateRecipeRecording('eating', recording(messages)).ok, true);
    assert.equal(validateRecipeRecording('eating', recording(messages.filter(message => !message.startsWith('You consume')))).ok, false);
});

void test('prayer recipe requires a response to each prayer after an offering', () => {
    const messages = [
        'Your sacrifice is consumed in a flash of light!',
        'You begin praying to Lugh.',
        'The voice of Lugh rings out: Thou art arrogant, mortal.',
        'You begin praying to Lugh.',
        'The voice of Lugh booms: Thou hast angered me.',
    ];
    assert.equal(validateRecipeRecording('pray-variants', recording(messages)).ok, true);
    assert.equal(validateRecipeRecording('pray-variants', recording(messages.slice(0, -1))).ok, false);
});

void test('wand recipe requires spent charges and a completed self probe', () => {
    const messages = [
        'i - a wand of digging (0:5)\nj - a wand of probing (0:8)\nk - a wand of light (0:12)\nl - a wand of striking (0:6)',
        'Something is engraved here on the floor. You read: "Elbereth".',
        'Status of wizard (fervently lawful): Level 20 HP 120(120) AC 3.',
        'i - a wand of digging (0:4)\nj - a wand of probing (0:7)\nk - a wand of light (0:11)\nl - a wand of striking (0:5)',
    ];
    assert.equal(validateRecipeRecording('wand-zapping', recording(messages)).ok, true);
    assert.equal(validateRecipeRecording('wand-zapping', recording(messages.slice(0, -1))).ok, false);
});

void test('engraving and two zaps cannot substitute for the third planned zap', () => {
    const result = validateRecipeRecording('wand-zapping', recording([
        'i - a wand of digging (0:5)\nj - a wand of probing (0:8)\nk - a wand of light (0:12)\nl - a wand of striking (0:6)',
        'Something is engraved here on the floor. You read: "Elbereth".',
        'Status of wizard (fervently lawful): Level 20 HP 120(120) AC 3.',
        'i - a wand of digging (0:4)\nj - a wand of probing (0:7)\nk - a wand of light (0:11)\nl - a wand of striking (0:6)',
    ]));
    assert.equal(result.ok, false, JSON.stringify(result));
});

void test('camera blindness and unseen bag summons count as completed applications', () => {
    for (const effect of ['You are blinded by the flash!', 'Nothing seems to happen.']) {
        const messages = [
            'What do you want to use or apply?', effect,
            'What do you want to use or apply?', 'You produce a high whistling sound.',
        ];
        const result = validateRecipeRecording('tool-applying', recording(messages));
        assert.equal(result.ok, true, `${effect}: ${JSON.stringify(result)}`);
        assert.equal(validateRecipeRecording('tool-applying', recording([
            ...messages.slice(0, 1), 'Never mind.', ...messages.slice(2),
        ])).ok, false);
    }
});

void test('applying a drum in a tool recipe leaves the hero on the same square', async () => {
    const plan = makeRecipe('tool-applying', { seed: 6, datetime: '20000110090000',
        character: { role: 'knight', race: 'human', gender: 'male', align: 'lawful' } });
    const segment = plan.segments[0];
    assert.ok(segment);
    const engine = new Engine({ ...segment, display: new GameDisplay(null), storage: memoryStorage() });
    await engine.runUntilInputNeeded();
    // An open room makes an unintended direction key observable as movement.
    engine.state.level = createRoomLevel();
    engine.state.u.ux = 10;
    engine.state.u.uy = 10;
    const driver = createSessionDriver(segment.driver);
    for (let inputs = 0; inputs < 300; inputs++) {
        const key = driver.nextKey(screenText(capturedScreen(engine)).split('\n'));
        if (key === null) break;
        engine.inputGate.feed(key);
        await engine.runUntilInputNeeded();
    }
    assert.equal(driver.exhausted, true, 'tool recipe did not finish within 300 inputs');
    assert.ok((engine.state.u.deafTurns ?? 0) > 0, 'the drum must have been played');
    assert.equal(engine.state.u.ux, 10, 'tool applications must not move the hero west');
    assert.equal(engine.state.u.uy, 10, 'tool applications must not move the hero north');
});

void test('wizard help content is accepted after its document opens', () => {
    const messages = [
        'Debug-Mode Quick Reference:',
        '(human knight called wizard)', 'Current Attributes', 'The Dungeons of Doom',
    ];
    const result = validateRecipeRecording('help-pager', recording(messages));
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(validateRecipeRecording('help-pager', recording([
        'List of wizard-mode commands.\nSelect one item:', ...messages.slice(1),
    ])).ok, false);
});

void test('wear recipe requires ring and amulet cycles as well as armor and a curse refusal', () => {
    const messages = [
        'You finish your dressing maneuver.', 'You finish taking off your boots.',
        'k - an uncursed ring of searching (on right hand).',
        'You were wearing an uncursed ring of searching (on right hand).',
        'l - an uncursed amulet of guarding (being worn).',
        'You were wearing an uncursed amulet of guarding.',
        "You can't. It is cursed.",
    ];
    assert.equal(validateRecipeRecording('wear-cycle', recording(messages)).ok, true);
    assert.equal(validateRecipeRecording('wear-cycle', recording(messages.filter(message => !message.includes('amulet')))).ok, false);
});
