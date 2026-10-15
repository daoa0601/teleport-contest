import test from 'node:test';
import assert from 'node:assert/strict';
import { NO_MINVENT, W_ARM } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { EXPENSIVE_CAMERA, OBJECT_NAMES } from '../js/object_data.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('photograph experience includes the protection of worn monster armor', async () => {
    const awards: number[] = [];
    for (const armored of [false, true]) {
        freshObjectRoom({ role: 'tourist', hero: { ulevel: 30, uexp: 0 } });
        requirePlayingGame(game);
        const target = await createMonsterAt('soldier', 12, 10, NO_MINVENT);
        target.msleeping = 1;
        if (armored)
            await equipMonsterObject(target, await knownObject(OBJECT_NAMES.indexOf('plate mail'), { spe: 3 }), W_ARM);
        const camera = await addInventoryObject(EXPENSIVE_CAMERA, { spe: 1 });

        await applyInventoryObject(camera, `l${' '.repeat(30)}`);

        awards.push(game.u.uexp);
    }
    const [unarmored, armored] = awards;
    assert.ok(unarmored !== undefined && armored !== undefined);
    assert.equal(armored - unarmored, 7, 'AC 0 adds seven experience points over AC 10');
});
