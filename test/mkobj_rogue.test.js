import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requirePlayingGame } from '../js/gstate.js';
import { mkobj } from '../js/mklev.js';
import { freshObjectRoom } from './support/object-room.js';
void test('random Rogue-level loot uses only the seven Rogue object classes', async () => {
    freshObjectRoom({ gameplaySeed: 140 });
    requirePlayingGame(game);
    game.rogue_level = { ...game.u.uz };
    const classes = new Set([2, 3, 7, 8, 9, 11, 4]);
    for (let count = 0; count < 100; count++) {
        const object = await mkobj(0, false);
        assert.ok(classes.has(object.oclass), `Rogue loot has class ${object.oclass}`);
    }
});
//# sourceMappingURL=mkobj_rogue.test.js.map