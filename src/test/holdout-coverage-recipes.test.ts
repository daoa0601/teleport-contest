import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRecipeRecording } from '../scripts/holdout/recipes.mjs';
import type { RecipeRecording } from '../scripts/holdout/recipes.mjs';

function recording(messages: string[], depths: readonly number[] = []): RecipeRecording {
    return { version: 5, segments: [{ steps: ['', ...messages, ''].map((message, index) => ({
        screen: `${message}\nDlvl:${depths[index] ?? 1} HP:120(120) Pw:80(80) AC:3 Xp:20 T:${index + 1}`,
    })) }] };
}

const effects = [
    { name: 'artifact-ammunition', messages: ['What do you want to invoke?', 'm - 12 blessed +0 arrows.'] },
    { name: 'artifact-portals', messages: ['You are surrounded by a shimmering sphere!'], depths: [1, 3, 1] },
    { name: 'artifact-recharging', messages: ['What do you want to charge?', 'Your wand of light glows blue for a moment.'] },
    { name: 'corpse-tinning', messages: ['What do you want to tin?', 'l - a blessed tin of lizard meat.', 'You consume homemade lizard.'] },
    { name: 'equipment-greasing', messages: ['You cover your cloak with a thick layer of grease.', 'You coat your gloves with grease.'] },
    { name: 'trap-setting', messages: ['You begin setting your bear trap.', 'You finish arming the bear trap.'] },
    { name: 'crystal-scrying', messages: ['You peer into the crystal ball...', 'You see Delphi, far below you.'] },
    { name: 'wand-breaking', messages: ['Raising your wand of light high above your head, you break it in two!'] },
    { name: 'dragon-breath', messages: ['You turn into a red dragon!', "You don't feel hot!", 'You return to human form!'] },
];

for (const { name, messages, depths } of effects) {
    void test(`${name} requires every completed native effect`, () => {
        const complete = validateRecipeRecording(name, recording(messages, depths));
        assert.equal(complete.ok, true, JSON.stringify(complete));
        for (let index = 0; index < messages.length; index++) {
            const incomplete = validateRecipeRecording(name, recording(messages.filter((_, i) => i !== index), depths));
            assert.equal(incomplete.ok, false, `accepted without ${messages[index]}`);
        }
    });

    void test(`${name} rejects cancelled prompts and inventory alone`, () => {
        const result = validateRecipeRecording(name, recording([
            'What do you want to use or apply?', 'Never mind.',
            'i - a tinning kit\nj - a crystal ball\nk - the Longbow of Diana\nl - a wand of light',
            'Become what kind of monster?',
        ]));
        assert.equal(result.ok, false, JSON.stringify(result));
    });
}

void test('a cancelled invocation cannot count arrows already in the pack as newly created ammunition', () => {
    const result = validateRecipeRecording('artifact-ammunition', recording([
        'What do you want to invoke?', 'Never mind.', 'm - 12 blessed +0 arrows.',
    ]));
    assert.equal(result.ok, false, JSON.stringify(result));
});

void test('scrying needs a vision after peering, rather than the symbol-selection prompt', () => {
    const result = validateRecipeRecording('crystal-scrying', recording([
        'What do you look for?', 'Never mind.', 'You see Delphi, far below you.',
    ]));
    assert.equal(result.ok, false, JSON.stringify(result));
});

void test('a scrying vision can share the native message line with the peering announcement', () => {
    const result = validateRecipeRecording('crystal-scrying', recording([
        "You peer into the crystal ball...  You see Medusa's lair, far below.",
    ]));
    assert.equal(result.ok, true, JSON.stringify(result));
});

void test('a portal announcement without a dungeon-level change is incomplete', () => {
    assert.equal(validateRecipeRecording('artifact-portals', recording([
        'You are surrounded by a shimmering sphere!',
    ])).ok, false);
});
