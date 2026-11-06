"""Exercise mutant checks with real workers and optional RNG logs omitted."""
import subprocess
import sys
import unittest

from run import HERE


class MutantTableTests(unittest.TestCase):
    def test_negative_checks_accept_observations_without_rng_logs(self):
        # Keep the real native results and stream positions, omitting only
        # its diagnostic log. The checks must still kill behavior mutants.
        program = '''
from build import CACHE
from model import metadata
from run import (HERE, Worker, negative_checks, creation_negative_checks,
                 naming_negative_checks)

class StreamPositionsOnly(Worker):
    def call(self, state):
        result = super().call(state)
        result['rng'] = {key: result['rng'][key] for key in ['core', 'display']}
        return result

with StreamPositionsOnly([str(CACHE / 'native')], 'mutant-test-native') as native, \\
        Worker(['node', str(HERE / 'port.mjs')], 'mutant-test-port') as port:
    meta = metadata()
    negative_checks(native, port, meta)
    creation_negative_checks(native, port, meta)
    naming_negative_checks(native, port, meta)
'''
        result = subprocess.run([sys.executable, '-c', program], cwd=HERE,
                                capture_output=True, text=True, timeout=60)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == '__main__':
    unittest.main()
