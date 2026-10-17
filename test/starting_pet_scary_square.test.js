import assert from 'node:assert/strict';
import test from 'node:test';
// C dog.c:makedog() creates the pet on the hero, so makemon() moves it with
// enexto_core(GP_CHECKSCARY) before considering scary squares at all.
import { game } from '../js/gstate.js';
import { SCR_SCARE_MONSTER } from '../js/object_data.js';
import { makedog } from '../js/u_init.js';
import { floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
void test('the starting pet avoids squares holding a scroll of scare monster', async () => {
    freshObjectRoom({ role: 'ranger' });
    game.preferred_pet = 'd';
    const { ux, uy } = game.u;
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            if ((dx || dy) && !(dx === 1 && dy === 0))
                await floorObject(SCR_SCARE_MONSTER, ux + dx, uy + dy);
        }
    }
    const pet = await makedog();
    assert.ok(pet);
    assert.deepEqual([pet.mx, pet.my], [ux + 1, uy]);
});
//# sourceMappingURL=starting_pet_scary_square.test.js.map