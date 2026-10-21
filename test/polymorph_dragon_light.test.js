import test from 'node:test';
import assert from 'node:assert/strict';
import { wearHeroArmor } from '../js/armor.js';
import { rhack } from '../js/cmd.js';
import { plineWithContinuation } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { beginObjectBurn } from '../js/light.js';
import { GOLD_DRAGON_SCALE_MAIL } from '../js/object_data.js';
import { cansee, vision_recalc } from '../js/vision.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
void test('gold dragon armor reports its light dimming on merge and brightening on return', async () => {
    freshObjectRoom({ flags: { debug: true } });
    const armor = await addInventoryObject(GOLD_DRAGON_SCALE_MAIL, { blessed: true });
    wearHeroArmor(armor);
    beginObjectBurn(armor);
    const input = resetInputState();
    const messages = [];
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
void test('turning into a gold dragon lights the dark squares around the hero by the next message', async () => {
    const level = freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    for (let x = 7; x <= 16; x++)
        for (let y = 6; y <= 14; y++)
            level.requireAt(x, y).lit = false;
    vision_recalc(0);
    const { ux, uy } = game.u;
    assert.equal(cansee(ux + 2, uy), false);
    resetInputState();
    pushKeys('polyself\ngold dragon\n                        ');
    await rhack('#'.charCodeAt(0));
    await plineWithContinuation('A later message.');
    assert.equal(cansee(ux + 2, uy), true);
});
//# sourceMappingURL=polymorph_dragon_light.test.js.map