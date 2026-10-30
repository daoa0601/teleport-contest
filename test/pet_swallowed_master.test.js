import assert from 'node:assert/strict';
import test from 'node:test';
import { NO_MINVENT } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { runMonsterAction } from '../js/monmove.js';
import { initRng } from '../js/rng.js';
import { runExtendedCommand } from './support/commands.js';
import { installSwallowedHero } from './support/hero-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a sleeping pet wakes after its swallowed master browses the terrain', async () => {
    await freshObjectRoom({ left: 10, right: 14, top: 10, bottom: 10,
        flags: { debug: true, tips: false }, hero: { blindTurns: 100 } });
    requirePlayingGame(game);
    const vortex = await createMonsterAt('dust vortex', 10, 10, NO_MINVENT);
    await installSwallowedHero(vortex);
    const dog = await createMonsterAt('little dog', 12, 10, NO_MINVENT);
    initializePet(dog);
    dog.msleeping = 1;
    await runExtendedCommand('terrain', 'd\x1b ');
    initRng(7n);
    await runMonsterAction(dog, game);
    assert.equal(game.u.uswallow, 1);
    assert.equal(dog.msleeping, 0, 'the dog notices its master and wakes up');
});
//# sourceMappingURL=pet_swallowed_master.test.js.map