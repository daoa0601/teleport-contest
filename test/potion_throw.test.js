import test from 'node:test';
import assert from 'node:assert/strict';

import {
    getBridgeUsageLedger, resetBridgeUsageLedger,
} from '../js/bridge_policy.js';
import { rhack } from '../js/cmd.js';
import { ROOM, STONE, W_ARM, W_ARMC } from '../js/const.js';
import { GameMap } from '../js/game.js';
import { game, resetGame } from '../js/gstate.js';
import { pushKey, resetInputState } from '../js/input.js';
import { mksobj } from '../js/mklev.js';
import {
    CORPSE, IRON_CHAIN,
    POT_ACID, POT_CONFUSION, POT_EXTRA_HEALING, POT_FRUIT_JUICE, POT_GAIN_LEVEL,
    POT_INVISIBILITY, POT_OIL, POT_PARALYSIS, POT_SICKNESS, POT_SPEED,
    POT_WATER, RIN_POLYMORPH_CONTROL,
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

function addSleepingNeighbor(m_id, { strategy = null } = {}) {
    const neighbor = {
        m_id,
        mnum: PM_PURPLE_WORM,
        mx: 13,
        my: 10,
        mhp: 12,
        mhpmax: 12,
        msleeping: 1,
        mpeaceful: 0,
        mtame: 0,
        minvent: [],
        inventory: [],
    };
    if (strategy !== null) neighbor.mstrategy = strategy;
    game.level.monsters.push(neighbor);
    return neighbor;
}

test('live map potion crosses bhit and consumes a successful inert contact',
    async () => {
        const monster = freshMapPotionState(2);
        monster.msleeping = 1;
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
        assert.equal(monster.msleeping, 0);
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
    monster.msleeping = 1;
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
    assert.equal(monster.msleeping, 0);
    assert.equal(game.u.uhp, 25);
    assert.equal(game.u._exercise[2], -1);
    assert.equal(potion.where, 'gone');
    assertNoBridgeUse();
});

test('map confusion contact pays resistance before nearby hero vapor', async () => {
    const monster = freshMapPotionState(2);
    monster.m_lev = 15;
    monster.mconf = 0;
    monster.msleeping = 1;
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
    assert.equal(monster.msleeping, 0);
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

test('map speed contact accelerates monster before nearby hero movement timeout',
    async () => {
        const monster = freshMapPotionState(2);
        monster.permspeed = 0;
        monster.mspeed = 0;
        monster.msleeping = 1;
        game.u.fast = false;
        game.u.veryFast = false;
        game.u.veryFastTurns = 0;
        const potion = addKnownPotion(POT_SPEED);

        initRng(3321n);
        enableRngLog();
        await throwEast(potion, [' ', ' ', ' ', ' ', ' ', ' ']);

        assert.deepEqual(getRngLog(), [
            'rnd(20)=2', 'rnd(25)=6', 'rn2(7)=5', 'rn2(5)=1',
            'rn2(9)=0', 'rnd(5)=5', 'rn2(19)=15',
        ]);
        assert.equal(monster.mhp, 11);
        assert.equal(monster.permspeed, 2);
        assert.equal(monster.mspeed, 2);
        assert.equal(monster.msleeping, 0);
        assert.equal(game.u.veryFast, true);
        assert.equal(game.u.veryFastTurns, 5);
        assert.equal(game.u._exercise[1], 0);
        assert.equal(potion.where, 'gone');
        assertNoBridgeUse();
    });

test('map invisibility contact hides the target and records its remembered square',
    async () => {
        const monster = freshMapPotionState(2);
        monster.minvis = 0;
        monster.perminvis = 0;
        monster.invis_blkd = 0;
        game.level.flags.hero_memory = true;
        const potion = addKnownPotion(POT_INVISIBILITY);

        initRng(3321n);
        enableRngLog();
        await throwEast(potion, [' ', ' ', ' ', ' ', ' ']);

        assert.deepEqual(getRngLog(), [
            'rnd(20)=2', 'rnd(25)=6', 'rn2(7)=5', 'rn2(5)=1',
            'rn2(9)=0',
        ]);
        assert.equal(monster.mhp, 11);
        assert.equal(monster.perminvis, 1);
        assert.equal(monster.minvis, 1);
        assert.equal(
            game.level.at(monster.mx, monster.my).remembered_glyph?.kind,
            'invisible',
        );
        assert.equal(potion.where, 'gone');
        assertNoBridgeUse();
    });

test('cursed map potion pays a zero slip gate without rerouting its flight',
    async () => {
        const monster = freshMapPotionState(2);
        monster.minvis = 1;
        monster.perminvis = 1;
        monster.invis_blkd = 0;
        monster.msleeping = 1;
        game.level.flags.hero_memory = true;
        game.level.at(monster.mx, monster.my).remembered_glyph = {
            ch: 'I', color: 0, decgfx: false, kind: 'invisible',
        };
        const potion = addKnownPotion(POT_INVISIBILITY);
        potion.cursed = true;
        potion.blessed = false;

        initRng(7n);
        enableRngLog();
        await throwEast(potion, [' ', ' ', ' ', ' ', ' ']);

        assert.deepEqual(getRngLog(), [
            'rn2(7)=0', 'rnd(20)=5', 'rnd(25)=16',
            'rn2(7)=5', 'rn2(5)=0', 'rn2(9)=2',
        ]);
        assert.equal(monster.mhp, 12);
        assert.equal(monster.perminvis, 0);
        assert.equal(monster.minvis, 0);
        assert.equal(monster.msleeping, 0);
        assert.notEqual(
            game.level.at(monster.mx, monster.my).remembered_glyph?.kind,
            'invisible',
        );
        assert.equal(potion.where, 'gone');
        assertNoBridgeUse();
    });

test('live acid-resistant target skips resistance, pain, and radius damage',
    async () => {
        const monster = freshMapPotionState(2);
        Object.assign(monster, {
            mnum: 6,
            mhp: 20,
            mhpmax: 20,
            msleeping: 1,
        });
        const neighbor = addSleepingNeighbor(2712);
        const potion = addKnownPotion(POT_ACID);

        initRng(2702n);
        enableRngLog();
        await throwEast(potion, Array(20).fill(' '));

        const rngLog = getRngLog();
        const chip = Number(rngLog.find(entry =>
            entry.startsWith('rn2(5)=')).split('=')[1]) !== 0 ? 1 : 0;
        assert.equal(rngLog.some(entry => entry.startsWith('rn2(105)=')),
            false);
        assert.equal(rngLog.some(entry => entry.startsWith('d(1,8)=')),
            false);
        assert.equal(monster.mhp, 20 - chip);
        assert.equal(monster.msleeping, 0);
        assert.equal(neighbor.msleeping, 1);
        assert.equal(potion.where, 'gone');
        assertNoBridgeUse();
    });

test('live worn acid-protection armor grants resistance before potion MR',
    async () => {
        for (const equipment of [
            { otyp: 144, mask: W_ARMC },
            { otyp: 110, mask: W_ARM },
        ]) {
            const monster = freshMapPotionState(2);
            Object.assign(monster, {
                mnum: 289,
                mhp: 20,
                mhpmax: 20,
                msleeping: 1,
                misc_worn_check: equipment.mask,
            });
            const armor = {
                otyp: equipment.otyp,
                owornmask: equipment.mask,
                worn: true,
            };
            monster.minvent = [armor];
            monster.inventory = monster.minvent;
            const potion = addKnownPotion(POT_ACID);

            initRng(2702n);
            enableRngLog();
            await throwEast(potion, Array(20).fill(' '));

            const rngLog = getRngLog();
            const chip = Number(rngLog.find(entry =>
                entry.startsWith('rn2(5)=')).split('=')[1]) !== 0 ? 1 : 0;
            assert.equal(rngLog.some(entry => entry.startsWith('rn2(98)=')),
                false);
            assert.equal(rngLog.some(entry => /^d\([12],[48]\)=/.test(entry)),
                false);
            assert.equal(monster.mhp, 20 - chip);
            assert.equal(monster.msleeping, 0);
            assert.strictEqual(monster.minvent[0], armor);
            assert.equal(potion.where, 'gone');
            assertNoBridgeUse();
        }
    });

test('live magic-resistant acid target pays resistance without radius damage',
    async () => {
        const monster = freshMapPotionState(2);
        Object.assign(monster, {
            mnum: 48,
            mhp: 20,
            mhpmax: 20,
            msleeping: 1,
        });
        const neighbor = addSleepingNeighbor(2713);
        const potion = addKnownPotion(POT_ACID);

        initRng(2700n);
        enableRngLog();
        await throwEast(potion, Array(20).fill(' '));

        const rngLog = getRngLog();
        const resistanceEntry = rngLog.find(entry =>
            entry.startsWith('rn2(97)='));
        const chip = Number(rngLog.find(entry =>
            entry.startsWith('rn2(5)=')).split('=')[1]) !== 0 ? 1 : 0;
        assert.ok(resistanceEntry);
        assert.ok(Number(resistanceEntry.split('=')[1]) < 90);
        assert.equal(rngLog.some(entry => entry.startsWith('d(1,8)=')),
            false);
        assert.equal(monster.mhp, 20 - chip);
        assert.equal(monster.msleeping, 0);
        assert.equal(neighbor.msleeping, 1);
        assert.equal(potion.where, 'gone');
        assertNoBridgeUse();
    });

test('live acid damage wakes the audible source radius before survival',
    async () => {
        const monster = freshMapPotionState(2);
        Object.assign(monster, {
            mnum: 289,
            mhp: 20,
            mhpmax: 20,
            msleeping: 1,
        });
        const neighbor = addSleepingNeighbor(2714, {
            strategy: 0x60000000,
        });
        const potion = addKnownPotion(POT_ACID);

        initRng(2702n);
        enableRngLog();
        await throwEast(potion, Array(20).fill(' '));

        const rngLog = getRngLog();
        const resistanceEntry = rngLog.find(entry =>
            entry.startsWith('rn2(98)='));
        const damageEntry = rngLog.find(entry =>
            entry.startsWith('d(1,8)='));
        const chip = Number(rngLog.find(entry =>
            entry.startsWith('rn2(5)=')).split('=')[1]) !== 0 ? 1 : 0;
        assert.ok(Number(resistanceEntry.split('=')[1]) >= 30);
        assert.ok(damageEntry);
        assert.equal(monster.mhp,
            20 - chip - Number(damageEntry.split('=')[1]));
        assert.equal(monster.msleeping, 0);
        assert.equal(neighbor.msleeping, 0);
        assert.equal(neighbor.mstrategy, 0x40000000);
        assert.match(game._pending_message, /shrieks in pain!/);
        assert.equal(potion.where, 'gone');
        assertNoBridgeUse();
    });

test('live acid damages a silent target without radius wake', async () => {
    const monster = freshMapPotionState(2);
    Object.assign(monster, {
        mnum: 99,
        mhp: 20,
        mhpmax: 20,
        msleeping: 1,
    });
    const neighbor = addSleepingNeighbor(2715);
    const potion = addKnownPotion(POT_ACID);

    initRng(2702n);
    enableRngLog();
    await throwEast(potion, Array(20).fill(' '));

    assert.ok(getRngLog().some(entry => entry.startsWith('d(1,8)=')));
    assert.ok(monster.mhp < 19);
    assert.equal(monster.msleeping, 0);
    assert.equal(neighbor.msleeping, 1);
    assert.match(game._pending_message, /writhes in pain!/);
    assert.equal(potion.where, 'gone');
    assertNoBridgeUse();
});

test('live blessed and cursed acid use their distinct source damage dice',
    async () => {
        for (const specimen of [
            { blessed: true, cursed: false, signature: 'd(1,4)=' },
            { blessed: false, cursed: true, signature: 'd(2,8)=' },
        ]) {
            const monster = freshMapPotionState(2);
            Object.assign(monster, {
                mnum: 289,
                mhp: 40,
                mhpmax: 40,
            });
            const potion = addKnownPotion(POT_ACID);
            potion.blessed = specimen.blessed;
            potion.cursed = specimen.cursed;

            initRng(2702n);
            enableRngLog();
            await throwEast(potion, Array(20).fill(' '));

            const rngLog = getRngLog();
            const damageEntry = rngLog.find(entry =>
                entry.startsWith(specimen.signature));
            const chip = Number(rngLog.find(entry =>
                entry.startsWith('rn2(5)=')).split('=')[1]) !== 0 ? 1 : 0;
            assert.ok(damageEntry);
            assert.equal(monster.mhp,
                40 - chip - Number(damageEntry.split('=')[1]));
            assert.equal(potion.where, 'gone');
            assertNoBridgeUse();
        }
    });

test('live fatal acid crosses the ordinary map death continuation', async () => {
    const monster = freshMapPotionState(2);
    Object.assign(monster, {
        mnum: 289,
        mhp: 2,
        mhpmax: 20,
    });
    const potion = addKnownPotion(POT_ACID);

    initRng(2702n);
    enableRngLog();
    await throwEast(potion, Array(40).fill(' '));

    assert.equal(monster.dead, true);
    assert.equal(game.level.monsters.includes(monster), false);
    assert.equal(game.u.uconduct.killer, 1);
    assert.equal(potion.where, 'gone');
    assertNoBridgeUse();
});

test('live blessed water damages a demon and wakes its source-radius neighbors',
    async () => {
        const monster = freshMapPotionState(2);
        Object.assign(monster, {
            mnum: 289,
            mhp: 20,
            mhpmax: 20,
            msleeping: 1,
        });
        const neighbor = addSleepingNeighbor(2710, {
            strategy: 0x60000000,
        });
        const potion = addKnownPotion(POT_WATER);
        potion.blessed = true;

        initRng(2702n);
        enableRngLog();
        await throwEast(potion, Array(20).fill(' '));

        assert.deepEqual(getRngLog(), [
            'rnd(20)=13', 'rnd(25)=2', 'rn2(7)=4', 'rn2(5)=2',
            'd(2,6)=7', 'rn2(9)=7',
        ]);
        assert.equal(monster.mhp, 12);
        assert.equal(monster.msleeping, 0);
        assert.equal(neighbor.msleeping, 0);
        assert.equal(neighbor.mstrategy, 0x40000000);
        assert.equal(potion.where, 'gone');
        assertNoBridgeUse();
    });

test('live cursed water heals a demon without taking the hostile wake branch',
    async () => {
        const monster = freshMapPotionState(2);
        Object.assign(monster, {
            mnum: 289,
            mhp: 8,
            mhpmax: 20,
            msleeping: 1,
        });
        const potion = addKnownPotion(POT_WATER);
        potion.cursed = true;

        initRng(2702n);
        enableRngLog();
        await throwEast(potion, Array(20).fill(' '));

        assert.deepEqual(getRngLog(), [
            'rn2(7)=0', 'rnd(20)=2', 'rnd(25)=15', 'rn2(7)=3',
            'rn2(5)=0', 'd(2,6)=6', 'rn2(9)=1',
        ]);
        assert.equal(monster.mhp, 14);
        assert.equal(monster.msleeping, 0);
        assert.equal(monster.mpeaceful, 0);
        assert.equal(potion.where, 'gone');
        assertNoBridgeUse();
    });

test('live blessed water damages silent undead without waking its neighbors',
    async () => {
        const monster = freshMapPotionState(2);
        Object.assign(monster, {
            mnum: 187,
            mhp: 20,
            mhpmax: 20,
            msleeping: 1,
        });
        const neighbor = addSleepingNeighbor(2711);
        const potion = addKnownPotion(POT_WATER);
        potion.blessed = true;

        initRng(2702n);
        enableRngLog();
        await throwEast(potion, Array(20).fill(' '));

        assert.ok(monster.mhp < 19);
        assert.equal(monster.msleeping, 0);
        assert.equal(neighbor.msleeping, 1);
        assert.equal(potion.where, 'gone');
        assertNoBridgeUse();
    });

test('live cursed water changes a human were only without shape protection',
    async () => {
        for (const protectedHero of [false, true]) {
            const monster = freshMapPotionState(2);
            Object.assign(monster, {
                mnum: 263,
                mhp: 10,
                mhpmax: 20,
                msleeping: 1,
            });
            game.u.protectionFromShapeChangers = protectedHero;
            const potion = addKnownPotion(POT_WATER);
            potion.cursed = true;

            initRng(2702n);
            enableRngLog();
            await throwEast(potion, Array(20).fill(' '));

            assert.equal(monster.mnum, protectedHero ? 263 : 21);
            assert.ok(monster.mhp > 9);
            assert.equal(monster.msleeping, 0);
            assert.equal(potion.where, 'gone');
            assertNoBridgeUse();
        }
    });

test('live ordinary water rusts a surviving iron golem', async () => {
    const monster = freshMapPotionState(2);
    Object.assign(monster, {
        mnum: 259,
        mhp: 20,
        mhpmax: 20,
        msleeping: 1,
    });
    const potion = addKnownPotion(POT_WATER);

    initRng(2702n);
    enableRngLog();
    await throwEast(potion, Array(20).fill(' '));

    assert.ok(monster.mhp < 19);
    assert.equal(monster.dead, undefined);
    assert.equal(game.level.monsters.includes(monster), true);
    assert.equal(monster.msleeping, 0);
    assert.match(game._pending_message, /iron golem rusts\./);
    assert.equal(potion.where, 'gone');
    assertNoBridgeUse();
});

test('live water contact clones a hostile gremlin with split hit points',
    async () => {
        const monster = freshMapPotionState(2);
        Object.assign(monster, {
            mnum: 40,
            mhp: 12,
            mhpmax: 12,
            msleeping: 1,
        });
        const potion = addKnownPotion(POT_WATER);

        initRng(2702n);
        enableRngLog();
        await throwEast(potion, Array(20).fill(' '));

        const clones = game.level.monsters.filter(candidate =>
            candidate !== monster && candidate.mnum === 40);
        assert.equal(clones.length, 1);
        const [clone] = clones;
        const rngLog = getRngLog();
        assert.deepEqual(rngLog.slice(0, 4), [
            'rnd(20)=13', 'rnd(25)=2', 'rn2(7)=4', 'rn2(5)=2',
        ]);
        assert.equal(rngLog.length, 51);
        assert.deepEqual(rngLog.slice(-2), ['rnd(2)=2', 'rn2(9)=1']);
        assert.equal(monster.mhp + clone.mhp, 11);
        assert.equal(monster.mhpmax + clone.mhpmax, 12);
        assert.equal(clone.mcloned, 1);
        assert.deepEqual(clone.minvent, []);
        assert.equal(monster.msleeping, 0);
        assert.equal(potion.where, 'gone');
        assertNoBridgeUse();
    });

test('two-square water vapor can multiply a live gremlin hero', async () => {
    freshMapPotionState(2);
    game.plname = 'Splitter';
    Object.assign(game.u, {
        umonster: 331,
        umonnum: 40,
        mtimedone: 300,
        mh: 17,
        mhmax: 17,
    });
    const potion = addKnownPotion(POT_WATER);

    initRng(2746n);
    enableRngLog();
    await throwEast(potion, Array(30).fill(' '));

    const clones = game.level.monsters.filter(monster => monster.mcloned);
    assert.equal(clones.length, 1);
    assert.equal(clones[0].name, 'Splitter');
    assert.equal(clones[0].pet, true);
    assert.equal(clones[0].mhp, 8);
    assert.equal(clones[0].mhpmax, 8);
    assert.equal(game.u.mh, 9);
    assert.equal(game.u.mhmax, 9);
    assert.equal(game.u.uconduct.pets, 1);
    assert.equal(potion.where, 'gone');
    assert.match(game._pending_message, /You multiply!$/);
    assertNoBridgeUse();
});

test('live blessed water rehumanizes an unequipped beast were', async () => {
    const monster = freshMapPotionState(2);
    Object.assign(monster, {
        mnum: 21,
        mhp: 20,
        mhpmax: 20,
        movement: 18,
        mmove: 18,
    });
    const potion = addKnownPotion(POT_WATER);
    potion.blessed = true;

    initRng(2702n);
    enableRngLog();
    await throwEast(potion, Array(20).fill(' '));

    assert.deepEqual(getRngLog(), [
        'rnd(20)=13', 'rnd(25)=2', 'rn2(7)=4', 'rn2(5)=2',
        'd(2,6)=7', 'rn2(9)=7',
    ]);
    assert.equal(monster.mnum, 263);
    assert.equal(monster.movement, 18);
    assert.equal(monster.mhp, 14);
    assert.equal(potion.where, 'gone');
    assertNoBridgeUse();
});

test('equipped were transformation fails before map throw mutation',
    async () => {
        const monster = freshMapPotionState(2);
        Object.assign(monster, { mnum: 21, mhp: 20, mhpmax: 20 });
        monster.misc_worn_check = 1;
        monster.minvent = [{ otyp: 0, owornmask: 1, worn: true }];
        monster.inventory = monster.minvent;
        const potion = addKnownPotion(POT_WATER);
        potion.blessed = true;

        initRng(2702n);
        enableRngLog();
        await assert.rejects(
            throwEast(potion),
            error => error?.code === 'TELEPORT_BRIDGE_FORBIDDEN'
                && error?.bridgeId === 'throw.potion-impact-unsupported',
        );

        assert.deepEqual(getRngLog(), []);
        assert.deepEqual(game.inventory, [potion]);
        assert.equal(potion.where, 'inventory');
    });

test('controlled lycanthrope vapor fails before a two-square map throw',
    async () => {
        freshMapPotionState(2);
        Object.assign(game.u, {
            umonster: 331, umonnum: 331, ulycn: 21,
        });
        const ring = {
            otyp: RIN_POLYMORPH_CONTROL, worn: true, owornmask: 1,
        };
        game.u.uright = game.uright = ring;
        const potion = addKnownPotion(POT_WATER);
        potion.cursed = true;

        initRng(2702n);
        enableRngLog();
        await assert.rejects(
            throwEast(potion),
            error => error?.code === 'TELEPORT_BRIDGE_FORBIDDEN'
                && error?.bridgeId === 'throw.potion-impact-unsupported',
        );

        assert.deepEqual(getRngLog(), []);
        assert.deepEqual(game.inventory, [potion]);
        assert.equal(game.u.umonnum, 331);
        assert.equal(potion.where, 'inventory');
    });

test('three-square water contact bypasses unreachable hero-vapor prompts',
    async () => {
        const monster = freshMapPotionState(3);
        Object.assign(game.u, {
            umonster: 331, umonnum: 331, ulycn: 21,
        });
        const ring = {
            otyp: RIN_POLYMORPH_CONTROL, worn: true, owornmask: 1,
        };
        game.u.uright = game.uright = ring;
        const potion = addKnownPotion(POT_WATER);
        potion.cursed = true;

        initRng(2702n);
        enableRngLog();
        await throwEast(potion, Array(20).fill(' '));

        assert.ok(monster.mhp >= 11 && monster.mhp <= 12);
        assert.equal(game.u.umonnum, 331);
        assert.equal(game.u.mtimedone ?? 0, 0);
        assert.equal(potion.where, 'gone');
        assertNoBridgeUse();
    });

test('live fatal iron-golem water creates source special chain drops',
    async () => {
        const monster = freshMapPotionState(2);
        Object.assign(monster, {
            mnum: 259,
            mhp: 2,
            mhpmax: 20,
            name: 'Ferrum',
        });
        game.u.ulevel = 30;
        const potion = addKnownPotion(POT_WATER);

        initRng(2702n);
        enableRngLog();
        await throwEast(potion, Array(40).fill(' '));

        const drops = floorObjects();
        const chains = drops.filter(object => object.otyp === IRON_CHAIN);
        const chainRolls = getRngLog().filter(entry =>
            entry.startsWith('d(2,6)='));
        assert.equal(monster.dead, true);
        assert.equal(game.level.monsters.includes(monster), false);
        assert.equal(drops.some(object => object.otyp === CORPSE), false);
        assert.equal(chainRolls.length, 1);
        assert.equal(chains.length, Number(chainRolls[0].split('=')[1]));
        assert.ok(chains.length >= 2 && chains.length <= 12);
        assert.equal(new Set(chains.map(object => object.o_id)).size,
            chains.length);
        for (const chain of chains) {
            assert.equal(chain.where, 'floor');
            assert.deepEqual([chain.ox, chain.oy], [monster.mx, monster.my]);
            assert.notEqual(chain.name, 'Ferrum');
        }
        assert.equal(game.u.uconduct.killer, 1);
        assert.equal(potion.where, 'gone');
        assertNoBridgeUse();
    });

test('live fatal blessed water uses the ordinary map death continuation',
    async () => {
        const monster = freshMapPotionState(2);
        Object.assign(monster, {
            mnum: 289,
            mhp: 2,
            mhpmax: 20,
        });
        const potion = addKnownPotion(POT_WATER);
        potion.blessed = true;

        initRng(2702n);
        enableRngLog();
        await throwEast(potion, Array(40).fill(' '));

        assert.deepEqual(getRngLog(), [
            'rnd(20)=13', 'rnd(25)=2', 'rn2(7)=4', 'rn2(5)=2',
            'd(2,6)=7', 'rn2(6)=1', 'rn2(3)=1', 'rn2(9)=7',
        ]);
        assert.equal(monster.dead, true);
        assert.equal(game.level.monsters.includes(monster), false);
        assert.equal(game.u.uconduct.killer, 1);
        assert.equal(potion.where, 'gone');
        assertNoBridgeUse();
    });

test('greased map potion remains fail-loud before split or throw RNG',
    async () => {
        freshMapPotionState(2);
        const potion = addKnownPotion(POT_INVISIBILITY);
        potion.greased = true;
        potion.quan = potion.quantity = 2;
        potion.owt *= 2;

        initRng(7n);
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

test('live unlit oil breaks without evaporation and wakes its target', async () => {
    const monster = freshMapPotionState(2);
    monster.msleeping = 1;
    const potion = addKnownPotion(POT_OIL);

    initRng(2702n);
    enableRngLog();
    await throwEast(potion, Array(20).fill(' '));

    assert.ok(monster.mhp <= 12 && monster.mhp >= 11);
    assert.equal(monster.msleeping, 0);
    assert.match(game._pending_message, /crashes on .* and breaks into shards/);
    assert.doesNotMatch(game._pending_message, /evaporates/);
    assert.equal(potion.where, 'gone');
    assert.equal(floorObjects().includes(potion), false);
    assertNoBridgeUse();
});

test('lamplit oil map potion fails before split or throw RNG', async () => {
    freshMapPotionState(2);
    const potion = addKnownPotion(POT_OIL);
    potion.lamplit = true;

    initRng(2796n);
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
