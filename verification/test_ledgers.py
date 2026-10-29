"""Exercise the ledger command-line contracts without touching game sources.

    cd verification/equivalence && uv run ../test_ledgers.py
"""
from contextlib import redirect_stdout
import csv
from dataclasses import replace
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

import z3

HERE = Path(__file__).resolve().parent
CACHE = HERE.parent / '.cache'
sys.path.insert(0, str(HERE / 'equivalence'))

import prove
from core import LoopSpec
from specs import INT, Spec


class LedgerChecks(unittest.TestCase):
    def run_callsites(self, before, after):
        with tempfile.TemporaryDirectory(dir=CACHE) as directory:
            ledger = Path(directory) / 'ledger.tsv'
            sites = Path(directory) / 'sites.json'
            sites.write_text(json.dumps({'sites': before, 'summaries': {}}))
            command = [sys.executable, str(HERE / 'callsites/check.py'), str(sites)]
            written = subprocess.run(command + ['--write-ledger', str(ledger)], capture_output=True, text=True)
            self.assertEqual(written.returncode, 0, written.stdout + written.stderr)
            sites.write_text(json.dumps({'sites': after, 'summaries': {}}))
            return subprocess.run(command + ['--check-ledger', str(ledger)], capture_output=True, text=True)

    def test_existing_unproved_site_survives_a_line_move(self):
        result = self.run_callsites([site('unproved')], [site('unproved', line=200)])
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_new_unproved_site_fails_with_its_reason(self):
        result = self.run_callsites([], [site('unproved')])
        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_another_identical_unproved_call_needs_its_own_proof(self):
        result = self.run_callsites([site('unproved')], [site('unproved'), site('unproved', line=30)])
        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_losing_a_guard_fails(self):
        result = self.run_callsites([site('guarded')], [site('unproved')])
        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_needing_a_guard_instead_of_a_constant_fails(self):
        result = self.run_callsites([site('constant')], [site('guarded')])
        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_needing_an_invariant_instead_of_a_guard_fails(self):
        result = self.run_callsites([site('guarded')], [site('invariant')])
        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_improvements_new_proved_sites_and_deletions_pass(self):
        for before, after in (([site('unproved')], [site('guarded')]),
                              ([], [site('constant')]), ([site('constant')], [])):
            with self.subTest(before=before, after=after):
                result = self.run_callsites(before, after)
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_repeated_calls_retain_each_class(self):
        result = self.run_callsites([site('constant'), site('unproved')],
                                    [site('guarded'), site('unproved')])
        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_extra_proved_copy_can_use_a_weaker_class(self):
        result = self.run_callsites([site('constant')], [site('constant'), site('guarded')])
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_callbacks_in_different_functions_keep_separate_claims(self):
        with tempfile.TemporaryDirectory(dir=CACHE) as directory:
            root = Path(directory)
            (root / 'src/js').mkdir(parents=True)
            (root / 'js').mkdir()
            (root / 'tsconfig.json').write_text(json.dumps({
                'compilerOptions': {'target': 'ES2022', 'module': 'NodeNext', 'strict': True},
                'include': ['src/js/*.ts'],
            }))
            (root / 'src/js/rng.ts').write_text('export function rn2(x: number): number { return x; }')
            (root / 'js/rng.js').write_text('export function rn2(x) { return x; }')
            source = ("import { rn2 } from './rng.js';\n"
                      'export function first() { const width = 2; return () => rn2(width); }\n'
                      'export function second() { const width = 0; return () => rn2(width); }')
            (root / 'src/js/sample.ts').write_text(source)
            emitted = root / 'js/sample.js'
            emitted.write_text(source)
            sites = root / 'sites.json'
            ledger = root / 'ledger.tsv'

            def run(option):
                extracted = subprocess.run(['node', str(HERE / 'callsites/extract.mjs'), '--root', str(root)],
                                           capture_output=True, text=True)
                self.assertEqual(extracted.returncode, 0, extracted.stderr)
                sites.write_text(extracted.stdout)
                return subprocess.run([sys.executable, str(HERE / 'callsites/check.py'), str(sites),
                                       option, str(ledger)], capture_output=True, text=True)

            baseline = run('--write-ledger')
            self.assertEqual(baseline.returncode, 0, baseline.stdout + baseline.stderr)
            # Swap which callback has a valid width. The first claim was lost.
            emitted.write_text(source.replace('width = 2', 'width = -1').replace('width = 0', 'width = 2'))
            result = run('--check-ledger')
            self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_proof_ledgers_require_complete_runs(self):
        with tempfile.TemporaryDirectory(dir=CACHE) as directory:
            ledger = Path(directory) / 'ledger.tsv'
            with ledger.open('w', newline='') as output:
                csv.writer(output, delimiter='\t').writerows([('spec', 'domain', 'probes', 'mutants'),
                                                            ('rn2', 'x >= 1', 2, 0)])
            for option in ('--only=rn2', '--no-probes', '--no-mutants'):
                with self.subTest(option=option):
                    result = subprocess.run([sys.executable, str(HERE / 'equivalence/prove.py'),
                                             '--check-ledger', str(ledger), option], capture_output=True, text=True)
                    self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_missing_claim_fails_before_loading_c(self):
        with tempfile.TemporaryDirectory(dir=CACHE) as directory:
            ledger = Path(directory) / 'ledger.tsv'
            with ledger.open('w', newline='') as output:
                csv.writer(output, delimiter='\t').writerows([('spec', 'domain', 'probes', 'mutants'),
                                                            ('removed_claim', 'x >= 1', 1, 1)])
            result = subprocess.run([sys.executable, str(HERE / 'equivalence/prove.py'),
                                     '--check-ledger', str(ledger)], capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)


class ProofLedgerChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.directory = tempfile.TemporaryDirectory(dir=CACHE)
        cls.addClassCleanup(cls.directory.cleanup)
        ledger = Path(cls.directory.name) / 'claims.tsv'
        result = subprocess.run([sys.executable, str(HERE / 'equivalence/prove.py'),
                                 '--write-ledger', str(ledger)], capture_output=True, text=True)
        if result.returncode:
            raise RuntimeError(result.stdout + result.stderr)
        with ledger.open(newline='') as source:
            reader = csv.DictReader(source, delimiter='\t')
            cls.columns = reader.fieldnames
            cls.claims = list(reader)

    def check_changed_claim(self, name, field, value):
        return self.check_claims({**claim, field: value} if claim['spec'] == name else claim
                                 for claim in self.claims)

    def check_claims(self, claims):
        with tempfile.TemporaryDirectory(dir=CACHE) as directory:
            ledger = Path(directory) / 'claims.tsv'
            with ledger.open('w', newline='') as output:
                writer = csv.DictWriter(output, fieldnames=self.columns, delimiter='\t')
                writer.writeheader()
                writer.writerows(claims)
            return subprocess.run([sys.executable, str(HERE / 'equivalence/prove.py'),
                                   '--check-ledger', str(ledger)], capture_output=True, text=True)

    def test_changed_domain_fails(self):
        claim = next(claim for claim in self.claims if claim['spec'] == 'rn2')
        result = self.check_changed_claim('rn2', 'domain', claim['domain'] + '; x >= 2')
        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_unrecorded_leaf_claim_fails_before_proving(self):
        result = self.check_claims(claim for claim in self.claims if claim['spec'] != 'rn2')
        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_unrecorded_isaac_claim_fails_before_proving(self):
        result = self.check_claims(claim for claim in self.claims if claim['spec'] != 'lower_bits')
        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_removed_probe_fails(self):
        claim = next(claim for claim in self.claims if claim['spec'] == 'rnd')
        result = self.check_changed_claim('rnd', 'probes', str(int(claim['probes']) + 1))
        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_removed_mutant_fails(self):
        claim = next(claim for claim in self.claims if claim['spec'] == 'rnd')
        result = self.check_changed_claim('rnd', 'mutants', str(int(claim['mutants']) + 1))
        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_changed_equipment_assumption_fails(self):
        claim = next(claim for claim in self.claims if claim['spec'] == 'acurrstr')
        domain = claim['domain'].replace('uarmg == NULL', 'uarmg != NULL')
        result = self.check_changed_claim('acurrstr', 'domain', domain)
        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_changed_role_correspondence_fails(self):
        claim = next(claim for claim in self.claims if claim['spec'] == 'enermod')
        domain = claim['domain'].replace('PM_WIZARD=wizard', 'PM_WIZARD=knight')
        result = self.check_changed_claim('enermod', 'domain', domain)
        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_missing_isaac_claim_fails_before_proving(self):
        claims = prove.isaac_claims(prove.REPO)
        del claims['lower_bits']
        output = io.StringIO()
        ledger = Path(self.directory.name) / 'claims.tsv'
        with (
            patch.object(prove, 'isaac_claims', return_value=claims),
            patch.object(sys, 'argv', ['prove.py', '--check-ledger', str(ledger)]),
            redirect_stdout(output),
        ):
            status = prove.main()
        self.assertNotEqual(status, 0, output.getvalue())

    def test_narrower_isaac_input_requires_review(self):
        from bv import integer, predicate
        from isaac_specs import Pair

        original = Pair.inputs

        def narrow(pair, probe):
            c_args, js_args = original(pair, probe)
            if pair.name == 'lower_bits':
                pair.checks.pre.append(predicate('>=', js_args[0], integer(1)))
            return c_args, js_args

        output = io.StringIO()
        ledger = Path(self.directory.name) / 'claims.tsv'
        with (
            patch.object(Pair, 'inputs', narrow),
            patch.object(sys, 'argv', ['prove.py', '--check-ledger', str(ledger)]),
            redirect_stdout(output),
        ):
            status = prove.main()
        self.assertNotEqual(status, 0, output.getvalue())

    def test_removed_isaac_mutant_requires_review(self):
        claim = next(claim for claim in self.claims if claim['spec'] == 'isaac64_update')
        result = self.check_changed_claim('isaac64_update', 'mutants', str(int(claim['mutants']) + 1))
        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)


