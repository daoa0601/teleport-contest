"""Entry relations for hero, game-table and bounded heap state.

These are assumptions about an entry state. Function bodies execute from
their real ASTs, except the explicit dungeon-difficulty call contract below.
"""
import z3

from core import Machine, Unsupported, select_int
from csym import CArray, CElement, CExec, CPtr, CState, CVal
from jssym import JSExec, V

LONG = (64, True)   # C long on the recorder's LP64 target

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
    world.c_calls['level_difficulty'] = [([], CVal(difficulty, (16, True)))]
    world.js_calls[('js/dungeon.js', 'level_difficulty')] = [([], V('num', difficulty))]
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


def symbolic_attacks(world, front, modules):
    """One related permonst/JS row, with six fully symbolic attack records.

    Only the attack array is related. No initial mons[] data or assumption
    about which species can have an attack is used by these claims.
    """
    world.join_paths = True
    slots = tuple(CState(f'attack[{i}]') for i in range(6))
    world.c_globals['permonst.mattk'] = CArray(slots)
    row = V('array', tuple(V('array', tuple(V('num', world.c_state[f'attack[{i}].{field}'][0])
                                            for field in ('aatyp', 'adtyp', 'damn', 'damd')))
                           for i in range(6)))
    world.js_constants[('js/monster_data.js', 'MONSTER_ATTACKS')] = V('array', (row,))


def symbolic_attack_arguments(c_args, record_arg):
    def arguments(world, front):
        present = next(value for name, value, _ in world.params if name == 'native_pointer_present')
        pointer = CPtr(present != 0, 'permonst')
        species = V('num', z3.IntVal(0))
        return ([pointer] + c_args,
                [V('record', {'mnum': species}) if record_arg else species])
    return arguments


AT_ENGL = 11   # include/monattk.h and emitted monster_attack_types.js
AT_WEAP = 254  # include/monattk.h

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

# ---- carrying capacity (hack.c weight_cap and the inventory chain) ----

# include/prop.h
W_ARMC = 0x2
W_ARMF = 0x20
W_RING = 0x00060000
FROMOUTSIDE = 0x04000000
I_SPECIAL = 0x20000000
TIMEOUT = 0x00FFFFFF
LEFT_RING = 0x00020000
RIGHT_RING = 0x00040000
TT_PIT = 2          # you.h enum utraptypes
M1_FLY = 0x01       # monflag.h M1_FLY
MAX_CARR_CAP = 1000


def _property_masks(world, front):
    """Allocate the property slots populated by the capacity relation."""
    size = front.enum_value('LAST_PROP') + 1
    world.c_globals['u.uprops'] = CArray(tuple(CState(f'u.uprops[{i}]') for i in range(size)))


def _add_bit(term, bit):
    if z3.is_int_value(term):
        return z3.IntVal(term.as_long() + bit)
    return z3.If(term.arg(0), _add_bit(term.arg(1), bit), _add_bit(term.arg(2), bit))


def _mask(*parts):
    """A property mask as nested Ifs over the lumped 0/1 flags, with constant
    leaves: a bitwise test against one bit then folds to the flag itself."""
    if not parts:
        return z3.IntVal(0)
    flag, bit = parts[0]
    rest = _mask(*parts[1:])
    return z3.If(flag, _add_bit(rest, bit), rest)


def _levitation_flags(s):
    """The lumped 0/1 entry symbols shared by both sides."""
    stuck = z3.And(s['u.utrap'] != 0, s['u.utraptype'] != TT_PIT)
    levitation = z3.Or(s['h_lev'] == 1, z3.Or(s['e_boot'] == 1, s['e_other'] == 1))
    flying = z3.Or(s['h_fly'] == 1, s['e_fly'] == 1)
    return {
        'h_lev': s['h_lev'] == 1, 'e_boot': s['e_boot'] == 1, 'e_other': s['e_other'] == 1,
        'terr_lev': s['terr_lev'] == 1, 'h_fly': s['h_fly'] == 1, 'e_fly': s['e_fly'] == 1,
        'terr_fly': s['terr_fly'] == 1, 'legs_left': s['legs_left'] == 1,
        'legs_right': s['legs_right'] == 1, 'trap_lev0': s['trap_lev0'] == 1,
        'trap_fly0': s['trap_fly0'] == 1,
        'stuck': stuck, 'levitation': levitation, 'flying': flying,
    }


