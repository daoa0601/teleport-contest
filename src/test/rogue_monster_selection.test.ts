import assert from 'node:assert/strict';
import test from 'node:test';
import { game, requirePlayingGame } from '../js/gstate.js';
import { rndmonstAdj } from '../js/mklev.js';
import { monsterClassSymbol } from '../js/monster_data.js';
import { freshObjectRoom } from './support/object-room.js';

void test('random monsters on a Rogue level belong to uppercase classes', () => {
    freshObjectRoom({ hero: { uz: { dnum: 0, dlevel: 15 }, ulevel: 20 } });
    requirePlayingGame(game);
    game.rogue_level = { ...game.u.uz };

    for (let count = 0; count < 30; count++) {
        const species = rndmonstAdj();
        assert.ok(species !== null);
        assert.match(monsterClassSymbol(species), /^[A-Z]$/);
    }
});
