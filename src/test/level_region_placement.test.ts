import assert from 'node:assert/strict';
import test from 'node:test';
import { ARROW_TRAP, LR_PORTAL, LR_UPSTAIR, LR_UPTELE, MAGIC_PORTAL, NO_MINVENT, STAIRS } from '../js/const.js';
import { maketrap, place_lregion } from '../js/mklev.js';
import { game } from '../js/gstate.js';
import { createMonsterAt } from './support/monsters.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { placeHeroAtRandomArrival } from '../js/level_change.js';

void test('random arrival resets the old position on entry to a different level', async () => {
    freshPlayableRoom({ hero: {
        uz: { dnum: 0, dlevel: 2 }, uz0: { dnum: 0, dlevel: 1 },
        ux0: 30, uy0: 15,
    } });

    const arrival = await placeHeroAtRandomArrival({ lx: 12, ly: 10, hx: 12, hy: 10 });

    assert.equal(game.u.ux0, arrival.x);
    assert.equal(game.u.uy0, arrival.y);
});

void test('a region move on the same level preserves the previous position', async () => {
    freshPlayableRoom({ hero: {
        uz: { dnum: 0, dlevel: 2 }, uz0: { dnum: 0, dlevel: 2 },
        ux0: 10, uy0: 10,
    } });

    await place_lregion(12, 10, 12, 10, -1, -1, -1, -1, LR_UPTELE, null);

    assert.equal(game.u.ux0, 10);
    assert.equal(game.u.uy0, 10);
});

void test('a one-square stair region removes a destroyable trap before placing its stair', async () => {
    const level = freshPlayableRoom({ hero: { uz: { dnum: 0, dlevel: 2 } } });
    const trap = await maketrap(12, 10, ARROW_TRAP);
    assert.ok(trap);

    await place_lregion(12, 10, 12, 10, -1, -1, -1, -1, LR_UPSTAIR, null);

    assert.equal(level.traps.includes(trap), false);
    assert.equal(level.requireAt(12, 10).typ, STAIRS);
});

void test('a one-square portal region keeps its dungeon destination', async () => {
    const level = freshPlayableRoom();
    await place_lregion(12, 10, 12, 10, -1, -1, -1, -1, LR_PORTAL, { dnum: 1, dlevel: 7 });

    const portal = level.traps.find(trap => trap.tx === 12 && trap.ty === 10);
    assert.equal(portal?.ttyp, MAGIC_PORTAL);
    assert.deepEqual(portal?.dst, { dnum: 1, dlevel: 7 });
});

void test('a one-square hero region relocates its monster before arrival', async () => {
    const level = freshPlayableRoom();
    const monster = await createMonsterAt('jackal', 12, 10, NO_MINVENT);

    await place_lregion(12, 10, 12, 10, -1, -1, -1, -1, LR_UPTELE, null);

    assert.equal(game.u.ux, 12);
    assert.equal(game.u.uy, 10);
    assert.ok(monster.mx !== 12 || monster.my !== 10 || !level.monsters.includes(monster));
});

void test('a default hero region honors teleport exclusions', async () => {
    const level = freshPlayableRoom();
    level.exclusionZones.push({ type: 'teleport-up', lx: 8, ly: 8, hx: 17, hy: 12 });

    await place_lregion(0, 0, 0, 0, -1, -1, -1, -1, LR_UPTELE, null);

    assert.equal(game.u.ux, 18);
    assert.ok(game.u.uy >= 8 && game.u.uy <= 12);
});
