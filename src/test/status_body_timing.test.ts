import assert from 'node:assert/strict';
import test from 'node:test';
import { bot, plineWithContinuation } from '../js/display.js';
import { game } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { returnHeroToHumanForm } from '../js/polyself.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';

void test('returning to human form redraws health before its announcement even when AC stays the same', async () => {
    const kobold = MONSTER_NAME.indexOf('kobold');
    assert.ok(kobold >= 0);
    freshObjectRoom({ hero: {
        mtimedone: 100, umonnum: kobold, mh: 7, mhmax: 9, uac: 10,
    } });
    await bot();
    let announcements = 0;

    await returnHeroToHumanForm(game, {
        async publish(message, options) {
            await plineWithContinuation(message, options);
            if (message.includes('return to human form')) {
                assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /HP:40\(40\)/);
                assert.doesNotMatch(requireScreenRow(23).map(cell => cell.ch).join(''), /HD:/);
                announcements++;
            }
        },
    });

    assert.equal(announcements, 1);
    assert.equal(game.u.uac, 10);
});
