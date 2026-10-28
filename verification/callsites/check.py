"""Check every rng.ts call site against the domain proved by prove.py.

    node verification/callsites/extract.mjs > .cache/rng-callsites.json
    cd verification/equivalence && uv run ../callsites/check.py ../../.cache/rng-callsites.json

Each site is classified:
  constant   the argument alone is inside the domain;
  guarded    inside the domain given the conditions that dominate the call,
             plus return bounds of called helpers and argument bounds from
             every direct caller of a non-escaping function, or a scalar
             initializer and every write preserving a lower bound;
  invariant  inside the domain only given the game invariants in INVARIANTS
             and ROOM_FIELDS (C ranges such as MAXULEV, never established
             here) or in-bounds reads of readonly data tables;
  unproved   a counterexample exists; the leaves it assigns are printed.

Leaves are integers. A bare division that is not under Math.floor, trunc, ceil,
or round may produce a fraction, which reaches BigInt() and throws in
JavaScript while C truncates; such sites are unproved.
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import time
from collections import Counter
from pathlib import Path

import z3

INT_MAX = 2 ** 31 - 1
CLASSES = ('constant', 'guarded', 'invariant', 'unproved')
LEDGER_COLUMNS = ('file', 'function', 'callee', 'arguments', 'class')


# (leaf text pattern, minimum, maximum or None, C source of the range)
INVARIANTS = [
    (r'^currentAttribute\(', 3, 125, 'attrib.h ATTRMIN..ATTRMAX (STR encodes 18/xx up to 125)'),
    (r'(^|\.|\?\.)ulevel$', 1, 30, 'global.h MAXULEV; you.h "1 to MAXULEV"'),
    (r'^level_difficulty\(\)$', 1, None, 'dungeon.c level_difficulty(): a depth >= 1, or more'),
    (r'(^|\.|\?\.)m_lev$', 0, 255, 'monst.h:104 m_lev; clang resolves uchar to unsigned char (8 bits)'),
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

    def __init__(self, bounds, invariants=False, local_self=None):
        self.bounds = bounds
        self.invariants = invariants
        self.leaves = {}
        self.facts = []
        self.rooms = {}
        self.obligations = []
        self.local_self = local_self

    def room_fact(self, t, v):
        match = re.match(r'^(.*)\.(lx|hx|ly|hy)$', t['text'])
        if not match or t.get('owner') != 'Room':
            return
        _, field = match.groups()
        # Shadowed room bindings and stale reads must not acquire relations
        # merely because their field expressions have the same spelling.
        identity = t.get('key', t['text'])
        owner, _, epoch = identity.rpartition('.' + field)
        prefix = owner + epoch
        _, low, high = ROOM_FIELDS[field]
        self.facts.append(z3.And(v >= low, v <= high))
        fields = self.rooms.setdefault(prefix, {})
        fields[field] = v
        for lo, hi in (('lx', 'hx'), ('ly', 'hy')):
            if field in (lo, hi) and lo in fields and hi in fields:
                self.facts.append(fields[lo] <= fields[hi])

    def leaf(self, t):
        if self.local_self and t.get('local') == self.local_self[0]:
            return self.local_self[1]
        key = t.get('key', t['text'])
        if key in self.leaves:
            return self.leaves[key]
        v = z3.Int(key)
        self.leaves[key] = v
        if self.invariants:
            self.room_fact(t, v)
            if t.get('attribute') in (1, 2, 3, 4, 5):
                # attrib.c:acurr(): every non-Strength branch returns 3..25,
                # including equipment and form cases. Argument indices are
                # folded from the emitted imports; this is an assumed C/JS
                # state relation, not a proof of equipment initialization.
                self.facts.extend([v >= 3, v <= 25])
            for pattern, low, high, _ in INVARIANTS:
                if re.search(pattern, t['text']):
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
        if 'local' in t:
            low = self.bounds.local_at_least(t['local'], self.invariants)
            if low is not None:
                self.facts.append(v >= low)
        return v

    def num(self, t):
        if 'self' in t:
            if self.local_self is None:
                raise Fraction('unbound local update')
            return self.local_self[1]
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
            self.obligations.append(b != 0)
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
            self.obligations.append(args[1] != 0)
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


def implies(bounds, term, guards, low, invariants=False, local_self=None):
    """Whether term >= low whenever guards hold."""
    tr = Translator(bounds, invariants=invariants, local_self=local_self)
    try:
        v = tr.num(term)
    except Fraction:
        return False
    gs = []
    for g in guards:
        gs.append(tr.boolean(g))
    s = z3.Solver()
    s.set('timeout', 3000)
    s.add(*tr.facts, *gs)
    if local_self:
        s.add(local_self[1] >= low)
    if s.check() != z3.sat:
        return False
    s.add(z3.Not(z3.And(v >= low, *tr.obligations)))
    return s.check() == z3.unsat


class Bounds:
    """Lower bounds (1 or 0) of helper results and parameters, from summaries."""

    def __init__(self, summaries, locals=None):
        self.summaries = summaries
        self.memo = {}
        self.locals = locals or {}

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
        if not summary or not summary['returns']:
            return None
        return self._best(('ret', fn), lambda low: all(
            'undefined' not in r and implies(self, r['term'], r['guards'], low) for r in summary['returns']))

    def param_at_least(self, fn, index):
        summary = self.summaries.get(fn)
        if not summary or not summary['callers']:
            return None
        return self._best(('param', fn, index), lambda low: all(
            implies(self, c['args'][index], c['guards'], low) for c in summary['callers']))

    def local_at_least(self, key, invariants):
        """An inductive scalar bound: initializer establishes it and every
        syntactic write preserves it. Unsupported/destructuring writes reject
        the summary. No guard or source-text match supplies this fact."""
        local = self.locals.get(key)
        if not local:
            return None
        prior = z3.Int(f'prior:{key}')
        return self._best(('local', key, invariants), lambda low:
            implies(self, local['initial'], [], low, invariants)
            and all(implies(self, update, [], low, invariants, (key, prior))
                    for update in local['updates']))


def result_range(draw, v, args):
    """What the caller may assume about a draw's result once its own domain holds."""
    ranges = []
    if draw in ('rn2', 'rnl', 'rn2Display'):
        ranges = [v >= 0, v <= args[0] - 1]
    elif draw == 'rnd':
        ranges = [v >= 1, v <= args[0]]
    elif draw == 'rn1':
        ranges = [v >= args[1], v <= args[1] + args[0] - 1]
    elif draw == 'd':
        ranges = [v >= args[0], v <= args[0] * args[1]]
    elif draw == 'rne':
        ranges = [v >= 1, v <= 10]
    if not ranges:
        return []
    valid = z3.And(*domain(draw, args, 'lower'), *domain(draw, args, 'upper'))
    return [z3.Implies(valid, z3.And(*ranges))]


