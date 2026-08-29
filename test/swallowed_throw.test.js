import test from 'node:test';
import assert from 'node:assert/strict';

import {
    getBridgeUsageLedger, resetBridgeUsageLedger,
} from '../js/bridge_policy.js';
import { rhack } from '../js/cmd.js';
import { LOST_STOLEN, ROOM, W_AMUL } from '../js/const.js';
import { GameMap } from '../js/game.js';
import { game, resetGame } from '../js/gstate.js';
import { pushKey, resetInputState } from '../js/input.js';
import { beginLampBurn } from '../js/light.js';
import { mksobj } from '../js/mklev.js';
import { linkObjectToMonsterInventory } from '../js/monster_inventory.js';
import {
    AMULET_OF_LIFE_SAVING, ARROW, BOW, DAGGER, DART, FIGURINE, MAGIC_LAMP,
    OBJECT_SUBTYPE, OIL_LAMP, PICK_AXE, POT_FRUIT_JUICE,
    POT_BLINDNESS, POT_BOOZE, POT_FULL_HEALING, POT_GAIN_ABILITY,
    POT_GAIN_ENERGY,
    POT_GAIN_LEVEL,
    POT_HEALING, POT_LEVITATION, POT_MONSTER_DETECTION,
    POT_INVISIBILITY, POT_OBJECT_DETECTION, POT_OIL, POT_PARALYSIS,
    POT_RESTORE_ABILITY, POT_SICKNESS, POT_SLEEPING,
    POT_WATER,
    SCR_BLANK_PAPER, TWO_HANDED_SWORD,
} from '../js/object_data.js';
import { init_objects } from '../js/o_init.js';
import { objectTimers } from '../js/object_timers.js';
import { enableRngLog, getRngLog, initRng } from '../js/rng.js';
import { addInventoryItem } from '../js/u_init.js';
import { vision_reset_new_level } from '../js/vision.js';

process.env.TELEPORT_BRIDGE_FREE = '1';
process.env.TELEPORT_DISABLE_FIXTURES = '1';

const PM_ENERGY_VORTEX = 109;
const PM_OCHRE_JELLY = 58;
const PM_PURPLE_WORM = 115;
const PM_TRAPPER = 99;
const PM_JUIBLEX = 303;

function freshSwallowedState(mnum) {
    resetGame();
    const engulfer = {
        m_id: 2300 + mnum,
        mnum,
        mx: 10, my: 10,
        mhp: 40, mhpmax: 40,
        mcanmove: 1,
        msleeping: 0,
        mpeaceful: 0,
        mtame: 0,
        minvent: [],
        inventory: [],
        hasInventory: false,
    };
    game.u = {
        ux: 10, uy: 10,
        uz: { dnum: 0, dlevel: 8 },
        ulevel: 8,
        uhp: 40, uhpmax: 40,
        uhitinc: 0,
        uluck: 0,
        ualign: { type: 0, record: 0 },
        acurr: { a: Array(6).fill(12) },
        amax: { a: Array(6).fill(12) },
        uconduct: {}, uhave: {},
        uswallow: 1,
        ustuck: engulfer,
    };
    game.flags = {};
    game.context = { move: 0 };
    game.moves = 40;
    game.mvitals = [];
    game.inventory = [];
    game.level = new GameMap();
    game.level.monsters = [engulfer];
    for (let x = 8; x <= 12; x++) {
        for (let y = 8; y <= 12; y++) {
            game.level.at(x, y).typ = ROOM;
            game.level.at(x, y).lit = true;
        }
    }
    game.in_mklev = false;
    vision_reset_new_level();
    initRng(999n);
    init_objects();
    resetInputState();
    resetBridgeUsageLedger();
    return engulfer;
}

function assertNoBridgeUse() {
    assert.deepEqual(getBridgeUsageLedger(), {
        bridgeFree: true, totalHits: 0, forbiddenHits: 0, bridges: {},
    });
}

function setBasicWeaponSkill(object) {
    const skill = Math.abs(OBJECT_SUBTYPE[object.otyp] ?? 0);
    game.u.weaponSkills = Array.from({ length: 38 }, () => ({
        skill: 0, maxSkill: 0, advance: 0,
    }));
    game.u.weaponSkills[skill] = {
        skill: 2, maxSkill: 4, advance: 0,
    };
    return skill;
}

async function throwThroughLiveCommand(
    object, direction = 'l', continuationKeys = [],
) {
    pushKey(object.invlet);
    pushKey(direction);
    for (const key of continuationKeys) pushKey(key);
    await rhack('t'.charCodeAt(0));
}

