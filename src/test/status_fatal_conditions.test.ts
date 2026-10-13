import assert from 'node:assert/strict';
import test from 'node:test';
import { SICK_NONVOMITABLE, SICK_VOMITABLE } from '../js/const.js';
import { bot, flush_screen, plineWithContinuation } from '../js/display.js';
import { cureHeroSickness, startHeroSickness } from '../js/hero_illness.js';
import { setHeroSlimingTimeout } from '../js/slime.js';
import { fixHeroPetrification, setHeroPetrificationTimeout } from '../js/stoning.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';

function status(): string {
    return requireScreenRow(23).map(cell => cell.ch).join('');
}

void test('curing petrification removes Stone when the cure feedback is displayed', async () => {
    freshObjectRoom();
    await setHeroPetrificationTimeout(5);
    await bot();
    assert.match(status(), /\bStone\b/);

    await fixHeroPetrification();
    await flush_screen(1);

    assert.match(requireScreenRow(0).map(cell => cell.ch).join(''), /You feel limber!/);
    assert.doesNotMatch(status(), /\bStone\b/);
});

for (const [type, label] of [
    [SICK_VOMITABLE, 'FoodPois'], [SICK_NONVOMITABLE, 'TermIll'],
] as const) {
    void test(`${label} appears on the next message flush and disappears after a cure`, async () => {
        freshObjectRoom();
        await bot();

        await startHeroSickness({ turns: 20, type });
        await plineWithContinuation('You wait.');

        assert.match(status(), new RegExp(`\\b${label}\\b`));
        cureHeroSickness();
        await flush_screen(1);
        assert.doesNotMatch(status(), new RegExp(`\\b${label}\\b`));
    });
}

void test('simultaneous fatal conditions follow native severity order', async () => {
    freshObjectRoom();
    await startHeroSickness({ turns: 20, type: SICK_VOMITABLE | SICK_NONVOMITABLE });
    await setHeroSlimingTimeout(10);
    await setHeroPetrificationTimeout(5);

    await flush_screen(1);

    assert.match(status(), /Stone Slime FoodPois TermIll/);
    await setHeroPetrificationTimeout(0);
    await setHeroSlimingTimeout(0);
    await flush_screen(1);
    assert.doesNotMatch(status(), /Stone|Slime/);
    assert.match(status(), /FoodPois TermIll/);
});
