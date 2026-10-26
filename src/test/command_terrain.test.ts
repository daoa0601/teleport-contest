import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { PIT, ROOM } from '../js/const.js';
import { newsym } from '../js/display.js';
import { game } from '../js/gstate.js';
import { makeStunned } from '../js/hero_mental_status.js';
import { maketrap } from '../js/mklev.js';
import { freshTurnRoom } from './support/playable-room.js';
import { requireScreenCell, requireScreenRow } from './support/screen.js';
import { floorObject } from './support/game-objects.js';
import { DAGGER } from '../js/object_data.js';

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

// C reveal_terrain(): the announcement pline stays behind a --More-- pager
// until getpos()'s verbose instructions line takes the topl; autodescribe
// then replaces that line while the cursor browses, and picking a spot
// leaves a cleared topl with the map restored.
void test('terrain browsing pages the announcement before the getpos prompt', async () => {
    const input = freshTurnRoom({ flags: { tips: false } });
    newsym(10, 9);
    input.feed('\x7fc');
    const action = rhack(0);
    const topl = () => requireScreenRow(0).map(cell => cell.ch).join('').trim();
    try {
        await input.waitUntilBlocked();
        assert.equal(topl(), 'Showing known terrain, traps, and objects only...--More--');
        input.feed(' ');
        await input.waitUntilBlocked();
        assert.equal(topl(), "(For instructions type a '?')");
        input.feed('k');
        await input.waitUntilBlocked();
        assert.equal(topl(), 'floor of a room');
    } finally {
        input.feed(',');
        await action;
    }
    assert.equal(topl(), '');
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

void test('removing an object from a terrain view retains DECgraphics floor rendering', async () => {
    const input = freshTurnRoom({ flags: { tips: false } });
    game.symset = 'DECgraphics';
    await floorObject(DAGGER, 14, 10);
    newsym(14, 10);
    input.feed('\x7fa');
    const action = rhack(0);
    try {
        await input.waitUntilBlocked();
        const floor = requireScreenCell(13, 11);
        assert.equal(floor.ch, '·');
    } finally {
        input.feed('\x1b ');
        await action;
    }
});
