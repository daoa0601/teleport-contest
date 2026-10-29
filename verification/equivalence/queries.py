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
