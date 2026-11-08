"""fv-equivalence-batch-14: cited single-owner predicate ports.

mondata.h macros over one mons[] row (is_whirly, is_rider, nonliving,
is_vampire, flesh_petrifies, passes_rocks, is_mplayer, is_unicorn, eyecount,
touch_petrifies, emits_light, vegan, vegetarian), mondata.c's
poly_when_stoned() over the stone-golem mvitals entry and
cvt_adtyp_to_mseenres() over the damage-type code, and the rm.h/trap.h
terrain macros IS_WALL/IS_OBSTRUCTED/IS_DOOR/is_pit/is_hole over one
terrain or trap type.
"""
import z3

from core import Unsupported, bit_int, bit_operation
from csym import CArray, CElement, CPtr, CState, CVal
from jssym import V
from specs import INT, LONG, SCHAR, Spec
from state_specs import PREDICATE_ASSUMPTIONS, species_predicate_arguments, \
    species_record_arguments
from state_world import module_constant, native_monsters, native_objects, \
    species_predicate_state

MONDATA = 'js/mondata.js'
FOOD_TRAITS = 'js/food_traits.js'
VISION = 'js/vision.js'
CONST = 'js/const.js'

PREDICATE_JS_FILES = (FOOD_TRAITS, VISION)


def species_spec(name, harness, port, js_file, record, mutant, pin,
                 null_probe=True):
    """One mons[] predicate: a native species pointer against the port's
    species index, over every valid species, with a mutation pinned to one
    species where the predicate is decided. is_mplayer drops the null probe:
    its ordered pointer comparison against a null argument is C undefined
    behavior with no native result to compare."""
    return Spec(
        f'{name}:tables', harness, port,
        [('species', INT), ('native_pointer_present', INT)],
        js_file=js_file, assumptions=PREDICATE_ASSUMPTIONS,
        require_counterexamples=True, configure=species_predicate_state,
        arguments=species_record_arguments if record else species_predicate_arguments,
        pre=lambda s: [s['species'] >= 0, s['native_pointer_present'] == 1],
        probes=[('null native species pointer', lambda s: [
            s['species'] >= 0, s['native_pointer_present'] == 0])] if null_probe else [],
        mutant_pre=lambda s, pin=pin: [s['species'] == pin],
        mutants=[(js_file, *mutant)],
    )


# The pinned monst.h species indices, checked against the pinned headers
# (every species claim also proves the index correspondence over the whole
# table, so a renumbered row fails its pin rather than the proof).
PM_GIANT_ANT = 0
PM_FLOATING_EYE = 28
PM_FOG_CLOUD = 106
PM_GRAY_UNICORN = 102
PM_VAMPIRE = 226
PM_FIRE_ELEMENTAL = 155
PM_STRAW_GOLEM = 249
PM_STONE_GOLEM = 257
PM_GHOST = 287
PM_MEDUSA = 284
PM_COCKATRICE = 10
PM_DEATH = 311
PM_MANES = 50
PM_YELLOW_LIGHT = 118
PM_LICHEN = 158
PM_BLACK_PUDDING = 209
PM_ARCHEOLOGIST = 331
PM_WIZARD = 343

