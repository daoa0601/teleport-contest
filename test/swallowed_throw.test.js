import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import {
    A_CON, A_DEX, A_STR, A_WIS, LOST_STOLEN, P_BASIC, W_AMUL,
} from '../js/const.js';
import { game } from '../js/gstate.js';
import { inventoryItemDescription } from '../js/invent.js';
import { beginObjectBurn } from '../js/light.js';
import { linkObjectToMonsterInventory } from '../js/monster_inventory.js';
import {
    AMULET_OF_LIFE_SAVING, AMULET_OF_UNCHANGING,
    ARROW, BOW, DAGGER, DART, FIGURINE, MAGIC_LAMP,
    OBJECT_SUBTYPE, OIL_LAMP, PICK_AXE, POT_FRUIT_JUICE,
    POT_ACID, POT_BLINDNESS, POT_BOOZE, POT_FULL_HEALING, POT_GAIN_ABILITY,
    POT_GAIN_ENERGY,
    POT_GAIN_LEVEL,
    POT_HEALING, POT_LEVITATION, POT_MONSTER_DETECTION,
    POT_INVISIBILITY, POT_OBJECT_DETECTION, POT_OIL, POT_PARALYSIS,
    POT_RESTORE_ABILITY, POT_SICKNESS, POT_SLEEPING,
    POT_WATER, ROCK,
    SCR_BLANK_PAPER, TWO_HANDED_SWORD,
} from '../js/object_data.js';
import { objectTimers } from '../js/object_timers.js';
import { initRng } from '../js/rng.js';
import { throwInventoryObject } from './support/commands.js';
import {
    knownInventoryObject, knownInventoryWeapon, knownObject,
} from './support/game-objects.js';
import {
    installHeroWeaponSkills, installHumanWerewolfHero, wearHeroObject,
    wearPolymorphControlRing,
} from './support/hero-state.js';
import { floorObjects } from './support/level-state.js';
import { addMonster } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

const PM_ENERGY_VORTEX = 109;
const PM_OCHRE_JELLY = 58;
const PM_PURPLE_WORM = 115;
const PM_TRAPPER = 99;
const PM_JUIBLEX = 303;
const PM_WEREWOLF = 21;
const PM_GREMLIN = 40;
const PM_ARCHEOLOGIST = 331;

function freshSwallowedState(mnum) {
    freshObjectRoom({
        right: 12,
        hero: {
            uhitinc: 0,
            uluck: 0,
        },
        context: { move: 0 },
        recalculateVision: false,
    });
    const engulfer = addMonster({
        m_id: 2300 + mnum,
        mnum,
        x: 10,
        y: 10,
        hitPoints: 40,
        hasInventory: false,
    });
    Object.assign(game.u, {
        uswallow: 1,
        ustuck: engulfer,
    });
    return engulfer;
}


function installLowCapacityRockBurden(quantity) {
    game.u.acurr.a[A_STR] = game.u.acurr.a[A_CON] = 3;
    game.u.amax.a[A_STR] = game.u.amax.a[A_CON] = 3;
    return knownInventoryObject(ROCK, {
        quan: quantity,
        quantity,
        owt: 10 * quantity,
    });
}

function setBasicWeaponSkill(object) {
    const skill = Math.abs(OBJECT_SUBTYPE[object.otyp] ?? 0);
    installHeroWeaponSkills({ [skill]: P_BASIC });
    return skill;
}

test('swallowed live throw transfers a cursed figurine and replaces its timer',
    async () => {
        const engulfer = freshSwallowedState(PM_ENERGY_VORTEX);
        initRng(2301n);
        const figurine = knownInventoryObject(FIGURINE, {
            corpsenm: 84,
            cursed: true,
        });
        const priorTimer = { ...objectTimers(figurine)[0] };

        initRng(2302n);
        await throwInventoryObject(figurine);

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
    });

