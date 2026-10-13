import test from 'node:test';
import assert from 'node:assert/strict';

import { isGetposFeatureSymbol } from '../js/getpos.js';
import { selectMapPosition } from '../js/getpos.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';

void test('getpos distinguishes default cmap keys from unknown directions', () => {
    for (const ch of ['_', '<', '>', '^', '"', '0', '#', '\\'] as const)
        assert.equal(isGetposFeatureSymbol(ch), true, ch);

    for (const ch of ['a', 'e', 'q', 'Z'] as const)
        assert.equal(isGetposFeatureSymbol(ch), false, ch);
});

void test('a lowercase DEC drawing letter remains an unknown direction during selection', async () => {
    freshObjectRoom({ flags: { tips: false, verbose: false } });
    game.symset = 'DECgraphics';
    const input = resetInputState();

    const selection = await answerPrompts(selectMapPosition({
        start: { x: 10, y: 10 }, prompt: 'Choose a location.', goal: 'a location',
    }), input, [
        { prompt: /Choose a location\./, keys: 's' },
        { prompt: /Unknown direction: 's' \(use 'h', 'j', 'k', 'l' or '\.'\)\./, keys: '.' },
    ]);

    assert.equal(selection?.x, 10);
    assert.equal(selection?.y, 10);
});

void test('getpos also accepts active DECgraphics cmap keys', () => {
    for (const ch of ['\xe7', '\xf9', '\xfa', '\xf8', '\xf1', '\xef', '\xf3'] as const)
        assert.equal(isGetposFeatureSymbol(ch, 'DECgraphics'), true, ch);

    assert.equal(isGetposFeatureSymbol('q', 'default'), false);
    assert.equal(isGetposFeatureSymbol('qq', 'DECgraphics'), false);
});
