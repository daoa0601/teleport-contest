"""Explicit shared input domain. This describes state, not game algorithms."""
from __future__ import annotations

from copy import deepcopy
import json
from pathlib import Path
import random
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
TARGETS = ['weight', 'inv_weight', 'calc_capacity', 'near_capacity', 'dmgval', 'find_roll_to_hit']
LOCATIONS = [
    ('mkobj.c:weight', 'weight.js:objectWeight'),
    ('hack.c:inv_weight', 'weight.js:invWeight'),
    ('hack.c:calc_capacity', 'weight.js:calcCapacity'),
    ('hack.c:near_capacity', 'weight.js:nearCapacity'),
    ('weapon.c:dmgval', 'weapon_damage.js:rollPhysicalWeaponDamage'),
    ('uhitm.c:find_roll_to_hit', 'hero_attack_accuracy.js:findHeroMeleeHitThreshold'),
]
HERO = dict(str=12, dex=12, con=12, level=8, luck=0, moreluck=0,
            hitinc=0, trapped=0, form=-1, levitating=0, flying=0, legs=0, role=0,
            leftRing=-21, rightRing=-21)
OBJECT = dict(quan=1, owt=0, corpsenm=-1, oeaten=0, spe=0, blessed=0,
              cursed=0, globby=0, oeroded=0, oeroded2=0, contents=[])
MONSTER = dict(mnum=0, mcanmove=1, msleeping=0, mstun=0, mflee=0)


def metadata() -> dict:
    return json.loads(subprocess.check_output(['node', str(HERE / 'port.mjs'), '--metadata'], text=True))


def integer(value, low, high, name):
    if type(value) is not int or not low <= value <= high:
        raise ValueError(f'{name} must be an integer in [{low}, {high}], got {value!r}')
    return value


def record(value, allowed, name):
    if not isinstance(value, dict) or set(value) - set(allowed):
        raise ValueError(f'{name} must contain only {sorted(allowed)}')
    return value


