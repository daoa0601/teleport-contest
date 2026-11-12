"""Repeated solver queries keep their entry domains and isolate temporary facts."""
import unittest

import z3

import prove
import queries
from core import Machine, World
from queries import QueryContext
from specs import SPECS, Spec


class LuckSplitTests(unittest.TestCase):
    def test_rnl_partitions_cover_every_pair_of_signed_luck_fields(self):
        spec = next(s for s in SPECS if s.name == 'rnl')
        symbols = {key: z3.Int(key) for key, _, _ in spec.state}
        solver = z3.Solver()
        solver.add(*(z3.And(value >= -128, value <= 127) for value in symbols.values()))
        domains = [z3.And(*constraints(symbols)) for _, constraints in spec.partitions(None)]
        solver.add(z3.Not(z3.Or(*domains)))
        result = solver.check()
        self.assertEqual(result, z3.unsat,
                         f'uncovered signed luck fields: {solver.model() if result == z3.sat else result}')

    def test_rnl_split_queries_hold_under_every_solver_seed(self):
        # The unsplit rnl obligation coupled the luck-dependent rn2 draw
        # modulus with the RND(x) draw, and z3 proved or gave up on that
        # nonlinear query depending on the random seed and process memory
        # layout (CI failed twice before a solver retry and once, at seed
        # 10, through it). The width-16 split also timed out at magnitudes
        # 128..143 on Linux. Sweep 21 seeds over every partition intersecting
        # the original fragile magnitudes (0..31, 128..143, 256), so refining
        # the split keeps checking the entire region that exposed timeouts.
        spec = next(s for s in SPECS if s.name == 'rnl')
        recorder = prove.recorder_dir()
        front = prove.CFront(recorder, [recorder / 'src' / file for file in prove.C_FILES]
                             + list((prove.HERE / 'harness').glob('*.c')))
        modules = prove.load_modules()
        symbols = {key: z3.Int(key) for key, _, _ in spec.state}
        luck = symbols['u.uluck'] + symbols['u.moreluck']
        magnitude = z3.If(luck >= 0, luck, -luck)
        solver = z3.Solver()
        solver.add(z3.Or(magnitude <= 31, z3.And(magnitude >= 128, magnitude <= 143),
                         magnitude == 256))
        fragile = []
        for entry in spec.partitions(front):
            _, constraints = entry
            solver.push()
            solver.add(*constraints(symbols))
            if solver.check() == z3.sat:
                fragile.append(entry)
            solver.pop()
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
