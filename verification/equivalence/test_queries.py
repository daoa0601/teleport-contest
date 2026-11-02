"""Repeated solver queries keep their entry domains and isolate temporary facts."""
import unittest

import z3

import prove
import queries
from core import Machine, World
from queries import QueryContext
from specs import SPECS, Spec


class LuckSplitTests(unittest.TestCase):
    FRAGILE_MAGNITUDES = (0, 1, 2, 3, 4, 5, 13)

    def test_rnl_split_queries_hold_under_every_solver_seed(self):
        # The unsplit rnl obligation coupled the luck-dependent rn2 draw
        # modulus with the RND(x) draw, and z3 proved or gave up on that
        # nonlinear query depending on the random seed and process memory
        # layout (CI failed twice before a solver retry and once, at seed
        # 10, through it). specs.luck_partitions fixes the luck-sum
        # magnitude, fixing the luck-dependent rn2 modulus. RND(x) still
        # has symbolic modulus x, so the split queries remain nonlinear.
        # Sweep 21 seeds over seven selected partitions as a regression
        # check, without claiming stability for every partition or seed.
        spec = next(s for s in SPECS if s.name == 'rnl')
        recorder = prove.recorder_dir()
        front = prove.CFront(recorder, [recorder / 'src' / file for file in prove.C_FILES]
                             + list((prove.HERE / 'harness').glob('*.c')))
        modules = prove.load_modules()
        fragile = [entry for index, entry in enumerate(spec.partitions(front))
                   if index in self.FRAGILE_MAGNITUDES]
        split_spec = Spec(spec.name, spec.c, spec.js, spec.params, pre=spec.pre,
                          state=spec.state, partitions=lambda front: fragile,
                          js_file=spec.js_file)
        previous_seed = z3.get_param('smt.random_seed')
        try:
            for seed in range(21):
                with self.subTest(seed=seed):
                    z3.set_param('smt.random_seed', seed)
                    queries._UNSAT.clear()
                    proved, report = prove.check(split_spec, front, modules, split_spec.pre)
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
