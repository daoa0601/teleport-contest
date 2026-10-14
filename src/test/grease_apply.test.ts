import test from 'node:test';
import assert from 'node:assert/strict';
import { W_ARM, W_ARMC, W_ARMG, W_ARMU } from '../js/const.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { CAN_OF_GREASE, CLOAK_OF_PROTECTION, CORPSE, DAGGER, GAUNTLETS_OF_POWER, LEATHER_ARMOR, OBJECT_NAMES, POT_HEALING } from '../js/object_data.js';
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

for (const blind of [false, true]) {
    void test(`a covered grease target and both covering layers reveal beatitude to a ${blind ? 'blind' : 'sighted'} priest`, async () => {
        freshPlayableRoom({ role: 'priest', hero: { permaBlind: blind } });
        const grease = await addInventoryObject(CAN_OF_GREASE, { spe: 3 });
        const shirt = await addInventoryObject(OBJECT_NAMES.indexOf('T-shirt'), {
            owornmask: W_ARMU, observed: false, bknown: false, dknown: false,
        });
        const suit = await addInventoryObject(LEATHER_ARMOR, {
            owornmask: W_ARM, observed: false, bknown: false, dknown: false,
        });
        const cloak = await addInventoryObject(CLOAK_OF_PROTECTION, {
            owornmask: W_ARMC, observed: false, bknown: false, dknown: false,
        });
        game.uarmu = game.u.uarmu = shirt;
        game.uarm = game.u.uarm = suit;
        game.uarmc = game.u.uarmc = cloak;
        let refusal = '';
        resetInputState().beforeRead = () => {
            if (game._pending_message.includes('need to take off')) refusal = game._pending_message;
        };

        await runExtendedCommand('apply', `${grease.invlet}${shirt.invlet}    `);

        for (const object of [cloak, suit, shirt]) {
            assert.equal(object.bknown, true, `${object.name} must reveal beatitude when named`);
            assert.equal(object.dknown, !blind);
            assert.equal(object.greased ?? false, false);
        }
        assert.match(refusal, /You need to take off .*cloak.* and leather armor to grease your T-shirt\./);
        assert.equal(grease.spe, 3);
        assert.equal(game.context.move, 0);
    });
}

void test('an empty known grease can reports that it is empty and takes time', async () => {
    freshPlayableRoom();
    const grease = await addInventoryObject(CAN_OF_GREASE, { spe: 0 });

    await applyInventoryObject(grease);

    assert.equal(game._pending_message, 'The can of grease is empty.');
    assert.equal(game.context.move, 1);
});

for (const blind of [false, true]) {
    for (const slipping of [false, true]) {
        void test(`naming ${slipping ? 'a slipping' : 'an empty'} grease can reveals its blessing to a ${blind ? 'blind' : 'sighted'} priest`, async () => {
            freshPlayableRoom({ role: 'priest', hero: { permaBlind: blind, glib: slipping, glibTurns: slipping ? 8 : 0 } });
            const grease = await addInventoryObject(CAN_OF_GREASE, {
                observed: false, dknown: false, bknown: false, blessed: true, spe: slipping ? 3 : 0,
            });

            await runExtendedCommand('apply', grease.invlet);

            assert.equal(grease.bknown, true, 'naming the can must reveal its blessing to a priest');
            assert.equal(grease.dknown, !blind);
            assert.equal(grease.where, slipping ? 'floor' : 'inventory');
            assert.equal(game._pending_message, slipping
                ? 'The can of grease slips from your fingers.' : 'The can of grease is empty.');
            assert.equal(game.context.move, 1);
        });
    }
}

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

        assert.equal(game._pending_message,
            `You cover your ${blind ? 'potion' : 'pink potion'} with a thick layer of grease.`);
        assert.equal(potion.dknown, !blind);
        assert.equal(potion.greased, true);
        assert.equal(grease.spe, 2);
        assert.equal(game.context.move, 1);
    });
}

for (const blind of [false, true]) {
    void test(`greasing a corpse leaves beatitude unknown to a ${blind ? 'blind' : 'sighted'} priest`, async () => {
        freshPlayableRoom({ role: 'priest', hero: { permaBlind: blind } });
        const grease = await addInventoryObject(CAN_OF_GREASE, { spe: 3 });
        const corpse = await addInventoryObject(CORPSE, {
            corpsenm: MONSTER_NAME.indexOf('newt'), blessed: true,
            observed: false, bknown: false, dknown: false,
        });

        await runExtendedCommand('apply', `${grease.invlet}${corpse.invlet}`);

        assert.equal(corpse.bknown, false, 'naming a grease target through cxname must not observe a corpse');
        assert.equal(corpse.dknown, false);
        assert.equal(corpse.greased, true);
        assert.equal(game._pending_message, 'You cover your newt corpse with a thick layer of grease.');
        assert.equal(grease.spe, 2);
        assert.equal(game.context.move, 1);
    });
}

for (const bareHands of [false, true]) {
    void test(`forced inventory menus offer ${bareHands ? 'bare hands' : 'carried items'} for greasing`, async () => {
        freshPlayableRoom({ flags: { force_invmenu: true } });
        const grease = await addInventoryObject(CAN_OF_GREASE, { spe: 3 });
        const dagger = await addInventoryObject(DAGGER);
        let targetMenu = '';
        resetInputState().beforeRead = () => {
            const display = game.nhDisplay;
            assert.ok(display);
            const text = display.grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            if (text.includes('What do you want to grease?')) targetMenu = text;
        };

        await runExtendedCommand('apply', `${grease.invlet}${bareHands ? '-' : dagger.invlet}`);

        assert.match(targetMenu, /- - your fingers\s*\n/);
        assert.match(targetMenu, /dagger/);
        assert.equal(grease.spe, 2);
        assert.equal(game.context.move, 1);
        if (bareHands) assert.equal(game.u.glib, true);
        else assert.equal(dagger.greased, true);
    });
}

void test('the grease hands menu names fingers even when the hero wears gloves', async () => {
    freshPlayableRoom({ flags: { force_invmenu: true } });
    const grease = await addInventoryObject(CAN_OF_GREASE, { spe: 3 });
    const gloves = await addInventoryObject(GAUNTLETS_OF_POWER, { owornmask: W_ARMG });
    game.uarmg = game.u.uarmg = gloves;
    let fingersChoice = '';
    resetInputState().beforeRead = () => {
        const rows = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('').trim());
        if (rows.includes('What do you want to grease?'))
            fingersChoice = rows.find(row => row.startsWith('- - ')) ?? '';
    };

    await runExtendedCommand('apply', `${grease.invlet}-`);

    assert.equal(fingersChoice, '- - your fingers');
    assert.equal(grease.spe, 2);
    assert.equal(game.u.glib, true);
    assert.equal(game._pending_message, 'You coat your gauntlets with grease.');
    assert.equal(game.context.move, 1);
});
