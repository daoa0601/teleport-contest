import { installPagerInput } from './support/pager-input.js';
import { createDungeon } from './support/topology.js';
import { floorObjectsAt } from './support/level-state.js';
import { knownObject } from './support/game-objects.js';
import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { A_CON, A_STR, ICE, W_WEP } from '../js/const.js';
import { finishGlobTimer, runClaimedGlobTimer, } from '../js/glob.js';
import { placeCreatedObject, stack_object } from '../js/floor_object.js';
import { requireGameLevel, requireGameDisplay, game } from '../js/gstate.js';
import { rhack } from '../js/cmd.js';
import { resetInputState } from '../js/input.js';
import { mksobj } from '../js/mklev.js';
import { linkObjectToMonsterInventory } from '../js/monster_inventory.js';
import { shipObject } from '../js/object_migration.js';
import { GOLD_PIECE, GLOB_OF_BLACK_PUDDING, GLOB_OF_BROWN_PUDDING, GLOB_OF_GRAY_OOZE, GLOB_OF_GREEN_SLIME, SACK, } from '../js/object_data.js';
import { claimNextDueObjectTimer, OBJECT_TIMER_KIND, objectTimers, scheduleObjectTimer, stopAllObjectTimers, } from '../js/object_timers.js';
import { objectWeight } from '../js/weight.js';
import { stopHeroOccupation } from '../js/occupation.js';
import { addInventoryItem } from '../js/u_init.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
function freshGlobState(seed = 1) {
    freshObjectRoom({
        left: 8, right: 16, top: 7, bottom: 13,
        context: { move: 0, nopick: false },
        gameplaySeed: seed,
    });
}
function shrinkTimer(glob) {
    const timers = objectTimers(glob);
    assert.equal(timers.length, 1);
    const [timer] = timers;
    assert.ok(timer);
    assert.equal(timer.kind, OBJECT_TIMER_KIND.SHRINK_GLOB);
    return timer;
}
void test('fresh glob variants own identity, weight, species, and first timer', async () => {
    freshGlobState(7);
    requireFixtureGame(game);
    const variants = [
        [GLOB_OF_GRAY_OOZE, 206],
        [GLOB_OF_BROWN_PUDDING, 207],
        [GLOB_OF_GREEN_SLIME, 208],
        [GLOB_OF_BLACK_PUDDING, 209],
    ];
    for (const [otyp, corpsenm] of variants) {
        const glob = await mksobj(otyp, true, false);
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
void test('floor stack merging stops the incoming timer before averaging glob shrink delays', async () => {
    freshGlobState(17);
    requireFixtureGame(game);
    const old = await mksobj(GLOB_OF_GRAY_OOZE, true, false);
    const placed = await mksobj(GLOB_OF_GRAY_OOZE, true, false);
    old.owt = 20;
    placed.owt = 40;
    old.age = 10;
    placed.age = 25;
    stopAllObjectTimers(old);
    stopAllObjectTimers(placed);
    scheduleObjectTimer(old, OBJECT_TIMER_KIND.SHRINK_GLOB, 140, game);
    scheduleObjectTimer(placed, OBJECT_TIMER_KIND.SHRINK_GLOB, 240, game);
    placeCreatedObject(old, 12, 10);
    placeCreatedObject(placed, 12, 10);
    const survivor = await stack_object(placed, game);
    assert.strictEqual(survivor, placed);
    assert.deepEqual(floorObjectsAt(requireGameLevel(game), 12, 10), [placed]);
    assert.equal(placed.owt, 60);
    assert.equal(placed.age, 20);
    assert.equal(old.where, 'gone');
    game.moves = 152;
    assert.equal(claimNextDueObjectTimer(game, game.moves), null);
    game.moves = 153;
    const timer = claimNextDueObjectTimer(game, game.moves);
    assert.ok(timer);
    runClaimedGlobTimer(timer, game, game.moves);
    assert.equal(placed.owt, 59);
});
void test('exact visible floor callback shrinks once and schedules a fresh attempt', async () => {
    freshGlobState(8);
    requireFixtureGame(game);
    const glob = placeCreatedObject(await mksobj(GLOB_OF_GRAY_OOZE, true, false), 12, 10);
    glob.oeaten = 12;
    const first = shrinkTimer(glob);
    game.moves = first.deadline;
    const event = runClaimedGlobTimer(claimNextDueObjectTimer(game, game.moves), game, game.moves);
    assert.ok(event, 'The due object timer must produce its effect.');
    assert.equal(event.overdue, false);
    assert.ok(!event.overdue && event.delta === 1);
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
void test('visible final floor shrink deletes the glob before fade prose', async () => {
    freshGlobState(9);
    requireFixtureGame(game);
    const glob = placeCreatedObject(await mksobj(GLOB_OF_GREEN_SLIME, true, false), 12, 10);
    const timer = shrinkTimer(glob);
    glob.owt = 1;
    game.moves = timer.deadline;
    const event = runClaimedGlobTimer(claimNextDueObjectTimer(game, game.moves), game, game.moves);
    assert.ok(event, 'The due object timer must produce its effect.');
    assert.equal(event.gone, true);
    assert.equal(event.message, 'A small glob of green slime fades away.');
    assert.equal(glob.owt, 0);
    assert.equal(glob.where, 'gone');
    assert.equal(floorObjectsAt(requireGameLevel(game), 12, 10).includes(glob), false);
    assert.equal(objectTimers(glob).length, 0);
});
void test('overdue floor callback catches up arithmetically without prose', async () => {
    freshGlobState(10);
    requireFixtureGame(game);
    const glob = placeCreatedObject(await mksobj(GLOB_OF_BROWN_PUDDING, true, false), 12, 10);
    const first = shrinkTimer(glob);
    game.moves = first.deadline + 26;
    const event = runClaimedGlobTimer(claimNextDueObjectTimer(game, game.moves), game, game.moves);
    assert.ok(event, 'The due object timer must produce its effect.');
    assert.equal(event.overdue, true);
    assert.equal(event.delta, 2);
    assert.ok(event.overdue);
    assert.equal(event.delay, 23);
    assert.equal(event.message, null);
    assert.equal(glob.owt, 18);
    assert.equal(shrinkTimer(glob).deadline, game.moves + 23);
});
void test('inventory threshold prose precedes reschedule and retains live mass', async () => {
    freshGlobState(11);
    requireFixtureGame(game);
    const glob = await mksobj(GLOB_OF_BLACK_PUDDING, true, false);
    glob.where = 'inventory';
    glob.oeaten = 12;
    game.inventory = [glob];
    const timer = shrinkTimer(glob);
    game.moves = timer.deadline;
    const event = runClaimedGlobTimer(claimNextDueObjectTimer(game, game.moves), game, game.moves);
    assert.ok(event, 'The due object timer must produce its effect.');
    assert.equal(event.message, 'Your partly eaten small glob of black pudding shrinks.');
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
void test('inventory dissolution precedes deletion and then relieves capacity', async () => {
    freshGlobState(12);
    requireFixtureGame(game);
    game.u.acurr.a[A_STR] = game.u.amax.a[A_STR] = 3;
    game.u.acurr.a[A_CON] = game.u.amax.a[A_CON] = 3;
    const ballast = await knownObject(GOLD_PIECE, {
        quan: 20000, where: 'inventory',
    });
    const glob = await mksobj(GLOB_OF_GRAY_OOZE, true, false);
    glob.where = 'inventory';
    glob.owt = 1;
    game.inventory = [ballast, glob];
    const timer = shrinkTimer(glob);
    game.moves = timer.deadline;
    const event = runClaimedGlobTimer(claimNextDueObjectTimer(game, game.moves), game, game.moves);
    assert.ok(event, 'The due object timer must produce its effect.');
    assert.ok(event.finishPending);
    assert.equal(event.oldCapacity, 1);
    assert.equal(event.message, 'Your small glob of gray ooze dissolves completely.');
    assert.equal(glob.owt, 0);
    assert.ok(game.inventory.includes(glob));
    finishGlobTimer(event, game, game.moves);
    assert.equal(glob.where, 'gone');
    assert.equal(game.inventory.includes(glob), false);
    assert.equal(event.newCapacity, 0);
    assert.equal(event.followupMessage, 'Your movements are now unencumbered.');
});
void test('active eating postpones glob shrinkage and interruption lets shrinking resume', async () => {
    freshGlobState(13);
    requireFixtureGame(game);
    const glob = await addInventoryItem(await mksobj(GLOB_OF_GRAY_OOZE, true, false));
    const input = resetInputState();
    installPagerInput(input, { expected: /glob|eat|eating|taste|finish|interrupt|stomach acid/i, limit: 30 });
    assert.ok(glob.invlet);
    input.feed(glob.invlet);
    await rhack('e'.charCodeAt(0));
    assert.ok(game._occupation, 'the hero is still eating the glob');
    const timer = shrinkTimer(glob);
    game.moves = timer.deadline;
    const event = runClaimedGlobTimer(claimNextDueObjectTimer(game, game.moves), game, game.moves);
    assert.ok(event, 'The due object timer must produce its effect.');
    assert.equal(event.message, null);
    assert.equal(glob.owt, 20);
    assert.ok(shrinkTimer(glob).deadline >= game.moves + 23);
    assert.ok(shrinkTimer(glob).deadline <= game.moves + 27);
    await stopHeroOccupation();
    for (let attempt = 0; glob.owt === 20 && attempt < 8; attempt++) {
        game.moves = shrinkTimer(glob).deadline;
        runClaimedGlobTimer(claimNextDueObjectTimer(game, game.moves), game, game.moves);
    }
    assert.equal(glob.owt, 19, 'an interrupted meal no longer prevents natural shrinkage');
});
void test('ice reduces overdue floor shrinkage to one third', async () => {
    freshGlobState(14);
    requireFixtureGame(game);
    const glob = placeCreatedObject(await mksobj(GLOB_OF_GRAY_OOZE, true, false), 12, 10);
    game.level.requireAt(12, 10).typ = ICE;
    stopAllObjectTimers(glob);
    scheduleObjectTimer(glob, OBJECT_TIMER_KIND.SHRINK_GLOB, 50, game);
    game.moves = 126;
    const event = runClaimedGlobTimer(claimNextDueObjectTimer(game, game.moves), game, game.moves);
    assert.ok(event, 'The due object timer must produce its effect.');
    assert.equal(event.delta, 2);
    assert.equal(glob.owt, 18);
    assert.equal(shrinkTimer(glob).deadline, game.moves + 21);
});
void test('a glob buried under ice does not shrink', async () => {
    freshGlobState(15);
    requireFixtureGame(game);
    const glob = await mksobj(GLOB_OF_BROWN_PUDDING, true, false);
    glob.where = 'buried';
    glob.buried = true;
    glob.ox = 12;
    glob.oy = 10;
    game.level.requireAt(12, 10).typ = ICE;
    game.level.buriedObjects = [glob];
    const timer = shrinkTimer(glob);
    game.moves = timer.deadline;
    const event = runClaimedGlobTimer(claimNextDueObjectTimer(game, game.moves), game, game.moves);
    assert.ok(event, 'The due object timer must produce its effect.');
    assert.ok(!event.overdue && event.delta === 0);
    assert.equal(event.skippedIce, true);
    assert.equal(glob.owt, 20);
    assert.equal(glob.where, 'buried');
    assert.equal(objectTimers(glob).length, 1);
});
void test('a glob inside a carried sack makes the sack lighter', async () => {
    freshGlobState(16);
    requireFixtureGame(game);
    const sack = await mksobj(SACK, true, false);
    const glob = await mksobj(GLOB_OF_GRAY_OOZE, true, false);
    sack.contents = [glob];
    sack.where = 'inventory';
    glob.where = 'contained';
    glob.container = sack;
    game.inventory = [sack];
    sack.owt = objectWeight(sack);
    const oldWeight = sack.owt;
    const timer = shrinkTimer(glob);
    game.moves = timer.deadline;
    const event = runClaimedGlobTimer(claimNextDueObjectTimer(game, game.moves), game, game.moves);
    assert.ok(event, 'The due object timer must produce its effect.');
    assert.equal(event.message, 'Your bag becomes slightly lighter.');
    assert.equal(sack.owt, oldWeight - 1);
    finishGlobTimer(event, game, game.moves);
    assert.equal(sack.contents.includes(glob), true);
});
void test('a monster-carried glob disappears from its pack', async () => {
    freshGlobState(17);
    requireFixtureGame(game);
    const carrier = await createMonsterAt('human', 12, 10);
    const glob = await mksobj(GLOB_OF_GREEN_SLIME, true, false);
    glob.owt = 1;
    await linkObjectToMonsterInventory(carrier, glob);
    const timer = shrinkTimer(glob);
    game.moves = timer.deadline;
    const event = runClaimedGlobTimer(claimNextDueObjectTimer(game, game.moves), game, game.moves);
    assert.ok(event, 'The due object timer must produce its effect.');
    assert.equal(event.message, null);
    assert.equal(glob.where, 'gone');
    assert.equal(carrier.minvent.includes(glob), false);
});
void test('a glob keeps shrinking while it is falling between levels', async () => {
    freshGlobState(18);
    requireFixtureGame(game);
    game.u.uz = { dnum: 0, dlevel: 1 };
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', ...{ num_dunlevs: 2, flags: {} } })];
    game.stairs = {
        sx: 10, sy: 10, up: false, isladder: false, u_traversed: false,
        tolev: { dnum: 0, dlevel: 2 }, next: null,
    };
    const glob = await mksobj(GLOB_OF_GREEN_SLIME, true, false);
    glob.owt = 1;
    const timer = shrinkTimer(glob);
    await shipObject(glob, 10, 10, {
        state: game,
        random: range => range === 3 ? 0 : 99,
    });
    game.moves = timer.deadline;
    const event = runClaimedGlobTimer(claimNextDueObjectTimer(game, game.moves), game, game.moves);
    assert.ok(event, 'The due object timer must produce its effect.');
    assert.equal(event.gone, true);
    assert.equal(glob.where, 'gone');
    assert.ok(game.migratingObjects !== null && game.migratingObjects !== undefined);
    assert.equal(game.migratingObjects.includes(glob), false);
});
void test('a dissolving wielded glob clears the hero weapon slot', async () => {
    freshGlobState(19);
    requireFixtureGame(game);
    const glob = await mksobj(GLOB_OF_BLACK_PUDDING, true, false);
    glob.where = 'inventory';
    glob.owt = 1;
    glob.owornmask = W_WEP;
    glob.wielded = true;
    game.inventory = [glob];
    game.uwep = game.u.uwep = glob;
    const binding = game.commandBindings.lookup('s'.charCodeAt(0));
    assert.ok(binding);
    game._occupation = { key: 'command', text: 'searching', binding };
    const timer = shrinkTimer(glob);
    game.moves = timer.deadline;
    const event = runClaimedGlobTimer(claimNextDueObjectTimer(game, game.moves), game, game.moves);
    assert.ok(event, 'The due object timer must produce its effect.');
    finishGlobTimer(event, game, game.moves);
    assert.equal(game.uwep, null);
    assert.equal(game.u.uwep, null);
    assert.equal(game._occupation, null);
    assert.equal(glob.where, 'gone');
});
//# sourceMappingURL=glob_shrink.test.js.map