def _property_record(intrinsic, worn_boot, worn_other, terrain):
    """One JS _propertySources record over the lumped entry booleans. Every
    permanent intrinsic origin and the levitation timeout are folded into
    `intrinsic`; every non-boot worn source, invoked and carried artifact is
    folded into `worn_other` (all such reads are disjunctions)."""
    boot_source = V('record', {'slot': V('str', 'uarmf')})
    other_source = V('record', {'slot': V('str', 'uarmc')})
    return V('record', {
        'intrinsic': V('choice', [
            (intrinsic, V('record', {'outside': V('num', z3.IntVal(1))})),
            (z3.Not(intrinsic), V('record', {})),
        ]),
        'worn': V('choice', [
            (z3.And(worn_boot, worn_other), V('array', (boot_source, other_source))),
            (z3.And(worn_boot, z3.Not(worn_other)), V('array', (boot_source,))),
            (z3.And(z3.Not(worn_boot), worn_other), V('array', (other_source,))),
            (z3.And(z3.Not(worn_boot), z3.Not(worn_other)), V('array', ())),
        ]),
        'invoked': V('null'),
        'carried': V('array', ()),
        'blockedByTerrain': V('bool', terrain),
    })


def capacity_state(world, front, modules):
    """Entry relation for hack.c:weight_cap() and its callers.

    The C property masks and the JS _propertySources records are related by
    the lumped entry booleans: one bit-slot for boot levitation (W_ARMF), one
    for every other extrinsic source, one for any intrinsic or timed source,
    and the FROMOUTSIDE/I_SPECIAL block bits. The trap-block bits satisfy the
    float_vs_flight()/steed_vs_stealth() invariants at entry, which is what
    makes weight_cap's temporary clears restore them exactly.
    """
    world.join_paths = True
    hero_state(world, front, modules)
    _property_masks(world, front)
    _capacity_attributes(world)
    symbols = {name: value for name, (value, _) in world.c_state.items()}
    flags = _levitation_flags(symbols)
    # The C side reads the mask terms themselves, so every bit test inside
    # weight_cap folds over the lumped flags instead of mixing a raw symbol
    # with bit vectors.
    lev = front.enum_value('LEVITATION')
    fly = front.enum_value('FLYING')
    world.c_globals[f'u.uprops[{lev}].intrinsic'] = CVal(_mask((flags['h_lev'], TIMEOUT)), LONG)
    world.c_globals[f'u.uprops[{lev}].extrinsic'] = CVal(
        _mask((flags['e_boot'], W_ARMF), (flags['e_other'], W_RING)), LONG)
    world.c_globals[f'u.uprops[{lev}].blocked'] = CVal(
        _mask((flags['terr_lev'], FROMOUTSIDE), (flags['trap_lev0'], I_SPECIAL)), LONG)
    world.c_globals[f'u.uprops[{fly}].intrinsic'] = CVal(_mask((flags['h_fly'], TIMEOUT)), LONG)
    world.c_globals[f'u.uprops[{fly}].extrinsic'] = CVal(_mask((flags['e_fly'], W_ARMC)), LONG)
    world.c_globals[f'u.uprops[{fly}].blocked'] = CVal(
        _mask((flags['terr_fly'], FROMOUTSIDE), (flags['trap_fly0'], I_SPECIAL)), LONG)
    legs = front.enum_value('WOUNDED_LEGS')
    world.c_globals[f'u.uprops[{legs}].extrinsic'] = CVal(
        _mask((flags['legs_left'], LEFT_RING), (flags['legs_right'], RIGHT_RING)), LONG)

    # Function-pointer comparison: ga.afternmv == Boots_on.
    boots_pending = z3.Int('boots_pending')
    world.pre.extend([z3.Or(boots_pending == 0, boots_pending == 1)])
    world.fn_identities['Boots_on'] = 1
    world.c_globals['ga.afternmv'] = CPtr(True, 'ga.afternmv',
                                          z3.If(boots_pending == 1, z3.IntVal(1), z3.IntVal(2)))
    world.js_values['game._afterMove'] = V('choice', [
        (boots_pending == 1, V('record', {'kind': V('str', 'wear'),
                                          'object': V('obj', 'boots')})),
        (boots_pending == 0, V('null'))])
    world.js_values['game.uarmf'] = V('obj', 'boots')
    world.js_values['game.u.uarmf'] = V('obj', 'boots')

    # Steed: same/absent mount, with its species symbolic over mons[].
    steed_present = z3.Int('steed_present')
    steed_mnum = z3.Int('steed_mnum')
    world.pre.extend([z3.Or(steed_present == 0, steed_present == 1),
                      steed_mnum >= 0, steed_mnum < front.enum_value('NUMMONS')])
    present = steed_present == 1
    steed_flies = _native_predicate(world, front, 'mflags1', steed_mnum, M1_FLY)
    world.c_globals['u.usteed'] = CPtr(present, 'steed')
    world.c_globals['steed.data'] = CPtr(True, CElement('mons', steed_mnum))
    world.js_values['game.u.usteed'] = V('choice', [
        (present, V('record', {'mnum': V('num', steed_mnum)})),
        (z3.Not(present), V('null'))])

    # JS property records over the lumped source booleans.
    world.js_values['game.u._propertySources.levitation'] = _property_record(
        flags['h_lev'], flags['e_boot'], flags['e_other'], flags['terr_lev'])
    world.js_values['game.u._propertySources.flying'] = _property_record(
        flags['h_fly'], z3.BoolVal(False), flags['e_fly'], flags['terr_fly'])
    world.js_state['game.u.levitationTurns'] = z3.If(flags['h_lev'], 1, 0)
    world.js_state['game.u.flyingTurns'] = z3.If(flags['h_fly'], 1, 0)

    # Projected movement booleans (properties.ts:projectProperty).
    flying_active = z3.And(z3.Or(flags['flying'], z3.And(present, steed_flies)),
                           z3.Not(flags['terr_fly']),
                           z3.Not(z3.Or(flags['levitation'],
                                        z3.And(flags['flying'], flags['stuck']))))
    levitating_active = z3.And(flags['levitation'], z3.Not(flags['terr_lev']),
                               z3.Not(flags['stuck']))
    world.js_state['game.u.flying'] = z3.If(flying_active, 1, 0)
    world.js_state['game.flying'] = z3.If(flying_active, 1, 0)
    world.js_state['game.u.levitating'] = z3.If(levitating_active, 1, 0)
    world.js_state['game.u.levitation'] = z3.If(levitating_active, 1, 0)
    world.js_state['game.levitating'] = z3.If(levitating_active, 1, 0)
    stealth = front.enum_value('STEALTH')
    world.c_globals[f'u.uprops[{stealth}].blocked'] = CVal(_mask((
        z3.And(present, z3.Not(flying_active), z3.Not(levitating_active)), FROMOUTSIDE)), LONG)
    world.c_globals['disp.botl'] = CVal(z3.IntVal(1), (8, True))
    # Symbolic enum names name the same cells in the restoration contract.
    for prop, fields in (('LEVITATION', ('extrinsic', 'blocked')),
                         ('FLYING', ('blocked',)), ('STEALTH', ('blocked',))):
        for field in fields:
            world.c_globals[f'u.uprops[{prop}].{field}'] = world.c_globals[
                f'u.uprops[{front.enum_value(prop)}].{field}']
    world.js_state['game.u.utrap'] = symbols['u.utrap']
    world.js_state['game.u.utraptype'] = symbols['u.utraptype']

    # Wounded legs: C keeps two side bits; the port keeps one side field.
    world.js_choices['game.u._woundedLegSide'] = [
        (z3.And(flags['legs_left'], flags['legs_right']), 'both'),
        (z3.And(flags['legs_left'], z3.Not(flags['legs_right'])), 'left'),
        (z3.And(z3.Not(flags['legs_left']), flags['legs_right']), 'right'),
        (z3.And(z3.Not(flags['legs_left']), z3.Not(flags['legs_right'])), ''),
    ]

    # Air level identity: both sides compare dnum/dlevel pairs themselves.
    # hack.h's air_level macro expands to svd.dungeon_topology.d_air_level.
    air = 'svd.dungeon_topology.d_air_level'
    for key in ('u.uz.dnum', 'u.uz.dlevel', f'{air}.dnum', f'{air}.dlevel'):
        world.c_globals[key] = CVal(world.c_state[key][0], world.c_state[key][1])
    world.js_values['game.u.uz'] = V('record', {
        'dnum': V('num', world.c_state['u.uz.dnum'][0]),
        'dlevel': V('num', world.c_state['u.uz.dlevel'][0])})
    world.js_values['game.air_level'] = V('record', {
        'dnum': V('num', world.c_state[f'{air}.dnum'][0]),
        'dlevel': V('num', world.c_state[f'{air}.dlevel'][0])})
    world.pre.append(z3.Or(world.c_state[f'{air}.dnum'][0] != 0,
                           world.c_state[f'{air}.dlevel'][0] != 0))

    # Entry invariant float_vs_flight() maintains for the trap-block bits.
    world.pre.extend([
        flags['trap_lev0'] == z3.And(flags['levitation'], flags['stuck']),
        flags['trap_fly0'] == z3.Or(flags['levitation'],
                                    z3.And(flags['flying'], flags['stuck'])),
    ])
    # The polymorph timer is the port's Upolyd flag.
    world.js_state['game.u.mtimedone'] = z3.If(
        symbols['u.umonnum'] != symbols['u.umonster'], 1, 0)


