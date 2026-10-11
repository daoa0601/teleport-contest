import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { buryObject } from '../js/buried_object.js';
import { DB_ICE, DB_MOAT, DB_UNDER, DRAWBRIDGE_UP, ICE, POOL } from '../js/const.js';
import { placeCreatedObject } from '../js/floor_object.js';
import { game } from '../js/gstate.js';
import { meltIce } from '../js/ice.js';
import { pushKeys } from '../js/input.js';
import { runDueTimers } from '../js/timer_effects.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { objectTimers, OBJECT_TIMER_KIND } from '../js/object_timers.js';
import { initRng } from '../js/rng.js';
import { applyRayFloorFeatures } from '../js/zap.js';
import { corpseObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
for (const terrain of ['pool', 'raised drawbridge']) {
    for (const alreadyBuried of [false, true]) {
        void test(`freezing a ${terrain} slows a ${alreadyBuried ? 'previously buried' : 'floor'} corpse`, async () => {
            freshObjectRoom();
            requireFixtureGame(game);
            const location = game.level.requireAt(12, 10);
            location.typ = terrain === 'pool' ? POOL : DRAWBRIDGE_UP;
            if (terrain !== 'pool')
                location.drawbridgemask = DB_MOAT;
            const corpse = placeCreatedObject(await corpseObject(MONSTER_NAME.indexOf('newt')), 12, 10);
            if (alreadyBuried)
                await buryObject(corpse);
            const rot = objectTimers(corpse).find(timer => timer.kind === OBJECT_TIMER_KIND.ROT_CORPSE);
            assert.ok(rot, 'the real corpse has a rot timer');
            const remaining = rot.deadline - game.moves;
            initRng(2n);
            await applyRayFloorFeatures('cold', 12, 10, game, {
                publish: async () => { }, heroCaused: false,
            });
            if (terrain === 'pool')
                assert.equal(location.typ, ICE);
            else
                assert.equal((location.drawbridgemask ?? 0) & DB_UNDER, DB_ICE);
            assert.equal(corpse.where, 'buried');
            assert.equal(objectTimers(corpse).find(timer => timer.kind === OBJECT_TIMER_KIND.ROT_CORPSE)?.deadline, game.moves + 2 * remaining, 'ice doubles the remaining time until rot');
        });
    }
}
void test('melting ice restores the rot rate of a corpse buried before freezing', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    game.level.requireAt(12, 10).typ = POOL;
    const corpse = placeCreatedObject(await corpseObject(MONSTER_NAME.indexOf('newt')), 12, 10);
    await buryObject(corpse);
    assert.equal(corpse.where, 'buried');
    const originalDeadline = objectTimers(corpse).find(timer => timer.kind === OBJECT_TIMER_KIND.ROT_CORPSE)?.deadline;
    assert.ok(originalDeadline !== undefined);
    initRng(2n);
    await applyRayFloorFeatures('cold', 12, 10, game, { publish: async () => { } });
    game.moves += 20;
    await meltIce(12, 10, { announce: async () => { } });
    assert.equal(corpse.where, 'floor');
    game.moves = originalDeadline + 9;
    await runDueTimers();
    assert.equal(corpse.where, 'floor', 'twenty turns on ice delay rot by ten turns');
    game.moves++;
    await runDueTimers();
    assert.equal(corpse.where, 'gone');
});
void test('ice delays a Rider revival even though its corpse cannot be buried', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    game.level.requireAt(12, 10).typ = POOL;
    const species = MONSTER_NAME.indexOf('Death');
    const corpse = placeCreatedObject(await corpseObject(species), 12, 10);
    const revival = objectTimers(corpse).find(timer => timer.kind === OBJECT_TIMER_KIND.REVIVE_MON);
    assert.ok(revival);
    const originalDeadline = revival.deadline;
    const frozenDeadline = game.moves + 2 * (originalDeadline - game.moves);
    pushKeys(' '.repeat(100));
    initRng(2n);
    await applyRayFloorFeatures('cold', 12, 10, game, { publish: async () => { } });
    game.moves = originalDeadline;
    await runDueTimers();
    assert.equal(corpse.where, 'floor');
    assert.ok(!game.level.monsters.some(monster => monster.mnum === species));
    game.moves = frozenDeadline;
    await runDueTimers();
    assert.equal(corpse.where, 'gone');
    assert.ok(game.level.monsters.some(monster => monster.mnum === species && monster.mhp > 0));
});
// mkobj.c start_corpse_timeout() ages a corpse from max(moves, 1), but
// start_timer() counts from svm.moves itself, which is still 0 while the
// first level is built. A corpse made then rots one turn earlier than an
// identical corpse made on turn 1.
async function rotTurn(createdAtMoves) {
    freshObjectRoom();
    requireFixtureGame(game);
    game.moves = createdAtMoves;
    game.in_mklev = true;
    initRng(5n);
    const corpse = placeCreatedObject(await corpseObject(MONSTER_NAME.indexOf('newt')), 12, 10);
    game.in_mklev = false;
    for (let turn = createdAtMoves; turn < 500; turn++) {
        game.moves = turn;
        await runDueTimers();
        if (!game.level.requireAt(12, 10) || !(game.level.objects[12]?.[10] ?? []).includes(corpse))
            return turn;
    }
    throw new Error('the corpse never rotted');
}
void test('a corpse made while the first level is built rots one turn earlier', async () => {
    const firstLevel = await rotTurn(0);
    const turnOne = await rotTurn(1);
    assert.equal(firstLevel, turnOne - 1);
});
//# sourceMappingURL=ice_corpse_timers.test.js.map