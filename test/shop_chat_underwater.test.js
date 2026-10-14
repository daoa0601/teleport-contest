import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DAGGER } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
void test('a submerged customer cannot request shop quotes or spend a chat turn', async () => {
    freshObjectRoom();
    await createStaffedShop();
    await floorObject(DAGGER, 10, 10);
    game.u.uinwater = true;
    resetInputState().feed('chat\n');
    await rhack('#'.charCodeAt(0));
    assert.equal(game._pending_message, 'Your speech is unintelligible underwater.');
    assert.equal(game.context.move, 0);
});
//# sourceMappingURL=shop_chat_underwater.test.js.map