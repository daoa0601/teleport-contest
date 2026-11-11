import test from 'node:test';
import assert from 'node:assert/strict';
import { runSegment } from '../js/jsmain.js';
import { memoryStorage } from './support/memory-storage.js';
// C allmain.c:moveloop() with cfgfiles.c:rcfile_only_this_option()
// ("mention_decor and tutorial"): initoptions_finish() disregards
// mention_decor while the rc file is read, so a new game does not describe
// the starting staircase before the tutorial decision is past; moveloop()
// then processes the deferred option, and walking back onto the stairs
// describes the decor as mention_decor requires.
const NETHACKRC = 'OPTIONS=name:Iris,role:Wizard,race:human,gender:female,align:neutral,'
    + '!legacy,!autopickup,pettype:none,!tutorial,mention_decor';
function visibleScreen(engine) {
    assert.ok(engine.display);
    return engine.display.grid.map(row => row.map(cell => cell.ch).join('').trimEnd()).join('\n');
}
void test('mention_decor from the rc file does not describe the starting stairs', async () => {
    const engine = await runSegment({
        seed: 29371, datetime: '20260112120000', moves: '', storage: memoryStorage(),
        nethackrc: NETHACKRC,
    });
    try {
        const screen = visibleScreen(engine);
        assert.ok(screen.includes('Hello Iris, welcome to NetHack!'));
        assert.ok(!screen.includes('staircase up out of the dungeon'), 'the startup decor description must wait for the tutorial decision');
    }
    finally {
        await engine.lua.destroy();
    }
});
void test('the deferred mention_decor option takes effect once play begins', async () => {
    const engine = await runSegment({
        seed: 29371, datetime: '20260112120000', moves: 'lh', storage: memoryStorage(),
        nethackrc: NETHACKRC,
    });
    try {
        const screen = visibleScreen(engine);
        assert.ok(screen.includes('There is a staircase up out of the dungeon here.'));
    }
    finally {
        await engine.lua.destroy();
    }
});
//# sourceMappingURL=mention_decor_defer.test.js.map