def canonical(raw: dict, meta: dict) -> dict:
    from creation_model import CREATION_TARGETS, creation_case
    from naming_model import NAMING_TARGETS, naming_case
    if raw.get('target') in NAMING_TARGETS or (
            type(raw.get('target')) is int and raw['target'] >= len(TARGETS) + 6):
        return naming_case(raw, meta)
    if raw.get('target') in CREATION_TARGETS or (
            type(raw.get('target')) is int and raw['target'] >= len(TARGETS)):
        return creation_case(raw, meta)
    record(raw, ['target', 'hero', 'object', 'inventory', 'monster', 'seed',
                 'position', 'extra', 'attacks', 'method', 'armed'], 'case')
    types = meta['objects']
    containers = {types[name] for name in ['LARGE_BOX', 'CHEST', 'ICE_BOX', 'SACK',
                   'OILSKIN_SACK', 'BAG_OF_HOLDING', 'STATUE']}
    globs = {types[name] for name in ['GLOB_OF_GRAY_OOZE', 'GLOB_OF_BROWN_PUDDING',
                                     'GLOB_OF_GREEN_SLIME', 'GLOB_OF_BLACK_PUDDING']}
    total = 0
    weight_budget = 0
    unit_bound = max(max(meta['weights']), max(body[0] * 2 for body in meta['bodies']), 2000)

    def object_state(value, depth=0):
        nonlocal total, weight_budget
        total += 1
        if depth > 4 or total > 100:
            raise ValueError('At most 100 objects and four containment edges are supported')
        record(value, {*OBJECT, 'otyp'}, 'object')
        result = {**deepcopy(OBJECT), **value}
        otyp = result.get('otyp', types['DAGGER'])
        if isinstance(otyp, str):
            otyp = types.get(otyp, -1)
        result['otyp'] = integer(otyp, 1, len(meta['names']) - 1, 'otyp')
        for key, low, high in [('quan', 1, 1000000), ('owt', 0, 10000000),
                               ('corpsenm', -1, len(meta['monsters']) - 1),
                               ('oeaten', 0, 1000000), ('spe', -20, 20),
                               ('oeroded', 0, 3), ('oeroded2', 0, 3)]:
            integer(result[key], low, high, key)
        # A conservative bound, deliberately larger than any supported weight
        # rule, keeps all generated C int sums/products below INT_MAX. Coins
        # use at most one unit per 100 pieces; a whole stack is still <= quan.
        item_bound = result['quan'] * (1 if meta['classes'][otyp] == 12 else unit_bound)
        weight_budget += max(item_bound, result['owt']) * (2 ** depth)
        if weight_budget > 100000000:
            raise ValueError('The conservative object-weight budget exceeds 100,000,000')
        for key in ['blessed', 'cursed', 'globby']:
            integer(result[key], 0, 1, key)
        if result['blessed'] and result['cursed']:
            raise ValueError('An object cannot be both blessed and cursed')
        if not isinstance(result['contents'], list):
            raise ValueError('contents must be an array')
        if result['contents'] and otyp not in containers:
            raise ValueError('Only containers/statues may have contents (obj.h:Is_container)')
        if otyp in containers and result['quan'] != 1:
            raise ValueError('Containers and statues do not stack (objects.h:oc_merge)')
        if not meta['merge'][otyp] and result['quan'] != 1:
            raise ValueError('This object type does not stack (objects.h:oc_merge)')
        if result['globby'] != int(otyp in globs) or otyp in globs and result['quan'] != 1:
            raise ValueError('Glob type, globby flag and singleton quantity must agree')
        if otyp in {types['CORPSE'], types['STATUE']} and result['corpsenm'] < 0:
            raise ValueError('This domain requires a valid corpse/statue species')
        if result['oeaten']:
            nutrition = (meta['bodies'][result['corpsenm']][1] if otyp == types['CORPSE']
                         else result['owt'] if result['globby'] else meta['nutrition'][otyp])
            if meta['classes'][otyp] != 7 or result['oeaten'] > nutrition:
                raise ValueError('Partly eaten food needs 0 < oeaten <= obj_nutrition')
        if otyp == types['HEAVY_IRON_BALL']:
            extra = result['owt'] - meta['weights'][otyp]
            if extra > 0 and extra % meta['ironBallIncrement']:
                raise ValueError('Heavy-ball increases must use WT_IRON_BALL_INCR; rnd(0) is undefined')
        if otyp == types['CANDELABRUM_OF_INVOCATION'] and not 0 <= result['spe'] <= 7:
            raise ValueError('The candelabrum holds zero to seven candles')
        result['contents'] = [object_state(child, depth + 1) for child in result['contents']]
        return result

    hero_raw = record(raw.get('hero', {}), HERO, 'hero')
    hero = {**HERO, **hero_raw}
    for key, low, high in [('str', 3, 125), ('dex', 3, 25), ('con', 3, 25),
                           ('level', 1, 30), ('luck', -13, 13), ('moreluck', -3, 3),
                           ('hitinc', -40, 40), ('form', -1, len(meta['monsters']) - 1), ('legs', 0, 3),
                           ('leftRing', -21, 20), ('rightRing', -21, 20)]:
        integer(hero[key], low, high, key)
    for key in ['trapped', 'levitating', 'flying', 'role']:
        integer(hero[key], 0, 1, key)
    target = raw.get('target', 0)
    if isinstance(target, str):
        if target not in TARGETS:
            raise ValueError(f'Unknown target {target!r}')
        target = TARGETS.index(target)
    integer(target, 0, 5, 'target')
    if target == 5 and hero['form'] != -1:
        raise ValueError('Accuracy currently covers human form only')
    monster_raw = record(raw.get('monster', {}), MONSTER, 'monster')
    monster = {**MONSTER, **monster_raw}
    if isinstance(monster['mnum'], str):
        monster['mnum'] = meta['monsters'].index(monster['mnum'])
    integer(monster['mnum'], 0, len(meta['monsters']) - 1, 'mnum')
    for key in ['mcanmove', 'msleeping', 'mstun', 'mflee']:
        integer(monster[key], 0, 1, key)
    inventory = raw.get('inventory', [])
    if not isinstance(inventory, list):
        raise ValueError('inventory must be an array')
    result = dict(target=target, hero=hero, monster=monster,
                  object=object_state(raw.get('object', {})),
                  inventory=[object_state(item) for item in inventory])
    for key, default, low, high in [('seed', 1, 0, 2147483647), ('position', 0, 0, 4096),
                                  ('extra', 0, -10000, 10000), ('attacks', 0, 0, 10),
                                  ('method', meta['methods']['weapon'], 0, 255), ('armed', 0, 0, 1)]:
        result[key] = integer(raw.get(key, default), low, high, key)
    if result['method'] not in meta['methods'].values():
        raise ValueError('Only AT_WEAP, AT_KICK and AT_BITE are in the current domain')
    return result


