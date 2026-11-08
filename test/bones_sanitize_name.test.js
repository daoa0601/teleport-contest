import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizeName } from '../js/bones.js';
import { game } from '../js/gstate.js';
import { freshPlayableRoom } from './support/playable-room.js';
void test('bones names replace control characters with full stops', () => {
    freshPlayableRoom({ seed: 61n });
    assert.equal(sanitizeName('old\u0001ghost\u007f'), 'old.ghost.');
});
void test('printable high-bit name characters follow the eight-bit input option', () => {
    freshPlayableRoom({ seed: 61n });
    game.iflags.wc_eight_bit_input = false;
    assert.equal(sanitizeName('caf\u00e9'), 'caf_', 'an eight-bit name is masked for an ordinary tty');
    assert.equal(sanitizeName('a\u0080b'), 'a.b', 'a high-bit control byte is a control character');
    game.iflags.wc_eight_bit_input = true;
    assert.equal(sanitizeName('caf\u00e9'), 'caf\u00e9', 'an eight-bit tty keeps printable eight-bit characters');
});
//# sourceMappingURL=bones_sanitize_name.test.js.map