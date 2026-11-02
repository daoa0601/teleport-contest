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
LONG = (64, True)
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
    state: list = field(default_factory=list)     # [(C key, C type, JS path or None for derived API inputs)]
    loops: dict = field(default_factory=dict)
    probes: list = field(default_factory=list)    # [(label, weaker pre)]
    mutants: list = field(default_factory=list)   # [(file, old, new[, 'equivalent'])]
    js_file: str = 'js/rng.js'
    js_args: list = field(default_factory=list)   # additional (kind, value) arguments
    nulls: list = field(default_factory=list)     # [(C global pointer, JS paths)]
    enum_state: list = field(default_factory=list)  # [(C key, type, JS path, [(C enumerator, JS string)])]
    references: list = field(default_factory=list) # [(C pointer, JS aliases)]
    configure: Callable = lambda world, front, modules: None
    arguments: Callable | None = None  # explicit C/JS API argument correspondence
    partitions: Callable | None = None # finite, exhaustive subdomains; each must be satisfiable
    require_counterexamples: bool = False
    slow: bool = False
    assumptions: tuple[str, ...] = ()


@dataclass(frozen=True)
class UnrelatedState:
    """Weaken one state-correspondence equality, keeping the numeric domain."""
    pre: Callable
    unrelated_state: tuple

    def __call__(self, symbols):
        return self.pre(symbols)


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

    return {('c', 'd', 0): LoopSpec(c_inv, lambda v, e: v['n'], c_facts),
            ('js', 'd', 0): LoopSpec(js_inv, lambda v, e: e['n'] - v['i'], js_facts)}


def luck_partitions(front):
    """Exhaustively split the rnl luck sum into magnitude intervals.

    Both luck fields are signed chars, so u.uluck + u.moreluck lies in
    [-256, 254]; the 17 intervals |sum| in [0,15], [16,31], ..., {256} cover
    every value exactly once. Narrowing the magnitude keeps the
    luck-dependent rn2(37 + abs(adjustment)) divisor within a 16-value window
    (and, for x <= 15, the (abs(sum) + 1) / 3 adjustment within six values),
    so every obligation is decided quickly and deterministically, where the
    fully symbolic query coupled both symbolic divisors and z3 proved or gave
    up on it depending on the seed and process memory layout. One magnitude
    per partition (257 partitions) is also deterministic but costs 168 s and
    timed out the CI job; width-16 intervals prove the whole claim in under
    20 s for every seed tried.
    """
    return [(f'luck sum magnitude {lo}-{min(lo + 15, 256)}',
             lambda s, _lo=lo, _hi=min(lo + 15, 256):
                 [z3.Or(z3.And(s['u.uluck'] + s['u.moreluck'] >= _lo,
                               s['u.uluck'] + s['u.moreluck'] <= _hi),
                        z3.And(s['u.uluck'] + s['u.moreluck'] >= -_hi,
                               s['u.uluck'] + s['u.moreluck'] <= -_lo))])
            for lo in range(0, 257, 16)]


LUCK = [('u.uluck', SCHAR, 'game.u.uluck'), ('u.moreluck', SCHAR, 'game.u.moreluck')]
ULEVEL = [('u.ulevel', INT, 'game.u.ulevel')]
RNG = 'js/rng.js'
HACKLIB = 'js/hacklib.js'

C_FILES = ('rnd.c', 'hacklib.c', 'exper.c', 'botl.c', 'attrib.c', 'weapon.c', 'hack.c', 'cmd.c')
JS_FILES = (RNG, HACKLIB, 'js/exper.js', 'js/attrib.js', 'js/weapon.js',
            'js/hero_attack_accuracy.js', 'js/const.js', 'js/polyself.js', 'js/object_data.js')

