import test from 'node:test';
import assert from 'node:assert/strict';

import { runClaimedCorpseRevivalTimer } from '../js/corpse_revival.js';
import { tameMonster } from '../js/dog.js';
import { game } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { takeMonsterTurn } from '../js/monmove.js';
import { CORPSE } from '../js/object_data.js';
import {
    claimNextDueObjectTimer, OBJECT_TIMER_KIND, objectTimers,
} from '../js/object_timers.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

const PM_GIANT_ZOMBIE = 247;

function freshState() {
    freshObjectRoom({
        heroX: 13,
        heroY: 10,
        objectInitializationSeed: 700n,
        recalculateVision: false,
    });
}

test('a zombie attacks a nearby giant and the giant rises as a zombie',
    async () => {
        freshState();
        const zombie = await createMonsterAt('human zombie', 10, 10);
        Object.assign(zombie, {
            mux: game.u.ux, muy: game.u.uy,
            movement: 12, mhp: 30, mhpmax: 30, m_lev: 8,
        });
        const giant = await createMonsterAt('giant', 11, 10);
        Object.assign(giant, {
            mux: game.u.ux, muy: game.u.uy,
            movement: 12, mhp: 8, mhpmax: 8, m_lev: 6,
        });
        giant.name = 'Bram';

        await takeMonsterTurn(
            zombie, game,
            () => 0,
            (count, sides) => count * sides,
            () => 1,
        );

        assert.equal(game.level.monsters.includes(giant), false);
        assert.deepEqual([zombie.mx, zombie.my], [10, 10]);
        const corpse = game.level.objects[11][10].find(
            object => object.otyp === CORPSE,
        );
        const [timer] = objectTimers(corpse);
        assert.equal(timer.kind, OBJECT_TIMER_KIND.ZOMBIFY_MON);

        game.moves = timer.deadline;
        const event = await runClaimedCorpseRevivalTimer(
            claimNextDueObjectTimer(game, game.moves), game, game.moves,
        );
        assert.equal(event.monster.mnum, PM_GIANT_ZOMBIE);
        assert.equal(event.monster.name, giant.name);
    });

test('a fatal monster attack makes a shifted vampire rise', async () => {
    freshState();
    const dragon = await createMonsterAt('red dragon', 10, 10);
    tameMonster(dragon, game);
    dragon.mhp = dragon.mhpmax = 40;
    dragon.movement = 12;
    const vampireLeader = MONSTER_NAME.indexOf('vampire leader');
    const wolf = await createMonsterAt('wolf', 11, 10);
    Object.assign(wolf, {
        mux: game.u.ux, muy: game.u.uy, movement: 12,
        mhp: 1, mhpmax: 20, m_lev: 6, cham: vampireLeader,
    });

    await takeMonsterTurn(
        dragon, game, () => 0, count => count, () => 1,
    );

    assert.equal(wolf.mnum, vampireLeader);
    assert.equal(wolf.mhp > 0, true);
    assert.equal(game.level.monsters.includes(wolf), true);
});
