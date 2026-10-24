"""Check every rng.ts call site against the domain proved by prove.py.

    node verification/callsites/extract.mjs > .cache/rng-callsites.json
    cd verification/equivalence && uv run ../callsites/check.py ../../.cache/rng-callsites.json

Each site is classified:
  constant   the argument alone is inside the domain;
  guarded    inside the domain given the conditions that dominate the call,
             plus return bounds of called helpers and argument bounds from
             every direct caller of a non-escaping function (sound unless a
             guarded value changes between the guard and the call; leaves are
             matched by source text);
  invariant  inside the domain only given the game invariants in INVARIANTS
             and ROOM_FIELDS (C ranges such as MAXULEV, never established
             here) or in-bounds reads of readonly data tables;
  unproved   a counterexample exists; the leaves it assigns are printed.

Leaves are integers. A bare division that is not under Math.floor, trunc, ceil,
or round may produce a fraction, which reaches BigInt() and throws in
JavaScript while C truncates; such sites are unproved.
"""
from __future__ import annotations

import json
import re
import sys
from collections import Counter

import z3

INT_MAX = 2 ** 31 - 1


# (leaf text pattern, minimum, maximum or None, C source of the range)
INVARIANTS = [
    (r'^currentAttribute\(', 3, 125, 'attrib.h ATTRMIN..ATTRMAX (STR encodes 18/xx up to 125)'),
    (r'(^|\.|\?\.)ulevel$', 1, 30, 'global.h MAXULEV; you.h "1 to MAXULEV"'),
    (r'^level_difficulty\(\)$', 1, None, 'dungeon.c level_difficulty(): a depth >= 1, or more'),
    (r'(^|\.|\?\.)m_lev$', 0, 49, 'monst.c levels; grow_up() caps at 49'),
    (r'(^|\.)(attack|gaze|mattk)\[[23]\]$|(^|\.)dam[nd]$', 0, 255, 'monst.c attack dice are uchar'),
    (r'(^|\.|\?\.)nroom$', 0, 40, 'mkroom.h MAXNROFROOMS; nroom counts live rooms'),
]

# struct mkroom bounds of a live room: lx <= hx and ly <= hy inside the map
# (rooms are built by create_room()/add_room() from lowx <= hix; COLNO 80,
# ROWNO 21). The sentinel room after the last live one has hx == -1, so these
# facts cover only rooms reached through an index below nroom. They apply to
# fields whose owner has the TypeScript type Room (the sentinel is typed
# RoomSentinel); other Rectangles, such as Lua exclusion areas, get none.
ROOM_FIELDS = {'lx': ('x', 0, 79), 'hx': ('x', 0, 79), 'ly': ('y', 0, 20), 'hy': ('y', 0, 20)}


class Fraction(Exception):
    pass


def floor_div(a, b):
    return z3.If(b > 0, a / b, (-a) / (-b))      # Z3 Int division is floor for b > 0


def trunc_div(a, b):
    q = z3.If(a >= 0, a, -a) / z3.If(b >= 0, b, -b)
    return z3.If((a >= 0) == (b >= 0), q, -q)


