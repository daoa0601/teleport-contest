import test from 'node:test';
import assert from 'node:assert/strict';

import { d, enableRngLog, getRngLog, initRng, rne, rnl, rnz } from '../js/rng.js';
import { LUCKSTONE } from '../js/object_data.js';
import { freshGame } from './support/game-state.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

function firstLuckOutcome(luck: number) {
    freshGame({ hero: { uluck: luck } });
    initRng(1n);
    return rnl(20);
}

void test('live rnl biases the same base draw according to current Luck', () => {
    const neutral = firstLuckOutcome(0);
    const fortunate = firstLuckOutcome(5);
    const unfortunate = firstLuckOutcome(-5);

    assert.ok(fortunate < neutral);
    assert.ok(unfortunate > neutral);
    assert.ok(fortunate >= 0);
    assert.ok(unfortunate < 20);
});

void test('a carried luckstone improves luck-sensitive decisions', async () => {
    freshObjectRoom({ hero: { uluck: 0 } });
    initRng(1n);
    const withoutStone = rnl(20);

    await addInventoryObject(LUCKSTONE, { blessed: true });
    initRng(1n);
    const withStone = rnl(20);

    assert.ok(withStone < withoutStone);
});

// C rnd.c:rnl(): ranges up to 15 first shrink Luck to roughly a third,
// rounding away from zero, and skip the adjustment roll entirely when that
// leaves no adjustment.
void test('rnl reduces Luck to a third for small ranges before rolling', () => {
    const nestedRoll = (luck: number) => {
        freshGame({ hero: { uluck: luck, moreluck: 0 } });
        initRng(1n);
        enableRngLog();
        rnl(10);
        return getRngLog().filter(entry => entry.startsWith('rn2('));
    };

    for (const luck of [0, 1, -1]) {
        assert.deepEqual(nestedRoll(luck), [],
            `luck ${luck} needs no adjustment roll for rnl(10)`);
    }
    for (const luck of [2, -2, 4, -4]) {
        assert.deepEqual(nestedRoll(luck).map(entry => entry.replace(/=\d+$/, '')),
            ['rn2(38)'], `luck ${luck} adjusts rnl(10) by one`);
    }
    assert.deepEqual(nestedRoll(5).map(entry => entry.replace(/=\d+$/, '')), ['rn2(39)'],
        'luck 5 adjusts rnl(10) by two');
    assert.deepEqual(nestedRoll(13).map(entry => entry.replace(/=\d+$/, '')), ['rn2(41)'],
        'luck 13 shrinks to four for rnl(10)');
});

void test('rnl keeps full Luck once the range exceeds fifteen', () => {
    freshGame({ hero: { uluck: 13, moreluck: 0 } });
    initRng(1n);
    enableRngLog();
    rnl(20);
    assert.deepEqual(getRngLog().filter(entry => entry.startsWith('rn2(')),
        ['rn2(50)=4'], 'the nested roll covers all thirteen points of Luck');
});

void test('rnl clamps adjusted draws into the requested range', () => {
    let highClampSeen = false, lowClampSeen = false;
    for (let seed = 1n; seed < 40n && !(highClampSeen && lowClampSeen); seed++) {
        freshGame({ hero: { uluck: 0, moreluck: 0 } });
        initRng(seed);
        const base = rnl(10);

        freshGame({ hero: { uluck: -13, moreluck: 0 } });
        initRng(seed);
        enableRngLog();
        const unlucky = rnl(10);
        const unluckyAdjusted = getRngLog().length === 2;
        if (unluckyAdjusted) {
            assert.equal(unlucky, Math.min(9, base + 4));
            if (base + 4 > 9) highClampSeen = true;
        }

        freshGame({ hero: { uluck: 13, moreluck: 0 } });
        initRng(seed);
        enableRngLog();
        const lucky = rnl(10);
        if (getRngLog().length === 2) {
            assert.equal(lucky, Math.max(0, base - 4));
            if (base - 4 < 0) lowClampSeen = true;
        }
    }
    assert.ok(highClampSeen, 'some seed pushes bad luck past the top of the range');
    assert.ok(lowClampSeen, 'some seed pushes good luck below the bottom of the range');
});

// C rnd.c:rne(): the exponent runs up to 5 below experience level 15 and to
// level/3 from there; rne(1) never rolls nonzero, so it always hits the cap.
void test('rne stops at the hero-level cap when every roll returns zero', () => {
    const capped = (ulevel: number) => {
        freshGame({ hero: { ulevel } });
        initRng(1n);
        return rne(1);
    };

    for (const [ulevel, expected] of [
        [1, 5], [14, 5], [15, 5], [16, 5], [21, 7], [30, 10],
    ] as const) {
        assert.equal(capped(ulevel), expected, `experience level ${ulevel}`);
    }
});

// C rnd.c:rnz() draws rn2(1000), then rne(4) with its nested rn2(4) rolls,
// then rn2(2) for the multiply-versus-divide branch, and scales exactly with
// integer division.
void test('rnz draws scale, exponent, and branch in the C order', () => {
    freshGame({ hero: { ulevel: 1 } });
    initRng(7n);
    enableRngLog();
    const result = rnz(100);
    const entries = getRngLog();

    assert.match(entries[0] ?? '', /^rn2\(1000\)=\d+$/);
    const exponentIndex = entries.findIndex(entry => entry.startsWith('rne(4)='));
    assert.ok(exponentIndex > 0, 'rne(4) follows the scale draw');
    for (let index = 1; index < exponentIndex - 1; index++)
        assert.match(entries[index] ?? '', /^rn2\(4\)=0$/,
            'only zero rolls extend the exponent');
    assert.match(entries[exponentIndex - 1] ?? '', /^rn2\(4\)=[1-9]$/,
        'a nonzero roll ends the exponent');
    assert.match(entries[exponentIndex + 1] ?? '', /^rn2\(2\)=\d+$/);
    assert.match(entries.at(-1) ?? '', /^rnz\(100\)=\d+$/);

    const scale = 1000 + Number(/=([0-9]+)$/.exec(entries[0] ?? '')?.[1]);
    const exponent = Number(/=([0-9]+)$/.exec(entries[exponentIndex] ?? '')?.[1]);
    const divisor = Number(/=([0-9]+)$/.exec(entries[exponentIndex + 1] ?? '')?.[1]) === 0;
    assert.equal(result, divisor
        ? Math.trunc(100 * 1000 / (scale * exponent))
        : Math.trunc(100 * (scale * exponent) / 1000));
});

void test('d rolls every die through the core stream as one logged call', () => {
    freshGame();
    initRng(3n);
    enableRngLog();
    const total = d(3, 6);

    assert.ok(total >= 3 && total <= 18);
    assert.deepEqual(getRngLog().map(entry => entry.replace(/=\d+$/, '')), ['d(3,6)']);
    assert.equal(d(0, 6), 0, 'zero dice roll no draws and return the empty total');
});
