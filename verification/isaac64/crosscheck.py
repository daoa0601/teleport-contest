"""Compare 1,000 C/scoring-adapter draws per seed, stopping at the first mismatch.

Run from equivalence/: uv run ../isaac64/crosscheck.py
Only compiles the standalone ISAAC64 C file; never runs the game or a corpus.
"""
from pathlib import Path
import os
import subprocess
import time

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]


def main():
    recorder = Path(os.environ['NETHACK_RECORDER'])
    cache = REPO / '.cache' / 'fv-isaac64'
    cache.mkdir(parents=True, exist_ok=True)
    binary = cache / 'stream'
    start = time.monotonic()
    subprocess.run(['clang', '-std=c99', '-O2', '-DNOTPARMDECL', '-DNO_TIMED_DELAY',
                    '-I' + str(recorder / 'include'), str(HERE / 'stream.c'),
                    str(recorder / 'src' / 'isaac64.c'), '-o', str(binary)], check=True, timeout=30)
    seeds = [0, 1, 42, 123456789, 2**63, 2**64-1, 0x0123456789abcdef]
    cases = [(f'uint64 {n}', n.to_bytes(8, 'little'), None) for n in seeds]
    for length in (0, 1, 7, 9, 2047, 2048, 2051):
        cases.append((f'{length} seed bytes', bytes((i*73+19) % 256 for i in range(length)), None))
    for length in (0, 7, 2048):
        cases.append((f'reseed {length} bytes at draw 333', bytes(range(8)), bytes([255])*length))
    total = 0
    for label, seed, extra in cases:
        args = [seed.hex()] + ([] if extra is None else [extra.hex()])
        c = subprocess.run([str(binary), *args], capture_output=True, text=True, check=True, timeout=20)
        js = subprocess.run(['node', str(HERE / 'stream.mjs'), *args],
                            capture_output=True, text=True, check=True, timeout=20)
        left, right = c.stdout.splitlines(), js.stdout.splitlines()
        if len(left) != 1000 or len(right) != 1000:
            raise RuntimeError(f'{label}: expected 1000 draws, C={len(left)}, JS={len(right)}')
        for i, (a, b) in enumerate(zip(left, right)):
            if int(a, 16) != int(b, 16):
                raise RuntimeError(f'{label}, draw {i}: C={a}, JS={b}')
        total += len(left)
        print(f'PASS {label}: 1000 draws', flush=True)
    print(f'{len(cases)} cases, {total} matching draws, {time.monotonic()-start:.2f}s')


if __name__ == '__main__':
    main()
