import assert from 'node:assert/strict';
import test from 'node:test';

import type { Monster } from '../js/monster_types.js';
import { BEAR_TRAP, MM_NOGRP, MM_NOWAIT, NO_MINVENT, PIT, STRAT_WAITFORU, VAULT } from '../js/const.js';
import { flush_screen } from '../js/display.js';
import { initializePet } from '../js/dog.js';
import { game, requireGameLevel } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { collectLevelFollowers } from '../js/monster_followers.js';
import { setMonsterGivenName } from '../js/monster_given_name.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { deliverMigratingMonsters } from '../js/monster_migration.js';
import { addCreatedObjectToContainer } from '../js/object_container.js';
import { AMULET_OF_YENDOR, FOOD_RATION, LEASH, SACK } from '../js/object_data.js';
import { init_objects } from '../js/o_init.js';
import { initRng } from '../js/rng.js';
import { vision_recalc, vision_reset_new_level } from '../js/vision.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { answerPrompts } from './support/input-boundaries.js';
import { createRoom } from './support/topology.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { addTrap, floorObjectsAt } from './support/level-state.js';
import { createMonsterAt, createSaddledSteed } from './support/monsters.js';
import { requireScreenRow } from './support/screen.js';
import { createStaffedShop } from './support/shop.js';

function departureRoom() {
    const levels = freshConnectedLevels();
    init_objects();
    vision_reset_new_level();
    vision_recalc(0);
    return levels.source;
}

