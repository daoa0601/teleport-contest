"""fv-equivalence-batch-13: the single-owner defense and helper ports.

artifact.c:defends()/defends_when_carried() over the artilist table and the
dragon-armor switch, mondata.c:resists_magm() over one monster with a
modeled wielded weapon and inventory chain, hacklib.c's highc/lowc/ordin,
and the H<Prop> || E<Prop> resistance macros of youprop.h over the property
record. defended() and Resists_Elem() themselves declare a struct obj local
(`struct obj *o, otemp;`) the C executor cannot type, so they stay outside
these claims; resists_drli/resists_blnd call defended() and follow it."""
import z3

from core import Unsupported
from csym import CArray, CElement, CPtr, CState, CVal
from jssym import V
from specs import INT, LONG, SCHAR, Spec, UnrelatedState
from state_world import (_mask, module_constant, native_monsters,
                         native_objects, native_table)

HACKLIB = 'js/hacklib.js'
ARTIFACT = 'js/artifact.js'
MONDATA = 'js/mondata.js'
PROPERTIES = 'js/properties.js'

DEFENSE_JS_FILES = (HACKLIB, ARTIFACT)


# ---- hacklib.c:highc/lowc/ordin: pure byte/int helpers ----

DEFENSE_SPECS = [
    Spec('highc', 'highc', 'uppercase', [('c', INT)], js_file=HACKLIB,
         require_counterexamples=True,
         pre=lambda s: [s['c'] >= -128, s['c'] <= 127],
         probes=[('c narrows to C char', lambda s: [s['c'] == 300])],
         mutants=[(HACKLIB, 'key >= 97 && key <= 122 ? key - 32 : key',
                   'key >= 97 && key <= 121 ? key - 32 : key')]),
    Spec('lowc', 'lowc', 'asciiLower', [('c', INT)], js_file=HACKLIB,
         require_counterexamples=True,
         pre=lambda s: [s['c'] >= -128, s['c'] <= 127],
         probes=[('c narrows to C char', lambda s: [s['c'] == 300])],
         mutants=[(HACKLIB, 'code >= 65 && code <= 90 ? code + 32 : code',
                   'code >= 65 && code <= 89 ? code + 32 : code')]),
    Spec('ordin', 'ordin', 'ordinalSuffix', [('n', INT)], js_file=HACKLIB,
         require_counterexamples=True,
         pre=lambda s: [s['n'] >= -2 ** 31, s['n'] <= 2 ** 31 - 1],
         mutants=[(HACKLIB, 'Math.trunc((number % 100) / 10) === 1',
                   'Math.trunc((number % 100) / 10) === 2'),
                  (HACKLIB, "return digit === 1 ? 'st' : digit === 2 ? 'nd' : 'rd';",
                   "return digit === 1 ? 'st' : digit === 2 ? 'nd' : 'st';")]),
]


# ---- youprop.h: the H<Prop> || E<Prop> resistance macros ----

# prop.h mask bits; the masks only ever feed a nonzero test here.
FROMFORM = 0x10000000      # intrinsic: conferred by monster form
TIMEOUT_MASK = 0x00ffffff  # intrinsic: timed turns
W_ARMH_BIT = 0x00000004    # extrinsic: worn helmet slot
W_ART = 0x00001000         # extrinsic: carrying artifact
W_ARTI = 0x00002000        # extrinsic: invoked artifact
PROPERTY_FLAGS = ('perm', 'timed', 'worn', 'invoked', 'carried')
PROPERTY_STATE = [(f'prop.{name}', INT, None) for name in PROPERTY_FLAGS]