def edge_cases(meta):
    """Behavior boundaries selected from the owning C functions, not sessions."""
    types = meta['objects']
    def case(target, **changes):
        return canonical(dict(target=target, **changes), meta)
    cases = []
    for quantity in [1, 49, 50, 99, 100, 149, 150, 10000]:
        cases.append(case('weight', object=dict(otyp='GOLD_PIECE', quan=quantity)))
        cases.append(case('inv_weight', inventory=[dict(otyp='GOLD_PIECE', quan=quantity)]))
    for blessed, cursed in [(0, 0), (1, 0), (0, 1)]:
        cases.append(case('weight', object=dict(otyp='BAG_OF_HOLDING', blessed=blessed,
            cursed=cursed, contents=[dict(otyp='DAGGER', quan=3), dict(otyp='GOLD_PIECE', quan=1)])))
    for species in ['killer bee', 'wraith', 'human', 'iron golem']:
        for kind in ['CORPSE', 'STATUE']:
            cases.append(case('weight', object=dict(otyp=kind, corpsenm=meta['monsters'].index(species))))
    for remaining in [1, 400, 799]:
        cases.append(case('weight', object=dict(otyp='FOOD_RATION', oeaten=remaining, quan=3)))
    for mass in [0, 1, 20, 500]:
        cases.append(case('weight', object=dict(otyp='GLOB_OF_GRAY_OOZE', globby=1, owt=mass)))
    nested = dict(otyp='GOLD_PIECE', quan=1)
    for depth in range(4):
        nested = dict(otyp='BAG_OF_HOLDING', blessed=int(depth % 2 == 0),
                      cursed=int(depth % 2 != 0), contents=[nested])
        cases.append(case('weight', object=nested))
    cases.append(case('weight', object=dict(otyp='CANDELABRUM_OF_INVOCATION', spe=7)))
    for extra in [-1, 0, 1, 325, 650, 1300]:
        cases.append(case('calc_capacity', extra=650 + extra))
    for target in ['inv_weight', 'near_capacity']:
        for strength in [3, 18, 19, 118, 125]:
            cases.append(case(target, hero=dict(str=strength, con=3, legs=3)))
    cases.append(case('near_capacity', hero=dict(str=3, con=3, legs=3),
                      inventory=[dict(otyp='DAGGER', owt=10)]))
    for name, species in [('CREAM_PIE', 'human'), ('BATTLE_AXE', 'wood golem'),
                          ('TWO_HANDED_SWORD', 'giant'), ('SILVER_SABER', 'shade'),
                          ('DAGGER', 'iron golem'), ('RUBBER_HOSE', 'iron golem')]:
        cases.append(case('dmgval', object=dict(otyp=name, blessed=1), monster=dict(mnum=species)))
    for increments in [0, 1, 3]:
        cases.append(case('dmgval', object=dict(otyp='HEAVY_IRON_BALL',
            owt=meta['weights'][types['HEAVY_IRON_BALL']] + increments * meta['ironBallIncrement'])))
    for luck in [-13, -3, -1, 0, 1, 3, 13]:
        cases.append(case('find_roll_to_hit', hero=dict(luck=luck, hitinc=5), armed=1,
                          monster=dict(mnum='orc', mstun=1), object=dict(otyp='DAGGER', spe=2)))
    for left, right in [(-21, -21), (-5, -21), (0, 3), (5, -5), (3, 5)]:
        cases.append(case('find_roll_to_hit', hero=dict(leftRing=left, rightRing=right)))
    for species in ['wererat', 'werejackal', 'werewolf']:
        for form, name in enumerate(meta['monsters']):
            if name == species:
                cases.append(case('inv_weight', hero=dict(form=form)))
    return cases


