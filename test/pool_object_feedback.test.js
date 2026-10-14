import assert from 'node:assert/strict';
import test from 'node:test';
import { game } from '../js/gstate.js';
import { breakFloorObject } from '../js/object_breakage.js';
import { MIRROR } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPolymorphedHero } from './support/hero-state.js';
void test('breaking the last floor object exposes a hero hiding beneath it', async () => {
    freshObjectRoom();
    installPolymorphedHero('cave spider');
    const mirror = await floorObject(MIRROR, game.u.ux, game.u.uy);
    game.u.uundetected = true;
    await breakFloorObject(mirror, { random: () => 99, publish: () => { } });
    assert.equal(mirror.where, 'gone');
    assert.equal(!!game.u.uundetected, false);
});
//# sourceMappingURL=pool_object_feedback.test.js.map