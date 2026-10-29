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
                        self.assertRaisesRegex(ValueError, 'Generic class rows'):
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
            with self.subTest(name=name), self.assertRaisesRegex(KeyError, name):
                naming_edges(meta)

    def test_required_generated_types_cannot_be_silently_replaced(self):
        for name in ['WAN_COLD', 'SCR_ENCHANT_WEAPON', 'GAIN_STRENGTH']:
            meta = deepcopy(self.meta)
            del meta['objects'][name]
            with self.subTest(name=name), self.assertRaisesRegex(KeyError, name):
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
