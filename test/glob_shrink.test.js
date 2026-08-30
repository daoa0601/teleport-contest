import test from 'node:test';
import assert from 'node:assert/strict';

import { ICE, ROOM } from '../js/const.js';
import { GameMap } from '../js/game.js';
import {
    finishInventoryGlobTimer, runClaimedFloorGlobTimer,
    runClaimedGlobTimer,
} from '../js/glob.js';
import { game, resetGame } from '../js/gstate.js';
import { mksobj, place_object, stack_object } from '../js/mklev.js';
import {
    GLOB_OF_BLACK_PUDDING, GLOB_OF_BROWN_PUDDING,
    GLOB_OF_GRAY_OOZE, GLOB_OF_GREEN_SLIME,
} from '../js/object_data.js';
import { init_objects } from '../js/o_init.js';
import {
    claimNextDueObjectTimer, OBJECT_TIMER_KIND, objectTimers,
    scheduleObjectTimer, stopAllObjectTimers,
} from '../js/object_timers.js';
import { initRng } from '../js/rng.js';
import {
    cansee, vision_recalc, vision_reset_new_level,
} from '../js/vision.js';
import { objectWeight } from '../js/weight.js';

process.env.TELEPORT_BRIDGE_FREE = '1';
process.env.TELEPORT_DISABLE_FIXTURES = '1';

function freshGlobState(seed = 1) {
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
    };
    game.context = { move: 0, nopick: false };
    game.moves = 40;
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


function shrinkTimer(glob) {
    const timers = objectTimers(glob);
    assert.equal(timers.length, 1);
    assert.equal(timers[0].kind, OBJECT_TIMER_KIND.SHRINK_GLOB);
    assert.equal(timers[0].deadline, glob.shrinkAt);
    return timers[0];
}

test('fresh glob variants own identity, weight, species, and first timer', () => {
    freshGlobState(7);
    const variants = [
        [GLOB_OF_GRAY_OOZE, 206],
        [GLOB_OF_BROWN_PUDDING, 207],
        [GLOB_OF_GREEN_SLIME, 208],
        [GLOB_OF_BLACK_PUDDING, 209],
    ];
    for (const [otyp, corpsenm] of variants) {
        const glob = mksobj(otyp, true, false);
        assert.equal(glob.globby, true);
        assert.equal(glob.quan, 1);
        assert.equal(glob.quantity, 1);
        assert.equal(glob.owt, 20);
        assert.equal(objectWeight(glob), 20);
        assert.equal(glob.known, true);
        assert.equal(glob.dknown, true);
        assert.equal(glob.corpsenm, corpsenm);
        const timer = shrinkTimer(glob);
        assert.ok(timer.deadline >= game.moves + 23);
        assert.ok(timer.deadline <= game.moves + 27);
    }
});

test('floor glob stacking absorbs the old identity and averages live delays',
    () => {
        freshGlobState(17);
        const old = mksobj(GLOB_OF_GRAY_OOZE, true, false);
        const placed = mksobj(GLOB_OF_GRAY_OOZE, true, false);
        old.owt = 20;
        placed.owt = 40;
        old.age = 10;
        placed.age = 25;
        stopAllObjectTimers(old);
        stopAllObjectTimers(placed);
        scheduleObjectTimer(
            old, OBJECT_TIMER_KIND.SHRINK_GLOB, 140, game,
        );
        scheduleObjectTimer(
            placed, OBJECT_TIMER_KIND.SHRINK_GLOB, 240, game,
        );
        place_object(old, 12, 10);
        place_object(placed, 12, 10);
        const survivor = stack_object(placed, game);

        assert.strictEqual(survivor, placed);
        assert.deepEqual(game.level.objects[12][10], [placed]);
        assert.equal(placed.owt, 60);
        assert.equal(placed.age, 20);
        assert.equal(old.where, 'gone');
        assert.deepEqual(objectTimers(old), []);
        assert.deepEqual(objectTimers(placed).map(timer => ({
            kind: timer.kind,
            deadline: timer.deadline,
        })), [{
            kind: OBJECT_TIMER_KIND.SHRINK_GLOB,
            deadline: 190,
        }]);
    });

test('exact visible floor callback shrinks once and schedules a fresh attempt',
    () => {
        freshGlobState(8);
        const glob = place_object(
            mksobj(GLOB_OF_GRAY_OOZE, true, false), 12, 10,
        );
        glob.oeaten = 12;
        const first = shrinkTimer(glob);
        game.moves = first.deadline;
        const event = runClaimedFloorGlobTimer(
            claimNextDueObjectTimer(game, game.moves), game, game.moves,
        );
        assert.equal(event.overdue, false);
        assert.equal(event.shrinkThreshold, true);
        assert.equal(event.message, null);
        assert.equal(glob.owt, 19);
        assert.equal(glob.oeaten, 11);
        assert.equal(objectWeight(glob), 19);
        assert.equal(glob.where, 'floor');
        const next = shrinkTimer(glob);
        assert.ok(next.deadline >= game.moves + 23);
        assert.ok(next.deadline <= game.moves + 27);
    });

test('visible final floor shrink deletes the glob before fade prose', () => {
    freshGlobState(9);
    const glob = place_object(
        mksobj(GLOB_OF_GREEN_SLIME, true, false), 12, 10,
    );
    const timer = shrinkTimer(glob);
    glob.owt = 1;
    game.moves = timer.deadline;
    const event = runClaimedFloorGlobTimer(
        claimNextDueObjectTimer(game, game.moves), game, game.moves,
    );
    assert.equal(event.gone, true);
    assert.equal(event.message, 'A glob of green slime fades away.');
    assert.equal(glob.owt, 0);
    assert.equal(glob.where, 'gone');
    assert.equal(game.level.objects[12][10].includes(glob), false);
    assert.equal(objectTimers(glob).length, 0);
});

