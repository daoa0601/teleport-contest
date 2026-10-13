import test from 'node:test';
import assert from 'node:assert/strict';
import { DUST } from '../js/const.js';
import { pline } from '../js/display.js';
import { makeEngravingAt } from '../js/engrave.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { GOLD_PIECE } from '../js/object_data.js';
import { autopickupAtHero } from '../js/pickup.js';
import { floorObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';
void test('reading dust after picking up gold appends the location before paging the inscription', async () => {
    freshObjectRoom({ flags: { pickup: true } });
    const engraving = makeEngravingAt(10, 10, 'a faded warning', null, 0, DUST);
    await floorObject(GOLD_PIECE, 10, 10, { quan: 37 });
    const input = resetInputState();
    await answerPrompts(autopickupAtHero(), input, [
        { prompt: /\$ - 37 gold pieces\.  Something is written here in the dust\.--More--/, keys: ' ' },
    ]);
    assert.equal(game._pending_message, 'You read: "a faded warning".');
    assert.equal(engraving?.eread, true);
});
void test('a short dust inscription and a short existing line fit without a pager', async () => {
    freshObjectRoom();
    makeEngravingAt(10, 10, 'Hi', null, 0, DUST);
    await pline('Gold.');
    await autopickupAtHero();
    assert.equal(game._pending_message, 'Gold.  Something is written here in the dust.  You read: "Hi".');
});
//# sourceMappingURL=engraving_arrival_messages.test.js.map