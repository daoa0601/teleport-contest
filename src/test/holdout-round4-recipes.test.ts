import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRecipeRecording } from '../scripts/holdout/recipes.mjs';
import type { RecipeRecording } from '../scripts/holdout/recipes.mjs';

function recording(messages: string[]): RecipeRecording {
    return { version: 5, segments: [{ steps: ['', ...messages, ''].map((message, index) => ({
        screen: `${message}\nDlvl:1 HP:120(120) Pw:80(80) AC:3 Xp:20 T:${index + 1}`,
    })) }] };
}

const effects = [
    { name: 'shop-purchases', messages: ['You bought a food ration for 45 gold pieces.',
        '"Thank you for shopping in Asidonhopo\'s general store!"'] },
    { name: 'magic-instruments', messages: ['You start playing your magic flute.', 'You produce soft music.'] },
    { name: 'figurine-activation', messages: ['You set the figurine on the ground and it transforms.'] },
    { name: 'artifact-healing', messages: ['What do you want to invoke?', 'You feel better.'] },
    { name: 'artifact-untrapping', messages: ['What do you want to invoke?', 'You disarm it!'] },
    { name: 'undead-turning', messages: ['Calling upon Lugh, you chant an arcane formula.',
        'You destroy the kobold zombie!', 'You can move again.'] },
    { name: 'monster-gaze', messages: ['You turn into an umber hulk!', 'Your gaze confuses the newt!', 'You return to human form!'] },
    { name: 'altar-water', messages: ['You sit on the altar.', 'You finish your prayer.',
        'The potions on the altar glow light blue for a moment.'] },
];

for (const { name, messages } of effects) {
    void test(`${name} requires its completed native effects`, () => {
        const result = validateRecipeRecording(name, recording(messages));
        assert.equal(result.ok, true, JSON.stringify(result));
        for (let index = 0; index < messages.length; index++) {
            const incomplete = validateRecipeRecording(name, recording(messages.filter((_, i) => i !== index)));
            assert.equal(incomplete.ok, false, `accepted without ${messages[index]}`);
        }
    });

    void test(`${name} rejects cancelled commands and inventory alone`, () => {
        const result = validateRecipeRecording(name, recording([
            'What do you want to invoke?', 'Never mind.',
            'a - the Staff of Aesculapius\nb - a figurine of a kitten\nc - a magic flute',
            'You do not owe Asidonhopo anything.',
        ]));
        assert.equal(result.ok, false, JSON.stringify(result));
    });
}

for (const purchase of [
    'A mirror; you bought it for 10 gold pieces.',
    '2 leather cloaks; you bought them for 80 gold pieces.',
]) {
    void test(`shop-purchases accepts merchandise identified at payment: ${purchase}`, () => {
        const result = validateRecipeRecording('shop-purchases', recording([
            purchase, '"Thank you for shopping in Asidonhopo\'s general store!"',
        ]));
        assert.equal(result.ok, true, JSON.stringify(result));
    });

    void test(`shop-purchases still requires acknowledgment after identification: ${purchase}`, () => {
        const result = validateRecipeRecording('shop-purchases', recording([purchase]));
        assert.equal(result.ok, false, JSON.stringify(result));
    });
}

void test('a cancelled healing invocation cannot claim an unrelated recovery', () => {
    assert.equal(validateRecipeRecording('artifact-healing', recording([
        'What do you want to invoke?', 'Never mind.', 'You feel better.',
    ])).ok, false);
});

void test('magical music accepts harp and earthquake effects', () => {
    for (const effect of ['Your magic harp produces very attractive music.',
        'The entire dungeon is shaking around you!']) {
        assert.equal(validateRecipeRecording('magic-instruments', recording([
            'You start playing your instrument.', effect,
        ])).ok, true);
    }
});

void test('a figurine that shatters after the transformation announcement is rejected', () => {
    const result = validateRecipeRecording('figurine-activation', recording([
        'You set the figurine on the ground and it transforms.',
        'The figurine writhes and then shatters into pieces!',
    ]));
    assert.equal(result.ok, false, JSON.stringify(result));
});
