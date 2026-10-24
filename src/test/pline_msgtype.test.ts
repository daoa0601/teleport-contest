import assert from 'node:assert/strict';
import test from 'node:test';
import { clearMessageWindow, flush_screen, plineWithContinuation } from '../js/display.js';
import { requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { applyNethackrc, parseNethackrc } from '../js/options.js';
import { dolook } from '../js/invent.js';
import { freshPlayableRoom } from './support/playable-room.js';

function topline(): string {
    return requireGameDisplay().grid[0]?.map(cell => cell.ch).join('').trimEnd() ?? '';
}

void test('MSGTYPE hide suppresses matching prose without replacing unread prose', async () => {
    freshPlayableRoom();
    applyNethackrc('MSGTYPE=hide "bell"');
    await plineWithContinuation('The door opens.');

    await plineWithContinuation('A bell rings.');
    await flush_screen(1);

    assert.equal(topline(), 'The door opens.');
});

void test('MSGTYPE norep compares the previous individual message', async () => {
    freshPlayableRoom();
    applyNethackrc('MSGTYPE=norep "bell"');
    await plineWithContinuation('The door opens.');
    await plineWithContinuation('A bell rings.');

    await plineWithContinuation('A bell rings.');
    await flush_screen(1);

    assert.equal(topline(), 'The door opens.  A bell rings.');
});

void test('a matching show rule overrides the caller no-repeat request', async () => {
    freshPlayableRoom();
    applyNethackrc('MSGTYPE=show "bell"');
    await plineWithContinuation('A bell rings.');

    await plineWithContinuation('A bell rings.', { noRepeat: true });
    await flush_screen(1);

    assert.equal(topline(), 'A bell rings.  A bell rings.');
});

void test('later MSGTYPE rules take priority and matching remains case sensitive', async () => {
    freshPlayableRoom();
    applyNethackrc('MSGTYPE=hide ".*"\nMSGTYPE=show "^A bell"');

    await plineWithContinuation('A bell rings.');
    await plineWithContinuation('A Bell rings.');
    await flush_screen(1);

    assert.equal(topline(), 'A bell rings.');
});

void test('MSGTYPE stop waits after showing the new message', async () => {
    freshPlayableRoom();
    applyNethackrc('MSGTYPE=stop "bell"');
    const input = resetInputState();
    const writing = plineWithContinuation('A bell rings.');
    try {
        const state = await Promise.race([
            writing.then(() => 'finished'),
            input.waitUntilBlocked().then(() => 'waiting'),
        ]);
        assert.equal(state, 'waiting');
        assert.equal(topline(), 'A bell rings.--More--');
    } finally {
        input.feed(' ');
        await writing;
    }
});

void test('urgent messages bypass a matching hide rule', async () => {
    freshPlayableRoom();
    applyNethackrc('MSGTYPE=hide ".*"');

    await plineWithContinuation('Run!', { urgent: true });
    await flush_screen(1);

    assert.equal(topline(), 'Run!');
});

for (const [directive, message] of [
    ['MSGTYPE=quiet "bell"', "Unknown message type 'quiet'"],
    ['MSGTYPE=hide bell', 'Malformed MSGTYPE'],
] as const) {
    void test(`${directive} reports a configuration error`, () => {
        const config = parseNethackrc(directive);
        const errors = config.configErrors.flatMap(report => report.errors);
        assert.equal(errors.length, 1);
        assert.equal(errors[0]?.message, message);
    });
}

void test('MSGTYPE patterns support POSIX character classes and escaped punctuation', async () => {
    freshPlayableRoom();
    applyNethackrc('MSGTYPE=hide "^You hear [[:digit:]]+ bells[.]$"');

    await plineWithContinuation('You hear 12 bells.');
    await flush_screen(1);

    assert.equal(topline(), '');
});

void test('message-type overrides bypass both hiding and no-repeat', async () => {
    freshPlayableRoom();
    applyNethackrc('MSGTYPE=hide ".*"');

    await plineWithContinuation('Run!', { overrideMessageType: true });
    await plineWithContinuation('Run!', { overrideMessageType: true, noRepeat: true });
    await flush_screen(1);

    assert.equal(topline(), 'Run!  Run!');
});

void test('explicit look-here bypasses hidden feedback and restores filtering afterward', async () => {
    freshPlayableRoom();
    applyNethackrc('MSGTYPE=hide "You see"');

    await dolook();
    await flush_screen(1);
    assert.equal(topline(), 'You see no objects here.');
    clearMessageWindow();
    await plineWithContinuation('You see no objects here.');
    await flush_screen(1);
    assert.equal(topline(), '');
});

void test('POSIX message patterns treat backslash-d as a literal letter', async () => {
    freshPlayableRoom();
    applyNethackrc('MSGTYPE=hide "^\\d+$"');

    await plineWithContinuation('ddd');
    await plineWithContinuation('123');
    await flush_screen(1);

    assert.equal(topline(), '123');
});

for (const pattern of ['[[.a.]]', '[[=a=]]']) {
    void test(`the POSIX bracket expression ${pattern} matches its character`, async () => {
        freshPlayableRoom();
        applyNethackrc(`MSGTYPE=hide "^${pattern}$"`);

        await plineWithContinuation('a');
        await flush_screen(1);

        assert.equal(topline(), '');
    });
}
