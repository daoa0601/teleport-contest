import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_ANGRY, NO_MINVENT, W_WEP } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { beginMonsterMove } from '../js/monmove.js';
import { ELVEN_ARROW, ELVEN_BOW } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
for (const wielded of [false, true]) {
    void test(`an archer ${wielded ? 'backs away with a wielded bow' : 'approaches while its bow is only carried'}`, async () => {
        freshObjectRoom({ left: 8, right: 18, top: 8, bottom: 12, heroX: 13, heroY: 10 });
        requirePlayingGame(game);
        const elf = await createMonsterAt('elven monarch', 10, 10, MM_ANGRY | NO_MINVENT);
        const bow = await knownObject(ELVEN_BOW);
        if (wielded)
            await equipMonsterObject(elf, bow, W_WEP);
        else
            await addObjectToMonsterInventory(elf, bow, game);
        await addObjectToMonsterInventory(elf, await knownObject(ELVEN_ARROW, { quantity: 5 }), game);
        elf.mux = game.u.ux;
        elf.muy = game.u.uy;
        await beginMonsterMove(elf, game, limit => limit - 1);
        assert.equal(elf.mx, wielded ? 9 : 11);
    });
}
//# sourceMappingURL=monster_launcher_approach.test.js.map