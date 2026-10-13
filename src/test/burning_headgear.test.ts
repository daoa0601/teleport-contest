import test from 'node:test';
import assert from 'node:assert/strict';
import { W_ARMH } from '../js/const.js';
import { game } from '../js/gstate.js';
import { CORNUTHAUM, ELVEN_LEATHER_HELM } from '../js/object_data.js';
import { burnHeroArmorByFire } from '../js/trap.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

for (const { type, description } of [
    { type: CORNUTHAUM, description: 'cloth hat' },
    { type: ELVEN_LEATHER_HELM, description: 'leather hat' },
]) {
    void test(`burning an unidentified ${description} describes its material and protection`, async () => {
        freshObjectRoom();
        const hat = await addInventoryObject(type, {
            blessed: false, typeKnown: false, dknown: false, oeroded: 0,
            owornmask: W_ARMH,
        });
        game.uarmh = hat;
        const messages: string[] = [];

        const torso = await burnHeroArmorByFire(game,
            message => { messages.push(message); }, [], () => 0);

        assert.equal(torso, false);
        assert.equal(hat.oeroded, 1);
        assert.equal(messages[0], `Your ${description} smoulders!`);
    });
}
