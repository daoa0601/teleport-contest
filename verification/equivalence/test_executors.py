"""Checks of modeled language behavior, using clang and real JS ASTs.

Run: uv run python -m unittest -v test_executors
These snippets describe language semantics, not copies of game functions.
"""
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

import z3

from cfront import CFront
from csym import CElement, CPtr
from jssym import V, parse_module
from prove import REPO, check, recorder_dir
from core import LoopSpec
from specs import INT, LONG, Spec
from state_world import native_table

GLIBC_ASSERT = '''
    extern void __assert_fail(const char *, const char *, unsigned, const char *)
        __attribute__((noreturn));
    #define assert(e) ((void) sizeof ((e) ? 1 : 0), __extension__ ({ \
        if (e) ; else __assert_fail(#e, __FILE__, __LINE__, __func__); }))
'''


class ExecutorTests(unittest.TestCase):
    def compare(self, c, js, *, params=(), pre=lambda s: [], state=(), modules=None,
                references=(), configure=lambda world, front, modules: None,
                partitions=None, pairwise_outputs=False, restored_state=(), js_initializer=None,
                loops=None):
        with TemporaryDirectory(prefix='fv-language-', dir=REPO / '.cache') as directory:
            c_file = Path(directory) / 'example.c'
            c_file.write_text(c)
            parsed = {}
            for label, source in {'js/example.js': js, **(modules or {})}.items():
                raw = source.encode()
                parsed[label] = (raw, *parse_module(raw))
            spec = Spec('example', 'example', 'example', list(params), pre=pre,
                        state=list(state), js_file='js/example.js',
                        references=list(references), configure=configure, partitions=partitions,
                        restored_state=tuple(restored_state), js_initializer=js_initializer,
                        loops=loops or {})
            return check(spec, CFront(recorder_dir(), [c_file]), parsed, pre,
                         pairwise_outputs=pairwise_outputs)

    def equivalent(self, *args, **kwargs):
        proved, report = self.compare(*args, **kwargs)
        self.assertTrue(proved, report)

    def rejected(self, *args, reason, **kwargs):
        proved, report = self.compare(*args, **kwargs)
        self.assertFalse(proved, report)
        self.assertIn(reason, report)

    def test_boolean_returns_correspond_to_native_zero_and_one(self):
        self.equivalent('int example(int x) { return x > 0; }',
                        'function example(x) { return x > 0; }', params=[('x', INT)])

    def test_number_converts_booleans_to_zero_and_one(self):
        self.equivalent('int example(int x) { return (x > 0) + (x == 1); }',
                        'function example(x) { return Number(x > 0) + Number(x === 1); }',
                        params=[('x', INT)])

    def test_boolean_returns_do_not_hide_a_different_native_integer(self):
        self.rejected('int example(int x) { return x ? 2 : 0; }',
                      'function example(x) { return x !== 0; }', params=[('x', INT)],
                      reason='outputs differ')

    def test_boolean_return_difference_reports_both_values(self):
        proved, report = self.compare('int example(int x) { return x > 0; }',
                                      'function example(x) { return x >= 0; }',
                                      params=[('x', INT)])
        self.assertFalse(proved, report)
        self.assertIn('C : returns 0', report)
        self.assertIn('JS: returns 1', report)

    def test_nullable_string_table_returns_compare_contents(self):
        def strings(world, front, modules):
            world.c_globals['names'] = native_table(world, front, front.files[0], 'names')

        native = 'static const char *names[] = {"first", "second", 0}; ' \
                 'const char *example(int x) { return names[x]; }'
        options = dict(params=[('x', INT)], pre=lambda s: [s['x'] >= 0, s['x'] < 3],
                       configure=strings)
        self.equivalent(native, 'function example(x) { return ["first", "second", null][x]; }',
                        **options)
        self.rejected(native, 'function example(x) { return ["first", "wrong", null][x]; }',
                      reason='outputs differ', **options)
        self.rejected(native, 'function example(x) { return ["first", "second", "third"][x]; }',
                      reason='outputs differ', **options)

    def test_null_string_pointer_differs_from_empty_string(self):
        self.equivalent('const char *example(void) { return 0; }',
                        'function example() { return null; }')
        self.equivalent('const char *example(void) { return ""; }',
                        'function example() { return ""; }')
        self.rejected('const char *example(void) { return ""; }',
                      'function example() { return null; }', reason='outputs differ')
        self.rejected('const char *example(void) { return 0; }',
                      'function example() { return ""; }', reason='outputs differ')

    def test_string_return_does_not_equal_a_numeric_return(self):
        self.rejected('const char *example(void) { return "1"; }',
                      'function example() { return 1; }', reason='outputs differ')

    def test_repeating_a_known_state_value_preserves_read_only_state(self):
        def entry(world, front, modules):
            world.js_values['game.context.flag'] = V('bool', z3.BoolVal(True))

        self.equivalent('int example(int x) { return x; }',
                        'function example(x) { game.context.flag = true; return x; }',
                        params=[('x', INT)], configure=entry)

    def test_changing_a_known_state_value_fails_the_read_only_obligation(self):
        def entry(world, front, modules):
            world.js_values['game.context.flag'] = V('num', z3.IntVal(0))

        self.rejected('int example(int x) { return x; }',
                      'function example(x) { game.context.flag = x; return x; }',
                      params=[('x', INT)], pre=lambda s: [s['x'] >= 0, s['x'] <= 1],
                      configure=entry, reason='JavaScript write changes read-only state')

    def test_unmodeled_state_writes_remain_unsupported(self):
        self.rejected('int example(void) { return 1; }',
                      'function example() { game.flag = true; return 1; }',
                      reason='JavaScript write outside a local binding')

    def test_object_shorthand_captures_the_current_binding_value(self):
        self.equivalent('int example(int x) { return x; }',
                        'function example(x) { const item = {x}; x++; return item.x; }',
                        params=[('x', INT)])

    def test_glibc_assert_is_a_proof_obligation(self):
        source = GLIBC_ASSERT + 'int example(int x) { assert(x > 0); return x; }'
        self.equivalent(source, 'function example(x) { return x; }',
                        params=[('x', INT)], pre=lambda s: [s['x'] > 0])
        proved, report = self.compare(source, 'function example(x) { return x; }', params=[('x', INT)])
        self.assertFalse(proved, report)
        self.assertIn('C assertion failed', report)
        self.assertRegex(report, r'\bx=-?\d+\b')

    def test_apple_assert_is_a_proof_obligation(self):
        source = '''
            extern void __assert_rtn(const char *, const char *, int, const char *)
                __attribute__((noreturn));
            #define assert(e) (__builtin_expect(!(e), 0) \
                ? __assert_rtn(__func__, __FILE__, __LINE__, #e) : (void)0)
            int example(int x) { assert(x > 0); return x; }
        '''
        self.equivalent(source, 'function example(x) { return x; }',
                        params=[('x', INT)], pre=lambda s: [s['x'] > 0])
        self.rejected(source, 'function example(x) { return x; }',
                      params=[('x', INT)], reason='C assertion failed')

    def test_system_assert_is_a_proof_obligation(self):
        source = '#include <assert.h>\nint example(int x) { assert(x > 0); return x; }'
        self.rejected(source, 'function example(x) { return x; }',
                      params=[('x', INT)], reason='C assertion failed')

    def test_assert_condition_runs_once(self):
        source = GLIBC_ASSERT + 'int example(int x) { assert(x++ >= 0); return x; }'
        self.equivalent(source, 'function example(x) { return x + 1; }',
                        params=[('x', INT)], pre=lambda s: [s['x'] >= 0, s['x'] < 10])

    def test_unreached_assert_does_not_fail_a_claim(self):
        source = GLIBC_ASSERT + 'int example(int x) { if (x) assert(x < 0); return x; }'
        self.equivalent(source, 'function example(x) { return x; }',
                        params=[('x', INT)], pre=lambda s: [s['x'] == 0])

    def test_ndebug_assert_does_not_evaluate_its_condition(self):
        source = '#define NDEBUG\n#include <assert.h>\n' \
                 'int example(int x) { assert(++x > 0); return x; }'
        self.equivalent(source, 'function example(x) { return x; }', params=[('x', INT)])

    def test_other_statement_expressions_remain_unsupported(self):
        sources = ['int example(int x) { return __extension__ ({ x + 1; }); }',
                   GLIBC_ASSERT + 'int example(int x) { return __extension__ ({ '
                   'if (x > 0) ; else __assert_fail("x", "test", 1, "example"); x; }); }']
        for source in sources:
            with self.subTest(source=source):
                self.rejected(source, 'function example(x) { return x; }',
                              params=[('x', INT)], reason='C expression StmtExpr')

    def test_pairwise_output_queries_cover_later_partitions_and_every_branch(self):
        native = 'int example(int band, int x) { return x < 0 ? band + 1 : band; }'
        options = dict(params=[('band', INT), ('x', INT)],
                       pre=lambda s: [s['x'] >= -3, s['x'] <= 3],
                       partitions=lambda front: [('first', {'band': 0}), ('last', {'band': 2})],
                       pairwise_outputs=True)
        self.equivalent(native, 'function example(band, x) { return x < 0 ? band + 1 : band; }',
                        **options)
        self.rejected(native, 'function example(band, x) { '
                      'return x < 0 ? band + 1 : band + (band === 2 ? 1 : 0); }',
                      reason='last: outputs differ', **options)

    def test_every_declared_partition_needs_a_satisfiable_domain(self):
        native = 'int example(int species) { return species; }'
        port = 'function example(species) { return species; }'
        options = dict(params=[('species', INT)], partitions=lambda front: [
            ('first species', {'species': 0}), ('last species', {'species': 1})])
        self.equivalent(native, port, **options)

        def exclude_last_species(world, front, modules):
            species = next(value for name, value, _ in world.params if name == 'species')
            world.pre.append(species == 0)

        for restriction in (
            dict(pre=lambda s: [s['species'] == 0]),
            dict(configure=exclude_last_species),
        ):
            with self.subTest(restriction=next(iter(restriction))):
                proved, report = self.compare(native, port, **options, **restriction)
                self.assertFalse(proved, report)

    def test_nested_state_and_hero_attribute_arrays(self):
        self.equivalent(
            'struct { struct { int a[2]; } attr; } u; '
            'struct { int option; } flags; struct { struct { int moving; } context; } svc; '
            'int example(int i) { return u.attr.a[i] + flags.option + svc.context.moving; }',
            'function example(i) { const hero = game.u; '
            'return hero.attr.a[i] + game.flags.option + game.context.moving; }',
            params=[('i', INT)], pre=lambda s: [s['i'] >= 0, s['i'] < 2,
                                              s['flags.option'] == 1, s['svc.context.moving'] == 0,
                                              s['u.attr.a[0]'] < 100, s['u.attr.a[1]'] < 100],
            state=[('u.attr.a[0]', INT, 'game.u.attr.a[0]'), ('u.attr.a[1]', INT, 'game.u.attr.a[1]'),
                   ('flags.option', INT, 'game.flags.option'),
                   ('svc.context.moving', INT, 'game.context.moving')])

    def test_constant_tables_and_implicit_enumerators(self):
        self.equivalent(
            'enum direction { north = 7, east, south }; static const int values[3] = { north, east, south }; '
            'int example(int i) { return values[i]; }',
            'const values = [7, 8, 9]; function example(i) { return values[i]; }',
            params=[('i', INT)], pre=lambda s: [s['i'] >= 0, s['i'] < 3])

    def test_multidimensional_c_table_and_local_js_table(self):
        self.equivalent('int example(int i) { static const short v[2][2] = {{2, 4}, {6, 8}}; return v[i][1]; }',
                        'function example(i) { const v = [4, 8]; return v[i]; }',
                        params=[('i', INT)], pre=lambda s: [s['i'] >= 0, s['i'] < 2])

    def test_table_bounds_obligation(self):
        self.rejected('int example(int i) { static const int v[2] = {7, 9}; return v[i]; }',
                      'function example(i) { return [7, 9][i]; }', params=[('i', INT)],
                      pre=lambda s: [s['i'] == 2], reason='array index outside')

    def test_switch_fallthrough_default_in_middle_and_early_return(self):
        self.equivalent(
            'int example(int x) { int r = 0; switch (x) { case 1: case 2: r = 3; break; '
            'default: r = 5; case 4: r += 7; break; case 9: return 11; } return r; }',
            'function example(x) { let r = 0; switch (x) { case 1: case 2: r = 3; break; '
            'default: r = 5; case 4: r += 7; break; case 9: return 11; } return r; }', params=[('x', INT)])

    def test_break_targets_innermost_switch_or_loop(self):
        self.equivalent(
            'int example(int x) { int r = 0; while (x > 0) { switch (x) { '
            'case 2: r = 7; break; default: r = 3; } break; } return r; }',
            'function example(x) { let r = 0; while (x > 0) { switch (x) { '
            'case 2: r = 7; break; default: r = 3; } break; } return r; }', params=[('x', INT)])

    def test_reachable_minimum_divided_by_minus_one_is_rejected(self):
        self.rejected('int example(int x, int y) { return x / y; }',
                      'function example(x, y) { return Math.trunc(x / y); }',
                      params=[('x', INT), ('y', INT)],
                      pre=lambda s: [s['x'] == -(2 ** 31), s['y'] == -1],
                      reason='C signed overflow in /')

    def test_reachable_minimum_remainder_by_minus_one_is_rejected(self):
        self.rejected('int example(int x, int y) { return x % y; }',
                      'function example(x, y) { return x % y; }',
                      params=[('x', INT), ('y', INT)],
                      pre=lambda s: [s['x'] == -(2 ** 31), s['y'] == -1],
                      reason='C signed overflow in %')

    def test_overflow_before_division_is_not_hidden_by_a_fitting_quotient(self):
        self.rejected('int example(int x) { return (x + 1) / 2; }',
                      'function example(x) { return Math.trunc((x + 1) / 2); }',
                      params=[('x', INT)], pre=lambda s: [s['x'] == 2 ** 31 - 1],
                      reason='C signed overflow in +')

    def test_positive_composite_divisor_preserves_truncation_towards_zero(self):
        self.equivalent('long example(int x, int y, long n) { '
                        'long divisor = (1000L + x) * y; return n / divisor; }',
                        'function example(x, y, n) { return Math.trunc(n / ((1000 + x) * y)); }',
                        params=[('x', INT), ('y', INT), ('n', LONG)],
                        pre=lambda s: [s['x'] >= 0, s['x'] <= 999, s['y'] >= 1, s['y'] <= 10,
                                       s['n'] >= -(2 ** 40), s['n'] <= 2 ** 40])

    def test_long_to_int_return_narrows_where_javascript_preserves_the_number(self):
        self.rejected('int example(long x) { return x; }',
                      'function example(x) { return x; }', params=[('x', LONG)],
                      pre=lambda s: [s['x'] == 2 ** 31], reason='outputs differ')

    def test_signed_bit_operations_and_right_shift(self):
        self.equivalent('int example(int x) { return ((x & 255) | 16) ^ ((~x) >> 3); }',
                        'function example(x) { return ((x & 255) | 16) ^ ((~x) >> 3); }', params=[('x', INT)])

    def test_unsigned_c_shift_matches_js_unsigned_shift(self):
        self.equivalent('unsigned example(unsigned x) { return x >> 3; }',
                        'function example(x) { return x >>> 3; }', params=[('x', (32, False))])

    def test_js_shift_count_mask_does_not_satisfy_c_shift_domain(self):
        self.rejected('int example(int x) { return 1 << x; }',
                      'function example(x) { return 1 << x; }', params=[('x', INT)],
                      pre=lambda s: [s['x'] == 32], reason='C shift count outside type width')

    def test_compound_shift_does_not_narrow_a_wide_c_count(self):
        self.rejected('int example(long x) { unsigned r = 1; r <<= x; return r; }',
                      'function example(x) { let r = 1; r <<= x; return r; }', params=[('x', LONG)],
                      pre=lambda s: [s['x'] == 2 ** 32], reason='C shift count outside type width')

    def test_narrow_c_increment_promotes_before_conversion_back(self):
        self.equivalent('int example(signed char x) { ++x; return x; }',
                        'function example(x) { return x === 127 ? -128 : x + 1; }', params=[('x', (8, True))])

    def test_signed_left_shift_requires_nonnegative_representable_result(self):
        for value in (-1, 2 ** 30):
            with self.subTest(value=value):
                self.rejected('int example(int x) { return x << 1; }',
                              'function example(x) { return x << 1; }', params=[('x', INT)],
                              pre=lambda s: [s['x'] == value], reason='C signed left shift')

    def test_js_int32_coercion_differs_from_c_long(self):
        self.rejected('long example(long x) { return x | 0L; }',
                      'function example(x) { return x | 0; }', params=[('x', LONG)],
                      pre=lambda s: [s['x'] == 2 ** 32], reason='outputs differ')

    def test_ternary_and_safe_power_of_two(self):
        self.equivalent('long example(int x) { return x ? (1L << x) : 0; }',
                        'function example(x) { return x ? 2 ** x : 0; }',
                        params=[('x', INT)], pre=lambda s: [s['x'] >= 0, s['x'] <= 30])

    def test_number_input_must_be_in_exact_integer_range(self):
        self.rejected('long example(long x) { return x; }', 'function example(x) { return x; }',
                      params=[('x', LONG)], pre=lambda s: [s['x'] == 2 ** 53 + 1], reason='JavaScript input leaves')

    def test_defaults_array_binding_and_optional_access(self):
        self.equivalent('int example(int x) { return x + 3; }',
                        'function example(x, state = game) { const [low, high] = [1, 2]; '
                        'return state?.u ? x + low + high : 0; }', params=[('x', INT)],
                        pre=lambda s: [s['x'] < 100])

    def test_imports_resolve_in_defining_module(self):
        self.equivalent('int example(int x) { return x + 3; }',
                        "import { helper as add } from './helper.js'; function helper(x) { return x + 9; } "
                        'function example(x) { return add(x); }', params=[('x', INT)],
                        pre=lambda s: [s['x'] < 100],
                        modules={'js/helper.js': 'const amount = 3; export function helper(x) { return x + amount; }'})

    def test_module_state_snapshot_is_not_treated_as_current_state(self):
        self.rejected('struct { int value; } u; int example(void) { return u.value; }',
                      'const snapshot = game.u.value; function example() { return snapshot; }',
                      state=[('u.value', INT, 'game.u.value')], reason='is not constant data')

    def test_global_state_writes_are_tracked_and_restored(self):
        # Writes to declared global state keys are modeled per path, and
        # restored_state can require them to equal their entry values at exit.
        c = ('struct { int value; } u; '
             'int example(void) { int save = u.value; u.value = save + 3; u.value = save; return u.value; }')
        js = 'function example() { return game.u.value; }'
        self.equivalent(c, js, state=[('u.value', INT, 'game.u.value')],
                        restored_state=('u.value',),
                        pre=lambda s: [s['u.value'] >= 0, s['u.value'] <= 9])
        broken = ('struct { int value; } u; '
                  'int example(void) { int save = u.value; u.value = save + 3; return u.value; }')
        self.rejected(broken, js, state=[('u.value', INT, 'game.u.value')],
                      restored_state=('u.value',),
                      pre=lambda s: [s['u.value'] >= 0, s['u.value'] <= 9],
                      reason='final u.value differs from its entry value')

    def test_global_writes_outside_declared_state_are_rejected(self):
        self.rejected('struct { int value; } u; int example(void) { u.value = 3; return 3; }',
                      'function example() { return 3; }',
                      reason='C write to unmodeled global')

    def test_uninitialized_c_read_is_rejected(self):
        self.rejected('int example(void) { int value; return value; }',
                      'function example() { return 0; }', reason='uninitialized local')

    def test_math_trunc_cannot_accept_a_bigint(self):
        self.rejected('int example(void) { return 2; }',
                      'function example() { return Number(Math.trunc(BigInt(5) / BigInt(2))); }',
                      reason='Math.trunc division needs Number operands')

    def test_static_c_locals_and_js_temporal_shadowing_are_rejected(self):
        self.rejected('int example(void) { static int value = 3; return value; }',
                      'function example() { return 3; }', reason='C static local')
        self.rejected('int example(void) { return 3; }',
                      'const value = 3; function example() { return value; const value = 4; }',
                      reason='read before declaration')

    def test_closed_c_scope_does_not_supply_a_later_global_read(self):
        self.rejected('int value; int example(void) { { int value = 3; } return value; }',
                      'function example() { return 3; }', reason='unmodeled C global value')

    def test_array_holes_and_mutable_c_arrays_are_rejected(self):
        self.rejected('int example(void) { int v[2] = {1, 2}; return v[0]; }',
                      'function example() { return [1, 2][0]; }', reason='mutable C array')
        self.rejected('int example(void) { return 2; }',
                      'function example() { return [, 2][1]; }', reason='JavaScript array holes')
        self.rejected('int example(void) { return 0; }',
                      'function example() { return [,].length; }', reason='JavaScript array holes')

    def test_nullable_pointer_reads_and_shared_js_slot_aliases(self):
        self.equivalent(
            'struct item { short value; }; struct item *worn; '
            'int example(void) { return worn ? worn->value : 0; }',
            "function example() { const item = game.worn || game.u.worn; return item?.value ?? 0; }",
            state=[('worn.value', (16, True), 'game.worn.value')],
            references=[('worn', ('game.worn', 'game.u.worn'))])

    def test_null_pointer_dereference_is_an_obligation(self):
        self.rejected(
            'struct item { int value; }; struct item *worn; '
            'int example(void) { return worn->value; }',
            'function example() { return game.worn?.value ?? 0; }',
            state=[('worn.value', INT, 'game.worn.value')],
            references=[('worn', ('game.worn',))], reason='C null pointer dereference')

    def test_pointer_fields_require_an_explicit_pointer_model(self):
        for declaration, pointer in (
            ('struct item *worn;', 'worn'),
            ('struct holder { struct item *worn; } hero;', 'hero.worn'),
        ):
            with self.subTest(pointer=pointer):
                proved, report = self.compare(
                    'struct item { int value; }; ' + declaration
                    + f'int example(void) {{ return {pointer}->value; }}',
                    'function example() { return game.worn.value; }',
                    state=[(pointer + '.value', INT, 'game.worn.value')])
                self.assertFalse(proved, report)

    def test_record_table_fields_and_nested_attack_arrays(self):
        self.equivalent(
            'struct attack { unsigned char damage; }; '
            'struct species { short speed; struct attack attacks[2]; }; '
            'static const struct species table[2] = {{3, {{2}, {5}}}, {7, {{11}, {13}}}}; '
            'int example(int i, int a) { return table[i].speed + table[i].attacks[a].damage; }',
            'const speed = [3, 7]; const attacks = [[2, 5], [11, 13]]; '
            'function example(i, a) { return speed[i] + attacks[i][a]; }',
            params=[('i', INT), ('a', INT)],
            pre=lambda s: [s['i'] >= 0, s['i'] < 2, s['a'] >= 0, s['a'] < 2])

    def test_c_for_update_and_break(self):
        self.equivalent(
            'int example(int stop) { int i, sum = 0; for (i = 0; i < 4; ++i) '
            '{ if (i == stop) break; sum += i; } return sum; }',
            'function example(stop) { let sum = 0; for (let i = 0; i < 4; ++i) '
            '{ if (i === stop) break; sum += i; } return sum; }', params=[('stop', INT)])

    def test_object_options_and_array_defaults(self):
        self.equivalent(
            'int example(void) { return 11; }',
            'function add({ value = 3, bonus = 8 } = {}) { '
            'const [a = 99, b = 8] = [value]; return a + b; } '
            'function example() { return add({value: 3}); }')

    def test_finite_map_get_and_missing_key(self):
        from jssym import V
        import z3

        def configure(world, front, modules):
            key = V('num', z3.IntVal(2))
            item = V('record', {'value': V('num', z3.IntVal(7))})
            world.js_values['game.items'] = V('map', ((key, item),))
        self.equivalent('int example(int id) { return id == 2 ? 7 : 0; }',
                        'function example(id) { return game.items instanceof Map '
                        '? (game.items.get(id)?.value ?? 0) : 99; }',
                        params=[('id', INT)], configure=configure)

    def test_cross_module_map_lookup_feeds_an_optional_member_chain(self):
        # mondata.js:canTrack's shape: an imported artifact.js helper reads
        # the per-game runtime Map, and the caller compares the nullish
        # chained member while a second imported helper runs the fallback.
        from jssym import V
        import z3

        c = ('struct { int oartifact; } uwep; '
             'int eyes(int x) { return x > 0; } '
             'int example(int x) { if (uwep.oartifact == 1) return 1; '
             'return eyes(x); }')
        js = ("import { byId } from './arts.js';\n"
              "import { eyes } from './body.js';\n"
              'function example(x) {\n'
              '  const a = byId(game.uwep.oartifact, game);\n'
              "  return a?.name === 'Excalibur' ? 1 : eyes(x);\n"
              '}')
        modules = {
            'js/arts.js': 'export function byId(id, state) {\n'
                          '  if (id == null) return null;\n'
                          '  return state.runtime.get(id) || null;\n'
                          '}',
            'js/body.js': 'export function eyes(x) { return x > 0; }',
        }

        def configure(world, front, modules):
            key = V('num', z3.IntVal(1))
            item = V('record', {'name': V('str', 'Excalibur')})
            world.js_values['game.runtime'] = V('map', ((key, item),))

        state = [('uwep.oartifact', INT, 'game.uwep.oartifact')]
        self.equivalent(c, js, params=[('x', INT)], state=state,
                        modules=modules, configure=configure)
        self.rejected(c, js.replace("'Excalibur'", "'Stormbringer'"),
                      params=[('x', INT)], state=state, modules=modules,
                      configure=configure, reason='outputs differ')

    def test_integer_division_rejects_fractional_number_results(self):
        self.equivalent('int example(void) { return 36 / 2; }',
                        'function example() { return 36 / 2; }')
        self.rejected('int example(void) { return 3 / 2; }',
                      'function example() { return 3 / 2; }', reason='not an integer')

    def test_state_number_read_must_be_representable(self):
        self.rejected('struct { long value; } state; long example(void) { return state.value; }',
                      'function example() { return game.value; }',
                      state=[('state.value', LONG, 'game.value')],
                      pre=lambda s: [s['state.value'] == 2 ** 53 + 1], reason='state read leaves')

    def test_pointer_identity_distinguishes_missing_same_and_other_object(self):
        import z3
        from csym import CPtr
        from jssym import V

        def configure(world, front, modules):
            values = {name: value for name, value, _ in world.params}
            same, present = values['same'] != 0, values['present'] != 0
            world.c_globals['first'] = CPtr(True, 'first', z3.IntVal(1))
            world.c_globals['second'] = CPtr(present, 'second', z3.If(same, 1, 2))
            world.js_values['game.first'] = V('obj', 'first')
            world.js_values['game.second'] = V('choice', [
                (same, V('obj', 'first')),
                (z3.And(present, z3.Not(same)), V('obj', 'second')),
                (z3.Not(present), V('null'))])
        self.equivalent(
            'struct item { int value; }; struct item *first, *second; '
            'int example(int same, int present) { return first == second; }',
            'function example(same, present) { return game.first === game.second ? 1 : 0; }',
            params=[('same', INT), ('present', INT)], configure=configure,
            pre=lambda s: [s['same'] >= 0, s['same'] <= s['present'], s['present'] <= 1])

    def test_fixed_member_array_pointer_scan_matches_some_callback(self):
        c = ('struct attack { int aatyp; int adtyp; };'
             'struct permonst { struct attack mattk[4]; };'
             'const struct permonst table[1] = { { { {1, 0}, {2, 7}, {0, 0}, {0, 0} } } };'
             'int example(int atyp) {'
             '  const struct permonst *ptr = &table[0];'
             '  struct attack *a;'
             '  for (a = &ptr->mattk[0]; a < &ptr->mattk[4]; a++)'
             '    if (a->aatyp == atyp && a->adtyp == 7) return 1;'
             '  return 0; }')
        js = ('function example(atyp) {'
              '  return [[1, 0], [2, 7], [0, 0], [0, 0]].some(([a, d]) => a === atyp && d === 7) ? 1 : 0; }')
        self.equivalent(c, js, params=[('atyp', INT)],
                        pre=lambda s: [s['atyp'] >= 0, s['atyp'] <= 9])
        self.rejected(c, js.replace('d === 7', 'd === 8'), params=[('atyp', INT)],
                      pre=lambda s: [s['atyp'] >= 0, s['atyp'] <= 9], reason='outputs differ')

    def test_fixed_member_array_pointer_deref_bounds_are_obligations(self):
        c = ('struct attack { int aatyp; };'
             'struct permonst { struct attack mattk[2]; };'
             'const struct permonst table[1] = { { { {1}, {2} } } };'
             'int example(int atyp) {'
             '  const struct permonst *ptr = &table[0];'
             '  struct attack *a;'
             '  for (a = &ptr->mattk[0]; a < &ptr->mattk[3]; a++)'
             '    if (a->aatyp == atyp) return 1;'
             '  return 0; }')
        self.rejected(c, 'function example(atyp) { return atyp > 0 ? 1 : 0; }',
                      params=[('atyp', INT)], reason='array index outside')

    def test_array_some_short_circuit_matches_c_scan_effects(self):
        """The callback runs only while earlier elements were false, so a
        draw inside it consumes stream positions exactly like C's scan."""
        c = ('extern unsigned long long isaac64_next_uint64(void *);'
             'struct { long rng_state; } rnglist[1];'
             'int example(int a, int b) {'
             '  if (a % 2 == (int) (isaac64_next_uint64(&rnglist[0].rng_state) % 2u)) return 1;'
             '  if (b % 2 == (int) (isaac64_next_uint64(&rnglist[0].rng_state) % 2u)) return 1;'
             '  return 0; }')
        js = ('function example(a, b) {'
              '  return [a, b].some(x => x % 2 === Number(isaac64_next_uint64(game.coreCtx) % 2n)) ? 1 : 0; }')
        pre = lambda s: [s['a'] >= 0, s['a'] <= 3, s['b'] >= 0, s['b'] <= 3]
        self.equivalent(c, js, params=[('a', INT), ('b', INT)], pre=pre)

    def test_array_pattern_hole_binds_the_later_element_only(self):
        c = ('int example(int x, int y) {'
             '  if (x > 0) return 1;'
             '  if (y > 0) return 1;'
             '  return 0; }')
        js = ('function example(x, y) {'
              '  return [[0, x], [0, y]].some(([, second]) => second > 0) ? 1 : 0; }')
        pre = lambda s: [s['x'] >= 0, s['x'] <= 3, s['y'] >= 0, s['y'] <= 3]
        self.equivalent(c, js, params=[('x', INT), ('y', INT)], pre=pre)
        self.rejected(c, js.replace('([, second]) => second > 0', '([first]) => first > 0'),
                      params=[('x', INT), ('y', INT)], pre=pre, reason='outputs differ')


    def test_object_keys_set_has_reduce_and_record_subscript(self):
        js_modules = {'js/records.js': (
            'export const WORN_SLOTS = new Set([2, 4]);\n'
            'export function wornNonBoot(sources) {\n'
            '  return sources.some(source => WORN_SLOTS.has(source.slot));\n'
            '}\n'
            'export function hasIntrinsic(record) {\n'
            '  return Object.keys(record.intrinsic).length > 0;\n'
            '}\n'
            'export function timeoutOf(hero, fields) {\n'
            '  return (hero[fields.levitation] ?? 0) > 0;\n'
            '}\n'
            'export function totalWeight(items) {\n'
            '  return items.reduce((total, item) => total + item.w, 0);\n'
            '}\n')}

        # Object.keys over a nonempty and an empty record.
        self.equivalent(
            'int example(void) { return 1; }',
            'import { hasIntrinsic } from "./records.js";\n'
            'function example() { return hasIntrinsic({ intrinsic: { role: 1 } }) ? 1 : 0; }',
            modules=js_modules)
        self.equivalent(
            'int example(void) { return 0; }',
            'import { hasIntrinsic } from "./records.js";\n'
            'function example() { return hasIntrinsic({ intrinsic: {} }) ? 1 : 0; }',
            modules=js_modules)
        # Set.has over a literal member set.
        self.equivalent(
            'int example(int slot) { return slot == 2 || slot == 4; }',
            'import { wornNonBoot } from "./records.js";\n'
            'function example(slot) { return wornNonBoot([{ slot: slot }, { slot: 9 }]) ? 1 : 0; }',
            params=[('slot', INT)], modules=js_modules,
            pre=lambda s: [s['slot'] >= 0, s['slot'] <= 9])
        # reduce threads the accumulator through every element.
        self.equivalent(
            'int example(int a, int b, int c) { return a + b + c; }',
            'import { totalWeight } from "./records.js";\n'
            'function example(a, b, c) { return totalWeight([{ w: a }, { w: b }, { w: c }]); }',
            params=[('a', INT), ('b', INT), ('c', INT)], modules=js_modules,
            pre=lambda s: [s['a'] >= 0, s['b'] >= 0, s['c'] >= 0,
                           s['a'] + s['b'] + s['c'] <= 100])
        # A subscript on a record by a string key picks the field.
        self.equivalent(
            'int example(int turns) { return turns > 0; }',
            'import { timeoutOf } from "./records.js";\n'
            'const FIELDS = { levitation: "levitationTurns" };\n'
            'function example(turns) { return timeoutOf({ levitationTurns: turns }, FIELDS) ? 1 : 0; }',
            params=[('turns', INT)], modules=js_modules,
            pre=lambda s: [s['turns'] >= 0, s['turns'] <= 9])

    def test_callback_parameters_do_not_overwrite_enclosing_bindings(self):
        self.equivalent(
            'int example(int x) { return x; }',
            'function example(x) { [1, 2].some(x => x > 0); return x; }',
            params=[('x', INT)])
        self.equivalent(
            'int example(int x) { return x; }',
            'function example(x) { [1, 2].reduce((x, item) => x + item, 0); return x; }',
            params=[('x', INT)])

    def test_some_receives_the_element_index_and_array(self):
        self.equivalent(
            'int example(int x) { return x == 0 || x == 1; }',
            'function example(x) { return [9, 9].some((item, index, items) => index === x && items[index] === item); }',
            params=[('x', INT)])

    def test_equal_contents_do_not_make_distinct_arrays_alias(self):
        self.equivalent(
            'struct holder { int slots[1]; };'
            'const struct holder table[2] = { { {7} }, { {7} } };'
            'int example(void) {'
            '  const struct holder *a = &table[0], *b = &table[1];'
            '  return &a->slots[0] == &b->slots[0]; }',
            'function example() { return 0; }')

    def test_pointer_formation_is_bounded_even_without_a_dereference(self):
        self.rejected(
            'struct holder { int slots[2]; };'
            'const struct holder table[1] = { { {7, 8} } };'
            'int example(void) { const struct holder *p = &table[0];'
            '  int *beyond = &p->slots[3]; return 0; }',
            'function example() { return 0; }', reason='pointer outside fixed array')

    def test_saved_mask_restoration_is_checked_with_an_unchanged_return(self):
        c = ('struct { long mask; } u; int example(int flag) {'
             'long saved = u.mask; if (flag) u.mask &= ~32L;'
             'u.mask = saved; return 0; }')
        js = 'function example(flag) { return 0; }'
        def configure(world, front, modules):
            world.join_paths = True
        options = dict(params=[('flag', INT)], state=[('u.mask', LONG, None)],
                       pre=lambda s: [s['u.mask'] >= 0, s['u.mask'] <= 63],
                       configure=configure, restored_state=('u.mask',))
        self.equivalent(c, js, **options)
        self.rejected(c.replace('u.mask = saved;', ''), js, **options,
                      reason='final u.mask differs from its entry value')

    def test_joining_preserves_branch_values_and_overflow_obligations(self):
        def configure(world, front, modules):
            world.join_paths = True
        self.equivalent(
            'int example(int x) { int value; if (x > 0) value = 3; else value = 5; return value; }',
            'function example(x) { return x > 0 ? 3 : 5; }',
            params=[('x', INT)], configure=configure)
        self.rejected(
            'int example(int x) { int value; if (x > 0) value = 2147483647; else value = 5; return value + 1; }',
            'function example(x) { return x > 0 ? 2147483648 : 6; }',
            params=[('x', INT)], configure=configure, reason='C signed overflow in +')

    def test_indexof_keeps_the_first_matching_position(self):
        self.equivalent(
            'int example(int x) { return x == 7 ? 0 : x == 3 ? 1 : -1; }',
            'function example(x) { return [7, 3, 7].indexOf(x); }',
            params=[('x', INT)])

    def test_findindex_short_circuits_like_a_c_scan(self):
        self.equivalent(
            'int example(int x, int y) {'
            '  int i; for (i = 0; i < 4; i++) if (x == i - 1 && y == i) return i;'
            '  return -1; }',
            'const xs = [-1, 0, 1, 2]; const ys = [0, 1, 2, 3];'
            'function example(x, y) { return xs.findIndex((x0, index) => x0 === x && ys[index] === y); }',
            params=[('x', INT), ('y', INT)])
        self.rejected(
            'int example(int x) { return x == 1 ? 0 : x == 2 ? 2 : -1; }',
            'function example(x) { return [1, 9, 2, 2].findIndex(v => v === x); }',
            params=[('x', INT)], reason='outputs differ')

    def test_find_returns_the_first_matching_element(self):
        self.equivalent(
            'int example(int x) {'
            '  int i, v; for (i = 0; i < 4; i++) { v = (i == 1 || i == 3) ? 9 : 3;'
            '    if (v == x) return v + 1; }'
            '  return 0; }',
            'const vs = [3, 9, 3, 9];'
            'function example(x) { return (vs.find(v => v === x) ?? -1) + 1; }',
            params=[('x', INT)])
        self.rejected(
            'int example(int x) { return x == 9 ? 9 : 0; }',
            'const vs = [3, 9, 3, 9];'
            'function example(x) { return vs.find(v => v === x) ?? 0; }',
            params=[('x', INT)], reason='outputs differ')

    def test_c_continue_jumps_to_the_for_update(self):
        self.equivalent(
            'int example(int x) {'
            '  int i, s = 0; for (i = 0; i < 6; i++) {'
            '    if (i == x) continue; s += i; }'
            '  return s; }',
            'function example(x) {'
            '  let s = 0;'
            '  for (let i = 0; i < 6; i++) {'
            '    if (i === x) continue; s += i; }'
            '  return s; }',
            params=[('x', INT)])
        self.rejected(
            'int example(int x) {'
            '  int i, s = 0; for (i = 0; i < 6; i++) {'
            '    if (i == x) continue; s += i; }'
            '  return s; }',
            'function example(x) {'
            '  let s = 0;'
            '  for (let i = 0; i < 6; i++) { if (i === x) continue; s += i + 1; }'
            '  return s; }',
            params=[('x', INT)], reason='outputs differ')

    def test_joined_continue_paths_keep_their_own_control_states(self):
        from jssym import V
        def configure(world, front, modules):
            world.join_paths = True
            world.js_values['game.rows'] = V('array', tuple(
                V('num', world.params[0][1] + i) for i in range(4)))
        # Without separating continued paths at join points, the skip arm can
        # merge into the processing arm and fold to the wrong total.
        self.equivalent(
            'int example(int x) {'
            '  int i, v, s = 0;'
            '  for (i = 0; i < 4; i++) { v = x + i; if (v == x) continue; s += v; }'
            '  return s; }',
            'function example(x) {'
            '  let s = 0;'
            '  for (let i = 0; i < game.rows.length; i++) {'
            '    if (game.rows[i] === x) continue; s += game.rows[i]; }'
            '  return s; }',
            params=[('x', INT)],
            pre=lambda s: [s['x'] >= -10, s['x'] <= 10], configure=configure)

    def test_c_enum_type_switch_is_int_compatible(self):
        self.equivalent(
            'enum monnums { PM_ANT, PM_BEE, PM_WASP };'
            'int example(int x) { enum monnums m = (enum monnums) x;'
            '  switch (m) { case PM_BEE: return 2; case PM_WASP: return 3;'
            '    default: break; } return 0; }',
            'const PM_ANT = 0, PM_BEE = 1, PM_WASP = 2;'
            'function example(x) { switch (x) { case PM_BEE: return 2;'
            '  case PM_WASP: return 3; default: break; } return 0; }',
            params=[('x', INT)])
        self.rejected(
            'enum monnums { PM_ANT, PM_BEE, PM_WASP };'
            'int example(int x) { enum monnums m = (enum monnums) x;'
            '  switch (m) { case PM_BEE: return 2; default: break; } return 0; }',
            'const PM_BEE = 1;'
            'function example(x) { switch (x) { case PM_BEE: return 3; default: break; }'
            '  return 0; }',
            params=[('x', INT)], reason='outputs differ')


    def test_js_for_ever_loop_runs_until_break(self):
        self.equivalent(
            'int example(int x) { int i = 0; for (;;) { if (i == x) return i; i++; } }',
            'function example(x) { let i = 0; for (;;) { if (i === x) return i; i++; } }',
            params=[('x', INT)], pre=lambda s: [s['x'] >= 0, s['x'] < 12])

    def test_module_initializer_with_calls_resolves_one_definite_value(self):
        self.equivalent(
            'int example(int x) { return x + 3; }',
            'const base = [3, 9]; const OFF = pick(0);'
            'function pick(i) { return base[i] ?? 0; }'
            'function example(x) { return x + OFF; }',
            params=[('x', INT)], pre=lambda s: [s['x'] >= -10, s['x'] <= 10])

    def test_continue_inside_a_switch_continues_the_enclosing_loop(self):
        self.equivalent(
            'int example(int x) {'
            '  int i, s = 0;'
            '  for (i = 0; i < 3; i++) {'
            '    switch (i) { case 1: continue; default: break; } s++; }'
            '  return s; }',
            'function example(x) {'
            '  let s = 0;'
            '  for (let i = 0; i < 3; i++) {'
            '    switch (i) { case 1: continue; default: break; } s++; }'
            '  return s; }',
            params=[('x', INT)])
        self.rejected(
            'int example(int x) {'
            '  int i, s = 0;'
            '  for (i = 0; i < 3; i++) {'
            '    switch (i) { case 1: continue; default: break; } s++; }'
            '  return s; }',
            'function example(x) {'
            '  let s = 0;'
            '  for (let i = 0; i < 3; i++) {'
            '    switch (i) { case 1: break; default: break; } s++; }'
            '  return s; }',
            params=[('x', INT)], reason='outputs differ')

    def test_c_enum_compatible_type_is_clangs_choice(self):
        # All-nonnegative enumerators make clang pick unsigned int, so
        # (enum monnums)-1 converts to 4294967295, not -1.
        self.equivalent(
            'enum monnums { PM_ANT, PM_BEE, PM_WASP };'
            'int example(int x) { enum monnums m = (enum monnums) x;'
            '  return (long) m > 0; }',
            'function example(x) { return (x >>> 0) > 0 ? 1 : 0; }',
            params=[('x', INT)])
        # A negative enumerator keeps the signed int compatible type.
        self.equivalent(
            'enum negs { N_A = -5, N_B };'
            'int example(int x) { enum negs m = (enum negs) x; return (long) m > 0; }',
            'function example(x) { return x > 0 ? 1 : 0; }',
            params=[('x', INT)])
        self.rejected(
            'enum monnums { PM_ANT, PM_BEE, PM_WASP };'
            'int example(int x) { enum monnums m = (enum monnums) x; return (long) m > 0; }',
            'function example(x) { return x > 0 ? 1 : 0; }',
            params=[('x', INT)], reason='outputs differ')

    def test_member_array_decay_uses_the_owner_once(self):
        from csym import CArray, CPtr, CVal
        def configure(world, front, modules):
            world.c_globals['rec'] = CPtr(True, 'rec')
            world.c_globals['rec.items'] = CArray((
                CVal(z3.IntVal(3), (32, True)), CVal(z3.IntVal(5), (32, True))))
        self.equivalent(
            'struct own { int items[2]; }; extern struct own *rec;'
            'int example(int x) { int *q = rec->items; return q[x]; }',
            'function example(x) { return [3, 5][x]; }',
            params=[('x', INT)],
            pre=lambda s: [s['x'] >= 0, s['x'] <= 1], configure=configure)
        # `(x++, rec)->items` must not evaluate the owner twice: the decay
        # of a member array on a side-effecting owner is rejected instead.
        self.rejected(
            'struct own { int items[2]; }; extern struct own *rec;'
            'int example(int x) { int *q = (x++, rec)->items; return q[0] + x; }',
            'function example(x) { return 3 + x + 1; }',
            params=[('x', INT)],
            pre=lambda s: [s['x'] >= 0, s['x'] <= 9], configure=configure,
            reason='side-effecting owner')

    def test_initializer_slice_uses_explicit_locals_and_excludes_the_caller(self):
        from jssym import V
        def configure(world, front, modules):
            world.js_locals['x'] = V('num', world.params[0][1])
        c = 'int example(int x) { return x + 1; }'
        js = 'function example(x) { const value = x + 1; return 0; }'
        options = dict(params=[('x', INT)], pre=lambda s: [s['x'] >= 0, s['x'] <= 9],
                       configure=configure, js_initializer='value')
        self.equivalent(c, js, **options)
        self.rejected(c, js.replace('x + 1', 'x + 2'), **options, reason='outputs differ')

    def test_bounded_object_chain_matches_an_array_including_empty_inventory(self):
        from csym import CPtr
        from jssym import V
        def configure(world, front, modules):
            world.join_paths = True
            length = world.params[0][1].as_long()
            world.c_globals['head'] = CPtr(length > 0, 'item0')
            items = []
            for index in range(length):
                world.c_globals[f'item{index}.next'] = CPtr(index + 1 < length, f'item{index + 1}')
                items.append(V('record', {'weight': V('num', world.c_state[f'item{index}.weight'][0])}))
            world.js_values['game.items'] = V('array', tuple(items))
        c = ('struct item { int weight; struct item *next; }; struct item *head;'
             'int example(int length) { int sum = 0; struct item *p = head;'
             'while (p) { sum += p->weight; p = p->next; } return sum; }')
        js = 'function example(length) { return game.items.reduce((sum, item) => sum + item.weight, 0); }'
        options = dict(params=[('length', INT)], configure=configure,
                       state=[(f'item{i}.weight', INT, None) for i in range(4)],
                       pre=lambda s: [z3.And(s[f'item{i}.weight'] >= 0, s[f'item{i}.weight'] <= 100)
                                      for i in range(4)],
                       partitions=lambda front: [(str(n), {'length': n}) for n in range(5)])
        self.equivalent(c, js, **options)
        self.rejected(c, js.replace('return game.items', 'return (length === 4 ? 1 : 0) + game.items'),
                      **options, reason='outputs differ')

    def test_related_table_still_needs_a_declared_module_binding(self):
        from jssym import V
        def configure(world, front, modules):
            world.js_constants[('js/example.js', 'DATA')] = V('array', (V('num', world.params[0][1]),))
        c = 'int example(int x) { return x; }'
        js = 'function example(x) { return DATA[0]; }'
        self.equivalent(c, 'const DATA = [0]; ' + js, params=[('x', INT)], configure=configure)
        self.rejected(c, js, params=[('x', INT)], configure=configure,
                      reason='entry-state table DATA has no immutable binding')

    def test_scalar_global_reads_observe_temporary_writes(self):
        from csym import CVal
        def configure(world, front, modules):
            world.c_globals['count'] = CVal(world.params[0][1], INT)
        self.equivalent(
            'int count; int example(int x) { int saved = count;'
            'count += 1; int result = count; count = saved; return result; }',
            'function example(x) { return x + 1; }',
            params=[('x', INT)], pre=lambda s: [s['x'] >= 0, s['x'] <= 9], configure=configure)

    def test_writes_reject_a_state_model_with_the_wrong_native_field_type(self):
        from csym import CVal
        def configure(world, front, modules):
            world.c_globals['u.flag'] = CVal(z3.IntVal(1), (32, False))
        self.rejected(
            'struct { signed char flag; } u; int example(void) { u.flag = 1; return 0; }',
            'function example() { return 0; }', configure=configure,
            reason='C heap type mismatch for u.flag')


    def test_typeof_classifies_each_value_kind(self):
        classifier = (
            'function pick(i) {\n'
            "    return i === 0 ? 1 : i === 1 ? 'a' : i === 2 ? true : i === 3 ? undefined\n"
            '        : i === 4 ? null : i === 5 ? {} : 10n;\n'
            '}\n'
            'function example(i) {\n'
            '    const t = typeof pick(i);\n'
            "    return t === 'number' ? 1 : t === 'string' ? 2 : t === 'boolean' ? 3\n"
            "        : t === 'undefined' ? 4 : t === 'object' ? 5 : t === 'bigint' ? 6 : 7;\n"
            '}')
        mirror = ('int example(int i) { switch (i) { case 0: return 1;'
                  ' case 1: return 2; case 2: return 3; case 3: return 4;'
                  ' case 4: case 5: return 5; case 6: return 6; } return 7; }')
        domain = dict(params=[('i', INT)], pre=lambda s: [s['i'] >= 0, s['i'] <= 6])
        self.equivalent(mirror, classifier, **domain)
        # every kind label is pinned: misrouting any one classification
        # (number, string, boolean, undefined, the null/object case, bigint)
        # breaks the correspondence for the value of that kind.
        for kind, wrong in (("'number'", "'bigint'"), ("'string'", "'number'"),
                            ("'boolean'", "'string'"), ("'undefined'", "'object'"),
                            ("'object'", "'undefined'"), ("'bigint'", "'number'")):
            with self.subTest(kind=kind):
                self.rejected(mirror,
                              classifier.replace(f't === {kind} ?', f't === {wrong} ?'),
                              **domain, reason='outputs differ')

    def test_symbolic_string_array_read_selects_by_index(self):
        names = ('const names = ["leather", "iron", "rubber hose", null];\n'
                 'function example(i) { return names[i] === "rubber hose"; }')
        mirror = 'int example(int i) { return i == 2; }'
        domain = dict(params=[('i', INT)], pre=lambda s: [s['i'] >= 0, s['i'] <= 3])
        self.equivalent(mirror, names, **domain)
        # the null entry never equals a string, and a different literal
        # selects a different row
        self.rejected(mirror, names.replace('"rubber hose"', '"iron"'), **domain,
                      reason='outputs differ')
        self.rejected('int example(int i) { return i == 2 || i == 3; }', names,
                      **domain, reason='outputs differ')

    def test_symbolic_string_array_read_truthiness_distinguishes_null(self):
        names = ('const names = ["leather", null];\n'
                 'function example(i) { return names[i] ? 1 : 0; }')
        mirror = 'int example(int i) { return i == 0; }'
        domain = dict(params=[('i', INT)], pre=lambda s: [s['i'] >= 0, s['i'] <= 1])
        self.equivalent(mirror, names, **domain)

    def test_symbolic_string_array_read_rejects_typeof_and_coercive_equality(self):
        for body, why in (('typeof names[i]', 'unsupported: typeof of a symbolic string'),
                          ('names[i] == null',
                           'unsupported: JavaScript coercive equality on a symbolic string')):
            with self.subTest(body=body):
                self.rejected(
                    'int example(int i) { return 0; }',
                    f'const names = ["leather", null];\nfunction example(i) {{ return {body} ? 1 : 0; }}',
                    params=[('i', INT)], pre=lambda s: [s['i'] >= 0, s['i'] <= 1],
                    reason=why)

    def test_symbolic_string_array_read_compares_nullish_exactly(self):
        domain = dict(params=[('i', INT)], pre=lambda s: [s['i'] >= 0, s['i'] <= 1])
        base = 'const names = ["leather", null];\nfunction example(i) { return BODY; }'
        for body, mirror in (
                ('names[i] === null ? 1 : 0', 'int example(int i) { return i == 1; }'),
                ('names[i] !== null ? 1 : 0', 'int example(int i) { return i != 1; }'),
                ('names[i] === undefined ? 1 : 0', 'int example(int i) { return 0; }'),
                ('(names[i] ?? "fb") === "fb" ? 1 : 0', 'int example(int i) { return i == 1; }')):
            with self.subTest(body=body):
                self.equivalent(mirror, base.replace('BODY', body), **domain)
        # ?? must actually fall back at the null entry, and === null must
        # actually see it; denying either breaks the correspondence.
        self.rejected('int example(int i) { return 0; }',
                      base.replace('BODY', '(names[i] ?? "fb") === "fb" ? 1 : 0'),
                      **domain, reason='outputs differ')
        self.rejected('int example(int i) { return 0; }',
                      base.replace('BODY', 'names[i] === null ? 1 : 0'),
                      **domain, reason='outputs differ')

    def test_symbolic_mixed_array_read_is_rejected(self):
        self.rejected(
            'int example(int i) { return 0; }',
            'const mixed = ["a", 1];\nfunction example(i) { return mixed[i] === "a"; }',
            params=[('i', INT)], pre=lambda s: [s['i'] >= 0, s['i'] <= 1],
            reason='unsupported: JavaScript symbolic array read needs numeric or rectangular array elements')

    def test_symbolic_string_array_read_never_equals_the_empty_string(self):
        base = 'const names = ["leather", null];\nfunction example(i) { return BODY; }'
        domain = dict(params=[('i', INT)], pre=lambda s: [s['i'] >= 0, s['i'] <= 1])
        self.equivalent('int example(int i) { return 0; }',
                        base.replace('BODY', 'names[i] === "" ? 1 : 0'), **domain)
        self.equivalent('int example(int i) { return 1; }',
                        base.replace('BODY', 'names[i] !== "" ? 1 : 0'), **domain)
        # the null encoding must not leak into the empty-string comparison:
        # a mirror that is true exactly on the null row differs
        self.rejected('int example(int i) { return i == 1; }',
                      base.replace('BODY', 'names[i] === "" ? 1 : 0'), **domain,
                      reason='outputs differ')

    def test_symbolic_string_branch_joins_preserve_empty_and_null_values(self):
        def configure(world, front, modules):
            world.join_paths = True

        domain = dict(params=[('i', INT), ('j', INT)],
                      pre=lambda s: [s['i'] >= 0, s['i'] <= 1,
                                     s['j'] >= 0, s['j'] <= 1],
                      configure=configure)
        for assignments, literal_branch, table_branch in (
                ('let n = ""; if (j) n = names[i];', '!j', 'j'),
                ('let n = names[i]; if (j) n = "";', 'j', '!j')):
            for expression, expected, wrong in (
                    ('n === ""', literal_branch, '0'),
                    ('n === null', f'{table_branch} && i == 1',
                     f'{literal_branch} || i == 1'),
                    ('(n ?? "fallback") === "fallback"',
                     f'{table_branch} && i == 1', f'{literal_branch} || i == 1')):
                with self.subTest(assignments=assignments, expression=expression):
                    source = ('const names = ["leather", null];\n'
                              f'function example(i, j) {{ {assignments} '
                              f'return {expression} ? 1 : 0; }}')
                    self.rejected(f'int example(int i, int j) {{ return {wrong}; }}',
                                  source, **domain, reason='outputs differ')
                    self.equivalent(f'int example(int i, int j) {{ return {expected}; }}',
                                    source, **domain)

    def test_symbolic_string_branch_joins_preserve_two_table_reads(self):
        def configure(world, front, modules):
            world.join_paths = True

        source = ('const names = ["leather", null];\n'
                  'function example(i, j) { let n = names[i]; '
                  'if (j) n = names[1 - i]; return n === null ? 1 : 0; }')
        domain = dict(params=[('i', INT), ('j', INT)],
                      pre=lambda s: [s['i'] >= 0, s['i'] <= 1,
                                     s['j'] >= 0, s['j'] <= 1],
                      configure=configure)
        self.equivalent('int example(int i, int j) { return j ? i == 0 : i == 1; }',
                        source, **domain)
        self.rejected('int example(int i, int j) { return j ? i == 1 : i == 0; }',
                      source, **domain, reason='outputs differ')

    def test_joined_null_table_reads_equal_each_other(self):
        def configure(world, front, modules):
            world.join_paths = True

        source = ('const names = [null, null];\n'
                  'function example(i, j) { let n = names[i]; '
                  'if (j) n = names[1 - i]; return n === names[i] ? 1 : 0; }')
        domain = dict(params=[('i', INT), ('j', INT)],
                      pre=lambda s: [s['i'] >= 0, s['i'] <= 1,
                                     s['j'] >= 0, s['j'] <= 1],
                      configure=configure)
        self.rejected('int example(int i, int j) { return 0; }', source,
                      **domain, reason='outputs differ')
        self.equivalent('int example(int i, int j) { return 1; }', source, **domain)

    def test_symbolic_record_lookup_by_string_key_selects_exactly(self):
        lookup = ('const names = ["a", null];\nconst REC = { a: 1, b: 2 };\n'
                  'function example(i) { return REC[names[i]] ?? 0; }')
        mirror = 'int example(int i) { return i == 0 ? 1 : 0; }'
        domain = dict(params=[('i', INT)], pre=lambda s: [s['i'] >= 0, s['i'] <= 1])
        self.equivalent(mirror, lookup, **domain)
        # the null row misses every key, like JavaScript's REC['null']
        self.rejected('int example(int i) { return i == 0 ? 2 : 0; }', lookup,
                      **domain, reason='outputs differ')
        # keys that null or undefined coerce to cannot be encoded
        self.rejected('int example(int i) { return 0; }',
                      'const names = ["a", null];\nconst REC = { null: 1 };\n'
                      'function example(i) { return REC[names[i]] ?? 0; }',
                      **domain,
                      reason='unsupported: JavaScript record lookup with a key '
                             'that collides with the null encoding')

    def test_object_literal_prototype_key_is_rejected(self):
        self.rejected('int example(int i) { return i == 0; }',
                      'const names = ["a", "b"];\n'
                      'const REC = { __proto__: { b: 2 }, a: 1 };\n'
                      'function example(i) { return REC[names[i]] ?? 0; }',
                      params=[('i', INT)], pre=lambda s: [s['i'] >= 0, s['i'] <= 1],
                      reason='unsupported: JavaScript object literal __proto__ key')

    def test_string_array_of_symbolic_strings_is_rejected(self):
        self.rejected('int example(int i, int j) { return 0; }',
                      'const names = ["a", "b"];\n'
                      'function example(i, j) { const values = [names[i], "c"]; '
                      'return values[j] === "a" ? 1 : 0; }',
                      params=[('i', INT), ('j', INT)],
                      pre=lambda s: [s['i'] >= 0, s['i'] <= 1, s['j'] >= 0, s['j'] <= 1],
                      reason='unsupported: JavaScript string-array read of an already '
                             'symbolic string')

    def test_record_lookup_reaching_object_prototype_is_rejected(self):
        domain = dict(params=[('i', INT)], pre=lambda s: [s['i'] >= 0, s['i'] <= 1])
        reason = ('unsupported: JavaScript record lookup that can reach an '
                  'inherited Object.prototype member')
        for names in ('["a", "constructor"]', '["a", "toString"]'):
            with self.subTest(names=names):
                self.rejected('int example(int i) { return i == 0; }',
                              f'const names = {names};\nconst REC = {{ a: 1 }};\n'
                              'function example(i) { return REC[names[i]] ?? 0; }',
                              **domain, reason=reason)
        self.rejected('int example(void) { return 0; }',
                      'const REC = { a: 1 };\n'
                      'function example() { return REC["valueOf"] ?? 0; }',
                      reason=reason)
        # an own key shadows the inherited member and stays exact
        self.equivalent('int example(int i) { return i == 0 ? 1 : 2; }',
                        'const names = ["a", "constructor"];\n'
                        'const REC = { a: 1, constructor: 2 };\n'
                        'function example(i) { return REC[names[i]] ?? 0; }',
                        **domain)

    def test_guarded_table_lookup_covers_indices_outside_the_native_table(self):
        c = ('static const int classes[3] = {1, 1, 2}; '
             'int example(int i) { return i < 0 || i >= 3 ? 0 : classes[i]; }')
        js = ('const classes = [1, 1, 2]; function example(i) { '
              'if (i < 0 || i >= classes.length) return 0; return classes[i]; }')
        self.equivalent(c, js, params=[('i', INT)])
        self.rejected(c, js.replace('i >= classes.length', 'i > classes.length'),
                      params=[('i', INT)], reason='array index outside')

    def test_initial_object_columns_keep_enum_values_and_bitfield_aliases(self):
        c = ('enum classes { ILLEGAL = 1, WEAPON }; '
             'struct item { unsigned big:1; char oclass; signed char skill; }; '
             '#define oc_bimanual big\n'
             'static const struct item items[3] = '
             '{{0, ILLEGAL, 0}, {0, WEAPON, 0}, {1, WEAPON, -20}}; '
             'int example(int i) { return items[i].oclass '
             '+ 10 * items[i].oc_bimanual + items[i].skill; }')
        # A preprocessor directive needs to open a line.
        c = c.replace('#define', '\n#define')
        js = ('const classes = [1, 2, 2], big = [0, 0, 1], skill = [0, 0, -20]; '
              'function example(i) { return classes[i] + 10 * big[i] + skill[i]; }')
        domain = dict(params=[('i', INT)], pre=lambda s: [s['i'] >= 0, s['i'] < 3])
        self.equivalent(c, js, **domain)
        self.rejected(c, js.replace('classes = [1, 2, 2]', 'classes = [0, 2, 2]'),
                      **domain, reason='outputs differ')

    def compare_flags(self, macro, owner, *, mutant=False):
        source = (REPO / 'js/mondata.js').read_text()
        if mutant:
            source = source.replace('const M1_NOLIMBS = 0x00006000;',
                                    'const M1_NOLIMBS = 0x00004000;')
        modules = {'js/mondata.js': source,
                   'js/monster_data.js': (REPO / 'js/monster_data.js').read_text()}

        def configure(world, front, parsed):
            world.c_globals['ptr'] = CPtr(True, 'body')
            flags = world.c_state['body.mflags1'][0]
            world.js_constants[('js/monster_data.js', 'MONSTER_FLAGS1')] = V(
                'array', (V('num', flags),))

        return self.compare(
            '#include "hack.h"\nextern struct permonst *ptr;\n'
            f'int example(void) {{ return {macro}(ptr); }}',
            "import { " + owner + " } from './mondata.js';\n"
            f'function example() {{ return {owner}(0); }}',
            state=[('body.mflags1', (64, False), None)],
            pre=lambda s: [s['body.mflags1'] <= 2 ** 32 - 1],
            modules=modules, configure=configure,
        )

    def test_limbless_requires_the_whole_mask_for_every_flag_word(self):
        proved, report = self.compare_flags('nolimbs', 'monsterHasNoLimbs')
        self.assertTrue(proved, report)

    def test_missing_arms_bit_is_detected_outside_the_initial_species_table(self):
        proved, report = self.compare_flags('nolimbs', 'monsterHasNoLimbs', mutant=True)
        self.assertFalse(proved, report)
        self.assertIn('outputs differ', report)

    def test_high_diet_bit_survives_javascript_signed_bitwise_coercion(self):
        proved, report = self.compare_flags('metallivorous', 'metallivorous')
        self.assertTrue(proved, report)

    def test_module_level_arrow_const_is_callable(self):
        domain = dict(params=[('x', INT)], pre=lambda s: [s['x'] >= -10, s['x'] <= 10])
        self.equivalent('int example(int x) { return x > 0 ? x + 1 : x - 1; }',
                        'export const example = (x) => x > 0 ? x + 1 : x - 1;',
                        **domain)

    def test_module_level_arrow_const_runs_a_block_body(self):
        domain = dict(params=[('x', INT)], pre=lambda s: [s['x'] >= -10, s['x'] <= 10])
        self.equivalent('int example(int x) { if (x > 3) return 3; return x; }',
                        'export const example = (x) => {\n'
                        '    if (x > 3)\n        return 3;\n    return x;\n};',
                        **domain)

    def test_array_some_accepts_a_block_bodied_callback(self):
        c = ('int example(int x) { int i; for (i = 0; i < 3; i++) '
             'if ((1 << i) == x) return 1; return 0; }')
        js = ('const shifts = [1, 2, 4];\n'
              'function example(x) { return shifts.some((value) => {\n'
              '    if (value === x)\n        return true;\n'
              '    return false;\n}); }')
        domain = dict(params=[('x', INT)], pre=lambda s: [s['x'] >= 0, s['x'] <= 8])
        self.equivalent(c, js, **domain)
        self.rejected(c, js.replace('value === x', 'value === x + 1'),
                      **domain, reason='outputs differ')

    def test_async_array_some_callback_is_rejected(self):
        # [1].some(async () => false) is true in JavaScript: the callback
        # returns a Promise, which is always truthy. The executor must not
        # model the resolved value.
        c = 'int example(int x) { return 0; }'
        js_block = ('function example(x) { return [1].some(async (value) => {\n'
                    '    return false;\n}); }')
        js_expression = 'function example(x) { return [1].some(async (value) => false); }'
        domain = dict(params=[('x', INT)])
        self.rejected(c, js_block, **domain, reason='async')
        self.rejected(c, js_expression, **domain, reason='async')

    def test_async_array_reduce_callback_is_rejected(self):
        c = 'int example(int x) { return 0; }'
        js = ('function example(x) { return [1].reduce(async (a, v) => a + v, 0); }')
        self.rejected(c, js, params=[('x', INT)], reason='async')

    def test_for_of_iteration_binds_elements_in_order(self):
        c = ('int example(int x) { int i; for (i = 0; i < 3; i++) '
             'if ((1 << i) == x) return 1; return 0; }')
        js = ('const shifts = [1, 2, 4];\n'
              'function example(x) { for (const s of shifts) {\n'
              '    if (s === x)\n        return 1;\n'
              '} return 0; }')
        domain = dict(params=[('x', INT)], pre=lambda s: [s['x'] >= 0, s['x'] <= 8])
        self.equivalent(c, js, **domain)
        self.rejected(c, js.replace('s === x', 's === x + 1'),
                      **domain, reason='outputs differ')

    def test_for_of_continue_and_break_keep_javascript_meaning(self):
        c = ('int example(int x) { int i, t = 0; for (i = 0; i < 4; i++) { '
             'if (x == 1) continue; if (t > 1) break; t += 1; } return t; }')
        js = ('function example(x) { let t = 0; '
              'for (const i of [1, 1, 1, 1]) {\n'
              '    if (i === x)\n        continue;\n'
              '    if (t > 1)\n        break;\n'
              '    t += i;\n'
              '} return t; }')
        domain = dict(params=[('x', INT)], pre=lambda s: [s['x'] >= 0, s['x'] <= 2])
        self.equivalent(c, js, **domain)
        self.rejected(c, js.replace('t > 1', 't > 0'),
                      **domain, reason='outputs differ')

    def test_array_literals_may_carry_comments_and_a_trailing_separator(self):
        js = ('const shifts = [\n    1, // one\n    2, // two\n];\n'
              'function example(x) { return shifts.includes(x); }')
        domain = dict(params=[('x', INT)], pre=lambda s: [s['x'] >= 0, s['x'] <= 3])
        self.equivalent('int example(int x) { return x == 1 || x == 2; }',
                        js, **domain)
        self.rejected('int example(int x) { return x == 1 || x == 2; }',
                      js.replace('shifts.includes(x)', 'shifts.includes(x + 1)'),
                      **domain, reason='outputs differ')

    def test_ordered_comparison_of_two_table_element_pointers(self):
        def pointers(world, front, modules):
            world.c_globals['rows'] = native_table(world, front,
                                                   front.files[0], 'rows')
            a = world.c_state['a'][0]
            b = world.c_state['b'][0]
            world.pre.extend([a >= 0, a < 4, b >= 0, b < 4])
            world.c_globals['pa'] = CPtr(True, CElement('rows', a))
            world.c_globals['pb'] = CPtr(True, CElement('rows', b))
            world.js_values['game.a'] = V('num', a)
            world.js_values['game.b'] = V('num', b)

        native = 'static int rows[] = {3, 1, 4, 1}; static int *pa, *pb; ' \
                 'int example(void) { return pa < pb; }'
        options = dict(state=[('a', INT, None), ('b', INT, None)],
                       configure=pointers)
        self.equivalent(native, 'function example() { return game.a < game.b; }',
                        **options)
        self.rejected(native, 'function example() { return game.a <= game.b; }',
                      reason='outputs differ', **options)

    def test_for_of_var_binding_survives_the_loop_and_shadows_module_state(self):
        # `var` is function-scoped: after the loop the binding holds the last
        # element, and a module-level binding of the same name stays untouched.
        js = ('const item = 23;\n'
              'function example(typ) {\n'
              '    for (var item of [0]) {\n'
              '    }\n'
              '    return typ === item;\n'
              '}')
        domain = dict(params=[('typ', INT)], pre=lambda s: [s['typ'] >= 0, s['typ'] <= 30])
        self.equivalent('int example(int typ) { return typ == 0; }', js, **domain)
        self.rejected('int example(int typ) { return typ == 23; }', js,
                      **domain, reason='outputs differ')

    def test_for_of_var_binding_survives_an_enclosing_block(self):
        # `var` is function-scoped: even when the loop sits inside a nested
        # block, the binding outlives that block and a module binding of the
        # same name stays untouched.
        js = ('const item = 23;\n'
              'function example(typ) {\n'
              '    {\n'
              '        for (var item of [0]) {\n'
              '        }\n'
              '    }\n'
              '    return typ === item;\n'
              '}')
        domain = dict(params=[('typ', INT)], pre=lambda s: [s['typ'] >= 0, s['typ'] <= 30])
        self.equivalent('int example(int typ) { return typ == 0; }', js, **domain)
        self.rejected('int example(int typ) { return typ == 23; }', js,
                      **domain, reason='outputs differ')

    def test_for_of_var_does_not_preserve_an_unrelated_lexical_binding(self):
        js = ('function example(typ) { '
              'if (typ === 0) { for (var item of [1]) {} } '
              'else { let item = 23; } return typ === item; }')
        self.rejected('int example(int typ) { return typ == 23; }', js,
                      params=[('typ', INT)], reason='shadows a binding')

    def test_for_of_var_is_undefined_when_evaluating_its_collection(self):
        js = ('const items = [23]; '
              'function example(typ) { for (var items of items) {} '
              'return typ === 23; }')
        self.rejected('int example(int typ) { return typ == 23; }', js,
                      params=[('typ', INT)], reason='for...of over undef')

    def test_for_of_var_is_undefined_before_the_loop(self):
        js = ('const item = 23; '
              'function example(typ) { '
              'if (item !== undefined) return typ === item; '
              'for (var item of [1]) {} return typ === item; }')
        self.equivalent('int example(int typ) { return typ == 1; }', js,
                        params=[('typ', INT)])

    def test_for_of_var_is_undefined_when_its_branch_is_skipped(self):
        js = ('const item = 23; '
              'function example(typ) { '
              'if (typ === 0) { for (var item of [1]) {} } '
              'return item === undefined; }')
        self.equivalent('int example(int typ) { return typ != 0; }', js,
                        params=[('typ', INT)])

    def test_for_of_var_hoisting_does_not_enter_class_static_blocks(self):
        # A class static block has its own var environment: the loop's `var
        # item` must not hoist into the function, where it would shadow the
        # module `const item = 23` from entry and fabricate `item ===
        # undefined`. The scan fails closed on the class instead.
        js = ('const item = 23;\n'
              'function example(typ) {\n'
              '    if (typ === 999) {\n'
              '        class Holder {\n'
              '            static {\n'
              '                for (var item of [0]) {\n'
              '                }\n'
              '            }\n'
              '        }\n'
              '    }\n'
              '    return typ === 23 && item === undefined;\n'
              '}')
        domain = dict(params=[('typ', INT)],
                      pre=lambda s: [s['typ'] >= -128, s['typ'] <= 127])
        self.rejected('int example(int typ) { return typ == 23; }', js,
                      **domain, reason='inside a claimed function')

    def test_for_of_var_hoisting_rejects_unmodeled_scope_constructs(self):
        for construct in (
            'const C = class { static { for (var q of [1]) {} } };',
            'with (typ) { }',
            'eval(typ);',
            'lab: function inner() { for (var z of [2]) {} }',
        ):
            js = ('function example(typ) {\n    ' + construct +
                  '\n    return typ;\n}')
            with self.subTest(construct=construct):
                self.rejected('int example(int typ) { return typ; }', js,
                              params=[('typ', INT)],
                              pre=lambda s: [s['typ'] >= -5, s['typ'] <= 5],
                              reason='inside a claimed function')

    def test_callback_var_is_rejected_before_a_read_can_use_an_outer_binding(self):
        callbacks = (
            '[0].some(x => { return typ === item; for (var item of [1]) {} })',
            '[0].reduce((total, x) => { return typ === item; for (var item of [1]) {} }, 0)',
        )
        for expression in callbacks:
            with self.subTest(expression=expression):
                js = f'const item = 23; function example(typ) {{ return {expression}; }}'
                self.rejected('int example(int typ) { return typ == 23; }', js,
                              params=[('typ', INT)], reason='callback has a for...of var')

    def test_for_of_assignment_to_a_module_binding_is_rejected(self):
        # A bare assignment target writes module state (`let flag`), which
        # the executor cannot model; it must refuse rather than bind a local.
        js = ('let flag = 0;\n'
              'function example() {\n'
              '    for (flag of [1]) {\n'
              '    }\n'
              '    return flag;\n'
              '}')
        self.rejected('int example(void) { return 1; }', js,
                      reason='for...of writes the non-local binding flag')

    def test_for_of_assignment_to_a_local_binding_assigns_elements(self):
        js = ('function example(x) {\n'
              '    let t;\n'
              '    for (t of [x, x + 1]) {\n'
              '    }\n'
              '    return t;\n'
              '}')
        domain = dict(params=[('x', INT)], pre=lambda s: [s['x'] >= -5, s['x'] <= 5])
        self.equivalent('int example(int x) { return x + 1; }', js, **domain)

    def test_ordered_element_comparison_requires_non_null_pointers(self):
        def pointers(world, front, modules):
            world.c_globals['rows'] = native_table(world, front,
                                                   front.files[0], 'rows')
            a = world.c_state['a'][0]
            b = world.c_state['b'][0]
            present = world.c_state['present'][0]
            world.pre.extend([a >= 0, a < 4, b >= 0, b < 4,
                              present >= 0, present <= 1])
            world.c_globals['pa'] = CPtr(True, CElement('rows', a))
            world.c_globals['pb'] = CPtr(present == 1, CElement('rows', b))
            world.js_values['game.a'] = V('num', a)
            world.js_values['game.b'] = V('num', b)

        native = 'static int rows[] = {3, 1, 4, 1}; static int *pa, *pb; ' \
                 'int example(void) { return pa < pb; }'
        options = dict(state=[('a', INT, None), ('b', INT, None),
                              ('present', INT, None)],
                       configure=pointers)
        proved, report = self.compare(native, 'function example() { return game.a < game.b; }',
                                      **options)
        self.assertFalse(proved, report)
        self.assertIn('C ordered element comparison with a null pointer', report)
        self.equivalent(native, 'function example() { return game.a < game.b; }',
                        **options, pre=lambda s: [s['a'] >= 0, s['a'] < 4,
                                                  s['b'] >= 0, s['b'] < 4,
                                                  s['present'] == 1])



    def test_for_of_const_target_is_uninitialized_while_its_collection_evaluates(self):
        # The const loop binding is in scope, uninitialized, when the
        # collection expression evaluates: `for (const items of items)`
        # throws ReferenceError instead of iterating the module array.
        js = ('const items = [1];\n'
              'function example() {\n'
              '    for (const items of items) {\n'
              '    }\n'
              '    return 1;\n'
              '}')
        self.rejected('int example(void) { return 1; }', js,
                      reason='read before declaration')
        js_let = js.replace('const items of', 'let items of')
        self.rejected('int example(void) { return 1; }', js_let,
                      reason='read before declaration')

    def test_for_of_target_is_havoced_inside_an_annotated_loop(self):
        js = ('function example(x) {\n'
              '    let i = 0;\n'
              '    let v = 0;\n'
              '    while (i < x) {\n'
              '        for (v of [1]) {\n'
              '        }\n'
              '        i = i + 1;\n'
              '    }\n'
              '    return v;\n'
              '}')
        c = ('int example(int x) { int i = 0, v = 0; '
             'while (i < x) { v = 1; i = i + 1; } return v; }')

        def invariant(view, entry, pos, pos0):
            del pos, pos0
            return [z3.And(view['i'] >= 0, view['i'] <= entry['x']),
                    view['v'] == z3.If(view['i'] == 0, 0, 1)]

        loops = {('js', 'example', 0): LoopSpec(
            invariant, lambda view, entry: entry['x'] - view['i'], streams=())}
        domain = dict(params=[('x', INT)], pre=lambda s: [s['x'] >= 0, s['x'] <= 5],
                      loops=loops)
        self.equivalent(c, js, **domain)

        # Without the for-of target in the modification scan, the havoc step
        # leaves the entry value in place and the model computes a wrong
        # concrete return for x >= 1. An invariant silent about v must leave
        # the proof open rather than fabricate that value.
        def silent(view, entry, pos, pos0):
            del pos, pos0
            return [z3.And(view['i'] >= 0, view['i'] <= entry['x'])]

        open_loops = {('js', 'example', 0): LoopSpec(
            silent, lambda view, entry: entry['x'] - view['i'], streams=())}
        self.rejected(c, js, reason='outputs differ',
                      params=[('x', INT)], pre=lambda s: [s['x'] >= 0, s['x'] <= 5],
                      loops=open_loops)

    def test_assigned_scan_counts_for_of_targets(self):
        from jssym import _assigned
        js = ('function example(x) {\n    let v = 0;\n'
              '    while (v < x) {\n        for (v of [1]) {\n        }\n    }\n'
              '    return v;\n}')
        body = parse_module(js.encode())[0]['example'].child_by_field_name('body')
        self.assertIn('v', _assigned(body))
        # const/let targets stay block-scoped inside the loop and must not
        # be treated as modifications of an enclosing binding.
        scoped = ('function example(x) {\n    while (x > 0) {\n'
                  '        for (const q of [1]) {\n        }\n        x = x - 1;\n    }\n'
                  '    return x;\n}')
        scoped_body = parse_module(scoped.encode())[0]['example'].child_by_field_name('body')
        self.assertEqual(_assigned(scoped_body), {'x'})



if __name__ == '__main__':
    unittest.main()
