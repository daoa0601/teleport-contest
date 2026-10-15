import test from 'node:test';
import assert from 'node:assert/strict';
import { wearHeroArmor } from '../js/armor.js';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { beginObjectBurn } from '../js/light.js';
import { GOLD_DRAGON_SCALE_MAIL } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('gold dragon armor reports its light dimming on merge and brightening on return', async () => {
    freshObjectRoom({ flags: { debug: true } });
    const armor = await addInventoryObject(GOLD_DRAGON_SCALE_MAIL, { blessed: true });
    wearHeroArmor(armor);
    beginObjectBurn(armor);
    const input = resetInputState();
    const messages: string[] = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    pushKeys('polyself\ngold dragon\n                        ');

    await rhack('#'.charCodeAt(0));
    messages.push(game._pending_message);
    assert.equal(game.uskin, armor);
    assert.match(messages.join('\n'), /much less brightly\./);
    messages.length = 0;
    resetInputState().beforeRead = input.beforeRead;
    pushKeys('polyself\ncaveman\n                        ');

    await rhack('#'.charCodeAt(0));
    messages.push(game._pending_message);

    assert.equal(game.uarm, armor);
    assert.match(messages.join('\n'), /much brighter\./);
});
