import assert from 'node:assert/strict';
import test from 'node:test';
import { NO_MINVENT } from '../js/const.js';
import { canSeeMonster, flush_screen, glyphAt, redrawMap } from '../js/display.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { OIL_LAMP, WAX_CANDLE } from '../js/object_data.js';
import { cansee, vision_recalc, vision_reset } from '../js/vision.js';
import { applyInventoryObject, dropInventoryObject, kickDirection, throwInventoryObject, } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
import { requireScreenRow } from './support/screen.js';
function darkRoom() {
    const level = freshObjectRoom({
        left: 2, right: 30, top: 2, bottom: 18,
        hero: { acurr: { a: [18, 12, 12, 12, 12, 12] } },
    });
    for (let x = 2; x <= 30; x++)
        for (let y = 2; y <= 18; y++)
            level.requireAt(x, y).lit = false;
    vision_reset();
    vision_recalc(0);
    installPagerInput(resetInputState(), { expected: /lamp|candle|flame/, limit: 12 });
    return level;
}
void test('a thrown lamp reveals a nearby monster in passing and remembers it after the light moves away', async () => {
    darkRoom();
    const lamp = await addInventoryObject(OIL_LAMP, { age: 200 });
    await applyInventoryObject(lamp);
    const monster = await createMonsterAt('kobold', 14, 12, NO_MINVENT);
    vision_recalc(0);
    assert.equal(canSeeMonster(monster), false);
    let sawMonster = false;
    game.animationFrame = async () => { sawMonster ||= canSeeMonster(monster); };
    await throwInventoryObject(lamp);
    vision_recalc(0);
    assert.equal(sawMonster, true, 'The lamp must reveal monsters beside its flight path');
    assert.equal(canSeeMonster(monster), false);
    assert.equal(glyphAt(14, 12)?.kind, 'invisible');
    assert.equal(lamp.where, 'floor');
    assert.equal(lamp.lamplit, true);
});
void test('a thrown candle reveals distant floor before its flame is extinguished on landing', async () => {
    darkRoom();
    const candle = await addInventoryObject(WAX_CANDLE, { age: 200 });
    await applyInventoryObject(candle);
    let sawDistantFloor = false;
    game.animationFrame = async () => { sawDistantFloor ||= cansee(17, 10); };
    await throwInventoryObject(candle);
    vision_recalc(0);
    assert.equal(sawDistantFloor, true, 'The candle must illuminate floor while it is in flight');
    assert.equal(cansee(17, 10), false);
    assert.equal(candle.lamplit, false);
    assert.match(game._pending_message, /candle's flame is extinguished/);
});
for (const action of ['thrown', 'kicked']) {
    void test(`a ${action} lit lamp stays visible between flight steps`, async () => {
        freshObjectRoom({
            right: 30,
            hero: { acurr: { a: [18, 18, 18, 12, 12, 12] } },
        });
        installPagerInput(resetInputState(), { expected: /lamp|kick/i, limit: 12 });
        const lamp = await addInventoryObject(OIL_LAMP, { age: 200 });
        await applyInventoryObject(lamp);
        if (action === 'kicked') {
            await dropInventoryObject(lamp);
            game.u.ux--;
            vision_recalc(0);
        }
        await redrawMap();
        const visibleColumns = new Set();
        game.animationFrame = async () => {
            const lamps = requireScreenRow(11)
                .flatMap((cell, column) => cell.ch === '(' ? [column] : []);
            if (!lamps.length && !visibleColumns.size)
                return;
            assert.equal(lamps.length, 1, `The ${action} lamp must stay visible while its light moves`);
            for (const column of lamps)
                visibleColumns.add(column);
        };
        if (action === 'thrown')
            await throwInventoryObject(lamp);
        else
            await kickDirection('l');
        delete game.animationFrame;
        await flush_screen(0);
        assert.ok(visibleColumns.size > 1, 'The lamp must cross multiple visible squares');
        assert.equal(lamp.where, 'floor');
        const lamps = requireScreenRow(11)
            .flatMap((cell, column) => cell.ch === '(' ? [column] : []);
        assert.deepEqual(lamps, [lamp.ox - 1], 'Only the landed lamp remains on the map');
    });
}
//# sourceMappingURL=transient_object_light.test.js.map