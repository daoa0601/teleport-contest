import test from 'node:test';
import assert from 'node:assert/strict';
import { DOOR, SDOOR } from '../js/const.js';
import { automaticSearch } from '../js/detect.js';
import { plineWithContinuation } from '../js/display.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
void test('automatic searching appends a discovery to the preceding weapon hit', async () => {
    const level = freshObjectRoom({ gameplaySeed: 811n });
    const door = level.requireAt(9, 10);
    door.typ = SDOOR;
    installPagerInput(resetInputState(), { expected: /lash|hidden door/, limit: 40 });
    for (let attempt = 0; attempt < 100 && door.typ === SDOOR; attempt++) {
        await plineWithContinuation('You lash the tengu.');
        await automaticSearch();
    }
    assert.equal(door.typ, DOOR, 'Repeated searching must discover the adjacent door');
    assert.match(game._pending_message, /You lash the tengu\.  You find a hidden door\./);
});
//# sourceMappingURL=automatic_search_messages.test.js.map