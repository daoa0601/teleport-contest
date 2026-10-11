import test from 'node:test';
import assert from 'node:assert/strict';
import { G_GENOD, MM_NOGRP, NO_MINVENT, W_AMUL } from '../js/const.js';
import { flush_screen, plineWithContinuation } from '../js/display.js';
import { initializePet } from '../js/dog.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { consumeMonsterFloorObjects } from '../js/monster_floor_consumption.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { changeMonsterForm } from '../js/monster_polymorph.js';
import { AMULET_OF_LIFE_SAVING, AMULET_OF_STRANGULATION, BOULDER, CORPSE, DAGGER, EGG, FOOD_RATION, GLOB_OF_GREEN_SLIME, GOLD_PIECE, OBJECT_WEIGHT, RIN_SLOW_DIGESTION, ROCK, SACK, SCR_IDENTIFY, SCR_SCARE_MONSTER, STATUE, TIN, } from '../js/object_data.js';
import { addCreatedObjectToContainer } from '../js/object_container.js';
import { initRng } from '../js/rng.js';
import { floorObject, knownObject } from './support/game-objects.js';
import { floorObjectsAt } from './support/level-state.js';
import { createMonsterAt, equipMonsterObject, requireMonsterVital } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
function mealRoom(verbose = false) {
    freshObjectRoom({ flags: { verbose }, gameplaySeed: 7831n });
    requirePlayingGame(game);
    return game;
}
async function eater(species) {
    return await createMonsterAt(species, 11, 10, MM_NOGRP | NO_MINVENT);
}
async function visibleMessage() {
    await flush_screen();
    return requireGameDisplay().grid[0]?.map(cell => cell.ch).join('').trimEnd() ?? '';
}
for (const species of ['xorn', 'gelatinous cube', 'purple worm']) {
    void test(`the floor-consumption owner leaves a tame ${species}'s meal to pet feeding`, async () => {
        const state = mealRoom();
        const monster = await eater(species);
        initializePet(monster);
        const food = await floorObject(CORPSE, 11, 10, { corpsenm: MONSTER_NAME.indexOf('newt') });
        const dagger = await floorObject(DAGGER, 11, 10);
        const result = await consumeMonsterFloorObjects(monster, state, {
            originalSpecies: monster.mnum, random: limit => limit - 1,
        });
        assert.equal(result.nativeResult, 0);
        assert.equal(food.where, 'floor');
        assert.equal(dagger.where, 'floor');
        assert.equal(monster.meating ?? 0, 0);
    });
}
void test('a metal eater consumes a whole stack, heals by the item type weight, and delays by stack weight', async () => {
    const state = mealRoom();
    const monster = await eater('xorn');
    monster.mhp = 1;
    monster.mhpmax = 100;
    const daggers = await floorObject(DAGGER, 11, 10, { quan: 3 });
    const weight = daggers.owt;
    const result = await consumeMonsterFloorObjects(monster, state, {
        originalSpecies: monster.mnum, random: limit => limit - 1, rollOne: () => 25,
    });
    assert.equal(result.nativeResult, 1);
    assert.equal(daggers.where, 'gone');
    assert.equal(monster.mhp, 1 + (OBJECT_WEIGHT[DAGGER] ?? 0));
    assert.equal(monster.meating, Math.trunc(weight / 2) + 1);
    assert.equal(floorObjectsAt(state.level, 11, 10).length, 0);
});
void test('a rust monster strips rustproofing and continues to a later edible item', async () => {
    const state = mealRoom();
    const monster = await eater('rust monster');
    const food = await floorObject(DAGGER, 11, 10);
    const dagger = await floorObject(DAGGER, 11, 10, { oerodeproof: true });
    const result = await consumeMonsterFloorObjects(monster, state, {
        originalSpecies: monster.mnum, random: limit => limit - 1, rollOne: () => 25,
    });
    assert.equal(result.nativeResult, 1);
    assert.equal(dagger.where, 'floor');
    assert.equal(dagger.oerodeproof, false);
    assert.equal(monster.mstun, 1);
    assert.equal(food.where, 'gone');
});
void test('a rust monster leaves unsuitable metals, choking jewelry, and poisoned weapons alone', async () => {
    const state = mealRoom();
    const monster = await eater('rust monster');
    const gold = await floorObject(GOLD_PIECE, 11, 10);
    const amulet = await floorObject(AMULET_OF_STRANGULATION, 11, 10);
    const ring = await floorObject(RIN_SLOW_DIGESTION, 11, 10);
    const poison = await floorObject(DAGGER, 11, 10, { opoisoned: true });
    const result = await consumeMonsterFloorObjects(monster, state, {
        originalSpecies: monster.mnum, random: limit => limit - 1,
    });
    assert.equal(result.nativeResult, 0);
    for (const object of [gold, amulet, ring, poison])
        assert.equal(object.where, 'floor');
    assert.equal(monster.meating ?? 0, 0);
});
void test('a metal meal can leave an actual generated pile of rocks', async () => {
    const state = mealRoom();
    const monster = await eater('xorn');
    const coins = await floorObject(GOLD_PIECE, 11, 10, { quan: 200 });
    await consumeMonsterFloorObjects(monster, state, {
        originalSpecies: monster.mnum, random: limit => limit - 1, rollOne: () => 1,
    });
    const rocks = floorObjectsAt(state.level, 11, 10);
    assert.equal(coins.where, 'gone');
    assert.equal(rocks.length, 1);
    assert.equal(rocks[0]?.otyp, ROCK);
    assert.equal(rocks[0]?.where, 'floor');
    assert.ok((rocks[0]?.quan ?? 0) > 0);
});
void test('a cube eats organic objects instantly and carries the contents of its eaten container', async () => {
    const state = mealRoom();
    const monster = await eater('gelatinous cube');
    const food = await floorObject(FOOD_RATION, 11, 10, { quan: 2 });
    const sack = await floorObject(SACK, 11, 10);
    const rock = await knownObject(ROCK);
    await addCreatedObjectToContainer(sack, rock);
    const dagger = await floorObject(DAGGER, 11, 10);
    const result = await consumeMonsterFloorObjects(monster, state, {
        originalSpecies: monster.mnum, random: limit => limit - 1,
    });
    assert.equal(result.nativeResult, 1);
    assert.equal(sack.where, 'gone');
    assert.equal(food.where, 'gone');
    for (const object of [rock, dagger]) {
        assert.equal(object.where, 'minvent');
        assert.equal(object.carrierMid, monster.m_id);
        assert.ok(monster.minvent.includes(object));
    }
    assert.equal(monster.meating ?? 0, 0);
    assert.equal(floorObjectsAt(state.level, 11, 10).length, 0);
});
void test('a cube digests petrifying flesh but preserves prizes and engulfs slime', async () => {
    const state = mealRoom();
    const monster = await eater('gelatinous cube');
    const boulder = await floorObject(BOULDER, 11, 10);
    const scare = await floorObject(SCR_SCARE_MONSTER, 11, 10);
    const corpse = await floorObject(CORPSE, 11, 10, { corpsenm: MONSTER_NAME.indexOf('cockatrice') });
    const prize = await floorObject(FOOD_RATION, 11, 10);
    state.context.achieveo = { mines_prize_oid: prize.o_id };
    const egg = await floorObject(EGG, 11, 10, { corpsenm: MONSTER_NAME.indexOf('cockatrice') });
    const slime = await floorObject(GLOB_OF_GREEN_SLIME, 11, 10);
    await consumeMonsterFloorObjects(monster, state, {
        originalSpecies: monster.mnum, random: limit => limit - 1,
    });
    for (const object of [boulder, scare, prize])
        assert.equal(object.where, 'floor', `Protected floor object ${object.otyp} was removed`);
    assert.equal(corpse.where, 'gone');
    assert.equal(egg.where, 'gone');
    assert.equal(slime.where, 'minvent');
    assert.ok(monster.minvent.includes(slime));
    assert.equal(monster.mnum, MONSTER_NAME.indexOf('gelatinous cube'));
    assert.equal(!!monster.dead, false);
});
void test('a cube changed before item handling leaves a dangerous corpse but engulfs its egg', async () => {
    const state = mealRoom();
    const monster = await eater('gelatinous cube');
    const originalSpecies = monster.mnum;
    await changeMonsterForm(monster, MONSTER_NAME.indexOf('rock mole'), state);
    const corpse = await floorObject(CORPSE, 11, 10, { corpsenm: MONSTER_NAME.indexOf('cockatrice') });
    const egg = await floorObject(EGG, 11, 10, { corpsenm: MONSTER_NAME.indexOf('cockatrice') });
    await consumeMonsterFloorObjects(monster, state, {
        originalSpecies, random: limit => limit - 1,
    });
    assert.equal(corpse.where, 'floor');
    assert.equal(egg.where, 'minvent');
    assert.ok(monster.minvent.includes(egg));
    assert.equal(monster.mnum, MONSTER_NAME.indexOf('rock mole'));
    assert.ok(monster.mhp > 0);
});
void test('an organic object which resists digestion remains intact in a cube inventory', async () => {
    const state = mealRoom();
    const monster = await eater('gelatinous cube');
    const sack = await floorObject(SACK, 11, 10);
    const ration = await knownObject(FOOD_RATION);
    await addCreatedObjectToContainer(sack, ration);
    await consumeMonsterFloorObjects(monster, state, {
        originalSpecies: monster.mnum, random: () => 0,
    });
    assert.equal(sack.where, 'minvent');
    assert.equal(ration.where, 'contained');
    assert.equal(ration.container, sack);
    assert.equal(sack.contents?.length, 1);
});
void test('a corpse eater skips vegetable and petrifying bodies and eats only one unit', async () => {
    const state = mealRoom();
    const monster = await eater('purple worm');
    const meat = await floorObject(CORPSE, 11, 10, { corpsenm: MONSTER_NAME.indexOf('newt'), quan: 3 });
    const lichen = await floorObject(CORPSE, 11, 10, { corpsenm: MONSTER_NAME.indexOf('lichen') });
    const cockatrice = await floorObject(CORPSE, 11, 10, { corpsenm: MONSTER_NAME.indexOf('cockatrice') });
    const result = await consumeMonsterFloorObjects(monster, state, { originalSpecies: monster.mnum });
    assert.equal(result.nativeResult, 1);
    assert.equal(meat.quan, 2);
    assert.equal(meat.where, 'floor');
    assert.equal(lichen.where, 'floor');
    assert.equal(cockatrice.where, 'floor');
    assert.equal(monster.meating ?? 0, 0);
    assert.equal(floorObjectsAt(state.level, 11, 10).length, 3);
});
void test('a corpse eater revives a Rider instead of consuming it or the next corpse', async () => {
    const state = mealRoom();
    const monster = await eater('purple worm');
    const meat = await floorObject(CORPSE, 11, 10, { corpsenm: MONSTER_NAME.indexOf('newt') });
    const rider = await floorObject(CORPSE, 11, 10, { corpsenm: MONSTER_NAME.indexOf('Death') });
    const result = await consumeMonsterFloorObjects(monster, state, { originalSpecies: monster.mnum });
    assert.equal(result.nativeResult, 0);
    assert.equal(rider.where, 'gone');
    assert.equal(meat.where, 'floor');
    assert.ok(state.level.monsters.some(actor => actor.mnum === MONSTER_NAME.indexOf('Death') && actor.mhp > 0));
});
void test('a cube stops eating the pile when a corpse changes its species', async () => {
    const state = mealRoom();
    const monster = await eater('gelatinous cube');
    const ration = await floorObject(FOOD_RATION, 11, 10);
    const corpse = await floorObject(CORPSE, 11, 10, { corpsenm: MONSTER_NAME.indexOf('chameleon') });
    const originalSpecies = monster.mnum;
    initRng(18803n);
    const result = await consumeMonsterFloorObjects(monster, state, {
        originalSpecies, random: limit => limit - 1,
    });
    assert.equal(result.nativeResult, 1);
    assert.notEqual(monster.mnum, originalSpecies);
    assert.equal(corpse.where, 'gone');
    assert.equal(ration.where, 'floor');
});
void test('post-move eating uses the original species while container handling uses the new body', async () => {
    const state = mealRoom();
    const monster = await eater('gelatinous cube');
    const originalSpecies = monster.mnum;
    await changeMonsterForm(monster, MONSTER_NAME.indexOf('rock mole'), state);
    const sack = await floorObject(SACK, 11, 10);
    const rock = await knownObject(ROCK);
    await addCreatedObjectToContainer(sack, rock);
    const result = await consumeMonsterFloorObjects(monster, state, {
        originalSpecies, random: limit => limit - 1,
    });
    assert.equal(result.nativeResult, 1);
    assert.equal(sack.where, 'gone');
    assert.equal(rock.where, 'floor');
    assert.ok(floorObjectsAt(state.level, 11, 10).includes(rock));
    assert.equal(monster.minvent.includes(rock), false);
});
void test('a wraith corpse can grow a baby worm into a genocided adult and end item handling', async () => {
    const state = mealRoom();
    const monster = await eater('baby purple worm');
    monster.m_lev = 14;
    const adult = MONSTER_NAME.indexOf('purple worm');
    requireMonsterVital(adult).mvflags |= G_GENOD;
    const meat = await floorObject(CORPSE, 11, 10, { corpsenm: MONSTER_NAME.indexOf('newt') });
    const wraith = await floorObject(CORPSE, 11, 10, { corpsenm: MONSTER_NAME.indexOf('wraith') });
    const input = resetInputState();
    installPagerInput(input, { expected: /purple worm|expires|dies/, limit: 2 });
    const result = await consumeMonsterFloorObjects(monster, state, {
        originalSpecies: monster.mnum, rollOne: () => 8,
    });
    assert.equal(result.nativeResult, 2);
    assert.equal(result.died, true);
    assert.equal(wraith.where, 'gone');
    assert.equal(meat.where, 'floor');
    assert.equal(state.level.monsters.includes(monster), false);
});
void test('eating petrifying tin immediately stones a metal eater without slowing it first', async () => {
    const state = mealRoom();
    const monster = await eater('rock mole');
    const food = await floorObject(TIN, 11, 10, { corpsenm: MONSTER_NAME.indexOf('Medusa') });
    const result = await consumeMonsterFloorObjects(monster, state, {
        originalSpecies: monster.mnum, random: limit => limit - 1,
    });
    assert.equal(result.nativeResult, 2);
    assert.equal(food.where, 'gone');
    const statue = floorObjectsAt(state.level, 11, 10).find(object => object.otyp === STATUE);
    assert.ok(statue);
    assert.equal(statue.corpsenm, MONSTER_NAME.indexOf('rock mole'));
    assert.equal(statue.contents?.some(object => object.otyp === TIN) ?? false, false);
    assert.equal(await visibleMessage(), 'The rock mole turns to stone!');
});
void test('life saving lets a metal eater survive its petrifying meal without losing speed', async () => {
    const state = mealRoom();
    const monster = await eater('rock mole');
    const amulet = await knownObject(AMULET_OF_LIFE_SAVING);
    await equipMonsterObject(monster, amulet, W_AMUL);
    const food = await floorObject(TIN, 11, 10, { corpsenm: MONSTER_NAME.indexOf('Medusa') });
    const speed = monster.mspeed;
    const input = resetInputState();
    installPagerInput(input, { expected: /turns to stone!|But wait|medallion|looks much better/, limit: 4 });
    const result = await consumeMonsterFloorObjects(monster, state, {
        originalSpecies: monster.mnum, random: limit => limit - 1, rollOne: () => 25,
    });
    assert.equal(result.nativeResult, 1);
    assert.equal(result.died, false);
    assert.ok(monster.mhp > 0);
    assert.equal(monster.mspeed, speed);
    assert.equal(amulet.where, 'gone');
    assert.equal(food.where, 'gone');
    assert.equal(floorObjectsAt(state.level, 11, 10).some(object => object.otyp === STATUE), false);
});
void test('petrifying food turns a golem into stone even though that body resists petrification', async () => {
    const state = mealRoom();
    const monster = await eater('xorn');
    const originalSpecies = monster.mnum;
    await changeMonsterForm(monster, MONSTER_NAME.indexOf('iron golem'), state);
    const food = await floorObject(TIN, 11, 10, { corpsenm: MONSTER_NAME.indexOf('Medusa') });
    const input = resetInputState();
    installPagerInput(input, { expected: /solidifies|Now it's a stone golem/, limit: 1 });
    const result = await consumeMonsterFloorObjects(monster, state, {
        originalSpecies, random: limit => limit - 1, rollOne: () => 25,
    });
    assert.equal(result.nativeResult, 1);
    assert.equal(monster.mnum, MONSTER_NAME.indexOf('stone golem'));
    assert.ok(monster.mhp > 0);
    assert.equal(food.where, 'gone');
    assert.equal(floorObjectsAt(state.level, 11, 10).some(object => object.otyp === STATUE), false);
});
void test('a nurse corpse heals a wounded corpse eater and restores its sight', async () => {
    const state = mealRoom();
    const monster = await eater('purple worm');
    monster.mhp = 1;
    monster.mhpmax = 100;
    monster.mcansee = 0;
    monster.mblinded = 40;
    const corpse = await floorObject(CORPSE, 11, 10, { corpsenm: MONSTER_NAME.indexOf('nurse') });
    const input = resetInputState();
    installPagerInput(input, { expected: /can see again|looks healthy/, limit: 1 });
    await consumeMonsterFloorObjects(monster, state, { originalSpecies: monster.mnum });
    assert.equal(corpse.where, 'gone');
    assert.equal(monster.mhp, 100);
    assert.equal(monster.mcansee, 1);
    assert.equal(monster.mblinded, 0);
});
void test('meal input is acknowledged before the object leaves its floor pile', async () => {
    const state = mealRoom(true);
    const monster = await eater('xorn');
    const dagger = await floorObject(DAGGER, 11, 10, { spe: 0 });
    const input = resetInputState();
    let acknowledged = false;
    input.display = {
        async readKey() {
            assert.equal(acknowledged, false, 'Eating should need only the previous warning acknowledged');
            const screen = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            assert.match(screen, /An ominous warning echoes along the dark corridor\.[\s\S]*--More--/);
            assert.equal(dagger.where, 'floor');
            assert.ok(floorObjectsAt(state.level, 11, 10).includes(dagger));
            acknowledged = true;
            return ' '.charCodeAt(0);
        },
    };
    await plineWithContinuation('An ominous warning echoes along the dark corridor.');
    await consumeMonsterFloorObjects(monster, state, {
        originalSpecies: monster.mnum, random: limit => limit - 1, rollOne: () => 25,
    });
    assert.equal(acknowledged, true);
    assert.equal(dagger.where, 'gone');
    assert.equal(await visibleMessage(), 'The xorn eats a +0 dagger!');
});
void test('a quiet cube still enjoys a scroll whose shuffled label says YUM YUM', async () => {
    const state = mealRoom();
    const monster = await eater('gelatinous cube');
    assert.ok(state.objectDescriptions);
    state.objectDescriptions[SCR_IDENTIFY] = 'YUM YUM';
    const scroll = await floorObject(SCR_IDENTIFY, 11, 10, { blessed: true });
    await consumeMonsterFloorObjects(monster, state, {
        originalSpecies: monster.mnum, random: limit => limit - 1,
    });
    assert.equal(scroll.where, 'gone');
    assert.equal(await visibleMessage(), 'Yum!');
});
//# sourceMappingURL=monster_floor_consumption.test.js.map