import test from 'node:test';
import assert from 'node:assert/strict';
import { runSegment } from '../js/jsmain.js';
import { moveloop_core } from '../js/allmain.js';
import { rhack } from '../js/cmd.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';
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
void test('a malformed deferred mention_decor value reports its error once play begins', async () => {
    const engine = await runSegment({
        seed: 29371, datetime: '20260112120000', moves: '', storage: memoryStorage(),
        nethackrc: 'OPTIONS=name:Iris,role:Wizard,race:human,gender:female,align:neutral,'
            + '!legacy,!autopickup,pettype:none,!tutorial,mention_decor:zzz',
    });
    try {
        // rcfile()'s config_error_done() reports the deferred option's
        // diagnostics after the tutorial decision, waiting for input.
        const screen = visibleScreen(engine);
        assert.match(screen, /'mention_decor:zzz' is not valid for a boolean/);
        assert.match(screen, /1 error in \.nethackrc/);
    }
    finally {
        await engine.lua.destroy();
    }
});
void test('the deferred rc re-read runs once, keeping later in-game option changes', async () => {
    await freshObjectRoom({ flags: { mention_decor: true } });
    game.nethackrc = 'OPTIONS=mention_decor';
    game.nethackOptions = null;
    game._mentionDecorDeferred = true;
    resetInputState();
    pushKeys('.\x1b' + ' '.repeat(30));
    await moveloop_core();
    assert.equal(game.flags.mention_decor, true, 'moveloop start applies the rc value once');
    await toggleMentionDecorOff();
    assert.equal(game.flags.mention_decor, false);
    pushKeys('.\x1b' + ' '.repeat(30));
    await moveloop_core();
    assert.equal(game.flags.mention_decor, false, 'a later command must not re-read the rc and undo the option change');
});
// The full 'O' options menu's mention_decor toggle, as options_interactive
// drives its full-menu rows (the simple menu lists only editor options).
async function toggleMentionDecorOff() {
    const input = resetInputState();
    const command = rhack('m'.charCodeAt(0));
    await input.waitUntilBlocked();
    input.feed('O');
    const screen = () => requireGameDisplay(game).grid
        .map((row) => row.map((cell) => cell.ch).join('')).join('\n');
    for (let page = 0; page < 20; page++) {
        await input.waitUntilBlocked();
        const row = screen().split('\n').find((line) => /mention_decor/.test(line));
        const key = row?.match(/^\s*([a-zA-Z?]) [-+*#] /)?.[1];
        if (key && row) {
            input.feed(key);
            await input.waitUntilBlocked();
            input.feed('\n');
            await command;
            return;
        }
        input.feed(' ');
    }
    input.feed('\x1b');
    await command;
    assert.fail('The full options menu did not offer mention_decor');
}
//# sourceMappingURL=mention_decor_defer.test.js.map