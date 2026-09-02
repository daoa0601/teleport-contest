import test from 'node:test';
import assert from 'node:assert/strict';

import { A_CON, A_STR, ICE, W_WEP } from '../js/const.js';
import {
    finishGlobTimer, runClaimedGlobTimer,
} from '../js/glob.js';
import { place_object, stack_object } from '../js/floor_object.js';
import { game } from '../js/gstate.js';
import { mksobj } from '../js/mklev.js';
import { linkObjectToMonsterInventory } from '../js/monster_inventory.js';
import {
    GLOB_OF_BLACK_PUDDING, GLOB_OF_BROWN_PUDDING,
    GLOB_OF_GRAY_OOZE, GLOB_OF_GREEN_SLIME, SACK,
} from '../js/object_data.js';
import {
    claimNextDueObjectTimer, OBJECT_TIMER_KIND, objectTimers,
    scheduleObjectTimer, stopAllObjectTimers,
} from '../js/object_timers.js';
import { cansee } from '../js/vision.js';
import { objectWeight } from '../js/weight.js';
import { liveMonster } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';


function freshGlobState(seed = 1) {
    freshObjectRoom({
        left: 8, right: 16, top: 7, bottom: 13,
        context: { move: 0, nopick: false },
        gameplaySeed: seed,
    });
    assert.equal(cansee(12, 10), true);
}


function shrinkTimer(glob) {
    const timers = objectTimers(glob);
    assert.equal(timers.length, 1);
    assert.equal(timers[0].kind, OBJECT_TIMER_KIND.SHRINK_GLOB);
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
        const event = runClaimedGlobTimer(
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
    const event = runClaimedGlobTimer(
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
        const event = runClaimedGlobTimer(
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

    finishGlobTimer(event, game, game.moves);
    assert.ok(game.inventory.includes(glob));
    assert.equal(shrinkTimer(glob).deadline >= game.moves + 23, true);
    assert.equal(shrinkTimer(glob).deadline <= game.moves + 27, true);
    assert.equal(event.followupMessage, null);
});

test('inventory dissolution precedes deletion and then relieves capacity', () => {
    freshGlobState(12);
    game.u.acurr.a[A_STR] = game.u.amax.a[A_STR] = 3;
    game.u.acurr.a[A_CON] = game.u.amax.a[A_CON] = 3;
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

    finishGlobTimer(event, game, game.moves);
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

test('ice reduces overdue floor shrinkage to one third', () => {
    freshGlobState(14);
    const glob = place_object(
        mksobj(GLOB_OF_GRAY_OOZE, true, false), 12, 10,
    );
    game.level.at(12, 10).typ = ICE;
    stopAllObjectTimers(glob);
    scheduleObjectTimer(glob, OBJECT_TIMER_KIND.SHRINK_GLOB, 50, game);
    game.moves = 126;

    const event = runClaimedGlobTimer(
        claimNextDueObjectTimer(game, game.moves), game, game.moves,
    );

    assert.equal(event.delta, 2);
    assert.equal(glob.owt, 18);
    assert.equal(shrinkTimer(glob).deadline, game.moves + 21);
});

test('a glob buried under ice does not shrink', () => {
    freshGlobState(15);
    const glob = mksobj(GLOB_OF_BROWN_PUDDING, true, false);
    glob.where = 'buried';
    glob.buried = true;
    glob.ox = 12;
    glob.oy = 10;
    game.level.at(12, 10).typ = ICE;
    game.level.buriedObjects = [glob];
    const timer = shrinkTimer(glob);
    game.moves = timer.deadline;

    const event = runClaimedGlobTimer(
        claimNextDueObjectTimer(game, game.moves), game, game.moves,
    );

    assert.equal(event.skippedIce, true);
    assert.equal(glob.owt, 20);
    assert.equal(glob.where, 'buried');
    assert.equal(objectTimers(glob).length, 1);
});

test('a glob inside a carried sack makes the sack lighter', () => {
    freshGlobState(16);
    const sack = mksobj(SACK, true, false);
    const glob = mksobj(GLOB_OF_GRAY_OOZE, true, false);
    sack.contents = [glob];
    sack.where = 'inventory';
    glob.where = 'contained';
    glob.container = sack;
    game.inventory = [sack];
    sack.owt = objectWeight(sack);
    const oldWeight = sack.owt;
    const timer = shrinkTimer(glob);
    game.moves = timer.deadline;

    const event = runClaimedGlobTimer(
        claimNextDueObjectTimer(game, game.moves), game, game.moves,
    );

    assert.equal(event.message, 'Your sack becomes slightly lighter.');
    assert.equal(sack.owt, oldWeight - 1);
    finishGlobTimer(event, game, game.moves);
    assert.equal(sack.contents.includes(glob), true);
});

test('a monster-carried glob disappears from its pack', () => {
    freshGlobState(17);
    const carrier = liveMonster({
        mnum: 260,
        m_id: 8100,
        x: 12,
        y: 10,
    });
    game.level.monsters = [carrier];
    const glob = mksobj(GLOB_OF_GREEN_SLIME, true, false);
    glob.owt = 1;
    linkObjectToMonsterInventory(carrier, glob);
    const timer = shrinkTimer(glob);
    game.moves = timer.deadline;

    const event = runClaimedGlobTimer(
        claimNextDueObjectTimer(game, game.moves), game, game.moves,
    );

    assert.equal(event.message, null);
    assert.equal(glob.where, 'gone');
    assert.equal(carrier.minvent.includes(glob), false);
});

test('a dissolving wielded glob clears the hero weapon slot', () => {
    freshGlobState(18);
    const glob = mksobj(GLOB_OF_BLACK_PUDDING, true, false);
    glob.where = 'inventory';
    glob.owt = 1;
    glob.owornmask = W_WEP;
    glob.wielded = true;
    game.inventory = [glob];
    game.uwep = game.u.uwep = glob;
    game._occupation = { key: 'search' };
    const timer = shrinkTimer(glob);
    game.moves = timer.deadline;

    const event = runClaimedGlobTimer(
        claimNextDueObjectTimer(game, game.moves), game, game.moves,
    );
    finishGlobTimer(event, game, game.moves);

    assert.equal(game.uwep, null);
    assert.equal(game.u.uwep, null);
    assert.equal(game._occupation, null);
    assert.equal(glob.where, 'gone');
});
