import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requirePlayingGame } from '../js/gstate.js';
import { ARROW } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { artifactObject } from './support/game-objects.js';
import { invokeInventoryObject } from './support/commands.js';
import { freshObjectRoom } from './support/object-room.js';
import { floorObjectsAt } from './support/level-state.js';
void test('the Longbow drops conjured arrows when the hero is fumbling', async () => {
    const level = freshObjectRoom({ role: 'ranger', hero: { ualign: { type: -1, record: 10 } } });
    requirePlayingGame(game);
    grantIntrinsicProperty('fumbling', 'outside', game);
    const bow = await artifactObject('The Longbow of Diana', { invlet: 'a', where: 'inventory', age: 0 });
    game.inventory = [bow];
    await invokeInventoryObject(bow, ' '.repeat(20));
    assert.equal(game.inventory.some(object => object.otyp === ARROW), false);
    const arrows = floorObjectsAt(level, game.u.ux, game.u.uy).find(object => object.otyp === ARROW);
    assert.ok(arrows);
    assert.ok(arrows.quan > 1);
    assert.equal(arrows.where, 'floor');
    assert.match(game._pending_message, /Suddenly \d+ arrows fall out\./);
    assert.equal(game.context.move, 1);
});
//# sourceMappingURL=artifact_invoke_ammo.test.js.map