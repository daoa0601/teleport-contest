"""Prove the eight-byte packing loops in the actual RNG wrappers.

This claim covers seed packing only. Context selection and the wrapper's other
global writes remain outside it. BigInt JS inputs cover all uint64 seeds;
Number inputs cover equal integer seeds in 0..2^53-1.
"""
import time

import z3

from bv import Counterexample, Obligations, WORD_MAX, c_convert, fresh, integer, predicate
from core import Unsupported
from isaac_c import CIsaac
from isaac_js import JSIsaac
from isaac_specs import same_integer, same_memory, Summaries

NAME = 'isaac64_seed_packing'
PROBES = (True,)
MUTANT = (b's >>= 8n;', b's >>= 7n;')


def input_seed(checks, number):
    word = fresh('wrapper_seed', 0, WORD_MAX, 'num' if number else 'big')
    if number:
        # This sufficient subdomain avoids relying on inexact Number literals.
        # BigInt inputs separately cover the full uint64 range.
        checks.pre.append(predicate('<=', word, integer(2**53-1)))
    return word


def check(front, source, probe=False, number=False):
    checks = Obligations()
    word = input_seed(checks, number)
    if probe:
        checks.pre.append(predicate('==', word, integer(0)))
    c, j = CIsaac(front, checks, {}), JSIsaac(source, checks, {})
    node, c.file = front.function('init_isaac64')
    body = node['inner'][-1]['inner']
    c.env = {'seed': c_convert(word, (64, False))}
    for stmt in body:
        if stmt['kind'] == 'DeclStmt' and stmt['inner'][0]['name'] in ('new_rng_state', 'i'):
            list(c.statements(stmt))
    c_loops = [stmt for stmt in body if stmt['kind'] == 'ForStmt']
    j.env['seed'] = None if probe else word
    body = j.functions['initRng'].child_by_field_name('body').named_children
    for stmt in body:
        if stmt.type == 'lexical_declaration':
            names = [d.child_by_field_name('name').text for d in stmt.named_children]
            if names in ([b's'], [b'bytes']):
                j.declare(stmt)
    j_loops = [stmt for stmt in body if stmt.type == 'for_statement']
    if len(c_loops) != 1 or len(j_loops) != 1:
        raise Unsupported('seed packing needs exactly one loop in each wrapper')
    # Both loops fully unwind. The executor checks the guard after the bound,
    # so a changed iteration count cannot silently truncate execution.
    list(c.statements(c_loops[0]))
    list(j.statements(j_loops[0]))
    checks.require(same_memory(c.env['new_rng_state'], j.env['bytes']), 'packed seed bytes')
    checks.require(same_integer(c.env['seed'], j.env['s']), 'unpacked seed suffix')
    checks.require(same_integer(c.env['seed'], integer(0)), 'all 64 seed bits packed')
    Summaries.initialized(c.env['new_rng_state'], checks)
    return checks.count


def run(front, repo, only=None, probes=True, mutants=True):
    name = NAME
    if only and name not in only and 'isaac64' not in only:
        return 0
    source = (repo / 'js' / 'rng.js').read_bytes()
    start = time.monotonic()
    failures = 0
    try:
        count = check(front, source) + check(front, source, number=True)
        print(f'PROVED  {name:<22} {time.monotonic()-start:6.1f}s  {count} obligations', flush=True)
    except (Counterexample, Unsupported) as error:
        print(f'FAILED  {name}: {error}', flush=True)
        return 1
    for probe in PROBES if probes else ():
        try:
            check(front, source, probe=probe)
            print('  SURVIVED undefined seed probe', flush=True)
            failures += 1
        except Counterexample as error:
            print(f'  counterexample outside domain: {error}', flush=True)
        except Unsupported as error:
            print(f'  FAILED probe: {error}', flush=True)
            failures += 1
    if mutants:
        old, new = MUTANT
        if source.count(old) != 1:
            print('  FAILED seed shift mutant target is not unique', flush=True)
            return failures + 1
        try:
            check(front, source.replace(old, new))
            print('  SURVIVED seed shift mutant', flush=True)
            failures += 1
        except Counterexample as error:
            print(f'  killed seed shift mutant: {error}', flush=True)
        except Unsupported as error:
            print(f'  FAILED mutant: {error}', flush=True)
            failures += 1
    return failures
