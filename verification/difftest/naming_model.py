"""Naming domains and inputs: objnam.c and do_name.c string formatting.

Covers makeplural()/makesingular()/an()/the() as pure string functions,
xname()/doname() over serialized objects, and x_monnam() over serialized
monsters. Inputs are state descriptions; no game algorithm lives here.
"""
from __future__ import annotations

import random

from model import TARGETS, integer, record

NAMING_TARGETS = ['makeplural', 'makesingular', 'articles', 'xname', 'doname', 'x_monnam']
NAMING_LOCATIONS = [
    ('objnam.c:makeplural', 'object_grammar.js:makePlural'),
    ('objnam.c:makesingular', 'object_grammar.js:makeSingular'),
    ('objnam.c:an()/the()', 'objnam.js:withIndefiniteArticle/definiteName'),
    ('objnam.c:xname_flags', 'objnam.js:objectName via objectCombatName'),
    ('objnam.c:doname_base', 'object_description.js:objectDescription'),
    ('do_name.c:x_monnam', 'monster_name.js:monsterName'),
]
NAMING_BASE = len(TARGETS) + 6  # first naming target index (12)

HERO = dict(role=0, blind=0, implicitUncursed=1, partlyEatenHack=0,
            detect=1, seeInvis=0)
NAMING_OBJECT = dict(otyp=None, quan=1, corpsenm=-1, spe=0, blessed=0,
                     cursed=0, globby=0, oeroded=0, oeroded2=0, oeaten=0,
                     owt=0, known=0, dknown=0, bknown=0, rknown=0, lknown=0,
                     cknown=0, tknown=0, oerodeproof=0, greased=0, otrapped=0,
                     obroken=0, olocked=0, odiluted=0, opoisoned=0, lamplit=0,
                     oname='', wornMask=0, contents=[])
MONSTER = dict(mnum=0, female=0, minvis=0, mtame=0, mpeaceful=0, m_lev=5,
               saddle=0, mgivenname='', isshk=0, shkName='Asidonhopo',
               ispriest=0, priestAlign=0)

# objnam.c as_is[] (both spellings left plural), one_off[] and
# special_subjs[] words, plus objnam.c Japanese_items[] names. These are C
# input tables, quoted for coverage; expected outputs come from the C side.
AS_IS_WORDS = [
    'boots', 'shoes', 'gloves', 'lenses', 'scales', 'eyes', 'gauntlets',
    'iron bars', 'bison', 'deer', 'elk', 'fish', 'fowl', 'tuna', 'yaki',
    '-hai', 'krill', 'manes', 'moose', 'ninja', 'sheep', 'ronin', 'roshi',
    'shito', 'tengu', 'ki-rin', 'Nazgul', 'gunyoki', 'piranha', 'samurai',
    'shuriken', 'haggis', 'Bordeaux',
]
ONE_OFF_SINGULARS = [
    'child', 'cubus', 'culus', 'Cyclops', 'djinni', 'erinys', 'foot',
    'fungus', 'goose', 'knife', 'labrum', 'louse', 'mouse', 'mumak',
    'nemesis', 'ovum', 'ox', 'passerby', 'rtex', 'serum', 'staff', 'tooth',
]
ONE_OFF_PLURALS = [
    'children', 'cubi', 'culi', 'Cyclopes', 'djinn', 'erinyes', 'feet',
    'fungi', 'geese', 'knives', 'labra', 'lice', 'mice', 'mumakil',
    'nemeses', 'ova', 'oxen', 'passersby', 'rtices', 'sera', 'staves',
    'teeth',
]
SPECIAL_SUBJECTS = [
    'erinys', 'manes', 'Cyclops', 'Hippocrates', 'Pelias', 'aklys',
    'amnesia', 'detect monsters', 'paralysis', 'shape changers', 'nemesis',
]
JAPANESE_NAMES = [
    'wakizashi', 'ninja-to', 'nunchaku', 'naginata', 'osaku', 'koto',
    'magic koto', 'shito', 'tanko', 'kabuto', 'yugake', 'gunyoki', 'sake',
]
SUFFIX_STEMS = [
    'alga', 'hypha', 'larva', 'amoeba', 'vertebra', 'matzoh', 'matzah',
    'matzo', 'matza', 'lotus', 'wumpus', 'tengu', 'hezrou', 'index',
    'codex', 'spadix', 'neocortex', 'tomato', 'potato', 'dingo', 'bureau',
    'slice', 'mongoose', 'muskox', 'fox', 'aircraft', 'hovercraft', 'shaman',
    'human', 'caveman', 'baluchitherium', 'mycelium', 'wolf', 'clove',
    'nerve', 'zombie', 'valkyrie', 'harpie', 'genie', 'progeny', 'cookie',
    'pie', 'lens', 'lynx', 'box', 'splash of venom', 'priestess', 'tomato',
    'dingo', 'Aleax', 'nurse', 'axe', 'use', 'bus', 'vortex', 'monarch',
    'stomach', 'psych', 'loch', 'oligarch', 'y', 'day', 'key', 'qui',
    'wolf', 'elf', 'serf', 'nerf', 'chef', 'a', 'I', 'she', 'He', 'him',
    'His', 'it', 'they', 'Them', 'their', 'sword', 'sword of striking',
    'pair of boots', 'pair of boots of speed', 'lump of royal jelly',
    'worthless piece of blue glass', 'magenta', 'eaux', 'gateau', 'ae',
    'vertebrae', 'mice', 'feet', 'teeth', 'oxen', 'VAX', 'sheep',
]


