"""fv-equivalence-batch-15: further cited single-owner species-trait ports.

mondata.h macros over one mons[] row (is_mind_flayer, telepathic, likes_lava,
is_wooden, hates_light, weirdnonliving, corpse_eater, slimeproof, is_bat,
is_reviver), mondata.c:olfaction() over the hero's current form, the
quest-retargeted flag macros (always_hostile, always_peaceful, extra_nasty,
is_covetous) over mons[] after role_init's rewriting, the gu.urace mask
macros (your_race, race_hostile, race_peaceful), the branch-dependent
grounded() macro over the modeled u.uz/dungeon_topology state, and
trap.c:into_vs_onto() over the trap type code.
"""
import z3

from core import Machine, Unsupported
from csym import CArray, CElement, CExec, CPtr, CRecord, CState, CVal
from jssym import V
from specs import INT, Spec
from state_specs import PREDICATE_ASSUMPTIONS, species_predicate_arguments, \
    species_predicate_state, species_record_arguments
from state_world import native_monsters

MONDATA = 'js/mondata.js'
MON = 'js/mon.js'
TRAP = 'js/trap.js'
ROLE_MONSTERS = 'js/role_monsters.js'
POLYSELF = 'js/polyself.js'

TRAIT_JS_FILES = (MON, TRAP, ROLE_MONSTERS, POLYSELF)
TRAIT_C_FILES = ('trap.c',)



SHORT = (16, True)   # you.h: struct Race masks and dungeon.h d_level members

# Pinned monst.h species indices (checked against the pinned header; each
# claim also proves the index correspondence over the whole table, so a
# renumbered row fails its pin rather than the proof).
PM_FLOATING_EYE = 28
PM_GREMLIN = 40
PM_MIND_FLAYER = 48
PM_FIRE_ELEMENTAL = 155
PM_WOOD_GOLEM = 254
PM_GHOUL = 246
PM_GREEN_SLIME = 208
PM_BAT = 126
PM_TROLL = 220
PM_HUMAN = 260
PM_ARCHEOLOGIST = 331   # first of the thirteen role species (role.c:roles[].mnum)
PM_MASTER_MIND_FLAYER = 49
PM_FOG_CLOUD = 106
PM_VAMPIRE_BAT = 129
PM_FIRE_VORTEX = 111
PM_ROCK_PIERCER = 78


def species_tables_spec(name, harness, port, record, mutants, pin,
                        js_file=MONDATA, configure=species_predicate_state):
    """One mons[] predicate in the batch-14 shape: a native species pointer
    against the port's species index over every valid species, with a
    mutation pinned to one species where the predicate is decided."""
    return Spec(
        f'{name}:tables', harness, port,
        [('species', INT), ('native_pointer_present', INT)],
        js_file=js_file, assumptions=PREDICATE_ASSUMPTIONS,
        require_counterexamples=True, configure=configure,
        arguments=species_record_arguments if record else species_predicate_arguments,
        pre=lambda s: [s['species'] >= 0, s['native_pointer_present'] == 1],
        probes=[('null native species pointer', lambda s: [
            s['species'] >= 0, s['native_pointer_present'] == 0])],
        mutant_pre=lambda s, pin=pin: [s['species'] == pin],
        mutants=[mutant if mutant[0].endswith('.js') else (js_file, *mutant)
                 for mutant in mutants],
    )


