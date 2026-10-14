import assert from 'node:assert/strict';
import test from 'node:test';
import { bot } from '../js/display.js';
import { runSegment } from '../js/jsmain.js';
import { ATR_INVERSE } from '../js/terminal.js';
import { ATR_BLINK } from '../js/terminal_attributes.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';

void test('the legacy story retains the inverted title and pre-equipment status rows', async () => {
    const engine = await runSegment({
        seed: 127,
        datetime: '20260801120000',
        nethackrc: 'OPTIONS=name:Traveler,role:Wizard,race:human,gender:male,'
            + 'align:neutral,legacy,hitpointbar,!tutorial,pettype:none',
        moves: '',
        storage: memoryStorage(),
    });

    assert.match(requireScreenRow(17).map(cell => cell.ch).join(''), /--More--/);
    const title = requireScreenRow(22);
    assert.equal(title.map(cell => cell.ch).join('').indexOf('St:'), 33);
    assert.equal(title[0]?.ch, '[');
    assert.equal(title[0]?.attr, 0);
    assert.equal(title[1]?.attr, ATR_INVERSE);
    assert.equal(title[30]?.attr, ATR_INVERSE, 'full health inverts the padded title');
    assert.equal(title[31]?.ch, ']');
    assert.equal(title[31]?.attr, 0);
    assert.equal(title[33]?.attr, 0, 'strength stays plain');
    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /AC:0 /);
    assert.ok(engine.state.u.uac !== undefined && engine.state.u.uac > 0 && engine.state.u.uac < 10,
        'starting armor is already equipped underneath the story');
});

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
