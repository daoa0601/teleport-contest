import test from 'node:test';
import assert from 'node:assert/strict';

import {
    ROOM, ROOMOFFSET, SHOPBASE, TELEP_TRAP,
} from '../js/const.js';
import { game } from '../js/gstate.js';
import { BOULDER } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import {
    clearFixedTeleportDestination, heroTeleportTrapBlock,
    moveHeroByTeleport, randomMonsterRelocation, safeTeleportDestination,
} from '../js/teleport.js';
import { freshGame } from './support/game-state.js';
import { addTrap } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';

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
    game.level.flags.noteleport = false;
    game.dungeons = [{ flags: {} }];
    initRng(1n);
    return game;
}

test('random teleport skips occupied squares, boulders, and traps', async () => {
    const state = teleportState();
    for (const x of [5, 6, 7, 8])
        state.level.at(x, 5).typ = ROOM;
    await createMonsterAt('little dog', 5, 5);
    state.level.objects[6] = [];
    state.level.objects[6][5] = [{ otyp: BOULDER }];
    addTrap(state.level, TELEP_TRAP, 7, 5);
    const xs = [5, 6, 7, 8];

    const destination = safeTeleportDestination(
        state,
        () => 5,
        () => xs.shift(),
    );

    assert.deepEqual(destination, { x: 8, y: 5 });
});

test('fixed teleport clears its destination before moving the hero', async () => {
    const state = teleportState();
    for (let x = 19; x <= 21; x++) {
        for (let y = 9; y <= 11; y++)
            state.level.at(x, y).typ = ROOM;
    }
    const monster = await createMonsterAt('little dog', 20, 10);
    monster.mtrack = [{ x: 1, y: 1 }];

    const cleared = clearFixedTeleportDestination(20, 10, state, () => 0);
    assert.equal(cleared.cleared, true);
    assert.notDeepEqual({ x: monster.mx, y: monster.my }, { x: 20, y: 10 });
    assert.deepEqual(monster.mtrack, []);

    const steed = { mx: 10, my: 10 };
    state.u.usteed = steed;
    state.u.utrap = 4;
    state.u.utraptype = 1;
    state.u.ustuck = monster;
    state.u.uswallow = true;
    moveHeroByTeleport(20, 10, state);

    assert.deepEqual({ x: state.u.ux, y: state.u.uy }, { x: 20, y: 10 });
    assert.deepEqual({ x: steed.mx, y: steed.my }, { x: 20, y: 10 });
    assert.equal(state.u.utrap, 0);
    assert.equal(state.u.ustuck, null);
    assert.equal(state.u.uswallow, false);
    assert.equal(state.context.run, 0);
    assert.equal(state.context.travel, false);
});

test('level rules and magic resistance block teleport traps', () => {
    const state = teleportState();
    state.level.flags.noteleport = true;
    assert.equal(heroTeleportTrapBlock(state), 'level');

    state.u.antimagic = true;
    assert.equal(heroTeleportTrapBlock(state), 'antimagic');
});

test('monster relocation searches the map after random attempts fail', async () => {
    const state = teleportState();
    state.level.at(10, 10).typ = ROOM;
    state.level.at(40, 10).typ = ROOM;
    const monster = await createMonsterAt('little dog', 10, 10);

    const relocation = randomMonsterRelocation(
        monster, state, [], () => 0, () => 1,
    );

    assert.deepEqual(
        { x: relocation.x, y: relocation.y },
        { x: 40, y: 10 },
    );
});

test('a shopkeeper teleports within its own shop', async () => {
    const state = teleportState();
    const shopRoomno = ROOMOFFSET;
    state.level.rooms.push({ rtype: SHOPBASE });
    state.level.nroom = 1;
    for (const [x, y, roomno] of [
        [10, 10, shopRoomno],
        [20, 10, 0],
        [12, 10, shopRoomno],
    ]) {
        state.level.at(x, y).typ = ROOM;
        state.level.at(x, y).roomno = roomno;
    }
    const monster = await createMonsterAt('shopkeeper', 10, 10);
    Object.assign(monster, {
        isshk: true,
        eshk: {
            shoproom: shopRoomno,
            shoplevel: { ...state.u.uz },
        },
    });
    const xs = [20, 12];

    const relocation = randomMonsterRelocation(
        monster, state, [], () => 10, () => xs.shift(),
    );

    assert.deepEqual(
        { x: relocation.x, y: relocation.y },
        { x: 12, y: 10 },
    );
});