PREDICATE_SPECS = [
    species_spec('touch_petrifies', 'verification_touch_petrifies',
                 'touchPetrifies', MONDATA, False,
                 ('return mnum === PM_CHICKATRICE || mnum === PM_COCKATRICE;',
                  'return mnum === PM_CHICKATRICE;'), PM_COCKATRICE),
    species_spec('flesh_petrifies', 'verification_flesh_petrifies',
                 'fleshPetrifies', MONDATA, False,
                 ('return touchPetrifies(mnum) || mnum === PM_MEDUSA;',
                  'return touchPetrifies(mnum);'), PM_MEDUSA),
    species_spec('is_whirly', 'verification_is_whirly',
                 'monsterIsWhirly', MONDATA, True,
                 ('|| MONSTER_SYMBOL[monster?.mnum ?? -1] === S_VORTEX;',
                  '|| MONSTER_SYMBOL[monster?.mnum ?? -1] === S_VORTEX + 1;'),
                 PM_FOG_CLOUD),
    species_spec('is_rider', 'verification_is_rider',
                 'monsterIsRider', MONDATA, True,
                 ('monster.mnum !== undefined && RIDER_SPECIES.has(monster.mnum);',
                  'monster.mnum !== undefined || RIDER_SPECIES.has(monster.mnum);'),
                 PM_GIANT_ANT),
    species_spec('nonliving', 'verification_nonliving',
                 'monsterIsNonliving', MONDATA, False,
                 ('|| mnum === PM_MANES', '|| mnum === PM_MEDUSA'),
                 PM_MANES),
    species_spec('is_vampire', 'verification_is_vampire',
                 'monsterIsVampire', MONDATA, False,
                 ('return MONSTER_SYMBOL[mnum] === S_VAMPIRE;',
                  'return MONSTER_SYMBOL[mnum] === S_VAMPIRE + 1;'),
                 PM_VAMPIRE),
    species_spec('passes_rocks', 'verification_passes_rocks',
                 'passes_rocks', MONDATA, False,
                 ('return monsterPassesWalls(mnum) && !monsterIsUnsolid({ mnum });',
                  'return monsterPassesWalls(mnum) || !monsterIsUnsolid({ mnum });'),
                 PM_GHOST),
    species_spec('is_mplayer', 'verification_is_mplayer',
                 'monsterIsPlayerMonster', MONDATA, False,
                 ('return mnum >= PM_ARCHEOLOGIST && mnum <= PM_WIZARD;',
                  'return mnum >= PM_ARCHEOLOGIST && mnum < PM_WIZARD;'),
                 PM_WIZARD, null_probe=False),
    species_spec('is_unicorn', 'verification_is_unicorn',
                 'monsterIsUnicorn', MONDATA, False,
                 ('&& likes_gems(mnum);', '&& likes_magic(mnum);'),
                 PM_GRAY_UNICORN),
    species_spec('eyecount', 'verification_eyecount',
                 'eyecount', MONDATA, False,
                 ('? 1 : 2;', '? 1 : 3;'), PM_GIANT_ANT),
    species_spec('emits_light', 'verification_emits_light',
                 'monsterEmitsLight', VISION, False,
                 ('|| LIGHT_EMITTING_MONSTERS.has(mnum);',
                  '|| LIGHT_EMITTING_MONSTERS.has(mnum + 1);'),
                 PM_FIRE_ELEMENTAL),
    species_spec('vegan', 'verification_vegan',
                 'veganCorpse', FOOD_TRAITS, False,
                 ('|| symbol === S_GOLEM && species !== PM_FLESH_GOLEM'
                  ' && species !== PM_LEATHER_GOLEM;',
                  '|| symbol === S_GHOST && species !== PM_FLESH_GOLEM'
                  ' && species !== PM_LEATHER_GOLEM;'),
                 PM_STRAW_GOLEM),
    species_spec('vegetarian', 'verification_vegetarian',
                 'vegetarianCorpse', FOOD_TRAITS, False,
                 ('&& species !== PM_BLACK_PUDDING;',
                  '&& species !== PM_BLACK_PUDDING + 1;'),
                 PM_BLACK_PUDDING),
]

# ---- mondata.c:poly_when_stoned() ----

G_GENOD = 0x02  # monflag.h genocide bit of svm.mvitals[].mvflags

POLY_WHEN_STONED_ASSUMPTIONS = PREDICATE_ASSUMPTIONS + (
    'monst.h:svm.mvitals: the stone golem entry is the only one read; its uchar mvflags is symbolic and every other entry behaves as the all-clear slot on both sides',
)


