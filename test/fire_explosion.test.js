import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFireExplosion } from '../js/fire_explosion.js';
import { breakFloorObject } from '../js/object_breakage.js';
import { pushKeys } from '../js/input.js';
import { beginObjectBurn } from '../js/light.js';
import { POT_OIL } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { game } from '../js/gstate.js';
import { createMonsterAt } from './support/monsters.js';
import { freshGameplayRoom } from './support/playable-room.js';
void test('a fire explosion burns the hero and monsters in adjacent squares', async () => {
    freshGameplayRoom();
    requireFixtureGame(game);
    game.u.uhp = game.u.uhpmax = 100;
    const monster = await createMonsterAt('jackal', 11, 10);
    monster.mhp = monster.mhpmax = 20;
    await createFireExplosion(11, 10, 5, {
        heroCaused: false,
        publish: async () => { },
    });
    assert.equal(game.u.uhp, 95);
    assert.equal(monster.mhp, 15);
});
for (const female of [false, true]) {
    void test(`fatal burning oil records the ${female ? 'female' : 'male'} native self-inflicted cause`, async () => {
        freshObjectRoom({ flags: { female }, hero: { uhp: 1, uhpmax: 100 } });
        requireFixtureGame(game);
        const oil = await floorObject(POT_OIL, 10, 10);
        beginObjectBurn(oil);
        pushKeys(' '.repeat(100));
        initRng(1n);
        const result = await breakFloorObject(oil);
        assert.equal(result.heroDied, true);
        assert.equal(game._deathKiller, female
            ? 'caught herself in her own burning oil'
            : 'caught himself in his own burning oil');
        assert.equal(oil.lamplit, false);
    });
}
//# sourceMappingURL=fire_explosion.test.js.map