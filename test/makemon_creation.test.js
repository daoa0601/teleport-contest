import test from 'node:test';
import assert from 'node:assert/strict';
import { MM_ANGRY, MM_NOMSG } from '../js/const.js';
import { makemonAt } from '../js/makemon.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { DART, ORCISH_ARROW } from '../js/object_data.js';
import { freshObjectRoom } from './support/object-room.js';
// C makemon.c:makemon() sets mpeaceful from MM_ANGRY before the species
// switch, and the S_UNICORN arm then runs unconditionally: an explicitly
// summoned-hostile unicorn sharing the hero's alignment sign is still born
// peaceful, while the opposite-sign unicorn keeps MM_ANGRY's hostility.
// MM_ANGRY also skips peace_minded(), so no random attitude roll is involved.
void test('a co-aligned unicorn is born peaceful despite MM_ANGRY', async () => {
    for (const seed of [1n, 2n, 3n]) {
        await freshObjectRoom({ gameplaySeed: seed }); // neutral hero
        const gray = await makemonAt(MONSTER_NAME.indexOf('gray unicorn'), 10, 8, MM_ANGRY | MM_NOMSG);
        const black = await makemonAt(MONSTER_NAME.indexOf('black unicorn'), 12, 8, MM_ANGRY | MM_NOMSG);
        assert.ok(gray, 'a gray unicorn should be born');
        assert.ok(black, 'a black unicorn should be born');
        assert.equal(gray.mpeaceful, 1);
        assert.equal(black.mpeaceful, 0);
    }
});
// C makemon.c:m_initweap() S_KOBOLD hands some kobolds a dart stack through
// m_initthrow(DART, 12): every stack holds rn1(12,3) darts. The stacks'
// poison state is mksobj's ordinary weapon rule (mkobj.c:886 rolls
// is_poisonable && !rn2(100)), not a kobold rule, so it is not asserted here.
void test('kobold dart stacks are stacks of three to fourteen', async () => {
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
        }
    }
    assert.ok(dartStacks > 0, 'the seed sweep should produce at least one dart stack');
});
// C makemon.c:m_initthrow(): every orcish arrow stack is force-poisoned
// after mksobj, on top of the ordinary weapon rule, so the flag is always
// set regardless of mksobj's own 1-in-100 roll.
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