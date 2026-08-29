import test from 'node:test';
import assert from 'node:assert/strict';

import {
    getBridgeUsageLedger, resetBridgeUsageLedger,
} from '../js/bridge_policy.js';
import { rhack } from '../js/cmd.js';
import { ROOM, STONE } from '../js/const.js';
import { GameMap } from '../js/game.js';
import { game, resetGame } from '../js/gstate.js';
import { pushKey, resetInputState } from '../js/input.js';
import { mksobj } from '../js/mklev.js';
import {
    POT_CONFUSION, POT_EXTRA_HEALING, POT_FRUIT_JUICE, POT_GAIN_LEVEL,
    POT_INVISIBILITY, POT_PARALYSIS, POT_SICKNESS,
} from '../js/object_data.js';
import { init_objects } from '../js/o_init.js';
import { enableRngLog, getRngLog, initRng } from '../js/rng.js';
import { addInventoryItem } from '../js/u_init.js';
import { vision_recalc, vision_reset_new_level } from '../js/vision.js';

process.env.TELEPORT_BRIDGE_FREE = '1';
process.env.TELEPORT_DISABLE_FIXTURES = '1';

const PM_PURPLE_WORM = 115;

function freshMapPotionState(distance = 2) {
    resetGame();
    const monster = {
        m_id: 2700 + distance,
        mnum: PM_PURPLE_WORM,
        mx: 10 + distance,
        my: 10,
        mhp: 12,
        mhpmax: 12,
        mcanmove: 1,
        msleeping: 0,
        mpeaceful: 0,
        mtame: 0,
        minvent: [],
        inventory: [],
    };
    game.u = {
        ux: 10,
        uy: 10,
        uz: { dnum: 0, dlevel: 4 },
        ulevel: 4,
        uhp: 30,
        uhpmax: 30,
        acurr: { a: [12, 18, 12, 12, 12, 12] },
        amax: { a: [12, 18, 12, 12, 12, 12] },
        ualign: { type: 0, record: 0 },
        uconduct: {},
        uhave: {},
        uswallow: 0,
        ustuck: null,
    };
    game.flags = {};
    game.context = { move: 0 };
    game.moves = 60;
    game.inventory = [];
    game.level = new GameMap();
    game.level.monsters = [monster];
    for (let x = 8; x <= 18; x++) {
        for (let y = 8; y <= 12; y++) {
            game.level.at(x, y).typ = ROOM;
            game.level.at(x, y).lit = true;
        }
    }
    game.in_mklev = false;
    game.animationFrame = async () => {};
    vision_reset_new_level();
    vision_recalc(0);
    initRng(1n);
    init_objects();
    resetInputState();
    resetBridgeUsageLedger();
    return monster;
}

function addKnownPotion(otyp) {
    const potion = mksobj(otyp, true, false);
    potion.cursed = potion.blessed = false;
    potion.bknown = potion.dknown = potion.known = true;
    potion.typeKnown = true;
    potion.objectTimers = [];
    potion.timed = 0;
    return addInventoryItem(potion);
}

async function throwEast(potion, continuationKeys = []) {
    pushKey(potion.invlet);
    pushKey('l');
    for (const key of continuationKeys) pushKey(key);
    await rhack('t'.charCodeAt(0));
}

function assertNoBridgeUse() {
    assert.deepEqual(getBridgeUsageLedger(), {
        bridgeFree: true,
        totalHits: 0,
        forbiddenHits: 0,
        bridges: {},
    });
}

function floorObjects() {
    const objects = [];
    for (const column of game.level.objects || []) {
        for (const pile of column || []) objects.push(...(pile || []));
    }
    return objects;
}

test('live map potion crosses bhit and consumes a successful inert contact',
    async () => {
        const monster = freshMapPotionState(2);
        const potion = addKnownPotion(POT_FRUIT_JUICE);

        initRng(2702n);
        enableRngLog();
        await throwEast(potion, [' ', ' ', ' ', ' ']);

        assert.deepEqual(getRngLog(), [
            'rnd(20)=13',
            'rnd(25)=2',
            'rn2(7)=4',
            'rn2(5)=2',
            'rn2(9)=5',
        ]);
        assert.equal(game.context.move, 1);
        assert.equal(monster.mhp, 11);
        assert.equal(potion.where, 'gone');
        assert.equal(game.inventory.includes(potion), false);
        assert.equal(floorObjects().includes(potion), false);
        assert.match(game._pending_message,
            /potion of fruit juice evaporates\.$/);
        assertNoBridgeUse();
    });

