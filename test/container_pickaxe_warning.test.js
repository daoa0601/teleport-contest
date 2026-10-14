import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { PICK_AXE, SACK } from '../js/object_data.js';
import { resetInputState } from '../js/input.js';
import { applyInventoryObject } from './support/commands.js';
import { answerPrompts } from './support/input-boundaries.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { createStaffedShop } from './support/shop.js';
void test('taking personal picks out of a bag in a shop warns only once that move', async () => {
    freshPlayableRoom();
    await createStaffedShop({ keeperX: 14 });
    const sack = await addInventoryObject(SACK, { invlet: 'a', initialize: false, cknown: true });
    const first = await knownObject(PICK_AXE, { where: 'contained', container: sack, nomerge: true });
    const second = await knownObject(PICK_AXE, { where: 'contained', container: sack, nomerge: true });
    sack.contents = [first, second];
    game.moves = 40;
    const input = resetInputState();
    await answerPrompts(applyInventoryObject(sack, 'oab\n'), input, [
        { prompt: /You sneaky cad!  Get out of here with that pick![\s\S]*--More--/, keys: ' ' },
    ]);
    assert.equal(game.inventory.includes(first), true);
    assert.equal(game.inventory.includes(second), true);
});
//# sourceMappingURL=container_pickaxe_warning.test.js.map