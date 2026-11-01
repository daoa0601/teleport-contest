"""Read-only entry relations for initialized hero and game-table state.

These are assumptions about an entry state. Function bodies execute from
their real ASTs, except the explicit dungeon-difficulty call contract below.
"""
import z3

from core import Machine, Unsupported
from csym import CArray, CElement, CExec, CPtr, CState, CVal
from jssym import JSExec, V


def hero_state(world, front, modules):
    world.c_globals['mons'] = native_monsters(world, front)
    species = world.c_state['u.umonnum'][0]
    # polyself.c:set_uasmon installs this pointer for the current body.
    world.c_globals['gy.youmonst.data'] = CPtr(True, CElement('mons', species))
    world.pre.extend([species >= 0, species < front.enum_value('NUMMONS')])
    # artifacts.js:initializeArtifacts copies artifact identity/name from this
    # emitted table. Role/alignment retargeting does not change id or name.
    artifacts = module_constant(world, modules, 'js/artifact_data.js', 'ARTIFACT_DATA')
    world.js_values['game._artifactRuntime'] = V('map', tuple(
        (artifact.v['id'], artifact) for artifact in artifacts.v))


def hit_bonus_state(world, front, modules):
    hero_state(world, front, modules)
    # Conditional call contract: dungeon.c:level_difficulty and dungeon.js
    # compute the same read-only result. Their dungeon traversal/property
    # helpers are not part of this claim. The native return type is xint16.
    difficulty = z3.Int('level_difficulty()')
    world.pre.extend([difficulty >= 1, difficulty <= 32767])
    world.c_calls['level_difficulty'] = ([], CVal(difficulty, (16, True)))
    world.js_calls[('js/dungeon.js', 'level_difficulty')] = ([], V('num', difficulty))
    # monst.h: mvitals.died is uchar; only the Wizard entry is read by adj_lev.
    wizard = front.enum_value('PM_WIZARD_OF_YENDOR')
    deaths = world.c_state['svm.mvitals[PM_WIZARD_OF_YENDOR].died'][0]
    size = front.enum_value('NUMMONS')
    world.c_globals['svm.mvitals'] = CArray(tuple(CState(f'svm.mvitals[{i}]') for i in range(size)))
    world.c_globals[f'svm.mvitals[{wizard}].died'] = CVal(deaths, (8, False))
    vitals = []
    for index in range(size):
        count = deaths if index == wizard else z3.Int(f'mvitals[{index}].died')
        world.pre.extend([count >= 0, count <= 255])
        vitals.append(V('record', {'died': V('num', count)}))
    world.js_values['game.mvitals'] = V('array', tuple(vitals))


def monster_state(world, front, modules):
    species = next(value for name, value, _ in world.params if name == 'species')
    world.pre.extend([species >= 0, species < front.enum_value('NUMMONS')])
    world.c_globals['mons'] = native_monsters(world, front)
    world.c_globals['monster.data'] = CPtr(True, CElement('mons', species))
    world.js_state['monster.mnum'] = species


def species_predicate_state(world, front, modules):
    species = next(value for name, value, _ in world.params if name == 'species')
    world.c_globals['mons'] = native_monsters(world, front)
    world.pre.append(species < front.enum_value('NUMMONS'))


def species_predicate_arguments(world, front):
    values = {name: value for name, value, _ in world.params}
    pointer = CPtr(values['native_pointer_present'] != 0, CElement('mons', values['species']))
    return ([pointer], [V('num', values['species'])])


