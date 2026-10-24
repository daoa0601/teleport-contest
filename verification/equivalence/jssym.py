"""Symbolic executor for the JavaScript subset of the emitted runtime (js/*.js).

The emitted JavaScript, not the TypeScript source, is what the grader runs, so
it is the artifact under verification.

Numbers are modeled as mathematical integers. Every arithmetic result must be
a safe integer (|v| <= 2^53), which makes IEEE-754 +, -, and * exact.
Math.trunc(a / b) is integer truncating division when b != 0 and |a| <= 2^52:
the rounding error of a / b is then below 1/(2|b|), less than the distance from
a non-integer quotient to the nearest integer. Both are proof obligations, so
a run that leaves the exact-integer domain fails instead of being trusted.
Negative zero is identified with zero; none of the modeled operations can tell
them apart (division by zero is an obligation failure). BigInt values are exact.
"""
from __future__ import annotations

from dataclasses import dataclass

import tree_sitter_javascript as tsj
import z3
from tree_sitter import Language, Parser

from core import STREAMS, Machine, Unsupported, Event, seq

SAFE = 2 ** 53
_PARSER = Parser(Language(tsj.language()))


def _close_scope(outer, paths):
    """Drop the bindings a block or for statement introduced (let, const);
    outer is the set of names bound before it ran."""
    for p in paths:
        for name in [k for k in p.env if k not in outer]:
            del p.env[name]
    return paths


@dataclass(frozen=True)
class V:
    """A JavaScript value: kind is num, big, bool, str, ctx, obj, fn, ext, undef."""
    kind: str
    v: object = None


UNDEF = V('undef')


def parse_module(source: bytes):
    tree = _PARSER.parse(source)
    if tree.root_node.has_error:
        raise Unsupported('JavaScript parse error')
    functions, imports, module_vars = {}, set(), set()
    for node in tree.root_node.children:
        decl = node.child_by_field_name('declaration') if node.type == 'export_statement' else node
        if decl is None:
            continue
        if decl.type == 'function_declaration':
            functions[decl.child_by_field_name('name').text.decode()] = decl
        elif decl.type in ('lexical_declaration', 'variable_declaration'):
            for d in decl.named_children:
                if d.type == 'variable_declarator':
                    module_vars.add(d.child_by_field_name('name').text.decode())
        elif decl.type == 'import_statement':
            for ident in _descendants(decl):
                if ident.type == 'identifier':
                    imports.add(ident.text.decode())
    return functions, imports, module_vars


def _descendants(node):
    for c in node.named_children:
        yield c
        yield from _descendants(c)


def _strip(node):
    while node.type == 'parenthesized_expression':
        node = node.named_children[0]
    return node


def _assigned(node) -> set:
    names = set()
    for m in [node, *_descendants(node)]:
        if m.type in ('assignment_expression', 'augmented_assignment_expression'):
            target = m.child_by_field_name('left')
        elif m.type == 'update_expression':
            target = m.child_by_field_name('argument')
        else:
            continue
        if target.type != 'identifier':
            raise Unsupported('assignment to a non-identifier')
        names.add(target.text.decode())
    return names