def plain_text(value, name, limit=120):
    if not isinstance(value, str) or not 1 <= len(value) <= limit:
        raise ValueError(f'{name} must be a 1..{limit} character string')
    for char in value:
        if not 0x20 <= ord(char) <= 0x7E or char in '"\\':
            raise ValueError(f'{name} must be printable ASCII without quote or backslash')
    return value


def naming_text(value, name, limit=120):
    # C makeplural()/makesingular()/an() call impossible() (window output the
    # harness cannot service) for null or empty input, so the domain requires
    # at least one non-space character.
    result = plain_text(value, name, limit)
    if not result.strip():
        raise ValueError(f'{name} must contain a non-space character')
    return result


def naming_target(raw, meta):
    target = raw.get('target')
    if isinstance(target, str):
        if target not in NAMING_TARGETS:
            raise ValueError(f'Unknown naming target {target!r}')
        target = NAMING_BASE + NAMING_TARGETS.index(target)
    integer(target, NAMING_BASE, NAMING_BASE + len(NAMING_TARGETS) - 1, 'target')
    return target


def naming_object_state(value, meta, depth=0, count=None):
    types = meta['objects']
    result = {**NAMING_OBJECT, **record(value, {*NAMING_OBJECT, 'otyp'}, 'naming object')}
    otyp = result.get('otyp')
    if isinstance(otyp, str):
        otyp = types.get(otyp, -1)
    result['otyp'] = integer(otyp, 1, len(meta['names']) - 1, 'otyp')
    if not meta['names'][result['otyp']]:
        raise ValueError('Naming needs an object type with a real name (FIRST_OBJECT domain)')
    if result['otyp'] < types['ARROW']:
        raise ValueError('Generic class rows precede FIRST_OBJECT; mkobj never creates them')
    if otyp == types.get('SPE_NOVEL', -1):
        raise ValueError('Novels are named by construction, not by the naming layer (excluded)')
    otyp = result['otyp']
    containers = {types[name] for name in ['LARGE_BOX', 'CHEST', 'ICE_BOX', 'SACK',
                                           'OILSKIN_SACK', 'BAG_OF_HOLDING', 'STATUE']}
    globs = {types[name] for name in ['GLOB_OF_GRAY_OOZE', 'GLOB_OF_BROWN_PUDDING',
                                      'GLOB_OF_GREEN_SLIME', 'GLOB_OF_BLACK_PUDDING']}
    if result['oname'] != '':
        plain_text(result['oname'], 'oname', 40)
    for key, low, high in [('quan', 1, 1000), ('owt', 0, 10000),
                           ('corpsenm', -1, len(meta['monsters']) - 1),
                           ('oeaten', 0, 1000000),
                           ('oeroded', 0, 3), ('oeroded2', 0, 3)]:
        integer(result[key], low, high, key)
    species_bound = otyp in {types['CORPSE'], types['STATUE'], types['FIGURINE']}
    if species_bound and result['corpsenm'] < 0:
        raise ValueError('corpse/statue/figurine needs a species (mkcorpstat callers)')
    if otyp == types.get('LEASH') and result['corpsenm'] != 0:
        # obj.h: leashmon aliases corpsenm; a stale leash id makes doname()
        # call impossible() for a monster the harness never created.
        raise ValueError('leashmon must be 0; the harness has no leashed monster')
    low, high = (0, 7) if species_bound or otyp == types['CANDELABRUM_OF_INVOCATION'] else (-20, 20)
    integer(result['spe'], low, high, 'spe')
    for key in ['blessed', 'cursed', 'globby', 'known', 'dknown', 'bknown',
                'rknown', 'lknown', 'cknown', 'tknown', 'oerodeproof',
                'greased', 'otrapped', 'obroken', 'olocked', 'odiluted',
                'opoisoned', 'lamplit']:
        integer(result[key], 0, 1, key)
    if result['blessed'] and result['cursed']:
        raise ValueError('An object cannot be both blessed and cursed')
    oclass = meta['classes'][otyp]
    if result['odiluted'] and result['oeroded']:
        raise ValueError('odiluted aliases oeroded in obj.h; they cannot both be set')
    if oclass == 8 and (result['oeroded'] or result['odiluted'] not in (0, 1)):
        raise ValueError('Potions use the shared field only as odiluted 0/1 (potion dilution)')
    if oclass != 8 and result['odiluted']:
        raise ValueError('odiluted applies to potions only in this domain')
    if result['opoisoned'] and result['otrapped']:
        raise ValueError('opoisoned aliases otrapped in obj.h; they cannot both be set')
    if result['globby'] != int(otyp in globs) or otyp in globs and result['quan'] != 1:
        raise ValueError('Glob type, globby flag and singleton quantity must agree')
    if not meta['merge'][otyp] and result['quan'] != 1:
        raise ValueError('This object type does not stack (objects.h:oc_merge)')
    if otyp in containers and result['quan'] != 1:
        raise ValueError('Containers and statues do not stack (objects.h:oc_merge)')
    if not isinstance(result['contents'], list):
        raise ValueError('contents must be an array')
    if result['contents'] and otyp not in containers:
        raise ValueError('Only containers/statues may have contents (obj.h:Is_container)')
    count[0] += 1 + len(result['contents'])
    if depth > 2 or count[0] > 8:
        raise ValueError('At most 8 naming objects over two containment edges')
    if result['oeaten']:
        nutrition = (meta['bodies'][result['corpsenm']][1] if otyp == types['CORPSE']
                     else result['owt'] if result['globby'] else meta['nutrition'][otyp])
        if meta['classes'][otyp] != 7 or result['oeaten'] > nutrition:
            raise ValueError('Partly eaten food needs 0 < oeaten <= nutrition (eat.c:obj_nutrition)')
    # Worn masks without the matching equipment slot owners keep donning() and
    # doffing() false in C (ga.afternmv is null, takeoff mask empty).
    integer(result['wornMask'], 0, 0x400000, 'wornMask')
    if result['wornMask'] not in naming_worn_masks(otyp, meta):
        raise ValueError('wornMask must match a supported slot for this object type')
    if depth and result['wornMask']:
        raise ValueError('Contained objects cannot be equipped')
    result['contents'] = [naming_object_state(child, meta, depth + 1, count)
                          for child in result['contents']]
    return result


