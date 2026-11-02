"""Claims over explicit hero, monster and read-only call correspondences."""
import z3

from csym import CVal
from specs import (ATTRIBUTES, ATTRIB, HIT_BONUS, HUMAN_FORM, INT,
                   SCHAR, Spec, ULEVEL, UnrelatedState, WEAPON_DAMAGE)
from state_world import (AT_ENGL, AT_WEAP,
                         capacity_state, experience_arguments, experience_state,
                         hero_state, hit_bonus_state, inventory_state,
                         movement_arguments, movement_state,
                         species_predicate_arguments, species_predicate_state,
                         symbolic_attacks, symbolic_attack_arguments, capacity_arguments,
                         sign_state, sign_arguments)
UINT = (32, False)

WORN = [(slot, (f'game.{slot}', f'game.u.{slot}')) for slot in ('uarmg', 'uarmh', 'uwep')]
ITEM_FIELDS = [('uarmg.otyp', (16, True), 'game.uarmg.otyp'),
               ('uarmh.otyp', (16, True), 'game.uarmh.otyp'),
               ('uwep.oartifact', SCHAR, 'game.uwep.oartifact')]
HERO = ATTRIBUTES + HUMAN_FORM + ITEM_FIELDS

STATE_C_FILES = ('artifact.c', 'monst.c', 'makemon.c', 'mon.c', 'worn.c',
                 'mondata.c', 'polyself.c', 'dungeon.c')
STATE_JS_FILES = (
    'js/monster_data.js', 'js/monster_attack_types.js', 'js/artifacts.js',
    'js/artifact_data.js', 'js/makemon.js', 'js/dungeon.js',
    'js/mon.js', 'js/monmove.js', 'js/hack.js', 'js/mkobj.js',
    'js/properties.js', 'js/property_types.js', 'js/do_wear.js', 'js/muse.js',
)


def full_attributes(s):
    return [s['chridx'] >= 0, s['chridx'] < 6]


HERO_ASSUMPTIONS = (
    'polyself.c:set_uasmon: hero data points to mons[u.umonnum], 0 <= u.umonnum < NUMMONS',
    'monst.c:monst_globals_init: fields read retain mons_init values; emitted table fields retain initial values',
    'artifacts.js:initializeArtifacts: runtime map retains artifact_data identity/name pairs',
    'do_wear.c:Ring_on/Ring_gone: ring attribute effects correspond through the declared u.abon arrays',
)
EXPERIENCE_ASSUMPTIONS = (
    'monst.c:monst_globals_init: all NUMMONS species partitioned; native/emitted fields retain initial values',
    'worn.c:find_mac: monster inventory is null and misc_worn_check is zero',
    'exper.c:experience: monster.data points to mons[species]; emitted mnum equals species',
    'youprop.h:Amphibious: emitted option is derived by executing verification_amphibious over the related C state',
)
MOVEMENT_ASSUMPTIONS = (
    'monst.c:monst_globals_init: all NUMMONS species partitioned; native/emitted fields retain initial values',
    'mon.c:mcalcmove: monster.data points to mons[species]; emitted mnum equals species',
    'mon.js:initializeMonsterMovement: finite movement/mmove/mspeed are already initialized',
    'mon.js:naturalMonsterSpeed: cached mmove equals emitted MONSTER_MOVE[species]',
    'you.h:usteed: missing/same/other mount identities correspond; other mount fields are unread',
)

STATE_SPECS = [
    Spec('acurr:all', 'acurr', 'currentAttribute', [('chridx', INT)], result_range=(3, 125),
         assumptions=HERO_ASSUMPTIONS,
         require_counterexamples=True, js_file=ATTRIB, state=HERO, references=WORN, configure=hero_state,
         pre=full_attributes,
         probes=[('base attribute correspondence omitted', UnrelatedState(
             lambda s: [s['chridx'] == 0], ('u.acurr.a[0]',)))],
         mutants=[(ATTRIB, "return [6, 6];", "return [7, 7];"),
                  (ATTRIB, '? STR25 : 3, STR25]', '? 124 : 3, STR25]')]),
    Spec('dbon:all', 'dbon', 'heroStrengthDamageBonus', [],
         assumptions=HERO_ASSUMPTIONS,
         require_counterexamples=True, js_file=WEAPON_DAMAGE, js_args=[('obj', 'game')],
         state=HERO, references=WORN, configure=hero_state,
         probes=[('base Strength correspondence omitted', UnrelatedState(
             lambda s: [s['u.umonnum'] == s['u.umonster']], ('u.acurr.a[0]',)))],
         mutants=[(WEAPON_DAMAGE, '? 0 : strengthDamageBonus', '? 1 : strengthDamageBonus')]),
]

