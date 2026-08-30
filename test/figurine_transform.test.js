import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { COLNO, G_GENOD, POOL, ROOM, ROWNO, STONE } from '../js/const.js';
import {
    finishFigurineTimer, runClaimedFigurineTimer,
} from '../js/figurine.js';
import { GameMap } from '../js/game.js';
import { game, resetGame } from '../js/gstate.js';
import { pushKey, resetInputState } from '../js/input.js';
import { mksobj } from '../js/mklev.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { FIGURINE } from '../js/object_data.js';
import { init_objects } from '../js/o_init.js';
import {
    claimNextDueObjectTimer, OBJECT_TIMER_KIND, objectTimers,
} from '../js/object_timers.js';
import { initRng } from '../js/rng.js';
import { addInventoryItem } from '../js/u_init.js';
import { vision_recalc, vision_reset_new_level } from '../js/vision.js';

process.env.TELEPORT_BRIDGE_FREE = '1';
process.env.TELEPORT_DISABLE_FIXTURES = '1';

const PM_WUMPUS = 84;
const PM_LEOCROTTA = 83;
const PM_CHAMELEON = 327;

function freshFigurineState() {
    resetGame();
    game.u = {
        ux: 10, uy: 10,
        uz: { dnum: 0, dlevel: 8 },
        ulevel: 8,
        uhp: 40, uhpmax: 40,
        ualign: { type: 0, record: 0 },
        acurr: { a: Array(6).fill(12) },
        amax: { a: Array(6).fill(12) },
        uconduct: {}, uhave: {},
        blindTurns: 0,
    };
    game.moves = 40;
    game.mvitals = [];
    game.inventory = [];
    game.flags = {};
    game.context = {};
    game.level = new GameMap();
    game.level.monsters = [];
    for (let x = 7; x <= 16; x++) {
        for (let y = 6; y <= 14; y++) {
            const location = game.level.at(x, y);
            location.typ = ROOM;
            location.lit = true;
        }
    }
    game.in_mklev = false;
    vision_reset_new_level();
    vision_recalc(0);
    initRng(999n);
    init_objects();
    resetInputState();
}

function carriedFigurine({
    species = PM_WUMPUS, cursed = true, blessed = false, timerSeed = 123,
} = {}) {
    initRng(777n);
    const raw = mksobj(FIGURINE, true, false);
    raw.corpsenm = species;
    raw.cursed = cursed;
    raw.blessed = blessed;
    raw.bknown = true;
    raw.spe = 2; // CORPSTAT_MALE
    initRng(BigInt(timerSeed));
    const figurine = addInventoryItem(raw);
    return { figurine };
}

function figTimer(figurine) {
    const timers = objectTimers(figurine);
    assert.equal(timers.length, 1);
    assert.equal(timers[0].kind, OBJECT_TIMER_KIND.FIG_TRANSFORM);
    assert.equal(timers[0].deadline, figurine.figTransformAt);
    return timers[0];
}


async function claimTransform(figurine, seed, overdue = 0) {
    const timer = figTimer(figurine);
    game.moves = timer.deadline + overdue;
    initRng(BigInt(seed));
    return runClaimedFigurineTimer(
        claimNextDueObjectTimer(game, game.moves), game, game.moves,
    );
}

async function dropFigurineThroughCommand(figurine) {
    const before = figTimer(figurine);
    pushKey(figurine.invlet);
    await rhack('d'.charCodeAt(0));
    const after = figTimer(figurine);
    assert.equal(after.id, before.id);
    assert.equal(after.deadline, before.deadline);
    assert.equal(figurine.where, 'floor');
    assert.equal(game.inventory.includes(figurine), false);
    assert.ok(game.level.objects[figurine.ox][figurine.oy].includes(figurine));
    return after;
}

function ordinaryMonsterCarrier({ x = 12, y = 10, invisible = false } = {}) {
    const monster = {
        m_id: 700,
        mnum: PM_LEOCROTTA,
        mx: x, my: y,
        mhp: 30, mhpmax: 30,
        female: false,
        minvis: invisible ? 1 : 0,
        mundetected: 0,
        minvent: [],
        inventory: [],
        hasInventory: false,
    };
    game.level.monsters.push(monster);
    return monster;
}

