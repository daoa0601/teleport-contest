import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { scatterFloorObjects } from '../js/scatter.js';
import { installPunishedHero } from './support/hero-state.js';
import { freshObjectRoom } from './support/object-room.js';
void test('scattering a punishment chain shatters it and frees the hero', async () => {
    freshObjectRoom();
    const { chain } = await installPunishedHero();
    const messages = [];
    await scatterFloorObjects(10, 10, 1, {
        mayDestroy: false, mayFracture: false, mayHitHero: false,
        random: () => 0, rollOne: () => 1,
        publish: async (message) => { messages.push(message); },
    });
    assert.equal(game.u.punished, false);
    assert.equal(chain.where, 'gone');
    assert.ok(messages.includes('The chain shatters!'));
});
//# sourceMappingURL=scatter_punishment.test.js.map