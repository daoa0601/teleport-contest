import assert from 'node:assert/strict';
import test from 'node:test';
import { A_WIS } from '../js/const.js';
import { game } from '../js/gstate.js';
import { learnObjectType } from '../js/object_knowledge.js';
import { freshObjectRoom } from './support/object-room.js';
void test('generic class placeholders cannot be discovered or credit Wisdom', () => {
    freshObjectRoom();
    const exercise = game.u._exercise?.[A_WIS];
    learnObjectType(8);
    assert.equal(game._knownObjectTypes?.has(8), false);
    assert.equal(game._encounteredObjectTypes?.has(8), false);
    assert.equal(game.u._exercise?.[A_WIS], exercise);
});
//# sourceMappingURL=discovery_generic.test.js.map