"""Repeated solver queries keep their entry domains and isolate temporary facts."""
import time
import unittest
from unittest.mock import patch
import z3

import prove
import queries
from core import Machine, World
from queries import QueryContext, solve
from specs import SPECS


class SolverRetryTests(unittest.TestCase):
    def test_a_tuned_solver_timeout_is_retried_with_the_default_configuration(self):
        x = z3.Int('retry_x')
        with patch('queries._tuned_solver', return_value=(z3.unknown, None)):
            self.assertEqual(solve([x >= 0, x <= 3, x == 5], 60_000)[0], z3.unsat)
            result, solver = solve([x >= 0, x <= 3, x == 2], 60_000)
            self.assertEqual(result, z3.sat)
            self.assertEqual(solver.model()[x], z3.IntVal(2))

    def test_rnl_output_obligations_hold_under_every_solver_seed(self):
        spec = next(s for s in SPECS if s.name == 'rnl')
        recorder = prove.recorder_dir()
        front = prove.CFront(recorder, [recorder / 'src' / file for file in prove.C_FILES]
                             + list((prove.HERE / 'harness').glob('*.c')))
        modules = prove.load_modules()
        # A seed near the default solver's search limit must not turn into a
        # 120-second timeout: every obligation still has to be discharged,
        # quickly, for every seed.
        previous_seed = z3.get_param('smt.random_seed')
        original_solve = prove._solve
        prove._solve = lambda constraints: solve(constraints, 8_000)
        try:
            for seed in range(21):
                with self.subTest(seed=seed):
                    z3.set_param('smt.random_seed', seed)
                    queries._UNSAT.clear()
                    started = time.monotonic()
                    proved, report = prove.check(spec, front, modules, spec.pre)
                    elapsed = time.monotonic() - started
                    self.assertTrue(proved, report)
                    # A fragile layout must cost the probe budget, not a
                    # 120-second timeout: without the second configuration
                    # one obligation stalled here for the full query timeout.
                    self.assertLess(elapsed, 45, f'{elapsed:.1f}s at seed {seed}')
        finally:
            prove._solve = original_solve
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