TRAIT_SPECS = [
    species_tables_spec(
        'is_mind_flayer', 'verification_is_mind_flayer', 'monsterIsMindFlayer',
        False, [('return mnum === PM_MIND_FLAYER || mnum === PM_MASTER_MIND_FLAYER;',
                 'return mnum === PM_MIND_FLAYER || mnum === PM_MASTER_MIND_FLAYER + 1;')],
        PM_MASTER_MIND_FLAYER),
    species_tables_spec(
        'telepathic', 'verification_telepathic', 'monsterIsTelepathic',
        False, [('return mnum === PM_FLOATING_EYE || monsterIsMindFlayer(mnum);',
                 'return mnum === PM_FLOATING_EYE + 1 || monsterIsMindFlayer(mnum);')],
        PM_FLOATING_EYE),
    species_tables_spec(
        'likes_lava', 'verification_likes_lava', 'likes_lava',
        False, [('return mnum === PM_FIRE_ELEMENTAL || mnum === PM_SALAMANDER;',
                 'return mnum === PM_FIRE_ELEMENTAL + 1 || mnum === PM_SALAMANDER;')],
        PM_FIRE_ELEMENTAL),
    species_tables_spec(
        'is_wooden', 'verification_is_wooden', 'monsterIsWooden',
        True, [('return monster?.mnum === PM_WOOD_GOLEM;',
                'return monster?.mnum === PM_WOOD_GOLEM + 1;')],
        PM_WOOD_GOLEM),
    species_tables_spec(
        'hates_light', 'verification_hates_light', 'monsterHatesLight',
        True, [('return monster?.mnum === PM_GREMLIN;',
                'return monster?.mnum === PM_GREMLIN + 1;')],
        PM_GREMLIN),
    species_tables_spec(
        'weirdnonliving', 'verification_weirdnonliving', 'monsterIsWeirdNonliving',
        False, [('return MONSTER_SYMBOL[mnum] === S_VORTEX || monsterIsGolem(mnum);',
                 'return MONSTER_SYMBOL[mnum] === S_VORTEX + 1 || monsterIsGolem(mnum);')],
        PM_FOG_CLOUD),
    species_tables_spec(
        'corpse_eater', 'verification_corpse_eater', 'speciesEatsCorpses',
        False, [('return CORPSE_EATERS.has(species);',
                 'return CORPSE_EATERS.has(species + 1);'),
                # The emitted initializer itself: dropping a corpse-eating
                # species from the set must fail the claim.
                ('new Set([\'purple worm\', \'baby purple worm\', \'ghoul\',',
                 'new Set([\'purple worm\', \'baby purple worm\',')],
        PM_GHOUL),
    species_tables_spec(
        'slimeproof', 'verification_slimeproof', 'monsterIsSlimeproof',
        True, [('FLAMING_SPECIES.has(monster.mnum))',
                'FLAMING_SPECIES.has(monster.mnum + 1))'),
               # The emitted initializer itself: dropping a flaming species
               # from the set must fail the claim.
               ('js/monster_data.js',
                'new Set([\'fire vortex\', \'flaming sphere\',',
                'new Set([\'flaming sphere\',')],
        PM_FIRE_VORTEX),
    species_tables_spec(
        'is_bat', 'verification_is_bat', 'monsterIsBat',
        False, [("return ['bat', 'giant bat', 'vampire bat'].includes(",
                 "return ['bat', 'giant bat'].includes(")],
        PM_VAMPIRE_BAT),
    species_tables_spec(
        'is_reviver', 'verification_is_reviver', 'isReviver',
        False, [('MONSTER_SYMBOL[mnum] === 46; // S_TROLL',
                 'MONSTER_SYMBOL[mnum] === 47; // S_TROLL')],
        PM_TROLL, js_file=MON),
]


# ---- mondata.c:olfaction() over the hero's current form ----

# polyself.c:38-43 (set_uasmon) keeps gy.youmonst.data at &mons[u.umonnum]
# for the polymorphed and the original form alike; u_init.c:991 starts the
# game with u.umonnum = u.umonster = gu.urole.mnum, one of the thirteen role
# species, and every hero-side olfaction() caller (do.c:2011, mon.c:5803,
# wizcmds.c:895) passes gy.youmonst.data. mondata.c:raceptr() is the helper
# that would return the race row for a non-polymorphed hero, and no
# olfaction() caller uses it.
OLFACTION_ASSUMPTIONS = PREDICATE_ASSUMPTIONS + (
    'polyself.c:set_uasmon keeps gy.youmonst.data at &mons[u.umonnum] on every form change, and the hero-side olfaction() callers (do.c:2011, mon.c:5803, wizcmds.c:895) pass gy.youmonst.data, so the native argument here is &mons[u.umonnum]',
    'u_init.c:991 sets u.umonnum = u.umonster = gu.urole.mnum at game start, so a non-polymorphed hero carries one of the thirteen role species (role.c:roles[].mnum: the archeologist..wizard player monsters) and u.umonster stays inside that set; you.h:Upolyd compares the two species numbers, and polyself.js:heroMonsterForm(state) returns null exactly when they are equal',
    'mondata.js:heroHasOlfaction returns true for the non-polymorphed hero without reading the table, so the claim proves olfaction() true over every role species row (none carries an olfaction-free class letter)',
)