async function pet(species = 'little dog', x = 11, y = 10) {
    const monster = await createMonsterAt(species, x, y, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    initializePet(monster);
    monster.msleeping = 0;
    return monster;
}

async function leash(monster: Monster) {
    const object = await addInventoryObject(LEASH, { leashmon: monster.m_id });
    monster.mleashed = 1;
    return object;
}

async function messageLine() {
    await flush_screen();
    return requireScreenRow(0).map(cell => cell.ch).join('').trimEnd();
}

void test('nearby tame and stalking monsters follow, including fleeing pets', async () => {
    const level = departureRoom();
    const companion = await pet();
    companion.mflee = 1;
    const pursuer = await createMonsterAt('watchman', 9, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    pursuer.msleeping = 0;
    const distant = await pet('kitten', 15, 10);

    const followers = await collectLevelFollowers();

    assert.ok(followers.includes(companion));
    assert.ok(followers.includes(pursuer));
    assert.ok(level.monsters.includes(distant));
    assert.equal(level.monsters.includes(companion), false);
    assert.equal(level.monsters.includes(pursuer), false);
});

for (const reason of ['asleep', 'paralyzed', 'waiting'] as const) {
    void test(`a pet stays on its level while ${reason}`, async () => {
        const level = departureRoom();
        const companion = await pet();
        if (reason === 'asleep') companion.msleeping = 1;
        if (reason === 'paralyzed') companion.mcanmove = 0;
        if (reason === 'waiting') companion.mstrategy = STRAT_WAITFORU;

        const followers = await collectLevelFollowers();

        assert.equal(followers.includes(companion), false);
        assert.ok(level.monsters.includes(companion));
    });
}

for (const heroHasAmulet of [false, true]) {
    void test(`a fleeing stalker ${heroHasAmulet ? 'pursues the Amulet' : 'stays behind'}`, async () => {
        const level = departureRoom();
        const stalker = await createMonsterAt('watchman', 11, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
        stalker.msleeping = 0;
        stalker.mflee = 1;
        game.u.uhave = { amulet: heroHasAmulet };

        const followers = await collectLevelFollowers();

        assert.equal(followers.includes(stalker), heroHasAmulet);
        assert.equal(level.monsters.includes(stalker), !heroHasAmulet);
    });
}

void test('a diagonal grid bug cannot follow across levels', async () => {
    const level = departureRoom();
    const bug = await pet('grid bug', 11, 11);

    const followers = await collectLevelFollowers();

    assert.equal(followers.includes(bug), false);
    assert.ok(level.monsters.includes(bug));
});

void test('a busy pet stays behind and its leash comes loose', async () => {
    const level = departureRoom();
    const companion = await pet();
    companion.meating = 5;
    const lead = await leash(companion);

    const followers = await collectLevelFollowers();

    assert.equal(followers.includes(companion), false);
    assert.ok(level.monsters.includes(companion));
    assert.equal(lead.leashmon, 0);
    assert.equal(companion.mleashed, 0);
    assert.equal(companion.meating, 5);
    assert.match(await messageLine(), /little dog is still eating\.  Its leash suddenly comes loose\./);
});

void test('an abandoned distant leash goes slack without reducing tameness', async () => {
    const level = departureRoom();
    const companion = await pet('little dog', 15, 10);
    const lead = await leash(companion);
    const tameness = companion.mtame;

    await collectLevelFollowers();

    assert.ok(level.monsters.includes(companion));
    assert.equal(lead.leashmon, 0);
    assert.equal(companion.mtame, tameness);
    assert.equal(await messageLine(), "The little dog's leash goes slack.");
});

void test('a pet makes a real trap escape attempt before following', async () => {
    const level = departureRoom();
    const companion = await pet('giant');
    addTrap(level, PIT, 11, 10, { tseen: true });
    companion.mtrapped = 1;

    const followers = await collectLevelFollowers();

    assert.ok(followers.includes(companion));
    assert.equal(companion.mtrapped, 0);
    assert.match(await messageLine(), /giant climbs easily out of the pit\./);
});

void test('an unsuccessful trap escape leaves a pet on the old level', async () => {
    const level = departureRoom();
    const companion = await pet();
    addTrap(level, BEAR_TRAP, 11, 10, { tseen: true });
    companion.mtrapped = 1;
    initRng(1n);

    const followers = await collectLevelFollowers();

    assert.equal(followers.includes(companion), false);
    assert.ok(level.monsters.includes(companion));
    assert.equal(companion.mtrapped, 1);
    assert.equal(await messageLine(), 'The little dog is still trapped.');
});

void test('carrying the Amulet disorients a follower and releases its leash', async () => {
    const level = departureRoom();
    const companion = await pet('kobold');
    const amulet = await knownObject(AMULET_OF_YENDOR);
    await addObjectToMonsterInventory(companion, amulet);
    const lead = await leash(companion);
    companion.female = true;
    setMonsterGivenName(companion, 'Ada');
    const input = resetInputState();

    const followers = await answerPrompts(collectLevelFollowers(), input, [{
        prompt: /Ada seems very disoriented for a moment\./, keys: ' ',
    }]);

    assert.equal(followers.includes(companion), false);
    assert.ok(level.monsters.includes(companion));
    assert.ok(companion.minvent.includes(amulet));
    assert.equal(lead.leashmon, 0);
    assert.equal(await messageLine(), 'Her leash suddenly comes loose.');
});

void test('an Amulet inside a carried container does not block following', async () => {
    departureRoom();
    const companion = await pet();
    const sack = await knownObject(SACK);
    const amulet = await knownObject(AMULET_OF_YENDOR);
    await addCreatedObjectToContainer(sack, amulet);
    await addObjectToMonsterInventory(companion, sack);

    const followers = await collectLevelFollowers();

    assert.ok(followers.includes(companion));
    assert.ok(sack.contents?.includes(amulet));
});

void test('a helpless steed follows and leaves its special objects behind', async () => {
    const level = departureRoom();
    const steed = await createSaddledSteed();
    game.u.usteed = steed;
    steed.mx = game.u.ux;
    steed.my = game.u.uy;
    steed.msleeping = 1;
    steed.mcanmove = 0;
    steed.meating = 8;
    steed.mtrapped = 1;
    addTrap(level, BEAR_TRAP, steed.mx, steed.my, { tseen: true });
    const amulet = await knownObject(AMULET_OF_YENDOR);
    await addObjectToMonsterInventory(steed, amulet);
    initRng(1n);

    const followers = await collectLevelFollowers();

    assert.ok(followers.includes(steed));
    assert.equal(steed.mtrapped, 0);
    assert.equal(steed.meating, 0);
    assert.equal(steed.msleeping, 1);
    assert.equal(steed.mcanmove, 0);
    assert.ok(floorObjectsAt(level, 10, 10).includes(amulet));
});

void test('departing followers clear shop no-charge marks throughout their inventory', async () => {
    departureRoom();
    const companion = await pet();
    const sack = await knownObject(SACK, { no_charge: true });
    const food = await knownObject(FOOD_RATION, { no_charge: true });
    await addCreatedObjectToContainer(sack, food);
    await addObjectToMonsterInventory(companion, sack);
    // These marks belong to the old shop level, not to the next floor.
    sack.no_charge = food.no_charge = true;

    await collectLevelFollowers();

    assert.equal(sack.no_charge, false);
    assert.equal(food.no_charge, false);
});

void test('stay-behind notices follow the native monster-list order', async () => {
    departureRoom();
    const first = await pet('little dog', 11, 10);
    const second = await pet('kitten', 9, 10);
    setMonsterGivenName(first, 'Alpha');
    setMonsterGivenName(second, 'Beta');
    first.meating = second.meating = 4;

    await collectLevelFollowers();

    assert.equal(await messageLine(), 'Beta is still eating.  Alpha is still eating.');
});

void test('a pursuing shopkeeper follows and clears the old shop resident', async () => {
    departureRoom();
    const { room, shopkeeper } = await createStaffedShop({ left: 11, right: 15, keeperX: 11 });
    shopkeeper.eshk.following = 1;

    const followers = await collectLevelFollowers();

    assert.ok(followers.includes(shopkeeper));
    assert.equal(room.resident, null);
});

void test('the distant Wizard pursues a hero carrying the Amulet', async () => {
    departureRoom();
    const wizard = await createMonsterAt('Wizard of Yendor', 15, 10,
        MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    wizard.msleeping = 0;
    game.u.uhave = { amulet: true };

    const followers = await collectLevelFollowers();

    assert.ok(followers.includes(wizard));
});

void test('a Wizard carrying the Amulet stays accessible at his old location', async () => {
    const level = departureRoom();
    const wizard = await createMonsterAt('Wizard of Yendor', 11, 10,
        MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    wizard.msleeping = 0;
    const amulet = await knownObject(AMULET_OF_YENDOR);
    await addObjectToMonsterInventory(wizard, amulet);

    const followers = await collectLevelFollowers();

    assert.equal(followers.includes(wizard), false);
    assert.equal(level.monsters.includes(wizard), false);
    assert.ok(wizard.minvent.includes(amulet));
    assert.equal(await deliverMigratingMonsters(), 1);
    assert.ok(level.monsters.includes(wizard));
    assert.equal(wizard.mx, 11);
    assert.equal(wizard.my, 10);
});

void test('a shopkeeper away from home stays accessible with an exact return square', async () => {
    const level = departureRoom();
    const { shopkeeper } = await createStaffedShop({ left: 12, right: 18, keeperX: 15 });
    shopkeeper.eshk.shoplevel = { dnum: 0, dlevel: 2 };

    const followers = await collectLevelFollowers();

    assert.equal(followers.includes(shopkeeper), false);
    assert.equal(level.monsters.includes(shopkeeper), false);
    assert.equal(await deliverMigratingMonsters(), 1);
    assert.ok(requireGameLevel().monsters.includes(shopkeeper));
    assert.equal(shopkeeper.mx, 15);
    assert.equal(shopkeeper.my, 10);
});

for (const role of ['priest', 'guard'] as const) {
    for (const awayFromHome of [false, true]) {
        void test(`a ${role} ${awayFromHome ? 'away from home remains accessible' : 'at home remains on the level'}`, async () => {
            const level = departureRoom();
            const resident = await createMonsterAt(role === 'priest' ? 'aligned cleric' : 'guard',
                15, 10, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
            const home = { dnum: 0, dlevel: awayFromHome ? 2 : 1 };
            if (role === 'priest') {
                resident.ispriest = 1;
                resident.epri = {
                    parentmid: resident.m_id, shroom: 0, shralign: 0,
                    shrpos: { x: 15, y: 10 }, shrlevel: home,
                    intone_time: 0, enter_time: 0, peaceful_time: 0, hostile_time: 0,
                };
            } else {
                resident.isgd = 1;
                resident._egd = {
                    gdlevel: home, gddone: 0, ogx: 15, ogy: 10, gdx: 16, gdy: 10,
                    vault: createRoom({ lx: 14, hx: 16, ly: 9, hy: 11, rtype: VAULT }),
                    warncnt: 0, fcbeg: 0, fcend: 0, fakecorr: [], dropgoldcnt: 0,
                };
            }

            const followers = await collectLevelFollowers();

            assert.equal(followers.includes(resident), false);
            assert.equal(level.monsters.includes(resident), !awayFromHome);
            assert.equal(await deliverMigratingMonsters(), awayFromHome ? 1 : 0);
            assert.ok(level.monsters.includes(resident));
            assert.equal(resident.mx, 15);
            assert.equal(resident.my, 10);
        });
    }
}