PROPERTY_ASSUMPTIONS = (
    'youprop.h H<Prop> is u.uprops[prop].intrinsic (FROMEXPER/FROMRACE/FROMOUTSIDE/FROMFORM/I_SPECIAL bits plus the TIMEOUT field) and E<Prop> is the extrinsic worn/artifact mask; the claim relates one lumped any-source boolean per bit family',
    'properties.js:propertyIsActive is the single port owner of the macro; for these properties it is exactly propertySourceIsActive: any non-timed intrinsic origin, the per-property hero turn field, a worn source, an invoked artifact (W_ARTI) or a carried artifact (W_ART)',
    "artifact.c:set_artifact_intrinsic, worn.c's extrinsic updates and polyself.c:set_uasmon keep the record and the C masks in step; a never-materialized record behaves as the all-clear slot on both sides",
)

# The macros have no numeric C/JS correspondence to weaken (both sides read
# the same lumped flags), so the claims carry no domain probes; their
# mutants supply the concrete counterexamples over the 32 flag corners.


def property_domain(s):
    return [s[f'prop.{name}'] >= 0 for name in PROPERTY_FLAGS] + \
           [s[f'prop.{name}'] <= 1 for name in PROPERTY_FLAGS]


def property_macro_state(prop_enum, js_name):
    def state(world, front, modules):
        index = front.enum_value(prop_enum)
        size = front.enum_value('LAST_PROP') + 1
        world.c_globals['u.uprops'] = CArray(
            tuple(CState(f'u.uprops[{i}]') for i in range(size)))
        symbols = {name: value for name, (value, _) in world.c_state.items()}
        world.c_globals[f'u.uprops[{index}].intrinsic'] = CVal(
            _mask((symbols['prop.perm'] == 1, FROMFORM),
                  (symbols['prop.timed'] == 1, TIMEOUT_MASK)), LONG)
        world.c_globals[f'u.uprops[{index}].extrinsic'] = CVal(
            _mask((symbols['prop.worn'] == 1, W_ARMH_BIT),
                  (symbols['prop.invoked'] == 1, W_ARTI),
                  (symbols['prop.carried'] == 1, W_ART)), LONG)
        record = {
            'intrinsic': V('choice', [
                (symbols['prop.perm'] == 1,
                 V('record', {'role': V('bool', z3.BoolVal(True))})),
                (symbols['prop.perm'] == 0, V('record', {}))]),
            'worn': V('choice', [
                (symbols['prop.worn'] == 1,
                 V('array', (V('record', {'slot': V('str', 'uarmh')}),))),
                (symbols['prop.worn'] == 0, V('array', ()))]),
            'invoked': V('choice', [
                (symbols['prop.invoked'] == 1, V('str', 'artifact')),
                (symbols['prop.invoked'] == 0, V('null'))]),
            'carried': V('choice', [
                (symbols['prop.carried'] == 1,
                 V('array', (V('record', {'id': V('num', z3.IntVal(1))}),))),
                (symbols['prop.carried'] == 0, V('array', ()))])}
        world.js_values[f'game.u._propertySources.{js_name}'] = V('record', record)
        fields = module_constant(world, modules, 'js/property_types.js',
                                 'PROPERTY_TIMEOUT_FIELDS')
        if fields.kind != 'record' or js_name not in fields.v:
            raise Unsupported(f'property {js_name} has no timeout field')
        field = fields.v[js_name]
        if field.kind != 'str':
            raise Unsupported(f'property {js_name} timeout field is not a name')
        world.js_values[f'game.u.{field.v}'] = V('num', z3.If(
            symbols['prop.timed'] == 1, z3.IntVal(1), z3.IntVal(0)))
        world.js_values['game.u.usteed'] = V('null')
    return state


