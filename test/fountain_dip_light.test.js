import test from 'node:test';
import assert from 'node:assert/strict';
import { FOUNTAIN } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { GOLD_DRAGON_SCALE_MAIL } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { addInventoryObject } from './support/game-objects.js';
import { runExtendedCommand } from './support/commands.js';
import { freshObjectRoom } from './support/object-room.js';
void test('uncursing a dipped shining suit brightens its light after the water glows', async () => {
    const level = freshObjectRoom();
    level.requireAt(10, 10).typ = FOUNTAIN;
    const armor = await addInventoryObject(GOLD_DRAGON_SCALE_MAIL, { cursed: true, lamplit: true });
    const input = resetInputState();
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    initRng(74n);
    await runExtendedCommand('dip', armor.invlet + 'y' + ' '.repeat(20));
    assert.equal(armor.cursed, false);
    const text = [...messages, game._pending_message].join('\n');
    assert.match(text, /water glows for a moment[\s\S]*shines brighter/);
});
//# sourceMappingURL=fountain_dip_light.test.js.map