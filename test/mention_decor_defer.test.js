import test from 'node:test';
import assert from 'node:assert/strict';
import { runSegment } from '../js/jsmain.js';
import { moveloop_core } from '../js/allmain.js';
import { rcfileOnlyThisOption } from '../js/cfgfiles.js';
import { rhack } from '../js/cmd.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { enableRngLog, getRngLog } from '../js/rng.js';
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
void test('a declined startup reports the deferred option\'s frame through the message window twice', async () => {
    const engine = await runSegment({
        seed: 29371, datetime: '20260112120000', moves: ' '.repeat(8), storage: memoryStorage(),
        nethackrc: 'OPTIONS=name:Iris,role:Wizard,race:human,gender:female,align:neutral,'
            + '!legacy,!autopickup,pettype:none,!tutorial,mention_decor:zzz',
    });
    try {
        // The message window is live by the deferred re-read, so
        // config_erradd() plines each diagnostic; a declined tutorial runs
        // maybe_do_tutorial()'s re-read and moveloop()'s own, so the frame
        // is delivered twice (two CHOOSE= core draws accompany them).
        const messages = [...engine.state._messageHistory, engine.state._pending_message]
            .join('\n');
        assert.match(messages, /'mention_decor:zzz' is not valid for a boolean/);
        assert.match(messages, /1 error in \.nethackrc/);
        const frames = messages.split('not valid for a boolean').length - 1;
        assert.equal(frames, 2, 'both re-reads deliver their config_error_done() frame');
    }
    finally {
        await engine.lua.destroy();
    }
});
void test('a configured tutorial enters without the declined tutorial\'s extra error frame', async () => {
    const engine = await runSegment({
        seed: 29371, datetime: '20260112120000', moves: ' '.repeat(24), storage: memoryStorage(),
        nethackrc: 'OPTIONS=name:Iris,role:Wizard,race:human,gender:female,align:neutral,'
            + '!legacy,!autopickup,pettype:none,tutorial,mention_decor:zzz',
    });
    try {
        const messages = [...engine.state._messageHistory, engine.state._pending_message].join('\n');
        assert.equal(messages.split('not valid for a boolean').length - 1, 1, 'only moveloop reports the deferred option after an accepted tutorial');
        assert.equal(engine.state._tutorialActive, true, 'the configured tutorial is accepted');
    }
    finally {
        await engine.lua.destroy();
    }
});
for (const statement of ['[missing]', 'CHOOSE', 'CHOOSE=', 'OPTIONS=mention_decor:bad']) {
    void test(`the deferred re-read reports ${statement} before later options and section choices`, async () => {
        await freshObjectRoom({ flags: { mention_decor: false } });
        game.nethackrc = `${statement}\nOPTIONS=mention_decor\nCHOOSE=alpha\n[alpha]\n`;
        game.nethackOptions = null;
        enableRngLog();
        const input = resetInputState();
        const reread = rcfileOnlyThisOption('mention_decor');
        try {
            await input.waitUntilBlocked();
            assert.ok(game._pending_message.includes(statement), 'the erroneous source line is displayed');
            assert.equal(game.flags.mention_decor, false, 'the later option waits for error acknowledgement');
            assert.equal(getRngLog().length, statement === 'CHOOSE=' ? 1 : 0, 'only choices preceding the error have consumed randomness');
        }
        finally {
            input.feed(' '.repeat(30));
            await reread;
        }
        assert.equal(game.flags.mention_decor, true, 'parsing resumes with the later option');
        assert.equal(getRngLog().length, statement === 'CHOOSE=' ? 2 : 1);
    });
}
for (const options of ['mention_decor,mention_decor:bad', 'mention_decor,!mention_decor']) {
    void test(`the deferred re-read waits before applying the next option in ${options}`, async () => {
        await freshObjectRoom({ flags: { mention_decor: false } });
        const sourceLine = `OPTIONS=${options}`;
        game.nethackrc = sourceLine;
        game.nethackOptions = null;
        const input = resetInputState();
        const reread = rcfileOnlyThisOption('mention_decor');
        try {
            await input.waitUntilBlocked();
            assert.ok(game._pending_message.includes(sourceLine), 'the erroneous source line is displayed');
            assert.equal(game.flags.mention_decor, false, 'the leftmost value waits for the earlier error, including a duplicate diagnostic');
        }
        finally {
            input.feed(' '.repeat(30));
            await reread;
        }
        assert.equal(game.flags.mention_decor, true);
        const messages = [...game._messageHistory, game._pending_message].join('\n');
        assert.equal(messages.split(sourceLine).length - 1, 1, 'multiple errors on one line echo the source only once');
    });
}
void test('the deferred re-read finishes file diagnostics before applying environment options', async () => {
    await freshObjectRoom({ flags: { mention_decor: false } });
    game.nethackrc = 'CHOOSE';
    game.nethackOptions = 'mention_decor';
    const input = resetInputState();
    const reread = rcfileOnlyThisOption('mention_decor');
    try {
        await input.waitUntilBlocked();
        assert.ok(game._pending_message.includes('CHOOSE'));
        assert.equal(game.flags.mention_decor, false);
    }
    finally {
        input.feed(' '.repeat(30));
        await reread;
    }
    assert.equal(game.flags.mention_decor, true);
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