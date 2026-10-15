import assert from 'node:assert/strict';
import test from 'node:test';
import { NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { attackMonsterWithMonster } from '../js/monmove.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
for (const species of ['iron golem', 'air elemental']) {
    void test(`a level-zero ${species} gains a level after growing beyond four HP`, async () => {
        freshObjectRoom({ flags: { verbose: false } });
        requirePlayingGame(game);
        game.air_level = { ...game.u.uz, flags: { town: false }, alignment: 0 };
        const attacker = await createMonsterAt(species, 11, 10, NO_MINVENT);
        attacker.m_lev = 0;
        attacker.mhp = attacker.mhpmax = 4;
        const defender = await createMonsterAt('orc', 12, 10, NO_MINVENT);
        defender.m_lev = 1;
        defender.mhp = 1;
        defender.msleeping = 1;
        pushKeys(' '.repeat(30));
        await attackMonsterWithMonster(attacker, defender, {
            state: game, random: () => 1,
            rollDice: count => count, rollOne: limit => limit === 2 ? 2 : 1,
        });
        assert.equal(defender.dead, true);
        assert.equal(attacker.m_lev, 1);
        assert.equal(attacker.mhpmax, 5);
    });
}
//# sourceMappingURL=monster_growth_zero_level.test.js.map