"""Prove pinned NetHack C functions equivalent to the emitted JavaScript port.

For every input in the stated domain, every random sequence, and both RNG-log
settings, the C and JavaScript functions must return the same value, consume
the same random-stream positions, and emit the same RNG-log entries, with no C
undefined behavior and no JavaScript exception or inexact arithmetic.

    uv run prove.py [--only NAME] [--no-probes] [--no-mutants]
"""
from __future__ import annotations

import argparse
import functools
import os
import subprocess
import sys
import time
from pathlib import Path

import z3

from cfront import CFront
from core import STREAMS, Machine, Unsupported, World
from csym import CExec, CPtr, CVal, in_range
from jssym import JSExec, V, parse_module
from specs import SPECS

print = functools.partial(print, flush=True)
HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]


def recorder_dir() -> Path:
    if 'NETHACK_RECORDER' in os.environ:
        return Path(os.environ['NETHACK_RECORDER'])
    local = REPO / 'nethack-c' / 'recorder'
    if (local / 'src' / 'rnd.c').exists():
        return local
    common = subprocess.run(['git', 'rev-parse', '--path-format=absolute', '--git-common-dir'],
                            cwd=REPO, capture_output=True, text=True, check=True).stdout.strip()
    return Path(common).parent / 'nethack-c' / 'recorder'


def load_modules(overrides=None) -> dict:
    modules = {}
    for label in ('js/rng.js', 'js/hacklib.js'):
        source = (overrides or {}).get(label) or (REPO / label).read_bytes()
        functions, imports, module_vars = parse_module(source)
        modules[label] = (source, functions, imports)
    return modules


def build_world(spec, logging: bool, pre_fn) -> World:
    params, symbols, pre = [], {}, []
    for name, t in spec.params:
        sym = z3.Int(name)
        params.append((name, sym, t))
        symbols[name] = sym
        pre.append(in_range(sym, t))
    c_state, js_state = {}, {}
    for key, t, js_path in spec.state:
        sym = z3.Int(key)
        symbols[key] = sym
        c_state[key] = (sym, t)
        js_state[js_path] = sym
        pre.append(in_range(sym, t))
    pre.extend(pre_fn(symbols))
    return World(logging=logging, pre=pre, params=params, c_state=c_state, js_state=js_state,
                 c_globals={'rng_logfile': CPtr(logging), 'rng_log_disp': CVal(z3.IntVal(0), (32, True))},
                 loops=spec.loops)


def js_module_env(logging: bool) -> dict:
    return {
        '_rngLogEnabled': V('bool', z3.BoolVal(logging)),
        'game': V('obj', 'game'),
        'game.coreCtx': V('ctx', STREAMS.index('core')),
        'game.displayCtx': V('ctx', STREAMS.index('display')),
    }


def _solve(constraints):
    s = z3.Solver()
    s.set('timeout', 120_000)
    s.add(*constraints)
    return s.check(), s


def _outputs_equal(c, j):
    if len(c.events) != len(j.events) or any(a.shape != b.shape or len(a.values) != len(b.values)
                                             for a, b in zip(c.events, j.events)):
        return z3.BoolVal(False)
    if not isinstance(c.ret, CVal) or j.ret.kind != 'num':
        return z3.BoolVal(False)
    eqs = [c.ret.v == j.ret.v]
    eqs += [c.pos[s] == j.pos[s] for s in STREAMS]
    for a, b in zip(c.events, j.events):
        eqs += [x == y for x, y in zip(a.values, b.values)]
    return z3.And(eqs)


def describe_model(model, world, extra=()):
    parts = [f'{name}={model.eval(sym, model_completion=True)}' for name, sym, _ in world.params]
    parts += [f'{key}={model.eval(sym, model_completion=True)}' for key, (sym, _) in world.c_state.items()]
    parts.append(f'logging={world.logging}')
    for s, fn in world.streams.items():
        draws = [f'{model.eval(fn(k), model_completion=True)}' for k in range(3)]
        parts.append(f'R_{s}[0..2]=' + ','.join(draws))
    parts.extend(extra)
    return ' '.join(parts)


def show_path(model, label, p):
    ret = p.ret.v if isinstance(p.ret, CVal) else (p.ret.v if p.ret is not None and p.ret.kind == 'num' else None)
    value = model.eval(ret, model_completion=True) if ret is not None else 'none'
    events = ['%s%s' % (e.shape.format(*[model.eval(v, model_completion=True) for v in e.values]), '')
              for e in p.events]
    pos = {s: model.eval(p.pos[s], model_completion=True) for s in STREAMS}
    return f'{label}: returns {value}, draws {pos}, log {events}'


