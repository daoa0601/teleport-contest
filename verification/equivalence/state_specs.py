"""Claims over explicit hero, monster and read-only call correspondences."""
import z3

from csym import CElement, CPtr, CVal
from jssym import V
from specs import (ATTRIBUTES, ATTRIB, HIT_BONUS, HUMAN_FORM, INT,
                   INT_MAX, LONG, SCHAR, Spec, ULEVEL, UnrelatedState,
                   WEAPON_DAMAGE)
from state_world import (AT_ENGL, AT_WEAP,
                         capacity_state, direction_arguments, direction_state,
                         experience_arguments,
                         experience_state, hero_state, hit_bonus_state,
                         inventory_state, movement_arguments, movement_state,
                         skill_bonus_arguments, skill_bonus_domain, skill_bonus_state,
                         species_predicate_arguments, species_predicate_state,
                         symbolic_attacks, symbolic_attack_arguments,
                         capacity_arguments, sign_state, sign_arguments,
                         weight_arguments, weight_domain, weight_state)
from core import select_int
from state_world import (_objects_member, erosion_matters_guard, monster_state,
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
                 'mondata.c', 'polyself.c', 'dungeon.c', 'mkobj.c', 'objnam.c')
STATE_JS_FILES = (
    'js/monster_data.js', 'js/monster_attack_types.js', 'js/artifacts.js',
    'js/artifact_data.js', 'js/makemon.js', 'js/polyself.js', 'js/dungeon.js',
    'js/mon.js', 'js/monmove.js', 'js/hack.js', 'js/mkobj.js',
    'js/properties.js', 'js/property_types.js', 'js/do_wear.js', 'js/muse.js',
    'js/cmd.js', 'js/skills.js', 'js/mondata.js', 'js/objnam.js', 'js/o_init.js',
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
         WEAPON_BONUS_PARAMS, js_file='js/skills.js', require_counterexamples=True,
         state=WEAPON_BONUS_STATE, enum_state=ROLE_ENUM, configure=skill_bonus_state,
         arguments=skill_bonus_arguments, pre=skill_bonus_domain,
         assumptions=WEAPON_BONUS_ASSUMPTIONS,
         probes=[('riding skill correspondence omitted', UnrelatedState(
             lambda s: skill_bonus_domain(s) + [s['usteed_present'] == 1],
             ('u.weapon_skills[37].skill',)))],
         mutants=[('js/skills.js', 'bonus = level <= P_UNSKILLED ? -4 : level === P_BASIC ? 0',
                   'bonus = level <= P_UNSKILLED ? -5 : level === P_BASIC ? 0'),
                  ('js/skills.js', 'if (riding <= P_UNSKILLED)\n            bonus -= 2;',
                   'if (riding <= P_UNSKILLED)\n            bonus -= 3;')]),
    Spec('weapon_dam_bonus:state', 'weapon_dam_bonus', 'weaponSkillDamageBonus',
         WEAPON_BONUS_PARAMS, js_file='js/skills.js', require_counterexamples=True,
         state=WEAPON_BONUS_STATE, enum_state=ROLE_ENUM, configure=skill_bonus_state,
         arguments=skill_bonus_arguments, pre=skill_bonus_domain,
         assumptions=WEAPON_BONUS_ASSUMPTIONS,
         probes=[('riding skill correspondence omitted', UnrelatedState(
             lambda s: skill_bonus_domain(s) + [s['usteed_present'] == 1],
             ('u.weapon_skills[37].skill',)))],
         mutants=[('js/skills.js', ': level === P_SKILLED ? 1 : level === P_EXPERT ? 2 : -2;',
                   ': level === P_SKILLED ? 1 : level === P_EXPERT ? 3 : -2;'),
                  ('js/skills.js', 'if (riding === P_SKILLED)\n            bonus++;',
                   'if (riding === P_BASIC)\n            bonus++;')]),
]


def species_record_arguments(world, front):
    values = {name: value for name, value, _ in world.params}
    pointer = CPtr(values['native_pointer_present'] != 0,
                   CElement('mons', values['species']))
    return ([pointer], [V('record', {'mnum': V('num', values['species'])})])


