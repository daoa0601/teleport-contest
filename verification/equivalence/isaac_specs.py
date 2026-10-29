"""ISAAC64 source pairs and relational loop invariants.

Correspondence: 256 initialized uint64 words in each of m/r, equal a/b/c,
and equal available-word counts (0..256 for next). Seed bytes are unsigned
bytes; the C length equals the JS length, is nonnegative, and fits int.
Sources: isaac64.h's context/seed contract and isaac64.c's loop bounds.

The reseed proof deliberately starts with unrelated m and n: its first pass
overwrites m before reading it, and update overwrites n. This makes the init
proof valid even though C does not initialize these fields before reseeding.
"""
from __future__ import annotations

import copy
import time
from dataclasses import dataclass

import z3

from bv import (Counterexample, Integer, Memory, Obligations, WORD_MAX,
                c_convert, fresh, integer, js_binary, predicate)
from cfront import CFront
from core import Unsupported
from isaac_c import CIsaac
from isaac_js import JSIsaac

NAMES = ('lower_bits', 'upper_bits', 'isaac64_mix', 'isaac64_update',
         'isaac64_reseed', 'isaac64_init', 'isaac64_next_uint64')


def same_integer(a, b):
    return predicate('==', a, b)


def canonical(memory):
    index = z3.BitVec('projection_index', 64)
    return z3.Lambda(index, z3.If(z3.ULT(index, memory.length),
                                z3.Select(memory.term, index), z3.BitVecVal(0, memory.bits)))


def same_memory(a, b, end=None):
    if a.length != b.length or a.bits != b.bits:
        return z3.BoolVal(False)
    # This free witness is universally checked by the refutation query.
    index = fresh('observed_index', 0, a.length-1, 'num')
    bound = integer(a.length) if end is None else end
    return z3.Implies(z3.And(predicate('>=', index, integer(0)), predicate('<', index, bound)),
                      z3.Select(a.term, index.extend(64)) == z3.Select(b.term, index.extend(64)))


class Summaries:
    """Only proved callees may be replaced by these shared functions.

    The functions overapproximate the callee's deterministic results. Their
    arguments include every read-before-write input. Projection removes the
    nonexistent cells outside a C/JS array's domain.
    """
    def __init__(self, proved):
        self.proved = proved

    def for_executor(self):
        return {name: (lambda executor, args, name=name: self.apply(name, executor, args))
                for name in ('isaac64_mix', 'isaac64_update', 'isaac64_reseed') if name in self.proved}

    def apply(self, name, executor, args):
        checks = executor.checks
        kind = 'c' if isinstance(executor, CIsaac) else 'big'
        if name == 'isaac64_mix':
            array = args[0]
            checks.require(z3.BoolVal(array.length == 8 and array.bits == 64), 'mix array contract')
            self.initialized(array, checks)
            fn = z3.Function('proved_mix', array.term.sort(), array.term.sort())
            array.term = fn(canonical(array))
            return None
        ctx = args[0]
        fields = ('r',) if name == 'isaac64_reseed' else ('m', 'r')
        for key in fields:
            self.initialized(ctx[key], checks)
        inputs = [canonical(ctx[key]) for key in fields]
        inputs += [ctx[key].extend(64) for key in ('a', 'b', 'c')]
        if name == 'isaac64_reseed':
            seed = args[1]
            length = args[2] if kind == 'c' else seed.logical_length
            if length is None:
                length = integer(seed.length)
            checks.require(z3.And(predicate('>=', length, integer(0)),
                                  predicate('<=', length, integer(2**31-1))), 'seed length contract')
            checks.require(z3.Or(predicate('<=', length, integer(seed.length)), z3.BoolVal(seed.length >= 2048)),
                           'seed allocation contains the bytes read')
            inputs += [canonical(seed), length.extend(32)]
        sorts = [term.sort() for term in inputs]
        for key in ('m', 'r', 'a', 'b', 'c'):
            old = ctx[key]
            sort = old.term.sort() if isinstance(old, Memory) else z3.BitVecSort(64)
            term = z3.Function('proved_' + name + '_' + key, *sorts, sort)(*inputs)
            if isinstance(old, Memory):
                checks.require(z3.BoolVal(old.length == 256 and old.bits == 64), 'context array contract')
                old.term = term
                old.initialized = None
            else:
                value = Integer(z3.ZeroExt(1, term), 0, WORD_MAX, kind)
                ctx[key] = c_convert(value, (64, False)) if kind == 'c' else value
        ctx['n'] = c_convert(integer(256), (32, False)) if kind == 'c' else integer(256)
        return None

    @staticmethod
    def initialized(array, checks):
        if array.initialized is not None:
            index = z3.BitVec('initialized_index', 64)
            checks.require(z3.Implies(z3.ULT(index, array.length), z3.Select(array.initialized, index)),
                           'callee reads initialized array')