test('swallowed split stack merges only after thrown ownership becomes stolen',
    async () => {
        const engulfer = freshSwallowedState(PM_PURPLE_WORM);
        initRng(2303n);
        const carried = knownInventoryObject(SCR_BLANK_PAPER, {
            quan: 2,
            quantity: 2,
        });
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
        await throwInventoryObject(carried, 'h');

        assert.equal(carried.quan, 1);
        assert.equal(carried.quantity, 1);
        assert.deepEqual(game.inventory, [carried]);
        assert.deepEqual(engulfer.minvent, [survivor]);
        assert.equal(survivor.quan, 4);
        assert.equal(survivor.quantity, 4);
        assert.equal(survivor.how_lost, LOST_STOLEN);
        assert.match(game._pending_message,
            /^The scroll of blank paper vanishes into the purple worm's entrails\.$/);
        assert.equal(floorObjects(game.level).length, 0);
    });

test('swallowed timed lamp links before snuffing and restores unused fuel',
    async () => {
        const engulfer = freshSwallowedState(PM_TRAPPER);
        initRng(2305n);
        const lamp = knownInventoryObject(OIL_LAMP, { age: 200 });
        assert.equal(lamp.invlet, 'a');
        assert.equal(lamp.oclass, 6);
        assert.equal(beginObjectBurn(lamp, game, game.moves), true);
        assert.equal(lamp.age, 150);
        assert.equal(objectTimers(lamp)[0].deadline, 90);

        game.moves = 60;
        initRng(2306n);
        await throwInventoryObject(lamp, 'j');

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
    });

test('blind swallowed contact silently snuffs an untimed magic lamp',
    async () => {
        const engulfer = freshSwallowedState(PM_TRAPPER);
        game.u.blindTurns = 5;
        initRng(2307n);
        const lamp = knownInventoryObject(MAGIC_LAMP, { age: 40 });
        assert.equal(lamp.invlet, 'a');
        assert.equal(lamp.oclass, 6);
        assert.equal(beginObjectBurn(lamp, game, game.moves), true);
        assert.equal(lamp.lamplit, true);
        assert.deepEqual(objectTimers(lamp), []);

        initRng(2308n);
        await throwInventoryObject(lamp, 'k');

        assert.strictEqual(engulfer.minvent[0], lamp);
        assert.equal(lamp.where, 'minvent');
        assert.equal(lamp.lamplit, false);
        assert.equal(lamp.age, 40);
        assert.deepEqual(objectTimers(lamp), []);
        assert.equal(game._pending_message,
            'The magic lamp vanishes into the trapper.');
    });

test('swallowed ordinary weapon damages, trains, and transfers after contact',
    async () => {
        const engulfer = freshSwallowedState(PM_TRAPPER);
        const dagger = knownInventoryWeapon(DAGGER);
        const skill = setBasicWeaponSkill(dagger);

        initRng(2310n);
        await throwInventoryObject(dagger, 'l');

        assert.equal(engulfer.mhp, 37);
        assert.strictEqual(engulfer.minvent[0], dagger);
        assert.equal(game.inventory.includes(dagger), false);
        assert.equal(dagger.where, 'minvent');
        assert.equal(dagger.carrierMid, engulfer.m_id);
        assert.equal(dagger.how_lost, LOST_STOLEN);
        assert.equal(game.u.weaponSkills[skill].advance, 1);
        assert.equal(game.u._weaponPracticeBySkill[skill], 1);
        assert.equal(game.u._exercise[A_DEX], 1);
        assert.equal(game._pending_message,
            'The dagger hits the trapper.');
        assert.equal(floorObjects(game.level).length, 0);
    });

test('swallowed weapon-tool preserves minimal-damage skill cadence',
    async () => {
        const engulfer = freshSwallowedState(PM_TRAPPER);
        const pick = knownInventoryWeapon(PICK_AXE);
        const skill = setBasicWeaponSkill(pick);

        initRng(2311n);
        await throwInventoryObject(pick, 'k');

        assert.equal(engulfer.mhp, 39);
        assert.strictEqual(engulfer.minvent[0], pick);
        assert.equal(pick.where, 'minvent');
        assert.equal(pick.carrierMid, engulfer.m_id);
        assert.equal(pick.how_lost, LOST_STOLEN);
        assert.equal(game.u.weaponSkills[skill].advance, 0);
        assert.equal(game.u._weaponPracticeBySkill, undefined);
        assert.equal(game.u._exercise[A_DEX], 0);
        assert.equal(game._pending_message,
            'The pick-axe hits the trapper.');
        assert.equal(floorObjects(game.level).length, 0);
    });

test('swallowed multi-die weapon uses the shared physical damage owner',
    async () => {
        const engulfer = freshSwallowedState(PM_TRAPPER);
        const sword = knownInventoryWeapon(TWO_HANDED_SWORD);
        const skill = setBasicWeaponSkill(sword);

        initRng(2313n);
        await throwInventoryObject(sword, 'j');

        assert.equal(engulfer.mhp, 28);
        assert.strictEqual(engulfer.minvent[0], sword);
        assert.equal(sword.where, 'minvent');
        assert.equal(sword.how_lost, LOST_STOLEN);
        assert.equal(game.u.weaponSkills[skill].advance, 1);
        assert.equal(game.u._exercise[A_DEX], 0);
        assert.equal(game._pending_message,
            'The two-handed sword hits the trapper!');
        assert.equal(floorObjects(game.level).length, 0);
    });

test('cursed swallowed throwing weapon slips before hitting the engulfer',
    async () => {
        const engulfer = freshSwallowedState(PM_TRAPPER);
        const dagger = knownInventoryWeapon(DAGGER, { cursed: true });
        const skill = setBasicWeaponSkill(dagger);

        initRng(2333n);
        await throwInventoryObject(dagger, 'l');

        assert.equal(engulfer.mhp, 37);
        assert.strictEqual(engulfer.minvent[0], dagger);
        assert.equal(dagger.how_lost, LOST_STOLEN);
        assert.equal(game.u.weaponSkills[skill].advance, 1);
        assert.equal(game._pending_message,
            'The dagger slips as you throw it!  The dagger hits the trapper.');
        assert.equal(game.u.dx, -1);
        assert.equal(game.u.dy, -1);
        assert.equal(game.u.dz, 0);
        assert.equal(floorObjects(game.level).length, 0);
    });

test('swallowed dart survives mulch and transfers after live missile damage',
    async () => {
        const engulfer = freshSwallowedState(PM_TRAPPER);
        const dart = knownInventoryWeapon(DART);
        const skill = setBasicWeaponSkill(dart);

        initRng(2413n);
        await throwInventoryObject(dart, 'l');

        assert.equal(engulfer.mhp, 38);
        assert.strictEqual(engulfer.minvent[0], dart);
        assert.equal(dart.where, 'minvent');
        assert.equal(dart.carrierMid, engulfer.m_id);
        assert.equal(dart.how_lost, LOST_STOLEN);
        assert.equal(game.u.weaponSkills[skill].advance, 1);
        assert.equal(game.u._weaponPracticeBySkill[skill], 1);
        assert.equal(game._pending_message, 'The dart hits the trapper.');
        assert.equal(floorObjects(game.level).length, 0);
    });

test('swallowed dart mulch removes the detached identity after damage',
    async () => {
        const engulfer = freshSwallowedState(PM_TRAPPER);
        const dart = knownInventoryWeapon(DART);
        const skill = setBasicWeaponSkill(dart);

        initRng(2502n);
        await throwInventoryObject(dart, 'h');

        assert.equal(engulfer.mhp, 38);
        assert.deepEqual(game.inventory, []);
        assert.deepEqual(engulfer.minvent, []);
        assert.equal(dart.where, 'gone');
        assert.equal(game.u.weaponSkills[skill].advance, 1);
        assert.equal(game._pending_message, 'The dart hits the trapper.');
        assert.equal(floorObjects(game.level).length, 0);
    });

test('swallowed projectile passive follows mulch survival before acquisition',
    async () => {
        const engulfer = freshSwallowedState(PM_OCHRE_JELLY);
        const dart = knownInventoryWeapon(DART);
        const skill = setBasicWeaponSkill(dart);

        initRng(2645n);
        await throwInventoryObject(dart, 'l');

        assert.equal(engulfer.mhp, 37);
        assert.strictEqual(engulfer.minvent[0], dart);
        assert.equal(dart.where, 'minvent');
        assert.equal(dart.oeroded2, 1);
        assert.equal(game.u.weaponSkills[skill].advance, 1);
        assert.equal(game._pending_message,
            'The dart hits the ochre jelly.  The dart corrodes!');
    });

test('swallowed launched arrow uses launcher skill and excludes Strength',
    async () => {
        const engulfer = freshSwallowedState(PM_TRAPPER);
        const bow = knownInventoryWeapon(BOW);
        const skill = setBasicWeaponSkill(bow);
        game.uwep = game.u.uwep = bow;

        const arrow = knownInventoryWeapon(ARROW);
        game.u.acurr.a[A_STR] = 18;

        initRng(2413n);
        await throwInventoryObject(arrow, 'k');

        assert.equal(engulfer.mhp, 36);
        assert.deepEqual(game.inventory, [bow]);
        assert.strictEqual(engulfer.minvent[0], arrow);
        assert.equal(arrow.where, 'minvent');
        assert.equal(arrow.how_lost, LOST_STOLEN);
        assert.equal(game.u.weaponSkills[skill].advance, 1);
        assert.equal(game.u._weaponPracticeBySkill[skill], 1);
        assert.equal(game._pending_message, 'The arrow hits the trapper.');
    });

test('swallowed hand-thrown arrow uses ranged damage and Strength without skill',
    async () => {
        const engulfer = freshSwallowedState(PM_TRAPPER);
        const arrow = knownInventoryWeapon(ARROW);
        const skill = setBasicWeaponSkill(arrow);
        game.u.acurr.a[A_STR] = 18;

        initRng(2413n);
        await throwInventoryObject(arrow, 'j');

        assert.equal(engulfer.mhp, 36);
        assert.strictEqual(engulfer.minvent[0], arrow);
        assert.equal(arrow.where, 'minvent');
        assert.equal(arrow.how_lost, LOST_STOLEN);
        assert.equal(game.u.weaponSkills[skill].advance, 0);
        assert.equal(game.u._weaponPracticeBySkill, undefined);
        assert.equal(game._pending_message, 'The arrow hits the trapper.');
    });

test('swallowed sickness harms both the engulfer and hero',
    async () => {
        const engulfer = freshSwallowedState(PM_TRAPPER);
        const potion = knownInventoryObject(POT_SICKNESS);

        initRng(2510n);
        await throwInventoryObject(potion, 'l');

        assert.equal(engulfer.mhp, 19);
        assert.equal(game.u.uhp, 35);
        assert.equal(game.u._exercise[A_CON], -1);
        assert.deepEqual(game.inventory, []);
        assert.deepEqual(engulfer.minvent, []);
        assert.equal(potion.where, 'gone');
        assert.equal(floorObjects(game.level).length, 0);
    });

test('swallowed booze confuses both the engulfer and hero',
    async () => {
        const engulfer = freshSwallowedState(PM_TRAPPER);
        engulfer.m_lev = 12;
        engulfer.mconf = 0;
        game.u.confusionTurns = 0;
        const potion = knownInventoryObject(POT_BOOZE);

        initRng(2955n);
        await throwInventoryObject(potion, 'l');

        assert.equal(engulfer.mhp, 39);
        assert.equal(engulfer.mconf, 1);
        assert.equal(game.u.confusionTurns, 3);
        assert.deepEqual(game.inventory, []);
        assert.deepEqual(engulfer.minvent, []);
        assert.equal(potion.where, 'gone');
        assert.equal(floorObjects(game.level).length, 0);
        assert.equal(game._pending_message, 'Crash!  You feel somewhat dizzy.');
    });

test('swallowed sleeping potion freezes engulfer and installs hero sleep turns',
    async () => {
        const engulfer = freshSwallowedState(PM_TRAPPER);
        engulfer.m_lev = 12;
        engulfer.mfrozen = 0;
        engulfer.meating = 3;
        const potion = knownInventoryObject(POT_SLEEPING);

        initRng(2511n);
        await throwInventoryObject(
            potion, 'l', [' ', ' ', ' ', ' '],
        );
        assert.equal(engulfer.mhp, 39);
        assert.equal(engulfer.mcanmove, 0);
        assert.equal(engulfer.mfrozen, 8);
        assert.equal(engulfer.meating, 0);
        assert.equal(game._helplessTurns, 1);
        assert.equal(game._helplessReason, 'sleeping off a magical draught');
        assert.equal(game._helplessDoneMessage, 'You can move again.');
        assert.deepEqual(game.inventory, []);
        assert.equal(potion.where, 'gone');
    });

test('swallowed blindness times engulfer sight before blinding the hero',
    async () => {
        const engulfer = freshSwallowedState(PM_PURPLE_WORM);
        engulfer.m_lev = 12;
        engulfer.mcansee = 1;
        engulfer.mblinded = 0;
        game.u.blindTurns = 0;
        game.blind = false;
        const potion = knownInventoryObject(POT_BLINDNESS);

        initRng(3300n);
        await throwInventoryObject(
            potion, 'l', [' ', ' ', ' ', ' '],
        );
        assert.equal(engulfer.mhp, 39);
        assert.equal(engulfer.mcansee, 0);
        assert.equal(engulfer.mblinded, 120);
        assert.equal(game.u.blindTurns, 4);
        assert.equal(game.blind, true);
        assert.equal(game.vision_full_recalc, 0);
        assert.deepEqual(game.inventory, []);
        assert.equal(potion.where, 'gone');
    });

test('swallowed cursed invisibility reveals and angers an invisible engulfer',
    async () => {
        const engulfer = freshSwallowedState(PM_TRAPPER);
        engulfer.minvis = 1;
        engulfer.perminvis = 1;
        engulfer.invis_blkd = 0;
        const potion = knownInventoryObject(POT_INVISIBILITY, {
            cursed: true,
        });

        initRng(2511n);
        await throwInventoryObject(
            potion, 'l', [' ', ' ', ' ', ' '],
        );
        assert.equal(engulfer.mhp, 39);
        assert.equal(engulfer.perminvis, 0);
        assert.equal(engulfer.minvis, 0);
        assert.deepEqual(game.inventory, []);
        assert.deepEqual(engulfer.minvent, []);
        assert.equal(potion.where, 'gone');
        assert.equal(floorObjects(game.level).length, 0);
    });

test('swallowed blessed water damages a demonic engulfer through the live owner',
    async () => {
        const engulfer = freshSwallowedState(PM_JUIBLEX);
        const potion = knownInventoryObject(POT_WATER, { blessed: true });

        initRng(2511n);
        await throwInventoryObject(
            potion, 'l', Array(20).fill(' '),
        );
        assert.equal(engulfer.mhp, 31);
        assert.equal(potion.where, 'gone');
    });

test('swallowed cursed water heals a demonic engulfer without angering it',
    async () => {
        const engulfer = freshSwallowedState(PM_JUIBLEX);
        engulfer.mhp = 20;
        engulfer.msleeping = 1;
        const potion = knownInventoryObject(POT_WATER, { cursed: true });

        initRng(2511n);
        await throwInventoryObject(
            potion, 'l', Array(20).fill(' '),
        );
        assert.equal(engulfer.mhp, 31);
        assert.equal(engulfer.msleeping, 0);
        assert.equal(potion.where, 'gone');
    });

test('swallowed cursed-water vapor changes an unthreatened lycanthrope hero',
    async () => {
        const engulfer = freshSwallowedState(PM_JUIBLEX);
        engulfer.mhp = 20;
        installHumanWerewolfHero();
        const potion = knownInventoryObject(POT_WATER, { cursed: true });

        initRng(2511n);
        await throwInventoryObject(
            potion, 'l', Array(30).fill(' '),
        );

        assert.equal(game.u.umonnum, PM_WEREWOLF);
        assert.ok(game.u.mtimedone >= 500 && game.u.mtimedone <= 999);
        assert.equal(game.u.mh, game.u.mhmax);
        assert.ok(game.u.mh > 0);
        assert.equal(game.u.uconduct.polyselfs, 1);
        assert.equal(game.were_changes, 1);
        assert.equal(potion.where, 'gone');
    });

test('Unchanging suppresses cursed-water lycanthrope vapor transformation',
    async () => {
        const engulfer = freshSwallowedState(PM_JUIBLEX);
        installHumanWerewolfHero();
        wearHeroObject(
            knownInventoryObject(AMULET_OF_UNCHANGING), 'uamul', W_AMUL,
        );
        const potion = knownInventoryObject(POT_WATER, { cursed: true });

        initRng(2511n);
        await throwInventoryObject(
            potion, 'l', Array(20).fill(' '),
        );

        assert.equal(game.u.umonnum, PM_ARCHEOLOGIST);
        assert.equal(game.u.mtimedone, 0);
        assert.equal(game.u.uconduct.polyselfs ?? 0, 0);
        assert.equal(potion.where, 'gone');
    });

test('gremlin hero water vapor creates a named tame clone and splits form HP',
    async () => {
        const engulfer = freshSwallowedState(PM_JUIBLEX);
        installHumanWerewolfHero();
        game.plname = 'Splitter';
        Object.assign(game.u, {
            umonnum: PM_GREMLIN,
            mtimedone: 300,
            mh: 19,
            mhmax: 17,
        });
        const potion = knownInventoryObject(POT_WATER);

        initRng(2511n);
        await throwInventoryObject(
            potion, 'l', Array(30).fill(' '),
        );

        const clones = game.level.monsters.filter(monster => monster.mcloned);
        assert.equal(clones.length, 1);
        const clone = clones[0];
        assert.equal(clone.mnum, PM_GREMLIN);
        assert.equal(clone.name, 'Splitter');
        assert.equal(clone.pet, true);
        assert.equal(clone.mtame, 5);
        assert.equal(clone.mpeaceful, 1);
        assert.equal(clone.mhp, 8);
        assert.equal(clone.mhpmax, 8);
        assert.deepEqual(clone.minvent, []);
        assert.strictEqual(clone.inventory, clone.minvent);
        assert.deepEqual(clone.edog.ogoal, { x: -1, y: -1 });
        assert.equal(clone.edog.apport, 12);
        assert.equal(clone.edog.hungrytime, 1040);
        assert.notDeepEqual([clone.mx, clone.my], [game.u.ux, game.u.uy]);
        assert.equal(game.u.umonnum, PM_GREMLIN);
        assert.equal(game.u.mh, 9);
        assert.equal(game.u.mhmax, 9);
        assert.equal(game.u.uconduct.pets, 1);
        assert.equal(potion.where, 'gone');
        assert.match(game._pending_message, /You multiply!$/);
    });

test('one-HP gremlin vapor consumes water without constructing a clone',
    async () => {
        const engulfer = freshSwallowedState(PM_JUIBLEX);
        installHumanWerewolfHero();
        Object.assign(game.u, {
            umonnum: PM_GREMLIN,
            mtimedone: 300,
            mh: 5,
            mhmax: 1,
        });
        const potion = knownInventoryObject(POT_WATER);

        initRng(2511n);
        await throwInventoryObject(
            potion, 'l', Array(20).fill(' '),
        );

        assert.equal(
            game.level.monsters.some(monster => monster.mcloned), false,
        );
        assert.equal(game.u.mh, 1);
        assert.equal(game.u.mhmax, 1);
        assert.equal(game.u.uconduct.pets ?? 0, 0);
        assert.equal(potion.where, 'gone');
        assert.doesNotMatch(game._pending_message, /multiply/);
    });

test('four-HP gremlin throw is not a stamina drop while unencumbered',
    async () => {
        const engulfer = freshSwallowedState(PM_JUIBLEX);
        installHumanWerewolfHero();
        Object.assign(game.u, {
            umonnum: PM_GREMLIN,
            mtimedone: 300,
            mh: 4,
            mhmax: 1,
        });
        const potion = knownInventoryObject(POT_WATER);

        initRng(2511n);
        await throwInventoryObject(
            potion, 'l', Array(20).fill(' '),
        );

        assert.deepEqual(game.inventory, []);
        assert.equal(
            game.level.monsters.some(monster => monster.mcloned), false,
        );
        assert.equal(game.u.mh, 1);
        assert.equal(game.u.mhmax, 1);
        assert.equal(potion.where, 'gone');
        assert.doesNotMatch(
            game._pending_message || '', /so little stamina/,
        );
    });

test('overtaxed throw rejects before object and direction input', async () => {
    freshSwallowedState(PM_ENERGY_VORTEX);
    const rocks = installLowCapacityRockBurden(50);

    initRng(2511n);
    await rhack('t'.charCodeAt(0));
    assert.deepEqual(game.inventory, [rocks]);
    assert.equal(
        game._pending_message,
        "You can't do that while carrying so much stuff.",
    );
    assert.equal(game.context.move, 0);
});

test('burdened low-HP hero throws without the Stressed stamina branch',
    async () => {
        freshSwallowedState(PM_ENERGY_VORTEX);
        game.u.uhp = 9;
        const rocks = installLowCapacityRockBurden(20);
        const potion = knownInventoryObject(POT_FRUIT_JUICE);

        initRng(2511n);
        await throwInventoryObject(
            potion, 'l', Array(20).fill(' '),
        );
        assert.equal(game.u._exercise, undefined);
        assert.deepEqual(game.inventory, [rocks]);
        assert.equal(potion.where, 'gone');
        assert.equal(game.u.dx, 1);
        assert.equal(game.u.dy, 0);
        assert.equal(game.u.dz, 0);
        assert.doesNotMatch(
            game._pending_message || '', /so little stamina/,
        );
    });

test('stressed low-HP hero drops then completes swallowed potion contact',
    async () => {
        const engulfer = freshSwallowedState(PM_ENERGY_VORTEX);
        game.u.uhp = 9;
        const rocks = installLowCapacityRockBurden(30);
        const potion = knownInventoryObject(POT_FRUIT_JUICE);

        initRng(2511n);
        await throwInventoryObject(
            potion, 'l', Array(20).fill(' '),
        );
        assert.equal(game.u._exercise[A_CON], -1);
        assert.deepEqual(game.inventory, [rocks]);
        assert.equal(potion.where, 'gone');
        assert.equal(game.u.dx, 0);
        assert.equal(game.u.dy, 0);
        assert.equal(game.u.dz, 1);
        assert.equal(engulfer.msleeping, 0);
    });

test('stressed four-HP gremlin drops without physical exercise then contacts',
    async () => {
        freshSwallowedState(PM_JUIBLEX);
        installHumanWerewolfHero();
        Object.assign(game.u, {
            umonnum: PM_GREMLIN,
            mtimedone: 300,
            mh: 4,
            mhmax: 1,
        });
        game.u.acurr.a[A_STR] = game.u.acurr.a[A_CON] = 3;
        game.u.amax.a[A_STR] = game.u.amax.a[A_CON] = 3;
        const potion = knownInventoryObject(POT_WATER);

        initRng(2511n);
        await throwInventoryObject(
            potion, 'l', Array(20).fill(' '),
        );
        assert.equal(game.u._exercise, undefined);
        assert.equal(game.u.mh, 1);
        assert.equal(game.u.mhmax, 1);
        assert.equal(potion.where, 'gone');
        assert.equal(game.u.dx, 0);
        assert.equal(game.u.dy, 0);
        assert.equal(game.u.dz, 1);
    });

test('controlled lycanthrope acceptance completes swallowed mutation',
    async () => {
        const engulfer = freshSwallowedState(PM_JUIBLEX);
        installHumanWerewolfHero();
        const ring = wearPolymorphControlRing();
        const potion = knownInventoryObject(POT_WATER, { cursed: true });

        initRng(2511n);
        await throwInventoryObject(
            potion, 'l', ['y'],
        );

        assert.deepEqual(game.inventory, [ring]);
        assert.equal(game.u.umonnum, PM_WEREWOLF);
        assert.equal(game.were_changes, 1);
        assert.equal(game.u.uconduct.polyselfs, 1);
        assert.equal(potion.where, 'gone');
    });

test('stun bypasses the lycanthrope control prompt and permits transformation',
    async () => {
        const engulfer = freshSwallowedState(PM_JUIBLEX);
        installHumanWerewolfHero();
        wearPolymorphControlRing();
        game.u.stunned = true;
        game.u.stunnedTurns = 4;
        const potion = knownInventoryObject(POT_WATER, { cursed: true });

        initRng(2511n);
        await throwInventoryObject(
            potion, 'l', Array(30).fill(' '),
        );

        assert.equal(game.u.umonnum, PM_WEREWOLF);
        assert.equal(game.u.uconduct.polyselfs, 1);
        assert.equal(game.were_changes, 1);
        assert.equal(potion.where, 'gone');
    });

test('swallowed acid damages the engulfer and exercises hero Constitution',
    async () => {
        const engulfer = freshSwallowedState(PM_TRAPPER);
        const potion = knownInventoryObject(POT_ACID);

        initRng(2511n);
        await throwInventoryObject(
            potion, 'l', Array(20).fill(' '),
        );

        assert.ok(engulfer.mhp >= 31 && engulfer.mhp <= 39);
        assert.equal(game.u.uhp, 40);
        assert.equal(game.u._exercise[A_CON], -1);
        assert.equal(potion.where, 'gone');
    });

test('swallowed unlit oil breaks without evaporation or floor fallback',
    async () => {
        const engulfer = freshSwallowedState(PM_TRAPPER);
        engulfer.msleeping = 1;
        const potion = knownInventoryObject(POT_OIL);

        initRng(2511n);
        await throwInventoryObject(
            potion, 'l', Array(20).fill(' '),
        );

        assert.ok(engulfer.mhp <= 40 && engulfer.mhp >= 39);
        assert.equal(engulfer.msleeping, 0);
        assert.equal(game._pending_message, 'Crash!');
        assert.doesNotMatch(game._pending_message, /evaporates/);
        assert.deepEqual(game.inventory, []);
        assert.deepEqual(engulfer.minvent, []);
        assert.equal(potion.where, 'gone');
        assert.equal(floorObjects(game.level).length, 0);
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
            },
            {
                type: POT_FULL_HEALING,
                blessed: false,
                cursed: true,
                seed: 2810n,
                heroGain: 3,
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
            const potion = knownInventoryObject(specimen.type, {
                cursed: specimen.cursed,
                blessed: specimen.blessed,
            });

            initRng(specimen.seed);
            await throwInventoryObject(potion, 'l', [' ', ' ', ' ', ' ']);
            assert.equal(engulfer.mhp, engulfer.mhpmax);
            assert.equal(engulfer.mcansee, 1);
            assert.equal(engulfer.mblinded, 0);
            assert.equal(engulfer.msleeping, 0);
            assert.equal(game.u.uhp, 30 + specimen.heroGain);
            assert.equal(game.u.blindTurns, 0);
            assert.equal(game.u.deafTurns, 0);
            assert.equal(potion.where, 'gone');
        }
    });

