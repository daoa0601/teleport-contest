"""Prove pinned NetHack C functions equivalent to the JavaScript used in scoring.

Leaf functions use emitted js/*.js; ISAAC64 uses frozen/isaac64.js, which
score.sh installs over the emitted adapter before running the game.

For every input in the stated domain, every random sequence, and both RNG-log
settings, the C and JavaScript functions must return the same value, consume
the same random-stream positions, and emit the same RNG-log entries, with no C
undefined behavior and no JavaScript exception or inexact arithmetic.

    uv run prove.py [--only NAME] [--shard I/N] [--no-probes] [--no-mutants]
"""
from __future__ import annotations

import argparse
import csv
import functools
import json
import os
import re
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path

import z3

from cfront import CFront
from core import STREAMS, U64, Machine, Unsupported, World
from csym import CExec, CPtr, CStr, CText, CVal, in_range
from jssym import JSExec, Modules, V, parse_module
from specs import C_FILES, JS_FILES, SPECS
from isaac_specs import run as prove_isaac64
from isaac_seed import run as prove_seed_packing
from isaac_ledger import claims as isaac_claims
from queries import solve

print = functools.partial(print, flush=True)
HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
LEDGER_COLUMNS = ('spec', 'domain', 'probes', 'mutants', 'runtime')


@dataclass(frozen=True)
class ClaimSummary:
    domain: str
    probes: int
    mutants: int
    slow: bool = False


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
    modules = Modules()
    for label in JS_FILES:
        source = (overrides or {}).get(label) or (REPO / label).read_bytes()
        functions, imports, module_vars = parse_module(source)
        modules[label] = (source, functions, imports, module_vars)
    return modules


def build_world(spec, logging: bool, pre_fn, front) -> World:
    params, symbols, pre = [], {}, []
    fixed = getattr(pre_fn, 'fixed_inputs', {})
    for name, t in spec.params:
        sym = z3.IntVal(fixed[name]) if name in fixed else z3.Int(name)
        params.append((name, sym, t))
        symbols[name] = sym
        pre.append(in_range(sym, t))
    c_state, js_state = {}, {}
    for key, t, js_path in spec.state:
        sym = z3.IntVal(fixed[key]) if key in fixed else z3.Int(key)
        symbols[key] = sym
        c_state[key] = (sym, t)
        pre.append(in_range(sym, t))
        if js_path is None:
            continue
        if key in getattr(pre_fn, 'unrelated_state', ()):
            other = z3.Int('js:' + js_path)
            pre.append(in_range(other, t))
            js_state[js_path] = other
        else:
            js_state[js_path] = sym
    choices = {}
    for key, t, js_path, mapping in spec.enum_state:
        sym = z3.Int(key)
        symbols[key] = sym
        c_state[key] = (sym, t)
        pre.append(in_range(sym, t))
        entries = [(sym == front.enum_value(native), text) for native, text in mapping]
        pre.append(z3.Or(*(condition for condition, _ in entries)))
        choices[js_path] = entries
    pre.extend(pre_fn(symbols))
    c_globals = {'rng_logfile': CPtr(logging), 'rng_log_disp': CVal(z3.IntVal(0), (32, True))}
    c_globals.update({key: CPtr(False) for key, _ in spec.nulls})
    js_values = {}
    for key, aliases in spec.references:
        present = z3.Int(key + ':present')
        pre.append(z3.Or(present == 0, present == 1))
        c_globals[key] = CPtr(present != 0, key)
        slots = z3.Int(key + ':slots')
        pre.append(z3.And(slots >= 1, slots < 2 ** len(aliases)))
        for index, alias in enumerate(aliases):
            active = z3.And(present != 0, (slots / (2 ** index)) % 2 == 1)
            js_values[alias] = V('choice', [(active, V('obj', aliases[0])),
                                           (z3.Not(active), V('null'))])
    return World(logging=logging, pre=pre, params=params, c_state=c_state, js_state=js_state,
                 c_globals=c_globals, js_choices=choices,
                 loops=spec.loops, js_values=js_values,
                 unrelated_state=getattr(pre_fn, 'unrelated_state', ()))


def js_module_env(logging: bool) -> dict:
    return {
        '_rngLogEnabled': V('bool', z3.BoolVal(logging)),
        'game': V('obj', 'game'),
        'game.coreCtx': V('ctx', STREAMS.index('core')),
        'game.displayCtx': V('ctx', STREAMS.index('display')),
    }


