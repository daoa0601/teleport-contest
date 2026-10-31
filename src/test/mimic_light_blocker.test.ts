import assert from 'node:assert/strict';
import test from 'node:test';

import { M_AP_OBJECT, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { setMimicAppearance } from '../js/makemon.js';
import { BOULDER, FOOD_RATION } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

// C makemon.c:set_mimic_sym() finishes with
//     if (does_block(mx, my, &levl[mx][my]))
//         block_point(mx, my);
// so only a disguise that itself obstructs light joins the blocker table
// and defers a vision_recalc().  A mimic imitating an ordinary floor object
// leaves the visibility map untouched; a deferred recalculation here would
// be consumed by the next newsym pass and redraw the map one draw early.
void test('a mimic imitating an ordinary object defers no vision recalculation', async () => {
    await freshObjectRoom();
    const mimic = await createMonsterAt('giant mimic', 12, 10, MM_NOGRP | NO_MINVENT);
    await floorObject(FOOD_RATION, 12, 10);
    game.vision_full_recalc = 0;

    await setMimicAppearance(mimic);

    assert.equal(mimic.m_ap_type, M_AP_OBJECT, 'the mimic adopts the pile top');
    assert.equal(mimic.mappearance, FOOD_RATION, 'it imitates the food ration');
    assert.equal(game.vision_full_recalc, 0,
        'an unobstructive disguise must not defer a vision recalculation');
});

// The boulder disguise is the blocking case: does_block() is true, so
// block_point() runs and the cell the hero sees schedules the refresh.
void test('a mimic imitating a boulder defers a vision recalculation', async () => {
    await freshObjectRoom();
    const mimic = await createMonsterAt('giant mimic', 12, 10, MM_NOGRP | NO_MINVENT);
    await floorObject(BOULDER, 12, 10);
    game.vision_full_recalc = 0;

    await setMimicAppearance(mimic);

    assert.equal(mimic.mappearance, BOULDER, 'the mimic adopts the boulder');
    assert.equal(game.vision_full_recalc, 1,
        'a light-blocking disguise defers the vision refresh');
});
