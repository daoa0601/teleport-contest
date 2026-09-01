import test from 'node:test';
import assert from 'node:assert/strict';

import { runClaimedCorpseRevivalTimer } from '../js/corpse_revival.js';
import { ROOM } from '../js/const.js';
import { GameMap } from '../js/game.js';
import { game, resetGame } from '../js/gstate.js';
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

const PM_GIANT = 169;
const PM_HUMAN_ZOMBIE = 244;
const PM_GIANT_ZOMBIE = 247;

function freshState() {
    resetGame();
    game.u = {
        ux: 13, uy: 10,
        ux0: 13, uy0: 10,
        uz: { dnum: 0, dlevel: 8 },
        ulevel: 8,
        uhp: 40, uhpmax: 40,
        acurr: { a: [12, 12, 12, 12, 12, 12] },
        ualign: { type: 0, record: 0 },
    };
    game.moves = 40;
    game.flags = {};
    game.context = {};
    game.inventory = [];
    game.mvitals = [];
    game.level = new GameMap();
    game.level.monsters = [];
    for (let x = 7; x <= 16; x++) {
        for (let y = 6; y <= 14; y++) {
            game.level.at(x, y).typ = ROOM;
        }
    }
    game.in_mklev = false;
    initRng(700n);
    init_objects();
}

function monster(m_id, mnum, mx, my, hp, level) {
    return {
        m_id, mnum, mx, my,
        mux: game.u.ux, muy: game.u.uy,
        m_lev: level,
        mhp: hp, mhpmax: hp,
        movement: 12,
        mcanmove: 1,
        mcansee: 1,
        mpeaceful: 0,
        mtame: 0,
        minvent: [], inventory: [],
    };
}

test('a zombie attacks a nearby giant and the giant rises as a zombie',
    async () => {
        freshState();
        const zombie = monster(901, PM_HUMAN_ZOMBIE, 10, 10, 30, 8);
        const giant = monster(902, PM_GIANT, 11, 10, 8, 6);
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