test('swallowed blessed gain ability restores every reduced base attribute',
    async () => {
        const engulfer = freshSwallowedState(PM_TRAPPER);
        engulfer.mhp = 11;
        game.u.acurr.a = Array(6).fill(12);
        game.u.acurr.a[A_STR] = 10;
        game.u.acurr.a[A_WIS] = 9;
        game.u.acurr.a[A_CON] = 8;
        game.u.amax.a = [12, 12, 12, 12, 12, 12];
        const potion = knownInventoryObject(POT_GAIN_ABILITY, {
            blessed: true,
        });

        initRng(2824n);
        await throwInventoryObject(potion, 'l', [' ', ' ', ' ', ' ']);
        assert.equal(engulfer.mhp, engulfer.mhpmax);
        assert.equal(game.u.acurr.a[A_STR], 11);
        assert.equal(game.u.acurr.a[A_WIS], 10);
        assert.equal(game.u.acurr.a[A_CON], 9);
        assert.equal(potion.where, 'gone');
    });

test('cursed restore ability vapor smells but cannot restore attributes',
    async () => {
        const engulfer = freshSwallowedState(PM_TRAPPER);
        engulfer.mhp = 12;
        game.u.acurr.a = Array(6).fill(12);
        game.u.acurr.a[A_STR] = 10;
        game.u.acurr.a[A_WIS] = 9;
        game.u.acurr.a[A_CON] = 8;
        game.u.amax.a = [12, 12, 12, 12, 12, 12];
        const potion = knownInventoryObject(POT_RESTORE_ABILITY, {
            cursed: true,
        });

        initRng(2820n);
        await throwInventoryObject(potion, 'l', [' ', ' ', ' ', ' ']);
        assert.equal(engulfer.mhp, engulfer.mhpmax);
        assert.equal(game.u.acurr.a[A_STR], 10);
        assert.equal(game.u.acurr.a[A_WIS], 9);
        assert.equal(game.u.acurr.a[A_CON], 8);
        assert.equal(game._pending_message,
            'Crash!  Ulch!  That potion smells terrible!');
        assert.equal(potion.where, 'gone');
    });

