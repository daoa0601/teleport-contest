import assert from 'node:assert/strict';
import test from 'node:test';
import { HUNGRY } from '../js/const.js';
import { bot, flush_screen } from '../js/display.js';
import { game } from '../js/gstate.js';
import { fixPrayerTrouble, Trouble } from '../js/prayer_trouble.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';

void test('prayer displays restored nutrition after curing hunger', async () => {
    freshObjectRoom({ hero: { uhs: HUNGRY, uhunger: 100 } });
    await bot();

    await fixPrayerTrouble(Trouble.HUNGRY);
    await flush_screen(1);

    assert.equal(game.u.uhunger, 900);
    assert.doesNotMatch(requireScreenRow(23).map(cell => cell.ch).join(''), /Hungry/);
});