def _solve(constraints):
    return solve(constraints, 120_000)


def _outputs_equal(c, j):
    if len(c.events) != len(j.events) or any(a.shape != b.shape or len(a.values) != len(b.values)
                                             for a, b in zip(c.events, j.events)):
        return z3.BoolVal(False)
    c_value, j_value = returned_integer(c), returned_integer(j)
    if c_value is not None and j_value is not None:
        eqs = [c_value == j_value]
    else:
        native, port = returned_text(c), returned_text(j)
        if native is None or port is None:
            return z3.BoolVal(False)
        c_text, c_present = native
        j_text, j_present = port
        eqs = [c_present == j_present,
               z3.Implies(c_present, c_text == j_text)]
    eqs += [c.pos[s] == j.pos[s] for s in STREAMS]
    for a, b in zip(c.events, j.events):
        eqs += [x == y for x, y in zip(a.values, b.values)]
    return z3.And(eqs)


def _stream_applications(world, formula) -> set:
    """Every R_stream(...) application mentioned by the formula."""
    functions = set(world.streams.values())
    found, seen = set(), set()

    def visit(term):
        if term.get_id() in seen:
            return
        seen.add(term.get_id())
        if term.num_args() and term.decl() in functions:
            found.add(term)
        for index in range(term.num_args()):
            visit(term.arg(index))

    visit(formula)
    return found

def _mentions_uninterpreted(world, formula) -> bool:
    """Whether the formula applies any uninterpreted function besides the
    random streams. Annotated-loop facts introduce definitional extensions
    (a recurrence summing draws); an exit path condition describes the
    program only through those definitions, and the coverage negation
    cannot soundly quantify them away: the definitional value is not an
    input the witness may choose."""
    streams = set(world.streams.values())
    seen = set()

    def visit(term):
        if term.get_id() in seen:
            return False
        seen.add(term.get_id())
        if term.num_args() and term.decl().kind() == z3.Z3_OP_UNINTERPRETED:
            return term.decl() not in streams
        return any(visit(term.arg(index)) for index in range(term.num_args()))

    return visit(formula)


def _free_constants(formula) -> set:
    """Every free uninterpreted constant (z3.Int('x'), Bool marks) in the
    formula, collected by one linear walk. z3util.get_vars is super-linear
    on the deeply joined terms the bounded-state claims produce."""
    found, seen = set(), set()

    def visit(term):
        if term.get_id() in seen:
            return
        seen.add(term.get_id())
        if not term.num_args() and term.decl().kind() == z3.Z3_OP_UNINTERPRETED:
            found.add(term)
        for index in range(term.num_args()):
            visit(term.arg(index))

    visit(formula)
    return found

def _local_draw_bound(world, entry, local_set):
    """The stream term when this path condition is exactly a draw's legality
    bound t >= 0 ∧ t < 2**64 over one locally-positioned stream term.

    A legal stream satisfies that bound at every position, so the coverage
    question may drop the conjunct: keeping it would let a witness pick an
    illegal value at that position and vacate the clause for a claim that is
    genuinely covered."""
    if not (z3.is_and(entry) and entry.num_args() == 2):
        return None
    low, high = entry.arg(0), entry.arg(1)
    if not z3.is_ge(low):
        low, high = high, low
    if not (z3.is_ge(low) and z3.is_lt(high)):
        return None
    term, zero = low.arg(0), low.arg(1)
    same, limit = high.arg(0), high.arg(1)
    if not (z3.is_int_value(zero) and zero.as_long() == 0
            and z3.is_int_value(limit) and limit.as_long() == U64
            and z3.eq(term, same)):
        return None
    mentioned = _stream_applications(world, entry)
    if len(mentioned) != 1 or not z3.eq(next(iter(mentioned)), term):
        return None
    if any(v not in local_set for v in _free_constants(term)):
        return None
    return term