class JSExec:
    def __init__(self, machine: Machine, modules: dict, module_env: dict):
        """modules: file label -> (source bytes, functions, imports)."""
        self.m = machine
        self.functions = {}
        for label, (_, functions, _) in modules.items():
            for name, node in functions.items():
                self.functions.setdefault(name, (label, node))
        self.module_env = module_env
        self.stack = []

    def where(self, node) -> str:
        return f'{self.stack[-1][1]}:{node.start_point[0] + 1}'

    def run(self, name, args):
        out = []
        for p, v in self.call(self.m.start_path(), name, args):
            p.ret = v
            out.append(p)
        return out

    def call(self, path, name, args):
        label, decl = self.functions[name]
        params = [c for c in decl.child_by_field_name('parameters').named_children]
        if any(prm.type != 'identifier' for prm in params):
            raise Unsupported(f'{name}: non-simple parameters')
        p = path.fork()
        p.frames.append({prm.text.decode(): (args[i] if i < len(args) else UNDEF)
                         for i, prm in enumerate(params)})
        body = decl.child_by_field_name('body')
        loops = [m for m in _descendants(body) if m.type in ('for_statement', 'while_statement')]
        self.stack.append((name, label, {m.id: i for i, m in enumerate(loops)}))
        try:
            outs = self.exec(p, body)
        finally:
            self.stack.pop()
        results = []
        for q in outs:
            value = q.ret if q.returned else UNDEF
            q.frames.pop()
            q.ret, q.returned = None, False
            results.append((q, value))
        return results

    # ---- statements --------------------------------------------------------

    def exec(self, path, n):
        t = n.type
        if t == 'comment':
            return [path]
        if t == 'statement_block':
            outer, paths = set(path.env), [path]
            for c in n.named_children:
                paths = seq(paths, lambda p, c=c: self.exec(p, c))
            return _close_scope(outer, paths)
        if t in ('lexical_declaration', 'variable_declaration'):
            paths = [path]
            for d in n.named_children:
                paths = seq(paths, lambda p, d=d: self._declare(p, d))
            return paths
        if t == 'expression_statement':
            return [p for p, _ in self.eval(path, n.named_children[0])]
        if t == 'if_statement':
            other = n.child_by_field_name('alternative')
            out = []
            for p, v in self.eval(path, n.child_by_field_name('condition')):
                for p2, taken in self.m.branch(p, self.truth(v)):
                    if taken:
                        out.extend(self.exec(p2, n.child_by_field_name('consequence')))
                    elif other is not None:
                        out.extend(self.exec(p2, other.named_children[0]))
                    else:
                        out.append(p2)
            return out
        if t == 'return_statement':
            if not n.named_children:
                path.ret, path.returned = UNDEF, True
                return [path]
            out = []
            for p, v in self.eval(path, n.named_children[0]):
                p.ret, p.returned = v, True
                out.append(p)
            return out
        if t == 'throw_statement':
            self.m.oblige(path, False, 'JavaScript throw is reachable', self.where(n))
            return []
        if t == 'for_statement':
            return self._for(path, n)
        if t == 'while_statement':
            return self._loop(path, n, n.child_by_field_name('condition'), None)
        if t == 'empty_statement':
            return [path]
        raise Unsupported(f'JavaScript statement {t} at {self.where(n)}')

    def _declare(self, path, d):
        name = d.child_by_field_name('name').text.decode()
        if name in path.env:
            # one environment per frame: a shadowing declaration would
            # overwrite the outer binding, so it is rejected rather than modeled
            raise Unsupported(f'declaration of {name} shadows a binding at {self.where(d)}')
        value = d.child_by_field_name('value')
        if value is None:
            path.env[name] = UNDEF
            return [path]
        out = []
        for p, v in self.eval(path, value):
            p.env[name] = v
            out.append(p)
        return out

    def _for(self, path, n):
        cond = n.child_by_field_name('condition')
        if cond.type == 'expression_statement':
            cond = cond.named_children[0]
        outer = set(path.env)
        paths = self.exec(path, n.child_by_field_name('initializer'))
        paths = seq(paths, lambda p: self._loop(p, n, cond, n.child_by_field_name('increment')))
        return _close_scope(outer, paths)

    def _loop(self, path, n, cond, update):
        body = n.child_by_field_name('body')
        fn_name, _, ordinals = self.stack[-1]

        def cond_fn(p):
            return [(p2, self.truth(v)) for p2, v in self.eval(p, cond)]

        def body_fn(p):
            paths = self.exec(p, body)
            if update is None:
                return paths
            return seq(paths, lambda q: [q2 for q2, _ in self.eval(q, update)])

        def view_fn(p):
            return {k: v.v for k, v in p.env.items() if v.kind == 'num'}

        def havoc_fn(p, name):
            p.env[name] = V('num', self.m.world.fresh(name))

        modset = _assigned(body) | _assigned(cond) | (_assigned(update) if update is not None else set())
        return self.m.run_loop([path], (fn_name, ordinals[n.id]), cond_fn, body_fn,
                               lambda: modset, view_fn, havoc_fn, self.where(n))

    # ---- expressions -------------------------------------------------------

    @staticmethod
    def truth(v: V):
        if v.kind == 'num':
            return v.v != 0
        if v.kind == 'bool':
            return v.v
        if v.kind in ('ctx', 'obj', 'fn', 'ext'):
            return z3.BoolVal(True)
        if v.kind == 'undef':
            return z3.BoolVal(False)
        if v.kind == 'str':
            return z3.BoolVal(bool(v.v))
        raise Unsupported(f'truthiness of {v.kind}')

    def lookup(self, path, name):
        if name in path.env:
            return path.env[name]
        if name in self.functions:
            return V('fn', name)
        if name in self.module_env:
            return self.module_env[name]
        raise Unsupported(f'unmodeled JavaScript name {name}')

    def num(self, path, value, where, what):
        self.m.oblige(path, z3.And(value >= -SAFE, value <= SAFE),
                      f'JavaScript {what} leaves the exact-integer range', where)
        return V('num', value)

    def eval_list(self, path, nodes):
        results = [(path, [])]
        for node in nodes:
            nxt = []
            for p, vals in results:
                for p2, v in self.eval(p, node):
                    nxt.append((p2, vals + [v]))
            results = nxt
        return results

    def eval(self, path, n):
        t = n.type
        if t == 'parenthesized_expression':
            return self.eval(path, n.named_children[0])
        if t == 'number':
            return [(path, V('num', z3.IntVal(int(n.text.decode(), 0))))]
        if t == 'string':
            return [(path, V('str', n.text.decode()[1:-1]))]
        if t in ('true', 'false'):
            return [(path, V('bool', z3.BoolVal(t == 'true')))]
        if t == 'identifier':
            return [(path, self.lookup(path, n.text.decode()))]
        if t == 'member_expression':
            return self._member(path, n)
        if t == 'binary_expression':
            return self._binary(path, n)
        if t == 'unary_expression':
            return self._unary(path, n)
        if t == 'update_expression':
            target = n.child_by_field_name('argument').text.decode()
            old = path.env[target]
            op = n.child_by_field_name('operator').text.decode()
            new = self.num(path, old.v + (1 if op == '++' else -1), self.where(n), op)
            path.env[target] = new
            prefix = n.children[0].type in ('++', '--')
            return [(path, new if prefix else old)]
        if t == 'assignment_expression':
            target = n.child_by_field_name('left').text.decode()
            out = []
            for p, v in self.eval(path, n.child_by_field_name('right')):
                p.env[target] = v
                out.append((p, v))
            return out
        if t == 'augmented_assignment_expression':
            target = n.child_by_field_name('left').text.decode()
            op = n.child_by_field_name('operator').text.decode()[:-1]
            out = []
            for p, b in self.eval(path, n.child_by_field_name('right')):
                v = self._arith(p, op, p.env[target], b, n)
                p.env[target] = v
                out.append((p, v))
            return out
        if t == 'ternary_expression':
            out = []
            for p, c in self.eval(path, n.child_by_field_name('condition')):
                for p2, taken in self.m.branch(p, self.truth(c)):
                    field = 'consequence' if taken else 'alternative'
                    out.extend(self.eval(p2, n.child_by_field_name(field)))
            return out
        if t == 'call_expression':
            return self._call_expr(path, n)
        raise Unsupported(f'JavaScript expression {t} at {self.where(n)}')

    def _member(self, path, n):
        prop = n.child_by_field_name('property').text.decode()
        out = []
        for p, obj in self.eval(path, n.child_by_field_name('object')):
            if obj.kind != 'obj':
                raise Unsupported(f'member .{prop} of {obj.kind}')
            key = f'{obj.v}.{prop}'
            world = self.m.world
            if key in world.js_state:
                out.append((p, V('num', world.js_state[key])))
            elif key in self.module_env:
                out.append((p, self.module_env[key]))
            elif obj.v in ('game', 'game.u'):
                out.append((p, V('obj', key)))
            else:
                raise Unsupported(f'unmodeled JavaScript state {key}')
        return out

    def _arith(self, path, op, a: V, b: V, node):
        where = self.where(node)
        if a.kind == 'big' and b.kind == 'big':
            if op == '%':
                self.m.oblige(path, b.v != 0, 'JavaScript BigInt % by 0n throws', where)
                return V('big', self.m.trem(path, a.v, b.v))
            r = {'+': lambda: a.v + b.v, '-': lambda: a.v - b.v, '*': lambda: a.v * b.v}.get(op)
            if r is None:
                raise Unsupported(f'BigInt {op}')
            return V('big', r())
        if a.kind != 'num' or b.kind != 'num':
            raise Unsupported(f'{a.kind} {op} {b.kind} at {where}')
        if op == '+':
            return self.num(path, a.v + b.v, where, '+')
        if op == '-':
            return self.num(path, a.v - b.v, where, '-')
        if op == '*':
            return self.num(path, a.v * b.v, where, '*')
        raise Unsupported(f'number operator {op} at {where} (only + - * and Math.trunc(a / b))')

    def _binary(self, path, n):
        op = n.child_by_field_name('operator').text.decode()
        left, right = n.child_by_field_name('left'), n.child_by_field_name('right')
        if op in ('||', '&&', '??'):
            out = []
            for p, a in self.eval(path, left):
                cond = self.truth(a) if op != '??' else z3.BoolVal(a.kind != 'undef')
                for p2, taken in self.m.branch(p, cond):
                    if taken == (op != '&&'):
                        out.append((p2, a))
                    else:
                        out.extend(self.eval(p2, right))
            return out
        out = []
        for p, (a, b) in self.eval_list(path, [left, right]):
            if op in ('===', '!==', '==', '!=') and a.kind == 'str' and b.kind == 'str':
                same = (a.v == b.v) == (op in ('===', '=='))
                out.append((p, V('bool', z3.BoolVal(same))))
            elif op in ('<', '<=', '>', '>=', '===', '!==') and a.kind == b.kind and a.kind in ('num', 'big'):
                c = {'<': a.v < b.v, '<=': a.v <= b.v, '>': a.v > b.v, '>=': a.v >= b.v,
                     '===': a.v == b.v, '!==': a.v != b.v}[op]
                out.append((p, V('bool', c)))
            else:
                out.append((p, self._arith(p, op, a, b, n)))
        return out

    def _unary(self, path, n):
        op = n.child_by_field_name('operator').text.decode()
        out = []
        for p, v in self.eval(path, n.child_by_field_name('argument')):
            if op == '!':
                out.append((p, V('bool', z3.Not(self.truth(v)))))
            elif op == '-' and v.kind == 'num':
                out.append((p, V('num', -v.v)))
            else:
                raise Unsupported(f'unary {op}')
        return out

    def _call_expr(self, path, n):
        fn = _strip(n.child_by_field_name('function'))
        arg_nodes = n.child_by_field_name('arguments').named_children
        where = self.where(n)
        if fn.type == 'member_expression':
            obj = fn.child_by_field_name('object').text.decode()
            prop = fn.child_by_field_name('property').text.decode()
            if obj == 'Math':
                return self._math(path, prop, arg_nodes, where)
            if obj == '_rngLog' and prop == 'push':
                return [(p, UNDEF) for p in self._log(path, arg_nodes[0])]
            raise Unsupported(f'call {obj}.{prop} at {where}')
        name = fn.text.decode()
        out = []
        for p, args in self.eval_list(path, arg_nodes):
            if name == 'BigInt':
                [a] = args
                out.append((p, V('big', a.v)))
            elif name == 'Number':
                [a] = args
                self.m.oblige(p, z3.And(a.v >= -SAFE, a.v <= SAFE),
                              'JavaScript Number(BigInt) rounds', where)
                out.append((p, V('num', a.v)))
            elif name == 'isaac64_next_uint64':
                [ctx] = args
                out.append((p, V('big', self.m.draw(p, STREAMS[ctx.v]))))
            else:
                target = self.lookup(p, name)
                if target.kind != 'fn':
                    raise Unsupported(f'call to {name} at {where}')
                out.extend(self.call(p, name, args))
        return out

    def _math(self, path, name, arg_nodes, where):
        if name == 'trunc':
            [arg] = arg_nodes
            arg = _strip(arg)
            if arg.type == 'binary_expression' and arg.child_by_field_name('operator').text == b'/':
                out = []
                for p, (a, b) in self.eval_list(path, [arg.child_by_field_name('left'),
                                                       arg.child_by_field_name('right')]):
                    self.m.oblige(p, b.v != 0, 'JavaScript division by zero', where)
                    self.m.oblige(p, z3.And(a.v >= -2 ** 52, a.v <= 2 ** 52),
                                  'JavaScript dividend too large for exact Math.trunc(a / b)', where)
                    out.append((p, V('num', self.m.tdiv(p, a.v, b.v))))
                return out
            return self.eval(path, arg)
        out = []
        for p, args in self.eval_list(path, arg_nodes):
            if any(a.kind != 'num' for a in args) or not args:
                raise Unsupported(f'Math.{name} needs numeric arguments at {where}')
            vs = [a.v for a in args]
            if name == 'abs':
                r = z3.If(vs[0] < 0, -vs[0], vs[0])
            elif name == 'sign':
                r = z3.If(vs[0] < 0, -1, z3.If(vs[0] > 0, 1, 0))
            elif name in ('max', 'min'):
                r = vs[0]
                for v in vs[1:]:
                    r = z3.If(v > r, v, r) if name == 'max' else z3.If(v < r, v, r)
            else:
                raise Unsupported(f'Math.{name} at {where}')
            out.append((p, V('num', r)))
        return out

    def _log(self, path, template):
        if template.type != 'template_string':
            raise Unsupported('log entry is not a template literal')
        # each substitution may fork or draw, so every resulting path gets
        # its own copy of the entry, appended after the substitutions' effects
        states = [(path, '', ())]
        for c in template.named_children:
            if c.type == 'string_fragment':
                states = [(p, shape + c.text.decode(), values) for p, shape, values in states]
            elif c.type == 'template_substitution':
                following = []
                for p, shape, values in states:
                    for p2, v in self.eval(p, c.named_children[0]):
                        if v.kind != 'num':
                            raise Unsupported('non-numeric log substitution')
                        following.append((p2, shape + '{}', values + (v.v,)))
                states = following
        for p, shape, values in states:
            p.events.append(Event(shape, values))
        return [p for p, _, _ in states]
