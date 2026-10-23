"""Symbolic executor for the C subset used by the verified functions.

Integers are mathematical integers tagged with their C type. Signed overflow,
division by zero, and abs(INT_MIN) are undefined behavior and become proof
obligations. Unsigned arithmetic wraps. Narrowing signed conversions wrap,
which is clang's implementation-defined behavior on the recorder's LP64 target.
"""
from __future__ import annotations

import json
from dataclasses import dataclass

import z3

from core import STREAMS, Machine, Unsupported, Event, seq

_TYPES = {
    'int': (32, True), 'unsigned int': (32, False),
    'long': (64, True), 'unsigned long': (64, False),
    'long long': (64, True), 'unsigned long long': (64, False),
    'short': (16, True), 'unsigned short': (16, False),
    'signed char': (8, True), 'char': (8, True), 'unsigned char': (8, False),
    '_Bool': (1, False), 'bool': (1, False),
}


def ctype(t: dict):
    q = t.get('desugaredQualType', t['qualType']).replace('const ', '').replace('volatile ', '').strip()
    if q in _TYPES:
        return _TYPES[q]
    raise Unsupported(f'C type {q}')


def bounds(t):
    bits, signed = t
    return (-(2 ** (bits - 1)), 2 ** (bits - 1) - 1) if signed else (0, 2 ** bits - 1)


def in_range(v, t):
    lo, hi = bounds(t)
    return z3.And(v >= lo, v <= hi)


def convert(v, src, dst):
    if dst == (1, False):
        return z3.If(v != 0, z3.IntVal(1), z3.IntVal(0))
    (slo, shi), (dlo, dhi) = bounds(src), bounds(dst)
    if dlo <= slo and shi <= dhi:
        return v
    bits, signed = dst
    if not signed:
        return v % (2 ** bits)
    wrapped = (v + 2 ** (bits - 1)) % (2 ** bits) - 2 ** (bits - 1)
    return z3.If(in_range(v, dst), v, wrapped)


@dataclass(frozen=True)
class CVal:
    v: object
    t: tuple


@dataclass(frozen=True)
class CPtr:
    nonnull: bool


@dataclass(frozen=True)
class CCtx:
    index: int


@dataclass(frozen=True)
class CStr:
    s: str


@dataclass(frozen=True)
class CFmt:
    fmt: str
    values: tuple


@dataclass(frozen=True)
class CFn:
    name: str


@dataclass(frozen=True)
class CBuf:
    pass


def _unwrap(n):
    while n['kind'] in ('ImplicitCastExpr', 'ParenExpr'):
        n = n['inner'][0]
    return n


def _walk(n):
    yield n
    for c in n.get('inner', []):
        if isinstance(c, dict):
            yield from _walk(c)


def _assigned(n) -> set:
    names = set()
    for m in _walk(n):
        target = None
        if m['kind'] == 'BinaryOperator' and m['opcode'] == '=':
            target = m['inner'][0]
        elif m['kind'] == 'CompoundAssignOperator':
            target = m['inner'][0]
        elif m['kind'] == 'UnaryOperator' and m['opcode'] in ('++', '--'):
            target = m['inner'][0]
        if target is not None:
            target = _unwrap(target)
            if target['kind'] != 'DeclRefExpr':
                raise Unsupported('assignment to a non-local lvalue')
            names.add(target['referencedDecl']['name'])
    return names


