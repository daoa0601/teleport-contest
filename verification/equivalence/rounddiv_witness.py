"""Evaluate the real AST expressions behind the wizard-glob denominator gap.

This checks expressions and rounddiv itself. It does not replay a wish or meal.
The path to these expressions is documented in docs/formal-verification.md.
"""
import z3

from cfront import CFront
from core import Machine, Unsupported, World
from csym import CExec, CPtr, CVal, _unwrap, _walk
from jssym import JSExec, V, _descendants, parse_module
from prove import REPO, _solve, load_modules, recorder_dir


def one(nodes, description):
    if len(nodes) != 1:
        raise Unsupported(f'expected one {description}, found {len(nodes)}')
    return nodes[0]


def checked_value(executor, path, node):
    results = executor.eval(path, node)
    path, value = one(results, 'expression outcome')
    for obligation in executor.m.obligations:
        result, _ = _solve(executor.m.world.pre + obligation.pc + [z3.Not(obligation.cond)])
        if result != z3.unsat:
            raise Unsupported(f'unproved witness obligation: {obligation.what} at {obligation.where}')
    return z3.simplify(value.v)


def native_assignment(front, function, field):
    declaration, file = front.function(function)
    candidates = []
    for node in _walk(declaration):
        if node['kind'] != 'BinaryOperator' or node['opcode'] != '=':
            continue
        target = _unwrap(node['inner'][0])
        name = target.get('name') if target['kind'] == 'MemberExpr' else target.get('referencedDecl', {}).get('name')
        if name == field:
            candidates.append(node['inner'][1])
    return one(candidates, f'{function} assignment to {field}'), file


def main():
    recorder = recorder_dir()
    front = CFront(recorder, [recorder / 'src' / name for name in ('eat.c', 'hack.c')])
    # objnam.c:readobjnam accepts this representable count in wizard mode,
    # after its explicit glob-weight override. A small glob weighs 20.
    # The 3072 margin past the signed boundary also leaves room for ordinary inventory
    # capacity subtractions before the meal (hack.c:inv_weight/max_capacity).
    count = 107_374_336
    weight = count * 20
    world = World(False, [], [], {}, {'food.owt': z3.IntVal(weight)}, {
        'food.owt': CVal(z3.IntVal(weight), (32, False)),
        'food.oeaten': CVal(z3.IntVal(weight), (32, False)),
        'food.otyp': CVal(z3.IntVal(front.enum_value('GLOB_OF_BROWN_PUDDING')), (16, True)),
        'food.globby': CVal(z3.IntVal(1), (32, False)),
    })
    native = CExec(Machine(world, 'c'), front)
    path = native.m.start_path()
    path.env.update({'glob': CVal(z3.IntVal(1), (8, False)), 'otmp': CPtr(True, 'food')})
    delay_node, file = native_assignment(front, 'eatcorpse', 'reqtime')
    native.stack.append(('eatcorpse', file, {}))
    delay = checked_value(native, path, delay_node)
    nutrition_node, file = native_assignment(front, 'doeat', 'basenutrit')
    native.stack[-1] = ('doeat', file, {})
    denominator = checked_value(native, path, nutrition_node)
    world.c_globals['svc.context.victual.reqtime'] = CVal(delay, (32, True))
    declaration, _ = front.function('doeat')
    calls = [node for node in _walk(declaration) if node['kind'] == 'CallExpr'
             and _unwrap(node['inner'][0]).get('referencedDecl', {}).get('name') == 'rounddiv']
    call = one(calls, 'doeat rounddiv call')
    numerator = checked_value(native, path, call['inner'][1])
    result = one(native.run('rounddiv', [CVal(numerator, (64, True)), CVal(denominator, (32, True))]), 'rounddiv outcome')
    for obligation in native.m.obligations:
        if _solve(world.pre + obligation.pc + [z3.Not(obligation.cond)])[0] != z3.unsat:
            raise Unsupported(f'unproved rounddiv obligation: {obligation.what}')

    modules = load_modules()
    label = 'js/corpse_meal.js'
    source = (REPO / label).read_bytes()
    modules[label] = (source, *parse_module(source))
    function = modules[label][1]['prepareCorpseMeal']
    assignments = [node for node in _descendants(function)
                   if node.type == 'assignment_expression'
                   and node.child_by_field_name('left').text == b'meal.reqtime']
    rhs = one(assignments, 'emitted meal delay assignment').child_by_field_name('right')
    emitted = JSExec(Machine(world, 'js'), modules, {})
    emitted.stack.append(('prepareCorpseMeal', label, {}))
    emitted.local_names.append({'glob', 'food'})
    js_path = emitted.m.start_path()
    js_path.env.update({'glob': V('bool', z3.BoolVal(True)), 'food': V('obj', 'food')})
    js_delay = checked_value(emitted, js_path, rhs)
    if not (z3.is_true(z3.simplify(denominator < 0)) and z3.is_true(z3.simplify(delay != js_delay))):
        raise Unsupported('the reported negative-denominator/shift witness no longer holds')
    print(f'wizard count={count}, glob weight/nutrition={weight}')
    print(f'eat.c:eatcorpse delay={delay}; {label}:prepareCorpseMeal delay={js_delay}')
    print(f'eat.c:doeat rounddiv numerator={numerator}, denominator={denominator}, result={z3.simplify(result.ret.v)}')
    print('Native obligations discharged; wish/meal reachability is a source audit, not a replay.')


if __name__ == '__main__':
    main()
