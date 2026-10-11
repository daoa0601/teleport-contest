import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { hitHeroWithRay } from '../js/hero_breath.js';
import { startHeroSliming } from '../js/slime.js';
import { freshRoomWithPolymorphedHero } from './support/hero-state.js';
void test('red-dragon breath burns slime without hurting its fireproof body', async () => {
    freshRoomWithPolymorphedHero('red dragon', {
        recalculateVision: false,
    });
    startHeroSliming({ state: game, turns: 10 });
    const messages = [];
    const result = await hitHeroWithRay({
        state: game,
        publish: async (message) => messages.push(message),
    });
    assert.ok(result.hit, 'The polymorphed body must have a breath attack');
    assert.equal(result.resisted, true);
    assert.equal(game.u.mh, 40);
    assert.equal(game.u.slimed, false);
    assert.deepEqual(messages, [
        "You don't feel hot!",
        'The slime that covers you is burned away!',
    ]);
});
void test('green-dragon breath cannot poison its poison-resistant body', async () => {
    freshRoomWithPolymorphedHero('green dragon', {
        recalculateVision: false,
    });
    const messages = [];
    const result = await hitHeroWithRay({
        state: game,
        publish: async (message) => messages.push(message),
    });
    assert.ok(result.hit, 'The polymorphed body must have a breath attack');
    assert.equal(result.resisted, true);
    assert.equal(game.u.uhp, 40);
    assert.equal(game.u.mh, 40);
    assert.deepEqual(messages, [
        "The poison doesn't seem to affect you.",
    ]);
});
//# sourceMappingURL=hero_breath.test.js.map