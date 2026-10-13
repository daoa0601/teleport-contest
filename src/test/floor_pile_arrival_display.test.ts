import test from 'node:test';
import assert from 'node:assert/strict';
import { newsym, pline } from '../js/display.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { APPLE, DAGGER } from '../js/object_data.js';
import { autopickupAtHero } from '../js/pickup.js';
import { vision_recalc } from '../js/vision.js';
import { floorObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';

void test('arrival at a floor pile redraws the hero before acknowledging earlier prose', async () => {
    freshObjectRoom({ flags: { pickup: false } });
    await floorObject(APPLE, 11, 10);
    await floorObject(DAGGER, 11, 10);
    await pline('You hear a dog growl.');
    game.u.ux = 11;
    newsym(10, 10);
    vision_recalc(1);
    const input = resetInputState();
    const looking = autopickupAtHero();
    await input.waitUntilBlocked();
    const heroAtPager = requireGameDisplay().grid[11]?.[10]?.ch;
    input.feed(' ');
    await answerPrompts(looking, input, [
        { prompt: /Things that are here:/, keys: ' ' },
    ]);

    assert.equal(heroAtPager, '@');
});