test('all monster-inert potions crash unseen, chip, and disappear live',
    async () => {
        const inertTypes = [
            POT_GAIN_LEVEL, POT_GAIN_ENERGY, POT_LEVITATION,
            POT_FRUIT_JUICE, POT_MONSTER_DETECTION, POT_OBJECT_DETECTION,
        ];
        const expectedHp = [39, 40, 39, 39, 40, 39];

        for (let index = 0; index < inertTypes.length; index++) {
            const engulfer = freshSwallowedState(PM_TRAPPER);
            if (index === 0) engulfer.msleeping = 1;
            const potion = knownInventoryObject(inertTypes[index]);

            initRng(2511n + BigInt(index));
            await throwInventoryObject(potion, 'l', [' ', ' ', ' ']);
            assert.equal(engulfer.mhp, expectedHp[index]);
            assert.equal(engulfer.msleeping, 0);
            assert.deepEqual(game.inventory, []);
            assert.deepEqual(engulfer.minvent, []);
            assert.equal(potion.where, 'gone');
            assert.equal(potion.ox, 0);
            assert.equal(potion.oy, 0);
            assert.equal(game._pending_message, 'Crash!');
            assert.equal(floorObjects(game.level).length, 0);
        }
    });

test('unseen swallowed bottle selection remains hallucination-sensitive',
    async () => {
        const engulfer = freshSwallowedState(PM_ENERGY_VORTEX);
        game.u.hallucinationTurns = 8;
        const potion = knownInventoryObject(POT_GAIN_LEVEL);

        initRng(2520n);
        await throwInventoryObject(potion, 'h', [' ', ' ', ' ']);
        assert.equal(engulfer.mhp, 39);
        assert.deepEqual(game.inventory, []);
        assert.deepEqual(engulfer.minvent, []);
        assert.equal(potion.where, 'gone');
        assert.equal(game._pending_message, 'Crash!');
    });

