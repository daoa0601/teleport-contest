import test from 'node:test';
import assert from 'node:assert/strict';

import { isGetposFeatureSymbol } from '../js/getpos.js';

test('getpos distinguishes default cmap keys from unknown directions', () => {
    for (const ch of ['_', '<', '>', '^', '"', '0', '#', '\\'])
        assert.equal(isGetposFeatureSymbol(ch), true, ch);

    for (const ch of ['a', 'e', 'q', 'Z'])
        assert.equal(isGetposFeatureSymbol(ch), false, ch);
});

test('getpos also accepts active DECgraphics cmap keys', () => {
    for (const ch of ['g', 'y', 'z', 'x', 'q', 'o', 's'])
        assert.equal(isGetposFeatureSymbol(ch, 'DECgraphics'), true, ch);

    assert.equal(isGetposFeatureSymbol('q', 'default'), false);
    assert.equal(isGetposFeatureSymbol('qq', 'DECgraphics'), false);
});
