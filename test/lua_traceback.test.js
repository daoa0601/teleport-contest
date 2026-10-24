import assert from 'node:assert/strict';
import test from 'node:test';
import { LuaState } from '../js/lua/runtime.js';
for (const asynchronous of [false, true]) {
    const mode = asynchronous ? 'asynchronous' : 'synchronous';
    void test(`${mode} Lua diagnostics retain definition locations and discard unwound calls`, async (t) => {
        const state = new LuaState();
        t.after(() => state.destroy());
        state.execute('function fail()\n error("broken")\nend', '=library.lua');
        const execute = async (source, filename) => {
            if (asynchronous)
                await state.executeAsync(source, filename);
            else
                state.execute(source, filename);
        };
        await assert.rejects(execute('fail()', '=caller.lua'), error => {
            const diagnostic = state.traceback.format(error);
            assert.match(diagnostic, /^library\.lua:2: broken\nstack traceback:/);
            assert.match(diagnostic, /library\.lua:2: in function 'fail'/);
            assert.match(diagnostic, /caller\.lua:1: in main chunk/);
            assert.doesNotMatch(diagnostic, /library\.lua:\d+: in main chunk/);
            return true;
        });
        await assert.rejects(execute('error("later", 0)', '=second.lua'), error => {
            const diagnostic = state.traceback.format(error);
            assert.match(diagnostic, /^later\nstack traceback:/);
            assert.match(diagnostic, /second\.lua:1: in main chunk/);
            assert.doesNotMatch(diagnostic, /library\.lua|caller\.lua/);
            return true;
        });
    });
    void test(`${mode} Lua traceback elides a Lua tail caller`, async (t) => {
        const state = new LuaState();
        t.after(() => state.destroy());
        const source = [
            'function leaf() error("broken") end',
            'function middle() return leaf() end',
            'middle()',
        ].join('\n');
        await assert.rejects(async () => {
            if (asynchronous)
                await state.executeAsync(source, '=tail.lua');
            else
                state.execute(source, '=tail.lua');
        }, error => {
            const diagnostic = state.traceback.format(error);
            assert.match(diagnostic, /tail\.lua:1: in function 'leaf'/);
            assert.match(diagnostic, /\(\.\.\.tail calls\.\.\.\)/);
            assert.match(diagnostic, /tail\.lua:3: in main chunk/);
            assert.doesNotMatch(diagnostic, /in function 'middle'/);
            return true;
        });
    });
}
void test('Lua error levels locate the selected caller without removing traceback frames', async (t) => {
    const state = new LuaState();
    t.after(() => state.destroy());
    await assert.rejects(state.executeAsync([
        'local function fail()',
        ' error("broken", 2)',
        'end',
        'fail()',
    ].join('\n'), '=levels.lua'), error => {
        const diagnostic = state.traceback.format(error);
        assert.match(diagnostic, /^levels\.lua:4: broken\nstack traceback:/);
        assert.match(diagnostic, /levels\.lua:2: in local 'fail'/);
        return true;
    });
});
void test('deep Lua tracebacks abbreviate intermediate calls and retain the main chunk', async (t) => {
    const state = new LuaState();
    t.after(() => state.destroy());
    await assert.rejects(state.executeAsync([
        'function descend(n)',
        ' if n == 0 then error("broken") end',
        ' descend(n - 1)',
        'end',
        'descend(30)',
    ].join('\n'), '=deep.lua'), error => {
        const diagnostic = state.traceback.format(error);
        assert.match(diagnostic, /^deep\.lua:2: broken\nstack traceback:/);
        assert.match(diagnostic, /skipping \d+ levels/);
        assert.match(diagnostic, /deep\.lua:5: in main chunk/);
        assert.ok(diagnostic.split('\n').length < 30, 'abbreviate the recursive stack');
        return true;
    });
});
//# sourceMappingURL=lua_traceback.test.js.map