SPECS = [
    Spec('rn2', 'rn2', 'rn2', [('x', INT)], pre=lambda s: [s['x'] >= 1],
         probes=[('x == 0', lambda s: [s['x'] == 0]), ('x < 0', lambda s: [s['x'] < 0])]),
    Spec('rnd', 'rnd', 'rnd', [('x', INT)], pre=lambda s: [s['x'] >= 1],
         probes=[('x == 0', lambda s: [s['x'] == 0]), ('x < 0', lambda s: [s['x'] < 0])],
         mutants=[(RNG, 'const val = RND(x) + 1;', 'const val = RND(x - 1) + 1;'),
                  # a draw inside a log substitution must reach the path
                  (RNG, '`rnd(${x})=${val}`', '`rnd(${x})=${val + rn2(1)}`')]),
    Spec('rn1', 'rn1_macro', 'rn1', [('x', INT), ('y', INT)],
         pre=lambda s: [s['x'] >= 1, s['y'] + s['x'] - 1 <= INT_MAX],
         probes=[('any y', lambda s: [s['x'] >= 1])]),
    Spec('rnl', 'rnl', 'rnl', [('x', INT)], state=LUCK, partitions=luck_partitions,
         pre=lambda s: [s['x'] >= 1, s['x'] <= INT_MAX - 256],
         probes=[('x == 0', lambda s: [s['x'] == 0]), ('x < 0', lambda s: [s['x'] < 0]),
                 ('x near INT_MAX', lambda s: [s['x'] > INT_MAX - 256])],
         mutants=[(RNG, 'if (x <= 15) {', 'if (x < 15) {'),
                  (RNG, 'rn2(37 + Math.abs(adjustment))', 'rn2(36 + Math.abs(adjustment))')]),
    Spec('d', 'd', 'd', [('n', INT), ('x', INT)],
         pre=lambda s: [s['n'] >= 0, s['x'] >= 0, z3.Or(s['x'] >= 1, s['n'] == 0),
                        s['n'] * s['x'] <= INT_MAX],
         loops=_d_loops(),
         mutants=[(RNG, 'let sum = 0;', 'let sum = 1;'),
                  # keeps the invariant but never terminates: the variant catches it
                  (RNG, 'i++)\n        sum += RND(x) + 1;', 'i += 0)\n        sum += 0;')]),
    Spec('rne', 'rne', 'rne', [('x', INT)], state=ULEVEL,
         pre=lambda s: [s['x'] >= 1, s['u.ulevel'] >= 0, s['u.ulevel'] <= 30],
         mutants=[(RNG, 'ulevel < 15 ? 5', 'ulevel < 16 ? 5', 'equivalent'),   # 15 / 3 == 5
                  (RNG, 'Math.trunc(ulevel / 3)', 'Math.trunc(ulevel / 4)')]),
    # rnd.c:rnz returns (int)x. Fix only the excluded input boundary so the
    # negative check finds that narrowing with a fully symbolic random stream.
    Spec('rnz', 'rnz', 'rnz', [('i', INT)], state=ULEVEL, require_counterexamples=True,
         pre=lambda s: [s['i'] >= -10 ** 8, s['i'] <= 10 ** 8,
                        s['u.ulevel'] >= 0, s['u.ulevel'] <= 30],
         probes=[('INT_MAX narrows on return', lambda s: [s['i'] == INT_MAX,
                                                        s['u.ulevel'] >= 0, s['u.ulevel'] <= 30])],
         mutants=[(RNG, 'tmp *= rne(4);', 'tmp *= rne(5);')]),
    Spec('rn2_on_display_rng', 'rn2_on_display_rng', 'rn2Display', [('x', INT)],
         pre=lambda s: [s['x'] >= 1],
         probes=[('x == 0', lambda s: [s['x'] == 0]), ('x < 0', lambda s: [s['x'] < 0])],
         mutants=[(RNG, "initializedContext('display')", "initializedContext('core')")]),
    Spec('distmin', 'distmin', 'distmin', [(v, COORDXY) for v in ('x0', 'y0', 'x1', 'y1')],
         js_file=HACKLIB,
         pre=lambda s: [z3.And(s[v] >= -2 ** 14, s[v] < 2 ** 14) for v in ('x0', 'y0', 'x1', 'y1')],
         probes=[('any coordxy', lambda s: [])],
         mutants=[(HACKLIB, 'return Math.max(Math.abs(x1 - x2)', 'return Math.min(Math.abs(x1 - x2)'),
                  (HACKLIB, 'Math.abs(y1 - y2));', 'Math.abs(y1 - y2), 1);')]),
    Spec('dist2', 'dist2', 'dist2', [(v, COORDXY) for v in ('x0', 'y0', 'x1', 'y1')],
         js_file=HACKLIB,
         pre=lambda s: [z3.And(s[v] >= -2 ** 14, s[v] < 2 ** 14) for v in ('x0', 'y0', 'x1', 'y1')],
         probes=[('any coordxy', lambda s: [])],
         mutants=[(HACKLIB, '(y1 - y2) * (y1 - y2);', '(y1 - y2) * (y2 - y1);'),
                  # a block-local binding must not escape or overwrite the outer one
                  (HACKLIB, 'return (x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2);',
                   'let r = 0; { let r = (x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2); } return r;')]),
]


