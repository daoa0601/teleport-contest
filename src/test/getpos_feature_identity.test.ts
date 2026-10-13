import assert from 'node:assert/strict';
import test from 'node:test';
import { ALTAR, ROOM } from '../js/const.js';
import { terrain_glyph } from '../js/display.js';
import { game } from '../js/gstate.js';
import { nextGetposFeature } from '../js/getpos.js';
import { freshObjectRoom } from './support/object-room.js';

for (const key of ['_', '\xfb']) {
    void test(`altar search accepts ${key === '_' ? 'the default' : 'the active DECgraphics'} symbol`, () => {
        const level = freshObjectRoom();
        game.symset = 'DECgraphics';
        const altar = level.requireAt(12, 10);
        altar.typ = ALTAR;
        altar.seenv = 255;

        const selected = nextGetposFeature({ x: 10, y: 10 }, key);

        assert.deepEqual(selected, { x: 12, y: 10 });
    });
}

void test('altar search finds a remembered DECgraphics altar after terrain changes unseen', () => {
    const level = freshObjectRoom();
    game.symset = 'DECgraphics';
    const altar = level.requireAt(20, 10);
    altar.typ = ALTAR;
    altar.remembered_glyph = terrain_glyph(altar, 20, 10);
    altar.typ = ROOM;
    altar.seenv = 0;

    const selected = nextGetposFeature({ x: 10, y: 10 }, '_');

    assert.deepEqual(selected, { x: 20, y: 10 });
});

void test('a DECgraphics altar does not match the fountain symbol it resembles in the terminal', () => {
    const level = freshObjectRoom();
    game.symset = 'DECgraphics';
    const altar = level.requireAt(12, 10);
    altar.typ = ALTAR;
    altar.seenv = 255;

    assert.equal(nextGetposFeature({ x: 10, y: 10 }, '{'), null);
});