STATE_SPECS += [
    Spec(name, native, port, [('species', INT), ('native_pointer_present', INT)],
         js_file=js_file,
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
         'js/mondata.js', '(M1_WALLWALK | M1_AMORPHOUS | M1_UNSOLID | M1_METALLIVORE))',
         '(M1_AMORPHOUS | M1_UNSOLID | M1_METALLIVORE))'),
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
         js_file='js/polyself.js', require_counterexamples=True, configure=dragon_state,
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
    Spec('weight:stack', 'weight', 'objectWeight', [], js_file='js/mkobj.js',
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
         mutants=[(MONSTER_DATA, '!!(flags & (M2_UNDEAD | M2_DEMON));',
                   '!!(flags & M2_UNDEAD);')]),
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
                 ('intrinsic mask correspondence omitted', UnrelatedState(
                     lambda s: [s['native_monster_present'] == 1],
                     ('monster.mintrinsics',)))],
         mutants=[('js/mondata.js',
                   '| (monster?.mextrinsics ?? 0) | (monster?.mintrinsics ?? 0);',
                   '| (monster?.mextrinsics ?? 0);')]),
]

OBJECT_PREDICATE_ASSUMPTIONS = (
    'objects.c:objects_globals_init and object_data.js tables retain their initial values; o_init.js:objectMaterial reads the emitted per-game material map first, so the claim relates the initial emitted OBJECT_MATERIAL entries and leaves the o_init.c:shuffle correspondence (same algorithm on both sides) outside the entry relation',
    'the zero-material rows 1..17 (generic class markers) can occur on a struct obj only as pager.c:object_from_map temporary naming objects (OBJ_NAME is non-null for the GENERIC rows); there C is true and the port is false, but the difference is unobservable: mksobj(glyphotyp, FALSE, FALSE) copies cg.zeroobj so oeroded/oeroded2/oerodeproof are zero and rknown false (mkobj_erosions runs only under init), add_erosion_words then prints nothing, and the caller deallocates the object at once (pager.c:376); the rows are oc_nowish, so readobjnam\'s other is_damageable call cannot name one, and neither mkobj nor mksobj places them',
)


def object_table_index_precondition(world, front, otyp):
    """Keep otyp inside both tables: the native objects[] carries one
    terminator row past NUM_OBJECTS, and the emitted per-otyp arrays stop
    at NUM_OBJECTS, so both sides read in bounds exactly below it."""
    world.pre.extend([otyp >= 0, otyp < front.enum_value('NUM_OBJECTS')])


def erosion_state(world, front, modules):
    object_predicate_state('obj')(world, front, modules)
    object_table_index_precondition(world, front, world.c_state['obj.otyp'][0])


def damageable_state(world, front, modules):
    object_predicate_state('otmp')(world, front, modules)
    object_table_index_precondition(world, front, world.c_state['otmp.otyp'][0])
    world.pre.append(real_object_precondition(
        world, front, world.c_state['otmp.otyp'][0]))


def guarded_erosion_state(world, front, modules):
    damageable_state(world, front, modules)
    symbols = {name: value for name, (value, _) in world.c_state.items()}
    # mkobj keeps oclass equal to objects[otyp].oc_class (the same entry
    # invariant the weight:stack claim assumes); a candle typed as chain
    # mail, where C's is_flammable exclusion and the port's material test
    # disagree, is not a reachable object.
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
    Spec('is_damageable:tables', 'verification_damageable', 'objectIsDamageable', [],
         js_file='js/objnam.js', state=[('otmp.oclass', (8, True), 'otmp.oclass'),
                                        ('otmp.otyp', (16, True), 'otmp.otyp')],
         assumptions=OBJECT_PREDICATE_ASSUMPTIONS + (
             'objclass.h:is_damageable expands is_flammable (mkobj.c, with its candle and fire-resistance exclusions), is_rottable, is_rustprone, is_corrodeable and is_crackable; every real-material row agrees, so the zero-material generic rows are the only divergence and are dropped as unreachable-observable per the assumption above',
         ),
         require_counterexamples=True, configure=damageable_state,
         arguments=object_predicate_arguments('otmp'),
         pre=lambda s: [],
         probes=[('otyp correspondence omitted', UnrelatedState(
             lambda s: [], ('otmp.otyp',)))],
         mutants=[('js/objnam.js',
                   'return flammable || rottable || rustprone || corrodeable || crackable;',
                   'return flammable || rustprone || corrodeable || crackable;')]),
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
         mutants=[('js/objnam.js', 'return flammable || rustprone || crackable;',
                   'return flammable || crackable;')]),
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
         mutants=[('js/objnam.js', 'return rottable || corrodeable;',
                   'return corrodeable;')]),
    Spec('weapon_type:tables', 'weapon_type', 'weaponSkillType',
         [('weapon_present', INT)],
         js_file='js/skills.js', state=[('weapon.oclass', (8, True), 'weapon.oclass'),
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
         mutants=[('js/skills.js', 'if (![2, 6, 13].includes(weapon.oclass))',
                   'if (![2, 6].includes(weapon.oclass))'),
                  ('js/skills.js', 'return Math.abs(skill);', 'return skill;')]),
]
