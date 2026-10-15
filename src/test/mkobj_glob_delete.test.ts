import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { placeCreatedObject } from '../js/floor_object.js';
import { pushKeys } from '../js/input.js';
import { GLOB_OF_GRAY_OOZE } from '../js/object_data.js';
import { scheduleObjectTimer, stopObjectTimer, OBJECT_TIMER_KIND } from '../js/object_timers.js';
import { addShopObjectToBill, billForObject } from '../js/shk.js';
import { runDueTimers } from '../js/timer_effects.js';
import { knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { createMonsterAt } from './support/monsters.js';
import { createStaffedShop } from './support/shop.js';

void test('a dissolved unpaid glob remains on the used-up shop bill', async () => {
    freshObjectRoom();
    await createStaffedShop();
    const glob = placeCreatedObject(await knownObject(GLOB_OF_GRAY_OOZE), 12, 10);
    await addShopObjectToBill(glob, game, { ininv: false, silent: true });
    glob.owt = 1;
    stopObjectTimer(glob, OBJECT_TIMER_KIND.SHRINK_GLOB);
    scheduleObjectTimer(glob, OBJECT_TIMER_KIND.SHRINK_GLOB, game.moves, game);
    pushKeys(' '.repeat(100));

    await runDueTimers();

    assert.equal(glob.where, 'onbill');
    assert.ok(game.billObjects?.includes(glob));
    assert.equal(billForObject(glob)?.entry.useup, true);
    assert.equal(glob.unpaid, false);
});

void test('a snake loses its hiding place when the covering glob dissolves', async () => {
    freshObjectRoom();
    const glob = placeCreatedObject(await knownObject(GLOB_OF_GRAY_OOZE), 12, 10);
    const snake = await createMonsterAt('garter snake', 12, 10);
    snake.mundetected = 1;
    glob.owt = 1;
    stopObjectTimer(glob, OBJECT_TIMER_KIND.SHRINK_GLOB);
    scheduleObjectTimer(glob, OBJECT_TIMER_KIND.SHRINK_GLOB, game.moves, game);
    pushKeys(' '.repeat(100));

    await runDueTimers();

    assert.equal(snake.mundetected, 0);
    assert.equal(glob.where, 'gone');
});