def _uncovered(world, paths, obligations):
    """(result, solver): 'skipped' when the check cannot be made sound,
    else sat with a model when some input in the domain has no path whose
    condition can hold for it.

    Executor-local symbols (havoced loop variables, fresh stream positions)
    are existential per path: a path covers an input when some value of its
    locals satisfies the path condition, so the negation quantifies each
    path's locals universally. Stream values are inputs shared by every
    path, so a witness may not pick illegal draws: every R_stream(term) a
    path condition mentions without local symbols is bounded to
    [0, 2**64) in the query, and a draw's legality bound over a
    locally-positioned term is dropped from the clause because a legal
    stream implies it at every position. Inputs where a dropped-path
    obligation (an assert branch, a thrown path) is violated are excluded:
    those inputs fail the claim through the obligation itself, and the
    claim is only sound when the remaining region is covered. Domain
    symbols stay free, so a model of the negation names an uncovered input.

    A path set that mentions a non-stream uninterpreted function is skipped:
    such functions are definitional extensions introduced by loop
    annotations, and for annotated loops the exit coverage is a theorem of
    the annotation machinery instead — the invariant holds on entry and is
    preserved from the fully havoced head, so every real exit state is
    described by some havoced head state, and Machine._induct fails closed
    when the havoc set misses a write or the body touches global state.
    """
    if any(_mentions_uninterpreted(world, z3.And(*p.pc)) for p in paths):
        return 'skipped', None
    domain = _free_constants(z3.And(*world.pre))
    domain.update(sym for _, sym, _ in world.params)
    domain.update(sym for sym, _ in world.c_state.values())
    domain.update(world.js_state.values())
    dropped = [ob for ob in obligations if ob.drop]
    bounds, clauses = [], [z3.Not(z3.And(*ob.pc, z3.Not(ob.cond))) for ob in dropped]
    for path in paths:
        pc = z3.And(*path.pc)
        locals_ = [v for v in _free_constants(pc) if v not in domain]
        local_set = set(locals_)
        for term in _stream_applications(world, pc):
            if not any(v in local_set for v in _free_constants(term)):
                bounds += [term >= 0, term < U64]
        kept = [entry for entry in path.pc
                if _local_draw_bound(world, entry, local_set) is None]
        body = z3.Not(z3.And(*kept)) if kept else z3.BoolVal(False)
        clauses.append(z3.ForAll(locals_, body) if locals_ else body)
    solver = z3.Solver()
    solver.set('timeout', 120_000)
    solver.add(*world.pre, *bounds, *clauses)
    result = solver.check()
    return result, solver


def coalesce_returns(paths):
    """Join read-only outcomes with the same return and stream positions.

    An unused branch (for example Strength in polymorphed abon) need not
    multiply the equality queries. Logged outcomes retain their full paths.
    """
    groups = []
    for path in paths:
        if path.events or path.heap:
            groups.append(path)
            continue
        value = returned_integer(path)
        if value is None:
            groups.append(path)
            continue
        value = z3.simplify(value)
        for other in groups:
            other_value = returned_integer(other)
            if (not other.events and not other.heap and other_value is not None and z3.eq(value, z3.simplify(other_value))
                    and all(z3.eq(path.pos[s], other.pos[s]) for s in STREAMS)):
                other.pc = [z3.Or(z3.And(*other.pc), z3.And(*path.pc))]
                break
        else:
            groups.append(path.fork())
    return groups


def returned_integer(path):
    if isinstance(path.ret, CVal):
        return path.ret.v
    if isinstance(path.ret, V) and path.ret.kind == 'num':
        return path.ret.v
    if isinstance(path.ret, V) and path.ret.kind == 'bool':
        # Native predicates return 0 or 1. Do not collapse other integers
        # to truth values: a native return of 2 must still differ from true.
        return z3.If(path.ret.v, z3.IntVal(1), z3.IntVal(0))
    return None


def returned_text(path):
    value = path.ret
    if isinstance(value, CStr):
        return z3.StringVal(value.s), z3.BoolVal(True)
    if isinstance(value, CText):
        return value.s, value.present
    if isinstance(value, CPtr) and value.nonnull is False:
        return z3.StringVal(''), z3.BoolVal(False)
    if isinstance(value, V):
        if value.kind == 'null':
            return z3.StringVal(''), z3.BoolVal(False)
        if value.kind == 'str':
            if isinstance(value.v, str):
                return z3.StringVal(value.v), z3.BoolVal(True)
            # JSExec encodes null in a symbolic name-table read as ''.
            # It rejects tables containing an actual empty string.
            return value.v, value.v != ''
    return None


