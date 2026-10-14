import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { CLUB, DAGGER } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { planInput } from './support/planned-input.js';
void test('#adjust immediately compacts floating letters before announcing the moved item', async (t) => {
    freshObjectRoom({ flags: { fixinv: false } });
    const dagger = await addInventoryObject(DAGGER);
    const club = await addInventoryObject(CLUB);
    const input = resetInputState();
    input.feed('adjust\r');
    planInput(input, t, [
        { prompt: /What do you want to adjust\?/, keys: dagger.invlet },
        { prompt: /Adjust letter to what/, keys: 'z' },
    ]);
    await rhack('#'.charCodeAt(0));
    assert.equal(club.invlet, 'a');
    assert.equal(dagger.invlet, 'b');
    assert.match(game._pending_message, /^Moving: b - .*dagger/);
    assert.equal(game.context.move, 0);
});
//# sourceMappingURL=inventory_adjust_floating.test.js.map