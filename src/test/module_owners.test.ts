import test from 'node:test';
import assert from 'node:assert/strict';

import { MIXED_TOLERANCE, moduleOwnership, removedModuleKeys } from '../scripts/lib/module-owners.mjs';
import { originCitation } from '../scripts/lib/gap-edges.mjs';
import type { OwnerEdge } from '../scripts/lib/module-owners.mjs';

// The edges mapping located as `src/js/file.ts:line`, the way the report
// feeds it: a C function and the port functions it maps to.
function edge(cFile: string, cFunction: string, ports: string[]): OwnerEdge {
    return { file: cFile, function: cFunction, port: ports };
}

void test('a module whose mapped functions all come from one C file is single-owner', () => {
    const report = moduleOwnership([
        edge('trap.c', 'maketrap', ['src/js/trap.ts:31']),
        edge('trap.c', 'mintrap', ['src/js/trap.ts:212']),
        // Several counterparts in the same module are one mapped function.
        edge('trap.c', 'dofiretrap', ['src/js/trap.ts:501', 'src/js/trap.ts:640']),
    ]);

    const trap = report.modules.find(row => row.module === 'src/js/trap.ts');
    assert.ok(trap, 'trap module reported');
    assert.equal(trap.dominant, 'trap.c');
    assert.deepEqual(trap.minority, []);
    assert.equal(trap.mapped, 3);
    assert.deepEqual(report.singleOwnerKeys, ['src/js/trap.ts\ttrap.c']);
});

void test('a module with strays lists the minority functions with their C file', () => {
    const report = moduleOwnership([
        edge('mklev.c', 'mklev', ['src/js/mklev.ts:10']),
        edge('mklev.c', 'savelev', ['src/js/mklev.ts:80']),
        edge('mkobj.c', 'mkobj', ['src/js/mklev.ts:150']),
        edge('trap.c', 'maketrap', ['src/js/mklev.ts:200', 'src/js/trap.ts:31']),
        edge('trap.c', 'mintrap', ['src/js/trap.ts:212']),
    ]);

    const mklev = report.modules.find(row => row.module === 'src/js/mklev.ts');
    assert.ok(mklev, 'mklev module reported');
    assert.equal(mklev.dominant, 'mklev.c');
    assert.deepEqual(mklev.minority, [
        { file: 'mkobj.c', functions: ['mkobj'] },
        { file: 'trap.c', functions: ['maketrap'] },
    ]);
    assert.ok(!mklev.beyondTolerance, 'two strays stay within tolerance');
    assert.ok(!report.singleOwnerKeys.includes('src/js/mklev.ts\tmklev.c'));

    const trap = report.modules.find(row => row.module === 'src/js/trap.ts');
    assert.ok(trap, 'trap module reported');
    assert.deepEqual(trap.minority, []);
});

void test(`a module goes beyond tolerance at ${MIXED_TOLERANCE + 1} minority functions`, () => {
    const dominant = [edge('do.c', 'dopickup', ['src/js/do.ts:5']), edge('do.c', 'ggetobj', ['src/js/do.ts:60'])];
    const twoStrays = [edge('hack.c', 'newu', ['src/js/do.ts:20']), edge('mon.c', 'movemon', ['src/js/do.ts:40'])];

    const within = moduleOwnership([...dominant, ...twoStrays]);
    assert.equal(within.modules[0]?.beyondTolerance, false, 'two strays stay within the tolerance');

    const beyond = moduleOwnership([...dominant, ...twoStrays, edge('hack.c', 'unmul', ['src/js/do.ts:90'])]);
    assert.equal(beyond.modules[0]?.beyondTolerance, true, 'a third stray goes beyond the tolerance');
});

void test('one C function mapped into two modules counts on both sides', () => {
    const report = moduleOwnership([
        edge('hack.c', 'newu', ['src/js/hack.ts:12', 'src/js/allmain.ts:900']),
        edge('hack.c', 'moveloop', ['src/js/allmain.ts:990']),
    ]);

    const hack = report.modules.find(row => row.module === 'src/js/hack.ts');
    const allmain = report.modules.find(row => row.module === 'src/js/allmain.ts');
    assert.ok(hack && allmain, 'both modules reported');
    assert.deepEqual(hack.minority, []);
    assert.deepEqual(allmain.minority, []);
    // Both hold hack.c functions only, so both are single-owner for it.
    assert.deepEqual(report.singleOwnerKeys, ['src/js/allmain.ts\thack.c', 'src/js/hack.ts\thack.c']);
});

void test('ledger rows for modules a consolidation deleted are removed, not lost', () => {
    const removed = removedModuleKeys(
        ['src/js/trap.ts\ttrap.c', 'src/js/container_loot.ts\tpickup.c', 'src/js/magic_mapping.ts\tdetect.c'],
        module => module === 'src/js/trap.ts',
    );

    assert.deepEqual([...removed], ['src/js/container_loot.ts\tpickup.c', 'src/js/magic_mapping.ts\tdetect.c']);
});

void test('a C file spread over modules lists them, most mapped functions first', () => {
    const report = moduleOwnership([
        edge('hack.c', 'newu', ['src/js/hack.ts:12', 'src/js/allmain.ts:900']),
        edge('hack.c', 'moveloop', ['src/js/allmain.ts:990']),
        edge('hack.c', 'unmul', ['src/js/allmain.ts:1200']),
        edge('trap.c', 'maketrap', ['src/js/trap.ts:31']),
    ]);

    const hack = report.cFiles.find(row => row.file === 'hack.c');
    assert.ok(hack, 'hack.c spread reported');
    assert.equal(hack.mapped, 3);
    assert.deepEqual(hack.modules, [
        { module: 'src/js/allmain.ts', count: 3 },
        { module: 'src/js/hack.ts', count: 1 },
    ]);
});

void test('only a comment block that opens with C file.c:name() is an origin citation', () => {
    assert.equal(originCitation('// C zap.c:dobuzz(). The port fires a bolt.'), 'dobuzz');
    assert.equal(originCitation('// sp_lev.c:get_free_room_loc(). No C prefix.'), 'get_free_room_loc');

    // Prose mentions of other C functions are callee coverage, never origin.
    assert.equal(originCitation('// The dobuzz port reaches ureflects() as heroReflectionSource.'), null);
    assert.equal(originCitation('// bl_unconsc reads trap.c:unconscious() as the helplessness flag.'), null);
    assert.equal(originCitation('// Forwarded through stop_occupation(), via xytodir().'), null);
    assert.equal(originCitation('// Ref: zap.c buzz(), dobuzz() and friends.'), null);
    assert.equal(originCitation(undefined), null);
});
