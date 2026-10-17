import { monsterAtPosition } from '../js/monster_location.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { NO_MINVENT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { finishEnvironmentalMonsterDeath } from '../js/monster_death.js';
import { createPoisonGasCloud } from '../js/regions.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const alreadyInside of [false, true]) {
    void test(`steam vortex death ${alreadyInside ? 'keeps an existing cloud quiet' : 'announces a new cloud around the hero'}`, async () => {
        const level = freshObjectRoom();
        const messages: string[] = [];
        const publish = async (message: string) => { messages.push(message); };
        if (alreadyInside)
            await createPoisonGasCloud(game, 10, 10, 1, 0, () => 0, publish);
        const vortex = await createMonsterAt('steam vortex', 11, 10, NO_MINVENT);

        await finishEnvironmentalMonsterDeath(vortex, game, {
            noCorpse: true, random: () => 0, publish,
        });

        assert.equal(level.regions.some(region => region.cells.some(cell =>
            cell.x === game.u.ux && cell.y === game.u.uy)), true);
        assert.deepEqual(messages, alreadyInside ? [] : ['You are enveloped in a cloud of steam!']);
        assert.notEqual(monsterAtPosition(level, vortex.mx, vortex.my), vortex);
    });
}
