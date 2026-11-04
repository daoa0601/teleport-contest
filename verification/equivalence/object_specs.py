"""objects.h field readers over every initial objects.c:obj_init row."""
import z3

from csym import CArray, CState, CVal
from jssym import V
from specs import INT, LONG, Spec, UnrelatedState, int_argument
from state_world import native_objects, native_table

OBJECT_DATA = 'js/object_data.js'


def object_field_state(world, front, modules):
    """Both indices are valid even when a probe drops their correspondence.

    The native table includes its terminator; the port deliberately stops at
    NUM_OBJECTS. No table equality is assumed: both initializers execute.
    """
    world.join_paths = True
    world.c_globals['objects'] = native_objects(world, front)
    count = front.enum_value('NUM_OBJECTS')
    native = world.c_state['otyp'][0]
    port = world.js_state['otyp']
    world.pre.extend([native >= 0, native < count, port >= 0, port < count])


def object_field_arguments(world, front):
    return ([CVal(world.c_state['otyp'][0], INT)],
            [V('num', world.js_state['otyp'])])


OBJECT_FIELD_ASSUMPTIONS = (
    'objects.c:objects_globals_init copies obj_init from objects.h; the native table and emitted object_data.js columns retain their initial values; each side executes its own initializer and lookup, with no table equality assumed',
    'every otyp in 0..NUM_OBJECTS-1, including STRANGE_OBJECT and all GENERIC rows; NUM_OBJECTS comes from clang; the native terminator row is excluded',
    'oc_material and oc_dir claims describe the base columns before o_init.c:shuffle and the WAN_NOTHING direction draw; the per-game objectMaterial/objectDirection owners are outside these claims',
    'oc_skill aliases oc_subtyp; oc_bimanual aliases oc_big, including armor bulk; the raw fields retain these aliases without weapon-class filtering',
)

# Each probe compares two concrete, valid rows with different values. Each
# result mutant uses one concrete row, keeping negative solver searches small.
OBJECT_FIELDS = (
    ('class', 'objectClassForType', 'OBJECT_CLASS', 8),
    ('material', 'objectBaseMaterial', 'OBJECT_MATERIAL', 18),
    ('weight', 'objectBaseWeight', 'OBJECT_WEIGHT', 18),
    ('cost', 'objectBaseCost', 'OBJECT_COST', 18),
    ('delay', 'objectDelay', 'OBJECT_DELAY', 121),
    ('property', 'objectPropertyId', 'OBJECT_PROPERTY_ID', 173),
    ('direction', 'objectBaseDirection', 'OBJECT_DIR', 18),
    ('skill', 'objectSkill', 'OBJECT_SUBTYPE', 18),
    ('bimanual', 'objectBimanual', 'OBJECT_BIMANUAL', 45),
    ('merge', 'objectMerge', 'OBJECT_MERGE', 18),
    ('uses_known', 'objectUsesKnown', 'OBJECT_USES_KNOWN', 18),
    ('unique', 'objectUnique', 'OBJECT_UNIQUE', 213),
    ('magic', 'objectMagic', 'OBJECT_MAGIC', 173),
    ('charged', 'objectCharged', 'OBJECT_CHARGED', 18),
    ('level', 'oc_level', 'OBJECT_SPELL_LEVEL', 366),
    ('nutrition', 'oc_nutrition', 'OBJECT_NUTRITION', 293),
    ('color', 'objectBaseColor', 'OBJECT_COLOR', 18),
    ('prob', 'objectBaseProb', 'OBJECT_PROB', 18),
    ('nowish', 'oc_nowish', 'OBJECT_NOWISH', 1),
    ('hitbon', 'oc_hitbon', 'OBJECT_HIT_BONUS', 34),
    ('wsdam', 'oc_wsdam', 'OBJECT_SMALL_DAMAGE', 34),
    ('wldam', 'oc_wldam', 'OBJECT_LARGE_DAMAGE', 44),
)


def object_field_spec(field, function, table, row):
    lookup = (f'{table}[otyp] ?? 0' if field == 'class'
              else f'requireObjectData({table}, otyp)')
    return Spec(
        f'object_{field}:tables', f'verification_object_{field}', function, [],
        # Keep the added fast-job cost below its two-minute CI allowance.
        # Only the shared class owner and its outside-domain claim stay fast.
        slow=field != 'class', js_file=OBJECT_DATA, state=[('otyp', INT, 'otyp')],
        configure=object_field_state, arguments=object_field_arguments,
        assumptions=OBJECT_FIELD_ASSUMPTIONS, require_counterexamples=True,
        probes=[('index correspondence omitted (two pinned rows)', UnrelatedState(
            lambda s: [s['otyp'] == 0, z3.Int('js:otyp') == row], ('otyp',)))],
        mutant_pre=lambda s: [s['otyp'] == row],
        mutants=[(OBJECT_DATA, f'return {lookup};', f'return ({lookup}) + 1;')],
    )


