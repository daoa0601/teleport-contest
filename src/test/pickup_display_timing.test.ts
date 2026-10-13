import assert from 'node:assert/strict';
import test from 'node:test';

import { flush_screen, newsym, pline } from '../js/display.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { placeHeroOnLevel } from '../js/hero_location.js';
import { resetInputState } from '../js/input.js';
import { APPLE, FOOD_RATION } from '../js/object_data.js';
import { autopickupAtHero } from '../js/pickup.js';
import { vision_recalc } from '../js/vision.js';
import { floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('walking onto a floor pile redraws the hero before acknowledging an older message', async () => {
    freshObjectRoom({ heroX: 10, heroY: 10, flags: { pickup: false } });
    await floorObject(APPLE, 11, 10);
    await floorObject(FOOD_RATION, 11, 10);
    await flush_screen(1);
    await pline('You hear a creature in the corridor.');
    await placeHeroOnLevel(11, 10);
    newsym(10, 10);
    vision_recalc(1);
    const input = resetInputState();

    const inspection = autopickupAtHero();
    await input.waitUntilBlocked();
    const display = requireGameDisplay(game);
    const message = display.grid[0]?.map(cell => cell.ch).join('') ?? '';
    const destinationGlyph = display.grid[11]?.[10]?.ch;
    input.feed(' '.repeat(10));
    await inspection;

    assert.match(message, /creature in the corridor\.--More--/);
    assert.equal(destinationGlyph, '@', 'the message pager must show the hero at the newly entered pile');
});
