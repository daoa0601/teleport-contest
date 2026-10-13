import test from 'node:test';
import assert from 'node:assert/strict';
import { DOOR, D_LOCKED } from '../js/const.js';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { CREDIT_CARD } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';
void test('opening a locked door offers the carried unlock tool after acknowledging the lock', async () => {
    for (const answer of ['y', 'q']) {
        const level = freshObjectRoom();
        const door = level.requireAt(11, 10);
        door.typ = DOOR;
        door.doormask = D_LOCKED;
        await addInventoryObject(CREDIT_CARD);
        const input = resetInputState();
        pushKeys('l');
        await answerPrompts(rhack('o'.charCodeAt(0)), input, [
            { prompt: /This door is locked\.--More--/, keys: ' ' },
            { prompt: /Unlock it with your credit card\?/, keys: answer },
        ]);
        assert.equal(door.doormask, D_LOCKED);
        assert.equal(Boolean(game._occupation), answer === 'y');
        assert.equal(game.context.move, answer === 'y' ? 1 : 0);
    }
});
//# sourceMappingURL=open_autounlock.test.js.map