import test from 'node:test';
import assert from 'node:assert/strict';

import {
    G_GENOD, MV_KNOWS_EGG, ROOM,
} from '../js/const.js';
import {
    finishEggHatchTimer, runClaimedEggHatchTimer,
} from '../js/egg.js';
import { GameMap } from '../js/game.js';
import { game, resetGame } from '../js/gstate.js';
import { mksobj, place_object } from '../js/mklev.js';
import { EGG } from '../js/object_data.js';
import { init_objects } from '../js/o_init.js';
import {
    claimNextDueObjectTimer, OBJECT_TIMER_KIND, objectTimers,
} from '../js/object_timers.js';
import { initRng } from '../js/rng.js';
import {
    cansee, vision_recalc, vision_reset_new_level,
} from '../js/vision.js';
import { objectWeight } from '../js/weight.js';

process.env.TELEPORT_BRIDGE_FREE = '1';
process.env.TELEPORT_DISABLE_FIXTURES = '1';

function freshEggState(seed) {
    resetGame();
    game.u = {
        ux: 10, uy: 10,
        uz: { dnum: 0, dlevel: 8 },
        ulevel: 8,
        uhp: 40, uhpmax: 40,
        acurr: { a: Array(6).fill(12) },
        amax: { a: Array(6).fill(12) },
        uhave: {},
        blindTurns: 0,
        deafTurns: 0,
    };
    game.flags = { female: true };
    game.context = { move: 0, nopick: false };
    game.moves = 2;
    game.mvitals = [];
    game.inventory = [];
    game.level = new GameMap();
    game.level.monsters = [];
    for (let x = 8; x <= 16; x++) {
        for (let y = 7; y <= 13; y++) {
            const location = game.level.at(x, y);
            location.typ = ROOM;
            location.lit = true;
        }
    }
    game.in_mklev = false;
    vision_reset_new_level();
    vision_recalc(0);
    assert.equal(cansee(12, 10), true);

    initRng(999n);
    init_objects();
    initRng(BigInt(seed));
}


function hatchTimer(egg) {
    const timers = objectTimers(egg);
    assert.equal(timers.length, 1);
    assert.equal(timers[0].kind, OBJECT_TIMER_KIND.HATCH_EGG);
    assert.equal(timers[0].deadline, egg.hatchAt);
    return timers[0];
}

test('fresh floor egg hatches visibly, teaches its type, and is deleted',
    async () => {
        freshEggState(2);
        const egg = place_object(mksobj(EGG, true, false), 12, 10);
        assert.equal(egg.corpsenm, 94); // cave spider
        assert.equal(egg.quan, 1);
        const timer = hatchTimer(egg);
        assert.equal(timer.deadline, 165);

        game.moves = timer.deadline;
        const claimed = claimNextDueObjectTimer(game, game.moves);
        const event = await runClaimedEggHatchTimer(
            claimed, game, game.moves,
        );
        assert.equal(event.message, 'You see a cave spider hatch.');
        assert.equal(event.hatched, 1);
        assert.equal(egg.quan, 0);
        assert.equal(egg.where, 'floor');
        assert.ok(game.level.monsters.some(monster => monster.mnum === 94));

        finishEggHatchTimer(event, game, game.moves);
        assert.equal(egg.where, 'gone');
        assert.equal(game.level.objects[12][10].includes(egg), false);
        assert.equal(objectTimers(egg).length, 0);
        assert.ok(game.mvitals[94].mvflags & MV_KNOWS_EGG);
    });

test('floor egg stack hatches a younger form and schedules its remainder',
    async () => {
        freshEggState(10);
        const egg = place_object(mksobj(EGG, true, false), 12, 10);
        assert.equal(egg.corpsenm, 328); // crocodile
        assert.equal(egg.quan, 2);
        const timer = hatchTimer(egg);

        game.moves = timer.deadline;
        initRng(4n); // rnd(2)=1 leaves one egg in the stack
        const event = await runClaimedEggHatchTimer(
            claimNextDueObjectTimer(game, game.moves), game, game.moves,
        );
        assert.equal(event.mnum, 325); // baby crocodile
        assert.equal(event.message, 'You see a baby crocodile hatch.');
        assert.equal(egg.quan, 1);

        finishEggHatchTimer(event, game, game.moves);
        assert.equal(egg.where, 'floor');
        assert.equal(egg.owt, objectWeight(egg));
        const remainder = hatchTimer(egg);
        assert.ok(remainder.deadline >= game.moves + 1);
        assert.ok(remainder.deadline <= game.moves + 12);
        assert.ok(game.level.monsters.some(monster => monster.mnum === 325));
        assert.ok(game.mvitals[328].mvflags & MV_KNOWS_EGG);
    });