OLFACTION_STATE = [('u.umonnum', INT, 'game.u.umonnum'),
                   ('u.umonster', INT, 'game.u.umonster')]

# role.c:roles[].mnum — the thirteen playable role species.
ROLE_SPECIES = (331, 332, 333, 334, 335, 336, 337, 338, 339, 340, 341, 342, 343)


def olfaction_state(world, front, modules):
    species_predicate_state(world, front, modules)
    symbols = {name: value for name, (value, _) in world.c_state.items()}
    for key in ('u.umonnum', 'u.umonster'):
        world.pre.append(symbols[key] >= 0)
        world.pre.append(symbols[key] < front.enum_value('NUMMONS'))
    world.pre.append(z3.Or(*[symbols['u.umonster'] == index
                             for index in ROLE_SPECIES]))


def olfaction_arguments(world, front):
    values = {name: value for name, value, _ in world.params}
    symbols = {name: value for name, (value, _) in world.c_state.items()}
    pointer = CPtr(values['native_pointer_present'] != 0,
                   CElement('mons', symbols['u.umonnum']))
    return ([pointer], [V('obj', 'game')])


TRAIT_SPECS += [
    Spec('olfaction:state', 'verification_olfaction', 'heroHasOlfaction',
         [('species', INT), ('native_pointer_present', INT)],
         js_file=MONDATA, state=OLFACTION_STATE,
         assumptions=OLFACTION_ASSUMPTIONS,
         require_counterexamples=True, configure=olfaction_state,
         arguments=olfaction_arguments,
         pre=lambda s: [s['species'] >= 0, s['native_pointer_present'] == 1],
         probes=[('null native species pointer', lambda s: [
             s['species'] >= 0, s['native_pointer_present'] == 0])],
         mutant_pre=lambda s: [s['u.umonnum'] == PM_WOOD_GOLEM,
                               s['u.umonster'] == PM_ARCHEOLOGIST],
         mutants=[(MONDATA, '!OLFACTIONLESS_SYMBOLS.has(symbol);',
                   '!OLFACTIONLESS_SYMBOLS.has(symbol + 1);')]),
]


# ---- mondata.h:always_hostile()/always_peaceful()/extra_nasty()/is_covetous()
# ---- over mons[] after role_init's quest retargeting ----

# monflag.h bit values shared by the rewrites and the port.
M2_PEACEFUL = 0x00200000
M3_CLOSE = 0x0080

QUEST_ROLE_ASSUMPTIONS = PREDICATE_ASSUMPTIONS + (
    'role.c:role_init rewrites the live mons[] quest rows before play: the leader (ldrnum) gets mflags2 |= M2_PEACEFUL and mflags3 |= M3_CLOSE, the guardians (guardnum) mflags2 |= M2_PEACEFUL, and the nemesis (neminum) mflags2 = (mflags2 & ~M2_PEACEFUL) | M2_NASTY | M2_STALK | M2_HOSTILE and mflags3 = (mflags3 & ~M3_CLOSE) | M3_WANTSARTI | M3_WAITFORU, in that order, so the nemesis rewrite wins an index collision; every other row keeps its mons_init flags',
    'role_monsters.js:questMonsterFlags2/3 compute exactly those rewrites over the untargeted emitted tables using game.urole, so the native side here receives the rewritten mflags2/mflags3 columns built from the same mons_init values',
    'gu.urole is always assigned at play time, so the port record is never null; every quest index is a species index or NON_PM (-1)',
)

QUEST_ROLE_STATE = [('gu.urole.neminum', INT, 'game.urole.neminum'),
                    ('gu.urole.ldrnum', INT, 'game.urole.ldrnum'),
                    ('gu.urole.guardnum', INT, 'game.urole.guardnum')]


def _native_column(world, front, member):
    """One scalar mons[] column from the pinned monst.c initializer, folded
    to concrete values: every flags word is a constant expression."""
    table = native_monsters(world, front)
    executor = CExec(Machine(world, 'c'), front)
    path = executor.m.start_path()
    values = []
    for element in table.values:
        if not isinstance(element, CRecord):
            raise Unsupported('mons initializer row is not a record')
        value = executor._record_member(path, element, member)
        if not isinstance(value, CVal):
            raise Unsupported(f'mons column {member} is not scalar')
        number = z3.simplify(value.v)
        if not z3.is_int_value(number):
            raise Unsupported(f'mons column {member} is not constant')
        values.append((number.as_long(), value.t))
    return values


