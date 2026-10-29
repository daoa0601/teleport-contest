"""The fast proof command must report exclusions and still run selected claims."""
from pathlib import Path
import subprocess
import sys
import unittest

HERE = Path(__file__).resolve().parent


class ProofSelectionTests(unittest.TestCase):
    def run_prover(self, *arguments):
        result = subprocess.run([sys.executable, str(HERE / 'prove.py'), *arguments],
                                capture_output=True, text=True, timeout=60, cwd=HERE)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        return result.stdout

    def test_fast_run_reports_each_excluded_table_claim(self):
        output = self.run_prover('--skip-slow', '--only', 'experience:tables',
                                 '--only', 'mcalcmove:tables')
        self.assertIn('SKIPPED experience:tables (slow)', output)
        self.assertIn('SKIPPED mcalcmove:tables (slow)', output)
        self.assertNotIn('PROVED', output)

    def test_fast_run_keeps_selected_regular_claim_and_negative_checks(self):
        output = self.run_prover('--skip-slow', '--only', 'rnd')
        self.assertIn('PROVED  rnd', output)
        self.assertIn('outside domain', output)
        self.assertIn('killed mutant', output)
        self.assertNotIn('SKIPPED', output)


if __name__ == '__main__':
    unittest.main()
