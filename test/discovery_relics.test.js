import assert from 'node:assert/strict';
import test from 'node:test';
import { artifactByName, discoverArtifact } from '../js/artifacts.js';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { AMULET_OF_YENDOR, BELL_OF_OPENING, SPE_BOOK_OF_THE_DEAD } from '../js/object_data.js';
import { recordObjectEncounter, recordObjectKnowledge } from '../js/object_knowledge.js';
import { freshObjectRoom } from './support/object-room.js';
import { planInput } from './support/planned-input.js';
void test('discoveries show encountered relics separately and keep the unidentified Amulet out of that section', async (t) => {
    freshObjectRoom();
    recordObjectEncounter(AMULET_OF_YENDOR);
    recordObjectEncounter(SPE_BOOK_OF_THE_DEAD);
    recordObjectKnowledge(BELL_OF_OPENING);
    const input = resetInputState();
    planInput(input, t, [{
            prompt: /Unique items or Relics\s*\n  Bell of Opening\s*\n  papyrus spellbook\s*\nAmulets/,
            keys: ' ',
        }]);
    await rhack('\\'.charCodeAt(0));
    assert.equal(game.context.move, 0);
});
void test('an artifact discovery alone opens the discoveries list with its alignment and base type', async (t) => {
    freshObjectRoom();
    const artifact = artifactByName('Excalibur');
    assert.ok(artifact);
    discoverArtifact(artifact.id);
    const input = resetInputState();
    planInput(input, t, [{ prompt: /Artifacts\s*\n  Excalibur \[lawful long sword\]/, keys: ' ' }]);
    await rhack('\\'.charCodeAt(0));
    assert.equal(game.context.move, 0);
});
//# sourceMappingURL=discovery_relics.test.js.map