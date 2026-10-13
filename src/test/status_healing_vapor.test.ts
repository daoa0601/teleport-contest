import assert from 'node:assert/strict';
import test from 'node:test';
import { NOT_HUNGRY, SATIATED } from '../js/const.js';
import { bot, flush_screen } from '../js/display.js';
import { game } from '../js/gstate.js';
import { POT_FULL_HEALING } from '../js/object_data.js';
import { applySupportedPotionVapor } from '../js/potion_hit.js';
import { syncBlindness, syncDeafness } from '../js/senses.js';
import { uninitializedObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';

void test('healing vapor at full health keeps deferred hunger hidden when permanent senses remain unchanged', async () => {
    freshObjectRoom({ hero: { uhs: NOT_HUNGRY, permaBlind: true } });
    assert.ok(game.u.uroleplay);
    game.u.uroleplay.deaf = true;
    syncBlindness();
    syncDeafness();
    const potion = await uninitializedObject(POT_FULL_HEALING, { dknown: false });
    await bot();
    game.u.uhs = SATIATED;

    await applySupportedPotionVapor({ potion });
    await flush_screen(1);

    const status = requireScreenRow(23).map(cell => cell.ch).join('');
    assert.match(status, /Blind.*Deaf/);
    assert.doesNotMatch(status, /Satiated/);
});
