import test from 'node:test';
import assert from 'node:assert/strict';
import { DUST } from '../js/const.js';
import { plineWithContinuation } from '../js/display.js';
import { makeEngravingAt, readEngravingAt } from '../js/engrave.js';
import { game } from '../js/gstate.js';
import { freshObjectRoom } from './support/object-room.js';

for (const { text, pristine, ending } of [
    { text: 'a  ae ???u?', pristine: 'a brave adventurer?', ending: '".' },
    { text: 'Beware!', pristine: 'Beware!', ending: '"' },
    { text: 'Beware!', pristine: '', ending: '".' },
]) {
    void test(`reading ${JSON.stringify(text)} uses punctuation at its original position in ${JSON.stringify(pristine)}`, async () => {
        freshObjectRoom();
        const engraving = makeEngravingAt(10, 10, text, pristine, 0, DUST);
        assert.ok(engraving);

        await readEngravingAt(10, 10, plineWithContinuation);

        assert.ok(game._pending_message.endsWith(`You read: "${text}${ending}`),
            `Unexpected reading: ${game._pending_message}`);
        assert.equal(engraving.eread, true);
        assert.equal(engraving.rememberedText, text);
    });
}
