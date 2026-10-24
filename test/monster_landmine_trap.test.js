import test from 'node:test';
import assert from 'node:assert/strict';
import { LANDMINE, PIT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { mfndpos, resumeDeferredMonsterTrap, triggerImmediateMonsterTrap, } from '../js/monmove.js';
import { placeMonsterAt } from '../js/monster_location.js';
import { tryMonsterTrapEscape } from '../js/monster_trap_escape.js';
import { ROCK } from '../js/object_data.js';
import { scatterFloorObjects } from '../js/scatter.js';
import { floorObject } from './support/game-objects.js';
import { floorObjectsAt } from './support/level-state.js';
import { freshMonsterTrapRoom } from './support/monster-traps.js';
import { freshObjectRoom } from './support/object-room.js';
import { createMonsterAt } from './support/monsters.js';
for (const observer of [false, true]) {
    void test(`${observer ? 'a sighted bystander' : 'a land mine survivor'} avoids the pit left by a mine explosion`, async () => {
        const { monster, trap } = await freshMonsterTrapRoom(LANDMINE, {
            gameplaySeed: 1n,
            monster: { species: 'giant', hitPoints: 100 },
        });
        requirePlayingGame(game);
        const bystander = observer ? await createMonsterAt('orc', 12, 11) : null;
        const action = await triggerImmediateMonsterTrap(monster, game);
        await resumeDeferredMonsterTrap(action, game, {
            rollOne: () => 2, publish: () => { },
        });
        assert.equal(trap.ttyp, PIT);
        await tryMonsterTrapEscape(monster, game, { random: () => 0, publish: () => { } });
        assert.equal(monster.mtrapped, 0);
        placeMonsterAt(monster, 12, 10);
        const walker = bystander ?? monster;
        walker.mux = game.u.ux;
        walker.muy = game.u.uy;
        const candidates = await mfndpos(walker, game);
        assert.equal(candidates.some(position => position.x === trap.tx && position.y === trap.ty), false, 'the monster should remember and avoid the pit created by the explosion');
    });
}
void test('a heavy monster sets off a land mine and falls into the new pit', async () => {
    const { monster, trap } = await freshMonsterTrapRoom(LANDMINE, {
        gameplaySeed: 1n,
        monster: { species: 'giant', hitPoints: 30 },
    });
    requirePlayingGame(game);
    const messages = [];
    const action = await triggerImmediateMonsterTrap(monster, game);
    await resumeDeferredMonsterTrap(action, game, {
        rollOne: () => 2,
        publish: async (message) => messages.push(message),
    });
    assert.equal(trap.ttyp, PIT);
    assert.equal(trap.tseen, true);
    assert.equal(monster.mtrapped, 1);
    assert.ok(monster.mhp < 30);
    assert.ok(messages.some(message => message.includes('KAABLAMM')));
    assert.ok(messages.some(message => message.includes('falls into a pit')));
});
void test('a light monster can cross a land mine without setting it off', async () => {
    const { monster, trap } = await freshMonsterTrapRoom(LANDMINE, {
        gameplaySeed: 1n,
        monster: { species: 'gnome', hitPoints: 30 },
    });
    requirePlayingGame(game);
    const action = await triggerImmediateMonsterTrap(monster, game);
    assert.equal(trap.ttyp, LANDMINE);
    assert.equal(monster.mhp, 30);
});
void test('a flying monster passes over a land mine without revealing it', async () => {
    const { monster, trap } = await freshMonsterTrapRoom(LANDMINE, {
        monster: { species: 'red dragon', hitPoints: 30 },
    });
    requirePlayingGame(game);
    const messages = [];
    const action = await triggerImmediateMonsterTrap(monster, game);
    await resumeDeferredMonsterTrap(action, game, {
        publish: async (message) => messages.push(message),
    });
    assert.equal(trap.ttyp, LANDMINE);
    assert.equal(trap.tseen, false);
    assert.equal(monster.mhp, 30);
    assert.equal(messages.length, 0);
});
void test('a forced land mine activation can reveal its trigger below a flying monster without detonating', async () => {
    const { monster, trap } = await freshMonsterTrapRoom(LANDMINE, {
        gameplaySeed: 2n,
        monster: { species: 'red dragon', hitPoints: 30 },
    });
    requirePlayingGame(game);
    const messages = [];
    const action = await triggerImmediateMonsterTrap(monster, game, { force: true });
    await resumeDeferredMonsterTrap(action, game, {
        publish: async (message) => messages.push(message),
    });
    assert.equal(trap.ttyp, LANDMINE);
    assert.equal(trap.tseen, true);
    assert.equal(monster.mhp, 30);
    assert.match(messages[0] ?? '', /trigger appears in a pile of soil/);
});
void test('the blast scatters loose objects away from the mine', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const rock = await floorObject(ROCK, 11, 10);
    await scatterFloorObjects(11, 10, 4, {
        state: game,
        random: range => range === 8 ? 4 : 1,
        rollOne: range => range,
    });
    assert.equal(floorObjectsAt(level, 11, 10).includes(rock), false);
    assert.equal(floorObjectsAt(level, 15, 10).includes(rock), true);
});
//# sourceMappingURL=monster_landmine_trap.test.js.map