def coordinate_domain(s, names):
    return [z3.And(s[name] >= -32768, s[name] <= 32767) for name in names]


SPECS += [
    Spec('isok', 'isok', 'isok', [('x', INT), ('y', INT)],
         require_counterexamples=True, js_file=HACKLIB,
         pre=lambda s: coordinate_domain(s, ('x', 'y')),
         probes=[('x narrows to coordxy', lambda s: [s['x'] == 65537, s['y'] == 0])],
         mutants=[(HACKLIB, 'return x >= 1 && x <= COLNO - 1',
                   'return x >= 0 && x <= COLNO - 1')]),
    Spec('online2', 'online2', 'pointsOnline', [(name, INT) for name in ('x0', 'y0', 'x1', 'y1')],
         require_counterexamples=True, js_file=HACKLIB,
         pre=lambda s: coordinate_domain(s, ('x0', 'y0', 'x1', 'y1')),
         probes=[('x0 narrows to coordxy', lambda s: [s['x0'] == 65536, s['y0'] == 1,
                                                     s['x1'] == 0, s['y1'] == 0])],
         mutants=[(HACKLIB, 'dy === -dx;', 'dy === dx;')]),
]

# Stage 2: the global attribute arrays have six signed-char elements
# (attrib.h: struct attribs). These claims cover Strength and Dexterity with
# no gauntlets; other attributes and equipment effects are not assumed proved.
ATTRIBUTES = [(f'u.{field}.a[{i}]', SCHAR, f'game.u.{field}.a[{i}]')
              for field in ('acurr', 'abon', 'atemp') for i in range(6)]
NO_GAUNTLETS = [('uarmg', ('game.uarmg', 'game.u.uarmg'))]
ATTRIB = 'js/attrib.js'
EXPER = 'js/exper.js'
CONST = 'js/const.js'
WEAPON_DAMAGE = 'js/weapon.js'
HIT_BONUS = 'js/hero_attack_accuracy.js'
POLYSELF = 'js/polyself.js'


def int_argument(s, name):
    return [s[name] >= -2 ** 31, s[name] <= INT_MAX]


def human(s):
    # you.h: Upolyd compares the current and original monster numbers.
    return [s['u.umonnum'] == s['u.umonster']]


HUMAN_FORM = [('u.umonnum', INT, 'game.u.umonnum'),
              ('u.umonster', INT, 'game.u.umonster')]

