import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRecipe, validateRecipeRecording } from '../scripts/holdout/recipes.mjs';
import { createSessionDriver } from '../scripts/lib/session-driver.mjs';
import { Engine } from '../js/jsmain.js';
import { GameDisplay } from '../js/game_display.js';
import { CREAM_PIE, TOWEL } from '../js/object_data.js';
import { memoryStorage } from './support/memory-storage.js';
import { capturedScreen, screenText } from './support/screen.js';
function recording(messages) {
    return { version: 5, segments: [{ steps: ['', ...messages, ''].map((message, index) => ({
                    screen: `${message}\nDlvl:1 HP:120(120) Pw:80(80) AC:3 Xp:20 T:${index + 1}`,
                })) }] };
}
const completed = [
    { name: 'coin-flipping', effects: ['You flip a gold piece.', 'It comes up heads.'] },
    { name: 'pie-cleanup', effects: ["You can't see through all the sticky goop on your face.", "You've got the glop off."] },
    { name: 'candelabrum-lighting', effects: ['You attach 7 candles to the Candelabrum of Invocation.',
            "The Candelabrum of Invocation's candles burn brightly!", 'You snuff the candles.'] },
    { name: 'burning-oil', effects: ['You light your potion.  It gives off a dim light.', 'You burn your face.'] },
    { name: 'grappling-practice', effects: ['Where do you want to hit?', 'You hook yourself!'] },
    { name: 'pet-leashing', effects: ['You slip the leash around your little dog.'] },
    { name: 'pet-recalling', effects: ['You produce a strange whistling sound.', 'Two creatures shift locations.'] },
    { name: 'corpse-diagnosis', effects: ['You determine that this unfortunate being is dead.'] },
    { name: 'mirror-reflection', effects: ['You look as handsome as ever.'] },
    { name: 'artifact-venom', effects: ['A splash of venom hits the stairs.'] },
    { name: 'artifact-radiance', effects: ['You are blinded by the flash!'] },
    { name: 'artifact-energy', effects: ['You feel lackluster.', 'You feel re-energized.'] },
    { name: 'potion-alchemy', effects: ['The potion of healing mixes with the potion of speed...', 'BOOM!  They explode!'] },
    { name: 'class-genocide', effects: ['Wiped out all liches.'] },
    { name: 'punishment-removal', effects: ['You are being punished for your misbehavior!',
            'You feel like someone is helping you.', 'You see here a heavy iron ball.'] },
];
for (const { name, effects } of completed) {
    void test(`${name} accepts completed effects and requires every effect`, () => {
        const result = validateRecipeRecording(name, recording(effects));
        assert.equal(result.ok, true, JSON.stringify(result));
        for (const missing of effects.keys()) {
            const incomplete = validateRecipeRecording(name, recording(effects.filter((_, index) => index !== missing)));
            assert.equal(incomplete.ok, false, `accepted without ${effects[missing]}`);
        }
    });
    void test(`${name} rejects unanswered commands and inventory alone`, () => {
        const result = validateRecipeRecording(name, recording([
            'What do you want to use or apply?', 'What do you want to invoke?', 'What do you want to read?',
            'Where do you want to hit?', 'Never mind.',
            'a - a magic whistle\nb - the Candelabrum of Invocation\nc - a scroll of genocide',
        ]));
        assert.equal(result.ok, false, JSON.stringify(result));
    });
}
void test('a missed grappling cast counts only after aiming without cancellation', () => {
    assert.equal(validateRecipeRecording('grappling-practice', recording([
        'Where do you want to hit?', 'Nothing happens.',
    ])).ok, true);
    for (const messages of [
        ['Nothing happens.'],
        ['Where do you want to hit?', 'Never mind.', 'Nothing happens.'],
        ['Where do you want to hit?', 'What do you want to zap?', 'Nothing happens.'],
    ])
        assert.equal(validateRecipeRecording('grappling-practice', recording(messages)).ok, false);
});
void test('punishment removal requires the ball to remain without its chain', () => {
    assert.equal(validateRecipeRecording('punishment-removal', recording([
        'You are being punished for your misbehavior!', 'You feel like someone is helping you.',
        'Things that are here:\n  a heavy iron ball (chained to you)\n  an iron chain',
    ])).ok, false);
});
void test('the pie cleanup recipe consumes one pie and removes its blindness through live commands', async () => {
    const plan = makeRecipe('pie-cleanup', { seed: 7, datetime: '20000110090000',
        character: { role: 'knight', race: 'human', gender: 'male', align: 'lawful' } });
    const segment = plan.segments[0];
    assert.ok(segment);
    const engine = new Engine({ ...segment, display: new GameDisplay(null), storage: memoryStorage() });
    await engine.runUntilInputNeeded();
    const driver = createSessionDriver(segment.driver);
    let initialPies = 0;
    let sawGoop = false;
    for (let inputs = 0; inputs < 400; inputs++) {
        const key = driver.nextKey(screenText(capturedScreen(engine)).split('\n'));
        if (key === null)
            break;
        engine.inputGate.feed(key);
        await engine.runUntilInputNeeded();
        const pies = engine.state.inventory.find(object => object.otyp === CREAM_PIE);
        if (initialPies === 0 && pies)
            initialPies = pies.quan;
        if ((engine.state.u.ucreamed ?? 0) > 0)
            sawGoop = true;
    }
    assert.equal(driver.exhausted, true, 'pie cleanup must finish within 400 inputs');
    assert.equal(sawGoop, true, 'applying the pie must cover the hero with goop');
    assert.equal(engine.state.u.ucreamed, 0);
    assert.equal(engine.state.u.blindTurns ?? 0, 0);
    assert.equal(engine.state.inventory.find(object => object.otyp === CREAM_PIE)?.quan ?? 0, initialPies - 1);
    assert.ok(engine.state.inventory.some(object => object.otyp === TOWEL));
});
//# sourceMappingURL=holdout-round6-recipes.test.js.map