def describe_model(model, world, extra=()):
    parts = [f'{name}={model.eval(sym, model_completion=True)}' for name, sym, _ in world.params]
    parts += [f'{key}={model.eval(sym, model_completion=True)}' for key, (sym, _) in world.c_state.items()]
    parts += [f'js:{key}={model.eval(sym, model_completion=True)}' for key, sym in world.js_state.items()
              if not any(z3.eq(sym, original) for original, _ in world.c_state.values())]
    parts += [f'{key}:nonnull={model.eval(value.nonnull, model_completion=True)}'
              for key, value in world.c_globals.items()
              if isinstance(value, CPtr) and isinstance(value.nonnull, z3.BoolRef)]
    parts += [f'{name}()={model.eval(value.v, model_completion=True)}'
              for name, cases in world.c_calls.items() for _, value in cases if isinstance(value, CVal)]
    parts.append(f'logging={world.logging}')
    for s, fn in world.streams.items():
        draws = [f'{model.eval(fn(k), model_completion=True)}' for k in range(3)]
        parts.append(f'R_{s}[0..2]=' + ','.join(draws))
    parts.extend(extra)
    return ' '.join(parts)


def show_path(model, label, p):
    ret = returned_integer(p)
    if ret is not None:
        value = model.eval(ret, model_completion=True)
    else:
        text = returned_text(p)
        value = 'none'
        if text is not None:
            content, present = text
            if z3.is_false(model.eval(present, model_completion=True)):
                value = 'null'
            else:
                value = model.eval(content, model_completion=True)
    events = ['%s%s' % (e.shape.format(*[model.eval(v, model_completion=True) for v in e.values]), '')
              for e in p.events]
    pos = {s: model.eval(p.pos[s], model_completion=True) for s in STREAMS}
    return f'{label}: returns {value}, draws {pos}, log {events}'


def check(spec, front, modules, pre_fn, *, pairwise_outputs=False) -> tuple[bool, str]:
    if spec.partitions is None:
        return _check(spec, front, modules, pre_fn, pairwise_outputs)
    covered = 0
    path_counts = []
    for label, fixed in spec.partitions(front):
        # A partition either fixes symbols to values (the species tables) or
        # adds arbitrary domain constraints (the rnl luck-sum split); both
        # must cover the whole domain between them.
        if callable(fixed):
            constraints, fixed = fixed, {}
        else:
            def constraints(s, _fixed=fixed):
                return [s[key] == value for key, value in _fixed.items()]

        def partition(s):
            return pre_fn(s) + constraints(s)
        partition.unrelated_state = getattr(pre_fn, 'unrelated_state', ())
        partition.fixed_inputs = fixed
        proved, report = _check(spec, front, modules, partition, pairwise_outputs)
        if not proved:
            return False, f'{label}: {report}'
        path_counts.extend((int(c), int(j)) for c, j in re.findall(r'(\d+) C x (\d+) JS paths', report))
        covered += 1
        if covered % 64 == 0:
            print(f'    {spec.name}: {covered} domains checked')
    if not covered:
        return False, 'domain is empty'
    if covered == 1:
        return True, report
    shape = ''
    if path_counts:
        shape = (f'; paths per partition: C {min(c for c, _ in path_counts)}..{max(c for c, _ in path_counts)}, '
                 f'JS {min(j for _, j in path_counts)}..{max(j for _, j in path_counts)}')
    return True, f'{covered} partitions, log=off and log=on{shape}'


