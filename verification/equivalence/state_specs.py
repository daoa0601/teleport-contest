"""Claims over explicit hero, monster and read-only call correspondences."""
import z3

from csym import CArray, CElement, CPtr, CState, CVal, convert
from jssym import V
from specs import (ATTRIBUTES, ATTRIB, HUMAN_FORM, INT,
                   INT_MAX, LONG, SCHAR, Spec, ULEVEL, UnrelatedState,
                   WEAPON_DAMAGE, int_argument)
from state_world import (native_objects, AT_ENGL, AT_WEAP,
                         capacity_state, direction_arguments, direction_state,
                         experience_arguments,
                         experience_state, hero_state, hit_bonus_state,
                         inventory_state, module_constant, movement_arguments, movement_state,
                         skill_bonus_arguments, skill_bonus_domain, skill_bonus_state,
                         species_predicate_arguments, species_predicate_state,
                         symbolic_attacks, symbolic_attack_arguments,
                         capacity_arguments, sign_state, sign_arguments,
                         weight_arguments, weight_domain, weight_state)
from core import select_int
from state_world import (_objects_member, _property_masks, erosion_matters_guard,
                         monster_state, native_monsters,
                         object_predicate_arguments,
                         object_predicate_state, present_monster_arguments,
                         real_object_precondition, resistance_state,
                         weapon_type_arguments, weapon_type_state)
UINT = (32, False)

WORN = [(slot, (f'game.{slot}', f'game.u.{slot}')) for slot in ('uarmg', 'uarmh', 'uwep')]
ITEM_FIELDS = [('uarmg.otyp', (16, True), 'game.uarmg.otyp'),
               ('uarmh.otyp', (16, True), 'game.uarmh.otyp'),
               ('uwep.oartifact', SCHAR, 'game.uwep.oartifact')]
HERO = ATTRIBUTES + HUMAN_FORM + ITEM_FIELDS

STATE_C_FILES = ('artifact.c', 'monst.c', 'makemon.c', 'mon.c', 'worn.c',
                 'mondata.c', 'polyself.c', 'dungeon.c', 'mkobj.c', 'objnam.c',
                 'dothrow.c', 'display.c', 'glyphs.c')
STATE_JS_FILES = (
    'js/monster_data.js', 'js/monster_attack_types.js', 'js/artifact.js',
    'js/artifact_data.js', 'js/makemon.js', 'js/polyself.js', 'js/dungeon.js',
    'js/mon.js', 'js/monmove.js', 'js/hack.js', 'js/mkobj.js',
    'js/properties.js', 'js/property_types.js', 'js/do_wear.js', 'js/muse.js',
    'js/cmd.js', 'js/mondata.js', 'js/objnam.js', 'js/o_init.js',
    'js/object_properties.js', 'js/glyph_numbers.js', 'js/getpos.js',
    'js/display.js', 'js/senses.js', 'js/objclass.js',
)


def full_attributes(s):
    return [s['chridx'] >= 0, s['chridx'] < 6]