def poly_when_stoned_state(world, front, modules):
    species_predicate_state(world, front, modules)
    size = front.enum_value('NUMMONS')
    flags = world.c_state['svm.mvitals[PM_STONE_GOLEM].mvflags'][0]
    world.pre.extend([flags >= 0, flags <= 255])
    world.c_globals['svm.mvitals'] = CArray(
        tuple(CState(f'svm.mvitals[{i}]') for i in range(size)))
    world.c_globals[f'svm.mvitals[{PM_STONE_GOLEM}].mvflags'] = CVal(
        flags, (8, False))
    vitals = []
    for index in range(size):
        value = flags if index == PM_STONE_GOLEM else z3.IntVal(0)
        vitals.append(V('record', {'mvflags': V('num', value)}))
    world.js_values['game.mvitals'] = V('array', tuple(vitals))


def poly_when_stoned_arguments(world, front):
    values = {name: value for name, value, _ in world.params}
    native = CPtr(values['native_pointer_present'] != 0,
                  CElement('mons', values['species']))
    return ([native], [V('num', values['species']), V('obj', 'game')])


PREDICATE_SPECS += [
    Spec(
        'poly_when_stoned:state', 'verification_poly_when_stoned',
        'formCanBecomeStoneGolem',
        [('species', INT), ('native_pointer_present', INT)],
        state=[('svm.mvitals[PM_STONE_GOLEM].mvflags', (8, False), None)],
        js_file=MONDATA, assumptions=POLY_WHEN_STONED_ASSUMPTIONS,
        require_counterexamples=True, configure=poly_when_stoned_state,
        arguments=poly_when_stoned_arguments,
        pre=lambda s: [s['species'] >= 0, s['native_pointer_present'] == 1],
        probes=[('null native species pointer', lambda s: [
            s['species'] >= 0, s['native_pointer_present'] == 0])],
        mutant_pre=lambda s: [s['species'] == PM_STRAW_GOLEM,
                              s['svm.mvitals[PM_STONE_GOLEM].mvflags'] == 1],
        mutants=[(MONDATA,
                  '(state.mvitals?.[PM_STONE_GOLEM]?.mvflags ?? 0) & G_GENOD',
                  '(state.mvitals?.[PM_STONE_GOLEM]?.mvflags ?? 0) & (G_GENOD | 0x01)')],
    ),
]


# ---- mondata.c:cvt_adtyp_to_mseenres() ----

# monattk.h defines these attack-damage codes (not an enum) as AD_MAGM 1 ..
# AD_ACID 8, in the same order as the M_SEEN_* bits 0x01..0x80; the claim
# verifies that correspondence over every uchar code.
CVT_ASSUMPTIONS = (
    'mondata.c:cvt_adtyp_to_mseenres: the switch maps the eight codes AD_MAGM..AD_ACID to M_SEEN_MAGR..M_SEEN_ACID and every other uchar to M_SEEN_NOTHING; the port derives each bit by shifting over the code order',
)

PREDICATE_SPECS += [
    Spec(
        'cvt_adtyp_to_mseenres:tables', 'verification_cvt_adtyp_to_mseenres',
        'seenResistanceForDamage', [('adtyp', (8, False))],
        js_file=MONDATA, assumptions=CVT_ASSUMPTIONS,
        require_counterexamples=True,
        mutants=[(MONDATA, 'damageType >= AD_MAGM && damageType <= AD_ACID',
                  'damageType >= AD_MAGM && damageType <= AD_DRST'),
                 (MONDATA, 'M_SEEN_MAGR << (damageType - AD_MAGM)',
                  'M_SEEN_REFL << (damageType - AD_MAGM)')],
    ),
]


# ---- rm.h/trap.h terrain macros ----

# rm.h/trap.h pinned codes: VWALL 1, DBWALL 12, POOL 16, DOOR 23, SDOOR 14,
# PIT 11, SPIKED_PIT 12, HOLE 13, TRAPDOOR 14.
TERRAIN_ASSUMPTIONS = (
    'rm.h: levl[][].typ holds the levl_typ_types codes and trap.h ttyp the trap_types codes; both are stored in signed chars, so the claims cover every schar value (is_pit/is_hole over every int, as their ports take a bare number), except IS_WALL, which additionally assumes the stored code is non-negative: C\'s truthiness test accepts negative typ values and the port\'s VWALL lower bound does not',
)


