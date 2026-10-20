import test from 'node:test';
import assert from 'node:assert/strict';
import { ROCKTRAP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resumeDeferredMonsterTrap, triggerImmediateMonsterTrap, } from '../js/monmove.js';
import { ROCK, SADDLE } from '../js/object_data.js';
import { performMonsterTurn } from '../js/allmain.js';
import { glyphAt, newsym } from '../js/display.js';
import { initializePet } from '../js/dog.js';
import { pushKeys } from '../js/input.js';
import { pickUpMonsterFloorObject } from '../js/monster_pickup.js';
import { floorObject } from './support/game-objects.js';
import { floorObjectsAt } from './support/level-state.js';
import { freshMonsterTrapRoom } from './support/monster-traps.js';
void test('a visible falling rock joins known rocks before the monster picks up the stack', async () => {
    const { level, monster } = await freshMonsterTrapRoom(ROCKTRAP, {
        gameplaySeed: 23n, monster: { species: 'giant' },
    });
    requirePlayingGame(game);
    game.flags.verbose = true;
    await floorObject(ROCK, 11, 10, { quan: 7, known: false, typeKnown: false });
    const messages = [];
    const action = await triggerImmediateMonsterTrap(monster, game);
    await resumeDeferredMonsterTrap(action, game, {
        publish: async (message) => { messages.push(message); },
    });
    const pile = floorObjectsAt(level, 11, 10).filter(object => object.otyp === ROCK);
    assert.equal(pile.length, 1);
    assert.equal(pile[0]?.quan, 8);
    assert.equal(await pickUpMonsterFloorObject(monster, game), true);
    assert.match(game._pending_message, /picks up 8 (?:uncursed )?rocks\./);
    assert.equal(monster.minvent.find(object => object.otyp === ROCK)?.quan, 8);
});
void test('a falling-rock trap hits a visible monster and drops its rock', async () => {
    const { level, monster, trap } = await freshMonsterTrapRoom(ROCKTRAP, {
        gameplaySeed: 23n,
        monster: { species: 'giant' },
    });
    requirePlayingGame(game);
    const hitPointsBefore = monster.mhp;
    const messages = [];
    const action = await triggerImmediateMonsterTrap(monster, game);
    await resumeDeferredMonsterTrap(action, game, {
        publish: async (message) => messages.push(message),
    });
    assert.ok(monster.mhp < hitPointsBefore);
    assert.equal(trap.tseen, true);
    assert.ok(floorObjectsAt(level, 11, 10).some(object => object.otyp === ROCK));
    assert.match(messages[0] ?? '', /is hit by a rock/);
});
void test('a falling rock passes harmlessly through a xorn', async () => {
    const { level, monster } = await freshMonsterTrapRoom(ROCKTRAP, {
        gameplaySeed: 23n,
        monster: { species: 'xorn' },
    });
    requirePlayingGame(game);
    const hitPointsBefore = monster.mhp;
    const messages = [];
    const action = await triggerImmediateMonsterTrap(monster, game);
    await resumeDeferredMonsterTrap(action, game, {
        publish: async (message) => messages.push(message),
    });
    assert.equal(monster.mhp, hitPointsBefore);
    assert.ok(floorObjectsAt(level, 11, 10).some(object => object.otyp === ROCK));
    assert.match(messages[0] ?? '', /is not harmed/);
});
void test('a spent rock trap names the monster beneath it with mon_nam()', async () => {
    const { monster, trap } = await freshMonsterTrapRoom(ROCKTRAP, {
        gameplaySeed: 23n, monster: { species: 'grid bug' },
    });
    requirePlayingGame(game);
    trap.once = true;
    trap.tseen = true;
    const messages = [];
    const action = await triggerImmediateMonsterTrap(monster, game, { random: () => 0 });
    await resumeDeferredMonsterTrap(action, game, {
        publish: async (message) => { messages.push(message); },
    });
    assert.deepEqual(messages, ['A trap door above the grid bug opens, but nothing falls out!']);
});
void test('a pet killed by a falling rock where it stood shows the rock on its pile', async () => {
    const { monster } = await freshMonsterTrapRoom(ROCKTRAP, {
        gameplaySeed: 23n,
        room: { left: 10, right: 11, top: 10, bottom: 10, heroX: 10, heroY: 10 },
        monster: { species: 'kitten', hitPoints: 1, mtrapseen: 0 },
    });
    requirePlayingGame(game);
    initializePet(monster, { state: game });
    await floorObject(SADDLE, 11, 10);
    newsym(11, 10);
    pushKeys(' '.repeat(10));
    // dog_move() returns MMOVE_MOVED without a step; postmov() still runs
    // mintrap() and redraws the square after the trap kills the pet.
    await performMonsterTurn(monster, game);
    assert.ok(monster.mhp <= 0);
    const glyph = glyphAt(11, 10);
    assert.ok(glyph?.kind === 'object', JSON.stringify(glyph));
    assert.equal(glyph.otyp, ROCK);
});
//# sourceMappingURL=monster_rock_trap.test.js.map