def _check(spec, front, modules, pre_fn, pairwise_outputs=False) -> tuple[bool, str]:
    """Return (proved, report) over both logging settings."""
    summary = []
    for logging in (False, True):
        reports = []
        try:
            world = build_world(spec, logging, pre_fn, front)
            if _solve(world.pre)[0] == z3.unsat:
                return False, 'domain is empty'
            spec.configure(world, front, modules)
        except Unsupported as error:
            return False, f'unsupported: {error}'
        domain_result = _solve(world.pre)[0]
        if domain_result == z3.unsat:
            return False, 'domain is empty'
        if domain_result == z3.unknown:
            return False, 'solver gave up on domain satisfiability'
        cm, jm = Machine(world, 'c'), Machine(world, 'js')
        try:
            c_args = [CVal(sym, t) for _, sym, t in world.params]
            j_args = [V('num', sym) for _, sym, _ in world.params]
            env = js_module_env(logging)
            env.update({key: V('null') for _, paths in spec.nulls for key in paths})
            j_args.extend(V('choice', world.js_choices[value]) if kind == 'state' else V(kind, value)
                          for kind, value in spec.js_args)
            if spec.arguments is not None:
                c_args, j_args = spec.arguments(world, front)
            c_paths = CExec(cm, front).run(spec.c, c_args)
            executor = JSExec(jm, modules, env)
            j_paths = (executor.run_initializer(spec.js, spec.js_initializer, world.js_locals, spec.js_file)
                       if spec.js_initializer else executor.run(spec.js, j_args, spec.js_file))
            # A store whose final value equals the entry term leaves the
            # observable state unchanged; dropping it lets equal outcomes
            # merge and leaves only genuine changes under restored_state.
            def entry_term(key):
                value = world.c_globals.get(key)
                if isinstance(value, CVal):
                    return value.v
                return world.c_state[key][0] if key in world.c_state else None

            for c in c_paths:
                for key in list(c.heap):
                    original = entry_term(key)
                    if original is not None and z3.eq(z3.simplify(c.heap[key].v),
                                                      z3.simplify(original)):
                        del c.heap[key]
            c_paths, j_paths = coalesce_returns(c_paths), coalesce_returns(j_paths)
            for key in spec.restored_state:
                original = entry_term(key)
                if original is None:
                    return False, f'restored state {key} has no entry value'
                storage_key = re.sub(r'\[([A-Z_]+)\]',
                                     lambda match: f'[{front.enum_value(match[1])}]', key)
                for c in c_paths:
                    final = c.heap.get(storage_key)
                    if final is not None:
                        cm.oblige(c, final.v == original,
                                  f'final {key} differs from its entry value', f'restored {key}')
            for c in c_paths:
                for key, final in c.heap.items():
                    if key in spec.native_only_state:
                        continue
                    original = entry_term(key)
                    if original is None:
                        raise Unsupported(f'C exit state {key} has no entry value')
                    cm.oblige(c, final.v == original,
                              f'final {key} differs from its entry value', f'restored {key}')
            if spec.result_range is not None:
                low, high = spec.result_range
                for machine, paths in ((cm, c_paths), (jm, j_paths)):
                    for path in paths:
                        value = returned_integer(path)
                        if value is None:
                            raise Unsupported('result-range contract needs an integer result')
                        machine.oblige(path, z3.And(value >= low, value <= high),
                                       'result outside proved call-summary range', spec.name)
            # Sound comparison needs every feasible input covered by a path
            # on each side: the pairwise equality queries below only
            # constrain the region covered by both path sets, so an input
            # region one executor dropped (an unjustified narrowing, a lost
            # branch) would otherwise pass vacuously. Regions the executor
            # removed together with a drop obligation (an assert branch, a
            # thrown path) are legitimate: they fail the claim through that
            # obligation when reachable. An uncovered region, or a solver
            # that cannot decide coverage, fails the claim instead of
            # proving it.
            for side, machine, side_paths in (('C', cm, c_paths), ('JS', jm, j_paths)):
                result, solver = _uncovered(world, side_paths, machine.obligations)
                if result == z3.sat:
                    return False, (f'log={"on" if logging else "off"}: {side} paths do not '
                                   f'cover the input domain: {describe_model(solver.model(), world)}')
                if result == z3.unknown:
                    return False, (f'log={"on" if logging else "off"}: solver gave up on '
                                   f'{side} path coverage')
        except Unsupported as error:
            return False, f'unsupported: {error}'
        for machine in (cm, jm):
            groups = {}
            for ob in machine.obligations:
                groups.setdefault((ob.what, ob.where), []).append(z3.And(*ob.pc, z3.Not(ob.cond)))
            for (what, where), violations in groups.items():
                result, solver = _solve(world.pre + [z3.Or(*violations)])
                if result == z3.sat:
                    reports.append(f'{what} at {where}: {describe_model(solver.model(), world)}')
                elif result == z3.unknown:
                    reports.append(f'{what} at {where}: solver gave up')
        if reports:
            return False, f'log={"on" if logging else "off"}: ' + '\n    '.join(reports)
        differences = [(c, j, z3.And(*c.pc, *j.pc, z3.Not(_outputs_equal(c, j))))
                       for c in c_paths for j in j_paths]
        # A small table partition shares most of its conditions. RNG claims
        # solve better one path pair at a time. Negative checks also split
        # path pairs: the large table disjunction can hide an easy witness.
        queries = ([differences] if spec.partitions is not None and not pairwise_outputs
                   else [[difference] for difference in differences])
        for candidates in queries:
            result, solver = _solve(world.pre + [z3.Or(*(term for _, _, term in candidates))])
            if result == z3.sat:
                model = solver.model()
                c, j, _ = next((c, j, term) for c, j, term in candidates
                               if z3.is_true(model.eval(term, model_completion=True)))
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
    selection = parser.add_mutually_exclusive_group()
    selection.add_argument('--slow-only', action='store_true',
                           help='check only slow proofs, preserving complete ledger metadata checks')
    selection.add_argument('--skip-slow', action='store_true',
                           help='report and exclude claims marked slow, including their negative checks')
    parser.add_argument('--shard', metavar='I/N',
                        help='check only the I-th of N interleaved groups of the otherwise selected claims')
    parser.add_argument('--no-probes', action='store_true')
    parser.add_argument('--no-mutants', action='store_true')
    parser.add_argument('--check-ledger', type=Path, help='require recorded domains, check counts, and successful proofs')
    parser.add_argument('--write-ledger', type=Path, help='record all claims after a successful complete run')
    args = parser.parse_args()
    if (args.check_ledger or args.write_ledger) and (args.only or args.no_probes or args.no_mutants):
        parser.error('ledger checks require every selected spec, probe, and mutant')
    if args.shard is not None:
        index, separator, count = args.shard.partition('/')
        if not separator or not index.isdigit() or not count.isdigit() \
                or int(count) < 1 or not 1 <= int(index) <= int(count):
            parser.error('--shard must be I/N with 1 <= I <= N and N >= 1')
    if args.write_ledger and (args.skip_slow or args.slow_only or args.shard is not None):
        parser.error('writing a ledger requires all fast and slow proofs')
    claims = {spec.name: ClaimSummary(domain_summary(spec), len(spec.probes), len(spec.mutants), spec.slow) for spec in SPECS}
    if len(claims) != len(SPECS):
        parser.error('spec names must be unique')
    for name, (domain, probes, mutants) in isaac_claims(REPO).items():
        if name in claims:
            parser.error(f'duplicate spec name: {name}')
        claims[name] = ClaimSummary(domain, probes, mutants)
    if args.check_ledger:
        try:
            recorded = read_ledger(args.check_ledger)
        except (OSError, ValueError) as error:
            parser.error(str(error))
        failures = 0
        for name, expected in sorted(recorded.items()):
            current = claims.get(name)
            changes = ['missing spec'] if current is None else claim_changes(expected, current)
            if changes:
                print(f'FAILED  {name:<20} {"; ".join(changes)}')
                failures += 1
        for name in sorted(claims.keys() - recorded.keys()):
            print(f'FAILED  {name:<20} unrecorded spec')
            failures += 1
        if failures:
            print('Review claim changes before using --write-ledger to accept them.')
            print(f'{failures} claim(s) failed')
            return 1

    recorder = recorder_dir()
    front = CFront(recorder, [recorder / 'src' / file for file in C_FILES] + list((HERE / 'harness').glob('*.c')))
    modules = load_modules()
    print(f'C sources: {recorder}/src   Leaf JavaScript: {REPO}/js   z3 {z3.get_version_string()}')
    failures = 0
    # Targets are the claims the selection flags name; --slow-only and
    # --shard filter them. Dependencies of a target are prerequisites and
    # are always proved in this run, whatever filter excluded them from the
    # targets: a claim is only as verified as its call summaries.
    targets = set(args.only) if args.only else {spec.name for spec in SPECS}
    if args.slow_only:
        targets &= {spec.name for spec in SPECS if spec.slow}
    if args.shard is not None:
        index, _, count = args.shard.partition('/')
        ordered = [spec.name for spec in SPECS if spec.name in targets]
        sharded = set(ordered[int(index) - 1::int(count)])
        print(f'shard {index}/{count}: {len(sharded)} of {len(ordered)} selected claims '
              f'({len(ordered) - len(sharded)} in other shards)')
        targets &= sharded
    selected = set(targets)
    for spec in reversed(SPECS):
        if spec.name in selected:
            selected.update(spec.dependencies)
    prerequisites = selected - targets
    established = set()
    for spec in SPECS:
        if spec.name not in selected:
            continue
        if spec.name not in prerequisites:
            if (args.skip_slow and spec.slow) or (args.slow_only and not spec.slow):
                print(f'SKIPPED {spec.name} ({"slow" if spec.slow else "fast"})')
                continue
        missing = set(spec.dependencies) - established
        if missing:
            print(f'FAILED  {spec.name}: unproved call summaries: {", ".join(sorted(missing))}')
            failures += 1
            continue
        start = time.monotonic()
        proved, report = check(spec, front, modules, spec.pre)
        print(f'{"PROVED " if proved else "FAILED "} {spec.name:<20} {time.monotonic() - start:6.1f}s  {report}')
        failures += not proved
        if proved:
            established.add(spec.name)
        if not args.no_probes:
            for label, pre_fn in spec.probes:
                proved, report = check(spec, front, modules, pre_fn, pairwise_outputs=True)
                concrete = 'outputs differ:' in report or ('logging=' in report and 'solver gave up' not in report)
                passed = not proved and (not spec.require_counterexamples or concrete)
                print(f'  {"differs" if passed else "PROBE FAILED"} outside domain ({label}): {report}')
                failures += not passed
        if not args.no_mutants:
            for file, old, new, *expect in spec.mutants:
                equivalent = expect == ['equivalent']
                source = modules[file][0]
                if source.count(old.encode()) != 1:
                    print(f'  mutant text not unique in {file}: {old!r}')
                    failures += 1
                    continue
                mutated = load_modules({file: source.replace(old.encode(), new.encode())})
                pre = spec.pre
                if spec.mutant_pre is not None and not equivalent:
                    pre = lambda s, spec=spec: [*spec.pre(s), *spec.mutant_pre(s)]
                proved, report = check(spec, front, mutated, pre, pairwise_outputs=True)
                first = report.splitlines()[0]
                verdict = ('equivalent' if proved else 'NOT EQUIVALENT') if equivalent else \
                    ('killed' if not proved else 'SURVIVED')
                concrete = 'outputs differ:' in report or ('logging=' in report and 'solver gave up' not in report)
                invalid_kill = spec.require_counterexamples and not equivalent and not concrete
                if invalid_kill:
                    verdict = 'NO COUNTEREXAMPLE'
                print(f'  {verdict} mutant {old!r} -> {new!r}: {first}')
                failures += proved != equivalent or invalid_kill
        print(f'  total {spec.name}: {time.monotonic() - start:.2f}s (proof, probes, mutants)')
    if not args.slow_only:
        failures += prove_isaac64(recorder, REPO, args.only, not args.no_probes, not args.no_mutants)
        failures += prove_seed_packing(front, REPO, args.only, not args.no_probes, not args.no_mutants)
    if failures == 0 and args.write_ledger:
        with args.write_ledger.open('w', newline='') as output:
            writer = csv.writer(output, delimiter='\t', lineterminator='\n')
            writer.writerow(LEDGER_COLUMNS)
            writer.writerows((name, claim.domain, claim.probes, claim.mutants, 'slow' if claim.slow else 'fast')
                             for name, claim in sorted(claims.items()))
    print('all claims hold' if failures == 0 else f'{failures} claim(s) failed')
    return 1 if failures else 0


