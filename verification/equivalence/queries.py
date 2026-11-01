"""Reuse UNSAT results for identical Z3 propositions across table partitions.

Every key is the complete simplified proposition, including the entry domain.
A hit reuses exactly that proposition's proof result. Satisfiable and unknown
results are never cached; their models or timeouts belong to the current run.
The bound limits retained expressions during a long proof run.

Each query first runs a short-budget `QF_UFLIA` logic-tuned attempt, then the
default configuration with the full budget, and finally the tuned
configuration with the full budget. Both searches are heuristic: an
obligation near either one's search limit flips between proved and `unknown`
with the random seed, term-construction order, and process memory layout --
the rnl CI failure of November 2026 timed out one output-equality obligation
for 120 seconds under the default configuration on Linux while the same
branch proved it in about a second on macOS, with byte-identical
propositions, and reproduced layouts were later observed to stall the tuned
configuration instead. The tuned configuration decided all 144 distinct rnl
propositions in at most 0.3 s for every seed from 0 to 7, so it runs first
under a probe budget; whichever configuration answers decides the query. An
`unsat` or `sat` answer from either configuration is an ordinary Z3 result;
which search found it does not affect soundness.
"""
from collections import OrderedDict

import z3

_UNSAT = OrderedDict()
_LIMIT = 8192
_PROBE_MS = 5_000


def _tuned_solver(proposition, timeout):
    solver = z3.SolverFor('QF_UFLIA')
    solver.set('timeout', timeout)
    solver.add(proposition)
    return solver.check(), solver


def _default_solver(proposition, timeout):
    """Fallback for propositions the logic-tuned configuration gives up on."""
    solver = z3.Solver()
    solver.set('timeout', timeout)
    solver.add(proposition)
    return solver.check(), solver


def solve(constraints, timeout):
    proposition = z3.simplify(z3.And(*constraints))
    if proposition in _UNSAT:
        _UNSAT.move_to_end(proposition)
        return z3.unsat, None
    result, solver = _tuned_solver(proposition, min(timeout, _PROBE_MS))
    if result == z3.unknown:
        result, solver = _default_solver(proposition, timeout)
    if result == z3.unknown:
        # The default configuration gives up on some propositions the tuned
        # one merely needs more than the probe budget for.
        result, solver = _tuned_solver(proposition, timeout)
    if result == z3.unsat:
        _UNSAT[proposition] = None
        if len(_UNSAT) > _LIMIT:
            _UNSAT.popitem(last=False)
    return result, solver


class QueryContext:
    """Keep one entry domain asserted while checking independent path facts."""

    def __init__(self, constraints):
        self.constraints = tuple(constraints)
        self.domain = z3.simplify(z3.And(*constraints))
        self.solver = z3.Solver()
        self.solver.add(self.domain)

    def matches(self, constraints):
        # Object identity detects both appends and replacements without asking
        # Z3 to compare formulas on every branch. Equivalent replacements may
        # rebuild the solver, which is harmless.
        return (len(self.constraints) == len(constraints)
                and all(a is b for a, b in zip(self.constraints, constraints)))

    def check(self, constraints, timeout):
        proposition = z3.simplify(z3.And(self.domain, *constraints))
        if proposition in _UNSAT:
            _UNSAT.move_to_end(proposition)
            return z3.unsat
        self.solver.set(timeout=timeout)
        self.solver.push()
        try:
            self.solver.add(*constraints)
            result = self.solver.check()
        finally:
            self.solver.pop()
        if result == z3.unsat:
            _UNSAT[proposition] = None
            if len(_UNSAT) > _LIMIT:
                _UNSAT.popitem(last=False)
        return result
