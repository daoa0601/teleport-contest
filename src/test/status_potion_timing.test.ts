import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { NOT_HUNGRY } from '../js/const.js';
import { bot, flush_screen } from '../js/display.js';
import { game } from '../js/gstate.js';
import { makeConfused } from '../js/hero_mental_status.js';
import { POT_BLINDNESS, POT_CONFUSION } from '../js/object_data.js';
import { applySupportedPotionVapor } from '../js/potion_hit.js';
import { uninitializedObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { freshTurnRoom } from './support/playable-room.js';
import { requireScreenRow } from './support/screen.js';

void test('potion vapor requests a confusion status update after its dizziness message', async () => {
    freshObjectRoom({ hero: { uhs: NOT_HUNGRY } });
    const potion = await uninitializedObject(POT_CONFUSION, { dknown: false });
    await bot();

    await applySupportedPotionVapor({ potion });
    await flush_screen(1);

    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /Conf\b/);
    assert.ok((game.u.confusionTurns ?? 0) > 0);
});

void test('blindness vapor displays Blind on the next message flush', async () => {
    freshObjectRoom({ hero: { uhs: NOT_HUNGRY } });
    const potion = await uninitializedObject(POT_BLINDNESS, { dknown: false });
    await bot();

    await applySupportedPotionVapor({ potion });
    await flush_screen(1);

    assert.equal(game.blind, true);
    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /\bBlind\b/);
});

void test('the last confusion tick clears the status condition before the next command', async () => {
    const input = freshTurnRoom({ hero: { uhs: NOT_HUNGRY } });
    await makeConfused(1, { talk: false });
    await bot();
    input.feed('..');

    await moveloop_core();
    await moveloop_core();

    assert.equal(game.u.confusionTurns, 0);
    assert.doesNotMatch(requireScreenRow(23).map(cell => cell.ch).join(''), /Conf\b/);
});
