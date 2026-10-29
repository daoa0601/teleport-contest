import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRecipe, validateRecipeRecording } from '../scripts/holdout/recipes.mjs';
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
        'thou art yet unprepared',
        'You materialize on a different level!'] },
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

void test('the quest recipe plans both a grown and a diminished visit', () => {
    const plan = makeRecipe('quest-counsel', { seed: 13, datetime: '20000110090000',
        character: { role: 'knight', race: 'human', gender: 'male', align: 'lawful' } });
    const keys = plan.segments[0]?.driver.flatMap(action => action.type === 'keys' ? [action.value] : []) ?? [];
    const joined = keys.join('|');
    assert.ok(joined.includes('#levelchange\r20\r'), 'the first visit must be grown');
    assert.ok(joined.includes('#levelchange\r2\r'), 'the second visit must be green');
    assert.ok(joined.includes('m\x16'), 'both visits levelport through the menu');
});

void test('the potion sparring recipe wields fresh potions between strikes', () => {
    const plan = makeRecipe('potion-sparring', { seed: 13, datetime: '20000110090000',
        character: { role: 'knight', race: 'human', gender: 'male', align: 'lawful' } });
    const driver = plan.segments[0]?.driver ?? [];
    const wieldCount = driver.filter(action => action.type === 'select-menu-entry'
        && action.target === 'potion of fruit juice').length;
    assert.ok(wieldCount >= 3, 'each bottle needs its own wield');
});
