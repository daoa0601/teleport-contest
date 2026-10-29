"""Clang-AST execution for ISAAC64, with typed wraparound and array writes."""
from __future__ import annotations

from dataclasses import dataclass

import z3

from bv import (Integer, Memory, Pointer, c_binary, c_convert, integer,
                predicate)
from core import Unsupported
from csym import ctype, c_sizeof


@dataclass
class Loop:
    node: object
    condition: object
    body: object
    increment: object
    counter: str


class CIsaac:
    def __init__(self, front, checks, summaries):
        self.front, self.checks, self.summaries = front, checks, summaries
        self.env = {}
        self.returned = None
        self.file = None

    def scalar_type(self, qual):
        try:
            return ctype({'qualType': qual})
        except Unsupported:
            for node in self.front._dump(self.file, qual):
                if node.get('kind') == 'TypedefDecl' and node.get('name') == qual:
                    return ctype(node['type'])
            raise Unsupported('unresolved clang scalar type: ' + qual)

    def function(self, name, args):
        node, self.file = self.front.function(name)
        params = [n for n in node['inner'] if n['kind'] == 'ParmVarDecl']
        if len(params) != len(args):
            raise Unsupported('C argument count for ' + name)
        self.env = {p['name']: a for p, a in zip(params, args)}
        yield from self.statements(node['inner'][-1], pause=name != 'isaac64_mix')

    def run_inline(self, name, args):
        child = CIsaac(self.front, self.checks, self.summaries)
        for _ in child.function(name, args):
            raise Unsupported('inline C function has an induction loop')
        return child.returned

    def statements(self, node, pause=False):
        kind, children = node.get('kind'), node.get('inner', [])
        if kind is None:
            return
        if kind in ('CompoundStmt', 'DeclStmt'):
            for child in children:
                yield from self.statements(child, pause)
                if self.returned is not None:
                    break
        elif kind == 'VarDecl':
            if node['name'] in self.env:
                raise Unsupported('C declaration shadows a binding: ' + node['name'])
            qual = node['type']['qualType'].replace('const ', '')
            if '[' in qual:
                base, count = qual.rstrip(']').split('[')
                bits, _ = self.scalar_type(base)
                array = Memory.symbolic('local_' + node['name'], int(count), bits, 'c')
                array.initialized = z3.K(z3.BitVecSort(64), z3.BoolVal(False))
                self.env[node['name']] = array
                if children:
                    if children[0]['kind'] != 'InitListExpr':
                        raise Unsupported('C array initializer')
                    for i, child in enumerate(children[0]['inner']):
                        array.write(integer(i), self.eval(child), self.checks)
            else:
                self.env[node['name']] = self.eval(children[0]) if children else None
        elif kind == 'ForStmt':
            init, unused, condition, increment, body = children
            if unused:
                raise Unsupported('C for condition declaration')
            yield from self.statements(init)
            if pause:
                # The invariant annotates only outer loops. Nested loops have
                # at most eight iterations and are completely unrolled.
                counter = init['inner'][0]['referencedDecl']['name']
                yield Loop(node, condition, body, increment, counter)
            else:
                for _ in range(257):
                    if not self.checks.decide(self.truth(self.eval(condition))):
                        break
                    yield from self.statements(body)
                    self.eval(increment)
                else:
                    raise Unsupported('C loop did not unwind within 256 iterations')
        elif kind == 'IfStmt':
            branch = 1 if self.checks.decide(self.truth(self.eval(children[0]))) else 2
            if branch < len(children):
                yield from self.statements(children[branch])
        elif kind == 'ReturnStmt':
            self.returned = self.eval(children[0])
        else:
            self.eval(node)

    def step(self, loop):
        for _ in self.statements(loop.body):
            raise Unsupported('unexpected nested C induction loop')
        self.eval(loop.increment)

    @staticmethod
    def truth(value):
        return predicate('!=', value, integer(0)) if isinstance(value, Integer) else value

    def address(self, node):
        kind, children = node['kind'], node.get('inner', [])
        if kind == 'ParenExpr':
            return self.address(children[0])
        if kind == 'DeclRefExpr':
            return self.env, node['referencedDecl']['name']
        if kind == 'MemberExpr':
            return self.eval(children[0]), node['name']
        if kind == 'ArraySubscriptExpr':
            base, index = self.eval(children[0]), self.eval(children[1])
            if isinstance(base, Pointer):
                index = c_binary('+', base.offset, index, (64, False), self.checks)
                base = base.memory
            return base, index
        raise Unsupported('C lvalue ' + kind)

    def read(self, address):
        base, key = address
        value = base.read(key, self.checks) if isinstance(base, Memory) else base[key]
        if value is None:
            raise Unsupported('C reads an uninitialized local: ' + str(key))
        return value

    def write(self, address, value):
        base, key = address
        if isinstance(base, Memory):
            base.write(key, value, self.checks)
        else:
            if key in base and isinstance(base[key], (Memory, dict)) and base[key] is not value:
                raise Unsupported('rebinding an existing C array/context alias')
            base[key] = value

    def eval(self, node):
        kind, children = node['kind'], node.get('inner', [])
        if kind in ('ImplicitCastExpr', 'CStyleCastExpr', 'ParenExpr'):
            value = self.eval(children[0])
            if kind == 'ParenExpr' or not isinstance(value, Integer):
                return value
            return c_convert(value, ctype(node['type']))
        if kind == 'IntegerLiteral':
            return c_convert(integer(int(node['value'])), ctype(node['type']))
        if kind == 'DeclRefExpr' and node['referencedDecl']['kind'] == 'FunctionDecl':
            return node['referencedDecl']['name']
        if kind in ('DeclRefExpr', 'MemberExpr', 'ArraySubscriptExpr'):
            return self.read(self.address(node))
        if kind == 'UnaryExprOrTypeTraitExpr' and node['name'] == 'sizeof':
            qual = node.get('argType', children[0].get('type', {}) if children else {})['qualType']
            if '[' in qual:
                base, count = qual.rstrip(']').split('[')
                size = self.scalar_type(base)[0] // 8 * int(count)
            else:
                size = c_sizeof(qual)
            return c_convert(integer(size), ctype(node['type']))
        if kind in ('BinaryOperator', 'CompoundAssignOperator'):
            op = node['opcode']
            if op == '=':
                value = self.eval(children[1])
                self.write(self.address(children[0]), value)
                return value
            if kind == 'CompoundAssignOperator':
                address = self.address(children[0])
                value = c_binary(op[:-1], self.read(address), self.eval(children[1]),
                                 ctype(node['type']), self.checks)
                self.write(address, value)
                return value
            a, b = self.eval(children[0]), self.eval(children[1])
            if op == '+' and isinstance(a, Memory):
                return Pointer(a, b)
            return c_binary(op, a, b, ctype(node['type']), self.checks)
        if kind == 'UnaryOperator':
            op = node['opcode']
            if op in ('++', '--'):
                address = self.address(children[0])
                old = self.read(address)
                value = c_binary('+' if op == '++' else '-', old, integer(1),
                                 ctype(node['type']), self.checks)
                self.write(address, value)
                return old if node.get('isPostfix') else value
            value = self.eval(children[0])
            if op == '!':
                return z3.Not(self.truth(value))
            if op == '~':
                bits, signed = ctype(node['type'])
                if signed:
                    raise Unsupported('signed C complement')
                return Integer(~value.extend(bits), 0, 2**bits-1, 'c', False)
        if kind == 'CallExpr':
            name = self.eval(children[0])
            if name == '__builtin_object_size':
                # Only consumed by fortified memcpy/memset. Actual allocation
                # bounds are checked on every element below.
                return integer(2**64-1)
            args = [self.eval(n) for n in children[1:]]
            if name in ('memcpy', '__builtin___memcpy_chk'):
                dest, src, count = args[:3]
                if not isinstance(dest, Pointer):
                    dest = Pointer(dest, integer(0))
                words = count.constant() // (src.bits // 8)
                if count.constant() % (src.bits // 8):
                    raise Unsupported('partial-word C memcpy')
                values = [src.read(integer(i), self.checks) for i in range(words)]
                for i, value in enumerate(values):
                    dest.memory.write(c_binary('+', dest.offset, integer(i), (64, False), self.checks),
                                      value, self.checks)
                return None
            if name in ('memset', '__builtin___memset_chk'):
                dest, value, count = args[:3]
                if value.constant() != 0 or count.constant() != dest.length * dest.bits // 8:
                    raise Unsupported('only full zero C memset')
                dest.term = z3.K(z3.BitVecSort(64), z3.BitVecVal(0, dest.bits))
                dest.initialized = None
                return None
            if name in self.summaries:
                return self.summaries[name](self, args)
            return self.run_inline(name, args)
        raise Unsupported('ISAAC C AST: ' + kind)
