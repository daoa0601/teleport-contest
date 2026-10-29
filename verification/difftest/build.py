#!/usr/bin/env -S uv run --script
"""Read recorder sources without changing them; put every build output in .cache."""
from __future__ import annotations

import os
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import subprocess
from shutil import copyfile
import time

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
CACHE = ROOT / '.cache' / 'fv-difftest'


def build() -> Path:
    recorder = Path(os.environ.get('NETHACK_RECORDER', ROOT / 'nethack-c/recorder')).resolve()
    if not (recorder / 'include/hack.h').exists():
        raise SystemExit('Set NETHACK_RECORDER to a configured, patched recorder tree')
    CACHE.mkdir(parents=True, exist_ok=True)
    # Ask the configured makefile which objects its actual link includes.
    # This target has no prerequisites and does not invoke the recorder build.
    query = CACHE / 'objects.mk'
    query.write_text('difftest-objects:\n\t@echo $(HOBJ) $(DATE_O) hacklib.o\n')
    names = subprocess.check_output(
        ['make', '-s', '-f', 'Makefile', '-f', str(query), 'difftest-objects'],
        cwd=recorder / 'src', text=True).split()
    sources = {}
    for folder in ['src', 'sys', 'win']:
        for source in (recorder / folder).rglob('*.c'):
            sources.setdefault(source.stem, []).append(source)
    flags = ['clang', '-g', '-O1', '-DNOTPARMDECL', '-DNO_TIMED_DELAY',
             '-fsanitize=undefined', '-fno-sanitize-recover=undefined',
             f'-I{recorder / "include"}', f'-I{recorder / "src"}']
    jobs = []
    for name in dict.fromkeys(names):
        stem = Path(name).stem
        if stem == 'rnd':
            continue  # native.c includes the unmodified rnd.c to observe streams.
        candidates = sources.get(stem, [])
        if len(candidates) != 1:
            raise SystemExit(f'Expected one source for {name}, found {candidates}')
        extra = ['-Dmain=difftest_game_main'] if stem == 'unixmain' else []
        jobs.append((candidates[0], CACHE / f'{stem}.o', extra))
    jobs.append((HERE / 'native.c', CACHE / 'native.o', []))

    def compile_one(job):
        source, output, extra = job
        result = subprocess.run([*flags, *extra, '-c', str(source), '-o', str(output)],
                                cwd=recorder / 'src', capture_output=True, text=True)
        if result.returncode:
            raise RuntimeError(f'{source}:\n{result.stderr}')
        return output

    started = time.monotonic()
    # Two compilers avoid competing with the other porting units on this host.
    with ThreadPoolExecutor(max_workers=2) as pool:
        objects = list(pool.map(compile_one, jobs))
    # The configured recorder has DLB disabled: dlb_fopen() is fopen().
    # CapitalMon() must read the native generated data in the worker's cwd.
    copyfile(recorder / 'dat/bogusmon', CACHE / 'bogusmon')
    binary = CACHE / 'native'
    lua = recorder / 'lib/lua/liblua-5.4.8.a'
    subprocess.run(['clang', '-fsanitize=undefined', '-o', str(binary),
                    *map(str, objects), str(lua), '-lncurses', '-lm'], check=True)
    print(f'Built {len(objects)} objects in {time.monotonic() - started:.2f}s: {binary}')
    return binary


if __name__ == '__main__':
    build()