def terrain_spec(name, harness, port, param, pre, probes, mutant_pre, old, new):
    return Spec(f'{name}:terrain', harness, port, param, js_file=CONST,
                assumptions=TERRAIN_ASSUMPTIONS, require_counterexamples=True,
                pre=pre, probes=probes, mutant_pre=mutant_pre,
                mutants=[(CONST, old, new)])


OBSTRUCTED_ANCHOR = ('export function IS_OBSTRUCTED(typ) {\n'
                     '    // C ref: rm.h — IS_OBSTRUCTED(typ) ((typ) < POOL)\n'
                     '    return typ < POOL;')

PREDICATE_SPECS += [
    terrain_spec(
        'IS_WALL', 'verification_IS_WALL', 'IS_WALL', [('typ', SCHAR)],
        lambda s: [s['typ'] >= 0],
        [('negative terrain type is outside the stored codes',
          lambda s: [s['typ'] == -1])],
        lambda s: [s['typ'] == 12],
        'return typ >= VWALL && typ <= DBWALL;',
        'return typ >= VWALL && typ < DBWALL;'),
    terrain_spec(
        'IS_OBSTRUCTED', 'verification_IS_OBSTRUCTED', 'IS_OBSTRUCTED',
        [('typ', SCHAR)], lambda s: [], [], lambda s: [s['typ'] == 16],
        OBSTRUCTED_ANCHOR,
        OBSTRUCTED_ANCHOR[:-len('return typ < POOL;')] + 'return typ <= POOL;'),
    terrain_spec(
        'IS_DOOR', 'verification_IS_DOOR', 'IS_DOOR', [('typ', SCHAR)],
        lambda s: [], [], lambda s: [s['typ'] == 23],
        'return typ === DOOR;', 'return typ === SDOOR;'),
    terrain_spec(
        'is_pit', 'verification_is_pit', 'is_pit', [('ttyp', INT)],
        lambda s: [], [], lambda s: [s['ttyp'] == 12],
        'return ttyp === PIT || ttyp === SPIKED_PIT;',
        'return ttyp === PIT;'),
    terrain_spec(
        'is_hole', 'verification_is_hole', 'is_hole', [('ttyp', INT)],
        lambda s: [], [], lambda s: [s['ttyp'] == 14],
        'return ttyp === HOLE || ttyp === TRAPDOOR;',
        'return ttyp === HOLE || ttyp === TRAPDOOR + 1;'),
]


# ---- worn.c:find_mac() over one modeled monster ----

WORN = 'js/worn.js'
PREDICATE_JS_FILES += (WORN,)

MAX_MON_INV = 2

FIND_MAC_ASSUMPTIONS = (
    'worn.c:find_mac: monster.data points to mons[species]; emitted mnum equals species; the emitted MONSTER_EXPERIENCE_META base AC is the mons[].ac column',
    'worn.c:m_dowear_type: mon->misc_worn_check never gains the W_WEP bit — its only writers are the armor/amulet flags of m_dowear_type (worn.c:970), W_SADDLE (steed.c:159), I_SPECIAL (mon.c:5917) and W_ARMF (trap.c:2512) — although weapon.c:929 sets owornmask W_WEP on every successful monster wield, so the owornmask & misc_worn_check test at worn.c:724 never counts a wielded weapon; every other class a monster can wear into those bits (armor, amulets, the saddle) has a zero a_ac outside the armor class, and the domain restriction below encodes that by excluding the non-armor-class rows with a nonzero oc_oc1 from being counted',
    'objects.c:objects_globals_init: the native objects[] table and the emitted a_ac column (OBJECT_HIT_BONUS, the oc_oc1 alias) retain their initial values; hack.h ARM_BONUS reads objects[otyp].a_ac for every worn item class',
    'obj.h owornmask and monst.h misc_worn_check are longs whose reachable worn bits stay inside a signed int32; the port reads them with a JS 32-bit &, so the claim keeps every modeled mask in 0..2^31-1',
    'the monster inventory is an acyclic nobj chain of length 0..2 with the same order and length as the emitted minvent array; otyp stays inside both object tables; spe is a signed char and both erosion bitfields are 0..3',
)


