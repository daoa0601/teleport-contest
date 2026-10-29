"""Finite bit-vectors with explicit mathematical bounds.

C values wrap at their clang type. JavaScript BigInts do not: each operation
gets enough signed bits for its entire mathematical result. Only an actual
source mask may discard high bits. Bounds also justify array accesses and
exact Number conversions. Unsupported operations fail closed.
"""
from __future__ import annotations

from dataclasses import dataclass

import z3

from core import Unsupported, bit_operation

WORD_MAX = 2**64 - 1
INDEX = z3.BitVecSort(64)


def width(lo, hi):
    return max(2, hi.bit_length() + 1, (~lo).bit_length() + 1)


@dataclass(frozen=True)
class Integer:
    bits: object
    lo: int
    hi: int
    kind: str = 'big'
    signed: bool = True

    def extend(self, size):
        old = self.bits.size()
        if size < old:
            return z3.Extract(size - 1, 0, self.bits)
        extension = z3.SignExt if self.signed else z3.ZeroExt
        return extension(size - old, self.bits)

    def constant(self):
        value = z3.simplify(self.bits)
        if not z3.is_bv_value(value):
            raise Unsupported('a concrete integer is required here')
        n = value.as_long()
        if self.signed and n >= 2**(value.size() - 1):
            n -= 2**value.size()
        return n


def integer(n, kind='num'):
    return Integer(z3.BitVecVal(n, width(n, n)), n, n, kind)


def fresh(name, lo, hi, kind='big'):
    if lo == 0 and hi > 0 and hi & (hi + 1) == 0:
        bits = hi.bit_length()
        return Integer(z3.ZeroExt(1, z3.BitVec(name, bits)), lo, hi, kind)
    return Integer(z3.BitVec(name, width(lo, hi)), lo, hi, kind)


def predicate(op, a, b):
    size = max(a.bits.size(), b.bits.size()) + 1
    x, y = a.extend(size), b.extend(size)
    return {'<': lambda: x < y, '<=': lambda: x <= y,
            '>': lambda: x > y, '>=': lambda: x >= y,
            '==': lambda: x == y, '!=': lambda: x != y}[op]()


class Obligations:
    def __init__(self):
        self.pre = []
        self.count = 0

    def solve(self, condition):
        solver = z3.Solver()
        solver.set(timeout=30_000)
        solver.add(*self.pre, condition)
        result = solver.check()
        if result == z3.unknown:
            raise Unsupported('Z3 returned unknown: ' + solver.reason_unknown())
        return result, solver

    def require(self, condition, label, observed=()):
        self.count += 1
        condition = z3.simplify(condition)
        if z3.is_true(condition):
            return
        result, solver = self.solve(z3.Not(condition))
        if result == z3.sat:
            raise Counterexample(label, solver.model(), observed)

    def decide(self, condition):
        if isinstance(condition, bool):
            return condition
        condition = z3.simplify(condition)
        if z3.is_true(condition):
            return True
        if z3.is_false(condition):
            return False
        if self.solve(z3.Not(condition))[0] == z3.unsat:
            return True
        if self.solve(condition)[0] == z3.unsat:
            return False
        raise Unsupported('branch needs a domain split: ' + str(condition))


class Counterexample(Exception):
    def __init__(self, label, model, observed=()):
        self.label, self.model = label, model
        # Array models may contain hundreds of cells. Report scalars only.
        scalars = [f'{d.name()}={model[d]}' for d in model.decls()
                   if not z3.is_array(model[d]) and d.arity() == 0]
        scalars = [f'{name}={model.eval(value, model_completion=True)}' for name, value in observed] + scalars
        super().__init__(label + ': ' + ', '.join(scalars[:12]))


def bounded(bits, lo, hi, kind='big'):
    size = width(lo, hi)
    old = bits.size()
    bits = z3.SignExt(size - old, bits) if size > old else z3.Extract(size - 1, 0, bits)
    return Integer(z3.simplify(bits), lo, hi, kind)


