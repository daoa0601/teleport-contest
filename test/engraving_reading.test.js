import test from 'node:test';
import assert from 'node:assert/strict';
import { BURN, DUST, LAVAPOOL, POOL } from '../js/const.js';
import { plineWithContinuation } from '../js/display.js';
import { makeEngravingAt, readEngravingAt } from '../js/engrave.js';
import { game } from '../js/gstate.js';
import { initRng } from '../js/rng.js';
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
        assert.ok(game._pending_message.endsWith(`You read: "${text}${ending}`), `Unexpected reading: ${game._pending_message}`);
        assert.equal(engraving.eread, true);
        assert.equal(engraving.rememberedText, text);
    });
}
void test('examining blank liquid affects the next hallucinated engraving surface', async () => {
    async function nextReading(hasFirstEngraving) {
        const level = freshObjectRoom({ hero: { hallucinationTurns: 20 } });
        level.requireAt(10, 10).typ = POOL;
        level.requireAt(11, 10).typ = LAVAPOOL;
        if (hasFirstEngraving)
            makeEngravingAt(10, 10, 'dust', 'dust', 0, DUST);
        makeEngravingAt(11, 10, 'Beware', 'Beware', 0, BURN);
        initRng(1n);
        await readEngravingAt(10, 10, async () => { });
        const messages = [];
        await readEngravingAt(11, 10, async (message) => { messages.push(message); });
        return messages[0];
    }
    const afterWrittenSquare = await nextReading(true);
    const afterBlankSquare = await nextReading(false);
    assert.ok(afterWrittenSquare);
    assert.equal(afterBlankSquare, afterWrittenSquare, 'the first liquid is perceived whether or not it has an engraving');
});
//# sourceMappingURL=engraving_reading.test.js.map