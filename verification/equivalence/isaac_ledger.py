"""Ledger domains derived from the ISAAC64 runners' actual symbolic inputs.

The context layouts and initialization flags come from isaac64.h/c via the
input relation in isaac_specs.Pair. Loop plans are reviewed proof annotations;
recording them does not verify the Python proof rules which interpret them.
An absent initialization bitmap means all cells are initialized, as in Memory.
"""
from dataclasses import asdict
import json

import z3

from bv import Integer, Memory, Obligations
from core import Unsupported
import isaac_seed
from isaac_specs import NAMES, PROBES, Pair, cases, mutations


def claims(repo):
    source = (repo / 'frozen/isaac64.js').read_bytes()
    result = {}
    for name in NAMES:
        domains = []
        for case in cases(name):
            pair = Pair(None, source, name, set(), case)
            domains.append({
                'case': case,
                'C arguments': describe(pair.args_c),
                'JS arguments': describe(pair.args_j),
                'preconditions': describe(pair.checks.pre),
                'loop plans': [describe(asdict(plan)) for plan in pair.plans()],
            })
        domain = 'isaac64.c / frozen/isaac64.js; ' + json.dumps(domains)
        result[name] = (domain, len(PROBES[name]), len(mutations(name)))
    domains = []
    for number in (False, True):
        checks = Obligations()
        seed = isaac_seed.input_seed(checks, number)
        domains.append({'seed': describe(seed), 'preconditions': describe(checks.pre)})
    result[isaac_seed.NAME] = ('rnd.c:init_isaac64 / js/rng.js:initRng; ' + json.dumps(domains),
                              len(isaac_seed.PROBES), 1)
    return result


def describe(value):
    if isinstance(value, Integer):
        return {'kind': value.kind, 'bits': value.bits.sexpr(),
                'range': [value.lo, value.hi], 'signed': value.signed}
    if isinstance(value, Memory):
        return {'kind': value.kind, 'length': value.length, 'word bits': value.bits,
                'cells': value.term.sexpr(), 'initialized': describe(value.initialized),
                'logical length': describe(value.logical_length)}
    if isinstance(value, z3.ExprRef):
        return value.sexpr()
    if isinstance(value, dict):
        return {name: describe(item) for name, item in value.items()}
    if isinstance(value, (tuple, list)):
        return [describe(item) for item in value]
    if value is None or isinstance(value, (str, int, bool)):
        return value
    raise Unsupported(f'ISAAC64 ledger domain value: {type(value).__name__}')
