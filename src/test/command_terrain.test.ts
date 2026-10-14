import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { PIT, ROOM } from '../js/const.js';
import { newsym } from '../js/display.js';
import { game } from '../js/gstate.js';
import { makeStunned } from '../js/hero_mental_status.js';
import { maketrap } from '../js/mklev.js';
import { freshTurnRoom } from './support/playable-room.js';
import { requireScreenCell } from './support/screen.js';

void test('the terrain view can retain a discovered trap', async () => {
    const input = freshTurnRoom({ flags: { tips: false } });
    const trap = await maketrap(14, 10, PIT);
    assert.ok(trap);
    trap.tseen = true;
    newsym(14, 10);
    input.feed('\x7fb');
    const action = rhack(0);
    try {
        await input.waitUntilBlocked();
        assert.equal(requireScreenCell(13, 11).ch, '^');
    } finally {
        input.feed('\x1b ');
        await action;
    }
    assert.equal(game.context.move, 0);
});

void test('terrain inspection refuses an impaired hero without entering the browser', async () => {
    const input = freshTurnRoom({ flags: { tips: false } });
    await makeStunned(20, { talk: false });
    input.feed('\x7fa\x1b');
    await rhack(0);
    assert.equal(game._pending_message, 'You are too disoriented for this.');
    assert.equal(game.context.move, 0);
});

void test('explore mode can inspect underlying terrain in an unseen area', async () => {
    const input = freshTurnRoom({ flags: { tips: false, explore: true } });
    const distant = game.level?.requireAt(30, 10);
    assert.ok(distant);
    distant.typ = ROOM;
    distant.seenv = 0;
    distant.lit = distant.waslit = false;
    input.feed('\x7fd');
    const action = rhack(0);
    try {
        await input.waitUntilBlocked();
        assert.equal(requireScreenCell(29, 11).ch, '.');
        assert.equal(distant.seenv, 0, 'inspection does not explore the square');
    } finally {
        input.feed('\x1b ');
        await action;
    }
});
