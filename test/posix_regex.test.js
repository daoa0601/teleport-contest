import assert from 'node:assert/strict';
import test from 'node:test';
import { MSGTYP_NORMAL, MSGTYP_NOSHOW } from '../js/const.js';
import { addMessageTypeRule, messageTypeFor } from '../js/message_types.js';
for (const pattern of ['a*?', 'a+?', 'a??', 'a**', 'a*+', 'a{2}*', 'a*{2}', 'a{2}{3}']) {
    void test(`MSGTYPE rejects a second repetition operator in ${pattern}`, () => {
        const rules = [];
        const error = addMessageTypeRule(`hide "${pattern}"`, rules);
        assert.equal(error, 'MSGTYPE regex error: repetition-operator operand invalid');
        assert.equal(messageTypeFor('aaa', false, rules), MSGTYP_NORMAL);
    });
}
for (const pattern of ['[[:digit:]-a]', '[a-[:digit:]]', '[[=a=]-c]', '[a-b-c]']) {
    void test(`MSGTYPE reports an invalid character range for ${pattern}`, () => {
        const rules = [];
        const error = addMessageTypeRule(`hide "${pattern}"`, rules);
        assert.equal(error, 'MSGTYPE regex error: invalid character range');
        assert.equal(messageTypeFor('a', false, rules), MSGTYP_NORMAL);
    });
}
for (const [pattern, diagnostic] of [
    ['[[:<:]]*', 'repetition-operator operand invalid'],
    ['[[:>:]]{2}', 'repetition-operator operand invalid'],
    ['^?', 'repetition-operator operand invalid'],
    ['$*', 'repetition-operator operand invalid'],
    ['^{2x}', 'invalid repetition count(s)'],
    ['{256}', 'maximum repetition exceeds 255'],
    ['{2', 'braces not balanced'],
    ['{2x}', 'invalid repetition count(s)'],
    ['a{256,1}', 'invalid repetition count(s)'],
    ['a{2147483649,2147483648}', 'maximum repetition exceeds 255'],
    ['[a-[', 'brackets ([ ]) not balanced'],
    ['[[.a]]', 'invalid collating element'],
    ['[[=a]]', 'invalid collating element'],
    ['[[.ab.]]', 'invalid collating element'],
    ['[[:alpha]', 'invalid character class'],
    ['[[:word:]]', 'invalid character class'],
    ['(a|', 'parentheses not balanced'],
    ['(|', 'empty (sub)expression'],
]) {
    void test(`MSGTYPE reports the native diagnostic for ${pattern}`, () => {
        const rules = [];
        const error = addMessageTypeRule(`hide "${pattern}"`, rules);
        assert.equal(error, `MSGTYPE regex error: ${diagnostic}`);
        assert.equal(messageTypeFor('a', false, rules), MSGTYP_NORMAL);
    });
}
for (const [name, matching, visible] of [
    ['alnum', ['a', 'Z', '0'], ['_', '!']],
    ['alpha', ['a', 'Z'], ['0', 'é']],
    ['blank', [' ', '\t'], ['\n', 'a']],
    ['cntrl', ['\t', '\x01', '\x7f'], [' ', 'a']],
    ['digit', ['0', '9'], ['a', '²']],
    ['graph', ['!', 'a', '~'], [' ', '\t']],
    ['lower', ['a', 'z'], ['A', '1']],
    ['print', [' ', 'a', '~'], ['\n', '\x7f']],
    ['punct', ['!', '_', '-'], ['a', '0']],
    ['space', [' ', '\t', '\n', '\r', '\v', '\f'], ['a', '\x01']],
    ['upper', ['A', 'Z'], ['a', '0']],
    ['xdigit', ['0', 'a', 'F'], ['g', 'G']],
    ['rune', ['a', '\x01', '\x7f'], ['é']],
    ['ideogram', [], ['a', '字']],
    ['phonogram', [], ['a', 'あ']],
    ['special', [], ['a', '!']],
]) {
    void test(`MSGTYPE uses the recorder's C locale for the ${name} class`, () => {
        const rules = [];
        assert.equal(addMessageTypeRule(`hide "^[[:${name}:]]$"`, rules), null);
        for (const text of matching) {
            assert.equal(messageTypeFor(text, false, rules), MSGTYP_NOSHOW, `${name} should include ${JSON.stringify(text)}`);
        }
        for (const text of visible) {
            assert.equal(messageTypeFor(text, false, rules), MSGTYP_NORMAL, `${name} should exclude ${JSON.stringify(text)}`);
        }
    });
}
for (const [pattern, matching, visible] of [
    ['[[:<:]]bell[[:>:]]', ['bell', 'A bell rings.', 'bell!'], ['bells', 'doorbell', '_bell', 'bell_']],
    ['([[:<:]])?bell', ['bell', 'A bell rings.'], ['doorbell', '_bell']],
    ['([[:<:]])*bell', ['bell', 'A bell rings.'], ['doorbell', '_bell']],
    ['([[:<:]]){0,1}bell', ['bell', 'A bell rings.'], ['doorbell']],
    ['([[:<:]]){0,}bell', ['bell', 'A bell rings.'], ['doorbell']],
    ['(([[:<:]])?)?bell', ['bell', 'A bell rings.'], ['doorbell']],
    ['(x?[[:<:]])?bell', ['bell'], ['doorbell', 'xbell']],
    ['([[:<:]]x?)?bell', ['bell', 'xbell'], ['doorbell']],
    ['(^|[[:<:]])?bell', ['bell'], ['doorbell', 'A bell rings.']],
    ['(^)?bell', ['bell'], ['doorbell', 'A bell rings.']],
    ['bell([[:>:]])?', ['bell', 'bell!'], ['bells', 'bell_']],
    ['([[:<:]]x)?bell', ['bell', 'doorbell', 'xbell'], []],
    ['([[:<:]]){0}bell', ['bell', 'doorbell'], []],
    ['([[:<:]]){0,2}bell', ['bell', 'doorbell'], []],
    ['^[[:<:]]bell[[:>:]]$', ['bell'], ['Bell', 'bell\n', ' bell']],
    ['^(a|ab)c$', ['ac', 'abc'], ['abbc', 'xabc', 'abc\n']],
    ['^a.b$', ['a\nb', 'a b'], ['ab', 'aXXb']],
    ['^[^[:digit:]]+$', ['bell', '\n'], ['bell2', '2']],
    ['^[][-]+$', ['][-', '---'], ['x', 'a']],
    ['^[[.a.]-[.c.]]{2,3}$', ['ac', 'abc'], ['a', 'abcd']],
    ['^([[=a=]]|b){0,2}c$', ['c', 'ac', 'abc'], ['aaac', 'dc']],
    ['^((a?)*)b$', ['b', 'aaab'], ['aaa', 'bc']],
    ['^(a|aa)*b$', ['aaaaab'], ['aaaaaaaaaaaaaaaaaaaaaaaaaaaaac']],
    ['^a{2,}$', ['aa', 'aaaa'], ['a', 'aab']],
    ['^a{255}$', ['a'.repeat(255)], ['a'.repeat(254), 'a'.repeat(256)]],
    ['^a{0}$', [''], ['a']],
    ['^(^)*bell($)?$', ['bell'], ['bells', 'a bell']],
    ['a^b', [], ['ab', 'a^b']],
    ['a$b', [], ['ab', 'a$b']],
    ['^[[:digit:]-]+$', ['2-5', '-'], ['a']],
    ['^[[=hyphen=]-0]+$', ['-./0'], ['a']],
    ['^[[.NUL.]]$', [], ['a', '\0']],
    ['^.$', ['a'], ['é', '\0']],
    ['^..$', ['é'], ['a']],
    ['^bell$', ['bell\0ignored'], ['bell\n']],
]) {
    void test(`MSGTYPE matches native ERE behavior for ${pattern}`, () => {
        const rules = [];
        assert.equal(addMessageTypeRule(`hide "${pattern}"`, rules), null);
        for (const text of matching) {
            assert.equal(messageTypeFor(text, false, rules), MSGTYP_NOSHOW, `${pattern} should hide ${JSON.stringify(text)}`);
        }
        for (const text of visible) {
            assert.equal(messageTypeFor(text, false, rules), MSGTYP_NORMAL, `${pattern} should show ${JSON.stringify(text)}`);
        }
    });
}
//# sourceMappingURL=posix_regex.test.js.map