import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { COLNO, G_GENOD, POOL, ROOM, ROWNO, STONE } from '../js/const.js';
import { finishFigurineTimer, runClaimedFigurineTimer, } from '../js/figurine.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { finishInventoryRemoval } from '../js/hero_inventory.js';
import { unlinkObject } from '../js/object_location.js';
import { pushKey } from '../js/input.js';
import { mksobj } from '../js/mklev.js';
import { addObjectToMonsterInventory, } from '../js/monster_inventory.js';
import { dropMonsterObject } from '../js/monster_drop.js';
import { FIGURINE } from '../js/object_data.js';
import { claimNextDueObjectTimer, OBJECT_TIMER_KIND, objectTimers, } from '../js/object_timers.js';
import { initRng } from '../js/rng.js';
import { addInventoryItem } from '../js/u_init.js';
import { vision_recalc } from '../js/vision.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
function terrainAt(x, y) {
    const location = requireGameLevel().at(x, y);
    assert.ok(location, `map location ${x},${y} exists`);
    return location;
}
function objectsAt(x, y) {
    const objects = requireGameLevel().objects[x]?.[y];
    assert.ok(objects, `object square ${x},${y} exists`);
    return objects;
}
const PM_WUMPUS = 84;
const PM_LEOCROTTA = 83;
const PM_FLOATING_EYE = 28;
async function carriedFigurine({ species = PM_WUMPUS, cursed = true, blessed = false, timerSeed = 123, } = {}) {
    initRng(777n);
    const raw = await mksobj(FIGURINE, true, false);
    raw.corpsenm = species;
    raw.cursed = cursed;
    raw.blessed = blessed;
    raw.bknown = true;
    raw.spe = 2; // CORPSTAT_MALE
    initRng(BigInt(timerSeed));
    const figurine = await addInventoryItem(raw);
    return { figurine };
}
function figTimer(figurine) {
    const timers = objectTimers(figurine);
    assert.equal(timers.length, 1);
    const timer = timers[0];
    assert.ok(timer);
    assert.equal(timer.kind, OBJECT_TIMER_KIND.FIG_TRANSFORM);
    return timer;
}
async function claimTransform(figurine, seed, overdue = 0) {
    const timer = figTimer(figurine);
    game.moves = timer.deadline + overdue;
    initRng(BigInt(seed));
    return runClaimedFigurineTimer(claimNextDueObjectTimer(game, game.moves), game, game.moves);
}
// C steal.c:mdrop_obj(): a monster dropping a carried figurine places it on
// the floor WITHOUT stop_timer(), so the transformation timer survives the
// drop.  This is the C-valid producer for timed floor figurines; the hero's
// own drop command stops the timer instead (invent.c:freeinv_core).
async function droppedByCarrierFigurine({ species = PM_WUMPUS, timerSeed = 321, x = 12, y = 10, relocate = true, } = {}) {
    requirePlayingGame(game);
    const carrier = await ordinaryMonsterCarrier({ x, y });
    const { figurine } = await carriedFigurine({ species });
    await transferFigurineToMonster(figurine, carrier, timerSeed);
    const before = figTimer(figurine);
    await dropMonsterObject(carrier, figurine, game);
    const after = figTimer(figurine);
    // the monster drop preserves the transformation deadline; no internal
    // timer identity is asserted, only the observable schedule
    assert.equal(after.deadline, before.deadline);
    assert.equal(figurine.where, 'floor');
    assert.ok(objectsAt(x, y).includes(figurine));
    assert.equal(carrier.minvent?.includes(figurine), false);
    if (relocate) {
        // the carrier walks on; the figurine square is left free
        carrier.mx = x + 4;
        carrier.my = y + 2;
    }
    return { carrier, figurine, timer: after };
}
async function ordinaryMonsterCarrier({ x = 12, y = 10, invisible = false, } = {}) {
    const carrier = await createMonsterAt(PM_LEOCROTTA, x, y);
    carrier.mhp = 30;
    carrier.mhpmax = 30;
    carrier.female = false;
    carrier.minvis = invisible ? 1 : 0;
    carrier.mundetected = 0;
    return carrier;
}
async function transferFigurineToMonster(figurine, monster, timerSeed = 321) {
    unlinkObject(figurine);
    await finishInventoryRemoval(figurine);
    initRng(BigInt(timerSeed));
    await addObjectToMonsterInventory(monster, figurine, game);
    const timer = figTimer(figurine);
    return { timer };
}
void test('only a viable cursed carried figurine receives a fresh timer', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const { figurine } = await carriedFigurine();
    const timer = figTimer(figurine);
    assert.equal(figurine.where, 'inventory');
    assert.ok(timer.deadline >= game.moves + 201);
    assert.ok(timer.deadline <= game.moves + 9200);
    const uncursed = (await carriedFigurine({ cursed: false })).figurine;
    assert.equal(objectTimers(uncursed).length, 0);
    const vital = game.mvitals?.[PM_LEOCROTTA];
    assert.ok(vital, 'species vital state is initialized');
    vital.mvflags |= G_GENOD;
    const genocided = (await carriedFigurine({ species: PM_LEOCROTTA })).figurine;
    assert.equal(objectTimers(genocided).length, 0);
});
void test('genocide before transformation consumes the figurine without a monster', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const { figurine } = await carriedFigurine();
    const vital = game.mvitals?.[PM_WUMPUS];
    assert.ok(vital, 'species vital state is initialized');
    vital.mvflags |= G_GENOD;
    const event = await claimTransform(figurine, 1);
    assert.ok(event);
    assert.equal(event.monster, null);
    assert.equal(figurine.where, 'gone');
    assert.equal(game.level.monsters.length, 0);
});
void test('monster acquisition resets the deadline before visible pack transform', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const { figurine } = await carriedFigurine();
    const carrier = await ordinaryMonsterCarrier();
    const previousDeadline = figTimer(figurine).deadline;
    game.moves = previousDeadline - 1;
    const { timer } = await transferFigurineToMonster(figurine, carrier);
    assert.ok(timer.deadline > previousDeadline);
    assert.ok(timer.deadline >= game.moves + 201);
    assert.ok(timer.deadline <= game.moves + 9200);
    assert.equal(figurine.where, 'minvent');
    assert.equal(figurine.carrierMid, carrier.m_id);
    assert.ok(carrier.minvent?.includes(figurine));
    assert.equal(carrier.hasInventory, true);
    const event = await claimTransform(figurine, 1);
    assert.ok(event);
    assert.equal(event.carrier, 'minvent');
    assert.equal(event.message, "You see a wumpus drop out of a leocrotta's pack!");
    assert.ok(carrier.minvent?.includes(figurine));
    finishFigurineTimer(event, game);
    assert.equal(figurine.where, 'gone');
    assert.equal(carrier.minvent?.includes(figurine), false);
    assert.equal(carrier.hasInventory, false);
    assert.equal('carrierMid' in figurine, false);
});
void test('invisible monster carrier is attributed to thin air', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const { figurine } = await carriedFigurine();
    const carrier = await ordinaryMonsterCarrier({ invisible: true });
    await transferFigurineToMonster(figurine, carrier);
    const event = await claimTransform(figurine, 1);
    assert.ok(event);
    assert.equal(event.message, 'You see a wumpus drop out of thin air!');
    assert.ok(carrier.minvent?.includes(figurine));
    finishFigurineTimer(event, game);
    assert.equal(carrier.hasInventory, false);
});
void test('invisible monster carrier in a pool is attributed to empty water', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const { figurine } = await carriedFigurine();
    const carrier = await ordinaryMonsterCarrier({ invisible: true });
    terrainAt(carrier.mx, carrier.my).typ = POOL;
    await transferFigurineToMonster(figurine, carrier);
    const event = await claimTransform(figurine, 1);
    assert.ok(event);
    assert.equal(event.message, 'You see a wumpus drop out of empty water!');
    finishFigurineTimer(event, game);
    assert.equal(figurine.where, 'gone');
});
void test('overdue monster-inventory transform stays silent until deletion', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const { figurine } = await carriedFigurine();
    const carrier = await ordinaryMonsterCarrier();
    await transferFigurineToMonster(figurine, carrier);
    const event = await claimTransform(figurine, 1, 25);
    assert.ok(event);
    assert.equal(event.transformed, true);
    assert.equal(event.overdue, true);
    assert.equal(event.message, null);
    assert.ok(carrier.minvent?.includes(figurine));
    finishFigurineTimer(event, game);
    assert.equal(carrier.minvent?.includes(figurine), false);
});
void test('blocked monster-carried figurine retains its carrier for retry', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const { figurine } = await carriedFigurine();
    const carrier = await ordinaryMonsterCarrier();
    await transferFigurineToMonster(figurine, carrier);
    for (let x = 1; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++)
            terrainAt(x, y).typ = STONE;
    }
    terrainAt(carrier.mx, carrier.my).typ = ROOM;
    const event = await claimTransform(figurine, 29);
    assert.ok(event);
    assert.equal(event.transformed, false);
    assert.equal(event.retryScheduled, true);
    assert.ok(event.retryDelay >= 1);
    assert.ok(event.retryDelay <= 5000);
    assert.equal(event.retryDeadline, game.moves + event.retryDelay);
    assert.equal(event.message, null);
    assert.equal(event.monster, null);
    assert.equal(figurine.where, 'minvent');
    assert.ok(carrier.minvent?.includes(figurine));
    assert.equal(figTimer(figurine).deadline, event.retryDeadline);
});
void test('cursed carried figurine creates a hostile actor before pack prose', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const { figurine } = await carriedFigurine();
    const event = await claimTransform(figurine, 1);
    assert.ok(event);
    assert.ok(event.monster);
    assert.equal(event.message, 'You see a wumpus drop out of your pack!');
    assert.equal(event.monster.mpeaceful, 0);
    assert.equal(event.monster.mtame, 0);
    assert.equal(event.monster.female, false);
    assert.ok(game.level.monsters.includes(event.monster));
    assert.ok(game.inventory.includes(figurine));
    finishFigurineTimer(event, game);
    assert.equal(figurine.where, 'gone');
    assert.equal(game.inventory.includes(figurine), false);
});
void test('a named floating-eye figurine keeps its name and floats from the pack', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const { figurine } = await carriedFigurine({ species: PM_FLOATING_EYE });
    figurine.oextra = { ...(figurine.oextra || {}), oname: 'Iris' };
    const event = await claimTransform(figurine, 1);
    assert.ok(event);
    assert.ok(event.monster);
    assert.equal(event.monster.name, 'Iris');
    assert.equal(event.message, 'You see Iris float out of your pack!');
    finishFigurineTimer(event, game);
});
void test('zero disposition initializes a complete non-domestic figurine pet', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const { figurine } = await carriedFigurine();
    const event = await claimTransform(figurine, 17);
    assert.ok(event);
    assert.ok(event.monster);
    assert.ok(game.u.uconduct);
    assert.ok(event.monster.edog);
    assert.equal(event.monster.mtame, 5);
    assert.equal(event.monster.mpeaceful, 1);
    assert.equal(event.monster.pet, true);
    assert.deepEqual(event.monster.edog.ogoal, { x: -1, y: -1 });
    assert.equal(event.monster.edog.apport, 12);
    assert.equal(event.monster.edog.hungrytime, game.moves + 1000);
    assert.equal(game.u.uconduct.pets, 1);
    finishFigurineTimer(event, game);
});
void test('one disposition preserves the familiar birth attitude without taming', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const { figurine } = await carriedFigurine();
    const event = await claimTransform(figurine, 19);
    assert.ok(event);
    assert.ok(event.monster);
    // Native make_familiar() only refrains from taming on this branch;
    // it does not overwrite makemon()'s species/alignment attitude.
    assert.equal(event.monster.mpeaceful, 0);
    assert.equal(event.monster.mtame, 0);
    assert.equal(event.monster.pet, false);
    finishFigurineTimer(event, game);
});
void test('overdue blind inventory transform still presents tactile pack prose', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game.u.blindTurns = 20;
    const { figurine } = await carriedFigurine();
    const event = await claimTransform(figurine, 1, 25);
    assert.ok(event);
    assert.equal(event.transformed, true);
    assert.equal(event.overdue, true);
    assert.equal(event.message, 'You feel something drop from your pack!');
    assert.ok(game.inventory.includes(figurine));
    finishFigurineTimer(event, game);
    assert.equal(figurine.where, 'gone');
});
// C invent.c:freeinv_core(): the hero dropping a timed figurine stops its
// FIG_TRANSFORM timer.  Advancing past the original deadline must not
// transform anything: no monster appears and the figurine stays put.
void test('dropping a carried figurine stops its transformation', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const { figurine } = await carriedFigurine();
    const { deadline } = figTimer(figurine);
    assert.ok(figurine.invlet);
    pushKey(figurine.invlet);
    await rhack('d'.charCodeAt(0));
    assert.equal(figurine.where, 'floor');
    assert.equal(game.inventory.includes(figurine), false);
    const x = figurine.ox, y = figurine.oy;
    assert.ok(objectsAt(x, y).includes(figurine));
    game.moves = deadline + 25;
    assert.equal(claimNextDueObjectTimer(game, game.moves), null);
    assert.equal(game.level.monsters.length, 0);
    assert.ok(objectsAt(x, y).includes(figurine));
});
// A monster dropping its carried figurine preserves the timer
// (steal.c:mdrop_obj has no stop_timer): the floor figurine later
// transforms where the carrier left it.
void test('a monster-dropped figurine transforms on the floor', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const { figurine } = await droppedByCarrierFigurine();
    const x = figurine.ox, y = figurine.oy;
    game.u.ux = x + 2;
    vision_recalc(0);
    const event = await claimTransform(figurine, 1);
    assert.ok(event);
    assert.ok(event.monster);
    assert.equal(event.carrier, 'floor');
    assert.equal(event.message, 'You see a figurine transform into a wumpus!');
    assert.equal(event.monster.mx, x);
    assert.equal(event.monster.my, y);
    assert.equal(event.redraw, true);
    assert.ok(objectsAt(x, y).includes(figurine));
    finishFigurineTimer(event, game);
    assert.equal(figurine.where, 'gone');
    assert.equal(objectsAt(x, y).includes(figurine), false);
});
void test('floor figurine under hero uses makemon adjacent placement', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const { figurine } = await droppedByCarrierFigurine();
    const x = figurine.ox, y = figurine.oy;
    // the hero stands on the figurine's square for this placement case
    game.u.ux = x;
    game.u.uy = y;
    vision_recalc(0);
    const event = await claimTransform(figurine, 1);
    assert.ok(event);
    assert.ok(event.monster);
    assert.equal(event.carrier, 'floor');
    assert.equal(event.message, 'You see a figurine transform into a wumpus!');
    assert.equal(event.x, x);
    assert.equal(event.y, y);
    assert.notDeepEqual([event.monster.mx, event.monster.my], [game.u.ux, game.u.uy]);
    assert.equal(Math.max(Math.abs(event.monster.mx - x), Math.abs(event.monster.my - y)), 1);
    finishFigurineTimer(event, game);
    assert.equal(figurine.where, 'gone');
});
void test('overdue visible floor transformation is silent before object deletion', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const { figurine } = await droppedByCarrierFigurine();
    const x = figurine.ox, y = figurine.oy;
    game.u.ux = x + 2;
    vision_recalc(0);
    const event = await claimTransform(figurine, 1, 25);
    assert.ok(event);
    assert.equal(event.transformed, true);
    assert.equal(event.overdue, true);
    assert.equal(event.message, null);
    assert.equal(event.redraw, false);
    assert.ok(objectsAt(x, y).includes(figurine));
    finishFigurineTimer(event, game);
    assert.equal(figurine.where, 'gone');
});
void test('obstructed floor figurine retains its square and schedules one retry', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const { figurine } = await droppedByCarrierFigurine();
    const x = figurine.ox, y = figurine.oy;
    game.u.ux = x + 2;
    terrainAt(x, y).typ = STONE;
    vision_recalc(0);
    const event = await claimTransform(figurine, 31);
    assert.ok(event);
    assert.equal(event.carrier, 'floor');
    assert.equal(event.retryScheduled, true);
    assert.ok(event.retryDelay >= 1);
    assert.ok(event.retryDelay <= 5000);
    assert.equal(event.retryDeadline, game.moves + event.retryDelay);
    assert.equal(event.message, null);
    assert.equal(figurine.where, 'floor');
    assert.equal(figurine.ox, x);
    assert.equal(figurine.oy, y);
    assert.ok(objectsAt(x, y).includes(figurine));
    assert.equal(figTimer(figurine).deadline, event.retryDeadline);
});
void test('occupied floor square consumes figurine as construction failure', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    // the carrier keeps standing on the drop square: the natural
    // occupier for the construction-failure path
    const { figurine } = await droppedByCarrierFigurine({ relocate: false });
    const x = figurine.ox, y = figurine.oy;
    game.u.ux = x + 2;
    vision_recalc(0);
    const event = await claimTransform(figurine, 37);
    assert.ok(event);
    assert.equal(event.carrier, 'floor');
    assert.equal(event.transformed, false);
    assert.equal(event.retryScheduled, undefined);
    assert.equal(event.message, null);
    assert.equal(figurine.where, 'gone');
    assert.equal(objectsAt(x, y).includes(figurine), false);
    // only the surviving carrier remains on the map
    assert.equal(game.level.monsters.length, 1);
});
void test('a floor figurine over water creates a monster which immediately drowns', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const { figurine } = await droppedByCarrierFigurine({
        species: PM_LEOCROTTA,
    });
    const x = figurine.ox, y = figurine.oy;
    game.u.ux = x + 2;
    terrainAt(x, y).typ = POOL;
    vision_recalc(0);
    const event = await claimTransform(figurine, 37);
    assert.ok(event);
    assert.equal(event.monster, null);
    assert.deepEqual(event.waterMessages, ['You drown the leocrotta.']);
    assert.equal(figurine.where, 'gone');
    // the spawned leocrotta drowned; the relocated carrier survives
    assert.equal(game.level.monsters.length, 1);
});
void test('carried figurine uses whole-map enexto fallback before retrying', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const { figurine } = await carriedFigurine();
    for (let x = 1; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++)
            terrainAt(x, y).typ = STONE;
    }
    terrainAt(game.u.ux, game.u.uy).typ = ROOM;
    terrainAt(game.u.ux + 4, game.u.uy).typ = ROOM;
    const event = await claimTransform(figurine, 29);
    assert.ok(event);
    assert.ok(event.monster);
    assert.equal(event.transformed, true);
    assert.equal(event.retryScheduled, undefined);
    assert.equal(event.monster.mx, game.u.ux + 4);
    assert.equal(event.monster.my, game.u.uy);
    assert.ok(game.inventory.includes(figurine));
    finishFigurineTimer(event, game);
    assert.equal(figurine.where, 'gone');
});
void test('blocked carried figurine retains identity and schedules a bounded retry', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const { figurine } = await carriedFigurine();
    for (let x = 1; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++)
            terrainAt(x, y).typ = STONE;
    }
    // get_obj_location() still resolves the carried identity at the hero;
    // enexto() must reject every other map coordinate for a wumpus.
    terrainAt(game.u.ux, game.u.uy).typ = ROOM;
    const event = await claimTransform(figurine, 29);
    assert.ok(event);
    assert.equal(event.retryScheduled, true);
    assert.ok(event.retryDelay >= 1);
    assert.ok(event.retryDelay <= 5000);
    assert.equal(event.retryDeadline, game.moves + event.retryDelay);
    assert.equal(event.message, null);
    assert.equal(event.monster, null);
    assert.equal(game.level.monsters.length, 0);
    assert.ok(game.inventory.includes(figurine));
    assert.equal(figurine.where, 'inventory');
    assert.equal(figTimer(figurine).deadline, event.retryDeadline);
});
//# sourceMappingURL=figurine_transform.test.js.map