test('swallowed inert potion stack splits one consumed identity', async () => {
    const engulfer = freshSwallowedState(PM_TRAPPER);
    const potion = knownInventoryObject(POT_FRUIT_JUICE, {
        quan: 2,
        quantity: 2,
    });

    initRng(2521n);
    await throwInventoryObject(potion, 'j', [' ', ' ', ' ']);
    assert.equal(engulfer.mhp, 40);
    assert.deepEqual(game.inventory, [potion]);
    assert.equal(potion.quan, 1);
    assert.equal(potion.quantity, 1);
    assert.equal(potion.where, 'inventory');
    assert.deepEqual(engulfer.minvent, []);
    assert.equal(floorObjects(game.level).length, 0);
});

test('dknown unknown swallowed potion records a live type call after impact',
    async () => {
        const engulfer = freshSwallowedState(PM_TRAPPER);
        const potion = knownInventoryObject(POT_FRUIT_JUICE, {
            known: false,
            typeKnown: false,
        });
        const sibling = knownInventoryObject(POT_FRUIT_JUICE, {
            blessed: true,
            known: false,
            typeKnown: false,
        });
        const appearance = game.objectDescriptions[potion.otyp];

        initRng(2522n);
        await throwInventoryObject(potion, 'l', [
            ...Array(20).fill(' '), ...'mystery', '\n',
        ]);

        assert.equal(engulfer.mhp, 39);
        assert.deepEqual(game.inventory, [sibling]);
        assert.equal(potion.where, 'gone');
        assert.equal(game._objectCallNames[POT_FRUIT_JUICE], 'mystery');
        assert.ok(
            inventoryItemDescription(sibling).includes(
                `${appearance} potion called mystery`,
            ),
        );
        assert.equal(floorObjects(game.level).length, 0);
    });

