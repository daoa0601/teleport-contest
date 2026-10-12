import test from 'node:test';
import assert from 'node:assert/strict';
import { ARROW_TRAP, DRAWBRIDGE_DOWN, DRAWBRIDGE_UP, HEADSTONE, LAVAPOOL, LAVAWALL, MAGIC_PORTAL, MOAT, POOL, ROOM, VIBRATING_SQUARE, WATER, } from '../js/const.js';
import { engravingAt, makeEngravingAt } from '../js/engrave.js';
import { maketrap } from '../js/mklev.js';
import { BOULDER, DAGGER } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { cleanupSpecialLevelMap } from '../js/special_level_cleanup.js';
import { freshGame } from './support/game-state.js';
import { floorObject } from './support/game-objects.js';
for (const [name, terrain] of [
    ['pool', POOL], ['moat', MOAT], ['water', WATER],
    ['raised drawbridge', DRAWBRIDGE_UP], ['lava pool', LAVAPOOL], ['lava wall', LAVAWALL],
]) {
    void test(`special-level cleanup removes every boulder, ordinary trap, and engraving on ${name}`, async () => {
        const state = freshGame();
        initRng(7);
        state.in_mklev = true;
        const location = state.level.requireAt(12, 8);
        location.typ = ROOM;
        const trap = await maketrap(12, 8, ARROW_TRAP);
        assert.ok(trap);
        const first = await floorObject(BOULDER, 12, 8);
        const second = await floorObject(BOULDER, 12, 8);
        const dagger = await floorObject(DAGGER, 12, 8, { initialize: false });
        makeEngravingAt(12, 8, 'A submerged memorial', null, 0, HEADSTONE);
        location.typ = terrain;
        await cleanupSpecialLevelMap(state);
        assert.equal(first.where, 'gone');
        assert.equal(second.where, 'gone');
        const pile = state.level.objects[12]?.[8];
        assert.ok(pile);
        assert.equal(pile.length, 1);
        assert.equal(pile[0], dagger);
        assert.equal(state.level.traps.includes(trap), false);
        assert.equal(engravingAt(12, 8, state.level), null);
        assert.equal(location.typ, terrain, 'cleanup leaves the liquid in place');
        assert.equal(state._pending_message, '', 'construction cleanup is silent');
    });
}
for (const [name, trapType] of [['magic portal', MAGIC_PORTAL], ['vibrating square', VIBRATING_SQUARE]]) {
    void test(`special-level cleanup preserves a ${name} on liquid`, async () => {
        const state = freshGame();
        initRng(7);
        state.in_mklev = true;
        const location = state.level.requireAt(12, 8);
        location.typ = ROOM;
        const trap = await maketrap(12, 8, trapType);
        assert.ok(trap);
        location.typ = LAVAPOOL;
        await cleanupSpecialLevelMap(state);
        assert.equal(state.level.traps.includes(trap), true);
    });
}
for (const [name, terrain] of [['floor', ROOM], ['lowered drawbridge', DRAWBRIDGE_DOWN]]) {
    void test(`special-level cleanup preserves objects, traps, and engravings on ${name}`, async () => {
        const state = freshGame();
        initRng(7);
        state.in_mklev = true;
        const location = state.level.requireAt(12, 8);
        location.typ = ROOM;
        const trap = await maketrap(12, 8, ARROW_TRAP);
        assert.ok(trap);
        const boulder = await floorObject(BOULDER, 12, 8);
        const engraving = makeEngravingAt(12, 8, 'Dry footing');
        assert.ok(engraving);
        location.typ = terrain;
        await cleanupSpecialLevelMap(state);
        assert.equal(boulder.where, 'floor');
        assert.equal(state.level.traps.includes(trap), true);
        assert.equal(engravingAt(12, 8, state.level), engraving);
    });
}
//# sourceMappingURL=special_level_cleanup.test.js.map