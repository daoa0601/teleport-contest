#!/usr/bin/env -S uv run --script
"""Compare one native call with one emitted-JS call over a shared JSON state."""
from __future__ import annotations

import argparse
from collections import Counter
from contextlib import ExitStack
from copy import deepcopy
import json
import os
from pathlib import Path
import select
import signal
import subprocess
import time

from build import CACHE, build
from model import LOCATIONS, OBJECT, TARGETS, canonical, edge_cases, generated_cases, metadata

from creation_model import CREATION_TARGETS, CREATION_LOCATIONS, creation_edges, creation_generated

ALL_TARGETS = TARGETS + CREATION_TARGETS
ALL_LOCATIONS = LOCATIONS + CREATION_LOCATIONS
HERE = Path(__file__).resolve().parent


class Worker:
    def __init__(self, command, name, mutant=None):
        self.error_path = CACHE / f'{name}.stderr'
        self.errors = self.error_path.open('w+')
        env = dict(os.environ)
        if mutant:
            env['DIFFTEST_MUTANT'] = mutant
        else:
            env.pop('DIFFTEST_MUTANT', None)
        self.process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                        stderr=self.errors, text=True, bufsize=1, env=env, cwd=CACHE,
                                        start_new_session=True)

    def call(self, state):
        try:
            self.process.stdin.write(json.dumps(state) + '\n')
            self.process.stdin.flush()
        except BrokenPipeError:
            return self.failed()
        ready, _, _ = select.select([self.process.stdout], [], [], 30)
        if not ready:
            raise RuntimeError(f'Call timed out; see {self.error_path}')
        line = self.process.stdout.readline()
        if not line:
            return self.failed()
        try:
            return json.loads(line)
        except json.JSONDecodeError as error:
            raise RuntimeError(f'Non-JSON child output: {line[:500]!r}; see {self.error_path}') from error

    def failed(self):
        self.errors.flush()
        self.errors.seek(0)
        raise RuntimeError(f'Child failed ({self.process.poll()}): {self.errors.read(4000)}')

    def signal_group(self, sig):
        # A native call forks to isolate C globals. Stop that child too if
        # the target hangs, rather than leaving it after its parent exits.
        try:
            os.killpg(self.process.pid, sig)
        except ProcessLookupError:
            pass

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.process.stdin.close()
        try:
            self.process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            self.signal_group(signal.SIGTERM)
            try:
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.signal_group(signal.SIGKILL)
                self.process.wait()
        self.process.stdout.close()
        self.errors.close()


def difference(left, right, path=''):
    """Return one field difference without formatting a large assertion/log."""
    if type(left) is not type(right):
        return dict(path=path, native=left, port=right)
    if isinstance(left, dict):
        if set(left) != set(right):
            return dict(path=path, nativeKeys=sorted(left), portKeys=sorted(right))
        for key in left:
            result = difference(left[key], right[key], f'{path}.{key}'.lstrip('.'))
            if result:
                return result
    elif isinstance(left, list):
        for index, (a, b) in enumerate(zip(left, right)):
            result = difference(a, b, f'{path}[{index}]')
            if result:
                return result
        if len(left) != len(right):
            return dict(path=path, nativeLength=len(left), portLength=len(right))
    elif left != right:
        return dict(path=path, native=left, port=right)
    return None


def reductions(state, meta):
    """Try deleting list members and resetting scalar fields to domain defaults."""
    baseline = canonical(dict(target=state['target']), meta)
    def walk(value, default, path=()):
        if isinstance(value, dict):
            for key, child in value.items():
                if key in ['target', 'otyp', 'mnum']:
                    continue  # preserve which function/type the repro exercises
                yield from walk(child, default[key], (*path, key))
        elif isinstance(value, list):
            for index in range(len(value)):
                yield path, value[:index] + value[index + 1:]
            for index, child in enumerate(value):
                if isinstance(child, dict):
                    child_default = ({'mnum': child['mnum'], 'flags': 0, 'born': 0}
                                     if path == ('vitals',)
                                     else {**deepcopy(OBJECT), 'otyp': child['otyp']})
                    yield from walk(child, child_default, (*path, index))
        elif value != default:
            yield path, default
    for path, replacement in walk(state, baseline):
        candidate = deepcopy(state)
        parent = candidate
        for key in path[:-1]:
            parent = parent[key]
        parent[path[-1]] = replacement
        try:
            yield canonical(candidate, meta)
        except ValueError:
            continue


