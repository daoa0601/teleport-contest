import assert from 'node:assert/strict';
import test from 'node:test';
import { game } from '../js/gstate.js';
import { rhack } from '../js/cmd.js';
import { resetInputState } from '../js/input.js';
import { LEASH } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { planInput } from './support/planned-input.js';
for (const attached of [false, true]) {
    void test(`${attached ? 'an attached' : 'a loose'} leash offers applying in its item actions`, async (t) => {
        await freshObjectRoom();
        const dog = await createMonsterAt('little dog', 11, 10);
        const leash = await addInventoryObject(LEASH, { leashmon: attached ? dog.m_id : 0 });
        dog.mleashed = attached ? 1 : 0;
        const input = resetInputState();
        planInput(input, t, [
            { prompt: /Tools/, keys: leash.invlet },
            { prompt: /a - Tie a pet to this leash/, keys: '\x1b' },
        ]);
        await rhack('i'.charCodeAt(0));
        assert.equal(game.context.move, 0);
        assert.equal(leash.leashmon, attached ? dog.m_id : 0);
    });
}
//# sourceMappingURL=inventory_action_leash.test.js.map