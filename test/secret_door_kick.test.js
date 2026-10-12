import test from 'node:test';
import assert from 'node:assert/strict';
import { A_CON, A_DEX, A_STR, DOOR, SDOOR, D_BROKEN, D_CLOSED, D_ISOPEN, W_ARMF } from '../js/const.js';
import { game } from '../js/gstate.js';
import { KICKING_BOOTS } from '../js/object_data.js';
import { kickDirection } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { requireFixtureGame } from './support/game-state.js';
import { freshPlayableRoom } from './support/playable-room.js';
for (const type of [DOOR, SDOOR]) {
    void test(`kicking boots open a ${type === SDOOR ? 'secret' : 'closed'} door even with weak attributes`, async () => {
        for (let seed = 1n; seed <= 12n; seed++) {
            const level = freshPlayableRoom({ seed, hero: { uhp: 100, uhpmax: 100 } });
            requireFixtureGame(game);
            for (const attribute of [A_STR, A_DEX, A_CON])
                game.u.acurr.a[attribute] = 3;
            game.uarmf = await addInventoryObject(KICKING_BOOTS, { initialize: false, owornmask: W_ARMF });
            const door = level.requireAt(11, 10);
            door.typ = type;
            door.doormask = D_CLOSED;
            await kickDirection('l');
            assert.equal(door.typ, DOOR, `The boots must uncover the door (seed ${seed}).`);
            assert.equal(door.doormask, type === SDOOR ? D_ISOPEN : D_BROKEN, `The boots must open the door (seed ${seed}).`);
            assert.equal(game.u.uhp, 100, `A successful kick must not injure the hero (seed ${seed}).`);
        }
    });
}
//# sourceMappingURL=secret_door_kick.test.js.map