test('live map potion miss wakes conditionally then shatters at bhitpos',
    async () => {
        const monster = freshMapPotionState(2);
        monster.msleeping = 1;
        const potion = addKnownPotion(POT_GAIN_LEVEL);

        initRng(2701n);
        enableRngLog();
        await throwEast(potion, [' ', ' ', ' ']);

        assert.deepEqual(getRngLog(), [
            'rnd(20)=4',
            'rnd(25)=24',
            'rn2(3)=0',
            'rn2(100)=27',
        ]);
        assert.equal(game.context.move, 1);
        assert.equal(monster.mhp, 12);
        assert.equal(monster.msleeping, 0);
        assert.equal(potion.where, 'gone');
        assert.equal(game.inventory.includes(potion), false);
        assert.equal(floorObjects().includes(potion), false);
        assert.match(game._pending_message,
            /potion of gain level shatters!$/);
        assertNoBridgeUse();
    });

test('map potion stack allocates and consumes one split identity', async () => {
    const monster = freshMapPotionState(2);
    const potion = addKnownPotion(POT_FRUIT_JUICE);
    potion.quan = potion.quantity = 2;
    potion.owt *= 2;

    initRng(2731n);
    enableRngLog();
    await throwEast(potion, [' ', ' ', ' ', ' ']);

    assert.deepEqual(getRngLog(), [
        'rnd(2)=2',
        'rnd(20)=2',
        'rnd(25)=6',
        'rn2(7)=3',
        'rn2(5)=1',
        'rn2(9)=8',
    ]);
    assert.deepEqual(game.inventory, [potion]);
    assert.equal(potion.quan, 1);
    assert.equal(potion.quantity, 1);
    assert.equal(potion.where, 'inventory');
    assert.equal(monster.mhp, 11);
    assert.equal(floorObjects().length, 0);
    assertNoBridgeUse();
});

test('one-percent map potion break resistance preserves the thrown identity',
    async () => {
        freshMapPotionState(2);
        game.level.monsters = [];
        const potion = addKnownPotion(POT_GAIN_LEVEL);

        initRng(2795n);
        enableRngLog();
        await throwEast(potion);

        assert.deepEqual(getRngLog(), ['rn2(100)=0']);
        assert.equal(game.inventory.includes(potion), false);
        assert.equal(potion.where, 'floor');
        assert.equal(potion.ox, 16);
        assert.equal(potion.oy, 10);
        assert.ok(floorObjects().includes(potion));
        assertNoBridgeUse();
    });

test('map extra healing contact heals monster then hero through nearby vapor',
    async () => {
        const monster = freshMapPotionState(2);
        monster.mhp = 4;
        monster.mcansee = 0;
        monster.mblinded = 12;
        game.u.uhp = 20;
        game.u.uhpmax = 30;
        game.u.blindTurns = 0;
        game.u.deafTurns = 6;
        const potion = addKnownPotion(POT_EXTRA_HEALING);

        initRng(2804n);
        enableRngLog();
        await throwEast(potion, [' ', ' ', ' ', ' ', ' ', ' ', ' ']);

        assert.deepEqual(getRngLog(), [
            'rnd(20)=15',
            'rnd(25)=2',
            'rn2(7)=6',
            'rn2(5)=2',
            'rn2(9)=0',
            'rn2(19)=13',
        ]);
        assert.equal(monster.mhp, monster.mhpmax);
        assert.equal(monster.mcansee, 1);
        assert.equal(monster.mblinded, 0);
        assert.equal(game.u.uhp, 22);
        assert.equal(game.u.blindTurns, 0);
        assert.equal(game.u.deafTurns, 0);
        assert.equal(potion.where, 'gone');
        assert.equal(game.u._exercise[2], 1);
        assertNoBridgeUse();
    });

test('map sickness contact harms monster before nearby hero vapor', async () => {
    const monster = freshMapPotionState(2);
    game.u.uhp = 30;
    game.u.uhpmax = 30;
    const potion = addKnownPotion(POT_SICKNESS);

    initRng(2942n);
    enableRngLog();
    await throwEast(potion, [' ', ' ', ' ', ' ', ' ', ' ']);

    assert.deepEqual(getRngLog(), [
        'rnd(20)=19',
        'rnd(25)=3',
        'rn2(7)=4',
        'rn2(5)=4',
        'rn2(9)=0',
        'rn2(2)=1',
    ]);
    assert.equal(monster.mhp, 5);
    assert.equal(game.u.uhp, 25);
    assert.equal(game.u._exercise[2], -1);
    assert.equal(potion.where, 'gone');
    assertNoBridgeUse();
});

