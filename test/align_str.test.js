import assert from 'node:assert/strict';
import test from 'node:test';
import { align_str } from '../js/insight.js';
// C insight.c:align_str(): the four alignment names plus the "unknown"
// fallback for out-of-range values.  music.c:do_earthquake() names an
// unaligned altar through the same table.
void test('align_str names every alignment like C', () => {
    assert.equal(align_str(1), 'lawful');
    assert.equal(align_str(0), 'neutral');
    assert.equal(align_str(-1), 'chaotic');
    assert.equal(align_str(-128), 'unaligned');
    assert.equal(align_str(42), 'unknown');
});
//# sourceMappingURL=align_str.test.js.map