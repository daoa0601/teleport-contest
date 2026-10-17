import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRecipeRecording } from '../scripts/holdout/recipes.mjs';
function recording(messages) {
    return { version: 5, segments: [{ steps: ['', ...messages, ''].map((message, index) => ({
                    screen: `${message}\nDlvl:1 HP:120(120) Pw:80(80) AC:3 Xp:20 T:${index + 1}`,
                })) }] };
}
const effects = [
    { name: 'spellbook-writing', messages: ['What type of spellbook do you want to write?',
            'The spellbook warps strangely, then turns red.'] },
    { name: 'deadbook-raising', messages: ['You turn the pages of the Book of the Dead...', 'You raised the dead!'] },
    { name: 'royal-jelly-eggs', messages: ['You smear royal jelly all over your eggs.',
            'The eggs quiver briefly.', ' j - 2 uncursed queen bee eggs'] },
    { name: 'magic-lamp-release', messages: ['In a cloud of smoke, a djinni emerges!', 'The djinni speaks.',
            'a - an uncursed oil lamp'] },
    { name: 'demon-banishing', messages: ['What do you want to invoke?',
            'The demon disappears in a cloud of brimstone!'] },
    { name: 'artifact-storms', messages: ['Where do you want to cast the spell?', 'You are caught in the fireball!'] },
    { name: 'pit-jumping', messages: ['You jump up and come back down.', 'You leap from the pit!'] },
];
for (const { name, messages } of effects) {
    void test(`${name} accepts its completed native effects and requires every effect`, () => {
        const complete = validateRecipeRecording(name, recording(messages));
        assert.equal(complete.ok, true, JSON.stringify(complete));
        for (let missing = 0; missing < messages.length; missing++) {
            const incomplete = validateRecipeRecording(name, recording(messages.filter((_, index) => index !== missing)));
            assert.equal(incomplete.ok, false, `accepted without ${messages[missing]}`);
        }
    });
    void test(`${name} rejects command prompts and inventory without a completed effect`, () => {
        const incomplete = validateRecipeRecording(name, recording([
            'What do you want to invoke?', 'What type of spellbook do you want to write?', 'Never mind.',
            'Where do you want to cast the spell?', 'Where do you want to jump?',
            'a - a magic lamp\nb - Demonbane\nc - a Book of the Dead\nd - 2 queen bee eggs',
        ]));
        assert.equal(incomplete.ok, false, JSON.stringify(incomplete));
    });
}
void test('royal jelly accepts cursed jelly killing the changed eggs', () => {
    assert.equal(validateRecipeRecording('royal-jelly-eggs', recording([
        'You smear royal jelly all over your egg.', 'The egg quivers feebly.',
        ' j - an uncursed queen bee egg',
    ])).ok, true);
});
void test('royal jelly requires the changed species in inventory when its message only says eggs', () => {
    const messages = ['You smear royal jelly all over your eggs.', 'The eggs quiver briefly.'];
    assert.equal(validateRecipeRecording('royal-jelly-eggs', recording([
        ...messages, ' j - 2 uncursed queen bee eggs',
    ])).ok, true);
    assert.equal(validateRecipeRecording('royal-jelly-eggs', recording([
        ...messages, ' j - 2 uncursed killer bee eggs',
    ])).ok, false);
});
void test('artifact storms accept cold explosions', () => {
    assert.equal(validateRecipeRecording('artifact-storms', recording([
        'Where do you want to cast the spell?', 'You are caught in the ball of cold!',
    ])).ok, true);
});
void test('written spellbooks accept multiword colors and material covers', () => {
    for (const cover of ['light blue', 'into vellum']) {
        assert.equal(validateRecipeRecording('spellbook-writing', recording([
            'What type of spellbook do you want to write?',
            `The spellbook warps strangely, then turns ${cover}.`,
        ])).ok, true);
    }
});
//# sourceMappingURL=holdout-round5-recipes.test.js.map