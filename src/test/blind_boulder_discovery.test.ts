import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { flush_screen, glyphAt, map_object } from '../js/display.js';
import { game } from '../js/gstate.js';
import { BOULDER } from '../js/object_data.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { vision_recalc } from '../js/vision.js';
import { floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a blind hero feels an unfamiliar boulder before trying to push it', async () => {
    freshObjectRoom({ hero: { blindTurns: 5 } });
    const boulder = await floorObject(BOULDER, 11, 10);

    await rhack('l'.charCodeAt(0));
    await flush_screen(1);

    assert.equal(game._pending_message, 'That feels like a boulder.');
    assert.equal(game.u.ux, 10);
    assert.equal(boulder.ox, 11);
    const glyph = glyphAt(11, 10);
    assert.ok(glyph?.kind === 'object');
    assert.equal(glyph.otyp, BOULDER);
});

void test('a blind hero remembers the new square after pushing a familiar boulder', async () => {
    const level = freshObjectRoom({ hero: { blindTurns: 5 } });
    setHeroBlindnessTurns(5);
    vision_recalc(0);
    level.requireAt(12, 12).seenv = 0;
    level.requireAt(12, 12).waslit = false;
    const boulder = await floorObject(BOULDER, 11, 11);
    map_object(boulder, true);

    await rhack('n'.charCodeAt(0));
    await flush_screen(1);

    assert.equal(boulder.ox, 12);
    assert.equal(game.u.ux, 11);
    const glyph = glyphAt(12, 12);
    assert.ok(glyph?.kind === 'object', 'touch maps the pushed boulder at its destination');
    assert.equal(glyph.otyp, BOULDER);
});
