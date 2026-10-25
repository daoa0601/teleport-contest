// C light.c:snuff_light_source() extinguishes at most one source per
// location: the newest in light_base creation order.  A square holding two
// burning objects therefore keeps the older one lit through a darkness
// effect, and steal.c:mpickobj()'s engulfer snuff hits the newest source on
// the engulfer's square, which need not be the object being swallowed.
import test from 'node:test';
import assert from 'node:assert/strict';

import { beginObjectBurn, lightRoom } from '../js/light.js';
import { flush_screen } from '../js/display.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { unlinkObject } from '../js/object_location.js';
import { saveGame, restoreGame } from '../js/save.js';
import { memoryStorage } from './support/memory-storage.js';
import { OIL_LAMP, WAX_CANDLE } from '../js/object_data.js';
import { NO_MINVENT } from '../js/const.js';
import { cansee, vision_recalc, vision_reset } from '../js/vision.js';
import { floorObjectsAt } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { freshConnectedLevels } from './support/connected-levels.js';
import { gotoLevel } from '../js/level_change.js';
import { installPagerInput } from './support/pager-input.js';

function freshDarkRoom() {
    const level = freshObjectRoom({ left: 2, right: 30 });
    requirePlayingGame(game);
    for (let x = 2; x <= 30; x++)
        for (let y = 6; y <= 14; y++) {
            level.requireAt(x, y).lit = false;
            level.requireAt(x, y).waslit = false;
        }
    vision_reset();
    vision_recalc(0);
    const input = resetInputState();
    installPagerInput(input, {
        expected: /darkness|candle|Candle|lamp|Lamp|flame|Flame/,
        limit: 24,
    });
    return input;
}

for (const newest of ['lamp', 'candles'] as const) {
    void test(`a darkness effect snuffs only the ${newest} of two burning stacks sharing a square`, async () => {
        freshDarkRoom();
        const candles = await floorObject(WAX_CANDLE, 15, 10, { quantity: 9, age: 400 });
        const lamp = await floorObject(OIL_LAMP, 15, 10, { age: 400 });
        assert.ok(candles && lamp);
        // The candle stack is lit first; the lamp follows, so the lamp owns
        // the newer light source in light_base order.
        if (newest === 'lamp') {
            assert.equal(beginObjectBurn(candles), true);
            assert.equal(beginObjectBurn(lamp), true);
        } else {
            assert.equal(beginObjectBurn(lamp), true);
            assert.equal(beginObjectBurn(candles), true);
        }
        vision_recalc(0);
        assert.equal(cansee(18, 10), true);

        await lightRoom(false);

        const survivor = newest === 'lamp' ? candles : lamp;
        const snuffed = newest === 'lamp' ? lamp : candles;
        assert.equal(!!survivor.lamplit, true,
            'the older light source keeps burning where only one is snuffed');
        assert.equal(!!snuffed.lamplit, false);
        vision_recalc(0);
        assert.equal(cansee(15, 10), true,
            'the surviving source still lights its own square');
        await flush_screen(1);
    });
}

void test('a restore reverses the saved light order, so the older light takes the next snuff', async () => {
    freshDarkRoom();
    const candles = await floorObject(WAX_CANDLE, 15, 10, { quantity: 9, age: 400 });
    const lamp = await floorObject(OIL_LAMP, 15, 10, { age: 400 });
    assert.ok(candles && lamp);
    assert.equal(beginObjectBurn(candles), true);
    assert.equal(beginObjectBurn(lamp), true);

    game.plname = 'Snufford';
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame('Snufford', storage), true);
    const revivedCandles = floorObjectsAt(requireGameLevel(), 15, 10)
        .find(object => object.otyp === WAX_CANDLE);
    const revivedLamp = floorObjectsAt(requireGameLevel(), 15, 10)
        .find(object => object.otyp === OIL_LAMP);
    assert.ok(revivedCandles && revivedLamp);
    assert.equal(!!revivedCandles.lamplit, true);
    assert.equal(!!revivedLamp.lamplit, true);

    // save_light_sources() writes the batch newest-first and
    // restore_light_sources() pushes each entry back onto the front of
    // light_base, so the previously-older candle now sits at the head and
    // takes the darkness snuff (light.c:479-493).
    await lightRoom(false);

    assert.equal(!!revivedCandles.lamplit, false,
        'the restored head is the previously-older candle');
    assert.equal(!!revivedLamp.lamplit, true);
});

void test('re-entering a level reverses its saved light order', async () => {
    freshConnectedLevels();
    requirePlayingGame(game);
    installPagerInput(resetInputState(), {
        expected: /You climb|You descend|You ascend|materialize|You find|welcome|feeling|It is|You see|You hear|darkness|candle|Candle|lamp|Lamp|lantern|Lantern|flame|Flame/,
        limit: 32,
    });
    for (let x = 2; x <= 30; x++)
        for (let y = 6; y <= 14; y++) {
            const at = game.level?.at(x, y);
            if (at) at.lit = false;
        }
    const candles = await floorObject(WAX_CANDLE, 15, 10, { quantity: 9, age: 4000 });
    const lamp = await floorObject(OIL_LAMP, 15, 10, { age: 4000 });
    assert.ok(candles && lamp);
    assert.equal(beginObjectBurn(candles), true);
    assert.equal(beginObjectBurn(lamp), true);

    await gotoLevel({ dnum: 0, dlevel: 2 }, { arrival: 'stairs' });
    await gotoLevel({ dnum: 0, dlevel: 1 }, { arrival: 'stairs' });

    const backCandles = floorObjectsAt(requireGameLevel(), 15, 10)
        .find(object => object.otyp === WAX_CANDLE);
    const backLamp = floorObjectsAt(requireGameLevel(), 15, 10)
        .find(object => object.otyp === OIL_LAMP);
    assert.ok(backCandles && backLamp);
    assert.equal(!!backCandles.lamplit, true);
    assert.equal(!!backLamp.lamplit, true);

    // getlev() restores the level's light batch onto the front of
    // light_base, reversed, so the older candle becomes the head and the
    // darkness snuff takes it while the newer lamp keeps burning.
    await lightRoom(false);

    assert.equal(!!backCandles.lamplit, false);
    assert.equal(!!backLamp.lamplit, true);
});

void test('an engulfer snuffs the newest source on its square rather than the swallowed one', async () => {
    freshDarkRoom();
    const worm = await createMonsterAt('purple worm', 15, 10, NO_MINVENT);
    // The candle burns on the worm's square first, then a lamp is lit there.
    const candles = await floorObject(WAX_CANDLE, 15, 10, { quantity: 4, age: 400 });
    assert.ok(candles);
    assert.equal(beginObjectBurn(candles), true);
    const lamp = await floorObject(OIL_LAMP, 15, 10, { age: 400 });
    assert.ok(lamp);
    assert.equal(beginObjectBurn(lamp), true);
    vision_recalc(0);

    unlinkObject(candles, game);
    const carried = await addObjectToMonsterInventory(worm, candles);

    assert.ok(carried === candles);
    assert.equal(!!candles.lamplit, true,
        'the swallowed stack keeps burning; snuff_light_source found the newer lamp');
    assert.equal(!!lamp.lamplit, false,
        'the newer floor lamp is the source the snuff extinguished');
    assert.equal(floorObjectsAt(requireGameLevel(), 15, 10).includes(lamp), true);
});
