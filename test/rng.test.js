import test from 'node:test';
import assert from 'node:assert/strict';
import { d, initRng, rne, rnl } from '../js/rng.js';
import { LUCKSTONE } from '../js/object_data.js';
import { freshGame } from './support/game-state.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
function firstLuckOutcome(luck) {
    freshGame({ hero: { uluck: luck } });
    initRng(1n);
    return rnl(20);
}
void test('live rnl biases the same base draw according to current Luck', () => {
    const neutral = firstLuckOutcome(0);
    const fortunate = firstLuckOutcome(5);
    const unfortunate = firstLuckOutcome(-5);
    assert.ok(fortunate < neutral);
    assert.ok(unfortunate > neutral);
    assert.ok(fortunate >= 0);
    assert.ok(unfortunate < 20);
});
void test('a carried luckstone improves luck-sensitive decisions', async () => {
    freshObjectRoom({ hero: { uluck: 0 } });
    initRng(1n);
    const withoutStone = rnl(20);
    await addInventoryObject(LUCKSTONE, { blessed: true });
    initRng(1n);
    const withStone = rnl(20);
    assert.ok(withStone < withoutStone);
});
// C rnd.c:rne(): the exponent runs up to 5 below experience level 15 and to
// level/3 from there; rne(1) never rolls nonzero, so it always hits the cap.
void test('rne stops at the hero-level cap when every roll returns zero', () => {
    const capped = (ulevel) => {
        freshGame({ hero: { ulevel } });
        initRng(1n);
        return rne(1);
    };
    for (const [ulevel, expected] of [
        [1, 5], [14, 5], [15, 5], [16, 5], [21, 7], [30, 10],
    ]) {
        assert.equal(capped(ulevel), expected, `experience level ${ulevel}`);
    }
});
void test('d totals one roll per die and rolls nothing for zero dice', () => {
    freshGame();
    initRng(3n);
    const total = d(3, 6);
    assert.ok(total >= 3 && total <= 18);
    assert.equal(d(0, 6), 0, 'zero dice roll no draws and return an empty total');
});
//# sourceMappingURL=rng.test.js.map