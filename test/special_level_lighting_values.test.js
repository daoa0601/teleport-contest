import assert from 'node:assert/strict';
import test from 'node:test';
import { COLNO, ROOM, ROWNO } from '../js/const.js';
import { GameMap } from '../js/game.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { isRoom } from '../js/map_types.js';
import { mklev } from '../js/mklev.js';
import { mkmap } from '../js/mkmap.js';
import { initRng, rn2, rnd } from '../js/rng.js';
import { roomBindings } from './support/themed-room-bindings.js';
import { freshSpecialLevel } from './support/special-level.js';
const lightingCases = [
    { seed: 3, depth: 1 },
    { seed: 92, depth: 1 },
    { seed: 11, depth: 30 },
    { seed: 47, depth: -30 },
];
async function generateRoom(lua, source) {
    lua.setGlobal('prepare_room', () => { initRng(11); return null; });
    await lua.executeAsync(`
        local generated = false
        function themerooms_generate()
            if generated then return end
            generated = true
            prepare_room()
            ${source}
            following_roll = math.random(1000000) - 1
        end
    `);
    await mklev();
}
function assertFloorLighting(lit) {
    const level = requireGameLevel();
    let floors = 0;
    for (let x = 1; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            const cell = level.requireAt(x, y);
            if (cell.typ !== ROOM)
                continue;
            floors++;
            assert.equal(cell.lit, lit, `floor at ${x},${y}`);
        }
    }
    assert.ok(floors > 0, 'generation must create floor to observe lighting');
}
for (const lighting of [undefined, -1, -2, -7, 0, 1]) {
    void test(`a rectangular region resolves lighting ${String(lighting)} before the following roll`, async (t) => {
        const lua = await roomBindings(t);
        requirePlayingGame(game);
        const level = game.level;
        for (const { seed, depth } of lightingCases) {
            await lua.executeAsync('des.map({ x = 10, y = 6, lit = 1, map = ".LZ." })');
            level.requireAt(9, 6).lit = false;
            game.u.uz.dlevel = depth;
            initRng(seed);
            const expectedLit = lighting === undefined || lighting < 0
                ? rnd(1 + Math.abs(depth)) < 11 && rn2(77) !== 0
                : lighting !== 0;
            const nextRoll = rn2(1000000);
            initRng(seed);
            await lua.executeAsync(`des.region({ region = {0,0,3,0},
                ${lighting === undefined ? '' : `lit = ${lighting},`} })`);
            const context = `lit=${String(lighting)}, depth=${depth}, seed=${seed}`;
            assert.equal(level.requireAt(10, 6).lit, expectedLit, context);
            assert.equal(level.requireAt(13, 6).lit, expectedLit, context);
            assert.equal(level.requireAt(9, 6).lit, expectedLit, `lit regions include a halo: ${context}`);
            assert.equal(level.requireAt(11, 6).lit, true, 'lava pools keep their light');
            assert.equal(level.requireAt(12, 6).lit, true, 'lava walls keep their light');
            assert.equal(rn2(1000000), nextRoll, `following roll: ${context}`);
        }
    });
}
for (const irregular of [false, true]) {
    void test(`a ${irregular ? 'flood-filled' : 'registered rectangular'} region resolves negative light before its contents`, async (t) => {
        const lua = await roomBindings(t);
        await lua.executeAsync(`des.map({ x = 10, y = 6, lit = 0, map = [[-----
|...|
-----]] })`);
        requirePlayingGame(game);
        game.level.requireAt(10, 7).lit = true;
        initRng(92);
        assert.ok(rnd(2) < 11);
        assert.equal(rn2(77), 0, 'even shallow regions can be dark');
        const contentsRoll = rn2(1000000);
        const nextRoll = rn2(1000000);
        initRng(92);
        await lua.executeAsync(`des.region({ region = {1,1,3,1},
            arrival_room = true, irregular = ${String(irregular)}, lit = -2,
            contents = function(room)
                room_lit = room.lit
                contents_roll = math.random(1000000) - 1
            end })`);
        assert.equal(lua.getGlobal('room_lit'), false);
        assert.equal(game.level.requireAt(11, 7).lit, false);
        assert.equal(game.level.requireAt(10, 7).lit, true, 'dark rooms leave their walls alone');
        assert.equal(lua.getGlobal('contents_roll'), contentsRoll);
        assert.equal(rn2(1000000), nextRoll);
    });
}
for (const lighting of [undefined, -1, -2, -7, 0, 1]) {
    void test(`a room resolves lighting ${String(lighting)} after its type chance and before placement`, async (t) => {
        const lua = await roomBindings(t);
        requirePlayingGame(game);
        initRng(11);
        rn2(100);
        const expectedLit = lighting === undefined || lighting < 0
            ? rnd(2) < 11 && rn2(77) !== 0 : lighting !== 0;
        rnd(3);
        rnd(3);
        const contentsRoll = rn2(1000000);
        const nextRoll = rn2(1000000);
        await generateRoom(lua, `des.room({ x = 2, y = 2, w = 8, h = 6,
            ${lighting === undefined ? '' : `lit = ${lighting},`}
            contents = function(room)
                room_lit = room.lit
                contents_roll = math.random(1000000) - 1
            end })`);
        const room = requireGameLevel().rooms[0];
        assert.ok(isRoom(room), 'the explicit room must fit the empty level');
        assert.equal(lua.getGlobal('room_lit'), expectedLit);
        assert.equal(requireGameLevel().requireAt(room.lx, room.ly).lit, expectedLit);
        assert.equal(lua.getGlobal('contents_roll'), contentsRoll);
        assert.equal(lua.getGlobal('following_roll'), nextRoll);
    });
}
void test('a subroom chooses its random size and position before negative lighting', async (t) => {
    const lua = await roomBindings(t);
    initRng(11);
    rn2(100);
    const width = rnd(9);
    const height = rnd(5);
    rnd(12 - width);
    rnd(8 - height);
    const expectedLit = rnd(2) < 11 && rn2(77) !== 0;
    const nextRoll = rn2(1000000);
    await generateRoom(lua, `des.room({ x = 2, y = 2, w = 12, h = 8,
        xalign = "left", yalign = "top", chance = 0, lit = 0,
        contents = function()
            des.room({ lit = -7, contents = function(room)
                child_width, child_height, child_lit = room.width, room.height, room.lit
            end })
        end })`);
    assert.equal(lua.getGlobal('child_width'), width);
    assert.equal(lua.getGlobal('child_height'), height);
    assert.equal(lua.getGlobal('child_lit'), expectedLit);
    const child = requireGameLevel().subrooms?.[0];
    assert.ok(child, 'the parent must contain the generated subroom');
    assert.equal(requireGameLevel().requireAt(child.lx, child.ly).lit, expectedLit);
    assert.equal(lua.getGlobal('following_roll'), nextRoll);
});
void test('an undersized parent rejects a subroom before rolling its lighting', async (t) => {
    const lua = await roomBindings(t);
    initRng(11);
    rn2(100);
    const nextRoll = rn2(1000000);
    await generateRoom(lua, `des.room({ x = 2, y = 2, w = 3, h = 3,
        xalign = "left", yalign = "top", chance = 0, lit = 0,
        contents = function() des.room({ lit = -2 }) end })`);
    assert.equal(requireGameLevel().nsubroom ?? 0, 0);
    assert.equal(lua.getGlobal('following_roll'), nextRoll);
});
for (const operation of [
    'des.region({ region = {10,6,12,6}, lit = LIGHTING })',
    'des.room({ w = 8, h = 6, lit = LIGHTING })',
]) {
    void test(`${operation} requires integer lighting`, async (t) => {
        const lua = await roomBindings(t);
        for (const lighting of ['true', 'false', '0.5']) {
            initRng(3);
            const nextRoll = rn2(1000000);
            initRng(3);
            await assert.rejects(lua.executeAsync(operation.replace('LIGHTING', lighting)), /integer/);
            assert.equal(requireGameLevel().nroom, 0);
            assert.equal(rn2(1000000), nextRoll, 'invalid lighting must not advance the random stream');
        }
    });
}
for (const operation of [
    'des.map({ x = 10, y = 6, map = "...", lit = LIGHTING })',
    ...['solidfill', 'mines', 'swamp', 'mazegrid', 'maze', 'rogue'].map(style => `des.level_init({ style = "${style}", lit = LIGHTING })`),
]) {
    void test(`${operation} rejects negative boolean lighting before changing the level`, async (t) => {
        const lua = await roomBindings(t);
        for (const lighting of [-1, -2, -7]) {
            const cell = requireGameLevel().requireAt(10, 6);
            const previousType = cell.typ;
            const previousLit = cell.lit;
            initRng(3);
            const nextRoll = rn2(1000000);
            initRng(3);
            await assert.rejects(lua.executeAsync(operation.replace('LIGHTING', String(lighting))), /boolean|zero or one/);
            assert.equal(cell.typ, previousType);
            assert.equal(cell.lit, previousLit);
            assert.equal(rn2(1000000), nextRoll, 'invalid lighting must not consume any random numbers');
        }
    });
}
for (const lighting of [false, true, 0, 1]) {
    void test(`maps and solid fill accept lighting ${String(lighting)} without a lighting roll`, async (t) => {
        const lua = await roomBindings(t);
        initRng(3);
        const nextRoll = rn2(1000000);
        initRng(3);
        await lua.executeAsync(`
            des.level_init({ fg = ".", lit = ${String(lighting)} })
            des.map({ x = 10, y = 6, map = ".LZ", lit = ${String(lighting)} })
        `);
        const level = requireGameLevel();
        assert.equal(level.requireAt(20, 10).lit, !!lighting);
        assert.equal(level.requireAt(10, 6).lit, !!lighting);
        assert.equal(level.requireAt(11, 6).lit, true);
        assert.equal(level.requireAt(12, 6).lit, true);
        assert.equal(rn2(1000000), nextRoll);
    });
}
void test('omitting solid-fill lighting rolls one boolean before the following roll', async (t) => {
    const lua = await roomBindings(t);
    initRng(3);
    const expectedLit = rn2(2) !== 0;
    const nextRoll = rn2(1000000);
    initRng(3);
    await lua.executeAsync('des.level_init({ fg = "." })');
    assert.equal(requireGameLevel().requireAt(20, 10).lit, expectedLit);
    assert.equal(rn2(1000000), nextRoll);
});
for (const style of ['mines', 'swamp']) {
    void test(`${style} initialization resolves optional boolean lighting before terrain generation`, async (t) => {
        const lua = await roomBindings(t);
        for (const lighting of [undefined, false, true, 0, 1]) {
            game.level = new GameMap();
            initRng(11);
            const expectedLit = lighting === undefined ? rn2(2) !== 0 : !!lighting;
            await lua.executeAsync(`des.level_init({ style = "${style}", lit = ${String(expectedLit)} })`);
            const nextRoll = rn2(1000000);
            game.level = new GameMap();
            initRng(11);
            await lua.executeAsync(`des.level_init({ style = "${style}",
                ${lighting === undefined ? '' : `lit = ${String(lighting)},`} })`);
            assertFloorLighting(expectedLit);
            assert.equal(rn2(1000000), nextRoll, `following roll with lit=${String(lighting)}`);
        }
    });
}
for (const lighting of [-1, -2, -7, 0, 1, false, true]) {
    void test(`native cave initialization resolves lighting ${String(lighting)} before shaping the cave`, async () => {
        for (const { seed, depth } of lightingCases) {
            freshSpecialLevel({ prototype: 'mines', seed, depth });
            const expectedLit = typeof lighting === 'number' && lighting < 0
                ? rnd(1 + Math.abs(depth)) < 11 && rn2(77) !== 0 : !!lighting;
            await mkmap({ lit: expectedLit, joined: false });
            const nextRoll = rn2(1000000);
            freshSpecialLevel({ prototype: 'mines', seed, depth });
            await mkmap({ lit: lighting, joined: false });
            assertFloorLighting(expectedLit);
            assert.equal(rn2(1000000), nextRoll, `following roll at depth=${depth}, seed=${seed}`);
        }
    });
}
//# sourceMappingURL=special_level_lighting_values.test.js.map