def quest_role_state(world, front, modules):
    """The mflags2/mflags3 columns after role_init's quest retargeting.

    Only the quest rows differ from mons_init. The native table is flattened
    per row so each retargeted cell carries its rewritten value; role_init
    applies the leader and guardian rewrites before the nemesis rewrite, so
    the nemesis value wins an index collision, exactly as the port's
    if-chain checks neminum first. The guardians do not touch mflags3."""
    species = next(value for name, value, _ in world.params if name == 'species')
    world.pre.append(species < front.enum_value('NUMMONS'))
    symbols = {name: value for name, (value, _) in world.c_state.items()}
    nemesis, leader, guard = (symbols['gu.urole.neminum'],
                              symbols['gu.urole.ldrnum'],
                              symbols['gu.urole.guardnum'])
    rows = [CState(f'mons[{i}]') for i in range(front.enum_value('NUMMONS'))]
    world.c_globals['mons'] = CArray(tuple(rows))
    for i, (base, declared) in enumerate(_native_column(world, front, 'mflags2')):
        world.c_globals[f'mons[{i}].mflags2'] = CVal(
            z3.If(nemesis == i,
                  z3.IntVal((base & ~M2_PEACEFUL) | 0x02000000 | 0x01000000 | 0x00100000),
                  z3.If(z3.Or(leader == i, guard == i),
                        z3.IntVal(base | M2_PEACEFUL), z3.IntVal(base))),
            declared)
    for i, (base, declared) in enumerate(_native_column(world, front, 'mflags3')):
        world.c_globals[f'mons[{i}].mflags3'] = CVal(
            z3.If(nemesis == i,
                  z3.IntVal((base & ~M3_CLOSE) | 0x0010 | 0x0040),
                  z3.If(leader == i, z3.IntVal(base | M3_CLOSE), z3.IntVal(base))),
            declared)


def quest_role_arguments(world, front):
    values = {name: value for name, value, _ in world.params}
    pointer = CPtr(values['native_pointer_present'] != 0,
                   CElement('mons', values['species']))
    return ([pointer], [V('num', values['species']), V('obj', 'game')])


def quest_covetous_arguments(world, front):
    c_args, _ = quest_role_arguments(world, front)
    species = next(value for name, value, _ in world.params if name == 'species')
    return (c_args, [V('record', {'mnum': V('num', species)}), V('obj', 'game')])


def quest_role_domain(s):
    return [s['species'] >= 0, s['native_pointer_present'] == 1,
            s['gu.urole.neminum'] >= -1, s['gu.urole.ldrnum'] >= -1,
            s['gu.urole.guardnum'] >= -1]


def quest_spec(name, harness, port, role, mutant, arguments):
    return Spec(
        name, harness, port,
        [('species', INT), ('native_pointer_present', INT)],
        js_file=MONDATA, state=QUEST_ROLE_STATE,
        assumptions=QUEST_ROLE_ASSUMPTIONS,
        require_counterexamples=True, configure=quest_role_state,
        arguments=arguments, pre=quest_role_domain,
        probes=[('null native species pointer', lambda s: [
            s['species'] >= 0, s['native_pointer_present'] == 0,
            s['gu.urole.neminum'] >= -1, s['gu.urole.ldrnum'] >= -1,
            s['gu.urole.guardnum'] >= -1])],
        # Gremlin: no M2_HOSTILE, M2_PEACEFUL, M2_NASTY or M3 covetous bits
        # in its base row, so every rewrite mutant flips its retargeted row.
        mutant_pre=lambda s, role=role: [
            s['species'] == PM_GREMLIN, s[f'gu.urole.{role}'] == PM_GREMLIN],
        mutants=[mutant])