DEFENSE_SPECS += [
    Spec(name, harness, 'propertyIsActive', [], js_file=PROPERTIES,
         state=PROPERTY_STATE, assumptions=PROPERTY_ASSUMPTIONS,
         require_counterexamples=True, configure=property_macro_state(prop, js),
         js_args=[('str', js), ('obj', 'game')], pre=property_domain,
         mutants=[(PROPERTIES,
                   '|| (record?.worn.length ?? 0) > 0\n        || !!record?.invoked',
                   '|| (record?.worn.length ?? 0) > 1\n        || !!record?.invoked'),
                  (PROPERTIES,
                   "|| !!record?.invoked\n        || (record?.carried.length ?? 0) > 0\n        || propertyTimeout(property, state) > 0;",
                   "|| !!record?.invoked\n        || (record?.carried.length ?? 0) > 0\n        || propertyTimeout(property, state) > 1;")])
    for name, harness, prop, js in (
        ('fire_resistance:state', 'verification_fire_resistance', 'FIRE_RES', 'fireResistance'),
        ('cold_resistance:state', 'verification_cold_resistance', 'COLD_RES', 'coldResistance'),
        ('sleep_resistance:state', 'verification_sleep_resistance', 'SLEEP_RES', 'sleepResistance'),
        ('disint_resistance:state', 'verification_disint_resistance', 'DISINT_RES', 'disintegrationResistance'),
        ('shock_resistance:state', 'verification_shock_resistance', 'SHOCK_RES', 'shockResistance'),
        ('poison_resistance:state', 'verification_poison_resistance', 'POISON_RES', 'poisonResistance'),
        ('drain_resistance:state', 'verification_drain_resistance', 'DRAIN_RES', 'drainResistance'),
        ('antimagic:state', 'verification_antimagic', 'ANTIMAGIC', 'antimagic'),
        ('acid_resistance:state', 'verification_acid_resistance', 'ACID_RES', 'acidResistance'),
        ('stone_resistance:state', 'verification_stone_resistance', 'STONE_RES', 'stoneResistance'),
    )
]


# ---- artifact.c:defends()/defends_when_carried() ----

# artifact.js:defends normalizes a numeric damage type through QUERY_FOR_DAMAGE;
# its computed object keys are outside the JS executor, so each partition pins
# one damage type and passes its query spelling. AD_WERE/AD_BLND have query
# spellings whose DRAGON_DEFENDING keys are missing, which is exactly the C
# switch's default arm; damage types with no QUERY_FOR_DAMAGE entry at all
# return false through the port's null-query guard and C's default arm and
# stay outside the partitioned domain.
# monattk.h defines these attack-damage codes (not an enum); the emitted
# monster_attack_types.js constants carry the same values (checked side by
# side above the claim).
DAMAGE_QUERIES = (
    ('AD_MAGM', 1, 'magic'), ('AD_FIRE', 2, 'fire'), ('AD_COLD', 3, 'cold'),
    ('AD_ELEC', 6, 'shock'), ('AD_DRST', 7, 'poison'), ('AD_DRLI', 15, 'life-drain'),
    ('AD_WERE', 29, 'lycanthropy'), ('AD_BLND', 11, 'blindness'),
    ('AD_HALU', 36, 'hallucination'), ('AD_DISE', 33, 'disease'),
    ('AD_SLEE', 4, 'sleep'), ('AD_PLYS', 14, 'paralysis'),
    ('AD_DISN', 5, 'disintegration'), ('AD_SLOW', 13, 'slow'),
    ('AD_ACID', 8, 'acid'), ('AD_STON', 18, 'stone'),
)
EXCALIBUR = 1               # artilist[1]/id 1: defn DRLI(0,0), base LONG_SWORD
ORB_OF_DETECTION = 21      # artilist[21]/id 21: cary AD_MAGM
LONG_SWORD_OTYP = 54


def damage_partitions(front):
    return [(f'damage {enum} ({query})', {'adtyp': value})
            for enum, value, query in DAMAGE_QUERIES]


def native_artifacts(world, front):
    """artilist.h's table as the live artilist[]; get_artifact reads it
    directly, so the claim assumes the initial copy."""
    return native_table(world, front, front.include.parent / 'src' / 'artifact.c',
                        'artilist')


