import assert from 'node:assert/strict';
import test from 'node:test';

import { LuaState } from '../js/lua/runtime.js';

for (const { label, source, diagnostic } of [
    { label: 'an escaped newline', source: 'local "a\\nb"',
        diagnostic: /:1: <name> expected near '"a\nb"'/ },
    { label: 'an escaped tab', source: "local 'a\\tb'",
        diagnostic: /:1: <name> expected near ''a\tb''/ },
    { label: 'an escaped quote', source: 'local "a\\"b"',
        diagnostic: /:1: <name> expected near '"a"b"'/ },
    { label: 'an escaped backslash', source: 'local "a\\\\b"',
        diagnostic: /:1: <name> expected near '"a\\b"'/ },
    { label: 'whitespace removed by an escape', source: 'local "a\\z \nb"',
        diagnostic: /:2: <name> expected near '"ab"'/ },
    { label: 'an unfinished string after an escape', source: 'local value = "a\\tb\n',
        diagnostic: /:1: unfinished string near '"a\tb'/ },
    { label: 'a long string with an initial newline', source: 'local [=[\r\na\r\nb]=]',
        diagnostic: /:3: <name> expected near '\[=\[a\nb\]=\]'/ },
]) {
    void test(`Lua syntax errors show decoded text for ${label}`, async t => {
        const state = new LuaState();
        t.after(() => state.destroy());

        assert.throws(() => state.execute(source, '(room.lua)'), diagnostic);
    });
}
