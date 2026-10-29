"""Tests of the comparison/reduction boundaries, outside the game test suite."""
from copy import deepcopy
import unittest

from build import CACHE
from model import canonical, metadata
from run import HERE, Worker, difference, minimize, naming_negative_checks


class HarnessTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.meta = metadata()

    def test_real_container_coin_rounding(self):
        state = canonical(dict(target='weight', object=dict(otyp='BAG_OF_HOLDING',
            blessed=1, contents=[dict(otyp='GOLD_PIECE', quan=1)])), self.meta)
        with Worker([str(CACHE / 'native')], 'test-native') as native, \
                Worker(['node', str(HERE / 'port.mjs')], 'test-port') as port:
            for result in [native.call(state), port.call(state)]:
                self.assertEqual(result['result'], 16)  # bag 15 + rounded contents 1

    def test_real_dice_cross_an_isaac_refill(self):
        state = canonical(dict(target='dmgval', object=dict(otyp='TWO_HANDED_SWORD'),
            monster=dict(mnum='giant'), position=255), self.meta)
        with Worker([str(CACHE / 'native')], 'test-native') as native, \
                Worker(['node', str(HERE / 'port.mjs')], 'test-port') as port:
            left, right = native.call(state), port.call(state)
            self.assertIsNone(difference(left, right))
            self.assertGreaterEqual(left['result'], 3)
            self.assertLessEqual(left['result'], 18)

    def test_accuracy_projection_omits_the_unobservable_attack_counter(self):
        with Worker([str(CACHE / 'native')], 'test-native') as native, \
                Worker(['node', str(HERE / 'port.mjs')], 'test-port') as port:
            for attacks in [0, 4]:
                with self.subTest(attacks=attacks):
                    state = canonical(dict(target='find_roll_to_hit', attacks=attacks), self.meta)
                    left, right = native.call(state), port.call(state)
                    self.assertIsNone(difference(left, right))
                    self.assertNotIn('attacks', left['state'])
                    self.assertNotIn('attacks', right['state'])

    def test_polymorph_preserves_both_forms_of_each_were_species(self):
        with Worker([str(CACHE / 'native')], 'test-native') as native, \
                Worker(['node', str(HERE / 'port.mjs')], 'test-port') as port:
            for name in ['wererat', 'werejackal', 'werewolf']:
                forms = [index for index, value in enumerate(self.meta['monsters']) if value == name]
                for form in forms:
                    with self.subTest(species=name, form=form):
                        state = canonical(dict(target='inv_weight', hero=dict(form=form)), self.meta)
                        left, right = native.call(state), port.call(state)
                        for result in [left, right]:
                            self.assertEqual(result['state']['hero']['form'], form)
                        self.assertIsNone(difference(left, right))

    def test_flying_form_ignores_wounded_leg_capacity_penalty(self):
        form = self.meta['monsters'].index('fog cloud')
        state = canonical(dict(target='inv_weight', hero=dict(form=form, legs=3)), self.meta)
        with Worker([str(CACHE / 'native')], 'test-native') as native, \
                Worker(['node', str(HERE / 'port.mjs')], 'test-port') as port:
            for result in [native.call(state), port.call(state)]:
                self.assertEqual(result['result'], -1000)
                self.assertEqual(result['state']['hero']['flying'], 1)

    def test_reducer_keeps_a_real_emitted_mutant_counterexample(self):
        state = canonical(dict(target='weight', hero=dict(str=18, luck=3),
            object=dict(otyp='DAGGER', quan=3), inventory=[dict(otyp='GOLD_PIECE')],
            seed=42, position=255), self.meta)
        with Worker([str(CACHE / 'native')], 'test-native') as native, \
                Worker(['node', str(HERE / 'port.mjs')], 'test-mutant', 'weight') as port:
            reduced = minimize(state, native, port, self.meta, 'result')
            self.assertEqual(reduced['inventory'], [])
            self.assertEqual(reduced['object']['quan'], 1)
            self.assertEqual(reduced['position'], 0)
            found = difference(native.call(reduced), port.call(reduced))
            self.assertEqual(found['path'], 'result')

    def test_compare_reports_the_first_changed_object_enchantment(self):
        left = dict(state=dict(object=[dict(spe=1), dict(spe=3)]))
        right = deepcopy(left)
        right['state']['object'][1]['spe'] = 4
        found = difference(left, right)
        self.assertEqual(found, dict(path='state.object[1].spe', native=3, port=4))

    def test_naming_string_targets_measure_their_rng_stream(self):
        # An extra draw in the string grammar must reach the rng comparison;
        # a constant zero on the JS side would hide it.
        state = canonical(dict(target='makeplural', text='newt'), self.meta)
        with Worker([str(CACHE / 'native')], 'string-native') as native:
            observed = native.call(state)
        with Worker(['node', str(HERE / 'port.mjs')], 'string-mutant',
                    'naming_string_draw') as mutant:
            found = difference(observed, mutant.call(state))
        self.assertIsNotNone(found)
        self.assertTrue(found['path'].startswith('rng.core'), found)

    def test_naming_string_stream_matches_the_native_measurement(self):
        state = canonical(dict(target='articles', text='elven dagger',
                               seed=1234, position=257), self.meta)
        with Worker([str(CACHE / 'native')], 'string-native2') as native, \
                Worker(['node', str(HERE / 'port.mjs')], 'string-port2') as port:
            left, right = native.call(state), port.call(state)
        self.assertIsNone(difference(left, right))

    def test_naming_reducer_keeps_a_real_emitted_mutant_counterexample(self):
        state = canonical(dict(target='doname',
            object=dict(otyp='ELVEN_ARROW', quan=5, greased=1, dknown=1,
                        oeroded=2),
            hero=dict(blind=1, role=3), seed=42, position=255,
            discovery=dict(nameKnown=1)), self.meta)
        with Worker([str(CACHE / 'native')], 'name-native') as native, \
                Worker(['node', str(HERE / 'port.mjs')], 'name-mutant',
                       'naming_doname') as port:
            reduced = minimize(state, native, port, self.meta, 'result')
            self.assertEqual(reduced['object']['quan'], 1)
            self.assertEqual(reduced['object']['oeroded'], 0)
            self.assertEqual(reduced['hero']['blind'], 0)
            self.assertEqual(reduced['position'], 0)
            self.assertEqual(reduced['object']['greased'], 1)
            found = difference(native.call(reduced), port.call(reduced))
            self.assertEqual(found['path'], 'result')

    def test_naming_quantity_domain_accepts_potions_but_rejects_stacked_maces(self):
        potions = canonical(dict(target='xname',
            object=dict(otyp='POT_BOOZE', quan=2)), self.meta)
        self.assertEqual(potions['object']['quan'], 2)
        mace = canonical(dict(target='xname', object=dict(otyp='MACE'),
                              discovery=dict(nameKnown=1)), self.meta)
        self.assertEqual(mace['object']['quan'], 1)
        with self.assertRaises(ValueError):
            canonical(dict(target='xname', object=dict(otyp='MACE', quan=2),
                           discovery=dict(nameKnown=1)), self.meta)

    def test_naming_self_test_detects_an_incorrect_quantity_domain(self):
        # An erroneous merge flag admits stacked maces. The self-test must
        # reject this domain before comparing any native and port results.
        meta = deepcopy(self.meta)
        meta['merge'][meta['objects']['MACE']] = 1
        with Worker([str(CACHE / 'native')], 'quantity-native') as native, \
                Worker(['node', str(HERE / 'port.mjs')], 'quantity-port') as port:
            naming_negative_checks(native, port, self.meta)
            with self.assertRaises(RuntimeError):
                naming_negative_checks(native, port, meta)

    def test_naming_xname_observes_through_the_entry_point(self):
        # xname's pairing must rely on objectCombatName's own observation:
        # an unobserved ring shows its appearance, not the unseen noun.
        state = canonical(dict(target='xname', object=dict(otyp='ADORNMENT',
            dknown=0)), self.meta)
        with Worker([str(CACHE / 'native')], 'obs-native') as native, \
                Worker(['node', str(HERE / 'port.mjs')], 'obs-port') as port:
            left, right = native.call(state), port.call(state)
        self.assertIsNone(difference(left, right))
        self.assertNotEqual(left['result'], 'ring')
        self.assertTrue(left['result'].endswith('ring'), left['result'])
        self.assertEqual(left['state']['dknown'], 1)

    def test_naming_container_child_keeps_table_knowledge(self):
        # Root discovery applies to the root type only: a container with an
        # initially-known child stays describable with nameKnown=0 roots.
        state = canonical(dict(target='doname',
            object=dict(otyp='SACK', cknown=1, dknown=1,
                        contents=[dict(otyp='GOLD_PIECE', quan=1)]),
            discovery=dict(nameKnown=0, callName='glork')), self.meta)
        with Worker([str(CACHE / 'native')], 'child-native') as native, \
                Worker(['node', str(HERE / 'port.mjs')], 'child-port') as port:
            left, right = native.call(state), port.call(state)
        self.assertIsNone(difference(left, right))
        self.assertIn('glork', right['result'])

    def test_domain_rejects_nonfood_eating_and_unknown_fields(self):
        for raw in [dict(object=dict(oeaten=1)), dict(hero=dict(str=True)),
                    dict(object=dict(otyp='DAGGER', contents=[{}])),
                    dict(object=dict(otyp='BOULDER', quan=2)), dict(extraField=1)]:
            with self.subTest(input=raw), self.assertRaises(ValueError):
                canonical(raw, self.meta)


if __name__ == '__main__':
    unittest.main()
