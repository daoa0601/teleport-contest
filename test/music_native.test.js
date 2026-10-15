import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { game } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { DRUM_OF_EARTHQUAKE, FIRE_HORN, FROST_HORN, MAGIC_FLUTE, MAGIC_HARP, OBJECT_NAMES, WOODEN_FLUTE, WOODEN_HARP } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
import { createStaffedShop } from './support/shop.js';
import { freshTurnRoom } from './support/playable-room.js';
void test('an applied magic flute puts a grabbing monster into wakeable sleep and releases its grip', async () => {
    const input = freshTurnRoom({ heroLevel: 5 });
    const owlbear = await createMonsterAt('owlbear', 11, 10);
    game.u.ustuck = owlbear;
    const flute = await addInventoryObject(MAGIC_FLUTE, { spe: 2 });
    installPagerInput(input, { expected: /playing|music|grip relaxes/, limit: 8 });
    pushKeys(`a${flute.invlet}y`);
    await moveloop_core();
    await finishAtCommandInput(input, moveloop_core, /playing|music|grip relaxes|^$/);
    assert.equal(flute.spe, 1);
    assert.equal(owlbear.msleeping, 1);
    assert.equal(owlbear.mcanmove, 0);
    assert.ok((owlbear.mfrozen ?? 0) > 0);
    assert.equal(game.u.ustuck, null);
});
for (const [species, instrument] of [['snake', 'flute'], ['water nymph', 'harp']]) {
    void test(`playing a wooden ${instrument} calms an invisible ${species} without describing it`, async () => {
        const input = freshTurnRoom({ heroLevel: 30 });
        const target = await createMonsterAt(species, 11, 10);
        target.minvis = true;
        target.mpeaceful = 0;
        const object = await addInventoryObject(instrument === 'flute' ? WOODEN_FLUTE : WOODEN_HARP);
        const messages = [];
        input.beforeRead = () => { messages.push(game._pending_message); };
        installPagerInput(input, { expected: /playing|trills|melody|sways|listens/, limit: 8 });
        pushKeys(`a${object.invlet}y`);
        await moveloop_core();
        await finishAtCommandInput(input, moveloop_core, /playing|trills|melody|sways|listens|^$/);
        messages.push(game._pending_message);
        assert.equal(target.mpeaceful, 1);
        assert.doesNotMatch(messages.join('\n'), /sways with the music|listens cheerfully/);
    });
}
for (const type of [MAGIC_FLUTE, MAGIC_HARP, FIRE_HORN, FROST_HORN, DRUM_OF_EARTHQUAKE]) {
    void test(`applying unpaid ${OBJECT_NAMES[type]} bills its charge before the next turn`, async () => {
        const input = freshTurnRoom({ hero: { levitating: true, uhp: 1000, uhpmax: 1000 } });
        const object = await addInventoryObject(type, { spe: 2 });
        const { shopkeeper } = await createStaffedShop({ keeperX: 14 });
        object.unpaid = true;
        const debit = shopkeeper.eshk.debit;
        installPagerInput(input, { expected: /playing|music|usage fee|thunderous|shaking|chasm|horn|wakes|angry|collapses|cold|fire/, limit: 40 });
        const horn = type === FIRE_HORN || type === FROST_HORN;
        pushKeys(`a${object.invlet}${type === DRUM_OF_EARTHQUAKE ? '' : 'y'}${horn ? ' <' : ''}`);
        await moveloop_core();
        // Check the bill before an earthquake can make the keeper pursue us.
        assert.ok(shopkeeper.eshk.debit > debit, 'Using an unpaid magical instrument incurs a usage fee');
        assert.equal(object.spe, 1);
        await finishAtCommandInput(input, moveloop_core, /playing|music|usage fee|thunderous|shaking|chasm|horn|wakes|angry|collapses|cold|fire|^$/);
    });
}
void test('playing an unidentified magic flute describes its appearance without revealing its type', async () => {
    const input = freshTurnRoom();
    const flute = await addInventoryObject(MAGIC_FLUTE, { spe: 2, known: false, typeKnown: false, oname: 'Silver Song' });
    const messages = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    installPagerInput(input, { expected: /playing|music/, limit: 5 });
    pushKeys(`a${flute.invlet}y`);
    await moveloop_core();
    await finishAtCommandInput(input, moveloop_core, /playing|music|^$/);
    messages.push(game._pending_message);
    assert.match(messages.join('\n'), /You start playing your flute named Silver Song\./);
    assert.doesNotMatch(messages.join('\n'), /magic flute/);
    assert.equal(game._knownObjectTypes?.has(MAGIC_FLUTE) ?? false, false);
});
//# sourceMappingURL=music_native.test.js.map