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
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { argumentTokens, callLine, classifyArgs } from '../scripts/lib/gap-args.mjs';
void test('the argument ledger detects a regression in one of two same-named C callers', t => {
    const root = fileURLToPath(new URL('..', import.meta.url));
    const cache = join(root, '.cache');
    mkdirSync(cache, { recursive: true });
    const scratch = mkdtempSync(join(cache, 'static-gaps-args-ledger-'));
    t.after(() => rmSync(scratch, { recursive: true, force: true }));
    const scripts = join(scratch, 'scripts');
    const cRoot = join(scratch, 'native');
    mkdirSync(scripts);
    mkdirSync(join(scratch, 'src', 'js'), { recursive: true });
    mkdirSync(join(cRoot, 'src'), { recursive: true });
    mkdirSync(join(cRoot, 'include'));
    copyFileSync(join(root, 'scripts', 'static-gaps.mjs'), join(scripts, 'static-gaps.mjs'));
    symlinkSync(join(root, 'scripts', 'lib'), join(scripts, 'lib'), 'dir');
    symlinkSync(join(root, 'node_modules'), join(scratch, 'node_modules'), 'dir');
    writeFileSync(join(scratch, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true } }));
    writeFileSync(join(cRoot, 'include', 'nhlua.h'), '');
    writeFileSync(join(cRoot, 'src', 'allmain.c'), 'int set_flag(int flag) { return flag; }\n');
    const callerSource = (flag) => `
#define TRUE ((unsigned char) 1)
#define FALSE ((unsigned char) 0)
int set_flag(int flag);
static int update_flag(void) { return set_flag(${flag}); }
`;
    writeFileSync(join(cRoot, 'src', 'first.c'), callerSource('TRUE'));
    writeFileSync(join(cRoot, 'src', 'second.c'), callerSource('TRUE'));
    writeFileSync(join(scratch, 'src', 'js', 'flags.ts'), `
export function setFlag(flag: boolean): boolean { return flag; }
export function updateFlag(): boolean { return setFlag(true); }
`);
    const ledger = join(scratch, 'c-args.tsv');
    const run = (option, expectedStatus) => {
        const result = spawnSync(process.execPath, [join(scripts, 'static-gaps.mjs'), 'args', option, ledger], {
            cwd: scratch,
            env: { ...process.env, NETHACK_SOURCE: cRoot },
            encoding: 'utf8',
            timeout: 15000,
            maxBuffer: 64 * 1024,
        });
        assert.equal(result.status, expectedStatus, `${option}: ${result.error?.message ?? ''}\n${result.stdout}\n${result.stderr}`);
    };
    run('--write-ledger', 0);
    run('--check-ledger', 0);
    // The first file still matches; it cannot cover the second file's loss.
    writeFileSync(join(cRoot, 'src', 'second.c'), callerSource('FALSE'));
    run('--check-ledger', 1);
});
void test('an argument whose expansion location omits both elided keys resolves in print order', () => {
    // clang's JSON dumper omits a location's `file` and `line` when they
    // equal the last location it printed (CI lost engrave.c's
    // `getrumor(..., TRUE)` to that elision). The realistic shape omits
    // both keys — the dumper never prints a file without its line — and
    // mirrors a real dump's argument (pray.c's rn2), whose spelling
    // location is elided the same way; the nested cast's deeper location
    // must not capture.
    const call = {
        kind: 'CallExpr',
        range: {
            begin: { offset: 10, file: 'src/engrave.c', line: 57, col: 12, tokLen: 8 },
            end: { offset: 70, col: 63, tokLen: 1 },
        },
        inner: [
            { kind: 'DeclRefExpr', referencedDecl: { name: 'getrumor' },
                range: { begin: { offset: 10, col: 12, tokLen: 8 } } },
            { kind: 'IntegerLiteral', value: '0', range: { begin: { offset: 21, col: 21, tokLen: 1 } } },
            { kind: 'ParenExpr',
                range: {
                    begin: {
                        spellingLoc: { offset: 3947, col: 15, tokLen: 6 },
                        expansionLoc: { offset: 42, col: 59, tokLen: 4 },
                    },
                    end: {
                        spellingLoc: { offset: 3958, col: 25, tokLen: 1 },
                        expansionLoc: { offset: 42, col: 59, tokLen: 4 },
                    },
                },
                inner: [{ kind: 'CStyleCastExpr',
                        range: { begin: { expansionLoc: { offset: 42, col: 62, tokLen: 4 } } },
                        inner: [{ kind: 'IntegerLiteral', value: '1' }] }] },
        ],
    };
    // The plain `0` has no expansion location; the TRUE argument's token
    // resolves both elided keys from the last printed location above it.
    assert.deepEqual(argumentTokens(call, { file: 'src/engrave.c', line: 55 }), [null, { file: 'src/engrave.c', line: 57, col: 59, tokLen: 4 }]);
});
void test('a macro-argument expansion location is not captured', () => {
    // The dumper marks tokens written inside another macro's argument list
    // (here the shape of pray.c's rn2 argument); clang versions position
    // them differently, so the replay skips them.
    const call = {
        kind: 'CallExpr',
        range: { begin: { offset: 41316, file: 'src/pray.c', line: 1126, col: 18, tokLen: 3 } },
        inner: [
            { kind: 'DeclRefExpr', referencedDecl: { name: 'rn2' },
                range: { begin: { offset: 41316, col: 18, tokLen: 3 } } },
            { kind: 'UnaryOperator', range: { begin: {
                        spellingLoc: { offset: 41320, col: 22, tokLen: 11 },
                        expansionLoc: { offset: 41316, col: 18, tokLen: 3, isMacroArgExpansion: true },
                    } } },
        ],
    };
    assert.deepEqual(argumentTokens(call, { file: 'src/pray.c', line: 1120 }), [null]);
});
void test('the same totals split differently across calls are uncomparable', () => {
    // C spells one boolean in one call and three in the other; the port
    // spells two in each. The totals agree, but no port call can align
    // with a C call, so the pair cannot be compared.
    const verdict = classifyArgs([['TRUE'], ['FALSE', 'FALSE', 'FALSE']], [{ values: ['true', 'false'], optionsObject: false }, { values: ['true', 'false'], optionsObject: false }]);
    assert.equal(verdict.verdict, 'uncomparable');
});
void test('equal per-call counts with different values mismatch', () => {
    // Both sides hold one call with one boolean and one with two; paired
    // by length, both pairs spell different values.
    const verdict = classifyArgs([['TRUE'], ['FALSE', 'FALSE']], [{ values: ['true', 'false'], optionsObject: false }, { values: ['false'], optionsObject: false }]);
    assert.equal(verdict.verdict, 'mismatch');
});
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
    // The port split the pair's booleans differently across its calls; the
    // port's non-literal calls (defaults, variables) are not occurrences.
    assert.equal(classifyArgs([['TRUE']], [{ values: ['true', 'false'], optionsObject: false }]).verdict, 'uncomparable');
    assert.equal(classifyArgs([['TRUE'], ['FALSE']], [{ values: ['true'], optionsObject: false }]).verdict, 'uncomparable');
});
void test('a flag inside an options object makes the pair uncomparable even when a literal call matches', () => {
    // C spells one boolean site and passes a variable elsewhere; the port
    // moves the boolean site's flag into an options object and spells the
    // variable site as a literal. The literal call alone would match, but
    // nothing can align the object's flag, so the pair is uncomparable —
    // not a match the ledger freezes.
    const verdict = classifyArgs([['TRUE']], [{ values: [], optionsObject: true }, { values: ['true'], optionsObject: false }]);
    assert.equal(verdict.verdict, 'uncomparable');
    assert.equal(classifyArgs([['TRUE']], [{ values: [], optionsObject: true }]).verdict, 'uncomparable');
});
void test('a call line omitted by the expansion location resolves through the spelling location', () => {
    // clang omits a location's line when it equals the previously printed
    // location's; within a macro location the spelling location prints
    // first, so an expansion location without a line takes the spelling
    // location's line, not whatever line the tracker held before the call.
    const call = {
        kind: 'CallExpr',
        range: { begin: {
                spellingLoc: { offset: 3947, file: 'include/global.h', line: 100, col: 15, tokLen: 6 },
                expansionLoc: { offset: 42, file: 'src/engrave.c', col: 57, tokLen: 4 },
            } },
    };
    assert.equal(callLine(call, 55), 100);
    // When the spelling location omits its line as well, the line comes
    // from the location just above the call.
    const bothElided = {
        kind: 'CallExpr',
        range: { begin: {
                spellingLoc: { offset: 3947, col: 15, tokLen: 6 },
                expansionLoc: { offset: 42, col: 57, tokLen: 4 },
            } },
    };
    assert.equal(callLine(bothElided, 57), 57);
});
//# sourceMappingURL=static-gaps-args.test.js.map