TRAIT_SPECS += [
    quest_spec('always_hostile:tables', 'verification_always_hostile',
               'monsterIsAlwaysHostile', 'neminum',
               (ROLE_MONSTERS,
                'return (flags & ~M2_PEACEFUL) | M2_NASTY | M2_STALK | M2_HOSTILE;',
                'return (flags & ~M2_PEACEFUL) | M2_NASTY | M2_STALK;'),
               quest_role_arguments),
    quest_spec('always_peaceful:tables', 'verification_always_peaceful',
               'always_peaceful', 'ldrnum',
               (ROLE_MONSTERS, 'return flags | M2_PEACEFUL;', 'return flags;'),
               quest_role_arguments),
    quest_spec('extra_nasty:tables', 'verification_extra_nasty',
               'extra_nasty', 'neminum',
               (ROLE_MONSTERS,
                'return (flags & ~M2_PEACEFUL) | M2_NASTY | M2_STALK | M2_HOSTILE;',
                'return (flags & ~M2_PEACEFUL) | M2_STALK | M2_HOSTILE;'),
               quest_role_arguments),
    quest_spec('is_covetous:tables', 'verification_is_covetous',
               'monsterIsCovetous', 'neminum',
               (ROLE_MONSTERS,
                'return (flags & ~M3_CLOSE) | M3_WANTSARTI | M3_WAITFORU;',
                'return (flags & ~M3_CLOSE) | M3_WAITFORU;'),
               quest_covetous_arguments),
]


# ---- mondata.h:your_race()/race_hostile()/race_peaceful() over gu.urace ----

URACE_ASSUMPTIONS = PREDICATE_ASSUMPTIONS + (
    'role.c:role_init copies the selected races[] row into gu.urace before play; selfmask/hatemask/lovemask are short combinations of the M2_* race bits (all non-negative and below 2**15), and the port keeps the same masks in game.urace',
    'gu.urace is always assigned at play time, so the port record is never null and its ?? fallback stays dead',
)

URACE_STATE = [(f'gu.urace.{mask}', SHORT, f'game.urace.{mask}')
               for mask in ('selfmask', 'hatemask', 'lovemask')]


def urace_domain(s):
    return [s['species'] >= 0, s['native_pointer_present'] == 1] + \
           [z3.And(s[f'gu.urace.{mask}'] >= 0, s[f'gu.urace.{mask}'] <= 32767)
            for mask in ('selfmask', 'hatemask', 'lovemask')]


TRAIT_SPECS += [
    Spec(name, harness, port, [('species', INT), ('native_pointer_present', INT)],
         js_file=MONDATA, state=URACE_STATE, assumptions=URACE_ASSUMPTIONS,
         require_counterexamples=True, configure=species_predicate_state,
         arguments=species_predicate_arguments, pre=urace_domain,
         probes=[('null native species pointer', lambda s: [
             s['species'] >= 0, s['native_pointer_present'] == 0] + [
             z3.And(s[f'gu.urace.{mask}'] >= 0, s[f'gu.urace.{mask}'] <= 32767)
             for mask in ('selfmask', 'hatemask', 'lovemask')])],
         # PM_HUMAN's row carries M2_HUMAN (0x8), so swapping the masks on a
         # human hero with a human selfmask flips every one of the three.
         mutant_pre=lambda s, mask=mask: [s['species'] == PM_HUMAN,
                                          s[f'gu.urace.{mask}'] == 8],
         mutants=[(MONDATA, old, new)])
    for name, harness, port, mask, old, new in (
        ('your_race:tables', 'verification_your_race', 'your_race', 'selfmask',
         'return !!((MONSTER_FLAGS2[mnum] ?? 0) & (state.urace?.selfmask ?? 0));',
         'return !!((MONSTER_FLAGS2[mnum] ?? 0) & (state.urace?.hatemask ?? 0));'),
        ('race_hostile:tables', 'verification_race_hostile', 'race_hostile',
         'hatemask',
         'return !!((MONSTER_FLAGS2[mnum] ?? 0) & (state.urace?.hatemask ?? 0));',
         'return !!((MONSTER_FLAGS2[mnum] ?? 0) & (state.urace?.selfmask ?? 0));'),
        ('race_peaceful:tables', 'verification_race_peaceful', 'race_peaceful',
         'lovemask',
         'return !!((MONSTER_FLAGS2[mnum] ?? 0) & (state.urace?.lovemask ?? 0));',
         'return !!((MONSTER_FLAGS2[mnum] ?? 0) & (state.urace?.hatemask ?? 0));'),
    )
]


