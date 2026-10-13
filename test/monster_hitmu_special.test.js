import test from 'node:test';
import assert from 'node:assert/strict';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { beginMonsterHeroAttack } from '../js/monmove.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
for (const [hour, damage] of [['00', 12], ['01', 6], ['12', 6]]) {
    void test(`a wraith's touch deals ${damage} damage at recorded hour ${hour}`, async () => {
        freshObjectRoom({ hero: { uhp: 100, uhpmax: 100 } });
        requirePlayingGame(game);
        game.datetime = `20000110${hour}0000`;
        const wraith = await createMonsterAt('wraith', 11, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
        wraith.m_lev = 30;
        wraith.mux = game.u.ux;
        wraith.muy = game.u.uy;
        const attack = await beginMonsterHeroAttack(wraith, game, range => Math.min(1, range - 1), () => 1, (count, sides) => count * sides, []);
        assert.equal(attack.heroAttackSequence?.current?.damage, damage);
    });
}
//# sourceMappingURL=monster_hitmu_special.test.js.map