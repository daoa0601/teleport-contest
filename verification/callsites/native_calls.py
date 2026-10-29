"""Show native RNG calls for review, using clang's typed AST.

This is an audit aid, not a proof of caller correspondence. Macro call
locations use clang's expansion location. No C expression is parsed as text.

    uv run ../callsites/native_calls.py eat.c:bounded_increase
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'equivalence'))
from cfront import CFront

DRAWS = {'rn2', 'rnd', 'rn1', 'rnl', 'd', 'rne', 'rnz', 'rn2_on_display_rng'}


def children(node):
    return node.get('inner', [])


def expression(node):
    kind, inner = node.get('kind'), children(node)
    if kind in ('ImplicitCastExpr', 'ParenExpr', 'CStyleCastExpr', 'ConstantExpr') and inner:
        return expression(inner[0])
    if kind == 'DeclRefExpr':
        return node['referencedDecl']['name']
    if kind == 'IntegerLiteral':
        return node['value']
    if kind == 'MemberExpr':
        return expression(inner[0]) + ('->' if node['isArrow'] else '.') + node['name']
    if kind == 'ArraySubscriptExpr':
        return f'{expression(inner[0])}[{expression(inner[1])}]'
    if kind == 'BinaryOperator':
        return f'({expression(inner[0])} {node["opcode"]} {expression(inner[1])})'
    if kind == 'UnaryOperator':
        return f'{node["opcode"]}({expression(inner[0])})'
    if kind == 'ConditionalOperator':
        return f'({expression(inner[0])} ? {expression(inner[1])} : {expression(inner[2])})'
    if kind == 'CallExpr':
        return f'{expression(inner[0])}({", ".join(expression(arg) for arg in inner[1:])})'
    return kind


def native_calls(front, file, fn):
    result = []

    def visit(node, guards):
        inner = children(node)
        if node.get('kind') == 'CallExpr' and inner and expression(inner[0]) in DRAWS:
            result.append({'source': front.line(file, node), 'call': expression(node), 'guards': guards})
        if node.get('kind') == 'IfStmt' and not node.get('hasInit') and not node.get('hasVar'):
            visit(inner[0], guards)
            visit(inner[1], [*guards, expression(inner[0])])
            if len(inner) > 2:
                visit(inner[2], [*guards, f'!({expression(inner[0])})'])
        else:
            for child in inner:
                visit(child, guards)

    visit(fn, [])
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('functions', nargs='+', help='Native file:function')
    options = parser.parse_args()
    recorder = Path(os.environ['NETHACK_RECORDER'])
    for target in options.functions:
        source, name = target.split(':')
        file = recorder / 'src' / source
        front = CFront(recorder, [file])
        fn, file = front.function(name)
        print(json.dumps({'function': target, 'definition': front.line(file, fn),
                          'calls': native_calls(front, file, fn)}), flush=True)


if __name__ == '__main__':
    main()
