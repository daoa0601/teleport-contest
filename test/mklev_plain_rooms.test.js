import assert from 'node:assert/strict';
import test from 'node:test';
import { OROOM, THEMEROOM } from '../js/const.js';
import { init_dungeons } from '../js/dungeon.js';
import { isRoom } from '../js/map_types.js';
import { mklev } from '../js/mklev.js';
import { init_objects } from '../js/o_init.js';
import { initRng } from '../js/rng.js';
import { freshGame } from './support/game-state.js';
import { startLuaCore } from './support/lua-game.js';
import { currentLuaLifecycle } from '../js/lua/lifecycle.js';
import { LuaState } from '../js/lua/runtime.js';
import { resetInputState } from '../js/input.js';
import { PanicTermination } from '../js/panic_termination.js';
void test('a fatal impossible in a room theme preserves its original reason', async (t) => {
    const state = freshGame({ flags: { bones: false, debug_fuzzer: 1 } });
    initRng(999);
    init_objects();
    await init_dungeons();
    await startLuaCore(t);
    const dungeon = state.dungeons[0];
    assert.ok(dungeon);
    dungeon.themeRooms = 'themerms.lua';
    state.u.uz = { dnum: 0, dlevel: 12 };
    state.specialLevels?.clear();
    state.branches = [];
    const execute = LuaState.prototype.executeAsync;
    t.mock.method(LuaState.prototype, 'executeAsync', async function (source, filename = '<lua>') {
        await execute.call(this, filename === '(themerms.lua)'
            ? 'nh.impossible("The room theme cannot continue.")' : source, filename);
    });
    await assert.rejects(mklev(), error => error instanceof PanicTermination
        && error.message === 'The room theme cannot continue.');
    assert.equal(dungeon.themeRooms, 'themerms.lua');
});
for (const temporaryState of [false, true]) {
    void test(`a runtime theme error identifies its Lua state${temporaryState ? ' after a temporary state closes' : ''}`, async (t) => {
        const state = freshGame({ flags: { bones: false } });
        state.program_state.in_sanity_check = true;
        initRng(999);
        init_objects();
        await init_dungeons();
        await startLuaCore(t);
        if (temporaryState)
            await currentLuaLifecycle().createSpecialState(state).destroy();
        const dungeon = state.dungeons[0];
        assert.ok(dungeon);
        dungeon.themeRooms = 'themerms.lua';
        state.u.uz = { dnum: 0, dlevel: 12 };
        state.specialLevels?.clear();
        state.branches = [];
        resetInputState().feed(' ');
        const execute = LuaState.prototype.executeAsync;
        t.mock.method(LuaState.prototype, 'executeAsync', async function (source, filename = '<lua>') {
            await execute.call(this, filename === '(themerms.lua)'
                ? 'error("broken")' : source, filename);
        });
        await mklev();
        assert.match(state._lastPlineMessage, temporaryState
            ? /^Lua error: 3:themerms\.lua .*broken/
            : /^Lua error: 2:themerms\.lua .*broken/);
        assert.ok(state.level.rooms.filter(isRoom).some(room => room.rtype === OROOM));
        assert.equal(dungeon.themeRooms, undefined);
        assert.equal(currentLuaLifecycle().getThemedState(state, 0), null);
    });
}
for (const { label, source: malformedSource, diagnostic } of [
    { label: 'a missing local name', source: 'local =',
        diagnostic: /\[string "\(themerms\.lua\)"\]:1: <name> expected near '='/ },
    { label: 'a missing local name on a later line', source: '-- room theme\nlocal =',
        diagnostic: /\[string "\(themerms\.lua\)"\]:2: <name> expected near '='/ },
    { label: 'an unexpected expression symbol', source: 'local answer = )',
        diagnostic: /\[string "\(themerms\.lua\)"\]:1: unexpected symbol near '\)'/ },
    { label: 'an unfinished conditional', source: 'if true then\n',
        diagnostic: /\[string "\(themerms\.lua\)"\]:2: 'end' expected \(to close 'if' at line 1\) near <eof>/ },
    { label: 'an unfinished local function with a multiline header', source: 'local function room\n()\n',
        diagnostic: /\[string "\(themerms\.lua\)"\]:3: 'end' expected \(to close 'function' at line 2\) near <eof>/ },
    { label: 'an unfinished anonymous function with a multiline header', source: 'local room = function\n()\n',
        diagnostic: /\[string "\(themerms\.lua\)"\]:3: 'end' expected \(to close 'function' at line 2\) near <eof>/ },
    { label: 'an unfinished quoted string', source: 'local message = "\n',
        diagnostic: /\[string "\(themerms\.lua\)"\]:1: unfinished string near '"'/ },
]) {
    void test(`a room theme with ${label} reports Lua's diagnostic and falls back to ordinary rooms`, async (t) => {
        const state = freshGame({ flags: { bones: false } });
        state.program_state.in_sanity_check = true;
        initRng(999);
        init_objects();
        await init_dungeons();
        await startLuaCore(t);
        const dungeon = state.dungeons[0];
        assert.ok(dungeon);
        dungeon.themeRooms = 'themerms.lua';
        state.u.uz = { dnum: 0, dlevel: 12 };
        state.specialLevels?.clear();
        state.branches = [];
        resetInputState().feed(' ');
        // Feed malformed source to the real parser without changing packaged assets.
        const execute = LuaState.prototype.executeAsync;
        t.mock.method(LuaState.prototype, 'executeAsync', async function (source, filename = '<lua>') {
            await execute.call(this, filename === '(themerms.lua)' ? malformedSource : source, filename);
        });
        await mklev();
        assert.match(state._lastPlineMessage, /^luaL_loadbuffer: Error loading \(themerms\.lua\): /);
        assert.match(state._lastPlineMessage, diagnostic);
        assert.ok(state.level.rooms.filter(isRoom).some(room => room.rtype === OROOM));
        assert.equal(dungeon.themeRooms, undefined);
        assert.equal(currentLuaLifecycle().getThemedState(state, 0), null);
    });
}
void test('a missing room theme is disabled and ordinary rooms still generate on later levels', async (t) => {
    const state = freshGame({ flags: { bones: false } });
    state.program_state.in_sanity_check = true;
    initRng(999);
    init_objects();
    await init_dungeons();
    await startLuaCore(t);
    const dungeon = state.dungeons[0];
    assert.ok(dungeon);
    dungeon.themeRooms = 'missing-room-theme.lua';
    state.specialLevels?.clear();
    state.branches = [];
    for (const depth of [12, 13]) {
        state.u.uz = { dnum: 0, dlevel: depth };
        await mklev();
        const rooms = state.level.rooms.filter(isRoom);
        assert.ok(rooms.some(room => room.rtype === OROOM), `ordinary rooms must generate at depth ${depth}`);
        assert.ok(!rooms.some(room => room.rtype === THEMEROOM));
        assert.equal(currentLuaLifecycle().getThemedState(state, 0), null);
        assert.equal(dungeon.themeRooms, undefined, 'the failed theme must stay disabled');
        assert.match(state._pending_message, /nhl_loadlua: Error opening \(missing-room-theme.lua\)/);
    }
});
void test('a dungeon without a themed-room file creates ordinary rectangular rooms', async (t) => {
    const state = freshGame({ flags: { bones: false } });
    initRng(999);
    init_objects();
    await init_dungeons();
    await startLuaCore(t);
    const dungeon = state.dungeons[0];
    assert.ok(dungeon);
    dungeon.themeRooms = undefined;
    state.u.uz = { dnum: 0, dlevel: 12 };
    state.specialLevels?.clear();
    state.branches = [];
    for (let seed = 1; seed <= 24; seed++) {
        initRng(seed);
        await mklev();
        const rooms = state.level.rooms.filter(isRoom);
        assert.ok(rooms.some(room => room.rtype === OROOM), 'ordinary rooms must still be generated');
        assert.ok(!rooms.some(room => room.rtype === THEMEROOM), `there is no theme script to create themed rooms (seed ${seed})`);
        assert.ok(rooms.filter(room => room.rtype === OROOM).every(room => !room.irregular), 'plain room creation produces rectangular rooms');
    }
});
//# sourceMappingURL=mklev_plain_rooms.test.js.map