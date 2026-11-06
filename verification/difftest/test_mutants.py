"""Guard the emitted-JS mutant table itself.

The mutant load hook only fires for modules a run actually imports, so a
mutant left behind by a module fold used to pass vacuously whenever the
difftest batch did not load its file. These tests run on the same CI pytest
step as the rest of the harness: the table must apply, and the runner's
three negative-check suites must kill every mutant it lists.
"""
import subprocess
import unittest

from build import CACHE
from model import metadata
from run import HERE, Worker, creation_negative_checks, naming_negative_checks, negative_checks


class MutantTableTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.meta = metadata()

    def test_every_mutant_still_applies_to_its_emitted_file(self):
        # --check-mutants reads each target file directly, independent of
        # which modules a run loads, and exits 1 naming any stale mutant.
        result = subprocess.run(['node', str(HERE / 'port.mjs'), '--check-mutants'],
                                capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_negative_checks_kill_every_listed_mutant(self):
        # The base, creation, and naming suites together enumerate every
        # mutant in the table; each raises with the mutant's name if its
        # control diverges, its mutant survives, or it fails for the wrong
        # reason.
        with Worker([str(CACHE / 'native')], 'mutant-guard-native') as native, \
                Worker(['node', str(HERE / 'port.mjs')], 'mutant-guard-port') as port:
            negative_checks(native, port, self.meta)
            creation_negative_checks(native, port, self.meta)
            naming_negative_checks(native, port, self.meta)


if __name__ == '__main__':
    unittest.main()
