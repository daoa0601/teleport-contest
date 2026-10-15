import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { createGasCloudSelection, runLevelRegions } from '../js/regions.js';
import { freshObjectRoom } from './support/object-room.js';
void test('submersion protects the hero from gas without poison resistance', async () => {
    freshObjectRoom({ hero: { uinwater: 1, blindTurns: 5 } });
    await createGasCloudSelection(game, [{ x: 10, y: 10 }], 5, 8, async () => { });
    const hp = game.u.uhp;
    const messages = [];
    await runLevelRegions(game, { publish: async (message) => { messages.push(message); }, rollOne: () => 1 });
    assert.equal(game.u.uhp, hp);
    assert.deepEqual(messages, []);
});
//# sourceMappingURL=region_underwater.test.js.map