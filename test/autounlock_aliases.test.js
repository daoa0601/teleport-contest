import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { DOOR, D_LOCKED } from '../js/const.js';
import { game } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { SKELETON_KEY } from '../js/object_data.js';
import { applyNethackrc } from '../js/options.js';
import { addInventoryObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';
for (const setting of ['apply_key', 'applykey', 'untrap+apply key']) {
    void test(`autounlock:${setting} offers the carried key when opening a locked door`, async () => {
        const level = freshObjectRoom();
        const door = level.requireAt(11, 10);
        door.typ = DOOR;
        door.doormask = D_LOCKED;
        await addInventoryObject(SKELETON_KEY);
        applyNethackrc(`OPTIONS=autounlock:${setting}`);
        const input = resetInputState();
        pushKeys('l');
        await answerPrompts(rhack('o'.charCodeAt(0)), input, [
            { prompt: /This door is locked\.--More--/, keys: ' ' },
            ...(setting.startsWith('untrap') ? [{ prompt: /Check this door for a trap\?/, keys: 'n' }] : []),
            { prompt: /Unlock it with your skeleton key\?/, keys: 'y' },
        ]);
        assert.equal(game._occupation?.key, 'pick-lock');
        assert.equal(game.context.move, 1);
        assert.equal(door.doormask, D_LOCKED);
    });
}
//# sourceMappingURL=autounlock_aliases.test.js.map