class CExec:
    def __init__(self, machine: Machine, front):
        self.m = machine
        self.front = front
        self.stack = []   # (function name, file, loop ordinals)

    # ---- entry -------------------------------------------------------------

    def run(self, name: str, args: list) -> list:
        return [p for p, _ in self._finish(self.call(self.m.start_path(), name, args))]

    @staticmethod
    def _finish(results):
        for p, v in results:
            p.ret = v
            yield p, v

    def conv(self, path, v, src, dst):
        """convert(), skipping the wrap when the path already proves the value fits."""
        if dst != (1, False) and self.m.proves(path, in_range(v, dst)):
            return v
        return convert(v, src, dst)

    def where(self, node) -> str:
        _, file, _ = self.stack[-1]
        return self.front.line(file, node)

    def call(self, path, name, args):
        decl, file = self.front.function(name)
        params = [c for c in decl['inner'] if c['kind'] == 'ParmVarDecl']
        body = next(c for c in decl['inner'] if c['kind'] == 'CompoundStmt')
        if len(params) != len(args):
            raise Unsupported(f'{name}: arity')
        p = path.fork()
        frame = {}
        for prm, a in zip(params, args):
            t = ctype(prm['type'])
            frame[prm['name']] = CVal(self.conv(p, a.v, a.t, t), t)
        p.frames.append(frame)
        loops = [m for m in _walk(body) if m['kind'] in ('WhileStmt', 'ForStmt', 'DoStmt')]
        self.stack.append((name, file, {id(m): i for i, m in enumerate(loops)}))
        try:
            outs = self.exec(p, body)
        finally:
            self.stack.pop()
        results = []
        for q in outs:
            value = q.ret
            q.frames.pop()
            q.ret, q.returned = None, False
            results.append((q, value))
        return results

    # ---- statements --------------------------------------------------------

    def exec(self, path, n) -> list:
        k = n['kind']
        if k == 'CompoundStmt':
            paths = [path]
            for c in n.get('inner', []):
                paths = seq(paths, lambda p, c=c: self.exec(p, c))
            return paths
        if k == 'DeclStmt':
            paths = [path]
            for d in n['inner']:
                paths = seq(paths, lambda p, d=d: self._declare(p, d))
            return paths
        if k == 'IfStmt':
            cond, then = n['inner'][0], n['inner'][1]
            other = n['inner'][2] if n.get('hasElse') else None
            out = []
            for p, v in self.eval(path, cond):
                for p2, taken in self.m.branch(p, self.truth(v)):
                    if taken:
                        out.extend(self.exec(p2, then))
                    elif other is not None:
                        out.extend(self.exec(p2, other))
                    else:
                        out.append(p2)
            return out
        if k == 'WhileStmt':
            return self._while(path, n)
        if k == 'ReturnStmt':
            out = []
            if n.get('inner'):
                for p, v in self.eval(path, n['inner'][0]):
                    p.ret, p.returned = v, True
                    out.append(p)
                return out
            path.returned = True
            return [path]
        if k == 'NullStmt':
            return [path]
        return [p for p, _ in self.eval(path, n)]

    def _declare(self, path, d):
        if d['kind'] != 'VarDecl':
            raise Unsupported(d['kind'])
        name = d['name']
        if d['type']['qualType'].endswith(']'):
            path.env[name] = CBuf()
            return [path]
        t = ctype(d['type'])
        if not d.get('inner'):
            v = self.m.world.fresh(f'uninit_{name}')
            path.pc.append(in_range(v, t))
            path.env[name] = CVal(v, t)
            return [path]
        out = []
        for p, v in self.eval(path, d['inner'][0]):
            p.env[name] = CVal(self.conv(p, v.v, v.t, t), t)
            out.append(p)
        return out

    def _while(self, path, n):
        cond, body = n['inner']
        fn_name, _, ordinals = self.stack[-1]

        def cond_fn(p):
            return [(p2, self.truth(v)) for p2, v in self.eval(p, cond)]

        def body_fn(p):
            return self.exec(p, body)

        def view_fn(p):
            return {k: v.v for k, v in p.env.items() if isinstance(v, CVal)}

        def havoc_fn(p, name):
            old = p.env[name]
            v = self.m.world.fresh(name)
            p.pc.append(in_range(v, old.t))
            p.env[name] = CVal(v, old.t)

        modset = _assigned(cond) | _assigned(body)
        return self.m.run_loop([path], (fn_name, ordinals[id(n)]), cond_fn, body_fn,
                               lambda: modset, view_fn, havoc_fn, self.where(n))

    # ---- expressions -------------------------------------------------------

    @staticmethod
    def truth(v):
        if isinstance(v, CVal):
            return v.v != 0
        if isinstance(v, CPtr):
            return z3.BoolVal(v.nonnull)
        raise Unsupported(f'truth value of {v}')

    def eval_list(self, path, nodes):
        results = [(path, [])]
        for node in nodes:
            nxt = []
            for p, vals in results:
                for p2, v in self.eval(p, node):
                    nxt.append((p2, vals + [v]))
            results = nxt
        return results

    def eval(self, path, n) -> list:
        k = n['kind']
        if k in ('ParenExpr', 'ConstantExpr'):
            return self.eval(path, n['inner'][0])
        if k in ('ImplicitCastExpr', 'CStyleCastExpr'):
            return self._cast(path, n)
        if k in ('IntegerLiteral', 'CharacterLiteral'):
            return [(path, CVal(z3.IntVal(int(n['value'])), ctype(n['type'])))]
        if k == 'StringLiteral':
            return [(path, CStr(json.loads(n['value'])))]
        if k == 'PredefinedExpr':
            return [(path, CStr(n.get('name', '__func__')))]
        if k == 'DeclRefExpr':
            return [(path, self._ref(path, n))]
        if k == 'MemberExpr':
            base = _unwrap(n['inner'][0])
            if base['kind'] == 'DeclRefExpr' and base['referencedDecl']['name'] not in path.env:
                key = f"{base['referencedDecl']['name']}.{n['name']}"
                if key in self.m.world.c_state:
                    sym, t = self.m.world.c_state[key]
                    return [(path, CVal(sym, t))]
            raise Unsupported(f'member access {n["name"]}')
        if k == 'BinaryOperator':
            return self._binary(path, n)
        if k == 'CompoundAssignOperator':
            return self._compound(path, n)
        if k == 'UnaryOperator':
            return self._unary(path, n)
        if k == 'ConditionalOperator':
            out = []
            for p, c in self.eval(path, n['inner'][0]):
                for p2, taken in self.m.branch(p, self.truth(c)):
                    out.extend(self.eval(p2, n['inner'][1 if taken else 2]))
            return out
        if k == 'CallExpr':
            return self._call_expr(path, n)
        if k == 'UnaryExprOrTypeTraitExpr':
            return [(path, CVal(z3.IntVal(0), (64, False)))]
        raise Unsupported(f'C expression {k} at {self.where(n)}')

    def _ref(self, path, n):
        decl = n['referencedDecl']
        name = decl['name']
        if decl['kind'] in ('ParmVarDecl', 'VarDecl'):
            if name in path.env:
                return path.env[name]
            if name in self.m.world.c_globals:
                return self.m.world.c_globals[name]
            raise Unsupported(f'unmodeled C global {name}')
        if decl['kind'] == 'EnumConstantDecl':
            return CVal(z3.IntVal(self.front.enum_value(name)), (32, True))
        if decl['kind'] == 'FunctionDecl':
            return CFn(name)
        raise Unsupported(decl['kind'])

    def _cast(self, path, n):
        kind = n['castKind']
        out = []
        for p, v in self.eval(path, n['inner'][0]):
            if kind in ('LValueToRValue', 'NoOp', 'FunctionToPointerDecay', 'BuiltinFnToFnPtr',
                        'ArrayToPointerDecay', 'BitCast'):
                out.append((p, v))
            elif kind in ('IntegralCast', 'IntegralToBoolean'):
                t = (1, False) if kind == 'IntegralToBoolean' else ctype(n['type'])
                out.append((p, CVal(self.conv(p, v.v, v.t, t), t)))
            elif kind == 'PointerToBoolean':
                out.append((p, CVal(z3.If(self.truth(v), 1, 0), (1, False))))
            else:
                raise Unsupported(f'cast {kind} at {self.where(n)}')
        return out

    def _arith(self, path, op, a, b, t, node):
        where = self.where(node)
        bits, signed = t
        if op in ('/', '%'):
            self.m.oblige(path, b != 0, f'C division by zero ({op})', where)
            if signed:
                r = self.m.tdiv(path, a, b) if op == '/' else self.m.trem(path, a, b)
            else:
                r = a / b if op == '/' else a % b
        elif op == '+':
            r = a + b
        elif op == '-':
            r = a - b
        elif op == '*':
            r = a * b
        else:
            raise Unsupported(f'C operator {op}')
        if signed:
            self.m.oblige(path, in_range(r, t), f'C signed overflow in {op}', where)
            return r
        return r if self.m.proves(path, in_range(r, t)) else r % (2 ** bits)

    def _binary(self, path, n):
        op = n['opcode']
        left, right = n['inner']
        if op == '=':
            target = _unwrap(left)
            out = []
            for p, v in self.eval(path, right):
                old = p.env[target['referencedDecl']['name']]
                v = CVal(self.conv(p, v.v, v.t, old.t), old.t)
                p.env[target['referencedDecl']['name']] = v
                out.append((p, v))
            return out
        if op in ('&&', '||'):
            out = []
            for p, a in self.eval(path, left):
                for p2, taken in self.m.branch(p, self.truth(a)):
                    if taken == (op == '||'):
                        out.append((p2, CVal(z3.IntVal(1 if taken else 0), (32, True))))
                    else:
                        for p3, b in self.eval(p2, right):
                            out.append((p3, CVal(z3.If(self.truth(b), 1, 0), (32, True))))
            return out
        out = []
        for p, (a, b) in self.eval_list(path, [left, right]):
            if op == ',':
                out.append((p, b))
                continue
            if op in ('<', '<=', '>', '>=', '==', '!='):
                c = {'<': a.v < b.v, '<=': a.v <= b.v, '>': a.v > b.v, '>=': a.v >= b.v,
                     '==': a.v == b.v, '!=': a.v != b.v}[op]
                out.append((p, CVal(z3.If(c, 1, 0), (32, True))))
                continue
            t = ctype(n['type'])
            out.append((p, CVal(self._arith(p, op, a.v, b.v, t, n), t)))
        return out

    def _compound(self, path, n):
        op = n['opcode'][:-1]
        target = _unwrap(n['inner'][0])
        name = target['referencedDecl']['name']
        lhs_t, res_t = ctype(n['computeLHSType']), ctype(n['computeResultType'])
        out = []
        for p, b in self.eval(path, n['inner'][1]):
            old = p.env[name]
            a = self.conv(p, old.v, old.t, lhs_t)
            r = self._arith(p, op, a, self.conv(p, b.v, b.t, res_t), res_t, n)
            v = CVal(self.conv(p, r, res_t, old.t), old.t)
            p.env[name] = v
            out.append((p, v))
        return out

    def _unary(self, path, n):
        op = n['opcode']
        operand = n['inner'][0]
        if op == '&':
            return [(path, self._address(path, operand))]
        if op in ('++', '--'):
            name = _unwrap(operand)['referencedDecl']['name']
            old = path.env[name]
            new = self._arith(path, '+' if op == '++' else '-', old.v, z3.IntVal(1), old.t, n)
            path.env[name] = CVal(new, old.t)
            return [(path, old if n.get('isPostfix') else path.env[name])]
        out = []
        for p, v in self.eval(path, operand):
            t = ctype(n['type'])
            if op == '-':
                out.append((p, CVal(self._arith(p, '-', z3.IntVal(0), v.v, t, n), t)))
            elif op == '+':
                out.append((p, v))
            elif op == '!':
                out.append((p, CVal(z3.If(self.truth(v), 0, 1), t)))
            else:
                raise Unsupported(f'C unary {op}')
        return out

    def _address(self, path, operand):
        """&rnglist[i].rng_state names random stream i (rnd.c's rnglist[])."""
        node = _unwrap(operand)
        if node['kind'] == 'MemberExpr' and node['name'] == 'rng_state':
            sub = _unwrap(node['inner'][0])
            if sub['kind'] == 'ArraySubscriptExpr' and _unwrap(sub['inner'][0])['referencedDecl']['name'] == 'rnglist':
                [(_, index)] = self.eval(path, sub['inner'][1])
                index = z3.simplify(index.v)
                if z3.is_int_value(index):
                    return CCtx(index.as_long())
        raise Unsupported(f'address-of at {self.where(operand)}')

    def _call_expr(self, path, n):
        callee = _unwrap(n['inner'][0])
        if callee['kind'] != 'DeclRefExpr':
            raise Unsupported('indirect call')
        name = callee['referencedDecl']['name']
        arg_nodes = n['inner'][1:]
        out = []
        for p, args in self.eval_list(path, arg_nodes):
            out.extend(self._invoke(p, name, args, arg_nodes, n))
        return out

    def _invoke(self, p, name, args, arg_nodes, n):
        where = self.where(n)
        if name == 'abs':
            [a] = args
            self.m.oblige(p, a.v != -(2 ** 31), 'C abs(INT_MIN)', where)
            return [(p, CVal(z3.If(a.v < 0, -a.v, a.v), (32, True)))]
        if name == 'rng_log_enabled':
            return [(p, CVal(z3.IntVal(1 if self.m.world.logging else 0), (1, False)))]
        if name == '__builtin_object_size':
            return [(p, CVal(z3.IntVal(2 ** 64 - 1), (64, False)))]
        if name == 'rng_log_set_caller':
            return [(p, None)]   # caller annotation only; not part of the scored log
        if name == 'isaac64_next_uint64':
            [ctx] = args
            return [(p, CVal(self.m.draw(p, STREAMS[ctx.index]), (64, False)))]
        if name in ('__builtin___snprintf_chk', 'snprintf'):
            buf_node = _unwrap(arg_nodes[0])
            fmt_index = 4 if name.startswith('__builtin') else 2
            fmt = args[fmt_index].s
            p.env[buf_node['referencedDecl']['name']] = CFmt(fmt, tuple(a.v for a in args[fmt_index + 1:]))
            return [(p, CVal(z3.IntVal(0), (32, True)))]
        if name == 'rng_log_write':
            func, buf, result = args
            if buf.fmt.replace('%d', '').count('%'):
                raise Unsupported(f'log format {buf.fmt}')
            shape = f"{func.s}({buf.fmt.replace('%d', '{}')})={{}}"
            p.events.append(Event(shape, buf.values + (result.v,)))
            return [(p, None)]
        return self.call(p, name, args)