STATE_SPECS += [
    Spec('abon:forms', 'abon', 'heroAttributeHitBonus', [],
         assumptions=HERO_ASSUMPTIONS + (
             'dungeon.c:level_difficulty: assumed equal pure xint16 result in 1..32767',
             'monst.h:mvitals.died: corresponding Wizard death count; other JS counters are independent uchar values',
         ),
         require_counterexamples=True, js_file=HIT_BONUS, js_args=[('obj', 'game')],
         state=HERO + ULEVEL + [('svm.mvitals[PM_WIZARD_OF_YENDOR].died', (8, False), None)],
         references=WORN, configure=hit_bonus_state,
         pre=lambda s: [s['u.ulevel'] >= 1, s['u.ulevel'] <= 30],
         probes=[('base Dexterity correspondence omitted', UnrelatedState(
             lambda s: [s['u.ulevel'] >= 1, s['u.ulevel'] <= 30,
                        s['u.umonnum'] == s['u.umonster']], ('u.acurr.a[3]',)))],
         mutants=[(HIT_BONUS, 'adjustedMonsterLevel(heroSpecies(state)) - 3',
                   'adjustedMonsterLevel(heroSpecies(state)) - 2'),
                  ('js/makemon.js', 'monsterDeathCount(mnum);', 'monsterDeathCount(mnum + 1);')]),
]


def species_partitions(front):
    # The domain has precisely NUMMONS valid indices. Each gets a proof with
    # symbolic monster state, rather than one enumerated example state.
    return [(f'species {i}', {'species': i}) for i in range(front.enum_value('NUMMONS'))]


PREDICATE_ASSUMPTIONS = (
    'monst.c:monst_globals_init: fields read retain mons_init values; emitted table fields retain initial values',
    'species is an int in 0..NUMMONS-1; NUMMONS is read from the pinned C headers',
    'native permonst pointer is &mons[species]; emitted argument is the same species index',
)
MONSTER_DATA = 'js/monster_data.js'

STATE_SPECS += [
    Spec(name, native, port, [('species', INT), ('native_pointer_present', INT)], js_file=MONSTER_DATA,
         assumptions=PREDICATE_ASSUMPTIONS, require_counterexamples=True,
         configure=species_predicate_state, arguments=species_predicate_arguments,
         partitions=species_partitions if name in ('ceiling_hider:tables', 'sliparm:tables', 'breakarm:tables') else None,
         pre=lambda s: [s['species'] >= 0, s['native_pointer_present'] == 1],
         probes=[('null native species pointer', lambda s: [s['species'] >= 0,
                                                          s['native_pointer_present'] == 0])],
         mutants=[(MONSTER_DATA, old, new)])
    for name, native, port, old, new in (
        ('mindless:tables', 'verification_mindless', 'monsterIsMindless',
         '& M1_MINDLESS);', '& M1_ANIMAL);'),
        ('nohands:tables', 'verification_nohands', 'monsterHasNoHands',
         '& M1_NOHANDS);', '& M1_NOHEAD);'),
        ('humanoid:tables', 'verification_humanoid', 'monsterIsHumanoid',
         '& M1_HUMANOID);', '& M1_ANIMAL);'),
        ('ceiling_hider:tables', 'verification_ceiling_hider', 'monsterSpeciesHidesOnCeiling',
         'MONSTER_SYMBOL[mnum] !== S_MIMIC', 'MONSTER_SYMBOL[mnum] === S_MIMIC'),
        ('sliparm:tables', 'sliparm', 'monsterSlipsArmor',
         '(MONSTER_SIZE[mnum] ?? 0) <= MZ_SMALL;', '(MONSTER_SIZE[mnum] ?? 0) < MZ_SMALL;'),
        ('breakarm:tables', 'breakarm', 'monsterBreaksArmor',
         'if (monsterSlipsArmor(mnum))', 'if (!monsterSlipsArmor(mnum))'),
    )
]

