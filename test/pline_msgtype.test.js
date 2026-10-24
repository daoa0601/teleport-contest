import assert from 'node:assert/strict';
import test from 'node:test';
import { clearMessageWindow, flush_screen, plineWithContinuation } from '../js/display.js';
import { requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { applyNethackrc, parseNethackrc } from '../js/options.js';
import { dolook } from '../js/invent.js';
import { freshPlayableRoom } from './support/playable-room.js';
function topline() {
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
    }
    finally {
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
]) {
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
for (const [pattern, hidden, visible] of [
    ['A \\s+ bell', 'A sss bell', 'A   bell'],
    ['A \\S+ bell', 'A SSS bell', 'A loud bell'],
    ['\\w+', 'www', 'word'],
    ['\\W+', 'WWW', '!!!'],
    ['\\bbell\\b', 'bbellb', 'bell'],
    ['\\Bbell\\B', 'BbellB', 'bell'],
    ['\\<bell\\>', '<bell>', 'bell'],
    ["\\`bell\\'", "`bell'", 'bell'],
    ['(bell)\\1', 'bell1', 'bellbell'],
]) {
    void test(`MSGTYPE treats native escaped characters in ${pattern} as literals`, async () => {
        freshPlayableRoom();
        const config = applyNethackrc(`MSGTYPE=hide "^${pattern}$"`);
        await plineWithContinuation(hidden);
        await plineWithContinuation(visible);
        await flush_screen(1);
        assert.equal(config.configErrors.flatMap(report => report.errors).length, 0);
        assert.equal(topline(), visible);
    });
}
for (const pattern of ['[[.a.]]', '[[=a=]]']) {
    void test(`the POSIX bracket expression ${pattern} matches its character`, async () => {
        freshPlayableRoom();
        applyNethackrc(`MSGTYPE=hide "^${pattern}$"`);
        await plineWithContinuation('a');
        await flush_screen(1);
        assert.equal(topline(), '');
    });
}
for (const pattern of [
    'A bell(?= rings)', 'A bell(?! stops)', '(?<=A )bell',
    '(?<!No )bell', '(?:A bell)', '(?<sound>A bell)',
]) {
    void test(`the non-POSIX pattern ${pattern} reports an error and leaves messages visible`, async () => {
        freshPlayableRoom();
        const config = applyNethackrc(`MSGTYPE=hide "${pattern}"`);
        await plineWithContinuation('A bell rings.');
        await flush_screen(1);
        assert.equal(topline(), 'A bell rings.');
        const errors = config.configErrors.flatMap(report => report.errors);
        assert.equal(errors.length, 1);
        assert.match(errors[0]?.message ?? '', /^MSGTYPE regex error:/);
    });
}
void test('POSIX groups and bracketed group punctuation still filter messages', async () => {
    freshPlayableRoom();
    const config = applyNethackrc('MSGTYPE=hide "^A (bell|gong)( rings)?[.]$"\n'
        + 'MSGTYPE=hide "^A bell[(][?]= rings[)]$"');
    await plineWithContinuation('A bell rings.');
    await plineWithContinuation('A bell(?= rings)');
    await plineWithContinuation('The door opens.');
    await flush_screen(1);
    assert.equal(topline(), 'The door opens.');
    assert.equal(config.configErrors.flatMap(report => report.errors).length, 0);
});
for (const pattern of ['bell|', '|bell', 'bell||gong', '(bell|)', '(|bell)', '((bell|))']) {
    void test(`MSGTYPE rejects the empty alternative in ${pattern} and keeps messages visible`, async () => {
        freshPlayableRoom();
        const config = applyNethackrc(`MSGTYPE=hide "${pattern}"`);
        await plineWithContinuation('A bell rings.');
        await flush_screen(1);
        const errors = config.configErrors.flatMap(report => report.errors);
        assert.equal(errors.length, 1);
        assert.equal(errors[0]?.message, 'MSGTYPE regex error: empty (sub)expression');
        assert.equal(topline(), 'A bell rings.');
    });
}
for (const [pattern, hidden] of [
    ['A (bell|()) rings[.]', 'A  rings.'],
    ['A ([|]|bell) rings[.]', 'A | rings.'],
    ['A (\\||bell) rings[.]', 'A | rings.'],
]) {
    void test(`MSGTYPE accepts the nonempty alternatives in ${pattern}`, async () => {
        freshPlayableRoom();
        const config = applyNethackrc(`MSGTYPE=hide "^${pattern}$"`);
        await plineWithContinuation(hidden);
        await plineWithContinuation('The door opens.');
        await flush_screen(1);
        assert.equal(config.configErrors.flatMap(report => report.errors).length, 0);
        assert.equal(topline(), 'The door opens.');
    });
}
for (const [pattern, hidden, visible] of [
    ['[0-9]+)', '12)', '12'],
    [')bell', ')bell', 'bell'],
    ['(bell))', 'bell)', 'bell'],
    ['(bell|gong))', 'gong)', 'gong'],
    ['\\(bell)', '(bell)', '(bell'],
    ['[(]bell)', '(bell)', '(bell'],
    ['bell){2}', 'bell))', 'bell)'],
]) {
    void test(`MSGTYPE treats the unmatched closing parenthesis in ${pattern} literally`, async () => {
        freshPlayableRoom();
        const config = applyNethackrc(`MSGTYPE=hide "^${pattern}$"`);
        await plineWithContinuation(hidden);
        await plineWithContinuation(visible);
        await flush_screen(1);
        assert.equal(config.configErrors.flatMap(report => report.errors).length, 0);
        assert.equal(topline(), visible);
    });
}
for (const [pattern, diagnostic] of [
    ['bell{2', 'braces not balanced'],
    ['bell{2,', 'braces not balanced'],
    ['bell{2,3', 'braces not balanced'],
    ['bell{2x}', 'invalid repetition count(s)'],
    ['bell{2,x}', 'invalid repetition count(s)'],
    ['bell{256}', 'maximum repetition exceeds 255'],
    ['bell{1,256}', 'maximum repetition exceeds 255'],
    ['{2', 'repetition-operator operand invalid'],
    ['{256}', 'repetition-operator operand invalid'],
    ['(bell|{2})', 'repetition-operator operand invalid'],
    ['bell{2}{3}', 'repetition-operator operand invalid'],
]) {
    void test(`MSGTYPE rejects the invalid repetition in ${pattern} without hiding messages`, async () => {
        freshPlayableRoom();
        const config = applyNethackrc(`MSGTYPE=hide "${pattern}"`);
        await plineWithContinuation(`A ${pattern} rings.`);
        await flush_screen(1);
        const errors = config.configErrors.flatMap(report => report.errors);
        assert.equal(errors.length, 1);
        assert.equal(errors[0]?.message, `MSGTYPE regex error: ${diagnostic}`);
        assert.equal(topline(), `A ${pattern} rings.`);
    });
}
for (const [pattern, hidden] of [
    ['bell{2}', 'belll'],
    ['bell{2,3}', 'bellll'],
    ['bell{2,}', 'bellllll'],
    ['bell{0}', 'bel'],
    ['(bell){2}', 'bellbell'],
    ['[bel]{2}', 'be'],
    ['bell\\?{2}', 'bell??'],
    ['bell{q}', 'bell{q}'],
    ['bell{,2}', 'bell{,2}'],
    ['bell\\{2', 'bell{2'],
    ['bell[{]2', 'bell{2'],
]) {
    void test(`the valid MSGTYPE brace pattern ${pattern} hides matching messages`, async () => {
        freshPlayableRoom();
        const config = applyNethackrc(`MSGTYPE=hide "^${pattern}$"`);
        await plineWithContinuation(hidden);
        await plineWithContinuation('The door opens.');
        await flush_screen(1);
        assert.equal(config.configErrors.flatMap(report => report.errors).length, 0);
        assert.equal(topline(), 'The door opens.');
    });
}
for (const [pattern, diagnostic] of [
    ['[', 'brackets ([ ]) not balanced'],
    ['[[:unknown:]]', 'invalid character class'],
    ['[[.word.]]', 'invalid collating element'],
    ['\\', 'trailing backslash (\\)'],
    ['(bell', 'parentheses not balanced'],
    ['[z-a]', 'invalid character range'],
    ['bell{3,2}', 'invalid repetition count(s)'],
    ['*bell', 'repetition-operator operand invalid'],
    ['A bell(?= rings)', 'repetition-operator operand invalid'],
]) {
    void test(`the malformed MSGTYPE pattern ${pattern} reports its POSIX diagnostic`, () => {
        const config = parseNethackrc(`MSGTYPE=hide "${pattern}"`);
        const errors = config.configErrors.flatMap(report => report.errors);
        assert.equal(errors.length, 1);
        assert.equal(errors[0]?.message, `MSGTYPE regex error: ${diagnostic}`);
    });
}
//# sourceMappingURL=pline_msgtype.test.js.map