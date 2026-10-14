import assert from 'node:assert/strict';
import test from 'node:test';
import { reviveCorpseByMagic } from '../js/corpse_revival.js';
import { placeCreatedObject } from '../js/floor_object.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { addCreatedObjectToContainer } from '../js/object_container.js';
import { SACK } from '../js/object_data.js';
import { knownObject, untimedCorpse } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

for (const count of [3, 4]) {
    void test(`revival ${count === 3 ? 'escapes' : 'is blocked by'} ${count} nested sacks`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const corpse = await untimedCorpse(MONSTER_NAME.indexOf('troll'));
        let outer = corpse;
        for (let index = 0; index < count; index++) {
            const sack = await knownObject(SACK, { initialize: false, no_charge: true });
            await addCreatedObjectToContainer(sack, outer);
            outer = sack;
        }
        await placeCreatedObject(outer, 12, 10);

        const revival = await reviveCorpseByMagic(corpse);

        assert.equal(revival?.kind === 'revived', count === 3);
        assert.equal(corpse.where, count === 3 ? 'gone' : 'contained');
        assert.equal(game.level.monsters.some(monster => monster.mnum === MONSTER_NAME.indexOf('troll')), count === 3);
    });
}
