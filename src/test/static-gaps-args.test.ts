// static-gaps-args.test.js — the decision rules behind `static-gaps.mjs args`.
//
// The mode's verdicts decide what CI freezes (matching pairs go into
// docs/ledger/c-args.tsv) and what an audit reads (mismatches); the location
// replay decides which C arguments are seen at all. These tests pin both:
// equal multisets match, the same counts with different values mismatch,
// different counts, options objects, or flags folded elsewhere are
// uncomparable, and an argument whose clang location omits the elided
// `file`/`line` keys still resolves (CI lost engrave.c's
// `getrumor(..., TRUE)` to that elision, pr730).

import test from 'node:test';
import assert from 'node:assert/strict';

import { argumentTokens, classifyArgs } from '../scripts/lib/gap-args.mjs';

void test('an argument whose expansion location omits elided keys resolves them in print order', () => {
    // clang's JSON dumper omits a location's `file` and `line` when they
    // equal the last location it printed, so a location only means
    // something in print order. Here the macro's spelling location prints
    // line 57 just before the argument's expansion location, which elides
    // the line; the nested cast's own expansion location must not capture.
    const call = {
        kind: 'CallExpr',
        range: {
            begin: { offset: 10, file: 'src/engrave.c', line: 57, col: 12, tokLen: 8 },
            end: { offset: 70, line: 57, col: 63, tokLen: 1 },
        },
        inner: [
            { kind: 'DeclRefExpr', referencedDecl: { name: 'getrumor' },
                range: { begin: { offset: 10, col: 12, tokLen: 8 } } },
            { kind: 'IntegerLiteral', value: '0', range: { begin: { offset: 21, col: 21, tokLen: 1 } } },
            { kind: 'ParenExpr',
                range: {
                    begin: {
                        spellingLoc: { offset: 3947, file: 'include/global.h', line: 57, col: 15, tokLen: 6 },
                        expansionLoc: { offset: 42, file: 'src/engrave.c', col: 59, tokLen: 4 },
                    },
                    end: {
                        spellingLoc: { offset: 3958, file: 'include/global.h', line: 57, col: 25, tokLen: 1 },
                        expansionLoc: { offset: 42, file: 'src/engrave.c', line: 57, col: 59, tokLen: 4 },
                    },
                },
                inner: [{ kind: 'CStyleCastExpr',
                    range: { begin: { expansionLoc: { offset: 42, file: 'src/engrave.c', line: 57, col: 62, tokLen: 4 } } },
                    inner: [{ kind: 'IntegerLiteral', value: '1' }] }] },
        ],
    };
    // The plain `0` argument has no expansion location; the TRUE argument
    // resolves its elided line from the spelling location printed before it.
    assert.deepEqual(argumentTokens(call, { file: 'src/engrave.c', line: 55 }),
        [null, { file: 'src/engrave.c', line: 57, col: 59, tokLen: 4 }]);
});

void test('equal per-call sequences match, in any call order', () => {
    const verdict = classifyArgs(
        [['TRUE'], ['FALSE']],
        [{ values: ['false'], optionsObject: false }, { values: ['true'], optionsObject: false }]);
    assert.equal(verdict.verdict, 'match');
});

void test('several boolean arguments compare as a sequence', () => {
    assert.equal(classifyArgs([['TRUE', 'FALSE']], [{ values: ['true', 'false'], optionsObject: false }]).verdict, 'match');
    assert.equal(classifyArgs([['TRUE', 'FALSE']], [{ values: ['false', 'true'], optionsObject: false }]).verdict, 'mismatch');
});

void test('the same counts with different values mismatch', () => {
    // The reset_utrap bug class: C reset_utrap(TRUE), port resetUtrap(false).
    const verdict = classifyArgs([['TRUE']], [{ values: ['false'], optionsObject: false }]);
    assert.equal(verdict.verdict, 'mismatch');
});

void test('a different number of calls is uncomparable', () => {
    const verdict = classifyArgs([['TRUE']], [{ values: ['true'], optionsObject: false }, { values: ['true'], optionsObject: false }]);
    assert.equal(verdict.verdict, 'uncomparable');
});

void test('a different number of boolean arguments is uncomparable', () => {
    // The port moved the flag into a default parameter or a variable.
    assert.equal(classifyArgs([['TRUE']], [{ values: [], optionsObject: false }]).verdict, 'uncomparable');
    assert.equal(classifyArgs([['TRUE']], [{ values: ['true', 'false'], optionsObject: false }]).verdict, 'uncomparable');
});

void test('a flag inside an options object is uncomparable', () => {
    const verdict = classifyArgs([['TRUE']], [{ values: [], optionsObject: true }]);
    assert.equal(verdict.verdict, 'uncomparable');
});