def naming_worn_masks(otyp, meta):
    """Supported hero slots from do_wear.c, wield.c and read.c:punish."""
    slots, types = meta['wornSlots'], meta['objects']
    oclass = meta['classes'][otyp]
    masks = [0, slots['W_QUIVER']]
    # wield_ok excludes coins but downplays other non-weapons; ready_ok
    # permits gold and other non-ammunition in the quiver.
    if oclass != 12:
        masks.extend([slots['W_WEP'], slots['W_SWAPWEP']])
    if meta['armorSlots'][otyp] == 'uarm':
        masks.append(slots['W_ARM'])
    if oclass == 4 or otyp == types['MEAT_RING']:
        masks.extend([slots['W_RINGL'], slots['W_RINGR']])
    if oclass == 5:
        masks.append(slots['W_AMUL'])
    if otyp in [types['BLINDFOLD'], types['LENSES'], types['TOWEL']]:
        masks.append(slots['W_TOOL'])
    if otyp == types['HEAVY_IRON_BALL']:
        masks.append(slots['W_BALL'])
    if otyp == types['IRON_CHAIN']:
        masks.append(slots['W_CHAIN'])
    return masks


def naming_case(raw, meta):
    target = naming_target(raw, meta)
    count = [0]
    result = dict(target=target)
    for key, default, low, high in [('seed', 1, 0, 2147483647), ('position', 0, 0, 4096)]:
        if key not in raw:
            result[key] = default
        else:
            result[key] = integer(raw[key], low, high, key)
    if target < NAMING_BASE + 3:
        record(raw, ['target', 'seed', 'position', 'text'], 'string case')
        result['text'] = naming_text(raw.get('text', 'newt'), 'text')
        return result
    if target < NAMING_BASE + 5:
        record(raw, ['target', 'seed', 'position', 'hero', 'object',
                     'discovery', 'fruits'], 'object naming case')
        hero_raw = record(raw.get('hero', {}), HERO, 'hero')
        hero = {**HERO, **hero_raw}
        for key in ['blind', 'implicitUncursed', 'partlyEatenHack', 'detect', 'seeInvis']:
            integer(hero[key], 0, 1, f'hero.{key}')
        integer(hero['role'], 0, 3, 'hero.role')
        result['hero'] = hero
        floor = meta['objects']['ARROW']
        initial = meta.get('initialKnown') or [0] * len(meta['names'])
        # A neutral default avoids types whose other fields carry invariants.
        unknown = next((index for index in range(floor, len(meta['names']))
                        if meta['names'][index] and not initial[index]
                        and meta['classes'][index] not in (7, 14)), floor)
        default_object = {'otyp': unknown}
        result['object'] = naming_object_state(raw.get('object', default_object), meta, 0, count)
        discovery_raw = raw.get('discovery', {})
        record(discovery_raw, ['nameKnown', 'callName'], 'discovery')
        discovery = {'nameKnown': integer(discovery_raw.get('nameKnown', 0), 0, 1, 'nameKnown')}
        if 'callName' in discovery_raw and discovery_raw['callName'] != '':
            discovery['callName'] = plain_text(discovery_raw['callName'], 'callName', 40)
        if 'initialKnown' in meta and not discovery['nameKnown'] \
                and meta['initialKnown'][result['object']['otyp']]:
            raise ValueError('Initially known types cannot be made unknown on the JS side')
        result['discovery'] = discovery
        fruits = raw.get('fruits', [])
        if not isinstance(fruits, list) or len(fruits) > 4:
            raise ValueError('fruits must hold at most four names')
        names = [plain_text(name, 'fruit', 30) for name in fruits]
        if len(set(names)) != len(names):
            raise ValueError('fruit names must be unique')
        result['fruits'] = names
        otyp = result['object']['otyp']
        if otyp == meta['objects']['SLIME_MOLD']:
            if not names or not 1 <= result['object']['spe'] <= len(names):
                raise ValueError('slime mold spe must index a registered fruit (mkobj SLIME_MOLD path)')
        return result
    record(raw, ['target', 'seed', 'position', 'hero', 'monster', 'article',
                 'adjective', 'suppress', 'called'], 'monster naming case')
    hero_raw = record(raw.get('hero', {}), HERO, 'hero')
    hero = {**HERO, **hero_raw}
    for key in ['blind', 'implicitUncursed', 'partlyEatenHack', 'detect', 'seeInvis']:
        integer(hero[key], 0, 1, f'hero.{key}')
    integer(hero['role'], 0, 3, 'hero.role')
    result['hero'] = hero
    monster_raw = record(raw.get('monster', {}), MONSTER, 'monster')
    monster = {**MONSTER, **monster_raw}
    if isinstance(monster['mnum'], str):
        monster['mnum'] = meta['monsters'].index(monster['mnum'])
    integer(monster['mnum'], 0, len(meta['monsters']) - 1, 'mnum')
    for key in ['female', 'minvis', 'mtame', 'mpeaceful', 'saddle', 'isshk', 'ispriest']:
        integer(monster[key], 0, 1, key)
    integer(monster['m_lev'], 0, 30, 'm_lev')
    if monster['priestAlign'] not in [-128, -1, 0, 1]:
        raise ValueError('priestAlign must be A_NONE, chaotic, neutral or lawful')
    if monster['mgivenname'] != '':
        plain_text(monster['mgivenname'], 'mgivenname', 30)
    plain_text(monster['shkName'], 'shkName', 30)
    if not hero['detect'] and (not monster['minvis'] or hero['seeInvis']):
        # canspotmon() relies on uncomputed vision in the C harness; without
        # detection, visible and see-invisible monsters compare harness artifacts.
        raise ValueError('Visually observable monsters need hero detection in this domain')
    result['monster'] = monster
    result['article'] = integer(raw.get('article', 1), 0, 3, 'article')
    result['adjective'] = plain_text(raw.get('adjective', ''), 'adjective', 40) \
        if raw.get('adjective', '') != '' else ''
    suppress = integer(raw.get('suppress', 0), 0, 127, 'suppress')
    allowed = 0x01 | 0x02 | 0x04 | 0x08 | 0x20 | 0x40
    if suppress & ~allowed and suppress != 0x1F:
        raise ValueError('SUPPRESS_MAPPEARANCE alone has no emitted-JS entry point')
    if suppress & 0x20 and suppress & 0x40:
        raise ValueError('SUPPRESS_NAME with AUGMENT_IT has no emitted-JS entry point')
    if suppress & 0x20 and (raw.get('adjective', '') != '' or raw.get('called', 0)):
        raise ValueError('No C caller combines SUPPRESS_NAME with an adjective or called=TRUE (noname_monnam)')
    result['suppress'] = suppress
    integer(raw.get('called', 0), 0, 1, 'called')
    result['called'] = int(raw.get('called', 0))
    return result