class AssumptionLedgerChecks(unittest.TestCase):
    def check_assumptions(self, change, pre=lambda s: [s['n'] >= 0, s['n'] <= 3]):
        with tempfile.TemporaryDirectory(dir=CACHE) as directory:
            c_file = Path(directory) / 'example.c'
            js_file = Path(directory) / 'example.js'
            ledger = Path(directory) / 'claims.tsv'
            c_file.write_text('int example(int n) { int i = 0; while (i < n) ++i; return i; }\n'
                              'int replacement(int n) { return n; }')
            js_file.write_text('function example(n, bonus = 0) { '
                               'let i = 0; while (i < n) ++i; return i + bonus; }\n'
                               'function replacement(n, bonus = 0) { return n + bonus; }')
            loop = LoopSpec(
                invariant=lambda v, e, pos, pos0: [v['i'] >= 0, v['i'] <= e['n']],
                variant=lambda v, e: e['n'] - v['i'],
                facts=lambda v, e, pos, pos0: [e['n'] >= 0], streams=())
            spec = Spec('example', 'example', 'example', [('n', INT)],
                        pre=pre,
                        loops={('c', 'example', 0): loop, ('js', 'example', 0): loop},
                        js_file=str(js_file), js_args=[('num', 0)])

            def run(current, option):
                output = io.StringIO()
                with (
                    patch.multiple(prove, SPECS=[current], C_FILES=[str(c_file)], JS_FILES=[current.js_file]),
                    patch.object(prove, 'isaac_claims', return_value={}),
                    patch.object(prove, 'prove_isaac64', return_value=0),
                    patch.object(prove, 'prove_seed_packing', return_value=0),
                    patch.object(sys, 'argv', ['prove.py', option, str(ledger)]),
                    redirect_stdout(output),
                ):
                    status = prove.main()
                return status, output.getvalue()

            status, report = run(spec, '--write-ledger')
            self.assertEqual(status, 0, report)
            return run(change(spec), '--check-ledger')

    def test_unchanged_loop_and_arguments_pass(self):
        status, report = self.check_assumptions(lambda spec: spec)
        self.assertEqual(status, 0, report)

    def test_narrower_long_precondition_requires_review(self):
        def domain(stop):
            return lambda s: [s['n'] >= 0, s['n'] <= 3,
                              z3.Or([s['n'] == value for value in range(-300, stop)])]

        # Removing n == 3 changes the claim beyond Z3's display cutoff.
        status, report = self.check_assumptions(
            lambda spec: replace(spec, pre=domain(3)), pre=domain(4))
        self.assertNotEqual(status, 0, report)

    def test_changed_proof_target_requires_review(self):
        for field in ('c', 'js', 'js_file'):
            with self.subTest(field=field):
                def redirect(spec):
                    target = 'replacement'
                    if field == 'js_file':
                        file = Path(spec.js_file).with_name('replacement.js')
                        file.write_text('function example(n, bonus = 0) { return n + bonus; }')
                        target = str(file)
                    return replace(spec, **{field: target})

                status, report = self.check_assumptions(redirect)
                self.assertNotEqual(status, 0, report)

    def test_narrower_loop_facts_require_review_on_either_side(self):
        for side in ('c', 'js'):
            with self.subTest(side=side):
                def narrow(spec):
                    key = (side, 'example', 0)
                    loop = replace(spec.loops[key], facts=lambda v, e, pos, pos0: [e['n'] > 0])
                    return replace(spec, loops={**spec.loops, key: loop})

                status, report = self.check_assumptions(narrow)
                self.assertNotEqual(status, 0, report)

    def test_changed_fixed_js_argument_requires_review(self):
        status, report = self.check_assumptions(lambda spec: replace(spec, js_args=[('num', 1)]))
        self.assertNotEqual(status, 0, report)

    def test_removed_fixed_js_argument_requires_review(self):
        status, report = self.check_assumptions(lambda spec: replace(spec, js_args=[]))
        self.assertNotEqual(status, 0, report)


def site(kind, line=10):
    # One rn2(count) call, with the evidence available to the classifier.
    term = {'leaf': True, 'text': 'count'}
    guards = []
    if kind == 'constant':
        term = {'num': 2}
    elif kind == 'invariant':
        term = {'leaf': True, 'text': 'game.u.ulevel'}
    elif kind == 'guarded':
        guards = [{'cmp': '>', 'args': [term, {'num': 0}]}]
    return {'file': 'src/js/example.ts', 'line': line, 'fn': 'choose',
            'callee': 'rn2', 'draw': 'rn2', 'args': ['count'],
            'terms': [term], 'guards': guards}


if __name__ == '__main__':
    CACHE.mkdir(exist_ok=True)
    unittest.main()
