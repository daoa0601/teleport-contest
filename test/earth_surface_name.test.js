import assert from 'node:assert/strict';
import test from 'node:test';
import { DOOR, ROOM } from '../js/const.js';
import { game } from '../js/gstate.js';
import { surfaceName } from '../js/terrain_name.js';
import { freshObjectRoom } from './support/object-room.js';
import { createSpecialLevel } from './support/topology.js';
void test('the Plane of Earth has ground where an ordinary room has a floor', () => {
    const level = freshObjectRoom();
    level.requireAt(10, 10).typ = ROOM;
    assert.equal(surfaceName(10, 10), 'floor');
    game.earth_level = createSpecialLevel({ dnum: 4, dlevel: 1 });
    game.u.uz = { dnum: 4, dlevel: 1 };
    assert.equal(surfaceName(10, 10), 'ground');
    level.requireAt(11, 10).typ = DOOR;
    assert.equal(surfaceName(11, 10), 'doorway');
});
//# sourceMappingURL=earth_surface_name.test.js.map