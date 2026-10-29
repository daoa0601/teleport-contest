"""Both verification entry points must check the adapter scoring installs.

Run from equivalence/: uv run python ../isaac64/test_scoring_target.py
The two copies deliberately disagree, so choosing the emitted file changes
the result. No game sources are rewritten.
"""
import contextlib
import io
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(REPO / 'verification' / 'equivalence'))

from isaac_specs import run


def divergent(source):
    old, new = b'x >> 3n', b'x >> 4n'
    if source.count(old) != 1:
        raise ValueError('lower_bits shift mutant needs one target')
    return source.replace(old, new)


class ScoringTargetTests(unittest.TestCase):
    @contextlib.contextmanager
    def repository(self):
        cache = REPO / '.cache' / 'fv-isaac64'
        cache.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=cache) as directory:
            repo = Path(directory)
            for folder in ('frozen', 'js', 'verification/isaac64'):
                (repo / folder).mkdir(parents=True)
            for name in ('crosscheck.py', 'stream.c', 'stream.mjs'):
                shutil.copyfile(HERE / name, repo / 'verification' / 'isaac64' / name)
            yield repo

    def test_proof_uses_the_scoring_adapter(self):
        recorder = Path(os.environ['NETHACK_RECORDER'])
        frozen = (REPO / 'frozen' / 'isaac64.js').read_bytes()
        emitted = (REPO / 'js' / 'isaac64.js').read_bytes()
        with self.repository() as repo:
            (repo / 'frozen' / 'isaac64.js').write_bytes(frozen)
            (repo / 'js' / 'isaac64.js').write_bytes(divergent(emitted))
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                result = run(recorder, repo, ['lower_bits'], probes=False, mutants=False)
            self.assertEqual(result, 0, 'healthy scoring adapter was rejected:\n' + output.getvalue())

            (repo / 'frozen' / 'isaac64.js').write_bytes(divergent(frozen))
            (repo / 'js' / 'isaac64.js').write_bytes(emitted)
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                result = run(recorder, repo, ['lower_bits'], probes=False, mutants=False)
            self.assertEqual(result, 1, 'divergent scoring adapter was accepted:\n' + output.getvalue())

    def test_concrete_check_uses_the_scoring_adapter(self):
        frozen = (REPO / 'frozen' / 'isaac64.js').read_bytes()
        emitted = (REPO / 'js' / 'isaac64.js').read_bytes()
        with self.repository() as repo:
            command = [sys.executable, str(repo / 'verification' / 'isaac64' / 'crosscheck.py')]
            (repo / 'frozen' / 'isaac64.js').write_bytes(frozen)
            (repo / 'js' / 'isaac64.js').write_bytes(divergent(emitted))
            result = subprocess.run(command, capture_output=True, text=True, timeout=60)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

            (repo / 'frozen' / 'isaac64.js').write_bytes(divergent(frozen))
            (repo / 'js' / 'isaac64.js').write_bytes(emitted)
            result = subprocess.run(command, capture_output=True, text=True, timeout=60)
            self.assertNotEqual(result.returncode, 0, 'divergent scoring adapter was accepted:\n' + result.stdout)


if __name__ == '__main__':
    unittest.main()
