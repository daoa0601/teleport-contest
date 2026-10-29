"""Creation domains and inputs, independent of recorded game sessions."""
from __future__ import annotations

import random

from model import TARGETS, integer, record

CREATION_TARGETS = ['mksobj', 'mkobj', 'rnd_class', 'rndmonst', 'mkclass', 'makemon_inventory']
CREATION_LOCATIONS = [
    ('mkobj.c:mksobj', 'mklev.js:mksobj'),
    ('mkobj.c:mkobj', 'mklev.js:mkobj'),
    ('objnam.c:rnd_class', 'mklev.js:rndClass'),
    ('makemon.c:rndmonst', 'mklev.js:rndmonstAdj'),
    ('makemon.c:mkclass_aligned', 'mklev.js:mkclassAligned'),
    ('makemon.c:makemon (m_initweap/m_initinv)', 'mklev.js:makemonAt'),
]
ARGUMENTS = {
    6: ('otyp', 'init', 'artif'), 7: ('oclass', 'artif'), 8: ('first', 'last'),
    9: (), 10: ('mclass', 'spc', 'alignment'), 11: ('mnum',),
}
LEVEL = dict(depth=8, heroLevel=8, alignment=0, temperature=0, place=0,
             moves=40, inMklev=0, lit=1, noTeleport=0, stasisUntil=0)
# place: ordinary, Gehennom, Rogue, Mines, Earth, Air, Fire, Water, Astral.


def creation_case(raw, meta):
    target = raw.get('target')
    if isinstance(target, str):
        target = len(TARGETS) + CREATION_TARGETS.index(target)
    integer(target, len(TARGETS), len(TARGETS) + len(CREATION_TARGETS) - 1, 'target')
    record(raw, ['target', 'seed', 'position', 'level', 'vitals', *ARGUMENTS[target]],
           'creation case')
    level = {**LEVEL, **record(raw.get('level', {}), LEVEL, 'level')}
    for key, low, high in [('depth', 1, 50), ('heroLevel', 1, 30),
                           ('alignment', -128, 1), ('temperature', -1, 1),
                           ('place', 0, 8), ('moves', 0, 100000),
                           ('inMklev', 0, 1), ('lit', 0, 1), ('noTeleport', 0, 1),
                           ('stasisUntil', 0, 100100)]:
        integer(level[key], low, high, f'level.{key}')
    if level['alignment'] not in [-128, -1, 0, 1]:
        raise ValueError('level.alignment must be A_NONE, chaotic, neutral or lawful')
    result = dict(target=target, level=level)
    for key, default, low, high in [
        ('seed', 1, 0, 2147483647), ('position', 0, 0, 4096),
        ('otyp', meta['objects']['DAGGER'], 18, len(meta['names']) - 1),
        ('init', 1, 0, 1), ('artif', 0, 0, 1), ('oclass', 0, -10, 17),
        ('first', meta['objects']['DAGGER'], 18, len(meta['names']) - 1),
        ('last', meta['objects']['DAGGER'], 18, len(meta['names']) - 1),
        ('mclass', 1, 1, 60), ('spc', 0, 0, 0xFFFF),
        ('alignment', -128, -128, 1), ('mnum', 0, 0, len(meta['monsters']) - 1),
    ]:
        if key not in ('seed', 'position', *ARGUMENTS[target]):
            continue
        value = raw.get(key, default)
        if key in ['otyp', 'first', 'last'] and isinstance(value, str):
            value = meta['objects'].get(value, -1)
        if key == 'mnum' and isinstance(value, str):
            value = meta['monsters'].index(value)
        result[key] = integer(value, low, high, key)
    if result.get('oclass', 0) not in [-10, 0, *range(2, 18)]:
        raise ValueError('ILLOBJ_CLASS has no generation reservoir')
    if result.get('mclass', 1) not in meta['monsterClasses'][:meta['specialPM']]:
        raise ValueError('mclass must contain a species before SPECIAL_PM')
    if result.get('alignment', -128) not in [-128, -1, 0, 1]:
        raise ValueError('alignment must be A_NONE, chaotic, neutral or lawful')
    if result.get('spc', 0) & ~(0x0200 | 0x0400 | 0x0800 | 0x1000 | 0x8000):
        raise ValueError('spc may only override generation flags or G_IGNORE')
    # Non-generatable unnamed scroll/spellbook appearances have no real type.
    if 'otyp' in result and not meta['names'][result['otyp']]:
        raise ValueError('otyp must have an object name')
    vitals = raw.get('vitals', [])
    if not isinstance(vitals, list) or len(vitals) > len(meta['monsters']):
        raise ValueError('vitals must contain at most one entry per monster')
    result['vitals'] = []
    seen = set()
    for vital in vitals:
        record(vital, ['mnum', 'flags', 'born'], 'vital')
        species = integer(vital.get('mnum'), 0, len(meta['monsters']) - 1, 'vital.mnum')
        flags = integer(vital.get('flags', 0), 0, 3, 'vital.flags')
        born = integer(vital.get('born', 0), 0, 255, 'vital.born')
        if species in seen:
            raise ValueError('Duplicate species in vitals')
        seen.add(species)
        result['vitals'].append(dict(mnum=species, flags=flags, born=born))
    return result


