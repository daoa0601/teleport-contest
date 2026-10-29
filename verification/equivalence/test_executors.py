"""Checks of modeled language behavior, using clang and real JS ASTs.

Run: uv run python -m unittest -v test_executors
These snippets describe language semantics, not copies of game functions.
"""
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from cfront import CFront
from jssym import parse_module
from prove import REPO, check, recorder_dir
from specs import INT, LONG, Spec

GLIBC_ASSERT = '''
    extern void __assert_fail(const char *, const char *, unsigned, const char *)
        __attribute__((noreturn));
    #define assert(e) ((void) sizeof ((e) ? 1 : 0), __extension__ ({ \
        if (e) ; else __assert_fail(#e, __FILE__, __LINE__, __func__); }))
'''


class ExecutorTests(unittest.TestCase):
    def compare(self, c, js, *, params=(), pre=lambda s: [], state=(), modules=None):
        with TemporaryDirectory(prefix='fv-language-', dir=REPO / '.cache') as directory:
            c_file = Path(directory) / 'example.c'
            c_file.write_text(c)
            parsed = {}
            for label, source in {'js/example.js': js, **(modules or {})}.items():
                raw = source.encode()
                parsed[label] = (raw, *parse_module(raw))
            spec = Spec('example', 'example', 'example', list(params), pre=pre,
                        state=list(state), js_file='js/example.js')
            return check(spec, CFront(recorder_dir(), [c_file]), parsed, pre)

    def equivalent(self, *args, **kwargs):
        proved, report = self.compare(*args, **kwargs)
        self.assertTrue(proved, report)

    def rejected(self, *args, reason, **kwargs):
        proved, report = self.compare(*args, **kwargs)
        self.assertFalse(proved, report)
        self.assertIn(reason, report)

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

    def test_global_writes_are_rejected(self):
        self.rejected('struct { int value; } u; int example(void) { u.value = 3; return 3; }',
                      'function example() { game.u.value = 3; return 3; }', reason='non-local lvalue')

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


if __name__ == '__main__':
    unittest.main()