@dataclass(frozen=True)
class Plan:
    start: int
    stop: object
    step: int
    locals: tuple = ()
    context: tuple = ('a', 'b', 'c', 'n', 'm', 'r')
    prefix_m: bool = False


class Pair:
    def __init__(self, front, source, name, proved, case=0, probe=False):
        self.checks = Obligations()
        summaries = Summaries(proved).for_executor()
        self.c = CIsaac(front, self.checks, summaries)
        self.j = JSIsaac(source, self.checks, summaries)
        self.name, self.case = name, case
        self.ctx_c = self.ctx_j = None
        self.seed_length = None
        self.args_c, self.args_j = self.inputs(probe)
        self.loop_number = 0

    def inputs(self, probe):
        if self.name in ('lower_bits', 'upper_bits'):
            word = fresh('input_word', 0, WORD_MAX)
            if probe:
                self.checks.pre.append(same_integer(word, integer(0)))
            js = Integer(word.bits, word.lo, word.hi, 'num' if probe else 'big')
            return [c_convert(word, (64, False))], [js]
        if self.name == 'isaac64_mix':
            c = Memory.symbolic('input_mix', 7 if probe else 8, kind='c')
            j = Memory(c.term, c.length, 64, 'big')
            self.mix_c, self.mix_j = c, j
            return [c], [j]
        c, j = {}, {}
        for key in ('m', 'r'):
            c[key] = Memory.symbolic('input_' + key, 255 if probe and key == 'm' else 256, kind='c')
            j[key] = Memory(c[key].term, c[key].length, 64, 'big')
        if self.name == 'isaac64_reseed':
            j['m'].term = z3.Array('unrelated_initial_m', z3.BitVecSort(64), z3.BitVecSort(64))
            c['m'].initialized = z3.K(z3.BitVecSort(64), z3.BoolVal(False))
        for key in ('a', 'b', 'c', 'n'):
            bits = 32 if key == 'n' else 64
            value = fresh('input_' + key, 0, 2**bits-1, 'num' if key == 'n' else 'big')
            c[key] = c_convert(value, (bits, False))
            j[key] = value
        if self.name in ('isaac64_update', 'isaac64_reseed'):
            c['n'] = None
            j['n'] = fresh('unrelated_initial_n', 0, 2**32-1, 'num')
        if self.name == 'isaac64_init':
            for key in ('a', 'b', 'c', 'n'):
                c[key] = None
            for key in ('m', 'r'):
                c[key].initialized = z3.K(z3.BitVecSort(64), z3.BoolVal(False))
        if self.name == 'isaac64_next_uint64':
            n = fresh('available', 0, 2**32-1, 'num')
            c['n'], j['n'] = c_convert(n, (32, False)), n
            if probe:
                self.checks.pre.append(same_integer(n, integer(257)))
            elif self.case == 0:
                self.checks.pre.append(same_integer(n, integer(0)))
            else:
                self.checks.pre += [predicate('>=', n, integer(1)), predicate('<=', n, integer(256))]
        self.ctx_c, self.ctx_j = c, j
        if self.name in ('isaac64_reseed', 'isaac64_init'):
            q = fresh('seed_words', 0, 256, 'num')
            residue = self.case
            if residue == 8:
                length = fresh('seed_length', 2049, 2**31-1, 'num')
                self.checks.pre += [predicate('>=', length, integer(2049)), predicate('<=', length, integer(2**31-1))]
            else:
                length = js_binary('+', js_binary('*', q, integer(8), self.checks), integer(residue), self.checks)
                self.checks.pre += [predicate('>=', q, integer(0)), predicate('<=', length, integer(2048))]
            self.seed_length = length
            seed = Memory.symbolic('seed_bytes', 0 if probe else 2048, 8, 'c')
            seed.logical_length = length
            js_seed = Memory(seed.term, seed.length, 8, 'num', length)
            if probe:
                self.checks.pre.append(same_integer(length, integer(8 + residue)))
            if self.name == 'isaac64_init':
                return [c, seed, c_convert(length, (32, True))], [js_seed]
            return [c, seed, c_convert(length, (32, True))], [j, js_seed]
        return [c], [j]

    def plans(self):
        if self.name == 'isaac64_mix':
            return []
        if self.name == 'isaac64_update':
            return [Plan(lo, integer(hi), 4, (('a', 'a'), ('b', 'b')), ('a', 'b', 'c', 'm', 'r'))
                    for lo, hi in ((0, 128), (128, 256))]
        if self.name == 'isaac64_reseed':
            cap = integer(2048) if self.case == 8 else self.seed_length
            words = js_binary('>>', cap, integer(3), self.checks)
            base = ('a', 'b', 'c', 'r')
            return [Plan(0, words, 1, (), base),
                    Plan(0, integer(4), 1, (('x', 'x'),), base),
                    Plan(0, integer(256), 8, (('x', 'x'),), base, True),
                    Plan(0, integer(256), 8, (('x', 'x'),), base + ('m',))]
        return []

    def relations(self, plan, c_loop, j_loop):
        pairs = [(self.c.env[c_loop.counter], self.j.env[j_loop.counter], 'counter')]
        pairs += [(self.c.env[c], self.j.env[j], c) for c, j in plan.locals]
        if self.ctx_c is not None:
            pairs += [(self.ctx_c[key], self.ctx_j[key], 'ctx.' + key) for key in plan.context]
            if plan.prefix_m:
                pairs.append((self.ctx_c['m'], self.ctx_j['m'], 'prefix_m'))
        return pairs

    def relation(self, plan, c_loop, j_loop):
        for a, b, label in self.relations(plan, c_loop, j_loop):
            cond = same_memory(a, b, self.c.env[c_loop.counter] if label == 'prefix_m' else None) \
                if isinstance(a, Memory) else same_integer(a, b)
            observed = [] if isinstance(a, Memory) else [('C_value', a.bits), ('JS_value', b.bits)]
            self.checks.require(cond, self.name + ' loop relation: ' + label, observed)
            if isinstance(a, Memory) and a.initialized is not None:
                if label == 'prefix_m':
                    index = z3.BitVec('initialized_prefix_index', 64)
                    end = self.c.env[c_loop.counter].extend(64)
                    self.checks.require(z3.Implies(z3.ULT(index, end), z3.Select(a.initialized, index)),
                                        'written m prefix is initialized')
                else:
                    Summaries.initialized(a, self.checks)

    def invariant(self, plan, loop, executor):
        counter = executor.env[loop.counter]
        diff = js_binary('-', Integer(counter.bits, plan.start, 256, 'num', counter.signed),
                         integer(plan.start), self.checks)
        return z3.And(predicate('>=', counter, integer(plan.start)),
                      predicate('<=', counter, plan.stop),
                      z3.URem(diff.extend(64), z3.BitVecVal(plan.step, 64)) == 0)

    def havoc(self, plan, c_loop, j_loop, phase):
        for a, b, label in self.relations(plan, c_loop, j_loop):
            if isinstance(a, Memory):
                if label == 'prefix_m':
                    # Only the already-written prefix corresponds. Preserve
                    # independent suffixes, rather than assuming the result.
                    common = z3.Array(f'{phase}_prefix', z3.BitVecSort(64), z3.BitVecSort(64))
                    index = z3.BitVec('prefix_index', 64)
                    end = self.c.env[c_loop.counter].extend(64)
                    a.term = z3.Lambda(index, z3.If(z3.ULT(index, end), z3.Select(common, index), z3.Select(a.term, index)))
                    b.term = z3.Lambda(index, z3.If(z3.ULT(index, end), z3.Select(common, index), z3.Select(b.term, index)))
                    for memory in (a, b):
                        if memory.initialized is not None:
                            memory.initialized = z3.Lambda(index, z3.Or(z3.ULT(index, end),
                                                                      z3.Select(memory.initialized, index)))
                else:
                    term = z3.Array(f'{phase}_{label}', z3.BitVecSort(64), z3.BitVecSort(a.bits))
                    a.term = b.term = term
                    for memory in (a, b):
                        if memory.initialized is not None:
                            Summaries.initialized(memory, self.checks)
                            memory.initialized = None
        for c_name, j_name in plan.locals:
            if isinstance(self.c.env[c_name], Integer):
                value = fresh(f'{phase}_{c_name}', 0, WORD_MAX)
                self.c.env[c_name] = c_convert(value, (64, False))
                self.j.env[j_name] = value

    def loop(self, plan, c_loop, j_loop):
        self.relation(plan, c_loop, j_loop)
        for executor, loop in ((self.c, c_loop), (self.j, j_loop)):
            self.checks.require(same_integer(executor.env[loop.counter], integer(plan.start)), 'loop starts at declared bound')
            self.checks.require(self.invariant(plan, loop, executor), 'loop invariant on entry')
        saved_c, saved_j, saved_pre = copy.deepcopy(self.c.env), copy.deepcopy(self.j.env), list(self.checks.pre)
        saved_ctx_c, saved_ctx_j = self.ctx_c, self.ctx_j
        # One arbitrary iteration proves preservation for all counter values,
        # including both 128-word halves of the fixed 256-word update.
        counter = fresh(f'loop_{self.loop_number}_index', plan.start, 256, 'num')
        self.c.env[c_loop.counter] = c_convert(counter, (32, True))
        self.j.env[j_loop.counter] = counter
        self.havoc(plan, c_loop, j_loop, f'head_{self.loop_number}')
        self.checks.pre += [self.invariant(plan, c_loop, self.c),
                            self.c.truth(self.c.eval(c_loop.condition))]
        c_guard = self.c.truth(self.c.eval(c_loop.condition))
        j_guard = self.j.truth(self.j.eval(j_loop.condition))
        self.checks.require(c_guard == j_guard, 'loop guards agree')
        old = self.c.env[c_loop.counter]
        if self.checks.solve(z3.BoolVal(True))[0] != z3.sat:
            raise Unsupported('induction step is unreachable')
        c_scratch = ('x', 'y') if self.name == 'isaac64_update' else ('j',) if self.name == 'isaac64_reseed' else ()
        for name in c_scratch:
            self.c.env[name] = None
        c_frame = self.frame(self.c.env)
        j_frame = self.frame(self.j.env)
        self.c.step(c_loop)
        self.j.step(j_loop)
        self.check_frame(self.c, c_frame, c_loop.counter, [a for a, _ in plan.locals], c_scratch, plan)
        self.check_frame(self.j, j_frame, j_loop.counter, [b for _, b in plan.locals], (), plan)
        self.relation(plan, c_loop, j_loop)
        for executor, loop in ((self.c, c_loop), (self.j, j_loop)):
            self.checks.require(self.invariant(plan, loop, executor), 'loop invariant preserved')
        self.checks.require(predicate('>', self.c.env[c_loop.counter], old), 'loop variant decreases')
        # Restore the entry state, then expose an arbitrary corresponding exit
        # satisfying the invariant and negated guard. No final values are
        # copied from the single symbolic iteration.
        self.c.env, self.j.env = saved_c, saved_j
        if saved_ctx_c is not None:
            self.ctx_c = self.c.env.get('_ctx', saved_ctx_c)
            self.ctx_j = self.j.env.get('ctx', self.j.env.get('_ctx', saved_ctx_j))
        self.checks.pre = saved_pre
        counter = fresh(f'exit_{self.loop_number}_index', plan.start, 256, 'num')
        self.c.env[c_loop.counter] = c_convert(counter, (32, True))
        self.j.env[j_loop.counter] = counter
        self.havoc(plan, c_loop, j_loop, f'exit_{self.loop_number}')
        self.checks.pre += [self.invariant(plan, c_loop, self.c),
                            z3.Not(self.c.truth(self.c.eval(c_loop.condition)))]
        self.checks.require(z3.Not(self.j.truth(self.j.eval(j_loop.condition))), 'loop exits agree')
        self.loop_number += 1

    @staticmethod
    def frame(env, prefix=''):
        result = {}
        for name, value in env.items():
            path = prefix + name
            if isinstance(value, dict):
                result.update(Pair.frame(value, path + '.'))
            elif isinstance(value, Memory):
                result[path] = (value, value.term)
            else:
                result[path] = value
        return result

    def check_frame(self, executor, before, counter, locals, scratch, plan):
        after = self.frame(executor.env)
        tracked = {counter, *locals, *scratch}
        tracked.update(('_ctx.' if executor is self.c else 'ctx.') + key for key in plan.context
                       if key in ('m', 'r'))
        if plan.prefix_m:
            tracked.add('_ctx.m' if executor is self.c else 'ctx.m')
        writable = {id(before[path][0]) for path in tracked if path in before and isinstance(before[path], tuple)}
        for path, old in before.items():
            if path in tracked:
                continue
            value = after[path]
            if isinstance(old, tuple):
                memory, term = old
                if value[0] is not memory:
                    raise Unsupported('loop changes an unmodeled array alias: ' + path)
                if id(memory) not in writable:
                    self.checks.require(term == value[1], 'loop preserves array: ' + path)
            elif isinstance(old, Integer):
                self.checks.require(same_integer(old, value), 'loop preserves local: ' + path)
            elif old is not value:
                raise Unsupported('loop changes an unmodeled local: ' + path)

    def run(self):
        c_run, j_run = self.c.function(self.name, self.args_c), self.j.function(self.name, self.args_j)
        plans = self.plans()
        for plan in plans:
            c_loop, j_loop = next(c_run), next(j_run)
            self.loop(plan, c_loop, j_loop)
        for run in (c_run, j_run):
            if next(run, None) is not None:
                raise Unsupported('unannotated outer ISAAC64 loop')
        if self.name == 'isaac64_mix':
            self.checks.require(same_memory(self.mix_c, self.mix_j), 'mix output array')
        elif self.name in ('lower_bits', 'upper_bits', 'isaac64_next_uint64'):
            self.checks.require(same_integer(self.c.returned, self.j.returned), 'returned value')
        if self.ctx_c is not None:
            c = self.c.env['_ctx']
            j = self.j.returned if self.name == 'isaac64_init' else self.j.env.get('ctx', self.j.env.get('_ctx'))
            for key in ('m', 'r', 'a', 'b', 'c', 'n'):
                cond = same_memory(c[key], j[key]) if isinstance(c[key], Memory) else same_integer(c[key], j[key])
                self.checks.require(cond, 'returned context: ' + key)
            if self.name != 'isaac64_next_uint64':
                self.checks.require(same_integer(c['n'], integer(256)), 'callee available-word postcondition')
        if self.checks.solve(z3.BoolVal(True))[0] != z3.sat:
            raise Unsupported('empty final domain')
        return self.checks.count


