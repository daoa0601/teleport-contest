import assert from 'node:assert/strict';
import test from 'node:test';
import { DB_LAVA, DB_MOAT, DRAWBRIDGE_UP, LAVAPOOL, M_AP_OBJECT, MM_NOGRP, MM_NOWAIT, NO_MINVENT, PIT, POOL, STONE, } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { monsterWouldConsumeItem } from '../js/monster_item_interest.js';
import { monsterCouldReachItem } from '../js/monster_item_reach.js';
import { searchMonsterItems } from '../js/monster_item_search.js';
import { placeMonsterAt } from '../js/monster_location.js';
import { placeMonsterWormTailRandomly } from '../js/monster_worm.js';
import { BOULDER, CORPSE, DAGGER, FOOD_RATION, GOLD_PIECE, ROCK, SCR_SCARE_MONSTER, TRIPE_RATION } from '../js/object_data.js';
import { initRng, rn2 } from '../js/rng.js';
import { makeBlinded } from '../js/sight_change.js';
import { monsterLearnsTrap } from '../js/trap_knowledge.js';
import { cansee, vision_note_blocker_change, vision_recalc } from '../js/vision.js';
import { floorObject, knownObject } from './support/game-objects.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
const BIRTH_FLAGS = MM_NOGRP | MM_NOWAIT | NO_MINVENT;
async function searchRoom(species = 'goblin') {
    const level = freshObjectRoom({ left: 5, right: 25, top: 5, bottom: 16,
        heroX: 20, heroY: 10, moves: 1000, gameplaySeed: 97n });
    requirePlayingGame(game);
    const state = game;
    const monster = await createMonsterAt(species, 10, 10, BIRTH_FLAGS);
    monster.mpeaceful = 0;
    monster.msleeping = 0;
    monster.mcanmove = 1;
    monster.mux = 20;
    monster.muy = 10;
    const search = (goal = { x: 20, y: 10 }, approach = 1) => searchMonsterItems(monster, state, { goal, approach, random: rn2 });
    return { monster, state, level, search };
}
void test('equally near items are chosen in native coordinate order rather than floor insertion order', async () => {
    const { search } = await searchRoom();
    await floorObject(DAGGER, 11, 9);
    await floorObject(DAGGER, 9, 11);
    const result = search();
    assert.deepEqual(result.goal, { x: 11, y: 9 });
    assert.equal(result.underfoot, null);
});
void test('a nearer item excludes later but more distant candidates', async () => {
    const { search } = await searchRoom();
    await floorObject(DAGGER, 11, 10);
    await floorObject(DAGGER, 14, 10);
    assert.deepEqual(search().goal, { x: 11, y: 10 });
});
void test('an underfoot item stops movement before the fleeing-goal adjustment', async () => {
    const { monster, search } = await searchRoom();
    monster.mux = 12;
    const item = await floorObject(DAGGER, 10, 10);
    const result = search({ x: 12, y: 10 }, -1);
    assert.equal(result.underfoot, item);
    assert.deepEqual(result.goal, { x: 10, y: 10 });
    assert.equal(result.approach, -1);
    assert.equal(item.where, 'floor');
});
void test('a nearby remembered hero shortens the hostile item search radius', async () => {
    const { monster, search } = await searchRoom();
    await floorObject(DAGGER, 15, 10);
    assert.deepEqual(search().goal, { x: 15, y: 10 });
    monster.mux = 12;
    assert.deepEqual(search().goal, { x: 20, y: 10 });
});
void test('hostile soldiers consider only adjacent items', async () => {
    const { search } = await searchRoom('soldier');
    await floorObject(DAGGER, 12, 10);
    assert.deepEqual(search().goal, { x: 20, y: 10 });
    await floorObject(DAGGER, 11, 10);
    assert.deepEqual(search().goal, { x: 11, y: 10 });
});
void test('finding a nearby item changes retreat into approach when the remembered hero is distant', async () => {
    const { search } = await searchRoom();
    await floorObject(DAGGER, 11, 10);
    const result = search({ x: 20, y: 10 }, -1);
    assert.deepEqual(result.goal, { x: 11, y: 10 });
    assert.equal(result.approach, 1);
});
void test('a close remembered hero remains the retreat goal even after an item is found', async () => {
    const { monster, search } = await searchRoom();
    monster.mux = 12;
    await floorObject(DAGGER, 9, 10);
    const result = search({ x: 12, y: 10 }, -1);
    assert.deepEqual(result.goal, { x: 12, y: 10 });
    assert.equal(result.approach, -1);
});
void test('item search preserves the distinct aklys stand-off approach mode', async () => {
    const { search } = await searchRoom();
    await floorObject(DAGGER, 11, 10);
    const result = search({ x: 20, y: 10 }, -2);
    assert.deepEqual(result.goal, { x: 11, y: 10 });
    assert.equal(result.approach, -2);
});
void test('a known trap cancels an incoming item goal and restores the remembered hero goal', async () => {
    const { monster, level, search } = await searchRoom();
    await floorObject(DAGGER, 11, 10);
    const trap = addTrap(level, PIT, 11, 10);
    monsterLearnsTrap(monster, trap);
    assert.deepEqual(search({ x: 11, y: 10 }).goal, { x: 20, y: 10 });
});
void test('scary floor protection rejects the whole nearby pile, including practical weapons', async () => {
    const { search } = await searchRoom();
    await floorObject(DAGGER, 11, 10);
    assert.deepEqual(search().goal, { x: 11, y: 10 });
    await floorObject(SCR_SCARE_MONSTER, 11, 10);
    assert.deepEqual(search().goal, { x: 20, y: 10 });
});
for (const condition of ['asleep', 'immobile', 'hidden', 'disguised', 'stationary species']) {
    void test(`items beneath an occupant which is ${condition} do not become pursuit goals`, async () => {
        const { search } = await searchRoom();
        const species = condition === 'stationary species' ? 'blue jelly'
            : condition === 'hidden' ? 'cave spider' : condition === 'disguised' ? 'small mimic' : 'orc';
        const occupant = await createMonsterAt(species, 11, 10, BIRTH_FLAGS);
        occupant.msleeping = condition === 'asleep' ? 1 : 0;
        occupant.mcanmove = condition === 'immobile' ? false : 1;
        if (condition === 'hidden')
            occupant.mundetected = 1;
        if (condition === 'disguised') {
            occupant.m_ap_type = M_AP_OBJECT;
            occupant.mappearance = DAGGER;
        }
        await floorObject(DAGGER, 11, 10);
        assert.deepEqual(search().goal, { x: 20, y: 10 });
    });
}
void test('the Wizard disguise does not prevent pursuing an item beneath him', async () => {
    const { search } = await searchRoom();
    const wizard = await createMonsterAt('Wizard of Yendor', 11, 10, BIRTH_FLAGS);
    wizard.msleeping = 0;
    wizard.mcanmove = 1;
    wizard.m_ap_type = M_AP_OBJECT;
    wizard.mappearance = DAGGER;
    await floorObject(DAGGER, 11, 10);
    assert.deepEqual(search().goal, { x: 11, y: 10 });
});
void test('a sleeping worm tail blocks interest in the item beneath that segment', async () => {
    const { state, search } = await searchRoom();
    const worm = await createMonsterAt('long worm', 13, 10, BIRTH_FLAGS);
    placeMonsterWormTailRandomly(worm, 2, { state });
    const segment = worm.wormSegments?.[0];
    assert.ok(segment, 'The open room must fit the real worm tail');
    worm.msleeping = 1;
    await floorObject(DAGGER, segment.x, segment.y);
    assert.deepEqual(search().goal, { x: 20, y: 10 });
});
void test('the searching actor is included in the underfoot occupancy check', async () => {
    const { monster, search } = await searchRoom();
    await floorObject(DAGGER, 10, 10);
    monster.msleeping = 1;
    const result = search();
    assert.equal(result.underfoot, null);
    assert.deepEqual(result.goal, { x: 20, y: 10 });
});
void test('a hiding pet avoids a meal in the hero sight but can seek it when the hero is blind', async () => {
    const { monster, state, search } = await searchRoom('cave spider');
    initializePet(monster, { state });
    await floorObject(TRIPE_RATION, 11, 10);
    assert.equal(cansee(11, 10), true, 'The sighted hero sees the meal in the lit room');
    assert.deepEqual(search().goal, { x: 20, y: 10 });
    await makeBlinded(10, { state, talk: false });
    assert.equal(cansee(11, 10), false, 'Blindness removes the meal from the hero sight');
    assert.deepEqual(search().goal, { x: 11, y: 10 });
});
void test('an attractive item behind a wall does not become the monster goal', async () => {
    const { level, search } = await searchRoom();
    await floorObject(DAGGER, 12, 10);
    assert.deepEqual(search().goal, { x: 12, y: 10 });
    level.requireAt(11, 10).typ = STONE;
    vision_note_blocker_change(11, 10);
    vision_recalc(0);
    assert.deepEqual(search().goal, { x: 20, y: 10 });
});
void test('search ignores ordinary rocks and protects both unclaimed level prizes', async () => {
    const { state, search } = await searchRoom();
    await floorObject(ROCK, 11, 10);
    const mines = await floorObject(DAGGER, 11, 11);
    const sokoban = await floorObject(DAGGER, 12, 10);
    state.context.achieveo = { mines_prize_oid: mines.o_id, soko_prize_oid: sokoban.o_id };
    assert.deepEqual(search().goal, { x: 20, y: 10 });
});
void test('shop stock is excluded while an explicitly uncharged floor object remains eligible', async () => {
    const { monster, search } = await searchRoom();
    placeMonsterAt(monster, 6, 10);
    await createStaffedShop({ left: 8, right: 14, top: 8, bottom: 12, keeperX: 14, keeperY: 12 });
    const dagger = await floorObject(DAGGER, 10, 10);
    assert.deepEqual(search().goal, { x: 20, y: 10 });
    dagger.no_charge = true;
    assert.deepEqual(search().goal, { x: 10, y: 10 });
});
void test('shop visitors sometimes search available goods while the resident always skips searching', async () => {
    const { monster, state, search } = await searchRoom();
    const { shopkeeper } = await createStaffedShop({ left: 8, right: 14, top: 8, bottom: 12,
        keeperX: 14, keeperY: 12 });
    await floorObject(DAGGER, 11, 10, { no_charge: true });
    shopkeeper.mux = monster.mux;
    shopkeeper.muy = monster.muy;
    const trials = 128;
    let searched = 0;
    let skipped = 0;
    for (let seed = 0; seed < trials; seed++) {
        initRng(BigInt(seed));
        const result = search();
        if (result.goal.x === 11)
            searched++;
        if (result.goal.x === 20)
            skipped++;
        const resident = searchMonsterItems(shopkeeper, state, {
            goal: { x: 20, y: 10 }, approach: 1, random: rn2,
        });
        assert.deepEqual(resident.goal, { x: 20, y: 10 });
    }
    assert.ok(searched > 0, 'A seeded visitor must exercise the native occasional shop search');
    // Native search succeeds only 1/25 of the time. This broad band allows
    // sampling variation while rejecting a frequent-search rule such as 1/2.
    assert.ok(searched <= trials / 8, `Expected rare shop searches near 1/25, but searched on ${searched} of ${trials} trials`);
    assert.equal(searched + skipped, trials, 'Every trial must either search or retain the pursuit goal');
});
void test('an overloaded corpse eater still pursues a safe meal without being able to carry it', async () => {
    const { monster, search } = await searchRoom('purple worm');
    await addObjectToMonsterInventory(monster, await knownObject(GOLD_PIECE, { quantity: 500000 }));
    await floorObject(CORPSE, 11, 10, { corpsenm: MONSTER_NAME.indexOf('newt') });
    assert.deepEqual(search().goal, { x: 11, y: 10 });
});
void test('the safe-touch gate still excludes Rider corpses accepted by corpse-eater appetite', async () => {
    const { search } = await searchRoom('purple worm');
    await floorObject(CORPSE, 11, 10, { corpsenm: MONSTER_NAME.indexOf('Death') });
    assert.deepEqual(search().goal, { x: 20, y: 10 });
});
void test('a pet can choose cursed preferred food without trying to carry it', async () => {
    const { monster, state, search } = await searchRoom('little dog');
    initializePet(monster, { state });
    await floorObject(TRIPE_RATION, 11, 10, { cursed: true });
    assert.deepEqual(search().goal, { x: 11, y: 10 });
});
void test('merely acceptable pet food requires the native hunger deadline, preferred food does not', async () => {
    const { monster, state } = await searchRoom('little dog');
    initializePet(monster, { state });
    const pet = monster.edog;
    assert.ok(pet);
    pet.hungrytime = state.moves + 1;
    const ration = await knownObject(FOOD_RATION);
    const tripe = await knownObject(TRIPE_RATION);
    assert.equal(monsterWouldConsumeItem(monster, ration, state, rn2), false);
    assert.equal(monsterWouldConsumeItem(monster, tripe, state, rn2), true);
    pet.hungrytime = state.moves;
    assert.equal(monsterWouldConsumeItem(monster, ration, state, rn2), true);
});
for (const { species, terrain, allowed } of [
    { species: 'air elemental', terrain: POOL, allowed: false },
    { species: 'water nymph', terrain: POOL, allowed: true },
    { species: 'red dragon', terrain: LAVAPOOL, allowed: false },
    { species: 'salamander', terrain: LAVAPOOL, allowed: true },
]) {
    void test(`${species} ${allowed ? 'can' : 'cannot'} reach objects below ${terrain === POOL ? 'water' : 'lava'}`, async () => {
        const { monster, state, level } = await searchRoom(species);
        level.requireAt(11, 10).typ = terrain;
        assert.equal(monsterCouldReachItem(monster, 11, 10, state), allowed);
    });
}
void test('item reachability accounts for water and lava beneath a raised drawbridge', async () => {
    const { monster, state, level } = await searchRoom();
    const bridge = level.requireAt(11, 10);
    bridge.typ = DRAWBRIDGE_UP;
    bridge.drawbridgemask = DB_MOAT;
    assert.equal(monsterCouldReachItem(monster, 11, 10, state), false);
    bridge.drawbridgemask = DB_LAVA;
    assert.equal(monsterCouldReachItem(monster, 11, 10, state), false);
});
void test('a boulder hides floor items from ordinary monsters but not rock throwers', async () => {
    const { monster, state } = await searchRoom();
    const giant = await createMonsterAt('stone giant', 12, 10, BIRTH_FLAGS);
    await floorObject(BOULDER, 11, 10);
    assert.equal(monsterCouldReachItem(monster, 11, 10, state), false);
    assert.equal(monsterCouldReachItem(giant, 11, 10, state), true);
});
//# sourceMappingURL=monster_item_search.test.js.map