class Translator:
    """Terms of one site or one summary, with their own leaf namespace."""

    def __init__(self, bounds, invariants=False):
        self.bounds = bounds
        self.invariants = invariants
        self.leaves = {}
        self.facts = []
        self.rooms = {}

    def room_fact(self, t, v):
        match = re.match(r'^(.*)\.(lx|hx|ly|hy)$', t['text'])
        if not match or t.get('owner') != 'Room':
            return
        prefix, field = match.groups()
        _, low, high = ROOM_FIELDS[field]
        self.facts.append(z3.And(v >= low, v <= high))
        fields = self.rooms.setdefault(prefix, {})
        fields[field] = v
        for lo, hi in (('lx', 'hx'), ('ly', 'hy')):
            if field in (lo, hi) and lo in fields and hi in fields:
                self.facts.append(fields[lo] <= fields[hi])

    def leaf(self, t):
        key = t['text']
        if key in self.leaves:
            return self.leaves[key]
        v = z3.Int(key)
        self.leaves[key] = v
        if self.invariants:
            self.room_fact(t, v)
            for pattern, low, high, _ in INVARIANTS:
                if re.search(pattern, key):
                    self.facts.append(v >= low)
                    if high is not None:
                        self.facts.append(v <= high)
        for fact in t.get('facts', []) if self.invariants or not t.get('data') else []:
            if fact[0] == 'nonneg':
                self.facts.append(v >= 0)
            elif fact[0] == 'range':
                self.facts.append(z3.And(v >= fact[1], v <= fact[2]))
        if t.get('draw'):
            try:
                self.facts.extend(result_range(t['draw'], v, [self.num(a) for a in t['args']]))
            except Fraction:
                pass
        if 'fn' in t:
            low = self.bounds.returns_at_least(t['fn'])
            if low is not None:
                self.facts.append(v >= low)
        if 'param' in t:
            low = self.bounds.param_at_least(t['param']['fn'], t['param']['index'])
            if low is not None:
                self.facts.append(v >= low)
        return v

    def num(self, t):
        if 'undefined' in t:
            raise Fraction('undefined')
        if 'num' in t:
            if t['num'] != int(t['num']):
                raise Fraction('fractional literal')
            return z3.IntVal(int(t['num']))
        if 'leaf' in t:
            return self.leaf(t)
        if 'ite' in t:
            c, a, b = t['ite']
            return z3.If(self.boolean(c), self.num(a), self.num(b))
        op, raw = t['op'], t['args']
        if op in ('Math.floor', 'Math.trunc', 'Math.ceil', 'Math.round') and 'op' in raw[0] and raw[0]['op'] == '/':
            a, b = (self.num(x) for x in raw[0]['args'])
            self.facts.append(b != 0)
            if op == 'Math.floor':
                return floor_div(a, b)
            if op == 'Math.trunc':
                return trunc_div(a, b)
            if op == 'Math.ceil':
                return -floor_div(-a, b)
            return floor_div(2 * a + b, 2 * b)     # Math.round: floor(a / b + 1/2)
        args = [self.num(a) for a in raw]
        if op == '+':
            return args[0] + args[1]
        if op == '-':
            return args[0] - args[1]
        if op == '*':
            return args[0] * args[1]
        if op == '/':
            a, b = (z3.simplify(x) for x in args)
            if z3.is_int_value(a) and z3.is_int_value(b) and b.as_long() and a.as_long() % b.as_long() == 0:
                return z3.IntVal(a.as_long() // b.as_long())
            raise Fraction('division')
        if op == '%':
            self.facts.append(args[1] != 0)
            return args[0] - args[1] * trunc_div(args[0], args[1])
        if op in ('Math.floor', 'Math.trunc', 'Math.ceil', 'Math.round'):
            return args[0]
        if op == 'Math.max':
            r = args[0]
            for a in args[1:]:
                r = z3.If(a > r, a, r)
            return r
        if op == 'Math.min':
            r = args[0]
            for a in args[1:]:
                r = z3.If(a < r, a, r)
            return r
        if op == 'Math.abs':
            return z3.If(args[0] < 0, -args[0], args[0])
        if op == 'Math.sign':
            return z3.If(args[0] > 0, 1, z3.If(args[0] < 0, -1, 0))
        raise ValueError(op)

    def boolean(self, t):
        if 'not' in t:
            return z3.Not(self.boolean(t['not']))
        if 'and' in t:
            return z3.And([self.boolean(x) for x in t['and']])
        if 'or' in t:
            return z3.Or([self.boolean(x) for x in t['or']])
        if 'bool' in t:
            return z3.Bool(t['bool'])
        try:
            a, b = (self.num(x) for x in t['args'])
        except Fraction:
            return z3.FreshBool()
        return {'<': a < b, '<=': a <= b, '>': a > b, '>=': a >= b, '==': a == b, '!=': a != b}[t['cmp']]


def implies(bounds, term, guards, low):
    """Whether term >= low whenever guards hold."""
    tr = Translator(bounds)
    try:
        v = tr.num(term)
    except Fraction:
        return False
    gs = []
    for g in guards:
        gs.append(tr.boolean(g))
    s = z3.Solver()
    s.set('timeout', 3000)
    s.add(*tr.facts, *gs, v < low)
    return s.check() == z3.unsat


class Bounds:
    """Lower bounds (1 or 0) of helper results and parameters, from summaries."""

    def __init__(self, summaries):
        self.summaries = summaries
        self.memo = {}

    def _best(self, key, prove):
        if key in self.memo:
            return self.memo[key]
        self.memo[key] = None           # recursion: assume nothing
        for low in (1, 0):
            if prove(low):
                self.memo[key] = low
                return low
        return None

    def returns_at_least(self, fn):
        summary = self.summaries.get(fn)
        if not summary:
            return None
        return self._best(('ret', fn), lambda low: all(
            'undefined' not in r and implies(self, r['term'], r['guards'], low) for r in summary['returns']))

    def param_at_least(self, fn, index):
        summary = self.summaries.get(fn)
        if not summary or not summary['callers']:
            return None
        return self._best(('param', fn, index), lambda low: all(
            implies(self, c['args'][index], c['guards'], low) for c in summary['callers']))


def result_range(draw, v, args):
    """What the caller may assume about a draw's result once its own domain holds."""
    if draw in ('rn2', 'rnl', 'rn2Display'):
        return [v >= 0, v <= args[0] - 1]
    if draw == 'rnd':
        return [v >= 1, v <= args[0]]
    if draw == 'rn1':
        return [v >= args[1], v <= args[1] + args[0] - 1]
    if draw == 'd':
        return [v >= args[0], v <= args[0] * args[1]]
    if draw == 'rne':
        return [v >= 1, v <= 10]
    return []


def domain(draw, args, part):
    """part 'lower': the lower bounds whose violation makes C and JavaScript
    consume different draws. part 'upper': overflow bounds that only absurdly
    large arguments violate."""
    if draw in ('rn2', 'rnd', 'rnl', 'rne', 'rn2Display'):
        return [args[0] >= 1] if part == 'lower' else [args[0] <= INT_MAX - 256]
    if draw == 'rn1':
        return [args[0] >= 1] if part == 'lower' else [args[0] + args[1] - 1 <= INT_MAX]
    if draw == 'd':
        n, x = args
        return [n >= 0, z3.Or(x >= 1, n == 0)] if part == 'lower' else [n * x <= INT_MAX]
    if draw == 'rnz':
        return [] if part == 'lower' else [args[0] >= -10 ** 8, args[0] <= 10 ** 8]
    raise ValueError(draw)


def classify(site, part, bounds):
    if len(site['terms']) != {'d': 2, 'rn1': 2}.get(site['draw'], 1):
        return 'unproved', 'unexpected argument count'
    for mode in ('constant', 'guarded', 'invariant'):
        use_guards = mode != 'constant'
        tr = Translator(bounds if use_guards else Bounds({}), invariants=mode == 'invariant')
        try:
            args = [tr.num(t) for t in site['terms']]
        except Fraction as why:
            return 'unproved', f'possible non-integer ({why})'
        guards = [tr.boolean(g) for g in site['guards']] if use_guards else []
        s = z3.Solver()
        s.set('timeout', 5000)
        s.add(*tr.facts, *guards, z3.Not(z3.And(domain(site['draw'], args, part))))
        result = s.check()
        if result == z3.unsat:
            return mode, ''
    if result == z3.unknown:
        return 'unproved', 'solver gave up'
    model = s.model()
    shown = [f'{name}={model.eval(v, model_completion=True)}' for name, v in tr.leaves.items()]
    return 'unproved', ', '.join(shown) or 'no leaves'


def main():
    data = json.load(open(sys.argv[1]))
    sites, bounds = data['sites'], Bounds(data['summaries'])
    for part in ('lower', 'upper'):
        counts, unproved = Counter(), []
        for site in sites:
            kind, why = classify(site, part, bounds)
            counts[kind] += 1
            if kind == 'unproved':
                unproved.append((site, why))
        print(f'[{part}] {len(sites)} call sites: ' + ', '.join(f'{k} {v}' for k, v in counts.most_common()),
              flush=True)
        if part == 'upper':
            break
        for site, why in sorted(unproved, key=lambda x: (x[0]['file'], x[0]['line'])):
            call = f"{site['callee']}({', '.join(site['args'])})"
            print(f"{site['file']}:{site['line']}\t{site['fn']}\t{site['draw']}\t{call}\t{why}", flush=True)


if __name__ == '__main__':
    main()
