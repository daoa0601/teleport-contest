import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizeBonesName } from '../js/bones_name.js';
import { game } from '../js/gstate.js';
import { freshPlayableRoom } from './support/playable-room.js';
void test('bones names replace control characters with full stops', () => {
    freshPlayableRoom({ seed: 61n });
    assert.equal(sanitizeBonesName('old\u0001ghost\u007f'), 'old.ghost.');
});
void test('printable high-bit name characters follow the eight-bit input option', () => {
    freshPlayableRoom({ seed: 61n });
    game.iflags.wc_eight_bit_input = false;
    assert.equal(sanitizeBonesName('caf\u00e9'), 'caf_', 'an eight-bit name is masked for an ordinary tty');
    assert.equal(sanitizeBonesName('a\u0080b'), 'a.b', 'a high-bit control byte is a control character');
    game.iflags.wc_eight_bit_input = true;
    assert.equal(sanitizeBonesName('caf\u00e9'), 'caf\u00e9', 'an eight-bit tty keeps printable eight-bit characters');
});
//# sourceMappingURL=bones_name.test.js.map