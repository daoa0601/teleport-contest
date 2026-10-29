"""Repeated solver queries keep their entry domains and isolate temporary facts."""
import unittest

import z3

from core import Machine, World
from queries import QueryContext


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
