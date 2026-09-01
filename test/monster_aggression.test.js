import test from 'node:test';
import assert from 'node:assert/strict';

import { runClaimedCorpseRevivalTimer } from '../js/corpse_revival.js';
import { game } from '../js/gstate.js';
import {
    finishDeferredMonsterDeath, quietMonsterActionRng,
    resumeDeferredMonsterContact,
} from '../js/monmove.js';
import { CORPSE } from '../js/object_data.js';
import { init_objects } from '../js/o_init.js';
import {
    claimNextDueObjectTimer, OBJECT_TIMER_KIND, objectTimers,
} from '../js/object_timers.js';
import { initRng } from '../js/rng.js';
import { liveMonster } from './support/monsters.js';
import { freshPlayableRoom } from './support/playable-room.js';

const PM_GIANT = 169;
const PM_HUMAN_ZOMBIE = 244;
const PM_GIANT_ZOMBIE = 247;

function freshState() {
    freshPlayableRoom({
        left: 7,
        right: 16,
        top: 6,
        bottom: 14,
        heroX: 13,
        heroY: 10,
        hero: {
            uz: { dnum: 0, dlevel: 8 },
            ulevel: 8,
            uhp: 40,
            uhpmax: 40,
            acurr: { a: [12, 12, 12, 12, 12, 12] },
            ualign: { type: 0, record: 0 },
        },
    });
    game.moves = 40;
    game.flags = {};
    game.context = {};
    game.mvitals = [];
    game.in_mklev = false;
    initRng(700n);
    init_objects();
}

function arenaMonster(options) {
    return liveMonster({
        mux: game.u.ux, muy: game.u.uy,
        movement: 12,
        ...options,
    });
}

test('a zombie attacks a nearby giant and the giant rises as a zombie',
    async () => {
        freshState();
        const zombie = arenaMonster({
            m_id: 901,
            mnum: PM_HUMAN_ZOMBIE,
            x: 10, y: 10,
            hitPoints: 30,
            level: 8,
        });
        const giant = arenaMonster({
            m_id: 902,
            mnum: PM_GIANT,
            x: 11, y: 10,
            hitPoints: 8,
            level: 6,
        });
        giant.name = 'Bram';
        game.level.monsters.push(zombie, giant);
        game._deferVisibleMonsterContact = true;

        const action = quietMonsterActionRng(
            zombie, game,
            () => 0,
            () => 20,
            () => 1,
        );
        resumeDeferredMonsterContact(
            action, game, () => 0, () => 20, () => 1,
        );
        finishDeferredMonsterDeath(action, game, () => 0, () => 1);

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
