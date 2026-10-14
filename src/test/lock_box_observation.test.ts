import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { CHEST, DAGGER, SKELETON_KEY } from '../js/object_data.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';

for (const action of ['apply', 'force'] as const) {
    for (const blind of [false, true]) {
        void test(`a ${blind ? 'blind ' : ''}Priest learns a box's beatitude from the ${action} lock question`, async () => {
            freshObjectRoom({ role: 'priest', hero: { blindTurns: blind ? 20 : 0 } });
            const box = await floorObject(CHEST, 10, 10, {
                initialize: false, olocked: true, lknown: false,
                cursed: true, bknown: false, dknown: false,
            });
            const tool = await addInventoryObject(action === 'apply' ? SKELETON_KEY : DAGGER, { invlet: 'a' });
            if (action === 'force') game.uwep = game.u.uwep = tool;
            const input = resetInputState();
            pushKeys(action === 'apply' ? 'a.' : 'force\n');

            await answerPrompts(rhack((action === 'apply' ? 'a' : '#').charCodeAt(0)), input, [
                { prompt: action === 'apply'
                    ? /There is a cursed chest here; unlock it\?/
                    : /There is a cursed chest here; force its lock\?/, keys: 'q' },
            ]);

            assert.equal(box.bknown, true);
            assert.equal(box.dknown, !blind);
            assert.equal(box.lknown, true);
            assert.equal(box.olocked, true);
            assert.equal(game.context.move, 0);
        });
    }
}
