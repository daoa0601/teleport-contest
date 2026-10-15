import test from 'node:test';
import assert from 'node:assert/strict';
import { THRONE } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { GOLD_DRAGON_SCALE_MAIL } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { runExtendedCommand } from './support/commands.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a throne curse dims a blessed shining suit when it removes the blessing', async () => {
    const level = freshObjectRoom();
    level.requireAt(10, 10).typ = THRONE;
    const armor = await addInventoryObject(GOLD_DRAGON_SCALE_MAIL, { blessed: true, lamplit: true });
    const input = resetInputState();
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    initRng(41n);
    await runExtendedCommand('sit', ' '.repeat(20));
    assert.equal(armor.blessed, false);
    assert.match([...messages, game._pending_message].join('\n'), /shines less brightly/);
});
//# sourceMappingURL=throne_curse_light.test.js.map