def creation_edges(meta):
    def case(target, **changes):
        return creation_case(dict(target=target, **changes), meta)
    for otyp, name in enumerate(meta['names']):
        if otyp >= 18 and name:
            for init in [0, 1]:
                yield case('mksobj', otyp=otyp, init=init)
    for place in range(9):
        for alignment in [-128, -1, 0, 1]:
            for depth in [1, 8, 25, 50]:
                yield case('rndmonst', level=dict(place=place, alignment=alignment, depth=depth))
        for oclass in [-10, 0, *range(2, 18)]:
            yield case('mkobj', oclass=oclass, level=dict(place=place))
    for mclass in sorted(set(meta['monsterClasses'][:meta['specialPM']])):
        if mclass:
            for alignment in [-128, -1, 0, 1]:
                yield case('mkclass', mclass=mclass, alignment=alignment)
    for mnum in range(len(meta['monsters'])):
        yield case('makemon_inventory', mnum=mnum)
    for first, last in [('DILITHIUM_CRYSTAL', 'LOADSTONE'), ('WAN_LIGHT', 'WAN_LIGHTNING'),
                        ('SPE_DIG', 'SPE_BLANK_PAPER'), ('DAGGER', 'DAGGER'),
                        ('WAN_WISHING', 'WAN_WISHING')]:
        yield case('rnd_class', first=first, last=last)


def creation_generated(meta, count, seed):
    rng = random.Random(seed)
    types = [i for i, name in enumerate(meta['names']) if i >= 18 and name]
    classes = sorted(set(meta['monsterClasses'][:meta['specialPM']]) - {0})
    for index in range(count):
        target = CREATION_TARGETS[index % len(CREATION_TARGETS)]
        first, last = sorted(rng.sample(types, 2))
        raw = dict(target=target, seed=rng.randrange(2147483648),
            position=rng.choice([0, 1, 254, 255, 256, 257, 511]),
            level=dict(depth=rng.randint(1, 50), heroLevel=rng.randint(1, 30),
                place=rng.randrange(9), alignment=rng.choice([-128, -1, 0, 1]),
                temperature=rng.choice([-1, 0, 1]), moves=rng.choice([0, 1, 40]),
                inMklev=rng.randrange(2), lit=rng.randrange(2),
                noTeleport=int(index % 7 == 0), stasisUntil=60 if index % 11 == 0 else 0),
            otyp=rng.choice(types), init=rng.randrange(2), artif=rng.randrange(2),
            oclass=rng.choice([-10, 0, *range(2, 18)]), first=first, last=last,
            mclass=rng.choice(classes), alignment=rng.choice([-128, -1, 0, 1]),
            spc=rng.choice([0, 0x200, 0x1000, 0x8000, 0x600]),
            mnum=rng.randrange(len(meta['monsters'])),
            vitals=[dict(mnum=mnum, flags=rng.choice([1, 2, 3]), born=rng.randrange(256))
                for mnum in rng.sample(range(len(meta['monsters'])), rng.randrange(10))])
        arguments = ARGUMENTS[len(TARGETS) + index % len(CREATION_TARGETS)]
        yield creation_case({key: value for key, value in raw.items()
            if key in ('target', 'seed', 'position', 'level', 'vitals', *arguments)}, meta)
