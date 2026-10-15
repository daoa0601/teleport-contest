import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { FOUNTAIN } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { LUCKSTONE, SCR_IDENTIFY } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a carried luckstone protects floor scrolls from overflowing fountain water', async () => {
    const level = freshObjectRoom({ hero: { uluck: 0 } });
    level.requireAt(10, 10).typ = FOUNTAIN;
    await addInventoryObject(LUCKSTONE, { blessed: true });
    assert.equal(game.u.moreluck, 3);
    const scrolls = [];
    for (const [x, y] of [[9, 9], [9, 11], [11, 9], [11, 11]])
        scrolls.push(await floorObject(SCR_IDENTIFY, x, y, { initialize: false }));
    resetInputState().feed('y' + ' '.repeat(10));
    initRng(116n);
    await rhack('q'.charCodeAt(0));
    assert.ok(scrolls.every(scroll => scroll.otyp === SCR_IDENTIFY), 'The hero\'s bonus luck must protect the scrolls that the overflow reaches');
});
//# sourceMappingURL=fountain_overflow_luck.test.js.map