import assert from 'node:assert/strict';
import test from 'node:test';
import { game } from '../js/gstate.js';
import { sicknessDialogue } from '../js/hero_illness.js';
import { SICK_NONVOMITABLE } from '../js/const.js';
import { setPropertyTimeout } from '../js/properties.js';
import { slimeDialogue } from '../js/slime.js';
import { freshObjectRoom } from './support/object-room.js';
import { knownObject } from './support/game-objects.js';
import { BLINDFOLD } from '../js/object_data.js';
void test('hallucinating at Death\'s door includes Death inviting the hero in', async () => {
    freshObjectRoom();
    setPropertyTimeout('hallucination', 20);
    game.u.sickType = SICK_NONVOMITABLE;
    game.u.sickTurns = 3;
    const messages = [];
    await sicknessDialogue({ publish: message => { messages.push(message); } });
    assert.match(messages.join('\n'), /^You are at Death's door\.  (He is|She is|It is|They are) inviting you in\.$/);
});
void test('a blindfold hides the slime countdown color change', async () => {
    freshObjectRoom();
    game.ublindf = await knownObject(BLINDFOLD, { initialize: false });
    game.u.slimedTurns = 9;
    const messages = [];
    await slimeDialogue({ publish: message => { messages.push(message); } });
    assert.equal(messages.length, 0);
});
//# sourceMappingURL=timeout_dialogue.test.js.map