def outside_object_state(world, front, modules):
    world.c_globals['objects'] = native_objects(world, front)
    world.join_paths = True
    # The port's guarded lookup is modeled beyond the native table only.
    world.pre.append(z3.Or(world.params[0][1] < 0,
                           world.params[0][1] >= front.enum_value('NUM_OBJECTS')))


OBJECT_SPECS = [object_field_spec(*field) for field in OBJECT_FIELDS]
OBJECT_SPECS += [
    Spec('object_class:outside', 'verification_object_class_outside',
         'objectClassForType', [('otyp', LONG)], js_file=OBJECT_DATA,
         configure=outside_object_state,
         assumptions=(
             'port-only extension: every int32 index outside 0..NUM_OBJECTS-1 returns RANDOM_CLASS (0); the C harness adds that guard explicitly and claims no native out-of-bounds behavior',
             'null, undefined, non-integers, NaN and infinities are covered by the behavior tests, not by this integer executor',
         ), require_counterexamples=True,
         pre=lambda s: int_argument(s, 'otyp'),
         probes=[('input narrows to C int', lambda s: [s['otyp'] == 2 ** 32])],
         mutant_pre=lambda s: [s['otyp'] == -1],
         mutants=[(OBJECT_DATA, '|| otyp < 0 || otyp >= OBJECT_CLASS.length)\n        return 0;',
                   '|| otyp < 0 || otyp >= OBJECT_CLASS.length)\n        return 1;')]),
]



def object_text_state(field):
    def configure(world, front, modules):
        world.join_paths = True
        world.c_globals['obj_descr'] = native_table(
            world, front, front.include.parent / 'src' / 'objects.c', 'obj_descr_init')
        count = front.enum_value('NUM_OBJECTS')
        native = world.c_state['otyp'][0]
        world.c_globals['objects'] = CArray(tuple(CState(f'type[{i}]') for i in range(count)))
        for i in range(count):
            world.c_globals[f'type[{i}].{field}'] = CVal(z3.IntVal(i), (16, True))
        port = world.js_state['otyp']
        world.pre.extend([native >= 0, native < count, port >= 0, port < count])
        # Exercise the initial-column path before a game installs its shuffled
        # description array. The shuffle's state correspondence is separate.
        world.js_values['game.objectDescriptions'] = V('undef')
    return configure


def object_text_arguments(world, front):
    return [CVal(world.c_state['otyp'][0], INT)], [V('num', world.js_state['otyp'])]


def object_text_spec(macro, field, file, table, row):
    return Spec(
        f'{macro}:indices', f'verification_{macro}', macro, [],
        slow=True, js_file=file, state=[('otyp', INT, 'otyp')],
        configure=object_text_state(field), arguments=object_text_arguments,
        assumptions=(
            'objclass.h: the real OBJ_NAME/OBJ_DESCR macro reads obj_descr through the related short index; each native obj_descr initializer and emitted string column executes independently',
            'every index in 0..NUM_OBJECTS-1; init_objects establishes oc_name_idx == oc_descr_idx == otyp; this claim covers the initial-column path, not preservation by shuffling or later name rewrites',
            'the reader returns string contents or null; native string pointer identity, allocation, and mutation are outside the value comparison',
        ), require_counterexamples=True,
        probes=[('index correspondence omitted (two pinned rows)', UnrelatedState(
            lambda s: [s['otyp'] == row, z3.Int('js:otyp') == row + 1],
            ('otyp',)))],
        mutant_pre=lambda s: [s['otyp'] == row],
        mutants=[(file, f'{table}[type] ?? null' if macro == 'OBJ_DESCR' else f'{table}[otyp ?? -1] ?? null',
                  f'{table}[0] ?? null')])


OBJECT_SPECS += [
    object_text_spec('OBJ_NAME', 'oc_name_idx', OBJECT_DATA, 'OBJECT_NAMES', 18),
    object_text_spec('OBJ_DESCR', 'oc_descr_idx', 'js/o_init.js', 'OBJECT_DESCRIPTIONS', 97),
]
