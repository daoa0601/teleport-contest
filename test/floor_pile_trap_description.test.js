import assert from 'node:assert/strict';
import test from 'node:test';
import { RUST_TRAP } from '../js/const.js';
import { game } from '../js/gstate.js';
import { APPLE } from '../js/object_data.js';
import { autopickupAtHero } from '../js/pickup.js';
import { floorObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
void test('inspecting a small floor pile mentions its known trap first', async () => {
    const level = freshObjectRoom({ flags: { pickup: false } });
    addTrap(level, RUST_TRAP, 10, 10, { tseen: true });
    await floorObject(APPLE, 10, 10);
    await autopickupAtHero();
    assert.equal(game._pending_message, 'There is a rust trap here.  You see here an uncursed apple.');
});
//# sourceMappingURL=floor_pile_trap_description.test.js.map