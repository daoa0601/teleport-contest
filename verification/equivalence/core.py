"""Path state, the abstract random streams, and loop rules shared by both executors.

Both executors fork paths explicitly. A path carries its path condition, call
frames, the next position of each random stream, and the observable events it
has emitted. Random draws read an uninterpreted function R_stream(position), so
a C path and a JavaScript path that consume the same positions see the same
values. That function is the whole model of ISAAC64: equivalence is proved for
every possible random sequence, not for the real generator.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable

import z3

STREAMS = ('core', 'display')
U64 = 2 ** 64


def stream_fn(stream: str):
    """R_stream(position): the uint64 drawn at that position (Z3 identifies it by name)."""
    return z3.Function(f'R_{stream}', z3.IntSort(), z3.IntSort())


class Unsupported(Exception):
    """Source uses a construct outside the modeled subset."""


@dataclass(frozen=True)
class Event:
    """One observable RNG-log line: a shape such as 'rnl({})={}' plus its values."""
    shape: str
    values: tuple


@dataclass
class Path:
    pc: list
    frames: list
    pos: dict
    events: list
    ret: object = None
    returned: bool = False

    @property
    def env(self) -> dict:
        return self.frames[-1]

    def fork(self) -> 'Path':
        return Path(list(self.pc), [dict(f) for f in self.frames], dict(self.pos),
                    list(self.events), self.ret, self.returned)


@dataclass
class Obligation:
    pc: list
    cond: object
    what: str
    where: str


@dataclass
class LoopSpec:
    """A hand-written relational annotation for one loop on one side.

    invariant(view, entry, pos, pos0) -> list of z3 Bool, where view and entry
    map variable names to integer terms at the loop head and at loop entry.
    facts(view, entry, pos, pos0) -> list of definitional instances (see
    specs.Recurrence) that are assumed wherever the invariant is assumed.
    variant(view, entry) -> integer term that is non-negative whenever the
    body runs and strictly smaller after it, so the loop terminates (the
    invariant alone gives only partial correctness).
    """
    invariant: Callable
    variant: Callable
    facts: Callable = lambda view, entry, pos, pos0: []
    streams: tuple = ('core',)


@dataclass
class World:
    """Symbols shared by the C and JavaScript runs of one proof."""
    logging: bool
    pre: list
    params: list                       # [(name, z3 Int, ctype)]
    c_state: dict                      # 'u.uluck' -> (z3 Int, ctype)
    js_state: dict                     # 'game.u.uluck' -> z3 Int
    c_globals: dict                    # name -> executor value
    loops: dict = field(default_factory=dict)   # (side, function, ordinal) -> LoopSpec
    unroll: int = 12
    streams: dict = field(default_factory=lambda: {s: stream_fn(s) for s in STREAMS})
    _fresh: int = 0

    def fresh(self, name: str) -> z3.ArithRef:
        self._fresh += 1
        return z3.Int(f'{name}!{self._fresh}')


class Machine:
    """Per-side driver: path pruning, draws, obligations, and loop rules."""

    def __init__(self, world: World, side: str):
        self.world = world
        self.side = side
        self.obligations: list[Obligation] = []

    def start_path(self) -> Path:
        return Path([], [{}], {s: z3.IntVal(0) for s in STREAMS}, [])

    def feasible(self, pc: list) -> bool:
        s = z3.Solver()
        s.set('timeout', 5000)
        s.add(*self.world.pre, *pc)
        return s.check() != z3.unsat

    def branch(self, path: Path, cond) -> list[tuple[Path, bool]]:
        cond = z3.simplify(cond)
        out = []
        for taken, c in ((True, cond), (False, z3.Not(cond))):
            if z3.is_false(z3.simplify(c)):
                continue
            p = path.fork()
            if not z3.is_true(z3.simplify(c)):
                p.pc.append(c)
                if not self.feasible(p.pc):
                    continue
            out.append((p, taken))
        return out

    def proves(self, path: Path, cond) -> bool:
        """Whether the domain and path condition already imply cond. Used only to
        pick the simpler of two equal encodings, never to discharge obligations."""
        cond = z3.simplify(cond)
        if z3.is_true(cond) or z3.is_false(cond):
            return z3.is_true(cond)
        s = z3.Solver()
        s.set('timeout', 2000)
        s.add(*self.world.pre, *path.pc, z3.Not(cond))
        return s.check() == z3.unsat

    def tdiv(self, path: Path, a, b):
        return a / b if self.proves(path, z3.And(a >= 0, b > 0)) else tdiv(a, b)

    def trem(self, path: Path, a, b):
        return a % b if self.proves(path, z3.And(a >= 0, b > 0)) else trem(a, b)

    def oblige(self, path: Path, cond, what: str, where: str) -> None:
        cond = z3.simplify(cond) if isinstance(cond, z3.ExprRef) else z3.BoolVal(cond)
        if not z3.is_true(cond):
            self.obligations.append(Obligation(list(path.pc), cond, what, where))

    def draw(self, path: Path, stream: str) -> z3.ArithRef:
        position = path.pos[stream]
        value = self.world.streams[stream](position)
        path.pc.append(z3.And(value >= 0, value < U64))
        path.pos[stream] = z3.simplify(position + 1)
        return value

    # ---- loops -------------------------------------------------------------

    def run_loop(self, paths, key, cond_fn, body_fn, modset_fn, view_fn, havoc_fn, where):
        """Run a loop by unrolling with an unwinding check, or by an annotated
        invariant when one is registered for (side, function, ordinal)."""
        spec = self.world.loops.get((self.side,) + key)
        if spec is None:
            return self._unroll(paths, cond_fn, body_fn, where)
        out = []
        for path in paths:
            out.extend(self._induct(path, spec, cond_fn, body_fn, modset_fn, view_fn, havoc_fn, where))
        return out

    def _unroll(self, paths, cond_fn, body_fn, where):
        bound = self.world.unroll
        out, current = [], list(paths)
        for iteration in range(bound + 1):
            following = []
            for path in current:
                for p2, cond in cond_fn(path):
                    for p3, taken in self.branch(p2, cond):
                        if not taken:
                            out.append(p3)
                        elif iteration == bound:
                            self.oblige(p3, False, f'loop runs more than {bound} iterations', where)
                        else:
                            following.extend(body_fn(p3))
            out.extend(p for p in following if p.returned)
            current = [p for p in following if not p.returned]
        return out

    def _induct(self, path, spec, cond_fn, body_fn, modset_fn, view_fn, havoc_fn, where):
        entry = view_fn(path)
        pos0 = dict(path.pos)
        path = path.fork()
        path.pc.extend(spec.facts(entry, entry, path.pos, pos0))
        for c in spec.invariant(entry, entry, path.pos, pos0):
            self.oblige(path, c, 'loop invariant holds on entry', where)

        head = path.fork()
        for name in modset_fn():
            havoc_fn(head, name)
        for s in spec.streams:
            head.pos[s] = self.world.fresh(f'pos_{s}')
        view = view_fn(head)
        head.pc.extend(spec.facts(view, entry, head.pos, pos0))
        head.pc.extend(spec.invariant(view, entry, head.pos, pos0))
        if not self.feasible(head.pc):
            raise Unsupported(f'{where}: loop invariant is unsatisfiable (vacuous)')
        events_before = len(head.events)

        exits = []
        for p2, cond in cond_fn(head):
            for p3, taken in self.branch(p2, cond):
                if not taken:
                    exits.append(p3)
                    continue
                measure = spec.variant(view, entry)
                self.oblige(p3, measure >= 0, 'loop variant is non-negative when the body runs', where)
                for p4 in body_fn(p3):
                    if p4.returned or len(p4.events) != events_before:
                        raise Unsupported(f'{where}: annotated loop returns or logs inside its body')
                    for s in STREAMS:
                        if s not in spec.streams and not z3.eq(p4.pos[s], head.pos[s]):
                            raise Unsupported(f'{where}: loop draws from unlisted stream {s}')
                    after = view_fn(p4)
                    p4.pc.extend(spec.facts(after, entry, p4.pos, pos0))
                    for c in spec.invariant(after, entry, p4.pos, pos0):
                        self.oblige(p4, c, 'loop invariant is preserved', where)
                    self.oblige(p4, spec.variant(after, entry) < measure, 'loop variant decreases', where)
        return exits


def seq(paths, fn):
    """Apply fn to every live path; returned paths pass through unchanged."""
    out = []
    for p in paths:
        out.extend([p] if p.returned else fn(p))
    return out


def tdiv(a, b):
    """C99 / JavaScript truncating integer division on mathematical integers."""
    q = z3.If(a >= 0, a, -a) / z3.If(b >= 0, b, -b)   # both operands non-negative
    return z3.If((a >= 0) == (b >= 0), q, -q)


def trem(a, b):
    """Remainder with the sign of the dividend (C99 %, JavaScript BigInt %)."""
    return a - b * tdiv(a, b)
