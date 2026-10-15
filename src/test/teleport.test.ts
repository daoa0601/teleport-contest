import { floorObject } from './support/game-objects.js';
import { createDungeon } from './support/topology.js';
import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    NO_MINVENT, PIT, ROOM, TELEP_TRAP,
} from '../js/const.js';
import { game } from '../js/gstate.js';
import { placeMonsterAt } from '../js/monster_location.js';
import { BOULDER } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { vision_reset } from '../js/vision.js';
import {
    clearFixedTeleportDestination, heroTeleportTrapBlock,
    moveHeroByTeleport, randomMonsterRelocation, relocateMonsterTo, safeTeleportDestination,
} from '../js/teleport.js';
import { freshGame } from './support/game-state.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { createStaffedShop } from './support/shop.js';
import { freshObjectRoom } from './support/object-room.js';

void test('postmortem relocation releases a monster from the trap on its old square', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const monster = await createMonsterAt('guard', 12, 10, NO_MINVENT);
    const pit = addTrap(level, PIT, 12, 10, { tseen: true });
    monster.mtrapped = 1;
    game.program_state.gameover = true;

    const result = await relocateMonsterTo(monster, 11, 10);

    assert.equal(result.moved, true);
    assert.equal(!!result.died, false, 'An existing game over is not a fatal relocation');
    assert.equal(monster.mx, 11);
    assert.equal(monster.my, 10);
    assert.equal(monster.mtrapped, 0);
    assert.ok(level.traps.includes(pit));
    assert.ok(level.monsters.includes(monster));
});

function teleportState() {
    freshGame({
        hero: {
            uz: { dnum: 0, dlevel: 4 },
            umonster: 340,
        },
        context: {
            run: 1, mv: true, travel: true, travel1: true, nopick: true,
        },
        moves: 20,
    });
    requirePlayingGame(game);
    game.level.flags.noteleport = false;
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom',  flags: {} })];
    initRng(1n);
    return game;
}

void test('random teleport skips occupied squares, boulders, and traps', async () => {
    const state = teleportState();
    requirePlayingGame(game);
    for (const x of [5, 6, 7, 8])
        state.level.requireAt(x, 5).typ = ROOM;
    await createMonsterAt('little dog', 5, 5);
    await floorObject(BOULDER, 6, 5);
    addTrap(state.level, TELEP_TRAP, 7, 5);
    const xs = [5, 6, 7, 8];

    const destination = safeTeleportDestination(
        state,
        () => 5,
        () => { const x = xs.shift(); assert.ok(x !== undefined); return x; },
    );

    assert.deepEqual(destination, { x: 8, y: 5 });
});

void test('fixed teleport clears its destination before moving the hero', async () => {
    const state = teleportState();
    requirePlayingGame(game);
    for (let x = 19; x <= 21; x++) {
        for (let y = 9; y <= 11; y++)
            state.level.requireAt(x, y).typ = ROOM;
    }
    const monster = await createMonsterAt('little dog', 20, 10);
    monster.mtrack = [{ x: 1, y: 1 }];

    const cleared = await clearFixedTeleportDestination(20, 10, state, () => 0);
    assert.equal(cleared.cleared, true);
    assert.notDeepEqual({ x: monster.mx, y: monster.my }, { x: 20, y: 10 });
    assert.deepEqual(monster.mtrack, []);

    state.level.requireAt(10, 10).typ = ROOM;
    const steed = await createMonsterAt('pony', 10, 10);
    state.u.usteed = steed;
    state.u.utrap = 4;
    state.u.utraptype = 1;
    state.u.ustuck = monster;
    state.u.uswallow = true;
    // A swallowed teleport redraws the ordinary map after release. Build
    // its vision tables after the fixture's room terrain is installed.
    vision_reset();
    await moveHeroByTeleport(20, 10, state);

    assert.deepEqual({ x: state.u.ux, y: state.u.uy }, { x: 20, y: 10 });
    assert.deepEqual({ x: steed.mx, y: steed.my }, { x: 20, y: 10 });
    assert.equal(state.u.utrap, 0);
    assert.equal(state.u.ustuck, null);
    assert.equal(!!state.u.uswallow, false);
    assert.equal(state.context.run, 0);
    assert.equal(state.context.travel, false);
});

void test('level rules and magic resistance block teleport traps', () => {
    const state = teleportState();
    requirePlayingGame(game);
    state.level.flags.noteleport = true;
    assert.equal(heroTeleportTrapBlock(state), 'level');

    state.u.antimagic = true;
    assert.equal(heroTeleportTrapBlock(state), 'antimagic');
});

void test('monster relocation searches the map after random attempts fail', async () => {
    const state = teleportState();
    requirePlayingGame(game);
    state.level.requireAt(10, 10).typ = ROOM;
    state.level.requireAt(40, 10).typ = ROOM;
    const monster = await createMonsterAt('little dog', 10, 10);
    placeMonsterAt(monster, 10, 10);

    const relocation = await randomMonsterRelocation(monster, { state, calls: [], random: () => 0, rollOne: () => 1 });

    assert.ok(relocation != null, 'Expected relocation to be initialized');
    assert.deepEqual(
        { x: relocation.x, y: relocation.y },
        { x: 40, y: 10 },
    );
});

void test('a shopkeeper teleports within its own shop', async () => {
    const state = teleportState();
    requirePlayingGame(game);
    state.u.ux = 5;
    state.u.uy = 5;
    state.level.requireAt(5, 5).typ = ROOM;
    const { shopkeeper: monster } = await createStaffedShop({
        left: 10, right: 12, top: 10, bottom: 10,
        keeperX: 10, keeperY: 10,
    });
    state.level.requireAt(20, 10).typ = ROOM;
    const xs = [20, 12];

    const relocation = await randomMonsterRelocation(
        monster, { state, calls: [], random: () => 10, rollOne: () => { const x = xs.shift(); assert.ok(x !== undefined); return x; } },
    );

    assert.ok(relocation != null, 'Expected relocation to be initialized');
    assert.deepEqual(
        { x: relocation.x, y: relocation.y },
        { x: 12, y: 10 },
    );
});
