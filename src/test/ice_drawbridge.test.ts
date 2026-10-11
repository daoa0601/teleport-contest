import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { DBWALL, DB_FLOOR, DB_ICE, DB_LAVA, DB_MOAT, DB_NORTH, DB_UNDER, DRAWBRIDGE_DOWN, DRAWBRIDGE_UP } from '../js/const.js';
import { openDrawbridge } from '../js/dbridge.js';
import { game } from '../js/gstate.js';
import { meltIce } from '../js/ice.js';
import { pushKeys } from '../js/input.js';
import { BOULDER } from '../js/object_data.js';
import { levelTimers, LEVEL_TIMER_KIND, scheduleLevelTimer } from '../js/object_timers.js';
import { initRng } from '../js/rng.js';
import { runDueTimers } from '../js/timer_effects.js';
import { vision_recalc } from '../js/vision.js';
import { applyRayFloorFeatures } from '../js/zap.js';
import { floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

function bridgeRoom(under = DB_MOAT) {
    freshObjectRoom();
    requireFixtureGame(game);
    const bridge = game.level.requireAt(12, 10);
    bridge.typ = DRAWBRIDGE_UP;
    bridge.drawbridgemask = DB_NORTH | under;
    const wall = game.level.requireAt(12, 9);
    wall.typ = DBWALL;
    vision_recalc(0);
    pushKeys(' '.repeat(100));
    return { bridge, wall };
}

async function freezeBridge() {
    initRng(2n);
    await applyRayFloorFeatures('cold', 12, 10, game, { publish: async () => {} });
}

function meltTimer() {
    return levelTimers().find(timer => timer.kind === LEVEL_TIMER_KIND.MELT_ICE_AWAY
        && timer.x === 12 && timer.y === 10);
}

void test('fire melts the ice under a raised bridge without removing its portcullis', async () => {
    const { bridge, wall } = bridgeRoom();
    requireFixtureGame(game);
    await freezeBridge();

    await applyRayFloorFeatures('fire', 12, 10, game, { publish: async () => {} });

    assert.equal(bridge.typ, DRAWBRIDGE_UP);
    assert.equal(bridge.drawbridgemask, DB_NORTH | DB_MOAT);
    assert.equal(wall.typ, DBWALL);
    assert.equal(meltTimer(), undefined);
});

for (const lowered of [false, true] as const) {
    void test(`the ice timer thaws a ${lowered ? 'lowered' : 'raised'} drawbridge`, async () => {
        const { bridge } = bridgeRoom();
        requireFixtureGame(game);
        await freezeBridge();
        const timer = meltTimer();
        assert.ok(timer);
        if (lowered) await openDrawbridge(12, 10);

        game.moves = timer.deadline;
        await runDueTimers();

        assert.equal(bridge.typ, lowered ? DRAWBRIDGE_DOWN : DRAWBRIDGE_UP);
        assert.equal((bridge.drawbridgemask ?? 0) & DB_UNDER, DB_MOAT);
        assert.equal(meltTimer(), undefined);
        assert.ok(!game.program_state.gameover);
    });
}

void test('more cold firms existing raised-bridge ice rather than shortening its lifetime', async () => {
    bridgeRoom();
    requireFixtureGame(game);
    await freezeBridge();
    const oldDeadline = game.moves + 1900;
    scheduleLevelTimer(12, 10, LEVEL_TIMER_KIND.MELT_ICE_AWAY, oldDeadline);
    initRng(1n);

    await applyRayFloorFeatures('cold', 12, 10, game, { publish: async () => {} });

    const timer = meltTimer();
    assert.ok(!timer || timer.deadline >= oldDeadline, 'cold can prolong ice or make it permanent');
});

void test('cold cannot create ice under a drawbridge filled with dry ground', async () => {
    const { bridge } = bridgeRoom(DB_FLOOR);

    await freezeBridge();

    assert.equal((bridge.drawbridgemask ?? 0) & DB_UNDER, DB_FLOOR);
    assert.equal(meltTimer(), undefined);
});

for (const under of [DB_FLOOR, DB_LAVA] as const) {
    void test(`fire does not evaporate nonexistent water under a bridge over ${under === DB_FLOOR ? 'ground' : 'lava'}`, async () => {
        const { bridge } = bridgeRoom(under);
        requireFixtureGame(game);
        const messages: string[] = [];

        await applyRayFloorFeatures('fire', 12, 10, game, {
            publish: async (message: string) => messages.push(message),
        });

        assert.equal((bridge.drawbridgemask ?? 0) & DB_UNDER, under);
        assert.equal(game.level.regions?.length || 0, 0);
        assert.deepEqual(messages, []);
    });
}

void test('a boulder fills thawed water below a raised drawbridge without erasing the bridge', async () => {
    const { bridge, wall } = bridgeRoom();
    await freezeBridge();
    const boulder = await floorObject(BOULDER, 12, 10);
    initRng(1n);

    await meltIce(12, 10, { announce: async () => {} });

    assert.equal(boulder.where, 'gone');
    assert.equal(bridge.typ, DRAWBRIDGE_UP);
    assert.equal(bridge.drawbridgemask, DB_NORTH | DB_FLOOR);
    assert.equal(wall.typ, DBWALL);
});
