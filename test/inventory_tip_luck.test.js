import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { addObjectToContainer } from '../js/object_container.js';
import { BAG_OF_HOLDING, MIRROR, SACK, WAN_CANCELLATION } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
void test('a mirror shattered by tipping into a bag of holding does not cost luck', async () => {
    freshObjectRoom({ hero: { uhp: 100, uhpmax: 100, uluck: 0 } });
    const source = await addInventoryObject(SACK, { initialize: false, cknown: true });
    const target = await addInventoryObject(BAG_OF_HOLDING, { initialize: false, cknown: true });
    const wand = await knownObject(WAN_CANCELLATION, { initialize: false, spe: 1 });
    const mirror = await knownObject(MIRROR, { initialize: false });
    await addObjectToContainer(source, wand);
    await addObjectToContainer(target, mirror);
    const input = resetInputState();
    await answerPrompts(rhack('i'.charCodeAt(0)), input, [
        { prompt: /Tools/, keys: source.invlet },
        { prompt: /T - Tip all the contents out of this container/, keys: 'T' },
    ]);
    initRng(1n);
    const tipping = rhack(0);
    await input.waitUntilBlocked();
    installPagerInput(input, { expected: /tumbles|explosion|shatter/, limit: 8 });
    input.feed(target.invlet);
    await tipping;
    assert.equal(mirror.where, 'gone');
    assert.equal(target.where, 'gone');
    assert.equal(game.u.uluck, 0);
    assert.equal(game.context.move, 1);
});
//# sourceMappingURL=inventory_tip_luck.test.js.map