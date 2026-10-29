"""Execute the scoring ISAAC64 JavaScript AST with exact BigInt bounds."""
from __future__ import annotations

import z3

from bv import Integer, Memory, integer, js_binary, predicate
from core import Unsupported
from isaac_c import Loop
from jssym import _PARSER


class JSIsaac:
    def __init__(self, source, checks, summaries):
        self.source, self.checks, self.summaries = source, checks, summaries
        self.functions, self.env, self.globals = {}, {}, {}
        self.returned = None
        root = _PARSER.parse(source).root_node
        if root.has_error:
            raise Unsupported('ISAAC JavaScript parse error')
        for node in root.named_children:
            if node.type == 'export_statement':
                node = node.child_by_field_name('declaration')
            if node.type == 'function_declaration':
                self.functions[node.child_by_field_name('name').text.decode()] = node
            elif node.type == 'lexical_declaration':
                self.declare(node)
            elif node.type not in ('comment', 'import_statement'):
                raise Unsupported('ISAAC JavaScript module node ' + node.type)
        self.globals = self.env.copy()

    def function(self, name, args):
        node = self.functions[name]
        params = node.child_by_field_name('parameters').named_children
        if len(params) != len(args):
            raise Unsupported('JavaScript argument count for ' + name)
        self.env = self.globals | {p.text.decode(): a for p, a in zip(params, args)}
        yield from self.statements(node.child_by_field_name('body'), pause=name != 'isaac64_mix')

    def inline(self, name, args):
        child = JSIsaac(self.source, self.checks, self.summaries)
        for _ in child.function(name, args):
            raise Unsupported('inline JavaScript function needs an invariant')
        return child.returned

    def declare(self, node):
        for decl in node.named_children:
            if decl.type != 'variable_declarator':
                raise Unsupported('JavaScript declaration')
            name = decl.child_by_field_name('name').text.decode()
            if name in self.env:
                raise Unsupported('JavaScript declaration shadows a binding: ' + name)
            value = decl.child_by_field_name('value')
            self.env[name] = self.eval(value) if value is not None else None

    def statements(self, node, pause=False):
        if node is None:
            return
        kind = node.type
        if kind == 'statement_block':
            names = set(self.env)
            for child in node.named_children:
                yield from self.statements(child, pause)
                if self.returned is not None:
                    break
            for name in set(self.env) - names:
                del self.env[name]
        elif kind in ('lexical_declaration', 'variable_declaration'):
            self.declare(node)
        elif kind == 'for_statement':
            names = set(self.env)
            init = node.child_by_field_name('initializer')
            yield from self.statements(init)
            condition = node.child_by_field_name('condition')
            increment = node.child_by_field_name('increment')
            body = node.child_by_field_name('body')
            if pause:
                if init.type in ('lexical_declaration', 'variable_declaration'):
                    counter = init.named_children[0].child_by_field_name('name').text.decode()
                else:
                    # The full-word seed loop initializes i immediately before
                    # the for statement and has an empty initializer.
                    counter = 'i'
                yield Loop(node, condition, body, increment, counter)
            else:
                for _ in range(257):
                    if not self.checks.decide(self.truth(self.eval(condition))):
                        break
                    yield from self.statements(body)
                    if increment is not None:
                        self.eval(increment)
                else:
                    raise Unsupported('JavaScript loop did not unwind within 256 iterations')
            for name in set(self.env) - names:
                del self.env[name]
        elif kind == 'if_statement':
            yes = self.checks.decide(self.truth(self.eval(node.child_by_field_name('condition'))))
            branch = node.child_by_field_name('consequence' if yes else 'alternative')
            if branch is not None:
                yield from self.statements(branch)
        elif kind == 'return_statement':
            self.returned = self.eval(node.named_children[0])
        elif kind == 'expression_statement':
            self.eval(node.named_children[0])
        elif kind in ('comment', 'empty_statement'):
            return
        elif kind == 'throw_statement':
            self.checks.require(z3.BoolVal(False), 'JavaScript throws')
        else:
            self.eval(node)

    def step(self, loop):
        for _ in self.statements(loop.body):
            raise Unsupported('unexpected nested JavaScript induction loop')
        if loop.increment is not None:
            self.eval(loop.increment)

    @staticmethod
    def truth(value):
        if isinstance(value, Integer):
            return predicate('!=', value, integer(0))
        if value is None:
            return False
        if isinstance(value, (Memory, dict)):
            return True
        return value

    def address(self, node):
        if node.type == 'identifier':
            return self.env, node.text.decode()
        if node.type == 'member_expression':
            return self.eval(node.child_by_field_name('object')), node.child_by_field_name('property').text.decode()
        if node.type == 'subscript_expression':
            return self.eval(node.child_by_field_name('object')), self.eval(node.child_by_field_name('index'))
        raise Unsupported('JavaScript lvalue ' + node.type)

    def read(self, address):
        base, key = address
        if isinstance(base, Memory):
            if key == 'length':
                return base.logical_length if base.logical_length is not None else integer(base.length)
            return base.read(key, self.checks)
        value = base[key]
        return value

    def write(self, address, value):
        base, key = address
        if isinstance(base, Memory):
            base.write(key, value, self.checks)
        else:
            if key in base and isinstance(base[key], (Memory, dict)) and base[key] is not value:
                raise Unsupported('rebinding an existing JavaScript array/object alias')
            base[key] = value

    def eval(self, node):
        kind = node.type
        if kind == 'parenthesized_expression':
            return self.eval(node.named_children[0])
        if kind == 'number':
            text = node.text.decode().lower()
            big = text.endswith('n')
            text = text.removesuffix('n')
            return integer(int(text, 16 if text.startswith('0x') else 10), 'big' if big else 'num')
        if kind in ('true', 'false'):
            return kind == 'true'
        if kind == 'undefined' or kind == 'identifier' and node.text == b'undefined':
            return None
        if kind in ('identifier', 'member_expression', 'subscript_expression'):
            return self.read(self.address(node))
        if kind == 'array':
            values = [self.eval(c) for c in node.named_children]
            if not values:
                return Memory.filled(0, integer(0))
            bits = max(v.hi.bit_length() for v in values)
            array = Memory.filled(len(values), integer(0), max(1, bits), values[0].kind)
            for i, value in enumerate(values):
                array.write(integer(i), value, self.checks)
            return array
        if kind == 'object':
            result = {}
            for pair in node.named_children:
                if pair.type != 'pair':
                    raise Unsupported('JavaScript object property')
                result[pair.child_by_field_name('key').text.decode()] = self.eval(pair.child_by_field_name('value'))
            return result
        if kind == 'ternary_expression':
            condition = self.truth(self.eval(node.child_by_field_name('condition')))
            field = 'consequence' if self.checks.decide(condition) else 'alternative'
            return self.eval(node.child_by_field_name(field))
        if kind in ('assignment_expression', 'augmented_assignment_expression'):
            address = self.address(node.child_by_field_name('left'))
            old = self.read(address) if kind == 'augmented_assignment_expression' else None
            value = self.eval(node.child_by_field_name('right'))
            if kind == 'augmented_assignment_expression':
                op = node.child_by_field_name('operator').text.decode()[:-1]
                value = js_binary(op, old, value, self.checks)
            self.write(address, value)
            return value
        if kind == 'binary_expression':
            op = node.child_by_field_name('operator').text.decode()
            a = self.eval(node.child_by_field_name('left'))
            if op == '??':
                return a if a is not None else self.eval(node.child_by_field_name('right'))
            b = self.eval(node.child_by_field_name('right'))
            if op in ('===', '!==') and (a is None or b is None):
                return (a is None and b is None) == (op == '===')
            return js_binary(op, a, b, self.checks)
        if kind == 'unary_expression':
            op = node.child_by_field_name('operator').text.decode()
            if op == '!':
                return z3.Not(self.truth(self.eval(node.child_by_field_name('argument'))))
        if kind == 'update_expression':
            address = self.address(node.child_by_field_name('argument'))
            old = self.read(address)
            op = node.child_by_field_name('operator').text.decode()
            value = js_binary('+' if op == '++' else '-', old, integer(1, old.kind), self.checks)
            self.write(address, value)
            return value if node.text.startswith((b'++', b'--')) else old
        if kind == 'call_expression':
            function = node.child_by_field_name('function')
            args = [self.eval(n) for n in node.child_by_field_name('arguments').named_children]
            if function.type == 'member_expression' and function.child_by_field_name('property').text == b'fill':
                call = function.child_by_field_name('object')
                if call.type == 'call_expression':
                    constructor = call.child_by_field_name('function')
                elif call.type == 'new_expression':
                    constructor = call.child_by_field_name('constructor')
                else:
                    raise Unsupported('JavaScript fill receiver')
                if constructor.text != b'Array':
                    raise Unsupported('JavaScript fill receiver')
                length = self.eval(call.child_by_field_name('arguments').named_children[0]).constant()
                return Memory.filled(length, args[0])
            name = function.text.decode()
            if name in ('Number', 'BigInt'):
                value = args[0]
                if not isinstance(value, Integer):
                    self.checks.require(z3.BoolVal(False), name + ' requires an integer input')
                if name == 'Number':
                    self.checks.require(z3.And(predicate('>=', value, integer(-(2**53-1))),
                                              predicate('<=', value, integer(2**53-1))), 'exact Number conversion')
                return Integer(value.bits, value.lo, value.hi, 'num' if name == 'Number' else 'big', value.signed)
            if name in self.summaries:
                return self.summaries[name](self, args)
            return self.inline(name, args)
        if kind == 'new_expression' and node.child_by_field_name('constructor').text == b'Uint8Array':
            length = self.eval(node.child_by_field_name('arguments').named_children[0]).constant()
            return Memory.filled(length, integer(0), 8, 'num')
        raise Unsupported('ISAAC JavaScript AST: ' + kind)
