import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requirePlayingGame } from '../js/gstate.js';
import { artifactObject } from './support/game-objects.js';
import { invokeInventoryObject } from './support/commands.js';
import { freshObjectRoom } from './support/object-room.js';
void test('an ignored invocation observes an artifact the sighted hero has not examined yet', async () => {
    freshObjectRoom({ role: 'healer' });
    requirePlayingGame(game);
    const staff = await artifactObject('The Staff of Aesculapius', {
        invlet: 'a', where: 'inventory', age: 100, dknown: false,
    });
    game.inventory = [staff];
    await invokeInventoryObject(staff);
    assert.equal(staff.dknown, true);
    assert.ok(staff.age > 100);
    assert.equal(game.context.move, 1);
});
//# sourceMappingURL=artifact_invoke_cooldown.test.js.map