def minimize(state, native, port, meta, path):
    """One-minimal under the documented deletion/default-reset operations."""
    while True:
        for candidate in reductions(state, meta):
            found = difference(native.call(candidate), port.call(candidate))
            if found and found['path'] == path:
                state = candidate
                break
        else:
            return state


def negative_checks(native, port, meta):
    count = 0
    for bad in [dict(object=dict(quan=0)), dict(object=dict(otyp='BAG_OF_HOLDING', quan=2)),
                dict(hero=dict(str=126)), dict(object=dict(otyp='HEAVY_IRON_BALL',
                    owt=meta['weights'][meta['objects']['HEAVY_IRON_BALL']] + 1))]:
        try:
            canonical(bad, meta)
        except ValueError:
            count += 1
        else:
            raise RuntimeError(f'Domain probe unexpectedly accepted: {bad}')
    # Native numeric loading independently rejects a corrupted canonical input.
    bad = canonical({}, meta)
    bad['object']['quan'] = 0
    result = subprocess.run([str(CACHE / 'native')], input=json.dumps(bad) + '\n',
                            capture_output=True, text=True)
    if result.returncode != 2 or 'quan' not in result.stderr:
        raise RuntimeError('Native quantity-domain probe did not reject the input')
    count += 1
    mutants = {
        'weight': dict(target='weight'),
        'capacity': dict(target='inv_weight'),
        'damage': dict(target='dmgval'),
        'accuracy': dict(target='find_roll_to_hit', monster=dict(mstun=1)),
        'state': dict(target='dmgval'),
        'rng': dict(target='dmgval'),
        'log': dict(target='dmgval'),
    }
    for name, raw in mutants.items():
        state = canonical(raw, meta)
        c_result = native.call(state)
        if difference(c_result, port.call(state)):
            raise RuntimeError(f'Mutant control already diverges: {name}')
        with Worker(['node', str(HERE / 'port.mjs')], f'mutant-{name}', name) as worker:
            found = difference(c_result, worker.call(state))
        expected = {'state': 'state.', 'rng': 'rng.core', 'log': 'rng.log'}.get(name, 'result')
        if not found or not found['path'].startswith(expected):
            raise RuntimeError(f'Mutant survived or failed for the wrong reason: {name}: {found}')
        print(f'KILLED {name}: {found["path"]}', flush=True)
    print(f'Domain probes rejected: {count}; emitted-JS mutants killed: {len(mutants)}', flush=True)


