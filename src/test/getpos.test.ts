import test from 'node:test';
import assert from 'node:assert/strict';

import { isGetposFeatureSymbol } from '../js/getpos.js';

void test('getpos distinguishes default cmap keys from unknown directions', () => {
    for (const ch of ['_', '<', '>', '^', '"', '0', '#', '\\'] as const)
        assert.equal(isGetposFeatureSymbol(ch), true, ch);

    for (const ch of ['a', 'e', 'q', 'Z'] as const)
        assert.equal(isGetposFeatureSymbol(ch), false, ch);
});

void test('getpos also accepts active DECgraphics cmap keys', () => {
    for (const ch of ['g', 'y', 'z', 'x', 'q', 'o', 's'] as const)
        assert.equal(isGetposFeatureSymbol(ch, 'DECgraphics'), true, ch);

    assert.equal(isGetposFeatureSymbol('q', 'default'), false);
    assert.equal(isGetposFeatureSymbol('qq', 'DECgraphics'), false);
});