ARTIFACT_DEFENSE_ASSUMPTIONS = (
    'artilist.h: the static NEARDATA artilist[] initializer retains its initial values on the native side, and initializeArtifacts copies artifact_data.js identity/defense/carriedDefense pairs into game._artifactRuntime (only role/alignment retargeting differs, and no defense field is retargeted)',
    'obj.h oartifact is the artifact index (obj.h char); get_artifact returns &artilist[0] (== ART_NONARTIFACT) for every index outside 1..AFTER_LAST_ARTIFACT-1, where artifactById returns null',
    'gen-artifacts.mjs derived ARTIFACT_DATA.defense from artilist[].defn.adtyp and carriedDefense from artilist[].cary.adtyp; the claim verifies that row for row over every artifact index',
    'obj.h Is_dragon_armor/Is_dragon_mail read otyp only; dragonFormForArmor() (proved by armor_to_dragon) converts both dragon armor families to the adult dragon species the port compares with',
)


def artifact_object_state(world, front, modules):
    world.join_paths = True
    world.c_globals['artilist'] = native_artifacts(world, front)
    if 'otmp.otyp' in world.c_state:
        otyp = world.c_state['otmp.otyp'][0]
        world.pre.extend([otyp >= 0, otyp < front.enum_value('NUM_OBJECTS')])
        world.c_globals['otmp.otyp'] = CVal(otyp, (16, True))
    world.c_globals['otmp.oartifact'] = CVal(
        world.c_state['otmp.oartifact'][0], SCHAR)
    artifacts = module_constant(world, modules, 'js/artifact_data.js', 'ARTIFACT_DATA')
    world.js_values['game._artifactRuntime'] = V('map', tuple(
        (artifact.v['id'], artifact) for artifact in artifacts.v))


def defends_arguments(world, front):
    values = {name: value for name, value, _ in world.params}
    queries = {value: query for _, value, query in DAMAGE_QUERIES}
    adtyp = values['adtyp']
    number = adtyp.as_long() if z3.is_int_value(z3.simplify(adtyp)) else None
    if number not in queries:
        raise Unsupported('damage partition must pin one mapped adtyp')
    present = values['native_object_present']
    return ([CVal(adtyp, INT), CPtr(present != 0, 'otmp')],
            [V('str', queries[number]),
             V('choice', [(present == 1, V('obj', 'otmp')),
                          (present != 1, V('null'))]),
             V('obj', 'game')])


DEFENSE_SPECS += [
    Spec('defends:tables', 'defends', 'defends',
         [('adtyp', INT), ('native_object_present', INT)], js_file=ARTIFACT,
         state=[('otmp.otyp', (16, True), 'otmp.otyp'),
                ('otmp.oartifact', SCHAR, 'otmp.oartifact')],
         partitions=damage_partitions,
         assumptions=ARTIFACT_DEFENSE_ASSUMPTIONS + (
             'artifact.c:defends: the object argument may be null (both sides return false); the dragon branch runs only when the object carries no artifact',
         ),
         require_counterexamples=True, configure=artifact_object_state,
         arguments=defends_arguments,
         pre=lambda s: [s['native_object_present'] >= 0,
                        s['native_object_present'] <= 1],
         probes=[('artifact index correspondence omitted (pinned Excalibur)',
                  UnrelatedState(lambda s: [s['otmp.otyp'] == LONG_SWORD_OTYP,
                                            s['otmp.oartifact'] == EXCALIBUR],
                                 ('otmp.oartifact',))),
                 ('dragon armor otyp correspondence omitted (pinned gray dragon scales)',
                  UnrelatedState(lambda s: [s['otmp.oartifact'] == 0],
                                 ('otmp.otyp',)))],
         mutants=[(ARTIFACT, 'return artifact.defense === damageType;',
                   'return artifact.defense !== damageType;'),
                  (ARTIFACT,
                   'return dragonFormForArmor(object) === DRAGON_DEFENDING[damageType];',
                   'return dragonFormForArmor(object) !== DRAGON_DEFENDING[damageType];')]),
    Spec('defends_when_carried:tables', 'defends_when_carried', 'defendsWhenCarried',
         [('adtyp', INT), ('native_object_present', INT)], js_file=ARTIFACT,
         state=[('otmp.oartifact', SCHAR, 'otmp.oartifact')],
         partitions=damage_partitions,
         assumptions=ARTIFACT_DEFENSE_ASSUMPTIONS + (
             'artifact.c:defends_when_carried: the object argument may be null (get_artifact tests it; the port reads object?.oartifact); otyp/oclass are unread on both sides',
         ),
         require_counterexamples=True, configure=artifact_object_state,
         arguments=defends_arguments,
         pre=lambda s: [s['native_object_present'] >= 0,
                        s['native_object_present'] <= 1],
         probes=[('artifact index correspondence omitted (pinned Orb of Detection)',
                  UnrelatedState(lambda s: [s['adtyp'] == 1,
                                            s['otmp.oartifact'] == ORB_OF_DETECTION],
                                 ('otmp.oartifact',)))],
         mutants=[(ARTIFACT,
                   'artifactById(object?.oartifact, state)?.carriedDefense === damageType',
                   'artifactById(object?.oartifact, state)?.carriedDefense !== damageType')]),
]