def experience_state(world, front, modules):
    monster_state(world, front, modules)
    # This table-pair claim covers monsters with no inventory. Execute the real
    # find_mac, including its base AC table read and cap, rather than summarize
    # the armor calculation. Equipped monsters remain a separate extension.
    world.c_globals['monster.minvent'] = CPtr(False)
    world.c_globals['monster.misc_worn_check'] = CVal(z3.IntVal(0), (64, True))
    size = front.enum_value('LAST_PROP') + 1
    breathing = front.enum_value('MAGICAL_BREATHING')
    world.c_globals['u.uprops'] = CArray(tuple(CState(f'u.uprops[{i}]') for i in range(size)))
    for field in ('intrinsic', 'extrinsic'):
        value = world.c_state[f'u.uprops[MAGICAL_BREATHING].{field}'][0]
        world.c_globals[f'u.uprops[{breathing}].{field}'] = CVal(value, (64, True))
    world.c_globals['gy.youmonst.data'] = CPtr(True, 'hero_form')
    world.c_globals['hero_form.mflags1'] = CVal(world.c_state['gy.youmonst.data.mflags1'][0], (64, False))
    executor = CExec(Machine(world, 'c'), front)
    paths = executor.run('verification_amphibious', [])
    if executor.m.obligations:
        raise Unsupported('amphibious argument relation has unchecked obligations')
    amphibious = z3.IntVal(0)
    for path in paths:
        amphibious = z3.If(z3.And(*path.pc), path.ret.v, amphibious)
    nk = next(value for name, value, _ in world.params if name == 'nk')
    world.js_values['experienceOptions'] = V('record', {
        'killCount': V('num', nk), 'amphibious': V('num', amphibious)})


def experience_arguments(world, front):
    nk = next(value for name, value, _ in world.params if name == 'nk')
    return ([CPtr(True, 'monster'), CVal(nk, (32, True))],
            [V('obj', 'monster'), world.js_values['experienceOptions']])


def movement_state(world, front, modules):
    monster_state(world, front, modules)
    values = {name: value for name, value, _ in world.params}
    speed_table = module_constant(world, modules, 'js/monster_data.js', 'MONSTER_MOVE')
    if speed_table.kind != 'array' or len(speed_table.v) != front.enum_value('NUMMONS'):
        raise Unsupported('movement table does not cover the native species domain')
    executor = JSExec(Machine(world, 'js'), modules, {})
    cached_speed = executor._select_values(speed_table.v, values['species'])
    if cached_speed.kind != 'num':
        raise Unsupported('movement table entry is not numeric')
    world.js_state['monster.mmove'] = cached_speed.v
    world.js_state['monster.movement'] = values['movement']
    riding = values['riding'] != 0
    present = values['steed_present'] != 0
    # Identity 1 is this monster, 2 is any other monster. No field of the
    # other mount is read, so its particular identity does not matter.
    identity = z3.If(riding, z3.IntVal(1), z3.IntVal(2))
    world.c_globals['u.usteed'] = CPtr(present, 'steed', identity)
    world.js_values['game.u.usteed'] = V('choice', [
        (riding, V('obj', 'monster')),
        (z3.And(present, z3.Not(riding)), V('obj', 'other_steed')),
        (z3.Not(present), V('null'))])


def movement_arguments(world, front):
    moving = next(value for name, value, _ in world.params if name == 'moving')
    return ([CPtr(True, 'monster', z3.IntVal(1)), CVal(moving, (8, False))],
            [V('obj', 'monster'), V('num', moving)])


def native_monsters(world, front):
    """monst.c:monst_globals_init copies mons_init into mons at startup.

    Assume the fields read by the claim retain those initial values. This
    excludes runtime quest retargeting and seduction-attack replacement.
    """
    file = front.include.parent / 'src' / 'monst.c'
    if file in front.initializers:
        return front.initializers[file]
    decl = front.initialized_array('mons_init', file)
    executor = CExec(Machine(world, 'c'), front)
    executor.stack.append(('<table>', file, {}))
    path = executor.m.start_path()
    results = executor.eval(path, decl['inner'][-1])
    if len(results) != 1 or results[0][0] is not path or not isinstance(results[0][1], CArray):
        raise Unsupported('native monster initializer did not produce one array')
    if executor.m.obligations:
        raise Unsupported('native monster initializer has unchecked arithmetic')
    front.initializers[file] = results[0][1]
    return results[0][1]


def module_constant(world, modules, label, name):
    executor = JSExec(Machine(world, 'js'), modules, {'game': V('obj', 'game')})
    path = executor.m.start_path()
    value = executor._module_value(path, label, name)
    if executor.m.obligations:
        raise Unsupported(f'constant {label}:{name} has unchecked arithmetic')
    return value
