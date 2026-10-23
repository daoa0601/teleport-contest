"""What is proved: function pairs, input domains, and the one loop annotation.

Each Spec pairs a C function with its JavaScript port. `pre` is the domain on
which equivalence is claimed, beyond the C parameter types. `probes` weaken the
domain and must fail: they document where C and JavaScript really differ.
`mutants` edit the JavaScript in memory and must fail, unless marked
'equivalent', which must still prove: they show the proof is not vacuous. Loop annotations are the only hand-written proof steps; every
other step is derived from the two sources.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable

import z3

from core import LoopSpec, U64, stream_fn

INT = (32, True)
SCHAR = (8, True)
COORDXY = (16, True)          # global.h: typedef int16_t coordxy
INT_MAX = 2 ** 31 - 1


@dataclass
class Spec:
    name: str
    c: str
    js: str
    params: list                                  # [(name, C type)]
    pre: Callable = lambda s: []
    state: list = field(default_factory=list)     # [(C key, C type, JavaScript path)]
    loops: dict = field(default_factory=dict)
    probes: list = field(default_factory=list)    # [(label, weaker pre)]
    mutants: list = field(default_factory=list)   # [(file, old, new[, 'equivalent'])]


class Recurrence:
    """S(p0, x, 0) = 0 and S(p0, x, k + 1) = S(p0, x, k) + step(p0, x, k).

    A fresh function defined by primitive recursion over k >= 0. Its instances
    are definitions, not assumptions about the program, so assuming any of them
    is sound.
    """

    def __init__(self, name: str, step: Callable):
        self.fn = z3.Function(name, z3.IntSort(), z3.IntSort(), z3.IntSort(), z3.IntSort())
        self.step = step

    def __call__(self, p0, x, k):
        return self.fn(p0, x, k)

    def instances(self, p0, x, k):
        return [self.fn(p0, x, 0) == 0,
                z3.Implies(k >= 0, self.fn(p0, x, k + 1) == self.fn(p0, x, k) + self.step(p0, x, k))]


def _d_loops():
    r = stream_fn('core')
    sums = Recurrence('S_d', lambda p0, x, k: r(p0 + k) % x)

    def draws(p0, k):
        return [z3.Implies(k >= 0, z3.And(r(p0 + k) >= 0, r(p0 + k) < U64))]

    def common(k, n0, x, total, pos, p0):
        s = sums(p0, x, k)
        return [k >= 0, k <= n0, total, pos == p0 + k, s >= 0, s <= k * (x - 1)]

    # C:  while (n--) tmp += RND(x);      tmp starts at n
    def c_inv(v, e, pos, pos0):
        k, p0 = e['n'] - v['n'], pos0['core']
        return common(k, e['n'], e['x'], v['tmp'] == e['n'] + sums(p0, e['x'], k), pos['core'], p0)

    def c_facts(v, e, pos, pos0):
        k = e['n'] - v['n']
        return sums.instances(pos0['core'], e['x'], k) + draws(pos0['core'], k)

    # JavaScript:  for (let i = 0; i < n; i++) sum += RND(x) + 1;
    def js_inv(v, e, pos, pos0):
        k, p0 = v['i'], pos0['core']
        return common(k, e['n'], e['x'], v['sum'] == k + sums(p0, e['x'], k), pos['core'], p0)

    def js_facts(v, e, pos, pos0):
        return sums.instances(pos0['core'], e['x'], v['i']) + draws(pos0['core'], v['i'])

    return {('c', 'd', 0): LoopSpec(c_inv, c_facts), ('js', 'd', 0): LoopSpec(js_inv, js_facts)}


LUCK = [('u.uluck', SCHAR, 'game.u.uluck'), ('u.moreluck', SCHAR, 'game.u.moreluck')]

ULEVEL = [('u.ulevel', INT, 'game.u.ulevel')]
RNG = 'js/rng.js'
HACKLIB = 'js/hacklib.js'

SPECS = [
    Spec('rn2', 'rn2', 'rn2', [('x', INT)], pre=lambda s: [s['x'] >= 1],
         probes=[('x == 0', lambda s: [s['x'] == 0]), ('x < 0', lambda s: [s['x'] < 0])]),
    Spec('rnd', 'rnd', 'rnd', [('x', INT)], pre=lambda s: [s['x'] >= 1],
         probes=[('x == 0', lambda s: [s['x'] == 0]), ('x < 0', lambda s: [s['x'] < 0])],
         mutants=[(RNG, 'const val = RND(x) + 1;', 'const val = RND(x - 1) + 1;')]),
    Spec('rn1', 'rn1_macro', 'rn1', [('x', INT), ('y', INT)],
         pre=lambda s: [s['x'] >= 1, s['y'] + s['x'] - 1 <= INT_MAX],
         probes=[('any y', lambda s: [s['x'] >= 1])]),
    Spec('rnl', 'rnl', 'rnl', [('x', INT)], state=LUCK,
         pre=lambda s: [s['x'] >= 1, s['x'] <= INT_MAX - 256],
         probes=[('x == 0', lambda s: [s['x'] == 0]), ('x < 0', lambda s: [s['x'] < 0]),
                 ('x near INT_MAX', lambda s: [s['x'] > INT_MAX - 256])],
         mutants=[(RNG, 'if (x <= 15) {', 'if (x < 15) {'),
                  (RNG, 'rn2(37 + Math.abs(adjustment))', 'rn2(36 + Math.abs(adjustment))')]),
    Spec('d', 'd', 'd', [('n', INT), ('x', INT)],
         pre=lambda s: [s['n'] >= 0, s['x'] >= 0, z3.Or(s['x'] >= 1, s['n'] == 0),
                        s['n'] * s['x'] <= INT_MAX],
         loops=_d_loops(),
         mutants=[(RNG, 'let sum = 0;', 'let sum = 1;')]),
    Spec('rne', 'rne', 'rne', [('x', INT)], state=ULEVEL,
         pre=lambda s: [s['x'] >= 1, s['u.ulevel'] >= 0, s['u.ulevel'] <= 30],
         mutants=[(RNG, 'ulevel < 15 ? 5', 'ulevel < 16 ? 5', 'equivalent'),   # 15 / 3 == 5
                  (RNG, 'Math.trunc(ulevel / 3)', 'Math.trunc(ulevel / 4)')]),
    Spec('rnz', 'rnz', 'rnz', [('i', INT)], state=ULEVEL,
         pre=lambda s: [s['i'] >= -10 ** 8, s['i'] <= 10 ** 8,
                        s['u.ulevel'] >= 0, s['u.ulevel'] <= 30],
         probes=[('any int i', lambda s: [s['u.ulevel'] >= 0, s['u.ulevel'] <= 30])],
         mutants=[(RNG, 'tmp *= rne(4);', 'tmp *= rne(5);')]),
    Spec('rn2_on_display_rng', 'rn2_on_display_rng', 'rn2Display', [('x', INT)],
         pre=lambda s: [s['x'] >= 1],
         probes=[('x == 0', lambda s: [s['x'] == 0]), ('x < 0', lambda s: [s['x'] < 0])],
         mutants=[(RNG, "initializedContext('display')", "initializedContext('core')")]),
    Spec('distmin', 'distmin', 'distmin', [(v, COORDXY) for v in ('x0', 'y0', 'x1', 'y1')],
         pre=lambda s: [z3.And(s[v] >= -2 ** 14, s[v] < 2 ** 14) for v in ('x0', 'y0', 'x1', 'y1')],
         probes=[('any coordxy', lambda s: [])],
         mutants=[(HACKLIB, 'return Math.max(Math.abs(x1 - x2)', 'return Math.min(Math.abs(x1 - x2)')]),
    Spec('dist2', 'dist2', 'dist2', [(v, COORDXY) for v in ('x0', 'y0', 'x1', 'y1')],
         pre=lambda s: [z3.And(s[v] >= -2 ** 14, s[v] < 2 ** 14) for v in ('x0', 'y0', 'x1', 'y1')],
         probes=[('any coordxy', lambda s: [])],
         mutants=[(HACKLIB, '(y1 - y2) * (y1 - y2);', '(y1 - y2) * (y2 - y1);')]),
]