def domain_summary(spec) -> str:
    """Keep the ledger's reviewable domain derived from the actual spec."""
    symbols = {name: z3.Int(name) for name, _ in spec.params}
    symbols.update({name: z3.Int(name) for name, _, _ in spec.state})
    symbols.update({name: z3.Int(name) for name, _, _, _ in spec.enum_state})
    types = [(name, t) for name, t in spec.params] + [(name, t) for name, t, _ in spec.state]
    types.extend((name, t) for name, t, _, _ in spec.enum_state)
    summary = [f'C function: {spec.c}', f'JS function: {spec.js_file}:{spec.js}']
    if spec.js_initializer:
        summary.append('JS expression slice: initializer of ' + spec.js_initializer)
    summary.extend(f'{name}: {"int" if signed else "uint"}{bits}' for name, (bits, signed) in types)
    summary.extend(f'{name} == {js_path}' for name, _, js_path in spec.state if js_path is not None)
    for name, _, js_path, choices in spec.enum_state:
        mapping = ', '.join(f'{native}={js}' for native, js in choices)
        summary.append(f'{name} corresponds to {js_path} in {{{mapping}}}')
    for name, js_paths in spec.nulls:
        summary.append(f'{name} == NULL')
        summary.extend(f'{js_path} == null' for js_path in js_paths)
    for name, aliases in spec.references:
        summary.append(f'{name}: nullable item shared by nonempty subsets of JS aliases {", ".join(aliases)}')
    for label, function in (('state construction', spec.configure), ('argument relation', spec.arguments),
                            ('exhaustive partitions', spec.partitions)):
        if function is not None and function.__name__ != '<lambda>':
            summary.append(f'{label}: {function.__module__}.{function.__qualname__}')
    summary.extend(spec.assumptions)
    if spec.dependencies:
        summary.append('proved call summaries: ' + ', '.join(spec.dependencies))
    if spec.restored_state:
        summary.append('restored C state: ' + ', '.join(spec.restored_state))
    if spec.native_only_state:
        summary.append('native-only exit state: ' + ', '.join(spec.native_only_state))
    if spec.result_range is not None:
        summary.append(f'proved result range: {spec.result_range[0]}..{spec.result_range[1]}')
    summary.extend(' '.join(term.sexpr().split()) for term in spec.pre(symbols))
    if spec.js_args:
        summary.append('JS extra arguments: ' + json.dumps(spec.js_args))
    summary.extend(loop_summary(key, loop) for key, loop in sorted(spec.loops.items()))
    return '; '.join(summary)


