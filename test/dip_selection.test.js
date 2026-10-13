import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DAGGER, GOLD_PIECE } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';
void test('dip offers carried equipment and excludes coins', async () => {
    freshObjectRoom();
    const dagger = await addInventoryObject(DAGGER);
    await addInventoryObject(GOLD_PIECE, { quan: 80 });
    const input = resetInputState();
    input.feed('dip\n');
    const dipping = rhack('#'.charCodeAt(0));
    await input.waitUntilBlocked();
    const prompt = requireScreenRow(0).map(cell => cell.ch).join('').trimEnd();
    input.feed('\x1b');
    await dipping;
    assert.equal(prompt, `What do you want to dip? [${dagger.invlet} or ?*]`);
    assert.equal(game.context.move, 0);
});
//# sourceMappingURL=dip_selection.test.js.map