# ---- mondata.c:resists_magm() over one modeled monster ----

MAX_MON_INV = 2
W_WEP = 0x00000100          # prop.h: wielded weapon slot
CLOAK_OF_MAGIC_RESISTANCE_OTYP = 148

RESISTS_MAGM_ASSUMPTIONS = (
    'mondata.c:resists_magm: every C call site passes a monster, not &gy.youmonst, so the modeled monster is a distinct state object and both is_you branches fold away; the port documents the same',
    'monst.c:monst_globals_init and objects.c:objects_globals_init: mons[]/objects[] and the emitted MONSTER_ATTACKS/MONSTER_NAME tables retain their initial values',
    'obj.h owornmask is a long but every reachable worn mask is a combination of prop.h W_* bits, all inside a signed int32; the port reads it with a JS 32-bit &, so the claim keeps every modeled mask in 0..2^31-1',
    'monst.h:MON_WEP(mon) is mon->mw; weapon.c keeps mw pointing at the minvent item whose owornmask carries W_WEP (mwepgone clears both), so the claim models the wielded index over the same chain and keeps every other item free of the W_WEP bit',
    'the monster inventory is an acyclic nobj chain of length 0..2 with the same order and length as the emitted minvent array; otyp stays inside both object tables',
    'gen-artifacts.mjs: ANTIMAGIC_ARMOR is exactly the set of otyps whose objects[].oc_oprop is ANTIMAGIC; the claim verifies that over every otyp in the table',
)


