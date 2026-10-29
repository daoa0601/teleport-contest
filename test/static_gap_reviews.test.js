import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
const root = process.cwd();
const piece = 'The creature unlocks and opens a door.';
const key = `allmain.c\tshow_message\t${piece}`;
const location = 'src/js/monster_door_passage.ts:resolveMonsterDoorPassage';
function runMessages(review, options = [], nativePiece = piece) {
    mkdirSync(join(root, '.cache'), { recursive: true });
    const dir = mkdtempSync(join(root, '.cache', 'static-reviewed-test-'));
    try {
        const native = join(dir, 'native');
        mkdirSync(join(native, 'src'), { recursive: true });
        mkdirSync(join(native, 'include'));
        writeFileSync(join(native, 'include', 'nhlua.h'), '');
        writeFileSync(join(native, 'src', 'allmain.c'), `void pline(const char *);\nvoid show_message(void) { pline(${JSON.stringify(nativePiece)}); }\n`);
        const ledger = join(dir, 'reviews.tsv');
        const present = join(dir, 'present.tsv');
        writeFileSync(ledger, review);
        writeFileSync(present, '# No previously present literals in this small C source.\n');
        const result = spawnSync(process.execPath, [join(root, 'scripts', 'static-gaps.mjs'), 'messages',
            '--reviewed-ledger', ledger, '--check-ledger', present, ...options], {
            cwd: root, env: { ...process.env, NETHACK_SOURCE: native }, encoding: 'utf8', timeout: 30000,
        });
        assert.ifError(result.error);
        return { status: result.status, output: result.stdout + result.stderr };
    }
    finally {
        rmSync(dir, { recursive: true, force: true });
    }
}
await test('reviewed compositions leave the missing list and are explained with --verbose', () => {
    const review = `${key}\tcomposed\t${location}; actor and door action are joined.\n`;
    const normal = runMessages(review);
    assert.equal(normal.status, 0, normal.output);
    assert.match(normal.output, /messages \(printed or prompted\): 0 of 1/);
    assert.match(normal.output, /composed: 1/);
    assert.doesNotMatch(normal.output, /actor and door action are joined/);
    const verbose = runMessages(review, ['--verbose']);
    assert.equal(verbose.status, 0, verbose.output);
    assert.match(verbose.output, /actor and door action are joined/);
});
await test('each non-composition verdict is counted separately', () => {
    for (const verdict of ['dead', 'out-of-scope', 'diagnostic']) {
        const result = runMessages(`${key}\t${verdict}\tA reviewed native condition.\n`);
        assert.equal(result.status, 0, result.output);
        assert.match(result.output, new RegExp(`${verdict}: 1`));
        assert.match(result.output, /messages \(printed or prompted\): 0 of 1/);
    }
});
await test('a removed C literal fails the ledger check', () => {
    const result = runMessages(`allmain.c\tremoved_message\tA removed native literal.\tdead\tNever reachable.\n`);
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /stale.*C literal/i);
    assert.match(result.output, /removed_message/);
});
await test('a missing composed port file fails without hiding the missing message', () => {
    const result = runMessages(`${key}\tcomposed\tsrc/js/no_such_reviewed_port.ts:showMessage\n`);
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /stale.*port file/i);
    assert.match(result.output, /messages \(printed or prompted\): 1 of 1/);
});
await test('a function mention does not keep a removed composition alive', () => {
    // The native name is mentioned in monster_door_passage.ts comments;
    // the actual port function has a different name.
    const result = runMessages(`${key}\tcomposed\tsrc/js/monster_door_passage.ts:postmov\n`);
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /stale.*function.*postmov/i);
});
await test('every cited composition location is checked', () => {
    const result = runMessages(`${key}\tcomposed\t${location}; src/js/no_such_reviewed_port.ts:showMessage also prints it.\n`);
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /stale.*port file/i);
});
await test('escaped native pieces use the same keys as the present-message ledger', () => {
    const native = 'A path C:\\notes\\file\tline\nnext';
    const encoded = 'A path C:\\\\notes\\\\file\\tline\\nnext';
    const result = runMessages(`allmain.c\tshow_message\t${encoded}\tdiagnostic\tAn example native diagnostic.\n`, [], native);
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /diagnostic: 1/);
    assert.match(result.output, /messages \(printed or prompted\): 0 of 1/);
});
await test('malformed reviewed rows fail with a line number and an actionable reason', () => {
    const invalid = [
        [`${key}\tunknown\tA reason.`, /verdict/],
        [`${key}\tdead`, /five tab-separated columns/],
        [`${key}\tcomposed\tNo port location.`, /port location/],
        [`${key}\tdead\t`, /reason/],
        [`allmain.c\tshow_message\tbad\\q escape\tdead\tA reason.`, /invalid escape/],
        [`${key}\tdead\tA reason.\n${key}\tdead\tAnother reason.`, /duplicate/],
    ];
    for (const [row, expected] of invalid) {
        const result = runMessages(row);
        assert.equal(result.status, 1, result.output);
        assert.match(result.output, /reviews.tsv:\d+/);
        assert.match(result.output, expected);
    }
});
//# sourceMappingURL=static_gap_reviews.test.js.map