def _native_predicate(world, front, member, species, mask):
    """(mons[species].member & mask) != 0, as a disjunction of species
    indices; constant-table predicates stay in the arithmetic fragment."""
    mons = world.c_globals['mons']
    executor = CExec(Machine(world, 'c'), front)
    path = executor.m.start_path()
    flagged = []
    for index, record in enumerate(mons.values):
        value = z3.simplify(executor._record_member(path, record, member).v)
        if not z3.is_int_value(value):
            raise Unsupported(f'native {member} initializer is not constant')
        if value.as_long() & mask:
            flagged.append(index)
    return z3.Or([species == z3.IntVal(index) for index in flagged])


def inventory_state(world, front, modules):
    """The hero inventory as a bounded nobj chain (length 0..MAX_CHAIN)
    mirrored by the emitted inventory array of the same length.

    Every non-coin, non-skipped object's cached owt equals its initial
    metadata weight times quantity —
    the fresh-cache invariant C maintains through mkobj.c:weight(). Objects
    with species-dependent weights, container contents or enchantment are
    outside this domain."""
    capacity_state(world, front, modules)
    chain = world.c_state['chain'][0]
    length = z3.simplify(chain)
    if not z3.is_int_value(length) or not 0 <= length.as_long() <= MAX_CHAIN:
        raise Unsupported('inventory chain length must be a fixed partition value')
    length = length.as_long()
    capacity = z3.Int('weight_cap()')
    world.pre.extend([capacity >= 1, capacity <= MAX_CARR_CAP])
    world.c_calls['weight_cap'] = [([], CVal(capacity, (32, True)))]
    world.js_calls[('js/weight.js', 'weightCapacity')] = [([V('obj', 'game')], V('num', capacity))]
    world.c_globals['gw.wc'] = CVal(z3.IntVal(0), (32, True))
    world.c_globals['invent'] = CArray(
        tuple(CState(f'invent[{i}]') for i in range(MAX_CHAIN + 1)))
    world.c_globals['gi.invent'] = CPtr(chain > 0, CElement('invent', z3.IntVal(0)))
    for i in range(MAX_CHAIN):
        world.c_globals[f'invent[{i}].nobj'] = CPtr(chain > i + 1, CElement('invent', z3.IntVal(i + 1)))
    world.c_globals[f'invent[{MAX_CHAIN}].nobj'] = CPtr(False)

    table = module_constant(world, modules, 'js/object_data.js', 'OBJECT_WEIGHT')
    if table.kind != 'array':
        raise Unsupported('object weight table is not an array')
    object_types = len(table.v)

    def constant(name):
        value = module_constant(world, modules, 'js/object_data.js', name)
        return z3.simplify(value.v).as_long()

    # Four ordinary stack types keep the entry relation small while covering
    # coins, skipped boulders, a weapon and food. The type itself is symbolic
    # at every slot, so every ordering of these cases is included.
    allowed = [(constant(name), oclass) for name, oclass in (
        ('GOLD_PIECE', 12), ('BOULDER', 13), ('DAGGER', 2), ('FOOD_RATION', 7))]
    boulder = constant('BOULDER')
    types = []
    for i in range(length):
        original = world.c_state[f'invent[{i}].otyp'][0]
        world.pre.append(z3.Or(*(original == otyp for otyp, _ in allowed)))
        otyp = z3.IntVal(allowed[-1][0])
        oclass = z3.IntVal(allowed[-1][1])
        for native_type, native_class in reversed(allowed[:-1]):
            otyp = z3.If(original == native_type, native_type, otyp)
            oclass = z3.If(original == native_type, native_class, oclass)
        types.append(otyp)
        world.c_globals[f'invent[{i}].otyp'] = CVal(otyp, (16, True))
        world.pre.append(world.c_state[f'invent[{i}].oclass'][0] == oclass)

    objects = []
    for i in range(length):
        objects.append(V('record', {
            'otyp': V('num', types[i]),
            'oclass': V('num', world.c_state[f'invent[{i}].oclass'][0]),
            'quan': V('num', world.c_state[f'invent[{i}].quan'][0]),
            'owt': V('num', world.c_state[f'invent[{i}].owt'][0]),
            'oeaten': V('num', world.c_state[f'invent[{i}].oeaten'][0]),
        }))
    world.js_values['game.inventory'] = V('array', tuple(objects))

    # The fresh-cache assumption relates native owt to ordinary stack mass.
    throws_rocks = _native_predicate(world, front, 'mflags2',
                                     world.c_state['u.umonnum'][0], M2_ROCKTHROW)
    for i in range(length):
        otyp = types[i]
        oclass = world.c_state[f'invent[{i}].oclass'][0]
        world.pre.extend([otyp >= 0, otyp < object_types]
                         + [world.c_state[f'invent[{i}].quan'][0] >= 0,
                            world.c_state[f'invent[{i}].quan'][0] <= 100000,
                            world.c_state[f'invent[{i}].owt'][0] >= 0,
                            world.c_state[f'invent[{i}].owt'][0] <= 100000])
        # Fresh-cache relation, independent of the implementation under test.
        # These four types use ordinary table weight times quantity in C;
        # the coin and rock-throwing cases bypass owt in inv_weight itself.
        base = select_int([entry.v for entry in table.v], otyp)
        term = base * world.c_state[f'invent[{i}].quan'][0]
        coin = oclass == 12
        skipped = z3.And(otyp == boulder, throws_rocks)
        if 'inventory-cache' not in world.unrelated_state:
            world.pre.append(z3.Implies(z3.And(z3.Not(coin), z3.Not(skipped)),
                                        world.c_state[f'invent[{i}].owt'][0] == term))