def nonarmor_with_bonus(world, front, modules):
    """The otyps outside the armor class whose oc_oc1 is nonzero, from the
    emitted class and a_ac columns; both tables' equality over every otyp is
    the object_class:tables and object_armor_ac:tables claims."""
    del front
    bonus = module_constant(world, modules, 'js/object_data.js',
                            'OBJECT_HIT_BONUS')
    classes = module_constant(world, modules, 'js/object_data.js',
                              'OBJECT_CLASS')
    armor = module_constant(world, modules, 'js/objclass.js', 'ARMOR_CLASS')
    if bonus.kind != 'array' or classes.kind != 'array':
        raise Unsupported('a_ac or class column is not an array')
    if armor.kind != 'num' or not z3.is_int_value(z3.simplify(armor.v)):
        raise Unsupported('armor class constant is not a fixed number')
    armor_class = z3.simplify(armor.v).as_long()
    if len(classes.v) != len(bonus.v):
        raise Unsupported('class and a_ac columns disagree in length')
    out = []
    for index, (row_class, value) in enumerate(zip(classes.v, bonus.v)):
        number = z3.simplify(value.v) if value.kind == 'num' else None
        row = z3.simplify(row_class.v) if row_class.kind == 'num' else None
        if number is None or row is None \
                or not z3.is_int_value(number) or not z3.is_int_value(row):
            raise Unsupported(f'row {index} of the class or a_ac column is not a fixed number')
        if row.as_long() != armor_class and number.as_long() != 0:
            out.append(index)
    if not out:
        raise Unsupported('no non-armor-class row has a nonzero oc_oc1')
    return out

def find_mac_state(world, front, modules):
    world.join_paths = True
    values = {name: value for name, value, _ in world.params}
    species = values['species']
    world.pre.extend([species >= 0, species < front.enum_value('NUMMONS')])
    world.c_globals['mons'] = native_monsters(world, front)
    world.c_globals['monster.data'] = CPtr(True, CElement('mons', species))
    chain = z3.simplify(values['mchain'])
    if not z3.is_int_value(chain) or not 0 <= chain.as_long() <= MAX_MON_INV:
        raise Unsupported('monster inventory chain length must be a fixed partition value')
    length = chain.as_long()
    world.c_globals['mon_invent'] = CArray(
        tuple(CState(f'mon_invent[{i}]') for i in range(MAX_MON_INV)))
    world.c_globals['monster.minvent'] = CPtr(
        length > 0, CElement('mon_invent', z3.IntVal(0)))
    for i in range(MAX_MON_INV - 1):
        world.c_globals[f'mon_invent[{i}].nobj'] = CPtr(
            length > i + 1, CElement('mon_invent', z3.IntVal(i + 1)))
    world.c_globals[f'mon_invent[{MAX_MON_INV - 1}].nobj'] = CPtr(False)
    # The non-armor-class rows whose oc_oc1 is nonzero (weapons and tools):
    # misc_worn_check never carries their worn bits, so C's owornmask &
    # misc_worn_check test never counts them for a monster; the domain
    # excludes them from the counted set and the port's armor-class guard
    # stays unreachable-different rather than reachable.
    counted_bad = nonarmor_with_bonus(world, front, modules)
    worn = world.c_state['monster.misc_worn_check'][0]
    records = []
    for i in range(length):
        otyp = world.c_state[f'mon_invent[{i}].otyp'][0]
        mask = world.c_state[f'mon_invent[{i}].owornmask'][0]
        spe = world.c_state[f'mon_invent[{i}].spe'][0]
        eroded = world.c_state[f'mon_invent[{i}].oeroded'][0]
        eroded2 = world.c_state[f'mon_invent[{i}].oeroded2'][0]
        world.pre.extend([otyp >= 0, otyp < front.enum_value('NUM_OBJECTS'),
                          mask >= 0, mask <= 2 ** 31 - 1,
                          eroded >= 0, eroded <= 3, eroded2 >= 0, eroded2 <= 3])
        overlap = bit_int(bit_operation('&', z3.Int2BV(mask, 32),
                                        z3.Int2BV(worn, 32)), 32, False)
        world.pre.append(z3.Implies(overlap != 0,
                                    z3.And(*[otyp != bad for bad in counted_bad])))
        world.c_globals[f'mon_invent[{i}].otyp'] = CVal(otyp, (16, True))
        world.c_globals[f'mon_invent[{i}].owornmask'] = CVal(mask, LONG)
        world.c_globals[f'mon_invent[{i}].spe'] = CVal(spe, SCHAR)
        world.c_globals[f'mon_invent[{i}].oeroded'] = CVal(eroded, (32, False))
        world.c_globals[f'mon_invent[{i}].oeroded2'] = CVal(eroded2, (32, False))
        records.append(V('record', {'otyp': V('num', otyp),
                                    'owornmask': V('num', mask),
                                    'spe': V('num', spe),
                                    'oeroded': V('num', eroded),
                                    'oeroded2': V('num', eroded2)}))
    world.c_globals['objects'] = native_objects(world, front)
    world.pre.extend([worn >= 0, worn <= 2 ** 31 - 1])
    world.c_globals['monster.misc_worn_check'] = CVal(worn, LONG)
    world.js_values['find_mac.monster'] = V('record', {
        'mnum': V('num', species),
        'misc_worn_check': V('num', worn),
        'minvent': V('array', tuple(records))})


