import test from 'node:test';
import assert from 'node:assert/strict';
import { MM_NOMSG } from '../js/const.js';
import { makemonAt } from '../js/makemon.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { DART, ORCISH_ARROW } from '../js/object_data.js';
import { freshObjectRoom } from './support/object-room.js';
// C makemon.c:makemon() S_UNICORN switch: a unicorn sharing the sign of the
// hero's alignment is born peaceful even when the co-aligned attitude rolls
// peace_minded() consumed would have made it hostile, while an opposite-sign
// unicorn keeps peace_minded()'s hostile verdict.
void test('a co-aligned unicorn is born peaceful across differing attitude rolls', async () => {
    for (const seed of [1n, 2n, 3n]) {
        await freshObjectRoom({ gameplaySeed: seed }); // neutral hero
        const gray = await makemonAt(MONSTER_NAME.indexOf('gray unicorn'), 10, 8, MM_NOMSG);
        const black = await makemonAt(MONSTER_NAME.indexOf('black unicorn'), 12, 8, MM_NOMSG);
        assert.ok(gray, 'a gray unicorn should be born');
        assert.ok(black, 'a black unicorn should be born');
        assert.equal(gray.mpeaceful, 1);
        assert.equal(black.mpeaceful, 0);
    }
});
// C makemon.c:m_initweap() S_KOBOLD hands the kobold a dart stack through
// m_initthrow(DART, 12): the stack size is rn1(12,3) and ordinary darts are
// never created poisoned.
void test('a kobold throws an unpoisoned dart stack of three to fourteen', async () => {
    await freshObjectRoom({ gameplaySeed: 4n });
    const kobold = await makemonAt(MONSTER_NAME.indexOf('kobold'), 13, 8, MM_NOMSG);
    assert.ok(kobold, 'a kobold should be born');
    const darts = (kobold.minvent ?? []).filter(object => object.otyp === DART);
    assert.equal(darts.length, 1);
    const stack = darts[0];
    assert.ok(stack);
    assert.equal(stack.quan, 7);
    assert.equal(stack.quan >= 3 && stack.quan <= 14, true);
    assert.equal(stack.opoisoned ?? false, false);
});
// C makemon.c:m_initthrow(): orcish arrow stacks are always created poisoned.
void test('an uruk-hai fires orcish arrows that are always created poisoned', async () => {
    await freshObjectRoom({ gameplaySeed: 1n });
    const uruk = await makemonAt(MONSTER_NAME.indexOf('Uruk-hai'), 14, 8, MM_NOMSG);
    assert.ok(uruk, 'an uruk-hai should be born');
    const arrows = (uruk.minvent ?? []).filter(object => object.otyp === ORCISH_ARROW);
    assert.equal(arrows.length, 1);
    const stack = arrows[0];
    assert.ok(stack);
    assert.equal(stack.quan, 6);
    assert.equal(stack.quan >= 3 && stack.quan <= 14, true);
    assert.equal(stack.opoisoned, true);
});
//# sourceMappingURL=makemon_creation.test.js.map