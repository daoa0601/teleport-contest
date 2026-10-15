import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { PIT } from '../js/const.js';
import { CHEST } from '../js/object_data.js';
import { runExtendedCommand } from './support/commands.js';
import { floorObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { addTrap } from './support/level-state.js';
import { createSaddledSteed } from './support/monsters.js';
import { ableToLoot } from '../js/container_location.js';
void test('floor looting at a pit edge identifies the unreachable bottom of the pit', async () => {
    const level = freshPlayableRoom();
    addTrap(level, PIT, 10, 10, { tseen: true });
    const chest = await floorObject(CHEST, 10, 10, { initialize: false, lknown: false });
    await runExtendedCommand('loot');
    assert.equal(chest.lknown, false);
    assert.equal(game._pending_message, "You can't reach the bottom of the pit.");
    assert.equal(game.context.move, 0);
});
for (const command of ['loot', 'tip']) {
    void test(`a levitating unskilled rider gets the riding refusal for ${command}`, async () => {
        freshPlayableRoom();
        game.u.usteed = await createSaddledSteed('pony');
        game.u.levitating = true;
        const chest = await floorObject(CHEST, 10, 10, { initialize: false, lknown: false });
        const allowed = await ableToLoot(10, 10, command === 'loot');
        assert.equal(allowed, false);
        assert.equal(game._pending_message, "You aren't skilled enough to reach from your pony.");
        assert.equal(chest.lknown, false);
        assert.equal(game.context.move, 0);
    });
}
void test('a blind levitating hero gets the floor reach refusal before a loot menu', async () => {
    freshPlayableRoom();
    game.u.levitating = true;
    game.u.blindTurns = 10;
    const chest = await floorObject(CHEST, 10, 10, { initialize: false, lknown: false });
    await runExtendedCommand('loot');
    assert.equal(chest.lknown, false);
    assert.equal(game._pending_message, "You can't reach the floor.");
    assert.equal(game.context.move, 0);
});
//# sourceMappingURL=container_floor_reach.test.js.map