# ---- mondata.h:grounded() over the modeled u.uz/dungeon_topology state ----

GROUNDED_ASSUMPTIONS = PREDICATE_ASSUMPTIONS + (
    'hack.h:dungeon_topology: astral_level (d_astral_level) is assigned by init_dungeons before any grounded() call, so the port record is never null and carries its dnum',
    'earth_level (d_earth_level) may stay unassigned (dnum == dlevel == 0), which dungeon.h:Lassigned reports as false and the port models as a null record; dungeon.c:has_ceiling reads In_endgame and Is_earthlevel for real over the modeled state, and dungeon.js:levelHasCeiling reads game.u.uz, game.astral_level and game.earth_level',
)

GROUNDED_STATE = [('u.uz.dnum', SHORT, 'game.u.uz.dnum'),
                  ('u.uz.dlevel', SHORT, 'game.u.uz.dlevel'),
                  ('svd.dungeon_topology.d_astral_level.dnum', SHORT, None),
                  ('svd.dungeon_topology.d_earth_level.dnum', SHORT, None),
                  ('svd.dungeon_topology.d_earth_level.dlevel', SHORT, None)]


def grounded_state(world, front, modules):
    species_predicate_state(world, front, modules)
    symbols = {name: value for name, (value, _) in world.c_state.items()}
    astral = symbols['svd.dungeon_topology.d_astral_level.dnum']
    earth_dnum = symbols['svd.dungeon_topology.d_earth_level.dnum']
    earth_dlevel = symbols['svd.dungeon_topology.d_earth_level.dlevel']
    world.js_values['game.astral_level'] = V(
        'record', {'dnum': V('num', astral)})
    assigned = z3.Or(earth_dnum != 0, earth_dlevel != 0)
    world.js_values['game.earth_level'] = V('choice', [
        (assigned, V('record', {'dnum': V('num', earth_dnum),
                                'dlevel': V('num', earth_dlevel)})),
        (z3.Not(assigned), V('null'))])


TRAIT_SPECS += [
    Spec('grounded:state', 'verification_grounded', 'grounded',
         [('species', INT), ('native_pointer_present', INT)],
         js_file=MONDATA, state=GROUNDED_STATE,
         assumptions=GROUNDED_ASSUMPTIONS,
         require_counterexamples=True, configure=grounded_state,
         arguments=quest_role_arguments,
         pre=lambda s: [s['species'] >= 0, s['native_pointer_present'] == 1],
         probes=[('null native species pointer', lambda s: [
             s['species'] >= 0, s['native_pointer_present'] == 0])],
         mutant_pre=lambda s: [s['species'] == PM_ROCK_PIERCER],
         mutants=[(MONDATA, '&& (!monsterIsClinger(mnum) || !levelHasCeiling(state));',
                   '&& (!monsterIsClinger(mnum) || levelHasCeiling(state));')]),
]


# ---- trap.c:into_vs_onto() over the trap type code ----

INTO_VS_ONTO_ASSUMPTIONS = (
    'trap.h:trap_types codes are pinned constants; the port compares the same eight codes BEAR_TRAP, PIT, SPIKED_PIT, HOLE, TELEP_TRAP, LEVEL_TELEP, MAGIC_PORTAL and WEB from const.js',
)

TRAIT_SPECS += [
    Spec('into_vs_onto:tables', 'verification_into_vs_onto', 'into_vs_onto',
         [('ttyp', INT)], js_file=TRAP, assumptions=INTO_VS_ONTO_ASSUMPTIONS,
         require_counterexamples=True,
         pre=lambda s: [s['ttyp'] >= -2 ** 31, s['ttyp'] <= 2 ** 31 - 1],
         mutant_pre=lambda s: [s['ttyp'] == 18],   # trap.h WEB
         mutants=[(TRAP,
                   'return [BEAR_TRAP, PIT, SPIKED_PIT, HOLE, TELEP_TRAP, LEVEL_TELEP,'
                   ' MAGIC_PORTAL, WEB].includes(type);',
                   'return [BEAR_TRAP, PIT, SPIKED_PIT, HOLE, TELEP_TRAP, LEVEL_TELEP,'
                   ' MAGIC_PORTAL].includes(type);')]),
]
