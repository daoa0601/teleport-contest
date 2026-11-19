import assert from 'node:assert/strict';
import test from 'node:test';
import { ALTAR, ROOM } from '../js/const.js';
import { back_to_glyph } from '../js/display.js';
import { game } from '../js/gstate.js';
import { nextGetposFeature } from '../js/getpos.js';
import { freshObjectRoom } from './support/object-room.js';

void test('altar search accepts the default symbol under DECgraphics', async () => {
    const level = await freshObjectRoom();
    game.symset = 'DECgraphics';
    const altar = level.requireAt(12, 10);
    altar.typ = ALTAR;
    altar.seenv = 255;

    const selected = nextGetposFeature({ x: 10, y: 10 }, '_');

    assert.deepEqual(selected, { x: 12, y: 10 });
});

void test('a Meta key cannot search for the DECgraphics altar symbol', async () => {
    const level = await freshObjectRoom();
    game.symset = 'DECgraphics';
    const altar = level.requireAt(12, 10);
    altar.typ = ALTAR;
    altar.seenv = 255;

    // DECgraphics displays S_altar as 0xfb, but getpos() holds the typed
    // key as a signed char, which never equals a uchar symbol
    // (getpos.c:1052-1060), so the altar is unreachable through it.
    assert.equal(nextGetposFeature({ x: 10, y: 10 }, '\xfb'), null);
});

void test('altar search finds a remembered DECgraphics altar after terrain changes unseen', async () => {
    const level = await freshObjectRoom();
    game.symset = 'DECgraphics';
    const altar = level.requireAt(20, 10);
    altar.typ = ALTAR;
    altar.remembered_glyph = back_to_glyph(altar, 20, 10);
    altar.typ = ROOM;
    altar.seenv = 0;

    const selected = nextGetposFeature({ x: 10, y: 10 }, '_');

    assert.deepEqual(selected, { x: 20, y: 10 });
});

void test('a DECgraphics altar does not match the fountain symbol it resembles in the terminal', async () => {
    const level = await freshObjectRoom();
    game.symset = 'DECgraphics';
    const altar = level.requireAt(12, 10);
    altar.typ = ALTAR;
    altar.seenv = 255;

    assert.equal(nextGetposFeature({ x: 10, y: 10 }, '{'), null);
});
