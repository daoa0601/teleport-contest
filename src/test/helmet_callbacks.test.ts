import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { disintegrateWornArmor } from '../js/armor.js';
import { currentAttribute } from '../js/attrib.js';
import { rhack } from '../js/cmd.js';
import { A_CHA, A_INT, A_WIS } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { inventoryItemDescription } from '../js/invent.js';
import { CORNUTHAUM, DUNCE_CAP, HELM_OF_OPPOSITE_ALIGNMENT, OBJECT_NAMES } from '../js/object_data.js';
import type { GameObject } from '../js/object_types.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { objectTypeKnown } from '../js/shk.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

for (const role of ['wizard', 'caveman'] as const) {
    void test(`a cornuthaum changes ${role} charisma by role rather than enchantment`, async () => {
        freshObjectRoom({ role });
        const hat = await addInventoryObject(OBJECT_NAMES.indexOf('cornuthaum'), { spe: 4, typeKnown: false });
        const charisma = currentAttribute(A_CHA);

        await dress('W', hat);

        assert.equal(currentAttribute(A_CHA), charisma + (role === 'wizard' ? 1 : -1));
        assert.equal(objectTypeKnown(hat), true);
        assert.equal(!!game.u.clairvoyanceBlocked, role !== 'wizard');
        await dress('T', hat);
        assert.equal(currentAttribute(A_CHA), charisma);
        assert.equal(!!game.u.clairvoyanceBlocked, false);
    });

    void test(`destroying a cornuthaum before ${role} dressing finishes leaves charisma unchanged`, async () => {
        freshObjectRoom({ role });
        const hat = await addInventoryObject(CORNUTHAUM, { typeKnown: false });
        const charisma = currentAttribute(A_CHA);
        assert.ok(hat.invlet);
        resetInputState().feed(hat.invlet);
        await rhack('W'.charCodeAt(0));
        assert.match(await inventoryItemDescription(hat), /\(being donned\)$/);
        assert.equal(currentAttribute(A_CHA), charisma);

        await disintegrateWornArmor(hat);

        assert.equal(currentAttribute(A_CHA), charisma);
        assert.equal(objectTypeKnown(hat), false);
        assert.equal(game.uarmh, null);
        assert.equal(hat.where, 'gone');
        assert.equal(game.multi, 0);
    });

    void test(`destroying a fully worn cornuthaum restores ${role} charisma`, async () => {
        freshObjectRoom({ role });
        const hat = await addInventoryObject(CORNUTHAUM);
        const charisma = currentAttribute(A_CHA);
        await dress('W', hat);
        assert.equal(currentAttribute(A_CHA), charisma + (role === 'wizard' ? 1 : -1));

        await disintegrateWornArmor(hat);

        assert.equal(currentAttribute(A_CHA), charisma);
        assert.equal(game.uarmh, null);
        assert.equal(hat.where, 'gone');
    });
}

void test('a dunce cap curses itself, limits both mental attributes, and refuses takeoff', async () => {
    freshObjectRoom();
    const hat = await addInventoryObject(OBJECT_NAMES.indexOf('dunce cap'), { cursed: false });

    const messages = await dress('W', hat);

    assert.equal(hat.cursed, true);
    assert.equal(currentAttribute(A_INT), 6);
    assert.equal(currentAttribute(A_WIS), 6);
    assert.match(messages, /glows black for a moment/);
    assert.match(messages, /feel like sitting in a corner/);
    resetInputState().feed('    ');
    await rhack('T'.charCodeAt(0));
    assert.equal(game.uarmh, hat);
    assert.equal(game.context.move, 0);
    assert.match(game._pending_message, /It is cursed/);
});

void test('a blind hero loses beatitude knowledge when a dunce cap curses itself', async () => {
    freshObjectRoom({ hero: { blindTurns: 50 } });
    const hat = await addInventoryObject(OBJECT_NAMES.indexOf('dunce cap'), { cursed: false, bknown: true });

    const messages = await dress('W', hat);

    assert.equal(hat.cursed, true);
    assert.equal(hat.bknown, false);
    assert.match(messages, /vibrates for a moment/);
    assert.doesNotMatch(messages, /glows/);
});

for (const type of [DUNCE_CAP, HELM_OF_OPPOSITE_ALIGNMENT]) {
    for (const blind of [false, true]) {
        void test(`wearing an unseen named ${OBJECT_NAMES[type]} ${blind ? 'conceals its name while blind' : 'reveals its name in the glow message'}`, async () => {
            freshObjectRoom({ hero: { blindTurns: 50 } });
            const hat = await addInventoryObject(type, {
                observed: false, dknown: false, known: false, oname: 'Scholar',
            });
            if (!blind) setHeroBlindnessTurns(0);
            assert.equal(hat.dknown, false);

            const messages = await dress('W', hat);

            assert.equal(game.uarmh, hat);
            assert.equal(hat.cursed, true);
            if (blind) {
                assert.match(messages, /vibrates for a moment\./);
                assert.doesNotMatch(messages, /named Scholar/);
            } else {
                assert.match(messages, /named Scholar glows black for a moment\./);
            }
            assert.equal(hat.dknown, !blind);
        });
    }
}

async function dress(command: 'W' | 'T', object: GameObject): Promise<string> {
    assert.ok(object.invlet);
    game._moveloopStarted = true;
    game.u.umovement = 12;
    const input = resetInputState();
    const messages: string[] = [];
    input.beforeRead = () => { messages.push(game._pending_message); };
    input.feed(`${object.invlet}                \x1b\x1b`);
    await rhack(command.charCodeAt(0));
    await moveloop_core();
    await moveloop_core();
    return [...messages, game._pending_message].join(' ');
}
