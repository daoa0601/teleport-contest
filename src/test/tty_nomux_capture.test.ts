import assert from 'node:assert/strict';
import test from 'node:test';
import { nomuxRawPaintText } from '../js/tty_nomux.js';

void test('raw line text clips at the shadow column bounds', () => {
    assert.deepEqual(nomuxRawPaintText('score', 0, 80), { col: 0, text: 'score' });
    assert.deepEqual(nomuxRawPaintText('score', 78, 80), { col: 78, text: 'sc' });
    assert.deepEqual(nomuxRawPaintText('score', 80, 80), { col: 80, text: '' });
    assert.deepEqual(nomuxRawPaintText('score', 125, 80), { col: 125, text: '' });
    assert.deepEqual(nomuxRawPaintText('score', -2, 80), { col: 0, text: 'ore' });
});
