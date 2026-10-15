import test from 'node:test';
import assert from 'node:assert/strict';
import { A_STR, DB_FLOOR, DB_ICE, DRAWBRIDGE_UP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { DIAMOND } from '../js/object_data.js';
import { kickDirection } from './support/commands.js';
import { floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

for (const under of [DB_FLOOR, DB_ICE] as const) {
    void test(`a kicked gem passes a raised bridge over ${under === DB_FLOOR ? 'ground' : 'ice'}`, async () => {
        const level = freshObjectRoom({ right: 25, gameplaySeed: 1n });
        requirePlayingGame(game);
        game.u.acurr.a[A_STR] = 18;
        const square = level.requireAt(12, 10);
        square.typ = DRAWBRIDGE_UP;
        square.drawbridgemask = under;
        const gem = await floorObject(DIAMOND, 11, 10);

        await kickDirection('l', ' '.repeat(10));

        assert.ok(gem.ox > 12, `the gem stopped at ${gem.ox},${gem.oy}`);
        assert.equal(gem.oy, 10);
        assert.equal(gem.where, 'floor');
    });
}
