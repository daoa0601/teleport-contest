import test from 'node:test';
import assert from 'node:assert/strict';
import { objectWeight } from '../js/mkobj.js';
import { GLOB_OF_GRAY_OOZE, HEAVY_IRON_BALL } from '../js/object_data.js';
// C mkobj.c:weight() returns (int) obj->owt for globs and for the heavy
// iron ball, so a cached unsigned weight above INT_MAX reaches callers as
// the negative int32 wrap. objnam.c:readobjnam's wizard-mode glob override
// can create one glob weighing 107374336 * 20 = 2147486720, which is above
// INT_MAX; the port must reproduce the cast, not the unsigned value.
void test('glob weight wraps owt through the native int cast', () => {
    const glob = {
        otyp: GLOB_OF_GRAY_OOZE,
        oclass: 7,
        quan: 1,
        owt: 2147486720,
        globby: true,
    };
    assert.equal(objectWeight(glob), -2147480576);
});
void test('heavy iron ball weight wraps owt through the native int cast', () => {
    const ball = {
        otyp: HEAVY_IRON_BALL,
        oclass: 1,
        quan: 1,
        owt: 2147486720,
    };
    assert.equal(objectWeight(ball), -2147480576);
});
void test('ordinary glob and ball weights stay unchanged', () => {
    const glob = {
        otyp: GLOB_OF_GRAY_OOZE,
        oclass: 7,
        quan: 1,
        owt: 20,
        globby: true,
    };
    assert.equal(objectWeight(glob), 20);
    const ball = { otyp: HEAVY_IRON_BALL, oclass: 1, quan: 1, owt: 480 };
    assert.equal(objectWeight(ball), 480);
});
//# sourceMappingURL=mkobj_weight_cast.test.js.map