def domain(draw, args, part):
    """part 'lower': the lower bounds whose violation makes C and JavaScript
    consume different draws. part 'upper': overflow bounds reported separately."""
    if draw in ('rn2', 'rnd', 'rnl', 'rne', 'rn2Display'):
        return [args[0] >= 1] if part == 'lower' else [args[0] <= INT_MAX - 256]
    if draw == 'rn1':
        return [args[0] >= 1] if part == 'lower' else [args[0] + args[1] - 1 <= INT_MAX]
    if draw == 'd':
        n, x = args
        return [n >= 0, x >= 0, z3.Or(x >= 1, n == 0)] if part == 'lower' else [n * x <= INT_MAX]
    if draw == 'rnz':
        return [] if part == 'lower' else [args[0] >= -10 ** 8, args[0] <= 10 ** 8]
    raise ValueError(draw)


def classify(site, part, bounds):
    if len(site['terms']) != {'d': 2, 'rn1': 2}.get(site['draw'], 1):
        return 'unproved', 'unexpected argument count'
    result = z3.unsat
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
        s.add(*tr.facts, *guards)
        context = s.check()
        if context != z3.sat:
            result = context
            continue
        s.add(z3.Not(z3.And(*domain(site['draw'], args, part), *tr.obligations)))
        result = s.check()
        if result == z3.unsat:
            return mode, ''
    if result == z3.unknown:
        return 'unproved', 'solver gave up'
    if result == z3.unsat:
        return 'unproved', 'no feasible modeled input (not counted as a proof)'
    model = s.model()
    shown = [f'{name}={model.eval(v, model_completion=True)}' for name, v in tr.leaves.items()]
    return 'unproved', ', '.join(shown) or 'no leaves'


