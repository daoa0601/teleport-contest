import assert from 'node:assert/strict';
import test from 'node:test';
import { SICK_NONVOMITABLE } from '../js/const.js';
import { bot, flush_screen } from '../js/display.js';
import { startHeroSickness } from '../js/hero_illness.js';
import { pushKeys } from '../js/input.js';
import { setHeroSlimingTimeout } from '../js/slime.js';
import { castCureSickness } from '../js/spell_misc_effects.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';

void test('curing sickness and sliming removes both displayed conditions', async () => {
    freshObjectRoom();
    await startHeroSickness({ turns: 10, type: SICK_NONVOMITABLE });
    await setHeroSlimingTimeout(10);
    await bot();
    pushKeys(' '.repeat(10));

    await castCureSickness();
    await flush_screen(1);

    assert.doesNotMatch(requireScreenRow(23).map(cell => cell.ch).join(''), /\b(?:Slime|TermIll)\b/);
});