def monster_inventory_state(world, front, modules):
    world.join_paths = True
    values = {name: value for name, value, _ in world.params}
    species = values['species']
    world.pre.extend([species >= 0, species < front.enum_value('NUMMONS')])
    world.c_globals['artilist'] = native_artifacts(world, front)
    world.c_globals['gy.youmonst'] = CVal(z3.IntVal(0), INT)
    world.c_globals['mons'] = native_monsters(world, front)
    world.c_globals['monster.data'] = CPtr(True, CElement('mons', species))

    chain = z3.simplify(values['mchain'])
    if not z3.is_int_value(chain) or not 0 <= chain.as_long() <= MAX_MON_INV:
        raise Unsupported('monster inventory chain length must be a fixed partition value')
    length = chain.as_long()
    wielded = values['wielded']
    world.pre.extend([wielded >= -1, wielded < length])

    world.c_globals['mon_invent'] = CArray(
        tuple(CState(f'mon_invent[{i}]') for i in range(MAX_MON_INV)))
    world.c_globals['monster.minvent'] = CPtr(
        length > 0, CElement('mon_invent', z3.IntVal(0)))
    for i in range(MAX_MON_INV - 1):
        world.c_globals[f'mon_invent[{i}].nobj'] = CPtr(
            length > i + 1, CElement('mon_invent', z3.IntVal(i + 1)))
    world.c_globals[f'mon_invent[{MAX_MON_INV - 1}].nobj'] = CPtr(False)
    index = z3.If(wielded >= 0, wielded, z3.IntVal(0))
    world.c_globals['monster.mw'] = CPtr(wielded >= 0, CElement('mon_invent', index))

    records = []
    for i in range(length):
        otyp = world.c_state[f'mon_invent[{i}].otyp'][0]
        mask = world.c_state[f'mon_invent[{i}].owornmask'][0]
        art = world.c_state[f'mon_invent[{i}].oartifact'][0]
        world.pre.extend([otyp >= 0, otyp < front.enum_value('NUM_OBJECTS'),
                          mask >= 0, mask <= 2 ** 31 - 1,
                          z3.Implies(wielded == i, (mask / 256) % 2 == 1),
                          z3.Implies(wielded != i, (mask / 256) % 2 == 0)])
        world.c_globals[f'mon_invent[{i}].otyp'] = CVal(otyp, (16, True))
        world.c_globals[f'mon_invent[{i}].owornmask'] = CVal(mask, LONG)
        world.c_globals[f'mon_invent[{i}].oartifact'] = CVal(art, SCHAR)
        records.append(V('record', {'otyp': V('num', otyp),
                                    'owornmask': V('num', mask),
                                    'oartifact': V('num', art)}))
    world.c_globals['objects'] = native_objects(world, front)
    artifacts = module_constant(world, modules, 'js/artifact_data.js', 'ARTIFACT_DATA')
    world.js_values['game._artifactRuntime'] = V('map', tuple(
        (artifact.v['id'], artifact) for artifact in artifacts.v))
    weapon = V('choice', [(wielded == i, records[i]) for i in range(length)]
               + [(wielded == -1, V('null'))])
    world.js_values['resists_magm.monster'] = V('record', {
        'mnum': V('num', species),
        'mw': weapon,
        'minvent': V('array', tuple(records))})


def monster_inventory_arguments(world, front):
    values = {name: value for name, value, _ in world.params}
    present = values['native_monster_present']
    return ([CPtr(present != 0, 'monster')],
            [world.js_values['resists_magm.monster'], V('obj', 'game')])


def monster_chain_partitions(front):
    return [(f'monster inventory chain {length}', {'mchain': length})
            for length in range(MAX_MON_INV + 1)]


DEFENSE_SPECS += [
    Spec('resists_magm:tables', 'resists_magm', 'monsterHasMagicResistance',
         [('species', INT), ('native_monster_present', INT),
          ('mchain', INT), ('wielded', INT)],
         slow=True, js_file=MONDATA,
         state=[(f'mon_invent[{i}].{field}', declared, None)
                for i in range(MAX_MON_INV)
                for field, declared in (('otyp', (16, True)), ('owornmask', LONG),
                                        ('oartifact', SCHAR))],
         partitions=monster_chain_partitions,
         assumptions=RESISTS_MAGM_ASSUMPTIONS,
         require_counterexamples=True, configure=monster_inventory_state,
         arguments=monster_inventory_arguments,
         pre=lambda s: [s['species'] >= 0, s['native_monster_present'] == 1],
         probes=[('null native monster pointer', lambda s: [
             s['species'] >= 0, s['native_monster_present'] == 0])],
         mutant_pre=lambda s: [s['mon_invent[0].otyp'] == CLOAK_OF_MAGIC_RESISTANCE_OTYP,
                               s['mon_invent[0].oartifact'] == 0],
         mutants=[(MONDATA, 'ANTIMAGIC_ARMOR.has(object?.otyp)',
                   'ANTIMAGIC_ARMOR.has(object?.otyp + 1)'),
                  (MONDATA, '& (W_ARMOR | W_ACCESSORY | W_WEP)',
                   '& (W_ARMOR | W_ACCESSORY)')]),
]
