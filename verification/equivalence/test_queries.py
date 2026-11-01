"""Repeated solver queries keep their entry domains and isolate temporary facts."""
import unittest

import z3

import prove
import queries
from core import Machine, World
from queries import QueryContext, solve
from specs import SPECS


class SolverRetryTests(unittest.TestCase):
    def test_a_tuned_solver_timeout_is_answered_by_the_default_configuration(self):
        x, r = z3.Ints('retry_x retry_r')
        unsat_case = [x >= 1, x <= 50, (r % x) >= x]
        sat_case = [x >= 4, x <= 40, (r % x) == 3]
        # The probe budget must make the tuned configuration give up on both
        # propositions for real; otherwise the fallback below would never
        # run and the test would pass vacuously.
        for case in (unsat_case, sat_case):
            tuned = z3.SolverFor('QF_UFLIA')
            tuned.set('timeout', 1)
            tuned.add(z3.simplify(z3.And(*case)))
            self.assertEqual(tuned.check(), z3.unknown,
                             'probe budget no longer forces a tuned give-up')
        self.assertEqual(solve(unsat_case, 60_000, probe_ms=1)[0], z3.unsat)
        result, solver = solve(sat_case, 60_000, probe_ms=1)
        self.assertEqual(result, z3.sat)
        model = solver.model()
        self.assertGreaterEqual(model[x].as_long(), 4)
        self.assertEqual(model[r].as_long() % model[x].as_long(), 3)

    def test_rnl_output_obligations_hold_under_every_solver_seed(self):
        # The pre-change single solver configuration proved rnl or gave up
        # on one obligation depending on the z3 seed and process memory
        # layout: it failed three of three pre-change runs on one machine
        # and twice on Linux CI, while passing elsewhere. This sweep cannot
        # reproduce a fragile layout on demand; it keeps the staged
        # configuration honest by proving the claim for every seed through
        # the production query pipeline, with no speed expectation.
        spec = next(s for s in SPECS if s.name == 'rnl')
        recorder = prove.recorder_dir()
        front = prove.CFront(recorder, [recorder / 'src' / file for file in prove.C_FILES]
                             + list((prove.HERE / 'harness').glob('*.c')))
        modules = prove.load_modules()
        previous_seed = z3.get_param('smt.random_seed')
        try:
            for seed in range(21):
                with self.subTest(seed=seed):
                    z3.set_param('smt.random_seed', seed)
                    queries._UNSAT.clear()
                    proved, report = prove.check(spec, front, modules, spec.pre)
                    self.assertTrue(proved, report)
        finally:
            z3.set_param('smt.random_seed', previous_seed)


class QueryTests(unittest.TestCase):
    def test_temporary_path_conditions_do_not_escape(self):
        x = z3.Int('query_x')
        context = QueryContext([x >= 0, x <= 3])
        self.assertEqual(context.check([x == 1], 5000), z3.sat)
        self.assertEqual(context.check([x == 2], 5000), z3.sat)
        self.assertEqual(context.check([x == 5], 5000), z3.unsat)
        self.assertEqual(context.check([x == 0], 5000), z3.sat)

    def test_unsatisfiable_result_in_one_domain_does_not_prune_another(self):
        x = z3.Int('query_x')
        first = QueryContext([x >= 0, x <= 3])
        second = QueryContext([x >= 4, x <= 7])
        self.assertEqual(first.check([x == 5], 5000), z3.unsat)
        self.assertEqual(second.check([x == 5], 5000), z3.sat)

    def test_machine_queries_follow_changes_to_the_entry_domain(self):
        x = z3.Int('query_x')
        world = World(logging=False, pre=[x == 1], params=[], c_state={}, js_state={}, c_globals={})
        machine = Machine(world, 'c')
        self.assertFalse(machine.feasible([x == 2]))
        world.pre[0] = x == 2
        self.assertTrue(machine.feasible([x == 2]))
        world.pre.append(x != 2)
        self.assertFalse(machine.feasible([]))


if __name__ == '__main__':
    unittest.main()
