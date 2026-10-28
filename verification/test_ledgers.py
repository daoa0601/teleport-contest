"""Exercise the ledger command-line contracts without touching game sources.

    cd verification/equivalence && uv run ../test_ledgers.py
"""
import csv
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
CACHE = HERE.parent / '.cache'


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
        self.assertIn('new unproved site', result.stdout)
        self.assertIn('count=0', result.stdout)

    def test_another_identical_unproved_call_needs_its_own_proof(self):
        result = self.run_callsites([site('unproved')], [site('unproved'), site('unproved', line=30)])
        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn('new unproved site', result.stdout)

    def test_losing_a_guard_fails(self):
        result = self.run_callsites([site('guarded')], [site('unproved')])
        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn('guarded -> unproved', result.stdout)

    def test_needing_a_guard_instead_of_a_constant_fails(self):
        result = self.run_callsites([site('constant')], [site('guarded')])
        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn('constant -> guarded', result.stdout)

    def test_needing_an_invariant_instead_of_a_guard_fails(self):
        result = self.run_callsites([site('guarded')], [site('invariant')])
        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn('guarded -> invariant', result.stdout)

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
        self.assertIn('constant -> guarded', result.stdout)

    def test_extra_proved_copy_can_use_a_weaker_class(self):
        result = self.run_callsites([site('constant')], [site('constant'), site('guarded')])
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_proof_ledgers_require_complete_runs(self):
        with tempfile.TemporaryDirectory(dir=CACHE) as directory:
            ledger = Path(directory) / 'ledger.tsv'
            with ledger.open('w', newline='') as output:
                csv.writer(output, delimiter='\t').writerows([('spec', 'domain'), ('rn2', 'x >= 1')])
            for option in ('--only=rn2', '--no-probes', '--no-mutants'):
                with self.subTest(option=option):
                    result = subprocess.run([sys.executable, str(HERE / 'equivalence/prove.py'),
                                             '--check-ledger', str(ledger), option], capture_output=True, text=True)
                    self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
                    self.assertIn('require every spec, probe, and mutant', result.stderr)

    def test_missing_claim_fails_before_loading_c(self):
        with tempfile.TemporaryDirectory(dir=CACHE) as directory:
            ledger = Path(directory) / 'ledger.tsv'
            with ledger.open('w', newline='') as output:
                csv.writer(output, delimiter='\t').writerows([('spec', 'domain'), ('removed_claim', 'x >= 1')])
            result = subprocess.run([sys.executable, str(HERE / 'equivalence/prove.py'),
                                     '--check-ledger', str(ledger)], capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertIn('removed_claim', result.stdout)
            self.assertIn('missing spec', result.stdout)


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
