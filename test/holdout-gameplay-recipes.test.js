import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRecipeRecording } from '../scripts/holdout/recipes.mjs';
import { selectRecipes } from '../scripts/holdout/recipe-selection.mjs';
import { decodeManifest } from '../scripts/holdout/types.mjs';
function recording(messages) {
    return { version: 5, segments: [{ steps: ['', ...messages, ''].map((screen, index) => ({
                    screen: `${screen}\nDlvl:1 HP:100(100) Pw:40(40) AC:3 Xp:20 T:${index + 1}`,
                })) }] };
}
const effects = [
    { name: 'lock-cycle', messages: ['You succeed in unlocking the chest.', 'You succeed in locking the chest.'] },
    { name: 'force-lock', messages: ['You start bashing it with your war hammer.', 'You succeed in forcing the lock.'] },
    { name: 'digging-holes', messages: ['You start digging downward.', 'You dig a pit in the floor.', 'You dig a hole through the floor.'] },
    { name: 'trap-disarming', messages: ['A dart trap.', 'You disarm the trap.'] },
    { name: 'polymorph-abilities', messages: ['You turn into a shrieker!', 'You shriek.', 'You return to human form!'] },
    { name: 'artifact-invoking', messages: ['You float up.', 'You float gently to the floor.', 'You feel that the Heart of Ahriman is ignoring you.'] },
    { name: 'spell-variety', messages: ['You add "light" to your repertoire, as \'b\'.', 'Cast which spell?', 'The lit field surrounds you!', 'You add "protection" to your repertoire, as \'c\'.', 'Cast which spell?', 'The golden haze around you becomes more dense.'] },
    { name: 'fountain-dipping', messages: ['You wash your gloved hands in the water.', 'The cool draught refreshes you.'] },
    { name: 'riding-cycle', messages: ['You mount the saddled pony.', 'You dismount the saddled pony.'] },
];
for (const { name, messages } of effects) {
    void test(`${name} accepts completed native effects and rejects each missing effect`, () => {
        const accepted = validateRecipeRecording(name, recording(messages));
        assert.equal(accepted.ok, true, JSON.stringify(accepted));
        for (let index = 0; index < messages.length; index++) {
            const incomplete = validateRecipeRecording(name, recording(messages.filter((_, i) => i !== index)));
            assert.equal(incomplete.ok, false, `accepted recording without: ${messages[index]}`);
        }
    });
    void test(`${name} rejects cancelled commands and mere inventory labels`, () => {
        const result = validateRecipeRecording(name, recording([
            'What do you want to use or apply?', 'Never mind.',
            'i - a spellbook of light\nj - a pick-axe\nk - the Heart of Ahriman',
            'Become what kind of monster? [type the name]',
        ]));
        assert.equal(result.ok, false, JSON.stringify(result));
    });
}
void test('generator recipe selection preserves the requested order and rejects invalid names', () => {
    assert.deepEqual(selectRecipes('riding-cycle, digging-holes'), ['riding-cycle', 'digging-holes']);
    for (const value of ['', 'unknown-recipe', 'riding-cycle,', 'riding-cycle,riding-cycle', 'constructor'])
        assert.throws(() => selectRecipes(value), /recipe/);
});
void test('resuming a recording batch retains its recipe selection and validates names as strings', () => {
    const manifest = { version: 1, tier: 'dev-private', sealed: false, created: '2000-01-10',
        attempts: 0, accepted: [], rejected: [], pending: [],
        configuration: { kinds: ['recipe'], recipes: ['riding-cycle', 'digging-holes'] } };
    assert.deepEqual(decodeManifest(manifest).configuration.recipes, ['riding-cycle', 'digging-holes']);
    assert.throws(() => decodeManifest({ ...manifest,
        configuration: { kinds: ['recipe'], recipes: [42] } }), /recipes/);
});
void test('learning books followed by unrelated effects cannot substitute for casting spells', () => {
    const learned = ['You learn "healing".', 'You add "cure sickness" to your repertoire, as \'b\'.'];
    for (const commands of [[], ['Cast which spell?', 'Never mind.']]) {
        const result = validateRecipeRecording('spell-variety', recording([
            ...learned, ...commands, 'You feel better.', '', 'You are not ill.',
        ]));
        assert.equal(result.ok, false, JSON.stringify(result));
    }
});
//# sourceMappingURL=holdout-gameplay-recipes.test.js.map