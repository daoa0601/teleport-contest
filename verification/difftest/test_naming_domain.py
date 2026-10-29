"""Naming-domain boundaries and the cases the differential runner receives."""
from copy import deepcopy
import unittest

from build import CACHE
from model import canonical, metadata
from naming_model import NAMING_BASE, naming_edges, naming_generated
from run import HERE, Worker, difference


class NamingDomainTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.meta = metadata()

    def test_see_invisible_without_detection_is_outside_the_visibility_domain(self):
        for blind in [0, 1]:
            for detect in [0, 1]:
                raw = dict(target='x_monnam', monster=dict(mnum='newt', minvis=1),
                           hero=dict(blind=blind, seeInvis=1, detect=detect))
                with self.subTest(blind=blind, detect=detect):
                    if detect:
                        canonical(raw, self.meta)
                    else:
                        with self.assertRaises(ValueError):
                            canonical(raw, self.meta)

    def test_worn_slots_reject_incompatible_types(self):
        for name, mask in [('DAGGER', 0x20000), ('ELVEN_BOOTS', 0x10000),
                           ('WAN_COLD', 0x1), ('ELVEN_LEATHER_HELM', 0x1),
                           ('DAGGER', 0x80000), ('TOWEL', 0x200000),
                           ('HEAVY_IRON_BALL', 0x400000), ('IRON_CHAIN', 0x200000),
                           ('GOLD_PIECE', 0x100), ('GOLD_PIECE', 0x400)]:
            raw = dict(target='doname', object=dict(otyp=name),
                       discovery=dict(nameKnown=1))
            with self.subTest(name=name, mask=mask):
                canonical(raw, self.meta)
                raw['object']['wornMask'] = mask
                with self.assertRaises(ValueError):
                    canonical(raw, self.meta)

    def test_matching_worn_slots_and_native_weapon_choices_remain_valid(self):
        with Worker([str(CACHE / 'native')], 'slots-native') as native, \
                Worker(['node', str(HERE / 'port.mjs')], 'slots-port') as port:
            for name, mask in [('ELVEN_MITHRIL_COAT', 0x1), ('GAIN_STRENGTH', 0x20000),
                               ('GAIN_STRENGTH', 0x40000), ('MEAT_RING', 0x20000),
                               ('AMULET_OF_LIFE_SAVING', 0x10000),
                               ('LENSES', 0x80000), ('BLINDFOLD', 0x80000),
                               ('TOWEL', 0x80000), ('HEAVY_IRON_BALL', 0x200000),
                               ('IRON_CHAIN', 0x400000), ('DAGGER', 0x100),
                               ('ELVEN_BOOTS', 0x100), ('WAN_COLD', 0x200),
                               ('FOOD_RATION', 0x400), ('GOLD_PIECE', 0x200)]:
                with self.subTest(name=name, mask=mask):
                    state = canonical(dict(target='doname',
                        object=dict(otyp=name, wornMask=mask),
                        discovery=dict(nameKnown=1)), self.meta)
                    self.assertIsNone(difference(native.call(state), port.call(state)))

    def test_contained_objects_cannot_be_equipped(self):
        raw = dict(target='doname', object=dict(otyp='SACK',
                   contents=[dict(otyp='DAGGER')]))
        canonical(raw, self.meta)
        raw['object']['contents'][0]['wornMask'] = 0x100
        with self.assertRaises(ValueError):
            canonical(raw, self.meta)

    def test_generated_cases_stay_in_the_naming_domain(self):
        cases = list(naming_generated(self.meta, 600, 19))
        self.assertEqual(len(cases), 600)
        for case in cases:
            if case['target'] == NAMING_BASE + 5:
                hero, monster = case['hero'], case['monster']
                self.assertTrue(hero['detect'] or (monster['minvis'] and not hero['seeInvis']),
                                case)

    def test_generic_objects_are_rejected_at_every_containment_depth(self):
        for depth in range(3):
            real = dict(otyp='DAGGER')
            for _ in range(depth):
                real = dict(otyp='SACK', contents=[real])
            canonical(dict(target='doname', object=real,
                           discovery=dict(nameKnown=1)), self.meta)
            for otyp in range(1, self.meta['objects']['ARROW']):
                child = dict(otyp=otyp)
                for _ in range(depth):
                    child = dict(otyp='SACK', contents=[child])
                with self.subTest(depth=depth, otyp=otyp), \
                        self.assertRaises(ValueError):
                    canonical(dict(target='doname', object=child,
                                   discovery=dict(nameKnown=1)), self.meta)

    def test_first_real_class_members_keep_each_valid_knowledge_combination(self):
        cases = naming_edges(self.meta)
        for oclass in [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16]:
            otyp = next(index for index in range(self.meta['objects']['ARROW'],
                                               len(self.meta['names']))
                        if self.meta['classes'][index] == oclass
                        and self.meta['names'][index])
            for target in [NAMING_BASE + 3, NAMING_BASE + 4]:
                for dknown in [0, 1]:
                    for name_known in range(self.meta['initialKnown'][otyp], 2):
                        with self.subTest(oclass=oclass, target=target,
                                          dknown=dknown, nameKnown=name_known):
                            self.assertTrue(any(
                                case['target'] == target
                                and case['object']['otyp'] == otyp
                                and case['object']['dknown'] == dknown
                                and case['discovery']['nameKnown'] == name_known
                                for case in cases if 'object' in case))

    def test_required_edge_types_cannot_be_silently_skipped(self):
        for name in ['WAN_FIRE', 'WAN_COLD', 'SCR_IDENTIFY', 'ELVEN_MITHRIL_COAT']:
            meta = deepcopy(self.meta)
            del meta['objects'][name]
            with self.subTest(name=name), self.assertRaises(KeyError):
                naming_edges(meta)

    def test_required_generated_types_cannot_be_silently_replaced(self):
        for name in ['WAN_COLD', 'SCR_ENCHANT_WEAPON', 'GAIN_STRENGTH']:
            meta = deepcopy(self.meta)
            del meta['objects'][name]
            with self.subTest(name=name), self.assertRaises(KeyError):
                list(naming_generated(meta, 0, 1))

    def test_uncursed_option_cases_name_wands_scrolls_and_armor(self):
        cases = naming_edges(self.meta)
        with Worker([str(CACHE / 'native')], 'domain-native') as native, \
                Worker(['node', str(HERE / 'port.mjs')], 'domain-port') as port:
            for name in ['WAN_COLD', 'SCR_IDENTIFY', 'ELVEN_MITHRIL_COAT']:
                for implicit in [0, 1]:
                    matches = [case for case in cases
                               if case['target'] == NAMING_BASE + 4
                               and case['object']['otyp'] == self.meta['objects'][name]
                               and case['object']['known'] == 1
                               and case['object']['bknown'] == 1
                               and case['object']['spe'] == 1
                               and case['hero']['implicitUncursed'] == implicit]
                    with self.subTest(name=name, implicit=implicit):
                        self.assertTrue(matches, 'Missing uncursed-option naming case')
                        left, right = native.call(matches[0]), port.call(matches[0])
                        self.assertIsNone(difference(left, right))
                        # C keeps the prefix for uncharged types and armor.
                        if name != 'WAN_COLD' or not implicit:
                            self.assertIn('uncursed', left['result'])
                        else:
                            self.assertNotIn('uncursed', left['result'])


if __name__ == '__main__':
    unittest.main()
