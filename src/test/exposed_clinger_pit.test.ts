import assert from 'node:assert/strict';
import test from 'node:test';
import { PIT, SPIKED_PIT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { finishImmediateMonsterTrap, triggerImmediateMonsterTrap } from '../js/monmove.js';
import { freshMonsterTrapRoom } from './support/monster-traps.js';

for (const type of [PIT, SPIKED_PIT]) {
    void test(`an exposed clinger crosses ${type === PIT ? 'a pit' : 'a spiked pit'} without falling`, async () => {
        const { monster } = await freshMonsterTrapRoom(type, {
            monster: { species: 'rock piercer', hitPoints: 40 },
        });
        requirePlayingGame(game);
        monster.mundetected = false;

        const action = await triggerImmediateMonsterTrap(monster, game);
        await finishImmediateMonsterTrap(action, game);

        assert.equal(monster.mhp, 40);
        assert.equal(monster.mtrapped ?? 0, 0);
        assert.ok((monster.mtrapseen ?? 0) & (1 << (type - 1)));
    });
}
