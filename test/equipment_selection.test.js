import assert from 'node:assert/strict';
import test from 'node:test';
import { wearHeroArmor } from '../js/armor.js';
import { rhack } from '../js/cmd.js';
import { PARANOID_REMOVE } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DAGGER, LEATHER_CLOAK, RING_MAIL, HELM_OF_OPPOSITE_ALIGNMENT } from '../js/object_data.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
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
void test('paranoid removal asks for the single armor piece instead of taking it off automatically', async () => {
    freshObjectRoom({ flags: { paranoia_bits: PARANOID_REMOVE } });
    const cloak = await addInventoryObject(LEATHER_CLOAK);
    wearHeroArmor(cloak);
    resetInputState().feed('\x1b');
    await rhack('T'.charCodeAt(0));
    assert.equal(game.uarmc, cloak);
    assert.equal(game.context.move, 0);
});
for (const command of ['T', 'R']) {
    void test(`${command} rejects a wielded dagger without taking a turn`, async () => {
        freshObjectRoom({ flags: { paranoia_bits: PARANOID_REMOVE } });
        const cloak = await addInventoryObject(LEATHER_CLOAK);
        wearHeroArmor(cloak);
        const dagger = await addInventoryObject(DAGGER);
        await setPrimaryWeapon(dagger);
        resetInputState().feed(`${dagger.invlet} `);
        await rhack(command.charCodeAt(0));
        assert.equal(game._pending_message, 'You are not wearing that.');
        assert.equal(game.context.move, 0);
        assert.equal(game.uwep, dagger);
        assert.equal(game.uarmc, cloak);
    });
}
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
//# sourceMappingURL=equipment_selection.test.js.map