# The emitted helpers fix their query constants. These claims range over
# all six attack records instead of assuming the initial species tables.
ATTACK_STATE = [(f'attack[{i}].{field}', (8, False), None)
                for i in range(6) for field in ('aatyp', 'adtyp', 'damn', 'damd')]
ATTACK_ASSUMPTIONS = (
    'permonst.h: mattk has exactly NATTK=6 initialized records; all four fields range over every uchar value',
    'the emitted MONSTER_ATTACKS row corresponds field-for-field to the symbolic native mattk array',
    'only the fixed query types used by these emitted helpers are claimed; pointer-returning scans are observed for presence, not slot identity',
    'the emitted mnum is zero, selecting the one related symbolic row; the argument is a monster reference or species index as the helper requires',
)

STATE_SPECS += [
    Spec(name, native, port, [('native_pointer_present', INT)],
         js_file=js_file, state=ATTACK_STATE, assumptions=ATTACK_ASSUMPTIONS + (
             'C extra int32 query arguments: ' + (', '.join(str(value.v.as_long()) for value in c_args) or 'none'),),
         require_counterexamples=True, configure=symbolic_attacks,
         arguments=symbolic_attack_arguments(c_args, record_arg),
         pre=lambda s: [s['native_pointer_present'] == 1],
         probes=[('null native permonst pointer', lambda s: [s['native_pointer_present'] == 0])],
         mutants=[(js_file, old, new)])
    for name, native, port, js_file, c_args, record_arg, old, new in (
        ('attacktype:engulfs', 'attacktype', 'monsterCanEngulf', MONSTER_DATA,
         [CVal(z3.IntVal(AT_ENGL), INT)], True,
         'monster?.mnum ?? -1] || []).some(([attackType]) => attackType === AT_ENGL);',
         'monster?.mnum ?? -1] || []).some(([attackType]) => attackType === AT_WEAP);'),
        ('attacktype:armed', 'attacktype', 'speciesHasWeaponAttack', 'js/monmove.js',
         [CVal(z3.IntVal(AT_WEAP), INT)], False,
         'attackType === AT_WEAP);', 'attackType === AT_MAGC);'),
        ('dmgtype_fromattack:digests', 'verification_digests', 'monsterDigests', MONSTER_DATA,
         [], True, 'attackType === AT_ENGL && damageType === AD_DGST',
         'attackType === AT_ENGL && damageType === AD_WRAP'),
        ('dmgtype_fromattack:enfolds', 'verification_enfolds', 'monsterEnfolds', MONSTER_DATA,
         [], True, 'method === AT_ENGL && damage === AD_WRAP',
         'method === AT_ENGL && damage === AD_DGST'),
        ('attacktype_fordmg:digests', 'verification_attacktype_digests', 'monsterDigests', MONSTER_DATA,
         [], True, 'attackType === AT_ENGL && damageType === AD_DGST',
         'attackType === AT_ENGL && damageType === AD_WRAP'),
        ('dmgtype:sticks', 'sticks', 'monsterSpeciesSticks', MONSTER_DATA,
         [], False, 'attackType === AT_HUGS', 'attackType === AT_WEAP'),
    )
]


def experience_domain(s):
    return [s['nk'] >= 0, s['nk'] <= 255,
            s['monster.mrevived'] <= 1, s['monster.mcloned'] <= 1]


STATE_SPECS += [
    Spec('experience:tables', 'experience', 'monsterExperience', [('species', INT), ('nk', INT)],
         slow=True, assumptions=EXPERIENCE_ASSUMPTIONS,
         require_counterexamples=True, js_file='js/exper.js',
         state=[('monster.m_lev', (8, False), 'monster.m_lev'),
                ('monster.mrevived', (32, False), 'monster.mrevived'),
                ('monster.mcloned', (32, False), 'monster.mcloned'),
                ('u.uprops[MAGICAL_BREATHING].intrinsic', (64, True), None),
                ('u.uprops[MAGICAL_BREATHING].extrinsic', (64, True), None),
                ('gy.youmonst.data.mflags1', (64, False), None)],
         pre=experience_domain, configure=experience_state, arguments=experience_arguments,
         partitions=species_partitions,
         probes=[('monster level correspondence omitted', UnrelatedState(
             lambda s: experience_domain(s) + [s['species'] == 0, s['nk'] == 1], ('monster.m_lev',)))],
         mutants=[('js/exper.js', 'let award = 1 + level * level;', 'let award = 2 + level * level;')]),
]