def naming_edges(meta):
    """Boundary inputs from the C special-case tables and owning functions."""

    initial = meta.get('initialKnown') or []

    def case(target, **changes):
        object_state = changes.get('object')
        # Cases that do not state discovery keep their type's initial
        # knowledge; an explicit discovery (including a deliberate
        # nameKnown=0) always wins.
        if isinstance(object_state, dict) and 'discovery' not in changes \
                and 'discovery' not in object_state:
            otyp = object_state.get('otyp')
            if isinstance(otyp, str):
                otyp = meta['objects'].get(otyp)
            if isinstance(otyp, int) and 0 <= otyp < len(initial) and initial[otyp]:
                changes['discovery'] = dict(nameKnown=1)
        try:
            return naming_case(dict(target=target, **changes), meta)
        except ValueError as error:
            documented = ('Initially known types cannot be made unknown',
                          'Novels are named by construction',
                          'must contain a non-space character',
                          'needs a species (mkcorpstat callers)',
                          'leashmon must be 0',
                          'slime mold spe must index a registered fruit',
                          'Glob type, globby flag')
            if any(message in str(error) for message in documented):
                return None  # combination is outside the documented domain
            raise

    cases = []
    pool = [*AS_IS_WORDS, *ONE_OFF_SINGULARS, *ONE_OFF_PLURALS,
            *SPECIAL_SUBJECTS, *JAPANESE_NAMES, *SUFFIX_STEMS]
    for word in pool:
        cases.append(case('makeplural', text=word))
        cases.append(case('makesingular', text=word))
    # Every object and monster name through both directions, plus compounds.
    for name in meta['names']:
        if name:
            cases.append(case('makeplural', text=name))
            cases.append(case('makesingular', text=name))
    for name in meta['monsters']:
        cases.append(case('makeplural', text=name))
        cases.append(case('makesingular', text=name))
        cases.append(case('makeplural', text=f'{name} corpse'))
    for word in ['boot', 'newt', 'high priest', 'worthless piece of glass']:
        for template in ['pair of {}', '{} of silver', '{} labeled XOROZOT',
                         '{} called glork', '{} named Fido']:
            cases.append(case('makeplural', text=template.format(word)))
            cases.append(case('makesingular', text=template.format(word)))
    for word in ['boot', 'newt', 'high priest', 'worthless piece of glass']:
        for template in ['pair of {}', '{} of silver', 'two {} of the Oracle',
                         '{} labeled XOROZOT', '{} called glork', '{} named Fido',
                         '{}-in-a-box', 'the {} above', '{} versus itself',
                         "d'{}", '{} a la king', '{} with text', '{} du Nord']:
            cases.append(case('makeplural', text=template.format(word)))
            cases.append(case('makesingular', text=template.format(word)))
    for text in ['', ' ', '  leading and trailing ', 'Newt', 'NEWT', 'x', 'X',
                 'an newt', 'the newt', 'The newt', 'one', 'one-eyed', 'one_up',
                 'eucalyptus leaf', 'ukulele', 'unicorn horn', 'uranium',
                 'useful tool', 'xan', 'x letter', 'ice', 'iron bars',
                 'molten lava', 'Platinum Yendorian Express Card',
                 "Wizard's corpse", 'bar of silver', 'Medusa', 'oracle']:
        if text:
            cases.append(case('articles', text=text))
        cases.append(case('makeplural', text=text) if text else None)
        cases.append(case('makesingular', text=text) if text else None)
    cases = [c for c in cases if c]
    # Include titles and personal names from the hallucination table without
    # enabling hallucination or drawing its RNG stream. CapitalMon() uses
    # this table even for an ordinary call to the().
    for name in meta['bogusMonsters']:
        cases.append(case('articles', text=name))
    for name in ['Klingon', 'Ancient Multi-Hued Dragon']:
        for suffix in [' corpse', "'s corpse", 'ish']:
            cases.append(case('articles', text=name + suffix))
    # Object naming: one representative per interesting rule.
    types = meta['objects']
    by_class = {}
    for index in range(types['ARROW'], len(meta['names'])):
        if meta['names'][index]:
            by_class.setdefault(meta['classes'][index], []).append(index)

    def obj(target, otyp, **changes):
        return case(target, object=dict(otyp=otyp, **changes))

    knowledge = [(0, 0), (1, 0), (0, 1), (1, 1)]  # (dknown, nameKnown)
    for dk, nk in knowledge:
        discovery = dict(nameKnown=nk)
        members = {cls: members for cls, members in by_class.items()}
        picks = [members[cls][index]
                 for cls, index in [(4, 0), (4, -1), (5, 0), (5, -1), (8, 0), (8, -1),
                                    (9, 0), (9, -1), (10, 0), (10, -1), (11, 0), (11, -1),
                                    (13, 0), (13, -1), (2, 0), (2, -1), (3, 0), (3, -1),
                                    (6, 0), (6, -1), (7, 0), (7, -1), (14, 0), (15, 0), (16, 0)]]
        for name in ['AMULET_OF_YENDOR', 'FAKE_AMULET_OF_YENDOR', 'AMULET_OF_LIFE_SAVING',
                     'SPE_NOVEL', 'SPE_BOOK_OF_THE_DEAD', 'DAGGER', 'ELVEN_MITHRIL_COAT',
                     'ELVEN_BOOTS', 'SHIELD_OF_REFLECTION', 'ELVEN_SHIELD',
                     'GRAY_DRAGON_SCALES', 'FLINT', 'RUBY', 'LOADSTONE', 'LUCKSTONE',
                     'TOWEL', 'LENSES', 'BULLWHIP', 'CANDELABRUM_OF_INVOCATION',
                     'OIL_LAMP', 'TALLOW_CANDLE', 'POT_OIL', 'POT_WATER',
                     'POT_FRUIT_JUICE', 'SCR_MAGIC_MAPPING', 'SCR_MAIL', 'HAWAIIAN_SHIRT',
                     'T_SHIRT', 'CANDY_BAR', 'SLIME_MOLD', 'HEAVY_IRON_BALL', 'BOULDER',
                     'IRON_CHAIN', 'STATUE', 'FIGURINE', 'TIN', 'EGG', 'CORPSE',
                     'LEASH', 'BAG_OF_TRICKS', 'HORN_OF_PLENTY', 'SACK',
                     'LARGE_BOX', 'CHEST', 'GOLD_PIECE', 'SCR_ENCHANT_WEAPON',
                     'GAIN_STRENGTH', 'WISHING', 'CONE_OF_COLD']:
            picks.append(types[name])
        for otyp in dict.fromkeys(picks):
            cases.append(case('xname', object=dict(otyp=otyp, dknown=dk,
                                                   bknown=1, known=1),
                              discovery=discovery))
            cases.append(case('doname', object=dict(otyp=otyp, dknown=dk,
                                                    bknown=1, known=1),
                              discovery=discovery))
    for name, changes in [
            ('DAGGER', dict(opoisoned=1, known=1, spe=2)),
            ('ELVEN_ARROW', dict(quan=5, dknown=1, known=1)),
            ('ELVEN_DAGGER', dict(oname='Sting', dknown=1)),
            ('MACE', dict(oeroded=1, oeroded2=3, rknown=1, dknown=1)),
            ('ELVEN_MITHRIL_COAT', dict(oeroded=2, oerodeproof=1, rknown=1, dknown=1, bknown=1)),
            ('TOWEL', dict(spe=2, dknown=1)),
            ('TOWEL', dict(spe=4, dknown=1)),
            ('CANDELABRUM_OF_INVOCATION', dict(spe=3, dknown=1, known=1)),
            ('CANDELABRUM_OF_INVOCATION', dict(spe=5, lamplit=1, dknown=1, known=1)),
            ('WAN_FIRE', dict(spe=0, dknown=1, known=1)),
            ('HEAVY_IRON_BALL', dict(owt=2000)),
            ('HEAVY_IRON_BALL', dict(owt=30)),
            ('BOULDER', dict(corpsenm=1, dknown=1)),
            ('BOULDER', dict(corpsenm=0, dknown=1)),
            ('GLOB_OF_GRAY_OOZE', dict(globby=1, owt=90)),
            ('GLOB_OF_BLACK_PUDDING', dict(globby=1, owt=450)),
            ('LARGE_BOX', dict(lknown=1, cknown=1, obroken=1, dknown=1)),
            ('LARGE_BOX', dict(lknown=1, olocked=1, otrapped=1, tknown=1, dknown=1)),
            ('SACK', dict(cknown=1, dknown=1, contents=[dict(otyp=types['DAGGER'])])),
            ('SACK', dict(cknown=1, dknown=1,
                          contents=[dict(otyp=types['DAGGER']), dict(otyp=types['DAGGER']),
                                    dict(otyp=types['GOLD_PIECE'], quan=4)])),
            ('BAG_OF_HOLDING', dict(cknown=1, dknown=1,
                                    contents=[dict(otyp=types['SACK'],
                                                   contents=[dict(otyp=types['DAGGER'])])])),
            ('FOOD_RATION', dict(oeaten=400, dknown=1)),
            ('LEATHER_ARMOR', dict(oeroded2=2, rknown=1, dknown=1)),
            ('GRAY_DRAGON_SCALES', dict(dknown=1, bknown=1, cursed=1)),
            ('ELVEN_BOOTS', dict(dknown=1, bknown=1, blessed=1)),
    ]:
        changes = {k: v for k, v in changes.items() if v is not None}
        cases.append(case('xname', object=dict(otyp=types[name], **changes)))
        cases.append(case('doname', object=dict(otyp=types[name], **changes)))
    # Corpses, statues, figurines, tins and eggs with species and gender bits.
    for name in ['giant', 'newt', 'Medusa', 'Oracle', 'kobold']:
        index = meta['monsters'].index(name)
        for spe in [0, 1, 2, 3, 4, 7]:
            cases.append(case('xname', object=dict(otyp=types['CORPSE'], corpsenm=index, spe=spe, dknown=1)))
            cases.append(case('doname', object=dict(otyp=types['STATUE'], corpsenm=index, spe=spe, dknown=1)))
        cases.append(case('xname', object=dict(otyp=types['FIGURINE'], corpsenm=index, dknown=1)))
        cases.append(case('xname', object=dict(otyp=types['TIN'], corpsenm=index, known=1, cknown=1, spe=-2, dknown=1)))
        cases.append(case('xname', object=dict(otyp=types['TIN'], corpsenm=index, known=1, cknown=1, spe=0, dknown=1)))
        cases.append(case('xname', object=dict(otyp=types['TIN'], corpsenm=index, known=1, cknown=1, spe=1, dknown=1)))
        cases.append(case('doname', object=dict(otyp=types['EGG'], corpsenm=index, known=1, spe=1, dknown=1)))
    for name in [m for m in ['priest', 'priestess', 'priest of Odin'] if m in meta['monsters']]:
        index = meta['monsters'].index(name)
        cases.append(case('xname', object=dict(otyp=types['CORPSE'], corpsenm=index, dknown=1)))
    # Hero-driven variants.
    for role in range(4):
        for blind in [0, 1]:
            cases.append(case('xname', object=dict(otyp=types['DAGGER'], dknown=0),
                              hero=dict(role=role, blind=blind)))
            cases.append(case('doname', object=dict(otyp=types['STATUE'],
                                                    corpsenm=meta['monsters'].index('orc'),
                                                    spe=5, dknown=1),
                              hero=dict(role=role, blind=blind)))
    for implicit in [0, 1]:
        for otyp_name in ['MACE', 'WAN_COLD', 'ELVEN_MITHRIL_COAT', 'SCR_IDENTIFY']:
            cases.append(case('doname', object=dict(otyp=types[otyp_name], known=1,
                                                    spe=1, bknown=1, dknown=1),
                              hero=dict(implicitUncursed=implicit)))
    cases.append(case('doname', object=dict(otyp=types['MACE'], known=1, spe=1,
                                            bknown=1, dknown=1, wornMask=256)))
    cases.append(case('doname', object=dict(otyp=types['AMULET_OF_LIFE_SAVING'],
                                            dknown=1, known=1, bknown=1, wornMask=65536)))
    cases.append(case('doname', object=dict(otyp=types['RIN_POISON_RESISTANCE'],
                                            dknown=1, known=1, bknown=1, wornMask=131072)))
    cases.append(case('doname', object=dict(otyp=types['RIN_FIRE_RESISTANCE'],
                                            dknown=1, known=1, bknown=1, wornMask=262144)))
    cases.append(case('doname', object=dict(otyp=types['TOWEL'],
                                            dknown=1, wornMask=524288)))
    cases.append(case('doname', object=dict(otyp=types['DAGGER'], quan=7, dknown=1,
                                            known=1, wornMask=512)))
    cases.append(case('doname', object=dict(otyp=types['DAGGER'], dknown=1,
                                            known=1, wornMask=1024)))
    cases.append(case('xname', object=dict(otyp=types['SLIME_MOLD'], spe=1, dknown=1),
                      fruits=['slice of pizza', 'moon melon']))
    cases.append(case('xname', object=dict(otyp=types['SLIME_MOLD'], spe=2, quan=3, dknown=1),
                      fruits=['slice of pizza', 'moon melon']))
    cases.append(case('xname', object=dict(otyp=types['SLIME_MOLD'], spe=1, quan=2, dknown=1),
                      fruits=['cookies']))
    cases.append(case('xname', object=dict(otyp=types['FOOD_RATION'], oeaten=100, dknown=1),
                      hero=dict(partlyEatenHack=1)))
    cases.append(case('xname', object=dict(otyp=types['POT_FRUIT_JUICE'], odiluted=1, dknown=1)))
    cases.append(case('xname', object=dict(otyp=types['POT_WATER'], dknown=1, known=1,
                                           bknown=1, blessed=1),
                      discovery=dict(nameKnown=1)))
    cases.append(case('xname', object=dict(otyp=types['DAGGER'], dknown=1),
                      discovery=dict(nameKnown=0, callName='killer')))
    cases.append(case('xname', object=dict(otyp=types['SCR_MAGIC_MAPPING'], dknown=1),
                      discovery=dict(callName='ZELGO MER')))
    cases.append(case('doname', object=dict(otyp=types['CORPSE'],
                                            corpsenm=meta['monsters'].index('newt'),
                                            oeaten=20, dknown=1)))
    # Monster naming matrix.
    species = ['newt', 'gnome', 'orc', 'wolf', 'shopkeeper', 'priest of Odin',
               'aligned cleric', 'high cleric', 'Wizard of Yendor', 'Oracle',
               'Medusa', 'ghost', 'rogue', 'archeologist', 'angel', 'kitten',
               'air elemental', 'long worm', 'purple worm', 'Aleax', 'nurse']
    for name in species:
        try:
            index = meta['monsters'].index(name)
        except ValueError:
            continue
        for article in [0, 1, 2, 3]:
            cases.append(case('x_monnam', monster=dict(mnum=index), article=article))
        for suppress in [0, 1, 2, 8, 0x40, 0x1F, 0x20]:
            cases.append(case('x_monnam', monster=dict(mnum=index, minvis=1),
                              suppress=suppress))
        cases.append(case('x_monnam', monster=dict(mnum=index, minvis=1, female=1),
                          hero=dict(detect=0), article=2))
        cases.append(case('x_monnam', monster=dict(mnum=index, mtame=1, minvis=1),
                          article=3))
    for changes in [dict(mgivenname='Fido'), dict(mgivenname='Fido', mtame=1),
                    dict(mgivenname='Bar the Valiant'),
                    dict(mgivenname='Killer', female=1),
                    dict(saddle=1, minvis=1), dict(saddle=1, minvis=1, mtame=1),
                    dict(isshk=1, minvis=1), dict(ispriest=1, minvis=1),
                    dict(ispriest=1, priestAlign=-1, minvis=1),
                    dict(ispriest=1, priestAlign=-128, female=1, minvis=1)]:
        if 'blind' in changes:
            changes.pop('blind')
            changes['mtame'] = 1
        index = meta['monsters'].index('kitten' if 'saddle' in changes else 'gnome')
        changes.setdefault('minvis', 1)
        cases.append(case('x_monnam', monster=dict(mnum=index, **changes)))
        cases.append(case('x_monnam', monster=dict(mnum=index, **changes),
                          called=1, article=3))
    for adjective in ['poor', 'angry', 'invisible']:
        for article in [0, 1, 2, 3]:
            cases.append(case('x_monnam', monster=dict(mnum=meta['monsters'].index('newt'), minvis=1),
                              article=article, adjective=adjective))
    cases.append(case('x_monnam',
                      monster=dict(mnum=meta['monsters'].index('shopkeeper'), isshk=1),
                      article=1, adjective='angry'))
    cases.append(case('x_monnam',
                      monster=dict(mnum=meta['monsters'].index('blue dragon'), isshk=1),
                      article=1))
    for level in [0, 1, 5, 14, 30]:
        for female in [0, 1]:
            cases.append(case('x_monnam',
                              monster=dict(mnum=meta['monsters'].index('rogue'),
                                           m_lev=level, female=female, minvis=1),
                              article=2))
    # Full sweeps: every species through x_monnam and every real type through
    # xname/doname with sighted, identified knowledge.
    for index, name in enumerate(meta['monsters']):
        if not name:
            continue
        cases.append(case('x_monnam', monster=dict(mnum=index, minvis=1), article=1))
        cases.append(case('x_monnam', monster=dict(mnum=index, minvis=1, female=1),
                          article=2, suppress=0x20))
    for otyp in range(meta['objects']['ARROW'], len(meta['names'])):
        if not meta['names'][otyp]:
            continue
        known = 1 if (meta.get('initialKnown') or [0] * len(meta['names']))[otyp] else 0
        body = dict(otyp=otyp, dknown=1, bknown=1, known=1)
        discovery = dict(nameKnown=known)
        cases.append(case('xname', object=body, discovery=discovery))
        cases.append(case('doname', object=body, discovery=discovery))
    cases = [c for c in cases if c]
    return cases


