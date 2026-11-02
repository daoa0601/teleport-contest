"""Reuse UNSAT results for identical Z3 propositions across table partitions.

Every key is the complete simplified proposition, including the entry domain.
A hit reuses exactly that proposition's proof result. Satisfiable and unknown
results are never cached; their models or timeouts belong to the current run.
The bound limits retained expressions during a long proof run.
"""
from collections import OrderedDict

import z3

_UNSAT = OrderedDict()
_LIMIT = 8192


def solve(constraints, timeout):
    proposition = z3.simplify(z3.And(*constraints))
    if proposition in _UNSAT:
        _UNSAT.move_to_end(proposition)
        return z3.unsat, None
    solver = z3.Solver()
    solver.set('timeout', timeout)
    solver.add(proposition)
    result = solver.check()
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
