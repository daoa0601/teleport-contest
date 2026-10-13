import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { bot } from '../js/display.js';
import { game } from '../js/gstate.js';
import { makeStunned } from '../js/hero_mental_status.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { freshTurnRoom } from './support/playable-room.js';
import { requireScreenRow } from './support/screen.js';

void test('bat-form stun preserves counted searching when its temporary stun expires', async () => {
    const input = freshTurnRoom();
    installPolymorphedHero('bat');
    await makeStunned(1, { talk: false });
    await bot();
    input.feed('3s  .');
    await moveloop_core();
    assert.ok(game._occupation);

    await moveloop_core();

    assert.equal(game.u.stunnedTurns, 0);
    assert.equal(game.u.stunned, true);
    assert.ok(game._occupation, 'temporary stun expiry interrupted the remaining searches');
    assert.ok(game.multi > 0);
    assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /\bStun\b/);
});

void test('stun expiry interrupts counted searching when the hero is no longer stunned', async () => {
    const input = freshTurnRoom();
    await makeStunned(1, { talk: false });
    input.feed('3s  .');
    await moveloop_core();
    assert.ok(game._occupation);

    await moveloop_core();

    assert.equal(game.u.stunnedTurns, 0);
    assert.equal(game.u.stunned, false);
    assert.equal(game._occupation, null);
    assert.doesNotMatch(requireScreenRow(23).map(cell => cell.ch).join(''), /\bStun\b/);
});