class LoopSymbols:
    """Name arbitrary loop locals without specializing their symbolic values."""
    def __init__(self, prefix: str):
        self.prefix = prefix

    def __getitem__(self, name: str):
        if not isinstance(name, str):
            raise Unsupported('ledger loop annotations must read values by name, not iterate over them')
        return z3.Int(f'{self.prefix}.{name}')


def loop_summary(key, loop) -> str:
    current, entry = LoopSymbols('current'), LoopSymbols('entry')
    pos = {stream: z3.Int(f'position.{stream}') for stream in STREAMS}
    pos0 = {stream: z3.Int(f'entry_position.{stream}') for stream in STREAMS}
    formulas = [('facts', loop.facts(current, entry, pos, pos0)),
                ('invariant', loop.invariant(current, entry, pos, pos0)),
                ('variant', [loop.variant(current, entry)])]
    details = {'streams': list(loop.streams)}
    for label, terms in formulas:
        details[label] = [term.sexpr() if isinstance(term, z3.ExprRef) else term for term in terms]
    side, function, ordinal = key
    # JSON preserves complete SMT expressions, including quoted names and newlines.
    return f'loop {side}:{function}[{ordinal}]: ' + json.dumps(details)


def claim_changes(recorded: ClaimSummary, current: ClaimSummary) -> list[str]:
    changes = []
    if recorded.domain != current.domain:
        changes.append(f'domain changed (ledger: {recorded.domain}; current: {current.domain})')
    if recorded.probes != current.probes:
        changes.append(f'probe count changed (ledger: {recorded.probes}; current: {current.probes})')
    if recorded.slow != current.slow:
        changes.append('runtime classification changed')
    if recorded.mutants != current.mutants:
        changes.append(f'mutant count changed (ledger: {recorded.mutants}; current: {current.mutants})')
    return changes


def read_ledger(path: Path) -> dict[str, ClaimSummary]:
    with path.open(newline='') as source:
        rows = csv.reader(source, delimiter='\t')
        if next(rows, None) != list(LEDGER_COLUMNS):
            raise ValueError(f'{path}: expected {", ".join(LEDGER_COLUMNS)} columns')
        claims = {}
        for line, row in enumerate(rows, 2):
            if len(row) != len(LEDGER_COLUMNS) or not all(row) or row[0] in claims:
                raise ValueError(f'{path}:{line}: invalid or duplicate claim')
            name, domain, probes, mutants, runtime = row
            if runtime not in ('fast', 'slow'):
                raise ValueError(f'{path}:{line}: runtime must be fast or slow')
            try:
                counts = (int(probes), int(mutants))
            except ValueError as error:
                raise ValueError(f'{path}:{line}: probe and mutant counts must be nonnegative integers') from error
            if min(counts) < 0:
                raise ValueError(f'{path}:{line}: probe and mutant counts must be nonnegative integers')
            claims[name] = ClaimSummary(domain, *counts, runtime == 'slow')
    return claims


if __name__ == '__main__':
    sys.exit(main())
