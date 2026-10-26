import assert from 'node:assert/strict';
import test from 'node:test';
import { addBuriedObject } from '../js/buried_object.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { detectObjects } from '../js/magic_detection.js';
import { BLACK_OPAL, SPE_DETECT_TREASURE } from '../js/object_data.js';
import { uninitializedObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';
// C detect.c:browse_map() forces autodescribe on and runs getpos(); C
// getpos.c:auto_describe() renders do_screen_description(), whose object
// branch sets need_to_look so pager.c:lookat() names the buried object with
// its article and placement suffix (pager.c:look_at_object()).
void test('object detection browse describes a buried object as buried', async () => {
    freshObjectRoom({ flags: { tips: false, verbose: false } });
    requirePlayingGame(game);
    const gem = await uninitializedObject(BLACK_OPAL, { typeKnown: false, known: false, bknown: false, dknown: true });
    addBuriedObject(gem, 14, 8);
    const input = resetInputState();
    const action = detectObjects(await uninitializedObject(SPE_DETECT_TREASURE));
    try {
        await input.waitUntilBlocked();
        input.feed('o'); // cycle the cursor to the detected object
        await input.waitUntilBlocked();
        const topline = requireScreenRow(0).map(cell => cell.ch).join('').trim();
        assert.equal(topline, 'a black gem (buried)');
    }
    finally {
        input.feed('\x1b');
        await action;
    }
});
//# sourceMappingURL=detection_browse_autodescribe.test.js.map