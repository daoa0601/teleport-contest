import test from 'node:test';
import assert from 'node:assert/strict';
import { DOOR, D_ISOPEN, POOL } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { BOULDER, CLUB } from '../js/object_data.js';
import { kickDirection } from './support/commands.js';
import { floorObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';

void test('kicking water splashes without reaching an object under it', async () => {
    const level = freshPlayableRoom({ hero: { uhp: 100, uhpmax: 100 } });
    level.requireAt(11, 10).typ = POOL;
    const club = await floorObject(CLUB, 11, 10, { initialize: false });

    await kickDirection('l', ' '.repeat(5));

    assert.equal(club.ox, 11);
    assert.equal(club.oy, 10);
    assert.equal(game._pending_message, 'You splash some water around.');
    assert.equal(game.context.move, 1);
});

void test('a boulder is too solid to kick and injures the hero', async () => {
    freshPlayableRoom({ hero: { uhp: 100, uhpmax: 100 } });
    const boulder = await floorObject(BOULDER, 11, 10, { initialize: false });

    await kickDirection('l', ' '.repeat(5));

    requirePlayingGame(game);
    assert.ok(game.u.uhp < 100);
    assert.equal(boulder.ox, 11);
    assert.equal(game._lastPlineMessage, 'Ouch!  That hurts!');
});

void test('a levitating hero cannot reach a small floor object', async () => {
    const level = freshPlayableRoom({ hero: { levitating: true } });
    level.requireAt(9, 10).typ = DOOR;
    level.requireAt(9, 10).doormask = D_ISOPEN;
    const club = await floorObject(CLUB, 11, 10, { initialize: false });

    await kickDirection('l', ' '.repeat(5));

    assert.equal(club.ox, 11);
    assert.equal(club.oy, 10);
    assert.doesNotMatch(game._pending_message, /club/);
});