SPECS += [
    Spec('enermod', 'enermod', 'energyModifier', [('en', INT)], js_file=EXPER,
         js_args=[('state', 'game.urole.key')],
         enum_state=[('gu.urole.mnum', (16, True), 'game.urole.key', [
             ('PM_ARCHEOLOGIST', 'archeologist'), ('PM_BARBARIAN', 'barbarian'),
             ('PM_CAVE_DWELLER', 'caveman'), ('PM_HEALER', 'healer'), ('PM_KNIGHT', 'knight'),
             ('PM_MONK', 'monk'), ('PM_CLERIC', 'priest'), ('PM_RANGER', 'ranger'),
             ('PM_ROGUE', 'rogue'), ('PM_SAMURAI', 'samurai'), ('PM_TOURIST', 'tourist'),
             ('PM_VALKYRIE', 'valkyrie'), ('PM_WIZARD', 'wizard')])],
         pre=lambda s: [s['en'] >= -(INT_MAX // 3), s['en'] <= INT_MAX // 3],
         probes=[('energy overflows C multiplication', lambda s: [s['en'] == INT_MAX])],
         mutants=[(EXPER, 'return 2 * energy;', 'return 3 * energy;')]),
    Spec('newuexp', 'newuexp', 'newExperienceThreshold', [('lev', INT)],
         js_file=EXPER, pre=lambda s: [s['lev'] >= 0, s['lev'] <= 30],
         probes=[('any int level', lambda s: [])],
         mutants=[(EXPER, 'return 10 * (2 ** level);', 'return 11 * (2 ** level);')]),
    Spec('xlev_to_rank', 'xlev_to_rank', 'experienceRankIndex', [('xlev', LONG)],
         js_file=EXPER, pre=lambda s: int_argument(s, 'xlev'),
         probes=[('level outside C int', lambda s: [s['xlev'] == 2 ** 32 + 1])],
         mutants=[(EXPER, 'Math.trunc((level + 2) / 4)', 'Math.trunc((level + 1) / 4)')]),
    Spec('rounddiv', 'rounddiv', 'roundDiv', [('x', LONG), ('y', INT)],
         js_file=POLYSELF,
         pre=lambda s: [s['x'] >= -10 ** 8, s['x'] <= 10 ** 8, s['y'] >= 1, s['y'] <= 10 ** 6],
         probes=[('negative denominator', lambda s: [s['x'] == 2, s['y'] == -3])],
         mutants=[(POLYSELF, 'Math.trunc(denominator / 2)', 'Math.trunc(denominator / 3)')]),
    Spec('Align2amask', 'align_to_mask', 'Align2amask', [('alignment', INT)],
         js_file=CONST,
         pre=lambda s: [z3.Or(*(s['alignment'] == v for v in (-128, -1, 0, 1)))],
         probes=[('alignment outside enum', lambda s: [s['alignment'] == -3])],
         mutants=[(CONST, 'return (x + 2) & 0xff;', 'return (x + 1) & 0xff;')]),
    Spec('Amask2align', 'mask_to_align', 'Amask2align', [('mask', LONG)],
         js_file=CONST, pre=lambda s: int_argument(s, 'mask'),
         probes=[('mask outside C int', lambda s: [s['mask'] == 2 ** 53 + 1])],
         mutants=[(CONST, 'const masked = x & AM_MASK;', 'const masked = x & AM_SHRINE;')]),
    Spec('acurr:StrDex', 'acurr', 'currentAttribute', [('chridx', INT)],
         js_file=ATTRIB, state=ATTRIBUTES, nulls=NO_GAUNTLETS,
         pre=lambda s: [z3.Or(s['chridx'] == 0, s['chridx'] == 3)],
         probes=[('one base attribute does not correspond', UnrelatedState(
             lambda s: [s['chridx'] == 0], ('u.acurr.a[0]',)))],
         mutants=[(ATTRIB, '+ (hero.abon?.a?.[attribute] ?? 0)', '+ (hero.abon?.a?.[attribute] ?? 1) + 1')]),
    Spec('acurrstr', 'acurrstr', 'currentStrength', [],
         js_file=ATTRIB, state=ATTRIBUTES, nulls=NO_GAUNTLETS,
         probes=[('base Strength does not correspond', UnrelatedState(lambda s: [], ('u.acurr.a[0]',)))],
         mutants=[(ATTRIB, '19 + Math.trunc(strength / 50)', '19 + Math.trunc(strength / 51)')]),
    Spec('dbon:human', 'dbon', 'heroStrengthDamageBonus', [],
         js_file=WEAPON_DAMAGE, js_args=[('obj', 'game')],
         state=ATTRIBUTES + HUMAN_FORM, nulls=NO_GAUNTLETS, pre=human,
         probes=[('base Strength does not correspond', UnrelatedState(human, ('u.acurr.a[0]',)))],
         mutants=[(WEAPON_DAMAGE, 'if (strength <= 93)', 'if (strength < 93)')]),
    Spec('abon:human', 'abon', 'heroAttributeHitBonus', [],
         js_file=HIT_BONUS, js_args=[('obj', 'game')],
         state=ATTRIBUTES + HUMAN_FORM + ULEVEL, nulls=NO_GAUNTLETS,
         pre=lambda s: human(s) + [s['u.ulevel'] >= 1, s['u.ulevel'] <= 30],
         probes=[('base Dexterity does not correspond', UnrelatedState(
             lambda s: human(s) + [s['u.ulevel'] >= 1, s['u.ulevel'] <= 30], ('u.acurr.a[3]',)))],
         mutants=[(HIT_BONUS, 'dexterity - 14);', 'dexterity - 13);')]),
]

# Keep the stateful extension separate so the integer/RNG specs stay readable.
from state_specs import STATE_C_FILES, STATE_JS_FILES, STATE_SPECS
C_FILES += STATE_C_FILES
JS_FILES += STATE_JS_FILES
SPECS += STATE_SPECS
