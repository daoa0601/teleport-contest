import test from 'node:test';
import assert from 'node:assert/strict';
import { doeat } from '../js/eat.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { CORPSE } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';

for (const quantity of [1, 2]) {
    void test(`food detection warns about ${quantity === 1 ? 'a corpse' : 'corpses'} using its ordinary object name`, async () => {
        freshObjectRoom({ hero: { uedibility: 1 } });
        requirePlayingGame(game);
        const corpse = await addInventoryObject(CORPSE, {
            corpsenm: MONSTER_NAME.indexOf('cockatrice'), quantity, age: game.moves,
        });
        const input = resetInputState();
        input.feed(corpse.invlet);

        await answerPrompts(doeat(), input, [{
            prompt: quantity === 1
                ? /The corpse smells like it could be something very dangerous!/
                : /The corpses smell like they could be something very dangerous!/,
            keys: 'n',
        }]);

        assert.equal(corpse.where, 'inventory');
        assert.equal(corpse.quantity, quantity);
        assert.equal(game.u.uedibility, 0);
        assert.equal(game.u.uconduct.food ?? 0, 0);
        assert.equal(game.context.move, 0);
    });
}