def creation_negative_checks(native, port, meta):
    """Break one entry-state relation, then mutate each real JS target."""
    controls = {
        'create_object': dict(target='mksobj', init=0),
        'create_class': dict(target='mkobj', oclass=4),
        'random_range': dict(target='rnd_class'),
        'random_monster': dict(target='rndmonst'),
        'monster_class': dict(target='mkclass'),
        'monster_weapons': dict(target='makemon_inventory', mnum='hobbit'),
        'monster_inventory': dict(target='makemon_inventory', mnum='leprechaun'),
        'stasis': dict(target='makemon_inventory', mnum='hobbit',
                       level=dict(moves=40, stasisUntil=40)),
    }
    broken_relations = {
        'create_object': ('init', 1),
        'create_class': ('oclass', 2),
        'random_range': ('first', meta['objects']['KNIFE']),
        'random_monster': ('level.heroLevel', 30),
        'monster_class': ('mclass', 2),
        'monster_weapons': ('mnum', meta['monsters'].index('soldier')),
        'monster_inventory': ('mnum', meta['monsters'].index('soldier')),
        'stasis': ('level.stasisUntil', 39),
    }
    for name, raw in controls.items():
        state = canonical(raw, meta)
        observed = native.call(state)
        if difference(observed, port.call(state)):
            raise RuntimeError(f'Creation negative-check control diverges: {name}')
        broken = deepcopy(state)
        field, value = broken_relations[name]
        if field.startswith('level.'):
            broken['level'][field.split('.')[1]] = value
        else:
            broken[field] = value
        broken = canonical(broken, meta)
        found = difference(observed, port.call(broken))
        if not found:
            raise RuntimeError(f'Entry-correspondence probe failed to find a counterexample: {name}')
        print(f'COUNTEREXAMPLE {name}: unequal {field}: {found}', flush=True)
        with Worker(['node', str(HERE / 'port.mjs')], f'mutant-{name}', name) as mutant:
            found = difference(observed, mutant.call(state))
        expected = 'objects' if name in ['create_object', 'create_class', 'monster_weapons', 'monster_inventory'] else 'result'
        if name == 'stasis':
            expected = 'teleportRestricted'
        if not found or not found['path'].startswith(expected):
            raise RuntimeError(f'Creation mutant survived or failed for the wrong reason: {name}: {found}')
        print(f'KILLED {name}: {found}', flush=True)
    invalid = [dict(target='mksobj', otyp=17), dict(target='mkobj', oclass=1),
               dict(target='rnd_class', first=len(meta['names'])),
               dict(target='rndmonst', level=dict(depth=0)), dict(target='mkclass', mclass=0),
               dict(target='makemon_inventory', mnum=len(meta['monsters']))]
    for raw in invalid:
        try:
            canonical(raw, meta)
        except ValueError:
            continue
        raise RuntimeError(f'Creation domain accepted invalid input: {raw}')
    print(f'Creation checks: {len(controls)} correspondence counterexamples, '
          f'{len(controls)} killed mutants, {len(invalid)} rejected input probes', flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--creation', action='store_true', help='creation inputs instead of the six original targets')
    parser.add_argument('--count', type=int, default=600, help='random cases, in addition to edge cases')
    parser.add_argument('--seed', type=int, default=20261029, help='input generator seed, not gameplay seed')
    parser.add_argument('--input', type=Path, help='JSON case or JSONL cases; skips generated cases')
    parser.add_argument('--build', action='store_true', help='recompile all linked C sources first')
    parser.add_argument('--self-test', action='store_true', help='run domain probes and actual emitted-JS mutants')
    parser.add_argument('--no-minimize', action='store_true', help='retain original inputs for a quick first pass')
    parser.add_argument('--report', type=Path, default=CACHE / 'mismatches.jsonl')
    args = parser.parse_args()
    if not 0 <= args.count <= 100000:
        parser.error('--count must be in [0, 100000]')
    CACHE.mkdir(parents=True, exist_ok=True)
    if args.build:
        build()
    if not (CACHE / 'native').exists():
        parser.error('Build the harness first with --build')
    meta = metadata()
    if args.input:
        source = args.input.read_text()
        try:
            raw = json.loads(source)
        except json.JSONDecodeError:
            cases = [canonical(json.loads(line), meta) for line in source.splitlines() if line.strip()]
        else:
            cases = [canonical(raw, meta)]
    else:
        cases = ([*creation_edges(meta), *creation_generated(meta, args.count, args.seed)]
                 if args.creation else [*edge_cases(meta), *generated_cases(meta, args.count, args.seed)])
    if not cases:
        parser.error('No input cases; an empty run cannot pass')
    started = time.monotonic()
    totals, failures = Counter(), Counter()
    args.report.parent.mkdir(parents=True, exist_ok=True)
    with ExitStack() as stack, args.report.open('w') as report:
        native = stack.enter_context(Worker([str(CACHE / 'native')], 'native'))
        port = stack.enter_context(Worker(['node', str(HERE / 'port.mjs')], 'port'))
        if args.self_test:
            negative_checks(native, port, meta)
            if args.creation:
                creation_negative_checks(native, port, meta)
        for index, state in enumerate(cases):
            target = ALL_TARGETS[state['target']]
            totals[target] += 1
            try:
                c_result, js_result = native.call(state), port.call(state)
            except RuntimeError as error:
                error_path = CACHE / 'harness-error.json'
                error_path.write_text(json.dumps(dict(index=index, input=state, error=str(error)), indent=2) + '\n')
                raise RuntimeError(f'Case {index} {target} failed; input and error: {error_path}') from error
            found = difference(c_result, js_result)
            if not found:
                continue
            failures[target] += 1
            reduced = state if args.no_minimize else minimize(state, native, port, meta, found['path'])
            native_after, port_after = native.call(reduced), port.call(reduced)
            record = dict(index=index, target=target, difference=difference(native_after, port_after),
                          functions=dict(zip(['native', 'port'], ALL_LOCATIONS[state['target']])),
                          input=reduced, native=native_after, port=port_after,
                          reduction='disabled' if args.no_minimize else 'one-minimal under deletion/default resets',
                          reachability='Not established by generated state; inspect the C callers before classifying')
            report.write(json.dumps(record) + '\n')
            report.flush()
            print(f'DIFF case {index} {target}: {found["path"]}; reproducer in {args.report}', flush=True)
        for target in ALL_TARGETS:
            if not totals[target]:
                continue
            print(f'{target:<18} {totals[target]:5} cases {failures[target]:5} mismatches')
    elapsed = time.monotonic() - started
    print(f'{sum(totals.values())} cases; {sum(failures.values())} mismatches; {elapsed:.2f}s; {args.report}')
    return 1 if failures else 0


if __name__ == '__main__':
    raise SystemExit(main())