test('swallowed live throw transfers a cursed figurine and replaces its timer',
    async () => {
        const engulfer = freshSwallowedState(PM_ENERGY_VORTEX);
        initRng(2301n);
        const raw = mksobj(FIGURINE, true, false);
        raw.corpsenm = 84;
        raw.cursed = true;
        raw.blessed = false;
        raw.bknown = true;
        raw.typeKnown = true;
        const figurine = addInventoryItem(raw);
        const priorTimer = { ...objectTimers(figurine)[0] };

        initRng(2302n);
        enableRngLog();
        await throwThroughLiveCommand(figurine);

        assert.equal(game.context.move, 1);
        assert.equal(game.inventory.includes(figurine), false);
        assert.strictEqual(engulfer.minvent[0], figurine);
        assert.strictEqual(engulfer.inventory, engulfer.minvent);
        assert.equal(figurine.where, 'minvent');
        assert.equal(figurine.carrierMid, engulfer.m_id);
        assert.equal(figurine.how_lost, LOST_STOLEN);
        const replacement = objectTimers(figurine);
        assert.equal(replacement.length, 1);
        assert.notEqual(replacement[0].id, priorTimer.id);
        assert.match(game._pending_message,
            /^The figurine vanishes into the energy vortex's currents\.$/);
        assert.match(getRngLog()[0], /^rn2\(7\)=\d+$/);
        assert.match(getRngLog()[1], /^rnd\(20\)=\d+$/);
        assert.match(getRngLog()[2], /^rnd\(9000\)=\d+$/);
        assert.equal(getRngLog().length, 3);
        assertNoBridgeUse();
    });

test('swallowed split stack merges only after thrown ownership becomes stolen',
    async () => {
        const engulfer = freshSwallowedState(PM_PURPLE_WORM);
        initRng(2303n);
        const raw = mksobj(SCR_BLANK_PAPER, true, false);
        raw.quan = raw.quantity = 2;
        raw.cursed = raw.blessed = false;
        raw.bknown = raw.dknown = raw.known = true;
        raw.typeKnown = true;
        const carried = addInventoryItem(raw);
        const survivor = {
            ...carried,
            o_id: 2314,
            invlet: null,
            quan: 3,
            quantity: 3,
            where: 'free',
            how_lost: LOST_STOLEN,
            objectTimers: [],
        };
        delete survivor.carrierMid;
        linkObjectToMonsterInventory(engulfer, survivor);

        initRng(2304n);
        enableRngLog();
        await throwThroughLiveCommand(carried, 'h');

        assert.equal(carried.quan, 1);
        assert.equal(carried.quantity, 1);
        assert.deepEqual(game.inventory, [carried]);
        assert.deepEqual(engulfer.minvent, [survivor]);
        assert.equal(survivor.quan, 4);
        assert.equal(survivor.quantity, 4);
        assert.equal(survivor.how_lost, LOST_STOLEN);
        assert.match(game._pending_message,
            /^The scroll of blank paper vanishes into the purple worm's entrails\.$/);
        assert.deepEqual(
            getRngLog().map(entry => entry.replace(/=.*/, '')),
            ['rnd(2)', 'rnd(20)'],
        );
        assert.equal((game.level.objects || []).flat(2).length, 0);
        assertNoBridgeUse();
    });

test('swallowed timed lamp links before snuffing and restores unused fuel',
    async () => {
        const engulfer = freshSwallowedState(PM_TRAPPER);
        initRng(2305n);
        const raw = mksobj(OIL_LAMP, true, false);
        raw.age = 200;
        raw.cursed = raw.blessed = false;
        raw.bknown = raw.dknown = raw.known = true;
        raw.typeKnown = true;
        const lamp = addInventoryItem(raw);
        assert.equal(lamp.invlet, 'a');
        assert.equal(lamp.oclass, 6);
        assert.equal(beginLampBurn(lamp, game, game.moves), true);
        assert.equal(lamp.age, 150);
        assert.equal(objectTimers(lamp)[0].deadline, 90);

        game.moves = 60;
        initRng(2306n);
        enableRngLog();
        await throwThroughLiveCommand(lamp, 'j');

        assert.equal(game.inventory.includes(lamp), false);
        assert.strictEqual(engulfer.minvent[0], lamp);
        assert.equal(lamp.where, 'minvent');
        assert.equal(lamp.carrierMid, engulfer.m_id);
        assert.equal(lamp.how_lost, LOST_STOLEN);
        assert.equal(lamp.lamplit, false);
        assert.equal(lamp.age, 180);
        assert.deepEqual(objectTimers(lamp), []);
        assert.equal(game.vision_full_recalc, 1);
        assert.equal(game._pending_message,
            'The oil lamp vanishes into the trapper.  The oil lamp goes out.');
        assert.deepEqual(
            getRngLog().map(entry => entry.replace(/=.*/, '')),
            ['rnd(20)'],
        );
        assertNoBridgeUse();
    });

test('blind swallowed contact silently snuffs an untimed magic lamp',
    async () => {
        const engulfer = freshSwallowedState(PM_TRAPPER);
        game.u.blindTurns = 5;
        initRng(2307n);
        const raw = mksobj(MAGIC_LAMP, true, false);
        raw.age = 40;
        raw.cursed = raw.blessed = false;
        raw.bknown = raw.dknown = raw.known = true;
        raw.typeKnown = true;
        const lamp = addInventoryItem(raw);
        assert.equal(lamp.invlet, 'a');
        assert.equal(lamp.oclass, 6);
        assert.equal(beginLampBurn(lamp, game, game.moves), true);
        assert.equal(lamp.lamplit, true);
        assert.deepEqual(objectTimers(lamp), []);

        initRng(2308n);
        enableRngLog();
        await throwThroughLiveCommand(lamp, 'k');

        assert.strictEqual(engulfer.minvent[0], lamp);
        assert.equal(lamp.where, 'minvent');
        assert.equal(lamp.lamplit, false);
        assert.equal(lamp.age, 40);
        assert.deepEqual(objectTimers(lamp), []);
        assert.equal(game._pending_message,
            'The magic lamp vanishes into the trapper.');
        assert.deepEqual(
            getRngLog().map(entry => entry.replace(/=.*/, '')),
            ['rnd(20)'],
        );
        assertNoBridgeUse();
    });

test('swallowed ordinary weapon damages, trains, and transfers after contact',
    async () => {
        const engulfer = freshSwallowedState(PM_TRAPPER);
        const raw = mksobj(DAGGER, true, false);
        raw.cursed = raw.blessed = false;
        raw.bknown = raw.dknown = raw.known = true;
        raw.typeKnown = true;
        raw.spe = raw.enchantment = 0;
        raw.oeroded = raw.oeroded2 = 0;
        const dagger = addInventoryItem(raw);
        const skill = setBasicWeaponSkill(dagger);

        initRng(2310n);
        enableRngLog();
        await throwThroughLiveCommand(dagger, 'l');

        assert.equal(engulfer.mhp, 37);
        assert.strictEqual(engulfer.minvent[0], dagger);
        assert.equal(game.inventory.includes(dagger), false);
        assert.equal(dagger.where, 'minvent');
        assert.equal(dagger.carrierMid, engulfer.m_id);
        assert.equal(dagger.how_lost, LOST_STOLEN);
        assert.equal(game.u.weaponSkills[skill].advance, 1);
        assert.equal(game.u._weaponPracticeBySkill[skill], 1);
        assert.equal(game.u._exercise[1], 1);
        assert.equal(game._pending_message,
            'The dagger hits the trapper.');
        assert.deepEqual(getRngLog(), [
            'rnd(20)=3', 'rnd(3)=3', 'rn2(19)=16',
        ]);
        assert.equal((game.level.objects || []).flat(2).length, 0);
        assertNoBridgeUse();
    });

test('swallowed weapon-tool preserves minimal-damage skill cadence',
    async () => {
        const engulfer = freshSwallowedState(PM_TRAPPER);
        const raw = mksobj(PICK_AXE, true, false);
        raw.cursed = raw.blessed = false;
        raw.bknown = raw.dknown = raw.known = true;
        raw.typeKnown = true;
        raw.spe = raw.enchantment = 0;
        raw.oeroded = raw.oeroded2 = 0;
        const pick = addInventoryItem(raw);
        const skill = setBasicWeaponSkill(pick);

        initRng(2311n);
        enableRngLog();
        await throwThroughLiveCommand(pick, 'k');

        assert.equal(engulfer.mhp, 39);
        assert.strictEqual(engulfer.minvent[0], pick);
        assert.equal(pick.where, 'minvent');
        assert.equal(pick.carrierMid, engulfer.m_id);
        assert.equal(pick.how_lost, LOST_STOLEN);
        assert.equal(game.u.weaponSkills[skill].advance, 0);
        assert.equal(game.u._weaponPracticeBySkill, undefined);
        assert.equal(game.u._exercise[1], 0);
        assert.equal(game._pending_message,
            'The pick-axe hits the trapper.');
        assert.deepEqual(getRngLog(), [
            'rnd(20)=12', 'rnd(3)=1', 'rn2(19)=11',
        ]);
        assert.equal((game.level.objects || []).flat(2).length, 0);
        assertNoBridgeUse();
    });

test('swallowed multi-die weapon uses the shared physical damage owner',
    async () => {
        const engulfer = freshSwallowedState(PM_TRAPPER);
        const raw = mksobj(TWO_HANDED_SWORD, true, false);
        raw.cursed = raw.blessed = false;
        raw.bknown = raw.dknown = raw.known = true;
        raw.typeKnown = true;
        raw.spe = raw.enchantment = 0;
        raw.oeroded = raw.oeroded2 = 0;
        const sword = addInventoryItem(raw);
        const skill = setBasicWeaponSkill(sword);

        initRng(2313n);
        enableRngLog();
        await throwThroughLiveCommand(sword, 'j');

        assert.equal(engulfer.mhp, 28);
        assert.strictEqual(engulfer.minvent[0], sword);
        assert.equal(sword.where, 'minvent');
        assert.equal(sword.how_lost, LOST_STOLEN);
        assert.equal(game.u.weaponSkills[skill].advance, 1);
        assert.equal(game.u._exercise[1], 0);
        assert.equal(game._pending_message,
            'The two-handed sword hits the trapper!');
        assert.deepEqual(getRngLog(), [
            'rnd(20)=9', 'rnd(6)=4', 'd(2,6)=8', 'rn2(19)=8',
        ]);
        assert.equal((game.level.objects || []).flat(2).length, 0);
        assertNoBridgeUse();
    });

test('cursed swallowed throwing weapon rerolls direction before damage',
    async () => {
        const engulfer = freshSwallowedState(PM_TRAPPER);
        const raw = mksobj(DAGGER, true, false);
        raw.cursed = true;
        raw.blessed = false;
        raw.bknown = raw.dknown = raw.known = true;
        raw.typeKnown = true;
        raw.spe = raw.enchantment = 0;
        raw.oeroded = raw.oeroded2 = 0;
        const dagger = addInventoryItem(raw);
        const skill = setBasicWeaponSkill(dagger);

        initRng(2333n);
        enableRngLog();
        await throwThroughLiveCommand(dagger, 'l');

        assert.equal(engulfer.mhp, 37);
        assert.strictEqual(engulfer.minvent[0], dagger);
        assert.equal(dagger.how_lost, LOST_STOLEN);
        assert.equal(game.u.weaponSkills[skill].advance, 1);
        assert.equal(game._pending_message,
            'The dagger slips as you throw it!  The dagger hits the trapper.');
        assert.deepEqual(getRngLog(), [
            'rn2(7)=0', 'rn2(3)=0', 'rn2(3)=0',
            'rnd(20)=8', 'rnd(3)=3', 'rn2(19)=8',
        ]);
        assert.equal((game.level.objects || []).flat(2).length, 0);
        assertNoBridgeUse();
    });

test('swallowed dart survives mulch and transfers after live missile damage',
    async () => {
        const engulfer = freshSwallowedState(PM_TRAPPER);
        const raw = mksobj(DART, true, false);
        raw.quan = raw.quantity = 1;
        raw.cursed = raw.blessed = false;
        raw.bknown = raw.dknown = raw.known = true;
        raw.typeKnown = true;
        raw.spe = raw.enchantment = 0;
        raw.oeroded = raw.oeroded2 = 0;
        const dart = addInventoryItem(raw);
        const skill = setBasicWeaponSkill(dart);

        initRng(2413n);
        enableRngLog();
        await throwThroughLiveCommand(dart, 'l');

        assert.equal(engulfer.mhp, 38);
        assert.strictEqual(engulfer.minvent[0], dart);
        assert.equal(dart.where, 'minvent');
        assert.equal(dart.carrierMid, engulfer.m_id);
        assert.equal(dart.how_lost, LOST_STOLEN);
        assert.equal(game.u.weaponSkills[skill].advance, 1);
        assert.equal(game.u._weaponPracticeBySkill[skill], 1);
        assert.equal(game._pending_message, 'The dart hits the trapper.');
        assert.deepEqual(getRngLog(), [
            'rnd(20)=5', 'rnd(2)=2', 'rn2(19)=14', 'rn2(3)=0',
        ]);
        assert.equal((game.level.objects || []).flat(2).length, 0);
        assertNoBridgeUse();
    });

test('swallowed dart mulch removes the detached identity after damage',
    async () => {
        const engulfer = freshSwallowedState(PM_TRAPPER);
        const raw = mksobj(DART, true, false);
        raw.quan = raw.quantity = 1;
        raw.cursed = raw.blessed = false;
        raw.bknown = raw.dknown = raw.known = true;
        raw.typeKnown = true;
        raw.spe = raw.enchantment = 0;
        raw.oeroded = raw.oeroded2 = 0;
        const dart = addInventoryItem(raw);
        const skill = setBasicWeaponSkill(dart);

        initRng(2502n);
        enableRngLog();
        await throwThroughLiveCommand(dart, 'h');

        assert.equal(engulfer.mhp, 38);
        assert.deepEqual(game.inventory, []);
        assert.deepEqual(engulfer.minvent, []);
        assert.equal(dart.where, 'gone');
        assert.equal(game.u.weaponSkills[skill].advance, 1);
        assert.equal(game._pending_message, 'The dart hits the trapper.');
        assert.deepEqual(getRngLog(), [
            'rnd(20)=20', 'rnd(2)=2', 'rn2(19)=14', 'rn2(3)=2',
        ]);
        assert.equal((game.level.objects || []).flat(2).length, 0);
        assertNoBridgeUse();
    });

test('swallowed projectile passive follows mulch survival before acquisition',
    async () => {
        const engulfer = freshSwallowedState(PM_OCHRE_JELLY);
        const raw = mksobj(DART, true, false);
        raw.quan = raw.quantity = 1;
        raw.cursed = raw.blessed = false;
        raw.bknown = raw.dknown = raw.known = true;
        raw.typeKnown = true;
        raw.spe = raw.enchantment = 0;
        raw.oeroded = raw.oeroded2 = 0;
        const dart = addInventoryItem(raw);
        const skill = setBasicWeaponSkill(dart);

        initRng(2645n);
        enableRngLog();
        await throwThroughLiveCommand(dart, 'l');

        assert.equal(engulfer.mhp, 37);
        assert.strictEqual(engulfer.minvent[0], dart);
        assert.equal(dart.where, 'minvent');
        assert.equal(dart.oeroded2, 1);
        assert.equal(game.u.weaponSkills[skill].advance, 1);
        assert.equal(game._pending_message,
            'The dart hits the ochre jelly.  The dart corrodes!');
        assert.deepEqual(getRngLog(), [
            'rnd(20)=19', 'rnd(3)=3', 'rn2(19)=7',
            'rn2(3)=0', 'rn2(6)=0',
        ]);
        assertNoBridgeUse();
    });

test('swallowed multigen missile fails before split or volley RNG',
    async () => {
        const engulfer = freshSwallowedState(PM_TRAPPER);
        const raw = mksobj(DART, true, false);
        raw.quan = raw.quantity = 2;
        raw.cursed = raw.blessed = false;
        raw.bknown = raw.dknown = raw.known = true;
        raw.typeKnown = true;
        const darts = addInventoryItem(raw);
        setBasicWeaponSkill(darts);

        initRng(2650n);
        enableRngLog();
        await assert.rejects(
            throwThroughLiveCommand(darts, 'h'),
            error => error?.code === 'TELEPORT_BRIDGE_FORBIDDEN'
                && error?.bridgeId
                    === 'throw.swallowed-weapon-unsupported',
        );

        assert.equal(engulfer.mhp, 40);
        assert.deepEqual(game.inventory, [darts]);
        assert.equal(darts.quan, 2);
        assert.equal(darts.quantity, 2);
        assert.deepEqual(engulfer.minvent, []);
        assert.deepEqual(getRngLog(), []);
        assert.equal((game.level.objects || []).flat(2).length, 0);
    });

test('swallowed launched arrow uses launcher skill and excludes Strength',
    async () => {
        const engulfer = freshSwallowedState(PM_TRAPPER);
        const rawBow = mksobj(BOW, true, false);
        rawBow.cursed = rawBow.blessed = false;
        rawBow.bknown = rawBow.dknown = rawBow.known = true;
        rawBow.typeKnown = true;
        rawBow.spe = rawBow.enchantment = 0;
        rawBow.oeroded = rawBow.oeroded2 = 0;
        const bow = addInventoryItem(rawBow);
        const skill = setBasicWeaponSkill(bow);
        game.uwep = game.u.uwep = bow;

        const rawArrow = mksobj(ARROW, true, false);
        rawArrow.quan = rawArrow.quantity = 1;
        rawArrow.cursed = rawArrow.blessed = false;
        rawArrow.bknown = rawArrow.dknown = rawArrow.known = true;
        rawArrow.typeKnown = true;
        rawArrow.spe = rawArrow.enchantment = 0;
        rawArrow.oeroded = rawArrow.oeroded2 = 0;
        const arrow = addInventoryItem(rawArrow);
        game.u.acurr.a[0] = 18;

        initRng(2413n);
        enableRngLog();
        await throwThroughLiveCommand(arrow, 'k');

        assert.equal(engulfer.mhp, 36);
        assert.deepEqual(game.inventory, [bow]);
        assert.strictEqual(engulfer.minvent[0], arrow);
        assert.equal(arrow.where, 'minvent');
        assert.equal(arrow.how_lost, LOST_STOLEN);
        assert.equal(game.u.weaponSkills[skill].advance, 1);
        assert.equal(game.u._weaponPracticeBySkill[skill], 1);
        assert.equal(game._pending_message, 'The arrow hits the trapper.');
        assert.deepEqual(getRngLog(), [
            'rnd(20)=5', 'rnd(6)=4', 'rn2(19)=14', 'rn2(3)=0',
        ]);
        assertNoBridgeUse();
    });

test('swallowed hand-thrown arrow uses ranged damage and Strength without skill',
    async () => {
        const engulfer = freshSwallowedState(PM_TRAPPER);
        const raw = mksobj(ARROW, true, false);
        raw.quan = raw.quantity = 1;
        raw.cursed = raw.blessed = false;
        raw.bknown = raw.dknown = raw.known = true;
        raw.typeKnown = true;
        raw.spe = raw.enchantment = 0;
        raw.oeroded = raw.oeroded2 = 0;
        const arrow = addInventoryItem(raw);
        const skill = setBasicWeaponSkill(arrow);
        game.u.acurr.a[0] = 18;

        initRng(2413n);
        enableRngLog();
        await throwThroughLiveCommand(arrow, 'j');

        assert.equal(engulfer.mhp, 36);
        assert.strictEqual(engulfer.minvent[0], arrow);
        assert.equal(arrow.where, 'minvent');
        assert.equal(arrow.how_lost, LOST_STOLEN);
        assert.equal(game.u.weaponSkills[skill].advance, 0);
        assert.equal(game.u._weaponPracticeBySkill, undefined);
        assert.equal(game._pending_message, 'The arrow hits the trapper.');
        assert.deepEqual(getRngLog(), [
            'rnd(20)=5', 'rnd(2)=2', 'rn2(19)=14', 'rn2(3)=0',
        ]);
        assertNoBridgeUse();
    });

test('swallowed sickness harms the engulfer and hero in source order',
    async () => {
        const engulfer = freshSwallowedState(PM_TRAPPER);
        const raw = mksobj(POT_SICKNESS, true, false);
        raw.cursed = raw.blessed = false;
        raw.bknown = raw.dknown = raw.known = true;
        raw.typeKnown = true;
        const potion = addInventoryItem(raw);

        initRng(2510n);
        enableRngLog();
        await throwThroughLiveCommand(potion, 'l');

        assert.equal(engulfer.mhp, 19);
        assert.equal(game.u.uhp, 35);
        assert.equal(game.u._exercise[2], -1);
        assert.deepEqual(game.inventory, []);
        assert.deepEqual(engulfer.minvent, []);
        assert.deepEqual(getRngLog(), [
            'rnd(20)=12', 'rn2(7)=0', 'rn2(5)=2', 'rn2(2)=1',
        ]);
        assert.equal(potion.where, 'gone');
        assert.equal((game.level.objects || []).flat(2).length, 0);
        assertNoBridgeUse();
    });

test('swallowed booze confuses the engulfer and hero in source order',
    async () => {
        const engulfer = freshSwallowedState(PM_TRAPPER);
        engulfer.m_lev = 12;
        engulfer.mconf = 0;
        game.u.confusionTurns = 0;
        const raw = mksobj(POT_BOOZE, true, false);
        raw.cursed = raw.blessed = false;
        raw.bknown = raw.dknown = raw.known = true;
        raw.typeKnown = true;
        const potion = addInventoryItem(raw);

        initRng(2955n);
        enableRngLog();
        await throwThroughLiveCommand(potion, 'l');

        assert.equal(engulfer.mhp, 39);
        assert.equal(engulfer.mconf, 1);
        assert.equal(game.u.confusionTurns, 3);
        assert.deepEqual(game.inventory, []);
        assert.deepEqual(engulfer.minvent, []);
        assert.deepEqual(getRngLog(), [
            'rnd(20)=4', 'rn2(7)=1', 'rn2(5)=1', 'rn2(94)=57',
            'rnd(5)=3',
        ]);
        assert.equal(potion.where, 'gone');
        assert.equal((game.level.objects || []).flat(2).length, 0);
        assert.equal(game._pending_message, 'Crash!  You feel somewhat dizzy.');
        assertNoBridgeUse();
    });

test('swallowed sleeping potion freezes engulfer and installs hero sleep turns',
    async () => {
        const engulfer = freshSwallowedState(PM_TRAPPER);
        engulfer.m_lev = 12;
        engulfer.mfrozen = 0;
        engulfer.meating = 3;
        const raw = mksobj(POT_SLEEPING, true, false);
        raw.cursed = raw.blessed = false;
        raw.bknown = raw.dknown = raw.known = true;
        raw.typeKnown = true;
        const potion = addInventoryItem(raw);

        initRng(2511n);
        enableRngLog();
        await throwThroughLiveCommand(
            potion, 'l', [' ', ' ', ' ', ' '],
        );

        assert.deepEqual(getRngLog(), [
            'rnd(20)=8', 'rn2(7)=5', 'rn2(5)=2', 'rnd(12)=8',
            'rn2(94)=29', 'rnd(5)=1', 'rn2(2)=0',
        ]);
        assert.equal(engulfer.mhp, 39);
        assert.equal(engulfer.mcanmove, 0);
        assert.equal(engulfer.mfrozen, 8);
        assert.equal(engulfer.meating, 0);
        assert.equal(game._helplessTurns, 1);
        assert.equal(game._helplessReason, 'sleeping off a magical draught');
        assert.equal(game._helplessDoneMessage, 'You can move again.');
        assert.deepEqual(game.inventory, []);
        assert.equal(potion.where, 'gone');
        assertNoBridgeUse();
    });

test('swallowed blindness times engulfer sight before blinding the hero',
    async () => {
        const engulfer = freshSwallowedState(PM_PURPLE_WORM);
        engulfer.m_lev = 12;
        engulfer.mcansee = 1;
        engulfer.mblinded = 0;
        game.u.blindTurns = 0;
        game.blind = false;
        const raw = mksobj(POT_BLINDNESS, true, false);
        raw.cursed = raw.blessed = false;
        raw.bknown = raw.dknown = raw.known = true;
        raw.typeKnown = true;
        const potion = addInventoryItem(raw);

        initRng(3300n);
        enableRngLog();
        await throwThroughLiveCommand(
            potion, 'l', [' ', ' ', ' ', ' '],
        );

        assert.deepEqual(getRngLog(), [
            'rnd(20)=19', 'rn2(7)=3', 'rn2(5)=1',
            'rn2(32)=30', 'rn2(32)=26', 'rn2(94)=37', 'rnd(5)=4',
        ]);
        assert.equal(engulfer.mhp, 39);
        assert.equal(engulfer.mcansee, 0);
        assert.equal(engulfer.mblinded, 120);
        assert.equal(game.u.blindTurns, 4);
        assert.equal(game.blind, true);
        assert.equal(game.vision_full_recalc, 0);
        assert.deepEqual(game.inventory, []);
        assert.equal(potion.where, 'gone');
        assertNoBridgeUse();
    });

test('swallowed cursed invisibility reveals and angers an invisible engulfer',
    async () => {
        const engulfer = freshSwallowedState(PM_TRAPPER);
        engulfer.minvis = 1;
        engulfer.perminvis = 1;
        engulfer.invis_blkd = 0;
        const raw = mksobj(POT_INVISIBILITY, true, false);
        raw.cursed = true;
        raw.blessed = false;
        raw.bknown = raw.dknown = raw.known = true;
        raw.typeKnown = true;
        const potion = addInventoryItem(raw);

        initRng(2511n);
        enableRngLog();
        await throwThroughLiveCommand(
            potion, 'l', [' ', ' ', ' ', ' '],
        );

        assert.deepEqual(getRngLog(), [
            'rn2(7)=4', 'rnd(20)=20', 'rn2(7)=2', 'rn2(5)=2',
        ]);
        assert.equal(engulfer.mhp, 39);
        assert.equal(engulfer.perminvis, 0);
        assert.equal(engulfer.minvis, 0);
        assert.deepEqual(game.inventory, []);
        assert.deepEqual(engulfer.minvent, []);
        assert.equal(potion.where, 'gone');
        assert.equal((game.level.objects || []).flat(2).length, 0);
        assertNoBridgeUse();
    });

test('swallowed blessed water damages a demonic engulfer through the live owner',
    async () => {
        const engulfer = freshSwallowedState(PM_JUIBLEX);
        const raw = mksobj(POT_WATER, true, false);
        raw.cursed = false;
        raw.blessed = true;
        raw.bknown = raw.dknown = raw.known = true;
        raw.typeKnown = true;
        const potion = addInventoryItem(raw);

        initRng(2511n);
        enableRngLog();
        await throwThroughLiveCommand(
            potion, 'l', Array(20).fill(' '),
        );

        assert.deepEqual(getRngLog(), [
            'rnd(20)=8', 'rn2(7)=5', 'rn2(5)=2', 'd(2,6)=8',
        ]);
        assert.equal(engulfer.mhp, 31);
        assert.equal(potion.where, 'gone');
        assertNoBridgeUse();
    });

test('swallowed cursed water heals a demonic engulfer without angering it',
    async () => {
        const engulfer = freshSwallowedState(PM_JUIBLEX);
        engulfer.mhp = 20;
        engulfer.msleeping = 1;
        const raw = mksobj(POT_WATER, true, false);
        raw.cursed = true;
        raw.blessed = false;
        raw.bknown = raw.dknown = raw.known = true;
        raw.typeKnown = true;
        const potion = addInventoryItem(raw);

        initRng(2511n);
        enableRngLog();
        await throwThroughLiveCommand(
            potion, 'l', Array(20).fill(' '),
        );

        assert.deepEqual(getRngLog(), [
            'rn2(7)=4', 'rnd(20)=20', 'rn2(7)=2', 'rn2(5)=2',
            'd(2,6)=12',
        ]);
        assert.equal(engulfer.mhp, 31);
        assert.equal(engulfer.msleeping, 0);
        assert.equal(potion.where, 'gone');
        assertNoBridgeUse();
    });

test('fatal unique water target fails before swallowed potion mutation or RNG',
    async () => {
        const engulfer = freshSwallowedState(PM_JUIBLEX);
        engulfer.mhp = 13;
        const raw = mksobj(POT_WATER, true, false);
        raw.cursed = false;
        raw.blessed = true;
        raw.bknown = raw.dknown = raw.known = true;
        raw.typeKnown = true;
        const potion = addInventoryItem(raw);

        initRng(2511n);
        enableRngLog();
        await assert.rejects(
            throwThroughLiveCommand(potion, 'l'),
            error => error?.code === 'TELEPORT_BRIDGE_FORBIDDEN'
                && error?.bridgeId === 'throw.potion-impact-unsupported',
        );

        assert.deepEqual(getRngLog(), []);
        assert.deepEqual(game.inventory, [potion]);
        assert.equal(potion.where, 'inventory');
        assert.equal(engulfer.mhp, 13);
    });

test('unsupported oil potion fails before floor fallback or RNG', async () => {
    const engulfer = freshSwallowedState(PM_TRAPPER);
    const raw = mksobj(POT_OIL, true, false);
    raw.cursed = raw.blessed = false;
    raw.bknown = raw.dknown = raw.known = true;
    raw.typeKnown = true;
    const potion = addInventoryItem(raw);

    initRng(2511n);
    enableRngLog();
    await assert.rejects(
        throwThroughLiveCommand(potion, 'l'),
        error => error?.code === 'TELEPORT_BRIDGE_FORBIDDEN'
            && error?.bridgeId === 'throw.potion-impact-unsupported',
    );

    assert.equal(engulfer.mhp, 40);
    assert.deepEqual(game.inventory, [potion]);
    assert.deepEqual(engulfer.minvent, []);
    assert.deepEqual(getRngLog(), []);
    assert.equal((game.level.objects || []).flat(2).length, 0);
    });

test('swallowed healing family heals both monster and hero through vapor',
    async () => {
        const cases = [
            {
                type: POT_HEALING,
                blessed: true,
                cursed: false,
                seed: 2813n,
                heroGain: 1,
                expectedRng: [
                    'rnd(20)=8', 'rn2(7)=1', 'rn2(5)=2', 'rn2(19)=16',
                ],
            },
            {
                type: POT_FULL_HEALING,
                blessed: false,
                cursed: true,
                seed: 2810n,
                heroGain: 3,
                expectedRng: [
                    'rn2(7)=5', 'rnd(20)=17', 'rn2(7)=2', 'rn2(5)=2',
                    'rn2(19)=6',
                ],
            },
        ];

        for (const specimen of cases) {
            const engulfer = freshSwallowedState(PM_TRAPPER);
            engulfer.mhp = 9;
            engulfer.mcansee = 0;
            engulfer.mblinded = 20;
            engulfer.msleeping = 1;
            game.u.uhp = 30;
            game.u.uhpmax = 40;
            game.u.blindTurns = 5;
            game.u.deafTurns = 7;
            const raw = mksobj(specimen.type, true, false);
            raw.cursed = specimen.cursed;
            raw.blessed = specimen.blessed;
            raw.bknown = raw.dknown = raw.known = true;
            raw.typeKnown = true;
            const potion = addInventoryItem(raw);

            initRng(specimen.seed);
            enableRngLog();
            await throwThroughLiveCommand(potion, 'l', [' ', ' ', ' ', ' ']);

            assert.deepEqual(getRngLog(), specimen.expectedRng);
            assert.equal(engulfer.mhp, engulfer.mhpmax);
            assert.equal(engulfer.mcansee, 1);
            assert.equal(engulfer.mblinded, 0);
            assert.equal(engulfer.msleeping, 0);
            assert.equal(game.u.uhp, 30 + specimen.heroGain);
            assert.equal(game.u.blindTurns, 0);
            assert.equal(game.u.deafTurns, 0);
            assert.equal(potion.where, 'gone');
            assertNoBridgeUse();
        }
    });

test('swallowed blessed gain ability restores every reduced base attribute',
    async () => {
        const engulfer = freshSwallowedState(PM_TRAPPER);
        engulfer.mhp = 11;
        game.u.acurr.a = [10, 12, 9, 12, 8, 12];
        game.u.amax.a = [12, 12, 12, 12, 12, 12];
        const raw = mksobj(POT_GAIN_ABILITY, true, false);
        raw.cursed = false;
        raw.blessed = true;
        raw.bknown = raw.dknown = raw.known = true;
        raw.typeKnown = true;
        const potion = addInventoryItem(raw);

        initRng(2824n);
        enableRngLog();
        await throwThroughLiveCommand(potion, 'l', [' ', ' ', ' ', ' ']);

        assert.deepEqual(getRngLog(), [
            'rnd(20)=9', 'rn2(7)=5', 'rn2(5)=4', 'rn2(6)=0',
        ]);
        assert.equal(engulfer.mhp, engulfer.mhpmax);
        assert.deepEqual(game.u.acurr.a, [11, 12, 10, 12, 9, 12]);
        assert.equal(potion.where, 'gone');
        assertNoBridgeUse();
    });

test('cursed restore ability vapor smells but cannot restore attributes',
    async () => {
        const engulfer = freshSwallowedState(PM_TRAPPER);
        engulfer.mhp = 12;
        game.u.acurr.a = [10, 12, 9, 12, 8, 12];
        game.u.amax.a = [12, 12, 12, 12, 12, 12];
        const raw = mksobj(POT_RESTORE_ABILITY, true, false);
        raw.cursed = true;
        raw.blessed = false;
        raw.bknown = raw.dknown = raw.known = true;
        raw.typeKnown = true;
        const potion = addInventoryItem(raw);

        initRng(2820n);
        enableRngLog();
        await throwThroughLiveCommand(potion, 'l', [' ', ' ', ' ', ' ']);

        assert.deepEqual(getRngLog(), [
            'rn2(7)=5', 'rnd(20)=6', 'rn2(7)=1', 'rn2(5)=3',
        ]);
        assert.equal(engulfer.mhp, engulfer.mhpmax);
        assert.deepEqual(game.u.acurr.a, [10, 12, 9, 12, 8, 12]);
        assert.equal(game._pending_message,
            'Crash!  Ulch!  That potion smells terrible!');
        assert.equal(potion.where, 'gone');
        assertNoBridgeUse();
    });

test('all monster-inert potions crash unseen, chip, and disappear live',
    async () => {
        const inertTypes = [
            POT_GAIN_LEVEL, POT_GAIN_ENERGY, POT_LEVITATION,
            POT_FRUIT_JUICE, POT_MONSTER_DETECTION, POT_OBJECT_DETECTION,
        ];
        const expectedRng = [
            ['rnd(20)=8', 'rn2(7)=5', 'rn2(5)=2'],
            ['rnd(20)=8', 'rn2(7)=5', 'rn2(5)=0'],
            ['rnd(20)=13', 'rn2(7)=5', 'rn2(5)=2'],
            ['rnd(20)=3', 'rn2(7)=3', 'rn2(5)=1'],
            ['rnd(20)=8', 'rn2(7)=5', 'rn2(5)=0'],
            ['rnd(20)=3', 'rn2(7)=0', 'rn2(5)=3'],
        ];
        const expectedHp = [39, 40, 39, 39, 40, 39];

        for (let index = 0; index < inertTypes.length; index++) {
            const engulfer = freshSwallowedState(PM_TRAPPER);
            if (index === 0) engulfer.msleeping = 1;
            const raw = mksobj(inertTypes[index], true, false);
            raw.quan = raw.quantity = 1;
            raw.cursed = raw.blessed = false;
            raw.bknown = raw.dknown = raw.known = true;
            raw.typeKnown = true;
            const potion = addInventoryItem(raw);

            initRng(2511n + BigInt(index));
            enableRngLog();
            await throwThroughLiveCommand(potion, 'l', [' ', ' ', ' ']);

            assert.deepEqual(getRngLog(), expectedRng[index]);
            assert.equal(engulfer.mhp, expectedHp[index]);
            assert.equal(engulfer.msleeping, 0);
            assert.deepEqual(game.inventory, []);
            assert.deepEqual(engulfer.minvent, []);
            assert.equal(potion.where, 'gone');
            assert.equal(potion.ox, 0);
            assert.equal(potion.oy, 0);
            assert.equal(game._pending_message, 'Crash!');
            assert.equal((game.level.objects || []).flat(2).length, 0);
            assertNoBridgeUse();
        }
    });

test('unseen swallowed bottle selection remains hallucination-sensitive',
    async () => {
        const engulfer = freshSwallowedState(PM_ENERGY_VORTEX);
        game.u.hallucinationTurns = 8;
        const raw = mksobj(POT_GAIN_LEVEL, true, false);
        raw.quan = raw.quantity = 1;
        raw.cursed = raw.blessed = false;
        raw.bknown = raw.dknown = raw.known = true;
        raw.typeKnown = true;
        const potion = addInventoryItem(raw);

        initRng(2520n);
        enableRngLog();
        await throwThroughLiveCommand(potion, 'h', [' ', ' ', ' ']);

        assert.deepEqual(getRngLog(), [
            'rnd(20)=13', 'rn2(24)=8', 'rn2(5)=1',
        ]);
        assert.equal(engulfer.mhp, 39);
        assert.deepEqual(game.inventory, []);
        assert.deepEqual(engulfer.minvent, []);
        assert.equal(potion.where, 'gone');
        assert.equal(game._pending_message, 'Crash!');
        assertNoBridgeUse();
    });

test('swallowed inert potion stack splits one consumed identity', async () => {
    const engulfer = freshSwallowedState(PM_TRAPPER);
    const raw = mksobj(POT_FRUIT_JUICE, true, false);
    raw.quan = raw.quantity = 2;
    raw.cursed = raw.blessed = false;
    raw.bknown = raw.dknown = raw.known = true;
    raw.typeKnown = true;
    const potion = addInventoryItem(raw);

    initRng(2521n);
    enableRngLog();
    await throwThroughLiveCommand(potion, 'j', [' ', ' ', ' ']);

    assert.deepEqual(getRngLog(), [
        'rnd(2)=1', 'rnd(20)=19', 'rn2(7)=4', 'rn2(5)=0',
    ]);
    assert.equal(engulfer.mhp, 40);
    assert.deepEqual(game.inventory, [potion]);
    assert.equal(potion.quan, 1);
    assert.equal(potion.quantity, 1);
    assert.equal(potion.where, 'inventory');
    assert.deepEqual(engulfer.minvent, []);
    assert.equal((game.level.objects || []).flat(2).length, 0);
    assertNoBridgeUse();
});

test('dknown unknown inert potion remains fail-loud before call prompt debt',
    async () => {
        const engulfer = freshSwallowedState(PM_TRAPPER);
        const raw = mksobj(POT_FRUIT_JUICE, true, false);
        raw.quan = raw.quantity = 1;
        raw.cursed = raw.blessed = false;
        raw.bknown = raw.dknown = true;
        raw.known = raw.typeKnown = false;
        const potion = addInventoryItem(raw);

        initRng(2522n);
        enableRngLog();
        await assert.rejects(
            throwThroughLiveCommand(potion, 'l'),
            error => error?.code === 'TELEPORT_BRIDGE_FORBIDDEN'
                && error?.bridgeId
                    === 'throw.potion-impact-unsupported',
        );

        assert.equal(engulfer.mhp, 40);
        assert.deepEqual(game.inventory, [potion]);
        assert.deepEqual(engulfer.minvent, []);
        assert.deepEqual(getRngLog(), []);
        assert.equal((game.level.objects || []).flat(2).length, 0);
    });

test('unseen unknown inert potion needs no naming continuation', async () => {
    const engulfer = freshSwallowedState(PM_TRAPPER);
    const raw = mksobj(POT_FRUIT_JUICE, true, false);
    raw.quan = raw.quantity = 1;
    raw.cursed = raw.blessed = false;
    raw.bknown = raw.dknown = raw.known = raw.typeKnown = false;
    const potion = addInventoryItem(raw);
    potion.bknown = potion.dknown = potion.known = potion.typeKnown = false;

    initRng(2523n);
    enableRngLog();
    await throwThroughLiveCommand(potion, 'l');

    assert.deepEqual(getRngLog(), [
        'rnd(20)=11', 'rn2(7)=5', 'rn2(5)=1',
    ]);
    assert.equal(engulfer.mhp, 39);
    assert.deepEqual(game.inventory, []);
    assert.deepEqual(engulfer.minvent, []);
    assert.equal(potion.where, 'gone');
    assert.equal(game._pending_message, 'Crash!');
    assertNoBridgeUse();
});

test('greased inert potion slips before its swallowed impact transaction',
    async () => {
        const engulfer = freshSwallowedState(PM_TRAPPER);
        const raw = mksobj(POT_GAIN_ENERGY, true, false);
        raw.quan = raw.quantity = 1;
        raw.cursed = raw.blessed = false;
        raw.greased = true;
        raw.bknown = raw.dknown = raw.known = true;
        raw.typeKnown = true;
        const potion = addInventoryItem(raw);

        initRng(2524n);
        enableRngLog();
        await throwThroughLiveCommand(potion, 'h', [' ', ' ', ' ']);

        assert.deepEqual(getRngLog(), [
            'rn2(7)=0', 'rn2(3)=1', 'rn2(3)=1', 'rnd(20)=4',
            'rn2(7)=6', 'rn2(5)=4',
        ]);
        assert.equal(engulfer.mhp, 39);
        assert.deepEqual(game.inventory, []);
        assert.equal(potion.where, 'gone');
        assert.equal(game._pending_message,
            'The potion of gain energy slips as you throw it!  Crash!');
        assertNoBridgeUse();
    });

test('a killing swallowed dart is acquired, dropped, and autopicked before cleanup',
    async () => {
        const engulfer = freshSwallowedState(PM_TRAPPER);
        engulfer.mhp = 1;
        game.flags.pickup = true;
        const raw = mksobj(DART, true, false);
        raw.quan = raw.quantity = 1;
        raw.cursed = raw.blessed = false;
        raw.bknown = raw.dknown = raw.known = true;
        raw.typeKnown = true;
        raw.spe = raw.enchantment = 0;
        raw.oeroded = raw.oeroded2 = 0;
        const dart = addInventoryItem(raw);
        const skill = setBasicWeaponSkill(dart);

        initRng(2312n);
        enableRngLog();
        await throwThroughLiveCommand(dart, 'h');

        assert.equal(engulfer.mhp, 0);
        assert.equal(engulfer.dead, true);
        assert.equal(game.level.monsters.includes(engulfer), false);
        assert.equal(game.u.uswallow, 0);
        assert.equal(game.u.ustuck, null);
        assert.equal(game.u.uswldtim, 0);
        assert.deepEqual([game.u.ux, game.u.uy], [10, 10]);
        assert.ok([1, 2].includes(engulfer.mspec_used));
        assert.deepEqual(game.inventory, [dart]);
        assert.equal(dart.where, 'inventory');
        assert.equal(dart.how_lost, 0);
        assert.equal('carrierMid' in dart, false);
        assert.equal((game.level.objects || []).flat(2).includes(dart), false);
        assert.equal(game.u.weaponSkills[skill].advance, 1);
        assert.equal(game.u._exercise[1], 1);
        assert.equal(game.u.uconduct.killer, 1);
        assert.equal(game._vanquishedCounts.get(PM_TRAPPER).count, 1);
        assert.ok((game.u.uexp ?? 0) > 0);
        assert.equal((game.level.objects || []).flat(2)
            .some(object => /corpse/.test(object.name || '')), false);
        assert.match(game._pending_message, /a - (?:an? )?dart\./);
        assert.deepEqual(
            getRngLog().map(entry => entry.replace(/=.*/, '')),
            ['rnd(20)', 'rnd(2)', 'rnd(2)', 'rn2(6)', 'rn2(19)'],
        );
        assertNoBridgeUse();
    });

test('a killing swallowed weapon remains on the death square without autopickup',
    async () => {
        const engulfer = freshSwallowedState(PM_TRAPPER);
        engulfer.mhp = 1;
        game.flags.pickup = false;
        const raw = mksobj(DAGGER, true, false);
        raw.cursed = raw.blessed = false;
        raw.bknown = raw.dknown = raw.known = true;
        raw.typeKnown = true;
        raw.spe = raw.enchantment = 0;
        raw.oeroded = raw.oeroded2 = 0;
        const dagger = addInventoryItem(raw);
        setBasicWeaponSkill(dagger);

        initRng(2312n);
        enableRngLog();
        await throwThroughLiveCommand(dagger, 'h', [' ']);

        const pile = game.level.objects[10][10];
        assert.deepEqual(game.inventory, []);
        assert.deepEqual(pile, [dagger]);
        assert.equal(dagger.where, 'floor');
        assert.equal(dagger.how_lost, LOST_STOLEN);
        assert.equal('carrierMid' in dagger, false);
        assert.match(game._pending_message, /You see here a \+0 dagger\./);
        assert.deepEqual(
            getRngLog().map(entry => entry.replace(/=.*/, '')),
            ['rnd(20)', 'rnd(3)', 'rnd(2)', 'rn2(6)', 'rn2(19)'],
        );
        assertNoBridgeUse();
    });

test('a killing projectile releases prior minvent ahead of itself into autopickup',
    async () => {
        const engulfer = freshSwallowedState(PM_TRAPPER);
        engulfer.mhp = 1;
        game.flags.pickup = true;

        const prior = mksobj(SCR_BLANK_PAPER, true, false);
        prior.quan = prior.quantity = 1;
        prior.cursed = prior.blessed = false;
        prior.bknown = prior.dknown = prior.known = true;
        prior.typeKnown = true;
        linkObjectToMonsterInventory(engulfer, prior);

        const raw = mksobj(DART, true, false);
        raw.quan = raw.quantity = 1;
        raw.cursed = raw.blessed = false;
        raw.bknown = raw.dknown = raw.known = true;
        raw.typeKnown = true;
        raw.spe = raw.enchantment = 0;
        raw.oeroded = raw.oeroded2 = 0;
        const dart = addInventoryItem(raw);
        setBasicWeaponSkill(dart);

        initRng(2312n);
        enableRngLog();
        await throwThroughLiveCommand(dart, 'h', [' ']);

        assert.deepEqual(game.inventory, [prior, dart]);
        assert.equal(prior.where, 'inventory');
        assert.equal(dart.where, 'inventory');
        assert.equal(prior.how_lost, 0);
        assert.equal(dart.how_lost, 0);
        assert.equal('carrierMid' in prior, false);
        assert.equal('carrierMid' in dart, false);
        assert.deepEqual(engulfer.minvent, []);
        assert.equal((game.level.objects || []).flat(2).length, 0);
        assert.deepEqual(
            getRngLog().map(entry => entry.replace(/=.*/, '')),
            ['rnd(20)', 'rnd(2)', 'rnd(2)', 'rn2(6)', 'rn2(19)'],
        );
        assertNoBridgeUse();
    });

test('a killing projectile merges in minvent before the survivor is released',
    async () => {
        const engulfer = freshSwallowedState(PM_TRAPPER);
        engulfer.mhp = 1;
        game.flags.pickup = true;

        const survivor = mksobj(DART, true, false);
        survivor.quan = survivor.quantity = 2;
        survivor.cursed = survivor.blessed = false;
        survivor.bknown = survivor.dknown = survivor.known = true;
        survivor.typeKnown = true;
        survivor.spe = survivor.enchantment = 0;
        survivor.oeroded = survivor.oeroded2 = 0;
        survivor.how_lost = LOST_STOLEN;
        linkObjectToMonsterInventory(engulfer, survivor);

        const raw = mksobj(DART, true, false);
        raw.quan = raw.quantity = 1;
        raw.cursed = raw.blessed = false;
        raw.bknown = raw.dknown = raw.known = true;
        raw.typeKnown = true;
        raw.spe = raw.enchantment = 0;
        raw.oeroded = raw.oeroded2 = 0;
        const dart = addInventoryItem(raw);
        setBasicWeaponSkill(dart);

        initRng(2312n);
        enableRngLog();
        await throwThroughLiveCommand(dart, 'h');

        assert.deepEqual(game.inventory, [survivor]);
        assert.equal(survivor.quan, 3);
        assert.equal(survivor.quantity, 3);
        assert.equal(survivor.where, 'inventory');
        assert.equal(survivor.how_lost, 0);
        assert.equal(dart.where, 'gone');
        assert.equal('carrierMid' in survivor, false);
        assert.equal('carrierMid' in dart, false);
        assert.deepEqual(engulfer.minvent, []);
        assert.equal((game.level.objects || []).flat(2).length, 0);
        assert.deepEqual(
            getRngLog().map(entry => entry.replace(/=.*/, '')),
            ['rnd(20)', 'rnd(2)', 'rnd(2)', 'rn2(6)', 'rn2(19)'],
        );
        assertNoBridgeUse();
    });

test('potentially lethal swallowed weapon with life-saving fails before mutation',
    async () => {
        const engulfer = freshSwallowedState(PM_TRAPPER);
        engulfer.mhp = 3;
        const amulet = mksobj(AMULET_OF_LIFE_SAVING, true, false);
        amulet.owornmask = W_AMUL;
        amulet.worn = true;
        linkObjectToMonsterInventory(engulfer, amulet, { atFront: true });
        const raw = mksobj(DAGGER, true, false);
        raw.cursed = raw.blessed = false;
        raw.bknown = raw.dknown = raw.known = true;
        raw.typeKnown = true;
        raw.spe = raw.enchantment = 0;
        raw.oeroded = raw.oeroded2 = 0;
        const dagger = addInventoryItem(raw);
        setBasicWeaponSkill(dagger);

        initRng(2312n);
        enableRngLog();
        await assert.rejects(
            throwThroughLiveCommand(dagger, 'h'),
            error => error?.code === 'TELEPORT_BRIDGE_FORBIDDEN'
                && error?.bridgeId
                    === 'throw.swallowed-weapon-unsupported',
        );

        assert.equal(engulfer.mhp, 3);
        assert.deepEqual(game.inventory, [dagger]);
        assert.deepEqual(engulfer.minvent, [amulet]);
        assert.deepEqual(getRngLog(), []);
        const ledger = getBridgeUsageLedger();
        assert.equal(ledger.bridgeFree, true);
        assert.equal(ledger.totalHits, 1);
        assert.equal(ledger.forbiddenHits, 1);
        assert.equal(
            ledger.bridges['throw.swallowed-weapon-unsupported'].count,
            1,
        );
    });
