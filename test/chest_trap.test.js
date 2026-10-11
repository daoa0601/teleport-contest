import { floorObjectsAt } from './support/level-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { triggerChestTrap } from '../js/chest_trap.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { AMULET_OF_YENDOR, CHEST, CLUB, RIN_FREE_ACTION, ROCK } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { heroIsHallucinating } from '../js/senses.js';
import { addInventoryObject, floorObject, knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshPlayableRoom } from './support/playable-room.js';
function randomValues(...values) {
    return (range) => {
        const value = values.shift();
        assert.ok(value !== undefined, `missing random value for rn2(${range})`);
        assert.ok(value >= 0 && value < range, `${value} is outside rn2(${range})`);
        return value;
    };
}
function messageCollector() {
    const messages = [];
    return {
        messages,
        publish: async (message) => {
            messages.push(message);
        },
    };
}
function freshTrapRoom(options) {
    const level = freshPlayableRoom(options);
    requirePlayingGame(game);
    initRng(7301n);
    return level;
}
void test('luck can discharge a trapped chest without harming the hero', async () => {
    freshTrapRoom({ hero: { uluck: 0, uhp: 40, uhpmax: 40 } });
    requirePlayingGame(game);
    const chest = await addInventoryObject(CHEST, {
        invlet: 'a',
        otrapped: true,
    });
    const output = messageCollector();
    const result = await triggerChestTrap(chest, {
        random: randomValues(8, 11),
        publish: output.publish,
    });
    assert.ok(result);
    assert.equal(result.outcome, 'luck-save');
    assert.equal(game.u.uhp, 40);
    assert.equal(chest.otrapped, false);
    assert.equal(chest.tknown, true);
    assert.deepEqual(output.messages, [
        'You trigger a trap!',
        'But luckily the explosive charge is a dud!',
    ]);
});
void test('a floor chest explosion destroys ordinary objects and wakes monsters', async () => {
    freshTrapRoom({
        hero: { uluck: 0, ulevel: 5, uhp: 100, uhpmax: 100 },
    });
    requirePlayingGame(game);
    const chest = await floorObject(CHEST, 10, 10, { otrapped: true });
    const contents = await knownObject(CLUB, {
        where: 'contained',
        container: chest,
    });
    chest.contents = [contents];
    const rock = await floorObject(ROCK, 10, 10);
    const amulet = await floorObject(AMULET_OF_YENDOR, 10, 10);
    const sleeper = await createMonsterAt('jackal', 12, 10);
    sleeper.msleeping = 1;
    const output = messageCollector();
    const result = await triggerChestTrap(chest, {
        random: randomValues(0, 0, 21),
        rollDice: () => 12,
        publish: output.publish,
    });
    assert.ok(result);
    assert.equal(result.outcome, 'explosion');
    assert.equal(result.destroyed, true);
    assert.equal(game.u.uhp, 88);
    assert.equal(chest.where, 'gone');
    assert.equal(contents.where, 'gone');
    assert.equal(rock.where, 'gone');
    assert.equal(floorObjectsAt(requireGameLevel(), 10, 10).includes(amulet), true);
    assert.equal(sleeper.msleeping, 0);
});
void test('a carried trapped chest survives its explosion but loses its contents', async () => {
    freshTrapRoom({ hero: { uluck: 0, uhp: 60, uhpmax: 60 } });
    requirePlayingGame(game);
    const chest = await addInventoryObject(CHEST, {
        invlet: 'a',
        otrapped: true,
    });
    const club = await knownObject(CLUB, {
        invlet: 'b',
        where: 'contained',
        container: chest,
    });
    chest.contents = [club];
    const result = await triggerChestTrap(chest, {
        random: randomValues(0, 0, 21),
        rollDice: () => 9,
        publish: async () => { },
    });
    assert.ok(result);
    assert.equal(result.destroyed, false);
    assert.equal(game.inventory.includes(chest), true);
    assert.deepEqual(chest.contents, []);
    assert.equal(club.where, 'gone');
    assert.equal(chest.tknown, true);
    assert.equal(game.u.uhp, 51);
});
void test('free action prevents a chest trap from paralyzing the hero', async () => {
    freshTrapRoom({ hero: { uluck: 0 } });
    requirePlayingGame(game);
    const chest = await addInventoryObject(CHEST, {
        invlet: 'a',
        otrapped: true,
    });
    const ring = await addInventoryObject(RIN_FREE_ACTION, {
        invlet: 'b',
        worn: true,
    });
    game.uleft = game.u.uleft = ring;
    const result = await triggerChestTrap(chest, {
        random: randomValues(0, 1, 3),
        rollDice: () => {
            throw new Error('free action must prevent the paralysis roll');
        },
        publish: async () => { },
    });
    assert.ok(result);
    assert.equal(result.outcome, 'paralysis');
    assert.ok('duration' in result);
    assert.equal(result.duration, 0);
    assert.equal(game._helplessTurns, undefined);
});
void test('poison resistance blocks a trapped chest needle', async () => {
    freshTrapRoom({
        hero: {
            uluck: 0,
            uhp: 40,
            uhpmax: 40,
            poisonResistance: true,
        },
    });
    requirePlayingGame(game);
    const chest = await addInventoryObject(CHEST, {
        invlet: 'a',
        otrapped: true,
    });
    const result = await triggerChestTrap(chest, {
        random: randomValues(0, 0, 13),
        publish: async () => { },
    });
    assert.ok(result);
    assert.equal(result.outcome, 'poisoned-needle');
    assert.equal(game.u.uhp, 40);
    assert.equal(chest.tknown, true);
});
void test('a noxious chest trap can leave a live poison cloud', async () => {
    freshTrapRoom({ hero: { uluck: 0 } });
    requirePlayingGame(game);
    const chest = await floorObject(CHEST, 10, 10, { otrapped: true });
    const result = await triggerChestTrap(chest, {
        random: randomValues(0, 0, 17, 0, 1),
        publish: async () => { },
    });
    assert.ok(result);
    assert.equal(result.outcome, 'noxious-gas');
    assert.deepEqual(requireGameLevel().regions.map((region) => ({
        damage: region.damage,
        ttl: region.ttl,
        cells: region.cells,
    })), [{ damage: 8, ttl: 5, cells: [{ x: 10, y: 10 }] }]);
});
void test('shock resistance blocks direct chest-trap electrical damage', async () => {
    freshTrapRoom({
        hero: {
            uluck: 0,
            uhp: 40,
            uhpmax: 40,
            shockResistance: true,
        },
    });
    requirePlayingGame(game);
    const chest = await addInventoryObject(CHEST, {
        invlet: 'a',
        otrapped: true,
    });
    const result = await triggerChestTrap(chest, {
        random: randomValues(0, 0, 6, 0),
        rollDice: () => 8,
        publish: async () => { },
    });
    assert.ok(result);
    assert.equal(result.outcome, 'electric-shock');
    assert.ok('damage' in result);
    assert.equal(result.damage, 0);
    assert.equal(game.u.uhp, 40);
});
void test('colored gas stuns the hero while hallucination resistance stays active', async () => {
    freshTrapRoom({
        hero: { uluck: 0, hallucinationResistance: true },
    });
    requirePlayingGame(game);
    const chest = await addInventoryObject(CHEST, {
        invlet: 'a',
        otrapped: true,
    });
    const result = await triggerChestTrap(chest, {
        random: randomValues(0, 1, 0, 2, 4, 3),
        publish: async () => { },
    });
    assert.ok(result);
    assert.equal(result.outcome, 'stunning-gas');
    assert.equal(game.u.stunnedTurns, 20);
    assert.equal(game.u.hallucinationTurns, 19);
    assert.equal(heroIsHallucinating(), false);
});
//# sourceMappingURL=chest_trap.test.js.map