test('overdue floor hatching is silent and does not teach egg identity',
    async () => {
        freshEggState(2);
        const egg = place_object(mksobj(EGG, true, false), 12, 10);
        const timer = hatchTimer(egg);
        game.moves = timer.deadline + 20;
        const event = await runClaimedEggHatchTimer(
            claimNextDueObjectTimer(game, game.moves), game, game.moves,
        );
        assert.equal(event.message, null);
        assert.equal(event.hatched, 1);
        finishEggHatchTimer(event, game, game.moves);
        assert.equal(egg.where, 'gone');
        assert.equal((game.mvitals[94]?.mvflags ?? 0) & MV_KNOWS_EGG, 0);
    });

test('genocide consumes the hatch attempt but leaves the egg untimed',
    async () => {
        freshEggState(2);
        const egg = place_object(mksobj(EGG, true, false), 12, 10);
        const timer = hatchTimer(egg);
        game.mvitals[94] = { mvflags: G_GENOD };
        game.moves = timer.deadline;
        const event = await runClaimedEggHatchTimer(
            claimNextDueObjectTimer(game, game.moves), game, game.moves,
        );
        assert.equal(event.unavailable, true);
        assert.equal(event.hatched, 0);
        assert.equal(egg.quan, 1);
        assert.equal(egg.where, 'floor');
        assert.equal(objectTimers(egg).length, 0);
        assert.equal(game.level.monsters.some(monster => monster.mnum === 94),
            false);
    });

test('unowned carried egg hatches beside a female hero before pack deletion',
    async () => {
        freshEggState(2);
        const egg = mksobj(EGG, true, false);
        egg.where = 'inventory';
        game.inventory = [egg];
        const timer = hatchTimer(egg);
        game.moves = timer.deadline;
        const event = await runClaimedEggHatchTimer(
            claimNextDueObjectTimer(game, game.moves), game, game.moves,
        );
        assert.equal(event.message,
            'You see a cave spider drop out of your pack!');
        assert.equal(event.hatched, 1);
        assert.ok(game.inventory.includes(egg));
        assert.ok(game.level.monsters.some(monster => monster.mnum === 94));

        finishEggHatchTimer(event, game, game.moves);
        assert.equal(egg.where, 'gone');
        assert.equal(game.inventory.includes(egg), false);
        assert.ok(game.mvitals[94].mvflags & MV_KNOWS_EGG);
    });

test('blind carried hatching uses tactile prose and does not teach identity',
    async () => {
        freshEggState(2);
        game.blind = true;
        game.u.blindTurns = 10;
        vision_recalc(0);
        const egg = mksobj(EGG, true, false);
        egg.where = 'inventory';
        game.inventory = [egg];
        const timer = hatchTimer(egg);
        game.moves = timer.deadline;

        const event = await runClaimedEggHatchTimer(
            claimNextDueObjectTimer(game, game.moves), game, game.moves,
        );
        assert.equal(event.message,
            'You feel something drop from your pack!');
        finishEggHatchTimer(event, game, game.moves);
        assert.equal((game.mvitals[94]?.mvflags ?? 0) & MV_KNOWS_EGG, 0);
    });

test('carried egg stack keeps its remainder and short timer after pack prose',
    async () => {
        freshEggState(10);
        const egg = mksobj(EGG, true, false);
        egg.where = 'inventory';
        game.inventory = [egg];
        const timer = hatchTimer(egg);
        game.moves = timer.deadline;
        initRng(4n);
        const event = await runClaimedEggHatchTimer(
            claimNextDueObjectTimer(game, game.moves), game, game.moves,
        );
        assert.equal(event.message,
            'You see a baby crocodile drop out of your pack!');
        assert.equal(egg.quan, 1);
        assert.equal(objectTimers(egg).length, 0);
        finishEggHatchTimer(event, game, game.moves);
        assert.ok(game.inventory.includes(egg));
        assert.equal(egg.where, 'inventory');
        assert.ok(hatchTimer(egg).deadline >= game.moves + 1);
        assert.ok(hatchTimer(egg).deadline <= game.moves + 12);
    });

test('owned carried egg callback fails before approximating taming or cries',
    async () => {
        freshEggState(2);
        const egg = mksobj(EGG, true, false);
        const timer = hatchTimer(egg);
        egg.where = 'inventory';
        egg.spe = 1;
        game.inventory = [egg];
        game.moves = timer.deadline;
        const claimed = claimNextDueObjectTimer(game, game.moves);
        await assert.rejects(
            runClaimedEggHatchTimer(claimed, game, game.moves),
            /excludes owned or male-parentage taming/,
        );
        assert.equal(egg.quan, 1);
        assert.equal(game.level.monsters.length, 0);
    });
