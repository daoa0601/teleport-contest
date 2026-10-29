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

    def test_real_container_coin_rounding_and_rng(self):
        state = canonical(dict(target='weight', object=dict(otyp='BAG_OF_HOLDING',
            blessed=1, contents=[dict(otyp='GOLD_PIECE', quan=1)])), self.meta)
        with Worker([str(CACHE / 'native')], 'test-native') as native, \
                Worker(['node', str(HERE / 'port.mjs')], 'test-port') as port:
            for result in [native.call(state), port.call(state)]:
                self.assertEqual(result['result'], 16)  # bag 15 + rounded contents 1
                self.assertEqual(result['rng']['core'], 0)
                self.assertEqual(result['rng']['log'], [])

    def test_real_dice_cross_an_isaac_refill(self):
        state = canonical(dict(target='dmgval', object=dict(otyp='TWO_HANDED_SWORD'),
            monster=dict(mnum='giant'), position=255), self.meta)
        with Worker([str(CACHE / 'native')], 'test-native') as native, \
                Worker(['node', str(HERE / 'port.mjs')], 'test-port') as port:
            left, right = native.call(state), port.call(state)
            self.assertIsNone(difference(left, right))
            self.assertEqual(left['rng']['core'], 3)
            self.assertEqual(len(left['rng']['log']), 2)  # rnd + one d(2,6)

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

    def test_compare_reports_the_first_log_entry_with_bounded_output(self):
        left = dict(rng=dict(log=['rnd(6)=1', 'd(2,6)=3']))
        right = deepcopy(left)
        right['rng']['log'][1] = 'd(2,6)=4'
        found = difference(left, right)
        self.assertEqual(found, dict(path='rng.log[1]', native='d(2,6)=3', port='d(2,6)=4'))

    def test_domain_rejects_nonfood_eating_and_unknown_fields(self):
        for raw in [dict(object=dict(oeaten=1)), dict(hero=dict(str=True)),
                    dict(object=dict(otyp='DAGGER', contents=[{}])),
                    dict(object=dict(otyp='BOULDER', quan=2)), dict(extraField=1)]:
            with self.subTest(input=raw), self.assertRaises(ValueError):
                canonical(raw, self.meta)


if __name__ == '__main__':
    unittest.main()