test('unseen unknown inert potion needs no naming continuation', async () => {
    const engulfer = freshSwallowedState(PM_TRAPPER);
    const potion = knownInventoryObject(POT_FRUIT_JUICE, {
        bknown: false,
        dknown: false,
        known: false,
        typeKnown: false,
    });
    potion.bknown = potion.dknown = potion.known = potion.typeKnown = false;

    initRng(2523n);
    await throwInventoryObject(potion, 'l');
    assert.equal(engulfer.mhp, 39);
    assert.deepEqual(game.inventory, []);
    assert.deepEqual(engulfer.minvent, []);
    assert.equal(potion.where, 'gone');
    assert.equal(game._pending_message, 'Crash!');
});

test('greased inert potion slips before its swallowed impact transaction',
    async () => {
        const engulfer = freshSwallowedState(PM_TRAPPER);
        const potion = knownInventoryObject(POT_GAIN_ENERGY, {
            greased: true,
        });

        initRng(2524n);
        await throwInventoryObject(potion, 'h', [' ', ' ', ' ']);
        assert.equal(engulfer.mhp, 39);
        assert.deepEqual(game.inventory, []);
        assert.equal(potion.where, 'gone');
        assert.equal(game._pending_message,
            'The potion of gain energy slips as you throw it!  Crash!');
        assert.equal(game.u.dx, 0);
        assert.equal(game.u.dy, 0);
        assert.equal(game.u.dz, 1);
    });

