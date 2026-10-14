import assert from 'node:assert/strict';
import test from 'node:test';
import { DOOR, D_BROKEN } from '../js/const.js';
import { rhack } from '../js/cmd.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { PICK_AXE } from '../js/object_data.js';
import { updateHeroRoomMembership } from '../js/room.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
import { withMessagePages } from './support/planned-input.js';
for (const direction of ['exit', 'entry']) {
    void test(`a keeper blocks diagonal ${direction} through a broken entrance on a level of shops`, async () => {
        freshObjectRoom({ left: 3, right: 68,
            hero: { ux: direction === 'exit' ? 9 : 8, uy: direction === 'exit' ? 11 : 10 } });
        requirePlayingGame(game);
        const { shopkeeper, roomno } = await createStaffedShop({ left: 9, keeperX: 9, doorX: 8 });
        // Several shops share this level, as in a shopping district.
        for (const left of [22, 36, 50])
            await createStaffedShop({ left, right: left + 5, keeperX: left + 1 });
        shopkeeper.eshk.shknam = 'Ada';
        shopkeeper.eshk.debit = direction === 'exit' ? 25 : 0;
        const door = game.level.requireAt(8, 10);
        door.typ = DOOR;
        door.doormask = D_BROKEN;
        door.roomno = roomno;
        door.edge = true;
        if (direction === 'entry')
            await addInventoryObject(PICK_AXE);
        updateHeroRoomMembership(game);
        const { ux, uy } = game.u;
        await withMessagePages(() => rhack((direction === 'exit' ? 'y' : 'n').charCodeAt(0)), resetInputState(), /blocks your way|intact doorway/, 2);
        assert.match(game._pending_message, /Ada blocks your way!/);
        assert.equal(game.u.ux, ux);
        assert.equal(game.u.uy, uy);
        assert.equal(game.context.move, 0);
    });
}
//# sourceMappingURL=shop_diagonal_block.test.js.map