def movement_domain(s, minimum_gallop=0):
    return [s['moving'] >= 0, s['moving'] <= 1, s['riding'] >= 0, s['riding'] <= 1,
            s['steed_present'] >= s['riding'], s['steed_present'] <= 1,
            s['monster.mspeed'] <= 3, s['u.ugallop'] >= minimum_gallop, s['u.ugallop'] <= 2 ** 53,
            s['svc.context.mv'] >= 0, s['svc.context.mv'] <= 1]


STATE_SPECS += [
    Spec('mcalcmove:tables', 'mcalcmove', 'mcalcmove',
         [('species', INT), ('moving', (8, False)), ('riding', INT), ('steed_present', INT), ('movement', INT)],
         slow=True, assumptions=MOVEMENT_ASSUMPTIONS,
         require_counterexamples=True, js_file='js/mon.js',
         state=[('monster.mspeed', (32, False), 'monster.mspeed'),
                ('u.ugallop', (64, True), 'game.u.ugallop'),
                ('svc.context.mv', SCHAR, 'game.context.mv')],
         pre=movement_domain, configure=movement_state, arguments=movement_arguments,
         partitions=species_partitions,
         probes=[('speed-state correspondence omitted', UnrelatedState(
             lambda s: movement_domain(s) + [s['species'] == 0, s['moving'] == 0, s['riding'] == 0],
             ('monster.mspeed',))),
                 ('negative gallop timer', lambda s: movement_domain(s, -1) + [
                     s['species'] == 0, s['moving'] == 0, s['riding'] == 1,
                     s['u.ugallop'] == -1, s['svc.context.mv'] == 1])],
         mutants=[('js/mon.js', 'random(NORMAL_SPEED) < adjustment',
                   'random(NORMAL_SPEED) <= adjustment')]),
]


# hack.c:weight_cap() temporarily clears property bits; the claim proves the
# C exit state equals its entry state for every mask it touches, so the
# read-only JavaScript port computes over the same effective state.
CAPACITY_ASSUMPTIONS = HERO_ASSUMPTIONS + (
    'acurr:all supplies equal pure Strength/Constitution in 3..125; acurrstr/currentStrength still execute their native/emitted condensation',
    'hack.c:weight_cap: ga.afternmv == Boots_on corresponds to the pending wear of the boot object',
    'youprop.h property masks: W_ARMF boot bit, one lumped other-extrinsic slot, intrinsic-or-timed sources, FROMOUTSIDE terrain and I_SPECIAL trap bits',
    'polyself.c:float_vs_flight/steed_vs_stealth: entry block bits satisfy their invariants; all four modified property masks are restored',
    'properties.js records: worn uarmf source is the only boot slot; intrinsic record nonempty and the timeout field cover HLevitation/HFlying',
    'disp.botl is TRUE at entry; weight_cap may request the same native redraw flag',
    'do_wear.c:Boots_on defers the encumbrance benefit exactly while the port sees pendingArmorAction wear of the boots',
)

CAPACITY_STATE = [
        ('h_lev', INT, None), ('e_boot', INT, None), ('e_other', INT, None),
    ('terr_lev', INT, None), ('trap_lev0', INT, None),
    ('h_fly', INT, None), ('e_fly', INT, None),
    ('terr_fly', INT, None), ('trap_fly0', INT, None),
    ('legs_left', INT, None), ('legs_right', INT, None),
    ('u.utrap', UINT, 'game.u.utrap'),
    ('u.utraptype', UINT, 'game.u.utraptype'),
    ('u.uz.dnum', (16, True), None),
    ('u.uz.dlevel', (16, True), None),
    ('svd.dungeon_topology.d_air_level.dnum', (16, True), None),
    ('svd.dungeon_topology.d_air_level.dlevel', (16, True), None),
]


def whole_domain(front):
    # One partition covering the whole domain: the grouped output query
    # case-splits internally instead of one query per path pair.
    return [('whole domain', {})]


def capacity_domain(s):
    flags = ('h_lev', 'e_boot', 'e_other', 'terr_lev', 'trap_lev0', 'h_fly',
             'e_fly', 'terr_fly', 'trap_fly0', 'legs_left', 'legs_right')
    return [s[key] >= 0 for key in flags] + [s[key] <= 1 for key in flags]


