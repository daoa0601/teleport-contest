import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { APPLE, POT_OBJECT_DETECTION, SCR_STINKING_CLOUD } from '../js/object_data.js';
import { detectObjects } from '../js/magic_detection.js';
import { recordObjectKnowledge } from '../js/object_knowledge.js';
import { addInventoryObject, floorObject, uninitializedObject } from './support/game-objects.js';
import { readInventoryObject } from './support/commands.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshPlayableRoom } from './support/playable-room.js';
void test('object detection joins its short announcement with getpos instructions without a pager', async () => {
    freshPlayableRoom({ flags: { tips: false, verbose: true } });
    await floorObject(APPLE, 14, 10);
    const potion = await uninitializedObject(POT_OBJECT_DETECTION);
    const input = resetInputState();
    const result = await answerPrompts(detectObjects(potion), input, [
        { prompt: /You detect the presence of objects\.  \(For instructions type a '\?'\)/, keys: '\x1b' },
    ]);
    assert.equal(result.result, 0);
});
void test('stinking cloud acknowledges its long question before showing getpos instructions', async () => {
    freshPlayableRoom({ flags: { tips: false, verbose: true } });
    recordObjectKnowledge(SCR_STINKING_CLOUD);
    const scroll = await addInventoryObject(SCR_STINKING_CLOUD, { initialize: false });
    const input = resetInputState();
    await answerPrompts(readInventoryObject(scroll), input, [
        { prompt: /As you read the scroll, it disappears\.--More--/, keys: ' ' },
        { prompt: /Where do you want to center the stinking cloud\?--More--/, keys: ' ' },
        { prompt: /^\(For instructions type a '\?'\)/, keys: '\x1b' },
    ]);
    assert.equal(game.level?.regions.length, 0);
    assert.match(game._pending_message, /Never mind\./);
});
//# sourceMappingURL=getpos_hint_topline.test.js.map