def generated_cases(meta, count, seed):
    rng = random.Random(seed)
    def choose(values):
        return rng.choice(values)
    types = meta['objects']
    species = ['human', 'orc', 'giant', 'shade', 'wood golem', 'iron golem', 'vampire', 'werewolf']
    weapons = ['DAGGER', 'BATTLE_AXE', 'SILVER_SABER', 'TRIDENT', 'TWO_HANDED_SWORD',
               'FLAIL', 'RUBBER_HOSE', 'CROSSBOW_BOLT', 'MACE', 'CREAM_PIE', 'ACID_VENOM']
    for index in range(count):
        target = index % 6
        name = choose(weapons)
        object_state = dict(otyp=name, owt=meta['weights'][types[name]],
                            spe=rng.randint(-5, 5), blessed=rng.randrange(2),
                            oeroded=rng.randrange(4), oeroded2=rng.randrange(4))
        if target == 0:
            name = choose(['DAGGER', 'FOOD_RATION', 'SACK', 'BAG_OF_HOLDING', 'GOLD_PIECE'])
            object_state = dict(otyp=name, quan=1 if name in ['SACK', 'BAG_OF_HOLDING'] else rng.randint(1, 100))
            if name in ['SACK', 'BAG_OF_HOLDING']:
                object_state.update(blessed=rng.randrange(2), contents=[dict(otyp='DAGGER', quan=rng.randint(1, 100))])
            if name == 'FOOD_RATION':
                object_state['oeaten'] = rng.randint(1, meta['nutrition'][types[name]])
        inventory = []
        for _ in range(rng.randrange(6)):
            inv_name = choose(['DAGGER', 'GOLD_PIECE', 'BOULDER'])
            quantity = rng.randint(1, 10)
            if not meta['merge'][types[inv_name]]:
                quantity = 1
            # A stored weight is part of the correspondence. These simple
            # fresh stacks have table weight * quantity (mkobj.c:weight).
            inventory.append(dict(otyp=inv_name, quan=quantity, owt=meta['weights'][types[inv_name]] * quantity))
        hero = dict(str=choose([3, 12, 18, 19, 68, 118, 125]), con=rng.randint(3, 25),
                    dex=rng.randint(3, 25), level=rng.randint(1, 30),
                    luck=rng.randint(-13, 13), moreluck=choose([-3, 0, 3]),
                    hitinc=rng.randint(-7, 7), trapped=rng.randrange(2),
                    legs=rng.randrange(4), levitating=rng.randrange(2), flying=rng.randrange(2),
                    role=rng.randrange(2), leftRing=choose([-21, -3, 0, 3]),
                    rightRing=choose([-21, -3, 0, 3]))
        if target in [1, 2, 3] and rng.randrange(2):
            hero['form'] = meta['monsters'].index(choose(['giant', 'wood nymph', 'fog cloud', 'kitten']))
            hero['leftRing'] = hero['rightRing'] = -21
        monster = dict(mnum=choose(species), mcanmove=rng.randrange(2), msleeping=rng.randrange(2),
                       mstun=rng.randrange(2), mflee=rng.randrange(2))
        yield canonical(dict(target=target, object=object_state, inventory=inventory,
            hero=hero, monster=monster, seed=rng.randrange(2147483648),
            position=choose([0, 1, 254, 255, 256, 257, 511]), extra=rng.randint(-1000, 1000),
            method=choose(list(meta['methods'].values())), armed=rng.randrange(2)), meta)