RESTORED_PROPERTIES = ('u.uprops[LEVITATION].extrinsic', 'u.uprops[LEVITATION].blocked',
                       'u.uprops[FLYING].blocked', 'u.uprops[STEALTH].blocked')

STATE_SPECS += [
    Spec('weight_cap:state', 'weight_cap', 'weightCapacity', [],
         js_file='js/hack.js', js_args=[('obj', 'game')],
         state=HERO + CAPACITY_STATE, references=WORN, configure=capacity_state,
         pre=capacity_domain, assumptions=CAPACITY_ASSUMPTIONS,
         dependencies=('acurr:all',), restored_state=RESTORED_PROPERTIES, result_range=(1, 1000), partitions=whole_domain,
         require_counterexamples=True,
         probes=[('summarized Strength correspondence omitted', UnrelatedState(
             capacity_domain, ('capacity-strength',)))],
         mutants=[('js/hack.js', 'capacity -= 200;', 'capacity -= 100;')]),
]

INVENTORY_FIELDS = [(f'invent[{i}].{field}', declared, None)
                    for i in range(4) for field, declared in (
                        ('otyp', (16, True)), ('oclass', (8, True)),
                        ('quan', (64, True)), ('owt', (32, False)), ('oeaten', (32, False)))]


def inventory_partitions(front):
    return [(f'chain length {length}', {'chain': length}) for length in range(5)]


def inventory_domain(s):
    return capacity_domain(s) + [s['chain'] >= 0, s['chain'] <= 4] + [
        s[f'invent[{i}].oeaten'] == 0 for i in range(4)] + (
            [s['xtra_wt'] >= -1000000, s['xtra_wt'] <= 1000000] if 'xtra_wt' in s else [])


STATE_SPECS += [
    Spec(name, native, port, params, js_file='js/hack.js',
         arguments=capacity_arguments,
         state=HERO + CAPACITY_STATE + [('chain', INT, None)] + INVENTORY_FIELDS,
         references=WORN, configure=inventory_state,
         pre=inventory_domain, assumptions=CAPACITY_ASSUMPTIONS + (
             'inventory is an acyclic, unshared nobj chain of length 0..4; JS array has the same order and length',
             'weights and quantities are 0..100000; types are GOLD_PIECE, BOULDER, DAGGER or FOOD_RATION; classes correspond; no partly eaten food',
             'for each non-coin, non-skipped object, cached native owt equals the emitted objectWeight reconstruction at entry',
             'weight_cap/weightCapacity use the separately proved weight_cap:state summary with equal capacity in 1..1000 and restored property state',
             'gw.wc is a native-only cache; its writes are tracked for calc_capacity but excluded from the cross-language exit projection',
         ),
         dependencies=('weight_cap:state',), native_only_state=('gw.wc',),
         partitions=inventory_partitions, require_counterexamples=True,
         probes=[('native cache correspondence omitted', UnrelatedState(
             inventory_domain, ('inventory-cache',)))],
         mutants=[('js/hack.js', old, new)])
    for name, native, port, params, old, new in (
        ('inv_weight:chain4', 'inv_weight', 'invWeight', [],
         '(quantity(object) + 50) / 100);', '(quantity(object) + 49) / 100);'),
        ('calc_capacity:chain4', 'calc_capacity', 'calcCapacity', [('xtra_wt', INT)],
         'excess * 2 / capacity', 'excess * 3 / capacity'),
        ('near_capacity:chain4', 'near_capacity', 'nearCapacity', [],
         'return calcCapacity(state, 0);', 'return calcCapacity(state, 1);'),
    )
]

STATE_SPECS += [
    Spec('sgn:inline', 'sgn', 'aimedDirection', [], js_file='js/muse.js', js_initializer='dx',
         state=[('target.x', INT, 'target.x')], configure=sign_state, arguments=sign_arguments,
         assumptions=('muse.js:aimedDirection dx initializer only; target.x is an arbitrary int delta and monster.mx is zero; enclosing caller excluded',),
         require_counterexamples=True,
         probes=[('inline delta correspondence omitted', UnrelatedState(lambda s: [], ('target.x',)))],
         mutants=[('js/muse.js', 'const dx = Math.sign(target.x - monster.mx), dy =',
                   'const dx = Math.sign(monster.mx - target.x), dy =')]),
]
