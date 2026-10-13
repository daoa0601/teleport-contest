import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_ANGRY, NO_MINVENT, STONE } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { mfndpos } from '../js/monmove.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
for (const species of ['fire elemental', 'air elemental', 'black pudding']) {
    void test(`${species} uses its actual body shape to squeeze between rocks`, async () => {
        const level = freshObjectRoom({ heroX: 15, heroY: 12 });
        requirePlayingGame(game);
        const monster = await createMonsterAt(species, 10, 10, MM_ANGRY | NO_MINVENT);
        level.requireAt(10, 11).typ = STONE;
        level.requireAt(11, 10).typ = STONE;
        assert.equal(mfndpos(monster, game).some(square => square.x === 11 && square.y === 11), species !== 'fire elemental', 'a large fire elemental is unsolid but has no shape that can squeeze through');
    });
}
//# sourceMappingURL=monster_diagonal_squeeze.test.js.map