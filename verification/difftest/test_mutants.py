"""Guard the emitted-JS mutant table in CI.

The mutant load hook only fires for modules a run actually imports, so a
mutant left behind by a module fold used to pass vacuously whenever the
difftest batch did not load its file. Running the creation negative checks
here applies every creation mutant, so a stale one fails this test with its
name; a control divergence or a mutant that survives fails it too.

The base negative checks run in the difftest CI job through the runner's
own `run.py --build --self-test` step, and the naming checks through
test_harness's naming self-test, so every mutant in the table is killed
somewhere CI runs. port.mjs --check-mutants additionally verifies the whole
table against the emitted files without a native build; CI covers that
through the suites, which apply each mutant in turn.
"""
import unittest

from build import CACHE
from model import metadata
from run import HERE, Worker, creation_negative_checks


class MutantTableTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.meta = metadata()

    def test_creation_negative_checks_kill_the_repointed_mutants(self):
        # The creation suite enumerates the eight mutants this table section
        # lists; each raises with the mutant's name if its control diverges,
        # its mutant survives, or it fails for the wrong reason.
        with Worker([str(CACHE / 'native')], 'mutant-guard-native') as native, \
                Worker(['node', str(HERE / 'port.mjs')], 'mutant-guard-port') as port:
            creation_negative_checks(native, port, self.meta)


if __name__ == '__main__':
    unittest.main()
