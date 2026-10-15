import assert from 'node:assert/strict';
import test from 'node:test';

import { FOUNTAIN, POOL } from '../js/const.js';
import { newsym } from '../js/display.js';
import { selectMapPosition } from '../js/getpos.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';

void test('valid-location cycling falls back to interesting features without a validity rule', async () => {
    const level = freshObjectRoom({ flags: { tips: false, verbose: false } });
    level.requireAt(12, 10).typ = FOUNTAIN;
    newsym(12, 10);
    const nextValid = game.commandBindings.specialKey('getpos.valid.next');
    assert.ok(nextValid !== undefined);
    resetInputState().feed([nextValid, '.']);

    const selected = await selectMapPosition({
        start: { x: 10, y: 10 }, prompt: 'Pick a feature.', goal: 'a feature', force: false,
    });

    assert.equal(selected?.x, 12);
    assert.equal(selected?.y, 10);
});

void test('interesting-target cycling skips pools in favor of dungeon features', async () => {
    const level = freshObjectRoom({ flags: { tips: false, verbose: false } });
    level.requireAt(11, 10).typ = POOL;
    level.requireAt(12, 10).typ = FOUNTAIN;
    newsym(11, 10);
    newsym(12, 10);
    resetInputState().feed('a.');

    const selected = await selectMapPosition({
        start: { x: 10, y: 10 }, prompt: 'Pick a feature.', goal: 'a feature',
    });

    assert.equal(selected?.x, 12);
    assert.equal(selected?.y, 10);
});
