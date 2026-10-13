import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { surfaceName } from '../js/terrain_name.js';
import { freshConnectedLevels } from './support/connected-levels.js';
void test('stairs and ladders provide a stair surface for objects landing on them', () => {
    for (const ladder of [false, true]) {
        freshConnectedLevels({ ladder });
        assert.equal(surfaceName(10, 10), 'stairs');
        assert.equal(surfaceName(11, 10, game), 'floor');
    }
});
//# sourceMappingURL=stair_surface.test.js.map