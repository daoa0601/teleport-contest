"""Claims over explicit hero, monster and read-only call correspondences."""
from specs import (ATTRIBUTES, ATTRIB, HIT_BONUS, HUMAN_FORM, INT, SCHAR,
                   Spec, ULEVEL, UnrelatedState, WEAPON_DAMAGE)
from state_world import (experience_arguments, experience_state, hero_state,
                         hit_bonus_state, movement_arguments, movement_state)

WORN = [(slot, (f'game.{slot}', f'game.u.{slot}')) for slot in ('uarmg', 'uarmh', 'uwep')]
ITEM_FIELDS = [('uarmg.otyp', (16, True), 'game.uarmg.otyp'),
               ('uarmh.otyp', (16, True), 'game.uarmh.otyp'),
               ('uwep.oartifact', SCHAR, 'game.uwep.oartifact')]
HERO = ATTRIBUTES + HUMAN_FORM + ITEM_FIELDS

STATE_C_FILES = ('artifact.c', 'monst.c', 'makemon.c', 'mon.c', 'worn.c')
STATE_JS_FILES = (
    'js/monster_data.js', 'js/monster_attack_types.js', 'js/artifacts.js',
    'js/artifact_data.js', 'js/monster_hit_points.js', 'js/hero_species.js',
    'js/monster_vitals.js', 'js/dungeon.js', 'js/monster_speed.js',
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
    'monster_speed.js:initializeMonsterMovement: finite movement/mmove/mspeed are already initialized',
    'monster_speed.js:naturalMonsterSpeed: cached mmove equals emitted MONSTER_MOVE[species]',
    'you.h:usteed: missing/same/other mount identities correspond; other mount fields are unread',
)

STATE_SPECS = [
    Spec('acurr:all', 'acurr', 'currentAttribute', [('chridx', INT)],
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
                  ('js/monster_hit_points.js', 'monsterDeathCount(mnum);', 'monsterDeathCount(mnum + 1);')]),
]


def species_partitions(front):
    # The domain has precisely NUMMONS valid indices. Each gets a proof with
    # symbolic monster state, rather than one enumerated example state.
    return [(f'species {i}', {'species': i}) for i in range(front.enum_value('NUMMONS'))]


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
         require_counterexamples=True, js_file='js/monster_speed.js',
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
         mutants=[('js/monster_speed.js', 'random(NORMAL_SPEED) < adjustment',
                   'random(NORMAL_SPEED) <= adjustment')]),
]
