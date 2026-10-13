import assert from 'node:assert/strict';
import test from 'node:test';

import { LAVAPOOL } from '../js/const.js';
import { feel_location, newsym } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { freshObjectRoom } from './support/object-room.js';

for (const { name, update } of [
    { name: 'sight', update: newsym },
    { name: 'touch', update: feel_location },
]) {
    void test(`${name} does not expose changing terrain while a level is being built`, () => {
        const level = freshObjectRoom();
        requirePlayingGame(game);
        const location = level.requireAt(11, 10);
        assert.equal(location.disp_ch, '.');
        location.typ = LAVAPOOL;
        game.in_mklev = true;
        try {
            update(11, 10);
            assert.equal(location.disp_ch, '.');
        } finally {
            game.in_mklev = false;
        }

        update(11, 10);
        assert.equal(location.disp_ch, '}');
    });
}
