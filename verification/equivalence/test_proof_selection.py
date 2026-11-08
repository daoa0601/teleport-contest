"""Proof selection preserves failures in each selected claim and negative check."""
from contextlib import redirect_stdout
import io
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

import prove
from specs import INT, Spec


class ProofSelectionTests(unittest.TestCase):
    def run_prover(self, *arguments, slow=False,
                   body='return x > 0 ? x : 0;',
                   probe=lambda s: [s['x'] == -1], mutant='return 1;', dependency=None,
                   peer=None):
        with TemporaryDirectory(prefix='fv-selection-', dir=prove.REPO / '.cache') as directory:
            c_file = Path(directory) / 'example.c'
            js_file = Path(directory) / 'example.js'
            c_file.write_text('int example(int x) { return x; }')
            js_file.write_text(f'function example(x) {{ {body} }}')
            spec = Spec('example', 'example', 'example', [('x', INT)],
                        pre=lambda s: [s['x'] >= 0, s['x'] <= 3],
                        probes=[('negative input', probe)],
                        mutants=[(str(js_file), body, mutant)],
                        require_counterexamples=True, slow=slow, js_file=str(js_file))
            specs = [spec]
            if dependency is not None:
                c_file.write_text(c_file.read_text() + '\nint prerequisite(int x) { return x; }')
                js_file.write_text(js_file.read_text() + f'\nfunction prerequisite(x) {{ {dependency} }}')
                prerequisite = Spec('prerequisite', 'prerequisite', 'prerequisite', [('x', INT)],
                                    pre=spec.pre, js_file=str(js_file))
                spec.dependencies = ('prerequisite',)
                specs = [prerequisite, spec]
            if peer is not None:
                c_file.write_text(c_file.read_text() + '\nint peer(int x) { return x; }')
                js_file.write_text(js_file.read_text() + f'\nfunction peer(x) {{ {peer} }}')
                specs.append(Spec('peer', 'peer', 'peer', [('x', INT)],
                                  pre=spec.pre, slow=slow, js_file=str(js_file)))
            output = io.StringIO()
            # Keep the real executors and runner; unrelated generator claims
            # have their own selection tests.
            with (
                patch.multiple(prove, SPECS=specs, C_FILES=[str(c_file)], JS_FILES=[str(js_file)]),
                patch.object(prove, 'isaac_claims', return_value={}),
                patch.object(prove, 'prove_isaac64', return_value=0),
                patch.object(prove, 'prove_seed_packing', return_value=0),
                patch.object(sys, 'argv', ['prove.py', *arguments]),
                redirect_stdout(output),
            ):
                status = prove.main()
            return status, output.getvalue()

    def test_fast_selection_proves_the_claim_and_negative_checks(self):
        status, report = self.run_prover('--skip-slow', '--only', 'example')
        self.assertEqual(status, 0, report)

    def test_fast_selection_rejects_a_divergent_fast_body(self):
        status, report = self.run_prover('--skip-slow', body='return 1;')
        self.assertNotEqual(status, 0, report)

    def test_fast_selection_rejects_a_probe_without_a_counterexample(self):
        status, report = self.run_prover('--skip-slow', probe=lambda s: [s['x'] == 0])
        self.assertNotEqual(status, 0, report)

    def test_fast_selection_rejects_a_surviving_mutant(self):
        status, report = self.run_prover('--skip-slow', mutant='return x;')
        self.assertNotEqual(status, 0, report)

    def test_fast_selection_excludes_slow_body_and_negative_checks(self):
        status, report = self.run_prover('--skip-slow', slow=True, body='return 1;',
                                       probe=lambda s: [s['x'] == 1])
        self.assertEqual(status, 0, report)

    def test_slow_selection_rejects_a_divergent_slow_body(self):
        status, report = self.run_prover('--slow-only', slow=True, body='return 1;')
        self.assertNotEqual(status, 0, report)

    def test_slow_selection_excludes_fast_body_and_negative_checks(self):
        status, report = self.run_prover('--slow-only', body='return 1;',
                                       probe=lambda s: [s['x'] == 1])
        self.assertEqual(status, 0, report)

    def test_selecting_a_composed_claim_proves_its_prerequisite(self):
        status, report = self.run_prover('--only', 'example', dependency='return x;')
        self.assertEqual(status, 0, report)

    def test_a_failed_prerequisite_rejects_the_composed_claim(self):
        status, report = self.run_prover('--only', 'example', dependency='return x + 1;')
        self.assertNotEqual(status, 0, report)

    def test_slow_selection_proves_a_fast_prerequisite(self):
        status, report = self.run_prover('--slow-only', slow=True, dependency='return x;')
        self.assertEqual(status, 0, report)

    def test_slow_shards_each_prove_their_share(self):
        for shard in ('1/2', '2/2'):
            status, report = self.run_prover('--slow-only', f'--shard={shard}', slow=True,
                                             peer='return x < 3 ? x : 3;')
            self.assertEqual(status, 0, report)

    def test_a_divergent_slow_claim_fails_only_its_own_shard(self):
        status, _ = self.run_prover('--slow-only', '--shard=1/2', slow=True, peer='return 1;')
        self.assertEqual(status, 0)
        status, _ = self.run_prover('--slow-only', '--shard=2/2', slow=True, peer='return 1;')
        self.assertNotEqual(status, 0)


if __name__ == '__main__':
    unittest.main()