test('map confusion contact pays resistance before nearby hero vapor', async () => {
    const monster = freshMapPotionState(2);
    monster.m_lev = 15;
    monster.mconf = 0;
    game.u.confusionTurns = 0;
    const potion = addKnownPotion(POT_CONFUSION);

    initRng(2998n);
    enableRngLog();
    await throwEast(potion, [' ', ' ', ' ', ' ', ' ']);

    assert.deepEqual(getRngLog(), [
        'rnd(20)=7',
        'rnd(25)=8',
        'rn2(7)=2',
        'rn2(5)=3',
        'rn2(91)=68',
        'rn2(9)=0',
        'rnd(5)=1',
    ]);
    assert.equal(monster.mhp, 11);
    assert.equal(monster.mconf, 1);
    assert.equal(game.u.confusionTurns, 1);
    assert.equal(potion.where, 'gone');
    assert.match(game._pending_message, /You feel somewhat dizzy\.$/);
    assertNoBridgeUse();
});

test('adjacent hard-floor break applies healing vapor without monster contact',
    async () => {
        freshMapPotionState(2);
        game.level.monsters = [];
        game.level.at(11, 10).typ = STONE;
        game.u.uhp = 20;
        game.u.uhpmax = 30;
        const potion = addKnownPotion(POT_EXTRA_HEALING);
        potion.cursed = false;
        potion.blessed = false;

        initRng(2850n);
        enableRngLog();
        await throwEast(potion, [' ', ' ']);

        assert.deepEqual(getRngLog(), ['rn2(100)=22', 'rn2(19)=10']);
        assert.equal(game.u.uhp, 22);
        assert.equal(potion.where, 'gone');
        assert.equal(floorObjects().length, 0);
        assert.match(game._pending_message, /You smell a peculiar odor\.\.\.$/);
        assertNoBridgeUse();
    });

test('adjacent paralysis contact freezes monster and installs hero helplessness',
    async () => {
        const monster = freshMapPotionState(1);
        monster.meating = 3;
        monster.mstrategy = 0x20000000;
        const potion = addKnownPotion(POT_PARALYSIS);

        initRng(3011n);
        enableRngLog();
        await throwEast(potion, [' ', ' ', ' ', ' ', ' ']);

        assert.deepEqual(getRngLog(), [
            'rnd(20)=5', 'rnd(25)=5', 'rn2(7)=3', 'rn2(5)=1',
            'rnd(25)=2', 'rn2(9)=0', 'rnd(5)=3', 'rn2(2)=1',
        ]);
        assert.equal(monster.mhp, 11);
        assert.equal(monster.mcanmove, 0);
        assert.equal(monster.mfrozen, 2);
        assert.equal(monster.meating, 0);
        assert.equal(monster.mstrategy, 0);
        assert.equal(game._helplessTurns, 3);
        assert.equal(game._helplessReason, 'frozen by a potion');
        assert.equal(game._helplessDoneMessage, 'You can move again.');
        assert.equal(potion.where, 'gone');
        assertNoBridgeUse();
    });

test('unsupported invisibility map potion fails before split or throw RNG', async () => {
    freshMapPotionState(2);
    const potion = addKnownPotion(POT_INVISIBILITY);
    potion.quan = potion.quantity = 2;
    potion.owt *= 2;

    initRng(2796n);
    enableRngLog();
    await assert.rejects(
        throwEast(potion),
        error => error?.code === 'TELEPORT_BRIDGE_FORBIDDEN'
            && error?.bridgeId === 'throw.potion-impact-unsupported',
    );

    assert.deepEqual(getRngLog(), []);
    assert.deepEqual(game.inventory, [potion]);
    assert.equal(potion.quan, 2);
    assert.equal(potion.quantity, 2);
    assert.equal(potion.where, 'inventory');
    assert.equal(floorObjects().length, 0);
});

test('unknown inert map potion fails before interactive trycall debt',
    async () => {
        freshMapPotionState(2);
        const potion = addKnownPotion(POT_GAIN_LEVEL);
        potion.typeKnown = potion.known = false;
        game._knownObjectTypes?.delete(potion.otyp);

        initRng(2797n);
        enableRngLog();
        await assert.rejects(
            throwEast(potion),
            error => error?.code === 'TELEPORT_BRIDGE_FORBIDDEN'
                && error?.bridgeId === 'throw.potion-impact-unsupported',
        );

        assert.deepEqual(getRngLog(), []);
        assert.deepEqual(game.inventory, [potion]);
        assert.equal(potion.where, 'inventory');
        assert.equal(floorObjects().length, 0);
    });
