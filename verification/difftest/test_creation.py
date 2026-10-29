"""Real constructor behavior and explicit creation-domain boundaries."""
import unittest

from build import CACHE
from creation_model import creation_case
from model import metadata
from run import HERE, Worker, difference, minimize


class CreationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.meta = metadata()

    def observations(self, raw):
        state = creation_case(raw, self.meta)
        with Worker([str(CACHE / 'native')], 'creation-test-native') as native, \
                Worker(['node', str(HERE / 'port.mjs')], 'creation-test-port') as port:
            left, right = native.call(state), port.call(state)
        found = difference(left, right)
        self.assertIsNone(found, f'{raw}: {found}')
        return left

    def test_wishing_wand_starts_with_one_charge(self):
        result = self.observations(dict(target='mksobj', otyp='WAN_WISHING'))
        self.assertEqual(result['objects'][0]['spe'], 1)

    def test_uninitialized_oil_keeps_its_fuel(self):
        result = self.observations(dict(target='mksobj', otyp='POT_OIL', init=0))
        self.assertEqual(result['objects'][0]['age'], 400)

    def test_sacks_start_empty_in_initial_inventory(self):
        for moves in [0, 1]:
            with self.subTest(moves=moves):
                result = self.observations(dict(target='mksobj', otyp='SACK',
                    level=dict(moves=moves)))
                self.assertEqual(result['objects'][0]['contents'], [])

    def test_fixed_range_consumes_no_random_word(self):
        result = self.observations(dict(target='rnd_class', first='DAGGER', last='DAGGER'))
        self.assertEqual(result['result'], self.meta['objects']['DAGGER'])
        self.assertEqual(result['rng']['core'], 0)

    def test_exhausted_monster_reservoir_returns_no_species(self):
        vitals = [dict(mnum=i, flags=2) for i in range(self.meta['specialPM'])]
        result = self.observations(dict(target='rndmonst', vitals=vitals))
        self.assertEqual(result['result'], -1)
        self.assertEqual(result['rng']['core'], 0)

    def test_selected_class_stays_in_its_monster_class(self):
        result = self.observations(dict(target='mkclass', mclass=1))
        self.assertEqual(self.meta['monsterClasses'][result['result']], 1)

    def test_hobbit_inventory_is_owned_by_the_monster(self):
        result = self.observations(dict(target='makemon_inventory', mnum='hobbit'))
        self.assertTrue(result['objects'])
        for obj in result['objects']:
            self.assertEqual(obj['where'], 'minvent')

    def test_extinct_class_requires_the_ignore_flag(self):
        mclass = 1
        vitals = [dict(mnum=i, flags=1) for i, cls in enumerate(self.meta['monsterClasses'])
                  if cls == mclass]
        denied = self.observations(dict(target='mkclass', mclass=mclass, vitals=vitals))
        self.assertEqual(denied['result'], -1)
        allowed = self.observations(dict(target='mkclass', mclass=mclass, vitals=vitals, spc=0x8000))
        self.assertEqual(self.meta['monsterClasses'][allowed['result']], mclass)

    def test_ice_box_corpses_are_contained_without_rot_timers(self):
        result = self.observations(dict(target='mksobj', otyp='ICE_BOX'))
        contents = result['objects'][0]['contents']
        self.assertTrue(contents)
        for obj in contents:
            self.assertEqual(obj['otyp'], self.meta['objects']['CORPSE'])
            self.assertEqual(obj['containerType'], self.meta['objects']['ICE_BOX'])
            self.assertEqual(obj['age'], 0)
            self.assertFalse(any(t['kind'] == 'rot-corpse' for t in obj['timers']))

    def test_move_zero_uses_the_same_initial_stasis_expiry(self):
        self.observations(dict(target='makemon_inventory', mnum='baby gray dragon',
            seed=1473357231, position=255, level=dict(depth=43, moves=0)))

    def test_reducer_removes_unneeded_species_history(self):
        state = creation_case(dict(target='mksobj', init=0, seed=42, position=255,
            level=dict(depth=25), vitals=[dict(mnum=0, flags=1, born=120)]), self.meta)
        with Worker([str(CACHE / 'native')], 'creation-reduce-native') as native, \
                Worker(['node', str(HERE / 'port.mjs')], 'creation-reduce-port', 'create_object') as port:
            reduced = minimize(state, native, port, self.meta, 'objects[0].spe')
            self.assertEqual(reduced['vitals'], [])
            self.assertEqual(reduced['position'], 0)
            self.assertEqual(difference(native.call(reduced), port.call(reduced))['path'],
                             'objects[0].spe')

    def test_creation_domain_rejects_invalid_ids_and_generation_flags(self):
        for raw in [dict(target='mksobj', otyp=17), dict(target='mkobj', oclass=1),
                    dict(target='rnd_class', first=len(self.meta['names'])),
                    dict(target='rndmonst', level=dict(depth=0)),
                    dict(target='mkclass', mclass=59),
                    dict(target='makemon_inventory', mnum=len(self.meta['monsters'])),
                    dict(target='mkclass', spc=4),
                    dict(target='rndmonst', vitals=[dict(mnum=0, flags=4)]),
                    dict(target='rndmonst', vitals=[dict(mnum=0), dict(mnum=0)])]:
            with self.subTest(raw=raw), self.assertRaises(ValueError):
                creation_case(raw, self.meta)


if __name__ == '__main__':
    unittest.main()
