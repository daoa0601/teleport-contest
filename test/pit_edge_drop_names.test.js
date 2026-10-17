import test from 'node:test';
import assert from 'node:assert/strict';
import { PIT } from '../js/const.js';
import { landFloorObject } from '../js/floor_effects.js';
import { game } from '../js/gstate.js';
import { ELVEN_ARROW } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
// C do.c:flooreffects() names an object falling into the pit the hero is
// teetering at with the(xname(obj)) or Tobjnam(obj, "tumble"): the
// unidentified appearance, and a pluralized stack without its count.
for (const [blind, quantity, expected] of [
    [true, 1, 'You hear the runed arrow tumble downwards.'],
    [false, 1, 'The runed arrow tumbles into the pit.'],
    [false, 3, 'The runed arrows tumble into the pit.'],
]) {
    void test(`${quantity} unidentified elven arrow${quantity > 1 ? 's' : ''} falling into a pit${blind ? ' unseen' : ''}`, async () => {
        const level = freshObjectRoom({ hero: { blindTurns: blind ? 50 : 0 } });
        const { ux, uy } = game.u;
        addTrap(level, PIT, ux, uy, { tseen: true });
        const arrows = await knownObject(ELVEN_ARROW, {
            quan: quantity, known: false, typeKnown: false,
        });
        const messages = [];
        await landFloorObject(arrows, ux, uy, {
            publish: async (message) => { messages.push(message); },
        });
        assert.deepEqual(messages, [expected]);
    });
}
//# sourceMappingURL=pit_edge_drop_names.test.js.map