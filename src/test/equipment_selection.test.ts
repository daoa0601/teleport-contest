import assert from 'node:assert/strict';
import test from 'node:test';
import { wearHeroArmor } from '../js/armor.js';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { LEATHER_CLOAK, RING_MAIL, HELM_OF_OPPOSITE_ALIGNMENT } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('takeoff automatically chooses the single accessible outer layer', async () => {
    freshObjectRoom();
    const suit = await addInventoryObject(RING_MAIL);
    const cloak = await addInventoryObject(LEATHER_CLOAK);
    wearHeroArmor(suit);
    wearHeroArmor(cloak);
    resetInputState().feed('\x1b');

    await rhack('T'.charCodeAt(0));

    assert.equal(game.uarmc, null);
    assert.equal(game.uarm, suit);
    assert.equal(game.context.move, 1);
});

for (const command of ['W', 'P']) {
    void test(`${command} refuses an opposite-alignment helm in the quest and loses divine protection`, async () => {
        freshObjectRoom({ hero: { ublessed: 4, ualignbase: [1, 1] } });
        assert.ok(game.u.uz);
        game.quest_dnum = game.u.uz.dnum;
        const helmet = await addInventoryObject(HELM_OF_OPPOSITE_ALIGNMENT, { typeKnown: false });
        resetInputState().feed(helmet.invlet);

        await rhack(command.charCodeAt(0));

        assert.equal(game._pending_message, 'You narrowly avoid losing all chance at your goal.');
        assert.equal(game.u.ublessed, 0);
        assert.equal(game.uarmh ?? null, null);
        assert.equal(game.context.move, 1);
        assert.equal(game._knownObjectTypes?.has(HELM_OF_OPPOSITE_ALIGNMENT), true);
    });
}
