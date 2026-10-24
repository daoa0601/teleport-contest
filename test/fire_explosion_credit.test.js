import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { explodePyroliskEggAt } from '../js/egg_impact.js';
import { explodeLitOilPotion } from '../js/fire_explosion.js';
import { game } from '../js/gstate.js';
import { beginObjectBurn } from '../js/light.js';
import { POT_OIL } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { requireFixtureGame } from './support/game-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
for (const burningOil of [false, true]) {
    for (const monsterTurn of [false, true]) {
        void test(`${burningOil ? 'burning oil' : 'a pyrolisk egg'} defaults to the active ${monsterTurn ? 'monster' : 'hero'} turn for kill credit`, async () => {
            freshObjectRoom({ context: { mon_moving: monsterTurn } });
            requireFixtureGame(game);
            const victim = await createMonsterAt('jackal', 15, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
            victim.mhp = 1;
            const options = { publish: async () => { }, random: () => 1, rollDice: () => 8 };
            if (burningOil) {
                const potion = await floorObject(POT_OIL, 14, 10);
                beginObjectBurn(potion);
                await explodeLitOilPotion(potion, 14, 10, options);
            }
            else {
                await explodePyroliskEggAt(14, 10, options);
            }
            assert.ok(victim.mhp <= 0, 'The fire blast killed its target.');
            assert.equal(game.u.uconduct.killer || 0, monsterTurn ? 0 : 1);
        });
    }
}
//# sourceMappingURL=fire_explosion_credit.test.js.map