test('a killing swallowed dart is acquired, dropped, and autopicked before cleanup',
    async () => {
        const engulfer = freshSwallowedState(PM_TRAPPER);
        engulfer.mhp = 1;
        game.flags.pickup = true;
        const dart = knownInventoryWeapon(DART);
        const skill = setBasicWeaponSkill(dart);

        initRng(2312n);
        await throwInventoryObject(dart, 'h');

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
        assert.equal(floorObjects(game.level).includes(dart), false);
        assert.equal(game.u.weaponSkills[skill].advance, 1);
        assert.equal(game.u._exercise[A_DEX], 1);
        assert.equal(game.u.uconduct.killer, 1);
        assert.equal(game._vanquishedCounts.get(PM_TRAPPER).count, 1);
        assert.ok((game.u.uexp ?? 0) > 0);
        assert.equal(floorObjects(game.level)
            .some(object => /corpse/.test(object.name || '')), false);
        assert.match(game._pending_message, /a - (?:an? )?dart\./);
    });

test('a killing swallowed weapon remains on the death square without autopickup',
    async () => {
        const engulfer = freshSwallowedState(PM_TRAPPER);
        engulfer.mhp = 1;
        game.flags.pickup = false;
        const dagger = knownInventoryWeapon(DAGGER);
        setBasicWeaponSkill(dagger);

        initRng(2312n);
        await throwInventoryObject(dagger, 'h', [' ']);

        const pile = game.level.objects[10][10];
        assert.deepEqual(game.inventory, []);
        assert.deepEqual(pile, [dagger]);
        assert.equal(dagger.where, 'floor');
        assert.equal(dagger.how_lost, LOST_STOLEN);
        assert.equal('carrierMid' in dagger, false);
        assert.match(game._pending_message, /You see here a \+0 dagger\./);
    });

