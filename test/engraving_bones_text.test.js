import assert from 'node:assert/strict';
import test from 'node:test';
import { BURN } from '../js/const.js';
import { engravingAt, makeEngravingAt } from '../js/engrave.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { mklev, saveBonesLevel } from '../js/mklev.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
for (const eightBit of [false, true]) {
    void test(`bones clean control characters from engraving text with eight-bit input ${eightBit ? 'enabled' : 'disabled'}`, async () => {
        freshObjectRoom();
        const storage = memoryStorage();
        game.storage = storage;
        makeEngravingAt(12, 10, 'A\x01B\u0081C\u00e9D\x7f', null, 0, BURN);
        assert.equal(saveBonesLevel(), true);
        freshObjectRoom();
        game.storage = storage;
        game.flags.debug = true;
        game.iflags.wc_eight_bit_input = eightBit;
        resetInputState().feed('yn');
        await mklev();
        assert.equal(engravingAt(12, 10)?.text, `A.B.C${eightBit ? '\u00e9' : '_'}D.`);
    });
}
//# sourceMappingURL=engraving_bones_text.test.js.map