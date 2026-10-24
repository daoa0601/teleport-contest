import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_ANGRY, MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { beginObjectBurn } from '../js/light.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { breakFloorObject } from '../js/object_breakage.js';
import { EGG, POT_OIL } from '../js/object_data.js';
import { requireFixtureGame } from './support/game-state.js';
import { floorObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
for (const objectType of [POT_OIL, EGG]) {
    for (const monsterTurn of [false, true]) {
        const source = objectType === POT_OIL ? 'burning oil' : 'a pyrolisk egg';
        void test(`${source} broken during the ${monsterTurn ? 'monster' : 'hero'} turn assigns blast credit by that turn`, async () => {
            freshObjectRoom({ context: { mon_moving: monsterTurn } });
            requireFixtureGame(game);
            const survivor = await createMonsterAt('soldier', 15, 10, MM_NOGRP | NO_MINVENT);
            survivor.mhp = survivor.mhpmax = 100;
            survivor.mpeaceful = 1;
            const victim = await createMonsterAt('jackal', 13, 10, MM_ANGRY | MM_NOGRP | NO_MINVENT);
            victim.mhp = 1;
            const object = await floorObject(objectType, 14, 10);
            if (objectType === POT_OIL)
                beginObjectBurn(object);
            else
                object.corpsenm = MONSTER_NAME.indexOf('pyrolisk');
            await breakFloorObject(object, {
                // breaks() can run during a hero turn without blaming the
                // hero for breakage; explode() still uses the active turn.
                heroCaused: monsterTurn,
                publish: async () => { }, random: () => 1, rollDice: () => 12,
            });
            assert.ok(survivor.mhp < 100, 'The survivor was inside the blast.');
            // Oil uses a positive fire type, so zap_over_floor() also
            // angers targets even when the blast occurs on a monster turn.
            assert.equal(survivor.mpeaceful, monsterTurn && objectType === EGG ? 1 : 0);
            assert.ok(victim.mhp <= 0, 'The blast killed its other target.');
            assert.equal(game.u.uconduct.killer || 0, monsterTurn ? 0 : 1);
        });
    }
}
//# sourceMappingURL=breakage_explosion_credit.test.js.map