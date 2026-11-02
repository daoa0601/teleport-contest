import test from 'node:test';
import assert from 'node:assert/strict';
import { PIT, POOL, STONE, TT_PIT } from '../js/const.js';
import { liquidFlow } from '../js/dig.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { FOOD_RATION } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
void test('crawling out of a flooded pit describes items on the escape square', async () => {
    const level = await freshObjectRoom({ flags: { pickup: false } });
    for (let x = 9; x <= 11; x++)
        for (let y = 9; y <= 11; y++)
            if (x !== 11 || y !== 10)
                level.requireAt(x, y).typ = STONE;
    level.requireAt(10, 10).typ = POOL;
    await floorObject(FOOD_RATION, 11, 10);
    const input = resetInputState();
    const displayed = [];
    input.beforeRead = () => {
        displayed.push(game._pending_message);
        input.feed(' ');
    };
    await liquidFlow(10, 10, POOL, null, null);
    assert.equal(game.u.ux, 11, 'the hero must crawl onto the only dry neighbor');
    assert.equal(game.u.uy, 10);
    displayed.push(game._pending_message);
    assert.match(displayed.join('\n'), /You see here .*food ration/);
});
void test('crawling out of a flooded pit triggers a trap on the escape square', async () => {
    const level = await freshObjectRoom();
    for (let x = 9; x <= 11; x++)
        for (let y = 9; y <= 11; y++)
            if (x !== 11 || y !== 10)
                level.requireAt(x, y).typ = STONE;
    level.requireAt(10, 10).typ = POOL;
    level.traps.push({ ttyp: PIT, tx: 11, ty: 10, tseen: false, once: false, launch: { x: 0, y: 0 } });
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');
    await liquidFlow(10, 10, POOL, null, null);
    assert.equal(game.u.ux, 11);
    assert.equal(game.u.uy, 10);
    assert.equal(game.u.utraptype, TT_PIT);
    assert.ok(game.u.utrap, 'the escape must leave the hero caught in the destination pit');
});
//# sourceMappingURL=flooded_pit_escape.test.js.map