def check(front, source, name, proved, probe=False):
    cases = range(9) if name in ('isaac64_init', 'isaac64_reseed') else \
        range(2) if name == 'isaac64_next_uint64' else range(1)
    count = 0
    for case in cases:
        pair = Pair(front, source, name, proved, case, probe)
        count += pair.run()
    return count


MUTANTS = {
    'lower_bits': (b'x >> 3n', b'x >> 4n'),
    'upper_bits': (b'y >> 11n', b'y >> 10n'),
    'isaac64_mix': (b'[9n, 9n,', b'[8n, 9n,'),
    'isaac64_update': (b'wordAt(m, i + SZ / 2)', b'wordAt(m, i + SZ / 2 - 1)'),
    'isaac64_reseed': (b'0x9e3779b97f4a7c13n', b'0x9e3779b97f4a7c12n'),
    'isaac64_init': (b'return ctx;', b'ctx.n--; return ctx;'),
    'isaac64_next_uint64': (b'wordAt(_ctx.r, --_ctx.n)', b'wordAt(_ctx.r, _ctx.n--)'),
}


def run(recorder, repo, only=None, probes=True, mutants=True):
    selected = [n for n in NAMES if not only or n in only or 'isaac64' in only]
    if not selected:
        return 0
    front = CFront(recorder, [recorder / 'src' / 'isaac64.c'])
    source = (repo / 'js' / 'isaac64.js').read_bytes()
    proved, failures = set(), 0
    for name in NAMES:
        # Dependencies are proved even when --only selects a composed claim.
        start = time.monotonic()
        try:
            count = check(front, source, name, proved)
            print(f'PROVED  {name:<22} {time.monotonic()-start:6.1f}s  {count} obligations', flush=True)
            proved.add(name)
        except (Counterexample, Unsupported) as error:
            print(f'FAILED  {name}: {error}', flush=True)
            return failures + 1
        if name not in selected:
            continue
        if probes:
            try:
                check(front, source, name, proved - {name}, probe=True)
                print('  SURVIVED domain probe', flush=True)
                failures += 1
            except Counterexample as error:
                print(f'  counterexample outside domain: {error}', flush=True)
            except Unsupported as error:
                print(f'  FAILED domain probe (no counterexample): {error}', flush=True)
                failures += 1
        if mutants:
            changes = [MUTANTS[name]]
            if name == 'isaac64_update':
                changes += [(b'0xffffffffffffffffn', b'0x7fffffffffffffffn'),
                            (b'a << 21n', b'a << 20n')]
            for old, new in changes:
                if old not in source:
                    print(f'  FAILED absent mutant target {old!r}', flush=True)
                    failures += 1
                    continue
                mutated = source.replace(old, new, 1)
                try:
                    check(front, mutated, name, proved - {name})
                    print(f'  SURVIVED mutant {old!r} -> {new!r}', flush=True)
                    failures += 1
                except Counterexample as error:
                    print(f'  killed mutant {old!r} -> {new!r}: {error}', flush=True)
                except Unsupported as error:
                    print(f'  FAILED mutant (no counterexample): {error}', flush=True)
                    failures += 1
    return failures