def check(spec, front, modules, pre_fn) -> tuple[bool, str]:
    """Return (proved, report) over both logging settings."""
    summary = []
    for logging in (False, True):
        reports = []
        world = build_world(spec, logging, pre_fn)
        if _solve(world.pre)[0] != z3.sat:
            return False, 'domain is empty'
        cm, jm = Machine(world, 'c'), Machine(world, 'js')
        try:
            c_args = [CVal(sym, t) for _, sym, t in world.params]
            c_paths = CExec(cm, front).run(spec.c, c_args)
            j_args = [V('num', sym) for _, sym, _ in world.params]
            j_paths = JSExec(jm, modules, js_module_env(logging)).run(spec.js, j_args)
        except Unsupported as error:
            return False, f'unsupported: {error}'
        for machine in (cm, jm):
            seen = set()
            for ob in machine.obligations:
                if (ob.what, ob.where) in seen:
                    continue
                result, solver = _solve(world.pre + ob.pc + [z3.Not(ob.cond)])
                if result == z3.sat:
                    seen.add((ob.what, ob.where))
                    reports.append(f'{ob.what} at {ob.where}: {describe_model(solver.model(), world)}')
                elif result == z3.unknown:
                    seen.add((ob.what, ob.where))
                    reports.append(f'{ob.what} at {ob.where}: solver gave up')
        if reports:
            return False, f'log={"on" if logging else "off"}: ' + '\n    '.join(reports)
        for c in c_paths:
            for j in j_paths:
                result, solver = _solve(world.pre + c.pc + j.pc + [z3.Not(_outputs_equal(c, j))])
                if result == z3.sat:
                    model = solver.model()
                    return False, (f'outputs differ: {describe_model(model, world)}\n    '
                                   f'{show_path(model, "C ", c)}\n    {show_path(model, "JS", j)}')
                if result == z3.unknown:
                    return False, 'solver gave up on output equality'
        summary.append(f'log={"on" if logging else "off"}: {len(c_paths)} C x {len(j_paths)} JS paths, '
                       f'{len(cm.obligations) + len(jm.obligations)} obligations')
    return True, '; '.join(summary)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--only', action='append')
    parser.add_argument('--no-probes', action='store_true')
    parser.add_argument('--no-mutants', action='store_true')
    args = parser.parse_args()

    recorder = recorder_dir()
    front = CFront(recorder, [recorder / 'src' / 'rnd.c', recorder / 'src' / 'hacklib.c', HERE / 'harness' / 'rn1.c'])
    modules = load_modules()
    print(f'C sources: {recorder}/src   JavaScript: {REPO}/js   z3 {z3.get_version_string()}')
    failures = 0
    for spec in SPECS:
        if args.only and spec.name not in args.only:
            continue
        start = time.monotonic()
        proved, report = check(spec, front, modules, spec.pre)
        print(f'{"PROVED " if proved else "FAILED "} {spec.name:<20} {time.monotonic() - start:6.1f}s  {report}')
        failures += not proved
        if not args.no_probes:
            for label, pre_fn in spec.probes:
                proved, report = check(spec, front, modules, pre_fn)
                print(f'  {"differs" if not proved else "UNEXPECTEDLY EQUAL"} outside domain ({label}): {report}')
                failures += proved
        if not args.no_mutants:
            for file, old, new, *expect in spec.mutants:
                equivalent = expect == ['equivalent']
                source = modules[file][0]
                if source.count(old.encode()) != 1:
                    print(f'  mutant text not unique in {file}: {old!r}')
                    failures += 1
                    continue
                mutated = load_modules({file: source.replace(old.encode(), new.encode())})
                proved, report = check(spec, front, mutated, spec.pre)
                first = report.splitlines()[0]
                verdict = ('equivalent' if proved else 'NOT EQUIVALENT') if equivalent else \
                    ('killed' if not proved else 'SURVIVED')
                print(f'  {verdict} mutant {old!r} -> {new!r}: {first}')
                failures += proved != equivalent
    print('all claims hold' if failures == 0 else f'{failures} claim(s) failed')
    return 1 if failures else 0


if __name__ == '__main__':
    sys.exit(main())