test('a killing projectile releases prior minvent ahead of itself into autopickup',
    async () => {
        const engulfer = freshSwallowedState(PM_TRAPPER);
        engulfer.mhp = 1;
        game.flags.pickup = true;

        const prior = knownObject(SCR_BLANK_PAPER);
        linkObjectToMonsterInventory(engulfer, prior);

        const dart = knownInventoryWeapon(DART);
        setBasicWeaponSkill(dart);

        initRng(2312n);
        await throwInventoryObject(dart, 'h', [' ']);

        assert.deepEqual(game.inventory, [prior, dart]);
        assert.equal(prior.where, 'inventory');
        assert.equal(dart.where, 'inventory');
        assert.equal(prior.how_lost, 0);
        assert.equal(dart.how_lost, 0);
        assert.equal('carrierMid' in prior, false);
        assert.equal('carrierMid' in dart, false);
        assert.deepEqual(engulfer.minvent, []);
        assert.equal(floorObjects(game.level).length, 0);
    });

test('a killing projectile merges in minvent before the survivor is released',
    async () => {
        const engulfer = freshSwallowedState(PM_TRAPPER);
        engulfer.mhp = 1;
        game.flags.pickup = true;

        const survivor = knownObject(DART, {
            quan: 2,
            quantity: 2,
            spe: 0,
            enchantment: 0,
            oeroded: 0,
            oeroded2: 0,
            how_lost: LOST_STOLEN,
        });
        linkObjectToMonsterInventory(engulfer, survivor);

        const dart = knownInventoryWeapon(DART);
        setBasicWeaponSkill(dart);

        initRng(2312n);
        await throwInventoryObject(dart, 'h');

        assert.deepEqual(game.inventory, [survivor]);
        assert.equal(survivor.quan, 3);
        assert.equal(survivor.quantity, 3);
        assert.equal(survivor.where, 'inventory');
        assert.equal(survivor.how_lost, 0);
        assert.equal(dart.where, 'gone');
        assert.equal('carrierMid' in survivor, false);
        assert.equal('carrierMid' in dart, false);
        assert.deepEqual(engulfer.minvent, []);
        assert.equal(floorObjects(game.level).length, 0);
    });