def find_mac_arguments(world, front):
    values = {name: value for name, value, _ in world.params}
    present = values['native_monster_present']
    return ([CPtr(present != 0, 'monster')],
            [V('choice', [(present == 1, world.js_values['find_mac.monster']),
                          (present != 1, V('null'))])])


def find_mac_partitions(front):
    return [(f'monster inventory chain {length}', {'mchain': length})
            for length in range(MAX_MON_INV + 1)]


PREDICATE_SPECS += [
    Spec('find_mac:state', 'find_mac', 'findMonsterArmorClass',
         [('species', INT), ('native_monster_present', INT), ('mchain', INT)],
         state=[('monster.misc_worn_check', LONG, None)]
         + [(f'mon_invent[{i}].{field}', declared, None)
            for i in range(MAX_MON_INV)
            for field, declared in (('otyp', (16, True)), ('owornmask', LONG),
                                    ('spe', SCHAR), ('oeroded', (32, False)),
                                    ('oeroded2', (32, False)))],
         slow=True, js_file=WORN, partitions=find_mac_partitions,
         assumptions=FIND_MAC_ASSUMPTIONS,
         require_counterexamples=True, configure=find_mac_state,
         arguments=find_mac_arguments,
         pre=lambda s: [s['species'] >= 0, s['native_monster_present'] == 1],
         probes=[('null native monster pointer', lambda s: [
             s['species'] >= 0, s['native_monster_present'] == 0])],
         # One amulet of guarding (W_AMUL) plus one worn armor row (W_ARM):
         # the amulet kills the fixed-subtraction mutant, the armor row the
         # ARM_BONUS mutant.
         mutant_pre=lambda s: [s['mon_invent[0].otyp'] == 210,
                               s['mon_invent[0].owornmask'] == 0x10000,
                               s['mon_invent[1].otyp'] == 89,
                               s['mon_invent[1].owornmask'] == 0x1,
                               s['monster.misc_worn_check'] == 0x10001],
         mutants=[(WORN, '? 2 : armorBonus(object);', '? 3 : armorBonus(object);'),
                  ('js/do_wear.js', 'return base + objectEnchantment(object)',
                   'return base + objectEnchantment(object) + 1')]),
]
