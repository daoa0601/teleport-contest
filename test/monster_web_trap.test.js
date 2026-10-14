import assert from 'node:assert/strict';
import test from 'node:test';
import { WEB } from '../js/const.js';
import { canSeeMonster, canSpotMonster } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resumeDeferredMonsterTrap, triggerImmediateMonsterTrap } from '../js/monmove.js';
import { monsterName } from '../js/monster_name.js';
import { initRng } from '../js/rng.js';
import { freshMonsterTrapRoom } from './support/monster-traps.js';
for (const species of ['goblin', 'bugbear']) {
    void test(`a sensed but unseen ${species} entering a web leaves later hallucinated descriptions unchanged`, async () => {
        const { monster, trap, level } = await freshMonsterTrapRoom(WEB, {
            room: { hero: { unblind_telepat_range: 64 } },
            monster: { species, minvis: true },
        });
        requirePlayingGame(game);
        game.u.hallucinationTurns = 20;
        assert.equal(canSeeMonster(monster), false);
        assert.equal(canSpotMonster(monster), true);
        const action = await triggerImmediateMonsterTrap(monster, game);
        initRng(1n);
        const nextDescription = monsterName(monster);
        initRng(1n);
        const messages = [];
        await resumeDeferredMonsterTrap(action, game, {
            publish: async (message) => { messages.push(message); },
        });
        assert.deepEqual(messages, species === 'bugbear'
            ? ['You hear the roaring of a confused bear!'] : []);
        assert.equal(monster.mtrapped, 1);
        assert.equal(level.traps.includes(trap), true);
        assert.equal(trap.tseen, false);
        assert.equal(monsterName(monster), nextDescription);
    });
}
//# sourceMappingURL=monster_web_trap.test.js.map