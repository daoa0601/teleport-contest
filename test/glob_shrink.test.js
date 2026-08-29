import test from 'node:test';
import assert from 'node:assert/strict';

import {
    getBridgeUsageLedger, resetBridgeUsageLedger,
} from '../js/bridge_policy.js';
import { ICE, ROOM } from '../js/const.js';
import { GameMap } from '../js/game.js';
import { runClaimedFloorGlobTimer } from '../js/glob.js';
import { game, resetGame } from '../js/gstate.js';
import { mksobj, place_object } from '../js/mklev.js';
import {
    GLOB_OF_BLACK_PUDDING, GLOB_OF_BROWN_PUDDING,
    GLOB_OF_GRAY_OOZE, GLOB_OF_GREEN_SLIME,
} from '../js/object_data.js';
import { init_objects } from '../js/o_init.js';
import {
    claimNextDueObjectTimer, OBJECT_TIMER_KIND, objectTimers,
} from '../js/object_timers.js';
import {
    enableRngLog, getRngLog, initRng,
} from '../js/rng.js';
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
    resetBridgeUsageLedger();
}

function assertNoBridgeUse() {
    assert.deepEqual(getBridgeUsageLedger(), {
        bridgeFree: true, totalHits: 0, forbiddenHits: 0, bridges: {},
    });
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
    enableRngLog();
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
    assert.equal(getRngLog().length, 8);
    for (let index = 0; index < getRngLog().length; index += 2) {
        assert.match(getRngLog()[index], /^rnd\(2\)=[12]$/);
        assert.match(getRngLog()[index + 1], /^rn2\(5\)=[0-4]$/);
    }
    assertNoBridgeUse();
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
        enableRngLog();

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
        assert.match(getRngLog()[0], /^rn2\(5\)=[0-4]$/);
        const roll = Number(getRngLog()[0].at(-1));
        assert.equal(next.deadline, game.moves + 23 + roll);
        assertNoBridgeUse();
    });

test('visible final floor shrink deletes the glob before fade prose', () => {
    freshGlobState(9);
    const glob = place_object(
        mksobj(GLOB_OF_GREEN_SLIME, true, false), 12, 10,
    );
    const timer = shrinkTimer(glob);
    glob.owt = 1;
    game.moves = timer.deadline;
    enableRngLog();

    const event = runClaimedFloorGlobTimer(
        claimNextDueObjectTimer(game, game.moves), game, game.moves,
    );
    assert.equal(event.gone, true);
    assert.equal(event.message, 'A glob of green slime fades away.');
    assert.equal(glob.owt, 0);
    assert.equal(glob.where, 'gone');
    assert.equal(game.level.objects[12][10].includes(glob), false);
    assert.equal(objectTimers(glob).length, 0);
    assert.deepEqual(getRngLog(), []);
    assertNoBridgeUse();
});

test('overdue floor callback catches up arithmetically without RNG or prose',
    () => {
        freshGlobState(10);
        const glob = place_object(
            mksobj(GLOB_OF_BROWN_PUDDING, true, false), 12, 10,
        );
        const first = shrinkTimer(glob);
        game.moves = first.deadline + 26;
        enableRngLog();

        const event = runClaimedFloorGlobTimer(
            claimNextDueObjectTimer(game, game.moves), game, game.moves,
        );
        assert.equal(event.overdue, true);
        assert.equal(event.delta, 2);
        assert.equal(event.delay, 23);
        assert.equal(event.message, null);
        assert.equal(glob.owt, 18);
        assert.equal(shrinkTimer(glob).deadline, game.moves + 23);
        assert.deepEqual(getRngLog(), []);
        assertNoBridgeUse();
    });

test('unsupported carried and icy floor carriers reject before mutation', () => {
    freshGlobState(11);
    const carried = mksobj(GLOB_OF_BLACK_PUDDING, true, false);
    const carriedTimer = shrinkTimer(carried);
    carried.where = 'inventory';
    game.inventory = [carried];
    game.moves = carriedTimer.deadline;
    enableRngLog();
    assert.throws(
        () => runClaimedFloorGlobTimer(
            claimNextDueObjectTimer(game, game.moves), game, game.moves,
        ),
        /excludes carried, contained, buried, migrating, and monster-carried/,
    );
    assert.equal(carried.owt, 20);
    assert.deepEqual(getRngLog(), []);

    freshGlobState(12);
    const icy = place_object(
        mksobj(GLOB_OF_GRAY_OOZE, true, false), 12, 10,
    );
    game.level.at(12, 10).typ = ICE;
    const icyTimer = shrinkTimer(icy);
    game.moves = icyTimer.deadline;
    enableRngLog();
    assert.throws(
        () => runClaimedFloorGlobTimer(
            claimNextDueObjectTimer(game, game.moves), game, game.moves,
        ),
        /excludes ice cadence/,
    );
    assert.equal(icy.owt, 20);
    assert.deepEqual(getRngLog(), []);
    assertNoBridgeUse();
});
