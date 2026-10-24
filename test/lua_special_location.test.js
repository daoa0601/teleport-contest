import assert from 'node:assert/strict';
import test from 'node:test';
import { DOOR, FOUNTAIN, LADDER, ROOM, STAIRS, STONE } from '../js/const.js';
import { init_dungeons } from '../js/dungeon.js';
import { GameMap } from '../js/game.js';
import { game, requireGameLevel } from '../js/gstate.js';
import { currentLuaLifecycle } from '../js/lua/lifecycle.js';
import { isRoom } from '../js/map_types.js';
import { mklev } from '../js/mklev.js';
import { init_objects } from '../js/o_init.js';
import { initRng, rn2 } from '../js/rng.js';
import { freshGame } from './support/game-state.js';
import { floorObjects } from './support/level-state.js';
import { startLuaCore } from './support/lua-game.js';
async function levelScript(t) {
    freshGame({ flags: { bones: false } });
    initRng(731);
    init_objects();
    await init_dungeons();
    await startLuaCore(t);
    await mklev();
    const lua = currentLuaLifecycle().getThemedState(game, 0);
    assert.ok(lua);
    game.level = new GameMap();
    game.in_mklev = true;
    await lua.executeAsync(`
        des.level_init({ style = "solidfill", fg = " ", lit = 0 })
        des.map({ x = 10, y = 6, map = [[.......
.......
.......]] })
    `);
    return lua;
}
void test('a negative region x samples both map axes before the next random roll', async (t) => {
    const lua = await levelScript(t);
    initRng(17);
    const x = 10 + rn2(7);
    const y = 6 + rn2(3);
    const followingRoll = rn2(10000);
    initRng(17);
    await lua.executeAsync('des.region({ region = {-2, 99, 6, 2}, type = "temple", lit = 1 })');
    const room = requireGameLevel().rooms.filter(isRoom)[0];
    assert.ok(room);
    assert.equal(room.lx, x);
    assert.equal(room.ly, y);
    assert.equal(room.hx, 16);
    assert.equal(room.hy, 8);
    assert.equal(rn2(10000), followingRoll);
});
for (const command of ['teleport_region', 'levregion']) {
    void test(`${command} resolves random endpoints on any terrain and keeps the following roll`, async (t) => {
        const lua = await levelScript(t);
        // ANY_LOC accepts solid rock as well as room floor.
        for (let x = 10; x <= 16; x++)
            for (let y = 6; y <= 8; y++)
                requireGameLevel().requireAt(x, y).typ = STONE;
        initRng(29);
        rn2(7);
        rn2(3);
        rn2(7);
        rn2(3);
        const followingRoll = rn2(10000);
        initRng(29);
        await lua.executeAsync(`des.${command}({ region = {-2, 99, -3, 99},
            type = "stair-down", dir = "up" })`);
        assert.equal(rn2(10000), followingRoll);
    });
}
void test('level-coordinate regions and negative exclusion bounds consume no random draws', async (t) => {
    const lua = await levelScript(t);
    initRng(29);
    const followingRoll = rn2(10000);
    initRng(29);
    await lua.executeAsync(`des.teleport_region({ region = {-2, -3, 14, 8}, region_islev = true,
        exclude = {-1, -1, -1, -1}, dir = "up" })`);
    assert.equal(rn2(10000), followingRoll);
});
void test('regions inside room contents retain the map origin and map dimensions', async (t) => {
    const lua = await levelScript(t);
    initRng(17);
    const expected = { lx: 10 + rn2(7), ly: 6 + rn2(3), hx: 16, hy: 8 };
    const followingRoll = rn2(10000);
    initRng(17);
    await lua.executeAsync(`des.region({ region = {1, 1, 4, 2}, type = "temple", lit = 1,
        contents = function()
            des.region({ region = {-2, 99, 6, 2}, type = "temple", lit = 1 })
        end })`);
    const room = requireGameLevel().rooms.filter(isRoom)[1];
    assert.ok(room);
    assert.deepEqual({ lx: room.lx, ly: room.ly, hx: room.hx, hy: room.hy }, expected);
    assert.equal(rn2(10000), followingRoll);
});
const terrainPlacements = [
    ['stair({ dir = "down", coord = {-1, -1} })', STAIRS],
    ['ladder({ dir = "down", coord = {-1, -1} })', LADDER],
    ['feature({ type = "fountain", coord = {-1, -1} })', FOUNTAIN],
];
for (const [command, terrain] of terrainPlacements) {
    void test(`${command} samples a floor square and leaves the next roll intact`, async (t) => {
        const lua = await levelScript(t);
        initRng(17);
        const x = 10 + rn2(7), y = 6 + rn2(3);
        const followingRoll = rn2(10000);
        initRng(17);
        await lua.executeAsync(`des.${command}`);
        assert.equal(requireGameLevel().requireAt(x, y).typ, terrain);
        assert.equal(rn2(10000), followingRoll);
    });
}
void test('a random ladder avoids furniture and removes a trap on its selected floor square', async (t) => {
    const lua = await levelScript(t);
    await lua.executeAsync(`des.map({ x = 10, y = 6, map = "{.{" })
        des.trap({ type = "arrow", x = 1, y = 0, victim = false })`);
    await lua.executeAsync('des.ladder("down")');
    assert.equal(requireGameLevel().requireAt(11, 6).typ, LADDER);
    assert.equal(requireGameLevel().requireAt(10, 6).typ, FOUNTAIN);
    assert.equal(requireGameLevel().traps.length, 0);
});
const simpleRequests = [
    ['gold', 'gold({ amount = 50'],
    ['engraving', 'engraving({ text = "Elbereth", degrade = false'],
];
for (const [label, command] of simpleRequests) {
    void test(`${label} accepts the random sentinel before its following roll`, async (t) => {
        const lua = await levelScript(t);
        initRng(17);
        const x = 10 + rn2(7), y = 6 + rn2(3);
        initRng(17);
        await lua.executeAsync(`des.${command} })`);
        const followingRoll = rn2(10000);
        game.level = new GameMap();
        for (let px = 10; px <= 16; px++)
            for (let py = 6; py <= 8; py++)
                requireGameLevel().requireAt(px, py).typ = ROOM;
        initRng(17);
        await lua.executeAsync(`des.${command}, coord = {-1, -1} })`);
        const level = requireGameLevel();
        assert.ok(command.startsWith('gold') ? level.objects[x]?.[y]?.length
            : level.engravings?.some(engraving => engraving.x === x && engraving.y === y));
        assert.equal(rn2(10000), followingRoll, command);
    });
}
const entityRequests = [
    ['named object', 'object({ id = "rock"'],
    ['object class', 'object({ class = "`"'],
    ['random object', 'object({ buc = "uncursed"'],
    ['named monster', 'monster({ id = "lichen"'],
    ['monster class', 'monster({ class = "F"'],
    ['random monster', 'monster({ peaceful = 1'],
];
for (const [label, command] of entityRequests) {
    void test(`${label} treats a supplied random sentinel like an omitted coordinate`, async (t) => {
        const lua = await levelScript(t);
        initRng(17);
        await lua.executeAsync(`des.${command} })`);
        const level = requireGameLevel();
        const object = floorObjects(level)[0];
        const monster = level.monsters[0];
        assert.ok(object || monster, `${label} must be created`);
        const expected = command.startsWith('object') ? { x: object?.ox, y: object?.oy }
            : { x: monster?.mx, y: monster?.my };
        const followingRoll = rn2(10000);
        game.level = new GameMap();
        for (let x = 10; x <= 16; x++)
            for (let y = 6; y <= 8; y++)
                requireGameLevel().requireAt(x, y).typ = ROOM;
        initRng(17);
        await lua.executeAsync(`des.${command}, coord = {-1, -1} })`);
        const placedObject = floorObjects(requireGameLevel())[0];
        const placedMonster = requireGameLevel().monsters[0];
        assert.deepEqual(command.startsWith('object') ? { x: placedObject?.ox, y: placedObject?.oy }
            : { x: placedMonster?.mx, y: placedMonster?.my }, expected);
        assert.equal(rn2(10000), followingRoll, command);
    });
}
void test('packed door and terrain axes wrap before adding the map origin', async (t) => {
    const lua = await levelScript(t);
    initRng(17);
    const followingRoll = rn2(10000);
    initRng(17);
    await lua.executeAsync(`des.door({ x = 256, y = 256, state = "closed" })
        des.terrain({ x = 257, y = 256, typ = "{" })`);
    assert.equal(requireGameLevel().requireAt(10, 6).typ, DOOR);
    assert.equal(requireGameLevel().requireAt(11, 6).typ, FOUNTAIN);
    assert.equal(rn2(10000), followingRoll);
});
void test('exclusion endpoints are packed coordinates even with negative axes or region_islev', async (t) => {
    const lua = await levelScript(t);
    initRng(17);
    const followingRoll = rn2(10000);
    initRng(17);
    await lua.executeAsync(`des.exclusion({ region = {-1, -1, 256, 257}, region_islev = true })`);
    assert.deepEqual(requireGameLevel().exclusionZones[0], {
        type: 'teleport', lx: 265, ly: 261, hx: 10, hy: 7,
    });
    assert.equal(rn2(10000), followingRoll);
});
void test('explicit region axes ignore an unused malformed region table', async (t) => {
    const lua = await levelScript(t);
    await lua.executeAsync(`des.region({ x1 = 1, y1 = 1, x2 = 3, y2 = 2,
        region = false, type = "temple", lit = 1 })`);
    const room = requireGameLevel().rooms.filter(isRoom)[0];
    assert.ok(room);
    assert.deepEqual({ lx: room.lx, ly: room.ly, hx: room.hx, hy: room.hy }, { lx: 11, ly: 7, hx: 13, hy: 8 });
});
//# sourceMappingURL=lua_special_location.test.js.map