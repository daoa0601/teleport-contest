// static-gaps-args.test.js — the multiset rules behind `static-gaps.mjs args`.
//
// The mode's verdicts decide what CI freezes (matching pairs go into
// docs/ledger/c-args.tsv) and what an audit reads (mismatches). These tests
// pin the classification rules from the C/Lua porting brief: equal multisets
// match, the same counts with different values mismatch, and different
// counts, options objects, or flags folded elsewhere are uncomparable.
import test from 'node:test';
import assert from 'node:assert/strict';
import { argLedgerKey, classifyArgs } from '../scripts/lib/gap-args.mjs';
void test('equal per-call sequences match, in any call order', () => {
    const verdict = classifyArgs([['TRUE'], ['FALSE']], [{ values: ['false'], optionsObject: false }, { values: ['true'], optionsObject: false }]);
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
void test('the ledger key is stable under reordering but sensitive to value and count changes', () => {
    // The ledger check fails when a key it froze disappears, so the key must
    // not churn for equivalent input, and must change when a matching pair
    // flips a literal or gains a call.
    const unordered = argLedgerKey('fix_worst_trouble', 'reset_utrap', [['TRUE'], ['FALSE']]);
    const reordered = argLedgerKey('fix_worst_trouble', 'reset_utrap', [['FALSE'], ['TRUE']]);
    assert.equal(unordered, reordered);
    assert.notEqual(unordered, argLedgerKey('fix_worst_trouble', 'reset_utrap', [['FALSE'], ['FALSE']]));
    assert.notEqual(unordered, argLedgerKey('fix_worst_trouble', 'reset_utrap', [['TRUE']]));
});
//# sourceMappingURL=static-gaps-args.test.js.map