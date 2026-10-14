import test from 'node:test';
import assert from 'node:assert/strict';
import { W_ARM, W_ARMC, W_ARMG } from '../js/const.js';
import { game } from '../js/gstate.js';
import { CAN_OF_GREASE, CLOAK_OF_PROTECTION, DAGGER, GAUNTLETS_OF_POWER, LEATHER_ARMOR, POT_HEALING } from '../js/object_data.js';
import { applyInventoryObject, runExtendedCommand } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';
void test('apply coats an inventory object and consumes one charge of grease', async () => {
    freshPlayableRoom();
    const grease = await addInventoryObject(CAN_OF_GREASE, { spe: 3 });
    const dagger = await addInventoryObject(DAGGER);
    await applyInventoryObject(grease, dagger.invlet);
    assert.equal(dagger.greased, true);
    assert.equal(grease.spe, 2);
    assert.equal(game.context.move, 1);
    assert.match(game._pending_message, /thick layer of grease/);
});
void test('apply accepts bare hands as a grease target and makes them slippery', async () => {
    freshPlayableRoom();
    const grease = await addInventoryObject(CAN_OF_GREASE, { spe: 3 });
    await applyInventoryObject(grease, '-');
    assert.ok((game.u.glibTurns ?? 0) >= 5 && (game.u.glibTurns ?? 0) <= 15);
    assert.equal(game.u.glib, true);
    assert.equal(grease.spe, 2);
    assert.match(game._pending_message, /coat your fingers with grease/);
});
void test('slippery hands drop the grease can without consuming a charge', async () => {
    const level = freshPlayableRoom({ hero: { glibTurns: 8, glib: true } });
    const grease = await addInventoryObject(CAN_OF_GREASE, { spe: 3 });
    await applyInventoryObject(grease);
    assert.equal(grease.spe, 3);
    assert.equal(grease.where, 'floor');
    assert.ok(level.objects[game.u.ux]?.[game.u.uy]?.includes(grease));
    assert.equal(game.context.move, 1);
});
void test('grease cannot reach armor beneath a cloak and wastes no charge or turn', async () => {
    freshPlayableRoom();
    const grease = await addInventoryObject(CAN_OF_GREASE, { spe: 3 });
    const suit = await addInventoryObject(LEATHER_ARMOR, { owornmask: W_ARM });
    const cloak = await addInventoryObject(CLOAK_OF_PROTECTION, { owornmask: W_ARMC });
    game.uarm = game.u.uarm = suit;
    game.uarmc = game.u.uarmc = cloak;
    await applyInventoryObject(grease, suit.invlet);
    assert.equal(grease.spe, 3);
    assert.equal(suit.greased ?? false, false);
    assert.equal(game.context.move, 0);
    assert.match(game._pending_message, /need to take off .*cloak.* to grease/);
});
void test('an empty known grease can reports that it is empty and takes time', async () => {
    freshPlayableRoom();
    const grease = await addInventoryObject(CAN_OF_GREASE, { spe: 0 });
    await applyInventoryObject(grease);
    assert.equal(game._pending_message, 'The can of grease is empty.');
    assert.equal(game.context.move, 1);
});
void test('a dropped grease can slips from the fingers even when gloves are worn', async () => {
    freshPlayableRoom({ hero: { glibTurns: 8, glib: true } });
    const grease = await addInventoryObject(CAN_OF_GREASE, { spe: 3 });
    const gloves = await addInventoryObject(GAUNTLETS_OF_POWER, { owornmask: W_ARMG });
    game.uarmg = game.u.uarmg = gloves;
    await applyInventoryObject(grease);
    assert.equal(game._pending_message, 'The can of grease slips from your fingers.');
    assert.equal(grease.where, 'floor');
});
for (const blind of [false, true]) {
    void test(`greasing an unseen potion ${blind ? 'keeps its appearance unknown while blind' : 'observes its appearance while sighted'}`, async () => {
        freshPlayableRoom({ hero: { blind, blindTurns: blind ? 12 : 0 } });
        game.objectDescriptions ||= [];
        game.objectDescriptions[POT_HEALING] = 'pink';
        const grease = await addInventoryObject(CAN_OF_GREASE, { spe: 3 });
        const potion = await addInventoryObject(POT_HEALING, {
            observed: false, dknown: false, known: false, typeKnown: false,
        });
        await runExtendedCommand('apply', `${grease.invlet}${potion.invlet}`);
        assert.equal(game._pending_message, `You cover your ${blind ? 'potion' : 'pink potion'} with a thick layer of grease.`);
        assert.equal(potion.dknown, !blind);
        assert.equal(potion.greased, true);
        assert.equal(grease.spe, 2);
        assert.equal(game.context.move, 1);
    });
}
//# sourceMappingURL=grease_apply.test.js.map