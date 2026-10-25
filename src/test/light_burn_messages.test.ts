import test from 'node:test';
import assert from 'node:assert/strict';

import { beginObjectBurn } from '../js/light.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { flush_screen } from '../js/display.js';
import { runDueTimers } from '../js/timer_effects.js';
import { NO_MINVENT } from '../js/const.js';
import { CANDELABRUM_OF_INVOCATION, OIL_LAMP } from '../js/object_data.js';
import { vision_recalc } from '../js/vision.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { unlinkObject } from '../js/object_location.js';
import { floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { resetInputState } from '../js/input.js';
import { installPagerInput } from './support/pager-input.js';
import { createMonsterAt } from './support/monsters.js';

function freshRoom() {
    freshObjectRoom({ left: 2, right: 30 });
    installPagerInput(resetInputState(), {
        expected: /candle|lamp|candelabrum|flame/,
        limit: 8,
    });
}

async function burnFor(turns: number) {
    game.moves += turns;
    await runDueTimers();
    await flush_screen(1);
    return requireGameDisplay(game).grid.slice(0, 2)
        .map(row => row.map(cell => cell.ch).join('').trimEnd()).join('\n');
}

// steal.c:mpickobj() snuffs by position after adding the swallowed object.
// light.c:snuff_light_source() selects the newest source there, so only
// that object's timer is cancelled and its unused fuel restored.
void test('an engulfed older candelabrum keeps its burnout timer after the newer lamp is snuffed', async () => {
    freshRoom();
    const worm = await createMonsterAt('purple worm', 15, 10, NO_MINVENT);
    const holder = await floorObject(CANDELABRUM_OF_INVOCATION, 15, 10, { spe: 3, age: 16 });
    const lamp = await floorObject(OIL_LAMP, 15, 10, { age: 1 });
    assert.equal(beginObjectBurn(holder), true);
    assert.equal(beginObjectBurn(lamp), true);
    vision_recalc(0);

    unlinkObject(holder, game);
    await addObjectToMonsterInventory(worm, holder);

    const warning = await burnFor(1);
    assert.match(warning, /The purple worm's candelabrum's candles' flames flicker low!/);
    assert.doesNotMatch(warning, /oil lamp.*(?:go out|gone out)/);
    assert.equal(holder.lamplit, true);
    assert.equal(lamp.lamplit, false);
    assert.equal(lamp.age, 1, 'snuffing preserves the lamp fuel instead of letting its timer expire');

    const burnout = await burnFor(15);
    assert.match(burnout, /The purple worm's candelabrum's flames die\./);
    assert.equal(holder.lamplit, false);
    assert.equal(holder.spe, 0);
});

void test('an engulfed older lamp still flickers while the snuffed newer candelabrum retains its candles', async () => {
    freshRoom();
    const worm = await createMonsterAt('purple worm', 15, 10, NO_MINVENT);
    const lamp = await floorObject(OIL_LAMP, 15, 10, { age: 151 });
    const holder = await floorObject(CANDELABRUM_OF_INVOCATION, 15, 10, { spe: 3, age: 76 });
    assert.equal(beginObjectBurn(lamp), true);
    assert.equal(beginObjectBurn(holder), true);
    vision_recalc(0);

    unlinkObject(lamp, game);
    await addObjectToMonsterInventory(worm, lamp);

    const warning = await burnFor(1);
    assert.match(warning, /The purple worm's oil lamp flickers\./);
    assert.doesNotMatch(warning, /candle.*getting short/);
    assert.equal(lamp.lamplit, true);
    assert.equal(holder.lamplit, false);
    assert.equal(holder.spe, 3);
    assert.equal(holder.age, 76, 'snuffing preserves candle fuel and cancels the pending warning');
});