HERO_ASSUMPTIONS = (
    'polyself.c:set_uasmon: hero data points to mons[u.umonnum], 0 <= u.umonnum < NUMMONS',
    'monst.c:monst_globals_init: fields read retain mons_init values; emitted table fields retain initial values',
    'artifact.js:initializeArtifacts: runtime map retains artifact_data identity/name pairs',
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
    Spec('abon:forms', 'abon', 'heroAttackBonus', [],
         assumptions=HERO_ASSUMPTIONS + (
             'dungeon.c:level_difficulty: assumed equal pure xint16 result in 1..32767',
             'monst.h:mvitals.died: corresponding Wizard death count; other JS counters are independent uchar values',
         ),
         require_counterexamples=True, slow=True, js_file=WEAPON_DAMAGE, js_args=[('obj', 'game')],
         state=HERO + ULEVEL + [('svm.mvitals[PM_WIZARD_OF_YENDOR].died', (8, False), None)],
         references=WORN, configure=hit_bonus_state,
         pre=lambda s: [s['u.ulevel'] >= 1, s['u.ulevel'] <= 30],
         probes=[('base Dexterity correspondence omitted', UnrelatedState(
             lambda s: [s['u.ulevel'] >= 1, s['u.ulevel'] <= 30,
                        s['u.umonnum'] == s['u.umonster']], ('u.acurr.a[3]',)))],
         mutants=[(WEAPON_DAMAGE, 'adjustedMonsterLevel(heroSpecies(state)) - 3',
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
MONSTER_DATA = 'js/mondata.js'

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
        ('attacktype:armed', 'attacktype', 'speciesHasWeaponAttack', 'js/mondata.js',
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
    'disp.botl and the related game.context.botl are TRUE at entry; weight_cap may repeat that redraw request without changing either entry value',
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


CAPACITY_FLAGS = ('h_lev', 'e_boot', 'e_other', 'terr_lev', 'trap_lev0', 'h_fly',
                  'e_fly', 'terr_fly', 'trap_fly0', 'legs_left', 'legs_right')


def capacity_domain(s):
    return [s[key] >= 0 for key in CAPACITY_FLAGS] + [s[key] <= 1 for key in CAPACITY_FLAGS]


def grounded_hero(s, legs=True):
    """A concrete corner (no levitation, flight, trap and, unless legs is
    False, no wounded legs) for negative checks, which need one
    counterexample, not the whole domain."""
    keys = CAPACITY_FLAGS if legs else CAPACITY_FLAGS[:-2]
    return [s[key] == 0 for key in keys] + [s['u.utrap'] == 0]


RESTORED_PROPERTIES = ('u.uprops[LEVITATION].extrinsic', 'u.uprops[LEVITATION].blocked',
                       'u.uprops[FLYING].blocked', 'u.uprops[STEALTH].blocked')

STATE_SPECS += [
    Spec('weight_cap:state', 'weight_cap', 'weightCapacity', [],
         slow=True, js_file='js/hack.js', js_args=[('obj', 'game')],
         state=HERO + CAPACITY_STATE, references=WORN, configure=capacity_state,
         pre=capacity_domain, assumptions=CAPACITY_ASSUMPTIONS,
         dependencies=('acurr:all',), restored_state=RESTORED_PROPERTIES, result_range=(1, 1000), partitions=whole_domain,
         require_counterexamples=True,
         probes=[('summarized Strength correspondence omitted', UnrelatedState(
             lambda s: capacity_domain(s) + grounded_hero(s), ('capacity-strength',)))],
         # 'capacity -= 200' is the both-legs-wounded branch
         mutant_pre=lambda s: [*grounded_hero(s, legs=False), s['legs_left'] == 1,
                               s['legs_right'] == 1],
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
    Spec(name, native, port, params, slow=True, js_file='js/hack.js',
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

# ---- fv-equivalence-batch-3: direction, skill, table and weight leaves ----

STATE_SPECS += [
    Spec('xytodir', 'xytodir', 'xyToDirection', [('x', LONG), ('y', LONG)],
         js_file='js/cmd.js', require_counterexamples=True, configure=direction_state,
         arguments=direction_arguments,
         assumptions=('decl.c xdir/ydir and js/const.js xdir/ydir retain their initial values; findIndex scans the same ten entries as the C loop over N_DIRS',
                      'C int parameters narrow arbitrary long arguments; the claim keeps both deltas inside C int',),
         pre=lambda s: [s['x'] >= -2 ** 31, s['x'] <= INT_MAX,
                        s['y'] >= -2 ** 31, s['y'] <= INT_MAX],
         probes=[('x wraps to the -1 offset outside C int',
                  lambda s: [s['x'] == 2 ** 32 - 1, s['y'] == 0])],
         mutants=[('js/cmd.js', 'return direction < 8 ? direction : -1;',
                   'return direction < 7 ? direction : -1;')]),
]


ROLE_KEY = [
    ('PM_ARCHEOLOGIST', 'archeologist'), ('PM_BARBARIAN', 'barbarian'),
    ('PM_CAVE_DWELLER', 'caveman'), ('PM_HEALER', 'healer'), ('PM_KNIGHT', 'knight'),
    ('PM_MONK', 'monk'), ('PM_CLERIC', 'priest'), ('PM_RANGER', 'ranger'),
    ('PM_ROGUE', 'rogue'), ('PM_SAMURAI', 'samurai'), ('PM_TOURIST', 'tourist'),
    ('PM_VALKYRIE', 'valkyrie'), ('PM_WIZARD', 'wizard')]
ROLE_ENUM = [('gu.urole.mnum', (16, True), 'game.urole.key', ROLE_KEY)]

WEAPON_BONUS_STATE = (
    [('weapon.oclass', (8, True), 'weapon.oclass'),
     ('weapon.otyp', (16, True), 'weapon.otyp'),
     ('u.twoweap', (8, True), 'game.u.twoweap')]
    + [(f'u.weapon_skills[{i}].skill', (16, True), None) for i in range(38)]
)
WEAPON_BONUS_PARAMS = [('weapon_present', INT), ('uwep_present', INT),
                       ('uswapwep_present', INT), ('is_uwep', INT),
                       ('is_uswapwep', INT), ('usteed_present', INT)]
WEAPON_BONUS_ASSUMPTIONS = (
    'weapon.c:weapon_hit_bonus/weapon_dam_bonus: the weapon argument is null, uwep, uswapwep or an unrelated held object; C pointer identity corresponds to JS reference identity',
    'wield.c: two-weapon combat holds only with both weapons wielded; every unwield path clears u.twoweap',
    'weapon.c:skill_init/use_skill never advance a skill past its role maximum; only u_init.c grants master/grand master and only for P_MARTIAL_ARTS, so every other entry stays <= P_EXPERT and weapon.c\'s impossible() default arms stay unreachable',
    'objects.c:objects_globals_init and object_data.js tables retain their initial values; otyp covers every type with an emitted subtype entry',
    'skills.h P_SKILL: u.weapon_skills and game.u.weaponSkills correspond entry for entry; role key corresponds to gu.urole.mnum',
)

STATE_SPECS += [
    Spec('weapon_hit_bonus:state', 'weapon_hit_bonus', 'weaponSkillHitBonus',
         WEAPON_BONUS_PARAMS, js_file='js/weapon.js', require_counterexamples=True,
         state=WEAPON_BONUS_STATE, enum_state=ROLE_ENUM, configure=skill_bonus_state,
         arguments=skill_bonus_arguments, pre=skill_bonus_domain,
         assumptions=WEAPON_BONUS_ASSUMPTIONS,
         probes=[('riding skill correspondence omitted', UnrelatedState(
             lambda s: skill_bonus_domain(s) + [s['usteed_present'] == 1],
             ('u.weapon_skills[37].skill',)))],
         mutants=[('js/weapon.js', 'bonus = level <= P_UNSKILLED ? -4 : level === P_BASIC ? 0',
                   'bonus = level <= P_UNSKILLED ? -5 : level === P_BASIC ? 0'),
                  ('js/weapon.js', 'if (riding <= P_UNSKILLED)\n            bonus -= 2;',
                   'if (riding <= P_UNSKILLED)\n            bonus -= 3;')]),
    Spec('weapon_dam_bonus:state', 'weapon_dam_bonus', 'weaponSkillDamageBonus',
         WEAPON_BONUS_PARAMS, slow=True, js_file='js/weapon.js', require_counterexamples=True,
         state=WEAPON_BONUS_STATE, enum_state=ROLE_ENUM, configure=skill_bonus_state,
         arguments=skill_bonus_arguments, pre=skill_bonus_domain,
         assumptions=WEAPON_BONUS_ASSUMPTIONS,
         probes=[('riding skill correspondence omitted', UnrelatedState(
             lambda s: skill_bonus_domain(s) + [s['usteed_present'] == 1],
             ('u.weapon_skills[37].skill',)))],
         mutants=[('js/weapon.js', ': level === P_SKILLED ? 1 : level === P_EXPERT ? 2 : -2;',
                   ': level === P_SKILLED ? 1 : level === P_EXPERT ? 3 : -2;'),
                  ('js/weapon.js', 'if (riding === P_SKILLED)\n            bonus++;',
                   'if (riding === P_BASIC)\n            bonus++;')]),
]


def species_record_arguments(world, front):
    values = {name: value for name, value, _ in world.params}
    pointer = CPtr(values['native_pointer_present'] != 0,
                   CElement('mons', values['species']))
    return ([pointer], [V('record', {'mnum': V('num', values['species'])})])


STATE_SPECS += [
    Spec(name, native, port, [('species', INT), ('native_pointer_present', INT)],
         slow=name == 'passes_bars:tables', js_file=js_file,
         assumptions=PREDICATE_ASSUMPTIONS, require_counterexamples=True,
         configure=species_predicate_state, arguments=species_record_arguments,
         pre=lambda s: [s['species'] >= 0, s['native_pointer_present'] == 1],
         probes=[('null native species pointer', lambda s: [s['species'] >= 0,
                                                          s['native_pointer_present'] == 0])],
         mutants=[(js_file, old, new)])
    for name, native, port, js_file, old, new in (
        ('is_animal:tables', 'verification_is_animal', 'monsterIsAnimal',
         MONSTER_DATA, '?? -1] ?? 0) & M1_ANIMAL);', '?? -1] ?? 0) & M1_HUMANOID);'),
        ('noncorporeal:tables', 'verification_noncorporeal', 'monsterIsNoncorporeal',
         MONSTER_DATA, 'MONSTER_SYMBOL[monster?.mnum ?? -1] === S_GHOST;',
         'MONSTER_SYMBOL[monster?.mnum ?? -1] === S_GHOST + 1;'),
        ('passes_bars:tables', 'passes_bars', 'monsterPassesBars',
         'js/mondata.js', 'return monsterPassesWalls(mnum) || monsterIsAmorphous(monster)',
         'return monsterIsAmorphous(monster)'),
    )
]


# polyself.c's armor_to_dragon switch covers exactly the ten dragon scale
# mails and ten dragon scales; the pinned object enum assigns them the two
# contiguous intervals below (the DEFERRED shimmering entries are #if 0).
def dragon_state(world, front, modules):
    names = ('GRAY_DRAGON_SCALE_MAIL', 'YELLOW_DRAGON_SCALE_MAIL',
             'GRAY_DRAGON_SCALES', 'YELLOW_DRAGON_SCALES')
    values = tuple(front.enum_value(name) for name in names)
    if values != (101, 110, 111, 120):
        raise Unsupported(f'pinned dragon armor otyp interval changed: {values}')


DRAGON_MIN, DRAGON_MAX = 101, 120


def armor_arguments(world, front):
    armotyp = next(value for name, value, _ in world.params if name == 'armotyp')
    return ([CVal(armotyp, (32, True))], [V('record', {'otyp': V('num', armotyp)})])


STATE_SPECS += [
    Spec('armor_to_dragon', 'armor_to_dragon', 'dragonFormForArmor', [('armotyp', INT)],
         slow=True, js_file='js/polyself.js', require_counterexamples=True, configure=dragon_state,
         arguments=armor_arguments,
         assumptions=('polyself.c:armor_to_dragon and js/polyself.js:dragonFormForArmor read the initial object and monster-name tables',
                      'C returns NON_PM (-1) where the port returns null and every caller tests that value for truthiness; the claim covers exactly the dragon scale-mail and scales otyps',),
         pre=lambda s: [s['armotyp'] >= DRAGON_MIN, s['armotyp'] <= DRAGON_MAX],
         probes=[('nondragon armor returns NON_PM versus null',
                  lambda s: [s['armotyp'] == DRAGON_MIN - 1])],
         mutants=[('js/polyself.js', 'return firstDragon + type - GRAY_DRAGON_SCALE_MAIL;',
                   'return firstDragon + type - GRAY_DRAGON_SCALE_MAIL + 1;')]),
]


def weight_partitions(front):
    """One proof per claimed object type: a fixed otyp makes every objects[]
    read constant. The corpse type keeps a symbolic but always-valid species
    (mkobj assigns one), so its mons[] weight select is chunked into
    exhaustive species intervals."""
    def fixed_type(otyp):
        def constraints(s, _otyp=otyp):
            return [s['obj.otyp'] == _otyp]
        return constraints
    names = ('GOLD_PIECE', 'DAGGER', 'FOOD_RATION', 'GLOB_OF_GRAY_OOZE')
    partitions = [(f'object type {name}', fixed_type(front.enum_value(name)))
                  for name in names]
    corpse = front.enum_value('CORPSE')
    species = front.enum_value('NUMMONS')
    step = 48
    for low in range(0, species, step):
        high = min(low + step, species)
        def corpse_chunk(s, _low=low, _high=high, _corpse=corpse):
            return [s['obj.otyp'] == _corpse,
                    s['obj.corpsenm'] >= _low, s['obj.corpsenm'] < _high]
        partitions.append((f'corpse species {low}..{high}', corpse_chunk))
    return partitions

WEIGHT_STATE = [(f'obj.{field}', declared, f'obj.{field}') for field, declared in (
    ('otyp', (16, True)), ('oclass', (8, True)), ('quan', (64, True)),
    ('owt', (32, False)), ('oeaten', (32, False)), ('corpsenm', (32, True)),
    ('globby', (32, False)))]
WEIGHT_ASSUMPTIONS = (
    'objects.c:objects_globals_init and monst.c:monst_globals_init: native tables retain initial values; emitted OBJECT_WEIGHT and MONSTER_BODY_META retain theirs',
    'obj.quan >= 1, oeaten == 0 and corpsenm is a valid species (mkobj.c assigns one when it creates a CORPSE; eaten_stat\'s table-selected divisor is difftest territory); otyp is GOLD_PIECE, DAGGER, FOOD_RATION, CORPSE or GLOB_OF_GRAY_OOZE; no container contents (the cobj recursion is a separate extension)',
    'mkobj keeps oclass equal to objects[otyp].oc_class; C tests the CORPSE type before the coin class while the port tests the class first, so type/class disagreements are outside this domain',
    'mksobj creates globs only as food, so the glob branch precedes the coin branch on both sides',
    'owt stays within INT_MAX: C returns (int) obj->owt for globs and heavy iron balls, and only a wizard-mode glob wish exceeds it',
)

STATE_SPECS += [
    Spec('weight:stack', 'weight', 'objectWeight', [], slow=True, js_file='js/mkobj.js',
         require_counterexamples=True, state=WEIGHT_STATE, partitions=weight_partitions,
         configure=weight_state, arguments=weight_arguments, pre=weight_domain,
         assumptions=WEIGHT_ASSUMPTIONS,
         probes=[('quantity correspondence omitted', UnrelatedState(
             weight_domain, ('obj.quan',)))],
         mutants=[('js/mkobj.js', 'Math.max(1, Math.trunc((quantity(object) + 50) / 100));',
                   'Math.max(1, Math.trunc((quantity(object) + 49) / 100));')]),
]


# ---- fv-equivalence-batch-4: species, monster and object leaf predicates ----

SHIFTER_ASSUMPTIONS = (
    'mondata.c:mon_hates_blessings: monster.data points to mons[species]; emitted mnum equals species',
    'monst.c:monst_globals_init: native mons[] rows and the emitted MONSTER_FLAGS2/MONSTER_SYMBOL tables retain their initial values',
    'monst.h:is_vampshifter compares cham with the three vampire species; the emitted test reads MONSTER_SYMBOL[cham], so the claim keeps cham a valid species index: cham == NON_PM (-1) and an absent cham field both return false at runtime through an out-of-bounds undefined read and stay outside the symbolic domain',
    'makemon.c:newcham and mon.c:set_mon_data keep cham at NON_PM or the shapeshifter species; the emitted vampire test covers the whole species table',
)


def shifter_state(world, front, modules):
    monster_state(world, front, modules)
    world.pre.append(world.c_state['monster.cham'][0] < front.enum_value('NUMMONS'))


STATE_SPECS += [
    Spec('verysmall:tables', 'verification_verysmall', 'monsterIsVerySmall',
         [('species', INT), ('native_pointer_present', INT)], js_file=MONSTER_DATA,
         assumptions=PREDICATE_ASSUMPTIONS, require_counterexamples=True,
         configure=species_predicate_state, arguments=species_predicate_arguments,
         pre=lambda s: [s['species'] >= 0, s['native_pointer_present'] == 1],
         probes=[('null native species pointer', lambda s: [s['species'] >= 0,
                                                           s['native_pointer_present'] == 0])],
         mutants=[(MONSTER_DATA, 'return (MONSTER_SIZE[mnum] ?? MZ_SMALL) < MZ_SMALL;',
                   'return (MONSTER_SIZE[mnum] ?? MZ_SMALL) <= MZ_SMALL;')]),
    Spec('haseyes:tables', 'verification_haseyes', 'monsterHasEyes',
         [('species', INT), ('native_pointer_present', INT)], js_file=MONSTER_DATA,
         assumptions=PREDICATE_ASSUMPTIONS, require_counterexamples=True,
         configure=species_predicate_state, arguments=species_predicate_arguments,
         pre=lambda s: [s['species'] >= 0, s['native_pointer_present'] == 1],
         probes=[('null native species pointer', lambda s: [s['species'] >= 0,
                                                           s['native_pointer_present'] == 0])],
         mutants=[(MONSTER_DATA, 'return !((MONSTER_FLAGS1[mnum] ?? 0) & M1_NOEYES);',
                   'return !!((MONSTER_FLAGS1[mnum] ?? 0) & M1_NOEYES);')]),
    Spec('breathless:tables', 'verification_breathless', 'monsterIsBreathless',
         [('species', INT), ('native_pointer_present', INT)], js_file=MONSTER_DATA,
         assumptions=PREDICATE_ASSUMPTIONS, require_counterexamples=True,
         configure=species_predicate_state, arguments=species_predicate_arguments,
         pre=lambda s: [s['species'] >= 0, s['native_pointer_present'] == 1],
         probes=[('null native species pointer', lambda s: [s['species'] >= 0,
                                                           s['native_pointer_present'] == 0])],
         mutants=[(MONSTER_DATA, 'return !!((MONSTER_FLAGS1[mnum] ?? 0) & M1_BREATHLESS);',
                   'return !!((MONSTER_FLAGS1[mnum] ?? 0) & M1_NOHEAD);')]),
    Spec('hates_silver:tables', 'hates_silver', 'monsterSpeciesHatesSilver',
         [('species', INT), ('native_pointer_present', INT)], js_file=MONSTER_DATA,
         assumptions=PREDICATE_ASSUMPTIONS + (
             'mondata.c:hates_silver: the native pointer identity tests (PM_SHADE, PM_TENGU) correspond to the emitted species-index comparisons',
         ), require_counterexamples=True,
         configure=species_predicate_state, arguments=species_predicate_arguments,
         pre=lambda s: [s['species'] >= 0, s['native_pointer_present'] == 1],
         probes=[('null native species pointer', lambda s: [s['species'] >= 0,
                                                           s['native_pointer_present'] == 0])],
         mutants=[(MONSTER_DATA, '|| mnum === PM_SHADE', '|| mnum === PM_SHADE + 1'),
                  (MONSTER_DATA, '(symbol === S_IMP && mnum !== PM_TENGU);',
                   '(symbol === S_IMP && mnum === PM_TENGU);')]),
    Spec('mon_hates_blessings:state', 'mon_hates_blessings', 'monsterHatesBlessings',
         [('species', INT), ('native_monster_present', INT)],
         js_file=MONSTER_DATA, state=[('monster.cham', (16, True), 'monster.cham')],
         assumptions=SHIFTER_ASSUMPTIONS, require_counterexamples=True,
         configure=shifter_state, arguments=present_monster_arguments,
         pre=lambda s: [s['monster.cham'] >= 0, s['native_monster_present'] == 1],
         probes=[('null native monster pointer', lambda s: [s['monster.cham'] >= 0,
                                                           s['native_monster_present'] == 0]),
                 ('shifter species correspondence omitted', UnrelatedState(
                     lambda s: [s['monster.cham'] >= 0, s['native_monster_present'] == 1],
                     ('monster.cham',)))],
         mutants=[(MONSTER_DATA, '(monsterIsUndead(monster?.mnum ?? -1) || monsterIsDemon(monster?.mnum ?? -1));',
                   'monsterIsUndead(monster?.mnum ?? -1);')]),
    Spec('mon_resistancebits:state', 'verification_mon_resistancebits', 'monsterResistanceBits',
         [('species', INT), ('native_monster_present', INT)], js_file='js/mondata.js',
         state=[('monster.mextrinsics', (16, False), 'monster.mextrinsics'),
                ('monster.mintrinsics', (16, False), 'monster.mintrinsics')],
         assumptions=SHIFTER_ASSUMPTIONS[:2] + (
             'monst.h:mon_resistancebits reads data->mresists | mextrinsics | mintrinsics; the two monst masks are unsigned short, so the emitted int32 \'|\' is exact',
         ), require_counterexamples=True,
         configure=resistance_state, arguments=present_monster_arguments,
         pre=lambda s: [s['native_monster_present'] == 1],
         probes=[('null native monster pointer', lambda s: [s['native_monster_present'] == 0]),
                 # Pinning the species and the other mask keeps the expected
                 # counterexample a one-step search; the open query can exhaust
                 # the solver timeout on a loaded runner.
                 ('intrinsic mask correspondence omitted', UnrelatedState(
                     lambda s: [s['native_monster_present'] == 1, s['species'] == 0,
                                s['monster.mextrinsics'] == 0],
                     ('monster.mintrinsics',)))],
         # The open-domain search for this mutant's counterexample exceeded
         # the solver timeout on a loaded CI runner; one concrete row suffices.
         mutant_pre=lambda s: [s['species'] == 0, s['monster.mextrinsics'] == 0],
         mutants=[('js/mondata.js',
                   '| (monster?.mextrinsics ?? 0) | (monster?.mintrinsics ?? 0);',
                   '| (monster?.mextrinsics ?? 0);')]),
]

OBJECT_PREDICATE_ASSUMPTIONS = (
    'objects.c:objects_globals_init and object_data.js tables retain their initial values; o_init.js:objectMaterial reads the emitted per-game material map first, so the claim relates the initial emitted OBJECT_MATERIAL entries and leaves the o_init.c:shuffle correspondence (same algorithm on both sides) outside the entry relation',
)


def object_table_index_precondition(world, front, otyp):
    """Keep otyp inside both tables: the native objects[] carries one
    terminator row past NUM_OBJECTS, and the emitted per-otyp arrays stop
    at NUM_OBJECTS, so both sides read in bounds exactly below it."""
    world.pre.extend([otyp >= 0, otyp < front.enum_value('NUM_OBJECTS')])


def erosion_state(world, front, modules):
    object_predicate_state('obj')(world, front, modules)
    object_table_index_precondition(world, front, world.c_state['obj.otyp'][0])


def all_damageable_state(world, front, modules):
    object_predicate_state('otmp')(world, front, modules)
    native = world.c_state['otmp.otyp'][0]
    port = world.js_state['otmp.otyp']
    count = front.enum_value('NUM_OBJECTS')
    world.pre.extend([native >= 0, native < count, port >= 0, port < count])


def damageable_state(world, front, modules):
    object_predicate_state('otmp')(world, front, modules)
    object_table_index_precondition(world, front, world.c_state['otmp.otyp'][0])
    world.pre.append(real_object_precondition(
        world, front, world.c_state['otmp.otyp'][0]))


def guarded_erosion_state(world, front, modules):
    damageable_state(world, front, modules)
    symbols = {name: value for name, (value, _) in world.c_state.items()}
    # readobjnam guards these tests with erosion_matters(). Relate the
    # stored class to the type as mkobj does for initialized objects.
    classes = _objects_member(world, front, 'oc_class')
    world.pre.append(symbols['otmp.oclass']
                     == select_int(classes, symbols['otmp.otyp']))
    world.pre.append(erosion_matters_guard(
        world, front, symbols['otmp.otyp'], symbols['otmp.oclass']))


def weapon_type_domain(world, front, modules):
    weapon_type_state(world, front, modules)
    object_table_index_precondition(world, front, world.c_state['weapon.otyp'][0])


STATE_SPECS += [
    Spec('erosion_matters:tables', 'erosion_matters', 'erosionMatters', [],
         js_file='js/objnam.js', state=[('obj.oclass', (8, True), 'obj.oclass'),
                                        ('obj.otyp', (16, True), 'obj.otyp')],
         assumptions=OBJECT_PREDICATE_ASSUMPTIONS + (
             'objnam.c:erosion_matters covers every otyp in 0..NUM_OBJECTS-1 and any oclass; otyp NUM_OBJECTS is the native terminator row and reads out of bounds in the port',
         ),
         require_counterexamples=True, configure=erosion_state,
         arguments=object_predicate_arguments('obj'),
         pre=lambda s: [],
         probes=[('oclass correspondence omitted', UnrelatedState(
             lambda s: [], ('obj.oclass',)))],
         mutants=[('js/objnam.js',
                   'if ([WEAPON_CLASS, ARMOR_CLASS, BALL_CLASS, CHAIN_CLASS]\n        .includes(object.oclass))',
                   'if ([WEAPON_CLASS, ARMOR_CLASS, BALL_CLASS]\n        .includes(object.oclass))')]),
    Spec('is_damageable:tables', 'verification_damageable', 'is_damageable', [],
         js_file='js/object_properties.js', state=[('otmp.oclass', (8, True), 'otmp.oclass'),
                                        ('otmp.otyp', (16, True), 'otmp.otyp')],
         assumptions=OBJECT_PREDICATE_ASSUMPTIONS[:1] + (
             'objclass.h:is_damageable expands is_flammable (mkobj.c, with its candle and fire-resistance exclusions), is_rottable, is_rustprone, is_corrodeable and is_crackable; every otyp in 0..NUM_OBJECTS-1 is included, with any signed-char oclass; each initial table is executed independently',
         ),
         require_counterexamples=True, configure=all_damageable_state,
         arguments=object_predicate_arguments('otmp'),
         pre=lambda s: [],
         probes=[('otyp correspondence omitted', UnrelatedState(
             lambda s: [s['otmp.otyp'] == 34, z3.Int('js:otmp.otyp') == 440], ('otmp.otyp',)))],
         mutant_pre=lambda s: [s['otmp.otyp'] == 101],
         mutants=[('js/object_properties.js',
                   'return objectIsRustprone(object) || objectIsFlammable(object)\n        || objectIsRottable(object) || objectIsCorrodeable(object)\n        || objectIsCrackable(object);',
                   'return objectIsRustprone(object) || objectIsFlammable(object)\n        || objectIsCorrodeable(object)\n        || objectIsCrackable(object);')]),
    Spec('primary_erosion:tables', 'verification_primary_erosion',
         'objectAcceptsPrimaryErosion', [],
         js_file='js/objnam.js', state=[('otmp.oclass', (8, True), 'otmp.oclass'),
                                        ('otmp.otyp', (16, True), 'otmp.otyp')],
         assumptions=OBJECT_PREDICATE_ASSUMPTIONS + (
             'objnam.c:readobjnam evaluates is_flammable(o) || is_rustprone(o) || is_crackable(o) only inside its erosion_matters guard, and oclass equals objects[otyp].oc_class (mkobj.c), so the candle rows (TOOL_CLASS with zero oc_skill), wands and every fire-resistance oprop row with a flammable material stay outside the entry domain; there C\'s is_flammable exclusions and the port\'s material test agree',
         ),
         require_counterexamples=True, configure=guarded_erosion_state,
         arguments=object_predicate_arguments('otmp'),
         pre=lambda s: [],
         probes=[('otyp correspondence omitted', UnrelatedState(
             lambda s: [], ('otmp.otyp',)))],
         mutants=[('js/objnam.js',
                   'return objectIsFlammable(object) || objectIsRustprone(object)\n        || objectIsCrackable(object);',
                   'return objectIsFlammable(object)\n        || objectIsCrackable(object);')]),
    Spec('secondary_erosion:tables', 'verification_secondary_erosion',
         'objectAcceptsSecondaryErosion', [],
         js_file='js/objnam.js', state=[('otmp.oclass', (8, True), 'otmp.oclass'),
                                        ('otmp.otyp', (16, True), 'otmp.otyp')],
         assumptions=OBJECT_PREDICATE_ASSUMPTIONS + (
             'objnam.c:readobjnam evaluates is_corrodeable(o) || is_rottable(o) only inside its erosion_matters guard, with oclass equal to objects[otyp].oc_class (mkobj.c)',
         ),
         require_counterexamples=True, configure=guarded_erosion_state,
         arguments=object_predicate_arguments('otmp'),
         pre=lambda s: [],
         probes=[('otyp correspondence omitted', UnrelatedState(
             lambda s: [], ('otmp.otyp',)))],
         mutants=[('js/objnam.js',
                   'return objectIsCorrodeable(object) || objectIsRottable(object);',
                   'return objectIsCorrodeable(object);')]),
    Spec('weapon_type:tables', 'weapon_type', 'weaponSkillType',
         [('weapon_present', INT)],
         js_file='js/weapon.js', state=[('weapon.oclass', (8, True), 'weapon.oclass'),
                                        ('weapon.otyp', (16, True), 'weapon.otyp')],
         assumptions=OBJECT_PREDICATE_ASSUMPTIONS[:1] + (
             'weapon.c:weapon_type reads objects[otyp].oc_skill; object_data.js OBJECT_SUBTYPE keeps that column, including the negative launcher/ammo entries the port passes through Math.abs',
             'the null argument is unwielding bare-handed combat; otyp stays inside the emitted subtype table (NUM_OBJECTS rows) while the native table carries one terminator row more',
         ),
         require_counterexamples=True, configure=weapon_type_domain,
         arguments=weapon_type_arguments,
         pre=lambda s: [s['weapon_present'] >= 0, s['weapon_present'] <= 1],
         probes=[('otyp correspondence omitted', UnrelatedState(
             lambda s: [s['weapon_present'] >= 0, s['weapon_present'] <= 1,
                        s['weapon_present'] == 1], ('weapon.otyp',)))],
         mutants=[('js/weapon.js', 'if (![WEAPON_CLASS, TOOL_CLASS, GEM_CLASS].includes(weapon.oclass))',
                   'if (![WEAPON_CLASS, TOOL_CLASS].includes(weapon.oclass))'),
                  ('js/weapon.js', 'return Math.abs(skill);', 'return skill;')]),
]

# ---- fv-equivalence-batch-6: the obj.h/objclass.h object-class predicates ----

# obj.h/objclass.h define these predicates as macros over objects[] columns
# that object_data.js keeps as per-otyp arrays; the correspondence holds at
# every initial row (checked concretely over the whole table before proving):
# oc_skill = OBJECT_SUBTYPE, oc_dir = OBJECT_DIR, oc_bimanual (the oc_big
# alias) = OBJECT_BIMANUAL, oc_charged = OBJECT_CHARGED, oc_material =
# OBJECT_MATERIAL, and OBJECT_NAMES names only RUBBER_HOSE "rubber hose".
OBJ_FILE = 'js/object_properties.js'

OBJECT_MACRO_ASSUMPTIONS = OBJECT_PREDICATE_ASSUMPTIONS + (
    'obj.h reads objects[otyp].oc_skill, oc_dir, oc_bimanual, oc_charged and oc_material; the native and emitted initializers execute independently over every otyp in 0..NUM_OBJECTS-1, and these columns retain their initial values',
)

CLASS_INVARIANT_ASSUMPTION = (
    'mkobj.c initializes oclass from objects[otyp].oc_class; these claims relate that initialized class on both sides, while each owner tests the stored instance class directly',
)

ARTIFACT_OBJECT_ASSUMPTIONS = (
    'obj.h oartifact is the artifact index (obj.h char); artifact.c:is_art compares it with ART_GRIMTOOTH/ART_SNICKERSNEE, and artifact.js:artifactById reads the emitted ARTIFACT_DATA runtime map (initializeArtifacts copies identity/name/invokePower) in which only id ART_GRIMTOOTH carries invokePower "fling-poison" and only id ART_SNICKERSNEE is named "Snickersnee" (checked concretely)',
)


def classed_object_state(prefix):
    """object_predicate_state plus the mkobj oclass invariant. obj.h's
    class-guarded macros read otmp->oclass; both sides use the initialized
    class here, although the owners also reject the zero class directly."""
    def state(world, front, modules):
        object_predicate_state(prefix)(world, front, modules)
        object_table_index_precondition(world, front, world.c_state[f'{prefix}.otyp'][0])
        symbols = {name: value for name, (value, _) in world.c_state.items()}
        classes = _objects_member(world, front, 'oc_class')
        world.pre.append(symbols[f'{prefix}.oclass']
                         == select_int(classes, symbols[f'{prefix}.otyp']))
    return state


def plain_object_state(prefix):
    """object_predicate_state with only the table-index restriction: the
    predicate reads the object's own oclass directly, as the macro does."""
    def state(world, front, modules):
        object_predicate_state(prefix)(world, front, modules)
        object_table_index_precondition(world, front, world.c_state[f'{prefix}.otyp'][0])
    return state


def artifact_runtime(world, front, modules):
    """The emitted artifact identity/name/invokePower map artifactById reads
    through its default game argument, as can_track:state relates it."""
    artifacts = module_constant(world, modules, 'js/artifact_data.js', 'ARTIFACT_DATA')
    world.js_values['game._artifactRuntime'] = V('map', tuple(
        (artifact.v['id'], artifact) for artifact in artifacts.v))


def artifact_object_state(prefix):
    def state(world, front, modules):
        plain_object_state(prefix)(world, front, modules)
        symbols = {name: value for name, (value, _) in world.c_state.items()}
        world.c_globals[f'{prefix}.oartifact'] = CVal(
            symbols[f'{prefix}.oartifact'], SCHAR)
        artifact_runtime(world, front, modules)
    return state


def wet_towel_state(world, front, modules):
    """obj.h:is_wet_towel reads only otyp and spe; no objects[] row is read,
    so otyp spans the whole short range and spe the whole schar range."""
    symbols = {name: value for name, (value, _) in world.c_state.items()}
    for field, declared in (('otyp', (16, True)), ('spe', SCHAR)):
        world.c_globals[f'otmp.{field}'] = CVal(symbols[f'otmp.{field}'], declared)


def graystone_state(world, front, modules):
    """obj.h:is_graystone compares otyp with four constants; no table read."""
    world.c_globals['obj.otyp'] = CVal(world.c_state['obj.otyp'][0], (16, True))


def permapoisoned_state(world, front, modules):
    """artifact.c:permapoisoned accepts a null object; otyp/oclass are
    unread, so only the artifact index is related."""
    world.c_globals['otmp.oartifact'] = CVal(world.c_state['otmp.oartifact'][0], SCHAR)
    artifact_runtime(world, front, modules)


def permapoisoned_arguments(world, front):
    present = next(value for name, value, _ in world.params if name == 'native_object_present')
    return ([CPtr(present != 0, 'otmp')],
            [V('choice', [(present == 1, V('obj', 'otmp')),
                          (present != 1, V('null'))])])


def ammo_launcher_state(world, front, modules):
    """obj.h:ammo_and_launcher reads the ammo's oclass/otyp and (when the
    launcher is non-null) the launcher's otyp skill column; matching_launcher
    accepts a null launcher and is_ammo does not."""
    classed_object_state('ammo')(world, front, modules)
    launcher_typ = world.c_state['launcher.otyp'][0]
    world.c_globals['launcher.otyp'] = CVal(launcher_typ, (16, True))
    world.pre.extend([launcher_typ >= 0, launcher_typ < front.enum_value('NUM_OBJECTS')])


def ammo_launcher_arguments(world, front):
    present = next(value for name, value, _ in world.params if name == 'launcher_present')
    return ([CPtr(True, 'ammo'), CPtr(present != 0, 'launcher')],
            [V('obj', 'ammo'),
             V('choice', [(present == 1, V('obj', 'launcher')),
                          (present != 1, V('null'))])])


def unrelated(pin, field):
    """A domain probe pinned to one concrete row (the pinned species-probe
    pattern of mon_resistancebits) so z3 finds its counterexample at once."""
    return UnrelatedState(pin, (field,))


OBJECT_STATE = [('obj.oclass', (8, True), 'obj.oclass'),
                ('obj.otyp', (16, True), 'obj.otyp')]

STATE_SPECS += [
    Spec('is_weptool:tables', 'verification_is_weptool', 'isWeaponTool', [],
         js_file=OBJ_FILE, state=OBJECT_STATE,
         assumptions=OBJECT_MACRO_ASSUMPTIONS + CLASS_INVARIANT_ASSUMPTION,
         require_counterexamples=True, configure=classed_object_state('obj'),
         arguments=object_predicate_arguments('obj'),
         probes=[('oclass correspondence omitted (pinned pick-axe)',
                  unrelated(lambda s: [s['obj.otyp'] == 259], 'obj.oclass'))],
         mutants=[(OBJ_FILE, '&& objectSkill(object.otyp) !== 0;',
                   '&& objectSkill(object.otyp) === 0;')]),
    Spec('bimanual:tables', 'verification_bimanual', 'isBimanualObject', [],
         js_file=OBJ_FILE, state=OBJECT_STATE,
         assumptions=OBJECT_MACRO_ASSUMPTIONS + CLASS_INVARIANT_ASSUMPTION + (
            'obj.h bimanual reads objects[otyp].oc_bimanual, the oc_big bit objclass.h aliases to heavy armor; the class guard keeps armor rows out, and OBJECT_BIMANUAL keeps the same bit at every otyp',),
         require_counterexamples=True, configure=classed_object_state('obj'),
         arguments=object_predicate_arguments('obj'),
         probes=[('oclass correspondence omitted (pinned two-handed sword)',
                  unrelated(lambda s: [s['obj.otyp'] == 55], 'obj.oclass'))],
         mutants=[(OBJ_FILE, '&& !!objectBimanual(object.otyp);',
                   '&& !objectBimanual(object.otyp);')]),
    Spec('is_missile:tables', 'verification_is_missile', 'isMissileObject', [],
         js_file=OBJ_FILE, state=OBJECT_STATE,
         assumptions=OBJECT_MACRO_ASSUMPTIONS + CLASS_INVARIANT_ASSUMPTION,
         require_counterexamples=True, configure=classed_object_state('obj'),
         arguments=object_predicate_arguments('obj'),
         probes=[('oclass correspondence omitted (pinned dart)',
                  unrelated(lambda s: [s['obj.otyp'] == 24], 'obj.oclass'))],
         mutants=[(OBJ_FILE, 'skill >= -P_BOOMERANG && skill <= -P_DART;',
                   'skill >= -P_BOOMERANG && skill <= 0;')]),
    Spec('is_ammo:tables', 'verification_is_ammo', 'isLauncherAmmunition', [],
         js_file=OBJ_FILE, state=OBJECT_STATE,
         assumptions=OBJECT_MACRO_ASSUMPTIONS + CLASS_INVARIANT_ASSUMPTION + (
            'obj.h:is_ammo has one port function, isLauncherAmmunition; this claim proves that function',),
         require_counterexamples=True, configure=classed_object_state('obj'),
         arguments=object_predicate_arguments('obj'),
         probes=[('oclass correspondence omitted (pinned arrow)',
                  unrelated(lambda s: [s['obj.otyp'] == 18], 'obj.oclass'))],
         mutants=[(OBJ_FILE, '(kind === WEAPON_CLASS || kind === GEM_CLASS)\n        && skill >= -P_CROSSBOW && skill <= -P_BOW;',
                   '(kind === WEAPON_CLASS || kind === GEM_CLASS)\n        && skill >= -P_DART && skill <= -P_BOW;')]),
    Spec('ammo_and_launcher:tables', 'verification_ammo_and_launcher',
         'launcherMatchesAmmo', [('launcher_present', INT)],
         js_file=OBJ_FILE, state=[('ammo.oclass', (8, True), 'ammo.oclass'),
                                  ('ammo.otyp', (16, True), 'ammo.otyp'),
                                  ('launcher.otyp', (16, True), 'launcher.otyp')],
         assumptions=OBJECT_MACRO_ASSUMPTIONS + CLASS_INVARIANT_ASSUMPTION + (
            'obj.h:matching_launcher accepts a null launcher (the macro tests l first); the ammo object itself must be non-null because is_ammo dereferences it, and launcher otyp stays inside the emitted subtype table',
            'obj.h:ammo_and_launcher has one port function, launcherMatchesAmmo; this claim proves that function'),
         require_counterexamples=True, configure=ammo_launcher_state,
         arguments=ammo_launcher_arguments,
         pre=lambda s: [s['launcher_present'] >= 0, s['launcher_present'] <= 1],
         probes=[('launcher otyp correspondence omitted (pinned arrow)',
                  unrelated(lambda s: [s['launcher_present'] == 1,
                                       s['ammo.otyp'] == 18], 'launcher.otyp'))],
         mutants=[(OBJ_FILE, '=== -objectSkill(launcher.otyp);',
                   '=== objectSkill(launcher.otyp);')]),
    Spec('is_poisonable:tables', 'verification_is_poisonable', 'isPoisonableObject', [],
         js_file=OBJ_FILE,
         state=OBJECT_STATE + [('obj.oartifact', SCHAR, 'obj.oartifact')],
         assumptions=OBJECT_MACRO_ASSUMPTIONS + ARTIFACT_OBJECT_ASSUMPTIONS,
         require_counterexamples=True, configure=artifact_object_state('obj'),
         arguments=object_predicate_arguments('obj'),
         probes=[('oartifact correspondence omitted (pinned elven dagger)',
                  unrelated(lambda s: [s['obj.otyp'] == 35,
                                       s['obj.oartifact'] == 5], 'obj.oartifact'))],
         mutants=[(OBJ_FILE, "|| artifactById(object.oartifact)?.invokePower === 'fling-poison';",
                   '|| false;')]),
    Spec('permapoisoned:tables', 'permapoisoned', 'isPermanentlyPoisonedObject',
         [('native_object_present', INT)],
         js_file='js/artifact.js', state=[('otmp.oartifact', SCHAR, 'otmp.oartifact')],
         assumptions=OBJECT_PREDICATE_ASSUMPTIONS[:1] + ARTIFACT_OBJECT_ASSUMPTIONS + (
            'artifact.c:permapoisoned accepts a null object and so does the port guard; otyp/oclass are unread on both sides',
         ),
         require_counterexamples=True, configure=permapoisoned_state,
         arguments=permapoisoned_arguments,
         pre=lambda s: [s['native_object_present'] >= 0, s['native_object_present'] <= 1],
         probes=[('oartifact correspondence omitted (pinned Grimtooth)',
                  unrelated(lambda s: [s['native_object_present'] == 1,
                                       s['otmp.oartifact'] == 5], 'otmp.oartifact'))],
         mutants=[('js/artifact.js', "return artifactById(object.oartifact)?.invokePower === 'fling-poison';",
                   "return artifactById(object.oartifact)?.invokePower === 'snowstorm';")]),
    Spec('is_blunt_weapon:tables', 'verification_is_blunt_weapon', 'isBluntWeapon', [],
         js_file=OBJ_FILE, state=OBJECT_STATE,
         assumptions=OBJECT_MACRO_ASSUMPTIONS + CLASS_INVARIANT_ASSUMPTION,
         require_counterexamples=True, configure=classed_object_state('obj'),
         arguments=object_predicate_arguments('obj'),
         probes=[('oclass correspondence omitted (pinned mace)',
                  unrelated(lambda s: [s['obj.otyp'] == 73], 'obj.oclass'))],
         mutants=[(OBJ_FILE, 'return weaponOrTool && !!(objectBaseDirection(object.otyp) & WHACK);',
                   'return weaponOrTool && !!(objectBaseDirection(object.otyp) & 2);')]),
    Spec('is_flimsy:tables', 'verification_is_flimsy', 'isFlimsyObject', [],
         js_file=OBJ_FILE, state=OBJECT_STATE,
         assumptions=OBJECT_MACRO_ASSUMPTIONS + (
            'obj.h:is_flimsy reads oc_material and otyp only, so oclass is unread; zero-material generic rows are included and agree because 0 <= LEATHER on both sides',
            'the claim calls the port with the default game state, whose objectMaterials map holds the initial emitted OBJECT_MATERIAL entries (the same relation the material claims assume)',
         ),
         require_counterexamples=True, configure=plain_object_state('obj'),
         arguments=object_predicate_arguments('obj'),
         probes=[('otyp correspondence omitted (pinned leather armor)',
                  unrelated(lambda s: [s['obj.otyp'] == 134], 'obj.otyp'))],
         mutants=[(OBJ_FILE, 'return objectMaterial(object, state) <= LEATHER',
                   'return objectMaterial(object, state) < LEATHER')]),
    Spec('is_pick:tables', 'verification_is_pick', 'isPick', [],
         js_file=OBJ_FILE, state=OBJECT_STATE,
         assumptions=OBJECT_MACRO_ASSUMPTIONS,
         require_counterexamples=True, configure=plain_object_state('obj'),
         arguments=object_predicate_arguments('obj'),
         probes=[('otyp correspondence omitted (pinned pick-axe)',
                  unrelated(lambda s: [s['obj.otyp'] == 259], 'obj.otyp'))],
         mutants=[(OBJ_FILE, 'objectSkill(object.otyp) === P_PICK_AXE;',
                   'objectSkill(object.otyp) === P_AXE;')]),
    Spec('is_axe:tables', 'verification_is_axe', 'isAxe', [],
         js_file=OBJ_FILE, state=OBJECT_STATE,
         assumptions=OBJECT_MACRO_ASSUMPTIONS,
         require_counterexamples=True, configure=plain_object_state('obj'),
         arguments=object_predicate_arguments('obj'),
         probes=[('otyp correspondence omitted (pinned axe)',
                  unrelated(lambda s: [s['obj.otyp'] == 44], 'obj.otyp'))],
         mutants=[(OBJ_FILE, 'objectSkill(object.otyp) === P_AXE;',
                   'objectSkill(object.otyp) === P_PICK_AXE;')]),
    Spec('is_blade:tables', 'verification_is_blade', 'isBlade', [],
         js_file=OBJ_FILE, state=OBJECT_STATE,
         assumptions=OBJECT_MACRO_ASSUMPTIONS,
         require_counterexamples=True, configure=plain_object_state('obj'),
         arguments=object_predicate_arguments('obj'),
         probes=[('otyp correspondence omitted (pinned dagger)',
                  unrelated(lambda s: [s['obj.otyp'] == 34], 'obj.otyp'))],
         mutants=[(OBJ_FILE, '&& skill >= P_DAGGER && skill <= P_SABER;',
                   '&& skill > P_DAGGER && skill <= P_SABER;')]),
    Spec('is_wet_towel:state', 'verification_is_wet_towel', 'isWetTowel', [],
         js_file=OBJ_FILE,
         state=[('otmp.otyp', (16, True), 'otmp.otyp'),
                ('otmp.spe', SCHAR, 'otmp.spe')],
         assumptions=OBJECT_PREDICATE_ASSUMPTIONS[:1] + (
            'obj.h:is_wet_towel reads otyp and spe only; no objects[] row is read, so otyp spans the whole short range and spe the whole schar range, and the port\'s spe ?? 0 never fires because a modeled object always carries spe',
         ),
         require_counterexamples=True, configure=wet_towel_state,
         arguments=object_predicate_arguments('otmp'),
         probes=[('spe correspondence omitted (pinned towel)',
                  unrelated(lambda s: [s['otmp.otyp'] == 234], 'otmp.spe'))],
         mutants=[(OBJ_FILE, 'return object?.otyp === TOWEL && (object.spe ?? 0) > 0;',
                   'return object?.otyp === TOWEL && (object.spe ?? 0) >= 0;')]),
    Spec('is_pole:tables', 'verification_is_pole', 'isPolearm', [],
         js_file=OBJ_FILE,
         state=OBJECT_STATE + [('obj.oartifact', SCHAR, 'obj.oartifact')],
         assumptions=OBJECT_MACRO_ASSUMPTIONS + ARTIFACT_OBJECT_ASSUMPTIONS,
         require_counterexamples=True, configure=artifact_object_state('obj'),
         arguments=object_predicate_arguments('obj'),
         probes=[('oartifact correspondence omitted (pinned Snickersnee short sword)',
                  unrelated(lambda s: [s['obj.otyp'] == 46,
                                       s['obj.oartifact'] == 19], 'obj.oartifact'))],
         mutants=[(OBJ_FILE, 'return skill === P_POLEARMS || skill === P_LANCE',
                   'return skill === P_POLEARMS')]),
    Spec('is_sword:tables', 'verification_is_sword', 'isSword', [],
         js_file=OBJ_FILE, state=OBJECT_STATE,
         assumptions=OBJECT_MACRO_ASSUMPTIONS,
         require_counterexamples=True, configure=plain_object_state('obj'),
         arguments=object_predicate_arguments('obj'),
         probes=[('otyp correspondence omitted (pinned short sword)',
                  unrelated(lambda s: [s['obj.otyp'] == 46], 'obj.otyp'))],
         mutants=[(OBJ_FILE, 'return object.oclass === WEAPON_CLASS && skill >= P_SHORT_SWORD && skill <= P_SABER;',
                   'return object.oclass === WEAPON_CLASS && skill > P_SHORT_SWORD && skill <= P_SABER;')]),
    Spec('is_graystone:tables', 'verification_is_graystone', 'isGrayStone', [],
         js_file=OBJ_FILE,
         state=[('obj.otyp', (16, True), 'obj.otyp')],
         assumptions=OBJECT_PREDICATE_ASSUMPTIONS[:1] + (
            'obj.h:is_graystone compares otyp with four constants; no objects[] row is read, so otyp spans the whole short range',
         ),
         require_counterexamples=True, configure=graystone_state,
         arguments=object_predicate_arguments('obj'),
         probes=[('otyp correspondence omitted (pinned touchstone)',
                  unrelated(lambda s: [s['obj.otyp'] == 472], 'obj.otyp'))],
         mutants=[(OBJ_FILE, '[LUCKSTONE, LOADSTONE, FLINT, TOUCHSTONE].includes(object.otyp);',
                   '[LUCKSTONE, LOADSTONE, FLINT].includes(object.otyp);')]),
    Spec('throwing_weapon:tables', 'throwing_weapon', 'isThrowingWeapon', [],
         js_file=OBJ_FILE, state=OBJECT_STATE,
         assumptions=OBJECT_MACRO_ASSUMPTIONS + CLASS_INVARIANT_ASSUMPTION + (
            'dothrow.c:throwing_weapon composes is_missile, is_spear, is_blade, is_sword and the oc_dir PIERCE bit with the two special otyps; the port\'s skill >= P_DAGGER && skill < P_SHORT_SWORD equals is_blade && !is_sword because P_SHORT_SWORD <= P_SABER',
         ),
         require_counterexamples=True, configure=classed_object_state('obj'),
         arguments=object_predicate_arguments('obj'),
         probes=[('oclass correspondence omitted (pinned dagger)',
                  unrelated(lambda s: [s['obj.otyp'] == 34], 'obj.oclass'))],
         mutants=[(OBJ_FILE, '|| object.otyp === WAR_HAMMER\n        || object.otyp === AKLYS;',
                   '|| object.otyp === WAR_HAMMER;')]),
    Spec('is_multigen:tables', 'verification_is_multigen', 'isMultiGeneratedWeapon', [],
         js_file=OBJ_FILE, state=OBJECT_STATE,
         assumptions=OBJECT_MACRO_ASSUMPTIONS,
         require_counterexamples=True, configure=plain_object_state('obj'),
         arguments=object_predicate_arguments('obj'),
         probes=[('otyp correspondence omitted (pinned dart)',
                  unrelated(lambda s: [s['obj.otyp'] == 24], 'obj.otyp'))],
         mutants=[(OBJ_FILE, 'return object.oclass === WEAPON_CLASS\n        && skill >= -P_SHURIKEN && skill <= -P_BOW;',
                   'return object.oclass === WEAPON_CLASS\n        && skill >= -P_BOOMERANG && skill <= -P_BOW;')]),
]

# ---- fv-equivalence-batch-7: objclass.h material macros and mkobj.c
# is_flammable()/is_rottable() ----

# Each macro has one named port function in object_properties.js (the
# objclass.h predicates) or mkobj.js (the two real mkobj.c functions);
# every former inline copy and duplicate helper now calls the owner. The
# claims keep the whole initial table in the domain: the zero-material
# generic rows carry material 0 on both sides, and the C-faithful owners
# agree with the native macros there too.
MATERIAL_TABLE_ASSUMPTIONS = OBJECT_PREDICATE_ASSUMPTIONS[:1] + (
    'objclass.h reads objects[otyp].oc_material and mkobj.c is_flammable()/is_rottable() read the same column plus objects[otyp].oc_oprop; object_data.js OBJECT_MATERIAL keeps that column at every otyp in 0..NUM_OBJECTS-1 (checked concretely over the whole table), and object_properties.js:objectIs* reach it through o_init.js:objectMaterial over the related initial map',
)

FLAMMABLE_ASSUMPTIONS = MATERIAL_TABLE_ASSUMPTIONS + (
    'mkobj.c:is_flammable reads otmp->otyp through obj.h Is_candle (TALLOW_CANDLE/WAX_CANDLE) and WAN_FIRE; object_data.js OBJECT_PROPERTY names the oc_oprop column, whose FIRE_RES rows are exactly the fireResistance rows (checked concretely), so the candle, wand and fire-resistance exclusions agree row for row',
)


STATE_SPECS += [
    Spec('is_organic:tables', 'verification_is_organic', 'objectIsOrganic', [],
         js_file=OBJ_FILE, state=OBJECT_STATE,
         assumptions=MATERIAL_TABLE_ASSUMPTIONS,
         require_counterexamples=True, configure=plain_object_state('obj'),
         arguments=object_predicate_arguments('obj'),
         probes=[('otyp correspondence omitted (pinned leather armor)',
                  unrelated(lambda s: [s['obj.otyp'] == 134], 'obj.otyp'))],
         mutants=[(OBJ_FILE, 'return objectMaterial(object, state) <= WOOD;',
                   'return objectMaterial(object, state) < WOOD;')]),
    Spec('is_metallic:tables', 'verification_is_metallic', 'objectIsMetallic', [],
         js_file=OBJ_FILE, state=OBJECT_STATE,
         assumptions=MATERIAL_TABLE_ASSUMPTIONS,
         require_counterexamples=True, configure=plain_object_state('obj'),
         arguments=object_predicate_arguments('obj'),
         probes=[('otyp correspondence omitted (pinned plate mail)',
                  unrelated(lambda s: [s['obj.otyp'] == 121], 'obj.otyp'))],
         mutants=[(OBJ_FILE, 'return material >= IRON && material <= MITHRIL;',
                   'return material >= IRON && material <= GLASS;')]),
    Spec('is_rustprone:tables', 'verification_is_rustprone', 'objectIsRustprone', [],
         js_file=OBJ_FILE, state=OBJECT_STATE,
         assumptions=MATERIAL_TABLE_ASSUMPTIONS,
         require_counterexamples=True, configure=plain_object_state('obj'),
         arguments=object_predicate_arguments('obj'),
         probes=[('otyp correspondence omitted (pinned plate mail)',
                  unrelated(lambda s: [s['obj.otyp'] == 121], 'obj.otyp'))],
         mutants=[(OBJ_FILE, 'return objectMaterial(object, state) === IRON;',
                   'return objectMaterial(object, state) === COPPER;')]),
    Spec('is_corrodeable:tables', 'verification_is_corrodeable',
         'objectIsCorrodeable', [],
         js_file=OBJ_FILE, state=OBJECT_STATE,
         assumptions=MATERIAL_TABLE_ASSUMPTIONS,
         require_counterexamples=True, configure=plain_object_state('obj'),
         arguments=object_predicate_arguments('obj'),
         probes=[('otyp correspondence omitted (pinned bronze plate mail)',
                  unrelated(lambda s: [s['obj.otyp'] == 123], 'obj.otyp'))],
         mutants=[(OBJ_FILE, 'return material === COPPER || material === IRON;',
                   'return material === COPPER;')]),
    Spec('is_crackable:tables', 'verification_is_crackable', 'objectIsCrackable', [],
         js_file=OBJ_FILE, state=OBJECT_STATE,
         assumptions=MATERIAL_TABLE_ASSUMPTIONS,
         require_counterexamples=True, configure=plain_object_state('obj'),
         arguments=object_predicate_arguments('obj'),
         probes=[('oclass correspondence omitted (pinned crystal plate mail)',
                  unrelated(lambda s: [s['obj.otyp'] == 122], 'obj.oclass'))],
         mutants=[(OBJ_FILE, 'return objectMaterial(object, state) === GLASS\n        && object.oclass === ARMOR_CLASS;',
                   'return object.oclass === ARMOR_CLASS;')]),
    Spec('is_flammable:tables', 'is_flammable', 'objectIsFlammable', [],
         js_file='js/mkobj.js',
         state=[('otmp.otyp', (16, True), 'otmp.otyp'),
                ('otmp.oclass', (8, True), 'otmp.oclass')],
         assumptions=FLAMMABLE_ASSUMPTIONS,
         require_counterexamples=True, configure=plain_object_state('otmp'),
         arguments=object_predicate_arguments('otmp'),
         probes=[('otyp correspondence omitted (pinned leather armor)',
                  unrelated(lambda s: [s['otmp.otyp'] == 134], 'otmp.otyp'))],
         mutants=[('js/mkobj.js',
                   'if (object.otyp === TALLOW_CANDLE || object.otyp === WAX_CANDLE)\n        return false;',
                   'if (object.otyp === WAN_FIRE && object.otyp === TALLOW_CANDLE)\n        return false;'),
                  ('js/mkobj.js', '|| material === PLASTIC;',
                   '|| material === DRAGON_HIDE;')]),
    Spec('is_rottable:tables', 'is_rottable', 'objectIsRottable', [],
         js_file='js/mkobj.js',
         state=[('otmp.otyp', (16, True), 'otmp.otyp'),
                ('otmp.oclass', (8, True), 'otmp.oclass')],
         assumptions=FLAMMABLE_ASSUMPTIONS,
         require_counterexamples=True, configure=plain_object_state('otmp'),
         arguments=object_predicate_arguments('otmp'),
         probes=[('otyp correspondence omitted (pinned leather armor)',
                  unrelated(lambda s: [s['otmp.otyp'] == 134], 'otmp.otyp'))],
         mutants=[('js/mkobj.js', '|| material === DRAGON_HIDE;',
                   '|| material === PLASTIC;')]),
]

# ---- fv-equivalence-batch-12: the remaining obj.h object macros ----

# is_launcher/is_spear and the seven armor-category macros read oclass plus
# the oc_subtyp column; the elven sets compare otyp with constants, like
# is_graystone. Every claim keeps the whole initial table in its domain.
LAUNCHER_ASSUMPTION = OBJECT_MACRO_ASSUMPTIONS + (
    'obj.h:is_launcher reads objects[otyp].oc_skill between P_BOW and P_CROSSBOW behind the WEAPON_CLASS guard',
)
SPEAR_ASSUMPTION = OBJECT_MACRO_ASSUMPTIONS + (
    'obj.h:is_spear reads objects[otyp].oc_skill == P_SPEAR behind the WEAPON_CLASS guard',
)
ARMCAT_ASSUMPTIONS = OBJECT_MACRO_ASSUMPTIONS + (
    'objclass.h keeps the armor category in oc_armcat, the oc_subtyp alias; obj.h is_shield/is_helmet/is_boots/is_gloves/is_cloak/is_shirt/is_suit test it behind the ARMOR_CLASS guard',
    'the generic armor marker row 3 carries ARM_SUIT, so C classifies it as a suit; the port does too after this batch',
)
ELVEN_ASSUMPTIONS = OBJECT_PREDICATE_ASSUMPTIONS[:1] + (
    'obj.h:is_elven_armor/is_elven_weapon compare otyp with fixed elven type sets; no objects[] column beyond otyp is read, so otyp spans the whole table and oclass stays free',
)


def bounded_type_state(world, front, modules):
    graystone_state(world, front, modules)
    object_table_index_precondition(world, front, world.c_state['obj.otyp'][0])


def armor_cat_spec(name, harness, function, mutant_pair, pin):
    return Spec(name, harness, function, [], slow=True, js_file=OBJ_FILE,
                state=OBJECT_STATE,
                assumptions=ARMCAT_ASSUMPTIONS,
                require_counterexamples=True,
                configure=plain_object_state('obj'),
                arguments=object_predicate_arguments('obj'),
                probes=[('oclass correspondence omitted', unrelated(
                    lambda s, pin=pin: [s['obj.otyp'] == pin], 'obj.oclass'))],
                mutant_pre=lambda s: [s['obj.otyp'] == pin],
                mutants=[(OBJ_FILE,) + mutant_pair])


STATE_SPECS += [
    Spec('is_launcher:tables', 'verification_is_launcher', 'is_launcher', [],
         slow=True, js_file=OBJ_FILE, state=OBJECT_STATE,
         assumptions=LAUNCHER_ASSUMPTION,
         require_counterexamples=True, configure=plain_object_state('obj'),
         arguments=object_predicate_arguments('obj'),
         probes=[('oclass correspondence omitted (pinned bow)',
                  unrelated(lambda s: [s['obj.otyp'] == 83], 'obj.oclass'))],
         mutant_pre=lambda s: [s['obj.otyp'] == 34],
         mutants=[(OBJ_FILE, 'return object.oclass === WEAPON_CLASS\n        && skill >= P_BOW && skill <= P_CROSSBOW;',
                   'return object.oclass === WEAPON_CLASS\n        && skill >= P_DAGGER && skill <= P_CROSSBOW;')]),
    Spec('is_spear:tables', 'verification_is_spear', 'is_spear', [],
         slow=True, js_file=OBJ_FILE, state=OBJECT_STATE,
         assumptions=SPEAR_ASSUMPTION,
         require_counterexamples=True, configure=plain_object_state('obj'),
         arguments=object_predicate_arguments('obj'),
         probes=[('oclass correspondence omitted (pinned spear)',
                  unrelated(lambda s: [s['obj.otyp'] == 27], 'obj.oclass'))],
         mutant_pre=lambda s: [s['obj.otyp'] == 27],
         mutants=[(OBJ_FILE, 'return object.oclass === WEAPON_CLASS\n        && objectSkill(object.otyp) === P_SPEAR;',
                   'return object.oclass === WEAPON_CLASS\n        && objectSkill(object.otyp) === P_LANCE;')]),
    armor_cat_spec('is_shield:tables', 'verification_is_shield', 'is_shield',
                   ('return object.oclass === ARMOR_CLASS\n        && oc_armcat(object.otyp) === ARM_SHIELD;',
                    'return object.oclass === ARMOR_CLASS\n        && oc_armcat(object.otyp) === ARM_HELM;'), 150),
    armor_cat_spec('is_helmet:tables', 'verification_is_helmet', 'is_helmet',
                   ('return object.oclass === ARMOR_CLASS\n        && oc_armcat(object.otyp) === ARM_HELM;',
                    'return object.oclass === ARMOR_CLASS\n        && oc_armcat(object.otyp) === ARM_BOOTS;'), 97),
    armor_cat_spec('is_boots:tables', 'verification_is_boots', 'is_boots',
                   ('return object.oclass === ARMOR_CLASS\n        && oc_armcat(object.otyp) === ARM_BOOTS;',
                    'return object.oclass === ARMOR_CLASS\n        && oc_armcat(object.otyp) === ARM_HELM;'), 163),
    armor_cat_spec('is_gloves:tables', 'verification_is_gloves', 'is_gloves',
                   ('return object.oclass === ARMOR_CLASS\n        && oc_armcat(object.otyp) === ARM_GLOVES;',
                    'return object.oclass === ARMOR_CLASS\n        && oc_armcat(object.otyp) === ARM_SHIRT;'), 159),
    armor_cat_spec('is_cloak:tables', 'verification_is_cloak', 'is_cloak',
                   ('return object.oclass === ARMOR_CLASS\n        && oc_armcat(object.otyp) === ARM_CLOAK;',
                    'return object.oclass === ARMOR_CLASS\n        && oc_armcat(object.otyp) === ARM_SUIT;'), 138),
    armor_cat_spec('is_shirt:tables', 'verification_is_shirt', 'is_shirt',
                   ('return object.oclass === ARMOR_CLASS\n        && oc_armcat(object.otyp) === ARM_SHIRT;',
                    'return object.oclass === ARMOR_CLASS\n        && oc_armcat(object.otyp) === ARM_CLOAK;'), 136),
    armor_cat_spec('is_suit:tables', 'verification_is_suit', 'is_suit',
                   ('return object.oclass === ARMOR_CLASS\n        && oc_armcat(object.otyp) === ARM_SUIT;',
                    'return object.oclass === ARMOR_CLASS\n        && oc_armcat(object.otyp) === ARM_SHIRT;'), 121),
    Spec('is_elven_armor:tables', 'verification_is_elven_armor', 'is_elven_armor', [],
         slow=True, js_file=OBJ_FILE,
         state=[('obj.otyp', (16, True), 'obj.otyp')],
         assumptions=ELVEN_ASSUMPTIONS,
         require_counterexamples=True, configure=bounded_type_state,
         arguments=object_predicate_arguments('obj'),
         probes=[('otyp correspondence omitted (pinned elven mithril-coat)',
                  unrelated(lambda s: [s['obj.otyp'] == 127], 'obj.otyp'))],
         mutant_pre=lambda s: [s['obj.otyp'] == 169],
         mutants=[(OBJ_FILE, 'return object.otyp === ELVEN_LEATHER_HELM\n        || object.otyp === ELVEN_MITHRIL_COAT || object.otyp === ELVEN_CLOAK\n        || object.otyp === ELVEN_SHIELD || object.otyp === ELVEN_BOOTS;',
                   'return object.otyp === ELVEN_LEATHER_HELM\n        || object.otyp === ELVEN_MITHRIL_COAT || object.otyp === ELVEN_CLOAK\n        || object.otyp === ELVEN_SHIELD;')]),
    Spec('is_elven_weapon:tables', 'verification_is_elven_weapon', 'is_elven_weapon', [],
         slow=True, js_file=OBJ_FILE,
         state=[('obj.otyp', (16, True), 'obj.otyp')],
         assumptions=ELVEN_ASSUMPTIONS,
         require_counterexamples=True, configure=bounded_type_state,
         arguments=object_predicate_arguments('obj'),
         probes=[('otyp correspondence omitted (pinned elven arrow)',
                  unrelated(lambda s: [s['obj.otyp'] == 19], 'obj.otyp'))],
         mutant_pre=lambda s: [s['obj.otyp'] == 84],
         mutants=[(OBJ_FILE, 'return object.otyp === ELVEN_ARROW || object.otyp === ELVEN_SPEAR\n        || object.otyp === ELVEN_DAGGER || object.otyp === ELVEN_SHORT_SWORD\n        || object.otyp === ELVEN_BROADSWORD || object.otyp === ELVEN_BOW;',
                   'return object.otyp === ELVEN_ARROW || object.otyp === ELVEN_SPEAR\n        || object.otyp === ELVEN_DAGGER || object.otyp === ELVEN_SHORT_SWORD\n        || object.otyp === ELVEN_BROADSWORD;')]),
    Spec('pair_of:tables', 'verification_pair_of', 'pair_of', [],
         slow=True, js_file=OBJ_FILE, state=OBJECT_STATE,
         assumptions=ARMCAT_ASSUMPTIONS + (
             'obj.h:pair_of is otyp == LENSES || is_gloves(o) || is_boots(o); the oclass guard comes from the two macros',
         ),
         require_counterexamples=True, configure=plain_object_state('obj'),
         arguments=object_predicate_arguments('obj'),
         probes=[('oclass correspondence omitted (pinned leather gloves)',
                  unrelated(lambda s: [s['obj.otyp'] == 159], 'obj.oclass'))],
         mutant_pre=lambda s: [s['obj.otyp'] == 163],
         mutants=[(OBJ_FILE, 'return object.otyp === LENSES || is_gloves(object) || is_boots(object);',
                   'return object.otyp === LENSES || is_gloves(object);')]),
]

def matching_launcher_state(world, front, modules):
    world.join_paths = True
    world.c_globals['objects'] = native_objects(world, front)
    count = front.enum_value('NUM_OBJECTS')
    for prefix in ('ammo', 'launcher'):
        value = world.c_state[f'{prefix}.otyp'][0]
        port = world.js_state[f'{prefix}.otyp']
        world.c_globals[f'{prefix}.otyp'] = CVal(value, (16, True))
        world.pre.extend([value >= 0, value < count, port >= 0, port < count])


STATE_SPECS += [
    Spec('matching_launcher:tables', 'verification_matching_launcher',
         'matching_launcher', [('launcher_present', INT)],
         slow=True, js_file=OBJ_FILE,
         state=[('ammo.otyp', (16, True), 'ammo.otyp'),
                ('launcher.otyp', (16, True), 'launcher.otyp')],
         configure=matching_launcher_state, arguments=ammo_launcher_arguments,
         pre=lambda s: [s['launcher_present'] >= 0, s['launcher_present'] <= 1],
         assumptions=(
             'every ammo and launcher otyp in 0..NUM_OBJECTS-1 over independently executed initial object tables; oclass is unread; ammo is non-null and launcher may be null',
         ), require_counterexamples=True,
         probes=[('launcher index correspondence omitted (arrow and bow)', unrelated(
             lambda s: [s['launcher_present'] == 1, s['ammo.otyp'] == 18,
                        s['launcher.otyp'] == 83, z3.Int('js:launcher.otyp') == 87],
             'launcher.otyp'))],
         mutant_pre=lambda s: [s['launcher_present'] == 1, s['ammo.otyp'] == 18,
                               s['launcher.otyp'] == 83],
         mutants=[(OBJ_FILE, '=== -objectSkill(launcher.otyp);',
                   '=== objectSkill(launcher.otyp);')]),
]

# ---- fv-equivalence-batch-5: the named mondata.h/mondata.c predicates ----

# PR 610 gave every inlined mondata.h macro a C-shaped port function in
# monster_data.js. These claims pair each predicate with its macro-expansion
# harness (or, for can_track, the real mondata.c body) over every valid
# initial species, exactly as verysmall:tables/haseyes:tables do.
STATE_SPECS += [
    Spec(name, native, port, [('species', INT), ('native_pointer_present', INT)],
         js_file=MONSTER_DATA,
         assumptions=PREDICATE_ASSUMPTIONS, require_counterexamples=True,
         configure=species_predicate_state, arguments=species_predicate_arguments,
         pre=lambda s: [s['species'] >= 0, s['native_pointer_present'] == 1],
         probes=[('null native species pointer', lambda s: [s['species'] >= 0,
                                                           s['native_pointer_present'] == 0])],
         mutants=[(MONSTER_DATA, old, new)])
    for name, native, port, old, new in (
        ('bigmonst:tables', 'verification_bigmonst', 'monsterIsBig',
         '(MONSTER_SIZE[mnum] ?? MZ_MEDIUM) >= MZ_LARGE;',
         '(MONSTER_SIZE[mnum] ?? MZ_MEDIUM) > MZ_LARGE;'),
        ('is_flyer:tables', 'verification_is_flyer', 'monsterIsFlyer',
         '(MONSTER_FLAGS1[mnum] ?? 0) & M1_FLY);',
         '(MONSTER_FLAGS1[mnum] ?? 0) & M1_CLING);'),
        ('is_floater:tables', 'verification_is_floater', 'monsterIsFloater',
         'MONSTER_SYMBOL[mnum] === S_EYE || MONSTER_SYMBOL[mnum] === S_LIGHT;',
         'MONSTER_SYMBOL[mnum] === S_EEL || MONSTER_SYMBOL[mnum] === S_LIGHT;'),
        ('is_clinger:tables', 'verification_is_clinger', 'monsterIsClinger',
         '(MONSTER_FLAGS1[mnum] ?? 0) & M1_CLING);',
         '(MONSTER_FLAGS1[mnum] ?? 0) & M1_FLY);'),
        ('is_swimmer:tables', 'verification_is_swimmer', 'monsterIsSwimmer',
         '(MONSTER_FLAGS1[mnum] ?? 0) & M1_SWIM);',
         '(MONSTER_FLAGS1[mnum] ?? 0) & M1_FLY);'),
        ('amphibious:tables', 'verification_amphibious_monster', 'monsterIsAmphibious',
         '(MONSTER_FLAGS1[mnum] ?? 0) & M1_AMPHIBIOUS);',
         '(MONSTER_FLAGS1[mnum] ?? 0) & M1_SWIM);'),
        ('passes_walls:tables', 'verification_passes_walls', 'monsterPassesWalls',
         '(MONSTER_FLAGS1[mnum] ?? 0) & M1_WALLWALK);',
         '(MONSTER_FLAGS1[mnum] ?? 0) & M1_CLING);'),
        ('can_teleport:tables', 'verification_can_teleport', 'monsterCanTeleport',
         '(MONSTER_FLAGS1[mnum] ?? 0) & M1_TPORT);',
         '(MONSTER_FLAGS1[mnum] ?? 0) & M1_TPORT_CNTRL);'),
        ('control_teleport:tables', 'verification_control_teleport', 'monsterControlsTeleport',
         '(MONSTER_FLAGS1[mnum] ?? 0) & M1_TPORT_CNTRL);',
         '(MONSTER_FLAGS1[mnum] ?? 0) & M1_TPORT);'),
        ('perceives:tables', 'verification_perceives', 'monsterPerceives',
         '(MONSTER_FLAGS1[mnum] ?? 0) & M1_SEE_INVIS);',
         '(MONSTER_FLAGS1[mnum] ?? 0) & M1_TPORT);'),
        ('hides_under:tables', 'verification_hides_under', 'monsterHidesUnder',
         '(MONSTER_FLAGS1[mnum] ?? 0) & M1_CONCEAL);',
         '(MONSTER_FLAGS1[mnum] ?? 0) & M1_HIDE);'),
        ('is_hider:tables', 'verification_is_hider', 'monsterIsHider',
         '(MONSTER_FLAGS1[mnum] ?? 0) & M1_HIDE);',
         '(MONSTER_FLAGS1[mnum] ?? 0) & M1_CONCEAL);'),
        ('is_demon:tables', 'verification_is_demon', 'monsterIsDemon',
         '(MONSTER_FLAGS2[mnum] ?? 0) & M2_DEMON);',
         '(MONSTER_FLAGS2[mnum] ?? 0) & M2_GIANT);'),
        ('is_golem:tables', 'verification_is_golem', 'monsterIsGolem',
         'MONSTER_SYMBOL[mnum] === S_GOLEM;',
         'MONSTER_SYMBOL[mnum] === S_EEL;'),
        ('is_giant:tables', 'verification_is_giant', 'monsterIsGiant',
         '(MONSTER_FLAGS2[mnum] ?? 0) & M2_GIANT);',
         '(MONSTER_FLAGS2[mnum] ?? 0) & M2_DEMON);'),
        ('is_female:tables', 'verification_is_female', 'monsterIsFemale',
         '(MONSTER_FLAGS2[mnum] ?? 0) & M2_FEMALE);',
         '(MONSTER_FLAGS2[mnum] ?? 0) & M2_PNAME);'),
        ('throws_rocks:tables', 'verification_throws_rocks', 'monsterThrowsRocks',
         '(MONSTER_FLAGS2[mnum] ?? 0) & M2_ROCKTHROW);',
         '(MONSTER_FLAGS2[mnum] ?? 0) & M2_GIANT);'),
        ('type_is_pname:tables', 'verification_type_is_pname', 'monsterHasProperName',
         '(MONSTER_FLAGS2[mnum] ?? 0) & M2_PNAME);',
         '(MONSTER_FLAGS2[mnum] ?? 0) & M2_FEMALE);'),
        ('is_silent:tables', 'verification_is_silent', 'monsterIsSilent',
         'MONSTER_SOUND[mnum] === MS_SILENT;',
         'MONSTER_SOUND[mnum] !== MS_SILENT;'),
    )
]


CAN_TRACK_ASSUMPTIONS = (
    'mondata.c:can_track: the permonst pointer argument is &mons[species]; emitted mnum equals species',
    'monst.c:monst_globals_init: fields read retain mons_init values; emitted table fields retain initial values',
    'wield.c:uwep is the one wielded weapon or NULL; game.uwep and game.u.uwep alias the same slot, so both are null exactly when the native uwep is NULL, and uwep.oartifact is the weapon artifact index (obj.h char)',
    'artifact.js:initializeArtifacts: runtime map retains artifact_data identity/name pairs',
    'obj.h:u_wield_art expands to artifact.c:is_art(uwep, ART_EXCALIBUR), which the claim executes for real',
)


def can_track_arguments(world, front):
    values = {name: value for name, value, _ in world.params}
    pointer = CPtr(values['native_pointer_present'] != 0,
                   CElement('mons', values['species']))
    return ([pointer], [V('num', values['species']), V('obj', 'game')])


def can_track_state(world, front, modules):
    species_predicate_state(world, front, modules)
    present = next(value for name, value, _ in world.params
                   if name == 'uwep_present') != 0
    world.c_globals['uwep'] = CPtr(present, 'uwep')
    weapon = V('choice', [(present, V('obj', 'uwep')),
                          (z3.Not(present), V('null'))])
    world.js_values['game.uwep'] = weapon
    world.js_values['game.u.uwep'] = weapon
    artifacts = module_constant(world, modules, 'js/artifact_data.js', 'ARTIFACT_DATA')
    world.js_values['game._artifactRuntime'] = V('map', tuple(
        (artifact.v['id'], artifact) for artifact in artifacts.v))


def can_track_domain(s):
    return [s['species'] >= 0, s['native_pointer_present'] == 1,
            s['uwep_present'] >= 0, s['uwep_present'] <= 1]


STATE_SPECS += [
    Spec('can_track:state', 'can_track', 'canTrack',
         [('species', INT), ('native_pointer_present', INT), ('uwep_present', INT)],
         js_file='js/mondata.js', state=[('uwep.oartifact', SCHAR, 'uwep.oartifact')],
         assumptions=CAN_TRACK_ASSUMPTIONS, require_counterexamples=True,
         configure=can_track_state, arguments=can_track_arguments,
         pre=can_track_domain,
         probes=[('null native species pointer', lambda s: [s['species'] >= 0,
                                                           s['native_pointer_present'] == 0,
                                                           s['uwep_present'] >= 0,
                                                           s['uwep_present'] <= 1]),
                 ('wielded artifact index correspondence omitted', UnrelatedState(
                     can_track_domain, ('uwep.oartifact',)))],
         mutants=[('js/mondata.js', "?.name === 'Excalibur'", "?.name === 'Stormbringer'"),
                  ('js/mondata.js', 'return monsterHasEyes(mnum);',
                   'return !monsterHasEyes(mnum);')]),
]

# ---- fv-equivalence-batch-8: the pure mons[]-table functions of mondata.c ----

# These claims execute the real mondata.c table functions through their
# mondata.js owners; mbirth_limit belongs to makemon.js. Every species is
# covered by the initial-table relation below.

GROWNUPS_ASSUMPTIONS = PREDICATE_ASSUMPTIONS + (
    'mondata.c:little_to_big/big_to_little scan the static const grownups[][] table; the emitted MONSTER_GROWTH_TARGET vector stores the same 67 growth edges plus one identity entry per species',
)


def int64_argument(s):
    return int_argument(s, 'mndx')


def grownups_state(world, front, modules):
    # Each grownups scan runs 67 matching rows plus the {NON_PM, NON_PM}
    # terminator, and the emitted reverse scan may walk all 383 vector
    # entries, so the default 12-step unroll bound cannot cover it.
    # NUMMONS (383) is pinned in each spec's pre instead: the C-int
    # narrowing probes must be able to leave the table domain.
    world.join_paths = True
    world.unroll = 400
    world.c_globals['mons'] = native_monsters(world, front)


def growth_arguments(world, front):
    values = {name: value for name, value, _ in world.params}
    return ([CVal(values['montype'], LONG)], [V('num', values['montype'])])


def same_race_state(world, front, modules):
    grownups_state(world, front, modules)
    values = {name: value for name, value, _ in world.params}
    world.pre.extend([values['left'] < front.enum_value('NUMMONS'),
                      values['right'] < front.enum_value('NUMMONS')])


def same_race_arguments(world, front):
    values = {name: value for name, value, _ in world.params}
    present = values['native_pointer_present'] != 0
    return ([CPtr(present, CElement('mons', values['left'])),
             CPtr(present, CElement('mons', values['right']))],
            [V('num', values['left']), V('num', values['right'])])


def growth_pair_state(world, front, modules):
    grownups_state(world, front, modules)


def growth_pair_arguments(world, front):
    values = {name: value for name, value, _ in world.params}
    return ([CVal(values['montyp1'], LONG), CVal(values['montyp2'], LONG)],
            [V('num', values['montyp1']), V('num', values['montyp2'])])


STATE_SPECS += [
    Spec('cantvomit:tables', 'cantvomit', 'speciesCannotVomit',
         [('species', INT), ('native_pointer_present', INT)], js_file='js/mondata.js',
         assumptions=PREDICATE_ASSUMPTIONS + (
             'mondata.c:cantvomit: the native pointer identity tests (PM_ROCK_MOLE, PM_WOODCHUCK, PM_PONY, PM_HORSE, PM_WARHORSE) correspond to the emitted species-index comparisons',
         ), require_counterexamples=True,
         configure=species_predicate_state, arguments=species_predicate_arguments,
         pre=lambda s: [s['species'] >= 0, s['native_pointer_present'] == 1],
         probes=[('null native species pointer', lambda s: [s['species'] >= 0,
                                                           s['native_pointer_present'] == 0])],
         mutants=[('js/mondata.js', '&& mnum !== PM_ROCK_MOLE && mnum !== PM_WOODCHUCK)',
                   '&& mnum !== PM_ROCK_MOLE + 1 && mnum !== PM_WOODCHUCK)'),
                  ('js/mondata.js',
                   'return mnum === PM_PONY || mnum === PM_HORSE || mnum === PM_WARHORSE;',
                   'return mnum === PM_PONY || mnum === PM_HORSE;')]),
    Spec('noattacks:tables', 'noattacks', 'monsterHasNoAttacks',
         [('species', INT), ('native_pointer_present', INT)], js_file=MONSTER_DATA,
         assumptions=PREDICATE_ASSUMPTIONS + (
             'mondata.c:noattacks: the emitted MONSTER_ATTACKS rows correspond field-for-field to the native mons[].mattk arrays; AT_BOOM rows are not attacks on either side',
         ), require_counterexamples=True,
         configure=species_predicate_state, arguments=species_predicate_arguments,
         pre=lambda s: [s['species'] >= 0, s['native_pointer_present'] == 1],
         probes=[('null native species pointer', lambda s: [s['species'] >= 0,
                                                           s['native_pointer_present'] == 0])],
         mutants=[(MONSTER_DATA, '.some(([type]) => type !== AT_NONE && type !== AT_BOOM);',
                   '.some(([type]) => type !== AT_NONE);')]),
    Spec('num_horns:tables', 'num_horns', 'monsterHornCount',
         [('species', INT), ('native_pointer_present', INT)], slow=True, js_file=MONSTER_DATA,
         assumptions=PREDICATE_ASSUMPTIONS + (
             'mondata.c:num_horns: monsndx(ptr) is the pmidx of mons[species]; the emitted PM_* case labels are the same species indices',
         ), require_counterexamples=True,
         configure=species_predicate_state, arguments=species_predicate_arguments,
         pre=lambda s: [s['species'] >= 0, s['native_pointer_present'] == 1],
         probes=[('null native species pointer', lambda s: [s['species'] >= 0,
                                                           s['native_pointer_present'] == 0])],
         mutants=[(MONSTER_DATA, "const PM_HORNED_DEVIL = MONSTER_NAME.indexOf('horned devil');",
                   "const PM_HORNED_DEVIL = MONSTER_NAME.indexOf('minotaur');"),
                  (MONSTER_DATA, "const PM_KI_RIN = MONSTER_NAME.indexOf('ki-rin');",
                   "const PM_KI_RIN = MONSTER_NAME.indexOf('white unicorn');")]),
    Spec('little_to_big:tables', 'little_to_big', 'monsterOlderForm',
         [('montype', LONG)], slow=True, js_file=MONSTER_DATA,
         assumptions=GROWNUPS_ASSUMPTIONS, require_counterexamples=True,
         configure=grownups_state, arguments=growth_arguments,
         pre=lambda s: [s['montype'] >= 0, s['montype'] < 383],
         probes=[('montype narrows to C int', lambda s: [s['montype'] == 2 ** 32 + 5])],
         mutants=[(MONSTER_DATA, 'return MONSTER_GROWTH_TARGET[mnum] ?? mnum;',
                   'return MONSTER_GROWTH_TARGET[mnum + 1] ?? mnum;')]),
    Spec('big_to_little:tables', 'big_to_little', 'monsterYoungerForm',
         [('montype', LONG)], slow=True, js_file=MONSTER_DATA,
         assumptions=GROWNUPS_ASSUMPTIONS + (
             'mondata.c:big_to_little takes the first grownups[] row whose grown form matches; grownups[] is ordered by the younger index, so the emitted findIndex over MONSTER_GROWTH_TARGET returns the same source species',
         ), require_counterexamples=True,
         configure=grownups_state, arguments=growth_arguments,
         pre=lambda s: [s['montype'] >= 0, s['montype'] < 383],
         probes=[('montype narrows to C int', lambda s: [s['montype'] == 2 ** 32 + 60])],
         mutants=[(MONSTER_DATA, 'if (candidate !== mnum && grown === mnum)',
                   'if (candidate !== mnum && grown !== mnum)')]),
    Spec('big_little_match:tables', 'big_little_match', 'monsterGrowthFamilyMatch',
         [('montyp1', LONG), ('montyp2', LONG)], js_file=MONSTER_DATA, slow=True,
         assumptions=GROWNUPS_ASSUMPTIONS + (
             'mondata.c:big_little_match reads mons[montyp].mlet through the same initial table; the emitted MONSTER_SYMBOL read corresponds',
         ), require_counterexamples=True,
         configure=growth_pair_state, arguments=growth_pair_arguments,
         pre=lambda s: [s['montyp1'] >= 0, s['montyp1'] < 383,
                        s['montyp2'] >= 0, s['montyp2'] < 383],
         probes=[('montyp1 outside mons[]', lambda s: [s['montyp1'] == 10000,
                                                       s['montyp2'] == 0])],
         mutants=[(MONSTER_DATA, 'if (grown === right)\n            return true;',
                   'if (grown !== right)\n            return true;')]),
    Spec('same_race:tables', 'same_race', 'sameMonsterRace',
         [('left', INT), ('right', INT), ('native_pointer_present', INT)],
         js_file='js/mondata.js', slow=True,
         assumptions=PREDICATE_ASSUMPTIONS + (
             'mondata.c:same_race: the native is_* race macros expand to mons[] flag/symbol reads over the same initial table; the emitted MONSTER_FLAGS2/MONSTER_SYMBOL reads and the mondata.js module constants (GOLEM, KOBOLD, IMP, class and undead letters, kobold/gargoyle/bee/longworm/tengu species) correspond to the native pointer identities and letters they replace',
         ), require_counterexamples=True,
         configure=same_race_state, arguments=same_race_arguments,
         pre=lambda s: [s['left'] >= 0, s['right'] >= 0, s['native_pointer_present'] == 1],
         probes=[('null native species pointer', lambda s: [s['left'] >= 0, s['right'] >= 0,
                                                           s['native_pointer_present'] == 0])],
         mutants=[('js/mondata.js', 'if (left === TENGU || right === TENGU)\n        return false;',
                   'if (left === TENGU)\n        return false;'),
                  ('js/mondata.js', 'return rightClass === KOBOLD || kobolds.has(right);',
                   'return rightClass === KOBOLD;')]),
    Spec('mbirth_limit:tables', 'mbirth_limit', 'monsterBirthLimit',
         [('mndx', LONG)], js_file='js/makemon.js',
         assumptions=(
             'makemon.c:mbirth_limit: PM_NAZGUL and PM_ERINYS correspond to the emitted MONSTER_NAME.indexOf constants; MAXMONNO is 120 in both sources',
         ), require_counterexamples=True,
         pre=int64_argument,
         probes=[('mndx narrows to C int', lambda s: [s['mndx'] == 2 ** 32 + 231])],
         mutants=[('js/makemon.js', 'PM_NAZGUL ? 9', 'PM_NAZGUL ? 8')]),
]


CAN_BLOW_ASSUMPTIONS = (
    'mondata.c:can_blow: the monster argument is a modeled struct monst distinct from &gy.youmonst, so the hero-only Strangled re-check does not run; that check is ported in mondata.js heroCanBlow and stays outside this claim',
    'monst.c:monst_globals_init: mons[] and the emitted MONSTER_SOUND/MONSTER_SIZE/MONSTER_SYMBOL/MONSTER_FLAGS1 rows retain their initial values',
    'mondata.h:is_silent/breathless/verysmall/has_head expand to the same four mons[] fields the emitted speciesCanBlow reads',
)


def can_blow_arguments(world, front):
    values = {name: value for name, value, _ in world.params}
    return ([CPtr(values['native_monster_present'] != 0, 'monster')],
            [V('num', values['species'])])


def can_blow_state(world, front, modules):
    monster_state(world, front, modules)
    # can_blow's hero re-check is `mtmp == &gy.youmonst && Strangled`; the
    # modeled monster is a distinct state object, so the comparison is
    # concretely false and the hero property read stays on the dead branch.
    world.c_globals['gy.youmonst'] = CVal(z3.IntVal(0), INT)


STATE_SPECS += [
    Spec('can_blow:tables', 'can_blow', 'speciesCanBlow',
         [('species', INT), ('native_monster_present', INT)], js_file='js/mondata.js',
         assumptions=CAN_BLOW_ASSUMPTIONS, require_counterexamples=True,
         configure=can_blow_state, arguments=can_blow_arguments,
         pre=lambda s: [s['species'] >= 0, s['native_monster_present'] == 1],
         probes=[('null native monster pointer', lambda s: [s['species'] >= 0,
                                                           s['native_monster_present'] == 0])],
         mutants=[('js/mondata.js', 'return !(monsterIsBreathless(mnum) || !monsterHasHead({ mnum }))',
                   'return !monsterIsBreathless(mnum)'),
                  ('js/mondata.js', '&& requireMonsterData(MONSTER_SIZE, mnum) >= MZ_SMALL',
                   '&& requireMonsterData(MONSTER_SIZE, mnum) > MZ_SMALL')]),
]


PASSIVE_ASSUMPTIONS = (
    'mondata.c:max_passive_dmg: mdef.data and magr.data point to mons[defender_species] and mons[aggressor_species]; emitted defender.mnum and aggressor.mnum equal those species',
    'monst.c:monst_globals_init: mons[] and the emitted MONSTER_ATTACKS/MONSTER_LEVEL tables retain their initial values',
    'mondata.c:Resists_Elem (via monst.h resists_fire/cold/elec/acid) and mondata.js monsterHasFire/Cold/Shock/AcidResistance return the same 0/1 element result for the same aggressor; the masks behind them are mon_resistancebits, covered separately by mon_resistancebits:state, and their weapon/inventory branches are outside this contract',
    'mondata.h:completelyburns/rots/rusts pointer tests correspond to the emitted species-index comparisons',
    'struct monst mhp is int; the domain keeps |mhp| <= 1000000 so every C product stays in range',
)


def passive_pair_state(world, front, modules):
    world.join_paths = True
    world.c_globals['mons'] = native_monsters(world, front)
    values = {name: value for name, value, _ in world.params}
    defender, aggressor = values['defender_species'], values['aggressor_species']
    world.pre.extend([defender >= 0, defender < front.enum_value('NUMMONS'),
                      aggressor >= 0, aggressor < front.enum_value('NUMMONS')])
    world.c_globals['mdef.data'] = CPtr(True, CElement('mons', defender))
    world.c_globals['magr.data'] = CPtr(True, CElement('mons', aggressor))
    world.js_state['defender.mnum'] = defender
    world.js_state['aggressor.mnum'] = aggressor
    symbols = {name: value for name, (value, _) in world.c_state.items()}
    world.c_globals['magr.mhp'] = CVal(symbols['magr.mhp'], INT)
    # The four element resistance helpers enter as equal 0/1 call contracts;
    # their shared mask arithmetic is proved by mon_resistancebits:state.
    values = {name: value for name, value, _ in world.params}
    pointer = CPtr(values['native_pair_present'] != 0, 'magr')
    record = V('obj', 'aggressor')
    for native, js, element, prop in (
            ('resists_acid', 'monsterHasAcidResistance', 'acid', 'ACID_RES'),
            ('resists_cold', 'monsterHasColdResistance', 'cold', 'COLD_RES'),
            ('resists_fire', 'monsterHasFireResistance', 'fire', 'FIRE_RES'),
            ('resists_elec', 'monsterHasShockResistance', 'shock', 'SHOCK_RES')):
        result = symbols[f'resists.{element}']
        index = CVal(z3.IntVal(front.enum_value(prop)), (32, True))
        world.c_calls['Resists_Elem'] = world.c_calls.get('Resists_Elem', []) + [
            ([pointer, index], CVal(result, (32, True)))]
        world.js_calls[('js/mondata.js', js)] = [
            ([record], V('num', world.js_state[f'resists.{element}.js']))]


def passive_pair_arguments(world, front):
    values = {name: value for name, value, _ in world.params}
    present = values['native_pair_present'] != 0
    return ([CPtr(present, 'mdef'), CPtr(present, 'magr')],
            [V('obj', 'defender'), V('obj', 'aggressor')])


def passive_pair_domain(s):
    return [s['defender_species'] >= 0, s['aggressor_species'] >= 0,
            s['native_pair_present'] == 1,
            s['magr.mhp'] >= -1000000, s['magr.mhp'] <= 1000000,
            s['resists.fire'] >= 0, s['resists.fire'] <= 1,
            s['resists.cold'] >= 0, s['resists.cold'] <= 1,
            s['resists.shock'] >= 0, s['resists.shock'] <= 1,
            s['resists.acid'] >= 0, s['resists.acid'] <= 1]


STATE_SPECS += [
    Spec('max_passive_dmg:state', 'max_passive_dmg', 'maxPassiveMonsterDamage',
         [('defender_species', INT), ('aggressor_species', INT),
          ('native_pair_present', INT)],
         slow=True, js_file='js/mondata.js',
         state=[('magr.mhp', INT, 'aggressor.mhp'),
                ('resists.fire', (32, True), 'resists.fire.js'),
                ('resists.cold', (32, True), 'resists.cold.js'),
                ('resists.shock', (32, True), 'resists.shock.js'),
                ('resists.acid', (32, True), 'resists.acid.js')],
         assumptions=PASSIVE_ASSUMPTIONS, require_counterexamples=True,
         configure=passive_pair_state, arguments=passive_pair_arguments,
         pre=passive_pair_domain,
         probes=[('null native monster pointers', lambda s: [
             s['defender_species'] >= 0, s['aggressor_species'] >= 0,
             s['native_pair_present'] == 0,
             s['magr.mhp'] >= -1000000, s['magr.mhp'] <= 1000000,
             s['resists.fire'] >= 0, s['resists.fire'] <= 1]),
                 ('fire resistance result correspondence omitted', UnrelatedState(
                     lambda s: passive_pair_domain(s) + [s['defender_species'] == 111],
                     ('resists.fire',)))],
         mutants=[('js/mondata.js', 'return count * sides * contactCount;',
                   'return count * sides * contactCount + 1;'),
                  ('js/mondata.js',
                   '![AD_PHYS, AD_FIRE, AD_COLD, AD_ELEC, AD_ACID].includes(damageType)',
                   '![AD_FIRE, AD_COLD, AD_ELEC, AD_ACID].includes(damageType)')]),
]


# ---- fv-equivalence-batch-9: the display.h glyph-number encoding ----

# display.h packs every glyph into one int through enum glyph_offsets and the
# macros over it; glyph_numbers.ts is the port owner of that encoding, with
# display.c's zapdir_to_glyph/swallow_to_glyph beside the display layer and
# glyphs.c's glyph_to_cmap decoder in getpos.ts.  Both sides read their own
# tables (clang evaluates the C enum/macros over NUMMONS, NUM_OBJECTS, the
# defsym.h indices, WARNCOUNT, MAXEXPCHARS and MAXTCHARS; the emitted module
# computes the same offsets from MONSTER_COLOR.length, OBJECT_COLOR.length and
# the const.js constants), so the claims never re-type a table value: any
# table drift between the two sides fails the proofs outright.
GLYPH_FILE = 'js/glyph_numbers.js'
GETPOS_FILE = 'js/getpos.js'
DISPLAY_FILE = 'js/display.js'

# The port's terrain decoder is null outside the cmap span (display.ts and
# getpos.ts callers treat null as "no dungeon symbol"), where C returns
# MAXPCHARS or a swallow/explosion symbol.  The two bounds are the display.h
# GLYPH_CMAP_STONE_OFF/GLYPH_SWALLOW_OFF values the claim's own tables carry;
# they are restated here only because a domain bound must be droppable by the
# probe, which cannot weaken a configure-time constraint.
GLYPH_CMAP_STONE_BOUND, GLYPH_SWALLOW_BOUND = 3929, 4093

GLYPH_ASSUMPTIONS = (
    'display.h:enum glyph_offsets drives both sides through their own tables: clang evaluates the C enumerators over NUMMONS, NUM_OBJECTS, the defsym.h indices, WARNCOUNT, MAXEXPCHARS and MAXTCHARS, and the emitted glyph_numbers.js computes the same offsets from MONSTER_COLOR.length, OBJECT_COLOR.length, MAXEXPCHARS, MAXTCHARS and WARNCOUNT; no offset is re-typed in the spec',
    'glyph numbers are native ints and every C caller stays inside int32; the +-2^30 input bounds below only keep C additions defined (callers pass species indices, cmap indices, warning levels or explosion characters far inside them)',
)


def glyph_range(s, name, bound=2 ** 30):
    return [s[name] >= -bound, s[name] <= bound]


def narrow(name, value):
    """A domain probe pinned to one concrete narrowing input."""
    return (f'{name} narrows to C int', lambda s: [s[name] == value])


STATE_SPECS += [
    Spec('warning_to_glyph', 'verification_warning_to_glyph', 'warningToGlyph',
         [('mwarnlev', LONG)], js_file=GLYPH_FILE,
         assumptions=GLYPH_ASSUMPTIONS + (
             'display.c:643 display_warning() passes the warning level in 0..WARNCOUNT-1',
         ), require_counterexamples=True, pre=lambda s: glyph_range(s, 'mwarnlev'),
         probes=[narrow('mwarnlev', 2 ** 32)],
         mutants=[(GLYPH_FILE, 'return mwarnlev + GlyphOffset.warning;',
                   'return mwarnlev + GlyphOffset.warning + 1;')]),
    Spec('monnum_to_glyph', 'verification_monnum_to_glyph', 'monnumToGlyph',
         [('mnum', LONG), ('gnd', INT)], js_file=GLYPH_FILE,
         assumptions=GLYPH_ASSUMPTIONS + (
             'display.h:monnum_to_glyph selects the female range for every gender but MALE, NEUTER included; display_self() passes monsndx species and Ugender',
         ), require_counterexamples=True,
         pre=lambda s: glyph_range(s, 'mnum') + int_argument(s, 'gnd'),
         probes=[narrow('mnum', 2 ** 32 + 5, )],
         mutants=[(GLYPH_FILE,
                   'return mnum + (gender === MALE ? GlyphOffset.monMale : GlyphOffset.monFemale);',
                   'return mnum + (gender === MALE ? GlyphOffset.monFemale : GlyphOffset.monMale);')]),
    Spec('petnum_to_glyph', 'verification_petnum_to_glyph', 'petnumToGlyph',
         [('mnum', LONG), ('gnd', INT)], js_file=GLYPH_FILE,
         assumptions=GLYPH_ASSUMPTIONS + (
             'display.h:petnum_to_glyph selects the female pet range for every gender but MALE',
         ), require_counterexamples=True,
         pre=lambda s: glyph_range(s, 'mnum') + int_argument(s, 'gnd'),
         probes=[narrow('mnum', 2 ** 32 + 5)],
         mutants=[(GLYPH_FILE,
                   'return mnum + (gender === MALE ? GlyphOffset.petMale : GlyphOffset.petFemale);',
                   'return mnum + (gender === MALE ? GlyphOffset.detectMale : GlyphOffset.petFemale);')]),
    Spec('detected_monnum_to_glyph', 'verification_detected_monnum_to_glyph',
         'detectedMonnumToGlyph', [('mnum', LONG), ('gnd', INT)], js_file=GLYPH_FILE,
         assumptions=GLYPH_ASSUMPTIONS + (
             'display.h:detected_monnum_to_glyph selects the female detected range for every gender but MALE',
         ), require_counterexamples=True,
         pre=lambda s: glyph_range(s, 'mnum') + int_argument(s, 'gnd'),
         probes=[narrow('mnum', 2 ** 32 + 5)],
         mutants=[(GLYPH_FILE,
                   'return mnum + (gender === MALE ? GlyphOffset.detectMale : GlyphOffset.detectFemale);',
                   'return mnum + (gender === MALE ? GlyphOffset.riddenMale : GlyphOffset.detectFemale);')]),
    Spec('ridden_monnum_to_glyph', 'verification_ridden_monnum_to_glyph',
         'riddenMonnumToGlyph', [('mnum', LONG), ('gnd', INT)], js_file=GLYPH_FILE,
         assumptions=GLYPH_ASSUMPTIONS + (
             'display.h:ridden_monnum_to_glyph selects the female ridden range for every gender but MALE; display.h:maybe_display_usteed passes the steed',
         ), require_counterexamples=True,
         pre=lambda s: glyph_range(s, 'mnum') + int_argument(s, 'gnd'),
         probes=[narrow('mnum', 2 ** 32 + 5)],
         mutants=[(GLYPH_FILE,
                   'return mnum + (gender === MALE ? GlyphOffset.riddenMale : GlyphOffset.riddenFemale);',
                   'return mnum + (gender === MALE ? GlyphOffset.riddenMale : GlyphOffset.riddenMale);')]),
    Spec('objnum_to_glyph', 'verification_objnum_to_glyph', 'objnumToGlyph',
         [('onum', LONG)], js_file=GLYPH_FILE,
         assumptions=GLYPH_ASSUMPTIONS + (
             'display.h:objnum_to_glyph adds the object number; botl.c and cmd.c pass otyp values and display_self() the hero disguise',
         ), require_counterexamples=True, pre=lambda s: glyph_range(s, 'onum'),
         probes=[narrow('onum', 2 ** 32 + 9)],
         mutants=[(GLYPH_FILE, 'return onum + GlyphOffset.object;',
                   'return onum + GlyphOffset.objectPiletop;')]),
    Spec('explosion_to_glyph', 'verification_explosion_to_glyph', 'explosionToGlyph',
         [('expltyp', INT), ('idx', LONG)], js_file=GLYPH_FILE,
         assumptions=GLYPH_ASSUMPTIONS + (
             'display.h:explosion_to_glyph defaults every type but the six named ones, EXPL_DARK included, to the fiery range; explode.c passes S_expl_tl..S_expl_br indices',
         ), require_counterexamples=True,
         pre=lambda s: int_argument(s, 'expltyp') + glyph_range(s, 'idx'),
         probes=[narrow('idx', 2 ** 32 + 97)],
         mutants=[(GLYPH_FILE, ': GlyphOffset.explodeFiery);', ': GlyphOffset.explodeFrosty);')]),
    Spec('altar_to_glyph', 'verification_altar_to_glyph', 'altarToGlyph',
         [('amsk', LONG)], js_file=GLYPH_FILE,
         assumptions=GLYPH_ASSUMPTIONS + (
             'display.h:altar_to_glyph tests AM_SANCTUM first and then the three-bit alignment mask; every undefined mask value stays unaligned, and JS int32 bitwise coercion matches the C int conversions for every exact-integer input',
         ), require_counterexamples=True, pre=lambda s: int_argument(s, 'amsk'),
         probes=[('mask outside the exact JS integer range',
                  lambda s: [s['amsk'] == 2 ** 53 + 1])],
         mutants=[(GLYPH_FILE, 'return GlyphOffset.altar + 3;', 'return GlyphOffset.altar + 1;')]),
    Spec('zapdir_to_glyph', 'zapdir_to_glyph', 'zapdirToGlyph',
         [('dx', LONG), ('dy', LONG), ('beam_type', INT)], js_file=DISPLAY_FILE,
         assumptions=GLYPH_ASSUMPTIONS + (
             'display.c:zapdir_to_glyph callers pass sgn() deltas and a zap-colors enum value below NUM_ZAP, so the impossible() arm stays unreachable; display.c:1132 passes (sgn(tdx), sgn(tdy), 2)',
         ), require_counterexamples=True,
         pre=lambda s: int_argument(s, 'dx') + int_argument(s, 'dy') + int_argument(s, 'beam_type'),
         configure=lambda world, front, modules: world.pre.extend(
             [world.params[2][1] >= 0,
              world.params[2][1] < front.enum_value('verification_num_zap')]),
         probes=[('dx narrows to C int', lambda s: [s['dx'] == 2 ** 32 + 1, s['dy'] == 1,
                                                    s['beam_type'] == 0])],
         mutants=[(DISPLAY_FILE, 'const direction = dx === dy ? 2 : dx && dy ? 3 : dx ? 1 : 0;',
                   'const direction = dx === dy ? 3 : dx && dy ? 3 : dx ? 1 : 0;')]),
    Spec('glyph_is_monster', 'verification_glyph_is_monster', 'glyphIsMonster',
         [('glyph', LONG)], slow=True, js_file=GLYPH_FILE,
         assumptions=GLYPH_ASSUMPTIONS + (
             'display.h:glyph_is_monster() is exactly the normal, pet, detected and ridden ranges; bodies, statues and the invisible placeholder are not monsters',
         ), require_counterexamples=True, pre=lambda s: int_argument(s, 'glyph'),
         probes=[narrow('glyph', 2 ** 32 + 5)],
         mutants=[(GLYPH_FILE, 'glyphIsNormalMonster(glyph) || glyphIsPet(glyph)',
                   'glyphIsNormalMonster(glyph)')]),
    Spec('glyph_is_pet', 'verification_glyph_is_pet', 'glyphIsPet',
         [('glyph', LONG)], js_file=GLYPH_FILE,
         assumptions=GLYPH_ASSUMPTIONS, require_counterexamples=True,
         pre=lambda s: int_argument(s, 'glyph'),
         probes=[narrow('glyph', 2 ** 32 + 2 * 383)],
         mutants=[(GLYPH_FILE, 'return glyphIsMalePet(glyph) || glyphIsFemalePet(glyph);',
                   'return glyphIsMalePet(glyph);')]),
    Spec('glyph_is_invisible', 'verification_glyph_is_invisible', 'glyphIsInvisible',
         [('glyph', LONG)], js_file=GLYPH_FILE,
         assumptions=GLYPH_ASSUMPTIONS, require_counterexamples=True,
         pre=lambda s: int_argument(s, 'glyph'),
         probes=[narrow('glyph', 2 ** 32 + 4 * 383)],
         mutants=[(GLYPH_FILE, 'return glyph === GlyphOffset.invisible;',
                   'return glyph !== GlyphOffset.invisible;')]),
    Spec('glyph_is_detected_monster', 'verification_glyph_is_detected_monster',
         'glyphIsDetectedMonster', [('glyph', LONG)], js_file=GLYPH_FILE,
         assumptions=GLYPH_ASSUMPTIONS, require_counterexamples=True,
         pre=lambda s: int_argument(s, 'glyph'),
         probes=[narrow('glyph', 2 ** 32 + 4 * 383 + 1)],
         mutants=[(GLYPH_FILE, 'glyphIsDetectedMaleMonster(glyph) || glyphIsDetectedFemaleMonster(glyph);',
                   'glyphIsDetectedMaleMonster(glyph) || glyphIsRiddenFemaleMonster(glyph);')]),
    Spec('glyph_is_ridden_monster', 'verification_glyph_is_ridden_monster',
         'glyphIsRiddenMonster', [('glyph', LONG)], js_file=GLYPH_FILE,
         assumptions=GLYPH_ASSUMPTIONS, require_counterexamples=True,
         pre=lambda s: int_argument(s, 'glyph'),
         probes=[narrow('glyph', 2 ** 32 + 2682)],
         mutants=[(GLYPH_FILE, 'glyphIsRiddenMaleMonster(glyph) || glyphIsRiddenFemaleMonster(glyph);',
                   'glyphIsRiddenMaleMonster(glyph) || glyphIsDetectedFemaleMonster(glyph);')]),
    Spec('glyph_is_body', 'verification_glyph_is_body', 'glyphIsBody',
         [('glyph', LONG)], js_file=GLYPH_FILE,
         assumptions=GLYPH_ASSUMPTIONS + (
             'display.h:glyph_is_body() spans the plain and piletop corpse ranges',
         ), require_counterexamples=True, pre=lambda s: int_argument(s, 'glyph'),
         probes=[narrow('glyph', 2 ** 32 + 2299)],
         mutants=[(GLYPH_FILE, 'glyph >= GlyphOffset.body && glyph < GlyphOffset.body + NUMMONS',
                   'glyph >= GlyphOffset.body && glyph < GlyphOffset.body + NUMMONS + 1')]),
    Spec('glyph_is_statue', 'verification_glyph_is_statue', 'glyphIsStatue',
         [('glyph', LONG)], js_file=GLYPH_FILE,
         assumptions=GLYPH_ASSUMPTIONS + (
             'display.h:glyph_is_statue() spans the male and female plain and piletop statue ranges',
         ), require_counterexamples=True, pre=lambda s: int_argument(s, 'glyph'),
         probes=[narrow('glyph', 2 ** 32 + 7226)],
         mutants=[(GLYPH_FILE, 'return glyphIsMaleStatue(glyph) || glyphIsFemStatue(glyph);',
                   'return glyphIsMaleStatue(glyph);')]),
    Spec('glyph_is_object', 'verification_glyph_is_object', 'glyphIsObject',
         [('glyph', LONG)], js_file=GLYPH_FILE, slow=True,
         assumptions=GLYPH_ASSUMPTIONS + (
             'display.h:glyph_is_object() is the normal, generic, statue and body ranges; the generic rows run from the strange object to the first real object (FIRST_OBJECT == ARROW)',
         ), require_counterexamples=True, pre=lambda s: int_argument(s, 'glyph'),
         probes=[narrow('glyph', 2 ** 32 + 3448)],
         mutants=[(GLYPH_FILE, 'glyphIsStatue(glyph) || glyphIsBody(glyph)',
                   'glyphIsBody(glyph)')]),
    Spec('glyph_is_trap', 'verification_glyph_is_trap', 'glyphIsTrap',
         [('glyph', LONG)], js_file=GLYPH_FILE,
         assumptions=GLYPH_ASSUMPTIONS + (
             'display.h:GLYPH_TRAP_OFF is the tail of cmap range B and glyph_is_trap() spans MAXTCHARS glyphs',
         ), require_counterexamples=True, pre=lambda s: int_argument(s, 'glyph'),
         probes=[narrow('glyph', 2 ** 32 + 4011 + 15)],
         mutants=[(GLYPH_FILE, 'return glyph >= offset && glyph < offset + MAXTCHARS;',
                   'return glyph >= offset && glyph <= offset + MAXTCHARS;')]),
    Spec('glyph_is_cmap', 'verification_glyph_is_cmap', 'glyphIsCmap',
         [('glyph', LONG)], js_file=GLYPH_FILE,
         assumptions=GLYPH_ASSUMPTIONS + (
             'display.h:glyph_is_cmap() spans stone through the end of cmap range C',
         ), require_counterexamples=True, pre=lambda s: int_argument(s, 'glyph'),
         probes=[narrow('glyph', 2 ** 32 + 3929)],
         mutants=[(GLYPH_FILE, 'glyph < GlyphOffset.cmapC + (CmapSymbol.goodpos - CmapSymbol.digbeam + 1);',
                   'glyph < GlyphOffset.cmapC + (CmapSymbol.goodpos - CmapSymbol.digbeam + 2);')]),
    Spec('glyph_is_swallow', 'verification_glyph_is_swallow', 'glyphIsSwallow',
         [('glyph', LONG)], js_file=GLYPH_FILE,
         assumptions=GLYPH_ASSUMPTIONS + (
             'display.h:glyph_is_swallow() spans the NUMMONS<<3 swallow cells',
         ), require_counterexamples=True, pre=lambda s: int_argument(s, 'glyph'),
         probes=[narrow('glyph', 2 ** 32 + 4093)],
         mutants=[(GLYPH_FILE, 'glyph < GlyphOffset.swallow + (NUMMONS << 3);',
                   'glyph < GlyphOffset.swallow + (NUMMONS << 4);')]),
    Spec('glyph_is_warning', 'verification_glyph_is_warning', 'glyphIsWarning',
         [('glyph', LONG)], js_file=GLYPH_FILE,
         assumptions=GLYPH_ASSUMPTIONS + (
             'display.h:glyph_is_warning() spans the WARNCOUNT warning glyphs',
         ), require_counterexamples=True, pre=lambda s: int_argument(s, 'glyph'),
         probes=[narrow('glyph', 2 ** 32 + 7220)],
         mutants=[(GLYPH_FILE, 'glyph < GlyphOffset.warning + WARNCOUNT;',
                   'glyph < GlyphOffset.warning + WARNCOUNT + 1;')]),
    Spec('glyph_is_explosion', 'verification_glyph_is_explosion', 'glyphIsExplosion',
         [('glyph', LONG)], js_file=GLYPH_FILE,
         assumptions=GLYPH_ASSUMPTIONS + (
             'display.h:glyph_is_explosion() spans the seven MAXEXPCHARS explosion ranges',
         ), require_counterexamples=True, pre=lambda s: int_argument(s, 'glyph'),
         probes=[narrow('glyph', 2 ** 32 + 7157)],
         mutants=[(GLYPH_FILE, 'glyph < MAXEXPCHARS + GlyphOffset.explodeFrosty;',
                   'glyph < MAXEXPCHARS + GlyphOffset.explodeFrosty + 1;')]),
    Spec('glyph_is_cmap_zap', 'verification_glyph_is_cmap_zap', 'glyphIsCmapZap',
         [('glyph', LONG)], js_file=GLYPH_FILE,
         assumptions=GLYPH_ASSUMPTIONS + (
             'display.h:glyph_is_cmap_zap() spans the NUM_ZAP<<2 beam glyphs',
         ), require_counterexamples=True, pre=lambda s: int_argument(s, 'glyph'),
         probes=[narrow('glyph', 2 ** 32 + 4051)],
         mutants=[(GLYPH_FILE, 'glyph < (NUM_ZAP << 2) + GlyphOffset.zap;',
                   'glyph < (NUM_ZAP << 3) + GlyphOffset.zap;')]),
    Spec('glyph_to_mon', 'verification_glyph_to_mon', 'glyphToMon',
         [('glyph', LONG)], slow=True, js_file=GLYPH_FILE,
         assumptions=GLYPH_ASSUMPTIONS + (
             'display.h:glyph_to_mon() decodes every monster range to its species and returns the fencepost NUMMONS elsewhere',
         ), require_counterexamples=True, pre=lambda s: int_argument(s, 'glyph'),
         probes=[narrow('glyph', 2 ** 32 + 383)],
         mutants=[(GLYPH_FILE, 'glyphIsNormalFemaleMonster(glyph) ? glyph - GlyphOffset.monFemale',
                   'glyphIsNormalFemaleMonster(glyph) ? glyph - GlyphOffset.detectFemale')]),
    Spec('glyph_to_obj', 'verification_glyph_to_obj', 'glyphToObj',
         [('glyph', LONG)], js_file=GLYPH_FILE, slow=True,
         assumptions=GLYPH_ASSUMPTIONS + (
             'display.h:glyph_to_obj() maps bodies to CORPSE and statues to STATUE, decodes generic glyphs to their class marker, and returns the fencepost NUM_OBJECTS elsewhere',
         ), require_counterexamples=True, pre=lambda s: int_argument(s, 'glyph'),
         probes=[narrow('glyph', 2 ** 32 + 3448)],
         mutants=[(GLYPH_FILE, 'glyphIsBody(glyph) ? CORPSE', 'glyphIsBody(glyph) ? STATUE')]),
    Spec('glyph_to_swallow', 'verification_glyph_to_swallow', 'glyphToSwallow',
         [('glyph', LONG)], slow=True, js_file=GLYPH_FILE,
         assumptions=GLYPH_ASSUMPTIONS + (
             'display.h:glyph_to_swallow() masks the low three bits and returns zero outside the range',
         ), require_counterexamples=True, pre=lambda s: int_argument(s, 'glyph'),
         probes=[narrow('glyph', 2 ** 32 + 4093 + 5 * 8 + 3)],
         mutants=[(GLYPH_FILE, '(glyph - GlyphOffset.swallow) & 0x7 : 0;',
                   '(glyph - GlyphOffset.swallow) & 0x3 : 0;')]),
    Spec('glyph_to_warning', 'verification_glyph_to_warning', 'glyphToWarning',
         [('glyph', LONG)], js_file=GLYPH_FILE,
         assumptions=GLYPH_ASSUMPTIONS + (
             'display.h:glyph_to_warning() returns the level inside the warning range and zero outside',
         ), require_counterexamples=True, pre=lambda s: int_argument(s, 'glyph'),
         probes=[narrow('glyph', 2 ** 32 + 7220 + 2)],
         mutants=[(GLYPH_FILE, 'glyph - GlyphOffset.warning : 0;', 'glyph - GlyphOffset.warning : 1;')]),
    Spec('glyph_to_explosion', 'verification_glyph_to_explosion', 'glyphToExplosion',
         [('glyph', LONG)], js_file=GLYPH_FILE,
         assumptions=GLYPH_ASSUMPTIONS + (
             'display.h:glyph_to_explosion() reduces to one of the nine explosion characters and returns zero outside the range',
         ), require_counterexamples=True, pre=lambda s: int_argument(s, 'glyph'),
         probes=[narrow('glyph', 2 ** 32 + 7157 + 9 + 4)],
         mutants=[(GLYPH_FILE, '% (CmapSymbol.explosionBottomRight - CmapSymbol.explosionTopLeft + 1)',
                   '% (CmapSymbol.explosionBottomRight - CmapSymbol.explosionTopLeft + 2)')]),
    Spec('glyph_to_trap', 'verification_glyph_to_trap', 'glyphToTrap',
         [('glyph', LONG)], js_file=GLYPH_FILE,
         assumptions=GLYPH_ASSUMPTIONS + (
             'display.h:glyph_to_trap() decodes through rm.h:defsym_to_trap and returns NO_GLYPH (== MAX_GLYPH) elsewhere',
         ), require_counterexamples=True, pre=lambda s: int_argument(s, 'glyph'),
         probes=[narrow('glyph', 2 ** 32 + 4011 + 15 + 3)],
         mutants=[(GLYPH_FILE, '? glyph - glyphTrapOffset() + 1', '? glyph - glyphTrapOffset() + 2')]),
]


def swallow_state(world, front, modules):
    """display.c:swallow_to_glyph stays on what_mon's sober arm: the hero's
    HALLUC property intrinsic (youprop.h:HHallucination) is pinned clear, so
    display.h:what_mon returns its monster unchanged and the macro's indirect
    display-RNG call never runs.  The port resolves hallucination through
    senses.js:heroIsHallucinating reading game.u, so the same fact is pinned
    on its side; the hallucinating path is the display-RNG draw shared with
    the separately proved rn2_on_display_rng, but its per-call species choice
    through a function pointer stays outside this claim."""
    size = front.enum_value('LAST_PROP') + 1
    world.c_globals['u.uprops'] = CArray(tuple(CState(f'u.uprops[{i}]') for i in range(size)))
    world.c_globals[f'u.uprops[{front.enum_value("HALLUC")}].intrinsic'] = CVal(z3.IntVal(0), LONG)
    resistance = z3.Int('u.uprops[HALLUC_RES].intrinsic')
    world.c_globals[f'u.uprops[{front.enum_value("HALLUC_RES")}].intrinsic'] = CVal(resistance, LONG)
    world.pre.extend([resistance >= 0, resistance <= 1])
    world.js_state['game.u.hallucinationTurns'] = z3.IntVal(0)
    js_resistance = z3.Int('js:game.u.hallucinationResistance')
    world.js_state['game.u.hallucinationResistance'] = js_resistance
    world.pre.extend([js_resistance >= 0, js_resistance <= 1])
    loc = world.params[1][1]
    world.pre.extend([loc >= front.enum_value('S_sw_tl'), loc <= front.enum_value('S_sw_br')])


STATE_SPECS += [
    Spec('swallow_to_glyph', 'swallow_to_glyph', 'swallowToGlyph',
         [('mnum', LONG), ('loc', LONG)], js_file=DISPLAY_FILE,
         assumptions=GLYPH_ASSUMPTIONS + (
             'display.c:swallow_to_glyph callers (display.c:swallowed) pass monsndx(u.ustuck->data) and one of the eight S_sw_* positions, so the impossible() clamp arm stays unreachable',
             'the hallucinating path resolves its species through display.h:what_mon and the display RNG on both sides; this claim pins HHallucination clear (dungeon-independent property state) so the indirect rng call stays on the dead arm, and the port shares the same sober arm through senses.js:heroIsHallucinating',
         ), require_counterexamples=True, configure=swallow_state,
         pre=lambda s: [s['mnum'] >= 0, s['mnum'] < 2 ** 27] + int_argument(s, 'loc'),
         probes=[('negative species is a C left-shift UB', lambda s: [s['mnum'] == -1])],
         mutants=[(DISPLAY_FILE,
                   'return ((shown << 3) | (position - CmapSymbol.swallowTopLeft)) + GlyphOffset.swallow;',
                   'return ((shown << 3) | (position - CmapSymbol.swallowTopLeft)) + GlyphOffset.swallow + 1;')]),
]


def cmap_branch_state(world, front, modules):
    """display.h:cmap_walls_to_glyph picks its wall base from four branch
    tests.  dungeon.c:In_mines and on_level execute for real over the modeled
    u.uz and dungeon_topology state; dungeon.c:1942 In_hell reads
    svd.dungeons[u.uz.dnum].flags.hellish, an array this claim cannot model,
    so it enters as an equal 0/1 call contract named for that field."""
    symbols = {name: value for name, (value, _) in world.c_state.items()}
    world.c_calls['In_hell'] = [([CPtr(True, 'u.uz')],
                                 CVal(symbols['svd.dungeons.flags.hellish'], (32, True)))]


def cmap_to_glyph_arguments(world, front):
    """The port's wallOffset argument is the base display.h:cmap_walls_to_glyph
    selects: In_mines, then In_hell, then Is_knox (dungeon.h:Lcheck over
    on_level and Lassigned), then In_sokoban, else the main walls."""
    symbols = {name: value for name, (value, _) in world.c_state.items()}
    cmap_idx = world.params[0][1]
    knox = symbols['svd.dungeon_topology.d_knox_level.dnum']
    knox_level = symbols['svd.dungeon_topology.d_knox_level.dlevel']
    assigned = z3.Or(knox_level != 0, knox != 0)
    on_knox = z3.And(symbols['u.uz.dnum'] == knox, symbols['u.uz.dlevel'] == knox_level)
    base = z3.If(symbols['u.uz.dnum'] == symbols['svd.dungeon_topology.d_mines_dnum'],
                 z3.IntVal(front.enum_value('GLYPH_CMAP_MINES_OFF')),
                 z3.If(symbols['svd.dungeons.flags.hellish'] != 0,
                       z3.IntVal(front.enum_value('GLYPH_CMAP_GEH_OFF')),
                       z3.If(z3.And(assigned, on_knox),
                             z3.IntVal(front.enum_value('GLYPH_CMAP_KNOX_OFF')),
                             z3.If(symbols['u.uz.dnum'] == symbols['svd.dungeon_topology.d_sokoban_dnum'],
                                   z3.IntVal(front.enum_value('GLYPH_CMAP_SOKO_OFF')),
                                   z3.IntVal(front.enum_value('GLYPH_CMAP_MAIN_OFF'))))))
    return ([CVal(convert(cmap_idx, LONG, (32, True)), (32, True))],
            [V('num', cmap_idx), V('num', base)])


STATE_SPECS += [
    Spec('cmap_to_glyph', 'verification_cmap_to_glyph', 'cmapToGlyph',
         [('cmap_idx', LONG)], js_file=GLYPH_FILE,
         state=[('u.uz.dnum', (16, True), None),
                ('u.uz.dlevel', (16, True), None),
                ('svd.dungeon_topology.d_mines_dnum', (16, True), None),
                ('svd.dungeon_topology.d_sokoban_dnum', (16, True), None),
                ('svd.dungeon_topology.d_knox_level.dnum', (16, True), None),
                ('svd.dungeon_topology.d_knox_level.dlevel', (16, True), None),
                ('svd.dungeons.flags.hellish', (32, True), None)],
         assumptions=GLYPH_ASSUMPTIONS + (
             'display.h:cmap_to_glyph dispatches stone, the branch wall ranges, cmap A, the neutral altar, cmap B (traps included) and cmap C, and returns NO_GLYPH past S_goodpos; callers pass cmap symbol indices 0..MAXPCHARS',
             'the wall base is an entry relation: the port caller (display.ts currentWallGlyphOffset) derives its wallOffset from the game branch state, and this claim supplies exactly the base display.h:cmap_walls_to_glyph selects from the same modeled u.uz/dungeon_topology state; dungeon.c:In_mines and on_level execute for real, and dungeon.c:1942 In_hell enters as an equal 0/1 contract for svd.dungeons[u.uz.dnum].flags.hellish, whose array the executor cannot model',
         ), require_counterexamples=True, configure=cmap_branch_state,
         arguments=cmap_to_glyph_arguments,
         pre=lambda s: glyph_range(s, 'cmap_idx'),
         probes=[narrow('cmap_idx', 2 ** 32 + 3)],
         mutants=[(GLYPH_FILE, 'return symbol - CmapSymbol.vwall + wallOffset;',
                   'return symbol - CmapSymbol.vwall + wallOffset + 1;')]),
    Spec('glyph_to_cmap', 'glyph_to_cmap', 'glyphToCmapSymbol',
         [('glyph', LONG)], js_file=GETPOS_FILE,
         assumptions=GLYPH_ASSUMPTIONS + (
             'glyphs.c:glyph_to_cmap decodes every terrain glyph: the five wall ranges map back onto S_vwall..S_trwall, cmap A onto S_ndoor.., the altar range onto S_altar, cmap B onto S_grave.., the zap beams modulo four and cmap C onto S_digbeam..',
             'the port decodes terrain only: it returns null where C returns MAXPCHARS or a swallow/explosion symbol, and its callers (getpos feature search, display terrain memory) treat null as no dungeon symbol; the domain is the cmap span GLYPH_CMAP_STONE_OFF..GLYPH_SWALLOW_OFF, restated numerically above because the probe must be able to leave it',
         ), require_counterexamples=True,
         pre=lambda s: [s['glyph'] >= GLYPH_CMAP_STONE_BOUND,
                        s['glyph'] < GLYPH_SWALLOW_BOUND],
         probes=[('swallow glyphs are terrain to C and null to the port',
                  lambda s: [s['glyph'] == GLYPH_SWALLOW_BOUND])],
         mutants=[(GETPOS_FILE, 'return (glyph - GlyphOffset.zap) % 4 + 74;',
                   'return (glyph - GlyphOffset.zap) % 4 + 75;')]),
]
