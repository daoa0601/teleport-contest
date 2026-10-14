import test from 'node:test';
import assert from 'node:assert/strict';
import { G_NOCORPSE, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { AD_PHYS } from '../js/monster_attack_types.js';
import { finishMonsterKilled } from '../js/monster_death.js';
import { CORPSE, ROCK, STATUE } from '../js/object_data.js';
import { floorObjectsAt } from './support/level-state.js';
import { createMonsterAt, requireMonsterVital } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a combat death respects the species current no-corpse flag', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const giant = await createMonsterAt('hill giant', 11, 10, NO_MINVENT);
    requireMonsterVital(giant.mnum).mvflags |= G_NOCORPSE;
    const death = await finishMonsterKilled(giant, game, {
        damageType: AD_PHYS, cause: null, publish: async () => { },
    });
    assert.equal(death.corpse, null);
    assert.equal(floorObjectsAt(level, 11, 10).some(object => object.otyp === CORPSE), false);
});
for (const [species, type] of [['clay golem', ROCK], ['stone golem', STATUE]]) {
    void test(`a killed ${species} leaves remains protected from the current beam`, async () => {
        const level = freshObjectRoom();
        requirePlayingGame(game);
        const monster = await createMonsterAt(species, 11, 10, NO_MINVENT);
        game.context.bypasses = true;
        const death = await finishMonsterKilled(monster, game, {
            damageType: AD_PHYS, cause: null, publish: async () => { },
        });
        assert.ok(death.corpse);
        assert.equal(death.corpse.otyp, type);
        assert.equal(death.corpse.bypass, true);
        assert.equal(floorObjectsAt(level, 11, 10).includes(death.corpse), true);
    });
}
//# sourceMappingURL=monster_special_remains.test.js.map