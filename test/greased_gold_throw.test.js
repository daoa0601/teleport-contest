import assert from 'node:assert/strict';
import test from 'node:test';
import { flush_screen } from '../js/display.js';
import { game } from '../js/gstate.js';
import { GOLD_PIECE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { setQuiverObject } from '../js/weapon_slots.js';
import { throwInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { fireQuiveredGold } from './support/gold-arena.js';
import { floorObjects } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';
for (const command of ['throw', 'fire']) {
    void test(`${command} announces a greased quivered coin slipping and sends it in the new direction`, async () => {
        const level = await freshObjectRoom({ left: 1, right: 25, top: 1, bottom: 19 });
        const purse = await addInventoryObject(GOLD_PIECE, { quan: 3, greased: true });
        await setQuiverObject(purse);
        initRng(1n);
        if (command === 'throw')
            await throwInventoryObject(purse, 'l');
        else
            await fireQuiveredGold('l');
        await flush_screen(1);
        assert.equal(requireScreenRow(0).map(cell => cell.ch).join('').trimEnd(), 'The gold piece slips as you throw it!');
        assert.equal(purse.quan, 2);
        assert.equal(game.uquiver, purse);
        const landed = floorObjects(level).find(object => object.otyp === GOLD_PIECE);
        assert.ok(landed, 'The thrown coin must land on the floor.');
        assert.equal(landed.quan, 1);
        assert.ok(landed.ox !== 16 || landed.oy !== 10, 'The coin leaves its intended eastward path.');
        assert.equal(Math.sign(landed.ox - 10), game.u.dx, 'The hero retains the slipped horizontal direction.');
        assert.equal(Math.sign(landed.oy - 10), game.u.dy, 'The hero retains the slipped vertical direction.');
        assert.equal(game.context.move, 1);
    });
}
void test('a greased unquivered purse uses the direct gold throw without slipping', async () => {
    const level = await freshObjectRoom({ right: 25 });
    const purse = await addInventoryObject(GOLD_PIECE, { quan: 3, greased: true });
    initRng(1n);
    await throwInventoryObject(purse, 'l');
    assert.equal(purse.where, 'floor');
    assert.equal(purse.quan, 3);
    assert.equal(purse.ox, 16);
    assert.equal(purse.oy, 10);
    assert.ok(floorObjects(level).includes(purse));
    assert.doesNotMatch(game._lastPlineMessage ?? '', /slip/);
});
//# sourceMappingURL=greased_gold_throw.test.js.map