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

const completed: { name: string; effects: string[] }[] = [
    { name: 'fountain-quaffing', effects: ['Drink from the fountain?',
        'The cool draught refreshes you.', 'You unleash a water demon!'] },
    { name: 'sink-guzzling', effects: ['Drink from the sink?', 'You take a sip of cold water.'] },
    { name: 'sink-drain-dipping', effects: ['You pour one of the potions down the drain.',
        'Flupp!  Muddy waste pops up from the drain.', 'You see a ring shining in its midst.',
        'The sink transforms into a throne!'] },
    { name: 'ring-drains', effects: ['You drop the ring of teleportation down the drain.',
        'The sink vanishes.', 'The ring is regurgitated!'] },
    { name: 'monster-kicking', effects: ['You kick the lichen.'] },
    { name: 'cursed-study', effects: ['You feel a wrenching sensation.'] },
    { name: 'confused-study', effects: ['You accidentally tear the spellbook to pieces.'] },
    { name: 'amnesiac-wizardry', effects: ['You learn magic missile.', 'Who was that Maud person anyway?'] },
    { name: 'chain-lightning', effects: ['You begin to memorize the runes.', 'Currently known spells', 'You shock the lichen!'] },
    { name: 'draught-effects', effects: ['Oh wow!  Everything looks so cosmic!', 'This burns like acid!',
        "Far out, man!  You can't see yourself.", 'You suddenly fall asleep!',
        'Your feet are frozen to the stairs!', "Up, up, and awaaaay!  You're walking on air!"] },
    { name: 'polymorph-trap', effects: ['You feel a change coming over you.'] },
    { name: 'fire-trap', effects: ['A tower of flame erupts from the stairs under you!'] },
    { name: 'boulder-trap', effects: ['Click!  You trigger a rolling boulder trap!'] },
    { name: 'bear-trap', effects: ['You are caught in a bear trap.', 'A bear trap closes on your foot!', 'You are released from the bear trap.',
        'You finally wriggle free.', 'You disarm the bear trap.'] },
    { name: 'troubled-prayer', effects: ['You feel appropriately lawful.',
        'You are now wearing the cursed blindfold.', 'Your blindfold softly glows amber.'] },
    { name: 'altar-offerings', effects: ['Such an action is an insult to chaos!',
        "You'll regret this infamous offense!", 'You feel ashamed.'] },
    { name: 'shop-robbery', effects: ['You escaped the shop without paying!', 'An alarm sounds!'] },
    { name: 'steed-combat', effects: ['You put the saddle on the pony.', 'T:14 Ride',
        'You kick the saddled pony.  The saddled pony gallops!', 'You joust the lichen!'] },
    { name: 'worm-engulfing', effects: ['You swallow the ogre whole!'] },
    { name: 'exploding-form', effects: ['You explode!'] },
    { name: 'pudding-splitting', effects: ['You divide as the newt hits you!'] },
    { name: 'yellow-light-blast', effects: ['The yellow light explodes!'] },
    { name: 'silver-searing', effects: ['Silver sears the werejackal!'] },
    { name: 'demon-seduction', effects: [
        "Time stands still while you and the succubus lie in each other's arms...",
        'You seem to have enjoyed it more than the succubus...',
    ] },
];

for (const message of ['You feel that Lugh is well-pleased.', 'You can see again.', 'Your vision clears.']) {
    void test(`troubled prayer requires the blindfold repair despite: ${message}`, () => {
        const result = validateRecipeRecording('troubled-prayer', recording([
            'You feel appropriately lawful.', 'You are now wearing the cursed blindfold.', message,
        ]));
        assert.equal(result.ok, false, 'prayer must uncurse the blindfold');
    });
}

for (const message of ['The wood nymph seduces you.', 'The water nymph charms you.',
    'Time stands still while you court her.']) {
    void test(`demon seduction rejects nymph theft: ${message}`, () => {
        const result = validateRecipeRecording('demon-seduction', recording([message]));
        assert.equal(result.ok, false, 'nymph theft does not exercise demon seduction');
    });
}

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

void test('the cursed study recipe reads a cursed book through live commands', async () => {
    const plan = makeRecipe('cursed-study', { seed: 11, datetime: '20000110090000',
        character: { role: 'knight', race: 'human', gender: 'male', align: 'lawful' } });
    const segment = plan.segments[0];
    assert.ok(segment);
    const engine = new Engine({ ...segment, display: new GameDisplay(null), storage: memoryStorage() });
    await engine.runUntilInputNeeded();
    const driver = createSessionDriver(segment.driver);
    let sawBook = false;
    let sawEffect = false;
    for (let inputs = 0; inputs < 300; inputs++) {
        const key = driver.nextKey(screenText(capturedScreen(engine)).split('\n'));
        if (key === null) break;
        engine.inputGate.feed(key);
        await engine.runUntilInputNeeded();
        const text = screenText(capturedScreen(engine));
        if (/spellbook of magic missile/.test(text)) sawBook = true;
        if (/You feel a wrenching sensation\.|You feel threatened\.|too much to comprehend/.test(text)) sawEffect = true;
    }
    assert.equal(driver.exhausted, true, 'cursed study must finish within 300 inputs');
    assert.equal(sawBook, true, 'the hero must obtain the spellbook');
    assert.equal(sawEffect, true, 'the cursed book must misfire');
});

for (const character of [
    { role: 'knight', race: 'human', gender: 'male', align: 'lawful' },
    { role: 'valkyrie', race: 'human', gender: 'female', align: 'lawful' },
]) {
    void test(`the demon seduction recipe removes armor and seduces a ${character.gender} hero`, async () => {
        const plan = makeRecipe('demon-seduction', { seed: 11, datetime: '20000110090000', character });
        const segment = plan.segments[0];
        assert.ok(segment);
        const engine = new Engine({ ...segment, display: new GameDisplay(null), storage: memoryStorage() });
        await engine.runUntilInputNeeded();
        const driver = createSessionDriver(segment.driver);
        const screens: string[] = [];
        for (let inputs = 0; inputs < 400; inputs++) {
            const key = driver.nextKey(screenText(capturedScreen(engine)).split('\n'));
            if (key === null) break;
            engine.inputGate.feed(key);
            await engine.runUntilInputNeeded();
            screens.push(screenText(capturedScreen(engine)));
        }

        assert.equal(driver.exhausted, true, 'seduction must finish within 400 inputs');
        const result = validateRecipeRecording('demon-seduction', { version: 5,
            segments: [{ steps: screens.map(screen => ({ screen })) }] });
        assert.equal(result.ok, true, JSON.stringify(result));
        assert.equal(engine.state.uarm, null, 'the demon must remove the suit');
        assert.equal(engine.state.uarms, null, 'the demon must remove the shield');
    });
}
