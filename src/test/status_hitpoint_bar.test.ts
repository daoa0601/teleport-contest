import assert from 'node:assert/strict';
import test from 'node:test';
import { bot } from '../js/display.js';
import { ATR_INVERSE } from '../js/terminal.js';
import { ATR_BLINK } from '../js/terminal_attributes.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';

void test('a half-full title bar inverts half its fixed thirty-character title', async () => {
    freshObjectRoom({ flags: { hitpointbar: true }, hero: { uhp: 20, uhpmax: 40 } });

    await bot();

    const row = requireScreenRow(22);
    const text = row.map(cell => cell.ch).join('');
    assert.equal(text.charAt(0), '[');
    assert.equal(text.charAt(31), ']');
    assert.equal(text.indexOf('St:'), 33);
    assert.equal(row[15]?.attr, ATR_INVERSE);
    assert.equal(row[16]?.attr, 0);
});

void test('a nonzero health fraction keeps one inverted character even above the display cap', async () => {
    freshObjectRoom({ flags: { hitpointbar: true }, hero: { uhp: 1, uhpmax: 100000 } });

    await bot();

    const row = requireScreenRow(22);
    assert.equal((row[1]?.attr ?? 0) & ATR_INVERSE, ATR_INVERSE);
    assert.equal((row[2]?.attr ?? 0) & ATR_INVERSE, 0);
    assert.match(row.map(cell => cell.ch).join(''), / - - - -\]/);
});

void test('a critically injured title blinks across its inverted and remaining portions', async () => {
    freshObjectRoom({ flags: { hitpointbar: true }, hero: { uhp: 2, uhpmax: 40 } });

    await bot();

    const row = requireScreenRow(22);
    assert.equal(row[0]?.attr, 0, 'the opening bracket stays plain');
    assert.equal(row[1]?.attr, ATR_INVERSE | ATR_BLINK, 'remaining health is inverted and blinking');
    assert.equal(row[2]?.attr, ATR_BLINK, 'the rest of the title keeps blinking');
    assert.equal(row[30]?.attr, ATR_BLINK, 'blinking reaches the end of the padded title');
    assert.equal(row[31]?.attr, 0, 'the closing bracket stays plain');
    assert.equal(row[33]?.attr, 0, 'attributes do not extend into strength');
});