test('overdue floor callback catches up arithmetically without prose',
    () => {
        freshGlobState(10);
        const glob = place_object(
            mksobj(GLOB_OF_BROWN_PUDDING, true, false), 12, 10,
        );
        const first = shrinkTimer(glob);
        game.moves = first.deadline + 26;
        const event = runClaimedFloorGlobTimer(
            claimNextDueObjectTimer(game, game.moves), game, game.moves,
        );
        assert.equal(event.overdue, true);
        assert.equal(event.delta, 2);
        assert.equal(event.delay, 23);
        assert.equal(event.message, null);
        assert.equal(glob.owt, 18);
        assert.equal(shrinkTimer(glob).deadline, game.moves + 23);
    });

test('inventory threshold prose precedes reschedule and retains live mass', () => {
    freshGlobState(11);
    const glob = mksobj(GLOB_OF_BLACK_PUDDING, true, false);
    glob.where = 'inventory';
    glob.oeaten = 12;
    game.inventory = [glob];
    const timer = shrinkTimer(glob);
    game.moves = timer.deadline;
    const event = runClaimedGlobTimer(
        claimNextDueObjectTimer(game, game.moves), game, game.moves,
    );
    assert.equal(event.message,
        'Your partly eaten glob of black pudding shrinks.');
    assert.equal(glob.owt, 19);
    assert.equal(glob.oeaten, 11);
    assert.ok(game.inventory.includes(glob));
    assert.equal(objectTimers(glob).length, 0);

    finishInventoryGlobTimer(event, game, game.moves);
    assert.ok(game.inventory.includes(glob));
    assert.equal(shrinkTimer(glob).deadline >= game.moves + 23, true);
    assert.equal(shrinkTimer(glob).deadline <= game.moves + 27, true);
    assert.equal(event.followupMessage, null);
});

test('inventory dissolution precedes deletion and then relieves capacity', () => {
    freshGlobState(12);
    game.u.acurr.a[0] = game.u.amax.a[0] = 3;
    game.u.acurr.a[2] = game.u.amax.a[2] = 3;
    const ballast = {
        otyp: 0, oclass: 1, owt: 200, quan: 1,
        quantity: 1, where: 'inventory',
    };
    const glob = mksobj(GLOB_OF_GRAY_OOZE, true, false);
    glob.where = 'inventory';
    glob.owt = 1;
    game.inventory = [ballast, glob];
    const timer = shrinkTimer(glob);
    game.moves = timer.deadline;
    const event = runClaimedGlobTimer(
        claimNextDueObjectTimer(game, game.moves), game, game.moves,
    );
    assert.equal(event.oldCapacity, 1);
    assert.equal(event.message,
        'Your glob of gray ooze dissolves completely.');
    assert.equal(glob.owt, 0);
    assert.ok(game.inventory.includes(glob));

    finishInventoryGlobTimer(event, game, game.moves);
    assert.equal(glob.where, 'gone');
    assert.equal(game.inventory.includes(glob), false);
    assert.equal(event.newCapacity, 0);
    assert.equal(event.followupMessage,
        'Your movements are now unencumbered.');
});

test('active inventory eating skips shrink and starts a fresh attempt', () => {
    freshGlobState(13);
    const glob = mksobj(GLOB_OF_GREEN_SLIME, true, false);
    glob.where = 'inventory';
    game.inventory = [glob];
    game.context.victual = { piece: glob };
    const timer = shrinkTimer(glob);
    game.moves = timer.deadline;
    const event = runClaimedGlobTimer(
        claimNextDueObjectTimer(game, game.moves), game, game.moves,
    );
    assert.equal(event.skippedEating, true);
    assert.equal(event.message, null);
    assert.equal(glob.owt, 20);
    assert.ok(shrinkTimer(glob).deadline >= game.moves + 23);
    assert.ok(shrinkTimer(glob).deadline <= game.moves + 27);
});

test('unsupported contained and icy floor carriers reject before mutation', () => {
    freshGlobState(11);
    const contained = mksobj(GLOB_OF_BLACK_PUDDING, true, false);
    const containedTimer = shrinkTimer(contained);
    const container = {
        otyp: 217, oclass: 6, where: 'inventory',
        quan: 1, quantity: 1, contents: [contained],
    };
    contained.where = 'contained';
    contained.ocontainer = container;
    game.inventory = [container];
    game.moves = containedTimer.deadline;
    assert.throws(
        () => runClaimedGlobTimer(
            claimNextDueObjectTimer(game, game.moves), game, game.moves,
        ),
        /excludes contained, buried, migrating, and monster-carried/,
    );
    assert.equal(contained.owt, 20);

    freshGlobState(12);
    const icy = place_object(
        mksobj(GLOB_OF_GRAY_OOZE, true, false), 12, 10,
    );
    game.level.at(12, 10).typ = ICE;
    const icyTimer = shrinkTimer(icy);
    game.moves = icyTimer.deadline;
    assert.throws(
        () => runClaimedFloorGlobTimer(
            claimNextDueObjectTimer(game, game.moves), game, game.moves,
        ),
        /excludes ice cadence/,
    );
    assert.equal(icy.owt, 20);
});