def naming_generated(meta, count, seed):
    rng = random.Random(seed)
    types = meta['objects']
    interesting = [types[name] for name in [
                   'DAGGER', 'ELVEN_BOOTS', 'POT_OIL', 'WAN_COLD',
                   'SCR_ENCHANT_WEAPON', 'SPE_FIREBALL', 'TIN', 'EGG',
                   'CORPSE', 'STATUE', 'FIGURINE', 'SLIME_MOLD', 'SACK',
                   'LARGE_BOX', 'TOWEL', 'LENSES', 'GLOB_OF_GRAY_OOZE',
                   'HEAVY_IRON_BALL', 'BOULDER', 'AMULET_OF_YENDOR',
                   'FAKE_AMULET_OF_YENDOR', 'GAIN_STRENGTH', 'FLINT',
                   'RUBY', 'SCR_MAGIC_MAPPING', 'POT_WATER', 'LEASH']]
    species = [name for name in ['newt', 'giant', 'Medusa', 'Oracle', 'wolf',
               'ghost', 'rogue', 'priest of Odin', 'shopkeeper', 'kitten',
               'air elemental', 'Wizard of Yendor', 'succubus', 'nurse',
               'kobold', 'gnome'] if name in meta['monsters']]
    for index in range(count):
        target = NAMING_BASE + index % len(NAMING_TARGETS)
        if target < NAMING_BASE + 3:
            word = rng.choice(meta['names'] + meta['monsters'] + meta['bogusMonsters']
                              + SUFFIX_STEMS + ONE_OFF_PLURALS + AS_IS_WORDS)
            template = rng.choice(['{}', '{} of {}', 'pair of {}', '{} called {}',
                                   '{} named {}', '{} labeled {}', 'the {}',
                                   '{} in {}', '{}-{}'])
            text = template.format(word, rng.choice(['silver', 'the Foo', 'glork']))
            if len(text) > 120:
                text = word
            yield naming_case(dict(target=target, text=text,
                                   seed=rng.randrange(2147483648),
                                   position=rng.choice([0, 1, 63, 255, 256])), meta)
            continue
        if target < NAMING_BASE + 5:
            otyp = rng.choice(interesting)
            oclass = meta['classes'][otyp]
            bounded = otyp in {types['CORPSE'], types['STATUE'], types['FIGURINE'],
                               types.get('CANDELABRUM_OF_INVOCATION', -1)}
            body = dict(otyp=otyp,
                        dknown=rng.randrange(2), known=rng.randrange(2),
                        bknown=rng.randrange(2), rknown=rng.randrange(2),
                        spe=rng.randint(-5, 7) if not bounded else rng.randint(0, 7))
            if rng.randrange(2):
                blessed, cursed = rng.randrange(2), int(rng.randrange(4) == 0)
                body.update(blessed=int(blessed and not cursed), cursed=cursed)
            if oclass in (2, 3, 15, 16, 7) or rng.randrange(3) == 0:
                body.update(oeroded=rng.randrange(4), oeroded2=rng.randrange(4),
                            oerodeproof=rng.randrange(2))
            if oclass == 8:
                body.update(oeroded=0, oeroded2=0)
            if rng.randrange(4) == 0:
                body.update(greased=1)
            if rng.randrange(6) == 0 and oclass == 2:
                body['opoisoned'] = 1
            if rng.randrange(4) == 0:
                body.update(quan=rng.randint(2, 20) if meta['merge'][otyp] else 1)
            if 'GLOB_OF_GRAY_OOZE' in types and otyp == types['GLOB_OF_GRAY_OOZE']:
                body.update(globby=1, quan=1)
            if otyp == types.get('LEASH'):
                body['corpsenm'] = 0  # obj.h: leashmon must reference a live monster
            if otyp in {types['CORPSE'], types['STATUE'], types['FIGURINE']}:
                body.update(corpsenm=meta['monsters'].index(rng.choice(species)),
                            spe=rng.randint(0, 7))
            if otyp == types['TIN'] and rng.randrange(2):
                body.update(corpsenm=meta['monsters'].index(rng.choice(species)),
                            known=1, cknown=1, spe=rng.choice([-3, -2, -1, 0, 1]))
            if oclass == 7 and meta['nutrition'][otyp] and not body.get('globby'):
                body['oeaten'] = rng.randint(0, meta['nutrition'][otyp])
            if rng.randrange(6) == 0:
                body['oname'] = rng.choice(['Sting', 'Fido', 'Glork', 'Excalibur Jr'])
            if rng.randrange(6) == 0:
                body['wornMask'] = rng.choice(naming_worn_masks(otyp, meta))
            if rng.randrange(8) == 0 and not body.get('oeroded') and oclass == 8:
                body['odiluted'] = 1
            discovery = dict(nameKnown=1 if meta['initialKnown'][otyp]
                             else rng.randrange(2))
            if rng.randrange(5) == 0:
                discovery['callName'] = rng.choice(['glork', 'killer', 'ZELGO MER'])
            fruits = rng.choice([[], [], ['slice of pizza'], ['cookies', 'moon melon']])
            if otyp == types['SLIME_MOLD']:
                body['spe'] = rng.randint(1, len(fruits)) if fruits else 1
                fruits = fruits or ['grape']
            yield naming_case(dict(target=target, object=body, discovery=discovery,
                                   fruits=fruits,
                                   hero=dict(role=rng.randrange(4), blind=int(rng.randrange(5) == 0),
                                             implicitUncursed=rng.randrange(2),
                                             partlyEatenHack=int(rng.randrange(6) == 0)),
                                   seed=rng.randrange(2147483648),
                                   position=rng.choice([0, 1, 63, 255, 256])), meta)
            continue
        monster = dict(mnum=meta['monsters'].index(rng.choice(species)),
                       female=rng.randrange(2), minvis=rng.randrange(2),
                       mtame=int(rng.randrange(4) == 0), m_lev=rng.randint(0, 30))
        if rng.randrange(6) == 0:
            monster['mgivenname'] = rng.choice(['Fido', 'Bar', 'Killer'])
        if rng.randrange(8) == 0:
            monster['isshk'] = 1
        if rng.randrange(8) == 0:
            monster.update(ispriest=1, priestAlign=rng.choice([-128, -1, 0, 1]))
        if rng.randrange(6) == 0:
            monster['saddle'] = 1
        suppress = 0
        for bit in [0x01, 0x02, 0x04, 0x08, 0x20, 0x40]:
            if rng.randrange(3) == 0:
                suppress |= bit
        if suppress & 0x20 and suppress & 0x40:
            suppress &= ~0x40
        adjective = '' if suppress & 0x20 else rng.choice(['', '', 'poor', 'angry'])
        called = 0 if suppress & 0x20 else rng.randrange(2)
        see_invisible = int(rng.randrange(4) == 0)
        detect = 1 if not monster['minvis'] or see_invisible else int(rng.randrange(3) != 0)
        yield naming_case(dict(target=target, monster=monster,
                               article=rng.randrange(4),
                               adjective=adjective,
                               suppress=suppress, called=called,
                               hero=dict(blind=int(rng.randrange(4) == 0),
                                         detect=detect, seeInvis=see_invisible),
                               seed=rng.randrange(2147483648),
                               position=rng.choice([0, 1, 63, 255, 256])), meta)
