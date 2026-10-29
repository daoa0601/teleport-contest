"""Behavior tests for call-site reasoning, including emitted-JS mutants.

Run from verification/equivalence: uv run python ../callsites/test_callsites.py
"""
from __future__ import annotations

import json
from pathlib import Path
import subprocess
import tempfile
import unittest

from check import Bounds, classify

REPO = Path(__file__).resolve().parents[2]
EXTRACT = REPO / 'verification/callsites/extract.mjs'

SOURCE = '''
import { rn2, d } from './rng.js';
import { currentAttribute } from './attrib.js';
declare function touch(values: number[]): void;
declare function touchAndZero(values: number[]): number;
export function counter(values: number[]) {
    let count = 0;
    for (const value of values) { if (value > 0) rn2(++count); }
}
export function choices(flag: boolean) {
    let chance = 15;
    if (flag) chance = 1;
    else chance = 12;
    return rn2(chance);
}
export function guarded(values: number[]) {
    if (values.length === 0) return;
    return rn2(values.length);
}
export function mutable(values: number[]) {
    if (values.length === 0) return;
    touch(values);
    return rn2(values.length);
}
export function snapshot(values: number[]) {
    const count = values.length;
    if (count === 0) return;
    values.pop();
    return rn2(values.length);
}
export function nextIteration(values: number[]) {
    let count = values.length;
    if (count <= 0) return;
    for (const value of values) { rn2(count); count--; }
}
export function rechecked(values: number[]) {
    while (values.length > 0) { rn2(values.length); values.pop(); }
}
export function destructuring(flag: boolean) {
    let count = 1;
    if (flag) ({ count } = { count: 0 });
    return rn2(count);
}
export function zero() { return rn2(0); }
export function badNested() { return rn2(rn2(0)); }
export function divided(divisor: number) { return rn2(Math.trunc(2 / divisor)); }
export function dice() { return d(2, 6); }
export function constitution() { return rn2(30 - currentAttribute(4)); }
export function constitutionProbe() { return rn2(25 - currentAttribute(4)); }
export function strings() { const notes = 'ABCDEFG'; return rn2(notes.length); }
export function masks() { return rn2(((80 - 1) & ~1) - 3); }
function positive(n: number) { if (n <= 0) return 1; return n; }
export function helper(n: number) { return rn2(positive(n)); }
export function argumentMutation(values: number[]) {
    if (values.length === 0) return;
    return rn2(Math.max(touchAndZero(values), values.length));
}
export function earlierRead() { let remaining = 2; rn2(remaining); remaining = 0; }
export function shadowed(values: number[], other: number[]) {
    if (values.length > 0) { const values = other; return rn2(values.length); }
}
export function shadowIndex(values: number[], index: number, other: number) {
    if (values[index] > 0) { const index = other; return rn2(values[index]); }
}
export function customLength(values: { length: number }) { return rn2(values.length + 1); }
export function shadowMath(n: number) {
    const Math = { max: (a: number, b: number) => -1 };
    return rn2(Math.max(n, 1));
}
export function shadowNumber() { const Number = (x: boolean) => -2; return rn2(Number(true) + 1); }
let shared = 1;
function resetShared() { shared = 0; }
export function moduleState() { if (shared <= 0) return; resetShared(); return rn2(shared); }
export function orderedReads() { let n = 1; return rn2(++n - n); }
export function orderedUpdate() { let n = 1; n = ++n - n; return rn2(n); }
export function zeroDice() { return d(0, 0); }
export function negativeSides() { return d(0, -1); }
'''


def extract(root):
    result = subprocess.run(['node', str(EXTRACT), '--root', str(root)], cwd=REPO,
                            capture_output=True, text=True, timeout=60)
    if result.returncode:
        raise AssertionError(f'extractor failed ({result.returncode}): {result.stderr}')
    return json.loads(result.stdout)


def results(data):
    bounds = Bounds(data['summaries'], data.get('locals'))
    found = {}
    for site in data['sites']:
        found.setdefault(site['fn'], []).append(classify(site, 'lower', bounds))
    return found


class CallsiteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cache = REPO / '.cache'
        cache.mkdir(exist_ok=True)
        cls.temp = tempfile.TemporaryDirectory(prefix='fv-callsites-test-', dir=cache)
        cls.root = Path(cls.temp.name)
        (cls.root / 'src/js').mkdir(parents=True)
        (cls.root / 'js').mkdir()
        (cls.root / 'tsconfig.json').write_text(json.dumps({
            'compilerOptions': {'target': 'ES2022', 'module': 'NodeNext', 'strict': True},
            'include': ['src/js/*.ts'],
        }))
        (cls.root / 'src/js/rng.ts').write_text('''
export function rn2(x: number): number { return x; }
export function d(n: number, x: number): number { return n * x; }
''')
        (cls.root / 'src/js/sample.ts').write_text(SOURCE)
        (cls.root / 'src/js/attrib.ts').write_text('''
declare const observed: number;
export function currentAttribute(index: number): number { return observed; }
''')
        subprocess.run(['node', '--input-type=module', '-e', '''
import ts from 'typescript';
import fs from 'node:fs';
const root = process.argv[1];
for (const name of ['rng', 'sample', 'attrib']) {
    const source = fs.readFileSync(`${root}/src/js/${name}.ts`, 'utf8');
    fs.writeFileSync(`${root}/js/${name}.js`, ts.transpileModule(source, {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
    }).outputText);
}
''', str(cls.root)], cwd=REPO, check=True, capture_output=True, text=True)
        cls.healthy = extract(cls.root)
        cls.classes = results(cls.healthy)

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def assert_class(self, name, expected):
        self.assertEqual([kind for kind, _ in self.classes[name]], [expected], name)

    def test_inductive_counter_and_all_finite_assignments(self):
        self.assert_class('counter', 'guarded')
        self.assert_class('choices', 'guarded')

    def test_nonempty_guard_and_rechecked_loop(self):
        self.assert_class('guarded', 'guarded')
        self.assert_class('rechecked', 'guarded')

    def test_writes_and_unknown_calls_invalidate_guards(self):
        for name in ('mutable', 'snapshot', 'nextIteration', 'destructuring', 'shadowed', 'shadowIndex', 'moduleState'):
            with self.subTest(name=name):
                self.assert_class(name, 'unproved')

    def test_domain_probes_have_counterexamples(self):
        self.assert_class('zero', 'unproved')
        self.assert_class('divided', 'unproved')
        self.assertIn('divisor=', self.classes['divided'][0][1])
        self.assertTrue(all(kind == 'unproved' for kind, _ in self.classes['badNested']))
        self.assert_class('negativeSides', 'unproved')
        self.assert_class('zeroDice', 'constant')

    def test_attribute_invariant_and_boundary_probe(self):
        self.assert_class('constitution', 'invariant')
        self.assert_class('constitutionProbe', 'unproved')
        self.assertIn('=25', self.classes['constitutionProbe'][0][1])

    def test_constant_expressions_and_helper_return(self):
        self.assert_class('strings', 'constant')
        self.assert_class('masks', 'constant')
        self.assert_class('dice', 'constant')
        self.assert_class('helper', 'guarded')
        self.assert_class('earlierRead', 'constant')

    def test_argument_evaluation_can_invalidate_a_guard(self):
        self.assert_class('argumentMutation', 'unproved')

    def test_builtin_facts_require_builtin_values(self):
        for name in ('customLength', 'shadowMath', 'shadowNumber'):
            with self.subTest(name=name):
                self.assert_class(name, 'unproved')

    def test_increment_writes_are_not_algebraic_equalities(self):
        self.assert_class('orderedReads', 'unproved')
        self.assert_class('orderedUpdate', 'unproved')

    def test_emitted_mutants_are_killed(self):
        output = self.root / 'js/sample.js'
        original = output.read_text()
        # Change only the code the grader would execute, keeping the typed
        # inventory intact. A TypeScript-only check would miss all three.
        mutated = original.replace('let count = 0;', 'let count = -1;', 1)
        mutated = mutated.replace('values.length === 0', 'values.length < 0', 1)
        mutated = mutated.replace('return d(2, 6)', 'return d(2, 0)')
        mutated = mutated.replace('30 - currentAttribute(4)', '25 - currentAttribute(4)')
        mutated = mutated.replace("'ABCDEFG'", "''")
        mutated = mutated.replace('((80 - 1) & ~1) - 3', '((4 - 1) & ~1) - 3')
        mutated = mutated.replace('chance = 12', 'chance = 0')
        mutated = mutated.replace('return 1;', 'return 0;')
        mutated = mutated.replace('let remaining = 2', 'let remaining = -1')
        try:
            output.write_text(mutated)
            mutants = results(extract(self.root))
            for name in ('counter', 'guarded', 'dice', 'constitution', 'strings', 'masks',
                         'choices', 'helper', 'earlierRead'):
                with self.subTest(name=name):
                    self.assertEqual(mutants[name][0][0], 'unproved', mutants[name])
        finally:
            output.write_text(original)


if __name__ == '__main__':
    unittest.main(verbosity=2)