function transferFigurineToMonster(figurine, monster, timerSeed = 321) {
    const prior = { ...figTimer(figurine) };
    const index = game.inventory.indexOf(figurine);
    if (index >= 0) game.inventory.splice(index, 1);
    initRng(BigInt(timerSeed));
    addObjectToMonsterInventory(monster, figurine, game);
    const timer = figTimer(figurine);
    return { prior, timer };
}

test('only a viable cursed carried figurine receives a fresh timer', () => {
    freshFigurineState();
    const { figurine } = carriedFigurine();
    const timer = figTimer(figurine);
    assert.equal(figurine.where, 'inventory');
    assert.ok(timer.deadline >= game.moves + 201);
    assert.ok(timer.deadline <= game.moves + 9200);

    const uncursed = carriedFigurine({ cursed: false }).figurine;
    assert.equal(objectTimers(uncursed).length, 0);
    game.mvitals[PM_LEOCROTTA] = { mvflags: G_GENOD };
    const genocided = carriedFigurine({ species: PM_LEOCROTTA }).figurine;
    assert.equal(objectTimers(genocided).length, 0);
});

test('monster acquisition replaces the timer before visible pack transform',
    async () => {
        freshFigurineState();
        const { figurine } = carriedFigurine();
        const carrier = ordinaryMonsterCarrier();
        const { prior, timer } = transferFigurineToMonster(
            figurine, carrier,
        );
        assert.notEqual(timer.id, prior.id);
        assert.ok(timer.deadline >= game.moves + 201);
        assert.ok(timer.deadline <= game.moves + 9200);
        assert.equal(figurine.where, 'minvent');
        assert.equal(figurine.carrierMid, carrier.m_id);
        assert.ok(carrier.minvent.includes(figurine));
        assert.equal(carrier.hasInventory, true);

        const event = await claimTransform(figurine, 1);
        assert.equal(event.carrier, 'minvent');
        assert.equal(event.message,
            "You see a wumpus drop out of a leocrotta's pack!");
        assert.ok(carrier.minvent.includes(figurine));

        finishFigurineTimer(event, game);
        assert.equal(figurine.where, 'gone');
        assert.equal(carrier.minvent.includes(figurine), false);
        assert.equal(carrier.hasInventory, false);
        assert.equal('carrierMid' in figurine, false);
    });

test('invisible monster carrier is attributed to thin air', async () => {
    freshFigurineState();
    const { figurine } = carriedFigurine();
    const carrier = ordinaryMonsterCarrier({ invisible: true });
    transferFigurineToMonster(figurine, carrier);

    const event = await claimTransform(figurine, 1);
    assert.equal(event.message, 'You see a wumpus drop out of thin air!');
    assert.ok(carrier.minvent.includes(figurine));
    finishFigurineTimer(event, game);
    assert.equal(carrier.hasInventory, false);
});

test('invisible monster carrier in a pool is attributed to empty water',
    async () => {
        freshFigurineState();
        const { figurine } = carriedFigurine();
        const carrier = ordinaryMonsterCarrier({ invisible: true });
        game.level.at(carrier.mx, carrier.my).typ = POOL;
        transferFigurineToMonster(figurine, carrier);

        const event = await claimTransform(figurine, 1);
        assert.equal(event.message,
            'You see a wumpus drop out of empty water!');
        finishFigurineTimer(event, game);
        assert.equal(figurine.where, 'gone');
    });

test('overdue monster-inventory transform stays silent until deletion',
    async () => {
        freshFigurineState();
        const { figurine } = carriedFigurine();
        const carrier = ordinaryMonsterCarrier();
        transferFigurineToMonster(figurine, carrier);

        const event = await claimTransform(figurine, 1, 25);
        assert.equal(event.transformed, true);
        assert.equal(event.overdue, true);
        assert.equal(event.message, null);
        assert.ok(carrier.minvent.includes(figurine));
        finishFigurineTimer(event, game);
        assert.equal(carrier.minvent.includes(figurine), false);
    });

test('blocked monster-carried figurine retains its carrier for retry',
    async () => {
        freshFigurineState();
        const { figurine } = carriedFigurine();
        const carrier = ordinaryMonsterCarrier();
        transferFigurineToMonster(figurine, carrier);
        for (let x = 1; x < COLNO; x++) {
            for (let y = 0; y < ROWNO; y++)
                game.level.at(x, y).typ = STONE;
        }
        game.level.at(carrier.mx, carrier.my).typ = ROOM;

        const event = await claimTransform(figurine, 29);
        assert.equal(event.transformed, false);
        assert.equal(event.retryScheduled, true);
        assert.ok(event.retryDelay >= 1);
        assert.ok(event.retryDelay <= 5000);
        assert.equal(event.retryDeadline, game.moves + event.retryDelay);
        assert.equal(event.message, null);
        assert.equal(event.monster, null);
        assert.equal(figurine.where, 'minvent');
        assert.ok(carrier.minvent.includes(figurine));
        assert.equal(figTimer(figurine).deadline, event.retryDeadline);
    });