MAX_CHAIN = 4
M2_ROCKTHROW = 0x08000000  # monflag.h


def capacity_arguments(world, front):
    extra = [CVal(value, declared) for name, value, declared in world.params if name == 'xtra_wt']
    return (extra, [V('obj', 'game')] + [V('num', value.v) for value in extra])


def sign_state(world, front, modules):
    world.js_locals.update({'target': V('obj', 'target'),
                            'monster': V('record', {'mx': V('num', z3.IntVal(0))})})


def sign_arguments(world, front):
    return ([CVal(world.c_state['target.x'][0], (32, True))], [])


def _capacity_attributes(world):
    # acurr:all proves equal pure attributes in 3..125 for every valid index.
    # Keep acurrstr/currentStrength in the proof: they condense raw Strength.
    strength, constitution = z3.Ints('capacity_strength capacity_constitution')
    world.pre.extend([strength >= 3, strength <= 125, constitution >= 3, constitution <= 125])
    js_strength = strength
    if 'capacity-strength' in world.unrelated_state:
        js_strength = z3.Int('js_capacity_strength')
        world.pre.extend([js_strength >= 3, js_strength <= 125])
        world.js_state['capacity_strength'] = js_strength
    # attrib.h: A_STR = 0 and A_CON = 4.
    world.c_calls['acurr'] = [([CVal(z3.IntVal(index), (32, True))], CVal(value, (32, True)))
                              for index, value in ((0, strength), (4, constitution))]
    world.js_calls[('js/attrib.js', 'currentAttribute')] = [
        ([V('num', z3.IntVal(index)), V('obj', 'game')], V('num', value))
        for index, value in ((0, js_strength), (4, constitution))]
