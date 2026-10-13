import assert from 'node:assert/strict';
import test from 'node:test';
import { bot, plineWithContinuation } from '../js/display.js';
import { makeConfused } from '../js/hero_mental_status.js';
import { resetInputState } from '../js/input.js';
import { tryCallObjectType } from '../js/object_call.js';
import { POT_CONFUSION } from '../js/object_data.js';
import { uninitializedObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';
void test('calling a potion displays pending condition changes before the unread message pager', async () => {
    freshObjectRoom();
    const potion = await uninitializedObject(POT_CONFUSION, { dknown: true, typeKnown: false });
    await bot();
    await plineWithContinuation('You feel somewhat dizzy.');
    await makeConfused(3, { talk: false });
    const input = resetInputState();
    let pages = 0;
    input.display = {
        async readKey() {
            const message = requireScreenRow(0).map(cell => cell.ch).join('');
            assert.match(requireScreenRow(23).map(cell => cell.ch).join(''), /Conf\b/);
            if (message.includes('--More--')) {
                assert.match(message, /somewhat dizzy/);
                pages++;
                return 32;
            }
            assert.match(message, /^Call a .* potion:/);
            return 27;
        },
    };
    await tryCallObjectType(potion);
    assert.equal(pages, 1);
});
//# sourceMappingURL=status_call_prompt.test.js.map