test('cursed carried figurine creates a hostile actor before pack prose',
    async () => {
        freshFigurineState();
        const { figurine } = carriedFigurine();
        const event = await claimTransform(figurine, 1);
        assert.equal(event.chance, 2);
        assert.equal(event.disposition, 2);
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

test('zero disposition initializes a complete non-domestic figurine pet',
    async () => {
        freshFigurineState();
        const { figurine } = carriedFigurine();
        const event = await claimTransform(figurine, 17);
        assert.equal(event.chance, 0);
        assert.equal(event.disposition, 0);
        assert.equal(event.monster.mtame, 5);
        assert.equal(event.monster.mpeaceful, 1);
        assert.equal(event.monster.pet, true);
        assert.deepEqual(event.monster.edog.ogoal, { x: -1, y: -1 });
        assert.equal(event.monster.edog.apport, 12);
        assert.equal(event.monster.edog.hungrytime, game.moves + 1000);
        assert.equal(game.u.uconduct.pets, 1);
        finishFigurineTimer(event, game);
    });

test('one disposition preserves the familiar birth attitude without taming',
    async () => {
        freshFigurineState();
        const { figurine } = carriedFigurine();
        const event = await claimTransform(figurine, 19);
        assert.equal(event.chance, 1);
        assert.equal(event.disposition, 1);
        // Native make_familiar() only refrains from taming on this branch;
        // it does not overwrite makemon()'s species/alignment attitude.
        assert.equal(event.monster.mpeaceful, 0);
        assert.equal(event.monster.mtame, 0);
        assert.equal(event.monster.pet, false);
        finishFigurineTimer(event, game);
    });

test('overdue blind inventory transform still presents tactile pack prose',
    async () => {
        freshFigurineState();
        game.u.blindTurns = 20;
        const { figurine } = carriedFigurine();
        const event = await claimTransform(figurine, 1, 25);
        assert.equal(event.overdue, true);
        assert.equal(event.message, 'You feel something drop from your pack!');
        assert.ok(game.inventory.includes(figurine));
        finishFigurineTimer(event, game);
        assert.equal(figurine.where, 'gone');
    });

test('unsupported shapechanger rejects before mutation',
    async () => {
        freshFigurineState();
        const { figurine } = carriedFigurine({ species: PM_CHAMELEON });
        const timer = figTimer(figurine);
        game.moves = timer.deadline;
        initRng(1n);
        const claimed = claimNextDueObjectTimer(game, game.moves);
        await assert.rejects(
            runClaimedFigurineTimer(claimed, game, game.moves),
            /excludes minion or shapechanger/,
        );
        assert.equal(figurine.where, 'inventory');
        assert.equal(game.level.monsters.length, 0);
    });

test('drop command preserves figurine timer into visible floor transformation',
    async () => {
        freshFigurineState();
        const { figurine } = carriedFigurine();
        await dropFigurineThroughCommand(figurine);
        const x = figurine.ox, y = figurine.oy;
        game.u.ux = x + 2;
        vision_recalc(0);

        const event = await claimTransform(figurine, 1);
        assert.equal(event.carrier, 'floor');
        assert.equal(event.message, 'You see a figurine transform into a wumpus!');
        assert.equal(event.monster.mx, x);
        assert.equal(event.monster.my, y);
        assert.equal(event.redraw, true);
        assert.ok(game.level.objects[x][y].includes(figurine));

        finishFigurineTimer(event, game);
        assert.equal(figurine.where, 'gone');
        assert.equal(game.level.objects[x][y].includes(figurine), false);
    });

test('floor figurine under hero uses makemon adjacent placement',
    async () => {
        freshFigurineState();
        const { figurine } = carriedFigurine();
        await dropFigurineThroughCommand(figurine);
        const x = figurine.ox, y = figurine.oy;

        const event = await claimTransform(figurine, 1);
        assert.equal(event.carrier, 'floor');
        assert.equal(event.message, 'You see a figurine transform into a wumpus!');
        assert.equal(event.x, x);
        assert.equal(event.y, y);
        assert.notDeepEqual(
            [event.monster.mx, event.monster.my], [game.u.ux, game.u.uy],
        );
        assert.equal(Math.max(
            Math.abs(event.monster.mx - x), Math.abs(event.monster.my - y),
        ), 1);
        finishFigurineTimer(event, game);
        assert.equal(figurine.where, 'gone');
    });

test('overdue visible floor transformation is silent before object deletion',
    async () => {
        freshFigurineState();
        const { figurine } = carriedFigurine();
        await dropFigurineThroughCommand(figurine);
        const x = figurine.ox, y = figurine.oy;
        game.u.ux = x + 2;
        vision_recalc(0);

        const event = await claimTransform(figurine, 1, 25);
        assert.equal(event.transformed, true);
        assert.equal(event.overdue, true);
        assert.equal(event.message, null);
        assert.equal(event.redraw, false);
        assert.ok(game.level.objects[x][y].includes(figurine));
        finishFigurineTimer(event, game);
        assert.equal(figurine.where, 'gone');
    });

test('obstructed floor figurine retains its square and schedules one retry',
    async () => {
        freshFigurineState();
        const { figurine } = carriedFigurine();
        await dropFigurineThroughCommand(figurine);
        const x = figurine.ox, y = figurine.oy;
        game.u.ux = x + 2;
        game.level.at(x, y).typ = STONE;
        vision_recalc(0);

        const event = await claimTransform(figurine, 31);
        assert.equal(event.carrier, 'floor');
        assert.equal(event.retryScheduled, true);
        assert.ok(event.retryDelay >= 1);
        assert.ok(event.retryDelay <= 5000);
        assert.equal(event.retryDeadline, game.moves + event.retryDelay);
        assert.equal(event.message, null);
        assert.equal(figurine.where, 'floor');
        assert.equal(figurine.ox, x);
        assert.equal(figurine.oy, y);
        assert.ok(game.level.objects[x][y].includes(figurine));
        assert.equal(figTimer(figurine).deadline, event.retryDeadline);
    });

test('occupied floor square consumes figurine as construction failure',
    async () => {
        freshFigurineState();
        const { figurine } = carriedFigurine();
        await dropFigurineThroughCommand(figurine);
        const x = figurine.ox, y = figurine.oy;
        game.u.ux = x + 2;
        game.level.monsters.push({
            mnum: PM_LEOCROTTA, mx: x, my: y, mhp: 20, mhpmax: 20,
        });
        vision_recalc(0);

        const event = await claimTransform(figurine, 37);
        assert.equal(event.carrier, 'floor');
        assert.equal(event.transformed, false);
        assert.equal(event.retryScheduled, undefined);
        assert.equal(event.message, null);
        assert.equal(figurine.where, 'gone');
        assert.equal(game.level.objects[x][y].includes(figurine), false);
        assert.equal(game.level.monsters.length, 1);
    });

test('carried figurine uses whole-map enexto fallback before retrying',
    async () => {
        freshFigurineState();
        const { figurine } = carriedFigurine();
        for (let x = 1; x < COLNO; x++) {
            for (let y = 0; y < ROWNO; y++)
                game.level.at(x, y).typ = STONE;
        }
        game.level.at(game.u.ux, game.u.uy).typ = ROOM;
        game.level.at(game.u.ux + 4, game.u.uy).typ = ROOM;

        const event = await claimTransform(figurine, 29);
        assert.equal(event.transformed, true);
        assert.equal(event.retryScheduled, undefined);
        assert.equal(event.monster.mx, game.u.ux + 4);
        assert.equal(event.monster.my, game.u.uy);
        assert.ok(game.inventory.includes(figurine));
        finishFigurineTimer(event, game);
        assert.equal(figurine.where, 'gone');
    });

test('blocked carried figurine retains identity and schedules a bounded retry',
    async () => {
        freshFigurineState();
        const { figurine } = carriedFigurine();
        for (let x = 1; x < COLNO; x++) {
            for (let y = 0; y < ROWNO; y++)
                game.level.at(x, y).typ = STONE;
        }
        // get_obj_location() still resolves the carried identity at the hero;
        // enexto() must reject every other map coordinate for a wumpus.
        game.level.at(game.u.ux, game.u.uy).typ = ROOM;

        const event = await claimTransform(figurine, 29);
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