def js_binary(op, a, b, checks):
    if not isinstance(a, Integer) or not isinstance(b, Integer):
        checks.require(z3.BoolVal(False), 'JavaScript arithmetic needs integer operands')
    if a.kind != b.kind:
        checks.require(z3.BoolVal(False), f'JavaScript mixes {a.kind} and {b.kind} in {op}')
    kind = a.kind
    size = max(a.bits.size(), b.bits.size()) + 1
    x, y = a.extend(size), b.extend(size)
    if op in ('<', '<=', '>', '>=', '==', '!='):
        return predicate(op, a, b)
    if op == '+':
        lo, hi, bits = a.lo + b.lo, a.hi + b.hi, x + y
    elif op == '-':
        lo, hi, bits = a.lo - b.hi, a.hi - b.lo, x - y
    elif op == '*':
        products = [u*v for u in (a.lo, a.hi) for v in (b.lo, b.hi)]
        lo, hi = min(products), max(products)
        size = max(size, width(lo, hi))
        bits = a.extend(size) * b.extend(size)
    elif op in ('<<', '>>', '/'):
        n = b.constant()
        if op == '/':
            if n <= 0 or a.lo < 0 or a.lo != a.hi or a.lo % n:
                raise Unsupported('only exact constant Number division is supported')
            return integer(a.lo // n, kind)
        if n < 0 or n > 64:
            raise Unsupported('shift outside supported range')
        if op == '<<':
            lo, hi = a.lo << n, a.hi << n
            size = max(size, width(lo, hi))
            bits = bit_operation('<<', a.extend(size), n)
        else:
            lo, hi, bits = a.lo >> n, a.hi >> n, bit_operation('>>', x, n)
    elif op in ('&', '|', '^'):
        bits = bit_operation(op, x, y)
        if op == '&' and b.lo == b.hi and b.lo >= 0:
            lo, hi = 0, b.hi
        elif op == '&' and a.lo == a.hi and a.lo >= 0:
            lo, hi = 0, a.hi
        elif a.lo >= 0 and b.lo >= 0:
            lo, hi = 0, 2**max(a.hi.bit_length(), b.hi.bit_length()) - 1
        else:
            raise Unsupported('unbounded negative bitwise result')
    else:
        raise Unsupported('JavaScript integer operation ' + op)
    if kind == 'num':
        # Number bitwise operators coerce to int32; this subset must already
        # be nonnegative int32, so the coercion has no effect.
        limit = 2**31 - 1 if op in ('<<', '>>', '&', '|', '^') else 2**53 - 1
        if lo < -limit or hi > limit:
            raise Unsupported('Number operation needs an exactness/coercion proof')
    return bounded(bits, lo, hi, kind)


def c_convert(value, ctype):
    bits, signed = ctype
    term = z3.simplify(value.extend(bits))
    lo, hi = (-(2**(bits-1)), 2**(bits-1)-1) if signed else (0, 2**bits-1)
    # Tighter bounds are valid when the conversion cannot wrap.
    if lo <= value.lo and value.hi <= hi:
        lo, hi = value.lo, value.hi
    return Integer(term, lo, hi, 'c', signed)


def c_binary(op, a, b, target, checks):
    if op in ('<', '<=', '>', '>=', '==', '!='):
        return predicate(op, a, b)
    bits, signed = target
    if op in ('<<', '>>'):
        n = b.constant()
        checks.require(z3.BoolVal(0 <= n < a.bits.size()), 'C shift count')
        if op == '>>' and a.lo < 0:
            raise Unsupported('C negative signed right shift')
        if op == '<<' and signed:
            checks.require(predicate('>=', a, integer(0)), 'C signed left shift is nonnegative')
    # Compute without wrapping first; then check signed overflow or perform
    # the unsigned conversion mandated by the typed AST.
    av = Integer(a.extend(a.bits.size()+1), a.lo, a.hi)
    bv = Integer(b.extend(b.bits.size()+1), b.lo, b.hi)
    result = js_binary(op, av, bv, checks)
    if signed and op in ('+', '-', '*', '<<'):
        checks.require(z3.And(predicate('>=', result, integer(-(2**(bits-1)))),
                              predicate('<=', result, integer(2**(bits-1)-1))),
                       'C signed overflow in ' + op)
    return c_convert(result, target)


@dataclass
class Memory:
    term: object
    length: int
    bits: int
    kind: str
    logical_length: object = None
    initialized: object = None

    @classmethod
    def symbolic(cls, name, length=256, bits=64, kind='big'):
        return cls(z3.Array(name, INDEX, z3.BitVecSort(bits)), length, bits, kind)

    @classmethod
    def filled(cls, length, value, bits=64, kind='big'):
        return cls(z3.K(INDEX, value.extend(bits)), length, bits, kind)

    def index(self, index, checks):
        checks.require(z3.And(predicate('>=', index, integer(0)),
                              predicate('<', index, integer(self.length))), 'array index in bounds',
                       [('index', index.bits), ('length', z3.IntVal(self.length))])
        if self.logical_length is not None:
            checks.require(predicate('<', index, self.logical_length), 'seed index below supplied length')
        return index.extend(64)

    def read(self, index, checks):
        offset = self.index(index, checks)
        if self.initialized is not None:
            checks.require(z3.Select(self.initialized, offset), 'C reads initialized array cell')
        bits = z3.Select(self.term, offset)
        return Integer(z3.ZeroExt(1, bits), 0, 2**self.bits-1, self.kind)

    def write(self, index, value, checks):
        if self.kind != 'c':
            checks.require(z3.And(predicate('>=', value, integer(0)),
                                  predicate('<=', value, integer(2**self.bits-1))),
                           'JavaScript stored word fits modeled width')
        self.term = z3.simplify(z3.Store(self.term, self.index(index, checks), value.extend(self.bits)))
        if self.initialized is not None:
            self.initialized = z3.simplify(z3.Store(self.initialized, index.extend(64), True))


@dataclass(frozen=True)
class Pointer:
    memory: Memory
    offset: object