def group(site, locals=None):
    """Triage labels only: no group supplies a fact to the solver."""
    labels, seen = list(site['args']), set()

    def origins(term):
        if isinstance(term, dict):
            if 'text' in term:
                labels.append(term['text'])
            key = term.get('local')
            if key and key not in seen and (locals or {}).get(key):
                seen.add(key)
                origins(locals[key])
            for name, value in term.items():
                if name != 'local':
                    origins(value)
        elif isinstance(term, list):
            for child in term:
                origins(child)

    origins(site['terms'])
    text = ' '.join(labels)
    if re.search(r'\.spe\b|\bcharges\b|enchantment', text):
        return 'spe charges'
    if re.search(r'\b(?:mhp|mhmax|mh|uhp|uhpmax|hp|hitPoints)\b', text):
        return 'hit points'
    if site['draw'] == 'd' or 'attack[' in text or 'gaze[' in text:
        return 'dice from data'
    if re.search(r'\.length\b|\.size\b', text):
        return 'possibly-empty collection'
    if re.search(r'count|total|weight|remaining|picks|matches|slots|parts|probability|prob|maximum', text, re.I):
        return 'count or weight'
    return 'other'


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input')
    parser.add_argument('--json', help='Write classifications and triage groups for review')
    parser.add_argument('--check-ledger', type=Path, help='reject weaker classes and new unproved sites')
    parser.add_argument('--write-ledger', type=Path, help='record the current classes for review')
    options = parser.parse_args()
    baseline = {}
    if options.check_ledger:
        try:
            baseline = read_ledger(options.check_ledger)
        except (OSError, ValueError) as error:
            parser.error(str(error))
    started = time.perf_counter()
    with open(options.input) as source:
        data = json.load(source)
    sites, bounds = data['sites'], Bounds(data['summaries'], data.get('locals'))
    report = []
    for part in ('lower', 'upper'):
        counts, unproved = Counter(), []
        for site in sites:
            kind, why = classify(site, part, bounds)
            if part == 'lower':
                report.append({**site, 'class': kind, 'group': group(site, data.get('locals')), 'reason': why})
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
    elapsed = time.perf_counter() - started
    print(f'[groups] {dict(Counter(row["group"] for row in report if row["class"] == "unproved"))}')
    print(f'[time] {elapsed:.2f}s', flush=True)
    if options.json:
        with open(options.json, 'w') as output:
            json.dump({'seconds': elapsed, 'sites': report}, output, indent=2)

    results = [(row, row['class'], row['reason']) for row in report]
    failures = check_ledger(baseline, results) if options.check_ledger else 0
    if failures == 0 and options.write_ledger:
        with options.write_ledger.open('w', newline='') as output:
            writer = csv.writer(output, delimiter='\t', lineterminator='\n')
            writer.writerow(LEDGER_COLUMNS)
            writer.writerows(sorted((*site_key(site), kind) for site, kind, _ in results))
    if options.check_ledger:
        print(f'call-site ledger: {failures} regression(s)', flush=True)
    return 1 if failures else 0


def site_key(site) -> tuple[str, str, str, str]:
    """Line numbers are diagnostics, never identity. Keep repeated calls too."""
    return site['file'], site['fn'], site['callee'], json.dumps(site['args'], ensure_ascii=False)


def read_ledger(path: Path) -> dict:
    baseline = {}
    with path.open(newline='') as source:
        rows = csv.reader(source, delimiter='\t')
        if next(rows, None) != list(LEDGER_COLUMNS):
            raise ValueError(f'{path}: expected {", ".join(LEDGER_COLUMNS)} columns')
        for line, row in enumerate(rows, 2):
            if len(row) != len(LEDGER_COLUMNS) or row[-1] not in CLASSES:
                raise ValueError(f'{path}:{line}: invalid call-site entry')
            baseline.setdefault(tuple(row[:-1]), []).append(row[-1])
    return baseline


def check_ledger(baseline, results) -> int:
    # Identical calls in one function share a key. Match the weakest classes
    # first. Additional proved calls need no old entry; unproved copies do.
    grouped = {}
    for site, kind, why in results:
        grouped.setdefault(site_key(site), []).append((site, kind, why))
    failures = 0
    for key, current in sorted(grouped.items()):
        previous = sorted(baseline.get(key, []), key=CLASSES.index)
        additions = max(0, len(current) - len(previous))
        for site, kind, why in sorted(current, key=lambda row: CLASSES.index(row[1]), reverse=True):
            if additions and kind != 'unproved':
                additions -= 1
                continue
            old = previous.pop() if previous else None
            if old is not None and CLASSES.index(kind) <= CLASSES.index(old):
                continue
            if old is None and kind != 'unproved':
                continue
            reason = why or {'guarded': 'now requires guards or helper bounds',
                             'invariant': 'now requires assumed C or readonly-table invariants',
                             'unproved': 'domain not established'}[kind]
            call = f"{site['callee']}({', '.join(site['args'])})"
            change = f'{old} -> {kind}' if old else 'new unproved site'
            print(f"FAILED {site['file']}:{site['line']} {site['fn']} {call}: {change}; {reason}", flush=True)
            failures += 1
    return failures


if __name__ == '__main__':
    sys.exit(main())
