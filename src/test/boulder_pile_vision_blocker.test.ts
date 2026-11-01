import assert from 'node:assert/strict';
import test from 'node:test';

import { game } from '../js/gstate.js';
import { BOULDER, FOOD_RATION } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

// C mkobj.c:place_object() only feeds a placed boulder into the vision
// blocker table when the pile top is not already a boulder:
//
//     if (otmp->otyp == BOULDER) {
//         if (!otmp2 || otmp2->otyp != BOULDER)
//             block_point(x, y); /* vision */
//     }
//
// block_point() defers a vision_recalc() when the hero sees the square.
// Stacking a second boulder onto a boulder-topped pile must leave that
// deferred recalc unrequested: an extra refresh there repaints the hero's
// map from stale-blocker sight one monster turn early, which native play
// never shows (a light-carrying monster's remembered trail stays at its
// previous square instead of being revealed at the new one).
void test('the first boulder on a seen square defers a vision recalculation', async () => {
    await freshObjectRoom();
    game.vision_full_recalc = 0;

    await floorObject(BOULDER, 12, 10);

    assert.equal(game.vision_full_recalc, 1,
        'a boulder joining an empty pile blocks light and requests the refresh');
});

void test('a boulder landing on a boulder defers no vision recalculation', async () => {
    await freshObjectRoom();
    await floorObject(BOULDER, 12, 10);
    game.vision_full_recalc = 0;

    await floorObject(BOULDER, 12, 10);

    assert.equal(game.vision_full_recalc, 0,
        'a pile already topped by a boulder blocks no additional light');
});

void test('a boulder landing on an ordinary object still defers the recalculation', async () => {
    await freshObjectRoom();
    await floorObject(FOOD_RATION, 12, 10);
    game.vision_full_recalc = 0;

    await floorObject(BOULDER, 12, 10);

    assert.equal(game.vision_full_recalc, 1,
        'a boulder topping a ration pile newly blocks light at that square');
});
