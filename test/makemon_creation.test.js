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
// C makemon.c:m_initweap() S_KOBOLD hands some kobolds a dart stack through
// m_initthrow(DART, 12): each stack holds rn1(12,3) darts, and ordinary darts
// are never created poisoned. The rule is checked on every stack the seed
// sweep produces, so a wider or narrower roll breaks it without relying on
// one particular seed's outcome.
void test('kobold dart stacks are unpoisoned stacks of three to fourteen', async () => {
    let dartStacks = 0;
    for (const seed of [1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n, 9n, 10n]) {
        await freshObjectRoom({ gameplaySeed: seed });
        const kobold = await makemonAt(MONSTER_NAME.indexOf('kobold'), 13, 8, MM_NOMSG);
        assert.ok(kobold, `a kobold should be born (seed ${seed})`);
        for (const stack of kobold.minvent ?? []) {
            if (stack.otyp !== DART)
                continue;
            dartStacks++;
            assert.ok(stack.quan >= 3 && stack.quan <= 14, `dart stack of ${stack.quan} outside rn1(12,3) (seed ${seed})`);
            assert.notEqual(stack.opoisoned, true, `dart stack must not be poisoned (seed ${seed})`);
        }
    }
    assert.ok(dartStacks > 0, 'the seed sweep should produce at least one dart stack');
});
// C makemon.c:m_initthrow(): every orcish arrow stack a monster is created
// with is poisoned, unlike the other throwing stacks.
void test('uruk-hai orcish arrow stacks are always created poisoned', async () => {
    let arrowStacks = 0;
    for (const seed of [1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n, 9n, 10n]) {
        await freshObjectRoom({ gameplaySeed: seed });
        const uruk = await makemonAt(MONSTER_NAME.indexOf('Uruk-hai'), 14, 8, MM_NOMSG);
        assert.ok(uruk, `an uruk-hai should be born (seed ${seed})`);
        for (const stack of uruk.minvent ?? []) {
            if (stack.otyp !== ORCISH_ARROW)
                continue;
            arrowStacks++;
            assert.ok(stack.quan >= 3 && stack.quan <= 14, `arrow stack of ${stack.quan} outside rn1(12,3) (seed ${seed})`);
            assert.equal(stack.opoisoned, true, `orcish arrow stack must be poisoned (seed ${seed})`);
        }
    }
    assert.ok(arrowStacks > 0, 'the seed sweep should produce at least one arrow stack');
});
//# sourceMappingURL=makemon_creation.test.js.map