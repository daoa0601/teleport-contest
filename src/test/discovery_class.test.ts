import assert from 'node:assert/strict';
import test from 'node:test';
import { artifactByName, discoverArtifact } from '../js/artifacts.js';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { BELL_OF_OPENING, POT_HEALING, WAN_FIRE } from '../js/object_data.js';
import { recordObjectKnowledge } from '../js/object_knowledge.js';
import { applyNethackrc } from '../js/options.js';
import { freshObjectRoom } from './support/object-room.js';
import { planInput } from './support/planned-input.js';

void test('class discoveries offer the discovered classes and show only the selected class', async t => {
    freshObjectRoom();
    recordObjectKnowledge(POT_HEALING);
    recordObjectKnowledge(WAN_FIRE);
    const input = resetInputState();
    planInput(input, t, [
        { prompt: /View discoveries for which sort of objects\?[\s\S]*a - potions\s+b - wands/, keys: '/' },
        { prompt: /Discovered Wands in order of discovery\s*\n\* wand of fire/, keys: ' ' },
    ]);

    await rhack('`'.charCodeAt(0));

    assert.equal(game.context.move, 0);
});

void test('traditional class discovery accepts an undiscovered class without advertising it', async t => {
    freshObjectRoom();
    applyNethackrc('OPTIONS=menustyle:traditional');
    recordObjectKnowledge(POT_HEALING);
    const input = resetInputState();
    planInput(input, t, [{ prompt: /View discoveries for which sort of objects\? \[!\]/, keys: '/' }]);

    await rhack('`'.charCodeAt(0));

    assert.equal(game._pending_message, "You haven't discovered any wands yet.");
    assert.equal(game.context.move, 0);
});

void test('the undiscovered rock class uses the native boulders and statues name', async t => {
    freshObjectRoom();
    applyNethackrc('OPTIONS=menustyle:traditional');
    recordObjectKnowledge(POT_HEALING);
    const input = resetInputState();
    planInput(input, t, [{ prompt: /View discoveries for which sort of objects\?/, keys: '`' }]);

    await rhack('`'.charCodeAt(0));

    assert.equal(game._pending_message, "You haven't discovered any boulders/statues yet.");
});

void test('partial class discovery skips the class menu when only one class is available', async t => {
    freshObjectRoom();
    applyNethackrc('OPTIONS=menustyle:partial,sortdiscoveries:c');
    recordObjectKnowledge(POT_HEALING);
    const input = resetInputState();
    planInput(input, t, [{ prompt: /Discovered Potions in alphabetical order/, keys: ' ' }]);

    await rhack('`'.charCodeAt(0));
});

void test('class discoveries with nothing to show print the native items message', async () => {
    freshObjectRoom();

    await rhack('`'.charCodeAt(0));

    assert.equal(game._pending_message, "You haven't discovered any items yet.");
    assert.equal(game.context.move, 0);
});

void test('class discoveries accept the relic synonym and artifact class', async t => {
    freshObjectRoom();
    applyNethackrc('OPTIONS=menustyle:traditional');
    recordObjectKnowledge(BELL_OF_OPENING);
    const artifact = artifactByName('Excalibur');
    assert.ok(artifact);
    discoverArtifact(artifact.id);
    const input = resetInputState();
    planInput(input, t, [
        { prompt: /View discoveries for which sort of objects\? \[ua\(\]/, keys: 'r' },
        { prompt: /Unique items or relics\s*\n  Bell of Opening/, keys: ' ' },
        { prompt: /View discoveries for which sort of objects\?/, keys: 'a' },
        { prompt: /Artifacts\s*\n  Excalibur \[lawful long sword\]/, keys: ' ' },
    ]);

    await rhack('`'.charCodeAt(0));
    await rhack('`'.charCodeAt(0));
});

void test('the class discovery sort chooser can be cancelled before asking for a class', async t => {
    freshObjectRoom();
    recordObjectKnowledge(POT_HEALING);
    const input = resetInputState();
    input.feed('`');
    planInput(input, t, [{ prompt: /Ordering of discoveries[\s\S]*Note: full alphabetical/, keys: '\x1b' }]);

    await rhack('m'.charCodeAt(0));

    assert.equal(game.context.move, 0);
});
