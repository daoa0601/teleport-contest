"""Tests of the comparison/reduction boundaries, outside the game test suite."""
from copy import deepcopy
import unittest

from build import CACHE
from model import canonical, metadata
from run import HERE, Worker, difference, minimize


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

    def test_domain_rejects_nonfood_eating_and_unknown_fields(self):
        for raw in [dict(object=dict(oeaten=1)), dict(hero=dict(str=True)),
                    dict(object=dict(otyp='DAGGER', contents=[{}])),
                    dict(object=dict(otyp='BOULDER', quan=2)), dict(extraField=1)]:
            with self.subTest(input=raw), self.assertRaises(ValueError):
                canonical(raw, self.meta)


if __name__ == '__main__':
    unittest.main()
