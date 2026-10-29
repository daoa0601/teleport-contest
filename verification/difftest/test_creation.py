"""Creation behavior from the C rules, asserted independently on C and JS."""
import unittest

from build import CACHE
from creation_model import creation_case
from model import metadata
from run import HERE, Worker


class CreationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.meta = metadata()

    def observations(self, raw):
        state = creation_case(raw, self.meta)
        with Worker([str(CACHE / 'native')], 'creation-test-native') as native, \
                Worker(['node', str(HERE / 'port.mjs')], 'creation-test-port') as port:
            return {'C': native.call(state), 'JS': port.call(state)}

    def test_wishing_wand_starts_with_one_charge(self):
        for backend, result in self.observations(dict(target='mksobj', otyp='WAN_WISHING')).items():
            with self.subTest(backend=backend):
                self.assertEqual(result['objects'][0]['spe'], 1)

    def test_uninitialized_oil_keeps_its_fuel(self):
        for backend, result in self.observations(dict(target='mksobj', otyp='POT_OIL', init=0)).items():
            with self.subTest(backend=backend):
                self.assertEqual(result['objects'][0]['age'], 400)

    def test_sacks_start_empty_in_initial_inventory(self):
        for moves in [0, 1]:
            results = self.observations(dict(target='mksobj', otyp='SACK', level=dict(moves=moves)))
            for backend, result in results.items():
                with self.subTest(backend=backend, moves=moves):
                    self.assertEqual(result['objects'][0]['contents'], [])

    def test_singleton_range_returns_its_only_type(self):
        results = self.observations(dict(target='rnd_class', first='DAGGER', last='DAGGER'))
        for backend, result in results.items():
            with self.subTest(backend=backend):
                self.assertEqual(result['result'], self.meta['objects']['DAGGER'])

    def test_exhausted_monster_reservoir_returns_no_species(self):
        vitals = [dict(mnum=i, flags=2) for i in range(self.meta['specialPM'])]
        for backend, result in self.observations(dict(target='rndmonst', vitals=vitals)).items():
            with self.subTest(backend=backend):
                self.assertEqual(result['result'], -1)

    def test_selected_class_stays_in_its_monster_class(self):
        for backend, result in self.observations(dict(target='mkclass', mclass=1)).items():
            with self.subTest(backend=backend):
                self.assertNotEqual(result['result'], -1)
                self.assertEqual(self.meta['monsterClasses'][result['result']], 1)

    def test_hobbit_inventory_is_owned_by_the_monster(self):
        for backend, result in self.observations(dict(target='makemon_inventory', mnum='hobbit')).items():
            with self.subTest(backend=backend):
                self.assertTrue(result['objects'])
                for obj in result['objects']:
                    self.assertEqual(obj['where'], 'minvent')

    def test_extinct_class_requires_the_ignore_flag(self):
        mclass = 1
        vitals = [dict(mnum=i, flags=1) for i, cls in enumerate(self.meta['monsterClasses'])
                  if cls == mclass]
        for backend, denied in self.observations(dict(target='mkclass', mclass=mclass, vitals=vitals)).items():
            with self.subTest(backend=backend, ignore=False):
                self.assertEqual(denied['result'], -1)
        results = self.observations(dict(target='mkclass', mclass=mclass, vitals=vitals, spc=0x8000))
        for backend, allowed in results.items():
            with self.subTest(backend=backend, ignore=True):
                self.assertNotEqual(allowed['result'], -1)
                self.assertEqual(self.meta['monsterClasses'][allowed['result']], mclass)

    def test_ice_box_corpses_are_contained_without_rot_timers(self):
        for seed in range(16):
            results = self.observations(dict(target='mksobj', otyp='ICE_BOX', seed=seed))
            for backend, result in results.items():
                with self.subTest(backend=backend, seed=seed):
                    contents = result['objects'][0]['contents']
                    self.assertLessEqual(len(contents), 20)
                    for obj in contents:
                        self.assertEqual(obj['otyp'], self.meta['objects']['CORPSE'])
                        self.assertEqual(obj['containerType'], self.meta['objects']['ICE_BOX'])
                        self.assertEqual(obj['age'], 0)
                        self.assertFalse(any(t['kind'] in ['rot-corpse', 'revive-mon', 'shrink-glob']
                                             for t in obj['timers']))

    def test_stasis_blocks_teleportation_through_its_expiry_turn(self):
        for moves, expiry, restricted in [(0, 0, 1), (1, 0, 0), (40, 39, 0),
                                          (40, 40, 1), (40, 41, 1)]:
            results = self.observations(dict(target='makemon_inventory', mnum='hobbit',
                level=dict(moves=moves, stasisUntil=expiry)))
            for backend, result in results.items():
                with self.subTest(backend=backend, moves=moves, expiry=expiry):
                    self.assertEqual(result['teleportRestricted'], restricted)


if __name__ == '__main__':
    unittest.main()
